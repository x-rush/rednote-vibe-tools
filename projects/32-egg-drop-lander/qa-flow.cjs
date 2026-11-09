/*
 * 蛋落地 · 全流程自检（三期玩法重建：脉冲着陆器）
 * 覆盖：真实点击反推打通第一关 → 单落结算面板不得自行推进 → 下一关 →
 *       脉冲耗尽摔碎面板 → 重试本关脉冲重置 → 完美贴地（完好 ×N 连击）→
 *       末关着陆 → 空投报告（幸存/最佳落速/剩余反推合计）→ 保存兜底提示。
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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/*
 * 玩家策略：巡航刹车 —— vy 每爬升超过「冲量 + 100」就点一发（点后 vy 回到
 * ≈100，单调下降、不悬停、不把脉冲浪费在爬升上）。原版冲量大，晚刹/悬停
 * 式打法会在脉冲耗尽后从高处摔死；巡航式在原版参数下对轮询节奏与点击延迟
 * 都有充分余量（离线验证 poll 0.03–0.1s × 抖动 0–0.15s 共 16 组全部幸存）。
 */
async function playLevel(page, box, maxSteps) {
  let pulses = 0;
  for (let i = 0; i < maxSteps; i++) {
    const decision = await page.evaluate(() => {
      const s = window.__eggState;
      if (s.phase === 'landed') return 'stop';
      if (s.phase !== 'falling' || s.pulses <= 0) return null;
      return s.egg.vy >= s.level.impulse + 100 ? 'tap' : null;
    });
    if (decision === 'stop') break;
    if (decision === 'tap') {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
      pulses++;
      await page.waitForTimeout(30);
    } else {
      await page.waitForTimeout(40);
    }
  }
  return pulses;
}

async function waitForDropPanel(page, errors, label) {
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#dropPanel');
      return !!el && !el.hidden;
    }, null, { timeout: 12000 })
    .catch(() => errors.push('[flow] ' + label + '：单落结算面板未出现'));
  await page.waitForTimeout(250);
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
  await page.click('#startBtn');
  await page.waitForTimeout(400);

  const box = await page.locator('#field').boundingBox();

  /* HUD 必须收进卡片：主数值与副信息都要有真实字号 */
  const hudInfo = await page.evaluate(() => {
    const card = document.querySelector('.hud-card');
    const streak = document.querySelector('#streak');
    const level = document.querySelector('#levelName');
    const pulse = document.querySelector('#pulseText');
    return {
      hasCard: !!card,
      cardRadius: card ? parseFloat(getComputedStyle(card).borderTopLeftRadius) : 0,
      cardBg: card ? getComputedStyle(card).backgroundImage.slice(0, 30) : '',
      streakFontSize: parseFloat(getComputedStyle(streak).fontSize),
      levelFontSize: parseFloat(getComputedStyle(level).fontSize),
      pulseDots: pulse ? pulse.querySelectorAll('i').length : 0,
      gaugeSegments: document.querySelectorAll('.gauge-seg').length,
      needleLeft: document.querySelector('#gaugeNeedle').style.left
    };
  });
  if (hudInfo.pulseDots !== 6) {
    errors.push('[flow] 第一关反推点数应为 6，实际 ' + hudInfo.pulseDots);
  }

  /* 真实操作：按策略反推，直到第一关结算 */
  const clicks = await playLevel(page, box, 900);
  await waitForDropPanel(page, errors, '第一关');
  const dropPanel = await page.evaluate(() => ({
    visible: !document.querySelector('#dropPanel').hidden,
    grade: document.querySelector('#dropGrade').textContent,
    speed: document.querySelector('#dropSpeed').textContent,
    pulsesLeft: document.querySelector('#dropPulses').textContent,
    nextLabel: document.querySelector('#nextBtn').textContent
  }));
  if (dropPanel.grade === '摔碎了') {
    errors.push('[flow] 第一关按策略打不该摔碎：' + JSON.stringify(dropPanel));
  }
  await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });

  /* 关键断言：结算面板不自行推进 */
  await page.waitForTimeout(3000);
  const beforeNext = await page.evaluate(() => ({
    levelIndex: window.__eggState.levelIndex,
    panelVisible: !document.querySelector('#dropPanel').hidden
  }));
  if (beforeNext.levelIndex !== 0 || !beforeNext.panelVisible) {
    errors.push('[flow] 单落结算面板未等待确认就自行推进');
  }

  /* 进入下一关 */
  await page.click('#nextBtn');
  await page.waitForTimeout(500);
  const secondLevel = await page.textContent('#levelName');

  /* 失败路径：清空脉冲让蛋直接摔碎 → 摔碎面板 → 重试本关 */
  await page.evaluate(() => { window.__eggState.pulses = 0; });
  await waitForDropPanel(page, errors, '摔碎');
  const failPanel = await page.evaluate(() => ({
    visible: !document.querySelector('#dropPanel').hidden,
    grade: document.querySelector('#dropGrade').textContent,
    retryLabel: document.querySelector('#retryBtn').textContent
  }));
  if (failPanel.grade !== '摔碎了') {
    errors.push('[flow] 清空脉冲后应显示摔碎了，实际 ' + failPanel.grade);
  }
  await page.screenshot({ path: path.join(OUT, 'flow-level-fail.png') });

  await page.click('#retryBtn');
  await page.waitForTimeout(500);
  const afterRetry = await page.evaluate(() => ({
    levelIndex: window.__eggState.levelIndex,
    pulses: window.__eggState.pulses,
    levelPulses: window.__eggState.level.pulses,
    phase: window.__eggState.phase,
    panelHidden: document.querySelector('#dropPanel').hidden
  }));
  if (afterRetry.levelIndex !== 1 || afterRetry.pulses !== afterRetry.levelPulses) {
    errors.push('[flow] 重试本关应停留在第 2 关且脉冲重置：' + JSON.stringify(afterRetry));
  }

  /* 完美贴地：轻轻放到地面上，应触发完好连击与光环
   * （原版重力 g=260：height−20 处 vy=20 → 触地速度 ≈104 ≤ 0.4×300=120） */
  await page.evaluate(() => {
    const s = window.__eggState;
    window.EggGame.loadLevel(s, 0);
    s.time = 1;
    s.phase = 'falling';
    s.streak = 2;
    s.egg.x = 0;
    s.egg.y = s.level.height - 20;
    s.egg.vy = 20;
    s.egg.vx = 0;
  });
  await page.waitForTimeout(1200);
  await waitForDropPanel(page, errors, '完美贴地');
  const perfectState = await page.evaluate(() => ({
    grade: document.querySelector('#dropGrade').textContent,
    streak: window.__eggState.streak,
    hudStreak: document.querySelector('#streak').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-perfect.png') });
  if (perfectState.grade !== '完美着陆') {
    errors.push('[flow] 轻放应得完美着陆，实际 ' + perfectState.grade);
  }
  if (perfectState.streak !== 3 || perfectState.hudStreak !== '3') {
    errors.push('[flow] 完好连击没有接上：' + JSON.stringify(perfectState));
  }
  await page.click('#nextBtn');
  await page.waitForTimeout(400);

  /* 快进到末关，轻放进入空投报告
   * （原版重力 g=435、风=-110：height−20 处 vy=20 → 触地速度 ≈141 < 限速 195，
   *   有裂纹但幸存；留足帧离散化余量） */
  await page.evaluate(() => {
    const s = window.__eggState;
    window.EggGame.loadLevel(s, window.CONTENT.levels.length - 1);
    s.time = 1;
    s.phase = 'falling';
    s.streak = 4;
    s.run = { survived: 9, bestSpeed: 200, pulsesLeftOver: 10 };
    s.egg.x = 0; /* 第 12 关缺口正中 */
    s.egg.y = s.level.height - 20;
    s.egg.vy = 20;
    s.egg.vx = 0;
  });
  await page.waitForTimeout(1400);
  await waitForDropPanel(page, errors, '末关');
  const lastDrop = await page.evaluate(() => ({
    grade: document.querySelector('#dropGrade').textContent,
    nextLabel: document.querySelector('#nextBtn').textContent
  }));
  if (lastDrop.nextLabel !== '查看报告') {
    errors.push('[flow] 末关结算按钮应为「查看报告」，实际 ' + lastDrop.nextLabel);
  }
  await page.click('#nextBtn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      survived: document.querySelector('#resultSurvived').textContent,
      bestSpeed: document.querySelector('#resultBestSpeed').textContent,
      pulses: document.querySelector('#resultPulses').textContent,
      cardSize: card ? [card.width, card.height] : null
    };
  });
  if (!resultPanel.visible) errors.push('[flow] 空投报告面板未出现');
  if (resultPanel.survived !== '10 / 12') {
    errors.push('[flow] 幸存落数应为 10 / 12，实际 ' + resultPanel.survived);
  }
  const bestSpeedCheck = await page.evaluate(() => ({
    expected: String(Math.round(window.__eggState.run.bestSpeed)),
    shown: document.querySelector('#resultBestSpeed').textContent
  }));
  if (bestSpeedCheck.shown !== bestSpeedCheck.expected) {
    errors.push('[flow] 最佳落速显示不一致：应为 ' + bestSpeedCheck.expected + '，实际 ' + bestSpeedCheck.shown);
  }
  if (Number(bestSpeedCheck.expected) >= 200) {
    errors.push('[flow] 最佳落速应被末关着陆刷新（< 200），实际 ' + bestSpeedCheck.expected);
  }

  /* 保存按钮在无宿主 API 时应优雅降级 */
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });

  const report = {
    hudInfo,
    clicks,
    dropPanel,
    beforeNext,
    secondLevel,
    failPanel,
    afterRetry,
    perfectState,
    lastDrop,
    resultPanel,
    saveStatus,
    errors
  };
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
