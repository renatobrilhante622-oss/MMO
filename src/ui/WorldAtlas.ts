import type { OpenWorldGenerator } from '../world/OpenWorldGenerator';
import { regionAt,REGIONS } from '../world/Regions';
import type { Bookmark,Language } from '../progression/AdventureProgress';
import type { MapPoint } from '../world/Navigation';
const N=1120;
/** Hand-inked cartographic symbols over a shaded relief raster sampled from the playable heightfield. */
export class WorldAtlas {
  private base?:HTMLCanvasElement;
  draw(canvas:HTMLCanvasElement,terrain:OpenWorldGenerator,player:MapPoint,heading:number,path:MapPoint[],bookmarks:Array<Bookmark|null>,language:Language):void {
    this.base??=this.paintBase(terrain);
    canvas.width=N;canvas.height=N;const c=canvas.getContext('2d')!;c.drawImage(this.base,0,0);
    const p=(v:MapPoint)=>[(v.x+140)*4,(v.z+140)*4];
    c.save();c.lineCap='round';c.lineJoin='round';
    if(path.length){c.beginPath();const [x,y]=p(player);c.moveTo(x,y);for(const point of path){const [px,py]=p(point);c.lineTo(px,py);}c.strokeStyle='#452f1a';c.lineWidth=10;c.stroke();c.setLineDash([4,14]);c.strokeStyle='#ffe29a';c.lineWidth=6;c.shadowColor='#ffd56b';c.shadowBlur=9;c.stroke();c.setLineDash([]);c.shadowBlur=0;const [ex,ey]=p(path.at(-1)!);c.strokeStyle='#fff0b9';c.lineWidth=3;c.beginPath();c.arc(ex,ey,13,0,Math.PI*2);c.stroke();}
    for(const region of REGIONS){const [x,y]=p(region.center);c.font='600 23px Georgia';c.textAlign='center';c.lineWidth=6;c.strokeStyle='#dfd5ae';c.strokeText(region.name[language==='pt'?0:1],x,y-30);c.fillStyle='#243936';c.fillText(region.name[language==='pt'?0:1],x,y-30);c.font='15px serif';c.fillText(`Lv. ${region.minLevel}–${region.maxLevel}`,x,y-8);const [bx,by]=p(region.boss);this.boss(c,bx,by);}
    bookmarks.forEach((b,i)=>{if(!b)return;const [x,y]=p(b);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#405e7c';c.strokeStyle='#e9d8b1';c.lineWidth=3;c.fillRect(-11,-11,22,22);c.strokeRect(-11,-11,22,22);c.restore();c.font='bold 14px system-ui';c.textAlign='center';c.fillStyle='#fff2c7';c.fillText(String(i+1),x,y+5);});
    const [x,y]=p(player);c.save();c.translate(x,y);c.rotate(heading);c.shadowColor='#fff4ae';c.shadowBlur=15;c.fillStyle='#fff0a0';c.strokeStyle='#644e2d';c.lineWidth=3;c.beginPath();c.moveTo(0,-17);c.lineTo(12,14);c.lineTo(0,8);c.lineTo(-12,14);c.closePath();c.fill();c.stroke();c.restore();
    this.compass(c,N-86,96);c.restore();
  }
  private paintBase(terrain:OpenWorldGenerator):HTMLCanvasElement {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=N;const c=canvas.getContext('2d')!;
    const raster=c.createImageData(N,N),data=raster.data;
    const palettes:Record<string,number[]>={aurora:[134,149,101],lake:[70,113,91],crypt:[195,167,111],rift:[117,104,131],highlands:[152,166,166],eclipse:[116,114,124]};
    for(let y=0;y<N;y+=2)for(let x=0;x<N;x+=2){const wx=x/4-140,wz=y/4-140,h=terrain.heightAt(wx,wz),hx=terrain.heightAt(wx+.7,wz),hz=terrain.heightAt(wx,wz+.7);const r=regionAt(wx,wz);const shade=Math.max(.55,Math.min(1.28,1-(hx-h)*.17-(hz-h)*.25));const noise=Math.sin(x*12.9898+y*78.233)*43758.5453,grain=(noise-Math.floor(noise)-.5)*8;
      let rgb=[0,0,0],total=0;for(const region of REGIONS){const d=Math.hypot(wx-region.center.x,wz-region.center.z)/region.radius,w=1/Math.pow(.14+d,5);total+=w;for(let k=0;k<3;k++)rgb[k]+=palettes[region.id][k]*w;}rgb=rgb.map(n=>n/total);if(h<terrain.waterLevel)rgb=[43,106+Math.max(0,h)*5,124];else if(h<terrain.waterLevel+1)rgb=[189,182,139];else if(h>21)rgb=[191,196,187];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const offset=((y+dy)*N+x+dx)*4;data[offset]=rgb[0]*shade+grain;data[offset+1]=rgb[1]*shade+grain;data[offset+2]=rgb[2]*shade+grain;data[offset+3]=255;}}
    c.putImageData(raster,0,0);
    // Contour fragments are derived from the exact sampled heightfield.
    c.strokeStyle='#493d2b32';c.lineWidth=1;
    for(const level of [3,6,9,12,16,21,27]){c.beginPath();for(let y=0;y<N-8;y+=8)for(let x=0;x<N-8;x+=8){const a=terrain.heightAt(x/4-140,y/4-140),b=terrain.heightAt((x+8)/4-140,y/4-140),d=terrain.heightAt(x/4-140,(y+8)/4-140);if((a-level)*(b-level)<0){const t=(level-a)/(b-a);c.moveTo(x+t*8,y);c.lineTo(x+t*8+3,y+5);}if((a-level)*(d-level)<0){const t=(level-a)/(d-a);c.moveTo(x,y+t*8);c.lineTo(x+5,y+t*8+2);}}c.stroke();}
    // Inked mountain ranges, woodland symbols and dunes reinforce biome silhouettes.
    for(let i=0;i<410;i++){const hx=Math.sin(i*127.1+3.3)*43758.5453,hy=Math.sin(i*311.7+8.1)*98143.737;const x=15+(hx-Math.floor(hx))*1090,y=20+(hy-Math.floor(hy))*1080,wx=x/4-140,wz=y/4-140,h=terrain.heightAt(wx,wz),r=regionAt(wx,wz);if(h<terrain.waterLevel+1)continue;if(r.id==='lake'||(r.id==='aurora'&&i%3===0))this.tree(c,x,y,8+i%6);else if(r.id==='highlands'||h>17)this.mountain(c,x,y,12+i%11);else if(r.id==='crypt'&&i%2===0){c.strokeStyle='#80633255';c.lineWidth=1.5;c.beginPath();c.moveTo(x-13,y+4);c.quadraticCurveTo(x,y-10,x+17,y+2);c.stroke();}}
    // Fine tributary ink joins the lake and gives the atlas a readable watershed.
    c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(880,250);c.bezierCurveTo(830,320,905,360,839,409);c.bezierCurveTo(795,440,839,486,784,517);c.bezierCurveTo(744,547,793,576,752,600);c.strokeStyle='#dce5bf';c.lineWidth=9;c.stroke();c.strokeStyle='#527f8b';c.lineWidth=5;c.stroke();c.restore();
    const path=(points:number[][])=>{c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.lineJoin='round';c.strokeStyle='#655440';c.lineWidth=9;c.stroke();c.strokeStyle='#dcc595';c.lineWidth=5;c.stroke();c.setLineDash([2,10]);c.strokeStyle='#695537';c.lineWidth=1.5;c.stroke();c.setLineDash([]);};
    const road:number[][]=[];for(let z=18;z>=-74;z-=2)road.push([(Math.sin((18-z)*.075)*2.3+140)*4,(z+140)*4]);path(road);
    for(const r of REGIONS.filter(r=>r.id!=='aurora'))path([[560,632],[(r.center.x*.45+140)*4,(r.center.z*.45+140)*4],[(r.center.x+140)*4,(r.center.z+140)*4]]);
    // Village roofs and watchtowers are distinct from the regional labels.
    for(const [x,z]of [[-12,12],[12,12],[-12,29],[12,29]]){const px=(x+140)*4,py=(z+140)*4;c.fillStyle='#745344';c.fillRect(px-14,py-10,28,22);c.fillStyle='#b2815b';c.beginPath();c.moveTo(px-18,py-8);c.lineTo(px,py-24);c.lineTo(px+18,py-8);c.fill();c.strokeStyle='#443b31';c.strokeRect(px-14,py-10,28,22);}
    c.strokeStyle='#d4d7bb55';c.lineWidth=2;c.strokeRect(15,15,N-30,N-30);c.strokeStyle='#39443d';c.lineWidth=6;c.strokeRect(7,7,N-14,N-14);
    const edge=c.createRadialGradient(N/2,N/2,N*.2,N/2,N/2,N*.7);edge.addColorStop(0,'#071b2400');edge.addColorStop(1,'#15221b66');c.fillStyle=edge;c.fillRect(0,0,N,N);return canvas;
  }
  private tree(c:CanvasRenderingContext2D,x:number,y:number,size:number):void {c.fillStyle='#314936';c.fillRect(x-1,y-2,2,size*.5);for(let i=0;i<3;i++){c.fillStyle=['#395d44','#416b4f','#5e805b'][i];c.beginPath();c.moveTo(x-size*.55,y-i*size*.27);c.quadraticCurveTo(x-size*.25,y-size*.7-i*size*.15,x,y-size-i*size*.15);c.quadraticCurveTo(x+size*.25,y-size*.7-i*size*.15,x+size*.55,y-i*size*.27);c.closePath();c.fill();}}
  private mountain(c:CanvasRenderingContext2D,x:number,y:number,size:number):void {c.strokeStyle='#4c5656aa';c.lineWidth=1;c.beginPath();c.moveTo(x-size,y+size*.4);c.lineTo(x,y-size);c.lineTo(x+size*.8,y+size*.4);c.closePath();c.fillStyle='#879594';c.fill();c.stroke();c.beginPath();c.moveTo(x,y-size);c.lineTo(x+size*.8,y+size*.4);c.lineTo(x+2,y+size*.1);c.fillStyle='#586d73';c.fill();c.beginPath();c.moveTo(x-size*.3,y-size*.55);c.lineTo(x,y-size);c.lineTo(x+size*.28,y-size*.5);c.lineTo(x,y-size*.62);c.fillStyle='#e4e7d8';c.fill();}
  private boss(c:CanvasRenderingContext2D,x:number,y:number):void {c.save();c.translate(x,y);c.shadowColor='#30201b';c.shadowBlur=5;c.fillStyle='#753e34';c.strokeStyle='#e2c495';c.lineWidth=3;c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#e8d8b4';c.beginPath();c.arc(0,-2,8,0,Math.PI*2);c.fill();c.fillRect(-5,2,10,8);c.fillStyle='#522c27';c.beginPath();c.arc(-3,-2,2.5,0,7);c.arc(3,-2,2.5,0,7);c.fill();c.restore();}
  private compass(c:CanvasRenderingContext2D,x:number,y:number):void {c.save();c.translate(x,y);c.strokeStyle='#dfd5ae';c.lineWidth=2;c.beginPath();c.arc(0,0,40,0,7);c.stroke();for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.fillStyle=i%2?'#d6c69a':'#293e3c';c.beginPath();c.moveTo(0,-36);c.lineTo(7,0);c.lineTo(0,10);c.lineTo(-7,0);c.closePath();c.fill();c.restore();}c.font='bold 18px Georgia';c.textAlign='center';c.fillStyle='#f8edc9';c.fillText('N',0,-49);c.restore();}
}
