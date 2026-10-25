import {upgradeItem as applyUpgrade} from './InventorySystem';
import { EventBus, type EquipmentSlot, type Item, type LootDrop, type Rarity } from '../core/GameTypes';

export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet'];
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#b6c5ce', uncommon: '#6cdd9d', rare: '#64b7ff', epic: '#bc8aff', legendary: '#ffcc73', mythic: '#ff809b',
};
export const ALL_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [...EQUIPMENT_SLOTS,'gloves','belt'];
const rarityNames = ['do Viajante', 'do Bosque', 'da Aurora', 'do Eclipse', 'dos Antigos', 'da Eternidade'];
const slotNames: Record<EquipmentSlot, string> = { weapon: 'Lâmina', helmet: 'Elmo', armor: 'Couraça', boots: 'Botas', ring: 'Anel', amulet: 'Amuleto',gloves:'Manoplas',belt:'Cinto' };
const tierNames = ['', ' Temperado', ' Rúnico', ' Celestial'];
const tiers = [1, 5, 10, 20];
const rarityPower = [1, 1.32, 1.8, 2.5, 3.5, 5];

/** Immutable catalogue; looted items are independent copies with unique instance IDs. */
export const ITEM_CATALOG: readonly Item[] = Object.freeze(EQUIPMENT_SLOTS.flatMap(slot =>
  RARITIES.flatMap((rarity, rarityIndex) => tiers.map((level, tier) => {
    const power = rarityPower[rarityIndex] * (1 + level * 0.16);
    return Object.freeze({
      id: `catalog-${slot}-${rarity}-${level}`,
      name: `${slotNames[slot]}${tierNames[tier]} ${rarityNames[rarityIndex]}`,
      slot, rarity, level, upgrade: 0,
      attack: Math.round(power * (slot === 'weapon' ? 7 : slot === 'ring' ? 3 : slot === 'amulet' ? 2 : 0)),
      defense: Math.round(power * (slot === 'armor' ? 6 : slot === 'helmet' ? 3 : slot === 'boots' ? 2 : slot === 'ring' ? 1 : 0)),
      maxHp: Math.round(power * (slot === 'armor' ? 17 : slot === 'amulet' ? 24 : slot === 'helmet' ? 9 : slot === 'boots' ? 5 : 0)),
      value: Math.round(12 * power * (rarityIndex + 1)),
    });
  }))),
);

/** 45 equippable and forgeable authored-GLB weapon themes, awarded via boss loot. */
export const WEAPON_PACK_ITEM_TEMPLATES:readonly Item[]=Object.freeze(WEAPON_PACKS.map(pack=>Object.freeze({
  id:'catalog-'+pack.id,
  visualId:pack.id,
  name:pack.name[0],
  slot:'weapon' as const,
  rarity:pack.rarity,
  level:[1,15,35,60,85][pack.tier],
  requiredLevel:[1,15,35,60,85][pack.tier],
  upgrade:0,attack:Math.round(12*Math.pow(1.65,pack.tier)),
  defense:Math.round(2*Math.pow(1.4,pack.tier)),maxHp:0,
  value:Math.round(150*Math.pow(2,pack.tier))
})));
/** Additional wearable slots coexist with the immutable original catalogue/save format. */
export const COMPLETE_ITEM_CATALOG:readonly Item[]=Object.freeze([...ITEM_CATALOG,...WEAPON_PACK_ITEM_TEMPLATES,...(['gloves','belt'] as const).flatMap(slot=>RARITIES.flatMap((rarity,r)=>tiers.map(level=>Object.freeze({id:`catalog-${slot}-${rarity}-${level}`,name:`${slotNames[slot]} ${rarityNames[r]}`,slot,rarity,level,upgrade:0,attack:slot==='gloves'?Math.round(rarityPower[r]*(1+level*.16)*2):0,defense:Math.round(rarityPower[r]*(1+level*.16)*2),maxHp:Math.round(rarityPower[r]*(1+level*.16)*8),value:Math.round(12*rarityPower[r]*(1+level*.16)*(r+1))}))))]);

export interface StatBonuses { attack: number; defense: number; maxHp: number; maxMana?: number; critChance?: number }
export interface InventorySnapshot {
  version: 1; items: Item[]; equipment: Partial<Record<EquipmentSlot, string>>;
  gold: number; crystals: number; level: number; xp: number; sequence: number; randomState: number; collected: string[];
}

export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(level) ? level : 1) - 1);
  return Math.floor(100 + n * 65 + Math.pow(n, 1.65) * 16);
}

function numberIn(value: unknown, min: number, max: number, fallback = min): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readItem(value: unknown): Item | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.length || value.id.length > 160 || typeof value.name !== 'string') return;
  if (!ALL_EQUIPMENT_SLOTS.includes(value.slot as EquipmentSlot) || !RARITIES.includes(value.rarity as Rarity)) return;
  const item: Item = {
    id: value.id, name: value.name.slice(0, 100), slot: value.slot as EquipmentSlot, rarity: value.rarity as Rarity,
    level: numberIn(value.level, 1, 115), upgrade: numberIn(value.upgrade, 0, 15),
    attack: numberIn(value.attack, 0, 100000), defense: numberIn(value.defense, 0, 100000),
    maxHp: numberIn(value.maxHp, 0, 1000000), value: numberIn(value.value, 1, 1000000),
  };
  if (typeof value.requiredLevel==='number')item.requiredLevel=numberIn(value.requiredLevel,1,100);
  if(value.slot==='weapon'&&typeof value.visualId==='string'&&WEAPON_PACK_BY_ID.has(value.visualId))item.visualId=value.visualId;
  if (value.locked === true) item.locked = true;
  if (Array.isArray(value.sockets)) item.sockets = value.sockets.filter((gem): gem is 'ruby'|'sapphire'|'emerald'|'diamond' => ['ruby','sapphire','emerald','diamond'].includes(gem)).slice(0, [1,1,2,3,3,4][RARITIES.indexOf(item.rarity)]);
  if(item.sockets) item.gemLevels=item.sockets.map((_,i)=>Array.isArray(value.gemLevels)&&value.gemLevels[i]===2?2:1);
  return item;
}

/** Preserve the base catalogue while extending world drops to the monster's level tier. */
export function scaleWorldItem(template:Item,monsterLevel:number):Item {
  const level=Math.max(template.level,Math.min(100,Math.floor(monsterLevel/5)*5));
  const ratio=(1+level*.16)/(1+template.level*.16);
  return {...template,level,attack:Math.round(template.attack*ratio),defense:Math.round(template.defense*ratio),maxHp:Math.round(template.maxHp*ratio),value:Math.round(template.value*ratio)};
}

export class InventoryAndLoot {
  readonly capacity = 240;
  items: Item[] = [];
  equipment: Partial<Record<EquipmentSlot, string>> = {};
  gold = 300;
  crystals = 15;
  level = 1;
  xp = 0;
  private randomState: number;
  private sequence = 0;
  private collected = new Set<string>();

  constructor(private events: EventBus, seed = 0x9e3779b9) {
    this.randomState = seed >>> 0;
    for (const slot of EQUIPMENT_SLOTS) {
      const template = ITEM_CATALOG.find(item => item.slot === slot && item.rarity === 'common' && item.level === 1)!;
      const item = { ...template, id: `starter-${slot}` };
      this.items.push(item);
      this.equipment[slot] = item.id;
    }
  }

  get xpToNext(): number { return this.level >= 100 ? 0 : xpForLevel(this.level); }

  private random(): number {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let t = this.randomState;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  generateLoot(kind: string, level: number, boss = false): Omit<LootDrop, 'position'> {
    const safeLevel = numberIn(level, 1, 100, 1);
    const roll = this.random();
    const rarityIndex = boss
      ? roll < 0.04 ? 5 : roll < 0.19 ? 4 : roll < 0.58 ? 3 : 2
      : roll < 0.004 ? 5 : roll < 0.022 ? 4 : roll < 0.085 ? 3 : roll < 0.26 ? 2 : roll < 0.58 ? 1 : 0;
    const slot = ALL_EQUIPMENT_SLOTS[Math.floor(this.random() * ALL_EQUIPMENT_SLOTS.length)];
    const itemLevel = [...tiers].reverse().find(tier => tier <= safeLevel) ?? 1;
    const realPackDrops=slot==='weapon'&&boss
      ?WEAPON_PACK_ITEM_TEMPLATES.filter(item=>item.rarity===RARITIES[rarityIndex]&&item.requiredLevel!<=safeLevel)
      :[];
    const selectedPack=realPackDrops.length&&roll<.55
      ?realPackDrops[Math.floor(this.random()*realPackDrops.length)]:undefined;
    const template = selectedPack??COMPLETE_ITEM_CATALOG.find(item => item.slot === slot && item.rarity === RARITIES[rarityIndex] && item.level === itemLevel)!;
    const id = `drop-${++this.sequence}-${Math.floor(this.random() * 0xffffff).toString(36)}`;
    return {
      id,
      gold: Math.round((5 + safeLevel * 3) * (boss ? 14 : 1) * (0.85 + this.random() * 0.45)),
      crystals: boss ? 3 + Math.floor(safeLevel / 4) : this.random() < 0.12 ? 1 : 0,
      xp: Math.round((12 + safeLevel * 9) * (boss ? 12 : kind === 'golem' ? 1.7 : 1)),
      item: boss || this.random() < 0.48 ? { ...scaleWorldItem(template,safeLevel), id: `${template.id}-${id}` } : undefined,
    };
  }

  addLoot(drop: LootDrop): void {
    if (!drop || typeof drop.id !== 'string' || this.collected.has(drop.id)) return;
    this.collected.add(drop.id);
    // IDs need only span the currently reachable world drops, keeping long sessions bounded.
    if (this.collected.size > 4096) this.collected.delete(this.collected.values().next().value!);
    this.gold += numberIn(drop.gold, 0, 10000000);
    this.crystals += numberIn(drop.crystals, 0, 100000);
    this.addXp(numberIn(drop.xp, 0, 10000000));
    const item = readItem(drop.item);
    if (item && !this.items.some(existing => existing.id === item.id)) {
      if (this.items.length < this.capacity) {
        this.items.push(item);
        this.events.emit('message', { text: `${item.name} encontrado`, tone: 'success' });
      } else {
        this.gold += item.value;
        this.events.emit('message', { text: `Mochila cheia: item vendido por ${item.value} ouro`, tone: 'info' });
      }
    }
  }

  addXp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0 || this.level >= 100) return;
    this.xp += Math.floor(amount);
    while (this.level < 100 && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.events.emit('levelUp', { level: this.level });
    }
    if (this.level === 100) this.xp = 0;
  }

  equip(itemId: string): boolean {
    const item = this.items.find(candidate => candidate.id === itemId);
    if (!item || (item.requiredLevel??item.level) > this.level) return false;
    this.equipment[item.slot] = item.id;
    this.events.emit('message', { text: `${item.name} equipado`, tone: 'success' });
    return true;
  }

  upgradeCost(itemId: string): { gold: number; crystals: number } {
    const item = this.items.find(candidate => candidate.id === itemId);
    if (!item || item.upgrade >= 15) return { gold: Infinity, crystals: Infinity };
    return { gold: Math.round(25 * Math.pow(1.48, item.upgrade) * (1 + RARITIES.indexOf(item.rarity) * 0.3)), crystals: Math.max(1, Math.floor(item.upgrade / 3) + 1) };
  }

  upgradeItem(itemId:string):boolean {
    const result=applyUpgrade(this,itemId);
    if(!result.ok){this.events.emit('message',{text:result.reason==='resources'?'Ouro ou cristais insuficientes na Forja':'Item indisponível para refino',tone:'warning'});return false;}
    this.events.emit('message',{text:`${result.item.name} +${result.item.upgrade} — aprimoramento concluído`,tone:'success'});return true;
  }
  upgrade(itemId:string):boolean {return this.upgradeItem(itemId);}

  sell(itemId: string): boolean {
    const index = this.items.findIndex(candidate => candidate.id === itemId);
    if (index === -1 || this.items[index].locked || this.items[index].sockets?.length || Object.values(this.equipment).includes(itemId)) return false;
    this.gold += this.items[index].value;
    this.items.splice(index, 1);
    return true;
  }

  getStatBonuses(): StatBonuses {
    const bonuses = { maxMana:0,critChance:0,attack: (this.level - 1) * 2, defense: this.level - 1, maxHp: (this.level - 1) * 12 };
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      const item = this.items.find(candidate => candidate.id === this.equipment[slot] && candidate.slot === slot);
      if (!item) continue;
      bonuses.attack += item.attack;
      bonuses.defense += item.defense;
      bonuses.maxHp += item.maxHp;
      (item.sockets ?? []).forEach((gem,index)=>{
        const power=item.gemLevels?.[index]===2?2.5:1;
        if (gem==='ruby') bonuses.attack+=Math.round(4*power);
        if (gem==='sapphire') bonuses.maxMana+=Math.round(12*power);
        if (gem==='emerald') bonuses.critChance+=.005*power;
        if (gem==='diamond') bonuses.defense+=Math.round(4*power);
      });
    }
    return bonuses;
  }

  snapshot(): InventorySnapshot {
    return {
      version: 1, items: this.items.map(item => ({ ...item, ...(item.sockets ? { sockets: [...item.sockets], gemLevels:[...(item.gemLevels??[])] } : {}) })), equipment: { ...this.equipment },
      gold: this.gold, crystals: this.crystals, level: this.level, xp: this.xp,
      sequence: this.sequence, randomState: this.randomState, collected: [...this.collected].slice(-512),
    };
  }

  restore(snapshot: unknown): void {
    if (!isRecord(snapshot) || snapshot.version !== 1 || !Array.isArray(snapshot.items)) return;
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const raw of snapshot.items.slice(0, this.capacity)) {
      const item = readItem(raw);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    this.items = items;
    this.equipment = {};
    if (isRecord(snapshot.equipment)) {
      for (const slot of ALL_EQUIPMENT_SLOTS) {
        const id = snapshot.equipment[slot];
        if (typeof id === 'string' && items.some(item => item.id === id && item.slot === slot)) this.equipment[slot] = id;
      }
    }
    this.gold = numberIn(snapshot.gold, 0, 1e12);
    this.crystals = numberIn(snapshot.crystals, 0, 1e9);
    this.level = numberIn(snapshot.level, 1, 100, 1);
    this.xp = numberIn(snapshot.xp, 0, Math.max(0, this.xpToNext - 1));
    this.sequence = numberIn(snapshot.sequence, 0, Number.MAX_SAFE_INTEGER);
    this.randomState = numberIn(snapshot.randomState, 0, 0xffffffff, this.randomState);
    this.collected = new Set(Array.isArray(snapshot.collected) ? snapshot.collected.filter((id): id is string => typeof id === 'string' && id.length < 200).slice(-512) : []);
  }
}
