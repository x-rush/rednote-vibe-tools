import type { EndingPosterModel } from '../state/ending-poster'

export const POSTER_SIZE = { width: 1080, height: 1440 } as const

export interface PosterSection {
  id: 'ending' | 'stats' | 'business' | 'stories' | 'share' | 'tracking'
  title: string
  body: string
}

export function posterSections(model: EndingPosterModel, copy: Record<string, string>): PosterSection[] {
  const favorite = model.favoriteProduct ? `${copy.posterFavorite} ${model.favoriteProduct.name} · ${model.favoriteProduct.sold} ${copy.posterCupUnit}` : copy.posterNoFavorite
  const chains = model.completedChains.length > 0 ? model.completedChains.join(' · ') : copy.posterNoChains
  const choices = model.keyChoices.slice(-2).map((item) => `${item.title}：${item.choice}`).join('；')
  return [
    { id: 'ending', title: model.endingTitle, body: model.evaluation },
    { id: 'stats', title: copy.posterStatsTitle, body: model.stats.map((stat) => `${stat.label} ${stat.value}`).join(' · ') },
    { id: 'business', title: copy.posterBusinessTitle, body: `${copy.posterTotalSold} ${model.totalSold} ${copy.posterCupUnit} · ${copy.posterProfitDays} ${model.profitDays} ${copy.posterDayUnit} · ${copy.posterLossDays} ${model.lossDays} ${copy.posterDayUnit} · ${copy.posterBreakEvenDays} ${model.breakEvenDays} ${copy.posterDayUnit}\n${favorite} · ${copy.posterNetChange} ${model.netMoneyChange >= 0 ? '+' : ''}${model.netMoneyChange}` },
    { id: 'stories', title: copy.posterStoriesTitle, body: `${chains}${choices ? `\n${choices}` : ''}` },
    { id: 'share', title: copy.posterShareTitle, body: model.shareText },
    ...(!model.historyComplete ? [{ id: 'tracking' as const, title: copy.posterTrackingTitle, body: `${copy.posterLegacyTracking} ${model.operatingDays} ${copy.posterOperatingDayUnit}。` }] : []),
  ]
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let line = ''
    for (const character of paragraph) {
      const candidate = line + character
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = character }
      else line = candidate
    }
    if (line) lines.push(line)
  }
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, -1)}…`
  visible.forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('品牌图标加载失败'))
    image.src = src
  })
}

export async function renderEndingPoster(
  canvas: HTMLCanvasElement,
  model: EndingPosterModel,
  copy: Record<string, string>,
  logoSrc = './assets/brand/shop-logo-v1.png',
): Promise<void> {
  canvas.width = POSTER_SIZE.width
  canvas.height = POSTER_SIZE.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前设备无法生成总结图')
  await document.fonts?.ready

  context.fillStyle = '#101b17'
  context.fillRect(0, 0, canvas.width, canvas.height)
  try {
    const logo = await loadImage(logoSrc)
    context.drawImage(logo, 66, 54, 156, 156)
  } catch { /* 文字标题仍可独立导出 */ }

  context.fillStyle = '#e0ad49'
  context.font = '600 26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillText(copy.posterEnglishKicker, 250, 94)
  context.fillStyle = '#f4ead0'
  context.font = '600 49px "Songti SC", "Noto Serif SC", serif'
  context.fillText(model.title, 250, 158)
  context.font = '26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillStyle = '#c8c6b4'
  context.fillText(`${copy.posterProgressOperating} ${model.operatingDays}/${model.totalOperatingDays} · ${copy.posterProgressCalendar} ${model.calendarDays}/${model.totalCalendarDays}`, 250, 202)

  roundedRect(context, 64, 244, 952, 246, 30)
  context.fillStyle = '#f5ecd5'
  context.fill()
  context.fillStyle = '#a83f38'
  context.font = '600 26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillText(copy.posterEndingLabel, 104, 294)
  context.fillStyle = '#2f382f'
  context.font = '600 58px "Songti SC", "Noto Serif SC", serif'
  context.fillText(model.endingTitle, 104, 368)
  context.font = '30px "Songti SC", "Noto Serif SC", serif'
  drawWrappedText(context, model.evaluation, 104, 420, 860, 43, 2)

  const statColors = ['#dfae4c', '#bd5a4f', '#728b63', '#8d765c']
  model.stats.forEach((stat, index) => {
    const x = 64 + index * 244
    roundedRect(context, x, 520, 220, 146, 22)
    context.fillStyle = '#1d2b26'
    context.fill()
    context.fillStyle = '#bfc4b5'
    context.font = '25px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    context.fillText(stat.label, x + 28, 563)
    context.fillStyle = statColors[index]
    context.font = '700 52px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    context.fillText(String(stat.value), x + 28, 627)
  })

  const sections = posterSections(model, copy)
  const business = sections.find((section) => section.id === 'business')!
  const stories = sections.find((section) => section.id === 'stories')!
  roundedRect(context, 64, 696, 952, 210, 28)
  context.fillStyle = '#f5ecd5'
  context.fill()
  context.fillStyle = '#a83f38'
  context.font = '600 26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillText(business.title, 104, 745)
  context.fillStyle = '#27352d'
  context.font = '31px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  drawWrappedText(context, business.body, 104, 799, 860, 46, 3)

  roundedRect(context, 64, 936, 952, 202, 28)
  context.fillStyle = '#26352f'
  context.fill()
  context.fillStyle = '#dfae4c'
  context.font = '600 26px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillText(stories.title, 104, 985)
  context.fillStyle = '#f4ead0'
  context.font = '29px "Songti SC", "Noto Serif SC", serif'
  drawWrappedText(context, stories.body, 104, 1039, 860, 43, 3)

  const tracking = sections.find((section) => section.id === 'tracking')
  context.fillStyle = '#dfae4c'
  context.font = '600 23px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  context.fillText(copy.posterShareTitle, 74, 1198)
  context.fillStyle = '#f4ead0'
  context.font = '42px "Songti SC", "Noto Serif SC", serif'
  drawWrappedText(context, `“${model.shareText}”`, 74, 1254, 920, 55, 2)
  if (tracking) {
    context.fillStyle = '#aeb5a6'
    context.font = '21px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    drawWrappedText(context, tracking.body, 74, 1370, 920, 30, 2)
  } else {
    context.fillStyle = '#8f978a'
    context.font = '21px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    context.fillText(copy.posterFooter, 74, 1380)
  }
}
