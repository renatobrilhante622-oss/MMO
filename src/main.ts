import { Engine } from './core/Engine';
import './ui/style.css';

declare global { interface Window { __ETERNA__?: Engine } }

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Contêiner principal não encontrado.');

try {
  const game = new Engine(app);
  if (import.meta.env.DEV) window.__ETERNA__ = game;
  game.start();
  if (import.meta.hot) import.meta.hot.dispose(() => { game.dispose(); delete window.__ETERNA__; });
} catch (error) {
  console.error('Eterna initialization failed', error);
  app.replaceChildren();
  const fallback = document.createElement('section');
  fallback.className = 'startup-error';
  const title = document.createElement('h1'); title.textContent = 'O vale precisa de WebGL 2';
  const text = document.createElement('p'); text.textContent = 'Use um navegador atualizado com aceleração gráfica ativada. Feche outras abas ou tente novamente.';
  const detail = document.createElement('pre'); detail.textContent = error instanceof Error ? error.message : String(error);
  const retry = document.createElement('button'); retry.textContent = 'Tentar novamente'; retry.onclick = () => location.reload();
  fallback.append(title, text, detail, retry); app.append(fallback);
}
