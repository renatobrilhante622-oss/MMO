import {Vector3} from 'three';
import {arenaObstacles} from '../combat/PvPTypes';
import type {Scene} from 'three';
import type {PhysicsWorld} from '../physics/PhysicsWorld';
import {OpenWorldGenerator} from './OpenWorldGenerator';
import {REGIONS} from './Regions';
import {dungeonColliders} from './DungeonInstance';
import {mapDefinition} from './maps/MapDefinitions';
/** Only one terrain/physics scene is resident. Actors, HUD and renderer survive transitions. */
export class SceneManager {
 private world:OpenWorldGenerator|null;private id:string;private generation=0;private dungeonId='tombs';
 constructor(private readonly scene:Scene,private readonly physics:PhysicsWorld,initial:OpenWorldGenerator,private readonly factory=(id:string,seed:number,dungeon:string)=>new OpenWorldGenerator(scene,seed,id,dungeon)){this.world=initial;this.id=initial.regionId;}
 get current():OpenWorldGenerator{if(!this.world)throw Error('Map unloaded');return this.world;}
 get regionId():string{return this.id;}
 get sceneKey():string{return this.id==='dungeon'?'dungeon:'+this.dungeonId:this.id;}
 get revision():number{return this.generation;}
 selectDungeon(id:string):void{this.dungeonId=id;}
 unloadCurrentMap():void{this.physics.clearTerrain();this.world?.dispose();this.world=null;}
 activate(id:string):OpenWorldGenerator{
  if(!REGIONS.some(r=>r.id===id)&&id!=='dungeon'&&id!=='arena')throw Error('Unknown map: '+id);
  if(id===this.id&&this.world&&id!=='dungeon')return this.world;
  const previous=this.id;this.unloadCurrentMap();
  try{
   const next=this.factory(id,id==='dungeon'?91631:mapDefinition(id).seed,this.dungeonId);
   this.world=next;next.generate();if(id==='dungeon')next.colliders.push(...dungeonColliders((x,z)=>next.heightAt(x,z),this.dungeonId));
   if(id==='arena')for(const o of arenaObstacles())next.colliders.push({position:new Vector3(o.x,5.2,o.z),size:new Vector3(o.radius*2,3.6,o.radius*2),type:'solid'});
   this.physics.switchTerrain(next);this.id=id;this.generation++;return next;
  }catch(error){
   this.world?.dispose();const restored=this.factory(previous,mapDefinition(previous).seed,this.dungeonId);this.world=restored;restored.generate();this.physics.switchTerrain(restored);this.id=previous;throw error;
  }
 }
 async loadMap(id:string):Promise<OpenWorldGenerator>{
  const previous=this.id,next=this.activate(id);
  try{await next.ready;if(this.world!==next)throw Error('Map load superseded');return next;}
  catch(error){if(this.world===next&&previous!==id)this.activate(previous);throw error;}
 }
}
