import { BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, StaticDrawUsage, Vector3, DodecahedronGeometry, IcosahedronGeometry } from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Batched, walkable terrain dressing. Geometry is deterministic and never a collision body. */
export class GroundDetail {
  readonly root=new Group();
  private readonly meshes:InstancedMesh[]=[];
  private disposed=false;
  constructor(private heightAt:(x:number,z:number)=>number,private region:string,private seed=62013){
    this.root.name='PR13 instanced meadow, flowers and natural stones';
    if(typeof document!=='undefined')this.build();
  }
  private rand():number{
    this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
    return this.seed/4294967296;
  }
  private build():void{
    const grasses=[0,1,2].map(a=>{
      const p=new PlaneGeometry(.22,.7,1,3);
      p.translate(0,.34,0);
      p.rotateY(a*Math.PI/3);
      return p;
    });
    const blades=mergeGeometries(grasses)!;grasses.forEach(g=>g.dispose());
    const moss=new MeshStandardMaterial({color:this.region==='highlands'?'#647c81':'#376a38',side:DoubleSide,roughness:1,metalness:0,depthWrite:true});
    const petals=new MeshStandardMaterial({color:this.region==='crypt'?'#9e81d4':'#dcb5de',roughness:.7,metalness:0,emissive:new Color('#40335b'),emissiveIntensity:.35});
    const stones=new MeshStandardMaterial({color:'#7c8077',roughness:.98,metalness:0});
    const flowers=new IcosahedronGeometry(.09,1),rocks=new DodecahedronGeometry(.22,0);
    const coarse=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
    const maxGrass=coarse?900:2200,flowerCount=coarse?90:220,stoneCount=coarse?110:260;
    const batches:[BufferGeometry,MeshStandardMaterial,number,string][]=[
      [blades,moss,maxGrass,'Meadow grasses'],[flowers,petals,flowerCount,'Wildflowers'],[rocks,stones,stoneCount,'Loose stones']
    ];
    const transform=new Object3D(),q=new Quaternion(),axis=new Vector3(0,1,0),m=new Matrix4();
    for(const [geometry,material,count,label] of batches){
      const mesh=new InstancedMesh(geometry,material,count);
      mesh.name=label;mesh.instanceMatrix.setUsage(StaticDrawUsage);
      mesh.castShadow=false;mesh.receiveShadow=true;
      for(let i=0;i<count;i++){
        let x=0,z=0,y=0,attempts=0;
        do{
          x=(this.rand()-.5)*275;z=(this.rand()-.5)*275;
          y=this.heightAt(x,z);
          attempts++;
        }while(attempts<8&&(Math.hypot(x,z-18)<24||Math.hypot(x,z+70)<13||y<2.4||y>21));
        transform.position.set(x,y+(label==='Wildflowers'?.12:label==='Loose stones'?.07:.02),z);
        q.setFromAxisAngle(axis,this.rand()*Math.PI*2);transform.quaternion.copy(q);
        const size=label==='Meadow grasses'?.55+this.rand()*1.35:label==='Wildflowers'?.7+this.rand()*.8:.65+this.rand()*1.2;
        transform.scale.set(size,size*(.7+this.rand()*.55),size);
        transform.updateMatrix();
        mesh.setMatrixAt(i,m.copy(transform.matrix));
        if(label==='Meadow grasses')mesh.setColorAt(i,new Color().setHSL(.26+this.rand()*.085,.24+this.rand()*.27,.23+this.rand()*.18));
      }
      mesh.instanceMatrix.needsUpdate=true;
      mesh.instanceColor&&(mesh.instanceColor.needsUpdate=true);
      mesh.computeBoundingSphere();this.root.add(mesh);this.meshes.push(mesh);
    }
  }
  dispose():void{
    if(this.disposed)return;this.disposed=true;
    for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();}
    this.meshes.length=0;this.root.removeFromParent();
  }
}
