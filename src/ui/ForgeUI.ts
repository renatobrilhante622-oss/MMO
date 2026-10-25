import type {Item} from '../core/GameTypes';
import type {RefinementInventory} from '../rpg/InventorySystem';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function forgeUpgradeButton(inventory:RefinementInventory,item:Item,pt:boolean):string {
  const cost=inventory.upgradeCost(item.id),max=item.upgrade>=15,affordable=Number.isFinite(cost.gold)&&Number.isFinite(cost.crystals)&&Number.isFinite(inventory.gold)&&Number.isFinite(inventory.crystals)&&inventory.gold>=cost.gold&&inventory.crystals>=cost.crystals;
  const label=max?'MAX +15':`${pt?'REFINAR':'REFINE'} +${item.upgrade+1}`;
  const reason=item.locked?(pt?'Desproteja o item para refinar':'Unlock the item to refine'):!affordable?(pt?'Ouro ou cristais insuficientes':'Not enough gold or crystals'):pt?`Nível ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`:`Level ${item.level+1} · ATK +${5*(item.level+1)} · DEF +${3*(item.level+1)}`;
  return `<button class="forge-refine-button" data-do="upgrade" data-id="${escape(item.id)}" title="${escape(reason)}" ${max||item.locked||!affordable?'disabled':''}><span class="forge-refine-label">⚒ ${label}</span>${max?'':`<span class="forge-refine-cost">${cost.gold} ◈ <i>+</i> ${cost.crystals} ◇</span>`}</button>`;
}

export interface ForgeGemInventory {
  gems:Record<'ruby'|'sapphire'|'emerald'|'diamond',number>;
  greaterGems:Record<'ruby'|'sapphire'|'emerald'|'diamond',number>;
}
export interface ForgePreview{
  upgrade:number;
  before:{attack:number;defense:number;maxHp:number};
  after:{attack:number;defense:number;maxHp:number};
  difference:{attack:number;defense:number;maxHp:number};
  cost:{gold:number;crystals:number};
  /** The existing transaction is deterministic and cannot randomly fail. */
  successRate:100;
}
export function forgePreview(inventory:RefinementInventory,item:Item):ForgePreview{
  const max=item.upgrade>=15;
  const level=item.level+1;
  const next=max?{attack:item.attack,defense:item.defense,maxHp:item.maxHp}:{
    attack:item.attack+5*level,
    defense:item.defense+3*level,
    maxHp:item.maxHp?item.maxHp+Math.max(2,Math.round(item.maxHp*.1)):0,
  };
  return {
    upgrade:item.upgrade,
    before:{attack:item.attack,defense:item.defense,maxHp:item.maxHp},
    after:next,
    difference:{attack:next.attack-item.attack,defense:next.defense-item.defense,maxHp:next.maxHp-item.maxHp},
    cost:inventory.upgradeCost(item.id),
    successRate:100,
  };
}
export function forgeComparisonHtml(inventory:RefinementInventory,item:Item,pt:boolean):string{
 const preview=forgePreview(inventory,item);
 const max=item.upgrade>=15;
 const rows=[
   ['⚔','ATK',preview.before.attack,preview.after.attack,preview.difference.attack],
   ['◈','DEF',preview.before.defense,preview.after.defense,preview.difference.defense],
   ['♥','HP',preview.before.maxHp,preview.after.maxHp,preview.difference.maxHp],
 ] as const;
 const safe=(num:number)=>Number.isFinite(num)?Math.floor(num).toLocaleString(pt?'pt-BR':'en-US'):'—';
 return `<section class="forge-stat-preview" aria-label="${pt?'Comparativo de atributos':'Attribute comparison'}">
  <header><span>${pt?'PODER DO EQUIPAMENTO':'EQUIPMENT POWER'}</span><strong>+${item.upgrade} → +${Math.min(15,item.upgrade+1)}</strong></header>
  <div class="forge-stat-rows">${rows.map(([icon,name,oldValue,nextValue,diff])=>`<div class="forge-stat-row">
    <b>${icon} ${name}</b>
    <span>${safe(oldValue)}</span><i aria-hidden="true">➜</i>
    <strong>${safe(nextValue)}</strong><small>+${safe(diff)}</small>
  </div>`).join('')}</div>
  <footer><span>◆ ${pt?'Sucesso garantido':'Guaranteed success'}: <b>${preview.successRate}%</b></span>
  <span>🟡 ${safe(preview.cost.gold)} &nbsp; 💎 ${safe(preview.cost.crystals)}</span>
  </footer>
  ${max?'<p class="forge-maxed">★ MAX +15</p>':''}
  </section>`;
}
export function forgeGemWorkbench(p:ForgeGemInventory,item:Item,pt:boolean):string{
 const data=[
   {key:'ruby',pt:'Rubi • Ataque',en:'Ruby • Attack'},
   {key:'sapphire',pt:'Safira • Mana',en:'Sapphire • Mana'},
   {key:'emerald',pt:'Esmeralda • Crítico',en:'Emerald • Critical'},
   {key:'diamond',pt:'Diamante • Defesa',en:'Diamond • Defense'},
 ] as const;
 return `<section class="forge-gem-workbench" aria-label="${pt?'Bancada de Joias':'Gem workbench'}">
 <h4>💎 ${pt?'JOIAS E FUSÃO':'GEMS & FUSION'}</h4>
 <div class="forge-gem-grid">${data.map(g=>`<article class="forge-gem-slot gem-${g.key}">
 <b>${pt?g.pt:g.en}</b>
 <small>Lv.1: ${p.gems[g.key]} &nbsp; ★ Lv.2: ${p.greaterGems[g.key]}</small>
 <div>
 <button data-do="socket" data-id="${escape(item.id)}" data-key="${g.key}" ${!p.gems[g.key]&&!p.greaterGems[g.key]?'disabled':''}>◇ ${pt?'ENGASTAR':'SOCKET'}</button>
 <button data-do="gem-fuse" data-key="${g.key}" ${p.gems[g.key]<3?'disabled':''}>⇧ ${pt?'FUNDIR 3:1':'FUSE 3:1'}</button>
 </div></article>`).join('')}</div></section>`;
}
