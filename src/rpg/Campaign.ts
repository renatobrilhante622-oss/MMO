import {campaignNarrative} from './LoreSystem';
import {REGIONS} from '../world/Regions';
import type {QuestDefinition} from './QuestSystem';
const chapters=[['O Juramento de Aster','As Raízes da Corrupção','O Coração da Floresta'],['Ecos sob as Lápides','Os Guardiões sem Nome','A Coroa das Cinzas'],['Memórias no Gelo','A Última Vigília','O Colosso Desperto'],['Brasas da Rebelião','O Cerco da Fornalha','O Juramento do Titã'],['Cartas do Vazio','As Sete Vozes','O Fim da Vigília']];
/** Stable legacy IDs remain; new acts migrate without reclaiming old rewards. */
export function expandedCampaign():QuestDefinition[]{return REGIONS.flatMap((r,i)=>{
 const npc='guide-'+r.id,prefix='story-'+r.id,base=r.minLevel,acts=chapters[i];
 const stages:Array<[string,QuestDefinition['goal'],string,number]>=[
  ['meet','talk',npc,1],['hunt','kill',r.kinds[0],5+i*2],
  ['scout','investigate',r.id+'-ruin-0',1],['reagents','rareCollect',r.id,4+i],
  ['gather','collect','resource',3+i],['nests','nest',r.id,2],
  ['defense','defend',r.id,1],['camp','camp',r.id,1],['captains','elite',r.id,2],
  ['deep-scout','investigate',r.id+'-ruin-1',1],['rift','rift',r.id,1],['boss','boss',r.id,1],
 ];
 return stages.map(([suffix,goal,target,required],index)=>({id:prefix+'-'+suffix,category:'story' as const,region:r.id,goal,target,required,title:campaignNarrative(r.id,index,required).title[0],description:campaignNarrative(r.id,index,required).description[0],npcId:npc,act:Math.floor(index/4)+1,actName:acts[Math.floor(index/4)],reward:{xp:Math.round((80+base*16)*(1+index*.45)),gold:Math.round((80+base*30)*(1+index*.35)),crystals:1+i+Math.floor(index/3),tickets:index===11?1+i:0,passXp:30+index*8,...(index===11?{itemRarity:([ 'common','rare','epic','legendary','mythic'] as const)[i]}:{})}}));
 });}
