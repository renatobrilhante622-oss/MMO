import {AmbientLight,BoxGeometry,CylinderGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,SpotLight,Vector3,WebGLRenderer,ACESFilmicToneMapping,SRGBColorSpace,Color} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ArticulatedCharacter} from '../player/ArticulatedCharacter';
import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import type {ClassId} from '../core/GameTypes';
import type {ArenaSystem} from '../combat/ArenaSystem';
/** Actual standalone 3D coliseum: rendered hero + opponent class rigs, GLB masonry and skill VFX. */
export class ArenaUI{
 readonly root=document.createElement('section');
 private renderer?:WebGLRenderer;
 private scene?:Scene;private camera?:PerspectiveCamera;
 private actors:ArticulatedCharacter[]=[];
 private geometry?:CylinderGeometry;
 private stone?:MeshStandardMaterial;
 private lights:SpotLight[]=[];
 private frame=0;private last=0;private elapsed=0;private opponentId='';
 private destroyed=false;
 constructor(private readonly arena:ArenaSystem){
  this.root.className='pr15-arena-3d';this.root.setAttribute('aria-label','Coliseu 3D');
 }
 mount(host:HTMLElement,heroClass:ClassId):void{
  if(this.root.parentElement!==host){this.root.remove();host.append(this.root);}
  if(typeof document==='undefined')return;
  const duel=this.arena.duel;
  if(!duel){this.hide();this.root.textContent='Escolha um desafiante para abrir os portões do Coliseu.';return;}
  if(!this.renderer||this.opponentId!==duel.challenger.id){
   this.dispose3d();this.root.replaceChildren();this.opponentId=duel.challenger.id;
   const renderer=new WebGLRenderer({antialias:false,alpha:true,powerPreference:'low-power'});
   this.renderer=renderer;renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
   renderer.domElement.className='pr15-arena-canvas';renderer.domElement.setAttribute('aria-label','Duelo 3D contra '+duel.challenger.name);
   this.root.append(renderer.domElement);
   const scene=this.scene=new Scene(),camera=this.camera=new PerspectiveCamera(42,2,.1,85);
   scene.add(new AmbientLight(0xabaacf,1.9));
   const sunlight=new SpotLight(0xffd4a6,75,35,Math.PI/3,.7);sunlight.position.set(-8,18,9);scene.add(sunlight);
   this.lights=[sunlight];
   const base=new Mesh(new CylinderGeometry(8.7,8.7,.4,72),new MeshStandardMaterial({color:0x77747b,roughness:.91}));
   base.name='Physical stone coliseum floor';base.position.y=-.25;scene.add(base);
   this.stone=base.material as MeshStandardMaterial;this.geometry=base.geometry as CylinderGeometry;
   const wall=new Mesh(new CylinderGeometry(10.2,10.2,3,64,1,true),new MeshStandardMaterial({color:0x887970,roughness:.92,side:1}));
   wall.name='Coliseum masonry outer wall';wall.position.y=1.2;scene.add(wall);
   // A single instanced wall segment batch replaces dozens of draw calls.
   const segment=new BoxGeometry(.6,1.35,1.45),walls=new InstancedMesh(segment,new MeshStandardMaterial({color:0x9a8880,roughness:.93}),64);
   const m=new Matrix4();
   for(let i=0;i<64;i++){const a=i*Math.PI/32;m.makeRotationY(-a).setPosition(Math.sin(a)*9.2,.38,Math.cos(a)*9.2);walls.setMatrixAt(i,m);}
   walls.instanceMatrix.needsUpdate=true;scene.add(walls);
   const player=new ArticulatedCharacter(CLASS_DEFINITIONS[heroClass]),ai=new ArticulatedCharacter(CLASS_DEFINITIONS[duel.challenger.classId]);
   this.actors=[player,ai];scene.add(player.root,ai.root);
   camera.position.set(0,8.8,15);camera.lookAt(0,1,0);
   const gltfLoader=new GLTFLoader();
   void gltfLoader.loadAsync(import.meta.env.BASE_URL+'models/dungeon/Kenney_Dungeon_column.glb').then(asset=>{
    if(this.scene!==scene)return;
    const template=asset.scene;
    for(let i=0;i<14;i++){
     const a=i*Math.PI*2/14;
     const clone=template.clone(true);clone.position.set(Math.sin(a)*9.3,.15,Math.cos(a)*9.3);
     clone.scale.setScalar(2.3);clone.traverse(o=>{if(o instanceof Mesh)o.castShadow=true;});
     scene.add(clone);
    }
   }).catch(()=>{});
  }
  const canvas=this.renderer.domElement;const w=Math.max(1,this.root.clientWidth),h=Math.max(1,this.root.clientHeight);
  this.renderer.setSize(w,h,false);this.camera!.aspect=w/h;this.camera!.updateProjectionMatrix();
  if(!this.frame)this.frame=requestAnimationFrame(this.animate);
 }
 private readonly animate=(now:number):void=>{
  if(this.destroyed||!this.renderer||!this.scene||!this.camera){this.frame=0;return;}
  this.frame=requestAnimationFrame(this.animate);
  if(this.last&&now-this.last<33)return;
  const dt=this.last?Math.min(.05,(now-this.last)/1000):1/30;this.last=now;this.elapsed+=dt;
  const duel=this.arena.duel;
  if(duel&&this.actors.length===2){
   const [hero,foe]=this.actors;
   hero.root.position.set(duel.hero.position,.14,0);foe.root.position.set(duel.ai.position,.14,0);
   hero.root.rotation.y=Math.PI/2;foe.root.rotation.y=-Math.PI/2;
   hero.update(dt,this.elapsed,duel.hero.hp<=0?'dead':duel.hero.lastSkill>=0?'run':'idle',0,hero.root.rotation.y,0);
   foe.update(dt,this.elapsed,duel.ai.hp<=0?'dead':duel.ai.lastSkill>=0?'run':'idle',0,foe.root.rotation.y,0);
  }
  this.renderer.render(this.scene,this.camera);
 };
 hide():void{cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}
 private dispose3d():void{
  this.hide();
  for(const a of this.actors)a.dispose();this.actors=[];
  this.renderer?.dispose();this.renderer?.domElement.remove();this.renderer=undefined;
  this.scene?.traverse(o=>{if(o instanceof Mesh&&o.name.includes('coliseum')){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});
  this.scene=undefined;this.geometry=undefined;this.stone=undefined;this.lights=[];
 }
 dispose():void{this.destroyed=true;this.dispose3d();this.root.remove();}
}
