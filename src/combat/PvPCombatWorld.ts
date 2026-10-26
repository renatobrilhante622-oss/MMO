import {CLASS_DEFINITIONS} from './ClassSystem';
import {PvPAIController} from './PvPAIController';
import {ARENA_RADIUS,arenaLineOfSight,arenaObstacles,arenaSpawn,neutralPvPInput,type PvPProfile,type PvPInput,type PvPMatch,type ArenaSize,type PvPFighter} from './PvPTypes';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Server-owned deterministic 30Hz simulation. No client-supplied health, damage or position. */
export class PvPCombatWorld {
 readonly match:PvPMatch;
 private inputs=new Map<string,{value:PvPInput;age:number}>();
 private sequences=new Map<string,number>();
 private contributors=new Map<string,Set<string>>();
 private buffs=new Map<string,number>();
 private ai=new PvPAIController();private effectId=0;
 constructor(id:string,size:ArenaSize,profiles:Array<PvPProfile&{team:0|1}>,now:number){
  const baseline=profiles.reduce((n,p)=>n+p.cp,0)/profiles.length,indices=[0,0];
  const fighters=profiles.map(p=>{const def=CLASS_DEFINITIONS[p.classId],spawn=arenaSpawn(p.team,indices[p.team]++,size),ratio=clamp(p.cp/baseline,.92,1.08);
   const maxHp=Math.round((1100+def.stats.maxHp*2)*ratio),maxMana=def.stats.maxMana;
   return {...p,...spawn,maxHp,hp:maxHp,mana:maxMana,maxMana,facingX:0,facingZ:p.team===0?-1:1,cooldowns:[0,0,0,0],basicCd:0,dashCd:0,dashLeft:0,potionCd:0,potions:2,stun:0,state:'idle',damage:0,kills:0,assists:0,healing:0,lastAction:0,lastSkill:null} as PvPFighter;});
  this.match={id,size,phase:'found',fighters,accepted:profiles.filter(p=>p.bot).map(p=>p.id),ready:[],deadline:now+3000,remaining:180,winner:null,reason:'',ranked:profiles.every(p=>!p.bot),obstacles:arenaObstacles(),telegraphs:[],rune:{active:false,next:30,kind:'heal'},results:[],tick:0};
 }
 input(id:string,raw:unknown):boolean {
  if(this.match.phase!=='active'||!raw||typeof raw!=='object')return false;
  const v=raw as Record<string,unknown>,f=this.match.fighters.find(f=>f.id===id&&!f.bot);
  if(!f||f.hp<=0||!Number.isSafeInteger(v.seq)||(v.seq as number)<0||(v.seq as number)<=(this.sequences.get(id)??-1))return false;
  if(!['moveX','moveZ','aimX','aimZ'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])))return false;
  const axis=(x:number,z:number)=>{const length=Math.max(1,Math.hypot(x,z));return [x/length,z/length];};
  const [moveX,moveZ]=axis(clamp(v.moveX as number,-1,1),clamp(v.moveZ as number,-1,1));
  const [aimX,aimZ]=axis(clamp(v.aimX as number,-1,1),clamp(v.aimZ as number,-1,1));
  const input:PvPInput={seq:v.seq as number,moveX,moveZ,aimX,aimZ,attack:v.attack===true,dash:v.dash===true,skill:Number.isInteger(v.skill)&&(v.skill as number)>=0&&(v.skill as number)<4?v.skill as number:null,potion:v.potion==='hp'||v.potion==='mana'?v.potion:null};
  const pending=this.inputs.get(id);if(pending&&pending.age<.5){input.skill=input.skill??pending.value.skill;input.dash=input.dash||pending.value.dash;input.potion=input.potion??pending.value.potion;}
  this.sequences.set(id,input.seq);this.inputs.set(id,{value:input,age:0});return true;
 }
 step(dt:number):void {
  if(this.match.phase!=='active')return;
  dt=clamp(Number.isFinite(dt)?dt:0,0,1/30);if(!dt)return;
  const m=this.match;m.tick++;m.remaining=Math.max(0,m.remaining-dt);
  for(const [id,time]of this.buffs)this.buffs.set(id,Math.max(0,time-dt));
  for(const f of m.fighters){
   f.cooldowns=f.cooldowns.map(c=>Math.max(0,c-dt));for(const key of ['basicCd','dashCd','potionCd','stun'] as const)f[key]=Math.max(0,f[key]-dt);
   if(f.hp<=0){f.state='dead';continue;}
   f.mana=Math.min(f.maxMana,f.mana+dt*5);
   const stored=this.inputs.get(f.id);if(stored)stored.age+=dt;
   const input=f.bot?this.ai.decide(f,m):stored&&stored.age<.5?stored.value:neutralPvPInput();
   this.act(f,input,dt);
   // Actions are edge-triggered, unlike held movement and basic attacks.
   if(stored){stored.value.skill=null;stored.value.dash=false;stored.value.potion=null;}
  }
  for(const t of [...m.telegraphs]){t.delay-=dt;if(t.delay>0)continue;
   const owner=m.fighters.find(f=>f.id===t.owner)!;
   for(const target of m.fighters)if(target.team!==t.team&&target.hp>0&&Math.hypot(target.x-t.x,target.z-t.z)<=t.radius+.45&&arenaLineOfSight(owner,target,m.obstacles))this.hit(owner,target,t.damage,t.skill);
   for(const o of m.obstacles)if(o.hp>0&&Math.hypot(o.x-t.x,o.z-t.z)<=t.radius+o.radius)o.hp=Math.max(0,o.hp-t.damage);
   m.telegraphs=m.telegraphs.filter(e=>e.id!==t.id);
  }
  m.rune.next=Math.max(0,m.rune.next-dt);
  if(m.rune.next<=0&&!m.rune.active){m.rune.active=true;m.rune.next=30;}
  if(m.rune.active){const taker=m.fighters.filter(f=>f.hp>0&&Math.hypot(f.x,f.z)<1.7).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(taker){if(m.rune.kind==='heal')this.heal(taker,taker,taker.maxHp*.25);else this.buffs.set(taker.id,10);m.rune.active=false;m.rune.kind=m.rune.kind==='heal'?'power':'heal';m.rune.next=30;}}
  const alive=[0,1].map(team=>m.fighters.some(f=>f.team===team&&f.hp>0));
  if(!alive[0]||!alive[1]||m.remaining<=0){
   const totals=[0,1].map(team=>m.fighters.filter(f=>f.team===team).reduce((n,f)=>n+f.hp/f.maxHp,0));
   m.winner=Math.abs(totals[0]-totals[1])<.0001?null:totals[0]>totals[1]?0:1;
   m.reason=m.remaining<=0?'time':'elimination';m.phase='ended';
  }
 }
 private act(f:PvPFighter,input:PvPInput,dt:number):void {
  const m=this.match,def=CLASS_DEFINITIONS[f.classId];f.state='idle';
  if(f.stun>0)return;
  if(Math.hypot(input.aimX,input.aimZ)>.1){const l=Math.hypot(input.aimX,input.aimZ);f.facingX=input.aimX/l;f.facingZ=input.aimZ/l;}
  if(input.dash&&f.dashCd<=0){f.dashCd=3;f.dashLeft=.22;if(Math.hypot(input.moveX,input.moveZ)>.1){const l=Math.hypot(input.moveX,input.moveZ);f.facingX=input.moveX/l;f.facingZ=input.moveZ/l;}}
  const dashStep=Math.min(dt,f.dashLeft);f.dashLeft=Math.max(0,f.dashLeft-dt);
  const speed=clamp(def.stats.speed,5.7,8),dx=input.moveX*speed*(dt-dashStep)+f.facingX*4/.22*dashStep,dz=input.moveZ*speed*(dt-dashStep)+f.facingZ*4/.22*dashStep;
  if(Math.hypot(dx,dz)>0){f.state=dashStep?'dash':'run';this.move(f,dx,dz);}
  if(input.potion&&f.potions>0&&f.potionCd<=0){f.potions--;f.potionCd=12;if(input.potion==='hp')this.heal(f,f,f.maxHp*.34);else f.mana=Math.min(f.maxMana,f.mana+f.maxMana*.5);}
  const targets=m.fighters.filter(t=>t.team!==f.team&&t.hp>0).sort((a,b)=>Math.hypot(a.x-f.x,a.z-f.z)-Math.hypot(b.x-f.x,b.z-f.z));
  const target=targets.find(t=>arenaLineOfSight(f,t,m.obstacles));
  if(input.skill!==null&&f.cooldowns[input.skill]<=0){const index=input.skill,s=def.skills[index];if(f.mana>=s.mana){
   f.mana-=s.mana;f.cooldowns[index]=s.cooldown;f.state='cast';f.lastAction++;f.lastSkill=index;
   if(s.heal)for(const ally of m.fighters.filter(a=>a.team===f.team&&a.hp>0&&Math.hypot(a.x-f.x,a.z-f.z)<=Math.max(5,s.radius)))this.heal(f,ally,ally.maxHp*s.heal*.65);
   const reach=s.shape==='circle'?s.radius:s.range;
   const point=s.shape==='circle'?f:target&&Math.hypot(target.x-f.x,target.z-f.z)<=reach?target:{x:f.x+f.facingX*reach,z:f.z+f.facingZ*reach};
   m.telegraphs.push({id:++this.effectId,owner:f.id,team:f.team,x:point.x,z:point.z,radius:s.shape==='cone'?Math.min(s.radius,4):s.radius,delay:s.shape==='projectile'?.3+Math.hypot(point.x-f.x,point.z-f.z)/35:.45,damage:this.damage(f)*s.multiplier*.65,skill:index,color:s.color});
  }}
  if(input.attack&&f.basicCd<=0&&target&&Math.hypot(target.x-f.x,target.z-f.z)<=Math.min(19,def.stats.range+1)){
   f.basicCd=1/Math.min(2.2,def.stats.attackSpeed);f.state='attack';f.lastAction++;f.lastSkill=null;
   f.facingX=(target.x-f.x)/Math.max(.01,Math.hypot(target.x-f.x,target.z-f.z));f.facingZ=(target.z-f.z)/Math.max(.01,Math.hypot(target.x-f.x,target.z-f.z));
   this.hit(f,target,this.damage(f),null);
  }
 }
 private damage(f:PvPFighter):number{return (80+CLASS_DEFINITIONS[f.classId].stats.attack)*((this.buffs.get(f.id)??0)>0?1.2:1);}
 private move(f:PvPFighter,dx:number,dz:number):void {
  const valid=(x:number,z:number)=>Math.hypot(x,z)<=ARENA_RADIUS-.6&&!this.match.obstacles.some(o=>o.hp>0&&Math.hypot(x-o.x,z-o.z)<o.radius+.5);
  if(valid(f.x+dx,f.z))f.x+=dx;if(valid(f.x,f.z+dz))f.z+=dz;
 }
 private heal(owner:PvPFighter,target:PvPFighter,amount:number):void {const healed=Math.max(0,Math.min(target.maxHp-target.hp,amount));target.hp+=healed;owner.healing+=healed;}
 private hit(owner:PvPFighter,target:PvPFighter,amount:number,skill:number|null):void {
  if(target.dashLeft>0||target.hp<=0)return;
  const damage=Math.min(target.hp,Math.round(amount*100/(100+CLASS_DEFINITIONS[target.classId].stats.defense)));target.hp-=damage;owner.damage+=damage;
  let set=this.contributors.get(target.id);if(!set){set=new Set();this.contributors.set(target.id,set);}set.add(owner.id);
  if(skill===0&&CLASS_DEFINITIONS[owner.classId].stats.range<10)target.stun=.3;
  if(target.hp<=0){target.state='dead';owner.kills++;for(const id of set)if(id!==owner.id){const assist=this.match.fighters.find(f=>f.id===id);if(assist)assist.assists++;}this.contributors.delete(target.id);}
 }
 forfeit(id:string):void{const f=this.match.fighters.find(f=>f.id===id);if(f&&f.hp>0){f.hp=0;f.state='dead';}}
 snapshot():PvPMatch{return structuredClone(this.match);}
}
