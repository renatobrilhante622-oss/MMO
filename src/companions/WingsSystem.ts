import {BufferGeometry,CatmullRomCurve3,DoubleSide,Float32BufferAttribute,Group,MathUtils,Mesh,MeshStandardMaterial,Object3D,SphereGeometry,TubeGeometry,Vector3} from 'three';
import type {WingStyle} from '../rpg/EvolutionSystem';
import {RarityAura} from './RarityAura';
/** Articulated wing bones, perforated membranes, feathers and crystal blades share a bounded rig. */
export class WingsSystem {
  readonly root=new Group();
  private readonly assembly=new Group();
  private readonly aura=new RarityAura(.8);
  private readonly pivots:Group[]=[];
  private readonly cloth:Mesh<BufferGeometry,MeshStandardMaterial>[]=[];
  private readonly materials=new Set<MeshStandardMaterial>();
  private key='';
  private level=1;
  constructor(){this.root.name='Evolving back wings';this.root.position.set(0,.15,-.23);this.root.add(this.assembly,this.aura);this.root.visible=false;}
  configure(style:WingStyle|null,level:number):void {
    this.root.visible=!!style;if(!style)return;level=Number.isFinite(level)?MathUtils.clamp(Math.floor(level),1,10):1;const key=style+level;if(this.key===key)return;this.clear();this.key=key;this.level=level;
    const color={necrotic:0xa57be8,celestial:0xffe5b0,magma:0xff5a25,glacial:0x91eaff}[style];
    const bone=new MeshStandardMaterial({color:style==='necrotic'?0xafa58f:style==='magma'?0x39252c:color,metalness:.35,roughness:.5});
    const glow=new MeshStandardMaterial({color,emissive:color,emissiveIntensity:1+level*.12,roughness:.25,transparent:style==='glacial',opacity:.8});
    const membrane=new MeshStandardMaterial({color:style==='necrotic'?0x251833:0x682b23,emissive:color,emissiveIntensity:.15,side:DoubleSide,transparent:true,opacity:.76,roughness:.8});
    this.materials.add(bone).add(glow).add(membrane);
    for(const side of [-1,1]){
      const pivot=new Group();pivot.position.x=side*.12;pivot.userData.side=side;this.assembly.add(pivot);this.pivots.push(pivot);
      const span=.58+level*.09,rows=4+Math.floor(level*.7);
      const elbow=new Vector3(side*span*.6,.45+level*.018,-.1),tip=new Vector3(side*span*1.35,.65,-.2);
      this.tube(pivot,[new Vector3(),elbow,tip],.035+level*.001,bone);
      this.tube(pivot,[elbow,elbow.clone().add(new Vector3(side*.12,.22,0)),elbow.clone().add(new Vector3(side*.2,.16,.08))],.022,bone);
      for(let i=0;i<rows;i++){
        const t=i/(rows-1),end=new Vector3(side*span*(.5+t*.9),.45-t*(.75+level*.025),-.16-Math.sin(t*Math.PI)*.24);
        const middle=elbow.clone().lerp(end,.5).add(new Vector3(side*.1,0,-.08));this.tube(pivot,[elbow,middle,end],.016+(1-t)*.012,style==='glacial'?glow:bone);
        if(style==='celestial'||style==='glacial'){
          const feather=new Mesh(new SphereGeometry(1,10,8),glow);feather.position.copy(end).lerp(elbow,.2);feather.scale.set(style==='glacial'?.055:.085,.22+level*.013,.028);feather.rotation.z=-side*(.5+t*.6);pivot.add(feather);
        }else if(i>0){
          const last=(i-1)/(rows-1),previous=new Vector3(side*span*(.5+last*.9),.45-last*(.75+level*.025),-.16-Math.sin(last*Math.PI)*.24);
          const geometry=new BufferGeometry(),vertices:number[]=[];
          // Omit several lower triangles on necrotic wings to create physical torn edges.
          const points=[elbow,middle,end,previous];const center=elbow.clone().add(end).add(previous).divideScalar(3);
          for(let j=0;j<3;j++){if(style==='necrotic'&&j===1&&i%3===0)continue;for(const p of [center,points[j],points[(j+1)%4]])vertices.push(p.x,p.y,p.z);}
          geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.userData.rest=Float32Array.from(vertices);const mesh=new Mesh(geometry,membrane);pivot.add(mesh);this.cloth.push(mesh);
        }
      }
    }
    this.aura.configure(Math.min(5,2+Math.floor(level/3)),color);
  }
  private tube(parent:Object3D,points:Vector3[],radius:number,material:MeshStandardMaterial):void {const mesh=new Mesh(new TubeGeometry(new CatmullRomCurve3(points),12,radius,7,false),material);mesh.castShadow=true;parent.add(mesh);}
  update(dt:number,time:number,moving:number):void {
    for(const p of this.pivots){const side=p.userData.side as number;p.rotation.y=MathUtils.damp(p.rotation.y,side*(.28+Math.sin(time*(2+moving))*.13),7,dt);p.rotation.z=side*Math.sin(time*2)*.045;}
    for(const mesh of this.cloth){const pos=mesh.geometry.attributes.position,rest=mesh.geometry.userData.rest as Float32Array;for(let i=0;i<pos.count;i++)pos.setZ(i,rest[i*3+2]+Math.sin(time*4+rest[i*3]*5)*.025*Math.abs(rest[i*3]));pos.needsUpdate=true;}
    this.aura.update(time);
  }
  private clear():void {const materials=new Set<MeshStandardMaterial>();this.assembly.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();materials.add(o.material as MeshStandardMaterial);}});for(const m of this.materials)materials.add(m);materials.forEach(m=>m.dispose());this.materials.clear();this.assembly.clear();this.pivots.length=0;this.cloth.length=0;}
  dispose():void{this.clear();this.aura.dispose();this.root.removeFromParent();}
}
