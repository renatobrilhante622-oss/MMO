import {AnimationAction,AnimationMixer,Color,Group,Mesh,MeshStandardMaterial,Object3D,Vector3} from 'three';
import {createFootPivot,disableCharacterCulling} from '../player/PlayerRenderer';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
const cache=new Map<string,Promise<GLTF>>();
const loader=new GLTFLoader();
export function loadModel(name:'Soldier'|'Horse'|'Parrot'):Promise<GLTF>{const url=import.meta.env.BASE_URL+'models/'+name+'.glb';let request=cache.get(url);if(!request){request=loader.loadAsync(url);cache.set(url,request);request.catch(()=>cache.delete(url));}return request;}
/** Geometry/textures are shared; skeletons and tinted materials belong to each actor. */
export class AnimatedGLB {
  readonly root=new Group();
  ready=false;
  private mixer?:AnimationMixer;
  private actions=new Map<string,AnimationAction>();
  private active?:AnimationAction;
  private materials:MeshStandardMaterial[]=[];
  private disposed=false;
  private attackTime=0;
  private model?:Object3D;
  private arm?:Object3D;
  private baseColor=new Color(0x617080);
  private accent=new Color(0x9c7dcc);
  constructor(name:'Soldier'|'Horse'|'Parrot',height:number,private onReady:()=>void,castShadow=false){
    this.root.name='GLB '+name;
    // Unit/SSR execution retains the procedural fallback and performs no network I/O.
    if(typeof document==='undefined')return;
    void loadModel(name).then(gltf=>{
      if(this.disposed)return;const model=this.model=clone(gltf.scene);
      const pivot=createFootPivot(model,height,name==='Soldier'?Math.PI:0);
      model.traverse(o=>{if(o.name.toLowerCase().includes('rightarm'))this.arm??=o;if(o instanceof Mesh){o.castShadow=castShadow;o.receiveShadow=castShadow;o.frustumCulled=false;
        const tint=(m:MeshStandardMaterial)=>{const mat=m.clone();this.materials.push(mat);mat.roughness=.85;mat.metalness=.1;return mat;};
        o.material=Array.isArray(o.material)?o.material.map(m=>tint(m as MeshStandardMaterial)):tint(o.material as MeshStandardMaterial);
      }});
      this.root.add(pivot);this.mixer=new AnimationMixer(model);for(const clip of gltf.animations)this.actions.set(clip.name.toLowerCase(),this.mixer.clipAction(clip));this.play('idle');this.mixer.update(0);this.tint(this.baseColor.getHex(),this.accent.getHex());this.ready=true;this.onReady();
      // Notify bounds-based previews only after the whole model and equipped gear are installed.
      let ancestor:Object3D|null=this.root;while(ancestor){ancestor.userData.characterRevision=(ancestor.userData.characterRevision??0)+1;ancestor=ancestor.parent;}
    }).catch(()=>{/* Offline/model failure keeps the functional fallback visible. */});
  }
  attachAt(name:string,object:Object3D,offset=new Vector3()):boolean {
    let socket:Object3D|undefined;this.model?.traverse(o=>{if(!socket&&o.name.toLowerCase().replace(/[^a-z0-9]/g,'').endsWith(name))socket=o;});if(!socket)return false;
    this.root.updateMatrixWorld(true);const size=socket.getWorldScale(new Vector3());const inverse=new Vector3(1/Math.max(.0001,Math.abs(size.x)),1/Math.max(.0001,Math.abs(size.y)),1/Math.max(.0001,Math.abs(size.z)));
    const authored=(object.userData.authoredScale as Vector3|undefined)??object.scale.clone();object.userData.authoredScale=authored;socket.add(object);object.position.copy(offset).multiply(inverse);object.scale.copy(authored).multiply(inverse);disableCharacterCulling(object);return true;
  }
  tint(color:number,accent:number):void{this.baseColor.setHex(color);this.accent.setHex(accent);this.materials.forEach((m,i)=>{m.color.copy(i%2?this.accent:this.baseColor);});}
  play(state:string):void {const key=state==='run'?'run':state==='walk'?'walk':'idle';const action=this.actions.get(key)??this.actions.values().next().value;if(!action||action===this.active)return;action.reset().setEffectiveWeight(1).play();this.active?.crossFadeTo(action,.22,false);this.active=action;}
  attack():void{this.attackTime=.45;}
  update(dt:number,speed:number):void{if(!this.ready||!this.root.visible)return;this.play(speed>.65?'run':speed>.05?'walk':'idle');if(this.active)this.active.timeScale=speed>.05?Math.min(1.8,.8+speed*.5):1;this.mixer?.update(Math.min(.05,dt));if(this.attackTime>0){this.attackTime=Math.max(0,this.attackTime-dt);if(this.arm)this.arm.rotation.x-=Math.sin(this.attackTime/.45*Math.PI)*1.4;}}
  dispose():void{this.disposed=true;this.mixer?.stopAllAction();if(this.model)this.mixer?.uncacheRoot(this.model);this.materials.forEach(m=>m.dispose());this.materials.length=0;this.root.removeFromParent();this.root.clear();}
}
