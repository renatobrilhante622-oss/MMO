import type { ClassId } from '../core/GameTypes';
import type { Attribute } from '../progression/AdventureProgress';
export interface EpigraphNode { name:[string,string]; description:[string,string]; }
const node=(pt:string,en:string,description:[string,string]):EpigraphNode=>({name:[pt,en],description});
const power:[string,string]=['+2 ataque por ponto.','+2 attack per point.'];
const vitality:[string,string]=['+14 vida máxima por ponto.','+14 maximum health per point.'];
const guard:[string,string]=['+2 defesa por ponto.','+2 defense per point.'];
const spirit:[string,string]=['+6 mana por ponto; reduz recargas em 0,2%, até 20%.','+6 mana per point; reduces cooldowns by 0.2%, up to 20%.'];
const precision:[string,string]=['+0,15% crítico por ponto.','+0.15% critical chance per point.'];
export const EPIGRAPHS:Record<ClassId,Record<Attribute,EpigraphNode>>={
  berserker:{power:node('Fúria Brutal','Brutal Rage',power),vitality:node('Sangue de Ferro','Iron Blood',vitality),guard:node('Couraça de Guerra','War Plate',guard),spirit:node('Fôlego da Fúria','Rage Endurance',spirit),precision:node('Fúria Crítica','Critical Fury',precision)},
  paladin:{power:node('Julgamento Sagrado','Sacred Judgment',power),vitality:node('Bênção Vital','Vital Blessing',vitality),guard:node('Égide Divina','Divine Aegis',guard),spirit:node('Devoção','Devotion',spirit),precision:node('Veredito','Verdict',precision)},
  assassin:{power:node('Lâmina Oculta','Hidden Blade',power),vitality:node('Vigor Sombrio','Shadow Vigor',vitality),guard:node('Véu de Sombras','Shadow Veil',guard),spirit:node('Ritmo das Sombras','Shadow Rhythm',spirit),precision:node('Ponto Vital','Vital Point',precision)},
  ranger:{power:node('Tensão do Arco','Bow Tension',power),vitality:node('Vigor Selvagem','Wild Vigor',vitality),guard:node('Pele de Carvalho','Oak Skin',guard),spirit:node('Foco do Caçador','Hunter Focus',spirit),precision:node('Olho de Águia','Eagle Eye',precision)},
  elementalist:{power:node('Domínio Elemental','Elemental Mastery',power),vitality:node('Corpo Arcano','Arcane Body',vitality),guard:node('Barreira Glacial','Frost Barrier',guard),spirit:node('Fluxo Elemental','Elemental Flow',spirit),precision:node('Instabilidade Arcana','Arcane Instability',precision)},
  necromancer:{power:node('Dano Necrótico','Necrotic Power',power),vitality:node('Vínculo de Almas','Soul Bond',vitality),guard:node('Armadura Óssea','Bone Armor',guard),spirit:node('Ritual da Colheita','Harvest Ritual',spirit),precision:node('Ceifa Perfeita','Perfect Reaping',precision)},
  monk:{power:node('Palma do Tigre','Tiger Palm',power),vitality:node('Corpo de Jade','Jade Body',vitality),guard:node('Postura de Pedra','Stone Stance',guard),spirit:node('Circulação de Chi','Chi Flow',spirit),precision:node('Golpe Interior','Inner Strike',precision)},
  lanceman:{power:node('Ponta do Dragão','Dragon Point',power),vitality:node('Sangue do Dragão','Dragon Blood',vitality),guard:node('Escamas de Aço','Steel Scales',guard),spirit:node('Fôlego Dracônico','Dragon Breath',spirit),precision:node('Estocada Perfeita','Perfect Thrust',precision)},
  warlock:{power:node('Poder do Vazio','Void Power',power),vitality:node('Pacto Vital','Life Pact',vitality),guard:node('Véu Abissal','Abyssal Veil',guard),spirit:node('Fluxo do Vazio','Void Flow',spirit),precision:node('Maldição Fatal','Fatal Curse',precision)},
};
export function cooldownMultiplier(spiritPoints:number):number{return 1-Math.min(.2,Math.max(0,spiritPoints)*.002);}
