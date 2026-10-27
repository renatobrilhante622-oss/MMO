import {npcPortrait} from './NPCDialogUI';
import {npcVoice} from '../audio/VoiceProfiles';
import type {SpokenLine} from '../rpg/LoreSystem';
import type {SpeechState,VoiceSynthesisSystem} from '../audio/VoiceSynthesisSystem';
/** Transcript is always available, including muted, offline and unsupported audio devices. */
export class DialogueUI {
  readonly root=document.createElement('section');
  private readonly transcript=document.createElement('p');
  private readonly indicator=document.createElement('span');
  private readonly skip=document.createElement('button');
  private readonly replay=document.createElement('button');
  private characters=0;
  private disposed=false;
  constructor(private readonly voice:VoiceSynthesisSystem,private readonly line:SpokenLine) {
    const pt=line.language==='pt',identity=npcVoice(line.speaker);
    this.root.className='voiced-dialogue';this.root.dataset.speaker=line.speaker;
    const portrait=document.createElement('figure');portrait.innerHTML=npcPortrait(line.speaker);
    const name=document.createElement('strong');name.textContent=identity.name;
    const title=document.createElement('small');title.textContent=identity.title[pt?0:1];
    const heading=document.createElement('div');heading.className='dialogue-speaker';heading.append(name,title);
    this.transcript.className='dialogue-transcript';this.transcript.setAttribute('aria-label',line.text);
    this.indicator.className='dialogue-wave';this.indicator.setAttribute('role','status');
    this.skip.type='button';this.skip.textContent=pt?'⏭ Pular fala':'⏭ Skip speech';this.skip.onclick=()=>{this.voice.stop();this.reveal(line.text.length);};
    this.replay.type='button';this.replay.textContent=pt?'↻ Ouvir novamente':'↻ Replay';this.replay.onclick=()=>this.play();
    const controls=document.createElement('nav');controls.className='dialogue-playback';controls.append(this.indicator,this.skip,this.replay);
    this.root.append(portrait,heading,this.transcript,controls);this.play();
  }
  private reveal(n:number):void {if(this.disposed)return;this.characters=Math.max(this.characters,n);this.transcript.textContent=this.line.text.slice(0,this.characters);}
  private state(state:SpeechState):void {
    if(this.disposed)return;
    const pt=this.line.language==='pt';this.root.dataset.speech=state;
    this.indicator.textContent=state==='speaking'?(pt?'▂▅▃▆ Falando…':'▂▅▃▆ Speaking…'):state==='loading'?(pt?'Preparando voz…':'Preparing voice…'):state==='unavailable'?(pt?'Áudio indisponível • transcrição completa':'Audio unavailable • full transcript'):(pt?'Fala concluída':'Speech complete');
    this.skip.disabled=state!=='speaking'&&state!=='loading';
    if(['ended','cancelled','unavailable'].includes(state))this.reveal(this.line.text.length);
  }
  private play():void {this.voice.stop();this.characters=0;this.transcript.textContent='';this.voice.speak(this.line,{state:s=>this.state(s),boundary:n=>this.reveal(n)});}
  dispose():void {this.disposed=true;this.voice.stop();this.root.remove();}
}
