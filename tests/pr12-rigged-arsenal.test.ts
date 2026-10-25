import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { WEAPON_PACKS } from '../src/rpg/WeaponPacks';

type GLBJSON={
  meshes?:Array<{primitives:Array<{attributes:Record<string,number>}>}>;
  skins?:Array<{joints:number[];inverseBindMatrices?:number}>;
  nodes?:Array<{name?:string}>;
  accessors?:Array<{count:number}>;
  animations?:Array<{name:string;channels?:Array<{target:{node:number;path:string}}>}>
};
function inspectGLB(path:string):{bytes:Buffer;json:GLBJSON}{
  const bytes=readFileSync(path);
  expect(bytes.toString('ascii',0,4),path).toBe('glTF');
  expect(bytes.readUInt32LE(4),path).toBe(2);
  expect(bytes.readUInt32LE(8),path).toBe(bytes.length);
  expect(bytes.toString('ascii',16,20),path).toBe('JSON');
  const size=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.toString('utf8',20,20+size)) as GLBJSON;
  expect(json.meshes?.length,path).toBeGreaterThan(0);
  return {bytes,json};
}
function gitBlobHash(bytes:Buffer):string{
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
const families:Record<string,RegExp>={
  berserker:/axe|claymore|sword_big/i, paladin:/sword/i, assassin:/dagger/i,
  ranger:/bow/i, elementalist:/staff|wand/i, necromancer:/scythe/i,
  monk:/staff/i, lanceman:/spear/i, warlock:/staff|wand/i,
};
describe('PR12: packaged skeletal actors and class-compatible real GLBs',()=>{
  it('has 45 individually hashed geometry files and 9 correct weapon families',()=>{
    const manifest=JSON.parse(readFileSync('public/models/weapons/manifest.json','utf8')) as {
      assets:Array<{id:string;file:string;hash:string;source:string;license:string;shapeOrigin:string;classId:string;tier:number;meshFamily:string}>;
    };
    expect(manifest.assets).toHaveLength(45);
    expect(WEAPON_PACKS).toHaveLength(45);
    expect(new Set(manifest.assets.map(a=>a.hash)).size).toBe(45);
    for(const a of manifest.assets){
      expect(a.id).toBe('armory-'+a.classId+'-'+a.tier);
      expect(a.meshFamily).toBeTruthy();
      expect(a.license).toBe('CC0-1.0');
      expect(a.source).toMatch(/^https:\/\/github\.com\//);
      expect(a.shapeOrigin,families[a.classId]+' '+a.id).toMatch(families[a.classId]);
      expect(existsSync('public/'+a.file),a.id).toBe(true);
      const {bytes,json}=inspectGLB('public/'+a.file);
      expect(gitBlobHash(bytes),a.id).toBe(a.hash);
      expect(json.meshes?.length,a.id).toBeGreaterThan(0);
      const pack=WEAPON_PACKS.find(p=>p.id===a.id);
      expect(pack?.weapons[0]?.model,a.id).toBe(a.id);
    }
  });
  it('equips five CC0 authored heavy-shield geometries across paladin rarities',()=>{
    const {shields}=JSON.parse(readFileSync('public/models/weapons/manifest.json','utf8')) as {
      shields:Array<{id:string;file:string;hash:string;meshFamily:string}>;
    };
    expect(shields).toHaveLength(5);
    expect(new Set(shields.map(s=>s.hash)).size).toBe(5);
    for(let tier=0;tier<5;tier++){
      const s=shields[tier];
      expect(s.id).toBe('paladin-shield-'+tier);
      expect(s.meshFamily).toBe('shield');
      expect(gitBlobHash(inspectGLB('public/'+s.file).bytes)).toBe(s.hash);
      expect(WEAPON_PACKS.find(p=>p.id==='armory-paladin-'+tier)?.weapons[1]?.model).toBe(s.id);
    }
  });
  it('preserves the four authored skinned Quaternius animals',()=>{
    const {assets}=JSON.parse(readFileSync('public/models/creatures/pr12-manifest.json','utf8')) as {
      assets:Array<{id:string;file:string;hash:string;expectedClips:string[]}>;
    };
    const originals=assets.filter(a=>!['Creature_horse','Creature_golem'].includes(a.id));
    expect(originals).toHaveLength(4);
    for(const a of originals){
      const {bytes,json}=inspectGLB('public/'+a.file);
      expect(gitBlobHash(bytes)).toBe(a.hash);
      expect(json.skins?.length).toBeGreaterThan(0);
      const names=(json.animations??[]).map(c=>c.name.toLowerCase().replace(/[^a-z0-9]/g,''));
      for(const x of a.expectedClips)expect(names.some(n=>n.endsWith(x.toLowerCase().replace(/[^a-z0-9]/g,'')))).toBe(true);
    }
  });
  it('validates full glTF bone weights and six playable skeletal animation tracks for horse and golem',()=>{
    const {assets}=JSON.parse(readFileSync('public/models/creatures/pr12-manifest.json','utf8')) as {
      assets:Array<{id:string;file:string;hash:string;bones?:number;expectedClips:string[]}>;
    };
    for(const id of ['Creature_horse','Creature_golem']){
      const a=assets.find(e=>e.id===id)!;
      expect(a).toBeDefined();
      const {bytes,json}=inspectGLB('public/'+a.file);
      expect(gitBlobHash(bytes)).toBe(a.hash);
      expect(json.skins?.length).toBeGreaterThan(0);
      const joints=json.skins![0].joints;
      expect(joints.length).toBe(a.bones);
      expect(json.skins![0].inverseBindMatrices).toBeDefined();
      expect(json.accessors?.[json.skins![0].inverseBindMatrices!]?.count).toBe(joints.length);
      for(const mesh of json.meshes??[])for(const p of mesh.primitives){
        expect(p.attributes.JOINTS_0).toBeDefined();
        expect(p.attributes.WEIGHTS_0).toBeDefined();
        expect(json.accessors![p.attributes.JOINTS_0].count).toBe(json.accessors![p.attributes.POSITION].count);
        expect(json.accessors![p.attributes.WEIGHTS_0].count).toBe(json.accessors![p.attributes.POSITION].count);
      }
      for(const name of a.expectedClips){
        const clip=json.animations?.find(x=>x.name===name);
        expect(clip,id+' '+name).toBeDefined();
        expect(clip?.channels?.length,id+' '+name).toBeGreaterThanOrEqual(2);
        expect(clip?.channels?.some(c=>c.target.path==='rotation'&&joints.includes(c.target.node))).toBe(true);
      }
      const bones=joints.map(i=>json.nodes?.[i]?.name??'').join(' ');
      expect(bones).toContain('Root');
      expect(bones).toContain('Head');
      expect(bones).toContain(id==='Creature_horse'?'ForeLeft':'LeftArm');
    }
  });
  it('links the mixer locomotion and GLB loading to the new real assets',()=>{
    const code=readFileSync('src/assets/AnimatedGLB.ts','utf8');
    expect(code).toContain('normalized.endsWith(match)');
    expect(code).toContain("'gallop'");
    expect(code).toContain("'fast_flying'");
    expect(code).toContain("'bite_front'");
    expect(code).toContain("this.name==='Creature_horse'");
    const weapon=readFileSync('src/assets/WeaponGLB.ts','utf8');
    expect(weapon).toContain("name.startsWith('paladin-shield-')");
    expect(weapon).not.toContain('new BoxGeometry');
    expect(weapon).not.toContain('new SphereGeometry');
  });
});
