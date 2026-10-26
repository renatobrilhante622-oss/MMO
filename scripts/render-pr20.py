import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/pr20-review');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1000,'height':640});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None);page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173')+'/scripts/review-pr20.html',wait_until='domcontentloaded');page.wait_for_function('!!window.sceneReview',timeout=60000);report=[]
 selected=os.environ.get('ETERNA_RENDER_REGIONS','').split(',')
 existing=OUT/'render-report.json'
 if selected!=[''] and existing.exists():report=json.loads(existing.read_text())['scenes']
 for id,view in [('aurora','sealed'),('aurora','open'),('aurora','overview'),('crypt','overview'),('highlands','overview'),('rift','overview'),('eclipse','overview')]:
  if selected!=[''] and id not in selected:continue
  print('RENDER',id,view,flush=True);r=page.evaluate('async pair=>window.sceneReview.load(pair[0],pair[1])',[id,view]);assert r['colliders']>50 and r['spread']>150 and r['maxBaseError']<.02,r
  if view!='overview':assert r['archWidth']>r['archDepth'],r;assert r['portalOpen']==(view=='open'),r
  if view=='open':assert r['instantOpen'],r
  report=[old for old in report if (old['id'],old['view'])!=(id,view)];report.append({'view':view,**r});page.screenshot(path=str(OUT/(id+'-'+view+'.png')),animations='disabled',timeout=60000)
 assert not errors,errors;(OUT/'render-report.json').write_text(json.dumps({'scenes':report,'errors':errors,'note':'Bounded SwiftShader screenshots; no Android performance claim.'},indent=2));browser.close();print(json.dumps(report,indent=2))
