/*
 * 彩沙瓶 · 全流程自检（三期：原版玩法复刻版）
 * 覆盖：封面教程行 → 选瓶页五张卡片 → 每种瓶型点击画布 55% 高度倒沙 →
 *       拖动倒沙 + 倾斜 + 松手 tilt 归零 → 推杆塑峰 → 换色 →
 *       「举向光亮」→ 结果页 → 重玩回选瓶 → 收藏图鉴 → EN/中文切换 →
 *       全程无撤销（不可撤销张力）→ 静音开关。
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

/* 页内辅助：读引擎状态 */
const HOOKS = {
  grainCount: () => window.__sandEngine ? window.__sandEngine.grains.length : -1,
  particleCount: () => window.__sandEngine ? window.__sandEngine.particles.length : -1,
  grainSnapshot: () => {
    const e = window.__sandEngine;
    return e ? e.grains.map((g) => [Math.round(g.x * 10) / 10, Math.round(g.y * 10) / 10]) : [];
  }
};

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
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tools', 'autoplay.cjs'), 'utf8') });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
  });

  const report = {};

  /* ---------- 封面：教程行 + 开始倒沙 ---------- */
  await page.waitForTimeout(500);
  const cover = await page.evaluate(() => ({
    visible: !document.querySelector('#intro').hidden,
    tutorial: document.querySelector('#startLines').textContent,
    button: document.querySelector('#startBtn').textContent,
    hint: document.querySelector('#startTip').textContent
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-cover.png') });
  if (!cover.visible) errors.push('[flow] 封面没有出现');
  if (cover.tutorial !== '拖动倾倒并倾斜瓶身。一切都无法撤销。') {
    errors.push('[flow] 教程行与原版不一致：' + cover.tutorial);
  }
  if (cover.button !== '开始倒沙') errors.push('[flow] 开始按钮文案与原版不一致');
  report.cover = cover;

  /* ---------- 选瓶页：五张卡片 ---------- */
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const pick = await page.evaluate(() => ({
    visible: !document.querySelector('#shapeSelect').hidden,
    title: document.querySelector('#shapeTitle').textContent,
    hint: document.querySelector('#shapeTip').textContent,
    cards: [].slice.call(document.querySelectorAll('.shape-card')).map((el) => el.getAttribute('data-shape'))
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-shape-select.png') });
  if (!pick.visible) errors.push('[flow] 选瓶页没有出现');
  const wantShapes = ['round', 'cylinder', 'flask', 'teardrop', 'wide'];
  if (JSON.stringify(pick.cards) !== JSON.stringify(wantShapes)) {
    errors.push('[flow] 选瓶页应有五种瓶型（原版顺序），实际 ' + pick.cards.join(','));
  }
  if (pick.title !== '选择瓶形' || pick.hint !== '瓶颈会限制你后期的操作。') {
    errors.push('[flow] 选瓶页文案与原版不一致');
  }
  report.pick = pick;

  /* ---------- craft 界面元素 ---------- */
  await page.click('.shape-card[data-shape="round"]');
  await page.waitForTimeout(600);
  const craftUi = await page.evaluate(() => ({
    hud: !document.querySelector('#hud').hidden,
    palette: !document.querySelector('#palette').hidden,
    tools: !document.querySelector('#tools').hidden,
    swatches: document.querySelectorAll('.swatch').length,
    toolsList: [].slice.call(document.querySelectorAll('.tool')).map((el) => el.getAttribute('data-tool')),
    fill: document.querySelector('#fillValue').textContent,
    pours: document.querySelector('#poursValue').textContent,
    hint: document.querySelector('#craftHint').textContent,
    seal: document.querySelector('#sealBtn').textContent,
    sealDisabled: document.querySelector('#sealBtn').disabled,
    demoGrains: window.__sandEngine ? window.__sandEngine.grains.length : -1
  }));
  if (!craftUi.hud || !craftUi.palette || !craftUi.tools) {
    errors.push('[flow] craft 界面的 HUD / 色条 / 工具没有出现');
  }
  if (craftUi.swatches !== 12) errors.push('[flow] 色条应有 12 色，实际 ' + craftUi.swatches);
  if (JSON.stringify(craftUi.toolsList) !== JSON.stringify(['pour', 'rod'])) {
    errors.push('[flow] 工具应只有 pour 和 rod 两个，实际 ' + craftUi.toolsList.join(','));
  }
  if (craftUi.demoGrains !== 420) errors.push('[flow] 开场演示灌注应为 420 粒，实际 ' + craftUi.demoGrains);
  if (craftUi.hint !== '在玻璃瓶内拖动即可倒沙。无法撤销。') {
    errors.push('[flow] 倒沙提示与原版不一致：' + craftUi.hint);
  }
  if (craftUi.seal !== '举向光亮' || craftUi.sealDisabled) {
    errors.push('[flow] 「举向光亮」按钮文案不对或被禁用（原版始终可用）');
  }
  report.craftUi = craftUi;

  const box = await page.locator('#field').boundingBox();

  /* ---------- 点击画布 55% 高度倒沙（兼容断言保持） ---------- */
  const beforeClick = await page.evaluate(HOOKS.grainCount);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55);
  await page.waitForTimeout(150);
  const afterClick = await page.evaluate(HOOKS.grainCount);
  const clickGain = afterClick - beforeClick;
  if (clickGain !== 18) {
    errors.push('[flow] 画布 55% 高度单击应倒 18 粒（原版按下 pours 18），实际 ' + clickGain);
  }
  const poursChip = await page.evaluate(() => document.querySelector('#poursValue').textContent);
  if (poursChip !== '1') errors.push('[flow] 倒沙次数 chip 应为 1，实际 ' + poursChip);
  report.clickPour = { beforeClick, afterClick, gain: clickGain };

  /* ---------- 拖动倒沙 + 倾斜 + 松手归零 ---------- */
  const beforeDrag = await page.evaluate(HOOKS.grainCount);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 12 });
  const tiltDuring = await page.evaluate(() => window.__sandEngine.tilt);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterDrag = await page.evaluate(HOOKS.grainCount);
  const tiltAfter = await page.evaluate(() => window.__sandEngine.tilt);
  if (tiltDuring === 0) errors.push('[flow] 拖动过程中 tilt 应非零');
  if (tiltAfter !== 0) errors.push('[flow] 松手后 tilt 必须归零（原版行为）');
  if (afterDrag <= beforeDrag) errors.push('[flow] 拖动没有倒进沙');
  report.dragPour = { gained: afterDrag - beforeDrag, tiltDuring, tiltAfter };

  /* ---------- 推杆：拖动把堆面沙推开 ---------- */
  await page.click('.tool[data-tool="rod"]');
  await page.waitForTimeout(150);
  const rodHint = await page.evaluate(() => document.querySelector('#craftHint').textContent);
  if (rodHint !== '拖动推杆把沙子推向玻璃壁形成尖峰。') {
    errors.push('[flow] 推杆提示与原版不一致：' + rodHint);
  }
  const beforeRod = await page.evaluate(HOOKS.grainSnapshot);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.36, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.64, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterRod = await page.evaluate(HOOKS.grainSnapshot);
  let movedGrains = 0;
  for (let i = 0; i < Math.min(beforeRod.length, afterRod.length); i++) {
    if (beforeRod[i][0] !== afterRod[i][0] || beforeRod[i][1] !== afterRod[i][1]) movedGrains++;
  }
  if (movedGrains < 5) {
    errors.push('[flow] 推杆拖动应推动堆面沙粒，实际只动了 ' + movedGrains + ' 粒');
  }
  report.rod = { movedGrains };

  /* ---------- 换色 ---------- */
  await page.click('.swatch[data-color="9"]');
  const colorNow = await page.evaluate(() => {
    /* 点击色块后下一批倒的沙应带新颜色：直接查引擎上一次 pour 的颜色由 app 决定，
       这里用 UI 状态断言：选中态落在 9 号色块上 */
    const on = document.querySelector('.swatch.on');
    return on ? Number(on.getAttribute('data-color')) : -1;
  });
  if (colorNow !== 9) errors.push('[flow] 点击色块没有切换选中色');

  /* ---------- 静音开关（craft 阶段，底栏不被面板遮挡） ---------- */
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const muted = await page.evaluate(() => window.SandAudio.isMuted());
  if (muted !== true) errors.push('[flow] 静音按钮没有真正关闭音效');
  await page.click('#muteBtn');
  await page.waitForTimeout(150);
  const unmuted = await page.evaluate(() => window.SandAudio.isMuted());
  if (unmuted !== false) errors.push('[flow] 再次点击静音按钮没有恢复声音');
  report.mute = { muted, unmuted };

  /* ---------- 举向光亮 → 结果页 ---------- */
  await page.click('#sealBtn');
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    visible: !document.querySelector('#result').hidden,
    title: document.querySelector('#resultTitle').textContent,
    hint: document.querySelector('#resultHint').textContent,
    replay: document.querySelector('#replayBtn').textContent,
    craftUiHidden: document.querySelector('#tools').hidden
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-result.png') });
  if (!result.visible) errors.push('[flow] 结果页没有出现');
  if (result.title !== '你的沙瓶') errors.push('[flow] 结果页标题与原版不一致');
  if (result.hint.indexOf('层层堆叠，无法重做。') !== 0) {
    errors.push('[flow] 结果页提示与原版不一致：' + result.hint);
  }
  if (result.replay !== '再做一瓶') errors.push('[flow] 重玩按钮文案与原版不一致');
  if (!result.craftUiHidden) errors.push('[flow] 进入结果页后工具栏没有收起');
  /* 结果页背光摆动：tilt 在动 */
  const tilt1 = await page.evaluate(() => window.__sandEngine.tilt);
  await page.waitForTimeout(300);
  const tilt2 = await page.evaluate(() => window.__sandEngine.tilt);
  if (tilt1 === tilt2) errors.push('[flow] 结果页瓶子没有摆动（原版 tilt=.08*sin(3t)）');
  report.result = result;

  /* ---------- 图鉴：刚封的瓶进了收藏 ---------- */
  await page.click('#resultAlbumBtn');
  await page.waitForTimeout(300);
  const album = await page.evaluate(() => ({
    visible: !document.querySelector('#album').hidden,
    items: document.querySelectorAll('.album-item').length,
    firstName: (document.querySelector('.album-name') || {}).textContent || ''
  }));
  await page.screenshot({ path: path.join(OUT, 'flow-album.png') });
  if (!album.visible) errors.push('[flow] 图鉴没有打开');
  if (album.items < 1) errors.push('[flow] 封瓶后图鉴里没有瓶子');
  if (album.firstName !== '圆肩瓶') errors.push('[flow] 图鉴条目瓶型名不对：' + album.firstName);
  await page.click('#albumClose');
  report.album = album;

  /* ---------- 重玩：回到选瓶页，引擎重置 ---------- */
  await page.click('#replayBtn');
  await page.waitForTimeout(300);
  const replay = await page.evaluate(() => ({
    pickVisible: !document.querySelector('#shapeSelect').hidden,
    resultHidden: document.querySelector('#result').hidden,
    engineNull: window.__sandEngine === null
  }));
  if (!replay.pickVisible || !replay.resultHidden || !replay.engineNull) {
    errors.push('[flow] 重玩没有回到选瓶页并重置引擎');
  }
  report.replay = replay;

  /* ---------- 五种瓶型逐一点击画布 55% 高度倒沙 ---------- */
  const shapeClicks = [];
  for (const shapeId of ['round', 'cylinder', 'flask', 'teardrop', 'wide']) {
    await page.reload({ waitUntil: 'load' });
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tools', 'autoplay.cjs'), 'utf8') });
    await page.click('#startBtn');
    await page.waitForTimeout(250);
    await page.click('.shape-card[data-shape="' + shapeId + '"]');
    await page.waitForTimeout(500);
    const boxS = await page.locator('#field').boundingBox();
    const before = await page.evaluate(HOOKS.grainCount);
    await page.mouse.click(boxS.x + boxS.width / 2, boxS.y + boxS.height * 0.55);
    await page.waitForTimeout(150);
    const after = await page.evaluate(HOOKS.grainCount);
    const ok = after === before + 18;
    shapeClicks.push({ shape: shapeId, gain: after - before, ok });
    if (!ok) {
      errors.push('[flow] ' + shapeId + ' 瓶型下画布 55% 高度点击没有倒进 18 粒');
    }
  }
  report.shapeClicks = shapeClicks;

  /* ---------- 全程无撤销 ---------- */
  const noUndo = await page.evaluate(() => {
    const buttons = [].slice.call(document.querySelectorAll('button'));
    const undoButton = buttons.some((b) => /撤销|undo|重做|redo/i.test(b.textContent) && b.id !== 'craftHint');
    return {
      undoButton,
      engineUndo: window.__sandEngine ? typeof window.__sandEngine.undo : 'no-engine'
    };
  });
  if (noUndo.undoButton) errors.push('[flow] 出现了撤销/重做按钮（原版全程不可撤销）');
  if (noUndo.engineUndo !== 'undefined' && noUndo.engineUndo !== 'no-engine') {
    errors.push('[flow] 引擎不应有 undo 接口');
  }
  report.noUndo = noUndo;

  /* ---------- EN/中文切换 ---------- */
  await page.click('#langBtn');
  await page.waitForTimeout(200);
  const enState = await page.evaluate(() => ({
    seal: document.querySelector('#sealBtn').textContent,
    toolPour: document.querySelector('#toolPour').textContent,
    lang: document.querySelector('#langBtn').textContent
  }));
  if (enState.lang !== '中文') errors.push('[flow] EN 模式下语言按钮应显示「中文」');
  if (enState.seal !== 'Hold to the Light') {
    errors.push('[flow] EN 模式下举向光亮按钮应为原文：' + enState.seal);
  }
  if (enState.toolPour !== 'Pour') errors.push('[flow] EN 模式下倒沙工具应为 Pour');
  await page.click('#langBtn');
  await page.waitForTimeout(200);
  report.lang = { enState };

  fs.writeFileSync(path.join(OUT, 'flow-report.json'), JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.close();
  if (errors.length) {
    console.error('FLOW FAIL:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('FLOW PASS：封面 → 五瓶型 → 拖动倒沙/倾斜/推杆 → 举向光亮 → 结果页 → 重玩 → 图鉴 → 双语 → 无撤销 全部通过');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
