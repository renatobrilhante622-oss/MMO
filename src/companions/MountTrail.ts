import {AdditiveBlending,Color,InstancedBufferAttribute,InstancedMesh,Matrix4,PlaneGeometry,Scene,ShaderMaterial,Vector3} from 'three';
import {ELEMENT_COLORS,type SkinElement} from '../player/SkinCatalog';
/** Fixed 64-slot footprint pool: one draw call regardless of traveled distance. */
export class MountTrail {
 readonly mesh:InstancedMesh;private readonly age=new Float32Array(64);private readonly style=new Float32Array(64);private cursor=0;private last=new Vector3(Infinity,0,0);private elapsed=0;
 private matrix=new Matrix4();
 constructor(scene:Scene){
  const g=new PlaneGeometry(.55,.8);g.rotateX(-Math.PI/2);g.setAttribute('fade',new InstancedBufferAttribute(this.age,1));g.setAttribute('style',new InstancedBufferAttribute(this.style,1));
  const m=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,vertexColors:true,vertexShader:'attribute float fade;attribute float style;varying vec2 vUv;varying float vFade;varying float vStyle;varying vec3 tint;void main(){vUv=uv;vFade=fade;vStyle=style;tint=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;varying float vFade;varying float vStyle;varying vec3 tint;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=pow(max(0.,1.-r),2.);if(vStyle<.5)a=max(a,exp(-abs(p.x)*20.)*.4);else if(vStyle<1.5)a*=1.+sin(p.y*15.)*.3;else if(vStyle<2.5)a=max(a,exp(-abs(r-.65)*25.)*.8);else a*=.6;gl_FragColor=vec4(tint*1.5,a*vFade*.85);}'});
  this.mesh=new InstancedMesh(g,m,64);this.mesh.count=64;for(let i=0;i<64;i++){this.matrix.makeScale(0,0,0);this.mesh.setMatrixAt(i,this.matrix);this.mesh.setColorAt(i,new Color());}this.mesh.name='Pooled elemental mount footprints (64)';scene.add(this.mesh);
 }
 update(dt:number,mounted:boolean,position:Vector3,heading:number,element:SkinElement,height:(x:number,z:number)=>number):void {
  dt=Math.max(0,Math.min(.1,dt));this.elapsed+=dt;
  for(let i=0;i<64;i++)this.age[i]=Math.max(0,this.age[i]-dt/4);
  if(Number.isFinite(this.last.x)&&this.last.distanceTo(position)>20)this.clear();
  if(!mounted||element==='steel'){this.last.copy(position);}else if(this.last.distanceTo(position)>.8){
   if(!Number.isFinite(this.last.x))this.last.copy(position);else{
    const i=this.cursor++%64,side=i%2?-1:1,x=position.x+Math.cos(heading)*side*.42,z=position.z-Math.sin(heading)*side*.42;
    this.matrix.makeRotationY(heading);this.matrix.setPosition(x,height(x,z)+.035,z);this.mesh.setMatrixAt(i,this.matrix);this.mesh.setColorAt(i,new Color(ELEMENT_COLORS[element]));this.age[i]=1;this.style[i]=element==='frost'?0:element==='fire'?1:element==='void'?3:2;this.last.copy(position);
   }
  }
  this.mesh.geometry.attributes.fade.needsUpdate=true;this.mesh.geometry.attributes.style.needsUpdate=true;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.mesh.visible=this.age.some(a=>a>0);if(this.mesh.visible)this.mesh.computeBoundingSphere();
 }
 clear():void{this.age.fill(0);this.last.set(Infinity,0,0);this.mesh.visible=false;}
 dispose():void{this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as ShaderMaterial).dispose();this.mesh.dispose();}
}
