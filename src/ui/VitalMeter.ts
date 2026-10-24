/** Smooth foreground and a delayed, independently animated damage/spend trail. */
export class VitalMeter {
  private target = 1;
  private displayed = 1;
  private trail = 1;
  private holdUntil = 0;
  private initialized = false;
  private previousMax = 0;
  private previousValue = 0;
  private lastDisplay = '';
  private lastTrail = '';

  constructor(
    private readonly fill: HTMLElement,
    private readonly residual: HTMLElement,
    private readonly track: HTMLElement,
    private readonly reducedMotion: () => boolean,
  ) {
    this.track.setAttribute('role', 'progressbar');
    this.track.setAttribute('aria-valuemin', '0');
  }

  set(value: number, maximum: number, now: number): void {
    const max = Number.isFinite(maximum) ? Math.max(1, maximum) : 1;
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : 0;
    const ratio = safeValue / max;
    if (!this.initialized || this.previousMax !== max) {
      this.displayed = ratio;
      this.trail = ratio;
      this.initialized = true;
    } else if (safeValue < this.previousValue) {
      // Rapid successive hits hold the complete damage window visible.
      this.trail = Math.max(this.trail, this.displayed);
      this.holdUntil = now + 420;
    } else if (ratio > this.target) {
      this.trail = Math.max(this.trail, ratio);
    }
    this.target = ratio;
    this.previousMax = max;
    this.previousValue = safeValue;
    this.track.setAttribute('aria-valuemax', `${Math.round(max)}`);
    this.track.setAttribute('aria-valuenow', `${Math.round(safeValue)}`);
    this.track.classList.toggle('is-depleted', ratio <= 0);
    this.track.classList.toggle('is-critical', ratio > 0 && ratio < 0.25);
  }

  tick(dt: number, now: number): void {
    if (!this.initialized) return;
    if (this.reducedMotion()) {
      this.displayed = this.target;
      this.trail = this.target;
    } else {
      this.displayed += (this.target - this.displayed) * (1 - Math.exp(-dt * 21));
      if (now > this.holdUntil || this.target > this.trail) {
        this.trail += (this.target - this.trail) * (1 - Math.exp(-dt * 3.8));
      }
      if (Math.abs(this.target - this.displayed) < 0.0002) this.displayed = this.target;
      if (Math.abs(this.target - this.trail) < 0.0002) this.trail = this.target;
    }
    // Scale transforms update composited layers without repeated layout.
    const display = `scaleX(${this.displayed.toFixed(5)})`;
    const residual = `scaleX(${Math.max(this.displayed, this.trail).toFixed(5)})`;
    if (display !== this.lastDisplay) {
      this.fill.style.transform = display;
      this.lastDisplay = display;
    }
    if (residual !== this.lastTrail) {
      this.residual.style.transform = residual;
      this.lastTrail = residual;
    }
  }
}
