"""Visual regression smoke for the illustrated RPG surfaces (controlled software-WebGL frames)."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/visual-review');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/tmp/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for width,height in [(1440,1080),(390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<500)
  errors=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',str(e),flush=True)))
  page.on('console',lambda e:(errors.append(e.text),print('CONSOLE ERROR',e.text,flush=True)) if e.type=='error' else None)
  page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
  page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173'),wait_until='networkidle',timeout=120000)
  page.locator('[data-start]').click()
  page.locator('[data-do=class][data-id=warlock]').click()
  page.evaluate('''() => {const e=window.__ETERNA__;e.inventory.level=12;e.progress.allocate('warlock','power');e.progress.allocate('warlock','spirit');e.progress.allocate('warlock','precision');e.progress.gems.ruby=3;e.progress.record(0,'Aurora',0,18,false);}''')
  page.locator('[data-hub=talents]').click()
  assert page.locator('.talent-node').count()==5
  assert page.locator('.talent-link.lit').count()==3
  assert page.locator('.adventure-content .adventure-card').count()==0
  print('Capturing constellation',width,flush=True)
  page.screenshot(path=str(out/f'constellation-{width}.png'),timeout=120000)
  page.locator('[data-hub=inventory]').click()
  assert page.locator('.paper-slot').count()==8
  assert page.locator('.rpg-bag-grid .has-item').count()>=6
  assert page.locator('.adventure-content .adventure-card').count()==0
  assert page.locator('.paperdoll-canvas').is_visible()
  page.screenshot(path=str(out/f'inventory-{width}.png'),timeout=120000)
  if width>500:
   page.locator('[data-do=upgrade]').click()
   assert page.locator('.rpg-forge.hammering').count()==1
   assert page.evaluate('window.__ETERNA__.inventory.items[0].upgrade')==1
  page.locator('[data-hub=collection]').click()
  assert page.locator('.collection-thumbnail .item-illustration').count()==6
  assert page.locator('.adventure-content .adventure-card').count()==0
  page.screenshot(path=str(out/f'collection-{width}.png'),timeout=120000)
  page.locator('[data-hub=map]').click()
  assert page.locator('[data-world-map]').evaluate('(c)=>c.width')==1120
  page.locator('[data-do=gps-region][data-id=lake]').click()
  page.screenshot(path=str(out/f'atlas-{width}.png'),timeout=120000)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('[data-do=close]').click()
  page.evaluate('''() => {const e=window.__ETERNA__;e.configureQuality('low');e.renderer.setSize(640,360,false);e.composer.setSize(640,360);e.renderer.shadowMap.enabled=false;e.frame(1000);}''')
  print('Capturing world',width,flush=True)
  page.screenshot(path=str(out/f'world-{width}.png'),timeout=120000)
  assert page.locator('[data-ref=skillName0]').evaluate('(e)=>getComputedStyle(e).display')=='none'
  print(json.dumps({'viewport':width,'errors':errors,'diagnostics':page.evaluate('window.__ETERNA__.diagnostics')},ensure_ascii=False),flush=True)
  assert not errors,errors
  page.close()
 browser.close()
