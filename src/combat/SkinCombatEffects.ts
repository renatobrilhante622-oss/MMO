import type {SkinElement,SkinPassive} from '../player/SkinCatalog';
/** Runtime cooldowns survive equipment switches; normalized online PvP never invokes this class. */
export class SkinCombatEffects {
 passive:SkinPassive={};element:SkinElement='steel';color=0xffd699;epic=false;
 private procCooldown=0;private mountCooldown=0;
 constructor(private random:()=>number=Math.random){}
 update(dt:number):void{dt=Number.isFinite(dt)?Math.max(0,dt):0;this.procCooldown=Math.max(0,this.procCooldown-dt);this.mountCooldown=Math.max(0,this.mountCooldown-dt);}
 multiplier(elite:boolean,boss:boolean):number{return elite||boss?1+(this.passive.eliteDamage??0):1;}
 onHit():{kind:'bolt'|'meteor';power:number}|null {
  if(this.procCooldown>0)return null;
  if(this.passive.bolt&&this.random()<this.passive.bolt){this.procCooldown=4;return {kind:'bolt',power:.85};}
  if(this.passive.meteor&&this.random()<this.passive.meteor){this.procCooldown=6;return {kind:'meteor',power:1.2};}return null;
 }
 onMount(maxHp:number):number{if(this.mountCooldown>0||!this.passive.mountShield)return 0;this.mountCooldown=30;return maxHp*this.passive.mountShield;}
}
