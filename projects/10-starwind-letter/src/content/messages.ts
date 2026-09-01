import raw from './content.json'

export type Mood = 'calm' | 'hope' | 'missing' | 'courage' | 'dream'

export interface StarMessage {
  readonly id: string
  readonly text: string
  readonly mood: Mood
  readonly weight: number
}

export interface StarContent {
  readonly messages: readonly StarMessage[]
  readonly fallback: StarMessage
}

const moods = new Set<Mood>(['calm', 'hope', 'missing', 'courage', 'dream'])

function parseMessageList(input: unknown): readonly StarMessage[] {
  if (!Array.isArray(input)) throw new Error('Star messages must be an array')
  const result = input.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Invalid star message at ${index}`)
    const { id, text, mood, weight } = entry as Record<string, unknown>
    if (
      typeof id !== 'string'
      || typeof text !== 'string'
      || !moods.has(mood as Mood)
      || typeof weight !== 'number'
      || weight <= 0
    ) {
      throw new Error(`Invalid star message at ${index}`)
    }
    return { id, text, mood: mood as Mood, weight }
  })
  if (new Set(result.map(({ id }) => id)).size !== result.length) {
    throw new Error('Duplicate star message id')
  }
  return result
}

export function parseContent(input: unknown): StarContent {
  if (!input || typeof input !== 'object') throw new Error('Star content must be an object')
  const { messages: inputMessages, fallback } = input as Record<string, unknown>
  const parsedMessages = parseMessageList(inputMessages)
  const [parsedFallback] = parseMessageList([fallback])
  if (!parsedFallback) throw new Error('Fallback star message is required')
  return { messages: parsedMessages, fallback: parsedFallback }
}

const content = parseContent(raw)
export const messages = content.messages
export const fallbackMessage = content.fallback
