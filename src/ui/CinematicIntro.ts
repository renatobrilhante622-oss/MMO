import {setScreenPhase} from './MainMenu';

/** One noninteractive opening movie, followed by the sole ETERNA title screen. */
export class CinematicIntro {
 readonly root=document.createElement('section');
 private frame=0;
 private began=0;
 private completed=false;
 private readonly duration=11000;
 private readonly reduced=typeof matchMedia==='function'
   &&matchMedia('(prefers-reduced-motion: reduce)').matches;
 private readonly captions=[
  'A Guerra das Nove Dobras partiu um mundo em nove domínios.',
  'Os Selos Primordiais desapareceram. Os Guardiões foram acorrentados.',
  'Agora, a Nona Marca desperta em você.',
  'ETERNAL NINEFOLD — OS NOVE SELOS DESPERTAM.'
 ];
 constructor(private readonly host:HTMLElement,
  private readonly onFrame:(progress:number)=>void,
  private readonly onComplete:()=>void){
  setScreenPhase(host,'cinematic');
  this.root.className='eterna-cinematic';
  this.root.setAttribute('role','dialog');
  this.root.setAttribute('aria-label','Prólogo cinematográfico de Eterna');
  this.root.innerHTML=`<div class="cinema-letterbox cinema-letterbox-top" aria-hidden="true"></div>
   <div class="cinema-letterbox cinema-letterbox-bottom" aria-hidden="true"></div>
   <div class="cinema-embers" aria-hidden="true">${Array.from({length:32},(_,i)=>
     `<i style="--x:${(i*47+11)%100}%;--delay:${-i*.27}s;--speed:${2+(i%5)*.44}s"></i>`).join('')}</div>
   <div class="cinema-chapter">PRÓLOGO • OS NOVE CAMINHOS</div>
   <p class="cinema-caption" aria-live="off"></p>
   <button type="button" class="cinema-skip">Pular Intro <span aria-hidden="true">⏭</span></button>`;
  this.root.querySelector<HTMLButtonElement>('.cinema-skip')!.onclick=()=>this.complete();
  host.append(this.root);
  if(this.reduced){this.onFrame(.96);this.complete();return;}
  this.frame=requestAnimationFrame(this.animate);
 }
 private readonly animate=(now:number):void=>{
  if(this.completed)return;
  if(!this.began)this.began=now;
  const t=Math.max(0,Math.min(1,(now-this.began)/this.duration));
  this.onFrame(t);
  const slot=Math.min(3,Math.floor(t*4));
  const caption=this.root.querySelector<HTMLElement>('.cinema-caption')!;
  if(caption.dataset.slot!==String(slot)){
    caption.dataset.slot=String(slot);
    caption.textContent=this.captions[slot];
  }
  const local=t*4-slot;
  caption.style.opacity=String(Math.min(1,Math.max(0,local*5),Math.max(0,(1-local)*5)));
  if(t>=1){this.complete();return;}
  this.frame=requestAnimationFrame(this.animate);
 };
 private complete():void{
  if(this.completed)return;
  this.completed=true;
  cancelAnimationFrame(this.frame);
  this.onComplete();
  this.root.remove();
 }
 dispose():void{
  this.completed=true;cancelAnimationFrame(this.frame);
  this.root.remove();
 }
}
