import { ACESFilmicToneMapping, CircleGeometry, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { ArticulatedCharacter } from '../player/ArticulatedCharacter';
import {configureCharacterCamera,disableCharacterCulling,fitPreviewCamera} from '../player/PlayerRenderer';
import { CLASS_DEFINITIONS } from '../combat/ClassSystem';
import type { ClassId } from '../core/GameTypes';
import {RARITIES} from '../rpg/InventoryAndLoot';
import type { Cosmetic } from '../progression/AdventureProgress';
import { CompanionRig } from '../companions/CompanionRig';
/** Bounds are fitted after mount, async model completion and viewport changes, not every animation frame. */
export class CharacterPreview {
  private readonly renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(32,1,.1,1000);
  private rig?:ArticulatedCharacter;
  private animal?:CompanionRig;
  private key='';
  private frame=0;
  private time=0;
  private last=0;
  private held=false;
  private dragX=0;
  private yaw=-.18;
  private host?:HTMLElement;
  private width=0;
  private height=0;
  private revision=-1;
  private needsFit=true;
  private readonly resizeObserver=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{this.needsFit=true;});
  constructor(){
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.setPixelRatio(1);this.renderer.setClearColor(0,0);this.renderer.domElement.className='paperdoll-canvas';
    this.renderer.domElement.setAttribute('aria-label','3D character preview');configureCharacterCamera(this.camera);
    this.scene.add(new HemisphereLight(0xc5dbff,0x1d2635,2.4));
    const key=new DirectionalLight(0xe5eaff,3.2);key.position.set(-3,5,5);const rim=new DirectionalLight(0xae7aff,4.5);rim.position.set(3,3,-3);this.scene.add(key,rim);
    const floor=new Mesh(new CircleGeometry(1.6,48),new MeshStandardMaterial({color:0x182431,roughness:.8,metalness:.4,transparent:true,opacity:.45}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;this.scene.add(floor);
    const c=this.renderer.domElement;c.addEventListener('pointerdown',e=>{this.held=true;this.dragX=e.clientX;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(this.held){this.yaw+=(e.clientX-this.dragX)*.013;this.dragX=e.clientX;this.needsFit=true;this.draw(0);}});c.addEventListener('pointerup',()=>this.held=false);c.addEventListener('pointercancel',()=>this.held=false);
  }
  mount(host:HTMLElement,id:ClassId,color:number,refine:number,cosmetic?:Cosmetic):void {
    const key=id+':'+(cosmetic?.id??'hero');
    if(key!==this.key){this.rig?.dispose();this.animal?.dispose();this.rig=undefined;this.animal=undefined;this.key=key;this.revision=-1;
      if(cosmetic&&(cosmetic.type==='pet'||cosmetic.type==='mount')){this.animal=new CompanionRig(cosmetic.type==='mount');this.animal.appearance(cosmetic);this.scene.add(this.animal.root);}
      else{this.rig=new ArticulatedCharacter(CLASS_DEFINITIONS[id]);this.scene.add(this.rig.root);}
    }
    if(this.rig){if(cosmetic?.type==='weapon')this.rig.weapons.skin(cosmetic.id);if(cosmetic?.type==='skin')this.rig.skinAppearance(cosmetic.id,cosmetic.color,RARITIES.indexOf(cosmetic.rarity));if(cosmetic?.type==='wing')this.rig.wings.configure((['necrotic','celestial','glacial','magma','celestial','necrotic'] as const)[Number(cosmetic.id.split('-')[1])??0],Math.max(1,refine));this.rig.accent.color.setHex(cosmetic?.color??color);this.rig.accent.emissive.setHex(cosmetic?.color??color);this.rig.weaponAppearance(cosmetic?.color??color,refine,cosmetic?.rarity??'rare');}
    this.resizeObserver?.disconnect();this.host=host;this.resizeObserver?.observe(host);host.append(this.renderer.domElement);this.needsFit=true;
    this.draw(0);if(!this.frame)this.frame=requestAnimationFrame(this.animate);
  }
  private draw(dt:number):void {
    this.time+=dt;
    if(this.rig){this.rig.root.rotation.y=this.yaw;this.rig.update(dt,this.time,'idle',0,this.yaw,0);}
    if(this.animal){this.animal.root.rotation.y=this.yaw+.5;this.animal.update(dt,0,this.time);}
    const root=this.rig?.root??this.animal?.root;if(!root||!this.host)return;
    const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight),revision=root.userData.characterRevision??0;
    if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.needsFit=true;}
    if(this.needsFit||revision!==this.revision){disableCharacterCulling(root);fitPreviewCamera(this.camera,root,width/height,1.2);this.revision=revision;this.needsFit=false;}
    this.renderer.render(this.scene,this.camera);
  }
  private readonly animate=(now:number):void=>{this.frame=requestAnimationFrame(this.animate);if(this.last&&now-this.last<50)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):1/30;this.last=now;this.draw(dt);};
  hide():void{cancelAnimationFrame(this.frame);this.frame=0;this.last=0;this.resizeObserver?.disconnect();}
  dispose():void{this.hide();this.rig?.dispose();this.animal?.dispose();this.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}
