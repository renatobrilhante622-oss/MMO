import type {ClassId} from '../core/GameTypes';
import type {Object3D} from 'three';

/** Model-neutral hiding of authored default weapons, leaving bones/socket nodes. */
export const EMBEDDED_WEAPON_TOKENS=/(?:^|[._\s-])(bow|crossbow|quiver|arrow|dagger|sword|staff|shield|mug|axe|hammer|wand|spear|lance)(?:$|[._\s-]|\d)/i;
export function isEmbeddedWeaponName(name:string):boolean {
 const lower=name.toLowerCase();
 if(!lower||/(?:hand|finger|wrist|arm|leg|spine|head)slot/.test(lower))return false;
 return EMBEDDED_WEAPON_TOKENS.test(lower)
   || /^(?:weapon|bow|crossbow|quiver|dagger|sword|staff|shield|mug|axe)\d*$/i.test(name);
}
export function clearWeaponSlots(model:Object3D):number{
 let hidden=0;
 // Only renderable geometry is hidden: rig bones, attachments and IK remain
 // active for the selected class's loadout.
 model.traverse(node=>{
   if(!('isMesh' in node)&&!('isSkinnedMesh' in node))return;
   let cursor:Object3D|null=node;
   while(cursor&&cursor!==model){
     if(isEmbeddedWeaponName(cursor.name)){
       node.visible=false;
       hidden++;
       break;
     }
     cursor=cursor.parent;
   }
 });
 return hidden;
}
export interface ClassIdentity{
 model:'KayKit_Barbarian'|'KayKit_Knight'|'KayKit_Rogue'|'KayKit_Rogue_Hooded'|'KayKit_Mage';
 tint:number;
 title:string;
 signature:string;
}
/** Nine independent loadout/color/material identities for five authored bases. */
export const CLASS_IDENTITIES:Record<ClassId,ClassIdentity>={
 berserker:{model:'KayKit_Barbarian',tint:0xff986b,title:'Gladiador da Ira',signature:'great-axe'},
 paladin:{model:'KayKit_Knight',tint:0xffe2ae,title:'Guardião de Ouro',signature:'sword-shield'},
 assassin:{model:'KayKit_Rogue',tint:0xa18acb,title:'Lâmina das Sombras',signature:'dual-daggers'},
 ranger:{model:'KayKit_Rogue_Hooded',tint:0xa3e1a7,title:'Vigia das Florestas',signature:'bow-quiver'},
 elementalist:{model:'KayKit_Mage',tint:0x9bd7f5,title:'Arcanista do Gelo',signature:'staff-orb'},
 necromancer:{model:'KayKit_Mage',tint:0x82b58e,title:'Soberano das Almas',signature:'bone-staff'},
 monk:{model:'KayKit_Barbarian',tint:0xe2c19f,title:'Punhos do Santuário',signature:'unarmed'},
 lanceman:{model:'KayKit_Knight',tint:0xa8c9ff,title:'Sentinela da Lança',signature:'spear'},
 warlock:{model:'KayKit_Mage',tint:0xc29de8,title:'Tecelão do Vazio',signature:'wand-orb'},
};
