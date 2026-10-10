'use strict';
window.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('camera_video');
  const frame = document.getElementById('video_frame');
  const placeholder = document.getElementById('camera-placeholder');
  const status = document.getElementById('camera-status');
  const message = document.getElementById('msg_code');
  const snap = document.getElementById('snap_btn');
  const register = document.getElementById('register_btn');
  const reset = document.getElementById('reset_btn');
  const username = document.getElementById('username');
  let stream;
  let photo = '';
  let busy = false;
  let stopped = false;
  function update() {
    snap.disabled = busy || !stream || video.readyState < 2;
    register.disabled = busy || !photo || !username.value.trim();
    reset.disabled = busy;
  }
  function notify(text, state = '') { message.textContent = text; message.dataset.state = state; }
  function stop() { stopped = true; stream?.getTracks().forEach(track => track.stop()); }
  window.addEventListener('pagehide', stop);
  username.addEventListener('input', update);
  video.addEventListener('loadeddata', update);
  snap.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / video.videoWidth, 720 / video.videoHeight);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    photo = canvas.toDataURL('image/jpeg', 0.9);
    frame.src = photo;
    frame.hidden = false;
    video.hidden = true;
    status.textContent = 'Photo captured';
    notify('Photo captured. Enter your name, then register your profile.');
    update();
  });
  reset.addEventListener('click', () => {
    photo = '';
    frame.hidden = true;
    video.hidden = !stream;
    status.textContent = stream ? 'Preview ready' : 'Camera unavailable';
    username.value = '';
    notify('Capture a new photo when you are ready.');
    update();
  });
  document.getElementById('registration-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (register.disabled) return;
    busy = true;
    update();
    notify(window.cloudHosted ? 'Loading face models, checking your photo and saving your profile…' : 'Checking your photo and saving your profile…');
    try {
      const result = await eel.register_browser_face(username.value.trim(), photo)();
      notify(result.message, result.ok ? 'success' : 'error');
      if (result.ok) { photo = ''; stream?.getTracks().forEach(track => track.stop()); stream = null; status.textContent = 'Registered'; }
    } catch { notify('Registration failed. Reload the page and try again.', 'error'); }
    finally { busy = false; update(); }
  });
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this page using HTTPS or localhost to enable camera access.');
    stream = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 960}, height: {ideal: 720}}, audio: false});
    if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    placeholder.hidden = true;
    status.textContent = 'Preview ready';
    status.dataset.state = 'ready';
    notify('Camera connected. Position your face and select Capture photo.');
    update();
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    status.textContent = 'Camera unavailable';
    status.dataset.state = 'error';
    const errors = {
      NotAllowedError: 'Camera permission was denied. Allow camera access in your browser site settings, then reload.',
      NotFoundError: 'No camera was found on this computer. Connect a webcam and reload.',
      NotReadableError: 'Camera is busy or blocked by Windows. Close other camera apps and check Windows camera privacy settings.',
    };
    notify(errors[error.name] || error.message || 'Could not open your browser camera.', 'error');
    update();
  }
});
