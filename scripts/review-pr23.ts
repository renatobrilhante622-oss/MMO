import {CharacterPreview} from '../src/ui/CharacterPreview';
import {COSMETICS} from '../src/progression/AdventureProgress';
import {appearanceResourceStats} from '../src/assets/AppearanceResources';
import {modelAssetPath} from '../src/assets/AnimatedGLB';
let frameId=0;const frames=new Map<number,FrameRequestCallback>();window.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);
let contexts=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args:any[]):any{if(String(args[0]).includes('webgl'))contexts++;return (original as any).apply(this,args);};
const stage=document.querySelector<HTMLElement>('#stage')!,preview=new CharacterPreview();
const p=preview as any;
const selected=['regalia-solar','regalia-glacial','relic-warlock-4','plume-dragon','steed-imperial','steed-glacial','regalia-astral','relic-warlock-3','steed-fenrir','plume-crystal'];
async function waitReady(id:string){const start=performance.now();while(true){const c=COSMETICS.find(c=>c.id===id)!,r=p.rig,a=p.animal;let ready=a?.loadedModel;
 if(r?.imported?.ready){const {outfitParts}=await import('../src/player/SkinAssembly');ready=r.glbWeapons.length>0&&(c.type!=='skin'||r.importedSkinParts.length>=outfitParts(c.id).length);}
 if(ready)break;if(performance.now()-start>30000)throw Error('Load timeout '+id);await new Promise(r=>setTimeout(r,25));}
}
async function select(id:string){const c=COSMETICS.find(c=>c.id===id)!;preview.mount(stage,'warlock',c.color,4,c,'ironweapon');await waitReady(id);p.draw(.05);
 let lights=0,points=0,meshes=0;const actor=p.rig?.root??p.animal.root;actor.traverseVisible((o:any)=>{if(o.isLight)lights++;if(o.isPoints)points+=o.geometry.drawRange.count===Infinity?o.geometry.attributes.position.count:o.geometry.drawRange.count;if(o.isMesh)meshes++;});
 const sockets:any[]=[];actor.traverse((o:any)=>{if(o.name.startsWith('WeaponHandSocket'))sockets.push({name:o.name,count:o.children.length});});
 return {id,lights,points,meshes,sockets,attachments:p.rig?.imported?.attachmentCount??0,memory:{...p.renderer.info.memory},resources:appearanceResourceStats(),frames:frames.size,contexts};
}
async function stress(){const samples=[];for(const id of selected)await select(id);const baseline=await select('regalia-solar');for(let i=0;i<50;i++)samples.push(await select(selected[i%selected.length]));const after=await select('regalia-solar');
 // A repeated menu paint with the same selection must not re-request or rebuild its sockets.
 const generation=p.rig.glbWeaponGeneration;for(let i=0;i<50;i++)preview.mount(stage,'warlock',0xffd05f,4,COSMETICS.find(c=>c.id==='regalia-solar')!,'ironweapon');const stable=p.rig.glbWeaponGeneration===generation;
 preview.hide();const hidden={frames:frames.size,actors:p.scene.children.filter((o:any)=>o.name==='articulated-character').length,resources:appearanceResourceStats()};await select('relic-warlock-3');
 const requests=performance.getEntriesByType('resource').filter((e:any)=>/\.glb(?:$|\?)/.test(e.name)).map(e=>e.name);return {baseline,after,samples,stable,hidden,requests,contexts,frames:frames.size};
}
(window as any).audit23={select,stress,dispose:()=>preview.dispose()};
