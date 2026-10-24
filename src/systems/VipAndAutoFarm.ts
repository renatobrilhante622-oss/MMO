import type { HeroInput } from '../core/GameTypes';
export interface FarmTarget {id:string;alive:boolean;boss:boolean;level:number;position:{x:number;z:number};}
export interface FarmDecision {target:FarmTarget|null;healthPotion:boolean;manaPotion:boolean;stop:boolean;}
/** Side-effect-free policy shared by runtime and tests. VIP affects convenience only. */
export function planFarm(context:{vip:boolean;enabled:boolean;alive:boolean;inDungeon:boolean;level:number;x:number;z:number;hp:number;maxHp:number;mana:number;maxMana:number;healthThreshold:number;manaThreshold:number;input:HeroInput},targets:FarmTarget[]):FarmDecision {
  const manual=Math.hypot(context.input.move.x,context.input.move.y)>.2||context.input.attack||context.input.skill!==null;
  const stop=!context.vip||!context.alive||context.inDungeon||manual;
  if(!context.enabled||stop)return {target:null,healthPotion:false,manaPotion:false,stop};
  const target=targets.filter(t=>t.alive&&!t.boss&&t.level<=context.level+3&&t.level>=Math.max(1,context.level-15))
    .sort((a,b)=>Math.hypot(a.position.x-context.x,a.position.z-context.z)-Math.hypot(b.position.x-context.x,b.position.z-context.z))[0]??null;
  return {target,healthPotion:context.hp/Math.max(1,context.maxHp)<context.healthThreshold,manaPotion:context.mana/Math.max(1,context.maxMana)<context.manaThreshold,stop:false};
}
