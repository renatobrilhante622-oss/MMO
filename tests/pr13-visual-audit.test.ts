import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {COSMETICS} from '../src/progression/AdventureProgress';
import {companionAssetFor} from '../src/companions/CompanionRig';
import {WING_STYLES} from '../src/rpg/EvolutionSystem';

describe('PR13 mobile visual regression contracts',()=>{
  const read=(path:string)=>readFileSync(path,'utf8');
  it('never renders the same GLB file as both a pet and a mount',()=>{
    const pets=COSMETICS.filter(c=>c.type==='pet').map(c=>companionAssetFor(c.id,false));
    const mounts=COSMETICS.filter(c=>c.type==='mount').map(c=>companionAssetFor(c.id,true));
    expect(pets.length).toBeGreaterThanOrEqual(10);
    expect(mounts.length).toBeGreaterThanOrEqual(10);
    for(const name of pets)expect(mounts).not.toContain(name);
    expect(companionAssetFor('wyvern',true)).toBe('Creature_wyvern');
    expect(companionAssetFor('dracolich',false)).not.toBe('Creature_wyvern');
    expect(companionAssetFor('stag',true)).toBe('Creature_stag');
    expect(companionAssetFor('sunhorse',true)).toBe('Creature_warhorse');
  });
  it('ships seven extra CC0 authored GLB animal silhouettes',()=>{
    const manifest=JSON.parse(read('public/models/creatures/pr13-visual-assets.json')) as {
      assets:Array<{id:string;file:string;license:string;source:string}>;
    };
    expect(manifest.assets.length).toBe(7);
    for(const a of manifest.assets){
      const filename='public/'+a.file;
      expect(existsSync(filename),a.id).toBe(true);
      const bytes=readFileSync(filename);
      expect(bytes.toString('ascii',0,4),filename).toBe('glTF');
      expect(bytes.readUInt32LE(8),filename).toBe(bytes.byteLength);
      expect(a.license).toBe('CC0-1.0');
      expect(a.source).toMatch(/^https:\/\/github\.com\//);
    }
  });
  it('keeps bark green foliage and PBR shadows without white wash',()=>{
    const code=read('src/world/EnvironmentGLB.ts');
    expect(code).toContain("'#5c3a21'");
    expect(code).toContain("'#2d6a3e'");
    expect(code).toContain("'#3b8046'");
    expect(code).toContain("if(!source.map&&!object.geometry.hasAttribute('color'))");
    expect(code).toContain("instanced.castShadow=!entry.file.includes('tree-')&&entry.height>5");
    expect(code).not.toContain('material.color.setRGB(Math.max(.68');
    const engine=read('src/core/Engine.ts');
    expect(engine).toContain('ACESFilmicToneMapping');
    expect(engine).toContain('this.renderer.toneMappingExposure = 1.15');
    expect(engine).toContain('this.renderer.shadowMap.enabled = true');
    expect(engine).toContain('this.renderer.shadowMap.type = PCFSoftShadowMap');
    expect(engine).toContain('object.castShadow=object.castShadow||authoredEnvironment');
  });
  it('adds real instanced grass, flowers and stones to the terrain',()=>{
    const code=read('src/world/GroundDetail.ts');
    expect(code).toContain('new InstancedMesh');
    expect(code).toContain('Meadow grasses');
    expect(code).toContain('Wildflowers');
    expect(code).toContain('Loose stones');
    expect(read('src/world/OpenWorldGenerator.ts')).toContain('new GroundDetail');
  });
  it('attaches separate armored companions and raycasts above the wyvern back',()=>{
    const rig=read('src/companions/CompanionRig.ts');
    expect(rig).toContain('this.raycaster.intersectObject(this.imported.root,true)');
    expect(rig).toContain('this.saddle.position.set(0,this.saddleRestY');
    expect(rig).toContain('this.importedProps.add(model)');
    expect(rig).toContain('CC0_crystal_gems.glb');
    expect(rig).toContain('Kenney_dungeon_shield_round.glb');
    const follow=read('src/companions/PetAndMountSystem.ts');
    expect(follow).toContain('this.petRig.root.scale.setScalar(.45');
  });
  it('has three curved layers per side, particles and all six wing families',()=>{
    const wings=read('src/companions/WingsSystem.ts');
    expect(wings).toContain('for(let layer=0;layer<3;layer++)');
    expect(wings).toContain('for(const sign of [-1,1])');
    expect(wings).toContain('new Points(');
    expect(wings).toContain('sizeAttenuation:true');
    expect(WING_STYLES).toEqual(['necrotic','celestial','magma','glacial','solar','astral']);
    const actor=read('src/player/ArticulatedCharacter.ts');
    expect(actor).toContain('this.wings.root.scale.setScalar(1.16)');
  });
  it('renders authored helmets, shoulder armor and a simulated cape on GLB actors',()=>{
    const actor=read('src/player/ArticulatedCharacter.ts');
    expect(actor).toContain('this.updateImportedSkin(actor)');
    expect(actor).toContain('CC0_knight_helmet.glb');
    expect(actor).toContain("loadWeaponModel('dungeon_shield_round')");
    expect(actor).toContain("actor.attachAt('spine2',this.cape.mesh");
    expect(read('src/assets/AnimatedGLB.ts')).toContain('Math.min(.76');
  });
  it('keeps world markers under the touch HUD and feeds at most two drops',()=>{
    const css=read('src/ui/pr13-visual.css');
    expect(css).toContain('z-index:5!important;pointer-events:none!important');
    expect(css).toContain('.eterna-hud{z-index:30');
    expect(css).toContain('bottom:max(220px');
    const toast=read('src/ui/LootToastFeed.ts');
    expect(toast).toContain('this.list.childElementCount>2');
    expect(read('src/main.ts')).toContain("import './ui/pr13-visual.css'");
  });
});
