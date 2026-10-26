"""Rebuild CC0 menu artwork. Requires a running Vite, Playwright, Pillow and Chromium.
No gameplay, native Android build, generated model primitives or remote assets are involved.
"""
import hashlib
import io
import json
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

repository=Path(__file__).resolve().parents[1]
out=repository/'public/assets/landscapes'
out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('ETERNA_URL','http://127.0.0.1:5173').rstrip('/')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/usr/bin/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':640},device_scale_factor=1)
 # Writing public assets normally triggers a Vite reload; the artwork stage is static.
 page.route('**/@vite/client',lambda route:route.abort())
 page.goto(url+'/scripts/render-landscape-art.html',wait_until='networkidle',timeout=120000)
 page.wait_for_function('window.artReady===true',timeout=120000)
 for theme,dungeon in [(x,False)for x in ['aurora','crypt','highlands','rift','eclipse']]+[(x,True)for x in ['crypt','highlands','rift','eclipse']]:
  page.evaluate('async p=>await window.renderLandscape(p.theme,p.dungeon)',{'theme':theme,'dungeon':dungeon})
  pixels=page.screenshot(timeout=120000)
  name=('dungeon-'if dungeon else '')+theme+'.webp'
  with Image.open(io.BytesIO(pixels))as image:image.convert('RGB').save(out/name,format='WEBP',quality=91,method=6)
  print(name,flush=True)
 browser.close()
manifest=json.loads((out/'manifest.json').read_text())
manifest['renders']=[{'file':path.name,'width':1280,'height':640,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'license':'CC0-1.0'}for path in sorted(out.glob('*.webp'))]
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
