import {PerspectiveCamera,Scene,Vector3} from 'three';
import {AnimatedGLB,type ModelName} from '../assets/AnimatedGLB';
import {REGIONS} from './Regions';
import type {QuestSystem} from '../rpg/QuestSystem';

export type NPCRole='quest'|'merchant'|'smith'|'teleport';
export interface NPCDefinition {id:string;name:string;role:NPCRole;x:number;z:number;model:ModelName;region:string;icon:string;}
export interface NPCCallbacks {
  onForge():void;
  onShop():void;
  onTeleport():void;
  onQuestAccepted(id:string):void;
  onQuestClaimed(id:string):void;
}
const NPCS:readonly NPCDefinition[]=[
  ...REGIONS.flatMap((region,index):NPCDefinition[]=>[
    {id:'guide-'+region.id,name:['Eldrin','Morwen','Alaric','Tharok','Nyx'][index],
      role:'quest',x:region.center.x+3,z:region.center.z+3,model:index%2===0?'KayKit_Knight':'KayKit_Mage',
      region:region.id,icon:'❗'},
    {id:'merchant-'+region.id,name:['Liora','Orin','Ylsa','Varka','Ezra'][index],
      role:'merchant',x:region.center.x-4,z:region.center.z+2,model:'KayKit_Rogue_Hooded',
      region:region.id,icon:'🧪'},
  ]),
  {id:'blacksmith-aster',name:'Brom, o Ferreiro',role:'smith',x:8,z:20,model:'KayKit_Barbarian',region:'aurora',icon:'⚒️'},
  {id:'teleporter-aster',name:'Astra, Guardiã dos Portais',role:'teleport',x:-8,z:16,model:'KayKit_Mage',region:'aurora',icon:'🌀'}
];

interface NPCActor {definition:NPCDefinition;model:AnimatedGLB;position:Vector3;label:HTMLElement;}
export class NPCSystem {
  readonly definitions=NPCS;
  private actors:NPCActor[]=[];
  private readonly button=document.createElement('button');
  private readonly dialog=document.createElement('section');
  private selected:NPCActor|null=null;
  private readonly talkRange=3.5;
  constructor(private readonly scene:Scene,private readonly host:HTMLElement,
    private readonly ground:(x:number,z:number)=>number,
    private readonly quests:QuestSystem,
    private readonly callbacks:NPCCallbacks,
    private readonly lang:()=> 'pt'|'en',private readonly activeRegion?:string){
    for(const def of NPCS){
      if(this.activeRegion&&def.region!==this.activeRegion)continue;
      const home=REGIONS.find(region=>region.id===def.region)!;
      const x=this.activeRegion?def.x-home.center.x:def.x;
      const z=this.activeRegion?def.z-home.center.z+18:def.z;
      const model=new AnimatedGLB(def.model,1.9,()=>{},true);
      const position=new Vector3(x,this.ground(x,z)+.15,z);
      model.root.position.copy(position);
      model.root.rotation.y=Math.PI*.2;
      this.scene.add(model.root);
      const label=document.createElement('div');
      label.className='eterna-npc-label';label.textContent=def.icon;
      label.setAttribute('aria-label',def.name+' '+def.role);
      label.hidden=true;
      this.host.append(label);
      this.actors.push({definition:def,model,position,label});
    }
    this.button.className='eterna-npc-talk';
    this.button.type='button';
    this.button.hidden=true;
    this.button.onclick=()=>{if(this.selected)this.open(this.selected);};
    this.host.append(this.button);
    this.dialog.className='eterna-npc-dialog-backdrop';
    this.dialog.hidden=true;
    this.dialog.setAttribute('aria-label','Diálogo com NPC');
    this.dialog.addEventListener('click',event=>{if(event.target===this.dialog)this.close();});
    this.host.append(this.dialog);
  }
  get blocking():boolean{return !this.dialog.hidden;}
  update(dt:number,camera:PerspectiveCamera,hero:Vector3,active:boolean):void{
    const time=Math.min(.05,Math.max(0,dt));
    let closest:NPCActor|null=null,nearest=this.talkRange;
    const rect=this.host.getBoundingClientRect();
    const point=new Vector3();
    for(const npc of this.actors){
      const distance=Math.hypot(hero.x-npc.position.x,hero.z-npc.position.z);
      const near=distance<52;
      npc.model.root.visible=near;
      if(near)npc.model.update(time,0);
      const screen=point.copy(npc.position).add(new Vector3(0,2.65,0)).project(camera);
      const visible=near&&screen.z>-1&&screen.z<1&&Math.abs(screen.x)<.96&&Math.abs(screen.y)<.96;
      npc.label.hidden=!visible;
      if(visible){
        npc.label.style.left=((screen.x+1)*.5*rect.width)+'px';
        npc.label.style.top=((1-screen.y)*.5*rect.height)+'px';
        const ready=this.quests.all().some(q=>q.npcId===npc.definition.id&&this.quests.progressOf(q).ready);
        npc.label.textContent=ready?'❓':npc.definition.icon;
      }
      if(active&&distance<nearest){closest=npc;nearest=distance;}
    }
    this.selected=closest;
    this.button.hidden=!closest||!active||this.blocking;
    if(closest)this.button.textContent='💬 Conversar com '+closest.definition.name;
  }
  interact(hero:Vector3):boolean{
    let actor:NPCActor|undefined;let best=this.talkRange;
    for(const candidate of this.actors){
      const d=Math.hypot(hero.x-candidate.position.x,hero.z-candidate.position.z);
      if(d<best){best=d;actor=candidate;}
    }
    if(!actor)return false;
    this.open(actor);return true;
  }
  private open(actor:NPCActor):void{
    this.quests.onTalk(actor.definition.id);
    this.selected=actor;
    this.dialog.hidden=false;
    this.renderDialogue();
  }
  private renderDialogue():void{
    const npc=this.selected;
    if(!npc)return;
    const pt=this.lang()==='pt';
    this.dialog.replaceChildren();
    const window=document.createElement('div');
    window.className='eterna-npc-window';
    const title=document.createElement('header');
    const portrait=document.createElement('span');portrait.className='eterna-npc-portrait';
    portrait.textContent=npc.definition.icon;
    const name=document.createElement('div');
    const heading=document.createElement('h2');heading.textContent=npc.definition.name;
    const job=document.createElement('small');job.textContent=npc.definition.role.toUpperCase();
    name.append(heading,job);
    const close=document.createElement('button');close.textContent='✕';close.type='button';close.onclick=()=>this.close();
    title.append(portrait,name,close);
    const line=document.createElement('p');
    line.textContent=pt?'Bem-vindo, aventureiro. O destino de Eterna depende das escolhas que fizer hoje.':
      'Welcome, adventurer. Eterna depends on the choices you make today.';
    const actions=document.createElement('div');actions.className='eterna-npc-actions';
    const action=(label:string,fn:()=>void)=>{
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.onclick=fn;actions.append(button);
    };
    for(const quest of this.quests.all().filter(q=>q.npcId===npc.definition.id)){
      const progress=this.quests.progressOf(quest);
      if(progress.claimed)continue;
      if(progress.ready)action('🎁 '+(pt?'Resgatar: ':'Claim: ')+quest.title,()=>{this.callbacks.onQuestClaimed(quest.id);this.renderDialogue();});
      else if(!progress.accepted)action('❗ '+(pt?'Aceitar: ':'Accept: ')+quest.title,()=>{if(this.quests.accept(quest.id))this.callbacks.onQuestAccepted(quest.id);this.renderDialogue();});
      else action('📜 '+quest.title+' ('+progress.progress+'/'+quest.required+')',()=>{});
    }
    if(npc.definition.role==='smith')action('⚒️ '+(pt?'Abrir Forja':'Open Forge'),()=>{this.close();this.callbacks.onForge();});
    if(npc.definition.role==='merchant')action('🧪 '+(pt?'Abrir Loja':'Open Shop'),()=>{this.close();this.callbacks.onShop();});
    if(npc.definition.role==='teleport')action('🌀 '+(pt?'Mapa-Múndi':'World Portals'),()=>{this.close();this.callbacks.onTeleport();});
    const cancel=document.createElement('button');cancel.textContent=pt?'Fechar':'Close';cancel.onclick=()=>this.close();actions.append(cancel);
    window.append(title,line,actions);this.dialog.append(window);
  }
  close():void{this.dialog.hidden=true;}
  dispose():void{this.close();for(const npc of this.actors){npc.model.dispose();npc.label.remove();}this.actors=[];this.button.remove();this.dialog.remove();}
}
