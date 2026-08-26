import { afterEach, describe, expect, it, vi } from 'vitest'
import rawContent from '../../content/content.json'
import { parseContent } from '../../content/validate'
import { buildReplayCardSvg, downloadReplayCard } from './exportReplayCard'

const copy = parseContent(rawContent).content.intro.replayCard

const cardData = {
  title: '朋友迟到',
  facts: ['约定十五点见面，对方十五点三十五分到达。'],
  feelings: ['担心'],
  inferences: ['你根本不在乎我。'],
  needs: ['可靠'],
  request: '如果会晚到，请尽早告诉我。',
  selectedText: '约定时间过去后，我没有收到回复。我有些担心，也需要安排更明确。',
}

function fakeDocument(dataUrl = 'data:image/png;base64,cG5n') {
  let anchorClicks = 0
  const fillTextCalls: string[] = []
  const context = new Proxy({
    measureText: (text: string) => ({ width: Array.from(text).length * 28 }),
    fillText: (text: string) => { fillTextCalls.push(text) },
  }, {
    get(target, property) {
      return property in target ? target[property as keyof typeof target] : () => undefined
    },
    set(target, property, value) {
      Object.assign(target, { [property]: value })
      return true
    },
  })
  const element = {
    width: 0,
    height: 0,
    href: '',
    download: '',
    getContext: () => context,
    toDataURL: () => dataUrl,
    click: () => { anchorClicks += 1 },
  }
  return {
    document: { createElement: () => element },
    anchorClicks: () => anchorClicks,
    fillTextCalls: () => fillTextCalls,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('replay card export', () => {
  it('escapes visible text and excludes internal fields', () => {
    const svg = buildReplayCardSvg({
      title: '朋友迟到 <script>',
      facts: ['约定后没有回复 & 晚到'],
      feelings: ['担心'],
      inferences: ['你根本不在乎我。'],
      needs: ['可靠'],
      request: '请提前告知',
      selectedText: '我想把安排说清楚。',
      internalSafetyTag: 'diagnostic-secret',
    } as never, copy)

    expect(svg).toContain('朋友迟到 &lt;script&gt;')
    expect(svg).toContain('约定后没有回复 &amp; 晚到')
    expect(svg).toContain('推测（待核对）')
    expect(svg).toContain('你根本不在乎我。')
    expect(svg).not.toContain('<script>')
    expect(svg).not.toContain('diagnostic-secret')
    expect(svg).not.toContain('internalSafetyTag')
  })

  it('writes a complete PNG data URI before saving it to the phone album', async () => {
    const calls: unknown[] = []
    const fake = fakeDocument()
    vi.stubGlobal('document', fake.document)
    vi.stubGlobal('window', {
      xhs: {
        miniTool: {
          writeTempFile: async (options: unknown) => {
            calls.push(['writeTempFile', options])
            return { filePath: 'xhs-temp://replay-card.png' }
          },
          saveImageToPhotosAlbum: async (options: unknown) => {
            calls.push(['saveImageToPhotosAlbum', options])
          },
        },
      },
    })

    const outcome = await downloadReplayCard(cardData, copy)

    expect(outcome).toEqual({ status: 'saved' })
    expect(calls).toEqual([
      ['writeTempFile', { data: 'data:image/png;base64,cG5n' }],
      ['saveImageToPhotosAlbum', { filePath: 'xhs-temp://replay-card.png' }],
    ])
    expect(fake.anchorClicks()).toBe(0)
    const paintedText = fake.fillTextCalls().join('')
    for (const text of [copy.factLabel, copy.feelingLabel, copy.inferenceLabel, copy.inferenceHint, copy.needLabel, copy.requestLabel]) {
      expect(paintedText).toContain(text)
    }
    for (const text of [...cardData.facts, ...cardData.feelings, ...cardData.inferences, ...cardData.needs, cardData.request, cardData.selectedText]) {
      expect(paintedText).toContain(text)
    }
  })

  it('reports an unavailable native bridge without attempting a web download', async () => {
    const fake = fakeDocument()
    vi.stubGlobal('document', fake.document)
    vi.stubGlobal('window', {})

    const outcome = await downloadReplayCard(cardData, copy)

    expect(outcome).toEqual({ status: 'unavailable' })
    expect(fake.anchorClicks()).toBe(0)
  })

  it('reports when album permission or saving fails', async () => {
    const fake = fakeDocument()
    vi.stubGlobal('document', fake.document)
    vi.stubGlobal('window', {
      xhs: {
        miniTool: {
          writeTempFile: async () => ({ filePath: 'xhs-temp://replay-card.png' }),
          saveImageToPhotosAlbum: async () => { throw new Error('permission denied') },
        },
      },
    })

    const outcome = await downloadReplayCard(cardData, copy)

    expect(outcome).toEqual({ status: 'permission-failed' })
    expect(fake.anchorClicks()).toBe(0)
  })

  it('distinguishes a temporary-file failure from an album permission failure', async () => {
    const fake = fakeDocument()
    vi.stubGlobal('document', fake.document)
    vi.stubGlobal('window', {
      xhs: {
        miniTool: {
          writeTempFile: async () => { throw new Error('write failed') },
          saveImageToPhotosAlbum: async () => undefined,
        },
      },
    })

    expect(await downloadReplayCard(cardData, copy)).toEqual({ status: 'write-failed' })
  })
})
