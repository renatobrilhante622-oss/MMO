import {setScreenPhase} from './MainMenu';
/** Tap-gated intro: no renderer, network requests or animation loop before the user's gesture. */
export class SplashScreen {
  readonly root=document.createElement('section');
  private entering=false;
  private disposed=false;
  private timer=0;
  private readonly abort=new AbortController();
  constructor(private readonly container:HTMLElement,private readonly onEnter:()=>void|Promise<void>){
    setScreenPhase(container,'splash');
    this.root.className='eterna-splash';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Eterna: Action MMO');
    this.root.innerHTML=`<div class="splash-vignette"></div><div class="splash-rune-ring" aria-hidden="true">✦</div><div class="splash-embers" aria-hidden="true">${Array.from({length:22},(_,i)=>`<i style="--x:${(i*37+13)%100}%;--delay:${(i%7)*-.43}s;--drift:${(i%2?1:-1)*(20+i%5*9)}px;--duration:${2.2+(i%5)*.34}s"></i>`).join('')}</div><div class="splash-title"><span class="splash-overline">OS REINOS AGUARDAM SEU DESPERTAR</span><h1>ETERNA</h1><p>A C T I O N &nbsp; M M O</p><div class="splash-title-rule" aria-hidden="true"><span></span>✦<span></span></div><button class="splash-start" data-splash-start><span>TOQUE PARA INICIAR</span><small>UMA NOVA LENDA COMEÇA</small></button><p class="splash-load-status" role="status" aria-live="polite"></p></div>`;
    container.append(this.root);
    this.root.querySelector<HTMLButtonElement>('[data-splash-start]')!.addEventListener('click',()=>this.enter(),{signal:this.abort.signal});
  }
  private enter():void {
    if(this.entering||this.disposed)return;this.entering=true;
    const button=this.root.querySelector<HTMLButtonElement>('[data-splash-start]')!;button.disabled=true;this.root.classList.add('is-entering');
    setScreenPhase(this.container,'loading');this.root.querySelector('.splash-load-status')!.textContent='DESPERTANDO O MUNDO…';
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.timer=window.setTimeout(()=>{void this.revealMenu();},reduced?100:620);
  }
  private async revealMenu():Promise<void> {
    if(this.disposed)return;
    try{
      await this.onEnter();if(this.disposed)return;
      setScreenPhase(this.container,'menu');this.root.classList.add('is-finished');
      this.timer=window.setTimeout(()=>{this.root.remove();},340);
    }catch(error){
      if(this.disposed)return;this.entering=false;this.root.classList.remove('is-entering');setScreenPhase(this.container,'splash');
      const button=this.root.querySelector<HTMLButtonElement>('[data-splash-start]')!;button.disabled=false;this.root.querySelector('.splash-load-status')!.textContent='Não foi possível abrir o mundo. Toque para tentar novamente.';
      console.error('Eterna entry failed',error);
    }
  }
  dispose():void{this.disposed=true;clearTimeout(this.timer);this.abort.abort();this.root.remove();}
}
