'use strict';
let activityChart;
const periods = [
  ['Morning', '06:00–11:59', '#7f9d6c'], ['Afternoon', '12:00–14:59', '#c3ab77'],
  ['Evening', '15:00–19:59', '#a496bc'], ['Night', '20:00–23:59', '#365e51'],
  ['Midnight', '00:00–05:59', '#8baab4'],
];
function activityRows(kind, data) {
  if (kind === 'pattern') return periods.map(([label, range, color], index) => ({label, range, color, count: Math.max(0, Number(data.count_days?.[index]) || 0)}));
  return (Array.isArray(data.date) ? data.date : []).map((label, index) => ({label: String(label), count: Math.max(0, Number(data.eye_close?.[index]) || 0), color: '#245c4c'}))
    .sort((a, b) => a.label.split('/').reverse().join('').localeCompare(b.label.split('/').reverse().join('')));
}
function renderActivity(kind, data) {
  const get = id => document.getElementById(id);
  const pattern = kind === 'pattern';
  const rows = activityRows(kind, data);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const active = rows.filter(row => row.count > 0);
  const peaks = total ? rows.filter(row => row.count === Math.max(...rows.map(row => row.count))) : [];
  const top = peaks[0];
  get('driver-label').textContent = data.driver ? `Driver: ${data.driver}` : 'Recorded activity';
  get('label-one').textContent = pattern ? 'RECORDED EVENTS' : 'TOTAL EYE CLOSURES';
  get('metric-one').textContent = total;
  get('label-two').textContent = pattern ? 'MOST ACTIVE PERIOD' : 'HIGHEST COUNT DAY';
  get('metric-two').textContent = peaks.length > 1 ? 'Multiple tied' : top?.label || '—';
  get('detail-two').textContent = top ? `${top.count} ${pattern ? 'events' : 'closures'}${peaks.length > 1 ? ` · ${peaks.length} periods tied` : ''}` : 'No recorded activity';
  get('label-three').textContent = pattern ? 'TOP PERIOD SHARE' : 'DAYS WITH RECORDINGS';
  get('metric-three').textContent = pattern ? (total ? `${(top.count / total * 100).toFixed(1)}%` : '—') : active.length;
  get('detail-three').textContent = pattern ? 'Share of all classified events' : 'Dates with recorded eye closures';
  get('table-label').textContent = pattern ? 'Time of day' : 'Recorded date';
  get('chart-description').textContent = pattern ? 'Share of events across five time-of-day periods.' : 'Recorded eye closure counts grouped by date.';
  get('chart-note').textContent = pattern ? 'Each event contributes once to its recorded time-of-day category.' : 'Dates without recordings are omitted; they do not imply zero activity.';
  get('table-count').textContent = `(${rows.length})`;
  get('event-values').replaceChildren();
  get('period-list').replaceChildren();
  rows.forEach(row => {
    const share = total ? `${(row.count / total * 100).toFixed(1)}%` : '0.0%';
    const tr = document.createElement('tr');
    [row.label, String(row.count), share].forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.append(td); });
    get('event-values').append(tr);
    if (pattern) {
      const item = document.createElement('div'); item.className = 'period-row';
      const dot = document.createElement('span'); dot.className = 'period-dot'; dot.style.backgroundColor = row.color;
      const text = document.createElement('div'); text.className = 'period-text';
      const name = document.createElement('strong'); name.textContent = row.label;
      const range = document.createElement('small'); range.textContent = row.range;
      text.append(name, range);
      const value = document.createElement('div'); value.className = 'period-value'; value.textContent = share;
      const count = document.createElement('small'); count.textContent = `${row.count} events`; value.append(count);
      item.append(dot, text, value); get('period-list').append(item);
    }
  });
  get('period-list').hidden = !pattern || !total;
  get('chart-wrap').hidden = !total;
  get('empty-state').hidden = Boolean(total);
  get('page-status').textContent = total ? 'Recorded activity loaded.' : 'No recorded activity for the selected driver.';
  activityChart?.destroy();
  if (!total) return;
  if (typeof Chart === 'undefined') {
    get('chart-wrap').hidden = true;
    get('page-status').textContent = 'Chart library could not load. Recorded values remain available below.';
    get('page-status').dataset.state = 'error';
    return;
  }
  activityChart = new Chart(get('activity-chart'), {
    type: pattern ? 'doughnut' : 'bar',
    data: {labels: rows.map(row => row.label), datasets: [{label: pattern ? 'Events' : 'Eye closures',
      data: rows.map(row => row.count), backgroundColor: rows.map(row => row.color),
      borderWidth: pattern ? 4 : 0, borderColor: '#fff', borderRadius: pattern ? 0 : 6, maxBarThickness: 52}]},
    options: {responsive: true, maintainAspectRatio: false, cutout: pattern ? '74%' : undefined,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : {duration: 400},
      plugins: {legend: {display: false}, tooltip: {backgroundColor: '#183c36', padding: 12,
        callbacks: {label: context => `${context.raw} ${pattern ? 'events' : 'closures'} · ${(Number(context.raw) / total * 100).toFixed(1)}%`}}},
      ...(pattern ? {} : {scales: {
        x: {grid: {display: false}, border: {display: false}, ticks: {color: '#687b75', maxTicksLimit: 7, maxRotation: 30, font: {size: 10}}, title: {display: true, text: 'Recorded date', color: '#687b75'}},
        y: {beginAtZero: true, border: {display: false}, grid: {color: '#edf1e8'}, ticks: {precision: 0, color: '#687b75'}, title: {display: true, text: 'Eye closure count', color: '#687b75'}},
      }}),
    },
  });
}
async function loadActivity(kind) {
  try {
    const data = kind === 'pattern' ? await eel.GetDailyMicrosleepPattern()() : await eel.getTotalEyesClosedPerDay()();
    renderActivity(kind, data);
  } catch {
    const status = document.getElementById('page-status');
    status.textContent = 'Could not load insights. Return to the overview, select a driver, and try again.';
    status.dataset.state = 'error';
    document.getElementById('chart-wrap').hidden = true;
  }
}
