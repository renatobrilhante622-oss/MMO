import { describe, expect, it } from 'vitest';
import { DASH_COOLDOWN, DASH_DISTANCE, DASH_DURATION, HeroStateMachine, type HeroStateContext } from '../src/player/HeroStateMachine';

const context = (overrides: Partial<HeroStateContext> = {}): HeroStateContext => ({
  grounded: true, moving: false, inWater: false, canClimb: false,
  verticalVelocity: 0, mounted: false, dead: false, dive: false, ...overrides,
});

function advance(machine: HeroStateMachine, duration: number): void {
  const steps = Math.round(duration / .01);
  for (let index = 0; index < steps; index++) machine.update(.01, context());
}

describe('bounded dash movement state', () => {
  it('uses 0.22 seconds, 3.5 metres and a three-second cooldown', () => {
    expect(DASH_DURATION).toBe(.22);
    expect(DASH_DISTANCE).toBe(3.5);
    expect(DASH_COOLDOWN).toBe(3);
  });

  it('exits slide immediately after its invulnerability window', () => {
    const machine = new HeroStateMachine();
    expect(machine.tryDash()).toBe(true);
    advance(machine, .21);
    expect(machine.state).toBe('slide');
    expect(machine.invulnerable).toBe(true);
    advance(machine, .01);
    expect(machine.state).toBe('idle');
    expect(machine.invulnerable).toBe(false);
  });

  it('rejects repeated rolls until three seconds have elapsed', () => {
    const machine = new HeroStateMachine();
    expect(machine.tryDash()).toBe(true);
    advance(machine, 2.99);
    expect(machine.tryDash()).toBe(false);
    advance(machine, .01);
    expect(machine.dashCooldown).toBe(0);
    expect(machine.tryDash()).toBe(true);
  });

  it('disallows dash while swimming, diving, climbing or mounted', () => {
    for (const state of ['swim', 'dive', 'climb', 'mounted'] as const) {
      const machine = new HeroStateMachine();
      expect(machine.transition(state)).toBe(true);
      expect(machine.tryDash()).toBe(false);
    }
  });

  it('resets cooldown on respawn', () => {
    const machine = new HeroStateMachine();
    expect(machine.tryDash()).toBe(true);
    advance(machine, .05);
    machine.reset();
    expect(machine.state).toBe('idle');
    expect(machine.dashCooldown).toBe(0);
    expect(machine.tryDash()).toBe(true);
  });
});
