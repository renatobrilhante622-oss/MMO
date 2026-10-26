import {catalogSkin} from '../player/SkinCatalog';
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
  if(c.type==='skin'){const alias=({'regalia-solar':'solar','regalia-reaper':'void','regalia-astral':'forest','regalia-titan':'eternal','regalia-glacial':'frost','regalia-void':'void'} as Record<string,string>)[c.id];body=skinBodies[c.id]??skinBodies[alias]??skinBodies.void;if(c.id==='regalia-reaper')body+='<path d="M14 48V20l6-9 8 9v28m13 0V20l6-9 7 9v28" stroke="#b7a9c5" fill="#1a1027"/><circle cx="21" cy="23" r="4" fill="url(#jewel)"/>';if(c.id==='regalia-astral')body+='<ellipse cx="32" cy="26" rx="26" ry="12" stroke="#b6e6ff" fill="none"/>';}
  else if(c.type==='wing')return illustratedWings(c.rarity,label,({'plume-seraph':'wing-1','plume-dragon':'wing-3','plume-crystal':'wing-2','plume-phoenix':'wing-4','plume-necrotic':'wing-0'} as Record<string,string>)[c.id]??c.id);
  else if(c.id==='phoenix')body=bird;
  else if(['dracolich','wyvern','eternalhorse','steed-magma','steed-astral'].includes(c.id))body=dragon+(c.id==='dracolich'?'<path d="M26 45h15m-14 4h13m-10-5v11m6-11v11" stroke="#e8fff5"/>':'');
  else if(['stag','spiritstag','steed-glacial'].includes(c.id))body=stag;
  else if(c.type==='pet'||['nighthorse','fenrir','steed-fenrir'].includes(c.id)){
    body=wolf;
    if(c.id==='fox')body='<path d="m7 57 7-18-3-30 16 14h12L55 7l-3 30 7 17-20-4-7 9-8-9Z" fill="url(#wood)" stroke="#ecc5a5"/>'+eyes+'<path d="m18 36 14 5 14-5-14 19Z" fill="#efe4ce"/><path d="m28 43 9-1-5 6Z" fill="#1f2432"/>';
    if(c.id==='hellhound')body+='<path d="M16 22 10 4l15 14m17 3L54 4l-5 23m-26 6 5 8m13-9-4 9" fill="url(#jewel)" stroke="#ffa360"/><path d="M15 47 7 43l5 13m36-10 9-4-5 14" fill="#ff783c"/>';
    const motifs:Record<string,string>={frostwolf:'<path d="m18 12 4-8 4 13m15 1 2-12 5 7" fill="#b9f7ff"/>',spiritwolf:'<path d="M8 46c-7-29 57-31 49 2M12 55c10 7 27 8 41-2" fill="none" stroke="url(#jewel)" stroke-width="2" stroke-dasharray="3 3"/>',sunwolf:'<circle cx="32" cy="31" r="26" fill="none" stroke="url(#gold)" stroke-dasharray="3 4"/>',moonwolf:'<path d="M49 6C30 8 35 21 48 19 31 32 19 9 49 6Z" fill="url(#jewel)"/>',fenrir:'<path d="m10 25-4-9 12 7m34 1 7-9-3 18m-38 8-8 7m37-7 9 7" stroke="url(#gold)" stroke-width="3"/>'};
    body+=motifs[c.id]??'';
  }else if(c.type==='weapon'){
    const forms:Record<string,string>={ironweapon:'<path d="m18 51 22-37 10-8-1 14-24 35Z" fill="url(#steel)"/><path d="m14 43 21 12-3 5-21-13" fill="url(#gold)"/>',forestweapon:'<path d="m17 55 20-33 18-12-9 23-24 25Z" fill="url(#jewel)" stroke="#daffd9"/><path d="M19 46 9 41l2-8 14 9m7-7 12 7 8-5-16-8" fill="url(#gold)"/>',frostweapon:'<path d="m14 55 20-28 1-13 13-10-1 17-7 11-21 26Z" fill="url(#jewel)" stroke="#dbfbff"/><path d="m20 34 17 13m-7-19 17 12" stroke="#9be7ff" stroke-width="4"/>',voidweapon:'<path d="M19 53 30 28C17 2 50 0 56 26 42 12 36 23 39 31L24 57Z" fill="url(#jewel)" stroke="#e5c8ff"/>',sunweapon:'<path d="m17 55 16-25-5-13 8-11 7 14 10-6-4 19-11 2-15 24Z" fill="url(#gold)" stroke="#fff3c9"/>',eternalweapon:'<path d="m13 56 21-30L27 7l13 12L54 3l-4 21 9 5-15 9-25 22Z" fill="url(#jewel)" stroke="#ffdeed"/><path d="m29 40 8-8 7 5-8 9Z" fill="url(#gold)"/>'};
    const relic=catalogSkin(c.id);
    if(relic?.classId){const tint=color,formsByClass:Record<string,string>={
      berserker:'<path d="m18 55 23-39m-9-5c-23-6-29 19-10 23l11-10 12 6c18-11 8-28-7-21Z" fill="url(#steel)" stroke="url(#gold)" stroke-width="3"/>',
      paladin:'<path d="m16 55 28-43 10-7-2 15-29 38Z" fill="url(#steel)" stroke="url(#jewel)"/><path d="m16 38 23 14" stroke="url(#gold)" stroke-width="5"/>',
      assassin:'<path d="M8 49 25 16 30 7l-1 20-14 27M32 55l17-33 7-12-1 23-16 26" fill="url(#jewel)" stroke="url(#gold)" stroke-width="2"/>',
      ranger:'<path d="M18 8Q58 28 18 58L30 33Z" fill="none" stroke="url(#gold)" stroke-width="5"/><path d="m18 8 2 49m-7-26 43 0m-8-6 8 6-8 6" fill="none" stroke="url(#jewel)" stroke-width="2"/>',
      necromancer:'<path d="m23 60 13-43m-2-4C5 0 3 29 10 41 9 20 32 21 48 24L56 8 38 11Z" fill="url(#steel)" stroke="url(#jewel)" stroke-width="3"/>',
      elementalist:'<path d="m23 58 13-35" stroke="url(#gold)" stroke-width="6"/><path d="m34 8 13 9-7 15-16-8Z" fill="url(#jewel)" stroke="#ddfaff" stroke-width="2"/>',
      warlock:'<path d="m22 58 14-27m-13-6q-5-23 18-18 19 9-1 22" stroke="url(#gold)" stroke-width="5" fill="none"/><circle cx="35" cy="19" r="8" fill="url(#jewel)"/>',
      lanceman:'<path d="m15 58 27-42M36 21l2-18 16 5-10 16Z" stroke="url(#gold)" stroke-width="4" fill="url(#jewel)"/>',
      monk:'<path d="M11 54 52 10" stroke="url(#gold)" stroke-width="7"/><path d="m11 54 10-10m22-24 9-10" stroke="url(#jewel)" stroke-width="10"/>'};
      body=formsByClass[relic.classId];for(let i=0;i<(relic.tier??0);i++)body+=`<path d="m${10+i*9} 5 3 5-3 5-3-5Z" fill="url(#jewel)"/>`;
    }else body=forms[c.id]??forms.voidweapon;
  }else{body=horse;if(c.id==='sunhorse')body+='<path d="m24 20 14-7 11 15-6 11-10-1Z" fill="url(#gold)" stroke="#fff4c0"/>';if(c.id==='nightmare')body+='<path d="m18 28-6-21 12 10 2-14 8 13m-17 34-9 7 7-18" fill="url(#jewel)"/>';if(c.id==='frosthorse')body+='<path d="m23 19 4-15 5 15m10 2 4-13 3 17" fill="#d1f5ff"/>';}
  return itemIcon(c.type,c.rarity,label,color,body);
}

export function illustratedWings(rarity:Rarity='epic',label='Asas',id='wing-3'):string {
  // Six original vector silhouettes — not one reused wing recolored by rarity.
  const forms:Record<string,string>={
   'wing-0':`<path d="M31 50 17 16 6 8l6 20L4 39l23 5Z M33 50l14-34L58 8l-6 20 8 11-23 5Z" fill="#5c5367" stroke="#d0c5e4" stroke-width="2"/><path d="m30 45-13-9-5-16m17 20-13-8m18 8 13-9 5-12m-16 27 14-11" stroke="#eee7fb" fill="none" stroke-width="4"/><path d="M29 19 20 11 9 6m26 13 9-8 12-5" stroke="#a678e2" fill="none" stroke-width="2"/><circle cx="32" cy="48" r="5" fill="#ab7af6"/>`,
   'wing-1':`<path d="M31 45Q13 35 8 5q19 4 23 22Q16 18 5 14q0 21 26 34M33 45Q51 35 56 5 37 9 33 27q15-9 26-13 0 21-26 34" fill="#fff1c5" stroke="#dbb770" stroke-width="1.6"/><path d="M30 45Q13 33 12 10m18 30-18-18m22 23Q51 33 52 10m-18 30 18-18" stroke="#c89c5a" fill="none"/><circle cx="32" cy="44" r="5" fill="url(#gold)"/>`,
   'wing-2':`<path d="M30 47 4 37 12 24 6 13 20 18 22 5 32 26 42 5 44 18 58 13 52 24 60 37 34 47Z" fill="#8ce6f2" stroke="#e2ffff" stroke-width="1.3"/><path d="m32 27-11-9-10 19 18 8m3-18 11-9 11 19-18 8M11 37l16-3M53 37l-16-3" fill="none" stroke="#238ac5" stroke-width="2"/><path d="M32 21 25 44 32 58l7-14Z" fill="url(#jewel)" stroke="#e6ffff"/>`,
   'wing-3':`<path d="M28 49 8 57l4-17L2 33l17-10L15 6l17 17 17-17-4 17 17 10-10 7 4 17-20-8Z" fill="#4e1823" stroke="#ff9f54" stroke-width="2"/><path d="m28 45-11-13 2-20m17 33 11-13-2-20" fill="none" stroke="#ff7133" stroke-width="4"/><path d="M10 51q4-20 9-12 3-14 8-5l5 16 5-16q5-9 8 5 5-8 9 12Z" fill="#ff992d" opacity=".73"/><path d="M30 20h4l7 22-9 14-9-14Z" fill="#f9c45d"/>`,
   'wing-4':`<circle cx="32" cy="29" r="18" fill="none" stroke="#ffdc80" stroke-width="2" stroke-dasharray="4 3"/><path d="M30 47Q13 28 6 10q19 1 24 18Q11 21 3 31q15 10 27 18M34 47Q51 28 58 10 39 11 34 28q19-7 27 3-15 10-27 18" fill="url(#gold)" stroke="#fff2bb" stroke-width="2"/><path d="M32 15 37 27 50 30 37 35 32 48 27 35 14 30 27 27Z" fill="#fff1a5" stroke="#f4b650"/>`,
   'wing-5':`<path d="M30 51Q8 30 8 9q16 14 20 19L15 4l18 18L49 4 36 28Q40 23 56 9q0 21-22 42Z" fill="#4e317f" stroke="#d6b2ff" stroke-width="2"/><path d="M9 9 27 40 8 30M55 9 37 40 56 30M32 22 23 43l9 15 9-15Z" fill="none" stroke="#c38aff" stroke-width="2"/><circle cx="32" cy="27" r="6" fill="#eabfff"/><circle cx="12" cy="11" r="2" fill="#fff"/><circle cx="54" cy="13" r="2" fill="#fff"/><path d="M32 7v7m0 35v8M9 25l6 2m34 0 6-2" stroke="#fff4ff" stroke-width="1.6"/>`
  };
  const body=forms[id]??forms['wing-3'];
  return itemIcon('skin',rarity,label,undefined,body).replace('item-illustration','item-illustration wing-illustration');
}

export function merchantCurrencyIcon(kind:'crystals'|'tickets',label:string):string {
  const body=kind==='crystals'?'<path d="m14 26 9-15 13 4 5 27-15 13Z" fill="url(#jewel)" stroke="#c9f6ff"/><path d="m39 17 11-8 8 15-7 25-12-5Z" fill="url(#steel)" stroke="#edfaff"/><path d="m23 12 4 43 10-24Z" fill="#fff" opacity=".25"/>':'<path d="m11 16 39-5 4 14c-8 2-6 11 2 10l2 13-40 6-2-14c8-2 6-11-2-10Z" fill="url(#gold)" stroke="#f9e3a3"/><path d="m40 14 5 37" stroke="#72542d" stroke-dasharray="3 2"/><path d="m28 22 4 7 8 1-5 6 1 8-8-4-7 4 1-8-5-6 8-1Z" fill="url(#jewel)"/>';
  return itemIcon('chest',kind==='crystals'?'rare':'legendary',label,kind==='crystals'?'#7ecef9':undefined,body);
}
