import {Box3,BufferAttribute,Color,DoubleSide,Group,InstancedMesh,Material,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Object3D,PointLight,RingGeometry,Scene,Texture,TextureLoader,Vector3,SRGBColorSpace,RepeatWrapping} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ArticulatedCharacter} from '../player/ArticulatedCharacter';
import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import {arenaObstacles,type PvPMatch,type PvPFighter} from '../combat/PvPTypes';
interface Spot {x:number;z:number;size:number;yaw?:number;}
/** Gameplay scenery in Engine's resident scene, never a second renderer or an iframe. */
export class ArenaMapScene {
 readonly root=new Group();readonly ready:Promise<void>;private dead=false;private elapsed=0;
 private geometries=new Set<import('three').BufferGeometry>();private materials=new Set<Material>();private textures=new Set<Texture>();
 private actors=new Map<string,{rig:ArticulatedCharacter;action:number;hp:number}>();
 private columns=new Map<string,Group>();private gates:Group[]=[];private lights:PointLight[]=[];
 private rune:Mesh;private effects=new Map<number,Mesh>();
 constructor(private readonly scene:Scene){
  this.root.name='Imperial Coliseum · realtime PvP';scene.add(this.root);
  const material=new MeshBasicMaterial({color:0x77edcb,transparent:true,opacity:.7,side:DoubleSide,depthWrite:false});this.materials.add(material);
  const geometry=new RingGeometry(.8,1.5,48);this.geometries.add(geometry);this.rune=new Mesh(geometry,material);this.rune.rotation.x=-Math.PI/2;this.rune.position.y=3.46;this.rune.visible=false;this.root.add(this.rune);
  this.ready=this.load();
 }
 private async load():Promise<void>{
  const loader=new GLTFLoader(),textureLoader=new TextureLoader();
  const maps=await Promise.all(['Color','NormalGL','Roughness'].map(async kind=>{const t=await textureLoader.loadAsync('/textures/real-pbr/PavingStones046_1K-JPG_'+kind+'.webp');if(this.dead){t.dispose();return t;}this.textures.add(t);t.wrapS=t.wrapT=RepeatWrapping;if(kind==='Color')t.colorSpace=SRGBColorSpace;return t;}));
  if(this.dead)return;
  const floor:Spot[]=[];for(let x=-12;x<=12;x++)for(let z=-12;z<=12;z++)if(Math.hypot(x*2,z*2)<26)floor.push({x:x*2,z:z*2,size:2.02});
  const circle=(n:number,r:number,size:number):Spot[]=>Array.from({length:n},(_,i)=>({x:Math.sin(i*Math.PI*2/n)*r,z:Math.cos(i*Math.PI*2/n)*r,size,yaw:i*Math.PI*2/n}));
  const plans:Array<[string,Spot[],Group?]>=[['floor',floor],['wall',circle(64,26,2.4)],['column',circle(24,26,5.2)]];
  for(const obstacle of arenaObstacles()){const g=new Group();this.columns.set(obstacle.id,g);this.root.add(g);plans.push(['column',[{x:obstacle.x,z:obstacle.z,size:3.6}],g]);}
  for(const z of [-21,21]){const gate=new Group();this.root.add(gate);this.gates.push(gate);plans.push(['gate',[{x:0,z,size:5.2}],gate]);}
  for(const spot of circle(4,22,1.8)){plans.push(['fire-basket',[spot]]);const light=new PointLight(spot.z>0?0x79c7ff:0xff836a,22,14,2);light.position.set(spot.x,6,spot.z);this.root.add(light);this.lights.push(light);}
  const sources=new Map<string,Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>>();
  await Promise.all(plans.map(async([name,spots,parent])=>{
   let request=sources.get(name);if(!request){request=loader.loadAsync('/models/dungeon/Kenney_Dungeon_'+name+'.glb').then(asset=>{asset.scene.traverse(o=>{if(o instanceof Mesh){if(this.dead)o.geometry.dispose();else this.geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){if(this.dead)m.dispose();else this.materials.add(m);for(const v of Object.values(m))if(v instanceof Texture){if(this.dead)v.dispose();else this.textures.add(v);}}}});return asset;});sources.set(name,request);}
   const asset=await request;if(this.dead)return;asset.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(asset.scene),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
   asset.scene.traverse(o=>{if(!(o instanceof Mesh))return;let geometry=o.geometry;
    if(name==='floor'){geometry=geometry.clone();const p=geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getZ(i);}geometry.setAttribute('uv',new BufferAttribute(uv,2));}
    this.geometries.add(geometry);
    const originals=Array.isArray(o.material)?o.material:[o.material],mats=originals.map(m=>{const mat=m.clone();this.materials.add(mat);if(mat instanceof MeshStandardMaterial){mat.roughness=.8;if(name==='floor'){mat.map=maps[0];mat.normalMap=maps[1];mat.roughnessMap=maps[2];mat.normalScale.set(.4,.4);mat.color.set('#ada794');}}return mat;});
    const batch=new InstancedMesh(geometry,Array.isArray(o.material)?mats:mats[0],spots.length);batch.receiveShadow=true;batch.castShadow=name==='column'||name==='gate';
    spots.forEach((s,i)=>{const dummy=new Object3D(),factor=s.size/Math.max(.001,name==='floor'?Math.max(size.x,size.z):size.y);dummy.position.set(s.x,3.4,s.z);dummy.scale.setScalar(factor);dummy.rotation.y=s.yaw??0;dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix.clone().multiply(new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)).multiply(o.matrixWorld));});batch.computeBoundingSphere();(parent??this.root).add(batch);
   });
  }));

 }
 update(dt:number,match:PvPMatch,selfId:string):void {
  this.elapsed+=dt;const ids=new Set(match.fighters.filter(f=>f.id!==selfId).map(f=>f.id));
  for(const [id,a]of this.actors)if(!ids.has(id)){a.rig.dispose();this.actors.delete(id);}
  for(const f of match.fighters)if(f.id!==selfId)this.actor(dt,f);
  this.gates.forEach(g=>g.position.y+=( (match.phase==='active'||match.phase==='ended'?5.5:0)-g.position.y)*(1-Math.exp(-dt*4)));
  for(const o of match.obstacles){const g=this.columns.get(o.id);if(g)g.visible=o.hp>0;}
  this.lights.forEach((l,i)=>l.intensity=22+Math.sin(this.elapsed*6+i)*2);
  this.rune.visible=match.rune.active;(this.rune.material as MeshBasicMaterial).color.set(match.rune.kind==='heal'?0x77ffad:0xffd27c);this.rune.scale.setScalar(1+Math.sin(this.elapsed*4)*.1);this.rune.rotation.z+=dt;
  const active=new Set(match.telegraphs.map(t=>t.id));for(const [id,mesh]of this.effects)if(!active.has(id)){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as Material).dispose();this.effects.delete(id);}
  for(const t of match.telegraphs){let mesh=this.effects.get(t.id);if(!mesh){mesh=new Mesh(new RingGeometry(.85,1,40),new MeshBasicMaterial({color:t.team===match.fighters.find(f=>f.id===selfId)?.team?0x6fcfff:0xff394e,transparent:true,opacity:.6,side:DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;this.root.add(mesh);this.effects.set(t.id,mesh);}mesh.position.set(t.x,3.48,t.z);mesh.scale.setScalar(t.radius);}
 }
 private actor(dt:number,f:PvPFighter):void {
  let a=this.actors.get(f.id);if(!a){const rig=new ArticulatedCharacter(CLASS_DEFINITIONS[f.classId]);a={rig,action:f.lastAction,hp:f.hp};this.actors.set(f.id,a);this.root.add(rig.root);rig.root.position.set(f.x,3.4,f.z);}
  const root=a.rig.root;root.position.lerp(new Vector3(f.x,3.4,f.z),1-Math.exp(-dt*18));root.rotation.y=Math.atan2(f.facingX,f.facingZ);
  if(a.action!==f.lastAction){a.rig.attack(f.lastSkill??undefined);a.action=f.lastAction;}
  a.rig.update(dt,this.elapsed,f.hp<=0?'dead':f.state==='dash'?'slide':f.state==='run'?'run':'idle',f.state==='run'?1:0,root.rotation.y,f.hp<a.hp?.2:0);a.hp=f.hp;
 }
 dispose():void {if(this.dead)return;this.dead=true;this.root.removeFromParent();for(const a of this.actors.values())a.rig.dispose();this.actors.clear();for(const m of this.effects.values()){m.geometry.dispose();(m.material as Material).dispose();}this.effects.clear();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
