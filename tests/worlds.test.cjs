const test=require('node:test'),assert=require('node:assert');
const {createHandler}=require('../api/worlds.js');
const TOKEN='t'.repeat(40);
function fakeStore(){const h=new Map();
 const fetchImpl=async(url,init)=>{const [c,,f,v]=JSON.parse(init.body);let result=null;
  if(c==='HGETALL')result=[...h].flat();else if(c==='HGET')result=h.get(f)??null;else if(c==='HLEN')result=h.size;else if(c==='HSET')h.set(f,v);else if(c==='HDEL')h.delete(f);
  return {ok:true,json:async()=>({result})};};
 return {h,fetchImpl};}
async function call(handler,{method='GET',url='/api/worlds',token,body}={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=JSON.parse(b);}};
 const req={method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},body};
 await handler(req,res);return res;}
const world=()=>({version:1,title:'테스트',spawn:{x:0,z:11},image:'data:evil',objects:[{id:'a',kind:'tree',label:'나무',x:1,y:0,z:2,rotation:0,scale:1,color:'#aabbcc',visible:true,solid:true,extra:'x'}]});
const env={APP_ACCESS_TOKEN:TOKEN,KV_REST_API_URL:'https://x',KV_REST_API_TOKEN:'k'};

test('no store connected returns 503 so the client can fall back',async()=>{
 const r=await call(createHandler({env:{}}));assert.equal(r.statusCode,503);});
test('publish needs the teacher token; list is public',async()=>{
 const s=fakeStore(),h=createHandler({env,fetchImpl:s.fetchImpl});
 assert.equal((await call(h,{method:'POST',body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:'x'.repeat(40),body:{id:'w1',world:world()}})).statusCode,401);
 assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'w1',world:world()}})).statusCode,200);
 const list=await call(h);assert.equal(list.statusCode,200);assert.equal(list.body.worlds.length,1);
 const w=list.body.worlds[0].world;assert.equal(w.image,null);assert.equal('extra' in w.objects[0],false);});
test('invalid worlds and ids are rejected',async()=>{
 const s=fakeStore(),h=createHandler({env,fetchImpl:s.fetchImpl});
 const bad=world();bad.objects[0].kind='ufo';
 assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'w1',world:bad}})).statusCode,400);
 assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'../x',world:world()}})).statusCode,400);
 assert.equal(s.h.size,0);});
test('delete needs the token and removes the world',async()=>{
 const s=fakeStore(),h=createHandler({env,fetchImpl:s.fetchImpl});
 await call(h,{method:'POST',token:TOKEN,body:{id:'w1',world:world()}});
 assert.equal((await call(h,{method:'DELETE',url:'/api/worlds?id=w1'})).statusCode,401);
 assert.equal((await call(h,{method:'DELETE',url:'/api/worlds?id=w1',token:TOKEN})).statusCode,200);
 assert.equal(s.h.size,0);});
test('list is capped at 30 worlds',async()=>{
 const s=fakeStore(),h=createHandler({env,fetchImpl:s.fetchImpl});
 for(let i=0;i<30;i++)assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'w'+i,world:world()}})).statusCode,200);
 assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'extra',world:world()}})).statusCode,409);
 assert.equal((await call(h,{method:'POST',token:TOKEN,body:{id:'w3',world:world()}})).statusCode,200);});
