import {Color,DirectionalLight,FogExp2,HemisphereLight,PerspectiveCamera,Scene,Vector3,WebGLRenderer} from 'three';
import {configureRenderer} from '../src/core/Renderer';
import {OpenWorldGenerator} from '../src/world/OpenWorldGenerator';
import {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {EnemyAI} from '../src/enemies/EnemyAI';
import {EventBus,type Combatant} from '../src/core/GameTypes';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {QuestSystem} from '../src/rpg/QuestSystem';
import {FieldProgress} from '../src/rpg/FieldRewards';
import {OpenWorldActivities} from '../src/world/OpenWorldActivities';
import {FieldActivityScene} from '../src/world/FieldActivityScene';
import {AnimatedGLB} from '../src/assets/AnimatedGLB';
const scene=new Scene(),renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});configureRenderer(renderer,{mobile:true,exposure:1.1});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;document.body.append(renderer.domElement);scene.background=new Color('#8eb2b9');scene.fog=new FogExp2('#8eb2b9',.009);
const camera=new PerspectiveCamera(50,innerWidth/innerHeight,.1,1000),fill=new HemisphereLight(0xc8deee,0x4b3d33,2.4),sun=new DirectionalLight(0xffe9bd,2.2);sun.position.set(-25,50,30);scene.add(fill,sun);
const world=new OpenWorldGenerator(scene,713),physics=new PhysicsWorld(world),events=new EventBus(),inv=new InventoryAndLoot(events),progress=new AdventureProgress(inv),quests=new QuestSystem(inv,progress),field=new FieldProgress(),enemies=new EnemyAI(scene,physics,events);enemies.resetForRegion('aurora');enemies.setRegionalBossGate(()=>false);
const hero:Combatant={id:'review',team:'hero',hp:100,maxHp:100,radius:.5,defense:1,alive:true,invulnerable:true,position:new Vector3(),receiveDamage:()=>0};
const actors=new OpenWorldActivities('aurora',physics,enemies,quests,field,{reward:()=>{},message:()=>{},board:()=>{},resource:()=>{},storm:()=>{}}),view=new FieldActivityScene(scene,world,actors,physics);
const knight=new AnimatedGLB('KayKit_Knight',1.9,()=>{},true);scene.add(knight.root);
events.on('kill',e=>{if(e.activityId)actors.onKilled(e);});
const ready=Promise.all([world.ready,view.ready]);
async function load(kind:'camp'|'elite'|'rift'){
 await ready;const id=kind==='camp'?'aurora-camp-0':kind==='elite'?'aurora-captain-1':'aurora-rift-0',site=actors.sites.find(s=>s.id===id)!;
 hero.position.set(site.x+1,world.heightAt(site.x+1,site.z+9)+.6,site.z+9);knight.root.position.copy(hero.position).add(new Vector3(0,-.5,0));knight.root.rotation.y=Math.PI;
 for(let i=0;i<4;i++)actors.update(.1,hero);
 if(kind==='rift'){field.cooldown('aurora-rift-schedule',0);actors.update(.1,hero);actors.update(.1,hero);}
 const needed=enemies.enemies.filter(e=>e.activity&&e.alive&&e.position.distanceTo(hero.position)<65);
 await new Promise<void>((resolve,reject)=>{const start=performance.now(),check=()=>{const done=knight.ready&&needed.every(e=>(e as unknown as {rig:{imported?:AnimatedGLB}}).rig.imported?.ready);if(done)return resolve();if(performance.now()-start>20000)return reject(Error('Creature GLB load timeout'));setTimeout(check,50);};check();});
 for(const enemy of needed)enemy.tick(.016,hero,1);knight.update(.016,0);view.update(.25,hero.position);world.update(.016,.3,camera.position);
 const y=world.heightAt(site.x,site.z);camera.position.set(site.x+(kind==='elite'?12:18),y+(kind==='elite'?7:14),site.z+(kind==='elite'?18:23));camera.lookAt(site.x,y+1.8,site.z);camera.updateMatrixWorld(true);renderer.render(scene,camera);
 return {kind,site:id,actors:needed.length,specialPopulation:enemies.enemies.filter(e=>e.activity&&e.alive).length,elites:needed.filter(e=>e.elite).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fieldBatches:view.root.children.filter(o=>o.name.startsWith('Field batch')).length};
}
(window as unknown as {fieldReview:unknown}).fieldReview={load};
