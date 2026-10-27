import {voiceAssets,voiceAssetUrl} from './VoiceAssets';
import {type VoiceProfile,npcVoice,NARRATOR} from './VoiceProfiles';
import type {SpokenLine} from '../rpg/LoreSystem';
export type SpeechState='loading'|'speaking'|'ended'|'cancelled'|'unavailable';
export interface VoiceEvents {state?(state:SpeechState):void;boundary?(characters:number):void;}
export interface VoiceAudioHost {
  unlock():Promise<void>;
  readonly voiceChannel:{context:AudioContext;output:AudioNode}|null;
  voiceActivity(active:boolean):void;
}
export interface VoicePlatform {
  synthesis:SpeechSynthesis|null;
  utterance(text:string):SpeechSynthesisUtterance;
  fetch:typeof fetch;
}
function browserPlatform():VoicePlatform {
  return {synthesis:typeof window==='undefined'?null:window.speechSynthesis??null,
    utterance:text=>new SpeechSynthesisUtterance(text), fetch:(...args)=>fetch(...args)};
}
export function speechLocale(language:string):string {
  if(language.toLowerCase().startsWith('en'))return 'en-US';
  if(language.toLowerCase().startsWith('pt'))return 'pt-BR';
  return language||'pt-BR';
}
// Web Speech does not expose gender. Prefer known voice names; use the cast fallback
// when the platform supplies only anonymous/default voices instead of guessing gender.
const MALE=/\b(daniel|david|paulo|antonio|antônio|ricardo|felipe|joão|joao|aaron|alex|mark|george|guy|brian|male)\b/i;
const FEMALE=/\b(maria|francisca|luciana|vitória|vitoria|helena|fernanda|joana|samantha|zira|susan|jenny|aria|female)\b/i;
export function selectVoice(voices:readonly SpeechSynthesisVoice[],language:string,profile:VoiceProfile):SpeechSynthesisVoice|undefined {
  const locale=speechLocale(language).toLowerCase(),prefix=locale.split('-')[0];
  return voices.filter(v=>v.lang.toLowerCase().split('-')[0]===prefix)
    .filter(v=>(profile.gender==='male'?MALE:FEMALE).test(v.name)&&!(profile.gender==='male'&&FEMALE.test(v.name)))
    .sort((a,b)=>Number(b.lang.toLowerCase()===locale)-Number(a.lang.toLowerCase()===locale)||Number(b.localService)-Number(a.localService))[0];
}
/** One cancellable speech owner. Native speech stays native; formant recordings use WebAudio. */
export class VoiceSynthesisSystem {
  private serial=0;
  private disposed=false;
  private request?:{line:SpokenLine;events:VoiceEvents;serial:number};
  private utterance?:SpeechSynthesisUtterance;
  private sources:AudioBufferSourceNode[]=[];
  private nodes:AudioNode[]=[];
  private timers=new Set<ReturnType<typeof setTimeout>>();
  private controller?:AbortController;
  private cache=new Map<string,AudioBuffer>();
  private cacheBytes=0;
  private volume=1;
  private language='pt';
  private enabled=true;
  private voiceList:SpeechSynthesisVoice[]=[];
  private status:SpeechState='ended';
  private readonly onVoices=()=>{try{this.voiceList=this.platform.synthesis?.getVoices()??[];}catch{this.voiceList=[];}};
  private readonly onVisibility=()=>{if(document.hidden)this.stop();};
  constructor(private readonly audio:VoiceAudioHost,private readonly platform:VoicePlatform=browserPlatform()) {
    this.onVoices();
    this.platform.synthesis?.addEventListener('voiceschanged',this.onVoices);
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.onVisibility);
  }
  configure(language:string,volume:number,enabled=true):void {
    const next=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):1;
    if(language!==this.language||next!==this.volume||enabled!==this.enabled)this.stop();
    this.language=language;this.volume=next;this.enabled=enabled;
  }
  private later(fn:()=>void,ms:number):void {
    const timer=setTimeout(()=>{this.timers.delete(timer);fn();},ms);this.timers.add(timer);
  }
  private current(serial:number):boolean{return !this.disposed&&this.request?.serial===serial;}
  private state(state:SpeechState):void {this.status=state;this.audio.voiceActivity(state==='speaking');this.request?.events.state?.(state);}
  speak(line:SpokenLine,events:VoiceEvents={}):void {
    this.stop();
    if(this.disposed)return;
    const serial=++this.serial;this.request={line,events,serial};
    if(!this.enabled||this.volume===0){this.state('ended');events.boundary?.(line.text.length);return;}
    this.controller=new AbortController();this.state('loading');
    // Unlock synchronously inside the NPC/replay click, before waiting for voice lists or assets.
    const unlocked=this.audio.unlock();
    const profile=line.speaker==='narrator'?NARRATOR.profile:npcVoice(line.speaker).profile;
    const start=()=>{
      if(!this.current(serial))return;
      this.onVoices();const voice=selectVoice(this.voiceList,line.language,profile);
      if(voice)this.native(line,profile,voice,serial,unlocked);
      else void this.recorded(line,profile,serial,unlocked);
    };
    if(this.platform.synthesis&&!this.voiceList.length)this.later(start,250);
    else start();
  }
  private native(line:SpokenLine,profile:VoiceProfile,voice:SpeechSynthesisVoice,serial:number,unlocked:Promise<void>):void {
    let began=false,failed=false;
    const fallback=()=>{
      if(failed||!this.current(serial))return;failed=true;
      const old=this.utterance;if(old){old.onend=null;old.onerror=null;old.onboundary=null;old.onstart=null;}
      this.platform.synthesis?.cancel();this.utterance=undefined;
      void this.recorded(line,profile,serial,unlocked);
    };
    try {
      const utterance=this.platform.utterance(line.text);this.utterance=utterance;
      utterance.voice=voice;utterance.lang=speechLocale(line.language);utterance.pitch=profile.pitch;
      utterance.rate=profile.rate;utterance.volume=this.volume*.75;
      utterance.onstart=()=>{if(this.current(serial)&&!failed){began=true;this.state('speaking');this.estimate(line.text,serial,Math.max(1,line.text.length/(13*profile.rate)));}};
      utterance.onboundary=event=>{if(this.current(serial)&&!failed)this.request?.events.boundary?.(Math.min(line.text.length,event.charIndex+(event.charLength||1)));};
      utterance.onend=()=>{if(this.current(serial)&&!failed){this.request?.events.boundary?.(line.text.length);this.state('ended');this.clearTimers();}};
      utterance.onerror=fallback;
      this.platform.synthesis!.speak(utterance);
      this.later(()=>{if(!began)fallback();},1500);
    }catch{fallback();}
  }
  private estimate(text:string,serial:number,duration:number):void {
    const started=performance.now();
    const tick=()=>{
      if(!this.current(serial)||this.status!=='speaking')return;
      this.request?.events.boundary?.(Math.min(text.length,Math.floor((performance.now()-started)/1000/duration*text.length)));
      this.later(tick,60);
    };tick();
  }
  private async decode(key:string,context:AudioContext,signal:AbortSignal):Promise<AudioBuffer> {
    const cached=this.cache.get(key);if(cached){this.cache.delete(key);this.cache.set(key,cached);return cached;}
    const response=await this.platform.fetch(voiceAssetUrl(key),{signal});
    if(!response.ok)throw Error('Voice recording unavailable');
    const buffer=await context.decodeAudioData(await response.arrayBuffer());
    if(signal.aborted)throw Error('Speech cancelled');
    const bytes=buffer.length*buffer.numberOfChannels*4;
    while(this.cacheBytes+bytes>12*1024*1024&&this.cache.size){const [id,old]=this.cache.entries().next().value!;this.cache.delete(id);this.cacheBytes-=old.length*old.numberOfChannels*4;}
    if(bytes<=12*1024*1024){this.cache.set(key,buffer);this.cacheBytes+=bytes;}
    return buffer;
  }
  private async recorded(line:SpokenLine,profile:VoiceProfile,serial:number,unlocked:Promise<void>):Promise<void> {
    try {
      await unlocked;if(!this.current(serial))return;
      const channel=this.audio.voiceChannel;if(!channel)throw Error('Audio is unavailable');
      const {context,output}=channel,signal=this.controller!.signal;
      const assets=voiceAssets(line),buffers:AudioBuffer[]=[];
      // Serial decoding bounds peak memory and avoids a burst of Android audio decoders.
      for(const asset of assets){buffers.push(await this.decode(asset.key,context,signal));if(!this.current(serial))return;}
      if(context.state!=='running')throw Error('Audio suspended');
      const resonance=context.createBiquadFilter();resonance.type='peaking';resonance.frequency.value=profile.resonance;resonance.Q.value=.7;resonance.gain.value=2;
      const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=65;
      const gain=context.createGain();gain.gain.value=.85;
      resonance.connect(highpass);highpass.connect(gain);gain.connect(output);this.nodes.push(resonance,highpass,gain);
      let cursor=context.currentTime+.03,remaining=buffers.length;
      this.state('speaking');
      const duration=buffers.reduce((n,b)=>n+b.duration,0)+Math.max(0,buffers.length-1)*.025;
      this.estimate(line.text,serial,duration);
      buffers.forEach(buffer=>{
        const source=context.createBufferSource();source.buffer=buffer;source.connect(resonance);this.sources.push(source);
        source.onended=()=>{if(this.current(serial)&&--remaining===0){this.request?.events.boundary?.(line.text.length);this.state('ended');this.clearTimers();this.releaseAudio();}};
        source.start(cursor);cursor+=buffer.duration+.025;
      });
    }catch{if(this.current(serial)){this.request?.events.boundary?.(line.text.length);this.state('unavailable');this.clearTimers();this.releaseAudio();}}
  }
  private clearTimers():void {for(const timer of this.timers)clearTimeout(timer);this.timers.clear();}
  private releaseAudio():void {
    for(const source of this.sources){source.onended=null;try{source.stop();}catch{/* Already ended. */}source.disconnect();}
    this.sources=[];this.nodes.forEach(node=>node.disconnect());this.nodes=[];
  }
  stop():void {
    this.serial++;this.controller?.abort();this.controller=undefined;this.clearTimers();
    if(this.utterance){this.utterance.onend=null;this.utterance.onerror=null;this.utterance.onstart=null;this.utterance.onboundary=null;this.platform.synthesis?.cancel();this.utterance=undefined;}
    this.releaseAudio();if(this.request)this.state('cancelled');this.request=undefined;this.audio.voiceActivity(false);
  }
  get diagnostics(){return {state:this.status,bufferBytes:this.cacheBytes,sources:this.sources.length,nativeVoices:this.voiceList.length};}
  dispose():void {if(this.disposed)return;this.stop();this.disposed=true;this.cache.clear();this.cacheBytes=0;this.platform.synthesis?.removeEventListener('voiceschanged',this.onVoices);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.onVisibility);}
}
