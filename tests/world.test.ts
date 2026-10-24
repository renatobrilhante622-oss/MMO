import { describe, expect, it, vi } from 'vitest';
import { Mesh, Scene, ShaderMaterial, Vector3 } from 'three';
import { Vec3, RaycastResult } from 'cannon-es';
import { OpenWorldGenerator } from '../src/world/OpenWorldGenerator';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { WorldLife } from '../src/world/WorldLife';

describe('procedural world preserves terrain and shoreline physics', () => {
  it('samples both triangle halves at their rendered barycentres', () => {
    const scene = new Scene();
    const world = new OpenWorldGenerator(scene,713);
    world.generate();
    const terrain = scene.getObjectByName('Triangulated terrain') as Mesh;
    const positions = terrain.geometry.getAttribute('position');
    const indices = terrain.geometry.getIndex()!;
    const centre = new Vector3();
    const corner = new Vector3();
    // Test both triangle orientations across every region, including the lake and mountains.
    for (let cell = 0; cell < 16384; cell += 137) {
      for (let half = 0; half < 2; half++) {
        centre.set(0,0,0);
        for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
          corner.fromBufferAttribute(positions,indices.getX(cell*6+half*3+cornerIndex));
          centre.addScaledVector(corner,1/3);
        }
        expect(world.heightAt(centre.x,centre.z)).toBeCloseTo(centre.y,5);
      }
    }
    world.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('gives Cannon raycasts the same surface and lake depth as the visual terrain', () => {
    const scene = new Scene();
    const world = new OpenWorldGenerator(scene,713);
    const physics = new PhysicsWorld(world);
    physics.step(1/60);
    for (const [x,z] of [[47,-3],[45,1],[-60,-45],[92,83],[-105.01,91.01]]) {
      const hit = new RaycastResult();
      expect(physics.world.raycastClosest(new Vec3(x,90,z),new Vec3(x,-20,z),
        { collisionFilterGroup:2,collisionFilterMask:1,skipBackfaces:true },hit), `ray ${x},${z}, height ${world.heightAt(x,z)}`).toBe(true);
      expect(hit.hitPointWorld.y).toBeCloseTo(world.heightAt(x,z),4);
    }
    const submerged = physics.surfaceAt(new Vector3(47,world.waterLevel-.1,-3));
    expect(submerged.inWater).toBe(true);
    const dryVillage = physics.surfaceAt(new Vector3(0,world.spawnPoint.y,18));
    expect(dryVillage.inWater).toBe(false);
    physics.dispose();
    world.dispose();
  });

  it('uploads finite X-major shoreline heights that match every rendered vertex', () => {
    const scene = new Scene();
    const world = new OpenWorldGenerator(scene,713);
    world.generate();
    let waterMaterial: ShaderMaterial | undefined;
    scene.traverse(object=>{
      if (object instanceof Mesh && object.material instanceof ShaderMaterial
        && object.material.uniforms.heightMap) waterMaterial=object.material;
    });
    expect(waterMaterial).toBeDefined();
    const image = waterMaterial!.uniforms.heightMap.value.image;
    expect(image.width).toBe(129);
    expect(image.height).toBe(129);
    const terrain = scene.getObjectByName('Triangulated terrain') as Mesh;
    const positions = terrain.geometry.getAttribute('position');
    for(let i=0;i<image.data.length;i++) {
      expect(Number.isFinite(image.data[i])).toBe(true);
      expect(image.data[i]).toBe(positions.getY(i));
    }
    world.dispose();
  });

  it('reuses the same seed without changing height samples after visual updates', () => {
    const first = new OpenWorldGenerator(new Scene(),713);
    const second = new OpenWorldGenerator(new Scene(),713);
    const third = new OpenWorldGenerator(new Scene(),714);
    let different=false;
    for(let i=0;i<50;i++) {
      const x=Math.sin(i*2.39996)*140,z=Math.cos(i*1.7982)*140;
      expect(first.heightAt(x,z)).toBe(second.heightAt(x,z));
      different ||= Math.abs(first.heightAt(x,z)-third.heightAt(x,z))>.01;
    }
    expect(different).toBe(true);
    const initial=first.heightAt(47,-3);
    first.generate();
    first.update(.05,.75);
    expect(first.heightAt(47,-3)).toBe(initial);
    first.dispose(); second.dispose(); third.dispose();
  });
});

describe('ambient simulation resource bounds', () => {
  it('moves villagers and changes quality without reallocating particles, then releases resources', () => {
    const life = new WorldLife(()=>5);
    life.createVillagers();
    life.createAmbient();
    life.createVortex(new Vector3(0,6,-70));
    life.addTorch(new Vector3(1,7,1),0);
    life.createFire();
    const geometries = new Set<import('three').BufferGeometry>();
    life.root.traverse(object=>{ if('geometry' in object) geometries.add(object.geometry as import('three').BufferGeometry); });
    const disposed = vi.fn();
    geometries.forEach(geometry=>geometry.addEventListener('dispose',disposed));
    const villager=life.root.getObjectByName('Village smith')!;
    const initial=villager.position.clone();
    for(let i=0;i<600;i++) life.update(.05,.75);
    expect(villager.position.distanceTo(initial)).toBeGreaterThan(.1);
    life.root.traverse(object=>{
      expect(object.position.toArray().every(Number.isFinite)).toBe(true);
      expect(object.rotation.toArray().slice(0,3).every(value=>Number.isFinite(value))).toBe(true);
    });
    const ambient=life.root.getObjectByName('Solar motes, fireflies and falling leaves') as import('three').Points;
    const allocation=ambient.geometry.getAttribute('position').array;
    life.setQuality(true);
    expect(ambient.geometry.drawRange.count).toBe(240);
    life.setQuality(false);
    expect(ambient.geometry.drawRange.count).toBe(720);
    expect(ambient.geometry.getAttribute('position').array).toBe(allocation);
    life.dispose();
    expect(disposed).toHaveBeenCalledTimes(geometries.size);
  });
});
