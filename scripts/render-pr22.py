import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/pr22-review');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1200,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173')+'/scripts/review-pr22.html',wait_until='domcontentloaded');page.wait_for_function('!!window.skinReview',timeout=60000);report={}
 for kind in ['weapon','skin','wing','mount']:
  print('RENDER',kind,flush=True);report[kind]=page.evaluate('kind=>window.skinReview.load(kind)',kind);page.screenshot(path=str(out/(kind+'-comparison.png')),animations='disabled',timeout=60000)
 assert not errors,errors;(out/'render-report.json').write_text(json.dumps({'appearances':report,'errors':errors,'note':'Production GLB assemblies, bounded SwiftShader renders. Not an Android FPS benchmark.'},indent=2));browser.close();print('PASS',flush=True)
