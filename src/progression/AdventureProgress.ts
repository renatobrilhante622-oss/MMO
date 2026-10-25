import {avatarId} from '../ui/AvatarRenderer';
import {EvolutionSystem} from '../rpg/EvolutionSystem';
import {Vector3} from 'three';
import type { ClassId, Rarity } from '../core/GameTypes';
import { CLASS_IDS } from '../combat/ClassSystem';
import { RARITIES, COMPLETE_ITEM_CATALOG, scaleWorldItem, type InventoryAndLoot } from '../rpg/InventoryAndLoot';
import { REGIONS, type DungeonDefinition } from '../world/Regions';
import {isKnownRegionalMaterial} from '../rpg/RegionalLoot';
import {WEAPON_PACKS} from '../rpg/WeaponPacks';

export type Attribute = 'power'|'vitality'|'guard'|'spirit'|'precision';
export type Gem = 'ruby'|'sapphire'|'emerald'|'diamond';
export type Language = 'pt'|'en';
export const ATTRIBUTES:readonly Attribute[]=['power','vitality','guard','spirit','precision'];
export const ATTRIBUTE_NAMES:Record<Attribute,[string,string]>={power:['Poder','Power'],vitality:['Vitalidade','Vitality'],guard:['Proteção','Guard'],spirit:['Espírito','Spirit'],precision:['Precisão','Precision']};
export interface Bookmark { name:string; x:number; z:number; region:string; localMap?:boolean; }
export interface Cosmetic { id:string; name:[string,string]; type:'skin'|'pet'|'mount'|'weapon'|'wing'; rarity:Rarity; color:number; }
export const COSMETICS:readonly Cosmetic[]=[
  {id:'traveler',name:['Viajante','Traveler'],type:'skin',rarity:'common',color:0xa8b9c4},
  {id:'forest',name:['Guardião do Bosque','Forest Warden'],type:'skin',rarity:'uncommon',color:0x67d891},
  {id:'frost',name:['Cavaleiro Glacial','Frost Knight'],type:'skin',rarity:'rare',color:0x65bfff},
  {id:'void',name:['Arauto Astral','Astral Herald'],type:'skin',rarity:'epic',color:0xba85ff},
  {id:'solar',name:['Soberano Solar','Solar Sovereign'],type:'skin',rarity:'legendary',color:0xffc664},
  {id:'eternal',name:['Eterno','Eternal'],type:'skin',rarity:'mythic',color:0xff75ac},
  {id:'wolf',name:['Lobo Cinzento','Grey Wolf'],type:'pet',rarity:'common',color:0xa6b6be},
  {id:'fox',name:['Raposa do Bosque','Forest Fox'],type:'pet',rarity:'uncommon',color:0xe4a575},
  {id:'frostwolf',name:['Lobo Glacial','Frost Wolf'],type:'pet',rarity:'rare',color:0x6fcfff},
  {id:'spiritwolf',name:['Lobo Espectral','Spirit Wolf'],type:'pet',rarity:'epic',color:0xb593ff},
  {id:'sunwolf',name:['Lobo Solar','Sun Wolf'],type:'pet',rarity:'legendary',color:0xffc060},
  {id:'moonwolf',name:['Lobo Eterno','Eternal Wolf'],type:'pet',rarity:'mythic',color:0xff90cd},
  {id:'horse',name:['Cavalo de Viagem','Travel Horse'],type:'mount',rarity:'common',color:0x997454},
  {id:'stag',name:['Cervo do Bosque','Woodland Stag'],type:'mount',rarity:'uncommon',color:0x83ce99},
  {id:'frosthorse',name:['Corcel Glacial','Frost Courser'],type:'mount',rarity:'rare',color:0x80cbff},
  {id:'nighthorse',name:['Lobo Gigante','Dire Wolf'],type:'mount',rarity:'epic',color:0xb88aff},
  {id:'sunhorse',name:['Cavalo de Guerra Blindado','Armored Warhorse'],type:'mount',rarity:'legendary',color:0xffcd78},
  {id:'eternalhorse',name:['Grifo Astral','Astral Griffin'],type:'mount',rarity:'mythic',color:0xff91c1},
  {id:'ironweapon',name:['Aço do Viajante','Traveler Steel'],type:'weapon',rarity:'common',color:0xb9c2c8},
  {id:'forestweapon',name:['Fio do Bosque','Forest Edge'],type:'weapon',rarity:'uncommon',color:0x73d49c},
  {id:'frostweapon',name:['Fio Glacial','Frost Edge'],type:'weapon',rarity:'rare',color:0x7bcdff},
  {id:'voidweapon',name:['Fio Astral','Astral Edge'],type:'weapon',rarity:'epic',color:0xbd87ff},
  {id:'sunweapon',name:['Fio Solar','Solar Edge'],type:'weapon',rarity:'legendary',color:0xffd37c},
  {id:'eternalweapon',name:['Fio Eterno','Eternal Edge'],type:'weapon',rarity:'mythic',color:0xff8ac0},
  {id:'hellhound',name:['Cachorro do Inferno','Hellhound'],type:'pet',rarity:'epic',color:0xff6329},
  {id:'phoenix',name:['Fênix Solar','Solar Phoenix'],type:'pet',rarity:'legendary',color:0xffbd42},
  {id:'dracolich',name:['Dracolich de Osso','Bone Dracolich'],type:'pet',rarity:'mythic',color:0x99e4d6},
  {id:'nightmare',name:['Corcel do Pesadelo Abissal','Abyssal Nightmare'],type:'mount',rarity:'epic',color:0x9d62e3},
  {id:'fenrir',name:['Lobo Fenrir Gigante','Giant Fenrir'],type:'mount',rarity:'legendary',color:0x80bfff},
  {id:'spiritstag',name:['Cervo Espiritual','Spirit Stag'],type:'mount',rarity:'rare',color:0x82f0d8},
  {id:'wyvern',name:['Dragão Wyvern','Wyvern Dragon'],type:'mount',rarity:'mythic',color:0xef7a46},
  ...(['common','uncommon','rare','epic','legendary','mythic'] as Rarity[]).map((rarity,i)=>({id:'wing-'+i,name:['Asas '+['Necróticas','Celestiais','Glaciais','de Magma','Solares','Astrais'][i],'Wings '+['Necrotic','Celestial','Glacial','Magma','Solar','Astral'][i]] as [string,string],type:'wing' as const,rarity,color:[0xa477dd,0xffe3ab,0x84ddff,0xff6733,0xffd367,0xce85ff][i]})),
  ...WEAPON_PACKS.map(pack=>({id:pack.id,name:pack.name,type:'weapon' as const,rarity:pack.rarity,color:pack.color})),

];
export const GACHA_ODDS=[.50,.29,.14,.055,.014,.001] as const;
export const SLOT_COSTS=[2000,5000,10000,18000] as const;
const integer=(v:unknown,min:number,max:number,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):fallback;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function seasonId(now=Date.now()):string {return new Date(now).toISOString().slice(0,7);}

/** Local PvE progression. Never accepted as authoritative inventory by the online server. */
export class AdventureProgress {
  talents:Partial<Record<ClassId,Partial<Record<Attribute,number>>>>={};
  evolution=new EvolutionSystem();
  tickets=0;
  adminPoints=0;
  profile={id:'',avatar:'berserker',playSeconds:0,bossKills:0};
  dropHistory:Array<{name:string;rarity:Rarity;time:number;gold:number;crystals:number}>=[];
  chosen=false;
  gems:Record<Gem,number>={ruby:0,sapphire:0,emerald:0,diamond:0};
  greaterGems:Record<Gem,number>={ruby:0,sapphire:0,emerald:0,diamond:0};
  hudOpacity=1;
  materials=0;
  regionalMaterials:Record<string,number>={};
  potions={health:3,mana:3};
  owned=['traveler','wolf','horse','ironweapon'];
  equipped={skin:'traveler',pet:'wolf',mount:'horse',weapon:'ironweapon',wing:'wing-0'};
  vipDiamonds=0;
  shards=0;
  banner:Cosmetic['type']|'equipment'='skin';
  pulls=0;
  pity=0;
  bookmarks:Array<Bookmark|null>=Array.from({length:10},()=>null);
  purchasedSlots=0;
  teleportCooldown=0;
  vipUntil=0;
  autoFarm=false;
  autoHealthThreshold=.5;
  autoManaThreshold=.5;
  missions:Record<string,number>={};
  missionClaims:string[]=[];
  language:Language='pt';
  hudScale=1;
  controlsScale=1;
  waypoint:{x:number;z:number}|null=null;
  discovered=['aurora'];
  /** Region travel is story-gated independently from physical discovery. */
  unlockedRegions:string[]=['aurora'];
  dungeonClears:Record<string,number>={};
  selectedDungeon='roots';
  dungeonDifficulty='normal';
  season=seasonId();
  passXp=0;
  claimed:number[]=[];
  claimedPremium:number[]=[];
  premiumUntil=0;
  killCount=0;
  dungeonCount=0;
  potionCooldown=0;

  constructor(readonly inventory:InventoryAndLoot){}
  get vip():boolean{return this.vipUntil>Date.now();}
  get premium():boolean{return this.premiumUntil>Date.now();}
  get passTier():number{return Math.min(50,Math.floor(this.passXp/100));}
  get slots():number{return 4+this.purchasedSlots+(this.vip?2:0);}
  slotUnlocked(index:number):boolean{return Number.isInteger(index)&&index>=0&&index<10&&(index<4||(index<8&&index<4+this.purchasedSlots)||(index>=8&&this.vip));}
  spent(id:ClassId):number{return ATTRIBUTES.reduce((n,key)=>n+(this.talents[id]?.[key]??0),0);}
  points(id:ClassId):number{return Math.max(0,(this.inventory.level-1)*3+this.adminPoints-this.spent(id));}
  allocate(id:ClassId,attribute:Attribute):boolean {
    if(!CLASS_IDS.includes(id)||!ATTRIBUTES.includes(attribute)||this.points(id)<1||(this.talents[id]?.[attribute]??0)>=100)return false;
    const page=this.talents[id]??={};page[attribute]=(page[attribute]??0)+1;return true;
  }
  resetTalents(id:ClassId):boolean {
    const cost=100+this.spent(id)*20;
    if(this.spent(id)===0||this.inventory.gold<cost)return false;
    this.inventory.gold-=cost;delete this.talents[id];return true;
  }
  bonuses(id:ClassId):{attack:number;defense:number;maxHp:number;maxMana:number;critChance:number} {
    const t=this.talents[id]??{};
    return {attack:(t.power??0)*2,defense:(t.guard??0)*2,maxHp:(t.vitality??0)*14,maxMana:(t.spirit??0)*6,critChance:(t.precision??0)*.0015};
  }
  buySlot():boolean {
    if(this.purchasedSlots>=4)return false;
    const price=SLOT_COSTS[this.purchasedSlots];if(this.inventory.gold<price)return false;
    this.inventory.gold-=price;this.purchasedSlots++;return true;
  }
  record(index:number,name:string,x:number,z:number,blocked:boolean,regionId?:string):boolean {
    if(!this.slotUnlocked(index)||blocked||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>140||Math.abs(z)>140)return false;
    const region=REGIONS.find(r=>r.id===regionId)??REGIONS.reduce((best,r)=>Math.hypot(x-r.center.x,z-r.center.z)<Math.hypot(x-best.center.x,z-best.center.z)?r:best,REGIONS[0]);
    this.bookmarks[index]={name:name.trim().slice(0,30)||region.name[this.language==='pt'?0:1],x,z,region:region.id,localMap:!!regionId};return true;
  }
  destination(index:number,blocked:boolean):Bookmark|null {
    if(blocked||!this.slotUnlocked(index)||this.teleportCooldown>0)return null;
    const b=this.bookmarks[index];if(!b)return null;
    this.teleportCooldown=45;return {...b};
  }
  tick(dt:number):void {
    const step=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    this.teleportCooldown=Math.max(0,this.teleportCooldown-step);
    this.potionCooldown=Math.max(0,this.potionCooldown-step);
    if(!this.vip)this.autoFarm=false;
    const next=seasonId();if(this.season!==next){this.season=next;this.passXp=0;this.claimed=[];this.claimedPremium=[];}
  }
  buyPotion(type:'health'|'mana'):boolean {
    if(this.potions[type]>=99||this.inventory.gold<35)return false;
    this.inventory.gold-=35;this.potions[type]++;return true;
  }
  usePotion(type:'health'|'mana'):boolean {
    if(this.potionCooldown>0||this.potions[type]<1)return false;
    this.potions[type]--;this.potionCooldown=8;return true;
  }
  buyGem(type:Gem):boolean {
    if(!['ruby','sapphire','emerald','diamond'].includes(type)||this.inventory.gold<450)return false;
    this.inventory.gold-=450;this.gems[type]++;return true;
  }
  socket(id:string,type:Gem):boolean {
    const item=this.inventory.items.find(i=>i.id===id);
    if(!item||item.locked||!['ruby','sapphire','emerald','diamond'].includes(type)||(this.gems[type]<1&&this.greaterGems[type]<1)||(item.sockets?.length??0)>=this.socketCapacity(item.rarity)||this.inventory.gold<100)return false;
    this.inventory.gold-=100;const level=this.greaterGems[type]>0?2:1;if(level===2)this.greaterGems[type]--;else this.gems[type]--;item.sockets??=[];item.gemLevels??=item.sockets.map(()=>1);item.sockets.push(type);item.gemLevels.push(level);return true;
  }
  socketCapacity(rarity:Rarity):number{return [1,1,2,3,3,4][RARITIES.indexOf(rarity)];}
  unsocket(id:string):boolean {
    const item=this.inventory.items.find(i=>i.id===id);if(item?.locked||!item?.sockets?.length||this.inventory.gold<200)return false;
    this.inventory.gold-=200;for(let i=0;i<item.sockets.length;i++){const gem=item.sockets[i];if(item.gemLevels?.[i]===2)this.greaterGems[gem]++;else this.gems[gem]++;}item.sockets=[];item.gemLevels=[];return true;
  }
  salvage(id:string):boolean {
    const item=this.inventory.items.find(i=>i.id===id);
    if(!item||item.locked||Object.values(this.inventory.equipment).includes(id))return false;
    this.materials+=1+RARITIES.indexOf(item.rarity)*2;
    for(let i=0;i<(item.sockets?.length??0);i++){const gem=item.sockets![i];if(item.gemLevels?.[i]===2)this.greaterGems[gem]++;else this.gems[gem]++;}
    this.inventory.items=this.inventory.items.filter(i=>i.id!==id);return true;
  }
  fuseGem(type:Gem):boolean {
    if(!['ruby','sapphire','emerald','diamond'].includes(type)||this.gems[type]<3)return false;
    this.gems[type]-=3;this.greaterGems[type]++;return true;
  }
  forgeGem(type:Gem):boolean {
    if(!['ruby','sapphire','emerald','diamond'].includes(type)||this.materials<12||this.inventory.gold<150)return false;
    this.materials-=12;this.inventory.gold-=150;this.gems[type]++;return true;
  }
  buyVip():boolean {if(this.vip||this.inventory.gold<25000)return false;this.inventory.gold-=25000;this.vipUntil=Date.now()+30*86400000;this.vipDiamonds+=100;return true;}
  buyPass():boolean {if(this.premium||this.inventory.crystals<180)return false;this.inventory.crystals-=180;this.premiumUntil=Date.now()+30*86400000;return true;}
  passClaimable(tier:number):boolean {return tier>=1&&tier<=this.passTier&&(!this.claimed.includes(tier)||(this.premium&&!this.claimedPremium.includes(tier)));}
  claimPass(tier:number):boolean {
    if(!Number.isInteger(tier)||!this.passClaimable(tier))return false;
    if(!this.claimed.includes(tier)){
      this.claimed.push(tier);this.inventory.gold+=tier*35;this.inventory.crystals+=tier%5===0?6:1;
      if(tier%10===0)this.gems[tier===10?'ruby':tier===20?'sapphire':'diamond']++;
      if(tier%15===0){const slot=tier===15?'weapon':'armor',template=COMPLETE_ITEM_CATALOG.filter(i=>i.slot===slot&&i.rarity==='epic'&&i.level<=this.inventory.level).at(-1)!;const id='battlepass-'+this.season+'-'+tier;this.inventory.addLoot({id,position:new Vector3(),gold:0,crystals:0,xp:0,item:{...scaleWorldItem(template,this.inventory.level),id:id+'-item'}});}
    }
    if(this.premium&&!this.claimedPremium.includes(tier)){this.claimedPremium.push(tier);this.shards+=10;}
    return true;
  }

  missionKey(period:'day'|'week'):string {return period==='day'?new Date().toISOString().slice(0,10):String(Math.floor((Date.now()-4*86400000)/(7*86400000)));}
  missionProgress(id:'daily'|'weekly'|'forest'):number {return this.missions[(id==='weekly'?'dungeon:':id==='forest'?'forest:':'kill:')+this.missionKey(id==='weekly'?'week':'day')]??0;}
  missionClaimed(id:'daily'|'weekly'|'forest'):boolean {return this.missionClaims.includes(id+':'+this.missionKey(id==='weekly'?'week':'day'));}
  claimMission(id:'daily'|'weekly'|'forest'):boolean {
    const target=id==='daily'?15:id==='forest'?50:3;if(this.missionProgress(id)<target||this.missionClaimed(id))return false;
    this.missionClaims.push(id+':'+this.missionKey(id==='weekly'?'week':'day'));this.missionClaims=this.missionClaims.slice(-30);
    this.passXp+=id==='daily'?60:id==='forest'?180:200;this.inventory.gold+=id==='daily'?120:id==='forest'?350:600;return true;
  }
  collectRegionalMaterial(id:string,quantity:number):boolean{
    if(!isKnownRegionalMaterial(id)||!Number.isFinite(quantity)||!Number.isInteger(quantity)||quantity<1||quantity>100)return false;
    this.regionalMaterials[id]=Math.min(999999,(this.regionalMaterials[id]??0)+quantity);
    return true;
  }
  earnKill(level:number,boss:boolean,region?:string):void {
    if(region==='lake'){const forest='forest:'+this.missionKey('day');this.missions[forest]=(this.missions[forest]??0)+1;}
    const key='kill:'+this.missionKey('day');this.missions[key]=(this.missions[key]??0)+1;
    this.killCount++;this.passXp+=boss?25:3;
    // Materials are an explicit sink/source, with a predictable one per five kills.
    if(this.killCount%5===0)this.materials++;
    if(boss)this.materials+=Math.max(1,Math.floor(level/8));
  }
  complete(dungeon:DungeonDefinition):void {
    const key='dungeon:'+this.missionKey('week');this.missions[key]=(this.missions[key]??0)+1;
    this.dungeonClears[dungeon.id]=(this.dungeonClears[dungeon.id]??0)+1;this.dungeonCount++;
    this.passXp+=60;this.inventory.gold+=dungeon.gold;this.inventory.crystals+=dungeon.crystals;
  }
  pull(random:()=>number=Math.random):{cosmetic:Cosmetic;duplicate:boolean}|null {
    if(this.banner==='equipment'||(this.inventory.crystals<20&&this.tickets<1))return null;
    const roll=random();const typeRoll=random();const choice=random();
    if(![roll,typeRoll,choice].every(n=>Number.isFinite(n)&&n>=0&&n<1))return null;
    if(this.tickets>0)this.tickets--;else this.inventory.crystals-=20;this.pulls++;this.pity++;
    let rarity=0,sum=0;for(let i=0;i<GACHA_ODDS.length;i++){sum+=GACHA_ODDS[i];if(roll<sum){rarity=i;break;}}
    if(this.pity>=60)rarity=Math.max(4,rarity);
    else if(this.pulls%10===0)rarity=Math.max(2,rarity);
    if(rarity>=4)this.pity=0;
    const pool=COSMETICS.filter(c=>RARITIES.indexOf(c.rarity)===rarity&&c.type===this.banner);
    const cosmetic=pool[Math.min(pool.length-1,Math.floor(typeRoll*pool.length))];
    const duplicate=this.owned.includes(cosmetic.id);
    if(duplicate)this.shards+=5*(rarity+1);else this.owned.push(cosmetic.id);
    return {cosmetic,duplicate};
  }
  redeem(id:string):boolean {
    const cosmetic=COSMETICS.find(c=>c.id===id);if(!cosmetic||this.owned.includes(id))return false;
    const cost=[20,40,100,200,500,1200][RARITIES.indexOf(cosmetic.rarity)];if(this.shards<cost)return false;
    this.shards-=cost;this.owned.push(id);return true;
  }
  redeemVip(id:string):boolean {
    const c=COSMETICS.find(c=>c.id===id);if(!c||this.owned.includes(id))return false;
    const cost=[5,10,25,50,100,200][RARITIES.indexOf(c.rarity)];if(this.vipDiamonds<cost)return false;
    this.vipDiamonds-=cost;this.owned.push(id);return true;
  }
  equipCosmetic(id:string):boolean {
    const c=COSMETICS.find(c=>c.id===id);if(!c||!this.owned.includes(id))return false;this.equipped[c.type]=id;if(c.type==='wing'){const style=(['necrotic','celestial','glacial','magma','celestial','necrotic'] as const)[Number(id.split('-')[1])??0];if(!this.evolution.wingOwned.includes(style))this.evolution.wingOwned.push(style);this.evolution.wings=style;}return true;
  }
  snapshot():Record<string,unknown> {
    const {inventory,...data}=this;return structuredClone(data);
  }
  restore(raw:unknown):void {
    if(!object(raw))return;
    this.evolution.restore(raw.evolution);this.tickets=integer(raw.tickets,0,99999);this.adminPoints=integer(raw.adminPoints,0,99999);
    if(object(raw.profile)){this.profile={id:typeof raw.profile.id==='string'?raw.profile.id.slice(0,40):'',avatar:avatarId(typeof raw.profile.avatar==='string'?raw.profile.avatar:'berserker'),playSeconds:integer(raw.profile.playSeconds,0,1e9),bossKills:integer(raw.profile.bossKills,0,1e9)};}
    if(Array.isArray(raw.dropHistory))this.dropHistory=raw.dropHistory.slice(-100).filter((v):v is typeof this.dropHistory[number]=>object(v)&&typeof v.name==='string'&&RARITIES.includes(v.rarity as Rarity)&&typeof v.time==='number');
    this.chosen=raw.chosen===true;
    if(object(raw.missions))for(const [key,value]of Object.entries(raw.missions).slice(-30))this.missions[key]=integer(value,0,10000);
    if(Array.isArray(raw.missionClaims))this.missionClaims=raw.missionClaims.filter((v):v is string=>typeof v==='string').slice(-30);
    for(const key of ['autoHealthThreshold','autoManaThreshold'] as const)if(typeof raw[key]==='number')this[key]=Math.max(.1,Math.min(.8,raw[key]));
    if(object(raw.talents))for(const id of CLASS_IDS){const page=raw.talents[id];if(!object(page))continue;let remaining=(this.inventory.level-1)*3+this.adminPoints;for(const key of ATTRIBUTES){const n=integer(page[key],0,Math.min(100,remaining));(this.talents[id]??={})[key]=n;remaining-=n;}}
    if(object(raw.gems))for(const key of ['ruby','sapphire','emerald','diamond'] as Gem[])this.gems[key]=integer(raw.gems[key],0,99999);
    if(object(raw.greaterGems))for(const key of ['ruby','sapphire','emerald','diamond'] as Gem[])this.greaterGems[key]=integer(raw.greaterGems[key],0,99999);
    this.hudOpacity=typeof raw.hudOpacity==='number'?Math.max(.3,Math.min(1,raw.hudOpacity)):1;
    this.vipDiamonds=integer(raw.vipDiamonds,0,999999);this.materials=integer(raw.materials,0,999999);this.shards=integer(raw.shards,0,999999);
    if(object(raw.regionalMaterials))for(const [id,n] of Object.entries(raw.regionalMaterials))
      if(isKnownRegionalMaterial(id))this.regionalMaterials[id]=integer(n,0,999999);
    if(object(raw.potions))for(const key of ['health','mana'] as const)this.potions[key]=integer(raw.potions[key],0,99);
    this.owned=[...new Set([...this.owned,...Array.isArray(raw.owned)?raw.owned.filter((id):id is string=>typeof id==='string'&&COSMETICS.some(c=>c.id===id)):[]])];
    if(object(raw.equipped))for(const type of ['skin','pet','mount','weapon','wing'] as const){const id=raw.equipped[type];if(typeof id==='string'&&this.owned.includes(id)&&COSMETICS.some(c=>c.id===id&&c.type===type))this.equipped[type]=id;}
    if(['skin','pet','mount','weapon','wing','equipment'].includes(String(raw.banner)))this.banner=raw.banner as typeof this.banner;
    this.pulls=integer(raw.pulls,0,1e9);this.pity=integer(raw.pity,0,59);this.purchasedSlots=integer(raw.purchasedSlots,0,4);
    this.vipUntil=integer(raw.vipUntil,0,Date.now()+31*86400000);this.premiumUntil=integer(raw.premiumUntil,0,Date.now()+31*86400000);
    this.language=raw.language==='en'?'en':'pt';this.hudScale=typeof raw.hudScale==='number'?Math.max(.5,Math.min(1.5,raw.hudScale)):1;this.controlsScale=typeof raw.controlsScale==='number'?Math.max(.5,Math.min(1.5,raw.controlsScale)):1;
    if(Array.isArray(raw.bookmarks))for(let i=0;i<10;i++){const b=raw.bookmarks[i];if(object(b)&&typeof b.name==='string'&&typeof b.x==='number'&&Number.isFinite(b.x)&&Math.abs(b.x)<=140&&typeof b.z==='number'&&Number.isFinite(b.z)&&Math.abs(b.z)<=140)this.bookmarks[i]={name:b.name.slice(0,30),x:b.x,z:b.z,region:typeof b.region==='string'?b.region:'aurora',localMap:b.localMap===true};}
    if(object(raw.waypoint)&&typeof raw.waypoint.x==='number'&&Number.isFinite(raw.waypoint.x)&&Math.abs(raw.waypoint.x)<=140&&typeof raw.waypoint.z==='number'&&Number.isFinite(raw.waypoint.z)&&Math.abs(raw.waypoint.z)<=140)this.waypoint={x:raw.waypoint.x,z:raw.waypoint.z};
    if(Array.isArray(raw.discovered))this.discovered=[...new Set(['aurora',...raw.discovered.filter((id):id is string=>REGIONS.some(r=>r.id===id))])];
    if(Array.isArray(raw.unlockedRegions))this.unlockedRegions=[...new Set(['aurora',...raw.unlockedRegions.filter((id):id is string=>typeof id==='string'&&REGIONS.some(r=>r.id===id))])];
    if(object(raw.dungeonClears))for(const [key,n] of Object.entries(raw.dungeonClears))this.dungeonClears[key]=integer(n,0,1e6);
    if(['normal','elite','nightmare','abyssal'].includes(String(raw.dungeonDifficulty)))this.dungeonDifficulty=String(raw.dungeonDifficulty);
    if(typeof raw.selectedDungeon==='string')this.selectedDungeon=raw.selectedDungeon;
    this.season=typeof raw.season==='string'?raw.season:seasonId();this.passXp=integer(raw.passXp,0,5000);
    this.claimed=Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter((n):n is number=>Number.isInteger(n)&&n>=1&&n<=50))]:[];
    this.claimedPremium=Array.isArray(raw.claimedPremium)?[...new Set(raw.claimedPremium.filter((n):n is number=>Number.isInteger(n)&&n>=1&&n<=50))]:[];
    this.killCount=integer(raw.killCount,0,1e9);this.dungeonCount=integer(raw.dungeonCount,0,1e9);
    // Preserve cooldowns across reloads to prevent bypassing consumable/teleport limits.
    this.teleportCooldown=typeof raw.teleportCooldown==='number'?Math.max(0,Math.min(45,raw.teleportCooldown)):0;
    this.potionCooldown=typeof raw.potionCooldown==='number'?Math.max(0,Math.min(8,raw.potionCooldown)):0;
    this.tick(0);
  }
}
