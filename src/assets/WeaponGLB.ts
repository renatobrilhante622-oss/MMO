import { Box3, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ClassId } from '../core/GameTypes';

export type WeaponModelId =
  | 'axe_1handed' | 'axe_2handed' | 'crossbow_2handed'
  | 'dagger' | 'quiver' | 'shield_round' | 'staff'
  | 'sword_1handed' | 'sword_2handed' | 'wand' | 'spear' | 'longbow'
  | 'spellbook_open' | 'spellbook_closed'
  | 'dungeon_sword' | 'prototype_sword' | 'dungeon_shield_round' | 'dungeon_shield_rectangle'
  | `armory-${ClassId}-${0 | 1 | 2 | 3 | 4}`;

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
  warlock: [{model:'wand',bone:'righthand'}, {model:'staff',bone:'lefthand'}],
};

const loader = new GLTFLoader();
const models = new Map<WeaponModelId, Promise<GLTF>>();

export async function loadWeaponModel(name: WeaponModelId): Promise<Object3D> {
  let promise=models.get(name);
  if(!promise){
    const url=import.meta.env.BASE_URL+(name.startsWith('armory-')
      ?'models/weapons/'+name+'.glb'
      :name==='spear'
      ?'models/environment/Kenney_mini-dungeon_weapon-spear.glb'
      :name==='longbow'?'models/equipment/CC0_longbow.glb'
      :name.startsWith('dungeon_')||name.startsWith('prototype_')
       ?'models/weapon-packs/Kenney_'+name+'.glb'
      :'models/KayKit_Weapon_'+name+'.glb');
    promise=loader.loadAsync(url);
    models.set(name,promise);
    void promise.catch(()=>models.delete(name));
  }
  const gltf=await promise;
  const model=clone(gltf.scene);
  model.name='Author-authored CC0 weapon '+name;
  // Mini Forest bow is modeled at 0.48m. Scale it to a readable 1.56m
  // ranger longbow before applying inverse scaling for the hand bone.
  if(name==='longbow')model.scale.multiplyScalar(3.25);
  // Scale author-created GLBs to a stable silhouette without generating geometry.
  if(name.startsWith('armory-')){
    const bounds=new Box3().setFromObject(model);
    if(!bounds.isEmpty()){
      const size=bounds.getSize(new Vector3());
      const type=name.split('-')[1];
      const target=type==='assassin'?.72:type==='ranger'?1.5:type==='lanceman'?1.9
        :type==='monk'?.92:type==='necromancer'?1.35:1.45;
      const longest=Math.max(size.x,size.y,size.z);
      if(longest>0.001)model.scale.multiplyScalar(Math.max(.04,Math.min(20,target/longest)));
    }
  }
  model.traverse(object=>{
    if(object instanceof Mesh){
      object.frustumCulled=false;
      object.castShadow=true;
      object.receiveShadow=false;
    }
  });
  return model;
}
