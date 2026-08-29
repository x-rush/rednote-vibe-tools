import { describe, expect, it } from 'vitest'
import rawContent from './src/content/content.json'
import type { EarthOnlineContent } from './src/content/schema'
import { buildEarthContentModules, splitEarthContent } from './vite.content-plugin'

const source = rawContent as unknown as EarthOnlineContent

describe('earth content build modules', () => {
  it('splits current and archived definitions without changing the single source object', () => {
    const { current, archive } = splitEarthContent(source)

    expect(current.content.tasks).toHaveLength(112)
    expect(current.content.retiredTasks).toEqual([])
    expect(current.content.legacyTasks).toEqual([])
    expect(archive.retiredTasks).toHaveLength(40)
    expect(archive.legacyTasks).toHaveLength(160)
    expect(source.content.retiredTasks).toHaveLength(40)
    expect(source.content.legacyTasks).toHaveLength(160)
  })

  it('emits a dynamic archive loader for Web and an eager loader for minitool', () => {
    const lazy = buildEarthContentModules({ archiveMode: 'lazy' })
    const eager = buildEarthContentModules({ archiveMode: 'eager' })
    const current = parseDefaultExport(lazy.get('virtual:earth-current-content')) as EarthOnlineContent
    const archive = parseDefaultExport(lazy.get('virtual:earth-archive-content')) as EarthOnlineContent['content']

    expect(current.content.tasks).toHaveLength(112)
    expect(current.content.retiredTasks).toHaveLength(0)
    expect(current.content.legacyTasks).toHaveLength(0)
    expect(archive.retiredTasks).toHaveLength(40)
    expect(archive.legacyTasks).toHaveLength(160)
    expect(lazy.get('virtual:earth-archive-loader')).toContain('import("virtual:earth-archive-content")')
    expect(eager.get('virtual:earth-archive-loader')).toContain('import archive from "virtual:earth-archive-content"')
    expect(eager.get('virtual:earth-archive-loader')).not.toContain('import("')
  })
})

function parseDefaultExport(sourceText: string | undefined): unknown {
  const prefix = 'export default '
  if (!sourceText?.startsWith(prefix)) throw new Error('Expected a default-export virtual module')
  return JSON.parse(sourceText.slice(prefix.length))
}
