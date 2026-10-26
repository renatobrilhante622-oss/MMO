"""PR16 browser review: controlled software rendering, real DOM/action checks."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr16-review')
URL=os.environ.get('ETERNA_URL','http://127.0.0.1:5173')

def bounds(page,selector):
 loc=page.locator(selector).first
 return loc.bounding_box() if loc.count() else None

def shot(page,name):
 print('SCREENSHOT',name,flush=True)
 page.screenshot(path=str(OUT/(name+'.png')),animations='disabled',timeout=30000)

def start(page):
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 print('START',page.viewport_size,flush=True)
 page.goto(URL,wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.__ETERNA__',timeout=90000)
 if page.locator('.cinema-skip').count():page.locator('.cinema-skip').click(force=True)
 page.locator('[data-start]').click(force=True)
 button=page.locator('[data-do="class"][data-id="warlock"]')
 if button.count() and button.is_visible():button.click(force=True)
 close=page.locator('.adventure-layer [data-do="close"]')
 if close.count() and close.is_visible():close.click(force=True)
 page.evaluate('()=>{const g=window.__ETERNA__;g.running=true;g.configureQuality("low");g.updateHUD();}')
 page.wait_for_timeout(500)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 OUT.mkdir(parents=True,exist_ok=True)
 report={}
 for key,w,h in [('landscape',844,390),('portrait',390,844)]:
  context=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,reduced_motion='reduce',device_scale_factor=1)
  def hmr(socket):
   server=socket.connect_to_server()
   def forward(message):
    try:
     payload=json.loads(message)
     if payload.get('type') in ['update','full-reload']:return
    except (ValueError,TypeError):pass
    socket.send(message)
   server.on_message(forward)
   socket.on_message(server.send)
  context.route_web_socket('**',hmr)
  page=context.new_page();errors=[];warnings=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR',str(e),flush=True)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
  start(page)
  row={'viewport':[w,h]}
  # Mainworld readback is kept out of this UI pass; software GPU cost is not a device benchmark.
  # Fullscreen duel and controls retain the existing ArenaSystem mutation path.
  page.locator('[data-hud-menu]').click()
  row['drawer']=bounds(page,'.hud-drawer')
  row['drawerSvgCount']=page.locator('.hud-drawer svg').count()
  page.locator('[data-hud-menu]').click()
  row['drawerClosedByToggle']=page.locator('.hud-drawer').is_hidden()
  assert row['drawerClosedByToggle']
  page.evaluate('window.__ETERNA__.phase2UI.open("arena")')
  row['lobby']=bounds(page,'.pr15-shell')
  row['tabSvgCount']=page.locator('.pr15-tabs button svg').count()
  row['tabTexts']=page.locator('.pr15-tabs button').all_text_contents()
  if key=='landscape':shot(page,'arena-lobby-844')
  page.locator('[data-phase2="challenge"]').first.click()
  page.wait_for_timeout(500)
  page.evaluate('async()=>{const s=window.__ETERNA__.phase2UI.arenaView.presentation;if(s)await s.ready;}')
  page.wait_for_function('()=>{const s=window.__ETERNA__.phase2UI.arenaView.presentation;return s&&s.actors.size===2&&Array.from(s.actors.values()).every(a=>a.rig.imported?.ready);}',timeout=60000)
  page.evaluate('()=>{const s=window.__ETERNA__.phase2UI.arenaView.presentation;s.entrance=1;s.renderOnce(.033);}')
  row['arenaScene']=page.evaluate('()=>{const s=window.__ETERNA__.phase2UI.arenaView.presentation;return {architecture:s.architecture.children.map(o=>o.name),actors:s.actors.size,drawCalls:s.renderer.info.render.calls,toneMapping:s.renderer.toneMapping,shadowMap:s.renderer.shadowMap.enabled};}')
  row['arenaRoot']=bounds(page,'.pr16-arena-fullscreen')
  row['arenaCanvas']=bounds(page,'.pr16-arena-canvas')
  row['offlineLabel']=page.locator('.pr15-overlay').inner_text()
  # Live mutations must still be driven by ArenaSystem; advance only its normal tick.
  initial=page.evaluate('()=>({hp:window.__ETERNA__.phase2Arena.duel.ai.hp,hero:window.__ETERNA__.phase2Arena.duel.hero.hp})')
  dash=page.locator('[data-phase2="duel"][data-cmd="dash"]')
  if dash.count():dash.click()
  attack=page.locator('[data-phase2="duel"][data-cmd="strike"]')
  if attack.count():attack.click()
  row['combatBefore']=initial
  row['combatAfter']=page.evaluate('()=>({hp:window.__ETERNA__.phase2Arena.duel.ai.hp,hero:window.__ETERNA__.phase2Arena.duel.hero.hp})')
  row['bodyOverflow']=page.evaluate('()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight})')
  page.evaluate('()=>{const v=window.__ETERNA__.phase2UI.arenaView;v.sync();v.presentation.renderOnce(.033);}')
  assert row['arenaRoot'] and row['arenaRoot']['width']>=w-1 and row['arenaRoot']['height']>=h-1,row['arenaRoot']
  assert row['arenaCanvas'] and row['arenaCanvas']['width']>=w-1 and row['arenaCanvas']['height']>=h-1,row['arenaCanvas']
  assert row['combatAfter']['hp']<initial['hp'],row['combatAfter']
  assert row['tabSvgCount']==6,row['tabSvgCount']
  shot(page,'arena-'+key)
  page.evaluate('window.__ETERNA__.phase2UI.close()')
  page.evaluate('window.__ETERNA__.dungeonUI.open()')
  row['dungeonCovers']=page.locator('.dungeon-cover').evaluate_all('(nodes)=>nodes.map(e=>({image:getComputedStyle(e).backgroundImage,rect:e.getBoundingClientRect().toJSON()}))')
  if key=='portrait':shot(page,'dungeons-390')
  page.evaluate('window.__ETERNA__.dungeonUI.close()')
  page.evaluate('window.__ETERNA__.regionTravel.open()')
  row['regionBanners']=page.locator('.region-travel-banner').evaluate_all('(nodes)=>nodes.map(e=>getComputedStyle(e).backgroundImage)')
  assert all('.webp' in image and '/assets/landscapes/' in image for image in row['regionBanners']),row['regionBanners']
  page.evaluate('window.__ETERNA__.regionTravel.close()')
  page.evaluate('window.__ETERNA__.hub.open("shop")')
  row['merchant']=bounds(page,'.adventure-window')
  row['merchantStyle']=page.locator('.adventure-window').evaluate('(e)=>({background:getComputedStyle(e).backgroundImage,border:getComputedStyle(e).borderColor,clip:getComputedStyle(e).clipPath})')
  row['errors']=errors;row['warnings']=warnings
  report[key]=row
  (OUT/'browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
  assert not errors,errors
  context.close()
 browser.close()
 (OUT/'browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
 print(json.dumps(report,ensure_ascii=False),flush=True)
