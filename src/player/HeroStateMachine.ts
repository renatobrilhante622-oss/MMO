import type { HeroState } from '../core/GameTypes';

export interface HeroStateContext {
  grounded: boolean;
  moving: boolean;
  inWater: boolean;
  canClimb: boolean;
  verticalVelocity: number;
  mounted: boolean;
  dead: boolean;
  dive: boolean;
  climbing?: boolean;
}

/** Deterministic movement rules, independent of rendering, input devices and physics. */
export class HeroStateMachine {
  state: HeroState = 'idle';
  jumpCount = 0;
  dashCooldown = 0;
  stateTime = 0;
  private grounded = true;
  private coyoteTime = 0.12;

  get canJump(): boolean {
    return this.state !== 'dead' && this.state !== 'slide' && this.jumpCount < 2;
  }

  get invulnerable(): boolean {
    return this.state === 'slide' && this.stateTime < 0.3;
  }

  transition(next: HeroState): boolean {
    if (this.state === 'dead' || this.state === next) return false;
    this.state = next;
    this.stateTime = 0;
    return true;
  }

  tryJump(): boolean {
    if (!this.canJump) return false;
    if (this.state === 'swim' || this.state === 'dive' || this.state === 'climb') {
      this.jumpCount = 1;
    } else {
      // Walking off a ledge consumes the ground jump after the coyote window.
      if (!this.grounded && this.coyoteTime <= 0 && this.jumpCount === 0) this.jumpCount = 1;
      if (this.jumpCount >= 2) return false;
      this.jumpCount++;
    }
    this.transition(this.jumpCount === 1 ? 'jump' : 'doubleJump');
    this.grounded = false;
    this.coyoteTime = 0;
    return true;
  }

  tryDash(): boolean {
    if (this.dashCooldown > 0 || ['dead', 'mounted', 'climb', 'slide'].includes(this.state)) return false;
    this.dashCooldown = 0.9;
    this.transition('slide');
    return true;
  }

  update(dt: number, context: HeroStateContext): HeroState {
    const elapsed = Math.max(0, Math.min(dt, 0.1));
    this.stateTime += elapsed;
    this.dashCooldown = Math.max(0, this.dashCooldown - elapsed);
    if (context.dead || this.state === 'dead') {
      this.transition('dead');
      return this.state;
    }
    this.grounded = context.grounded && context.verticalVelocity <= 0.8;
    this.coyoteTime = this.grounded ? 0.12 : Math.max(0, this.coyoteTime - elapsed);
    if (this.grounded) this.jumpCount = 0;
    if (this.state === 'slide' && this.stateTime < 0.38) return this.state;
    if (context.inWater) {
      this.jumpCount = 0;
      this.transition(context.dive ? 'dive' : 'swim');
    } else if (context.canClimb && context.climbing && !context.mounted) {
      this.jumpCount = 0;
      this.transition('climb');
    } else if (context.mounted && this.grounded) {
      this.transition('mounted');
    } else if (!this.grounded) {
      if (context.verticalVelocity < -0.8) this.transition('fall');
      else if (this.state !== 'jump' && this.state !== 'doubleJump') this.transition('jump');
    } else {
      this.transition(context.moving ? 'run' : 'idle');
    }
    return this.state;
  }

  reset(): void {
    this.state = 'idle';
    this.jumpCount = 0;
    this.dashCooldown = 0;
    this.stateTime = 0;
    this.grounded = true;
    this.coyoteTime = 0.12;
  }
}
