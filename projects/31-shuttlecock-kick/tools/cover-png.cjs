/*
 * 生成上架封面 assets/cover-750x1000.png（750×1000，宽*4===高*3，符合平台 3:4 封面要求）。
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 配色与游戏内「素羽」档位一致：黄昏天空 → 玫瑰晚霞 → 夜色操场。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'logo.svg');
const OUT = path.join(ROOT, 'assets', 'cover-750x1000.png');

const THEME = {
  from: '#ffd9a0',
  mid: '#ff9d76',
  to: '#2b1b3d',
  ink: '#fff7ef',
  scrim: 'rgba(30,16,44,0.62)',
  accent: '#ffd0a4',
  title: '毽子连击',
  tagline: '一脚接一脚，踢到天黑',
  deco: [[92, 120, 7, 0.75], [640, 176, 5, 0.6], [172, 300, 4, 0.5], [560, 92, 3, 0.55], [716, 330, 6, 0.32], [46, 424, 3, 0.4]]
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
    'background:linear-gradient(168deg,' + THEME.from + ' 0%,' + THEME.mid + ' 38%,' + THEME.to + ' 100%);' +
    'font-family:"Microsoft YaHei","PingFang SC",sans-serif;}' +
    '.deco{position:absolute;inset:0;}' +
    '.scrim{position:absolute;left:0;right:0;bottom:0;height:62%;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,' + THEME.scrim + ' 100%);}' +
    '.hero{position:absolute;left:115px;top:118px;width:520px;height:520px;border-radius:118px;overflow:hidden;' +
    'box-shadow:0 30px 76px rgba(40,14,50,0.42), 0 0 0 1px rgba(255,236,210,0.28);}' +
    '.hero svg{display:block;width:520px;height:520px;}' +
    '.title{position:absolute;left:0;right:0;top:700px;text-align:center;color:' + THEME.ink + ';' +
    'font-size:92px;font-weight:800;letter-spacing:8px;line-height:1.1;text-shadow:0 6px 26px rgba(20,8,32,0.45);}' +
    '.tagline{position:absolute;left:0;right:0;top:828px;text-align:center;color:' + THEME.accent + ';' +
    'font-size:38px;font-weight:600;letter-spacing:4px;text-shadow:0 3px 16px rgba(20,8,32,0.4);}' +
    '.rule{position:absolute;left:295px;top:908px;width:160px;height:6px;border-radius:3px;background:' + THEME.accent + ';opacity:0.9;}' +
    '.hint{position:absolute;left:0;right:0;top:944px;text-align:center;color:rgba(255,240,225,0.6);' +
    'font-size:26px;font-weight:500;letter-spacing:2px;}' +
    '</style></head><body>' +
    '<div class="cover">' +
    '<div class="deco">' + decoHtml() + '</div>' +
    '<div class="scrim"></div>' +
    '<div class="hero">' + svg + '</div>' +
    '<div class="title">' + THEME.title + '</div>' +
    '<div class="tagline">' + THEME.tagline + '</div>' +
    '<div class="rule"></div>' +
    '<div class="hint">连到 5 / 10 / 15 / 20 / 25，毽子一路换羽色</div>' +
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
