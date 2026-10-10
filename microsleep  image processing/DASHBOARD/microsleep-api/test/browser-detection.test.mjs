import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
function setup() {
  let now=0,ear=.3,faceCount=1,matched=true,fail=false;const writes=[];
  const eye=()=>[{x:0,y:0},{x:1,y:ear*2},{x:3,y:ear*2},{x:4,y:0},{x:3,y:-ear*2},{x:1,y:-ear*2}];
  const context={window:{},performance:{now:()=>now},crypto:webcrypto,Intl,Date,console,
    faceapi:{nets:Object.fromEntries(['tinyFaceDetector','faceLandmark68Net','faceRecognitionNet'].map(name=>[name,{loadFromUri:async()=>{}}])),
      fetchImage:async()=>({width:480,height:360}),TinyFaceDetectorOptions:class{},
      euclideanDistance:()=>matched?.1:1,
      detectAllFaces:()=>({withFaceLandmarks:()=>({withFaceDescriptors:async()=>Array.from({length:faceCount},()=>({descriptor:Array(128).fill(.1),landmarks:{getLeftEye:eye,getRightEye:eye}}))})})},
    cloudRequest:async(path,body)=>{if(path==='/drivers')return [{name:'Alex',descriptor:Array(128).fill(.1)}];writes.push(structuredClone(body));if(fail)throw new Error('offline');return {ok:true};}};
  context.window.faceapi=context.faceapi;vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../../DASHBOARD/BrowserDetection.js',import.meta.url),'utf8'),context);
  return {engine:context.window.BrowserDetection,writes,set(time,ratio=.3,count=1,match=true){now=time;ear=ratio;faceCount=count;matched=match;},offline(value){fail=value;}};
}
test('browser detects sustained closures, excludes blinks and identity mismatch',async()=>{
  const f=setup();const session=(await f.engine.start('Alex')).session;
  f.set(100,.1);await f.engine.frame(session,'photo');
  f.set(400,.3);await f.engine.frame(session,'photo');assert.equal(f.writes.length,0);
  const location={latitude:3.139,longitude:101.6869,accuracy:12,captured_at:new Date().toISOString()};
  f.set(500,.1);await f.engine.frame(session,'photo',location);
  f.set(1800,.1);await f.engine.frame(session,'photo');
  f.set(2000,.3);const result=await f.engine.frame(session,'photo');
  assert.equal(result.saved,1);assert.equal(f.writes[0].eyes_closed_seconds,1.5);
  assert.deepEqual(f.writes[0].location,location);
  f.set(2500,.1);await f.engine.frame(session,'photo');
  f.set(3000,.1,1,false);assert.equal((await f.engine.frame(session,'photo')).state,'paused');
  f.set(4000,.3);await f.engine.frame(session,'photo');assert.equal(f.writes.length,1);
});
test('save failures retain original event ID for idempotent retry; gaps reset closure',async()=>{
  const f=setup();const session=(await f.engine.start('Alex')).session;
  f.set(100,.1);await f.engine.frame(session,'photo');f.set(1500,.1);await f.engine.frame(session,'photo');
  f.offline(true);f.set(1700,.3);assert.equal((await f.engine.frame(session,'photo')).state,'error');
  assert.equal((await f.engine.stop(session)).ok,false);
  f.offline(false);assert.equal((await f.engine.stop(session)).saved,1);
  assert.equal(new Set(f.writes.map(row=>row.id)).size,1);
  const other=(await f.engine.start('Alex')).session;
  f.set(2000,.1);await f.engine.frame(other,'photo');f.set(5000,.3);await f.engine.frame(other,'photo');
  assert.equal((await f.engine.stop(other)).saved,0);
});
