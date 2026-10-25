import {
 AdditiveBlending,BufferAttribute,BufferGeometry,Color,DoubleSide,DynamicDrawUsage,
 Group,MathUtils,Mesh,MeshStandardMaterial,PlaneGeometry,Points,PointsMaterial,Texture,
} from 'three';
import type {WingStyle} from '../rpg/EvolutionSystem';
import {RarityAura} from './RarityAura';
import {wingTexture} from './WingTexture';

/** PR13: six-layer curved, vertex-animated wing rig with a GPU-batched particle emitter. */
export class WingsSystem {
 readonly root=new Group();
 private readonly assembly=new Group();
 private readonly aura=new RarityAura(.8);
 private readonly geometries:PlaneGeometry[]=[];
 private readonly materials:MeshStandardMaterial[]=[];
 private sparks?:Points<BufferGeometry,PointsMaterial>;
 private particlePhase=0;
 private key='';
 private texture?:Texture;
 private readonly time={value:0};
 private readonly colors:Record<WingStyle,number>={
   necrotic:0x7a46b0,celestial:0xffdf9e,magma:0xff5b25,glacial:0x69e8ff,solar:0xffc34b,astral:0xb38aff,
 };
 constructor(){
   this.root.name='ETERNA layered articulated MMORPG wings';
   this.root.position.set(0,.20,-.28);
   this.root.add(this.assembly,this.aura);
   this.root.visible=false;
 }
 configure(style:WingStyle|null,level:number):void {
   this.root.visible=!!style;
   if(!style)return;
   level=Number.isFinite(level)?MathUtils.clamp(Math.floor(level),1,10):1;
   const key=style+level;if(this.key===key)return;
   this.clear();this.key=key;
   const color=this.colors[style];
   this.texture=wingTexture(style);
   const makeMat=(layer:number)=>{
     const m=new MeshStandardMaterial({
       map:this.texture,color:new Color(color).lerp(new Color(0xffffff),.58+layer*.09),
       alphaTest:.19,side:DoubleSide,roughness:.49,metalness:style==='glacial'?.34:.1,
       emissive:color,emissiveMap:this.texture,emissiveIntensity:.38+layer*.1+level*.04,
       transparent:true,opacity:.97,depthWrite:true,
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
   const span=2.9+level*.11;
   const materials=[makeMat(0),makeMat(1),makeMat(2)];
   for(let layer=0;layer<3;layer++){
     const geometry=new PlaneGeometry(1,1,18,10);
     const pos=geometry.attributes.position;
     for(let i=0;i<pos.count;i++){
       const u=pos.getX(i)+.5,v=pos.getY(i)+.5;
       const sweep=span*(.78+layer*.12);
       pos.setXYZ(i,.10+u*sweep, (v-.35)*(1.95+level*.055)-u*.37-layer*.30,
         -.21-Math.sin(u*Math.PI)*(.30+layer*.12)+Math.pow(u,1.7)*.11);
     }
     geometry.computeVertexNormals();geometry.computeBoundingSphere();
     this.geometries.push(geometry);
     for(const sign of [-1,1]){
       const pivot=new Group();
       pivot.userData.side=sign;pivot.userData.layer=layer;
       pivot.position.set(sign*.06,0,-layer*.045);
       pivot.scale.x=sign;
       const mesh=new Mesh(geometry,materials[layer]);
       mesh.name=style+' curved feather/membrane layer '+layer;
       mesh.castShadow=false;mesh.frustumCulled=false;pivot.add(mesh);this.assembly.add(pivot);
     }
   }
   const count=level>5?84:56;
   const points=new Float32Array(count*3),velocity=new Float32Array(count);
   for(let i=0;i<count;i++){
     points[i*3]=(i%2?-1:1)*(.3+(i*13%29)/29*span);
     points[i*3+1]=((i*19%31)/31)*2-.3;
     points[i*3+2]=-.45-(i*11%9)*.04;
     velocity[i]=.12+(i%7)*.04;
   }
   const geom=new BufferGeometry();
   geom.setAttribute('position',new BufferAttribute(points,3).setUsage(DynamicDrawUsage));
   geom.userData.velocity=velocity;
   const pm=new PointsMaterial({color,size:.047,transparent:true,opacity:.8,blending:AdditiveBlending,
     depthWrite:false,sizeAttenuation:true});
   this.sparks=new Points(geom,pm);this.sparks.name=style+' emissive falling/rising sparks';
   this.sparks.frustumCulled=false;this.root.add(this.sparks);
   this.aura.configure(Math.min(5,2+Math.floor(level/3)),color);
   this.aura.position.set(0,.05,-.18);this.aura.scale.setScalar(.62);
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
   if(this.sparks){
     const att=this.sparks.geometry.attributes.position;
     const velocity=this.sparks.geometry.userData.velocity as Float32Array;
     for(let i=0;i<att.count;i++){
       const y=att.getY(i)+(this.key.startsWith('magma')||this.key.startsWith('solar')?1:-1)*velocity[i]*step;
       att.setY(i,y>2.15?-.45:y<-.45?2.15:y);
     }
     att.needsUpdate=true;this.particlePhase+=step;
   }
   this.aura.update(time);
 }
 private clear():void {
   this.sparks?.geometry.dispose();this.sparks?.material.dispose();this.sparks?.removeFromParent();this.sparks=undefined;
   this.geometries.forEach(g=>g.dispose());this.geometries.length=0;
   this.materials.forEach(m=>m.dispose());this.materials.length=0;
   this.texture?.dispose();this.texture=undefined;this.assembly.clear();
 }
 dispose():void {this.clear();this.aura.dispose();this.root.removeFromParent();}
}
