import currentContent from 'virtual:earth-current-content'
import { loadQuestArchive } from 'virtual:earth-archive-loader'
import { createQuestCatalog, type QuestCatalog } from '../content/catalog'
import type { EarthOnlineContent, QuestArchiveContent } from '../content/schema'
import { validateContent } from '../content/validate'
import { storageNeedsArchive } from '../storage/archive-requirement'

export type PreparedRuntime = {
  status: 'ready' | 'archive-error'
  content: EarthOnlineContent
  catalog: QuestCatalog
}

export async function prepareRuntime(
  storage: Pick<Storage, 'getItem'>,
  archiveLoader: () => Promise<QuestArchiveContent> = loadQuestArchive,
): Promise<PreparedRuntime> {
  const currentCatalog = createQuestCatalog(currentContent)
  if (!storageNeedsArchive(storage, currentCatalog.activeById)) {
    return currentRuntime(currentCatalog)
  }

  try {
    const archive = await archiveLoader()
    const content: EarthOnlineContent = {
      ...currentContent,
      content: { ...currentContent.content, ...archive },
    }
    if (!validateContent(content, 'production').ok) return archiveError(currentCatalog)
    return { status: 'ready', content, catalog: createQuestCatalog(content) }
  } catch {
    return archiveError(currentCatalog)
  }
}

function currentRuntime(catalog: QuestCatalog): PreparedRuntime {
  return { status: 'ready', content: currentContent, catalog }
}

function archiveError(catalog: QuestCatalog): PreparedRuntime {
  return { status: 'archive-error', content: currentContent, catalog }
}
