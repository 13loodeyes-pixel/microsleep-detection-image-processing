'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const get = id => document.getElementById(id);
  const video = get('camera_video');
  const driver = get('driver');
  const start = get('start');
  const stop = get('stop');
  let session = null;
  let stream = null;
  let running = false;
  let busy = false;
  let timer;
  let inFlight = Promise.resolve();
  const canvas = document.createElement('canvas');
  function message(text, error = false) {
    get('msg_code').textContent = text;
    get('msg_code').dataset.state = error ? 'error' : '';
  }
  function controls() {
    driver.disabled = Boolean(session) || busy;
    get('reload').disabled = Boolean(session) || busy;
    start.disabled = Boolean(session) || busy || !driver.value;
    stop.disabled = !session || busy;
    get('location-enabled').disabled = !window.cloudHosted || Boolean(session) || busy;
    get('live-location-enabled').disabled = !window.cloudHosted || Boolean(session) || busy;
  }
  function closeCamera() {
    LocationTracker.stop();
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    get('camera-placeholder').hidden = false;
  }
  async function loadDrivers() {
    busy = true;
    controls();
    try {
      const result = await eel.monitoring_drivers()();
      if (!result.ok) throw new Error(result.message);
      driver.replaceChildren(new Option('Select a driver', ''));
      result.names.forEach(name => driver.add(new Option(name, name)));
      message(result.names.length ? 'Select a driver to start.' : 'No browser profiles yet. Register or recapture your driver from the overview.');
    } catch (error) { message(error.message || 'Could not load drivers. Restart the dashboard.', true); }
    finally { busy = false; controls(); }
  }
  async function processFrame() {
    if (!running) return;
    try {
      if (video.readyState < 2) { timer = setTimeout(tick, 250); return; }
      const scale = Math.min(1, 480 / video.videoWidth, 360 / video.videoHeight);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const args = [session, canvas.toDataURL('image/jpeg', 0.8)];
      if (window.cloudHosted) args.push(get('location-enabled').checked ? LocationTracker.snapshot() : null);
      const result = await eel.monitoring_frame(...args)();
      if (window.cloudHosted) SessionReporter.update(result);
      get('saved').textContent = result.saved ?? get('saved').textContent;
      if (!result.ok) throw new Error(result.message);
      get('camera-status').textContent = {open: 'Eyes open', closed: 'Eyes closed', paused: 'Detection paused', error: 'Save error'}[result.state];
      get('camera-status').dataset.state = result.state;
      get('ratio').textContent = result.ratio ?? '—';
      get('duration').textContent = `${Number(result.duration || 0).toFixed(1)} s`;
      message(result.message, result.state === 'error');
      if (result.state === 'error') throw new Error(result.message);
    } catch (error) {
      running = false;
      closeCamera();
      if (window.cloudHosted) SessionReporter.update({ok:true,state:'error'});
      get('camera-status').textContent = 'Session paused';
      message(error.message || 'Connection interrupted. Stop the session before restarting.', true);
    }
    if (running) timer = setTimeout(tick, 150);
  }
  function tick() { inFlight = processFrame(); }
  start.addEventListener('click', async () => {
    busy = true;
    controls();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this page using HTTPS or localhost to enable camera access.');
      stream = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 640}, height: {ideal: 480}}, audio: false});
      video.srcObject = stream;
      await video.play();
      message(window.cloudHosted ? 'Loading face detection models. The first start can take a moment…' : 'Starting monitoring…');
      const result = await eel.monitoring_start(driver.value)();
      if (!result.ok) throw new Error(result.message);
      session = result.session;
      video.hidden = false;
      get('camera-placeholder').hidden = true;
      get('saved').textContent = '0';
      running = true;
      if (window.cloudHosted && (get('location-enabled').checked || get('live-location-enabled').checked)) LocationTracker.start(text => { get('location-status').textContent = text; });
      else get('location-status').textContent = 'Location sharing is off. Events save without coordinates.';
      if (window.cloudHosted) SessionReporter.start(session,driver.value,get('live-location-enabled').checked,text => {get('admin-sharing-status').textContent=text;});
      tick();
    } catch (error) {
      closeCamera();
      const errors = {NotAllowedError:'Allow camera access in browser site settings, then try again.', NotFoundError:'No webcam found. Connect a camera and try again.', NotReadableError:'Camera is busy. Close other camera apps and try again.'};
      message(errors[error.name] || error.message || 'Could not start monitoring.', true);
    } finally { busy = false; controls(); }
  });
  stop.addEventListener('click', async () => {
    busy = true;
    running = false;
    clearTimeout(timer);
    closeCamera();
    controls();
    try {
      await inFlight;
      const result = await eel.monitoring_stop(session)();
      get('saved').textContent = result.saved;
      if (!result.ok) throw new Error(result.message);
      session = null;
      stop.textContent = 'Stop session';
      get('camera-status').textContent = 'Session stopped';
      get('camera-status').dataset.state = '';
      message(`Session complete. ${result.saved} events saved. Return to the overview and search for your driver.`);
    } catch (error) { stop.textContent = 'Retry saving'; message(error.message || 'Could not save. Keep this page open and retry.', true); }
    finally { if (window.cloudHosted) await SessionReporter.stop(Number(get('saved').textContent)); busy = false; controls(); }
  });
  driver.addEventListener('change', controls);
  get('reload').addEventListener('click', loadDrivers);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop.click(); });
  window.addEventListener('beforeunload', event => { if (session) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { if (window.cloudHosted) SessionReporter.abandon(); running = false; clearTimeout(timer); closeCamera(); });
  if (!window.cloudHosted) get('location-status').textContent = 'Location tagging is available on the hosted Cloudflare dashboard.';
  loadDrivers();
});
