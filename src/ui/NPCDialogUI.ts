import {questText} from '../rpg/LoreSystem';
import {avatarSvg} from './AvatarRenderer';
import type {QuestDefinition} from '../rpg/QuestSystem';

export function monsterPt(kind:string):string {
 const names:Record<string,string>={
   slime:'Slime Verde',wolf:'Lobo Cinzento',skeleton:'Esqueleto Guerreiro',
   wraith:'Espectro Sombrio',golem:'Golem',boss:'Chefe da região',
   orc:'Orc Guerreiro',hellhound:'Cão do Inferno',wyvern:'Dragão Wyvern',
 };
 return names[kind]??kind;
}
export function localizeQuestText(input:string,pt:boolean):string {
 if(!pt)return input;
 return input.replace(/\b(slime|wolf|skeleton|wraith|golem|hellhound|wyvern|orc)\b/gi,
    matched=>monsterPt(matched.toLowerCase()));
}
const PORTRAITS:Record<string,string>={
 'guide-aurora':'paladin','guide-crypt':'lich','guide-highlands':'archmage',
 'guide-rift':'berserker','guide-eclipse':'assassin',
 'blacksmith-aster':'berserker','teleporter-aster':'archmage',
 'merchant-aurora':'ranger','merchant-crypt':'assassin','merchant-highlands':'archmage',
 'merchant-rift':'paladin','merchant-eclipse':'lich',
};
export function npcPortrait(npcId:string):string {
 return avatarSvg(PORTRAITS[npcId]??'ranger');
}
export function questRewardCard(quest:QuestDefinition,pt=true):HTMLElement {
 const section=document.createElement('article');
 section.className='npc-quest-reward';
 const heading=document.createElement('strong');
 heading.textContent=(pt?'RECOMPENSAS • ':'REWARDS • ')+questText(quest,pt?'pt':'en').title;
 const tokens=document.createElement('div');tokens.className='npc-quest-reward-tokens';
 const rewards:[string,string][]=[
   ['✦',quest.reward.xp+' XP'],
   ['🟡',quest.reward.gold+' '+(pt?'Ouro':'Gold')],
   ...(quest.reward.crystals>0?[['💎',String(quest.reward.crystals)+' '+(pt?'Cristais':'Crystals')] as [string,string]]:[]),
   ...(quest.reward.tickets>0?[['🎟',String(quest.reward.tickets)+' Tickets'] as [string,string]]:[]),
   ...(quest.reward.itemRarity?[['⚔',quest.reward.itemRarity.toUpperCase()] as [string,string]]:[]),
 ];
 for(const [symbol,label]of rewards){
   const token=document.createElement('span');
   token.className='npc-quest-reward-token';
   const glyph=document.createElement('b');glyph.textContent=symbol;
   const value=document.createElement('small');value.textContent=label;
   token.append(glyph,value);tokens.append(token);
 }
 const objective=document.createElement('p');objective.className='npc-quest-objective';objective.textContent=(quest.act?'Ato '+quest.act+' · '+quest.actName+' — ':'')+questText(quest,pt?'pt':'en').description;
 section.append(heading,objective,tokens);
 return section;
}
