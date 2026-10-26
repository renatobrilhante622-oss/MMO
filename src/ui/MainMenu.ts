export type ScreenPhase='cinematic'|'splash'|'loading'|'menu'|'class-selection'|'modal'|'playing';
/** Explicit entry states override saved HUD positions and inline display styles. */
export function setScreenPhase(container:HTMLElement,phase:ScreenPhase):void {
  container.dataset.screen=phase;
  container.classList.toggle('entry-isolated',phase!=='playing'&&phase!=='modal');
  container.classList.toggle('live-menu',phase==='modal');
  container.setAttribute('aria-busy',phase==='loading'?'true':'false');
}
export class MainMenu {
  private phase:ScreenPhase='splash';
  constructor(private readonly container:HTMLElement){this.set('splash');}
  get state():ScreenPhase{return this.phase;}
  set(phase:ScreenPhase):void{this.phase=phase;setScreenPhase(this.container,phase);}
  dispose():void{delete this.container.dataset.screen;this.container.classList.remove('entry-isolated');this.container.removeAttribute('aria-busy');}
}
