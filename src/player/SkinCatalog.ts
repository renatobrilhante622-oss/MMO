import type {ClassId,Rarity} from '../core/GameTypes';
import type {Cosmetic} from '../progression/AdventureProgress';
import type {ModelName} from '../assets/AnimatedGLB';
import type {WingStyle} from '../rpg/EvolutionSystem';
export type SkinGrade='common'|'rare'|'epic'|'legendary'|'mythic'|'divine';
export type SkinElement='steel'|'frost'|'fire'|'storm'|'void'|'solar';
export type SkinSource='elite'|'rift'|'contract'|'massacre'|'worldboss'|'tower'|'pvp'|'fragments';
export const SKIN_GRADES:readonly SkinGrade[]=['common','rare','epic','legendary','mythic','divine'];
export const SOURCE_NAMES:Record<SkinSource,[string,string]>={elite:['Elites do Mapa','Field Elites'],rift:['Fendas Dimensionais','Dimensional Rifts'],contract:['Contratos S / SS','S / SS Contracts'],massacre:['Baú de Massacre','Massacre Chest'],worldboss:['Chefes Regionais','Regional Bosses'],tower:['Torre da Eternidade · 3 andares','Eternity Tower · 3 floors'],pvp:['Loja de Honra Cosmética · PvP ranqueado','Cosmetic Honor Shop · ranked PvP'],fragments:['Forja de Fragmentos','Fragment Forge']};
export const ELEMENT_COLORS:Record<SkinElement,number>={steel:0xbac9d2,frost:0x65e4ff,fire:0xff6929,storm:0x72bfff,void:0xb374ff,solar:0xffd05f};
export interface SkinPassive {eliteDamage?:number;bolt?:number;meteor?:number;mountSpeed?:number;mountShield?:number;contractGold?:number;contractDrop?:number;lifeSteal?:number;}
export interface CatalogSkin extends Cosmetic {grade:SkinGrade;element:SkinElement;source:SkinSource;cost:number;classId?:ClassId;tier?:number;body?:ModelName;wingStyle?:WingStyle;mountModel?:ModelName;passive:SkinPassive;}
const classes:Record<ClassId,[string,string]>={berserker:['Machado','Axe'],paladin:['Espada','Sword'],assassin:['Adagas','Daggers'],ranger:['Arco','Bow'],elementalist:['Cajado','Staff'],necromancer:['Foice','Scythe'],monk:['Bastão','Quarterstaff'],lanceman:['Lança','Spear'],warlock:['Cetro','Scepter']};
const epithets=[['do Peregrino','of the Pilgrim'],['do Gelo Eterno','of Eternal Ice'],['da Chama do Purgatório','of Purgatory'],['do Trovão Celestial','of Celestial Thunder'],['do Vazio Abissal','of the Abyss'],['da Aurora Divina','of the Divine Dawn']];
const elements:SkinElement[]=['steel','frost','fire','storm','void','solar'];
const rarity=(grade:SkinGrade):Rarity=>grade==='divine'?'mythic':grade;
const make=(id:string,name:[string,string],type:Cosmetic['type'],grade:SkinGrade,element:SkinElement,source:SkinSource,passive:SkinPassive={},extra:Partial<CatalogSkin>={}):CatalogSkin=>({id,name,type,grade,rarity:rarity(grade),element,source,cost:[16,30,55,90,150,250][SKIN_GRADES.indexOf(grade)],color:ELEMENT_COLORS[element],passive,...extra});
export const RELIC_WEAPONS:readonly CatalogSkin[]=Object.entries(classes).flatMap(([id,name])=>SKIN_GRADES.map((grade,tier)=>make(`relic-${id}-${tier}`,[name[0]+' '+epithets[tier][0],name[1]+' '+epithets[tier][1]],'weapon',grade,elements[tier],(['fragments','elite','massacre','contract','rift','tower'] as SkinSource[])[tier],tier===3?{bolt:.16}:tier===4?{eliteDamage:.18}:tier===5?{bolt:.18,eliteDamage:.18}:{},{classId:id as ClassId,tier})));
export const OUTFIT_SKINS:readonly CatalogSkin[]=[
 make('regalia-solar',['Imperador Solar','Solar Emperor'],'skin','legendary','solar','worldboss',{eliteDamage:.18},{body:'KayKit_Knight'}),
 make('regalia-reaper',['Ceifador da Cripta','Crypt Reaper'],'skin','mythic','void','elite',{lifeSteal:.04},{body:'KayKit_Rogue_Hooded'}),
 make('regalia-astral',['Arquimago Astral','Astral Archmage'],'skin','legendary','storm','tower',{bolt:.16},{body:'KayKit_Mage'}),
 make('regalia-titan',['Titã da Forja Ardente','Blazing Forge Titan'],'skin','mythic','fire','rift',{meteor:.12},{body:'KayKit_Barbarian'}),
 make('regalia-glacial',['Guardião de Cristal Glacial','Glacial Crystal Guardian'],'skin','legendary','frost','massacre',{mountShield:.15},{body:'KayKit_Knight'}),
 make('regalia-void',['Soberano do Vazio','Void Sovereign'],'skin','mythic','void','contract',{contractGold:.2,contractDrop:.2},{body:'KayKit_Skeleton_Warrior'}),
];
export const WING_SKINS:readonly CatalogSkin[]=[
 make('plume-seraph',['Serafim Dourada','Golden Seraph'],'wing','legendary','solar','worldboss',{bolt:.12},{wingStyle:'celestial'}),
 make('plume-dragon',['Dragão de Magma','Magma Dragon'],'wing','mythic','fire','rift',{meteor:.12},{wingStyle:'magma'}),
 make('plume-crystal',['Lâminas de Cristal Arcano','Arcane Crystal Blades'],'wing','legendary','frost','massacre',{eliteDamage:.18},{wingStyle:'glacial'}),
 make('plume-phoenix',['Fênix Solar','Solar Phoenix'],'wing','mythic','solar','tower',{mountShield:.15},{wingStyle:'solar'}),
 make('plume-necrotic',['Asas Necróticas','Necrotic Wings'],'wing','mythic','void','contract',{lifeSteal:.04},{wingStyle:'necrotic'}),
];
export const MOUNT_SKINS:readonly CatalogSkin[]=[
 make('steed-imperial',['Corcel da Coroa Solar','Solar Crown Warhorse'],'mount','legendary','solar','worldboss',{mountSpeed:.25,mountShield:.15},{mountModel:'Creature_warhorse'}),
 make('steed-fenrir',['Fenrir das Sombras','Shadow Fenrir'],'mount','mythic','void','elite',{mountSpeed:.25,eliteDamage:.18},{mountModel:'Creature_wolf'}),
 make('steed-glacial',['Cervo do Inverno Eterno','Eternal Winter Stag'],'mount','legendary','frost','massacre',{mountSpeed:.25,mountShield:.15},{mountModel:'Creature_stag'}),
 make('steed-magma',['Dracônico do Purgatório','Purgatory Drake'],'mount','mythic','fire','rift',{mountSpeed:.25,meteor:.12},{mountModel:'Creature_wyvern'}),
 make('steed-astral',['Dragão da Aurora Divina','Divine Dawn Dragon'],'mount','divine','storm','pvp',{mountSpeed:.25,bolt:.16},{mountModel:'Creature_dragon'}),
];
export const COMPLETE_SKIN_CATALOG:readonly CatalogSkin[]=Object.freeze([...RELIC_WEAPONS,...OUTFIT_SKINS,...WING_SKINS,...MOUNT_SKINS]);
const byId=new Map(COMPLETE_SKIN_CATALOG.map(s=>[s.id,s]));
export function catalogSkin(id:string):CatalogSkin|undefined{return byId.get(id);}
/** Old saves keep their IDs, but their generic weapon now resolves to a class-specific assembly. */
export function weaponSkin(id:string,classId:ClassId):CatalogSkin|undefined {
 const current=byId.get(id);if(current?.type==='weapon')return current.classId===classId?current:undefined;
 const legacy=['ironweapon','forestweapon','frostweapon','voidweapon','sunweapon','eternalweapon'].indexOf(id);
 const armory=new RegExp('^armory-'+classId+'-([0-4])$').exec(id);
 return legacy>=0?byId.get(`relic-${classId}-${[0,1,1,2,3,4][legacy]}`):armory?byId.get(`relic-${classId}-${Number(armory[1])}`):undefined;
}
export function cosmeticWing(id:string):WingStyle|undefined {return byId.get(id)?.wingStyle??(['necrotic','celestial','glacial','magma','solar','astral'] as WingStyle[])[Number(/^wing-([0-5])$/.exec(id)?.[1]??-1)];}
export function equippedPassives(owned:readonly string[],equipped:Record<string,string>,classId:ClassId):SkinPassive {
 const result:SkinPassive={};for(const id of new Set(Object.values(equipped))){if(!owned.includes(id))continue;const s=catalogSkin(id);if(!s||s.classId&&s.classId!==classId)continue;for(const [key,value]of Object.entries(s.passive))result[key as keyof SkinPassive]=Math.max(result[key as keyof SkinPassive]??0,value);}
 return result;
}
export function collectionBonuses(owned:readonly string[],catalog:readonly Cosmetic[]):{attack:number;defense:number;maxHp:number} {
 const ids=new Set(owned);let power=0;for(const c of catalog)if(ids.has(c.id)){ids.delete(c.id);const grade=catalogSkin(c.id)?.grade??c.rarity;power+=({common:1,uncommon:1,rare:2,epic:3,legendary:4,mythic:5,divine:6})[grade];}
 return {attack:power,defense:Math.floor(power*.6),maxHp:power*8};
}
export function passiveText(p:SkinPassive,english=false):string {
 const lines:string[]=[];if(p.eliteDamage)lines.push(english?'+18% damage to elites/bosses':'+18% dano contra elites/chefes');if(p.bolt)lines.push(english?`${Math.round(p.bolt*100)}% celestial bolt · 4s CD`:`${Math.round(p.bolt*100)}% raio celestial · CD 4s`);if(p.meteor)lines.push(english?'12% meteor · 6s CD':'12% meteoro · CD 6s');if(p.mountSpeed)lines.push(english?'+25% mount speed':'+25% velocidade montada');if(p.mountShield)lines.push(english?'15% HP shield on mount · 30s CD':'Escudo de 15% HP ao montar · CD 30s');if(p.lifeSteal)lines.push(english?'4% life steal':'4% roubo de vida');if(p.contractGold)lines.push(english?'+20% contract gold/drop':'+20% ouro/drop em contratos');return lines.join(' · ');
}
