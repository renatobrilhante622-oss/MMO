import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REGIONS,DUNGEONS} from '../src/world/Regions';
import {regionArtwork,dungeonArtwork} from '../src/ui/CardArtwork';
const manifest=JSON.parse(readFileSync('public/assets/landscapes/manifest.json','utf8')) as {license:string;sources:Array<{file:string;source:string;sha256:string;license:string}>;renders:Array<{file:string;sha256:string;bytes:number;width:number;height:number;license:string}>};
describe('bundled CC0 landscape artwork',()=>{
 it('resolves every real map and dungeon to a local bundled image, including safe unknown IDs',()=>{
  for(const region of REGIONS)expect(manifest.renders.some(asset=>regionArtwork(region.id).endsWith('/'+asset.file))).toBe(true);
  for(const dungeon of DUNGEONS)expect(manifest.renders.some(asset=>dungeonArtwork(dungeon.id).endsWith('/'+asset.file))).toBe(true);
  expect(regionArtwork('../../remote')).toBe(regionArtwork('aurora'));
  expect(dungeonArtwork('../../remote')).toBe(dungeonArtwork('tombs'));
 });
 it('ships intact high-resolution WebP artwork with traceable CC0 source files',()=>{
  expect(manifest.license).toBe('CC0-1.0');expect(manifest.renders).toHaveLength(9);
  for(const asset of manifest.renders){
   const bytes=readFileSync('public/assets/landscapes/'+asset.file);
   expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.toString('ascii',8,12)).toBe('WEBP');
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
   expect(asset.width).toBeGreaterThanOrEqual(1280);expect(asset.height).toBeGreaterThanOrEqual(640);expect(bytes.length).toBe(asset.bytes);expect(asset.license).toBe('CC0-1.0');
  }
  expect(manifest.sources.length).toBeGreaterThan(10);
  for(const source of manifest.sources){expect(source.source).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);expect(source.license).toBe('CC0-1.0');expect(createHash('sha256').update(readFileSync(source.file)).digest('hex')).toBe(source.sha256);}
 });
});
