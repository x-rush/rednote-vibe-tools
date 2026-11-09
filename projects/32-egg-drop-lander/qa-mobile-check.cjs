/*
 * 蛋落地 · 移动端视觉与交互自检（二期返工）
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 * 覆盖：375 / 390 / 430 CSS px、非零安全区、左右宿主按钮覆盖层、横屏、
 *       真实点击喷气（0 延迟）、HUD 玻璃拟态卡片、主视觉尺寸、画布无文字。
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

    /*
     * 交互：真实点击反推（截图），随后用同帧合成事件验证 0 延迟——
     * 真实鼠标点击的往返延迟会混入重力累积，无法精确断言「当帧」；
     * 真实点击驱动整局通关由 qa-flow.cjs 覆盖。
     */
    const box = await page.locator('#field').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.screenshot({ path: path.join(OUT, 'play-' + width + '.png') });
    const tap = await page.evaluate(() => {
      const canvas = document.querySelector('#field');
      const s = window.__eggState;
      const rect = canvas.getBoundingClientRect();
      const before = { vy: s.egg.vy, pulses: s.pulses };
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height * 0.35,
        bubbles: true
      }));
      const after = { vy: s.egg.vy, pulses: s.pulses, jet: s.egg.jet };
      return { before: before, after: after, impulse: s.level.impulse, empty: s.pulses === 0 && before.pulses === 0 };
    });
    const before = tap.before;
    const after = tap.after;

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
      const streakStyle = getComputedStyle(document.querySelector('#streak'));
      const levelStyle = getComputedStyle(document.querySelector('#levelName'));
      const gauge = document.querySelector('.gauge-track');
      const gaugeStyle = gauge ? getComputedStyle(gauge) : null;
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
        fieldWidth: window.__eggRenderer.getFieldWidth(),
        eggCssSize: Math.round(window.__eggRenderer.getEggCssSize()),
        hudRadius: cardStyle ? parseFloat(cardStyle.borderTopLeftRadius) : 0,
        hudBorder: cardStyle ? cardStyle.borderTopWidth : '0px',
        hudBg: cardStyle ? cardStyle.backgroundImage.slice(0, 40) : '',
        streakFontSize: parseFloat(streakStyle.fontSize),
        streakFontWeight: streakStyle.fontWeight,
        levelFontSize: parseFloat(levelStyle.fontSize),
        gaugeHeight: gaugeStyle ? parseFloat(gaugeStyle.height) : 0,
        gaugeSegments: document.querySelectorAll('.gauge-seg').length,
        needleLeft: document.querySelector('#gaugeNeedle').style.left,
        vgauge: rectOf('.vgauge'),
        vsegCount: document.querySelectorAll('.vseg').length,
        vNeedleBottom: document.querySelector('#vGaugeNeedle').style.bottom
      };
    });

    /* 视觉硬指标：主视觉尺寸、HUD 容器化、字号层级、速度刻度尺 */
    if (layout.eggCssSize < 72) {
      errors.push('[visual] 蛋直径 ' + layout.eggCssSize + 'px 小于 72px');
    }
    /* 贴边竖向刻度条：红黄绿三段、真的竖着、指针接上了 */
    if (layout.vsegCount !== 3) {
      errors.push('[visual] 贴边竖向刻度条应为红黄绿三段，实际 ' + layout.vsegCount + ' 段');
    }
    if (layout.vgauge) {
      const vh = layout.vgauge.bottom - layout.vgauge.top;
      const vw = layout.vgauge.right - layout.vgauge.left;
      if (vh <= vw * 2) {
        errors.push('[visual] 贴边刻度条不是竖向的（' + vw + '×' + vh + '）');
      }
      if (layout.vgauge.top < 44 + 56 - 6) {
        errors.push('[host] 竖向刻度条顶部 ' + layout.vgauge.top + 'px 侵入了宿主按钮区');
      }
    } else {
      errors.push('[visual] 画布右缘没有贴边竖向刻度条');
    }
    if (layout.hudRadius < 14) {
      errors.push('[visual] HUD 卡片圆角 ' + layout.hudRadius + 'px 小于 14px');
    }
    if (!layout.hudBg || layout.hudBg === 'none') {
      errors.push('[visual] HUD 卡片没有玻璃拟态底色');
    }
    if (parseFloat(layout.hudBorder) < 1) {
      errors.push('[visual] HUD 卡片描边 ' + layout.hudBorder + '，缺少 1px 高光描边');
    }
    if (layout.streakFontSize < 28 || layout.streakFontSize > 34) {
      errors.push('[visual] 主数值字号 ' + layout.streakFontSize + 'px 不在 28–34px 区间');
    }
    if (Number(layout.streakFontWeight) < 700) {
      errors.push('[visual] 主数值字重 ' + layout.streakFontWeight + ' 不是粗体');
    }
    if (layout.levelFontSize < 12 || layout.levelFontSize > 13) {
      errors.push('[visual] 副信息字号 ' + layout.levelFontSize + 'px 不在 12–13px 区间');
    }
    if (layout.gaugeSegments !== 3) {
      errors.push('[visual] 落地速度刻度尺应为红黄绿三段，实际 ' + layout.gaugeSegments + ' 段');
    }
    if (layout.gaugeHeight < 6) {
      errors.push('[visual] 落地速度刻度尺高度 ' + layout.gaugeHeight + 'px 过小');
    }
    /* 反推 0 延迟：同帧内点下，速度必须立刻下降一个冲量 */
    const delta = before.vy - after.vy;
    if (before.pulses > 0 && after.pulses !== before.pulses - 1) {
      errors.push('[visual] 点击后脉冲没有减 1（' + before.pulses + ' → ' + after.pulses + '）');
    }
    if (before.pulses > 0 && delta < tap.impulse * 0.9) {
      errors.push('[visual] 反推当帧速度只降了 ' + delta.toFixed(1) + '，应至少 ' + tap.impulse + '（0 延迟）');
    }
    if (before.pulses > 0 && (!after.jet || after.jet <= 0)) {
      errors.push('[visual] 点下后没有开启喷焰视觉计时');
    }
    /* 宿主按钮不能压住 HUD 与画布 */
    if (layout.hud && layout.hud.top < 44 + 56 - 6) {
      errors.push('[host] HUD 顶部 ' + layout.hud.top + 'px 侵入了宿主按钮区');
    }

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
      fieldWidth: window.__eggRenderer.getFieldWidth(),
      eggCssSize: Math.round(window.__eggRenderer.getEggCssSize())
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
