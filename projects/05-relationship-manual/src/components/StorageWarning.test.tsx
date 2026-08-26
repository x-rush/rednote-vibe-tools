import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { NpcCue } from '../content/schema'
import { StorageWarning } from './StorageWarning'

const cue: NpcCue = {
  cueId: 'cue-storage-error', trigger: 'storage-error', pose: 'reminder', speaker: '小满',
  roleLabel: '关系卡片整理员', text: '本机暂时没能收好这份草稿。', primaryAction: '重试保存',
  secondaryAction: '继续当前会话', skippable: true,
}

describe('StorageWarning', () => {
  it('offers an in-page selectable backup and clearly warns about session loss', () => {
    const html = renderToStaticMarkup(
      <StorageWarning cue={cue} backupText="关系说明书 · 当前会话备份" onRetry={() => undefined} onContinue={() => undefined} />,
    )

    expect(html).toContain('展开纯文字备份')
    expect(html).toContain('关闭页面后，本次进度不会保留')
    expect(html).toContain('<textarea')
    expect(html).toContain('关系说明书 · 当前会话备份')
    expect(html).not.toMatch(/clipboard|download=/u)
  })
})
