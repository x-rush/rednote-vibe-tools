import rawContent from './content.json'
import type { ContentPack } from './schema'
import { validateContent, type ContentIssue } from './validate'

export class ContentValidationError extends Error {
  readonly issues: readonly ContentIssue[]

  constructor(issues: readonly ContentIssue[]) {
    super('Proto Cell content validation failed')
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}

let cached: ContentPack | undefined

export function getContent(): ContentPack {
  if (cached) return cached
  const result = validateContent(rawContent)
  if (!result.value) throw new ContentValidationError(result.issues)
  cached = result.value
  return cached
}

export type * from './schema'
export { validateContent } from './validate'
