import { ACESFilmicToneMapping, CircleGeometry, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { ArticulatedCharacter } from '../player/ArticulatedCharacter';
import { CLASS_DEFINITIONS } from '../combat/ClassSystem';
import type { ClassId } from '../core/GameTypes';
import type { Cosmetic } from '../progression/AdventureProgress';
import { CompanionRig } from '../companions/CompanionRig';
/** Live paperdoll uses the exact character/companion assemblies from the world. */
export class CharacterPreview {
  private readonly renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(32,1,.1,30);
  private rig?:ArticulatedCharacter;
  private animal?:CompanionRig;
  private key='';
  private frame=0;
  private time=0;
  private last=0;
  private held=false;
  private dragX=0;
  private yaw=-.18;
  constructor(){
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.setPixelRatio(1);this.renderer.setClearColor(0,0);this.renderer.domElement.className='paperdoll-canvas';
    this.renderer.domElement.setAttribute('aria-label','3D character preview');
    this.scene.add(new HemisphereLight(0xc5dbff,0x1d2635,2.4));
    const key=new DirectionalLight(0xe5eaff,3.2);key.position.set(-3,5,5);const rim=new DirectionalLight(0xae7aff,4.5);rim.position.set(3,3,-3);this.scene.add(key,rim);
    const floor=new Mesh(new CircleGeometry(1.6,48),new MeshStandardMaterial({color:0x182431,roughness:.8,metalness:.4,transparent:true,opacity:.45}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;this.scene.add(floor);
    const c=this.renderer.domElement;c.addEventListener('pointerdown',e=>{this.held=true;this.dragX=e.clientX;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(this.held){this.yaw+=(e.clientX-this.dragX)*.013;this.dragX=e.clientX;this.draw(0);}});c.addEventListener('pointerup',()=>this.held=false);c.addEventListener('pointercancel',()=>this.held=false);
  }
  mount(host:HTMLElement,id:ClassId,color:number,refine:number,cosmetic?:Cosmetic):void {
    const key=id+':'+(cosmetic?.id??'hero');
    if(key!==this.key){this.rig?.dispose();this.animal?.dispose();this.rig=undefined;this.animal=undefined;this.key=key;
      if(cosmetic&&(cosmetic.type==='pet'||cosmetic.type==='mount')){this.animal=new CompanionRig(cosmetic.type==='mount');this.animal.appearance(cosmetic);this.scene.add(this.animal.root);}
      else{this.rig=new ArticulatedCharacter(CLASS_DEFINITIONS[id]);this.scene.add(this.rig.root);}
    }
    if(this.rig){this.rig.accent.color.setHex(cosmetic?.color??color);this.rig.accent.emissive.setHex(cosmetic?.color??color);this.rig.weaponAppearance(cosmetic?.color??color,refine,cosmetic?.rarity??'rare');}
    host.append(this.renderer.domElement);const width=Math.max(64,host.clientWidth),height=Math.max(100,host.clientHeight);this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
    const animal=cosmetic?.type==='mount';const distance=Math.max(animal?6.2:4.4,(animal?2.5:1.05)/(2*Math.tan(16*Math.PI/180)*this.camera.aspect));this.camera.position.set(0,animal?1.9:1.25,distance);this.camera.lookAt(0,animal?1.2:1.05,0);this.camera.updateProjectionMatrix();
    this.draw(0);if(!this.frame)this.frame=requestAnimationFrame(this.animate);
  }
  private draw(dt:number):void {this.time+=dt;if(this.rig){this.rig.root.rotation.y=this.yaw;this.rig.update(dt,this.time,'idle',0,this.yaw,0);}if(this.animal){this.animal.root.rotation.y=this.yaw+.5;this.animal.update(dt,0,this.time);}this.renderer.render(this.scene,this.camera);}
  private readonly animate=(now:number):void=>{this.frame=requestAnimationFrame(this.animate);if(this.last&&now-this.last<50)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):1/30;this.last=now;this.draw(dt);};
  hide():void{cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}
  dispose():void{this.hide();this.rig?.dispose();this.animal?.dispose();this.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}
