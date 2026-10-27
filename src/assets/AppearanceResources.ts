import {Material,Mesh,MeshStandardMaterial,Object3D,BufferGeometry,Texture} from 'three';
/** Immutable styled materials are shared only while leased. Actor flash/skin uniforms stay private. */
export class SharedMaterialPool {
 private entries=new Map<string,{material:Material;refs:number}>();
 acquire(source:Material,style:string,configure:(m:MeshStandardMaterial)=>void):{material:Material;release:()=>void}{
  const key=source.uuid+':'+style;let entry=this.entries.get(key);
  if(!entry){const material=source.clone();if(material instanceof MeshStandardMaterial)configure(material);entry={material,refs:0};this.entries.set(key,entry);}entry.refs++;let live=true;
  return {material:entry.material,release:()=>{if(!live)return;live=false;if(--entry!.refs===0){entry!.material.dispose();this.entries.delete(key);}}};
 }
 get size():number{return this.entries.size;}
 get leases():number{return [...this.entries.values()].reduce((n,e)=>n+e.refs,0);}
}
export const appearanceMaterials=new SharedMaterialPool();
const leases=new WeakMap<Mesh,Array<()=>void>>();
export function shareAppearanceMaterials(mesh:Mesh,key:string,style:(m:MeshStandardMaterial)=>void):void {
 leases.get(mesh)?.forEach(release=>release());
 const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material],held=originals.map(m=>appearanceMaterials.acquire(m,key,style));
 mesh.material=Array.isArray(mesh.material)?held.map(l=>l.material):held[0].material;leases.set(mesh,held.map(l=>l.release));
}
/** Shared GLTF templates own their geometry/textures; disposing a clone must not destroy another actor. */
export function releaseAppearance(root:Object3D):void {
 root.removeFromParent();releaseAppearanceAssets(root);const geometry=new Set<import('three').BufferGeometry>();
 root.traverse(node=>{if(!(node instanceof Mesh))return;leases.get(node)?.forEach(release=>release());leases.delete(node);if(!node.geometry.userData.sharedActorGeometry)geometry.add(node.geometry);});
 geometry.forEach(g=>g.dispose());root.clear();
}

const assetRefs=new Map<BufferGeometry|Texture,number>(),assetLeases=new WeakMap<Object3D,()=>void>();
/** Keep CPU templates cached; release GPU buffers only after their last live cosmetic/actor clone. */
export function retainAppearanceAssets(root:Object3D):void {
 if(assetLeases.has(root))return;const resources=new Set<BufferGeometry|Texture>();
 root.traverse(n=>{if(n instanceof Mesh){resources.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])for(const v of Object.values(m))if(v instanceof Texture)resources.add(v);}});
 for(const r of resources)assetRefs.set(r,(assetRefs.get(r)??0)+1);
 assetLeases.set(root,()=>{for(const r of resources){const refs=(assetRefs.get(r)??1)-1;if(refs>0)assetRefs.set(r,refs);else{assetRefs.delete(r);r.dispose();}}assetLeases.delete(root);});
}
export function releaseAppearanceAssets(root:Object3D):void{root.traverse(n=>assetLeases.get(n)?.());}
export function appearanceResourceStats():{materials:number;materialLeases:number;assets:number}{return {materials:appearanceMaterials.size,materialLeases:appearanceMaterials.leases,assets:assetRefs.size};}
