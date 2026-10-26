import {REGIONS} from '../world/Regions';
import type {QuestDefinition} from './QuestSystem';
const chapters=[['O Juramento de Aster','As Raízes da Corrupção','O Coração da Floresta'],['Ecos sob as Lápides','Os Guardiões sem Nome','A Coroa das Cinzas'],['Memórias no Gelo','A Última Vigília','O Colosso Desperto'],['Brasas da Rebelião','O Cerco da Fornalha','O Juramento do Titã'],['Cartas do Vazio','As Sete Vozes','O Fim da Vigília']];
/** Stable legacy IDs remain; new acts migrate without reclaiming old rewards. */
export function expandedCampaign():QuestDefinition[]{return REGIONS.flatMap((r,i)=>{
 const npc='guide-'+r.id,prefix='story-'+r.id,base=r.minLevel,acts=chapters[i];
 const stages:Array<[string,QuestDefinition['goal'],string,number,string,string]>=[
 ['meet','talk',npc,1,i===0?'O Chamado — '+r.name[0]:'Atravesse o Portal Ancestral e apresente-se ao Guardião — '+r.name[0],'O guardião guarda a primeira pista da corrupção. Converse com ele.'],
 ['hunt','kill',r.kinds[0],5+i*2,'Vigília das Estradas','Abata as criaturas que cercam as rotas dos peregrinos.'],
 ['scout','investigate',r.id+'-ruin-0',1,'Inscrições da Primeira Era','Investigue pessoalmente o altar marcado nas ruínas.'],
 ['reagents','rareCollect',r.id,4+i,'A Receita Esquecida','Extraia reagentes raros de depósitos diferentes, protegidos por guardas.'],
 ['gather','collect','resource',3+i,'Suprimentos para a passagem','Colete recursos locais e prepare a defesa do obelisco.'],
 ['nests','nest',r.id,2,'Ovos de Corrupção','Destrua dois ninhos diferentes com seus ataques.'],
 ['defense','defend',r.id,1,'Não Cederemos','Ative o totem, permaneça no círculo por 45 segundos e elimine as três ondas.'],
 ['camp','camp',r.id,1,'O Acampamento Silenciado','Derrote todos os guardas de um acampamento e abra seu baú.'],
 ['captains','elite',r.id,2,'Expurgo dos Capitães','Elimine dois capitães distintos que patrulham a região.'],
 ['deep-scout','investigate',r.id+'-ruin-1',1,'A Verdade sob a Pedra','Investigue as ruínas profundas para localizar a origem da fenda.'],
 ['rift','rift',r.id,1,'Selar a Cicatriz','Destrua três ondas e o Demônio da Fenda. A fenda da história também pode ser ativada no local.'],
 ['boss','boss',r.id,1,'Confronto — '+r.boss.name[0],'A queda dos capitães expôs o chefe. Vença-o e liberte a passagem ancestral.'],
 ];
 return stages.map(([suffix,goal,target,required,title,description],index)=>({id:prefix+'-'+suffix,category:'story' as const,region:r.id,goal,target,required,title,description,npcId:npc,act:Math.floor(index/4)+1,actName:acts[Math.floor(index/4)],reward:{xp:Math.round((80+base*16)*(1+index*.45)),gold:Math.round((80+base*30)*(1+index*.35)),crystals:1+i+Math.floor(index/3),tickets:index===11?1+i:0,passXp:30+index*8,...(index===11?{itemRarity:([ 'common','rare','epic','legendary','mythic'] as const)[i]}:{})}}));
 });}
