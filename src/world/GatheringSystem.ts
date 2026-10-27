import {loadSharedModel} from '../assets/ModelResources';
import {GatheringTask} from './GatheringTask';
import {mapDefinition} from './maps/MapDefinitions';
import {Box3,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,Quaternion,Scene,Vector3} from 'three';
import type {PerspectiveCamera} from 'three';
export type GatherKind='ore'|'herb'|'chest';
export interface GatherNode{id:string;kind:GatherKind;x:number;z:number;cooldown:number;}
export interface GatheringSave{stock:Record<string,number>;exhausted:Record<string,number>;crafts:Record<string,number>;buffs:Record<string,number>;elapsed:number;}
export const GATHER_RECIPES=[
 {id:'damage',name:'Elixir de Fúria (+30% Dano)',cost:{ore:3,herb:2,chest:0},seconds:180},
 {id:'xp',name:'Elixir do Sábio (+50% XP)',cost:{ore:1,herb:4,chest:0},seconds:300},
 {id:'speed',name:'Elixir do Vento (+25% Velocidade)',cost:{ore:2,herb:3,chest:0},seconds:180},
 {id:'refine',name:'Pedra de Refino',cost:{ore:6,herb:1,chest:0},seconds:0},
 {id:'key',name:'Chave Ancestral',cost:{ore:4,herb:3,chest:0},seconds:0},
] as const;
const models:Record<GatherKind,string>={
 ore:'models/dungeon/Kenney_Dungeon_crystal.glb',
 herb:'models/gathering/Kenney_Flower_Astral.glb',
 chest:'models/dungeon/Kenney_Dungeon_chest.glb',
};
function rng(seed:number):()=>number{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export class GatheringSystem{
 readonly root=new Group();
 readonly nodes:GatherNode[]=[];
 stock:Record<GatherKind,number>={ore:0,herb:0,chest:0};
 crafts:Record<string,number>={refine:0,key:0};
 buffs:Record<string,number>={damage:0,xp:0,speed:0};
 private readonly task=new GatheringTask();
 private readonly lastPosition=new Vector3();
 private readonly projected=new Vector3();
 private camera?:PerspectiveCamera;
 private hasPosition=false;
 get working():boolean{return !!this.task.id;}
 private exhausted=new Map<string,number>();
 private elapsed=0;
 private destroyed=false;
 private instances:InstancedMesh[]=[];
 private readonly nodeInstances=new Map<string,Array<{mesh:InstancedMesh;index:number;matrix:Matrix4}>>();
 private readonly label=document.createElement('div');
 private readonly action=document.createElement('button');
 private readonly bar=document.createElement('progress');
 private readonly progressLabel=document.createElement('div');
 constructor(private scene:Scene,private host:HTMLElement,readonly regionId:string,private heightAt:(x:number,z:number)=>number,private onCollect:(kind:GatherKind)=>void){
   this.root.name='Five-region authored gathering nodes';
   this.scene.add(this.root);
   const r=rng(9147+regionId.split('').reduce((v,c)=>v+c.charCodeAt(0),0)*33);
   for(let i=0;i<(regionId==='dungeon'?0:27);i++){
    const kind:GatherKind=i%9===0?'chest':i%2===0?'ore':'herb';
    const x=(r()-.5)*(mapDefinition(regionId).size-60),z=(r()-.5)*(mapDefinition(regionId).size-60);
    if(Math.hypot(x,z-18)<19||this.heightAt(x,z)<2)continue;
    this.nodes.push({id:regionId+'-'+i,kind,x,z,cooldown:kind==='chest'?360:140});
   }
   if(regionId!=='dungeon')for(let i=0;i<9;i++){
    const z=i<3?-24-i*12:-24-(i-2)*Math.abs(mapDefinition(regionId).exit.z)*.12,x=Math.sin(z*.028)*4+2;
    this.nodes.push({id:regionId+'-campaign-'+i,kind:i%2?'ore':'herb',x,z,cooldown:140});
   }
   this.label.className='gather-context';this.label.hidden=true;
   this.action.type='button';this.action.className='gather-action';this.action.onclick=()=>this.start();
   this.bar.max=GatheringTask.DURATION;this.bar.value=0;this.bar.setAttribute('aria-label','Coletando · 1,5s');
   this.progressLabel.className='gather-head-progress';this.progressLabel.hidden=true;this.progressLabel.append(this.bar);
   this.label.append(this.action);host.append(this.label,this.progressLabel);
   if(typeof document!=='undefined'&&regionId!=='dungeon')void this.build();
 }
 private async build():Promise<void>{
  for(const kind of ['ore','herb','chest'] as GatherKind[]){
   try{
    const gltf=await loadSharedModel(models[kind]);
    if(this.destroyed)return;
    gltf.scene.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(gltf.scene);if(bounds.isEmpty())continue;
    const scale=(kind==='ore'?1.65:kind==='herb'?1.25:1.4)/Math.max(.01,bounds.getSize(new Vector3()).y);
    const nodes=this.nodes.filter(n=>n.kind===kind);
    gltf.scene.traverse(object=>{
     if(!(object instanceof Mesh))return;
     const inst=new InstancedMesh(object.geometry,object.material,nodes.length);
     inst.name=kind+' CC0 gather props';inst.castShadow=false;inst.receiveShadow=true;inst.frustumCulled=false;
     nodes.forEach((node,i)=>{
      const base=new Matrix4().compose(new Vector3(node.x,this.heightAt(node.x,node.z),node.z),new Quaternion(),new Vector3(scale,scale,scale))
       .multiply(new Matrix4().makeTranslation(-bounds.getCenter(new Vector3()).x,-bounds.min.y,-bounds.getCenter(new Vector3()).z));
      base.multiply(object.matrixWorld);
      inst.setMatrixAt(i,base);
      const recorded=this.nodeInstances.get(node.id)??[];
      recorded.push({mesh:inst,index:i,matrix:base.clone()});this.nodeInstances.set(node.id,recorded);
      if((this.exhausted.get(node.id)??0)>this.elapsed)this.showNode(node.id,false);
     });
     inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();this.root.add(inst);this.instances.push(inst);
    });
   }catch(error){console.warn('Gatherable CC0 GLB unavailable:',kind,error);}
  }
 }
 /** Hide depleted authored GLB submeshes; restore their original instances at respawn. */
 private showNode(id:string,visible:boolean):void{
  for(const part of this.nodeInstances.get(id)??[]){
   part.mesh.setMatrixAt(part.index,visible?part.matrix:new Matrix4().makeScale(0,0,0));
   part.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 get progress():number{return this.task.elapsed;}
 get target():GatherNode|null{return this.nodes.find(n=>n.id===this.task.id)??null;}

 closest(position:Vector3):GatherNode|null{
  let result:GatherNode|null=null,dist=3.4;
  for(const n of this.nodes){if((this.exhausted.get(n.id)??0)>this.elapsed)continue;
   const d=Math.hypot(n.x-position.x,n.z-position.z);if(d<dist){dist=d;result=n;}}
  return result;
 }
 start():boolean{
  if(!this.hasPosition||this.destroyed||this.task.id)return false;const node=this.closest(this.lastPosition);
  if(!node||node.kind==='chest'&&this.crafts.key<1)return false;
  if(!this.task.start(node.id,this.lastPosition.x,this.lastPosition.z))return false;
  this.label.hidden=true;this.renderHead();return true;
 }
 private renderHead():void{
  this.progressLabel.hidden=!this.task.id||!this.camera;
  if(this.progressLabel.hidden)return;
  this.projected.copy(this.lastPosition);this.projected.y+=1.8;this.projected.project(this.camera!);
  if(this.projected.z< -1||this.projected.z>1||Math.abs(this.projected.x)>1||Math.abs(this.projected.y)>1){this.progressLabel.hidden=true;return;}
  this.progressLabel.style.left=((this.projected.x+1)*.5*this.host.clientWidth)+'px';this.progressLabel.style.top=((1-this.projected.y)*.5*this.host.clientHeight)+'px';this.bar.value=this.task.elapsed;
 }
 update(dt:number,position:Vector3,active:boolean,camera?:PerspectiveCamera):void{
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;this.elapsed+=dt;this.lastPosition.copy(position);this.hasPosition=active;this.camera=camera;
  for(const node of this.nodes)if((this.exhausted.get(node.id)??0)>0&&(this.exhausted.get(node.id)??0)<=this.elapsed){this.exhausted.delete(node.id);this.showNode(node.id,true);}
  if(!active){this.task.cancel();this.label.hidden=true;this.progressLabel.hidden=true;return;}
  const nearest=this.closest(position),result=this.task.advance(dt,position.x,position.z,active);
  if(result==='complete'){
   const node=this.target;
   if(node&&(node.kind!=='chest'||this.crafts.key>0)){
    if(node.kind==='chest')this.crafts.key--;
    this.exhausted.set(node.id,this.elapsed+node.cooldown);this.showNode(node.id,false);this.stock[node.kind]=Math.min(99999,this.stock[node.kind]+1);this.task.cancel();this.onCollect(node.kind);
   }else this.task.cancel();
  }
  this.label.hidden=!!this.task.id||!nearest||result==='complete';this.action.hidden=!!this.task.id;
  if(nearest&&!this.task.id){this.label.dataset.id=nearest.id;this.action.disabled=nearest.kind==='chest'&&this.crafts.key<1;this.action.title=this.action.disabled?'Requer Chave Ancestral':'';this.action.textContent=nearest.kind==='ore'?'⛏ Coletar':nearest.kind==='herb'?'🌿 Extrair':'♜ Abrir';}
  this.renderHead();
 }

 craft(id:string):boolean{
  const r=GATHER_RECIPES.find(x=>x.id===id);if(!r)return false;
  if((this.stock.ore<r.cost.ore)||(this.stock.herb<r.cost.herb)||(this.stock.chest<r.cost.chest))return false;
  this.stock.ore-=r.cost.ore;this.stock.herb-=r.cost.herb;this.stock.chest-=r.cost.chest;
  if(r.seconds>0)this.buffs[id]=Math.min(86400,(this.buffs[id]??0)+r.seconds);
  else this.crafts[id]=(this.crafts[id]??0)+1;
  return true;
 }
 tickBuffs(dt:number):void{for(const k of Object.keys(this.buffs))this.buffs[k]=Math.max(0,this.buffs[k]-Math.max(0,dt));}
 multiplier(id:'damage'|'xp'|'speed'):number{return (this.buffs[id]??0)>0?({damage:1.3,xp:1.5,speed:1.25})[id]:1;}
 snapshot():GatheringSave{return {stock:{...this.stock},exhausted:Object.fromEntries(this.exhausted),crafts:{...this.crafts},buffs:{...this.buffs},elapsed:this.elapsed};}
 restore(raw:unknown):void{
  if(!raw||typeof raw!=='object')return;const r=raw as Record<string,unknown>;
  const num=(x:unknown,max=99999)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(max,x)):0;
  this.elapsed=num(r.elapsed,1e9);
  if(r.stock&&typeof r.stock==='object')for(const k of ['ore','herb','chest'] as const)this.stock[k]=Math.floor(num((r.stock as Record<string,unknown>)[k]));
  if(r.crafts&&typeof r.crafts==='object')for(const k of ['refine','key'])this.crafts[k]=Math.floor(num((r.crafts as Record<string,unknown>)[k]));
  if(r.buffs&&typeof r.buffs==='object')for(const k of ['damage','xp','speed'])this.buffs[k]=num((r.buffs as Record<string,unknown>)[k],86400);
  if(r.exhausted&&typeof r.exhausted==='object')for(const [k,v]of Object.entries(r.exhausted)){if(this.nodes.some(n=>n.id===k)){this.exhausted.set(k,num(v,1e9));this.showNode(k,(this.exhausted.get(k)??0)<=this.elapsed);}}
 }
 dispose():void{
  this.destroyed=true;this.task.cancel();this.label.remove();this.progressLabel.remove();this.root.removeFromParent();
  for(const inst of this.instances){inst.removeFromParent();inst.dispose();}this.instances=[];this.nodeInstances.clear();
 }
}
