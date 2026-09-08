// Tests the real API handler against a mocked database. No remote requests.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'order-edit-test-'));
try{
 const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await writeFile(join(dir,'auth.mjs'),transpile(await readFile('lib/auth.ts','utf8')));
 await writeFile(join(dir,'db.mjs'),`export const calls=[];export async function database(path,options){calls.push({path,args:options?.body?JSON.parse(options.body):null});return options?{id:'test',total:2500,revision:2,items:[],name:'Ana'}:[{id:'test'}];}`);
 const src=(await readFile('app/api/rounds/route.ts','utf8')).replace('@/lib/auth','./auth.mjs').replace('@/lib/database','./db.mjs');await writeFile(join(dir,'route.mjs'),transpile(src));
 process.env.SESSION_SECRET='test-only-secret-with-at-least-32-characters';
 const {sessionCookie}=await import(pathToFileURL(join(dir,'auth.mjs'))),{GET,POST}=await import(pathToFileURL(join(dir,'route.mjs'))),{calls}=await import(pathToFileURL(join(dir,'db.mjs')));
 const origin='https://test.example',cookie=sessionCookie().split(';')[0];
 const id='11111111-1111-4111-8111-111111111111',orderId='22222222-2222-4222-8222-222222222222',product='33333333-3333-4333-8333-333333333333';
 const base={id,orderId,action:'update_order',editToken:'a'.repeat(64),revision:1,name:'Ana',items:[{id:product,qty:2}]};
 const req=(b,c='')=>new Request(origin+'/api/rounds',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:c},body:JSON.stringify(b)});
 let r=await POST(req({...base,editToken:undefined}));assert.equal(r.status,403);assert.equal(calls.length,0);
 r=await POST(req({...base,admin:true,isOwner:true,action:'delete_order'}));assert.equal(r.status,403);assert.equal(calls.length,0);
 r=await POST(req({...base,revision:undefined}));assert.equal(r.status,400);
 r=await POST(req({...base,items:[{id:product,qty:0}]}));assert.equal(r.status,400);
 r=await POST(req({...base,admin:true,total:1}));assert.equal(r.status,200);let call=calls.at(-1);assert.equal(call.args.p_admin,false);assert.equal(call.args.p_revision,1);assert.notEqual(call.args.p_edit_hash,base.editToken);assert.equal(call.args.p_edit_hash.length,64);assert.equal(call.args.total,undefined);
 r=await POST(req({...base,action:'view_order',items:undefined}));assert.equal(r.status,200);assert.equal(calls.at(-1).args.p_action,'view_order');
 r=await POST(req({...base,editToken:undefined},cookie));assert.equal(r.status,200);assert.equal(calls.at(-1).args.p_admin,true);
 r=await POST(req({...base,action:'delete_order',editToken:undefined},cookie));assert.equal(r.status,200);assert.equal(calls.at(-1).args.p_action,'delete_order');
 r=await GET(new Request(origin+'/api/rounds?id='+id));let d=await r.json();assert.equal(d.isOwner,false);assert.deepEqual(d.orders,[]);
 r=await GET(new Request(origin+'/api/rounds?id='+id,{headers:{Cookie:cookie}}));assert.equal(r.status,200);assert.match(calls.at(-1).path,/deleted=eq.false/);assert.doesNotMatch(calls.at(-1).path,/edit_hash/);
 console.log('PASS: editing requires token or admin, forged admin flags rejected, delete restricted to admin, revision and quantity checks, token hashing, server-owned total and hidden deleted orders. SQL migration still requires a Supabase integration check.');
}finally{await rm(dir,{recursive:true,force:true});}
