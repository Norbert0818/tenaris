import { database } from '@/lib/database';
import { isAdmin, validOrigin } from '@/lib/auth';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get('id'),admin=isAdmin(req);
 if(!id){if(!admin)return fail('Autentifică-te ca organizator pentru a gestiona comenzile.',401);const rounds=await database('rounds?select=id,title,currency,closed,created&order=created.desc');return Response.json({rounds},{headers:{'Cache-Control':'no-store'}});}
 if(!uuid(id))return fail('Link de comandă nevalid.',404);const records=await database('rounds?id=eq.'+id+'&select=id,title,currency,closed,products');if(!records.length)return fail('Comanda nu a fost găsită.',404);
 const orders=admin?await database('orders?round_id=eq.'+id+'&select=id,name,items,total,created&order=created.desc'):[];
 return Response.json({round:records[0],orders,isOwner:admin},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e instanceof Error?e.message:'Datele nu pot fi încărcate.',503);}}
export async function POST(req:Request){try{if(!validOrigin(req))return fail('Cerere nevalidă.',403);const raw=await req.text();if(raw.length>30000)return fail('Cererea este prea mare.',413);const b=JSON.parse(raw);
 if(b.action==='create'){
 if(!isAdmin(req))return fail('Autentifică-te ca organizator.',401);
 if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100||!['RON','HUF','EUR'].includes(b.currency)||!Array.isArray(b.products)||!b.products.length||b.products.length>50)return fail('Introdu denumirea și între 1 și 50 de produse.');
 if(b.products.some((p:any)=>typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Number.isInteger(p.price)||p.price<0||p.price>10000000))return fail('Verifică produsele și prețurile.');
 const id=crypto.randomUUID();await database('rounds',{method:'POST',body:JSON.stringify({id,title:b.title.trim(),currency:b.currency,products:b.products.map((p:any)=>({id:crypto.randomUUID(),name:p.name.trim(),price:p.price}))})});return Response.json({id});}
 if(!uuid(b.id))return fail('Link de comandă nevalid.');
 if(b.action==='toggle'){if(!isAdmin(req))return fail('Doar organizatorul poate modifica această comandă.',403);await database('rounds?id=eq.'+b.id,{method:'PATCH',body:JSON.stringify({closed:!!b.closed})});return Response.json({ok:true});}
 if(b.action!=='order')return fail('Operațiune necunoscută.');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||!uuid(b.orderId)||!Array.isArray(b.items)||!b.items.length||b.items.length>50)return fail('Introdu numele tău și alege cel puțin un produs.');
 if(b.items.some((i:any)=>!uuid(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>999)||new Set(b.items.map((i:any)=>i.id)).size!==b.items.length)return fail('Cantitatea trebuie să fie un număr întreg între 1 și 999.');
 const result=await database('rpc/submit_order',{method:'POST',body:JSON.stringify({p_round_id:b.id,p_order_id:b.orderId,p_name:b.name.trim(),p_items:b.items})});return Response.json({ok:true,total:result});
 }catch(e){return fail(e instanceof Error?e.message:'Salvarea a eșuat. Încearcă din nou.',503);}}
