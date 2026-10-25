import {REGION_REWARDS} from '../world/RegionTravel';

export interface RegionalMaterial {
  id:string;
  region:string;
  name:string;
  quantity:number;
}
/** A deterministic regional loot roll bound to the already generated drop ID. */
export function regionalMaterialForKill(
  region:string,kind:string,level:number,boss:boolean,dropId:string
):RegionalMaterial|null{
  const table=REGION_REWARDS[region];
  if(!table||!kind||!Number.isFinite(level)||level<1||dropId.length>200)return null;
  let hash=2166136261;
  for(const letter of dropId+':'+kind){
    hash=Math.imul(hash ^ letter.charCodeAt(0),16777619)>>>0;
  }
  // Bosses always grant a regional exclusive. Normal fights use a bounded drop chance.
  if(!boss&&hash%100>=28)return null;
  const choice=boss?1:(hash>>>8)%table.exclusive.length;
  return {
    id:region+':'+choice,
    region,
    name:table.exclusive[choice],
    quantity:boss?2+Math.floor(Math.max(1,level)/25):1,
  };
}
/** A constrained inventory key prevents corrupted saves introducing arbitrary crafting currencies. */
export function isKnownRegionalMaterial(id:string):boolean{
  const [region,index]=id.split(':');
  return !!REGION_REWARDS[region] && (index==='0'||index==='1');
}
