import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TERRAIN_GLSL, WATER_VERTEX_GLSL, WATER_FRAGMENT_GLSL, PORTAL_VERTEX_GLSL, PORTAL_FRAGMENT_GLSL } from './WorldShaders';
import { createGroundTextures, type PBRTextureSet } from './ProceduralTextures';
import {WORLD_SITES} from './WorldSites';
import {EnvironmentGLB} from './EnvironmentGLB';
import { WorldLife } from './WorldLife';

export interface WorldCollider {
  position: THREE.Vector3;
  size: THREE.Vector3;
  type: 'solid' | 'climbable' | 'slide';
}

export interface MapMarker { x: number; z: number; label: string; color: string }

const SIZE = 320;
const SEGMENTS = 128;
const STEP = SIZE / SEGMENTS;
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A seeded landscape: the mesh and physics sample this same triangulated height map. */
export class OpenWorldGenerator {
  readonly waterLevel = 1.2;
  readonly spawnPoint = new THREE.Vector3(0, 6.1, 18);
  readonly portalPosition = new THREE.Vector3(0, 6.1, -70);
  readonly colliders: WorldCollider[] = [];
  readonly markers: MapMarker[] = [];
  readonly terrainSize = SIZE;
  readonly terrainSegments = SEGMENTS;
  private readonly root = new THREE.Group();
  private readonly grid: Float32Array;
  private readonly life: WorldLife;
  private environment?: EnvironmentGLB;
  private generated = false;
  private elapsed = 0;
  private ground?:{grass:PBRTextureSet;dirt:PBRTextureSet;cobble:PBRTextureSet;snow:PBRTextureSet;scorched:PBRTextureSet};
  private wind={value:0};
  private water?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private portal?: THREE.Group;
  private portalLight?: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private randomState: number;
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();

  constructor(private readonly scene: THREE.Scene, private readonly seed = 61857,
    readonly regionId = 'aurora') {
    this.randomState = seed >>> 0;
    this.life = new WorldLife((x, z) => this.heightAt(x, z));
    this.grid = new Float32Array((SEGMENTS + 1) * (SEGMENTS + 1));
    for (let x = 0; x <= SEGMENTS; x++) {
      for (let z = 0; z <= SEGMENTS; z++) {
        this.grid[x * (SEGMENTS + 1) + z] = this.rawHeight(-SIZE / 2 + x * STEP, SIZE / 2 - z * STEP);
      }
    }
    this.spawnPoint.y = this.heightAt(this.spawnPoint.x, this.spawnPoint.z) + 1.1;
    this.portalPosition.y = this.heightAt(0, -70);
    this.root.name = 'ETERNA map instance: '+this.regionId;
  }

  private random(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private noise(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const hash = (a: number, b: number) => {
      let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + this.seed;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), smooth(x - ix)),
      lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), smooth(x - ix)), smooth(z - iz));
  }

  private rawHeight(x: number, z: number): number {
    if(this.regionId!=='aurora'){
      // Separate terrain instance; every regional scene samples its own
      // immutable height field through the exact same Cannon triangle split.
      const params:Record<string,{base:number;ridge:number;frequency:number}>={
        crypt:{base:3.6,ridge:3.7,frequency:.026},
        highlands:{base:8.2,ridge:12,frequency:.022},
        rift:{base:6.1,ridge:8.5,frequency:.037},
        eclipse:{base:9,ridge:13,frequency:.018}
      };
      const p=params[this.regionId]??params.crypt;
      const seedOffset={crypt:115,highlands:361,rift:597,eclipse:827}[this.regionId]??115;
      let h=p.base+this.noise(x*p.frequency+seedOffset,z*p.frequency)*p.ridge
        +(this.noise(x*.081+seedOffset,z*.081)-.5)*2.2;
      // Fixed safe village and portal landings, with native slope continuity.
      const camp=Math.hypot(x,z-18);
      h=lerp(h,p.base+2.2,1-smooth(THREE.MathUtils.clamp((camp-12)/18,0,1)));
      const gate=Math.hypot(x,z+70);
      h=lerp(h,p.base+1.5,1-smooth(THREE.MathUtils.clamp((gate-9)/12,0,1)));
      h+=Math.pow(THREE.MathUtils.clamp((Math.max(Math.abs(x),Math.abs(z))-125)/35,0,1),2)*22;
      return h;
    }
    let h = 2.5 + this.noise(x * .016, z * .016) * 12
      + (this.noise(x * .052, z * .052) - .5) * 5
      + (this.noise(x * .12, z * .12) - .5) * 1.5;
    const lakeDistance = Math.hypot((x - 47) * .91, z + 3);
    h = lerp(h, -3.4 + this.noise(x * .1, z * .1) * .7, 1 - smooth(THREE.MathUtils.clamp((lakeDistance - 15) / 16, 0, 1)));
    const villageDistance = Math.hypot(x, z - 18);
    h = lerp(h, 5, 1 - smooth(THREE.MathUtils.clamp((villageDistance - 21) / 13, 0, 1)));
    const portalDistance = Math.hypot(x, z + 70);
    h = lerp(h, 6, 1 - smooth(THREE.MathUtils.clamp((portalDistance - 13) / 12, 0, 1)));
    // Raise the outer boundary as a natural mountain wall rather than an invisible edge.
    h += Math.pow(THREE.MathUtils.clamp((Math.max(Math.abs(x), Math.abs(z)) - 125) / 35, 0, 1), 2) * 22;
    return h;
  }

  heightAt(x: number, z: number): number {
    const gx = THREE.MathUtils.clamp((x + SIZE / 2) / STEP, 0, SEGMENTS - .00001);
    const gz = THREE.MathUtils.clamp((SIZE / 2 - z) / STEP, 0, SEGMENTS - .00001);
    const ix = Math.floor(gx), iz = Math.floor(gz), tx = gx - ix, tz = gz - iz;
    const h00 = this.grid[ix * (SEGMENTS + 1) + iz];
    const h10 = this.grid[(ix + 1) * (SEGMENTS + 1) + iz];
    const h01 = this.grid[ix * (SEGMENTS + 1) + iz + 1];
    const h11 = this.grid[(ix + 1) * (SEGMENTS + 1) + iz + 1];
    return tx + tz <= 1 ? h00 + tx * (h10 - h00) + tz * (h01 - h00)
      : h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
  }

  generate(): void {
    if (this.generated) return;
    this.generated = true;
    this.scene.add(this.root);
    if(typeof document!=='undefined')this.ground={grass:createGroundTextures('grass'),dirt:createGroundTextures('dirt'),cobble:createGroundTextures('cobble'),snow:createGroundTextures('snow'),scorched:createGroundTextures('scorched')};
    this.createTerrain();
    if(this.regionId==='aurora')this.createWater();
    // Authored CC0 GLBs replace procedural tree and regional building primitives.
    this.environment = new EnvironmentGLB(this.scene,(x,z)=>this.heightAt(x,z),this.regionId);
    if(this.regionId==='aurora')for(const site of WORLD_SITES)this.markers.push({x:site.x,z:site.z,label:site.name,color:site.type==='cemetery'?'#b58ccc':'#c8b78e'});
    if(this.regionId!=='dungeon')this.createPortal();
    this.root.add(this.life.root);
    // Interactive KayKit NPCs replace geometric village mannequins.
    if(this.regionId!=='dungeon')this.life.createAmbient();
    this.life.createVortex(this.portalPosition);
    this.life.createFire();
    this.markers.push({x:0,z:18,label:({
      aurora:'Vila de Aster',crypt:'Acampamento da Cripta',
      highlands:'Refúgio Glacial',rift:'Posto da Forja',
      eclipse:'Santuário Abissal',dungeon:'Cripta Subterrânea'
    } as Record<string,string>)[this.regionId]??'Acampamento',color:'#edc278'});
    if(this.regionId==='aurora'){
      this.markers.push({x:47,z:-3,label:'Lago Espelhado',color:'#72c9de'});
    }
  }

  private material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial(parameters);
    this.materials.add(material);
    return material;
  }

  /** A float height field lets the water shader query the same shore as physics. */
  private makeHeightTexture(): THREE.DataTexture {
    const texture = new THREE.DataTexture(this.grid, SEGMENTS + 1, SEGMENTS + 1,
      THREE.RedFormat, THREE.FloatType);
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
  }

  private terrainMaterial(): THREE.MeshStandardMaterial {
    const material = this.material({ color: 0xffffff, roughness: .96 });
    if(this.ground){material.normalMap=this.ground.grass.normalMap;material.normalMap.repeat.set(80,80);material.normalScale.set(.3,.3);material.roughnessMap=this.ground.grass.roughnessMap;material.roughnessMap.repeat.set(80,80);}
    material.name = 'Scanned CC0 PBR grass, soil, stone, snow and scorched ground';
    material.onBeforeCompile = shader => {
      shader.uniforms.terrainWaterLevel = { value: this.waterLevel };
      shader.uniforms.terrainBiome={value:this.regionId==='dungeon'?5:Math.max(0,['aurora','crypt','highlands','rift','eclipse'].indexOf(this.regionId))};
      shader.uniforms.terrainStone={value:this.ground?.cobble.map};shader.uniforms.terrainDirt={value:this.ground?.dirt.map};shader.uniforms.terrainGrass={value:this.ground?.grass.map};shader.uniforms.terrainSnow={value:this.ground?.snow.map};shader.uniforms.terrainScorched={value:this.ground?.scorched.map};shader.uniforms.terrainStoneNormal={value:this.ground?.cobble.normalMap};shader.uniforms.terrainStoneRough={value:this.ground?.cobble.roughnessMap};
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `
        #include <common>
        varying vec3 vTerrainPosition;
        varying vec3 vTerrainNormal;
      `).replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vTerrainPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vTerrainNormal = normalize(mat3(modelMatrix) * normal);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        #include <common>
        ${TERRAIN_GLSL}
      `).replace('#include <map_fragment>', `
        diffuseColor.rgb *= terrainAlbedo(vTerrainPosition, normalize(vTerrainNormal));
      `).replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        float wetness = 1.0 - smoothstep(terrainWaterLevel - .3,
          terrainWaterLevel + .7, vTerrainPosition.y);
        float villageRough=1.-smoothstep(16.,23.,length(vTerrainPosition.xz-vec2(0.,18.)));
        roughnessFactor=mix(roughnessFactor,texture2D(terrainStoneRough,vTerrainPosition.xz*.22).g,villageRough)*mix(1.,.4,wetness);
      `);
    };
    const terrainCompile=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{terrainCompile.call(material,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      #ifdef USE_NORMALMAP_TANGENTSPACE
        float cobbleNormalWeight=1.-smoothstep(16.,23.,length(vTerrainPosition.xz-vec2(0.,18.)));
        vec3 stoneN=texture2D(terrainStoneNormal,vTerrainPosition.xz*.22).xyz*2.-1.;stoneN.xy*=.75;
        normal=normalize(mix(normal,normalize(tbn*stoneN),cobbleNormalWeight));
      #endif`);};
    material.customProgramCacheKey = () => 'eterna-real-scanned-pbr-v5';
    return material;
  }

  private createTerrain(): void {
    const count = (SEGMENTS + 1) ** 2;
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
    const indices: number[] = [];
    const color = new THREE.Color();
    const normal = new THREE.Vector3();
    for (let i = 0; i <= SEGMENTS; i++) {
      for (let j = 0; j <= SEGMENTS; j++) {
        const index = i * (SEGMENTS + 1) + j;
        const x = -SIZE / 2 + i * STEP, z = SIZE / 2 - j * STEP, h = this.grid[index];
        positions.set([x, h, z], index * 3);
        uvs.set([i / SEGMENTS, j / SEGMENTS], index * 2);
        const slope = Math.abs(this.heightAt(x + 1, z) - this.heightAt(x - 1, z))
          + Math.abs(this.heightAt(x, z + 1) - this.heightAt(x, z - 1));
        if (h < this.waterLevel + 1.4) color.set('#adad79');
        else if (slope > 2.1 || h > 22) color.set('#999c94');
        else color.set('#a9c98b');
        normal.setScalar(.88 + this.noise(x * .11, z * .11) * .22);
        color.multiplyScalar(normal.x);
        colors.set([color.r, color.g, color.b], index * 3);
        if (i < SEGMENTS && j < SEGMENTS) {
          const a = index, b = (i + 1) * (SEGMENTS + 1) + j, c = index + 1, d = b + 1;
          indices.push(a, b, c, b, d, c);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, this.terrainMaterial());
    terrain.name = 'Triangulated terrain';
    terrain.receiveShadow = true;
    this.root.add(terrain);
  }

  private createWater(): void {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 }, day: { value: 1 },
        waterLevel: { value: this.waterLevel },
        heightMap: { value: this.makeHeightTexture() },
        waterColor: { value: new THREE.Color('#237b8b') },
        skyColor: { value: new THREE.Color('#b5d9dd') },
        sunDirection: { value: new THREE.Vector3(.2,.8,-.45).normalize() },
      },
      vertexShader: WATER_VERTEX_GLSL,
      fragmentShader: WATER_FRAGMENT_GLSL,
    });
    this.materials.add(material);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(75, 75, 96, 96), material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(47, this.waterLevel, -3);
    this.water.name = 'Displaced Fresnel lake, terrain depth shoreline foam and celestial glint';
    this.root.add(this.water);
  }

  private box(group: THREE.Group, size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, collider = false, type: WorldCollider['type'] = 'solid'): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    if (collider) this.colliders.push({ position: position.clone().add(group.position), size: size.clone(), type });
    return mesh;
  }

  private createVillage(): void {
    const stone = this.material({ color: '#9c9b8d', roughness: .94 });
    const plaster = this.material({ color: '#d1c0a0', roughness: .9 });
    const wood = this.material({ color: '#584531', roughness: .86 });
    const roof = this.material({ color: '#526e76', roughness: .78, metalness: .06 });
    const gold = this.material({ color: '#c99b55', roughness: .42, metalness: .68 });
    const glass = this.material({ color: '#ffc979', emissive: '#f5a53b', emissiveIntensity: .55, roughness: .3 });
    const buildings = [
      { x: -14, z: 12, name: 'FORJA', width: 8, depth: 7, color: '#df9c56' },
      { x: 14, z: 12, name: 'ALQUIMIA', width: 7, depth: 7, color: '#97c5ac' },
      { x: -12, z: 31, name: 'ESTÁBULO', width: 10, depth: 7, color: '#d1bc84' },
    ];
    for (const building of buildings) {
      const g = new THREE.Group();
      g.position.set(building.x, this.heightAt(building.x, building.z), building.z);
      this.root.add(g);
      this.box(g, new THREE.Vector3(building.width + .6, .65, building.depth + .6), new THREE.Vector3(0, .2, 0), stone, true, 'climbable');
      // Side and rear walls leave a real doorway instead of an invisible solid building.
      this.box(g, new THREE.Vector3(.4, 5, building.depth), new THREE.Vector3(-building.width / 2, 2.8, 0), plaster, true, 'climbable');
      this.box(g, new THREE.Vector3(.4, 5, building.depth), new THREE.Vector3(building.width / 2, 2.8, 0), plaster, true, 'climbable');
      this.box(g, new THREE.Vector3(building.width, 5, .4), new THREE.Vector3(0, 2.8, -building.depth / 2), plaster, true, 'climbable');
      const half = (building.width - 2) / 2;
      for (const sign of [-1, 1]) {
        this.box(g, new THREE.Vector3(half, 5, .4), new THREE.Vector3(sign * (1 + half / 2), 2.8, building.depth / 2), plaster, true, 'climbable');
        this.box(g, new THREE.Vector3(.25, 5.5, building.depth + .4), new THREE.Vector3(sign * building.width / 2, 2.75, 0), wood);
        this.box(g, new THREE.Vector3(1.1, 1.3, .12), new THREE.Vector3(sign * (building.width / 2 - 1.5), 3.2, building.depth / 2 + .25), glass);
      }
      this.box(g, new THREE.Vector3(2, 1.8, .4), new THREE.Vector3(0, 4.4, building.depth / 2), wood, true, 'climbable');
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-(building.width + 1.5) / 2, 0);
      roofShape.lineTo(0, 2.5);
      roofShape.lineTo((building.width + 1.5) / 2, 0);
      roofShape.closePath();
      const roofGeometry = new THREE.ExtrudeGeometry(roofShape,
        { depth: building.depth + 1.5, bevelEnabled: false });
      roofGeometry.translate(0, 0, -(building.depth + 1.5) / 2);
      const roofMesh = new THREE.Mesh(roofGeometry, roof);
      roofMesh.position.y = 5;
      roofMesh.castShadow = true;
      g.add(roofMesh);
      this.decorateBuilding(g, building.width, building.depth, building.name,
        { stone, plaster, wood, roof, gold, glass });
      for (const side of [-1, 1]) {
        this.life.addTorch(new THREE.Vector3(building.x + side * 1.45,
          g.position.y + 2.8, building.z + building.depth / 2 + .65),
          building.x * .17 + side * 3);
      }
      this.addLabel(building.name, new THREE.Vector3(building.x, g.position.y + 5.15, building.z + building.depth / 2 + .5), building.color, 3.6);
      this.markers.push({ x: building.x, z: building.z, label: building.name, color: building.color });
      if (building.name === 'FORJA') {
        this.box(g, new THREE.Vector3(1.7, .6, .9), new THREE.Vector3(0, 1.6, 0), this.material({ color: '#4a5154', metalness: .8, roughness: .4 }));
        this.box(g, new THREE.Vector3(.7, 1.1, .6), new THREE.Vector3(0, .8, 0), stone);
        const chimney = this.box(g, new THREE.Vector3(1.4, 7.8, 1.4), new THREE.Vector3(-building.width / 2 - 1, 3.9, -1), stone, true, 'climbable');
        chimney.name = 'Climbable forge chimney';
        const flame = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.3, 7), this.material({ color: '#ffb64b', emissive: '#ff6a1c', emissiveIntensity: 2 }));
        flame.position.set(building.x - building.width / 2 - 1, g.position.y + 8, building.z - 1);
        this.flames.push(flame);
        this.root.add(flame);
      } else if (building.name === 'ALQUIMIA') {
        this.box(g, new THREE.Vector3(3.6, .25, 1.2), new THREE.Vector3(0, 1.5, 0), wood);
        const colors = ['#77dbac', '#ad80df', '#dfb56c'];
        colors.forEach((c, i) => {
          const flask = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), this.material({ color: c, emissive: c, emissiveIntensity: .25, metalness: .1, roughness: .2 }));
          flask.position.set(i - 1, 1.9, 0); g.add(flask);
        });
      } else {
        for (let i = 0; i < 3; i++) this.box(g, new THREE.Vector3(2, .8, 1.3), new THREE.Vector3(i * 3 - 3, .7, -1.7), this.material({ color: '#b3a35a', roughness: 1 }));
      }
      this.batchStaticMeshes(g);
    }
    const fountain = new THREE.Group();
    fountain.position.set(0, 5, 23);
    this.root.add(fountain);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, .75, 16), stone);
    basin.position.y = .4; basin.castShadow = basin.receiveShadow = true; fountain.add(basin);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.3, .55, 2.4, 10), stone);
    pillar.position.y = 1.5; pillar.castShadow = true; fountain.add(pillar);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.8), this.material({ color: '#6de3df', emissive: '#289ba2', emissiveIntensity: .9, metalness: .4, roughness: .18 }));
    crystal.position.y = 3.2; fountain.add(crystal);
    this.colliders.push({ position: new THREE.Vector3(0, 5.5, 23), size: new THREE.Vector3(5.4, 1, 5.4), type: 'solid' });
    for (const sign of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 6.5, 6), wood);
      pole.position.set(sign * 5.5, 8.2, 2); pole.castShadow = true; this.root.add(pole);
      const banner = this.box(this.root, new THREE.Vector3(1.7, 2.7, .06), new THREE.Vector3(sign * 5.5 + .8, 9.8, 2), this.material({ color: '#527a7f', roughness: 1 }));
      banner.name = 'Aurora banner';
      const finial = new THREE.Mesh(new THREE.OctahedronGeometry(.22), gold);
      finial.position.set(sign * 5.5, 11.6, 2); this.root.add(finial);
    }
    this.createVillageStreetFurniture(stone, wood, gold);
    // A shallow training slope is represented by actual terrain and a slide surface zone.
    this.colliders.push({ position: new THREE.Vector3(-25, this.heightAt(-25, 1) - 1, 1), size: new THREE.Vector3(9, .4, 12), type: 'slide' });
  }

  /** Bake rigid architecture by material so detail does not multiply mobile draw calls. */
  private batchStaticMeshes(group: THREE.Group): void {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh
        || Array.isArray(child.material)) continue;
      const batch = batches.get(child.material) ?? [];
      batch.push(child);
      batches.set(child.material, batch);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const copies = meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        // Decorative primitives have different UV layouts but share position/normal/UV.
        geometry.applyMatrix4(mesh.matrix);
        return geometry;
      });
      const merged = mergeGeometries(copies, false);
      copies.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = 'Batched village architecture';
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      for (const original of meshes) {
        original.removeFromParent();
        original.geometry.dispose();
      }
    }
  }

  private decorateBuilding(group: THREE.Group, width: number, depth: number, name: string,
    palette: Record<'stone' | 'plaster' | 'wood' | 'roof' | 'gold' | 'glass', THREE.Material>): void {
    const { stone, wood, roof, gold, glass } = palette;
    // Raised footing, projecting cornices and corner quoins give walls a solid silhouette.
    for (const sign of [-1, 1]) {
      this.box(group, new THREE.Vector3(width + .7, .21, .48),
        new THREE.Vector3(0, .72, sign * depth / 2), stone);
      this.box(group, new THREE.Vector3(width + .8, .18, .55),
        new THREE.Vector3(0, 5.25, sign * depth / 2), wood);
      for (const x of [-width / 2, width / 2]) {
        for (let row = 0; row < 7; row++) {
          this.box(group, new THREE.Vector3(.63, .43, .58),
            new THREE.Vector3(x, .95 + row * .65, sign * depth / 2), stone);
        }
      }
      for (const x of [-width / 2 + 1.5, width / 2 - 1.5]) {
        // Window frames, transoms and deep sill, all opaque and shadow casting.
        for (const side of [-1, 1]) {
          this.box(group, new THREE.Vector3(.09, 1.6, .16),
            new THREE.Vector3(x + side * .64, 3.2, sign * (depth / 2 + .3)), wood);
        }
        for (const y of [2.43, 3.2, 3.98]) {
          this.box(group, new THREE.Vector3(1.4, .10, .18),
            new THREE.Vector3(x, y, sign * (depth / 2 + .34)), wood);
        }
        this.box(group, new THREE.Vector3(.07, 1.45, .13),
          new THREE.Vector3(x, 3.2, sign * (depth / 2 + .36)), gold);
        this.box(group, new THREE.Vector3(1.5, .16, .52),
          new THREE.Vector3(x, 2.35, sign * (depth / 2 + .38)), stone);
      }
    }
    // Timber frame braces run diagonally across side walls.
    for (const sign of [-1, 1]) {
      for (const z of [-depth * .28, depth * .28]) {
        const brace = this.box(group, new THREE.Vector3(.18, 3.1, .18),
          new THREE.Vector3(sign * (width / 2 + .25), 3.2, z), wood);
        brace.rotation.x = sign * .55;
      }
      this.box(group, new THREE.Vector3(.3, .25, depth + .55),
        new THREE.Vector3(sign * (width / 2 + .1), 3.5, 0), wood);
    }
    // A porch has structural columns, stair treads and a sloped rain shelter.
    const porchZ = depth / 2 + 1.3;
    this.box(group, new THREE.Vector3(3.8, .28, 2.4),
      new THREE.Vector3(0, .45, porchZ), stone);
    for (let step = 0; step < 3; step++) {
      this.box(group, new THREE.Vector3(2.6, .14, .45),
        new THREE.Vector3(0, .1 + step * .14, porchZ + 1.9 - step * .43), stone);
    }
    for (const sign of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, 3.6, 8), wood);
      pillar.position.set(sign * 1.65, 2.35, porchZ + .65);
      pillar.castShadow = true;
      group.add(pillar);
      for (const y of [.65, 3.95]) {
        this.box(group, new THREE.Vector3(.42, .18, .42),
          new THREE.Vector3(sign * 1.65, y, porchZ + .65), stone);
      }
      const support = this.box(group, new THREE.Vector3(.16, 1.0, .16),
        new THREE.Vector3(sign * 1.35, 3.7, porchZ + .65), wood);
      support.rotation.z = sign * .7;
    }
    const awning = this.box(group, new THREE.Vector3(4.1, .18, 2.8),
      new THREE.Vector3(0, 4.25, porchZ), roof);
    awning.rotation.x = .12;
    this.box(group, new THREE.Vector3(3.9, .2, .18),
      new THREE.Vector3(0, 4.04, porchZ + 1.35), wood);
    // Roof tiles are instanced: hundreds of relief silhouettes use one draw per roof.
    const columns = 12, rows = 5, tiles = columns * rows * 2;
    const geometry = new THREE.BoxGeometry(.62, .075, .84);
    const shingles = new THREE.InstancedMesh(geometry, roof, tiles);
    const dummy = new THREE.Object3D();
    let instance = 0;
    for (const sign of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        const fraction = (row + .5) / rows;
        const slopeWidth = (width + 1.5) * .5;
        for (let col = 0; col < columns; col++) {
          const z = -depth * .52 + (col + .5) * depth * 1.04 / columns;
          dummy.position.set(sign * fraction * slopeWidth,
            7.5 - fraction * 2.5 + .10, z);
          dummy.rotation.set(0, 0, -sign * Math.atan2(2.5, slopeWidth));
          dummy.scale.set(slopeWidth / rows / .62 * 1.10, 1,
            depth * 1.04 / columns / .84 * 1.06);
          dummy.updateMatrix();
          shingles.setMatrixAt(instance++, dummy.matrix);
        }
      }
    }
    shingles.count = instance;
    shingles.castShadow = shingles.receiveShadow = true;
    shingles.computeBoundingSphere();
    group.add(shingles);
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, depth + 1.8, 8), wood);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 7.55;
    ridge.castShadow = true;
    group.add(ridge);
    // Storage shelves inside each open door are visible from the approach.
    for (let shelf = 0; shelf < 3; shelf++) {
      this.box(group, new THREE.Vector3(2.6, .12, .55),
        new THREE.Vector3(width / 2 - 1.6, 1.2 + shelf * .65, -depth / 2 + .5), wood);
      for (let jar = 0; jar < 4; jar++) {
        const vessel = new THREE.Mesh(new THREE.CylinderGeometry(.11, .17, .30, 7),
          name === 'ALQUIMIA' ? glass : stone);
        vessel.position.set(width / 2 - 2.55 + jar * .6, 1.41 + shelf * .65, -depth / 2 + .5);
        group.add(vessel);
      }
    }
  }

  private createVillageStreetFurniture(stone: THREE.Material, wood: THREE.Material,
    gold: THREE.Material): void {
    const band = this.material({ color: '#343638', metalness: .65, roughness: .55 });
    const cloth = this.material({ color: '#7d383f', roughness: .96, side: THREE.DoubleSide });
    // Market stall: four posts, angled canvas, crates and a brass scale.
    const market = new THREE.Group();
    market.position.set(10, this.heightAt(10, 30), 30);
    this.root.add(market);
    for (const x of [-1.7, 1.7]) for (const z of [-1, 1]) {
      this.box(market, new THREE.Vector3(.14, 2.9, .14), new THREE.Vector3(x, 1.45, z), wood);
    }
    this.box(market, new THREE.Vector3(3.7, .15, 2.2), new THREE.Vector3(0, 1.05, 0), wood);
    for (const sign of [-1, 1]) {
      const canvas = this.box(market, new THREE.Vector3(3.9, .06, 1.3),
        new THREE.Vector3(0, 3.03, sign * .58), cloth);
      canvas.rotation.x = sign * .27;
    }
    const basketMat = this.material({ color: '#a68c55', roughness: 1 });
    const produceMat = this.material({ color: '#9d4939', roughness: .6 });
    for (let basket = 0; basket < 3; basket++) {
      const x = (basket - 1) * 1.0;
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(.4, .3, .23, 9, 1, true), basketMat);
      tray.position.set(x, 1.25, 0); market.add(tray);
      for (let fruit = 0; fruit < 5; fruit++) {
        const apple = new THREE.Mesh(new THREE.SphereGeometry(.115, 6, 5), produceMat);
        const angle = fruit * 2.4;
        apple.position.set(x + Math.cos(angle) * .2, 1.38 + (fruit % 2) * .04, Math.sin(angle) * .2);
        market.add(apple);
      }
    }
    this.batchStaticMeshes(market);
    // Barrel bodies use real hoops, with shared materials and no transparent layers.
    for (let barrel = 0; barrel < 7; barrel++) {
      const x = -19 + barrel % 3 * 1.1, z = 20 + Math.floor(barrel / 3) * 1.1;
      const y = this.heightAt(x,z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.44,.40,1.0,10), wood);
      body.position.set(x,y+.5,z); body.castShadow=true; this.root.add(body);
      for (const h of [.2,.8]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(.44,.035,4,12),band);
        hoop.rotation.x=Math.PI/2; hoop.position.set(x,y+h,z); this.root.add(hoop);
      }
    }
    // A handcart is parked beside the stable; spokes are actual radial meshes.
    const cart = new THREE.Group();
    cart.position.set(-5, this.heightAt(-5,37),37);
    cart.rotation.y=-.35;
    this.root.add(cart);
    this.box(cart,new THREE.Vector3(2,.16,2.8),new THREE.Vector3(0,.85,0),wood);
    for(const sign of [-1,1]) {
      for(let slat=0;slat<3;slat++) this.box(cart,new THREE.Vector3(.08,.15,2.8),
        new THREE.Vector3(sign,1.05+slat*.23,0),wood);
      this.box(cart,new THREE.Vector3(.10,.1,2.2),new THREE.Vector3(sign*.65,.8,2),wood);
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.65,.10,5,14),wood);
      wheel.rotation.y=Math.PI/2; wheel.position.set(sign*1.2,.65,0); wheel.castShadow=true;
      cart.add(wheel);
      for(let spoke=0;spoke<6;spoke++) {
        const shaft=this.box(cart,new THREE.Vector3(.07,1.2,.07),new THREE.Vector3(sign*1.2,.65,0),gold);
        shaft.rotation.x=spoke*Math.PI/3;
      }
    }
    this.batchStaticMeshes(cart);
    // Curved low cemetery wall outlines the safe southern edge without closing routes.
    for(let i=0;i<14;i++) {
      const a=.15+i/13*Math.PI*.7;
      const x=Math.cos(a)*24,z=18+Math.sin(a)*24;
      const piece=this.box(this.root,new THREE.Vector3(3,.8,.7),
        new THREE.Vector3(x,this.heightAt(x,z)+.4,z),stone);
      piece.rotation.y=-a-Math.PI/2;
    }
  }

  private addLabel(text: string, position: THREE.Vector3, color: string, width: number): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#202b29'; context.fillRect(0, 0, 512, 128);
    context.strokeStyle = color; context.lineWidth = 6; context.strokeRect(8, 8, 496, 112);
    context.font = 'bold 42px serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = color;
    context.fillText(text, 256, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    this.materials.add(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
    mesh.position.copy(position); this.root.add(mesh);
  }

  private createVegetation(): void {
    const treePositions: { x: number; y: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 1200 && treePositions.length < 410; i++) {
      const x = (this.random() - .5) * 295, z = (this.random() - .5) * 295;
      const y = this.heightAt(x, z);
      if (y < this.waterLevel + 1 || Math.hypot(x, z - 18) < 35 || Math.hypot(x, z + 70) < 19 || (Math.abs(x) < 6 && z > -70 && z < 5)) continue;
      treePositions.push({ x, y, z, scale: .7 + this.random() * 1.05 });
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.19, .37, 4.6, 5), this.material({ color: '#5b5140', roughness: 1 }), treePositions.length);
    const foliage = new THREE.InstancedMesh<THREE.BufferGeometry>(new THREE.ConeGeometry(2.2, 6.5, 7), this.material({ color: '#487662', roughness: .93 }), treePositions.length);
    // Two canopy tiers share one geometry/material and one draw call.
    const canopyPart=new THREE.ConeGeometry(1.7,4.7,7);canopyPart.translate(0,2.8,0);const mergedCanopy=mergeGeometries([foliage.geometry,canopyPart])!;foliage.geometry.dispose();canopyPart.dispose();foliage.geometry=mergedCanopy;
    const dummy = new THREE.Object3D();
    treePositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 2.3 * p.scale, p.z);
      dummy.scale.setScalar(p.scale); dummy.rotation.y = this.random() * Math.PI; dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 5.2 * p.scale; dummy.updateMatrix(); foliage.setMatrixAt(i, dummy.matrix);

      if (Math.hypot(p.x, p.z - 18) < 85) this.colliders.push({ position: new THREE.Vector3(p.x, p.y + 1.8 * p.scale, p.z), size: new THREE.Vector3(.55 * p.scale, 3.6 * p.scale, .55 * p.scale), type: 'climbable' });
    });
    for (const mesh of [trunk, foliage]) { mesh.name=mesh===trunk?'Vegetation batch: trunks':'Vegetation batch: crowns';mesh.userData.vegetation=true;mesh.castShadow = mesh.receiveShadow = false; mesh.computeBoundingSphere(); this.root.add(mesh); }
    const rockPositions: { x: number; y: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 190; i++) {
      const x = (this.random() - .5) * 285, z = (this.random() - .5) * 285, y = this.heightAt(x, z);
      if (Math.hypot(x, z - 18) < 30 || Math.hypot(x, z + 70) < 17) continue;
      rockPositions.push({ x, y, z, scale: .6 + this.random() * 2.4 });
    }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), this.material({ color: '#8e9892', roughness: .92 }), rockPositions.length);
    rockPositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + .25 * p.scale, p.z); dummy.scale.set(p.scale, p.scale * .72, p.scale * .85);
      dummy.rotation.set(this.random(), this.random() * 6, this.random()); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
      if (p.scale > 1.8) this.colliders.push({ position: new THREE.Vector3(p.x, p.y + p.scale * .35, p.z), size: new THREE.Vector3(p.scale * 1.35, p.scale, p.scale * 1.3), type: 'climbable' });
    });
    rocks.name='Vegetation batch: rocks';rocks.userData.vegetation=true;rocks.castShadow = rocks.receiveShadow = false; rocks.computeBoundingSphere(); this.root.add(rocks);
    const bladeGeometry=new THREE.PlaneGeometry(.12,.75,1,3);bladeGeometry.translate(0,.375,0);
    const bladePositions=bladeGeometry.getAttribute('position');for(let i=0;i<bladePositions.count;i++){const y=bladePositions.getY(i);bladePositions.setX(i,bladePositions.getX(i)*(1-y/.8));bladePositions.setZ(i,Math.pow(y,2)*.15);}bladeGeometry.computeVertexNormals();
    const grassMaterial=this.material({color:'#647c3d',roughness:.95,side:THREE.DoubleSide});
    grassMaterial.onBeforeCompile=shader=>{shader.uniforms.grassTime=this.wind;shader.vertexShader='uniform float grassTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float grassPhase=grassTime*1.4+instanceMatrix[3].x*.21+instanceMatrix[3].z*.18;
      transformed.x+=sin(grassPhase)*position.y*position.y*.22;
      transformed.z+=cos(grassPhase*.73)*position.y*position.y*.12;`);};
    grassMaterial.customProgramCacheKey=()=> 'eterna-grass-blade-wind-v1';
    const grass = new THREE.InstancedMesh(bladeGeometry,grassMaterial,3200);
    let grassCount = 0;
    for (let i = 0; i < 6000 && grassCount < 3200; i++) {
      const x = (this.random() - .5) * 250, z = (this.random() - .5) * 250, y = this.heightAt(x, z);
      if (y < 2.1 || Math.hypot(x, z - 18) < 25 || (Math.abs(x) < 4 && z < 5 && z > -75)) continue;
      dummy.position.set(x, y + .02, z); dummy.rotation.set(0, this.random() * 6.28, 0);
      dummy.scale.set(.7 + this.random() * .8, .5 + this.random(), .7 + this.random() * .8); dummy.updateMatrix();
      grass.setMatrixAt(grassCount++, dummy.matrix);
    }
    grass.name='Vegetation batch: grass';grass.userData.vegetation=true;grass.count = grassCount; grass.castShadow=grass.receiveShadow = false; grass.computeBoundingSphere(); this.root.add(grass);
  }

  private createPortal(): void {
    const group = new THREE.Group(); group.position.copy(this.portalPosition); this.root.add(group); this.portal = group;
    const stone = this.material({ color: '#747987', roughness: .8 });
    const obsidian = this.material({ color: '#383146', metalness: .45, roughness: .35 });
    const rune = this.material({ color: '#b887f4', emissive: '#9e62e9', emissiveIntensity: 1.6, roughness: .3 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(10, 11.2, .7, 32), stone);
    platform.position.y = -.3; platform.receiveShadow = true; group.add(platform);
    for (const sign of [-1, 1]) {
      this.box(group, new THREE.Vector3(2, 8, 2.2), new THREE.Vector3(sign * 4, 4, 0), stone, true, 'climbable');
      this.box(group, new THREE.Vector3(2.5, .5, 2.6), new THREE.Vector3(sign * 4, 8.2, 0), obsidian);
      this.box(group, new THREE.Vector3(.25, 5, .12), new THREE.Vector3(sign * 4, 4.3, 1.15), rune);
    }
    this.box(group, new THREE.Vector3(10, 1.6, 2.2), new THREE.Vector3(0, 8.5, 0), obsidian, true, 'climbable');
    const material = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { time: { value: 0 } },
      vertexShader: PORTAL_VERTEX_GLSL,
      fragmentShader: PORTAL_FRAGMENT_GLSL,
    });
    this.materials.add(material);
    const surface = new THREE.Mesh(new THREE.CircleGeometry(3.8, 48), material);
    surface.position.set(0, 4, .08); group.add(surface);
    group.userData.portalMaterial = material;
    this.portalLight = new THREE.PointLight('#ac7ef7', 16, 18, 2); this.portalLight.position.set(0, 4, 2); group.add(this.portalLight);
    this.addLabel('FENDA · E PARA ENTRAR', new THREE.Vector3(0, this.portalPosition.y + 10.3, -69), '#c9abef', 8);
  }

  private createTrail(): void {
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let row=0;row<=184;row++){
      const z=18-row*.5,x=Math.sin(row*.5*.075)*2.3;
      for(let col=0;col<=8;col++){const side=col/4-1,px=x+side*(2.65+Math.sin(z*.7)*.12);positions.push(px,this.heightAt(px,z)+.055,z);uvs.push(col/8,row/12);}
      if(row<184)for(let col=0;col<8;col++){const a=row*9+col;indices.push(a,a+9,a+1,a+1,a+9,a+10);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=this.material({color:'#b4aa8d',roughness:.92,side:THREE.DoubleSide,transparent:true,depthWrite:false});
    if(this.ground){material.map=this.ground.dirt.map;material.normalMap=this.ground.dirt.normalMap;material.roughnessMap=this.ground.dirt.roughnessMap;material.normalScale.set(.65,.65);}
    material.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 trailUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntrailUv=uv;');shader.fragmentShader='varying vec2 trailUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
      float edge=min(trailUv.x,1.-trailUv.x);
      float dust=sin(trailUv.y*73.1+trailUv.x*17.)*.03+sin(trailUv.y*29.)*.025;
      diffuseColor.a*=smoothstep(.015,.20,edge+dust);`);};material.customProgramCacheKey=()=> 'eterna-rutted-trail-v2';
    const trail=new THREE.Mesh(geometry,material);trail.name='Blended PBR cart track';trail.receiveShadow=true;this.root.add(trail);
    // Broken edge stones establish width without a perfectly straight ribbon.
    const border=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.21,1),this.material({color:'#797e69',roughness:.96}),184);
    const dummy=new THREE.Object3D();let count=0;for(let i=0;i<92;i++)for(const side of [-1,1]){const z=18-i,x=Math.sin(i*.075)*2.3+side*(2.3+this.random()*.2);dummy.position.set(x,this.heightAt(x,z)+.09,z);dummy.rotation.set(this.random()*.4,this.random()*6,.2);dummy.scale.set(.6+this.random(),.45,.7+this.random());dummy.updateMatrix();border.setMatrixAt(count++,dummy.matrix);}border.receiveShadow=true;border.computeBoundingSphere();this.root.add(border);
  }

  update(dt: number, timeOfDay: number,camera?:THREE.Vector3): void {
    this.elapsed += dt;
    this.wind.value=this.elapsed;
    this.life.update(dt, timeOfDay,camera);
    const brightness = .18 + Math.max(0, Math.sin(timeOfDay * Math.PI * 2)) * .82;
    if (this.water) {
      this.water.material.uniforms.time.value = this.elapsed;
      this.water.material.uniforms.day.value = brightness;
      const angle = timeOfDay * Math.PI * 2;
      (this.water.material.uniforms.sunDirection.value as THREE.Vector3)
        .set(Math.cos(angle) * .75, Math.sin(angle), -.45).normalize();
      (this.water.material.uniforms.skyColor.value as THREE.Color)
        .set('#15223d').lerp(new THREE.Color('#b5d9dd'), brightness);
    }
    if (this.portal) {
      const material = this.portal.userData.portalMaterial as THREE.ShaderMaterial;
      material.uniforms.time.value = this.elapsed;
    }
    if (this.portalLight) this.portalLight.intensity = 14 + Math.sin(this.elapsed * 2) * 3;
    this.flames.forEach((flame, i) => {
      flame.scale.set(1 + Math.sin(this.elapsed * 9 + i) * .08, 1 + Math.sin(this.elapsed * 13 + i) * .2, 1);
      flame.rotation.y += dt;
    });
  }

  setQuality(quality: 'low' | 'high'): void {
    this.life.setQuality(quality === 'low');
  }

  dispose(): void {
    this.environment?.dispose();
    this.life.dispose();
    if(this.ground)Object.values(this.ground).forEach(set=>set.dispose());
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.scene.remove(this.root);
  }
}
