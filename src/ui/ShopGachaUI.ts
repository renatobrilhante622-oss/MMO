import type {AdventureProgress} from '../progression/AdventureProgress';
import {COSMETICS,GACHA_ODDS} from '../progression/AdventureProgress';
import {RARITIES,RARITY_COLORS} from '../rpg/InventoryAndLoot';
import {canSummon} from '../rpg/GachaService';
import {MERCHANT_OFFERS} from '../rpg/MerchantEconomy';
import {itemIcon,type IconKind} from './ItemIconRenderer';
import {cosmeticIcon,illustratedWings,merchantCurrencyIcon} from './CosmeticIconRenderer';
import type {GachaPrize} from './GachaCutscene';
export type ShopTranslate=(pt:string,en:string)=>string;
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const RARITY_NAMES:Record<string,[string,string]>={common:['Comum','Common'],uncommon:['Incomum','Uncommon'],rare:['Raro','Rare'],epic:['Épico','Epic'],legendary:['Lendário','Legendary'],mythic:['Mítico','Mythic']};
export const wingIcon=(rarity:typeof RARITIES[number]='epic'):string=>illustratedWings(rarity);
export function prizeIcon(prize:GachaPrize):string {
  const cosmetic=COSMETICS.find(c=>c.id===prize.cosmeticId);
  return cosmetic?cosmeticIcon(cosmetic,prize.name):itemIcon(prize.kind,prize.rarity,prize.name);
}
function action(id:string,label:string,extra='',disabled=false):string{return `<button data-do="${id}" ${extra} ${disabled?'disabled':''}>${label}</button>`;}
const defaultTranslate:ShopTranslate=(pt)=>pt;

/** Merchant inventory only: summon controls and odds live in their own sanctuary. */
export function renderMerchant(p:AdventureProgress,t:ShopTranslate=defaultTranslate,_translate:(text:string)=>string=(text)=>text):string {
  const inv=p.inventory;
  const supplies=(['health','mana'] as const).map(type=>{
    const health=type==='health',label=t(health?'Poção de Vida':'Poção de Mana',health?'Health Potion':'Mana Potion');
    const art=health?itemIcon('potion','uncommon',label,'#eb5474'):itemIcon('manaPotion','rare',label,'#5bbdff','<path d="m27 7 13 1 2 14 10 14-5 19-25 2-9-18 11-17Z" fill="#65cafa" fill-opacity=".35" stroke="#bdeaff"/><path d="m19 35 26-1 3 8-5 11-19 1-7-13Z" fill="url(#jewel)"/><path d="m25 7 17 1v7l-18-1Z" fill="url(#gold)"/><path d="m32 29 6 9-6 12-5-11Z" fill="#b6ecff"/><path d="m19 37 3 10" stroke="white"/>');
    return `<article class="shop-item-card" style="--rarity:${health?'#e77d88':'#71bdf2'}"><div class="shop-card-art">${art}</div><div class="shop-card-title"><h3>${label}</h3><small>×${p.potions[type]}</small></div><span class="shop-item-effect">${t('Recupera 40%','Restores 40%')} ${health?'HP':'MP'}</span><div class="shop-card-actions">${action('potion-buy','35 ◈',`data-key="${type}" aria-label="${esc(t('Comprar ','Buy ')+label)}"`,inv.gold<35||p.potions[type]>=99)}${action('potion-use',t('Usar','Use'),`data-key="${type}"`,p.potions[type]<1||p.potionCooldown>0)}</div></article>`;
  }).join('');
  const gems=(['ruby','sapphire','emerald','diamond'] as const).map(g=>{
    const names={ruby:['Rubi','Ruby'],sapphire:['Safira','Sapphire'],emerald:['Esmeralda','Emerald'],diamond:['Diamante','Diamond']} as const;
    const effects={ruby:'ATK',sapphire:'MP',emerald:'CRIT',diamond:'DEF'};
    return `<article class="shop-item-card gem-shop-card" style="--rarity:${RARITY_COLORS.rare}"><div class="shop-card-art">${itemIcon(g,'rare',t(names[g][0],names[g][1]))}</div><div class="shop-card-title"><h3>${t(names[g][0],names[g][1])}</h3><small>×${p.gems[g]} <span>· II ×${p.greaterGems[g]}</span></small></div><span class="shop-item-effect">◇ ${effects[g]} · ${t('Joia de encaixe','Socket jewel')}</span><div class="shop-card-actions">${action('gem-buy','450 ◈',`data-key="${g}" aria-label="${esc(t('Comprar ','Buy ')+t(names[g][0],names[g][1]))}"`,inv.gold<450)}${action('gem-fuse','3× → II',`data-key="${g}" title="${esc(t('Fundir três joias de nível 1','Fuse three level 1 jewels'))}"`,p.gems[g]<3)}</div><details class="shop-craft"><summary>⚒ ${t('Criar joia','Craft jewel')}</summary><span>12 ⚒ + 150 ◈</span>${action('gem-forge',t('Criar','Craft'),`data-key="${g}"`,p.materials<12||inv.gold<150)}</details></article>`;
  }).join('');
  const exchanges=(['crystals','tickets'] as const).map(product=>{
    const offer=MERCHANT_OFFERS[product],crystal=product==='crystals',label=t(crystal?'Bolsa de Cristais':'Ticket Ancestral',crystal?'Crystal Pouch':'Ancestral Ticket');
    const current=crystal?inv.crystals:p.tickets;
    return `<article class="shop-item-card merchant-exchange" style="--rarity:${crystal?'#70c9f7':'#f0c367'}"><div class="shop-card-art">${merchantCurrencyIcon(product,label)}</div><div class="shop-card-title"><h3>${label}</h3><small>×${current}</small></div><span class="shop-item-effect">+${offer.quantity} ${t(crystal?'cristais para melhorias':'ticket para o Santuário',crystal?'crystals for upgrades':'ticket for the Sanctuary')}</span><div class="shop-card-actions">${action(crystal?'crystal-buy':'ticket-buy',`${offer.gold.toLocaleString(p.language==='pt'?'pt-BR':'en-US')} ◈`,'',inv.gold<offer.gold||current+offer.quantity>offer.cap)}</div></article>`;
  }).join('');
  return `<div class="visual-shop merchant-only"><section class="shop-supplies"><header class="shop-section-heading"><span class="shop-rune">⚗</span><div><small>${t('MERCADOR DA AURORA','DAWN MERCHANT')}</small><h2>${t('Suprimentos e Joias','Supplies & Jewels')}</h2></div><span class="shop-material-balance">${inv.gold.toLocaleString()} ◈ · ${p.materials} ⚒</span></header><div class="merchant-intro">${t('Suprimentos adquiridos com Ouro. Invocações ficam no Santuário de Invocação.','Supplies purchased with Gold. Summons are available in the Summoning Sanctuary.')}</div><div class="illustrated-shop-grid">${supplies}${gems}${exchanges}</div></section></div>`;
}

const BANNERS:[string,IconKind,string,string][]=[['equipment','sword','Equipamento','Equipment'],['skin','skin','Skins','Skins'],['weapon','staff','Armas','Weapons'],['pet','pet','Pets','Pets'],['mount','mount','Montarias','Mounts'],['wing','skin','Asas','Wings']];
function bannerArt(id:string,kind:IconKind,label:string,rarity:'epic'|'mythic'='epic'):string {
  const c=COSMETICS.find(c=>c.type===id&&c.rarity===rarity);
  return c?cosmeticIcon(c,label):itemIcon(kind,rarity,label);
}
/** Independent tickets-only summon gateway. No merchant purchase controls are rendered here. */
export function renderSanctuary(p:AdventureProgress,t:ShopTranslate=defaultTranslate,_translate:(text:string)=>string=(text)=>text):string {
  const selected=BANNERS.find(b=>b[0]===p.banner)??BANNERS[0];
  return `<div class="visual-shop sanctuary-only"><section class="summon-sanctum"><header class="shop-section-heading"><span class="shop-rune">✦</span><div><small>${t('SANTUÁRIO DE INVOCAÇÃO','SUMMONING SANCTUARY')}</small><h2>${t(selected[2],selected[3])}</h2></div><span class="shop-ticket-balance">🎟 ${p.tickets} ${t('Tickets','Tickets')}</span></header><nav class="summon-banners" aria-label="${t('Categorias de invocação','Summon categories')}">${BANNERS.map(([id,kind,pt,en])=>`<button data-do="banner" data-key="${id}" class="${p.banner===id?'selected':''}" aria-pressed="${p.banner===id}">${bannerArt(id,kind,t(pt,en))}<span>${t(pt,en)}</span></button>`).join('')}</nav><div class="summon-showcase" style="--rarity:${RARITY_COLORS.legendary}"><div class="summon-display-art">${bannerArt(selected[0],selected[1],t(selected[2],selected[3]),'mythic')}</div><div class="summon-offer"><small class="sanctuary-eyebrow">${t('PORTAL DOS ANCESTRAIS','ANCESTRAL GATEWAY')}</small><h3>${t('Tesouros Ancestrais','Ancestral Treasures')}</h3><div class="summon-reward-swatches">${(['rare','epic','legendary','mythic'] as const).map(r=>`<span style="color:${RARITY_COLORS[r]}">◆ ${t(...RARITY_NAMES[r])}</span>`).join('')}</div><span class="summon-price">${t('1 Ticket por invocação · Somente Tickets','1 Ticket per summon · Tickets only')}</span><div class="summon-buttons">${action('gacha',t('Invocar 1×','Summon 1×'),'',!canSummon(p,1))}${action('gacha10',t('Invocar 10×','Summon 10×'),'',!canSummon(p,10))}</div>${p.tickets<1?`<span class="sanctuary-no-ticket">${t('Adquira Tickets no Mercador da Aurora.','Obtain Tickets from the Dawn Merchant.')}</span>`:''}<small class="summon-pity">${t('Garantia','Pity')}: ${p.pity}/60 · ${t('Invocações','Summons')}: ${p.pulls} · ${p.shards} ${t('fragmentos','shards')}</small></div></div><details class="summon-rules"><summary>${t('Probabilidades e garantias','Odds and guarantees')}</summary><div class="summon-odds">${RARITIES.map((r,i)=>`<span style="color:${RARITY_COLORS[r]}">${t(...RARITY_NAMES[r])}<b>${(GACHA_ODDS[i]*100).toFixed(1)}%</b></span>`).join('')}</div><p>${t('10ª invocação: Raro ou superior. 60 sem Lendário: Lendário ou superior. Duplicatas viram fragmentos. Nenhum Cristal é consumido ao invocar.','10th summon: Rare or better. 60 without a Legendary: Legendary or better. Duplicates become shards. Summons never spend Crystals.')}</p><p>${t('As invocações cosméticas não dão atributos. Equipamentos entram na mochila. Sem dinheiro real.','Cosmetic summons grant no stats. Equipment enters your bag. No real money.')}</p></details></section></div>`;
}

/** Compatibility entry point intentionally opens only the merchant. */
export const renderShopGacha=renderMerchant;
export function renderPrizeCards(prizes:GachaPrize[],selected:number):string {
  return prizes.map((p,i)=>`<article class="gacha-prize-card rarity-${p.rarity} ${selected===i?'selected':''}" style="--rarity:${RARITY_COLORS[p.rarity]}"><button data-gacha="preview" data-index="${i}" aria-label="Prévia 3D: ${esc(p.name)}" aria-pressed="${selected===i}"><div class="gacha-result-art">${prizeIcon(p)}</div><b>${esc(p.name)}</b><span class="gacha-result-rarity">${RARITY_NAMES[p.rarity][0]}</span><small>${p.duplicate?'Convertido em fragmentos':p.itemId?'Equipamento recebido na mochila':'Cosmético recebido na coleção'}</small><span class="gacha-preview-label">◇ Prévia 3D</span></button></article>`).join('');
}
