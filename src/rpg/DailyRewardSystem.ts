export type DailyReward={day:number;gold:number;crystals:number;honor:number};
export const DAILY_REWARDS:DailyReward[]=Array.from({length:7},(_,i)=>({day:i+1,gold:180*(i+1),crystals:2+i*2,honor:3+i*3}));
export const ONLINE_MILESTONES=[300,900,1800,3600] as const;
export interface RewardPayout{gold:number;crystals:number;honor:number;xp:number;}
function localDay(date:Date):number{return Math.floor(new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime()/86400000);}
export class DailyRewardSystem{
 streak=0;lastDay=-1;claimedTime:number[]=[];
 sessionSeconds=0;wheelDay=-1;wheelSpins=0;
 private seed=87123;
 private random():number{this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 canClaim(date=new Date()):boolean{return this.lastDay!==localDay(date);}
 claim(date=new Date()):RewardPayout|null{
  if(!this.canClaim(date))return null;const day=localDay(date);
  this.streak=this.lastDay===day-1?this.streak%7+1:1;this.lastDay=day;
  this.sessionSeconds=0;this.claimedTime=[];
  const r=DAILY_REWARDS[this.streak-1];return {gold:r.gold,crystals:r.crystals,honor:r.honor,xp:r.gold*.35};
 }
 tick(dt:number,active:boolean):void{if(active)this.sessionSeconds=Math.min(28800,this.sessionSeconds+Math.max(0,Math.min(dt,.1)));}
 availableMilestones():number[]{return ONLINE_MILESTONES.filter(s=>this.sessionSeconds>=s&&!this.claimedTime.includes(s));}
 claimMilestone(seconds:number):RewardPayout|null{
  if(!ONLINE_MILESTONES.some(t=>t===seconds)||this.sessionSeconds<seconds||this.claimedTime.includes(seconds))return null;
  this.claimedTime.push(seconds);
  return {gold:Math.round(seconds*.7),crystals:Math.floor(seconds/300),honor:Math.max(2,Math.floor(seconds/180)),xp:Math.floor(seconds*.3)};
 }
 canSpin(date=new Date()):boolean{return this.wheelDay!==localDay(date);}
 spin(date=new Date()):RewardPayout|null{
  if(!this.canSpin(date))return null;this.wheelDay=localDay(date);this.wheelSpins++;
  const r=this.random();return r<.55?{gold:500,crystals:0,honor:0,xp:0}:r<.84?{gold:120,crystals:7,honor:0,xp:0}:r<.97?{gold:0,crystals:15,honor:9,xp:0}:{gold:1500,crystals:35,honor:30,xp:500};
 }
 snapshot():Record<string,unknown>{return {streak:this.streak,lastDay:this.lastDay,claimedTime:this.claimedTime,sessionSeconds:this.sessionSeconds,wheelDay:this.wheelDay,wheelSpins:this.wheelSpins,seed:this.seed};}
 restore(raw:unknown):void{
  if(!raw||typeof raw!=='object')return;const r=raw as Record<string,unknown>;
  const valid=(n:unknown,min:number,max:number,def:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):def;
  this.streak=valid(r.streak,0,7,0);this.lastDay=valid(r.lastDay,-1,1e8,-1);
  this.wheelDay=valid(r.wheelDay,-1,1e8,-1);this.wheelSpins=valid(r.wheelSpins,0,1e7,0);
  this.sessionSeconds=valid(r.sessionSeconds,0,28800,0);this.seed=valid(r.seed,0,0xffffffff,87123);
  this.claimedTime=Array.isArray(r.claimedTime)?r.claimedTime.filter((n):n is number=>ONLINE_MILESTONES.some(x=>x===n)).slice(0,4):[];
 }
}
