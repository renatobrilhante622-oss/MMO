import {PvPMatchmaking} from '../src/combat/PvPMatchmaking';
import type {ClassId} from '../src/core/GameTypes';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
export type Role='leader'|'officer'|'veteran'|'elite'|'member';
export interface OnlineItem { id:string; name:string; rarity:number; }
export interface Player {
  id:string; name:string; token:string; level:number; wins:number; losses:number; rating:number;
  coins:number; items:OnlineItem[]; clan:string|null; classId?:string; bossAttackAt:number; rewardedWeek:string; clanMarks?:number; practiceRating?:number; practiceHonor?:number;
}
interface Queue { id:string; size:1|2|3; since:number; }
export interface Fighter { id:string; team:number; hp:number; maxHp:number; energy:number; guardUntil:number; nextAction:number;tactical?:boolean; }
export interface Match { id:string; size:number; started:number; ended:number; winner:number|null; fighters:Fighter[]; log:string[]; }
interface Clan { id:string; name:string; members:Record<string,Role>; week:string; bossHp:number; contributors:string[]; damage?:Record<string,number>; level?:number; }
interface Listing { id:string; seller:string; item:OnlineItem; price:number; }
export interface Store { players:Player[]; clans:Clan[]; listings:Listing[]; }
export class GameError extends Error {constructor(message:string,readonly status=400){super(message);}}
const week=(now:number)=>String(Math.floor((now-4*86400000)/(7*86400000)));
const clean=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const safeEqual=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
/** All online balances, item custody, actions, damage and queue membership live here. */
export class GameService {
  readonly players=new Map<string,Player>();
  readonly clans=new Map<string,Clan>();
  readonly listings=new Map<string,Listing>();
  readonly matches=new Map<string,Match>();
  readonly pvp:PvPMatchmaking;
  private queue:Queue[]=[];
  private seen=new Map<string,number>();
  constructor(private readonly now:()=>number=Date.now,store?:Store){
    this.pvp=new PvPMatchmaking(now,(id,r)=>{const p=this.player(id);if(r.ranked){p.rating=Math.max(100,p.rating+r.rating);p.coins+=r.honor;if(r.rating>0)p.wins++;else if(r.rating<0)p.losses++;p.level=1+Math.floor(p.wins/3);}else{p.practiceRating=Math.max(100,(p.practiceRating??1000)+r.rating);p.practiceHonor=(p.practiceHonor??0)+r.honor;}});
    if(store){for(const p of store.players??[])this.players.set(p.id,p);for(const c of store.clans??[])this.clans.set(c.id,c);for(const l of store.listings??[])this.listings.set(l.id,l);}
  }
  create(name:unknown,classId:unknown='berserker'):Player {
    const safe=clean(name,24);if(!/^[\p{L}\p{N} _-]{3,24}$/u.test(safe))throw new GameError('Use 3–24 letters or numbers for your name.');
    if(this.players.size>=10000)throw new GameError('Server capacity reached.',503);
    const p:Player={id:randomUUID(),name:safe,token:randomBytes(32).toString('hex'),level:1,wins:0,losses:0,rating:1000,coins:100,items:[{id:randomUUID(),name:'Traveler crest',rarity:0}],clan:null,bossAttackAt:0,rewardedWeek:''};
    p.classId=['berserker','paladin','assassin','ranger','elementalist','necromancer','monk','lanceman','warlock'].includes(String(classId))?String(classId):'berserker';
    this.players.set(p.id,p);this.seen.set(p.id,this.now());return p;
  }
  authenticate(token:string):Player {
    if(!/^[a-f0-9]{64}$/.test(token))throw new GameError('Session required.',401);
    const p=[...this.players.values()].find(p=>safeEqual(p.token,token));if(!p)throw new GameError('Session not found.',401);
    this.seen.set(p.id,this.now());return p;
  }
  private player(id:string):Player {const p=this.players.get(id);if(!p)throw new GameError('Player not found.',404);return p;}
  private clan(p:Player):Clan {const c=p.clan?this.clans.get(p.clan):undefined;if(!c)throw new GameError('Join a clan first.');this.resetWeek(c);return c;}
  private resetWeek(c:Clan):void {const w=week(this.now());if(c.week!==w){c.week=w;c.bossHp=50000;c.contributors=[];c.damage={};}}
  activeMatch(id:string):Match|undefined {return [...this.matches.values()].find(m=>!m.ended&&m.fighters.some(f=>f.id===id));}
  enqueue(p:Player,size:unknown):void {
    if(![1,2,3].includes(size as number))throw new GameError('Choose 1v1, 2v2 or 3v3.');
    if(this.pvp.busy(p.id)||this.activeMatch(p.id))throw new GameError('Finish your current match.');
    this.queue=this.queue.filter(q=>q.id!==p.id);this.queue.push({id:p.id,size:size as 1|2|3,since:this.now()});this.pair();
  }
  enqueuePvP(p:Player,size:unknown):void {
    if(this.activeMatch(p.id))throw new GameError('Finish your current match.');this.cancel(p);
    try{this.pvp.enqueue({id:p.id,name:p.name,classId:(p.classId??'berserker') as ClassId,level:p.level,cp:500+p.level*35+p.items.reduce((n,i)=>n+i.rarity*25,0),rating:p.rating,bot:false},size);}catch(e){throw new GameError(e instanceof Error?e.message:'Queue unavailable.');}
  }
  cancel(p:Player):void {this.queue=this.queue.filter(q=>q.id!==p.id);}
  private pair():void {
    const now=this.now();this.queue=this.queue.filter(q=>now-(this.seen.get(q.id)??0)<15000);
    for(const size of [1,2,3]){
      let candidates=this.queue.filter(q=>q.size===size).sort((a,b)=>a.since-b.since);
      while(candidates.length>=size*2){
        const seed=candidates[0];const seedP=this.player(seed.id);
        const band=Math.min(600,150+Math.floor((now-seed.since)/1000)*5);
        const eligible=candidates.filter(q=>Math.abs(this.player(q.id).rating-seedP.rating)<=band).slice(0,size*2);
        if(eligible.length<size*2)break;
        eligible.sort((a,b)=>this.player(b.id).rating-this.player(a.id).rating);
        const totals=[0,0],counts=[0,0];const fighters:Fighter[]=[];
        for(const q of eligible){const team=counts[0]>=size?1:counts[1]>=size?0:totals[0]<=totals[1]?0:1;counts[team]++;totals[team]+=this.player(q.id).rating;fighters.push({id:q.id,team,hp:1200,maxHp:1200,energy:100,guardUntil:0,nextAction:0});}
        const m:Match={id:randomUUID(),size,started:now,ended:0,winner:null,fighters,log:['Arena started. All gear, levels and VIP bonuses normalized.']};this.matches.set(m.id,m);
        const ids=new Set(eligible.map(q=>q.id));this.queue=this.queue.filter(q=>!ids.has(q.id));candidates=candidates.filter(q=>!ids.has(q.id));
      }
    }
  }
  fight(p:Player,kind:unknown,targetId:unknown):void {
    const m=this.activeMatch(p.id);if(!m)throw new GameError('No active match.');
    const f=m.fighters.find(f=>f.id===p.id)!;const now=this.now();
    if(f.hp<=0||now<f.nextAction)throw new GameError('Action unavailable or cooling down.');
    if(kind==='tactical'){f.tactical=!f.tactical;return;}
    if(!['strike','spell','guard','leave'].includes(kind as string))throw new GameError('Unknown arena action.');
    if(kind==='leave'){f.hp=0;m.log.push(`${p.name} conceded.`);this.finishMatch(m);return;}
    if(kind==='guard'){f.guardUntil=now+2500;f.energy=Math.min(100,f.energy+20);f.nextAction=now+1800;m.log.push(`${p.name} guards.`);return;}
    const target=m.fighters.find(t=>t.id===targetId&&t.team!==f.team&&t.hp>0)??m.fighters.find(t=>t.team!==f.team&&t.hp>0);
    if(!target)throw new GameError('No valid target.');
    if(kind==='spell'&&f.energy<30)throw new GameError('Insufficient energy.');
    f.energy=Math.max(0,Math.min(100,f.energy+(kind==='spell'?-30:10)));
    f.nextAction=now+(kind==='spell'?2300:1300);
    const damage=Math.round((kind==='spell'?180:95)*(target.guardUntil>now?.35:1));target.hp=Math.max(0,target.hp-damage);
    m.log.push(`${p.name}: ${kind} → ${this.player(target.id).name} (${damage})`);m.log=m.log.slice(-30);this.finishMatch(m);
  }
  tick():void {
    this.pvp.tick();this.pair();
    for(const m of this.matches.values()){
      this.finishMatch(m);if(m.ended)continue;
      for(const fighter of m.fighters){if(!fighter.tactical||fighter.hp<=0||fighter.nextAction>this.now())continue;
        const target=m.fighters.filter(f=>f.team!==fighter.team&&f.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(!target)break;
        const action=fighter.energy<30&&fighter.hp<fighter.maxHp*.4?'guard':fighter.energy>=60?'spell':'strike';
        this.fight(this.player(fighter.id),action,target.id);if(m.ended)break;
      }
    }
  }
  private finishMatch(m:Match):void {
    if(m.ended)return;
    const living=[0,1].map(team=>m.fighters.some(f=>f.team===team&&f.hp>0));
    const expired=this.now()-m.started>=180000;
    if(living[0]&&living[1]&&!expired)return;
    if(expired){const totals=[0,1].map(team=>m.fighters.filter(f=>f.team===team).reduce((n,f)=>n+f.hp,0));m.winner=totals[0]===totals[1]?null:totals[0]>totals[1]?0:1;}
    else m.winner=living[0]?0:living[1]?1:null;
    m.ended=this.now();
    for(const f of m.fighters){const p=this.player(f.id),won=f.team===m.winner;if(won){p.wins++;p.coins+=35;p.rating+=20;}else{p.losses++;p.coins+=10;p.rating=Math.max(100,p.rating-15);}p.level=1+Math.floor(p.wins/3);}
    m.log.push(m.winner===null?'Draw.':`Team ${m.winner+1} won.`);
  }
  createClan(p:Player,name:unknown):void {
    if(p.clan)throw new GameError('Leave your current clan first.');if(p.coins<50)throw new GameError('Clan creation costs 50 arena marks.');
    const safe=clean(name,28);if(!/^[\p{L}\p{N} _-]{3,28}$/u.test(safe))throw new GameError('Clan name must contain 3–28 letters or numbers.');
    if([...this.clans.values()].some(c=>c.name.toLowerCase()===safe.toLowerCase()))throw new GameError('Clan name already taken.');
    const c:Clan={id:randomUUID(),name:safe,members:{[p.id]:'leader'},week:week(this.now()),bossHp:50000,contributors:[],damage:{},level:1};this.clans.set(c.id,c);p.clan=c.id;p.coins-=50;
  }
  joinClan(p:Player,id:unknown):void {
    if(p.clan)throw new GameError('Already in a clan.');const c=this.clans.get(String(id));if(!c||Object.keys(c.members).length>=30)throw new GameError('Clan full or unavailable.');
    c.members[p.id]='member';p.clan=c.id;
  }
  role(p:Player,targetId:unknown,role:unknown):void {
    const c=this.clan(p),target=this.player(String(targetId));
    if(!['leader','officer'].includes(c.members[p.id])||target.clan!==c.id||target.id===p.id||!['officer','veteran','elite','member','leader'].includes(String(role))||(c.members[p.id]!=='leader'&&(['leader','officer'].includes(c.members[target.id])||['leader','officer'].includes(String(role)))))throw new GameError('Only the leader can change a member role.');
    if(role==='leader')c.members[p.id]='officer';c.members[target.id]=role as Role;
  }
  leaveClan(p:Player):void {
    const c=this.clan(p);if(c.members[p.id]==='leader'&&Object.keys(c.members).length>1)throw new GameError('Transfer leadership before leaving.');
    delete c.members[p.id];p.clan=null;if(!Object.keys(c.members).length)this.clans.delete(c.id);
  }
  boss(p:Player):void {
    const c=this.clan(p);if(c.bossHp<=0)throw new GameError('Weekly boss defeated.');if(this.now()<p.bossAttackAt)throw new GameError('Raid attack cooldown: 30 seconds.');
    p.bossAttackAt=this.now()+30000;const damage=Math.round((500+Math.min(1000,p.level*25))*(1+((c.level??1)-1)*.03));c.bossHp=Math.max(0,c.bossHp-damage);
    if(!c.contributors.includes(p.id))c.contributors.push(p.id);c.damage??={};c.damage[p.id]=(c.damage[p.id]??0)+damage;
    if(c.bossHp===0)for(const id of c.contributors){const member=this.player(id);if(member.rewardedWeek===c.week)continue;member.rewardedWeek=c.week;member.coins+=200;member.clanMarks=(member.clanMarks??0)+100;member.items.push({id:randomUUID(),name:'Weekly guardian crest',rarity:3});}
  }
  clanShop(p:Player):void {
    this.clan(p);if((p.clanMarks??0)<100)throw new GameError('Requires 100 clan marks.');
    if(p.items.length>=200)throw new GameError('Online inventory full.');
    p.clanMarks!-=100;p.items.push({id:randomUUID(),name:'Clan guardian crest',rarity:4});
  }
  clanUpgrade(p:Player):void {
    const c=this.clan(p);if(!['leader','officer'].includes(c.members[p.id]))throw new GameError('Officer permission required.');
    const cost=(c.level??1)*100;if((p.clanMarks??0)<cost||(c.level??1)>=10)throw new GameError('Insufficient clan marks or maximum level.');
    p.clanMarks!-=cost;c.level=(c.level??1)+1;
  }
  list(p:Player,itemId:unknown,price:unknown):void {
    if(typeof price!=='number'||!Number.isInteger(price)||price<5||price>10000)throw new GameError('Price must be 5–10000 marks.');
    if([...this.listings.values()].filter(l=>l.seller===p.id).length>=10)throw new GameError('Maximum 10 listings.');
    const index=p.items.findIndex(i=>i.id===itemId);if(index<0)throw new GameError('Item unavailable.');
    const [item]=p.items.splice(index,1);const listing={id:randomUUID(),seller:p.id,item,price};this.listings.set(listing.id,listing);
  }
  buy(p:Player,id:unknown):void {
    const l=this.listings.get(String(id));if(!l||l.seller===p.id||p.coins<l.price)throw new GameError('Listing unavailable or insufficient marks.');
    if(p.items.length>=200)throw new GameError('Online inventory full.');
    // Synchronous mutation preserves exclusive escrow custody under concurrent HTTP requests.
    p.coins-=l.price;this.player(l.seller).coins+=Math.floor(l.price*.95);p.items.push(l.item);this.listings.delete(l.id);
  }
  cancelListing(p:Player,id:unknown):void {const l=this.listings.get(String(id));if(!l||l.seller!==p.id)throw new GameError('Listing not owned.');p.items.push(l.item);this.listings.delete(l.id);}
  realtimeView(p:Player):unknown {const pvp=this.pvp.view(p.id),{token,...self}=p;return {self,pvp,serverTime:this.now()};}
  view(p:Player):unknown {
    this.pair();for(const m of this.matches.values())this.finishMatch(m);
    for(const [id,m]of this.matches)if(m.ended&&this.now()-m.ended>600000)this.matches.delete(id);
    const recent=[...this.matches.values()].reverse().find(m=>m.fighters.some(f=>f.id===p.id));
    const c=p.clan?this.clans.get(p.clan):null;if(c)this.resetWeek(c);
    const {token,...self}=p;
    return {self,pvp:this.pvp.view(p.id),queue:this.queue.find(q=>q.id===p.id)??null,waiting:[1,2,3].map(size=>({size,count:this.queue.filter(q=>q.size===size).length})),
      match:recent?{...recent,fighters:recent.fighters.map(f=>({...f,name:this.player(f.id).name,classId:this.player(f.id).classId}))}:null,
      clans:[...this.clans.values()].map(c=>({id:c.id,name:c.name,count:Object.keys(c.members).length})),
      clan:c?{...c,members:Object.entries(c.members).map(([id,role])=>({id,name:this.player(id).name,level:this.player(id).level,role}))}:null,
      listings:[...this.listings.values()].slice(-200).map(l=>({...l,sellerName:this.player(l.seller).name})),serverTime:this.now()};
  }
  export():Store{return {players:[...this.players.values()],clans:[...this.clans.values()],listings:[...this.listings.values()]};}
}
