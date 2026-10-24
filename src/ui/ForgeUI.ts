import type {Item} from '../core/GameTypes';
import type {RefinementInventory} from '../rpg/InventorySystem';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function forgeUpgradeButton(inventory:RefinementInventory,item:Item,pt:boolean):string {
  const cost=inventory.upgradeCost(item.id),max=item.upgrade>=15,affordable=Number.isFinite(cost.gold)&&Number.isFinite(cost.crystals)&&Number.isFinite(inventory.gold)&&Number.isFinite(inventory.crystals)&&inventory.gold>=cost.gold&&inventory.crystals>=cost.crystals;
  const label=max?'MAX +15':`${pt?'REFINAR':'REFINE'} +${item.upgrade+1}`;
  const reason=item.locked?(pt?'Desproteja o item para refinar':'Unlock the item to refine'):!affordable?(pt?'Ouro ou cristais insuficientes':'Not enough gold or crystals'):pt?`Nível ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`:`Level ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`;
  return `<button class="forge-refine-button" data-do="upgrade" data-id="${escape(item.id)}" title="${escape(reason)}" ${max||item.locked||!affordable?'disabled':''}><span class="forge-refine-label">⚒ ${label}</span>${max?'':`<span class="forge-refine-cost">${cost.gold} ◈ <i>+</i> ${cost.crystals} ◇</span>`}</button>`;
}
