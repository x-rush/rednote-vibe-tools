import * as THREE from '../vendor/package/build/three.module.js';
import {customScale} from './contour.js';
export function contourSurface(outline,scale=1){const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x*scale,-p.z*scale)));return new THREE.ShapeGeometry(shape,1);}
export function contourSolid(outline,{open=false}={}){
  const vertices=[],indices=[],levels=48,n=outline.length;
  for(let row=0;row<=levels;row++){const h=row/levels,s=customScale(h);for(const p of outline)vertices.push(p.x*s,.14+h*1.675,p.z*s);}
  for(let row=0;row<levels;row++)for(let i=0;i<n;i++){const a=row*n+i,b=row*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}
  const cap=(height,scale,top)=>{const start=vertices.length/3;for(const p of outline)vertices.push(p.x*scale,height,p.z*scale);const triangles=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(p.x,p.z)),[]);for(const [a,b,c]of triangles)indices.push(start+a,start+(top?c:b),start+(top?b:c));};
  cap(.14,customScale(0),false);if(!open)cap(1.815,customScale(1),true);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('restHeight',new THREE.Float32BufferAttribute(vertices.filter((_,i)=>i%3===1),1));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
