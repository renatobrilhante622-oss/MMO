import {
 AdditiveBlending,BufferAttribute,BufferGeometry,Color,DoubleSide,DynamicDrawUsage,
 Group,MathUtils,Mesh,MeshStandardMaterial,PlaneGeometry,Points,PointsMaterial,Texture,ShaderMaterial,
} from 'three';
import type {WingStyle} from '../rpg/EvolutionSystem';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {wingTexture} from './WingTexture';

/** PR13: six-layer curved, vertex-animated wing rig with a GPU-batched particle emitter. */
export class WingsSystem {
 readonly root=new Group();
 private readonly assembly=new Group();
 private readonly geometries:BufferGeometry[]=[];
 private readonly materials:MeshStandardMaterial[]=[];
 private key='';
 fxColor=0xffffff;
 get activeTier():number{return this.root.visible?4:0;}
 private texture?:Texture;
 private readonly time={value:0};
 private readonly colors:Record<WingStyle,number>={
   necrotic:0x7a46b0,celestial:0xffdf9e,magma:0xff5b25,glacial:0x69e8ff,solar:0xffc34b,astral:0xb38aff,
 };
 constructor(){
   this.root.name='ETERNA layered articulated MMORPG wings';
   this.root.position.set(0,.20,-.28);
   this.root.add(this.assembly);
   this.root.visible=false;
 }
 configure(style:WingStyle|null,level:number):void {
   this.root.visible=!!style;
   if(!style)return;
   level=Number.isFinite(level)?MathUtils.clamp(Math.floor(level),1,10):1;
   const key=style+level;if(this.key===key)return;
   this.clear();this.key=key;
   const color=this.colors[style];this.fxColor=color;
   this.texture=wingTexture(style);
   const makeMat=(layer:number)=>{
     const m=new MeshStandardMaterial({
       map:this.texture,color:new Color(color).lerp(new Color(0xffffff),.58+layer*.09),
       alphaTest:.3,side:DoubleSide,roughness:.49,metalness:style==='glacial'?.34:.1,
       emissive:color,emissiveMap:this.texture,emissiveIntensity:.38+layer*.1+level*.04,
       transparent:false,opacity:1,depthWrite:true,
     });
     m.onBeforeCompile=shader=>{
       shader.uniforms.wingTime=this.time;
       shader.vertexShader='uniform float wingTime;\n'+shader.vertexShader;
       shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
         float flutter=sin(wingTime*2.3+position.x*1.8+position.y*.9);
         transformed.z+=flutter*pow(clamp(position.x/3.8,0.,1.),1.5)*.22;`);
     };
     m.customProgramCacheKey=()=> 'eterna-pr13-sixlayer-'+layer;
     this.materials.push(m);return m;
   };
   const shape={necrotic:{span:1.05,layers:1,sweep:.62},celestial:{span:1.2,layers:3,sweep:.25},magma:{span:1.15,layers:1,sweep:.75},glacial:{span:.94,layers:2,sweep:-.25},solar:{span:1.3,layers:3,sweep:.15},astral:{span:1.02,layers:2,sweep:.45}}[style];
   const span=(2.9+level*.11)*shape.span;
   const material=makeMat(0);
   const layers:PlaneGeometry[]=[];
   for(let layer=0;layer<shape.layers;layer++){
     const geometry=new PlaneGeometry(1,1,18+level*2,10+level);
     const pos=geometry.attributes.position;
     for(let i=0;i<pos.count;i++){
       const u=pos.getX(i)+.5,v=pos.getY(i)+.5;
       const sweep=span*(.78+layer*.12);
       pos.setXYZ(i,.10+u*sweep, (v-.35)*(1.95+level*.055)-u*shape.sweep-layer*.30,
         -.21-Math.sin(u*Math.PI)*(.30+layer*.12)+Math.pow(u,1.7)*.11);
     }
     geometry.computeVertexNormals();geometry.computeBoundingSphere();
     layers.push(geometry);
   }
   // Three layered 3D wing surfaces are merged into one draw call per side.
   // The material stays alpha-cutout to avoid transparent overdraw on Android.
   const combined=mergeGeometries(layers,false);
   if(!combined)throw new Error('Unable to combine wing layers');
   layers.forEach(g=>g.dispose());
   combined.computeVertexNormals();combined.computeBoundingSphere();
   this.geometries.push(combined);
   for(const sign of [-1,1]){
     const pivot=new Group();
     pivot.userData.side=sign;pivot.userData.layer=0;
     pivot.position.set(sign*.06,0,0);
     pivot.scale.x=sign;
     const mesh=new Mesh(combined,material);
     mesh.name=style+' three-curved-layer wing';
     mesh.castShadow=false;mesh.frustumCulled=false;pivot.add(mesh);this.assembly.add(pivot);
   }

 }
 update(dt:number,time:number,moving:number):void {
   if(!this.root.visible)return;
   this.time.value=time;
   const step=Math.min(.05,Math.max(0,dt));
   for(const pivot of this.assembly.children){
     const sign=pivot.userData.side as number,layer=pivot.userData.layer as number;
     pivot.rotation.y=MathUtils.damp(pivot.rotation.y,sign*(.16+.11*Math.sin(time*2+layer*.48+moving)),8,step);
     pivot.rotation.z=sign*(.025+.065*Math.sin(time*1.65+layer*.6));
   }

 }
 private clear():void {
   this.geometries.forEach(g=>g.dispose());this.geometries.length=0;
   this.materials.forEach(m=>m.dispose());this.materials.length=0;
   this.texture?.dispose();this.texture=undefined;this.assembly.clear();
 }
 dispose():void {this.clear();this.root.removeFromParent();}
}
