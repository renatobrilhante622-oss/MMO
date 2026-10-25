import {Box3,Object3D,Vector3} from 'three';
/**
 * World-space GLB bounds converted back to a mount's local coordinates.
 * Do not include rider or VFX in the measured subtree.
 */
export function saddleHeightFromBounds(mount:Object3D,visual:Object3D,ratio=.78):number{
 mount.updateWorldMatrix(true,false);
 visual.updateWorldMatrix(true,true);
 const bounds=new Box3().setFromObject(visual);
 if(bounds.isEmpty())return 1.6;
 const height=bounds.max.y-bounds.min.y;
 const top=bounds.min.y+height*Math.max(.5,Math.min(.9,ratio));
 const center=bounds.getCenter(new Vector3());
 return mount.worldToLocal(new Vector3(center.x,top,center.z)).y;
}
export function safePetOffset(forward:Vector3,lateral=1.8,behind=1.2):Vector3{
 const direction=forward.clone().setY(0);
 if(direction.lengthSq()<1e-8)direction.set(0,0,1);
 direction.normalize();
 // A fixed side offset in local hero coordinates, not global X/Z.
 return new Vector3(direction.z*lateral-direction.x*behind,0,
                    -direction.x*lateral-direction.z*behind);
}
export function separatePetFromMount(pet:Vector3,mount:Vector3,minDistance=2.05):Vector3{
 const away=pet.clone().sub(mount).setY(0);
 if(away.lengthSq()<1e-8)away.set(1,0,0);
 const distance=away.length();
 if(distance<minDistance)pet.add(away.normalize().multiplyScalar(minDistance-distance));
 return pet;
}
