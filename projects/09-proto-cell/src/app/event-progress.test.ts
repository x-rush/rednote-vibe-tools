import { describe, expect, it } from 'vitest'
import { applyEventProgress } from './event-progress'
import { createDefaultSave } from '../storage/codec'
import { getContent } from '../content'

describe('event progress write budget',()=>{
 it('keeps unchanged saves identical for damage, terrain and previously completed food batches',()=>{
  const save=createDefaultSave();save.codex['creature-drifter']='complete'
  expect(applyEventProgress(save,[{type:'damaged',targetId:'player',source:'ram',amount:1,atMs:0},{type:'engulfed',predatorId:'player',preyId:'food',preyDefinitionId:'creature-drifter',biomass:4,atMs:0}],getContent())).toBe(save)
 })
 it('awards a new discovery once, including duplicate food in the same batch, without mutating the prior save',()=>{
  const save=createDefaultSave(),batch=Array.from({length:8},(_,n)=>({type:'engulfed' as const,predatorId:'player',preyId:'food-'+n,preyDefinitionId:'creature-drifter',biomass:4,atMs:0}))
  const changed=applyEventProgress(save,batch,getContent())
  expect(changed.codex['creature-drifter']).toBe('complete');expect(changed.progression.genePoints-save.progression.genePoints).toBe(3)
  expect(changed.progression.rewardCounts['codex-complete:creature-drifter']).toBe(1)
  expect(save.codex['creature-drifter']).toBeUndefined()
  expect(applyEventProgress(changed,batch,getContent())).toBe(changed)
 })
 it('preserves completion when a later death reports the same species',()=>{
  const save=createDefaultSave();save.codex['creature-drifter']='complete'
  expect(applyEventProgress(save,[{type:'player-died',cause:'engulfed',defeatedByDefinitionId:'creature-drifter',atMs:0}],getContent())).toBe(save)
 })
})
