import type { InventoryAndLoot } from './InventoryAndLoot';
export function refineChance(upgrade:number):number {return upgrade<3?1:Math.max(.25,1-(upgrade-2)*.065);}
/** A failed refinement consumes its quoted cost, preserves the item and never destroys sockets. */
export function refine(inventory:InventoryAndLoot,id:string,random:()=>number=Math.random):'success'|'failure'|'unavailable' {
  const item=inventory.items.find(i=>i.id===id);if(!item||item.locked||item.upgrade>=15)return 'unavailable';
  const cost=inventory.upgradeCost(id);if(inventory.gold<cost.gold||inventory.crystals<cost.crystals)return 'unavailable';
  const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)return 'unavailable';
  if(roll>=refineChance(item.upgrade)){inventory.gold-=cost.gold;inventory.crystals-=cost.crystals;return 'failure';}
  return inventory.upgrade(id)?'success':'unavailable';
}
