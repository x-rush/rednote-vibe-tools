/*
 * 把 assets/logo.svg 渲染成 assets/logo-512.png（平台上架用图标）。
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'logo.svg');
const OUT = path.join(ROOT, 'assets', 'logo-512.png');

async function run() {
  const svg = fs.readFileSync(SVG, 'utf8');
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;background:transparent}' +
    'svg{display:block;width:512px;height:512px}' +
    '</style></head><body>' + svg + '</body></html>';
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--no-proxy-server', '--proxy-bypass-list=<-loopback>']
  });
  const context = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT, omitBackground: true });
  await context.close();
  await browser.close();
  const bytes = fs.statSync(OUT).size;
  console.log('logo PNG written:', path.relative(ROOT, OUT), '(' + (bytes / 1024).toFixed(1) + ' KiB)');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
