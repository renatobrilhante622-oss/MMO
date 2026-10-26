import {REGIONS} from './Regions';
import {mapDefinition} from './maps/MapDefinitions';
export type ActivityKind='board'|'ruin'|'rare'|'defense'|'captain'|'camp'|'shrine'|'nest'|'rift';
export interface ActivitySite {id:string;region:string;kind:ActivityKind;name:string;x:number;z:number;level:number;variant:number;}
const layouts=new Map<string,ActivitySite[]>(),cells=new Map<string,Map<string,ActivitySite[]>>();
const labels:Record<ActivityKind,string>={board:'Contratos de Caça',ruin:'Ruínas da Vigília',rare:'Reagentes ancestrais',defense:'Totem da Resistência',captain:'Capitão Corrompido',camp:'Acampamento Inimigo',shrine:'Santuário Ancestral',nest:'Ninho Corrompido',rift:'Fenda Abissal'};
/** Routes are dotted with usable landmarks every ~28m; one catalog owns all stable IDs. */
export function activityLayout(region:string):readonly ActivitySite[]{
 const existing=layouts.get(region);if(existing)return existing;
 const def=mapDefinition(region),r=REGIONS.find(r=>r.id===region);if(!r)return [];
 const sites:ActivitySite[]=[],counts:Partial<Record<ActivityKind,number>>={};
 const add=(kind:ActivityKind,x:number,z:number,force=false)=>{
  if(!force&&(Math.hypot(x,z-18)<34||Math.abs(x)>def.size/2-28||Math.abs(z)>def.size/2-28||Math.hypot(x-def.exit.x,z-def.exit.z)<22||Math.hypot(x-def.boss.x,z-def.boss.z)<24||Math.hypot(x-30,z+42)<16||sites.some(s=>Math.hypot(x-s.x,z-s.z)<20)))return;
  if(region==='aurora'&&!force&&Math.abs(x-(45+Math.sin(z*.019)*13))<25)return;
  const index=counts[kind]??0;counts[kind]=index+1;const stage=Math.min(1,Math.hypot(x,z-18)/(def.size*.45));
  sites.push({id:`${region}-${kind}-${index}`,region,kind,name:kind==='captain'?[({aurora:'Devorador do Bosque',crypt:'Devorador da Cripta',highlands:'Devorador Glacial',rift:'Devorador de Magma',eclipse:'Devorador do Abismo'} as Record<string,string>)[region],'Marechal Corrompido','Campeão Mutante','Vigia da Ruína','Carrasco Ancestral','Arauto da Fenda'][index%6]:labels[kind],x,z,level:Math.round(r.minLevel+(r.maxLevel-r.minLevel)*stage),variant:index%3});
 };
 const length=Math.abs(def.boss.z-18);
 add('board',7,25,true);add('ruin',-10,-44,true);add('rare',-24,-70,true);add('defense',-18,18-length*.42,true);
 add('nest',18,18-length*.28,true);add('nest',-38,18-length*.36,true);add('camp',-45,18-length*.52,true);
 add('ruin',-8,18-length*.78,true);add('rift',-62,18-length*.70,true);add('rift',-def.size*.20,def.size*.10,true);add('rift',def.size*.20,-def.size*.25,true);
 for(let i=0;i<6;i++){
  const first=i<2,x=first?(i===0?-38:28):(i%2?-1:1)*def.size*.25,z=first?18-length*(i===0?.55:.72):def.size*(i<4?.22:-.25);
  add('captain',x,z,true);
 }
 const types:ActivityKind[]=['shrine','rare','nest','ruin','camp'];let serial=0;
 const targets=[def.exit,...Array.from({length:18},(_,i)=>({x:((i%3)-1)*def.size*.24+(i%3===1?28:0),z:def.size*.35-Math.floor(i/3)*def.size*.14}))];
 for(const target of targets){const distance=Math.hypot(target.x,target.z-18),steps=Math.ceil(distance/28);for(let i=1;i<steps;i++){const t=i/steps;add(types[serial++%types.length],target.x*t,18+(target.z-18)*t);}}
 layouts.set(region,sites);const grid=new Map<string,ActivitySite[]>();for(const s of sites){const key=Math.floor(s.x/32)+','+Math.floor(s.z/32);const bucket=grid.get(key)??[];bucket.push(s);grid.set(key,bucket);}cells.set(region,grid);return sites;
}
/** Spatial lookup keeps terrain construction bounded even with hundreds of activities. */
export function activitySitesNear(region:string,x:number,z:number,radius:number):ActivitySite[]{
 activityLayout(region);const grid=cells.get(region);if(!grid)return [];const found:ActivitySite[]=[];
 for(let i=Math.floor((x-radius)/32);i<=Math.floor((x+radius)/32);i++)for(let j=Math.floor((z-radius)/32);j<=Math.floor((z+radius)/32);j++)for(const s of grid.get(i+','+j)??[])if(Math.hypot(s.x-x,s.z-z)<=radius)found.push(s);
 return found;
}
