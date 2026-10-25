import {
  AnimationAction, AnimationMixer, Color, Group, LoopOnce, Mesh, MeshStandardMaterial,
  Object3D, Vector3,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createFootPivot, disableCharacterCulling } from '../player/PlayerRenderer';

export type ModelName =
  | 'Soldier' | 'Horse' | 'Parrot'
  | 'KayKit_Barbarian' | 'KayKit_Knight' | 'KayKit_Mage'
  | 'KayKit_Rogue' | 'KayKit_Rogue_Hooded'
  | 'KayKit_Skeleton_Minion' | 'KayKit_Skeleton_Warrior';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function loadModel(name: ModelName): Promise<GLTF> {
  const url = import.meta.env.BASE_URL + 'models/' + name + '.glb';
  let request = cache.get(url);
  if (!request) {
    request = loader.loadAsync(url);
    cache.set(url, request);
    void request.catch(() => cache.delete(url));
  }
  return request;
}

/**
 * Reuses shared GLB geometry/textures while giving every animated actor its own
 * skeleton, mixer and material instances. No procedural character mesh is created.
 */
export class AnimatedGLB {
  readonly root = new Group();
  ready = false;

  private mixer?: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private active?: AnimationAction;
  private activeKey = '';
  private materials: Array<{ material: MeshStandardMaterial; original: Color; originalEmissive: Color; originalEmissiveIntensity: number }> = [];
  private disposed = false;
  private attackTime = 0;
  private model?: Object3D;
  private baseColor = new Color(0x617080);
  private accent = new Color(0x9c7dcc);
  private readonly preservedPalette: boolean;

  constructor(
    readonly name: ModelName,
    private readonly height: number,
    private readonly onReady: () => void,
    private readonly castShadow = false,
  ) {
    this.root.name = 'GLB ' + name;
    this.preservedPalette = name.startsWith('KayKit_');
    // Browser-only I/O. Vitest/server-side execution never requests graphics.
    if (typeof document === 'undefined') return;
    void this.importModel(name);
  }

  private async importModel(name: ModelName): Promise<void> {
    let gltf: GLTF;
    try {
      gltf = await loadModel(name);
    } catch (error) {
      if (name === 'Soldier' || this.disposed) {
        console.error('Cannot load 3D actor asset:', name, error);
        return;
      }
      // Existing local real GLB is a visual safety fallback, never a generated dummy.
      console.warn('Falling back to local Soldier GLB for:', name);
      try { gltf = await loadModel('Soldier'); }
      catch { return; }
    }
    if (this.disposed) return;
    const model = this.model = clone(gltf.scene);
    const pivot = createFootPivot(model, this.height, name === 'Soldier' ? Math.PI : 0);
    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = this.castShadow;
      object.receiveShadow = this.castShadow;
      object.frustumCulled = false;
      const isolated = (source: MeshStandardMaterial): MeshStandardMaterial => {
        const material = source.clone();
        this.materials.push({ material, original: source.color.clone(), originalEmissive: source.emissive.clone(), originalEmissiveIntensity: source.emissiveIntensity });
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(material => isolated(material as MeshStandardMaterial))
        : isolated(object.material as MeshStandardMaterial);
    });
    this.root.add(pivot);
    this.mixer = new AnimationMixer(model);
    for (const clip of gltf.animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    this.ready = true;
    this.tint(this.baseColor.getHex(), this.accent.getHex());
    this.play('idle');
    this.mixer.update(0);
    this.onReady();
    let ancestor: Object3D | null = this.root;
    while (ancestor) {
      ancestor.userData.characterRevision = (ancestor.userData.characterRevision ?? 0) + 1;
      ancestor = ancestor.parent;
    }
  }

  private findAction(state: string): { action: AnimationAction; key: string } | undefined {
    const candidates: Record<string, string[]> = {
      idle: ['idle', 'idle_b', 'idle_combat', 'unarmed_idle', '2h_melee_idle'],
      walk: ['walking_a', 'walking_b', 'walk'],
      run: ['running_a', 'running_b', 'run'],
      mounted: ['sit_chair_idle', 'sit_chair_pose', 'idle'],
      slide: ['dodge_forward', 'idle'],
      jump: ['jump_idle', 'jump_full_short', 'idle'],
      dead: ['death_a_pose', 'death_a', 'idle'],
      attack: this.name.includes('Mage')
        ? ['spellcast_shoot', 'spellcast_long', '1h_melee_attack_chop']
        : this.name.includes('Rogue')
          ? ['dualwield_melee_attack_slice', '1h_ranged_shoot', '1h_melee_attack_slice_horizontal']
          : this.name.includes('Barbarian')
            ? ['2h_melee_attack_chop', '2h_melee_attack_slice', '1h_melee_attack_chop']
            : ['1h_melee_attack_slice_horizontal', '1h_melee_attack_chop', 'unarmed_melee_attack_punch_a'],
    };
    for (const candidate of candidates[state] ?? [state]) {
      const action = this.actions.get(candidate);
      if (action) return { action, key: candidate };
    }
    const fallback = this.actions.get('idle') ?? this.actions.values().next().value;
    return fallback ? { action: fallback, key: 'fallback' } : undefined;
  }

  attachAt(name: string, object: Object3D, offset = new Vector3()): boolean {
    const desired = normalize(name);
    let socket: Object3D | undefined;
    const aliases: Record<string, string[]> = {
      righthand: ['righthand', 'handr', 'rhand', 'rightwrist', 'wristr'],
      lefthand: ['lefthand', 'handl', 'lhand', 'leftwrist', 'wristl'],
      head: ['head', 'headend'],
      spine2: ['spine2', 'spine02', 'upperchest', 'chest'],
    };
    this.model?.traverse(node => {
      const n = normalize(node.name);
      if (!socket && (aliases[desired] ?? [desired]).some(alias => n === alias || n.endsWith(alias))) socket = node;
    });
    if (!socket) return false;
    this.root.updateMatrixWorld(true);
    const size = socket.getWorldScale(new Vector3());
    const inverse = new Vector3(
      1 / Math.max(0.0001, Math.abs(size.x)),
      1 / Math.max(0.0001, Math.abs(size.y)),
      1 / Math.max(0.0001, Math.abs(size.z)),
    );
    const authored = (object.userData.authoredScale as Vector3 | undefined) ?? object.scale.clone();
    object.userData.authoredScale = authored;
    socket.add(object);
    object.position.copy(offset).multiply(inverse);
    object.scale.copy(authored).multiply(inverse);
    disableCharacterCulling(object);
    return true;
  }

  tint(color: number, accent: number): void {
    this.baseColor.setHex(color);
    this.accent.setHex(accent);
    for (const { material, original } of this.materials) {
      if (this.preservedPalette) {
        // Retain KayKit's authored atlas and distinguish actual character designs.
        material.color.copy(original).lerp(this.accent, material.map ? 0.035 : 0.12);
      } else {
        material.color.copy(this.baseColor).lerp(this.accent, 0.18);
      }
    }
  }

  /** Real GLB materials flash in sync with authoritative enemy HP loss. */
  setHitFlash(strength: number): void {
    const flash = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0));
    const hit = new Color(0xff6b6b);
    for (const entry of this.materials) {
      entry.material.emissive.copy(entry.originalEmissive).lerp(hit, flash);
      entry.material.emissiveIntensity = flash > 0 ? Math.max(1, entry.originalEmissiveIntensity) : entry.originalEmissiveIntensity;
    }
  }

  play(state: string): void {
    const found = this.findAction(state);
    if (!found || (this.active === found.action && this.activeKey === state)) return;
    const { action } = found;
    if (state === 'attack' || state === 'slide' || state === 'jump') {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action.reset().setEffectiveWeight(1).play();
    if (this.active && this.active !== action) this.active.crossFadeTo(action, 0.12, false);
    this.active = action;
    this.activeKey = state;
  }

  attack(): void {
    if (!this.ready || this.disposed) return;
    const selected = this.findAction('attack');
    this.attackTime = selected ? Math.min(1.25, Math.max(0.18, selected.action.getClip().duration)) : .45;
    this.play('attack');
  }

  update(dt: number, speed: number, riding = false): void {
    if (!this.ready || !this.root.visible) return;
    const step = Math.min(.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const target = riding ? 'mounted' : speed > .65 ? 'run' : speed > .05 ? 'walk' : 'idle';
    if (this.attackTime > 0 && !riding) this.attackTime = Math.max(0, this.attackTime - step);
    else this.attackTime = 0;
    const state = this.attackTime > 0 ? 'attack' : target;
    this.play(state);
    if (this.active) this.active.timeScale = state === 'run' ? Math.min(1.6, Math.max(0.8, speed + .25)) : 1;
    this.mixer?.update(step);
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.model) this.mixer?.uncacheRoot(this.model);
    this.materials.forEach(({ material }) => material.dispose());
    this.materials.length = 0;
    this.actions.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
