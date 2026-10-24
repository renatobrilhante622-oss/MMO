import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Analytic Rayleigh/Mie sky in linear HDR, with local procedural cloud detail.
 * The optical depth approximation is deliberately bounded at the horizon, so it
 * remains stable at mobile precision and at night. Celestial disks are angular,
 * rather than meshes which can accidentally intersect the camera far plane.
 */
export class AtmosphericSky extends Mesh<SphereGeometry, ShaderMaterial> {
  constructor() {
    super(new SphereGeometry(290, 32, 24), new ShaderMaterial({
      name: 'Eterna atmospheric scattering',
      side: BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new Color('#477f9d') },
        horizon: { value: new Color('#b4d1c6') },
        sunDirection: { value: new Vector3(0.3, 0.7, -0.5) },
        time: { value: 0 },
        cloudCoverage: { value: 0.48 },
        cloudDetail: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec3 skyDirection;
        void main() {
          skyDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 sunDirection;
        uniform float time;
        uniform float cloudCoverage;
        uniform float cloudDetail;
        varying vec3 skyDirection;
        const float PI = 3.14159265359;

        float hash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3(vec3 p) {
          vec3 cell = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = mix(hash(cell), hash(cell + vec3(1, 0, 0)), f.x);
          float b = mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), f.x);
          float c = mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), f.x);
          float d = mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), f.x);
          return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
        }

        float fbm(vec3 p) {
          float value = 0.0;
          float weight = 0.54;
          for (int i = 0; i < 4; i++) {
            value += noise3(p) * weight;
            p = p.yzx * 2.07 + vec3(7.3, 11.5, 3.8);
            weight *= 0.48;
          }
          return value;
        }

        float rayleighPhase(float cosine) {
          return 3.0 / (16.0 * PI) * (1.0 + cosine * cosine);
        }

        float miePhase(float cosine) {
          const float g = 0.76;
          float denominator = pow(max(0.01, 1.0 + g*g - 2.0*g*cosine), 1.5);
          return (1.0 - g*g) / (4.0 * PI * denominator);
        }

        vec3 atmosphericLight(vec3 direction, vec3 sun) {
          float elevation = max(direction.y, 0.015);
          float opticalDepth = 1.0 / (elevation + 0.15 * pow(elevation + 0.07, -0.55));
          vec3 betaRayleigh = vec3(0.055, 0.13, 0.29);
          vec3 extinction = exp(-(betaRayleigh + vec3(0.032)) * opticalDepth);
          float mu = dot(direction, sun);
          float sunHeight = smoothstep(-0.12, 0.18, sun.y);
          float sunAirMass = 1.0 / max(0.11, sun.y + 0.15);
          vec3 sunsetTransmittance = exp(-betaRayleigh * sunAirMass * 0.65);
          vec3 scattering = betaRayleigh * rayleighPhase(mu) * 11.0;
          scattering += vec3(0.045) * miePhase(mu) * 0.95;
          vec3 inscatter = scattering * (1.0 - extinction) * sunsetTransmittance;
          vec3 base = mix(horizon, top, pow(max(direction.y, 0.0), 0.6));
          base *= mix(0.8, 0.95, sunHeight);
          return base + inscatter * sunHeight;
        }

        vec3 sunDisk(vec3 direction, vec3 sun) {
          float cosine = dot(direction, sun);
          float disk = smoothstep(cos(0.010), cos(0.007), cosine);
          float corona = pow(max(cosine, 0.0), 220.0) * 0.36;
          float visible = smoothstep(-0.06, 0.02, sun.y);
          vec3 sunset = mix(vec3(1.0, 0.24, 0.055), vec3(1.0, 0.86, 0.61),
                            smoothstep(0.0, 0.45, sun.y));
          return sunset * (disk * 9.0 + corona) * visible;
        }

        vec3 moonDisk(vec3 direction, vec3 moon, vec3 sun) {
          float cosine = dot(direction, moon);
          float disk = smoothstep(cos(0.016), cos(0.013), cosine);
          vec3 tangent = normalize(cross(moon, vec3(0.0, 0.0, 1.0)));
          vec3 bitangent = cross(moon, tangent);
          vec2 uv = vec2(dot(direction, tangent), dot(direction, bitangent)) / 0.014;
          float crater = fbm(vec3(uv * 10.0, 2.5));
          float maria = noise3(vec3(uv * 3.0, 9.0));
          float relief = 0.66 + crater * 0.34 - smoothstep(0.48, 0.7, maria) * 0.2;
          float rim = sqrt(max(0.0, 1.0 - dot(uv, uv)));
          float phase = smoothstep(-0.2, 0.4, uv.x + rim * 0.45);
          float night = 1.0 - smoothstep(-0.08, 0.25, sun.y);
          float halo = pow(max(cosine, 0.0), 100.0) * 0.065;
          return vec3(0.56, 0.70, 0.92) * (disk * relief * (0.18 + phase) * 1.6 + halo)
                 * night * smoothstep(-0.04, 0.08, moon.y);
        }

        vec4 cloudLayer(vec3 direction, vec3 sun) {
          float horizonFade = smoothstep(0.025, 0.18, direction.y);
          if (direction.y < 0.025) return vec4(0.0);
          vec3 coordinates = direction / max(direction.y + 0.3, 0.12) * 3.7;
          coordinates.x += time * 0.008;
          coordinates.z -= time * 0.004;
          float shape = fbm(coordinates);
          float coverage = mix(0.66, 0.35, cloudCoverage);
          float density = smoothstep(coverage, coverage + 0.20, shape);
          float erosion = noise3(coordinates * 12.0 + time * 0.015);
          density *= mix(1.0, smoothstep(0.05, 0.55, erosion + density), cloudDetail);
          float backlight = pow(max(dot(direction, sun), 0.0), 12.0);
          float day = smoothstep(-0.1, 0.25, sun.y);
          float rim = (1.0 - density) * backlight;
          vec3 shade = mix(vec3(0.025, 0.045, 0.085), vec3(0.58, 0.64, 0.65), day);
          vec3 lit = mix(vec3(0.1, 0.14, 0.22), vec3(1.0, 0.93, 0.79), day);
          vec3 color = mix(shade, lit, shape * 0.6 + rim * 0.7);
          color += vec3(1.0, 0.63, 0.32) * rim * day * 0.6;
          return vec4(color, density * horizonFade * 0.78);
        }

        void main() {
          vec3 direction = normalize(skyDirection);
          vec3 sun = normalize(sunDirection);
          vec3 color = atmosphericLight(direction, sun);
          color += sunDisk(direction, sun);
          // The moon follows a separate tilted orbit, keeping both celestial
          // bodies visible near dusk rather than placing it below the earth.
          vec3 moon = normalize(vec3(-sun.x, -sun.y + 0.22, -sun.z + 0.35));
          color += moonDisk(direction, moon, sun);
          vec4 clouds = cloudLayer(direction, sun);
          color = mix(color, clouds.rgb, clouds.a);
          float ground = smoothstep(-0.20, -0.015, direction.y);
          color = mix(horizon * 0.42, color, ground);
          gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
        }
      `,
    }));
    this.name = 'Procedural Rayleigh Mie sky and celestial bodies';
    this.frustumCulled = false;
    this.renderOrder = -100;
  }

  update(time: number, sun: Vector3, top: Color, horizon: Color): void {
    this.material.uniforms.time.value = time;
    this.material.uniforms.sunDirection.value.copy(sun);
    this.material.uniforms.top.value.copy(top);
    this.material.uniforms.horizon.value.copy(horizon);
  }

  setQuality(quality: 'low' | 'high'): void {
    this.material.uniforms.cloudDetail.value = quality === 'high' ? 1 : 0;
  }

  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
