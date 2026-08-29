import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { EarthOnlineContent, QuestArchiveContent } from './src/content/schema.ts'

const currentModuleId = 'virtual:earth-current-content'
const archiveModuleId = 'virtual:earth-archive-content'
const loaderModuleId = 'virtual:earth-archive-loader'

export type ArchiveMode = 'lazy' | 'eager'

export function splitEarthContent(source: EarthOnlineContent): { current: EarthOnlineContent; archive: QuestArchiveContent } {
  return {
    current: {
      ...source,
      content: { ...source.content, retiredTasks: [], legacyTasks: [] },
    },
    archive: {
      retiredTasks: source.content.retiredTasks,
      legacyTasks: source.content.legacyTasks,
    },
  }
}

export function buildEarthContentModules({ archiveMode }: { archiveMode: ArchiveMode }): ReadonlyMap<string, string> {
  const contentPath = fileURLToPath(new URL('src/content/content.json', import.meta.url))
  const source = JSON.parse(readFileSync(contentPath, 'utf8')) as EarthOnlineContent
  const { current, archive } = splitEarthContent(source)
  const loader = archiveMode === 'lazy'
    ? `export async function loadQuestArchive(){return (await import("${archiveModuleId}")).default}`
    : `import archive from "${archiveModuleId}"; export async function loadQuestArchive(){return archive}`

  return new Map([
    [currentModuleId, `export default ${JSON.stringify(current)}`],
    [archiveModuleId, `export default ${JSON.stringify(archive)}`],
    [loaderModuleId, loader],
  ])
}

export function createEarthContentPlugin(options: { archiveMode: ArchiveMode }): Plugin {
  const modules = buildEarthContentModules(options)
  return {
    name: 'earth-online-content-split',
    resolveId(id) {
      return modules.has(id) ? `\0${id}` : undefined
    },
    load(id) {
      return id.startsWith('\0') ? modules.get(id.slice(1)) : undefined
    },
  }
}
