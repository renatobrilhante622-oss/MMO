import {CLASS_DEFINITIONS} from './ClassSystem';
import {arenaLineOfSight,neutralPvPInput,type PvPFighter,type PvPInput,type PvPMatch} from './PvPTypes';
/** Stateless decisions use exactly the input interface accepted from human clients. */
export class PvPAIController {
 decide(self:PvPFighter,match:PvPMatch):PvPInput {
  const input=neutralPvPInput(match.tick),def=CLASS_DEFINITIONS[self.classId];
  if(self.hp<=0)return input;
  const targets=match.fighters.filter(f=>f.team!==self.team&&f.hp>0).sort((a,b)=>(a.hp/a.maxHp+Math.hypot(a.x-self.x,a.z-self.z)*.018)-(b.hp/b.maxHp+Math.hypot(b.x-self.x,b.z-self.z)*.018));
  const target=targets[0];if(!target)return input;
  const dx=target.x-self.x,dz=target.z-self.z,d=Math.max(.01,Math.hypot(dx,dz)),ranged=def.stats.range>10;
  input.aimX=dx/d;input.aimZ=dz/d;
  const danger=match.telegraphs.find(t=>t.team!==self.team&&Math.hypot(t.x-self.x,t.z-self.z)<t.radius+1);
  if(danger){const ox=self.x-danger.x,oz=self.z-danger.z,len=Math.hypot(ox,oz);input.moveX=len>.1?ox/len:-dz/d;input.moveZ=len>.1?oz/len:dx/d;input.dash=self.dashCd<=0;return input;}
  const clear=arenaLineOfSight(self,target,match.obstacles),ideal=ranged?11:2.2;
  const advance=d>ideal+1?1:ranged&&d<6?-1:0;
  input.moveX=dx/d*advance;input.moveZ=dz/d*advance;
  // Strafe around cover instead of pushing indefinitely into the same column.
  if(!clear){input.moveX=-dz/d;input.moveZ=dx/d;}
  if(ranged&&advance===0){const side=Math.sin(match.tick/45+self.team*3);input.moveX=-dz/d*side*.55;input.moveZ=dx/d*side*.55;}
  input.attack=clear&&d<=Math.min(19,def.stats.range+1);
  if(!ranged&&d>8&&self.dashCd<=0){input.dash=true;}
  const injured=match.fighters.filter(f=>f.team===self.team&&f.hp>0&&f.hp<f.maxHp*.65&&Math.hypot(f.x-self.x,f.z-self.z)<7);
  for(let i=3;i>=0;i--){const s=def.skills[i],range=s.shape==='circle'?s.radius:s.range;
   if(self.cooldowns[i]<=0&&self.mana>=s.mana&&(s.heal&&injured.length>0||clear&&d<=range)){input.skill=i;break;}}
  if(self.potions>0&&self.potionCd<=0)input.potion=self.hp<self.maxHp*.35?'hp':self.mana<self.maxMana*.18?'mana':null;
  return input;
 }
}
