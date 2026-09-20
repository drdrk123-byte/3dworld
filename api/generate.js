const crypto=require('node:crypto');
const {generate,parseImage}=require('../lib/ai.cjs');
function createHandler({env=process.env,generateImpl=generate}={}){return async(req,res)=>{
 const send=(code,body)=>{res.statusCode=code;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
 if(req.method!=='POST')return send(405,{error:'POST 요청만 지원합니다.'});
 if(env.AI_ENABLED!=='true')return send(403,{error:'AI 호출이 꺼져 있습니다. 요금 설정을 확인한 뒤 서버에서 활성화해 주세요.'});
 const secret=env.APP_ACCESS_TOKEN||'',auth=req.headers.authorization||'';
 const actual=Buffer.from(auth),expected=Buffer.from('Bearer '+secret);
 if(secret.length<32||actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return send(401,{error:'교사용 연결 암호를 확인해 주세요.'});
 if(!env.GEMINI_API_KEY||!/^gemini-[\w.-]+$/.test(env.GEMINI_MODEL||''))return send(503,{error:'서버의 API 키와 모델 설정이 필요합니다.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'지원하지 않는 요청 형식입니다.'});
 let body=req.body;try{if(!body){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>4000000)throw Error();chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString());}else if(typeof body==='string')body=JSON.parse(body);if(!body||body.approved!==true)return send(403,{error:'이번 그림 전송과 API 호출 승인이 필요합니다.'});parseImage(body.image);}catch{return send(400,{error:'유효한 분석용 그림을 보내 주세요.'});}
 try{const world=await generateImpl({key:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,image:body.image});send(200,{world});}catch(e){send(502,{error:/^(AI|API|모델|선택한 모델|사용 한도)/.test(e.message)?e.message:'응답을 받지 못했습니다. 이미 처리되었을 수 있으니 사용량을 확인한 뒤 재시도해 주세요.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
