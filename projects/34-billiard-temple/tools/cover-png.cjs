/*
 * 生成上架封面 assets/cover-750x1000.png（750×1000，宽*4===高*3，符合平台 3:4 封面要求）。
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 配色与 logo.svg 保持同一套「夜色神殿 + 金」体系。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'logo.svg');
const OUT = path.join(ROOT, 'assets', 'cover-750x1000.png');

const THEME = {
  from: '#2b1d3f',
  mid: '#7a4650',
  to: '#33202b',
  ink: '#fff0c4',
  scrim: 'rgba(20,8,18,0.66)',
  accent: '#8fe3c6',
  title: '弹珠神殿',
  tagline: '一杆清空，满室生光',
  deco: [[104, 148, 9, 0.34], [618, 196, 6, 0.28], [162, 322, 5, 0.2], [556, 118, 4, 0.3], [692, 356, 11, 0.16], [58, 424, 4, 0.24], [452, 92, 3, 0.28]]
};

/* 背景里的三颗小宝石：沿用宝石多面切割的画法 */
function facetGem(x, y, r, hue) {
  const top = y - r;
  const bottom = y + r;
  const left = x - r * 0.86;
  const right = x + r * 0.86;
  let out = '<g>';
  out += '<polygon points="' + x + ',' + top + ' ' + right + ',' + y + ' ' + x + ',' + bottom + '" fill="rgba(255,255,255,0.5)"/>';
  out += '<polygon points="' + x + ',' + top + ' ' + left + ',' + y + ' ' + x + ',' + bottom + '" fill="' + hue + '"/>';
  out += '<polygon points="' + x + ',' + top + ' ' + x + ',' + y + ' ' + left + ',' + y + '" fill="rgba(0,0,0,0.22)"/>';
  out +=
    '<ellipse cx="' + (x - r * 0.34) + '" cy="' + (y - r * 0.42) + '" rx="' + (r * 0.2) + '" ry="' + (r * 0.12) +
    '" fill="#ffffff" fill-opacity="0.8" transform="rotate(-28 ' + (x - r * 0.34) + ' ' + (y - r * 0.42) + ')"/>';
  out += '</g>';
  return out;
}

function decoHtml() {
  let out = '';
  for (const d of THEME.deco) {
    out += '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="#ffe4a3" opacity="' + d[3] + '"/>';
  }
  out += facetGem(662, 250, 34, 'rgba(244,211,94,0.85)');
  out += facetGem(92, 392, 26, 'rgba(143,227,198,0.8)');
  out += facetGem(560, 880, 22, 'rgba(244,211,94,0.6)');
  return out;
}

async function run() {
  const svg = fs.readFileSync(SVG, 'utf8');
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;background:#000}' +
    '.cover{position:relative;width:750px;height:1000px;overflow:hidden;' +
    'background:radial-gradient(120% 70% at 50% 6%,rgba(255,228,163,0.22) 0%,rgba(255,228,163,0) 55%),' +
    'linear-gradient(168deg,' + THEME.from + ' 0%,' + THEME.mid + ' 52%,' + THEME.to + ' 100%);' +
    'font-family:"Microsoft YaHei","PingFang SC",sans-serif;}' +
    '.deco{position:absolute;left:0;top:0;width:750px;height:1000px;}' +
    '.scrim{position:absolute;left:0;right:0;bottom:0;height:66%;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,' + THEME.scrim + ' 100%);}' +
    '.hero{position:absolute;left:135px;top:120px;width:480px;height:480px;border-radius:112px;overflow:hidden;' +
    'box-shadow:0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,240,196,0.16);}' +
    '.hero svg{display:block;width:480px;height:480px;}' +
    '.title{position:absolute;left:0;right:0;top:660px;text-align:center;color:' + THEME.ink + ';' +
    'font-size:92px;font-weight:800;letter-spacing:8px;line-height:1.1;text-shadow:0 4px 26px rgba(0,0,0,0.5);}' +
    '.tagline{position:absolute;left:0;right:0;top:792px;text-align:center;color:' + THEME.accent + ';' +
    'font-size:40px;font-weight:600;letter-spacing:4px;text-shadow:0 2px 16px rgba(0,0,0,0.45);}' +
    '.rule{position:absolute;left:285px;top:876px;width:180px;height:6px;border-radius:3px;background:' + THEME.accent + ';opacity:0.85;}' +
    '.note{position:absolute;left:0;right:0;top:912px;text-align:center;color:rgba(255,240,196,0.6);' +
    'font-size:26px;letter-spacing:2px;}' +
    '</style></head><body>' +
    '<div class="cover">' +
    '<div class="deco">' + decoHtml() + '</div>' +
    '<div class="scrim"></div>' +
    '<div class="hero">' + svg + '</div>' +
    '<div class="title">' + THEME.title + '</div>' +
    '<div class="tagline">' + THEME.tagline + '</div>' +
    '<div class="rule"></div>' +
    '<div class="note">拖住玉球瞄准，松手就飞出去</div>' +
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
