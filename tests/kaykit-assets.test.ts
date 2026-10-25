import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CLASS_DEFINITIONS,CLASS_IDS} from '../src/combat/ClassSystem';
import {CLASS_EQUIPMENT_MODELS} from '../src/assets/WeaponGLB';
import {ArticulatedCharacter} from '../src/player/ArticulatedCharacter';

interface ParsedGLB {
  asset:{version:string};
  meshes:unknown[];
  animations?:Array<{name?:string}>;
  nodes?:Array<{name?:string}>;
  images?:Array<{bufferView?:number;uri?:string}>;
}
const assetDir=resolve(process.cwd(),'public/models');
function parse(name:string):ParsedGLB{
  const bytes=readFileSync(resolve(assetDir,name));
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.toString('ascii',0,4)).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.toString('ascii',16,20)).toBe('JSON');
  const length=bytes.readUInt32LE(12);
  expect(length).toBeLessThan(bytes.length-20);
  return JSON.parse(bytes.subarray(20,20+length).toString('utf8')) as ParsedGLB;
}
const hero=['Barbarian','Knight','Mage','Rogue','Rogue_Hooded'];
const monsters=['Skeleton_Minion','Skeleton_Warrior'];
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');

describe('official CC0 GLB asset integrity',()=>{
  it('includes genuine skinned animated hero meshes for all five distinct silhouettes',()=>{
    for(const name of hero){
      const glb=parse('KayKit_'+name+'.glb');
      expect(glb.asset.version).toBe('2.0');
      expect(glb.meshes.length).toBeGreaterThan(0);
      const clips=new Set(glb.animations?.map(a=>a.name));
      for(const required of ['Idle','Running_A','Walking_A','Sit_Chair_Idle','Dodge_Forward'])
        expect(clips.has(required),name+': missing '+required).toBe(true);
      expect([...clips].some(clip=>clip?.includes('Melee_Attack'))).toBe(true);
    }
  });

  it('includes two authentic animated skeleton enemies and bosses',()=>{
    for(const name of monsters){
      const model=parse('KayKit_'+name+'.glb');
      expect(model.meshes.length).toBeGreaterThan(0);
      expect(model.animations?.some(a=>a.name==='Running_A')).toBe(true);
      expect(model.animations?.some(a=>a.name==='Death_A')).toBe(true);
    }
  });

  it('every class resolves to an actual KayKit model instead of a geometry dummy',()=>{
    for(const id of CLASS_IDS){
      const heroRig=new ArticulatedCharacter(CLASS_DEFINITIONS[id]);
      const names=heroRig.root.children.map(child=>child.name);
      expect(names.some(name=>name.startsWith('GLB KayKit_')),id).toBe(true);
      heroRig.dispose();
    }
  });

  it('supports original bone sockets for right/left-hand accessories',()=>{
    const knight=parse('KayKit_Knight.glb');
    const names=(knight.nodes??[]).map(n=>normalize(n.name??''));
    const right=names.some(n=>['righthand','handr','rhand','rightwrist','wristr'].some(a=>n===a||n.endsWith(a)));
    const left=names.some(n=>['lefthand','handl','lhand','leftwrist','wristl'].some(a=>n===a||n.endsWith(a)));
    expect(right,'Missing right-hand bone: '+names.filter(n=>n.includes('hand')).join(',')).toBe(true);
    expect(left,'Missing left-hand bone: '+names.filter(n=>n.includes('hand')).join(',')).toBe(true);
  });

  it('all class weapons are true locally bundled textured GLBs',()=>{
    expect(Object.keys(CLASS_EQUIPMENT_MODELS).sort()).toEqual([...CLASS_IDS].sort());
    for(const loadout of Object.values(CLASS_EQUIPMENT_MODELS)){
      for(const equipment of loadout){
        const glb=parse('KayKit_Weapon_'+equipment.model+'.glb');
        expect(glb.meshes.length).toBeGreaterThan(0);
        for(const image of glb.images??[]){
          expect(image.bufferView).toBeTypeOf('number');
          expect(image.uri).toBeUndefined();
        }
      }
    }
  });

  it('uses metadata from pinned CC0 sources',()=>{
    const characters=JSON.parse(readFileSync(resolve(assetDir,'kaykit-manifest.json'),'utf8')) as {assets:Array<{license:string;upstreamGitBlobSha1:string}>};
    const weapons=JSON.parse(readFileSync(resolve(assetDir,'kaykit-weapons.json'),'utf8')) as {assets:Array<{license:string;sourceGltfGitSha1:string}>};
    expect(characters.assets).toHaveLength(7);
    expect(weapons.assets).toHaveLength(10);
    for(const asset of characters.assets) {
      expect(asset.license).toBe('CC0-1.0');
      expect(asset.upstreamGitBlobSha1).toMatch(/^[a-f0-9]{40}$/);
    }
    for(const asset of weapons.assets) {
      expect(asset.license).toBe('CC0-1.0');
      expect(asset.sourceGltfGitSha1).toMatch(/^[a-f0-9]{40}$/);
    }
  });
});
