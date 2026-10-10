'use strict';
window.LocationTracker = (() => {
  let watch = null;
  let latest = null;
  let generation = 0;
  function stop() {
    generation++;
    if (watch !== null) navigator.geolocation?.clearWatch(watch);
    watch = null;
    latest = null;
  }
  function start(notify) {
    stop();
    const current = generation;
    if (!navigator.geolocation) {notify('Location is not supported. Events will save without coordinates.');return;}
    notify('Waiting for location permission and a position…');
    watch = navigator.geolocation.watchPosition(position => {
      if (current !== generation) return;
      const {latitude, longitude, accuracy} = position.coords;
      if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) || accuracy < 0) return;
      latest = {latitude, longitude, accuracy, captured_at: new Date(position.timestamp).toISOString()};
      notify(`Location available · accuracy ±${Math.round(accuracy)} m. Location sharing is active for your selected options.`);
    }, error => {
      if (current !== generation) return;
      latest = null;
      notify(error.code === 1 ? 'Location denied. Monitoring continues without coordinates.' : 'Location unavailable. Monitoring continues without coordinates.');
    }, {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000});
  }
  function snapshot() {
    if (!latest) return null;
    const age = Date.now() - Date.parse(latest.captured_at);
    return age >= -5000 && age <= 30000 ? {...latest} : null;
  }
  return {start, stop, snapshot};
})();
