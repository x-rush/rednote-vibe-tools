import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EvolutionOverlay } from '../../src/ui/EvolutionOverlay'
import { ResultOverlay } from '../../src/ui/ResultOverlay'
import { getContent } from '../../src/content'
import { createBuildState, offerEvolution } from '../../src/evolution/build'
import { createResultViewModel } from '../../src/app/view-model'
;(globalThis as any).React=React
let root: Root | undefined
;(window as any).mountReachability = (kind: string) => {
  root?.unmount(); document.querySelector('#reachability-fixture')?.remove()
  const node=document.createElement('div');node.id='reachability-fixture';document.body.append(node);root=createRoot(node)
  const actions:string[]=[];(window as any).__reachActions=actions
  const content=getContent(), build=createBuildState({bodyStage:'ascendant',traitIds:content.organelles.slice(0,8).map(o=>o.id)})
  if(kind==='evolution') {
    const choices=offerEvolution(createBuildState(),{seed:727,environmentId:'env-clear-drop',stageIndex:0,remainingEnvironmentIds:['env-algae-glow','env-acid-vesicle'],unlockedTraitIds:content.organelles.map(o=>o.id),recentTraitIds:[]})
    root.render(<EvolutionOverlay choices={choices} onConfirm={choice=>actions.push(choice.traitId)} />)
  } else if(kind==='result') {
    const model=createResultViewModel({events:[{type:'ending-reached',endingId:'ending-stable-species',atMs:360000}],finalBuild:build,journeyStageIndex:2,environmentIds:['env-clear-drop','env-algae-glow','env-abandoned-chamber'],engulfScore:92432,survivalMs:360000,seed:727},content)
    root.render(<ResultOverlay model={model} onRestart={()=>actions.push('restart')} onLab={()=>actions.push('lab')} onBreed={()=>actions.push('breed')} onReplaySeed={()=>actions.push('replay')} />)
  }
}
