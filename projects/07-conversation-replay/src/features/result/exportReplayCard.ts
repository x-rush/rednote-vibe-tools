import type { IntroContent } from '../../domain/types'

export type ReplayCardExportData = {
  title: string
  facts: string[]
  feelings: string[]
  inferences: string[]
  needs: string[]
  request?: string
  selectedText: string
}

export type ReplayCardExportCopy = IntroContent['replayCard']

type MiniToolBridge = {
  writeTempFile(options: { data: string }): Promise<{ filePath?: string }>
  saveImageToPhotosAlbum(options: { filePath: string }): Promise<unknown>
}

export type ReplayCardSaveOutcome =
  | { status: 'saved' }
  | { status: 'unavailable' }
  | { status: 'generation-failed' }
  | { status: 'write-failed' }
  | { status: 'permission-failed' }

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1440
const UI_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
const SERIF_FONT = '"Songti SC", "STSong", serif'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function buildReplayCardSvg(data: ReplayCardExportData, copy: ReplayCardExportCopy) {
  const title = escapeXml(data.title)
  const facts = escapeXml(data.facts.join('；'))
  const feelings = escapeXml(data.feelings.join('、'))
  const inferences = escapeXml(data.inferences.join('；'))
  const needs = escapeXml(data.needs.join('、'))
  const request = escapeXml(data.request ?? copy.emptyRequest)
  const selectedText = escapeXml(data.selectedText)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
  <rect width="1080" height="1440" fill="#f5f2eb"/>
  <rect x="72" y="72" width="936" height="1296" rx="28" fill="#fffdf8" stroke="#d8d2c7" stroke-width="3"/>
  <foreignObject x="128" y="120" width="824" height="1200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#303735;font-family:system-ui,'PingFang SC',sans-serif;line-height:1.7">
      <div style="font-size:24px;letter-spacing:.16em;color:#6e8490">${escapeXml(copy.brandLabel)} · ${escapeXml(copy.attributionLabel)}</div>
      <h1 style="font-family:'Songti SC',serif;font-size:58px;line-height:1.3;margin:24px 0 44px">${title}</h1>
      <div style="border-top:2px solid #d8d2c7;padding:22px 0;font-size:27px"><b>${escapeXml(copy.factLabel)}</b><div>${facts}</div></div>
      <div style="border-top:2px solid #d8d2c7;padding:22px 0;font-size:27px"><b>${escapeXml(copy.feelingLabel)}</b><div>${feelings}</div></div>
      <div style="border-top:2px solid #d8d2c7;padding:22px 0;font-size:27px"><b>${escapeXml(copy.inferenceLabel)}（${escapeXml(copy.inferenceHint)}）</b><div>${inferences}</div></div>
      <div style="border-top:2px solid #d8d2c7;padding:22px 0;font-size:27px"><b>${escapeXml(copy.needLabel)}</b><div>${needs}</div></div>
      <div style="border-top:2px solid #d8d2c7;padding:22px 0;font-size:27px"><b>${escapeXml(copy.requestLabel)}</b><div>${request}</div></div>
      <div style="margin-top:30px;padding:34px;border-left:8px solid #6e8490;background:#eef0ec;font-family:'Songti SC',serif;font-size:32px">${selectedText}</div>
      <div style="margin-top:30px;font-size:21px;color:#67716d">${escapeXml(copy.responsibilityNotice)}</div>
    </div>
  </foreignObject>
</svg>`
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const right = x + width
  const bottom = y + height
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(right - radius, y)
  context.quadraticCurveTo(right, y, right, y + radius)
  context.lineTo(right, bottom - radius)
  context.quadraticCurveTo(right, bottom, right - radius, bottom)
  context.lineTo(x + radius, bottom)
  context.quadraticCurveTo(x, bottom, x, bottom - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const character of Array.from(paragraph)) {
      const candidate = line + character
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = character
      } else {
        line = candidate
      }
    }
    lines.push(line || '—')
  }
  return lines
}

function drawLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, initialSize: number, minimumSize: number) {
  for (let size = initialSize; size >= minimumSize; size -= 2) {
    context.font = `600 ${size}px ${SERIF_FONT}`
    const lineHeight = Math.round(size * 1.55)
    const lines = wrapText(context, text, maxWidth)
    if (lines.length * lineHeight <= maxHeight) return { lines, lineHeight, size }
  }
  context.font = `600 ${minimumSize}px ${SERIF_FONT}`
  return { lines: wrapText(context, text, maxWidth), lineHeight: Math.round(minimumSize * 1.45), size: minimumSize }
}

export function renderReplayCardPng(data: ReplayCardExportData, copy: ReplayCardExportCopy) {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D unavailable')

  context.fillStyle = '#f5f2eb'
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  context.save()
  context.shadowColor = 'rgba(48, 55, 53, 0.13)'
  context.shadowBlur = 36
  context.shadowOffsetY = 16
  roundedRect(context, 54, 46, 972, 1348, 24)
  context.fillStyle = '#fffdf8'
  context.fill()
  context.restore()
  roundedRect(context, 54, 46, 972, 1348, 24)
  context.strokeStyle = '#d8d2c7'
  context.lineWidth = 2
  context.stroke()

  context.fillStyle = '#526a76'
  context.font = `700 22px ${UI_FONT}`
  context.fillText(copy.brandLabel, 112, 118)
  context.fillStyle = '#8a918d'
  context.font = `500 20px ${UI_FONT}`
  context.textAlign = 'right'
  context.fillText(copy.attributionLabel, 968, 118)
  context.textAlign = 'left'

  context.fillStyle = '#303735'
  context.font = `700 52px ${SERIF_FONT}`
  const titleLines = wrapText(context, data.title, 790).slice(0, 2)
  drawLines(context, titleLines, 112, 194, 66)
  const titleBottom = 194 + (titleLines.length - 1) * 66
  context.fillStyle = '#b18a52'
  context.fillRect(112, titleBottom + 36, 74, 5)

  const layers = [
    { number: '01', label: copy.factLabel, text: data.facts.join('；') || copy.emptyFact, color: '#6e8490' },
    { number: '02', label: copy.feelingLabel, text: data.feelings.join('、') || copy.emptyFeeling, color: '#82917f' },
    { number: '03', label: copy.inferenceLabel, hint: copy.inferenceHint, text: data.inferences.join('；') || copy.emptyInference, color: '#a87972' },
    { number: '04', label: copy.needLabel, text: data.needs.join('、') || copy.emptyNeed, color: '#82917f' },
    { number: '05', label: copy.requestLabel, text: data.request ?? copy.emptyRequest, color: '#b18a52' },
  ]

  const layerTop = titleBottom + 74
  const layerBottomLimit = 870
  let layerFontSize = 27
  let layerLineHeight = 40
  let rows: Array<{ lines: string[]; height: number }> = []
  for (; layerFontSize >= 21; layerFontSize -= 2) {
    context.font = `500 ${layerFontSize}px ${UI_FONT}`
    layerLineHeight = Math.round(layerFontSize * 1.5)
    rows = layers.map(({ text }) => {
      const lines = wrapText(context, text, 650)
      return { lines, height: Math.max(82, lines.length * layerLineHeight + 24) }
    })
    if (rows.reduce((sum, row) => sum + row.height, 0) <= layerBottomLimit - layerTop) break
  }

  let rowY = layerTop
  layers.forEach((layer, index) => {
    const row = rows[index]
    context.strokeStyle = '#ded9cf'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(112, rowY)
    context.lineTo(968, rowY)
    context.stroke()

    context.fillStyle = layer.color
    context.font = `700 20px ${UI_FONT}`
    context.fillText(layer.number, 112, rowY + 39)
    context.font = `700 27px ${SERIF_FONT}`
    context.fillText(layer.label, 162, rowY + 40)
    if (layer.hint) {
      context.fillStyle = '#8a756f'
      context.font = `500 17px ${UI_FONT}`
      context.fillText(layer.hint, 162, rowY + 66)
    }

    context.fillStyle = '#3f4744'
    context.font = `500 ${layerFontSize}px ${UI_FONT}`
    drawLines(context, row.lines, 300, rowY + 39, layerLineHeight)
    rowY += row.height
  })

  const statementTop = Math.max(rowY + 24, 888)
  const statementBottom = 1265
  roundedRect(context, 96, statementTop, 888, statementBottom - statementTop, 12)
  context.fillStyle = '#eef0ec'
  context.fill()
  context.fillStyle = '#6e8490'
  context.fillRect(96, statementTop, 8, statementBottom - statementTop)
  context.fillStyle = '#526a76'
  context.font = `700 21px ${UI_FONT}`
  context.fillText(copy.statementLabel, 140, statementTop + 48)

  const fitted = fitText(context, data.selectedText, 788, statementBottom - statementTop - 112, 38, 20)
  context.fillStyle = '#303735'
  context.font = `600 ${fitted.size}px ${SERIF_FONT}`
  drawLines(context, fitted.lines, 140, statementTop + 103, fitted.lineHeight)

  context.fillStyle = '#68716d'
  context.font = `500 20px ${UI_FONT}`
  context.fillText(copy.responsibilityNotice, 112, 1334)
  context.textAlign = 'right'
  context.fillStyle = '#9a8b72'
  context.fillText(copy.footerNote, 968, 1367)

  return canvas.toDataURL('image/png')
}

function resolveMiniToolBridge(): MiniToolBridge | undefined {
  if (typeof window === 'undefined') return undefined
  const miniTool = (window as Window & { xhs?: { miniTool?: Partial<MiniToolBridge> } }).xhs?.miniTool
  if (typeof miniTool?.writeTempFile !== 'function' || typeof miniTool.saveImageToPhotosAlbum !== 'function') return undefined
  return miniTool as MiniToolBridge
}

export async function downloadReplayCard(data: ReplayCardExportData, copy: ReplayCardExportCopy): Promise<ReplayCardSaveOutcome> {
  const bridge = resolveMiniToolBridge()
  if (!bridge) return { status: 'unavailable' }
  let pngDataUrl: string
  try {
    pngDataUrl = renderReplayCardPng(data, copy)
  } catch {
    return { status: 'generation-failed' }
  }
  let temporary: { filePath?: string }
  try {
    temporary = await bridge.writeTempFile({ data: pngDataUrl })
    if (!temporary.filePath) throw new Error('writeTempFile returned no filePath')
  } catch {
    return { status: 'write-failed' }
  }
  try {
    await bridge.saveImageToPhotosAlbum({ filePath: temporary.filePath })
    return { status: 'saved' }
  } catch {
    return { status: 'permission-failed' }
  }
}
