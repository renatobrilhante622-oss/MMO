import type { HeroInput } from '../core/GameTypes';

export interface FarmPosition { x: number; z: number; }
export interface FarmTarget { id: string; alive: boolean; boss: boolean; level: number; position: FarmPosition; }
export interface FarmLoot { id: string; position: FarmPosition; }
export interface FarmContext {
  vip: boolean; enabled: boolean; alive: boolean; inDungeon: boolean; level: number;
  x: number; z: number; hp: number; maxHp: number; mana: number; maxMana: number;
  healthThreshold: number; manaThreshold: number; input: HeroInput;
  /** World units. The scan and activation leash never exceed the 45m simulation radius. */
  radius?: number;
  attackRange?: number;
}
export interface FarmDecision { target: FarmTarget | null; healthPotion: boolean; manaPotion: boolean; stop: boolean; }
export interface FarmStep extends FarmDecision {
  loot: FarmLoot | null;
  destination: FarmPosition | null;
  returning: boolean;
  /** A blocked destination was deferred, allowing the next tick to choose another. */
  stuck: boolean;
}
const distanceSq = (a: FarmPosition, b: FarmPosition): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const finitePosition = (position: FarmPosition): boolean => Number.isFinite(position.x) && Number.isFinite(position.z);
const scanRadius = (context: FarmContext): number => Math.max(4, Math.min(45, context.radius ?? 45));
function eligible(context: FarmContext, target: FarmTarget, origin: FarmPosition, radius: number): boolean {
  return target.alive && !target.boss && Number.isFinite(target.level) && finitePosition(target.position)
    && target.level <= context.level + 3 && target.level >= Math.max(1, context.level - 15)
    && distanceSq(origin, target.position) <= radius * radius;
}

/** Pure O(n) policy; no sorting, allocations per candidate, or changes to player input. */
export function planFarm(context: FarmContext, targets: readonly FarmTarget[]): FarmDecision {
  const input = context.input;
  const manual = Math.hypot(input.move.x, input.move.y) > .2 || input.attack || input.skill !== null
    || input.jump || input.dash || input.mount || input.dive || input.interact;
  const stop = !context.vip || !context.alive || context.inDungeon || manual;
  if (!context.enabled || stop) return { target: null, healthPotion: false, manaPotion: false, stop };
  const origin = { x: context.x, z: context.z }, radius = scanRadius(context);
  let target: FarmTarget | null = null, bestDistance = Infinity;
  for (const candidate of targets) {
    if (!eligible(context, candidate, origin, radius)) continue;
    const distance = distanceSq(origin, candidate.position);
    if (distance < bestDistance) { bestDistance = distance; target = candidate; }
  }
  return {
    target,
    healthPotion: context.hp / Math.max(1, context.maxHp) < context.healthThreshold,
    manaPotion: context.mana / Math.max(1, context.maxMana) < context.manaThreshold,
    stop: false,
  };
}

/**
 * Stateful navigation policy for repeated attack → loot → acquire cycles.
 * It never grants items or damage: runtime combat and proximity pickup remain authoritative.
 */
export class AutoFarmController {
  private anchor: FarmPosition | null = null;
  private targetId = '';
  private clock = 0;
  private navigationKey = '';
  private navigationTime = 0;
  private checkpoint: FarmPosition | null = null;
  private readonly deferred = new Map<string, number>();

  reset(): void {
    this.anchor = null;
    this.targetId = '';
    this.navigationKey = '';
    this.navigationTime = 0;
    this.checkpoint = null;
    this.deferred.clear();
  }

  /** Runtime may immediately defer a failed path instead of retrying it each frame. */
  avoidTarget(key: string, seconds = 8): void {
    this.deferred.set(key, this.clock + Math.max(1, seconds));
    if (key === this.targetId) this.targetId = '';
  }

  update(context: FarmContext, targets: readonly FarmTarget[], drops: readonly FarmLoot[], dt: number): FarmStep {
    this.clock += Math.max(0, Math.min(1, dt));
    const policy = planFarm(context, []);
    const empty: FarmStep = { ...policy, target: null, loot: null, destination: null, returning: false, stuck: false };
    if (!context.enabled || policy.stop) { this.reset(); return empty; }
    const origin = { x: context.x, z: context.z };
    if (!finitePosition(origin)) { this.reset(); return { ...empty, stop: true }; }
    this.anchor ??= { ...origin };
    for (const [id, until] of this.deferred) if (until <= this.clock) this.deferred.delete(id);
    const radius = scanRadius(context);
    const reach = Math.max(2, (context.attackRange ?? 3) * .75);
    let target: FarmTarget | null = null, nearest: FarmTarget | null = null, bestDistance = Infinity;
    for (const candidate of targets) {
      if (this.deferred.has(candidate.id) || !eligible(context, candidate, origin, radius)
        || distanceSq(this.anchor, candidate.position) > radius * radius) continue;
      const distance = distanceSq(origin, candidate.position);
      if (candidate.id === this.targetId) target = candidate;
      if (distance < bestDistance) { nearest = candidate; bestDistance = distance; }
    }
    target ??= nearest;
    // A new melee threat can preempt a distant lock; ordinary nearest-distance changes cannot.
    if (nearest && bestDistance <= (reach + 2) ** 2
      && target && distanceSq(origin, target.position) > (reach + 2) ** 2) target = nearest;
    this.targetId = target?.id ?? '';
    let loot: FarmLoot | null = null, lootDistance = 12 * 12;
    for (const candidate of drops) {
      if (this.deferred.has('loot:' + candidate.id) || !finitePosition(candidate.position)
        || distanceSq(this.anchor, candidate.position) > radius * radius) continue;
      const distance = distanceSq(origin, candidate.position);
      if (distance < lootDistance) { loot = candidate; lootDistance = distance; }
    }
    // Fight an immediate threat before walking toward spoils. Distant enemies cannot starve pickup.
    if (target && distanceSq(origin, target.position) <= (reach + 2) ** 2) loot = null;
    const returning = distanceSq(origin, this.anchor) > radius * radius;
    if (returning) { target = null; loot = null; }
    const destination = returning ? this.anchor : loot?.position ?? target?.position ?? null;
    const key = returning ? 'anchor' : loot ? 'loot:' + loot.id : target?.id ?? '';
    const arrivalRadius = loot ? 1.6 : returning ? 2 : reach;
    const walking = destination && distanceSq(origin, destination) > arrivalRadius ** 2;
    if (!walking || key !== this.navigationKey) {
      this.navigationKey = key;
      this.navigationTime = 0;
      this.checkpoint = { ...origin };
    } else if (this.checkpoint && distanceSq(origin, this.checkpoint) >= .35 ** 2) {
      this.navigationTime = 0;
      this.checkpoint = { ...origin };
    } else {
      this.navigationTime += Math.max(0, Math.min(1, dt));
      if (this.navigationTime >= 2.5 && key !== 'anchor') {
        this.avoidTarget(key);
        this.navigationKey = '';
        this.navigationTime = 0;
        return { ...empty, stuck: true };
      }
    }
    return { ...policy, target: loot || returning ? null : target, loot, destination, returning, stuck: false };
  }
}
