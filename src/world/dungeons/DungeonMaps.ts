import type {ModelName} from '../../assets/AnimatedGLB';
export interface DungeonRoomPlan {id:'guardians'|'crystals'|'sentinels'|'boss';name:string;x:number;z:number;width:number;depth:number;}
export interface DungeonMapPlan {id:string;name:[string,string];bossName:[string,string];bossModel:ModelName;accent:number;fog:string;floor:string;metalness:number;roughness:number;rooms:readonly DungeonRoomPlan[];props:readonly {asset:string;x:number;z:number;size:number}[];}
const room=(id:DungeonRoomPlan['id'],x:number,z:number,width:number,depth:number):DungeonRoomPlan=>({id,x,z,width,depth,name:({guardians:'Galeria dos Guardiões',crystals:'Câmara dos Selos',sentinels:'Salão dos Sentinelas',boss:'Sala do Trono'})[id]});
export const DUNGEON_MAPS:Record<string,DungeonMapPlan>={
 tombs:{id:'tombs',name:['Catacumbas do Rei Ossudo','Catacombs of the Bone King'],bossName:['Rei Esqueleto — Lich','Skeleton King — Lich'],bossModel:'KayKit_Skeleton_Warrior',accent:0x559eff,fog:'#151a29',floor:'cobble',metalness:.08,roughness:.7,rooms:[room('guardians',0,-27,22,14),room('crystals',0,-44,24,14),room('sentinels',-6,-60,20,14),room('boss',0,-80,32,22)],props:[{asset:'Throne',x:0,z:-86,size:5},{asset:'Coffin',x:-9,z:-28,size:3},{asset:'Coffin',x:9,z:-44,size:3},{asset:'Skull',x:-7,z:-72,size:2},{asset:'Crypt',x:0,z:-87,size:9}]},
 titan:{id:'titan',name:['Templo do Cristal Corrompido','Temple of Corrupted Crystal'],bossName:['Colosso de Cristal','Crystal Colossus'],bossModel:'Creature_golem',accent:0x57dcff,fog:'#132b41',floor:'snow',metalness:.35,roughness:.22,rooms:[room('guardians',-14,-28,22,14),room('crystals',9,-44,26,15),room('sentinels',-10,-60,24,14),room('boss',10,-80,34,22)],props:[{asset:'Throne',x:10,z:-87,size:6},{asset:'BlueCrystal',x:-22,z:-28,size:7},{asset:'BlueCrystal',x:17,z:-44,size:8},{asset:'BlueCrystal',x:-18,z:-60,size:9},{asset:'Obelisk',x:10,z:-88,size:8}]},
 void:{id:'void',name:['Fornalha do Titã de Magma','Furnace of the Magma Titan'],bossName:['Senhor da Forja Ardente','Lord of the Blazing Forge'],bossModel:'Quaternius_demon',accent:0xff5b16,fog:'#301418',floor:'scorched',metalness:.55,roughness:.28,rooms:[room('guardians',0,-26,22,14),room('crystals',-11,-44,22,15),room('sentinels',12,-61,24,14),room('boss',0,-81,34,22)],props:[{asset:'Throne',x:0,z:-88,size:6},{asset:'Anvil',x:-8,z:-28,size:5},{asset:'Anvil',x:0,z:-87,size:8},{asset:'Chain',x:-12,z:-76,size:8},{asset:'Chain',x:12,z:-76,size:8},{asset:'IronBridge',x:0,z:-34,size:6}]},
 eclipse:{id:'eclipse',name:['Cidadela do Vazio Abissal','Citadel of the Abyssal Void'],bossName:['Imperador Abissal','Abyssal Emperor'],bossModel:'KayKit_Mage',accent:0xb375ff,fog:'#0b061b',floor:'cobble',metalness:.85,roughness:.12,rooms:[room('guardians',0,-26,26,14),room('crystals',0,-44,18,16),room('sentinels',0,-62,30,14),room('boss',0,-82,38,22)],props:[{asset:'Throne',x:0,z:-89,size:7},{asset:'VoidArch',x:0,z:-87,size:15},{asset:'Obelisk',x:-12,z:-62,size:8},{asset:'Obelisk',x:12,z:-62,size:8},{asset:'BlueCrystal',x:-14,z:-81,size:7},{asset:'BlueCrystal',x:14,z:-81,size:7}]},
};
/** Legacy IDs retain saves/keys, but resolve to a real dedicated architecture. */
export function dungeonMap(id:string):DungeonMapPlan{return DUNGEON_MAPS[id]??DUNGEON_MAPS.tombs;}
export function roomForWave(wave:number,waves:number):number{return wave>waves?3:wave<=Math.ceil(waves/3)?0:wave<=Math.ceil(waves*2/3)?1:2;}
export function dungeonWalkable(plan:DungeonMapPlan,x:number,z:number):boolean {
 if(plan.rooms.some(r=>Math.abs(x-r.x)<=r.width/2&&Math.abs(z-r.z)<=r.depth/2))return true;
 for(let i=1;i<plan.rooms.length;i++){
  const a=plan.rooms[i-1],b=plan.rooms[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
  if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<3.5)return true;
 }return false;
}
