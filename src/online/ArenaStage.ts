import { ACESFilmicToneMapping, BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, RingGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { ArticulatedCharacter } from '../player/ArticulatedCharacter';
import { CLASS_DEFINITIONS } from '../combat/ClassSystem';
import type { ClassId } from '../core/GameTypes';
import type { OnlineView } from './OnlineClient';
/** Dedicated visual arena. The server snapshot is the sole source of combat state. */
export class ArenaStage {
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(44,2,0.1,80);
  private readonly renderer:WebGLRenderer;
  private readonly actors=new Map<string,{rig:ArticulatedCharacter;hp:number;energy:number;attack:number}>();
  private frame=0;
  private last=0;
  private clock=0;
  private visible=false;
  private view:OnlineView|null=null;
  constructor(){
    this.renderer=new WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.setPixelRatio(1);
    this.renderer.domElement.setAttribute('aria-label','Live 3D arena');this.renderer.domElement.className='arena-stage';
    this.scene.background=new Color('#101a27');this.scene.add(new HemisphereLight(0xbad5ff,0x232028,2.2));
    const key=new DirectionalLight(0xffdfb3,3);key.position.set(4,10,2);this.scene.add(key);
    const stone=new MeshStandardMaterial({color:0x34404c,roughness:.85,metalness:.12});
    const floor=new Mesh(new CylinderGeometry(7,7.3,.6,48),stone);floor.position.y=-.35;this.scene.add(floor);
    const ring=new Mesh(new RingGeometry(6.5,6.6,64),new MeshStandardMaterial({color:0x7cd5dc,emissive:0x3b9bb1,emissiveIntensity:.7}));ring.rotation.x=-Math.PI/2;this.scene.add(ring);
    for(let i=0;i<8;i++){const pillar=new Mesh(new BoxGeometry(.55,2.5,.55),stone);pillar.position.set(Math.cos(i*Math.PI/4)*6.8,.8,Math.sin(i*Math.PI/4)*6.8);this.scene.add(pillar);}
    this.camera.position.set(8,8,12);this.camera.lookAt(0,1,0);
  }
  mount(container:HTMLElement,view:OnlineView):void {
    container.append(this.renderer.domElement);this.view=view;this.visible=true;
    const width=Math.max(200,Math.min(720,container.clientWidth));this.renderer.setSize(width,Math.max(180,width*.48),false);this.camera.aspect=width/Math.max(180,width*.48);this.camera.updateProjectionMatrix();
    const fighters=view.match?.fighters??[];const ids=new Set(fighters.map(f=>f.id));
    for(const [id,actor]of this.actors)if(!ids.has(id)){actor.rig.dispose();actor.rig.root.removeFromParent();this.actors.delete(id);}
    const counts=[0,0];
    for(const f of fighters){let actor=this.actors.get(f.id);if(!actor){const classId=(f.classId&&f.classId in CLASS_DEFINITIONS?f.classId:'berserker') as ClassId;const rig=new ArticulatedCharacter(CLASS_DEFINITIONS[classId]);rig.accent.color.setHex(f.team===0?0x72c5ff:0xf38796);actor={rig,hp:f.hp,energy:f.energy,attack:0};this.actors.set(f.id,actor);this.scene.add(rig.root);}
      if(f.energy!==actor.energy&&f.energy<actor.energy){actor.rig.attack(0,1);actor.attack=.6;}
      if(f.hp<actor.hp)actor.attack=Math.max(actor.attack,.12);
      actor.hp=f.hp;actor.energy=f.energy;const index=counts[f.team]++;actor.rig.root.position.set(f.team===0?-2.2:2.2,0,(index-(view.match!.fighters.length/2-1)/2)*2.2);actor.rig.root.rotation.y=f.team===0?Math.PI/2:-Math.PI/2;
    }
    if(!this.frame)this.frame=requestAnimationFrame(this.animate);
    this.renderer.render(this.scene,this.camera);
  }
  hide():void{this.visible=false;cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}
  private readonly animate=(time:number):void=>{
    if(!this.visible)return;this.frame=requestAnimationFrame(this.animate);
    const dt=this.last?Math.min(.05,(time-this.last)/1000):1/30;if(this.last&&time-this.last<32)return;this.last=time;this.clock+=dt;
    for(const actor of this.actors.values()){actor.attack=Math.max(0,actor.attack-dt);actor.rig.update(dt,this.clock,actor.hp<=0?'dead':'idle',0,actor.rig.root.rotation.y,actor.attack>.01?.2:0);}
    this.renderer.render(this.scene,this.camera);
  };
  dispose():void{this.hide();this.actors.forEach(a=>a.rig.dispose());this.actors.clear();const geometries=new Set<unknown>(),materials=new Set<MeshStandardMaterial>();this.scene.traverse(o=>{if(o instanceof Mesh){if(!geometries.has(o.geometry)){o.geometry.dispose();geometries.add(o.geometry);}for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m as MeshStandardMaterial);}});materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}
