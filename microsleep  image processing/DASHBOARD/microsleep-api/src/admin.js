const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const locationValid=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Number.isFinite(value.latitude)&&Math.abs(value.latitude)<=90&&
  Number.isFinite(value.longitude)&&Math.abs(value.longitude)<=180&&
  Number.isFinite(value.accuracy)&&value.accuracy>=0&&typeof value.captured_at==='string'&&
  Number.isFinite(Date.parse(value.captured_at))&&Date.now()-Date.parse(value.captured_at)<=45000&&Date.parse(value.captured_at)-Date.now()<=5000;
export async function adminApi(request,env,body) {
  const path=new URL(request.url).pathname;
  if(path==='/api/monitoring/start'&&request.method==='POST') {
    if(!uuid(body.id)||typeof body.name!=='string'||typeof body.location_sharing!=='boolean')return json({error:'Invalid session'},400);
    const profile=await env.DB.prepare('SELECT name FROM browser_profiles WHERE name=?').bind(body.name).first();
    if(!profile)return json({error:'Select a registered browser profile'},400);
    const now=Date.now();
    await env.DB.prepare('DELETE FROM monitoring_sessions WHERE last_seen < ?').bind(now-30*86400000).run();
    await env.DB.prepare("INSERT INTO monitoring_sessions(id,username,started_at,last_seen,state,location_sharing) VALUES (?,?,?,?,'starting',?) ON CONFLICT(id) DO NOTHING")
      .bind(body.id,body.name,now,now,body.location_sharing?1:0).run();
    return json({ok:true},201);
  }
  if(path==='/api/monitoring/update'&&request.method==='POST') {
    if(!uuid(body.id)||!['starting','open','closed','paused','error','stopped'].includes(body.state)||
      (body.ratio!=null&&(!Number.isFinite(body.ratio)||body.ratio<0||body.ratio>2))||
      !Number.isFinite(body.duration)||body.duration<0||body.duration>3600||
      !Number.isSafeInteger(body.saved)||body.saved<0)return json({error:'Invalid session update'},400);
    const session=await env.DB.prepare('SELECT * FROM monitoring_sessions WHERE id=?').bind(body.id).first();
    if(!session)return json({error:'Session not found'},404);
    if(body.location!=null&&(!session.location_sharing||!locationValid(body.location)))return json({error:'Location sharing is off or position is invalid'},400);
    if(session.stopped_at) {
      if(body.state==='stopped') await env.DB.prepare('UPDATE monitoring_sessions SET saved_events=MAX(saved_events,?) WHERE id=?').bind(body.saved,body.id).run();
      return json({ok:true});
    }
    const location=body.state==='stopped'?null:body.location;
    await env.DB.prepare('UPDATE monitoring_sessions SET last_seen=?,state=?,eye_ratio=?,closure_seconds=?,saved_events=?,latitude=?,longitude=?,accuracy=?,location_at=?,stopped_at=? WHERE id=?')
      .bind(Date.now(),body.state,body.ratio??null,body.duration,body.saved,location?.latitude??null,location?.longitude??null,
        location?.accuracy??null,location?.captured_at??null,body.state==='stopped'?Date.now():null,body.id).run();
    return json({ok:true});
  }
  if(path==='/api/admin'&&request.method==='GET') {
    const now=Date.now();
    const {results:sessions}=await env.DB.prepare('SELECT * FROM monitoring_sessions ORDER BY last_seen DESC LIMIT 100').all();
    const {results:drivers}=await env.DB.prepare(`SELECT u.name, CASE WHEN p.name IS NULL THEN 0 ELSE 1 END AS browser_ready,
      (SELECT COUNT(*) FROM browser_events b WHERE b.username=u.name)+(SELECT COUNT(*) FROM microsleep_events m WHERE m.username=u.name) AS event_count
      FROM users u LEFT JOIN browser_profiles p ON p.name=u.name ORDER BY u.name`).all();
    const {results:events}=await env.DB.prepare(`SELECT 'legacy:'||m.id AS id,m.username,m.recorded_at,m.eyes_closed_seconds,NULL AS latitude,NULL AS longitude,NULL AS accuracy
      FROM microsleep_events m UNION ALL SELECT b.id,b.username,b.recorded_at,b.eyes_closed_seconds,l.latitude,l.longitude,l.accuracy
      FROM browser_events b LEFT JOIN event_locations l ON b.id=l.event_id ORDER BY recorded_at DESC,id DESC LIMIT 50`).all();
    const summary=await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM users) AS drivers,
      (SELECT COUNT(*) FROM browser_events)+(SELECT COUNT(*) FROM microsleep_events) AS events,
      (SELECT COUNT(*) FROM monitoring_sessions WHERE stopped_at IS NULL AND last_seen>=?) AS online,
      (SELECT COUNT(*) FROM event_locations) AS located_events`).bind(now-20000).first();
    return json({now,summary,drivers,events,sessions:sessions.map(row=>({...row,
      online:!row.stopped_at&&now-row.last_seen<20000,
      location_current:!row.stopped_at&&now-row.last_seen<20000&&row.latitude!=null&&now-Date.parse(row.location_at)<=30000}))});
  }
  return json({error:'Not found'},404);
}
