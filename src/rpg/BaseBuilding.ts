import { EventBus } from '../core/GameTypes';
import { InventoryAndLoot, type StatBonuses } from './InventoryAndLoot';

export interface Building {
  id: string; name: string; description: string; level: number; maxLevel: number;
  baseGold: number; baseCrystals: number; icon: string;
}

export class BaseBuilding {
  buildings: Building[] = [
    { id: 'forge', name: 'Forja da Aurora', description: '+3 ataque por nível. Os ferreiros fortalecem suas armas.', level: 1, maxLevel: 10, baseGold: 90, baseCrystals: 2, icon: '⚒' },
    { id: 'alchemy', name: 'Torre de Alquimia', description: '+14 vida por nível. Produz cristais a cada 40 segundos por nível.', level: 1, maxLevel: 10, baseGold: 110, baseCrystals: 2, icon: '✧' },
    { id: 'stable', name: 'Estábulo dos Guardiões', description: '+2 defesa e +6 vida por nível. Equipamentos de proteção para a expedição.', level: 1, maxLevel: 10, baseGold: 80, baseCrystals: 1, icon: '♞' },
    { id: 'mine', name: 'Mina de Âmbar', description: 'Produz 0,8 ouro por segundo por nível, enquanto a expedição está ativa.', level: 1, maxLevel: 10, baseGold: 100, baseCrystals: 1, icon: '◆' },
  ];
  private pendingGold = 0;
  private pendingCrystals = 0;

  constructor(private inventory: InventoryAndLoot, private events: EventBus) {}

  cost(id: string): { gold: number; crystals: number } {
    const building = this.buildings.find(candidate => candidate.id === id);
    if (!building || building.level >= building.maxLevel) return { gold: Infinity, crystals: Infinity };
    return {
      gold: Math.round(building.baseGold * Math.pow(1.65, building.level - 1)),
      crystals: building.baseCrystals + Math.floor((building.level - 1) * 1.5),
    };
  }

  upgrade(id: string): boolean {
    const building = this.buildings.find(candidate => candidate.id === id);
    if (!building || building.level >= building.maxLevel) return false;
    const cost = this.cost(id);
    if (this.inventory.gold < cost.gold || this.inventory.crystals < cost.crystals) {
      this.events.emit('message', { text: 'Recursos insuficientes para evoluir o edifício', tone: 'warning' });
      return false;
    }
    this.inventory.gold -= cost.gold;
    this.inventory.crystals -= cost.crystals;
    building.level++;
    this.events.emit('message', { text: `${building.name} agora é nível ${building.level}`, tone: 'success' });
    return true;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, 60);
    this.pendingGold += elapsed * this.buildings.find(building => building.id === 'mine')!.level * 0.8;
    this.pendingCrystals += elapsed * this.buildings.find(building => building.id === 'alchemy')!.level / 40;
    const gold = Math.floor(this.pendingGold + 1e-9);
    const crystals = Math.floor(this.pendingCrystals + 1e-9);
    this.inventory.gold += gold;
    this.inventory.crystals += crystals;
    this.pendingGold -= gold;
    this.pendingCrystals -= crystals;
  }

  getBuffs(): StatBonuses {
    const level = (id: string): number => this.buildings.find(building => building.id === id)!.level;
    return { attack: level('forge') * 3, defense: level('stable') * 2, maxHp: level('alchemy') * 14 + level('stable') * 6 };
  }

  snapshot(): { version: 1; levels: Record<string, number>; pendingGold: number; pendingCrystals: number } {
    return { version: 1, levels: Object.fromEntries(this.buildings.map(building => [building.id, building.level])), pendingGold: this.pendingGold, pendingCrystals: this.pendingCrystals };
  }

  restore(snapshot: unknown): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const data = snapshot as Record<string, unknown>;
    if (data.version !== 1 || !data.levels || typeof data.levels !== 'object') return;
    const levels = data.levels as Record<string, unknown>;
    for (const building of this.buildings) {
      const value = levels[building.id];
      if (typeof value === 'number' && Number.isFinite(value)) building.level = Math.min(building.maxLevel, Math.max(1, Math.floor(value)));
    }
    this.pendingGold = typeof data.pendingGold === 'number' && Number.isFinite(data.pendingGold) ? Math.min(0.999999999, Math.max(0, data.pendingGold)) : 0;
    this.pendingCrystals = typeof data.pendingCrystals === 'number' && Number.isFinite(data.pendingCrystals) ? Math.min(0.999999999, Math.max(0, data.pendingCrystals)) : 0;
  }
}
