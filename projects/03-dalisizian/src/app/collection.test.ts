import { describe, expect, it } from 'vitest'
import { contentIndex } from '../content'
import type { ProjectSaveData } from '../storage/types'
import { createCollectionStoryModel, createShareCardModel, getCollectionEntries } from './collection'

const firstCase = [...contentIndex.cases.values()].sort((a, b) => a.order - b.order)[0]
const secondCase = [...contentIndex.cases.values()].sort((a, b) => a.order - b.order)[1]

function saveWithCompletion(): ProjectSaveData {
  return {
    unlockedCaseIds: [firstCase.caseId, secondCase.caseId],
    completedCaseIds: [firstCase.caseId],
    bestRatings: {
      [firstCase.caseId]: { rating: '明镜高悬', score: 96, completedAt: '2026-08-26T08:30:00.000Z' },
    },
    settings: { muted: false, reducedMotion: false },
  }
}

describe('case collection', () => {
  it('keeps all eight ordered slots while exposing results only for completed cases', () => {
    const entries = getCollectionEntries(contentIndex, saveWithCompletion(), {
      [firstCase.caseId]: {
        caseId: firstCase.caseId,
        initialVerdict: 'myth',
        finalVerdict: 'partial',
        officialVerdict: 'partial',
        score: 96,
        rating: '明镜高悬',
        completedAt: '2026-08-26T08:30:00.000Z',
        clueCount: 4,
        evidenceCount: 4,
      },
    })

    expect(entries).toHaveLength(8)
    expect(entries.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(entries[0]).toMatchObject({ completed: true, unlocked: true, score: 96, finalVerdict: 'partial' })
    expect(entries[1]).toMatchObject({ completed: false, unlocked: true })
    expect(entries[1].score).toBeUndefined()
    expect(entries[2]).toMatchObject({ completed: false, unlocked: false })
    expect(entries[2].finalVerdict).toBeUndefined()
  })

  it('recovers a screenshot-ready card from the durable best result when detailed records are missing', () => {
    const entry = getCollectionEntries(contentIndex, saveWithCompletion(), {})[0]
    const card = createShareCardModel(entry)

    expect(card).toMatchObject({
      caseNumber: '01',
      title: '家字失踪案',
      coreCharacter: '家',
      initialVerdictLabel: '未记',
      finalVerdictLabel: '部分可信',
      rating: '明镜高悬',
      score: 96,
      dateLabel: '2026.08.26',
      detailRecovered: true,
    })
  })

  it('uses the exact archived verdict and evidence counts in the share card', () => {
    const entry = getCollectionEntries(contentIndex, saveWithCompletion(), {
      [firstCase.caseId]: {
        caseId: firstCase.caseId,
        initialVerdict: 'myth',
        finalVerdict: 'partial',
        officialVerdict: 'partial',
        score: 96,
        rating: '明镜高悬',
        completedAt: '2026-08-26T08:30:00.000Z',
        clueCount: 3,
        evidenceCount: 4,
      },
    })[0]

    expect(createShareCardModel(entry)).toMatchObject({
      initialVerdictLabel: '常见误解',
      finalVerdictLabel: '部分可信',
      clueCount: 3,
      evidenceCount: 4,
      shareLine: '证据成链，流言归档。',
      detailRecovered: false,
    })
  })

  it('formats an after-midnight completion using the product Asia/Shanghai date', () => {
    const save = saveWithCompletion()
    save.bestRatings[firstCase.caseId] = {
      rating: '明镜高悬',
      score: 100,
      completedAt: '2026-08-25T18:30:00.000Z',
    }

    const card = createShareCardModel(getCollectionEntries(contentIndex, save, {})[0])
    expect(card?.dateLabel).toBe('2026.08.26')
  })

  it('rebuilds a collection card from the detailed verdict record when the launcher summary is missing', () => {
    const save = saveWithCompletion()
    save.bestRatings = {}
    const record = {
      caseId: firstCase.caseId,
      initialVerdict: 'uncertain' as const,
      finalVerdict: 'partial' as const,
      officialVerdict: 'partial' as const,
      score: 88,
      rating: '慎思明辨' as const,
      completedAt: '2026-08-26T01:00:00.000Z',
      clueCount: 3,
      evidenceCount: 4,
    }

    const card = createShareCardModel(getCollectionEntries(contentIndex, save, { [firstCase.caseId]: record })[0])
    expect(card).toMatchObject({ score: 88, rating: '慎思明辨', detailRecovered: false })
  })

  it('builds a completed-case story from the rumor, three findings, and verdict boundary', () => {
    const entry = getCollectionEntries(contentIndex, saveWithCompletion(), {})[0]
    const story = createCollectionStoryModel(entry)

    expect(story).toMatchObject({
      caseNumber: '01',
      title: '家字失踪案',
      coreCharacter: '家',
      rumor: '一声醒木落下，“屋下有猪才成家”的故事传遍坊市。你将从字形、字书和制度推断三处查它的来路。',
      finalVerdictLabel: '部分可信',
      verdictReason: '传言抓住了宀、豕相关构件，却把传统释形和社会历史压成“家家屋内养猪”的必然结论。',
      rating: '明镜高悬',
      score: 96,
    })
    expect(story?.chapters.map((chapter) => chapter.title)).toEqual(['家字形证', '家字书证', '家流传辨析'])
    expect(story?.chapters.every((chapter) => chapter.summary.length > 20)).toBe(true)
    expect(story?.uncertainty).toContain('分别核验')
  })

  it('does not expose story content for an unfinished collection slot', () => {
    const unfinished = getCollectionEntries(contentIndex, saveWithCompletion(), {})[1]

    expect(createCollectionStoryModel(unfinished)).toBeUndefined()
    expect(unfinished.story).toBeUndefined()
  })

  it('gives the share card a case-specific truth hook and three evidence signets', () => {
    const entry = getCollectionEntries(contentIndex, saveWithCompletion(), {})[0]
    const card = createShareCardModel(entry)

    expect(card?.truthHook).toBe('传言抓住了宀、豕相关构件，却把传统释形和社会历史压成“家家屋内养猪”的必然结论。')
    expect(card?.clueSignets).toEqual(['家字形证', '家字书证', '家流传辨析'])
  })
})
