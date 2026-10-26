import type {OpenWorldGenerator} from '../world/OpenWorldGenerator';
import {REGIONS} from '../world/Regions';
import {mapDefinition} from '../world/maps/MapDefinitions';
import {portalSites} from '../world/WorldPortals';
import type {Bookmark,Language} from '../progression/AdventureProgress';
import type {MapPoint} from '../world/Navigation';
const N=1120;
/** Cartography samples only the active scene: old continent coordinates never leak across maps. */
export class WorldAtlas {
 private base?:HTMLCanvasElement;private terrain?:OpenWorldGenerator;
 draw(canvas:HTMLCanvasElement,terrain:OpenWorldGenerator,player:MapPoint,heading:number,path:MapPoint[],bookmarks:Array<Bookmark|null>,language:Language):void {
  if(this.terrain!==terrain){this.terrain=terrain;this.base=this.paintBase(terrain);}
  canvas.width=N;canvas.height=N;const c=canvas.getContext('2d')!;c.drawImage(this.base!,0,0);
  const half=terrain.terrainSize/2,p=(v:MapPoint)=>[(v.x+half)/terrain.terrainSize*N,(v.z+half)/terrain.terrainSize*N];
  const current=REGIONS.find(r=>r.id===terrain.regionId)??REGIONS[0],profile=mapDefinition(current.id);
  c.save();c.lineCap='round';c.lineJoin='round';
  if(path.length){c.beginPath();c.moveTo(...p(player) as [number,number]);for(const point of path)c.lineTo(...p(point) as [number,number]);c.strokeStyle='#4e331e';c.lineWidth=10;c.stroke();c.setLineDash([5,14]);c.strokeStyle='#ffe29a';c.lineWidth=6;c.stroke();c.setLineDash([]);}
  const [bx,by]=p(profile.boss);this.boss(c,bx,by);
  for(const marker of terrain.markers){const [x,y]=p(marker);c.fillStyle=marker.color;c.beginPath();c.arc(x,y,8,0,7);c.fill();c.fillStyle='#f6e8c1';c.font='17px Georgia';c.textAlign='center';c.fillText(marker.label,x,y+26);}
  for(const gate of portalSites(current.id)){const [x,y]=p(gate);c.strokeStyle='#e5c789';c.lineWidth=4;c.strokeRect(x-12,y-15,24,30);c.fillStyle='#ddd2ec';c.font='16px Georgia';c.fillText(REGIONS.find(r=>r.id===gate.destId)!.name[language==='pt'?0:1],x,y-24);}
  bookmarks.forEach((b,i)=>{if(!b||b.region!==current.id)return;const [x,y]=p(b);c.fillStyle='#557fbb';c.fillRect(x-8,y-8,16,16);c.fillStyle='#fff2bc';c.font='bold 15px system-ui';c.fillText(String(i+1),x,y-14);});
  const [x,y]=p(player);c.translate(x,y);c.rotate(heading);c.fillStyle='#ffe7a0';c.strokeStyle='#4e3924';c.lineWidth=3;c.beginPath();c.moveTo(0,-18);c.lineTo(12,13);c.lineTo(0,7);c.lineTo(-12,13);c.closePath();c.fill();c.stroke();c.restore();
  c.font='bold 28px Georgia';c.fillStyle='#f7e4ad';c.textAlign='left';c.fillText(current.name[language==='pt'?0:1],30,46);this.compass(c,N-86,96);
 }
 private paintBase(terrain:OpenWorldGenerator):HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=N;const c=canvas.getContext('2d')!;
  const colors:Record<string,[number,number,number]>={aurora:[95,136,85],crypt:[104,87,112],highlands:[191,221,234],rift:[89,68,62],eclipse:[76,53,116]};
  const rgb=colors[terrain.regionId]??colors.aurora,half=terrain.terrainSize/2,step=terrain.terrainSize/N;
  const raster=c.createImageData(N,N);
  for(let y=0;y<N;y+=4)for(let x=0;x<N;x+=4){
   const wx=x*step-half,wz=y*step-half,h=terrain.heightAt(wx,wz),slope=(terrain.heightAt(wx+1,wz)-h)*.17+(terrain.heightAt(wx,wz+1)-h)*.23;
   const shade=Math.max(.45,Math.min(1.3,1-slope)),color=terrain.regionId==='eclipse'&&h<2?[9,6,24]:h<terrain.waterLevel?[48,118,143]:rgb;
   for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++){const i=((y+dy)*N+x+dx)*4;raster.data[i]=color[0]*shade;raster.data[i+1]=color[1]*shade;raster.data[i+2]=color[2]*shade;raster.data[i+3]=255;}
  }c.putImageData(raster,0,0);
  c.strokeStyle='#f2e0b322';c.lineWidth=1;
  for(const level of [3,6,9,12,16,21,27]){c.beginPath();for(let y=0;y<N-12;y+=12)for(let x=0;x<N-12;x+=12){const a=terrain.heightAt(x*step-half,y*step-half),b=terrain.heightAt((x+12)*step-half,y*step-half);if((a-level)*(b-level)<0){c.moveTo(x,y);c.lineTo(x+6,y+5);}}c.stroke();}
  for(let i=0;i<190;i++){const x=20+((i*.6180339)%1)*(N-40),y=70+((i*.41421356)%1)*(N-120),wx=x*step-half,wz=y*step-half,h=terrain.heightAt(wx,wz);if(!terrain.isWalkable(wx,wz))continue;if(terrain.regionId==='aurora')this.tree(c,x,y,11+i%9);else if(terrain.regionId==='highlands'||h>19)this.mountain(c,x,y,15+i%13);}
  c.strokeStyle='#dec18d88';c.lineWidth=4;c.strokeRect(8,8,N-16,N-16);return canvas;
 }
  private tree(c:CanvasRenderingContext2D,x:number,y:number,size:number):void {c.fillStyle='#314936';c.fillRect(x-1,y-2,2,size*.5);for(let i=0;i<3;i++){c.fillStyle=['#395d44','#416b4f','#5e805b'][i];c.beginPath();c.moveTo(x-size*.55,y-i*size*.27);c.quadraticCurveTo(x-size*.25,y-size*.7-i*size*.15,x,y-size-i*size*.15);c.quadraticCurveTo(x+size*.25,y-size*.7-i*size*.15,x+size*.55,y-i*size*.27);c.closePath();c.fill();}}
  private mountain(c:CanvasRenderingContext2D,x:number,y:number,size:number):void {c.strokeStyle='#4c5656aa';c.lineWidth=1;c.beginPath();c.moveTo(x-size,y+size*.4);c.lineTo(x,y-size);c.lineTo(x+size*.8,y+size*.4);c.closePath();c.fillStyle='#879594';c.fill();c.stroke();c.beginPath();c.moveTo(x,y-size);c.lineTo(x+size*.8,y+size*.4);c.lineTo(x+2,y+size*.1);c.fillStyle='#586d73';c.fill();c.beginPath();c.moveTo(x-size*.3,y-size*.55);c.lineTo(x,y-size);c.lineTo(x+size*.28,y-size*.5);c.lineTo(x,y-size*.62);c.fillStyle='#e4e7d8';c.fill();}
  private boss(c:CanvasRenderingContext2D,x:number,y:number):void {c.save();c.translate(x,y);c.shadowColor='#30201b';c.shadowBlur=5;c.fillStyle='#753e34';c.strokeStyle='#e2c495';c.lineWidth=3;c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#e8d8b4';c.beginPath();c.arc(0,-2,8,0,Math.PI*2);c.fill();c.fillRect(-5,2,10,8);c.fillStyle='#522c27';c.beginPath();c.arc(-3,-2,2.5,0,7);c.arc(3,-2,2.5,0,7);c.fill();c.restore();}
  private compass(c:CanvasRenderingContext2D,x:number,y:number):void {c.save();c.translate(x,y);c.strokeStyle='#dfd5ae';c.lineWidth=2;c.beginPath();c.arc(0,0,40,0,7);c.stroke();for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.fillStyle=i%2?'#d6c69a':'#293e3c';c.beginPath();c.moveTo(0,-36);c.lineTo(7,0);c.lineTo(0,10);c.lineTo(-7,0);c.closePath();c.fill();c.restore();}c.font='bold 18px Georgia';c.textAlign='center';c.fillStyle='#f8edc9';c.fillText('N',0,-49);c.restore();}
}
