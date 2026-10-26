/** Real HTTP clients against an isolated development server; no test tokens are printed. */
import assert from 'node:assert/strict';
const endpoint=process.env.PVP_SERVER??'http://127.0.0.1:8791';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function api(token,path,body){const r=await fetch(endpoint+'/api/'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,200,v.error);return v;}
const report=[];
for(const size of [1,2,3]){
 const sessions=await Promise.all(Array.from({length:size*2},(_,i)=>api(null,'session',{name:`HTTP ${size} ${i} ${Date.now()%100000}`,classId:i%2?'ranger':'berserker'})));
 await Promise.all(sessions.map(s=>api(s.token,'pvp/queue',{size,cp:999999,level:100})));
 let views=await Promise.all(sessions.map(s=>api(s.token,'pvp/state')));const match=views[0].pvp.match;
 assert.equal(match.fighters.length,size*2);assert.ok(match.fighters.every(f=>!f.bot&&f.level===1&&f.cp===535));assert.equal(match.ranked,true);
 await Promise.all(sessions.map(s=>api(s.token,'pvp/accept',{})));await Promise.all(sessions.map(s=>api(s.token,'pvp/ready',{})));
 await wait(3150);views=await Promise.all(sessions.map(s=>api(s.token,'pvp/state')));assert.equal(views[0].pvp.match.phase,'active');
 const first=views[0].pvp.match.fighters.find(f=>f.id===sessions[0].self.id),before=first.x;
 for(let seq=1;seq<=10;seq++){await Promise.all(sessions.map(s=>api(s.token,'pvp/input',{seq,moveX:.5,moveZ:0,aimX:0,aimZ:-1,attack:true,skill:seq===1?0:null,dash:false,potion:null,hp:99999,x:99999})));await wait(75);}
 views=await Promise.all(sessions.map(s=>api(s.token,'pvp/state')));const moved=views[0].pvp.match.fighters.find(f=>f.id===first.id);assert.ok(moved.x>before+.5);assert.ok(moved.x<24);assert.ok(moved.hp<=moved.maxHp);assert.ok(moved.cooldowns[0]>0);
 const losers=sessions.filter(s=>match.fighters.find(f=>f.id===s.self.id).team!==first.team);
 await Promise.all(losers.map(s=>api(s.token,'pvp/leave',{})));await wait(150);
 const result=await api(sessions[0].token,'pvp/state');assert.equal(result.pvp.match.phase,'ended');assert.equal(result.self.rating,1025);assert.equal(result.self.coins,135);
 const duplicate=await api(sessions[0].token,'pvp/state');assert.equal(duplicate.self.rating,1025);assert.equal(duplicate.self.coins,135);
 await Promise.all(sessions.map(s=>api(s.token,'pvp/leave',{})));report.push({mode:`${size}v${size}`,humans:match.fighters.length,movementValidated:true,forgedStatsIgnored:true,winRating:25,rewardOnce:true});
}
const solo=await api(null,'session',{name:'Fallback '+Date.now()%100000,classId:'warlock'});await api(solo.token,'pvp/queue',{size:3});await wait(5200);const fallback=await api(solo.token,'pvp/state');assert.equal(fallback.pvp.match.fighters.filter(f=>f.bot).length,5);assert.equal(fallback.pvp.match.ranked,false);assert.equal(fallback.self.rating,1000);await api(solo.token,'pvp/leave',{});
console.log(JSON.stringify({modes:report,fallback:{humans:1,bots:5,ranked:false},protocol:'30Hz authoritative simulation / HTTP input and snapshots'},null,2));
