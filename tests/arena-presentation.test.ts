import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {arenaTeamPosition,arenaCameraFrame} from '../src/combat/ArenaScene';

describe('cinematic arena framing',()=>{
 it('keeps every real 1v1, 2v2 and 3v3 fighter in a distinct symmetric place',()=>{
  for(const size of [1,2,3]){
   const left=Array.from({length:size},(_,i)=>arenaTeamPosition(0,i,size));
   const right=Array.from({length:size},(_,i)=>arenaTeamPosition(1,i,size));
   expect(new Set(left.map(p=>p.x+':'+p.z)).size).toBe(size);
   for(let i=0;i<size;i++){expect(left[i].x).toBe(-right[i].x);expect(left[i].z).toBe(right[i].z);expect(left[i].yaw).toBe(-right[i].yaw);}
   expect(left.reduce((sum,p)=>sum+p.z,0)).toBeCloseTo(0);
  }
 });
 it('retains complete fighters at both extremes of a duel in portrait and landscape',()=>{
  for(const [width,height]of [[390,844],[844,390],[1366,768]])for(const [minX,maxX]of [[-3,3],[-3,5],[-2.2,2.2]]){
   const aspect=width/height,center=(minX+maxX)/2,frame=arenaCameraFrame(aspect,(maxX-minX)/2+.7);
   const camera=new PerspectiveCamera(frame.fov,aspect,.1,100);camera.position.set(center,8,frame.distance);camera.lookAt(center,.7,0);camera.updateMatrixWorld(true);
   for(const x of [minX-.45,maxX+.45])for(const y of [0,2.25])for(const z of [-2.3,2.3]){
    const point=new Vector3(x,y,z).project(camera);
    expect(Math.abs(point.x)).toBeLessThan(1);expect(Math.abs(point.y)).toBeLessThan(1);expect(point.z).toBeLessThan(1);
   }
  }
 });
 it('does not produce invalid projection values for an unmeasured container',()=>{
  for(const aspect of [0,NaN,Infinity,-1]){const frame=arenaCameraFrame(aspect);expect(Number.isFinite(frame.fov)).toBe(true);expect(Number.isFinite(frame.distance)).toBe(true);expect(frame.distance).toBeGreaterThan(0);}
 });
});
