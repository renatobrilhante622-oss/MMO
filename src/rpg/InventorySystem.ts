import type {Item} from '../core/GameTypes';
export interface RefinementInventory {items:Item[];gold:number;crystals:number;upgradeCost(id:string):{gold:number;crystals:number};}
export type UpgradeResult={ok:true;item:Item;gold:number;crystals:number}|{ok:false;reason:'missing'|'locked'|'maximum'|'resources'|'invalid'};
/** Validate the entire transaction before writing any currency or item field. No asynchronous gap. */
export function upgradeItem(inventory:RefinementInventory,itemId:string):UpgradeResult {
  const item=inventory.items.find(i=>i.id===itemId);if(!item)return {ok:false,reason:'missing'};
  if(item.locked)return {ok:false,reason:'locked'};
  if(item.upgrade>=15)return {ok:false,reason:'maximum'};
  const cost=inventory.upgradeCost(itemId);
  const values=[inventory.gold,inventory.crystals,cost.gold,cost.crystals,item.level,item.upgrade,item.attack,item.defense,item.maxHp,item.value];
  if(item.requiredLevel!==undefined&&(!Number.isInteger(item.requiredLevel)||item.requiredLevel<1||item.requiredLevel>100))return {ok:false,reason:'invalid'};
  if(values.some(v=>!Number.isFinite(v)||v<0)||!Number.isInteger(item.level)||item.level<1||!Number.isInteger(item.upgrade)||cost.gold<=0||cost.crystals<=0)return {ok:false,reason:'invalid'};
  if(inventory.gold<cost.gold||inventory.crystals<cost.crystals)return {ok:false,reason:'resources'};
  const level=item.level+1,upgrade=item.upgrade+1,attack=item.attack+5*level,defense=item.defense+3*level;
  const gold=inventory.gold-cost.gold,crystals=inventory.crystals-cost.crystals,maxHp=item.maxHp?item.maxHp+Math.max(2,Math.round(item.maxHp*.1)):0,value=Math.round(item.value*1.15);
  if(![level,attack,defense,gold,crystals,maxHp,value].every(Number.isSafeInteger))return {ok:false,reason:'invalid'};
  const requiredLevel=item.requiredLevel??item.level;
  inventory.gold=gold;inventory.crystals=crystals;
  Object.assign(item,{level,upgrade,attack,defense,requiredLevel,maxHp,value});
  return {ok:true,item,gold:cost.gold,crystals:cost.crystals};
}
