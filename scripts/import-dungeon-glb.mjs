#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const assets=[{"name":"floor","path":"packs/mini-dungeon/floor.glb","sha":"65ed388c46b1149d1371edff8ebd0a4b02ff3ba7","size":12656},{"name":"floor-detail","path":"packs/mini-dungeon/floor-detail.glb","sha":"01d2df1f9c1f7f013548e90d956c5b4aaedb445a","size":22796},{"name":"wall","path":"packs/mini-dungeon/wall.glb","sha":"4d036dbbe9e77227a2361c7560a3f22a8d75da38","size":29012},{"name":"wall-half","path":"packs/mini-dungeon/wall-half.glb","sha":"f06337447a7d8af745696608ec6c4a84220eb9d7","size":26688},{"name":"wall-opening","path":"packs/mini-dungeon/wall-opening.glb","sha":"fec1907e1ea42f1985a17efc0a33ece218ca85aa","size":30080},{"name":"gate","path":"packs/mini-dungeon/gate.glb","sha":"eacdf4b5b1a7ec4205e33b20096cf6cc3e73a79a","size":24864},{"name":"column","path":"packs/mini-dungeon/column.glb","sha":"b02503a9148449d579a13b7bd811c859d872b4bd","size":22128},{"name":"chest","path":"packs/mini-dungeon/chest.glb","sha":"04c69e7cefec4a34ada418856174bbcafa93ed69","size":44768},{"name":"trap","path":"packs/mini-dungeon/trap.glb","sha":"d54094ff7982094d1a8f0664b2f52b23513bcd69","size":53668},{"name":"stairs","path":"packs/mini-dungeon/stairs.glb","sha":"814f32b0a9884e045e0b0aee2b67664d68cff59b","size":22420},{"name":"fire-basket","path":"packs/graveyard-kit/fire-basket.glb","sha":"0b8c6ec2ea4a4be3d7bce24b0c100601f6f278c7","size":29740}];
const revision='7be9b573bc74f32ed766b44b3f46550d02ca83b5';
await mkdir(resolve('public/models/dungeon'),{recursive:true});
const records=[];
for(const asset of assets){
  const url='https://raw.githubusercontent.com/Hidencod/tge-assets/'+revision+'/'+asset.path;
  const response=await fetch(url);
  if(!response.ok)throw new Error('Cannot retrieve CC0 dungeon asset '+asset.name+': '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const digest=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(digest!==asset.sha)throw new Error('Git SHA mismatch '+asset.name);
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB '+asset.name);
  const file='Kenney_Dungeon_'+asset.name+'.glb';
  await writeFile(resolve('public/models/dungeon',file),bytes);
  records.push({file,source:url,sourceBlobSha1:digest,bytes:bytes.length,license:'CC0-1.0',author:'Kenney'});
  process.stdout.write(file+' '+bytes.length+' bytes\n');
}
await writeFile(resolve('public/models/dungeon/manifest.json'),JSON.stringify({version:1,license:'CC0-1.0',assets:records},null,2)+'\n');
