import {Mesh,type Object3D} from 'three';
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Smooth only imported animal surfaces, keeping triangles, UVs and skin weights.
 * Runs once per shared template, never per clone or per frame. No new body is generated.
 */
export function smoothCreatureSurface(root:Object3D):void {
  root.traverse(node=>{
    if(!(node instanceof Mesh)||!node.geometry.hasAttribute('position')||node.geometry.morphAttributes.position?.length)return;
    const original=node.geometry;
    node.geometry=toCreasedNormals(original,Math.PI*.42);
    node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();
    if(node.geometry!==original)original.dispose();
  });
}
