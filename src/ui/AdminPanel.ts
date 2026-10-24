import {DevSandbox} from './DevSandbox';
export interface AdminState {gold:number;crystals:number;diamonds:number;tickets:number;materials:number;level:number;god:boolean;noCooldown:boolean;oneHit:boolean;}
export class AdminPanel {
  readonly root=document.createElement('section');
  private simulator?:DevSandbox;
  private timer:number;
  get blocking():boolean{return !this.root.hidden;}
  constructor(container:HTMLElement,private state:()=>AdminState,private action:(action:string,value?:string)=>string){
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.className='expansion-modal admin-panel';this.root.hidden=true;container.append(this.root);
    this.root.onclick=e=>{const button=(e.target as Element).closest<HTMLElement>('[data-admin]');if(!button)return;const a=button.dataset.admin!;if(a==='close'){this.close();return;}if(a.startsWith('simulate')){this.simulator=new DevSandbox(a==='simulate-clan'?'clan':Number(a.slice(-1)) as 1|2|3);this.render('Simulação local iniciada; não altera o servidor online.');return;}const value=this.root.querySelector<HTMLSelectElement>('[name=admin-zone]')?.value;this.render(this.action(a,value));};
    this.timer=window.setInterval(()=>{if(this.blocking&&this.simulator&&!this.simulator.ended){this.simulator.step();this.paintSimulation();}},180);
  }
  open():void{this.root.hidden=false;this.render();}
  close():void{this.root.hidden=true;}
  private render(message=''):void {
    const s=this.state(),groups:[string,[string,string][]][]=[
      ['Recursos PvE locais',[['gold','+100.000 Ouro'],['crystals','+10.000 Cristais'],['diamonds','+5.000 Diamantes VIP'],['tickets','+100 Tickets'],['materials','+1.000 Materiais / Joias']]],
      ['Herói',[['level1','+1 Level'],['level10','+10 Levels'],['level100','Level 100'],['points','+50 Pontos de Epígrafo'],['cooldowns',s.noCooldown?'No CD: ON':'No CD: OFF'],['god',s.god?'God Mode: ON':'God Mode: OFF'],['onehit',s.oneHit?'One-Hit: ON':'One-Hit: OFF']]],
      ['Desbloqueios',[['premium','VIP + Passe Premium'],['unlock','Liberar coleção / evolução máxima'],['mythic','Equipamento Mítico +15 / 4 Joias']]],
      ['Spawner e testes',[['monster','Spawnar monstro'],['boss','Spawnar Field Boss'],['zone','Teleportar para zona'],['dungeon','Entrar na dungeon da zona'],['simulate-clan','Simular boss semanal do clã'],['simulate-1','PvP imediato 1×1 · teste'],['simulate-2','PvP imediato 2×2 · teste'],['simulate-3','PvP imediato 3×3 · teste']]],
    ];
    this.root.innerHTML=`<div class="expansion-window"><header><h2>⚙ ADMIN · GOD MODE</h2><button data-admin="close" aria-label="Fechar">×</button></header><div class="expansion-body"><p class="dev-scope">Ambiente de testes PvE local. Clã/PvP abaixo são simulações separadas das filas, contas e economia online.</p><div class="admin-wallet">Lv. ${s.level} · ◈ ${s.gold} · ◇ ${s.crystals} · VIP ${s.diamonds} · 🎟 ${s.tickets} · ⚒ ${s.materials}</div><p role="status">${message}</p><label>Zona <select name="admin-zone">${['aurora','lake','crypt','rift','highlands','eclipse'].map(id=>`<option>${id}</option>`).join('')}</select></label>${groups.map(([name,buttons])=>`<fieldset><legend>${name}</legend><div class="admin-buttons">${buttons.map(([id,label])=>`<button data-admin="${id}">${label}</button>`).join('')}</div></fieldset>`).join('')}<div data-sandbox></div></div></div>`;this.paintSimulation();
  }
  private paintSimulation():void {const host=this.root.querySelector('[data-sandbox]');if(!host||!this.simulator)return;const sim=this.simulator;host.innerHTML=`<h3>${sim.mode==='clan'?'Altar semanal':'Arena '+sim.mode+'×'+sim.mode} · ${sim.ended?'ENCERRADO':'SIMULAÇÃO LOCAL'}</h3><div class="sandbox-fighters">${sim.fighters.map(f=>`<div class="sandbox-team-${f.team}"><b>${f.name}</b><progress max="${f.maxHp}" value="${f.hp}"></progress><small>${f.hp}/${f.maxHp}</small></div>`).join('')}</div><pre>${sim.log.join('\n')}</pre>`;}
  dispose():void{clearInterval(this.timer);this.root.remove();}
}
