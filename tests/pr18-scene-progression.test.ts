import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {Scene,Vector3} from 'three';
import {EventBus} from '../src/core/GameTypes';import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';import {AdventureProgress} from '../src/progression/AdventureProgress';
import {QuestSystem,QUEST_STORY} from '../src/rpg/QuestSystem';import {portalPermission,PortalTrigger} from '../src/world/PortalTrigger';import {portalSites} from '../src/world/WorldPortals';
import {WORLD_MAPS} from '../src/world/maps/MapDefinitions';import {DUNGEON_MAPS,dungeonWalkable,roomForWave} from '../src/world/dungeons/DungeonMaps';import {DUNGEONS} from '../src/world/Regions';import {SceneManager} from '../src/world/SceneManager';import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';import {PhysicsWorld} from '../src/physics/PhysicsWorld';import {dungeonColliders,DungeonInstance} from '../src/world/DungeonInstance';
const fixture=()=>{const inventory=new InventoryAndLoot(new EventBus());const progress=new AdventureProgress(inventory);return {inventory,progress,quests:new QuestSystem(inventory,progress)};};
function finish(quests:QuestSystem,id:string){for(const quest of QUEST_STORY.filter(q=>q.region===id)){if(quest.goal==='talk')quests.onTalk(quest.target);else if(quest.goal==='kill')for(let i=0;i<quest.required;i++)quests.onKill(quest.target,id);else if(quest.goal==='collect')quests.onCollect(id,quest.required);else quests.onKill('boss',id,true);expect(quests.claim(quest.id),quest.id).toBe(true);}}
describe('PR18 physical campaign progression',()=>{
 it('requires real claimed objectives, even with a level-100 save or forged discovery flags',()=>{
  const {inventory,progress,quests}=fixture();inventory.level=100;progress.unlockedRegions.push('crypt');
  const state={level:100,unlocked:progress.unlockedRegions};expect(portalPermission('aurora','crypt',state,quests).reason).toBe('locked');
  quests.onKill('boss','aurora',true);expect(quests.regionComplete('aurora')).toBe(false);
  finish(quests,'aurora');expect(portalPermission('aurora','crypt',state,quests).ok).toBe(true);
  expect(portalPermission('aurora','eclipse',state,quests).ok).toBe(false);expect(portalPermission('crypt','aurora',state,quests).ok).toBe(true);
 });
 it('keeps arrival rewards single-use and advances through all five local chains',()=>{
  const {quests,inventory}=fixture();for(const id of Object.keys(WORLD_MAPS)){finish(quests,id);expect(quests.regionComplete(id)).toBe(true);const gold=inventory.gold;expect(quests.claim('story-'+id+'-meet')).toBe(false);expect(inventory.gold).toBe(gold);}
  expect(quests.activeStory()).toBeUndefined();
 });
 it('migrates old completed three-step chapters by stable IDs without granting unfinished maps',()=>{
  const {quests}=fixture();quests.restore({storyIndex:3,claimed:['story-aurora-meet','story-aurora-hunt','story-aurora-boss']});expect(quests.regionComplete('aurora')).toBe(true);expect(quests.activeStory()?.id).toBe('story-crypt-meet');expect(quests.canEnterRegion('eclipse')).toBe(false);
  const fresh=fixture();fresh.quests.restore({storyIndex:1});expect(fresh.quests.activeStory()?.id).toBe('story-aurora-hunt');
  const saved=fixture();saved.quests.restore(quests.snapshot());expect(saved.quests.activeStory()?.id).toBe('story-crypt-meet');
 });
 it('fires only after touching an open aperture, and rearms only after leaving',()=>{
  const gate={x:0,z:-138},trigger=new PortalTrigger();expect(trigger.sample({x:0,z:-135},gate,true,true)).toBe(false);expect(trigger.sample(gate,gate,false,true)).toBe(false);expect(trigger.sample(gate,gate,true,true)).toBe(true);expect(trigger.sample(gate,gate,true,true)).toBe(false);trigger.sample({x:10,z:-138},gate,true,true);expect(trigger.sample(gate,gate,true,false)).toBe(false);expect(trigger.sample(gate,gate,true,true)).toBe(true);
 });
 it('places one forward portal at each map boundary and only adjacent return gates',()=>{
  for(const [i,map] of Object.values(WORLD_MAPS).entries()){const sites=portalSites(map.id),next=sites.find(s=>s.id==='portal-next');if(i<4){expect(next).toMatchObject(map.exit);expect(next!.z).toBeLessThan(-130);}else expect(next).toBeUndefined();}
 });
});
describe('PR18 owned scene lifetimes',()=>{
 it('unloads render and static physics data while retaining the persistent hero body',()=>{
  const scene=new Scene(),world=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(world),hero=physics.createCharacter(new Vector3(0,9,18)),manager=new SceneManager(scene,physics,world);
  manager.unloadCurrentMap();expect(scene.children).toHaveLength(0);expect(physics.world.bodies).toEqual([hero]);expect(()=>manager.current).toThrow('Map unloaded');manager.activate('crypt');expect(manager.current.regionId).toBe('crypt');expect(physics.world.bodies).toContain(hero);manager.unloadCurrentMap();physics.dispose();
 });
 it('physically seals portals, reuses their barriers and removes them on unload',()=>{
  const scene=new Scene(),world=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(world),count=physics.world.bodies.length;
  physics.setPortalBarrier('next',new Vector3(0,6,-138),false);const barrier=physics.world.bodies.at(-1)!;
  expect(barrier.collisionResponse).toBe(true);expect(barrier.collisionFilterMask).toBe(2);
  physics.setPortalBarrier('next',new Vector3(0,6,-138),true);expect(physics.world.bodies.length).toBe(count+1);expect(barrier.collisionResponse).toBe(false);expect(barrier.collisionFilterMask).toBe(0);
  physics.removePortalBarrier('next');expect(physics.world.bodies.length).toBe(count);physics.dispose();world.dispose();
 });
 it('awaits required assets and rolls back a failed asynchronous map load',async()=>{
  const scene=new Scene(),world=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(world);
  const manager=new SceneManager(scene,physics,world,(id,seed,dungeon)=>{const map=new OpenWorldGenerator(scene,seed,id,dungeon);const original=map.generate.bind(map);let failed=false;map.generate=()=>{original();if(id==='crypt'&&!failed){failed=true;map.ready=Promise.reject(Error('missing required GLB'));}};return map;});
  await expect(manager.loadMap('crypt')).rejects.toThrow('missing required GLB');expect(manager.regionId).toBe('aurora');expect(scene.getObjectByName('ETERNA map instance: crypt')).toBeUndefined();expect(physics.world.bodies.length).toBeGreaterThan(0);manager.unloadCurrentMap();physics.dispose();
 });
 it('provides expanded, distinct terrain plus supported entry and exit positions',()=>{
  const samples=new Set<string>();for(const def of Object.values(WORLD_MAPS)){const scene=new Scene(),world=new OpenWorldGenerator(scene,def.seed,def.id);expect(world.terrainSize).toBeGreaterThan(320);expect(world.isWalkable(0,18)).toBe(true);expect(world.isWalkable(def.exit.x,def.exit.z)).toBe(true);samples.add([world.heightAt(-45,-76),world.heightAt(57,-90),world.heightAt(130,110)].join(','));world.dispose();}expect(samples.size).toBe(5);
 });
 it('has separate islands and forbids GPS paths over void floors',()=>{const world=new OpenWorldGenerator(new Scene(),4749,'eclipse');expect(world.heightAt(0,-174)).toBeGreaterThan(2);expect(world.heightAt(150,150)).toBeLessThan(-10);expect(world.isWalkable(150,150)).toBe(false);world.dispose();});
});
describe('PR18 bespoke dungeon maps and licensed art',()=>{
 it('offers only the four dedicated dungeons and migrates retired starter selections',()=>{
  expect(DUNGEONS.map(d=>d.id)).toEqual(['tombs','titan','void','eclipse']);
  const {progress}=fixture();progress.restore({selectedDungeon:'roots'});expect(progress.selectedDungeon).toBe('tombs');progress.restore({selectedDungeon:'tide'});expect(progress.selectedDungeon).toBe('tombs');
 });
 it('has three traversal rooms plus a unique boss throne and four different floor plans',()=>{
  const signatures=new Set<string>();for(const plan of Object.values(DUNGEON_MAPS)){expect(plan.rooms.map(r=>r.id)).toEqual(['guardians','crystals','sentinels','boss']);expect(plan.props.some(p=>p.asset==='Throne')).toBe(true);signatures.add(JSON.stringify(plan.rooms));for(const r of plan.rooms)expect(dungeonWalkable(plan,r.x,r.z)).toBe(true);expect(dungeonWalkable(plan,80,80)).toBe(false);expect(dungeonColliders(()=>3.4,plan.id).filter(c=>c.type==='gate')).toHaveLength(3);}expect(signatures.size).toBe(4);expect(new Set(Object.values(DUNGEON_MAPS).map(p=>p.bossModel)).size).toBe(4);
 });
 it('keeps visual and physical gate criteria aligned and resets crystals on a new floor',()=>{
  const scene=new Scene(),world=new OpenWorldGenerator(scene,713,'dungeon'),instance=new DungeonInstance(scene,world,'titan');expect(roomForWave(5,4)).toBe(3);expect(instance.gateOpen(1,3,4)).toBe(false);for(const x of [2,9,16]){instance.update(.5,3,4,false);expect(instance.strikeCrystal(new Vector3(x,3,-44),100)).toBe(true);}expect(instance.gateOpen(1,4,4)).toBe(true);expect(instance.gateOpen(2,5,4)).toBe(true);instance.resetFloor(2);expect(instance.crystalsRemaining).toBe(3);instance.dispose();world.dispose();
 });
 it('ships source-pinned CC0 regional landmarks with verifiable complete GLBs',()=>{
  const manifest=JSON.parse(readFileSync('public/models/pr18/manifest.json','utf8'));expect(manifest.assets.length).toBeGreaterThanOrEqual(15);for(const a of manifest.assets){const b=readFileSync('public/'+a.file);expect(a.license).toBe('CC0-1.0');expect(a.source).toContain('/77343cac874f06b73d16ad0063339df7c9ca254c/');expect(createHash('sha256').update(b).digest('hex')).toBe(a.sha256);const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());expect(doc.meshes.length).toBeGreaterThan(0);expect((doc.images??[]).every((i:{uri?:string})=>!i.uri)).toBe(true);}
 });
});
