/** Shared analytic noise. All detail is generated locally; no texture downloads. */
export const WORLD_NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
    mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = .5;
  mat2 rotation = mat2(.8, -.6, .6, .8);
  for (int octave = 0; octave < 5; octave++) {
    sum += valueNoise(p) * amplitude;
    p = rotation * p * 2.03 + 13.17;
    amplitude *= .49;
  }
  return sum;
}
`;

/** Material-space procedural albedos, blended by slope, elevation and village distance. */
export const TERRAIN_GLSL = /* glsl */ `
varying vec3 vTerrainPosition;
varying vec3 vTerrainNormal;
uniform float terrainWaterLevel;
uniform float terrainBiome;
uniform sampler2D terrainStone,terrainDirt,terrainGrass,terrainStoneNormal,terrainStoneRough;
uniform sampler2D terrainSnow,terrainScorched;

/** Biome transitions blend real authored albedo scans, not procedural paint. */
vec3 terrainAlbedo(vec3 p,vec3 n){
  vec2 uv=p.xz*.22;
  vec3 grass=texture2D(terrainGrass,uv).rgb;
  vec3 dirt=texture2D(terrainDirt,uv).rgb;
  vec3 stone=texture2D(terrainStone,uv).rgb;
  vec3 snow=texture2D(terrainSnow,uv).rgb;
  vec3 scorched=texture2D(terrainScorched,uv).rgb;
  float slope=1.-abs(normalize(n).y);
  float cliffs=smoothstep(.16,.48,slope);
  cliffs=max(cliffs,smoothstep(21.,34.,p.y));
  float shoreline=1.-smoothstep(terrainWaterLevel+.4,terrainWaterLevel+2.4,p.y);
  float village=1.-smoothstep(16.,23.,length(p.xz-vec2(0.,18.)));
  float crypt=1.-smoothstep(24.,66.,length(p.xz-vec2(-65.,-40.)));
  float frozen=1.-smoothstep(28.,74.,length(p.xz-vec2(95.,-83.)));
  float volcanic=1.-smoothstep(28.,64.,length(p.xz-vec2(0.,-85.)));
  float abyssal=1.-smoothstep(26.,68.,length(p.xz-vec2(-92.,97.)));
  // Each independent map samples its own authentic, scanned ground atlas.
  if(terrainBiome>.5){
    vec3 biome=terrainBiome<1.5?mix(dirt,stone,.35):
      terrainBiome<2.5?snow:
      terrainBiome<3.5?scorched*.20+vec3(.012,.01,.018):mix(stone,scorched,.48);
    return terrainBiome<2.5&&terrainBiome>1.5?mix(snow,vec3(.48,.75,.88),cliffs*.55):mix(biome,stone,cliffs*.48);
  }
  vec3 color=mix(grass,stone,cliffs);
  color=mix(color,dirt,shoreline*(1.-cliffs));
  color=mix(color,stone,village);
  return color;
}
`;

export const WATER_VERTEX_GLSL = /* glsl */ `
uniform float time;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
void wave(in vec2 p, in vec2 direction, in float frequency,
  in float amplitude, in float speed, inout float h, inout vec2 slope) {
  float phase = dot(p, direction) * frequency + time * speed;
  h += sin(phase) * amplitude;
  slope += cos(phase) * amplitude * frequency * direction;
}
void main() {
  vec3 p = position;
  float height = 0.0;
  vec2 slope = vec2(0);
  wave(p.xy, normalize(vec2(1,.3)), .37, .12, 1.05, height, slope);
  wave(p.xy, normalize(vec2(-.2,1)), .68, .055, -.86, height, slope);
  wave(p.xy, normalize(vec2(.6,-1)), 1.35, .024, 1.52, height, slope);
  wave(p.xy, normalize(vec2(1,1)), 2.65, .009, -2.2, height, slope);
  p.z += height;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vCrest = height;
  vNormal = normalize(mat3(modelMatrix) * vec3(-slope, 1.0));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const WATER_FRAGMENT_GLSL = /* glsl */ `
${WORLD_NOISE_GLSL}
uniform float time;
uniform float day;
uniform float waterLevel;
uniform vec3 waterColor;
uniform vec3 skyColor;
uniform vec3 sunDirection;
uniform sampler2D heightMap;
uniform float terrainExtent;
uniform float terrainSegments;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
float groundHeight(vec2 p) {
  // Match the exact piecewise triangular height interpolation used by physics.
  vec2 grid = clamp(vec2((p.x+terrainExtent*.5)/(terrainExtent/terrainSegments),(terrainExtent*.5-p.y)/(terrainExtent/terrainSegments)),0.0,terrainSegments-.0001);
  vec2 cell = floor(grid), f = fract(grid);
  vec2 uv = (cell.yx + .5) / (terrainSegments+1.0);
  float h00 = texture2D(heightMap,uv).r;
  float h10 = texture2D(heightMap,uv+vec2(0,1.0/(terrainSegments+1.0))).r;
  float h01 = texture2D(heightMap,uv+vec2(1.0/(terrainSegments+1.0),0)).r;
  float h11 = texture2D(heightMap,uv+vec2(1.0/(terrainSegments+1.0))).r;
  return f.x+f.y<=1.0 ? h00+f.x*(h10-h00)+f.y*(h01-h00)
    : h11+(1.0-f.x)*(h01-h11)+(1.0-f.y)*(h10-h11);
}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec2 detail = vec2(valueNoise(vWorld.xz * 3.0 + time * .12),
    valueNoise(vWorld.zx * 3.7 - time * .16)) - .5;
  n = normalize(n + vec3(detail.x * .045, 0, detail.y * .045));
  vec3 viewDirection = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, viewDirection), 0.0);
  float fresnel = .02 + .98 * pow(1.0 - ndv, 5.0);
  float depth = max(0.0, waterLevel - groundHeight(vWorld.xz));
  vec3 reflected = reflect(-viewDirection, n);
  float cloud = fbm(reflected.xz * 5.0 + time * .008);
  vec3 reflectedSky = skyColor * (.5 + .5 * max(reflected.y,0.0)) + cloud * .045;
  vec3 shallow = vec3(.10,.30,.25);
  vec3 deep = waterColor * .42;
  vec3 base = mix(shallow, deep, 1.0-exp(-depth*.42));
  vec3 color = mix(base * (.20 + .80*day), reflectedSky, .18 + fresnel * .74);
  vec3 lightDirection = sunDirection.y > 0.0 ? sunDirection : -sunDirection;
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float specular = pow(max(dot(n, halfVector), 0.0), 220.0);
  vec3 lightColor = sunDirection.y > 0.0 ? vec3(1.0,.78,.42) : vec3(.38,.58,1.0);
  color += lightColor * specular * (sunDirection.y > 0.0 ? 3.6 : .8);
  float edge = 1.0 - smoothstep(.08,.85,depth);
  float pattern = fbm(vWorld.xz*4.5 + vec2(time*.32,-time*.18));
  float wash = sin(vWorld.x*.8+vWorld.z*.9-time*2.0)*.5+.5;
  float foam = edge * smoothstep(.38,.7,pattern + wash*.3);
  foam += smoothstep(.165,.2,vCrest) * .16;
  color = mix(color, vec3(.78,.87,.80) * (.30+.7*day), clamp(foam,0.0,.92));
  float alpha = mix(.45,.94,1.0-exp(-depth*.65));
  alpha = max(alpha, fresnel*.87 + foam*.3);
  // The analytic lake mesh extends onto dry ground: do not paint water over the bank.
  if (groundHeight(vWorld.xz) > waterLevel + .14) discard;
  gl_FragColor = vec4(color, clamp(alpha,.3,.97));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const PORTAL_VERTEX_GLSL = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PORTAL_FRAGMENT_GLSL = /* glsl */ `
${WORLD_NOISE_GLSL}
uniform float time;
varying vec2 vUv;
void main() {
  vec2 p = (vUv-.5)*2.0;
  float r = length(p);
  float a = atan(p.y,p.x);
  float noise = fbm(p*5.0 + vec2(time*.2,-time*.13));
  float spiral = sin(a*5.0-r*21.0+time*2.5+noise*4.0);
  float fine = pow(max(0.0,sin(a*11.0+r*38.0-time*4.0)), 9.0);
  vec3 color = mix(vec3(.018,.006,.06),vec3(.22,.045,.65),spiral*.5+.5);
  color += vec3(.25,.48,1.0) * fine * .36;
  color += vec3(.8,.24,1.5) * pow(r,5.0) * .8;
  color *= smoothstep(.0,.16,r) + .18;
  float edge = 1.0-smoothstep(.88,1.0,r);
  gl_FragColor = vec4(color,edge*.96);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
