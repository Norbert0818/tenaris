// Contract tests: mock OpenAI responses, never call the paid service.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'menu-import-test-'));
const realFetch=global.fetch;
try{
 const auth=ts.transpileModule(await readFile('lib/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 const route=ts.transpileModule((await readFile('app/api/import-menu/route.ts','utf8')).replace("@/lib/auth","./auth.mjs"),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await writeFile(join(dir,'auth.mjs'),auth);await writeFile(join(dir,'route.mjs'),route);
 process.env.SESSION_SECRET='test-only-secret-with-at-least-32-characters';
 const {sessionCookie}=await import(pathToFileURL(join(dir,'auth.mjs')));const {POST}=await import(pathToFileURL(join(dir,'route.mjs')));
 const cookie=sessionCookie().split(';')[0];const origin='https://orders.example';
 const req=(form,c=cookie,o=origin)=>new Request(origin+'/api/import-menu',{method:'POST',headers:{Origin:o,Cookie:c},body:form});
 const text=()=>{const f=new FormData();f.set('text','Clătite 12,50 lei');return f;};
 const file=(bytes,name)=>{const f=new FormData();f.set('file',new Blob([bytes]),name);return f;};
 let calls=0,lastRequest;
 let payload={products:[{name:'Clătite',price:12.5,note:''},{name:'Ceai',price:null,note:'Neclar'}],currency:'RON',warnings:[]};
 global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls++;lastRequest=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]});};
 let r=await POST(req(text(),''));assert.equal(r.status,401);assert.equal(calls,0);
 r=await POST(req(text(),cookie,'https://other.example'));assert.equal(r.status,403);
 delete process.env.OPENAI_API_KEY;r=await POST(req(text()));assert.equal(r.status,503);assert.equal(calls,0);
 process.env.OPENAI_API_KEY='test-key-not-real';
 r=await POST(req(file('invalid','menu.png')));assert.equal(r.status,400);assert.equal(calls,0);
 r=await POST(req(file(new Uint8Array(3*1024*1024+1),'big.jpg')));assert.equal(r.status,413);
 r=await POST(req(text()));assert.equal(r.status,200);let d=await r.json();assert.equal(d.products[0].price,'12.50');assert.equal(d.products[1].price,'');assert.equal(lastRequest.store,false);assert.equal(lastRequest.text.format.strict,true);
 r=await POST(req(file('%PDF-1.7\n','menu.pdf')));assert.equal(r.status,200);assert.equal(lastRequest.input[0].content[0].type,'input_file');assert.match(lastRequest.input[0].content[0].file_data,/^data:application\/pdf;base64,/);
 r=await POST(req(file(new Uint8Array([255,216,255,224]),'menu.jpg')));assert.equal(r.status,200);assert.equal(lastRequest.input[0].content[0].type,'input_image');
 payload.currency='MIXED';r=await POST(req(text()));assert.equal(r.status,400);
 payload.currency='RON';payload.products[0].price=-10;r=await POST(req(text()));d=await r.json();assert.equal(d.products[0].price,'');
 global.fetch=async()=>Response.json({status:'incomplete',output:[]});r=await POST(req(text()));assert.equal(r.status,502);
 global.fetch=async()=>Response.json({error:{}},{status:429});r=await POST(req(text()));assert.equal(r.status,429);
 console.log('PASS: admin and origin guards, missing key, invalid and oversized uploads, text/image/PDF request formats, decimal and unknown prices, mixed currency, incomplete output, upstream quota handling. No paid API calls.');
}finally{global.fetch=realFetch;await rm(dir,{recursive:true,force:true});}
