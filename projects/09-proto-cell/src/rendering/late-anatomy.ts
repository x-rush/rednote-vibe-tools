import type { CellPalette } from './cell'
import type { RenderQuality } from './effects'

const TAU = Math.PI * 2
const CHAMBERS = [{ x: 0.4, y: 0 }, { x: -0.25, y: -0.35 }, { x: -0.25, y: 0.35 }] as const

/** All filled anatomy is drawn inside the caller's authoritative membrane clip. */
export function drawColonyAnatomy(context: CanvasRenderingContext2D, radius: number, time: number, palette: CellPalette, quality: RenderQuality | undefined) {
  context.save()
  context.lineCap = 'round'
  // Shared cytoplasmic bridges carry discrete boluses between the three cells.
  for (let index = 0; index < 3; index += 1) {
    const start = CHAMBERS[index]!
    const end = CHAMBERS[(index + 1) % 3]!
    context.strokeStyle = 'rgb(4 26 43 / 78%)'
    context.lineWidth = radius * 0.12
    context.beginPath()
    context.moveTo(start.x * radius, start.y * radius)
    context.lineTo(end.x * radius, end.y * radius)
    context.stroke()
    context.strokeStyle = palette.organ
    context.lineWidth = Math.max(1, radius * 0.025)
    context.stroke()
    const travel = (time / 1900 + index / 3) % 1
    context.fillStyle = palette.core
    context.beginPath()
    context.arc((start.x + (end.x - start.x) * travel) * radius, (start.y + (end.y - start.y) * travel) * radius, radius * 0.035, 0, TAU)
    context.fill()
  }
  for (let index = 0; index < 3; index += 1) {
    const chamber = CHAMBERS[index]!
    const x = chamber.x * radius
    const y = chamber.y * radius
    context.fillStyle = 'rgb(9 34 57 / 48%)'
    context.strokeStyle = palette.membrane
    context.lineWidth = Math.max(1.1, radius * 0.035)
    context.beginPath()
    context.ellipse(x, y, radius * 0.32, radius * 0.285, index === 0 ? 0 : index === 1 ? 0.45 : -0.45, 0, TAU)
    context.fill()
    context.stroke()
    // Each chamber has an independent contractile pump beneath its nucleus.
    const pump = 0.065 + Math.sin(time / 230 + index * 2.1) * 0.008
    context.fillStyle = palette.organ
    context.beginPath()
    context.ellipse(x + radius * 0.13, y + radius * 0.18, radius * pump, radius * pump * 0.72, 0, 0, TAU)
    context.fill()
    if (quality !== 'low') {
      context.strokeStyle = 'rgb(220 255 255 / 55%)'
      context.lineWidth = Math.max(0.7, radius * 0.016)
      for (let ray = 0; ray < 4; ray += 1) {
        const angle = ray * TAU / 4
        context.beginPath()
        context.moveTo(x + radius * (0.13 + Math.cos(angle) * 0.08), y + radius * (0.18 + Math.sin(angle) * 0.07))
        context.lineTo(x + radius * (0.13 + Math.cos(angle) * 0.14), y + radius * (0.18 + Math.sin(angle) * 0.12))
        context.stroke()
      }
    }
  }
  // Perforated septa separate the shared central junction from the three cells.
  context.strokeStyle = palette.organ
  context.lineWidth = Math.max(1, radius * 0.035)
  for (let index = 0; index < 3; index += 1) {
    const angle = index * TAU / 3 + Math.PI / 3
    context.beginPath()
    context.moveTo(Math.cos(angle) * radius * 0.13, Math.sin(angle) * radius * 0.13)
    context.lineTo(Math.cos(angle) * radius * 0.68, Math.sin(angle) * radius * 0.68)
    context.stroke()
  }
  context.restore()
}

export function drawFeedingChannel(context: CanvasRenderingContext2D, radius: number, time: number, palette: CellPalette, quality: RenderQuality | undefined) {
  context.save()
  // A dark vestibule opens onto a double walled, curved phagocytosis channel.
  context.fillStyle = 'rgb(3 14 31 / 90%)'
  context.strokeStyle = palette.membrane
  context.lineWidth = Math.max(1.2, radius * 0.035)
  context.beginPath()
  context.moveTo(radius * 0.76, -radius * 0.22)
  context.bezierCurveTo(radius * 0.45, -radius * 0.24, radius * 0.22, radius * 0.24, -radius * 0.12, radius * 0.32)
  context.bezierCurveTo(radius * 0.24, radius * 0.48, radius * 0.42, radius * 0.13, radius * 0.78, radius * 0.04)
  context.closePath()
  context.fill()
  context.stroke()
  context.strokeStyle = palette.organ
  context.lineWidth = Math.max(1.1, radius * 0.025)
  const rows = quality === 'low' ? 4 : 8
  for (let index = 0; index < rows; index += 1) {
    const travel = index / rows
    const x = 0.64 - travel * 0.6
    const y = -0.12 + Math.sin(travel * Math.PI / 2) * 0.46
    const sweep = Math.sin(time / 150 - travel * 5) * 0.035
    context.beginPath()
    context.moveTo(x * radius, y * radius)
    context.lineTo((x - 0.09) * radius, (y - 0.1 + sweep) * radius)
    context.stroke()
  }
  context.fillStyle = palette.core
  const travel = time / 1600 % 1
  context.beginPath()
  context.arc((0.66 - travel * 0.7) * radius, (-0.08 + travel * 0.41) * radius, radius * 0.035, 0, TAU)
  context.fill()
  context.restore()
}

export function drawLateCreatureAnatomy(context: CanvasRenderingContext2D, definitionId: string, radius: number, time: number, palette: CellPalette, exposed: boolean, quality: RenderQuality | undefined) {
  if (definitionId !== 'creature-thornback-forager' && definitionId !== 'predator-seam-lurker' && definitionId !== 'creature-lantern-siphon' && definitionId !== 'predator-razor-ray' && definitionId !== 'predator-chamber-maw') return
  context.save()
  context.strokeStyle = palette.organ
  context.fillStyle = 'rgb(5 15 32 / 70%)'
  context.lineWidth = Math.max(1.3, radius * 0.04)
  if (definitionId === 'creature-thornback-forager') {
    // Broad overlapping mineral scutes, with the grazing intake beneath them.
    for (let plate = 0; plate < 4; plate += 1) {
      const x = (-0.48 + plate * 0.28) * radius
      context.beginPath()
      context.moveTo(x - radius * 0.14, -radius * 0.48)
      context.lineTo(x + radius * 0.14, -radius * 0.37)
      context.lineTo(x + radius * 0.19, radius * 0.37)
      context.lineTo(x - radius * 0.12, radius * 0.49)
      context.closePath()
      context.fill()
      context.stroke()
    }
    context.beginPath()
    context.ellipse(radius * 0.62, radius * 0.16, radius * 0.1, radius * 0.22, -0.4, 0, TAU)
    context.stroke()
  } else if (definitionId === 'predator-seam-lurker') {
    // A luminous slit along a long opaque feeding sheath.
    context.lineWidth = radius * 0.2
    context.strokeStyle = 'rgb(17 5 36 / 90%)'
    context.beginPath()
    context.moveTo(-radius * 0.7, radius * 0.12)
    context.bezierCurveTo(-radius * 0.15, -radius * 0.3, radius * 0.34, radius * 0.3, radius * 0.82, 0)
    context.stroke()
    context.lineWidth = Math.max(1.5, radius * 0.035)
    context.strokeStyle = palette.core
    context.stroke()
  } else if (definitionId === 'creature-lantern-siphon') {
    context.strokeStyle = palette.membrane
    for (let bulb = 0; bulb < 3; bulb += 1) {
      const x = (-0.36 + bulb * 0.32) * radius
      context.fillStyle = bulb === 1 ? palette.core : palette.organ
      context.beginPath()
      context.ellipse(x, -radius * 0.12, radius * 0.14, radius * 0.28, -0.2, 0, TAU)
      context.fill()
      context.stroke()
    }
    context.beginPath()
    context.moveTo(radius * 0.76, -radius * 0.15)
    context.quadraticCurveTo(radius * 0.44, radius * 0.48, -radius * 0.63, radius * 0.25)
    context.stroke()
  } else if (definitionId === 'predator-razor-ray') {
    // Paired angular fin blades remain inside the physical body boundary.
    for (let side = -1; side <= 1; side += 2) {
      context.fillStyle = palette.organ
      context.beginPath()
      context.moveTo(radius * 0.67, 0)
      context.lineTo(-radius * 0.18, side * radius * 0.78)
      context.lineTo(-radius * 0.58, side * radius * 0.4)
      context.lineTo(radius * 0.08, side * radius * 0.08)
      context.closePath()
      context.fill()
      context.strokeStyle = palette.membrane
      context.stroke()
    }
  } else if (definitionId === 'predator-chamber-maw') {
    drawLeviathan(context, radius, time, palette, exposed, quality)
  }
  context.restore()
}

function drawLeviathan(context: CanvasRenderingContext2D, radius: number, time: number, palette: CellPalette, exposed: boolean, quality: RenderQuality | undefined) {
  const opening = exposed ? 0.48 : 0.2
  // A luminous deep core, encased by a ribbed furnace and two enormous jaw plates.
  context.fillStyle = 'rgb(6 10 25 / 88%)'
  context.strokeStyle = palette.organ
  context.lineWidth = radius * 0.055
  context.beginPath()
  context.ellipse(-radius * 0.14, 0, radius * 0.47, radius * 0.54, 0, 0, TAU)
  context.fill()
  context.stroke()
  context.fillStyle = palette.core
  context.beginPath()
  context.ellipse(-radius * 0.18, 0, radius * (exposed ? 0.3 : 0.21), radius * 0.3, 0, 0, TAU)
  context.fill()
  context.fillStyle = '#f1ffff'
  context.beginPath()
  context.ellipse(-radius * 0.22, -radius * 0.06, radius * 0.075, radius * 0.15, 0.25, 0, TAU)
  context.fill()
  context.lineWidth = Math.max(2, radius * 0.035)
  for (let side = -1; side <= 1; side += 2) {
    context.fillStyle = exposed ? '#55324f' : '#76532c'
    context.strokeStyle = palette.membrane
    context.beginPath()
    context.moveTo(-radius * 0.14, side * radius * 0.63)
    context.lineTo(radius * 0.48, side * radius * 0.66)
    context.lineTo(radius * 0.88, side * radius * opening)
    context.lineTo(radius * 0.43, side * radius * (opening + 0.07))
    context.lineTo(radius * 0.16, side * radius * 0.18)
    context.closePath()
    context.fill()
    context.stroke()
    const teeth = quality === 'low' ? 3 : 5
    for (let tooth = 0; tooth < teeth; tooth += 1) {
      const x = 0.26 + tooth / teeth * 0.45
      const y = side * (opening + (1 - tooth / teeth) * 0.08)
      context.fillStyle = '#ffe0a2'
      context.beginPath()
      context.moveTo(x * radius, y * radius)
      context.lineTo((x + 0.07) * radius, y * radius)
      context.lineTo((x + 0.035) * radius, (y - side * 0.12) * radius)
      context.closePath()
      context.fill()
    }
  }
  // Crown scutes stay readable in low detail; recovery parts them around the core.
  for (let plate = 0; plate < 5; plate += 1) {
    const angle = Math.PI * 0.62 + plate * Math.PI * 0.19
    const spread = exposed ? 0.78 : 0.65
    context.fillStyle = exposed ? '#634057' : '#b67f32'
    context.strokeStyle = palette.membrane
    context.beginPath()
    context.moveTo(Math.cos(angle - 0.14) * radius * spread, Math.sin(angle - 0.14) * radius * spread)
    context.lineTo(Math.cos(angle) * radius * 0.94, Math.sin(angle) * radius * 0.94)
    context.lineTo(Math.cos(angle + 0.14) * radius * spread, Math.sin(angle + 0.14) * radius * spread)
    context.closePath()
    context.fill()
    context.stroke()
  }
  if (quality !== 'low') {
    context.strokeStyle = palette.core
    context.lineWidth = Math.max(1, radius * 0.018)
    context.beginPath()
    context.ellipse(-radius * 0.18, 0, radius * (0.36 + Math.sin(time / 480) * 0.01), radius * 0.39, 0, 0, TAU)
    context.stroke()
  }
}
