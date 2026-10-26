import {DungeonAtmosphere} from './dungeons/DungeonAtmosphere';
import {BiomeSurface} from './maps/BiomeSurface';
import {Box3,BufferGeometry,Color,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,PointLight,Quaternion,Scene,Vector3} from 'three';
import {loadSharedModel} from '../assets/ModelResources';
import type {OpenWorldGenerator,WorldCollider} from './OpenWorldGenerator';
import {dungeonMap,dungeonWalkable,roomForWave,type DungeonMapPlan} from './dungeons/DungeonMaps';
import {createGroundTextures,type PBRTextureSet} from './ProceduralTextures';
export type DungeonRoom='guardians'|'crystals'|'sentinels'|'boss';
export const DUNGEON_ROOMS=dungeonMap('tombs').rooms;
/** Trace the actual room/corridor silhouette into solid boundary cells. */
export function dungeonColliders(height:(x:number,z:number)=>number,id='tombs'):WorldCollider[]{
 const plan=dungeonMap(id),result:WorldCollider[]=[];
 for(let x=-38;x<=38;x+=2)for(let z=-98;z<=-16;z+=2){
  if(dungeonWalkable(plan,x,z))continue;
  if([[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dz])=>dungeonWalkable(plan,x+dx,z+dz)))result.push({position:new Vector3(x,height(x,z)+3,z),size:new Vector3(2.1,6,2.1),type:'solid'});
 }
 // Gates match the passage entering each subsequent room; opening affects physics and visuals.
 for(let i=1;i<4;i++){const a=plan.rooms[i-1],b=plan.rooms[i];result.push({position:new Vector3((a.x+b.x)/2,height(0,b.z)+2.5,(a.z+b.z)/2),size:new Vector3(Math.max(7,Math.abs(b.x-a.x)+7),5,1.1),type:'gate'});}
 return result;
}
export class DungeonInstance {
 readonly root=new Group();readonly ready:Promise<void>;readonly startedAt=performance.now();readonly plan:DungeonMapPlan;
 private disposed=false;private elapsed=0;private cooldown=0;private floor=1;
 private readonly materials=new Set<MeshStandardMaterial>();private readonly ownedGeometry=new Set<BufferGeometry>();private readonly batches:InstancedMesh[]=[];private readonly lights:PointLight[]=[];private readonly gates:Group[]=[];
 private atmosphere?:DungeonAtmosphere;private surface?:BiomeSurface;private ground?:PBRTextureSet;private chest?:Group;
 private readonly crystalStates:Array<{position:Vector3;hp:number;model?:Group}>;
 get crystalsRemaining():number{return this.crystalStates.filter(c=>c.hp>0).length;}
 get crystalsDestroyed():number{return 3-this.crystalsRemaining;}
 constructor(scene:Scene,private readonly terrain:OpenWorldGenerator,id='tombs'){
  this.plan=dungeonMap(id);const room=this.plan.rooms[1];
  this.crystalStates=[-7,0,7].map(x=>({position:new Vector3(room.x+x,3.4,room.z),hp:100}));
  this.root.name='Loaded indoor dungeon instance';this.root.userData.dungeonId=this.plan.id;scene.add(this.root);
  this.ready=typeof document==='undefined'?Promise.resolve():this.build();
 }
 roomForWave(wave:number,waves:number):number{return roomForWave(wave,waves);}
 roomPoint(wave:number,waves:number):Vector3{const r=this.plan.rooms[this.roomForWave(wave,waves)];return new Vector3(r.x,this.terrain.heightAt(r.x,r.z)+1.2,r.z);}
 gateOpen(index:number,wave:number,waves:number,completed=false):boolean{return completed||(index===0?wave>Math.ceil(waves/3):index===1?wave>Math.ceil(waves*2/3)&&this.crystalsRemaining===0:wave>waves&&this.crystalsRemaining===0);}
 resetFloor(floor:number):void{if(this.floor===floor)return;this.floor=floor;for(const c of this.crystalStates){c.hp=100;if(c.model)c.model.visible=true;}}
 strikeCrystal(hero:Vector3,damage=50):boolean{if(this.cooldown>0||!Number.isFinite(damage)||damage<=0)return false;const c=this.crystalStates.find(c=>c.hp>0&&Math.hypot(hero.x-c.position.x,hero.z-c.position.z)<3.1);if(!c)return false;c.hp=Math.max(0,c.hp-Math.min(100,damage));this.cooldown=.42;if(!c.hp&&c.model)c.model.visible=false;return true;}
 private async batch(asset:string,spots:readonly {x:number;z:number;w:number;h:number;d:number;elevation?:number;turn?:number}[],floor=false):Promise<Group>{
  const group=new Group();group.name='Dungeon '+this.plan.id+' '+asset;
  const path=asset.startsWith('native:')?'models/pr18/'+asset.slice(7)+'.glb':'models/dungeon/Kenney_Dungeon_'+asset+'.glb';
  const gltf=await loadSharedModel(path);if(this.disposed)return group;
  gltf.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(gltf.scene),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  gltf.scene.traverse(part=>{if(!(part instanceof Mesh))return;
   const sources=Array.isArray(part.material)?part.material:[part.material];
   const copies=sources.map(m=>{const copy=m instanceof MeshStandardMaterial?m.clone():new MeshStandardMaterial();copy.roughness=this.plan.roughness;copy.metalness=this.plan.metalness;copy.color.lerp(new Color(this.plan.accent),.15);if(floor)copy.color.setHex(this.plan.id==='void'?0x26232d:this.plan.id==='eclipse'?0x20132f:this.plan.id==='titan'?0xb5deef:0x8292aa);copy.emissive.setHex(this.plan.accent);copy.emissiveIntensity=floor?.025:.08;if(floor&&this.ground){copy.map=this.ground.map;copy.normalMap=this.ground.normalMap;copy.roughnessMap=this.ground.roughnessMap;}this.materials.add(copy);return copy;});
   let geometry=part.geometry.clone();this.ownedGeometry.add(geometry);
   if(floor){const p=geometry.attributes.position,uv=geometry.attributes.uv;if(uv)for(let i=0;i<uv.count;i++)uv.setXY(i,p.getX(i)*2,p.getZ(i)*2);this.ownedGeometry.add(geometry);}
   const mesh=new InstancedMesh(geometry,Array.isArray(part.material)?copies:copies[0],spots.length);mesh.name='Real GLB '+asset;mesh.receiveShadow=true;mesh.castShadow=!floor&&spots.length<12;
   spots.forEach((s,i)=>{const scale=asset.startsWith('native:')?new Vector3().setScalar(s.w/Math.max(.01,size.x,size.y,size.z)):new Vector3(s.w/Math.max(.01,size.x),s.h/Math.max(.01,size.y),s.d/Math.max(.01,size.z));const m=new Matrix4().compose(new Vector3(s.x,this.terrain.heightAt(s.x,s.z)+(s.elevation??0),s.z),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),s.turn??0),scale);m.multiply(new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));mesh.setMatrixAt(i,m.multiply(part.matrixWorld));});mesh.computeBoundingSphere();group.add(mesh);this.batches.push(mesh);
  });this.root.add(group);return group;
 }
 private async build():Promise<void>{
  this.atmosphere=new DungeonAtmosphere(this.plan.id);this.root.add(this.atmosphere.root);
  this.surface=new BiomeSurface(this.plan.id,160,true);this.root.add(this.surface.root);
  this.ground=createGroundTextures(this.plan.floor as 'cobble');
  const floorSpots:Array<{x:number;z:number;w:number;h:number;d:number}>=[],walls:typeof floorSpots=[];
  for(let x=-36;x<=36;x+=4)for(let z=-94;z<=-18;z+=4){if(dungeonWalkable(this.plan,x,z))floorSpots.push({x,z,w:4.1,h:.35,d:4.1});}
  const boundary=dungeonColliders(()=>3.4,this.plan.id).filter(c=>c.type==='solid');
  for(const c of boundary)walls.push({x:c.position.x,z:c.position.z,w:2.1,h:4.8,d:2.1});
  await Promise.all([this.batch('floor',floorSpots,true),this.batch('wall',walls),...this.plan.props.map(p=>this.batch('native:'+p.asset,p.asset==='Chain'?Array.from({length:10},(_,i)=>({x:p.x,z:p.z,w:1.6,h:1.6,d:1.6,elevation:6+i*1.05,turn:i%2*Math.PI/2})):[{x:p.x,z:p.z,w:p.size,h:p.size,d:p.size}]))]);
  if(this.disposed)return;
  for(let i=1;i<4;i++){
   const a=this.plan.rooms[i-1],b=this.plan.rooms[i];this.gates.push(await this.batch('gate',[{x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:7,h:5,d:1}]));
  }
  if(this.plan.id==='void')await this.batch('wall',[{x:0,z:-76,w:28,h:1,d:1,elevation:17}]);
  const pillars=this.plan.rooms.flatMap(r=>[-1,1].map(side=>({x:r.x+side*(r.width/2-2),z:r.z,w:2,h:this.plan.id==='eclipse'?9:6,d:2})));
  await this.batch('column',pillars);
  for(const state of this.crystalStates){const model=await this.batch('crystal',[{x:state.position.x,z:state.position.z,w:1.8,h:2.4,d:1.8}]);state.model=model;}
  const boss=this.plan.rooms[3];this.chest=await this.batch('chest',[{x:boss.x,z:boss.z+6,w:2.4,h:1.6,d:1.6}]);this.chest.visible=false;
  if(this.disposed)return;
  for(const r of this.plan.rooms)for(const side of [-1,1]){const light=new PointLight(this.plan.accent,18,20,2);light.position.set(r.x+side*(r.width/2-3),7,r.z);this.root.add(light);this.lights.push(light);}
 }
 update(dt:number,wave:number,waves:number,completed:boolean):void{this.elapsed+=Math.max(0,dt);this.surface?.update(this.elapsed);this.atmosphere?.update(this.elapsed);this.cooldown=Math.max(0,this.cooldown-dt);this.gates.forEach((g,i)=>g.visible=!this.gateOpen(i,wave,waves,completed));if(this.chest)this.chest.visible=completed;this.lights.forEach((l,i)=>l.intensity=16+Math.sin(this.elapsed*6+i)*2);}
 dispose():void{if(this.disposed)return;this.disposed=true;this.root.removeFromParent();for(const m of this.batches)m.dispose();this.batches.length=0;for(const g of this.ownedGeometry)g.dispose();for(const m of this.materials)m.dispose();this.atmosphere?.dispose();this.surface?.dispose();this.ground?.dispose();for(const l of this.lights)l.dispose();this.root.clear();}
}
