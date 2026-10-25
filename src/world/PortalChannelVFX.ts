import {
  AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3
} from 'three';

/** The meshes are visual effects only, never replacement terrain or actors. */
export class PortalChannelVFX {
  readonly root=new Group();
  private readonly ringMaterial:ShaderMaterial;
  private readonly beamMaterial:ShaderMaterial;
  private time=0;
  constructor(){
    this.ringMaterial=new ShaderMaterial({
      transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      uniforms:{uTime:{value:0},uFade:{value:1}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv; uniform float uTime; uniform float uFade;
        void main(){vec2 p=(vUv-.5)*2.;float radius=length(p);
          float ring=1.-smoothstep(.035,.075,abs(radius-.72));
          float glyph=sin(atan(p.y,p.x)*18.+uTime*3.)*.5+.5;
          float aura=exp(-abs(radius-.73)*8.)*.3;
          vec3 color=mix(vec3(.27,.08,.78),vec3(.48,.87,1.),glyph);
          float alpha=(ring+aura)*uFade;
          gl_FragColor=vec4(color*2.4,alpha*.85);}`,
    });
    this.beamMaterial=new ShaderMaterial({
      transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      uniforms:{uTime:{value:0},uFade:{value:1}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv; uniform float uTime;uniform float uFade;
        void main(){float edge=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.);
          float flow=.55+.45*sin(vUv.y*34.-uTime*12.);
          float alpha=edge*flow*uFade*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));
          gl_FragColor=vec4(.42,.24,.98,alpha*.55);}`,
    });
    const disc=new Mesh(new PlaneGeometry(5,5),this.ringMaterial);
    disc.rotation.x=-Math.PI/2;disc.position.y=.055;
    this.root.add(disc);
    for(const angle of [0,Math.PI/2]){
      const beam=new Mesh(new PlaneGeometry(2.7,6),this.beamMaterial);
      beam.position.y=3;beam.rotation.y=angle;this.root.add(beam);
    }
    this.root.visible=false;
  }
  start(position:Vector3):void{this.root.position.copy(position);this.root.visible=true;this.time=0;}
  update(dt:number,remaining:number):void{
    if(!this.root.visible)return;
    this.time+=Math.max(0,Math.min(.05,dt));
    const fade=Math.min(1,this.time*2,remaining*2);
    this.ringMaterial.uniforms.uTime.value=this.time;
    this.beamMaterial.uniforms.uTime.value=this.time;
    this.ringMaterial.uniforms.uFade.value=Math.max(0,fade);
    this.beamMaterial.uniforms.uFade.value=Math.max(0,fade);
  }
  stop():void{this.root.visible=false;}
  dispose():void{
    this.root.removeFromParent();
    this.root.traverse(object=>{if(object instanceof Mesh)object.geometry.dispose();});
    this.ringMaterial.dispose();this.beamMaterial.dispose();
  }
}
