import rawContent from './content.json'
import type { ContentIndex, DalisizianContentPackage } from './types'

export const contentPackage = rawContent as DalisizianContentPackage

export function buildContentIndex(content: DalisizianContentPackage): ContentIndex {
  return {
    characters: new Map(content.content.characters.map((item) => [item.id, item])),
    cases: new Map(content.content.cases.map((item) => [item.caseId, item])),
    nodes: new Map(content.content.nodes.map((item) => [item.id, item])),
    evidence: new Map(content.content.evidence.map((item) => [item.id, item])),
    endings: new Map(content.content.endings.map((item) => [item.id, item])),
    scenes: new Map(content.content.cases.flatMap((item) => item.scenes).map((item) => [item.id, item])),
    clues: new Map(content.content.cases.flatMap((item) => item.clues).map((item) => [item.id, item])),
  }
}

export const contentIndex = buildContentIndex(contentPackage)
