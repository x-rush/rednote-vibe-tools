import { describe, expect, it } from 'vitest'
import type { CardSectionId, RelationshipCardViewModel } from '../content/schema'
import { buildShareCardSvg, savePngDataUrlToPhotosAlbum } from './share-card'

const card: RelationshipCardViewModel = {
  title: '我希望被这样对待',
  relationshipLabel: '亲密关系',
  shareSummary: '希望我们既能靠近，也能给彼此留下呼吸的位置。',
  disclaimer: '这是一份沟通工具，不代替真实交流。',
  contentVersion: '2.0.0',
  sections: [{
    sectionId: 'contact',
    title: '回信的节奏',
    paragraphs: ['忙碌时，一句简短的“我看到了”会让我更安心。'],
    paragraphRoles: ['need'],
    paragraphIds: ['contact-1'],
    paragraphSourceTextKeys: ['pref-contact-brief'],
    paragraphProvenanceIds: [['option-busy-brief']],
    sensitive: false,
    visible: true,
    order: 0,
  }, {
    sectionId: 'boundary',
    title: '不能被翻过的页',
    paragraphs: ['分享我的经历前，请先获得明确同意。'],
    paragraphRoles: ['trigger'],
    paragraphIds: ['boundary-1'],
    paragraphSourceTextKeys: ['boundary-private'],
    paragraphProvenanceIds: [['option-private-ask']],
    sensitive: true,
    visible: true,
    order: 1,
  }],
}

describe('share card export', () => {
  it('builds a self-contained share-card SVG with the visible card content', () => {
    const svg = buildShareCardSvg(card)
    const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 0)

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="1080"')
    expect(height).toBeGreaterThanOrEqual(900)
    expect(svg).toContain('我希望被这样对待')
    expect(svg).toContain('回信的节奏')
    expect(svg).toContain('不能被翻过的页')
    expect(svg).toContain('我的需要')
    expect(svg).toContain('容易卡住的时刻')
    expect(svg).not.toContain('<foreignObject')
  })

  it('escapes user-edited text before placing it in SVG markup', () => {
    const unsafeCard = { ...card, shareSummary: '先听我说 <script>alert("x")</script> & 再商量' }

    const svg = buildShareCardSvg(unsafeCard)

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
  })

  it('keeps every chapter line within the printable text column', () => {
    const longCard = {
      ...card,
      sections: [{
        ...card.sections[0],
        paragraphs: ['这是一段需要在分享卡正文栏里安全换行而不能越过右侧纸张边界的长句子'],
      }],
    }

    const svg = buildShareCardSvg(longCard)
    const paragraph = svg.match(/<text class="section-copy"[^>]*>(.*?)<\/text>/s)?.[1] ?? ''
    const lines = [...paragraph.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map((match) => match[1])

    expect(lines.length).toBe(2)
    expect(lines.every((line) => Array.from(line).length <= 20)).toBe(true)
  })

  it('matches the compact page header and keeps its right label clear of the fold', () => {
    const svg = buildShareCardSvg(card)
    const rightMeta = svg.match(/<text x="(\d+)" y="\d+" class="meta sans" text-anchor="end">简洁分享版<\/text>/)

    expect(svg).toContain('<text x="90" y="96" class="meta sans">亲密关系</text>')
    expect(Number(rightMeta?.[1] ?? 0)).toBeGreaterThan(0)
    expect(Number(rightMeta?.[1] ?? 0)).toBeLessThanOrEqual(930)
  })

  it('stacks each role above full-width copy and includes the same topic labels as the page card', () => {
    const svg = buildShareCardSvg(card)
    const role = svg.match(/<text x="(\d+)" y="(\d+)" class="role">我的需要<\/text>/)
    const copy = svg.match(/<text class="section-copy" x="(\d+)" y="(\d+)">/)

    expect(svg).toContain('01 / 联系')
    expect(svg).toContain('02 / 边界')
    expect(Number(copy?.[1] ?? 0)).toBe(Number(role?.[1] ?? -1))
    expect(Number(copy?.[2] ?? 0)).toBeGreaterThan(Number(role?.[2] ?? 0))
  })

  it('uses the same single-column footer hierarchy as the compact page card', () => {
    const svg = buildShareCardSvg(card)

    expect(svg).toContain('class="footer-brand">RELATIONSHIP MANUAL</text>')
    expect(svg).toContain('class="footer-copy"')
    expect(svg).not.toContain('小满整理 · 内容仅在本设备生成')
  })

  it('does not pad a short compact card to an unnecessarily tall fixed canvas', () => {
    const svg = buildShareCardSvg(card)
    const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 0)

    expect(height).toBeGreaterThan(1_300)
    expect(height).toBeLessThan(1_800)
  })

  it('keeps a seven-chapter compact card in a phone-like long-image proportion', () => {
    const sectionIds: CardSectionId[] = ['contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair']
    const phoneCard: RelationshipCardViewModel = {
      ...card,
      sections: sectionIds.map((sectionId, index) => ({
        ...card.sections[0],
        sectionId,
        title: `第${index + 1}章`,
        paragraphs: ['忙碌的时候请给我一句简短回应，让我知道这份联系没有被忘记。'],
      })),
    }

    const svg = buildShareCardSvg(phoneCard)
    const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 0)

    expect(height).toBeGreaterThan(2_200)
  })

  it('grows into a long image instead of truncating selected chapter text', () => {
    const sectionIds: CardSectionId[] = ['contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair']
    const paragraph = '这段手工整理后的表达需要完整出现在保存的长图里，不能因为章节较多或文字较长就在中途被省略。'.repeat(2)
    const longCard: RelationshipCardViewModel = {
      ...card,
      sections: sectionIds.map((sectionId, index) => ({
        ...card.sections[0],
        sectionId,
        title: `第${index + 1}章`,
        paragraphs: [paragraph],
      })),
    }

    const svg = buildShareCardSvg(longCard)
    const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)?.[1] ?? 0)
    const exportedParagraphs = [...svg.matchAll(/<text class="section-copy"[^>]*>(.*?)<\/text>/gs)]
      .map((match) => [...match[1].matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map((line) => line[1]).join(''))

    expect(height).toBeGreaterThan(1350)
    expect(exportedParagraphs).toHaveLength(7)
    expect(exportedParagraphs.every((text) => text === paragraph)).toBe(true)
    expect(svg).not.toContain('…')
  })

  it('writes the complete PNG data URI to a temp file before saving it to the photo album', async () => {
    const calls: Array<{ method: string; value: string }> = []
    const bridge = {
      async writeTempFile({ data }: { data: string }) {
        calls.push({ method: 'writeTempFile', value: data })
        return { filePath: 'xhs-temp://relationship-card.png' }
      },
      async saveImageToPhotosAlbum({ filePath }: { filePath: string }) {
        calls.push({ method: 'saveImageToPhotosAlbum', value: filePath })
        return {}
      },
    }

    await savePngDataUrlToPhotosAlbum('data:image/png;base64,iVBORw0KGgo=', bridge)

    expect(calls).toEqual([
      { method: 'writeTempFile', value: 'data:image/png;base64,iVBORw0KGgo=' },
      { method: 'saveImageToPhotosAlbum', value: 'xhs-temp://relationship-card.png' },
    ])
  })
})
