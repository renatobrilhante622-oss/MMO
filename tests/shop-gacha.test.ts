import {describe,expect,it} from 'vitest';
import {renderPrizeCards,renderShopGacha,renderMerchant,renderSanctuary,prizeIcon} from '../src/ui/ShopGachaUI';
import {AdventureProgress,COSMETICS} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';
import {summon} from '../src/rpg/GachaService';
const progress=()=>new AdventureProgress(new InventoryAndLoot(new EventBus()));
describe('illustrated shop and summon rewards',()=>{
  it('separates merchant stock from the illustrated ticket-only sanctuary',()=>{
    const p=progress(),merchant=renderMerchant(p),sanctuary=renderSanctuary(p);
    expect(renderShopGacha(p).replace(/item-art-\d+/g,'icon')).toBe(merchant.replace(/item-art-\d+/g,'icon'));
    expect((sanctuary.match(/data-do="banner"/g)??[])).toHaveLength(6);
    expect((merchant.match(/class="shop-item-card/g)??[])).toHaveLength(8);
    for(const action of ['potion-buy','potion-use','gem-buy','gem-fuse','gem-forge','crystal-buy','ticket-buy'])expect(merchant).toContain('data-do="'+action+'"');
    expect(merchant).not.toContain('data-do="gacha"');expect(merchant).not.toContain('summon-banners');
    expect(sanctuary).not.toContain('data-do="potion-buy"');expect(sanctuary).not.toContain('data-do="ticket-buy"');
    expect(sanctuary).toContain('Equipamento');expect(sanctuary).toContain('Asas');expect(sanctuary).toContain('Somente Tickets');
    expect(sanctuary).toContain('Probabilidades e garantias');expect(sanctuary).toContain('0.1%');
    expect(merchant+sanctuary).not.toContain('<img');
  });
  it('enables controls from the correct wallet without implicit currency fallback',()=>{
    const p=progress();p.inventory.gold=0;p.inventory.crystals=10000;p.tickets=0;p.gems.ruby=3;
    expect(renderSanctuary(p).match(/<button data-do="gacha10"[^>]*>/)?.[0]).toContain('disabled');
    p.tickets=10;
    expect(renderSanctuary(p).match(/<button data-do="gacha10"[^>]*>/)?.[0]).not.toContain('disabled');
    const merchant=renderMerchant(p);
    expect(merchant.match(/<button data-do="gem-fuse" data-key="ruby"[^>]*>/)?.[0]).not.toContain('disabled');
    expect(merchant.match(/<button data-do="potion-buy"[^>]*>/)?.[0]).toContain('disabled');
  });
  it('draws vector wings rather than the hood icon and escapes result names',()=>{
    const prize={name:'Asa <script>alert(1)</script>',rarity:'mythic' as const,kind:'skin' as const,duplicate:false,cosmeticId:'wing-5'};
    const html=renderPrizeCards([prize],0);
    expect(prizeIcon(prize)).toContain('wing-illustration');expect(html).toContain('Mítico');expect(html).toContain('aria-pressed="true"');expect(html).toContain('Prévia 3D');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
  });
  it('retains exact cosmetic and equipment identities for selected 3D previews without another reward roll',()=>{
    const p=progress();p.tickets=10;const result=summon(p,1,'wing',()=>.2)!;
    expect(COSMETICS.some(c=>c.id===result[0].cosmeticId&&c.type==='wing')).toBe(true);
    const next=summon(p,1,'equipment',()=>.2)!;expect(next[0].itemSlot).toBeDefined();expect(p.inventory.items.some(i=>i.id===next[0].itemId&&i.slot===next[0].itemSlot)).toBe(true);
    const pulls=p.pulls;renderPrizeCards([...result,...next],1);expect(p.pulls).toBe(pulls);
  });
});
