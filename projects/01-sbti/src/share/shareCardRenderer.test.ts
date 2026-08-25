import { describe, expect, it, vi } from 'vitest'
import type { ShareCardModel } from './shareCardModel'
import { renderShareCard } from './shareCardRenderer'

const model: ShareCardModel = {
  eyebrow: '山海司 · 兽格志',
  creatureName: '陆吾',
  typeName: '镇岳守序者',
  line: '你习惯先看清边界，再稳稳守住值得托付的秩序。',
  quote: '真正的稳，不是停在原地，而是知道什么值得守住。',
  guideLabel: '闻山批注',
  guideSeal: '守卷',
  guideNote: '你守的不是旧规矩，而是让同行者知道脚下仍有路。',
  preferredPoles: ['应世', '察微', '衡理', '守形'],
  brand: 'SHBTI｜山海兽格测试',
  boundary: '娱乐性自我探索工具，不是专业心理测评。',
  imageSrc: './beast.webp',
  placeholderSrc: './placeholder.webp',
  imageFocusY: 0.5,
}

function fakeCanvas() {
  const texts: string[] = []
  const textDraws: Array<{ text: string; x: number; y: number; width: number }> = []
  const images: unknown[] = []
  const imageDraws: unknown[][] = []
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), clip: vi.fn(), arc: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => {
      images.push(args[0])
      imageDraws.push(args)
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      texts.push(text)
      textDraws.push({ text, x, y, width: text.length * 40 })
    }),
    measureText: vi.fn((text: string) => ({ width: text.length * 40 })),
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toDataURL: vi.fn(() => 'data:image/png;base64,rendered'),
  }
  return { canvas, texts, textDraws, images, imageDraws }
}

describe('share card canvas renderer', () => {
  it('renders a 3:4 PNG with the beast, four Chinese poles and product boundary', async () => {
    const target = fakeCanvas()
    const beast = { width: 900, height: 1125, marker: 'beast' }

    const rendered = await renderShareCard(target.canvas as unknown as HTMLCanvasElement, model, async () => beast as unknown as HTMLImageElement)

    expect(rendered).toEqual({ dataUri: 'data:image/png;base64,rendered', imageFallback: false })
    expect(target.canvas.width).toBe(1080)
    expect(target.canvas.height).toBe(1440)
    expect(target.images).toContain(beast)
    for (const text of ['陆吾', '镇岳守序者', '应世', '察微', '衡理', '守形', '闻山批注', '守卷', 'SHBTI｜山海兽格测试']) {
      expect(target.texts).toContain(text)
    }
    expect(target.texts.join('')).toContain('真正的稳')
    expect(target.canvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  it('uses the bundled placeholder when the release portrait cannot load', async () => {
    const target = fakeCanvas()
    const placeholder = { width: 900, height: 1125, marker: 'placeholder' }
    const loadImage = vi.fn(async (src: string) => {
      if (src === model.imageSrc) throw new Error('portrait failed')
      return placeholder as unknown as HTMLImageElement
    })

    const rendered = await renderShareCard(target.canvas as unknown as HTMLCanvasElement, model, loadImage)

    expect(rendered.imageFallback).toBe(true)
    expect(loadImage).toHaveBeenNthCalledWith(1, './beast.webp')
    expect(loadImage).toHaveBeenNthCalledWith(2, './placeholder.webp')
    expect(target.images).toContain(placeholder)
  })

  it('honours an audited upper focal point so a top-positioned face stays inside the artwork crop', async () => {
    const target = fakeCanvas()
    const beast = { width: 900, height: 1125 }

    await renderShareCard(
      target.canvas as unknown as HTMLCanvasElement,
      { ...model, imageFocusY: 0.25 } as ShareCardModel,
      async () => beast as unknown as HTMLImageElement,
    )

    const [, , sourceY] = target.imageDraws[0]
    expect(sourceY).toEqual(expect.any(Number))
    expect(sourceY as number).toBeLessThanOrEqual(20)
  })

  it('keeps the product boundary above the inner frame with a readable bottom margin', async () => {
    const target = fakeCanvas()
    await renderShareCard(target.canvas as unknown as HTMLCanvasElement, model, async () => ({ width: 900, height: 1125 }) as HTMLImageElement)

    const boundary = target.textDraws.find((draw) => draw.text === model.boundary)
    expect(boundary?.y).toBeLessThanOrEqual(1368)
  })

  it('reserves a clear gutter between Wenshan copy and the seal', async () => {
    const target = fakeCanvas()
    await renderShareCard(target.canvas as unknown as HTMLCanvasElement, model, async () => ({ width: 900, height: 1125 }) as HTMLImageElement)

    const noteLines = target.textDraws.filter((draw) => draw.y >= 1200 && draw.y <= 1290 && draw.text !== model.guideSeal)
    expect(noteLines.length).toBeGreaterThan(0)
    for (const line of noteLines) expect(line.x + line.width).toBeLessThanOrEqual(840)
  })
})
