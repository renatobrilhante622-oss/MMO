import type {QuestSystem,QuestDefinition} from '../rpg/QuestSystem';
export interface TrackerCallbacks {navigate(quest:QuestDefinition):void;claim(questId:string):void;}
/** Compact quest dock; dropping or expanding notifications cannot cover HP/gold. */
export class QuestTrackerHUD{
  readonly root=document.createElement('aside');
  private readonly heading=document.createElement('div');
  private readonly collapse=document.createElement('button');
  private readonly title=document.createElement('strong');
  private readonly detail=document.createElement('span');
  private readonly progress=document.createElement('div');
  private readonly meter=document.createElement('i');
  private readonly button=document.createElement('button');
  private readonly content=document.createElement('div');
  private collapsed=false;
  constructor(private readonly host:HTMLElement,private readonly quests:QuestSystem,
      private readonly callbacks:TrackerCallbacks){
    this.root.className='eterna-quest-tracker';
    this.root.setAttribute('aria-label','Missão ativa');
    this.heading.className='quest-tracker-heading';
    this.collapse.type='button';
    this.collapse.className='quest-tracker-collapse';
    this.collapse.textContent='▾';
    this.collapse.setAttribute('aria-label','Recolher painel de missão');
    this.collapse.setAttribute('aria-expanded','true');
    this.collapse.onclick=()=>{
      this.collapsed=!this.collapsed;
      this.content.hidden=this.collapsed;
      this.root.classList.toggle('is-collapsed',this.collapsed);
      this.collapse.textContent=this.collapsed?'▸':'▾';
      this.collapse.setAttribute('aria-expanded',String(!this.collapsed));
      this.collapse.setAttribute('aria-label',this.collapsed?'Expandir painel de missão':'Recolher painel de missão');
    };
    const marker=document.createElement('span');marker.textContent='✦';marker.className='quest-tracker-marker';
    this.heading.append(marker,this.title,this.collapse);
    this.title.className='quest-tracker-title';
    this.detail.className='quest-tracker-text';
    this.progress.className='quest-tracker-bar';
    this.progress.append(this.meter);
    this.button.type='button';this.button.className='quest-tracker-action';
    this.button.onclick=()=>{
      const quest=this.quests.active();if(!quest)return;
      const state=this.quests.progressOf(quest);
      if(state.ready)this.callbacks.claim(quest.id);else this.callbacks.navigate(quest);
    };
    this.content.className='quest-tracker-body';
    this.content.append(this.detail,this.progress,this.button);
    this.root.append(this.heading,this.content);
    host.append(this.root);
    this.refresh();
  }
  refresh():void{
    const quest=this.quests.active();
    this.root.hidden=!quest;
    if(!quest)return;
    const state=this.quests.progressOf(quest);
    this.title.textContent=quest.title;
    this.detail.textContent=quest.description+' ('+state.progress+'/'+quest.required+')';
    this.meter.style.width=(state.progress/Math.max(1,quest.required)*100)+'%';
    this.button.textContent=state.ready?'🎁 RESGATAR RECOMPENSA':'⌖ NAVEGAR PARA OBJETIVO';
    this.button.classList.toggle('can-claim',state.ready);
    this.button.setAttribute('aria-label',state.ready?'Resgatar recompensa da missão':'Navegar até o objetivo da missão');
  }
  dispose():void{this.root.remove();}
}
