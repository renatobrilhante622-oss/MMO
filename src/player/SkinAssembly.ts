import {AdditiveBlending,Box3,BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Object3D,Points,ShaderMaterial,TorusGeometry,Vector3} from 'three';
import {loadSharedModel} from '../assets/ModelResources';
import {loadWeaponModel,type EquipmentVisual,type WeaponModelId} from '../assets/WeaponGLB';
import type {CatalogSkin,SkinElement} from './SkinCatalog';
import {ELEMENT_COLORS} from './SkinCatalog';
export interface SkinPart {file:string;bone:string;at:[number,number,number];size:number;rotation?:[number,number,number];metal?:boolean;}
const gem='models/equipment/CC0_crystal_gems.glb',skull='models/pr18/Skull.glb',helmet='models/equipment/CC0_knight_helmet.glb',shield='models/KayKit_Weapon_shield_round.glb';
/** Six explicit silhouettes. All solid attachments are authored CC0 meshes, never primitive proxies. */
export function outfitParts(id:string):SkinPart[]{
 const p=(file:string,bone:string,at:SkinPart['at'],size:number,rotation?:SkinPart['rotation']):SkinPart=>({file,bone,at,size,rotation});
 const shoulder=(file:string,size:number,y=.12)=>[-1,1].map(side=>p(file,'spine2',[side*.43,y,0],size,[0,0,side*.5]));
 switch(id){
  case 'regalia-solar':return [p('models/pr22/SolarHelmet.glb','head',[0,.1,0],.65),...shoulder(shield,.6),p(shield,'spine2',[0,-.12,.17],.58),...[-1,0,1].map(x=>p(gem,'head',[x*.19,.35,0],.20))];
  case 'regalia-reaper':return [...shoulder(skull,.38),p(skull,'spine2',[0,-.05,.19],.27),...[-1,1].map(x=>p(gem,'head',[x*.22,.26,-.08],.29,[0,0,-x*.7]))];
  case 'regalia-astral':return [p(gem,'head',[0,.31,0],.27),...shoulder(gem,.38),p(gem,'spine2',[0,-.12,.20],.18)];
  case 'regalia-titan':return [p('models/pr22/TitanHelmet.glb','head',[0,.08,0],.68),...shoulder(shield,.78),...[-1,1].map(x=>p('models/pr22/Horn.glb','head',[x*.3,.31,0],.44,[0,0,-x*.7])),p(skull,'spine2',[0,-.08,.20],.3)];
  case 'regalia-glacial':return [p('models/pr22/ShadowHelmet.glb','head',[0,.12,0],.6),...shoulder(gem,.65,.20),p(gem,'spine2',[0,-.20,.16],.48),...[-1,1].map(x=>p(gem,'spine2',[x*.25,.35,-.20],.48,[0,0,-x*.5]))];
  case 'regalia-void':return [...shoulder(shield,.5),...shoulder(gem,.3,.38),p(skull,'head',[0,.12,-.03],.38),p(gem,'spine2',[0,-.09,.2],.36)];
  default:return [];
 }
}
export function relicBase(s:CatalogSkin):WeaponModelId {
 const c=s.classId!,t=s.tier??0;
 const variants:Partial<Record<typeof c,WeaponModelId[]>>={
 paladin:['armory-paladin-0','armory-paladin-1','armory-paladin-2','relicbase-BronzeSword','relicbase-KnightSword','relicbase-GreatSword'],
 elementalist:['relicbase-WoodStaff','relicbase-IceStaff','relicbase-ClericStaff','relicbase-ArcaneStaff','relicbase-BoneStaff','relicbase-WizardStaff'],
 warlock:['wand','relicbase-ArcaneStaff','relicbase-BoneStaff','relicbase-WizardStaff','relicbase-ClericStaff','relicbase-IceStaff'],
 monk:['relicbase-WoodStaff','relicbase-ClericStaff','relicbase-ArcaneStaff','relicbase-BoneStaff','relicbase-WizardStaff','relicbase-IceStaff'],
 assassin:['armory-assassin-0','armory-assassin-1','dagger','relicbase-OrnateDagger','relicbase-CrystalDagger','relicbase-KnightSword'],
 necromancer:['armory-necromancer-0','relicbase-BoneStaff','armory-necromancer-0','relicbase-HarvestScythe','relicbase-VoidHalberd','relicbase-HarvestScythe'],
 lanceman:['armory-lanceman-0','spear','armory-lanceman-2','relicbase-VoidHalberd','armory-lanceman-4','relicbase-VoidHalberd'],
 };
 return variants[c]?.[t]??`armory-${c}-${Math.min(4,t) as 0|1|2|3|4}`;
}
export function relicEquipment(s:CatalogSkin):EquipmentVisual[]{
 const classId=s.classId!,tier=Math.min(4,s.tier??0) as 0|1|2|3|4,model=relicBase(s);
 if(classId==='ranger')return [{model,bone:'lefthand'},{model:'quiver',bone:'spine2',offset:[0,0,-.17]}];
 if(classId==='assassin')return [{model,bone:'righthand'},{model,bone:'lefthand'}];
 return [{model,bone:'righthand'},...(classId==='paladin'?[{model:`paladin-shield-${tier}` as const,bone:'lefthand' as const}]:[])];
}
/** One bounded particle draw call; motion and element-specific sprite shapes execute on the GPU. */
export class SkinEnergy {
 readonly root=new Group();private readonly material:ShaderMaterial;private readonly points:Points;private rings:Mesh[]=[];
 constructor(readonly element:SkinElement,private power=1,halo=false){
  const positions=new Float32Array(48*3),seeds=new Float32Array(48);for(let i=0;i<48;i++){positions[i*3]=Math.sin(i*2.399)*.2;positions[i*3+1]=i/48;positions[i*3+2]=Math.cos(i*2.399)*.2;seeds[i]=(i*.6180339)%1;}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('seed',new Float32BufferAttribute(seeds,1));
  const mode=element==='frost'?0:element==='fire'?1:element==='storm'?2:element==='void'?3:4;
  this.material=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{time:{value:0},tint:{value:new Color(ELEMENT_COLORS[element])},mode:{value:mode},power:{value:power}},vertexShader:`attribute float seed;uniform float time;uniform float power;varying float life;void main(){float t=fract(seed+time*.23);vec3 p=position;p.y=t*1.3;p.x+=sin(time*3.+seed*40.)*.05;life=sin(t*3.14159);vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((25.+power*8.)/max(.2,-v.z),1.,12.);}`,fragmentShader:`uniform vec3 tint;uniform float mode;varying float life;void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);float a=pow(max(0.,1.-r),2.);if(mode<.5)a=max(a,exp(-abs(p.x)*26.)*exp(-abs(p.y)*5.));else if(mode<1.5)a*=1.4-gl_PointCoord.y;else if(mode<2.5)a=max(a,exp(-abs(p.x+sin(p.y*9.)*.3)*24.));else if(mode<3.5)a*=.7;gl_FragColor=vec4(tint*1.5,a*life*.8);}`});
  this.points=new Points(geometry,this.material);this.points.frustumCulled=false;this.root.add(this.points);this.root.name='Skin energy '+element;
  if(halo){const m=new MeshStandardMaterial({color:ELEMENT_COLORS[element],emissive:ELEMENT_COLORS[element],emissiveIntensity:2,metalness:.6,roughness:.3});for(let i=0;i<2;i++){const ring=new Mesh(new TorusGeometry(.5+i*.16,.012,5,48),m);ring.position.set(0,.9,-.28);ring.rotation.x=i*.6;this.rings.push(ring);this.root.add(ring);}}
 }
 update(time:number):void{this.material.uniforms.time.value=time;this.rings.forEach((r,i)=>{r.rotation.z=time*(i?-.4:.6);r.rotation.y=Math.sin(time*.4)*.35;});}
 dispose():void{this.root.removeFromParent();this.points.geometry.dispose();this.material.dispose();for(const r of this.rings)r.geometry.dispose();if(this.rings[0])(this.rings[0].material as MeshStandardMaterial).dispose();}
}
export function styleSkinMaterial(material:MeshStandardMaterial,element:SkinElement,metal=true):void {
 const color=ELEMENT_COLORS[element];material.color.lerp(new Color(element==='storm'?0xffca68:color),element==='storm'?.8:element==='fire'||element==='void'?.55:.45);material.metalness=metal?.75:.16;material.roughness=element==='frost'?.2:.38;material.emissive.setHex(color);material.emissiveIntensity=element==='steel'?.03:element==='void'?.16:.42;
 if(element==='void')material.color.multiplyScalar(.36);if(element==='fire')material.color.multiplyScalar(.5);
 if(element==='frost'){material.transparent=true;material.opacity=.86;material.depthWrite=true;}
 material.onBeforeCompile=shader=>{shader.uniforms.skinTint={value:new Color(color)};shader.fragmentShader='uniform vec3 skinTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\nfloat seam=pow(.5+.5*sin(vViewPosition.y*42.+vViewPosition.x*28.),12.);totalEmissiveRadiance+=skinTint*seam*${element==='fire'?'1.5':'.15'};`);};material.customProgramCacheKey=()=>`pr22-${element}`;
}
export async function fittedSkinPart(part:SkinPart,element:SkinElement):Promise<Object3D>{
 const gltf=await loadSharedModel(part.file),mesh=gltf.scene.clone(true),box=new Box3().setFromObject(mesh),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());mesh.position.sub(center);
 const group=new Group();group.add(mesh);group.scale.setScalar(part.size/Math.max(.001,size.x,size.y,size.z));if(part.rotation)group.rotation.set(...part.rotation);
 mesh.traverse(n=>{if(n instanceof Mesh){n.castShadow=false;const mats=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{const copy=m.clone();if(copy instanceof MeshStandardMaterial)styleSkinMaterial(copy,element,part.metal??true);return copy;});n.material=Array.isArray(n.material)?mats:mats[0];}});return group;
}
export function disposeSkinPart(part:Object3D):void{part.removeFromParent();part.traverse(n=>{if(n instanceof Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();});}
export async function decorateRelic(model:Object3D,skin:CatalogSkin):Promise<Object3D[]> {
 const tier=skin.tier??0,parts:Object3D[]=[];if(tier===0)return parts;
 const bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3()),height=Math.max(size.x,size.y,size.z),count=tier===5?5:Math.min(3,tier);
 // The new assembly has a different solid-mesh composition at every grade.
 for(let i=0;i<count;i++){const part=await fittedSkinPart({file:tier===4&&i===0?skull:gem,bone:'',at:[0,0,0],size:.13+tier*.035},skin.element);part.position.set((i%2?-1:1)*(.09+i*.045),height*(.42+(i%3)*.11),0);part.rotation.z=(i%2?1:-1)*(.2+i*.22);model.add(part);parts.push(part);}
 if(tier===5||skin.classId==='necromancer'&&tier===1){const echo=await loadWeaponModel(skin.classId==='necromancer'?'armory-necromancer-0':`armory-${skin.classId!}-1`);echo.scale.multiplyScalar(.46);echo.position.set(.25,height*.52,-.08);echo.rotation.z=-.5;echo.traverse(n=>{if(n instanceof Mesh){const ms=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{const c=m.clone();if(c instanceof MeshStandardMaterial)styleSkinMaterial(c,skin.element);return c;});n.material=Array.isArray(n.material)?ms:ms[0];}});model.add(echo);parts.push(echo);}
 return parts;
}
