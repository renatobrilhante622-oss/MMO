import {Group,Object3D,Vector3} from 'three';
export type WeaponSocketBone='righthand'|'lefthand'|'spine2'|'head';
/** One stable socket per bone. The asynchronous generation check also rejects stale loads. */
export class WeaponSkinSystem {
 private sockets=new Map<WeaponSocketBone,Group>();private generation=0;private disposed=false;
 constructor(private attach:(bone:string,node:Object3D,offset:Vector3)=>boolean,private detach:(node:Object3D)=>void,private release:(node:Object3D)=>void){}
 begin():number{this.clear();return this.generation;}
 valid(token:number):boolean{return !this.disposed&&token===this.generation;}
 install(token:number,bone:WeaponSocketBone,weapon:Object3D,offset=new Vector3()):boolean {
  if(!this.valid(token)){this.release(weapon);return false;}
  let socket=this.sockets.get(bone);
  if(!socket){socket=new Group();socket.name=bone==='righthand'?'WeaponHandSocket':bone==='lefthand'?'WeaponHandSocket.Left':'WeaponAccessorySocket.'+bone;
   if(!this.attach(bone,socket,offset)){this.release(weapon);return false;}this.sockets.set(bone,socket);
  }
  for(const previous of [...socket.children])this.release(previous);
  socket.add(weapon);return true;
 }
 clear():void{this.generation++;for(const socket of this.sockets.values())for(const child of [...socket.children])this.release(child);}
 dispose():void{if(this.disposed)return;this.clear();this.disposed=true;for(const socket of this.sockets.values())this.detach(socket);this.sockets.clear();}
 get visibleWeapons():number{return [...this.sockets.values()].reduce((n,s)=>n+s.children.length,0);}
}
/** A skin wins only if owned and compatible. Otherwise the inventory visual wins. */
export function resolveWeaponVisual(skin:string,item:string|undefined,classId:string,owned:readonly string[]):string {
 if(skin!=='ironweapon'&&owned.includes(skin)){
  const matched=/^(?:relic|armory)-([a-z]+)-[0-5]$/.exec(skin);if(!matched||matched[1]===classId)return skin;
 }
 return item??'ironweapon';
}
