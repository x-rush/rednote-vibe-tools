/*
 * 毽子连击 · 移动端视觉与交互自检
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 覆盖：375 / 390 / 430 CSS px、非零安全区、左右宿主按钮覆盖层、横屏、真实点击踢毽子。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
/* 可传入待检目录：默认检查 dist，也可指向解压后的 zip 产物 */
const DIST = path.resolve(ROOT, process.argv[2] || path.join(ROOT, 'dist'));
const OUT = path.join(ROOT, 'qa');

/* 规范：画布上不得出现任何文字，规则信息只放 HUD 卡片与教学首屏 */
const renderSource = fs.readFileSync(path.join(ROOT, 'src', 'render.js'), 'utf8');
const canvasTextCalls = renderSource.match(/fillText|strokeText/g) || [];

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.resolve(DIST, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (file !== DIST && !file.startsWith(DIST + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const target = file === DIST ? path.join(file, 'index.html') : file;
      fs.readFile(target, (err, data) => {
        if (err) {
          console.log('[404]', target, err.message);
          res.writeHead(404);
          res.end();
          return;
        }
        res.setHeader(
          'Content-Type',
          target.endsWith('.js')
            ? 'text/javascript'
            : target.endsWith('.css')
              ? 'text/css'
              : target.endsWith('.svg')
                ? 'image/svg+xml'
                : 'text/html'
        );
        res.writeHead(200);
        res.end(data);
      });
    });
    server.on('error', (e) => console.error('server error', e));
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const HOST_CSS = `
.host-btn{position:fixed;top:calc(var(--safe-area-inset-top,0px) + 8px);width:44px;height:44px;z-index:9999;
background:rgba(255,255,255,.78);border-radius:22px;box-shadow:0 2px 10px rgba(0,0,0,.35);
display:flex;align-items:center;justify-content:center;font:700 20px/1 sans-serif;color:#222;pointer-events:none}
.host-btn.left{left:6px}
.host-btn.right{right:6px}`;

/* 等到毽子下落进入甜区带再点，模拟真实玩家的操作 */
async function kickOnce(page, box) {
  for (let i = 0; i < 1200; i++) {
    const info = await page.evaluate(() => {
      const s = window.__jianziState;
      const G = window.JianziGame;
      const hit = s ? G.resolveKick(s) : null;
      return {
        phase: s ? s.phase : 'idle',
        kickable: !!hit,
        rally: s ? s.rally : 0
      };
    });
    if (info.kickable) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(90);
      return info;
    }
    if (info.phase !== 'playing') return null;
    await page.waitForTimeout(20);
  }
  return null;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--no-proxy-server', '--proxy-bypass-list=<-loopback>']
  });
  const report = [];

  if (canvasTextCalls.length) {
    console.error('[visual] 渲染层仍在画布上写字：' + canvasTextCalls.length + ' 处');
    await browser.close();
    server.close();
    process.exit(1);
  }

  for (const width of [375, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('[console] ' + m.text());
    });

    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'intro-' + width + '.png') });

    await page.click('#startBtn');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'field-' + width + '.png') });

    /* 宿主按钮覆盖层 */
    await page.addStyleTag({ content: HOST_CSS });
    await page.evaluate(() => {
      const left = document.createElement('div');
      left.className = 'host-btn left';
      left.textContent = '‹';
      const right = document.createElement('div');
      right.className = 'host-btn right';
      right.textContent = '⋯';
      document.body.append(left, right);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, 'host-' + width + '.png') });

    /* 交互：真实点击踢毽子，验证连踢数变化 */
    const box = await page.locator('#field').boundingBox();
    const before = await page.textContent('#rally');
    const first = await kickOnce(page, box);
    await page.waitForTimeout(400);
    const after = await page.textContent('#rally');
    await page.screenshot({ path: path.join(OUT, 'play-' + width + '.png') });
    const kickCountText = await page.textContent('#kickCount');

    /* 布局检查：溢出、关键元素与宿主按钮的几何关系 */
    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const rectOf = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      };
      const canvas = document.querySelector('#field');
      const card = document.querySelector('.hud-card');
      const cardStyle = card ? getComputedStyle(card) : null;
      const rallyStyle = getComputedStyle(document.querySelector('#rally'));
      const kickCountStyle = getComputedStyle(document.querySelector('#kickCount'));
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        hud: rectOf('#hud'),
        card: rectOf('.hud-card'),
        topbar: rectOf('#topbar'),
        footbar: rectOf('#footbar'),
        field: rectOf('#field'),
        mute: rectOf('#muteBtn'),
        canvasSize: [canvas.width, canvas.height],
        fieldWidth: window.__jianziRenderer.getFieldWidth(),
        birdCssSize: Math.round(window.__jianziRenderer.getBirdCssSize()),
        hudRadius: cardStyle ? parseFloat(cardStyle.borderTopLeftRadius) : 0,
        hudBorder: cardStyle ? cardStyle.borderTopWidth : '0px',
        hudBg: cardStyle ? cardStyle.backgroundImage.slice(0, 40) : '',
        rallyFontSize: parseFloat(rallyStyle.fontSize),
        rallyFontWeight: rallyStyle.fontWeight,
        kickCountFontSize: parseFloat(kickCountStyle.fontSize)
      };
    });

    /* 视觉硬指标：主视觉尺寸、HUD 容器化、字号层级 */
    if (layout.birdCssSize < 80) {
      errors.push('[visual] 毽子直径 ' + layout.birdCssSize + 'px 小于 80px');
    }
    if (layout.hudRadius < 14) {
      errors.push('[visual] HUD 卡片圆角 ' + layout.hudRadius + 'px 小于 14px');
    }
    if (!layout.hudBg || layout.hudBg === 'none') {
      errors.push('[visual] HUD 卡片没有玻璃拟态底色');
    }
    if (layout.rallyFontSize < 28 || layout.rallyFontSize > 34) {
      errors.push('[visual] 主数值字号 ' + layout.rallyFontSize + 'px 不在 28–34px 区间');
    }
    if (Number(layout.rallyFontWeight) < 700) {
      errors.push('[visual] 主数值字重 ' + layout.rallyFontWeight + ' 不是粗体');
    }
    if (layout.kickCountFontSize < 12 || layout.kickCountFontSize > 13) {
      errors.push('[visual] 副信息字号 ' + layout.kickCountFontSize + 'px 不在 12–13px 区间');
    }
    /* 画布上不得出现文字 */
    if (layout.canvasText) {
      errors.push('[visual] 画布上出现了文字：' + layout.canvasText);
    }

    report.push({ width, rallyBefore: before, rallyAfter: after, firstKick: first, kickCountText, layout, errors });
    await context.close();
  }

  /* 横屏 */
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const landErrors = [];
  page.on('pageerror', (e) => landErrors.push(String(e)));
  await page.goto(base, { waitUntil: 'load' });
  await page.click('#startBtn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'landscape.png') });
  const landLayout = await page.evaluate(() => {
    const doc = document.documentElement;
    const c = document.querySelector('#field');
    const r = c.getBoundingClientRect();
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      canvasRect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
      canvasBuffer: [c.width, c.height],
      fieldWidth: window.__jianziRenderer.getFieldWidth()
    };
  });
  report.push({ landscape: landLayout, errors: landErrors });
  await ctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const failed = report.filter((r) => r.errors && r.errors.length);
  if (failed.length) {
    console.error('视觉/布局自检未通过：' + JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
