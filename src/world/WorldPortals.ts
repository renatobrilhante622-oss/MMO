import {
  AdditiveBlending,Box3,DoubleSide,Group,Mesh,PerspectiveCamera,PlaneGeometry,
  ShaderMaterial,Vector3,type Object3D,type Scene
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {REGIONS} from './Regions';
import {travelPermission,type RegionTravelState} from './RegionTravel';

export interface PortalSite {id:string;destId:string;x:number;z:number;}
export function portalSites(currentId:string):PortalSite[]{
  if(currentId==='aurora')return REGIONS.filter(r=>r.id!=='aurora').map((r,i)=>({
    id:'portal-'+r.id,destId:r.id,
    x:[-17,17,-17,17][i],z:[8,8,32,32][i]
  }));
  const index=REGIONS.findIndex(r=>r.id===currentId);
  return [
    {id:'portal-return',destId:'aurora',x:10,z:18},
    ...(REGIONS[index+1]?[{id:'portal-next',destId:REGIONS[index+1].id,x:-14,z:18}]:[]),
  ];
}
const loader=new GLTFLoader();
let archPromise:ReturnType<typeof loader.loadAsync>|undefined;
function sharedArch(){
  if(!archPromise){
    archPromise=loader.loadAsync(import.meta.env.BASE_URL+'models/environment/Kenney_castle-kit_wall-doorway.glb');
    void archPromise.catch(()=>{archPromise=undefined;});
  }
  return archPromise;
}
interface PortalVisual {
  site:PortalSite;root:Group;label:HTMLDivElement;
  vortex:ShaderMaterial;arch?:Object3D;
}
/**
 * Authored CC0 3D masonry surrounds a dynamic shader-only interdimensional gate.
 * The DOM nameplate is projected from the physical 3D anchor every paint cycle.
 */
export class WorldPortals {
  readonly root=new Group();
  private readonly portals:PortalVisual[]=[];
  private disposed=false;
  private timer=0;
  private renderTime=0;
  private readonly scratch=new Vector3();
  private readonly button=document.createElement('button');
  private nearest:PortalVisual|null=null;
  constructor(private readonly scene:Scene,private readonly host:HTMLElement,
    private readonly regionId:string,private readonly ground:(x:number,z:number)=>number,
    private readonly state:()=>RegionTravelState,
    private readonly onEnter:(regionId:string)=>void,
    private readonly language:()=> 'pt'|'en'){
    this.root.name='Physical gates: '+regionId;
    scene.add(this.root);
    for(const site of portalSites(regionId)){
      const root=new Group();
      root.position.set(site.x,ground(site.x,site.z),site.z);
      root.name='Rune portal '+site.destId;
      const shader=new ShaderMaterial({
        transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
        uniforms:{uTime:{value:0},uOpen:{value:1}},
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uOpen;
        void main(){
          vec2 p=(vUv-.5)*2.;
          p.x*=.8;
          float r=length(p);
          float a=atan(p.y,p.x);
          float spiral=sin(a*7.-r*22.+uTime*2.5)*.5+.5;
          float flecks=pow(max(0.,sin(a*18.+r*35.-uTime*5.)),12.);
          float rim=exp(-abs(r-.82)*17.);
          float alpha=(1.-smoothstep(.7,.92,r))*.72 + rim*.36;
          vec3 shade=mix(vec3(.13,.025,.38),vec3(.31,.63,1.2),spiral);
          shade+=flecks*vec3(.55,.3,1.)+rim*vec3(.8,.5,1.);
          gl_FragColor=vec4(shade*1.7,alpha*uOpen);
        }`,
      });
      const vortex=new Mesh(new PlaneGeometry(3.45,4.6),shader);
      vortex.name='Animated gateway VFX';
      vortex.position.y=2.8;
      root.add(vortex);
      this.root.add(root);
      const label=document.createElement('div');
      label.className='physical-portal-plaque';
      label.hidden=true;
      label.setAttribute('role','note');
      this.host.append(label);
      const item:PortalVisual={root,label,site,vortex:shader};
      this.portals.push(item);
      void sharedArch().then(gltf=>{
        if(this.disposed)return;
        const copy=gltf.scene.clone(true);
        const bounds=new Box3().setFromObject(copy);
        if(bounds.isEmpty())return;
        const scale=6.7/Math.max(.001,bounds.max.y-bounds.min.y);
        copy.scale.setScalar(scale);
        copy.position.set(-bounds.getCenter(new Vector3()).x*scale,-bounds.min.y*scale,0);
        copy.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=false;}});
        root.add(copy);item.arch=copy;
      }).catch(e=>console.warn('Missing CC0 stone portal arch:',e));
    }
    this.button.type='button';
    this.button.className='physical-portal-enter';
    this.button.hidden=true;
    this.button.onclick=()=>this.interact();
    host.append(this.button);
  }
  update(dt:number,camera:PerspectiveCamera,hero:Vector3,active:boolean):void{
    if(this.disposed)return;
    this.renderTime+=Math.max(0,Math.min(.05,dt));
    for(const portal of this.portals)portal.vortex.uniforms.uTime.value=this.renderTime;
    this.timer+=dt;
    if(this.timer<.08)return;this.timer=0;
    const bounds=this.host.getBoundingClientRect();
    let chosen:PortalVisual|null=null;let closest=3.5;
    for(const portal of this.portals){
      const region=REGIONS.find(r=>r.id===portal.site.destId)!;
      const permission=travelPermission(region.id,this.state());
      const distance=Math.hypot(hero.x-portal.root.position.x,hero.z-portal.root.position.z);
      if(active&&distance<closest){closest=distance;chosen=portal;}
      this.scratch.copy(portal.root.position).add(new Vector3(0,7.4,0)).project(camera);
      const screen=this.scratch;
      const visible=distance<66&&screen.z>-1&&screen.z<1&&Math.abs(screen.x)<1&&Math.abs(screen.y)<1;
      portal.label.hidden=!visible;
      if(!visible)continue;
      portal.label.style.left=((screen.x+1)*.5*bounds.width)+'px';
      portal.label.style.top=((1-screen.y)*.5*bounds.height)+'px';
      portal.label.classList.toggle('blocked',!permission.ok);
      const translated=region.name[this.language()==='pt'?0:1];
      const state=permission.ok?'✓ Nível '+region.minLevel+'+':
        permission.reason==='level'?'🔒 Requer nível '+region.minLevel:
        '⛔ Em combate / masmorra';
      portal.label.replaceChildren();
      const name=document.createElement('strong');name.textContent='🌀 '+translated;
      const requirement=document.createElement('small');requirement.textContent=state;
      portal.label.append(name,requirement);
    }
    this.nearest=chosen;
    this.button.hidden=!chosen||!active;
    if(chosen){
      const dest=REGIONS.find(r=>r.id===chosen.site.destId)!;
      this.button.textContent='🌀 Entrar: '+dest.name[this.language()==='pt'?0:1];
    }
  }
  interact():boolean{
    if(this.disposed||!this.nearest)return false;
    const permission=travelPermission(this.nearest.site.destId,this.state());
    if(permission.ok)this.onEnter(this.nearest.site.destId);
    else this.button.textContent=permission.reason==='level'
      ?'🔒 Requer nível '+permission.region?.minLevel
      :'⛔ Teleporte bloqueado durante combate';
    return true;
  }
  dispose():void{
    this.disposed=true;this.nearest=null;this.root.removeFromParent();
    for(const item of this.portals){
      item.label.remove();
      item.vortex.dispose();
      const mesh=item.root.getObjectByName('Animated gateway VFX');
      if(mesh instanceof Mesh)mesh.geometry.dispose();
    }
    this.portals.length=0;
    this.button.remove();
  }
}
