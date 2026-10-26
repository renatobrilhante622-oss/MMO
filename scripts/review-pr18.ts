/** Development-only review page. Uses production terrain/physics/dungeon builders. */
import {Color,DirectionalLight,FogExp2,HemisphereLight,PerspectiveCamera,Scene,Vector3,WebGLRenderer} from 'three';
import {configureRenderer} from '../src/core/Renderer';
import {AtmosphericSky} from '../src/core/AtmosphericSky';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {SceneManager} from '../src/world/SceneManager';
import {WorldPortals} from '../src/world/WorldPortals';
import {mapDefinition} from '../src/world/maps/MapDefinitions';
import {DungeonInstance} from '../src/world/DungeonInstance';
import {dungeonMap} from '../src/world/dungeons/DungeonMaps';
import {RegionalWeather} from '../src/world/RegionalWeather';
import {AnimatedGLB} from '../src/assets/AnimatedGLB';
const scene=new Scene(),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});configureRenderer(renderer,{mobile:true,exposure:1.15});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;document.body.append(renderer.domElement);
const camera=new PerspectiveCamera(55,innerWidth/innerHeight,.1,1000),fill=new HemisphereLight(0xdceaff,0x273123,2),sun=new DirectionalLight(0xffeccb,2.2);sun.position.set(-40,80,30);scene.add(fill,sun);
const original=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(original),manager=new SceneManager(scene,physics,original);
let sky:AtmosphericSky|undefined,dungeon:DungeonInstance|undefined,portals:WorldPortals|undefined,weather:RegionalWeather|undefined,boss:AnimatedGLB|undefined;
async function load(id:string,indoor=false){
 dungeon?.dispose();dungeon=undefined;portals?.dispose();portals=undefined;weather?.dispose();weather=undefined;sky?.dispose();sky=undefined;boss?.dispose();boss=undefined;
 if(indoor)manager.selectDungeon(id);
 const world=await manager.loadMap(indoor?'dungeon':id);
 if(indoor){
  const plan=dungeonMap(id);dungeon=new DungeonInstance(scene,world,id);await dungeon.ready;
  scene.background=new Color(plan.fog);scene.fog=new FogExp2(plan.fog,.006);fill.intensity=1.1;sun.intensity=1.2;
  camera.position.set(38,66,-4);camera.lookAt(0,3,-58);
  const throne=plan.rooms[3];boss=new AnimatedGLB(plan.bossModel,4.4,()=>{},false);boss.root.position.set(throne.x,3.8,throne.z);scene.add(boss.root);
  await new Promise<void>((resolve,reject)=>{const began=performance.now();const poll=()=>{if(boss?.ready)return resolve();if(performance.now()-began>20000)return reject(Error('Boss asset timeout'));setTimeout(poll,50);};poll();});boss.update(.016,0);
 }else{
  const def=mapDefinition(id);scene.background=new Color(def.fog);scene.fog=new FogExp2(def.fog,def.fogDensity*.6);
  sky=new AtmosphericSky();sky.update(2,new Vector3(.3,.8,-.4),new Color(def.sky),new Color(def.horizon));scene.add(sky);sky.position.set(0,10,-60);fill.intensity=def.sun;sun.intensity=def.sun;
  camera.position.set(76,90,35);camera.lookAt(0,id==='eclipse'?14:6,-88);
  portals=new WorldPortals(scene,document.body,id,(x,z)=>world.heightAt(x,z),()=>({level:100,unlocked:['aurora','crypt','highlands','rift','eclipse']}),()=>{},()=> 'pt',{regionComplete:()=>true,canEnterRegion:()=>true},physics);
  weather=new RegionalWeather(scene);weather.setRegion(id);weather.update(.016,new Vector3(0,15,-80));
  await new Promise(resolve=>setTimeout(resolve,350));world.update(.016,.3,camera.position);
 }
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
 return {id:manager.sceneKey,mapRoots:scene.children.filter(o=>o.name.startsWith('ETERNA map instance:')).length,physicsBodies:physics.world.bodies.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};
}
(window as unknown as {sceneReview:unknown}).sceneReview={load};
