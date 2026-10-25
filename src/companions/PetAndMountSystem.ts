import { MathUtils, Scene, Vector3 } from 'three';
import { EventBus, type Combatant, type LootDrop } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CompanionRig } from './CompanionRig';
import type { Cosmetic } from '../progression/AdventureProgress';
import { HeroController } from '../player/HeroController';

/** A persistent wolf companion and an instantly summonable, articulated stag mount. */
export class PetAndMountSystem {
  private readonly petRig = new CompanionRig(false);
  private readonly mountRig = new CompanionRig(true);
  private appearanceKey = '';
  readonly pet = this.petRig.root;
  readonly mount = this.mountRig.root;
  powerMultiplier=1;
  private petLevel=1;
  setEvolution(pet:number,mount:number):void{this.petLevel=pet;this.mountRig.root.scale.setScalar(1+(mount-1)*.018);this.petRig.root.scale.setScalar(1+(pet-1)*.025);}
  private time = 0;
  private attackCooldown = 0;
  private lastMountPosition = new Vector3();
  private mountMoving = 0;
  private readonly riderOriginalScale = this.hero.rig.root.scale.clone();
  private readonly mountScale = new Vector3();

  constructor(private scene: Scene, private hero: HeroController, private physics: PhysicsWorld, private events: EventBus) {
    this.pet.position.copy(hero.position).add(new Vector3(-2, 0, 1));
    this.lastMountPosition.copy(hero.position);
    this.scene.add(this.pet, this.mount);
    this.mount.visible = false;
  }

  setAppearances(pet: Cosmetic, mount: Cosmetic): void {
    if(this.appearanceKey===pet.id+mount.id)return;
    this.appearanceKey=pet.id+mount.id;
    this.petRig.appearance(pet);this.mountRig.appearance(mount);
  }

  /** Attach the rendered hero to the mount's saddle, while physics and camera remain world-space. */
  private syncRider():void {
    const rider=this.hero.rig.root;
    if(this.hero.mounted&&this.hero.alive){
      if(rider.parent!==this.mountRig.saddle)this.mountRig.saddle.add(rider);
      // Rig pivot starts at the feet. Offset its hips onto the saddle.
      rider.position.set(0,-.75,0);
      this.mountRig.root.getWorldScale(this.mountScale);
      rider.scale.set(
        this.riderOriginalScale.x/Math.max(.001,this.mountScale.x),
        this.riderOriginalScale.y/Math.max(.001,this.mountScale.y),
        this.riderOriginalScale.z/Math.max(.001,this.mountScale.z),
      );
    }else if(rider.parent!==this.hero.model){
      this.hero.model.add(rider);
      rider.position.set(0,0,0);
      rider.scale.copy(this.riderOriginalScale);
    }
  }

  toggleMount(): void {
    if (!this.hero.alive) return;
    if (!this.hero.mounted && ['climb', 'swim', 'dive', 'slide'].includes(this.hero.machine.state)) {
      this.events.emit('message', { text: 'Encontre terra firme para invocar sua montaria.', tone: 'warning' });
      return;
    }
    this.hero.mounted = !this.hero.mounted;
    this.mount.visible = this.hero.mounted;
    this.mount.position.copy(this.hero.position);
    this.mount.position.y-=this.hero.radius;
    this.mount.rotation.y=this.hero.model.rotation.y;
    this.syncRider();
    this.events.emit('message', { text: this.hero.mounted ? 'Montaria invocada · velocidade aumentada' : 'Montaria dispensada', tone: 'info' });
  }

  update(dt: number, enemies: Combatant[], drops: LootDrop[]): void {
    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.mount.visible = this.hero.mounted && this.hero.alive;
    if (this.hero.machine.state === 'swim' || this.hero.machine.state === 'dive' || !this.hero.alive) {
      this.hero.mounted = false;
      this.mount.visible = false;
    }
    this.syncRider();
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
    this.petRig.update(dt, distance > .65 ? speed : 0, this.time, !!target && nearest < 2);
    if (target && nearest < target.radius + 1.15 && this.attackCooldown === 0 && this.hero.alive) {
      this.attackCooldown = 1.1;
      const damage = Math.max(1, Math.round(this.hero.stats.attack * 0.32 * (1+this.petLevel*.06) * this.powerMultiplier * 100 / (100 + target.defense)));
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
      this.mountRig.update(dt, this.mountMoving, this.time);
      this.syncRider();
    }
    this.lastMountPosition.copy(this.hero.position);
  }

  dispose(): void {
    this.hero.mounted=false;
    this.syncRider();
    this.petRig.dispose();
    this.mountRig.dispose();
  }
}
