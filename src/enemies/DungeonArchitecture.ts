import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Scene, TorusGeometry, Vector3 } from 'three';
/** Procedural arena chamber: pillars, segmented arches and lit floor sigils. */
export class DungeonArchitecture {
  readonly root=new Group();
  private readonly stone=new MeshStandardMaterial({color:0x42434c,roughness:.88,metalness:.08});
  private readonly rune=new MeshStandardMaterial({color:0xa89ad4,emissive:0x7457b0,emissiveIntensity:1.8,roughness:.4});
  private readonly rings:Mesh[]=[];
  constructor(scene:Scene,position:Vector3,height:(x:number,z:number)=>number){
    this.root.position.copy(position);this.root.visible=false;scene.add(this.root);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,x=Math.cos(angle)*22,z=Math.sin(angle)*22,y=height(position.x+x,position.z+z)-position.y;
      const pillar=new Group();pillar.position.set(x,y,z);this.root.add(pillar);
      const shaft=new Mesh(new CylinderGeometry(.65,.85,5.5,8),this.stone);shaft.position.y=2.8;pillar.add(shaft);
      for(const h of [.3,5.4]){const capital=new Mesh(new BoxGeometry(1.8,.5,1.8),this.stone);capital.position.y=h;pillar.add(capital);}
      const sigil=new Mesh(new TorusGeometry(.55,.04,5,20),this.rune);sigil.position.y=4.3;sigil.rotation.y=angle+Math.PI/2;pillar.add(sigil);
      this.rings.push(sigil);
      if(i%2===0){const arch=new Mesh(new TorusGeometry(2.2,.24,6,20,Math.PI),this.stone);arch.position.set(x,5,z);arch.rotation.y=angle;this.root.add(arch);}
    }
  }
  update(active:boolean,floor:number,time:number):void {this.root.visible=active;if(!active)return;const colors=[0x7abca5,0x9f83df,0xef9b76];this.rune.emissive.setHex(colors[(floor-1)%3]);this.rune.emissiveIntensity=1.1+Math.sin(time*2)*.25;this.rings.forEach((r,i)=>{r.rotation.z=time*.15*(i%2?1:-1);});}
  dispose():void {this.root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});this.stone.dispose();this.rune.dispose();this.root.removeFromParent();}
}
