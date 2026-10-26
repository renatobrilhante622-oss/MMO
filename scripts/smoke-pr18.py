"""Local-only functional scene/progression review. Screenshots are not a device benchmark."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('ETERNA_URL','http://127.0.0.1:5173');OUT=Path('docs/pr18-review');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,reduced_motion='reduce');page=context.new_page();errors=[]
 page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 page.goto(URL,wait_until='domcontentloaded');page.wait_for_function('!!window.__ETERNA__',polling=100)
 page.add_style_tag(content='.game-canvas{display:none!important}#app{background:#111c2b}')
 page.locator('[data-start]').click(force=True);choice=page.locator('[data-do="class"][data-id="warlock"]');
 if choice.count() and choice.is_visible():choice.click(force=True)
 close=page.locator('.adventure-layer [data-do="close"]')
 if close.count() and close.is_visible():close.click(force=True)
 page.evaluate('window.__ETERNA__.running=true');assert page.locator('.region-travel-trigger').count()==0;assert page.locator('[data-panel="base"]').count()==0
 print('LOCKED GATE',flush=True)
 locked=page.evaluate('''async()=>{const g=window.__ETERNA__;g.inventory.level=100;await g.terrain.ready;const {mapDefinition}=await import('/src/world/maps/MapDefinitions.ts');const exit=mapDefinition('aurora').exit;g.hero.teleportTo(g.hero.position.clone().set(exit.x,g.terrain.heightAt(exit.x,exit.z)+1,exit.z));g.portals.update(.2,g.camera,g.hero.position,true);window.oldMap=g.terrain;window.oldBodies=g.enemies.enemies.map(e=>e.body);window.persistentHero=g.hero.body;g.phase2Gathering.stock.ore=9;return {id:g.mapInstances.regionId,complete:g.quests.regionComplete('aurora'),barriers:[...g.physics.portalBarriers.values()].map(b=>b.collisionResponse)}}''')
 assert locked['id']=='aurora' and not locked['complete'] and True in locked['barriers'];report=json.loads((OUT/'browser-report.json').read_text()) if os.environ.get('UI_ONLY') and (OUT/'browser-report.json').exists() else {};report['locked']=locked
 print('CLAIM LOCAL CAMPAIGN AND WALK THROUGH GATE',flush=True)
 page.evaluate('''async()=>{const g=window.__ETERNA__;const {QUEST_STORY}=await import('/src/rpg/QuestSystem.ts');for(const q of QUEST_STORY.filter(q=>q.region==='aurora')){if(q.goal==='talk')g.quests.onTalk(q.target);else if(q.goal==='kill')for(let i=0;i<q.required;i++)g.quests.onKill(q.target,'aurora');else if(q.goal==='collect')g.quests.onCollect('aurora',q.required);else g.quests.onKill('boss','aurora',true);g.claimQuest(q.id);}g.portals.update(.2,g.camera,g.hero.position,true);}''')
 assert page.locator('.map-loading-screen').is_visible();page.screenshot(animations='disabled',path=str(OUT/'loading-crypt.png'))
 page.wait_for_function('window.__ETERNA__.mapInstances.regionId==="crypt"&&!window.__ETERNA__.mapLoading',polling=100,timeout=60000)
 arrived=page.evaluate('''()=>{const g=window.__ETERNA__;return {id:g.mapInstances.regionId,oldDetached:!window.oldMap.root.parent,oldBodiesRemoved:window.oldBodies.every(b=>!g.physics.world.bodies.includes(b)),heroRetained:g.physics.world.bodies.includes(window.persistentHero),gatheringRetained:g.phase2Gathering.stock.ore===9,mapCount:g.scene.children.filter(o=>o.name.startsWith('ETERNA map instance:')).length,nearGuardian:g.npcs.interact(g.hero.position)}}''');report['arrival']=arrived
 assert arrived=={'id':'crypt','oldDetached':True,'oldBodiesRemoved':True,'heroRetained':True,'gatheringRetained':True,'mapCount':1,'nearGuardian':True},arrived
 assert page.locator('.eterna-npc-dialog-backdrop').is_visible();page.screenshot(animations='disabled',path=str(OUT/'arrival-guardian.png'))
 page.locator('.eterna-npc-actions button').filter(has_text='Resgatar:').first.click()
 report['arrivalClaim']=page.evaluate('''()=>{const g=window.__ETERNA__;return {active:g.quests.activeStory().id,duplicate:g.quests.claim('story-crypt-meet')}}''');assert report['arrivalClaim']=={'active':'story-crypt-hunt','duplicate':False}
 print('EXCLUSIVE DUNGEON ROUND TRIP',flush=True)
 entered=page.evaluate('''()=>{const g=window.__ETERNA__;g.npcs.close();g.hero.teleportTo(g.terrain.portalPosition.clone());g.recentCombat=0;window.outdoorBeforeDungeon=g.terrain;return g.launchDungeon('tombs','normal')}''');assert entered
 page.wait_for_function('window.__ETERNA__.dungeon.active&&!window.__ETERNA__.dungeonLoading',polling=100,timeout=60000)
 report['dungeon']=page.evaluate('''()=>{const g=window.__ETERNA__;return {key:g.mapInstances.sceneKey,oldDetached:!window.outdoorBeforeDungeon.root.parent,npcs:g.npcs.actors.length,weatherEmpty:g.phase2Weather.root.children.length===0,skyHidden:!g.sky.visible,rooms:g.dungeonInstance.plan.rooms.length,heroRetained:g.physics.world.bodies.includes(window.persistentHero)}}''')
 assert report['dungeon']=={'key':'dungeon:tombs','oldDetached':True,'npcs':0,'weatherEmpty':True,'skyHidden':True,'rooms':4,'heroRetained':True},report['dungeon']
 page.evaluate('window.__ETERNA__.leaveDungeon()');page.wait_for_function('window.__ETERNA__.mapInstances.regionId==="crypt"&&!window.__ETERNA__.mapLoading',polling=100,timeout=60000)
 report['return']=page.evaluate('''()=>{const g=window.__ETERNA__;return {map:g.mapInstances.regionId,native:g.enemies.enemies.every(e=>['skeleton','wraith'].includes(e.kind)),ore:g.phase2Gathering.stock.ore,atEntry:g.hero.position.distanceTo(g.terrain.spawnPoint)<.2,portalRestored:g.dungeon.portalPosition.distanceTo(g.terrain.portalPosition)<.01}}''');assert report['return']=={'map':'crypt','native':True,'ore':9,'atEntry':True,'portalRestored':True},report['return']
 report['uiErrors']=errors;assert not errors,errors;context.close()
 if os.environ.get('UI_ONLY'):
  (OUT/'browser-report.json').write_text(json.dumps(report,indent=2));browser.close();print(json.dumps(report,indent=2));raise SystemExit(0)
 print('RENDER ACTUAL MAP BUILDERS',flush=True)
 context=browser.new_context(viewport={'width':1000,'height':640},reduced_motion='reduce');page=context.new_page();errors=[];page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL+'/scripts/review-pr18.html',wait_until='domcontentloaded');page.wait_for_function('!!window.sceneReview',timeout=60000)
 report['scenes']=[]
 for indoor,ids in [(False,['aurora','crypt','highlands','rift','eclipse']),(True,['tombs','titan','void','eclipse'])]:
  for id in ids:
   print('SCENE',indoor,id,flush=True)
   result=page.evaluate('async arg=>window.sceneReview.load(arg[0],arg[1])',[id,indoor]);assert result['mapRoots']==1,result;report['scenes'].append(result)
   page.screenshot(animations='disabled',path=str(OUT/(('dungeon-' if indoor else 'world-')+id+'.png')),timeout=30000)
 report['renderErrors']=errors;assert not errors,errors;(OUT/'browser-report.json').write_text(json.dumps(report,indent=2));browser.close();print(json.dumps(report,indent=2))
