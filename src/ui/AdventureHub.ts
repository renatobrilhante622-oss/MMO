import type { Engine } from '../core/Engine';
import { refineChance } from '../rpg/InventoryForgeSocket';
import { EPIGRAPHS } from '../rpg/ClassEpigraphSystem';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../combat/ClassSystem';
import { ATTRIBUTES, ATTRIBUTE_NAMES, COSMETICS, GACHA_ODDS, SLOT_COSTS, type Language } from '../progression/AdventureProgress';
import { DUNGEONS, REGIONS, regionAt, DUNGEON_DIFFICULTIES, dungeonVariant } from '../world/Regions';
import { RARITIES, RARITY_COLORS } from '../rpg/InventoryAndLoot';
import { classIcon } from './IconAtlas';
import { OnlineClient } from '../online/OnlineClient';
import './adventure.css';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
type Tab='talents'|'classes'|'inventory'|'shop'|'collection'|'map'|'teleports'|'dungeons'|'pass'|'settings'|'arena'|'clan'|'market';
export class AdventureHub {
  readonly root=document.createElement('div');
  readonly online=new OnlineClient();
  private tab:Tab='talents';
  private visible=false;
  private timer=0;
  private readonly abort=new AbortController();
  private itemFilter='all';
  private sort='rarity';
  private lastResult='';
  private priorFocus:HTMLElement|null=null;
  private lastOnline='';
  constructor(container:HTMLElement,private readonly game:Engine){
    this.root.className='adventure-layer';this.root.hidden=true;container.append(this.root);
    this.root.addEventListener('click',event=>{
      const button=(event.target as Element).closest<HTMLElement>('[data-hub],[data-do]');
      if(!button)return;
      if(button.dataset.hub){this.open(button.dataset.hub as Tab);return;}
      const action=button.dataset.do!;
      if(action==='close'){this.close();return;}
      if(action.startsWith('online:')){void this.onlineAction(action.slice(7),button);return;}
      if(action==='waypoint-clear'){this.game.progress.waypoint=null;this.game.setWaypoint(null);this.render();return;}
      const payload={id:button.dataset.id??'',key:button.dataset.key??'',index:Number(button.dataset.index??0),name:this.root.querySelector<HTMLInputElement>('[name=bookmark]')?.value??''};
      const message=this.game.adventureAction(action,payload);this.lastResult=message;this.render();
    },{signal:this.abort.signal});
    this.root.addEventListener('change',event=>{
      const el=event.target as HTMLInputElement;
      if(el.name==='filter'){this.itemFilter=el.value;this.render();}
      else if(el.name==='sort'){this.sort=el.value;this.render();}
      else if(el.name==='language'){this.game.progress.language=el.value as Language;this.game.applyPreferences();this.render();}
    },{signal:this.abort.signal});
    this.root.addEventListener('input',event=>{
      const el=event.target as HTMLInputElement;
      if(['hudScale','controlsScale','hudOpacity','autoHealthThreshold','autoManaThreshold'].includes(el.name)){this.game.setHudPreference(el.name,Number(el.value));const output=el.nextElementSibling;if(output)output.textContent=Math.round(Number(el.value)*100)+'%';}
    },{signal:this.abort.signal});
    this.root.addEventListener('click',event=>{
      if((event.target as HTMLElement).tagName!=='CANVAS')return;
      const canvas=event.target as HTMLCanvasElement,rect=canvas.getBoundingClientRect();
      const mouse=event as MouseEvent,x=((mouse.clientX-rect.left)/rect.width)*280-140,z=((mouse.clientY-rect.top)/rect.height)*280-140;
      this.game.setWaypoint({x,z});this.render();
    },{signal:this.abort.signal});
    document.addEventListener('keydown',event=>{
      if(event.code==='Escape'&&this.visible){event.preventDefault();this.close();}
      if(event.code==='Tab'&&this.visible){const controls=[...this.root.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]')];const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}}
    },{signal:this.abort.signal});
    this.timer=window.setInterval(()=>{if(this.visible&&['arena','clan','market'].includes(this.tab))void this.poll();},1500);
  }
  get blocking():boolean{return this.visible;}
  private t(pt:string,en:string):string{return this.game.progress.language==='pt'?pt:en;}
  private label(value:readonly[string,string]):string{return value[this.game.progress.language==='pt'?0:1];}
  open(tab:Tab='talents'):void {
    if(!this.visible)this.priorFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.visible=true;this.tab=tab;this.root.hidden=false;this.game.progress.autoFarm=false;this.render();this.root.querySelector<HTMLElement>('[data-do=close]')?.focus();
    if(['arena','clan','market'].includes(tab))void this.poll();
  }
  close():void {if(!this.game.progress.chosen){this.lastResult=this.t('Escolha sua classe para continuar.','Choose your class to continue.');this.tab='classes';this.render();return;}this.visible=false;this.root.hidden=true;this.game.save();this.priorFocus?.focus();}
  private button(action:string,text:string,extra='',disabled=false):string{return `<button data-do="${action}" ${extra} ${disabled?'disabled':''}>${text}</button>`;}
  private async onlineAction(action:string,button:HTMLElement):Promise<void>{
    const value=(name:string)=>this.root.querySelector<HTMLInputElement>(`[name=${name}]`)?.value??'';
    if(action==='connect'){
      try{this.online.configure(value('endpoint'));await this.online.refresh();if(!this.online.connected)await this.online.create(value('nickname'));}catch(e){this.online.error=String(e);}
    }else{
      const data:Record<string,unknown>={id:button.dataset.id};
      if(action==='queue')data.size=Number(button.dataset.size);
      if(action==='fight'){data.action=button.dataset.action;data.target=value('arenaTarget');}
      if(action==='clan/create')data.name=value('clanName');
      if(action==='clan/role')data.role=button.dataset.role;
      if(action==='market/list')data.price=Number(value('price'));
      await this.online.action('/'+action,data);
    }
    this.render();
  }
  private async poll():Promise<void>{await this.online.refresh();if(!this.visible||!['arena','clan','market'].includes(this.tab))return;const state=JSON.stringify(this.online.view)+this.online.error;if(state!==this.lastOnline&&!this.root.querySelector('input:focus,select:focus')){this.lastOnline=state;this.render();}}
  private render():void {
    if(!this.visible)return;
    const p=this.game.progress,inv=this.game.inventory;
    const groups:Array<[string,Array<[Tab,string,string]>]>=[
      [this.t('PERSONAGEM','CHARACTER'),[['talents','Epígrafo','Epigraph'],['classes','Trocar classe','Switch class'],['inventory','Inventário e forja','Inventory & forge'],['collection','Coleção','Collection']]],
      [this.t('AVENTURA','ADVENTURE'),[['map','Mapa e GPS','Map & GPS'],['teleports','Teleportes','Teleports'],['dungeons','Masmorras','Dungeons']]],
      [this.t('RECOMPENSAS','REWARDS'),[['shop','Loja e invocação','Shop & summon'],['pass','VIP e passe','VIP & pass']]],
      [this.t('ONLINE LOCAL','LOCAL ONLINE'),[['arena','Arena PvP','PvP Arena'],['clan','Clã','Clan'],['market','Mercado','Market']]],
      ['', [['settings','Configurações','Settings']]],
    ];
    const current=groups.flatMap(g=>g[1]).find(([id])=>id===this.tab)!;
    let content='';
    switch(this.tab){
      case 'talents':content=this.talents();break;
      case 'classes':content=this.classes();break;
      case 'inventory':content=this.inventory();break;
      case 'shop':content=this.shop();break;
      case 'collection':content=this.collection();break;
      case 'map':content=this.map();break;
      case 'teleports':content=this.teleports();break;
      case 'dungeons':content=this.dungeons();break;
      case 'pass':content=this.pass();break;
      case 'settings':content=this.settings();break;
      default:content=this.onlinePanel();
    }
    this.root.innerHTML=`<section class="adventure-window" role="dialog" aria-modal="true" aria-label="${this.t('Jornada','Journey')}"><aside class="adventure-nav"><div class="adventure-brand">E<span>✦</span>TERNA</div>${groups.map(([title,links])=>`<small>${title}</small>${links.map(([id,pt,en])=>`<button data-hub="${id}" class="${this.tab===id?'selected':''}">${this.t(pt,en)}</button>`).join('')}`).join('')}</aside><main class="adventure-main"><header><div><small>${CLASS_DEFINITIONS[this.game.currentClass].name} · ${this.t('Nível','Level')} ${inv.level}</small><h1>${this.t(current[1],current[2])}</h1></div><button data-do="close" aria-label="${this.t('Fechar','Close')}">×</button></header><div class="adventure-wallet"><span>◈ ${inv.gold.toLocaleString()} ${this.t('ouro','gold')}</span><span>◇ ${inv.crystals} ${this.t('cristais','crystals')}</span><span>${p.vip?'VIP ✓':''}</span></div><div class="adventure-feedback ${this.lastResult.startsWith('Summoned')||this.lastResult.startsWith('Invocado')?'summon-reveal':''}" role="status">${esc(this.lastResult||this.online.error)}</div><div class="adventure-content">${content}</div></main></section>`;
    if(this.tab==='map')this.drawMap();
  }
  private talents():string {
    const p=this.game.progress,id=this.game.currentClass,definition=CLASS_DEFINITIONS[id];
    return `<div class="epigraph-hero" style="--accent:#${definition.color.toString(16)}">${classIcon(id)}<div><h2>${definition.name}</h2><p>${this.t('Três pontos por nível. Uma árvore persistente para cada classe.','Three points per level. A persistent tree for every class.')}</p><strong>${p.points(id)} ${this.t('pontos disponíveis','available points')}</strong></div></div><div class="adventure-grid">${ATTRIBUTES.map(key=>`<article class="adventure-card"><small>${this.label(EPIGRAPHS[id][key].name)}</small><h2>${p.talents[id]?.[key]??0}<small>/100</small></h2><p>${this.game.epigraphDescription(key)}</p>${this.button('talent',this.t('Investir ponto','Invest point'),`data-key="${key}"`,p.points(id)<1||(p.talents[id]?.[key]??0)>=100)}</article>`).join('')}</div><p>${this.t('Resetar devolve todos os pontos desta classe. Custo:','Reset refunds all points for this class. Cost:')} ${100+p.spent(id)*20} ${this.t('ouro','gold')}.</p>${this.button('talent-reset',this.t('Resetar epígrafo','Reset epigraph'),'',p.spent(id)===0)}`;
  }
  private classes():string{return `<p>${this.t('Escolha seu caminho. Você pode trocar na vila, fora de combate; pontos e recargas são preservados.','Choose your path. Switch in town outside combat; points and cooldowns are preserved.')}</p><div class="adventure-grid class-grid">${CLASS_IDS.map(id=>`<article class="adventure-card ${id===this.game.currentClass?'active':''}" style="--accent:#${CLASS_DEFINITIONS[id].color.toString(16)}">${classIcon(id)}<h2>${CLASS_DEFINITIONS[id].name}</h2><p>${this.game.translate(CLASS_DEFINITIONS[id].description)}</p>${this.button('class',id===this.game.currentClass?this.t('Abrir epígrafo','Open epigraph'):this.t('Escolher','Choose'),`data-id="${id}"`)}</article>`).join('')}</div>`;}
  private inventory():string {
    const inv=this.game.inventory,p=this.game.progress;
    const filtered=inv.items.filter(i=>this.itemFilter==='all'||(this.itemFilter==='equipped'?Object.values(inv.equipment).includes(i.id):i.slot===this.itemFilter));
    filtered.sort((a,b)=>this.sort==='level'?b.level-a.level:RARITIES.indexOf(b.rarity)-RARITIES.indexOf(a.rarity)||b.upgrade-a.upgrade);
    return `<div class="adventure-toolbar"><label>${this.t('Filtrar','Filter')} <select name="filter">${['all','equipped','weapon','helmet','armor','boots','ring','amulet'].map(v=>`<option value="${v}" ${this.itemFilter===v?'selected':''}>${this.game.translate(v)}</option>`).join('')}</select></label><label>${this.t('Ordenar','Sort')} <select name="sort"><option value="rarity" ${this.sort==='rarity'?'selected':''}>${this.t('Raridade','Rarity')}</option><option value="level" ${this.sort==='level'?'selected':''}>${this.t('Nível','Level')}</option></select></label><span>${inv.items.length}/${inv.capacity}</span></div><p>${this.t('Bloqueie itens importantes. Venda apenas itens sem joias. Desmontar recupera as joias e gera materiais.','Lock valuable items. Sell items without gems. Salvaging returns gems and creates materials.')}</p><div class="forge-resources">${Object.entries(p.gems).map(([g,n])=>`<span>${this.game.translate(g)}: ${n}</span>`).join('')}<span>${this.t('Materiais','Materials')}: ${p.materials}</span></div><div class="adventure-grid item-grid">${filtered.map(item=>{const cost=inv.upgradeCost(item.id),equipped=Object.values(inv.equipment).includes(item.id);return `<article class="adventure-card" style="--accent:${RARITY_COLORS[item.rarity]}"><small>${this.game.translate(item.rarity)} · ${this.t('Nv.','Lv.')} ${item.level}${equipped?' · ✓':''}</small><h3>${esc(this.game.translate(item.name))} +${item.upgrade}</h3><p>⚔ ${item.attack} · ◈ ${item.defense} · ♥ ${item.maxHp}</p><p>${this.t('Refino','Refinement')}: ${Math.round(refineChance(item.upgrade)*100)}% · ${this.t('Falha consome custo, preserva item','Failure consumes cost, preserves item')}</p><p>${(item.sockets??[]).map((g,i)=>'◆ '+this.game.translate(g)+' '+(item.gemLevels?.[i]??1)).join(' · ')||this.t('Sem joias','No gems')} (${item.sockets?.length??0}/${p.socketCapacity(item.rarity)})</p><div class="item-actions">${this.button('equip',this.t('Equipar','Equip'),`data-id="${item.id}"`,equipped||item.level>inv.level)}${this.button('lock',item.locked?'🔒':'🔓',`data-id="${item.id}"`)}${this.button('upgrade',`+ ${Number.isFinite(cost.gold)?cost.gold:'MAX'} ◈ · ${Number.isFinite(cost.crystals)?cost.crystals:0} ◇`,`data-id="${item.id}"`,item.upgrade>=15||item.locked)}${this.button('sell',`${this.t('Vender','Sell')} ${item.value}`,`data-id="${item.id}"`,equipped||!!item.locked||!!item.sockets?.length)}${this.button('salvage',this.t('Desmontar','Salvage'),`data-id="${item.id}"`,equipped||!!item.locked)}</div><div class="socket-actions">${Object.keys(p.gems).map(g=>this.button('socket',this.game.translate(g),`data-id="${item.id}" data-key="${g}"`,p.gems[g as keyof typeof p.gems]+p.greaterGems[g as keyof typeof p.gems]<1||(item.sockets?.length??0)>=p.socketCapacity(item.rarity))).join('')}${this.button('unsocket',this.t('Remover joias · 200','Remove gems · 200'),`data-id="${item.id}"`,!item.sockets?.length)}</div></article>`;}).join('')}</div>`;
  }
  private shop():string {
    const p=this.game.progress;
    return `<h2>${this.t('Suprimentos e forja','Supplies & forge')}</h2><div class="adventure-grid">${(['health','mana'] as const).map(type=>`<article class="adventure-card"><h3>${this.t(type==='health'?'Poção de vida':'Poção de mana',type==='health'?'Health potion':'Mana potion')}</h3><p>${p.potions[type]} / 99 · ${this.t('Restaura 40%; CD compartilhado 8s','Restores 40%; shared cooldown 8s')}</p>${this.button('potion-buy',this.t('Comprar · 35 ouro','Buy · 35 gold'),`data-key="${type}"`)}${this.button('potion-use',this.t('Usar','Use'),`data-key="${type}"`)}</article>`).join('')}${Object.keys(p.gems).map(g=>`<article class="adventure-card"><h3>${this.game.translate(g)}</h3>${this.button('gem-buy',this.t('Comprar · 450 ouro','Buy · 450 gold'),`data-key="${g}"`)}${this.button('gem-fuse',this.t('Fundir 3× Nv.1 → Nv.2','Fuse 3× Lv.1 → Lv.2'),`data-key="${g}"`)}${this.button('gem-forge',this.t('Criar · 12 materiais + 150 ouro','Craft · 12 materials + 150 gold'),`data-key="${g}"`)}</article>`).join('')}</div><h2>${this.t('Invocação cosmética','Cosmetic summoning')}</h2><div class="adventure-toolbar">${['skin','weapon','mount','pet'].map(key=>this.button('banner',(p.banner===key?'✓ ':'')+this.game.translate(key),`data-key="${key}"`)).join('')}</div><p>${this.t('Apenas visuais, sem atributos. Custa 20 cristais. Cada 10ª invocação garante Raro ou superior; 60 sem Lendário garantem Lendário ou superior. Duplicatas viram fragmentos.','Visuals only, no stats. Costs 20 crystals. Every 10th summon guarantees Rare+; 60 without a Legendary guarantees Legendary+. Duplicates become shards.')}</p><div class="odds-table">${RARITIES.map((r,i)=>`<span style="color:${RARITY_COLORS[r]}">${this.game.translate(r)} ${(GACHA_ODDS[i]*100).toFixed(1)}%</span>`).join('')}</div><p>${this.t('Garantia','Pity')}: ${p.pity}/60 · ${this.t('Invocações','Summons')}: ${p.pulls} · ${this.t('Fragmentos','Shards')}: ${p.shards}</p>${this.button('gacha',this.t('Invocar · 20 cristais','Summon · 20 crystals'),'',p.inventory.crystals<20)} <p>${this.t('Sem dinheiro real. VIP e passe são recursos de teste comprados com moedas do jogo.','No real money. VIP and pass are test features bought with game currency.')}</p>`;
  }
  private collection():string {const p=this.game.progress;return `<p>${this.t('A raridade define o visual, nunca os atributos de PvP.','Rarity defines visuals, never PvP stats.')}</p><div class="adventure-grid">${COSMETICS.map(c=>`<article class="adventure-card" style="--accent:${RARITY_COLORS[c.rarity]}"><small>${this.game.translate(c.type)} · ${this.game.translate(c.rarity)}</small><h3>${this.label(c.name)}</h3>${p.owned.includes(c.id)?this.button('cosmetic',p.equipped[c.type]===c.id?'✓ '+this.t('Equipado','Equipped'):this.t('Equipar visual','Equip cosmetic'),`data-id="${c.id}"`):this.button('redeem',`${[20,40,100,200,500,1200][RARITIES.indexOf(c.rarity)]} ${this.t('fragmentos','shards')}`,`data-id="${c.id}"`)}</article>`).join('')}</div>`;}
  private map():string {
    const pos=this.game.hero.position,p=this.game.progress,r=regionAt(pos.x,pos.z),distance=p.waypoint?Math.round(Math.hypot(pos.x-p.waypoint.x,pos.z-p.waypoint.z)):0;
    return `<p>${this.label(r.name)} · ${this.t('Nível recomendado','Recommended level')} ${r.minLevel}–${r.maxLevel}. ${this.t('Clique no mapa ou escolha um destino. A rota evita água e obstáculos.','Click the map or select a destination. Routes avoid water and obstacles.')}</p><canvas class="world-map" width="560" height="560" aria-label="${this.t('Mapa clicável para GPS','Clickable GPS map')}"></canvas><p>${p.waypoint?`GPS: ${distance} m · ${this.game.gpsRoute.length?this.t('Rota calculada','Route calculated'):this.t('Sem rota segura','No safe route')}`:this.t('Nenhum destino marcado','No destination marked')}</p>${this.button('waypoint-clear',this.t('Limpar GPS','Clear GPS'))}<div class="adventure-grid">${REGIONS.map(r=>`<article class="adventure-card" style="--accent:${r.color}"><h3>${this.label(r.name)}</h3><p>${r.minLevel}–${r.maxLevel} · ${p.discovered.includes(r.id)?this.t('Descoberto','Discovered'):this.t('Inexplorado','Unexplored')}</p>${this.button('gps-region',this.t('Marcar região','Mark region'),`data-id="${r.id}"`)}${this.button('gps-boss',this.label(r.boss.name),`data-id="${r.id}"`)}</article>`).join('')}</div>`;
  }
  private drawMap():void {
    const c=this.root.querySelector('canvas')!,ctx=c.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#0e2024';ctx.fillRect(0,0,560,560);
    const project=(x:number,z:number)=>[(x+140)*2,(z+140)*2];
    for(const r of REGIONS){const [x,y]=project(r.center.x,r.center.z);ctx.fillStyle=r.color+'24';ctx.beginPath();ctx.arc(x,y,r.radius*1.45,0,Math.PI*2);ctx.fill();ctx.fillStyle=r.color;ctx.font='12px sans-serif';ctx.fillText(this.label(r.name),Math.max(5,x-55),y);ctx.fillText(`${r.minLevel}–${r.maxLevel}`,x-15,y+17);const [bx,by]=project(r.boss.x,r.boss.z);ctx.fillText('♛',bx,by);}
    ctx.strokeStyle='#65e9d1';ctx.lineWidth=3;ctx.beginPath();const hero=this.game.hero.position;let [x,y]=project(hero.x,hero.z);ctx.moveTo(x,y);for(const p of this.game.gpsRoute){const [px,py]=project(p.x,p.z);ctx.lineTo(px,py);}ctx.stroke();ctx.fillStyle='#fff5bd';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();const waypoint=this.game.progress.waypoint;if(waypoint){[x,y]=project(waypoint.x,waypoint.z);ctx.strokeStyle='#ffcc73';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}
  }
  private teleports():string {const p=this.game.progress;return `<p>${this.t('4 slots grátis + 4 comprados + 2 VIP. Bloqueado em dungeons, perto de chefes ou durante combate. Conjuração: 2s; recarga: 45s.','4 free slots + 4 purchased + 2 VIP. Blocked in dungeons, near bosses or during combat. Channel: 2s; cooldown: 45s.')}</p><label>${this.t('Nome do local','Location name')} <input name="bookmark" maxlength="30" placeholder="${this.t('Meu ponto de viagem','My travel point')}"></label><div class="adventure-grid">${p.bookmarks.map((b,i)=>`<article class="adventure-card"><small>${i+1} · ${i<4?this.t('Grátis','Free'):i<8?this.t('Moedas','Coins'):'VIP'}</small><h3>${b?esc(b.name):this.t('Local vazio','Empty slot')}</h3><p>${b?`${Math.round(b.x)}, ${Math.round(b.z)}`:'—'}</p>${this.button('teleport-record',this.t('Gravar local','Save location'),`data-index="${i}"`,!p.slotUnlocked(i))}${this.button('teleport',p.teleportCooldown>0?`${Math.ceil(p.teleportCooldown)}s`:this.t('Viajar','Travel'),`data-index="${i}"`,!p.slotUnlocked(i)||!b||p.teleportCooldown>0)}</article>`).join('')}</div>${p.purchasedSlots<4?this.button('slot-buy',`${this.t('Comprar próximo slot','Buy next slot')} · ${SLOT_COSTS[p.purchasedSlots]} ◈`):''}`;}
  private dungeons():string {const p=this.game.progress;return `<div class="adventure-toolbar">${DUNGEON_DIFFICULTIES.map(d=>this.button('difficulty',(p.dungeonDifficulty===d.id?'✓ ':'')+this.label(d.name),`data-key="${d.id}"`,this.game.dungeon.active)).join('')}</div><p>${this.t('Selecione a masmorra e viaje até a Fenda do Vazio. Cada rota tem ondas, chefe e recompensa próprias. A morte encerra a tentativa.','Select a dungeon and travel to the Void Rift. Each route has its own waves, boss and rewards. Death ends the attempt.')}</p><div class="adventure-grid">${DUNGEONS.map(base=>{const d=dungeonVariant(base,p.dungeonDifficulty);return `<article class="adventure-card ${p.selectedDungeon===d.id?'active':''}"><small>${this.t('Nível','Level')} ${d.level} · ${d.waves} ${this.t('ondas','waves')}</small><h3>${this.label(d.name)}</h3><p>${this.label(d.bossName)} · ${p.dungeonClears[d.id]??0} ${this.t('conclusões','clears')}</p><p>◈ ${d.gold} · ◇ ${d.crystals}</p>${this.button('dungeon-select',this.t('Selecionar','Select'),`data-id="${d.id}"`,this.game.inventory.level<d.level||this.game.dungeon.active)}${this.button('dungeon-start',this.t('Entrar perto do portal','Enter near the portal'),`data-id="${d.id}"`,this.game.inventory.level<d.level||this.game.dungeon.active)}</article>`;}).join('')}</div>`;}
  private pass():string {const p=this.game.progress;return `<div class="adventure-grid"><article class="adventure-card"><h2>VIP · 30 ${this.t('dias','days')}</h2><p>${this.t('Slots 9/10 e Auto-Farm. Sem bônus de PvP. Apenas moeda de jogo nesta versão.','Slots 9/10 and Auto-Farm. No PvP bonuses. Game currency only in this version.')}</p>${this.button('vip',p.vip?this.t('VIP ativo','VIP active'):this.t('Ativar · 25.000 ouro','Activate · 25,000 gold'),'',p.vip)}</article><article class="adventure-card"><h2>${this.t('Passe mensal','Monthly pass')} · ${p.season}</h2><p>${this.t('3 XP por monstro, 25 por chefe e 60 por dungeon. 100 XP por nível. A trilha reinicia a cada mês UTC.','3 XP per monster, 25 per boss, 60 per dungeon. 100 XP per tier. Track resets each UTC month.')}</p><p>${p.passXp}/3000 XP · ${this.t('Premium: +10 fragmentos por recompensa','Premium: +10 shards per reward')}</p>${this.button('pass-buy',p.premium?'Premium ✓':this.t('Premium · 180 cristais','Premium · 180 crystals'),'',p.premium)}</article></div><h2>${this.t('Missões','Missions')}</h2><div class="adventure-grid">${(['daily','weekly'] as const).map(id=>`<article class="adventure-card"><h3>${id==='daily'?this.t('Diária: 15 monstros','Daily: 15 monsters'):this.t('Semanal: 5 masmorras','Weekly: 5 dungeons')}</h3><p>${p.missionProgress(id)}/${id==='daily'?15:5}</p>${this.button('mission',p.missionClaimed(id)?'✓':this.t('Resgatar XP do passe','Claim pass XP'),`data-key="${id}"`,p.missionClaimed(id)||p.missionProgress(id)<(id==='daily'?15:5))}</article>`).join('')}</div><div class="pass-track">${Array.from({length:30},(_,i)=>i+1).map(tier=>`<article class="adventure-card"><strong>${tier}</strong><span>◈ ${tier*35} · ◇ ${tier%5===0?6:1}</span>${this.button('pass-claim',p.claimed.includes(tier)?'✓':this.t('Resgatar','Claim'),`data-index="${tier}"`,p.claimed.includes(tier)||p.passTier<tier)}</article>`).join('')}</div>`;}
  private settings():string {const p=this.game.progress;return `<div class="settings-form"><label>${this.t('Idioma geral','Game language')}<select name="language"><option value="pt" ${p.language==='pt'?'selected':''}>Português (Brasil)</option><option value="en" ${p.language==='en'?'selected':''}>English (US)</option></select></label>${[['hudScale',this.t('Escala da interface','Interface scale'),p.hudScale],['controlsScale',this.t('Escala dos controles','Control scale'),p.controlsScale],['hudOpacity',this.t('Opacidade','Opacity'),p.hudOpacity],['autoHealthThreshold',this.t('Auto-Farm: usar poção HP abaixo de','Auto-Farm: use HP potion below'),p.autoHealthThreshold],['autoManaThreshold',this.t('Auto-Farm: usar poção MP abaixo de','Auto-Farm: use MP potion below'),p.autoManaThreshold]].map(([name,label,value])=>`<label>${label}<input type="range" name="${name}" min="${String(name).startsWith('auto')?.1:name==='hudOpacity'?.3:.5}" max="${String(name).startsWith('auto')?.8:name==='hudOpacity'?1:1.5}" step=".05" value="${value}"><output>${Math.round(Number(value)*100)}%</output></label>`).join('')}<p>${this.t('As preferências e o progresso PvE são salvos neste dispositivo. Seu token online identifica a conta de desenvolvimento neste navegador; não o compartilhe.','Preferences and PvE progress are saved on this device. Your online token identifies this browser’s development account; do not share it.')}</p></div>`;}
  private onlinePanel():string {
    const o=this.online,v=o.view;
    if(!v)return `<h2>${this.t('Servidor de desenvolvimento','Development server')}</h2><p>${this.t('Execute npm run server junto do Vite. Para outro aparelho, informe uma origem HTTPS que encaminhe /api para o servidor. A versão APK não conecta automaticamente ao localhost do computador.','Run npm run server alongside Vite. On another device use an HTTPS origin routing /api to the server. The APK does not automatically connect to your computer’s localhost.')}</p><label>${this.t('Servidor (vazio = mesma origem)','Server (empty = same origin)')}<input name="endpoint" value="${esc(o.endpoint)}" placeholder="https://game.example.com"></label><label>${this.t('Nome do aventureiro','Adventurer name')}<input name="nickname" minlength="3" maxlength="24" value="Traveler"></label>${this.button('online:connect',this.t('Conectar / criar perfil local','Connect / create development profile'))}<p>${this.t('PvE local e economia online são separados. Nenhum item ou moeda editável no cliente entra no mercado online.','Local PvE and online economies are separate. No client-editable item or currency enters the online market.')}</p>`;
    let html=`<div class="online-status">● ${esc(v.self.name)} · Elo ${v.self.rating} · ${v.self.coins} ${this.t('marcas de arena','arena marks')} · ${v.self.wins}W/${v.self.losses}L</div>`;
    if(this.tab==='arena'){
      html+=`<p>${this.t('Apenas jogadores reais conectados. Atributos normalizados: 1.200 HP e mesmo dano para todos. O pareamento usa Elo; equipamentos, level e VIP não dão vantagem. Sem bots para preencher a fila.','Connected human players only. Normalized stats: 1,200 HP and equal damage. Matching uses Elo; equipment, level and VIP grant no advantage. No bots fill the queue.')}</p><div class="adventure-toolbar">${v.waiting.map(q=>this.button('online:queue',`${q.size}×${q.size} · ${q.count} ${this.t('na fila','queued')}`,`data-size="${q.size}"`,!!v.queue||!!v.match&&!v.match.ended)).join('')}${v.queue?this.button('online:queue/cancel',this.t('Cancelar fila','Cancel queue')):''}</div>`;
      if(v.queue)html+=`<p role="status">${this.t('Procurando outros jogadores…','Searching for other players…')} ${v.queue.size}×${v.queue.size}</p>`;
      const m=v.match;if(m){html+=`<h2>${m.ended?this.t('Partida encerrada','Match finished'):this.t('Arena ativa','Arena active')}</h2><div class="adventure-grid">${m.fighters.map(f=>`<article class="adventure-card"><small>${this.t('Equipe','Team')} ${f.team+1}</small><h3>${esc(f.name)}</h3><progress max="${f.maxHp}" value="${f.hp}"></progress><p>HP ${f.hp}/${f.maxHp} · ${this.t('Energia','Energy')} ${f.energy}</p></article>`).join('')}</div>${!m.ended?`<label>${this.t('Alvo','Target')}<select name="arenaTarget">${m.fighters.filter(f=>f.team!==m.fighters.find(f=>f.id===v.self.id)?.team&&f.hp>0).map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label><div class="adventure-toolbar">${['strike','spell','guard','leave'].map(action=>this.button('online:fight',this.game.translate(action),`data-action="${action}"`)).join('')}</div>`:''}<ol class="arena-log">${m.log.slice(-8).map(l=>`<li>${esc(l)}</li>`).join('')}</ol>`;}
    }else if(this.tab==='clan'){
      const c=v.clan;
      if(!c)html+=`<label>${this.t('Nome do clã','Clan name')}<input name="clanName" minlength="3" maxlength="28"></label>${this.button('online:clan/create',this.t('Criar · 50 marcas','Create · 50 marks'))}<div class="adventure-grid">${v.clans.map(c=>`<article class="adventure-card"><h3>${esc(c.name)}</h3><p>${c.count}/30</p>${this.button('online:clan/join',this.t('Entrar','Join'),`data-id="${c.id}"`)}</article>`).join('')}</div>`;
      else html+=`<h2>${esc(c.name)}</h2><p>${this.t('Bônus da raid','Raid buff')}: +${((c.level??1)-1)*3}% · ${v.self.clanMarks??0} ${this.t('marcas do clã','clan marks')}</p>${this.button('online:clan/shop',this.t('Loja: emblema · 100 marcas do clã','Shop: crest · 100 clan marks'))}${this.button('online:clan/upgrade',this.t('Melhorar bônus de raid','Upgrade raid buff'))}<h3>${this.t('Chefe semanal compartilhado','Shared weekly boss')}</h3><progress value="${c.bossHp}" max="50000"></progress><p>${c.bossHp}/50.000 HP · ${this.t('Recompensa por contribuição: 200 marcas e emblema épico','Contribution reward: 200 marks and epic crest')}</p>${this.button('online:clan/boss',this.t('Atacar chefe · CD 30s','Attack boss · 30s cooldown'),'',c.bossHp<=0||v.self.bossAttackAt>v.serverTime)}<div class="adventure-grid">${c.members.map(member=>`<article class="adventure-card"><h3>${esc(member.name)}</h3><p>${this.game.translate(member.role)} · ${this.t('Nível de arena','Arena level')} ${member.level} · ${this.t('Dano semanal','Weekly damage')}: ${c.damage?.[member.id]??0}</p>${c.members.find(m=>m.id===v.self.id)?.role==='leader'&&member.id!==v.self.id?['officer','veteran','elite','member','leader'].map(role=>this.button('online:clan/role',this.game.translate(role),`data-id="${member.id}" data-role="${role}"`)).join(''):''}</article>`).join('')}</div>${this.button('online:clan/leave',this.t('Sair do clã','Leave clan'))}`;
    }else{
      html+=`<p>${this.t('Itens online ficam em custódia durante a venda. Taxa de 5% paga pelo vendedor. O item e a moeda são transferidos atomicamente no servidor.','Online items stay in escrow while listed. A 5% seller fee applies. Items and currency transfer atomically on the server.')}</p><label>${this.t('Preço em marcas','Price in marks')}<input name="price" type="number" min="5" max="10000" value="25"></label><h3>${this.t('Sua mochila online','Your online inventory')}</h3><div class="adventure-grid">${v.self.items.map(item=>`<article class="adventure-card"><h3>${esc(item.name)}</h3>${this.button('online:market/list',this.t('Anunciar','List'),`data-id="${item.id}"`)}</article>`).join('')}</div><h3>${this.t('Anúncios','Listings')}</h3><div class="adventure-grid">${v.listings.map(l=>`<article class="adventure-card"><h3>${esc(l.item.name)}</h3><p>${esc(l.sellerName)} · ${l.price}</p>${this.button(l.seller===v.self.id?'online:market/cancel':'online:market/buy',l.seller===v.self.id?this.t('Cancelar','Cancel'):this.t('Comprar','Buy'),`data-id="${l.id}"`)}</article>`).join('')}</div>`;
    }
    return html;
  }
  dispose():void {this.abort.abort();clearInterval(this.timer);this.root.remove();}
}
