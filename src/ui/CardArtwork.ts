/** Static landscape renders use the source-pinned CC0 Kenney GLBs shipped with Eterna.
 * See public/assets/landscapes/manifest.json for source URLs and pixel-file hashes.
 */
export const REGION_ARTWORK = ['aurora','crypt','highlands','rift','eclipse'] as const;
export type RegionArtwork = typeof REGION_ARTWORK[number];
export function regionArtwork(regionId:string):string {
  const id=REGION_ARTWORK.includes(regionId as RegionArtwork)?regionId:'aurora';
  return import.meta.env.BASE_URL+'assets/landscapes/'+id+'.webp';
}
export function dungeonArtwork(dungeonId:string):string {
  const regions:Record<string,RegionArtwork>={tower:'highlands',roots:'aurora',tide:'aurora',tombs:'crypt',titan:'highlands',void:'rift',eclipse:'eclipse'};
  const id=regions[dungeonId]??'crypt';
  return import.meta.env.BASE_URL+'assets/landscapes/'+(id==='aurora'?'':'dungeon-')+id+'.webp';
}
