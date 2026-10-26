import { describe,it,expect } from 'vitest';
import { emptyInput, EventBus } from '../src/core/GameTypes';
import { planFarm } from '../src/systems/VipAndAutoFarm';
import { epigraphEffects,cooldownMultiplier } from '../src/rpg/ClassEpigraphSystem';
import { DUNGEONS,dungeonVariant } from '../src/world/Regions';
import { translateText } from '../src/ui/I18n';
import { CLASS_DEFINITIONS,CLASS_IDS } from '../src/combat/ClassSystem';
import { ITEM_CATALOG,scaleWorldItem } from '../src/rpg/InventoryAndLoot';
import { GameService } from '../server/GameService';
const context=()=>({vip:true,enabled:true,alive:true,inDungeon:false,level:5,x:0,z:0,hp:30,maxHp:100,mana:25,maxMana:100,healthThreshold:.5,manaThreshold:.5,input:emptyInput()});
describe('integrated GDD rules',()=>{
 it('scales endgame drops without mutating the immutable base catalogue',()=>{const template=ITEM_CATALOG.find(i=>i.slot==='weapon'&&i.level===20&&i.rarity==='mythic')!;const item=scaleWorldItem(template,88);expect(item.level).toBe(85);expect(item.attack).toBeGreaterThan(template.attack);expect(template.level).toBe(20);});
 it('auto farm requires active VIP and stops on manual control, death or dungeon entry',()=>{const c=context();expect(planFarm(c,[]).stop).toBe(false);for(const update of [{vip:false},{alive:false},{inDungeon:true},{input:{...emptyInput(),attack:true}}])expect(planFarm({...c,...update},[]).stop).toBe(true);});
 it('farms nearby living appropriate-level monsters, never bosses',()=>{const candidates=[{id:'boss',alive:true,boss:true,level:5,position:{x:1,z:1}},{id:'overlevel',alive:true,boss:false,level:20,position:{x:2,z:1}},{id:'safe',alive:true,boss:false,level:6,position:{x:4,z:4}}];const d=planFarm(context(),candidates);expect(d.target?.id).toBe('safe');expect(d.healthPotion).toBe(true);expect(d.manaPotion).toBe(true);expect(planFarm({...context(),hp:60,mana:80},candidates).healthPotion).toBe(false);});
 it('class specialization changes actual effects and bounds cooldown reductions',()=>{expect(epigraphEffects('berserker',{power:100}).armorPenetration).toBe(.35);expect(epigraphEffects('necromancer',{guard:100}).lifeSteal).toBe(.12);expect(epigraphEffects('elementalist',{precision:100}).spellPower).toBe(.3);expect(epigraphEffects('ranger',{vitality:50}).companionPower).toBe(.2);expect(cooldownMultiplier(10000)).toBe(.8);});
 it('scales every dungeon difficulty without mutating its base definition',()=>{for(const base of DUNGEONS){const elite=dungeonVariant(base,'elite'),abyss=dungeonVariant(base,'abyssal');expect(elite.level).toBeGreaterThan(base.level);expect(abyss.gold).toBeGreaterThan(elite.gold);expect(abyss.waves).toBeGreaterThan(base.waves);expect(dungeonVariant(base,'normal')).toMatchObject({id:base.id,level:base.level,waves:base.waves,gold:base.gold,crystals:base.crystals});}});
 it('translates all nine class descriptions, 36 skills and 144 catalog items',()=>{for(const id of CLASS_IDS){const c=CLASS_DEFINITIONS[id];expect(translateText(c.description,'en')).not.toBe(c.description);for(const s of c.skills){expect(translateText(s.name,'en')).not.toBe(s.name);expect(translateText(s.description,'en')).not.toBe(s.description);}}for(const item of ITEM_CATALOG)expect(translateText(item.name,'en')).not.toBe(item.name);expect(translateText('ruby','pt')).toContain('Rubi');});
 it('rejects malformed unicode tokens instead of failing the timing-safe comparator',()=>{const g=new GameService();g.create('Tester');expect(()=>g.authenticate('á'.repeat(64))).toThrow('Session required');});
 it('runs tactical actions only for already matched players who opted in',()=>{let now=100000;const g=new GameService(()=>now),a=g.create('Alpha'),b=g.create('Bravo');g.enqueue(a,1);g.tick();expect(g.matches.size).toBe(0);g.enqueue(b,1);g.fight(a,'tactical',b.id);g.tick();const m=[...g.matches.values()][0],hp=m.fighters.find(f=>f.id===b.id)!.hp;expect(hp).toBeLessThan(1200);g.tick();expect(m.fighters.find(f=>f.id===b.id)!.hp).toBe(hp);now+=3000;g.tick();expect(m.fighters.find(f=>f.id===b.id)!.hp).toBeLessThan(hp);});
});

describe('dungeon floors',()=>{
 it('requires three complete floor bosses and cannot award completion twice',async()=>{
  const {Scene,Vector3}=await import('three');const {DungeonBossManager}=await import('../src/enemies/DungeonBossManager');
  const spawned:Array<{hp:number;maxHp:number;alive:boolean;position:InstanceType<typeof Vector3>}> = [];
  const enemies={terrainHeight:()=>0,spawn:(_kind:string,position:InstanceType<typeof Vector3>)=>{const e={hp:100,maxHp:100,get alive(){return this.hp>0;},position,deathTime:0,setBossPresentation:()=>{}};spawned.push(e);return e;}};
  const {EnemyAI}=await import('../src/enemies/EnemyAI');
  const manager=new DungeonBossManager(new Scene(),enemies as unknown as InstanceType<typeof EnemyAI>,new EventBus(),new Vector3());
  const hero={id:'hero',position:new Vector3(),radius:.5,hp:100,maxHp:100,defense:10,alive:true,team:'hero' as const,invulnerable:false,receiveDamage:()=>0};
  expect(manager.start(hero,{...DUNGEONS[0],level:1},1)).toBe(true);
  const floors=new Set<number>();
  for(let i=0;i<80&&manager.active;i++){floors.add(manager.floor);spawned.forEach(e=>e.hp=0);manager.update(6,hero);}
  expect([...floors]).toEqual([1,2,3]);expect(manager.completed).toBe(true);expect(manager.clears).toBe(1);manager.update(10,hero);expect(manager.clears).toBe(1);manager.dispose();
 });
});
