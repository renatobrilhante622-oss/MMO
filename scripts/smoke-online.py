"""Readiness check against the running local development server; creates test profiles."""
import json,os,urllib.request,urllib.error
from concurrent.futures import ThreadPoolExecutor
base=os.environ.get('ETERNA_API','http://127.0.0.1:8787')+'/api'
def request(path,data=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=10) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def player(name):
 status,data=request('/session',{'name':name,'classId':'necromancer'});assert status==200;return data
for size in [1,2,3]:
 group=[player('HTTP '+str(size)+' '+str(i)) for i in range(size*2)]
 for profile in group:
  status,state=request('/queue',{'size':size},profile['token']);assert status==200
 assert state['match']['size']==size
 assert len(state['match']['fighters'])==size*2
 assert all(f['maxHp']==1200 for f in state['match']['fighters'])
 print(str(size)+'v'+str(size)+' real-session matchmaking: PASS')
a,b,c=[player('Trade HTTP '+str(i)) for i in range(3)]
status,state=request('/market/list',{'id':a['self']['items'][0]['id'],'price':50},a['token']);assert status==200
listing=next(l for l in state['listings'] if l['seller']==a['self']['id'])
with ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda profile:request('/market/buy',{'id':listing['id']},profile['token']),[b,c]))
assert sorted(status for status,_ in results)==[200,400]
status,state=request('/state',token=a['token']);assert state['self']['coins']==147
print('Concurrent escrow purchase and seller fee: PASS')
status,state=request('/clan/create',{'name':'HTTP Clan '+a['self']['id'][:6]},a['token']);assert status==200
clan=state['clan']['id']
assert request('/clan/join',{'id':clan},b['token'])[0]==200
assert request('/clan/role',{'id':a['self']['id'],'role':'member'},b['token'])[0]==400
assert request('/clan/role',{'id':b['self']['id'],'role':'officer'},a['token'])[0]==200
assert request('/clan/boss',{},b['token'])[0]==200
assert request('/clan/boss',{},b['token'])[0]==400
print('Clan hierarchy and raid cooldown over HTTP: PASS')
