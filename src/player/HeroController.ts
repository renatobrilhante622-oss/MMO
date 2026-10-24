import {
  BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide,
  Group, MathUtils, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import type { Body } from 'cannon-es';
import { EventBus, type CharacterStats, type ClassDefinition, type Combatant, type HeroInput } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroStateMachine } from './HeroStateMachine';

export class HeroController implements Combatant {
  readonly id = 'hero';
  readonly team = 'hero' as const;
  readonly radius = 0.5;
  readonly model = new Group();
  readonly position = new Vector3();
  readonly facing = new Vector3(0, 0, -1);
  readonly machine = new HeroStateMachine();
  readonly body: Body;
  stats: CharacterStats;
  hp: number;
  mana: number;
  mounted = false;
  private classDef: ClassDefinition;
  private torso = new Group();
  private head = new Group();
  private leftArm = new Group();
  private rightArm = new Group();
  private leftLeg = new Group();
  private rightLeg = new Group();
  private weapon = new Group();
  private cape!: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private armorMaterial: MeshStandardMaterial;
  private accentMaterial: MeshStandardMaterial;
  private time = 0;
  private attackTime = 0;
  private hurtTime = 0;
  private cameraYaw = 0;
  private cameraPitch = 0.48;
  private cameraTarget = new Vector3();
  private cameraInitialized = false;
  private moveDirection = new Vector3();
  private impulse = new Vector3();
  private dashDirection = new Vector3(0, 0, -1);
  private surface: ReturnType<PhysicsWorld['surfaceAt']>;
  private disposers: Array<() => void> = [];

  constructor(
    private scene: Scene,
    private camera: PerspectiveCamera,
    private physics: PhysicsWorld,
    private events: EventBus,
    classDef: ClassDefinition,
  ) {
    this.classDef = classDef;
    this.stats = { ...classDef.stats };
    this.hp = this.stats.maxHp;
    this.mana = this.stats.maxMana;
    const start = new Vector3(0, physics.terrainHeight(0, 18) + this.radius + 0.2, 18);
    this.body = physics.createCharacter(start, this.radius);
    // Cannon clears forces after each fixed substep, not after each render frame.
    // Apply buoyancy/climb assistance here so 120 Hz screens and hitstop cannot
    // accumulate several frames of upward force before the next physics step.
    const assistGravity = () => {
      if (this.alive && ['swim', 'dive', 'climb'].includes(this.machine.state)) {
        this.body.force.y += this.body.mass * 18;
      }
    };
    this.physics.world.addEventListener('preStep', assistGravity);
    this.disposers.push(() => this.physics.world.removeEventListener('preStep', assistGravity));
    this.position.copy(start);
    this.surface = physics.surfaceAt(start);
    this.armorMaterial = new MeshStandardMaterial({ color: 0x263944, metalness: 0.76, roughness: 0.31 });
    this.accentMaterial = new MeshStandardMaterial({ color: classDef.color, metalness: 0.32, roughness: 0.42, emissive: classDef.color, emissiveIntensity: 0.14 });
    this.buildCharacter();
    this.buildWeapon();
    this.scene.add(this.model);
    this.disposers.push(this.events.on('respawn', () => this.respawn(new Vector3(0, this.physics.terrainHeight(0, 18) + 0.8, 18))));
  }

  get maxHp(): number { return this.stats.maxHp; }
  get defense(): number { return this.stats.defense; }
  get alive(): boolean { return this.hp > 0; }
  get invulnerable(): boolean { return this.machine.invulnerable || this.hurtTime > 0 || !this.alive; }

  private box(parent: Group, dimensions: [number, number, number], position: [number, number, number], material: MeshStandardMaterial): Mesh {
    const mesh = new Mesh(new BoxGeometry(...dimensions), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildCharacter(): void {
    const leather = new MeshStandardMaterial({ color: 0x252b29, roughness: 0.88 });
    const skin = new MeshStandardMaterial({ color: 0xbd9874, roughness: 0.8 });
    const steel = new MeshStandardMaterial({ color: 0x9bb2b4, metalness: 0.86, roughness: 0.24 });
    const gold = new MeshStandardMaterial({ color: 0xc9a45d, metalness: 0.8, roughness: 0.32 });
    this.torso.position.y = 1.21;
    this.model.add(this.torso);
    const chest = new Mesh(new CapsuleGeometry(0.29, 0.32, 5, 10), this.armorMaterial);
    chest.scale.set(1.05, 1, 0.68);
    chest.castShadow = true;
    this.torso.add(chest);
    this.box(this.torso, [0.5, 0.1, 0.38], [0, -0.3, 0], leather);
    this.box(this.torso, [0.13, 0.11, 0.04], [0, -0.3, 0.21], gold);
    this.box(this.torso, [0.06, 0.49, 0.04], [0, 0.015, 0.23], gold);
    const crest = new Mesh(new TorusGeometry(0.09, 0.024, 6, 14), gold);
    crest.position.set(0, 0.05, 0.24);
    this.torso.add(crest);
    this.head.position.y = 0.52;
    this.torso.add(this.head);
    const face = new Mesh(new SphereGeometry(0.2, 12, 10), skin);
    face.scale.set(0.85, 1.05, 0.88);
    face.castShadow = true;
    this.head.add(face);
    const helm = new Mesh(new SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.59), this.armorMaterial);
    helm.position.y = 0.03;
    helm.castShadow = true;
    this.head.add(helm);
    this.box(this.head, [0.34, 0.055, 0.075], [0, 0.015, 0.16], this.armorMaterial);
    this.box(this.head, [0.025, 0.16, 0.04], [0, -0.055, 0.19], gold);
    this.box(this.head, [0.044, 0.025, 0.02], [-0.075, -0.012, 0.177], this.accentMaterial);
    this.box(this.head, [0.044, 0.025, 0.02], [0.075, -0.012, 0.177], this.accentMaterial);
    this.leftArm.position.set(-0.4, 0.18, 0);
    this.rightArm.position.set(0.4, 0.18, 0);
    this.torso.add(this.leftArm, this.rightArm);
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      this.box(arm, [0.21, 0.23, 0.29], [side * 0.015, -0.025, 0], this.armorMaterial);
      this.box(arm, [0.14, 0.28, 0.15], [0, -0.26, 0], leather);
      this.box(arm, [0.18, 0.2, 0.2], [0, -0.46, 0.02], steel);
      this.box(arm, [0.13, 0.13, 0.14], [0, -0.58, 0.035], leather);
      this.box(arm, [0.22, 0.045, 0.3], [side * 0.02, 0.1, 0], gold);
    }
    this.leftLeg.position.set(-0.16, 0.87, 0);
    this.rightLeg.position.set(0.16, 0.87, 0);
    this.model.add(this.leftLeg, this.rightLeg);
    for (const leg of [this.leftLeg, this.rightLeg]) {
      this.box(leg, [0.21, 0.37, 0.22], [0, -0.18, 0], leather);
      this.box(leg, [0.23, 0.16, 0.14], [0, -0.38, 0.1], this.armorMaterial);
      this.box(leg, [0.21, 0.29, 0.22], [0, -0.52, 0], steel);
      this.box(leg, [0.23, 0.17, 0.36], [0, -0.74, 0.06], leather);
    }
    const capeGeometry = new PlaneGeometry(0.66, 0.94, 5, 9);
    this.cape = new Mesh(capeGeometry, new MeshStandardMaterial({ color: this.classDef.color, roughness: 0.9, side: DoubleSide }));
    this.cape.position.set(0, -0.14, -0.23);
    this.cape.rotation.x = 0.12;
    this.cape.castShadow = true;
    this.torso.add(this.cape);
    this.rightArm.add(this.weapon);
    this.weapon.position.set(0, -0.61, 0.04);
    this.model.rotation.y = Math.PI;
  }

  private buildWeapon(): void {
    const previousMaterials = new Set<MeshStandardMaterial>();
    this.weapon.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material !== this.accentMaterial) previousMaterials.add(material as MeshStandardMaterial);
        }
      }
    });
    previousMaterials.forEach(material => material.dispose());
    this.weapon.clear();
    const steel = new MeshStandardMaterial({ color: 0xb3c4cc, metalness: 0.9, roughness: 0.22 });
    const wood = new MeshStandardMaterial({ color: 0x553822, roughness: 0.8 });
    const gold = new MeshStandardMaterial({ color: 0xd4a75c, metalness: 0.8, roughness: 0.34 });
    const shaft = (length: number, radius: number, material = wood, y = 0) => {
      const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 8), material);
      mesh.position.y = y;
      mesh.castShadow = true;
      this.weapon.add(mesh);
      return mesh;
    };
    const blade = (width: number, length: number, y: number) => this.box(this.weapon, [width, length, 0.065], [0, y, 0], steel);
    switch (this.classDef.weapon) {
      case 'axe':
        shaft(1.22, 0.038, wood, 0.32);
        blade(0.56, 0.34, 0.85).rotation.z = -0.15;
        this.box(this.weapon, [0.5, 0.07, 0.09], [0, 0.66, 0], gold);
        break;
      case 'sword':
        shaft(0.29, 0.04, wood, 0.02);
        blade(0.12, 0.88, 0.58);
        this.box(this.weapon, [0.38, 0.06, 0.085], [0, 0.16, 0], gold);
        break;
      case 'daggers':
        shaft(0.21, 0.035, wood);
        blade(0.11, 0.43, 0.28).rotation.z = -0.1;
        this.box(this.weapon, [0.25, 0.045, 0.08], [0, 0.09, 0], gold);
        {
          const second = new Mesh(new ConeGeometry(0.075, 0.43, 4), steel);
          second.position.set(-0.75, 0.28, 0);
          second.castShadow = true;
          this.weapon.add(second);
        }
        break;
      case 'bow': {
        const bow = new Mesh(new TorusGeometry(0.45, 0.035, 6, 20, Math.PI), wood);
        bow.rotation.z = -Math.PI / 2;
        bow.position.y = 0.3;
        this.weapon.add(bow);
        shaft(0.9, 0.007, steel, 0.3);
        break;
      }
      case 'staff':
      case 'orb': {
        shaft(this.classDef.weapon === 'orb' ? 0.62 : 1.65, 0.03, wood, 0.45);
        const orb = new Mesh(new SphereGeometry(this.classDef.weapon === 'orb' ? 0.19 : 0.13, 12, 10), this.accentMaterial);
        orb.position.y = this.classDef.weapon === 'orb' ? 0.92 : 1.32;
        this.weapon.add(orb);
        const ring = new Mesh(new TorusGeometry(0.2, 0.022, 5, 16), gold);
        ring.position.copy(orb.position);
        this.weapon.add(ring);
        break;
      }
      case 'scythe':
        shaft(1.65, 0.035, wood, 0.45);
        blade(0.65, 0.13, 1.2).rotation.z = -0.4;
        break;
      case 'fists':
        this.box(this.weapon, [0.24, 0.23, 0.25], [0, 0.03, 0], gold);
        this.box(this.weapon, [0.24, 0.23, 0.25], [-0.8, 0.03, 0], gold);
        break;
      case 'lance': {
        shaft(2.05, 0.032, wood, 0.45);
        const tip = new Mesh(new ConeGeometry(0.11, 0.47, 4), steel);
        tip.position.y = 1.7;
        tip.castShadow = true;
        this.weapon.add(tip);
        this.box(this.weapon, [0.28, 0.05, 0.08], [0, 1.46, 0], gold);
        break;
      }
    }
    this.weapon.rotation.set(0.35, 0, -0.15);
  }

  setClass(definition: ClassDefinition): void {
    const hpRatio = this.hp / this.stats.maxHp;
    const manaRatio = this.mana / this.stats.maxMana;
    this.classDef = definition;
    this.stats = { ...definition.stats };
    this.hp = this.alive ? Math.max(1, this.stats.maxHp * hpRatio) : 0;
    this.mana = this.stats.maxMana * manaRatio;
    this.accentMaterial.color.setHex(definition.color);
    this.accentMaterial.emissive.setHex(definition.color);
    this.cape.material.color.setHex(definition.color);
    this.buildWeapon();
  }

  setStats(stats: CharacterStats): void {
    const wasAlive = this.alive;
    const hpRatio = this.hp / this.stats.maxHp;
    const manaRatio = this.mana / this.stats.maxMana;
    this.stats = { ...stats };
    this.hp = wasAlive ? MathUtils.clamp(stats.maxHp * hpRatio, 1, stats.maxHp) : 0;
    this.mana = MathUtils.clamp(stats.maxMana * manaRatio, 0, stats.maxMana);
  }

  consumeMana(amount: number): boolean {
    if (amount < 0 || !Number.isFinite(amount) || this.mana < amount || !this.alive) return false;
    this.mana -= amount;
    return true;
  }

  heal(amount: number): void {
    if (this.alive && Number.isFinite(amount)) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount));
  }

  receiveDamage(amount: number, knockback?: Vector3): number {
    if (this.invulnerable || !Number.isFinite(amount) || amount <= 0) return 0;
    const dealt = Math.min(this.hp, amount);
    this.hp -= dealt;
    this.hurtTime = 0.3;
    if (knockback) {
      this.impulse.add(knockback);
      this.body.velocity.y += knockback.y;
    }
    if (!this.alive) {
      this.machine.transition('dead');
      this.mounted = false;
      this.events.emit('message', { text: 'Você caiu. Renasça na vila para continuar a jornada.', tone: 'warning' });
    }
    return dealt;
  }

  respawn(point: Vector3): void {
    const center = point.clone();
    center.y = Math.max(center.y, this.physics.terrainHeight(point.x, point.z) + this.radius + 0.2);
    this.body.position.set(center.x, center.y, center.z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.wakeUp();
    this.position.copy(center);
    this.hp = this.maxHp;
    this.mana = this.stats.maxMana;
    this.impulse.set(0, 0, 0);
    this.hurtTime = 1.5;
    this.mounted = false;
    this.machine.reset();
    this.cameraInitialized = false;
  }

  update(dt: number, input: HeroInput): void {
    dt = Math.max(0, Math.min(dt, 0.05));
    this.time += dt;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackTime = Math.max(0, this.attackTime - dt);
    this.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.surface = this.physics.surfaceAt(this.position);
    this.cameraYaw -= input.look.x;
    this.cameraPitch = MathUtils.clamp(this.cameraPitch + input.look.y, 0.18, 1.15);
    const movementLength = Math.min(1, Math.hypot(input.move.x, input.move.y));
    const forward = new Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    this.moveDirection.copy(right).multiplyScalar(input.move.x).addScaledVector(forward, input.move.y);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
    const wantsClimb = this.surface.canClimb && movementLength > 0.15 && !this.mounted && this.body.velocity.y > -7 && this.moveDirection.dot(this.surface.wallNormal) < -0.15;
    this.machine.update(dt, {
      grounded: this.surface.grounded,
      moving: movementLength > 0.08,
      inWater: this.surface.inWater && !(this.machine.state === 'jump' && this.body.velocity.y > 0.8),
      canClimb: this.surface.canClimb,
      climbing: wantsClimb,
      verticalVelocity: this.body.velocity.y,
      mounted: this.mounted,
      dead: !this.alive,
      dive: input.dive,
    });
    if (this.alive) {
      this.mana = Math.min(this.stats.maxMana, this.mana + dt * (this.machine.state === 'idle' ? 5 : 2.7));
      if (input.jump && this.machine.tryJump()) {
        this.body.velocity.y = this.machine.jumpCount === 2 ? 7.8 : 8.4;
        if (this.surface.canClimb) this.impulse.addScaledVector(this.surface.wallNormal, 4.5);
      }
      if (input.dash && this.machine.tryDash()) {
        this.dashDirection.copy(movementLength > 0.08 ? this.moveDirection : this.facing).normalize();
      }
      let speed = this.stats.speed * (this.mounted ? 1.85 : 1);
      if (this.machine.state === 'swim' || this.machine.state === 'dive') {
        speed *= 0.68;
        const targetY = input.dive ? this.physics.waterLevel - 2.1 : this.physics.waterLevel - 0.12;
        const vertical = MathUtils.clamp((targetY - this.position.y) * 4.6, -3, 4);
        this.body.velocity.y = MathUtils.lerp(this.body.velocity.y, vertical, 1 - Math.exp(-dt * 6));
      } else if (this.machine.state === 'climb') {
        this.body.velocity.y = 3.5;
        speed = 0.9;
        this.body.velocity.x = -this.surface.wallNormal.x * 1.2;
        this.body.velocity.z = -this.surface.wallNormal.z * 1.2;
      }
      if (this.machine.state === 'slide') {
        speed *= this.surface.onSlide ? 3.8 : 3.1;
        this.moveDirection.copy(this.dashDirection);
      }
      if (this.machine.state !== 'climb') {
        const blend = 1 - Math.exp(-dt * (this.surface.grounded ? 18 : 7));
        this.body.velocity.x = MathUtils.lerp(this.body.velocity.x, this.moveDirection.x * speed + this.impulse.x, blend);
        this.body.velocity.z = MathUtils.lerp(this.body.velocity.z, this.moveDirection.z * speed + this.impulse.z, blend);
      }
      this.impulse.multiplyScalar(Math.exp(-dt * 5));
      if (movementLength > 0.08 || this.machine.state === 'slide') this.facing.lerp(this.moveDirection.clone().normalize(), 1 - Math.exp(-dt * 16)).normalize();
      if ((input.attack || input.skill !== null) && this.attackTime <= 0) this.attackTime = 0.35;
    } else {
      this.body.velocity.x *= Math.exp(-dt * 8);
      this.body.velocity.z *= Math.exp(-dt * 8);
    }
    if (Math.abs(this.position.x) > 153 || Math.abs(this.position.z) > 153 || this.position.y < -25) {
      this.respawn(new Vector3(0, this.physics.terrainHeight(0, 18) + 1, 18));
      this.events.emit('message', { text: 'As brumas devolvem você à vila.', tone: 'info' });
    }
    this.animate(dt, movementLength);
    this.updateCamera(dt);
  }

  private animate(dt: number, movement: number): void {
    const state = this.machine.state;
    const running = state === 'run' || state === 'mounted';
    const gait = this.time * (this.mounted ? 15 : 11);
    const stride = running ? Math.sin(gait) * 0.72 * movement : 0;
    this.model.position.copy(this.position);
    this.model.position.y -= this.radius;
    this.model.position.y += this.mounted ? 1.15 + Math.sin(gait * 2) * 0.04 : (running ? Math.abs(Math.sin(gait)) * 0.06 : 0);
    const targetRotation = Math.atan2(this.facing.x, this.facing.z);
    this.model.rotation.y += Math.atan2(Math.sin(targetRotation - this.model.rotation.y), Math.cos(targetRotation - this.model.rotation.y)) * (1 - Math.exp(-dt * 16));
    this.model.rotation.z = MathUtils.damp(this.model.rotation.z, state === 'dead' ? -1.4 : 0, 7, dt);
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.set(-stride * 0.75, 0, -0.1);
    this.rightArm.rotation.set(stride * 0.75, 0, 0.1);
    this.torso.rotation.set(0, 0, 0);
    this.torso.position.y = 1.21;
    this.head.rotation.y = Math.sin(this.time * 0.7) * 0.08;
    if (state === 'jump' || state === 'doubleJump' || state === 'fall') {
      this.leftLeg.rotation.x = -0.75;
      this.rightLeg.rotation.x = 0.35;
      this.leftArm.rotation.z = -0.65;
      this.rightArm.rotation.z = 0.65;
      if (state === 'doubleJump') this.torso.rotation.x = Math.sin(this.machine.stateTime * 11) * 0.25;
    }
    if (state === 'climb') {
      this.leftArm.rotation.x = -2.4 + Math.sin(gait) * 0.55;
      this.rightArm.rotation.x = -2.4 - Math.sin(gait) * 0.55;
      this.leftLeg.rotation.x = Math.sin(gait) * 0.8;
      this.rightLeg.rotation.x = -Math.sin(gait) * 0.8;
    }
    if (state === 'swim' || state === 'dive') {
      this.torso.rotation.x = -0.75;
      this.leftArm.rotation.x = Math.sin(this.time * 5) * 1.3 - 1;
      this.rightArm.rotation.x = -Math.sin(this.time * 5) * 1.3 - 1;
      this.leftLeg.rotation.x = Math.sin(this.time * 7) * 0.35;
      this.rightLeg.rotation.x = -Math.sin(this.time * 7) * 0.35;
    }
    if (state === 'slide') {
      this.torso.position.y = 0.75;
      this.torso.rotation.x = -0.85;
      this.leftLeg.rotation.x = -1.1;
      this.rightLeg.rotation.x = 0.5;
      this.model.position.y -= 0.12;
    }
    if (this.mounted) {
      this.leftLeg.rotation.set(-0.85, 0, -0.3);
      this.rightLeg.rotation.set(-0.85, 0, 0.3);
      this.leftArm.rotation.x = -0.85;
      this.rightArm.rotation.x = -0.85;
    } else {
      this.leftLeg.rotation.z = this.rightLeg.rotation.z = 0;
    }
    if (this.attackTime > 0) {
      const swing = 1 - this.attackTime / 0.35;
      this.rightArm.rotation.x = -1.2 + Math.sin(swing * Math.PI) * 2.4;
      this.rightArm.rotation.z = -0.9 + swing * 1.6;
      this.torso.rotation.y = Math.sin(swing * Math.PI) * -0.55;
    }
    this.armorMaterial.emissive.setHex(this.hurtTime > 0 && this.alive ? 0x8f2020 : 0x000000);
    this.armorMaterial.emissiveIntensity = this.hurtTime > 0 ? 0.5 : 0;
    const points = this.cape.geometry.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i);
      const y = points.getY(i);
      const weight = (0.47 - y) / 0.94;
      points.setZ(i, -weight * (0.12 + movement * 0.35) + Math.sin(this.time * 7 + y * 5 + x * 3) * weight * 0.06);
    }
    points.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
  }

  private updateCamera(dt: number): void {
    this.cameraTarget.copy(this.position).add(new Vector3(0, this.mounted ? 2.35 : 1.3, 0));
    const distance = this.mounted ? 8.3 : 6.8;
    const desired = new Vector3(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * distance,
      this.cameraTarget.y + Math.sin(this.cameraPitch) * distance,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * distance,
    );
    desired.y = Math.max(desired.y, this.physics.terrainHeight(desired.x, desired.z) + 0.55);
    const safe = this.physics.raycastCamera(this.cameraTarget, desired);
    if (!this.cameraInitialized) {
      this.camera.position.copy(safe);
      this.cameraInitialized = true;
    } else {
      this.camera.position.lerp(safe, 1 - Math.exp(-dt * 9));
    }
    this.camera.lookAt(this.cameraTarget);
  }

  dispose(): void {
    this.disposers.forEach(dispose => dispose());
    this.physics.removeBody(this.body);
    const materials = new Set<MeshStandardMaterial>();
    this.model.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material as MeshStandardMaterial);
      }
    });
    materials.forEach(material => material.dispose());
    this.scene.remove(this.model);
  }
}
