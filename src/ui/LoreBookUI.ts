import {GAME_TITLE,LORE_CHAPTERS,type LoreLanguage} from '../rpg/LoreSystem';
import type {VoiceSynthesisSystem} from '../audio/VoiceSynthesisSystem';
export class LoreBookUI {
  readonly root=document.createElement('section');
  readonly player=document.createElement('aside');
  private chapter='sundering';
  private speaking=false;
  private readonly abort=new AbortController();
  constructor(host:HTMLElement,private readonly voice:VoiceSynthesisSystem,private readonly language:()=>LoreLanguage) {
    this.root.className='ninefold-lore-book';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','false');
    this.player.className='ninefold-lore-player';this.player.hidden=true;host.append(this.root,this.player);
    this.root.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-lore]');if(!button)return;const action=button.dataset.lore;if(action==='close')this.close();else if(action==='stop'){this.voice.stop();}else if(action==='play')this.play(button.dataset.chapter??this.chapter);},{signal:this.abort.signal});
    this.player.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-lore-stop]'))this.voice.stop();else this.open();},{signal:this.abort.signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!this.root.hidden)this.close();},{signal:this.abort.signal});
  }
  open():void {this.root.hidden=false;this.render();this.root.querySelector<HTMLElement>('[data-lore=close]')?.focus();}
  close():void {this.root.hidden=true;}
  private render():void {
    const l=this.language()==='pt'?0:1;
    this.root.replaceChildren();
    const header=document.createElement('header'),title=document.createElement('strong');title.textContent=GAME_TITLE+' · '+(l===0?'Códice Sonoro':'Lore Book');
    const close=document.createElement('button');close.dataset.lore='close';close.textContent=l===0?'Voltar ao jogo':'Return to game';header.append(title,close);
    const list=document.createElement('nav');list.className='lore-chapters';
    for(const chapter of LORE_CHAPTERS){const row=document.createElement('button');row.dataset.lore='play';row.dataset.chapter=chapter.id;row.textContent='▷ '+chapter.title[l];row.classList.toggle('selected',chapter.id===this.chapter);list.append(row);}
    const text=document.createElement('article'),chapter=LORE_CHAPTERS.find(c=>c.id===this.chapter)!;
    const heading=document.createElement('h2');heading.textContent=chapter.title[l];const transcript=document.createElement('p');transcript.textContent=chapter.text[l];
    const play=document.createElement('button');play.dataset.lore=this.speaking?'stop':'play';play.textContent=this.speaking?(l===0?'■ Parar narração':'■ Stop narration'):(l===0?'▷ Ouvir capítulo':'▷ Listen to chapter');
    const hint=document.createElement('small');hint.textContent=l===0?'A narração continua quando você volta ao mundo.':'Narration continues when you return to the world.';
    text.append(heading,transcript,play,hint);this.root.append(header,list,text);
  }
  private play(id:string):void {
    const chapter=LORE_CHAPTERS.find(c=>c.id===id);if(!chapter)return;
    this.chapter=id;const language=this.language(),l=language==='pt'?0:1;
    this.voice.speak({id:'lore-'+id,text:chapter.text[l],speaker:'narrator',language},{state:state=>{
      this.speaking=state==='loading'||state==='speaking';this.player.hidden=!this.speaking;
      this.player.replaceChildren();const title=document.createElement('span');title.textContent='♫ '+chapter.title[l];const stop=document.createElement('button');stop.dataset.loreStop='';stop.textContent='■';stop.setAttribute('aria-label',l===0?'Parar narração':'Stop narration');this.player.append(title,stop);
      if(!this.root.hidden)this.render();
    }});
  }
  get blocking():boolean{return !this.root.hidden;}
  dispose():void {this.abort.abort();if(this.speaking)this.voice.stop();this.root.remove();this.player.remove();}
}
