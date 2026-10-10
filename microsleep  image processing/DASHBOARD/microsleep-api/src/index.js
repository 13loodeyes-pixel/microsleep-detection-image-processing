import { browserApi, authenticated } from './browser.js';
const json = (value, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
});
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;

function eventRecord(row) {
  // Preserve the local wall-clock date/time written by the Python detector.
  const [year, month, day, hourText, minute, second] = row.recorded_at.match(/\d+/g);
  const hour = Number(hourText);
  return { id: row.id, Date: `${day}/${month}/${year}`,
    Time: `${String(hour % 12 || 12).padStart(2, '0')}:${minute}:${second} ${hour < 12 ? 'AM' : 'PM'}`,
    'Eyes Closed/S': row.eyes_closed_seconds,
    'Total Number Eyes Closed': row.eyes_closed_count, Day: row.day_period };
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname.startsWith('/api/')) return browserApi(request, env);
    if (!['/events', '/users'].includes(incoming.pathname)) {
      if (!env.ASSETS) return json({error: 'Website assets are not configured'}, 503);
      const publicPaths = ['/Login.html', '/Login.js', '/MainPage.css', '/Login.css'];
      if (!publicPaths.includes(incoming.pathname) && !await authenticated(request, env))
        return Response.redirect(new URL('/Login.html', request.url).href, 302);
      if (incoming.pathname === '/') incoming.pathname = '/MainPage.html';
      const asset = await env.ASSETS.fetch(new Request(incoming, request));
      const headers = new Headers(asset.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', incoming.pathname === '/Admin.html' ? 'strict-origin-when-cross-origin' : 'same-origin');
      headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
      headers.set('X-Frame-Options', 'DENY');
      if (incoming.pathname.endsWith('.html')) headers.set('Cache-Control', 'no-store');
      return new Response(asset.body, {status: asset.status, headers});
    }
    if (!env.API_TOKEN || !env.DB) return json({ error: 'Server is not configured' }, 503);
    if (request.headers.get('Authorization') !== `Bearer ${env.API_TOKEN}`)
      return json({ error: 'Unauthorized' }, 401);
    const url = new URL(request.url);
    if (!['/events', '/users'].includes(url.pathname)) return json({ error: 'Not found' }, 404);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
    try {
      if (request.method === 'GET') {
        if (url.pathname === '/users') {
          const { results } = await env.DB.prepare('SELECT id, name, face_encoding FROM users ORDER BY id').all();
          return json(results.map(row => ({ id: row.id, Name: row.name, FaceEncode: JSON.parse(row.face_encoding) })));
        }
        const username = url.searchParams.get('username');
        const statement = username === null
          ? env.DB.prepare('SELECT * FROM microsleep_events ORDER BY recorded_at, id')
          : env.DB.prepare('SELECT * FROM microsleep_events WHERE username = ? ORDER BY recorded_at, id').bind(username);
        const { results } = await statement.all();
        return json(results.map(eventRecord));
      }
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Expected an object' }, 400);
      if (url.pathname === '/users') {
        if (!validName(body.name) || !Array.isArray(body.face_encoding) ||
            body.face_encoding.length !== 128 || !body.face_encoding.every(Number.isFinite))
          return json({ error: 'A name and 128 finite face encoding values are required' }, 400);
        const result = await env.DB.prepare('INSERT INTO users (name, face_encoding) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
          .bind(body.name, JSON.stringify(body.face_encoding)).run();
        if (!result.meta.changes) return json({ error: 'User already exists' }, 409);
        return json({ id: result.meta.last_row_id }, 201);
      }
      if (!validName(body.username) || typeof body.recorded_at !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(body.recorded_at) ||
          !Number.isFinite(Date.parse(body.recorded_at)) ||
          !Number.isFinite(body.eyes_closed_seconds) || body.eyes_closed_seconds < 0 ||
          !Number.isSafeInteger(body.eyes_closed_count) || body.eyes_closed_count < 0 ||
          !['Morning', 'Afternoon', 'Evening', 'Night', 'Midnight'].includes(body.day_period))
        return json({ error: 'Invalid event fields' }, 400);
      const result = await env.DB.prepare('INSERT INTO microsleep_events (username, recorded_at, eyes_closed_seconds, eyes_closed_count, day_period) VALUES (?, ?, ?, ?, ?)')
        .bind(body.username, body.recorded_at, body.eyes_closed_seconds, body.eyes_closed_count, body.day_period).run();
      return json({ id: result.meta.last_row_id }, 201);
    } catch {
      return json({ error: 'Database operation failed' }, 500);
    }
  },
};
