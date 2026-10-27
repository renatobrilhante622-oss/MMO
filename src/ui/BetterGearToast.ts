import type {InventoryAndLoot} from '../rpg/InventoryAndLoot';
import {equipmentImprovement} from '../rpg/EquipmentFeedback';
import {itemIcon} from './ItemIconRenderer';
export class BetterGearToast {
  readonly root=document.createElement('button');
  private itemId='';
  private expires=0;
  constructor(host:HTMLElement,private readonly inv:InventoryAndLoot,private readonly equip:(id:string)=>boolean,private readonly language:()=> 'pt'|'en') {
    this.root.className='better-gear-toast';this.root.type='button';this.root.hidden=true;host.append(this.root);
    this.root.onclick=()=>{
      if(!this.itemId||equipmentImprovement(this.inv,this.itemId)<=0){this.clear();return;}
      if(this.equip(this.itemId))this.clear();
    };
  }
  offer(id:string):void {if(equipmentImprovement(this.inv,id)>equipmentImprovement(this.inv,this.itemId)){this.itemId=id;this.expires=20;}}
  update(dt:number,active:boolean):void {
    this.expires=Math.max(0,this.expires-(active?dt:0));
    const item=this.inv.items.find(i=>i.id===this.itemId),delta=equipmentImprovement(this.inv,this.itemId);
    if(!item||!delta||!this.expires){this.clear();return;}
    this.root.hidden=!active;
    if(this.root.dataset.item!==this.itemId||this.root.dataset.delta!==String(delta)||this.root.lang!==this.language()){
      this.root.dataset.item=this.itemId;this.root.dataset.delta=String(delta);this.root.lang=this.language();
      const icon=document.createElement('span');icon.innerHTML=itemIcon(item.slot==='weapon'?'sword':item.slot==='armor'?'armor':item.slot==='helmet'?'helmet':item.slot==='boots'?'boots':'ring',item.rarity,item.name);
      const label=document.createElement('span');label.textContent=(this.language()==='pt'?'⬆ Equipar item mais forte':'⬆ Equip stronger item')+` (+${delta} CP)`;
      this.root.replaceChildren(icon,label);this.root.title=item.name+' +'+item.upgrade;
    }
  }
  clear():void{this.itemId='';this.expires=0;this.root.hidden=true;}
  dispose():void{this.root.remove();}
}
