import {Camera,Frustum,Matrix4,Object3D,Scene,Sphere,Vector3} from 'three';
const actors=new Set<Object3D>();
const frustum=new Frustum(),matrix=new Matrix4(),sphere=new Sphere(),center=new Vector3(),scale=new Vector3();
export function registerActor(root:Object3D,height:number):()=>void {
  root.userData.actorEnvelopeHeight=height;actors.add(root);return ()=>actors.delete(root);
}
/** Actor-wide conservative envelope includes animation, equipment and spread wings.
 * Mesh-level skinned bounds are deliberately untouched: tight bind-pose bounds cut limbs.
 * Only roots in this renderer's scene are touched; collection/arena previews are isolated.
 */
export function updateActorVisibility(scene:Scene,camera:Camera,radius=45):void {
  camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
  for(const root of actors){
    let ancestor:Object3D|null=root,belongs=false,parentVisible=true;
    while(ancestor){if(ancestor===scene){belongs=true;break;}if(ancestor!==root&&!ancestor.visible)parentVisible=false;ancestor=ancestor.parent;}
    if(!belongs)continue;
    root.updateWorldMatrix(true,false);const h=root.userData.actorEnvelopeHeight as number;
    center.set(0,h*.5,0).applyMatrix4(root.matrixWorld);root.getWorldScale(scale);
    // 3× height covers capes, extended hands, mount wings and bone attachments.
    sphere.set(center,h*3*Math.max(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)));
    const distance=Math.max(0,center.distanceTo(camera.position)-sphere.radius);
    root.visible=parentVisible&&distance<=radius&&frustum.intersectsSphere(sphere);
  }
}
export function actorIsVisible(root:Object3D):boolean {
  for(let node:Object3D|null=root;node;node=node.parent)if(!node.visible)return false;
  return true;
}
