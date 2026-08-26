import { getCardSectionArtwork } from '../app/presentation'
import type { RelationshipCardViewModel, SentenceRole } from '../content/schema'

export const SHARE_CARD_WIDTH = 1080
export const SHARE_CARD_MIN_HEIGHT = 960

export type MiniToolAlbumBridge = {
  writeTempFile: (options: { data: string }) => Promise<{ filePath: string; errMsg?: string }>
  saveImageToPhotosAlbum: (options: { filePath: string }) => Promise<{ errMsg?: string }>
}

type MiniToolWindow = Window & {
  xhs?: {
    miniTool?: MiniToolAlbumBridge
  }
}

const ROLE_LABELS: Record<SentenceRole, string> = {
  need: '我的需要',
  trigger: '容易卡住的时刻',
  action: '可以这样做',
  repair: '一起修复',
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(value: string, maxCharacters: number) {
  const characters = Array.from(value.trim().replace(/\s+/g, ' '))
  const lines: string[] = []
  for (let offset = 0; offset < characters.length; offset += maxCharacters) {
    lines.push(characters.slice(offset, offset + maxCharacters).join(''))
  }
  return lines.length > 0 ? lines : ['—']
}

function textLines(lines: string[], x: number, y: number, lineHeight: number, className: string) {
  return `<text class="${className}" x="${x}" y="${y}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`
}

export function buildShareCardSvg(card: RelationshipCardViewModel) {
  const sections = card.sections.filter((section) => section.visible)
  const summaryLines = wrapText(card.shareSummary, 20)
  const summaryY = 330
  const summaryLineHeight = 58
  const headerDividerY = summaryY + (summaryLines.length - 1) * summaryLineHeight + 90
  let sectionCursor = headerDividerY + 30
  const sectionMarkup = sections.map((section, index) => {
    const top = sectionCursor
    const role = section.paragraphRoles[0] ?? 'need'
    const artwork = getCardSectionArtwork(section.sectionId)
    const paragraphLines = wrapText(section.paragraphs[0] ?? '—', 20)
    const sectionHeight = Math.max(390, 300 + paragraphLines.length * 58)
    sectionCursor += sectionHeight
    return `
      <g>
        <line x1="90" y1="${top + sectionHeight}" x2="990" y2="${top + sectionHeight}" class="divider" />
        <circle cx="128" cy="${top + 58}" r="30" class="number-ring" />
        <text x="128" y="${top + 67}" class="topic-mark" text-anchor="middle">${escapeXml(artwork.shortLabel.slice(0, 1))}</text>
        <text x="182" y="${top + 43}" class="section-meta">${String(index + 1).padStart(2, '0')} / ${escapeXml(artwork.shortLabel)}</text>
        <text x="182" y="${top + 91}" class="section-title">${escapeXml(section.title)}</text>
        ${section.sensitive ? `<text x="920" y="${top + 61}" class="sensitive" text-anchor="end">敏感</text>` : ''}
        <text x="90" y="${top + 170}" class="role">${escapeXml(ROLE_LABELS[role])}</text>
        ${textLines(paragraphLines, 90, top + 230, 58, 'section-copy')}
      </g>`
  }).join('')
  const disclaimerLines = wrapText(card.disclaimer, 34)
  const footerTop = sectionCursor + 36
  const footerCopyY = footerTop + 110
  const cardHeight = Math.max(
    SHARE_CARD_MIN_HEIGHT,
    footerCopyY + Math.max(0, disclaimerLines.length - 1) * 38 + 90,
  )
  const paperHeight = cardHeight - 70

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${cardHeight}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${cardHeight}">
    <defs>
      <pattern id="ruled-paper" width="44" height="44" patternUnits="userSpaceOnUse">
        <line x1="0" y1="43.5" x2="1080" y2="43.5" stroke="#6d8390" stroke-opacity="0.09" stroke-width="1" />
      </pattern>
      <filter id="paper-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#493b2d" flood-opacity="0.13" />
      </filter>
      <style>
        text { font-family: "Noto Serif SC", "Songti SC", "STSong", serif; fill: #293633; }
        .sans { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; }
        .meta { font-size: 24px; font-weight: 700; letter-spacing: 4px; fill: #7b443b; }
        .title { font-size: 80px; font-weight: 700; letter-spacing: -3px; }
        .summary { font-size: 44px; fill: #55625d; }
        .section-meta { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; font-size: 21px; font-weight: 800; letter-spacing: 3px; fill: #a86155; }
        .section-title { font-size: 36px; font-weight: 700; }
        .role { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; font-size: 24px; font-weight: 700; letter-spacing: 2px; fill: #657d6b; }
        .section-copy { font-size: 40px; fill: #3f4945; }
        .number-ring { fill: #f9f3e9; stroke: #718a77; stroke-width: 2; }
        .topic-mark { font-size: 20px; font-weight: 700; fill: #657d6b; }
        .divider { stroke: #bfb2a0; stroke-opacity: 0.62; }
        .sensitive { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; font-size: 20px; font-weight: 700; fill: #8a4d43; }
        .footer-brand { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; font-size: 23px; font-weight: 800; letter-spacing: 3px; fill: #a86155; }
        .footer-copy { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; font-size: 24px; fill: #6e756f; }
      </style>
    </defs>
    <rect width="1080" height="${cardHeight}" fill="#e9decc" />
    <rect x="35" y="35" width="1010" height="${paperHeight}" fill="#fffaf1" stroke="#b9aa95" filter="url(#paper-shadow)" />
    <rect x="35" y="35" width="1010" height="${paperHeight}" fill="url(#ruled-paper)" />
    <path d="M 935 35 H 1045 V 145 Z" fill="#e9decc" stroke="#b9aa95" />
    <text x="90" y="96" class="meta sans">${escapeXml(card.relationshipLabel)}</text>
    <text x="900" y="96" class="meta sans" text-anchor="end">简洁分享版</text>
    <text x="90" y="220" class="title">${escapeXml(card.title)}</text>
    ${textLines(summaryLines, 92, summaryY, summaryLineHeight, 'summary')}
    <line x1="90" y1="${headerDividerY}" x2="990" y2="${headerDividerY}" class="divider" />
    ${sectionMarkup}
    <line x1="90" y1="${footerTop}" x2="990" y2="${footerTop}" class="divider" />
    <text x="90" y="${footerTop + 58}" class="footer-brand">RELATIONSHIP MANUAL</text>
    ${textLines(disclaimerLines, 90, footerCopyY, 38, 'footer-copy')}
  </svg>`
}

function svgHeight(svg: string) {
  const height = Number(svg.match(/<svg[^>]*height="(\d+)"/)?.[1])
  if (!Number.isFinite(height) || height < SHARE_CARD_MIN_HEIGHT) throw new Error('invalid-svg-height')
  return height
}

function svgToPngDataUrl(svg: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SHARE_CARD_WIDTH
        canvas.height = svgHeight(svg)
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('canvas-unavailable'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('svg-render-failed'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

export async function savePngDataUrlToPhotosAlbum(data: string, bridge: MiniToolAlbumBridge) {
  if (!data.startsWith('data:image/png;base64,')) throw new Error('invalid-png-data-uri')
  const tempFile = await bridge.writeTempFile({ data })
  if (!tempFile.filePath) throw new Error('temp-file-missing')
  await bridge.saveImageToPhotosAlbum({ filePath: tempFile.filePath })
}

export async function saveShareCardPng(card: RelationshipCardViewModel) {
  const bridge = (window as MiniToolWindow).xhs?.miniTool
  if (!bridge) throw new Error('mini-tool-bridge-unavailable')
  const pngDataUrl = await svgToPngDataUrl(buildShareCardSvg(card))
  await savePngDataUrlToPhotosAlbum(pngDataUrl, bridge)
}
