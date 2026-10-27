import type {MapPoint} from './Navigation';
export interface RecoveryTerrain {extent:number;free(x:number,z:number):boolean;height(x:number,z:number):number;}
/** Projects onto local roads first; bounded nearby recovery never jumps regions or islands. */
export function nearestSafeTrail(origin:MapPoint,trail:readonly MapPoint[],terrain:RecoveryTerrain):MapPoint|null {
  if(!Number.isFinite(origin.x)||!Number.isFinite(origin.z))return null;
  const safe=(p:MapPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<terrain.extent-2&&Math.abs(p.z)<terrain.extent-2&&terrain.free(p.x,p.z)&&Number.isFinite(terrain.height(p.x,p.z))&&[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>terrain.free(p.x+dx,p.z+dz)&&Math.abs(terrain.height(p.x+dx,p.z+dz)-terrain.height(p.x,p.z))<.85);
  const distance=(p:MapPoint)=>Math.hypot(p.x-origin.x,p.z-origin.z),candidates:MapPoint[]=[];
  for(let i=1;i<trail.length;i++){
    const a=trail[i-1],b=trail[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    if(!length)continue;
    const t=Math.max(0,Math.min(1,((origin.x-a.x)*dx+(origin.z-a.z)*dz)/length));
    const point={x:a.x+t*dx,z:a.z+t*dz};candidates.push(point,a,b);
  }
  for(const point of candidates.sort((a,b)=>distance(a)-distance(b)))if(distance(point)<=60&&safe(point))return {...point};
  for(let radius=2;radius<=12;radius+=2)for(let i=0;i<16;i++){
    const point={x:origin.x+Math.cos(i*Math.PI/8)*radius,z:origin.z+Math.sin(i*Math.PI/8)*radius};if(safe(point))return point;
  }
  return null;
}
