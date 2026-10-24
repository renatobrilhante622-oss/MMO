import {describe,it,expect} from 'vitest';
import {readHudLayout,keepHudOnscreen,HUD_KEYS} from '../src/ui/HudLayout';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {BaseBuilding} from '../src/rpg/BaseBuilding';
import {EventBus} from '../src/core/GameTypes';
describe('HUD placement and illustrated reward rules',()=>{
 it('validates every HUD component and clamps corrupted positions/scale/opacity',()=>{const raw=Object.fromEntries(HUD_KEYS.map(key=>[key,{x:2,y:-3,scale:9,opacity:.01}]));const layout=readHudLayout(raw);expect(Object.keys(layout)).toHaveLength(7);for(const p of Object.values(layout))expect(p).toEqual({x:1,y:0,scale:1.5,opacity:.2});expect(readHudLayout(null)).toEqual({});expect(readHudLayout({vitals:{x:NaN,y:Infinity}}).vitals).toEqual({x:0,y:0,scale:1,opacity:1});});
 it('keeps resized controls inside portrait and landscape viewports',()=>{for(const [w,h]of [[390,844],[844,390]]){const p=keepHudOnscreen({x:.99,y:.99,scale:1.5,opacity:.6},140,100,w,h);expect(p.x*w+140*p.scale).toBeLessThanOrEqual(w+.001);expect(p.y*h+100*p.scale).toBeLessThanOrEqual(h+.001);expect(p.opacity).toBe(.6);}});
 it('provides actual production progress from stored fractional production',()=>{const inventory=new InventoryAndLoot(new EventBus()),base=new BaseBuilding(inventory,new EventBus());base.update(.5);expect(base.production('mine').fraction).toBeCloseTo(.4);expect(base.production('alchemy').fraction).toBeCloseTo(.0125);expect(base.production('forge').resource).toBe('passive');const restored=new BaseBuilding(inventory,new EventBus());restored.restore(base.snapshot());expect(restored.production('mine')).toEqual(base.production('mine'));});
 it('awards the illustrated epic chest and gems only once per pass tier',()=>{const inv=new InventoryAndLoot(new EventBus()),p=new AdventureProgress(inv);inv.level=20;p.passXp=3000;const before=inv.items.length;expect(p.claimPass(15)).toBe(true);expect(inv.items.length).toBe(before+1);expect(inv.items.at(-1)?.rarity).toBe('epic');expect(p.claimPass(15)).toBe(false);expect(p.claimPass(10)).toBe(true);expect(p.gems.ruby).toBe(1);expect(p.claimPass(10)).toBe(false);expect(p.gems.ruby).toBe(1);});
});
