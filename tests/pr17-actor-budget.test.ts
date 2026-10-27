import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Group,Object3D,PerspectiveCamera,Scene,Texture,Mesh,BufferGeometry,MeshStandardMaterial,LinearMipmapLinearFilter} from 'three';
import {BoundedPool,configureActorTextures,optimizedModelPath} from '../src/assets/ModelResources';
import {registerActor,updateActorVisibility,actorIsVisible} from '../src/core/ActorVisibility';
import {SKIN_IDENTITIES} from '../src/player/SkinIdentity';
import {RarityAura} from '../src/companions/RarityAura';
const manifest=JSON.parse(readFileSync('public/models/optimized/manifest.json','utf8'));
describe('PR17 authored actor optimization',()=>{
 it('ships self-contained compressed GLBs with unchanged animation names and verifiable hashes',()=>{
  expect(manifest.assets.length).toBeGreaterThan(90);
  let before=0,after=0,triBefore=0,triAfter=0;
  for(const a of manifest.assets){
   const bytes=readFileSync('public/'+a.file);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
   expect(createHash('sha256').update(bytes).digest('hex'),a.file).toBe(a.sha256);
   expect(gltf.buffers.every((b:{uri?:string})=>!b.uri)).toBe(true);
   expect((gltf.images??[]).every((i:{uri?:string;mimeType:string})=>!i.uri&&i.mimeType==='image/webp')).toBe(true);
   expect((gltf.animations??[]).map((c:{name:string})=>c.name),a.file).toEqual(a.before.clips);
   expect(a.after.triangles).toBeLessThanOrEqual(a.before.triangles);
   expect(optimizedModelPath(a.original)).toBe(a.file);
   for(const t of a.after.textures)expect(Math.max(...t.size)).toBeLessThanOrEqual(512);
   before+=a.before.bytes;after+=a.after.bytes;triBefore+=a.before.triangles;triAfter+=a.after.triangles;
  }
  expect(after).toBeLessThan(before*.65);expect(triAfter).toBeLessThan(triBefore*.9);
 });
 it('preserves authored joint coordinates so compressed skins keep attachment scale',()=>{
  const parse=(path:string)=>{const bytes=readFileSync(path);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());};
  for(const file of ['models/KayKit_Mage.glb','models/pr17-source/ImperialHorse.glb']){
   const source=parse('public/'+file),result=parse('public/'+optimizedModelPath(file));
   const joints=new Set<number>((source.skins??[]).flatMap((skin:{joints:number[]})=>skin.joints));
   for(const index of joints){const original=source.nodes[index],node=result.nodes.find((n:{name?:string})=>n.name===original.name);expect(node,original.name).toBeDefined();
    for(const [key,fallback] of Object.entries({translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]})){
     const a=original[key]??fallback,b=node[key]??fallback;
     for(let i=0;i<a.length;i++)expect(Math.abs(b[i]-a[i]),original.name+' '+key).toBeLessThan(1e-5);
    }
   }
  }
 });
 it('uses source-pinned CC0 horses with true author-authored gaits',()=>{
  const source=JSON.parse(readFileSync('public/models/pr17-source/manifest.json','utf8'));
  for(const a of source.assets){expect(a.license).toBe('CC0-1.0');expect(a.source).toContain('/77343cac874f06b73d16ad0063339df7c9ca254c/');expect(a.animationClips).toEqual(expect.arrayContaining(['Gallop','Walk','Idle']));expect(a.animationClips.length).toBe(13);}
 });
 it('bounds pooled idle clones and never leases the same skeleton twice',()=>{
  const evicted:object[]=[],pool=new BoundedPool<object>(2,x=>evicted.push(x));const a={},b={},c={};
  pool.release('mage',a);pool.release('mage',a);pool.release('horse',b);pool.release('mage',c);
  expect(pool.size).toBe(2);expect(evicted).toEqual([a]);expect(pool.acquire('mage')).toBe(c);expect(pool.acquire('mage')).toBeUndefined();expect(pool.acquire('horse')).toBe(b);
 });
 it('culls an actor envelope and restores it on camera return without touching previews',()=>{
  const scene=new Scene(),preview=new Scene(),actor=new Group(),separate=new Group();scene.add(actor);preview.add(separate);
  actor.position.set(0,0,-10);const camera=new PerspectiveCamera(60,1,.1,1000);camera.updateProjectionMatrix();
  const unregister=registerActor(actor,2),unregisterPreview=registerActor(separate,2);
  updateActorVisibility(scene,camera);expect(actor.visible).toBe(true);
  actor.position.set(200,0,-10);updateActorVisibility(scene,camera);expect(actor.visible).toBe(false);expect(separate.visible).toBe(true);
  actor.position.set(0,0,-10);updateActorVisibility(scene,camera);expect(actor.visible).toBe(true);
  const child=new Object3D();actor.add(child);actor.visible=false;expect(actorIsVisible(child)).toBe(false);
  unregister();unregisterPreview();
 });
 it('keeps animated envelopes conservatively visible at the screen border',()=>{
  const scene=new Scene(),actor=new Group();scene.add(actor);actor.position.set(8,0,-10);
  const camera=new PerspectiveCamera(60,1,.1,1000),remove=registerActor(actor,2);
  updateActorVisibility(scene,camera);expect(actor.visible).toBe(true);remove();
 });
 it('shares mipmapped texture identities across material clones',()=>{
  const texture=new Texture(),geometry=new BufferGeometry(),material=new MeshStandardMaterial({map:texture}),root=new Group();root.add(new Mesh(geometry,material),new Mesh(geometry,material.clone()));
  configureActorTextures(root);expect(material.map).toBe(texture);expect(texture.generateMipmaps).toBe(true);expect(texture.minFilter).toBe(LinearMipmapLinearFilter);expect(texture.anisotropy).toBe(2);
  geometry.dispose();material.dispose();texture.dispose();
 });
 it('preserves class-specific hood/cloth and caps rarity overdraw',()=>{
  for(const id of ['elementalist','warlock','necromancer','assassin','ranger'] as const){expect(SKIN_IDENTITIES[id].helmet).toBe(false);expect(SKIN_IDENTITIES[id].metallic).toBe(false);}
  expect(SKIN_IDENTITIES.paladin.helmet).toBe(true);
  const aura=new RarityAura();aura.configure(2,0xff0000);expect(aura.visible).toBe(false);aura.configure(5,0xff0000);expect(aura.geometry.drawRange.count).toBe(32);expect(aura.frustumCulled).toBe(true);aura.dispose();
 });
});
