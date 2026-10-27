import {Box3,Group,Object3D,Vector3} from 'three';
import type {ClassId} from '../core/GameTypes';
export function weaponGripProfile(name:string,classId?:ClassId):{length:number;fraction:number}{
 const cls=classId??(/^armory-([a-z]+)-/.exec(name)?.[1]);
 if(name.includes('shield'))return {length:.84,fraction:.5};
 if(name==='quiver'||name.includes('spellbook'))return {length:.5,fraction:.5};
 if(cls==='ranger'||name.includes('bow'))return {length:1.5,fraction:.5};
 if(cls==='assassin'||name.includes('dagger'))return {length:.72,fraction:.16};
 if(cls==='lanceman'||name==='spear')return {length:1.9,fraction:.4};
 if(['elementalist','warlock','necromancer','monk'].includes(cls??'')||/staff|wand/i.test(name))return {length:cls==='monk'?1.55:1.65,fraction:.32};
 return {length:cls==='berserker'?1.65:1.45,fraction:.13};
}
/** Authored mesh transforms remain intact under a presentation pivot; the grip is always at socket origin. */
export function normalizeWeaponGrip(source:Object3D,profile:{length:number;fraction:number}):Group {
 const root=new Group(),presentation=new Group();presentation.add(source);root.add(presentation);
 let box=new Box3().setFromObject(presentation),size=box.getSize(new Vector3());
 if(size.z>size.x&&size.z>size.y)presentation.rotation.x=Math.PI/2;
 else if(size.x>size.y)presentation.rotation.z=Math.PI/2;
 presentation.updateMatrixWorld(true);box=new Box3().setFromObject(presentation);size=box.getSize(new Vector3());
 const scale=profile.length/Math.max(.001,size.y);presentation.scale.setScalar(scale);presentation.updateMatrixWorld(true);
 box=new Box3().setFromObject(presentation);const center=box.getCenter(new Vector3()),height=box.max.y-box.min.y;
 presentation.position.set(-center.x,-box.min.y-height*profile.fraction,-center.z);
 root.userData.gripLocal=[0,0,0];root.userData.weaponLength=profile.length;root.name='Normalized weapon grip';return root;
}
