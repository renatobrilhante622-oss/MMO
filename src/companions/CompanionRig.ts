import {Group,Mesh,MeshStandardMaterial,Vector3,Box3,Raycaster,Color} from 'three';
import {AnimatedGLB,type ModelName} from '../assets/AnimatedGLB';
import {loadSharedModel} from '../assets/ModelResources';
import {retainAppearanceAssets,releaseAppearance} from '../assets/AppearanceResources';
import {catalogSkin} from '../player/SkinCatalog';
import {RarityAura} from './RarityAura';
import {actorIsVisible,registerActor} from '../core/ActorVisibility';
import type {Cosmetic} from '../progression/AdventureProgress';
import {RARITIES} from '../rpg/InventoryAndLoot';
export function companionAssetFor(id:string,riding:boolean):ModelName {
  if(riding){
    const model=catalogSkin(id)?.mountModel;if(model)return model;
    if(['stag','spiritstag'].includes(id))return 'Creature_stag';
    if(['wyvern','ashdrake'].includes(id))return 'Creature_wyvern';
    if(id==='eternalhorse')return 'Creature_dragon';
    if(['nighthorse','fenrir','obsidianwolf'].includes(id))return 'Creature_wolf';
    if(['sunhorse','magmahorse'].includes(id))return 'Creature_warhorse';
    if(['frosthorse','lunarhorse'].includes(id))return 'Creature_whitehorse';
    if(id==='nightmare')return 'Creature_horse';
    return 'Creature_horse';
  }
  if(['phoenix','frostphoenix'].includes(id))return 'Parrot';
  if(id==='dracolich')return 'Creature_pet_dracolich';
  if(['fox','emberfox'].includes(id))return 'Creature_pet_fox';
  if(['spiritwolf','moonwolf'].includes(id))return 'Creature_pet_fairy';
  if(id==='ashwolf')return 'Creature_pet_babygolem';
  return 'Creature_pet_hellhound';
}

/** Exclusively authored GLBs. An empty loading socket is never replaced by a primitive animal. */
export class CompanionRig {
 readonly root=new Group();readonly saddle=new Group();
 private imported?:AnimatedGLB;private importedType='';private appearanceId='';private currentCosmetic?:Cosmetic;
 private readonly importedProps=new Group();private readonly importedPropMaterials=new Set<MeshStandardMaterial>();
 private readonly particles=new RarityAura(.8);private propRevision=0;private disposed=false;
 private readonly unregisterVisibility:()=>void;private readonly raycaster=new Raycaster();
 private readonly ownOrigin=new Vector3();private readonly worldScale=new Vector3();private readonly bodyBoundsCenter=new Vector3();
 private saddleRestY=1.6;private footprintRadius=1.65;
 get safeFootprintRadius():number{return this.footprintRadius;}
 get saddleHeight():number{return this.saddle.position.y;}
 get loadedModel():boolean{return !!this.imported?.ready;}
 get failed():boolean{return this.imported?.failed??false;}
 constructor(readonly horse:boolean){
  this.root.name=horse?'Authored organic mount':'Authored pet';this.saddle.name='mountSaddleNode';this.saddle.userData.socket='MountSocket';this.saddle.position.y=1.6;
  this.root.add(this.importedProps,this.particles);if(horse)this.root.add(this.saddle);
  this.unregisterVisibility=registerActor(this.root,horse?3.5:1.9);
 }
 appearance(c:Cosmetic):void {
  if(this.disposed)return;this.currentCosmetic=c;if(this.appearanceId===c.id)return;this.appearanceId=c.id;
  this.clearImportedProps();this.root.userData.saddleMeasured=false;this.particles.configure(RARITIES.indexOf(c.rarity),c.color);
  const importedType=companionAssetFor(c.id,this.horse);
  if(importedType!==this.importedType){
   this.imported?.dispose();this.importedType=importedType;
   const dragon=['Creature_dragon','Creature_wyvern'].includes(importedType),wolf=importedType==='Creature_wolf';
   const asset=new AnimatedGLB(importedType,this.horse?(dragon?3.45:wolf?2.6:2.35):importedType==='Parrot'?1.45:1.85,()=>{
    if(this.disposed||this.imported!==asset)return;const current=this.currentCosmetic!;
    asset.setCompanionAppearance(current.color,current.id==='hellhound',current.id.startsWith('steed-')?.36:.045);
    this.updateSaddleFromGLB();this.installImportedProps(current);
   },this.horse);
   this.imported=asset;this.root.add(asset.root);
  }
  this.imported?.setCompanionAppearance(c.color,c.id==='hellhound',c.id.startsWith('steed-')?.36:.045);
  if(this.imported?.ready)this.installImportedProps(c);this.root.name=c.name[1];
 }
 private clearImportedProps():void {
  this.propRevision++;for(const p of [...this.importedProps.children])releaseAppearance(p);
  for(const m of this.importedPropMaterials)m.dispose();this.importedPropMaterials.clear();
 }
  /** Real CC0 authored metalwork/crystals, visible in BOTH gameplay and Collection. */
  private installImportedProps(c:Cosmetic):void {
    if(typeof document==='undefined')return;
    this.clearImportedProps();
    const token=this.propRevision;
    const shield='models/weapon-packs/Kenney_dungeon_shield_round.glb';
    const gem='models/equipment/CC0_crystal_gems.glb';
    const helmet='models/equipment/CC0_knight_helmet.glb';
    const extras:Array<{file:string;xyz:[number,number,number];scale:number;rot?:number;tint?:number}>=[];
    const armored=c.id.startsWith('steed-')||['sunhorse','nightmare','magmahorse','lunarhorse','frosthorse'].includes(c.id);
    const crystal=c.id.startsWith('steed-')||['fenrir','obsidianwolf','nighthorse','spiritstag','eternalhorse','wyvern','ashdrake','nightmare'].includes(c.id);
    if(this.horse&&armored){
      for(const sign of [-1,1]){
        extras.push({file:shield,xyz:[sign*.38,1.12,-.20],scale:.42,rot:sign*Math.PI/2,tint:c.id==='nightmare'?0x3b254f:0xd2d6e1});
        extras.push({file:shield,xyz:[sign*.32,1.55,-.45],scale:.21,rot:sign*Math.PI/2,tint:c.color});
      }

    }
    if(this.horse&&crystal){
      for(const sign of [-1,1]){
        extras.push({file:gem,xyz:[sign*.45,1.8,-.55],scale:c.id==='fenrir'?.36:.24,tint:c.color});
        extras.push({file:gem,xyz:[sign*.3,1.66,-.02],scale:.23,tint:c.color});
      }
    }
    if(this.horse&&['wyvern','ashdrake','eternalhorse'].includes(c.id)){
      extras.push({file:shield,xyz:[0,this.saddleRestY-.15,this.saddle.position.z],scale:.80,tint:c.id==='wyvern'?0xa79c78:0x5c4a64});
    }
    if(!this.horse&&['dracolich','phoenix','frostphoenix','hellhound'].includes(c.id)){
      extras.push({file:gem,xyz:[0,1.54,-.20],scale:.23,tint:c.color});
    }
    // Materials are cloned, but the authored GLB triangle geometry is shared
    // through the loader cache. No proxy shapes are rendered over real actors.
    for(const spec of extras){
      void loadSharedModel(spec.file).then(gltf=>{
        if(this.disposed||this.propRevision!==token)return;
        const model=gltf.scene.clone(true);retainAppearanceAssets(model);
        const bounds=new Box3().setFromObject(model);
        if(bounds.isEmpty())return;
        const extent=bounds.getSize(new Vector3());
        const factor=spec.scale/Math.max(.001,Math.max(extent.x,extent.y,extent.z));
        model.scale.setScalar(factor);
        model.position.set(...spec.xyz);
        if(spec.rot)model.rotation.y=spec.rot;
        model.traverse(node=>{
          if(!(node instanceof Mesh))return;
          node.castShadow=this.horse;
          const original=Array.isArray(node.material)?node.material:[node.material];
          const copy=original.map(material=>{
            if(!(material instanceof MeshStandardMaterial))return material;
            const cloned=material.clone();
            if(spec.tint!==undefined)cloned.color.lerp(new Color(spec.tint),.36);
            cloned.metalness=Math.max(.38,cloned.metalness);
            cloned.roughness=Math.min(.63,cloned.roughness);
            this.importedPropMaterials.add(cloned);return cloned;
          });
          node.material=Array.isArray(node.material)?copy:copy[0];
        });
        this.importedProps.add(model);
        this.root.userData.characterRevision=(this.root.userData.characterRevision??0)+1;
      }).catch(error=>console.warn('CC0 companion accessory unavailable:',spec.file,error));
    }
  }
  /** The saddle is computed from the actual loaded GLB world bounding box. */
  updateSaddleFromGLB():void {
    if(!this.horse||!this.imported?.ready)return;
    const bounds=this.imported.getVisibleBounds();
    if(!bounds)return;
    this.root.updateWorldMatrix(true,true);
    const origin=this.root.getWorldPosition(this.ownOrigin);
    const height=bounds.max.y-bounds.min.y;
    if(!Number.isFinite(height)||height<=.1)return;
    // Raycast the visible dorsal surface, not 78% of a bounding box which
    // may include wings, horns and the long wyvern's neck.
    const dimensions=bounds.getSize(new Vector3());
    const backZ=bounds.getCenter(new Vector3()).z-dimensions.z*.19;
    const worldBack=new Vector3(origin.x,bounds.max.y+3,backZ);
    this.raycaster.set(worldBack,new Vector3(0,-1,0));
    this.raycaster.far=height+6;
    const hits=this.raycaster.intersectObject(this.imported.root,true);
    const isDragon=['Creature_wyvern','Creature_dragon'].includes(this.importedType);
    const dorsalY=hits.length?hits[0].point.y:bounds.min.y+height*(isDragon?.80:.70);
    // Keep both the mount's actual mesh surface and the rider hip above the
    // local back, with extra clearance for sweeping wyvern animation.
    const worldY=Math.max(dorsalY+(isDragon?.46:.23),bounds.min.y+height*(isDragon?.86:.70));
    const worldScale=this.root.getWorldScale(this.worldScale);
    this.saddleRestY=(worldY-origin.y)/Math.max(.001,Math.abs(worldScale.y));
    this.footprintRadius=Math.min(4.8,Math.max(1.65,Math.max(dimensions.x,dimensions.z)*.5+.35));
    this.saddle.position.set(0,this.saddleRestY,-dimensions.z*.19/Math.max(.001,Math.abs(worldScale.z)));
    this.root.userData.dorsalSample=hits.length?'raycast':'conservative-back-bounds';
    this.root.userData.saddleClearance=worldY-dorsalY;
    this.root.userData.realMountHeight=height;
    this.root.userData.saddleMeasured=true;
  }
 update(dt:number,speed:number,time:number,attack=false):void {
  if(this.disposed||!actorIsVisible(this.root))return;
  this.imported?.update(dt,Math.min(1,Math.max(0,speed)/7));this.particles.update(time);
  if(this.horse&&this.imported?.ready&&!this.root.userData.saddleMeasured)this.updateSaddleFromGLB();
  // Static authored animals retain their real silhouette; there is no generated gait/body fallback.
  if(this.imported?.ready&&this.imported.animationCount===0)this.imported.root.rotation.z=Math.sin(time*1.5)*.008;
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.unregisterVisibility();this.clearImportedProps();this.imported?.dispose();this.particles.dispose();this.root.removeFromParent();this.root.clear();}
}
