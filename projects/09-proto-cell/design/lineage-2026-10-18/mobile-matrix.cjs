const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const content = JSON.parse(fs.readFileSync('src/content/content.json', 'utf8'))
const actual = JSON.parse(fs.readFileSync('design/lineage-2026-10-18/actual-flow/actual-save.json', 'utf8'))
const out = 'design/lineage-2026-10-18/mobile'
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const results = []
  for (const [width, height] of [[375, 812], [390, 844], [430, 932], [844, 390]]) {
    for (const legacy of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('http://127.0.0.1:4110/')
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '44px'))
      await page.getByRole('button', { name: content.ui.actions.open_settings, exact: true }).click()
      const save = structuredClone(actual)
      if (legacy) delete save.nursery // Real prior-run archives exercise the supported legacy migration.
      await page.getByRole('textbox', { name: content.ui.labels.importedSave, exact: true }).fill(JSON.stringify(save))
      await page.getByRole('button', { name: content.ui.actions.importSave, exact: true }).click()
      await page.getByRole('status').filter({ hasText: content.ui.screens.importSuccess }).waitFor()
      await page.getByRole('button', { name: content.ui.actions.backToLab, exact: true }).click()
      await page.evaluate(() => {
        for (const side of ['left', 'right']) {
          const element = document.createElement('div')
          Object.assign(element.style, { position: 'fixed', top: '48px', [side]: '8px', width: '56px', height: '56px', borderRadius: '50%', background: '#ff2753bb', border: '2px dashed white', zIndex: 9999, pointerEvents: 'none', display: 'grid', placeItems: 'center', color: 'white', fontSize: '11px' })
          element.innerText = side === 'left' ? '宿主返回' : '宿主操作'
          document.body.append(element)
        }
      })
      const record = async (state) => {
        const geometry = await page.evaluate(() => {
          const corners = [{ x: 8, y: 48, w: 56, h: 56 }, { x: innerWidth - 64, y: 48, w: 56, h: 56 }]
          const collisions = [...document.querySelectorAll('button,input,select,summary')].filter((element) => !element.closest('[inert]')).flatMap((element) => {
            const rect = element.getBoundingClientRect()
            if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) return []
            return corners.some((corner) => rect.left < corner.x + corner.w && rect.right > corner.x && rect.top < corner.y + corner.h && rect.bottom > corner.y) ? [element.textContent || element.getAttribute('aria-label') || element.tagName] : []
          })
          return { overflow: document.documentElement.scrollWidth > innerWidth, scrollY, collisions }
        })
        await page.screenshot({ path: `${out}/${width}-${state}.png`, fullPage: !state.includes('hatch') })
        results.push({ width, height, state, legacyImport: legacy, ...geometry, errors: [...errors] })
        if (geometry.overflow || geometry.collisions.length || errors.length) throw Error(JSON.stringify(results.at(-1)))
      }
      if (!legacy) await record('selected-home')
      await page.getByRole('button', { name: new RegExp(content.ui.actions.open_nursery) }).click()
      if (!legacy) {
        await page.locator('.nursery-tabs button').nth(1).click()
        await record('library')
        await page.getByRole('button', { name: content.ui.actions.retireLineage, exact: true }).first().click()
        await record('retire-confirm')
        await page.getByRole('button', { name: content.ui.actions.cancelRetire, exact: true }).click()
      } else {
        await record('seed-bank')
        await page.locator('.nursery-archetype').filter({ hasText: '棱甲种' }).locator('input').check()
        await page.getByRole('button', { name: content.ui.actions.hatchCell, exact: true }).click()
        await page.waitForTimeout(550)
        await record('hatch')
        await page.getByRole('button', { name: content.ui.actions.skipHatch, exact: true }).click()
        await page.waitForTimeout(100)
        await record('hatch-ready')
        await page.getByRole('button', { name: content.ui.labels.hatchReturn, exact: true }).click()
      }
      await context.close()
    }
  }
  fs.writeFileSync(`${out}/matrix.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  await browser.close()
})().catch((error) => { console.error(error); process.exit(1) })
