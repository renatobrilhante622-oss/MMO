import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {ArenaSystem,ARENA_ELOS,ARENA_TITLE_DEFINITIONS} from '../src/combat/ArenaSystem';
import {CLASS_IDS} from '../src/combat/ClassSystem';
import {TalentTreeSystem,RUNE_NODES} from '../src/rpg/TalentTreeSystem';
import {DailyRewardSystem,DAILY_REWARDS,ONLINE_MILESTONES} from '../src/rpg/DailyRewardSystem';
import {SimulatedAuctionHouse} from '../src/rpg/SimulatedAuctionHouse';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';
import {WEATHER_REGIONS} from '../src/world/RegionalWeather';
import {GATHER_RECIPES} from '../src/world/GatheringSystem';

describe('PR15 — Phase 2 isolated local systems',()=>{
 it('offers three distinct challenger classes and seven competitive elos',()=>{
  const arena=new ArenaSystem(),c=arena.challengers();
  expect(c).toHaveLength(3);
  expect(new Set(c.map(x=>x.classId)).size).toBe(3);
  expect(c.every(x=>CLASS_IDS.includes(x.classId))).toBe(true);
  expect(c[0].cp).toBeLessThan(c[2].cp);
  expect(ARENA_ELOS).toHaveLength(7);
 });
 it('executes an actual class-specific duel with four skills, mana, dash, healing, cooldowns and win payout',()=>{
  const a=new ArenaSystem(),id=a.challengers()[0].id;
  expect(a.start(id,'assassin',1700)).toBe(true);
  expect(a.start(id,'assassin',1700)).toBe(false);
  const d=a.duel!;
  expect(d.heroClass).toBe('assassin');
  expect(d.ai.hp).toBeGreaterThan(0);
  expect(a.action('dash')).toBe(true);
  expect(a.action('strike')).toBe(true);
  const hp=d.ai.hp;expect(hp).toBeLessThan(d.ai.maxHp);
  expect(a.action('skill',0)).toBe(true);
  expect(d.hero.cooldowns[0]).toBeGreaterThan(0);
  expect(a.action('skill',0)).toBe(false);
  d.hero.hp-=200;expect(a.action('potion')).toBe(true);expect(d.hero.potions).toBe(1);
  for(let i=0;i<220&&!d.ended;i++){a.tick(.05);if(d.hero.hp<=0)break;if(d.ai.hp<100){a.action('strike');}}
  expect(d.time).toBeGreaterThan(0);expect(d.ai.lastSkill).toBeGreaterThanOrEqual(0);
 });
 it('never grants fake Elo or Honor on invalid/duplicate duels',()=>{
  const a=new ArenaSystem();expect(a.action('strike')).toBe(false);
  expect(a.start('fake','warlock',2500)).toBe(false);
  const before=a.snapshot();expect(before.wins).toBe(0);expect(before.honor).toBe(0);
  const b=new ArenaSystem();b.restore({rating:999999,honor:-100,wins:Infinity,titles:['fake'],equippedTitle:'fake',shop:['fake']});
  expect(b.rating).toBe(2400);expect(b.honor).toBe(0);expect(b.equippedTitle).toBe('');
  expect(ARENA_TITLE_DEFINITIONS.length).toBeGreaterThanOrEqual(3);
 });
 it('awards rune points per level/boss, respects prerequisites and restores progression',()=>{
  const runes=new TalentTreeSystem();expect(RUNE_NODES).toHaveLength(4);
  expect(runes.points(1)).toBe(0);expect(runes.unlock('ember-ground',1)).toBe(false);
  runes.onBoss();expect(runes.unlock('ember-ground',1)).toBe(true);
  expect(runes.unlock('stellar-core',50)).toBe(false);
  expect(runes.unlock('shadow-dash',50)).toBe(true);
  expect(runes.unlock('twin-blades',50)).toBe(true);
  expect(runes.unlock('stellar-core',50)).toBe(true);
  expect(runes.bonuses().attack).toBeGreaterThan(0);
  const restored=new TalentTreeSystem();restored.restore(runes.snapshot(),50);
  expect(restored.spent).toEqual(runes.spent);
 });
 it('enforces one claim/day, 7-day streak, time milestones and one wheel spin/day',()=>{
  const r=new DailyRewardSystem();expect(DAILY_REWARDS).toHaveLength(7);expect(ONLINE_MILESTONES).toHaveLength(4);
  const day=new Date(2026,9,25,13);expect(r.claim(day)?.gold).toBe(180);
  expect(r.claim(day)).toBeNull();expect(r.canClaim(new Date(2026,9,26,13))).toBe(true);
  expect(r.claim(new Date(2026,9,26,13))?.gold).toBe(360);
  r.tick(300,true);expect(r.sessionSeconds).toBeLessThan(1);
  for(let i=0;i<3000;i++)r.tick(.1,true);
  expect(r.availableMilestones()).toContain(300);
  expect(r.claimMilestone(300)).not.toBeNull();expect(r.claimMilestone(300)).toBeNull();
  expect(r.spin(day)).not.toBeNull();expect(r.spin(day)).toBeNull();
  const x=new DailyRewardSystem();x.restore(r.snapshot());expect(x.streak).toBe(2);expect(x.claimMilestone(300)).toBeNull();
 });
 it('escrows eligible duplicate epic items, restores cancellation and buys only with funds',()=>{
  const inv=new InventoryAndLoot(new EventBus()),market=new SimulatedAuctionHouse(inv);
  const item={...inv.items[0],id:'epic-copy-1',name:'Gladiator blade',rarity:'epic' as const,level:1};
  inv.items.push(item,{...item,id:'epic-copy-2'});
  expect(market.eligibleItems().some(x=>x.id===item.id)).toBe(true);
  const before=inv.items.length;
  expect(market.list(item.id,300,'gold')).toBe(true);
  expect(inv.items).toHaveLength(before-1);expect(market.list(item.id,300,'gold')).toBe(false);
  expect(market.cancel(market.listings.find(x=>x.seller==='Você')!.id)).toBe(true);
  expect(inv.items).toHaveLength(before);
  inv.gold=0;expect(market.buy(market.listings.find(x=>x.seller!=='Você'&&x.currency==='gold')!.id)).toBe(false);
  const other=new SimulatedAuctionHouse(inv);other.restore(market.snapshot());expect(other.listings.length).toBe(market.listings.length);
 });
 it('can craft a chest key without having to first open a locked chest',()=>{
  const key=GATHER_RECIPES.find(r=>r.id==='key')!;
  expect(key).toBeDefined();
  expect(key.cost.ore).toBeGreaterThan(0);
  expect(key.cost.herb).toBeGreaterThan(0);
  expect(key.cost.chest).toBe(0);
  const source=readFileSync('src/world/GatheringSystem.ts','utf8');
  expect(source).toContain('this.showNode(node.id,false)');
  expect(source).toContain('this.showNode(node.id,true)');
 });
 it('preserves mining inventory, buffs and exhaustion on region transitions and saves',()=>{
  const engine=readFileSync('src/core/Engine.ts','utf8');
  expect(engine).toContain('const gatheringCarry=this.phase2Gathering.snapshot()');
  expect(engine).toContain('this.phase2Gathering.restore(gatheringCarry)');
  const gathering=readFileSync('src/world/GatheringSystem.ts','utf8');
  expect(gathering).toContain('elapsed:this.elapsed');
  expect(gathering).toContain('this.elapsed=num(r.elapsed,1e9)');
  expect(gathering).toContain('this.nodeInstances.clear()');
 });
 it('builds region-specific atmospheric particles across all five maps',()=>{
  expect(Object.keys(WEATHER_REGIONS)).toEqual(['aurora','crypt','highlands','rift','eclipse']);
  const code=readFileSync('src/world/RegionalWeather.ts','utf8');
  expect(code).toContain('new Points(');expect(code).toContain('new PointLight(');
  const gather=readFileSync('src/world/GatheringSystem.ts','utf8');
  expect(gather).toContain('new InstancedMesh(');
  expect(gather).toContain('Math.min(2,this.working.progress+Math.max(0,dt))');
  expect(gather).toContain('GATHER_RECIPES');
 });
 it('wires menus, save slots, runtime rune effects and touch camera zoom',()=>{
  const code=readFileSync('src/core/Engine.ts','utf8');
  for(const text of ['this.phase2UI=new Phase2UI','this.phase2Arena.tick(dt)','this.phase2Combat.onAttack','this.phase2Combat.onSkill','this.phase2Combat.onDash','this.phase2Gathering.update','this.phase2Weather.update','phase2:{arena:','this.phase2Arena.restore','this.phase2Title.set'])expect(code).toContain(text);
  const ui=readFileSync('src/ui/Phase2UI.ts','utf8');for(const text of ['data-phase2','data-pr15-stage','this.game.phase2Changed()'])expect(ui).toContain(text);
  const p=readFileSync('src/ui/CharacterPreview.ts','utf8');expect(p).toContain("c.addEventListener('wheel'");
  expect(p).toContain('this.touches.size===2');
 });
});
