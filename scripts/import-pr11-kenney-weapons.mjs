#!/usr/bin/env node
/** Vendor only source-pinned, real CC0 Kenney geometry. */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const revision='7be9b573bc74f32ed766b44b3f46550d02ca83b5';
const assets=[
 {id:'dungeon_sword',path:'packs/mini-dungeon/weapon-sword.glb',hash:'93f72f18bf647a2c92a482240bd3701c091e22be'},
 {id:'prototype_sword',path:'packs/prototype-kit/weapon-sword.glb',hash:'c5553e10cc8b71a3956372b8affa3d56fa875557'},
 {id:'dungeon_shield_round',path:'packs/mini-dungeon/shield-round.glb',hash:'b1eb147391c252f31a852220ca81d384075a8a91'},
 {id:'dungeon_shield_rectangle',path:'packs/mini-dungeon/shield-rectangle.glb',hash:'08629ec5ca39eb0115b99005624500006574642a'}
];
const folder=resolve('public/models/weapon-packs');await mkdir(folder,{recursive:true});
const manifest=[];
for(const asset of assets){
  const url='https://raw.githubusercontent.com/Hidencod/tge-assets/'+revision+'/'+asset.path;
  const response=await fetch(url,{signal:AbortSignal.timeout(50000)});
  if(!response.ok)throw new Error(asset.id+' HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(sha!==asset.hash)throw new Error('Git blob hash mismatch '+asset.id);
  if(bytes.length<512||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid binary GLB '+asset.id);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  if(!json.meshes?.length)throw new Error('Missing authored mesh '+asset.id);
  const name='Kenney_'+asset.id+'.glb';
  await writeFile(resolve(folder,name),bytes);
  manifest.push({id:asset.id,file:'models/weapon-packs/'+name,source:url,license:'CC0-1.0',hash:sha,bytes:bytes.length,meshes:json.meshes.length});
  console.log('VERIFIED',asset.id,bytes.length,'bytes');
}
await writeFile(resolve(folder,'manifest.json'),JSON.stringify({license:'CC0-1.0',assets:manifest},null,2)+'\n');
