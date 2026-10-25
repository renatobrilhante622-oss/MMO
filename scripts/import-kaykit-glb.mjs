#!/usr/bin/env node
/**
 * Imports official, CC0 KayKit GLBs into the offline-capable Android game.
 * Each file is pinned to a source Git commit and verified by its Git blob SHA-1.
 * No 3D mesh is generated from procedural primitives.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packs = {
  adventurers: {
    owner: 'KayKit-Game-Assets',
    repository: 'KayKit-Character-Pack-Adventures-1.0',
    commit: '672074b73ba276876a19e8816ecdc5241817ab47',
    prefix: 'addons/kaykit_character_pack_adventures/Characters/gltf',
  },
  skeletons: {
    owner: 'KayKit-Game-Assets',
    repository: 'KayKit-Character-Pack-Skeletons-1.0',
    commit: '15b62b9bad122f72926c10fb14d622c73819fa54',
    prefix: 'addons/kaykit_character_pack_skeletons/Characters/gltf',
  },
};
const entries = [
  ['adventurers', 'Barbarian', '66d312ab6dc02b35fb648e7585bfdddb4e02eeef'],
  ['adventurers', 'Knight', '717b56ca2b5ff5392679774725201ba03a3eefab'],
  ['adventurers', 'Mage', 'c89f19f6e707f6e07e4632a08876bd6d0172b082'],
  ['adventurers', 'Rogue', 'c8827661105eef7b2bfbef3bc676d41a47625733'],
  ['adventurers', 'Rogue_Hooded', '5d2b1403240d5f9ffff12e02c007572038eca2a8'],
  ['skeletons', 'Skeleton_Minion', '3b7e7ee4f1c8dd6dd99ddad27824ef1dc52ff12d'],
  ['skeletons', 'Skeleton_Warrior', '769e85c9e4cee8d1bd0952ddb3e9d26293144581'],
];

function verifyGlb(bytes, expectedSha) {
  const actual = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  if (actual !== expectedSha) throw new Error('Git blob SHA mismatch: ' + actual + ' != ' + expectedSha);
  if (bytes.length < 20 || bytes.toString('ascii',0,4) !== 'glTF' || bytes.readUInt32LE(4) !== 2
      || bytes.readUInt32LE(8) !== bytes.length || bytes.toString('ascii',16,20) !== 'JSON') {
    throw new Error('Invalid binary glTF version 2');
  }
  const jsonLength=bytes.readUInt32LE(12);
  if(jsonLength>bytes.length-20) throw new Error('GLB JSON length exceeds file size');
  const descriptor=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  if(!descriptor.asset||descriptor.asset.version!=='2.0'||!Array.isArray(descriptor.meshes)
    ||descriptor.meshes.length===0) throw new Error('Asset has no renderable GLB meshes');
  return {animations:(descriptor.animations??[]).map(a=>a.name??'unnamed'),
    meshCount:descriptor.meshes.length,nodeCount:(descriptor.nodes??[]).length};
}

async function getAsset(pack,name) {
  const url=['https://raw.githubusercontent.com',pack.owner,pack.repository,pack.commit,
    pack.prefix,name+'.glb'].join('/');
  const controller = new AbortController();
  const timeout=setTimeout(()=>controller.abort(),90000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Eterna-CC0-KayKit-Import'}});
    if(!response.ok)throw new Error('Failed to fetch '+name+': HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>8*1024*1024)throw new Error(name+' exceeds mobile asset size limit');
    return bytes;
  } finally {clearTimeout(timeout);}
}

await mkdir(resolve('public/models'),{recursive:true});
const manifest = [];
for (const [packKey,name,sha] of entries) {
  const pack = packs[packKey],file=resolve('public/models/KayKit_'+name+'.glb');
  let bytes;
  try { bytes=await readFile(file);verifyGlb(bytes,sha); }
  catch {bytes=await getAsset(pack,name);}
  const metadata=verifyGlb(bytes,sha);
  await writeFile(file,bytes);
  manifest.push({
    name:'KayKit_'+name,
    file:'models/KayKit_'+name+'.glb',
    source:'https://github.com/'+pack.owner+'/'+pack.repository+'/blob/'+pack.commit+'/'+pack.prefix+'/'+name+'.glb',
    upstreamCommit:pack.commit,
    upstreamGitBlobSha1:sha,
    license:'CC0-1.0',
    author:'Kay Lousberg',
    bytes:bytes.length,...metadata,
  });
  process.stdout.write(name+': '+bytes.length+' bytes, '+metadata.animations.length+' animations\n');
}
await writeFile(resolve('public/models/kaykit-manifest.json'),JSON.stringify({
  license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',
  sourceLicense:'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/672074b73ba276876a19e8816ecdc5241817ab47/LICENSE.txt',
  assets:manifest,
},null,2)+'\n');
