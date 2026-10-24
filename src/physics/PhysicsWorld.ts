import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type { OpenWorldGenerator } from '../world/OpenWorldGenerator';

export interface SurfaceInfo {
  grounded: boolean;
  inWater: boolean;
  canClimb: boolean;
  onSlide: boolean;
  groundHeight: number;
  wallNormal: THREE.Vector3;
}

/** Fixed-step rigid-body physics. Group 1 is static world, group 2 is characters. */
export class PhysicsWorld {
  readonly world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0), allowSleep: true });
  private readonly characterMaterial = new CANNON.Material('character');
  private readonly groundMaterial = new CANNON.Material('terrain');
  private readonly characters = new Set<CANNON.Body>();
  private readonly rayResult = new CANNON.RaycastResult();
  private readonly start = new CANNON.Vec3();
  private readonly end = new CANNON.Vec3();

  constructor(private readonly terrain: OpenWorldGenerator) {
    terrain.generate();
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 8;
    this.world.defaultContactMaterial.friction = .12;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.characterMaterial, this.groundMaterial, {
      friction: .02, restitution: 0, contactEquationStiffness: 1e8, contactEquationRelaxation: 4,
    }));
    this.createHeightfield();
    for (const collider of terrain.colliders) {
      // Slide regions mark the underlying heightfield; they are not floating solid plates.
      if (collider.type === 'slide') continue;
      const body = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 2 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(collider.size.x / 2, collider.size.y / 2, collider.size.z / 2)));
      body.position.set(collider.position.x, collider.position.y, collider.position.z);
      this.world.addBody(body);
    }
  }

  private createHeightfield(): void {
    const size = this.terrain.terrainSize, segments = this.terrain.terrainSegments, step = size / segments;
    const heights: number[][] = [];
    for (let x = 0; x <= segments; x++) {
      heights[x] = [];
      for (let z = 0; z <= segments; z++) heights[x][z] = this.terrain.heightAt(-size / 2 + x * step, size / 2 - z * step);
    }
    const shape = new CANNON.Heightfield(heights, { elementSize: step });
    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 2 });
    body.addShape(shape);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    body.position.set(-size / 2, 0, size / 2);
    this.world.addBody(body);
    // The outer mountain is backed by physical boundary walls for high-speed mounts.
    const edge = size / 2 - 1;
    for (const axis of ['x', 'z'] as const) {
      for (const sign of [-1, 1]) {
        const wall = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 2 });
        wall.addShape(new CANNON.Box(axis === 'x' ? new CANNON.Vec3(1, 60, edge) : new CANNON.Vec3(edge, 60, 1)));
        wall.position.set(axis === 'x' ? sign * edge : 0, 20, axis === 'z' ? sign * edge : 0);
        this.world.addBody(wall);
      }
    }
  }

  get waterLevel(): number { return this.terrain.waterLevel; }

  terrainHeight(x: number, z: number): number { return this.terrain.heightAt(x, z); }

  createCharacter(position: THREE.Vector3, radius = .5): CANNON.Body {
    const body = new CANNON.Body({
      mass: 65,
      material: this.characterMaterial,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      shape: new CANNON.Sphere(radius),
      fixedRotation: true,
      linearDamping: .05,
      angularDamping: 1,
      collisionFilterGroup: 2,
      collisionFilterMask: 1 | 2,
      allowSleep: false,
    });
    body.updateMassProperties();
    this.world.addBody(body);
    this.characters.add(body);
    return body;
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
    this.characters.delete(body);
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.world.step(1 / 60, Math.min(dt, .1), 5);
    for (const body of this.characters) {
      // Recover bodies if a tab was suspended during a high-speed boundary collision.
      if (!Number.isFinite(body.position.y) || body.position.y < -45) {
        body.position.set(0, this.terrain.heightAt(0, 18) + 1, 18);
        body.velocity.setZero();
      }
    }
  }

  surfaceAt(position: THREE.Vector3): SurfaceInfo {
    let groundHeight = this.terrain.heightAt(position.x, position.z);
    let canClimb = false, onSlide = false, nearestWall = Infinity;
    const wallNormal = new THREE.Vector3();
    const radius = .5;
    for (const collider of this.terrain.colliders) {
      const dx = position.x - collider.position.x, dz = position.z - collider.position.z;
      const hx = collider.size.x / 2, hz = collider.size.z / 2;
      const top = collider.position.y + collider.size.y / 2;
      const bottom = collider.position.y - collider.size.y / 2;
      if (Math.abs(dx) <= hx && Math.abs(dz) <= hz && top <= position.y + .18 && collider.type !== 'slide') {
        groundHeight = Math.max(groundHeight, top);
      }
      if (collider.type === 'slide') {
        if (Math.abs(dx) < hx + radius && Math.abs(dz) < hz + radius) onSlide = true;
        continue;
      }
      if (collider.type !== 'climbable' || position.y + .8 < bottom || position.y - .6 > top) continue;
      const closestX = THREE.MathUtils.clamp(position.x, collider.position.x - hx, collider.position.x + hx);
      const closestZ = THREE.MathUtils.clamp(position.z, collider.position.z - hz, collider.position.z + hz);
      const nx = position.x - closestX, nz = position.z - closestZ;
      const distance = Math.hypot(nx, nz);
      if (distance < 1.05 && distance < nearestWall) {
        nearestWall = distance;
        canClimb = true;
        if (distance > .001) wallNormal.set(nx / distance, 0, nz / distance);
        else if (hx - Math.abs(dx) < hz - Math.abs(dz)) wallNormal.set(Math.sign(dx) || 1, 0, 0);
        else wallNormal.set(0, 0, Math.sign(dz) || 1);
      }
    }
    const slopeX = (this.terrain.heightAt(position.x + .6, position.z) - this.terrain.heightAt(position.x - .6, position.z)) / 1.2;
    const slopeZ = (this.terrain.heightAt(position.x, position.z + .6) - this.terrain.heightAt(position.x, position.z - .6)) / 1.2;
    onSlide ||= Math.hypot(slopeX, slopeZ) > .7;
    const aboveLake = Math.abs(position.x - 47) < 37.5 && Math.abs(position.z + 3) < 37.5;
    return {
      grounded: position.y - radius <= groundHeight + .2 && position.y - radius >= groundHeight - .6,
      inWater: aboveLake && groundHeight < this.waterLevel - .1 && position.y - radius < this.waterLevel,
      canClimb,
      onSlide,
      groundHeight,
      wallNormal,
    };
  }

  raycastCamera(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    this.start.set(from.x, from.y, from.z);
    this.end.set(to.x, to.y, to.z);
    this.rayResult.reset();
    const hit = this.world.raycastClosest(this.start, this.end, { collisionFilterMask: 1, skipBackfaces: true }, this.rayResult);
    if (!hit) return to.clone();
    const p = this.rayResult.hitPointWorld;
    const away = from.clone().sub(to).normalize();
    return new THREE.Vector3(p.x, p.y, p.z).addScaledVector(away, .35);
  }

  dispose(): void {
    for (const body of [...this.world.bodies]) this.world.removeBody(body);
    this.characters.clear();
  }
}
