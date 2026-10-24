import {HUD_KEYS,HUD_STORAGE_KEY,keepHudOnscreen,readHudLayout,type HudKey,type HudLayout,type HudPlacement} from './HudLayout';
const SELECTORS:Record<HudKey,string>={joystick:'.move-zone',combat:'.combat-controls',movement:'.movement-actions',minimap:'.map-card',vitals:'.hero-card',shortcuts:'.menu-dock',autofarm:'.autofarm-button'};
const NAMES:Record<HudKey,[string,string]>={joystick:['Joystick','Joystick'],combat:['Ataque e habilidades','Attack & skills'],movement:['Montaria, esquiva e pulo','Mount, dodge & jump'],minimap:['Minimapa','Minimap'],vitals:['Vida e mana','Health & mana'],shortcuts:['Atalhos','Shortcuts'],autofarm:['Auto-Farm','Auto-Farm']};
/** Each control retains its original input handlers. Editing intercepts pointer events in capture phase. */
export class HudEditor {
  active=false;
  private layout:HudLayout={};
  private saved:HudLayout={};
  private defaults:HudLayout={};
  private elements=new Map<HudKey,HTMLElement>();
  private sizes=new Map<HudKey,{width:number;height:number}>();
  private selected:HudKey='combat';
  private overlay?:HTMLDivElement;
  private drag:{key:HudKey;id:number;x:number;y:number;placement:HudPlacement}|null=null;
  private readonly abort=new AbortController();
  private initialized=false;
  constructor(private readonly container:HTMLElement,private readonly language:()=> 'pt'|'en',private readonly onFinish:()=>void){
    try{
      const current=localStorage.getItem(HUD_STORAGE_KEY),v3=localStorage.getItem('eterna-hud-layout-v3');
      this.saved=readHudLayout(JSON.parse(current??v3??localStorage.getItem('eterna-hud-layout-v2')??'{}'));
      // The new drawer has a smaller anchor than the previous shortcut row.
      // Retain custom combat controls while returning this changed anchor to the screen edge.
      if(!current){delete this.saved.shortcuts;if(!v3)delete this.saved.autofarm;}
    }catch{/* Invalid storage uses the repository layout. */}
    const options={capture:true,signal:this.abort.signal};
    container.addEventListener('click',event=>{if(this.active&&!(event.target as Element).closest('.hud-editor-toolbar')){event.preventDefault();event.stopImmediatePropagation();}},options);
    container.addEventListener('pointerdown',this.down,options);container.addEventListener('pointermove',this.move,options);container.addEventListener('pointerup',this.up,options);container.addEventListener('pointercancel',this.up,options);
    window.addEventListener('resize',()=>{if(this.initialized)this.apply();},{signal:this.abort.signal});
    window.addEventListener('keydown',event=>{if(!this.active)return;if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.cancel();}else if(!(event.target as Element).closest('.hud-editor-toolbar')){event.preventDefault();event.stopImmediatePropagation();}},options);
  }
  initialize():void {
    if(this.initialized)return;this.initialized=true;
    for(const key of HUD_KEYS){const el=this.container.querySelector<HTMLElement>(SELECTORS[key]);if(!el)continue;this.elements.set(key,el);el.dataset.hudEditKey=key;
      const hidden=el.hidden;el.hidden=false;const rect=el.getBoundingClientRect(),width=el.offsetWidth||140,height=el.offsetHeight||60;el.hidden=hidden;this.sizes.set(key,{width,height});
      this.defaults[key]={x:rect.left/innerWidth,y:rect.top/innerHeight,scale:1,opacity:1};
    }
    this.layout={...structuredClone(this.defaults),...structuredClone(this.saved)};
    // Preserve responsive CSS until a layout has actually been saved or edited.
    if(Object.keys(this.saved).length)this.apply();
  }
  enter():void {
    this.initialize();this.active=true;this.saved=structuredClone(this.layout);this.drag=null;
    this.overlay=document.createElement('div');this.overlay.className='hud-editor-overlay';this.container.append(this.overlay);
    for(const [key,el] of this.elements){el.classList.add('hud-edit-target');el.dataset.hudEditLabel=NAMES[key][this.language()==='pt'?0:1];}
    const auto=this.elements.get('autofarm');if(auto)auto.hidden=false;
    this.apply();this.select(this.selected);this.toolbar();
  }
  private toolbar():void {
    if(!this.overlay)return;const pt=this.language()==='pt',value=this.layout[this.selected]!;
    this.overlay.innerHTML=`<div class="hud-editor-toolbar" role="dialog" aria-label="${pt?'Editor de HUD':'HUD editor'}"><select aria-label="${pt?'Controle selecionado':'Selected control'}" data-hud-selection>${HUD_KEYS.map(k=>`<option value="${k}" ${k===this.selected?'selected':''}>${NAMES[k][pt?0:1]}</option>`).join('')}</select><label>${pt?'Tamanho':'Size'}<input data-hud-scale type="range" min=".5" max="1.5" step=".05" value="${value.scale}"><output data-scale-output>${Math.round(value.scale*100)}%</output></label><label>${pt?'Opacidade':'Opacity'}<input data-hud-opacity type="range" min=".2" max="1" step=".05" value="${value.opacity}"><output data-opacity-output>${Math.round(value.opacity*100)}%</output></label><button data-hud-drag style="touch-action:none">✥ ${pt?'Arrastar selecionado':'Drag selected'}</button><button data-hud-reset>${pt?'Resetar padrão':'Reset default'}</button><button data-hud-save>${pt?'Salvar layout da HUD':'Save HUD layout'}</button><button data-hud-cancel aria-label="${pt?'Cancelar':'Cancel'}">×</button></div><div class="hud-editor-hint">${pt?'Arraste cada controle. As posições são ajustadas à orientação da tela.':'Drag each control. Positions adapt to screen orientation.'}</div>`;
    this.overlay.querySelector<HTMLSelectElement>('[data-hud-selection]')!.onchange=e=>{this.select((e.target as HTMLSelectElement).value as HudKey);this.toolbar();};
    this.overlay.querySelector<HTMLInputElement>('[data-hud-scale]')!.oninput=e=>{this.layout[this.selected]!.scale=Number((e.target as HTMLInputElement).value);this.apply();this.overlay!.querySelector('[data-scale-output]')!.textContent=Math.round(this.layout[this.selected]!.scale*100)+'%';};
    this.overlay.querySelector<HTMLInputElement>('[data-hud-opacity]')!.oninput=e=>{this.layout[this.selected]!.opacity=Number((e.target as HTMLInputElement).value);this.apply();this.overlay!.querySelector('[data-opacity-output]')!.textContent=Math.round(this.layout[this.selected]!.opacity*100)+'%';};
    this.overlay.querySelector<HTMLButtonElement>('[data-hud-reset]')!.onclick=()=>{this.layout[this.selected]=structuredClone(this.defaults[this.selected]!);this.apply();this.toolbar();};
    this.overlay.querySelector<HTMLButtonElement>('[data-hud-save]')!.onclick=()=>this.save();this.overlay.querySelector<HTMLButtonElement>('[data-hud-cancel]')!.onclick=()=>this.cancel();
  }
  private select(key:HudKey):void {this.selected=key;for(const [id,el]of this.elements)el.classList.toggle('hud-edit-selected',id===key);}
  private readonly down=(event:PointerEvent):void=>{
    const grip=(event.target as Element).closest('[data-hud-drag]');
    if(!this.active||(!grip&&(event.target as Element).closest('.hud-editor-toolbar')))return;
    const target=grip?this.elements.get(this.selected):(event.target as Element).closest<HTMLElement>('[data-hud-edit-key]');if(!target)return;
    const key=target.dataset.hudEditKey as HudKey;event.preventDefault();event.stopImmediatePropagation();this.select(key);if(!grip)this.toolbar();
    this.drag={key,id:event.pointerId,x:event.clientX,y:event.clientY,placement:{...this.layout[key]!}};target.setPointerCapture(event.pointerId);
  };
  private readonly move=(event:PointerEvent):void=>{
    if(!this.active||!this.drag||this.drag.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();
    const p=this.drag.placement;this.layout[this.drag.key]={...p,x:p.x+(event.clientX-this.drag.x)/innerWidth,y:p.y+(event.clientY-this.drag.y)/innerHeight};this.apply();
  };
  private readonly up=(event:PointerEvent):void=>{if(!this.active||!this.drag)return;event.preventDefault();event.stopImmediatePropagation();this.drag=null;};
  private apply():void {
    for(const [key,el]of this.elements){const size=this.sizes.get(key)!,p=keepHudOnscreen(this.layout[key]??this.defaults[key]!,size.width,size.height,innerWidth,innerHeight);this.layout[key]=p;el.classList.add('hud-custom-position');el.style.position='fixed';el.style.left=(p.x*innerWidth)+'px';el.style.top=(p.y*innerHeight)+'px';el.style.right='auto';el.style.bottom='auto';el.style.width=size.width+'px';el.style.height=size.height+'px';el.style.transform='none';el.style.transformOrigin='top left';el.style.scale=String(p.scale);el.style.opacity=String(p.opacity);}
  }
  private finish():void {this.active=false;this.drag=null;this.overlay?.remove();this.overlay=undefined;for(const el of this.elements.values())el.classList.remove('hud-edit-target','hud-edit-selected');this.onFinish();}
  save():void {try{localStorage.setItem(HUD_STORAGE_KEY,JSON.stringify(readHudLayout(this.layout)));this.saved=structuredClone(this.layout);this.finish();}catch{this.overlay?.querySelector('.hud-editor-hint')?.replaceChildren(document.createTextNode(this.language()==='pt'?'Armazenamento indisponível; layout ainda não foi salvo.':'Storage unavailable; layout has not been saved.'));}}
  cancel():void {this.layout=structuredClone(this.saved);this.apply();this.finish();}
  dispose():void {this.abort.abort();this.overlay?.remove();}
}
