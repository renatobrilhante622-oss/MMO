import {AdditiveBlending,BufferGeometry,Color,Float32BufferAttribute,Group,IcosahedronGeometry,Mesh,MeshBasicMaterial,PerspectiveCamera,Points,PointsMaterial,Scene,TorusGeometry,WebGLRenderer} from 'three';
import type {Rarity} from '../core/GameTypes';
import {RARITIES,RARITY_COLORS} from '../rpg/InventoryAndLoot';
import {itemIcon,type IconKind} from './ItemIconRenderer';
export interface GachaPrize {name:string;rarity:Rarity;kind:IconKind;duplicate:boolean;}
/** Rewards are committed before playback. Closing/replaying never rolls or grants a second reward. */
export class GachaCutscene {
  readonly root=document.createElement('section');
  private renderer?:WebGLRenderer;
  private scene?:Scene;
  private orb?:Group;
  private motes?:Points;
  private camera=new PerspectiveCamera(45,1,.1,40);
  private frame=0;
  private started=0;
  private revealTimer=0;
  private prizes:GachaPrize[]=[];
  private revealed=false;
  private banner='skin';
  get blocking():boolean{return !this.root.hidden;}
  constructor(container:HTMLElement,private summon:(count:1|10,banner:string)=>GachaPrize[]|null,private affordable:(count:1|10)=>boolean){this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.className='expansion-modal gacha-cinema';this.root.hidden=true;container.append(this.root);this.root.onclick=e=>{const b=(e.target as Element).closest<HTMLElement>('[data-gacha]');if(!b)return;const action=b.dataset.gacha;if(action==='close')this.close();else if(action==='skip')this.reveal();else this.open(Number(action)===10?10:1,this.banner);};}
  open(count:1|10,banner:string):boolean {
    const prizes=this.summon(count,banner);if(!prizes)return false;this.cleanupScene();this.prizes=prizes;this.banner=banner;this.root.hidden=false;this.revealed=false;
    this.root.innerHTML='<div class="gacha-stage" aria-label="Esfera de invocação 3D"></div><button class="gacha-skip" data-gacha="skip">Pular animação / Skip</button><div class="gacha-reveal" aria-live="polite"></div>';
    try{this.buildScene();}catch{this.root.querySelector('.gacha-stage')!.innerHTML='<div class="gacha-fallback-orb"></div>';}
    this.started=performance.now();this.frame=requestAnimationFrame(this.animate);this.revealTimer=window.setTimeout(()=>this.reveal(),2600);return true;
  }
  private buildScene():void {
    const renderer=this.renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);this.root.querySelector('.gacha-stage')!.append(renderer.domElement);
    const tier=Math.max(...this.prizes.map(p=>RARITIES.indexOf(p.rarity))),color=new Color(RARITY_COLORS[RARITIES[tier]]);this.root.style.setProperty('--gacha-color','#'+color.getHexString());
    const scene=this.scene=new Scene(),orb=this.orb=new Group();scene.add(orb);this.camera.position.z=5;
    orb.add(new Mesh(new IcosahedronGeometry(.8,3),new MeshBasicMaterial({color:color.clone().multiplyScalar(.25),transparent:true,opacity:.94})));
    orb.add(new Mesh(new IcosahedronGeometry(.84,1),new MeshBasicMaterial({color,wireframe:true,blending:AdditiveBlending})));
    for(let i=0;i<4;i++){const ring=new Mesh(new TorusGeometry(1+i*.07,.016,6,80),new MeshBasicMaterial({color,blending:AdditiveBlending}));ring.rotation.set(i*.7,i*.6,i);orb.add(ring);}
    const positions:number[]=[];for(let i=0;i<180;i++){const a=i*2.39996,r=1.2+(i%17)*.1;positions.push(Math.cos(a)*r,Math.sin(a)*r,Math.sin(i*1.7));}const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(positions,3));this.motes=new Points(geo,new PointsMaterial({color,size:.045,transparent:true,blending:AdditiveBlending}));scene.add(this.motes);renderer.render(scene,this.camera);
  }
  private readonly animate=(now:number):void=>{
    if(this.root.hidden||this.revealed)return;const t=Math.min(3,(now-this.started)/1000);if(this.orb&&this.scene&&this.renderer){this.orb.rotation.set(t*.4,t*t*3,t*.35);this.orb.scale.setScalar(1+Math.sin(t*18)*t*.025);if(this.motes)this.motes.rotation.z=-t*t*.6;this.renderer.render(this.scene,this.camera);}this.frame=requestAnimationFrame(this.animate);
  };
  private reveal():void {if(this.revealed||this.root.hidden)return;this.revealed=true;cancelAnimationFrame(this.frame);clearTimeout(this.revealTimer);this.root.classList.add('revealed');this.root.querySelector('.gacha-reveal')!.innerHTML=`<h2>INVOCAÇÃO / SUMMON</h2><div class="gacha-prizes">${this.prizes.map(p=>`<article style="--rarity:${RARITY_COLORS[p.rarity]}">${itemIcon(p.kind,p.rarity)}<b>${p.name}</b><small>${p.rarity}${p.duplicate?' · Fragmentos / Shards':''}</small></article>`).join('')}</div><footer><button data-gacha="close">Continuar / Continue</button><button data-gacha="1" ${this.affordable(1)?'':'disabled'}>Girar +1×</button><button data-gacha="10" ${this.affordable(10)?'':'disabled'}>Girar +10×</button></footer>`;}
  close():void{this.root.hidden=true;this.cleanupScene();}
  private cleanupScene():void {cancelAnimationFrame(this.frame);clearTimeout(this.revealTimer);this.root.classList.remove('revealed');this.scene?.traverse(o=>{if(o instanceof Mesh||o instanceof Points){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer=undefined;this.scene=undefined;this.orb=undefined;this.motes=undefined;}
  dispose():void{this.close();this.root.remove();}
}
