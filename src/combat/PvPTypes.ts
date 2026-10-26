import type {ClassId} from '../core/GameTypes';
export type ArenaSize=1|2|3;
export type PvPPhase='found'|'loading'|'countdown'|'active'|'ended'|'cancelled';
export interface PvPProfile {id:string;name:string;classId:ClassId;level:number;cp:number;rating:number;bot:boolean;}
export interface PvPInput {seq:number;moveX:number;moveZ:number;aimX:number;aimZ:number;attack:boolean;skill:number|null;dash:boolean;potion:'hp'|'mana'|null;}
export interface PvPFighter extends PvPProfile {
 team:0|1;x:number;z:number;facingX:number;facingZ:number;hp:number;maxHp:number;mana:number;maxMana:number;
 cooldowns:number[];basicCd:number;dashCd:number;dashLeft:number;potionCd:number;potions:number;stun:number;
 state:'idle'|'run'|'attack'|'cast'|'dash'|'dead';damage:number;kills:number;assists:number;healing:number;lastAction:number;lastSkill:number|null;
}
export interface ArenaObstacle {id:string;x:number;z:number;radius:number;hp:number;maxHp:number;}
export interface PvPTelegraph {id:number;owner:string;team:number;x:number;z:number;radius:number;delay:number;damage:number;skill:number|null;color:number;}
export interface PvPResult {id:string;rating:number;honor:number;ranked:boolean;}
export interface PvPMatch {
 id:string;size:ArenaSize;phase:PvPPhase;fighters:PvPFighter[];accepted:string[];ready:string[];deadline:number;remaining:number;
 winner:0|1|null;reason:string;ranked:boolean;obstacles:ArenaObstacle[];telegraphs:PvPTelegraph[];rune:{active:boolean;next:number;kind:'heal'|'power'};
 results:PvPResult[];tick:number;
}
export interface PvPView {queue:{size:ArenaSize;since:number;found:number;required:number}|null;match:PvPMatch|null;serverTime:number;}
export const neutralPvPInput=(seq=0):PvPInput=>({seq,moveX:0,moveZ:0,aimX:0,aimZ:-1,attack:false,skill:null,dash:false,potion:null});
export const ARENA_RADIUS=24;
/** Shared by authoritative collision/LOS and authored GLB columns. */
export const arenaObstacles=():ArenaObstacle[]=>[-1,1].flatMap(x=>[-1,1].map(z=>({id:`pillar-${x}-${z}`,x:x*7,z:z*6,radius:1.1,hp:750,maxHp:750})));
export function arenaSpawn(team:number,index:number,size:number):{x:number;z:number}{return {x:(index-(size-1)/2)*3.8,z:team===0?17:-17};}
export function arenaLineOfSight(a:{x:number;z:number},b:{x:number;z:number},obstacles:readonly ArenaObstacle[]):boolean {
 const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
 return !obstacles.some(o=>{if(o.hp<=0)return false;const t=d2?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/d2)):0;return Math.hypot(a.x+t*dx-o.x,a.z+t*dz-o.z)<o.radius;});
}
