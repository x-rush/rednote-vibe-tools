import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const baseUrl = process.env.DALISIZIAN_URL ?? 'http://127.0.0.1:5177/'
const cdpUrl = process.env.DALISIZIAN_CDP ?? 'http://127.0.0.1:9222'
const outputDir = new URL('../output/playwright/', import.meta.url)
const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf8'))
mkdirSync(outputDir, { recursive: true })

const targets = await (await fetch(`${cdpUrl}/json`)).json()
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('No Chrome page target found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
const browserErrors = []
let nextId = 0
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  } else if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails.text)
  } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    browserErrors.push(`${message.params.type}: ${message.params.args.map((item) => item.value ?? item.description).join(' ')}`)
  }
}
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression, awaitPromise = false) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(expression, timeout = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

async function screenshot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  writeFileSync(new URL(name, outputDir), Buffer.from(result.data, 'base64'))
}

async function seedSave(data) {
  const envelope = {
    schemaVersion: 1,
    contentVersion: content.contentVersion,
    updatedAt: '2026-08-27T02:00:00.000Z',
    data: { bestRatings: {}, settings: { muted: false, reducedMotion: false }, ...data },
  }
  await evaluate(`(() => {
    localStorage.setItem('xhs-tool:dalisizian:state:v1', ${JSON.stringify(JSON.stringify(envelope))})
    location.reload()
  })()`)
  await waitFor(`document.querySelector('.landing-screen') !== null`)
}

async function seedThirdCase() {
  await seedSave({
    unlockedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree', 'case-take-ear'],
    completedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree'],
  })
}

await command('Page.enable')
await command('Runtime.enable')
await command('Log.enable')
await command('Page.navigate', { url: baseUrl })
await waitFor(`document.readyState === 'complete'`)

const reports = []
const viewports = [
  { width: 375, height: 667, safeTop: 47 },
  { width: 390, height: 844, safeTop: 24 },
  { width: 430, height: 932, safeTop: 47 },
]

for (const viewport of viewports) {
  await command('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true })
  await command('Page.navigate', { url: baseUrl })
  await waitFor(`document.querySelector('.landing-screen') !== null`)
  await seedThirdCase()
  await evaluate(`document.documentElement.style.setProperty('--safe-area-inset-top', ${JSON.stringify(`${viewport.safeTop}px`)})`)
  await waitFor(`[...document.images].filter((item) => item.getClientRects().length).every((item) => item.complete)`)

  const report = await evaluate(`(() => {
    const brand = document.querySelector('.landing-brand').getBoundingClientRect()
    const companion = document.querySelector('.landing-companion').getBoundingClientRect()
    const plaque = document.querySelector('.landing-companion-plaque').getBoundingClientRect()
    const role = document.querySelector('.landing-companion-plaque i')
    const desk = document.querySelector('.landing-desk').getBoundingClientRect()
    const primary = document.querySelector('.landing-primary')
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      safeTop: ${viewport.safeTop},
      brandTop: brand.top,
      companionLeft: companion.left,
      companionRight: companion.right,
      plaqueLeft: plaque.left,
      plaqueRight: plaque.right,
      plaqueBottom: plaque.bottom,
      deskTop: desk.top,
      roleClientWidth: role.clientWidth,
      roleScrollWidth: role.scrollWidth,
      roleClientHeight: role.clientHeight,
      roleScrollHeight: role.scrollHeight,
      primaryHeight: primary.getBoundingClientRect().height,
      primaryLabel: primary.textContent.replace(/\\s+/g, ''),
      currentTitle: document.querySelector('.landing-current b').textContent,
      brokenImages: [...document.images].filter((item) => item.getClientRects().length && item.naturalWidth === 0).length
    }
  })()`)

  if (
    report.documentWidth !== viewport.width
    || report.brandTop < viewport.safeTop
    || report.companionLeft > 1
    || report.companionRight > viewport.width + 24
    || report.plaqueLeft < 0
    || report.plaqueRight > viewport.width
    || report.plaqueBottom > report.deskTop - 6
    || report.roleScrollWidth > report.roleClientWidth + 1
    || report.roleScrollHeight > report.roleClientHeight + 1
    || report.roleClientHeight < 24
    || report.primaryHeight < 48
    || report.primaryLabel !== '领取第三案→'
    || report.currentTitle !== '取字失耳案'
    || report.brokenImages !== 0
  ) {
    throw new Error(`Landing regression at ${viewport.width}: ${JSON.stringify(report)}`)
  }
  reports.push(report)
  await screenshot(`dalisizian-landing-third-case-${viewport.width}.png`)
}

await evaluate(`document.querySelector('.landing-primary').click()`)
await waitFor(`document.querySelector('.case-shell') !== null`)
const openedCase = await evaluate(`document.querySelector('#case-title')?.textContent ?? document.body.textContent`)
if (!openedCase.includes('取字失耳案')) throw new Error(`Primary action opened the wrong case: ${openedCase}`)

await command('Page.navigate', { url: baseUrl })
await waitFor(`document.querySelector('.landing-screen') !== null`)
await seedSave({
  currentCaseId: 'case-rest-under-tree',
  unlockedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree'],
  completedCaseIds: ['case-home-roof-pig'],
})
const resumeLabel = await evaluate(`document.querySelector('.landing-primary').textContent.replace(/\\s+/g, '')`)
if (resumeLabel !== '继续第二案→') throw new Error(`Resume CTA regression: ${resumeLabel}`)
await evaluate(`document.querySelector('.landing-primary').click()`)
await waitFor(`document.querySelector('#case-title')?.textContent === '休字树下案'`)

const allCaseIds = content.content.cases.sort((a, b) => a.order - b.order).map((item) => item.caseId)
await command('Page.navigate', { url: baseUrl })
await waitFor(`document.querySelector('.landing-screen') !== null`)
await seedSave({ unlockedCaseIds: allCaseIds, completedCaseIds: allCaseIds })
const completeLabel = await evaluate(`document.querySelector('.landing-primary').textContent.replace(/\\s+/g, '')`)
if (completeLabel !== '查看断案图鉴→') throw new Error(`Complete CTA regression: ${completeLabel}`)
await evaluate(`document.querySelector('.landing-primary').click()`)
await waitFor(`document.querySelector('.collection-screen') !== null`)

if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`)
console.log(JSON.stringify({ reports, openedCase: '取字失耳案', resumedCase: '休字树下案', allCompleteRoute: '断案图鉴', browserErrors }, null, 2))
socket.close()
