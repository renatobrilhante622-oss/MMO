import type { OpenWorldGenerator } from './OpenWorldGenerator';
export interface MapPoint { x:number; z:number; }
class Frontier {
 private entries:Array<{id:number;score:number}>=[];
 get size():number{return this.entries.length;}
 push(id:number,score:number):void {const entry={id,score};let i=this.entries.length;this.entries.push(entry);while(i>0){const p=(i-1)>>1;if(this.entries[p].score<=score)break;this.entries[i]=this.entries[p];i=p;}this.entries[i]=entry;}
 pop():number {const first=this.entries[0],tail=this.entries.pop()!;if(this.entries.length){let i=0;while(i*2+1<this.entries.length){let child=i*2+1;if(child+1<this.entries.length&&this.entries[child+1].score<this.entries[child].score)child++;if(this.entries[child].score>=tail.score)break;this.entries[i]=this.entries[child];i=child;}this.entries[i]=tail;}return first.id;}
}
/** Bounded A* over actual terrain and solid colliders. GPS paths never cross the lake. */
export function route(terrain:OpenWorldGenerator,from:MapPoint,to:MapPoint):MapPoint[] {
  const step=4,half=terrain.terrainSize/2-12,size=Math.floor(half*2/step)+1,key=(x:number,z:number)=>z*size+x;
  const grid=(p:MapPoint)=>({x:Math.max(0,Math.min(size-1,Math.round((p.x+half)/step))),z:Math.max(0,Math.min(size-1,Math.round((p.z+half)/step)))});
  const world=(x:number,z:number)=>({x:x*step-half,z:z*step-half});
  const a=grid(from),b=grid(to),start=key(a.x,a.z),goal=key(b.x,b.z);
  const cost=new Float64Array(size*size).fill(Infinity),previous=new Int32Array(size*size).fill(-1),closed=new Uint8Array(size*size),open=new Frontier();open.push(start,0);
  const heights=new Map<number,number>(),walkable=new Map<number,boolean>();
  const height=(x:number,z:number)=>{const id=key(x,z);let h=heights.get(id);if(h===undefined){const p=world(x,z);h=terrain.heightAt(p.x,p.z);heights.set(id,h);}return h;};
  const safe=(x:number,z:number)=>{const id=key(x,z);if(walkable.has(id))return walkable.get(id)!;const p=world(x,z),h=height(x,z);const ok=terrain.isWalkable(p.x,p.z)&&!terrain.colliders.some(c=>c.type!=='slide'&&Math.abs(p.x-c.position.x)<c.size.x/2+.7&&Math.abs(p.z-c.position.z)<c.size.z/2+.7&&h<c.position.y+c.size.y/2);walkable.set(id,ok);return ok;};
  cost[start]=0;
  for(let iteration=0;open.size&&iteration<size*size*8;iteration++){
    const current=open.pop();if(closed[current])continue;
    if(current===goal){const path:MapPoint[]=[];for(let id=goal;id!==start;id=previous[id]){if(id<0)return [];path.push(world(id%size,Math.floor(id/size)));}return path.reverse();}
    closed[current]=1;const cx=current%size,cz=Math.floor(current/size);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=size||z>=size)continue;const id=key(x,z);
      if(closed[id]||!safe(x,z)||(dx&&dz&&(!safe(cx+dx,cz)||!safe(cx,cz+dz))))continue;
      const slope=Math.abs(height(x,z)-height(cx,cz))/step;if(slope>.9)continue;
      const next=cost[current]+Math.hypot(dx,dz)*(1+slope*.7);if(next<cost[id]){cost[id]=next;previous[id]=current;open.push(id,next+Math.hypot(x-b.x,z-b.z));}
    }
  }
  return [];
}
