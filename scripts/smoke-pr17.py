"""Deterministic mobile HUD/asset review; software GPU screenshots are not FPS benchmarks."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr17-review');OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('ETERNA_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 report=json.loads((OUT/'browser-report.json').read_text()) if os.environ.get('ASSETS_ONLY') and (OUT/'browser-report.json').exists() else {}
 for w,h in ([] if os.environ.get('ASSETS_ONLY') else [(844,390),(390,844),(360,800)]):
  context=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,reduced_motion='reduce')
  print('HUD',w,h,flush=True)
  def hmr(socket):
   server=socket.connect_to_server()
   def forward(message):
    try:
     if json.loads(message).get('type') in ['update','full-reload']:return
    except (ValueError,TypeError):pass
    socket.send(message)
   server.on_message(forward);socket.on_message(server.send)
  context.route_web_socket('**',hmr)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
  page.goto(URL,wait_until='domcontentloaded',timeout=60000);page.wait_for_function('!!window.__ETERNA__',timeout=60000,polling=100)
  # Mainworld rendering is isolated to keep software readback bounded. The actual
  # HUD and gameplay callbacks remain unchanged; assets are rendered separately.
  page.add_style_tag(content='.game-canvas{display:none!important}#app{background:radial-gradient(at 50% 48%,#263944,#0c1726 70%)}')
  if page.locator('.cinema-skip').count():page.locator('.cinema-skip').click(force=True)
  page.locator('[data-start]').click(force=True)
  choice=page.locator('[data-do="class"][data-id="warlock"]')
  if choice.count() and choice.is_visible():choice.click(force=True)
  close=page.locator('.adventure-layer [data-do="close"]')
  if close.count() and close.is_visible():close.click(force=True)
  page.evaluate('()=>{const g=window.__ETERNA__;g.running=true;g.configureQuality("low");g.updateHUD();}')
  page.wait_for_timeout(500)
  selectors=['.hero-card','.map-card','.menu-dock','.move-zone','.combat-controls','.eterna-hud>.movement-actions']
  row={'viewport':[w,h],'bounds':{}}
  for selector in selectors:
   box=page.locator(selector).first.bounding_box();row['bounds'][selector]=box
   assert box and box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,(selector,box)
  row['centerHits']=page.evaluate('()=>document.elementsFromPoint(innerWidth/2,innerHeight/2).filter(e=>e.matches("button,.hero-card,.map-card,.menu-dock,.combat-controls,.drop-toast-widget,.eterna-quest-tracker")).map(e=>e.className)')
  assert not row['centerHits'],row
  # Buttons must not overlap each other or the joystick.
  rects=page.locator('.eterna-hud [data-action],.eterna-hud [data-skill]').evaluate_all('(nodes)=>nodes.filter(n=>n.getBoundingClientRect().width&&getComputedStyle(n).visibility!=="hidden").map(n=>({id:n.dataset.action??n.dataset.skill,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))')
  row['buttons']=rects
  for i,a in enumerate(rects):
   for b in rects[i+1:]:
    # Circular controls may have overlapping rectangular bounds but never discs.
    distance=((a['x']+a['w']/2-b['x']-b['w']/2)**2+(a['y']+a['h']/2-b['y']-b['h']/2)**2)**.5
    assert distance>=min(a['w'],a['h'])/2+min(b['w'],b['h'])/2-1,(a,b,distance)
  page.screenshot(path=str(OUT/f'hud-{w}.png'),animations='disabled')
  page.locator('[data-hud-menu]').click();assert page.locator('.hud-drawer').is_visible()
  page.screenshot(path=str(OUT/f'drawer-{w}.png'),animations='disabled')
  page.locator('[data-hud-menu]').click();assert page.locator('.hud-drawer').is_hidden()
  page.locator('.map-card').click();assert page.locator('[data-world-map]').is_visible();row['teleports']=page.locator('.map-teleport-slot').count();assert row['teleports']==10
  page.locator('.adventure-layer [data-do="close"]').click()
  row['errors']=errors;assert not errors,errors;report[str(w)]=row
  context.close()
 # Render real optimized authored models using the production preview, independent
 # of the large world scene. Explicit draws exercise the GLTF meshopt/WebP decoder.
 context=browser.new_context(viewport={'width':900,'height':600},reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 page.goto(URL,wait_until='domcontentloaded');page.wait_for_function('!!window.__ETERNA__')
 page.evaluate('''async()=>{
 const {CharacterPreview}=await import('/src/ui/CharacterPreview.ts');const {COSMETICS}=await import('/src/progression/AdventureProgress.ts');
 document.querySelector('#app').style.display='none';const host=document.createElement('main');host.style.cssText='position:fixed;inset:0;background:radial-gradient(#28334a,#090e1b)';document.body.append(host);
 window.reviewPreview=new CharacterPreview();window.reviewCosmetics=COSMETICS;window.reviewHost=host;window.reviewPreview.mount(host,'paladin',0xffcc88,1,COSMETICS.find(c=>c.id==='sunhorse'));
 }''')
 for id in ['sunhorse','fenrir','ashdrake','void']:
  print('ASSET',id,flush=True)
  page.evaluate('''id=>window.reviewPreview.mount(window.reviewHost,id==='void'?'warlock':'paladin',0xffcc88,1,window.reviewCosmetics.find(c=>c.id===id))''',id)
  page.wait_for_function('''()=>{const p=window.reviewPreview;const root=p.rig?.root??p.animal?.root;let n=0;root?.traverseVisible(o=>{if(o.isSkinnedMesh)n++});return n>0}''',timeout=60000,polling=100)
  page.wait_for_timeout(700)
  page.evaluate('()=>{for(let i=0;i<30;i++)window.reviewPreview.draw(1/60)}');page.screenshot(path=str(OUT/f'preview-{id}.png'),animations='disabled',timeout=30000)
  report['preview-'+id]=page.evaluate('''()=>{const p=window.reviewPreview;let triangles=0,meshes=0;const root=p.rig?.root??p.animal?.root;root.traverseVisible(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3}});return {triangles,meshes,renderer:p.renderer.info.render,geometryMemory:p.renderer.info.memory.geometries,textures:p.renderer.info.memory.textures}}''')
 report['previewErrors']=errors;assert not errors,errors
 page.evaluate('window.reviewPreview.dispose()');browser.close()
 (OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
