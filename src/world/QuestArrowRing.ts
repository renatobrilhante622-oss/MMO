import {AdditiveBlending,DoubleSide,Group,Mesh,MeshBasicMaterial,RingGeometry,Shape,ShapeGeometry} from 'three';
import type {MapPoint} from './Navigation';
/** Two tiny unlit meshes. No lights, textures, particles or per-frame allocations. */
export class QuestArrowRing {
  readonly root=new Group();
  private readonly material=new MeshBasicMaterial({color:0xffd477,transparent:true,opacity:.58,depthWrite:false,side:DoubleSide,blending:AdditiveBlending});
  private readonly ring=new RingGeometry(.68,.72,32);
  private readonly arrow:ShapeGeometry;
  private angle=0;
  constructor(){
    const shape=new Shape();shape.moveTo(0,-1.18);shape.lineTo(-.22,-.8);shape.lineTo(-.08,-.84);shape.lineTo(-.08,-.59);shape.lineTo(.08,-.59);shape.lineTo(.08,-.84);shape.lineTo(.22,-.8);shape.closePath();
    this.arrow=new ShapeGeometry(shape);this.root.add(new Mesh(this.ring,this.material),new Mesh(this.arrow,this.material));
    this.root.rotation.x=-Math.PI/2;this.root.name='Ninefold quest direction';this.root.visible=false;
  }
  update(dt:number,hero:MapPoint,target:MapPoint|null,height:number,active:boolean):void {
    this.root.visible=active&&!!target&&Math.hypot(target.x-hero.x,target.z-hero.z)>2;
    if(!this.root.visible||!target)return;
    const desired=Math.atan2(target.x-hero.x,target.z-hero.z),delta=Math.atan2(Math.sin(desired-this.angle),Math.cos(desired-this.angle));
    this.angle+=delta*(1-Math.exp(-Math.max(0,dt)*9));
    // Local +Y becomes world -Z after the ground rotation; the authored arrow points -Y.
    this.root.rotation.z=this.angle;this.root.position.set(hero.x,height+.12,hero.z);
  }
  dispose():void {this.ring.dispose();this.arrow.dispose();this.material.dispose();this.root.removeFromParent();}
}
