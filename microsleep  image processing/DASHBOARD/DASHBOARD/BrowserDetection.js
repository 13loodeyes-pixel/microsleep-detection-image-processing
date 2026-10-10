'use strict';
window.BrowserDetection = (() => {
  let loading;
  let inference = Promise.resolve();
  const sessions = new Map();
  async function load() {
    if (!loading) loading = (async () => {
      if (!window.faceapi) await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = '/vendor/face-api.min.js';
        script.onload = resolve; script.onerror = () => reject(new Error('Could not load the face detection library. Reload and try again.'));
        document.head.append(script);
      });
      await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'), faceapi.nets.faceRecognitionNet.loadFromUri('/models')]);
    })().catch(error => {loading = undefined; throw error;});
    return loading;
  }
  async function detect(photo) {
    await load();
    const image = await faceapi.fetchImage(photo);
    if (image.width > 1920 || image.height > 1920) throw new Error('Capture a smaller photo.');
    const task = inference.catch(() => {}).then(() => faceapi.detectAllFaces(image,
      new faceapi.TinyFaceDetectorOptions({inputSize: 320, scoreThreshold: 0.5})).withFaceLandmarks().withFaceDescriptors());
    inference = task;
    return task;
  }
  function ratio(points) {
    const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    const width = distance(points[0],points[3]);
    return width ? (distance(points[1],points[5])+distance(points[2],points[4]))/(2*width) : 1;
  }
  function timestamp(date = new Date()) {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
  }
  function reset(session) {session.closed = null;}
  function finish(session) {
    if (session.closed) {
      const seconds=(session.last-session.closed.at)/1000;
      if(seconds>=1) session.pending.push({id:crypto.randomUUID(), username:session.name,
        recorded_at:session.closed.timestamp,eyes_closed_seconds:Math.round(seconds*1000)/1000,eyes_closed_count:1, location:session.closed.location || null});
      reset(session);
    }
  }
  async function save(session) {
    while(session.pending.length) {
      await cloudRequest('/events',session.pending[0]);
      session.pending.shift(); session.saved++;
    }
  }
  return {
    ratio, timestamp,
    async register(name, photo) {
      try {
        const faces=await detect(photo);
        if(faces.length!==1) return {ok:false,message:'Exactly one face must be visible. Capture another photo.'};
        await cloudRequest('/drivers',{name,descriptor:Array.from(faces[0].descriptor)});
        return {ok:true,message:'Driver registered successfully. Browser monitoring is ready.'};
      } catch(error) {return {ok:false,message:error.message || 'Could not register this driver.'};}
    },
    async start(name) {
      try {
        await load();
        const drivers=await cloudRequest('/drivers');
        const profile=drivers.find(row=>row.name===name && row.descriptor);
        if(!profile) return {ok:false,message:'Capture a browser profile for this driver first.'};
        const token=crypto.randomUUID();
        sessions.set(token,{name,descriptor:profile.descriptor,last:performance.now(),closed:null,pending:[],saved:0});
        return {ok:true,session:token};
      } catch(error) {return {ok:false,message:error.message || 'Could not load face detection.'};}
    },
    async frame(token, photo, location = null) {
      const session=sessions.get(token);
      if(!session) return {ok:false,message:'Session expired. Start again.'};
      try {
        const faces=await detect(photo);
        const now=performance.now();
        if(now-session.last>2000) reset(session);
        if(faces.length!==1 || faceapi.euclideanDistance(faces[0].descriptor,session.descriptor)>0.6) {
          reset(session); session.last=now;
          return {ok:true,state:'paused',saved:session.saved,message:'Keep one face matching the selected driver visible.'};
        }
        const landmarks=faces[0].landmarks;
        const ear=(ratio(landmarks.getLeftEye())+ratio(landmarks.getRightEye()))/2;
        session.last=now;
        if(ear<0.22 && !session.closed) session.closed={at:now,timestamp:timestamp(),location:location ? {...location} : null};
        else if(ear>=0.22) finish(session);
        const result={ok:true,state:ear<0.22?'closed':'open',ratio:Math.round(ear*1000)/1000,
          duration:session.closed?(now-session.closed.at)/1000:0,saved:session.saved,message:ear<0.22?'Eyes closed':'Eyes open'};
        try {await save(session);result.saved=session.saved;}
        catch {result.state='error';result.message='Cloud save failed. Stop and retry saving before leaving this page.';}
        return result;
      } catch(error) {reset(session);return {ok:false,message:error.message || 'Frame processing failed.'};}
    },
    async stop(token) {
      const session=sessions.get(token);
      if(!session) return {ok:true,saved:0};
      finish(session);
      try {await save(session);sessions.delete(token);return {ok:true,saved:session.saved};}
      catch {return {ok:false,saved:session.saved,message:'Cloud save failed. Keep this page open and click Retry saving.'};}
    },
  };
})();
