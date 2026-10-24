import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshStandardMaterial,TorusGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {WorldCollider} from './OpenWorldGenerator';
export const WORLD_SITES=[
  {x:38,z:36,type:'village',name:'Porto dos Salgueiros'},
  {x:-52,z:64,type:'cemetery',name:'Cemitério dos Esquecidos'},
  {x:-74,z:-26,type:'ruins',name:'Ruínas do Rei Cinzento'},
  {x:83,z:-65,type:'village',name:'Posto dos Picos'},
  {x:-25,z:-100,type:'ruins',name:'Altar da Corrupção'},
  {x:-90,z:90,type:'cemetery',name:'Necrópole do Eclipse'},
] as const;
/** New settlement landmarks feed the same collision/navigation data as the starting village. */
export function createWorldSites(height:(x:number,z:number)=>number,colliders:WorldCollider[]):Group {
  const root=new Group();root.name='Regional villages, cemeteries and ruined monster camps';
  const stone=new MeshStandardMaterial({color:0x686b70,roughness:.94}),wood=new MeshStandardMaterial({color:0x584333,roughness:.95}),roof=new MeshStandardMaterial({color:0x394451,roughness:.9}),rune=new MeshStandardMaterial({color:0xa682ce,emissive:0x7649bc,emissiveIntensity:.7});
  const mesh=(parent:Group,geometry:BoxGeometry|CylinderGeometry|TorusGeometry,material:MeshStandardMaterial,x:number,y:number,z:number)=>{const m=new Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.majorBuilding=geometry instanceof BoxGeometry&&geometry.parameters.height>=3;parent.add(m);return m;};
  for(const site of WORLD_SITES){const group=new Group();group.name=site.name;group.position.set(site.x,height(site.x,site.z),site.z);root.add(group);
    if(site.type==='village')for(let i=0;i<4;i++){
      const x=(i%2?1:-1)*5,z=Math.floor(i/2)*9-4,y=height(site.x+x,site.z+z)-group.position.y;
      mesh(group,new BoxGeometry(5,3.5,5),wood,x,y+1.75,z);const top=mesh(group,new CylinderGeometry(0,4.4,2.4,4),roof,x,y+4.5,z);top.rotation.y=Math.PI/4;
      for(const side of [-1,1])mesh(group,new CylinderGeometry(.14,.18,3.8,8),stone,x+side*2.4,y+1.9,z+2.5);
      mesh(group,new BoxGeometry(1,1.8,.12),roof,x,y+.9,z+2.55);mesh(group,new BoxGeometry(.75,.8,.14),rune,x+1.5,y+2,z+2.55);
      colliders.push({position:new Vector3(site.x+x,group.position.y+y+1.8,site.z+z),size:new Vector3(5,3.6,5),type:'solid'});
    }
    else if(site.type==='cemetery'){
      for(let i=0;i<18;i++){const x=(i%6-2.5)*2,z=(Math.floor(i/6)-1)*3,y=height(site.x+x,site.z+z)-group.position.y;const grave=mesh(group,new BoxGeometry(.7,1,.2),stone,x,y+.5,z);grave.rotation.z=Math.sin(i*7)*.12;mesh(group,new BoxGeometry(.9,.12,.22),stone,x,y+.8,z);mesh(group,new BoxGeometry(.8,.12,1.7),stone,x,y+.06,z+.7);}
      const gate=mesh(group,new TorusGeometry(2.6,.27,8,28,Math.PI),stone,0,2.5,-6);gate.rotation.z=0;
    }else{
      for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*6,z=Math.sin(a)*6,y=height(site.x+x,site.z+z)-group.position.y;mesh(group,new CylinderGeometry(.45,.6,2+i%3,10),stone,x,y+1+i%3*.5,z);if(i%2===0)mesh(group,new BoxGeometry(3,.5,.8),stone,x,y+2.5+i%3,z);}
      const altar=mesh(group,new CylinderGeometry(2.5,3,.6,16),stone,0,.3,0);altar.name='Monster ritual spot';const ring=mesh(group,new TorusGeometry(2,.06,6,40),rune,0,.65,0);ring.rotation.x=Math.PI/2;
    }
  }
  root.updateMatrixWorld(true);const batches=new Map<string,{material:MeshStandardMaterial;major:boolean;parts:import('three').BufferGeometry[]}>();
  root.traverse(o=>{if(!(o instanceof Mesh))return;const material=o.material as MeshStandardMaterial,major=o.userData.majorBuilding===true,key=material.uuid+major;let batch=batches.get(key);if(!batch){batch={material,major,parts:[]};batches.set(key,batch);}batch.parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));o.geometry.dispose();});
  root.clear();for(const {material,major,parts}of batches.values()){const geometry=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());const merged=new Mesh(geometry,material);merged.name='Batched regional structures';merged.userData.majorBuilding=major;merged.castShadow=merged.receiveShadow=major;root.add(merged);}
  return root;
}
