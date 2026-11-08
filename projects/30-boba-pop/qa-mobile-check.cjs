/*
 * 珍珠消消乐 · 移动端视觉与交互自检
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 覆盖：375 / 390 / 430 CSS px、非零安全区、左右宿主按钮覆盖层、横屏。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
/* 可传入待检目录：默认检查 dist，也可指向解压后的 zip 产物 */
const DIST = path.resolve(ROOT, process.argv[2] || path.join(ROOT, 'dist'));
const OUT = path.join(ROOT, 'qa');

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
          target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html'
        );
        res.writeHead(200);
        res.end(data);
      });
    });
    server.on('error', (e) => console.error('server error', e));
    server.on('request', (req) => console.log('[req]', req.method, req.url));
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const HOST_CSS = `
.host-btn{position:fixed;top:calc(var(--safe-area-inset-top,0px) + 8px);width:44px;height:44px;z-index:9999;
background:rgba(255,255,255,.78);border-radius:22px;box-shadow:0 2px 10px rgba(0,0,0,.35);
display:flex;align-items:center;justify-content:center;font:700 20px/1 sans-serif;color:#222;pointer-events:none}
.host-btn.left{left:6px}
.host-btn.right{right:6px}`;

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
    await page.screenshot({ path: path.join(OUT, 'board-' + width + '.png') });

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

    /* 交互：真实点击一组同色珍珠，验证分数变化 */
    const before = await page.textContent('#score');
    const box = await page.locator('#board').boundingBox();
    const cells = await page.evaluate(() => {
      const r = window.__bobaRenderer;
      const out = [];
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 6; col++) {
          out.push({ row, col, x: r.cellCenter(col), y: r.cellCenterY(row) });
        }
      }
      return out;
    });
    let tappedRow = null;
    for (const cell of cells) {
      await page.mouse.click(box.x + cell.x, box.y + cell.y);
      await page.waitForTimeout(140);
      const now = await page.textContent('#score');
      if (now !== before) {
        tappedRow = cell;
        break;
      }
    }
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, 'play-' + width + '.png') });
    const after = await page.textContent('#score');
    const tapsLeft = await page.textContent('#tapText');

    /* 布局检查：溢出、关键元素与宿主按钮的几何关系 */
    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const rectOf = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      };
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        hud: rectOf('#hud'),
        topbar: rectOf('#topbar'),
        footbar: rectOf('#footbar'),
        board: rectOf('#board'),
        preview: rectOf('.preview-wrap'),
        mute: rectOf('#muteBtn'),
        canvasSize: (() => {
          const c = document.querySelector('#board');
          return [c.width, c.height];
        })()
      };
    });

    report.push({ width, scoreBefore: before, scoreAfter: after, tappedRow, tapsLeft, layout, errors });
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
    const c = document.querySelector('#board');
    const r = c.getBoundingClientRect();
    const layout = window.__bobaRenderer.getLayout();
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      canvasRect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
      canvasBuffer: [c.width, c.height],
      cell: layout.cell,
      boardW: layout.cell * layout.cols + layout.gap * (layout.cols - 1),
      boardH: layout.cell * layout.rows + layout.gap * (layout.rows - 1),
      originY: layout.originY
    };
  });
  report.push({ landscape: landLayout, errors: landErrors });
  await ctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
