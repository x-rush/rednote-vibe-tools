import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const baseUrl = process.env.DALISIZIAN_URL ?? 'http://127.0.0.1:5177/'
const cdpUrl = process.env.DALISIZIAN_CDP ?? 'http://127.0.0.1:9222'
const outputDir = new URL('../output/playwright/', import.meta.url)
const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf8'))
const correctDeductionTexts = new Set(content.content.cases.flatMap((item) => item.deductions.flatMap((deduction) => deduction.options.filter((option) => option.correct).map((option) => option.text))))
mkdirSync(outputDir, { recursive: true })

const targets = await (await fetch(`${cdpUrl}/json`)).json()
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('No Chrome page target found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 0
const browserErrors = []
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

await command('Page.enable')
await command('Runtime.enable')
await command('Log.enable')
await command('Page.navigate', { url: baseUrl })
await waitFor(`document.readyState === 'complete'`)

await evaluate(`(async () => {
  const completedAt = '2026-08-26T08:30:00.000Z'
  localStorage.setItem('xhs-tool:dalisizian:state:v1', JSON.stringify({
    schemaVersion: 1,
    contentVersion: '1.0.0',
    updatedAt: completedAt,
    data: {
      unlockedCaseIds: ['case-home-roof-pig', 'case-rest-under-tree'],
      completedCaseIds: ['case-home-roof-pig'],
      bestRatings: { 'case-home-roof-pig': { rating: '明镜高悬', score: 96, completedAt } },
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
    const transaction = database.transaction('caseVerdicts', 'readwrite')
    transaction.objectStore('caseVerdicts').put({ caseId: 'case-home-roof-pig', value: {
      caseId: 'case-home-roof-pig', initialVerdict: 'myth', finalVerdict: 'partial', officialVerdict: 'partial',
      score: 96, rating: '明镜高悬', completedAt, clueCount: 3, evidenceCount: 4
    } })
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  location.reload()
})()`, true)
await waitFor(`document.querySelector('.landing-screen') !== null`)

const reports = []
for (const [width, height] of [[375, 812], [390, 844], [430, 932]]) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true })
  await command('Page.navigate', { url: baseUrl })
  await waitFor(`document.querySelector('.landing-screen') !== null`)
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('断案图鉴')).click()`)
  await waitFor(`document.querySelector('.collection-screen') !== null`)
  await waitFor(`[...document.images].filter((item) => item.getClientRects().length).every((item) => item.complete)`)
  const collection = await evaluate(`(() => {
    const visibleButtons = [...document.querySelectorAll('.collection-screen button')].filter((item) => item.getClientRects().length)
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      slots: document.querySelectorAll('.collection-grid > li').length,
      collected: document.querySelectorAll('.collection-grid > .is-collected').length,
      sealed: document.querySelectorAll('.collection-grid > .is-sealed').length,
      minButtonHeight: Math.min(...visibleButtons.map((item) => item.getBoundingClientRect().height)),
      maxRight: Math.max(...[...document.querySelectorAll('.collection-screen *')].map((item) => item.getBoundingClientRect().right)),
      brokenImages: [...document.images].filter((item) => item.getClientRects().length && item.naturalWidth === 0).length
    }
  })()`)
  if (collection.documentWidth !== width || collection.slots !== 8 || collection.collected !== 1 || collection.sealed !== 7 || collection.minButtonHeight < 48 || collection.brokenImages !== 0 || collection.maxRight > width + 0.5) {
    throw new Error(`Collection regression at ${width}: ${JSON.stringify(collection)}`)
  }
  if (width === 390) await screenshot('dalisizian-collection-390.png')

  await evaluate(`document.querySelector('.collection-grid .is-collected button').click()`)
  await waitFor(`document.querySelector('.story-screen') !== null`)
  const story = await evaluate(`(() => ({
    title: document.querySelector('#story-title').textContent,
    chapters: document.querySelectorAll('.story-findings li').length,
    verdict: document.querySelector('.story-judgment h2').textContent,
    truth: document.querySelector('.story-truth').textContent,
    width: document.documentElement.scrollWidth,
    minButtonHeight: Math.min(...[...document.querySelectorAll('.story-screen button')].filter((item) => item.getClientRects().length).map((item) => item.getBoundingClientRect().height))
  }))()`)
  if (story.title !== '汉字故事卷' || story.chapters !== 3 || story.verdict !== '部分可信' || !story.truth.includes('传统释形') || story.width !== width || story.minButtonHeight < 48) {
    throw new Error(`Story regression at ${width}: ${JSON.stringify(story)}`)
  }
  if (width === 390) await screenshot('dalisizian-story-390.png')
  await evaluate(`document.querySelector('.story-actions .primary').click()`)
  await waitFor(`document.querySelector('.share-card') !== null`)
  const card = await evaluate(`(() => {
    const card = document.querySelector('.share-card').getBoundingClientRect()
    return {
      width: card.width,
      height: card.height,
      ratio: card.width / card.height,
      title: document.querySelector('#share-card-heading').textContent,
      verdict: document.querySelector('.share-verdict').textContent.replace(/\\s+/g, ' ').trim(),
      score: document.querySelector('.share-rating').textContent.replace(/\\s+/g, ' ').trim(),
      evidence: document.querySelector('.share-evidence').textContent.replace(/\\s+/g, ' ').trim(),
      truth: document.querySelector('.share-truth').textContent.replace(/\\s+/g, ' ').trim(),
      signets: document.querySelectorAll('.share-signets > span').length,
      brokenImages: [...document.images].filter((item) => item.getClientRects().length && item.naturalWidth === 0).length
    }
  })()`)
  if (Math.abs(card.ratio - 0.75) > 0.01 || card.title !== '家字失踪案' || !card.verdict.includes('常见误解') || !card.verdict.includes('部分可信') || !card.score.includes('96') || !card.evidence.includes('收录证物 4') || !card.truth.includes('传统释形') || card.signets !== 3 || card.brokenImages !== 0) {
    throw new Error(`Share-card regression at ${width}: ${JSON.stringify(card)}`)
  }
  if (width === 390) await screenshot('dalisizian-share-card-390.png')
  if (width === 390) {
    await command('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const reducedAnimation = await evaluate(`getComputedStyle(document.querySelector('.share-dialog')).animationName`)
    if (reducedAnimation !== 'none') throw new Error(`Share card still animates in reduced-motion mode: ${reducedAnimation}`)
    await command('Emulation.setEmulatedMedia', { media: 'screen', features: [] })
  }
  reports.push({ collection, story, card })
  await evaluate(`document.querySelector('.share-actions button').click()`)
  await waitFor(`document.querySelector('.share-overlay').classList.contains('is-capture')`)
  const capture = await evaluate(`(() => ({
    toolbar: getComputedStyle(document.querySelector('.share-toolbar')).display,
    actions: getComputedStyle(document.querySelector('.share-actions')).display,
    cardRight: document.querySelector('.share-card').getBoundingClientRect().right,
    cardLeft: document.querySelector('.share-card').getBoundingClientRect().left
  }))()`)
  if (capture.toolbar !== 'none' || capture.actions !== 'none' || capture.cardLeft < 0 || capture.cardRight > width) throw new Error(`Capture regression at ${width}: ${JSON.stringify(capture)}`)
  if (width === 390) await screenshot('dalisizian-share-card-clean-390.png')
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!document.querySelector('.share-overlay').classList.contains('is-capture')`)
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`document.querySelector('.share-overlay') === null`)
}

await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await evaluate(`document.querySelector('.story-header button').click()`)
await waitFor(`document.querySelector('.collection-grid') !== null`)
await evaluate(`document.querySelector('.collection-header button').click()`)
await waitFor(`document.querySelector('.landing-screen') !== null`)
await evaluate(`[...document.querySelectorAll('.landing-actions button')].find((button) => button.textContent.includes('领取第一案') || button.textContent.includes('展开案卷柜')).click()`)
await waitFor(`document.querySelector('.shelf-screen') !== null`)
await evaluate(`document.querySelector('.case-card.is-complete > button').click()`)
await waitFor(`document.querySelector('.case-shell') !== null`)
let steps = 0
while (!(await evaluate(`document.querySelector('.ending-result') !== null`)) && steps < 80) {
  steps += 1
  const pendingRoute = await evaluate(`Boolean(document.querySelector('.route-card:not(.is-complete):not(:disabled)'))`)
  if (pendingRoute) {
    await evaluate(`document.querySelector('.route-card:not(.is-complete):not(:disabled)').click()`)
    await new Promise((resolve) => setTimeout(resolve, 260))
    continue
  }
  const deductionReady = await evaluate(`Boolean(document.querySelector('.deduction-gate:not(:disabled)'))`)
  if (deductionReady) {
    await evaluate(`document.querySelector('.deduction-gate:not(:disabled)').click()`)
    await new Promise((resolve) => setTimeout(resolve, 260))
    continue
  }
  const options = await evaluate(`[...document.querySelectorAll('.option-list button')].filter((button) => button.getClientRects().length).map((button) => button.textContent.replace(/^\\d{2}/, '').trim())`)
  if (!options.length) throw new Error(`No playable option during completion at step ${steps}`)
  const isDeduction = await evaluate(`document.querySelector('.deduction-head') !== null`)
  const selected = isDeduction ? options.find((text) => correctDeductionTexts.has(text)) : options[0]
  if (!selected) throw new Error(`No correct deduction option at step ${steps}: ${options.join(' | ')}`)
  await evaluate(`(() => { const wanted = ${JSON.stringify(selected)}; [...document.querySelectorAll('.option-list button')].find((button) => button.textContent.replace(/^\\d{2}/, '').trim() === wanted).click() })()`)
  await new Promise((resolve) => setTimeout(resolve, 260))
}
if (steps >= 80) throw new Error('Full browser playthrough exceeded 80 steps')
await evaluate(`document.querySelector('.seal-button').click()`)
await waitFor(`document.querySelector('.collection-screen') !== null && document.querySelector('.share-overlay') !== null`, 3000)
const postArchive = await evaluate(`(() => ({
  collected: document.querySelectorAll('.collection-grid > .is-collected').length,
  cardTitle: document.querySelector('#share-card-heading').textContent,
  date: document.querySelector('.share-card > footer span').textContent,
  archiveButtonPresent: [...document.querySelectorAll('button')].some((button) => button.textContent.includes('收入图鉴'))
}))()`)
if (postArchive.collected !== 1 || postArchive.cardTitle !== '家字失踪案' || postArchive.date !== '2026.08.26' || postArchive.archiveButtonPresent) throw new Error(`Post-archive regression: ${JSON.stringify(postArchive)}`)
await screenshot('dalisizian-share-card-after-archive-390.png')
await command('Emulation.setEmulatedMedia', { media: 'print' })
const printLayout = await evaluate(`(() => ({ toolbar: getComputedStyle(document.querySelector('.share-toolbar')).display, actions: getComputedStyle(document.querySelector('.share-actions')).display, cardDisplay: getComputedStyle(document.querySelector('.share-card')).display }))()`)
if (printLayout.toolbar !== 'none' || printLayout.actions !== 'none' || printLayout.cardDisplay === 'none') throw new Error(`Print layout regression: ${JSON.stringify(printLayout)}`)
await command('Emulation.setEmulatedMedia', { media: 'screen', features: [] })

if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`)
console.log(JSON.stringify({ reports, fullPlaythroughSteps: steps, postArchive, printLayout, browserErrors }, null, 2))
socket.close()
