import type {InventoryAndLoot} from './InventoryAndLoot';
export const WING_STYLES=['necrotic','celestial','magma','glacial','solar','astral'] as const;
export type WingStyle=typeof WING_STYLES[number];
export class EvolutionSystem {
  wings:WingStyle|null=null;
  wingLevels:Record<WingStyle,number>={necrotic:1,celestial:1,magma:1,glacial:1,solar:1,astral:1};
  levels:Record<string,number>={};
  wingOwned:WingStyle[]=['necrotic'];
  level(id:string):number{return this.levels[id]??1;}
  cost(level:number):{gold:number;materials:number}{return {gold:Math.round(150*Math.pow(1.6,level-1)),materials:level*8};}
  upgrade(id:string,inv:InventoryAndLoot,materials:number,wing=false):number|null {
    if(wing&&!this.wingOwned.includes(id as WingStyle))return null;
    const level=wing?this.wingLevels[id as WingStyle]:this.level(id);if(!level||level>=10)return null;
    const cost=this.cost(level);if(inv.gold<cost.gold||materials<cost.materials)return null;
    inv.gold-=cost.gold;if(wing)this.wingLevels[id as WingStyle]++;else this.levels[id]=level+1;return cost.materials;
  }
  buffs(pet:string,mount:string):{attack:number;defense:number;maxHp:number;maxMana:number;speed:number;crit:number} {
    const w=this.wings?this.wingLevels[this.wings]:0,p=this.level(pet),m=this.level(mount);
    return {attack:w*2+(pet==='hellhound'?p*3:pet==='dracolich'?p*4:p),defense:w+(mount==='fenrir'?m*3:m),maxHp:w*12+(pet==='phoenix'?p*20:p*4)+m*8,maxMana:pet==='dracolich'?p*10:0,speed:mount==='nightmare'?.02*m:mount==='wyvern'?.025*m:.01*m,crit:pet==='hellhound'?.002*p:0};
  }
  restore(value:unknown):void {
    if(!value||typeof value!=='object')return;const raw=value as Record<string,unknown>;
    if(Array.isArray(raw.wingOwned))this.wingOwned=WING_STYLES.filter(s=>(raw.wingOwned as unknown[]).includes(s));
    if(WING_STYLES.includes(raw.wings as WingStyle)&&this.wingOwned.includes(raw.wings as WingStyle))this.wings=raw.wings as WingStyle;
    const valid=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(1,Math.min(10,Math.floor(n))):1;
    if(raw.wingLevels&&typeof raw.wingLevels==='object')for(const s of WING_STYLES)this.wingLevels[s]=valid((raw.wingLevels as Record<string,unknown>)[s]);
    if(raw.levels&&typeof raw.levels==='object')for(const [id,n]of Object.entries(raw.levels).slice(0,100))if(/^[a-z-]{1,40}$/.test(id))this.levels[id]=valid(n);
  }
}
