import { CLASS_DEFINITIONS, CLASS_IDS } from '../combat/ClassSystem';
import { emptyInput, type ClassId, type EquipmentSlot, type HeroInput, type HeroState, type Item } from '../core/GameTypes';
import { classIcon, skillIcon } from './IconAtlas';
import { translateText } from './I18n';
import type { Language } from '../progression/AdventureProgress';
import { VitalMeter } from './VitalMeter';
import { itemIcon } from './ItemIconRenderer';
import './style.css';

export interface HUDModel {
  hp: number; maxHp: number; mana: number; maxMana: number; xp: number; xpToNext: number;
  level: number; classId: ClassId; state: HeroState; gold: number; crystals: number;
  items: Item[]; equipment: Partial<Record<EquipmentSlot, string>>;
  buildings: Array<{ id: string; name: string; description: string; level: number; maxLevel: number; cost: { gold: number; crystals: number } }>;
  codex: Array<{ id: string; name: string; description: string; kills: number; required: number; bonus: string }>;
  cooldowns: number[]; cooldownMax: number[];
  player: { x: number; z: number; heading: number };
  enemies: Array<{ x: number; z: number; boss: boolean }>;
  markers: Array<{ x: number; z: number; label: string; color: string }>;
  dungeon: { active: boolean; wave: number; status: string;floor?:number;maxFloors?:number };
  boss?: { name: string; hp: number; maxHp: number; phase: number };
  mounted: boolean; fps: number; timeOfDay: number; combo: number;
}

export interface HUDCallbacks {
  onOpenProgression?(tab:'talents'|'inventory'|'settings'|'base'|'codex'):void;
  onOpenMap?():void;
  onOpenForge?():void;
  onOpenCollection?():void;
  onOpenVip?():void;
  onOpenPass?():void;
  onClassChange(id: ClassId): void;
  onEquip(id: string): void;
  onUpgradeItem(id: string): void;
  onSellItem(id: string): void;
  onUpgradeBuilding(id: string): void;
  onStart(): void;
  onQualityChange?(quality: 'low' | 'high'): void;
  onResetSave?(): void;
  onSoundChange?(enabled: boolean): void;
}

type Panel = 'inventory' | 'classes' | 'base' | 'codex' | 'help';
const rarityNames: Record<string, string> = { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário', mythic: 'Mítico' };
const slotNames: Record<EquipmentSlot, string> = { weapon: 'Arma', helmet: 'Elmo', armor: 'Armadura', boots: 'Botas', ring: 'Anel', amulet: 'Amuleto',gloves:'Manoplas',belt:'Cinto' };
const stateNames: Record<HeroState, string> = { idle: 'Na vila', run: 'Explorando', jump: 'No ar', doubleJump: 'Salto duplo', fall: 'No ar', climb: 'Escalando', swim: 'Nadando', dive: 'Mergulhando', slide: 'Esquiva', mounted: 'Montado', dead: 'Retornando à vila' };
const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const icon = (name: string): string => {
  const paths: Record<string, string> = {
    sword: '<path d="m5 19 3-3m-3-3 6 6M8 16 18 6l1-3-3 1L6 14"/>',
    jump: '<path d="M7 13 12 5l5 8M12 5v14M5 19h14"/>',
    dash: '<path d="m13 4-7 9h6l-1 7 7-10h-6l1-6ZM3 7h4M2 17h4"/>',
    mount: '<path d="M5 19v-7l4-3 3 3h6l2-7-5-2-3 5M6 13h12v6M5 19H3m15 0h3M15 4l1-2"/>',
    bag: '<path d="M3 10V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v13H3V10Zm0 0h18M8 4v16m8-16v16M10 9h4v5h-4Z"/>',
    classes: '<path d="m12 2 8 4v7l-8 9-8-9V6l8-4ZM8 9l4 4 4-4M12 13v6"/>',
    base: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7M3 21h18"/>',
    codex: '<path d="M12 5C8 2 4 3 2 4v15c4-1 6-1 10 1 4-2 6-2 10-1V4c-3-1-7-2-10 1ZM12 5v15M5 7l4 1M15 8l4-1"/>',
    interact: '<path d="M8 4h8v16H8M4 12h11m-4-4 4 4-4 4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 3M12 17h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.sword}</svg>`;
};

export class MobileHUD {
  private readonly root: HTMLDivElement;
  private readonly abort = new AbortController();
  private readonly keys = new Set<string>();
  private input = emptyInput();
  private heldAttack = false;
  private heldDive = false;
  private confirmingReset = false;
  private quality: 'low' | 'high' = matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
  private joystick = { x: 0, y: 0 };
  private model?: HUDModel;
  private activePanel: Panel | null = null;
  private panelSignature = '';
  private started = false;
  private drawerOpen = false;
  private lastPaint = 0;
  private lastMap = 0;
  private damageNodes: HTMLElement[] = [];
  private toastNodes: HTMLElement[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private lookPosition = { x: 0, y: 0 };
  private joystickOrigin = { x: 0, y: 0 };
  private readonly el: Record<string, HTMLElement> = {};
  private readonly meters: VitalMeter[] = [];
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private animationId = 0;
  private animationTime = 0;
  private lastClass?: ClassId;
  private bossPhase = 0;
  private soundEnabled = true;
  private language:Language='pt';
  setLanguage(language:Language):void {
    if(this.language===language)return;
    this.language=language;this.lastClass=undefined;
    this.root.querySelectorAll<HTMLElement>('[data-hud-pt]').forEach(node=>{node.textContent=language==='pt'?node.dataset.hudPt!:node.dataset.hudEn!;});
    this.root.querySelector<HTMLElement>('[data-drawer-toggle]')?.setAttribute('aria-label',language==='pt'?'Abrir menu do aventureiro':'Open adventurer menu');
  }


  constructor(container: HTMLElement, private readonly callbacks: HUDCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'eterna-hud';
    this.root.innerHTML = `
      <div class="look-zone" data-ref="lookZone" aria-label="Arraste para mover a câmera"></div>
      <div class="move-zone" data-ref="moveZone" aria-label="Joystick: arraste para caminhar"><div class="joystick" data-ref="joystick"><span></span><i data-ref="joystickThumb"></i></div><span class="move-hint">MOVER</span></div>
      <header class="hud-top"><div class="hero-card"><div class="hero-crest" data-ref="crest"><div data-ref="classIcon">${classIcon('berserker')}</div><span data-ref="level">1</span></div><div class="hero-vitals"><div class="hero-name"><span data-ref="className">Berserker</span><small data-ref="state">Na vila</small></div><div class="vital-bar hp" data-ref="hpTrack" aria-label="Vida"><b class="vital-residual" data-ref="hpResidual"></b><i data-ref="hpFill"></i><span data-ref="hpText"></span></div><div class="vital-bar mana" data-ref="manaTrack" aria-label="Mana"><b class="vital-residual" data-ref="manaResidual"></b><i data-ref="manaFill"></i><span data-ref="manaText"></span></div><div class="xp-bar"><i data-ref="xpFill"></i></div></div></div>
      <div class="world-banner"><span class="overline">ETERNA</span><strong>Vale de Aster</strong><span data-ref="worldTime">AMANHECER</span></div>
      <div class="map-card"><div class="map-heading"><span>VALE DE ASTER</span><span class="map-north">N</span></div><canvas data-ref="minimap" width="260" height="220" aria-label="Minimapa em tempo real"></canvas><div class="map-footer"><span data-ref="coordinates">0, 18</span><span data-ref="fps">60 FPS</span></div></div></header>
      <section class="boss-hud" data-ref="bossPanel" hidden aria-label="Vida do chefe da masmorra"><div class="boss-title"><span class="boss-flourish" aria-hidden="true">◇</span><div><span class="boss-overline">GUARDIÃO ANCESTRAL</span><strong data-ref="bossName"></strong></div><span class="boss-flourish" aria-hidden="true">◇</span></div><div class="boss-health-track" data-ref="bossTrack" aria-label="Vida do chefe"><b class="vital-residual" data-ref="bossResidual"></b><i data-ref="bossFill"></i><div class="boss-segments" aria-hidden="true"></div></div><div class="boss-status"><span data-ref="bossPhase"></span><div class="boss-phase-marks" data-ref="bossPips" aria-hidden="true"><i></i><i></i><i></i></div><span data-ref="bossHealth"></span></div></section>
      <button class="sound-toggle" data-sound aria-label="Silenciar áudio" aria-pressed="false" title="Áudio procedural"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 9 4 0 5-4v14l-5-4H4V9Z"/><path class="sound-waves" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-slash" d="m16 9 6 6m0-6-6 6"/></svg><span data-ref="soundLabel">SOM</span></button>
      <aside class="quest-card"><div class="quest-label"><span class="quest-diamond"></span> A JORNADA COMEÇA</div><strong data-ref="questTitle">Além dos portões</strong><p data-ref="questText">Explore o vale. Derrote criaturas e encontre o portal ao norte.</p><div class="quest-progress" data-ref="dungeonStatus"></div></aside>
      <div class="resource-bar"><span class="gold-dot"></span><span data-ref="gold">0</span><span class="crystal-dot"></span><span data-ref="crystals">0</span><span class="save-indicator" title="Progresso salvo automaticamente neste dispositivo">AUTO SAVE</span></div>
      <nav class="menu-dock" aria-label="Menus do aventureiro">
        <button class="hud-vip-shortcut" data-drawer-action="vip" title="VIP" aria-label="VIP"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 10 7 7 5-12 5 12 7-7-4 17H8Z" fill="#d8b968" stroke="#ffebac"/><path d="M9 23h14" stroke="#735020" stroke-width="2"/><circle cx="16" cy="21" r="2.5" fill="#b87cff"/></svg><span>VIP</span></button>
        <button class="hud-pass-shortcut" data-drawer-action="pass" title="Passe de Batalha / Battle Pass" aria-label="Passe de Batalha / Battle Pass"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 4h17v22H8L5 23V7Z" fill="#dbc392" stroke="#ffe7ac"/><path d="M9 4v19l-4 1m4-14h12m-12 4h12m-12 4h7" fill="none" stroke="#77562d"/><path d="m23 15 2 4 4 1-3 3 1 5-4-2-4 2 1-5-3-3 4-1Z" fill="#9473c5" stroke="#ddc3ff"/></svg><span data-hud-pt="Passe" data-hud-en="Pass">Passe</span></button>
        <button class="hud-menu-toggle" data-drawer-toggle data-hud-menu aria-controls="adventurer-drawer" aria-expanded="false" aria-label="Abrir menu do aventureiro" title="Menu"><svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h18M5 14h18M5 21h18"/><circle cx="9" cy="7" r="2" fill="#13212e"/><circle cx="19" cy="14" r="2" fill="#13212e"/><circle cx="11" cy="21" r="2" fill="#13212e"/></svg><span>Menu</span></button>
        <section class="hud-drawer" id="adventurer-drawer" aria-label="Atalhos do aventureiro" hidden>
          <header><span data-hud-pt="SEU AVENTUREIRO" data-hud-en="YOUR ADVENTURER">SEU AVENTUREIRO</span><button data-drawer-close aria-label="Fechar menu / Close menu">×</button></header>
          <div class="hud-drawer-primary">
            <button data-panel="inventory">${itemIcon('chest','legendary')}<span data-hud-pt="Bolsa / Inventário" data-hud-en="Bag / Inventory">Bolsa / Inventário</span><kbd>I</kbd></button>
            <button data-drawer-action="forge">${itemIcon('axe','legendary')}<span data-hud-pt="Ferreiro / Forja & Sockets" data-hud-en="Blacksmith / Forge & Sockets">Ferreiro / Forja & Sockets</span></button>
            <button data-drawer-action="collection">${itemIcon('skin','epic')}<span data-hud-pt="Asas & Coleção" data-hud-en="Wings & Collection">Asas & Coleção</span></button>
          </div>
          <div class="hud-drawer-secondary">
            <button data-panel="classes">${icon('classes')}<span data-hud-pt="Classes" data-hud-en="Classes">Classes</span><kbd>C</kbd></button>
            <button data-panel="base">${icon('base')}<span data-hud-pt="Construções" data-hud-en="Buildings">Construções</span><kbd>B</kbd></button>
            <button data-panel="codex">${icon('codex')}<span>Codex</span><kbd>K</kbd></button>
            <button data-panel="help">${icon('help')}<span data-hud-pt="Configurações" data-hud-en="Settings">Configurações</span></button>
          </div>
        </section>
      </nav>
      <button class="dive-action action-button" data-action="dive" data-ref="diveButton" aria-label="Segure para mergulhar na água">↓<small>Mergulhar</small></button>
      <div class="interaction-hint" data-ref="interactionHint"><button data-action="interact">${icon('interact')}<span>Interagir</span><kbd>E</kbd></button></div>
      <div class="combat-controls"><div class="skills-row">${[0, 1, 2, 3].map(i => `<button class="skill-button" data-skill="${i}" data-ref="skill${i}" aria-label="Habilidade ${i + 1}"><span class="skill-glyph" data-ref="skillIcon${i}">${skillIcon(CLASS_DEFINITIONS.berserker.skills[i].id)}</span><span class="cooldown-number" data-ref="cooldown${i}"></span><small data-ref="skillName${i}"></small><kbd>${i + 1}</kbd></button>`).join('')}</div><div class="movement-actions"><button class="action-button mount-action" data-action="mount" data-ref="mountButton" aria-label="Invocar montaria (M)">${icon('mount')}<small>Montaria</small><kbd>M</kbd></button><button class="action-button" data-action="dash" aria-label="Deslizar (Shift)">${icon('dash')}<small>Esquiva</small><kbd>⇧</kbd></button><button class="action-button" data-action="jump" aria-label="Pular / duplo pulo (Espaço)">${icon('jump')}<small>Pular</small><kbd>␣</kbd></button><button class="attack-button" data-action="attack" aria-label="Atacar (J)">${icon('sword')}<small>ATACAR</small><kbd>J</kbd></button></div></div>
      <div class="combo-label" data-ref="combo"></div><div class="screen-vignette" data-ref="vignette"></div>
      <div class="damage-layer" data-ref="damageLayer" aria-hidden="true"></div><div class="toast-stack" data-ref="toasts" role="status" aria-live="polite"></div>
      <div class="modal-backdrop" data-ref="modal" hidden><section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><span class="overline" data-ref="modalSubtitle">SEU AVENTUREIRO</span><h1 id="modal-title" data-ref="modalTitle"></h1></div><button class="close-button" data-close aria-label="Fechar janela">×</button></header><div class="modal-body" data-ref="modalBody"></div></section></div>
      <section class="start-screen" data-ref="startScreen"><div class="start-topline"><span class="brand-mark">E<span>✦</span></span><span>UM NOVO MUNDO PARA EXPLORAR</span></div><div class="start-content"><div class="start-eyebrow"><span></span> A SAGA DOS NOVE <span></span></div><h1>ETERNA</h1><div class="start-subtitle">N I N E F O L D</div><p>Uma terra ancestral. Nove caminhos.<br>Uma lenda que só você pode escrever.</p><button class="start-button" data-start>INICIAR JORNADA <span>→</span></button><a class="apk-download" href="/EternalHero-MMO-debug.apk" download>↓ Baixar APK Android</a><div class="start-details"><span>9 CLASSES</span><i></i><span>MUNDO ABERTO</span><i></i><span>PROGRESSO LOCAL</span></div></div><div class="start-bottom"><div class="quality-choice"><label for="start-quality">QUALIDADE</label><select id="start-quality" data-quality><option value="high">Alta · efeitos completos</option><option value="low">Leve · recomendado para celular</option></select></div><p><span class="desktop-copy">WASD para explorar · Arraste para olhar · J para atacar</span><span class="touch-copy">Joystick para explorar · Arraste à direita para olhar</span><br>Jogo individual • Sem conta • Salvamento neste dispositivo<br><span class="touch-copy">No celular, gire a tela para ampliar sua visão.</span></p><button data-panel="help">CONTROLES ${icon('help')}</button></div></section>`;
    const movement=this.root.querySelector<HTMLElement>('.movement-actions')!;
    const attack=movement.querySelector<HTMLElement>('.attack-button')!;
    this.root.querySelector('.combat-controls')!.append(attack,this.root.querySelector('.combo-label')!);this.root.append(movement);
    const minimap=this.root.querySelector<HTMLElement>('.map-card')!;minimap.setAttribute('role','button');minimap.tabIndex=0;minimap.setAttribute('aria-label','Abrir mapa mundi / Open world map');
    minimap.addEventListener('click',()=>{this.clearInput();this.callbacks.onOpenMap?.();});
    minimap.addEventListener('keydown',event=>{if(event.code==='Enter'||event.code==='Space'){event.preventDefault();event.stopPropagation();this.clearInput();this.callbacks.onOpenMap?.();}});
    container.append(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-ref]').forEach(node => this.el[node.dataset.ref!] = node);
    this.root.querySelectorAll<HTMLSelectElement>('[data-quality]').forEach(select => select.value = this.quality);
    const reduce = (): boolean => this.reducedMotion.matches;
    this.meters.push(
      new VitalMeter(this.el.hpFill, this.el.hpResidual, this.el.hpTrack, reduce),
      new VitalMeter(this.el.manaFill, this.el.manaResidual, this.el.manaTrack, reduce),
      new VitalMeter(this.el.bossFill, this.el.bossResidual, this.el.bossTrack, reduce),
    );
    this.animationId = requestAnimationFrame(this.animateMeters);
    this.bindEvents();
    this.bindJoystick();
    this.bindCamera();
  }

  private later(fn: () => void, ms: number): void {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms);
    this.timers.add(timer);
  }

  private bindEvents(): void {
    const opts = { signal: this.abort.signal };
    this.root.addEventListener('click', event => {
      const target = (event.target as Element).closest<HTMLElement>('button, select');
      if (!target) return;
      if (target.hasAttribute('data-start')) {
        this.started = true;
        this.el.startScreen.hidden = true;
        this.root.classList.add('is-playing');
        this.callbacks.onStart();
        this.notify('Sua jornada começou. Explore o vale ao norte da vila.', 'success');
      } else if (target.hasAttribute('data-sound')) {
        this.soundEnabled = !this.soundEnabled;
        this.root.classList.toggle('sound-muted', !this.soundEnabled);
        target.setAttribute('aria-pressed', `${!this.soundEnabled}`);
        target.setAttribute('aria-label', this.soundEnabled ? 'Silenciar áudio' : 'Ativar áudio');
        this.el.soundLabel.textContent = this.soundEnabled ? 'SOM' : 'MUDO';
        this.callbacks.onSoundChange?.(this.soundEnabled);
      } else if (target.hasAttribute('data-drawer-toggle')) this.setDrawerOpen(!this.drawerOpen);
      else if(target.hasAttribute('data-drawer-close'))this.setDrawerOpen(false);
      else if(target.dataset.drawerAction){
        this.setDrawerOpen(false);this.clearInput();
        const action=target.dataset.drawerAction;
        if(action==='forge')this.callbacks.onOpenForge?.();
        else if(action==='collection')this.callbacks.onOpenCollection?.();
        else if(action==='vip')this.callbacks.onOpenVip?.();
        else if(action==='pass')this.callbacks.onOpenPass?.();
      } else if (target.hasAttribute('data-close')) this.closePanel();
      else if (target.dataset.panel) this.openPanel(target.dataset.panel as Panel);
      else if (target.dataset.class) this.callbacks.onClassChange(target.dataset.class as ClassId);
      else if (target.dataset.equip) this.callbacks.onEquip(target.dataset.equip);
      else if (target.dataset.upgrade) this.callbacks.onUpgradeItem(target.dataset.upgrade);
      else if (target.dataset.sell) this.callbacks.onSellItem(target.dataset.sell);
      else if (target.dataset.building) this.callbacks.onUpgradeBuilding(target.dataset.building);
      else if (target.hasAttribute('data-reset')) this.showResetConfirmation();
      else if (target.hasAttribute('data-confirm-reset')) { this.callbacks.onResetSave?.(); this.closePanel(); }
      else if (target.hasAttribute('data-cancel-reset')) { this.confirmingReset = false; this.panelSignature = ''; this.renderPanel(); }
      else if (event.detail === 0 && this.started && !this.activePanel) {
        if (target.dataset.action === 'attack') this.input.attack = true;
        else if (target.dataset.action === 'dive') this.input.dive = true;
        else if (target.dataset.action) this.input[target.dataset.action as 'jump' | 'dash' | 'mount' | 'interact'] = true;
        else if (target.dataset.skill) this.input.skill = Number(target.dataset.skill);
      }
    }, opts);
    this.root.addEventListener('change', event => {
      const target = event.target as HTMLSelectElement;
      if (target.hasAttribute('data-quality')) {
        this.quality = target.value as 'high' | 'low';
        this.root.querySelectorAll<HTMLSelectElement>('[data-quality]').forEach(select => select.value = this.quality);
        this.callbacks.onQualityChange?.(this.quality);
      }
    }, opts);
    this.el.modal.addEventListener('pointerdown', event => { if (event.target === this.el.modal) this.closePanel(); }, opts);
    this.root.querySelectorAll<HTMLButtonElement>('[data-action], [data-skill]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        if (this.blocking) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        button.classList.add('is-pressed');
        if (button.dataset.action === 'attack') this.heldAttack = true;
        else if (button.dataset.action === 'dive') this.heldDive = true;
        else if (button.dataset.action) this.input[button.dataset.action as 'jump' | 'dash' | 'mount' | 'interact'] = true;
        else if (button.dataset.skill) this.input.skill = Number(button.dataset.skill);
      }, opts);
      const release = (): void => { button.classList.remove('is-pressed'); if (button.dataset.action === 'attack') this.heldAttack = false; if (button.dataset.action === 'dive') this.heldDive = false; };
      button.addEventListener('pointerup', release, opts);
      button.addEventListener('pointercancel', release, opts);
      button.addEventListener('lostpointercapture', release, opts);
    });
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const code = event.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code) && this.started) {
        if (code !== 'Tab') event.preventDefault();
      }
      if (code === 'Escape') {if(this.drawerOpen){this.setDrawerOpen(false);this.root.querySelector<HTMLButtonElement>('[data-drawer-toggle]')?.focus();}else this.closePanel();return;}
      if(this.drawerOpen&&code==='Tab'){
        const buttons=Array.from(this.root.querySelectorAll<HTMLButtonElement>('.menu-dock button:not([disabled])'));
        const first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}
        else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}
        return;
      }
      if (this.activePanel && code === 'Tab') { this.trapFocus(event); return; }
      if (!this.started) return;
      const panels: Record<string, Panel> = { KeyI: 'inventory', KeyC: 'classes', KeyB: 'base', KeyK: 'codex', KeyH: 'help' };
      if (panels[code] && !event.repeat) { this.activePanel === panels[code] ? this.closePanel() : this.openPanel(panels[code]); return; }
      if (this.drawerOpen) return;
      if (this.activePanel) {
        if (code === 'Tab') this.trapFocus(event);
        return;
      }
      this.keys.add(code);
      if (event.repeat) return;
      if (code === 'Space') this.input.jump = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.dash = true;
      if (code === 'KeyM') this.input.mount = true;
      if (code === 'KeyE') this.input.interact = true;
      if (/^Digit[1-4]$/.test(code)) this.input.skill = Number(code.slice(-1)) - 1;
    }, opts);
    window.addEventListener('keyup', event => { this.keys.delete(event.code); }, opts);
    window.addEventListener('blur', () => this.clearInput(), opts);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearInput(); }, opts);
    this.root.addEventListener('contextmenu', event => event.preventDefault(), opts);
    document.addEventListener('pointerdown',event=>{
      if(this.drawerOpen&&!(event.target as Element).closest('.menu-dock')){
        this.setDrawerOpen(false);event.preventDefault();event.stopPropagation();
      }
    },{capture:true,signal:this.abort.signal});
    this.root.querySelector('.hud-drawer')!.addEventListener('click',event=>{
      if((event.target as Element).closest('button'))this.setDrawerOpen(false);
    },opts);
  }

  private bindJoystick(): void {
    const zone = this.el.moveZone;
    const stick = this.el.joystick;
    const opts = { signal: this.abort.signal };
    zone.addEventListener('pointerdown', event => {
      if (this.blocking || this.movePointer !== null) return;
      event.preventDefault();
      zone.setPointerCapture(event.pointerId);
      this.movePointer = event.pointerId;
      this.joystickOrigin = { x: event.clientX, y: event.clientY };
      const rect = zone.getBoundingClientRect();
      const uiScale=rect.width/Math.max(1,zone.offsetWidth);
      stick.style.left = `${(event.clientX - rect.left)/uiScale}px`;
      stick.style.top = `${(event.clientY - rect.top)/uiScale}px`;
      stick.classList.add('active');
    }, opts);
    zone.addEventListener('pointermove', event => {
      if (event.pointerId !== this.movePointer) return;
      const uiScale=zone.getBoundingClientRect().width/Math.max(1,zone.offsetWidth);
      const dx = (event.clientX - this.joystickOrigin.x)/uiScale;
      const dy = (event.clientY - this.joystickOrigin.y)/uiScale;
      const length = Math.hypot(dx, dy);
      const radius = 44;
      const scale = length > radius ? radius / length : 1;
      this.joystick.x = dx * scale / radius;
      this.joystick.y = -dy * scale / radius;
      this.el.joystickThumb.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
    }, opts);
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.joystick = { x: 0, y: 0 };
      this.el.joystickThumb.style.transform = '';
      stick.style.left = '';
      stick.style.top = '';
      stick.classList.remove('active');
    };
    zone.addEventListener('pointerup', release, opts);
    zone.addEventListener('pointercancel', release, opts);
    zone.addEventListener('lostpointercapture', release, opts);
  }

  private bindCamera(): void {
    const zone = this.el.lookZone;
    const opts = { signal: this.abort.signal };
    zone.addEventListener('pointerdown', event => {
      if (this.blocking || this.lookPointer !== null) return;
      event.preventDefault();
      zone.setPointerCapture(event.pointerId);
      this.lookPointer = event.pointerId;
      this.lookPosition = { x: event.clientX, y: event.clientY };
      zone.classList.add('dragging');
    }, opts);
    zone.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointer) return;
      this.input.look.x += (event.clientX - this.lookPosition.x) * 0.004;
      this.input.look.y += (event.clientY - this.lookPosition.y) * 0.004;
      this.lookPosition = { x: event.clientX, y: event.clientY };
    }, opts);
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.lookPointer) { this.lookPointer = null; zone.classList.remove('dragging'); }
    };
    zone.addEventListener('pointerup', release, opts);
    zone.addEventListener('pointercancel', release, opts);
    zone.addEventListener('lostpointercapture', release, opts);
  }

  resetInput():void {this.clearInput();}
  private clearInput(): void {
    this.keys.clear();
    this.input = emptyInput();
    this.heldAttack = false;
    this.heldDive = false;
    this.joystick = { x: 0, y: 0 };
    this.movePointer = this.lookPointer = null;
    this.el.joystick.classList.remove('active');
    this.el.joystickThumb.style.transform = '';
  }

  readInput(): HeroInput {
    if (this.blocking) { this.input = emptyInput(); return emptyInput(); }
    const result = this.input;
    let x = this.joystick.x + Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    let y = this.joystick.y + Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    result.move = { x, y };
    result.attack = result.attack || this.heldAttack || this.keys.has('KeyJ');
    result.dive = result.dive || this.heldDive || this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    this.input = emptyInput();
    return result;
  }

  update(model: HUDModel): void {
    this.model = model;
    const now = performance.now();
    if (now - this.lastMap > 80) { this.drawMinimap(model); this.lastMap = now; }
    if (now - this.lastPaint < 90) return;
    this.lastPaint = now;
    const setText = (key: string, value: string): void => { if (this.el[key].textContent !== value) this.el[key].textContent = value; };
    const percentage = (value: number, max: number): string => `${clamp(max > 0 ? value / max : 0, 0, 1) * 100}%`;
    const definition = CLASS_DEFINITIONS[model.classId];
    const className = definition.name;
    setText('className', className);
    setText('level', `${model.level}`);
    setText('state', translateText(stateNames[model.state],this.language));
    this.el.crest.style.setProperty('--class-color', `#${definition.color.toString(16).padStart(6, '0')}`);
    if (model.classId !== this.lastClass) {
      this.lastClass = model.classId;
      this.el.classIcon.innerHTML = classIcon(model.classId);
      definition.skills.forEach((skill, index) => {
        this.el[`skillIcon${index}`].innerHTML = skillIcon(skill.id);
        this.el[`skill${index}`].dataset.skillTooltip=translateText(skill.name,this.language);
        this.el[`skill${index}`].title = `${translateText(skill.name,this.language)} · ${skill.mana} mana · ${skill.cooldown}s\n${translateText(skill.description,this.language)}`;
      });
    }
    this.meters[0].set(model.hp, model.maxHp, now);
    this.meters[1].set(model.mana, model.maxMana, now);
    this.updateBoss(model, now);
    this.el.xpFill.style.width = percentage(model.xp, model.xpToNext);
    setText('hpText', `${Math.ceil(model.hp)} / ${Math.ceil(model.maxHp)}`);
    setText('manaText', `${Math.floor(model.mana)} / ${Math.ceil(model.maxMana)}`);
    setText('gold', Math.floor(model.gold).toLocaleString('pt-BR'));
    setText('crystals', Math.floor(model.crystals).toLocaleString('pt-BR'));
    setText('fps', `${Math.round(model.fps)} FPS`);
    setText('coordinates', `${Math.round(model.player.x)}, ${Math.round(model.player.z)}`);
    const hour = ((model.timeOfDay % 1) + 1) % 1 * 24;
    setText('worldTime', hour < 6 ? 'SOB AS ESTRELAS' : hour < 10 ? 'AMANHECER' : hour < 17 ? 'LUZ DO DIA' : hour < 20 ? 'ENTARDECER' : 'SOB AS ESTRELAS');
    setText('combo', model.combo > 1 ? `${model.combo} × COMBO` : '');
    this.el.vignette.style.opacity = `${model.hp > 0 && model.hp / model.maxHp < 0.25 ? 0.7 : 0}`;
    this.el.mountButton.classList.toggle('selected', model.mounted);
    this.el.diveButton.classList.toggle('visible', model.state === 'swim' || model.state === 'dive');
    const nearPortal = Math.hypot(model.player.x, model.player.z + 70) < 14;
    this.el.interactionHint.classList.toggle('visible', nearPortal);
    setText('questTitle', model.dungeon.active ? `${this.language==='pt'?'Masmorra · Andar':'Dungeon · Floor'} ${model.dungeon.floor??1}/${model.dungeon.maxFloors??3} · ${this.language==='pt'?'Onda':'Wave'} ${model.dungeon.wave}` : 'Além dos portões');
    setText('questText', model.dungeon.active ? 'Sobreviva às ondas. Evite as áreas vermelhas do Guardião.' : nearPortal ? 'O portal desperta. Toque em Interagir para começar o desafio.' : 'Explore o vale. Derrote criaturas e encontre o portal ao norte.');
    setText('dungeonStatus', model.dungeon.status || 'NORTE ↑  PORTAL ANCESTRAL');
    for (let i = 0; i < 4; i++) {
      const cooldown = Math.max(0, model.cooldowns[i] ?? 0);
      const maximum = Math.max(0.001, model.cooldownMax[i] ?? definition.skills[i]?.cooldown ?? 1);
      const button = this.el[`skill${i}`];
      button.style.setProperty('--cooldown', `${clamp(cooldown / maximum, 0, 1) * 100}%`);
      button.classList.toggle('cooling', cooldown > 0);
      button.classList.toggle('no-mana', (definition.skills[i]?.mana ?? 0) > model.mana);
      button.setAttribute('aria-label', `${definition.skills[i]?.name ?? `Habilidade ${i + 1}`}${cooldown > 0 ? `, recarga ${Math.ceil(cooldown)} segundos` : ''}`);
      setText(`cooldown${i}`, cooldown > 0 ? `${Math.ceil(cooldown)}` : '');
      setText(`skillName${i}`, translateText(definition.skills[i]?.name ?? '',this.language));
      button.style.setProperty('--skill-color', `#${(definition.skills[i]?.color ?? definition.color).toString(16).padStart(6, '0')}`);
    }
    if (this.activePanel) this.renderPanel();
  }

  private readonly animateMeters = (now: number): void => {
    const dt = this.animationTime ? Math.min(0.05, (now - this.animationTime) / 1000) : 1 / 60;
    this.animationTime = now;
    this.meters.forEach(meter => meter.tick(dt, now));
    this.animationId = requestAnimationFrame(this.animateMeters);
  };

  private updateBoss(model: HUDModel, now: number): void {
    const boss = model.boss;
    const visible = Boolean(boss && boss.hp > 0 && model.dungeon.active);
    this.el.bossPanel.hidden = !visible;
    this.root.classList.toggle('boss-encounter', visible);
    if (!visible || !boss) {
      this.bossPhase = 0;
      return;
    }
    this.el.bossName.textContent = boss.name;
    const phase = clamp(Math.round(boss.phase), 1, 3);
    this.el.bossPhase.textContent = `FASE ${phase} · ${['VIGÍLIA', 'FÚRIA', 'CATACLISMO'][phase - 1]}`;
    this.el.bossHealth.textContent = `${Math.ceil(boss.hp).toLocaleString('pt-BR')} / ${Math.ceil(boss.maxHp).toLocaleString('pt-BR')}`;
    this.el.bossPips.querySelectorAll('i').forEach((node, index) => {
      node.classList.toggle('active', index < phase);
    });
    this.el.bossPanel.style.setProperty('--boss-phase', `${phase}`);
    if (this.bossPhase !== phase) {
      this.el.bossPanel.classList.remove('phase-change');
      // Restart the brief phase flourish without layout reads.
      this.later(() => this.el.bossPanel.classList.add('phase-change'), 0);
      this.bossPhase = phase;
    }
    this.meters[2].set(boss.hp, boss.maxHp, now);
  }

  private drawMinimap(model: HUDModel): void {
    const canvas = this.el.minimap as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
    gradient.addColorStop(0, '#183533'); gradient.addColorStop(1, '#0b191e');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const scale = 1.15;
    const project = (x: number, z: number): [number, number] => [w / 2 + (x - model.player.x) * scale, h / 2 + (z - model.player.z) * scale];
    ctx.strokeStyle = 'rgba(128,183,159,.08)'; ctx.lineWidth = 1;
    for (let i = -160; i <= 160; i += 20) {
      const [x, z] = project(i, i);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.moveTo(0, z); ctx.lineTo(w, z); ctx.stroke();
    }
    ctx.strokeStyle = '#355b4e'; ctx.lineWidth = 8;
    ctx.beginPath(); let p = project(0, 30); ctx.moveTo(...p); p = project(0, -70); ctx.lineTo(...p); ctx.stroke();
    ctx.strokeStyle = '#54715a'; ctx.lineWidth = 2;
    ctx.beginPath(); p = project(-18, 18); ctx.moveTo(...p); p = project(18, 18); ctx.lineTo(...p); ctx.stroke();
    ctx.fillStyle = 'rgba(100,154,125,.08)'; p = project(0, 18); ctx.beginPath(); ctx.arc(...p, 30 * scale, 0, Math.PI * 2); ctx.fill();
    for (const marker of model.markers) {
      const [x, y] = project(marker.x, marker.z);
      if (x < 8 || x > w - 8 || y < 8 || y > h - 8) continue;
      ctx.fillStyle = marker.color;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
      ctx.fillStyle = '#ccd8cb'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(translateText(marker.label,this.language), x, y + 15);
    }
    for (const enemy of model.enemies) {
      const [x, y] = project(enemy.x, enemy.z);
      if (x < 3 || y < 3 || x > w - 3 || y > h - 3) continue;
      ctx.beginPath(); ctx.fillStyle = enemy.boss ? '#ffb365' : '#d66c62'; ctx.arc(x, y, enemy.boss ? 4.5 : 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI - model.player.heading);
    ctx.shadowColor = '#c7f9e7'; ctx.shadowBlur = 9; ctx.fillStyle = '#dcf9ea';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  get blocking(): boolean { return !this.started || this.activePanel !== null || this.drawerOpen; }

  /** Extension shortcuts remain inside the drawer and keep their own action handlers. */
  registerShortcut(button:HTMLButtonElement):void {
    button.type='button';
    this.root.querySelector('.hud-drawer-primary')!.append(button);
  }

  private setDrawerOpen(open:boolean):void {
    this.drawerOpen=open;this.clearInput();
    const drawer=this.root.querySelector<HTMLElement>('.hud-drawer')!;drawer.hidden=!open;
    this.root.querySelector('[data-drawer-toggle]')!.setAttribute('aria-expanded',String(open));
    this.root.classList.toggle('drawer-open',open);
    if(open){
      drawer.style.translate='none';
      const dock=this.root.querySelector<HTMLElement>('.menu-dock')!,scale=dock.getBoundingClientRect().width/Math.max(1,dock.offsetWidth);
      drawer.style.maxHeight=`${Math.max(100,(innerHeight-24)/scale)}px`;
      const rect=drawer.getBoundingClientRect();
      const dx=Math.max(8-rect.left,Math.min(0,innerWidth-8-rect.right));
      const dy=Math.max(8-rect.top,Math.min(0,innerHeight-8-rect.bottom));
      drawer.style.translate=`${dx/scale}px ${dy/scale}px`;
    }
  }

  openPanel(panel: Panel): void {
    this.setDrawerOpen(false);
    if(this.callbacks.onOpenProgression) {
      this.clearInput();this.callbacks.onOpenProgression(panel==='classes'?'talents':panel==='help'?'settings':panel);return;
    }
    this.clearInput();
    this.activePanel = panel;
    this.confirmingReset = false;
    this.panelSignature = '';
    this.el.modal.hidden = false;
    this.root.classList.add('has-modal');
    this.renderPanel();
    this.el.modal.querySelector<HTMLButtonElement>('[data-close]')?.focus({ preventScroll: true });
  }

  private closePanel(): void {
    this.activePanel = null;
    this.confirmingReset = false;
    this.el.modal.hidden = true;
    this.root.classList.remove('has-modal');
    this.panelSignature = '';
    this.clearInput();
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = Array.from(this.el.modal.querySelectorAll<HTMLElement>('button:not([disabled]), select, a[href], [tabindex="0"]'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
  }

  private renderPanel(): void {
    const panel = this.activePanel;
    if (!panel || this.confirmingReset) return;
    const m = this.model;
    const signature = JSON.stringify(panel === 'inventory' ? [m?.gold, m?.crystals, m?.items, m?.equipment] : panel === 'classes' ? [m?.classId] : panel === 'base' ? [m?.gold, m?.crystals, m?.buildings] : panel === 'codex' ? m?.codex : 'help');
    if (signature === this.panelSignature) return;
    this.panelSignature = signature;
    const titles: Record<Panel, [string, string]> = { inventory: ['SEU ARSENAL', 'Inventário'], classes: ['NOVE CAMINHOS · UM HERÓI', 'Escolha sua classe'], base: ['VILA DE ASTER', 'Construa seu legado'], codex: ['REGISTROS DO VALE', 'Codex de criaturas'], help: ['PREPARE SUA JORNADA', 'Guia do aventureiro'] };
    this.el.modalSubtitle.textContent = titles[panel][0];
    this.el.modalTitle.textContent = titles[panel][1];
    if (!m && panel !== 'help' && panel !== 'classes') { this.el.modalBody.innerHTML = '<p class="empty-state">Inicie sua jornada para acessar seu aventureiro.</p>'; return; }
    if (panel === 'classes') this.renderClasses(m);
    else if (panel === 'inventory' && m) this.renderInventory(m);
    else if (panel === 'base' && m) this.renderBase(m);
    else if (panel === 'codex' && m) this.renderCodex(m);
    else this.renderHelp();
    this.root.querySelectorAll<HTMLSelectElement>('[data-quality]').forEach(select => select.value = this.quality);
  }

  private renderClasses(model?: HUDModel): void {
    this.el.modalBody.innerHTML = `<p class="panel-intro">Troque seu estilo de combate a qualquer momento. Equipamentos e progresso acompanham você.</p><div class="class-grid">${CLASS_IDS.map(id => {
      const c = CLASS_DEFINITIONS[id];
      const active = model?.classId === id;
      return `<article class="class-card ${active ? 'active' : ''}" style="--accent:#${c.color.toString(16).padStart(6, '0')}"><div class="class-card-top"><span class="class-sigil">${classIcon(id)}</span><span class="class-selected">${active ? 'EM USO' : 'CLASSE'}</span></div><h2>${esc(c.name)}</h2><p>${esc(c.description)}</p><div class="class-stats"><span>ATQ <b>${c.stats.attack}</b></span><span>DEF <b>${c.stats.defense}</b></span><span>HP <b>${c.stats.maxHp}</b></span></div><div class="class-skills">${c.skills.map(s => `<span title="${esc(s.description)} · ${s.mana} mana · ${s.cooldown}s">${skillIcon(s.id)}${esc(s.name)}</span>`).join('')}</div><button class="outline-button" data-class="${id}" ${active ? 'disabled' : ''}>${active ? 'Classe selecionada' : 'Escolher caminho'}</button></article>`;
    }).join('')}</div>`;
  }

  private renderInventory(model: HUDModel): void {
    const equipped = new Set(Object.values(model.equipment));
    const sorted = [...model.items].sort((a, b) => Number(equipped.has(b.id)) - Number(equipped.has(a.id)) || b.level - a.level);
    this.el.modalBody.innerHTML = `<div class="panel-summary"><span>${model.items.length} equipamentos</span><span class="gold-text">${Math.floor(model.gold).toLocaleString('pt-BR')} ouro</span><span class="crystal-text">${Math.floor(model.crystals)} cristais</span></div><p class="panel-intro">Equipe itens para receber atributos. A Forja aprimora equipamentos com ouro e cristais; venda peças que não usa.</p><div class="equipment-strip">${(Object.keys(slotNames) as EquipmentSlot[]).map(slot => { const item = model.items.find(i => i.id === model.equipment[slot]); return `<div><small>${slotNames[slot]}</small><strong class="rarity-${item?.rarity ?? 'common'}">${item ? esc(item.name) : 'Sem equipamento'}</strong></div>`; }).join('')}</div><div class="item-grid">${sorted.length ? sorted.map(item => {
      const active = equipped.has(item.id);
      return `<article class="item-card rarity-${item.rarity}"><div class="item-card-heading"><span class="item-emblem">${item.slot === 'weapon' ? icon('sword') : icon('classes')}</span><div><small>${rarityNames[item.rarity]} · ${slotNames[item.slot]} · Nv. ${item.level}</small><h2>${esc(item.name)}${item.upgrade ? ` <b>+${item.upgrade}</b>` : ''}</h2></div>${active ? '<span class="equipped-tag">EQUIPADO</span>' : ''}</div><div class="item-stats"><span>ATQ <b>+${item.attack}</b></span><span>DEF <b>+${item.defense}</b></span><span>HP <b>+${item.maxHp}</b></span></div><div class="item-actions"><button data-equip="${esc(item.id)}" ${active ? 'disabled' : ''}>${active ? 'Em uso' : 'Equipar'}</button><button data-upgrade="${esc(item.id)}">Forjar +${item.upgrade + 1}</button><button data-sell="${esc(item.id)}" ${active ? 'disabled' : ''} title="Vender por ${item.value} ouro">Vender</button></div></article>`;
    }).join('') : '<p class="empty-state">Derrote criaturas para encontrar seus primeiros equipamentos.</p>'}</div>`;
  }

  private renderBase(model: HUDModel): void {
    this.el.modalBody.innerHTML = `<div class="panel-summary"><span>Melhorias permanentes</span><span class="gold-text">${Math.floor(model.gold).toLocaleString('pt-BR')} ouro</span><span class="crystal-text">${Math.floor(model.crystals)} cristais</span></div><p class="panel-intro">Invista na vila para produzir recursos enquanto joga e fortalecer seu herói. A produção para quando o jogo está fechado.</p><div class="building-grid">${model.buildings.map(b => {
      const maxed = b.level >= b.maxLevel;
      const affordable = model.gold >= b.cost.gold && model.crystals >= b.cost.crystals;
      return `<article class="building-card"><div class="building-art">${icon(b.id === 'stable' ? 'mount' : b.id === 'forge' ? 'sword' : 'base')}<span>${b.level}</span></div><div><span class="overline">NÍVEL ${b.level} / ${b.maxLevel}</span><h2>${esc(b.name)}</h2><p>${esc(b.description)}</p><div class="building-levels">${Array.from({ length: b.maxLevel }, (_, i) => `<i class="${i < b.level ? 'built' : ''}"></i>`).join('')}</div><button class="outline-button" data-building="${esc(b.id)}" ${maxed || !affordable ? 'disabled' : ''}>${maxed ? 'Nível máximo' : `Melhorar · ${b.cost.gold} ouro${b.cost.crystals ? ` + ${b.cost.crystals} cristais` : ''}`}</button>${!maxed && !affordable ? '<small class="cost-hint">Recursos insuficientes</small>' : ''}</div></article>`;
    }).join('')}</div>`;
  }

  private renderCodex(model: HUDModel): void {
    const completed = model.codex.filter(e => e.kills >= e.required).length;
    this.el.modalBody.innerHTML = `<div class="panel-summary"><span>${completed} / ${model.codex.length} coleções completas</span><span>O conhecimento é poder</span></div><p class="panel-intro">Cada criatura derrotada fica registrada. Complete coleções para receber bônus permanentes de atributos.</p><div class="codex-grid">${model.codex.map(e => {
      const done = e.kills >= e.required;
      return `<article class="codex-card ${done ? 'completed' : ''}"><div class="codex-symbol">${done ? '✦' : '◇'}</div><div><span class="overline">${done ? 'COLEÇÃO COMPLETA' : e.kills ? 'CRIATURA DESCOBERTA' : 'REGISTRO DO VALE'}</span><h2>${esc(e.name)}</h2><p>${esc(e.description)}</p><div class="codex-progress"><i style="width:${clamp(e.kills / e.required, 0, 1) * 100}%"></i></div><div class="codex-meta"><span>${e.kills} / ${e.required} derrotados</span><b>${esc(e.bonus)}</b></div></div></article>`;
    }).join('')}</div>`;
  }

  private renderHelp(): void {
    this.el.modalBody.innerHTML = `<div class="help-layout"><div><h2>O vale está à sua espera</h2><p class="panel-intro">Saia da vila e siga ao norte para encontrar criaturas, equipamentos e o Portal Ancestral. Seu companheiro luta ao seu lado e recolhe tesouros automaticamente.</p><dl class="control-list"><div><dt>Mover</dt><dd><kbd>W A S D</kbd> ou joystick esquerdo</dd></div><div><dt>Câmera</dt><dd>Arraste no lado direito da tela</dd></div><div><dt>Atacar / combo</dt><dd><kbd>J</kbd> ou segure Atacar</dd></div><div><dt>Habilidades</dt><dd><kbd>1 2 3 4</kbd> ou os quatro símbolos</dd></div><div><dt>Pulo / duplo pulo</dt><dd><kbd>Espaço</kbd> · toque novamente no ar</dd></div><div><dt>Deslizar / esquiva</dt><dd><kbd>Shift</kbd> · breve invulnerabilidade</dd></div><div><dt>Montaria</dt><dd><kbd>M</kbd> · invoque ou desmonte</dd></div><div><dt>Portal / interagir</dt><dd><kbd>E</kbd> ao se aproximar</dd></div><div><dt>Mergulhar</dt><dd><kbd>Ctrl</kbd> na água · pulo para subir</dd></div><div><dt>Escalar</dt><dd>Mova em direção a uma parede escalável</dd></div><div><dt>Menus</dt><dd><kbd>I</kbd> Itens · <kbd>C</kbd> Classes · <kbd>B</kbd> Base · <kbd>K</kbd> Codex</dd></div></dl></div><aside class="help-tips"><h2>Antes de partir</h2><p>Equipar itens, melhorar a base e completar o Codex aumenta seus atributos de combate.</p><p>As habilidades consomem mana e têm recargas independentes. Ela se recupera com o tempo.</p><p>Evite áreas vermelhas no chão durante o desafio do Guardião. Use esquivas para atravessar o perigo.</p><p>Seu progresso é salvo automaticamente apenas neste dispositivo e navegador. Não há conexão com outros jogadores.</p><label class="setting-row">Qualidade gráfica<select data-quality><option value="high">Alta · efeitos completos</option><option value="low">Leve · celular</option></select></label>${this.callbacks.onResetSave ? '<button class="danger-button" data-reset>Reiniciar progresso local</button>' : ''}</aside></div>`;
  }

  private showResetConfirmation(): void {
    this.confirmingReset = true;
    this.panelSignature = 'confirm-reset';
    this.activePanel = 'help';
    this.el.modalBody.innerHTML = '<div class="reset-confirm"><h2>Recomeçar sua jornada?</h2><p>Isso remove o herói, equipamentos, recursos, base e registros salvos neste dispositivo. Essa ação não pode ser desfeita.</p><div><button class="danger-button" data-confirm-reset>Apagar e recomeçar</button><button class="outline-button" data-cancel-reset>Manter meu progresso</button></div></div>';
  }

  showDamage(position: { x: number; y: number }, amount: number, critical: boolean, team: 'hero' | 'enemy'): void {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || amount <= 0) return;
    while (this.damageNodes.length >= 36) this.damageNodes.shift()?.remove();
    const node = document.createElement('span');
    node.className = `floating-damage ${critical ? 'critical' : ''} ${team === 'hero' ? 'hero-damage' : ''}`;
    node.textContent = `${critical ? '✦ ' : ''}${Math.round(amount)}`;
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
    node.style.setProperty('--drift', `${Math.random() * 44 - 22}px`);
    this.el.damageLayer.append(node);
    this.damageNodes.push(node);
    this.later(() => { node.remove(); const index = this.damageNodes.indexOf(node); if (index >= 0) this.damageNodes.splice(index, 1); }, 1150);
  }

  notify(text: string, tone: 'info' | 'success' | 'warning' = 'info'): void {
    if (!text) return;
    while (this.toastNodes.length >= 4) this.toastNodes.shift()?.remove();
    const node = document.createElement('div');
    node.className = `game-toast ${tone}`;
    const mark = document.createElement('span'); mark.textContent = tone === 'success' ? '✦' : tone === 'warning' ? '!' : '◇';
    const label = document.createElement('span'); label.textContent = text;
    node.append(mark, label);
    this.el.toasts.append(node);
    this.toastNodes.push(node);
    this.later(() => { node.classList.add('leaving'); this.later(() => { node.remove(); const index = this.toastNodes.indexOf(node); if (index >= 0) this.toastNodes.splice(index, 1); }, 250); }, 3700);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.abort.abort();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.clearInput();
    this.root.remove();
  }
}
