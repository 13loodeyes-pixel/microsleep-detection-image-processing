'use strict';
window.SessionReporter = (() => {
  let id=null,name='',sharing=false,timer=null,registered=false,busy=false;
  let latest={state:'starting',ratio:null,duration:0,saved:0};
  let notify=()=>{};
  async function publish() {
    if(!id||busy)return;
    busy=true;
    try {
      if(!registered) {await cloudRequest('/monitoring/start',{id,name,location_sharing:sharing});registered=true;}
      await cloudRequest('/monitoring/update',{id,...latest,location:sharing?LocationTracker.snapshot():null});
      notify(sharing?'Session status and available live location are shared with the workspace admin.':'Session status is shared. Live location sharing is off.');
    } catch {notify('Admin connection unavailable. Local monitoring continues; updates will retry.');}
    finally {busy=false;}
  }
  return {
    start(token,driver,share,onStatus) {
      id=token;name=driver;sharing=share;registered=false;
      latest={state:'starting',ratio:null,duration:0,saved:0};notify=onStatus;
      clearInterval(timer);timer=setInterval(publish,5000);publish();
    },
    update(result) {latest={state:result.ok?result.state:'error',ratio:result.ratio??null,duration:Number(result.duration||0),saved:Number(result.saved||latest.saved)};},
    async stop(saved) {
      clearInterval(timer);timer=null;
      // The next response cannot restart the periodic timer; send a final close after it settles.
      for(let i=0;busy&&i<50;i++)await new Promise(resolve=>setTimeout(resolve,100));
      if(id&&registered) {
        try {await cloudRequest('/monitoring/update',{id,state:'stopped',ratio:null,duration:0,saved:Number(saved||latest.saved),location:null});}
        catch {notify('Admin status may remain online briefly until its heartbeat expires.');}
      }
      // Keep the stopped ID so a later save retry can update its saved-event count.
    },
    abandon() {
      clearInterval(timer);timer=null;
      if(id&&registered) fetch('/api/monitoring/update',{method:'POST',credentials:'same-origin',keepalive:true,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({id,state:'stopped',ratio:null,duration:0,saved:latest.saved,location:null})}).catch(()=>{});
      id=null;
    },
  };
})();
