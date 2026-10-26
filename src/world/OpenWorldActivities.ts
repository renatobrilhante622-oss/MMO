import {Vector3} from 'three';
import type {Combatant,GameEvents} from '../core/GameTypes';
import type {PhysicsWorld} from '../physics/PhysicsWorld';
import type {Enemy,EnemyAI} from '../enemies/EnemyAI';
import type {QuestDefinition,QuestGoal,QuestSystem} from '../rpg/QuestSystem';
import {FieldProgress} from '../rpg/FieldRewards';
import {activityLayout,activitySitesNear,type ActivitySite} from './ActivityLayout';
import {REGIONS} from './Regions';
export type ActivityMode='idle'|'guarding'|'cleared'|'defending'|'active'|'cooldown';
export interface ActivityState {site:ActivitySite;mode:ActivityMode;members:Set<string>;wave:number;started:number;outside:number;token:string;}
export interface FieldCallbacks {
 reward(kind:'elite'|'rift'|'camp'|'massacre',position:Vector3,count?:number,level?:number):void;
 resource(site:ActivitySite,token:string):void;message(text:string):void;board():void;storm(enemies:Enemy[]):void;
}
/** Damageable GLB props participate in the same targeting/skill system as monsters. */
export class FieldDestructible implements Combatant {
 readonly team='enemy' as const;readonly radius=1.2;readonly defense=4;readonly invulnerable=false;
 hp:number;readonly maxHp:number;readonly position:Vector3;
 constructor(readonly id:string,readonly kind:'nest'|'massacre',point:Vector3,level:number,private done:()=>void){this.position=point.clone();this.maxHp=kind==='nest'?70+level*12:40+level*2;this.hp=this.maxHp;}
 get alive():boolean{return this.hp>0;}
 receiveDamage(amount:number):number {if(!this.alive||!Number.isFinite(amount)||amount<=0)return 0;const dealt=Math.min(this.hp,amount);this.hp-=dealt;if(this.hp===0)this.done();return dealt;}
}
/** Local field encounters; only actual members' deaths can advance a wave or unlock a chest. */
export class OpenWorldActivities {
 readonly sites:readonly ActivitySite[];readonly states=new Map<string,ActivityState>();readonly destructibles:FieldDestructible[]=[];
 private nearest:ActivitySite|null=null;private decision=0;private stormClock=0;private disposed=false;
 static readonly MAX_ACTORS=24;
 constructor(readonly region:string,private readonly physics:PhysicsWorld,private readonly enemies:EnemyAI,private readonly quests:QuestSystem,readonly progress:FieldProgress,private readonly callbacks:FieldCallbacks){
  this.sites=activityLayout(region);for(const site of this.sites)this.states.set(site.id,{site,mode:'idle',members:new Set(),wave:0,started:0,outside:0,token:''});
  if(!progress.timers.has(region+'-rift-schedule'))progress.cooldown(region+'-rift-schedule',100);
 }
 get focused():ActivitySite|null{return this.nearest;}
 get activeRift():ActivityState|undefined{return [...this.states.values()].find(s=>s.site.kind==='rift'&&s.mode==='active');}
 get targets():FieldDestructible[]{return this.destructibles.filter(d=>d.alive);}
 state(site:string):ActivityState|undefined{return this.states.get(site);}
 private point(site:ActivitySite):Vector3{return new Vector3(site.x,this.physics.terrainHeight(site.x,site.z)+.5,site.z);}
 private clear(state:ActivityState):void{this.enemies.despawnActivity(state.site.id);state.members.clear();state.mode='idle';state.wave=0;state.outside=0;}
 private wave(state:ActivityState,count:number,elite=false):boolean {
  const population=this.enemies.enemies.filter(e=>e.activity&&e.alive).length;if(population+count>OpenWorldActivities.MAX_ACTORS)return false;
  const region=REGIONS.find(r=>r.id===this.region)!;const points:Vector3[]=[];
  for(let i=0;i<count;i++){
   let point:Vector3|undefined;
   for(let attempt=0;attempt<30;attempt++){const a=i*2.399963+attempt*.4,r=5+attempt*.3,x=state.site.x+Math.cos(a)*r,z=state.site.z+Math.sin(a)*r;if(this.physics.isPositionFree(x,z,elite?1.7:.8)&&points.every(p=>Math.hypot(p.x-x,p.z-z)>2)){point=new Vector3(x,this.physics.terrainHeight(x,z)+1,z);break;}}
   if(!point)return false;points.push(point);
  }
  for(let i=0;i<count;i++){
   const kind=elite&&state.site.kind==='rift'?'golem':region.kinds[(state.site.kind==='captain'?Number(state.site.id.split('-').at(-1)):i)%region.kinds.length],role=state.site.kind==='captain'?'captain':state.site.kind==='rift'?'rift':state.site.kind==='defense'?'defense':'guard';
   const enemy=this.enemies.spawn(kind,points[i],state.site.level,false,{id:state.site.id,kind:role,elite});
   if(elite&&state.site.kind==='rift')enemy.setFieldModel('Quaternius_demon');state.members.add(enemy.id);
  }
  return true;
 }
 private startGuards(state:ActivityState):void {
  if(state.mode!=='idle'||!this.progress.ready(state.site.id))return;
  const count=state.site.kind==='captain'?1:state.site.kind==='camp'?6+state.site.variant:2;
  if(this.wave(state,count,state.site.kind==='captain')){state.mode='guarding';state.token=this.progress.nextId(state.site.id);}
 }
 onKilled(event:GameEvents['kill']):boolean {
  const state=event.activityId?this.states.get(event.activityId):undefined;if(!state||!event.enemyId||!state.members.delete(event.enemyId))return false;
  if(state.site.kind==='captain'){
   this.quests.onActivity('elite',this.region,state.site.id,state.token);this.progress.cooldown(state.site.id,180);state.mode='cooldown';
  }else if(state.mode==='guarding'&&state.members.size===0)state.mode='cleared';
  return true;
 }
 private activateRift(state:ActivityState):boolean {
  if(this.activeRift||!this.progress.ready(state.site.id))return false;
  state.mode='active';state.wave=0;state.started=this.progress.clock;state.token=this.progress.nextId('invasion');
  this.callbacks.message('⚡ FENDA ABISSAL ABERTA '+(state.site.z<18?'AO NORTE!':'AO SUL!'));return true;
 }
 private finish(state:ActivityState,goal:QuestGoal,kind:'rift'|'camp'):void {
  this.quests.onActivity(goal,this.region,state.site.id,state.token);this.callbacks.reward(kind,this.point(state.site),kind==='rift'?5:2,state.site.level);
  this.progress.cooldown(state.site.id,kind==='rift'?180:240);if(kind==='rift')this.progress.cooldown(this.region+'-rift-schedule',150);state.mode='cooldown';state.members.clear();
  this.callbacks.message(kind==='rift'?'Fenda selada! Recolha os tesouros sob os pilares de luz.':'Acampamento limpo! O baú dourado foi aberto.');
 }
 update(dt:number,hero:Combatant):void {
  if(this.disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  if(!hero.alive){for(const state of this.states.values())if(state.mode==='defending'){this.clear(state);this.progress.cooldown(state.site.id,15);}return;}
  for(const state of this.states.values()){
   const distance=Math.hypot(hero.position.x-state.site.x,hero.position.z-state.site.z);
   if(state.mode==='cooldown'&&this.progress.ready(state.site.id))state.mode='idle';
   if(state.mode==='defending'){
    state.outside=distance>14?state.outside+dt:0;
    if(state.outside>2){this.clear(state);this.progress.cooldown(state.site.id,15);this.callbacks.message('Defesa interrompida. Permaneça no círculo do totem.');continue;}
    const elapsed=this.progress.clock-state.started;
    if(!state.members.size&&state.wave<3&&elapsed>=state.wave*15&&this.wave(state,3+state.wave)){state.wave++;}
    if(elapsed>=45&&state.wave===3&&!state.members.size){this.quests.onActivity('defend',this.region,state.site.id,state.token);this.progress.cooldown(state.site.id,180);state.mode='cooldown';this.callbacks.reward('camp',this.point(state.site),1,state.site.level);this.callbacks.message('Totem defendido! Três ondas vencidas.');}
   }
   if(state.mode==='active'){
    if(this.progress.clock-state.started>210){this.clear(state);this.progress.cooldown(state.site.id,60);this.progress.cooldown(this.region+'-rift-schedule',90);this.callbacks.message('A invasão recuou. Prepare-se para a próxima fenda.');continue;}
    if(distance<65&&!state.members.size){
     if(state.wave<3){if(this.wave(state,4+state.wave))state.wave++;}
     else if(state.wave===3){if(this.wave(state,1,true))state.wave=4;}
     else this.finish(state,'rift','rift');
    }
   }
   if(distance>100&&state.mode!=='active'&&state.mode!=='defending'&&state.members.size)this.clear(state);
  }
  if(!this.activeRift&&this.progress.ready(this.region+'-rift-schedule')){const rifts=this.sites.filter(s=>s.kind==='rift'&&this.progress.ready(s.id)),site=rifts[Math.floor(this.progress.clock/150)%Math.max(1,rifts.length)];if(site)this.activateRift(this.states.get(site.id)!);}
  this.stormClock-=dt;if(this.progress.buffActive('storm')&&this.stormClock<=0){this.stormClock=2.5;const targets=this.enemies.enemies.filter(e=>e.alive&&e.position.distanceTo(hero.position)<14).sort((a,b)=>a.hp-b.hp).slice(0,3);if(targets.length)this.callbacks.storm(targets);}
  this.decision-=dt;if(this.decision>0)return;this.decision=.2;this.nearest=null;let closest=3.4;
  for(const site of activitySitesNear(this.region,hero.position.x,hero.position.z,75)){
   const state=this.states.get(site.id)!,distance=Math.hypot(hero.position.x-site.x,hero.position.z-site.z);
   if(['captain','camp','rare'].includes(site.kind)&&distance<55)this.startGuards(state);
   if(site.kind==='nest'&&this.progress.ready(site.id)&&!this.destructibles.some(d=>d.id===site.id&&d.alive)){
    const prop=new FieldDestructible(site.id,'nest',this.point(site),site.level,()=>{this.progress.cooldown(site.id,120);this.quests.onActivity('nest',this.region,site.id,this.progress.nextId('nest'));this.callbacks.reward('camp',this.point(site),1,site.level);});this.destructibles.push(prop);
   }
   if(distance<closest&&site.kind!=='captain'){this.nearest=site;closest=distance;}
  }
  for(let i=this.destructibles.length-1;i>=0;i--){const d=this.destructibles[i];if(!d.alive||d.position.distanceTo(hero.position)>100)this.destructibles.splice(i,1);}
 }
 interact(hero:Combatant,siteId=this.nearest?.id):boolean {
  if(this.disposed||!hero.alive||!siteId)return false;const state=this.states.get(siteId);if(!state||Math.hypot(hero.position.x-state.site.x,hero.position.z-state.site.z)>3.4)return false;
  const site=state.site;if(site.kind==='board'){this.callbacks.board();return true;}
  if(!this.progress.ready(site.id)){this.callbacks.message('Este local está se recuperando. Procure outra atividade.');return true;}
  if(site.kind==='ruin'){this.quests.onActivity('investigate',this.region,site.id);this.progress.cooldown(site.id,30);this.callbacks.message('Inscrições investigadas. A história de Eterna foi revelada.');return true;}
  if(site.kind==='shrine'){const buff=(['speed','critical','storm'] as const)[site.variant];this.progress.activateBuff(buff);this.progress.cooldown(site.id,180);this.callbacks.message(['Santuário: +30% de velocidade por 3 minutos.','Santuário: +25% de dano crítico por 3 minutos.','Santuário: chuva de raios por 3 minutos.'][site.variant]);return true;}
  if(site.kind==='defense'){
   if(state.mode==='defending'){this.callbacks.message('Mantenha o totem! Elimine as ondas e sobreviva 45 segundos.');return true;}
   if(this.wave(state,3)){state.mode='defending';state.wave=1;state.started=this.progress.clock;state.outside=0;state.token=this.progress.nextId('defense');this.callbacks.message('DEFESA INICIADA · 45s · 3 ondas. Não abandone o círculo.');}else this.callbacks.message('Elimine inimigos próximos antes de iniciar outra defesa.');return true;
  }
  if(site.kind==='rift'){
   const q=this.quests.activeStory();if(q?.goal==='rift'&&q.region===this.region)this.activateRift(state);
   this.callbacks.message(state.mode==='active'?'Invasão ativa: vença as três ondas e o demônio.':'A fenda ainda não se abriu.');return true;
  }
  if(site.kind==='camp'||site.kind==='rare'){
   this.startGuards(state);if(state.mode!=='cleared'){this.callbacks.message('Derrote todos os guardas para liberar este tesouro.');return true;}
   if(site.kind==='camp')this.finish(state,'camp','camp');else{this.callbacks.resource(site,state.token);this.progress.cooldown(site.id,60);state.mode='cooldown';}return true;
  }
  if(site.kind==='nest')this.callbacks.message('Destrua o ninho com ataque básico ou habilidades.');return true;
 }
 spawnMassacre(hero:Combatant&{facing?:Vector3}):void {
  const forward=hero.facing??new Vector3(0,0,-1),base=Math.atan2(forward.x,forward.z);let point:Vector3|undefined;
  for(let i=0;i<16;i++){const a=base+i*.4,x=hero.position.x+Math.sin(a)*4,z=hero.position.z+Math.cos(a)*4;if(this.physics.isPositionFree(x,z)){point=new Vector3(x,this.physics.terrainHeight(x,z)+.5,z);break;}}
  if(!point)return;const chosen=point,level=[...this.sites].sort((a,b)=>Math.hypot(a.x-hero.position.x,a.z-hero.position.z)-Math.hypot(b.x-hero.position.x,b.z-hero.position.z))[0]?.level??1;this.destructibles.push(new FieldDestructible(this.progress.nextId('massacre'),'massacre',point,level,()=>this.callbacks.reward('massacre',chosen,2,level)));this.callbacks.message('🔥 BAÚ DE MASSACRE! Destrua-o para receber o tesouro.');
 }
 objectivePoint(q:QuestDefinition,hero:Vector3):ActivitySite|undefined {
  const kinds:Partial<Record<QuestGoal,ActivitySite['kind']>>={investigate:'ruin',rareCollect:'rare',defend:'defense',elite:'captain',camp:'camp',rift:'rift',nest:'nest',core:'captain'};
  if(q.goal==='rift'&&this.activeRift)return this.activeRift.site;
  return this.sites.filter(s=>s.kind===kinds[q.goal]&&(q.goal!=='investigate'||s.id===q.target)&&!this.quests.activityCredited(q.id,s.id)&&this.progress.ready(s.id)).sort((a,b)=>Math.hypot(a.x-hero.x,a.z-hero.z)-Math.hypot(b.x-hero.x,b.z-hero.z))[0];
 }
 dispose():void{if(this.disposed)return;this.disposed=true;for(const s of this.states.values())this.enemies.despawnActivity(s.site.id);this.states.clear();this.destructibles.length=0;this.nearest=null;}
}
