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

export interface EpigraphEffects {armorPenetration:number;lifeSteal:number;spellPower:number;companionPower:number;}
export function epigraphEffects(id:ClassId,points:Partial<Record<Attribute,number>>={}):EpigraphEffects {
  const value=(key:Attribute)=>Math.max(0,Math.min(100,Number.isFinite(points[key])?points[key]!:0));
  return {
    armorPenetration:id==='berserker'||id==='lanceman'?Math.min(.35,value('power')*.0035):0,
    lifeSteal:id==='necromancer'||id==='warlock'?Math.min(.12,value('guard')*.0012):id==='berserker'?Math.min(.06,value('vitality')*.0006):0,
    spellPower:['elementalist','necromancer','warlock'].includes(id)?value('precision')*.003:0,
    companionPower:id==='ranger'||id==='necromancer'?value('vitality')*.004:0,
  };
}
EPIGRAPHS.berserker.power.description=['+2 ataque e 0,35% penetração de armadura por ponto (máx. 35%).','+2 attack and 0.35% armor penetration per point (max 35%).'];
EPIGRAPHS.berserker.vitality.description=['+14 vida e 0,06% vampirismo por ponto (máx. 6%).','+14 health and 0.06% life steal per point (max 6%).'];
EPIGRAPHS.necromancer.guard=node('Roubo de Alma','Soul Theft',['+2 defesa e 0,12% roubo de vida por ponto (máx. 12%).','+2 defense and 0.12% life steal per point (max 12%).']);
EPIGRAPHS.necromancer.vitality.description=['+14 vida e 0,4% dano do companheiro por ponto.','+14 health and 0.4% companion damage per point.'];
EPIGRAPHS.ranger.vitality.description=EPIGRAPHS.necromancer.vitality.description;
EPIGRAPHS.lanceman.power.description=EPIGRAPHS.berserker.power.description;
EPIGRAPHS.warlock.guard.description=EPIGRAPHS.necromancer.guard.description;
for(const id of ['elementalist','necromancer','warlock'] as ClassId[])EPIGRAPHS[id].precision.description=['+0,15% crítico e 0,3% dano de habilidades por ponto.','+0.15% critical chance and 0.3% skill damage per point.'];
