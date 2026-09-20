const crypto=require('node:crypto');
const kinds=['house','tree','flower','rock','box'];
const KEY='drawing-walk:worlds';
const isId=id=>typeof id==='string'&&/^[\w-]{1,64}$/.test(id);
function bad(msg){const e=Error(msg);e.userMessage=msg;return e;}
const inRange=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
function sanitizeWorld(w){
 if(!w||w.version!==1||typeof w.title!=='string'||!Array.isArray(w.objects)||w.objects.length>80)throw bad('올바른 월드 형식이 아닙니다.');
 const ids=new Set();
 const objects=w.objects.map(o=>{
  if(!o||!kinds.includes(o.kind)||typeof o.id!=='string'||o.id.length>64||ids.has(o.id)||typeof o.label!=='string'||!/^#[0-9a-f]{6}$/i.test(o.color))throw bad('사물 정보가 올바르지 않습니다.');
  ids.add(o.id);
  if(!inRange(o.x,-17,17)||!inRange(o.z,-17,17)||!inRange(o.y,0,10)||!inRange(o.scale,.3,2.5)||!Number.isFinite(o.rotation))throw bad('사물이 월드 범위를 벗어났습니다.');
  return {id:o.id,kind:o.kind,label:o.label.slice(0,40),x:o.x,y:o.y,z:o.z,rotation:o.rotation,scale:o.scale,color:o.color,visible:o.visible!==false,solid:!!o.solid};
 });
 if(!w.spawn||!inRange(w.spawn.x,-17,17)||!inRange(w.spawn.z,-17,17))throw bad('시작 위치가 올바르지 않습니다.');
 return {version:1,title:w.title.slice(0,60)||'이름 없는 월드',spawn:{x:w.spawn.x,z:w.spawn.z},image:null,objects};
}
function authorized(req,env=process.env){
 const secret=env.APP_ACCESS_TOKEN||'',auth=req.headers.authorization||'';
 const actual=Buffer.from(auth),expected=Buffer.from('Bearer '+secret);
 return secret.length>=32&&actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}
// Upstash Redis REST (Vercel Marketplace). Returns null when no store is connected.
function createStore(env=process.env,fetchImpl=fetch){
 const url=env.KV_REST_API_URL||env.UPSTASH_REDIS_REST_URL,token=env.KV_REST_API_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;
 if(!url||!token)return null;
 const cmd=async args=>{
  const r=await fetchImpl(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error)throw Error('storage');
  return j.result;
 };
 return {
  async list(){const flat=(await cmd(['HGETALL',KEY]))||[];const out=[];for(let i=0;i+1<flat.length;i+=2){try{const e=JSON.parse(flat[i+1]);out.push({id:flat[i],created:e.created||0,world:e.world});}catch{}}out.sort((a,b)=>a.created-b.created);return out;},
  async get(id){const v=await cmd(['HGET',KEY,id]);return v?JSON.parse(v):null;},
  async count(){return Number(await cmd(['HLEN',KEY]))||0;},
  async set(id,entry){await cmd(['HSET',KEY,id,JSON.stringify(entry)]);},
  async del(id){await cmd(['HDEL',KEY,id]);}
 };
}
module.exports={sanitizeWorld,authorized,createStore,isId,MAX_WORLDS:30};
