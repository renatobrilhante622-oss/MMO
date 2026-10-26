import type {Engine} from '../core/Engine';
import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import {ARENA_SHOP,ARENA_TITLE_DEFINITIONS} from '../combat/ArenaSystem';
import {RUNE_NODES} from '../rpg/TalentTreeSystem';
import {GATHER_RECIPES} from '../world/GatheringSystem';
import {DAILY_REWARDS,ONLINE_MILESTONES} from '../rpg/DailyRewardSystem';
import {ArenaUI} from './ArenaUI';
import {menuIcon} from './MenuIcons';
type Tab='arena'|'runes'|'professions'|'rewards'|'market'|'titles';
const esc=(x:unknown)=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
/** Independent local Phase 2 dashboard. Existing server-backed arena and market remain unchanged. */
export class Phase2UI{
 readonly root=document.createElement('section');
 private readonly arenaView:ArenaUI;
 private tab:Tab='arena';
 private visible=false;private timer=0;private lastResult='';
 private readonly abort=new AbortController();
 private selected='';
 private arenaFullscreen=false;
 private priorFocus:HTMLElement|null=null;
 constructor(private readonly container:HTMLElement,private readonly game:Engine){
  this.root.className='pr15-overlay';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
  this.container.append(this.root);
  this.arenaView=new ArenaUI(game.phase2Arena);
  this.root.addEventListener('click',e=>{
   const button=(e.target as Element).closest<HTMLButtonElement>('[data-phase2]');
   if(!button)return;
   const action=button.dataset.phase2!;
   if(action==='close'){this.close();return;}
   if(action==='tab'){this.tab=button.dataset.tab as Tab;this.arenaFullscreen=false;this.lastResult='';this.render();return;}
   if(action==='arena-back'){this.arenaFullscreen=false;this.render();this.root.querySelector<HTMLElement>('[data-phase2=enter-arena],[data-phase2=challenge]')?.focus();return;}
   if(action==='enter-arena'){this.arenaFullscreen=true;this.render();this.root.querySelector<HTMLElement>('[data-phase2=arena-back]')?.focus();return;}
   const a=this.game.phase2Arena,p=this.game.phase2Rewards,r=this.game.phase2Runes,g=this.game.phase2Gathering,m=this.game.phase2Market;
   let success=false;
   if(action==='challenge'){success=a.start(button.dataset.id??'',this.game.currentClass,this.game.hero.stats.attack*12+this.game.hero.stats.defense*6);if(success)this.arenaFullscreen=true;}
   if(action==='duel'){const cmd=button.dataset.cmd as 'strike'|'dash'|'dodge'|'guard'|'potion'|'skill';success=a.action(cmd,Number(button.dataset.index??0));}
   if(action==='equip-title')success=a.equipTitle(button.dataset.id??'');
   if(action==='buy-honor'){
     const id=button.dataset.id??'';
     success=a.buy(id);
     if(success&&['gladiator-skin','gladiator-blade'].includes(id)){
       if(!this.game.progress.owned.includes(id))this.game.progress.owned.push(id);
       this.game.progress.equipCosmetic(id);
     }
   }
   if(action==='equip-gladiator')success=this.game.progress.equipCosmetic(button.dataset.id??'');
   if(action==='refine'){
     const item=this.game.inventory.equipment.weapon;
     if(g.crafts.refine>0&&item&&this.game.inventory.upgrade(item)){g.crafts.refine--;success=true;}
   }
   if(action==='rune')success=r.unlock(button.dataset.id??'',this.game.inventory.level);
   if(action==='daily'){const gift=p.claim();if(gift){this.award(gift);success=true;}}
   if(action==='time'){const gift=p.claimMilestone(Number(button.dataset.seconds));if(gift){this.award(gift);success=true;}}
   if(action==='spin'){const gift=p.spin();if(gift){this.award(gift);success=true;}}
   if(action==='craft')success=g.craft(button.dataset.id??'');
   if(action==='list'){const item=button.dataset.id??'',price=Number(this.root.querySelector<HTMLInputElement>('[name=price]')?.value??0),currency=this.root.querySelector<HTMLSelectElement>('[name=currency]')?.value;success=m.list(item,price,currency==='crystals'?'crystals':'gold');}
   if(action==='cancel')success=m.cancel(button.dataset.id??'');
   if(action==='buy')success=m.buy(button.dataset.id??'');
   if(success){this.game.phase2Changed();this.lastResult='✓ Ação concluída';}
   else this.lastResult='Ação indisponível: requisitos, moedas ou cooldown.';
   this.render();
   if(action==='challenge'&&success)this.root.querySelector<HTMLElement>('[data-phase2=arena-back]')?.focus();
  },{signal:this.abort.signal});
  document.addEventListener('keydown',e=>{
   if(!this.visible)return;
   if(e.key==='Escape'){e.preventDefault();this.close();return;}
   if(e.key==='Tab'){const controls=[...this.root.querySelectorAll<HTMLElement>('button:not([disabled]),input,select')].filter(control=>control.getClientRects().length>0),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
  }, {signal:this.abort.signal});
 }
 get blocking():boolean{return this.visible;}
 get isArenaOpen():boolean{return this.visible&&this.tab==='arena';}
 open(tab:Tab='arena'):void{
  if(this.game.hub.blocking)this.game.hub.close();
  if(!this.visible)this.priorFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  this.tab=tab;this.arenaFullscreen=tab==='arena'&&!!this.game.phase2Arena.duel&&!this.game.phase2Arena.duel.ended;this.visible=true;this.root.hidden=false;this.render();
  clearInterval(this.timer);this.timer=window.setInterval(()=>{if(this.visible&&this.tab==='arena')this.paintArena();},300);
 }
 close():void{this.visible=false;this.root.hidden=true;clearInterval(this.timer);this.timer=0;this.arenaView.hide();this.game.save();this.priorFocus?.focus();}
 private award(r:{gold:number;crystals:number;honor:number;xp:number}):void{
  this.game.inventory.gold+=r.gold;this.game.inventory.crystals+=r.crystals;this.game.phase2Arena.honor+=r.honor;this.game.inventory.addXp(r.xp);
 }
 private button(action:string,label:string,attrs='',disabled=false):string{const icons:Record<string,string>={challenge:'arena','enter-arena':'arena',daily:'rewards',time:'rewards',spin:'rewards',rune:'runes',craft:'forge',refine:'forge',list:'market',buy:'market',cancel:'back','buy-honor':'crown','equip-title':'crown','equip-gladiator':'collection'};const icon=icons[action]?menuIcon(icons[action]):'';return `<button type="button" data-phase2="${action}" ${attrs} ${disabled?'disabled':''}>${icon}<span>${esc(label.replace(/^[^\p{L}\p{N}]+/u,''))}</span></button>`;}
 private arena():string{
  const a=this.game.phase2Arena,d=a.duel;
  const cards=a.challengers().map(c=>`<article class="pr15-card"><h3>${esc(c.name)}</h3><span>${esc(CLASS_DEFINITIONS[c.classId].name)}</span><p>CP ${c.cp} · ${esc(c.elo)} · Elo ${c.rating}</p>${this.button('challenge','DUELAR',`data-id="${c.id}"`,!!d&&!d.ended)}</article>`).join('');
  return `<div class="pr15-heading"><h2>${menuIcon('arena')}<span>Arena dos Campeões</span></h2><span>Duelo local contra IA · ${esc(a.elo)} · Elo ${a.rating} · ${a.honor} Honra</span></div>${d?this.button('enter-arena',d.ended?'Rever combate':'Retomar duelo','class="pr16-resume-arena"'):''}<div class="pr15-grid">${cards}</div>`;
 }
 private immersiveArena():string{
  const d=this.game.phase2Arena.duel;if(!d)return this.arena();
  const button=(cmd:string,label:string,icon:string,index?:number)=>`<button type="button" data-phase2="duel" data-cmd="${cmd}" ${index===undefined?'':`data-index="${index}"`} ${d.ended?'disabled':''} title="${esc(label)}">${menuIcon(icon)}<span>${esc(label)}</span>${index===undefined?'':`<small data-arena-cd="${index}"></small>`}</button>`;
  return `<section class="pr15-duel pr16-arena-fullscreen" aria-label="Duelo cinematográfico no Coliseu"><div class="pr16-arena-background" data-pr15-stage></div>
   <header class="pr16-arena-topbar"><button type="button" data-phase2="arena-back">${menuIcon('back')}<span>Salão</span></button><div><strong>COLISEU DE ASTER</strong><small>Duelo local contra IA · ${esc(d.challenger.elo)}</small></div><button type="button" data-phase2="close">${menuIcon('close')}<span>Sair</span></button></header>
   <div class="pr15-fighter-bars pr16-arena-vitals"><div><strong>${esc(CLASS_DEFINITIONS[d.heroClass].name)}</strong><progress max="${d.hero.maxHp}" value="${d.hero.hp}" aria-label="Vida do herói"></progress><small data-arena-hp="hero">${Math.ceil(d.hero.hp)} / ${Math.ceil(d.hero.maxHp)} HP</small></div><div><strong>${esc(d.challenger.name)}</strong><progress max="${d.ai.maxHp}" value="${d.ai.hp}" aria-label="Vida do desafiante"></progress><small data-arena-hp="ai">${Math.ceil(d.ai.hp)} / ${Math.ceil(d.ai.maxHp)} HP</small></div></div>
   ${d.ended?`<div class="pr16-arena-result" role="status"><span>${menuIcon(d.winner==='hero'?'crown':'guard')}</span><h3>${d.winner==='hero'?'VITÓRIA':'DERROTA'}</h3><p>${d.winner==='hero'?'O Coliseu reconhece sua conquista.':'Prepare seu próximo desafio.'}</p><button data-phase2="arena-back">${menuIcon('back')}<span>Voltar ao salão</span></button></div>`:''}
   <div class="pr15-skillrow pr16-duel-controls"><div class="pr16-duel-skills">${CLASS_DEFINITIONS[d.heroClass].skills.map((skill,i)=>button('skill',skill.name,'runes',i)).join('')}</div><div class="pr16-duel-actions">${button('strike','Atacar','attack')}${button('dash','Dash','dash')}${button('dodge','Esquiva','dodge')}${button('guard','Defesa','guard')}${button('potion','Poção','potion')}</div></div>
   <ol class="pr15-combat-log pr16-duel-log" aria-live="polite">${d.log.slice(-3).map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
   <p class="pr16-arena-feedback" role="status">${esc(this.lastResult)}</p></section>`;
 }

 private runes():string{
  const r=this.game.phase2Runes;
  return `<h2>${menuIcon('runes')}<span>Constelação de Runas</span></h2><p>Pontos disponíveis: <b>${r.points(this.game.inventory.level)}</b> · Bosses concedem +2 pontos. Os efeitos são aplicados no combate real.</p><div class="pr15-constellation">${RUNE_NODES.map(n=>`<div class="pr15-star ${r.unlocked(n.id)?'active':''}" style="--x:${n.x}%;--y:${n.y}%"><h3>${esc(n.name)}</h3><small>${esc(n.description)}</small><p>${n.cost} pontos</p>${this.button('rune',r.unlocked(n.id)?'✦ ACESA':'DESBLOQUEAR',`data-id="${n.id}"`,r.unlocked(n.id)||r.points(this.game.inventory.level)<n.cost||!n.needs.every(x=>r.unlocked(x)))}</div>`).join('')}</div>`;
 }
 private professions():string{
  const g=this.game.phase2Gathering;
  return `<h2>${menuIcon('gather')}<span>Profissões de Mundo Aberto</span></h2><p>Minérios ${g.stock.ore} · Ervas ${g.stock.herb} · Baús ${g.stock.chest} — aproxime-se de um objeto brilhante e complete a canalização de 2 segundos.</p><p>🗝️ Para abrir baús antigos é obrigatório possuir uma Chave Ancestral; uma chave é consumida ao concluir.</p>
    ${this.button('refine','⚒️ Aplicar pedra ao armamento equipado (possui '+(g.crafts.refine??0)+')','',!(g.crafts.refine>0))}
    <div class="pr15-grid">${GATHER_RECIPES.map(r=>`<article class="pr15-card"><h3>${esc(r.name)}</h3><small>⛏ ${r.cost.ore} · 🌿 ${r.cost.herb} · 🗝 ${r.cost.chest}</small><p>${r.seconds?Math.round(g.buffs[r.id]??0)+'s de buff':'Possui '+(g.crafts[r.id]??0)}</p>${this.button('craft','Fabricar',`data-id="${r.id}"`)}</article>`).join('')}</div>`;
 }
 private rewards():string{
  const r=this.game.phase2Rewards;
  return `<h2>${menuIcon('rewards')}<span>Recompensas de Login e Sessão</span></h2><div class="pr15-grid">${DAILY_REWARDS.map(g=>`<article class="pr15-card ${r.streak===g.day?'active':''}"><h3>Dia ${g.day}</h3><p>🪙 ${g.gold} · 💎 ${g.crystals} · 🏅 ${g.honor}</p></article>`).join('')}</div>${this.button('daily','🎁 RESGATAR LOGIN', '',!r.canClaim())}<h3>Tempo online ativo · ${Math.floor(r.sessionSeconds/60)} min</h3><div class="pr15-grid">${ONLINE_MILESTONES.map(n=>`<article class="pr15-card">${Math.round(n/60)} min ${this.button('time','🎁 RESGATAR',`data-seconds="${n}"`,!r.availableMilestones().includes(n))}</article>`).join('')}</div><h3>${menuIcon('rewards')} Roleta do Dia</h3><p>Premiações locais aleatórias: Ouro, Cristais e Honra. Uma tentativa por dia.</p>${this.button('spin','GIRAR ROLETA','',!r.canSpin())}`;
 }
 private market():string{
  const m=this.game.phase2Market;
  const eligible=m.eligibleItems();
  return `<h2>${menuIcon('market')}<span>Casa de Leilões Simulada</span></h2><p>Mercado de NPCs offline. Itens anunciados saem da mochila e retornam se o anúncio for cancelado. Taxa de venda 5%. Nunca conecta ao servidor de comércio real.</p><div class="pr15-market-bar"><label>Preço <input name="price" inputmode="numeric" type="number" min="10" max="10000000" value="400"></label><label>Moeda<select name="currency"><option value="gold">Ouro</option><option value="crystals">Cristais</option></select></label></div><h3>Itens épicos/lendários repetidos</h3><div class="pr15-grid">${eligible.map(i=>`<article class="pr15-card"><h4>${esc(i.name)}</h4><small>${esc(i.rarity)} · +${i.upgrade}</small>${this.button('list','Colocar à venda',`data-id="${esc(i.id)}"`)}</article>`).join('')||'<p>Não há duplicatas raras não equipadas.</p>'}</div><h3>Ofertas</h3><div class="pr15-grid">${m.listings.map(l=>`<article class="pr15-card"><h4>${esc(l.item.name)}</h4><small>${esc(l.seller)} · ${l.price} ${l.currency}</small>${this.button(l.seller==='Você'?'cancel':'buy',l.seller==='Você'?'Cancelar / recuperar':'Comprar',`data-id="${esc(l.id)}"`)}</article>`).join('')}</div><small>${m.history.slice(0,3).map(esc).join(' · ')}</small>`;
 }
 private titles():string{
  const a=this.game.phase2Arena;
  return `<h2>${menuIcon('crown')}<span>Títulos e Honra</span></h2><p>Honra: ${a.honor} · ${a.wins} vitórias · ${a.losses} derrotas</p><div class="pr15-grid">${ARENA_TITLE_DEFINITIONS.map(t=>`<article class="pr15-card"><h3>${esc(t.name.replace(/^[^\p{L}\p{N}]+/u,''))}</h3><p>+ATK ${Math.round(t.attack*100)}% · +HP ${Math.round(t.hp*100)}% · Vel. ${Math.round(t.speed*100)}% · Crit ${Math.round(t.crit*100)}%</p><small>Necessita ${t.wins} vitórias</small>${this.button('equip-title',a.equippedTitle===t.id?'Equipado':'Equipar',`data-id="${t.id}"`,!a.titles.includes(t.id))}</article>`).join('')}</div><h3>Loja do Gladiador</h3><div class="pr15-grid">${ARENA_SHOP.map(i=>`<article class="pr15-card"><h3>${esc(i.name)}</h3><p>🏅 ${i.price}</p>${this.button('buy-honor',a.shop.includes(i.id)?'Comprado':'Comprar',`data-id="${i.id}"`,a.shop.includes(i.id)||a.honor<i.price)}${a.shop.includes(i.id)&&i.type!=='title'?this.button('equip-gladiator','Equipar recompensa',`data-id="${i.id}"`):''}</article>`).join('')}</div>`;
 }
 private paintArena():void{
  if(!this.visible)return;
  const d=this.game.phase2Arena.duel;if(!d)return;
  const bars=[...this.root.querySelectorAll<HTMLProgressElement>('.pr15-fighter-bars progress')];
  if(bars.length===2){bars[0].value=d.hero.hp;bars[1].value=d.ai.hp;}
  const heroHp=this.root.querySelector('[data-arena-hp=hero]'),aiHp=this.root.querySelector('[data-arena-hp=ai]');
  if(heroHp)heroHp.textContent=Math.ceil(d.hero.hp)+' / '+Math.ceil(d.hero.maxHp)+' HP';if(aiHp)aiHp.textContent=Math.ceil(d.ai.hp)+' / '+Math.ceil(d.ai.maxHp)+' HP';
  this.root.querySelectorAll<HTMLButtonElement>('[data-cmd=skill]').forEach(button=>{const index=Number(button.dataset.index),remaining=d.hero.cooldowns[index]??0;button.disabled=d.ended||remaining>0;const label=button.querySelector('small');if(label)label.textContent=remaining>0?Math.ceil(remaining)+'s':'';});
  const log=this.root.querySelector<HTMLElement>('.pr15-combat-log');
  if(log)log.replaceChildren(...d.log.slice(-3).map(entry=>{const li=document.createElement('li');li.textContent=entry;return li;}));
  if(this.arenaFullscreen&&d.ended&&!this.root.querySelector('.pr15-duel h3')){this.game.phase2Changed();this.render();}
 }
 private render():void{
  if(!this.visible)return;
  const immersive=this.tab==='arena'&&this.arenaFullscreen&&!!this.game.phase2Arena.duel;this.root.classList.toggle('is-arena-immersive',immersive);
  if(immersive){this.root.innerHTML=this.immersiveArena();const stage=this.root.querySelector<HTMLElement>('[data-pr15-stage]');if(stage)this.arenaView.mount(stage,this.game.currentClass);this.paintArena();return;}
  const body=({arena:()=>this.arena(),runes:()=>this.runes(),professions:()=>this.professions(),rewards:()=>this.rewards(),market:()=>this.market(),titles:()=>this.titles()})[this.tab]();
  this.root.innerHTML=`<div class="pr15-shell"><header><strong>ETERNA · FASE 2</strong><button type="button" data-phase2="close">${menuIcon('close')}<span>Fechar</span></button></header><nav class="pr15-tabs">${(['arena','runes','professions','rewards','market','titles'] as Tab[]).map((id,i)=>`<button type="button" data-phase2="tab" data-tab="${id}" class="${this.tab===id?'selected':''}">${menuIcon(['arena','runes','gather','rewards','market','crown'][i])}<span>${['Arena','Runas','Coleta','Login','Leilão','Títulos'][i]}</span></button>`).join('')}</nav><main class="pr15-content">${body}<p class="pr15-status" role="status">${esc(this.lastResult)}</p></main></div>`;
  if(this.tab==='arena'){const stage=this.root.querySelector<HTMLElement>('[data-pr15-stage]');if(stage)this.arenaView.mount(stage,this.game.currentClass);else this.arenaView.hide();}
  else this.arenaView.hide();
 }
 dispose():void{this.close();this.arenaView.dispose();this.abort.abort();this.root.remove();}
}
