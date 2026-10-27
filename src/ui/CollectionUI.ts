import {AdditiveBlending,BufferGeometry,CanvasTexture,Color,CylinderGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Points,ShaderMaterial,SRGBColorSpace,TorusGeometry} from 'three';
import type {Rarity} from '../core/GameTypes';

/** Presentation classes are explicit so new rarities never inherit an unrelated animation. */
export function collectionRarityClass(rarity:Rarity):string {
  return `collection-rarity-${rarity}`;
}

/** Decorations stay behind the canvas and never intercept rotation or equipment controls. */
export function collectionStageDecor():string {
  return '<div class="collection-stage-scenery" aria-hidden="true"><i class="stage-spotlight stage-spotlight-left"></i><i class="stage-spotlight stage-spotlight-right"></i><i class="stage-arch"></i><i class="stage-floor-rune"></i></div>';
}

function engravedStone():CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d')!;
  const gradient=context.createRadialGradient(128,128,6,128,128,128);
  gradient.addColorStop(0,'#515363');gradient.addColorStop(.75,'#292f3d');gradient.addColorStop(1,'#777064');
  context.fillStyle=gradient;context.fillRect(0,0,256,256);
  for(let i=0;i<900;i++){
    const x=(Math.sin(i*127.1)*43758.5453%1+1)%1*256,y=(Math.sin(i*311.7)*9512.14%1+1)%1*256;
    context.fillStyle=i%2?'#b6b1a00c':'#00000016';context.fillRect(x,y,1+(i%3),1);
  }
  context.strokeStyle='#b8a77b';context.lineWidth=1.3;
  for(const radius of [83,89,112,119]){context.beginPath();context.arc(128,128,radius,0,Math.PI*2);context.stroke();}
  for(let i=0;i<16;i++){
    context.save();context.translate(128,128);context.rotate(i*Math.PI/8);context.translate(0,-100);
    context.beginPath();context.moveTo(-4,5);context.lineTo(0,-6);context.lineTo(4,5);context.moveTo(-5,0);context.lineTo(5,0);context.stroke();context.restore();
  }
  for(let i=0;i<8;i++){
    context.save();context.translate(128,128);context.rotate(i*Math.PI/4);
    context.strokeStyle='#060b16a8';context.beginPath();context.moveTo(0,91);context.lineTo(2,72);context.lineTo(-3,57);context.lineTo(0,42);context.stroke();context.restore();
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}

/** A single particle draw call and four pedestal meshes, shared by every preview selection. */
export class CollectionPreviewStage {
  readonly root=new Group();
  private readonly stone=engravedStone();
  private readonly accent=new MeshStandardMaterial({color:0xd4bb7b,emissive:0xa77ae0,emissiveIntensity:1.1,roughness:.25,metalness:.8});
  private readonly particleMaterial=new ShaderMaterial({
    transparent:true,depthWrite:false,blending:AdditiveBlending,
    uniforms:{uTime:{value:0},uColor:{value:new Color(0xb894ef)},uHeight:{value:2.7}},
    vertexShader:`attribute float aSeed;uniform float uTime;uniform float uHeight;varying float vFade;void main(){vec3 p=position;float life=fract(aSeed+uTime*(.055+aSeed*.045));p.y=life*uHeight;p.x+=sin(uTime*.35+aSeed*23.)*.09;p.z+=cos(uTime*.27+aSeed*19.)*.08;vFade=sin(life*3.14159265);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((14.+aSeed*10.)/max(1.,-mv.z),1.5,7.);}`,
    fragmentShader:`uniform vec3 uColor;varying float vFade;void main(){vec2 uv=gl_PointCoord*2.-1.;float r=length(uv);float glow=pow(max(0.,1.-r),2.);float crossGlow=exp(-abs(uv.x)*24.)*exp(-abs(uv.y)*5.)+exp(-abs(uv.y)*24.)*exp(-abs(uv.x)*5.);float alpha=(glow*.55+crossGlow*.2)*vFade;if(alpha<.01)discard;gl_FragColor=vec4(uColor,alpha);}`
  });
  private readonly particles:Points;
  private elapsed=0;
  constructor(){
    this.root.name='Illuminated collection pedestal';
    const side=new MeshStandardMaterial({color:0x222736,roughness:.6,metalness:.65});
    const top=new MeshStandardMaterial({map:this.stone,color:0xccc5ca,roughness:.72,metalness:.42});
    const base=new Mesh(new CylinderGeometry(1.12,1.22,.14,64),[side,top,side]);base.position.y=-.10;this.root.add(base);
    const step=new Mesh(new CylinderGeometry(1.25,1.30,.08,64),side);step.position.y=-.21;this.root.add(step);
    for(const [radius,y] of [[1.12,-.028],[1.27,-.175]]){
      const rim=new Mesh(new TorusGeometry(radius,.014,5,64),this.accent);rim.rotation.x=-Math.PI/2;rim.position.y=y;this.root.add(rim);
    }
    const positions:number[]=[],seeds:number[]=[];
    for(let i=0;i<16;i++){
      const angle=i*2.3999632297,radius=.55+(i%19)/19*.82;
      positions.push(Math.cos(angle)*radius,0,Math.sin(angle)*radius);seeds.push((i*.61803398875)%1);
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('aSeed',new Float32BufferAttribute(seeds,1));
    this.particles=new Points(geometry,this.particleMaterial);this.particles.frustumCulled=false;this.particles.renderOrder=2;this.root.add(this.particles);
  }
  appearance(color:number,height=2.7):void {
    this.accent.emissive.setHex(color);this.particleMaterial.uniforms.uColor.value.setHex(color);
    this.particleMaterial.uniforms.uHeight.value=Math.max(1.8,height);
  }
  update(dt:number):void {
    this.elapsed+=dt;this.particleMaterial.uniforms.uTime.value=this.elapsed;
    this.accent.emissiveIntensity=.85+Math.sin(this.elapsed*1.5)*.18;
  }
  dispose():void {
    const materials=new Set<MeshStandardMaterial|ShaderMaterial>();
    this.root.traverse(object=>{if(object instanceof Mesh||object instanceof Points){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material as MeshStandardMaterial|ShaderMaterial);}});
    materials.forEach(material=>material.dispose());this.stone.dispose();this.root.removeFromParent();this.root.clear();
  }
}
