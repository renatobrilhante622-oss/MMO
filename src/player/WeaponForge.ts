import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry,
  Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry,
  TorusGeometry, TubeGeometry, Vector3,
} from 'three';
import type { ClassDefinition } from '../core/GameTypes';

/** Individually authored, local-asset weapon assemblies attached to the actual hands. */
export class WeaponForge {
  readonly right = new Group();
  readonly left = new Group();
  readonly tip = new Group();
  private materials = new Set<MeshStandardMaterial>();
  private moving: Array<{ object: Object3D; speed: number; axis: 'x' | 'y' | 'z' }> = [];
  private bowString?: Mesh;
  private bowArrow?: Group;
  private definition: ClassDefinition;
  private readonly steel: MeshStandardMaterial;
  private readonly gold: MeshStandardMaterial;
  private readonly leather: MeshStandardMaterial;
  private readonly wood: MeshStandardMaterial;
  private readonly glow: MeshStandardMaterial;

  constructor(definition: ClassDefinition) {
    this.definition = definition;
    this.steel = this.material(0xb6c5ce, .92, .2);
    this.gold = this.material(0xd6b366, .87, .27);
    this.leather = this.material(0x2a211f, .06, .91);
    this.wood = this.material(0x674332, .02, .79);
    this.glow = this.material(definition.color, .4, .3);
    this.glow.emissive.setHex(definition.color);
    this.glow.emissiveIntensity = 2.7;
    this.right.name = `${definition.weapon}-right-grip`;
    this.left.name = `${definition.weapon}-left-grip`;
    this.build();
  }

  appearance(color:number,refine:number,rarity:string):void {
    const tier=['common','uncommon','rare','epic','legendary','mythic'].indexOf(rarity);
    this.glow.color.setHex(color);this.glow.emissive.setHex(color);this.glow.emissiveIntensity=.1+Math.max(0,tier)*.35+Math.min(15,refine)*.12;
    this.steel.emissive.setHex(color);this.steel.emissiveIntensity=Math.min(15,refine)*.022;
  }
  private material(color: number, metalness: number, roughness: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, metalness, roughness });
    this.materials.add(material);
    return material;
  }

  private mesh(parent: Group, geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private bar(parent: Group, width: number, height: number, depth: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
    return this.mesh(parent, new BoxGeometry(width, height, depth), material, x, y, z);
  }

  private rod(parent: Group, length: number, radius: number, material: MeshStandardMaterial, y: number): Mesh {
    return this.mesh(parent, new CylinderGeometry(radius * .85, radius, length, 8), material, 0, y);
  }

  /** A beveled six-sided blade, with an actual tapered cutting edge and central ridge. */
  private blade(parent: Group, width: number, length: number, y: number, hooked = false): Mesh {
    const half = width / 2;
    const thickness = .035;
    const profile = [
      [-half, 0, 0], [0, 0, thickness], [half, 0, 0],
      [-half * .6, length * .77, 0], [0, length * .81, thickness * .7], [half * .6, length * .77, 0],
      [hooked ? half * 2 : 0, length, 0],
      [0, 0, -thickness], [0, length * .81, -thickness * .7],
    ];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(profile.flat(), 3));
    geometry.setIndex([0,1,3, 1,4,3, 1,2,4, 2,5,4, 3,4,6, 4,5,6, 2,7,5, 7,8,5, 7,0,8, 0,3,8, 5,8,6, 8,3,6, 0,7,1, 1,7,2]);
    geometry.computeVertexNormals();
    return this.mesh(parent, geometry, this.steel, 0, y);
  }

  private grip(parent: Group, length = .26): void {
    this.rod(parent, length, .04, this.leather, .015);
    for (let i = 0; i < 6; i++) {
      const wrap = this.mesh(parent, new TorusGeometry(.041, .006, 4, 8), this.gold, 0, -length * .4 + i * length * .16);
      wrap.rotation.x = Math.PI / 2;
    }
    this.mesh(parent, new SphereGeometry(.055, 8, 6), this.gold, 0, -length * .58);
  }

  private inlay(parent: Group, length: number, y: number): void {
    this.bar(parent, .012, length, .008, this.glow, 0, y, .037);
    for (let i = 0; i < 4; i++) {
      const rune = this.bar(parent, .038, .009, .009, this.gold, 0, y - length * .35 + i * length * .22, .042);
      rune.rotation.z = i % 2 ? .6 : -.6;
    }
  }

  private build(): void {
    switch (this.definition.weapon) {
      case 'axe': this.axe(); break;
      case 'sword': this.sword(); break;
      case 'daggers': this.daggers(); break;
      case 'bow': this.bow(); break;
      case 'staff': this.staff(); break;
      case 'scythe': this.scythe(); break;
      case 'fists': this.fists(); break;
      case 'lance': this.lance(); break;
      case 'orb': this.orb(); break;
    }
    this.right.add(this.tip);
    this.tip.position.set(0, this.definition.weapon === 'lance' ? 1.6 : 1.05, 0);
    this.right.rotation.x = .25;
  }

  private axe(): void {
    this.rod(this.right, 1.4, .035, this.wood, .38);
    this.grip(this.right, .35);
    for (const side of [-1, 1]) {
      const head = new Group();
      head.position.set(side * .06, .87, 0);
      head.rotation.z = side * -.6;
      this.right.add(head);
      this.blade(head, .31, .48, -.19, true).rotation.z = side * Math.PI / 2;
      this.bar(head, .15, .19, .12, this.gold);
      this.mesh(head, new SphereGeometry(.07, 8, 6), this.glow, side * .12, 0, .055);
    }
    this.rod(this.right, .18, .08, this.steel, 1.09);
  }

  private sword(): void {
    this.grip(this.right);
    this.blade(this.right, .16, .97, .19);
    this.inlay(this.right, .6, .64);
    const guard = this.bar(this.right, .48, .055, .1, this.gold, 0, .16);
    guard.rotation.z = .06;
    for (const side of [-1, 1]) {
      this.mesh(this.right, new SphereGeometry(.045, 8, 6), this.glow, side * .24, .16);
    }
    const shield = new Group();
    shield.rotation.set(.25, 0, Math.PI / 2);
    this.left.add(shield);
    const face = this.mesh(shield, new CylinderGeometry(.31, .35, .075, 6), this.steel);
    face.rotation.x = Math.PI / 2;
    const rim = this.mesh(shield, new TorusGeometry(.31, .022, 5, 6), this.gold, 0, 0, .045);
    rim.rotation.z = Math.PI / 6;
    this.bar(shield, .055, .37, .025, this.glow, 0, 0, .055);
    this.bar(shield, .26, .055, .025, this.glow, 0, .045, .055);
  }

  private daggers(): void {
    for (const [parent, side] of [[this.right, 1], [this.left, -1]] as const) {
      this.grip(parent, .2);
      this.blade(parent, .13, .52, .12, true).rotation.z = side * -.12;
      this.bar(parent, .24, .035, .07, this.gold, 0, .1);
      this.inlay(parent, .23, .33);
      parent.rotation.z = side * .25;
    }
  }

  private bow(): void {
    this.grip(this.left, .23);
    const points = [
      new Vector3(0, -.65, .08), new Vector3(0, -.52, -.14),
      new Vector3(0, -.3, -.21), new Vector3(0, 0, 0),
      new Vector3(0, .3, -.21), new Vector3(0, .52, -.14), new Vector3(0, .65, .08),
    ];
    const curve = new CatmullRomCurve3(points);
    this.mesh(this.left, new TubeGeometry(curve, 32, .027, 6, false), this.wood);
    for (const y of [-.56, .56]) {
      const cap = this.mesh(this.left, new ConeGeometry(.045, .18, 6), this.gold, 0, y, -.03);
      cap.rotation.x = y > 0 ? -.4 : Math.PI + .4;
    }
    this.bowString = this.rod(this.left, 1.3, .003, this.leather, 0);
    this.bowString.position.z = .08;
    this.bowArrow = new Group();
    this.bowArrow.rotation.x = Math.PI / 2;
    this.left.add(this.bowArrow);
    this.rod(this.bowArrow, .78, .008, this.wood, 0);
    this.mesh(this.bowArrow, new ConeGeometry(.025, .1, 4), this.steel, 0, .43);
    for (const side of [-1, 1]) {
      const feather = this.bar(this.bowArrow, .035, .12, .005, this.gold, side * .015, -.29);
      feather.rotation.z = side * .2;
    }
  }

  private staff(): void {
    this.rod(this.right, 1.7, .028, this.wood, .44);
    this.grip(this.right, .3);
    for (let i = 0; i < 4; i++) this.rod(this.right, .035, .045, this.gold, .6 + i * .17);
    const cradle = this.mesh(this.right, new TorusGeometry(.17, .026, 6, 20), this.gold, 0, 1.33);
    const crystal = this.mesh(this.right, new SphereGeometry(.115, 6, 4), this.glow, 0, 1.33);
    crystal.scale.y = 1.5;
    this.moving.push({ object: crystal, speed: 1.8, axis: 'y' });
    this.moving.push({ object: cradle, speed: -.8, axis: 'y' });
    for (const side of [-1, 1]) {
      const prong = this.mesh(this.right, new ConeGeometry(.04, .23, 5), this.gold, side * .16, 1.25);
      prong.rotation.z = -side * .4;
    }
  }

  private scythe(): void {
    this.rod(this.right, 1.8, .027, this.wood, .45);
    this.grip(this.right, .33);
    const bladeGroup = new Group();
    bladeGroup.position.y = 1.29;
    bladeGroup.rotation.z = -Math.PI / 2 - .25;
    this.right.add(bladeGroup);
    this.blade(bladeGroup, .18, .85, 0, true);
    this.inlay(bladeGroup, .48, .34);
    const skull = this.mesh(this.right, new SphereGeometry(.11, 6, 5), this.steel, .04, 1.31, .035);
    skull.scale.set(1, 1.25, .65);
    for (const side of [-1, 1]) this.mesh(this.right, new SphereGeometry(.024, 6, 4), this.glow, .04 + side * .04, 1.33, .11);
  }

  private fists(): void {
    for (const [parent, side] of [[this.left, -1], [this.right, 1]] as const) {
      const gauntlet = this.bar(parent, .19, .22, .2, this.steel, 0, .03);
      gauntlet.rotation.z = -side * .06;
      this.bar(parent, .22, .045, .24, this.gold, 0, .13);
      for (let i = 0; i < 4; i++) {
        const knuckle = this.mesh(parent, new ConeGeometry(.025, .075, 4), this.glow, -.065 + i * .043, -.065, .115);
        knuckle.rotation.x = Math.PI / 2;
      }
      this.mesh(parent, new TorusGeometry(.073, .011, 4, 12), this.glow, 0, .03, .11);
    }
  }

  private lance(): void {
    this.rod(this.right, 2.15, .025, this.wood, .48);
    this.grip(this.right, .35);
    this.blade(this.right, .15, .5, 1.47);
    this.inlay(this.right, .25, 1.67);
    this.bar(this.right, .3, .045, .07, this.gold, 0, 1.48);
    for (let i = 0; i < 3; i++) this.rod(this.right, .027, .035, this.gold, .92 + i * .12);
    for (const side of [-1, 1]) {
      const pennant = this.bar(this.right, .12, .3, .008, this.glow, side * .07, 1.2);
      pennant.rotation.z = side * .15;
    }
  }

  private orb(): void {
    const focus = new Group();
    focus.position.set(0, .26, .04);
    this.left.add(focus);
    this.mesh(focus, new SphereGeometry(.14, 14, 10), this.glow);
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(focus, new TorusGeometry(.22 + i * .03, .012, 4, 24), this.gold);
      ring.rotation.set(i * .8, i * .9, i * .4);
      this.moving.push({ object: ring, speed: .8 + i * .3, axis: i % 2 ? 'y' : 'x' });
    }
    this.grip(this.right, .2);
    this.blade(this.right, .09, .34, .11);
  }

  update(dt: number, time: number, attack: number): void {
    for (const item of this.moving) item.object.rotation[item.axis] += dt * item.speed;
    if (this.bowString) {
      this.bowString.position.z = .08 + Math.sin(attack * Math.PI) * .16;
      if (this.bowArrow) this.bowArrow.visible = attack < .7;
    }
    this.glow.emissiveIntensity = 2.1 + Math.sin(time * 3.2) * .35 + Math.sin(attack * Math.PI) * .8;
  }

  dispose(): void {
    const geometries = new Set<BufferGeometry>();
    for (const root of [this.left, this.right]) {
      root.removeFromParent();
      root.traverse(object => { if (object instanceof Mesh) geometries.add(object.geometry); });
      root.clear();
    }
    geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.moving.length = 0;
  }
}
