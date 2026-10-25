/** Reproducible static artwork composed entirely from the bundled CC0 Kenney GLBs. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,640);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const loader=new GLTFLoader(),textures=new T.TextureLoader(),models=new Map<string,T.Group>();
const files={oak:'environment/Kenney_nature-kit_tree-oak.glb',pine:'environment/Kenney_nature-kit_tree-cone.glb',dark:'environment/Kenney_nature-kit_tree-default-dark.glb',rock:'environment/Kenney_nature-kit_rock-largea.glb',cliff:'environment/Kenney_nature-kit_cliff-rock.glb',tower:'environment/Kenney_castle-kit_tower-square.glb',grave:'environment/Kenney_graveyard-kit_gravestone-cross-large.glb',altar:'environment/Kenney_graveyard-kit_altar-stone.glb',floor:'dungeon/Kenney_Dungeon_floor.glb',column:'dungeon/Kenney_Dungeon_column.glb',gate:'dungeon/Kenney_Dungeon_gate.glb',stairs:'dungeon/Kenney_Dungeon_stairs.glb',crystal:'dungeon/Kenney_Dungeon_crystal.glb',wall:'dungeon/Kenney_Dungeon_wall-opening.glb',torch:'dungeon/Kenney_Dungeon_fire-basket.glb'};
await Promise.all(Object.entries(files).map(async([key,file])=>{const gltf=await loader.loadAsync('/models/'+file);models.set(key,gltf.scene);}));
const themes={aurora:{sky:0x779e9a,fog:0x8eaaa2,ground:'Grass004',sun:0xffedc6},crypt:{sky:0x252d3e,fog:0x485565,ground:'PavingStones046',sun:0xbbc8ff},highlands:{sky:0x91b9cc,fog:0xafcbd8,ground:'Snow010A',sun:0xe2f4ff},rift:{sky:0x4e3432,fog:0x8b5a44,ground:'Ground093C',sun:0xffbd7c},eclipse:{sky:0x242139,fog:0x51466f,ground:'Ground071',sun:0xcdacff}};
const allTextures=new Map<string,T.Texture>();
await Promise.all(Object.values(themes).map(async theme=>{const texture=await textures.loadAsync('/textures/real-pbr/'+theme.ground+'_1K-JPG_Color.webp');texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1.4,1.4);allTextures.set(theme.ground,texture);}));
function clone(key:string,size:number,axis:'height'|'width'='height'):T.Group{
 const object=models.get(key)!.clone(true),bounds=new T.Box3().setFromObject(object),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const factor=size/Math.max(.001,axis==='height'?extent.y:Math.max(extent.x,extent.z));
 object.scale.multiplyScalar(factor);object.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
 object.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
 const root=new T.Group();root.add(object);return root;
}
const render=async(themeName:keyof typeof themes,dungeon=false)=>{
 const theme=themes[themeName],scene=new T.Scene();scene.background=new T.Color(theme.sky);scene.fog=new T.FogExp2(theme.fog,.027);
 const hemi=new T.HemisphereLight(0xd7edff,0x4c4840,2.15);scene.add(hemi);
 const sun=new T.DirectionalLight(theme.sun,3.1);sun.position.set(-7,16,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.normalBias=.035;scene.add(sun);
 const camera=new T.PerspectiveCamera(42,2,.1,150);camera.position.set(dungeon?9:10,dungeon?4.8:5.2,dungeon?15:18);camera.lookAt(0,2.6,-4);
 const add=(key:string,x:number,z:number,size:number,yaw=0,axis:'height'|'width'='height')=>{const model=clone(key,size,axis);model.position.set(x,0,z);model.rotation.y=yaw;scene.add(model);return model;};
 for(let x=-36;x<=36;x+=4)for(let z=-48;z<=20;z+=4){const floor=add('floor',x,z,4,0,'width');floor.position.y=-.14;floor.traverse(o=>{if(o instanceof T.Mesh){o.geometry=o.geometry.clone();const positions=o.geometry.attributes.position,uv=new Float32Array(positions.count*2);for(let i=0;i<positions.count;i++){uv[i*2]=positions.getX(i)*.75;uv[i*2+1]=positions.getZ(i)*.75;}o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m instanceof T.MeshStandardMaterial){m.map=allTextures.get(theme.ground)!;m.color.setHex(0xffffff);m.roughness=.94;}}}});}
 if(themeName==='aurora'){
  for(let i=0;i<27;i++){const x=-25+i*2,z=-8-Math.sin(i*2.2)*4;add(i%3?'oak':'pine',x,z,5.5+i%4*1.1,i*.6);}
  add('oak',-9,6,9);add('rock',5,3,2.5,.7);add('rock',-4,3,1.5,.3);add('gate',1,-4,4.5);add('stairs',1,-2,2.7);
 }else if(themeName==='crypt'){
  add('gate',0,-6,7);for(const x of [-4.3,4.3])add('column',x,-5,6.6);add('altar',0,-1,2.7,.1);
  for(let i=0;i<8;i++)add('grave',(i%2?-1:1)*(3.5+Math.floor(i/2)*1.4),-5+Math.floor(i/2)*2.2,1.8+i%3*.25,i%2?-.2:.2);
  add('dark',-9,-7,10);add('dark',10,-9,8);add('rock',-6,6,2.4);
 }else if(themeName==='highlands'){
  for(let i=0;i<7;i++)add('cliff',-12+i*4.2,-9-Math.sin(i)*2,7+i%3*2,i*.7);
  for(const x of [-4,4])add('column',x,-3,6);add('gate',0,-4,5);add('crystal',0,-1,3.7,.4);add('pine',-9,2,8);add('rock',6,5,2.6,.8);
 }else if(themeName==='rift'){
  for(let i=0;i<7;i++)add('cliff',-13+i*4.1,-7,6+i%3*2,.4*i);
  add('gate',-1,-5,6.8);add('stairs',-1,-1,3.5);for(const x of [-5,4]){add('torch',x,-.5,2.4);const fire=new T.PointLight(0xff8226,25,8);fire.position.set(x,2,-.5);scene.add(fire);}
  add('crystal',-6,4,3.2,.2);add('rock',5,5,3,.8);
 }else{
  add('tower',-7,-8,13,.2);add('tower',7,-9,11,-.1);add('gate',0,-5,7.4);add('stairs',0,-.5,4.3);add('altar',0,0,2.9,.2);
  for(const x of [-4.6,4.6]){add('column',x,-2,7);add('crystal',x,3,2.8,.5);const light=new T.PointLight(0xbc6dff,25,8);light.position.set(x,2,3);scene.add(light);}
  add('rock',-8,5,3.2,.7);
 }
 if(dungeon){for(const x of [-8,8]){add('column',x,0,6.4);add('wall',x,-5,6.5,Math.PI/2);}camera.position.set(9,4.8,16.5);camera.lookAt(0,2.5,-3);}
 scene.updateMatrixWorld(true);renderer.render(scene,camera);renderer.render(scene,camera);
 await new Promise(resolve=>setTimeout(resolve,60));
 scene.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
 return {theme:themeName,dungeon,width:1280,height:640};
};
(window as any).renderLandscape=render;(window as any).artReady=true;
