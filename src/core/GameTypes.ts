import type { Vector3 } from 'three';

export type ClassId = 'berserker' | 'paladin' | 'assassin' | 'ranger' | 'elementalist' | 'necromancer' | 'monk' | 'lanceman' | 'warlock';
export type HeroState = 'idle' | 'run' | 'jump' | 'doubleJump' | 'fall' | 'climb' | 'swim' | 'dive' | 'slide' | 'mounted' | 'dead';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'ring' | 'amulet';
export type DamageType = 'physical' | 'fire' | 'ice' | 'arcane' | 'holy' | 'poison';

export interface CharacterStats {
  maxHp: number; maxMana: number; attack: number; defense: number;
  speed: number; critChance: number; critMultiplier: number; range: number; attackSpeed: number;
}

export interface Combatant {
  readonly id: string; readonly position: Vector3; readonly radius: number;
  hp: number; readonly maxHp: number; readonly defense: number; readonly alive: boolean;
  readonly team: 'hero' | 'enemy'; readonly invulnerable: boolean;
  receiveDamage(amount: number, knockback?: Vector3): number;
}

export interface HeroInput {
  move: { x: number; y: number }; look: { x: number; y: number };
  attack: boolean; jump: boolean; dash: boolean; mount: boolean;
  dive: boolean; interact: boolean; skill: number | null;
}

export interface SkillDefinition {
  id: string; name: string; description: string; cooldown: number; mana: number;
  multiplier: number; range: number; radius: number;
  shape: 'cone' | 'circle' | 'projectile'; damageType: DamageType; color: number;
  heal?: number; dash?: number;
}

export interface ClassDefinition {
  id: ClassId; name: string; description: string; color: number;
  weapon: 'axe' | 'sword' | 'daggers' | 'bow' | 'staff' | 'scythe' | 'fists' | 'lance' | 'orb';
  stats: CharacterStats; skills: readonly SkillDefinition[];
}

export interface Item {
  id: string; name: string; slot: EquipmentSlot; rarity: Rarity; level: number;
  upgrade: number; attack: number; defense: number; maxHp: number; value: number;
  locked?: boolean;
  gemLevels?: number[];
  sockets?: Array<'ruby' | 'sapphire' | 'emerald' | 'diamond'>;
}

export interface LootDrop {
  id: string; position: Vector3; gold: number; crystals: number; xp: number; item?: Item;
}

export interface GameEvents {
  damage: { position: Vector3; amount: number; critical: boolean; team: 'hero' | 'enemy'; color?: number };
  kill: { kind: string; position: Vector3; level: number; boss: boolean };
  loot: LootDrop;
  message: { text: string; tone?: 'info' | 'success' | 'warning' };
  classChanged: { id: ClassId };
  levelUp: { level: number };
  respawn: undefined;
}

export class EventBus {
  private listeners = new Map<keyof GameEvents, Set<(payload: never) => void>>();
  on<K extends keyof GameEvents>(event: K, listener: (payload: GameEvents[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(listener as (payload: never) => void);
    return () => set.delete(listener as (payload: never) => void);
  }
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(payload as never));
  }
}

export const emptyInput = (): HeroInput => ({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, attack: false, jump: false, dash: false, mount: false, dive: false, interact: false, skill: null });
