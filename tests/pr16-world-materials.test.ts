import {describe,expect,it} from 'vitest';
import {DoubleSide,MeshStandardMaterial,Texture} from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {organicMaterial} from '../src/world/FoliageAppearance';

describe('CC0 ground cover and organic PBR appearance',()=>{
  it('repairs empty white/black foliage slots while leaving the shared source unchanged',()=>{
    for(const color of [0xffffff,0x000000]){
      const source=new MeshStandardMaterial({color,metalness:1,roughness:.1});
      const clone=organicMaterial(source,'foliage');
      expect(clone).not.toBe(source);expect(source.color.getHex()).toBe(color);expect(source.metalness).toBe(1);
      expect(clone.metalness).toBe(0);expect(clone.roughness).toBeGreaterThan(.8);expect(clone.side).toBe(DoubleSide);
      expect(clone.color.g).toBeGreaterThan(clone.color.r);expect(clone.color.getHex()).not.toBe(color);
      clone.dispose();source.dispose();
    }
  });
  it('preserves authored albedo and vertex color palettes rather than flattening their art',()=>{
    const texture=new Texture(),source=new MeshStandardMaterial({map:texture,color:0xb4af84,emissive:0x050706,emissiveIntensity:.05});
    const mapped=organicMaterial(source,'foliage');
    expect(mapped.map).toBe(texture);expect(mapped.color.equals(source.color)).toBe(true);expect(mapped.emissive.equals(source.emissive)).toBe(true);
    const vertex=new MeshStandardMaterial({color:0xffffff,vertexColors:true});
    const colored=organicMaterial(vertex,'bark',true);
    expect(colored.vertexColors).toBe(true);expect(colored.color.getHex()).toBe(0xffffff);
    for(const material of [source,mapped,vertex,colored])material.dispose();texture.dispose();
  });
  it('bundles source-pinned authored grass and flower meshes with intact GLB buffers and CC0 licenses',()=>{
    const manifest=JSON.parse(readFileSync('public/models/ground-cover/manifest.json','utf8')) as {license:string;assets:Array<{file:string;source:string;bytes:number;sha256:string;license:string}>};
    expect(manifest.license).toBe('CC0-1.0');expect(manifest.assets).toHaveLength(3);
    for(const asset of manifest.assets){
      const data=readFileSync('public/models/ground-cover/'+asset.file);
      expect(data.toString('ascii',0,4)).toBe('glTF');expect(data.readUInt32LE(8)).toBe(data.length);expect(data.length).toBe(asset.bytes);
      expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);expect(asset.license).toBe('CC0-1.0');
      expect(asset.source).toContain('/7be9b573bc74f32ed766b44b3f46550d02ca83b5/packs/nature-kit/');
      const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));
      expect(json.meshes.length).toBeGreaterThan(0);expect(json.accessors.some((a:{count:number})=>a.count>0)).toBe(true);
    }
  });
});
