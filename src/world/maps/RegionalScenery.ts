import {Box3,Color,Group,InstancedMesh,Mesh,MeshStandardMaterial,PointLight,Scene,Vector3} from 'three';
import {loadSharedModel} from '../../assets/ModelResources';
import {groundedAssetMatrix} from '../AssetPlacement';
import {generateMapPlan,type ExplorationProp} from '../MapGenerator';
import type {WorldCollider} from '../OpenWorldGenerator';
import {mapDefinition} from './MapDefinitions';
/** Authored regional landmarks, instanced by asset; all base pivots are fitted in world space. */
export class RegionalScenery {
 readonly root=new Group();readonly ready:Promise<void>;
 private disposed=false;private readonly materials=new Set<MeshStandardMaterial>();private readonly batches:InstancedMesh[]=[];
 constructor(scene:Scene,readonly id:string,private readonly height:(x:number,z:number)=>number,private readonly colliders:WorldCollider[]=[]){
  this.root.name='Exclusive landmarks: '+id;scene.add(this.root);this.ready=typeof document==='undefined'?Promise.resolve():this.build();
 }
 private async build():Promise<void>{
  const def=mapDefinition(this.id),groups=new Map<string,Array<ExplorationProp&{tint?:number}>>();
  const specs:Array<ExplorationProp&{tint?:number}>=[...def.landmarks.map((p,i)=>({...p,id:this.id+'-signature-'+i,yaw:0,solid:!['Bridge','IronBridge','Chain','VoidArch'].includes(p.asset),foundation:true})),...generateMapPlan(this.id).props];
  if(this.id!=='aurora')specs.push({id:'dungeon-gateway',asset:'VoidArch',x:30,z:-42,size:8,yaw:0,solid:false,foundation:true,tint:0x8755ff});
  for(const s of specs){const key=s.asset+':'+(s.tint??0);const group=groups.get(key)??[];group.push(s);groups.set(key,group);}
  await Promise.all([...groups.values()].map(async specs=>{
   const asset=await loadSharedModel('models/pr18/'+specs[0].asset+'.glb');if(this.disposed)return;asset.scene.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(asset.scene);if(bounds.isEmpty())throw Error('Empty landmark: '+specs[0].asset);
   const placements=specs.filter(s=>this.height(s.x,s.z)>2).map(s=>({spec:s,matrix:groundedAssetMatrix(bounds,s,this.height)}));
   if(!placements.length)return;
   for(const {spec,matrix}of placements){
    const actual=bounds.clone().applyMatrix4(matrix),size=actual.getSize(new Vector3());
    if(spec.solid)this.colliders.push({position:actual.getCenter(new Vector3()),size,type:'solid'});
    if(spec.tint&&spec.size>14&&this.root.children.filter(o=>o instanceof PointLight).length<3){const light=new PointLight(spec.tint,13,22,2);light.position.set(spec.x,actual.min.y+5,spec.z);this.root.add(light);}
   }
   asset.scene.traverse(part=>{if(!(part instanceof Mesh))return;
    const original=Array.isArray(part.material)?part.material:[part.material];
    const materials=original.map(m=>{if(!(m instanceof MeshStandardMaterial))return m;const copy=m.clone();this.materials.add(copy);copy.roughness=Math.max(.6,copy.roughness);if(specs[0].tint){copy.color.lerp(new Color(specs[0].tint),.32);copy.emissive.setHex(specs[0].tint);copy.emissiveIntensity=.45;}return copy;});
    const batch=new InstancedMesh(part.geometry.clone(),Array.isArray(part.material)?materials:materials[0],placements.length);batch.name='Native '+specs[0].asset;batch.castShadow=specs[0].asset==='Village';batch.receiveShadow=true;
    placements.forEach(({matrix},i)=>batch.setMatrixAt(i,matrix.clone().multiply(part.matrixWorld)));batch.computeBoundingSphere();this.root.add(batch);this.batches.push(batch);
   });
  }));
 }
 dispose():void {if(this.disposed)return;this.disposed=true;this.root.removeFromParent();for(const batch of this.batches){batch.geometry.dispose();batch.dispose();}this.batches.length=0;for(const m of this.materials)m.dispose();this.materials.clear();this.root.traverse(o=>{if(o instanceof PointLight)o.dispose();});this.root.clear();}
}
