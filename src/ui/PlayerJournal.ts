import {AVATARS,avatarId,avatarSvg} from './AvatarRenderer';
import type {AdventureProgress} from '../progression/AdventureProgress';
import {COSMETICS} from '../progression/AdventureProgress';
import {WING_STYLES} from '../rpg/EvolutionSystem';
import {itemIcon} from './ItemIconRenderer';
import {RARITY_COLORS} from '../rpg/InventoryAndLoot';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export class PlayerJournal {
  readonly root=document.createElement('section');
  private readonly widget=document.createElement('nav');
  private tab='profile';
  private timer:number;
  private wingsButton?:HTMLButtonElement;
  get blocking():boolean{return !this.root.hidden;}
  constructor(container:HTMLElement,private p:AdventureProgress,private info:()=>{level:number;name:string;clan:string;attack:number;defense:number;hp:number},private onChange:()=>void,private onClan:()=>void){
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.className='expansion-modal journal-panel';this.root.hidden=true;container.append(this.root);
    this.widget.className='journey-widgets';this.widget.innerHTML='<button data-journal="history" title="Histórico de drops">◇ Drops <span data-last-drop></span></button>';container.append(this.widget);
    const wings=document.createElement('button');this.wingsButton=wings;wings.className='wings-shortcut';wings.title='Asas / Wings';wings.setAttribute('aria-label','Asas / Wings');wings.innerHTML='<span aria-hidden="true">♆</span><span>Asas</span>';wings.onclick=()=>this.open('wings');container.querySelector('.menu-dock')!.append(wings);
    this.widget.onclick=e=>{const b=(e.target as Element).closest<HTMLElement>('[data-journal]');if(b)this.open(b.dataset.journal!);};
    const hero=container.querySelector<HTMLElement>('.hero-card');if(hero){hero.tabIndex=0;hero.setAttribute('role','button');hero.title='Perfil / Profile';hero.onclick=()=>this.open('profile');hero.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.open('profile');}};}
    this.root.onclick=e=>{const b=(e.target as Element).closest<HTMLElement>('[data-journal]');if(!b)return;const a=b.dataset.journal!;if(a==='close'){this.root.hidden=true;return;}if(a==='clan'){this.root.hidden=true;this.onClan();return;}if(a==='avatar'){this.p.profile.avatar=avatarId(b.dataset.id!);this.onChange();this.render();return;}if(a==='wing-equip'){const style=b.dataset.id as typeof WING_STYLES[number];if(this.p.evolution.wingOwned.includes(style))this.p.evolution.wings=this.p.evolution.wings===style?null:style;}
      else if(a==='evolve'){const id=b.dataset.id!,wing=WING_STYLES.includes(id as typeof WING_STYLES[number]);const cost=this.p.evolution.upgrade(id,this.p.inventory,this.p.materials,wing);if(cost!==null)this.p.materials-=cost;}
      else {this.open(a);return;}this.onChange();this.render();};
    this.timer=window.setInterval(()=>{const last=this.p.dropHistory.at(-1);const label=this.widget.querySelector('[data-last-drop]')!;label.textContent=last?last.name.slice(0,24):'';},1000);
  }
  open(tab='profile'):void{this.tab=tab;this.root.hidden=false;this.render();}
  private render():void {
    const p=this.p,pt=p.language==='pt',info=this.info();let content='';
    if(this.tab==='history')content=`<h2>${pt?'Histórico de coleta · últimas 100':'Loot history · last 100'}</h2><div class="loot-ledger">${p.dropHistory.slice().reverse().map(d=>`<article style="--rarity:${RARITY_COLORS[d.rarity]}">${itemIcon('chest',d.rarity)}<div><b>${esc(d.name)}</b><small>${new Date(d.time).toLocaleTimeString()} · ◈ ${d.gold} · ◇ ${d.crystals}</small></div></article>`).join('')||'<p>Sem drops / No drops yet</p>'}</div>`;
    else if(this.tab==='wings')content=`<h2>${pt?'Asas e companheiros · Evolução 1–10':'Wings and companions · Evolution 1–10'}</h2><div class="evolution-gallery">${WING_STYLES.map((style,i)=>{const own=p.evolution.wingOwned.includes(style),level=p.evolution.wingLevels[style],cost=p.evolution.cost(level);return `<article>${itemIcon('skin',(['epic','legendary','mythic','rare'] as const)[i])}<h3>${style}</h3><progress value="${level}" max="10"></progress><b>Lv. ${level}/10</b><button data-journal="wing-equip" data-id="${style}" ${own?'':'disabled'}>${p.evolution.wings===style?'✓':pt?'Equipar':'Equip'}</button><button data-journal="evolve" data-id="${style}" ${!own||level>=10||p.inventory.gold<cost.gold||p.materials<cost.materials?'disabled':''}>↑ ${cost.gold} ◈ · ${cost.materials} ⚒</button></article>`;}).join('')}${[p.equipped.pet,p.equipped.mount].map(id=>{const c=COSMETICS.find(c=>c.id===id)!,level=p.evolution.level(id),cost=p.evolution.cost(level);return `<article>${itemIcon(c.type==='pet'?'pet':'mount',c.rarity)}<h3>${c.name[pt?0:1]}</h3><b>Lv. ${level}/10</b><progress value="${level}" max="10"></progress><button data-journal="evolve" data-id="${id}" ${level>=10||p.inventory.gold<cost.gold||p.materials<cost.materials?'disabled':''}>↑ ${cost.gold} ◈ · ${cost.materials} ⚒</button></article>`;}).join('')}</div>`;
    else {const selectedAvatar=avatarId(p.profile.avatar);content=`<div class="profile-hero">${avatarSvg(selectedAvatar)}<div><h2>${esc(info.name)} · Lv. ${info.level}</h2><code>ID: ${esc(p.profile.id)}</code><p>⚑ ${esc(info.clan||'Sem clã / No clan')}</p><p>${Math.floor(p.profile.playSeconds/3600)}h ${Math.floor(p.profile.playSeconds/60)%60}m · ${p.dungeonCount} Dungeons · ${p.profile.bossKills} Bosses</p><b>ATK ${Math.round(info.attack)} · DEF ${Math.round(info.defense)} · HP ${Math.round(info.hp)}</b></div></div><h3>${pt?'Foto de perfil':'Profile picture'}</h3><div class="profile-avatars">${AVATARS.map(c=>`<button data-journal="avatar" data-id="${c.id}" title="${c.name}" aria-label="${c.name}">${avatarSvg(c.id)}${selectedAvatar===c.id?'✓':''}</button>`).join('')}</div><button data-journal="clan">⚑ ${pt?'Abrir fortaleza do clã':'Open clan fortress'}</button>`;}
    this.root.innerHTML=`<div class="expansion-window"><header><nav><button data-journal="profile">${pt?'Perfil':'Profile'}</button><button data-journal="history">Drops</button><button data-journal="wings">${pt?'Asas / Evolução':'Wings / Evolution'}</button></nav><button data-journal="close">×</button></header><div class="expansion-body">${content}</div></div>`;
  }
  dispose():void{clearInterval(this.timer);this.root.remove();this.widget.remove();this.wingsButton?.remove();}
}
