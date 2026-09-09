// components/daily-menu-picker.tsx
'use client';
import {useState} from 'react';
import {dailyGroups,type DailyChoices,type OrderProduct} from '@/lib/griff-daily';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
export function DailyMenuPicker({products,qty,onChange,disabled=false}:{products:OrderProduct[];qty:Record<string,number>;onChange:(next:Record<string,number>)=>void;disabled?:boolean}){
 const [choices,setChoices]=useState<Partial<DailyChoices>>({}),[amount,setAmount]=useState('1'),[error,setError]=useState('');
 const variants=products.filter(p=>p.dailyChoices);
 if(!variants.length)return null;
 const chosen=variants.filter(p=>qty[p.id]>0);
 function add(){
  const match=variants.find(p=>dailyGroups.every(g=>p.dailyChoices![g.key]===choices[g.key]));
  if(!match){setError('Alege câte un preparat din toate cele 4 categorii.');return;}
  const n=Number(amount);
  if(!Number.isInteger(n)||n<1||n+(qty[match.id]||0)>999){setError('Cantitatea trebuie să fie între 1 și 999 pentru fiecare combinație.');return;}
  onChange({...qty,[match.id]:(qty[match.id]||0)+n});setError('');setChoices({});setAmount('1');
 }
 return <section className="daily-picker" aria-label="Meniul zilei Griff"><div className="section-heading"><h2>Meniul zilei Griff</h2><strong>35,00 lei / meniu</strong></div><p>Alege câte un preparat din fiecare categorie. Cele 4 alegeri formează un singur meniu.</p><div className="daily-choices">{dailyGroups.map(g=><label key={g.key}>{g.label} <span className="required-label">Obligatoriu</span><Select value={choices[g.key]||''} disabled={disabled} onValueChange={value=>setChoices({...choices,[g.key]:value})}><SelectTrigger aria-label={g.label+' — obligatoriu'}><SelectValue placeholder="Alege un preparat"/></SelectTrigger><SelectContent>{Array.from(new Set(variants.map(p=>p.dailyChoices![g.key]))).map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label>)}</div><div className="daily-add"><label>Număr de meniuri<input aria-label="Număr de meniuri Griff" type="number" min="1" max="999" step="1" value={amount} disabled={disabled} onChange={e=>setAmount(e.target.value)}/></label><button type="button" className="secondary" disabled={disabled} onClick={add}>Adaugă meniul în comandă</button></div>{error&&<p className="error" role="alert">{error}</p>}{chosen.length>0&&<div className="daily-selected" aria-live="polite"><h3>Meniuri alese</h3>{chosen.map(p=><div className="daily-selection" key={p.id}><p>{dailyGroups.map(g=>p.dailyChoices![g.key]).join(' · ')}</p><label>Cantitate<input aria-label={'Cantitate '+p.name} type="number" min="1" max="999" step="1" disabled={disabled} value={qty[p.id]} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=999)onChange({...qty,[p.id]:n});}}/></label><strong>{(p.price*qty[p.id]/100).toFixed(2)} lei</strong><button type="button" className="text-button" disabled={disabled} onClick={()=>onChange({...qty,[p.id]:0})}>Elimină meniul</button></div>)}</div>}<p className="small muted">Pentru o altă combinație, fă alte 4 alegeri și adaugă încă un meniu. Poți elimina și înlocui o combinație înainte de salvare.</p></section>;
}
