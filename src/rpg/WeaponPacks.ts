import type {ClassId} from '../core/GameTypes';
import type {Rarity} from './InventoryAndLoot';
import type {WeaponModelId,WeaponAttachment} from '../assets/WeaponGLB';

export const WEAPON_PACK_RARITIES=['common','rare','epic','legendary','mythic'] as const satisfies readonly Rarity[];
const layouts:Record<ClassId,{names:readonly string[];models:readonly WeaponModelId[];offhand?:WeaponModelId}>={
  berserker:{names:['Machado de Ferro','Machado Rúnico','Espadão Vulcânico','Cortadora Astral','Excalibur Eterna'],
    models:['axe_1handed','axe_2handed','sword_2handed','sword_1handed','sword_2handed']},
  paladin:{names:['Espada do Juramento','Lâmina Rúnica','Espada Solar','Lâmina da Aurora','Excalibur Eterna'],
    models:['sword_1handed','sword_2handed','sword_1handed','sword_2handed','sword_1handed'],offhand:'shield_round'},
  assassin:{names:['Adagas da Sombra','Presas de Veneno','Lâminas Fantasmas','Gêmeas do Eclipse','Farpas do Vazio'],
    models:['dagger','dagger','dagger','dagger','dagger'],offhand:'dagger'},
  ranger:{names:['Arco de Caça','Arco Élfico de Vento','Arco de Cristal','Arco Celestial','Arco do Crepúsculo'],
    models:['longbow','longbow','longbow','longbow','longbow'],offhand:'quiver'},
  elementalist:{names:['Cajado Aprendiz','Cajado de Cristal Glacial','Cetro Solar','Báculo Abissal','Cajado Mítico do Dragão'],
    models:['staff','wand','staff','staff','staff'],offhand:'spellbook_open'},
  necromancer:{names:['Báculo de Ossos','Foice dos Espectros','Cetro das Cinzas','Cajado do Submundo','Báculo do Lich'],
    models:['staff','staff','wand','staff','staff'],offhand:'spellbook_closed'},
  monk:{names:['Punhos do Discípulo','Manoplas do Vento','Punhos Sagrados','Foco Celestial','Punhos Eternos'],
    models:['wand','dagger','wand','spear','wand']},
  lanceman:{names:['Lança de Ferro','Lança Rúnica','Lança Glacial','Lança do Sol','Lança do Abismo'],
    models:['spear','spear','spear','spear','spear']},
  warlock:{names:['Varinha do Iniciado','Cetro de Cristal','Báculo do Eclipse','Varinha Astral','Cetro do Vazio'],
    models:['wand','staff','wand','staff','wand'],offhand:'spellbook_closed'}
};
export interface WeaponPack {
  id:string;classId:ClassId;tier:number;name:[string,string];
  rarity:Rarity;color:number;weapons:readonly WeaponAttachment[];
}
/** 45 deterministic gameplay cosmetics, all backed by locally bundled authored GLBs.
 * A "tier" changes material/effects: it does NOT claim 45 separately sculpted meshes. */
export const WEAPON_PACKS:readonly WeaponPack[]=Object.freeze(
 (Object.keys(layouts) as ClassId[]).flatMap(classId=>{
  const group=layouts[classId];
  return group.names.map((name,tier)=>{
   const main=group.models[tier];
   const weapons:WeaponAttachment[]=classId==='ranger'
    ?[{model:main,bone:'lefthand'},{model:'quiver',bone:'spine2',offset:[0,0,-.17]}]
    :classId==='assassin'
     ?[{model:'dagger',bone:'righthand'},{model:'dagger',bone:'lefthand'}]
    :[{model:main,bone:'righthand'},...(group.offhand?[{model:group.offhand,bone:'lefthand'} as WeaponAttachment]:[])];
   return Object.freeze({
    id:'armory-'+classId+'-'+tier,classId,tier,
    name:[name,name] as [string,string],
    rarity:WEAPON_PACK_RARITIES[tier] as Rarity,
    color:[0xc9bdaa,0x7fcdec,0xb68dff,0xffce77,0xff77ba][tier],
    weapons:Object.freeze(weapons)
   });
  });
 }));
export const WEAPON_PACK_BY_ID:ReadonlyMap<string,WeaponPack>=new Map(WEAPON_PACKS.map(pack=>[pack.id,pack]));
export function weaponPackForClass(id:string,classId:ClassId):WeaponPack|undefined {
 const result=WEAPON_PACK_BY_ID.get(id);
 return result?.classId===classId?result:undefined;
}
