import type {EquipmentSlot,LootDrop,Rarity} from '../core/GameTypes';
import {ICON_COLORS,itemIcon,type IconKind} from './ItemIconRenderer';

export interface LootToastEntry {
  title: string;
  detail: string;
  icon: IconKind;
  rarity: Rarity;
}

/** Format actual event payloads; do not manufacture currency or XP rewards. */
export function describeLoot(drop: LootDrop):LootToastEntry|null {
  const detail:string[]=[];
  if(Number.isFinite(drop.xp)&&drop.xp>0)detail.push('+'+Math.floor(drop.xp)+' XP');
  if(Number.isFinite(drop.gold)&&drop.gold>0)detail.push('+'+Math.floor(drop.gold)+' Ouro');
  if(Number.isFinite(drop.crystals)&&drop.crystals>0)detail.push('+'+Math.floor(drop.crystals)+' Cristais');
  if(!detail.length&&!drop.item)return null;
  if(drop.item)return {
    title:drop.item.name,detail:detail.join(' · ')||'Equipamento obtido',
    icon:drop.item.slot as EquipmentSlot,rarity:drop.item.rarity,
  };
  return {title:'Recompensa coletada',detail:detail.join(' · '),icon:'chest',rarity:'common'};
}

/** A nonmodal HUD feed: it never pauses the world or captures joystick gestures. */
export class LootToastFeed {
  readonly root=document.createElement('section');
  private readonly list=document.createElement('div');
  private readonly button=document.createElement('button');
  private readonly timers=new Set<ReturnType<typeof setTimeout>>();
  private collapsed=false;

  constructor(container:HTMLElement) {
    this.root.className='journey-widgets drop-toast-widget';
    this.root.setAttribute('aria-label','Últimas recompensas coletadas');
    this.root.hidden=true;
    this.button.type='button';
    this.button.className='drop-toast-toggle';
    this.button.innerHTML='<span aria-hidden="true">◈</span><b>DROPS</b><span class="drop-toggle-chevron">▾</span>';
    this.button.setAttribute('aria-expanded','true');
    this.button.setAttribute('aria-label','Recolher histórico rápido de drops');
    this.list.className='drop-toast-list';
    this.list.setAttribute('aria-live','polite');
    this.list.setAttribute('aria-relevant','additions');
    this.button.addEventListener('click',()=>this.toggle());
    this.root.append(this.button,this.list);
    container.append(this.root);
  }

  private toggle():void {
    this.collapsed=!this.collapsed;
    this.list.hidden=this.collapsed;
    this.root.classList.toggle('is-collapsed',this.collapsed);
    this.button.setAttribute('aria-expanded',String(!this.collapsed));
    this.button.setAttribute('aria-label',this.collapsed?'Expandir histórico rápido de drops':'Recolher histórico rápido de drops');
  }

  push(drop:LootDrop):void {
    const reward=describeLoot(drop);
    if(!reward)return;
    const entry=document.createElement('div');
    entry.className='drop-toast-entry';
    entry.style.setProperty('--rarity',ICON_COLORS[reward.rarity]);
    entry.innerHTML=itemIcon(reward.icon,reward.rarity,reward.title);
    const content=document.createElement('div');
    const title=document.createElement('b');
    const detail=document.createElement('small');
    title.textContent=reward.title;
    detail.textContent=reward.detail;
    content.append(title,detail);
    entry.append(content);
    this.list.prepend(entry);
    while(this.list.childElementCount>4)this.list.lastElementChild?.remove();
    this.root.hidden=false;
    this.root.classList.add('has-drops');
    const timer=setTimeout(()=>{
      this.timers.delete(timer);
      entry.remove();
      if(!this.list.childElementCount){
        this.root.classList.remove('has-drops');
        this.root.hidden=true;
      }
    },6500);
    this.timers.add(timer);
  }

  dispose():void{
    for(const timer of this.timers)clearTimeout(timer);
    this.timers.clear();
    this.root.remove();
  }
}
