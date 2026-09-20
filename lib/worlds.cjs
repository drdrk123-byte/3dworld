const crypto=require('node:crypto');
const kinds=['house','tree','flower','rock','box'];
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

// Teacher auth: a Google ID token (Google Identity Services) for an allowed e-mail.
function createAuth(env=process.env,fetchImpl=fetch){
 let certs=null,certsExp=0;
 const getCerts=async()=>{if(certs&&Date.now()<certsExp)return certs;const r=await fetchImpl('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('certs');certs=await r.json();certsExp=Date.now()+3600000;return certs;};
 return async function authorized(req){
  const clientId=env.GOOGLE_CLIENT_ID,allowed=(env.TEACHER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const m=/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(req.headers.authorization||'');
  if(!clientId||!allowed.length||!m)return false;
  try{
   const [h,p,s]=m[1].split('.'),head=JSON.parse(Buffer.from(h,'base64url')),payload=JSON.parse(Buffer.from(p,'base64url'));
   if(head.alg!=='RS256')return false;
   const jwk=(await getCerts()).keys?.find(k=>k.kid===head.kid);if(!jwk)return false;
   if(!crypto.verify('RSA-SHA256',Buffer.from(h+'.'+p),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(s,'base64url')))return false;
   const now=Date.now()/1000;
   return ['https://accounts.google.com','accounts.google.com'].includes(payload.iss)&&payload.aud===clientId&&payload.exp>now&&payload.email_verified===true&&allowed.includes(String(payload.email).toLowerCase());
  }catch{return false;}
 };
}

// Firestore over REST with a service account (kept only in server env vars). Returns null when not configured.
function createStore(env=process.env,fetchImpl=fetch){
 const project=env.FIREBASE_PROJECT_ID,email=env.FIREBASE_CLIENT_EMAIL,pk=(env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
 if(!project||!email||!pk)return null;
 const base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(env.FIREBASE_DATABASE_ID||'(default)')}/documents/worlds`;
 const b64=v=>Buffer.from(v).toString('base64url');
 let cached=null;
 async function accessToken(){
  const now=Math.floor(Date.now()/1000);if(cached&&cached.exp>now+60)return cached.token;
  const head=b64(JSON.stringify({alg:'RS256',typ:'JWT'})),claim=b64(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const sig=crypto.sign('RSA-SHA256',Buffer.from(head+'.'+claim),pk).toString('base64url');
  const r=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+claim+'.'+sig}).toString(),signal:AbortSignal.timeout(8000)});
  const j=await r.json().catch(()=>({}));if(!r.ok||!j.access_token)throw Error('storage');
  cached={token:j.access_token,exp:now+(j.expires_in||3600)};return cached.token;
 }
 async function call(method,url,body){
  const r=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
  if(r.status===404&&method==='GET')return null;
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error('storage');return j;
 }
 const parse=doc=>{try{return {id:doc.name.split('/').pop(),created:Number(doc.fields.created?.integerValue)||0,world:JSON.parse(doc.fields.data.stringValue)};}catch{return null;}};
 const docs=async()=>((await call('GET',base+'?pageSize=100'))?.documents||[]).map(parse).filter(Boolean);
 return {
  async list(){return (await docs()).sort((a,b)=>a.created-b.created);},
  async get(id){const j=await call('GET',base+'/'+encodeURIComponent(id));const d=j&&parse(j);return d?{created:d.created,world:d.world}:null;},
  async count(){return (await docs()).length;},
  async set(id,entry){await call('PATCH',base+'/'+encodeURIComponent(id),{fields:{data:{stringValue:JSON.stringify(entry.world)},created:{integerValue:String(entry.created)}}});},
  async del(id){await call('DELETE',base+'/'+encodeURIComponent(id));}
 };
}
module.exports={sanitizeWorld,createAuth,createStore,isId,MAX_WORLDS:30};
