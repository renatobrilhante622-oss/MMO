export const RUNE_NODES=[
 {id:'ember-ground',name:'🔥 Chão Ardente',cost:2,needs:[] as string[],description:'Skills incendiárias criam uma área de queimadura por 4 segundos.',x:16,y:56},
 {id:'shadow-dash',name:'🌑 Sombra Explosiva',cost:3,needs:[] as string[],description:'Dash libera uma explosão sombria nos inimigos próximos.',x:47,y:17},
 {id:'twin-blades',name:'⚔️ Lâminas Duplas',cost:4,needs:['shadow-dash'],description:'Ataques básicos infligem uma segunda lâmina (25% do dano).',x:77,y:48},
 {id:'stellar-core',name:'✦ Coração Estelar',cost:5,needs:['ember-ground','twin-blades'],description:'+6% poder ofensivo e +6% pontos de vida máximos.',x:50,y:78},
] as const;
export type RuneId=typeof RUNE_NODES[number]['id'];
export interface RuneSave{spent:RuneId[];bossCredits:number;}
export class TalentTreeSystem{
 spent:RuneId[]=[];bossCredits=0;
 points(level:number):number{return Math.max(0,Math.floor(level)-1)*1+this.bossCredits-this.spent.reduce((n,id)=>n+(RUNE_NODES.find(r=>r.id===id)?.cost??0),0);}
 unlocked(id:string):boolean{return this.spent.includes(id as RuneId);}
 unlock(id:string,level:number):boolean{
  const node=RUNE_NODES.find(n=>n.id===id);
  if(!node||this.unlocked(id)||this.points(level)<node.cost||!node.needs.every(n=>this.unlocked(n)))return false;
  this.spent.push(node.id);return true;
 }
 onBoss():void{this.bossCredits=Math.min(200,this.bossCredits+2);}
 bonuses():{attack:number;hp:number}{return this.unlocked('stellar-core')?{attack:.06,hp:.06}:{attack:0,hp:0};}
 snapshot():RuneSave{return {spent:[...this.spent],bossCredits:this.bossCredits};}
 restore(raw:unknown,level:number):void{
  if(!raw||typeof raw!=='object')return;const r=raw as Record<string,unknown>;
  this.bossCredits=typeof r.bossCredits==='number'&&Number.isFinite(r.bossCredits)?Math.max(0,Math.min(200,Math.floor(r.bossCredits))):0;
  this.spent=[];
  if(Array.isArray(r.spent))for(const id of r.spent){if(typeof id==='string')this.unlock(id,level);}
 }
}
