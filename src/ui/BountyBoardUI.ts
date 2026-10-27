import {questText} from '../rpg/LoreSystem';
import type {QuestSystem,QuestDefinition} from '../rpg/QuestSystem';
import type {FieldProgress} from '../rpg/FieldRewards';
import type {InventoryAndLoot} from '../rpg/InventoryAndLoot';
import type {AdventureProgress} from '../progression/AdventureProgress';
import {itemIcon} from './ItemIconRenderer';
import {patchLiveDOM} from './LiveDOM';
import {setScreenPhase} from './MainMenu';
import './field-content.css';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class BountyBoardUI {
 readonly root=document.createElement('section');private tab:'contract'|'campaign'|'treasure'='contract';private region='aurora';private result='';private unsub:()=>void;private abort=new AbortController();
 constructor(private host:HTMLElement,private quests:QuestSystem,private bag:FieldProgress,private inv:InventoryAndLoot,private progress:AdventureProgress,private navigate:(quest:QuestDefinition)=>void,private changed:()=>void){
  this.root.className='bounty-board';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-label','Contratos e Campanha');host.append(this.root);
  this.root.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-bounty]');if(!b||b.disabled)return;const action=b.dataset.bounty!,id=b.dataset.id??'';let ok=true;
   if(action==='close'){this.close();return;}if(action==='tab')this.tab=id as typeof this.tab;
   if(action==='accept'){ok=this.quests.accept(id);if(ok)this.quests.track(id);}
   if(action==='claim'){ok=this.quests.claim(id);this.result=ok?'Recompensa recebida! Um novo contrato está disponível.':'Objetivo pendente ou recompensa já recebida.';}
   if(action==='navigate'){const q=this.quests.get(id);if(q){this.quests.track(id);this.navigate(q);this.close();}return;}
   if(action==='track')ok=this.quests.track(id);
   if(action==='skin'){const reward=this.bag.openSkin(this.progress);ok=!!reward;this.result=reward?'Baú aberto: '+reward:'Sem baús de skin.';}
   if(action==='fragments')ok=this.bag.forgeChest();
   if(action==='locked')ok=this.bag.openLocked(this.inv,this.inv.level);
   if(action==='refine'){const weapon=this.inv.equipment.weapon;ok=!!weapon&&this.bag.refine(this.inv,weapon);this.result=ok?'Equipamento refinado! A pedra cobriu os cristais.':'É preciso uma pedra, ouro e uma arma abaixo de +15.';}
   if(!ok&&!this.result)this.result='Recursos insuficientes ou objetivo ainda bloqueado.';this.changed();this.render();
  },{signal:this.abort.signal});this.unsub=quests.subscribe(()=>{if(!this.root.hidden)this.render();});
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.root.hidden)this.close();},{signal:this.abort.signal});
 }
 get blocking():boolean{return !this.root.hidden;}
 open(region:string):void{this.region=region;this.root.hidden=false;this.result='';setScreenPhase(this.host,'modal');this.render();}
 close():void{this.root.hidden=true;setScreenPhase(this.host,'playing');this.changed();}
 refresh():void{if(this.blocking)this.render();}
 private render():void{
  const pt=this.progress.language==='pt',t=(a:string,b:string)=>pt?a:b,b=this.bag.balances,q=this.quests.contract(this.region),state=this.quests.progressOf(q);
  const button=(action:string,label:string,id='',disabled=false)=>`<button data-bounty="${action}" data-id="${esc(id)}" ${disabled?'disabled':''}>${label}</button>`;
  const reward=(quest:QuestDefinition)=>`<div class="field-rewards"><span>✦ ${quest.reward.xp} XP</span><span>◈ ${quest.reward.gold}</span><span>◆ ${quest.reward.crystals}</span>${quest.reward.skinChests?`<span>${itemIcon('chest','epic')} ×${quest.reward.skinChests}</span>`:''}${quest.reward.refinementStones?`<span>${itemIcon('ruby','rare')} ×${quest.reward.refinementStones}</span>`:''}</div>`;
  let body='';
  if(this.tab==='contract')body=`<div class="contract-banner">${itemIcon('chest','legendary')}<div><small>${t('QUADRO DE CAÇADAS · RANK','BOUNTY BOARD · RANK')} ${q.rank}</small><h2>${t('A Vigília nunca termina','The Watch never ends')}</h2><p>${t('Conclua, resgate e aceite o próximo contrato.','Complete, claim and accept your next contract.')} · ${t('Renome','Renown')} ${b.renown}</p></div></div><article class="contract-scroll rank-${q.rank}"><div class="contract-medal">${q.rank}</div><div><h3>${esc(questText(q,this.progress.language).title)}</h3><p>${esc(questText(q,this.progress.language).description)}</p><progress value="${state.progress}" max="${q.required}" aria-label="Progresso do contrato"></progress><small>${state.progress}/${q.required}</small>${reward(q)}<div class="bounty-actions">${!state.accepted?button('accept',t('ACEITAR CONTRATO','ACCEPT CONTRACT'),q.id):state.ready?button('claim',t('RESGATAR E GERAR PRÓXIMO','CLAIM & GENERATE NEXT'),q.id):button('navigate',t('⌖ NAVEGAR / RASTREAR','⌖ NAVIGATE / TRACK'),q.id)}</div></div></article><p class="field-small">${t('Ranks C → B → A → S → SS. Objetivos e recompensas crescem; contratos concluídos não ocupam espaço no save.','Ranks C → B → A → S → SS. Objectives and rewards grow; finished contracts do not grow your save.')}</p>`;
  if(this.tab==='campaign')body=`<div class="campaign-acts">${[1,2,3].map(act=>{const stages=this.quests.all().filter(q=>q.category==='story'&&q.region===this.region&&q.act===act);return `<section><h2>${t('ATO','ACT')} ${act} · ${esc(stages[0]?questText(stages[0],this.progress.language).title:'')}</h2>${stages.map(q=>{const s=this.quests.progressOf(q);return `<article class="campaign-stage ${s.claimed?'done':''}">${itemIcon(q.goal==='boss'||q.goal==='elite'?'skin':q.goal==='rareCollect'?'ruby':'chest',s.claimed?'legendary':'rare')}<div><strong>${s.claimed?'✓ ':''}${esc(questText(q,this.progress.language).title)}</strong><small>${esc(questText(q,this.progress.language).description)}</small><progress value="${s.progress}" max="${q.required}"></progress><span>${s.progress}/${q.required}</span></div>${s.ready&&!s.claimed?button('claim',t('Resgatar','Claim'),q.id):!s.claimed?button('navigate','⌖',q.id,!s.accepted):''}</article>`;}).join('')}</section>`;}).join('')}</div>`;
  if(this.tab==='treasure')body=`<div class="field-treasure-grid">${[
   {icon:'chest' as const,title:t('Baús de Skin','Skin Chests'),value:b.skinChests,action:'skin',text:t('Abrir baú','Open chest')},
   {icon:'skin' as const,title:t('Fragmentos de Skin','Skin Fragments'),value:b.skinFragments,action:'fragments',text:t('50 fragmentos → 1 baú','50 fragments → 1 chest')},
   {icon:'chest' as const,title:t('Baús Trancados','Locked Chests'),value:b.lockedChests,action:'locked',text:t('Abrir · 100 ouro + 2 cristais','Open · 100 gold + 2 crystals')},
   {icon:'ruby' as const,title:t('Pedras de Refino','Refinement Stones'),value:b.refinementStones,action:'refine',text:t('Refinar arma · pedra + ouro','Refine weapon · stone + gold')},
  ].map(r=>`<article>${itemIcon(r.icon,'epic')}<h3>${r.title}</h3><b>${r.value}</b>${button(r.action,r.text)}</article>`).join('')}</div><p>${t('As pedras substituem o custo de cristais na forja. Skins duplicadas retornam 12 fragmentos. Núcleos coletados:','Stones replace the crystal cost at the forge. Duplicate skins return 12 fragments. Cores collected:')} ${b.abyssalCores}</p>`;
  patchLiveDOM(this.root,`<header><strong>📜 ${t('Contratos de Caça','Hunting Contracts')}</strong><span>◈ ${Math.floor(this.inv.gold)} · ◆ ${this.inv.crystals}</span>${button('close','✕')}</header><nav>${(['contract','campaign','treasure'] as const).map((id,i)=>button('tab',[t('Contratos Infinitos','Infinite Contracts'),t('Campanha · 3 Atos','Campaign · 3 Acts'),t('Tesouros do Campo','Field Treasures')][i],id)).join('')}</nav><main>${body}<p class="field-result" role="status">${esc(this.result)}</p></main>`);
 }
 dispose():void{this.unsub();this.abort.abort();this.root.remove();}
}
