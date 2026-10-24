import {beastArt} from './GameIllustrations';
import {itemIcon} from './ItemIconRenderer';

export interface ClanVisualState {
  connected: boolean;
  bossHp: number;
  bossMaxHp?: number;
  bossAttackAt: number;
  serverTime: number;
  level: number;
  memberCount: number;
}

let sceneId = 0;
const finite = (n: number, fallback = 0) => Number.isFinite(n) ? n : fallback;

/** The fortress is a navigation surface: server actions remain in AdventureHub. */
export function renderClanVisualHub(state: ClanVisualState, pt = true): string {
  const t = (br: string, en: string) => pt ? br : en;
  const level = Math.max(1, Math.floor(finite(state.level, 1)));
  const members = Math.max(0, Math.floor(finite(state.memberCount)));
  const joined = state.connected && members > 0;
  const maxHp = Math.max(1, finite(state.bossMaxHp ?? 50000, 50000));
  const hp = Math.min(maxHp, Math.max(0, finite(state.bossHp)));
  const health = Math.round(hp / maxHp * 100);
  const seconds = Math.max(0, Math.ceil((finite(state.bossAttackAt) - finite(state.serverTime)) / 1000));
  const altarState = !joined ? 'locked' : hp <= 0 ? 'defeated' : seconds ? 'cooldown' : 'active';
  const lockLabel = !state.connected ? t('Conecte ao servidor', 'Connect to server') : t('Entre em um clã', 'Join a clan');
  const altarLabel = altarState === 'locked' ? lockLabel : altarState === 'defeated' ? t('Chefe derrotado', 'Boss defeated') : altarState === 'cooldown' ? `${t('Recarga', 'Cooldown')} ${seconds}s` : t('Ataque disponível', 'Attack ready');
  const uid = `clan-scene-${++sceneId}`;
  const buffs = Math.max(0, (level - 1) * 3);

  function room(id: 'members' | 'altar' | 'buffs', icon: string, title: string, status: string, detail: string, body: string) {
    const phase = !joined ? 'locked' : id === 'altar' ? altarState : 'active';
    return `<button class="fortress-room fortress-${id} fortress-module" data-do="fortress-focus" data-id="${id}" data-status="${phase}" aria-label="${title}: ${status}">
      <span class="fortress-module-icon">${icon}</span><span class="fortress-module-copy"><strong>${title}</strong>
      <span class="fortress-status"><i aria-hidden="true"></i>${status}</span><small>${detail}</small></span>
      <span class="fortress-module-meter">${body}</span><span class="fortress-module-arrow" aria-hidden="true">›</span>
    </button>`;
  }

  return `<section class="clan-fortress clan-visual-hub" aria-label="${t('Fortaleza do clã', 'Clan fortress')}">
    <div class="fortress-scene">${fortressScene(uid)}<span class="fortress-embers" aria-hidden="true"></span>
      <header class="fortress-scene-title"><span>${t('DOMÍNIO DA IRMANDADE', 'BROTHERHOOD DOMAIN')}</span><h2>${t('Fortaleza de Aster', 'Aster Stronghold')}</h2><p>${joined ? `${members} ${t('membros', 'members')} · ${t('Fortaleza nível', 'Stronghold level')} ${level}` : lockLabel}</p></header>
      <div class="fortress-crest" aria-hidden="true">${crestIcon()}</div>
      <span class="fortress-online-status" data-status="${joined ? 'active' : 'locked'}"><i></i>${joined ? t('Clã conectado', 'Clan connected') : state.connected ? t('Sem clã', 'No clan') : t('Servidor desconectado', 'Server disconnected')}</span>
    </div>
    <div class="fortress-modules">
      ${room('members', hallIcon(), t('Salão de Membros', 'Members Hall'), joined ? t('Salão ativo', 'Hall active') : lockLabel, joined ? `${members} ${t('companheiros de armas', 'brothers in arms')}` : t('Hierarquia e contribuições', 'Ranks and contributions'), `<span class="fortress-mini-ranks">${[0,1,2,3].map((n) => `<i class="${joined && n < members ? 'is-filled' : ''}" aria-hidden="true">♜</i>`).join('')}</span>`)}
      ${room('altar', beastArt('boss', '#c782df'), t('Altar Semanal', 'Weekly Altar'), altarLabel, joined ? `${health}% ${t('de vida do guardião', 'guardian health')}` : t('Boss e recompensas compartilhados', 'Shared boss and rewards'), `<span class="fortress-health-track" role="progressbar" aria-label="${t('Vida do chefe semanal', 'Weekly boss health')}" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><i style="width:${joined ? health : 0}%"></i></span>`)}
      ${room('buffs', itemIcon('guard', 'legendary'), t('Bênçãos do Clã', 'Clan Blessings'), joined ? t('Bônus ativo', 'Buff active') : lockLabel, joined ? `+${buffs}% ${t('dano de raid', 'raid damage')}` : t('Evolua a fortaleza para fortalecer o clã', 'Upgrade the stronghold to empower the clan'), `<span class="fortress-buff-runes" aria-hidden="true">✧ <b>${joined ? `+${buffs}%` : '—'}</b> ✧</span>`)}
    </div>
  </section>`;
}

function crestIcon(): string {
  return '<svg viewBox="0 0 100 120"><path d="M10 14 50 3l40 11v58c-5 21-22 34-40 43C32 106 15 93 10 72Z" fill="#171c27" stroke="#dfbd74" stroke-width="3"/><path d="M18 21 50 12l32 9v47c-4 17-17 29-32 37C35 97 22 85 18 68Z" fill="#46344f" stroke="#a68558"/><path d="m50 25 8 22 22 6-22 8-8 29-8-29-22-8 22-6Z" fill="#e4c382"/><path d="m50 38 5 15-5 22-5-22Z" fill="#fff5ce"/><path d="M28 25v15m44-15v15" stroke="#bb9f6f"/></svg>';
}

function hallIcon(): string {
  return '<svg class="fortress-hall-icon" viewBox="0 0 140 120" aria-hidden="true"><path d="m8 43 62-34 62 34-7 13H15Z" fill="#908270" stroke="#e3cf9c" stroke-width="2"/><path d="m24 48 46-25 46 25" fill="none" stroke="#b9a57c"/><path d="M24 57h15v43H24m39-43h15v43H63m39-43h15v43h-15" fill="#7e8791" stroke="#d0c4a2" stroke-width="2"/><path d="M18 56h107M14 103h115M9 111h125" stroke="#c8ac76" stroke-width="5"/><path d="M45 100V63h14v37m23 0V63h14v37" fill="#161d29"/><path d="m70 31 5 8-5 7-5-7Z" fill="#f3d993"/></svg>';
}

function fortressScene(id: string): string {
  const merlons = Array.from({length: 16}, (_, i) => `<path d="M${96 + i * 45} 241v-22h22v22"/>`).join('');
  const blocks = Array.from({length: 8}, (_, row) => `<path d="M100 ${255 + row * 15}h700"/><path d="${Array.from({length: 13}, (_, col) => `M${105 + col * 57 + row % 2 * 28} ${240 + row * 15}v15`).join('')}"/>`).join('');
  const windows = [175, 275, 615, 715].map(x => `<path d="M${x} 286v-25c0-16 18-16 18 0v25Z" fill="#f6bb6b" filter="url(#${id}-light)"/><path d="M${x + 8} 247v39m-10-13h20" stroke="#302b29" stroke-width="3"/>`).join('');
  const torch = (x: number) => `<g class="fortress-torch"><ellipse cx="${x}" cy="335" rx="65" ry="82" fill="url(#${id}-fire)"/><path d="M${x} 345v-30m-8 14h16" stroke="#6d614a" stroke-width="6"/><path d="M${x-8} 318q-10-13 5-30 1 11 6 8 15 16-1 24Z" fill="#ffae50"/><path d="M${x-3} 317q-4-10 4-16 7 13-1 18Z" fill="#fff0ac"/></g>`;
  return `<svg class="fortress-panorama" viewBox="0 0 900 410" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Dark fantasy stone fortress under moonlight">
    <defs>
      <linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#080d1b"/><stop offset=".55" stop-color="#2a253d"/><stop offset="1" stop-color="#81705c"/></linearGradient>
      <linearGradient id="${id}-stone" x2=".2" y2="1"><stop stop-color="#626675"/><stop offset=".32" stop-color="#363e4c"/><stop offset="1" stop-color="#151c28"/></linearGradient>
      <linearGradient id="${id}-roof" x2="0" y2="1"><stop stop-color="#72617e"/><stop offset="1" stop-color="#252939"/></linearGradient>
      <linearGradient id="${id}-fog"><stop stop-color="#a8a5c5" stop-opacity="0"/><stop offset=".5" stop-color="#b0abc8" stop-opacity=".19"/><stop offset="1" stop-color="#908ba8" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}-fire"><stop stop-color="#ffac4f" stop-opacity=".46"/><stop offset="1" stop-color="#ff9836" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-moon"><stop stop-color="#e0e6ee" stop-opacity=".45"/><stop offset=".2" stop-color="#d8d9e8" stop-opacity=".12"/><stop offset="1" stop-color="#a5aecb" stop-opacity="0"/></radialGradient>
      <pattern id="${id}-masonry" width="54" height="28" patternUnits="userSpaceOnUse"><path d="M0 0h54v28H0Z" fill="#414958"/><path d="M0 0h54M0 14h54M27 0v14M0 14v14M54 14v14" fill="none" stroke="#111b29" stroke-width="1.6"/><path d="M1 2h24m3 14h24" stroke="#8a8a8e" stroke-opacity=".3"/><path d="m9 7 3 2-2 2m23 9 4-1" fill="none" stroke="#a4a0a0" stroke-opacity=".2"/></pattern>
      <filter id="${id}-grain"><feTurbulence type="fractalNoise" baseFrequency=".47" numOctaves="3" seed="13"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
      <filter id="${id}-light"><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <path d="M0 0H900V410H0Z" fill="url(#${id}-sky)"/><circle cx="744" cy="82" r="110" fill="url(#${id}-moon)"/><circle cx="744" cy="82" r="23" fill="#d4d5df" opacity=".55"/><path d="m0 185 59-81 78 75 79-129 88 149L416 87l87 104 92-114 98 108 88-80 119 100v205H0Z" fill="#161b2a"/><path d="m0 245 93-84 128 70 94-72 101 87 118-74 109 66 91-53 166 76v149H0Z" fill="#1c2532"/>
    <path d="M0 350 450 266l450 84v60H0Z" fill="#20252d"/><path d="m450 297-145 113h290Z" fill="#40404a"/><path d="m450 305-68 105m68-105 68 105m-111-66h86m-113 23h142m-170 24h198" stroke="#887862" stroke-opacity=".3" fill="none"/>
    <g filter="url(#${id}-grain)"><path d="M100 241h700v120H100Z" fill="url(#${id}-masonry)"/><g fill="#505766" stroke="#9b9384" stroke-width="1">${merlons}</g><path d="M100 244h700m-700 109h700" stroke="#979080" stroke-width="5"/><g fill="none" stroke="#111b29" stroke-opacity=".3">${blocks}</g>
    <path d="M120 251V137h115v114M665 251V137h115v114" fill="url(#${id}-masonry)" stroke="#878594" stroke-width="2"/><path d="m110 137 67-95 68 95Zm545 0 67-95 68 95Z" fill="url(#${id}-roof)" stroke="#a4a0a0" stroke-width="2"/><path d="m133 133 44-72 44 72m457 0 44-72 44 72" fill="none" stroke="#99869c" stroke-opacity=".4" stroke-width="2"/>
    <path d="M338 270V135h224v135" fill="url(#${id}-masonry)" stroke="#98929a" stroke-width="2"/><path d="m318 138 132-108 132 108Z" fill="url(#${id}-roof)" stroke="#b0a1ac" stroke-width="2"/><path d="m344 131 106-88 106 88m-178-31h145m-113-24h81" fill="none" stroke="#817487" stroke-width="2"/>
    <path d="M393 365v-83c0-76 114-76 114 0v83" fill="#101521" stroke="#8c847c" stroke-width="13"/><path d="M402 365v-81c0-64 96-64 96 0v81" fill="#1e1c28" stroke="#3a3942" stroke-width="6"/><path d="M450 246v120m-40-93h80m-80 20h80m-80 23h80m-80 24h80" stroke="#4e4242" stroke-width="3"/>
    <path d="M413 172h74v51l-37 25-37-25Z" fill="#4c2d46" stroke="#bca16e" stroke-width="2"/><path d="m450 181 7 16 17 5-17 5-7 21-7-21-17-5 17-5Z" fill="#d5b87b"/>
    <path d="M160 198v-27c0-22 35-22 35 0v27Zm545 0v-27c0-22 35-22 35 0v27Z" fill="#e6b574" stroke="#202333" stroke-width="5"/>${windows}
    <path d="M93 357v-51h18v51m128 0v-51h18v51m387 0v-51h18v51m128 0v-51h18v51" fill="#67626a" stroke="#38343d" stroke-width="3"/>
    </g>${torch(365)}${torch(535)}
    <path class="fortress-fog fortress-fog-back" d="M-130 262q240-45 430 0t480 0 370 0v52H-130Z" fill="url(#${id}-fog)"/>
    <path class="fortress-fog" d="M-140 358q200-40 420 0t450 0 390 0v52H-140Z" fill="url(#${id}-fog)"/>
    <path d="M0 0h900v410H0Z" fill="none" stroke="#020711" stroke-width="55" opacity=".2"/>
  </svg>`;
}
