import { describe, expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { EventBus, type Combatant, type Item, type LootDrop } from '../src/core/GameTypes';
import { CLASS_DEFINITIONS, CLASS_IDS, calculateDamage } from '../src/combat/ClassSystem';
import { CombatSystem } from '../src/combat/CombatSystem';
import { HeroStateMachine } from '../src/player/HeroStateMachine';
import { HeroController } from '../src/player/HeroController';
import { BaseBuilding } from '../src/rpg/BaseBuilding';
import { CodexSystem } from '../src/rpg/CodexSystem';
import { EQUIPMENT_SLOTS, InventoryAndLoot, ITEM_CATALOG, RARITIES, xpForLevel } from '../src/rpg/InventoryAndLoot';

const createInventory = (seed = 123) => new InventoryAndLoot(new EventBus(), seed);
const makeDrop = (overrides: Partial<LootDrop> = {}): LootDrop => ({ id: 'test-drop', position: new Vector3(), gold: 13, crystals: 2, xp: 21, ...overrides });
const context = (overrides: Partial<Parameters<HeroStateMachine['update']>[1]> = {}) => ({ grounded: true, moving: false, inWater: false, canClimb: false, verticalVelocity: 0, mounted: false, dead: false, dive: false, ...overrides });
const advance = (machine: HeroStateMachine, seconds: number, state = context()) => {
  const frames = Math.ceil(seconds / 0.05);
  for (let i = 0; i < frames; i++) machine.update(seconds / frames, state);
};
const actor = (id: string, team: 'hero' | 'enemy', position = new Vector3()): Combatant & { mana: number; consumeMana: (cost: number) => boolean; heal: (amount: number) => void } => ({
  id, team, position, radius: 0.5, hp: 1000, maxHp: 1000, defense: 20, invulnerable: false, mana: 200,
  get alive() { return this.hp > 0; },
  receiveDamage(amount: number) { const dealt = Math.min(this.hp, Math.max(0, amount)); this.hp -= dealt; return dealt; },
  consumeMana(cost: number) { if (this.mana < cost) return false; this.mana -= cost; return true; },
  heal(amount: number) { this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount)); },
});

describe('combat damage and playable classes', () => {
  it('mitigates armor, scales skills and applies a critical multiplier', () => {
    expect(calculateDamage(100, 0)).toBe(100);
    expect(calculateDamage(100, 100)).toBe(50);
    expect(calculateDamage(100, 100, 2, true, 1.75)).toBe(175);
    expect(calculateDamage(100, 300)).toBe(25);
  });

  it('cannot heal a target through negative or invalid attack values', () => {
    expect(calculateDamage(-50, 0)).toBe(0);
    expect(calculateDamage(0, 30)).toBe(0);
    expect(calculateDamage(NaN, 20)).toBe(0);
    expect(calculateDamage(Infinity, 0)).toBe(0);
    expect(calculateDamage(20, -500)).toBe(20);
  });

  it('has nine unique classes with nine weapon archetypes and 36 valid skills', () => {
    expect(new Set(CLASS_IDS).size).toBe(9);
    expect(new Set(CLASS_IDS.map(id => CLASS_DEFINITIONS[id].weapon)).size).toBe(9);
    const skills = CLASS_IDS.flatMap(id => {
      const definition = CLASS_DEFINITIONS[id];
      expect(definition.id).toBe(id);
      expect(definition.stats.maxHp).toBeGreaterThan(0);
      expect(definition.stats.attack).toBeGreaterThan(0);
      expect(definition.stats.speed).toBeGreaterThan(0);
      expect(definition.stats.critChance).toBeGreaterThanOrEqual(0);
      expect(definition.stats.critChance).toBeLessThanOrEqual(1);
      expect(definition.skills).toHaveLength(4);
      return definition.skills;
    });
    expect(new Set(skills.map(skill => skill.id)).size).toBe(36);
    for (const skill of skills) {
      expect(skill.cooldown).toBeGreaterThan(0);
      expect(skill.mana).toBeGreaterThanOrEqual(0);
      expect(skill.range).toBeGreaterThanOrEqual(0);
      if (skill.shape !== 'circle') expect(skill.range).toBeGreaterThan(0);
      expect(skill.radius).toBeGreaterThan(0);
      expect(skill.multiplier).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('combat hitboxes, combos and cooldown transactions', () => {
  it('hits only living hostile targets inside the melee cone and preserves the combo cadence', () => {
    const events = new EventBus();
    const combat = new CombatSystem(new Scene(), events);
    const hero = actor('hero', 'hero');
    const front = actor('front', 'enemy', new Vector3(0, 0, -2));
    const behind = actor('behind', 'enemy', new Vector3(0, 0, 3));
    const distant = actor('distant', 'enemy', new Vector3(0, 0, -20));
    const airborne = actor('airborne', 'enemy', new Vector3(0, 20, -2));
    const ally = actor('ally', 'hero', new Vector3(0, 0, -2));
    const stats = { ...CLASS_DEFINITIONS.berserker.stats, critChance: 0 };
    const targets = [front, behind, distant, airborne, ally];
    const hits: number[] = [];
    events.on('damage', ({ amount }) => hits.push(amount));
    expect(combat.attack(hero, targets, stats, new Vector3(0, 0, -1))).toBe(true);
    expect(front.hp).toBe(1000 - calculateDamage(stats.attack, front.defense));
    expect([behind.hp, distant.hp, airborne.hp, ally.hp]).toEqual([1000, 1000, 1000, 1000]);
    expect(combat.attack(hero, targets, stats, new Vector3(0, 0, -1))).toBe(false);
    combat.update(0.7);
    combat.attack(hero, targets, stats, new Vector3(0, 0, -1));
    combat.update(0.7);
    combat.attack(hero, targets, stats, new Vector3(0, 0, -1));
    expect(combat.combo).toBe(3);
    expect(hits).toHaveLength(3);
    expect(hits[2]).toBe(calculateDamage(stats.attack, front.defense, 1.65));
    expect(combat.hitstop).toBeGreaterThan(0);
    combat.dispose();
  });

  it('spends mana only on a successful cast and prevents recasting until its actual cooldown expires', () => {
    const combat = new CombatSystem(new Scene(), new EventBus());
    const hero = actor('hero', 'hero');
    const target = actor('target', 'enemy', new Vector3(0, 0, -2));
    const stats = { ...CLASS_DEFINITIONS.berserker.stats, critChance: 0 };
    const skill = CLASS_DEFINITIONS.berserker.skills[0];
    const facing = new Vector3(0, 0, -1);
    hero.mana = skill.mana - 1;
    expect(combat.cast(0, 'berserker', hero, [target], stats, facing)).toBe(false);
    expect(combat.cooldowns[0]).toBe(0);
    expect(target.hp).toBe(1000);
    hero.mana = 200;
    expect(combat.cast(0, 'berserker', hero, [target], stats, facing)).toBe(true);
    expect(hero.mana).toBe(200 - skill.mana);
    expect(combat.cooldowns[0]).toBe(skill.cooldown);
    expect(combat.cast(0, 'berserker', hero, [target], stats, facing)).toBe(false);
    expect(hero.mana).toBe(200 - skill.mana);
    combat.update(skill.cooldown);
    expect(combat.cast(0, 'berserker', hero, [target], stats, facing)).toBe(true);
    expect(hero.mana).toBe(200 - skill.mana * 2);
    combat.dispose();
  });

  it('detects a ranged projectile crossing a target between frames instead of tunneling through it', () => {
    const combat = new CombatSystem(new Scene(), new EventBus());
    const hero = actor('hero', 'hero');
    const target = actor('target', 'enemy', new Vector3(0, 0, -5));
    const stats = { ...CLASS_DEFINITIONS.ranger.stats, critChance: 0 };
    combat.attack(hero, [target], stats, new Vector3(0, 0, -1));
    expect(target.hp).toBe(1000);
    combat.update(0.3);
    expect(target.hp).toBe(1000 - calculateDamage(stats.attack, target.defense));
    combat.update(0.3);
    expect(target.hp).toBe(1000 - calculateDamage(stats.attack, target.defense));
    combat.dispose();
  });
});

describe('catalogue, drops and inventory transactions', () => {
  it('generates 144 complete items spanning every slot and rarity without shared mutable instances', () => {
    expect(ITEM_CATALOG).toHaveLength(144);
    expect(new Set(ITEM_CATALOG.map(item => item.id)).size).toBe(144);
    for (const slot of EQUIPMENT_SLOTS) for (const rarity of RARITIES) {
      expect(ITEM_CATALOG.filter(item => item.slot === slot && item.rarity === rarity)).toHaveLength(4);
    }
    expect(Object.isFrozen(ITEM_CATALOG)).toBe(true);
    expect(Object.isFrozen(ITEM_CATALOG[0])).toBe(true);
    expect(ITEM_CATALOG.every(item => item.value > 0 && item.level > 0 && item.attack + item.defense + item.maxHp > 0)).toBe(true);
  });

  it('has starter equipment that immediately affects real combat stats', () => {
    const inventory = createInventory();
    expect(inventory.items).toHaveLength(6);
    expect(Object.keys(inventory.equipment)).toHaveLength(6);
    const stats = inventory.getStatBonuses();
    expect(stats.attack).toBeGreaterThan(0);
    expect(stats.defense).toBeGreaterThan(0);
    expect(stats.maxHp).toBeGreaterThan(0);
  });

  it('produces deterministic drops with unique instance IDs and guaranteed boss equipment', () => {
    const first = createInventory(42);
    const second = createInventory(42);
    const sequence = Array.from({ length: 30 }, () => first.generateLoot('slime', 7));
    expect(sequence).toEqual(Array.from({ length: 30 }, () => second.generateLoot('slime', 7)));
    expect(new Set(sequence.map(drop => drop.id)).size).toBe(sequence.length);
    const ordinary = createInventory(4).generateLoot('golem', 12);
    const boss = createInventory(4).generateLoot('boss', 12, true);
    expect(boss.item).toBeDefined();
    expect(RARITIES.indexOf(boss.item!.rarity)).toBeGreaterThanOrEqual(2);
    expect(boss.gold).toBeGreaterThan(ordinary.gold);
    expect(boss.xp).toBeGreaterThan(ordinary.xp);
  });

  it('credits a pickup once even when hero and companion reach it together', () => {
    const inventory = createInventory();
    const before = { gold: inventory.gold, crystals: inventory.crystals, xp: inventory.xp };
    const item: Item = { ...ITEM_CATALOG[0], id: 'found-weapon' };
    const drop = makeDrop({ item });
    inventory.addLoot(drop);
    inventory.addLoot(drop);
    expect(inventory.gold).toBe(before.gold + 13);
    expect(inventory.crystals).toBe(before.crystals + 2);
    expect(inventory.xp).toBe(before.xp + 21);
    expect(inventory.items.filter(candidate => candidate.id === item.id)).toHaveLength(1);
  });

  it('rejects nonexistent items and enforces item level requirements', () => {
    const inventory = createInventory();
    expect(inventory.equip('missing')).toBe(false);
    const highItem = { ...ITEM_CATALOG.find(item => item.slot === 'weapon' && item.level === 20)!, id: 'high-level' };
    inventory.addLoot(makeDrop({ item: highItem }));
    expect(inventory.equip(highItem.id)).toBe(false);
    inventory.addXp(100000);
    expect(inventory.level).toBeGreaterThanOrEqual(20);
    expect(inventory.equip(highItem.id)).toBe(true);
  });

  it('upgrades equipment with an atomic resource payment and increased stats', () => {
    const inventory = createInventory();
    const weapon = inventory.items.find(item => item.slot === 'weapon')!;
    const previous = { attack: weapon.attack, gold: inventory.gold, crystals: inventory.crystals };
    const price = inventory.upgradeCost(weapon.id);
    expect(inventory.upgrade(weapon.id)).toBe(true);
    expect(weapon.upgrade).toBe(1);
    expect(weapon.attack).toBeGreaterThan(previous.attack);
    expect(inventory.gold).toBe(previous.gold - price.gold);
    expect(inventory.crystals).toBe(previous.crystals - price.crystals);
    inventory.gold = 0;
    const snapshot = inventory.snapshot();
    expect(inventory.upgrade(weapon.id)).toBe(false);
    expect(inventory.snapshot()).toEqual(snapshot);
  });

  it('protects equipped gear from sale and pays for unequipped loot exactly once', () => {
    const inventory = createInventory();
    expect(inventory.sell(inventory.equipment.weapon!)).toBe(false);
    const item = { ...ITEM_CATALOG[0], id: 'sellable' };
    inventory.addLoot(makeDrop({ item, gold: 0, crystals: 0, xp: 0 }));
    const gold = inventory.gold;
    expect(inventory.sell(item.id)).toBe(true);
    expect(inventory.gold).toBe(gold + item.value);
    expect(inventory.sell(item.id)).toBe(false);
  });

  it('automatically sells overflow drops rather than losing them', () => {
    const inventory = createInventory();
    inventory.items = Array.from({ length: inventory.capacity }, (_, i) => ({ ...ITEM_CATALOG[0], id: `packed-${i}` }));
    const gold = inventory.gold;
    inventory.addLoot(makeDrop({ item: { ...ITEM_CATALOG[0], id: 'overflow' }, gold: 0, crystals: 0, xp: 0 }));
    expect(inventory.items).toHaveLength(inventory.capacity);
    expect(inventory.gold).toBe(gold + ITEM_CATALOG[0].value);
  });

  it('roundtrips a save without keeping mutable aliases or invalid equipment references', () => {
    const inventory = createInventory();
    inventory.upgrade(inventory.equipment.weapon!);
    inventory.addXp(450);
    const snapshot = inventory.snapshot();
    const restored = createInventory();
    restored.restore(JSON.parse(JSON.stringify(snapshot)));
    expect(restored.snapshot()).toEqual(snapshot);
    snapshot.items[0].attack = 99999;
    expect(restored.items[0].attack).not.toBe(99999);
    const invalid = restored.snapshot();
    invalid.equipment.weapon = 'does-not-exist';
    invalid.gold = NaN;
    restored.restore(invalid);
    expect(restored.equipment.weapon).toBeUndefined();
    expect(restored.gold).toBe(0);
    expect(() => restored.restore(null)).not.toThrow();
  });
});

describe('level progression', () => {
  it('crosses several increasing thresholds while preserving the remainder', () => {
    const events = new EventBus();
    const levels: number[] = [];
    events.on('levelUp', ({ level }) => levels.push(level));
    const inventory = new InventoryAndLoot(events);
    const amount = xpForLevel(1) + xpForLevel(2) + 17;
    const before = inventory.getStatBonuses();
    inventory.addXp(amount);
    expect(inventory.level).toBe(3);
    expect(inventory.xp).toBe(17);
    expect(levels).toEqual([2, 3]);
    expect(inventory.getStatBonuses().attack).toBe(before.attack + 4);
    expect(inventory.getStatBonuses().maxHp).toBe(before.maxHp + 24);
  });

  it('ignores invalid rewards and stops at the level cap', () => {
    const inventory = createInventory();
    inventory.addXp(-100);
    inventory.addXp(Infinity);
    expect(inventory.level).toBe(1);
    expect(inventory.xp).toBe(0);
    inventory.addXp(1000000000);
    expect(inventory.level).toBe(100);
    expect(inventory.xp).toBe(0);
    expect(inventory.xpToNext).toBe(0);
  });
});

describe('vital statistics and pickup persistence regressions', () => {
  // These operations need no scene, input or physics; use the production prototype
  // while providing only the character's already-initialized vital statistics.
  const heroWithVitals = (hp: number, mana: number): HeroController => {
    const hero = Object.create(HeroController.prototype) as HeroController;
    hero.stats = { ...CLASS_DEFINITIONS.berserker.stats };
    hero.hp = hp;
    hero.mana = mana;
    return hero;
  };

  it('cannot manufacture health or mana by repeatedly changing equipment or class stat caps', () => {
    const hero = heroWithVitals(72, 27);
    const originalStats = { ...hero.stats };
    for (let i = 0; i < 20; i++) {
      hero.setStats({ ...originalStats, maxHp: originalStats.maxHp + 140, maxMana: originalStats.maxMana + 60 });
      expect(hero.hp / hero.maxHp).toBeCloseTo(0.4, 10);
      expect(hero.mana / hero.stats.maxMana).toBeCloseTo(0.3, 10);
      hero.setStats(originalStats);
    }
    expect(hero.hp).toBeCloseTo(72, 10);
    expect(hero.mana).toBeCloseTo(27, 10);
  });

  it('keeps a dead hero dead when level or equipment bonuses change the maximum health', () => {
    const hero = heroWithVitals(0, 0);
    hero.setStats({ ...hero.stats, maxHp: hero.maxHp + 120, maxMana: hero.stats.maxMana + 40 });
    expect(hero.hp).toBe(0);
    expect(hero.alive).toBe(false);
    hero.setStats(CLASS_DEFINITIONS.assassin.stats);
    expect(hero.hp).toBe(0);
    expect(hero.alive).toBe(false);
  });

  it('persists every part of a completed level-up pickup and refuses to award it again after reload', () => {
    const events = new EventBus();
    const inventory = new InventoryAndLoot(events, 17);
    inventory.addXp(xpForLevel(1) - 1);
    const drop = makeDrop({ id: 'level-up-treasure', xp: 21, item: { ...ITEM_CATALOG[0], id: 'level-up-weapon' } });
    let saved: ReturnType<InventoryAndLoot['snapshot']> | undefined;
    // Match the application boundary: persist after the whole pickup has completed.
    events.on('loot', loot => { inventory.addLoot(loot); saved = inventory.snapshot(); });
    events.emit('loot', drop);
    expect(saved).toBeDefined();
    const restored = createInventory();
    restored.restore(JSON.parse(JSON.stringify(saved)));
    expect(restored.level).toBe(2);
    expect(restored.xp).toBe(20);
    expect(restored.items.some(item => item.id === 'level-up-weapon')).toBe(true);
    const beforeDuplicate = restored.snapshot();
    restored.addLoot(drop);
    expect(restored.snapshot()).toEqual(beforeDuplicate);
  });
});

describe('village production and codex collection', () => {
  it('charges the advertised building cost and increases its permanent buff', () => {
    const inventory = createInventory();
    const base = new BaseBuilding(inventory, new EventBus());
    const before = { gold: inventory.gold, crystals: inventory.crystals, attack: base.getBuffs().attack };
    const cost = base.cost('forge');
    expect(base.upgrade('forge')).toBe(true);
    expect(inventory.gold).toBe(before.gold - cost.gold);
    expect(inventory.crystals).toBe(before.crystals - cost.crystals);
    expect(base.getBuffs().attack).toBeGreaterThan(before.attack);
    inventory.gold = 0;
    const levels = base.snapshot();
    expect(base.upgrade('forge')).toBe(false);
    expect(base.snapshot()).toEqual(levels);
    expect(base.upgrade('unknown')).toBe(false);
  });

  it('has frame-rate-independent production and retains fractional production in saves', () => {
    const first = createInventory();
    const second = createInventory();
    const fast = new BaseBuilding(first, new EventBus());
    const slow = new BaseBuilding(second, new EventBus());
    for (let i = 0; i < 600; i++) fast.update(0.1);
    slow.update(60);
    expect(first.gold).toBe(second.gold);
    expect(first.crystals).toBe(second.crystals);
    expect(first.gold).toBe(348);
    expect(first.crystals).toBe(16);
    const saved = fast.snapshot();
    const restored = new BaseBuilding(first, new EventBus());
    restored.restore(saved);
    expect(restored.snapshot()).toEqual(saved);
  });

  it('unlocks a codex bonus only at its kill threshold and caps permanent stacks', () => {
    const events = new EventBus();
    const messages: string[] = [];
    events.on('message', ({ text }) => messages.push(text));
    const codex = new CodexSystem(events);
    for (let i = 0; i < 4; i++) codex.recordKill('slime');
    expect(codex.getBuffs().maxHp).toBe(0);
    codex.recordKill('slime');
    expect(codex.getBuffs().maxHp).toBe(8);
    expect(messages).toHaveLength(1);
    for (let i = 0; i < 200; i++) codex.recordKill('slime');
    expect(codex.getBuffs().maxHp).toBe(40);
    codex.recordKill('ancient-titan', true);
    expect(codex.getBuffs().attack).toBe(5);
    expect(codex.getBuffs().maxHp).toBe(60);
    const restored = new CodexSystem(new EventBus());
    restored.restore(codex.snapshot());
    expect(restored.getBuffs()).toEqual(codex.getBuffs());
  });
});

describe('hero locomotion state machine', () => {
  it('allows a double jump, blocks a third jump and resets on landing', () => {
    const machine = new HeroStateMachine();
    expect(machine.tryJump()).toBe(true);
    expect(machine.state).toBe('jump');
    machine.update(0.1, context({ grounded: false, verticalVelocity: 4 }));
    expect(machine.tryJump()).toBe(true);
    expect(machine.state).toBe('doubleJump');
    expect(machine.tryJump()).toBe(false);
    machine.update(0.1, context({ grounded: false, verticalVelocity: -2 }));
    machine.update(0.1, context({ grounded: true }));
    expect(machine.jumpCount).toBe(0);
    expect(machine.canJump).toBe(true);
  });

  it('makes slide invulnerable temporarily and prevents cooldown bypass', () => {
    const machine = new HeroStateMachine();
    expect(machine.tryDash()).toBe(true);
    expect(machine.state).toBe('slide');
    expect(machine.invulnerable).toBe(true);
    expect(machine.tryDash()).toBe(false);
    advance(machine, 0.33);
    expect(machine.invulnerable).toBe(false);
    advance(machine, 0.1);
    expect(machine.state).not.toBe('slide');
    expect(machine.tryDash()).toBe(false);
    advance(machine, 2.6);
    expect(machine.tryDash()).toBe(true);
  });

  it('transitions through swim, dive, mounted and irreversible death until respawn', () => {
    const machine = new HeroStateMachine();
    machine.update(0.1, context({ inWater: true, grounded: false }));
    expect(machine.state).toBe('swim');
    machine.update(0.1, context({ inWater: true, grounded: false, dive: true }));
    expect(machine.state).toBe('dive');
    machine.update(0.1, context({ mounted: true }));
    expect(machine.state).toBe('mounted');
    expect(machine.tryDash()).toBe(false);
    machine.update(0.1, context({ dead: true }));
    expect(machine.state).toBe('dead');
    expect(machine.tryJump()).toBe(false);
    expect(machine.tryDash()).toBe(false);
    expect(machine.transition('run')).toBe(false);
    machine.reset();
    expect(machine.state).toBe('idle');
    expect(machine.tryJump()).toBe(true);
  });
});
