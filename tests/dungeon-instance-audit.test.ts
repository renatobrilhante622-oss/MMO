import {describe,expect,it} from 'vitest';
import {Scene,Vector3} from 'three';
import {DUNGEON_TIERS,DUNGEON_SHOWCASE} from '../src/ui/DungeonUI';
import {dungeonColliders,DUNGEON_ROOMS,DungeonInstance} from '../src/world/DungeonInstance';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {MapInstanceManager} from '../src/world/MapInstanceManager';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('independent dungeon instance and GLB assets',()=>{
 it('bundles all 12 original, immutable Kenney CC0 indoor GLBs',()=>{
   const manifest=JSON.parse(readFileSync(resolve('public/models/dungeon/manifest.json'),'utf8')) as
     {assets:Array<{file:string;sourceBlobSha1:string;license:string}>};
   expect(manifest.assets).toHaveLength(12);
   for(const item of manifest.assets){
     expect(item.license).toBe('CC0-1.0');
     expect(item.sourceBlobSha1).toMatch(/^[0-9a-f]{40}$/);
     const bytes=readFileSync(resolve('public/models/dungeon',item.file));
     expect(bytes.toString('ascii',0,4)).toBe('glTF');
     expect(bytes.readUInt32LE(8)).toBe(bytes.length);
     const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
     expect(doc.meshes.length).toBeGreaterThan(0);
   }
 });
 it('defines four independent selectable dungeons and exact level tiers',()=>{
   expect(DUNGEON_SHOWCASE).toHaveLength(4);
   expect(new Set(DUNGEON_SHOWCASE.map(x=>x.id)).size).toBe(4);
   expect(DUNGEON_TIERS.map(x=>x.minLevel)).toEqual([10,30,60,85]);
   expect(DUNGEON_ROOMS.map(x=>x.id)).toEqual(['guardians','crystals','boss']);
 });
 it('supports a physically separate indoor flat heightfield and physical walls',()=>{
   const scene=new Scene(),valley=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(valley);
   const manager=new MapInstanceManager(scene,physics,valley);
   const dungeon=manager.activate('dungeon');
   expect(manager.regionId).toBe('dungeon');
   expect(dungeon.terrainSize).toBeGreaterThan(0);
   expect(dungeon.heightAt(0,-70)).toBeCloseTo(3.4,6);
   expect(dungeon.colliders.length).toBeGreaterThanOrEqual(4);
   const walls=dungeonColliders((x,z)=>dungeon.heightAt(x,z));
   expect(walls.length).toBeGreaterThanOrEqual(4);
   expect(scene.getObjectByName('Loaded indoor dungeon instance')).toBeUndefined();
   const tiles=scene.getObjectByName('Triangulated terrain');
   expect(tiles?.visible).toBe(false);
   physics.dispose();dungeon.dispose();expect(scene.children).toHaveLength(0);
 });
 it('creates three destructible stage-two crystals with health and strict melee reach',()=>{
   const scene=new Scene(),world=new OpenWorldGenerator(scene,713);
   const instance=new DungeonInstance(scene,world);
   expect(instance.crystalsRemaining).toBe(3);
   expect(instance.strikeCrystal(new Vector3(99,3,-50))).toBe(false);
   const at=new Vector3(-7,3,-50);
   expect(instance.strikeCrystal(at,50)).toBe(true);
   expect(instance.strikeCrystal(at,50)).toBe(false);
   instance.update(.5,3,4,false);
   expect(instance.strikeCrystal(at,50)).toBe(true);
   expect(instance.crystalsRemaining).toBe(2);
   for(const x of [0,7]){
     instance.update(.5,3,4,false);
     expect(instance.strikeCrystal(new Vector3(x,3,-50),100)).toBe(true);
   }
   expect(instance.crystalsRemaining).toBe(0);
   expect(instance.crystalsDestroyed).toBe(3);
   instance.dispose();
   expect(scene.children).toHaveLength(0);
 });
});
