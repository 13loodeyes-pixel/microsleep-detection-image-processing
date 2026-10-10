'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const get=id=>document.getElementById(id);
  let data=null,busy=false,timer=null,map=null,layer=null,fit=true,stopped=false,tilesUnavailable=false;
  function time(value) {
    if(value==null)return '—';
    if(typeof value==='number')return new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour12:true});
    return new Date(/[Z]|[+-]\d\d:\d\d$/.test(value)?value:value+'+08:00').toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour12:true});
  }
  function cell(value){const td=document.createElement('td');if(value instanceof Node)td.append(value);else td.textContent=String(value??'—');return td;}
  function table(id,rows,columns){const body=get(id);body.replaceChildren();if(!rows.length){const tr=document.createElement('tr');const td=cell('No records to show.');td.colSpan=columns;tr.append(td);body.append(tr);return;}rows.forEach(values=>{const tr=document.createElement('tr');values.forEach(value=>tr.append(cell(value)));body.append(tr);});}
  function pill(text,type){const span=document.createElement('span');span.className='status-pill '+type;span.textContent=text;return span;}
  function locationLink(lat,lon){const a=document.createElement('a');a.href=`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;a.textContent=`${lat.toFixed(5)}, ${lon.toFixed(5)}`;a.target='_blank';a.rel='noopener noreferrer';return a;}
  const visible=row=>!get('driver-filter').value||row.username===get('driver-filter').value;
  function render(){
    if(!data)return;
    get('online').textContent=data.summary.online;get('drivers-count').textContent=data.summary.drivers;get('events-count').textContent=data.summary.events;get('located-count').textContent=data.summary.located_events;
    const sessions=data.sessions.filter(visible);
    const positions=sessions.filter(row=>row.location_current);
    table('positions',positions.map(row=>[row.username,locationLink(row.latitude,row.longitude),`±${Math.round(row.accuracy)} m`,time(row.location_at)]),4);
    table('sessions',sessions.map(row=>[row.username,pill(row.stopped_at?'Stopped':row.online?'Online':'Offline',row.online?'online':''),pill(row.state,row.state),row.eye_ratio?.toFixed(3)??'—',`${Number(row.closure_seconds).toFixed(1)} s`,row.saved_events,row.location_sharing?(row.location_current?'Sharing live':'No recent fix'):'Off',time(row.last_seen)]),8);
    table('drivers',data.drivers.map(row=>{const link=document.createElement('a');link.href='GuiFYP.html';link.textContent='View';link.addEventListener('click',()=>sessionStorage.setItem('microsleep-driver',row.name));return [row.name,row.browser_ready?'Ready':'Recapture needed',row.event_count,link];}),4);
    table('events',data.events.filter(visible).map(row=>[row.username,time(row.recorded_at),`${Number(row.eyes_closed_seconds).toFixed(2)} s`,row.latitude==null?'Not recorded':locationLink(row.latitude,row.longitude)]),4);
    if(map){
      layer.clearLayers();
      positions.forEach(row=>{const text=document.createElement('div');text.textContent=`${row.username} · ±${Math.round(row.accuracy)} m · ${time(row.location_at)}`;
        L.circleMarker([row.latitude,row.longitude],{radius:8,color:'#245c4c',fillColor:'#7f9d6c',fillOpacity:.85}).bindPopup(text).addTo(layer);
        L.circle([row.latitude,row.longitude],{radius:Math.min(row.accuracy,50000),weight:1,color:'#7f9d6c',fillOpacity:.08}).addTo(layer);});
      if(fit&&positions.length){map.fitBounds(positions.map(row=>[row.latitude,row.longitude]),{maxZoom:15,padding:[35,35]});fit=false;}
      get('map-status').textContent=tilesUnavailable?'Some map tiles could not load. Shared positions and coordinate links remain available.':positions.length?`${positions.length} recently shared positions. Accuracy circles are capped at 50 km.`:'No current shared locations. Enable live sharing on a monitoring device.';
    }
  }
  async function refresh(){
    if(busy||stopped)return;busy=true;get('refresh').disabled=true;
    try{data=await cloudRequest('/admin');const selected=get('driver-filter').value;
      get('driver-filter').replaceChildren(new Option('All drivers',''));data.drivers.forEach(row=>get('driver-filter').add(new Option(row.name,row.name)));get('driver-filter').value=selected;
      render();get('admin-status').textContent=`Updated ${time(data.now)} · automatic refresh every 10 seconds`;get('admin-status').removeAttribute('data-error');
    }catch(error){get('admin-status').textContent='Live data unavailable. Previously displayed values may be out of date. '+(error.message||'Try refreshing.');get('admin-status').dataset.error='true';
      if(data){data.sessions.forEach(row=>{row.online=false;row.location_current=false;});render();get('online').textContent='—';}}
    finally{busy=false;get('refresh').disabled=false;if(!stopped){clearTimeout(timer);timer=setTimeout(refresh,10000);}}
  }
  get('show-map').addEventListener('click',async()=>{
    const button=get('show-map');button.disabled=true;
    try{
      if(!window.L){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
      get('live-map').hidden=false;map=L.map('live-map').setView([3.139,101.6869],6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{tilesUnavailable=true;render();}).addTo(map);
      layer=L.layerGroup().addTo(map);button.hidden=true;render();
    }catch{get('map-status').textContent='Map could not load. Shared positions remain available in the table.';button.disabled=false;}
  });
  get('driver-filter').addEventListener('change',()=>{fit=true;render();});get('refresh').addEventListener('click',refresh);
  window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});
  if(!window.cloudHosted){get('admin-status').textContent='Open the admin console on your hosted Cloudflare website.';get('refresh').disabled=true;return;}
  refresh();
});
