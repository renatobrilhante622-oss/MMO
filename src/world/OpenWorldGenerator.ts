import * as THREE from 'three';

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
  private generated = false;
  private elapsed = 0;
  private water?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private portal?: THREE.Group;
  private portalLight?: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private randomState: number;
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();

  constructor(private readonly scene: THREE.Scene, private readonly seed = 61857) {
    this.randomState = seed >>> 0;
    this.grid = new Float32Array((SEGMENTS + 1) * (SEGMENTS + 1));
    for (let x = 0; x <= SEGMENTS; x++) {
      for (let z = 0; z <= SEGMENTS; z++) {
        this.grid[x * (SEGMENTS + 1) + z] = this.rawHeight(-SIZE / 2 + x * STEP, SIZE / 2 - z * STEP);
      }
    }
    this.spawnPoint.y = this.heightAt(this.spawnPoint.x, this.spawnPoint.z) + 1.1;
    this.portalPosition.y = this.heightAt(0, -70);
    this.root.name = 'Aetherfall open world';
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
    this.createTerrain();
    this.createWater();
    this.createVillage();
    this.createVegetation();
    this.createPortal();
    this.createTrail();
    this.markers.push(
      { x: 0, z: 18, label: 'Vila Aurora', color: '#edc278' },
      { x: 47, z: -3, label: 'Lago Espelhado', color: '#72c9de' },
      { x: 0, z: -70, label: 'Portal da Fenda', color: '#be82ed' },
      { x: -60, z: -45, label: 'Ermos', color: '#95b774' },
    );
  }

  private material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial(parameters);
    this.materials.add(material);
    return material;
  }

  private makeGroundTexture(): THREE.DataTexture {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const variation = Math.floor(this.random() * 37);
      data[i * 4] = 101 + variation;
      data[i * 4 + 1] = 111 + variation;
      data[i * 4 + 2] = 81 + Math.floor(variation * .7);
      data[i * 4 + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(85, 85);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
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
    const terrain = new THREE.Mesh(geometry, this.material({ map: this.makeGroundTexture(), vertexColors: true, roughness: .97 }));
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
        waterColor: { value: new THREE.Color('#237b8b') },
        skyColor: { value: new THREE.Color('#b5d9dd') },
      },
      vertexShader: `
        uniform float time;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec3 p = position;
          p.z += sin(p.x * .35 + time * 1.1) * .09 + sin(p.y * .48 - time * .8) * .065;
          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorld = world.xyz;
          vec3 localNormal = normalize(vec3(-cos(p.x * .35 + time * 1.1) * .0315,
            -cos(p.y * .48 - time * .8) * .0312, 1.0));
          vNormal = normalize(mat3(modelMatrix) * localNormal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float day;
        uniform vec3 waterColor;
        uniform vec3 skyColor;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
          vec3 reflection = reflect(-viewDirection, vNormal);
          float cloud = sin(reflection.x * 28.0 + time * .06) * sin(reflection.z * 17.0);
          vec3 skyReflection = skyColor + cloud * .045;
          vec3 sunDirection = normalize(vec3(-.45, .8, -.25));
          float specular = pow(max(dot(reflect(-sunDirection, vNormal), viewDirection), 0.0), 110.0);
          float ripple = sin(vWorld.x * 2.0 + time * 2.0) * sin(vWorld.z * 1.7 - time) * .018;
          vec3 color = mix(waterColor, skyReflection, .25 + fresnel * .65) * (.35 + day * .65);
          color += vec3(1.0, .91, .69) * specular * day * 1.4 + ripple;
          gl_FragColor = vec4(color, .83);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.materials.add(material);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(75, 75, 48, 48), material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(47, this.waterLevel, -3);
    this.water.name = 'Fresnel lake';
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
      const roofGeometry = new THREE.CylinderGeometry(0, 1, 1, 4, 1);
      roofGeometry.rotateY(Math.PI / 4);
      const roofMesh = new THREE.Mesh(roofGeometry, roof);
      roofMesh.position.y = 6.25;
      roofMesh.scale.set((building.width + 1.5) / Math.SQRT2, 2.5, (building.depth + 1.5) / Math.SQRT2);
      roofMesh.castShadow = true;
      g.add(roofMesh);
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
    // A shallow training slope is represented by actual terrain and a slide surface zone.
    this.colliders.push({ position: new THREE.Vector3(-25, this.heightAt(-25, 1) - 1, 1), size: new THREE.Vector3(9, .4, 12), type: 'slide' });
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
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 6.5, 7), this.material({ color: '#487662', roughness: .93 }), treePositions.length);
    const canopy = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 4.7, 7), this.material({ color: '#5b8c6b', roughness: .95 }), treePositions.length);
    const dummy = new THREE.Object3D();
    treePositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 2.3 * p.scale, p.z);
      dummy.scale.setScalar(p.scale); dummy.rotation.y = this.random() * Math.PI; dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 5.2 * p.scale; dummy.updateMatrix(); foliage.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 8 * p.scale; dummy.updateMatrix(); canopy.setMatrixAt(i, dummy.matrix);
      if (Math.hypot(p.x, p.z - 18) < 85) this.colliders.push({ position: new THREE.Vector3(p.x, p.y + 1.8 * p.scale, p.z), size: new THREE.Vector3(.55 * p.scale, 3.6 * p.scale, .55 * p.scale), type: 'climbable' });
    });
    for (const mesh of [trunk, foliage, canopy]) { mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); this.root.add(mesh); }
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
    rocks.castShadow = rocks.receiveShadow = true; rocks.computeBoundingSphere(); this.root.add(rocks);
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.19, .8, 3), this.material({ color: '#8fa779', roughness: 1 }), 1600);
    let grassCount = 0;
    for (let i = 0; i < 3000 && grassCount < 1600; i++) {
      const x = (this.random() - .5) * 250, z = (this.random() - .5) * 250, y = this.heightAt(x, z);
      if (y < 2.1 || Math.hypot(x, z - 18) < 25 || (Math.abs(x) < 4 && z < 5 && z > -75)) continue;
      dummy.position.set(x, y + .3, z); dummy.rotation.set(0, this.random() * 6.28, 0);
      dummy.scale.set(.7 + this.random() * .8, .5 + this.random(), .7 + this.random() * .8); dummy.updateMatrix();
      grass.setMatrixAt(grassCount++, dummy.matrix);
    }
    grass.count = grassCount; grass.receiveShadow = true; grass.computeBoundingSphere(); this.root.add(grass);
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
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float time; varying vec2 vUv; void main(){ vec2 p=(vUv-.5)*2.; float r=length(p); float a=atan(p.y,p.x); float swirl=sin(a*5.-r*16.+time*2.); float core=1.-smoothstep(.7,1.,r); vec3 c=mix(vec3(.13,.08,.3),vec3(.65,.4,1.),.5+.5*swirl); c+=vec3(.2,.35,.5)*pow(1.-r,3.); gl_FragColor=vec4(c,core*.87); #include <tonemapping_fragment>\n#include <colorspace_fragment> }`,
    });
    // Shader include directives must begin on a separate line for Three's preprocessor.
    material.fragmentShader = material.fragmentShader.replace('; #include', ';\n#include');
    this.materials.add(material);
    const surface = new THREE.Mesh(new THREE.CircleGeometry(3.8, 48), material);
    surface.position.set(0, 4, .08); group.add(surface);
    group.userData.portalMaterial = material;
    this.portalLight = new THREE.PointLight('#ac7ef7', 16, 18, 2); this.portalLight.position.set(0, 4, 2); group.add(this.portalLight);
    this.addLabel('FENDA · E PARA ENTRAR', new THREE.Vector3(0, this.portalPosition.y + 10.3, -69), '#c9abef', 8);
  }

  private createTrail(): void {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 92; i++) {
      const z = 18 - i, x = Math.sin(i * .075) * 2.3;
      for (const side of [-1, 1]) {
        const px = x + side * 2.1;
        positions.push(px, this.heightAt(px, z) + .045, z);
        uvs.push(side === -1 ? 0 : 1, i / 4);
      }
      if (i < 92) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const path = new THREE.Mesh(geometry, this.material({ color: '#ae9f7d', roughness: 1, side: THREE.DoubleSide }));
    path.receiveShadow = true; this.root.add(path);
  }

  update(dt: number, timeOfDay: number): void {
    this.elapsed += dt;
    const brightness = .18 + Math.max(0, Math.sin(timeOfDay * Math.PI * 2)) * .82;
    if (this.water) {
      this.water.material.uniforms.time.value = this.elapsed;
      this.water.material.uniforms.day.value = brightness;
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

  dispose(): void {
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.scene.remove(this.root);
  }
}
