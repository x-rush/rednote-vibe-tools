/*
 * 沙丘速降 · 全流程自检
 * 覆盖：开场 → 开始 → HUD 刷新 → 真实拖拽切弯 → 世界推进 → 静音开关 →
 *       被雪崩追上 → 结算面板 → 山脊线纪录卡 720×960 → 保存兜底 → 再滑一次。
 * 复用仓库既有 Playwright 运行时，不新增依赖。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
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
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
  });

  const report = {};

  /* ---------- 开场 ---------- */
  const intro = await page.evaluate(() => ({
    introVisible: !document.querySelector('#intro').hidden,
    hudHidden: document.querySelector('#hud').hidden,
    startText: document.querySelector('#startBtn').textContent,
    lines: document.querySelectorAll('#startLines p').length
  }));
  if (!intro.introVisible) errors.push('[flow] 开场面板没有出现');
  if (!intro.hudHidden) errors.push('[flow] 开局前 HUD 不该出现');
  if (intro.lines < 3) errors.push('[flow] 开场说明行数不对：' + intro.lines);
  report.intro = intro;

  /* ---------- 开始 ---------- */
  await page.click('#startBtn');
  await page.waitForTimeout(700);
  const afterStart = await page.evaluate(() => ({
    phase: window.__dunePhase(),
    hudVisible: !document.querySelector('#hud').hidden,
    introHidden: document.querySelector('#intro').hidden,
    meters: document.querySelector('#distance').textContent,
    stage: document.querySelector('#stageName').textContent
  }));
  if (afterStart.phase !== 'run') errors.push('[flow] 开始后状态不对：' + afterStart.phase);
  if (!afterStart.hudVisible) errors.push('[flow] 开始后 HUD 没有出现');
  if (!afterStart.introHidden) errors.push('[flow] 开场面板没有收起');
  report.afterStart = afterStart;

  /* ---------- 静音开关 ---------- */
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const muted = await page.evaluate(() => ({
    label: document.querySelector('#muteBtn').textContent,
    audioMuted: window.DuneAudio.isMuted()
  }));
  if (muted.audioMuted !== true) errors.push('[flow] 静音按钮没有真正关掉音效');
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const unmuted = await page.evaluate(() => window.DuneAudio.isMuted());
  if (unmuted !== false) errors.push('[flow] 再次点击静音按钮没有恢复声音');
  report.mute = { after: muted, back: unmuted };

  /* ---------- 真实拖拽切弯 ---------- */
  const box = await page.locator('#field').boundingBox();
  const before = await page.evaluate(() => ({
    x: window.__duneState.x,
    s: window.__duneState.s,
    distance: document.querySelector('#distance').textContent
  }));
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.72;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + box.width * 0.3, startY, { steps: 10 });
  await page.waitForTimeout(400);
  const during = await page.evaluate(() => ({
    x: window.__duneState.x,
    s: window.__duneState.s,
    distance: document.querySelector('#distance').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-run.png') });
  await page.mouse.up();

  if (Math.abs(during.x - before.x) < 12) {
    errors.push('[flow] 真实拖拽没有把玉板带过去');
  }
  if (during.s <= before.s) errors.push('[flow] 世界没有往前跑');
  if (Number(during.distance) <= Number(before.distance)) {
    errors.push('[flow] HUD 的距离没有跟着刷新');
  }
  report.drag = { before: before, during: during };

  /* ---------- 让雪崩追上来 ---------- */
  await page.evaluate(() => {
    window.__duneState.gap = 0;
  });
  let over = false;
  try {
    await page.waitForFunction(() => window.__dunePhase() === 'over', null, { timeout: 8000 });
    over = true;
  } catch (error) {
    over = false;
  }
  if (!over) errors.push('[flow] 雪崩追上来了却没有结束这一局');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'flow-over.png') });

  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    const pixels = (canvas) => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    };
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      score: document.querySelector('#resultScore').textContent,
      distance: document.querySelector('#resultDistance').textContent,
      flags: document.querySelector('#resultFlags').textContent,
      carves: document.querySelector('#resultCarves').textContent,
      speed: document.querySelector('#resultSpeed').textContent,
      best: document.querySelector('#resultBest').textContent,
      newBest: !document.querySelector('#bestFlag').hidden,
      cardSize: card ? [card.width, card.height] : null,
      cardPixels: card ? pixels(card) : 0,
      trailPoints: window.__duneState.trail.length
    };
  });
  if (!resultPanel.visible) errors.push('[flow] 结算面板没有出现');
  if (!resultPanel.cardSize || resultPanel.cardSize[0] !== 720 || resultPanel.cardSize[1] !== 960) {
    errors.push('[flow] 纪录卡不是 720×960：' + JSON.stringify(resultPanel.cardSize));
  }
  if (!resultPanel.cardPixels) errors.push('[flow] 纪录卡画布是空的');
  if (Number(resultPanel.distance) <= 0) errors.push('[flow] 结算面板的距离是 0');
  if (resultPanel.trailPoints < 5) errors.push('[flow] 山脊线轨迹点太少：' + resultPanel.trailPoints);
  report.resultPanel = resultPanel;

  /* ---------- 保存兜底 ---------- */
  try {
    await page.click('#saveBtn', { timeout: 5000 });
    await page.waitForTimeout(300);
    const saveStatus = await page.textContent('#saveStatus');
    await page.screenshot({ path: path.join(OUT, 'flow-save.png') });
    if (!saveStatus || !saveStatus.trim()) errors.push('[flow] 保存按钮没有给出任何兜底提示');
    report.saveStatus = saveStatus;
  } catch (error) {
    errors.push('[flow] 结算面板里的保存按钮点不到：' + String(error.message || error));
    report.saveStatus = '';
  }

  /* ---------- 再滑一次 ---------- */
  await page.click('#againBtn');
  await page.waitForTimeout(600);
  const restarted = await page.evaluate(() => ({
    phase: window.__dunePhase(),
    resultHidden: document.querySelector('#result').hidden,
    meters: document.querySelector('#distance').textContent,
    s: window.__duneState.s
  }));
  if (restarted.phase !== 'run') errors.push('[flow] 再滑一次没有重新开局');
  if (!restarted.resultHidden) errors.push('[flow] 再滑一次后结算面板没有收起');
  if (restarted.s > 200) errors.push('[flow] 再滑一次后距离没有归零');
  report.restart = restarted;

  report.errors = errors;
  fs.writeFileSync(path.join(OUT, 'flow-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.close();
  if (errors.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
