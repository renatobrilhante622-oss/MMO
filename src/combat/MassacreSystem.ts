export const MASSACRE_TIERS=[{kills:10,bonus:.1,name:'MASSACRE'},{kills:25,bonus:.25,name:'EXTERMÍNIO'},{kills:50,bonus:.5,name:'ANIQUILAÇÃO'},{kills:100,bonus:1,name:'DEUS DA GUERRA!'}] as const;
/** Open-world deaths only. Reward markers aren't enemies and cannot extend their own streak. */
export class MassacreSystem {
 kills=0;remaining=0;private nextChest=50;
 get bonus():number{return [...MASSACRE_TIERS].reverse().find(t=>this.kills>=t.kills)?.bonus??0;}
 get label():string{return [...MASSACRE_TIERS].reverse().find(t=>this.kills>=t.kills)?.name??'SEQUÊNCIA';}
 kill():boolean {if(this.remaining<=0)this.reset();this.kills++;this.remaining=20;const spawn=this.kills>=this.nextChest;if(spawn)this.nextChest+=50;return spawn;}
 update(dt:number,alive=true):void{if(!alive){this.reset();return;}if(Number.isFinite(dt)&&dt>0)this.remaining=Math.max(0,this.remaining-Math.min(dt,60));if(this.remaining===0)this.reset();}
 reset():void{this.kills=0;this.remaining=0;this.nextChest=50;}
}
