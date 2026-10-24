import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
export interface PBRTextureSet {map:CanvasTexture;normalMap:CanvasTexture;roughnessMap:CanvasTexture;dispose():void;}
export type GroundSurface='cobble'|'dirt'|'grass';
/** Seeded 512² albedo, tangent-space normal and roughness maps. No image downloads. */
export function createGroundTextures(surface:GroundSurface,seed=713,size=512):PBRTextureSet {
  let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d')!;
  const height=document.createElement('canvas');height.width=height.height=size;const h=height.getContext('2d')!;
  c.fillStyle=surface==='grass'?'#43512c':surface==='cobble'?'#38402c':'#776349';c.fillRect(0,0,size,size);h.fillStyle='#333';h.fillRect(0,0,size,size);
  if(surface==='cobble'){
    const cell=size/9;
    for(let row=-1;row<11;row++)for(let col=-1;col<11;col++){
      const x=col*cell+(row%2)*cell*.47+(random()-.5)*7,y=row*cell+(random()-.5)*6,w=cell*(.8+random()*.25),d=cell*(.72+random()*.2);
      const polygon=(ctx:CanvasRenderingContext2D,offset=0)=>{ctx.beginPath();ctx.moveTo(x+9,y+offset);ctx.lineTo(x+w-8,y+3+offset);ctx.quadraticCurveTo(x+w+1,y+6+offset,x+w-1,y+15+offset);ctx.lineTo(x+w-5,y+d-7+offset);ctx.quadraticCurveTo(x+w-8,y+d+offset,x+w-17,y+d+offset);ctx.lineTo(x+6,y+d-3+offset);ctx.quadraticCurveTo(x-2,y+d-7+offset,x+1,y+d-16+offset);ctx.lineTo(x+2,y+10+offset);ctx.closePath();};
      polygon(c);const light=90+Math.floor(random()*48);const gradient=c.createLinearGradient(x,y,x+w,y+d);gradient.addColorStop(0,`rgb(${light+24},${light+21},${light+9})`);gradient.addColorStop(.35,`rgb(${light+2},${light+3},${light-3})`);gradient.addColorStop(1,`rgb(${light-19},${light-16},${light-20})`);c.fillStyle=gradient;c.fill();c.strokeStyle='#c4c3a544';c.lineWidth=2;c.stroke();polygon(h);h.fillStyle=`rgb(${170+Math.floor(random()*45)},${170},${170})`;h.fill();h.strokeStyle='#777';h.lineWidth=5;h.stroke();
      for(let j=0;j<9;j++){const px=x+random()*w,py=y+random()*d;c.fillStyle=random()<.4?'#68804b66':'#d3d0b644';c.fillRect(px,py,1+random()*2,1+random()*2);}
    }
  }else{
    for(let i=0;i<20000;i++){
      const x=random()*size,y=random()*size,r=.3+random()*2;const tone=surface==='grass'?`rgba(${55+random()*45},${70+random()*65},${24+random()*30},.35)`:`rgba(${65+random()*95},${52+random()*75},${36+random()*55},.5)`;
      c.fillStyle=tone;c.beginPath();c.ellipse(x,y,r*(surface==='grass'?.45:1),r*(surface==='grass'?3:1),random()*3,0,7);c.fill();h.fillStyle=`rgba(200,200,200,${.05+random()*.15})`;h.fillRect(x,y,r+1,r+1);
    }
    if(surface==='dirt')for(const track of [size*.27,size*.73]){
      c.save();c.strokeStyle='#382d2355';c.lineWidth=size*.055;c.beginPath();c.moveTo(track,0);c.bezierCurveTo(track+8,size*.3,track-7,size*.7,track,size);c.stroke();c.strokeStyle='#b19b7455';c.lineWidth=2;c.stroke();h.strokeStyle='#131313';h.lineWidth=size*.025;h.stroke();c.restore();
    }
  }
  // Fine grain breaks up the broad strokes. Wrapping derivatives keep normal seams continuous.
  const albedo=c.getImageData(0,0,size,size),heights=h.getImageData(0,0,size,size),normal=c.createImageData(size,size),rough=c.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,grain=(random()-.5)*15;
    for(let k=0;k<3;k++)albedo.data[i+k]=Math.max(0,Math.min(255,albedo.data[i+k]+grain));
    const at=(px:number,py:number)=>heights.data[(((py+size)%size)*size+(px+size)%size)*4]/255;
    const nx=(at(x-1,y)-at(x+1,y))*.9,ny=(at(x,y-1)-at(x,y+1))*.9,nz=1,l=Math.hypot(nx,ny,nz);
    normal.data[i]=(nx/l*.5+.5)*255;normal.data[i+1]=(ny/l*.5+.5)*255;normal.data[i+2]=(nz/l*.5+.5)*255;normal.data[i+3]=255;
    const value=surface==='cobble'?178+(1-at(x,y))*65:surface==='dirt'?217+random()*25:225+random()*22;rough.data[i]=rough.data[i+1]=rough.data[i+2]=value;rough.data[i+3]=255;
  }
  c.putImageData(albedo,0,0);
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=size;normalCanvas.getContext('2d')!.putImageData(normal,0,0);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=size;roughCanvas.getContext('2d')!.putImageData(rough,0,0);
  const map=new CanvasTexture(canvas),normalMap=new CanvasTexture(normalCanvas),roughnessMap=new CanvasTexture(roughCanvas);map.colorSpace=SRGBColorSpace;
  for(const t of [map,normalMap,roughnessMap]){t.wrapS=t.wrapT=RepeatWrapping;t.anisotropy=4;}
  return {map,normalMap,roughnessMap,dispose(){map.dispose();normalMap.dispose();roughnessMap.dispose();}};
}
