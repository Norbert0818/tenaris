// lib/database.ts
export async function database(path:string,options:RequestInit={}){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Baza de date nu este configurată. Completează variabilele Supabase în Vercel.');
 const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'};
 // New secret keys use apikey only. Legacy service_role JWTs also use Bearer.
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok){const body=await response.json().catch(()=>({}));if(body.code==='P0001'&&typeof body.message==='string')throw Error(body.message);console.error('Database request failed',response.status,body.code);throw Error('Baza de date nu este disponibilă. Verifică configurarea și încearcă din nou.');}
 if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
}
