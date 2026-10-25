import type {Item} from '../core/GameTypes';
import type {RefinementInventory} from '../rpg/InventorySystem';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function forgeUpgradeButton(inventory:RefinementInventory,item:Item,pt:boolean):string {
  const cost=inventory.upgradeCost(item.id),max=item.upgrade>=15,affordable=Number.isFinite(cost.gold)&&Number.isFinite(cost.crystals)&&Number.isFinite(inventory.gold)&&Number.isFinite(inventory.crystals)&&inventory.gold>=cost.gold&&inventory.crystals>=cost.crystals;
  const label=max?'MAX +15':`${pt?'REFINAR':'REFINE'} +${item.upgrade+1}`;
  const reason=item.locked?(pt?'Desproteja o item para refinar':'Unlock the item to refine'):!affordable?(pt?'Ouro ou cristais insuficientes':'Not enough gold or crystals'):pt?`Nível ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`:`Level ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`;
  return `<button class="forge-refine-button" data-do="upgrade" data-id="${escape(item.id)}" title="${escape(reason)}" ${max||item.locked||!affordable?'disabled':''}><span class="forge-refine-label">⚒ ${label}</span>${max?'':`<span class="forge-refine-cost">${cost.gold} ◈ <i>+</i> ${cost.crystals} ◇</span>`}</button>`;
}

export interface ForgePreview{
  upgrade:number;
  before:{attack:number;defense:number;maxHp:number};
  after:{attack:number;defense:number;maxHp:number};
  gain:{attack:number;defense:number;maxHp:number};
  cost:{gold:number;crystals:number};
  successRate:100;
}
export function forgePreview(inventory:RefinementInventory,item:Item):ForgePreview{
  const limit=item.upgrade>=15;
  const factor=limit?0:item.level+1;
  const after={
    attack:item.attack+5*factor,
    defense:item.defense+3*factor,
    // Inventory upgrade currently changes ATK, DEF and item level only.
    maxHp:item.maxHp,
  };
  return {upgrade:item.upgrade,
    before:{attack:item.attack,defense:item.defense,maxHp:item.maxHp},
    after,
    gain:{attack:5*factor,defense:3*factor,maxHp:0},
    cost:inventory.upgradeCost(item.id),
    successRate:100
  };
}
const localizedNumber=(n:number,pt:boolean)=>Math.floor(n).toLocaleString(pt?'pt-BR':'en-US');
export function forgeComparisonHtml(inventory:RefinementInventory,item:Item,pt:boolean):string{
 const v=forgePreview(inventory,item);
 const rows=[
   ['⚔','ATK',v.before.attack,v.after.attack,v.gain.attack],
   ['◈','DEF',v.before.defense,v.after.defense,v.gain.defense],
   ['♥','HP',v.before.maxHp,v.after.maxHp,v.gain.maxHp],
 ] as const;
 return `<section class="forge-stat-preview" aria-label="${pt?'Comparativo de atributos':'Attribute comparison'}">
 <header><span>${pt?'ATRIBUTOS DA ARMA':'WEAPON ATTRIBUTES'}</span><strong>+${v.upgrade} → +${Math.min(15,v.upgrade+1)}</strong></header>
 <div class="forge-stat-rows">${rows.map(([icon,label,before,after,gain])=>`<div class="forge-stat-row">
 <b>${icon} ${label}</b><span>${localizedNumber(before,pt)}</span><i aria-hidden="true">➜</i>
 <strong>${localizedNumber(after,pt)}</strong><small>+${localizedNumber(gain,pt)}</small>
 </div>`).join('')}</div>
 <footer><span>◆ ${pt?'Chance real de sucesso':'Actual success rate'} <b>100%</b></span>
 <span>🟡 ${localizedNumber(v.cost.gold,pt)} &nbsp; ◇ ${localizedNumber(v.cost.crystals,pt)}</span></footer>
 <small class="forge-exact-rate">${pt?'Refino garantido pelo sistema atual; nenhuma pedra de proteção é consumida.':'Current refinement always succeeds; no protection stone is consumed.'}</small>
 </section>`;
}
export interface ForgeGemInventory{
  gems:Record<'ruby'|'sapphire'|'emerald'|'diamond',number>;
  greaterGems:Record<'ruby'|'sapphire'|'emerald'|'diamond',number>;
}
export function forgeGemWorkbench(p:ForgeGemInventory,item:Item,pt:boolean,locked=false):string{
 const types=[
  {id:'ruby',name:pt?'Rubi · Ataque':'Ruby · Attack',emoji:'🔴'},
  {id:'sapphire',name:pt?'Safira · Mana':'Sapphire · Mana',emoji:'🔵'},
  {id:'emerald',name:pt?'Esmeralda · Crítico':'Emerald · Critical',emoji:'🟢'},
  {id:'diamond',name:pt?'Diamante · Defesa':'Diamond · Defense',emoji:'💠'},
 ] as const;
 return `<section class="forge-gem-workbench" aria-label="${pt?'Bancada de joias':'Gem workbench'}">
 <h4>💎 ${pt?'ENGASTE E FUSÃO':'SOCKET & FUSION'}</h4><div class="forge-gem-grid">
 ${types.map(({id,name,emoji})=>`<article class="forge-gem-slot gem-${id}">
 <div class="forge-gem-heading"><span aria-hidden="true">${emoji}</span><b>${name}</b></div>
 <small>Lv.1 ×${p.gems[id]} · ★ Lv.2 ×${p.greaterGems[id]}</small>
 <div class="forge-gem-actions">
 <button data-do="socket" data-id="${escape(item.id)}" data-key="${id}" ${locked||p.gems[id]+p.greaterGems[id]<1?'disabled':''}>◇ ${pt?'ENGASTAR':'SOCKET'}</button>
 <button data-do="gem-fuse" data-key="${id}" ${p.gems[id]<3?'disabled':''}>⇧ ${pt?'FUNDIR 3:1':'FUSE 3:1'}</button>
 </div></article>`).join('')}</div></section>`;
}
