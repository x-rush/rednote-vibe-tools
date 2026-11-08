/*
 * 蛋落地 · 全流程自检
 * 覆盖：真实点击喷气通关第一关 → 结算面板不得自行推进 → 下一关 →
 *       蛋碎失败面板 → 重试 → 最终纪录卡 → 保存兜底提示。
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

/*
 * 玩家策略：像真人一样闭环操作 —— 每隔约 150ms 看一次速度指示，
 * 下坠速度超过安全线的 88% 就点一下喷气，等速度回落后再继续观察。
 * 这与 qa-balance-check.cjs 里的闭环玩家模型是同一族打法。
 */
async function playLevel(page, box, maxSteps) {
  let thrusts = 0;
  for (let i = 0; i < maxSteps; i++) {
    const snap = await page.evaluate(() => {
      const s = window.__eggState;
      return {
        phase: s.phase,
        vy: s.egg.vy,
        safe: s.level.safe,
        gas: s.gas,
        lives: s.lives,
        levelIndex: s.levelIndex
      };
    });
    if (snap.phase !== 'falling') break;
    if (snap.gas > 0 && snap.vy >= snap.safe * 0.88) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
      thrusts++;
      await page.waitForTimeout(110);
    } else {
      await page.waitForTimeout(80);
    }
  }
  return thrusts;
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

  /* 真实操作：按策略喷气，直到第一关结束 */
  const thrusts = await playLevel(page, box, 900);
  await page.waitForTimeout(1200);

  await page
    .waitForFunction(() => {
      const el = document.querySelector('#levelPanel');
      return !!el && !el.hidden;
    }, null, { timeout: 8000 })
    .catch(() => errors.push('[flow] 关卡结算面板未出现'));
  await page.waitForTimeout(300);
  const levelPanel = await page.evaluate(() => ({
    visible: !document.querySelector('#levelPanel').hidden,
    title: document.querySelector('#levelTitle').textContent,
    button: document.querySelector('#nextBtn').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });

  /* 关键断言：结算面板不自行推进 */
  await page.waitForTimeout(3000);
  const levelBeforeNext = await page.evaluate(() => ({
    levelName: document.querySelector('#levelName').textContent,
    levelIndex: window.__eggState.levelIndex,
    panelVisible: !document.querySelector('#levelPanel').hidden
  }));
  if (levelBeforeNext.levelIndex !== 0 || !levelBeforeNext.panelVisible) {
    errors.push('[flow] 结算面板未等待确认就自行推进到下一关');
  }

  /* 进入下一关 */
  await page.click('#nextBtn');
  await page.waitForTimeout(500);
  const secondLevel = await page.textContent('#levelName');

  /* 失败路径：耗尽气量让蛋直接摔碎，三次机会用完后应出现失败面板 */
  await page.evaluate(() => {
    const s = window.__eggState;
    s.gas = 0;
    s.lives = 1;
  });
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#levelPanel');
      return !!el && !el.hidden;
    }, null, { timeout: 8000 })
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
  await page.waitForTimeout(500);
  const afterRetry = await page.evaluate(() => ({
    levelIndex: window.__eggState.levelIndex,
    lives: window.__eggState.lives,
    gas: window.__eggState.gas,
    panelHidden: document.querySelector('#levelPanel').hidden
  }));

  /* 快进到最后一关，让蛋轻轻落上去 */
  await page.evaluate(() => {
    const s = window.__eggState;
    /* 必须走 loadLevel：它会同步叶垫基准位置，否则蛋会落在垫子之外 */
    window.EggGame.loadLevel(s, window.CONTENT.levels.length - 1);
    s.score = 2345;
    s.softLandings = 11;
    s.phase = 'falling';
    s.egg.x = s.padX;
    s.egg.y = s.level.padY - 14;
    s.egg.vy = 8;
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      soft: document.querySelector('#resultSoft').textContent,
      score: document.querySelector('#resultScore').textContent,
      cardSize: card ? [card.width, card.height] : null
    };
  });

  /* 保存按钮在无宿主 API 时应优雅降级 */
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });

  const report = {
    thrusts,
    levelPanel,
    levelBeforeNext,
    secondLevel,
    failPanel,
    afterRetry,
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
