"""Functional mobile checks with a bounded renderer; no Android FPS claim."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr20-review');OUT.mkdir(parents=True,exist_ok=True);URL=os.environ.get('ETERNA_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,reduced_motion='reduce');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 page.goto(URL,wait_until='domcontentloaded');page.wait_for_function('!!window.__ETERNA__',polling=100,timeout=60000)
 page.add_style_tag(content='.game-canvas{visibility:hidden!important}#app{background:#111c2b}')
 page.locator('[data-start]').click(force=True);choice=page.locator('[data-do="class"][data-id="warlock"]')
 if choice.count() and choice.is_visible():choice.click(force=True)
 close=page.locator('.adventure-layer [data-do="close"]')
 if close.count() and close.is_visible():close.click(force=True)
 page.evaluate('''async()=>{const g=window.__ETERNA__;await g.terrain.ready;g.running=true;g.hero.godMode=true;window.renders=0;g.renderer.render=()=>{window.renders++};g.composer.render=()=>{window.renders++};window.clock=performance.now();window.stepWorld=(frames=40)=>{for(let i=0;i<frames;i++){window.clock+=1000/60;g.frame(window.clock)}};}''')
 page.keyboard.down('w');report={'menus':[]}
 page.locator('[data-drawer-toggle]').click();page.evaluate('window.stepWorld(3)');assert page.locator('.hud-drawer').is_visible();page.locator('.hud-drawer [data-panel=inventory]').click();assert page.locator('.adventure-layer').is_visible();report['drawerRemainsUsable']=True
 for tab in ['inventory','forge','collection','map','settings']:
  print('LIVE MENU',tab,flush=True)
  page.evaluate('''tab=>{const g=window.__ETERNA__;window.before={position:g.hero.position.clone(),ai:g.enemies.elapsed,time:g.timeOfDay,renders:window.renders};if(tab==='forge')g.hub.openForge();else g.hub.open(tab);}''',tab)
  result=page.evaluate('''()=>{window.stepWorld();const g=window.__ETERNA__;return {moved:g.hero.position.distanceTo(window.before.position)>1,ai:g.enemies.elapsed>window.before.ai,daylight:g.timeOfDay>window.before.time,rendered:window.renders>window.before.renders,joystick:document.elementFromPoint(60,innerHeight-60)?.closest('.move-zone')!==null,isolated:g.container.classList.contains('entry-isolated')}}''');assert result=={'moved':True,'ai':True,'daylight':True,'rendered':True,'joystick':True,'isolated':False},(tab,result);report['menus'].append({'tab':tab,**result})
  if tab in ['inventory','map']:page.screenshot(path=str(OUT/('live-'+tab+'.png')),animations='disabled')
 page.keyboard.up('w');page.evaluate('window.__ETERNA__.hub.close();window.__ETERNA__.hub.openInventory()')
 zone=page.locator('.eterna-hud>.move-zone');box=zone.bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
 page.mouse.move(cx,cy);page.mouse.down();page.mouse.move(cx+34,cy,steps=4)
 touch=page.evaluate('''()=>{const g=window.__ETERNA__,x=g.hero.position.x;window.stepWorld(45);return {moved:g.hero.position.x>x+1,pointer:g.hud.movePointer!==null}}''');assert touch=={'moved':True,'pointer':True},touch
 page.evaluate('window.__ETERNA__.hub.close()');page.mouse.up();released=page.evaluate('window.__ETERNA__.hud.readInput().move');assert released=={'x':0,'y':0},released;report['joystick']={**touch,'released':True}
 pause=page.evaluate('''()=>{const g=window.__ETERNA__;g.setPaused(true);const p=g.hero.position.clone(),t=g.timeOfDay,ai=g.enemies.elapsed;window.stepWorld(60);const stopped=g.hero.position.distanceTo(p)<.0001&&g.timeOfDay===t&&g.enemies.elapsed===ai;g.setPaused(false);window.stepWorld(10);return {stopped,resumed:g.enemies.elapsed>ai}}''');assert pause=={'stopped':True,'resumed':True};report['pause']=pause
 print('QUEST GATE AND TRUE CROSSING',flush=True)
 gate=page.evaluate('''async()=>{const g=window.__ETERNA__,{QUEST_STORY}=await import('/src/rpg/QuestSystem.ts');g.inventory.level=1;g.recentCombat=3;for(const q of QUEST_STORY.filter(q=>q.region==='aurora')){if(q.goal==='talk')g.quests.onTalk(q.target);else if(q.goal==='kill')for(let i=0;i<q.required;i++)g.quests.onKill(q.target,'aurora');else if(q.goal==='collect')g.quests.onCollect('aurora',q.required);else g.quests.onKill('boss','aurora',true);if(q.goal!=='boss')g.quests.claim(q.id);}const portal=g.portals.root.getObjectByName('Rune portal crypt');const barriers=[...g.physics.portalBarriers.values()];return {open:portal.userData.open,unclaimed:!g.quests.regionComplete('aurora'),barrierOpen:barriers.every(b=>!b.collisionResponse)}}''');assert gate=={'open':True,'unclaimed':True,'barrierOpen':True},gate;report['portal']=gate
 page.evaluate('''()=>{const g=window.__ETERNA__;const gate=g.portals.portals.find(p=>p.site.destId==='crypt');g.hero.teleportTo(gate.root.position.clone().add({x:0,y:1,z:gate.offset}));g.portals.update(.016,g.camera,g.hero.position,true);}''')
 page.wait_for_function('window.__ETERNA__.mapInstances.regionId==="crypt"&&!window.__ETERNA__.mapLoading',polling=100,timeout=60000)
 report['arrival']=page.evaluate('''()=>{const g=window.__ETERNA__;return {region:g.mapInstances.regionId,finalRewardClaimed:g.quests.regionComplete('aurora'),quest:g.quests.activeStory().id,size:g.terrain.terrainSize,colliders:g.terrain.colliders.length}}''');assert report['arrival']['finalRewardClaimed'] and report['arrival']['quest']=='story-crypt-meet';assert not errors,errors
 report['errors']=errors;report['note']='Live simulation/render calls checked with rendering stubbed; actual GLB render evidence is separate.';(OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));browser.close()
