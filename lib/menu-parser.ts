export type MenuRow = {name:string;price:string;note:string;selected:boolean};
// A conservative text parser, not a language model. Never infers a missing price.
export function parseMenu(text:string, fallback='RON') {
 const units=[...text.matchAll(/\b(RON|lei|EUR|HUF|Ft)\b|€/gi)].map(m=>/ron|lei/i.test(m[0])?'RON':/eur|€/i.test(m[0])?'EUR':'HUF');
 const currencies=[...new Set(units)];
 const rows:MenuRow[]=[];
 const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
 const warnings=['OCR poate confunda numele și prețurile. Verifică rezultatul cu meniul original.'];
 if(currencies.length!==1)warnings.push(currencies.length?'Sunt mai multe monede. Importă separat produsele din fiecare monedă.':'Moneda nu este precizată; confirmă moneda listei.');
 for(const line of lines){
  if(rows.length>=100){warnings.push('S-au păstrat primele 100 de rânduri. Importă restul separat.');break;}
  if(!/[\p{L}]/u.test(line)||/^(?:tel\.?|telefon|https?:|www\.|program|livrare|alergeni|ingrediente|valoare energetic)/i.test(line))continue;
  const match=line.match(/^(.*?)\s*(?:[—–:|]|\.{2,}|\s)\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(RON|lei|EUR|€|HUF|Ft)?\s*$/i);
  let name=line,price='',note='Preț neidentificat. Poate fi un titlu sau o descriere; debifează dacă nu este un produs.';
  if(match&&/[\p{L}]/u.test(match[1])){
   name=match[1].replace(/[\s.—–:|]+$/,'').trim();
   const multi=/\d\s*(?:RON|lei|EUR|€|HUF|Ft)\b|\d\s*\/\s*$/i.test(name);
   if(multi){note='Mai multe prețuri pe același rând; separă variantele manual.';name=line;}
   else if(Number(match[2].replace(',','.'))<=100000){price=Number(match[2].replace(',','.')).toFixed(2);note=match[3]?'':'Preț fără monedă explicită; verifică dacă este un preț, nu gramaj.';}
  }
  rows.push({name:name.slice(0,100),price,note,selected:price!==''});
 }
 return {products:rows,currency:currencies.length===1?currencies[0]:fallback,warnings};
}
