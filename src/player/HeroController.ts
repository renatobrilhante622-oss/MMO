import type {PvPFighter} from '../combat/PvPTypes';
import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Body } from 'cannon-es';
import { EventBus, type CharacterStats, type ClassDefinition, type Combatant, type HeroInput } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DASH_DISTANCE, DASH_DURATION, HeroStateMachine } from './HeroStateMachine';
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
  godMode=false;
  mountSpeedBoost=0;
  private aimTime=0;
  private aimPoint=new Vector3();
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
  private dashElapsed = 0;
  private dashActive = false;
  private dashWasPressed = false;
  private resetVelocityAfterDash = false;
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
  get invulnerable(): boolean { return this.godMode || this.machine.invulnerable || this.hurtTime > 0 || !this.alive; }

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
      this.cancelDash();
      this.machine.transition('dead');
      this.mounted = false;
      this.events.emit('message', { text: 'Você caiu. Renasça na vila para continuar a jornada.', tone: 'warning' });
    }
    return dealt;
  }

  respawn(point: Vector3): void {
    this.cancelDash();
    this.dashWasPressed = false;
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
    this.cancelDash();
    this.body.position.set(point.x,point.y,point.z);this.body.previousPosition.copy(this.body.position);this.body.interpolatedPosition.copy(this.body.position);this.body.velocity.setZero();this.body.angularVelocity.setZero();this.position.copy(point);this.body.aabbNeedsUpdate=true;this.body.wakeUp();this.mounted=false;this.cameraInitialized=false;
  }
  setAppearance(color:number,refine:number,weaponColor=color,rarity:string='common'):void {
    this.rig.accent.color.setHex(color);this.rig.accent.emissive.setHex(color);this.rig.accent.emissiveIntensity=.15+Math.min(15,refine)*.08;
    this.rig.weaponAppearance(weaponColor,refine,rarity);
  }

  aimAt(point:Vector3,lunge:number):void {
    this.aimPoint.copy(point);this.aimTime=.4;
    if(lunge>0&&lunge<2&&!this.dashActive&&this.machine.state!=='swim'&&this.machine.state!=='dive'&&this.machine.state!=='climb'){
      const d=point.clone().sub(this.position).setY(0).normalize();this.impulse.addScaledVector(d,Math.min(3,lunge*2));
    }
  }
  /** Clear dash velocity when interrupted by teleport, death or mounting. */
  private cancelDash(): void {
    const active = this.dashActive || this.machine.state === 'slide';
    this.dashActive = false;
    this.dashElapsed = 0;
    this.resetVelocityAfterDash = false;
    if (active) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      if (this.machine.state === 'slide') this.machine.transition('idle');
    }
  }

  arenaMovement(input:HeroInput):{x:number;z:number}{
    return {x:Math.cos(this.cameraYaw)*input.move.x-Math.sin(this.cameraYaw)*input.move.y,z:-Math.sin(this.cameraYaw)*input.move.x-Math.cos(this.cameraYaw)*input.move.y};
  }
  /** Snapshot reconciliation bypasses PvE damage, regen, loot and respawn rules. */
  updateArena(dt:number,fighter:PvPFighter,input:HeroInput):void {
    this.time+=dt;this.cameraYaw-=input.look.x;this.cameraPitch=MathUtils.clamp(this.cameraPitch+input.look.y,.18,1.15);
    this.hp=fighter.hp;this.mana=fighter.mana;this.stats.maxHp=fighter.maxHp;this.stats.maxMana=fighter.maxMana;
    const target=new Vector3(fighter.x,3.9,fighter.z);
    this.position.lerp(target,1-Math.exp(-dt*22));this.body.position.set(this.position.x,this.position.y,this.position.z);this.body.velocity.setZero();
    this.facing.set(fighter.facingX,0,fighter.facingZ);this.mounted=false;this.machine.reset();
    this.machine.state=fighter.hp<=0?'dead':fighter.state==='dash'?'slide':fighter.state==='run'?'run':'idle';
    this.animate(dt,fighter.state==='run'?1:0);this.updateCamera(dt);
  }

  update(dt: number, input: HeroInput): void {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
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
      const dashPressed = input.dash && !this.dashWasPressed;
      this.dashWasPressed = input.dash;
      if (dashPressed && !this.dashActive && !this.surface.inWater && this.machine.tryDash()) {
        this.dashDirection.copy(movementLength > 0.08 ? this.moveDirection : this.facing).setY(0);
        if (this.dashDirection.lengthSq() < 0.0001) this.dashDirection.copy(forward);
        this.dashDirection.normalize();
        this.dashElapsed = 0;
        this.dashActive = true;
        this.impulse.x = 0;
        this.impulse.z = 0;
      }
      let speed = this.stats.speed * (this.mounted ? 1.85+this.mountSpeedBoost : 1);
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
      if (this.dashActive && (this.mounted || this.surface.inWater || this.machine.state === 'climb')) {
        this.cancelDash();
      }
      const dashStep = this.dashActive ? Math.min(dt, Math.max(0, DASH_DURATION - this.dashElapsed)) : 0;
      if (dashStep > 0 && dt > 0) {
        const before = this.dashElapsed / DASH_DURATION;
        const after = (this.dashElapsed + dashStep) / DASH_DURATION;
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const metres = DASH_DISTANCE * (smooth(after) - smooth(before));
        const ordinaryFraction = 1 - dashStep / dt;
        this.body.velocity.x = this.dashDirection.x * metres / dt + this.moveDirection.x * speed * ordinaryFraction;
        this.body.velocity.z = this.dashDirection.z * metres / dt + this.moveDirection.z * speed * ordinaryFraction;
        this.dashElapsed += dashStep;
        this.impulse.x = 0;
        this.impulse.z = 0;
        if (this.dashElapsed >= DASH_DURATION - 0.000001) {
          this.dashActive = false;
          this.resetVelocityAfterDash = true;
          if (this.machine.state === 'slide') {
            this.machine.transition(this.surface.grounded ? (movementLength > 0.08 ? 'run' : 'idle') : 'fall');
          }
        }
      } else if (this.machine.state !== 'climb') {
        const desiredX = this.moveDirection.x * speed + this.impulse.x;
        const desiredZ = this.moveDirection.z * speed + this.impulse.z;
        if (this.resetVelocityAfterDash) {
          this.body.velocity.x = desiredX;
          this.body.velocity.z = desiredZ;
          this.resetVelocityAfterDash = false;
        } else {
          const blend = 1 - Math.exp(-dt * (this.surface.grounded ? 18 : 7));
          this.body.velocity.x = MathUtils.lerp(this.body.velocity.x, desiredX, blend);
          this.body.velocity.z = MathUtils.lerp(this.body.velocity.z, desiredZ, blend);
        }
      }
      this.impulse.multiplyScalar(Math.exp(-dt * 5));
      if (this.dashActive || dashStep > 0) this.facing.lerp(this.dashDirection, 1 - Math.exp(-dt * 16)).normalize();
      else if (movementLength > 0.08) this.facing.lerp(this.moveDirection.clone().normalize(), 1 - Math.exp(-dt * 16)).normalize();
    } else {
      this.dashWasPressed = input.dash;
      this.cancelDash();
      this.body.velocity.x *= Math.exp(-dt * 8);
      this.body.velocity.z *= Math.exp(-dt * 8);
    }
    if (Math.abs(this.position.x) > this.physics.terrainExtent+8 || Math.abs(this.position.z) > this.physics.terrainExtent+8 || this.position.y < -25) {
      this.respawn(new Vector3(0, this.physics.terrainHeight(0, 18) + 1, 18));
      this.events.emit('message', { text: 'As brumas devolvem você à vila.', tone: 'info' });
    }
    this.animate(dt, movementLength);
    this.updateCamera(dt);
  }

  private animate(dt: number, movement: number): void {
    this.model.position.copy(this.position);
    this.model.position.y -= this.radius;
    if(this.aimTime>0){this.aimTime=Math.max(0,this.aimTime-dt);const d=this.aimPoint.clone().sub(this.position).setY(0);if(d.lengthSq()>.001)this.facing.lerp(d.normalize(),1-Math.exp(-dt*22)).normalize();}
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
