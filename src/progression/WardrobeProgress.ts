import {catalogSkin,type SkinSource} from '../player/SkinCatalog';
export const SKIN_SOURCES:readonly SkinSource[]=['elite','rift','contract','massacre','worldboss','tower','pvp','fragments'];
/** Local PvE cosmetics only. Never credited to server currencies, ratings or inventories. */
export class WardrobeProgress {
 readonly fragments:Record<SkinSource,number>={elite:0,rift:0,contract:0,massacre:0,worldboss:0,tower:0,pvp:0,fragments:0};
 private serial=0;private ledger=new Set<string>();
 nextToken(source:string):string{return `wardrobe-${source}-${++this.serial}`;}
 earn(source:SkinSource,token:string,count=1):boolean {
  if(!SKIN_SOURCES.includes(source)||!token||token.length>180||this.ledger.has(token)||!Number.isSafeInteger(count)||count<1||count>100)return false;
  this.ledger.add(token);if(this.ledger.size>8192)this.ledger.delete(this.ledger.values().next().value!);
  const reward=({elite:8,rift:16,contract:14,massacre:12,worldboss:18,tower:22,pvp:10,fragments:1})[source]*count;
  this.fragments[source]=Math.min(1e6,this.fragments[source]+reward);this.fragments.fragments=Math.min(1e6,this.fragments.fragments+(source==='fragments'?0:Math.ceil(reward*.25)));return true;
 }
 unlock(id:string,owned:string[],universal=false):boolean {
  const skin=catalogSkin(id);if(!skin||owned.includes(id))return false;const source=universal?'fragments':skin.source,cost=universal?skin.cost*2:skin.cost;
  if(this.fragments[source]<cost)return false;this.fragments[source]-=cost;owned.push(id);return true;
 }
 snapshot():unknown{return {schema:1,serial:this.serial,fragments:{...this.fragments},ledger:[...this.ledger]};}
 restore(raw:unknown):void {
  if(!raw||typeof raw!=='object')return;const v=raw as Record<string,unknown>,valid=(n:unknown,max:number)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
  if(valid(v.serial,Number.MAX_SAFE_INTEGER))this.serial=Number(v.serial);
  if(v.fragments&&typeof v.fragments==='object')for(const s of SKIN_SOURCES){const n=(v.fragments as Record<string,unknown>)[s];if(valid(n,1e6))this.fragments[s]=Number(n);}
  if(Array.isArray(v.ledger))this.ledger=new Set(v.ledger.filter((s):s is string=>typeof s==='string'&&s.length<=180).slice(-8192));
 }
}
