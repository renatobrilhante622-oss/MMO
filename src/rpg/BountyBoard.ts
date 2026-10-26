import {REGIONS} from '../world/Regions';
import type {QuestDefinition} from './QuestSystem';
export const CONTRACT_RANKS=['C','B','A','S','SS'] as const;
/** One current contract per region; serial progression never accumulates completed records. */
export function makeContract(region:string,serial:number):QuestDefinition {
 const r=REGIONS.find(r=>r.id===region);if(!r)throw Error('Unknown contract region');
 serial=Math.max(0,Math.min(1000000000,Math.floor(Number.isFinite(serial)?serial:0)));
 const rankIndex=Math.min(4,Math.floor(serial/2)),rank=CONTRACT_RANKS[rankIndex],cycle=serial%5;
 const goals=['kill','nest','elite','core','camp'] as const,goal=goals[cycle];
 const required=Math.min(100,(cycle===0?12+rankIndex*4:cycle===1?2:cycle===2?1:cycle===3?10:1)+Math.floor(serial/10));
 const target=goal==='kill'?r.kinds[serial%r.kinds.length]:region;
 const prey=({slime:'Gosmas',wolf:'Lobos Alfa',skeleton:'Esqueletos',wraith:'Espectros',golem:'Golens'} as Record<string,string>)[target]??target;
 const title=goal==='kill'?'Abata '+required+' '+prey:goal==='nest'?'Destrua '+required+' ninhos corrompidos':goal==='elite'?'Elimine '+required+' campeões mutantes':goal==='core'?'Colete '+required+' núcleos abissais':'Limpe '+required+' acampamentos inimigos';
 const scale=1+rankIndex*.5+Math.sqrt(serial)*.12;
 return {id:`contract-${region}-${serial}`,region,category:'contract',goal,target,required,rank,serial,title:`[${rank}] ${title}`,description:`Contrato ${serial+1} · ${r.name[0]}. Aceite antes de cumprir o objetivo. A recompensa cresce com seu histórico.`,reward:{xp:Math.round((200+r.minLevel*22)*scale),gold:Math.round((180+r.minLevel*30)*scale),crystals:2+rankIndex+Math.floor(Math.sqrt(serial)),tickets:0,passXp:40+rankIndex*20,refinementStones:1+rankIndex,skinChests:rankIndex>=2?1:0,skinFragments:3+rankIndex*2,...(rankIndex>=3?{wardrobeSource:'contract' as const}:{})}};
}
