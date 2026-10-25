#!/usr/bin/env node
// Authentic CC0 weapons from 3DAssets.dev. No generated 3D mesh in the APK.
// Each class receives five distinct authored models where the source has coverage.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const GROUPS=[
 {id:'staff',query:'staff',terms:/staff|scepter|sceptre|rod|wand|b[aã]culo/i},
 {id:'sword',query:'sword',terms:/sword|blade|greatsword|excalibur|claymore/i},
 {id:'dagger',query:'dagger',terms:/dagger|knife|dual blade|stiletto/i},
 {id:'bow',query:'bow',terms:/\bbow\b|longbow|shortbow|recurve/i},
 {id:'axe',query:'axe',terms:/\baxe\b|\baxes\b|hatchet|battleaxe/i},
 {id:'spear',query:'spear',terms:/spear|lance|halberd|trident/i},
 {id:'mace',query:'mace',terms:/mace|hammer|gauntlet|fist|knuckle/i},
 {id:'wand',query:'wand',terms:/wand|staff|orb|scepter/i},
];
const root=resolve('public/models/weapon-packs');
await mkdir(root,{recursive:true});
function rows(j){
 if(Array.isArray(j))return j;
 for(const k of ['assets','results','items','data','models','hits']){
   if(Array.isArray(j?.[k]))return j[k];
   if(Array.isArray(j?.[k]?.assets))return j[k].assets;
 }
 return [];
}
async function readJson(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Search '+url+' HTTP '+response.status);
 return response.json();
}
const assets=[],missing=[];
for(const group of GROUPS){
 let results=[];
 try{results=rows(await readJson('https://3dassets.dev/api/v1/assets?q='+encodeURIComponent(group.query)+'&limit=90'));}catch(e){console.warn('QUERY ERROR',group.id,String(e));}
 console.log('SEARCH',group.id,results.length);
 const ranked=results.map(item=>{
    const title=String(item.title??item.name??item.slug??'');
    const text=title+' '+String(item.summary??item.description??'');
    const low=title.toLowerCase();
    const unwanted=/character|figure|statue|pedestal|toy|logo|trophy|person|soldier|shop|display|training|chess|holder|stand|rack/i.test(low);
    const score=(group.terms.test(title)?65:group.terms.test(text)?24:0)
      +(low.startsWith(group.query)?28:0)
      -(unwanted?90:0)
      +(Number(item.triangles??0)>0&&Number(item.triangles??0)<10000?5:0);
    return {item,title,score};
 }).filter(x=>x.score>10).sort((a,b)=>b.score-a.score);
 let index=0;
 const visited=new Set();
 for(const result of ranked){
   if(index>=5)break;
   const slug=String(result.item.slug??result.item.id??'');
   if(!slug||visited.has(slug))continue;visited.add(slug);
   let detail=result.item;
   try{const response=await readJson('https://3dassets.dev/api/v1/assets/'+encodeURIComponent(slug));detail=response.asset??response.data??response;}catch(e){continue;}
   const url=detail.cdnUrl??detail.downloadUrl??detail.glbUrl;
   if(typeof url!=='string'||!url.startsWith('https://cdn.3dassets.dev/'))continue;
   let bytes;
   try{
     const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
     if(!response.ok)continue;
     bytes=Buffer.from(await response.arrayBuffer());
   }catch(e){continue;}
   if(bytes.length<700||bytes.length>2*1024*1024||bytes.toString('ascii',0,4)!=='glTF'
        ||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)continue;
   const n=bytes.readUInt32LE(12);
   if(n>bytes.length-20)continue;
   const gltf=JSON.parse(bytes.subarray(20,20+n).toString('utf8'));
   if(!gltf.meshes?.length||gltf.buffers?.some(x=>x.uri)||gltf.images?.some(x=>x.uri))continue;
   const key=group.id+'-'+index,filename=key+'.glb';
   await writeFile(resolve(root,filename),bytes);
   assets.push({key,group:group.id,index,title:detail.title??result.title,
     file:'models/weapon-packs/'+filename,
     source:'https://3dassets.dev/assets/'+slug,
     license:'CC0-1.0',
     sha256:createHash('sha256').update(bytes).digest('hex'),
     size:bytes.length,meshes:gltf.meshes.length,animations:gltf.animations?.length??0});
   console.log('VERIFIED',key,String(detail.title??result.title).slice(0,90),bytes.length);
   index++;
 }
 if(index<5){missing.push({group:group.id,needed:5-index});console.warn('INSUFFICIENT',group.id,index+'/5');}
}
await writeFile(resolve(root,'manifest.json'),JSON.stringify({license:'CC0-1.0',source:'https://3dassets.dev/',
 assets,missing},null,2)+'\n');
console.log('FINAL',assets.length,'models',JSON.stringify(missing));
