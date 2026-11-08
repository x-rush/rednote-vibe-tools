/*
 * 弹珠神殿 · 全流程自检
 * 覆盖：真实拖拽瞄准 → 发射 → 球飞出去 → 撞墙反弹 → 收宝石 → 通关面板不得自行推进 →
 *       下一殿 → 走完八殿 → 宝石图鉴 → 720×960 技巧卡 → 保存兜底提示。
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

/* 殿堂坐标 → 屏幕坐标 */
async function arenaToScreen(page, box, ax, ay) {
  const view = await page.evaluate(() => {
    const r = window.__templeRenderer;
    return { scale: r.getScale(), off: r.getOffset() };
  });
  return { x: box.x + view.off.x + ax * view.scale, y: box.y + view.off.y + ay * view.scale };
}

/* 真实拖一杆：按住玉球往瞄准方向拖，拖出的长度决定力度 */
async function shootPar(page, box) {
  const info = await page.evaluate(() => {
    const s = window.__templeState;
    const g = window.BilliardGame;
    return {
      ball: { x: s.ball.x, y: s.ball.y },
      par: s.level.par,
      min: g.MIN_SPEED,
      max: g.MAX_SPEED,
      drag: g.MAX_DRAG
    };
  });
  const angle = (info.par.angle * Math.PI) / 180;
  const ratio = (info.par.speed - info.min) / (info.max - info.min);
  const dragLen = Math.max(12, Math.min(1, ratio) * info.drag);
  const from = await arenaToScreen(page, box, info.ball.x, info.ball.y);
  const to = await arenaToScreen(
    page,
    box,
    info.ball.x + Math.cos(angle) * dragLen,
    info.ball.y + Math.sin(angle) * dragLen
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  return { angle: info.par.angle, speed: info.par.speed, dragLen: dragLen };
}

async function waitShotEnd(page, timeout) {
  try {
    await page.waitForFunction(
      () => window.__templeState.phase !== 'roll',
      null,
      { timeout: timeout || 12000 }
    );
    return true;
  } catch (error) {
    return false;
  }
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
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const afterStart = await page.evaluate(() => ({
    hudVisible: !document.querySelector('#hud').hidden,
    toolsVisible: !document.querySelector('#tools').hidden,
    introHidden: document.querySelector('#intro').hidden,
    chamber: window.__templeState.level.name,
    gems: window.__templeState.gemsLeft,
    shots: window.__templeState.shotsLeft
  }));
  if (!afterStart.hudVisible || !afterStart.toolsVisible) {
    errors.push('[flow] 开始后 HUD / 工具栏没有出现');
  }
  if (!afterStart.introHidden) errors.push('[flow] 开场面板没有收起');
  report.afterStart = afterStart;

  /* ---------- 静音开关 ---------- */
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const muted = await page.evaluate(() => ({
    label: document.querySelector('#muteBtn').textContent,
    audioMuted: window.BilliardAudio.isMuted()
  }));
  if (muted.audioMuted !== true) errors.push('[flow] 静音按钮没有真正关闭音效');
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const unmuted = await page.evaluate(() => window.BilliardAudio.isMuted());
  if (unmuted !== false) errors.push('[flow] 再次点击静音按钮没有恢复声音');
  report.mute = { after: muted, back: unmuted };

  const box = await page.locator('#field').boundingBox();

  /* ---------- 真实拖拽瞄准：拖住时应该有瞄准线 ---------- */
  const before = await page.evaluate(() => ({
    ball: { x: window.__templeState.ball.x, y: window.__templeState.ball.y }
  }));
  const dragFrom = await arenaToScreen(page, box, before.ball.x, before.ball.y);
  const dragTo = await arenaToScreen(page, box, before.ball.x + 70, before.ball.y - 40);
  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.down();
  await page.mouse.move(dragTo.x, dragTo.y, { steps: 5 });
  await page.waitForTimeout(120);
  const aimingState = await page.evaluate(() => ({
    shotsLeft: window.__templeState.shotsLeft,
    phase: window.__templeState.phase
  }));
  if (aimingState.shotsLeft !== afterStart.shots) {
    errors.push('[flow] 还在瞄准就扣了杆数');
  }
  if (aimingState.phase !== 'aim') errors.push('[flow] 瞄准时状态不该离开 aim');
  await page.screenshot({ path: path.join(OUT, 'flow-aiming.png') });
  await page.mouse.up();

  const afterRelease = await page.evaluate(() => ({
    shotsLeft: window.__templeState.shotsLeft,
    phase: window.__templeState.phase
  }));
  if (afterRelease.shotsLeft !== afterStart.shots - 1) {
    errors.push('[flow] 松手没有发射出这一杆');
  }
  report.aiming = { aimingState: aimingState, afterRelease: afterRelease };

  /* 这一杆不一定收齐宝石，先让它停下来 */
  await waitShotEnd(page);
  await page.screenshot({ path: path.join(OUT, 'flow-rolling.png') });

  /* ---------- 走完八殿：每一殿都用标称杆真实拖一杆 ---------- */
  /* 上面那轮瞄准测试已经打掉一杆，球不在起点了。标称解是按「殿内起始球位」解出来的，
     所以必须重开一局，让每一殿都从标准起手位开始。 */
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
  });
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const freshBox = await page.locator('#field').boundingBox();

  const chambers = [];
  for (let i = 0; i < 8; i++) {
    const levelInfo = await page.evaluate(() => ({
      index: window.__templeState.levelIndex,
      name: window.__templeState.level.name,
      gems: window.__templeState.gemsLeft,
      shots: window.__templeState.shotsLeft
    }));
    const shot = await shootPar(page, freshBox);
    const ended = await waitShotEnd(page);
    if (!ended) errors.push('[flow] ' + levelInfo.name + '：这一杆没有停下来');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({
      phase: window.__templeState.phase,
      gems: window.__templeState.gemsLeft,
      shots: window.__templeState.shotsLeft,
      panelVisible: !document.querySelector('#levelPanel').hidden,
      title: document.querySelector('#levelTitle').textContent
    }));
    chambers.push({ level: levelInfo, shot: shot, after: after });
    if (after.phase !== 'cleared') {
      errors.push(
        '[flow] ' + levelInfo.name + '：标称杆没有过关（还剩 ' + after.gems + ' 颗宝石）'
      );
      break;
    }
    if (!after.panelVisible) errors.push('[flow] ' + levelInfo.name + '：通关面板没有出现');
    if (i === 0) {
      await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });
      /* 关键断言：通关面板不自行推进 */
      await page.waitForTimeout(3000);
      const still = await page.evaluate(() => ({
        levelIndex: window.__templeState.levelIndex,
        panelVisible: !document.querySelector('#levelPanel').hidden
      }));
      if (still.levelIndex !== 0 || !still.panelVisible) {
        errors.push('[flow] 通关面板未等待确认就自行推进到下一殿');
      }
      report.panelStays = still;
    }
    await page.click('#nextBtn');
    await page.waitForTimeout(400);
  }
  report.chambers = chambers;

  /* ---------- 结算面板 ---------- */
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
      gems: document.querySelector('#resultGems').textContent,
      best: document.querySelector('#resultBest').textContent,
      newBest: !document.querySelector('#bestFlag').hidden,
      cardSize: card ? [card.width, card.height] : null,
      cardPixels: card ? pixels(card) : 0,
      codexCells: document.querySelectorAll('.codex-cell').length,
      codexOn: document.querySelectorAll('.codex-cell.on').length
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  if (!resultPanel.visible) errors.push('[flow] 全部通关后结算面板没有出现');
  if (resultPanel.gems !== '8') errors.push('[flow] 结算面板的宝石数不是 8：' + resultPanel.gems);
  if (!resultPanel.cardSize || resultPanel.cardSize[0] !== 720 || resultPanel.cardSize[1] !== 960) {
    errors.push('[flow] 技巧卡不是 720×960：' + JSON.stringify(resultPanel.cardSize));
  }
  if (!resultPanel.cardPixels) errors.push('[flow] 技巧卡画布是空的');
  if (resultPanel.codexCells !== 8) errors.push('[flow] 图鉴格子数不对：' + resultPanel.codexCells);
  if (resultPanel.codexOn !== 8) errors.push('[flow] 图鉴没有集齐 8 颗宝石：' + resultPanel.codexOn);
  report.resultPanel = resultPanel;

  /* 先落盘报告：后面任何一步失败也要留下现场 */
  report.errors = errors;
  fs.writeFileSync(path.join(OUT, 'flow-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

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

  report.errors = errors;
  fs.writeFileSync(path.join(OUT, 'flow-report.json'), JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.close();
  if (errors.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
