#!/usr/bin/env node
// Convert official, verified CC0 KayKit glTF accessories into standalone offline GLBs.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const commit='672074b73ba276876a19e8816ecdc5241817ab47';
const base='https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/'+commit+'/addons/kaykit_character_pack_adventures/Assets/gltf/';
const weapons=[["axe_1handed","b367258502ed8f8b172d18c72c71d81befbb39f4","6f2a1f938805bfc829c8b83851f061179b7ac657"],["axe_2handed","d0295aca8c5354070a58c6e9fca1647812b71067","b8abd54b0662070dbaf24d3a74851a606bb06e92"],["crossbow_2handed","6c70f58913d64db677e6a2cd8e62b9aa4cf24ae3","3ca37dcaefbd4daeaa48d6bb78201a599524a945"],["dagger","f090037e4ecdd0e6e891a412b2c4a9409226825e","8825c09e4f6cf6cba918770082505ab9cc5d9a48"],["quiver","6ed3f94fff3fb02773f6437db8b0089e8ed1493d","585cc493399a31a100dfa31d995b9fee62ea6256"],["shield_round","d1a20d3ce24239a540236806c4ce424e137439ea","9e35d339cfb38425253a3c236de7bdf5da199ae4"],["staff","d8bbebc6f3f6fb59e152d6b45de52add254f0697","680e289846b61c83a6c10ea444caa34faf43c9e4"],["sword_1handed","ea5115c52ee9c07b2128105c0701fe706add7593","1aca5d22ca1dbae65756af6c0b438f251c2c7e45"],["sword_2handed","593016769c491c37ce4705bc76f80e2a042ccaee","11d1a5627499582733d4d5918807415fd0dc2baf"],["wand","67f272fb273bdeb403674509464d7948a3aeb826","492d79a4b86352d1e7c81cfed4ac3a02ae48565b"]];
const textures={"barbarian_texture":"29d2db09000ac28e626cf24c3d5ff48f7c324351","knight_texture":"a56eae7514f908862e304620b89dc2d0cb9f362f","mage_texture":"d0b91fba111e8b9c952aab6698807c0200061100","rogue_texture":"542954baba7281f028f93306943fc780b1ebcf55"};
const known=new Map(weapons.flatMap(([name,gltf,bin])=>[[name+'.gltf',gltf],[name+'.bin',bin]]));
for(const [texture,sha]of Object.entries(textures))known.set(texture+'.png',sha);
const rawCache=new Map();
async function download(name){
 if(rawCache.has(name))return rawCache.get(name);
 if(!known.has(name))throw new Error('Unapproved accessory source: '+name);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
 try{
  const response=await fetch(base+name,{signal:controller.signal});
  if(!response.ok)throw new Error('Upstream '+name+': HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(actual!==known.get(name))throw new Error('Git blob verification failed for '+name);
  rawCache.set(name,bytes);return bytes;
 }finally{clearTimeout(timer);}
}
const pad4=n=>(n+3)&~3;
function makeGlb(doc,buffer){
 const json=Buffer.from(JSON.stringify(doc),'utf8');
 const jsonPadding=Buffer.alloc(pad4(json.length)-json.length,0x20);
 const binPadding=Buffer.alloc(pad4(buffer.length)-buffer.length);
 const size=12+8+json.length+jsonPadding.length+8+buffer.length+binPadding.length;
 const header=Buffer.alloc(20);header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);
 header.writeUInt32LE(size,8);header.writeUInt32LE(json.length+jsonPadding.length,12);
 header.write('JSON',16,'ascii');
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(buffer.length+binPadding.length,0);binHeader.write('BIN\0',4,'binary');
 return Buffer.concat([header,json,jsonPadding,binHeader,buffer,binPadding],size);
}
await mkdir(resolve('public/models'),{recursive:true});
const manifest=[];
for(const [name,gltfSha,binSha] of weapons){
 const doc=JSON.parse((await download(name+'.gltf')).toString('utf8'));
 if(doc.buffers?.length!==1)throw new Error(name+' requires exactly one glTF binary buffer');
 const chunks=[],bin=await download(name+'.bin');chunks.push(bin);
 let size=bin.length;
 for(const image of doc.images??[]){
  const file=image.uri,tex=await download(file);
  const padding=pad4(size)-size;
  if(padding)chunks.push(Buffer.alloc(padding));size+=padding;
  const view=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:tex.length});
  delete image.uri;image.bufferView=view;image.mimeType='image/png';
  chunks.push(tex);size+=tex.length;
 }
 delete doc.buffers[0].uri;doc.buffers[0].byteLength=size;
 const bytes=makeGlb(doc,Buffer.concat(chunks,size));
 const file='KayKit_Weapon_'+name+'.glb';
 await writeFile(resolve('public/models',file),bytes);
 manifest.push({name,file:'models/'+file,bytes:bytes.length,
   source:'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/'+commit+'/addons/kaykit_character_pack_adventures/Assets/gltf/'+name+'.gltf',
   sourceGltfGitSha1:gltfSha,sourceBinGitSha1:binSha,license:'CC0-1.0',author:'Kay Lousberg'});
 process.stdout.write(name+' -> '+bytes.length+' GLB bytes\n');
}
await writeFile(resolve('public/models/kaykit-weapons.json'),JSON.stringify({license:'CC0-1.0',assets:manifest},null,2)+'\n');
