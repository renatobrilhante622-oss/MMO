import {retainAppearanceAssets,releaseAppearanceAssets} from './AppearanceResources';
import {
  AnimationAction, AnimationClip, AnimationMixer, Box3, Color, Group, LoopOnce, Mesh, MeshBasicMaterial, MeshStandardMaterial,SkinnedMesh,
  Object3D, Vector3,
} from 'three';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createFootPivot, disableCharacterCulling } from '../player/PlayerRenderer';
import type { ClassDefinition } from '../core/GameTypes';
import {clearWeaponSlots} from '../player/ClassVisualIdentity';

export type ModelName =
  | 'Soldier' | 'Horse' | 'Parrot'
  | 'KayKit_Barbarian' | 'KayKit_Knight' | 'KayKit_Mage'
  | 'KayKit_Rogue' | 'KayKit_Rogue_Hooded'
  | 'KayKit_Skeleton_Minion' | 'KayKit_Skeleton_Warrior'
  | 'Quaternius_ghost' | 'Quaternius_demon' | 'Quaternius_bat'
  | 'Creature_wyvern' | 'Creature_horse' | 'Creature_wolf'
  | 'Creature_slime' | 'Creature_golem' | 'Creature_dragon'
  | 'Creature_stag' | 'Creature_warhorse' | 'Creature_whitehorse'
  | 'Creature_pet_fox' | 'Creature_pet_hellhound' | 'Creature_pet_fairy'
  | 'Creature_pet_babygolem' | 'Creature_pet_dracolich';

import {loadSharedModel,actorClonePool,resetPooledActor} from './ModelResources';
import {registerActor,actorIsVisible} from '../core/ActorVisibility';
const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function modelAssetPath(name:ModelName):string {
  const folder=name.startsWith('Quaternius_')?'models/environment/':name.startsWith('Creature_')?'models/creatures/':'models/';
  // Retire both the retrofitted 704-triangle horse and the unrigged farm horse.
  const replacement=['Creature_horse','Creature_warhorse','Horse'].includes(name)
    ?'models/pr17-source/ImperialHorse.glb':name==='Creature_stag'?'models/pr22/ImperialStag.glb':name==='Creature_dragon'?'models/creatures/Creature_wyvern.glb':name==='Creature_whitehorse'?'models/pr17-source/ImperialHorseWhite.glb':null;
  return replacement??folder+name+'.glb';
}

export function loadModel(name:ModelName):Promise<GLTF>{return loadSharedModel(modelAssetPath(name));}

/**
 * Reuses shared GLB geometry/textures while giving every animated actor its own
 * skeleton, mixer and material instances. No procedural character mesh is created.
 */
export class AnimatedGLB {
  readonly root = new Group();
  ready = false;
  failed=false;

  private mixer?: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly clips = new Map<string, AnimationClip>();
  private active?: AnimationAction;
  private activeKey = '';
  private materials: Array<{ material: MeshStandardMaterial; original: Color; originalEmissive: Color; originalEmissiveIntensity: number }> = [];
  private disposed = false;
  private unregister?:()=>void;
  private readonly attachments=new Set<Object3D>();
  private readonly sourceMaterials=new Map<Mesh,Mesh['material']>();
  private poolKey='';
  private attackTime = 0;
  private model?: Object3D;
  private readonly creaturePhase={value:0};
  private readonly creatureStride={value:0};
  private readonly creatureTime={value:0};
  private readonly creatureAttack={value:0};
  private readonly staticCreature:boolean;
  private baseColor = new Color(0x617080);
  private accent = new Color(0x9c7dcc);
  private readonly preservedPalette: boolean;
  private attackWeapon:ClassDefinition['weapon']='sword';
  private classPalette=new Color(0xffffff);
  private cosmeticTint=new Color(0xffffff);
  private cosmeticStrength=0;
  private readonly hitColor = new Color(0xff6b6b);

  constructor(
    readonly name: ModelName,
    private readonly height: number,
    private readonly onReady: () => void,
    private readonly castShadow = false,
  ) {
    this.root.name = 'GLB ' + name;
    this.preservedPalette = name.startsWith('KayKit_') || name.startsWith('Creature_') || name==='Horse' || name==='Parrot';
    this.staticCreature=name.startsWith('Creature_')&&name!=='Creature_wolf';
    // Browser-only I/O. Vitest/server-side execution never requests graphics.
    if (typeof document === 'undefined') return;
    void this.importModel(name);
  }

  private async importModel(name: ModelName): Promise<void> {
    let gltf: GLTF;
    try {
      gltf = await loadModel(name);
    } catch (error) {
      if(this.disposed)return;
      // A missing pet/mount must never turn into an unrelated human soldier.
      // The shared cache drops rejected requests; retry the same authored asset.
      console.warn('Retrying authored 3D actor:',name,error);
      try{gltf=await loadModel(name);}catch(retryError){
        this.failed=true;console.error('Cannot load 3D actor asset:',name,retryError);return;
      }
    }
    if (this.disposed) return;
    this.poolKey=gltf.scene.uuid;
    const model = this.model = actorClonePool.acquire(this.poolKey)??clone(gltf.scene);
    resetPooledActor(model);retainAppearanceAssets(model);
    this.unregister=registerActor(this.root,this.height);
    if(name.startsWith('KayKit_'))clearWeaponSlots(model);
    const pivot = createFootPivot(model, this.height, name === 'Soldier' ? Math.PI : 0);
    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = this.castShadow;
      object.receiveShadow = this.castShadow;
      object.frustumCulled = false;
      const isolated = (source: MeshStandardMaterial|MeshBasicMaterial): MeshStandardMaterial => {
        const material = source instanceof MeshStandardMaterial?source.clone():new MeshStandardMaterial({color:source.color??0xffffff,map:source.map??null});
        this.materials.push({ material, original: source.color.clone(), originalEmissive: material.emissive.clone(), originalEmissiveIntensity: material.emissiveIntensity });
        if(this.staticCreature && gltf.animations.length===0 && object.geometry?.attributes.position){
          // Non-skinned GLBs have no bones. A vertex shader gives a small,
          // reversible breathing / hoof / membrane deformation in local space.
          // This must not be mistaken for a sourced skeletal gallop animation.
          object.geometry.computeBoundingBox();
          const bounds=object.geometry.boundingBox;
          if(bounds){
            const extent=bounds.getSize(new Vector3());
            const wing=name==='Creature_wyvern'||name==='Creature_dragon';
            const px=bounds.getCenter(new Vector3());
            const pY=bounds.min.y;
            material.onBeforeCompile=(shader)=>{
              shader.uniforms.creaturePhase=this.creaturePhase;
              shader.uniforms.creatureStride=this.creatureStride;
              shader.uniforms.creatureTime=this.creatureTime;
              shader.uniforms.creatureAttack=this.creatureAttack;
              shader.vertexShader='uniform float creaturePhase, creatureStride, creatureTime, creatureAttack;\n'+shader.vertexShader;
              shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
                `#include <begin_vertex>
                  float bodyH=clamp((position.y-(${pY.toFixed(6)}))/${Math.max(.0001,extent.y).toFixed(6)},0.,1.);
                  float sideX=(position.x-(${px.x.toFixed(6)}))/${Math.max(.0001,extent.x).toFixed(6)};
                  float breath=sin(creatureTime*2.2)*.006;
                  transformed.y+=breath*${Math.max(.001,extent.y).toFixed(6)}*bodyH;
                  ${wing? `float membrane=smoothstep(.15,.42,abs(sideX))*smoothstep(.35,.7,bodyH);
                     transformed.y+=sin(creatureTime*2.6+abs(sideX)*3.2)*membrane*.052*${Math.max(.001,extent.y).toFixed(6)};`:
                     `float paws=(1.-smoothstep(.18,.37,bodyH))*creatureStride;
                      float lateral=sign(sideX);
                      float front=sign(position.z-(${px.z.toFixed(6)}));
                      float cycle=creaturePhase*1.45+(front<0.?3.14159:0.)+(lateral<0.?1.5708:0.);
                      transformed.z+=sin(cycle)*paws*.23*${Math.max(.001,extent.z).toFixed(6)};
                      transformed.y+=max(0.,cos(cycle))*paws*.075*${Math.max(.001,extent.y).toFixed(6)};
                      transformed.z+=creatureAttack*smoothstep(.3,.65,bodyH)*abs(sideX)*.16*${Math.max(.001,extent.z).toFixed(6)};`}
                `);
            };
            material.customProgramCacheKey=()=>wing?'eterna-dragon-membrane-v1':'eterna-ungaited-quadruped-v1';
          }
        }
        return material;
      };
      this.sourceMaterials.set(object,object.material);
      object.material = Array.isArray(object.material)
        ? object.material.map(material => isolated(material as MeshStandardMaterial))
        : isolated(object.material as MeshStandardMaterial);
    });
    this.root.add(pivot);
    this.mixer = new AnimationMixer(model);
    // 75+ clips per character: create mixer actions lazily to avoid O(actors * clips) cost.
    for (const clip of gltf.animations) this.clips.set(clip.name.toLowerCase(), clip);
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
    // Imported clips are often prefixed by their armature (AnimalArmature|Gallop,
    // CharacterArmature|Fast_Flying). Match semantic suffixes before fallback.
    const animal=this.name.startsWith('Creature_');
    const flyer=this.name==='Creature_dragon'||this.name==='Creature_wyvern';
    const attacks:Record<ClassDefinition['weapon'],string[]>={
      axe:['2h_melee_attack_chop','1h_melee_attack_chop'],
      sword:['1h_melee_attack_slice_horizontal','1h_melee_attack_chop'],
      daggers:['dualwield_melee_attack_slice','dualwield_melee_attack_stab'],
      bow:['2h_ranged_shoot','1h_ranged_shoot','2h_ranged_shooting'],
      staff:['spellcast_shoot','spellcast_long'],
      scythe:['2h_melee_attack_slice','spellcast_shoot'],
      fists:['unarmed_melee_attack_punch_a','unarmed_melee_attack_punch_b'],
      lance:['2h_melee_attack_stab','1h_melee_attack_stab'],
      orb:['spellcast_shoot','spellcast_raise'],
    };
    const candidates:Record<string,string[]>={
      idle:flyer?['flying_idle','idle','idle_b']:['idle','idle_b','idle_combat','unarmed_idle','2h_melee_idle'],
      walk:flyer?['fast_flying','flying_idle']:['walking_a','walking_b','walk','gallop'],
      run:flyer?['fast_flying','flying_idle']:this.name==='Creature_horse'?['gallop','run','walk']:['running_a','running_b','run','gallop','walk'],
      gather:['interact','pick_up','spellcast_long','idle'],
      mounted:['sit_chair_idle','sit_chair_pose','idle'],
      slide:['dodge_forward','idle'],
      jump:['jump_idle','jump_full_short','jump','idle'],
      dead:['death_a_pose','death_a','death','dead'],
      attack:animal?['attack','bite_front','punch','headbutt','bite']:attacks[this.attackWeapon],
    };
    const findClip=(candidate:string):AnimationClip|undefined=>{
      const exact=this.clips.get(candidate.toLowerCase());
      if(exact)return exact;
      const match=normalize(candidate);
      for(const [key,clip] of this.clips){
        const normalized=normalize(key);
        if(normalized===match||normalized.endsWith(match))return clip;
      }
      return undefined;
    };
    for(const candidate of candidates[state]??[state]){
      const clip=findClip(candidate);
      if(!clip)continue;
      const key=clip.name.toLowerCase();
      let action=this.actions.get(key);
      if(!action&&this.mixer){action=this.mixer.clipAction(clip);this.actions.set(key,action);}
      if(action)return {action,key};
    }
    const fallbackClip=this.clips.get('idle')??this.clips.values().next().value;
    if(!fallbackClip||!this.mixer)return undefined;
    const key=fallbackClip.name.toLowerCase();
    let action=this.actions.get(key);
    if(!action){action=this.mixer.clipAction(fallbackClip);this.actions.set(key,action);}
    return {action,key};
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
    socket.add(object);this.attachments.add(object);
    object.position.copy(offset).multiply(inverse);
    object.scale.copy(authored).multiply(inverse);
    disableCharacterCulling(object);
    return true;
  }

  detachAttachment(object:Object3D):void{this.attachments.delete(object);object.removeFromParent();}
  get attachmentCount():number{return this.attachments.size;}

  /** Real post-normalization 3D dimensions: excludes hidden procedural art. */
  getVisibleBounds():Box3|null{
    if(!this.ready)return null;
    this.root.updateWorldMatrix(true,true);
    const bounds=new Box3().setFromObject(this.root);
    return bounds.isEmpty()?null:bounds;
  }
  get animationCount():number{return this.clips.size;}
  /** Palette safety: keep each author's diffuse + texture atlas distinct. */
  setCompanionAppearance(color:number,hellhound=false,strength=.045):void{
    const tint=new Color(color);
    for(const {material,original,originalEmissive,originalEmissiveIntensity} of this.materials){
      material.color.copy(original).lerp(tint,hellhound?.11:strength);
      material.metalness=Math.min(.12,material.metalness);
      material.roughness=Math.max(.72,material.roughness);
      material.emissive.copy(originalEmissive);
      material.emissiveIntensity=originalEmissiveIntensity;
      if(strength>.1){material.color.multiplyScalar(.65);material.emissiveIntensity*=.15;}
      if(hellhound){
        // Animated, narrow emissive magma fissures; original wolf PBR
        // normal/albedo remain untouched and no Canvas texture is generated.
        material.color.multiplyScalar(.43);
        material.emissive.setHex(0xff3b07);
        material.emissiveIntensity=.26;
        material.onBeforeCompile=shader=>{
          shader.uniforms.creatureTime=this.creatureTime;
          shader.vertexShader='varying vec3 vHellCoord;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\n vHellCoord=position.xyz;');
          shader.fragmentShader='varying vec3 vHellCoord; uniform float creatureTime;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
             float fault = abs(sin(vHellCoord.y*17. + sin(vHellCoord.z*13.)*.9 + vHellCoord.x*7.));
             float seam = pow(1.-fault,26.)*smoothstep(.08,.34,abs(vHellCoord.y));
             outgoingLight += vec3(1.6,.22,.018)*seam*(.65+.35*sin(creatureTime*2.4));
             #include <opaque_fragment>
          `);
        };
        material.customProgramCacheKey=()=> 'eterna-hellhound-magma-v1';
      }else if(this.name==='Creature_wolf'){
        material.onBeforeCompile=()=>{};
        material.customProgramCacheKey=()=> 'eterna-wolf-authored-pbr-v1';
      }
      material.needsUpdate=true;
    }
  }
  setRegaliaStyle(color:number,metal:boolean):void {
    if(!this.name.startsWith('KayKit_'))return;
    for(const {material}of this.materials){
      material.metalness=metal?.65:.18;material.roughness=metal?.36:.63;
      material.onBeforeCompile=shader=>{
        shader.uniforms.regaliaTint={value:new Color(color)};shader.fragmentShader='uniform vec3 regaliaTint;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          float flesh=step(diffuseColor.g,diffuseColor.r*.84)*step(diffuseColor.b,diffuseColor.r*.78)*step(.25,diffuseColor.r);
          float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(diffuseColor.rgb,regaliaTint*(.13+lum*.9),(1.-flesh)*.92);`);
      };material.customProgramCacheKey=()=>`regalia-${color}-${metal}`;material.needsUpdate=true;
    }
  }
  clearWeaponSlots():number{return this.model?clearWeaponSlots(this.model):0;}
  setClassPalette(color:number):void{this.classPalette.setHex(color);this.tint(this.baseColor.getHex(),this.accent.getHex());}
  setCosmeticPalette(color:number,rarity:number):void{
    this.cosmeticTint.setHex(color);
    this.cosmeticStrength=Math.min(.76,Math.max(0,rarity)*.055);
    this.tint(this.baseColor.getHex(),this.accent.getHex());
  }

  tint(color: number, accent: number): void {
    this.baseColor.setHex(color);
    this.accent.setHex(accent);
    for (const { material, original } of this.materials) {
      if (this.preservedPalette) {
        // Preserve original albedo and atlas 1:1, including during parent changes
        // to a saddle: tinting lit atlas texels can wash details out on Android.
        material.color.copy(original).multiply(this.classPalette);
        if(this.name.startsWith('KayKit_')&&this.cosmeticStrength>0)
          material.color.lerp(original.clone().multiply(this.cosmeticTint),this.cosmeticStrength);
        material.roughness=Math.max(.67,material.roughness);
        material.metalness=Math.min(.22,material.metalness);
        if(material.map)material.map.needsUpdate=material.map.version===0;
      } else {
        material.color.copy(this.baseColor).lerp(this.accent, 0.18);
      }
    }
  }

  /** Real GLB materials flash in sync with authoritative enemy HP loss. */
  setHitFlash(strength: number): void {
    const flash = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0));
    for (const entry of this.materials) {
      entry.material.emissive.copy(entry.originalEmissive).lerp(this.hitColor, flash);
      entry.material.emissiveIntensity = flash > 0 ? Math.max(1, entry.originalEmissiveIntensity) : entry.originalEmissiveIntensity;
    }
  }

  play(state: string): void {
    const found = this.findAction(state);
    if (!found || (this.active === found.action && this.activeKey === state)) return;
    const { action } = found;
    if (state === 'attack' || state === 'slide' || state === 'jump' || state === 'dead') {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action.reset().setEffectiveWeight(1).play();
    if (this.active && this.active !== action) this.active.crossFadeTo(action, 0.12, false);
    this.active = action;
    this.activeKey = state;
  }

  setAttackWeapon(weapon:ClassDefinition['weapon']):void {this.attackWeapon=weapon;}

  attack(): void {
    if (!this.ready || this.disposed) return;
    const selected = this.findAction('attack');
    this.attackTime = selected ? Math.min(1.25, Math.max(0.18, selected.action.getClip().duration)) : .45;
    if(selected && this.active===selected.action && this.activeKey==='attack'){
      // A new accepted combo strike restarts its own keyframed attack.
      selected.action.reset().play();
    }else this.play('attack');
  }

  update(dt: number, speed: number, riding = false, locomotion?: string): void {
    if (!this.ready || !actorIsVisible(this.root)) return;
    const step = Math.min(.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    this.creatureTime.value+=step;
    this.creatureStride.value=Math.min(1,Math.max(0,speed));
    this.creaturePhase.value+=step*(2.5+speed*8);
    const target = locomotion === 'dead' ? 'dead' : locomotion === 'gather' ? 'gather'
      : riding ? 'mounted'
      : locomotion === 'slide' ? 'slide'
      : locomotion === 'jump' || locomotion === 'doubleJump' || locomotion === 'fall' ? 'jump'
      : speed > .65 ? 'run' : speed > .05 ? 'walk' : 'idle';
    if (this.attackTime > 0 && !riding && target !== 'dead') this.attackTime = Math.max(0, this.attackTime - step);
    else this.attackTime = 0;
    const state = this.attackTime > 0 ? 'attack' : target;
    this.play(state);
    if (this.active) this.active.timeScale = state === 'run' ? Math.min(1.6, Math.max(0.8, speed + .25)) : 1;
    this.creatureAttack.value=this.attackTime>0?Math.sin((1-this.attackTime)*10):0;
    this.mixer?.update(step);
  }

  dispose(): void {
    if(this.disposed)return;
    this.disposed = true;this.unregister?.();
    for(const object of this.attachments)object.removeFromParent();this.attachments.clear();
    this.mixer?.stopAllAction();
    if (this.model) this.mixer?.uncacheRoot(this.model);
    for(const [mesh,material] of this.sourceMaterials)mesh.material=material;
    this.sourceMaterials.clear();
    if(this.model){const skeletons=new Set<SkinnedMesh['skeleton']>();this.model.traverse(n=>{if(n instanceof SkinnedMesh)skeletons.add(n.skeleton);});skeletons.forEach(s=>s.dispose());releaseAppearanceAssets(this.model);this.model.removeFromParent();actorClonePool.release(this.poolKey,this.model);this.model=undefined;}
    this.materials.forEach(({ material }) => material.dispose());
    this.materials.length = 0;
    this.actions.clear();
    this.clips.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
