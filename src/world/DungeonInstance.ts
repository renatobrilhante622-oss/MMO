import {
  Box3,Group,Mesh,MeshStandardMaterial,PointLight,Scene,Vector3,InstancedMesh,Matrix4,Quaternion
} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {OpenWorldGenerator,WorldCollider} from './OpenWorldGenerator';

export type DungeonRoom='guardians'|'crystals'|'boss';
export const DUNGEON_ROOMS:readonly {id:DungeonRoom;name:string;x:number;z:number}[]=[
  {id:'guardians',name:'Sala 1/3: Elimine os Guardiões',x:0,z:-30},
  {id:'crystals',name:'Sala 2/3: Destrua os Cristais',x:0,z:-50},
  {id:'boss',name:'Sala 3/3: CHEFE DA MASMORRA',x:0,z:-70},
];
interface ModelPlan {
 name:string;
 spots:readonly {x:number;z:number;rotation?:number;height:number}[];
}
const at=(x:number,z:number,height:number,rotation=0)=>({x,z,height,rotation});
const PLAN:readonly ModelPlan[]=[
 {name:'floor',spots:[
   ...[-15,-5,5,15].flatMap(x=>[-30,-50,-70].map(z=>at(x,z,9))),
   ...[-16,-8,0,8,16].flatMap(x=>[-78,-70,-62].map(z=>at(x,z,7))),
 ]},
 {name:'floor-detail',spots:[at(0,-30,9),at(0,-50,9),at(0,-70,10)]},
 {name:'wall',spots:[
   ...[-17,17].flatMap(x=>[-80,-70,-60,-50,-40,-30,-20].map(z=>at(x,z,5,Math.PI/2))),
   ...[-16,-8,0,8,16].flatMap(x=>[-85,-17].map(z=>at(x,z,5))),
 ]},
 {name:'column',spots:[...[-13,13].flatMap(x=>[-78,-65,-52,-33].map(z=>at(x,z,5)))]},
 {name:'gate',spots:[at(0,-43,5),at(0,-62,5)]},
 {name:'wall-opening',spots:[at(-7,-43,4),at(7,-43,4),at(-7,-62,4),at(7,-62,4)]},
 {name:'trap',spots:[at(-5,-48,3),at(5,-51,3)]},
 {name:'stairs',spots:[at(0,-38,4),at(0,-57,4)]},
 {name:'fire-basket',spots:[at(-12,-30,1.7),at(12,-30,1.7),at(-12,-50,1.7),at(12,-50,1.7),at(-12,-70,1.7),at(12,-70,1.7)]},
 {name:'chest',spots:[at(0,-82,3)]},
];
const loader=new GLTFLoader();
const loaded=new Map<string,Promise<GLTF>>();
function load(name:string):Promise<GLTF>{
 let task=loaded.get(name);
 if(!task){
  task=loader.loadAsync(import.meta.env.BASE_URL+'models/dungeon/Kenney_Dungeon_'+name+'.glb');
  loaded.set(name,task);
  void task.catch(()=>loaded.delete(name));
 }
 return task;
}

/** Physical collision walls are installed with the separate Cannon heightfield. */
export function dungeonColliders(height:(x:number,z:number)=>number):WorldCollider[]{
 const result:WorldCollider[]=[];
 for(const x of [-18,18]){
  const z=-51;
  result.push({position:new Vector3(x,height(x,z)+3,z),size:new Vector3(2,6,72),type:'solid'});
 }
 for(const z of [-86,-17]){
  result.push({position:new Vector3(0,height(0,z)+3,z),size:new Vector3(38,6,2),type:'solid'});
 }
 return result;
}
/** A bespoke, fully owned indoor scene graph using only source-authored GLB props. */
export class DungeonInstance {
 readonly root=new Group();
 private readonly visualMeshes:InstancedMesh[]=[];
 private readonly materials=new Set<MeshStandardMaterial>();
 private readonly lights:PointLight[]=[];
 private disposed=false;
 private readonly gateNodes:Group[]=[];
 private chest?:Group;
 private readonly crystalStates=[-7,0,7].map(x=>({
   position:new Vector3(x,3.4,-50),hp:100,model:undefined as Group|undefined,
 }));
 private strikeCooldown=0;
 get crystalsRemaining():number{return this.crystalStates.filter(crystal=>crystal.hp>0).length;}
 get crystalsDestroyed():number{return this.crystalStates.length-this.crystalsRemaining;}
 /** Accepted strikes damage only active crystals at actual melee distance. */
 strikeCrystal(hero:Vector3,damage=50):boolean{
   if(this.strikeCooldown>0)return false;
   const crystal=this.crystalStates.find(c=>c.hp>0&&Math.hypot(hero.x-c.position.x,hero.z-c.position.z)<3.1);
   if(!crystal)return false;
   crystal.hp=Math.max(0,crystal.hp-Math.max(0,Math.min(100,damage)));
   this.strikeCooldown=.42;
   if(crystal.hp<=0&&crystal.model)crystal.model.visible=false;
   return true;
 }
 readonly ready:Promise<void>;
 readonly startedAt=performance.now();
 private elapsed=0;
 constructor(private readonly scene:Scene,private readonly terrain:OpenWorldGenerator){
  this.root.name='Loaded indoor dungeon instance';
  scene.add(this.root);
  this.ready=typeof document==='undefined'?Promise.resolve():this.build();
 }
 roomForWave(wave:number,waves:number):number{
  if(wave>waves)return 2;
  if(wave<=Math.ceil(waves/2))return 0;
  return 1;
 }
 roomPoint(wave:number,waves:number):Vector3{
  const room=DUNGEON_ROOMS[this.roomForWave(wave,waves)];
  return new Vector3(room.x,this.terrain.heightAt(room.x,room.z)+1.2,room.z);
 }
 private async build():Promise<void>{
  for(const plan of PLAN){
   if(this.disposed)return;
   let gltf:GLTF;
   try{gltf=await load(plan.name);}
   catch(error){console.error('Missing CC0 indoor dungeon art:',plan.name,error);continue;}
   if(this.disposed)return;
   const model=gltf.scene;model.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(model);
   if(bounds.isEmpty())continue;
   const heightSource=Math.max(.001,bounds.max.y-bounds.min.y);
   const materials=new Map<MeshStandardMaterial,MeshStandardMaterial>();
   const placements=plan.spots.map(spot=>{
    const scale=spot.height/heightSource;
    const pos=new Vector3(spot.x,this.terrain.heightAt(spot.x,spot.z),spot.z);
    const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),spot.rotation??0);
    const transform=new Matrix4().compose(pos,rotation,new Vector3(scale,scale,scale));
    return transform.multiply(new Matrix4().makeTranslation(-bounds.getCenter(new Vector3()).x,-bounds.min.y,-bounds.getCenter(new Vector3()).z));
   });
   const group=new Group();group.name='Dungeon set: '+plan.name;
   model.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const originals=Array.isArray(object.material)?object.material:[object.material];
    const copies=originals.map(source=>{
      if(!(source instanceof MeshStandardMaterial))return source;
      let copy=materials.get(source);
      if(!copy){
       copy=source.clone();
       copy.emissive.setRGB(.10,.08,.07);
       copy.emissiveIntensity=.28;
       materials.set(source,copy);
       this.materials.add(copy);
      }
      return copy;
    });
    const batch=new InstancedMesh(object.geometry,Array.isArray(object.material)?copies:copies[0],placements.length);
    batch.name='Real GLB '+plan.name+'/'+object.name;
    batch.castShadow=false;batch.receiveShadow=false;
    for(let i=0;i<placements.length;i++)batch.setMatrixAt(i,placements[i].clone().multiply(object.matrixWorld));
    batch.instanceMatrix.needsUpdate=true;
    batch.computeBoundingSphere();
    group.add(batch);this.visualMeshes.push(batch);
   });
   this.root.add(group);
   if(plan.name==='gate')this.gateNodes.push(group);
   if(plan.name==='chest'){this.chest=group;group.visible=false;}
  }
  try{
    const crystal=await load('crystal');
    if(this.disposed)return;
    const source=crystal.scene;
    const box=new Box3().setFromObject(source);
    for(const state of this.crystalStates){
      const object=source.clone(true);
      const actor=new Group();
      actor.name='Breakable CC0 crystal';
      actor.position.copy(state.position);
      const h=Math.max(.001,box.max.y-box.min.y);
      object.scale.setScalar(2.4/h);
      object.position.set(-box.getCenter(new Vector3()).x*2.4/h,
        -box.min.y*2.4/h,-box.getCenter(new Vector3()).z*2.4/h);
      object.traverse(o=>{if(o instanceof Mesh){o.castShadow=false;o.receiveShadow=false;}});
      actor.add(object);state.model=actor;this.root.add(actor);
    }
  }catch(error){console.warn('Missing destructible CC0 crystal art:',error);}
  for(const [x,z] of [[-12,-30],[12,-30],[-12,-50],[12,-50],[-12,-70],[12,-70]]){
    const torch=new PointLight(0xffa54d,16,15,2);
    torch.position.set(x,this.terrain.heightAt(x,z)+3,z);
    this.root.add(torch);this.lights.push(torch);
  }
 }
 update(dt:number,wave:number,waves:number,completed:boolean):void{
  this.elapsed+=Math.max(0,dt);
  this.strikeCooldown=Math.max(0,this.strikeCooldown-Math.max(0,dt));
  for(let i=0;i<this.gateNodes.length;i++){
    // The authored gate art vanishes when its corresponding room is cleared.
    this.gateNodes[i].visible=wave<=i+1&&!completed;
  }
  if(this.chest)this.chest.visible=completed;
  for(let i=0;i<this.lights.length;i++){
    this.lights[i].intensity=13+Math.sin(this.elapsed*8+i*2)*1.8;
  }
 }
 dispose():void{
  this.disposed=true;
  this.root.removeFromParent();
  this.visualMeshes.length=0;this.lights.length=0;
  for(const mat of this.materials)mat.dispose();
  this.materials.clear();
 }
}
