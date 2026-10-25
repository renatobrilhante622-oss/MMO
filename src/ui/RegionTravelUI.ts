import { REGIONS } from '../world/Regions';
import { REGION_REWARDS, travelPermission, type RegionTravelState } from '../world/RegionTravel';

export class RegionTravelUI {
  readonly root=document.createElement('section');
  readonly trigger=document.createElement('button');
  private readonly dialog=document.createElement('div');
  private showing=false;
  private lastState?:RegionTravelState;
  constructor(private readonly host:HTMLElement,
              private readonly state:()=>RegionTravelState,
              private readonly travel:(regionId:string)=>void,
              private readonly language:()=> 'pt'|'en'){
    this.trigger.type='button';
    this.trigger.className='region-travel-trigger';
    this.trigger.textContent='🌀 PORTAIS';
    this.trigger.setAttribute('aria-label','Abrir destinos do mapa-múndi');
    this.trigger.addEventListener('click',()=>this.open());
    this.root.className='region-travel-overlay';
    this.root.hidden=true;
    this.root.setAttribute('role','presentation');
    this.dialog.className='region-travel-dialog';
    this.dialog.setAttribute('role','dialog');
    this.dialog.setAttribute('aria-modal','true');
    this.dialog.setAttribute('aria-label','Regiões do mundo');
    this.root.append(this.dialog);
    this.root.addEventListener('click',event=>{if(event.target===this.root)this.close();});
    this.host.append(this.trigger,this.root);
  }
  get blocking():boolean{return this.showing;}
  open():void {
    this.lastState=this.state();
    this.showing=true;
    this.root.hidden=false;
    this.render();
  }
  close():void {this.showing=false;this.root.hidden=true;}
  render():void {
    if(!this.showing)return;
    const state=this.state(),lang=this.language()==='pt'?0:1;
    this.dialog.replaceChildren();
    const header=document.createElement('header');
    header.className='region-travel-header';
    const title=document.createElement('h2');
    title.textContent=lang===0?'PORTAIS DE ETERNA':'PORTALS OF ETERNA';
    const close=document.createElement('button');
    close.type='button';close.textContent='✕';close.setAttribute('aria-label','Fechar');
    close.onclick=()=>this.close();
    header.append(title,close);
    this.dialog.append(header);
    const intro=document.createElement('p');
    intro.className='region-travel-intro';
    intro.textContent=lang===0?'Escolha seu destino. Regiões avançadas exigem nível e história liberados.':'Choose a destination. Advanced regions require both level and story clearance.';
    this.dialog.append(intro);
    const cards=document.createElement('div');
    cards.className='region-travel-grid';
    for(const region of REGIONS){
      const permission=travelPermission(region.id,state);
      const card=document.createElement('article');
      card.className='region-travel-card'+(permission.ok?'':' locked');
      card.style.setProperty('--region-color',region.color);
      const banner=document.createElement('div');banner.className='region-travel-banner';
      const label=document.createElement('span');label.textContent='LV. '+region.minLevel+'–'+region.maxLevel;
      const name=document.createElement('h3');name.textContent=region.name[lang];
      banner.append(label,name);
      const monsters=document.createElement('p');
      monsters.textContent=(lang===0?'CRIATURAS: ':'CREATURES: ')+region.kinds.join(' · ');
      const drops=document.createElement('p');drops.className='region-travel-loot';
      drops.textContent='✦ '+REGION_REWARDS[region.id].exclusive.join(' · ');
      const action=document.createElement('button');
      action.type='button';
      action.disabled=!permission.ok;
      action.textContent=permission.ok?(lang===0?'CANALIZAR TELEPORTE':'CHANNEL TELEPORT'):permission.reason==='level'?'REQUER LV. '+region.minLevel:permission.reason==='locked'?(lang===0?'CONCLUA A HISTÓRIA':'COMPLETE STORY'):(lang===0?'INDISPONÍVEL':'UNAVAILABLE');
      action.onclick=()=>{if(travelPermission(region.id,this.state()).ok){this.close();this.travel(region.id);}};
      card.append(banner,monsters,drops,action);cards.append(card);
    }
    this.dialog.append(cards);
  }
  dispose():void{this.root.remove();this.trigger.remove();}
}
