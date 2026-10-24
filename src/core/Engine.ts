import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BufferGeometry, Color,
  DepthTexture, Float32BufferAttribute, FogExp2, Group, HalfFloatType, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Points, PointsMaterial, Scene,
  SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AtmospherePass } from './AtmospherePass';
import { AtmosphericSky } from './AtmosphericSky';
import { SoundEngine } from './SoundEngine';
import { ClassId, emptyInput, EventBus, LootDrop } from './GameTypes';
import { OpenWorldGenerator } from '../world/OpenWorldGenerator';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroController } from '../player/HeroController';
import { CombatSystem } from '../combat/CombatSystem';
import { CLASS_DEFINITIONS } from '../combat/ClassSystem';
import { PetAndMountSystem } from '../companions/PetAndMountSystem';
import { InventoryAndLoot } from '../rpg/InventoryAndLoot';
import { BaseBuilding } from '../rpg/BaseBuilding';
import { CodexSystem } from '../rpg/CodexSystem';
import { EnemyAI } from '../enemies/EnemyAI';
import { DungeonBossManager } from '../enemies/DungeonBossManager';
import { MobileHUD } from '../ui/MobileHUD';

const SAVE_KEY = 'eterna-ninefold-save-v1';
const UP = new Vector3(0, 1, 0);

export class Engine {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(58, 1, 0.15, 320);
  readonly renderer: WebGLRenderer;
  readonly events = new EventBus();
  readonly terrain: OpenWorldGenerator;
  readonly physics: PhysicsWorld;
  readonly hero: HeroController;
  readonly combat: CombatSystem;
  readonly inventory: InventoryAndLoot;
  readonly base: BaseBuilding;
  readonly codex: CodexSystem;
  readonly enemies: EnemyAI;
  readonly dungeon: DungeonBossManager;
  readonly companions: PetAndMountSystem;
  readonly hud: MobileHUD;
  readonly drops: LootDrop[] = [];
  readonly sound = new SoundEngine();
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly smaa: SMAAPass;
  private readonly atmosphere: AtmospherePass;
  private readonly csm: CSM;
  private readonly hemisphere = new HemisphereLight(0xbadbe7, 0x434831, 2.1);
  private readonly sky: AtmosphericSky;
  private readonly stars: Points;
  private readonly dropMeshes = new Map<string, Group>();
  private readonly csmMaterials = new Set<MeshStandardMaterial>();
  private readonly disposers: Array<() => void> = [];
  private classId: ClassId = 'berserker';
  private playing = false;
  private running = false;
  private frameId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private timeOfDay = 0.28;
  private uiClock = 0;
  private saveClock = 0;
  private statClock = 1;
  private deadClock = 0;
  private fps = 60;
  private quality: 'low' | 'high' = 'high';
  private saveErrorReported = false;
  private readonly scratch = new Vector3();
  private previousBossPhase = 0;
  private contextLost = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Mundo 3D de Eterna');
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.container.replaceChildren(this.renderer.domElement);
    this.scene.fog = new FogExp2('#96babb', 0.0038);
    this.scene.add(this.hemisphere, new AmbientLight(0xc4d8e2, 0.28));

    const environment = new RoomEnvironment();
    const pmrem = new PMREMGenerator(this.renderer);
    const envTarget = pmrem.fromScene(environment, 0.07);
    this.scene.environment = envTarget.texture;
    this.scene.environmentIntensity = 0.48;
    environment.dispose();
    pmrem.dispose();
    this.disposers.push(() => envTarget.dispose());

    this.sky = new AtmosphericSky();
    this.scene.add(this.sky);
    const starVertices: number[] = [];
    for (let i = 0; i < 280; i++) {
      const phi = i * 2.399963, y = 0.1 + 0.9 * ((i + 0.5) / 280);
      const r = Math.sqrt(1 - y * y);
      starVertices.push(Math.cos(phi) * r * 270, y * 270, Math.sin(phi) * r * 270);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new Float32BufferAttribute(starVertices, 3));
    this.stars = new Points(starGeometry, new PointsMaterial({ color: 0xd4e8ff, size: 0.65, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    this.scene.add(this.stars);

    this.terrain = new OpenWorldGenerator(this.scene, 713);
    this.terrain.generate();
    this.physics = new PhysicsWorld(this.terrain);
    this.inventory = new InventoryAndLoot(this.events, 407);
    this.base = new BaseBuilding(this.inventory, this.events);
    this.codex = new CodexSystem(this.events);
    this.restore();
    this.hero = new HeroController(this.scene, this.camera, this.physics, this.events, CLASS_DEFINITIONS[this.classId]);
    this.hero.respawn(this.terrain.spawnPoint);
    this.hero.update(1 / 60, emptyInput());
    this.refreshStats();
    this.combat = new CombatSystem(this.scene, this.events);
    this.enemies = new EnemyAI(this.scene, this.physics, this.events);
    this.dungeon = new DungeonBossManager(this.scene, this.enemies, this.events, this.terrain.portalPosition);
    this.companions = new PetAndMountSystem(this.scene, this.hero, this.physics, this.events);
    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: 3, mode: 'practical',
      maxFar: 150, shadowMapSize: 2048, lightDirection: new Vector3(-0.5, -0.85, 0.3),
      lightIntensity: 2.9, shadowBias: -0.00012, lightMargin: 80,
    });
    this.csm.fade = true;
    this.installShadows();

    // Bloom thresholds above one require HDR storage. An 8-bit render target
    // would clamp emissive blades and fire before the bright-pass extraction.
    const target = new WebGLRenderTarget(1, 1, { depthBuffer: true, type: HalfFloatType });
    target.depthTexture = new DepthTexture(1, 1);
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.atmosphere = new AtmospherePass(this.camera);
    this.composer.addPass(this.atmosphere);
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.38, 0.5, 1.15);
    this.composer.addPass(this.bloom);
    // Three r186 SMAA operates on linear HDR, before the output transform.
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
    this.composer.addPass(new OutputPass());
    this.hud = new MobileHUD(this.container, {
      onStart: () => this.beginPlay(),
      onClassChange: id => this.changeClass(id),
      onEquip: id => { if (this.inventory.equip(id)) { this.refreshStats(); this.save(); } },
      onUpgradeItem: id => {
        if (this.hero.position.distanceTo(this.terrain.spawnPoint) > 28) {
          this.hud.notify('Volte à forja da vila para aprimorar equipamentos.', 'warning'); return;
        }
        if (this.inventory.upgrade(id)) { this.refreshStats(); this.save(); }
      },
      onSellItem: id => { if (this.inventory.sell(id)) this.save(); },
      onUpgradeBuilding: id => { if (this.base.upgrade(id)) { this.refreshStats(); this.save(); } },
      onQualityChange: quality => this.setQuality(quality),
      onSoundChange: enabled => this.sound.setEnabled(enabled),
      onResetSave: () => { localStorage.removeItem(SAVE_KEY); location.reload(); },
    });
    this.bindEvents();
    this.setQuality(matchMedia('(pointer:coarse)').matches ? 'low' : 'high');
    this.resize();
    this.updateHUD();
    const resize = () => this.resize();
    const persist = () => this.save();
    const visibility = () => { if (document.hidden) { this.save(); this.lastTime = 0; } };
    window.addEventListener('resize', resize);
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', visibility);
    this.disposers.push(() => window.removeEventListener('resize', resize), () => window.removeEventListener('beforeunload', persist), () => document.removeEventListener('visibilitychange', visibility));
    const lost = (event: Event) => {
      event.preventDefault();
      this.contextLost = true;
      this.save();
      this.hud.notify('A GPU foi interrompida. Restaurando o vale…', 'warning');
    };
    const restored = () => {
      this.contextLost = false;
      this.lastTime = 0;
      this.resize();
      this.hud.notify('Renderização restaurada.', 'success');
    };
    this.renderer.domElement.addEventListener('webglcontextlost', lost);
    this.renderer.domElement.addEventListener('webglcontextrestored', restored);
    this.disposers.push(
      () => this.renderer.domElement.removeEventListener('webglcontextlost', lost),
      () => this.renderer.domElement.removeEventListener('webglcontextrestored', restored),
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private beginPlay(): void {
    // Called directly by the start button's user gesture. No autoplay bypass.
    void this.sound.unlock();
    this.playing = true;
    this.lastTime = 0;
    this.hud.notify('O vale desperta. Explore a vila, encontre inimigos e procure o portal ao norte.', 'info');
  }

  private bindEvents(): void {
    this.disposers.push(this.events.on('damage', ({ position, amount, critical, team }) => {
      this.sound.impact(critical);
      if (team === 'hero') this.combat.particles.impact(position, 0xd84b52, critical);
      const projected = position.clone().addScaledVector(UP, 1.4).project(this.camera);
      if (projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2) {
        this.hud.showDamage({ x: (projected.x * 0.5 + 0.5) * this.container.clientWidth, y: (-projected.y * 0.5 + 0.5) * this.container.clientHeight }, amount, critical, team);
      }
    }));
    this.disposers.push(this.events.on('kill', ({ kind, position, level, boss }) => {
      this.codex.recordKill(kind, boss);
      const loot = this.inventory.generateLoot(kind, level, boss);
      const drop: LootDrop = { ...loot, position: position.clone() };
      this.drops.push(drop);
      this.createDropMesh(drop);
      if (drop.item?.rarity === 'mythic') this.combat.particles.celebration(position, true);
      this.statClock = 1;
    }));
    this.disposers.push(this.events.on('loot', drop => {
      this.sound.coin();
      this.inventory.addLoot(drop);
      const index = this.drops.findIndex(candidate => candidate.id === drop.id);
      if (index >= 0) this.drops.splice(index, 1);
      this.removeDropMesh(drop.id);
      this.statClock = 1;
      this.save();
    }));
    this.disposers.push(this.events.on('levelUp', ({ level }) => {
      this.sound.levelUp();
      this.combat.particles.celebration(this.hero.position);
      this.refreshStats();
      if (this.hero.alive) {
        this.hero.hp = this.hero.maxHp;
        this.hero.mana = this.hero.stats.maxMana;
      }
      this.hud.notify(`Nível ${level}! Seus atributos aumentaram.`, 'success');
    }));
    this.disposers.push(this.events.on('message', message => this.hud.notify(message.text, message.tone)));
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.frame);
    if (this.contextLost) return;
    const rawDt = this.lastTime ? (now - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.fps += ((1 / Math.max(rawDt, 0.001)) - this.fps) * 0.05;
    this.elapsed += dt;
    const input = this.hud.readInput();
    const active = this.playing && !this.hud.blocking && !document.hidden;
    if (active) {
      const simDt = this.combat.hitstop > 0 ? dt * 0.13 : dt;
      this.timeOfDay = (this.timeOfDay + dt / 600) % 1;
      if (input.mount && this.hero.alive) this.companions.toggleMount();
      this.hero.update(simDt, this.hero.alive ? input : emptyInput());
      this.physics.step(simDt);
      this.enemies.update(simDt, this.hero);
      this.companions.update(simDt, this.enemies.enemies, this.drops);
      this.dungeon.update(simDt, this.hero);
      const targets = this.enemies.enemies.filter(enemy => enemy.alive);
      if (input.attack && this.hero.alive && this.combat.attack(this.hero, targets, this.hero.stats, this.hero.facing)) {
        this.sound.attack(this.classId, this.combat.combo);
      }
      if (input.skill !== null && this.hero.alive && this.combat.cast(input.skill, this.classId, this.hero, targets, this.hero.stats, this.hero.facing)) {
        this.sound.spell(this.classId, input.skill);
      }
      this.combat.update(dt);
      this.base.update(dt);
      this.hero.mana = Math.min(this.hero.stats.maxMana, this.hero.mana + dt * 3.5);
      if (this.hero.alive && this.hero.position.distanceTo(this.terrain.spawnPoint) < 24) this.hero.heal(dt * 1.8);
      if (input.interact && this.hero.alive) this.interact();
      this.updateDrops(dt);
      this.updateRespawn(dt);
      this.statClock += dt;
      if (this.statClock > 0.5) { this.refreshStats(); this.statClock = 0; this.installShadows(); }
      this.saveClock += dt;
      if (this.saveClock >= 15) { this.save(); this.saveClock = 0; }
    }
    const boss = this.dungeon.active ? this.enemies.enemies.find(enemy => enemy.boss && enemy.alive) : undefined;
    const bossPhase = boss ? (boss.hp / boss.maxHp > 0.65 ? 1 : boss.hp / boss.maxHp > 0.3 ? 2 : 3) : 0;
    if (bossPhase > 0 && this.previousBossPhase > 0 && bossPhase !== this.previousBossPhase) this.sound.bossRoar();
    this.previousBossPhase = bossPhase;
    this.sound.update(dt, {
      daylight: Math.max(0, Math.sin(this.timeOfDay * Math.PI * 2)),
      moving: active && this.hero.alive && ['run', 'swim', 'dive'].includes(this.hero.machine.state)
        && Math.hypot(input.move.x, input.move.y) > 0.1,
      inWater: this.hero.machine.state === 'swim' || this.hero.machine.state === 'dive',
      boss: active && !!boss,
    });
    this.updateDaylight();
    this.terrain.update(dt, this.timeOfDay);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.atmosphere.uniforms.time.value = this.elapsed;
    this.csm.update();
    this.uiClock += dt;
    if (this.uiClock >= 0.1) { this.updateHUD(); this.uiClock = 0; }
    // Camera shake only offsets this frame, avoiding accumulated camera drift.
    const trauma = this.combat.screenShake;
    this.scratch.set(
      (Math.sin(this.elapsed * 71) + Math.sin(this.elapsed * 113) * 0.4) * trauma * 0.45,
      (Math.sin(this.elapsed * 83 + 0.8) + Math.sin(this.elapsed * 137) * 0.3) * trauma * 0.35,
      0,
    );
    const targetFov = this.hero.machine.state === 'slide' ? 66 : active && this.hero.machine.state === 'run' ? 61 : 58;
    const fov = this.camera.fov + (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5));
    if (Math.abs(fov - this.camera.fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.csm.updateFrustums();
    }
    this.camera.position.add(this.scratch);
    this.renderer.info.reset();
    this.composer.render(dt);
    this.camera.position.sub(this.scratch);
  };

  private interact(): void {
    const delta = this.hero.position.clone().sub(this.terrain.portalPosition); delta.y = 0;
    if (delta.length() < 12) {
      this.dungeon.start(this.hero);
    } else if (this.hero.position.distanceTo(this.terrain.spawnPoint) < 28) {
      this.hud.openPanel('inventory');
      this.hud.notify('Forja da vila: equipe, venda ou aprimore seu equipamento.', 'info');
    } else {
      this.hud.notify('Encontre a vila para usar a forja ou o portal ao norte para desafiar a masmorra.', 'info');
    }
  }

  private refreshStats(): void {
    if (!this.hero) return;
    const base = CLASS_DEFINITIONS[this.classId].stats;
    const equipment = this.inventory.getStatBonuses(), buildings = this.base.getBuffs(), codex = this.codex.getBuffs();
    this.hero.setStats({ ...base,
      attack: base.attack + equipment.attack + buildings.attack + codex.attack,
      defense: base.defense + equipment.defense + buildings.defense + codex.defense,
      maxHp: base.maxHp + equipment.maxHp + buildings.maxHp + codex.maxHp,
    });
  }

  private changeClass(id: ClassId): void {
    if (!(id in CLASS_DEFINITIONS) || id === this.classId) return;
    const hpRatio = this.hero.hp / this.hero.maxHp;
    const manaRatio = this.hero.mana / this.hero.stats.maxMana;
    this.classId = id;
    this.hero.setClass(CLASS_DEFINITIONS[id]);
    this.refreshStats();
    this.hero.hp = hpRatio > 0 ? Math.max(1, this.hero.maxHp * hpRatio) : 0;
    this.hero.mana = this.hero.stats.maxMana * manaRatio;
    this.events.emit('classChanged', { id });
    this.hud.notify(`${CLASS_DEFINITIONS[id].name}: ${CLASS_DEFINITIONS[id].description}`, 'success');
    this.save();
  }

  private createDropMesh(drop: LootDrop): void {
    const group = new Group();
    const color = drop.item ? ({ common: 0xadc2c4, uncommon: 0x68e18c, rare: 0x59b8ff, epic: 0xb083ff, legendary: 0xffc05c, mythic: 0xff729e }[drop.item.rarity]) : 0xf0ce78;
    const gem = new Mesh(new SphereGeometry(0.18, 6, 4), new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.75, metalness: 0.6, roughness: 0.24 }));
    const ring = new Mesh(new TorusGeometry(0.4, 0.025, 4, 24), new MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }));
    ring.rotation.x = -Math.PI / 2;
    const beam = new Mesh(new PlaneGeometry(0.28, 1.5), new MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: 2, depthWrite: false, blending: AdditiveBlending }));
    beam.position.y = 0.6;
    group.add(gem, ring, beam);
    group.position.set(drop.position.x, this.terrain.heightAt(drop.position.x, drop.position.z) + 0.6, drop.position.z);
    this.scene.add(group);
    this.dropMeshes.set(drop.id, group);
  }

  private removeDropMesh(id: string): void {
    const mesh = this.dropMeshes.get(id);
    if (!mesh) return;
    mesh.removeFromParent();
    mesh.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
    this.dropMeshes.delete(id);
  }

  private updateDrops(dt: number): void {
    const ids = new Set(this.drops.map(drop => drop.id));
    this.dropMeshes.forEach((mesh, id) => {
      if (!ids.has(id)) { this.removeDropMesh(id); return; }
      mesh.rotation.y += dt;
      mesh.children[0].position.y = Math.sin(this.elapsed * 3 + mesh.position.x) * 0.13;
    });
    for (const drop of [...this.drops]) {
      if (this.hero.alive && drop.position.distanceTo(this.hero.position) < 2.4) this.events.emit('loot', drop);
    }
    // Bound uncollected world loot without changing awarded inventory.
    while (this.drops.length > 80) { const oldest = this.drops.shift(); if (oldest) this.removeDropMesh(oldest.id); }
  }

  private updateRespawn(dt: number): void {
    if (this.hero.alive) { this.deadClock = 0; return; }
    this.deadClock += dt;
    if (this.deadClock >= 3) {
      this.inventory.gold = Math.floor(this.inventory.gold * 0.9);
      this.hero.respawn(this.terrain.spawnPoint);
      this.combat.resetCooldowns();
      this.events.emit('respawn', undefined);
      this.hud.notify('Você despertou na vila. O resgate custou 10% do ouro.', 'warning');
      this.deadClock = 0;
      this.save();
    }
  }

  private installShadows(): void {
    this.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof MeshStandardMaterial && !this.csmMaterials.has(material)) {
        // CSM installs an onBeforeCompile hook. Preserve procedural terrain
        // and cloth shader extensions rather than silently replacing them.
        const previousCompile = material.onBeforeCompile;
        this.csm.setupMaterial(material);
        const shadowCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          previousCompile.call(material, shader, renderer);
          shadowCompile.call(material, shader, renderer);
        };
        material.needsUpdate = true;
        this.csmMaterials.add(material);
        material.addEventListener('dispose', () => {
          this.csmMaterials.delete(material);
          this.csm.shaders.delete(material);
        });
      }
    });
  }

  private updateDaylight(): void {
    const angle = this.timeOfDay * Math.PI * 2;
    const sun = new Vector3(Math.cos(angle) * 0.75, Math.sin(angle), -0.45).normalize();
    const daylight = Math.max(0, sun.y);
    const twilight = Math.max(0, 1 - Math.abs(sun.y) * 3);
    const top = new Color('#09152c').lerp(new Color('#477f9d'), daylight);
    const horizon = new Color('#192f49').lerp(new Color('#b4d1c6'), daylight).lerp(new Color('#e9b69b'), twilight * 0.32);
    this.sky.update(this.elapsed, sun, top, horizon);
    this.csm.lightDirection.copy(sun).negate();
    if (this.csm.lightDirection.y > -0.15) this.csm.lightDirection.y = -0.15;
    this.csm.lights.forEach(light => { light.intensity = 0.24 + daylight * 2.5; light.color.set(daylight > 0.2 ? '#fff0d6' : '#8facd8'); });
    this.hemisphere.intensity = 0.65 + daylight * 1.5;
    const fogColor = horizon.clone().multiplyScalar(0.72);
    (this.scene.fog as FogExp2).color.copy(fogColor);
    this.atmosphere.uniforms.fogColor.value.copy(fogColor);
    this.atmosphere.uniforms.sunDirection.value.copy(sun);
    (this.stars.material as PointsMaterial).opacity = Math.max(0, 0.8 - daylight * 2);
  }

  private updateHUD(): void {
    const boss = this.dungeon.active ? this.enemies.enemies.find(enemy => enemy.boss && enemy.alive) : undefined;
    this.hud.update({
      hp: this.hero.hp, maxHp: this.hero.maxHp, mana: this.hero.mana, maxMana: this.hero.stats.maxMana,
      level: this.inventory.level, xp: this.inventory.xp, xpToNext: this.inventory.xpToNext,
      classId: this.classId, state: this.hero.machine.state,
      gold: this.inventory.gold, crystals: this.inventory.crystals, items: this.inventory.items, equipment: this.inventory.equipment,
      buildings: this.base.buildings.map(building => ({ ...building, cost: this.base.cost(building.id) })),
      codex: this.codex.entries, cooldowns: this.combat.cooldowns, cooldownMax: this.combat.cooldownMax,
      player: { x: this.hero.position.x, z: this.hero.position.z, heading: Math.atan2(this.hero.facing.x, this.hero.facing.z) },
      enemies: this.enemies.enemies.filter(enemy => enemy.alive).map(enemy => ({ x: enemy.position.x, z: enemy.position.z, boss: enemy.boss })),
      markers: this.terrain.markers, dungeon: { active: this.dungeon.active, wave: this.dungeon.wave, status: this.dungeon.status },
      mounted: this.hero.mounted, fps: Math.round(this.fps), timeOfDay: this.timeOfDay, combo: this.combat.combo,
      boss: boss ? { name: 'Guardião do Vazio', hp: boss.hp, maxHp: boss.maxHp,
        phase: boss.hp / boss.maxHp > 0.65 ? 1 : boss.hp / boss.maxHp > 0.3 ? 2 : 3 } : undefined,
    });
  }

  private setQuality(quality: 'low' | 'high'): void {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.65 : 1));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.bloom.enabled = quality === 'high';
    this.atmosphere.enabled = quality === 'high';
    this.smaa.enabled = quality === 'high';
    this.sky.setQuality(quality);
    this.terrain.setQuality(quality);
    this.combat.particles.setQuality(quality);
    this.csm.lights.forEach(light => {
      light.castShadow = true;
      const size = quality === 'high' ? 2048 : 1024;
      if (light.shadow.mapSize.x !== size) { light.shadow.mapSize.set(size, size); light.shadow.map?.dispose(); light.shadow.map = null; }
    });
    this.resize();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.combat.particles.setViewportHeight(height * this.renderer.getPixelRatio());
    this.csm.updateFrustums();
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, classId: this.classId, inventory: this.inventory.snapshot(), base: this.base.snapshot(), codex: this.codex.snapshot() }));
    } catch {
      if (!this.saveErrorReported && this.hud) { this.hud.notify('Armazenamento local indisponível. Esta sessão continua sem salvar.', 'warning'); this.saveErrorReported = true; }
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1) return;
      const save = data as Record<string, unknown>;
      if (typeof save.classId === 'string' && Object.hasOwn(CLASS_DEFINITIONS, save.classId)) this.classId = save.classId as ClassId;
      this.inventory.restore(save.inventory);
      this.base.restore(save.base);
      this.codex.restore(save.codex);
    } catch { /* Invalid or unavailable browser storage starts a fresh, playable session. */ }
  }

  /** Runtime diagnostics used by the documented browser smoke test. */
  get diagnostics(): { playing: boolean; quality: string; drawCalls: number; triangles: number; enemies: number; drops: number; position: number[] } {
    return { playing: this.playing, quality: this.quality, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, enemies: this.enemies.enemies.filter(enemy => enemy.alive).length, drops: this.drops.length, position: this.hero.position.toArray() };
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.save();
    this.disposers.splice(0).forEach(dispose => dispose());
    this.hud.dispose();
    this.sound.dispose();
    this.companions.dispose?.();
    this.dungeon.dispose(); this.enemies.dispose(); this.hero.dispose(); this.combat.dispose();
    this.terrain.dispose();
    [...this.dropMeshes.keys()].forEach(id => this.removeDropMesh(id));
    this.csm.remove(); this.csm.dispose();
    this.physics.dispose();
    this.composer.passes.forEach(pass => pass.dispose());
    this.composer.dispose();
    this.sky.dispose();
    this.stars.geometry.dispose(); (this.stars.material as PointsMaterial).dispose();
    this.renderer.dispose();
  }
}
