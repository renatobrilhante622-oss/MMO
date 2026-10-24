"""Verify both download controls and the bytes delivered by the browser."""
import hashlib,os
from pathlib import Path
from playwright.sync_api import sync_playwright
expected=hashlib.sha256(Path('releases/EternalHero-MMO-debug.apk').read_bytes()).hexdigest()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('ETERNA_CHROME','/tmp/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};')
 page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173'),wait_until='networkidle')
 link=page.locator('.start-screen a.apk-download')
 assert link.is_visible() and link.get_attribute('href')=='/EternalHero-MMO-debug.apk'
 with page.expect_download() as pending:link.click()
 download=pending.value
 assert download.suggested_filename=='EternalHero-MMO-debug.apk'
 assert hashlib.sha256(Path(download.path()).read_bytes()).hexdigest()==expected
 page.locator('[data-start]').click()
 page.locator('[data-do=class][data-id=necromancer]').click()
 page.locator('[data-hub=settings]').click()
 link=page.locator('.settings-form a.apk-download')
 assert link.is_visible() and link.get_attribute('href')=='/EternalHero-MMO-debug.apk'
 print('Start-screen download, browser file SHA256, and settings link: PASS')
 browser.close()
