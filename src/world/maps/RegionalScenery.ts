import {Box3,Color,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,PointLight,Quaternion,Scene,Vector3} from 'three';
import {loadSharedModel} from '../../assets/ModelResources';
import {mapDefinition} from './MapDefinitions';
/** Owned GLB landmarks and their regional lights. Shared template geometry is immutable. */
export class RegionalScenery {
 readonly root=new Group();readonly ready:Promise<void>;
 private readonly geometries=new Set<import('three').BufferGeometry>();
 private disposed=false;private readonly materials=new Set<MeshStandardMaterial>();private readonly batches:InstancedMesh[]=[];
 constructor(scene:Scene,readonly id:string,private readonly height:(x:number,z:number)=>number){
  this.root.name='Exclusive landmarks: '+id;scene.add(this.root);
  this.ready=typeof document==='undefined'?Promise.resolve():this.build();
 }
 private async build():Promise<void>{
  const def=mapDefinition(this.id);
  await Promise.all([...def.landmarks,...(this.id==='aurora'?[]:[{asset:'VoidArch',x:30,z:-42,size:8,tint:0x8755ff}])].map(async spec=>{
   const asset=await loadSharedModel('models/pr18/'+spec.asset+'.glb');if(this.disposed)return;
   asset.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(asset.scene),size=bounds.getSize(new Vector3());
   const scale=spec.size/Math.max(.01,size.x,size.y,size.z),center=bounds.getCenter(new Vector3());
   const model=asset.scene.clone(true);model.scale.setScalar(scale);model.position.set(spec.x-center.x*scale,this.height(spec.x,spec.z)-(spec.asset==='IronBridge'?bounds.max.y:bounds.min.y)*scale,spec.z-center.z*scale);
   model.traverse(node=>{if(!(node instanceof Mesh))return;node.geometry=node.geometry.clone();this.geometries.add(node.geometry);node.castShadow=spec.size>8;node.receiveShadow=true;
    const originals=Array.isArray(node.material)?node.material:[node.material];const copies=originals.map(m=>{if(!(m instanceof MeshStandardMaterial))return m;const copy=m.clone();this.materials.add(copy);if(spec.tint){copy.color.lerp(new Color(spec.tint),.32);copy.emissive.setHex(spec.tint);copy.emissiveIntensity=.45;}return copy;});node.material=Array.isArray(node.material)?copies:copies[0];
   });if(spec.asset!=='Chain')this.root.add(model);
   if(spec.asset==='BlueCrystal'||spec.asset==='Anvil'||spec.asset==='Crypt'){
    const light=new PointLight(spec.tint??(this.id==='rift'?0xff4610:0x7766dd),13,22,2);light.position.set(spec.x,this.height(spec.x,spec.z)+5,spec.z);this.root.add(light);
   }
   // Repeated region-exclusive authored props are instanced, not separate meshes.
   if(['Village','SnowPine','DeadTree','Coffin','Skull','Chain'].includes(spec.asset)){
    asset.scene.traverse(part=>{if(!(part instanceof Mesh))return;
     const count=spec.asset==='Village'?3:['SnowPine','DeadTree'].includes(spec.asset)?24:spec.asset==='Chain'?20:12;
     const material=(Array.isArray(part.material)?part.material[0]:part.material).clone() as MeshStandardMaterial;this.materials.add(material);
     const batch=new InstancedMesh(part.geometry.clone(),material,count);this.geometries.add(batch.geometry);batch.name='Native '+spec.asset;batch.castShadow=spec.asset==='Village';batch.receiveShadow=true;
     for(let i=0;i<count;i++){
      const angle=i*2.399963,r=24+(i%6)*14,x=Math.cos(angle)*r,z=-40+Math.sin(angle)*r;
      const chain=spec.asset==='Chain';
      const village=spec.asset==='Village';
      const px=village?[18,-18,18][i]:chain?20+(i%2)*16:x,pz=village?[30,0,0][i]:chain?-146:z,py=this.height(px,pz)+(chain?6+Math.floor(i/2)*1.1:0),pieceScale=chain?1.8/Math.max(.01,size.x,size.y,size.z):village?scale*.86:scale;
      const m=new Matrix4().compose(new Vector3(px-center.x*pieceScale,py-bounds.min.y*pieceScale,pz-center.z*pieceScale),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),village?i*Math.PI/2:chain?(i%2)*Math.PI/2:0),new Vector3(pieceScale,pieceScale,pieceScale));batch.setMatrixAt(i,m.multiply(part.matrixWorld));
     }
     batch.computeBoundingSphere();this.root.add(batch);this.batches.push(batch);
    });
   }
  }));
 }
 dispose():void{this.disposed=true;this.root.removeFromParent();for(const batch of this.batches)batch.dispose();this.batches.length=0;for(const geometry of this.geometries)geometry.dispose();this.geometries.clear();for(const material of this.materials)material.dispose();this.materials.clear();this.root.traverse(o=>{if(o instanceof PointLight)o.dispose();});this.root.clear();}
}
