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
  private readonly colliderBodies=new Map<import('../world/OpenWorldGenerator').WorldCollider,CANNON.Body>();
  private readonly terrainBodies = new Set<CANNON.Body>();
  private readonly gates:CANNON.Body[]=[];
  private readonly portalBarriers=new Map<string,CANNON.Body>();
  private readonly rayResult = new CANNON.RaycastResult();
  private readonly start = new CANNON.Vec3();
  private readonly end = new CANNON.Vec3();

  constructor(private terrain: OpenWorldGenerator) {
    terrain.generate();
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 8;
    this.world.defaultContactMaterial.friction = .12;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.characterMaterial, this.groundMaterial, {
      friction: .02, restitution: 0, contactEquationStiffness: 1e8, contactEquationRelaxation: 4,
    }));
    this.installStaticWorld();
  }

  clearTerrain():void {
    for(const body of this.terrainBodies)this.world.removeBody(body);
    this.terrainBodies.clear();this.colliderBodies.clear();this.gates.length=0;this.portalBarriers.clear();
  }
  get terrainExtent():number{return this.terrain.terrainSize/2-10;}
  /** Atomically switch world colliders while preserving all live actor bodies. */
  switchTerrain(next:OpenWorldGenerator):void{
    if(this.terrain===next&&this.terrainBodies.size)return;
    next.generate();
    const previous=this.terrain;
    for(const body of this.terrainBodies)this.world.removeBody(body);
    this.terrainBodies.clear();this.colliderBodies.clear();
    this.portalBarriers.clear();
    this.gates.length=0;
    this.terrain=next;
    try {this.installStaticWorld();}
    catch(error){
      for(const body of this.terrainBodies)this.world.removeBody(body);
      this.terrainBodies.clear();this.colliderBodies.clear();
      this.gates.length=0;
      this.terrain=previous;
      this.installStaticWorld();
      throw error;
    }
  }

  private registerStatic(body:CANNON.Body):void{
    this.world.addBody(body);
    this.terrainBodies.add(body);
  }

  private installStaticWorld():void{
    this.createHeightfield();
    this.syncTerrainColliders();
  }

  /** GLBs resolve after the heightfield; install their fitted colliders once without duplicating bodies. */
  syncTerrainColliders():void {
    for (const collider of this.terrain.colliders) {
      if(this.colliderBodies.has(collider))continue;
      // Slide regions mark the underlying heightfield; they are not floating solid plates.
      if (collider.type === 'slide') continue;
      const body = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 2 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(collider.size.x / 2, collider.size.y / 2, collider.size.z / 2)));
      body.position.set(collider.position.x, collider.position.y, collider.position.z);
      this.registerStatic(body);this.colliderBodies.set(collider,body);
      if(collider.type==='gate')this.gates.push(body);
    }
  }
  setPortalBarrier(id:string,position:THREE.Vector3,open:boolean,yaw=0):void {
    let body=this.portalBarriers.get(id);
    if(!body){body=new CANNON.Body({mass:0,material:this.groundMaterial,collisionFilterGroup:1,collisionFilterMask:2});body.addShape(new CANNON.Box(new CANNON.Vec3(1.8,2.7,.35)));body.position.set(position.x,position.y+2.7,position.z);this.portalBarriers.set(id,body);this.registerStatic(body);}
    body.position.set(position.x,position.y+2.7,position.z);body.quaternion.setFromEuler(0,yaw,0);body.collisionResponse=!open;body.collisionFilterMask=open?0:2;body.aabbNeedsUpdate=true;
  }
  removePortalBarrier(id:string):void {const body=this.portalBarriers.get(id);if(!body)return;this.world.removeBody(body);this.terrainBodies.delete(body);this.portalBarriers.delete(id);}
  /** Opening a gate removes both physical contacts and raycast obstruction. */
  setDungeonGateOpen(index:number,open:boolean):void{
    const body=this.gates[index];
    if(!body)return;
    body.collisionResponse=!open;
    body.collisionFilterMask=open?0:2;
    body.aabbNeedsUpdate=true;
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
    // Cannon excludes one triangle edge in its ray barycentric test. A sub-micron
    // horizontal offset avoids exact-grid-line misses while retaining visual/physics agreement.
    body.position.set(-size / 2-1e-7, 0, size / 2+1e-7);
    this.registerStatic(body);
    // The outer mountain is backed by physical boundary walls for high-speed mounts.
    const edge = size / 2 - 1;
    for (const axis of ['x', 'z'] as const) {
      for (const sign of [-1, 1]) {
        const wall = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 2 });
        wall.addShape(new CANNON.Box(axis === 'x' ? new CANNON.Vec3(1, 60, edge) : new CANNON.Vec3(edge, 60, 1)));
        wall.position.set(axis === 'x' ? sign * edge : 0, 20, axis === 'z' ? sign * edge : 0);
        this.registerStatic(wall);
      }
    }
  }

  get waterLevel(): number { return this.terrain.waterLevel; }

  isPositionFree(x:number,z:number,radius=1):boolean {
    if(Math.abs(x)>this.terrainExtent||Math.abs(z)>this.terrainExtent||!this.terrain.isWalkable(x,z))return false;
    return !this.terrain.colliders.some(c=>c.type!=='slide'&&Math.abs(x-c.position.x)<c.size.x/2+radius&&Math.abs(z-c.position.z)<c.size.z/2+radius);
  }
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
    this.terrainBodies.clear();this.colliderBodies.clear();
    this.portalBarriers.clear();
    this.gates.length=0;
  }
}
