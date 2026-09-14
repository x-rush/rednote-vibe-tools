import * as THREE from 'three';
import {decorationModel} from '../src/decoration-models.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const content=await (await fetch('../src/content/content.json')).json();
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(1200,850,false);renderer.setClearColor('#f5eee6');renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1200/850,.1,50);camera.position.set(0,5.5,6);camera.lookAt(0,0,0);const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment();scene.environment=pmrem.fromScene(env).texture;scene.add(new THREE.HemisphereLight('#ffffff','#776666',2));const sun=new THREE.DirectionalLight('#fff2dd',3);sun.position.set(2,5,4);scene.add(sun);
let vertices=0;for(const [i,t] of content.toppings.entries()){const model=decorationModel({...t,kind:t.id,digits:'18',color:content.studio.colors[i%5],lit:true},123+i);model.position.set((i%6-2.5)*.8,0,(Math.floor(i/6)-1)*1.1);model.traverse(o=>{if(o.geometry?.attributes.position){for(const v of o.geometry.attributes.position.array){if(!Number.isFinite(v))throw Error(t.id+' invalid geometry');vertices++;}}});scene.add(model);}
renderer.render(scene,camera);document.querySelector('output').textContent=JSON.stringify({models:content.toppings.length,finiteCoordinates:vertices,names:content.toppings.map(t=>t.name)});
