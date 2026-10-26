import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const commit='77343cac874f06b73d16ad0063339df7c9ca254c';
const sources={Throne:'kaykit-dungeon-remastered/models/chair/chair',DeadTree:'kenney-graveyard-kit/models/trunk_long/trunk_long',Bridge:'kenney-nature-kit/models/bridge_stone/bridge_stone',Village:'quaternius-medievalvillage/models/blacksmith/blacksmith',MossRuins:'kenney-graveyard-kit/models/crypt_small/crypt_small',Crypt:'kaykit-halloween-bits/models/crypt/crypt',Coffin:'kaykit-halloween-bits/models/coffin_decorated/coffin_decorated',Skull:'kaykit-halloween-bits/models/skull/skull',SnowPine:'kenney-holiday-kit/models/tree_snow_a/tree_snow_a',BlueCrystal:'kenney-space-kit/models/rock_crystals_large_a/rock_crystals_large_a',Anvil:'the-base-mesh/models/anvil/anvil',IronBridge:'kenney-castle-kit/models/bridge_straight/bridge_straight',Chain:'the-base-mesh/models/chain_link/chain_link',Obelisk:'kenney-graveyard-kit/models/pillar_obelisk/pillar_obelisk',VoidArch:'kenney-graveyard-kit/models/crypt_large_door/crypt_large_door'};
await mkdir('public/models/pr18',{recursive:true});const assets=[];
for(const [id,path] of Object.entries(sources)){
 const url=`https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/${commit}/packs/${path}.glb`;
 const bytes=execFileSync('curl',['-sSL','--fail','--max-time','40',url],{maxBuffer:20*1024*1024});if(bytes.toString('ascii',0,4)!=='glTF')throw Error(id);
 const file=`models/pr18/${id}.glb`;await writeFile('public/'+file,bytes);assets.push({id,file,source:url,license:'CC0-1.0',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});console.log(id,bytes.length);
}
await writeFile('public/models/pr18/manifest.json',JSON.stringify({license:'CC0-1.0',sourceLicense:`https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Models/${commit}/LICENSE`,assets},null,2)+'\n');
