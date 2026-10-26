import {DoubleSide,MeshStandardMaterial} from 'three';

export type OrganicSurface='foliage'|'bark'|'flower'|'stone';
/** Isolated render materials never overwrite the shared GLB template or its texture atlas. */
export function organicMaterial(source:MeshStandardMaterial,surface:OrganicSurface,hasVertexColors=false):MeshStandardMaterial {
  const material=source.clone();
  material.metalness=0;
  material.roughness=surface==='flower'?.78:surface==='bark'?.93:.88;
  material.side=DoubleSide;
  material.vertexColors=hasVertexColors&&source.vertexColors;
  material.depthWrite=true;
  material.emissive.copy(source.emissive);
  material.emissiveIntensity=Math.min(.12,source.emissiveIntensity);
  if(!source.map&&!hasVertexColors){
    const {r,g,b}=source.color;
    const unnamedWhite=Math.min(r,g,b)>.85;
    const clippedBlack=Math.max(r,g,b)<.012;
    if(unnamedWhite||clippedBlack){
      material.color.set(surface==='foliage'?'#477a3d':surface==='bark'?'#5c3a21':surface==='flower'?'#c59abb':'#787c70');
    }
  }
  return material;
}
