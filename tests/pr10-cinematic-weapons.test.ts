import {describe,expect,it} from 'vitest';
import {Mesh,BoxGeometry,MeshStandardMaterial,Group,Bone} from 'three';
import {readFileSync} from 'node:fs';
import {CLASS_IDS,CLASS_DEFINITIONS} from '../src/combat/ClassSystem';
import {ArticulatedCharacter} from '../src/player/ArticulatedCharacter';
import {CLASS_EQUIPMENT_MODELS} from '../src/assets/WeaponGLB';
import {CLASS_IDENTITIES,clearWeaponSlots,isEmbeddedWeaponName} from '../src/player/ClassVisualIdentity';

describe('PR10 cinematic, HUD isolation and nine exclusive classes',()=>{
 it('hides both embedded bow and quiver without hiding hands or rig bones',()=>{
  const glb=new Group();const armature=new Bone();armature.name='handslot.r';
  const hand=new Mesh(new BoxGeometry(),new MeshStandardMaterial());hand.name='Hand_Mesh';
  const builtIn=new Group();builtIn.name='bow_rig';
  const bow=new Mesh(new BoxGeometry(),new MeshStandardMaterial());bow.name='mesh_0';builtIn.add(bow);
  const quiver=new Mesh(new BoxGeometry(),new MeshStandardMaterial());quiver.name='Quiver.001';
  const defaultSword=new Mesh(new BoxGeometry(),new MeshStandardMaterial());defaultSword.name='weapon_sword';
  armature.add(hand,builtIn,quiver,defaultSword);glb.add(armature);
  expect(clearWeaponSlots(glb)).toBe(3);
  expect(bow.visible).toBe(false);
  expect(quiver.visible).toBe(false);
  expect(defaultSword.visible).toBe(false);
  expect(hand.visible).toBe(true);
  expect(armature.visible).toBe(true);
  expect(isEmbeddedWeaponName('handslot.r')).toBe(false);
  expect(isEmbeddedWeaponName('2h_Crossbow')).toBe(true);
 });
 it('has all nine visual signatures and strictly segregated weapon slot loadouts',()=>{
  expect(CLASS_IDS).toHaveLength(9);
  expect(Object.keys(CLASS_IDENTITIES).sort()).toEqual([...CLASS_IDS].sort());
  const signatures=CLASS_IDS.map(id=>CLASS_IDENTITIES[id].signature);
  expect(new Set(signatures).size).toBe(9);
  expect(CLASS_EQUIPMENT_MODELS.assassin).toEqual([
   {model:'dagger',bone:'righthand'},{model:'dagger',bone:'lefthand'}
  ]);
  expect(CLASS_EQUIPMENT_MODELS.ranger).toEqual([
   {model:'longbow',bone:'lefthand'},
   {model:'quiver',bone:'spine2',offset:[0,0,-.16]}
  ]);
  expect(CLASS_EQUIPMENT_MODELS.monk).toEqual([]);
  expect(CLASS_EQUIPMENT_MODELS.elementalist.map(x=>x.model)).toEqual(['staff','spellbook_open']);
  expect(CLASS_EQUIPMENT_MODELS.necromancer.map(x=>x.model)).toEqual(['staff','spellbook_closed']);
  expect(CLASS_EQUIPMENT_MODELS.lanceman[0].model).toBe('spear');
  expect(CLASS_EQUIPMENT_MODELS.paladin.map(g=>g.model)).toEqual(['sword_1handed','shield_round']);
  for(const [id,gear]of Object.entries(CLASS_EQUIPMENT_MODELS)){
   if(id==='ranger')continue;
   expect(gear.some(g=>g.model==='longbow'||g.model==='quiver'),id).toBe(false);
  }
 });
 it('never turns Assassin into Hooded Ranger when a cosmetic skin changes',()=>{
  const assassin=new ArticulatedCharacter(CLASS_DEFINITIONS.assassin);
  assassin.skinAppearance('forest',0x408754,2);
  expect(assassin.root.children.some(c=>c.name==='GLB KayKit_Rogue')).toBe(true);
  expect(assassin.root.children.some(c=>c.name==='GLB KayKit_Rogue_Hooded')).toBe(false);
  assassin.dispose();
  const ranger=new ArticulatedCharacter(CLASS_DEFINITIONS.ranger);
  ranger.skinAppearance('void',0x551787,4);
  expect(ranger.root.children.some(c=>c.name==='GLB KayKit_Rogue_Hooded')).toBe(true);
  ranger.dispose();
 });
 it('ships a real independent CC0 bow mesh and required atlas',()=>{
  const path='public/models/equipment/';
  const glb=readFileSync(path+'CC0_longbow.glb');
  const png=readFileSync(path+'Textures/colormap.png');
  expect(glb.toString('ascii',0,4)).toBe('glTF');
  expect(glb.readUInt32LE(8)).toBe(glb.length);
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  const metadata=JSON.parse(readFileSync(path+'manifest.json','utf8'));
  expect(metadata.license).toBe('CC0-1.0');
  expect(metadata.files.length).toBe(2);
 });
 it('contains one cinematic opening, not an APK download button or second splash',()=>{
  const main=readFileSync('src/main.ts','utf8');
  const hud=readFileSync('src/ui/MobileHUD.ts','utf8');
  const css=readFileSync('src/ui/pr10-cinematic-hud.css','utf8');
  expect(main).toContain('new CinematicIntro(');
  expect(main).not.toContain('new SplashScreen(');
  expect(hud).not.toContain('Baixar APK Android');
  expect(css).toContain('data-screen="cinematic"');
  expect(css).toContain('.entry-isolated');
  expect(css).toContain('.physical-portal-plaque');
 });
 it('uses a strict 18 m portal text visibility threshold, unlit-safe trees and collapsible quest copy',()=>{
  const portals=readFileSync('src/world/WorldPortals.ts','utf8');
  const forest=readFileSync('src/world/EnvironmentGLB.ts','utf8');
  const css=readFileSync('src/ui/pr10-cinematic-hud.css','utf8');
  expect(portals).toContain('distance<18');
  expect(forest).toContain('material.metalness=0');
  expect(forest).toContain('material.roughness=.85');
  expect(css).toContain('white-space:normal!important');
  expect(css).toContain('line-height:1.35!important');
 });
});
