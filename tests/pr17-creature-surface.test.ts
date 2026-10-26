import {expect,it} from 'vitest';
import {Group,Mesh,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,MeshStandardMaterial} from 'three';
import {smoothCreatureSurface} from '../src/assets/CreatureSurface';
it('smooths authored indexed creature normals without losing UVs or skin influence',()=>{
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,1,1],3));g.setIndex([0,1,2,0,2,3]);g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.setAttribute('skinIndex',new Uint16BufferAttribute(new Array(16).fill(0),4));g.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
 const material=new MeshStandardMaterial(),mesh=new Mesh(g,material),root=new Group();root.add(mesh);smoothCreatureSurface(root);
 expect(mesh.geometry.attributes.position.count).toBe(6);expect(mesh.geometry.attributes.uv.count).toBe(6);expect(mesh.geometry.attributes.skinIndex.count).toBe(6);expect(mesh.geometry.attributes.skinWeight.count).toBe(6);expect(mesh.geometry.attributes.normal.count).toBe(6);
 for(let i=0;i<6;i++)expect(mesh.geometry.attributes.skinWeight.getX(i)).toBe(1);
 mesh.geometry.dispose();material.dispose();
});
