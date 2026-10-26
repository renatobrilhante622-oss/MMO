import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Sphere, Vector3 } from 'three';
/** One bounded draw call: orbital motes, rising flames and cosmic filaments, driven in GLSL. */
export class RarityAura extends Points<BufferGeometry,ShaderMaterial>{
  constructor(radius=1){
    const geometry=new BufferGeometry(),seeds:number[]=[];
    for(let i=0;i<96;i++)seeds.push((i*.61803398875)%1,(i*.41421356237)%1,(i*.73205080756)%1);
    geometry.setAttribute('position',new Float32BufferAttribute(seeds,3));
    super(geometry,new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{time:{value:0},tier:{value:0},radius:{value:radius},color:{value:[.4,.7,1]}},
      vertexShader:`uniform float time,tier,radius;varying float alpha;varying float shape;void main(){float phase=fract(position.y+time*(.2+position.z*.15));float angle=position.x*6.2831853+time*(.5+position.z);float cosmic=step(4.5,tier);float r=radius*(.7+position.z*.3)+cosmic*sin(phase*20.+time*3.)*.12;vec3 p=vec3(cos(angle)*r,phase*(1.2+tier*.2),sin(angle)*r);p.y+=cosmic*sin(angle*3.+time)*.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;float enabledMote=step(position.z,clamp((tier-1.)/4.,0.,1.));alpha=sin(phase*3.14159)*enabledMote*.7;shape=tier;gl_PointSize=clamp((tier>3.5?95.:65.)/max(.5,-mv.z),1.,18.);}`,
      fragmentShader:`uniform vec3 color;varying float alpha;varying float shape;void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);if(r>1.)discard;float glow=exp(-r*r*5.);if(shape>4.5)glow=max(glow,exp(-abs(p.x)*20.)*(1.-abs(p.y)));gl_FragColor=vec4(color*(1.+glow*2.),glow*alpha);}`,
    }));this.geometry.boundingSphere=new Sphere(new Vector3(0,1,0),radius+2.4);this.frustumCulled=true;this.visible=false;
  }
  configure(tier:number,color:number):void {this.material.uniforms.tier.value=tier;this.material.uniforms.color.value=[((color>>16)&255)/255,((color>>8)&255)/255,(color&255)/255];this.geometry.setDrawRange(0,tier<3?0:tier===3?24:tier===4?40:56);this.visible=tier>=3;}
  update(time:number):void{this.material.uniforms.time.value=time;}
  dispose():void{this.geometry.dispose();this.material.dispose();this.removeFromParent();}
}
