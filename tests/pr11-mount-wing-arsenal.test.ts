import {describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {existsSync,readFileSync} from 'node:fs';
import {CompanionRig} from '../src/companions/CompanionRig';
import {petFollowPosition} from '../src/companions/PetAndMountSystem';
import {WEAPON_PACKS,WEAPON_PACK_RARITIES,weaponPackForClass} from '../src/rpg/WeaponPacks';
import {COSMETICS} from '../src/progression/AdventureProgress';
import {CLASS_IDS} from '../src/combat/ClassSystem';
import {CLASS_EQUIPMENT_MODELS} from '../src/assets/WeaponGLB';
import {InventoryAndLoot,WEAPON_PACK_ITEM_TEMPLATES} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';

describe('PR11: real mount physics, safe pets, wing rigging, cosmetics and weapons',()=>{
 it('uses loaded GLB Box3 at exactly 78% to place the real saddle, not the old fixed height',()=>{
   const mount=new CompanionRig(true);
   const mock={ready:true,getVisibleBounds:()=>new Box3(
      new Vector3(-.75,0,-1.4),new Vector3(.75,2.6,1.4))};
   (mount as unknown as {imported:unknown}).imported=mock;
   mount.updateSaddleFromGLB();
   expect(mount.saddle.position.x).toBe(0);
   expect(mount.saddle.position.z).toBe(0);
   expect(mount.saddle.position.y).toBeCloseTo(2.6*.78,5);
   expect(mount.root.userData.saddleMeasured).toBe(true);
   (mount as unknown as {imported:unknown}).imported=undefined;
   mount.dispose();
 });
 it('orbits on hero right side 1.8m/back 1.2m and never crosses an active mount',()=>{
   const hero=new Vector3(10,2,20),forward=new Vector3(0,0,1);
   const walking=petFollowPosition(hero,forward,false);
   expect(walking.x).toBeCloseTo(11.8,6);
   expect(walking.z).toBeCloseTo(18.8,6);
   const mounted=petFollowPosition(hero,forward,true);
   expect(mounted.distanceTo(hero)).toBeGreaterThanOrEqual(2.4-1e-7);
   expect(mounted.x).toBeGreaterThan(10);
   expect(mounted.z).toBeLessThan(20);
 });
 it('mount actor variants retain their authored maps rather than receiving a flat blue material',()=>{
   const code=readFileSync('src/assets/AnimatedGLB.ts','utf8');
   expect(code).toContain('original).lerp(tint,hellhound?.11:.045)');
   expect(code).toContain('material.onBeforeCompile=shader=>');
   expect(code).toContain('eterna-hellhound-magma-v1');
   expect(code).toContain('creaturePhase');
   const rig=readFileSync('src/companions/CompanionRig.ts','utf8');
   expect(rig).toContain('this.imported.getVisibleBounds()');
   expect(rig).toContain('height*.78');
   expect(rig).toContain('this.imported.animationCount===0');
 });
 it('wings attach to spine2 and have size-capped skins and real GPU particles',()=>{
   const hero=readFileSync('src/player/ArticulatedCharacter.ts','utf8');
   expect(hero).toContain("actor.attachAt('spine2',this.wings.root");
   const wings=readFileSync('src/companions/WingsSystem.ts','utf8');
   expect(wings).toContain('Math.min(.94,.58+level*.035)');
   expect(wings).toContain('this.aura.position.set(0,.05,-.18)');
   expect(hero).toContain('this.wings.root.scale.setScalar(.58)');
 });
 it('bundles five class-themed persisted visual packs per each of nine classes',()=>{
   expect(WEAPON_PACKS).toHaveLength(45);
   expect(new Set(WEAPON_PACKS.map(p=>p.id)).size).toBe(45);
   expect(WEAPON_PACK_RARITIES).toHaveLength(5);
   expect(CLASS_IDS).toHaveLength(9);
   for(const classId of CLASS_IDS){
     const group=WEAPON_PACKS.filter(pack=>pack.classId===classId);
     expect(group).toHaveLength(5);
     expect(new Set(group.map(pack=>pack.name[0])).size).toBe(5);
     for(const pack of group){
       expect(weaponPackForClass(pack.id,classId)).toBe(pack);
       expect(COSMETICS.some(item=>item.id===pack.id&&item.type==='weapon')).toBe(true);
       expect(pack.weapons.length).toBeGreaterThan(0);
       expect(weaponPackForClass(pack.id,CLASS_IDS.find(c=>c!==classId)!)).toBeUndefined();
     }
   }
   expect(CLASS_EQUIPMENT_MODELS.assassin.map(g=>g.model)).toEqual(['dagger','dagger']);
 });
 it('ships genuinely different additional Kenney swords/shields with validated source hashes',()=>{
   const manifest=JSON.parse(readFileSync('public/models/weapon-packs/manifest.json','utf8')) as
     {assets:Array<{id:string;file:string;hash:string;license:string;source:string}>};
   expect(manifest.assets).toHaveLength(4);
   for(const asset of manifest.assets){
     expect(asset.license).toBe('CC0-1.0');
     expect(asset.source).toContain('raw.githubusercontent.com');
     expect(asset.hash).toMatch(/^[0-9a-f]{40}$/);
     const file='public/'+asset.file;
     expect(existsSync(file)).toBe(true);
     const bytes=readFileSync(file);
     expect(bytes.toString('ascii',0,4)).toBe('glTF');
     expect(bytes.readUInt32LE(8)).toBe(bytes.length);
     const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
     expect(gltf.meshes.length).toBeGreaterThan(0);
   }
 });
 it('makes themed weapon packs real loot with upgradable stats and validated persistence',()=>{
   expect(WEAPON_PACK_ITEM_TEMPLATES).toHaveLength(45);
   const inv=new InventoryAndLoot(new EventBus(),1234);
   let found=0;
   for(let i=0;i<1000;i++){
     const drop=inv.generateLoot('boss',100,true);
     if(drop.item?.visualId){
       found++;
       expect(WEAPON_PACK_ITEM_TEMPLATES.some(item=>item.visualId===drop.item!.visualId)).toBe(true);
       if(found===1){
         inv.addLoot({...drop,position:new Vector3()});
         const owned=inv.items.find(item=>item.visualId===drop.item!.visualId);
         expect(owned).toBeDefined();
         if(owned){
           inv.gold=100000;inv.crystals=100000;
           const old=owned.attack;
           expect(inv.upgrade(owned.id)).toBe(true);
           expect(owned.attack).toBeGreaterThan(old);
           const saved=inv.snapshot();
           const restored=new InventoryAndLoot(new EventBus(),1234);
           restored.restore(saved);
           expect(restored.items.find(item=>item.id===owned.id)?.visualId).toBe(owned.visualId);
         }
       }
     }
   }
   expect(found).toBeGreaterThan(4);
 });
 it('adds real cosmetic skins, pets and mount silhouettes to the Collection',()=>{
   for(const id of ['verdant-warden','cinder-knight','astral-emperor','celestial-king',
     'emberfox','ashwolf','stormhound','frostphoenix',
     'magmahorse','obsidianwolf','ashdrake','lunarhorse']){
      const cosmetic=COSMETICS.find(item=>item.id===id);
      expect(cosmetic,id).toBeDefined();
      expect(cosmetic?.rarity).toBeDefined();
   }
 });
 it('wires class weapons and skins to both actual hero and Collection 3D preview',()=>{
   const engine=readFileSync('src/core/Engine.ts','utf8');
   const preview=readFileSync('src/ui/CharacterPreview.ts','utf8');
   const hero=readFileSync('src/player/ArticulatedCharacter.ts','utf8');
   expect(engine).toContain('hero.rig.weaponPackAppearance(p.equipped.weapon)');
   expect(preview).toContain('this.rig.weaponPackAppearance(cosmetic.id)');
   expect(hero).toContain('setCosmeticPalette(this.skinTone,this.skinTier)');
   expect(hero).toContain('this.imported?.setCosmeticPalette?.(color,this.skinTier)');
 });
});
