import {REGIONS} from './Regions';
import {travelPermission,type RegionTravelState} from './RegionTravel';
export interface StoryGate {canEnterRegion(id:string):boolean;regionComplete(id:string):boolean;}
/** Progression gates use claimed quests, never character level or discovery alone. */
export function portalPermission(from:string,to:string,state:RegionTravelState,story:StoryGate){
 const a=REGIONS.findIndex(r=>r.id===from),b=REGIONS.findIndex(r=>r.id===to);
 const base=travelPermission(to,state);if(!base.ok)return base;
 if(state.adminOverride)return base;
 if(a<0||b<0||Math.abs(a-b)!==1)return {...base,ok:false,reason:'locked' as const};
 if(b>a&&!story.regionComplete(from))return {...base,ok:false,reason:'locked' as const};
 if(!story.canEnterRegion(to))return {...base,ok:false,reason:'locked' as const};
 return base;
}
/** Crossing must touch the physical aperture; standing in its label radius is insufficient. */
export class PortalTrigger {
 private latched=false;
 sample(hero:{x:number;z:number},gate:{x:number;z:number},open:boolean,active:boolean):boolean {
  const inside=Math.abs(hero.x-gate.x)<1.5&&Math.abs(hero.z-gate.z)<1.25;
  if(!inside){this.latched=false;return false;}
  if(!active||!open||this.latched)return false;this.latched=true;return true;
 }
}
