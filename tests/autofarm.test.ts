import { describe, expect, it } from 'vitest';
import { emptyInput } from '../src/core/GameTypes';
import { AutoFarmController, planFarm, type FarmContext, type FarmTarget } from '../src/systems/VipAndAutoFarm';

const context = (overrides: Partial<FarmContext> = {}): FarmContext => ({
  vip: true, enabled: true, alive: true, inDungeon: false, level: 10,
  x: 0, z: 0, hp: 30, maxHp: 100, mana: 20, maxMana: 100,
  healthThreshold: .5, manaThreshold: .4, input: emptyInput(), attackRange: 3, ...overrides,
});
const enemy = (id: string, x: number, z = 0): FarmTarget => ({ id, position: { x, z }, level: 10, alive: true, boss: false });

describe('continuous VIP auto-farm', () => {
  it('caps scanning at the simulation radius and excludes invalid, dead and boss targets', () => {
    const targets = [enemy('far', 46), { ...enemy('boss', 1), boss: true }, { ...enemy('dead', 2), alive: false }, enemy('invalid', NaN), enemy('safe', 20)];
    expect(planFarm(context({ radius: 1000 }), targets).target?.id).toBe('safe');
    expect(planFarm(context(), targets.slice(0, -1)).target).toBeNull();
  });

  it('locks a target while it remains valid, then acquires the next living enemy', () => {
    const farm = new AutoFarmController(), first = enemy('first', 10), second = enemy('second', 12);
    expect(farm.update(context(), [first, second], [], .1).target?.id).toBe('first');
    second.position.x = 8;
    expect(farm.update(context(), [first, second], [], .1).target?.id).toBe('first');
    first.alive = false;
    expect(farm.update(context(), [first, second], [], .1).target?.id).toBe('second');
  });

  it('preempts a distant lock to defend against a close threat', () => {
    const farm = new AutoFarmController(), far = enemy('far', 15);
    farm.update(context(), [far], [], .1);
    expect(farm.update(context(), [far, enemy('threat', 2)], [], .1).target?.id).toBe('threat');
  });

  it('walks to nearby real drops between battles and resumes acquisition after pickup', () => {
    const farm = new AutoFarmController(), targets = [enemy('enemy', 20)], loot = { id: 'real-drop', position: { x: 4, z: 0 } };
    const step = farm.update(context(), targets, [loot], .1);
    expect(step.loot?.id).toBe('real-drop');
    expect(step.destination).toEqual(loot.position);
    expect(step.target).toBeNull();
    expect(farm.update(context({ x: 4 }), targets, [], .1).target?.id).toBe('enemy');
    expect(farm.update(context(), [enemy('threat', 2)], [loot], .1).loot).toBeNull();
  });

  it('never attacks while beyond the activation leash and returns to the farming area', () => {
    const farm = new AutoFarmController();
    farm.update(context(), [], [], .1);
    const step = farm.update(context({ x: 48 }), [enemy('drifting', 50)], [], .1);
    expect(step.returning).toBe(true);
    expect(step.target).toBeNull();
    expect(step.destination).toEqual({ x: 0, z: 0 });
  });

  it('defers an unreachable target instead of repeatedly selecting its blocked path', () => {
    const farm = new AutoFarmController(), targets = [enemy('blocked', 10), enemy('reachable', 15)];
    farm.update(context(), targets, [], .1);
    let step = farm.update(context(), targets, [], 1);
    for (let i = 0; i < 2; i++) step = farm.update(context(), targets, [], 1);
    expect(step.stuck).toBe(true);
    expect(farm.update(context(), targets, [], .1).target?.id).toBe('reachable');
  });

  it('does not classify attacking in place as stuck and keeps potion thresholds live', () => {
    const farm = new AutoFarmController();
    for (let i = 0; i < 15; i++) {
      const step = farm.update(context(), [enemy('in-range', 2)], [], 1);
      expect(step.stuck).toBe(false);
      expect(step.healthPotion).toBe(true);
      expect(step.manaPotion).toBe(true);
    }
    const full = farm.update(context({ hp: 100, mana: 100 }), [], [], 1);
    expect(full.healthPotion).toBe(false);
    expect(full.manaPotion).toBe(false);
  });

  it('clears locks and anchors immediately on intentional manual control, expiry, death or dungeon entry', () => {
    for (const override of [
      { input: { ...emptyInput(), dash: true } }, { vip: false }, { alive: false }, { inDungeon: true },
    ]) {
      const farm = new AutoFarmController();
      farm.update(context(), [enemy('old', 10)], [], .1);
      expect(farm.update(context(override), [], [], .1).stop).toBe(true);
      expect(farm.update(context({ x: 100 }), [enemy('new', 105)], [], .1).target?.id).toBe('new');
    }
  });
});
