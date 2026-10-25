import {REGIONS, type Region} from './Regions';

export interface RegionRewards {
  equipment: string;
  exclusive: readonly string[];
  rarity: 'common'|'rare'|'epic'|'legendary'|'mythic';
}
export const REGION_REWARDS:Readonly<Record<string,RegionRewards>>={
  aurora:{equipment:'Comum / Incomum',exclusive:['Minério de Ferro','Poção Básica'],rarity:'common'},
  crypt:{equipment:'Raro',exclusive:['Fragmento de Asa Esquelética','Joia Sombria'],rarity:'rare'},
  highlands:{equipment:'Épico',exclusive:['Arma Rúnica','Cristal de Refino Avançado'],rarity:'epic'},
  rift:{equipment:'Lendário',exclusive:['Skin de Hellhound','Pedra de Proteção de Forja'],rarity:'legendary'},
  eclipse:{equipment:'Mítico',exclusive:['Asas Dracônicas','Montaria Mítica'],rarity:'mythic'},
};

export interface RegionTravelState {
  level: number;
  unlocked: readonly string[];
  adminOverride?: boolean;
  inCombat?: boolean;
  inDungeon?: boolean;
  channeling?: boolean;
}
export interface RegionTravelResult { ok:boolean;reason?:'unknown'|'level'|'locked'|'combat'|'dungeon'|'busy'; region?:Region; }
export function travelPermission(id:string,state:RegionTravelState):RegionTravelResult{
  const region=REGIONS.find(r=>r.id===id);
  if(!region)return {ok:false,reason:'unknown'};
  if(state.inDungeon)return {ok:false,reason:'dungeon'};
  if(state.channeling)return {ok:false,reason:'busy'};
  if(state.inCombat)return {ok:false,reason:'combat'};
  if(!state.adminOverride&&state.level<region.minLevel)return {ok:false,reason:'level'};
  if(!state.adminOverride&&region.id!=='aurora'&&!state.unlocked.includes(region.id))return {ok:false,reason:'locked'};
  return {ok:true,region};
}
/** Every region has a deterministic safe spawn inside the existing navigation bounds. */
export function regionArrival(id:string):{x:number;z:number}|null{
  const region=REGIONS.find(r=>r.id===id);
  if(!region)return null;
  const arrivals:Record<string,{x:number;z:number}>={
    aurora:{x:0,z:18},crypt:{x:-58,z:-35},highlands:{x:96,z:-78},
    rift:{x:0,z:-71},eclipse:{x:-89,z:89}
  };
  return {...arrivals[id]};
}
export function nextRegion(id:string):Region|undefined {
  const index=REGIONS.findIndex(r=>r.id===id);
  return index<0?undefined:REGIONS[index+1];
}
