import {
  BufferGeometry, CapsuleGeometry, ConeGeometry, Group, MathUtils, CatmullRomCurve3, TubeGeometry, Vector3, LatheGeometry, Vector2,
  Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry,
} from 'three';

import {RigidSkinBatch} from '../assets/RigidSkinBatch';
import {AnimatedGLB} from '../assets/AnimatedGLB';

interface CreatureLimb { shoulder: Group; elbow: Group; foot: Group; side: number; rear: boolean }

/** Different silhouettes share joint control, not a single scaled box. */
export class CreatureRig {
  readonly root = new Group();
  readonly spine = new Group();
  readonly skull = new Group();
  private readonly limbs: CreatureLimb[] = [];
  private readonly tail = new Group();
  private readonly jaw = new Group();
  private readonly ornaments: Object3D[] = [];
  private readonly materials = new Set<MeshStandardMaterial>();
  private readonly eye: MeshStandardMaterial;
  private readonly dark: MeshStandardMaterial;
  private readonly bone: MeshStandardMaterial;
  private readonly scale: number;
  private readonly batch?:RigidSkinBatch;
  private readonly imported?:AnimatedGLB;
  private previousAttack=false;
  private attackBlend = 0;
  private readonly tendrils:Group[]=[];

  constructor(readonly kind: string, readonly boss: boolean, private readonly body: MeshStandardMaterial) {
    this.eye = new MeshStandardMaterial({ color: boss ? 0xffdd80 : 0xbfffe5, emissive: boss ? 0xff682c : 0x63dfce, emissiveIntensity: 3.2, roughness: .25 });
    this.dark = new MeshStandardMaterial({ color: 0x252531, roughness: .85, metalness: .15 });
    this.bone = new MeshStandardMaterial({ color: kind === 'skeleton' ? 0xd6cbb5 : 0x82908d, roughness: .72, metalness: boss ? .4 : .1 });
    this.materials.add(this.eye).add(this.dark).add(this.bone);
    this.scale = boss ? 2.3 : kind === 'golem' ? 1.45 : 1;
    this.root.name = `${kind}-articulated-rig`;
    this.root.add(this.spine);
    if (typeof document !== 'undefined' && (kind === 'skeleton' || kind === 'wraith' || boss)) {
      // All migrated species are imported skinned GLBs: no procedural visual stand-ins.
      const model = boss ? 'Quaternius_demon' : kind === 'wraith' ? 'Quaternius_ghost' : 'KayKit_Skeleton_Minion';
      this.imported = new AnimatedGLB(model, boss ? 4.0 : 1.95, () => {}, true);
      this.root.add(this.imported.root);
    } else {
      // Keep the existing diagnostic rig in unit tests and for unported species.
      if (kind === 'slime' && !boss) this.slime();
      else if (kind === 'wolf' && !boss) this.wolf();
      else this.humanoid();
      this.batch = new RigidSkinBatch(this.root,this.body);
    }
  }

  private mesh(parent: Object3D, geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private box(parent: Object3D, w: number, h: number, d: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    const mesh=this.mesh(parent,new SphereGeometry(1,12,10),material,x,y,z);mesh.scale.set(w*.6,h*.6,d*.6);return mesh;
  }

  private eyes(parent: Object3D, width: number, y: number, z: number, size: number): void {
    for (const side of [-1, 1]) {
      this.mesh(parent, new SphereGeometry(size * 1.6, 7, 5), this.dark, side * width, y, z - size * .4);
      this.mesh(parent, new SphereGeometry(size, 7, 5), this.eye, side * width, y, z);
    }
  }

  private slime(): void {
    const shell = this.mesh(this.spine, new SphereGeometry(.72, 18, 12), this.body, 0, .08);
    shell.scale.set(1, .72, 1);
    this.eyes(this.spine, .23, .23, .58, .06);
    this.box(this.spine, .16, .025, .035, this.dark, 0, .06, .65);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const nodule = this.mesh(this.spine, new SphereGeometry(.12, 6, 5), this.body, Math.cos(angle) * .58, -.15, Math.sin(angle) * .58);
      nodule.scale.y = .6;
      this.ornaments.push(nodule);
    }
  }

  private joint(parent: Object3D, side: number, rear: boolean, x: number, y: number, z: number, arm: boolean): CreatureLimb {
    const shoulder = new Group();
    const elbow = new Group();
    const foot = new Group();
    const length = this.kind === 'wolf' ? .3 : arm ? .42 : .4;
    shoulder.position.set(x, y, z);
    elbow.position.y = -length;
    foot.position.y = -length * .85;
    parent.add(shoulder);
    shoulder.add(elbow);
    elbow.add(foot);
    const width = this.kind === 'skeleton' ? .055 : this.kind === 'wolf' ? .065 : arm ? .13 : .14;
    this.mesh(shoulder, new SphereGeometry(width * 1.25, 7, 5), this.bone);
    this.mesh(shoulder, new CapsuleGeometry(width, length * .7, 3, 7), this.body, 0, -length * .5);
    this.mesh(elbow, new SphereGeometry(width * 1.15, 7, 5), this.bone);
    this.mesh(elbow, new CapsuleGeometry(width * .8, length * .6, 3, 7), this.body, 0, -length * .45);
    this.box(foot, width * 2.1, .12, arm ? .16 : .26, this.dark, 0, -.04, .04);
    if (arm) {
      for (let i = 0; i < 3; i++) {
        const claw = this.mesh(foot, new ConeGeometry(width * .15, .12, 4), this.bone, (i - 1) * width * .5, -.13, .055);
        claw.rotation.x = Math.PI;
      }
    }
    const result = { shoulder, elbow, foot, side, rear };
    this.limbs.push(result);
    return result;
  }

  private wolf(): void {
    const body = this.mesh(this.spine, new CapsuleGeometry(.34, .8, 5, 10), this.body, 0, .25, -.07);
    body.rotation.x = Math.PI / 2;
    body.scale.x = .9;
    this.skull.position.set(0, .55, .62);
    this.spine.add(this.skull);
    this.mesh(this.skull, new SphereGeometry(.31, 9, 7), this.body).scale.set(.85, .95, 1.1);
    this.box(this.skull, .3, .23, .36, this.body, 0, -.04, .25);
    this.box(this.skull, .19, .12, .09, this.dark, 0, -.015, .46);
    this.eyes(this.skull, .18, .08, .24, .042);
    this.jaw.position.set(0, -.12, .16);
    this.skull.add(this.jaw);
    this.box(this.jaw, .22, .07, .36, this.dark, 0, -.035, .14);
    for (const side of [-1, 1]) {
      const ear = this.mesh(this.skull, new ConeGeometry(.13, .3, 5), this.body, side * .2, .3, -.05);
      ear.rotation.z = -side * .15;
      for (let i = 0; i < 3; i++) this.mesh(this.jaw, new ConeGeometry(.022, .07, 4), this.bone, side * .09, 0, .1 + i * .08);
      for (const rear of [true, false]) this.joint(this.spine, side, rear, side * .27, .2, rear ? -.6 : .5, false);
    }
    this.tail.position.set(0, .38, -.85);
    this.spine.add(this.tail);
    const tail = this.mesh(this.tail, new ConeGeometry(.16, .8, 7), this.body, 0, 0, -.3);
    tail.rotation.x = -Math.PI / 2 - .25;
    for (let i = 0; i < 4; i++) {
      const tuft = this.mesh(this.spine, new ConeGeometry(.12, .3, 5), this.body, 0, .55, -.2 + i * .18);
      tuft.rotation.x = -.45;
    }
  }

  private humanoid(): void {
    this.spine.scale.setScalar(this.scale);
    this.spine.position.y = .03;
    const chest = this.mesh(this.spine, new LatheGeometry([new Vector2(.22,-.3),new Vector2(.24,-.1),new Vector2(.37,.15),new Vector2(.35,.3),new Vector2(.12,.4)],24), this.body, 0, .5);
    chest.scale.z = .7;
    this.mesh(this.spine, new SphereGeometry(.25, 7, 6), this.dark, 0, .02).scale.z = .7;
    this.skull.position.set(0, 1.15, .035);
    this.spine.add(this.skull);
    const head = this.mesh(this.skull, new SphereGeometry(.235, this.kind === 'golem' || this.boss ? 6 : 10, 8), this.body);
    head.scale.set(1, 1.16, .8);
    this.eyes(this.skull, .09, .04, .18, .043);
    this.jaw.position.set(0, -.12, .08);
    this.skull.add(this.jaw);
    this.box(this.jaw, .2, .065, .16, this.bone, 0, -.02, .02);
    for (let i = 0; i < 4; i++) this.box(this.jaw, .019, .04, .025, this.dark, -.065 + i * .043, -.01, .108);
    for (const side of [-1, 1]) {
      const arm = this.joint(this.spine, side, false, side * .42, .78, 0, true);
      this.joint(this.spine, side, true, side * .17, -.01, 0, false);
      if (this.kind === 'skeleton') {
        const blade = this.box(arm.foot, .075, .73, .035, this.bone, 0, .26, .05);
        blade.rotation.z = -.12;
        this.box(arm.foot, .23, .035, .06, this.dark, 0, -.03, .05);
        for (let rib = 0; rib < 4; rib++) {
          const bone = this.mesh(this.spine, new TorusGeometry(.22 - rib * .018, .024, 4, 10, Math.PI), this.bone, side * .005, .66 - rib * .09, .08);
          bone.rotation.z = Math.PI / 2;
          bone.scale.x = .55;
        }
      }
      if (this.kind === 'golem' || this.boss) {
        const plate = this.mesh(arm.shoulder, new SphereGeometry(.23, 5, 5), this.body);
        plate.scale.z = 1.2;
        const rune = this.box(arm.shoulder, .025, .18, .025, this.eye, 0, -.05, .225);
        rune.rotation.z = side * .35;
        for (let i = 0; i < 2; i++) {
          const spike = this.mesh(arm.shoulder, new ConeGeometry(.07, .3, 5), this.bone, side * .1 * i, .21, -.05);
          spike.rotation.z = -side * .25;
        }
      }
      if (this.boss) {
        const horn = this.mesh(this.skull, new TubeGeometry(new CatmullRomCurve3([new Vector3(),new Vector3(side*.12,.25,0),new Vector3(side*.23,.4,.12),new Vector3(side*.14,.5,.2)]),18,.07,8,false), this.bone, side * .2, .28, -.03);
        horn.rotation.z = -side * .45;
        const crown = this.mesh(this.skull, new TorusGeometry(.25, .018, 4, 16), this.eye, 0, .27, 0);
        crown.rotation.x = Math.PI / 2;
        this.ornaments.push(crown);
      }
    }
    if (this.kind === 'wraith') {
      const robe = this.mesh(this.spine, new ConeGeometry(.5, 1.2, 12, 3, true), this.dark, 0, -.1);
      robe.rotation.z = Math.PI;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        const strip = this.box(this.spine, .08, .6, .025, this.body, Math.cos(angle) * .33, -.49, Math.sin(angle) * .33);
        strip.rotation.z = Math.cos(angle) * .2;
        this.ornaments.push(strip);
      }
    }
    this.box(this.spine, .035, .4, .025, this.eye, 0, .56, .26);
    if (this.boss) {
      for(let i=0;i<5;i++){const joint=new Group();joint.position.set((i-2)*.18,.3,-.2);const curve=new CatmullRomCurve3([new Vector3(),new Vector3((i-2)*.2,-.1,-.5),new Vector3((i-2)*.3,-.3,-1),new Vector3((i-2)*.35,.1,-1.4)]);const tentacle=this.mesh(joint,new TubeGeometry(curve,20,.055,8,false),this.dark);joint.add(tentacle);this.spine.add(joint);this.tendrils.push(joint);}
      for (let i = 0; i < 3; i++) {
        const seal = this.mesh(this.spine, new TorusGeometry(.16 - i * .03, .013, 4, 18), this.eye, 0, .55, .3);
        seal.rotation.x = i * .12;
        this.ornaments.push(seal);
      }
    }
  }

  update(dt: number, elapsed: number, speed: number, attack: boolean, windup: number, hurt: number): void {
    dt = MathUtils.clamp(dt, 0, .05);
    if (this.imported) {
      if (attack && !this.previousAttack) this.imported.attack();
      this.previousAttack = attack;
      this.imported.update(dt,Math.min(1,Math.max(0,speed/4)));
      this.imported.setHitFlash(hurt>0?1:0);
      return;
    }
    this.attackBlend = MathUtils.damp(this.attackBlend, attack ? 1 : 0, 10, dt);
    const phase = elapsed * (this.kind === 'wolf' ? 11 : 6.5);
    const movement = Math.min(1, speed / (this.kind === 'wolf' ? 4.5 : 3));
    const breathe = Math.sin(elapsed * 2.4) * .018;
    this.spine.rotation.z = MathUtils.damp(this.spine.rotation.z, hurt > 0 ? -.12 : 0, 12, dt);
    this.spine.rotation.x = this.kind === 'wolf' ? Math.sin(phase * 2) * movement * .045 : movement * .1;
    this.skull.rotation.y = Math.sin(elapsed * .8) * .07 * (1 - this.attackBlend);
    this.skull.rotation.x = -this.attackBlend * .12;
    this.jaw.rotation.x = this.attackBlend * .5 + Math.max(0, Math.sin(elapsed * 1.6)) * .05;
    this.tail.rotation.y = Math.sin(elapsed * 4.5) * .3;
    for (const limb of this.limbs) {
      const oldUpper=limb.shoulder.rotation.clone(),oldLower=limb.elbow.rotation.clone();
      const alternate = limb.side * (limb.rear ? -1 : 1);
      const stride = Math.sin(phase + (alternate > 0 ? 0 : Math.PI)) * movement;
      limb.shoulder.rotation.x = stride * (this.kind === 'wolf' ? .7 : .5);
      limb.elbow.rotation.x = Math.max(0, -stride) * .8 * (limb.rear ? 1 : -1);
      limb.shoulder.rotation.z = limb.rear ? 0 : limb.side * -.08;
      if (attack && !limb.rear) {
        const preparation = windup > 0 ? Math.min(1, windup / .55) : 0;
        limb.shoulder.rotation.x = -2.1 * preparation + Math.sin(elapsed * 8) * .4 * (1 - preparation);
        limb.elbow.rotation.x = -.7 * preparation;
        limb.shoulder.rotation.z = limb.side * .22;
      }
      for(const axis of ['x','y','z'] as const){limb.shoulder.rotation[axis]=MathUtils.damp(oldUpper[axis],limb.shoulder.rotation[axis],12,dt);limb.elbow.rotation[axis]=MathUtils.damp(oldLower[axis],limb.elbow.rotation[axis],12,dt);}
    }
    if (this.kind === 'slime') {
      this.spine.scale.set(1 + Math.sin(phase) * .035, 1 - Math.sin(phase) * .08, 1 + Math.sin(phase) * .035);
      this.spine.position.y = Math.max(0, Math.sin(phase)) * movement * .13;
    } else if (this.kind === 'wolf') {
      this.spine.position.y = Math.abs(Math.sin(phase)) * movement * .08 + breathe;
    } else {
      this.spine.position.y = .03 + Math.abs(Math.sin(phase)) * movement * .04 + breathe;
    }
    this.tendrils.forEach((t,i)=>{t.rotation.x=Math.sin(elapsed*2+i)*.2;t.rotation.y=Math.sin(elapsed*1.7+i)*.25;});
    for (let i = 0; i < this.ornaments.length; i++) {
      const ornament = this.ornaments[i];
      if (this.kind === 'wraith') ornament.rotation.x = Math.sin(elapsed * 3 + i) * .2;
      else if (this.boss) ornament.rotation.z += dt * (.4 + i * .2);
    }
    this.batch?.sync();
  }

  dispose(): void {
    this.imported?.dispose();
    this.batch?.dispose();
    // Never dispose meshes from a cached shared GLTF: clones reuse those buffers.
    this.spine.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
