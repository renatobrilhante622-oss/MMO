import {describe,expect,it} from 'vitest';
import {renderPrizeCards,renderShopGacha,prizeIcon} from '../src/ui/ShopGachaUI';
import {AdventureProgress,COSMETICS} from '../src/progression/AdventureProgress';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {EventBus} from '../src/core/GameTypes';
import {summon} from '../src/rpg/GachaService';
const progress=()=>new AdventureProgress(new InventoryAndLoot(new EventBus()));
describe('illustrated shop and summon rewards',()=>{
  it('renders six illustrated banners and all real supply/jewel actions without image URLs or text-only cards',()=>{
    const html=renderShopGacha(progress());
    expect((html.match(/data-do="banner"/g)??[])).toHaveLength(6);
    expect((html.match(/class="shop-item-card/g)??[])).toHaveLength(6);
    expect((html.match(/<svg/g)??[]).length).toBeGreaterThanOrEqual(13);
    expect(html).toContain('Equipamento');expect(html).toContain('Asas');
    for(const action of ['potion-buy','potion-use','gem-buy','gem-fuse','gem-forge','gacha','gacha10'])expect(html).toContain('data-do="'+action+'"');
    expect(html).not.toContain('adventure-card');expect(html).not.toContain('<img');expect(html).toContain('Probabilidades e garantias');expect(html).toContain('0.1%');
  });
  it('keeps buttons available according to the actual wallet including ticket-only rolls and free jewel fusion',()=>{
    const p=progress();p.inventory.gold=0;p.inventory.crystals=0;p.tickets=10;p.gems.ruby=3;
    const html=renderShopGacha(p);
    expect(html.match(/<button data-do="gacha10"[^>]*>/)?.[0]).not.toContain('disabled');
    expect(html.match(/<button data-do="gem-fuse" data-key="ruby"[^>]*>/)?.[0]).not.toContain('disabled');
    expect(html.match(/<button data-do="potion-buy"[^>]*>/)?.[0]).toContain('disabled');
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
