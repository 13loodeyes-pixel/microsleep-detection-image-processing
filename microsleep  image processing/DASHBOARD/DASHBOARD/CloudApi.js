/* Preserve the local Python workflow while providing same-origin Cloudflare APIs. */
'use strict';
if (location.hostname === 'localhost' && location.port === '8000') {
  document.write('<script src="/eel.js"><\/script>');
} else {
  window.cloudHosted = true;
  window.cloudRequest = async (path, body) => {
    const result = await fetch('/api' + path, {method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body)});
    if (result.status === 401) { location.assign('/Login.html'); throw new Error('Sign in to continue'); }
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  const selected = () => sessionStorage.getItem('microsleep-driver') || '';
  const events = () => selected() ? cloudRequest('/events?username=' + encodeURIComponent(selected())) : Promise.resolve([]);
  const call = {
    async getName(name) {
      const drivers = await cloudRequest('/drivers');
      const found = drivers.some(row => row.name === name);
      if (found) sessionStorage.setItem('microsleep-driver', name);
      else sessionStorage.removeItem('microsleep-driver');
      return {name_check: found};
    },
    async get_user_data() {
      const rows = await events();
      return {driver: selected(), Time: rows.map(row => row.Time), Locations: rows.map(row => row.Location || null), eyeClose: rows.map(row => row['Eyes Closed/S'])};
    },
    async getTotalEyesClosedPerDay() {
      const rows = await events(); const byDate = new Map();
      rows.forEach(row => byDate.set(row.Date, (byDate.get(row.Date) || 0) + row['Total Number Eyes Closed']));
      return {driver: selected(), date: [...byDate.keys()], eye_close: [...byDate.values()]};
    },
    async GetDailyMicrosleepPattern() {
      const rows = await events();
      const counts = ['Morning','Afternoon','Evening','Night','Midnight'].map(period => rows.filter(row => row.Day === period).length);
      return {driver: selected(), count_days: counts};
    },
    async monitoring_drivers() {
      try { const drivers = await cloudRequest('/drivers'); return {ok:true, names: drivers.filter(row => row.descriptor).map(row => row.name)}; }
      catch (error) {return {ok:false,message:error.message};}
    },
    async start_camera() {},
    async register_browser_face(name, photo) { return BrowserDetection.register(name, photo); },
    async monitoring_start(name) { return BrowserDetection.start(name); },
    async monitoring_frame(token, photo, location) { return BrowserDetection.frame(token, photo, location); },
    async monitoring_stop(token) { return BrowserDetection.stop(token); },
  };
  window.eel = Object.fromEntries(Object.entries(call).map(([name, handler]) => [name,
    (...args) => callback => {
      const promise = handler(...args);
      if (callback) promise.then(callback);
      return promise;
    }]));
  window.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.className = 'signout'; button.textContent = 'Sign out'; button.type = 'button';
    button.addEventListener('click', async () => {
      if (location.pathname.includes('Monitoring') && !confirm('Stop and save your monitoring session before signing out. Continue signing out?')) return;
      try {await cloudRequest('/logout', {}); sessionStorage.clear(); location.assign('/Login.html');}
      catch {button.textContent = 'Retry sign out';}
    });
    document.querySelector('header')?.append(button);
  });
}
