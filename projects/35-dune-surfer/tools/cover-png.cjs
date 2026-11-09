/*
 * 生成上架封面 assets/cover-750x1000.png（750×1000，宽*4===高*3，符合平台 3:4 封面要求）。
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'logo.svg');
const OUT = path.join(ROOT, 'assets', 'cover-750x1000.png');

const THEME = {
  from: '#3b2352',
  mid: '#8a3a52',
  to: '#e8623c',
  ink: '#fff3e0',
  scrim: 'rgba(30,10,28,0.52)',
  accent: '#ffcf7a',
  title: '沙丘速降',
  tagline: '贴着雪崩，甩出一道漂亮的尾迹',
  deco: [[104, 136, 6, 0.5], [616, 196, 4, 0.4], [166, 306, 5, 0.32], [556, 104, 3, 0.42], [706, 322, 7, 0.26], [70, 416, 4, 0.34]]
};

function decoHtml() {
  return THEME.deco
    .map(function (d) {
      return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="#ffffff" opacity="' + d[3] + '"/>';
    })
    .join('');
}

async function run() {
  const svg = fs.readFileSync(SVG, 'utf8');
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;background:#000}' +
    '.cover{position:relative;width:750px;height:1000px;overflow:hidden;' +
    'background:linear-gradient(168deg,' + THEME.from + ' 0%,' + THEME.mid + ' 52%,' + THEME.to + ' 100%);' +
    'font-family:"Microsoft YaHei","PingFang SC",sans-serif;}' +
    '.deco{position:absolute;inset:0;}' +
    '.scrim{position:absolute;left:0;right:0;bottom:0;height:64%;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,' + THEME.scrim + ' 100%);}' +
    '.hero{position:absolute;left:135px;top:150px;width:480px;height:480px;border-radius:104px;overflow:hidden;box-shadow:0 28px 70px rgba(0,0,0,0.4);}' +
    '.hero svg{display:block;width:480px;height:480px;}' +
    '.title{position:absolute;left:0;right:0;top:688px;text-align:center;color:' + THEME.ink + ';' +
    'font-size:88px;font-weight:800;letter-spacing:6px;line-height:1.1;text-shadow:0 4px 22px rgba(0,0,0,0.4);}' +
    '.tagline{position:absolute;left:0;right:0;top:812px;text-align:center;color:' + THEME.accent + ';' +
    'font-size:38px;font-weight:600;letter-spacing:3px;text-shadow:0 2px 14px rgba(0,0,0,0.35);}' +
    '.rule{position:absolute;left:295px;top:890px;width:160px;height:6px;border-radius:3px;background:' + THEME.accent + ';opacity:0.9;}' +
    '</style></head><body>' +
    '<div class="cover">' +
    '<div class="deco">' + decoHtml() + '</div>' +
    '<div class="scrim"></div>' +
    '<div class="hero">' + svg + '</div>' +
    '<div class="title">' + THEME.title + '</div>' +
    '<div class="tagline">' + THEME.tagline + '</div>' +
    '<div class="rule"></div>' +
    '</div>' +
    '</body></html>';
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--no-proxy-server', '--proxy-bypass-list=<-loopback>']
  });
  const context = await browser.newContext({ viewport: { width: 750, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 750, height: 1000 } });
  await context.close();
  await browser.close();
  console.log('cover written:', path.relative(ROOT, OUT), '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KiB)');
}

run().catch(function (e) {
  console.error(e);
  process.exit(1);
});
