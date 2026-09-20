const {sanitizeWorld,authorized,createStore,isId,MAX_WORLDS}=require('../lib/worlds.cjs');
function createHandler({env=process.env,fetchImpl=fetch}={}){return async(req,res)=>{
 const send=(code,body)=>{res.statusCode=code;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
 const store=createStore(env,fetchImpl);
 if(!store)return send(503,{error:'서버 저장소가 연결되지 않았습니다.'});
 try{
  if(req.method==='GET')return send(200,{worlds:await store.list()});
  if(req.method!=='POST'&&req.method!=='DELETE')return send(405,{error:'지원하지 않는 요청입니다.'});
  if(!authorized(req,env))return send(401,{error:'교사용 연결 암호를 확인해 주세요.'});
  if(req.method==='DELETE'){
   const id=new URL(req.url,'http://localhost').searchParams.get('id');
   if(!isId(id))return send(400,{error:'월드 번호가 올바르지 않습니다.'});
   await store.del(id);return send(200,{ok:true});
  }
  if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'지원하지 않는 요청 형식입니다.'});
  let body=req.body;
  try{
   if(!body){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>400000)throw Error();chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString());}
   else if(typeof body==='string')body=JSON.parse(body);
  }catch{return send(400,{error:'요청을 읽을 수 없습니다.'});}
  if(!body||!isId(body.id))return send(400,{error:'월드 번호가 올바르지 않습니다.'});
  const world=sanitizeWorld(body.world);
  const existing=await store.get(body.id);
  if(!existing&&await store.count()>=MAX_WORLDS)return send(409,{error:`게시 목록은 최대 ${MAX_WORLDS}개까지 만들 수 있습니다.`});
  await store.set(body.id,{created:existing?.created||Date.now(),world});
  return send(200,{id:body.id});
 }catch(e){return send(e.userMessage?400:502,{error:e.userMessage||'서버 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
