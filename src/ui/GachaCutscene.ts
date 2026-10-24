import {PrizePreview3D} from './PrizePreview3D';
import {prizeIcon,renderPrizeCards} from './ShopGachaUI';
import type {EquipmentSlot,Rarity} from '../core/GameTypes';
import {RARITIES,RARITY_COLORS} from '../rpg/InventoryAndLoot';
import {itemIcon,type IconKind} from './ItemIconRenderer';
export interface GachaPrize {name:string;rarity:Rarity;kind:IconKind;duplicate:boolean;cosmeticId?:string;itemId?:string;itemSlot?:EquipmentSlot;}
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
/** Single lightweight canvas: no extra WebGL context or live world underneath the cutscene. */
export class GachaCutscene {
  readonly root=document.createElement('section');
  private canvas?:HTMLCanvasElement;
  private frame=0;private started=0;private revealTimer=0;
  private prizes:GachaPrize[]=[];private revealed=false;private banner='skin';private selectedPrize=0;private preview?:PrizePreview3D;
  get blocking():boolean{return !this.root.hidden;}
  constructor(container:HTMLElement,private summon:(count:1|10,banner:string)=>GachaPrize[]|null,private affordable:(count:1|10)=>boolean,private readonly onClose?:()=>void){this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.className='expansion-modal gacha-cinema';this.root.hidden=true;container.append(this.root);this.root.onclick=e=>{const b=(e.target as Element).closest<HTMLElement>('[data-gacha]');if(!b)return;const action=b.dataset.gacha;if(action==='close')this.close();else if(action==='skip')this.reveal();else if(action==='preview')this.selectPrize(Number(b.dataset.index));else this.open(Number(action)===10?10:1,this.banner);};}
  open(count:1|10,banner:string):boolean {
    const prizes=this.summon(count,banner);if(!prizes)return false;this.cleanup();this.prizes=prizes;this.banner=banner;this.root.hidden=false;this.revealed=false;
    this.root.innerHTML='<div class="gacha-stage" aria-label="Altar rúnico de invocação"><canvas></canvas></div><button class="gacha-skip" data-gacha="skip">Pular animação</button><div class="gacha-reveal" aria-live="polite"></div>';
    this.canvas=this.root.querySelector('canvas')!;this.resize();window.addEventListener('resize',this.resize);this.started=performance.now();this.draw(0);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduced)this.frame=requestAnimationFrame(this.animate);this.revealTimer=window.setTimeout(()=>this.reveal(),reduced?400:2800);return true;
  }
  private readonly resize=():void=>{if(!this.canvas)return;const ratio=Math.min(window.devicePixelRatio||1,1.5);this.canvas.width=Math.round(innerWidth*ratio);this.canvas.height=Math.round(innerHeight*ratio);};
  private readonly animate=(now:number):void=>{if(this.root.hidden||this.revealed)return;this.draw(Math.min(3,(now-this.started)/1000));this.frame=requestAnimationFrame(this.animate);};
  private draw(t:number):void {
    const canvas=this.canvas,c=canvas?.getContext('2d');if(!canvas||!c)return;const ratio=canvas.width/innerWidth,w=innerWidth,h=innerHeight;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
    const tier=Math.max(...this.prizes.map(p=>RARITIES.indexOf(p.rarity))),color=RARITY_COLORS[RARITIES[tier]],x=w/2,y=h*.62,r=Math.min(w*.34,h*.35),charge=Math.min(1,t/2.4);
    const bg=c.createRadialGradient(x,y,5,x,y,r*2.4);bg.addColorStop(0,'#3e2458');bg.addColorStop(1,'#050b18');c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.save();c.translate(x,y+r*.45);c.scale(1,.34);c.rotate(t*(.4+charge));c.shadowColor=color;c.shadowBlur=14;
    for(let ring=0;ring<3;ring++){c.strokeStyle=ring===1?color:'#dfbd77';c.lineWidth=ring===1?4:2;c.beginPath();c.arc(0,0,r*(.64+ring*.17),0,Math.PI*2);c.stroke();}
    for(let i=0;i<16;i++){const a=i*Math.PI/8;c.save();c.rotate(a);c.translate(r*.83,0);c.rotate(Math.PI/2);c.strokeStyle='#f0d48e';c.lineWidth=2;c.beginPath();c.moveTo(-6,-8);c.lineTo(0,9);c.lineTo(7,-8);c.moveTo(-7,1);c.lineTo(7,1);c.stroke();c.restore();}
    c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI*2/5-Math.PI/2,px=Math.cos(a)*r*.6,py=Math.sin(a)*r*.6;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.strokeStyle='#aa83e3';c.stroke();c.restore();
    // A vertical light column converges on a solid, faceted ancestral crystal.
    const beam=c.createLinearGradient(x,0,x,y);beam.addColorStop(0,'#fff4d500');beam.addColorStop(.6,color+'35');beam.addColorStop(1,'#fff0b9bb');c.fillStyle=beam;c.beginPath();c.moveTo(x-r*.35,0);c.lineTo(x+r*.35,0);c.lineTo(x+14+charge*18,y);c.lineTo(x-14-charge*18,y);c.closePath();c.fill();
    c.save();c.translate(x+Math.sin(t*45)*charge*3,y-r*.36);const size=r*.32*(1+Math.sin(t*3)*.025),angle=Math.sin(t*1.2)*.08;c.rotate(angle);c.shadowColor=color;c.shadowBlur=25+charge*15;
    c.fillStyle=color;c.beginPath();c.moveTo(0,-size*1.3);c.lineTo(size*.7,-size*.35);c.lineTo(size*.48,size*.8);c.lineTo(0,size*1.2);c.lineTo(-size*.6,size*.6);c.lineTo(-size*.72,-size*.4);c.closePath();c.fill();c.shadowBlur=0;
    c.fillStyle='#ffffff77';c.beginPath();c.moveTo(0,-size*1.3);c.lineTo(-size*.18,size*.55);c.lineTo(-size*.72,-size*.4);c.closePath();c.fill();c.fillStyle='#1c193f88';c.beginPath();c.moveTo(0,-size*1.3);c.lineTo(size*.7,-size*.35);c.lineTo(size*.48,size*.8);c.lineTo(-size*.18,size*.55);c.closePath();c.fill();c.strokeStyle='#ffe4a3';c.lineWidth=2;c.beginPath();c.moveTo(-size*.7,-size*.4);c.lineTo(size*.7,-size*.35);c.moveTo(0,-size*1.3);c.lineTo(-size*.18,size*.55);c.lineTo(0,size*1.2);c.stroke();c.restore();
    c.fillStyle='#ffdfa3';for(let i=0;i<80+tier*12;i++){const phase=(i*.618+t*.25)%1,a=i*2.39996+t*.45,px=x+Math.cos(a)*r*(1-phase),py=y-phase*r*2;const alpha=Math.sin(phase*Math.PI)*(.25+charge*.5);c.globalAlpha=alpha;c.beginPath();c.arc(px,py,1+(i%3),0,Math.PI*2);c.fill();}c.globalAlpha=1;
    if(t>2.35){const flash=Math.max(0,1-Math.abs(t-2.55)*5);c.fillStyle=`rgba(255,236,208,${flash*.6})`;c.fillRect(0,0,w,h);}
  }
  private reveal():void {
    if(this.revealed||this.root.hidden)return;this.revealed=true;cancelAnimationFrame(this.frame);clearTimeout(this.revealTimer);this.root.classList.add('revealed');this.selectedPrize=0;this.renderResults();
  }
  private selectPrize(index:number):void {if(!this.revealed||!Number.isInteger(index)||index<0||index>=this.prizes.length)return;this.selectedPrize=index;this.renderResults();}
  private renderResults():void {
    const prize=this.prizes[this.selectedPrize];if(!prize)return;
    this.root.querySelector('.gacha-reveal')!.innerHTML=`<h2>INVOCAÇÃO ANCESTRAL</h2><div class="gacha-results-layout"><div class="gacha-prizes">${renderPrizeCards(this.prizes,this.selectedPrize)}</div><aside class="gacha-prize-preview"><div class="gacha-prize-preview-stage" data-prize-stage>${prizeIcon(prize)}</div><h3 style="color:${RARITY_COLORS[prize.rarity]}">${esc(prize.name)}</h3><p>Selecione um prêmio para ver sua prévia 3D.</p></aside></div><footer><button data-gacha="close">Continuar</button><button data-gacha="1" ${this.affordable(1)?'':'disabled'}>Invocar 1×</button><button data-gacha="10" ${this.affordable(10)?'':'disabled'}>Invocar 10×</button></footer>`;
    try{this.preview??=new PrizePreview3D();this.preview.mount(this.root.querySelector<HTMLElement>('[data-prize-stage]')!,prize);}catch{this.preview?.dispose();this.preview=undefined;/* The full SVG illustration remains available without WebGL. */}
  }
  close():void{const wasOpen=!this.root.hidden;this.root.hidden=true;this.cleanup();if(wasOpen)this.onClose?.();}
  private cleanup():void{cancelAnimationFrame(this.frame);clearTimeout(this.revealTimer);window.removeEventListener('resize',this.resize);this.root.classList.remove('revealed');this.canvas=undefined;this.preview?.pause();}
  dispose():void{this.close();this.preview?.dispose();this.preview=undefined;this.root.remove();}
}
