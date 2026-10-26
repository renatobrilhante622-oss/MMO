export type WorldMapId='aurora'|'crypt'|'highlands'|'rift'|'eclipse';
export interface MapDefinition {
 id:WorldMapId;size:number;seed:number;fog:string;fogDensity:number;sky:string;horizon:string;sun:number;
 entry:{x:number;z:number};exit:{x:number;z:number};boss:{x:number;z:number};
 landmarks:readonly {asset:string;x:number;z:number;size:number;tint?:number}[];
}
const ORIGINAL_MAPS:Record<WorldMapId,MapDefinition>={
 aurora:{id:'aurora',size:360,seed:713,fog:'#9abdb0',fogDensity:.0028,sky:'#377fa1',horizon:'#cce0ba',sun:2.4,entry:{x:0,z:18},exit:{x:0,z:-138},boss:{x:-35,z:-98},landmarks:[{asset:'Bridge',x:48,z:-8,size:14},{asset:'Village',x:-18,z:28,size:16},{asset:'MossRuins',x:28,z:-92,size:12}]},
 crypt:{id:'crypt',size:400,seed:1722,fog:'#52445e',fogDensity:.013,sky:'#211b35',horizon:'#665472',sun:.65,entry:{x:0,z:18},exit:{x:0,z:-158},boss:{x:-25,z:-116},landmarks:[{asset:'DeadTree',x:-20,z:-52,size:9},{asset:'Crypt',x:23,z:-112,size:14},{asset:'Coffin',x:-17,z:-60,size:3},{asset:'Skull',x:10,z:-84,size:2.4}]},
 highlands:{id:'highlands',size:420,seed:2731,fog:'#abc9e3',fogDensity:.0048,sky:'#5d85b1',horizon:'#e4f3ff',sun:1.8,entry:{x:0,z:18},exit:{x:0,z:-174},boss:{x:-26,z:-136},landmarks:[{asset:'SnowPine',x:-20,z:-48,size:16},{asset:'BlueCrystal',x:-27,z:-132,size:20,tint:0x54cfff},{asset:'BlueCrystal',x:33,z:-95,size:15,tint:0x8beaff}]},
 rift:{id:'rift',size:440,seed:3740,fog:'#4b2427',fogDensity:.006,sky:'#210e20',horizon:'#d64b23',sun:.95,entry:{x:0,z:18},exit:{x:0,z:-188},boss:{x:-24,z:-148},landmarks:[{asset:'Anvil',x:28,z:-146,size:14},{asset:'IronBridge',x:40,z:-76,size:28,tint:0x62687a},{asset:'Chain',x:-12,z:-133,size:9}]},
 eclipse:{id:'eclipse',size:480,seed:4749,fog:'#180c34',fogDensity:.003,sky:'#05051a',horizon:'#30144a',sun:.5,entry:{x:0,z:18},exit:{x:0,z:-206},boss:{x:0,z:-174},landmarks:[{asset:'Obelisk',x:-16,z:-96,size:18,tint:0x9273cf},{asset:'VoidArch',x:0,z:-173,size:24,tint:0xa080d2},{asset:'BlueCrystal',x:16,z:-142,size:14,tint:0x9a42ff}]},
};
/** Twice the side length gives four times the physical terrain area. */
export const MAP_SIDE_SCALE=2;
const expand=(p:{x:number;z:number})=>({x:p.x*MAP_SIDE_SCALE,z:18+(p.z-18)*MAP_SIDE_SCALE});
export const WORLD_MAPS=Object.values(ORIGINAL_MAPS).reduce<Record<WorldMapId,MapDefinition>>((maps,def)=>{
 maps[def.id]={...def,size:def.size*MAP_SIDE_SCALE,exit:expand(def.exit),boss:expand(def.boss),landmarks:def.landmarks.map(p=>({...p,...(['Village','Bridge','IronBridge'].includes(p.asset)?{x:p.x,z:p.z}:expand(p))}))};return maps;
},{...ORIGINAL_MAPS});
export function mapDefinition(id:string):MapDefinition{return WORLD_MAPS[id as WorldMapId]??WORLD_MAPS.aurora;}
/** Main route and camp stay walkable; each map owns an independent heightfield. */
export function regionalHeight(id:string,x:number,z:number,noise:(x:number,z:number)=>number):number{
 const worldX=x,worldZ=z;
 x/=MAP_SIDE_SCALE;z=18+(z-18)/MAP_SIDE_SCALE;
 const def=ORIGINAL_MAPS[id as WorldMapId]??ORIGINAL_MAPS.aurora,path=Math.abs(x-Math.sin(z*.028)*4),camp=Math.hypot(x,z-18);
 let h=6;
 if(id==='aurora'){
  h=4+noise(x*.017,z*.017)*10+(noise(x*.08,z*.08)-.5)*2;
  const river=Math.abs(worldX-(45+Math.sin(worldZ*.019)*13));if(river<17){const t=Math.max(0,Math.min(1,(17-river)/9));h=h*(1-t)+(-3.4)*t;}
  const lake=Math.hypot(worldX-47,worldZ+3);if(lake<22){const t=Math.max(0,Math.min(1,(22-lake)/9));h=h*(1-t)+(-3.4)*t;}
 }else if(id==='crypt')h=4+noise(x*.037,z*.037)*3+Math.sin(x*.04)*.7;
 else if(id==='highlands')h=9+Math.abs(Math.sin(x*.025))*14+noise(x*.039,z*.039)*8;
 else if(id==='rift'){
  const lava=Math.abs(worldX-40-Math.sin(worldZ*.04)*18);h=7+noise(x*.06,z*.035)*9;if(lava<9)h=-1.5;
  if(Math.abs(worldZ+76)<5&&Math.abs(worldX-40)<20)h=8;
 }else if(id==='eclipse'){
  const centers=[[0,18],[32,-40],[-25,-95],[0,-174],[66,-131]];
  const d=Math.min(...centers.map(([cx,cz])=>Math.hypot(x-cx,z-cz)));
  h=d<39?14+noise(x*.045,z*.045)*3:-30;
 }
 const flat=id==='highlands'?12:id==='eclipse'?15:6;
 const pathBlend=Math.max(0,Math.min(1,(10-path)/5));if(z<40&&z>def.exit.z-10)h=h*(1-pathBlend)+flat*pathBlend;
 const campBlend=Math.max(0,Math.min(1,(26-camp)/10));h=h*(1-campBlend)+flat*campBlend;
 // Dedicated boss clearing and portal landing, never sampled from another region.
 for(const p of [def.boss,def.exit]){const t=Math.max(0,Math.min(1,(19-Math.hypot(x-p.x,z-p.z))/7));h=h*(1-t)+flat*t;}
 if(id!=='eclipse')h+=Math.pow(Math.max(0,(Math.max(Math.abs(x),Math.abs(z))-def.size*.43)/(def.size*.07)),2)*24;
 return h;
}
