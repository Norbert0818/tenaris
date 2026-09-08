import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const roundId='11111111-1111-4111-8111-111111111111',productId='22222222-2222-4222-8222-222222222222';
const calls=[];
const db=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;calls.push({url:req.url,body:raw?JSON.parse(raw):null});res.setHeader('Content-Type','application/json');if(req.url.includes('/rpc/'))res.end('2500');else if(req.url.includes('/orders'))res.end(JSON.stringify([{id:'test',name:'Ana',items:[],total:2500}]));else res.end(JSON.stringify([{id:roundId,title:'Test',products:[{id:productId,name:'Clătite',price:1250}],currency:'RON',closed:false}]));});
db.listen(0,'127.0.0.1');await once(db,'listening');
const port=3317,origin='http://localhost:'+port;
const watchdog=setTimeout(()=>{console.error('Smoke test timed out. Check local networking and free port 3317.');process.exit(1);},30000);
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env:{...process.env,SUPABASE_URL:'http://127.0.0.1:'+db.address().port,SUPABASE_SECRET_KEY:'sb_secret_testing_only',ADMIN_PASSWORD:'test-password-long-and-random',SESSION_SECRET:'testing-only-secret-of-more-than-32-characters'},stdio:['ignore','pipe','pipe']});
let log='';app.stdout.on('data',d=>log+=d);app.stderr.on('data',d=>log+=d);
try{
 let ready=false;for(let i=0;i<60;i++){try{await fetch(origin);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,log);
 const post=(path,body,cookie='',siteOrigin=origin)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:siteOrigin,Cookie:cookie},body:JSON.stringify(body)});
 let r=await fetch(origin+'/api/rounds');assert.equal(r.status,401);
 r=await fetch(origin+'/api/rounds?id='+roundId,{headers:{'oai-authenticated-user-id':'forged'}});let d=await r.json();assert.equal(d.isOwner,false);assert.deepEqual(d.orders,[]);assert.equal(calls.filter(c=>c.url.includes('/orders')).length,0);
 r=await post('/api/rounds',{action:'create'});assert.equal(r.status,401);
 r=await post('/api/auth',{password:'wrong'});assert.equal(r.status,401);
 r=await post('/api/auth',{password:'test-password-long-and-random'},'','https://attacker.example');assert.equal(r.status,403);
 r=await post('/api/auth',{password:'test-password-long-and-random'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 r=await fetch(origin+'/api/rounds?id='+roundId,{headers:{Cookie:cookie}});d=await r.json();assert.equal(d.isOwner,true);assert.equal(d.orders[0].name,'Ana');
 const changed=cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0');r=await fetch(origin+'/api/rounds',{headers:{Cookie:changed}});assert.equal(r.status,401);
 const body={action:'order',id:roundId,name:'Ana',orderId:'33333333-3333-4333-8333-333333333333',items:[{id:productId,qty:2}],total:1};
 r=await post('/api/rounds',{...body,items:[{id:productId,qty:-1}]});assert.equal(r.status,400);
 r=await post('/api/rounds',body);d=await r.json();assert.equal(r.status,200);assert.equal(d.total,2500);const rpc=calls.find(c=>c.url.includes('/rpc/'));assert.equal(rpc.body.total,undefined);assert.deepEqual(rpc.body.p_items,[{id:productId,qty:2}]);
 console.log('PASS: organizer authentication, forged cookie/header rejection, public summary privacy, origin checks, quantity validation and server-calculated total contract. Supabase was mocked; run setup.sql in your own project.');
}finally{clearTimeout(watchdog);app.kill('SIGTERM');db.close();}
