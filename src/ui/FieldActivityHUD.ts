import {Vector3,type PerspectiveCamera} from 'three';
import type {Combatant} from '../core/GameTypes';
import type {EnemyAI} from '../enemies/EnemyAI';
import type {OpenWorldActivities} from '../world/OpenWorldActivities';
import type {MassacreSystem} from '../combat/MassacreSystem';
import {patchLiveDOM} from './LiveDOM';
export class FieldActivityHUD {
 readonly root=document.createElement('section');private timer=0;private abort=new AbortController();private labels=new Map<string,HTMLElement>();
 constructor(private host:HTMLElement,private interact:()=>void,private navigate:(point:{x:number;z:number})=>void){
  this.root.className='field-hud';this.root.hidden=true;host.append(this.root);this.root.addEventListener('click',e=>{const button=(e.target as Element).closest<HTMLElement>('[data-field]');if(!button)return;if(button.dataset.field==='interact')this.interact();else this.navigate({x:Number(button.dataset.x),z:Number(button.dataset.z)});},{signal:this.abort.signal});
 }
 update(dt:number,activities:OpenWorldActivities|undefined,massacre:MassacreSystem,hero:Combatant,camera:PerspectiveCamera,enemies:EnemyAI):void {
  this.root.hidden=!activities;if(!activities){for(const label of this.labels.values())label.hidden=true;return;}
  this.timer-=dt;if(this.timer>0)return;this.timer=.15;
  const focus=activities.focused,r=activities.activeRift,buff=activities.progress;
  const state=focus?activities.state(focus.id):undefined,remaining=state?.mode==='defending'?Math.max(0,45-(buff.clock-state.started)):0;
  const hint=focus?.kind==='defense'?(state?.mode==='defending'?`⚔ ${Math.ceil(remaining)}s · Onda ${state.wave}/3`:'⚔ Ativar defesa · 45s'):focus?.kind==='camp'?`🎁 Acampamento · ${state?.members.size??0} guardas`:focus?.kind==='rare'?`✦ Extrair reagente · ${state?.members.size??0} guardas`:focus?.kind==='shrine'?'✦ Receber bênção · 3min':focus?.kind==='board'?'📜 Contratos de Caça':focus?.kind==='rift'?'⚡ Fenda Abissal':focus?.kind==='nest'?'⚔ Atacar Ninho Corrompido':'⌖ Investigar Ruínas';
  patchLiveDOM(this.root,`${massacre.kills>=10?`<aside class="massacre-meter"><strong>🔥 ${massacre.kills} KILLS · ${massacre.label}</strong><progress max="20" value="${massacre.remaining}"></progress><small>+${Math.round(massacre.bonus*100)}% XP / DROP</small></aside>`:''}${r?`<aside class="rift-alert"><strong>⚡ FENDA ABISSAL · ${r.wave}/4</strong><button data-field="navigate" data-x="${r.site.x}" data-z="${r.site.z}">⌖ Navegar</button></aside>`:''}${focus?`<button class="field-interact" data-field="interact">${hint} <kbd>E</kbd></button>`:''}<div class="field-buffs">${(['speed','critical','storm'] as const).filter(b=>buff.buffActive(b)).map(b=>`<span>${b==='speed'?'➟':b==='critical'?'⚔':'ϟ'} ${Math.ceil(buff.buffRemaining(b))}s</span>`).join('')}</div>`);
  const alive=new Set<string>();for(const e of enemies.enemies.filter(e=>e.elite&&e.alive&&e.position.distanceTo(hero.position)<50)){
   alive.add(e.id);let label=this.labels.get(e.id);if(!label){label=document.createElement('div');label.className='field-elite-label';label.textContent='💀 [ELITE] '+(e.activity?.kind==='rift'?'Demônio da Fenda':activities.state(e.activity?.id??'')?.site.name??'Capitão Corrompido');this.host.append(label);this.labels.set(e.id,label);}
   const p=e.position.clone().add(new Vector3(0,5.5,0)).project(camera);label.hidden=p.z< -1||p.z>1||Math.abs(p.x)>.94||Math.abs(p.y)>.9;if(!label.hidden){label.style.left=((p.x+1)*.5*this.host.clientWidth)+'px';label.style.top=((1-p.y)*.5*this.host.clientHeight)+'px';}
  }
  for(const [id,label]of this.labels)if(!alive.has(id)){label.remove();this.labels.delete(id);}
 }
 dispose():void{this.abort.abort();this.root.remove();this.labels.forEach(l=>l.remove());this.labels.clear();}
}
