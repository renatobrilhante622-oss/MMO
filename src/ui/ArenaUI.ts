import {ArenaScene,type ArenaVisualFighter} from '../combat/ArenaScene';
import type {ClassId} from '../core/GameTypes';
import type {ArenaSystem} from '../combat/ArenaSystem';

/** Visual adapter only: all damage, cooldowns, AI and rewards stay in ArenaSystem. */
export class ArenaUI{
 readonly root=document.createElement('section');
 private presentation?:ArenaScene;
 private frame=0;
 private destroyed=false;
 constructor(private readonly arena:ArenaSystem){
  this.root.className='pr15-arena-3d pr16-arena-stage';
  this.root.setAttribute('aria-label','Coliseu 3D · duelo local contra IA');
 }
 mount(host:HTMLElement,_heroClass:ClassId):void{
  if(this.destroyed)return;
  if(this.root.parentElement!==host)host.append(this.root);
  if(!this.arena.duel){this.hide();return;}
  this.presentation??=new ArenaScene('Coliseu 3D · duelo local contra IA');
  this.presentation.mount(this.root);this.sync();
  if(!this.frame)this.frame=requestAnimationFrame(this.animate);
 }
 private sync():void{
  const duel=this.arena.duel;if(!duel)return;
  const fighters:ArenaVisualFighter[]=[
   {id:'local-hero',classId:duel.heroClass,hp:duel.hero.hp,maxHp:duel.hero.maxHp,energy:duel.hero.mana,x:duel.hero.position,z:0,yaw:Math.PI/2,skill:duel.hero.lastSkill,combo:duel.hero.combo},
   {id:duel.challenger.id,classId:duel.challenger.classId,hp:duel.ai.hp,maxHp:duel.ai.maxHp,energy:duel.ai.mana,x:duel.ai.position,z:0,yaw:-Math.PI/2,skill:duel.ai.lastSkill,combo:duel.ai.combo},
  ];this.presentation?.sync(fighters);
 }
 private readonly animate=():void=>{if(this.destroyed)return;this.frame=requestAnimationFrame(this.animate);this.sync();};
 hide():void{cancelAnimationFrame(this.frame);this.frame=0;this.presentation?.hide();}
 dispose():void{if(this.destroyed)return;this.destroyed=true;this.hide();this.presentation?.dispose();this.presentation=undefined;this.root.remove();}
}
