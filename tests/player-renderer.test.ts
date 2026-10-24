import {describe,it,expect} from 'vitest';
import {Bone,Box3,BoxGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,OrthographicCamera,PerspectiveCamera,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {configureCharacterCamera,createFootPivot,disableCharacterCulling,fitPreviewCamera,getCharacterBounds} from '../src/player/PlayerRenderer';

describe('complete character projection and pivot normalization',()=>{
 it('preserves authored scale and root transforms while placing rotated feet at zero',()=>{
  const source=new Group();source.scale.set(.01,.02,.03);source.position.set(3,5,-2);source.rotation.z=.08;
  const mesh=new Mesh(new BoxGeometry(100,200,60),new MeshStandardMaterial());mesh.position.set(35,110,15);source.add(mesh);
  const originalScale=source.scale.clone(),originalPosition=source.position.clone(),pivot=createFootPivot(source,1.9,Math.PI*.7),bounds=getCharacterBounds(pivot);
  expect(source.scale.equals(originalScale)).toBe(true);expect(source.position.equals(originalPosition)).toBe(true);
  expect(bounds.min.y).toBeCloseTo(0,6);expect(bounds.getSize(new Vector3()).y).toBeCloseTo(1.9,6);
  expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0,6);expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0,6);
  expect(pivot.position.toArray()).toEqual([0,0,0]);expect(mesh.frustumCulled).toBe(false);
 });
 it('normalizes an authored skinned body without double-applying its root transform',()=>{
  const source=new Group();source.scale.setScalar(.01);source.rotation.y=.4;
  const geometry=new BoxGeometry(70,190,40);geometry.translate(0,95,0);const n=geometry.attributes.position.count;
  const weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(n*4),4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const skin=new SkinnedMesh(geometry,new MeshStandardMaterial()),bone=new Bone();skin.add(bone);source.add(skin);source.updateMatrixWorld(true);skin.bind(new Skeleton([bone]));
  const pivot=createFootPivot(source,1.9,Math.PI),bounds=getCharacterBounds(pivot);
  expect(bounds.min.y).toBeCloseTo(0,5);expect(bounds.getSize(new Vector3()).y).toBeCloseTo(1.9,5);expect(source.scale.x).toBe(.01);expect(skin.frustumCulled).toBe(false);
 });
 it('excludes hidden procedural bodies but includes visible equipped wings',()=>{
  const root=new Group(),hidden=new Group();hidden.visible=false;root.add(hidden);
  hidden.add(new Mesh(new BoxGeometry(100,100,100),new MeshStandardMaterial()));
  const body=new Mesh(new BoxGeometry(1,2,1),new MeshStandardMaterial());body.position.y=1;root.add(body);
  const wings=new Mesh(new BoxGeometry(4,.6,.1),new MeshStandardMaterial());wings.position.y=1.5;root.add(wings);
  const bounds=getCharacterBounds(root);expect(bounds.getSize(new Vector3()).toArray()).toEqual([4,2,1]);
  disableCharacterCulling(root);root.traverse(o=>{if(o instanceof Mesh)expect(o.frustumCulled).toBe(false);});
 });
 it('fits the entire equipped body across narrow portrait, landscape and desktop cameras',()=>{
  const bounds=new Box3(new Vector3(-2,-.1,-.8),new Vector3(2,2.5,.9));
  for(const aspect of [.12,390/844,844/390,1366/768]){
   const camera=new PerspectiveCamera(32,aspect,5,10);fitPreviewCamera(camera,bounds,aspect);
   expect(camera.near).toBe(.1);expect(camera.far).toBe(1000);
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const ndc=new Vector3(x,y,z).project(camera);expect(Math.abs(ndc.x)).toBeLessThan(1);expect(Math.abs(ndc.y)).toBeLessThan(1);expect(ndc.z).toBeGreaterThan(-1);expect(ndc.z).toBeLessThan(1);
   }
  }
 });
 it('uses the same safe clipping planes for orthographic renderers',()=>{
  const camera=new OrthographicCamera(-2,2,2,-2,10,20);configureCharacterCamera(camera);expect(camera.near).toBe(.1);expect(camera.far).toBe(1000);
 });
});
