import {DUNGEONS} from '../world/Regions';
import {dungeonArtwork} from './CardArtwork';
import {menuIcon} from './MenuIcons';
export type DungeonDifficulty='normal'|'elite'|'nightmare'|'abyssal';
export interface DungeonTier {id:DungeonDifficulty;minLevel:number;label:string;rarity:string;}
export const DUNGEON_TIERS:readonly DungeonTier[]=[
  {id:'normal',minLevel:10,label:'NORMAL',rarity:'Raro'},
  {id:'elite',minLevel:30,label:'DIFÍCIL',rarity:'Épico + Joias'},
  {id:'nightmare',minLevel:60,label:'PESADELO',rarity:'Lendário + Asas'},
  {id:'abyssal',minLevel:85,label:'INFERNAL / MÍTICO',rarity:'Mítico + Pet/Montaria'},
];
export const DUNGEON_SHOWCASE:readonly {id:string;name:string;subtitle:string;texture:string}[]=[
  {id:'tombs',name:'Catacumbas do Rei Ossudo',subtitle:'Catacumba esquecida',texture:'PavingStones046'},
  {id:'titan',name:'Templo do Cristal Corrompido',subtitle:'Ruínas arcanas',texture:'Snow010A'},
  {id:'void',name:'Câmara de Magma',subtitle:'Forja subterrânea',texture:'Ground093C'},
  {id:'eclipse',name:'Trono do Abismo',subtitle:'Confronto final',texture:'Ground071'},
];
export class DungeonUI {
 readonly trigger=document.createElement('button');
 readonly backdrop=document.createElement('div');
 readonly status=document.createElement('aside');
 private body=document.createElement('div');
 private selected='tombs';
 private difficulty:DungeonDifficulty='normal';
 private openFlag=false;
 private seconds=0;
 private paintClock=0;
 private paintKey='';
 private loadingMessage:string|null=null;
 setLoading(message:string|null):void{
   this.loadingMessage=message;
   this.paintKey='';
   if(message){this.status.hidden=false;this.status.textContent=message;}
 }
 constructor(private readonly host:HTMLElement,private readonly level:()=>number,
   private readonly onEnter:(id:string,difficulty:DungeonDifficulty)=>boolean,
   private readonly onExit:()=>void){
   this.trigger.type='button';this.trigger.className='eterna-dungeon-trigger';
   this.trigger.innerHTML=menuIcon('dungeons')+'<span>MASMORRAS</span>';
   this.trigger.onclick=()=>this.open();
   this.backdrop.className='eterna-dungeon-overlay';this.backdrop.hidden=true;
   this.backdrop.setAttribute('role','presentation');
   this.body.className='eterna-dungeon-modal';
   this.body.setAttribute('role','dialog');this.body.setAttribute('aria-modal','true');
   this.body.setAttribute('aria-label','Seleção de Masmorras');
   this.backdrop.append(this.body);
   this.backdrop.addEventListener('click',event=>{if(event.target===this.backdrop)this.close();});
   this.status.className='eterna-dungeon-status';
   this.status.hidden=true;this.status.setAttribute('aria-live','polite');
   host.append(this.trigger,this.backdrop,this.status);
 }
 get blocking():boolean{return this.openFlag;}
 open():void{this.openFlag=true;this.backdrop.hidden=false;this.render();}
 close():void{this.openFlag=false;this.backdrop.hidden=true;}
 private render():void{
   this.body.replaceChildren();
   const header=document.createElement('header');
   const title=document.createElement('div');
   title.innerHTML='<small>ETERNA • INSTÂNCIAS PVE</small><h2>MASMORRAS & GUARDIÕES</h2>';
   const close=document.createElement('button');close.type='button';close.innerHTML=menuIcon('close');
   close.setAttribute('aria-label','Fechar seleção');close.onclick=()=>this.close();
   header.append(title,close);this.body.append(header);
   const panel=document.createElement('div');panel.className='dungeon-selection';
   const gallery=document.createElement('div');gallery.className='dungeon-gallery';
   for(const item of DUNGEON_SHOWCASE){
     const card=document.createElement('button');card.type='button';
     card.className='dungeon-cover'+(this.selected===item.id?' selected':'');
     const image=dungeonArtwork(item.id);
     card.dataset.landscape=item.id;
     card.style.backgroundImage='linear-gradient(#0a14272a,#0a1427dd),url("'+image+'")';
     const name=document.createElement('strong');name.textContent=item.name;
     const subtitle=document.createElement('small');subtitle.textContent=item.subtitle;
     card.append(name,subtitle);card.onclick=()=>{this.selected=item.id;this.render();};
     gallery.append(card);
   }
   const details=document.createElement('section');details.className='dungeon-details';
   const name=document.createElement('h3');
   name.textContent=DUNGEON_SHOWCASE.find(d=>d.id===this.selected)!.name;
   const level=document.createElement('p');
   const selected=DUNGEON_TIERS.find(d=>d.id===this.difficulty)!;
   const required=Math.max(selected.minLevel,DUNGEONS.find(d=>d.id===this.selected)?.level??10);
   level.textContent='Nível recomendado: '+required+'+ • 3 salas e chefe final';
   const tiers=document.createElement('div');tiers.className='dungeon-tiers';
   for(const tier of DUNGEON_TIERS){
     const button=document.createElement('button');button.type='button';
     button.className=this.difficulty===tier.id?'selected':'';
     button.disabled=this.level()<tier.minLevel;
     button.textContent=tier.label+' • Lv. '+tier.minLevel+'+';
     button.title=tier.rarity;
     button.onclick=()=>{this.difficulty=tier.id;this.render();};
     tiers.append(button);
   }
   const reward=document.createElement('div');reward.className='dungeon-reward';
   reward.textContent='✦ DROPS • '+selected.rarity+'  |  🟡 Ouro  |  💎 Cristais';
   const start=document.createElement('button');start.type='button';
   start.className='dungeon-accept';
   start.disabled=this.level()<required;
   start.textContent=start.disabled?'🔒 REQUER LV. '+required:'⚔ ENTRAR NA MASMORRA';
   start.onclick=()=>{if(this.onEnter(this.selected,this.difficulty))this.close();};
   details.append(name,level,tiers,reward,start);
   panel.append(gallery,details);this.body.append(panel);
 }
 update(dt:number,active:boolean,completed:boolean,wave:number,waves:number,status:string):void{
   if(this.loadingMessage){this.status.hidden=false;this.status.textContent=this.loadingMessage;return;}
   if(!active&&!completed){this.status.hidden=true;this.seconds=0;this.paintKey='';return;}
   if(active)this.seconds+=Math.max(0,dt);
   this.status.hidden=false;
   const room=completed?3:wave>waves?3:wave>Math.ceil(waves/2)?2:1;
   const key=String(room)+'/'+String(completed)+'/'+status;
   this.paintClock+=Math.max(0,dt);
   if(this.paintClock<.25&&this.paintKey===key)return;
   this.paintClock=0;this.paintKey=key;
   const names=['','Sala 1/3: Elimine os Guardiões',
     'Sala 2/3: Destrua os Cristais','Sala 3/3: CHEFE DA MASMORRA'];
   this.status.replaceChildren();
   const heading=document.createElement('strong');
   heading.textContent=completed?'✦ MASMORRA CONCLUÍDA':names[room];
   const timer=document.createElement('span');
   const mm=String(Math.floor(this.seconds/60)).padStart(2,'0');
   const ss=String(Math.floor(this.seconds%60)).padStart(2,'0');
   timer.textContent=mm+':'+ss+' • '+status;
   const exit=document.createElement('button');
   exit.type='button';exit.className='dungeon-exit';
   exit.textContent=completed?'🌀 PORTAL DE SAÍDA / RECEBER BAÚ':'↩ ABANDONAR';
   exit.onclick=()=>this.onExit();
   this.status.append(heading,timer,exit);
 }
 dispose():void{this.trigger.remove();this.backdrop.remove();this.status.remove();}
}
