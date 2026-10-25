import type {Scene} from 'three';
import type {PhysicsWorld} from '../physics/PhysicsWorld';
import {OpenWorldGenerator} from './OpenWorldGenerator';
import {REGIONS} from './Regions';
import {dungeonColliders} from './DungeonInstance';

/**
 * One physical world instance at a time. A region owns its own triangulated
 * heightfield, GPU ground maps, scene graph, ambient effects and GLB batches.
 * Persistent actors live in Engine.scene and retain their Cannon character body.
 */
export class MapInstanceManager {
  private generation=0;
  private world:OpenWorldGenerator;
  private currentId:string;
  constructor(private readonly scene:Scene,private readonly physics:PhysicsWorld,
    initialWorld:OpenWorldGenerator){
    this.world=initialWorld;
    this.currentId=initialWorld.regionId;
  }
  get current():OpenWorldGenerator{return this.world;}
  get regionId():string{return this.currentId;}
  get revision():number{return this.generation;}
  activate(id:string):OpenWorldGenerator{
    const idx=REGIONS.findIndex(r=>r.id===id);
    if(idx<0&&id!=='dungeon')throw new Error('Unknown map: '+id);
    if(id===this.currentId)return this.world;
    const next=new OpenWorldGenerator(this.scene,id==='dungeon'?91631:713+idx*1009,id);
    let installed=false;
    try{
      next.generate();
      if(id==='dungeon')next.colliders.push(...dungeonColliders((x,z)=>next.heightAt(x,z)));
      this.physics.switchTerrain(next);
      installed=true;
    }catch(error){
      if(installed)this.physics.switchTerrain(this.world);
      next.dispose();
      throw error;
    }
    const previous=this.world;
    this.world=next;
    this.currentId=id;
    this.generation++;
    previous.dispose();
    return next;
  }
}
