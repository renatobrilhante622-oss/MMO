import type {Item} from '../core/GameTypes';
import type {InventoryAndLoot} from './InventoryAndLoot';
import {COMPLETE_ITEM_CATALOG,scaleWorldItem} from './InventoryAndLoot';
export type AuctionCurrency='gold'|'crystals';
export interface AuctionListing{id:string;item:Item;price:number;currency:AuctionCurrency;seller:string;expires:number;buyAfter:number;}
export interface AuctionSave{listings:AuctionListing[];clock:number;seed:number;sequence:number;history:string[];}
/** Single-player NPC-simulated market. Not a real server trading API or source of verified global prices. */
export class SimulatedAuctionHouse{
 listings:AuctionListing[]=[];
 history:string[]=[];clock=0;
 private seed=759211;private sequence=0;
 private random():number{this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 constructor(private readonly inventory:InventoryAndLoot){this.seedBots();}
 private seedBots():void{
  if(this.listings.length)return;
  const candidates=COMPLETE_ITEM_CATALOG.filter(item=>['epic','legendary','mythic'].includes(item.rarity)).slice(0,50);
  for(let i=0;i<6;i++){
   const template=candidates[(i*7)%candidates.length];
   if(!template)continue;
   this.listings.push({id:'npc-'+i,item:{...scaleWorldItem(template,Math.max(10,this.inventory.level)),id:'auction-npc-'+i},price:220+i*130,currency:i%2?'crystals':'gold',seller:['Mercador Espectral','Cavaleiro da Alvorada','Alquimista Lunar'][i%3],expires:86400,buyAfter:Infinity});
  }
 }
 eligibleItems():Item[]{return this.inventory.items.filter(item=>(item.rarity==='epic'||item.rarity==='legendary'||item.rarity==='mythic')
    &&!item.locked&&!Object.values(this.inventory.equipment).includes(item.id)
    &&this.inventory.items.some(other=>other!==item&&other.name===item.name&&other.rarity===item.rarity));}
 list(itemId:string,price:number,currency:AuctionCurrency):boolean{
  const item=this.eligibleItems().find(i=>i.id===itemId);
  if(!item||!Number.isInteger(price)||price<10||price>1e7||!['gold','crystals'].includes(currency)
   ||this.listings.filter(l=>l.seller==='Você').length>=8)return false;
  const index=this.inventory.items.findIndex(i=>i.id===itemId);if(index<0)return false;
  this.inventory.items.splice(index,1);this.sequence++;
  this.listings.push({id:'self-'+this.sequence,item:{...item},price,currency,seller:'Você',expires:this.clock+86400,buyAfter:this.clock+12+this.random()*85});
  return true;
 }
 cancel(id:string):boolean{
  const index=this.listings.findIndex(l=>l.id===id&&l.seller==='Você');if(index<0||this.inventory.items.length>=this.inventory.capacity)return false;
  const [listing]=this.listings.splice(index,1);this.inventory.items.push({...listing.item});return true;
 }
 buy(id:string):boolean{
  const index=this.listings.findIndex(l=>l.id===id&&l.seller!=='Você');
  if(index<0||this.inventory.items.length>=this.inventory.capacity)return false;
  const listing=this.listings[index];if(this.inventory[listing.currency]<listing.price)return false;
  this.inventory[listing.currency]-=listing.price;
  const item={...listing.item,id:'market-'+(++this.sequence)+'-'+this.seed};
  this.inventory.items.push(item);this.listings.splice(index,1);
  this.history.unshift('Comprado: '+item.name+' por '+listing.price+' '+listing.currency);
  this.history=this.history.slice(0,20);return true;
 }
 tick(dt:number):void{
  this.clock+=Math.max(0,Math.min(.1,dt));
  for(let i=this.listings.length-1;i>=0;i--){
   const listing=this.listings[i];
   if(listing.seller==='Você'&&listing.buyAfter<=this.clock){
    const chance=this.random();
    if(chance<.70){
      this.inventory[listing.currency]+=Math.floor(listing.price*.95);
      this.history.unshift('Vendido: '+listing.item.name+' · taxa 5%');
      this.listings.splice(i,1);continue;
    }
    listing.buyAfter=this.clock+35+this.random()*90;
   }
   if(listing.seller==='Você'&&listing.expires<=this.clock&&this.inventory.items.length<this.inventory.capacity){
     this.inventory.items.push({...listing.item});this.listings.splice(i,1);
   }
  }
  this.history=this.history.slice(0,20);
 }
 snapshot():AuctionSave{return {listings:this.listings.map(l=>({...l,item:{...l.item}})),clock:this.clock,seed:this.seed,sequence:this.sequence,history:[...this.history]};}
 restore(raw:unknown):void{
  if(!raw||typeof raw!=='object')return;const r=raw as Record<string,unknown>;
  const valid=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
  this.clock=valid(r.clock,1e8);this.seed=valid(r.seed,0xffffffff);this.sequence=valid(r.sequence,1e8);
  if(Array.isArray(r.listings)){
    this.listings=r.listings.filter((l):l is AuctionListing=>{
     if(!l||typeof l!=='object')return false;const x=l as Record<string,unknown>;
     return typeof x.id==='string'&&x.id.length<150&&typeof x.seller==='string'&&typeof x.price==='number'&&x.price>=10&&x.price<=1e7
      &&(x.currency==='gold'||x.currency==='crystals')&&!!x.item&&typeof x.item==='object'&&typeof (x.item as Item).name==='string';
    }).slice(0,30).map(l=>({...l,price:Math.floor(l.price),buyAfter:valid(l.buyAfter,1e8),expires:valid(l.expires,1e8)}));
  }
  this.history=Array.isArray(r.history)?r.history.filter((m):m is string=>typeof m==='string').slice(0,20).map(s=>s.slice(0,130)):[];
 }
}
