import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Scene, SphereGeometry, Vector3 } from 'three';
import { EventBus, type Combatant, type LootDrop } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroController } from '../player/HeroController';

/** A persistent wolf companion and an instantly summonable, articulated stag mount. */
export class PetAndMountSystem {
  readonly pet = new Group();
  readonly mount = new Group();
  private time = 0;
  private attackCooldown = 0;
  private petLegs: Group[] = [];
  private mountLegs: Group[] = [];
  private petTail = new Group();
  private lastMountPosition = new Vector3();
  private mountMoving = 0;

  constructor(private scene: Scene, private hero: HeroController, private physics: PhysicsWorld, private events: EventBus) {
    this.buildWolf();
    this.buildStag();
    this.pet.position.copy(hero.position).add(new Vector3(-2, 0, 1));
    this.lastMountPosition.copy(hero.position);
    this.scene.add(this.pet, this.mount);
    this.mount.visible = false;
  }

  private mesh(parent: Group, geometry: BoxGeometry | CapsuleGeometry | SphereGeometry | CylinderGeometry | ConeGeometry, material: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildWolf(): void {
    const fur = new MeshStandardMaterial({ color: 0x6d8588, roughness: 0.94 });
    const dark = new MeshStandardMaterial({ color: 0x304950, roughness: 0.9 });
    const light = new MeshStandardMaterial({ color: 0xd5d9ce, roughness: 0.9 });
    const glow = new MeshStandardMaterial({ color: 0x58efd3, emissive: 0x58efd3, emissiveIntensity: 1.4, roughness: 0.3 });
    const torso = this.mesh(this.pet, new CapsuleGeometry(0.23, 0.57, 4, 8), fur, 0, 0.65, 0);
    torso.rotation.x = Math.PI / 2;
    const chest = this.mesh(this.pet, new SphereGeometry(0.27, 10, 8), light, 0, 0.68, 0.3);
    chest.scale.set(1, 1.2, 0.8);
    this.mesh(this.pet, new BoxGeometry(0.33, 0.32, 0.37), fur, 0, 0.91, 0.49);
    this.mesh(this.pet, new BoxGeometry(0.22, 0.16, 0.28), light, 0, 0.81, 0.72);
    this.mesh(this.pet, new BoxGeometry(0.17, 0.09, 0.07), dark, 0, 0.83, 0.87);
    for (const side of [-1, 1]) {
      const ear = this.mesh(this.pet, new ConeGeometry(0.1, 0.25, 4), dark, side * 0.125, 1.15, 0.43);
      ear.rotation.z = side * -0.18;
      this.mesh(this.pet, new SphereGeometry(0.027, 6, 4), glow, side * 0.173, 0.95, 0.62);
      for (const z of [-0.28, 0.28]) {
        const pivot = new Group();
        pivot.position.set(side * 0.18, 0.61, z);
        this.pet.add(pivot);
        this.mesh(pivot, new BoxGeometry(0.115, 0.49, 0.13), fur, 0, -0.24, 0);
        this.mesh(pivot, new BoxGeometry(0.14, 0.1, 0.2), light, 0, -0.48, 0.04);
        this.petLegs.push(pivot);
      }
    }
    this.petTail.position.set(0, 0.7, -0.45);
    const tail = this.mesh(this.petTail, new ConeGeometry(0.13, 0.58, 7), dark, 0, 0, -0.22);
    tail.rotation.x = -Math.PI / 2;
    this.pet.add(this.petTail);
    const collar = this.mesh(this.pet, new CylinderGeometry(0.24, 0.24, 0.09, 10), glow, 0, 0.77, 0.39);
    collar.rotation.x = Math.PI / 2;
    this.pet.scale.setScalar(0.88);
  }

  private buildStag(): void {
    const coat = new MeshStandardMaterial({ color: 0x745844, roughness: 0.92 });
    const dark = new MeshStandardMaterial({ color: 0x332c28, roughness: 0.86 });
    const antler = new MeshStandardMaterial({ color: 0xc3b290, roughness: 0.8 });
    const saddle = new MeshStandardMaterial({ color: 0x244c4b, roughness: 0.75 });
    const gold = new MeshStandardMaterial({ color: 0xc8aa67, metalness: 0.7, roughness: 0.34 });
    const body = this.mesh(this.mount, new CapsuleGeometry(0.38, 0.85, 5, 12), coat, 0, 1.2, 0);
    body.rotation.x = Math.PI / 2;
    body.scale.x = 0.9;
    const neck = this.mesh(this.mount, new CapsuleGeometry(0.2, 0.65, 5, 10), coat, 0, 1.65, 0.53);
    neck.rotation.x = 0.4;
    const head = this.mesh(this.mount, new BoxGeometry(0.31, 0.3, 0.6), coat, 0, 2.03, 0.78);
    head.rotation.x = 0.1;
    this.mesh(this.mount, new BoxGeometry(0.25, 0.15, 0.23), dark, 0, 1.98, 1.08);
    this.mesh(this.mount, new BoxGeometry(0.7, 0.12, 0.6), saddle, 0, 1.59, -0.06);
    this.mesh(this.mount, new BoxGeometry(0.58, 0.1, 0.08), gold, 0, 1.66, -0.32);
    for (const side of [-1, 1]) {
      const ear = this.mesh(this.mount, new ConeGeometry(0.11, 0.3, 4), coat, side * 0.23, 2.2, 0.61);
      ear.rotation.z = -side * 0.9;
      this.mesh(this.mount, new SphereGeometry(0.032, 6, 5), gold, side * 0.16, 2.08, 0.91);
      const mainAntler = this.mesh(this.mount, new CylinderGeometry(0.025, 0.045, 0.7, 6), antler, side * 0.21, 2.5, 0.48);
      mainAntler.rotation.z = -side * 0.45;
      for (let i = 0; i < 3; i++) {
        const branch = this.mesh(this.mount, new CylinderGeometry(0.009, 0.025, 0.29, 5), antler, side * (0.23 + i * 0.09), 2.34 + i * 0.17, 0.6);
        branch.rotation.x = 0.8;
        branch.rotation.z = -side * 0.8;
      }
      for (const z of [-0.44, 0.43]) {
        const leg = new Group();
        leg.position.set(side * 0.25, 1.17, z);
        this.mount.add(leg);
        this.mesh(leg, new CylinderGeometry(0.075, 0.055, 0.89, 7), coat, 0, -0.43, 0);
        this.mesh(leg, new BoxGeometry(0.13, 0.16, 0.2), dark, 0, -0.96, 0.035);
        this.mountLegs.push(leg);
      }
    }
    const tail = this.mesh(this.mount, new ConeGeometry(0.12, 0.4, 7), dark, 0, 1.2, -0.72);
    tail.rotation.x = -Math.PI / 2;
  }

  toggleMount(): void {
    if (!this.hero.alive) return;
    if (!this.hero.mounted && ['climb', 'swim', 'dive', 'slide'].includes(this.hero.machine.state)) {
      this.events.emit('message', { text: 'Encontre terra firme para invocar sua montaria.', tone: 'warning' });
      return;
    }
    this.hero.mounted = !this.hero.mounted;
    this.mount.visible = this.hero.mounted;
    this.events.emit('message', { text: this.hero.mounted ? 'Cervo ancestral invocado · velocidade aumentada' : 'Montaria dispensada', tone: 'info' });
  }

  update(dt: number, enemies: Combatant[], drops: LootDrop[]): void {
    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.mount.visible = this.hero.mounted && this.hero.alive;
    if (this.hero.machine.state === 'swim' || this.hero.machine.state === 'dive' || !this.hero.alive) {
      this.hero.mounted = false;
      this.mount.visible = false;
    }
    let target: Combatant | undefined;
    let nearest = 10;
    if (this.hero.alive) {
      for (const enemy of enemies) {
        if (!enemy.alive || enemy.position.distanceTo(this.hero.position) > 16) continue;
        const distance = enemy.position.distanceTo(this.pet.position);
        if (distance < nearest) { nearest = distance; target = enemy; }
      }
    }
    const targetPosition = target ? target.position.clone() : this.hero.position.clone().add(new Vector3(-this.hero.facing.z * 1.8, 0, this.hero.facing.x * 1.8)).addScaledVector(this.hero.facing, -1.9);
    let lootTarget: LootDrop | undefined;
    let lootDistance = 7;
    for (const drop of drops) {
      const distance = drop.position.distanceTo(this.pet.position);
      if (distance < lootDistance && drop.position.distanceTo(this.hero.position) < 22) {
        lootDistance = distance;
        lootTarget = drop;
      }
    }
    if (lootTarget && (!target || nearest > 4)) targetPosition.copy(lootTarget.position);
    const offset = targetPosition.sub(this.pet.position);
    offset.y = 0;
    const distance = offset.length();
    const speed = this.hero.mounted ? 11.7 : target ? 8.5 : 7.8;
    if (distance > 0.65) {
      const step = Math.min(distance, speed * dt);
      this.pet.position.addScaledVector(offset.normalize(), step);
      const facing = Math.atan2(offset.x, offset.z);
      this.pet.rotation.y += Math.atan2(Math.sin(facing - this.pet.rotation.y), Math.cos(facing - this.pet.rotation.y)) * (1 - Math.exp(-dt * 12));
    }
    if (this.pet.position.distanceTo(this.hero.position) > 38) this.pet.position.copy(this.hero.position).add(new Vector3(-2, 0, 1));
    this.pet.position.y = Math.max(this.physics.terrainHeight(this.pet.position.x, this.pet.position.z), this.physics.waterLevel - 0.28);
    const stride = distance > 0.65 ? Math.sin(this.time * speed * 1.8) * 0.65 : 0;
    this.petLegs.forEach((leg, i) => { leg.rotation.x = stride * (i === 0 || i === 3 ? 1 : -1); });
    this.petTail.rotation.y = Math.sin(this.time * 4) * 0.4;
    if (target && nearest < target.radius + 1.15 && this.attackCooldown === 0 && this.hero.alive) {
      this.attackCooldown = 1.1;
      const damage = Math.max(1, Math.round(this.hero.stats.attack * 0.32 * 100 / (100 + target.defense)));
      const knockback = target.position.clone().sub(this.pet.position).setY(0).normalize().multiplyScalar(1.2);
      const dealt = target.receiveDamage(damage, knockback);
      if (dealt > 0) this.events.emit('damage', { position: target.position.clone().add(new Vector3(0, 1.2, 0)), amount: dealt, critical: false, team: 'enemy', color: 0x74ead4 });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      if (this.hero.alive && (this.pet.position.distanceTo(drops[i].position) < 1.5 || this.hero.position.distanceTo(drops[i].position) < 1.8)) {
        const [drop] = drops.splice(i, 1);
        this.events.emit('loot', drop);
      }
    }
    if (this.mount.visible) {
      const displacement = this.hero.position.distanceTo(this.lastMountPosition) / Math.max(dt, 0.001);
      this.mountMoving = MathUtils.damp(this.mountMoving, Math.min(displacement, 12), 8, dt);
      this.mount.position.copy(this.hero.position);
      this.mount.position.y -= this.hero.radius;
      this.mount.rotation.y = this.hero.model.rotation.y;
      const gallop = Math.sin(this.time * 12) * Math.min(0.85, this.mountMoving * 0.1);
      this.mountLegs.forEach((leg, i) => { leg.rotation.x = gallop * (i === 0 || i === 3 ? 1 : -1); });
    }
    this.lastMountPosition.copy(this.hero.position);
  }

  dispose(): void {
    const materials = new Set<MeshStandardMaterial>();
    for (const root of [this.pet, this.mount]) {
      root.traverse(object => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material as MeshStandardMaterial);
        }
      });
      this.scene.remove(root);
    }
    materials.forEach(material => material.dispose());
  }
}
