import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const commit='77343cac874f06b73d16ad0063339df7c9ca254c';
const entries={Tent:'kenney-nature-kit/models/tent_detailed_open/tent_detailed_open',Fence:'kenney-nature-kit/models/fence_simple/fence_simple',Campfire:'kenney-nature-kit/models/campfire_stones/campfire_stones',Board:'kenney-survival-kit/models/signpost/signpost'};
await mkdir('public/models/pr21',{recursive:true});const assets=[];
for(const [id,path]of Object.entries(entries)){
 const source=`https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/${commit}/packs/${path}.glb`,bytes=execFileSync('curl',['-sSL','--fail','--max-time','25',source],{maxBuffer:5*1024*1024});if(bytes.toString('ascii',0,4)!=='glTF')throw Error(id);
 const file=`models/pr21/${id}.glb`;await writeFile('public/'+file,bytes);assets.push({id,file,source,license:'CC0-1.0',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile('public/models/pr21/manifest.json',JSON.stringify({license:'CC0-1.0',sourceLicense:`https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/${commit}/LICENSE`,assets},null,2)+'\n');console.log(assets.map(a=>({id:a.id,bytes:a.bytes})));
