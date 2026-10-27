import type { ClassId } from './GameTypes';

export interface SoundEnvironment {
  region?:string;
  daylight: number;
  moving: boolean;
  inWater: boolean;
  boss: boolean;
  mounted?:boolean;
  village?:boolean;
  pvp?:boolean;
  gathering?:'ore'|'herb'|'chest'|null;
}
export interface AudioMix {voices:number;effects:number;music:number;}
export const DEFAULT_AUDIO_MIX:Readonly<AudioMix>=Object.freeze({voices:.85,effects:.8,music:.6});
export function spatialAudio(source:{x:number;z:number},listener:{x:number;z:number;rightX:number;rightZ:number}):{gain:number;pan:number} {
  const x=source.x-listener.x,z=source.z-listener.z,distance=Math.hypot(x,z);
  return {gain:distance>45?0:1/(1+distance*.045),pan:Math.max(-1,Math.min(1,(x*listener.rightX+z*listener.rightZ)/Math.max(4,distance)))};
}
export function sanitizeAudioMix(raw:unknown):AudioMix {
  const record=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  const read=(key:keyof AudioMix)=>typeof record[key]==='number'&&Number.isFinite(record[key])?Math.max(0,Math.min(1,record[key] as number)):DEFAULT_AUDIO_MIX[key];
  return {voices:read('voices'),effects:read('effects'),music:read('music')};
}

interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

type Wave = OscillatorType;

/** Procedural, asset-free audio. Construction is safe before a user gesture and in Node. */
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
  private voiceBus:GainNode|null=null;
  private mix:AudioMix={...DEFAULT_AUDIO_MIX};
  private ducked=false;
  private effortClock=0;
  private miningClock=0;
  private musicClock=0;
  private musicBeat=0;
  private listener={x:0,z:0,rightX:1,rightZ:0};
  private ambienceFilter: BiquadFilterNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientGains: GainNode[] = [];
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private readonly voices = new Set<Voice>();
  private enabled = true;
  private disposed = false;
  private footstepClock = 0;
  private birdClock = 0;
  private ambienceClock = 0;
  private bossPresent = false;
  private visibilityHandler: (() => void) | null = null;

  async unlock(): Promise<void> {
    if (this.disposed || typeof window === 'undefined') return;
    try {
      if (!this.context) this.initialize();
      if (this.context?.state === 'suspended') await this.context.resume();
    } catch {
      // Unsupported or denied audio leaves the game fully playable.
    }
  }

  private initialize(): void {
    if (this.context || this.disposed) return;
    this.context = new AudioContext({ latencyHint: 'interactive' });
    const context = this.context;
    this.master = context.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.effects = context.createGain();
    this.effects.gain.value = this.mix.effects*.78;
    this.ambience = context.createGain();
    this.ambience.gain.value = this.mix.music*.23;
    this.voiceBus=context.createGain();this.voiceBus.gain.value=this.mix.voices;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -19;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.24;
    this.effects.connect(this.master);
    this.ambience.connect(this.master);
    this.voiceBus.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(context.destination);
    this.ambientNodes.push(compressor);
    const frames = context.sampleRate * 2;
    this.noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < frames; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.04) / 1.025;
      data[i] = previous * 3.2;
    }
    this.startAmbience();
    this.visibilityHandler = () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend().catch(() => undefined);
      else if (this.enabled) void this.context.resume().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(enabled ? 0.55 : 0, this.context.currentTime, 0.08);
    }
  }
  setMix(raw:unknown):void {
    this.mix=sanitizeAudioMix(raw);
    if(!this.context)return;
    this.effects?.gain.setTargetAtTime(this.mix.effects*.78,this.context.currentTime,.04);
    this.voiceBus?.gain.setTargetAtTime(this.mix.voices,this.context.currentTime,.04);
    this.ambience?.gain.setTargetAtTime(this.mix.music*.23*(this.ducked?.3:1),this.context.currentTime,.04);
  }
  voiceActivity(active:boolean):void {
    this.ducked=active;
    if(this.context)this.ambience?.gain.setTargetAtTime(this.mix.music*.23*(active?.3:1),this.context.currentTime,active?.08:.4);
  }
  get voiceChannel():{context:AudioContext;output:AudioNode}|null {return this.context&&this.voiceBus?{context:this.context,output:this.voiceBus}:null;}
  setListener(position:{x:number;z:number},rightX:number,rightZ:number):void {Object.assign(this.listener,{x:position.x,z:position.z,rightX,rightZ});}

  private startAmbience(): void {
    if (!this.context || !this.ambience || !this.noiseBuffer) return;
    const context = this.context;
    this.ambientNoise = context.createBufferSource();
    this.ambientNoise.buffer = this.noiseBuffer;
    this.ambientNoise.loop = true;
    this.ambienceFilter = context.createBiquadFilter();
    this.ambienceFilter.type = 'lowpass';
    this.ambienceFilter.frequency.value = 650;
    const wind = context.createGain();
    wind.gain.value = 0.16;
    this.ambientNoise.connect(this.ambienceFilter);
    this.ambienceFilter.connect(wind);
    wind.connect(this.ambience);
    this.ambientNoise.start();
    this.ambientNodes.push(this.ambienceFilter, wind);
    // Slow consonant drone, with detuned partials. Never starts before unlock().
    const pitches = [73.416, 110, 146.832, 220];
    for (let i = 0; i < pitches.length; i++) {
      const oscillator = context.createOscillator();
      oscillator.type = i % 2 ? 'sine' : 'triangle';
      oscillator.frequency.value = pitches[i];
      oscillator.detune.value = (i % 2 ? -1 : 1) * 4;
      const gain = context.createGain();
      gain.gain.value = 0.018;
      oscillator.connect(gain);
      gain.connect(this.ambience);
      oscillator.start();
      this.ambientOscillators.push(oscillator);
      this.ambientGains.push(gain);
    }
  }

  private ready(): boolean {
    return !this.disposed && this.enabled && this.context?.state === 'running' && !!this.effects;
  }

  private register(sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
    if (!sources.length) return;
    // Repeated hits cannot create an unbounded graph during a large area attack.
    while (this.voices.size >= 40) {
      const oldest = this.voices.values().next().value as Voice | undefined;
      if (!oldest) break;
      this.release(oldest, true);
    }
    const voice: Voice = { sources, nodes };
    this.voices.add(voice);
    let remaining = sources.length;
    for (const source of sources) {
      source.onended = () => {
        remaining--;
        if (remaining === 0) this.release(voice, false);
      };
    }
  }

  private release(voice: Voice, stop: boolean): void {
    for (const source of voice.sources) {
      source.onended = null;
      if (stop) { try { source.stop(); } catch { /* Already ended. */ } }
      source.disconnect();
    }
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }

  private tone(frequency: number, duration: number, volume: number, type: Wave = 'sine', end = frequency, delay = 0, pan = 0, bus:'effects'|'music'='effects'): void {
    if (!this.ready()) return;
    const context = this.context!;
    const time = context.currentTime + Math.max(0, delay);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + Math.min(0.012, duration * 0.15));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    oscillator.connect(envelope);
    envelope.connect(panner);
    panner.connect(bus==='music'?this.ambience!:this.effects!);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    this.register([oscillator], [envelope, panner]);
  }

  private noise(duration: number, frequency: number, volume: number, type: BiquadFilterType = 'bandpass', end = frequency, delay = 0, pan = 0): void {
    if (!this.ready() || !this.noiseBuffer) return;
    const context = this.context!;
    const time = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), time + duration);
    filter.Q.value = type === 'bandpass' ? 1.5 : 0.7;
    const envelope = context.createGain();
    const panner=context.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.007);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(panner);panner.connect(this.effects!);
    source.start(time, Math.random() * 0.7);
    source.stop(time + duration + 0.02);
    this.register([source], [filter, envelope,panner]);
  }

  attack(classId: ClassId, combo = 1): void {
    const heavy = classId === 'berserker' || classId === 'lanceman';
    switch (classId) {
      case 'ranger':
        this.noise(0.12, 1800, 0.2, 'bandpass', 4500);
        this.tone(240, 0.14, 0.09, 'triangle', 110);
        break;
      case 'elementalist':
      case 'necromancer':
      case 'warlock':
        this.tone(classId === 'necromancer' ? 160 : 330, 0.24, 0.085, 'triangle', 760);
        this.noise(0.16, 1800, 0.12, 'bandpass', 400);
        break;
      case 'monk':
        this.noise(0.09, 950, 0.22, 'bandpass', 220);
        this.tone(105, 0.09, 0.16, 'sine', 45);
        break;
      default:
        this.noise(heavy ? 0.25 : 0.15, heavy ? 1300 : 3200, 0.22 + combo * 0.02, 'bandpass', 350);
        this.tone(heavy ? 100 : 170, 0.12, 0.08, 'triangle', 65);
        if(heavy){this.tone(43,.34,.14,'sine',27,.06);this.noise(.22,360,.12,'lowpass',90,.07);}
        else {this.tone(1620,.08,.025,'triangle',1490,.045);this.tone(2370,.09,.018,'sine',2150,.052);}
        if (combo === 3) this.tone(66, 0.24, 0.18, 'sine', 32, 0.04);
    }
  }

  spell(classId: ClassId, index: number): void {
    this.heroEffort(classId,index);
    const root = ({ berserker: 110, paladin: 293.66, assassin: 220, ranger: 392, elementalist: 329.63, necromancer: 82.4, monk: 440, lanceman: 164.81, warlock: 138.59 } as const)[classId];
    const power = 1 + index * 0.2;
    this.tone(root * 0.5, 0.5 + index * 0.12, 0.12, 'triangle', root * 0.25);
    const intervals = [1, 1.5, 2, 3];
    for (let i = 0; i < intervals.length; i++) {
      this.tone(root * intervals[i], 0.22 + index * 0.07, 0.06, classId === 'warlock' ? 'sawtooth' : 'sine', root * intervals[i] * 1.6, i * 0.035, (i - 1.5) * 0.25);
    }
    this.noise(0.35 + index * 0.1, 2400, 0.16 * power, 'lowpass', 240);
    if (classId === 'elementalist' && index === 2) {
      for (let i = 0; i < 5; i++) this.noise(0.045, 6000, 0.35, 'highpass', 1700, i * 0.045);
    }
    if(classId==='elementalist'&&index===0){for(let n=0;n<6;n++)this.noise(.06,1800+n*350,.07,'highpass',600,n*.05);}
    if(classId==='elementalist'&&index===1){for(let n=0;n<7;n++)this.tone(1300+n*290,.11,.025,'sine',2100+n*340,n*.024,(n-3)*.15);}
    if(classId==='necromancer'||classId==='warlock'){
      this.noise(.6,480,.12,'bandpass',170);this.tone(78,.55,.04,'sawtooth',59,.03);
    }
    if (index === 3) {
      this.tone(55, 0.7, 0.22, 'sine', 26, 0.1);
      this.noise(0.7, 700, 0.28, 'lowpass', 80, 0.08);
    }
  }

  impact(critical = false,position?:{x:number;z:number}): void {
    const spatial=position?spatialAudio(position,this.listener):{gain:1,pan:0};if(!spatial.gain)return;
    this.tone(critical ? 85 : 145, critical ? 0.22 : 0.1, (critical ? 0.26 : 0.14)*spatial.gain, 'sine', 32,0,spatial.pan);
    this.noise(critical ? 0.2 : 0.09, 1900, (critical ? 0.25 : 0.13)*spatial.gain, 'bandpass', 450,0,spatial.pan);
    if (critical) this.tone(880, 0.14, 0.06*spatial.gain, 'triangle', 510,0,spatial.pan);
  }

  coin(): void {
    this.tone(1318.51, 0.13, 0.09, 'sine', 1760);
    this.tone(2093, 0.2, 0.055, 'sine', 2093, 0.07);
  }

  levelUp(): void {
    for (const [i, note] of [261.63, 329.63, 392, 523.25, 659.25, 783.99].entries()) {
      this.tone(note, 0.65, 0.085, 'triangle', note, i * 0.085, (i % 2 ? 1 : -1) * 0.25);
    }
    this.noise(0.7, 600, 0.1, 'highpass', 4500);
  }

  bossRoar(): void {
    this.tone(61.74, 1.3, 0.17, 'sawtooth', 35);
    this.tone(64.2, 1.1, 0.1, 'triangle', 39, 0.05);
    this.noise(1.2, 280, 0.4, 'bandpass', 110);
  }
  /** Short formant vowels, distinct from narrated speech; routed to the voice slider. */
  heroEffort(classId:ClassId,skill=0):void {
    if(!this.ready()||!this.voiceBus||this.effortClock>0)return;
    this.effortClock=.45;
    const context=this.context!,time=context.currentTime,duration=skill===3?.33:.19;
    const fundamental=({berserker:91,paladin:113,assassin:151,ranger:174,elementalist:186,necromancer:102,monk:142,lanceman:122,warlock:119} as const)[classId];
    const source=context.createOscillator();source.type='sawtooth';
    source.frequency.setValueAtTime(fundamental*1.22,time);source.frequency.exponentialRampToValueAtTime(fundamental*.77,time+duration);
    const envelope=context.createGain();envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(.4,time+.024);envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
    const formants=[{f:skill%2?520:730,q:5,g:.7},{f:skill%2?1200:1090,q:7,g:.28},{f:2440,q:10,g:.08}];
    const nodes:AudioNode[]=[envelope];
    formants.forEach(({f,q,g})=>{const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=f;filter.Q.value=q;const gain=context.createGain();gain.gain.value=g;source.connect(filter);filter.connect(gain);gain.connect(envelope);nodes.push(filter,gain);});
    envelope.connect(this.voiceBus);source.start(time);source.stop(time+duration+.01);this.register([source],nodes);
  }
  trade(purchase=false):void {if(purchase)this.coin();else{this.noise(.11,3600,.055,'highpass',1600);this.noise(.07,2100,.03,'bandpass',400,.06);}}
  private mining():void {this.tone(1150,.17,.065,'triangle',920);this.tone(2470,.21,.034,'sine',2260,.014);this.noise(.075,2100,.09,'highpass',650);}

  private footstep(inWater: boolean): void {
    if (inWater) {
      this.noise(0.19, 2800, 0.14, 'lowpass', 420);
      this.tone(320 + Math.random() * 80, 0.09, 0.035, 'sine', 180);
    } else {
      this.noise(0.075, 580 + Math.random() * 350, 0.09, 'bandpass', 180);
      this.tone(60 + Math.random() * 15, 0.065, 0.07, 'sine', 30);
    }
  }

  update(dt: number, environment: SoundEnvironment): void {
    if (!this.ready()) return;
    const step = Math.max(0, Math.min(0.1, dt));
    const context = this.context!;
    this.ambienceClock += step;
    this.effortClock=Math.max(0,this.effortClock-step);
    this.miningClock-=step;
    if(environment.gathering==='ore'&&this.miningClock<=0){this.mining();this.miningClock=.48;}
    if(!environment.gathering)this.miningClock=0;
    this.footstepClock -= step;
    this.birdClock -= step;
    if (environment.moving && this.footstepClock <= 0) {
      this.footstep(environment.inWater);
      if(environment.mounted&&!environment.inWater){this.tone(78,.09,.13,'triangle',35,.08,-.25);this.tone(95,.08,.1,'triangle',42,.19,.25);}
      this.footstepClock = environment.inWater ? 0.62 : environment.mounted?.44:.31;
    }
    if (!environment.moving) this.footstepClock = Math.min(this.footstepClock, 0.12);
    if (environment.boss && !this.bossPresent) this.bossRoar();
    this.bossPresent = environment.boss;
    const day = Math.max(0, Math.min(1, environment.daylight));
    this.ambienceFilter?.frequency.setTargetAtTime(450 + day * 500 + Math.sin(this.ambienceClock * 0.12) * 120, context.currentTime, 1.2);
    const melody=({aurora:[73.416,110,146.832,220],crypt:[55,65.406,82.407,110],highlands:[98,146.832,196,293.665],rift:[41.203,61.735,82.407,123.47],eclipse:[51.913,77.782,103.826,155.56]} as Record<string,number[]>)[environment.region??'aurora']??[49,58.27,73.416,98];
    this.musicClock-=step;
    if(this.musicClock<=0){
      const tense=environment.boss||environment.pvp,bpm=environment.pvp?146:environment.boss?134:environment.village?68:92;
      this.musicClock=60/bpm/2;
      const degree=[0,2,1,3,2,1,0,1][this.musicBeat%8],root=melody[degree];
      this.tone(root*(tense?2:4),tense?.25:.9,tense?.12:.055,'triangle',root*(tense?2:4),0,(degree-1.5)*.2,'music');
      if(tense&&this.musicBeat%2===0)this.tone(58,.16,.26,'sine',29,0,0,'music');
      this.musicBeat++;
    }
    this.ambientGains.forEach((gain, i) => {
      const pulse = 0.7 + Math.sin(this.ambienceClock * (0.07 + i * 0.03) + i) * 0.3;
      gain.gain.setTargetAtTime((environment.boss ? 0.035 : 0.012) * pulse, context.currentTime, 0.7);
      this.ambientOscillators[i].frequency.setTargetAtTime(melody[i] * (environment.boss ? 0.75 : 1), context.currentTime, 2);
    });
    if (this.birdClock <= 0 && !environment.boss && (!environment.region||environment.region==='aurora')) {
      if (day > 0.3) {
        const pitch = 1700 + Math.random() * 800;
        this.tone(pitch, 0.11, 0.025, 'sine', pitch * 1.35, 0, Math.random() * 1.5 - 0.75);
        this.tone(pitch * 1.2, 0.08, 0.018, 'sine', pitch, 0.16);
        this.birdClock = 5 + Math.random() * 11;
      } else {
        for (let i = 0; i < 4; i++) this.tone(3600, 0.035, 0.008, 'sine', 3800, i * 0.07, 0.55);
        this.birdClock = 2 + Math.random() * 4;
      }
    }
  }

  get diagnostics(): { unlocked: boolean; voices: number; enabled: boolean } {
    return { unlocked: this.context?.state === 'running', voices: this.voices.size, enabled: this.enabled };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.visibilityHandler && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const voice of [...this.voices]) this.release(voice, true);
    for (const oscillator of this.ambientOscillators) { try { oscillator.stop(); } catch { /* Already stopped. */ } oscillator.disconnect(); }
    if (this.ambientNoise) { try { this.ambientNoise.stop(); } catch { /* Already stopped. */ } this.ambientNoise.disconnect(); }
    for (const node of [...this.ambientNodes, ...this.ambientGains]) node.disconnect();
    this.effects?.disconnect();
    this.ambience?.disconnect();
    this.voiceBus?.disconnect();
    this.master?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.noiseBuffer = null;
  }
}
