import { createHmac, timingSafeEqual } from 'node:crypto';
const cookieName='comanda_admin';
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw Error('Configurează SESSION_SECRET (minimum 32 de caractere).');return s;}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function validOrigin(req:Request){const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin;}
export function isAdmin(req:Request){const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!token)return false;const [expires,signature]=token.split('.');if(!expires||!signature||!/^\d+$/.test(expires)||Number(expires)<Date.now())return false;const expected=createHmac('sha256',secret()).update(expires).digest('hex');return equal(signature,expected);}
export function sessionCookie(){const expires=String(Date.now()+7*86400000);const value=expires+'.'+createHmac('sha256',secret()).update(expires).digest('hex');return `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`;}
