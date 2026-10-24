"""Optional browser smoke. Requires Playwright and a Chromium with WebGL2."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
url=os.environ.get('ETERNA_URL','http://127.0.0.1:5173')
artifacts=Path('playwright-artifacts');artifacts.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/tmp/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for width,height in [(390,844),(960,640)]:
  page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  # Control frames so software graphics cannot starve UI automation. Render a
  # real frame explicitly below; this is not a device performance benchmark.
  page.add_init_script('window.requestAnimationFrame = () => 0; window.cancelAnimationFrame = () => {};')
  page.goto(url,wait_until='networkidle',timeout=120000)
  page.wait_for_function('!!window.__ETERNA__',timeout=120000)
  page.locator('[data-start]').click()
  page.locator('[data-do=class][data-id=necromancer]').click()
  assert page.locator('.adventure-main h1').inner_text()=='Epígrafo'
  page.evaluate('window.__ETERNA__.inventory.addXp(300)')
  page.locator('[data-hub=talents]').click()
  page.locator('[data-do=talent][data-key=power]').click()
  assert page.evaluate('window.__ETERNA__.progress.spent("necromancer")')==1
  for tab in ['inventory','shop','collection','map','teleports','dungeons','pass','settings']:
   page.locator('[data-hub='+tab+']').click()
   assert page.locator('.adventure-content').inner_text().strip(),tab
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),tab
  page.locator('[name=language]').select_option('en')
  assert page.locator('.adventure-main h1').inner_text()=='Settings'
  page.locator('[data-hub=inventory]').click()
  assert page.locator('.adventure-main h1').inner_text()=='Inventory & forge'
  page.locator('[data-hub=teleports]').click()
  assert page.locator('[data-do=teleport-record]').count()==10
  assert page.locator('[data-do=teleport-record]:not([disabled])').count()==4
  page.locator('[name=bookmark]').fill('Town')
  page.locator('[data-do=teleport-record][data-index="0"]').click()
  assert page.evaluate('window.__ETERNA__.progress.bookmarks[0].name')=='Town'
  page.locator('[data-do=close]').click()
  page.evaluate('''() => { const e=window.__ETERNA__; e.frame(1000); }''')
  assert page.evaluate('window.__ETERNA__.diagnostics.drawCalls')>0
  page.locator('.journey-button').click()
  page.locator('[data-hub=arena]').click()
  page.locator('[name=nickname]').fill('Smoke '+str(width))
  page.locator('[data-do="online:connect"]').click()
  page.wait_for_selector('.online-status',timeout=15000)
  assert 'Smoke '+str(width) in page.locator('.online-status').inner_text()
  # Pair the UI player with an independent real session and compile the arena scene.
  opponent=page.request.post(url+'/api/session',data={'name':'Arena peer '+str(width),'classId':'paladin'}).json()
  page.locator('[data-do="online:queue"][data-size="1"]').click()
  response=page.request.post(url+'/api/queue',data={'size':1},headers={'Authorization':'Bearer '+opponent['token']})
  assert response.ok
  page.evaluate("async () => { await window.__ETERNA__.hub.online.refresh(); window.__ETERNA__.hub.open('arena'); }")
  page.wait_for_selector('.arena-stage',timeout=30000)
  assert page.evaluate("!!document.querySelector('.arena-stage').getContext('webgl2')")
  page.screenshot(path=str(artifacts/('gdd-'+str(width)+'.png')),timeout=120000)
  print(json.dumps({'viewport':[width,height],'errors':errors,'diagnostics':page.evaluate('window.__ETERNA__.diagnostics')},ensure_ascii=False),flush=True)
  assert not errors,errors
  page.close()
 browser.close()
