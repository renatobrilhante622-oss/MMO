import {MountTrail} from '../src/companions/MountTrail';
import {Scene,Color,HemisphereLight,DirectionalLight,PerspectiveCamera,WebGLRenderer,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {configureRenderer} from '../src/core/Renderer';
import {fitPreviewCamera,getCharacterBounds} from '../src/player/PlayerRenderer';
import {COMPLETE_SKIN_CATALOG,catalogSkin,OUTFIT_SKINS,WING_SKINS,MOUNT_SKINS,cosmeticWing} from '../src/player/SkinCatalog';
import {ArticulatedCharacter} from '../src/player/ArticulatedCharacter';
import {CLASS_DEFINITIONS} from '../src/combat/ClassSystem';
import {loadWeaponModel} from '../src/assets/WeaponGLB';
import {relicBase,decorateRelic,styleSkinMaterial,outfitParts,SkinEnergy} from '../src/player/SkinAssembly';
import {CompanionRig} from '../src/companions/CompanionRig';
import {CollectionPreviewStage} from '../src/ui/CollectionUI';
const renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});configureRenderer(renderer,{mobile:true,exposure:1.1});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;document.body.append(renderer.domElement);let dispose:(()=>void)[]=[];
async function waitFor(test:()=>boolean){const start=performance.now();while(!test()){if(performance.now()-start>30000)throw Error('Appearance load timeout');await new Promise(r=>setTimeout(r,50));}}
async function load(kind:'weapon'|'skin'|'wing'|'mount'){
 dispose.forEach(fn=>fn());dispose=[];
 const entries=kind==='weapon'?COMPLETE_SKIN_CATALOG.filter(s=>s.classId==='paladin'):kind==='skin'?OUTFIT_SKINS:kind==='wing'?WING_SKINS:MOUNT_SKINS;
 const reports=[];renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setClearColor('#090f1c');renderer.clear();renderer.autoClear=false;
 for(let i=0;i<entries.length;i++){
  console.log('SKIN',entries[i].id);const s=entries[i],scene=new Scene(),camera=new PerspectiveCamera(32,1,.1,1000),stage=new CollectionPreviewStage(),root=new Group();scene.background=new Color('#0b1528');scene.add(root,stage.root,new HemisphereLight(0xcce4ff,0x283048,2.6));stage.appearance(s.color);stage.update(.1);
  const sun=new DirectionalLight(0xfff1d7,3),rim=new DirectionalLight(s.color,3);sun.position.set(-3,4,6);rim.position.set(3,3,-3);scene.add(sun,rim);
  let rig:ArticulatedCharacter|undefined,mount:CompanionRig|undefined,weapon:Group|undefined;
  if(kind==='weapon'){
   weapon=new Group();const base=await loadWeaponModel(relicBase(s));weapon.add(base);base.traverse(n=>{if(n instanceof Mesh){const mats=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{const c=m.clone();if(c instanceof MeshStandardMaterial)styleSkinMaterial(c,s.element);return c;});n.material=Array.isArray(n.material)?mats:mats[0];}});await decorateRelic(weapon,s);weapon.rotation.y=-.3;root.add(weapon);if((s.tier??0)>=2){const e=new SkinEnergy(s.element,3);weapon.add(e.root);e.update(2);dispose.push(()=>e.dispose());}
  }else if(kind==='mount'){
   mount=new CompanionRig(true);mount.appearance(s);root.add(mount.root);await waitFor(()=>mount!.loadedModel);await new Promise(r=>setTimeout(r,250));mount.root.rotation.y=.6;mount.update(.03,4,2);stage.root.scale.setScalar(1.6);const trail=new MountTrail(scene);for(let k=0;k<16;k++)trail.update(.04,true,new Vector3(-1.8+k*.24,0,.8),0,s.element,()=>.05);dispose.push(()=>trail.dispose());dispose.push(()=>mount!.dispose());
  }else{
   rig=new ArticulatedCharacter(CLASS_DEFINITIONS.elementalist);root.add(rig.root);if(kind==='skin')rig.skinAppearance(s.id,s.color,5);else rig.wings.configure(cosmeticWing(s.id)!,5);
   const privateRig=rig as unknown as {imported?:{ready:boolean};importedSkinParts:unknown[];glbWeapons:unknown[]};await waitFor(()=>!!privateRig.imported?.ready&&privateRig.glbWeapons.length>=1&&(kind!=='skin'||privateRig.importedSkinParts.length>=outfitParts(s.id).length));rig.root.rotation.y=kind==='wing'?Math.PI-.2:-.2;rig.update(.016,2,'idle',0,0,0);dispose.push(()=>rig!.dispose());
  }
  root.updateMatrixWorld(true);const rect={x:(i%3)*innerWidth/3,y:(1-Math.floor(i/3))*innerHeight/2,w:innerWidth/3,h:innerHeight/2};const bounds=getCharacterBounds(root);fitPreviewCamera(camera,bounds,rect.w/rect.h,1.25);camera.position.y+=.05;camera.lookAt(bounds.getCenter(new Vector3()));camera.updateMatrixWorld();renderer.setViewport(rect.x,rect.y,rect.w,rect.h);renderer.setScissor(rect.x,rect.y,rect.w,rect.h);renderer.setScissorTest(true);renderer.render(scene,camera);
  let meshes=0,vertices=0;root.traverseVisible(n=>{if(n instanceof Mesh){meshes++;vertices+=n.geometry.attributes.position?.count??0;}});reports.push({id:s.id,body:s.body??s.mountModel??null,meshes,vertices,drawCalls:renderer.info.render.calls,width:bounds.max.x-bounds.min.x,height:bounds.max.y-bounds.min.y});
  dispose.push(()=>stage.dispose());
 }
 document.querySelector('#labels')!.innerHTML=entries.map(s=>`<article><strong>${s.name[0]}</strong><small>${s.grade.toUpperCase()} · ${s.element.toUpperCase()}</small></article>`).join('');return reports;
}
(window as unknown as {skinReview:unknown}).skinReview={load};
