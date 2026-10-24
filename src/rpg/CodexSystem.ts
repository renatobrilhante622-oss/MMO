import { EventBus } from '../core/GameTypes';
import type { StatBonuses } from './InventoryAndLoot';

export interface CodexEntry {
  id: string; name: string; description: string; kills: number; required: number; bonus: string;
  attack: number; defense: number; maxHp: number;
}

export class CodexSystem {
  entries: CodexEntry[] = [
    { id: 'slime', name: 'Gosma do Bosque', description: 'Essências vivas que absorvem a energia das raízes.', kills: 0, required: 5, bonus: '+8 vida a cada 5 derrotas (máx. 5 coleções)', attack: 0, defense: 0, maxHp: 8 },
    { id: 'wolf', name: 'Lobo Cinzento', description: 'Caçadores velozes das clareiras de Aetheria.', kills: 0, required: 8, bonus: '+2 ataque a cada 8 derrotas (máx. 5 coleções)', attack: 2, defense: 0, maxHp: 0 },
    { id: 'skeleton', name: 'Sentinela Esquelética', description: 'Os guardas esquecidos de um reino perdido.', kills: 0, required: 8, bonus: '+2 defesa a cada 8 derrotas (máx. 5 coleções)', attack: 0, defense: 2, maxHp: 0 },
    { id: 'golem', name: 'Golem de Pedra', description: 'Fragmentos da montanha animados por magia antiga.', kills: 0, required: 5, bonus: '+3 defesa a cada 5 derrotas (máx. 5 coleções)', attack: 0, defense: 3, maxHp: 0 },
    { id: 'wraith', name: 'Espectro do Eclipse', description: 'Espíritos que guardam o caminho para o portal.', kills: 0, required: 6, bonus: '+3 ataque a cada 6 derrotas (máx. 5 coleções)', attack: 3, defense: 0, maxHp: 0 },
    { id: 'boss', name: 'Colosso da Fenda', description: 'Um titã de múltiplas fases que comanda a masmorra.', kills: 0, required: 1, bonus: '+5 ataque e +20 vida por vitória (máx. 5 coleções)', attack: 5, defense: 0, maxHp: 20 },
  ];

  constructor(private events: EventBus) {}

  recordKill(kind: string, boss = false): void {
    const id = boss ? 'boss' : kind;
    let entry = this.entries.find(candidate => candidate.id === id);
    if (!entry) {
      if (!/^[a-z0-9_-]{1,40}$/i.test(id) || this.entries.length >= 64) return;
      entry = { id, name: id.replace(/[-_]/g, ' '), description: 'Criatura descoberta durante a expedição.', kills: 0, required: 10, bonus: '+1 ataque por coleção de 10 derrotas (máx. 5 coleções)', attack: 1, defense: 0, maxHp: 0 };
      this.entries.push(entry);
    }
    const previous = Math.min(5, Math.floor(entry.kills / entry.required));
    entry.kills = Math.min(1000000000, entry.kills + 1);
    const current = Math.min(5, Math.floor(entry.kills / entry.required));
    if (current > previous) this.events.emit('message', { text: `Coleção ${entry.name}: bônus permanente desbloqueado!`, tone: 'success' });
  }

  getBuffs(): StatBonuses {
    return this.entries.reduce((buffs, entry) => {
      const completed = Math.min(5, Math.floor(entry.kills / entry.required));
      buffs.attack += entry.attack * completed;
      buffs.defense += entry.defense * completed;
      buffs.maxHp += entry.maxHp * completed;
      return buffs;
    }, { attack: 0, defense: 0, maxHp: 0 });
  }

  snapshot(): { version: 1; kills: Record<string, number> } {
    return { version: 1, kills: Object.fromEntries(this.entries.map(entry => [entry.id, entry.kills])) };
  }

  restore(snapshot: unknown): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const data = snapshot as Record<string, unknown>;
    if (data.version !== 1 || !data.kills || typeof data.kills !== 'object') return;
    const kills = data.kills as Record<string, unknown>;
    for (const entry of this.entries) {
      const value = kills[entry.id];
      entry.kills = typeof value === 'number' && Number.isFinite(value) ? Math.min(1000000000, Math.max(0, Math.floor(value))) : 0;
    }
    for (const [id, value] of Object.entries(kills)) {
      if (this.entries.some(entry => entry.id === id) || !/^[a-z0-9_-]{1,40}$/i.test(id) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || this.entries.length >= 64) continue;
      this.entries.push({ id, name: id.replace(/[-_]/g, ' '), description: 'Criatura descoberta durante a expedição.', kills: Math.min(1000000000, Math.floor(value)), required: 10, bonus: '+1 ataque por coleção de 10 derrotas (máx. 5 coleções)', attack: 1, defense: 0, maxHp: 0 });
    }
  }
}
