import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,Group,Points,PointsMaterial,PointLight,Scene,Vector3} from 'three';
/** Five authored-biome palettes with animated world-space particles; one draw call per region. */
export const WEATHER_REGIONS={
 aurora:{color:0xf6d994,count:155,speed:.36,direction:-1,name:'Pétalas e Pólen'},
 crypt:{color:0x8b8091,count:225,speed:.27,direction:1,name:'Cinza e Névoa'},
 highlands:{color:0xdceeff,count:280,speed:.82,direction:-1,name:'Nevasca Suave'},
 rift:{color:0xff8c38,count:220,speed:.68,direction:1,name:'Fagulhas Vulcânicas'},
 eclipse:{color:0xae77ff,count:280,speed:.61,direction:-1,name:'Chuva Astral'},
} as const;
export type WeatherRegion=keyof typeof WEATHER_REGIONS;
export class RegionalWeather{
 readonly root=new Group();
 private points?:Points<BufferGeometry,PointsMaterial>;
 private lightning?:PointLight;
 private region:WeatherRegion='aurora';
 private time=0;
 constructor(private readonly scene:Scene){
   this.root.name='Regional particles: five independent weather biomes';
   scene.add(this.root);this.setRegion('aurora');
 }
 setRegion(id:string):void{
  const next=id in WEATHER_REGIONS?id as WeatherRegion:'aurora';if(this.points&&this.region===next)return;
  this.region=next;this.points?.geometry.dispose();this.points?.material.dispose();this.points?.removeFromParent();
  this.lightning?.removeFromParent();
  const cfg=WEATHER_REGIONS[next],n=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?Math.floor(cfg.count*.60):cfg.count;
  const a=new Float32Array(n*3);
  for(let i=0;i<n;i++){
   const p=i*3;a[p]=(Math.sin(i*19.145+n)*.5)*48;a[p+1]=(i*79%151)/151*16;a[p+2]=(Math.cos(i*8.235-n)*.5)*48;
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(a,3));
  const material=new PointsMaterial({color:new Color(cfg.color),size:next==='highlands'?.13:.09,transparent:true,opacity:next==='crypt'?.54:.88,depthWrite:false,sizeAttenuation:true,blending:AdditiveBlending});
  this.points=new Points(geometry,material);this.points.name=cfg.name;this.points.frustumCulled=false;
  this.root.add(this.points);
  if(next==='eclipse'){
    this.lightning=new PointLight(0x9f7cff,0,60,2);this.lightning.position.set(0,15,0);this.root.add(this.lightning);
  }
 }
 update(dt:number,origin:Vector3):void{
  if(!this.points)return;
  this.time+=dt;this.root.position.copy(origin);this.root.position.y-=2;
  const cfg=WEATHER_REGIONS[this.region],p=this.points.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   let y=p.getY(i)+cfg.direction*cfg.speed*dt*(.8+i%7*.07);
   if(y<0)y=16;if(y>16)y=0;
   p.setY(i,y);
   const x=p.getX(i)+Math.sin(this.time*.7+i)*.003;
   p.setX(i,x>24?-24:x<-24?24:x);
  }p.needsUpdate=true;
  if(this.lightning){
   const pulse=Math.sin(this.time*2.83)*Math.sin(this.time*1.37);
   this.lightning.intensity=pulse>.91?28:0;
  }
 }
 dispose():void{
  this.points?.geometry.dispose();this.points?.material.dispose();this.root.removeFromParent();
  this.lightning?.dispose();
 }
}
