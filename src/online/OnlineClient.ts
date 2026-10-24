export interface OnlineView {
  self:{id:string;name:string;level:number;coins:number;rating:number;wins:number;losses:number;items:Array<{id:string;name:string;rarity:number}>;clan:string|null;bossAttackAt:number;clanMarks?:number};
  queue:{size:number}|null;waiting:Array<{size:number;count:number}>;
  match:{id:string;ended:number;started:number;winner:number|null;fighters:Array<{id:string;name:string;team:number;hp:number;maxHp:number;energy:number}>;log:string[]}|null;
  clans:Array<{id:string;name:string;count:number}>;
  clan:{id:string;name:string;bossHp:number;week:string;members:Array<{id:string;name:string;role:string;level:number}>;contributors:string[];damage?:Record<string,number>;level?:number}|null;
  listings:Array<{id:string;seller:string;sellerName:string;price:number;item:{id:string;name:string;rarity:number}}>;
  serverTime:number;
}
export class OnlineClient {
  view:OnlineView|null=null;
  error='';
  busy=false;
  private token='';
  endpoint='';
  constructor(){try{this.endpoint=localStorage.getItem('eterna-server')??'';this.token=localStorage.getItem('eterna-online-session:'+this.endpoint)??'';}catch{/* Private browsing can deny storage. */}}
  get connected():boolean{return !!this.view;}
  configure(endpoint:string):void {
    const clean=endpoint.trim().replace(/\/$/,'');
    if(clean){const url=new URL(clean);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/')throw new Error('Use an HTTP(S) origin without a path.');}
    this.endpoint=clean;this.view=null;try{localStorage.setItem('eterna-server',clean);this.token=localStorage.getItem('eterna-online-session:'+clean)??'';}catch{this.token='';}
  }
  async create(name:string):Promise<void>{await this.request('/session',{name},true);}
  async refresh():Promise<void>{if(!this.token)return;await this.request('/state');}
  async action(path:string,body:Record<string,unknown>={}):Promise<void>{await this.request(path,body);}
  private async request(path:string,body?:Record<string,unknown>,session=false):Promise<void>{
    if(this.busy)return;this.busy=true;this.error='';
    try{
      const response=await fetch(this.endpoint+'/api'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(!session&&this.token?{Authorization:'Bearer '+this.token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Online server unavailable.');
      if(session&&typeof data.token==='string'){this.token=data.token;try{localStorage.setItem('eterna-online-session:'+this.endpoint,this.token);}catch{/* Current session still works. */}}
      this.view=data as OnlineView;
    }catch(error){this.error=error instanceof Error?error.message:'Connection failed.';if(path==='/state'&&this.error.includes('Session'))this.token='';}
    finally{this.busy=false;}
  }
}
