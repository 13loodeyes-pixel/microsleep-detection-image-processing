'use strict';
let durationChart;
function getDataFromPython(data) {
  const get = id => document.getElementById(id);
  const times = Array.isArray(data.Time) ? data.Time : [];
  const events = (Array.isArray(data.eyeClose) ? data.eyeClose : [])
    .map((value, index) => ({value: Number(value), time: times[index] || 'Unknown time', location: data.Locations?.[index] || null}))
    .filter(row => Number.isFinite(row.value) && row.value >= 0);
  durationChart?.destroy();
  get('event-values').replaceChildren();
  get('driver-label').textContent = data.driver ? `Driver: ${data.driver}` : 'Recorded activity';
  get('chart-wrap').hidden = !events.length;
  get('empty-state').hidden = Boolean(events.length);
  get('event-count').textContent = events.length;
  get('table-count').textContent = `(${events.length})`;
  if (!events.length) {
    ['average', 'longest', 'total'].forEach(id => { get(id).textContent = '—'; });
    get('time').textContent = 'Time unavailable';
    get('page-status').textContent = 'No recorded events for the selected driver.';
    return;
  }
  const total = events.reduce((sum, row) => sum + row.value, 0);
  const peak = events.reduce((best, row) => row.value > best.value ? row : best);
  get('average').textContent = `${(total / events.length).toFixed(2)} s`;
  get('longest').textContent = `${peak.value.toFixed(2)} s`;
  get('total').textContent = `${total.toFixed(2)} s`;
  get('time').textContent = `Recorded at ${peak.time}`;
  events.forEach((row, index) => {
    const tr = document.createElement('tr');
    [String(index + 1), row.time, `${row.value.toFixed(2)} s`].forEach(text => {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    });
    const locationCell = document.createElement('td');
    const location = row.location;
    if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      const link = document.createElement('a');
      link.href = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
      link.title = 'Open this event location in OpenStreetMap';
      const accuracy = document.createElement('small');
      accuracy.textContent = ` · ±${Math.round(location.accuracy)} m`;
      locationCell.append(link, accuracy);
    } else locationCell.textContent = 'Not recorded';
    tr.append(locationCell);
    get('event-values').append(tr);
  });
  get('page-status').textContent = `${events.length} recorded ${events.length === 1 ? 'event' : 'events'} loaded.`;
  if (typeof Chart === 'undefined') {
    get('chart-wrap').hidden = true;
    get('page-status').textContent = 'Chart library could not load. Open “View event values” below to see your data.';
    get('page-status').dataset.state = 'error';
    return;
  }
  durationChart = new Chart(get('myLineChart'), {
    type: 'line',
    data: {labels: events.map(row => row.time), datasets: [{
      label: 'Eye closure duration', data: events.map(row => row.value),
      borderColor: '#245c4c', backgroundColor: '#245c4c12', fill: true,
      borderWidth: 2, tension: 0, pointRadius: events.length > 40 ? 2 : 4,
      pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2,
    }]},
    options: {responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : {duration: 400},
      interaction: {intersect: false, mode: 'index'},
      plugins: {legend: {display: false}, tooltip: {backgroundColor: '#183c36', padding: 12,
        callbacks: {label: context => `Duration: ${Number(context.raw).toFixed(2)} seconds`}}},
      scales: {x: {grid: {display: false}, border: {display: false}, ticks: {color: '#687b75', maxTicksLimit: 6, maxRotation: 0, font: {size: 10}}, title: {display: true, text: 'Recorded time', color: '#687b75'}},
        y: {beginAtZero: true, border: {display: false}, grid: {color: '#edf1e8'}, ticks: {color: '#687b75', font: {size: 10}}, title: {display: true, text: 'Duration (seconds)', color: '#687b75'}}},
    },
  });
}
window.addEventListener('DOMContentLoaded', async () => {
  try { getDataFromPython(await eel.get_user_data()()); }
  catch {
    const status = document.getElementById('page-status');
    status.textContent = 'Could not load insights. Return to the overview, select a driver, and try again.';
    status.dataset.state = 'error';
    document.getElementById('chart-wrap').hidden = true;
  }
});
