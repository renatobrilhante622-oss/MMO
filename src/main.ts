import {Engine} from './core/Engine';
import {CinematicIntro} from './ui/CinematicIntro';
import './ui/style.css';
import './ui/mobile-ux.css';
import './ui/expansion.css';
import './ui/hud-clean.css';
import './ui/shop-gacha.css';
import './ui/clan-visual.css';
import './ui/collection-forge.css';
import './ui/vip.css';
import './ui/intro.css';
import './ui/region-travel.css';
import './ui/quest-npc.css';
import './ui/part2-forge-collection.css';
import './ui/part2-hud-npc.css';
import './ui/physical-portals.css';
import './ui/dungeon-audit.css';
import './ui/pr10-cinematic-hud.css';
import './ui/pr13-visual.css';
import './ui/pr15-systems.css';
import './ui/pr16-design.css';
import './ui/pr16-banners.css';
import './ui/pr16-arena.css';

declare global {interface Window {__ETERNA__?:Engine}}
const app=document.querySelector<HTMLElement>('#app');
if(!app)throw new Error('Contêiner principal não encontrado.');
let game:Engine|undefined;
let intro:CinematicIntro|undefined;
try{
  document.getElementById('boot')?.remove();
  app.dataset.screen='cinematic';
  app.classList.add('entry-isolated');
  game=new Engine(app);
  if(import.meta.env.DEV)window.__ETERNA__=game;
  game.start();
  intro=new CinematicIntro(app,
    t=>game?.setOpeningProgress(t),
    ()=>{
      game?.setOpeningProgress(null);
      app.dataset.screen='menu';
      app.classList.add('entry-isolated');
    });
}catch(error){
  game?.dispose();
  game=undefined;
  console.error('Falha na inicialização gráfica de ETERNA',error);
  app.innerHTML='<section class="eterna-start-error" role="alert">Não foi possível iniciar o mundo 3D. Reinicie o aplicativo.</section>';
}
if(import.meta.hot)import.meta.hot.dispose(()=>{
  intro?.dispose();game?.dispose();delete window.__ETERNA__;
});
