// Choices supplied by the restaurant menu and the user's screenshots.
// Each persisted variant is a complete, server-priced menu, never a separately priced course.
export const DAILY_PRICE=3500;
export const dailyGroups=[
 {key:'soup',label:'Ciorbă',options:['Ciorbă de pui','Ciorbă de burtă','Supă cremă de ciuperci']},
 {key:'main',label:'Felul 2',options:['Cașcaval pane','Piept de pui la grătar','Ceafă la grătar','Aripi de pui picante','Șnițel cotlet de porc','Șnițel de pui']},
 {key:'side',label:'Garnitură',options:['Cartofi piure','Cartofi prăjiți','Orez cu legume']},
 {key:'salad',label:'Salată',options:['Salată de varză','Salată de sfeclă roșie','Salată de roșii cu castraveți','Salată de murături asortate']},
] as const;
export type DailyChoices=Record<'soup'|'main'|'side'|'salad',string>;
export type OrderProduct={id:string;name:string;price:number;image?:string;dailyChoices?:DailyChoices};
export function dailyVariants():Omit<OrderProduct,'id'>[]{
 const rows:Omit<OrderProduct,'id'>[]=[];
 for(const soup of dailyGroups[0].options)for(const main of dailyGroups[1].options)for(const side of dailyGroups[2].options)for(const salad of dailyGroups[3].options){
  rows.push({name:`Meniul zilei Griff — ${soup} + ${main} + ${side} + ${salad}`,price:DAILY_PRICE,dailyChoices:{soup,main,side,salad}});
 }
 return rows;
}
