import {CanvasTexture,SRGBColorSpace} from 'three';
import type {WingStyle} from '../rpg/EvolutionSystem';
/** A complete wing silhouette in one alpha atlas, rather than a mesh per feather. */
export function wingTexture(style:WingStyle):CanvasTexture|undefined {
  if(typeof document==='undefined')return undefined;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');if(!c)return undefined;
  const palette={necrotic:['#c4bda7','#2a1838','#9984bd'],celestial:['#fff3c4','#c2a777','#fff9ea'],magma:['#ff9f39','#542331','#ffc557'],glacial:['#c3f5ff','#537ca8','#edfaff'],solar:['#ffe9a1','#ec9732','#fffbe8'],astral:['#cdb7ff','#492c80','#edccff']}[style];
  c.clearRect(0,0,1024,1024);
  if(style==='glacial'){
    for(let i=0;i<9;i++){const x=150+i*80,y=320-Math.sin(i/8*Math.PI)*200,length=320+i%3*90;c.fillStyle=i%2?'#b4f3ff':'#65bcf1';c.strokeStyle='#eaffff';c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x-30,y+length*.55);c.lineTo(x+10,y+length);c.lineTo(x+55,y+length*.42);c.closePath();c.fill();c.stroke();c.strokeStyle='#2371b7';c.beginPath();c.moveTo(x,y);c.lineTo(x+10,y+length);c.stroke();}
  }else if(style==='necrotic'||style==='magma'){
    const g=c.createLinearGradient(140,200,820,900);g.addColorStop(0,palette[1]);g.addColorStop(1,palette[2]);c.fillStyle=g;c.beginPath();c.moveTo(70,350);c.bezierCurveTo(260,60,650,30,960,155);c.bezierCurveTo(860,480,880,700,800,910);c.quadraticCurveTo(650,730,610,880);c.quadraticCurveTo(470,650,410,780);c.quadraticCurveTo(290,600,230,640);c.closePath();c.fill();
    c.strokeStyle=palette[0];c.lineWidth=16;c.lineCap='round';for(let i=0;i<6;i++){c.beginPath();c.moveTo(80,350);c.quadraticCurveTo(320+i*38,80+i*45,930-i*135,180+i*130);c.stroke();c.lineWidth=8;}
    if(style==='necrotic'){c.globalCompositeOperation='destination-out';for(let i=0;i<18;i++){const x=300+(i*137)%520,y=360+(i*71)%440;c.beginPath();c.ellipse(x,y,9+i%4*3,22+i%5*5,.7,0,Math.PI*2);c.fill();}c.globalCompositeOperation='source-over';}
  }else{
    for(let layer=0;layer<3;layer++)for(let i=0;i<22;i++){
      const x=150+i*27+layer*20,y=260+Math.sin(i/21*Math.PI)*(-130)+layer*75,length=260+i*12-layer*90,angle=-.6+i*.043;
      c.save();c.translate(x,y);c.rotate(angle);const g=c.createLinearGradient(0,0,30,length);g.addColorStop(0,palette[1]);g.addColorStop(.35,palette[0]);g.addColorStop(1,palette[2]);c.fillStyle=g;c.strokeStyle=palette[1];c.lineWidth=1.5;
      c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-35,length*.4,-18,length*.8,0,length);c.bezierCurveTo(32,length*.75,40,length*.3,0,0);c.fill();c.stroke();c.strokeStyle='#ffffff88';c.lineWidth=2;c.beginPath();c.moveTo(0,15);c.lineTo(0,length-15);c.stroke();
      for(let j=1;j<13;j++){const p=j/13*length;c.lineWidth=.7;c.beginPath();c.moveTo(0,p);c.lineTo(17,p-16);c.moveTo(0,p);c.lineTo(-14,p-12);c.stroke();}c.restore();
    }
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=2;return texture;
}
