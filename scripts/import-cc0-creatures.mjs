#!/usr/bin/env node
/** Reproducible, species-correct, CC0 imports. Immutable publisher CDN URLs. */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const SOURCES=[
 {id:'wyvern',assetId:36715,slug:'dragons-and-wyverns-wyvern-wings-spread-a6d1b274',title:'Wyvern With Wings Spread',expectedAnimated:false},
 {id:'horse',assetId:129,slug:'frontier-saddle-horse',title:'Frontier saddle horse',expectedAnimated:false},
 {id:'wolf',assetId:32709,slug:'fps-survival-forest-outpost-creature-wolf-4be4d311',title:'Timber Wolf, Jointed',expectedAnimated:true},
 {id:'slime',assetId:305,slug:'ember-quest-moss-slime',title:'Ember Quest moss slime',expectedAnimated:false},
 {id:'golem',assetId:106,slug:'runestone-conservatory-stone-garden-golem',title:'Runestone Stone Garden Golem',expectedAnimated:false},
 {id:'dragon',assetId:36695,slug:'dragons-and-wyverns-western-dragon-wings-spread-8d633362',title:'Western Dragon With Wings Spread',expectedAnimated:false},
];
const root=resolve('public/models/creatures');
await mkdir(root,{recursive:true});
const assets=[];
for(const source of SOURCES){
 const url='https://cdn.3dassets.dev/assets/'+source.assetId+'/v1/model.glb';
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Unable to retrieve '+source.id+': '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length<512||bytes.length>12*1024*1024||bytes.toString('ascii',0,4)!=='glTF'
    ||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid glTF '+source.id);
 const len=bytes.readUInt32LE(12);if(len>bytes.length-20)throw Error('Invalid GLB JSON length');
 const parsed=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
 if(!parsed.meshes?.length||parsed.buffers?.some(b=>b.uri)||parsed.images?.some(i=>i.uri))throw Error('Non-selfcontained GLB '+source.id);
 if(source.expectedAnimated&&!parsed.animations?.length)throw Error('Animation missing: '+source.id);
 const filename='Creature_'+source.id+'.glb';
 await writeFile(resolve(root,filename),bytes);
 assets.push({id:source.id,file:'models/creatures/'+filename,
  source:'https://3dassets.dev/assets/'+source.slug,cdnUrl:url,
  title:source.title,license:'CC0-1.0',sha256:createHash('sha256').update(bytes).digest('hex'),
  size:bytes.length,meshCount:parsed.meshes.length,animationCount:parsed.animations?.length??0,
  animated:!!parsed.animations?.length});
 process.stdout.write('VERIFIED '+source.id+': '+bytes.length+' bytes, '+(parsed.animations?.length??0)+' clips\n');
}
await writeFile(resolve(root,'manifest.json'),JSON.stringify({license:'CC0-1.0',
  source:'https://3dassets.dev/',assets,
  pending:['hellhound'],note:'Standalone Hellhound animation/model unavailable in the verified CC0 source; use authentic animated wolf mesh with fire VFX until a distinct Hellhound asset is approved.'},null,2)+'\n');
