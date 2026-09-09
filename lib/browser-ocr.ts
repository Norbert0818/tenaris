type OCRWorker={recognize:(image:File|HTMLCanvasElement)=>Promise<{data:{text:string}}>;terminate:()=>Promise<void>;setParameters:(p:Record<string,string>)=>Promise<unknown>};
type Tesseract={createWorker:(languages:string,oem:number,options:{logger:(event:{status:string;progress:number})=>void})=>Promise<OCRWorker>};
declare global {interface Window {Tesseract?:Tesseract}}
let loading:Promise<Tesseract>|undefined;
function loadOCR(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!loading)loading=new Promise<Tesseract>((resolve,reject)=>{
  const script=document.createElement('script');
  const timer=setTimeout(()=>fail(),30000);
  function fail(){clearTimeout(timer);script.remove();loading=undefined;reject(Error('Motorul OCR nu s-a încărcat. Verifică internetul sau folosește introducerea manuală.'));}
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.async=true;script.onerror=fail;
  script.onload=()=>{clearTimeout(timer);if(window.Tesseract)resolve(window.Tesseract);else fail();};document.head.appendChild(script);
 });
 return loading;
}
export async function readMenuFile(file:File,language:string,onProgress:(s:string)=>void){
 if(file.size>10*1024*1024)throw Error('Fișierul poate avea maximum 10 MB.');
 let worker:OCRWorker|undefined;
 const recognize=async(image:File|HTMLCanvasElement)=>{
  if(!worker){onProgress('Se încarcă motorul și limba OCR…');const api=await loadOCR();worker=await api.createWorker(language,1,{logger:e=>{if(e.status==='recognizing text')onProgress(`Se recunoaște textul: ${Math.round(e.progress*100)}%`);}});await worker.setParameters({tessedit_pageseg_mode:'3'});}
  return (await worker.recognize(image)).data.text;
 };
 try{
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
   onProgress('Se deschide documentul PDF…');
   const url='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
   const pdfjs=await import(/* webpackIgnore: true */ url);
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
   const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
   try{
    if(pdf.numPages>5)throw Error('Alege un PDF cu maximum 5 pagini sau importă paginile separat.');
    const pages:string[]=[];
    for(let n=1;n<=pdf.numPages;n++){
     onProgress(`Pagina ${n} din ${pdf.numPages}…`);const page=await pdf.getPage(n);const content=await page.getTextContent();
     const words=content.items.filter((i:any)=>typeof i.str==='string'&&i.str.trim()).sort((a:any,b:any)=>Math.abs(a.transform[5]-b.transform[5])>3?b.transform[5]-a.transform[5]:a.transform[4]-b.transform[4]);
     if(words.reduce((sum:number,i:any)=>sum+i.str.length,0)>30){let y:number|undefined;let text='';for(const w of words){text+=(y!==undefined&&Math.abs(y-w.transform[5])>3?'\n':' ')+w.str;y=w.transform[5];}pages.push(text);}
     else {const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,2200/Math.max(base.width,base.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;pages.push(await recognize(canvas));canvas.width=canvas.height=0;}
    }
    return pages.join('\n');
   }finally{await pdf.destroy();}
  }
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Alege o imagine JPG, PNG, WEBP sau un PDF.');
  return await recognize(file);
 }finally{await worker?.terminate();}
}
