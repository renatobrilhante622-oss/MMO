import {AdditiveBlending,Box3,BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,Material,Matrix4,Mesh,MeshStandardMaterial,Object3D,PlaneGeometry,PointLight,Points,PointsMaterial,Scene,ShaderMaterial,Vector3} from 'three';
import {loadSharedModel} from '../assets/ModelResources';
import {groundedAssetMatrix} from './AssetPlacement';
import type {OpenWorldGenerator,WorldCollider,MapMarker} from './OpenWorldGenerator';
import type {OpenWorldActivities} from './OpenWorldActivities';
interface Prop {asset:string;x:number;z:number;size:number;yaw?:number;color?:number;lift?:number;site?:string;}
interface Batch {mesh:InstancedMesh;bounds:Box3;part:Matrix4;asset:string;}
const FILES:Record<string,string>={Tent:'models/pr21/Tent.glb',Fence:'models/pr21/Fence.glb',Fire:'models/pr21/Campfire.glb',Board:'models/pr21/Board.glb',Chest:'models/dungeon/Kenney_Dungeon_chest.glb',Crystal:'models/dungeon/Kenney_Dungeon_crystal.glb',Flower:'models/gathering/Kenney_Flower_Astral.glb',Obelisk:'models/pr18/Obelisk.glb',Ruins:'models/pr18/MossRuins.glb',Skull:'models/pr18/Skull.glb'};
/** Authored props are streamed into fixed-size GPU batches; no geometry per encounter tick. */
export class FieldActivityScene {
 readonly root=new Group();readonly ready:Promise<void>;private disposed=false;private batches:Batch[]=[];private props:Prop[]=[];
 private materials=new Set<Material>();private ownedColliders:WorldCollider[]=[];private markers:MapMarker[]=[];private timer=0;
 private readonly glowTime={value:0};private readonly vortices:InstancedMesh;private readonly motes:Points;private lights:PointLight[]=[];
 constructor(scene:Scene,private readonly terrain:OpenWorldGenerator,private readonly activities:OpenWorldActivities,private readonly physics:import('../physics/PhysicsWorld').PhysicsWorld){
  this.root.name='PR21 streamed CC0 field activities';scene.add(this.root);
  for(const s of activities.sites){
   if(s.kind==='board')this.props.push({asset:'Board',...s,size:2.6});
   if(s.kind==='camp'){
    this.props.push({asset:'Tent',x:s.x-6,z:s.z+4,size:5,site:s.id},{asset:'Tent',x:s.x+6,z:s.z+4,size:5,yaw:Math.PI,site:s.id},{asset:'Fire',x:s.x,z:s.z+5,size:1.7,site:s.id},{asset:'Chest',...s,size:1.5,site:s.id});
    for(const side of [-1,1])for(const z of [-4,0,4])this.props.push({asset:'Fence',x:s.x+side*9,z:s.z+z,size:3,yaw:Math.PI/2,site:s.id});
   }
   if(s.kind==='ruin')this.props.push({asset:'Ruins',...s,size:4.2});
   if(['shrine','defense','captain'].includes(s.kind))this.props.push({asset:'Obelisk',...s,size:s.kind==='captain'?2.1:3.2,color:s.kind==='captain'?0xd94432:[0x52ffa6,0xffcb66,0x6ecbff][s.variant]});
   if(s.kind==='rare')this.props.push({asset:s.variant===1?'Flower':'Crystal',...s,size:1.9,color:0x84caff,site:s.id});
   if(s.kind==='rift'){this.props.push({asset:'Crystal',x:s.x-3,z:s.z,size:3.5,color:0xd750ff,site:s.id},{asset:'Crystal',x:s.x+3,z:s.z,size:3.5,color:0xd750ff,site:s.id});}
   const marker:MapMarker={x:s.x,z:s.z,label:s.kind==='captain'?'💀 [ELITE] '+s.name:s.name,color:s.kind==='captain'?'#ffb45b':'#b99bea',icon:s.kind==='captain'?'elite':s.kind==='camp'?'chest':s.kind==='shrine'?'shrine':s.kind==='rift'?'rift':s.kind==='board'?'board':'activity',active:s.kind!=='rift'};
   this.markers.push(marker);terrain.markers.push(marker);
  }
  const shader=new ShaderMaterial({uniforms:{time:this.glowTime},transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 vUv;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float bands=pow(.5+.5*sin(a*6.-r*22.+time*4.),5.);float rim=exp(-abs(r-.8)*17.);gl_FragColor=vec4(vec3(.75,.12,1.3)*(rim+bands*.7),clamp((rim+bands*.5)*(1.-smoothstep(.8,1.,r)),0.,.9));}'});
  this.materials.add(shader);this.vortices=new InstancedMesh(new PlaneGeometry(5,5),shader,32);this.vortices.count=0;this.root.add(this.vortices);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(600),3));const pointsMaterial=new PointsMaterial({color:0xffca76,size:.12,transparent:true,opacity:.65,depthWrite:false,blending:AdditiveBlending});this.materials.add(pointsMaterial);this.motes=new Points(geometry,pointsMaterial);this.root.add(this.motes);
  for(let i=0;i<4;i++){const light=new PointLight(0xff8f48,0,12,2);this.lights.push(light);this.root.add(light);}
  this.ready=typeof document==='undefined'?Promise.resolve():this.load();
 }
 private async load():Promise<void>{
  await Promise.all(Object.entries(FILES).map(async([asset,path])=>{
   const model=await loadSharedModel(path);if(this.disposed)return;model.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(model.scene);
   model.scene.traverse(o=>{if(!(o instanceof Mesh))return;
    const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const copy=m.clone();this.materials.add(copy);if(copy instanceof MeshStandardMaterial){copy.roughness=Math.max(.5,copy.roughness);if(['Crystal','Obelisk'].includes(asset)){copy.emissive.set('#a07ae9');copy.emissiveIntensity=.4;}}return copy;});
    const mesh=new InstancedMesh(o.geometry.clone(),Array.isArray(o.material)?materials:materials[0],256);mesh.name='Field batch '+asset;mesh.castShadow=false;mesh.receiveShadow=true;mesh.count=0;this.root.add(mesh);this.batches.push({mesh,bounds,part:o.matrixWorld.clone(),asset});
   });
   // Physical tent/barricade bounds use exactly the same fit as their render instances.
   if(['Tent','Fence'].includes(asset))for(const p of this.props.filter(p=>p.asset===asset)){
    const fitted=bounds.clone().applyMatrix4(groundedAssetMatrix(bounds,p,(x,z)=>this.terrain.heightAt(x,z))),collider:WorldCollider={position:fitted.getCenter(new Vector3()),size:fitted.getSize(new Vector3()),type:'solid'};this.terrain.colliders.push(collider);this.ownedColliders.push(collider);
   }
  }));if(!this.disposed)this.physics.syncTerrainColliders();
 }
 update(dt:number,hero:Vector3):void {
  if(this.disposed)return;this.glowTime.value=this.activities.progress.clock;this.timer-=dt;if(this.timer>0)return;this.timer=.2;
  const progress=this.activities.progress;
  const visible=this.props.filter(p=>Math.hypot(p.x-hero.x,p.z-hero.z)<85&&(!p.site||this.activities.state(p.site)?.site.kind==='camp'&&(p.asset!=='Chest'||progress.ready(p.site))||progress.ready(p.site)));
  for(const prop of this.activities.targets)visible.push({asset:prop.kind==='nest'?'Skull':'Chest',x:prop.position.x,z:prop.position.z,size:prop.kind==='nest'?2.3:2.1,color:prop.kind==='nest'?0xe94dbe:0xffd466});
  for(const batch of this.batches){const props=visible.filter(p=>p.asset===batch.asset).slice(0,256);batch.mesh.count=props.length;batch.mesh.visible=props.length>0;
   props.forEach((p,i)=>{batch.mesh.setMatrixAt(i,groundedAssetMatrix(batch.bounds,p,(x,z)=>this.terrain.heightAt(x,z)).multiply(batch.part));const camp=p.site?this.activities.state(p.site):undefined;batch.mesh.setColorAt(i,new Color(p.asset==='Chest'&&camp?.site.kind==='camp'?(camp.mode==='cleared'?0xffdf88:0x77788b):p.color??0xffffff));});batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;batch.mesh.computeBoundingSphere();
  }
  const rifts=[...this.activities.states.values()].filter(s=>s.mode==='active'||s.mode==='defending').filter(s=>Math.hypot(s.site.x-hero.x,s.site.z-hero.z)<100);this.vortices.count=rifts.length;
  rifts.forEach((s,i)=>{const dummy=new Object3D();dummy.position.set(s.site.x,this.terrain.heightAt(s.site.x,s.site.z)+2.5,s.site.z);if(s.mode==='defending'){dummy.rotation.x=-Math.PI/2;dummy.position.y=this.terrain.heightAt(s.site.x,s.site.z)+.1;dummy.scale.setScalar(7);}dummy.updateMatrix();this.vortices.setMatrixAt(i,dummy.matrix);});this.vortices.instanceMatrix.needsUpdate=true;this.vortices.computeBoundingSphere();
  for(const [i,s]of this.activities.sites.entries()){const marker=this.markers[i];if(marker.icon==='rift')marker.active=this.activities.state(s.id)?.mode==='active';}
  const fires=visible.filter(p=>p.asset==='Fire');this.lights.forEach((l,i)=>{const p=fires[i];l.intensity=p?8+Math.sin(progress.clock*7+i)*2:0;if(p)l.position.set(p.x,this.terrain.heightAt(p.x,p.z)+1,p.z);});
  const a=this.motes.geometry.attributes.position;const centers=[...fires,...rifts.map(s=>s.site)].slice(0,12);let count=0;
  for(const p of centers)for(let i=0;i<12;i++){a.setXYZ(count++,p.x+Math.sin(i*17+progress.clock)*.8,this.terrain.heightAt(p.x,p.z)+(i*.37+progress.clock)%4,p.z+Math.cos(i*13)*.8);}
  a.needsUpdate=true;this.motes.geometry.setDrawRange(0,count);this.motes.geometry.computeBoundingSphere();
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.root.removeFromParent();for(const b of this.batches){b.mesh.geometry.dispose();b.mesh.dispose();}this.batches=[];this.vortices.geometry.dispose();this.vortices.dispose();this.motes.geometry.dispose();this.materials.forEach(m=>m.dispose());this.lights.forEach(l=>l.dispose());for(const c of this.ownedColliders){const i=this.terrain.colliders.indexOf(c);if(i>=0)this.terrain.colliders.splice(i,1);}for(const m of this.markers){const i=this.terrain.markers.indexOf(m);if(i>=0)this.terrain.markers.splice(i,1);}}
}
