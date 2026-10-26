import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr21-review');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1000,'height':640});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173')+'/scripts/review-pr21.html',wait_until='domcontentloaded');page.wait_for_function('!!window.fieldReview',timeout=60000);report=[]
 for kind in ['camp','elite','rift']:
  print('RENDER',kind,flush=True);result=page.evaluate('kind=>window.fieldReview.load(kind)',kind);assert result['specialPopulation']<=24,result;assert result['fieldBatches']>=10,result
  if kind=='elite':assert result['elites']>=1,result
  report.append(result);page.screenshot(path=str(OUT/('world-'+kind+'.png')),animations='disabled',timeout=60000)
 assert not errors,errors;(OUT/'render-report.json').write_text(json.dumps({'scenes':report,'errors':errors,'note':'Production generators and GLBs; bounded SwiftShader rendering, not an Android FPS benchmark.'},indent=2));print(json.dumps(report,indent=2));browser.close()
