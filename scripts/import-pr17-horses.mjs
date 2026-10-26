import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const commit='77343cac874f06b73d16ad0063339df7c9ca254c';
await mkdir('public/models/pr17-source',{recursive:true});
const assets=[];
for(const [id,path] of [['ImperialHorse','packs/quaternius-ultimateanimatedanimals/models/horse/horse.glb'],['ImperialHorseWhite','packs/quaternius-ultimateanimatedanimals/models/horse_white/horse_white.glb']]){
 const url='https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/'+commit+'/'+path;
 const bytes=execFileSync('curl',['-L','--fail','--max-time','45',url],{maxBuffer:16*1024*1024});
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const file='models/pr17-source/'+id+'.glb';await writeFile('public/'+file,bytes);
 assets.push({id,file,source:url,license:'CC0-1.0',sha256:createHash('sha256').update(bytes).digest('hex'),animationClips:json.animations?.map(a=>a.name)??[]});
 console.log(id,bytes.length,assets.at(-1).animationClips);
}
await writeFile('public/models/pr17-source/manifest.json',JSON.stringify({license:'CC0-1.0',sourceLicense:'https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/'+commit+'/LICENSE',assets},null,2)+'\n');
