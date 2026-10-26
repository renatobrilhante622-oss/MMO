"""Functional mobile PvP checks; software rendering is not an Android FPS benchmark."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr19-review');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,reduced_motion='reduce');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded');page.wait_for_function('!!window.__ETERNA__',polling=100,timeout=60000)
 page.add_style_tag(content='.game-canvas{visibility:hidden!important}#app{background:#111c2b}')
 page.locator('[data-start]').click(force=True);choice=page.locator('[data-do="class"][data-id="warlock"]')
 if choice.count() and choice.is_visible():choice.click(force=True)
 close=page.locator('.adventure-layer [data-do="close"]')
 if close.count() and close.is_visible():close.click(force=True)
 page.evaluate('window.__ETERNA__.openPvP()');page.locator('[data-pvp="mode"][data-size="3"]').click();page.screenshot(path=str(OUT/'lobby-3v3.png'),animations='disabled')
 page.evaluate('''async()=>{const g=window.__ETERNA__;await g.terrain.ready;window.oldTerrain=g.terrain;window.oldEnemyBodies=g.enemies.enemies.map(e=>e.body);window.returnAt=g.hero.position.clone();window.originalStats={...g.hero.stats};g.phase2Gathering.stock.ore=13;}''')
 page.locator('[data-pvp="practice"]').click();page.wait_for_selector('[data-pvp="accept"]',timeout=12000);page.screenshot(path=str(OUT/'match-found-3v3.png'),animations='disabled');page.locator('[data-pvp="accept"]').click()
 page.wait_for_function('window.__ETERNA__.arenaUI.activeMap',polling=100,timeout=30000)
 loaded=page.evaluate('''()=>{const g=window.__ETERNA__;return {map:g.mapInstances.regionId,oldDetached:!window.oldTerrain.root.parent,oldBodiesRemoved:window.oldEnemyBodies.every(b=>!g.physics.world.bodies.includes(b)),fighters:g.arenaUI.match.fighters.length,botCount:g.arenaUI.match.fighters.filter(f=>f.bot).length,rendererCount:document.querySelectorAll('canvas.game-canvas').length,heroBodyRetained:g.physics.world.bodies.includes(g.hero.body),architecture:!!g.scene.getObjectByName('Imperial Coliseum · realtime PvP')}}''');assert loaded=={'map':'arena','oldDetached':True,'oldBodiesRemoved':True,'fighters':6,'botCount':5,'rendererCount':1,'heroBodyRetained':True,'architecture':True},loaded
 page.wait_for_function('window.__ETERNA__.arenaUI.match.phase==="active"',polling=100,timeout=8000)
 # Rendering is explicit and bounded to one reduced-resolution frame on software WebGL.
 page.evaluate('''async()=>{const g=window.__ETERNA__,{emptyInput}=await import('/src/core/GameTypes.ts');g.renderer.setSize(422,195,false);for(let i=0;i<90;i++)g.arenaMap.update(.033,g.arenaUI.match,g.arenaUI.selfId);g.tickArena(.033,emptyInput());}''')
 page.add_style_tag(content='.game-canvas{visibility:visible!important;width:100%!important;height:100%!important}')
 page.screenshot(path=str(OUT/'arena-3v3.png'),animations='disabled',timeout=60000)
 moved=page.evaluate('''async()=>{const g=window.__ETERNA__,{emptyInput}=await import('/src/core/GameTypes.ts');const before=g.arenaUI.match.fighters.find(f=>f.id==='local-hero').x;for(let i=0;i<12;i++){g.arenaUI.control({...emptyInput(),move:{x:1,y:0},skill:i===0?0:null,dash:i===0});await new Promise(r=>setTimeout(r,40));}return {before,after:g.arenaUI.match.fighters.find(f=>f.id==='local-hero').x,cooldown:g.arenaUI.match.fighters.find(f=>f.id==='local-hero').cooldowns[0]}}''');assert moved['after']>moved['before'] and moved['cooldown']>0,moved
 # Deterministic elimination in an explicitly local test simulation, never an online account.
 page.evaluate('''()=>{const a=window.__ETERNA__.arenaUI,s=a.local.sessions.values().next().value;const self=s.world.match.fighters.find(f=>f.id==='local-hero');for(const f of s.world.match.fighters)if(f.team!==self.team)s.world.forfeit(f.id);}''')
 page.wait_for_selector('[data-pvp="return"]',timeout=3000);page.screenshot(path=str(OUT/'victory-scoreboard.png'),animations='disabled');page.locator('[data-pvp="return"]').click()
 page.wait_for_function('window.__ETERNA__.mapInstances.regionId==="aurora"&&!window.__ETERNA__.mapLoading',polling=100,timeout=30000)
 returned=page.evaluate('''()=>{const g=window.__ETERNA__;return {map:g.mapInstances.regionId,exact:g.hero.position.distanceTo(window.returnAt)<.0001,ore:g.phase2Gathering.stock.ore,stats:JSON.stringify(g.hero.stats)===JSON.stringify(window.originalStats),arenaDetached:!g.scene.getObjectByName('Imperial Coliseum · realtime PvP'),savedMap:JSON.parse(localStorage.getItem('eterna-ninefold-save-v1')).regionId,overlayHidden:g.arenaUI.overlay.hidden}}''');assert returned=={'map':'aurora','exact':True,'ore':13,'stats':True,'arenaDetached':True,'savedMap':'aurora','overlayHidden':True},returned
 if os.environ.get('PVP_SERVER'):
  print('ONLINE TRANSPORT',flush=True)
  page.evaluate('window.__ETERNA__.openPvP()')
  page.locator('[name="pvp-server"]').fill(os.environ['PVP_SERVER']);page.wait_for_timeout(1100);assert page.locator('[name="pvp-server"]').input_value()==os.environ['PVP_SERVER'];page.locator('[name="pvp-name"]').fill('Browser Network');page.locator('[data-pvp="connect"]').click()
  page.wait_for_selector('[data-pvp="queue"]',timeout=10000);page.locator('[data-pvp="queue"]').click();page.wait_for_function('window.__ETERNA__.arenaUI.view.match?.phase==="found" || !!window.__ETERNA__.arenaUI.error',polling=100,timeout=12000);page.wait_for_selector('[data-pvp="accept"]',timeout=3000);page.locator('[data-pvp="accept"]').click()
  page.wait_for_function('window.__ETERNA__.arenaUI.activeMap&&window.__ETERNA__.arenaUI.match.phase==="active"',polling=100,timeout=30000)
  network=page.evaluate('''async()=>{const g=window.__ETERNA__,{emptyInput}=await import('/src/core/GameTypes.ts');const a=g.arenaUI,before=a.match.fighters.find(f=>f.id===a.selfId).x;for(let i=0;i<20;i++){a.control({...emptyInput(),move:{x:1,y:0},skill:i===0?0:null});await new Promise(r=>setTimeout(r,50));}const f=a.match.fighters.find(f=>f.id===a.selfId);return {networked:!a.local,moved:f.x>before+.5,skillAccepted:f.cooldowns[0]>0,bots:a.match.fighters.filter(f=>f.bot).length,ranked:a.match.ranked}}''')
  assert network=={'networked':True,'moved':True,'skillAccepted':True,'bots':5,'ranked':False},network
  page.locator('[data-pvp="forfeit"]').click();page.wait_for_function('window.__ETERNA__.mapInstances.regionId==="aurora"&&!window.__ETERNA__.mapLoading',polling=100,timeout=30000)
  (OUT/'browser-network-report.json').write_text(json.dumps(network,indent=2))
 assert not errors,errors
 report={'viewport':'844x390','loaded':loaded,'controls':moved,'return':returned,'errors':errors,'note':'Local AI simulation, manual renderer frame; no device FPS claim.'};(OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));browser.close()
