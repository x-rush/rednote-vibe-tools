import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const baseUrl = process.env.DALISIZIAN_URL ?? 'http://127.0.0.1:5177/'
const cdpUrl = process.env.DALISIZIAN_CDP ?? 'http://127.0.0.1:9222'
const outputDir = new URL('../output/playwright/', import.meta.url)
const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf8'))
const cases = content.content.cases
const evidence = content.content.evidence
const caseIds = cases.map((item) => item.caseId)
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

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))
async function waitFor(expression, timeout = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

async function screenshot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  writeFileSync(new URL(name, outputDir), Buffer.from(result.data, 'base64'))
}

async function seedCase(caseData, evidenceIds) {
  const state = {
    caseId: caseData.caseId,
    screen: 'briefing',
    currentNodeId: caseData.startNodeId,
    flags: {},
    clueIds: [],
    evidenceIds,
    evidenceObservationIdsByEvidenceId: {},
    unlockedSceneIds: [],
    visitedNodeIds: [],
    deductionAnswers: {},
    deductionAttempts: {},
    firstDeductionAnswers: {},
    reviewedRouteIds: [],
    styleTags: [],
    completed: false,
  }
  await evaluate(`(async () => {
    localStorage.setItem('xhs-tool:dalisizian:state:v1', JSON.stringify({
      schemaVersion: 1,
      contentVersion: ${JSON.stringify(content.contentVersion)},
      updatedAt: '2026-08-26T00:00:00.000Z',
      data: {
        currentCaseId: ${JSON.stringify(caseData.caseId)},
        unlockedCaseIds: ${JSON.stringify(caseIds)},
        completedCaseIds: [],
        bestRatings: {},
        settings: { muted: false, reducedMotion: false }
      }
    }))
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('xhs_zi_an_lu', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('caseProgress')) db.createObjectStore('caseProgress', { keyPath: 'caseId' })
        if (!db.objectStoreNames.contains('caseVerdicts')) db.createObjectStore('caseVerdicts', { keyPath: 'caseId' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('caseProgress', 'readwrite')
      transaction.objectStore('caseProgress').put({ caseId: ${JSON.stringify(caseData.caseId)}, value: ${JSON.stringify(state)} })
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })()`, true)
}

async function openSeededLedger() {
  await command('Page.navigate', { url: baseUrl })
  await waitFor(`document.querySelector('.landing-screen') !== null`)
  await evaluate(`document.querySelector('.landing-primary').click()`)
  await waitFor(`document.querySelector('.case-shell') !== null`)
  await evaluate(`document.querySelector('.ledger-button').click()`)
  await waitFor(`document.querySelector('.ledger-screen') !== null`)
}

async function inspectEvidence(evidenceId) {
  await evaluate(`document.querySelector('[data-evidence-trigger=${JSON.stringify(evidenceId)}]').click()`)
  await waitFor(`document.querySelector('[data-evidence-id=${JSON.stringify(evidenceId)}]') !== null`)
  await waitFor(`[...document.images].filter((image) => image.getClientRects().length).every((image) => image.complete)`)
  await waitFor(`Boolean(document.activeElement.closest?.('.evidence-artifact'))`)
  const report = await evaluate(`(() => {
    const artifact = document.querySelector('[data-evidence-id=${JSON.stringify(evidenceId)}]')
    const buttons = [...artifact.querySelectorAll('button')]
    const plateImage = artifact.querySelector('.evidence-plate > img')
    return {
      id: artifact.dataset.evidenceId,
      template: artifact.dataset.template,
      observationCount: artifact.querySelectorAll('.evidence-hotspots button').length,
      primarySrc: plateImage?.currentSrc ?? '',
      primarySize: [plateImage?.naturalWidth ?? 0, plateImage?.naturalHeight ?? 0],
      duplicateGlyphOverlays: artifact.querySelectorAll('.glyph-facsimile-layer').length,
      brokenImages: [...document.images].filter((image) => image.getClientRects().length && image.naturalWidth === 0).length,
      placeholder: document.body.textContent.includes('人工核验资源位'),
      minTarget: Math.min(...buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
      activeInArtifact: Boolean(document.activeElement.closest?.('.evidence-artifact')),
    }
  })()`)
  if (report.id !== evidenceId || report.observationCount < 2 || !report.primarySrc.includes('-v3.webp') || report.primarySize[0] !== 1080 || report.primarySize[1] !== 720 || report.duplicateGlyphOverlays || report.brokenImages || report.placeholder || report.minTarget < 44 || !report.activeInArtifact) {
    throw new Error(`Evidence inspection regression: ${JSON.stringify(report)}`)
  }
  return report
}

async function inspectFallbackEvidence(evidenceId) {
  await evaluate(`document.querySelector('[data-evidence-trigger=${JSON.stringify(evidenceId)}]').click()`)
  await waitFor(`document.querySelector('[data-evidence-id=${JSON.stringify(evidenceId)}]') !== null`)
  await waitFor(`(() => {
    const image = document.querySelector('[data-evidence-id=${JSON.stringify(evidenceId)}] .evidence-plate > img')
    return image?.complete && image.currentSrc.includes('-v1.svg')
  })()`)
  const report = await evaluate(`(() => {
    const artifact = document.querySelector('[data-evidence-id=${JSON.stringify(evidenceId)}]')
    const image = artifact.querySelector('.evidence-plate > img')
    return {
      id: artifact.dataset.evidenceId,
      template: artifact.dataset.template,
      fallbackSrc: image.currentSrc,
      fallbackSize: [image.naturalWidth, image.naturalHeight],
      brokenImages: [...document.images].filter((item) => item.getClientRects().length && item.naturalWidth === 0).length,
      observationCount: artifact.querySelectorAll('.evidence-hotspots button').length,
    }
  })()`)
  const fallbackRatio = report.fallbackSize[0] / report.fallbackSize[1]
  if (!report.fallbackSrc.includes('-v1.svg') || report.fallbackSize[0] <= 0 || Math.abs(fallbackRatio - 1.5) > 0.01 || report.brokenImages || report.observationCount < 2) {
    throw new Error(`Evidence fallback regression: ${JSON.stringify(report)}`)
  }
  return report
}

await command('Page.enable')
await command('Runtime.enable')
await command('Log.enable')
await command('Page.navigate', { url: baseUrl })
await waitFor(`document.readyState === 'complete'`)

const viewportReports = []
const viewportCases = [
  { width: 375, height: 667, safeTop: 47 },
  { width: 390, height: 844, safeTop: 24 },
  { width: 430, height: 932, safeTop: 47 },
]
const homeCase = cases.find((item) => item.caseId === 'case-home-roof-pig')
const homeEvidence = evidence.find((item) => item.id === 'evidence-home-early-form')
if (!homeCase || !homeEvidence) throw new Error('Home browser fixtures missing')

for (const viewport of viewportCases) {
  await command('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true })
  await seedCase(homeCase, [homeEvidence.id])
  await openSeededLedger()
  const inspected = await inspectEvidence(homeEvidence.id)
  await evaluate(`document.documentElement.style.setProperty('--safe-area-inset-top', ${JSON.stringify(`${viewport.safeTop}px`)})`)
  const layout = await evaluate(`(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    safeTop: ${viewport.safeTop},
    headerTop: document.querySelector('.evidence-screen .page-header').getBoundingClientRect().top,
    artifactRight: document.querySelector('.evidence-artifact').getBoundingClientRect().right,
    artifactLeft: document.querySelector('.evidence-artifact').getBoundingClientRect().left,
  }))()`)
  if (layout.documentWidth > viewport.width || layout.headerTop < viewport.safeTop || layout.artifactLeft < 0 || layout.artifactRight > viewport.width) {
    throw new Error(`Evidence layout regression: ${JSON.stringify(layout)}`)
  }
  await evaluate(`[...document.querySelectorAll('.evidence-hotspots button')].forEach((button) => button.click())`)
  await waitFor(`document.querySelector('.evidence-artifact-heading strong').textContent.includes('已核')`)
  if (viewport.width === 390) await screenshot('dalisizian-evidence-inspector-390.png')
  await evaluate(`document.querySelector('.evidence-screen .page-header button').click()`)
  await waitFor(`document.querySelector('.ledger-screen') !== null`)
  await waitFor(`document.activeElement?.dataset?.evidenceTrigger === ${JSON.stringify(homeEvidence.id)}`)
  const focusRestored = await evaluate(`document.activeElement?.dataset?.evidenceTrigger === ${JSON.stringify(homeEvidence.id)}`)
  if (!focusRestored) throw new Error(`Evidence trigger focus was not restored at ${viewport.width}px`)
  viewportReports.push({ ...layout, ...inspected, focusRestored })
}

await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
const allEvidenceReports = []
for (const caseData of cases) {
  const caseEvidence = evidence.filter((item) => item.caseId === caseData.caseId)
  await seedCase(caseData, caseEvidence.map((item) => item.id))
  await openSeededLedger()
  for (const item of caseEvidence) {
    const report = await inspectEvidence(item.id)
    if (report.template !== item.visualSpec.template) throw new Error(`Wrong template for ${item.id}: ${report.template}`)
    allEvidenceReports.push(report)
    await evaluate(`document.querySelector('.evidence-screen .page-header button').click()`)
    await waitFor(`document.querySelector('.ledger-screen') !== null`)
  }
}
if (allEvidenceReports.length !== 32) throw new Error(`Expected 32 evidence reports, got ${allEvidenceReports.length}`)

await command('Network.enable')
await command('Network.setCacheDisabled', { cacheDisabled: true })
await command('Network.setBlockedURLs', { urls: ['*-v3.webp'] })
const fallbackReports = []
const homeCaseEvidence = evidence.filter((item) => item.caseId === homeCase.caseId)
await seedCase(homeCase, homeCaseEvidence.map((item) => item.id))
await openSeededLedger()
await waitFor(`[...document.querySelectorAll('.evidence-ledger-card .evidence-thumbnail img')].length === 4 && [...document.querySelectorAll('.evidence-ledger-card .evidence-thumbnail img')].every((image) => image.complete && image.currentSrc.includes('-v1.svg'))`)
const ledgerThumbnailFallbacks = await evaluate(`[...document.querySelectorAll('.evidence-ledger-card .evidence-thumbnail img')].filter((image) => image.currentSrc.includes('-v1.svg')).length`)
for (const item of homeCaseEvidence) {
  fallbackReports.push(await inspectFallbackEvidence(item.id))
  await evaluate(`document.querySelector('.evidence-screen .page-header button').click()`)
  await waitFor(`document.querySelector('.ledger-screen') !== null`)
}
if (fallbackReports.length !== 4 || new Set(fallbackReports.map((item) => item.template)).size !== 4) {
  throw new Error(`Expected four evidence-template fallbacks: ${JSON.stringify(fallbackReports)}`)
}

await seedCase(homeCase, [])
await command('Page.navigate', { url: baseUrl })
await waitFor(`document.querySelector('.landing-screen') !== null`)
await evaluate(`document.querySelector('.landing-primary').click()`)
await waitFor(`document.querySelector('.case-shell') !== null`)
let acquisitionSteps = 0
while (!(await evaluate(`document.querySelector('.evidence-acquired') !== null`)) && acquisitionSteps < 40) {
  acquisitionSteps += 1
  const advanced = await evaluate(`(() => {
    const route = document.querySelector('.route-card:not(.is-complete):not(:disabled)')
    const option = document.querySelector('.option-list button:not(:disabled)')
    const button = route ?? option
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!advanced) throw new Error(`Acquisition flow stopped at step ${acquisitionSteps}`)
  await sleep(280)
}
if (acquisitionSteps >= 40) throw new Error('Acquisition flow exceeded 40 steps')
await waitFor(`document.querySelector('.evidence-acquired .evidence-thumbnail img')?.currentSrc.includes('-v1.svg')`)
const acquisitionThumbnailFallback = await evaluate(`document.querySelector('.evidence-acquired .evidence-thumbnail img').currentSrc`)
const acquisitionMinTarget = await evaluate(`Math.min(...[...document.querySelectorAll('.evidence-acquired button')].map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height)))`)
if (acquisitionMinTarget < 44) throw new Error(`Acquisition target is too small: ${acquisitionMinTarget}`)
await evaluate(`document.querySelector('.evidence-acquired [data-evidence-trigger]').click()`)
await waitFor(`document.querySelector('.evidence-artifact') !== null`)
const acquisitionEvidenceId = await evaluate(`document.querySelector('.evidence-artifact').dataset.evidenceId`)
await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await waitFor(`document.querySelector('.evidence-acquired') !== null`)
await waitFor(`document.activeElement?.dataset?.evidenceTrigger === ${JSON.stringify(acquisitionEvidenceId)}`)
const acquisitionFocusRestored = await evaluate(`document.activeElement?.dataset?.evidenceTrigger === ${JSON.stringify(acquisitionEvidenceId)}`)
if (!acquisitionFocusRestored) throw new Error('Acquisition inspector did not return focus to its trigger')

let deductionSteps = 0
while (!(await evaluate(`document.querySelector('.focus-evidence') !== null && document.querySelector('.screen-deduction') !== null`)) && deductionSteps < 80) {
  deductionSteps += 1
  await evaluate(`document.querySelector('.evidence-acquired > header button')?.click()`)
  const advanced = await evaluate(`(() => {
    const route = document.querySelector('.route-card:not(.is-complete):not(:disabled)')
    const gate = document.querySelector('.deduction-gate:not(:disabled)')
    const option = document.querySelector('.option-list button:not(:disabled)')
    const button = route ?? gate ?? option
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!advanced) throw new Error(`Deduction flow stopped at step ${deductionSteps}`)
  await sleep(280)
}
if (deductionSteps >= 80) throw new Error('Deduction flow exceeded 80 steps')
await waitFor(`[...document.querySelectorAll('.focus-evidence .evidence-thumbnail img')].some((image) => image.currentSrc.includes('-v1.svg'))`)
const deductionThumbnailFallbacks = await evaluate(`[...document.querySelectorAll('.focus-evidence .evidence-thumbnail img')].filter((image) => image.currentSrc.includes('-v1.svg')).length`)
const deductionPrompt = await evaluate(`document.querySelector('.dialogue-text').textContent`)
await evaluate(`document.querySelector('.focus-evidence button:not(:disabled)').click()`)
await waitFor(`document.querySelector('.evidence-artifact') !== null`)
await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await waitFor(`document.querySelector('.screen-deduction') !== null`)
await waitFor(`Boolean(document.activeElement.closest?.('.focus-evidence'))`)
const deductionReturn = await evaluate(`(() => ({
  prompt: document.querySelector('.dialogue-text').textContent,
  optionCount: document.querySelectorAll('.option-list button').length,
  focusRestored: Boolean(document.activeElement.closest?.('.focus-evidence')),
}))()`)
if (deductionReturn.prompt !== deductionPrompt || deductionReturn.optionCount < 2 || !deductionReturn.focusRestored) {
  throw new Error(`Deduction return regression: ${JSON.stringify(deductionReturn)}`)
}

await evaluate(`document.querySelector('.focus-evidence button:not(:disabled)').click()`)
await waitFor(`document.querySelector('.evidence-artifact') !== null`)
await command('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
const reducedMotion = await evaluate(`(() => ({
  templateAnimation: getComputedStyle(document.querySelector('.evidence-template-body')).animationName,
  plateLightAnimation: getComputedStyle(document.querySelector('.evidence-plate'), '::after').animationName,
  hotspotTransition: getComputedStyle(document.querySelector('.evidence-hotspots button')).transitionDuration,
}))()`)
if (reducedMotion.templateAnimation !== 'none' || reducedMotion.plateLightAnimation !== 'none' || reducedMotion.hotspotTransition !== '0.001s') throw new Error(`Reduced-motion regression: ${JSON.stringify(reducedMotion)}`)
await command('Emulation.setEmulatedMedia', { media: 'screen', features: [] })
await command('Network.setBlockedURLs', { urls: [] })
await command('Network.setCacheDisabled', { cacheDisabled: false })

if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`)
console.log(JSON.stringify({
  viewportReports,
  allEvidenceCount: allEvidenceReports.length,
  fallbackReports,
  thumbnailFallbackEntrances: {
    ledger: ledgerThumbnailFallbacks,
    acquisition: acquisitionThumbnailFallback,
    deduction: deductionThumbnailFallbacks,
  },
  acquisitionSteps,
  acquisitionEvidenceId,
  acquisitionMinTarget,
  acquisitionFocusRestored,
  deductionSteps,
  deductionReturn,
  reducedMotion,
  browserErrors,
}, null, 2))
socket.close()
