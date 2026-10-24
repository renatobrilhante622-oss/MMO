import {describe,it,expect} from 'vitest';
import {renderVip} from '../src/ui/VipUI';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';

describe('independent VIP privileges',()=>{
  it('shows real wallet eligibility without activating VIP or embedding the battle pass',()=>{
    const p=new AdventureProgress(new InventoryAndLoot(new EventBus()));p.inventory.gold=24999;
    const html=renderVip(p,true,1000);
    expect(html.match(/<button class="vip-activate"[^>]*>/)?.[0]).toContain('disabled');
    expect(html).toContain('data-hub="pass"');
    expect(html).not.toContain('data-do="pass-buy"');
    expect(html).not.toContain('reward-track-cell');
    expect(p.vipUntil).toBe(0);expect(p.inventory.gold).toBe(24999);
  });
  it('reflects remaining time and preserves the separate premium pass entitlement',()=>{
    const p=new AdventureProgress(new InventoryAndLoot(new EventBus()));
    p.inventory.gold=25000;expect(p.buyVip()).toBe(true);
    expect(p.premium).toBe(false);expect(p.vipDiamonds).toBe(100);
    const html=renderVip(p,false,p.vipUntil-2*86400000);
    expect(html).toContain('2 days remaining');expect(html).toContain('VIP ACTIVE');
    expect(html.match(/<button class="vip-activate"[^>]*>/)?.[0]).toContain('disabled');
    expect(p.buyVip()).toBe(false);expect(p.vipDiamonds).toBe(100);
  });
});
