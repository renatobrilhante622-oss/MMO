import {AdditiveBlending,Box3,BufferAttribute,BufferGeometry,Color,DirectionalLight,Float32BufferAttribute,FogExp2,Group,HemisphereLight,InstancedMesh,Material,Matrix4,Mesh,MeshStandardMaterial,Object3D,PerspectiveCamera,PointLight,Points,RepeatWrapping,Scene,ShaderMaterial,SRGBColorSpace,Texture,TextureLoader,Vector3,WebGLRenderer} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ArticulatedCharacter} from '../player/ArticulatedCharacter';
import {CLASS_DEFINITIONS} from './ClassSystem';
import type {ClassId} from '../core/GameTypes';
import {configureRenderer,createPresentationComposer} from '../core/Renderer';
import type {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';

export interface ArenaVisualFighter {
 id:string;classId:ClassId;hp:number;maxHp:number;energy:number;
 x:number;z:number;yaw:number;skill?:number;combo?:number;
}
interface Actor {rig:ArticulatedCharacter;classId:ClassId;hp:number;energy:number;skill:number;combo:number;flash:number;x:number;z:number;}
interface Placement {x:number;z:number;size:number;yaw?:number;}
type StoneModel='floor'|'floor-detail'|'wall'|'column'|'gate'|'fire-basket';
const loader=new GLTFLoader();
const models=new Map<string,Promise<GLTF>>();
function model(name:StoneModel):Promise<GLTF>{
 const url=import.meta.env.BASE_URL+'models/dungeon/Kenney_Dungeon_'+name+'.glb';
 let promise=models.get(url);if(!promise){promise=loader.loadAsync(url);models.set(url,promise);void promise.catch(()=>models.delete(url));}return promise;
}

/** A presentation layout, independent from local duels and authoritative online state. */
export function arenaTeamPosition(team:number,index:number,teamSize:number):{x:number;z:number;yaw:number}{
 return {x:team===0?-2.2:2.2,z:(index-(Math.max(1,teamSize)-1)/2)*2.1,yaw:team===0?Math.PI/2:-Math.PI/2};
}
/** Enough vertical field of view to retain both fighters in a narrow portrait viewport. */
export function arenaCameraFrame(aspect:number,halfWidth=3.7):{fov:number;distance:number}{
 const safe=Math.max(.2,Number.isFinite(aspect)?aspect:1),fov=safe<.85?48:42;
 const width=Number.isFinite(halfWidth)?Math.max(1,halfWidth):3.7;
 return {fov,distance:Math.min(65,Math.max(15,width*1.4/(Math.tan(fov*Math.PI/360)*safe)))};
}

/** Source-authored CC0 masonry and real skeletal actors; generated geometry is limited to VFX. */
export class ArenaScene {
 readonly scene=new Scene();
 readonly camera=new PerspectiveCamera(42,1,.1,100);
 readonly ready:Promise<void>;
 private readonly renderer:WebGLRenderer;
 private readonly composer:EffectComposer;
 private readonly architecture=new Group();
 private readonly actors=new Map<string,Actor>();
 private readonly materials=new Set<Material>();
 private readonly floorGeometries=new Set<BufferGeometry>();
 private readonly textures=new Set<Texture>();
 private readonly torches:PointLight[]=[];
 private readonly emberTime={value:0};
 private readonly embers:Points<BufferGeometry,ShaderMaterial>;
 private readonly floorMaps:{color:Texture;normal:Texture;roughness:Texture};
 private frame=0;private last=0;private elapsed=0;private entrance=0;
 private host?:HTMLElement;private disposed=false;private active=false;
 private width=0;private height=0;
 private readonly observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>this.resize());
 constructor(label='Coliseu de Aster em 3D'){
  this.renderer=new WebGLRenderer({antialias:false,powerPreference:'low-power'});
  configureRenderer(this.renderer,{exposure:1.03,mobile:matchMedia('(pointer:coarse)').matches});
  this.renderer.domElement.className='pr16-arena-canvas';this.renderer.domElement.setAttribute('aria-label',label);
  this.scene.background=new Color('#10121e');this.scene.fog=new FogExp2('#151626',.024);
  this.scene.add(new HemisphereLight(0xaac5e9,0x443128,1.65),this.architecture);
  const key=new DirectionalLight(0xffd7ae,2.7);key.position.set(-5,13,7);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.camera.near=.5;key.shadow.camera.far=40;key.shadow.bias=-.00035;key.shadow.normalBias=.035;key.shadow.radius=3;this.scene.add(key);
  const moon=new DirectionalLight(0x8aa7e9,1.3);moon.position.set(7,8,-9);this.scene.add(moon);
  const textureLoader=new TextureLoader(),base=import.meta.env.BASE_URL+'textures/real-pbr/PavingStones046_1K-JPG_';
  this.floorMaps={color:textureLoader.load(base+'Color.webp'),normal:textureLoader.load(base+'NormalGL.webp'),roughness:textureLoader.load(base+'Roughness.webp')};
  this.floorMaps.color.colorSpace=SRGBColorSpace;Object.values(this.floorMaps).forEach(t=>{t.wrapS=t.wrapT=RepeatWrapping;t.anisotropy=4;this.textures.add(t);});
  this.composer=createPresentationComposer(this.renderer,this.scene,this.camera,{bloom:true,strength:.34,radius:.45,threshold:1.05});
  const seeds:number[]=[];for(let i=0;i<128;i++)seeds.push(i%4,(i*.61803398875)%1,(i*.41421356237)%1);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(seeds,3));
  const material=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,toneMapped:false,uniforms:{time:this.emberTime},
   vertexShader:`uniform float time;varying float vFade;varying float vAge;void main(){float a=position.x*1.5707963+.785398;float age=fract(position.y+time*(.55+position.z*.3));vec3 p=vec3(sin(a)*7.8,1.1+age*1.9,cos(a)*7.8);p.x+=sin(time*3.+position.y*39.)*(.08+age*.3);p.z+=cos(time*2.+position.z*41.)*(.08+age*.3);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((38.-age*27.)/max(1.,-mv.z),1.,12.);vFade=sin(age*3.14159265)*(1.-age);vAge=age;}`,
   fragmentShader:`varying float vFade,vAge;void main(){vec2 p=gl_PointCoord*2.-1.;float a=exp(-dot(p,p)*5.)*vFade;if(a<.01)discard;gl_FragColor=vec4(mix(vec3(4.,1.8,.3),vec3(1.6,.25,.07),vAge),a);}`});
  this.embers=new Points(geometry,material);this.embers.frustumCulled=false;this.scene.add(this.embers);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,light=new PointLight(0xff8a3e,13,10,2);light.position.set(Math.sin(a)*7.8,1.8,Math.cos(a)*7.8);this.scene.add(light);this.torches.push(light);}
  this.ready=this.build();
 }
 private async build():Promise<void>{
  const floor:Placement[]=[];for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if(Math.hypot(x*1.65,z*1.65)<8.8)floor.push({x:x*1.65,z:z*1.65,size:1.67});
  const circular=(count:number,radius:number,size:number):Placement[]=>Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count;return {x:Math.sin(a)*radius,z:Math.cos(a)*radius,size,yaw:a};});
  // Keep the camera-facing arc open so foreground masonry cannot obscure a duel.
  const plan:Array<[StoneModel,Placement[]]>=[['floor',floor],['floor-detail',[{x:0,z:0,size:3.3}]],['wall',circular(32,9.6,2).filter(p=>p.z<4.2)],['column',circular(16,9.35,3.9).filter(p=>p.z<4.2)],['gate',[{x:0,z:-9.15,size:4.1}]],['fire-basket',circular(4,7.8,.95).map(p=>({...p,yaw:(p.yaw??0)+Math.PI/4,x:Math.sin((p.yaw??0)+Math.PI/4)*7.8,z:Math.cos((p.yaw??0)+Math.PI/4)*7.8}))]];
  await Promise.all(plan.map(async([name,spots])=>{
   try{
    const asset=await model(name);if(this.disposed)return;
    const source=asset.scene;source.updateMatrixWorld(true);const bounds=new Box3().setFromObject(source),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    source.traverse(object=>{
     if(!(object instanceof Mesh))return;
     let geometry=object.geometry;
     if(name==='floor'||name==='floor-detail'){
      // Kenney palette UVs address a single color swatch. Scanned stone needs
      // spatial UVs instead, otherwise the complete arena samples one flat pixel.
      geometry=object.geometry.clone();const position=geometry.attributes.position;
      geometry.computeBoundingBox();const box=geometry.boundingBox!,extent=box.getSize(new Vector3());
      const uv=new Float32Array(position.count*2);
      for(let i=0;i<position.count;i++){uv[i*2]=(position.getX(i)-box.min.x)/Math.max(.001,extent.x);uv[i*2+1]=(position.getZ(i)-box.min.z)/Math.max(.001,extent.z);}
      geometry.setAttribute('uv',new BufferAttribute(uv,2));this.floorGeometries.add(geometry);
     }
     const originals=Array.isArray(object.material)?object.material:[object.material];
     const visual=originals.map(original=>{
      const material=original.clone();this.materials.add(material);
      if(material instanceof MeshStandardMaterial){material.roughness=.83;material.metalness=.03;
       if(name==='floor'||name==='floor-detail'){material.map=this.floorMaps.color;material.normalMap=this.floorMaps.normal;material.roughnessMap=this.floorMaps.roughness;material.color.set('#c6bfa9');material.normalScale.set(.35,.35);}
      }return material;
     });
     const batch=new InstancedMesh(geometry,Array.isArray(object.material)?visual:visual[0],spots.length);batch.name='CC0 coliseum '+name;batch.receiveShadow=true;batch.castShadow=name==='column'||name==='gate';
     spots.forEach((spot,index)=>{
      const factor=spot.size/Math.max(.001,name.startsWith('floor')?Math.max(size.x,size.z):size.y),dummy=new Object3D();
      dummy.position.set(spot.x,name==='floor-detail'?.012:0,spot.z);dummy.rotation.y=spot.yaw??0;dummy.scale.setScalar(factor);dummy.updateMatrix();
      const normalized=new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
      batch.setMatrixAt(index,dummy.matrix.clone().multiply(normalized).multiply(object.matrixWorld));
     });batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();this.architecture.add(batch);
    });
   }catch(error){if(!this.disposed)console.warn('Coliseum art could not be loaded:',name,error);}
  }));
 }
 mount(host:HTMLElement):void{
  if(this.disposed)return;this.host=host;host.append(this.renderer.domElement);this.observer?.disconnect();this.observer?.observe(host);
  if(!this.active)this.entrance=0;this.active=true;this.resize();this.paint(0);if(!this.frame)this.frame=requestAnimationFrame(this.animate);
 }
 sync(fighters:readonly ArenaVisualFighter[]):void{
  const ids=new Set(fighters.map(f=>f.id));for(const [id,actor]of this.actors)if(!ids.has(id)){actor.rig.dispose();this.actors.delete(id);}
  for(const fighter of fighters){
   let actor=this.actors.get(fighter.id);
   if(actor&&actor.classId!==fighter.classId){actor.rig.dispose();this.actors.delete(fighter.id);actor=undefined;}
   if(!actor){const rig=new ArticulatedCharacter(CLASS_DEFINITIONS[fighter.classId]);actor={rig,classId:fighter.classId,hp:fighter.hp,energy:fighter.energy,skill:fighter.skill??-1,combo:fighter.combo??0,flash:0,x:fighter.x,z:fighter.z};this.actors.set(fighter.id,actor);this.scene.add(rig.root);rig.root.position.set(fighter.x,0,fighter.z);}
   if(fighter.energy<actor.energy||(fighter.combo!==undefined&&fighter.combo!==actor.combo)){actor.rig.attack(fighter.skill!==undefined&&fighter.skill>=0?fighter.skill:undefined,1);}
   if(fighter.hp<actor.hp)actor.flash=.2;
   actor.hp=fighter.hp;actor.energy=fighter.energy;actor.skill=fighter.skill??-1;actor.combo=fighter.combo??0;actor.x=fighter.x;actor.z=fighter.z;actor.rig.root.rotation.y=fighter.yaw;
  }
 }
 private resize():void{
  if(!this.host)return;const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight);
  if(width===this.width&&height===this.height)return;this.width=width;this.height=height;
  this.renderer.setSize(width,height,false);this.composer.setSize(width,height);this.camera.aspect=width/height;this.camera.fov=arenaCameraFrame(this.camera.aspect).fov;this.camera.updateProjectionMatrix();
 }
 private readonly animate=(now:number):void=>{
  if(!this.active||this.disposed){this.frame=0;return;}this.frame=requestAnimationFrame(this.animate);
  if(this.last&&now-this.last<32)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):1/30;this.last=now;this.elapsed+=dt;this.entrance=Math.min(1,this.entrance+dt/1.7);this.resize();
  this.paint(dt);
 };
 renderOnce(dt=0):void{if(this.disposed)return;const step=Math.max(0,Math.min(.1,dt));this.elapsed+=step;this.entrance=Math.min(1,this.entrance+step/1.7);this.resize();this.paint(step);}
 private paint(dt:number):void{
  let minX=Infinity,maxX=-Infinity;
  for(const actor of this.actors.values()){actor.flash=Math.max(0,actor.flash-dt);const root=actor.rig.root;root.position.x+=(actor.x-root.position.x)*(1-Math.exp(-dt*12));root.position.z+=(actor.z-root.position.z)*(1-Math.exp(-dt*12));actor.rig.update(dt,this.elapsed,actor.hp<=0?'dead':'idle',0,root.rotation.y,actor.flash);minX=Math.min(minX,root.position.x);maxX=Math.max(maxX,root.position.x);}
  const center=Number.isFinite(minX)?(minX+maxX)/2:0,halfWidth=Number.isFinite(minX)?(maxX-minX)/2+.7:3.7;
  const ease=1-(1-this.entrance)**3,frame=arenaCameraFrame(this.camera.aspect,halfWidth);
  this.camera.position.set(center+(1-ease)*5,8+(1-ease)*2,frame.distance+(1-ease)*3);this.camera.lookAt(center,.7,0);
  this.emberTime.value=this.elapsed;this.torches.forEach((light,i)=>light.intensity=12+Math.sin(this.elapsed*5+i*3)*1.2+Math.sin(this.elapsed*11+i)*.5);
  this.composer.render(dt);
 }

 hide():void{this.active=false;cancelAnimationFrame(this.frame);this.frame=0;this.last=0;this.observer?.disconnect();}
 dispose():void{
  if(this.disposed)return;this.disposed=true;this.hide();this.actors.forEach(a=>a.rig.dispose());this.actors.clear();
  this.floorGeometries.forEach(geometry=>geometry.dispose());this.floorGeometries.clear();
  this.embers.geometry.dispose();this.embers.material.dispose();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());
  this.architecture.traverse(object=>{if(object instanceof InstancedMesh)object.dispose();});this.architecture.clear();this.scene.traverse(object=>{if(object instanceof DirectionalLight)object.shadow.dispose();});this.scene.clear();this.composer.passes.forEach(pass=>pass.dispose());this.composer.dispose();this.renderer.dispose();this.renderer.domElement.remove();
 }
}
