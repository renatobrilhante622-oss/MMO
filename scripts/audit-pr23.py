import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/pr23-review');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':844,'height':390});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173')+'/scripts/review-pr23.html',wait_until='domcontentloaded');page.wait_for_function('!!window.audit23',timeout=60000)
 print('50 ACTUAL GLB APPEARANCE SWAPS',flush=True);r=page.evaluate('window.audit23.stress()');assert r['contexts']==1,r;assert r['stable'],r;assert r['hidden']['frames']==0 and r['hidden']['actors']==0,r;assert r['hidden']['resources']=={'materials':0,'materialLeases':0,'assets':0},r['hidden'];assert len(r['requests'])==len(set(r['requests'])),r['requests']
 for s in r['samples']:
  assert s['frames']==1 and s['contexts']==1 and s['lights']==0 and s['points']<=40,s
  assert all(x['count']==1 for x in s['sockets']),s
 for k in ['geometries','textures']:
  assert r['after']['memory'][k]<=r['baseline']['memory'][k]+1,r
 assert r['after']['resources']==r['baseline']['resources'],r
 page.screenshot(path=str(out/'weapon-hand-socket.png'),animations='disabled');page.evaluate("window.audit23.select('steed-imperial')");page.screenshot(path=str(out/'organic-mount.png'),animations='disabled');page.evaluate('window.audit23.dispose()')
 assert not errors,errors;(out/'gpu-swap-report.json').write_text(json.dumps({'audit':r,'errors':errors,'note':'Production GLBs/materials and actual WebGL renderer in SwiftShader. Fifty awaited swaps after warming ten appearances; controlled RAF scheduler verifies one pending loop. Not an Android FPS benchmark.'},indent=2));browser.close();print('PASS',flush=True)
