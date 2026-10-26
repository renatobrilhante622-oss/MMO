/** Bounded actual production GLB/map render fixture, not a second game implementation. */
import {Box3,Color,DirectionalLight,FogExp2,HemisphereLight,Mesh,PerspectiveCamera,Scene,Vector3,WebGLRenderer} from 'three';
import {configureRenderer} from '../src/core/Renderer';
import {AtmosphericSky} from '../src/core/AtmosphericSky';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {SceneManager} from '../src/world/SceneManager';
import {WorldPortals} from '../src/world/WorldPortals';
import {mapDefinition} from '../src/world/maps/MapDefinitions';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {QuestSystem,QUEST_STORY} from '../src/rpg/QuestSystem';
import {EventBus} from '../src/core/GameTypes';
const scene=new Scene(),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});configureRenderer(renderer,{mobile:true,exposure:1.15});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;document.body.append(renderer.domElement);
const camera=new PerspectiveCamera(55,innerWidth/innerHeight,.1,2000),fill=new HemisphereLight(0xdceaff,0x273123,2),sun=new DirectionalLight(0xffeccb,2.2);sun.position.set(-40,80,30);scene.add(fill,sun);
const original=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(original),manager=new SceneManager(scene,physics,original);
let sky:AtmosphericSky|undefined,portals:WorldPortals|undefined;
async function load(id:string,view:'sealed'|'open'|'overview'='overview'){
 portals?.dispose();sky?.dispose();const world=await manager.loadMap(id),def=mapDefinition(id);
 const inv=new InventoryAndLoot(new EventBus()),progress=new AdventureProgress(inv),quests=new QuestSystem(inv,progress);
 portals=new WorldPortals(scene,document.body,id,(x,z)=>world.heightAt(x,z),()=>({level:1,unlocked:['aurora'],inCombat:true}),()=>{},()=> 'pt',quests,physics);await portals.ready;
 let instantOpen=false;
 if(view==='open'){
  for(const q of QUEST_STORY.filter(q=>q.region===id)){if(q.goal==='talk')quests.onTalk(q.target);else if(q.goal==='collect')quests.onCollect(id,q.required);else if(q.goal==='kill')for(let i=0;i<q.required;i++)quests.onKill(q.target,id);else if(q.goal==='boss')quests.onKill('boss',id,true);else for(let i=0;i<q.required;i++)quests.onActivity(q.goal,q.region,q.goal==='investigate'?q.target:'review-fixture-'+i);if(q.goal!=='boss')quests.claim(q.id);}
  instantOpen=!!portals.root.getObjectByName('Rune portal crypt')?.userData.open;
 }
 scene.background=new Color(def.fog);scene.fog=new FogExp2(def.fog,view==='overview'?.0015:.003);
 sky=new AtmosphericSky();sky.update(2,new Vector3(.3,.8,-.4),new Color(def.sky),new Color(def.horizon));scene.add(sky);fill.intensity=def.sun;sun.intensity=def.sun;
 if(view==='overview'){camera.position.set(def.size*.22,def.size*.38,def.size*.35);camera.lookAt(0,6,-def.size*.15);}
 else{const p=def.exit,h=world.heightAt(p.x,p.z);camera.position.set(p.x+8,h+7,p.z+14);camera.lookAt(p.x,h+3,p.z);}
 sky.position.copy(camera.position);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);world.update(.016,.3,camera.position);renderer.render(scene,camera);
 const portal=portals.root.children.find(o=>o.name==='Rune portal crypt'),arch=portal?.children.find(o=>o.name!=='Animated gateway VFX');const box=arch?new Box3().setFromObject(arch):undefined;
 const baseErrors=world.colliders.map(c=>Math.abs(c.position.y-c.size.y/2-world.heightAt(c.position.x,c.position.z)));
 return {id,size:world.terrainSize,colliders:world.colliders.length,spread:Math.max(...world.colliders.map(c=>Math.max(Math.abs(c.position.x),Math.abs(c.position.z)))),maxBaseError:Math.max(0,...baseErrors),instantOpen,portalOpen:portal?.userData.open,archWidth:box?.getSize(new Vector3()).x,archDepth:box?.getSize(new Vector3()).z,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
(window as unknown as {sceneReview:unknown}).sceneReview={load};
