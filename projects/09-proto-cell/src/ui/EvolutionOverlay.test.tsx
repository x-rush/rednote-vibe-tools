import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBuildState, offerEvolution } from '../evolution/build'
import { getContent } from '../content'
import { EvolutionOverlay } from './EvolutionOverlay'

describe('evolution overlay', () => {
  const choices = offerEvolution(createBuildState(), {
    seed: 727,
    environmentId: 'env-clear-drop',
    stageIndex: 0,
    remainingEnvironmentIds: ['env-algae-glow', 'env-acid-vesicle'],
    unlockedTraitIds: getContent().organelles.map((organ) => organ.id),
    recentTraitIds: [],
  })

  it('renders three behavior-changing tap choices and one confirmation action', () => {
    const html = renderToStaticMarkup(
      <EvolutionOverlay choices={choices} currentBuild={createBuildState()} onConfirm={() => undefined} />,
    )

    expect(html).toContain('膜正在重写自己')
    expect(html).toContain('确认进化')
    expect((html.match(/class="evolution-choice"/g) ?? [])).toHaveLength(3)
    expect((html.match(/evolution-choice__preview/g) ?? [])).toHaveLength(3)
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('draggable')
  })

  it('shows one behavior change and one cost per choice without internal trigger ids', () => {
    const html = renderToStaticMarkup(
      <EvolutionOverlay choices={[{
        lane: 'continuation',
        traitId: 'organelle-flagellum',
        route: 'predation',
        resultingBodyStage: 'hunter',
        behaviorText: '追逐两秒后爆发加速',
        costText: '代价：转向略慢',
        triggerAvailable: true,
      }]} currentBuild={createBuildState()} onConfirm={() => undefined} />,
    )

    expect(html).toContain('追逐两秒后爆发加速')
    expect(html).toContain('代价：转向略慢')
    expect(html).not.toContain('trigger-pursuit-2000')
  })
})
