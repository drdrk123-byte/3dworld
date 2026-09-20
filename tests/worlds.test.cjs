const test=require('node:test'),assert=require('node:assert'),crypto=require('node:crypto');
const {createHandler}=require('../api/worlds.js');
const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'k1',alg:'RS256',use:'sig'};
const pem=privateKey.export({type:'pkcs8',format:'pem'});
const CLIENT='client-id.apps.googleusercontent.com';
const env={GOOGLE_CLIENT_ID:CLIENT,TEACHER_EMAILS:'Teacher@Example.com',FIREBASE_PROJECT_ID:'proj',FIREBASE_CLIENT_EMAIL:'sa@proj.iam.gserviceaccount.com',FIREBASE_PRIVATE_KEY:pem.replace(/\n/g,'\\n')};
function idToken(over={}){const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const h=b({alg:'RS256',kid:'k1',typ:'JWT'}),p=b({iss:'https://accounts.google.com',aud:CLIENT,exp:Math.floor(Date.now()/1000)+600,email:'teacher@example.com',email_verified:true,...over});
 return h+'.'+p+'.'+crypto.sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');}
function fakeGoogle(){const docs=new Map();const P='https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/worlds';
 const res=(status,body)=>({ok:status<300,status,json:async()=>body});
 const fetchImpl=async(url,init={})=>{url=String(url);
  if(url==='https://oauth2.googleapis.com/token')return res(200,{access_token:'at',expires_in:3600});
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return res(200,{keys:[jwk]});
  assert.equal(init.headers.Authorization,'Bearer at');
  if(url.startsWith(P+'?'))return res(200,docs.size?{documents:[...docs].map(([id,f])=>({name:`projects/proj/databases/(default)/documents/worlds/${id}`,fields:f}))}:{});
  if(url.startsWith(P+'/')){const id=decodeURIComponent(url.slice(P.length+1));
   if(init.method==='PATCH'){docs.set(id,JSON.parse(init.body).fields);return res(200,{});}
   if(init.method==='DELETE'){docs.delete(id);return res(200,{});}
   return docs.has(id)?res(200,{name:`projects/proj/databases/(default)/documents/worlds/${id}`,fields:docs.get(id)}):res(404,{});}
  throw Error('unexpected '+url);};
 return {docs,fetchImpl};}
async function call(handler,{method='GET',url='/api/worlds',token,body}={}){
 const res={setHeader(){},end(b){this.body=JSON.parse(b);}};
 await handler({method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},body},res);return res;}
const world=()=>({version:1,title:'테스트',spawn:{x:0,z:11},image:'data:evil',objects:[{id:'a',kind:'tree',label:'나무',x:1,y:0,z:2,rotation:0,scale:1,color:'#aabbcc',visible:true,solid:true,extra:'x'}]});

test('no store connected returns 503 so the client can fall back',async()=>{
 assert.equal((await call(createHandler({env:{}}))).statusCode,503);});
test('list is public; publishing needs an allowed Google account',async()=>{
 const g=fakeGoogle(),h=createHandler({env,fetchImpl:g.fetchImpl});
 assert.equal((await call(h,{method:'POST',body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:idToken({email:'student@example.com'}),body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:idToken({aud:'other'}),body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:idToken({exp:1}),body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:idToken({email_verified:false}),body:{id:'w1',world:world()}})).statusCode,401);
 const forged=idToken().split('.');forged[2]='A'.repeat(342);
 assert.equal((await call(h,{method:'POST',token:forged.join('.'),body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'w1',world:world()}})).statusCode,200);
 const list=await call(h);assert.equal(list.statusCode,200);assert.equal(list.body.worlds.length,1);
 const w=list.body.worlds[0].world;assert.equal(w.image,null);assert.equal('extra' in w.objects[0],false);});
test('invalid worlds and ids are rejected',async()=>{
 const g=fakeGoogle(),h=createHandler({env,fetchImpl:g.fetchImpl});
 const bad=world();bad.objects[0].kind='ufo';
 assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'w1',world:bad}})).statusCode,400);
 assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'../x',world:world()}})).statusCode,400);
 assert.equal(g.docs.size,0);});
test('delete needs login and removes the world',async()=>{
 const g=fakeGoogle(),h=createHandler({env,fetchImpl:g.fetchImpl});
 await call(h,{method:'POST',token:idToken(),body:{id:'w1',world:world()}});
 assert.equal((await call(h,{method:'DELETE',url:'/api/worlds?id=w1'})).statusCode,401);
 assert.equal((await call(h,{method:'DELETE',url:'/api/worlds?id=w1',token:idToken()})).statusCode,200);
 assert.equal(g.docs.size,0);});
test('list is capped at 30 worlds',async()=>{
 const g=fakeGoogle(),h=createHandler({env,fetchImpl:g.fetchImpl});
 for(let i=0;i<30;i++)assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'w'+i,world:world()}})).statusCode,200);
 assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'extra',world:world()}})).statusCode,409);
 assert.equal((await call(h,{method:'POST',token:idToken(),body:{id:'w3',world:world()}})).statusCode,200);});
