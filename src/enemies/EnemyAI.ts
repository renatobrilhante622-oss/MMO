import {generateMapPlan,type HuntSpot} from '../world/MapGenerator';
import {mapDefinition} from '../world/maps/MapDefinitions';
import type {ModelName} from '../assets/AnimatedGLB';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, Scene, SphereGeometry, Vector3 } from 'three';
import type { Body } from 'cannon-es';
import type { Combatant } from '../core/GameTypes';
import { EventBus } from '../core/GameTypes';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { calculateDamage } from '../combat/ClassSystem';
import { REGIONS, regionAt, regionalLevel } from '../world/Regions';
import {withinActorRadius} from '../core/RenderBudget';
import {WORLD_SITES} from '../world/WorldSites';
import { CreatureRig } from './CreatureRig';

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
  dormant=false;
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
  private readonly rig: CreatureRig;
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
    if(kind==='slime'&&!boss){this.material.transparent=true;this.material.opacity=.72;this.material.roughness=.14;this.material.metalness=.08;}
    this.rig = new CreatureRig(kind, boss, this.material);
    this.model.add(this.rig.root);this.rig.root.traverse(o=>{if(o instanceof Mesh)o.castShadow=o.receiveShadow=false;});
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

  receiveDamage(amount: number, knockback?: Vector3): number {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    const dealt = Math.min(this.hp, Math.max(1, Math.round(amount)));
    this.material.emissive.setHex(0xffeeee);this.material.emissiveIntensity=2.4;
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

  setBossPresentation(model:ModelName,color:number):void{this.rig.setBossModel(model,color);}
  setActive(active:boolean):void {
    this.model.visible=active;if(active&&this.dormant){this.body.collisionResponse=true;this.body.wakeUp();this.dormant=false;}
    else if(!active&&!this.dormant){this.body.velocity.setZero();this.body.sleep();this.body.collisionResponse=false;this.telegraph.visible=false;this.attackWindup=-1;this.dormant=true;}
  }
  tick(dt: number, hero: Combatant, elapsed: number): void {
    if (!this.alive) {
      this.deathTime += dt; this.model.scale.setScalar(Math.max(.01, 1 - this.deathTime)); this.model.rotation.z += dt * 1.6;
      return;
    }
    this.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.model.position.copy(this.position);
    if (this.kind === 'wraith') this.model.position.y += Math.sin(elapsed * 2 + this.patrolPhase) * .2;
    this.healthGroup.lookAt(hero.position.x, this.model.position.y + this.healthGroup.position.y, hero.position.z);
    this.material.emissive.setHex(this.hitStun>0?0xffaaaa:this.archetype.emissive);
    this.material.emissiveIntensity = this.hitStun > 0 ? 2.4 : .25;
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
    this.rig.update(dt, elapsed + this.patrolPhase, Math.hypot(this.body.velocity.x, this.body.velocity.z), this.state === 'attack', this.attackWindup, this.hitStun);
    if (this.body.position.y < -25) this.receiveDamage(this.hp);
  }

  private move(velocity: Vector3, dt: number): void {
    if (this.hitStun > 0) return;
    const aheadX = this.position.x + velocity.x * .5, aheadZ = this.position.z + velocity.z * .5;
    if (this.physics.terrainHeight(aheadX, aheadZ) < this.physics.waterLevel + .35 || Math.abs(aheadX) > this.physics.terrainExtent || Math.abs(aheadZ) > this.physics.terrainExtent) { this.body.velocity.x = 0; this.body.velocity.z = 0; return; }
    const factor = 1 - Math.exp(-dt * 9);
    this.body.velocity.x += (velocity.x - this.body.velocity.x) * factor;
    this.body.velocity.z += (velocity.z - this.body.velocity.z) * factor;
  }

  private removeBody(): void { if (!this.bodyRemoved) { this.physics.removeBody(this.body); this.bodyRemoved = true; } }
  dispose(): void {
    this.removeBody(); this.scene.remove(this.model, this.telegraph);
    this.rig.dispose(); this.material.dispose();
    this.model.traverse(child => { if (child instanceof Mesh) { child.geometry.dispose(); if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); } });
    this.telegraph.geometry.dispose(); (this.telegraph.material as MeshBasicMaterial).dispose();
  }
}

export class EnemyAI {
  readonly enemies: Enemy[] = [];
  private elapsed = 0;
  private spawnTimer = 4;
  private spawnIndex = 0;
  private bossRespawn: Record<string, number> = {};
  private kinds = ['slime', 'wolf', 'skeleton', 'golem', 'wraith'];
  private activeRegionId:string|null=null;
  private dungeonMode=false;
  readonly zones:Array<{spot:HuntSpot;slots:Array<{enemyId:string|null;readyAt:number}>}>=[];
  setDungeonMode(enabled:boolean):void{this.dungeonMode=enabled;}
  get regionId():string|null{return this.activeRegionId;}
  private regionAtPosition(x:number,z:number){
    return this.activeRegionId?REGIONS.find(region=>region.id===this.activeRegionId)!:regionAt(x,z);
  }
  private levelAtPosition(x:number,z:number){
    const region=this.regionAtPosition(x,z);
    if(!this.activeRegionId)return regionalLevel(x,z);
    const distance=Math.min(1,Math.hypot(x,z-18)/Math.abs(mapDefinition(this.activeRegionId).exit.z));
    return Math.round(region.minLevel+(region.maxLevel-region.minLevel)*distance);
  }
  /** No cross-map actors survive after a successful region swap. */
  resetForRegion(regionId:string):void{
    const region=REGIONS.find(r=>r.id===regionId);
    if(!region)throw new Error('Unknown enemy region: '+regionId);
    this.dispose();
    this.activeRegionId=regionId;
    this.bossRespawn={};
    this.spawnTimer=5;
    this.spawnIndex=0;
    this.dungeonMode=false;this.elapsed=0;
    this.zones.splice(0,this.zones.length,...generateMapPlan(regionId).spots.map(spot=>({spot,slots:Array.from({length:spot.capacity},()=>({enemyId:null,readyAt:0}))})));
    this.populateZones(new Vector3(0,this.physics.terrainHeight(0,18),18));
  }
  constructor(private scene: Scene, private physics: PhysicsWorld, private events: EventBus) {
    const locations: [number, number][] = [[-14, -8], [13, -9], [-24, -18], [22, -25], [9, -34], [-19, -43], [35, -47], [-44, -30], [28, -77], [-32, -82], [58, -52], [-60, -65], [-38, 46], [48, 45]];
    for(const site of WORLD_SITES)for(let i=0;i<3;i++)locations.push([site.x+Math.cos(i*2.094)*12,site.z+Math.sin(i*2.094)*12]);
    locations.forEach(([x, z], i) => {
      const height = physics.terrainHeight(x, z);
      if (height > physics.waterLevel + .5) this.spawn(this.regionAtPosition(x,z).kinds[i % this.regionAtPosition(x,z).kinds.length], new Vector3(x, height + 1.5, z), i<5?1+Math.floor(i/2):this.levelAtPosition(x,z));
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

  /** Slot cooldowns belong to a hunting location, not to the camera or a random spawn ring. */
  private populateZones(hero:Vector3):void {
    if(this.dungeonMode||!this.activeRegionId)return;
    let count=this.enemies.filter(e=>e.alive&&!e.boss).length;
    for(const zone of this.zones){
      for(const slot of zone.slots)if(slot.enemyId){const enemy=this.enemies.find(e=>e.id===slot.enemyId);if(!enemy||!enemy.alive){slot.enemyId=null;slot.readyAt=this.elapsed+zone.spot.respawn;}}
      if(Math.hypot(hero.x-zone.spot.x,hero.z-zone.spot.z)>75)continue;
      for(const [i,slot]of zone.slots.entries()){
        if(slot.enemyId||slot.readyAt>this.elapsed||count>=54)continue;
        for(let attempt=0;attempt<12;attempt++){
          const a=i*2.399963+attempt*.57,r=5+(i%3)*2+attempt*.25,x=zone.spot.x+Math.cos(a)*r,z=zone.spot.z+Math.sin(a)*r;
          if(Math.hypot(x-hero.x,z-hero.z)<5||!this.physics.isPositionFree(x,z,1))continue;
          const enemy=this.spawn(zone.spot.kind,new Vector3(x,this.physics.terrainHeight(x,z)+1.3,z),zone.spot.level);slot.enemyId=enemy.id;count++;break;
        }
      }
    }
  }
  private retireDistant(hero:Vector3):void {
    if(this.dungeonMode)return;
    for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];if(e.boss||!e.alive||Math.hypot(e.position.x-hero.x,e.position.z-hero.z)<115)continue;
      for(const zone of this.zones)for(const slot of zone.slots)if(slot.enemyId===e.id){slot.enemyId=null;slot.readyAt=this.elapsed;}
      e.dispose();this.enemies.splice(i,1);
    }
  }
  update(dt: number, hero: Combatant,camera=hero.position): void {
    this.elapsed += dt;
    this.retireDistant(hero.position);
    this.populateZones(hero.position);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if(enemy.alive){const active=withinActorRadius(enemy.position,camera);enemy.setActive(active);if(!active)continue;}
      enemy.tick(dt, hero, this.elapsed);
      if (!enemy.alive && enemy.deathTime > 1.1) { enemy.dispose(); this.enemies.splice(i, 1); }
    }
    for (const region of (this.dungeonMode?[]:this.activeRegionId?REGIONS.filter(region=>region.id===this.activeRegionId):REGIONS)) {
      const bossX=this.activeRegionId?mapDefinition(this.activeRegionId).boss.x:region.boss.x;
      const bossZ=this.activeRegionId?mapDefinition(this.activeRegionId).boss.z:region.boss.z;
      this.bossRespawn[region.id] = Math.max(0,(this.bossRespawn[region.id] ?? 0)-dt);
      if (hero.position.distanceTo(new Vector3(bossX,hero.position.y,bossZ)) < 55 && this.bossRespawn[region.id] === 0 && !this.enemies.some(e=>e.boss&&e.alive&&Math.hypot(e.home.x-bossX,e.home.z-bossZ)<5)) {
        this.bossRespawn[region.id]=300;
        const x=bossX,z=bossZ;
        const boss=this.spawn('boss',new Vector3(x,this.physics.terrainHeight(x,z)+2,z),region.maxLevel,true);
        const forms:Record<string,ModelName>={aurora:'Creature_wolf',crypt:'KayKit_Skeleton_Warrior',highlands:'Creature_golem',rift:'Quaternius_demon',eclipse:'Creature_dragon'};
        boss.setBossPresentation(forms[region.id],Number.parseInt(region.color.slice(1),16));
      }
    }
    this.spawnTimer -= dt;
    const ambientCount = this.enemies.filter(enemy => !enemy.boss && enemy.alive).length;
    if (!this.activeRegionId && !this.dungeonMode && this.spawnTimer <= 0 && ambientCount < 34 && hero.alive) {
      this.spawnTimer = 8;
      const angle = this.spawnIndex++ * 2.39996;
      const x = hero.position.x + Math.cos(angle) * 28, z = hero.position.z + Math.sin(angle) * 28;
      const y = this.physics.terrainHeight(x, z);
      if (Math.abs(x) < this.physics.terrainExtent && Math.abs(z) < this.physics.terrainExtent && y > this.physics.waterLevel + .5 && (this.activeRegionId!=='eclipse'||y>2) && Math.hypot(x, z - 18) > 28 && Math.hypot(x, z + 70) > 23) this.spawn(this.regionAtPosition(x,z).kinds[this.spawnIndex % this.regionAtPosition(x,z).kinds.length], new Vector3(x, y + 1.5, z), this.levelAtPosition(x,z));
    }
  }

  dispose(): void { this.enemies.forEach(enemy => enemy.dispose()); this.enemies.length = 0;this.zones.length=0; }
}
