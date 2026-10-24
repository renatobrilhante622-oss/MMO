import { AdditiveBlending, Color, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, Scene, TorusGeometry, Vector3 } from 'three';
import type { CharacterStats, ClassId, Combatant } from '../core/GameTypes';
import { EventBus } from '../core/GameTypes';
import { calculateDamage, getClass } from './ClassSystem';
import { ParticleSystem3D } from './ParticleSystem3D';

interface Projectile { group: Group; velocity: Vector3; remaining: number; source: Combatant; targets: Combatant[]; stats: CharacterStats; multiplier: number; radius: number; color: number }
type Caster = Combatant & { mana: number; consumeMana(amount: number): boolean; heal(amount: number): void };

export class CombatSystem {
  readonly cooldowns = [0, 0, 0, 0];
  readonly cooldownMax = [1, 1, 1, 1];
  hitstop = 0;
  screenShake = 0;
  combo = 0;
  private attackCooldown = 0;
  private comboWindow = 0;
  readonly particles: ParticleSystem3D;
  private projectiles: Projectile[] = [];
  private materials = new Map<number, MeshBasicMaterial>();
  private projectileGeometry = new IcosahedronGeometry(.3, 1);
  private torusGeometry = new TorusGeometry(.45, .035, 4, 16);

  constructor(private scene: Scene, private events: EventBus) {
    this.particles = new ParticleSystem3D(scene);
  }

  attack(source: Combatant, targets: Combatant[], stats: CharacterStats, facing: Vector3): boolean {
    if (!source.alive || this.attackCooldown > 0) return false;
    this.combo = this.comboWindow > 0 ? (this.combo % 3) + 1 : 1;
    this.comboWindow = 1.5;
    this.attackCooldown = 1 / Math.max(.1, stats.attackSpeed);
    const direction = this.horizontalDirection(facing);
    const multiplier = this.combo === 3 ? 1.65 : 1 + (this.combo - 1) * .15;
    if (stats.range > 8) {
      this.shoot(source, targets, stats, direction, stats.range, .5, multiplier, 0xc2efff);
    } else {
      const range = stats.range + (this.combo === 3 ? .65 : 0);
      this.cone(source, targets, stats, direction, range, this.combo === 3 ? -.1 : .2, multiplier, 0xffd699);
      const center = source.position.clone().addScaledVector(direction, Math.min(1.6, range * .4));
      center.y += .5;
      this.pulse(center, range * .6, 0xffd699, .17);
    }
    this.visualAttack(source, undefined, this.combo);
    if (stats.range <= 8) this.particles.slash(source.position, direction, 0xffd699, this.combo);
    return true;
  }

  cast(index: number, classId: ClassId, source: Caster, targets: Combatant[], stats: CharacterStats, facing: Vector3): boolean {
    const skill = getClass(classId).skills[index];
    if (!skill || !source.alive || this.cooldowns[index] > 0) return false;
    if (!source.consumeMana(skill.mana)) {
      this.events.emit('message', { text: 'Mana insuficiente. Aguarde a regeneração.', tone: 'warning' });
      return false;
    }
    this.cooldowns[index] = skill.cooldown;
    this.cooldownMax[index] = skill.cooldown;
    const direction = this.horizontalDirection(facing);
    if (skill.heal) source.heal(source.maxHp * skill.heal);
    if (skill.shape === 'projectile') this.shoot(source, targets, stats, direction, skill.range, skill.radius, skill.multiplier, skill.color);
    else if (skill.shape === 'cone') {
      this.cone(source, targets, stats, direction, skill.range, Math.cos(Math.min(1.45, Math.atan2(skill.radius, skill.range) + .4)), skill.multiplier, skill.color);
      this.pulse(source.position.clone().addScaledVector(direction, skill.range * .35), skill.range * .55, skill.color, .4);
    } else {
      for (const target of targets) {
        if (this.canHit(source, target) && source.position.distanceTo(target.position) <= skill.radius + target.radius) this.hit(source, target, stats, skill.multiplier, skill.color);
      }
      this.pulse(source.position.clone(), skill.radius, skill.color, .65);
      this.burst(source.position, skill.color, 28);
    }
    this.particles.cast(source.position, direction, skill, index);
    this.visualAttack(source, index, 1);
    this.screenShake = Math.max(this.screenShake, index === 3 ? .24 : .1);
    return true;
  }

  private visualAttack(source: Combatant, index: number | undefined, combo: number): void {
    const animated = source as Combatant & { visualAttack?: (skillIndex?: number, combo?: number) => void };
    animated.visualAttack?.(index, combo);
  }

  private horizontalDirection(direction: Vector3): Vector3 {
    const result = direction.clone().setY(0);
    return result.lengthSq() > .001 ? result.normalize() : result.set(0, 0, -1);
  }

  private canHit(source: Combatant, target: Combatant): boolean { return target.alive && target.team !== source.team && !target.invulnerable; }

  private cone(source: Combatant, targets: Combatant[], stats: CharacterStats, direction: Vector3, range: number, minimumDot: number, multiplier: number, color: number): void {
    for (const target of targets) {
      if (!this.canHit(source, target)) continue;
      const delta = target.position.clone().sub(source.position);
      if (Math.abs(delta.y) > 4 + target.radius) continue;
      delta.y = 0;
      const distance = delta.length();
      if (distance <= range + target.radius && (distance < 1.2 || delta.normalize().dot(direction) >= minimumDot)) this.hit(source, target, stats, multiplier, color);
    }
  }

  private hit(source: Combatant, target: Combatant, stats: CharacterStats, multiplier: number, color: number): void {
    if (!this.canHit(source, target)) return;
    const critical = Math.random() < stats.critChance;
    const modifiers=(source as Combatant & {combatModifiers?:{armorPenetration:number;lifeSteal:number}}).combatModifiers;
    const damage = calculateDamage(stats.attack, target.defense*(1-(modifiers?.armorPenetration??0)), multiplier, critical, stats.critMultiplier);
    const knockback = target.position.clone().sub(source.position).setY(0).normalize().multiplyScalar(multiplier > 2 ? 7 : 3);
    knockback.y = .8;
    const dealt = target.receiveDamage(damage, knockback);
    if (dealt <= 0) return;
    const healer=source as Combatant & {heal?:(amount:number)=>void};
    if(modifiers?.lifeSteal)healer.heal?.(dealt*modifiers.lifeSteal);
    this.events.emit('damage', { position: target.position.clone().add(new Vector3(0, 1.2, 0)), amount: dealt, critical, team: target.team, color });
    this.particles.impact(target.position.clone().add(new Vector3(0, .7, 0)), color, critical);
    this.hitstop = Math.max(this.hitstop, critical ? .065 : .03);
    this.screenShake = Math.max(this.screenShake, critical ? .16 : .055);
  }

  private shoot(source: Combatant, targets: Combatant[], stats: CharacterStats, direction: Vector3, range: number, radius: number, multiplier: number, color: number): void {
    if (this.projectiles.length >= 36) this.removeProjectile(this.projectiles.shift()!);
    const group = new Group();
    const orb = new Mesh(this.projectileGeometry, this.material(color));
    orb.scale.setScalar(Math.max(.6, radius * .55));
    group.add(orb);
    const ring = new Mesh(this.torusGeometry, this.material(color));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.position.copy(source.position).add(new Vector3(0, .6, 0)).addScaledVector(direction, source.radius + .3);
    this.scene.add(group);
    this.projectiles.push({ group, velocity: direction.clone().multiplyScalar(25), remaining: Math.max(1, range), source, targets, stats: { ...stats }, multiplier, radius, color });
  }

  private material(color: number): MeshBasicMaterial {
    let material = this.materials.get(color);
    if (!material) { material = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: .9, blending: AdditiveBlending, depthWrite: false }); this.materials.set(color, material); }
    return material;
  }

  private pulse(position: Vector3, radius: number, color: number, life: number): void {
    this.particles.shockwave(position, radius, color, life);
  }

  private burst(position: Vector3, color: number, count: number): void {
    this.particles.burst(position, color, count);
  }

  update(dt: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.screenShake = Math.max(0, this.screenShake - dt * .7);
    for (let i = 0; i < 4; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const previous = projectile.group.position.clone();
      projectile.group.position.addScaledVector(projectile.velocity, dt);
      const next = projectile.group.position;
      this.particles.projectile(next, projectile.velocity, projectile.color, dt);
      const segment = next.clone().sub(previous);
      projectile.remaining -= segment.length();
      projectile.group.rotation.z += dt * 7;
      let impacted: Combatant | undefined;
      for (const target of projectile.targets) {
        if (!this.canHit(projectile.source, target)) continue;
        const targetCenter = target.position.clone().add(new Vector3(0, .5, 0));
        const along = Math.max(0, Math.min(1, targetCenter.clone().sub(previous).dot(segment) / Math.max(.00001, segment.lengthSq())));
        const closest = previous.clone().addScaledVector(segment, along);
        if (closest.distanceTo(targetCenter) < target.radius + Math.min(projectile.radius, 1.5)) { impacted = target; break; }
      }
      if (impacted) {
        if (projectile.radius > 1.5) {
          const center = impacted.position.clone();
          for (const target of projectile.targets) if (this.canHit(projectile.source, target) && center.distanceTo(target.position) <= projectile.radius + target.radius) this.hit(projectile.source, target, projectile.stats, projectile.multiplier, projectile.color);
          this.pulse(center, projectile.radius, projectile.color, .45);
        } else this.hit(projectile.source, impacted, projectile.stats, projectile.multiplier, projectile.color);
        this.burst(next, projectile.color, 16);
      }
      if (impacted || projectile.remaining <= 0 || !projectile.source.alive) { this.removeProjectile(projectile); this.projectiles.splice(i, 1); }
    }
    this.particles.update(dt);
  }

  private removeProjectile(projectile: Projectile): void { this.scene.remove(projectile.group); }
  resetCooldowns(): void { this.cooldowns.fill(0); this.combo = 0; this.comboWindow = 0; this.attackCooldown = 0; }
  dispose(): void {
    this.particles.dispose();
    for (const p of this.projectiles) this.removeProjectile(p);
    this.materials.forEach(material => material.dispose());
    this.projectileGeometry.dispose(); this.torusGeometry.dispose();
    this.projectiles.length = 0;
  }
}
