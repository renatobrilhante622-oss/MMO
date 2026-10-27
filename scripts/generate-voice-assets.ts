/** Offline authoring tool only. Requires espeak-ng and ffmpeg; neither ships in the game. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,access,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {QUEST_STORY,QUEST_SIDE,QUEST_MILESTONES,type QuestDefinition} from '../src/rpg/QuestSystem';
import {LORE_CHAPTERS,questSpeech,type SpokenLine} from '../src/rpg/LoreSystem';
import {NPC_VOICE_CAST,npcVoice,NARRATOR,type VoiceProfile} from '../src/audio/VoiceProfiles';
import {voiceAssets,type VoiceAsset} from '../src/audio/VoiceAssets';
import {REGIONS} from '../src/world/Regions';
const exec=promisify(execFile),assets=new Map<string,VoiceAsset>();
const put=(line:SpokenLine)=>{for(const asset of voiceAssets(line)){const old=assets.get(asset.key);if(old&&(old.text!==asset.text||old.speaker!==asset.speaker||old.language!==asset.language))throw Error('Voice asset hash collision');assets.set(asset.key,asset);}};
for(const language of ['pt','en'] as const){
  for(const [speaker,npc] of Object.entries(NPC_VOICE_CAST))put({id:'greeting-'+speaker,text:npc.greeting[language==='pt'?0:1],speaker,language});
  for(const chapter of LORE_CHAPTERS)put({id:'lore-'+chapter.id,text:chapter.text[language==='pt'?0:1],speaker:'narrator',language});
  for(const q of [...QUEST_STORY,...QUEST_SIDE,...QUEST_MILESTONES])for(const stage of ['opening','progress','completion'] as const)put(questSpeech(q,stage,language));
  for(const r of REGIONS)for(const goal of ['kill','nest','elite','core','camp'] as const)for(let required=1;required<=100;required++)for(const speaker of ['guide-'+r.id,'merchant-'+r.id])for(const target of goal==='kill'?[...r.kinds,r.id]:[r.id]){
    const q:QuestDefinition={id:'contract-assets',category:'contract',region:r.id,title:'',description:'',goal,target,required,npcId:speaker,reward:{xp:0,gold:0,crystals:0,tickets:0,passXp:0}};
    for(const stage of ['opening','progress','completion'] as const)put(questSpeech(q,stage,language));
  }
}
const root='public/audio/voices',temporary=join(tmpdir(),'ninefold-voice-authoring');await mkdir(root,{recursive:true});await mkdir(temporary,{recursive:true});
const jobs=[...assets.values()];let index=0,generated=0;
const profileFor=(speaker:string):VoiceProfile=>speaker==='narrator'?NARRATOR.profile:speaker==='count-female'?{...NARRATOR.profile,gender:'female',pitch:1.16,rate:1}:speaker==='count-male'?{...NARRATOR.profile,pitch:.91,rate:1}:npcVoice(speaker).profile;
async function worker(){
  while(index<jobs.length){
    const asset=jobs[index++],file=join(root,asset.key+'.mp3');
    try{await access(file);continue;}catch{/* New or changed line. */}
    const p=profileFor(asset.speaker),wav=join(temporary,asset.key+'.wav');
    const variant=p.gender==='female'?'f3':p.voiceArchetype==='elder'?'m7':p.voiceArchetype==='young'?'m2':'m3';
    await exec(process.env.NINEFOLD_ESPEAK??'espeak-ng',['-v',(asset.language==='pt'?'pt-br':'en-us')+'+'+variant,'-s',String(Math.round(163*p.rate)),'-p',String(Math.round(50*p.pitch)),'-a','150','-w',wav,asset.text]);
    await exec('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',wav,'-af','highpass=f=65,loudnorm=I=-19:TP=-2:LRA=8','-ar','22050','-ac','1','-codec:a','libmp3lame','-b:a','40k',file]);
    await rm(wav);generated++;
    if(generated%100===0)process.stdout.write(`${generated} voice recordings generated\n`);
  }
}
await Promise.all(Array.from({length:4},worker));
for(const file of await readdir(root))if(file.endsWith('.mp3')&&!assets.has(file.slice(0,-4)))await rm(join(root,file));
await writeFile(join(root,'catalog.json'),JSON.stringify(jobs,null,2)+'\n');
process.stdout.write(`${jobs.length} unique recordings; ${generated} newly generated\n`);
