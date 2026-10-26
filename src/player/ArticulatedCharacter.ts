import {loadSharedModel} from '../assets/ModelResources';
import {actorIsVisible,registerActor} from '../core/ActorVisibility';
import {SKIN_IDENTITIES} from './SkinIdentity';
import {
  BufferGeometry, Box3, CapsuleGeometry, ConeGeometry, Color, DoubleSide,
  Group, LatheGeometry, MathUtils, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, Vector2,
  TorusGeometry, Vector3,
} from 'three';
import type { ClassDefinition, HeroState } from '../core/GameTypes';
import { AnimatedGLB, type ModelName } from '../assets/AnimatedGLB';
import { CLASS_EQUIPMENT_MODELS, loadWeaponModel } from '../assets/WeaponGLB';
import {CLASS_IDENTITIES} from './ClassVisualIdentity';
import {weaponPackForClass} from '../rpg/WeaponPacks';
import {WingsSystem} from '../companions/WingsSystem';
import {RarityAura} from '../companions/RarityAura';
import { WeaponForge } from './WeaponForge';

interface Limb {
  upper: Group;
  lower: Group;
  end: Group;
}
interface Pose {
  rootPitch: number;
  rootRoll: number;
  bodyY: number;
  bodyPitch: number;
  bodyYaw: number;
  headPitch: number;
  headYaw: number;
  leftArm: [number, number, number];
  rightArm: [number, number, number];
  leftElbow: number;
  rightElbow: number;
  leftThigh: [number, number, number];
  rightThigh: [number, number, number];
  leftKnee: number;
  rightKnee: number;
  leftAnkle: number;
  rightAnkle: number;
}
interface ClothPoint {
  position: Vector3;
  previous: Vector3;
  anchor: Vector3;
  fixed: boolean;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const pulse = (t: number, a: number, b: number): number => {
  if (t <= a || t >= b) return 0;
  return Math.sin((t - a) / (b - a) * Math.PI);
};

/** A lightweight local-space Verlet cape with pinned shoulders and structural constraints. */
class CapeCloth {
  readonly mesh: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly points: ClothPoint[] = [];
  private readonly columns = 7;
  private readonly rows = 11;
  private readonly width = .68;
  private readonly length = .94;
  private accumulator = 0;
  private readonly scratch = new Vector3();
  private readonly gravity = new Vector3(0, -4.2, 0);

  constructor(color: number) {
    const geometry = new PlaneGeometry(this.width, this.length, this.columns - 1, this.rows - 1);
    const material = new MeshStandardMaterial({ color, side: DoubleSide, roughness: .94 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.name = 'verlet-cape';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const attribute = geometry.attributes.position;
    for (let i = 0; i < attribute.count; i++) {
      const position = new Vector3(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
      this.points.push({ position, previous: position.clone(), anchor: position.clone(), fixed: i < this.columns });
    }
  }

  private satisfy(aIndex: number, bIndex: number, rest: number): void {
    const a = this.points[aIndex];
    const b = this.points[bIndex];
    this.scratch.subVectors(b.position, a.position);
    const length = this.scratch.length();
    if (length < .000001) return;
    this.scratch.multiplyScalar((length - rest) / length);
    const weight = a.fixed || b.fixed ? 1 : .5;
    if (!a.fixed) a.position.addScaledVector(this.scratch, weight);
    if (!b.fixed) b.position.addScaledVector(this.scratch, -weight);
  }

  update(dt: number, time: number, movement: number, turning: number, submerged: boolean): void {
    this.accumulator = Math.min(this.accumulator + dt, .05);
    const step = 1 / 60;
    let stepped = false;
    while (this.accumulator >= step) {
      this.accumulator -= step;
      stepped = true;
      for (let i = 0; i < this.points.length; i++) {
        const point = this.points[i];
        if (point.fixed) {
          point.position.copy(point.anchor);
          point.previous.copy(point.anchor);
          continue;
        }
        const row = Math.floor(i / this.columns) / (this.rows - 1);
        const oldX = point.position.x;
        const oldY = point.position.y;
        const oldZ = point.position.z;
        const damping = submerged ? .84 : .965;
        point.position.x += (point.position.x - point.previous.x) * damping;
        point.position.y += (point.position.y - point.previous.y) * damping;
        point.position.z += (point.position.z - point.previous.z) * damping;
        point.position.addScaledVector(this.gravity, step * step * (submerged ? .15 : 1));
        const gust = Math.sin(time * 2.1 + point.anchor.x * 8) * .6 + Math.sin(time * 4.7 + row * 5) * .3;
        point.position.z -= step * step * (movement * 19 + gust * 3 + (submerged ? 5 : .8));
        point.position.x += step * step * (turning * row * 12 + gust * .8);
        point.previous.set(oldX, oldY, oldZ);
        // Keep the cloth outside the back plate and prevent extreme numerical excursions.
        point.position.z = MathUtils.clamp(point.position.z, -.82, .035);
        point.position.x = MathUtils.clamp(point.position.x, -.7, .7);
      }
      for (let iteration = 0; iteration < 4; iteration++) {
        for (let row = 0; row < this.rows; row++) {
          for (let column = 0; column < this.columns; column++) {
            const index = row * this.columns + column;
            if (column + 1 < this.columns) this.satisfy(index, index + 1, this.width / (this.columns - 1));
            if (row + 1 < this.rows) this.satisfy(index, index + this.columns, this.length / (this.rows - 1));
            if (row + 1 < this.rows && column + 1 < this.columns) {
              this.satisfy(index, index + this.columns + 1, Math.hypot(this.width / (this.columns - 1), this.length / (this.rows - 1)));
            }
          }
        }
      }
    }
    if (!stepped) return;
    const attribute = this.mesh.geometry.attributes.position;
    this.points.forEach((point, index) => attribute.setXYZ(index, point.position.x, point.position.y, point.position.z));
    attribute.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

/** Named joints and continuous blended poses. Physical motion remains in HeroController. */
export class ArticulatedCharacter {
  readonly root = new Group();
  readonly pelvis = new Group();
  readonly torso = new Group();
  readonly neck = new Group();
  readonly head = new Group();
  readonly leftArm: Limb;
  readonly rightArm: Limb;
  readonly leftLeg: Limb;
  readonly rightLeg: Limb;
  readonly armor: MeshStandardMaterial;
  readonly accent: MeshStandardMaterial;
  readonly cape: CapeCloth;
  readonly wings=new WingsSystem();
  private imported?:AnimatedGLB;
  private readonly glbWeapons:Object3D[]=[];
  private readonly weaponPackMaterials=new Set<MeshStandardMaterial>();
  private glbWeaponGeneration=0;
  private importedArmor?:Mesh;
  private importedHelmet?:Mesh;
  private importedShoulders:Mesh[]=[];
  private readonly casterOrbs=new Group();
  private readonly skinGeometry=new Group();
  private readonly importedSkinParts:Object3D[]=[];
  private readonly importedSkinMaterials=new Set<MeshStandardMaterial>();
  private skinVisualVersion=0;
  private unregisterVisibility?:()=>void;
  private readonly skinAura=new RarityAura(.6);
  private skinKey='';
  private weaponPackId='ironweapon';
  private skinTone=0xffffff;
  private skinTier=0;
  weapons: WeaponForge;
  private readonly materials = new Set<MeshStandardMaterial>();
  private readonly skin: MeshStandardMaterial;
  private readonly shadowFace:MeshStandardMaterial;
  private readonly leather: MeshStandardMaterial;
  private readonly steel: MeshStandardMaterial;
  private readonly gold: MeshStandardMaterial;
  private readonly eye: MeshStandardMaterial;
  private definition: ClassDefinition;
  private gait = 0;
  private attackClock = 0;
  private attackDuration = .55;
  private attackSkill: number | undefined;
  private combo = 1;
  private lastHeading = 0;
  private hood!:Mesh;
  private casterRobe!:Mesh<LatheGeometry,MeshStandardMaterial>;
  private turning = 0;
  private readonly pose: Pose = this.neutral();

  constructor(definition: ClassDefinition) {
    this.definition = definition;
    this.root.name = 'articulated-character';
    this.unregisterVisibility=registerActor(this.root,1.9);
    this.armor = this.material(0x263944, .78, .31);
    this.accent = this.material(definition.color, .45, .42);
    this.accent.emissive.setHex(definition.color);
    this.accent.emissiveIntensity = .25;
    this.shadowFace=this.material(0x10182b,.08,.77);
    this.skin = this.material(0xbc9678, .02, .83);
    this.leather = this.material(0x24282a, .05, .92);
    this.steel = this.material(0x9eaeb5, .86, .24);
    this.gold = this.material(0xcba866, .82, .29);
    this.eye = this.material(0xe0faff, .05, .26);
    this.eye.emissive.setHex(definition.color);
    this.eye.emissiveIntensity = 2.4;
    if(typeof document!=='undefined'){
      // Runtime needs socket groups and one optional cloth, not an invisible second
      // character with hundreds of generated meshes underneath every authored GLB.
      const emptyLimb=():Limb=>({upper:new Group(),lower:new Group(),end:new Group()});
      this.leftArm=emptyLimb();this.rightArm=emptyLimb();this.leftLeg=emptyLimb();this.rightLeg=emptyLimb();
      this.cape=new CapeCloth(definition.color);this.torso.add(this.cape.mesh);
      this.weapons=new WeaponForge(definition);this.pelvis.add(this.torso);this.pelvis.visible=false;
      this.root.add(this.pelvis,this.wings.root,this.skinAura);
      this.replaceImportedModel(definition);return;
    }
    this.root.add(this.pelvis);
    this.pelvis.position.y = .86;
    this.pelvis.name = 'pelvis';
    this.torso.position.y = .35;
    this.torso.name = 'thorax';
    this.pelvis.add(this.torso);
    this.torso.add(this.wings.root,this.skinGeometry,this.skinAura);
    this.pelvis.add(this.casterOrbs);for(let i=0;i<3;i++){const orb=this.mesh(this.casterOrbs,new SphereGeometry(.055,14,10),this.eye,Math.cos(i*2.094)*.58,.65,Math.sin(i*2.094)*.58);orb.name='Orbiting class focus';}
    this.buildTorso();
    this.buildHead();
    this.leftArm = this.arm(-1);
    this.rightArm = this.arm(1);
    this.leftLeg = this.leg(-1);
    this.rightLeg = this.leg(1);
    this.cape = new CapeCloth(definition.color);
    this.cape.mesh.position.set(0, -.15, -.255);
    this.torso.add(this.cape.mesh);
    this.weapons = new WeaponForge(definition);
    const profile=[new Vector2(.36,-.73),new Vector2(.34,-.63),new Vector2(.3,-.45),new Vector2(.245,-.12),new Vector2(.22,.08),new Vector2(.26,.25),new Vector2(.29,.38),new Vector2(.23,.52),new Vector2(.13,.61)];
    const cloth=this.material(0x332d4a,.05,.94);
    const robeGeometry=new LatheGeometry(profile,36);
    const rp=robeGeometry.getAttribute('position');for(let i=0;i<rp.count;i++){const x=rp.getX(i),z=rp.getZ(i),y=rp.getY(i),angle=Math.atan2(z,x),fold=Math.sin(angle*12)*.015*(1-Math.max(0,y));rp.setXYZ(i,x+Math.cos(angle)*fold,y,z+Math.sin(angle)*fold);}robeGeometry.computeVertexNormals();
    this.casterRobe=new Mesh(robeGeometry,cloth);this.casterRobe.name='Tailored caster robe';this.casterRobe.castShadow=this.casterRobe.receiveShadow=true;this.pelvis.add(this.casterRobe);this.styleSilhouette(definition);
    this.rightArm.end.add(this.weapons.right);
    this.leftArm.end.add(this.weapons.left);
    // Browser rendering uses real, animated KayKit GLBs rather than the test-only legacy mesh rig.
    this.pelvis.visible = typeof document === 'undefined';
    this.replaceImportedModel(definition);
  }

  private material(color: number, metalness: number, roughness: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, metalness, roughness });
    this.materials.add(material);
    return material;
  }

  private mesh(parent: Group, geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.frustumCulled=false;mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private box(parent: Group, width: number, height: number, depth: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    const mesh=this.mesh(parent,new SphereGeometry(1,14,10),material,x,y,z);mesh.scale.set(width*.58,height*.58,depth*.58);return mesh;
  }

  private buildTorso(): void {
    const hips = this.mesh(this.pelvis, new CapsuleGeometry(.225, .13, 4, 10), this.leather);
    hips.scale.set(1.1, .65, .8);
    const chest = this.mesh(this.torso, new LatheGeometry([new Vector2(.2,-.28),new Vector2(.22,-.16),new Vector2(.3,.12),new Vector2(.31,.24),new Vector2(.21,.32),new Vector2(.1,.36)],32), this.armor);
    chest.name='Organic fitted cuirass';chest.scale.set(1.06, 1, .7);
    this.box(this.torso, .51, .065, .36, this.leather, 0, -.29);
    this.box(this.torso, .105, .08, .055, this.gold, 0, -.29, .207);
    for (const side of [-1, 1]) {
      const breastPlate = this.mesh(this.torso, new SphereGeometry(.175, 8, 6), this.steel, side * .135, .115, .105);
      breastPlate.scale.set(.92, 1.2, .61);
      const trim = this.box(this.torso, .018, .33, .025, this.gold, side * .205, .02, .19);
      trim.rotation.z = side * -.21;
      for (let i = 0; i < 3; i++) {
        const plate = this.box(this.pelvis, .18, .13, .055, this.armor, side * .145, -.05 - i * .09, .15);
        plate.rotation.x = -.1 - i * .08;
      }
      this.mesh(this.torso, new SphereGeometry(.024, 6, 4), this.gold, side * .16, .22, .2);
    }
    for (let i = 0; i < 3; i++) {
      this.box(this.torso, .33 - i * .035, .07, .035, this.armor, 0, -.06 - i * .072, .207);
    }
    const crest = this.mesh(this.torso, new TorusGeometry(.065, .014, 5, 12), this.gold, 0, .1, .232);
    crest.rotation.z = Math.PI / 4;
    this.mesh(this.torso, new SphereGeometry(.035, 6, 4), this.accent, 0, .1, .24);
    this.box(this.torso, .035, .14, .03, this.gold, 0, .1, .24);
    this.box(this.torso, .38, .032, .035, this.gold, 0, .27, .115);
    // Shoulder harness continues around the back instead of floating in front.
    for (const side of [-1, 1]) {
      const strap = this.box(this.torso, .055, .49, .035, this.leather, side * .14, .015, -.2);
      strap.rotation.z = side * -.11;
    }
  }

  private buildHead(): void {
    this.neck.position.y = .35;
    this.neck.name = 'neck';
    this.torso.add(this.neck);
    this.mesh(this.neck, new CapsuleGeometry(.075, .1, 3, 8), this.skin, 0, .03);
    this.head.position.y = .17;
    this.head.name = 'head';this.head.scale.setScalar(.82);
    this.neck.add(this.head);
    const face = this.mesh(this.head, new SphereGeometry(.185, 12, 10), this.skin);
    face.name='Human face';face.scale.set(.87, 1.08, .86);
    const helmet = this.mesh(this.head, new SphereGeometry(.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), this.armor, 0, .028);
    helmet.name='Metal helmet';helmet.scale.z = .95;
    this.hood=this.mesh(this.head,new SphereGeometry(.224,24,18,Math.PI*.75,Math.PI*1.5,0,Math.PI*.85),this.leather,0,.035,-.01);this.hood.name='Open cloth hood';
    this.box(this.head, .325, .032, .055, this.gold, 0, .025, .155);
    this.box(this.head, .022, .16, .03, this.gold, 0, -.04, .177);
    const nose = this.mesh(this.head, new ConeGeometry(.033, .085, 4), this.skin, 0, -.035, .163);
    nose.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      this.box(this.head, .08, .041, .029, this.leather, side * .071, -.005, .158);
      this.box(this.head, .043, .02, .009, this.eye, side * .071, -.005, .179);
      const cheek = this.box(this.head, .055, .135, .06, this.armor, side * .137, -.049, .111);
      cheek.rotation.z = -side * .15;
      this.mesh(this.head, new SphereGeometry(.037, 6, 4), this.gold, side * .165, .028, 0);
    }
    if(['warlock','necromancer','elementalist'].includes(this.definition.id)){
      helmet.material=this.leather;helmet.scale.set(1.14,1.3,1.1);
      for(const side of [-1,1])this.mesh(this.head,new CapsuleGeometry(.065,.21,5,10),this.leather,side*.16,-.07,.05).rotation.z=-side*.13;
    }
    const crest = this.mesh(this.head, new ConeGeometry(.075, .28, 8), this.accent, 0, .22, -.015);
    crest.scale.z = .5;
    this.box(this.head, .09, .014, .015, this.leather, 0, -.112, .14);
  }

  private arm(side: number): Limb {
    const upper = new Group();
    const lower = new Group();
    const end = new Group();
    upper.name = side < 0 ? 'left-shoulder' : 'right-shoulder';
    lower.name = side < 0 ? 'left-elbow' : 'right-elbow';
    end.name = side < 0 ? 'left-wrist' : 'right-wrist';
    upper.position.set(side * .30, .2, 0);
    lower.position.y = -.29;
    end.position.y = -.27;
    this.torso.add(upper);
    upper.add(lower);
    lower.add(end);
    const shoulder = this.mesh(upper, new SphereGeometry(.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * .7), this.armor, side * .025, -.02);
    shoulder.scale.set(1.1, .8, 1.1);
    const edge = this.mesh(upper, new TorusGeometry(.117, .012, 5, 12), this.gold, side * .025, .005);
    edge.rotation.x = Math.PI / 2;
    this.mesh(upper, new CapsuleGeometry(.067, .15, 4, 8), this.leather, 0, -.16);
    this.box(upper, .14, .18, .16, this.armor, 0, -.15, .015);
    this.mesh(lower, new SphereGeometry(.073, 8, 6), this.steel);
    this.mesh(lower, new CapsuleGeometry(.065, .13, 4, 8), this.leather, 0, -.13);
    this.box(lower, .14, .18, .16, this.steel, 0, -.13, .02);
    this.box(lower, .145, .025, .165, this.gold, 0, -.205, .02);
    this.box(end, .105, .115, .12, this.leather, 0, -.015, .025);
    for (let finger = 0; finger < 3; finger++) {
      this.box(end, .023, .055, .045, this.steel, -.033 + finger * .032, -.07, .04);
    }
    this.box(end, .035, .06, .05, this.leather, -side * .06, -.015, .065).rotation.z = side * -.45;
    return { upper, lower, end };
  }

  private leg(side: number): Limb {
    const upper = new Group();
    const lower = new Group();
    const end = new Group();
    upper.name = side < 0 ? 'left-hip' : 'right-hip';
    lower.name = side < 0 ? 'left-knee' : 'right-knee';
    end.name = side < 0 ? 'left-ankle' : 'right-ankle';
    upper.position.set(side * .15, -.04, 0);
    lower.position.y = -.34;
    end.position.y = -.32;
    this.pelvis.add(upper);
    upper.add(lower);
    lower.add(end);
    this.mesh(upper, new CapsuleGeometry(.084, .18, 4, 8), this.leather, 0, -.16);
    this.box(upper, .16, .24, .05, this.armor, 0, -.14, .075);
    this.mesh(lower, new SphereGeometry(.1, 8, 6), this.steel, 0, 0, .035).scale.z = .7;
    this.mesh(lower, new CapsuleGeometry(.065, .18, 4, 8), this.leather, 0, -.16);
    this.box(lower, .145, .23, .07, this.steel, 0, -.155, .065);
    for (const y of [-.07, -.24]) this.box(lower, .16, .028, .16, this.leather, 0, y, .015);
    this.box(end, .17, .13, .27, this.leather, 0, -.06, .065);
    this.box(end, .172, .05, .275, this.steel, 0, -.117, .065);
    this.box(end, .15, .045, .09, this.gold, 0, -.032, .163);
    return { upper, lower, end };
  }

  private importedName(definition:ClassDefinition):ModelName {
    // Cosmetic skins may recolor GLB materials/VFX but must not change the
    // underlying class mesh: an Assassin must never become Ranger_Hooded.
    return CLASS_IDENTITIES[definition.id].model;
  }

  private replaceImportedModel(definition:ClassDefinition):void {
    const name=this.importedName(definition);
    if(this.imported?.name===name){this.imported.setAttackWeapon(definition.weapon);this.imported.setClassPalette(CLASS_IDENTITIES[definition.id].tint);this.attachImportedGear();return;}
    this.clearGlbWeapons();
    this.clearImportedSkin();
    this.imported?.dispose();
    const actor = new AnimatedGLB(name, 1.9, () => {
      if (this.imported !== actor) return;
      this.pelvis.visible = false;
      actor.setClassPalette(CLASS_IDENTITIES[this.definition.id].tint);
      actor.setCosmeticPalette(this.skinTone,this.skinTier);
      actor.clearWeaponSlots();
      this.attachImportedGear();
      this.styleSilhouette(this.definition);
    }, true);
    this.imported=actor;
    actor.setAttackWeapon(definition.weapon);
    this.root.add(actor.root);
  }

  private clearGlbWeapons():void {
    this.glbWeaponGeneration++;
    for(const model of this.glbWeapons)model.removeFromParent();
    this.glbWeapons.length=0;
    for(const material of this.weaponPackMaterials)material.dispose();
    this.weaponPackMaterials.clear();
  }

  private attachImportedGear():void {
    const actor=this.imported;
    if(!actor?.ready)return;
    if(typeof document==='undefined')return;
    // Browser gameplay never renders generated helmet, cuirass or weapon primitives.
    this.pelvis.visible=false;
    this.weapons.right.visible=false;
    this.weapons.left.visible=false;
    // Move the wings with the actual animated chest bone: never attach to
    // feet/world space or to a mount's belly.
    this.root.add(this.wings.root,this.skinAura);
    // The KayKit spine bone is already fitted to world height. Half-size
    // wings were the cause of tiny paper-like collection cosmetics.
    this.wings.root.scale.setScalar(1.16);
    this.wings.root.rotation.set(0,0,0);
    const attached=actor.attachAt('spine2',this.wings.root,new Vector3(0,0,-.19));
    if(!attached){
      this.torso.add(this.wings.root);
      this.wings.root.position.set(0,.14,-.19);
      this.wings.root.scale.setScalar(1.16);
    }
    this.skinAura.position.y=.04;
    this.updateImportedSkin(actor);
    actor.clearWeaponSlots();
    actor.setClassPalette(CLASS_IDENTITIES[this.definition.id].tint);
    actor.setCosmeticPalette(this.skinTone,this.skinTier);
    this.clearGlbWeapons();
    const version=this.glbWeaponGeneration;
    const equipped=weaponPackForClass(this.weaponPackId,this.definition.id);
    const gladiatorGear=this.weaponPackId==='gladiator-blade'
      ? [{model:'gladiator-blade' as const,bone:'righthand' as const},
         ...CLASS_EQUIPMENT_MODELS[this.definition.id].filter(g=>g.bone!=='righthand')]
      :null;
    for(const gear of gladiatorGear??equipped?.weapons??CLASS_EQUIPMENT_MODELS[this.definition.id]){
      void loadWeaponModel(gear.model).then(model=>{
        if(this.imported!==actor||version!==this.glbWeaponGeneration||!actor.ready)return;
        const offset=gear.offset??[0,0,0];
        // KayKit hand sockets point down at rest; reverse the staff's long
        // axis so its focus is above the grip instead of buried in the ground.
        if(gear.model==='staff'||gear.model==='wand')model.rotation.z+=Math.PI;
        if(equipped){
          model.scale.multiplyScalar(1+equipped.tier*.035);
          model.traverse(object=>{
            if(!(object instanceof Mesh))return;
            const originals=Array.isArray(object.material)?object.material:[object.material];
            const tinted=originals.map(m=>{
              if(!(m instanceof MeshStandardMaterial))return m;
              const mat=m.clone();
              this.weaponPackMaterials.add(mat);
              mat.color.lerp(new Color(equipped.color),Math.min(.22,equipped.tier*.052));
              mat.metalness=Math.min(.75,Math.max(.1,mat.metalness+equipped.tier*.08));
              mat.roughness=Math.max(.26,mat.roughness-equipped.tier*.065);
              mat.emissive.setHex(equipped.color);
              mat.emissiveIntensity=equipped.tier*.13;
              return mat;
            });
            object.material=Array.isArray(object.material)?tinted:tinted[0];
          });
        }
        if(actor.attachAt(gear.bone,model,new Vector3(...offset)))this.glbWeapons.push(model);
        else console.warn('KayKit skeleton missing attachment socket:',gear.bone,actor.name);
      }).catch(error=>console.warn('Cannot load KayKit weapon:',gear.model,error));
    }
  }

  private clearImportedSkin():void {
    this.skinVisualVersion++;
    for(const object of this.importedSkinParts)object.removeFromParent();
    this.importedSkinParts.length=0;
    for(const mat of this.importedSkinMaterials)mat.dispose();
    this.importedSkinMaterials.clear();
    // Restore the cape to its original simulation anchor when the GLB changes.
    if(this.cape?.mesh&&this.cape.mesh.parent!==this.torso)this.torso.add(this.cape.mesh);
  }
  private updateImportedSkin(actor:AnimatedGLB):void {
    this.clearImportedSkin();
    if(typeof document==='undefined'||!actor.ready)return;
    if(this.skinKey==='traveler')return;
    const revision=this.skinVisualVersion;
    const rarity=this.skinTier;
    const identity=SKIN_IDENTITIES[this.definition.id];
    const tint=new Color(this.skinTone);
    // The existing Verlet cloth now follows the authored GLB spine rather than
    // a hidden procedural torso. Its physics and shadows remain active.
    this.cape.mesh.material.color.copy(tint).lerp(new Color('#ddd5ba'),.19);
    this.cape.mesh.scale.set(1+rarity*.09,1+rarity*.11,1);
    if(!actor.attachAt('spine2',this.cape.mesh,new Vector3(0,-.51,-.27))){
      actor.root.add(this.cape.mesh);this.cape.mesh.position.set(0,.84,-.34);
    }
    const attach=(source:Object3D,bone:'head'|'spine2',offset:Vector3,target:number,tilt:number)=>{
      if(this.imported!==actor||this.skinVisualVersion!==revision)return;
      const bounds=new Box3().setFromObject(source);if(bounds.isEmpty())return;
      const center=bounds.getCenter(new Vector3()),extent=bounds.getSize(new Vector3());
      const parent=new Group();source.position.sub(center);
      parent.add(source);
      parent.scale.setScalar(target/Math.max(.001,Math.max(extent.x,extent.y,extent.z)));
      parent.rotation.z=tilt;parent.name='Equipped cosmetic '+this.skinKey+' '+bone;
      source.traverse(child=>{
        if(!(child instanceof Mesh))return;
        child.castShadow=true;
        const mats=Array.isArray(child.material)?child.material:[child.material];
        const clones=mats.map(m=>{
          if(!(m instanceof MeshStandardMaterial))return m;
          const mat=m.clone();mat.color.lerp(tint,Math.min(.32,.10+rarity*.035));
          mat.metalness=identity.metallic?.55:.06;mat.roughness=identity.metallic?.46:.88;
          mat.emissive.copy(tint);mat.emissiveIntensity=.08+rarity*.045;
          this.importedSkinMaterials.add(mat);return mat;
        });
        child.material=Array.isArray(child.material)?clones:clones[0];
      });
      if(!actor.attachAt(bone,parent,offset)){
        actor.root.add(parent);parent.position.copy(offset).add(new Vector3(0,bone==='head'?1.64:1.25,0));
      }
      this.importedSkinParts.push(parent);
    };
    const url='models/equipment/CC0_knight_helmet.glb';
    if(identity.helmet)void loadSharedModel(url).then(gltf=>{
      attach(gltf.scene.clone(true),'head',new Vector3(0,.13,.015),.46+rarity*.028,0);
    }).catch(error=>console.warn('No authored helmet:',error));
    if(identity.pauldrons)for(const side of [-1,1]){
      void loadWeaponModel('dungeon_shield_round').then(piece=>{
        attach(piece,'spine2',new Vector3(side*.44,.14,-.02),.39+rarity*.018,side*.55);
      }).catch(error=>console.warn('No authored pauldron:',error));
    }
  }
  private styleSilhouette(definition:ClassDefinition):void {
    if(typeof document!=='undefined'){
      this.imported?.setClassPalette(CLASS_IDENTITIES[definition.id].tint);
      this.imported?.tint(0xffffff,definition.color);return;
    }
    const caster=['warlock','necromancer','elementalist'].includes(definition.id);this.casterOrbs.visible=caster;this.casterRobe.visible=caster;this.hood.visible=caster;const face=this.head.getObjectByName('Human face') as Mesh|undefined;if(face)face.material=caster?this.shadowFace:this.skin;this.eye.emissiveIntensity=caster?4:1.5;const helmet=this.importedHelmet??this.head.getObjectByName('Metal helmet');if(helmet)helmet.visible=!caster;
    this.casterRobe.material.color.setHex(definition.id==='necromancer'?0x253d36:definition.id==='elementalist'?0x254359:0x3b294b);
    if(typeof document!=='undefined'){
      this.casterRobe.visible=false;
      this.hood.visible=false;
      this.skinGeometry.visible=false;
    }
    this.imported?.setClassPalette(CLASS_IDENTITIES[definition.id].tint);
    this.imported?.tint(caster?0x353242:0x3c4c5a,definition.color);this.armor.color.setHex(caster?0x353242:0x3c4c5a);this.armor.metalness=caster?.22:.75;
    for(const child of this.head.children)if(child instanceof Mesh&&child.material===this.gold)child.visible=!caster;
  }
  weaponPackAppearance(id:string):void{
    if(id===this.weaponPackId)return;
    this.weaponPackId=id;
    if(this.imported?.ready)this.attachImportedGear();
  }
  skinAppearance(id:string,color:number,rarity:number):void {
    if(id===this.skinKey)return;
    this.skinKey=id;
    this.skinTone=color;
    this.skinTier=Math.max(0,Math.min(5,rarity));
    this.imported?.setCosmeticPalette?.(color,this.skinTier);
    this.skinGeometry.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshStandardMaterial).dispose();}});this.skinGeometry.clear();
    this.skinAura.configure(rarity,color);
    this.replaceImportedModel(this.definition);
    if(this.imported?.ready)this.updateImportedSkin(this.imported);
    // Runtime cosmetic VFX stay shader/particle-based; no sculpted mesh horns or spheres.
    if(typeof document!=='undefined'||id==='traveler')return;
    const mat=new MeshStandardMaterial({color,metalness:.55,roughness:.4,emissive:color,emissiveIntensity:.18});
    for(const side of [-1,1])for(let i=0;i<Math.max(2,rarity+1);i++){
      const horn=new Mesh(new CapsuleGeometry(.035,.13+i*.025,4,10),mat);horn.frustumCulled=false;horn.position.set(side*(.29+i*.035),.1+i*.04,-.03);horn.rotation.z=-side*(.6+i*.18);this.skinGeometry.add(horn);
    }
    const collar=new Mesh(new TorusGeometry(.19+rarity*.012,.04,8,28,Math.PI*1.7),mat);collar.frustumCulled=false;collar.rotation.x=Math.PI/2;collar.position.y=.3;this.skinGeometry.add(collar);
    if(rarity>=3)for(let i=0;i<rarity;i++){const crystal=new Mesh(new SphereGeometry(.045,8,6),mat);crystal.frustumCulled=false;crystal.scale.y=2;crystal.position.set(Math.cos(i*6.28/rarity)*.42,.12,Math.sin(i*6.28/rarity)*.4);this.skinGeometry.add(crystal);}
    this.cape.mesh.scale.set(1+rarity*.08,1+rarity*.04,1);
  }
  weaponAppearance(color:number,refine:number,rarity:string):void {this.weapons.appearance(color,refine,rarity);}

  setClass(definition: ClassDefinition): void {
    this.definition = definition;
    this.accent.color.setHex(definition.color);
    this.accent.emissive.setHex(definition.color);
    this.eye.emissive.setHex(definition.color);
    this.cape.mesh.material.color.setHex(definition.color);
    this.weapons.dispose();
    this.weapons = new WeaponForge(definition);
    this.rightArm.end.add(this.weapons.right);
    this.leftArm.end.add(this.weapons.left);
    this.replaceImportedModel(definition);
    this.styleSilhouette(definition);
    this.attachImportedGear();this.attackClock = 0;
  }

  attack(skillIndex?: number, combo = 1): void {
    this.imported?.attack();this.attackSkill = skillIndex;
    this.combo = combo;
    this.attackDuration = skillIndex === undefined ? Math.min(.68, .82 / this.definition.stats.attackSpeed) : .72 + Math.min(3, skillIndex) * .09;
    this.attackClock = this.attackDuration;
  }

  private neutral(): Pose {
    return {
      rootPitch: 0, rootRoll: 0, bodyY: .86, bodyPitch: 0, bodyYaw: 0,
      headPitch: 0, headYaw: 0,
      leftArm: [0, 0, -.09], rightArm: [0, 0, .09],
      leftElbow: -.12, rightElbow: -.12,
      leftThigh: [0, 0, 0], rightThigh: [0, 0, 0],
      leftKnee: 0, rightKnee: 0, leftAnkle: 0, rightAnkle: 0,
    };
  }

  private locomotion(state: HeroState, time: number, movement: number): Pose {
    const pose = this.neutral();
    const phase = this.gait;
    const breath = Math.sin(time * 2.2);
    pose.bodyY += breath * .007;
    pose.bodyPitch = breath * .012;
    pose.headYaw = Math.sin(time * .61) * .045;
    const stride = Math.sin(phase) * movement;
    if (state === 'run') {
      pose.bodyPitch = .14 + movement * .12;
      pose.bodyY += Math.abs(Math.sin(phase)) * .055;
      pose.bodyYaw = Math.sin(phase) * .075 * movement;
      pose.leftThigh[0] = stride * .78;
      pose.rightThigh[0] = -stride * .78;
      pose.leftKnee = Math.max(0, -Math.sin(phase + .5)) * 1.15 * movement;
      pose.rightKnee = Math.max(0, Math.sin(phase + .5)) * 1.15 * movement;
      pose.leftAnkle = -Math.max(0, Math.cos(phase)) * .35;
      pose.rightAnkle = -Math.max(0, -Math.cos(phase)) * .35;
      pose.leftArm[0] = -stride * .58;
      pose.rightArm[0] = stride * .58;
      pose.leftElbow = -.45 - Math.max(0, stride) * .35;
      pose.rightElbow = -.45 - Math.max(0, -stride) * .35;
      pose.rootRoll = -this.turning * .025;
    }
    if (state === 'jump' || state === 'doubleJump' || state === 'fall') {
      pose.leftThigh[0] = -.6;
      pose.rightThigh[0] = -.15;
      pose.leftKnee = .9;
      pose.rightKnee = .55;
      pose.leftArm = [-.45, 0, -.5];
      pose.rightArm = [-.3, 0, .5];
      pose.leftElbow = -.6;
      pose.rightElbow = -.6;
      pose.bodyPitch = state === 'fall' ? -.08 : .12;
      if (state === 'doubleJump') {
        pose.rootPitch = -.2;
        pose.leftThigh[0] = -.95;
        pose.rightKnee = 1.2;
      }
    }
    if (state === 'climb') {
      const cycle = time * 5.2;
      pose.bodyY -= .05;
      pose.bodyPitch = .1;
      pose.leftArm = [-2.6 + Math.sin(cycle) * .42, -.1, -.08];
      pose.rightArm = [-2.6 - Math.sin(cycle) * .42, .1, .08];
      pose.leftElbow = -.15 - Math.max(0, -Math.sin(cycle)) * .9;
      pose.rightElbow = -.15 - Math.max(0, Math.sin(cycle)) * .9;
      pose.leftThigh[0] = -.45 - Math.max(0, Math.sin(cycle)) * .65;
      pose.rightThigh[0] = -.45 - Math.max(0, -Math.sin(cycle)) * .65;
      pose.leftKnee = .65 + Math.max(0, Math.sin(cycle)) * .6;
      pose.rightKnee = .65 + Math.max(0, -Math.sin(cycle)) * .6;
      pose.headPitch = -.2;
    }
    if (state === 'swim' || state === 'dive') {
      const cycle = time * 4.4;
      pose.rootPitch = Math.PI * .45;
      pose.bodyY = .48 + Math.sin(cycle * 2) * .025;
      pose.bodyPitch = -.06;
      pose.headPitch = -.5;
      pose.leftArm = [-Math.PI + Math.sin(cycle) * 1.3, -.15, -.25 - Math.cos(cycle) * .4];
      pose.rightArm = [-Math.PI - Math.sin(cycle) * 1.3, .15, .25 - Math.cos(cycle) * .4];
      pose.leftElbow = -.25 - Math.max(0, Math.cos(cycle)) * .8;
      pose.rightElbow = -.25 - Math.max(0, -Math.cos(cycle)) * .8;
      pose.leftThigh[0] = Math.sin(cycle * 1.7) * .22;
      pose.rightThigh[0] = -Math.sin(cycle * 1.7) * .22;
      pose.leftKnee = .12 + Math.max(0, Math.sin(cycle * 1.7)) * .3;
      pose.rightKnee = .12 + Math.max(0, -Math.sin(cycle * 1.7)) * .3;
      pose.leftAnkle = pose.rightAnkle = .25;
      if (state === 'dive') pose.rootPitch += .12;
    }
    if (state === 'slide') {
      pose.bodyY = .51;
      pose.bodyPitch = -.45;
      pose.leftThigh[0] = -1.3;
      pose.rightThigh[0] = -.65;
      pose.rightKnee = 1.5;
      pose.leftArm = [-.5, -.4, -.4];
      pose.rightArm = [.15, .3, .3];
    }
    if (state === 'mounted') {
      // The rider is now parented to the saddle socket; no floating hip offset.
      pose.bodyY = .75 + Math.sin(time * 8) * .012;
      pose.leftThigh = [-.8, -.1, -.32];
      pose.rightThigh = [-.8, .1, .32];
      pose.leftKnee = pose.rightKnee = .9;
      pose.leftArm[0] = pose.rightArm[0] = -.75;
      pose.leftElbow = pose.rightElbow = -.65;
      pose.bodyPitch = .08;
    }
    if (state === 'dead') {
      pose.rootRoll = -1.45;
      pose.bodyY = .3;
      pose.leftArm[2] = -.6;
      pose.rightArm[2] = .4;
      pose.leftKnee = .4;
      pose.rightThigh[0] = -.3;
      pose.headPitch = .3;
    }
    return pose;
  }

  private attackPose(pose: Pose, t: number, time: number): void {
    const anticipation = pulse(t, 0, .38);
    const strike = smooth(MathUtils.clamp((t - .28) / .34, 0, 1));
    const recovery = 1 - smooth(MathUtils.clamp((t - .68) / .32, 0, 1));
    const impact = pulse(t, .25, .78);
    const weight = Math.min(1, t * 12) * recovery;
    const weapon = this.definition.weapon;
    if (weapon === 'axe' || weapon === 'sword') {
      const wide = this.combo === 3;
      pose.bodyYaw += (-.65 * anticipation + (wide ? 1.5 : .8) * strike) * recovery;
      pose.bodyPitch += (.1 * anticipation - impact * .2) * weight;
      pose.rightArm = [(-2.1 * anticipation + strike * 1.7) * weight, -.5 * impact, (.4 - 1.3 * strike) * weight];
      pose.rightElbow = (-.75 * anticipation - .12) * weight;
      pose.leftArm = [-.4 * weight, -.2 * weight, -.3 * weight];
      if (weapon === 'axe') {
        pose.leftArm[0] = pose.rightArm[0] - .15;
        pose.leftElbow = -.85 * anticipation;
      }
      if (wide) pose.rootRoll += Math.sin(t * Math.PI) * -.12;
    } else if (weapon === 'daggers') {
      const alternate = this.combo % 2 === 0;
      pose.bodyYaw += Math.sin(t * Math.PI * 2) * .65 * recovery;
      pose.rightArm = [-1.3 * impact, -.8 * strike, -.6 * impact];
      pose.leftArm = [-1.3 * pulse(t, .15, .95), .8 * strike, .6 * impact];
      pose.rightElbow = -.3 - .6 * anticipation;
      pose.leftElbow = -.3 - .6 * strike;
      if (alternate) [pose.leftArm, pose.rightArm] = [pose.rightArm, pose.leftArm];
      pose.bodyY -= impact * .1;
    } else if (weapon === 'bow') {
      const draw = Math.sin(Math.min(t / .65, 1) * Math.PI / 2) * recovery;
      pose.bodyYaw = -.5 * draw;
      pose.leftArm = [-1.45 * draw, -.25 * draw, -.12];
      pose.leftElbow = -.1 * draw;
      pose.rightArm = [-1.3 * draw, .8 * draw, .18];
      pose.rightElbow = -1.4 * draw;
      pose.headYaw = -.25 * draw;
      pose.bodyPitch -= pulse(t, .62, .86) * .13;
    } else if (weapon === 'fists') {
      const first = pulse(t, .02, .58);
      const second = pulse(t, .35, .97);
      pose.rightArm = [-1.7 * first, -.18 * first, .12];
      pose.leftArm = [-1.7 * second, .18 * second, -.12];
      pose.rightElbow = -.15 - .7 * (1 - first);
      pose.leftElbow = -.15 - .7 * (1 - second);
      pose.bodyYaw += first * -.45 + second * .45;
      pose.leftThigh[0] -= second * .22;
      pose.bodyPitch += impact * .14;
    } else if (weapon === 'lance') {
      pose.bodyYaw += anticipation * -.4 + impact * .3;
      pose.rightArm = [-1.4 * weight - .2 * impact, -.2, .2];
      pose.leftArm = [-1.1 * weight, -.2, -.35];
      pose.rightElbow = -anticipation * 1.2;
      pose.leftElbow = -.55 * weight;
      pose.bodyPitch += impact * .22;
      pose.leftThigh[0] -= impact * .35;
    } else if (weapon === 'scythe') {
      pose.bodyYaw += (anticipation * -.85 + strike * 1.5) * recovery;
      pose.rightArm = [-1.55 * weight, -.5 * impact, -.8 * impact];
      pose.leftArm = [-1.1 * weight, .2, -.2];
      pose.rightElbow = -.45 * weight;
      pose.headPitch -= impact * .15;
    } else {
      const cast = pulse(t, 0, 1);
      pose.leftArm = [-1.5 * cast, -.3 * cast, -.4 * cast];
      pose.rightArm = [-1.8 * cast, .2 * cast, .4 * cast];
      pose.leftElbow = -.55 * cast;
      pose.rightElbow = -.4 * cast;
      pose.headPitch -= cast * .3;
      pose.bodyPitch -= cast * .1;
      pose.bodyY += cast * (.08 + (this.attackSkill ?? 0) * .025);
      pose.leftThigh[0] -= cast * .12;
      pose.rightKnee += cast * .2;
      pose.rootRoll += Math.sin(time * 5) * cast * .025;
    }
    if (this.attackSkill === 3) {
      pose.bodyY += impact * .08;
      pose.headPitch -= impact * .12;
    }
  }

  private blendLimb(limb: Limb, target: [number, number, number], bend: number, end: number, blend: number): void {
    limb.upper.rotation.x = MathUtils.lerp(limb.upper.rotation.x, target[0], blend);
    limb.upper.rotation.y = MathUtils.lerp(limb.upper.rotation.y, target[1], blend);
    limb.upper.rotation.z = MathUtils.lerp(limb.upper.rotation.z, target[2], blend);
    limb.lower.rotation.x = MathUtils.lerp(limb.lower.rotation.x, bend, blend);
    limb.end.rotation.x = MathUtils.lerp(limb.end.rotation.x, end, blend);
  }

  update(dt: number, time: number, state: HeroState, movement: number, heading: number, hurt: number): void {
    if(!actorIsVisible(this.root))return;
    dt = MathUtils.clamp(dt, 0, .05);
    this.imported?.update(dt,state==='mounted'?0:movement,state==='mounted',state);
    this.imported?.setHitFlash(hurt>0?Math.min(1,hurt*4):0);
    // Browser actors use authored clip animation. Do not simulate ~100 hidden
    // legacy joints/cloth constraints when no visible cloth is attached.
    if(typeof document!=='undefined'){
      if(this.cape.mesh.parent!==this.torso)this.cape.update(dt,time,movement,this.turning,state==='swim'||state==='dive');
      this.attackClock=Math.max(0,this.attackClock-dt);
      this.wings.update(dt,time,movement);this.skinAura.update(time);return;
    }
    const angularDelta = Math.atan2(Math.sin(heading - this.lastHeading), Math.cos(heading - this.lastHeading));
    this.lastHeading = heading;
    this.turning = MathUtils.damp(this.turning, angularDelta / Math.max(dt, .001), 5, dt);
    this.gait += dt * (state === 'run' ? 6 + movement * 5 : 2.5);
    const pose = this.locomotion(state, time, movement);
    this.attackClock = Math.max(0, this.attackClock - dt);
    const progress = this.attackClock > 0 ? 1 - this.attackClock / this.attackDuration : 0;
    if (this.attackClock > 0 && state !== 'dead') this.attackPose(pose, progress, time);
    const blend = 1 - Math.exp(-dt * 18);
    this.root.rotation.x = MathUtils.lerp(this.root.rotation.x, pose.rootPitch, blend);
    this.root.rotation.z = MathUtils.lerp(this.root.rotation.z, pose.rootRoll, blend);
    this.pelvis.position.y = MathUtils.lerp(this.pelvis.position.y, pose.bodyY, blend);
    this.torso.rotation.x = MathUtils.lerp(this.torso.rotation.x, pose.bodyPitch, blend);
    this.torso.rotation.y = MathUtils.lerp(this.torso.rotation.y, pose.bodyYaw, blend);
    this.head.rotation.x = MathUtils.lerp(this.head.rotation.x, pose.headPitch, blend);
    this.head.rotation.y = MathUtils.lerp(this.head.rotation.y, pose.headYaw, blend);
    this.blendLimb(this.leftArm, pose.leftArm, pose.leftElbow, 0, blend);
    this.blendLimb(this.rightArm, pose.rightArm, pose.rightElbow, 0, blend);
    this.blendLimb(this.leftLeg, pose.leftThigh, pose.leftKnee, pose.leftAnkle, blend);
    this.blendLimb(this.rightLeg, pose.rightThigh, pose.rightKnee, pose.rightAnkle, blend);
    this.armor.emissive.setHex(hurt > 0 ? 0x9d2626 : 0x000000);
    this.armor.emissiveIntensity = hurt > 0 ? .5 + Math.sin(time * 60) * .2 : 0;
    this.torso.scale.set(1+Math.sin(time*2.2)*.008,1+Math.sin(time*2.2)*.012,1+Math.sin(time*2.2)*.018);this.casterOrbs.rotation.y=time*.7;
    this.cape.update(dt, time, movement, this.turning, state === 'swim' || state === 'dive');
    if(typeof document==='undefined')this.weapons.update(dt, time, progress);
    this.wings.update(dt,time,movement);this.skinAura.update(time);this.skinGeometry.rotation.y=Math.sin(time*.6)*.025;
  }

  dispose(): void {
    this.unregisterVisibility?.();
    this.clearImportedSkin();
    this.clearGlbWeapons();
    this.imported?.dispose();this.wings.dispose();this.skinAura.dispose();
    this.weapons.dispose();
    const geometries = new Set<BufferGeometry>();
    this.root.traverse(object => {
      if (object instanceof Mesh) {
        if(!object.geometry.userData.sharedActorGeometry)geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          this.materials.add(material as MeshStandardMaterial);
        }
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.root.removeFromParent();
    this.root.clear();
    this.materials.clear();
  }
}
