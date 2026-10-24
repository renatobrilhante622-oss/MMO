import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Body } from 'cannon-es';
import { EventBus, type CharacterStats, type ClassDefinition, type Combatant, type HeroInput } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroStateMachine } from './HeroStateMachine';
import { ArticulatedCharacter } from './ArticulatedCharacter';

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
  combatModifiers={armorPenetration:0,lifeSteal:0};
  mounted = false;
  private classDef: ClassDefinition;
  readonly rig: ArticulatedCharacter;
  private time = 0;
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
    this.rig = new ArticulatedCharacter(classDef);
    this.model.add(this.rig.root);
    this.scene.add(this.model);
    this.disposers.push(this.events.on('respawn', () => this.respawn(new Vector3(0, this.physics.terrainHeight(0, 18) + 0.8, 18))));
  }

  get maxHp(): number { return this.stats.maxHp; }
  get defense(): number { return this.stats.defense; }
  get alive(): boolean { return this.hp > 0; }
  get invulnerable(): boolean { return this.machine.invulnerable || this.hurtTime > 0 || !this.alive; }

  /** Triggered only after CombatSystem accepts an attack or consumes a skill. */
  visualAttack(skillIndex?: number, combo = 1): void {
    if (this.alive) this.rig.attack(skillIndex, combo);
  }

  setClass(definition: ClassDefinition): void {
    const hpRatio = this.hp / this.stats.maxHp;
    const manaRatio = this.mana / this.stats.maxMana;
    this.classDef = definition;
    this.stats = { ...definition.stats };
    this.hp = this.alive ? Math.max(1, this.stats.maxHp * hpRatio) : 0;
    this.mana = this.stats.maxMana * manaRatio;
    this.rig.setClass(definition);
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

  inputToward(point:{x:number;z:number}):{x:number;y:number} {
    const dx=point.x-this.position.x,dz=point.z-this.position.z,length=Math.max(.001,Math.hypot(dx,dz));
    return {x:(dx*Math.cos(this.cameraYaw)-dz*Math.sin(this.cameraYaw))/length,y:(-dx*Math.sin(this.cameraYaw)-dz*Math.cos(this.cameraYaw))/length};
  }
  teleportTo(point:Vector3):void {
    if(!this.alive)return;
    this.body.position.set(point.x,point.y,point.z);this.body.previousPosition.copy(this.body.position);this.body.interpolatedPosition.copy(this.body.position);this.body.velocity.setZero();this.body.angularVelocity.setZero();this.position.copy(point);this.body.aabbNeedsUpdate=true;this.body.wakeUp();this.mounted=false;this.cameraInitialized=false;
  }
  setAppearance(color:number,refine:number,weaponColor=color,rarity:string='common'):void {
    this.rig.accent.color.setHex(color);this.rig.accent.emissive.setHex(color);this.rig.accent.emissiveIntensity=.15+Math.min(15,refine)*.08;
    this.rig.weaponAppearance(weaponColor,refine,rarity);
  }

  update(dt: number, input: HeroInput): void {
    dt = Math.max(0, Math.min(dt, 0.05));
    this.time += dt;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
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
    this.model.position.copy(this.position);
    this.model.position.y -= this.radius;
    const targetRotation = Math.atan2(this.facing.x, this.facing.z);
    const delta = Math.atan2(Math.sin(targetRotation - this.model.rotation.y), Math.cos(targetRotation - this.model.rotation.y));
    this.model.rotation.y += delta * (1 - Math.exp(-dt * 16));
    this.rig.update(dt, this.time, this.machine.state, movement, this.model.rotation.y, this.hurtTime);
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
    this.rig.dispose();
    this.scene.remove(this.model);
  }
}
