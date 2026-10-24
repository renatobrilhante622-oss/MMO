import {Bone,BufferAttribute,BufferGeometry,Color,Matrix4,Mesh,MeshStandardMaterial,Object3D,Skeleton,SkinnedMesh,Vector3} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Converts rigid articulated pieces into one skinned, vertex-colored draw call. */
export class RigidSkinBatch {
  readonly mesh:SkinnedMesh;
  private readonly links:Array<{source:Object3D;bone:Bone}>=[];
  private readonly sources:Mesh[]=[];
  private readonly material:MeshStandardMaterial;
  constructor(private root:Object3D,private base:MeshStandardMaterial){
    root.updateMatrixWorld(true);const inverse=new Matrix4().copy(root.matrixWorld).invert(),bones:Bone[]=[],indices=new Map<Object3D,number>();
    const mirror=(source:Object3D,parent?:Bone):void=>{const bone=new Bone();bone.name='batch-'+source.uuid;bone.position.copy(source.position);bone.quaternion.copy(source.quaternion);bone.scale.copy(source.scale);if(source===root){bone.position.set(0,0,0);bone.quaternion.identity();bone.scale.set(1,1,1);}indices.set(source,bones.length);bones.push(bone);this.links.push({source,bone});if(parent)parent.add(bone);for(const child of source.children)if(!(child instanceof Mesh))mirror(child,bone);};mirror(root);
    const geometries:BufferGeometry[]=[];
    root.traverse(o=>{if(!(o instanceof Mesh)||Array.isArray(o.material)||!(o.material instanceof MeshStandardMaterial)||o.material.alphaTest>0||o.material.transparent||o.geometry.morphAttributes.position?.length)return;
      let visible=true,parent:Object3D|null=o;while(parent&&parent!==root){if(!parent.visible)visible=false;parent=parent.parent;}if(!visible)return;
      const source=o.material,g=o.geometry.clone().toNonIndexed();g.applyMatrix4(new Matrix4().multiplyMatrices(inverse,o.matrixWorld));const count=g.attributes.position.count,color=new Float32Array(count*3),glow=new Float32Array(count*3),skinIndices=new Uint16Array(count*4),skinWeights=new Float32Array(count*4);
      const c=source.color,e=source.emissive.clone().multiplyScalar(source.emissiveIntensity);for(let i=0;i<count;i++){color.set([c.r,c.g,c.b],i*3);if(source!==base)glow.set([e.r,e.g,e.b],i*3);skinIndices[i*4]=indices.get(o.parent!)??0;skinWeights[i*4]=1;}
      // All merged pieces use a common attribute schema and a single material.
      for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
      if(!g.attributes.uv)g.setAttribute('uv',new BufferAttribute(new Float32Array(count*2),2));
      g.setAttribute('color',new BufferAttribute(color,3));g.setAttribute('bakedGlow',new BufferAttribute(glow,3));g.setAttribute('skinIndex',new BufferAttribute(skinIndices,4));g.setAttribute('skinWeight',new BufferAttribute(skinWeights,4));g.clearGroups();geometries.push(g);this.sources.push(o);
    });
    const geometry=(geometries.length?mergeGeometries(geometries,false):null)??new BufferGeometry();geometries.forEach(g=>g.dispose());this.material=base.clone();this.material.color.setHex(0xffffff);this.material.vertexColors=true;
    this.material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec3 bakedGlow;varying vec3 vBakedGlow;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBakedGlow=bakedGlow;');shader.fragmentShader='varying vec3 vBakedGlow;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vBakedGlow;');};this.material.customProgramCacheKey=()=> 'rigid-skin-vertex-glow-v1';
    this.mesh=new SkinnedMesh(geometry,this.material);this.mesh.name='Unified organic creature';this.mesh.castShadow=this.mesh.receiveShadow=false;this.mesh.frustumCulled=false;this.mesh.add(bones[0]);root.add(this.mesh);root.updateMatrixWorld(true);this.mesh.bind(new Skeleton(bones));for(const o of this.sources)o.visible=false;
  }
  sync():void{for(const {source,bone}of this.links){if(source===this.root)continue;bone.position.copy(source.position);bone.quaternion.copy(source.quaternion);bone.scale.copy(source.scale);}this.material.emissive.copy(this.base.emissive);this.material.emissiveIntensity=this.base.emissiveIntensity;}
  dispose():void{for(const o of this.sources)o.visible=true;this.mesh.skeleton.dispose();this.mesh.geometry.dispose();this.material.dispose();this.mesh.removeFromParent();}
}
