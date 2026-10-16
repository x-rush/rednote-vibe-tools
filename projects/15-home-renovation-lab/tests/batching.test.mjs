import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/vendor/package/build/three.module.js';
import {compactMaterialGroups} from '../src/container-scene.js';

function faces(mesh){
  const result=new Map();
  for(const group of mesh.geometry.groups){const material=mesh.material[group.materialIndex];if(!result.has(material))result.set(material,[]);for(let i=group.start;i<group.start+group.count;i++)result.get(material).push(mesh.geometry.index.getX(i));}
  return result;
}
test('wall batches preserve each side material while reducing six groups to two',()=>{
  const first=new T.MeshStandardMaterial({color:'#ffffff'}),second=new T.MeshStandardMaterial({color:'#727d61'}),mesh=new T.Mesh(new T.BoxGeometry(2,3,.15),[first,first,first,first,second,first]);
  const before=faces(mesh);compactMaterialGroups(mesh);
  assert.equal(mesh.geometry.groups.length,2);assert.equal(mesh.material.length,2);assert.deepEqual(faces(mesh),before);
  const index=mesh.geometry.index;compactMaterialGroups(mesh);assert.equal(mesh.geometry.index,index);
  mesh.geometry.dispose();first.dispose();second.dispose();
});
