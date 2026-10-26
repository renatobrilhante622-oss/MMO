import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import {ArenaScene,type ArenaVisualFighter} from '../combat/ArenaScene';
import type {ClassId} from '../core/GameTypes';
import type {ArenaSystem} from '../combat/ArenaSystem';

/** Visual adapter only: all damage, cooldowns, AI and rewards stay in ArenaSystem. */
export class ArenaUI{
 readonly root=document.createElement('section');
 private presentation?:ArenaScene;
 private frame=0;
 private destroyed=false;
 constructor(private readonly arena:ArenaSystem){
  this.root.className='pr15-arena-3d pr16-arena-stage';
  this.root.setAttribute('aria-label','Coliseu 3D · duelo local contra IA');
 }
 mount(host:HTMLElement,_heroClass:ClassId):void{
  if(this.destroyed)return;
  if(this.root.parentElement!==host)host.append(this.root);
  if(!this.arena.duel){this.hide();return;}
  this.presentation??=new ArenaScene('Coliseu 3D · duelo local contra IA');
  this.presentation.mount(this.root);this.sync();
  if(!this.frame)this.frame=requestAnimationFrame(this.animate);
 }
 private sync():void{
  const duel=this.arena.duel;if(!duel)return;
  const fighters:ArenaVisualFighter[]=[
   {id:'local-hero',classId:duel.heroClass,hp:duel.hero.hp,maxHp:duel.hero.maxHp,energy:duel.hero.mana,x:duel.hero.position,z:0,yaw:Math.PI/2,skill:duel.hero.lastSkill,combo:duel.hero.combo},
   {id:duel.challenger.id,classId:duel.challenger.classId,hp:duel.ai.hp,maxHp:duel.ai.maxHp,energy:duel.ai.mana,x:duel.ai.position,z:0,yaw:-Math.PI/2,skill:duel.ai.lastSkill,combo:duel.ai.combo},
  ];this.presentation?.sync(fighters);
 }
 private readonly animate=():void=>{if(this.destroyed)return;this.frame=requestAnimationFrame(this.animate);this.sync();};
 hide():void{cancelAnimationFrame(this.frame);this.frame=0;this.presentation?.hide();}
 dispose():void{if(this.destroyed)return;this.destroyed=true;this.hide();this.presentation?.dispose();this.presentation=undefined;this.root.remove();}
}

// PR #19: the lobby owns no WebGL renderer. Combat uses Engine's scene and HUD.
import type {Engine} from '../core/Engine';
import {PvPMatchmaking} from '../combat/PvPMatchmaking';
import {neutralPvPInput,type PvPInput,type PvPView,type PvPMatch} from '../combat/PvPTypes';
import type {HeroInput} from '../core/GameTypes';
import {classIcon} from './IconAtlas';
import {eloForRating} from '../combat/ArenaSystem';
import './arena-pvp.css';
const safeArena=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clockArena=(n:number)=>`${Math.floor(Math.max(0,n)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,n)%60).toString().padStart(2,'0')}`;
/** Keep focused/pressed controls alive while 10Hz snapshots refresh health and timers. */
function syncArenaOverlay(host:HTMLElement,html:string):void {
 const template=document.createElement('template');template.innerHTML=html;
 const patch=(current:Node,next:Node):void=>{
  if(current.nodeType===Node.TEXT_NODE){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current instanceof Element&&next instanceof Element){
   for(const attribute of [...current.attributes])if(!next.hasAttribute(attribute.name))current.removeAttribute(attribute.name);
   for(const attribute of [...next.attributes])if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
  }
  const desired=[...next.childNodes];for(let i=0;i<desired.length;i++){
   const child=current.childNodes[i],target=desired[i];
   if(!child)current.appendChild(target.cloneNode(true));
   else if(child.nodeName!==target.nodeName)current.replaceChild(target.cloneNode(true),child);
   else patch(child,target);
  }
  while(current.childNodes.length>desired.length)current.removeChild(current.lastChild!);
 };
 patch(host,template.content);
}
export class RealtimeArenaUI {
 readonly root=document.createElement('section');readonly overlay=document.createElement('section');
 view:PvPView={queue:null,match:null,serverTime:Date.now()};selfId='';private local:PvPMatchmaking|null=null;
 private visible=false;private polling=false;private transitioning=false;private inMap=false;private disposed=false;
 private mode:1|2|3=1;private sequence=0;private lastSeen=Date.now();private error='';private signature='';
 private pending=neutralPvPInput();private interval:number;private ledger={rating:1000,honor:0};private abort=new AbortController();
 constructor(private host:HTMLElement,private game:Engine){
  this.root.className='pvp-lobby';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-label','Arena PvP');this.overlay.className='pvp-overlay';this.overlay.hidden=true;host.append(this.root,this.overlay);
  try{const stored=JSON.parse(localStorage.getItem('eterna-pvp-practice')??'null');if(Number.isFinite(stored?.rating)&&Number.isFinite(stored?.honor))this.ledger=stored;}catch{/* Fresh local training ledger. */}
  const click=(e:Event)=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-pvp]');if(!b||b.disabled)return;void this.action(b.dataset.pvp!,b);};
  this.root.addEventListener('click',click,{signal:this.abort.signal});this.overlay.addEventListener('click',click,{signal:this.abort.signal});
  window.addEventListener('keydown',e=>{if(!this.inMap)return;if(e.code==='KeyQ')this.pending.potion='hp';if(e.code==='KeyE')this.pending.potion='mana';},{signal:this.abort.signal});
  this.interval=window.setInterval(()=>void this.poll(),100);
 }
 get blocking():boolean{return this.visible;}
 get activeMap():boolean{return this.inMap;}
 get match():PvPMatch|null{return this.view.match;}
 open():void{if(this.inMap||this.view.queue)return;this.game.hub.close();this.game.phase2UI.close();this.visible=true;this.root.hidden=false;this.signature='';this.render();}
 private async action(action:string,b:HTMLButtonElement):Promise<void>{
  try{
   this.error='';
   if(action==='mode'){this.mode=Number(b.dataset.size) as 1|2|3;}
   if(action==='close'){this.visible=false;this.root.hidden=true;return;}
   if(action==='connect'){
    const endpoint=this.root.querySelector<HTMLInputElement>('[name=pvp-server]')!.value,name=this.root.querySelector<HTMLInputElement>('[name=pvp-name]')!.value;
    this.game.hub.online.configure(endpoint);await this.game.hub.online.refresh();if(!this.game.hub.online.view)await this.game.hub.online.create(name,this.game.currentClass);
    if(!this.game.hub.online.view)throw Error(this.game.hub.online.error||'Servidor indisponível.');this.local=null;this.selfId=this.game.hub.online.view.self.id;
   }
   if(action==='queue'||action==='practice'){
    if(!this.game.captureArenaReturn())throw Error('Saia da masmorra ou aguarde a travessia antes de entrar na fila.');
    if(action==='practice'){
     this.selfId='local-hero';this.local=new PvPMatchmaking(Date.now,(_id,r)=>{this.ledger.rating=Math.max(100,this.ledger.rating+r.rating);this.ledger.honor+=r.honor;try{localStorage.setItem('eterna-pvp-practice',JSON.stringify(this.ledger));}catch{/* Session remains playable. */}});
     this.local.enqueue({id:this.selfId,name:'Aventureiro',classId:this.game.currentClass,cp:Math.max(1,Math.round(this.game.hero.stats.attack*12+this.game.hero.stats.defense*6)),level:this.game.inventory.level,rating:this.ledger.rating,bot:false},this.mode);
     this.view=this.local.view(this.selfId);
    }else{this.local=null;this.selfId=this.game.hub.online.view?.self.id??'';const existing=await this.game.hub.online.arena('state');if(existing.match&&!['ended','cancelled'].includes(existing.match.phase))this.view=existing;else{if(existing.match)await this.game.hub.online.arena('leave',{});this.view=await this.game.hub.online.arena('queue',{size:this.mode});}}
    this.visible=false;this.root.hidden=true;this.lastSeen=Date.now();
   }
   if(action==='cancel'){await this.command('cancel');await this.command('leave');this.view={queue:null,match:null,serverTime:Date.now()};this.game.clearArenaReturn();this.overlay.hidden=true;}
   if(action==='accept')await this.command('accept');
   if(action==='return'){await this.returnWorld();return;}
   if(action==='hp'||action==='mana')this.pending.potion=action;
   if(action==='forfeit'){await this.command('leave');await this.returnWorld();return;}
  }catch(e){this.error=e instanceof Error?e.message:'Falha na arena.';}
  this.signature='';this.render();
 }
 private async command(path:string):Promise<void>{
  if(this.local){if(path==='cancel')this.local.cancel(this.selfId);if(path==='leave')this.local.leave(this.selfId);if(path==='accept')this.local.accept(this.selfId);if(path==='ready')this.local.ready(this.selfId);this.view=this.local.view(this.selfId);}
  else this.view=await this.game.hub.online.arena(path,{});
 }
 private async poll():Promise<void>{
  if(this.disposed||this.polling||this.transitioning)return;
  if(!this.view.queue&&!this.view.match&&!this.inMap)return;
  this.polling=true;
  try{
   if(this.local)this.view=this.local.view(this.selfId);
   else if(this.selfId){
    if(this.inMap&&this.view.match?.phase==='active'){
     const input={...this.pending,seq:++this.sequence};this.pending.skill=null;this.pending.dash=false;this.pending.potion=null;
     this.view=await this.game.hub.online.arena('input',input as unknown as Record<string,unknown>);
    }else this.view=await this.game.hub.online.arena('state');
   }
   this.lastSeen=Date.now();this.error='';const m=this.view.match;
   if(m?.phase==='found'){this.visible=true;this.root.hidden=false;}
   if(m&&['loading','countdown','active'].includes(m.phase)&&!this.inMap){
    this.transitioning=true;this.visible=false;this.root.hidden=true;
    try{await this.game.enterArenaMap(m,this.selfId);this.inMap=true;await this.command('ready');}
    catch(e){await this.command('leave');await this.game.leaveArenaMap();throw e;}
    finally{this.transitioning=false;}
   }
   if(m?.phase==='cancelled'){if(this.inMap)await this.returnWorld();else{await this.command('leave');this.game.clearArenaReturn();this.view={queue:null,match:null,serverTime:Date.now()};this.visible=true;this.root.hidden=false;this.error='Partida cancelada: aceite dentro de 3s e aguarde todos carregarem.';}}
  }catch(e){this.error=e instanceof Error?e.message:'Conexão interrompida.';if(this.inMap&&Date.now()-this.lastSeen>12000){await this.returnWorld(false);this.error='Conexão perdida. Retorno ao mundo; a partida online registra abandono.';}}
  finally{this.polling=false;this.render();}
 }
 control(input:HeroInput):void {
  const movement=this.game.hero.arenaMovement(input),m=this.view.match,self=m?.fighters.find(f=>f.id===this.selfId);
  const target=m?.fighters.filter(f=>f.team!==self?.team&&f.hp>0).sort((a,b)=>Math.hypot(a.x-(self?.x??0),a.z-(self?.z??0))-Math.hypot(b.x-(self?.x??0),b.z-(self?.z??0)))[0];
  const dx=target&&self?target.x-self.x:this.game.hero.facing.x,dz=target&&self?target.z-self.z:this.game.hero.facing.z,len=Math.max(.001,Math.hypot(dx,dz));
  this.pending={...this.pending,moveX:movement.x,moveZ:movement.z,aimX:dx/len,aimZ:dz/len,attack:input.attack,skill:input.skill??this.pending.skill,dash:input.dash||this.pending.dash};
  if(this.local&&m?.phase==='active'){this.local.input(this.selfId,{...this.pending,seq:++this.sequence});this.pending.skill=null;this.pending.dash=false;this.pending.potion=null;}
 }
 async returnWorld(send=true):Promise<void>{
  if(this.transitioning)return;this.transitioning=true;
  try{if(send){try{await this.command('leave');}catch{/* Restore the local world even when the server went away. */}}await this.game.leaveArenaMap();this.inMap=false;this.view={queue:null,match:null,serverTime:Date.now()};this.visible=false;this.root.hidden=true;this.overlay.hidden=true;this.game.clearArenaReturn();}
  finally{this.transitioning=false;this.signature='';}
 }
 private render():void {
  const m=this.view.match,q=this.view.queue,pt=this.game.progress.language==='pt',t=(a:string,b:string)=>pt?a:b;
  this.overlay.hidden=!q&&!this.inMap;
  if(q)syncArenaOverlay(this.overlay,`<div class="pvp-queue" role="status">⚔ ${t('Procurando jogadores no seu Elo','Finding players in your Elo')}… ${clockArena((this.view.serverTime-q.since)/1000)}<small>${t('Jogadores encontrados','Players found')}: ${q.found}/${q.required} · IA após 5s</small><button data-pvp="cancel">${t('Cancelar','Cancel')}</button></div>`);
  if(this.inMap&&m){
   const self=m.fighters.find(f=>f.id===this.selfId)!,blue=m.fighters.filter(f=>f.team===self.team),red=m.fighters.filter(f=>f.team!==self.team);
   const team=(fs:typeof blue)=>fs.map(f=>`<article class="pvp-vital ${f.hp<=0?'fallen':''}">${classIcon(f.classId)}<div><strong>${safeArena(f.name)}</strong><progress max="${f.maxHp}" value="${f.hp}" aria-label="HP ${safeArena(f.name)}"></progress><progress class="mana" max="${f.maxMana}" value="${f.mana}" aria-label="Mana ${safeArena(f.name)}"></progress></div></article>`).join('');
   const countdown=m.phase==='countdown'?Math.max(1,Math.ceil((m.deadline-this.view.serverTime)/1000)):m.phase==='active'&&m.remaining>178.7?t('LUTEM!','FIGHT!'):'';
   const result=m.phase==='ended',won=m.winner===self.team,award=m.results.find(r=>r.id===this.selfId);
   syncArenaOverlay(this.overlay,`<div class="pvp-score"><section>${team(blue)}</section><div><strong>${blue.reduce((n,f)=>n+f.kills,0)} ⚔ ${red.reduce((n,f)=>n+f.kills,0)}</strong><b>${clockArena(m.remaining)}</b><small>${m.ranked?t('Ranqueada','Ranked'):t('Treino com IA','AI practice')}</small><button data-pvp="forfeit">${t('Sair','Leave')}</button></div><section class="enemy">${team(red)}</section></div>${countdown?`<div class="pvp-countdown" role="status">${countdown}</div>`:''}<div class="pvp-potions"><button data-pvp="hp" ${self.potions<=0||self.potionCd>0?'disabled':''}>♥ ${self.potions} <kbd>Q</kbd></button><button data-pvp="mana" ${self.potions<=0||self.potionCd>0?'disabled':''}>✦ <kbd>E</kbd></button><small>${self.potionCd>0?Math.ceil(self.potionCd)+'s':''}</small></div>${result?`<div class="pvp-result" role="dialog"><h2>${m.winner===null?t('EMPATE','DRAW'):won?t('🏆 VITÓRIA GLORIOSA!','🏆 GLORIOUS VICTORY!'):t('💀 DERROTA HONROSA','💀 HONORABLE DEFEAT')}</h2><p>${award?(award.rating>=0?'+':'')+award.rating+' Elo · '+award.honor+' '+t('Honra','Honor'):''} ${!m.ranked?'· '+t('Saldo de treino separado','Separate practice ledger'):''}</p><div class="pvp-table"><table><thead><tr><th>${t('Combatente','Fighter')}</th><th>${t('Dano','Damage')}</th><th>K / A</th><th>${t('Cura','Healing')}</th></tr></thead><tbody>${m.fighters.map(f=>`<tr><td>${safeArena(f.name)}</td><td>${Math.round(f.damage)}</td><td>${f.kills} / ${f.assists}</td><td>${Math.round(f.healing)}</td></tr>`).join('')}</tbody></table></div><button data-pvp="return">${t('VOLTAR AO MUNDO','RETURN TO WORLD')}</button></div>`:''}${this.error?`<p class="pvp-error">${safeArena(this.error)}</p>`:''}`);
  }
  if(!this.visible)return;
  const signature=JSON.stringify([m?.phase,m?.accepted,m?.phase==='found'?Math.ceil((m.deadline-this.view.serverTime)/1000):0,this.mode,this.error,!!this.game.hub.online.view]);if(signature===this.signature)return;this.signature=signature;
  const button=(action:string,label:string,extra='')=>`<button data-pvp="${action}" ${extra}>${label}</button>`;
  if(m?.phase==='found'){
   this.root.innerHTML=`<header><h2>${t('PARTIDA ENCONTRADA!','MATCH FOUND!')}</h2>${button('cancel',t('Recusar','Decline'))}</header><p>${t('Time Azul vs Time Vermelho','Blue Team vs Red Team')} · ${Math.max(0,Math.ceil((m.deadline-this.view.serverTime)/1000))}s · ${m.ranked?'PvP':t('Treino misto / IA identificada','Mixed practice / identified AI')}</p><div class="pvp-roster">${m.fighters.map(f=>`<article class="team-${f.team}">${classIcon(f.classId)}<h3>${safeArena(f.name)}</h3><strong>${CLASS_DEFINITIONS[f.classId].name}</strong><small>Lv. ${f.level} · CP ${f.cp} · ${eloForRating(f.rating)} ${f.rating}</small><span>${f.bot?'IA':t('Jogador','Player')}</span></article>`).join('')}</div>${button('accept',m.accepted.includes(this.selfId)?t('Aceito · aguardando equipe','Accepted · waiting for team'):t('ACEITAR COMBATE','ACCEPT BATTLE'),m.accepted.includes(this.selfId)?'disabled':'')}`;
   return;
  }
  this.root.innerHTML=`<header><h2>⚔ ${t('Coliseu Imperial','Imperial Coliseum')}</h2>${button('close','✕','aria-label="Fechar"')}</header><div class="pvp-lobby-body"><nav>${([1,2,3] as const).map((n,i)=>button('mode',`${['🔥','⚔','👑'][i]} ${[t('Duelo Solitário','Solo Duel'),t('Dupla de Sangue','Blood Duo'),t('Guerra de Esquadrão','Squad War')][i]} <b>${n}×${n}</b>`,`data-size="${n}" class="${this.mode===n?'selected':''}"`)).join('')}</nav><p>${t('Controle seu herói com joystick, 4 habilidades e esquiva. Vagas vazias recebem IA equilibrada após 5s.','Control your hero with joystick, four skills and dodge. Empty slots receive balanced AI after 5s.')}</p>${this.game.hub.online.view?`<p>${safeArena(this.game.hub.online.view.self.name)} · Elo ${this.game.hub.online.view.self.rating} · ${t('Perfil online validado pelo servidor','Server-validated online profile')}</p>${button('queue',t('PROCURAR PARTIDA','FIND MATCH'))}`:`<div class="pvp-connect"><label>${t('Servidor (vazio = mesma origem)','Server (empty = same origin)')}<input name="pvp-server" value="${safeArena(this.game.hub.online.endpoint)}" placeholder="https://game.example.com"></label><label>${t('Nome','Name')}<input name="pvp-name" value="Aventureiro" maxlength="24"></label>${button('connect',t('Conectar perfil online','Connect online profile'))}</div>`}<hr>${button('practice',t('TREINAR OFFLINE COM IA','OFFLINE AI PRACTICE'))}<small>${t('Treino separado do ranking e moedas online. IA: 92–108% do CP. Sem vantagem de VIP.','Practice is separate from online ranking and currency. AI: 92–108% CP. No VIP advantage.')}</small><p class="pvp-error" role="status">${safeArena(this.error)}</p></div>`;
 }
 dispose():void{this.disposed=true;clearInterval(this.interval);this.abort.abort();this.root.remove();this.overlay.remove();}
}
