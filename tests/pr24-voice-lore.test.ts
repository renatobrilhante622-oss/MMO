import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import {Vector3} from 'three';
import {VoiceSynthesisSystem,selectVoice,speechLocale,type VoiceAudioHost,type VoicePlatform} from '../src/audio/VoiceSynthesisSystem';
import {NPC_VOICE_CAST,npcVoice} from '../src/audio/VoiceProfiles';
import {voiceAssets,voiceKey,type VoiceAsset} from '../src/audio/VoiceAssets';
import {DEFAULT_AUDIO_MIX,sanitizeAudioMix,spatialAudio} from '../src/audio/SoundEngine';
import {GAME_TITLE,LORE_CHAPTERS,questSpeech,questText,type SpokenLine} from '../src/rpg/LoreSystem';
import {QUEST_STORY,QUEST_SIDE,QUEST_MILESTONES,QuestSystem} from '../src/rpg/QuestSystem';
import {REGIONS} from '../src/world/Regions';
import {makeContract} from '../src/rpg/BountyBoard';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {nearestSafeTrail} from '../src/world/Unstuck';
import {QuestArrowRing} from '../src/world/QuestArrowRing';
import {equipmentImprovement,equipmentPower} from '../src/rpg/EquipmentFeedback';
const line:SpokenLine={id:'greeting-guide-aurora',text:NPC_VOICE_CAST['guide-aurora'].greeting[0],speaker:'guide-aurora',language:'pt'};
const voice=(name:string,lang='pt-BR')=>({name,lang,localService:true,voiceURI:name,default:false}) as SpeechSynthesisVoice;
function fixture(voices:SpeechSynthesisVoice[]=[]){
  let list=voices;
  const synthesis=Object.assign(new EventTarget(),{getVoices:vi.fn(()=>list),speak:vi.fn(),cancel:vi.fn()});
  const sources:Array<{onended:(()=>void)|null;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}> = [];
  const node=()=>({connect:vi.fn(),disconnect:vi.fn(),gain:{value:0},frequency:{value:0},Q:{value:0},type:''});
  const context={state:'running',currentTime:1,createBiquadFilter:node,createGain:node,
    decodeAudioData:vi.fn(async()=>({duration:.2,length:4410,numberOfChannels:1})),
    createBufferSource:()=>{const source={...node(),onended:null,start:vi.fn(),stop:vi.fn()};sources.push(source);return source;}};
  const audio={unlock:vi.fn(async()=>{}),voiceActivity:vi.fn(),voiceChannel:{context,output:node()}};
  const platform={synthesis,utterance:vi.fn(text=>({text})),fetch:vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}))};
  const engine=new VoiceSynthesisSystem(audio as unknown as VoiceAudioHost,platform as unknown as VoicePlatform);
  return {engine,synthesis,platform,audio,context,sources,setVoices:(next:SpeechSynthesisVoice[])=>{list=next;synthesis.dispatchEvent(new Event('voiceschanged'));}};
}
afterEach(()=>vi.useRealTimers());
describe('PR24 cancellable native and bundled speech',()=>{
  it('uses the explicit gender and language cast, including delayed Android voices',async()=>{
    vi.useFakeTimers();const f=fixture();f.engine.speak(line);expect(f.synthesis.speak).not.toHaveBeenCalled();
    f.setVoices([voice('Microsoft Maria'),voice('Microsoft David','en-US'),voice('Microsoft Antonio')]);
    await vi.advanceTimersByTimeAsync(250);
    const utterance=f.synthesis.speak.mock.calls[0][0];expect(utterance.voice.name).toBe('Microsoft Antonio');expect(utterance.lang).toBe('pt-BR');expect(utterance.pitch).toBe(.88);
    f.engine.dispose();
  });
  it('chooses female Portuguese voices instead of assigning a male voice by list order',()=>{
    const cast=npcVoice('merchant-aurora');expect(selectVoice([voice('Microsoft Antonio'),voice('Microsoft Maria')],'pt',cast.profile)?.name).toBe('Microsoft Maria');
    expect(selectVoice([voice('Google português do Brasil')],'pt',cast.profile)).toBeUndefined();
    expect(selectVoice([voice('Microsoft Maria')],'en',cast.profile)).toBeUndefined();
    expect(speechLocale('en')).toBe('en-US');expect(speechLocale('pt')).toBe('pt-BR');
  });
  it('cancels speech, pending watchdogs and stale callbacks when changing NPC',()=>{
    vi.useFakeTimers();const f=fixture([voice('Microsoft Antonio')]),states:string[]=[];
    f.engine.speak(line,{state:s=>states.push(s)});const old=f.synthesis.speak.mock.calls[0][0],end=old.onend;
    f.engine.speak({...line,id:'next',text:'Uma nova missão.'});end();
    expect(f.synthesis.cancel).toHaveBeenCalledOnce();expect(states).toContain('cancelled');expect(f.engine.diagnostics.state).toBe('loading');
    f.engine.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it('synthesizes intelligible local recordings when WebView has no voice list',async()=>{
    vi.useFakeTimers();const f=fixture(),states:string[]=[];
    f.engine.speak(line,{state:s=>states.push(s)});await vi.advanceTimersByTimeAsync(250);
    expect(f.synthesis.speak).not.toHaveBeenCalled();expect(f.platform.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/audio\/voices\/[0-9a-f]{8}\.mp3/),expect.anything());
    expect(f.sources).toHaveLength(1);expect(f.sources[0].start).toHaveBeenCalled();expect(states).toContain('speaking');
    f.sources[0].onended?.();expect(f.engine.diagnostics.sources).toBe(0);expect(states.at(-1)).toBe('ended');f.engine.dispose();
  });
  it('falls back when a listed native voice never starts, without overlapping speech',async()=>{
    vi.useFakeTimers();const f=fixture([voice('Microsoft Antonio')]);f.engine.speak(line);
    await vi.advanceTimersByTimeAsync(1500);expect(f.synthesis.cancel).toHaveBeenCalledOnce();expect(f.sources).toHaveLength(1);expect(f.engine.diagnostics.state).toBe('speaking');f.engine.dispose();
  });
  it('stops real audio sources immediately and frees all nodes on close',async()=>{
    vi.useFakeTimers();const f=fixture();f.engine.speak(line);await vi.advanceTimersByTimeAsync(250);
    f.engine.stop();expect(f.sources[0].stop).toHaveBeenCalledOnce();expect(f.sources[0].disconnect).toHaveBeenCalledOnce();expect(f.engine.diagnostics.sources).toBe(0);expect(f.audio.voiceActivity).toHaveBeenLastCalledWith(false);f.engine.dispose();
  });
  it('ignores a decoded recording after the dialog was already closed',async()=>{
    vi.useFakeTimers();const f=fixture();let done!:(value:ArrayBuffer)=>void;
    f.platform.fetch.mockImplementation(async()=>({ok:true,arrayBuffer:()=>new Promise(resolve=>{done=resolve;})}));
    f.engine.speak(line);await vi.advanceTimersByTimeAsync(250);f.engine.stop();done(new ArrayBuffer(8));await Promise.resolve();await Promise.resolve();expect(f.sources).toHaveLength(0);f.engine.dispose();
  });
  it('keeps the transcript functional when audio is muted or unavailable',async()=>{
    vi.useFakeTimers();const f=fixture(),boundary=vi.fn();f.engine.configure('pt',0);f.engine.speak(line,{boundary});expect(boundary).toHaveBeenCalledWith(line.text.length);expect(f.platform.fetch).not.toHaveBeenCalled();
    f.engine.configure('pt',1);f.platform.fetch.mockRejectedValue(Error('offline'));f.engine.speak(line,{boundary});await vi.advanceTimersByTimeAsync(250);expect(f.engine.diagnostics.state).toBe('unavailable');f.engine.dispose();
  });
  it('reuses decoded audio but leaves no scheduled callbacks after disposal',async()=>{
    vi.useFakeTimers();const f=fixture();f.engine.speak(line);await vi.advanceTimersByTimeAsync(250);f.engine.speak(line);await vi.advanceTimersByTimeAsync(250);
    expect(f.context.decodeAudioData).toHaveBeenCalledOnce();f.engine.configure('en',.5);expect(f.engine.diagnostics.state).toBe('cancelled');f.engine.dispose();f.engine.dispose();expect(f.engine.diagnostics.bufferBytes).toBe(0);expect(vi.getTimerCount()).toBe(0);
  });
  it('evicts decoded speech instead of retaining an unbounded campaign in memory',async()=>{
    vi.useFakeTimers();const f=fixture();
    f.context.decodeAudioData.mockImplementation(async()=>({duration:.2,length:1024*1024,numberOfChannels:1}));
    for(let i=0;i<5;i++){f.engine.speak({...line,id:'chapter-'+i,text:line.text+i});await vi.advanceTimersByTimeAsync(250);expect(f.engine.diagnostics.bufferBytes).toBeLessThanOrEqual(12*1024*1024);}
    expect(f.engine.diagnostics.bufferBytes).toBe(12*1024*1024);f.engine.dispose();
  });
});
describe('PR24 complete spoken campaign and local asset coverage',()=>{
  const catalog=JSON.parse(readFileSync('public/audio/voices/catalog.json','utf8')) as VoiceAsset[];
  const keys=new Set(catalog.map(c=>c.key));
  function covered(l:SpokenLine){for(const asset of voiceAssets(l))expect(keys.has(asset.key),JSON.stringify(asset)).toBe(true);}
  it('contains all authored recordings with valid keys and nonempty MP3 payloads',()=>{
    expect(keys.size).toBe(catalog.length);for(const asset of catalog){expect(asset.key).toBe(voiceKey(asset.text,asset.speaker,asset.language));expect(statSync('public/audio/voices/'+asset.key+'.mp3').size).toBeGreaterThan(400);}
  });
  it('covers all 60 quest openings, progress and completions in both languages',()=>{
    expect(QUEST_STORY).toHaveLength(60);
    for(const language of ['pt','en'] as const)for(const q of QUEST_STORY)for(const stage of ['opening','progress','completion'] as const)covered(questSpeech(q,stage,language));
    for(const language of ['pt','en'] as const){const lines=QUEST_STORY.map(q=>questSpeech(q,'opening',language).text);expect(new Set(lines).size).toBe(60);expect(questText(QUEST_STORY[1],language).description).toContain(language==='pt'?'gosmas':'slimes');}
  });
  it('covers every NPC, nine narrated chapters, side quests, milestones and daily hunts',()=>{
    expect(LORE_CHAPTERS).toHaveLength(9);expect(GAME_TITLE).toBe('ETERNAL NINEFOLD');
    const inv=new InventoryAndLoot(new EventBus());inv.level=100;const progress=new AdventureProgress(inv),quests=new QuestSystem(inv,progress);
    for(const language of ['pt','en'] as const){
      for(const [speaker,npc] of Object.entries(NPC_VOICE_CAST)){covered({id:'greeting',text:npc.greeting[language==='pt'?0:1],speaker,language});expect(npc.profile.resonance).toBeGreaterThan(0);expect(npc.profile.pitch).toBeGreaterThanOrEqual(npc.profile.gender==='male'?.82:1.08);expect(npc.profile.pitch).toBeLessThanOrEqual(npc.profile.gender==='male'?.95:1.25);}
      for(const chapter of LORE_CHAPTERS)covered({id:'lore-'+chapter.id,text:chapter.text[language==='pt'?0:1],speaker:'narrator',language});
      for(const q of [...QUEST_SIDE,...QUEST_MILESTONES,...quests.all().filter(q=>q.category==='bounty')])for(const stage of ['opening','progress','completion'] as const)covered(questSpeech(q,stage,language));
    }
  });
  it('covers infinite-contract fragments at every count including the maximum serial',()=>{
    for(const language of ['pt','en'] as const)for(const r of REGIONS)for(const serial of [0,1,2,3,4,17,999,1000000000])for(const stage of ['opening','progress','completion'] as const)covered(questSpeech(makeContract(r.id,serial),stage,language));
  });
  it('restores old saves with default independent audio sliders, and clamps corrupt values',()=>{
    const inv=new InventoryAndLoot(new EventBus()),p=new AdventureProgress(inv);p.restore({});expect(p.audioMix).toEqual(DEFAULT_AUDIO_MIX);expect(p.audioEnabled).toBe(true);
    p.restore({audioMix:{voices:-2,effects:Infinity,music:5},audioEnabled:false});expect(p.audioMix).toEqual({voices:0,effects:DEFAULT_AUDIO_MIX.effects,music:1});expect(p.audioEnabled).toBe(false);
    expect(sanitizeAudioMix({voices:.1,effects:0,music:.9})).toEqual({voices:.1,effects:0,music:.9});
  });
});
describe('PR24 safe recovery, navigation and equipment feedback',()=>{
  const flat={extent:100,free:()=>true,height:()=>6};
  it('pans world impacts relative to the camera and culls audio beyond the actor radius',()=>{
    const listener={x:0,z:0,rightX:1,rightZ:0};
    expect(spatialAudio({x:10,z:0},listener).pan).toBe(1);expect(spatialAudio({x:-10,z:0},listener).pan).toBe(-1);
    expect(spatialAudio({x:0,z:10},{...listener,rightX:0,rightZ:1}).pan).toBe(1);
    expect(spatialAudio({x:100,z:0},listener).gain).toBe(0);
  });
  it('finds the nearest point on a safe road rather than an arbitrary map spawn',()=>{
    expect(nearestSafeTrail({x:7,z:5},[{x:0,z:-20},{x:0,z:20}],flat)).toEqual({x:0,z:5});
  });
  it('rejects roads inside colliders or across voids and refuses invalid coordinates',()=>{
    expect(nearestSafeTrail({x:4,z:4},[{x:0,z:0},{x:0,z:20}],{...flat,free:()=>false})).toBeNull();
    expect(nearestSafeTrail({x:NaN,z:0},[],flat)).toBeNull();
    expect(nearestSafeTrail({x:0,z:0},[{x:99,z:0},{x:99,z:99}],flat)?.x).toBeLessThan(13);
  });
  it('hides the ring with no target and turns by the shortest smooth angular path',()=>{
    const ring=new QuestArrowRing(),hero={x:0,z:0};ring.update(.1,hero,null,6,true);expect(ring.root.visible).toBe(false);
    for(let i=0;i<60;i++)ring.update(.05,hero,{x:10,z:0},6,true);
    expect(ring.root.rotation.z).toBeCloseTo(Math.PI/2);expect(ring.root.position.y).toBeCloseTo(6.12);
    ring.update(.05,hero,{x:10,z:0},6,false);expect(ring.root.visible).toBe(false);ring.dispose();
  });
  it('offers only eligible, actually acquired upgrades and revalidates after equipment changes',()=>{
    const inv=new InventoryAndLoot(new EventBus()),old=inv.items[0],item={...old,id:'real-drop',attack:old.attack+240};
    expect(equipmentImprovement(inv,item.id)).toBe(0);inv.addLoot({id:'actual-loot',item,xp:0,gold:0,crystals:0,position:new Vector3()});
    expect(equipmentImprovement(inv,item.id)).toBe(240);expect(inv.equip(item.id)).toBe(true);expect(equipmentImprovement(inv,item.id)).toBe(0);
    const next={...item,id:'too-high',requiredLevel:99,attack:9999};inv.items.push(next);expect(equipmentImprovement(inv,next.id)).toBe(0);
    expect(equipmentPower({...old,sockets:['ruby'],gemLevels:[2]})).toBe(equipmentPower(old)+10);
  });
});
