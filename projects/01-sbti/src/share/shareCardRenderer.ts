import type { ShareCardModel } from './shareCardModel'

export type ShareCardRenderResult = { dataUri: string; imageFallback: boolean }
export type ShareCardImageLoader = (src: string) => Promise<HTMLImageElement>

const WIDTH = 1080
const HEIGHT = 1440

export async function loadShareCardImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load local share-card image: ${src}`))
    image.src = src
  })
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const lines: string[] = []
  let line = ''
  for (const character of text) {
    const next = line + character
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = character
      if (lines.length === maxLines) break
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  const clipped = lines.slice(0, maxLines)
  if (clipped.join('').length < text.length && clipped.length) {
    clipped[clipped.length - 1] = `${clipped[clipped.length - 1].replace(/[，。；、]$/u, '')}…`
  }
  clipped.forEach((item, index) => context.fillText(item, x, y + index * lineHeight))
  return y + clipped.length * lineHeight
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const targetRatio = width / height
  const sourceRatio = sourceWidth / sourceHeight
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }
  context.drawImage(image, sx, sy, sw, sh, x, y, width, height)
}

function drawInkFallback(context: CanvasRenderingContext2D) {
  context.fillStyle = '#ded0b2'
  context.fillRect(72, 154, 936, 562)
  context.fillStyle = '#46534e'
  context.globalAlpha = 0.7
  context.beginPath()
  context.arc(540, 430, 176, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1
}

async function resolveArtwork(model: ShareCardModel, loader: ShareCardImageLoader) {
  if (model.imageSrc) {
    try { return { image: await loader(model.imageSrc), fallback: false } }
    catch { /* use the bundled placeholder below */ }
  }
  if (model.placeholderSrc) {
    try { return { image: await loader(model.placeholderSrc), fallback: true } }
    catch { /* draw an ink silhouette below */ }
  }
  return { image: undefined, fallback: true }
}

export async function renderShareCard(canvas: HTMLCanvasElement, model: ShareCardModel, loader: ShareCardImageLoader = loadShareCardImage): Promise<ShareCardRenderResult> {
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法绘制分享卡')

  context.fillStyle = '#f1e7cf'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  context.strokeStyle = 'rgba(70, 83, 78, 0.13)'
  context.lineWidth = 2
  for (let y = 34; y < HEIGHT; y += 38) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(WIDTH, y + 8)
    context.stroke()
  }

  context.strokeStyle = '#b79a62'
  context.lineWidth = 3
  context.strokeRect(38, 38, WIDTH - 76, HEIGHT - 76)
  context.strokeStyle = 'rgba(166, 61, 47, 0.55)'
  context.strokeRect(52, 52, WIDTH - 104, HEIGHT - 104)

  context.fillStyle = '#3f7464'
  context.font = '700 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillText(model.eyebrow, 72, 112)

  const artwork = await resolveArtwork(model, loader)
  context.save()
  roundedRect(context, 72, 154, 936, 562, 10)
  context.clip()
  if (artwork.image) drawCoverImage(context, artwork.image, 72, 154, 936, 562)
  else drawInkFallback(context)
  context.restore()
  context.strokeStyle = 'rgba(24, 35, 33, 0.55)'
  context.lineWidth = 2
  context.strokeRect(72, 154, 936, 562)

  context.fillStyle = '#182321'
  context.font = '700 84px "STKaiti", "KaiTi", serif'
  context.fillText(model.creatureName, 72, 816)
  context.fillStyle = '#a63d2f'
  context.font = '700 38px "STKaiti", "KaiTi", serif'
  context.fillText(model.typeName, 72, 870)

  context.fillStyle = '#46534e'
  context.font = '32px "Songti SC", "STSong", serif'
  drawWrappedText(context, model.line, 72, 934, 936, 45, 1)

  context.fillStyle = '#762a22'
  context.fillRect(72, 975, 4, 34)
  context.font = '26px "Songti SC", "STSong", serif'
  drawWrappedText(context, `「${model.quote}」`, 92, 1001, 896, 38, 1)

  model.preferredPoles.slice(0, 4).forEach((pole, index) => {
    const x = 72 + index * 236
    context.fillStyle = index % 2 === 0 ? '#762a22' : '#315e52'
    context.fillRect(x, 1042, 204, 92)
    context.fillStyle = '#f8f1df'
    context.font = '700 34px "STKaiti", "KaiTi", serif'
    context.textAlign = 'center'
    context.fillText(pole, x + 102, 1101)
  })

  context.textAlign = 'left'
  context.fillStyle = '#a63d2f'
  context.font = '700 25px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.fillText(model.guideLabel, 72, 1188)
  context.fillStyle = '#182321'
  context.font = '30px "Songti SC", "STSong", serif'
  drawWrappedText(context, model.guideNote, 72, 1236, 760, 42, 2)

  context.save()
  context.translate(940, 1228)
  context.rotate(-0.08)
  context.fillStyle = '#a63d2f'
  context.fillRect(-54, -54, 108, 108)
  context.fillStyle = '#f8f1df'
  context.font = '700 28px "STKaiti", "KaiTi", serif'
  context.textAlign = 'center'
  context.fillText(model.guideSeal, 0, 10)
  context.restore()

  context.textAlign = 'left'
  context.strokeStyle = 'rgba(70, 83, 78, 0.26)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(72, 1304)
  context.lineTo(1008, 1304)
  context.stroke()
  context.fillStyle = '#182321'
  context.font = '700 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.fillText(model.brand, 72, 1332)
  context.fillStyle = '#727a70'
  context.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif'
  context.fillText(model.boundary, 72, 1366)

  return { dataUri: canvas.toDataURL('image/png'), imageFallback: artwork.fallback }
}
