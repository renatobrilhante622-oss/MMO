import {CanvasTexture,Group,Sprite,SpriteMaterial,SRGBColorSpace} from 'three';
/** A readable billboard in the actual 3D world, above the character name/head. */
export class HeroTitle3D{
 readonly root=new Group();
 private sprite?:Sprite;
 private texture?:CanvasTexture;
 private material?:SpriteMaterial;
 private current='';
 constructor(){
  this.root.name='Equipped competitive title — in world';
  this.root.position.y=2.9;
 }
 set(title:string,color='#e9c676'):void{
  if(title===this.current)return;
  this.current=title;this.sprite?.removeFromParent();this.texture?.dispose();this.material?.dispose();
  this.sprite=undefined;
  if(!title||typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,768,160);
  const gradient=ctx.createLinearGradient(0,0,768,0);
  gradient.addColorStop(0,'#111b2ccc');gradient.addColorStop(.5,'#46375fbb');gradient.addColorStop(1,'#111b2ccc');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.roundRect(8,18,752,117,26);ctx.fill();
  ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();
  ctx.shadowColor=color;ctx.shadowBlur=22;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff3d0';ctx.font='bold 48px Georgia, serif';ctx.fillText(title,384,76,705);
  this.texture=new CanvasTexture(canvas);this.texture.colorSpace=SRGBColorSpace;
  this.material=new SpriteMaterial({map:this.texture,transparent:true,depthTest:true,depthWrite:false});
  this.sprite=new Sprite(this.material);this.sprite.name='Prestige title: '+title;
  this.sprite.scale.set(3.0,.63,1);this.root.add(this.sprite);
 }
 dispose():void{this.sprite?.removeFromParent();this.texture?.dispose();this.material?.dispose();this.root.removeFromParent();}
}
