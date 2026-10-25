export interface Region {
  id: string; name: [string, string]; center: { x: number; z: number }; radius: number;
  minLevel: number; maxLevel: number; color: string; kinds: readonly string[];
  boss: { x: number; z: number; name: [string,string] };
}
/**
 * Five distinct progression regions. Travel entry points remain within the
 * existing physics/height-field bounds until instanced map streaming is ready.
 */
export const REGIONS: readonly Region[] = [
  { id:'aurora',name:['Vale de Aster','Aster Vale'],center:{x:0,z:18},radius:64,minLevel:1,maxLevel:15,color:'#8fbf83',kinds:['slime','wolf'],boss:{x:-32,z:40,name:['Matriarca dos Bosques','Woodland Matriarch']} },
  { id:'crypt',name:['Cemitério das Cinzas & Cripta','Ashen Graveyard & Crypt'],center:{x:-65,z:-40},radius:53,minLevel:15,maxLevel:35,color:'#9986bc',kinds:['skeleton','wraith'],boss:{x:-89,z:-48,name:['Lich Ancestral','Ancient Lich']} },
  { id:'highlands',name:['Ruínas de Cristal Gelado','Frozen Crystal Ruins'],center:{x:95,z:-83},radius:65,minLevel:35,maxLevel:60,color:'#a5d5e8',kinds:['golem','wolf'],boss:{x:104,z:-109,name:['Golem Glacial','Glacial Golem']} },
  { id:'rift',name:['Desfiladeiro da Forja Ardente','Blazing Forge Canyon'],center:{x:0,z:-85},radius:52,minLevel:60,maxLevel:85,color:'#e78c58',kinds:['golem','wraith'],boss:{x:25,z:-100,name:['Senhor da Forja','Forge Lord']} },
  { id:'eclipse',name:['Santuário Abissal do Fim','Sanctuary of the Abyss'],center:{x:-92,z:97},radius:65,minLevel:85,maxLevel:100,color:'#ba73e2',kinds:['skeleton','wraith'],boss:{x:-105,z:111,name:['Dragão do Abismo','Abyssal Dragon']} },
];

export function regionAt(x:number,z:number): Region {
  if (Math.hypot(x,z-18)<32) return REGIONS[0];
  return REGIONS.reduce((best,r)=>Math.hypot(x-r.center.x,z-r.center.z)/r.radius < Math.hypot(x-best.center.x,z-best.center.z)/best.radius?r:best,REGIONS[0]);
}
export function regionalLevel(x:number,z:number):number {
  const r=regionAt(x,z),distance=Math.min(1,Math.hypot(x-r.center.x,z-r.center.z)/r.radius);
  return Math.round(r.minLevel+(r.maxLevel-r.minLevel)*distance);
}
export interface DungeonDefinition { id:string; name:[string,string]; level:number; waves:number; bossName:[string,string]; region:string; gold:number; crystals:number; }
export const DUNGEONS:readonly DungeonDefinition[]=[
  {id:'roots',name:['Raízes Esquecidas','Forgotten Roots'],level:1,waves:3,bossName:['Guardião das Raízes','Root Guardian'],region:'aurora',gold:120,crystals:3},
  {id:'tide',name:['Santuário das Marés','Tidal Sanctuary'],level:8,waves:4,bossName:['Oráculo Abissal','Abyssal Oracle'],region:'aurora',gold:380,crystals:5},
  {id:'tombs',name:['Tumbas do Rei','Royal Tombs'],level:18,waves:4,bossName:['Rei Sepultado','Buried King'],region:'crypt',gold:800,crystals:8},
  {id:'void',name:['Catedral do Vazio','Void Cathedral'],level:30,waves:5,bossName:['Guardião do Vazio','Void Guardian'],region:'rift',gold:1600,crystals:12},
  {id:'titan',name:['Coração da Montanha','Mountain Heart'],level:45,waves:5,bossName:['Titã Ancestral','Ancient Titan'],region:'highlands',gold:2800,crystals:16},
  {id:'eclipse',name:['Trono do Eclipse','Eclipse Throne'],level:65,waves:6,bossName:['Imperador do Eclipse','Eclipse Emperor'],region:'eclipse',gold:4200,crystals:20},
];

export const DUNGEON_DIFFICULTIES = [
  {id:'normal',name:['Normal','Normal'],extra:0,factor:1},
  {id:'elite',name:['Elite','Elite'],extra:8,factor:1.6},
  {id:'nightmare',name:['Pesadelo','Nightmare'],extra:18,factor:2.4},
  {id:'abyssal',name:['Abissal','Abyssal'],extra:30,factor:3.5},
] as const;
export function dungeonVariant(base:DungeonDefinition,id:string):DungeonDefinition {
  const d=DUNGEON_DIFFICULTIES.find(d=>d.id===id)??DUNGEON_DIFFICULTIES[0];
  return {...base,level:Math.min(100,base.level+d.extra),waves:base.waves+(d.id==='normal'?0:d.id==='elite'?1:2),name:[base.name[0]+' · '+d.name[0],base.name[1]+' · '+d.name[1]],gold:Math.round(base.gold*d.factor),crystals:Math.round(base.crystals*d.factor)};
}
