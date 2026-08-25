import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import content from '../content/content.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { SpotlightStage } from './SpotlightStage.tsx'

const parsed = parseContent(content)
const artifact = parsed.content.artifacts.find(item => item.id === 'artifact-zenghouyi-bells')
if (!artifact || !isCompleteArtifact(artifact)) throw new Error('missing enhanced artifact fixture')
const goldenArtifact = artifact
const spots = goldenArtifact.experienceV2.observationSpots

const copy = {
  guideLabel: '许照带你看',
  firstPrompt: '先点亮 01 号观察签，看看器形留下了什么。',
  continuePrompt: '找到了。其余观察签也可以任意查看。',
  completePrompt: '三处证据都看过了，现在可以去拆线索印。',
  markerLabel: '观察签',
  progressLabel: '已观察',
  askLabel: '请许照帮我看一眼',
}

function render(foundIds: readonly string[] = [], onAsk: (() => void) | null = () => undefined) {
  return renderToStaticMarkup(
    <SpotlightStage
      artifact={goldenArtifact}
      spots={spots}
      foundIds={foundIds}
      instruction="轻触图上的编号观察签，查看器形留下的三处证据。"
      copy={copy}
      onDiscover={() => undefined}
      onAsk={onAsk ?? undefined}
    />,
  )
}

describe('SpotlightStage touch observation', () => {
  it('renders three on-image buttons and recommends marker 01 before the first observation', () => {
    const markup = render()

    expect(markup.match(/class="inspection-marker/g)).toHaveLength(3)
    expect(markup).toContain('class="inspection-marker is-recommended"')
    expect(markup).toContain('aria-label="观察签 01"')
    expect(markup).toContain('先点亮 01 号观察签，看看器形留下了什么。')
    expect(markup).toContain('已观察 0 / 3')
    expect(markup).toContain('class="inspection-guide__action"')
    expect(markup).toContain('请许照帮我看一眼')
  })

  it('shows the discovered note and opens the remaining markers after the first tap', () => {
    const markup = render([spots[0].id])

    expect(markup).toContain('class="inspection-marker is-found"')
    expect(markup).not.toContain('is-recommended')
    expect(markup).not.toContain('is-muted')
    expect(markup).toContain('class="inspection-results" aria-live="polite"')
    expect(markup).toContain(spots[0].label)
    expect(markup).toContain(spots[0].note)
    expect(markup).toContain('找到了。其余观察签也可以任意查看。')
    expect(markup).toContain('已观察 1 / 3')
  })

  it('hands the player onward after every observation marker is found', () => {
    const markup = render(spots.map(spot => spot.id))

    expect(markup).toContain('三处证据都看过了，现在可以去拆线索印。')
    expect(markup).toContain('已观察 3 / 3')
  })

  it('keeps one coordinate-calibrated observation image when clue seals are opened', () => {
    const markup = render()

    expect(markup).toContain('reveal-wide-creative-reconstruction-v1.webp')
    expect(markup).toContain('width="1200"')
    expect(markup).toContain('height="800"')
    expect(markup).not.toContain('clue-crop-small-to-large-bells.webp')
    expect(markup).toContain('aspect-ratio:1200/800')
  })

  it('hides the guide action after the guide has already helped', () => {
    expect(render([], null)).not.toContain('inspection-guide__action')
  })
})
