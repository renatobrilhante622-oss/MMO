import { Color, Matrix4, PerspectiveCamera, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Depth-aware height fog integrated along the view ray; no external textures. */
export class AtmospherePass extends ShaderPass {
  constructor(private readonly camera: PerspectiveCamera) {
    super({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        inverseProjection: { value: new Matrix4() }, cameraWorld: { value: new Matrix4() },
        cameraPositionWorld: { value: new Vector3() }, sunDirection: { value: new Vector3(-0.5, 0.8, -0.3) },
        fogColor: { value: new Color('#96babb') }, density: { value: 0.006 }, time: { value: 0 },
      },
      vertexShader: `varying vec2 vUv;
        void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        uniform sampler2D tDiffuse,tDepth;
        uniform mat4 inverseProjection,cameraWorld;
        uniform vec3 cameraPositionWorld,sunDirection,fogColor;
        uniform float density,time;
        varying vec2 vUv;
        void main(){
          vec4 color=texture2D(tDiffuse,vUv);
          float depth=texture2D(tDepth,vUv).x;
          vec4 view=inverseProjection*vec4(vUv*2.0-1.0,depth*2.0-1.0,1.0);
          view/=view.w;
          vec3 endpoint=(cameraWorld*vec4(view.xyz,1.0)).xyz;
          vec3 ray=endpoint-cameraPositionWorld;
          float distanceToSurface=min(length(ray),180.0);
          vec3 direction=normalize(ray);
          float optical=0.0;
          for(int i=0;i<12;i++){
            float t=(float(i)+0.5)/12.0;
            vec3 p=cameraPositionWorld+direction*distanceToSurface*t;
            float heightFalloff=exp(-max(p.y-1.5,0.0)*0.14);
            float wisps=0.82+0.18*sin(p.x*0.045+time*0.06)*sin(p.z*0.035-time*0.04);
            optical+=heightFalloff*wisps;
          }
          float amount=1.0-exp(-optical/12.0*distanceToSurface*density);
          float forwardScattering=pow(max(dot(direction,normalize(sunDirection)),0.0),12.0);
          vec3 light=fogColor+vec3(0.24,0.17,0.07)*forwardScattering;
          gl_FragColor=vec4(mix(color.rgb,light,amount),color.a);
        }`,
    });
  }

  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, dt: number, maskActive: boolean): void {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    this.uniforms.cameraWorld.value.copy(this.camera.matrixWorld);
    this.uniforms.cameraPositionWorld.value.copy(this.camera.position);
    super.render(renderer, writeBuffer, readBuffer, dt, maskActive);
  }
}
