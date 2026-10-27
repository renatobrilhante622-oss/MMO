import type {Item} from '../core/GameTypes';
import {RARITIES,type InventoryAndLoot} from './InventoryAndLoot';
/** Same displayed equipment power as the paperdoll, including socket contributions. */
export function equipmentPower(item:Item|undefined):number {
  if(!item)return 0;
  let attack=item.attack,defense=item.defense;
  item.sockets?.forEach((gem,i)=>{const power=item.gemLevels?.[i]===2?2.5:1;if(gem==='ruby')attack+=Math.round(4*power);if(gem==='diamond')defense+=Math.round(4*power);});
  return item.level*3+item.upgrade*5+RARITIES.indexOf(item.rarity)*18+Math.round(attack+defense+item.maxHp*.1);
}
export function equipmentImprovement(inv:Pick<InventoryAndLoot,'items'|'level'|'equipment'>,id:string):number {
  const item=inv.items.find(i=>i.id===id);
  if(!item||(item.requiredLevel??item.level)>inv.level||Object.values(inv.equipment).includes(id))return 0;
  return Math.max(0,equipmentPower(item)-equipmentPower(inv.items.find(i=>i.id===inv.equipment[item.slot])));
}
