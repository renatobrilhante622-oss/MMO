import {AdditiveBlending,DoubleSide,Group,Mesh,PlaneGeometry,ShaderMaterial} from 'three';
/** Magic on architecture is a small shared shader pass, not a generated prop/creature. */
export class DungeonAtmosphere {
 readonly root=new Group();private readonly material:ShaderMaterial;private readonly geometry=new PlaneGeometry(5,10);
 constructor(id:string){
  this.material=new ShaderMaterial({side:DoubleSide,transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{time:{value:0}},vertexShader:'varying vec2 glassUv;void main(){glassUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 glassUv;uniform float time;void main(){vec2 p=(glassUv-.5)*2.;float arch=step(length(vec2(p.x,max(p.y-.3,0.)*1.6)),1.);float rays=abs(sin(atan(p.y,p.x)*8.));float ring=exp(-abs(length(p)-.55)*25.);float seams=smoothstep(.08,.15,rays);vec3 glass=mix(vec3(.12,.035,.4),vec3(.6,.24,.86),glassUv.y);glass+=vec3(.55,.37,.08)*ring;glass*=seams*(.7+.08*sin(time));gl_FragColor=vec4(glass*1.8,arch*.74);}`});
  if(id==='eclipse')for(const x of [-11,0,11]){const pane=new Mesh(this.geometry,this.material);pane.name='Animated abyssal stained glass';pane.position.set(x,11,-92);this.root.add(pane);}
 }
 update(time:number):void{this.material.uniforms.time.value=time;}
 dispose():void{this.geometry.dispose();this.material.dispose();this.root.removeFromParent();this.root.clear();}
}
