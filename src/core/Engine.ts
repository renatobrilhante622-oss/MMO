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
import {FrameBudget,cappedPixelRatio,withinActorRadius} from './RenderBudget';
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
import {AdminPanel} from '../ui/AdminPanel';
import {GachaCutscene} from '../ui/GachaCutscene';
import {PlayerJournal} from '../ui/PlayerJournal';
import {summon,canSummon} from '../rpg/GachaService';
import {WING_STYLES} from '../rpg/EvolutionSystem';
import { InventoryAndLoot,COMPLETE_ITEM_CATALOG,scaleWorldItem,RARITIES } from '../rpg/InventoryAndLoot';
import { BaseBuilding } from '../rpg/BaseBuilding';
import { CodexSystem } from '../rpg/CodexSystem';
import { EnemyAI } from '../enemies/EnemyAI';
import { DungeonBossManager } from '../enemies/DungeonBossManager';
import { AutoFarmController } from '../systems/VipAndAutoFarm';
import {purchaseMerchant} from '../rpg/MerchantEconomy';
import { EPIGRAPHS, cooldownMultiplier, epigraphEffects } from '../rpg/ClassEpigraphSystem';
import { AdventureProgress, type Attribute, type Gem } from '../progression/AdventureProgress';
import { COSMETICS } from '../progression/AdventureProgress';
import {setScreenPhase} from '../ui/MainMenu';
import {configureCharacterCamera,disableCharacterCulling} from '../player/PlayerRenderer';
import { HudEditor } from '../ui/HudEditor';
import { AdventureHub } from '../ui/AdventureHub';
import { GameI18n, translateText } from '../ui/I18n';
import { REGIONS, DUNGEONS, regionAt, dungeonVariant } from '../world/Regions';
import { regionArrival, travelPermission } from '../world/RegionTravel';
import { RegionTravelUI } from '../ui/RegionTravelUI';
import { PortalChannelVFX } from '../world/PortalChannelVFX';
import {MapInstanceManager} from '../world/MapInstanceManager';
import {WorldPortals} from '../world/WorldPortals';
import {QuestSystem,type QuestDefinition} from '../rpg/QuestSystem';
import {regionalMaterialForKill} from '../rpg/RegionalLoot';
import {NPCSystem} from '../world/NPCSystem';
import {QuestTrackerHUD} from '../ui/QuestTrackerHUD';
import { route, type MapPoint } from '../world/Navigation';
import { Line, LineBasicMaterial } from 'three';
import { MobileHUD } from '../ui/MobileHUD';
import { LootToastFeed } from '../ui/LootToastFeed';

const SAVE_KEY = 'eterna-ninefold-save-v1';
const UP = new Vector3(0, 1, 0);

export class Engine {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(58, 1, 0.1, 1000);
  readonly renderer: WebGLRenderer;
  readonly events = new EventBus();
  terrain: OpenWorldGenerator;
  readonly mapInstances:MapInstanceManager;
  private restoredRegionId='aurora';
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
  readonly regionTravel:RegionTravelUI;
  readonly portalVfx=new PortalChannelVFX();
  readonly quests:QuestSystem;
  npcs:NPCSystem;
  portals:WorldPortals;
  readonly questTracker:QuestTrackerHUD;
  private deferredQuestSave:unknown;
  private questAutoMove:MapPoint|null=null;
  private questMoveTimer=0;
  private questAutoRoute:MapPoint[]=[];
  readonly lootFeed: LootToastFeed;
  readonly progress: AdventureProgress;
  readonly hub: AdventureHub;
  readonly hudEditor:HudEditor;
  readonly admin:AdminPanel;
  readonly gacha:GachaCutscene;
  readonly journal:PlayerJournal;
  private readonly i18n: GameI18n;
  gpsRoute: MapPoint[] = [];
  private readonly gpsLine = new Line(new BufferGeometry(),new LineBasicMaterial({color:0x7aedd3,transparent:true,opacity:.75,depthTest:true}));
  private readonly gpsLabel = document.createElement('div');
  private readonly autoButton = document.createElement('button');
  private channel: {remaining:number;x:number;z:number;start:Vector3;hp:number;regionId?:string}|null = null;
  private autoRoute: MapPoint[] = [];
  private autoTimer = 0;
  private gpsTimer = 0;
  private autoTarget = '';
  private readonly farmController=new AutoFarmController();
  private recentCombat = 0;
  private appearanceKey = '';

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
  private readonly frameBudget=new FrameBudget();
  private shadowTimer=0;
  private shadowInstallTimer=0;
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
    this.mapInstances=new MapInstanceManager(this.scene,this.physics,this.terrain);
    this.inventory = new InventoryAndLoot(this.events, 407);
    this.progress = new AdventureProgress(this.inventory);
    this.base = new BaseBuilding(this.inventory, this.events);
    this.codex = new CodexSystem(this.events);
    this.restore();
    if(this.restoredRegionId!=='aurora'){
      this.terrain=this.mapInstances.activate(this.restoredRegionId);
    }
    this.quests=new QuestSystem(this.inventory,this.progress);
    this.quests.restore(this.deferredQuestSave);
    if(!this.progress.profile.id)this.progress.profile.id=crypto.randomUUID();
    this.hero = new HeroController(this.scene, this.camera, this.physics, this.events, CLASS_DEFINITIONS[this.classId]);
    configureCharacterCamera(this.camera);disableCharacterCulling(this.hero.model);
    this.hero.respawn(this.terrain.spawnPoint);
    this.hero.update(1 / 60, emptyInput());
    this.refreshStats();
    this.combat = new CombatSystem(this.scene, this.events);
    this.enemies = new EnemyAI(this.scene, this.physics, this.events);
    this.enemies.resetForRegion(this.mapInstances.regionId);
    this.dungeon = new DungeonBossManager(this.scene, this.enemies, this.events, this.terrain.portalPosition);
    this.companions = new PetAndMountSystem(this.scene, this.hero, this.physics, this.events);
    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: matchMedia('(pointer:coarse)').matches?1:3, mode: 'practical',
      maxFar: matchMedia('(pointer:coarse)').matches?55:150, shadowMapSize: 1024, lightDirection: new Vector3(-0.5, -0.85, 0.3),
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
      onOpenMap:()=>this.hub.open('map'),
      onOpenForge:()=>this.hub.openForge(),
      onOpenCollection:()=>this.hub.open('collection'),
      onOpenVip:()=>this.hub.open('vip'),
      onOpenPass:()=>this.hub.open('pass'),
      onClassChange: id => this.changeClass(id),
      onOpenProgression: tab => tab==='inventory'?this.hub.openInventory():this.hub.open(tab),
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
    this.lootFeed = new LootToastFeed(this.container);
    this.hub = new AdventureHub(this.container,this);
    this.questTracker=new QuestTrackerHUD(this.container,this.quests,{
      navigate:quest=>this.navigateQuest(quest),
      claim:id=>this.claimQuest(id),
    });
    this.npcs=new NPCSystem(this.scene,this.container,(x,z)=>this.terrain.heightAt(x,z),
      this.quests,{
        onForge:()=>this.hub.openForge(),
        onShop:()=>this.hub.open('shop'),
        onTeleport:()=>this.regionTravel.open(),
        onQuestAccepted:()=>{this.questTracker.refresh();this.save();},
        onQuestClaimed:id=>this.claimQuest(id),
      },()=>this.progress.language,this.mapInstances.regionId);
    this.scene.add(this.portalVfx.root);
    this.regionTravel=new RegionTravelUI(this.container,()=>({
      level:this.inventory.level,unlocked:this.progress.unlockedRegions,
      adminOverride:this.hero.godMode,
      inCombat:this.recentCombat>0,
      inDungeon:this.dungeon.active,
      channeling:!!this.channel
    }),id=>this.startRegionTravel(id),()=>this.progress.language);
    this.portals=new WorldPortals(this.scene,this.container,this.mapInstances.regionId,
      (x,z)=>this.terrain.heightAt(x,z),
      ()=>({level:this.inventory.level,unlocked:this.progress.unlockedRegions,
        adminOverride:this.hero.godMode,inCombat:this.recentCombat>0,
        inDungeon:this.dungeon.active,channeling:!!this.channel}),
      id=>this.startRegionTravel(id),()=>this.progress.language);
    this.i18n = new GameI18n(this.container,this.progress.language);
    const journey=document.createElement('button');journey.className='journey-button';journey.innerHTML='<span aria-hidden="true">✧</span><span>Jornada</span>';journey.title='Jornada / Journey';journey.onclick=()=>this.hub.openJourney();this.hud.registerShortcut(journey);
    this.autoButton.className='autofarm-button';this.autoButton.hidden=true;this.autoButton.innerHTML='<span aria-hidden="true">⟳</span>';this.autoButton.title='Auto-Farm';this.autoButton.setAttribute('aria-label','Auto-Farm');this.autoButton.onclick=()=>{this.farmController.reset();this.autoTarget='';this.autoRoute=[];this.progress.autoFarm=this.progress.vip&&!this.progress.autoFarm;this.autoButton.classList.toggle('active',this.progress.autoFarm);};this.container.append(this.autoButton);
    this.hudEditor=new HudEditor(this.container,()=>this.progress.language,()=>{this.hud.resetInput();this.autoButton.hidden=!this.progress.vip;});
    this.admin=new AdminPanel(this.container,()=>({gold:this.inventory.gold,crystals:this.inventory.crystals,diamonds:this.progress.vipDiamonds,tickets:this.progress.tickets,materials:this.progress.materials,level:this.inventory.level,god:this.hero.godMode,noCooldown:this.combat.noCooldown,oneHit:this.combat.oneHitKill}),(action,value)=>this.adminAction(action,value));
    this.gacha=new GachaCutscene(this.container,(count,banner)=>{const rewards=summon(this.progress,count,banner);if(rewards){this.sound.levelUp();this.save();}return rewards;},count=>canSummon(this.progress,count),()=>this.hub.refresh());
    this.journal=new PlayerJournal(this.container,this.progress,()=>({level:this.inventory.level,name:this.hub.online.view?.self.name??'Aventureiro',clan:this.hub.online.view?.clan?.name??'',attack:this.hero.stats.attack,defense:this.hero.stats.defense,hp:this.hero.maxHp}),()=>{this.refreshStats();this.save();},()=>this.hub.open('clan'));
    const clan=document.createElement('button');clan.className='clan-shortcut';clan.innerHTML='<span aria-hidden="true">⚑</span><span>Clã</span>';clan.title='Clã / Clan';clan.onclick=()=>this.hub.open('clan');this.hud.registerShortcut(clan);this.disposers.push(()=>clan.remove());
    this.gpsLabel.className='gps-status';this.gpsLabel.hidden=true;this.container.append(this.gpsLabel);
    this.gpsLine.frustumCulled=false;this.scene.add(this.gpsLine);
    this.disposers.push(()=>{journey.remove();this.autoButton.remove();this.gpsLabel.remove();this.gpsLine.geometry.dispose();(this.gpsLine.material as LineBasicMaterial).dispose();this.gpsLine.removeFromParent();});
    this.applyPreferences();
    if(this.progress.waypoint)this.setWaypoint(this.progress.waypoint);
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
    if (!this.progress.chosen){setScreenPhase(this.container,'class-selection');this.hub.open('classes');}
    else{setScreenPhase(this.container,'playing');this.hudEditor.initialize();}
    this.lastTime = 0;
    this.hud.notify('O vale desperta. Explore a vila, encontre inimigos e procure o portal ao norte.', 'info');
  }

  private bindEvents(): void {
    this.disposers.push(this.events.on('damage', ({ position, amount, critical, team }) => {
      this.sound.impact(critical);
      this.recentCombat=6;
      if (team==='hero') this.channel=null;
      if (team === 'hero') this.combat.particles.impact(position, 0xd84b52, critical);
      const projected = position.clone().addScaledVector(UP, 1.4).project(this.camera);
      if (projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2) {
        this.hud.showDamage({ x: (projected.x * 0.5 + 0.5) * this.container.clientWidth, y: (-projected.y * 0.5 + 0.5) * this.container.clientHeight }, amount, critical, team);
      }
    }));
    this.disposers.push(this.events.on('kill', ({ kind, position, level, boss }) => {
      const slainRegion=this.mapInstances.regionId;
      this.quests.onKill(kind,slainRegion,boss);
      this.questTracker.refresh();
      this.progress.earnKill(level,boss,slainRegion);if(boss)this.progress.profile.bossKills++;
      this.codex.recordKill(kind, boss);
      const loot = this.inventory.generateLoot(kind, level, boss);
      const exclusive=regionalMaterialForKill(slainRegion,kind,level,boss,loot.id);
      const drop: LootDrop = {...loot,position:position.clone(),
        ...(exclusive?{regionalMaterial:exclusive}:{})};
      this.drops.push(drop);
      this.createDropMesh(drop);
      if (drop.item?.rarity === 'mythic') this.combat.particles.celebration(position, true);
      this.statClock = 1;
    }));
    this.disposers.push(this.events.on('loot', drop => {
      this.lootFeed.push(drop);
      this.sound.coin();
      this.inventory.addLoot(drop);
      // Grant regional resources only when the real world drop reaches the pickup event.
      if(this.drops.some(candidate=>candidate.id===drop.id)&&drop.regionalMaterial){
        if(this.progress.collectRegionalMaterial(drop.regionalMaterial.id,drop.regionalMaterial.quantity))
          this.hud.notify('✦ '+drop.regionalMaterial.name+' ×'+drop.regionalMaterial.quantity,'success');
      }
      this.progress.dropHistory.push({name:drop.item&&this.inventory.items.some(i=>i.id===drop.item!.id)?drop.item.name:'Ouro / Cristais',rarity:drop.item&&this.inventory.items.some(i=>i.id===drop.item!.id)?drop.item.rarity:'common',time:Date.now(),gold:drop.gold,crystals:drop.crystals});if(this.progress.dropHistory.length>100)this.progress.dropHistory.shift();
      const index = this.drops.findIndex(candidate => candidate.id === drop.id);
      if (index >= 0) this.drops.splice(index, 1);
      this.removeDropMesh(drop.id);
      this.statClock = 1;
      this.save();
    }));
    this.disposers.push(this.events.on('levelUp', ({ level }) => {
      this.quests.refreshDaily();
      this.questTracker.refresh();
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
    const active = this.playing && !this.hud.blocking && !this.hub.blocking && !this.hudEditor.active && !this.admin.blocking && !this.gacha.blocking && !this.journal.blocking && !this.regionTravel.blocking && !this.npcs.blocking && !document.hidden;
    if(!active)this.hud.resetInput();
    if(this.channel)this.portalVfx.update(dt,this.channel.remaining);
    this.progress.tick(document.hidden?0:dt);
    this.recentCombat=Math.max(0,this.recentCombat-dt);
    this.updateJourney(dt,active,input);
    this.npcs.update(dt,this.camera,this.hero.position,active);
    this.portals.update(dt,this.camera,this.hero.position,active);
    this.quests.refreshDaily();
    this.quests.updateMilestones(
      this.inventory.level,
      Math.max(0,...this.inventory.items.filter(item=>item.slot==='weapon').map(item=>item.upgrade)),
      Math.max(0,...Object.values(this.progress.evolution.wingLevels)),
      this.progress.owned.some(id=>id!=='horse'&&id.includes('mount'))||this.hero.mounted
    );
    if (active) {
      this.progress.profile.playSeconds+=dt;
      const simDt = this.combat.hitstop > 0 ? dt * 0.13 : dt;
      this.timeOfDay = (this.timeOfDay + dt / 600) % 1;
      if (input.mount && this.hero.alive) this.companions.toggleMount();
      this.hero.update(simDt, this.hero.alive ? input : emptyInput());
      this.physics.step(simDt);
      this.enemies.update(simDt, this.hero,this.camera.position);
      this.companions.update(simDt, this.enemies.enemies, this.drops);
      const clears=this.dungeon.clears;
      this.dungeon.update(simDt, this.hero);
      if(this.dungeon.clears>clears){this.progress.complete(this.dungeon.definition);this.save();}
      const targets = this.enemies.enemies.filter(enemy => enemy.alive);
      if (input.attack && this.hero.alive && this.combat.attack(this.hero, targets, this.hero.stats, this.hero.facing)) {
        this.sound.attack(this.classId, this.combat.combo);
      }
      if (input.skill !== null && this.hero.alive && this.combat.cast(input.skill, this.classId, this.hero, targets, {...this.hero.stats,attack:this.hero.stats.attack*(1+epigraphEffects(this.classId,this.progress.talents[this.classId]).spellPower)}, this.hero.facing)) {
        this.sound.spell(this.classId, input.skill);
        this.combat.cooldowns[input.skill]*=cooldownMultiplier(this.progress.talents[this.classId]?.spirit??0);
        this.combat.cooldownMax[input.skill]=this.combat.cooldowns[input.skill];
      }
      this.combat.update(dt,this.camera.position);

      this.hero.mana = Math.min(this.hero.stats.maxMana, this.hero.mana + dt * 3.5);
      if (this.hero.alive && this.hero.position.distanceTo(this.terrain.spawnPoint) < 24) this.hero.heal(dt * 1.8);
      if (input.interact && this.hero.alive) this.interact();
      this.updateDrops(dt);
      this.updateRespawn(dt);
      this.statClock += dt;
      if (this.statClock > 0.5) { this.refreshStats(); this.statClock = 0; }
      this.saveClock += dt;
      if (this.saveClock >= 15) { this.save(); this.saveClock = 0; }
    }
    if(this.playing&&!document.hidden&&!this.hudEditor.active)this.base.update(dt);
    const boss = this.dungeon.active ? this.enemies.enemies.find(enemy => enemy.boss && enemy.alive && enemy.home.distanceTo(this.terrain.portalPosition)<25) : undefined;
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
    // Opaque menus and the summon canvas do not need a second live 3D scene underneath.
    if(this.playing&&(this.hub.blocking||this.admin.blocking||this.journal.blocking||this.gacha.blocking)){this.updateHUD();return;}
    this.shadowInstallTimer+=dt;if(this.shadowInstallTimer>2){disableCharacterCulling(this.hero.model);this.installShadows();this.shadowInstallTimer=0;}
    if(matchMedia('(pointer:coarse)').matches&&active){const ratio=this.frameBudget.update(rawDt,this.renderer.getPixelRatio());if(ratio!==this.renderer.getPixelRatio()){this.renderer.setPixelRatio(ratio);this.composer.setPixelRatio(ratio);this.resize();}}
    this.shadowTimer+=dt;if(this.shadowTimer>=1/30){this.renderer.shadowMap.needsUpdate=true;this.shadowTimer=0;}
    this.updateDaylight();
    this.terrain.update(dt, this.timeOfDay,this.camera.position);
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
    const targetFov = this.channel ? 48 : this.hero.machine.state === 'slide' ? 66 : active && this.hero.machine.state === 'run' ? 61 : 58;
    const fov = this.camera.fov + (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5));
    if (Math.abs(fov - this.camera.fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.csm.updateFrustums();
    }
    this.camera.position.add(this.scratch);
    this.renderer.info.reset();
    if(this.quality==='low')this.renderer.render(this.scene,this.camera);else this.composer.render(dt);
    this.camera.position.sub(this.scratch);
  };

  get currentClass(): ClassId { return this.classId; }
  translate(text:string):string {return translateText(text,this.progress.language);}
  epigraphDescription(key:Attribute):string {
    return EPIGRAPHS[this.classId][key].description[this.progress.language==='pt'?0:1];
  }
  applyPreferences():void {
    this.container.style.setProperty('--hud-scale',String(this.progress.hudScale));
    this.container.style.setProperty('--controls-scale',String(this.progress.controlsScale));
    this.container.style.setProperty('--hud-opacity',String(this.progress.hudOpacity));
    this.hud.setLanguage(this.progress.language);
    this.i18n?.set(this.progress.language);this.save();
  }
  configureQuality(quality:'low'|'high'):void {this.setQuality(quality);}
  setHudPreference(key:string,value:number):void {
    if(!Number.isFinite(value))return;
    if(key==='hudScale'||key==='controlsScale')this.progress[key]=Math.max(.5,Math.min(1.5,value));
    if(key==='autoHealthThreshold'||key==='autoManaThreshold')this.progress[key]=Math.max(.1,Math.min(.8,value));
    if(key==='hudOpacity')this.progress.hudOpacity=Math.max(.3,Math.min(1,value));
    this.applyPreferences();
  }
  setWaypoint(point:MapPoint|null):void {
    if(point&&(!Number.isFinite(point.x)||!Number.isFinite(point.z)||Math.abs(point.x)>140||Math.abs(point.z)>140))return;
    this.progress.waypoint=point;this.gpsRoute=point?route(this.terrain,this.hero.position,point):[];
    const points:Vector3[]=[];const coarse=[this.hero.position,...this.gpsRoute];
    for(let i=1;i<coarse.length;i++){const a=coarse[i-1],b=coarse[i],steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)));for(let j=0;j<=steps;j++){const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;points.push(new Vector3(x,this.terrain.heightAt(x,z)+.2,z));}}
    this.gpsLine.geometry.dispose();this.gpsLine.geometry=new BufferGeometry().setFromPoints(points);this.gpsLine.visible=!!point&&this.gpsRoute.length>0;
  }
  private travelBlocked():boolean {
    return this.dungeon.active||!this.hero.alive||this.recentCombat>0||this.enemies.enemies.some(e=>e.boss&&e.alive&&e.position.distanceTo(this.hero.position)<30)||Math.hypot(this.hero.position.x,this.hero.position.z+70)<24;
  }
  adventureAction(action:string,data:{id:string;key:string;index:number;name:string}):string {
    const p=this.progress,inv=this.inventory;
    let ok=false;
    switch(action){
      case 'admin-open':this.hub.close();this.admin.open();ok=true;break;
      case 'evolution-open':this.hub.close();this.journal.open('wings');ok=true;break;
      case 'gacha10':case 'gacha':{this.hud.resetInput();return this.gacha.open(action==='gacha10'?10:1,p.banner)?'Invocação iniciada / Summoning started':(p.language==='pt'?'Tickets insuficientes ou mochila cheia':'Not enough tickets or inventory full');}
      case 'edit-hud':this.hub.close();this.hud.resetInput();this.hudEditor.enter();ok=true;break;
      case 'class':
        if (!(data.id in CLASS_DEFINITIONS))break;
        if(p.chosen&&(this.recentCombat>0||this.hero.position.distanceTo(this.terrain.spawnPoint)>28))break;
        p.chosen=true;this.changeClass(data.id as ClassId);this.hub.open('talents');ok=true;break;
      case 'talent':ok=p.allocate(this.classId,data.key as Attribute);this.refreshStats();break;
      case 'talent-reset':ok=p.resetTalents(this.classId);this.refreshStats();break;
      case 'equip':ok=inv.equip(data.id);this.refreshStats();break;
      case 'building':ok=this.base.upgrade(data.id);this.refreshStats();break;
      case 'lock':{const item=inv.items.find(i=>i.id===data.id);if(item){item.locked=!item.locked;ok=true;}break;}
      case 'sell':ok=inv.sell(data.id);break;
      case 'upgrade':{ok=inv.upgradeItem(data.id);if(ok){this.refreshStats();this.updateHUD();this.sound.impact(true);this.combat.particles.burst(this.hero.position,0xffdc88,18);const item=inv.items.find(i=>i.id===data.id)!;this.save();return p.language==='pt'?`${item.name} +${item.upgrade} · Nível ${item.level} · Refino concluído!`:`${item.name} +${item.upgrade} · Level ${item.level} · Refinement complete!`;}break;}
      case 'salvage':ok=p.salvage(data.id);break;
      case 'socket':ok=p.socket(data.id,data.key as Gem);this.refreshStats();break;
      case 'unsocket':ok=p.unsocket(data.id);this.refreshStats();break;
      case 'gem-buy':ok=p.buyGem(data.key as Gem);break;
      case 'gem-fuse':ok=p.fuseGem(data.key as Gem);break;
      case 'gem-forge':ok=p.forgeGem(data.key as Gem);break;
      case 'potion-buy':if(data.key==='health'||data.key==='mana')ok=p.buyPotion(data.key);break;
      case 'potion-use':if(data.key==='health'||data.key==='mana')ok=this.usePotion(data.key);break;
      case 'crystal-buy':ok=purchaseMerchant(p,'crystals');break;
      case 'ticket-buy':ok=purchaseMerchant(p,'tickets');break;
      case 'slot-buy':ok=p.buySlot();break;
      case 'teleport-record':ok=p.record(data.index,data.name,this.hero.position.x,this.hero.position.z,this.travelBlocked());break;
      case 'teleport':{const dest=p.destination(data.index,this.travelBlocked());if(dest){this.startChannel(dest.x,dest.z);this.hub.close();ok=true;}break;}
      case 'vip':ok=p.buyVip();break;
      case 'pass-buy':ok=p.buyPass();break;
      case 'mission':if(data.key==='daily'||data.key==='weekly'||data.key==='forest')ok=p.claimMission(data.key);break;
      case 'pass-claim':ok=p.claimPass(data.index);break;
      case 'banner':if(['skin','pet','mount','weapon','wing','equipment'].includes(data.key)){p.banner=data.key as typeof p.banner;ok=true;}break;

      case 'redeem-vip':ok=p.redeemVip(data.id);break;
      case 'redeem':ok=p.redeem(data.id);break;
      case 'cosmetic':ok=p.equipCosmetic(data.id);break;
      case 'gps-monster':{const enemy=this.enemies.enemies.find(e=>e.id===data.id&&e.alive);if(enemy){this.setWaypoint(enemy.position);ok=true;}break;}
      case 'gps-region':case 'gps-boss':{const r=REGIONS.find(r=>r.id===data.id);if(r){this.setWaypoint(action==='gps-boss'?r.boss:r.center);ok=true;}break;}
      case 'difficulty':if(['normal','elite','nightmare','abyssal'].includes(data.key)&&!this.dungeon.active){p.dungeonDifficulty=data.key;ok=true;}break;
      case 'dungeon-select':case 'dungeon-start':{
        const base=DUNGEONS.find(d=>d.id===data.id),d=base?dungeonVariant(base,p.dungeonDifficulty):undefined;if(d&&inv.level>=d.level&&!this.dungeon.active){p.selectedDungeon=d.id;ok=action==='dungeon-select'||this.dungeon.start(this.hero,d,inv.level);if(ok&&action==='dungeon-start')this.hub.close();}break;
      }
    }
    this.save();
    return ok?(p.language==='pt'?'Concluído.':'Done.'):(p.language==='pt'?'Indisponível: confira moedas, nível, recarga, combate e proximidade da vila/portal.':'Unavailable: check currency, level, cooldown, combat and distance to town/portal.');
  }
  private usePotion(type:'health'|'mana'):boolean {
    if(!this.hero.alive||(type==='health'?this.hero.hp>=this.hero.maxHp:this.hero.mana>=this.hero.stats.maxMana)||!this.progress.usePotion(type))return false;
    if(type==='health')this.hero.heal(this.hero.maxHp*.4);else this.hero.mana=Math.min(this.hero.stats.maxMana,this.hero.mana+this.hero.stats.maxMana*.4);
    this.combat.particles.celebration(this.hero.position);return true;
  }
  private updateJourney(dt:number,active:boolean,input:ReturnType<typeof emptyInput>):void {
    const p=this.progress,hero=this.hero;
    this.autoButton.hidden=!p.vip&&!this.hudEditor.active;this.autoButton.classList.toggle('active',p.autoFarm);
    const region=REGIONS.find(r=>r.id===this.mapInstances.regionId)!;if(!p.discovered.includes(region.id)){p.discovered.push(region.id);this.hud.notify(region.name[p.language==='pt'?0:1]+' · Lv. '+region.minLevel+'–'+region.maxLevel);this.save();}
    this.quests.onVisit(region.id);
    const skin=COSMETICS.find(c=>c.id===p.equipped.skin)!;hero.rig.skinAppearance(skin.id,skin.color,RARITIES.indexOf(skin.rarity));hero.rig.wings.configure(p.evolution.wings,p.evolution.wings?p.evolution.wingLevels[p.evolution.wings]:1);
    const pet=COSMETICS.find(c=>c.id===p.equipped.pet)!,mount=COSMETICS.find(c=>c.id===p.equipped.mount)!;this.companions.setAppearances(pet,mount);this.companions.setEvolution(p.evolution.level(pet.id),p.evolution.level(mount.id));
    const weapon=this.inventory.items.find(i=>i.id===this.inventory.equipment.weapon);
    const key=skin.id+p.equipped.weapon+(weapon?.rarity??'common')+(weapon?.upgrade??0)+this.classId;
    if(key!==this.appearanceKey){this.appearanceKey=key;hero.setAppearance(skin.color,weapon?.upgrade??0,COSMETICS.find(c=>c.id===p.equipped.weapon)!.color,weapon?.rarity??'common');}
    hero.rig.weapons.skin(p.equipped.weapon);
    if(p.waypoint){const distance=Math.hypot(hero.position.x-p.waypoint.x,hero.position.z-p.waypoint.z),angle=Math.atan2(p.waypoint.x-hero.position.x,-(p.waypoint.z-hero.position.z));this.gpsLabel.hidden=false;this.gpsLabel.innerHTML='<span style="display:inline-block;transform:rotate('+angle+'rad)">↑</span> GPS · '+Math.round(distance)+' m';this.gpsLabel.style.setProperty('--gps-heading',angle+'rad');if(distance<3)this.setWaypoint(null);}else this.gpsLabel.hidden=true;
    if(!active)return;
    if(this.channel){
      if(Math.hypot(input.move.x,input.move.y)>.1||this.channel.start.distanceTo(hero.position)>1||hero.hp<this.channel.hp||!hero.alive){
        this.channel=null;this.portalVfx.stop();
        this.hud.notify(p.language==='pt'?'Conjuração interrompida.':'Channel interrupted.');
      }else{
        this.channel.remaining-=dt;
        this.portalVfx.update(dt,this.channel.remaining);
        if(this.channel.remaining<=0){
          const dest=this.channel;
          if(dest.regionId&&dest.regionId!==this.mapInstances.regionId){
            this.activateMap(dest.regionId);
            hero.teleportTo(this.terrain.spawnPoint.clone().add(new Vector3(0,.2,0)));
          }else hero.teleportTo(new Vector3(dest.x,this.terrain.heightAt(dest.x,dest.z)+1.1,dest.z));
          if(dest.regionId&&!p.discovered.includes(dest.regionId))p.discovered.push(dest.regionId);
          this.channel=null;this.portalVfx.stop();
          this.combat.particles.celebration(hero.position);this.save();
        }
      }
      input.move={x:0,y:0};input.attack=false;input.skill=null;return;
    }
    if(p.waypoint){this.gpsTimer-=dt;if(this.gpsTimer<=0){this.gpsTimer=3;this.setWaypoint(p.waypoint);}}
    if(this.questAutoMove&&!p.autoFarm){
      if(Math.hypot(input.move.x,input.move.y)>.16||input.dash||input.jump){
        this.questAutoMove=null;this.questAutoRoute=[];
      }else{
        const distance=Math.hypot(hero.position.x-this.questAutoMove.x,hero.position.z-this.questAutoMove.z);
        if(distance<3){this.questAutoMove=null;this.questAutoRoute=[];input.move={x:0,y:0};}
        else{
          this.questMoveTimer-=dt;
          if(this.questMoveTimer<=0){
            this.questMoveTimer=1;this.questAutoRoute=route(this.terrain,hero.position,this.questAutoMove);
          }
          while(this.questAutoRoute.length&&Math.hypot(this.questAutoRoute[0].x-hero.position.x,this.questAutoRoute[0].z-hero.position.z)<1.5)this.questAutoRoute.shift();
          input.move=hero.inputToward(this.questAutoRoute[0]??this.questAutoMove);
        }
      }
    }
    const farmCandidates=this.enemies.enemies.filter(e=>e.alive&&e.hp>0&&!e.boss);
    const objective=this.quests.active();
    const priority=objective?.goal==='kill'?farmCandidates.filter(e=>e.kind===objective.target&&this.mapInstances.regionId===objective.region):[];
    const decision=this.farmController.update({vip:p.vip,enabled:p.autoFarm,alive:hero.alive,inDungeon:this.dungeon.active,level:this.inventory.level,x:hero.position.x,z:hero.position.z,hp:hero.hp,maxHp:hero.maxHp,mana:hero.mana,maxMana:hero.stats.maxMana,healthThreshold:p.autoHealthThreshold,manaThreshold:p.autoManaThreshold,input,attackRange:hero.stats.range},(priority.length?priority:farmCandidates),this.drops,dt);
    if(decision.stop)p.autoFarm=false;
    if(!p.autoFarm||!p.vip||!hero.alive||this.dungeon.active){this.autoTarget='';this.autoRoute=[];return;}
    if(decision.healthPotion)this.usePotion('health');
    if(decision.manaPotion)this.usePotion('mana');
    const destination=decision.destination;
    if(!destination)return;
    const target=decision.target;
    const navigationKey=decision.loot?'loot:'+decision.loot.id:target?.id??'anchor';
    if(this.autoTarget!==navigationKey){this.autoTarget=navigationKey;this.autoTimer=0;this.autoRoute=[];}
    hero.mounted=false;
    const distance=Math.hypot(destination.x-hero.position.x,destination.z-hero.position.z);
    const reach=target?Math.max(2,hero.stats.range*.75):1.6;
    if(distance>reach){
      this.autoTimer-=dt;
      if(this.autoTimer<=0){this.autoTimer=1;this.autoRoute=route(this.terrain,hero.position,destination);}
      while(this.autoRoute.length&&Math.hypot(this.autoRoute[0].x-hero.position.x,this.autoRoute[0].z-hero.position.z)<1.4)this.autoRoute.shift();
      if(this.autoRoute.length)input.move=hero.inputToward(this.autoRoute[0]);
      else input.move=hero.inputToward(destination);
    }else if(target){
      hero.aimAt(new Vector3(target.position.x,hero.position.y,target.position.z),0);hero.facing.set(target.position.x-hero.position.x,0,target.position.z-hero.position.z).normalize();input.attack=true;
      const skill=CLASS_DEFINITIONS[this.classId].skills.findIndex((s,i)=>this.combat.cooldowns[i]<=0&&hero.mana>=s.mana);
      if(skill>=0)input.skill=skill;
    }
  }

  private claimQuest(id:string):void{
    const definition=this.quests.get(id);
    if(!definition||!this.quests.claim(id)){
      this.hud.notify('Objetivo ainda não concluído.','warning');return;
    }
    this.sound.levelUp();
    this.combat.particles.celebration(this.hero.position,true);
    this.questTracker.refresh();
    this.hud.notify('🎁 Missão concluída: '+definition.title,'success');
    this.save();
  }
  private navigateQuest(quest:QuestDefinition):void{
    const region=REGIONS.find(r=>r.id===quest.region);
    if(!region)return;
    let destination:MapPoint={...region.center};
    if(quest.goal==='talk'){
      const npc=this.npcs.definitions.find(n=>n.id===quest.target);
      if(npc)destination={x:npc.x,z:npc.z};
    }else if(quest.goal==='boss')destination={...region.boss};
    else if(quest.goal==='kill'){
      const target=this.enemies.enemies.filter(e=>e.alive&&e.kind===quest.target&&this.mapInstances.regionId===quest.region)
        .sort((a,b)=>a.position.distanceToSquared(this.hero.position)-b.position.distanceToSquared(this.hero.position))[0];
      if(target)destination={x:target.position.x,z:target.position.z};
    }
    if(quest.goal==='level'||quest.goal==='refine'||quest.goal==='wing'||quest.goal==='mount'){
      this.hub.open('talents');return;
    }
    this.questAutoMove=destination;
    this.questMoveTimer=0;
    this.questAutoRoute=[];
    this.setWaypoint(destination);
    this.hud.notify('Rota da missão traçada. Use o joystick para cancelar.','info');
  }

  /** Shared channeling for bookmarks and story-gated map portals. */
  private startChannel(x:number,z:number,regionId?:string):void{
    if(!this.hero.alive||this.dungeon.active||this.channel)return;
    this.farmController.reset();this.progress.autoFarm=false;
    this.hero.mounted=false;
    this.channel={remaining:2.5,x,z,start:this.hero.position.clone(),hp:this.hero.hp,regionId};
    this.portalVfx.start(this.hero.position.clone().add(new Vector3(0,-this.hero.radius,.0)));
    this.combat.particles.celebration(this.hero.position);
  }
  /** Replaces the entire terrain scene graph and static physics, then regional actors. */
  private activateMap(id:string):void{
    if(id===this.mapInstances.regionId)return;
    this.npcs.dispose();
    this.portals.dispose();
    this.enemies.dispose();
    this.drops.splice(0);
    for(const id of [...this.dropMeshes.keys()])this.removeDropMesh(id);
    this.questAutoMove=null;this.questAutoRoute=[];
    this.setWaypoint(null);
    this.terrain=this.mapInstances.activate(id);
    this.enemies.resetForRegion(id);
    this.npcs=new NPCSystem(this.scene,this.container,(x,z)=>this.terrain.heightAt(x,z),
      this.quests,{
        onForge:()=>this.hub.openForge(),
        onShop:()=>this.hub.open('shop'),
        onTeleport:()=>this.regionTravel.open(),
        onQuestAccepted:()=>{this.questTracker.refresh();this.save();},
        onQuestClaimed:questId=>this.claimQuest(questId),
      },()=>this.progress.language,id);
    this.portals=new WorldPortals(this.scene,this.container,id,
      (x,z)=>this.terrain.heightAt(x,z),
      ()=>({level:this.inventory.level,unlocked:this.progress.unlockedRegions,
        adminOverride:this.hero.godMode,inCombat:this.recentCombat>0,
        inDungeon:this.dungeon.active,channeling:!!this.channel}),
      destinationId=>this.startRegionTravel(destinationId),
      ()=>this.progress.language);
    this.hero.mounted=false;
    this.companions.mount.visible=false;
    const region=REGIONS.find(item=>item.id===id)!;
    this.hud.notify('Região carregada: '+region.name[0],'success');
  }

  private startRegionTravel(id:string):void{
    const permission=travelPermission(id,{
      level:this.inventory.level,unlocked:this.progress.unlockedRegions,
      adminOverride:this.hero.godMode,inCombat:this.recentCombat>0,
      inDungeon:this.dungeon.active,channeling:!!this.channel,
    });
    const arrival=regionArrival(id);
    if(!permission.ok||!arrival){
      this.hud.notify('Destino bloqueado: nível, história ou combate.','warning');return;
    }
    this.startChannel(arrival.x,arrival.z,id);
    this.hud.notify('Canalizando portal místico por 2,5 segundos…','info');
  }

  private interact(): void {
    if(this.portals.interact())return;
    if(this.npcs.interact(this.hero.position))return;
    const delta = this.hero.position.clone().sub(this.terrain.portalPosition); delta.y = 0;
    if (delta.length() < 12) {
      this.dungeon.start(this.hero,dungeonVariant(DUNGEONS.find(d=>d.id===this.progress.selectedDungeon)??DUNGEONS[0],this.progress.dungeonDifficulty),this.inventory.level);
    } else if (this.hero.position.distanceTo(this.terrain.spawnPoint) < 28) {
      this.hud.openPanel('inventory');
      this.hud.notify('Forja da vila: equipe, venda ou aprimore seu equipamento.', 'info');
    } else {
      this.hud.notify('Encontre a vila para usar a forja ou o portal ao norte para desafiar a masmorra.', 'info');
    }
  }

  adminAction(action:string,zone='aurora'):string {
    const p=this.progress,inv=this.inventory;
    if(action==='gold')inv.gold+=100000;
    else if(action==='crystals')inv.crystals+=10000;
    else if(action==='diamonds')p.vipDiamonds+=5000;
    else if(action==='tickets')p.tickets+=100;
    else if(action==='materials'){p.materials+=1000;for(const key of Object.keys(p.gems) as Gem[])p.gems[key]+=1000;}
    else if(action.startsWith('level')){const target=action==='level100'?100:Math.min(100,inv.level+(action==='level10'?10:1));while(inv.level<target)inv.addXp(inv.xpToNext-inv.xp);}
    else if(action==='points')p.adminPoints+=50;
    else if(action==='cooldowns'){this.combat.noCooldown=!this.combat.noCooldown;this.combat.resetCooldowns();}
    else if(action==='god'){this.hero.godMode=!this.hero.godMode;if(!this.hero.alive)this.hero.respawn(this.terrain.spawnPoint);this.hero.heal(this.hero.maxHp);}
    else if(action==='onehit')this.combat.oneHitKill=!this.combat.oneHitKill;
    else if(action==='premium'){p.vipUntil=p.premiumUntil=Date.now()+30*86400000;}
    else if(action==='unlock'){p.owned=COSMETICS.map(c=>c.id);p.evolution.wingOwned=[...WING_STYLES];for(const style of WING_STYLES)p.evolution.wingLevels[style]=10;for(const c of COSMETICS)p.evolution.levels[c.id]=10;}
    else if(action==='mythic'){if(inv.items.length>=inv.capacity)return 'Mochila cheia';const item=scaleWorldItem(COMPLETE_ITEM_CATALOG.find(i=>i.rarity==='mythic'&&i.slot==='weapon')!,inv.level);item.id='admin-'+crypto.randomUUID();item.upgrade=15;item.attack*=4;item.defense*=4;item.maxHp*=4;item.sockets=['ruby','sapphire','emerald','diamond'];item.gemLevels=[2,2,2,2];inv.items.push(item);}
    else if(action==='monster'||action==='boss'){const point=this.hero.position.clone().addScaledVector(this.hero.facing,5);this.enemies.spawn(action==='boss'?'boss':'wolf',point,inv.level,action==='boss');}
    else if(action==='zone'){const region=REGIONS.find(r=>r.id===zone);if(!region)return 'Zona inválida';this.hero.teleportTo(new Vector3(region.center.x,this.terrain.heightAt(region.center.x,region.center.z)+1,region.center.z));}
    else if(action==='dungeon'){if(this.dungeon.active)return 'Dungeon já está ativa';const d=DUNGEONS.find(d=>d.region===zone)??DUNGEONS[0];this.hero.teleportTo(this.terrain.portalPosition.clone().add(new Vector3(0,2,0)));this.dungeon.start(this.hero,d,Math.max(inv.level,d.level));}
    else return 'Comando inválido';
    this.refreshStats();this.updateHUD();this.save();return 'Comando aplicado ao PvE local.';
  }
  private refreshStats(): void {
    if (!this.hero) return;
    const base = CLASS_DEFINITIONS[this.classId].stats;
    const equipment = this.inventory.getStatBonuses(), buildings = this.base.getBuffs(), codex = this.codex.getBuffs();
    const talents=this.progress.bonuses(this.classId);
    const evo=this.progress.evolution.buffs(this.progress.equipped.pet,this.progress.equipped.mount);this.hero.mountSpeedBoost=evo.speed;
    const effects=epigraphEffects(this.classId,this.progress.talents[this.classId]);
    this.hero.combatModifiers=effects;
    if(this.companions)this.companions.powerMultiplier=1+effects.companionPower;
    this.hero.setStats({ ...base,
      maxMana:base.maxMana+talents.maxMana+evo.maxMana+(equipment.maxMana??0),critChance:Math.min(.6,base.critChance+talents.critChance+evo.crit+(equipment.critChance??0)),
      attack: base.attack + talents.attack + evo.attack + equipment.attack + buildings.attack + codex.attack,
      defense: base.defense + talents.defense + evo.defense + equipment.defense + buildings.defense + codex.defense,
      maxHp: base.maxHp + talents.maxHp + evo.maxHp + equipment.maxHp + buildings.maxHp + codex.maxHp,
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
      let parent=object.parent,hero=false;while(parent){if(parent===this.hero.model||parent===this.hero.rig.root){hero=true;break;}parent=parent.parent;}
      const building=object.name==='Batched village architecture'||object.userData.majorBuilding===true;
      object.castShadow=(hero&&!object.name.includes('alpha wing'))||building;
      if(!object.receiveShadow&&!object.castShadow)return;
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
    const biome=({
      aurora:{zenith:'#648fa2',horizon:'#9baea0',ground:'#545d3b'},
      crypt:{zenith:'#4b4b65',horizon:'#827c90',ground:'#64546a'},
      highlands:{zenith:'#92c4d8',horizon:'#c2dce5',ground:'#92a8b5'},
      rift:{zenith:'#934b50',horizon:'#b67d69',ground:'#74544a'},
      eclipse:{zenith:'#3c3564',horizon:'#75609b',ground:'#554d71'}
    } as Record<string,{zenith:string;horizon:string;ground:string}>)[this.mapInstances.regionId];
    if(biome){
      top.lerp(new Color(biome.zenith),.44);
      horizon.lerp(new Color(biome.horizon),.4);
      this.hemisphere.color.set(biome.horizon);
      this.hemisphere.groundColor.set(biome.ground);
    }
    this.sky.update(this.elapsed, sun, top, horizon);
    this.csm.lightDirection.copy(sun).negate();
    if (this.csm.lightDirection.y > -0.15) this.csm.lightDirection.y = -0.15;
    this.csm.lights.forEach(light => { light.intensity = 0.24 + daylight * 2.5; light.color.set(daylight > 0.2 ? '#fff0d6' : '#8facd8'); });
    this.hemisphere.intensity = 1.25 + daylight * 1.15;
    this.scene.environmentIntensity=.64+daylight*.12;
    const fogColor = horizon.clone().multiplyScalar(0.72);
    (this.scene.fog as FogExp2).color.copy(fogColor);
    this.atmosphere.uniforms.fogColor.value.copy(fogColor);
    this.atmosphere.uniforms.sunDirection.value.copy(sun);
    (this.stars.material as PointsMaterial).opacity = Math.max(0, 0.8 - daylight * 2);
  }

  private updateHUD(): void {
    const boss = this.dungeon.active ? this.enemies.enemies.find(enemy => enemy.boss && enemy.alive && enemy.home.distanceTo(this.terrain.portalPosition)<25) : undefined;
    this.hud.update({
      hp: this.hero.hp, maxHp: this.hero.maxHp, mana: this.hero.mana, maxMana: this.hero.stats.maxMana,
      level: this.inventory.level, xp: this.inventory.xp, xpToNext: this.inventory.xpToNext,
      regionName:REGIONS.find(region=>region.id===this.mapInstances.regionId)!.name[this.progress.language==='pt'?0:1],
      classId: this.classId, state: this.hero.machine.state,
      gold: this.inventory.gold, crystals: this.inventory.crystals, items: this.inventory.items, equipment: this.inventory.equipment,
      buildings: this.base.buildings.map(building => ({ ...building, cost: this.base.cost(building.id) })),
      codex: this.codex.entries, cooldowns: this.combat.cooldowns, cooldownMax: this.combat.cooldownMax,
      player: { x: this.hero.position.x, z: this.hero.position.z, heading: Math.atan2(this.hero.facing.x, this.hero.facing.z) },
      enemies: this.enemies.enemies.filter(enemy => enemy.alive).map(enemy => ({ x: enemy.position.x, z: enemy.position.z, boss: enemy.boss })),
      markers: this.terrain.markers, dungeon: { active: this.dungeon.active, wave: this.dungeon.wave,floor:this.dungeon.floor,maxFloors:this.dungeon.maxFloors, status: this.dungeon.status },
      mounted: this.hero.mounted, fps: Math.round(this.fps), timeOfDay: this.timeOfDay, combo: this.combat.combo,
      boss: boss ? { name: 'Guardião do Vazio', hp: boss.hp, maxHp: boss.maxHp,
        phase: boss.hp / boss.maxHp > 0.65 ? 1 : boss.hp / boss.maxHp > 0.3 ? 2 : 3 } : undefined,
    });
  }

  private setQuality(quality: 'low' | 'high'): void {
    this.quality = quality;
    this.renderer.setPixelRatio(cappedPixelRatio(window.devicePixelRatio,matchMedia('(pointer:coarse)').matches,quality==='high'));this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, regionId:this.mapInstances.regionId, classId: this.classId, inventory: this.inventory.snapshot(), progress:this.progress.snapshot(), base: this.base.snapshot(), codex: this.codex.snapshot(), quests:this.quests.snapshot() }));
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
      this.progress.restore(save.progress);
      this.base.restore(save.base);
      this.codex.restore(save.codex);
      this.deferredQuestSave=save.quests;
      if(typeof save.regionId==='string'&&REGIONS.some(r=>r.id===save.regionId))this.restoredRegionId=save.regionId;
    } catch { /* Invalid or unavailable browser storage starts a fresh, playable session. */ }
  }

  /** Runtime diagnostics used by the documented browser smoke test. */
  get diagnostics(): { playing: boolean; quality: string;fps:number;pixelRatio:number;activeEnemies:number; drawCalls: number; triangles: number; enemies: number; drops: number; position: number[] } {
    return { playing: this.playing, quality: this.quality, fps:this.fps,pixelRatio:this.renderer.getPixelRatio(),activeEnemies:this.enemies.enemies.filter(e=>e.alive&&!e.dormant).length, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, enemies: this.enemies.enemies.filter(enemy => enemy.alive).length, drops: this.drops.length, position: this.hero.position.toArray() };
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.save();
    this.disposers.splice(0).forEach(dispose => dispose());
    this.admin.dispose();this.gacha.dispose();this.journal.dispose();this.hudEditor.dispose();this.hub.dispose();this.i18n.dispose();
    this.lootFeed.dispose();
    this.hud.dispose();
    this.questTracker.dispose();this.npcs.dispose();this.portals.dispose();
    this.regionTravel.dispose();this.portalVfx.dispose();
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
