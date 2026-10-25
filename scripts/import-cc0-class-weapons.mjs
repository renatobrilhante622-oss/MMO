#!/usr/bin/env node
/** Pin the authentic Kenney Mini Forest CC0 weapon bow + external atlas. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const origin='https://api.flockbay.com/bootstrap/library/models/v1/6597a5311b44cdc1073cb06639dc248ca9797f34266a4684b5a094c9bba5e7bf/';
const folder=resolve('public/models/equipment');
await mkdir(resolve(folder,'Textures'),{recursive:true});
async function fetchBytes(name){
 const response=await fetch(origin+name,{signal:AbortSignal.timeout(50000)});
 if(!response.ok)throw Error('Kenney Bow asset '+name+' HTTP '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
const glb=await fetchBytes('weapon-bow.glb');
if(glb.length<1000||glb.toString('ascii',0,4)!=='glTF'||glb.readUInt32LE(4)!==2||glb.readUInt32LE(8)!==glb.length)throw Error('Bad bow GLB');
const length=glb.readUInt32LE(12);
const json=JSON.parse(glb.subarray(20,20+length).toString('utf8'));
if(!Array.isArray(json.meshes)||!json.meshes.length)throw Error('Bow has no authored meshes');
const map=await fetchBytes('Textures/colormap.png');
if(!map.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Bow atlas is not PNG');
await writeFile(resolve(folder,'CC0_longbow.glb'),glb);
await writeFile(resolve(folder,'Textures/colormap.png'),map);
await writeFile(resolve(folder,'manifest.json'),JSON.stringify({
 license:'CC0-1.0',author:'Kenney',pack:'Mini Forest',
 source:'https://flockbay.com/assets/weapon-bow/',
 files:[{name:'CC0_longbow.glb',size:glb.length,sha256:createHash('sha256').update(glb).digest('hex')},
 {name:'Textures/colormap.png',size:map.length,sha256:createHash('sha256').update(map).digest('hex')}]
},null,2)+'\n');
console.log('VERIFIED bow and atlas CC0',glb.length,map.length);
