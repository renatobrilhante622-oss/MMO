import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {REGIONS} from '../src/world/Regions';
import {EnvironmentGLB} from '../src/world/EnvironmentGLB';

const root=resolve(process.cwd(),'public');
const manifest=JSON.parse(readFileSync(resolve(root,'models/environment/manifest.json'),'utf8')) as
  {assets:Array<{file:string;source:string;gitBlob:string;license:string;bytes:number}>};

describe('real CC0 environment and monster art',()=>{
  it('bundles 33 origin-verified CC0 assets: authored GLBs and genuine PBR scans',()=>{
    expect(manifest.assets).toHaveLength(33);
    expect(manifest.assets.filter(a=>a.file.endsWith('.glb'))).toHaveLength(18);
    expect(manifest.assets.filter(a=>a.file.endsWith('.webp'))).toHaveLength(15);
    for(const asset of manifest.assets){
      expect(asset.license).toBe('CC0-1.0');
      expect(asset.gitBlob).toMatch(/^[0-9a-f]{40}$/);
      expect(asset.source).toContain('/raw');
      const bytes=readFileSync(resolve(process.cwd(),asset.file));
      expect(bytes.length).toBe(asset.bytes);
      if(asset.file.endsWith('.glb')){
        expect(bytes.toString('ascii',0,4)).toBe('glTF');
        expect(bytes.readUInt32LE(4)).toBe(2);
        expect(bytes.readUInt32LE(8)).toBe(bytes.length);
        expect(bytes.toString('ascii',16,20)).toBe('JSON');
      }else expect(bytes.subarray(0,4).toString('ascii')).toBe('RIFF');
    }
  });
  it('contains real glTF meshes in imported ghost/demon actors and environment models',()=>{
    const names=['Quaternius_ghost.glb','Quaternius_demon.glb','Kenney_nature-kit_tree-oak.glb','Kenney_graveyard-kit_gravestone-broken.glb'];
    for(const name of names){
      const bytes=readFileSync(resolve(root,'models/environment',name));
      const length=bytes.readUInt32LE(12);
      const json=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
      expect(json.meshes?.length).toBeGreaterThan(0);
      expect(json.asset.version).toBe('2.0');
    }
  });
  it('does not generate textures via Canvas or substitute primitive trees at runtime',async()=>{
    const source=await readFile(resolve('src/world/ProceduralTextures.ts'),'utf8');
    expect(source).not.toContain('CanvasTexture');
    expect(source).not.toContain('getContext(');
    expect(source).toContain('TextureLoader');
    const terrain=await readFile(resolve('src/world/OpenWorldGenerator.ts'),'utf8');
    const active=terrain.substring(terrain.indexOf('  generate(): void {'),terrain.indexOf('  private material('));
    expect(active).toContain('new EnvironmentGLB(');
    expect(active).not.toContain('this.createVegetation()');
    expect(active).not.toContain('this.createVillage()');
    expect(active).not.toContain('createWorldSites(');
    expect(EnvironmentGLB.prototype).toHaveProperty('dispose');
  });
});
