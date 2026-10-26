import {CLASS_IDS} from './ClassSystem';
import {PvPCombatWorld} from './PvPCombatWorld';
import type {ArenaSize,PvPProfile,PvPView,PvPResult} from './PvPTypes';
interface Entry {profile:PvPProfile;size:ArenaSize;since:number;seen:number;}
interface Session {world:PvPCombatWorld;last:number;seen:Map<string,number>;rewarded:boolean;finished:number;}
/** The server supplies trusted profiles and applies payouts. Bots never become online accounts. */
export class PvPMatchmaking {
 private queue=new Map<string,Entry>();private sessions=new Map<string,Session>();private membership=new Map<string,string>();private serial=0;
 constructor(private readonly now:()=>number=Date.now,private readonly reward:(id:string,result:PvPResult)=>void=()=>{},private readonly random:()=>number=Math.random){}
 get occupied():number{return this.membership.size+this.queue.size;}
 busy(id:string):boolean{return this.queue.has(id)||this.membership.has(id);}
 enqueue(profile:PvPProfile,size:unknown):void {
  if(size!==1&&size!==2&&size!==3)throw Error('Escolha 1v1, 2v2 ou 3v3.');
  if(this.membership.has(profile.id))throw Error('Finalize ou retorne da partida atual.');
  if(this.queue.size>=500)throw Error('Fila cheia.');
  if(!Number.isFinite(profile.cp)||profile.cp<=0||!Number.isInteger(profile.level)||profile.level<1||!CLASS_IDS.includes(profile.classId)||profile.bot)throw Error('Perfil de arena inválido.');
  const previous=this.queue.get(profile.id);if(previous?.size===size)return;
  this.queue.set(profile.id,{profile:{...profile},size,since:this.now(),seen:this.now()});this.pair();
 }
 cancel(id:string):void {
  this.queue.delete(id);const s=this.session(id);if(!s)return;
  if(['found','loading'].includes(s.world.match.phase)){s.world.match.phase='cancelled';s.world.match.reason='declined';s.finished=this.now();}
 }
 accept(id:string):void {
  this.tick();const s=this.session(id),m=s?.world.match;if(!m||m.phase!=='found')return;
  if(!m.accepted.includes(id))m.accepted.push(id);
  if(m.fighters.every(f=>m.accepted.includes(f.id))){m.phase='loading';m.deadline=this.now()+20000;}
 }
 ready(id:string):void {
  this.tick();const s=this.session(id),m=s?.world.match;if(!m||m.phase!=='loading')return;
  if(!m.ready.includes(id))m.ready.push(id);
  if(m.fighters.every(f=>f.bot||m.ready.includes(f.id))){m.phase='countdown';m.deadline=this.now()+3000;s!.last=this.now();}
 }
 input(id:string,input:unknown):boolean {const s=this.session(id);if(!s)return false;s.seen.set(id,this.now());return s.world.input(id,input);}
 leave(id:string):void {
  this.queue.delete(id);const s=this.session(id);if(!s)return;
  if(['found','loading','countdown'].includes(s.world.match.phase)){s.world.match.phase='cancelled';s.world.match.reason='declined';s.finished=this.now();}
  else if(s.world.match.phase==='active')s.world.forfeit(id);
  this.membership.delete(id);
 }
 private session(id:string):Session|undefined {const key=this.membership.get(id);return key?this.sessions.get(key):undefined;}
 private compatible(a:Entry,b:Entry):boolean {
  return a.size===b.size&&Math.abs(a.profile.rating-b.profile.rating)<=Math.min(500,150+(this.now()-a.since)/100)&&Math.abs(a.profile.level-b.profile.level)<=Math.max(5,Math.floor(a.profile.level*.2))&&Math.abs(a.profile.cp-b.profile.cp)/a.profile.cp<=.08;
 }
 private pair():void {
  for(const [id,q]of this.queue)if(this.now()-q.seen>15000)this.queue.delete(id);
  for(const seed of [...this.queue.values()]){
   if(!this.queue.has(seed.profile.id))continue;
   const group=[...this.queue.values()].filter(e=>this.compatible(seed,e)).sort((a,b)=>a.since-b.since).slice(0,seed.size*2);
   if(group.length<seed.size*2&&this.now()-seed.since<5000)continue;
   const profiles=group.map(q=>({...q.profile}));
   while(profiles.length<seed.size*2){const n=profiles.length;profiles.push({id:`bot:${++this.serial}`,name:['Ayla','Kael','Nyra','Orion','Thorne','Vesper'][n%6]+' · IA',classId:CLASS_IDS[Math.floor(this.random()*CLASS_IDS.length)%CLASS_IDS.length],level:seed.profile.level,cp:Math.max(Math.ceil(seed.profile.cp*.92),Math.min(Math.floor(seed.profile.cp*1.08),Math.round(seed.profile.cp*(.92+this.random()*.16)))),rating:seed.profile.rating,bot:true});}
   profiles.sort((a,b)=>b.cp-a.cp);const totals=[0,0],counts=[0,0];
   const fighters=profiles.map(p=>{const team=(counts[0]>=seed.size?1:counts[1]>=seed.size?0:totals[0]<=totals[1]?0:1) as 0|1;counts[team]++;totals[team]+=p.cp;return {...p,team};});
   const id=`arena:${this.now()}:${++this.serial}`,world=new PvPCombatWorld(id,seed.size,fighters,this.now());
   this.sessions.set(id,{world,last:this.now(),seen:new Map(group.map(q=>[q.profile.id,this.now()])),rewarded:false,finished:0});
   for(const q of group){this.queue.delete(q.profile.id);this.membership.set(q.profile.id,id);}
  }
 }
 tick():void {
  this.pair();const now=this.now();
  for(const [key,s]of this.sessions){const m=s.world.match;
   if((m.phase==='found'||m.phase==='loading')&&now>=m.deadline){m.reason=m.phase==='loading'?'load-timeout':'accept-timeout';m.phase='cancelled';s.finished=now;}
   if(m.phase==='countdown'&&now>=m.deadline){m.phase='active';m.deadline=now+180000;s.last=now;}
   if(m.phase==='active'){
    for(const f of m.fighters)if(!f.bot&&now-(s.seen.get(f.id)??now)>10000)s.world.forfeit(f.id);
    // Bound catch-up after process suspension; normal cadence is 30 Hz.
    let steps=Math.min(15,Math.floor((now-s.last)/(1000/30)));while(steps-->0){s.world.step(1/30);s.last+=1000/30;}
    if(now-s.last>1000)s.last=now;
    m.remaining=Math.min(m.remaining,Math.max(0,(m.deadline-now)/1000));if(m.remaining<=0&&m.phase==='active')s.world.step(1/30);
   }else s.last=now;
   if(m.phase==='ended'&&!s.rewarded){s.rewarded=true;s.finished=now;
    for(const f of m.fighters.filter(f=>!f.bot)){const won=f.team===m.winner,result:PvPResult={id:f.id,ranked:m.ranked,rating:m.winner===null?0:won?25:-15,honor:m.winner===null?10:won?35:10};m.results.push(result);this.reward(f.id,result);}
   }
   if((m.phase==='ended'||m.phase==='cancelled')&&now-s.finished>60000){for(const f of m.fighters)if(this.membership.get(f.id)===key)this.membership.delete(f.id);this.sessions.delete(key);}
  }
 }
 view(id:string):PvPView {
  const q=this.queue.get(id);if(q)q.seen=this.now();const s=this.session(id);if(s)s.seen.set(id,this.now());this.tick();
  const entry=this.queue.get(id);
  return {queue:entry?{size:entry.size,since:entry.since,found:[...this.queue.values()].filter(e=>this.compatible(entry,e)).length,required:entry.size*2}:null,match:this.session(id)?.world.snapshot()??null,serverTime:this.now()};
 }
}
