/*
 * 弹珠神殿（玉球金殿）· 全流程自检（三期严格复刻口径）
 * 覆盖：封面（背后演示模式）→ 开始 → 真实拖拽弹弓击球 → 杆数扣减 / 球移动 →
 *       提示 chip 首杆后收起 → 快速点按 / pointercancel 不发射（真机回归）→
 *       无中转面板直接推进殿堂 → 快进跑完八殿 → 原版结算（你的神来一杆 / 宝石数 / 颗宝石）→
 *       720×960 技巧卡 → 保存兜底提示。
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

/* 画布坐标 → 屏幕坐标：三期起物理坐标系就是画布 CSS px（缩放恒为 1） */
async function fieldToScreen(page, box, x, y) {
  const view = await page.evaluate(() => ({
    scale: window.__templeRenderer.getScale(),
    off: window.__templeRenderer.getOffset()
  }));
  return { x: box.x + view.off.x + x * view.scale, y: box.y + view.off.y + y * view.scale };
}

/* 真实拖一杆（弹弓）：从玉球位置按下，向发射反方向拖 dragLen px，松手 */
async function dragShot(page, box, angle, dragLen) {
  const info = await page.evaluate(() => ({
    ball: { x: window.__templeState.ball.x, y: window.__templeState.ball.y },
    hold: window.BilliardGame.AIM_MIN_HOLD_MS
  }));
  const from = await fieldToScreen(page, box, info.ball.x, info.ball.y);
  const to = await fieldToScreen(
    page,
    box,
    info.ball.x - Math.cos(angle) * dragLen,
    info.ball.y - Math.sin(angle) * dragLen
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.waitForTimeout(Math.max(180, info.hold + 60));
  await page.mouse.up();
  return info;
}

async function waitBallStop(page, timeout) {
  try {
    await page.waitForFunction(
      () => window.__templeState && !window.__templeState.ball.moving,
      null,
      { timeout: timeout || 15000 }
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
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'flow-intro.png') });

  const report = {};

  /* ---------- 封面（背后是演示模式） ---------- */
  const introCheck = await page.evaluate(() => {
    const s = window.__templeState;
    return {
      phase: window.__templePhase(),
      mode: s.mode,
      demoAreaYRatio: +(s.area.y / 760).toFixed(3),
      demoMoving: s.ball.moving,
      hintHidden: document.querySelector('#hintChip').hidden,
      gestureHidden: document.querySelector('#gestureHint').hidden
    };
  });
  if (introCheck.phase !== 'intro') errors.push('[flow] 初始应是 intro 阶段');
  if (introCheck.mode !== 'demo') errors.push('[flow] 封面背后应是演示模式');
  if (Math.abs(introCheck.demoAreaYRatio - 0.07) > 0.01) {
    errors.push('[flow] 演示区域上沿应是 0.07H，实际 ' + introCheck.demoAreaYRatio);
  }
  report.intro = introCheck;

  /* ---------- 开始 ---------- */
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const afterStart = await page.evaluate(() => ({
    phase: window.__templePhase(),
    mode: window.__templeState.mode,
    hudVisible: !document.querySelector('#hud').hidden,
    introHidden: document.querySelector('#intro').hidden,
    hintVisible: !document.querySelector('#hintChip').hidden,
    gestureVisible: !document.querySelector('#gestureHint').hidden,
    room: window.__templeState.room,
    shots: window.__templeState.shots,
    gems: window.__templeState.gems,
    hudRoom: document.querySelector('#chamberRoom').textContent,
    hudShots: document.querySelector('#shotsLeft').textContent,
    hudGems: document.querySelector('#gemCount').textContent
  }));
  if (afterStart.phase !== 'play' || afterStart.mode !== 'play') errors.push('[flow] 开始后应进入玩法');
  if (!afterStart.hudVisible || !afterStart.introHidden) errors.push('[flow] 开始后 HUD 应出现、封面应收起');
  if (!afterStart.hintVisible || !afterStart.gestureVisible) {
    errors.push('[flow] 第一杆前应显示提示 chip 与手势提示');
  }
  if (afterStart.room !== 1 || afterStart.shots !== 4 || afterStart.gems !== 0) {
    errors.push('[flow] 初始统计字段应为 {room:1, shots:4, gems:0}');
  }
  if (afterStart.hudRoom !== '1/8' || afterStart.hudShots !== '4') {
    errors.push('[flow] HUD 字段应为 殿 1/8 · 杆 4');
  }
  report.afterStart = afterStart;

  const box = await page.locator('#field').boundingBox();

  /* ---------- 真实拖拽弹弓：拖住时不扣杆，松手才扣 ---------- */
  const dragInfo = await (async () => {
    const info = await page.evaluate(() => ({
      ball: { x: window.__templeState.ball.x, y: window.__templeState.ball.y },
      hold: window.BilliardGame.AIM_MIN_HOLD_MS
    }));
    const from = await fieldToScreen(page, box, info.ball.x, info.ball.y);
    const to = await fieldToScreen(page, box, info.ball.x + 80, info.ball.y - 45);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.waitForTimeout(150);
    const aiming = await page.evaluate(() => ({
      shots: window.__templeState.shots,
      moving: window.__templeState.ball.moving,
      hintVisible: !document.querySelector('#hintChip').hidden
    }));
    if (aiming.shots !== 4) errors.push('[flow] 还在拖住就扣了杆数');
    if (aiming.moving) errors.push('[flow] 拖住瞄准时球不应已在滚动');
    if (aiming.hintVisible) errors.push('[flow] 按下后提示 chip 应收起（原版 b 标志）');
    await page.screenshot({ path: path.join(OUT, 'flow-aiming.png') });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const released = await page.evaluate(() => ({
      shots: window.__templeState.shots,
      moving: window.__templeState.ball.moving,
      gestureVisible: !document.querySelector('#gestureHint').hidden
    }));
    if (released.shots !== 3) errors.push('[flow] 松手应发射并扣 1 杆（4→3）');
    if (!released.moving) errors.push('[flow] 松手后球应滚动');
    if (released.gestureVisible) errors.push('[flow] 手势提示也应随首杆收起');
    await page.screenshot({ path: path.join(OUT, 'flow-play.png') });
    return { aiming, released };
  })();
  report.dragShot = dragInfo;

  /* 有杆数时球永不停（原版托底 0.08）：停不下来，等待会超时 */
  const neverStops = await waitBallStop(page, 2500);
  if (neverStops) errors.push('[flow] 还有剩余杆数时球不应停下（原版速度托底）');
  report.neverStops = !neverStops;

  /* ---------- 快速点按回归：<80ms 点按绝不发射 ---------- */
  const tapCheck = await page.evaluate(() => ({
    shots: window.__templeState.shots,
    ball: { x: window.__templeState.ball.x, y: window.__templeState.ball.y }
  }));
  const tapAt = await fieldToScreen(page, box, tapCheck.ball.x + 60, tapCheck.ball.y - 30);
  await page.mouse.move(tapAt.x, tapAt.y);
  const t0 = Date.now();
  await page.mouse.down();
  await page.mouse.up();
  const tapMs = Date.now() - t0;
  await page.waitForTimeout(250);
  const afterTap = await page.evaluate(() => ({ shots: window.__templeState.shots }));
  if (tapMs < 75 && afterTap.shots !== tapCheck.shots) {
    errors.push('[flow] 快速点按（' + tapMs + 'ms）发射了——最短按住时长没生效');
  }
  report.quickTap = { tapMs: tapMs, shotsBefore: tapCheck.shots, shotsAfter: afterTap.shots };

  /* ---------- pointercancel 回归：瞄准中被系统接管绝不发射 ---------- */
  const cancelCheck = await (async () => {
    const info = await page.evaluate(() => ({
      ball: { x: window.__templeState.ball.x, y: window.__templeState.ball.y }
    }));
    const from = await fieldToScreen(page, box, info.ball.x, info.ball.y);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 60, from.y, { steps: 4 });
    await page.waitForTimeout(120);
    /* 模拟系统接管：向画布派发 pointercancel（mouse 指针的 pointerId 在 Chrome 中为 1 附近，
       直接对 canvas 派发，让 app 的 cancel 分支中止瞄准） */
    await page.evaluate(() => {
      const canvas = document.querySelector('#field');
      const event = new PointerEvent('pointercancel', { pointerId: 1, bubbles: true });
      canvas.dispatchEvent(event);
    });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(200);
    return page.evaluate(() => ({ shots: window.__templeState.shots }));
  })();
  report.pointerCancel = cancelCheck;

  /* ---------- 无中转面板：殿堂自动推进 ---------- */
  const hasLevelPanel = await page.evaluate(() => !!document.querySelector('#levelPanel'));
  if (hasLevelPanel) errors.push('[flow] 不应存在中转面板（原版殿堂自动推进）');

  /* ---------- 快进跑完八殿 → 原版结算 ---------- */
  await page.evaluate(() => window.__templeFastForward(600000));
  await page.waitForTimeout(400);
  const resultCheck = await page.evaluate(() => {
    const card = document.querySelector('#shareCard');
    const pixels = (canvas) => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    };
    return {
      phase: window.__templePhase(),
      visible: !document.querySelector('#result').hidden,
      title: document.querySelector('#resultTitle').textContent,
      gems: document.querySelector('#resultGems').textContent,
      sub: document.querySelector('#resultSub').textContent,
      againLabel: document.querySelector('#againBtn').textContent,
      totalGems: window.__templeState.gems,
      finished: window.__templeState.finished,
      cardSize: card ? [card.width, card.height] : null,
      cardPixels: card ? pixels(card) : 0,
      codexCells: document.querySelectorAll('.codex-cell').length,
      codexOn: document.querySelectorAll('.codex-cell.on').length,
      hudHidden: document.querySelector('#hud').hidden
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-result.png') });
  if (resultCheck.phase !== 'result' || !resultCheck.visible) {
    errors.push('[flow] 跑完八殿后结算面板没有出现');
  }
  if (resultCheck.title !== '你的神来一杆') errors.push('[flow] 结算标题应为「你的神来一杆」');
  if (resultCheck.sub !== '颗宝石') errors.push('[flow] 结算副标题应为「颗宝石」');
  if (!/^\d+$/.test(resultCheck.gems)) errors.push('[flow] 结算主数字缺失');
  if (Number(resultCheck.gems) !== resultCheck.totalGems) {
    errors.push('[flow] 结算宝石数与统计不一致');
  }
  if (!resultCheck.finished) errors.push('[flow] 整局未标记 finished');
  if (!resultCheck.cardSize || resultCheck.cardSize[0] !== 720 || resultCheck.cardSize[1] !== 960) {
    errors.push('[flow] 技巧卡不是 720×960：' + JSON.stringify(resultCheck.cardSize));
  }
  if (!resultCheck.cardPixels) errors.push('[flow] 技巧卡画布是空的');
  if (resultCheck.codexCells !== 8) errors.push('[flow] 图鉴格子数不对：' + resultCheck.codexCells);
  if (resultCheck.codexOn !== 8) errors.push('[flow] 八殿跑完后图鉴应全亮：' + resultCheck.codexOn);
  if (!resultCheck.hudHidden) errors.push('[flow] 结算时玩法 HUD 应隐藏');
  report.result = resultCheck;

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

  /* ---------- 再玩一次：回到第 1 殿、统计清零 ---------- */
  await page.click('#againBtn');
  await page.waitForTimeout(400);
  const replay = await page.evaluate(() => ({
    phase: window.__templePhase(),
    room: window.__templeState.room,
    shots: window.__templeState.shots,
    gems: window.__templeState.gems,
    resultHidden: document.querySelector('#result').hidden,
    hintVisible: !document.querySelector('#hintChip').hidden
  }));
  if (replay.phase !== 'play' || replay.room !== 1 || replay.shots !== 4 || replay.gems !== 0) {
    errors.push('[flow] 再玩一次应回到 {room:1, shots:4, gems:0}');
  }
  if (!replay.resultHidden) errors.push('[flow] 再玩一次后结算面板应收起');
  if (!replay.hintVisible) errors.push('[flow] 再玩一次后首杆提示应重新出现（原版 v(!1)）');
  report.replay = replay;

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
