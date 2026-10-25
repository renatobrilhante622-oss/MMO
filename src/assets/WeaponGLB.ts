import { Mesh, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ClassId } from '../core/GameTypes';

export type WeaponModelId =
  | 'axe_1handed' | 'axe_2handed' | 'crossbow_2handed'
  | 'dagger' | 'quiver' | 'shield_round' | 'staff'
  | 'sword_1handed' | 'sword_2handed' | 'wand';

export interface EquipmentVisual {
  model: WeaponModelId;
  bone: 'righthand' | 'lefthand';
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
  ranger: [{model:'crossbow_2handed',bone:'righthand'}],
  elementalist: [{model:'staff',bone:'righthand'}],
  necromancer: [{model:'staff',bone:'righthand'}],
  monk: [],
  lanceman: [{model:'sword_2handed',bone:'righthand'}],
  warlock: [{model:'wand',bone:'righthand'}],
};

const loader = new GLTFLoader();
const models = new Map<WeaponModelId, Promise<GLTF>>();

export async function loadWeaponModel(name: WeaponModelId): Promise<Object3D> {
  let promise=models.get(name);
  if(!promise){
    const url=import.meta.env.BASE_URL+'models/KayKit_Weapon_'+name+'.glb';
    promise=loader.loadAsync(url);
    models.set(name,promise);
    void promise.catch(()=>models.delete(name));
  }
  const gltf=await promise;
  const model=clone(gltf.scene);
  model.name='KayKit weapon '+name;
  model.traverse(object=>{
    if(object instanceof Mesh){
      object.frustumCulled=false;
      object.castShadow=true;
      object.receiveShadow=false;
    }
  });
  return model;
}
