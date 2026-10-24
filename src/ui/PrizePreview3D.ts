import {ACESFilmicToneMapping,CapsuleGeometry,Color,DirectionalLight,Group,HemisphereLight,LatheGeometry,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,SphereGeometry,SRGBColorSpace,TorusGeometry,Vector2,WebGLRenderer} from 'three';
import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import {WeaponForge} from '../player/WeaponForge';
import {ArticulatedCharacter} from '../player/ArticulatedCharacter';
import {CompanionRig} from '../companions/CompanionRig';
import {COSMETICS} from '../progression/AdventureProgress';
import {RARITIES,RARITY_COLORS} from '../rpg/InventoryAndLoot';
import {disableCharacterCulling,fitPreviewCamera} from '../player/PlayerRenderer';
import type {GachaPrize} from './GachaCutscene';
/** One renderer is reused when any of the ten reward cards is selected. */
export class PrizePreview3D {
  private readonly renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(35,1,.1,1000);
  private readonly root=new Group();
  private actor?:ArticulatedCharacter;
  private animal?:CompanionRig;
  private weapon?:WeaponForge;
  private host?:HTMLElement;
  private observer?:ResizeObserver;
  private frame=0;private last=0;private time=0;private revision=-1;private key='';
  constructor(){this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1));this.renderer.setClearColor(0,0);this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.domElement.setAttribute('aria-label','Prévia 3D do prêmio selecionado');this.scene.add(this.root,new HemisphereLight(0xc8e1ff,0x161d33,2.4));const key=new DirectionalLight(0xffe4be,3);key.position.set(-3,5,4);const rim=new DirectionalLight(0xa186fa,3.5);rim.position.set(3,3,-3);this.scene.add(key,rim);}
  mount(host:HTMLElement,prize:GachaPrize):void {
    this.host=host;const key=[prize.cosmeticId,prize.itemId,prize.itemSlot,prize.kind,prize.rarity].join(':');
    if(key!==this.key){this.releaseModel();this.key=key;const c=COSMETICS.find(c=>c.id===prize.cosmeticId),color=new Color(RARITY_COLORS[prize.rarity]).getHex();
      if(c?.type==='pet'||c?.type==='mount'){this.animal=new CompanionRig(c.type==='mount');this.animal.appearance(c);this.root.add(this.animal.root);}
      else if(c?.type==='skin'||c?.type==='wing'){
        const definition=c.type==='wing'?CLASS_DEFINITIONS.paladin:c.id==='forest'?CLASS_DEFINITIONS.ranger:c.id==='solar'?CLASS_DEFINITIONS.paladin:CLASS_DEFINITIONS.warlock;
        this.actor=new ArticulatedCharacter(definition);if(c.type==='skin')this.actor.skinAppearance(c.id,c.color,RARITIES.indexOf(c.rarity));else this.actor.wings.configure((['necrotic','celestial','glacial','magma','celestial','necrotic'] as const)[Number(c.id.split('-')[1])??0],1);this.actor.accent.color.setHex(c.color);this.root.add(this.actor.root);
      }else if(c?.type==='weapon'||prize.itemSlot==='weapon'||['weapon','sword','axe','staff','bow','scythe','daggers','lance','orb','fists'].includes(prize.kind)){
        const definition=prize.kind==='staff'?CLASS_DEFINITIONS.elementalist:prize.kind==='bow'?CLASS_DEFINITIONS.ranger:prize.kind==='axe'?CLASS_DEFINITIONS.berserker:CLASS_DEFINITIONS.paladin;
        this.weapon=new WeaponForge(definition);this.weapon.appearance(c?.color??color,0,prize.rarity);if(c)this.weapon.skin(c.id);this.root.add(this.weapon.right,this.weapon.left);
      }else this.buildEquipment(prize,color);
      disableCharacterCulling(this.root);this.root.rotation.y=-.25;this.revision=-1;
    }
    host.append(this.renderer.domElement);host.classList.add('has-3d');this.observer?.disconnect();if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);}this.resize();this.draw(0);if(!this.frame)this.frame=requestAnimationFrame(this.animate);
  }
  private buildEquipment(prize:GachaPrize,color:number):void {
    const material=new MeshStandardMaterial({color,roughness:.32,metalness:.65}),steel=new MeshStandardMaterial({color:0x9caebf,roughness:.4,metalness:.7}),dark=new MeshStandardMaterial({color:0x272b3d,roughness:.8});
    const add=(geometry:SphereGeometry|LatheGeometry|TorusGeometry|CapsuleGeometry,mat:MeshStandardMaterial,x=0,y=0,z=0)=>{const m=new Mesh(geometry,mat);m.position.set(x,y,z);this.root.add(m);return m;};
    const kind=prize.itemSlot??prize.kind;
    if(kind==='helmet'){add(new SphereGeometry(.45,28,20,0,Math.PI*2,0,Math.PI*.64),steel,0,.15).scale.z=.8;const rim=add(new TorusGeometry(.43,.025,8,36),material,0,.08);rim.rotation.x=Math.PI/2;add(new CapsuleGeometry(.025,.37,5,10),material,0,-.08,.36);}
    else if(kind==='armor'){add(new LatheGeometry([new Vector2(.26,-.5),new Vector2(.28,-.32),new Vector2(.42,.22),new Vector2(.38,.44),new Vector2(.19,.52)],32),steel).scale.z=.62;for(const s of [-1,1])add(new SphereGeometry(.22,20,14),material,s*.41,.27).scale.set(1.1,.65,1);add(new TorusGeometry(.12,.025,8,30),material,0,.19,.26);}
    else if(kind==='boots'||kind==='gloves'){for(const s of [-1,1]){const leg=add(new CapsuleGeometry(.14,.42,6,16),steel,s*.22,.1);leg.rotation.z=s*.07;add(new SphereGeometry(.18,18,12),dark,s*.23,-.2,.11).scale.set(.85,.7,1.5);add(new TorusGeometry(.15,.02,7,22),material,s*.22,.33).rotation.x=Math.PI/2;}}
    else if(kind==='ring'||kind==='amulet'||kind==='belt'){const ring=add(new TorusGeometry(kind==='amulet'?.45:.31,kind==='belt'?.075:.055,12,44),material);ring.rotation.x=kind==='amulet'?0:.3;add(new SphereGeometry(.13,14,10),steel,0,kind==='amulet'?-.48:.3,.03).scale.set(.8,1.15,.65);}
    else {add(new SphereGeometry(.3,20,16),material).scale.set(.8,1.3,.8);add(new TorusGeometry(.31,.025,8,32),steel).rotation.x=Math.PI/2;}
    // Dispose unused materials as well as those attached to geometry.
    this.root.userData.previewMaterials=[material,steel,dark];
  }
  private resize():void {if(!this.host)return;const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight);this.renderer.setSize(width,height,false);fitPreviewCamera(this.camera,this.root,width/height,1.24);}
  private draw(dt:number):void{this.time+=dt;this.actor?.update(dt,this.time,'idle',0,0,0);this.animal?.update(dt,0,this.time);this.weapon?.update(dt,this.time,0);const revision=Number(this.root.userData.characterRevision??0);if(this.revision!==revision){this.revision=revision;disableCharacterCulling(this.root);this.resize();}this.renderer.render(this.scene,this.camera);}
  private readonly animate=(now:number):void=>{this.frame=requestAnimationFrame(this.animate);if(this.last&&now-this.last<60)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;this.draw(dt);};
  pause():void{cancelAnimationFrame(this.frame);this.frame=0;this.last=0;this.observer?.disconnect();this.host=undefined;}
  private releaseModel():void{this.actor?.dispose();this.animal?.dispose();this.weapon?.dispose();this.actor=undefined;this.animal=undefined;this.weapon=undefined;const materials=new Set<MeshStandardMaterial>(this.root.userData.previewMaterials??[]);this.root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>materials.add(m as MeshStandardMaterial));else materials.add(o.material as MeshStandardMaterial);}});materials.forEach(m=>m.dispose());this.root.clear();delete this.root.userData.previewMaterials;}
  dispose():void{this.pause();this.releaseModel();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
