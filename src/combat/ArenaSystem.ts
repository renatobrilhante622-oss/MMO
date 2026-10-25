import type {ClassId} from '../core/GameTypes';
import {CLASS_DEFINITIONS,CLASS_IDS} from './ClassSystem';

export const ARENA_ELOS=['Bronze','Prata','Ouro','Platina','Diamante','Grão-Mestre','Lenda Eterna'] as const;
export type ArenaElo=typeof ARENA_ELOS[number];
export interface ArenaChallenger {id:string;name:string;classId:ClassId;cp:number;rating:number;elo:ArenaElo;}
export interface ArenaFighter {hp:number;maxHp:number;mana:number;maxMana:number;potions:number;guard:number;dash:number;dodge:number;combo:number;cooldowns:number[];position:number;lastSkill:number;}
export interface ArenaDuel {challenger:ArenaChallenger;heroClass:ClassId;hero:ArenaFighter;ai:ArenaFighter;time:number;ended:boolean;winner:'hero'|'ai'|null;log:string[];}
export interface ArenaSave {rating:number;honor:number;wins:number;losses:number;matches:number;titles:string[];equippedTitle:string;shop:string[];}
export const ARENA_TITLE_DEFINITIONS=[
 {id:'arena-imperador',name:'👑 Imperador da Arena',wins:12,attack:.04,hp:.08,speed:.01,crit:.01},
 {id:'arena-guerra',name:'⚡ Deus da Guerra',wins:25,attack:.07,hp:.05,speed:.02,crit:.025},
 {id:'arena-ceifador',name:'💀 Ceifador Abissal',wins:6,attack:.03,hp:.02,speed:.03,crit:.015},
] as const;
export const ARENA_SHOP=[
 {id:'gladiator-skin',name:'Armadura do Gladiador',price:160,type:'skin'},
 {id:'gladiator-blade',name:'Lâmina da Arena',price:210,type:'weapon'},
 {id:'champion-crown',name:'Coroa do Campeão',price:320,type:'title'},
] as const;
function clamp(n:number,min:number,max:number):number{return Math.max(min,Math.min(max,n));}
export function eloForRating(rating:number):ArenaElo{
 return ARENA_ELOS[clamp(Math.floor((Math.max(0,rating)-800)/160),0,6)];
}
export function createFighter(cp:number):ArenaFighter{
 const maxHp=1000+Math.max(0,Math.floor(cp))*.42;
 return {hp:maxHp,maxHp,mana:180,maxMana:180,potions:2,guard:0,dash:0,dodge:0,combo:0,cooldowns:[0,0,0,0],position:0,lastSkill:-1};
}
/** Offline single-player competitive ladder. NEVER masquerades as real server PvP. */
export class ArenaSystem{
 rating=900;honor=0;wins=0;losses=0;matches=0;
 titles:string[]=[];equippedTitle='';shop:string[]=[];
 duel:ArenaDuel|null=null;
 private seed=0x51ab7e;
 get elo():ArenaElo{return eloForRating(this.rating);}
 private random():number{this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 challengers():ArenaChallenger[]{
  const names=['Valquíria de Aster','Lâmina do Crepúsculo','Sentinela do Abismo','Vigia Carmesim','Coração de Ferro','Maga da Nebulosa','Arauto das Runas','Guardião da Aurora','Carrasco Glacial'];
  const tiers=[-120,20,170];
  return tiers.map((difference,i)=>{
   const slot=(this.matches*3+i*2)%CLASS_IDS.length;
   const classId=CLASS_IDS[slot],rating=Math.max(800,this.rating+difference);
   return {id:'gladiator-'+this.matches+'-'+i,name:names[(this.matches+i*3)%names.length],classId,rating,cp:Math.round(450+(rating-800)*1.45+i*50),elo:eloForRating(rating)};
  });
 }
 start(id:string,heroClass:ClassId,heroCp:number):boolean{
  if(this.duel&&!this.duel.ended)return false;
  const challenger=this.challengers().find(c=>c.id===id);
  if(!challenger||!Number.isFinite(heroCp))return false;
  const hero=createFighter(clamp(Math.round(heroCp),300,5000)),ai=createFighter(challenger.cp);
  hero.position=-3;ai.position=3;
  this.duel={challenger,heroClass,hero,ai,time:0,ended:false,winner:null,log:['⚔️ O Coliseu abriu seus portões.']};
  return true;
 }
 private add(message:string):void{if(!this.duel)return;this.duel.log.push(message);if(this.duel.log.length>12)this.duel.log.shift();}
 private strike(attacker:ArenaFighter,defender:ArenaFighter,damage:number,kind:string):boolean{
  if(!this.duel||this.duel.ended||Math.abs(attacker.position-defender.position)>4.2)return false;
  if(defender.dodge>0){this.add('💨 Esquiva perfeita');return true;}
  const mitigated=(1-defender.guard*.55);
  defender.hp=Math.max(0,defender.hp-Math.max(1,Math.round(damage*mitigated)));
  attacker.combo=(attacker.combo+1)%4;
  this.add(kind+' · '+Math.round(damage*mitigated)+' dano');
  this.resolve();return true;
 }
 action(action:'strike'|'dash'|'dodge'|'potion'|'guard'|'skill',index=0):boolean{
  const d=this.duel;if(!d||d.ended)return false;
  const h=d.hero,a=d.ai;
  if(action==='potion'){if(h.potions<=0||h.hp===h.maxHp)return false;h.potions--;h.hp=Math.min(h.maxHp,h.hp+h.maxHp*.33);this.add('🧪 Herói restaurou a vida');return true;}
  if(action==='dash'){if(h.dash>0)return false;h.position=Math.min(a.position-.9,h.position+2.4);h.dash=3.8;this.add('⚡ Dash do herói');return true;}
  if(action==='dodge'){if(h.dodge>0)return false;h.dodge=.5;h.dash=Math.max(h.dash,1.5);this.add('💨 Herói esquivou');return true;}
  if(action==='guard'){h.guard=1.1;this.add('🛡️ Guarda defensiva');return true;}
  if(action==='strike')return this.strike(h,a,75+Math.min(3,h.combo)*17,'⚔️ Combo do herói');
  const skill=CLASS_DEFINITIONS[d.heroClass].skills[index];
  if(!skill||h.cooldowns[index]>0||h.mana<skill.mana)return false;
  h.mana-=skill.mana;h.cooldowns[index]=skill.cooldown;h.lastSkill=index;
  return this.strike(h,a,90*skill.multiplier,'✨ Skill '+(index+1));
 }
 tick(dt:number):void{
  const d=this.duel;if(!d||d.ended)return;
  dt=clamp(dt,0,.1);d.time+=dt;
  for(const f of [d.hero,d.ai]){
   f.cooldowns=f.cooldowns.map(c=>Math.max(0,c-dt));
   f.guard=Math.max(0,f.guard-dt);f.dash=Math.max(0,f.dash-dt);f.dodge=Math.max(0,f.dodge-dt);
   f.mana=Math.min(f.maxMana,f.mana+dt*9);
  }
  const h=d.hero,a=d.ai;
  // Tactical AI, deterministic per duel: kite, dash, dodge, sustain and four rotating skills.
  const distance=Math.abs(h.position-a.position),move=distance>2.1?1:-.4;
  a.position=clamp(a.position-move*dt*(2.2+d.challenger.cp/1300),h.position+.7,5);
  if(a.hp<a.maxHp*.38&&a.potions>0){a.hp=Math.min(a.maxHp,a.hp+a.maxHp*.31);a.potions--;this.add('🧪 Rival usou poção');}
  if(d.time%5<dt&&a.dash===0){a.position=Math.max(h.position+.85,a.position-1.4);a.dash=4;this.add('⚡ Rival fez dash');}
  if(d.time%6<dt&&a.dodge===0){a.dodge=.5;this.add('💨 Rival esquivou');}
  if(d.time%1.45<dt){
    const skills=CLASS_DEFINITIONS[d.challenger.classId].skills;
    let cast=false;
    for(let z=0;z<4;z++){
      const idx=(Math.floor(d.time/1.45)+z)%4,sk=skills[idx];
      if(sk&&a.cooldowns[idx]<=0&&a.mana>=sk.mana&&distance<5){
        a.mana-=sk.mana;a.cooldowns[idx]=sk.cooldown;a.lastSkill=idx;
        this.strike(a,h,(67+d.challenger.cp*.018)*sk.multiplier,'🔥 '+d.challenger.name+' · '+sk.name);
        cast=true;break;
      }
    }
    if(!cast)this.strike(a,h,54+d.challenger.cp*.015,'⚔️ Ataque básico adversário');
  }
  if(d.time>=120&&!d.ended){d.winner=h.hp>=a.hp?'hero':'ai';this.finish();}
 }
 private resolve():void{const d=this.duel;if(!d||d.ended)return;if(d.hero.hp<=0||d.ai.hp<=0){d.winner=d.ai.hp<=0?'hero':'ai';this.finish();}}
 private finish():void{
  const d=this.duel;if(!d||d.ended)return;d.ended=true;this.matches++;
  if(d.winner==='hero'){
    this.wins++;const earned=Math.max(15,Math.round(24+(d.challenger.rating-this.rating)*.035));
    this.rating=clamp(this.rating+Math.max(8,Math.round(24+(d.challenger.rating-this.rating)*.03)),800,2400);
    this.honor+=earned;this.add('🏆 Vitória · +'+earned+' Moedas de Honra');
    for(const t of ARENA_TITLE_DEFINITIONS){if(this.wins>=t.wins&&!this.titles.includes(t.id)){this.titles.push(t.id);this.add('✨ Título desbloqueado: '+t.name);}}
  }else{this.losses++;this.rating=Math.max(800,this.rating-12);this.add('Derrota. Estude o combo e desafie novamente.');}
 }
 equipTitle(id:string):boolean{if(id!==''&&!this.titles.includes(id))return false;this.equippedTitle=id;return true;}
 titleBonuses():{attack:number;hp:number;speed:number;crit:number}{
  const t=ARENA_TITLE_DEFINITIONS.find(t=>t.id===this.equippedTitle);
  return t?{attack:t.attack,hp:t.hp,speed:t.speed,crit:t.crit}:{attack:0,hp:0,speed:0,crit:0};
 }
 buy(id:string):boolean{const item=ARENA_SHOP.find(i=>i.id===id);if(!item||this.shop.includes(id)||this.honor<item.price)return false;this.honor-=item.price;this.shop.push(id);return true;}
 snapshot():ArenaSave{return {rating:this.rating,honor:this.honor,wins:this.wins,losses:this.losses,matches:this.matches,titles:[...this.titles],equippedTitle:this.equippedTitle,shop:[...this.shop]};}
 restore(raw:unknown):void{
  if(!raw||typeof raw!=='object')return;const r=raw as Record<string,unknown>;
  const num=(x:unknown,min:number,max:number,def:number)=>typeof x==='number'&&Number.isFinite(x)?clamp(Math.floor(x),min,max):def;
  this.rating=num(r.rating,800,2400,900);this.honor=num(r.honor,0,1e8,0);this.wins=num(r.wins,0,1e6,0);this.losses=num(r.losses,0,1e6,0);this.matches=num(r.matches,0,1e6,0);
  this.titles=Array.isArray(r.titles)?r.titles.filter((id):id is string=>typeof id==='string'&&ARENA_TITLE_DEFINITIONS.some(t=>t.id===id)).slice(0,3):[];
  this.shop=Array.isArray(r.shop)?r.shop.filter((id):id is string=>typeof id==='string'&&ARENA_SHOP.some(t=>t.id===id)):[];this.equippedTitle=typeof r.equippedTitle==='string'&&this.titles.includes(r.equippedTitle)?r.equippedTitle:'';
 }
}
