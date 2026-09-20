// Local diagnostic: finds which part of the request the Gemini model rejects.
// Usage: put GEMINI_API_KEY and GEMINI_MODEL in .env, then run: node scripts/probe-gemini.cjs
// Makes ~7 tiny calls with a 1x1 image. The key is never printed.
const path=require('node:path');
try{process.loadEnvFile(path.join(__dirname,'..','.env'));}catch{}
const {schema}=require('../lib/ai.cjs');
const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
if(!key||!model){console.log('.env 파일에 GEMINI_API_KEY 와 GEMINI_MODEL 을 넣어 주세요.');process.exit(1);}
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const upper=s=>Array.isArray(s)?s.map(upper):s&&typeof s==='object'?Object.fromEntries(Object.entries(s).filter(([k])=>k!=='additionalProperties').map(([k,v])=>[k,k==='type'&&typeof v==='string'?v.toUpperCase():upper(v)])):s;
const sys={parts:[{text:'Interpret children drawings as simple walkable 3D scenes. Korean labels.'}]};
const img={role:'user',parts:[{text:'이 그림을 장면으로 해석해 주세요.'},{inlineData:{mimeType:'image/png',data:png}}]};
const variants=[
 ['1 텍스트만',{contents:[{role:'user',parts:[{text:'안녕'}]}]}],
 ['2 + 이미지',{contents:[img]}],
 ['3 + systemInstruction',{systemInstruction:sys,contents:[img]}],
 ['4 + JSON 출력(responseMimeType)',{systemInstruction:sys,contents:[img],generationConfig:{responseMimeType:'application/json'}}],
 ['5 + maxOutputTokens 8192',{systemInstruction:sys,contents:[img],generationConfig:{responseMimeType:'application/json',maxOutputTokens:8192}}],
 ['6 현재 방식: responseJsonSchema',{systemInstruction:sys,contents:[img],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:8192}}],
 ['7 대안: responseSchema',{systemInstruction:sys,contents:[img],generationConfig:{responseMimeType:'application/json',responseSchema:upper(schema),maxOutputTokens:8192}}],
];
(async()=>{
 console.log('모델:',model);
 for(const [name,body] of variants){
  try{
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
   const j=await r.json().catch(()=>({}));
   const msg=String(j?.error?.message||'').split(key).join('[키]').replace(/\s+/g,' ').slice(0,200);
   console.log((r.ok?'OK   ':'실패 ')+name+(r.ok?'':' → HTTP '+r.status+' '+msg)+(r.ok?' (finish: '+(j.candidates?.[0]?.finishReason||'?')+')':''));
  }catch(e){console.log('실패 '+name+' → '+e.message);}
 }
})();
