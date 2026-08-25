import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { buildArtifactDetailViewModel } from '../game/view-models.ts'
import { ArtifactEditorialDetail } from './ArtifactEditorialDetail.tsx'

const content = parseContent(rawContent)
const artifact = content.content.artifacts[0]
const model = buildArtifactDetailViewModel(
  artifact,
  { artifactId: artifact.id, bestStars: 3, unlockedAt: '2026-08-24T00:00:00.000Z' },
  content.content.categories,
  { verified: content.content.copy.verifiedLabel, pending: content.content.copy.pendingLabel },
  { artifacts: content.content.artifacts, sources: content.sources },
)

describe('ArtifactEditorialDetail', () => {
  it('renders a three-chapter curatorial scroll instead of the five-slip game layout', () => {
    const markup = renderToStaticMarkup(
      <ArtifactEditorialDetail model={model} copy={content.content.copy} onBack={() => undefined} />,
    )

    expect(markup).toContain('class="artifact-detail-editorial"')
    expect(markup).toContain('一分钟看懂')
    expect(markup.match(/class="detail-evidence-card/g)).toHaveLength(3)
    expect(markup).toContain('从形与工开始')
    expect(markup).toContain('回到它的时代')
    expect(markup).toContain('从出土走到今天')
    expect(markup).toContain('第一眼：鹰为什么站得这样稳')
    expect(markup).toContain('为什么今天还要细看它')
    expect(markup).not.toContain('story-index')
    expect(markup).not.toContain('read-button')
    expect(markup).not.toContain('memory-card')
  })

  it('collects archive metadata, related objects, and unique sources below the narrative', () => {
    const markup = renderToStaticMarkup(
      <ArtifactEditorialDetail model={model} copy={content.content.copy} onBack={() => undefined} />,
    )

    expect(markup).toContain('档案资料柜')
    expect(markup).toContain('<h3>人面鱼纹彩陶盆</h3>')
    expect(markup).toContain('<h3>四羊方尊</h3>')
    expect(markup).toContain('中国国家博物馆：鹰形陶鼎馆藏页')
    expect(markup.match(/source-chnmuseum-eagle-tripod/g)).toHaveLength(1)
  })
})
