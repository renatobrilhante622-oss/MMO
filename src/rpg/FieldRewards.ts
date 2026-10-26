import type {Item,LootDrop} from '../core/GameTypes';
import {COMPLETE_ITEM_CATALOG,scaleWorldItem,type InventoryAndLoot} from './InventoryAndLoot';
import {COSMETICS,type AdventureProgress} from '../progression/AdventureProgress';
export interface FieldExtras {skinFragments?:number;skinChests?:number;lockedChests?:number;refinementStones?:number;abyssalCores?:number;renown?:number;}
const keys=['skinFragments','skinChests','lockedChests','refinementStones','abyssalCores','renown'] as const;
const amount=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
/** Local PvE bag and activity timers. No value here ever enters an online wallet. */
export class FieldProgress {
 balances:Required<FieldExtras>={skinFragments:0,skinChests:0,lockedChests:0,refinementStones:0,abyssalCores:0,renown:0};
 clock=0;private serial=0;private buffs={speed:0,critical:0,storm:0};
 activateBuff(kind:keyof typeof this.buffs):void{this.buffs[kind]=this.clock+180;}
 buffActive(kind:keyof typeof this.buffs):boolean{return this.buffs[kind]>this.clock;}
 buffRemaining(kind:keyof typeof this.buffs):number{return Math.max(0,this.buffs[kind]-this.clock);}private collected=new Set<string>();
 readonly timers=new Map<string,number>();
 nextId(prefix='field'):string{return `${prefix}-${++this.serial}`;}
 tick(dt:number):void{if(Number.isFinite(dt)&&dt>0)this.clock+=Math.min(.1,dt);}
 ready(id:string):boolean{return (this.timers.get(id)??0)<=this.clock;}
 cooldown(id:string,seconds:number):void{this.timers.set(id,this.clock+Math.max(0,Math.min(3600,seconds)));}
 grant(extras:FieldExtras):void {for(const key of keys)this.balances[key]=Math.min(1e9,this.balances[key]+amount(extras[key],1000000));}
 collect(id:string,extras:FieldExtras):boolean {if(!id||this.collected.has(id))return false;this.collected.add(id);if(this.collected.size>4096)this.collected.delete(this.collected.values().next().value!);this.grant(extras);return true;}
 refine(inv:InventoryAndLoot,id:string):boolean {
  const cost=inv.upgradeCost(id);if(!this.balances.refinementStones||!Number.isFinite(cost.crystals)||inv.gold<cost.gold)return false;
  const crystals=inv.crystals;inv.crystals+=cost.crystals;
  if(!inv.upgradeItem(id)){inv.crystals=crystals;return false;}this.balances.refinementStones--;return true;
 }
 openSkin(progress:AdventureProgress):string|null {
  if(this.balances.skinChests<1)return null;const skins=COSMETICS.filter(c=>c.type==='skin'&&c.rarity!=='mythic'),skin=skins[this.serial%skins.length];
  this.serial++;this.balances.skinChests--;if(progress.owned.includes(skin.id))this.grant({skinFragments:12});else progress.owned.push(skin.id);return skin.name[progress.language==='pt'?0:1];
 }
 forgeChest():boolean {if(this.balances.skinFragments<50)return false;this.balances.skinFragments-=50;this.balances.skinChests++;return true;}
 openLocked(inv:InventoryAndLoot,level:number):boolean {
  if(this.balances.lockedChests<1||inv.gold<100||inv.crystals<2)return false;
  const drop=fieldReward(inv,level,'chest');inv.gold-=100;inv.crystals-=2;this.balances.lockedChests--;inv.addLoot({...drop,position:new Vector3(0,0,0)});this.grant(drop.fieldExtras??{});return true;
 }
 snapshot():unknown{return {schema:1,buffs:{...this.buffs},balances:{...this.balances},clock:this.clock,serial:this.serial,timers:Object.fromEntries(this.timers),collected:[...this.collected].slice(-4096)};}
 restore(raw:unknown):void {if(!raw||typeof raw!=='object')return;const v=raw as Record<string,unknown>;this.clock=amount(v.clock,1e12);this.serial=amount(v.serial,Number.MAX_SAFE_INTEGER);if(v.balances&&typeof v.balances==='object')for(const k of keys)this.balances[k]=amount((v.balances as Record<string,unknown>)[k]);
  if(v.buffs&&typeof v.buffs==='object')for(const key of ['speed','critical','storm'] as const){const n=(v.buffs as Record<string,unknown>)[key];if(typeof n==='number'&&Number.isFinite(n))this.buffs[key]=Math.max(this.clock,Math.min(this.clock+180,n));}
  if(v.timers&&typeof v.timers==='object')for(const [id,t]of Object.entries(v.timers).slice(0,2500))if(/^[\w:-]{1,160}$/.test(id)&&typeof t==='number'&&Number.isFinite(t))this.timers.set(id,Math.max(this.clock,Math.min(this.clock+3600,t)));
  if(Array.isArray(v.collected))this.collected=new Set(v.collected.filter((id):id is string=>typeof id==='string'&&id.length<200).slice(-4096));
 }
}
import {Vector3} from 'three';
export function fieldReward(inv:InventoryAndLoot,level:number,kind:'elite'|'rift'|'camp'|'massacre'|'chest'):Omit<LootDrop,'position'> {
 const base=inv.generateLoot('golem',level,false),rarity=kind==='elite'||kind==='camp'?(base.gold%3===0?'epic':'rare'):'epic';
 const source=COMPLETE_ITEM_CATALOG.find(i=>i.rarity===rarity&&i.slot==='weapon')!;
 const item:Item={...scaleWorldItem(source,level),id:'field-item-'+base.id,name:(kind==='elite'?'Troféu do Capitão — ':'Tesouro da Vigília — ')+source.name};
 return {...base,item,gold:base.gold*3,xp:base.xp*(kind==='elite'?4:2),crystals:2+Math.floor(level/20),fieldExtras:{skinFragments:kind==='elite'?3:5,lockedChests:kind==='elite'?1:0,skinChests:kind==='rift'?1:0,refinementStones:kind==='massacre'||kind==='chest'?2:1}};
}
