/*
 * 蛋落地 · 移动端视觉与交互自检
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 覆盖：375 / 390 / 430 CSS px、非零安全区、左右宿主按钮覆盖层、横屏、真实点击喷气。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
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
    await page.waitForTimeout(500);
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

    /* 交互：真实点击喷气，验证下坠速度被压下来、气量减少 */
    const box = await page.locator('#field').boundingBox();
    const before = await page.evaluate(() => ({
      vy: window.__eggState.egg.vy,
      gas: window.__eggState.gas,
      y: window.__eggState.egg.y
    }));
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => ({
      vy: window.__eggState.egg.vy,
      gas: window.__eggState.gas,
      y: window.__eggState.egg.y
    }));
    await page.screenshot({ path: path.join(OUT, 'play-' + width + '.png') });

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const rectOf = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      };
      const canvas = document.querySelector('#field');
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        hud: rectOf('#hud'),
        topbar: rectOf('#topbar'),
        footbar: rectOf('#footbar'),
        field: rectOf('#field'),
        mute: rectOf('#muteBtn'),
        canvasSize: [canvas.width, canvas.height],
        fieldWidth: window.__eggRenderer.getFieldWidth()
      };
    });

    report.push({ width, before, after, layout, errors });
    await context.close();
  }

  /* 横屏 */
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const landErrors = [];
  page.on('pageerror', (e) => landErrors.push(String(e)));
  await page.goto(base, { waitUntil: 'load' });
  await page.click('#startBtn');
  await page.waitForTimeout(500);
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
      fieldWidth: window.__eggRenderer.getFieldWidth()
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
