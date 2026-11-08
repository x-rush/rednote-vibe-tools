/*
 * 珍珠消消乐 · 全流程自检
 * 覆盖：真实点击通关 → 关卡结算面板 → 下一关 → 最终成绩卡 → 保存兜底提示。
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
          target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html'
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
  await page.click('#startBtn');
  await page.waitForTimeout(500);

  /* 真实点击：每次选当前最大的那一组，直到通关第一关 */
  const boardBox = await page.locator('#board').boundingBox();
  let taps = 0;
  let cleared = 0;
  for (; taps < 12; taps++) {
    const pick = await page.evaluate(() => {
      const s = window.__bobaState;
      const G = window.BobaGame;
      const r = window.__bobaRenderer;
      let best = null;
      for (let i = 0; i < s.board.cells.length; i++) {
        const g = G.findGroup(s.board, i);
        if (g.length < 3) continue;
        if (!best || g.length > best.size) {
          best = { size: g.length, index: i, row: Math.floor(i / s.board.cols), col: i % s.board.cols };
        }
      }
      if (!best) return null;
      return {
        x: r.cellCenter(best.col),
        y: r.cellCenterY(best.row),
        cleared: s.cleared,
        target: s.level.target,
        score: s.score,
        tapsLeft: s.tapsLeft
      };
    });
    if (!pick) break;
    cleared = pick.cleared;
    if (pick.cleared >= pick.target) break;
    await page.mouse.click(boardBox.x + pick.x, boardBox.y + pick.y);
    await page.waitForTimeout(1100);
  }

  /* 等结算面板真正出现（消除动画播完才弹） */
  await page.waitForFunction(() => {
    const el = document.querySelector('#levelPanel');
    return !!el && !el.hidden;
  }, null, { timeout: 8000 }).catch(() => errors.push('[flow] 关卡结算面板未出现'));
  await page.waitForTimeout(400);
  const levelPanel = await page.evaluate(() => {
    const el = document.querySelector('#levelPanel');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#levelTitle') ? document.querySelector('#levelTitle').textContent : '',
      button: document.querySelector('#nextBtn') ? document.querySelector('#nextBtn').textContent : ''
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });

  /*
   * 关键断言：结算面板弹出后若玩家不点「再来一杯」，关卡不得自行推进。
   * 面板出现后静置 3 秒，若关卡名仍停在第一杯，说明没有自动跳关。
   */
  await page.waitForTimeout(3000);
  const levelBeforeNext = await page.evaluate(() => ({
    levelName: document.querySelector('#levelName').textContent,
    levelIndex: window.__bobaState.levelIndex,
    panelVisible: !document.querySelector('#levelPanel').hidden
  }));
  if (levelBeforeNext.levelIndex !== 0 || !levelBeforeNext.panelVisible) {
    errors.push('[flow] 结算面板未等待确认就自行推进到下一关');
  }

  /* 进入下一关 */
  await page.click('#nextBtn');
  await page.waitForTimeout(600);
  const secondLevel = await page.textContent('#levelName');

  /* 快进到最后一关：验证最终结算面板与成绩卡 */
  await page.evaluate(() => {
    const s = window.__bobaState;
    s.levelIndex = 7;
    s.level = Object.assign({}, s.level, { name: '第八杯 · 珍珠盛筵', target: 1, taps: 99 });
    s.cleared = 0;
    s.bestChain = 5;
    s.score = 1234;
  });
  await page.waitForTimeout(200);
  const pick2 = await page.evaluate(() => {
    const s = window.__bobaState;
    const G = window.BobaGame;
    const r = window.__bobaRenderer;
    for (let i = 0; i < s.board.cells.length; i++) {
      const g = G.findGroup(s.board, i);
      if (g.length >= 3) {
        return { x: r.cellCenter(i % s.board.cols), y: r.cellCenterY(Math.floor(i / s.board.cols)) };
      }
    }
    return null;
  });
  if (pick2) {
    await page.mouse.click(boardBox.x + pick2.x, boardBox.y + pick2.y);
    await page.waitForTimeout(1400);
  }
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle') ? document.querySelector('#resultTitle').textContent : '',
      chain: document.querySelector('#resultChain') ? document.querySelector('#resultChain').textContent : '',
      score: document.querySelector('#resultScore') ? document.querySelector('#resultScore').textContent : '',
      cardSize: card ? [card.width, card.height] : null
    };
  });

  /* 保存按钮在无宿主 API 时应优雅降级 */
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });

  const report = {
    tapsUsed: taps,
    cleared: cleared,
    levelPanel: levelPanel,
    levelBeforeNext: levelBeforeNext,
    secondLevel: secondLevel,
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
