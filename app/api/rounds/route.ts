import {dailyVariants} from '@/lib/griff-daily';
import { createHash } from 'node:crypto';
import { database } from '@/lib/database';
import { isAdmin, validOrigin } from '@/lib/auth';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get('id'),admin=isAdmin(req);
 if(!id){if(!admin)return fail('Autentifică-te ca organizator pentru a gestiona comenzile.',401);const rounds=await database('rounds?select=id,title,currency,closed,created&order=created.desc');return Response.json({rounds},{headers:{'Cache-Control':'no-store'}});}
 if(!uuid(id))return fail('Link de comandă nevalid.',404);const records=await database('rounds?id=eq.'+id+'&select=id,title,currency,closed,products');if(!records.length)return fail('Comanda nu a fost găsită.',404);
 const orders=admin?await database('orders?round_id=eq.'+id+'&deleted=eq.false&select=id,name,items,total,created,revision&order=created.desc'):[];
 return Response.json({round:records[0],orders,isOwner:admin},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e instanceof Error?e.message:'Datele nu pot fi încărcate.',503);}}
export async function POST(req:Request){try{if(!validOrigin(req))return fail('Cerere nevalidă.',403);const raw=await req.text();if(raw.length>100000)return fail('Cererea este prea mare.',413);const b=JSON.parse(raw);
 if(b.action==='create'){
 if(!isAdmin(req))return fail('Autentifică-te ca organizator.',401);
 if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100||!['RON','HUF','EUR'].includes(b.currency)||!Array.isArray(b.products)||!b.products.length||b.products.length>100)return fail('Introdu denumirea și între 1 și 100 de produse.');
 if(b.products.some((p:any)=>typeof p.name!=='string'||!p.name.trim()||p.name.length>200||!Number.isInteger(p.price)||p.price<0||p.price>10000000))return fail('Verifică produsele și prețurile.');
 if(b.products.filter((p:any)=>p.dailyMenu).length>1||b.products.some((p:any)=>p.dailyMenu&&b.currency!=='RON'))return fail('Meniul zilei Griff poate fi adăugat o singură dată, în RON.');
 const expanded=b.products.flatMap((p:any)=>p.dailyMenu?dailyVariants():[{name:p.name,price:p.price,image:p.image}]);
 const id=crypto.randomUUID();await database('rounds',{method:'POST',body:JSON.stringify({id,title:b.title.trim(),currency:b.currency,products:expanded.map((p:any)=>({id:crypto.randomUUID(),name:p.name.trim(),price:p.price,...(p.dailyChoices?{dailyChoices:p.dailyChoices}:{}),...(typeof p.image==='string'&&/^https:\/\/imagedelivery\.net\/C9mHCjLG8xvsJJ6bWQJL0w\/[a-f0-9-]+\/w=400,fit=scale-down,format=auto$/.test(p.image)?{image:p.image}:{})}))})});return Response.json({id});}
 if(!uuid(b.id))return fail('Link de comandă nevalid.');
 if(b.action==='toggle'){if(!isAdmin(req))return fail('Doar organizatorul poate modifica această comandă.',403);await database('rounds?id=eq.'+b.id,{method:'PATCH',body:JSON.stringify({closed:!!b.closed})});return Response.json({ok:true});}
 const supported=['order','view_order','update_order','delete_order'];
 if(!supported.includes(b.action)||!uuid(b.orderId))return fail('Operațiune sau identificator nevalid.');
 const admin=isAdmin(req);
 const tokenValid=typeof b.editToken==='string'&&/^[a-f0-9]{64}$/.test(b.editToken);
 if(b.action==='delete_order'&&!admin)return fail('Doar organizatorul poate șterge comanda.',403);
 if((b.action==='order'||!admin)&&!tokenValid)return fail('Linkul de editare lipsește sau nu este valid.',403);
 if(['update_order','delete_order'].includes(b.action)&&(!Number.isInteger(b.revision)||b.revision<0))return fail('Reîncarcă această comandă înainte de modificare.');
 if(['order','update_order'].includes(b.action)){
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||!Array.isArray(b.items)||!b.items.length||b.items.length>100)return fail('Introdu numele tău și alege cel puțin un produs.');
 if(b.items.some((i:any)=>!uuid(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>999)||new Set(b.items.map((i:any)=>i.id)).size!==b.items.length)return fail('Cantitatea trebuie să fie un număr întreg între 1 și 999.');
 }
 const order=await database('rpc/order_operation',{method:'POST',body:JSON.stringify({p_round_id:b.id,p_order_id:b.orderId,p_action:b.action,p_name:b.name||null,p_items:b.items||null,p_edit_hash:tokenValid?createHash('sha256').update(b.editToken).digest('hex'):null,p_admin:admin,p_revision:b.revision??null})});
 return Response.json({ok:true,total:order.total,order},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e instanceof Error?e.message:'Salvarea a eșuat. Încearcă din nou.',503);}}
