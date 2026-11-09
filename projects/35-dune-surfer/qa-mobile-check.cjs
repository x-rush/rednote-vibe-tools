/*
 * 沙丘速降 · 移动端视觉与交互自检
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 覆盖：375 / 390 / 430 CSS px、非零安全区、左右宿主按钮覆盖层、横屏、真实拖拽切弯。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
const DIST = path.resolve(ROOT, process.argv[2] || path.join(ROOT, 'dist'));
const OUT = path.join(ROOT, 'qa');
const SAFE_TOP = 44;

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

/* 宿主按钮占位区（CSS px）：左上返回键、右上操作键 */
function hostZones(width, safeTop) {
  const top = safeTop + 8;
  return [
    { name: 'host-left', left: 6, right: 50, top: top, bottom: top + 44 },
    { name: 'host-right', left: width - 50, right: width - 6, top: top, bottom: top + 44 }
  ];
}

function overlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
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

    /* 开场按钮不能落在宿主按钮占位区里 */
    const introLayout = await page.evaluate(() => {
      const el = document.querySelector('#startBtn');
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    });
    for (const zone of hostZones(width, SAFE_TOP)) {
      if (overlap(introLayout, zone)) {
        errors.push('[mobile] startBtn 与宿主按钮占位区 ' + zone.name + ' 重叠');
      }
    }

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

    /* 交互：真实拖拽切弯，验证横向位置确实变了、世界确实在往前走 */
    const box = await page.locator('#field').boundingBox();
    const before = await page.evaluate(() => ({
      x: window.__duneState.x,
      wy: window.__duneState.wy,
      phase: window.__dunePhase()
    }));
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.7;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + box.width * 0.28, startY, { steps: 8 });
    await page.waitForTimeout(350);
    const during = await page.evaluate(() => ({
      x: window.__duneState.x,
      wy: window.__duneState.wy,
      phase: window.__dunePhase()
    }));
    await page.screenshot({ path: path.join(OUT, 'play-' + width + '.png') });
    await page.mouse.up();

    if (during.phase !== 'run') errors.push('[mobile] 开局后状态不该离开 run，phase=' + during.phase);
    if (during.wy <= before.wy) errors.push('[mobile] 世界没有往前跑');
    if (Math.abs(during.x - before.x) < 12) {
      errors.push('[mobile] 真实拖拽没有把玉板横向带过去（x ' + before.x.toFixed(1) + ' → ' + during.x.toFixed(1) + '）');
    }

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
        topbar: rectOf('#topbar'),
        hud: rectOf('#hud'),
        stage: rectOf('#stage'),
        footbar: rectOf('#footbar'),
        mute: rectOf('#muteBtn'),
        canvasSize: [canvas.width, canvas.height],
        scale: window.__duneRenderer.getScale(),
        playerY: window.__duneRenderer.getPlayerY(),
        horizonY: window.__duneRenderer.getHorizonY()
      };
    });

    /* 横向不能溢出 */
    if (layout.scrollWidth > layout.clientWidth) {
      errors.push('[mobile] 出现横向溢出 ' + layout.scrollWidth + ' > ' + layout.clientWidth);
    }
    /* 自己的交互控件不能落在宿主按钮占位区里 */
    const zones = hostZones(width, SAFE_TOP);
    const interactive = [];
    if (layout.mute) interactive.push({ name: 'muteBtn', ...layout.mute });
    for (const zone of zones) {
      for (const el of interactive) {
        if (overlap(el, zone)) {
          errors.push('[mobile] ' + el.name + ' 与宿主按钮占位区 ' + zone.name + ' 重叠');
        }
      }
    }
    /* 主要区块必须在可视区域内 */
    for (const key of ['hud', 'stage', 'footbar']) {
      const r = layout[key];
      if (!r || r.bottom > layout.clientHeight + 1 || r.top < -1) {
        errors.push('[mobile] ' + key + ' 超出可视区域');
      }
    }
    /* 场地要够高，玩家与雪崩都要看得见 */
    if (layout.stage && layout.stage.bottom - layout.stage.top < 240) {
      errors.push('[mobile] 场地高度过小：' + (layout.stage.bottom - layout.stage.top) + 'px');
    }
    if (!layout.scale || layout.scale <= 0) errors.push('[mobile] 渲染缩放比无效');
    if (layout.playerY >= layout.clientHeight) errors.push('[mobile] 玩家跑到了画面外');

    report.push({ width, before, during, layout, errors });
    await context.close();
  }

  /* 横屏：同样要避让宿主左右按钮 */
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const landErrors = [];
  page.on('pageerror', (e) => landErrors.push(String(e.stack || e)));
  page.on('console', (m) => {
    if (m.type() === 'error') landErrors.push('[console] ' + m.text());
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
  });
  await page.waitForTimeout(300);

  const landIntro = await page.evaluate(() => {
    const el = document.querySelector('#startBtn');
    const r = el.getBoundingClientRect();
    const doc = document.documentElement;
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      clientHeight: doc.clientHeight,
      scrollHeight: doc.scrollHeight
    };
  });
  if (landIntro.bottom > landIntro.clientHeight + 1) {
    landErrors.push('[landscape] 开场按钮在可视区域之外：bottom=' + landIntro.bottom);
  }
  for (const zone of hostZones(844, SAFE_TOP)) {
    if (overlap(landIntro, zone)) {
      landErrors.push('[landscape] startBtn 与宿主按钮占位区 ' + zone.name + ' 重叠');
    }
  }

  await page.click('#startBtn');
  await page.waitForTimeout(600);
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
  await page.screenshot({ path: path.join(OUT, 'landscape.png') });

  const landLayout = await page.evaluate(() => {
    const doc = document.documentElement;
    const c = document.querySelector('#field');
    const r = c.getBoundingClientRect();
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right) };
    };
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      canvasRect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
      canvasBuffer: [c.width, c.height],
      scale: window.__duneRenderer.getScale(),
      hud: rectOf('#hud'),
      stage: rectOf('#stage'),
      mute: rectOf('#muteBtn')
    };
  });
  if (landLayout.scrollWidth > landLayout.clientWidth) {
    landErrors.push('[landscape] 出现横向溢出');
  }
  if (landLayout.canvasRect.right - landLayout.canvasRect.left < 240) {
    landErrors.push('[landscape] 画布被挤得过窄（' + (landLayout.canvasRect.right - landLayout.canvasRect.left) + 'px）');
  }
  if (landLayout.canvasRect.bottom - landLayout.canvasRect.top < 180) {
    landErrors.push('[landscape] 画布被压得过矮（' + (landLayout.canvasRect.bottom - landLayout.canvasRect.top) + 'px）');
  }
  const landZones = hostZones(844, SAFE_TOP);
  const landInteractive = [];
  if (landLayout.mute) landInteractive.push({ name: 'muteBtn', ...landLayout.mute });
  for (const zone of landZones) {
    for (const el of landInteractive) {
      if (overlap(el, zone)) {
        landErrors.push('[landscape] ' + el.name + ' 与宿主按钮占位区 ' + zone.name + ' 重叠');
      }
    }
  }
  report.push({ landscape: landLayout, intro: landIntro, errors: landErrors });
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
