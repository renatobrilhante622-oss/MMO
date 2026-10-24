import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, Scene, SphereGeometry, Vector3 } from 'three';
import type { Body } from 'cannon-es';
import type { Combatant } from '../core/GameTypes';
import { EventBus } from '../core/GameTypes';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { calculateDamage } from '../combat/ClassSystem';

type EnemyState = 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';
interface Archetype { hp: number; attack: number; defense: number; speed: number; radius: number; color: number; emissive: number }
const ARCHETYPES: Record<string, Archetype> = {
  slime: { hp: 48, attack: 9, defense: 2, speed: 2.5, radius: .55, color: 0x8bbf79, emissive: 0x143d20 },
  wolf: { hp: 72, attack: 13, defense: 5, speed: 4.6, radius: .6, color: 0x78868e, emissive: 0x000000 },
  skeleton: { hp: 95, attack: 16, defense: 9, speed: 3.2, radius: .55, color: 0xe2d5b4, emissive: 0x000000 },
  golem: { hp: 185, attack: 23, defense: 24, speed: 2.1, radius: .95, color: 0x707e77, emissive: 0x243d35 },
  wraith: { hp: 85, attack: 19, defense: 6, speed: 3.8, radius: .6, color: 0x8d7daa, emissive: 0x39265b },
  boss: { hp: 2200, attack: 32, defense: 32, speed: 2.7, radius: 1.7, color: 0x5c5564, emissive: 0x6b233d },
};
let enemySerial = 0;

export class Enemy implements Combatant {
  readonly id = `enemy-${++enemySerial}`;
  readonly team = 'enemy' as const;
  readonly invulnerable = false;
  readonly position = new Vector3();
  readonly radius: number;
  readonly maxHp: number;
  readonly defense: number;
  readonly attackPower: number;
  readonly speed: number;
  readonly model = new Group();
  readonly body: Body;
  readonly home: Vector3;
  hp: number;
  state: EnemyState = 'patrol';
  deathTime = 0;
  attackCooldown = 1;
  attackWindup = -1;
  hitStun = 0;
  patrolPhase: number;
  private healthFill: Mesh;
  private healthGroup = new Group();
  private telegraph: Mesh;
  private bodyRemoved = false;
  private material: MeshStandardMaterial;
  private limbs: Mesh[] = [];
  private archetype: Archetype;

  constructor(private scene: Scene, private physics: PhysicsWorld, private events: EventBus, readonly kind: string, position: Vector3, readonly level = 1, readonly boss = false) {
    this.archetype = ARCHETYPES[boss ? 'boss' : kind] ?? ARCHETYPES.slime;
    const data = this.archetype;
    this.radius = data.radius;
    this.maxHp = Math.round(data.hp * (1 + (level - 1) * .28));
    this.hp = this.maxHp;
    this.defense = Math.round(data.defense * (1 + (level - 1) * .15));
    this.attackPower = Math.round(data.attack * (1 + (level - 1) * .18));
    this.speed = data.speed;
    this.home = position.clone();
    this.position.copy(position);
    this.patrolPhase = Math.random() * Math.PI * 2;
    this.body = physics.createCharacter(position, this.radius);
    this.body.mass = boss ? 12 : 2;
    this.body.updateMassProperties();
    this.material = new MeshStandardMaterial({ color: data.color, roughness: .76, metalness: kind === 'golem' || boss ? .3 : .05, emissive: data.emissive, emissiveIntensity: .25 });
    this.buildModel();
    this.model.position.copy(position); this.scene.add(this.model);
    const bg = new Mesh(new BoxGeometry(boss ? 3.6 : 1.4, .13, .025), new MeshBasicMaterial({ color: 0x182128, transparent: true, opacity: .88 }));
    this.healthFill = new Mesh(new BoxGeometry(boss ? 3.5 : 1.32, .085, .035), new MeshBasicMaterial({ color: boss ? 0xf36c80 : 0xf4ad7c }));
    this.healthFill.position.z = .015;
    this.healthGroup.add(bg, this.healthFill);
    this.healthGroup.position.y = boss ? 5.4 : kind === 'golem' ? 2.9 : 2;
    this.model.add(this.healthGroup);
    this.healthGroup.visible = boss;
    this.telegraph = new Mesh(new RingGeometry(.82, 1, 40), new MeshBasicMaterial({ color: 0xfb5154, transparent: true, opacity: .5, depthWrite: false }));
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.scale.setScalar(this.radius + 1.65);
    this.telegraph.visible = false; this.scene.add(this.telegraph);
  }

  get alive(): boolean { return this.hp > 0; }

  private part(geometry: BoxGeometry | SphereGeometry | CylinderGeometry | ConeGeometry, position: Vector3, material = this.material): Mesh {
    const mesh = new Mesh(geometry, material); mesh.position.copy(position); mesh.castShadow = true; mesh.receiveShadow = true; this.model.add(mesh); return mesh;
  }

  private buildModel(): void {
    const eyeMaterial = new MeshStandardMaterial({ color: this.boss ? 0xffc56d : 0xd7ffdd, emissive: this.boss ? 0xff643f : 0x7bccba, emissiveIntensity: 1.8, roughness: .3 });
    if (this.kind === 'slime' && !this.boss) {
      const body = this.part(new SphereGeometry(.72, 14, 10), new Vector3(0, .08, 0)); body.scale.set(1, .72, 1);
      for (const x of [-.23, .23]) this.part(new SphereGeometry(.065, 6, 6), new Vector3(x, .23, .57), eyeMaterial);
    } else if (this.kind === 'wolf' && !this.boss) {
      const body = this.part(new BoxGeometry(.9, .65, 1.6), new Vector3(0, .25, -.1)); body.rotation.x = -.08;
      this.part(new BoxGeometry(.58, .6, .7), new Vector3(0, .65, .8));
      for (const x of [-.21, .21]) {
        const ear = this.part(new ConeGeometry(.16, .42, 4), new Vector3(x, 1.05, .7)); ear.rotation.x = -.2;
        this.part(new SphereGeometry(.055, 6, 6), new Vector3(x, .75, 1.15), eyeMaterial);
        for (const z of [-.65, .52]) this.limbs.push(this.part(new BoxGeometry(.17, .62, .18), new Vector3(x * 1.5, -.25, z)));
      }
      const tail = this.part(new ConeGeometry(.2, .9, 6), new Vector3(0, .35, -1.05)); tail.rotation.x = -1.2;
    } else {
      const scale = this.boss ? 2.45 : this.kind === 'golem' ? 1.5 : 1;
      this.part(new BoxGeometry(.85 * scale, 1.02 * scale, .48 * scale), new Vector3(0, .5 * scale, 0));
      const head = this.part(new SphereGeometry(.34 * scale, this.kind === 'golem' || this.boss ? 6 : 10, 7), new Vector3(0, 1.3 * scale, 0));
      if (this.kind === 'wraith') {
        const robe = this.part(new ConeGeometry(.65, 1.3, 9), new Vector3(0, -.1, 0)); robe.rotation.z = Math.PI;
      } else for (const x of [-.23, .23]) this.limbs.push(this.part(new BoxGeometry(.25 * scale, .85 * scale, .28 * scale), new Vector3(x * scale, -.38 * scale, 0)));
      for (const side of [-1, 1]) {
        this.limbs.push(this.part(new BoxGeometry(.26 * scale, .95 * scale, .3 * scale), new Vector3(side * .63 * scale, .45 * scale, 0)));
        this.part(new SphereGeometry(.065 * scale, 6, 6), new Vector3(side * .13 * scale, 1.36 * scale, .3 * scale), eyeMaterial);
        if (this.boss) {
          const horn = this.part(new ConeGeometry(.22, 1, 5), new Vector3(side * .7, 4.05, -.1)); horn.rotation.z = -side * .5;
          this.part(new ConeGeometry(.4, .9, 5), new Vector3(side * 1.3, 2.5, 0));
        }
      }
      if (this.kind === 'skeleton') this.part(new BoxGeometry(.12, 1.1, .25), new Vector3(.75, .15, .4), eyeMaterial);
      head.rotation.z = this.kind === 'wraith' ? .08 : 0;
    }
  }

  receiveDamage(amount: number, knockback?: Vector3): number {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    const dealt = Math.min(this.hp, Math.max(0, Math.round(amount)));
    this.hp -= dealt; this.hitStun = .16; this.healthGroup.visible = true;
    this.healthFill.scale.x = Math.max(0, this.hp / this.maxHp);
    this.healthFill.position.x = -(1 - this.hp / this.maxHp) * (this.boss ? 1.75 : .66);
    if (knockback && !this.boss) { this.body.velocity.x += knockback.x; this.body.velocity.y += Math.max(0, knockback.y); this.body.velocity.z += knockback.z; }
    if (this.hp <= 0) {
      this.hp = 0; this.state = 'dead'; this.telegraph.visible = false;
      this.removeBody();
      this.events.emit('kill', { kind: this.kind, position: this.position.clone(), level: this.level, boss: this.boss });
    }
    return dealt;
  }

  tick(dt: number, hero: Combatant, elapsed: number): void {
    if (!this.alive) {
      this.deathTime += dt; this.model.scale.setScalar(Math.max(.01, 1 - this.deathTime)); this.model.rotation.z += dt * 1.6;
      return;
    }
    this.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.model.position.copy(this.position);
    if (this.kind === 'slime') this.model.scale.y = 1 + Math.sin(elapsed * 5 + this.patrolPhase) * .09;
    if (this.kind === 'wraith') this.model.position.y += Math.sin(elapsed * 2 + this.patrolPhase) * .2;
    this.healthGroup.lookAt(hero.position.x, this.model.position.y + this.healthGroup.position.y, hero.position.z);
    this.material.emissiveIntensity = this.hitStun > 0 ? 1.2 : .25;
    this.hitStun = Math.max(0, this.hitStun - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const delta = hero.position.clone().sub(this.position); delta.y = 0;
    const distance = delta.length();
    const safeVillage = hero.position.distanceTo(new Vector3(0, 5.5, 18)) < 19;
    const attackRange = this.radius + hero.radius + (this.boss ? 2 : 1.3);
    if (this.attackWindup >= 0) {
      this.state = 'attack'; this.body.velocity.x *= .8; this.body.velocity.z *= .8;
      this.attackWindup -= dt;
      this.telegraph.position.set(this.position.x, this.physics.terrainHeight(this.position.x, this.position.z) + .08, this.position.z);
      this.telegraph.visible = true;
      (this.telegraph.material as MeshBasicMaterial).opacity = .3 + .3 * Math.sin(elapsed * 22);
      if (this.attackWindup <= 0) {
        this.attackWindup = -1; this.telegraph.visible = false;
        if (hero.alive && !safeVillage && distance <= attackRange + .5) {
          const impulse = delta.clone().normalize().multiplyScalar(this.boss ? 8 : 3); impulse.y = .8;
          const dealt = hero.receiveDamage(calculateDamage(this.attackPower, hero.defense), impulse);
          if (dealt > 0) this.events.emit('damage', { position: hero.position.clone().add(new Vector3(0, 1.2, 0)), amount: dealt, critical: false, team: 'hero', color: 0xff716e });
        }
      }
    } else if (hero.alive && !safeVillage && distance < (this.boss ? 35 : 20) && this.position.distanceTo(this.home) < 45) {
      if (this.kind === 'wolf' && this.hp < this.maxHp * .22 && distance < 8) {
        this.state = 'flee'; this.move(delta.normalize().multiplyScalar(-this.speed * 1.15), dt);
      } else if (distance > attackRange) {
        this.state = 'chase'; this.move(delta.normalize().multiplyScalar(this.speed), dt);
      } else {
        this.body.velocity.x *= .75; this.body.velocity.z *= .75;
        this.state = 'attack';
        if (this.attackCooldown <= 0) { this.attackWindup = this.boss ? .9 : .55; this.attackCooldown = this.boss ? 2.6 : 1.8; }
      }
      this.model.rotation.y = Math.atan2(delta.x, delta.z);
    } else {
      this.state = 'patrol';
      const destination = this.home.clone().add(new Vector3(Math.cos(elapsed * .13 + this.patrolPhase) * 4.5, 0, Math.sin(elapsed * .13 + this.patrolPhase) * 4.5));
      const walk = destination.sub(this.position).setY(0);
      if (walk.length() > .5) { this.move(walk.normalize().multiplyScalar(this.speed * .35), dt); this.model.rotation.y = Math.atan2(walk.x, walk.z); }
      else { this.body.velocity.x *= .8; this.body.velocity.z *= .8; }
    }
    if (this.hitStun <= 0) {
      const moving = Math.hypot(this.body.velocity.x, this.body.velocity.z) > .5;
      this.limbs.forEach((limb, index) => { limb.rotation.x = moving ? Math.sin(elapsed * 8 + index * Math.PI) * .5 : Math.sin(elapsed * 2 + index) * .035; });
    }
    if (this.body.position.y < -25) this.receiveDamage(this.hp);
  }

  private move(velocity: Vector3, dt: number): void {
    if (this.hitStun > 0) return;
    const aheadX = this.position.x + velocity.x * .5, aheadZ = this.position.z + velocity.z * .5;
    if (this.physics.terrainHeight(aheadX, aheadZ) < this.physics.waterLevel + .35 || Math.abs(aheadX) > 143 || Math.abs(aheadZ) > 143) { this.body.velocity.x = 0; this.body.velocity.z = 0; return; }
    const factor = 1 - Math.exp(-dt * 9);
    this.body.velocity.x += (velocity.x - this.body.velocity.x) * factor;
    this.body.velocity.z += (velocity.z - this.body.velocity.z) * factor;
  }

  private removeBody(): void { if (!this.bodyRemoved) { this.physics.removeBody(this.body); this.bodyRemoved = true; } }
  dispose(): void {
    this.removeBody(); this.scene.remove(this.model, this.telegraph);
    this.model.traverse(child => { if (child instanceof Mesh) { child.geometry.dispose(); if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); } });
    this.telegraph.geometry.dispose(); (this.telegraph.material as MeshBasicMaterial).dispose();
  }
}

export class EnemyAI {
  readonly enemies: Enemy[] = [];
  private elapsed = 0;
  private spawnTimer = 4;
  private spawnIndex = 0;
  private kinds = ['slime', 'wolf', 'skeleton', 'golem', 'wraith'];
  constructor(private scene: Scene, private physics: PhysicsWorld, private events: EventBus) {
    const locations: [number, number][] = [[-14, -8], [13, -9], [-24, -18], [22, -25], [9, -34], [-19, -43], [35, -47], [-44, -30], [28, -77], [-32, -82], [58, -52], [-60, -65], [-38, 46], [48, 45]];
    locations.forEach(([x, z], i) => {
      const height = physics.terrainHeight(x, z);
      if (height > physics.waterLevel + .5) this.spawn(this.kinds[i % this.kinds.length], new Vector3(x, height + 1.5, z), 1 + Math.floor(i / 5));
    });
  }

  terrainHeight(x: number, z: number): number { return this.physics.terrainHeight(x, z); }

  spawn(kind: string, position: Vector3, level = 1, boss = false): Enemy {
    const radius = (ARCHETYPES[boss ? 'boss' : kind] ?? ARCHETYPES.slime).radius;
    const spawn = position.clone();
    spawn.y = Math.max(this.physics.terrainHeight(spawn.x, spawn.z) + radius + .15, spawn.y);
    const enemy = new Enemy(this.scene, this.physics, this.events, kind, spawn, Math.max(1, Math.floor(level)), boss);
    this.enemies.push(enemy); return enemy;
  }

  update(dt: number, hero: Combatant): void {
    this.elapsed += dt;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]; enemy.tick(dt, hero, this.elapsed);
      if (!enemy.alive && enemy.deathTime > 1.1) { enemy.dispose(); this.enemies.splice(i, 1); }
    }
    this.spawnTimer -= dt;
    const ambientCount = this.enemies.filter(enemy => !enemy.boss && enemy.alive).length;
    if (this.spawnTimer <= 0 && ambientCount < 18 && hero.alive) {
      this.spawnTimer = 8;
      const angle = this.spawnIndex++ * 2.39996;
      const x = hero.position.x + Math.cos(angle) * 28, z = hero.position.z + Math.sin(angle) * 28;
      const y = this.physics.terrainHeight(x, z);
      if (Math.abs(x) < 135 && Math.abs(z) < 135 && y > this.physics.waterLevel + .5 && Math.hypot(x, z - 18) > 28 && Math.hypot(x, z + 70) > 23) this.spawn(this.kinds[this.spawnIndex % this.kinds.length], new Vector3(x, y + 1.5, z), 1 + Math.min(5, Math.floor(Math.hypot(x, z - 18) / 40)));
    }
  }

  dispose(): void { this.enemies.forEach(enemy => enemy.dispose()); this.enemies.length = 0; }
}
