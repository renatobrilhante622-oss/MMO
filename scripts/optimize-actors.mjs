/** Offline only: preserve originals/provenance and all joints, morphs and clip names. */
import {NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup,weld,simplify,resample,prune,textureCompress,reorder} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import {glob,readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const hash=b=>createHash('sha256').update(b).digest('hex');
const stats=d=>{const r=d.getRoot();let triangles=0,vertices=0;for(const m of r.listMeshes())for(const p of m.listPrimitives()){vertices+=p.getAttribute('POSITION')?.getCount()??0;triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3;}
return {triangles,vertices,clips:r.listAnimations().map(a=>a.getName()),skins:r.listSkins().length,textures:r.listTextures().map(t=>({mime:t.getMimeType(),size:t.getSize()}))};};
const files=[];
for await(const f of glob(['public/models/*.glb','public/models/creatures/*.glb','public/models/equipment/*.glb','public/models/weapons/*.glb','public/models/weapon-packs/*.glb','public/models/environment/Quaternius_*.glb','public/models/pr17-source/*.glb']))files.push(f);
const assets=[];
for(const original of files.sort()){
 const source=original;
 const input=await readFile(source),doc=await io.read(source);doc.setLogger(new Logger(Logger.Verbosity.ERROR));
 const before=stats(doc);
 await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.6,error:.001,lockBorder:true}),resample(),prune({keepLeaves:true,keepAttributes:true}),textureCompress({encoder:sharp,targetFormat:'webp',resize:[512,512],lossless:true}),reorder({encoder:MeshoptEncoder,target:'performance'}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
 const after=stats(doc);
 if(JSON.stringify(before.clips)!==JSON.stringify(after.clips))throw Error('Clip contract changed: '+source);
 if(before.skins!==after.skins)console.log('Optimizer skin bindings:',before.skins,after.skins);
 const output=original.replace('public/models/','public/models/optimized/');
 await mkdir(dirname(output),{recursive:true});const bytes=await io.writeBinary(doc);await writeFile(output,bytes);
 assets.push({original:original.replace('public/',''),file:output.replace('public/',''),sourceSha256:hash(input),sha256:hash(bytes),before:{bytes:input.length,...before},after:{bytes:bytes.length,...after}});
 console.log(original.split('/').at(-1),before.triangles,'→',after.triangles,input.length,'→',bytes.length);
}
await writeFile('public/models/optimized/manifest.json',JSON.stringify({generator:'scripts/optimize-actors.mjs',policy:{ratio:.6,maxRelativeError:.001,maxTextureSize:512,compression:'EXT_meshopt_compression + lossless EXT_texture_webp',note:'WebP reduces download size. Decoded GPU textures are RGBA with mipmaps, not GPU block compressed. Originals and upstream license manifests are retained.'},assets},null,2)+'\n');
await writeFile('src/assets/optimized-models.json',JSON.stringify(Object.fromEntries(assets.map(a=>[a.original,a.file])),null,2)+'\n');
