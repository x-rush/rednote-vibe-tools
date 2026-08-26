import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { buildStoryViewModel } from './story-view-model.ts'
import { ArtifactStory } from './ArtifactStory.tsx'

const { content, sources } = parseContent(rawContent)
const artifact = content.artifacts[0]
if (!isCompleteArtifact(artifact)) throw new Error('missing complete artifact fixture')
const model = buildStoryViewModel(artifact, content.artifacts, sources)

describe('artifact story sources in the offline minitool', () => {
  it('shows source attribution without creating an external navigation', () => {
    const markup = renderToStaticMarkup(
      <ArtifactStory
        model={model}
        readIds={[]}
        onSectionRead={() => undefined}
        copy={{
          eyebrow: '档案',
          navLabel: '目录',
          sectionPrefix: '第',
          sourcesLabel: '资料来源',
          sourceLevelSuffix: '级',
          readAction: '读完',
          readDone: '已读',
        }}
      />,
    )

    expect(markup).toContain(model.sections[0].sources[0].title)
    expect(markup).not.toContain('href="https://')
    expect(markup).not.toContain('target="_blank"')
  })
})
