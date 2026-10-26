import {LinearMipmapLinearFilter,Mesh,Texture,SkinnedMesh,type Object3D} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import optimized from './optimized-models.json';
import {smoothCreatureSurface} from './CreatureSurface';

/** Bounded idle objects; live scene instances are always independently owned. */
export class BoundedPool<T> {
  private readonly entries:Array<{key:string;value:T}>=[];
  constructor(readonly capacity:number,private readonly evict:(value:T)=>void=()=>{}){}
  acquire(key:string):T|undefined {const i=this.entries.findIndex(e=>e.key===key);return i<0?undefined:this.entries.splice(i,1)[0].value;}
  release(key:string,value:T):void {
    if(this.entries.some(e=>e.value===value))return;
    this.entries.push({key,value});
    while(this.entries.length>Math.max(0,this.capacity))this.evict(this.entries.shift()!.value);
  }
  clear():void {for(const e of this.entries)this.evict(e.value);this.entries.length=0;}
  get size():number{return this.entries.length;}
}
export function optimizedModelPath(path:string):string{return (optimized as Record<string,string>)[path]??path;}
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const templates=new Map<string,Promise<GLTF>>();
const configured=new WeakSet<Texture>();
/** Textures remain shared across every skin, preview and pooled clone. */
export function configureActorTextures(root:Object3D):void {
  root.traverse(node=>{
    if(!(node instanceof Mesh))return;
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      for(const value of Object.values(material)){
        if(!(value instanceof Texture)||configured.has(value))continue;
        configured.add(value);value.generateMipmaps=true;value.minFilter=LinearMipmapLinearFilter;value.anisotropy=2;value.needsUpdate=true;
      }
    }
  });
}
export function loadSharedModel(path:string):Promise<GLTF>{
  const resolved=optimizedModelPath(path);
  let pending=templates.get(resolved);
  if(!pending){pending=loader.loadAsync(import.meta.env.BASE_URL+resolved).then(asset=>{configureActorTextures(asset.scene);if(/(?:pr17-source\/ImperialHorse|creatures\/Creature_(?:wolf|wyvern|dragon))/.test(resolved))smoothCreatureSurface(asset.scene);asset.scene.traverse(node=>{if(node instanceof Mesh)node.geometry.userData.sharedActorGeometry=true;});return asset;});templates.set(resolved,pending);void pending.catch(()=>templates.delete(resolved));}
  return pending;
}
/** Only idle clones are pooled. Geometry/textures belong to the template cache. */
export const actorClonePool=new BoundedPool<Object3D>(6,object=>{
  const skeletons=new Set<SkinnedMesh['skeleton']>();
  object.traverse(node=>{if(node instanceof SkinnedMesh)skeletons.add(node.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();object.clear();
});
export function resetPooledActor(root:Object3D):void {
  root.visible=true;root.traverse(node=>{if(node instanceof SkinnedMesh)node.skeleton.pose();});
}
