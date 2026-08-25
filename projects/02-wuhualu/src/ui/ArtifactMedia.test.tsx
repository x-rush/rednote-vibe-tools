import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ArtifactMedia } from './ArtifactMedia.tsx'

describe('ArtifactMedia concealed fallback', () => {
  it('does not reveal the answer when an observation image has no usable source', () => {
    const markup = renderToStaticMarkup(
      <ArtifactMedia artifactId="artifact-missing" artifactName="曾侯乙编钟" role="observation" />,
    )

    expect(markup).not.toContain('曾侯乙编钟')
    expect(markup).toContain('当前藏品的局部观察线索，不包含答案文字')
  })
})
