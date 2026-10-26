import {activityLayout,activitySitesNear} from './ActivityLayout';
import {mapDefinition,type WorldMapId} from './maps/MapDefinitions';
import {REGIONS} from './Regions';
export interface HuntSpot {id:string;name:string;kind:string;x:number;z:number;radius:number;capacity:number;respawn:number;level:number;}
export interface ExplorationProp {id:string;asset:string;x:number;z:number;size:number;yaw:number;solid:boolean;foundation:boolean;}
export interface MapPlan {props:ExplorationProp[];spots:HuntSpot[];}
const huntName=(kind:string)=>({'slime':'Clareira dos Slimes','wolf':'Bosque dos Lobos','skeleton':'Ruínas dos Esqueletos','wraith':'Vigília dos Espectros','golem':'Pedreira dos Colossos'} as Record<string,string>)[kind]??'Área de caça';
const cache=new Map<string,MapPlan>();
const fieldBridges=new Map<string,ReturnType<typeof activityLayout>>();
const foundations=new Map<string,Array<{x:number;z:number;size:number}>>();
const native:Record<WorldMapId,string[]>={aurora:['MossRuins','DeadTree'],crypt:['Crypt','Coffin','DeadTree'],highlands:['BlueCrystal','SnowPine','MossRuins'],rift:['Anvil','Chain','MossRuins'],eclipse:['Obelisk','VoidArch','BlueCrystal']};
/** Seeded full-map content plan shared by heightfields, navigation, GLB batches and hunting. */
export function generateMapPlan(id:string):MapPlan {
 if(!REGIONS.some(r=>r.id===id))return {props:[],spots:[]};
 const existing=cache.get(id);if(existing)return existing;
 const def=mapDefinition(id),region=REGIONS.find(r=>r.id===id)!,props:ExplorationProp[]=[],spots:HuntSpot[]=[];
 let seed=def.seed;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // Separate hunting clearings spread across both sides and the full depth of each expanded map.
 for(let i=0;i<18;i++){
  const row=Math.floor(i/3),col=i%3,x=(col-1)*def.size*.24+(col===1?28:0),z=def.size*.35-row*def.size*.14;
  const stage=Math.min(1,Math.hypot(x,z-18)/(def.size*.55));
  const kind=region.kinds[i%region.kinds.length];
  spots.push({id:id+'-spot-'+i,name:huntName(kind),kind,x,z,radius:13,capacity:6,respawn:12+Math.floor(stage*6),level:Math.round(region.minLevel+(region.maxLevel-region.minLevel)*stage)});
 }
 // A beginner hunt always exists just north of the village, close to quest and gathering NPCs.
 spots[1]={...spots[1],x:-12,z:-26,kind:region.kinds[0],name:huntName(region.kinds[0]),level:region.minLevel};
 spots[4]={...spots[4],x:28,z:-34,kind:region.kinds[1]??region.kinds[0],name:huntName(region.kinds[1]??region.kinds[0]),level:Math.min(region.maxLevel,region.minLevel+2)};
 for(let i=0;i<64;i++){
  const angle=i*2.399963+rand()*.25,radius=def.size*(.12+rand()*.29),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(Math.hypot(x,z-18)<40||Math.abs(x)<14&&z<35&&z>def.exit.z-16||Math.hypot(x-def.exit.x,z-def.exit.z)<24||Math.hypot(x-def.boss.x,z-def.boss.z)<25||spots.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+8))continue;
  const asset=native[def.id][i%native[def.id].length],size=asset==='Chain'?6:asset==='Coffin'?3:8+rand()*9;
  if(activityLayout(id).some(s=>Math.hypot(x-s.x,z-s.z)<size*.5+13))continue;
  if(props.some(p=>Math.max(Math.abs(p.x-x),Math.abs(p.z-z))<(p.size+size)/2+14)||def.landmarks.some(p=>Math.max(Math.abs(p.x-x),Math.abs(p.z-z))<(p.size+size)/2+14))continue;
  props.push({id:id+'-landmark-'+i,asset,x,z,size,yaw:rand()*Math.PI*2,solid:asset!=='Chain',foundation:true});
 }
 if(id==='aurora')for(const [i,p]of [[18,30],[-18,0],[18,0]].entries())props.push({id:'village-'+i,asset:'Village',x:p[0],z:p[1],size:13.76,yaw:i*Math.PI/2,solid:true,foundation:true});
 const plan={props,spots};cache.set(id,plan);return plan;
}
/** Small level foundations blend into natural slopes; they don't bury one side of a building. */
export function foundationHeight(id:string,x:number,z:number,base:(x:number,z:number)=>number):number {
 let h=base(x,z);const def=mapDefinition(id);
 let sites=foundations.get(id);if(!sites){sites=[...def.landmarks.filter(s=>s.asset!=='IronBridge'&&s.asset!=='Bridge'&&s.asset!=='Chain'),...generateMapPlan(id).props.filter(p=>p.foundation)];foundations.set(id,sites);}
 for(const s of sites){const half=s.size*.5+5,d=Math.max(Math.abs(x-s.x),Math.abs(z-s.z));if(d>half+6)continue;const blend=Math.max(0,Math.min(1,(half+6-d)/6));const smooth=blend*blend*(3-2*blend);const anchor=base(s.x,s.z);h=h*(1-smooth)+(id==='eclipse'?Math.max(15,anchor):anchor)*smooth;}
 if(id==='eclipse')for(const spot of generateMapPlan(id).spots){
  const dx=spot.x,dz=spot.z-18,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,(x*dx+(z-18)*dz)/length)):0,d=Math.hypot(x-t*dx,z-18-t*dz);
  if(d<10){const blend=Math.max(0,Math.min(1,(10-d)/3));h=h*(1-blend)+15*blend;}
 }
 if(id==='eclipse'&&!fieldBridges.has(id))fieldBridges.set(id,activityLayout(id).filter(s=>['captain','rift','defense'].includes(s.kind)||s.id.endsWith('-ruin-0')||s.id.endsWith('-ruin-1')));
 if(id==='eclipse')for(const s of fieldBridges.get(id)??[]){const dx=s.x,dz=s.z-18,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,(x*dx+(z-18)*dz)/l)):0,d=Math.hypot(x-t*dx,z-18-t*dz);if(d<7){const blend=Math.min(1,(7-d)/2);h=h*(1-blend)+15*blend;}}
 for(const s of activitySitesNear(id,x,z,22)){const radius=s.kind==='camp'?12:s.kind==='captain'||s.kind==='defense'||s.kind==='rift'?11:5,d=Math.hypot(x-s.x,z-s.z);if(d>radius+5)continue;const blend=Math.min(1,(radius+5-d)/5),anchor=Math.max(id==='eclipse'?15:id==='highlands'?12:6,base(s.x,s.z));h=h*(1-blend)+anchor*blend;}
 // Hunting clearings remain walkable even on the floating islands of the last region.
 for(const s of generateMapPlan(id).spots){const d=Math.hypot(x-s.x,z-s.z),r=s.radius+5;if(d>r+6)continue;const blend=Math.max(0,Math.min(1,(r+6-d)/6));const level=Math.max(id==='eclipse'?15:id==='highlands'?12:6,base(s.x,s.z));h=h*(1-blend)+level*blend;}
 return h;
}
