type Draft={name:string;price:string;image?:string;dailyMenu?:boolean};
export function prepareProducts(products:Draft[]){
 const filled=products.filter(p=>p.dailyMenu||p.name.trim()||p.price.trim());
 if(!filled.length)throw Error('Alege un meniu, importă produse sau introdu un produs manual.');
 if(filled.length>100)throw Error('Lista poate avea maximum 100 de produse.');
 if(filled.some(p=>!p.name.trim()||p.name.length>200||!p.price.trim()||!Number.isFinite(Number(p.price.replace(',','.')))||Number(p.price.replace(',','.'))<0||Number(p.price.replace(',','.'))>100000))throw Error('Completează denumirea și prețul produselor din listă. Rândurile complet goale sunt ignorate.');
 return filled.map(p=>({name:p.name.trim(),image:p.image,dailyMenu:p.dailyMenu,price:Math.round(Number(p.price.replace(',','.'))*100)}));
}
