'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('serach_bar');
  const search = document.getElementById('seach_btn');
  const message = document.getElementById('msg_error');
  const selection = document.getElementById('selection-status');
  const routes = {
    'ms-eyeclose': 'TotalEyesClosePerDay.html',
    'ms-pattern': 'DailyMicrosleepPatern.html',
    'ms-peakhour': 'GuiFYP.html',
  };
  let revision = 0;
  function lockCards() {
    Object.keys(routes).forEach(id => { document.getElementById(id).disabled = true; });
    selection.textContent = 'Select a driver to get started';
  }
  input.addEventListener('input', () => {
    revision += 1;
    lockCards();
    message.textContent = 'Search to select this driver.';
    message.dataset.state = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const current = ++revision;
    lockCards();
    search.disabled = true;
    message.textContent = 'Looking up driver…';
    message.dataset.state = '';
    try {
      const data = await eel.getName(name)();
      if (current !== revision) return;
      if (data.name_check) {
        Object.keys(routes).forEach(id => { document.getElementById(id).disabled = false; });
        message.textContent = `Driver selected: ${name}`;
        selection.textContent = `Insights for ${name}`;
      } else {
        message.textContent = 'No recordings found for this name. Register a driver or try another name.';
        message.dataset.state = 'error';
      }
    } catch {
      if (current !== revision) return;
      message.textContent = 'Could not load this driver. Check your connection and try again.';
      message.dataset.state = 'error';
    } finally { search.disabled = false; }
  });
  Object.entries(routes).forEach(([id, route]) => {
    document.getElementById(id).addEventListener('click', () => { window.location.href = route; });
  });
  document.getElementById('face-register').addEventListener('click', () => {
    window.location.href = 'FaceRegister.html';
  });
});
