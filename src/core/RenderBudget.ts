import type {Vector3} from 'three';
export const ACTOR_RADIUS=45;
export function withinActorRadius(position:Pick<Vector3,'x'|'y'|'z'>,camera:Pick<Vector3,'x'|'y'|'z'>):boolean {const x=position.x-camera.x,y=position.y-camera.y,z=position.z-camera.z;return x*x+y*y+z*z<=ACTOR_RADIUS*ACTOR_RADIUS;}
export function cappedPixelRatio(dpr:number,mobile:boolean,high:boolean):number{return Math.min(Number.isFinite(dpr)&&dpr>0?dpr:1,mobile?1.5:1.65,high?1.65:1);}
/** Slow hysteresis avoids reacting to a single shader compilation or pause. */
export class FrameBudget {
  private elapsed=0;private frames=0;private seconds=0;
  update(dt:number,current:number):number {if(!Number.isFinite(dt)||dt<=0)return current;this.elapsed+=Math.min(dt,.1);this.frames++;this.seconds+=dt;if(this.seconds<4)return current;const average=this.elapsed/this.frames;this.elapsed=this.seconds=0;this.frames=0;return average>1/48?Math.max(.65,Math.round((current-.1)*100)/100):current;}
}
