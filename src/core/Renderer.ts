import {ACESFilmicToneMapping,HalfFloatType,PCFSoftShadowMap,SRGBColorSpace,Vector2,WebGLRenderTarget,type Camera,type Scene,type WebGLRenderer,type DirectionalLight,type SpotLight} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export interface RendererOptions {mobile?:boolean;exposure?:number;}
/** All world and presentation cameras use the same linear → ACES → sRGB pipeline. */
export function configureRenderer(renderer:WebGLRenderer,options:RendererOptions={}):void {
  renderer.outputColorSpace=SRGBColorSpace;
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=options.exposure??1.15;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,options.mobile?1.5:2));
}

export function configureShadow(light:DirectionalLight|SpotLight,size=2048):void {
  light.castShadow=true;
  light.shadow.mapSize.set(size,size);
  light.shadow.bias=-.00015;
  light.shadow.normalBias=.025;
  light.shadow.radius=2;
}

export interface PresentationComposerOptions {bloom?:boolean;strength?:number;radius?:number;threshold?:number;}
/** Bloom sees HDR light before OutputPass applies exposure and the display transform. */
export function createPresentationComposer(renderer:WebGLRenderer,scene:Scene,camera:Camera,options:PresentationComposerOptions={}):EffectComposer {
  const target=new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:true});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  if(options.bloom!==false)composer.addPass(new UnrealBloomPass(new Vector2(1,1),options.strength??.3,options.radius??.45,options.threshold??1.2));
  composer.addPass(new OutputPass());
  return composer;
}
