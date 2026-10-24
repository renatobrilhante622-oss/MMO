import type { CharacterStats, ClassDefinition, ClassId, DamageType, SkillDefinition } from '../core/GameTypes';

export const CLASS_IDS: ClassId[] = ['berserker', 'paladin', 'assassin', 'ranger', 'elementalist', 'necromancer', 'monk', 'lanceman', 'warlock'];

const stats = (maxHp: number, maxMana: number, attack: number, defense: number, speed: number, range: number, attackSpeed: number, critChance = .12): CharacterStats => ({ maxHp, maxMana, attack, defense, speed, range, attackSpeed, critChance, critMultiplier: 1.8 });
const skill = (id: string, name: string, description: string, shape: SkillDefinition['shape'], damageType: DamageType, color: number, multiplier: number, cooldown: number, mana: number, range: number, radius: number, extra: Partial<SkillDefinition> = {}): SkillDefinition => ({ id, name, description, shape, damageType, color, multiplier, cooldown, mana, range, radius, ...extra });

export const CLASS_DEFINITIONS: Record<ClassId, ClassDefinition> = {
  berserker: { id: 'berserker', name: 'Berserker', description: 'Machado brutal. Combos pesados e controle em área.', color: 0xf77945, weapon: 'axe', stats: stats(180, 90, 26, 16, 6.4, 3.1, 1.7), skills: [
    skill('cleave', 'Corte Sísmico', 'Um golpe em cone que empurra os inimigos.', 'cone', 'physical', 0xff9748, 2.2, 5, 15, 5.5, 3),
    skill('whirlwind', 'Turbilhão', 'A lâmina varre todos ao redor do guerreiro.', 'circle', 'physical', 0xff6a30, 2.6, 9, 22, 0, 6),
    skill('bloodrage', 'Fúria do Sangue', 'Ruptura violenta que restaura parte da vida.', 'circle', 'physical', 0xe3344e, 1.6, 14, 28, 0, 5, { heal: .2 }),
    skill('meteoraxe', 'Machado Celeste', 'Uma onda incandescente atravessa a linha de frente.', 'projectile', 'fire', 0xffbc55, 4.2, 22, 38, 22, 2.5),
  ] },
  paladin: { id: 'paladin', name: 'Paladin', description: 'Espada sagrada. Armadura firme e cura restauradora.', color: 0xffdf8b, weapon: 'sword', stats: stats(205, 120, 20, 28, 5.7, 3, 1.5, .08), skills: [
    skill('smite', 'Julgamento', 'Luz sagrada golpeia os inimigos à frente.', 'cone', 'holy', 0xffe7a3, 2.5, 6, 16, 6, 2),
    skill('sanctuary', 'Santuário', 'O círculo de luz restaura 35% da vida.', 'circle', 'holy', 0xfff2b4, 1.2, 16, 30, 0, 5, { heal: .35 }),
    skill('radiance', 'Lança Radiante', 'Dispara uma lança de luz com impacto explosivo.', 'projectile', 'holy', 0xffd65c, 3, 10, 24, 24, 1.8),
    skill('divineverdict', 'Veredito Divino', 'Consagra uma vasta área e recupera vitalidade.', 'circle', 'holy', 0xfff3df, 4, 25, 45, 0, 9, { heal: .25 }),
  ] },
  assassin: { id: 'assassin', name: 'Assassin', description: 'Adagas velozes. Críticos e ataques de precisão.', color: 0xc486f0, weapon: 'daggers', stats: stats(125, 110, 23, 10, 8, 2.6, 2.8, .3), skills: [
    skill('shadowcut', 'Corte Sombrio', 'Uma rajada de lâminas corta o alvo à frente.', 'cone', 'physical', 0xb882ed, 2.8, 4, 14, 6, 2),
    skill('venomstar', 'Estrela Venenosa', 'Uma estrela envenenada explode no contato.', 'projectile', 'poison', 0x91ed86, 2.5, 7, 20, 25, 1.3),
    skill('deathblossom', 'Flor da Morte', 'Adagas atingem todos ao redor.', 'circle', 'physical', 0xdb8dfc, 3.3, 11, 28, 0, 5),
    skill('nightfall', 'Anoitecer', 'Onda de sombras com grande dano crítico.', 'projectile', 'arcane', 0xb447fc, 5, 21, 42, 26, 2),
  ] },
  ranger: { id: 'ranger', name: 'Ranger', description: 'Arco de precisão. Domina o combate à distância.', color: 0x93dca2, weapon: 'bow', stats: stats(135, 110, 21, 12, 7, 19, 1.9, .2), skills: [
    skill('piercingarrow', 'Flecha Perfurante', 'Projétil rápido de longo alcance.', 'projectile', 'physical', 0xc5ef9b, 2.6, 5, 14, 35, .65),
    skill('multishot', 'Disparo em Leque', 'Uma salva cobre o cone à frente.', 'cone', 'physical', 0x9ee5b0, 2.2, 8, 22, 17, 6),
    skill('naturepulse', 'Pulso da Floresta', 'A energia natural repele inimigos próximos e cura.', 'circle', 'poison', 0x62dd92, 2, 14, 28, 0, 7, { heal: .18 }),
    skill('starfallarrow', 'Flecha Estelar', 'Projétil explosivo que atinge uma ampla área.', 'projectile', 'arcane', 0x8cfff1, 4.6, 23, 40, 38, 3),
  ] },
  elementalist: { id: 'elementalist', name: 'Elementalist', description: 'Cajado elemental. Fogo, gelo e tempestade.', color: 0x6ccfea, weapon: 'staff', stats: stats(115, 180, 28, 8, 6.1, 17, 1.6, .13), skills: [
    skill('fireball', 'Bola de Fogo', 'Uma esfera ardente explode ao atingir seu alvo.', 'projectile', 'fire', 0xff8642, 2.8, 5, 18, 28, 2.6),
    skill('frostnova', 'Nova Gélida', 'Cristais de gelo explodem ao redor.', 'circle', 'ice', 0x9de5ff, 2.4, 10, 26, 0, 7),
    skill('stormwave', 'Onda da Tempestade', 'Raios em cone atingem uma longa faixa.', 'cone', 'arcane', 0xafb3ff, 3, 12, 30, 15, 6),
    skill('cataclysm', 'Cataclismo', 'O poder dos elementos causa uma explosão maciça.', 'circle', 'fire', 0xffc05b, 5.5, 26, 55, 0, 11),
  ] },
  necromancer: { id: 'necromancer', name: 'Necromancer', description: 'Foice ritual. Drena vida e domina almas.', color: 0x99dcac, weapon: 'scythe', stats: stats(130, 160, 24, 13, 6, 3.8, 1.7, .15), skills: [
    skill('soulreap', 'Ceifar Almas', 'A foice rouba vitalidade dos inimigos à frente.', 'cone', 'arcane', 0xa6e5c1, 2.4, 6, 18, 7, 4, { heal: .12 }),
    skill('plague', 'Peste Espectral', 'Uma esfera pestilenta detona no impacto.', 'projectile', 'poison', 0x7edc87, 2.8, 9, 25, 25, 2.3),
    skill('gravecircle', 'Círculo dos Mortos', 'Energia ancestral atinge inimigos próximos.', 'circle', 'arcane', 0x9db5d7, 3, 13, 32, 0, 8),
    skill('soulharvest', 'Colheita Final', 'Ceifa a área inteira e restaura 40% da vida.', 'circle', 'arcane', 0xc8fce1, 4.5, 26, 48, 0, 10, { heal: .4 }),
  ] },
  monk: { id: 'monk', name: 'Monk', description: 'Punhos de jade. Ritmo rápido e energia vital.', color: 0xe9ba76, weapon: 'fists', stats: stats(160, 125, 19, 20, 7.4, 2.7, 3.1, .2), skills: [
    skill('tigerpalm', 'Palma do Tigre', 'Golpe concentrado com grande empurrão.', 'cone', 'physical', 0xffc582, 2.8, 4, 12, 4.7, 2),
    skill('dragonbreath', 'Sopro do Dragão', 'Energia flamejante se projeta em cone.', 'cone', 'fire', 0xffae55, 2.6, 8, 20, 10, 5),
    skill('meditation', 'Equilíbrio Interior', 'Restaura a vida enquanto repele ameaças.', 'circle', 'holy', 0xb8f2d0, 1.5, 15, 26, 0, 5, { heal: .3 }),
    skill('thousandfists', 'Mil Punhos', 'Uma explosão de chi atinge todos ao redor.', 'circle', 'holy', 0xffe7a5, 4.8, 22, 42, 0, 8),
  ] },
  lanceman: { id: 'lanceman', name: 'Lanceman', description: 'Lança longa. Alcance e golpes devastadores.', color: 0xa1c7f4, weapon: 'lance', stats: stats(170, 105, 25, 19, 6.6, 4.8, 1.6, .14), skills: [
    skill('impale', 'Empalar', 'Estocada de longo alcance.', 'cone', 'physical', 0xbedafa, 3, 5, 15, 9, 1.5),
    skill('sweepinglance', 'Varredura', 'A haste descreve um círculo ao redor do herói.', 'circle', 'physical', 0x8bb4df, 2.3, 9, 22, 0, 6.5),
    skill('javelin', 'Lança do Trovão', 'Arremesso elétrico com alto poder de impacto.', 'projectile', 'arcane', 0xc7d5ff, 3.5, 12, 29, 32, 1.1),
    skill('dragonspear', 'Lança do Dragão', 'Explosão dracônica concentra todo o poder.', 'projectile', 'fire', 0xffbd8e, 5, 24, 40, 30, 3),
  ] },
  warlock: { id: 'warlock', name: 'Warlock', description: 'Orbe do vazio. Maldições e poder arcano.', color: 0xda91ef, weapon: 'orb', stats: stats(140, 175, 27, 12, 6.2, 18, 1.5, .17), skills: [
    skill('voidbolt', 'Raio do Vazio', 'Um projétil de trevas percorre longa distância.', 'projectile', 'arcane', 0xc17dfa, 2.7, 5, 17, 30, 1.2),
    skill('hellfire', 'Chama Infernal', 'Fogo sobrenatural envolve os inimigos próximos.', 'circle', 'fire', 0xf281b7, 2.9, 10, 26, 0, 7),
    skill('lifetap', 'Pacto Vital', 'Drena energia e recupera vida.', 'cone', 'poison', 0xb2edbb, 2.8, 14, 30, 12, 5, { heal: .28 }),
    skill('singularity', 'Singularidade', 'Uma estrela do vazio causa uma enorme explosão.', 'projectile', 'arcane', 0xefb6ff, 5.4, 27, 50, 32, 4),
  ] },
};

/** The caller supplies raw attack; Combatant.receiveDamage receives the mitigated result. */
export function calculateDamage(attack: number, defense: number, multiplier = 1, critical = false, critMultiplier = 1.8): number {
  if (!Number.isFinite(attack) || attack <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) return 0;
  const armor = Number.isFinite(defense) ? Math.max(0, defense) : 0;
  const crit = critical && Number.isFinite(critMultiplier) ? Math.max(1, critMultiplier) : 1;
  return Math.max(1, Math.round(attack * multiplier * (100 / (100 + armor)) * crit));
}

export function getClass(id: ClassId): ClassDefinition { return CLASS_DEFINITIONS[id] ?? CLASS_DEFINITIONS.berserker; }
