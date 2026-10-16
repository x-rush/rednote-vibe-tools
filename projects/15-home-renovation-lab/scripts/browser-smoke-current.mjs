import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4311/';
const cases = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 390, height: 844, forced: true },
];

async function checkSurface(page, label) {
  const result = await page.evaluate(() => {
    const corners = [
      { left: 0, right: 82, top: 28, bottom: 113 },
      { left: innerWidth - 82, right: innerWidth, top: 28, bottom: 113 },
    ];
    const overlaps = [];
    for (const button of document.querySelectorAll('button')) {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') continue;
      if (corners.some(zone => rect.left < zone.right && rect.right > zone.left && rect.top < zone.bottom && rect.bottom > zone.top)) {
        overlaps.push(button.dataset.action || button.textContent.trim());
      }
    }
    const badge = document.querySelector('.campaign-badge');
    const badgeRect = badge?.getBoundingClientRect();
    const badgeOverlap = badgeRect && getComputedStyle(badge).display !== 'none' && corners.some(zone => badgeRect.left < zone.right && badgeRect.right > zone.left && badgeRect.top < zone.bottom && badgeRect.bottom > zone.top);
    const modal = document.querySelector('#modal');
    const rect = modal?.open ? modal.getBoundingClientRect() : null;
    return {
      overlaps,
      badgeOverlap,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      modalOutside: rect ? rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight : false,
    };
  });
  assert.deepEqual(result.overlaps, [], `${label}: host-button overlap`);
  assert.equal(result.badgeOverlap, false, `${label}: campaign badge overlaps a host-button zone`);
  assert.ok(result.horizontalOverflow <= 1, `${label}: horizontal overflow ${result.horizontalOverflow}px`);
  assert.equal(result.modalOutside, false, `${label}: modal outside viewport`);
}

async function action(page, name) {
  await page.locator(`[data-action="${name}"]:visible`).first().click();
}

try {
  for (const entry of cases) {
    const context = await browser.newContext({ viewport: entry, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    if (!entry.forced && entry.width === 390) await checkSurface(page, '390x844 zero-inset home');
    await page.addStyleTag({ content: ':root{--safe-area-inset-top:28px;--safe-area-inset-bottom:16px}' });
    if (entry.forced) await page.getByRole('button', { name: '横屏' }).click();
    const label = `${entry.width}x${entry.height}${entry.forced ? ' forced' : ''}`;
    await checkSurface(page, `${label} home`);

    const furnitureCards = await page.locator('.furniture-card:not(.opening-card)').count();
    const openingCards = await page.locator('.opening-card').count();
    assert.equal(furnitureCards, 56, `${label}: furniture catalog`);
    assert.equal(openingCards, 5, `${label}: door and four window types`);

    await action(page, 'mobile-menu');
    await checkSurface(page, `${label} menu`);
    await page.locator('#modal [data-action="inventory"]').click();
    await checkSurface(page, `${label} inventory`);
    assert.ok((await page.locator('#modal .inventory-table tbody tr').count()) > 0, `${label}: inventory rows`);
    await page.locator('#modal [data-action="close-modal"]').click();

    if (!entry.forced && entry.width === 390) {
      await page.locator('#mobile-dock [data-action="tab-layouts"]').click();
      await checkSurface(page, `${label} layout drawer`);
      await action(page, 'blank');
      await action(page, 'add-room-shortcut');
      await checkSurface(page, `${label} adjacent-room dialog`);
      await page.locator('#modal [data-action="add-room-side"][data-id="east"]').click();
      assert.match(await page.locator('#stats').innerText(), /2 个空间/, `${label}: adjacent room added`);
      await action(page, 'finish-layout');
      await page.locator('#mobile-dock [data-action="tab-materials"]').click();
      assert.ok((await page.locator('.material-card').count()) > 0, `${label}: material catalog`);
      await page.locator('#mobile-dock [data-action="tab-furniture"]').click();
    }

    await action(page, 'finish');
    await checkSurface(page, `${label} finish`);
    if (!entry.forced && entry.width === 390) {
      await action(page, 'finish-tools');
      await page.locator('#modal [data-action="capture"]').click();
      await page.locator('#modal .export-preview').waitFor({ state: 'visible' });
      await checkSurface(page, `${label} export preview`);
      assert.equal(await page.locator('#modal .export-preview').count(), 1, `${label}: export preview`);
      await page.locator('#modal [data-action="close-modal"]').click();
    }
    await action(page, 'inside');
    await checkSurface(page, `${label} walkthrough`);
    await action(page, 'walk-rooms');
    await checkSurface(page, `${label} room selector`);
    await page.locator('#modal [data-action="close-modal"]').click();
    await action(page, 'exit-walk');
    assert.deepEqual(errors, [], `${label}: page errors`);
    console.log(`PASS ${label}: catalog, menu, inventory, finish, walkthrough, host zones`);
    await context.close();
  }
} finally {
  await browser.close();
}
