"""End-to-end checks for fixed three-column menus, minimap entry and freely movable persisted HUD."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/mobile-ux-review');out.mkdir(exist_ok=True,parents=True)
URL=os.environ.get('ETERNA_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/tmp/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for width,height in ([(390,844)] if os.environ.get('ETERNA_UX_TOUCH_ONLY') else [(390,844),(844,390),(1366,768)]):
  context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<1000)
  page=context.new_page();page.emulate_media(reduced_motion='reduce');errors=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('ERROR',str(e),flush=True)))
  page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
  page.goto(URL,wait_until='networkidle',timeout=120000)
  page.locator('[data-splash-start]').click()
  page.locator('[data-start]').click();page.locator('[data-do=class][data-id=warlock]').click()
  def tab(name):
   button=page.locator('[data-hub='+name+']')
   if not button.is_visible():page.locator('[data-do=toggle-nav]').click()
   button.click()
  tab('inventory')
  assert page.locator('[data-hub=map]').count()==0
  assert abs(page.locator('.compact-menu-bar').bounding_box()['height']-42)<.1
  boxes=[page.locator(s).bounding_box() for s in ['.paperdoll-panel','.rpg-bag-panel','.rpg-forge']]
  assert boxes[0]['x']<boxes[1]['x']<boxes[2]['x'],boxes
  assert max(b['y'] for b in boxes)-min(b['y'] for b in boxes)<2,boxes
  assert page.locator('.adventure-content').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  for selector in ['.paper-boots','.paperdoll-stats','[data-do=upgrade]','.forge-socket-rack']:
   box=page.locator(selector).bounding_box();assert box and box['y']>=42 and box['y']+box['height']<=height+1,(selector,box)
  page.locator('[data-do=forge-open]').click();assert page.locator('.forge-dedicated').is_visible()
  page.screenshot(path=str(out/f'forge-refine-{width}.png'),timeout=120000,animations='disabled')
  page.locator('[data-do=forge-tab][data-key=sockets]').click();assert page.locator('.forge-socket-rack').is_visible()
  page.screenshot(path=str(out/f'forge-sockets-{width}.png'),timeout=120000,animations='disabled')
  page.locator('[data-do=forge-back]').click()
  page.locator('[name=rarity-filter]').select_option('mythic');assert page.locator('.rpg-bag-grid .has-item').count()==0
  page.locator('[name=rarity-filter]').select_option('all')
  page.mouse.move(0,0);page.screenshot(path=str(out/f'inventory-{width}.png'),timeout=120000,animations='disabled')
  for name,selector in [('pass','.vip-splash'),('base','.building-art'),('codex','.beast-portrait'),('classes','.class-banner')]:
   tab(name);assert page.locator(selector).count()>0
   page.screenshot(path=str(out/f'{name}-{width}.png'),timeout=120000,animations='disabled')
   if name=='pass':
    assert page.locator('.reward-track-cell').count()==100
    page.locator('[data-do=pass-tab][data-key=missions]').click();assert page.locator('.journey-quest').count()==3
    page.screenshot(path=str(out/f'journeys-{width}.png'),timeout=120000,animations='disabled')
    page.locator('[data-do=pass-tab][data-key=rewards]').click()
  assert page.locator('.adventure-content').evaluate('(e)=>getComputedStyle(e).overflowY')=='hidden'
  page.locator('[data-do=close]').click()
  j=page.locator('.move-zone').bounding_box()
  for selector in ['.combat-controls','.movement-actions','.menu-dock']:
   c=page.locator(selector).bounding_box()
   overlap=min(j['x']+j['width'],c['x']+c['width'])>max(j['x'],c['x']) and min(j['y']+j['height'],c['y']+c['height'])>max(j['y'],c['y'])
   assert not overlap,(selector,j,c)
  page.locator('.map-card').click()
  assert page.locator('.adventure-window.tab-map').is_visible()
  assert page.locator('.map-teleport-slot').count()==10
  assert page.locator('.map-teleport-slot.unlocked').count()==4
  last=page.locator('.map-teleport-slot').last.bounding_box();assert last['y']+last['height']<=height
  page.locator('[data-world-map]').click(position={'x':70,'y':70});page.locator('[data-do=gps-apply]').click()
  assert page.evaluate('window.__ETERNA__.gpsRoute.length')>0
  assert page.locator('.tab-map .adventure-nav').is_hidden()
  for button in page.locator('[data-do=teleport-record]').all():
   r=button.bounding_box();assert r['x']>=0 and r['x']+r['width']<=width,(width,r)
  page.screenshot(path=str(out/f'map-{width}.png'),timeout=120000,animations='disabled')
  page.locator('[data-do=close]').click();page.locator('.journey-button').click();tab('settings')
  page.locator('[data-do=edit-hud]').click();assert page.locator('.hud-editor-toolbar').is_visible()
  for key in ['joystick','combat','movement','minimap','vitals','shortcuts','autofarm']:
   assert page.locator('[data-hud-edit-key='+key+']').count()==1
  element=page.locator('[data-hud-edit-key=joystick]');before=element.bounding_box()
  x=before['x']+before['width']*.5;y=before['y']+before['height']*.5
  if width==390:
   cdp=context.new_cdp_session(page)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
   for step in range(1,11):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+45*step/10,'y':y-70*step/10}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  else:
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+45,y-70,steps=10);page.mouse.up()
  after=element.bounding_box();assert after['x']>before['x']+20 and after['y']<before['y']-30,(before,after)
  # The dedicated grip makes even controls underneath the toolbar or another control reachable.
  for key in ['combat','movement','minimap','vitals','shortcuts','autofarm']:
   page.locator('[data-hud-selection]').select_option(key)
   control=page.locator('[data-hud-edit-key='+key+']');a=control.bounding_box()
   grip=page.locator('[data-hud-drag]').bounding_box();gx=grip['x']+grip['width']/2;gy=grip['y']+grip['height']/2
   dx=-25 if a['x']>width/2 else 25;dy=25 if a['y']<height/2 else -25
   page.mouse.move(gx,gy);page.mouse.down();page.mouse.move(gx+dx,gy+dy,steps=5);page.mouse.up()
   b=control.bounding_box();assert abs(a['x']-b['x'])+abs(a['y']-b['y'])>15,(key,a,b)
  page.locator('[data-hud-selection]').select_option('joystick')
  page.locator('[data-hud-scale]').evaluate("e=>{e.value='1.25';e.dispatchEvent(new Event('input',{bubbles:true}));}")
  page.locator('[data-hud-opacity]').evaluate("e=>{e.value='.55';e.dispatchEvent(new Event('input',{bubbles:true}));}")
  page.screenshot(path=str(out/f'hud-editor-{width}.png'),timeout=120000,animations='disabled')
  page.locator('[data-hud-save]').click();assert page.locator('.hud-editor-toolbar').count()==0
  saved=page.evaluate("JSON.parse(localStorage.getItem('eterna-hud-layout-v3'))")
  assert saved['joystick']['scale']==1.25 and saved['joystick']['opacity']==.55
  old=page.locator('[data-hud-edit-key=joystick]').bounding_box()
  page.reload(wait_until='networkidle');page.locator('[data-start]').click()
  new=page.locator('[data-hud-edit-key=joystick]').bounding_box()
  assert abs(new['x']-old['x'])<2 and abs(new['y']-old['y'])<2,(old,new)
  assert page.locator('[data-hud-edit-key=joystick]').evaluate('(e)=>Number(getComputedStyle(e).opacity)')==.55
  # Resizing the joystick must preserve its local radius and input strength.
  joy=page.locator('[data-hud-edit-key=joystick]').bounding_box()
  point=page.evaluate('''r=>{for(const a of [.15,.4,.65])for(const b of [.15,.4,.65]){const x=r.x+r.width*a,y=r.y+r.height*b;if(document.elementFromPoint(x,y)?.closest('[data-hud-edit-key=joystick]'))return {x,y};}return null;}''',joy)
  assert point,joy
  jx=point['x'];jy=point['y']
  page.mouse.move(jx,jy);page.mouse.down();page.mouse.move(jx+27.5,jy,steps=5)
  strength=page.evaluate('window.__ETERNA__.hud.readInput().move.x');page.mouse.up();assert abs(strength-.5)<.02,strength
  print(json.dumps({'viewport':[width,height],'header':42,'columns':3,'teleports':10,'hud_saved':True,'draggable_controls':7,'errors':errors}),flush=True)
  assert not errors,errors
  context.close()
 browser.close()
