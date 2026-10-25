import {DoubleSide,Group,MathUtils,Mesh,MeshStandardMaterial,PlaneGeometry,Texture} from 'three';
import type {WingStyle} from '../rpg/EvolutionSystem';
import {RarityAura} from './RarityAura';
import {wingTexture} from './WingTexture';
/** Exactly two curved alpha-cutout surfaces plus a single GPU aura at every evolution level. */
export class WingsSystem {
  readonly root=new Group();
  private readonly assembly=new Group();
  private readonly aura=new RarityAura(.8);
  private key='';
  private texture?:Texture;
  private material?:MeshStandardMaterial;
  private geometry?:PlaneGeometry;
  private readonly time={value:0};
  constructor(){this.root.name='Evolving alpha-textured wings';this.root.position.set(0,0,-.20);this.root.scale.setScalar(.61);this.root.add(this.assembly,this.aura);this.root.visible=false;}
  configure(style:WingStyle|null,level:number):void {
    this.root.visible=!!style;if(!style)return;level=Number.isFinite(level)?MathUtils.clamp(Math.floor(level),1,10):1;const key=style+level;if(this.key===key)return;this.clear();this.key=key;
    const color={necrotic:0xb19ae8,celestial:0xffe5b0,magma:0xff6b2a,glacial:0x91eaff}[style];
    this.texture=wingTexture(style);const material=this.material=new MeshStandardMaterial({map:this.texture,alphaTest:.3,side:DoubleSide,roughness:.65,metalness:.08,emissive:color,emissiveMap:this.texture,emissiveIntensity:.2+level*.045});
    material.onBeforeCompile=shader=>{shader.uniforms.wingTime=this.time;shader.vertexShader='uniform float wingTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.z+=sin(wingTime*2.6+position.x*3.8+position.y*2.)*abs(position.x)*.065;`);};material.customProgramCacheKey=()=> 'alpha-wing-wind-v1';
    const geometry=this.geometry=new PlaneGeometry(1,1,10+level*2,6+level),pos=geometry.attributes.position;
    const span=.52+Math.min(10,level)*.032;
    for(let i=0;i<pos.count;i++){const u=pos.getX(i)+.5,v=pos.getY(i)+.5;pos.setXYZ(i,u*span*1.55,(v-.4)*span*1.56+Math.sin(u*Math.PI)*.1,-Math.sin(u*Math.PI)*.17);}geometry.computeVertexNormals();geometry.computeBoundingSphere();
    for(const side of [-1,1]){const pivot=new Group();pivot.userData.side=side;pivot.scale.x=side;pivot.position.x=side*.08;const mesh=new Mesh(geometry,material);mesh.name='Curved '+style+' alpha wing';mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;pivot.add(mesh);this.assembly.add(pivot);}
    this.aura.configure(Math.min(5,2+Math.floor(level/3)),color);
  }
  update(dt:number,time:number,moving:number):void {if(!this.root.visible)return;this.time.value=time;for(const p of this.assembly.children){const side=p.userData.side as number;p.rotation.y=MathUtils.damp(p.rotation.y,side*(.2+Math.sin(time*(1.8+moving*.3))*.12),7,dt);p.rotation.z=side*Math.sin(time*2.1)*.045;}this.aura.update(time);}
  private clear():void{this.geometry?.dispose();this.material?.dispose();this.texture?.dispose();this.geometry=undefined;this.material=undefined;this.texture=undefined;this.assembly.clear();}
  dispose():void{this.clear();this.aura.dispose();this.root.removeFromParent();}
}
