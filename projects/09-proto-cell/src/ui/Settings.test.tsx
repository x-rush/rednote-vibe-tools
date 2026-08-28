import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getContent } from '../content'
import { createDefaultSave } from '../storage/codec'
import { Settings } from './Settings'

describe('settings screen', () => {
  it('exposes audio, comfort, graphics, structured transfer, and confirmed clear', () => {
    const html = renderToStaticMarkup(<Settings content={getContent()} settings={createDefaultSave().settings} storageMode="persistent" storageIssues={[]} onChange={() => undefined} onExport={async () => '{}'} onImport={async () => ({ ok: true, issues: [] })} onClear={async () => undefined} onClose={() => undefined} />)
    expect(html).toContain('音乐')
    expect(html).toContain('减少闪烁')
    expect(html).toContain('画质')
    expect(html).toContain('导出')
    expect(html).toContain('清除')
  })

  it('offers the preserved rejected payload in recovery mode', () => {
    const html = renderToStaticMarkup(<Settings content={getContent()} settings={createDefaultSave().settings} storageMode="session" storageIssues={[{ path: '$', code: 'content-version', message: 'old' }]} onChange={() => undefined} onExport={async () => '{}'} onExportRecovery={async () => '{"old":true}'} onImport={async () => ({ ok: true, issues: [] })} onClear={async () => undefined} onClose={() => undefined} />)
    expect(html).toContain('导出待恢复原始数据')
  })
})
