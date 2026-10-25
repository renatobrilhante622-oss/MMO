import type {ClassId,Rarity} from '../core/GameTypes';
import type {WeaponModelId,EquipmentVisual} from '../assets/WeaponGLB';

export const WEAPON_PACK_RARITIES=['common','rare','epic','legendary','mythic'] as const satisfies readonly Rarity[];
const layouts:Record<ClassId,{names:readonly string[];offhand?:WeaponModelId}>={
  berserker:{names:['Machado de Ferro','Machado Rúnico','Espadão Vulcânico','Cortadora Astral','Excalibur Eterna']},
  paladin:{names:['Espada do Juramento','Lâmina Rúnica','Espada Solar','Lâmina da Aurora','Excalibur Eterna'],offhand:'shield_round'},
  assassin:{names:['Adagas da Sombra','Presas de Veneno','Lâminas Fantasmas','Gêmeas do Eclipse','Farpas do Vazio'],offhand:'dagger'},
  ranger:{names:['Arco de Caça','Arco Élfico de Vento','Arco de Cristal','Arco Celestial','Arco do Crepúsculo'],offhand:'quiver'},
  elementalist:{names:['Cajado Aprendiz','Cajado de Cristal Glacial','Cetro Solar','Báculo Abissal','Cajado Mítico do Dragão'],offhand:'spellbook_open'},
  necromancer:{names:['Foice de Ossos','Foice dos Espectros','Foice das Cinzas','Foice do Submundo','Foice do Lich'],offhand:'spellbook_closed'},
  monk:{names:['Bastão do Discípulo','Bastão do Vento','Bastão Sagrado','Bastão Celestial','Bastão Eterno']},
  lanceman:{names:['Lança de Ferro','Lança Rúnica','Lança Glacial','Lança do Sol','Lança do Abismo']},
  warlock:{names:['Varinha do Iniciado','Cetro de Cristal','Báculo do Eclipse','Varinha Astral','Cetro do Vazio'],offhand:'spellbook_closed'}
};
export interface WeaponPack {
  id:string;classId:ClassId;tier:number;name:[string,string];
  rarity:Rarity;color:number;weapons:readonly EquipmentVisual[];
}
/** 45 deterministic gameplay cosmetics, each using a separate bundled CC0 GLB.
 * Rarity shaders and particles remain independent of the weapon geometry. */
export const WEAPON_PACKS:readonly WeaponPack[]=Object.freeze(
 (Object.keys(layouts) as ClassId[]).flatMap(classId=>{
  const group=layouts[classId];
  return group.names.map((name,tier)=>{
   const main=`armory-${classId}-${tier}` as WeaponModelId;
   const weapons:EquipmentVisual[]=classId==='ranger'
    ?[{model:main,bone:'lefthand'},{model:'quiver',bone:'spine2',offset:[0,0,-.17]}]
    :classId==='assassin'
     ?[{model:main,bone:'righthand'},{model:main,bone:'lefthand'}]
    :[{model:main,bone:'righthand'},...(classId==='paladin'?[{model:`paladin-shield-${tier}` as WeaponModelId,bone:'lefthand'} as EquipmentVisual]:group.offhand?[{model:group.offhand,bone:'lefthand'} as EquipmentVisual]:[])];
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
