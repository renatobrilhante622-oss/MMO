import {Box3,Group,Mesh,Object3D,OrthographicCamera,PerspectiveCamera,SkinnedMesh,Vector3} from 'three';

/** Skinned/morphing actors have moving bounds; actor radius culling remains owned by the world. */
export function disableCharacterCulling(root:Object3D):void {
  root.traverse(object=>{if(object instanceof Mesh)object.frustumCulled=false;});
}

/** Includes equipped geometry while excluding hidden fallback rigs, particles and unrelated floors. */
export function getCharacterBounds(root:Object3D):Box3 {
  root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);
  const result=new Box3();
  root.traverseVisible(object=>{
    if(!(object instanceof Mesh)||!object.geometry.attributes.position?.count)return;
    if(object instanceof SkinnedMesh)object.computeBoundingBox();
    else if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
    const local=object instanceof SkinnedMesh?object.boundingBox:object.geometry.boundingBox;
    if(!local||local.isEmpty())return;
    const world=local.clone().applyMatrix4(object.matrixWorld);
    if([...world.min.toArray(),...world.max.toArray()].every(Number.isFinite))result.union(world);
  });
  if(result.isEmpty())result.set(new Vector3(-.5,0,-.5),new Vector3(.5,2,.5));
  return result;
}

/** Preserve authored transforms: only the new presentation group receives normalization. */
export function createFootPivot(model:Object3D,height:number,yaw=0):Group {
  const pivot=new Group(),presentation=new Group();
  pivot.name='Character feet pivot';presentation.name='Normalized model presentation';
  presentation.rotation.y=Number.isFinite(yaw)?yaw:0;
  presentation.add(model);pivot.add(presentation);
  const bounds=getCharacterBounds(pivot),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  const requested=Number.isFinite(height)&&height>0?height:1.9;
  const scale=requested/Math.max(.0001,size.y);
  presentation.scale.setScalar(scale);
  presentation.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  disableCharacterCulling(pivot);pivot.updateMatrixWorld(true);
  return pivot;
}

export function configureCharacterCamera(camera:PerspectiveCamera|OrthographicCamera):void {
  camera.near=.1;camera.far=1000;
  camera.updateProjectionMatrix();
}

export interface PreviewFraming {bounds:Box3;target:Vector3;distance:number;}
/** Fit all eight corners, including horizontal wings/weapons, for both narrow and wide previews. */
export function fitPreviewCamera(camera:PerspectiveCamera,rootOrBounds:Object3D|Box3,aspect=camera.aspect,padding=1.15):PreviewFraming {
  configureCharacterCamera(camera);camera.aspect=Number.isFinite(aspect)&&aspect>0?aspect:1;
  const bounds=rootOrBounds instanceof Box3?rootOrBounds.clone():getCharacterBounds(rootOrBounds);
  if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))bounds.set(new Vector3(-.5,0,-.5),new Vector3(.5,2,.5));
  const target=bounds.getCenter(new Vector3()),direction=new Vector3(0,.06,1).normalize();
  const right=new Vector3(1,0,0),up=new Vector3().crossVectors(direction,right).normalize();
  const tanVertical=Math.tan(camera.fov*Math.PI/360),tanHorizontal=tanVertical*camera.aspect;
  const margin=Number.isFinite(padding)?Math.max(1.05,padding):1.15;
  let distance=camera.near+1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const delta=new Vector3(x,y,z).sub(target),depth=delta.dot(direction);
    distance=Math.max(distance,depth+Math.abs(delta.dot(right))*margin/tanHorizontal,depth+Math.abs(delta.dot(up))*margin/tanVertical);
  }
  camera.position.copy(target).addScaledVector(direction,distance);camera.up.set(0,1,0);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  return {bounds,target,distance};
}
