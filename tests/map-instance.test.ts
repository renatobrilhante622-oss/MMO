import {describe,expect,it} from 'vitest';
import {RaycastResult,Vec3} from 'cannon-es';
import {Scene,Vector3} from 'three';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {MapInstanceManager} from '../src/world/MapInstanceManager';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {EnemyAI} from '../src/enemies/EnemyAI';
import {EventBus} from '../src/core/GameTypes';
import {portalSites} from '../src/world/WorldPortals';
import {REGIONS} from '../src/world/Regions';
import {travelPermission} from '../src/world/RegionTravel';
import {translatedMonster} from '../src/ui/RegionTravelUI';

describe('truly separate biome scene instances',()=>{
  it('removes old terrain scene and static collider bodies on every map switch',()=>{
    const scene=new Scene();
    const original=new OpenWorldGenerator(scene,713);
    const physics=new PhysicsWorld(original);
    const heroBody=physics.createCharacter(new Vector3(0,9,18));
    const manager=new MapInstanceManager(scene,physics,original);
    const originalHeight=physics.terrainHeight(15,-32);
    const initialStatic=physics.world.bodies.filter(b=>b.mass===0).length;
    expect(initialStatic).toBeGreaterThan(0);
    const oldRoot=original;
    for(const id of ['crypt','highlands','rift','eclipse','aurora']){
      const map=manager.activate(id);
      expect(map.regionId).toBe(id);
      expect(manager.regionId).toBe(id);
      expect(map).not.toBe(oldRoot);
      expect(scene.getObjectByName('ETERNA map instance: '+id)).toBeDefined();
      expect(physics.world.bodies).toContain(heroBody);
      expect(physics.world.bodies.filter(b=>b.mass===0).length).toBeGreaterThan(0);
      expect(physics.world.bodies.filter(b=>b.mass===0).length).toBeLessThan(initialStatic+50);
      const spot=map.spawnPoint;
      const ray=new RaycastResult();
      const ok=physics.world.raycastClosest(new Vec3(spot.x,spot.y+20,spot.z),
        new Vec3(spot.x,spot.y-20,spot.z),
        {collisionFilterGroup:2,collisionFilterMask:1,skipBackfaces:true},ray);
      expect(ok,id+' must include a physical terrain collider').toBe(true);
      expect(ray.hitPointWorld.y).toBeCloseTo(map.heightAt(spot.x,spot.z),3);
    }
    expect(physics.terrainHeight(15,-32)).toBeCloseTo(originalHeight,6);
    expect(manager.revision).toBe(5);
    physics.removeBody(heroBody);
    physics.dispose();
    manager.current.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it('loads only enemies native to the selected region and never reuses old actor bodies',()=>{
    const scene=new Scene(),world=new OpenWorldGenerator(scene,713);
    const physics=new PhysicsWorld(world);
    const enemies=new EnemyAI(scene,physics,new EventBus());
    enemies.resetForRegion('crypt');
    expect(enemies.enemies.length).toBeGreaterThan(10);
    expect(enemies.enemies.every(e=>['skeleton','wraith'].includes(e.kind))).toBe(true);
    const old=enemies.enemies[0].body;
    enemies.resetForRegion('highlands');
    expect(physics.world.bodies).not.toContain(old);
    expect(enemies.enemies.every(e=>['golem','wolf'].includes(e.kind))).toBe(true);
    enemies.dispose();physics.dispose();world.dispose();
  });
  it('physical portal signs link adjacent maps and enforce level and story unlocks',()=>{
    const fromVillage=portalSites('aurora');
    expect(fromVillage).toHaveLength(1);
    expect(fromVillage[0].destId).toBe('crypt');
    for(const region of REGIONS){
      const routes=portalSites(region.id);
      if(region.id!=='aurora')expect(routes[0].destId).toBe(REGIONS[REGIONS.indexOf(region)-1].id);
      const locked=travelPermission(region.id,{level:1,unlocked:['aurora']});
      expect(locked.ok).toBe(region.minLevel===1);
      const level100=travelPermission(region.id,{level:100,unlocked:['aurora']});
      expect(level100.ok).toBe(region.id==='aurora');
    }
  });
  it('localizes every supported world creature instead of exposing code IDs',()=>{
    expect(translatedMonster('slime','pt')).toBe('Slime Verde');
    expect(translatedMonster('skeleton','pt')).toBe('Esqueleto Guerreiro');
    expect(translatedMonster('wraith','pt')).toBe('Espectro Sombrio');
  });
});
