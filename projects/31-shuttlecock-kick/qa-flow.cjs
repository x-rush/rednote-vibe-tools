/*
 * 毽子连击 · 全流程自检（五期玩法重建）
 * 覆盖：真实点击踢毽子（等毽子落进甜区带再点）→ 毽子落地 → 结算面板不得自行推进 →
 *       再踢一场 → 踢法解锁（踢法 n/12 变化）→ 庭院解锁（庭院名与配色切换）→
 *       保存兜底提示。
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
                : target.endsWith('.json')
                  ? 'application/json'
                  : 'text/html'
        );
        res.writeHead(200);
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* 等到毽子下落进入甜区带再点，模拟真实玩家的操作 */
async function kickOnce(page, box) {
  for (let i = 0; i < 1200; i++) {
    const info = await page.evaluate(() => {
      const s = window.__jianziState;
      const G = window.JianziGame;
      const hit = s ? G.resolveKick(s) : null;
      return {
        phase: s ? s.phase : 'idle',
        kickable: !!hit,
        kickName: hit ? hit.kick.name : '',
        rally: s ? s.rally : 0
      };
    });
    if (info.kickable) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(90);
      return info;
    }
    if (info.phase !== 'playing') return null;
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

  /* 真实操作：连续踢 5 脚，验证甜区带判定与连踢累计 */
  let kicks = 0;
  let rally = 0;
  let lastKickName = '';
  for (; kicks < 5; kicks++) {
    const r = await kickOnce(page, box);
    if (!r) break;
    rally = r.rally;
    lastKickName = r.kickName;
  }
  await page.waitForTimeout(300);
  const hudMidRun = await page.evaluate(() => ({
    rally: document.querySelector('#rally').textContent,
    kickCount: document.querySelector('#kickCount').textContent,
    yard: document.querySelector('#yardName').textContent,
    stateRally: window.__jianziState.rally
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-play.png') });

  /* 让毽子自然落地（不再点击），等结算面板 */
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#result');
      return !!el && !el.hidden;
    }, null, { timeout: 30000 })
    .catch(() => errors.push('[flow] 结算面板未出现'));
  await page.waitForTimeout(300);
  const resultPanel = await page.evaluate(() => {
    const el = document.querySelector('#result');
    return {
      visible: el && !el.hidden,
      title: document.querySelector('#resultTitle').textContent,
      rally: document.querySelector('#resultRally').textContent,
      detail: document.querySelector('#resultDetail').textContent
    };
  });
  await page.screenshot({ path: path.join(OUT, 'flow-result.png') });

  /*
   * 关键断言：结算面板弹出后若玩家不点「再踢一场」，本局不得自行重开。
   */
  await page.waitForTimeout(3000);
  const stillOver = await page.evaluate(() => ({
    panelVisible: !document.querySelector('#result').hidden,
    phase: window.__jianziState ? window.__jianziState.phase : 'idle'
  }));
  if (!stillOver.panelVisible || stillOver.phase === 'playing') {
    errors.push('[flow] 结算面板未等待确认就自行重开');
  }

  /* 再踢一场 */
  await page.click('#againBtn');
  await page.waitForTimeout(600);

  /* 踢法解锁路径：把 rally 设到 2，下一脚解锁外脚背 */
  await page.evaluate(() => {
    const s = window.__jianziState;
    s.rally = 2;
  });
  const unlockKick = await kickOnce(page, box);
  await page.waitForTimeout(300);
  const kickAfterUnlock = await page.evaluate(() => ({
    kickCount: document.querySelector('#kickCount').textContent,
    unlocked: window.__jianziState.unlockedCount
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-kick-unlock.png') });

  /* 庭院解锁路径：原版第 2 庭院门槛是 rally 12（8*t+4），把 rally 设到 11，下一脚解锁晨步 */
  await page.evaluate(() => {
    const s = window.__jianziState;
    s.rally = 11;
  });
  const unlockYard = await kickOnce(page, box);
  await page.waitForTimeout(300);
  const yardAfterUnlock = await page.evaluate(() => ({
    yard: document.querySelector('#yardName').textContent,
    index: window.__jianziState.courtyardIndex,
    rally: window.__jianziState.rally
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-yard-unlock.png') });

  /* 收尾：直接把毽子放到地面附近让它落地，验证保存兜底 */
  await page.evaluate(() => {
    const s = window.__jianziState;
    s.shuttle.y = window.JianziGame.GROUND_Y(s) - 30;
    s.shuttle.vy = 120;
  });
  await page
    .waitForFunction(() => {
      const el = document.querySelector('#result');
      return !!el && !el.hidden;
    }, null, { timeout: 8000 })
    .catch(() => errors.push('[flow] 落地后结算面板未出现'));
  await page.waitForTimeout(400);
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const saveStatus = await page.textContent('#saveStatus');
  await page.screenshot({ path: path.join(OUT, 'flow-save.png') });

  const report = {
    kicksUsed: kicks,
    rallyAfterAutoPlay: rally,
    lastKickName,
    hudMidRun,
    resultPanel,
    stillOver,
    unlockKick: unlockKick,
    kickAfterUnlock,
    unlockYard: unlockYard,
    yardAfterUnlock,
    saveStatus,
    errors: errors
  };
  fs.writeFileSync(path.join(OUT, 'flow-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  /* 断言汇总 */
  if (hudMidRun.stateRally < 1) errors.push('[flow] 自动踢未拿到有效连踢');
  if (!hudMidRun.yard || hudMidRun.yard === '') errors.push('[flow] HUD 庭院名为空');
  if (kickAfterUnlock.unlocked !== 2) errors.push('[flow] 踢法解锁未生效：' + kickAfterUnlock.unlocked);
  if (yardAfterUnlock.index !== 1 || String(yardAfterUnlock.yard).indexOf('晨步') < 0) {
    errors.push('[flow] 庭院解锁未生效：' + yardAfterUnlock.yard);
  }
  if (resultPanel.rally !== String(hudMidRun.stateRally)) {
    errors.push('[flow] 结算连踢数与 HUD 不一致：' + resultPanel.rally + ' vs ' + hudMidRun.stateRally);
  }

  await context.close();
  await browser.close();
  server.close();
  if (errors.length) {
    console.error('流程自检失败：' + errors.join(' | '));
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
