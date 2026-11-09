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

/* 二期返工配色：清晨草坡的暖阳 + 薄荷深青，与 30 号奶茶棕、31 号黄昏紫错位 */
const THEME = {
  from: '#ffcfa0',
  mid: '#ffdcae',
  to: '#6fb6c6',
  ink: '#1f5a49',
  scrim: 'rgba(31,90,73,0.14)',
  accent: '#2f8f6a',
  title: '蛋落地',
  tagline: '轻轻放，才不会碎',
  deco: [[118, 140, 6, 0.35], [612, 206, 4, 0.28], [78, 356, 5, 0.22], [520, 120, 3, 0.3], [694, 300, 7, 0.18]]
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
    '.hero{position:absolute;left:135px;top:150px;width:480px;height:480px;border-radius:104px;overflow:hidden;box-shadow:0 28px 70px rgba(0,0,0,0.30);}' +
    '.hero svg{display:block;width:480px;height:480px;}' +
    '.title{position:absolute;left:0;right:0;top:688px;text-align:center;color:' + THEME.ink + ';' +
    'font-size:88px;font-weight:800;letter-spacing:6px;line-height:1.1;text-shadow:0 4px 20px rgba(255,255,255,0.45);}' +
    '.tagline{position:absolute;left:0;right:0;top:812px;text-align:center;color:' + THEME.accent + ';' +
    'font-size:38px;font-weight:600;letter-spacing:3px;text-shadow:0 2px 12px rgba(255,255,255,0.5);}' +
    '.rule{position:absolute;left:295px;top:890px;width:160px;height:6px;border-radius:3px;background:' + THEME.accent + ';opacity:0.85;}' +
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
