import type {ClassId} from '../core/GameTypes';
export type SkinArchetype='arcane'|'plate'|'shadow'|'wild'|'martial';
export interface SkinIdentity {archetype:SkinArchetype;name:[string,string];metallic:boolean;helmet:boolean;pauldrons:boolean;}
/** Cosmetics adapt their attachments to the selected class, never replace its authored body. */
export const SKIN_IDENTITIES:Record<ClassId,SkinIdentity>={
 elementalist:{archetype:'arcane',name:['Vestes Elementais','Elemental Vestments'],metallic:false,helmet:false,pauldrons:false},
 necromancer:{archetype:'arcane',name:['Manto das Almas','Soul Mantle'],metallic:false,helmet:false,pauldrons:false},
 warlock:{archetype:'arcane',name:['Vestes do Vazio','Void Vestments'],metallic:false,helmet:false,pauldrons:false},
 paladin:{archetype:'plate',name:['Égide Solar','Solar Aegis'],metallic:true,helmet:true,pauldrons:true},
 lanceman:{archetype:'plate',name:['Armadura da Sentinela','Sentinel Armor'],metallic:true,helmet:true,pauldrons:true},
 berserker:{archetype:'plate',name:['Placas da Ira','Wrath Plates'],metallic:true,helmet:false,pauldrons:true},
 assassin:{archetype:'shadow',name:['Véu das Sombras','Shadow Veil'],metallic:false,helmet:false,pauldrons:false},
 ranger:{archetype:'wild',name:['Manto do Vigia','Warden Mantle'],metallic:false,helmet:false,pauldrons:false},
 monk:{archetype:'martial',name:['Traje do Santuário','Sanctuary Garb'],metallic:false,helmet:false,pauldrons:false},
};
export function skinDisplayName(classId:ClassId,name:string,english=false):string{return SKIN_IDENTITIES[classId].name[english?1:0]+' · '+name;}
