import type {QuestSystem,QuestDefinition} from '../rpg/QuestSystem';
export interface TrackerCallbacks {
  navigate(quest:QuestDefinition):void;
  claim(questId:string):void;
}
export class QuestTrackerHUD{
  readonly root=document.createElement('aside');
  private readonly title=document.createElement('strong');
  private readonly detail=document.createElement('span');
  private readonly progress=document.createElement('div');
  private readonly meter=document.createElement('i');
  private readonly button=document.createElement('button');
  private selected='';
  constructor(private readonly host:HTMLElement,private readonly quests:QuestSystem,
              private readonly callbacks:TrackerCallbacks){
    this.root.className='eterna-quest-tracker';
    this.root.setAttribute('aria-label','Missão ativa');
    this.title.className='quest-tracker-title';
    this.detail.className='quest-tracker-text';
    this.progress.className='quest-tracker-bar';
    this.progress.append(this.meter);
    this.button.type='button';this.button.className='quest-tracker-action';
    this.button.onclick=()=>{
      const quest=this.quests.active();if(!quest)return;
      const state=this.quests.progressOf(quest);
      if(state.ready)this.callbacks.claim(quest.id);
      else this.callbacks.navigate(quest);
    };
    this.root.append(this.title,this.detail,this.progress,this.button);
    host.append(this.root);
    this.refresh();
  }
  refresh():void{
    const quest=this.quests.active();
    this.root.hidden=!quest;
    if(!quest)return;
    const state=this.quests.progressOf(quest);
    this.selected=quest.id;
    this.title.textContent='✦ '+quest.title;
    this.detail.textContent=quest.description+' ('+state.progress+'/'+quest.required+')';
    this.meter.style.width=(state.progress/quest.required*100)+'%';
    this.button.textContent=state.ready?'🎁 RESGATAR RECOMPENSA':'✦ NAVEGAR PARA OBJETIVO';
    this.button.classList.toggle('can-claim',state.ready);
    this.button.setAttribute('aria-label',state.ready?'Resgatar recompensa da missão':'Navegar até o objetivo da missão');
  }
  dispose():void{this.root.remove();}
}
