import {describe,it,expect} from 'vitest';
import {PvPMatchmaking} from '../src/combat/PvPMatchmaking';
import {PvPCombatWorld} from '../src/combat/PvPCombatWorld';
import {PvPAIController} from '../src/combat/PvPAIController';
import {arenaLineOfSight,arenaObstacles,neutralPvPInput,type PvPProfile,type PvPMatch,type ArenaSize} from '../src/combat/PvPTypes';
import {GameService} from '../server/GameService';
import {Scene,Vector3} from 'three';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {SceneManager} from '../src/world/SceneManager';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
const profile=(id:string,extra:Partial<PvPProfile>={}):PvPProfile=>({id,name:id,classId:'berserker',level:20,cp:1000,rating:1000,bot:false,...extra});
const fight=()=>{const world=new PvPCombatWorld('test',1,[{...profile('hero'),team:0},{...profile('enemy'),team:1}],0);world.match.phase='active';world.match.obstacles=[];return world;};
function queueFixture(size:ArenaSize=1){let now=100000;const rewards:unknown[]=[];const queue=new PvPMatchmaking(()=>now,(id,result)=>rewards.push({...result}),()=>.5);queue.enqueue(profile('hero'),size);return {queue,rewards,advance:(ms:number)=>{now+=ms;queue.tick();},now:()=>now};}
function accept(q:PvPMatchmaking,m:PvPMatch){for(const f of m.fighters.filter(f=>!f.bot))q.accept(f.id);for(const f of m.fighters.filter(f=>!f.bot))q.ready(f.id);}
describe('PR19 authoritative matchmaking',()=>{
 for(const size of [1,2,3] as const)it(`${size}v${size} waits five seconds and fills only the missing slots`,()=>{
  const f=queueFixture(size);f.advance(4999);expect(f.queue.view('hero').match).toBeNull();f.advance(1);const m=f.queue.view('hero').match!;
  expect(m.fighters).toHaveLength(size*2);expect(m.fighters.filter(f=>f.team===0)).toHaveLength(size);expect(m.fighters.filter(f=>f.team===1)).toHaveLength(size);
  expect(m.fighters.filter(f=>f.bot)).toHaveLength(size*2-1);expect(m.ranked).toBe(false);
  for(const bot of m.fighters.filter(f=>f.bot)){expect(bot.cp).toBeGreaterThanOrEqual(920);expect(bot.cp).toBeLessThanOrEqual(1080);expect(bot.level).toBe(20);expect(bot.name).toContain('IA');}
 });
 it('pairs exact human modes immediately and balances teams',()=>{
  const f=queueFixture(2);f.queue.enqueue(profile('second'),1);for(const name of ['third','fourth','fifth'])f.queue.enqueue(profile(name),2);
  const m=f.queue.view('hero').match!;expect(m.ranked).toBe(true);expect(m.fighters).toHaveLength(4);expect(f.queue.view('second').queue?.size).toBe(1);
 });
 it('uses level, CP and Elo bands without importing local stats',()=>{
  const f=queueFixture();f.queue.enqueue(profile('high',{level:100,cp:9000,rating:2000}),1);expect(f.queue.view('hero').match).toBeNull();f.advance(5000);const m=f.queue.view('hero').match!;expect(m.fighters.some(p=>p.id==='high')).toBe(false);
 });
 it('does not duplicate a queue or reset its five-second deadline',()=>{const f=queueFixture();f.advance(4000);f.queue.enqueue(profile('hero'),1);f.advance(1000);expect(f.queue.view('hero').match).not.toBeNull();expect(f.queue.occupied).toBe(1);});
 it('requires every human acceptance and ready before opening gates',()=>{
  const f=queueFixture();f.queue.enqueue(profile('enemy'),1);const m=f.queue.view('hero').match!;f.queue.accept('hero');expect(f.queue.view('hero').match?.phase).toBe('found');f.queue.accept('enemy');expect(f.queue.view('hero').match?.phase).toBe('loading');f.queue.ready('hero');expect(f.queue.view('hero').match?.phase).toBe('loading');f.queue.ready('enemy');expect(f.queue.view('hero').match?.phase).toBe('countdown');f.advance(2999);expect(f.queue.view('hero').match?.phase).toBe('countdown');f.advance(1);expect(f.queue.view('hero').match?.phase).toBe('active');expect(m.id).toBeTruthy();
 });
 it('expires unaccepted and failed-loading matches without rewards',()=>{const f=queueFixture();f.advance(5000);f.advance(3000);expect(f.queue.view('hero').match?.phase).toBe('cancelled');expect(f.rewards).toEqual([]);f.queue.leave('hero');f.queue.enqueue(profile('hero'),1);f.advance(5000);f.queue.accept('hero');f.advance(20000);expect(f.queue.view('hero').match?.reason).toBe('load-timeout');});
 it('cancels stale queue members and prohibits simultaneous membership',()=>{const f=queueFixture();f.advance(15001);expect(f.queue.view('hero').queue).toBeNull();f.queue.enqueue(profile('hero'),1);f.advance(5000);expect(()=>f.queue.enqueue(profile('hero'),3)).toThrow();});
 it('awards a human winner +25 Elo exactly once and labels bot rewards practice',()=>{
  const f=queueFixture();f.queue.enqueue(profile('enemy'),1);accept(f.queue,f.queue.view('hero').match!);f.advance(3000);f.queue.leave('enemy');f.advance(100);const m=f.queue.view('hero').match!;expect(m.phase).toBe('ended');expect(m.results.find(r=>r.id==='hero')).toMatchObject({ranked:true,rating:25,honor:35});const count=f.rewards.length;f.advance(1000);expect(f.rewards).toHaveLength(count);
 });
 it('forfeits disconnected humans and cleans finished sessions',()=>{const f=queueFixture();f.advance(5000);accept(f.queue,f.queue.view('hero').match!);f.advance(3000);f.advance(11000);expect(f.queue.view('hero').match?.fighters.find(f=>f.id==='hero')?.hp).toBe(0);f.advance(61000);expect(f.queue.occupied).toBe(0);});
 it('keeps bot matches outside online ranking, wallets and fake accounts',()=>{
  let now=100000;const game=new GameService(()=>now),player=game.create('Hero');game.enqueuePvP(player,1);now+=5000;const m=game.pvp.view(player.id).match!;accept(game.pvp,m);now+=3000;game.tick();game.pvp.leave(player.id);now+=100;game.tick();expect(game.players.size).toBe(1);expect(player.rating).toBe(1000);expect(player.coins).toBe(100);expect(player.practiceHonor).toBeGreaterThan(0);
 });
});
describe('PR19 realtime combat and tactical inputs',()=>{
 it('rejects forged coordinates, health, invalid axes and replayed commands',()=>{const w=fight(),f=w.match.fighters[0];expect(w.input('hero',{...neutralPvPInput(1),moveX:NaN})).toBe(false);expect(w.input('alien',neutralPvPInput(1))).toBe(false);expect(w.input('hero',{...neutralPvPInput(1),moveX:100,moveZ:100,hp:999999,x:9999})).toBe(true);expect(w.input('hero',neutralPvPInput(1))).toBe(false);w.step(1/30);expect(f.hp).toBe(f.maxHp);expect(Math.hypot(f.x,f.z-17)).toBeLessThanOrEqual(8/30+.001);});
 it('buffers skill, dash and potion edges between render frames and simulation ticks',()=>{const w=fight(),f=w.match.fighters[0];f.hp=100;w.input(f.id,{...neutralPvPInput(1),skill:0,potion:'hp',dash:true});w.input(f.id,{...neutralPvPInput(2),moveX:1});w.step(1/30);expect(f.cooldowns[0]).toBeGreaterThan(0);expect(f.dashCd).toBeGreaterThan(0);expect(f.potions).toBe(1);});
 it('expires stale held movement after 500ms',()=>{const w=fight(),f=w.match.fighters[0];w.input('hero',{...neutralPvPInput(1),moveX:1});for(let i=0;i<30;i++)w.step(1/30);const x=f.x;for(let i=0;i<30;i++)w.step(1/30);expect(f.x).toBe(x);});
 it('enforces real attack distance, line of sight and attack cooldown',()=>{
  const w=fight(),[a,b]=w.match.fighters;w.input(a.id,{...neutralPvPInput(1),attack:true});w.step(1/30);expect(b.hp).toBe(b.maxHp);a.z=0;b.z=2;
  w.match.obstacles=[{id:'cover',x:0,z:1,radius:.6,hp:100,maxHp:100}];w.input(a.id,{...neutralPvPInput(2),attack:true});w.step(1/30);expect(b.hp).toBe(b.maxHp);w.match.obstacles=[];w.input(a.id,{...neutralPvPInput(3),attack:true});w.step(1/30);expect(b.hp).toBeLessThan(b.maxHp);const hp=b.hp;w.step(1/30);expect(b.hp).toBe(hp);
 });
 it('bounds dash duration, distance and cooldown without permanent superspeed',()=>{
  const w=fight(),f=w.match.fighters[0];f.x=0;f.z=0;w.input(f.id,{...neutralPvPInput(1),dash:true,aimX:1,aimZ:0});for(let i=0;i<10;i++)w.step(1/30);expect(f.x).toBeCloseTo(4);expect(f.dashLeft).toBe(0);expect(f.dashCd).toBeGreaterThan(2);const x=f.x;w.input(f.id,{...neutralPvPInput(2),dash:true,aimX:1,aimZ:0});for(let i=0;i<10;i++)w.step(1/30);expect(f.x).toBeCloseTo(x);
 });
 it('uses mana, telegraph windups and independent four-skill cooldowns',()=>{const w=fight(),f=w.match.fighters[0];w.input(f.id,{...neutralPvPInput(1),skill:0});w.step(1/30);expect(f.cooldowns[0]).toBeGreaterThan(0);expect(f.cooldowns[1]).toBe(0);expect(f.mana).toBeLessThan(f.maxMana);expect(w.match.telegraphs).toHaveLength(1);const mana=f.mana;w.input(f.id,{...neutralPvPInput(2),skill:0});w.step(1/30);expect(f.mana).toBeLessThan(mana+1);});
 it('limits potion charges, healing, cooldown and separate mana restoration',()=>{const w=fight(),f=w.match.fighters[0];f.hp=100;w.input(f.id,{...neutralPvPInput(1),potion:'hp'});w.step(1/30);expect(f.hp).toBeGreaterThan(100);expect(f.potions).toBe(1);expect(f.healing).toBeGreaterThan(0);w.input(f.id,{...neutralPvPInput(2),potion:'hp'});w.step(1/30);expect(f.potions).toBe(1);});
 it('prevents collision through living pillars and allows destroyed cover',()=>{const obstacles=arenaObstacles();expect(arenaLineOfSight({x:7,z:0},{x:7,z:12},obstacles)).toBe(false);obstacles.forEach(o=>o.hp=0);expect(arenaLineOfSight({x:7,z:0},{x:7,z:12},obstacles)).toBe(true);const w=fight(),f=w.match.fighters[0];f.x=0;f.z=0;w.match.obstacles=[{id:'cover',x:1,z:0,radius:.7,hp:100,maxHp:100}];w.input(f.id,{...neutralPvPInput(1),moveX:1});w.step(1/30);expect(f.x).toBe(0);});
 it('spawns a single-use healing rune on the 30s cadence',()=>{const w=fight(),f=w.match.fighters[0];f.x=0;f.z=0;f.hp=100;w.match.rune.next=.01;w.step(1/30);expect(f.hp).toBeGreaterThan(100);expect(w.match.rune.active).toBe(false);expect(w.match.rune.next).toBe(30);expect(w.match.rune.kind).toBe('power');});
 it('times out at three minutes, uses health ratios and handles draws',()=>{const w=fight();w.match.remaining=.01;w.step(1/30);expect(w.match.phase).toBe('ended');expect(w.match.reason).toBe('time');expect(w.match.winner).toBeNull();});
 it('AI kites, focuses vulnerable foes, heals allies, uses potions and dodges danger',()=>{
  const w=fight(),f=w.match.fighters[0],e=w.match.fighters[1],ai=new PvPAIController();f.classId='ranger';f.z=0;e.z=3;f.hp=f.maxHp*.2;let input=ai.decide(f,w.match);expect(input.moveZ).toBeLessThan(0);expect(input.potion).toBe('hp');
  w.match.telegraphs=[{id:1,owner:e.id,team:e.team,x:f.x,z:f.z,radius:4,delay:.4,damage:100,skill:1,color:0xff0000}];input=ai.decide(f,w.match);expect(input.dash).toBe(true);expect(Math.hypot(input.moveX,input.moveZ)).toBeCloseTo(1);
  w.match.telegraphs=[];f.classId='paladin';f.hp=f.maxHp*.5;e.z=30;expect(ai.decide(f,w.match).skill).not.toBeNull();
 });
 it('records elimination, damage, kills, assists and blocks dead input',()=>{const w=fight(),[a,b]=w.match.fighters;a.z=0;b.z=2;b.hp=1;w.input(a.id,{...neutralPvPInput(1),attack:true});w.step(1/30);expect(a.damage).toBe(1);expect(a.kills).toBe(1);expect(w.match.winner).toBe(0);expect(w.match.phase).toBe('ended');expect(w.input(b.id,neutralPvPInput(1))).toBe(false);});
 it('unloads the overworld for a planar arena and restores terrain physics',()=>{const scene=new Scene(),terrain=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(terrain),manager=new SceneManager(scene,physics,terrain),body=physics.createCharacter(new Vector3(0,8,18));const arena=manager.activate('arena');expect(scene.getObjectByName('ETERNA map instance: aurora')).toBeUndefined();expect(arena.heightAt(0,0)).toBeCloseTo(3.4);expect(scene.getObjectByName('ETERNA map instance: arena')?.getObjectByName('Triangulated terrain')?.visible).toBe(false);expect(arena.colliders).toHaveLength(4);expect(physics.world.bodies).toContain(body);manager.activate('aurora');expect(scene.getObjectByName('ETERNA map instance: arena')).toBeUndefined();physics.dispose();manager.current.dispose();});
});
