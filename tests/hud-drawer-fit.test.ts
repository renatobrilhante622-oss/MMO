import {describe,it,expect} from 'vitest';
import {fitHudDrawer} from '../src/ui/HudLayout';

describe('mobile menu anchor accessibility',()=>{
 it('keeps a tall landscape drawer below its toggle with internal scrolling',()=>{
  const anchor={top:12,bottom:56,right:705},p=fitHudDrawer(anchor,254,580,844,390);
  expect(p.y).toBeGreaterThan(anchor.bottom);expect(p.y+p.maxHeight).toBeLessThanOrEqual(382);
  expect(p.x).toBeGreaterThanOrEqual(8);expect(p.x+254).toBeLessThanOrEqual(836);
 });
 it('opens above a saved bottom anchor without covering its controls',()=>{
  const anchor={top:330,bottom:374,right:300},p=fitHudDrawer(anchor,240,270,844,390);
  expect(p.y+270).toBeLessThan(anchor.top);expect(p.y).toBeGreaterThanOrEqual(8);
 });
 it('keeps the drawer inside a narrow portrait screen',()=>{
  const anchor={top:116,bottom:157,right:380},p=fitHudDrawer(anchor,374,700,390,844);
  expect(p.x).toBe(8);expect(p.x+374).toBe(382);
  expect(p.y).toBeGreaterThan(anchor.bottom);expect(p.y+p.maxHeight).toBe(836);
 });
});
