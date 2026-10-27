import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/pr23-review');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,reduced_motion='reduce');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};');page.goto(os.environ.get('ETERNA_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded');page.wait_for_function('!!window.__ETERNA__',timeout=90000,polling=100);page.locator('[data-start]').click(force=True)
 choice=page.locator('[data-do="class"][data-id="warlock"]')
 if choice.count() and choice.is_visible():choice.click(force=True)
 close=page.locator('.adventure-layer [data-do="close"]')
 if close.count() and close.is_visible():close.click(force=True)
 page.evaluate('''async()=>{const g=window.__ETERNA__;await Promise.all([g.terrain.ready,g.activityScene.ready]);g.hero.godMode=true;g.reviewRender=g.renderer.render.bind(g.renderer);g.renderer.render=()=>{};g.composer.render=()=>{};g.running=true;window.renderSnapshot=()=>{g.renderer.shadowMap.enabled=false;g.reviewRender(g.scene,g.camera)};window.clock=performance.now();window.step=(n=1)=>{for(let i=0;i<n;i++){clock+=50;g.frame(clock)}};}''')
 print('COMPACT GATHER BUTTON AND HERO-HEAD CHANNEL',flush=True)
 gather=page.evaluate('''()=>{const g=window.__ETERNA__,s=g.phase2Gathering,n=s.nodes.find(n=>n.kind!=='chest'&&g.physics.isPositionFree(n.x,n.z));g.hero.teleportTo(g.hero.position.clone().set(n.x,g.terrain.heightAt(n.x,n.z)+g.hero.radius+.1,n.z));step(5);s.update(.05,g.hero.position,true,g.camera);const selected=s.closest(g.hero.position);window.gatherKind=selected.kind;window.beforeStock=s.stock[selected.kind];return {id:selected.id,kind:selected.kind}}''')
 button=page.locator('.gather-action');assert button.is_visible();rect=button.bounding_box();assert rect['width']<=125 and rect['height']<=32,rect
 for skill in page.locator('.skill-button,.attack-button').all():
  b=skill.bounding_box();assert not b or rect['x']+rect['width']<=b['x'] or b['x']+b['width']<=rect['x'] or rect['y']+rect['height']<=b['y'] or b['y']+b['height']<=rect['y'],(rect,b)
 page.evaluate('renderSnapshot()');page.screenshot(path=str(out/'gather-button.png'),animations='disabled');button.click()
 assert not page.locator('.gather-context').is_visible();assert page.locator('.gather-head-progress').is_visible();assert page.locator('.gather-context progress').count()==0
 head=page.evaluate('''()=>{const g=window.__ETERNA__,h=document.querySelector('.gather-head-progress'),p=g.hero.position.clone();p.y+=1.8;p.project(g.camera);return {x:parseFloat(h.style.left),y:parseFloat(h.style.top),expectedX:(p.x+1)*.5*844,expectedY:(1-p.y)*.5*390,width:h.getBoundingClientRect().width,height:h.getBoundingClientRect().height}}''');assert abs(head['x']-head['expectedX'])<1 and abs(head['y']-head['expectedY'])<1,head;assert head['width']<=70 and head['height']<=12,head
 page.evaluate('step(15)');assert page.evaluate('window.__ETERNA__.phase2Gathering.working');page.evaluate('renderSnapshot()');page.screenshot(path=str(out/'head-progress-only.png'),animations='disabled');page.evaluate('step(16)')
 complete=page.evaluate('''()=>{const s=window.__ETERNA__.phase2Gathering;return {working:s.working,delta:s.stock[window.gatherKind]-window.beforeStock,headHidden:document.querySelector('.gather-head-progress').hidden}}''');assert complete=={'working':False,'delta':1,'headHidden':True},complete
 print('WEAPON SKIN PRIORITY, ONE SOCKET, PERSISTENCE',flush=True)
 page.evaluate("()=>{const g=window.__ETERNA__;g.progress.owned.push('relic-warlock-3');g.adventureAction('cosmetic',{id:'relic-warlock-3'});step(2)}")
 page.wait_for_function('window.__ETERNA__.hero.rig.glbWeapons.length===1',timeout=60000,polling=100)
 weapon=page.evaluate('''()=>{const g=window.__ETERNA__,r=g.hero.rig,s=r.root.getObjectByName('WeaponHandSocket');g.save();return {pack:r.weaponPackId,children:s.children.length,saved:JSON.parse(localStorage.getItem('eterna-ninefold-save-v1')).progress.equipped.weapon}}''');assert weapon=={'pack':'relic-warlock-3','children':1,'saved':'relic-warlock-3'},weapon
 print('REAL BASE MOUNT, SWAP WHILE RIDING, CLEAN DISMOUNT',flush=True)
 page.wait_for_function('window.__ETERNA__.companions.mountRig.loadedModel',timeout=60000,polling=100);page.evaluate('window.__ETERNA__.companions.toggleMount();step(2)')
 mount=page.evaluate('''()=>{const g=window.__ETERNA__,c=g.companions;return {mounted:g.hero.mounted,parent:g.hero.rig.root.parent===c.mountRig.saddle,clips:c.mountRig.imported.animationCount,model:c.mountRig.imported.name}}''');assert mount['mounted'] and mount['parent'] and mount['clips']>0,mount
 page.evaluate("()=>{const g=window.__ETERNA__;g.progress.owned.push('steed-glacial');g.adventureAction('cosmetic',{id:'steed-glacial'});step(1)}");page.wait_for_function('window.__ETERNA__.companions.mountRig.loadedModel',timeout=60000,polling=100);page.evaluate('step(3)')
 swapped=page.evaluate('''()=>{const g=window.__ETERNA__,r=g.companions.mountRig;return {mounted:g.hero.mounted,parent:g.hero.rig.root.parent===r.saddle,model:r.imported.name,clips:r.imported.animationCount}}''');assert swapped['mounted'] and swapped['parent'] and swapped['model']=='Creature_stag' and swapped['clips']>0,swapped
 page.evaluate('window.__ETERNA__.companions.toggleMount();step(1)');assert page.evaluate('window.__ETERNA__.hero.rig.root.parent===window.__ETERNA__.hero.model')
 print('COMPACT NONBLOCKING NOTIFICATIONS',flush=True)
 notice=page.evaluate('''()=>{const g=window.__ETERNA__;for(let i=0;i<8;i++)g.hud.notify('Recompensa coletada e progresso de missão confirmado '+i);for(let i=0;i<25;i++)g.massacre.kill();g.fieldHUD.update(1,g.activities,g.massacre,g.hero,g.camera,g.enemies);return [...document.querySelectorAll('.game-toast')].map(n=>({height:n.getBoundingClientRect().height,pointer:getComputedStyle(n).pointerEvents}))}''');assert len(notice)<=2 and all(n['height']<=24 and n['pointer']=='none' for n in notice),notice
 page.screenshot(path=str(out/'compact-notifications.png'),animations='disabled')
 assert not errors,errors;(out/'gameplay-report.json').write_text(json.dumps({'gather':gather,'button':rect,'head':head,'completion':complete,'weapon':weapon,'mount':mount,'swappedMount':swapped,'notifications':notice,'errors':errors,'note':'Actual local Engine interactions, manual bounded frames and renderer stub in the loop, with single real WebGL captures of gathering. Separate preview audit renders real production GLBs for 50 swaps. No online accounts modified.'},indent=2));browser.close();print('PASS',flush=True)
