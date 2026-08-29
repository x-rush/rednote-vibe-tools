declare module 'virtual:earth-current-content' {
  import type { EarthOnlineContent } from './schema'
  const content: EarthOnlineContent
  export default content
}

declare module 'virtual:earth-archive-content' {
  import type { QuestArchiveContent } from './schema'
  const archive: QuestArchiveContent
  export default archive
}

declare module 'virtual:earth-archive-loader' {
  import type { QuestArchiveContent } from './schema'
  export function loadQuestArchive(): Promise<QuestArchiveContent>
}
