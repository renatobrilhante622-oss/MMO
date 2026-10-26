import {catalogSkin} from '../player/SkinCatalog';
import {MountTrail} from './MountTrail';
import { MathUtils, Scene, Vector3 } from 'three';

/** Relative to the mount: pet walks 1.8 m laterally, 1.2 m behind. */
export function petFollowPosition(position:Vector3,facing:Vector3,mounted:boolean):Vector3 {
  const forward=facing.clone().setY(0);
  if(forward.lengthSq()<1e-6)forward.set(0,0,1);
  forward.normalize();
  const lateral=new Vector3(forward.z,0,-forward.x);
  const offset=lateral.multiplyScalar(1.8).addScaledVector(forward,-1.2);
  // Keep claws outside the entire mounted animal body, not under its feet.
  if(mounted&&offset.length()<2.4)offset.setLength(2.4);
  return position.clone().add(offset);
}
import { EventBus, type Combatant, type LootDrop } from '../core/GameTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CompanionRig } from './CompanionRig';
import type { Cosmetic } from '../progression/AdventureProgress';
import { HeroController } from '../player/HeroController';

/** A persistent wolf companion and an instantly summonable, articulated stag mount. */
export class PetAndMountSystem {
  private readonly petRig = new CompanionRig(false);
  private readonly mountRig = new CompanionRig(true);
  private readonly trail:MountTrail;
  private mountElement:import('../player/SkinCatalog').SkinElement='steel';
  private appearanceKey = '';
  readonly pet = this.petRig.root;
  readonly mount = this.mountRig.root;
  powerMultiplier=1;
  private petLevel=1;
  setEvolution(pet:number,mount:number):void{this.petLevel=pet;this.mountRig.root.scale.setScalar(1+(mount-1)*.018);this.petRig.root.scale.setScalar(.45*(1+(pet-1)*.025));}
  private time = 0;
  private attackCooldown = 0;
  private lastMountPosition = new Vector3();
  private mountMoving = 0;
  private readonly riderOriginalScale = new Vector3(1,1,1);
  private readonly mountScale = new Vector3();

  constructor(private scene: Scene, private hero: HeroController, private physics: PhysicsWorld, private events: EventBus) {
    this.trail=new MountTrail(scene);
    this.riderOriginalScale.copy(hero.rig.root.scale);
    this.petRig.root.scale.setScalar(.45);
    this.pet.position.copy(petFollowPosition(hero.position,hero.facing,false));
    this.lastMountPosition.copy(hero.position);
    this.scene.add(this.pet, this.mount);
    this.mount.visible = false;
  }

  setAppearances(pet: Cosmetic, mount: Cosmetic): void {
    if(this.appearanceKey===pet.id+'::'+mount.id)return;
    this.appearanceKey=pet.id+'::'+mount.id;
    this.mountElement=catalogSkin(mount.id)?.element??(mount.rarity==='common'?'steel':mount.id.includes('frost')?'frost':mount.id.includes('magma')?'fire':'solar');
    this.petRig.appearance(pet);this.mountRig.appearance(mount);
  }

  /** Attach the rendered hero to the mount's saddle, while physics and camera remain world-space. */
  private syncRider():void {
    const rider=this.hero.rig.root;
    if(this.hero.mounted&&this.hero.alive){
      if(rider.parent!==this.mountRig.saddle)this.mountRig.saddle.add(rider);
      // Seat normalization is relative to the real mount saddle, not world
      // physics; never rewrite imported GLB materials on parent transitions.
      // KayKit's seated animation keeps the torso upright while the feet
      // remain below the saddle surface.
      // KayKit seated animation positions the hips about 0.88 m above its feet.
      // The model's hips now coincide with the true 78%-height saddle anchor.
      rider.position.set(0,-.88,0);
      rider.rotation.set(0,0,0);
      this.mountRig.root.getWorldScale(this.mountScale);
      rider.scale.set(
        this.riderOriginalScale.x/Math.max(.001,this.mountScale.x),
        this.riderOriginalScale.y/Math.max(.001,this.mountScale.y),
        this.riderOriginalScale.z/Math.max(.001,this.mountScale.z),
      );
    }else if(rider.parent!==this.hero.model){
      this.hero.model.add(rider);
      rider.position.set(0,0,0);
      rider.rotation.set(0,0,0);
      rider.scale.copy(this.riderOriginalScale);
    }
  }

  dismount():void {this.trail.clear();this.hero.mounted=false;this.mount.visible=false;this.syncRider();}

  toggleMount(): void {
    if (!this.hero.alive) return;
    if (!this.hero.mounted && ['climb', 'swim', 'dive', 'slide'].includes(this.hero.machine.state)) {
      this.events.emit('message', { text: 'Encontre terra firme para invocar sua montaria.', tone: 'warning' });
      return;
    }
    this.hero.mounted = !this.hero.mounted;
    this.mount.visible = this.hero.mounted;
    if(this.hero.mounted)this.hero.skinShield=Math.max(this.hero.skinShield??0,this.hero.skinCombat?.onMount(this.hero.maxHp)??0);
    this.mount.position.copy(this.hero.position);
    this.mount.position.y-=this.hero.radius;
    this.mount.rotation.y=this.hero.model.rotation.y;
    this.syncRider();
    this.events.emit('message', { text: this.hero.mounted ? 'Montaria invocada · velocidade aumentada' : 'Montaria dispensada', tone: 'info' });
  }

  update(dt: number, enemies: Combatant[], drops: LootDrop[]): void {
    this.time += dt;
    this.trail.update(dt,this.hero.mounted&&this.hero.alive,this.hero.position,this.hero.model.rotation.y,this.mountElement,(x,z)=>this.physics.terrainHeight(x,z));
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
    const follow=petFollowPosition(this.hero.position,this.hero.facing,this.hero.mounted);
    const targetPosition = target ? target.position.clone() : follow;
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
    const mountClearance=this.hero.mounted?Math.max(2.4,this.mountRig.safeFootprintRadius+.45):0;
    if(this.hero.mounted){
      const relative=targetPosition.clone().sub(this.hero.position).setY(0);
      if(relative.lengthSq()<mountClearance*mountClearance){
        if(relative.lengthSq()<.0001)relative.copy(follow).sub(this.hero.position).setY(0);
        targetPosition.copy(this.hero.position).add(relative.setLength(mountClearance));
      }
    }
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
    if (this.pet.position.distanceTo(this.hero.position) > 38)this.pet.position.copy(follow);
    if(this.hero.mounted){
      const relative=this.pet.position.clone().sub(this.hero.position).setY(0);
      if(relative.lengthSq()<(mountClearance-.05)*(mountClearance-.05)){
        if(relative.lengthSq()<.0001)relative.copy(follow).sub(this.hero.position).setY(0);
        this.pet.position.copy(this.hero.position).add(relative.setLength(mountClearance-.05));
      }
    }
    this.pet.position.y = Math.max(this.physics.terrainHeight(this.pet.position.x, this.pet.position.z), this.physics.waterLevel - 0.28);
    // Compact familiars do not overlap the saddle; flying birds hover separately.
    const flying=['phoenix','frostphoenix','dracolich'].includes(this.appearanceKey.split('::')[0]);
    if(flying)this.pet.position.y+=.55+Math.sin(this.time*2.3)*.1;
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
        const drop=drops[i];
        this.events.emit('loot', drop);
        const remaining=drops.indexOf(drop);if(remaining>=0)drops.splice(remaining,1);
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
    this.trail.dispose();
    this.petRig.dispose();
    this.mountRig.dispose();
  }
}
