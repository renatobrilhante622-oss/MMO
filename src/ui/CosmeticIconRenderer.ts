import type {Cosmetic} from '../progression/AdventureProgress';
import {itemIcon} from './ItemIconRenderer';
import type {Rarity} from '../core/GameTypes';

const eyes='<path d="m24 29 5 2m6 0 5-2" stroke="url(#jewel)" stroke-width="2.5"/>';
const wolf='<path d="m12 12 14 9 13-1 13-10-2 23-9 18-9 7-13-12-7-15Z" fill="url(#steel)" stroke="#d7e2ed"/><path d="m15 16 10 11-10-2m32-9-9 11 11-3" fill="#342b46"/>'+eyes+'<path d="m25 43 7-5 8 5-8 9Z" fill="#172230"/><path d="m22 41 5 10m17-11-6 11" stroke="#eff8ff"/>';
const horse='<path d="M14 58c-4-18 1-25 12-32l-1-15 8 7 10-9 1 13 12 16-7 10-16-3 3 13Z" fill="url(#wood)" stroke="#d9c6a6"/><path d="m26 24-8-12-6 17-2 23 10-10" fill="#273044" stroke="#d1b77f"/><path d="m28 25 6 17 15-1m-18 4-7 10" fill="none" stroke="url(#gold)" stroke-width="2"/><circle cx="40" cy="29" r="2" fill="url(#jewel)"/>';
const stag='<path d="m16 58 5-21-5-12 11 1 5-5 8 4 10-1-5 14-9 11 4 9Z" fill="url(#wood)" stroke="#e9dfc0"/><path d="M25 26 17 17 16 5m2 14L8 12m10 3 7-8m14 19 8-10 1-11m-3 14 11-7m-10 3-7-9" fill="none" stroke="url(#gold)" stroke-width="3"/>'+eyes+'<path d="m29 39 5-2 4 3-5 5Z" fill="#1e2b37"/>';
const bird='<path d="M31 47C11 48 3 29 6 16l19 15-6-23 14 21 9-24-3 26 19-16c4 23-12 33-25 33l8 13-13-7-9 6Z" fill="url(#gold)" stroke="#fff0c0"/><path d="m32 23 9 9-7 14-9-10Z" fill="url(#jewel)"/><path d="m33 22 5-9 3 12 8 4-10 2" fill="url(#steel)"/><circle cx="38" cy="25" r="1.5" fill="#fff"/>';
const dragon='<path d="m29 26-15-9-9 25 19-5-8 16 16-8 20 11-4-21 12 9-8-27-15 9Z" fill="url(#jewel)" stroke="#e9d3af"/><path d="m26 19-3-13 10 8 9-9-2 15 9 8-5 13-12 7-9-14Z" fill="url(#steel)" stroke="#d3dfed"/><path d="m25 28 7 3 9-4m-13 9 7 1-3 6" fill="none" stroke="#192639" stroke-width="3"/><path d="m12 24 10 9m31-8-9 10" stroke="url(#gold)"/>';
const skinBodies:Record<string,string>={
  traveler:'<path d="m15 58 4-23 8-8h11l11 10 4 21" fill="url(#wood)" stroke="#d1ba91"/><path d="M22 26c-8-21 26-25 22-1l-6 12H28Z" fill="url(#gold)"/><path d="m20 20 2-11 11-6 12 11-2 8-8-9-12 10" fill="#443b42"/>'+eyes,
  forest:'<path d="m10 58 8-29c-4-23 35-29 30 0l8 29-23-11Z" fill="url(#jewel)" stroke="#c9e4b0"/><path d="m22 24 11-12 11 12-8 13h-8Z" fill="#2b3c37"/>'+eyes+'<path d="m13 31 10 14m30-14L43 45M32 42l-9 13 10-5 11 5-9-13" fill="none" stroke="url(#gold)"/>',
  frost:'<path d="m8 55 6-22 12-5h13l13 5 7 22-26-10Z" fill="url(#steel)" stroke="#b7e8ff"/><path d="m21 16 12-12 13 12-2 21-11 7-11-7Z" fill="url(#steel)"/><path d="m33 8-3 17-8 2 8 7 3 10 3-10 8-7-8-2Z" fill="url(#jewel)"/><path d="m14 33-7-5 4 15m40-10 7-5-4 15" fill="url(#jewel)"/>',
  void:'<path d="m8 56 7-23 10-5h15l12 7 5 22-25-8Z" fill="url(#jewel)" stroke="#c7a0f5"/><path d="M19 24 26 7h14l8 18-10 16H28Z" fill="#201b39"/><path d="m22 23 10-11 13 12-10 13h-8Z" fill="#0c1428"/>'+eyes+'<path d="m15 35-9-11 4 20m42-9 7-11-3 20m-27 1 5-5 5 5-5 10Z" fill="url(#gold)"/>',
  solar:'<circle cx="33" cy="22" r="20" fill="none" stroke="url(#gold)" stroke-width="2"/><path d="m7 56 6-25 14-3h12l15 4 5 24-26-8Z" fill="url(#gold)" stroke="#fff0c8"/><path d="m23 12 10-7 11 7-2 23-9 8-9-8Z" fill="url(#steel)"/><path d="m33 9 3 15 8 1-9 10-2 6-3-6-8-10 8-1Z" fill="url(#gold)"/>',
  eternal:'<path d="m6 58 10-28 10-3h14l12 4 8 27-27-9Z" fill="url(#steel)" stroke="#ffbddf"/><path d="m22 22-7-16 14 8 4-12 5 12 15-8-8 18-4 14-8 6-10-7Z" fill="url(#jewel)" stroke="#f7bce5"/>'+eyes+'<path d="m12 34-6-13 18 15m29-2 6-13-18 15m-13 7 5-4 6 4-6 12Z" fill="url(#gold)"/>',
};

/** Catalog-specific silhouettes; differing creatures are never the same flask/hood. */
export function cosmeticIcon(c:Cosmetic,label=c.name[0]):string {
  const color='#'+c.color.toString(16).padStart(6,'0');
  let body:string;
  if(c.type==='skin')body=skinBodies[c.id]??skinBodies.void;
  else if(c.type==='wing')return illustratedWings(c.rarity,label,c.id);
  else if(c.id==='phoenix')body=bird;
  else if(['dracolich','wyvern','eternalhorse'].includes(c.id))body=dragon+(c.id==='dracolich'?'<path d="M26 45h15m-14 4h13m-10-5v11m6-11v11" stroke="#e8fff5"/>':'');
  else if(['stag','spiritstag'].includes(c.id))body=stag;
  else if(c.type==='pet'||['nighthorse','fenrir'].includes(c.id)){
    body=wolf;
    if(c.id==='fox')body='<path d="m7 57 7-18-3-30 16 14h12L55 7l-3 30 7 17-20-4-7 9-8-9Z" fill="url(#wood)" stroke="#ecc5a5"/>'+eyes+'<path d="m18 36 14 5 14-5-14 19Z" fill="#efe4ce"/><path d="m28 43 9-1-5 6Z" fill="#1f2432"/>';
    if(c.id==='hellhound')body+='<path d="M16 22 10 4l15 14m17 3L54 4l-5 23m-26 6 5 8m13-9-4 9" fill="url(#jewel)" stroke="#ffa360"/><path d="M15 47 7 43l5 13m36-10 9-4-5 14" fill="#ff783c"/>';
    const motifs:Record<string,string>={frostwolf:'<path d="m18 12 4-8 4 13m15 1 2-12 5 7" fill="#b9f7ff"/>',spiritwolf:'<path d="M8 46c-7-29 57-31 49 2M12 55c10 7 27 8 41-2" fill="none" stroke="url(#jewel)" stroke-width="2" stroke-dasharray="3 3"/>',sunwolf:'<circle cx="32" cy="31" r="26" fill="none" stroke="url(#gold)" stroke-dasharray="3 4"/>',moonwolf:'<path d="M49 6C30 8 35 21 48 19 31 32 19 9 49 6Z" fill="url(#jewel)"/>',fenrir:'<path d="m10 25-4-9 12 7m34 1 7-9-3 18m-38 8-8 7m37-7 9 7" stroke="url(#gold)" stroke-width="3"/>'};
    body+=motifs[c.id]??'';
  }else if(c.type==='weapon'){
    const forms:Record<string,string>={ironweapon:'<path d="m18 51 22-37 10-8-1 14-24 35Z" fill="url(#steel)"/><path d="m14 43 21 12-3 5-21-13" fill="url(#gold)"/>',forestweapon:'<path d="m17 55 20-33 18-12-9 23-24 25Z" fill="url(#jewel)" stroke="#daffd9"/><path d="M19 46 9 41l2-8 14 9m7-7 12 7 8-5-16-8" fill="url(#gold)"/>',frostweapon:'<path d="m14 55 20-28 1-13 13-10-1 17-7 11-21 26Z" fill="url(#jewel)" stroke="#dbfbff"/><path d="m20 34 17 13m-7-19 17 12" stroke="#9be7ff" stroke-width="4"/>',voidweapon:'<path d="M19 53 30 28C17 2 50 0 56 26 42 12 36 23 39 31L24 57Z" fill="url(#jewel)" stroke="#e5c8ff"/>',sunweapon:'<path d="m17 55 16-25-5-13 8-11 7 14 10-6-4 19-11 2-15 24Z" fill="url(#gold)" stroke="#fff3c9"/>',eternalweapon:'<path d="m13 56 21-30L27 7l13 12L54 3l-4 21 9 5-15 9-25 22Z" fill="url(#jewel)" stroke="#ffdeed"/><path d="m29 40 8-8 7 5-8 9Z" fill="url(#gold)"/>'};
    body=forms[c.id]??forms.voidweapon;
  }else{body=horse;if(c.id==='sunhorse')body+='<path d="m24 20 14-7 11 15-6 11-10-1Z" fill="url(#gold)" stroke="#fff4c0"/>';if(c.id==='nightmare')body+='<path d="m18 28-6-21 12 10 2-14 8 13m-17 34-9 7 7-18" fill="url(#jewel)"/>';if(c.id==='frosthorse')body+='<path d="m23 19 4-15 5 15m10 2 4-13 3 17" fill="#d1f5ff"/>';}
  return itemIcon(c.type,c.rarity,label,color,body);
}

export function illustratedWings(rarity:Rarity='epic',label='Asas',id='wing-3'):string {
  const style=Number(id.split('-')[1])||0;
  const feather=Array.from({length:6},(_,i)=>`<path d="M30 43Q${8-i} ${40-i*4} ${8+i*3} ${8+i*4}Q${12+i*2} ${38+i} 29 48" fill="url(#${style===0||style===3?'steel':'jewel'})" stroke="#e7dfed" stroke-width=".6"/>`).join('');
  const body=`<g>${feather}</g><g transform="translate(64 0) scale(-1 1)">${feather}</g><path d="m32 30 5 12-5 16-5-16Z" fill="url(#gold)"/><circle cx="32" cy="41" r="3" fill="url(#jewel)"/>`;
  return itemIcon('skin',rarity,label,undefined,body).replace('item-illustration','item-illustration wing-illustration');
}

export function merchantCurrencyIcon(kind:'crystals'|'tickets',label:string):string {
  const body=kind==='crystals'?'<path d="m14 26 9-15 13 4 5 27-15 13Z" fill="url(#jewel)" stroke="#c9f6ff"/><path d="m39 17 11-8 8 15-7 25-12-5Z" fill="url(#steel)" stroke="#edfaff"/><path d="m23 12 4 43 10-24Z" fill="#fff" opacity=".25"/>':'<path d="m11 16 39-5 4 14c-8 2-6 11 2 10l2 13-40 6-2-14c8-2 6-11-2-10Z" fill="url(#gold)" stroke="#f9e3a3"/><path d="m40 14 5 37" stroke="#72542d" stroke-dasharray="3 2"/><path d="m28 22 4 7 8 1-5 6 1 8-8-4-7 4 1-8-5-6 8-1Z" fill="url(#jewel)"/>';
  return itemIcon('chest',kind==='crystals'?'rare':'legendary',label,kind==='crystals'?'#7ecef9':undefined,body);
}
