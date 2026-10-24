import {Vector3} from 'three';
import type {AdventureProgress} from '../progression/AdventureProgress';
import {GACHA_ODDS,COSMETICS} from '../progression/AdventureProgress';
import {COMPLETE_ITEM_CATALOG,RARITIES,scaleWorldItem} from './InventoryAndLoot';
import type {GachaPrize} from '../ui/GachaCutscene';
export function canSummon(p:AdventureProgress,count:number):boolean{return [1,10].includes(count)&&Number.isSafeInteger(p.tickets)&&p.tickets>=count;}
/** Preflight the entire batch before charging. Random streams are injectable for repeatable tests. */
export function summon(p:AdventureProgress,count:1|10,banner:string,random:()=>number=Math.random):GachaPrize[]|null {
  if(!canSummon(p,count)||!['equipment','pet','mount','wing','skin','weapon'].includes(banner))return null;
  if(banner==='equipment'&&p.inventory.items.length+count>p.inventory.capacity)return null;
  const rolls=Array.from({length:count*3},random);if(rolls.some(n=>!Number.isFinite(n)||n<0||n>=1))return null;
  const result:GachaPrize[]=[];let cursor=0;
  for(let n=0;n<count;n++){
    if(banner!=='equipment'){
      p.banner=banner as typeof p.banner;const roll=p.pull(()=>rolls[cursor++]);if(!roll)throw new Error('Gacha preflight invariant');
      result.push({name:roll.cosmetic.name[p.language==='pt'?0:1],rarity:roll.cosmetic.rarity,kind:roll.cosmetic.type==='wing'?'skin':roll.cosmetic.type==='weapon'?'sword':roll.cosmetic.type,duplicate:roll.duplicate,cosmeticId:roll.cosmetic.id});
    }else{
      const roll=rolls[cursor++],slotRoll=rolls[cursor++];cursor++;let tier=0,total=0;for(let i=0;i<GACHA_ODDS.length;i++){total+=GACHA_ODDS[i];if(roll<total){tier=i;break;}}
      p.tickets--;p.pulls++;p.pity++;
      if(p.pity>=60)tier=Math.max(4,tier);else if(p.pulls%10===0)tier=Math.max(2,tier);if(tier>=4)p.pity=0;
      const pool=COMPLETE_ITEM_CATALOG.filter(i=>i.rarity===RARITIES[tier]&&i.level===1),item={...scaleWorldItem(pool[Math.floor(slotRoll*pool.length)],p.inventory.level),id:'summon-'+p.pulls+'-'+Date.now()};
      p.inventory.addLoot({id:item.id,position:new Vector3(),gold:0,crystals:0,xp:0,item});result.push({name:item.name,rarity:item.rarity,kind:item.slot,duplicate:false,itemId:item.id,itemSlot:item.slot});
    }
  }
  return result;
}
export function unlockAllCosmetics(p:AdventureProgress):void{p.owned=COSMETICS.map(c=>c.id);}
