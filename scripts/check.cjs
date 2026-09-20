const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');for(const f of ['public/index.html','public/style.css','public/vendor/three.module.js','public/vendor/LICENSE'])if(!fs.existsSync(path.join(root,f)))throw Error('Missing '+f);
for(const f of ['public/app.js','public/ai-ui.js','api/generate.js','api/status.js','lib/ai.cjs','server.cjs'])execFileSync(process.execPath,['--check',path.join(root,f)]);
JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));console.log('Build checks passed. Static output: public/');
