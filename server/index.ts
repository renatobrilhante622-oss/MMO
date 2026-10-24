import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { GameError, GameService, type Store } from './GameService';
const path=resolve(process.env.ETERNA_SERVER_DATA??'.cache/online/state.json');
let store:Store|undefined;
if(existsSync(path))store=JSON.parse(readFileSync(path,'utf8')) as Store;
const game=new GameService(Date.now,store);
function save(){mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',JSON.stringify(game.export()),{mode:0o600});renameSync(path+'.tmp',path);}
const rate=new Map<string,{time:number;count:number}>();
const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    const origin=req.headers.origin;
    const allowed=(process.env.ETERNA_ALLOWED_ORIGINS??'http://localhost,https://localhost,capacitor://localhost,http://localhost:5173,http://127.0.0.1:5173').split(',');
    if(origin){if(!allowed.includes(origin))throw new GameError('Origin not allowed.',403);res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
    if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
    const ip=req.socket.remoteAddress??'local',now=Date.now(),entry=rate.get(ip);
    if(!entry||now-entry.time>10000)rate.set(ip,{time:now,count:1});else if(++entry.count>150)throw new GameError('Too many requests.',429);
    if(rate.size>10000)for(const [key,value]of rate)if(now-value.time>60000)rate.delete(key);
    if(req.method==='GET'&&req.url==='/api/health'){res.end(JSON.stringify({ok:true,mode:'development',players:game.players.size}));return;}
    let body:Record<string,unknown>={};
    if(req.method==='POST'){
      let data='';for await(const chunk of req){data+=chunk;if(data.length>8192)throw new GameError('Request too large.',413);}
      try{const raw=JSON.parse(data||'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();body=raw;}catch{throw new GameError('Invalid JSON.');}
    }
    if(req.method==='POST'&&req.url==='/api/session'){
      const player=game.create(body.name);save();res.end(JSON.stringify({token:player.token,...game.view(player) as object}));return;
    }
    const auth=req.headers.authorization??'';const player=game.authenticate(auth.startsWith('Bearer ')?auth.slice(7):'');
    if(req.method==='POST'){
      switch(req.url){
        case '/api/queue':game.enqueue(player,body.size);break;
        case '/api/queue/cancel':game.cancel(player);break;
        case '/api/fight':game.fight(player,body.action,body.target);break;
        case '/api/clan/create':game.createClan(player,body.name);break;
        case '/api/clan/join':game.joinClan(player,body.id);break;
        case '/api/clan/role':game.role(player,body.id,body.role);break;
        case '/api/clan/leave':game.leaveClan(player);break;
        case '/api/clan/boss':game.boss(player);break;
        case '/api/clan/shop':game.clanShop(player);break;
        case '/api/clan/upgrade':game.clanUpgrade(player);break;
        case '/api/market/list':game.list(player,body.id,body.price);break;
        case '/api/market/buy':game.buy(player,body.id);break;
        case '/api/market/cancel':game.cancelListing(player,body.id);break;
        default:throw new GameError('Endpoint not found.',404);
      }
    }else if(req.method!=='GET'||req.url!=='/api/state')throw new GameError('Endpoint not found.',404);
    const view=game.view(player);save();res.end(JSON.stringify(view));
  }catch(error){res.statusCode=error instanceof GameError?error.status:500;res.end(JSON.stringify({error:error instanceof GameError?error.message:'Server operation failed.'}));if(!(error instanceof GameError))console.error(error);}
});
server.listen(Number(process.env.PORT??8787),process.env.ETERNA_SERVER_HOST??'127.0.0.1',()=>console.log('Eterna development server listening on port '+(process.env.PORT??8787)));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{save();server.close(()=>process.exit(0));});
