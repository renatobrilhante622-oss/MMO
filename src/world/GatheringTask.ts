/** Timing/range rules are independent of the HUD and cannot be restarted mid-channel. */
export class GatheringTask {
 static readonly DURATION=1.5;
 id='';elapsed=0;private x=0;private z=0;
 start(id:string,x:number,z:number):boolean{if(this.id||!id)return false;this.id=id;this.elapsed=0;this.x=x;this.z=z;return true;}
 advance(dt:number,x:number,z:number,active:boolean):'idle'|'working'|'complete'|'cancelled'{
  if(!this.id)return 'idle';if(!active||Math.hypot(x-this.x,z-this.z)>.6){this.cancel();return 'cancelled';}
  if(Number.isFinite(dt)&&dt>0)this.elapsed=Math.min(GatheringTask.DURATION,this.elapsed+Math.min(.1,dt));
  return this.elapsed>=GatheringTask.DURATION-1e-8?'complete':'working';
 }
 cancel():void{this.id='';this.elapsed=0;}
}
