import {
  Box3,DoubleSide,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,Quaternion,Scene,Vector3
} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {organicMaterial} from './FoliageAppearance';

export type SceneAsset='tree-oak'|'tree-cone'|'tree-default-dark'|'tree-detailed'
 |'rock-largea'|'rock-talla'|'cliff-rock'
 |'gravestone-broken'|'gravestone-cross-large'|'altar-stone'
 |'tower-square'|'wall-doorway'|'rocks-large';
interface AssetEntry{file:string;region:'aurora'|'crypt'|'highlands'|'rift'|'eclipse';count:number;height:number;}
const ASSETS:readonly AssetEntry[]=[
  {file:'Kenney_nature-kit_tree-oak.glb',region:'aurora',count:32,height:7.5},
  {file:'Kenney_nature-kit_tree-detailed.glb',region:'aurora',count:17,height:6.5},
  {file:'Kenney_nature-kit_rock-largea.glb',region:'aurora',count:13,height:1.6},
  {file:'Kenney_nature-kit_tree-default-dark.glb',region:'crypt',count:16,height:6},
  {file:'Kenney_graveyard-kit_gravestone-broken.glb',region:'crypt',count:24,height:1.8},
  {file:'Kenney_graveyard-kit_gravestone-cross-large.glb',region:'crypt',count:13,height:2.1},
  {file:'Kenney_graveyard-kit_altar-stone.glb',region:'crypt',count:1,height:3.3},
  {file:'Kenney_nature-kit_tree-cone.glb',region:'highlands',count:25,height:7},
  {file:'Kenney_nature-kit_rock-talla.glb',region:'highlands',count:17,height:3},
  {file:'Kenney_nature-kit_cliff-rock.glb',region:'rift',count:20,height:3.5},
  {file:'Kenney_castle-kit_rocks-large.glb',region:'rift',count:15,height:2.8},
  {file:'Kenney_castle-kit_wall-doorway.glb',region:'rift',count:3,height:5},
  {file:'Kenney_castle-kit_tower-square.glb',region:'eclipse',count:5,height:9},
  {file:'Kenney_castle-kit_rocks-large.glb',region:'eclipse',count:20,height:3},
];
const CENTERS:{[K in AssetEntry['region']]:[number,number]}={
  aurora:[0,18],crypt:[-65,-40],highlands:[95,-83],rift:[0,-85],eclipse:[-92,97]
};
const loader=new GLTFLoader();
const cache=new Map<string,Promise<GLTF>>();
function model(file:string):Promise<GLTF>{
  let task=cache.get(file);
  if(!task){
    const url=import.meta.env.BASE_URL+'models/environment/'+file;
    task=loader.loadAsync(url);
    cache.set(file,task);
    void task.catch(()=>cache.delete(file));
  }
  return task;
}
function random(seed:number):()=>number{
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
/** Geometry/material data is authored in GLB files; only placement matrices are computed. */
export class EnvironmentGLB {
  readonly root=new Group();
  private disposed=false;
  private readonly meshes:InstancedMesh[]=[];
  private readonly materials=new Set<MeshStandardMaterial>();
  constructor(private readonly scene:Scene,private readonly heightAt:(x:number,z:number)=>number,
    private readonly activeRegion?:string){
    this.root.name='CC0 authored environment — instanced GLB scenery';
    scene.add(this.root);
    if(typeof document!=='undefined')void this.build();
  }
  private async build():Promise<void>{
    for(let index=0;index<ASSETS.length;index++){
      if(this.disposed)return;
      const entry=ASSETS[index];
      if(this.activeRegion&&entry.region!==this.activeRegion)continue;
      let gltf:GLTF;
      try{gltf=await model(entry.file);}
      catch(error){console.warn('Unable to load authored environment:',entry.file,error);continue;}
      if(this.disposed)return;
      const scene=gltf.scene;scene.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(scene);
      if(bounds.isEmpty())continue;
      const center=bounds.getCenter(new Vector3());
      const scale=entry.height/Math.max(.001,bounds.max.y-bounds.min.y);
      const [cx,cz]=this.activeRegion?[0,18]:CENTERS[entry.region];
      const rng=random(13021+index*973);
      const transforms:Matrix4[]=[];
      for(let n=0;n<entry.count;n++){
        const angle=rng()*Math.PI*2;
        const radius=entry.count<5?13+n*3:14+Math.sqrt(rng())*28;
        const x=Math.max(-133,Math.min(133,cx+Math.cos(angle)*radius));
        const z=Math.max(-133,Math.min(133,cz+Math.sin(angle)*radius));
        if(entry.region==='aurora'&&Math.hypot(x,z-18)<24)continue;
        const y=this.heightAt(x,z);
        const spin=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),rng()*Math.PI*2);
        const objectScale=scale*(.8+rng()*.38);
        const transform=new Matrix4().compose(new Vector3(x,y,z),spin,new Vector3(objectScale,objectScale,objectScale));
        const origin=new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
        transforms.push(transform.multiply(origin));
      }
      scene.traverse(object=>{
        if(!(object instanceof Mesh)||transforms.length===0)return;
        // Mobile GPUs can render vegetation almost black when thin single-sided
        // leaves face away from the key light or the cascaded shadow splits.
        // Preserve authored albedo/maps and give them physically lit fill.
        const sources=Array.isArray(object.material)?object.material:[object.material];
        const visual=sources.map(source=>{
          if(!(source instanceof MeshStandardMaterial))return source;
          const vegetation=entry.file.includes('tree-')||entry.file.includes('bush');
          const surfaceName=(source.name+' '+object.name).toLowerCase();
          const material=organicMaterial(source,vegetation?(/bark|wood|trunk|branch|stem/.test(surfaceName)?'bark':'foliage'):'stone',object.geometry.hasAttribute('color'));
          material.side=DoubleSide;
          if(vegetation){
            // Real PBR foliage is never metallic, even on low-end Android GPUs.
            material.metalness=0;
            material.roughness=.85;
            // Kenney tree GLBs provide separate leafsGreen and woodBark
            // material slots. Never wash out authored vertex colors or textures.
            const label=(source.name+' '+object.name).toLowerCase();
            const bark=/bark|wood|trunk|branch|stem/.test(label);
            const foliage=/leaf|foliage|canopy|crown|green|defaultmat/.test(label);
            if(!source.map&&!object.geometry.hasAttribute('color')){
              if(bark)material.color.set('#5c3a21');
              else if(foliage)material.color.set(index%2?'#3b8046':'#2d6a3e');
            }
            material.vertexColors=source.vertexColors;
            material.emissive.copy(source.emissive);
            material.emissiveIntensity=Math.min(.16,source.emissiveIntensity);
            material.depthWrite=true;
          }else{
            material.metalness=Math.min(.12,material.metalness);
            material.roughness=Math.max(.78,material.roughness);
            material.emissive.setRGB(.10,.11,.10);
            material.emissiveIntensity=.38;
          }
          this.materials.add(material);
          return material;
        });
        const instanced=new InstancedMesh(object.geometry,Array.isArray(object.material)?visual:visual[0],transforms.length);
        instanced.name='Instanced '+entry.file+'/'+object.name;
        // Tiny forest foliage no longer self-occludes as a single opaque shadow.
        instanced.castShadow=true;
        instanced.receiveShadow=false;
        for(let i=0;i<transforms.length;i++){
          instanced.setMatrixAt(i,transforms[i].clone().multiply(object.matrixWorld));
        }
        instanced.instanceMatrix.needsUpdate=true;
        instanced.computeBoundingSphere();
        this.root.add(instanced);
        this.meshes.push(instanced);
      });
    }
  }
  dispose():void{
    this.disposed=true;
    for(const mesh of this.meshes)mesh.removeFromParent();
    this.meshes.length=0;
    for(const material of this.materials)material.dispose();
    this.materials.clear();
    this.root.removeFromParent();
  }
}
