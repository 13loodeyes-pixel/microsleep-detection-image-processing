import {adminApi} from './admin.js';
const response = (data, status = 200, headers = {}) => Response.json(data, { status,
  headers: {'Cache-Control': 'no-store', ...headers} });
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const secret = env => env.DASHBOARD_PASSWORD || env.API_TOKEN;
const cookieName = '__Host-microsleep';
const cookie = value => `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value ? 28800 : 0}`;
async function key(env) { return crypto.subtle.importKey('raw', encoder.encode(secret(env)+(env.ADMIN_EMAIL ? ':'+env.ADMIN_EMAIL.toLowerCase() : '')), {name:'HMAC', hash:'SHA-256'}, false, ['sign', 'verify']); }
async function signedSession(env) {
  const value = `${Math.floor(Date.now()/1000)+28800}.${crypto.randomUUID()}`;
  const signature = hex(await crypto.subtle.sign('HMAC', await key(env), encoder.encode(value)));
  return `${value}.${signature}`;
}
export async function authenticated(request, env) {
  if (!secret(env)) return false;
  const raw = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!raw) return false;
  const [expires, nonce, signature, extra] = raw.split('.');
  if (extra || !nonce || !/^\d+$/.test(expires) || !/^[a-f0-9]{64}$/.test(signature || '') || Number(expires) < Date.now()/1000) return false;
  return crypto.subtle.verify('HMAC', await key(env), Uint8Array.from(signature.match(/../g), x=>parseInt(x,16)), encoder.encode(`${expires}.${nonce}`));
}
async function equalPassword(a,b) {
  const one = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(a)));
  const two = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(b)));
  let difference=0; for(let i=0;i<one.length;i++) difference |= one[i]^two[i];
  return difference===0;
}
const nameValid = name => typeof name==='string' && name.trim().length>0 && name.length<=200;
function browserEvent(row) {
  const [year,month,day,hour,minute,second] = row.recorded_at.match(/\d+/g);
  const h=Number(hour);
  return {id:row.id, Date:`${day}/${month}/${year}`, Time:`${String(h%12||12).padStart(2,'0')}:${minute}:${second} ${h<12?'AM':'PM'}`,
    'Eyes Closed/S':row.eyes_closed_seconds, 'Total Number Eyes Closed':row.eyes_closed_count, Day:row.day_period, Location: row.latitude == null ? null : {latitude:row.latitude,longitude:row.longitude,accuracy:row.accuracy,captured_at:row.captured_at}};
}
export async function browserApi(request, env) {
  const path = new URL(request.url).pathname;
  if (!env.DB || !secret(env)) return response({error:'Server is not configured'},503);
  if (!['GET','POST'].includes(request.method)) return response({error:'Method not allowed'},405);
  if (request.method==='POST' && request.headers.get('Origin')!==new URL(request.url).origin)
    return response({error:'Invalid request origin'},403);
  let body;
  if (request.method==='POST') {
    if (Number(request.headers.get('Content-Length')||0)>20000) return response({error:'Request too large'},413);
    const text=await request.text();
    if(text.length>20000) return response({error:'Request too large'},413);
    try {body=JSON.parse(text);} catch {return response({error:'Invalid JSON'},400);}
    if (!body || typeof body!=='object' || Array.isArray(body)) return response({error:'Expected an object'},400);
  }
  try {
    if (path==='/api/login' && request.method==='POST') {
      const ip=request.headers.get('CF-Connecting-IP')||'local';
      const ipHash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(secret(env)+ip)));
      const bucket=Math.floor(Date.now()/600000);
      await env.DB.prepare('DELETE FROM login_attempts WHERE bucket < ?').bind(bucket-1).run();
      const attempts=await env.DB.prepare('INSERT INTO login_attempts (ip_hash,bucket,attempts) VALUES (?,?,1) ON CONFLICT(ip_hash,bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(ipHash,bucket).first();
      if (attempts.attempts>10) return response({error:'Too many attempts. Try again in ten minutes.'},429);
      const emailMatches=!env.ADMIN_EMAIL || (typeof body.email==='string' && body.email.trim().toLowerCase()===env.ADMIN_EMAIL.toLowerCase());
      if (!emailMatches || typeof body.password!=='string' || body.password.length>512 || !await equalPassword(body.password,secret(env))) return response({error:'Incorrect email or password'},401);
      await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ipHash).run();
      return response({ok:true},200,{'Set-Cookie':cookie(await signedSession(env))});
    }
    if (!await authenticated(request,env)) return response({error:'Sign in to continue'},401);
    if (path==='/api/admin' || path.startsWith('/api/monitoring/')) return await adminApi(request,env,body);
    if (path==='/api/session' && request.method==='GET') return response({ok:true});
    if (path==='/api/logout' && request.method==='POST') return response({ok:true},200,{'Set-Cookie':cookie('')});
    if (path==='/api/drivers' && request.method==='GET') {
      const {results}=await env.DB.prepare('SELECT u.name, p.descriptor FROM users u LEFT JOIN browser_profiles p ON u.name=p.name ORDER BY u.name').all();
      return response(results.map(row=>({name:row.name, descriptor:row.descriptor?JSON.parse(row.descriptor):null})));
    }
    if (path==='/api/drivers' && request.method==='POST') {
      if (!nameValid(body.name)||!Array.isArray(body.descriptor)||body.descriptor.length!==128||!body.descriptor.every(Number.isFinite)) return response({error:'A driver name and valid face descriptor are required'},400);
      const name=body.name.trim();
      const existing=await env.DB.prepare('SELECT name FROM browser_profiles WHERE name=?').bind(name).first();
      if(existing) return response({error:'This driver already has a browser profile. Choose another name.'},409);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (name,face_encoding) VALUES (?, '[]') ON CONFLICT(name) DO NOTHING").bind(name),
        env.DB.prepare('INSERT INTO browser_profiles (name,descriptor) VALUES (?,?)').bind(name,JSON.stringify(body.descriptor)),
      ]);
      return response({ok:true},201);
    }
    if (path==='/api/events' && request.method==='GET') {
      const username=new URL(request.url).searchParams.get('username');
      if(!nameValid(username)) return response({error:'Select a driver'},400);
      const {results}=await env.DB.prepare("SELECT 'legacy:'||id AS id, recorded_at,eyes_closed_seconds,eyes_closed_count,day_period,NULL AS latitude,NULL AS longitude,NULL AS accuracy,NULL AS captured_at FROM microsleep_events WHERE username=? UNION ALL SELECT b.id,b.recorded_at,b.eyes_closed_seconds,b.eyes_closed_count,b.day_period,l.latitude,l.longitude,l.accuracy,l.captured_at FROM browser_events b LEFT JOIN event_locations l ON b.id=l.event_id WHERE b.username=? ORDER BY recorded_at,id").bind(username,username).all();
      return response(results.map(browserEvent));
    }
    if (path==='/api/events' && request.method==='POST') {
      if(!nameValid(body.username)||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||
        typeof body.recorded_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+]08:00$/.test(body.recorded_at)||!Number.isFinite(Date.parse(body.recorded_at))||
        !Number.isFinite(body.eyes_closed_seconds)||body.eyes_closed_seconds<1||body.eyes_closed_seconds>3600||
        body.eyes_closed_count!==1) return response({error:'Invalid event fields'},400);
      const location=body.location;
      if (location != null && (typeof location !== 'object' || Array.isArray(location) ||
        !Number.isFinite(location.latitude) || Math.abs(location.latitude)>90 ||
        !Number.isFinite(location.longitude) || Math.abs(location.longitude)>180 ||
        !Number.isFinite(location.accuracy) || location.accuracy<0 ||
        typeof location.captured_at!=='string' || !Number.isFinite(Date.parse(location.captured_at)) ||
        Math.abs(Date.parse(location.captured_at)-Date.parse(body.recorded_at))>45000))
        return response({error:'Invalid or stale event location'},400);
      const profile=await env.DB.prepare('SELECT name FROM browser_profiles WHERE name=?').bind(body.username).first();
      if(!profile) return response({error:'Register a browser profile first'},400);
      const hour=Number(body.recorded_at.slice(11,13));
      const period=hour<6?'Midnight':hour<12?'Morning':hour<15?'Afternoon':hour<20?'Evening':'Night';
      const eventStatement=env.DB.prepare('INSERT INTO browser_events (id,username,recorded_at,eyes_closed_seconds,eyes_closed_count,day_period) VALUES (?,?,?,?,1,?) ON CONFLICT(id) DO NOTHING')
        .bind(body.id,body.username,body.recorded_at,body.eyes_closed_seconds,period);
      const statements=[eventStatement];
      if(location) statements.push(env.DB.prepare('INSERT INTO event_locations(event_id,latitude,longitude,accuracy,captured_at) VALUES (?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING')
        .bind(body.id,location.latitude,location.longitude,location.accuracy,location.captured_at));
      await env.DB.batch(statements);
      return response({ok:true},201);
    }
    return response({error:'Not found'},404);
  } catch {return response({error:'Database operation failed'},500);}
}
