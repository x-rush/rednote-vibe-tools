/*
 * 彩沙瓶 · 全流程自检
 * 覆盖：真实点击倒沙 → 换色 → 塑形拖拽 → 挖沙 → 封口 → 关卡面板不得自行推进 →
 *       下一瓶 → 走完全部八瓶 → 结算面板 → 收藏架 → 720×960 纪录卡 → 保存兜底提示。
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

/* 某列在画布上的 CSS 横坐标（相对画布左边缘） */
function colXScript(col) {
  const geom = window.__sandRenderer.getGeom();
  const scale = window.__sandRenderer.getScale();
  return (geom.cx - geom.inner + (col + 0.5) * geom.cellW) * scale;
}

/* 找出当前最矮的一列（真人倒沙的直觉落点） */
function lowestColScript() {
  const state = window.__sandState;
  let minCol = 0;
  let minH = Infinity;
  for (let c = 0; c < state.cols.length; c++) {
    if (state.cols[c].length < minH) {
      minH = state.cols[c].length;
      minCol = c;
    }
  }
  return minCol;
}

/*
 * 理想玩家：按色带从下往上铺（一直倒最矮的一列），每铺完一层用塑形棒抹平，
 * 堆山后把每列修到目标高度。与 qa-balance-check.cjs 是同一套打法。
 * 跑在页面里，用的是当前真实状态对象。
 */
function autoFillScript() {
  const game = window.SandGame;
  const state = window.__sandState;
  const meta = state.meta;
  const target = game.buildTarget(state.level, meta);

  const heights = [];
  for (let c = 0; c < meta.cols; c++) {
    let h = 0;
    for (let r = 0; r < target.grid.length; r++) {
      if (target.grid[r][c] >= 0) h++;
    }
    heights.push(h);
  }

  function levelSurface() {
    let guard = 0;
    while (guard++ < 6000) {
      let maxC = 0;
      let minC = 0;
      for (let c = 1; c < state.cols.length; c++) {
        if (state.cols[c].length > state.cols[maxC].length) maxC = c;
        if (state.cols[c].length < state.cols[minC].length) minC = c;
      }
      if (state.cols[maxC].length - state.cols[minC].length <= 1) break;
      if (!game.shape(state, maxC, minC)) break;
    }
  }

  function shapeToTarget() {
    let guard = 0;
    while (guard++ < 20000) {
      let need = -1;
      let needDiff = 0;
      for (let c = 0; c < state.cols.length; c++) {
        const d = heights[c] - state.cols[c].length;
        if (d > needDiff) {
          needDiff = d;
          need = c;
        }
      }
      if (need < 0) break;
      let donor = -1;
      let bestDist = Infinity;
      for (let c = 0; c < state.cols.length; c++) {
        if (state.cols[c].length > heights[c] && state.cols[c].length > 0) {
          const dist = Math.abs(c - need);
          if (dist < bestDist) {
            bestDist = dist;
            donor = c;
          }
        }
      }
      if (donor < 0) break;
      if (!game.shape(state, donor, need)) break;
    }
  }

  let baseRows = 0;
  const bands = state.level.bands || [];
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    state.palette = band.color;
    const bandTop = baseRows + band.height;
    let guard = 0;
    while (guard++ < 4000) {
      let minCol = 0;
      let minH = Infinity;
      for (let c = 0; c < state.cols.length; c++) {
        const h = state.cols[c].length;
        if (h < minH) {
          minH = h;
          minCol = c;
        }
      }
      if (minH >= bandTop) break;
      const res = game.pour(state, minCol);
      if (!res || res.type !== 'pour') break;
    }
    levelSurface();
    baseRows = bandTop;
  }

  if (state.level.peak) {
    const p = state.level.peak;
    const center = Math.round(p.center * (meta.cols - 1));
    state.palette = p.color;
    const peakCells = target.cells - baseRows * meta.cols;
    let guard = 0;
    while (state.used < baseRows * meta.cols + peakCells && guard++ < 4000) {
      const res = game.pour(state, center);
      if (!res || res.type !== 'pour') break;
    }
  }

  shapeToTarget();
  const result = game.evaluate(state);
  return {
    passed: result.passed,
    ratio: Math.round(result.ratio * 100),
    coverage: Math.round(result.coverage * 100),
    used: state.used,
    budget: state.budget
  };
}

/* 找一对「有沙且邻居还有空间」的相邻列，用来验证塑形拖拽 */
function shapePairScript() {
  const state = window.__sandState;
  const maxHeight = state.meta.maxHeight;
  const cols = state.cols.length;
  for (let c = 0; c < cols; c++) {
    if (state.cols[c].length <= 0) continue;
    const targets = c + 1 < cols ? [c + 1] : [];
    if (c - 1 >= 0) targets.push(c - 1);
    for (let t = 0; t < targets.length; t++) {
      const to = targets[t];
      if (state.cols[to].length < maxHeight) return { from: c, to: to };
    }
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

  const report = {};

  /* ---------- 开场 ---------- */
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const afterStart = await page.evaluate(() => ({
    hudVisible: !document.querySelector('#hud').hidden,
    paletteVisible: !document.querySelector('#palette').hidden,
    toolsVisible: !document.querySelector('#tools').hidden,
    introHidden: document.querySelector('#intro').hidden,
    levelIndex: window.__sandState.levelIndex,
    tool: window.__sandState.tool,
    palette: window.__sandState.palette
  }));
  if (!afterStart.hudVisible || !afterStart.paletteVisible || !afterStart.toolsVisible) {
    errors.push('[flow] 开始后 HUD / 调色板 / 工具栏没有出现');
  }
  if (!afterStart.introHidden) errors.push('[flow] 开场面板没有收起');

  /* ---------- 静音开关（曾经因为 muted 未声明直接抛错） ---------- */
  /* 放在结算浮层出现之前：结算浮层是全屏模态层，会盖住底栏的静音按钮 */
  await page.click('#muteBtn');
  await page.waitForTimeout(200);
  const muteState = await page.evaluate(() => ({
    label: document.querySelector('#muteBtn').textContent,
    pressed: document.querySelector('#muteBtn').getAttribute('aria-pressed'),
    audioMuted: window.SandAudio.isMuted()
  }));
  if (muteState.audioMuted !== true) errors.push('[flow] 静音按钮没有真正关闭音效');
  await page.click('#muteBtn');
  await page.waitForTimeout(200);
  const muteBack = await page.evaluate(() => window.SandAudio.isMuted());
  if (muteBack !== false) errors.push('[flow] 再次点击静音按钮没有恢复声音');
  report.mute = { after: muteState, back: muteBack };

  const box = await page.locator('#field').boundingBox();

  /* ---------- 真实点击倒沙 ---------- */
  const beforePour = await page.evaluate(() => ({
    used: window.__sandState.used,
    cells: window.__sandState.cols.reduce((s, c) => s + c.length, 0)
  }));
  for (let i = 0; i < 12; i++) {
    const col = await page.evaluate(lowestColScript);
    const x = await page.evaluate(colXScript, col);
    await page.mouse.click(box.x + x, box.y + box.height * 0.55);
  }
  const afterPour = await page.evaluate(() => ({
    used: window.__sandState.used,
    cells: window.__sandState.cols.reduce((s, c) => s + c.length, 0),
    heights: window.__sandState.cols.map((c) => c.length)
  }));
  if (afterPour.used !== beforePour.used + 12) {
    errors.push('[flow] 真实点击倒沙没有增加用量，used ' + beforePour.used + ' → ' + afterPour.used);
  }
  if (afterPour.cells !== beforePour.cells + 12) {
    errors.push('[flow] 真实点击倒沙没有把沙放进瓶子，cells ' + beforePour.cells + ' → ' + afterPour.cells);
  }
  report.afterPour = { before: beforePour, after: afterPour };

  /* ---------- 真实点击换色 ---------- */
  await page.click('.swatch[data-color="2"]');
  const paletteAfter = await page.evaluate(() => window.__sandState.palette);
  if (paletteAfter !== 2) errors.push('[flow] 点击色块没有切换沙的颜色');

  /* ---------- 真实拖拽塑形 ---------- */
  await page.click('.tool[data-tool="shape"]');
  const pair = await page.evaluate(shapePairScript);
  if (!pair) {
    errors.push('[flow] 找不到可用于塑形验证的相邻列');
  } else {
    const xFrom = await page.evaluate(colXScript, pair.from);
    const xTo = await page.evaluate(colXScript, pair.to);
    const beforeShape = await page.evaluate(() => window.__sandState.cols.map((c) => c.length));
    await page.mouse.move(box.x + xFrom, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + xTo, box.y + box.height * 0.55);
    const midShape = await page.evaluate(() => window.__sandState.cols.map((c) => c.length));
    await page.mouse.move(box.x + xFrom, box.y + box.height * 0.55);
    await page.mouse.up();
    const afterShape = await page.evaluate(() => window.__sandState.cols.map((c) => c.length));
    const moved =
      midShape[pair.from] === beforeShape[pair.from] - 1 &&
      midShape[pair.to] === beforeShape[pair.to] + 1;
    const restored =
      afterShape[pair.from] === beforeShape[pair.from] &&
      afterShape[pair.to] === beforeShape[pair.to];
    report.shape = { pair: pair, before: beforeShape, mid: midShape, after: afterShape, moved: moved, restored: restored };
    if (!moved) errors.push('[flow] 塑形拖拽没有搬运沙粒');
    if (!restored) errors.push('[flow] 塑形拖拽搬回去之后沙面没有恢复原状');
  }

  /* ---------- 真实点击挖沙 ---------- */
  await page.click('.tool[data-tool="scoop"]');
  const scoopBefore = await page.evaluate(() => ({
    used: window.__sandState.used,
    cells: window.__sandState.cols.reduce((s, c) => s + c.length, 0)
  }));
  const scoopCol = await page.evaluate(() => {
    const state = window.__sandState;
    for (let c = 0; c < state.cols.length; c++) {
      if (state.cols[c].length > 0) return c;
    }
    return -1;
  });
  if (scoopCol >= 0) {
    const x = await page.evaluate(colXScript, scoopCol);
    await page.mouse.click(box.x + x, box.y + box.height * 0.55);
  }
  const scoopAfter = await page.evaluate(() => ({
    used: window.__sandState.used,
    cells: window.__sandState.cols.reduce((s, c) => s + c.length, 0)
  }));
  if (scoopAfter.cells >= scoopBefore.cells) {
    errors.push('[flow] 挖沙没有取走沙粒');
  }
  if (scoopAfter.used >= scoopBefore.used) {
    errors.push('[flow] 挖沙没有退还沙量额度');
  }
  report.scoop = { before: scoopBefore, after: scoopAfter };

  /* ---------- 第一关：全程真实点击堆完 ---------- */
  await page.click('.tool[data-tool="pour"]');
  await page.click('.swatch[data-color="0"]');
  let guard = 0;
  while (guard++ < 600) {
    const snap = await page.evaluate(() => {
      const state = window.__sandState;
      const result = window.SandGame.evaluate(state);
      return { passed: result.passed, used: state.used, budget: state.budget };
    });
    if (snap.passed) break;
    if (snap.used >= snap.budget) break;
    const col = await page.evaluate(lowestColScript);
    const x = await page.evaluate(colXScript, col);
    await page.mouse.click(box.x + x, box.y + box.height * 0.55);
  }
  const levelOne = await page.evaluate(() => ({
    passed: window.SandGame.evaluate(window.__sandState).passed,
    sealDisabled: document.querySelector('#sealBtn').disabled,
    used: window.__sandState.used,
    budget: window.__sandState.budget
  }));
  report.levelOne = levelOne;
  if (!levelOne.passed) errors.push('[flow] 第一关真实点击堆不满目标图案');
  if (levelOne.sealDisabled) errors.push('[flow] 吻合度达标后「封口收藏」仍然禁用');

  /* ---------- 封口 ---------- */
  await page.click('#sealBtn');
  await page.waitForTimeout(400);
  const levelPanel = await page.evaluate(() => ({
    visible: !document.querySelector('#levelPanel').hidden,
    title: document.querySelector('#levelTitle').textContent,
    button: document.querySelector('#nextBtn').textContent,
    bottles: window.__sandState.bottles.length,
    levelIndex: window.__sandState.levelIndex
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-level-clear.png') });
  if (!levelPanel.visible) errors.push('[flow] 封口后关卡结算面板没有出现');
  if (levelPanel.bottles !== 1) errors.push('[flow] 封口后没有进收藏架');

  /* 关键断言：结算面板不自行推进 */
  await page.waitForTimeout(3000);
  const levelBeforeNext = await page.evaluate(() => ({
    levelIndex: window.__sandState.levelIndex,
    panelVisible: !document.querySelector('#levelPanel').hidden
  }));
  if (levelBeforeNext.levelIndex !== 0 || !levelBeforeNext.panelVisible) {
    errors.push('[flow] 结算面板未等待确认就自行推进到下一关');
  }
  report.levelPanel = levelPanel;
  report.levelBeforeNext = levelBeforeNext;

  /* ---------- 走完剩余七瓶 ---------- */
  const levelRuns = [];
  for (let i = 1; i < 8; i++) {
    await page.click('#nextBtn');
    await page.waitForTimeout(250);
    const fill = await page.evaluate(autoFillScript);
    if (!fill.passed) {
      errors.push('[flow] 第 ' + (i + 1) + ' 关理想玩家堆不满（吻合 ' + fill.ratio + '%）');
      break;
    }
    /* 用一次「搬出去再搬回来」的塑形拖拽触发 HUD 刷新（状态不变） */
    await page.click('.tool[data-tool="shape"]');
    const pair2 = await page.evaluate(shapePairScript);
    if (pair2) {
      const xFrom = await page.evaluate(colXScript, pair2.from);
      const xTo = await page.evaluate(colXScript, pair2.to);
      await page.mouse.move(box.x + xFrom, box.y + box.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + xTo, box.y + box.height * 0.55);
      await page.mouse.move(box.x + xFrom, box.y + box.height * 0.55);
      await page.mouse.up();
    }
    await page.click('.tool[data-tool="pour"]');
    const sealEnabled = await page.evaluate(() => !document.querySelector('#sealBtn').disabled);
    if (!sealEnabled) {
      errors.push('[flow] 第 ' + (i + 1) + ' 关堆好后「封口收藏」仍然禁用');
      break;
    }
    await page.click('#sealBtn');
    await page.waitForTimeout(250);
    const sealed = await page.evaluate(() => window.__sandState.bottles.length);
    levelRuns.push({ level: i + 1, fill: fill, sealed: sealed });
    if (sealed !== i + 1) {
      errors.push('[flow] 第 ' + (i + 1) + ' 关封口后收藏架数量不对：' + sealed);
      break;
    }
  }
  report.levelRuns = levelRuns;

  /* ---------- 结算面板 ---------- */
  await page.click('#nextBtn');
  await page.waitForTimeout(500);
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    const card = document.querySelector('#shareCard');
    const shelf = document.querySelector('#shelf');
    const cardPixels = (() => {
      const data = card.getContext('2d').getImageData(0, 0, card.width, card.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    })();
    const shelfPixels = (() => {
      const data = shelf.getContext('2d').getImageData(0, 0, shelf.width, shelf.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    })();
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      score: document.querySelector('#resultScore').textContent,
      bottles: document.querySelector('#resultBottles').textContent,
      best: document.querySelector('#resultBest').textContent,
      newBest: !document.querySelector('#bestFlag').hidden,
      cardSize: card ? [card.width, card.height] : null,
      cardPixels: cardPixels,
      shelfPixels: shelfPixels
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-final.png') });
  if (!resultPanel.visible) errors.push('[flow] 全部通关后结算面板没有出现');
  if (resultPanel.bottles !== '8') errors.push('[flow] 结算面板封口数不是 8：' + resultPanel.bottles);
  if (!resultPanel.cardSize || resultPanel.cardSize[0] !== 720 || resultPanel.cardSize[1] !== 960) {
    errors.push('[flow] 纪录卡不是 720×960：' + JSON.stringify(resultPanel.cardSize));
  }
  if (!resultPanel.cardPixels) errors.push('[flow] 纪录卡画布是空的');
  if (!resultPanel.shelfPixels) errors.push('[flow] 收藏架画布是空的');
  report.resultPanel = resultPanel;

  /* ---------- 保存兜底 ---------- */
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });
  if (!saveStatus || !saveStatus.trim()) errors.push('[flow] 保存按钮没有给出任何兜底提示');
  report.saveStatus = saveStatus;

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
