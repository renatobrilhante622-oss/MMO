import {expandedCampaign} from './Campaign';
import {makeContract} from './BountyBoard';
import {Vector3} from 'three';
import type {Item,Rarity} from '../core/GameTypes';
import {COMPLETE_ITEM_CATALOG,scaleWorldItem,type InventoryAndLoot} from './InventoryAndLoot';
import type {AdventureProgress} from '../progression/AdventureProgress';
import {REGIONS} from '../world/Regions';
import {REGION_REWARDS} from '../world/RegionTravel';

export type QuestCategory='story'|'side'|'bounty'|'milestone'|'contract';
export type QuestGoal='talk'|'kill'|'boss'|'visit'|'level'|'refine'|'wing'|'mount'|'collect'|'investigate'|'rareCollect'|'defend'|'elite'|'camp'|'rift'|'nest'|'core';
export interface QuestDefinition {
  id:string;category:QuestCategory;region:string;
  title:string;description:string;goal:QuestGoal;target:string;required:number;
  reward:{xp:number;gold:number;crystals:number;tickets:number;passXp:number;materials?:number;itemRarity?:Rarity;skinFragments?:number;skinChests?:number;refinementStones?:number;wardrobeSource?:'contract'};
  npcId?:string;act?:number;actName?:string;rank?:'C'|'B'|'A'|'S'|'SS';serial?:number;
}
export interface QuestProgress {
  quest:QuestDefinition;progress:number;ready:boolean;claimed:boolean;accepted:boolean;
}
const reward=(xp:number,gold:number,crystals=0,tickets=0,passXp=0,itemRarity?:Rarity)=>({xp,gold,crystals,tickets,passXp,itemRarity});
const STORY:QuestDefinition[]=expandedCampaign();
const SIDES:QuestDefinition[]=REGIONS.map((region,index)=>({
  id:'side-'+region.id,category:'side',region:region.id,
  title:'Contrato local — '+region.name[0],description:'Ajude o acampamento a controlar os monstros.',
  goal:'kill',target:region.kinds[region.kinds.length-1],required:8+index*2,
  reward:reward(250+index*550,300+index*800,2+index,0,65),
  npcId:'merchant-'+region.id,
}));
const MILESTONES:QuestDefinition[]=[
  {id:'milestone-weapon-10',category:'milestone',region:'aurora',title:'Mestre Ferreiro',description:'Refine uma arma até +10.',goal:'refine',target:'weapon',required:10,reward:reward(4000,7000,15,1,200)},
  {id:'milestone-wing-5',category:'milestone',region:'crypt',title:'Ascensão Alada',description:'Evolua uma asa ao nível 5.',goal:'wing',target:'wing',required:5,reward:reward(2500,5000,10,1,180)},
  {id:'milestone-mount',category:'milestone',region:'aurora',title:'Domador de Lendas',description:'Desbloqueie e utilize uma montaria.',goal:'mount',target:'mount',required:1,reward:reward(800,1200,3,0,80)},
  {id:'milestone-level-50',category:'milestone',region:'highlands',title:'Veterano de Eterna',description:'Alcance o nível 50.',goal:'level',target:'level',required:50,reward:reward(5000,10000,25,2,250)},
];
export const QUEST_STORY:readonly QuestDefinition[]=STORY;
export const QUEST_SIDE:readonly QuestDefinition[]=SIDES;
export const QUEST_MILESTONES:readonly QuestDefinition[]=MILESTONES;
const valid=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=1000000;
const dailyId=(date:Date)=>[date.getUTCFullYear(),String(date.getUTCMonth()+1).padStart(2,'0'),String(date.getUTCDate()).padStart(2,'0')].join('-');

/** Offline PvE objectives only. Online money and accounts never trust quest state. */
export class QuestSystem {
  private readonly counters=new Map<string,number>();
  private readonly accepted=new Set<string>();
  private readonly claimed=new Set<string>();
  private readonly listeners=new Set<()=>void>();
  subscribe(listener:()=>void):()=>void {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  private changed():void{for(const listener of this.listeners)listener();}
  private storyIndex=0;
  private readonly contractSerial:Record<string,number>={};
  private tracked='';private readonly unique=new Map<string,Set<string>>();
  onReward:((reward:QuestDefinition['reward'])=>void)|null=null;
  contract(region:string):QuestDefinition{return makeContract(region,this.contractSerial[region]??0);}
  track(id:string):boolean{const q=this.get(id);if(!q||!this.isAccepted(id)||this.claimed.has(id))return false;this.tracked=id;this.changed();return true;}
  bossAvailable(region:string):boolean{return this.regionComplete(region)||this.activeStory()?.id==='story-'+region+'-boss';}
  activityCredited(id:string,source:string):boolean{return this.unique.get(id)?.has(source)??false;}
  onActivity(goal:QuestGoal,region:string,source:string,occurrence=source):void {
    if(!['investigate','rareCollect','defend','elite','camp','rift','nest','core'].includes(goal)||!source||source.length>160)return;
    for(const q of this.all()){
      if(q.goal!==goal||q.region!==region||!this.isAccepted(q.id)||this.claimed.has(q.id))continue;
      if(goal==='investigate'&&q.target!==source)continue;
      let seen=this.unique.get(q.id);if(!seen){seen=new Set();this.unique.set(q.id,seen);}const key=q.category==='story'?source:occurrence;if(seen.has(key)||seen.size>=q.required)continue;
      seen.add(key);this.counters.set(q.id,Math.min(q.required,(this.counters.get(q.id)??0)+1));this.changed();
    }
  }
  contractGoldBonus=0;
  private currentDay='';
  private readonly daily:QuestDefinition[]=[];
  constructor(private readonly inventory:InventoryAndLoot,private readonly progress:AdventureProgress,now=new Date()){
    this.refreshDaily(now);
  }
  refreshDaily(now=new Date()):void{
    const day=dailyId(now);
    if(day===this.currentDay)return;
    this.currentDay=day;
    this.daily.length=0;
    const eligible=REGIONS.filter(region=>region.minLevel<=this.inventory.level);
    for(let i=0;i<5;i++){
      const region=eligible[i%Math.max(1,eligible.length)]??REGIONS[0];
      const target=region.kinds[i%region.kinds.length];
      const id='bounty-'+day+'-'+i;
      this.daily.push({id,category:'bounty',region:region.id,title:'Caçada '+(i+1)+' — '+region.name[0],
        description:'Abata '+target+' em '+region.name[0]+'.',goal:'kill',target,required:4+i*2,
        reward:reward(140+region.minLevel*10,220+region.minLevel*20,1+Math.floor(i/2),i===4?1:0,35+i*10)});
      this.accepted.add(id);
    }
    for(const key of this.counters.keys())if(key.startsWith('bounty-')&&!key.includes(day))this.counters.delete(key);
    for(const key of this.accepted)if(key.startsWith('bounty-')&&!key.includes(day))this.accepted.delete(key);
    for(const key of this.claimed)if(key.startsWith('bounty-')&&!key.includes(day))this.claimed.delete(key);
  }
  all():readonly QuestDefinition[]{return [...STORY,...SIDES,...this.daily,...MILESTONES,...REGIONS.map(r=>this.contract(r.id))];}
  activeStory():QuestDefinition|undefined{return STORY[this.storyIndex];}
  active():QuestDefinition|undefined{
    if(this.tracked){const q=this.get(this.tracked);if(q&&this.isAccepted(q.id)&&!this.claimed.has(q.id))return q;this.tracked='';}
    const story=this.activeStory();
    if(story)return story;
    return this.all().find(q=>q.category!=='story'&&this.accepted.has(q.id)&&!this.claimed.has(q.id));
  }
  get(id:string):QuestDefinition|undefined{return this.all().find(q=>q.id===id);}
  isAccepted(id:string):boolean{return this.accepted.has(id)||this.activeStory()?.id===id||MILESTONES.some(q=>q.id===id);}
  accept(id:string):boolean{
    const quest=this.get(id);
    if(!quest||quest.category==='story'||this.claimed.has(id))return false;
    if(quest.category==='contract'?!this.canEnterRegion(quest.region):this.inventory.level<REGIONS.find(r=>r.id===quest.region)!.minLevel)return false;
    this.accepted.add(id);this.changed();return true;
  }
  progressOf(quest:QuestDefinition):QuestProgress{
    const accepted=this.isAccepted(quest.id);
    const n=Math.min(quest.required,this.counters.get(quest.id)??0);
    return {quest,progress:n,ready:accepted&&n>=quest.required,claimed:this.claimed.has(quest.id),accepted};
  }
  private signal(goal:QuestGoal,target:string,region?:string,count=1):void{
    for(const quest of this.all()){
      if(!this.isAccepted(quest.id)||this.claimed.has(quest.id)||quest.goal!==goal||quest.target!==target)continue;
      if(region&&quest.region!==region)continue;
      const before=this.counters.get(quest.id)??0,next=Math.min(quest.required,before+count);this.counters.set(quest.id,next);if(before!==next)this.changed();
    }
  }
  regionComplete(region:string):boolean{const quests=STORY.filter(q=>q.region===region);return quests.length>0&&quests.every(q=>this.claimed.has(q.id));}
  allMainQuestsDone(region:string):boolean{const quests=STORY.filter(q=>q.region===region);return quests.length>0&&quests.every(q=>this.claimed.has(q.id)||this.progressOf(q).ready);}
  canEnterRegion(region:string):boolean{
    const i=REGIONS.findIndex(r=>r.id===region);return i===0||i>0&&REGIONS.slice(0,i).every(r=>this.allMainQuestsDone(r.id));
  }
  onCollect(region:string,count=1):void{if(Number.isInteger(count)&&count>0)this.signal('collect','resource',region,count);}
  onTalk(id:string):void{this.signal('talk',id);}
  onKill(kind:string,region:string,boss=false):void{
    if(boss)this.signal('boss',region);
    else this.signal('kill',kind,region);
  }
  onVisit(region:string):void{this.signal('visit',region);}
  updateMilestones(level:number,refinedWeapon:number,wingLevel:number,hasMount:boolean):void{
    const checks:[QuestGoal,string,number][]=[['level','level',level],['refine','weapon',refinedWeapon],['wing','wing',wingLevel],['mount','mount',hasMount?1:0]];
    for(const [goal,target,value]of checks){
      for(const quest of MILESTONES)if(quest.goal===goal&&quest.target===target)
        this.counters.set(quest.id,Math.min(quest.required,Math.max(this.counters.get(quest.id)??0,value)));
    }
  }
  claim(id:string):boolean{
    const quest=this.get(id);
    if(!quest||!this.progressOf(quest).ready||this.claimed.has(id))return false;
    this.claimed.add(id);
    this.inventory.gold+=Math.round(quest.reward.gold*(quest.category==='contract'?1+Math.min(.2,Math.max(0,this.contractGoldBonus)):1));
    this.inventory.crystals+=quest.reward.crystals;
    this.inventory.addXp(quest.reward.xp);
    this.progress.tickets+=quest.reward.tickets;
    this.progress.passXp+=quest.reward.passXp;
    this.progress.materials+=quest.reward.materials??0;
    this.onReward?.(quest.reward);
    if(quest.reward.itemRarity){
      const source=COMPLETE_ITEM_CATALOG.find(item=>item.rarity===quest.reward.itemRarity&&item.slot==='weapon');
      if(source){
        const item:Item={...scaleWorldItem(source,REGIONS.find(r=>r.id===quest.region)!.maxLevel),
          id:'quest-reward-'+quest.id,name:quest.title+' — '+source.name};
        this.inventory.addLoot({id:'quest-drop-'+quest.id,position:new Vector3(),
          xp:0,gold:0,crystals:0,item});
      }
    }
    if(quest.category==='story'){
      this.storyIndex++;while(this.storyIndex<STORY.length&&this.claimed.has(STORY[this.storyIndex].id))this.storyIndex++;
      if(quest.goal==='boss'){
        const index=REGIONS.findIndex(r=>r.id===quest.region);
        const next=REGIONS[index+1];
        if(next&&!this.progress.unlockedRegions.includes(next.id))this.progress.unlockedRegions.push(next.id);
      }
    }
    if(quest.category==='contract'){
      this.contractSerial[quest.region]=(quest.serial??0)+1;this.accepted.delete(id);this.claimed.delete(id);this.counters.delete(id);this.unique.delete(id);if(this.tracked===id)this.tracked='';
    }
    this.changed();return true;
  }
  snapshot():Record<string,unknown>{
    return {schema:3,contractSerial:{...this.contractSerial},tracked:this.tracked,unique:Object.fromEntries([...this.unique].map(([id,values])=>[id,[...values]])),storyIndex:this.storyIndex,day:this.currentDay,
      counters:Object.fromEntries(this.counters),accepted:[...this.accepted],claimed:[...this.claimed]};
  }
  restore(data:unknown):void{
    if(!data||typeof data!=='object'||Array.isArray(data))return;
    const raw=data as Record<string,unknown>;
    if(raw.contractSerial&&typeof raw.contractSerial==='object')for(const r of REGIONS){const n=(raw.contractSerial as Record<string,unknown>)[r.id];if(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=1e9)this.contractSerial[r.id]=n as number;}
    const ids=new Set(this.all().map(q=>q.id));
    if(Array.isArray(raw.accepted))for(const id of raw.accepted)if(typeof id==='string'&&ids.has(id))this.accepted.add(id);
    if(Array.isArray(raw.claimed))for(const id of raw.claimed)if(typeof id==='string'&&ids.has(id))this.claimed.add(id);
    if(raw.schema!==2&&raw.schema!==3){
      const oldStory=STORY.filter(q=>['talk','kill','boss'].includes(q.goal));
      const oldIndex=valid(raw.storyIndex)?Math.min(oldStory.length,Number(raw.storyIndex)):0;
      for(const q of oldStory.slice(0,oldIndex))this.claimed.add(q.id);
      for(const r of REGIONS)if(this.claimed.has('story-'+r.id+'-boss'))this.claimed.add('story-'+r.id+'-gather');
    }
    if(raw.schema!==3)for(const r of REGIONS)if(this.claimed.has('story-'+r.id+'-boss'))for(const q of STORY.filter(q=>q.region===r.id))this.claimed.add(q.id);
    this.storyIndex=0;while(this.storyIndex<STORY.length&&this.claimed.has(STORY[this.storyIndex].id))this.storyIndex++;
    if(raw.counters&&typeof raw.counters==='object'&&!Array.isArray(raw.counters))
      for(const [id,value]of Object.entries(raw.counters))if(ids.has(id)&&valid(value))this.counters.set(id,value as number);
    if(raw.unique&&typeof raw.unique==='object')for(const q of this.all()){const list=(raw.unique as Record<string,unknown>)[q.id];if(Array.isArray(list))this.unique.set(q.id,new Set(list.filter((v):v is string=>typeof v==='string'&&v.length<=160).slice(0,q.required)));}
    if(typeof raw.tracked==='string'&&ids.has(raw.tracked))this.tracked=raw.tracked;
    this.changed();
  }
}
