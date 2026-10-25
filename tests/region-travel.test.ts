import {describe,expect,it} from 'vitest';
import {REGIONS,regionAt,regionalLevel} from '../src/world/Regions';
import {REGION_REWARDS,nextRegion,regionArrival,travelPermission} from '../src/world/RegionTravel';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';

describe('five progression zones',()=>{
  it('has distinct tier boundaries, names, mobs, bosses and exclusive reward catalogs',()=>{
    expect(REGIONS).toHaveLength(5);
    expect(REGIONS.map(r=>r.minLevel)).toEqual([1,15,35,60,85]);
    expect(REGIONS.map(r=>r.maxLevel)).toEqual([15,35,60,85,100]);
    expect(new Set(REGIONS.map(r=>r.id)).size).toBe(5);
    for(const r of REGIONS){
      expect(r.name[0].length).toBeGreaterThan(6);
      expect(r.kinds.length).toBeGreaterThanOrEqual(2);
      expect(REGION_REWARDS[r.id].exclusive).toHaveLength(2);
      const at=regionAt(r.center.x,r.center.z);
      expect(at.id).toBe(r.id);
      expect(regionalLevel(r.center.x,r.center.z)).toBe(r.minLevel);
      const arrival=regionArrival(r.id)!;
      expect(Math.abs(arrival.x)).toBeLessThan(141);
      expect(Math.abs(arrival.z)).toBeLessThan(141);
    }
  });
  it('requires both level and story unlock unless developer god mode overrides',()=>{
    const state={level:100,unlocked:['aurora']};
    expect(travelPermission('crypt',state).reason).toBe('locked');
    expect(travelPermission('crypt',{level:1,unlocked:['aurora','crypt']}).reason).toBe('level');
    expect(travelPermission('crypt',{level:20,unlocked:['aurora','crypt']}).ok).toBe(true);
    expect(travelPermission('eclipse',{level:1,unlocked:[],adminOverride:true}).ok).toBe(true);
    expect(travelPermission('eclipse',{level:100,unlocked:['eclipse'],inCombat:true}).reason).toBe('combat');
    expect(travelPermission('eclipse',{level:100,unlocked:['eclipse'],inDungeon:true}).reason).toBe('dungeon');
    expect(travelPermission('eclipse',{level:100,unlocked:['eclipse'],channeling:true}).reason).toBe('busy');
    expect(travelPermission('nonexistent',state).reason).toBe('unknown');
    expect(nextRegion('aurora')?.id).toBe('crypt');
    expect(nextRegion('eclipse')).toBeUndefined();
  });
  it('persists unlocked story regions independently of visited regions',()=>{
    const progress=new AdventureProgress(new InventoryAndLoot(new EventBus()));
    progress.unlockedRegions.push('crypt');
    const restored=new AdventureProgress(new InventoryAndLoot(new EventBus()));
    restored.restore(progress.snapshot());
    expect(restored.unlockedRegions).toEqual(['aurora','crypt']);
    expect(restored.discovered).toEqual(['aurora']);
    restored.restore({unlockedRegions:['crypt','crypt','unknown','eclipse']});
    expect(restored.unlockedRegions).toEqual(['aurora','crypt','eclipse']);
  });
});
