export interface SandboxFighter {name:string;team:number;hp:number;maxHp:number;damage:number;}
/** Deliberately isolated: no online API, rank, inventory or clan currency is mutated. */
export class DevSandbox {
  readonly fighters:SandboxFighter[]=[];
  readonly log:string[]=[];
  ended=false;
  private turn=0;
  constructor(readonly mode:'clan'|1|2|3){
    if(mode==='clan'){this.fighters.push({name:'Boss semanal · simulação',team:1,hp:50000,maxHp:50000,damage:650});for(let i=0;i<6;i++)this.fighters.push({name:'Membro '+(i+1),team:0,hp:5000,maxHp:5000,damage:850});}
    else for(let team=0;team<2;team++)for(let i=0;i<mode;i++)this.fighters.push({name:(team?'Rival ':'Aliado ')+(i+1),team,hp:1200,maxHp:1200,damage:110+i*12});
  }
  step():void {
    if(this.ended)return;
    const living=this.fighters.filter(f=>f.hp>0),source=living[this.turn++%living.length],targets=living.filter(f=>f.team!==source.team);
    if(!targets.length){this.ended=true;return;}
    const target=targets[this.turn%targets.length],amount=Math.min(target.hp,source.damage+(this.turn%4===0?60:0));target.hp-=amount;this.log.push(`${source.name} → ${target.name}: ${amount}`);if(this.log.length>12)this.log.shift();
    this.ended=new Set(this.fighters.filter(f=>f.hp>0).map(f=>f.team)).size<2;
  }
}
