#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Every source is an independently modeled CC0 3D asset: no model synthesis.
const species=['wyvern','horse','wolf','slime','golem','hellhound','dragon'];
const folder=resolve('public/models/creatures');
await mkdir(folder,{recursive:true});
const entries=[];
function entriesOf(data){
 if(Array.isArray(data))return data;
 for(const key of ['assets','results','items','data','models','hits']){
  if(Array.isArray(data?.[key]))return data[key];
  if(Array.isArray(data?.[key]?.assets))return data[key].assets;
  if(Array.isArray(data?.[key]?.items))return data[key].items;
 }
 return [];
}
async function json(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(40000)});
 if(!response.ok)throw Error('HTTP '+response.status+' for '+url);
 return response.json();
}
for(const name of species){
 let candidates=[];
 for(const term of (name==='hellhound'?['hellhound','hell hound']:[name])){
  try{
   const data=await json('https://3dassets.dev/api/v1/assets?q='+encodeURIComponent(term)+'&limit=30');
   const items=entriesOf(data);
   console.log('RESULTS',term,items.length,JSON.stringify(items.slice(0,1)).slice(0,700));
   candidates=candidates.concat(items);
  }catch(error){console.warn('Search failed',term,String(error));}
 }
 const best=candidates.map(asset=>{
  const title=String(asset.title??asset.name??asset.slug??'').toLowerCase();
  const text=title+' '+String(asset.summary??asset.description??'').toLowerCase();
  const valid=text.includes(name)||(name==='hellhound'&&text.includes('hell hound'));
  const unwanted=/statue|toy|logo|icon|trophy|chess|skull/.test(title);
  return {asset,score:(valid?30:0)+(title===name?40:0)+(title.startsWith(name+' ')?15:0)-(unwanted?90:0)};
 }).sort((a,b)=>b.score-a.score)[0];
 if(!best||best.score<1){console.warn('NO VALID SPECIES ASSET',name);continue;}
 const slug=String(best.asset.slug??best.asset.id??'');
 if(!slug){console.warn('NO SLUG',name);continue;}
 let detail=best.asset;
 try{const data=await json('https://3dassets.dev/api/v1/assets/'+encodeURIComponent(slug));detail=data.asset??data.data??data;}catch(error){console.warn('detail failed',slug,String(error));}
 const url=detail.cdnUrl??detail.downloadUrl??detail.glbUrl??best.asset.cdnUrl;
 if(typeof url!=='string'||(!url.startsWith('https://cdn.3dassets.dev/')&&!url.startsWith('https://3dassets.dev/'))){
  console.warn('REJECT URL',name,url);continue;
 }
 let bytes;
 try{const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(String(response.status));bytes=Buffer.from(await response.arrayBuffer());}catch(error){console.warn('DOWNLOAD FAILED',name,String(error));continue;}
 if(bytes.length<512||bytes.length>12*1024*1024||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length){console.warn('INVALID GLB',name,bytes.length);continue;}
 const size=bytes.readUInt32LE(12);
 if(size>bytes.length-20)continue;
 const gltf=JSON.parse(bytes.subarray(20,20+size).toString('utf8'));
 if(!Array.isArray(gltf.meshes)||!gltf.meshes.length||gltf.buffers?.some(x=>x.uri)||gltf.images?.some(x=>x.uri))continue;
 const file='Creature_'+name+'.glb';
 await writeFile(resolve(folder,file),bytes);
 const asset={id:name,file:'models/creatures/'+file,title:detail.title??best.asset.title??name,slug,
  source:'https://3dassets.dev/assets/'+slug,cdnUrl:url,
  license:'CC0-1.0',sha256:createHash('sha256').update(bytes).digest('hex'),
  size:bytes.length,meshCount:gltf.meshes.length,animationCount:gltf.animations?.length??0};
 entries.push(asset);
 console.log('IMPORTED',name,asset.title,asset.size,'animations',asset.animationCount);
}
const missing=species.filter(x=>!entries.some(y=>y.id===x));
await writeFile(resolve(folder,'manifest.json'),JSON.stringify({license:'CC0-1.0',source:'https://3dassets.dev/',assets:entries,missing},null,2)+'\n');
console.log('IMPORTED',entries.length,'MISSING',missing.join(', '));
