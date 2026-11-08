/*
 * 毽子连击 · 全流程自检
 * 覆盖：真实点击踢毽子 → 通关第一关 → 结算面板不得自行推进 → 下一关 →
 *       落地失败面板 → 重试 → 最终纪录卡 → 保存兜底提示。
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

/* 等到毽子进入接球窗口再点，模拟真实玩家的操作 */
async function kickOnce(page, box) {
  for (let i = 0; i < 500; i++) {
    const info = await page.evaluate(() => {
      const s = window.__jianziState;
      const G = window.JianziGame;
      return {
        phase: s.phase,
        ready: s.phase === 'ready',
        inWindow: G.isCatchWindow(s),
        combo: s.combo,
        caught: s.caught
      };
    });
    if (info.ready || info.inWindow) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.82);
      await page.waitForTimeout(90);
      return info;
    }
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
  await page.waitForTimeout(500);

  const box = await page.locator('#field').boundingBox();

  /* 真实操作：一直踢到第一关目标达成 */
  let kicks = 0;
  let caught = 0;
  for (; kicks < 40; kicks++) {
    const snap = await page.evaluate(() => {
      const s = window.__jianziState;
      return { caught: s.caught, target: s.level.target, done: s.phase === 'levelClear' };
    });
    caught = snap.caught;
    if (snap.done || caught >= snap.target) break;
    const r = await kickOnce(page, box);
    if (!r) {
      errors.push('[flow] 未能进入接球窗口，第 ' + kicks + ' 脚卡住');
      break;
    }
  }
  await page.waitForTimeout(900);

  /* 等结算面板真正出现 */
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#levelPanel');
      return !!el && !el.hidden;
    }, null, { timeout: 8000 })
    .catch(() => errors.push('[flow] 关卡结算面板未出现'));
  await page.waitForTimeout(300);
  const levelPanel = await page.evaluate(() => {
    const el = document.querySelector('#levelPanel');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#levelTitle').textContent,
      button: document.querySelector('#nextBtn').textContent
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });

  /*
   * 关键断言：结算面板弹出后若玩家不点「继续踢」，关卡不得自行推进。
   */
  await page.waitForTimeout(3000);
  const levelBeforeNext = await page.evaluate(() => ({
    levelName: document.querySelector('#levelName').textContent,
    levelIndex: window.__jianziState.levelIndex,
    panelVisible: !document.querySelector('#levelPanel').hidden
  }));
  if (levelBeforeNext.levelIndex !== 0 || !levelBeforeNext.panelVisible) {
    errors.push('[flow] 结算面板未等待确认就自行推进到下一关');
  }

  /* 进入下一关 */
  await page.click('#nextBtn');
  await page.waitForTimeout(600);
  const secondLevel = await page.textContent('#levelName');

  /* 失败路径：把机会压到 1 次并让毽子直接落地 */
  await page.evaluate(() => {
    const s = window.__jianziState;
    s.lives = 1;
    s.bird.y = window.JianziGame.GROUND_Y - 2;
    s.bird.vy = 900;
    s.phase = 'flying';
  });
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#levelPanel');
      return !!el && !el.hidden;
    }, null, { timeout: 6000 })
    .catch(() => errors.push('[flow] 落地失败面板未出现'));
  await page.waitForTimeout(300);
  const failPanel = await page.evaluate(() => ({
    visible: !document.querySelector('#levelPanel').hidden,
    title: document.querySelector('#levelTitle').textContent,
    button: document.querySelector('#nextBtn').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-level-fail.png') });

  /* 重试同一关 */
  await page.click('#nextBtn');
  await page.waitForTimeout(600);
  const afterRetry = await page.evaluate(() => ({
    levelIndex: window.__jianziState.levelIndex,
    lives: window.__jianziState.lives,
    panelHidden: document.querySelector('#levelPanel').hidden
  }));

  /* 快进到最后一关并通关，验证最终纪录卡 */
  await page.evaluate(() => {
    const s = window.__jianziState;
    s.levelIndex = window.CONTENT.levels.length - 1;
    s.level = window.CONTENT.levels[s.levelIndex];
    s.caught = s.level.target - 1;
    s.combo = 21;
    s.bestCombo = 21;
    s.score = 2345;
    s.lives = 3;
    s.phase = 'flying';
    /* 把毽子放到接球线正下方、正在下落，保证下一脚就是有效踢 */
    s.bird.y = window.JianziGame.catchLineY(s) + 6;
    s.bird.vy = 40;
  });
  await page.waitForTimeout(400);
  const finalKick = await kickOnce(page, box);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      combo: document.querySelector('#resultCombo').textContent,
      score: document.querySelector('#resultScore').textContent,
      best: document.querySelector('#resultBest').textContent,
      cardSize: card ? [card.width, card.height] : null
    };
  });

  /* 保存按钮在无宿主 API 时应优雅降级 */
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });

  const report = {
    kicksUsed: kicks,
    caught: caught,
    levelPanel: levelPanel,
    levelBeforeNext: levelBeforeNext,
    secondLevel: secondLevel,
    failPanel: failPanel,
    afterRetry: afterRetry,
    finalKick: finalKick,
    resultPanel: resultPanel,
    saveStatus: saveStatus,
    errors: errors
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
