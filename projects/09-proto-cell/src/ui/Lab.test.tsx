import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { createDefaultSave } from '../storage/codec'
import { Lab } from './Lab'

const renderLab = (hasArchive: boolean) => renderToStaticMarkup(<Lab
  content={getContent()}
  save={createDefaultSave()}
  hasArchive={hasArchive}
  selectedOriginId="origin-primal-cell"
  activeModifierIds={[]}
  dailyRunSeed={727}
  onSelectOrigin={() => undefined}
  onToggleModifier={() => undefined}
  onOpen={() => undefined}
  onStart={() => undefined}
/>)

describe('launch lab', () => {
  it('keeps the first visit focused on one start action', () => {
    const html = renderLab(false)
    expect((html.match(/<button/g) ?? [])).toHaveLength(1)
    expect(html).not.toContain('基因图谱')
  })

  it('reveals the complete local metagame after an archive exists', () => {
    const html = renderLab(true)
    expect(html).toContain('基因图谱')
    expect(html).toContain('生态图鉴')
    expect(html).toContain('本机日期生成，不与全球同步')
    expect(html).toContain('培养皿码')
    expect(html).toContain('挑战词缀')
  })

  it('exposes recovery settings even before the first archive when persistence fails', () => {
    const html = renderToStaticMarkup(<Lab content={getContent()} save={createDefaultSave()} hasArchive={false} selectedOriginId="origin-primal-cell" activeModifierIds={[]} dailyRunSeed={727} storageWarning onSelectOrigin={() => undefined} onToggleModifier={() => undefined} onOpen={() => undefined} onStart={() => undefined} />)
    expect(html).toContain('持久存储不可用')
    expect(html).toContain('设置与存档')
  })
})
