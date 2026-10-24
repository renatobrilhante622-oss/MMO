import {describe,expect,it} from 'vitest';
import {AdventureProgress,COSMETICS} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';
import {MERCHANT_OFFERS,purchaseMerchant} from '../src/rpg/MerchantEconomy';
import {canSummon,summon} from '../src/rpg/GachaService';
import {cosmeticIcon} from '../src/ui/CosmeticIconRenderer';
const fixture=()=>new AdventureProgress(new InventoryAndLoot(new EventBus()));
describe('merchant exchanges and ticket-only sanctuary',()=>{
  it('exchanges gold for exact crystal and ticket amounts and persists both balances',()=>{
    const p=fixture();p.inventory.gold=2000;p.inventory.crystals=0;p.tickets=0;
    expect(purchaseMerchant(p,'crystals')).toBe(true);expect(p.inventory.gold).toBe(1400);expect(p.inventory.crystals).toBe(MERCHANT_OFFERS.crystals.quantity);
    expect(purchaseMerchant(p,'tickets')).toBe(true);expect(p.inventory.gold).toBe(200);expect(p.tickets).toBe(1);
    const copy=fixture();copy.restore(p.snapshot());expect(copy.tickets).toBe(1);
  });
  it('does not partially charge purchases with insufficient gold, invalid balances or capped tickets',()=>{
    const p=fixture();p.inventory.gold=599;const crystals=p.inventory.crystals;
    expect(purchaseMerchant(p,'crystals')).toBe(false);expect(p.inventory.gold).toBe(599);expect(p.inventory.crystals).toBe(crystals);
    p.inventory.gold=5000;p.tickets=99999;expect(purchaseMerchant(p,'tickets')).toBe(false);expect(p.inventory.gold).toBe(5000);
    p.tickets=NaN;expect(purchaseMerchant(p,'tickets')).toBe(false);expect(p.inventory.gold).toBe(5000);
  });
  it('rejects crystal-funded rolls without changing any progress and allows an exact ticket balance',()=>{
    const p=fixture();p.inventory.crystals=10000;p.tickets=9;
    const before=JSON.stringify(p.snapshot());expect(canSummon(p,10)).toBe(false);expect(summon(p,10,'pet',()=>.2)).toBeNull();expect(JSON.stringify(p.snapshot())).toBe(before);
    p.tickets=10;expect(canSummon(p,10)).toBe(true);expect(summon(p,10,'pet',()=>.2)).toHaveLength(10);expect(p.tickets).toBe(0);expect(p.inventory.crystals).toBe(10000);
  });
  it('uses distinct catalog silhouettes for recognizable skins, companions and mounts',()=>{
    const ids=['traveler','forest','frost','void','solar','eternal','wolf','fox','hellhound','phoenix','dracolich','horse','stag','sunhorse','wyvern'];
    const art=ids.map(id=>cosmeticIcon(COSMETICS.find(c=>c.id===id)!));
    const silhouettes=art.map(svg=>svg.match(/<g filter="none">(.*?)<\/g>/)?.[1].replace(/item-art-\d+/g,'icon'));
    expect(silhouettes.every(Boolean)).toBe(true);expect(new Set(silhouettes).size).toBe(ids.length);
  });
});
