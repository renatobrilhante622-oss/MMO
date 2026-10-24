import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage,
  Group, Mesh, Points, RingGeometry, Scene, ShaderMaterial, Vector3,
} from 'three';
import {withinActorRadius} from '../core/RenderBudget';
import type { SkillDefinition } from '../core/GameTypes';

interface Emission {
  position: Vector3;
  velocity: Vector3;
  color: number;
  life: number;
  size: number;
  gravity?: number;
  drag?: number;
  kind?: number;
}

interface RingEffect {
  mesh: Mesh<RingGeometry, ShaderMaterial>;
  age: number;
  life: number;
  radius: number;
  vertical: boolean;
}

interface BladeTrail {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  age: number;
  life: number;
}

const VERTEX = `
  attribute vec3 velocity;
  attribute vec3 particleColor;
  attribute vec4 timing;
  attribute vec3 behavior;
  uniform float clock;
  uniform float pixelScale;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  varying float vAge;
  void main() {
    float age = max(0.0, clock - timing.x);
    float life = timing.y;
    float progress = clamp(age / max(life, 0.001), 0.0, 1.0);
    float drag = behavior.y;
    float displacement = drag > 0.001 ? (1.0 - exp(-drag * age)) / drag : age;
    vec3 p = position + velocity * displacement;
    p.y += 0.5 * behavior.x * age * age;
    // Arcane motes corkscrew around their initial trajectory entirely on the GPU.
    if (behavior.z > 2.5 && behavior.z < 3.5) {
      p.x += sin(age * 13.0 + timing.w) * age * 0.24;
      p.z += cos(age * 13.0 + timing.w) * age * 0.24;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float envelope = smoothstep(0.0, 0.06, progress) * (1.0 - progress);
    float visible = step(0.0, clock - timing.x) * (1.0 - step(life, age));
    if(length(mv.xyz)>45.)visible=0.0;
    gl_PointSize = clamp(timing.z * pixelScale / max(0.15, -mv.z), 1.0, 72.0) * visible;
    vColor = particleColor;
    vAlpha = envelope * visible;
    vKind = behavior.z;
    vAge = progress;
  }
`;

const FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  varying float vAge;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float radius = length(p);
    if (radius > 1.0) discard;
    float core = exp(-radius * radius * 6.0);
    float glow = pow(max(0.0, 1.0 - radius), 2.0);
    float shape = core + glow * 0.45;
    if (vKind > 0.5 && vKind < 1.5) {
      // Needle-shaped incandescent fragments instead of a uniform circular sprite.
      shape *= exp(-abs(p.x) * 6.0) * (1.0 - abs(p.y));
    } else if (vKind > 1.5 && vKind < 2.5) {
      // Hexagonal ice facets with a bright rim.
      vec2 q = abs(p);
      float hex = max(q.x * 0.866025 + q.y * 0.5, q.y);
      shape = (1.0 - smoothstep(0.69, 0.82, hex)) * (0.3 + smoothstep(0.55, 0.71, hex));
    } else if (vKind > 3.5) {
      // Cross-shaped holy light/star embers.
      shape = max(exp(-abs(p.x) * 22.0), exp(-abs(p.y) * 22.0)) * (1.0 - radius);
    }
    float alpha = min(1.0, shape * vAlpha * 2.0);
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(vColor * (1.0 + core * 2.4) * (1.0 - vAge * 0.3), alpha);
  }
`;

const RING_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = `
  uniform vec3 tint;
  uniform float opacity;
  uniform float progress;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float angle = atan(p.y, p.x);
    float rune = 0.65 + 0.35 * sin(angle * 24.0 + progress * 10.0);
    float radial = length(p);
    float edge = 1.0 - abs(radial - 0.9) * 7.0;
    gl_FragColor = vec4(tint * (1.2 + rune), opacity * max(0.0, edge) * rune);
  }
`;

/** Fixed memory budget. CPU writes spawn data; motion, fade and shape run in GLSL. */
export class ParticleSystem3D {
  readonly root = new Group();
  private readonly capacity = 4096;
  private readonly geometry = new BufferGeometry();
  private readonly origins = new Float32Array(this.capacity * 3);
  private readonly velocities = new Float32Array(this.capacity * 3);
  private readonly colors = new Float32Array(this.capacity * 3);
  private readonly timing = new Float32Array(this.capacity * 4);
  private readonly behaviors = new Float32Array(this.capacity * 3);
  private readonly material: ShaderMaterial;
  private readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly ringGeometry = new RingGeometry(0.82, 1, 64);
  private readonly rings: RingEffect[] = [];
  private readonly trails: BladeTrail[] = [];
  private readonly color = new Color();
  private clock = 0;
  private cursor = 0;
  private dirty = false;
  private density = 1;
  private disposed = false;

  constructor(scene: Scene) {
    this.geometry.setAttribute('position', new BufferAttribute(this.origins, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('velocity', new BufferAttribute(this.velocities, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('particleColor', new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('timing', new BufferAttribute(this.timing, 4).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('behavior', new BufferAttribute(this.behaviors, 3).setUsage(DynamicDrawUsage));
    this.timing.fill(-1000);
    this.material = new ShaderMaterial({
      uniforms: { clock: { value: 0 }, pixelScale: { value: 480 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.root.name = 'GPU combat particles';
    this.root.add(this.points);
    scene.add(this.root);
  }

  setQuality(quality: 'low' | 'high'): void {
    this.density = quality === 'high' ? 1 : 0.45;
  }

  /** Use the render buffer height so point sizes remain stable under dynamic resolution. */
  setViewportHeight(height: number): void {
    this.material.uniforms.pixelScale.value = Math.max(180, Math.min(1400, height * 0.65));
  }

  emit(emission: Emission): void {
    if (this.disposed) return;
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const p = index * 3;
    const t = index * 4;
    this.origins[p] = emission.position.x;
    this.origins[p + 1] = emission.position.y;
    this.origins[p + 2] = emission.position.z;
    this.velocities[p] = emission.velocity.x;
    this.velocities[p + 1] = emission.velocity.y;
    this.velocities[p + 2] = emission.velocity.z;
    this.color.setHex(emission.color);
    this.colors[p] = this.color.r;
    this.colors[p + 1] = this.color.g;
    this.colors[p + 2] = this.color.b;
    this.timing[t] = this.clock;
    this.timing[t + 1] = emission.life;
    this.timing[t + 2] = emission.size;
    this.timing[t + 3] = Math.random() * Math.PI * 2;
    this.behaviors[p] = emission.gravity ?? -5;
    this.behaviors[p + 1] = emission.drag ?? 1;
    this.behaviors[p + 2] = emission.kind ?? 0;
    this.dirty = true;
  }

  burst(position: Vector3, color: number, count = 24, strength = 1, kind = 0): void {
    const budget = Math.max(1, Math.floor(count * this.density));
    for (let i = 0; i < budget; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 4.4) * strength;
      this.emit({
        position,
        velocity: new Vector3(Math.cos(angle) * speed, (1 + Math.random() * 4) * strength, Math.sin(angle) * speed),
        color,
        life: 0.28 + Math.random() * 0.62,
        size: 0.08 + Math.random() * 0.15,
        gravity: kind === 3 ? 0.6 : -7,
        drag: kind === 3 ? 2 : 0.8,
        kind,
      });
    }
  }

  impact(position: Vector3, color: number, critical = false): void {
    this.burst(position, color, critical ? 42 : 18, critical ? 1.5 : 1, 1);
    this.burst(position, 0x9b233c, critical ? 16 : 7, 0.6);
    if (critical) this.shockwave(position, 1.7, 0xffdfa8, 0.25);
  }

  projectile(position: Vector3, velocity: Vector3, color: number, dt: number): void {
    const count = Math.min(10, Math.ceil(dt * 130 * this.density));
    for (let i = 0; i < count; i++) {
      const p = position.clone().addScaledVector(velocity, -Math.random() * dt);
      this.emit({
        position: p,
        velocity: new Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6),
        color,
        life: 0.18 + Math.random() * 0.22,
        size: 0.11 + Math.random() * 0.1,
        gravity: 0,
        drag: 2,
        kind: 3,
      });
    }
  }

  slash(position: Vector3, facing: Vector3, color: number, combo: number): void {
    const segments = 28;
    const positions: number[] = [];
    const uv: number[] = [];
    const indices: number[] = [];
    const yaw = Math.atan2(facing.x, facing.z);
    const radius = combo === 3 ? 2.5 : 1.9;
    const sweep = combo === 3 ? Math.PI * 1.8 : Math.PI * 1.15;
    const tilt = combo === 2 ? -0.55 : 0.35;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = yaw + (t - 0.5) * sweep;
      for (const inner of [0.72, 1]) {
        positions.push(
          position.x + Math.sin(angle) * radius * inner,
          position.y + 1.05 + Math.sin(angle - yaw) * tilt,
          position.z + Math.cos(angle) * radius * inner,
        );
        uv.push(t, inner === 1 ? 1 : 0);
      }
      if (i < segments) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    geometry.setIndex(indices);
    const material = new ShaderMaterial({
      uniforms: { tint: { value: new Color(color) }, progress: { value: 0 } },
      vertexShader: RING_VERTEX,
      fragmentShader: `
        uniform vec3 tint;
        uniform float progress;
        varying vec2 vUv;
        void main() {
          float leading = smoothstep(progress - 0.42, progress, vUv.x);
          float trailing = 1.0 - smoothstep(progress, progress + 0.24, vUv.x);
          float edge = pow(vUv.y, 1.8);
          float fade = 1.0 - smoothstep(0.5, 1.0, progress);
          gl_FragColor = vec4(tint * (1.2 + edge * 2.4), leading * trailing * edge * fade);
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.root.add(mesh);
    this.trails.push({ mesh, age: 0, life: 0.28 });
    while (this.trails.length > 12) this.removeTrail(0);
  }

  shockwave(position: Vector3, radius: number, color: number, life = 0.6, vertical = false): void {
    const material = new ShaderMaterial({
      uniforms: { tint: { value: new Color(color) }, progress: { value: 0 }, opacity: { value: 0.8 } },
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new Mesh(this.ringGeometry, material);
    if (!vertical) mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += 0.12;
    mesh.scale.setScalar(0.01);
    this.root.add(mesh);
    this.rings.push({ mesh, age: 0, life, radius, vertical });
    while (this.rings.length > 32) this.removeRing(0);
  }

  cast(position: Vector3, facing: Vector3, skill: SkillDefinition, index: number): void {
    const origin = position.clone().add(new Vector3(0, 0.7, 0));
    const power = 1 + index * 0.28;
    const kind = skill.damageType === 'ice' ? 2 : skill.damageType === 'holy' ? 4 : skill.damageType === 'arcane' ? 3 : 0;
    this.burst(origin, skill.color, 26 + index * 14, power, kind);
    if (skill.shape === 'circle') {
      this.shockwave(position, skill.radius, skill.color, 0.55 + index * 0.12);
      if (index === 3) this.shockwave(position, skill.radius * 0.72, 0xffffff, 0.8);
    } else if (skill.shape === 'cone') {
      this.slash(position, facing, skill.color, index === 3 ? 3 : 2);
    } else {
      this.shockwave(origin, 1.1 + index * 0.2, skill.color, 0.32, true);
    }
    switch (skill.damageType) {
      case 'fire': this.fire(origin, facing, power); break;
      case 'ice': this.ice(position, Math.max(2, skill.radius), power); break;
      case 'arcane': this.arcane(origin, facing, skill, power); break;
      case 'holy': this.holy(position, skill.radius, power); break;
      case 'poison': this.poison(origin, skill.color, power); break;
      case 'physical': this.physical(origin, facing, skill, power); break;
    }
  }

  private fire(origin: Vector3, facing: Vector3, power: number): void {
    for (let i = 0; i < 46 * this.density * power; i++) {
      const spread = new Vector3((Math.random() - 0.5) * 4, 1.8 + Math.random() * 5, (Math.random() - 0.5) * 4);
      spread.addScaledVector(facing, Math.random() * 5);
      this.emit({ position: origin, velocity: spread, color: i % 3 === 0 ? 0xffe4a0 : 0xff5d16, life: 0.45 + Math.random() * 0.7, size: 0.12 + Math.random() * 0.3, gravity: 3, drag: 2 });
    }
  }

  private ice(origin: Vector3, radius: number, power: number): void {
    for (let i = 0; i < 48 * this.density; i++) {
      const angle = i * 2.399963;
      const r = Math.sqrt(Math.random()) * radius;
      const p = origin.clone().add(new Vector3(Math.cos(angle) * r, 0.1, Math.sin(angle) * r));
      this.emit({ position: p, velocity: new Vector3(Math.cos(angle) * 1.3, 2 + Math.random() * power * 5, Math.sin(angle) * 1.3), color: i % 2 ? 0xa4ddff : 0xe8faff, life: 0.7 + Math.random() * 0.4, size: 0.22 + Math.random() * 0.28, gravity: -8, drag: 0.3, kind: 2 });
    }
  }

  private arcane(origin: Vector3, facing: Vector3, skill: SkillDefinition, power: number): void {
    // Lightning is a chain of jittered GPU point sprites, rather than a solid beam.
    if (skill.id === 'stormwave' || skill.id === 'javelin') {
      for (let branch = 0; branch < 5; branch++) {
        const side = new Vector3(facing.z, 0, -facing.x).multiplyScalar((branch - 2) * 0.32);
        const dir = facing.clone().add(side).normalize();
        for (let i = 0; i < 22; i++) {
          const p = origin.clone().addScaledVector(dir, i * 0.5);
          p.x += (Math.random() - 0.5) * 0.6;
          p.y += (Math.random() - 0.5) * 0.8;
          this.emit({ position: p, velocity: new Vector3(), color: i % 3 ? skill.color : 0xffffff, life: 0.16 + Math.random() * 0.15, size: 0.18, gravity: 0, drag: 0, kind: 4 });
        }
      }
    } else {
      for (let i = 0; i < 64 * this.density; i++) {
        const angle = i * 2.399963;
        const p = origin.clone().add(new Vector3(Math.cos(angle) * 1.4, Math.random() * 1.6, Math.sin(angle) * 1.4));
        this.emit({ position: p, velocity: new Vector3(-Math.sin(angle) * 3, power, Math.cos(angle) * 3), color: skill.color, life: 0.6 + Math.random() * 0.6, size: 0.1 + Math.random() * 0.15, gravity: 0.6, drag: 0.5, kind: 3 });
      }
    }
  }

  private holy(origin: Vector3, radius: number, power: number): void {
    for (let i = 0; i < 48 * this.density * power; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * Math.max(1.5, radius * 0.7);
      this.emit({ position: origin.clone().add(new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r)), velocity: new Vector3(0, 1 + Math.random() * 4, 0), color: i % 3 === 0 ? 0xffffff : 0xffe29d, life: 0.7 + Math.random() * 0.8, size: 0.12 + Math.random() * 0.16, gravity: 0.3, drag: 0.3, kind: 4 });
    }
  }

  private poison(origin: Vector3, color: number, power: number): void {
    for (let i = 0; i < 42 * this.density; i++) {
      const angle = i * 2.399963;
      this.emit({ position: origin, velocity: new Vector3(Math.cos(angle) * power * 3, 0.5 + Math.random() * 2, Math.sin(angle) * power * 3), color, life: 0.9 + Math.random() * 0.7, size: 0.18 + Math.random() * 0.22, gravity: 0.4, drag: 1.4, kind: 3 });
    }
  }

  private physical(origin: Vector3, facing: Vector3, skill: SkillDefinition, power: number): void {
    for (let i = 0; i < 20 * this.density; i++) {
      const velocity = facing.clone().multiplyScalar(4 + Math.random() * power * 3);
      velocity.x += (Math.random() - 0.5) * 6;
      velocity.z += (Math.random() - 0.5) * 6;
      velocity.y = Math.random() * 3;
      this.emit({ position: origin, velocity, color: skill.color, life: 0.25 + Math.random() * 0.25, size: 0.08 + Math.random() * 0.13, gravity: -6, kind: 1 });
    }
  }

  celebration(position: Vector3, mythic = false): void {
    const color = mythic ? 0xff71c9 : 0xffdb80;
    this.shockwave(position, mythic ? 4 : 3, color, 1.4);
    this.holy(position, mythic ? 3 : 2, 2);
    // Stacked particles produce a finite pillar with moving vertical runes.
    for (let i = 0; i < 100 * this.density; i++) {
      const angle = i * 2.399963;
      const height = Math.random() * (mythic ? 8 : 5);
      const r = 0.2 + Math.random() * 0.4;
      this.emit({ position: position.clone().add(new Vector3(Math.cos(angle) * r, height, Math.sin(angle) * r)), velocity: new Vector3(0, 0.8 + Math.random(), 0), color, life: 1.2 + Math.random() * 1.2, size: 0.15 + Math.random() * 0.18, gravity: 0, drag: 0, kind: 4 });
    }
  }

  update(dt: number,camera?:Vector3): void {
    if (this.disposed) return;
    this.clock += Math.max(0, Math.min(dt, 0.1));
    this.material.uniforms.clock.value = this.clock;
    if (this.dirty) {
      for (const key of ['position', 'velocity', 'particleColor', 'timing', 'behavior']) this.geometry.getAttribute(key).needsUpdate = true;
      this.dirty = false;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const effect = this.rings[i];
      effect.age += dt;
      const p = Math.min(1, effect.age / effect.life);
      effect.mesh.visible=!camera||withinActorRadius(effect.mesh.position,camera);
      if(!effect.mesh.visible&&p<1)continue;
      effect.mesh.scale.setScalar(Math.max(0.01, effect.radius * (1 - Math.pow(1 - p, 3))));
      effect.mesh.material.uniforms.progress.value = p;
      effect.mesh.material.uniforms.opacity.value = (1 - p) * 0.85;
      if (p >= 1) this.removeRing(i);
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.age += dt;
      trail.mesh.material.uniforms.progress.value = trail.age / trail.life;
      if (trail.age >= trail.life) this.removeTrail(i);
    }
  }

  private removeRing(index: number): void {
    const ring = this.rings[index];
    ring.mesh.removeFromParent();
    ring.mesh.material.dispose();
    this.rings.splice(index, 1);
  }

  private removeTrail(index: number): void {
    const trail = this.trails[index];
    trail.mesh.removeFromParent();
    trail.mesh.geometry.dispose();
    trail.mesh.material.dispose();
    this.trails.splice(index, 1);
  }

  get diagnostics(): { capacity: number; spawned: number; rings: number; trails: number } {
    return { capacity: this.capacity, spawned: this.cursor, rings: this.rings.length, trails: this.trails.length };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    while (this.rings.length) this.removeRing(0);
    while (this.trails.length) this.removeTrail(0);
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.ringGeometry.dispose();
  }
}
