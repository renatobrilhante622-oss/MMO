import {normalizeWeaponGrip,weaponGripProfile} from '../player/WeaponGrip';
import {retainAppearanceAssets} from './AppearanceResources';
import { Box3, Mesh, Object3D, Vector3 } from 'three';
import {type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadSharedModel} from './ModelResources';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ClassId } from '../core/GameTypes';

export type WeaponModelId =
  | `relicbase-${string}`
  | 'axe_1handed' | 'axe_2handed' | 'crossbow_2handed'
  | 'dagger' | 'quiver' | 'shield_round' | 'staff'
  | 'sword_1handed' | 'sword_2handed' | 'wand' | 'spear' | 'longbow'
  | 'spellbook_open' | 'spellbook_closed'
  | 'gladiator-blade' | 'dungeon_sword' | 'prototype_sword' | 'dungeon_shield_round' | 'dungeon_shield_rectangle'
  | `armory-${ClassId}-${0 | 1 | 2 | 3 | 4}`
  | `paladin-shield-${0 | 1 | 2 | 3 | 4}`;

export interface EquipmentVisual {
  model: WeaponModelId;
  bone: 'righthand' | 'lefthand' | 'spine2' | 'head';
  /** Offset is expressed in full-size character space. */
  offset?: readonly [number, number, number];
}

/** Real CC0 weapon models selected for the class's authored armature. */
export const CLASS_EQUIPMENT_MODELS: Record<ClassId, readonly EquipmentVisual[]> = {
  berserker: [{model:'axe_2handed',bone:'righthand'}],
  paladin: [
    {model:'sword_1handed',bone:'righthand'},
    {model:'shield_round',bone:'lefthand'},
  ],
  assassin: [
    {model:'dagger',bone:'righthand'},
    {model:'dagger',bone:'lefthand'},
  ],
  ranger: [{model:'longbow',bone:'lefthand'}, {model:'quiver',bone:'spine2',offset:[0,0,-.16]}],
  elementalist: [{model:'staff',bone:'righthand'}, {model:'spellbook_open',bone:'lefthand'}],
  necromancer: [{model:'staff',bone:'righthand'}, {model:'spellbook_closed',bone:'lefthand'}],
  monk: [],
  lanceman: [{model:'spear',bone:'righthand'}],
  warlock: [{model:'staff',bone:'righthand'}, {model:'spellbook_closed',bone:'lefthand'}],
};

const models = new Map<WeaponModelId, Promise<GLTF>>();

export async function loadWeaponModel(name: WeaponModelId,classId?:ClassId): Promise<Object3D> {
  let promise=models.get(name);
  if(!promise){
    const url=name.startsWith('relicbase-')?'models/pr22/'+name.slice(10)+'.glb':((name.startsWith('armory-') || name.startsWith('paladin-shield-') || name==='gladiator-blade')
      ?'models/weapons/'+name+'.glb'
      :name==='spear'
      ?'models/environment/Kenney_mini-dungeon_weapon-spear.glb'
      :name==='longbow'?'models/equipment/CC0_longbow.glb'
      :name.startsWith('dungeon_')||name.startsWith('prototype_')
       ?'models/weapon-packs/Kenney_'+name+'.glb'
      :'models/KayKit_Weapon_'+name+'.glb');
    promise=loadSharedModel(url);
    models.set(name,promise);
    void promise.catch(()=>models.delete(name));
  }
  const gltf=await promise;
  const model=clone(gltf.scene);retainAppearanceAssets(model);
  model.name='Author-authored CC0 weapon '+name;
  model.traverse(object=>{
    if(object instanceof Mesh){
      object.frustumCulled=false;
      object.castShadow=true;
      object.receiveShadow=false;
    }
  });
  return normalizeWeaponGrip(model,weaponGripProfile(name,classId));
}
