import {withinActorRadius} from '../core/RenderBudget';
import * as THREE from 'three';

interface Villager {
  root: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  path: THREE.Vector2[];
  destination: number;
  speed: number;
  clock: number;
  pause: number;
}

interface Torch {
  light: THREE.PointLight;
  phase: number;
  flame: THREE.Mesh;
}

/** Decorative simulation only: none of these actors participates in combat or physics. */
export class WorldLife {
  readonly root = new THREE.Group();
  private readonly villagers: Villager[] = [];
  private readonly torches: Torch[] = [];
  private readonly emitters: THREE.Vector3[] = [];
  private readonly materials = new Set<THREE.Material>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly uniforms = {
    time: { value: 0 },
    night: { value: 0 },
  };
  private readonly scratch = new THREE.Vector3();
  private ambient?: THREE.Points;
  private fire?: THREE.Points;
  private vortex?: THREE.Points;
  private elapsed = 0;
  private lowQuality = false;

  constructor(private readonly heightAt: (x: number, z: number) => number) {
    this.root.name = 'World life: villagers, embers, leaves, dust and fireflies';
  }

  private material(color: number, roughness = .8): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    this.materials.add(material);
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material,
    parent: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geometry);
    this.materials.add(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Model-space dimensions fit through the existing village doors. */
  createVillagers(): void {
    const routes = [
      [new THREE.Vector2(-5,7), new THREE.Vector2(-6,18), new THREE.Vector2(-7,25)],
      [new THREE.Vector2(5,8), new THREE.Vector2(7,19), new THREE.Vector2(6,29)],
      [new THREE.Vector2(-5,34), new THREE.Vector2(3,33), new THREE.Vector2(8,27)],
      [new THREE.Vector2(-8,4), new THREE.Vector2(0,-1), new THREE.Vector2(8,4)],
    ];
    const clothColors = [0x515b76,0x6e4a3b,0x52653d,0x654a6d];
    const skin = this.material(0xbe987b);
    const boots = this.material(0x322e2a);
    const belt = this.material(0x5b4632);
    const metal = this.material(0x96988c,.44);
    routes.forEach((route,index) => {
      const root = new THREE.Group();
      root.name = ['Village smith','Village alchemist','Stable keeper','Village sentinel'][index];
      const cloth = this.material(clothColors[index]);
      const torso = this.mesh(new THREE.CapsuleGeometry(.23,.42,6,14),cloth,root,0,1.02,0);
      torso.scale.z = .75;
      this.mesh(new THREE.CylinderGeometry(.255,.26,.11,8),belt,root,0,.83,0);
      this.mesh(new THREE.SphereGeometry(1,10,8),metal,root,0,.83,.2).scale.set(.07,.06,.025);
      const head = new THREE.Group();
      head.position.y = 1.57;
      root.add(head);
      this.mesh(new THREE.SphereGeometry(.16,16,12),skin,head,0,0,0);
      const hair = this.mesh(new THREE.SphereGeometry(.17,16,10,0,Math.PI*2,0,Math.PI*.6),belt,head,0,.035,0);
      hair.rotation.x = -.12;
      for (const sign of [-1,1]) {
        this.mesh(new THREE.SphereGeometry(.018,4,3),boots,head,sign*.067,.025,.16);
      }
      const arms: [THREE.Group,THREE.Group] = [new THREE.Group(),new THREE.Group()];
      const legs: [THREE.Group,THREE.Group] = [new THREE.Group(),new THREE.Group()];
      for (let side=0;side<2;side++) {
        const sign = side===0 ? -1:1;
        arms[side].position.set(sign*.29,1.30,0);
        root.add(arms[side]);
        this.mesh(new THREE.CapsuleGeometry(.075,.28,2,6),cloth,arms[side],0,-.19,0);
        this.mesh(new THREE.SphereGeometry(.075,6,5),skin,arms[side],0,-.43,0);
        legs[side].position.set(sign*.13,.77,0);
        root.add(legs[side]);
        this.mesh(new THREE.CapsuleGeometry(.09,.45,2,6),cloth,legs[side],0,-.27,0);
        this.mesh(new THREE.SphereGeometry(1,12,8),boots,legs[side],0,-.66,.075).scale.set(.095,.075,.16);
      }
      // An apron, satchel and shoulder collar establish readable occupations.
      if (index===0) this.mesh(new THREE.SphereGeometry(1,12,10),belt,root,0,.91,.20).scale.set(.18,.275,.05);
      if (index===1) {
        this.mesh(new THREE.SphereGeometry(.13,7,5),belt,root,.28,.85,0);
        this.mesh(new THREE.CylinderGeometry(.03,.03,.5,5),metal,root,-.33,.68,0).rotation.z = .2;
      }
      if (index===3) {
        this.mesh(new THREE.CylinderGeometry(.035,.035,1.8,6),belt,arms[1],0,-.1,.1);
        this.mesh(new THREE.ConeGeometry(.09,.3,4),metal,arms[1],0,.95,.1);
        this.mesh(new THREE.CylinderGeometry(.2,.2,.17,8),metal,head,0,.11,0);
      }
      root.position.set(route[0].x,this.heightAt(route[0].x,route[0].y),route[0].y);
      this.root.add(root);
      this.villagers.push({ root,head,arms,legs,path:route,destination:1,
        speed:.45+index*.07,clock:index,pause:index*.6 });
    });
  }

  addTorch(position: THREE.Vector3, phase: number): void {
    const holder = new THREE.Group();
    holder.position.copy(position);
    this.root.add(holder);
    const iron = this.material(0x303139,.52);
    this.mesh(new THREE.CylinderGeometry(.065,.095,.72,7),iron,holder,0,-.45,0);
    this.mesh(new THREE.ConeGeometry(.23,.28,8,1,true),iron,holder,0,-.12,0).rotation.x=Math.PI;
    const fireMaterial = new THREE.MeshBasicMaterial({
      color: 0xff9a26, transparent:true, opacity:.82,
      blending:THREE.AdditiveBlending, depthWrite:false,
    });
    const flame = this.mesh(new THREE.SphereGeometry(.15,7,7),fireMaterial,holder,0,.12,0);
    flame.scale.set(.8,2.6,.8);
    flame.castShadow = flame.receiveShadow = false;
    const light = new THREE.PointLight(0xffa44b,7,11,2);
    light.position.set(0,.25,0);
    holder.add(light);
    this.torches.push({light,phase,flame});
    this.emitters.push(position.clone());
  }

  createFire(): void {
    const perTorch=36, count=this.emitters.length*perTorch;
    const positions = new Float32Array(count*3);
    const seeds = new Float32Array(count*3);
    this.emitters.forEach((position,index) => {
      for(let j=0;j<perTorch;j++) {
        const i=index*perTorch+j;
        positions.set(position.toArray(),i*3);
        seeds.set([j/perTorch,Math.sin(i*78.233)*.5+.5,i*2.39996],i*3);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,3));
    const material = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{time:this.uniforms.time},
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        uniform float time;
        varying float vAge;
        void main() {
          float age=fract(seed.x+time*(.55+seed.y*.3));
          vAge=age;
          vec3 p=position;
          float r=(.12+age*.22)*(1.0-age*.5);
          p.x+=cos(seed.z+time*1.3)*r;
          p.z+=sin(seed.z+time)*r;
          p.y+=age*(1.1+seed.y*.65);
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_PointSize=clamp((1.0-age)*85.0/max(1.0,-mv.z),1.0,23.0);
          gl_Position=projectionMatrix*mv;if(length(mv.xyz)>45.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;}
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAge;
        void main() {
          vec2 p=gl_PointCoord-.5;
          float a=exp(-dot(p,p)*18.0)*(1.0-vAge);
          vec3 c=mix(vec3(2.0,1.4,.25),vec3(.8,.07,.005),vAge);
          gl_FragColor=vec4(c,a*.9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.fire=this.addPoints(geometry,material,'Torch flames and rising embers');
  }

  createAmbient(): void {
    const count=720;
    const positions=new Float32Array(count*3);
    const seeds=new Float32Array(count*3);
    for(let i=0;i<count;i++) {
      const x=Math.sin(i*78.233)*.5+.5;
      const z=Math.sin(i*43.127+3)*.5+.5;
      const px=(x-.5)*170,pz=(z-.5)*150;
      positions.set([px,this.heightAt(px,pz)+1.2+(i%17)*.45,pz],i*3);
      seeds.set([i*2.39996,(i%3),.4+(i%13)/13],i*3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,3));
    const material=new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.NormalBlending,
      uniforms:this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        uniform float time,night;
        varying float vKind,vAlpha,vAngle;
        void main() {
          vec3 p=position;
          vKind=seed.y;
          float t=time*(.18+seed.z*.13);
          if(seed.y<.5) {
            p.x+=sin(t+seed.x)*2.0;
            p.z+=cos(t*.7+seed.x)*1.5;
            p.y+=sin(t*1.1+seed.x)*.6;
            vAlpha=(1.0-night)*.26;
          } else if(seed.y<1.5) {
            p.x+=sin(t*2.0+seed.x)*1.6;
            p.z+=cos(t*2.7+seed.x)*1.7;
            p.y+=sin(t*2.5+seed.x)*.7;
            vAlpha=night*(.2+.8*pow(sin(time*1.7+seed.x)*.5+.5,2.0));
          } else {
            float fall=fract(time*.055+seed.z);
            p.y+=4.0-fall*7.0;
            p.x+=sin(fall*9.0+seed.x)*1.7;
            p.z+=cos(fall*7.0+seed.x)*1.2;
            vAlpha=.65*sin(fall*3.14159);
          }
          vAngle=time*.8+seed.x;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          float size=seed.y>1.5?48.0:22.0;
          gl_PointSize=clamp(size*seed.z/max(1.0,-mv.z),1.0,15.0);
          gl_Position=projectionMatrix*mv;if(length(mv.xyz)>45.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;}
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vKind,vAlpha,vAngle;
        void main() {
          vec2 p=gl_PointCoord-.5;
          float alpha;
          vec3 color;
          if(vKind>1.5) {
            mat2 rot=mat2(cos(vAngle),-sin(vAngle),sin(vAngle),cos(vAngle));
            p=rot*p;
            float leaf=length(p*vec2(1.5,3.1));
            alpha=(1.0-smoothstep(.4,.55,leaf))*vAlpha;
            color=mix(vec3(.16,.24,.045),vec3(.48,.31,.08),sin(vAngle)*.5+.5);
          } else {
            alpha=exp(-dot(p,p)*19.0)*vAlpha;
            color=vKind>.5?vec3(1.6,2.2,.25):vec3(.85,.77,.56);
          }
          gl_FragColor=vec4(color,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.ambient=this.addPoints(geometry,material,'Solar motes, fireflies and falling leaves');
  }

  createVortex(position: THREE.Vector3): void {
    const count=480;
    const geometry=new THREE.BufferGeometry();
    const seeds=new Float32Array(count*3);
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++) seeds.set([i/count,i*2.39996,(i%23)/23],i*3);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,3));
    const material=new THREE.ShaderMaterial({
      uniforms:{time:this.uniforms.time}, transparent:true,
      depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        uniform float time;
        varying float vAlpha,vSeed;
        void main() {
          float age=fract(seed.x+time*.12);
          float radius=(1.0-age)*3.9;
          float angle=seed.y+time*1.7+age*9.0;
          vec3 p=vec3(cos(angle)*radius,sin(angle)*radius,(seed.z-.5)*.8+sin(age*6.28)*.3);
          vAlpha=sin(age*3.14159);
          vSeed=seed.z;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_PointSize=clamp((35.0+seed.z*22.0)/max(1.0,-mv.z),1.0,13.0);
          gl_Position=projectionMatrix*mv;if(length(mv.xyz)>45.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;}
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha,vSeed;
        void main() {
          float r=length(gl_PointCoord-.5);
          float alpha=exp(-r*r*18.0)*vAlpha;
          vec3 color=mix(vec3(.5,.1,2.0),vec3(.4,1.1,2.0),vSeed);
          gl_FragColor=vec4(color,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.vortex=this.addPoints(geometry,material,'Spiral souls entering the dungeon vortex');
    this.vortex.position.copy(position).add(new THREE.Vector3(0,4,.3));
  }

  private addPoints(geometry: THREE.BufferGeometry,material:THREE.ShaderMaterial,name:string):THREE.Points {
    this.materials.add(material);
    this.geometries.add(geometry);
    const points=new THREE.Points(geometry,material);
    points.name=name;
    // Vertex motion is analytic and exceeds source attribute bounds.
    points.frustumCulled=false;
    this.root.add(points);
    return points;
  }

  setQuality(low:boolean):void {
    this.lowQuality=low;
    this.ambient?.geometry.setDrawRange(0,low?240:720);
    this.vortex?.geometry.setDrawRange(0,low?160:480);
  }

  update(dt:number,timeOfDay:number,camera?:THREE.Vector3):void {
    this.elapsed+=dt;
    this.uniforms.time.value=this.elapsed;
    if(camera&&this.vortex)this.vortex.visible=withinActorRadius(this.vortex.position,camera);
    const night=1-THREE.MathUtils.smoothstep(Math.sin(timeOfDay*Math.PI*2),-.1,.3);
    this.uniforms.night.value=night;
    this.torches.forEach((torch,index)=>{
      const near=!camera||withinActorRadius(torch.light.position,camera);torch.light.visible=near&&(!this.lowQuality||index%2===0);torch.flame.visible=near;if(!near)return;
      const flicker=Math.sin(this.elapsed*11.3+torch.phase)*.45
        +Math.sin(this.elapsed*17.9+torch.phase*2)*.22;
      torch.light.intensity=(4.8+night*3.6)*(1+flicker*.16);

      torch.flame.scale.y=2.1+flicker*.7;
      torch.flame.rotation.z=Math.sin(this.elapsed*5+torch.phase)*.1;
    });
    for(const villager of this.villagers) {
      villager.root.visible=!camera||withinActorRadius(villager.root.position,camera);if(!villager.root.visible)continue;
      villager.clock+=dt;
      if(villager.pause>0) {
        villager.pause-=dt;
        villager.head.rotation.y=Math.sin(villager.clock*.8)*.22;
        villager.arms[0].rotation.x=Math.sin(villager.clock*1.2)*.08;
        villager.legs[0].rotation.x*=Math.exp(-dt*6);
        villager.legs[1].rotation.x*=Math.exp(-dt*6);
        continue;
      }
      const target=villager.path[villager.destination];
      this.scratch.set(target.x-villager.root.position.x,0,target.y-villager.root.position.z);
      const distance=this.scratch.length();
      if(distance<.25) {
        villager.destination=(villager.destination+1)%villager.path.length;
        villager.pause=1.8+(villager.destination%3)*1.2;
        continue;
      }
      this.scratch.multiplyScalar(1/distance);
      villager.root.position.addScaledVector(this.scratch,Math.min(distance,villager.speed*dt));
      const angle=Math.atan2(this.scratch.x,this.scratch.z);
      const delta=Math.atan2(Math.sin(angle-villager.root.rotation.y),Math.cos(angle-villager.root.rotation.y));
      villager.root.rotation.y+=delta*(1-Math.exp(-dt*5));
      villager.root.position.y=this.heightAt(villager.root.position.x,villager.root.position.z)
        +Math.abs(Math.sin(villager.clock*5))*.025;
      const gait=Math.sin(villager.clock*5)*.38;
      villager.legs[0].rotation.x=gait;
      villager.legs[1].rotation.x=-gait;
      villager.arms[0].rotation.x=-gait*.65;
      villager.arms[1].rotation.x=gait*.65;
      villager.head.rotation.y=Math.sin(villager.clock*.8)*.09;
    }
  }

  dispose():void {
    this.root.removeFromParent();
    this.materials.forEach(material=>material.dispose());
    this.geometries.forEach(geometry=>geometry.dispose());
    this.materials.clear();
    this.geometries.clear();
    this.villagers.length=0;
    this.torches.length=0;
  }
}
