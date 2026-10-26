import {WORLD_NOISE_GLSL} from '../WorldShaders';
import {BufferGeometry,DoubleSide,Float32BufferAttribute,Group,Mesh,ShaderMaterial} from 'three';
/** A single bounded draw call per river/lava bed. All data is owned by the active map. */
export class BiomeSurface {
 readonly root=new Group();private readonly mesh?:Mesh<BufferGeometry,ShaderMaterial>;private readonly extras:BufferGeometry[]=[];
 constructor(id:string,size:number,dungeon=false){
  if(id!=='aurora'&&id!=='rift'&&!(id==='void'&&dungeon))return;
  const lava=id!=='aurora',positions:number[]=[],indices:number[]=[],segments=96;
  for(let i=0;i<=segments;i++){
   const z=dungeon?-18-i/segments*78:size*.45-i/segments*size*.9;
   const x=dungeon?28:lava?40+Math.sin(z*.04)*18:45+Math.sin(z*.019)*13;
   for(const side of [-1,1])positions.push(x+side*(dungeon?7:lava?7:8),lava?.1:1.2,z);
   if(i<segments){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new ShaderMaterial({side:DoubleSide,transparent:!lava,uniforms:{time:{value:0},lava:{value:lava?1:0}},
   vertexShader:'uniform float time;varying vec3 vWorld;void main(){vec3 p=position;p.y+=sin(p.z*.55+time*1.7)*.07+cos(p.x*.9-time)*.05;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
   fragmentShader:`${WORLD_NOISE_GLSL}
uniform float time,lava;varying vec3 vWorld;void main(){float flow=sin(vWorld.x*2.8+sin(vWorld.z*.45-time*1.8)*2.4)*sin(vWorld.z*3.+time);float moltenNoise=fbm((vWorld.xz+vec2(vWorld.y*.35,0.))*.8+vec2(time*.12,-time*.3));float cracks=smoothstep(.34,.62,moltenNoise);vec3 molten=mix(vec3(.12,.018,.01),vec3(3.2,.65,.025),cracks);vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-abs(view.y),3.);vec3 water=mix(vec3(.025,.24,.3),vec3(.5,.8,.9),fresnel);water+=pow(max(0.,flow),8.)*.18;gl_FragColor=vec4(mix(water,molten,lava),mix(.86,1.,lava));}`});
  this.mesh=new Mesh(geometry,material);this.mesh.name=lava?'Incandescent lava flow':'Crystal river';this.mesh.castShadow=false;this.root.add(this.mesh);
  if(lava&&dungeon)for(const side of [-1,1])for(const z of [-40,-80]){
    const p:number[]=[],idx:number[]=[];
    for(let i=0;i<=24;i++){const y=20-i/24*18;for(const edge of [-1,1])p.push(side*23+edge*1.6,y,z+Math.sin(i*.14)*.25);if(i<24){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}}
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();this.extras.push(g);const fall=new Mesh(g,material);fall.name='Lava cascade';this.root.add(fall);
  }
 }
 update(time:number):void{if(this.mesh)this.mesh.material.uniforms.time.value=time;}
 dispose():void{for(const g of this.extras)g.dispose();this.mesh?.geometry.dispose();this.mesh?.material.dispose();this.root.removeFromParent();this.root.clear();}
}
