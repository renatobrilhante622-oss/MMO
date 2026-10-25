import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { WEAPON_PACKS } from '../src/rpg/WeaponPacks';

type GLBJSON={meshes?:unknown[];skins?:unknown[];animations?:Array<{name:string}>};
function inspectGLB(path:string):{bytes:Buffer;json:GLBJSON}{
  const bytes=readFileSync(path);
  expect(bytes.toString('ascii',0,4),path).toBe('glTF');
  expect(bytes.readUInt32LE(4),path).toBe(2);
  expect(bytes.readUInt32LE(8),path).toBe(bytes.length);
  expect(bytes.toString('ascii',16,20),path).toBe('JSON');
  const chunkSize=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.toString('utf8',20,20+chunkSize)) as GLBJSON;
  expect(json.meshes?.length,path).toBeGreaterThan(0);
  return {bytes,json};
}
function gitBlobHash(bytes:Buffer):string{
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
describe('PR12: GLB animation and unique weapon asset contracts',()=>{
  it('ships 45 distinct, source-pinned GLB files attached to the 45 pack definitions',()=>{
    const {assets}=JSON.parse(readFileSync('public/models/weapons/manifest.json','utf8')) as {
      assets:Array<{id:string;file:string;hash:string;source:string;license:string;classId:string;tier:number}>
    };
    expect(assets).toHaveLength(45);
    expect(WEAPON_PACKS).toHaveLength(45);
    expect(new Set(assets.map(x=>x.hash)).size).toBe(45);
    expect(new Set(assets.map(x=>x.file)).size).toBe(45);
    for(const item of assets){
      expect(item.id).toBe('armory-'+item.classId+'-'+item.tier);
      expect(item.license).toBe('CC0-1.0');
      expect(item.source).toMatch(/^https:\/\/github\.com\//);
      expect(existsSync('public/'+item.file),item.id).toBe(true);
      const {bytes}=inspectGLB('public/'+item.file);
      expect(gitBlobHash(bytes),item.id).toBe(item.hash);
      const pack=WEAPON_PACKS.find(x=>x.id===item.id);
      expect(pack,item.id).toBeDefined();
      expect(pack?.weapons[0]?.model,item.id).toBe(item.id);
    }
  });
  it('integrates four actual skinned Quaternius creatures with source animation clips',()=>{
    const {assets}=JSON.parse(readFileSync('public/models/creatures/pr12-manifest.json','utf8')) as {
      assets:Array<{id:string;file:string;hash:string;license:string;source:string;expectedClips:string[]}>
    };
    expect(assets.map(a=>a.id).sort()).toEqual(
      ['Creature_dragon','Creature_slime','Creature_wolf','Creature_wyvern'].sort());
    for(const entry of assets){
      const {bytes,json}=inspectGLB('public/'+entry.file);
      expect(gitBlobHash(bytes),entry.id).toBe(entry.hash);
      expect(json.skins?.length,entry.id).toBeGreaterThan(0);
      const names=(json.animations??[]).map(c=>c.name.toLowerCase().replace(/[^a-z0-9]/g,''));
      for(const expected of entry.expectedClips){
        const suffix=expected.toLowerCase().replace(/[^a-z0-9]/g,'');
        expect(names.some(name=>name.endsWith(suffix)),entry.id+' '+expected).toBe(true);
      }
    }
  });
  it('recognizes armature-prefixed animations and preserves GPU vertex fallback for unsourced rigs',()=>{
    const code=readFileSync('src/assets/AnimatedGLB.ts','utf8');
    expect(code).toContain('normalized.endsWith(match)');
    expect(code).toContain("'gallop'");
    expect(code).toContain("'fast_flying'");
    expect(code).toContain("'bite_front'");
    expect(code).toContain('creatureAttack');
    expect(code).toContain('this.staticCreature');
    const equipment=readFileSync('src/assets/WeaponGLB.ts','utf8');
    expect(equipment).toContain("'models/weapons/'+name+'.glb'");
    expect(equipment).not.toContain('new BoxGeometry');
    expect(equipment).not.toContain('new SphereGeometry');
  });
});
