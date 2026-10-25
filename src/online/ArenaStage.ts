import {ArenaScene,arenaTeamPosition} from '../combat/ArenaScene';
import {CLASS_DEFINITIONS} from '../combat/ClassSystem';
import type {ClassId} from '../core/GameTypes';
import type {OnlineView} from './OnlineClient';

/** Uses authoritative snapshots for the same immersive coliseum as the local ladder. */
export class ArenaStage {
 private readonly presentation=new ArenaScene('Coliseu online · jogadores conectados');
 mount(container:HTMLElement,view:OnlineView):void{
  const fighters=view.match?.fighters??[],counts=[0,0];
  const sizes=[fighters.filter(f=>f.team===0).length,fighters.filter(f=>f.team!==0).length];
  this.presentation.sync(fighters.map(f=>{
   const team=f.team===0?0:1;
   const position=arenaTeamPosition(team,counts[team]++,sizes[team]);
   return {id:f.id,classId:(f.classId&&f.classId in CLASS_DEFINITIONS?f.classId:'berserker') as ClassId,hp:f.hp,maxHp:f.maxHp,energy:f.energy,...position};
  }));
  this.presentation.mount(container);
 }
 hide():void{this.presentation.hide();}
 dispose():void{this.presentation.dispose();}
}
