import { CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, TorusGeometry, Vector3, AdditiveBlending } from 'three';
import {RigidSkinBatch} from '../assets/RigidSkinBatch';
import {AnimatedGLB} from '../assets/AnimatedGLB';
import {WingsSystem} from './WingsSystem';
import { RarityAura } from './RarityAura';
import type { Cosmetic } from '../progression/AdventureProgress';
import { RARITIES } from '../rpg/InventoryAndLoot';
interface Leg { hip:Group; knee:Group; ankle:Group; rear:boolean; side:number; }
/** Anatomical horse/wolf rig. Lower joints absorb each planted stance instead of rotating rigid poles. */
export class CompanionRig {
  readonly root=new Group();
  /** Stable socket for an independently animated rider. Coordinates follow the horse's scaled root. */
  readonly saddle=new Group();
  private readonly spine=new Group();
  private readonly neck=new Group();
  private readonly head=new Group();
  private readonly tail=new Group();
  private readonly legs:Leg[]=[];
  private readonly materials=new Set<MeshStandardMaterial>();
  private readonly coat:MeshStandardMaterial;
  private readonly glow:MeshStandardMaterial;
  private readonly aura:Mesh;
  private readonly ornaments=new Group();
  private readonly morph=new Group();
  private readonly flight=new WingsSystem();
  private batch?:RigidSkinBatch;
  private imported?:AnimatedGLB;
  private importedType='';
  private phase=0;
  private stride=0;
  private rarity=0;
  private isStag=false;
  private appearanceId='';
  private readonly wings=new Group();
  private readonly armor=new Group();
  private readonly particles:RarityAura;
  constructor(readonly horse:boolean){
    this.root.name=horse?'Articulated horse mount':'Articulated wolf companion';
    this.coat=this.material(horse?0x8a6041:0x8b969e,.88);
    const dark=this.material(0x252328,.9),light=this.material(0xd6cab0,.88),leather=this.material(0x363331,.76),metal=this.material(0xc7ab6e,.3,.7);
    this.glow=this.material(0xa9e8ff,.4);this.glow.emissive.setHex(0xa9e8ff);
    this.root.add(this.spine);this.spine.position.y=horse?1.23:.68;
    if(horse){this.saddle.name='mountSaddleNode';this.saddle.position.set(0,1.6,-.08);this.root.add(this.saddle);}
    this.ellipsoid(this.spine,this.coat,[horse?.4:.25,horse?.5:.28,horse?.83:.53],[0,0,0]);
    this.ellipsoid(this.spine,this.coat,[horse?.43:.3,horse?.53:.34,horse?.39:.29],[0,0,horse?.44:.29]);
    this.ellipsoid(this.spine,this.coat,[horse?.43:.27,horse?.46:.29,horse?.38:.26],[0,0,horse?-.49:-.32]);
    this.spine.add(this.neck);this.neck.position.set(0,horse?.23:.12,horse?.55:.36);
    this.neck.rotation.x=horse?.3:.5;
    this.ellipsoid(this.neck,this.coat,[horse?.23:.2,horse?.6:.28,horse?.27:.24],[0,horse?.34:.13,0]);
    this.neck.add(this.head);this.head.position.set(0,horse?.82:.34,horse?.19:.13);
    this.head.rotation.x=horse?-.22:-.3;
    this.ellipsoid(this.head,this.coat,[horse?.22:.23,horse?.27:.22,horse?.42:.3],[0,0,.08]);
    this.ellipsoid(this.head,horse?dark:light,[horse?.18:.15,horse?.15:.12,horse?.24:.22],[0,-.1,horse?.43:.34]);
    this.ellipsoid(this.head,dark,[horse?.12:.09,.065,.05],[0,-.04,horse?.63:.54]);
    for(const side of [-1,1]){
      this.ellipsoid(this.head,dark,[.06,.065,.045],[side*(horse?.2:.22),.07,.21]);
      this.ellipsoid(this.head,this.glow,[.024,.032,.025],[side*(horse?.239:.26),.074,.225]);
      const ear=this.mesh(this.head,new ConeGeometry(horse?.085:.11,horse?.35:.26,7),this.coat,side*(horse?.15:.16),horse?.35:.29,-.04);ear.rotation.z=-side*.24;
      this.ellipsoid(this.head,light,[horse?.04:.055,horse?.12:.08,.025],[side*.15,horse?.38:.3,-.005]);
      for(const rear of [false,true]){
        const hip=new Group(),knee=new Group(),ankle=new Group();
        hip.position.set(side*(horse?.29:.19),horse?-.05:-.04,rear?(horse?-.53:-.32):(horse?.49:.34));this.spine.add(hip);
        const upper=horse?.56:.28,lower=horse?.49:.25;
        this.mesh(hip,new CapsuleGeometry(horse?.105:.07,upper*.7,4,8),this.coat,0,-upper*.45,0);
        knee.position.y=-upper;hip.add(knee);
        this.ellipsoid(knee,this.coat,[horse?.105:.075,.12,.095],[0,0,0]);
        this.mesh(knee,new CylinderGeometry(horse?.064:.042,horse?.052:.038,lower,8),this.coat,0,-lower*.5,0);
        ankle.position.y=-lower;knee.add(ankle);
        this.ellipsoid(ankle,horse?dark:light,[horse?.1:.08,horse?.11:.065,horse?.14:.12],[0,-.06,.04]);
        this.legs.push({hip,knee,ankle,rear,side});
      }
    }
    this.spine.add(this.tail);this.tail.position.set(0,.1,horse?-.79:-.49);
    for(let i=0;i<6;i++){
      const t=i/5;this.ellipsoid(this.tail,horse?dark:this.coat,[horse?.085:.11,horse?.17:.12,horse?.08:.15],[Math.sin(t*.8)*.06,-t*(horse?.85:.2),-t*(horse?.2:.42)]);
    }
    if(horse){
      // Individual mane locks, bridle, girth, pommel, stirrups and reins.
      for(let i=0;i<10;i++)this.ellipsoid(this.neck,dark,[.065,.105,.085],[0,i*.065,-.2]);
      this.ellipsoid(this.spine,leather,[.46,.105,.42],[0,.49,-.07]);
      this.ellipsoid(this.spine,metal,[.34,.065,.055],[0,.6,-.3]);
      this.ellipsoid(this.spine,leather,[.12,.1,.18],[0,.6,.17]);
      const girth=this.mesh(this.spine,new TorusGeometry(.44,.035,5,24),leather,0,0,-.02);girth.scale.y=1.16;
      for(const side of [-1,1]){
        const stirrup=this.mesh(this.spine,new TorusGeometry(.1,.018,5,16),metal,side*.46,.06,-.1);stirrup.rotation.y=Math.PI/2;
        this.between(this.head,new Vector3(side*.2,-.06,.4),new Vector3(side*.2,.21,-.03),.017,leather);
        this.between(this.spine,new Vector3(side*.22,.53,.1),new Vector3(side*.18,1,.67),.015,leather);
      }
    }else{
      const collar=this.mesh(this.neck,new TorusGeometry(.23,.03,5,20),metal,0,.08,0);collar.rotation.x=Math.PI/2;
      for(let i=0;i<8;i++)this.ellipsoid(this.spine,light,[.065,.11,.085],[Math.sin(i*2.4)*.17,.15+Math.cos(i*2.4)*.16,.29]);
    }
    this.head.add(this.ornaments);
    this.spine.add(this.wings,this.armor,this.morph,this.flight.root);
    if(horse){
      for(const side of [-1,1]){
        const wing=new Group();wing.position.set(side*.3,.4,.1);wing.userData.side=side;this.wings.add(wing);
        for(let i=0;i<9;i++){const feather=this.mesh(wing,new CapsuleGeometry(.07,.7+i*.035,3,6),light,side*(.23+i*.12),-.03*i,-i*.06);feather.rotation.z=-side*(.4+i*.065);}
        this.ellipsoid(this.armor,metal,[.24,.46,.38],[side*.37,.04,.43]);
        this.ellipsoid(this.armor,metal,[.22,.35,.32],[side*.36,-.03,-.5]);
      }
      this.ellipsoid(this.armor,metal,[.32,.1,.3],[0,.52,.42]);
    }
    this.wings.visible=false;this.armor.visible=false;
    this.particles=new RarityAura(horse?.8:.5);this.root.add(this.particles);
    this.aura=new Mesh(new RingGeometry(.7,.75,48),new MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:1.3,transparent:true,opacity:.35,depthWrite:false,blending:AdditiveBlending,side:2}));
    this.aura.rotation.x=-Math.PI/2;this.aura.position.y=.06;this.root.add(this.aura);this.aura.visible=false;
  }
  private material(color:number,roughness:number,metalness=.05):MeshStandardMaterial {const m=new MeshStandardMaterial({color,roughness,metalness});this.materials.add(m);return m;}
  private mesh(parent:Object3D,geometry:CapsuleGeometry|ConeGeometry|CylinderGeometry|SphereGeometry|TorusGeometry,material:MeshStandardMaterial,x:number,y:number,z:number):Mesh {const m=new Mesh(geometry,material);m.position.set(x,y,z);m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  private ellipsoid(parent:Object3D,material:MeshStandardMaterial,size:number[],at:number[]):Mesh {const m=this.mesh(parent,new SphereGeometry(1,12,8),material,at[0],at[1],at[2]);m.scale.set(size[0],size[1],size[2]);return m;}
  private between(parent:Object3D,a:Vector3,b:Vector3,radius:number,material:MeshStandardMaterial):void {const d=b.clone().sub(a);const m=this.mesh(parent,new CylinderGeometry(radius,radius,d.length(),6),material,0,0,0);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize());}
  appearance(c:Cosmetic):void {
    if(this.appearanceId===c.id)return;this.batch?.dispose();this.batch=undefined;this.appearanceId=c.id;this.rarity=RARITIES.indexOf(c.rarity);
    this.particles.configure(this.rarity,c.color);this.wings.visible=this.horse&&c.id==='eternalhorse';this.armor.visible=this.horse&&['sunhorse','nightmare'].includes(c.id);
    for(const group of [this.ornaments,this.morph]){group.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});group.clear();}
    const bird=c.id==='phoenix',dragon=['wyvern','dracolich'].includes(c.id),giant=['fenrir','nighthorse'].includes(c.id),stag=['stag','spiritstag'].includes(c.id),hell=c.id==='hellhound';
    // Every in-game companion has an authored GLB silhouette. Variant effects
    // remain particles/shaders; no orange-cylinder wyvern appears during loading.
    const importedType=bird?'Parrot'
      :c.id==='wyvern'?'Creature_wyvern'
      :c.id==='dracolich'?'Creature_dragon'
      :['fenrir','nighthorse','wolf','fox','hellhound','frostwolf','spiritwolf','sunwolf','moonwolf'].includes(c.id)?'Creature_wolf'
      :this.horse?'Horse':'Creature_wolf';
    if(importedType!==this.importedType){this.imported?.dispose();this.imported=undefined;this.importedType=importedType;this.spine.visible=typeof document==='undefined';
      if(importedType){this.imported=new AnimatedGLB(importedType,bird?.9:dragon?3.2:giant?2.6:2.1,()=>{
        this.spine.visible=false;
        if(this.batch)this.batch.mesh.visible=false;
      },false);this.root.add(this.imported.root);}}
    this.imported?.tint(c.color,c.color);
    this.legs.forEach(l=>l.hip.visible=!bird);this.root.name=c.name[1];this.spine.scale.set(giant?1.2:1,bird?.8:1,dragon?1.15:1);
    this.neck.scale.setScalar(giant?.65:bird?.6:1);this.head.scale.set(giant?1.3:bird?.7:1,1,giant?1.2:1);
    this.coat.color.setHex(hell||c.id==='nightmare'?0x18131c:c.id==='dracolich'?0xa7b6ac:c.color);this.glow.color.setHex(c.color);this.glow.emissive.setHex(c.color);this.glow.emissiveIntensity=.3+this.rarity*.5;
    (this.aura.material as MeshStandardMaterial).emissive.setHex(c.color);this.aura.visible=this.rarity>=2;
    this.flight.configure(bird?'celestial':dragon?(c.id==='wyvern'?'magma':'necrotic'):null,Math.min(10,3+this.rarity));
    if(stag)for(const side of [-1,1]){this.between(this.ornaments,new Vector3(side*.13,.2,-.1),new Vector3(side*.43,.9,-.25),.025,this.glow);for(let i=0;i<4;i++)this.between(this.ornaments,new Vector3(side*(.21+i*.08),.4+i*.17,-.16),new Vector3(side*(.37+i*.09),.58+i*.17,.02),.015,this.glow);}
    if(bird){const beak=this.mesh(this.ornaments,new ConeGeometry(.1,.35,8),this.glow,0,-.06,.42);beak.rotation.x=Math.PI/2;for(let i=0;i<5;i++){const feather=this.mesh(this.morph,new CapsuleGeometry(.045,.7,4,8),this.glow,(i-2)*.1,-.05,-.6);feather.rotation.x=-.6;feather.rotation.z=(i-2)*.2;}}
    if(hell||dragon||giant||c.id==='nightmare'){
      for(let i=0;i<7;i++){const spike=this.mesh(this.morph,new ConeGeometry(.06,.22+i*.02,8),this.glow,0,.3,-.5+i*.15);spike.rotation.x=-.3;}
      for(const side of [-1,1]){const fang=this.mesh(this.ornaments,new ConeGeometry(.035,.2,8),this.glow,side*.11,-.16,.38);fang.rotation.x=Math.PI;const horn=this.mesh(this.ornaments,new CapsuleGeometry(.035,.26,4,8),this.glow,side*.18,.3,-.08);horn.rotation.z=-side*.5;}
    }
    // Coats have physical forms: tufts, ice shards, lava seams, bone ribs and cosmic rings.
    for(let i=0;i<this.rarity+1;i++)for(const side of [-1,1]){
      const scale=this.mesh(this.morph,new CapsuleGeometry(.018,.15+(dragon?.12:0),3,6),this.glow,side*.27,.04,-.38+i*.13);scale.rotation.z=side*(hell?.9:.4);
      if(c.id==='dracolich'){const rib=this.mesh(this.morph,new TorusGeometry(.29,.025,5,16,Math.PI),this.coat,0,0,-.36+i*.13);rib.rotation.y=Math.PI/2;}
    }
    if(this.rarity>=4){const halo=this.mesh(this.morph,new TorusGeometry(.37,.018,6,32),this.glow,0,.9,.35);halo.rotation.x=Math.PI/2;}
    // Legacy placeholder batching is only available in headless unit tests.
    // It is never shown in the Android/WebGL game even while GLB loads.
    this.ornaments.visible=typeof document==='undefined';
    this.morph.visible=typeof document==='undefined';
    this.armor.visible=typeof document==='undefined';
    this.wings.visible=typeof document==='undefined';
    if(typeof document==='undefined'&&!this.imported?.ready)this.batch=new RigidSkinBatch(this.root,this.coat);
  }
  update(dt:number,speed:number,time:number,attack=false):void {
    this.imported?.update(dt,Math.min(1,speed/7));this.particles.update(time);this.flight.update(dt,time,speed*.1);
    this.wings.children.forEach(wing=>{wing.rotation.z=Math.sin(time*3.5)*.2*(wing.userData.side as number);});
    const step=Math.min(.05,Math.max(0,dt));this.stride=MathUtils.damp(this.stride,Math.min(1,speed/(this.horse?10:6)),9,step);
    this.phase+=step*(this.horse?5+speed*.7:6+speed*.9);
    const gallop=speed>(this.horse?7:5),phase=this.phase;
    for(const leg of this.legs){
      const offset=gallop?(leg.rear?Math.PI:0)+leg.side*.36:(leg.side===1?Math.PI:0)+(leg.rear?Math.PI:0);
      const cycle=Math.sin(phase+offset),lift=Math.max(0,-Math.cos(phase+offset));
      leg.hip.rotation.x=cycle*this.stride*(gallop?.8:.45);
      leg.knee.rotation.x=(leg.rear?-1:1)*lift*this.stride*(gallop?1.1:.65);
      leg.ankle.rotation.x=-leg.hip.rotation.x*.25-leg.knee.rotation.x*.4;
    }
    this.spine.position.y=(this.horse?1.23:.68)+Math.abs(Math.sin(phase))*this.stride*(gallop?.09:.035);
    if(this.horse)this.saddle.position.y=1.6+(this.spine.position.y-1.23);
    this.spine.rotation.x=Math.sin(phase)*(gallop?.055:.018)*this.stride;
    this.neck.rotation.x=(this.horse?.3:.5)+Math.sin(phase+.3)*this.stride*.06;
    this.head.rotation.x=(this.horse?-.22:-.3)+Math.sin(time*1.1)*.025-(attack?.25:0);
    this.tail.rotation.z=Math.sin(time*3+this.stride)*(.12+this.stride*.13);
    this.tail.rotation.x=Math.sin(time*2)*.04+this.stride*.2;
    this.batch?.sync();
    this.aura.rotation.z=time*(.3+this.rarity*.1);this.aura.scale.setScalar((this.horse?1.3:.7)*(1+Math.sin(time*2)*.045));
  }
  dispose():void {this.batch?.dispose();this.imported?.dispose();this.flight.dispose();this.particles.dispose();const geometries=new Set<unknown>();this.root.traverse(o=>{if(o instanceof Mesh){if(!geometries.has(o.geometry)){o.geometry.dispose();geometries.add(o.geometry);}if(o===this.aura)(o.material as MeshStandardMaterial).dispose();}});this.materials.forEach(m=>m.dispose());this.root.removeFromParent();}
}
