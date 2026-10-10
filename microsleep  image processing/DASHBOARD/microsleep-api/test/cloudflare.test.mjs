import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {authenticated} from '../src/browser.js';
globalThis.crypto ||= webcrypto;
function environment() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values)},
    async first(){return sqlite.prepare(sql).get(...args)||null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid)}}}});
  return {sqlite,env:{API_TOKEN:'local-test-secret',DB:{prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements) results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}},ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname)}}};
}
const req=(path,body,cookie,origin='https://app.test')=>new Request('https://app.test'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
async function login(env){const result=await worker.fetch(req('/api/login',{password:env.API_TOKEN}),env);assert.equal(result.status,200);return result.headers.get('set-cookie').split(';')[0];}
test('private assets, cookie authentication, tampering, CSRF and logout',async()=>{
  const {env}=environment();
  assert.equal((await worker.fetch(req('/MainPage.html'),env)).status,302);
  assert.equal((await worker.fetch(req('/Login.html'),env)).status,200);
  assert.equal((await worker.fetch(req('/api/drivers'),env)).status,401);
  assert.equal((await worker.fetch(req('/api/login',{password:env.API_TOKEN},null,'https://evil.test'),env)).status,403);
  assert.equal((await worker.fetch(req('/api/login',{password:'wrong'}),env)).status,401);
  const cookie=await login(env);
  assert.equal(await authenticated(req('/',undefined,cookie),env),true);
  assert.equal(await authenticated(req('/',undefined,cookie+'x'),env),false);
  assert.equal(await (await worker.fetch(req('/',undefined,cookie),env)).text(),'/MainPage.html');
  assert.equal((await worker.fetch(req('/api/logout',{},cookie),env)).headers.get('set-cookie').includes('Max-Age=0'),true);
  env.API_TOKEN='rotated';assert.equal(await authenticated(req('/',undefined,cookie),env),false);
});
test('login throttles repeated failures',async()=>{
  const {env}=environment();
  for(let i=0;i<10;i++)assert.equal((await worker.fetch(req('/api/login',{password:'wrong'}),env)).status,401);
  assert.equal((await worker.fetch(req('/api/login',{password:env.API_TOKEN}),env)).status,429);
});
test('browser registration preserves legacy profiles; saves are idempotent; analytics include both sources',async()=>{
  const {env,sqlite}=environment();const cookie=await login(env);
  sqlite.prepare('INSERT INTO users(name,face_encoding) VALUES (?,?)').run('Alex',JSON.stringify(Array(128).fill(.3)));
  assert.equal((await (await worker.fetch(req('/api/drivers',undefined,cookie),env)).json())[0].descriptor,null);
  const descriptor=Array(128).fill(.1);
  assert.equal((await worker.fetch(req('/api/drivers',{name:'Alex',descriptor},cookie),env)).status,201);
  assert.equal(JSON.parse(sqlite.prepare('SELECT face_encoding FROM users').get().face_encoding)[0],.3);
  assert.equal((await worker.fetch(req('/api/drivers',{name:'Alex',descriptor},cookie),env)).status,409);
  assert.equal((await worker.fetch(req('/api/drivers',{name:'Other',descriptor:[1]},cookie),env)).status,400);
  sqlite.prepare('INSERT INTO microsleep_events(username,recorded_at,eyes_closed_seconds,eyes_closed_count,day_period) VALUES (?,?,?,?,?)').run('Alex','2026-10-10T10:00:00',2,1,'Morning');
  const event={id:crypto.randomUUID(),username:'Alex',recorded_at:'2026-10-10T15:02:03+08:00',eyes_closed_seconds:1.4,eyes_closed_count:1};
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(req('/api/events',event,cookie),env)).status,201);
  const rows=await (await worker.fetch(req('/api/events?username=Alex',undefined,cookie),env)).json();
  assert.equal(rows.length,2);assert.equal(rows[1].Time,'03:02:03 PM');assert.equal(rows[1].Day,'Evening');
  assert.equal((await worker.fetch(req('/api/events',{...event,eyes_closed_seconds:-1},cookie),env)).status,400);
});

test('optional event locations validate ranges and freshness and persist through retries',async()=>{
  const {env}=environment();const cookie=await login(env);
  await worker.fetch(req('/api/drivers',{name:'GPS driver',descriptor:Array(128).fill(.1)},cookie),env);
  const event={id:crypto.randomUUID(),username:'GPS driver',recorded_at:'2026-10-10T15:02:03+08:00',eyes_closed_seconds:2,eyes_closed_count:1,
    location:{latitude:3.139,longitude:101.6869,accuracy:12,captured_at:'2026-10-10T07:02:02Z'}};
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(req('/api/events',event,cookie),env)).status,201);
  const rows=await (await worker.fetch(req('/api/events?username=GPS%20driver',undefined,cookie),env)).json();
  assert.equal(rows.length,1);assert.deepEqual(rows[0].Location,event.location);
  for(const location of [{...event.location,latitude:91},{...event.location,accuracy:-1},{...event.location,captured_at:'2026-10-10T06:00:00Z'}]) {
    assert.equal((await worker.fetch(req('/api/events',{...event,id:crypto.randomUUID(),location},cookie),env)).status,400);
  }
  assert.equal((await worker.fetch(req('/api/events',{...event,id:crypto.randomUUID(),location:null},cookie),env)).status,201);
});

test('admin protects live data, requires location consent, expires stale sessions and clears stopped positions',async()=>{
  const {env,sqlite}=environment();const cookie=await login(env);
  assert.equal((await worker.fetch(req('/api/admin'),env)).status,401);
  await worker.fetch(req('/api/drivers',{name:'Live driver',descriptor:Array(128).fill(.1)},cookie),env);
  const id=crypto.randomUUID();
  assert.equal((await worker.fetch(req('/api/monitoring/start',{id,name:'Live driver',location_sharing:false},cookie),env)).status,201);
  const location={latitude:3.139,longitude:101.6869,accuracy:15,captured_at:new Date().toISOString()};
  const update={id,state:'open',ratio:.3,duration:0,saved:0,location};
  assert.equal((await worker.fetch(req('/api/monitoring/update',update,cookie),env)).status,400);
  const shared=crypto.randomUUID();
  await worker.fetch(req('/api/monitoring/start',{id:shared,name:'Live driver',location_sharing:true},cookie),env);
  assert.equal((await worker.fetch(req('/api/monitoring/update',{...update,id:shared},cookie),env)).status,200);
  let data=await (await worker.fetch(req('/api/admin',undefined,cookie),env)).json();
  assert.equal(data.summary.online,2);assert.equal(data.sessions.find(row=>row.id===shared).location_current,true);
  assert.ok(!JSON.stringify(data.drivers).includes('descriptor'));
  sqlite.prepare('UPDATE monitoring_sessions SET last_seen=? WHERE id=?').run(Date.now()-21000,shared);
  data=await (await worker.fetch(req('/api/admin',undefined,cookie),env)).json();
  assert.equal(data.sessions.find(row=>row.id===shared).online,false);assert.equal(data.sessions.find(row=>row.id===shared).location_current,false);
  await worker.fetch(req('/api/monitoring/update',{...update,id:shared,state:'stopped',saved:2,location:null},cookie),env);
  await worker.fetch(req('/api/monitoring/update',{...update,id:shared,state:'stopped',saved:3,location:null},cookie),env);
  const stored=sqlite.prepare('SELECT * FROM monitoring_sessions WHERE id=?').get(shared);
  assert.equal(stored.latitude,null);assert.equal(stored.saved_events,3);assert.ok(stored.stopped_at);
  await worker.fetch(req('/api/monitoring/update',{...update,id:shared},cookie),env);
  assert.equal(sqlite.prepare('SELECT state FROM monitoring_sessions WHERE id=?').get(shared).state,'stopped');
});

test('admin email is required and old shared sessions expire',async()=>{
  const {env}=environment();const oldCookie=await login(env);
  env.ADMIN_EMAIL='fikriskull12@gmail.com';
  assert.equal(await authenticated(req('/',undefined,oldCookie),env),false);
  for(const email of [undefined,'other@example.com']) assert.equal((await worker.fetch(req('/api/login',{email,password:env.API_TOKEN}),env)).status,401);
  const result=await worker.fetch(req('/api/login',{email:' FIKRISKULL12@gmail.com ',password:env.API_TOKEN}),env);
  assert.equal(result.status,200);
  assert.equal(await authenticated(req('/',undefined,result.headers.get('set-cookie').split(';')[0]),env),true);
  env.DASHBOARD_PASSWORD='private-new-password';
  assert.equal((await worker.fetch(req('/api/login',{email:env.ADMIN_EMAIL,password:env.API_TOKEN}),env)).status,401);
  assert.equal((await worker.fetch(req('/api/login',{email:env.ADMIN_EMAIL,password:env.DASHBOARD_PASSWORD}),env)).status,200);
});
