import {AdditiveBlending,Mesh,MeshBasicMaterial,PlaneGeometry,Scene,Vector3} from 'three';
import type {Combatant} from '../core/GameTypes';
import {TalentTreeSystem} from './TalentTreeSystem';
/** Runtime rune effects share the combatant HP authority, not decorative CSS. */
export class RuneCombatEffects{
 private readonly burns:Array<{position:Vector3;time:number;tick:number;mesh?:Mesh}>=[];
 private readonly geometry=new PlaneGeometry(3.6,3.6);
 private readonly material=new MeshBasicMaterial({color:0xff531f,transparent:true,opacity:.30,depthWrite:false,side:2,blending:AdditiveBlending});
 constructor(private readonly scene:Scene,private runes:TalentTreeSystem){}
 onSkill(position:Vector3,element:string):void{
  if(!this.runes.unlocked('ember-ground')||element!=='fire')return;
  const mesh=new Mesh(this.geometry,this.material);mesh.rotation.x=-Math.PI/2;mesh.position.copy(position);mesh.position.y-=.4;
  this.scene.add(mesh);this.burns.push({position:position.clone(),time:4,tick:0,mesh});
 }
 onDash(position:Vector3,targets:Combatant[],attack:number):number{
  if(!this.runes.unlocked('shadow-dash'))return 0;
  let n=0;for(const enemy of targets)if(enemy.alive&&enemy.position.distanceTo(position)<3){enemy.receiveDamage(Math.max(1,attack*.5));n++;}
  return n;
 }
 onAttack(targets:Combatant[],position:Vector3,attack:number):number{
  if(!this.runes.unlocked('twin-blades'))return 0;
  let n=0;for(const enemy of targets)if(enemy.alive&&enemy.position.distanceTo(position)<4){enemy.receiveDamage(Math.max(1,attack*.25));n++;break;}return n;
 }
 update(dt:number,targets:Combatant[],attack:number):void{
  for(let i=this.burns.length-1;i>=0;i--){
   const b=this.burns[i];b.time-=dt;b.tick+=dt;
   if(b.tick>=.5){b.tick=0;for(const e of targets)if(e.alive&&e.position.distanceTo(b.position)<2.5)e.receiveDamage(Math.max(1,attack*.075));}
   if(b.time<=0){b.mesh?.removeFromParent();this.burns.splice(i,1);}
  }
 }
 dispose():void{for(const b of this.burns)b.mesh?.removeFromParent();this.burns.length=0;this.geometry.dispose();this.material.dispose();}
}
