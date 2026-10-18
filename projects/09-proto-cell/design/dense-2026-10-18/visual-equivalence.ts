import { drawCell } from '../../src/rendering/cell'
import { createEntity } from '../../src/entities/factory'

;(window as any).comparePaths=()=>{
 const canvas=document.querySelector('canvas')!,ctx=canvas.getContext('2d')!,native=window.Path2D,results=[]

 for(const formId of ['form-primal-cell','form-colony-body','form-ciliate-composite'])for(const family of ['', 'dart','bastion','bloom']){
 const entity=createEntity({id:'visual-probe',role:'player',faction:'player',radius:45,mass:2025,membrane:100,energy:10,maxSpeed:100,visualRecipeId:family?'visual-lineage-'+family:'visual-player'}, {id:'player',position:{x:0,y:0}})
 const render=(retained:boolean)=>{(window as any).Path2D=retained?native:undefined;ctx.clearRect(0,0,400,400);drawCell(ctx,entity,200,200,62,1900,{quality:'balanced',formId:formId as any});return ctx.getImageData(0,0,400,400).data}
 const a=render(false),b=render(true);let changed=0,total=0,max=0
 for(let i=0;i<a.length;i++){const d=Math.abs(a[i]!-b[i]!);if(d>2)changed++;total+=d;max=Math.max(max,d)}
 results.push({formId,family,channelsBeyond2:changed,meanAbsoluteDifference:total/a.length,maxDifference:max})
 }
 ;(window as any).Path2D=native;return results
}
