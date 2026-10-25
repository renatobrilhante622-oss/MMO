import {TextureLoader,RepeatWrapping,SRGBColorSpace,type Texture} from 'three';

/** Authentic CC0 PBR scans; filenames refer to pinned originals in the asset manifest. */
export interface PBRTextureSet {
  map:Texture;normalMap:Texture;roughnessMap:Texture;
  dispose():void;
}
export type GroundSurface='grass'|'dirt'|'cobble'|'snow'|'scorched';
const SURFACES:Record<GroundSurface,string>={
  grass:'Grass004',
  dirt:'Ground071',
  cobble:'PavingStones046',
  snow:'Snow010A',
  scorched:'Ground093C'
};
const loader=new TextureLoader();
const cache=new Map<string,{texture:Texture;users:number}>();
function acquire(url:string,srgb=false):Texture{
  let asset=cache.get(url);
  if(!asset){
    const texture=loader.load(url);
    texture.wrapS=texture.wrapT=RepeatWrapping;
    texture.anisotropy=4;
    if(srgb)texture.colorSpace=SRGBColorSpace;
    asset={texture,users:0};cache.set(url,asset);
  }
  asset.users++;
  return asset.texture;
}
function release(url:string):void{
  const asset=cache.get(url);if(!asset)return;
  asset.users--;
  if(asset.users<=0){asset.texture.dispose();cache.delete(url);}
}
/** No Canvas, paint code, generated grain or synthesized roughness anywhere. */
export function createGroundTextures(surface:GroundSurface):PBRTextureSet{
  const name=SURFACES[surface],base=import.meta.env.BASE_URL+'textures/real-pbr/';
  const urls=['Color','NormalGL','Roughness'].map(channel=>base+name+'_1K-JPG_'+channel+'.webp');
  const [map,normalMap,roughnessMap]=urls.map((url,i)=>acquire(url,i===0));
  return {map,normalMap,roughnessMap,dispose(){urls.forEach(release);}};
}
