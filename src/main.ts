import {Engine} from './core/Engine';
import {SplashScreen} from './ui/SplashScreen';
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
import './ui/audit-layout.css';
import './ui/physical-portals.css';
import './ui/forge-audit.css';
import './ui/dungeon-audit.css';

declare global {interface Window {__ETERNA__?:Engine}}
const app=document.querySelector<HTMLElement>('#app');
if(!app)throw new Error('Contêiner principal não encontrado.');
let game:Engine|undefined;
const splash=new SplashScreen(app,()=>{
  try{
    document.getElementById('boot')?.remove();
    game=new Engine(app);
    if(import.meta.env.DEV)window.__ETERNA__=game;
    game.start();
  }catch(error){
    game?.dispose();game=undefined;delete window.__ETERNA__;
    for(const child of [...app.children])if(child!==splash.root)child.remove();
    throw error;
  }
});
if(import.meta.hot)import.meta.hot.dispose(()=>{splash.dispose();game?.dispose();delete window.__ETERNA__;});
