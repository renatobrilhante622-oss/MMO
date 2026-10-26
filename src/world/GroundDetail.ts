import {Box3,BufferGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,Object3D,StaticDrawUsage,Vector3} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {organicMaterial,type OrganicSurface} from './FoliageAppearance';

const loader=new GLTFLoader();
const cache=new Map<string,Promise<GLTF>>();
function authoredModel(file:string):Promise<GLTF>{
  let loading=cache.get(file);
  if(!loading){loading=loader.loadAsync(import.meta.env.BASE_URL+file);cache.set(file,loading);void loading.catch(()=>cache.delete(file));}
  return loading;
}
interface Cover {file:string;label:string;height:number;count:number;surface:OrganicSurface;wind:boolean;}

/** Authored CC0 plants and stones. Only scatter matrices and shader wind are calculated. */
export class GroundDetail {
  readonly root=new Group();
  readonly ready:Promise<void>;
  private readonly meshes:InstancedMesh[]=[];
  private readonly materials=new Set<MeshStandardMaterial>();
  private readonly geometries=new Set<BufferGeometry>();
  private readonly windTime={value:0};
  private disposed=false;
  constructor(private heightAt:(x:number,z:number)=>number,private region:string,private seed=62013){
    this.root.name='CC0 instanced meadow, flowers and natural stones';
    this.ready=typeof document==='undefined'?Promise.resolve():this.build();
  }
  private rand():number{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  private async build():Promise<void>{
    const coarse=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
    const arid=this.region==='rift'||this.region==='eclipse';
    const cover:Cover[]=[
      {file:'models/ground-cover/Kenney_grass.glb',label:'Meadow grasses',height:.5,count:arid?90:coarse?600:1200,surface:'foliage',wind:true},
      {file:'models/ground-cover/Kenney_grass-leafslarge.glb',label:'Meadow grasses / broadleaf',height:.62,count:arid?20:coarse?150:350,surface:'foliage',wind:true},
      {file:'models/ground-cover/Kenney_flower-purplea.glb',label:'Wildflowers',height:.38,count:arid?12:coarse?90:180,surface:'flower',wind:true},
      {file:'models/environment/Kenney_nature-kit_rock-largea.glb',label:'Loose stones',height:.25,count:coarse?110:220,surface:'stone',wind:false},
    ];
    for(const entry of cover){
      if(this.disposed)return;
      if(this.region!=='aurora'&&entry.surface!=='stone')continue;
      let gltf:GLTF;
      try{gltf=await authoredModel(entry.file);}catch(error){console.warn('CC0 ground cover unavailable:',entry.file,error);continue;}
      if(this.disposed)return;
      const source=gltf.scene;source.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(source),extent=bounds.getSize(new Vector3());
      if(bounds.isEmpty()||extent.y<.00001)continue;
      const center=bounds.getCenter(new Vector3()),scale=entry.height/extent.y;
      const normalize=new Matrix4().makeScale(scale,scale,scale).multiply(new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
      const scatter:Matrix4[]=[];
      const transform=new Object3D();
      for(let i=0;i<entry.count;i++){
        let x=0,z=0,y=0,valid=false;
        for(let attempt=0;attempt<16;attempt++){
          x=(this.rand()-.5)*275;z=(this.rand()-.5)*275;y=this.heightAt(x,z);
          if(Math.hypot(x,z-18)>=24&&Math.hypot(x,z+70)>=13&&y>=2.4&&y<=21){valid=true;break;}
        }
        if(!valid)continue;
        transform.position.set(x,y+.015,z);transform.rotation.y=this.rand()*Math.PI*2;
        const size=.7+this.rand()*.7;transform.scale.set(size,size*(.85+this.rand()*.3),size);transform.updateMatrix();scatter.push(transform.matrix.clone());
      }
      if(!scatter.length)continue;
      source.traverse(part=>{
        if(!(part instanceof Mesh))return;
        const geometry=part.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(normalize,part.matrixWorld));
        this.geometries.add(geometry);
        const originals=Array.isArray(part.material)?part.material:[part.material];
        const materials=originals.map(original=>{
          const material=original instanceof MeshStandardMaterial?organicMaterial(original,entry.surface,geometry.hasAttribute('color')):new MeshStandardMaterial({color:'#617c44',roughness:.9});
          if(this.region==='highlands'&&entry.surface==='foliage')material.color.multiplyScalar(.86);
          if(entry.wind){
            material.onBeforeCompile=shader=>{
              shader.uniforms.coverTime=this.windTime;
              shader.vertexShader='uniform float coverTime;\n'+shader.vertexShader;
              shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
                float rooted=smoothstep(0.,${entry.height.toFixed(3)},position.y);
                float gust=sin(coverTime*1.65+instanceMatrix[3].x*.17+instanceMatrix[3].z*.11);
                transformed.x+=gust*rooted*.07;transformed.z+=cos(coverTime*1.1+instanceMatrix[3].z*.15)*rooted*.025;`);
            };
            material.customProgramCacheKey=()=>`cc0-ground-wind-${entry.height}`;
          }
          this.materials.add(material);return material;
        });
        const mesh=new InstancedMesh(geometry,Array.isArray(part.material)?materials:materials[0],scatter.length);
        mesh.name=entry.label+' / '+part.name;mesh.instanceMatrix.setUsage(StaticDrawUsage);
        mesh.castShadow=false;mesh.receiveShadow=true;mesh.onBeforeRender=()=>{this.windTime.value=performance.now()*.001;};
        scatter.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
        this.root.add(mesh);this.meshes.push(mesh);
      });
    }
  }
  dispose():void{
    if(this.disposed)return;this.disposed=true;
    for(const mesh of this.meshes)mesh.removeFromParent();this.meshes.length=0;
    this.geometries.forEach(geometry=>geometry.dispose());this.geometries.clear();
    this.materials.forEach(material=>material.dispose());this.materials.clear();this.root.removeFromParent();
  }
}
