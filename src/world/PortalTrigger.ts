import {REGIONS} from './Regions';
import {type RegionTravelResult,type RegionTravelState} from './RegionTravel';
export interface StoryGate {canEnterRegion(id:string):boolean;regionComplete(id:string):boolean;allMainQuestsDone?(id:string):boolean;subscribe?(listener:()=>void):()=>void;}
/** Progression gates use claimed quests, never character level or discovery alone. */
export function portalPermission(from:string,to:string,state:RegionTravelState,story:StoryGate):RegionTravelResult {
 const a=REGIONS.findIndex(r=>r.id===from),b=REGIONS.findIndex(r=>r.id===to),region=REGIONS[b];
 if(a<0||b<0)return {ok:false,reason:'unknown'};
 if(state.inDungeon)return {ok:false,reason:'dungeon',region};
 if(state.channeling)return {ok:false,reason:'busy',region};
 if(state.adminOverride)return {ok:true,region};
 if(Math.abs(a-b)!==1)return {ok:false,reason:'locked',region};
 // Physical campaign gates have one authority: completed main objectives.
 // Level, discovered/unlocked caches and recent boss combat cannot reseal a finished chapter.
 const complete=story.allMainQuestsDone?.(from)??story.regionComplete(from);
 if(b>a&&!complete||!story.canEnterRegion(to))return {ok:false,reason:'locked',region};
 return {ok:true,region};
}
export interface PortalAperture {x:number;z:number;yaw?:number;halfDepth?:number;}
export function portalContact(hero:{x:number;z:number},gate:PortalAperture):boolean {
 const dx=hero.x-gate.x,dz=hero.z-gate.z,yaw=gate.yaw??0;
 return Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))<1.5&&Math.abs(dx*Math.sin(yaw)+dz*Math.cos(yaw))<(gate.halfDepth??1.25);
}
/** Crossing must touch the physical aperture; standing in its label radius is insufficient. */
export class PortalTrigger {
 private latched=false;
 sample(hero:{x:number;z:number},gate:PortalAperture,open:boolean,active:boolean):boolean {
  if(!portalContact(hero,gate)){this.latched=false;return false;}
  if(!active||!open||this.latched)return false;this.latched=true;return true;
 }
}
