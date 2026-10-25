import {describe,expect,it} from 'vitest';
import {regionalMaterialForKill,isKnownRegionalMaterial} from '../src/rpg/RegionalLoot';
import {REGIONS} from '../src/world/Regions';
import {REGION_REWARDS} from '../src/world/RegionTravel';
import {EventBus} from '../src/core/GameTypes';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {AdventureProgress} from '../src/progression/AdventureProgress';
describe('exclusive regional loot',()=>{
  it('bosses always grant their home region materials and retain actual amounts',()=>{
    for(const zone of REGIONS){
      const token=regionalMaterialForKill(zone.id,'boss',zone.maxLevel,true,'boss-drop-'+zone.id)!;
      expect(token).not.toBeNull();
      expect(token.id).toBe(zone.id+':1');
      expect(token.region).toBe(zone.id);
      expect(token.name).toBe(REGION_REWARDS[zone.id].exclusive[1]);
      expect(token.quantity).toBeGreaterThanOrEqual(2);
    }
  });
  it('regular monsters drop from the region exclusive table deterministically',()=>{
    let found=0,missed=0;
    for(let i=0;i<100;i++){
      const id='drop-'+i;
      const result=regionalMaterialForKill('crypt','skeleton',24,false,id);
      expect(result).toEqual(regionalMaterialForKill('crypt','skeleton',24,false,id));
      if(result){found++;expect(REGION_REWARDS.crypt.exclusive).toContain(result.name);}
      else missed++;
    }
    expect(found).toBeGreaterThan(15);
    expect(missed).toBeGreaterThan(30);
  });
  it('only whitelisted keys and bounded quantities can be persisted',()=>{
    const progress=new AdventureProgress(new InventoryAndLoot(new EventBus()));
    expect(progress.collectRegionalMaterial('crypt:1',3)).toBe(true);
    expect(progress.collectRegionalMaterial('crypt:1',2)).toBe(true);
    expect(progress.collectRegionalMaterial('false-region:0',5)).toBe(false);
    expect(progress.collectRegionalMaterial('crypt:0',1000000)).toBe(false);
    expect(progress.regionalMaterials['crypt:1']).toBe(5);
    const restored=new AdventureProgress(new InventoryAndLoot(new EventBus()));
    restored.restore(progress.snapshot());
    expect(restored.regionalMaterials).toEqual({'crypt:1':5});
    restored.restore({regionalMaterials:{'crypt:1':-1000,'unknown:0':99999}});
    expect(restored.regionalMaterials).toEqual({'crypt:1':0});
    expect(isKnownRegionalMaterial('eclipse:0')).toBe(true);
    expect(isKnownRegionalMaterial('eclipse:99')).toBe(false);
  });
});
