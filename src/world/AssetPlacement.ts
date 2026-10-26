import {Box3,Matrix4,Quaternion,Vector3,type Object3D} from 'three';
export interface AssetPose {x:number;z:number;size:number;yaw?:number;lift?:number;}
/** Normalize in rotated space: asymmetric GLB pivots must not orbit when yaw changes. */
export function groundedAssetMatrix(bounds:Box3,pose:AssetPose,ground:(x:number,z:number)=>number):Matrix4 {
 if(bounds.isEmpty()||![pose.x,pose.z,pose.size,pose.yaw??0].every(Number.isFinite)||pose.size<=0)throw Error('Invalid asset placement');
 const groundY=ground(pose.x,pose.z);if(!Number.isFinite(groundY))throw Error('Invalid ground height');
 const size=bounds.getSize(new Vector3()),scale=pose.size/Math.max(.001,size.x,size.y,size.z),center=bounds.getCenter(new Vector3());
 const normalize=new Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
 const placement=new Matrix4().compose(new Vector3(pose.x,groundY+(pose.lift??0),pose.z),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),pose.yaw??0),new Vector3(scale,scale,scale));
 return placement.multiply(normalize);
}
/** Apply a world-space fit to a template clone whose own root transform may be nonidentity. */
export function groundAsset(model:Object3D,pose:AssetPose,ground:(x:number,z:number)=>number):Box3 {
 model.updateMatrixWorld(true);const bounds=new Box3().setFromObject(model),matrix=groundedAssetMatrix(bounds,pose,ground);
 model.applyMatrix4(matrix);model.updateMatrixWorld(true);return new Box3().setFromObject(model);
}
