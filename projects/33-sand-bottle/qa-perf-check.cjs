/*
 * 彩沙瓶 · 性能门禁（三期：逐粒沙物理 + 三层缓存版）
 *
 * 三期改为逐粒沙物理（最多 2600 粒），原版每帧全量重画 2600 粒。
 * 本项目的做法：沙层按引擎 dirty 标记失效——粒子位置或集合有变才
 * 全量重画沙层（2600 次 sprite drawImage），静止帧只有 3 次 drawImage。
 *
 * 本脚本用 Playwright + CDP 在 4x CPU 节流（模拟中端手机 WebView）下：
 *   1. 连续 15 秒倒沙 + 推杆操作，采样 rAF：平均 ≥ 50fps 且无 >100ms 长帧；
 *   2. 静止 2 秒（不操作）：每帧绘制调用 ≤ 3 次 drawImage（renderer 自绘计数器），
 *      且静止帧率不掉；
 *   3. 输出 perf-report.json 供回执引用。
 *
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
/* argv[2] 可指定其它构建目录（跑重构前基线用：qa/baseline-dist） */
const DIST = path.resolve(ROOT, process.argv[2] || path.join(ROOT, 'dist'));
const OUT = path.join(ROOT, 'qa');

const INTERACT_MS = 15000;
const IDLE_MS = 2000;
const MIN_FPS = 50;
const MAX_FRAME_MS = 100;
const MAX_IDLE_DRAWS = 3;
/* 4x 节流下的每帧渲染耗时预算：静止帧对应真机 60fps 有 4 倍余量 */
const MAX_IDLE_FRAME_MS = 16.7;
const MAX_INTERACT_FRAME_MS = 33;

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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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

  /* 4x CPU 节流：模拟中端 Android WebView 的单核性能 */
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  /* 开局：封面 → 选瓶 → 圆肩瓶 */
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  await page.click('.shape-card[data-shape="round"]');
  await page.waitForTimeout(900);

  /* rAF 采样器：收集帧时间戳、每帧绘制调用数与每帧渲染耗时 */
  await page.evaluate(() => {
    window.__perfSamples = [];
    window.__perfDraws = [];
    window.__perfMs = [];
    window.__perfOn = true;
    const r = window.__sandRenderer;
    const tick = (stamp) => {
      if (!window.__perfOn) return;
      window.__perfSamples.push(stamp);
      const stats = r.getStats ? r.getStats() : null;
      window.__perfDraws.push(stats ? stats.lastFrameDraws : -1);
      if (stats) window.__perfMs.push(stats.lastFrameMs);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const box = await page.locator('#field').boundingBox();
  const left = box.x + box.width * 0.22;
  const right = box.x + box.width * 0.78;
  const midY = box.y + box.height * 0.55;

  /* ---------- 阶段 1：15 秒倒沙 + 推杆混合操作 ---------- */
  /* 输入用轻量 mouse 事件；切换工具用 DOM click（qa-flow 已验证真实点击路径） */
  const interactStart = Date.now();
  let phase = 'pour';
  let cursor = left;
  let dir = 1;
  await page.mouse.move(cursor, midY);
  await page.mouse.down();
  while (Date.now() - interactStart < INTERACT_MS) {
    const elapsed = Date.now() - interactStart;
    /* 前 8 秒按住倒沙并缓慢左右移动（tilt 随动），后 7 秒切成推杆推沙 */
    if (phase === 'pour' && elapsed > 8000) {
      await page.mouse.up();
      await page.evaluate(() => document.querySelector('.tool[data-tool="rod"]').click());
      await page.mouse.move(cursor, midY);
      await page.mouse.down();
      phase = 'rod';
    }
    cursor += dir * 34;
    if (cursor > right) { cursor = right; dir = -1; }
    if (cursor < left) { cursor = left; dir = 1; }
    await page.mouse.move(cursor, midY, { steps: 3 });
    await page.waitForTimeout(140);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  /* 切回倒沙工具，避免影响下一段 */
  await page.evaluate(() => document.querySelector('.tool[data-tool="pour"]').click());

  /* 取走交互段样本 */
  const interact = await page.evaluate(() => {
    window.__perfOn = false;
    return {
      samples: window.__perfSamples.slice(),
      draws: window.__perfDraws.slice(),
      ms: window.__perfMs.slice()
    };
  });

  function summarize(samples, draws, ms) {
    if (samples.length < 2) return { frames: samples.length, fps: 0, maxGap: 0, maxDraws: 0, p95Ms: 0 };
    let gaps = 0;
    let maxGap = 0;
    for (let i = 1; i < samples.length; i++) {
      const gap = samples[i] - samples[i - 1];
      gaps += gap;
      if (gap > maxGap) maxGap = gap;
    }
    let drawMax = 0;
    for (let i = 0; i < draws.length; i++) {
      if (draws[i] > drawMax) drawMax = draws[i];
    }
    /* 每帧渲染耗时分布：headless 无 vsync 时 fps 会虚高，帧耗时才是真指标 */
    const valid = ms.filter(function (v) { return v >= 0; }).sort(function (a, b) { return a - b; });
    const p95 = valid.length ? valid[Math.min(valid.length - 1, Math.floor(valid.length * 0.95))] : -1;
    const avg = valid.length ? Math.round(valid.reduce(function (s, v) { return s + v; }, 0) / valid.length * 100) / 100 : -1;
    const span = samples[samples.length - 1] - samples[0];
    return {
      frames: samples.length,
      fps: span > 0 ? Math.round((samples.length - 1) / (span / 1000)) : 0,
      maxGap: Math.round(maxGap),
      maxDraws: drawMax,
      avgMs: avg,
      p95Ms: Math.round(p95 * 100) / 100
    };
  }

  const interactStats = summarize(interact.samples, interact.draws, interact.ms);

  /* ---------- 阶段 2：静止 2 秒（鼠标移出画布，沙堆落定） ---------- */
  await page.mouse.move(2, 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__perfSamples = [];
    window.__perfDraws = [];
    window.__perfMs = [];
    window.__perfOn = true;
    const tick = (stamp) => {
      if (!window.__perfOn) return;
      window.__perfSamples.push(stamp);
      const stats = window.__sandRenderer.getStats ? window.__sandRenderer.getStats() : null;
      window.__perfDraws.push(stats ? stats.lastFrameDraws : -1);
      if (stats) window.__perfMs.push(stats.lastFrameMs);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(IDLE_MS);
  const idle = await page.evaluate(() => {
    window.__perfOn = false;
    return {
      samples: window.__perfSamples.slice(),
      draws: window.__perfDraws.slice(),
      ms: window.__perfMs.slice()
    };
  });
  const idleStats = summarize(idle.samples, idle.draws, idle.ms);
  const grainCount = await page.evaluate(() => (window.__sandEngine ? window.__sandEngine.grains.length : -1));

  /* ---------- 断言 ---------- */
  if (errors.length === 0) {
    if (interactStats.fps < MIN_FPS) {
      errors.push('[perf] 交互段平均帧率 ' + interactStats.fps + ' < ' + MIN_FPS);
    }
    if (interactStats.maxGap > MAX_FRAME_MS) {
      errors.push('[perf] 交互段最长帧间隔 ' + interactStats.maxGap + 'ms > ' + MAX_FRAME_MS + 'ms');
    }
    if (idleStats.fps < MIN_FPS) {
      errors.push('[perf] 静止段平均帧率 ' + idleStats.fps + ' < ' + MIN_FPS);
    }
    if (idleStats.maxDraws > MAX_IDLE_DRAWS) {
      errors.push(
        '[perf] 静止段每帧绘制调用 ' + idleStats.maxDraws + ' 次 > ' + MAX_IDLE_DRAWS + ' 次 drawImage'
      );
    }
    /* 每帧渲染耗时：headless 无 vsync 时 fps 虚高，帧耗时才对应真机预算。
       4x 节流下静止帧 P95 ≤ 16.7ms 等于真机有 4 倍余量跑满 60fps。 */
    if (idleStats.p95Ms > MAX_IDLE_FRAME_MS) {
      errors.push('[perf] 静止段 P95 帧耗时 ' + idleStats.p95Ms + 'ms > ' + MAX_IDLE_FRAME_MS + 'ms');
    }
    if (interactStats.p95Ms > MAX_INTERACT_FRAME_MS) {
      errors.push('[perf] 交互段 P95 帧耗时 ' + interactStats.p95Ms + 'ms > ' + MAX_INTERACT_FRAME_MS + 'ms');
    }
  }

  const isBaseline = /baseline/.test(DIST);
  const report = {
    throttling: 'cpu-4x',
    viewport: '390x844@2x',
    shape: 'round',
    engine: 'per-grain (2600 cap)',
    grains: grainCount,
    dist: path.relative(ROOT, DIST) || 'dist',
    interact: Object.assign({ seconds: INTERACT_MS / 1000 }, interactStats),
    idle: Object.assign({ seconds: IDLE_MS / 1000 }, idleStats),
    thresholds: {
      minFps: MIN_FPS,
      maxFrameMs: MAX_FRAME_MS,
      maxIdleDraws: MAX_IDLE_DRAWS,
      maxIdleFrameMs: MAX_IDLE_FRAME_MS,
      maxInteractFrameMs: MAX_INTERACT_FRAME_MS
    },
    errors: errors
  };
  const reportFile = isBaseline ? 'perf-report-baseline.json' : 'perf-report.json';
  fs.writeFileSync(path.join(OUT, reportFile), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.close();
  if (errors.length) process.exitCode = 1;
  else {
    console.log(
      'PERF PASS：4x 节流下交互 ' + interactStats.fps + 'fps（长帧 ' + interactStats.maxGap +
      'ms）· 静止 ' + idleStats.fps + 'fps · 每帧绘制 ≤ ' + idleStats.maxDraws + ' 次 drawImage' +
      ' · 沙粒数 ' + grainCount
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
