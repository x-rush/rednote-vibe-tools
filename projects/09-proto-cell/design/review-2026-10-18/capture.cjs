const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
 const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4109/');
 await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','44px'));
 await page.screenshot({path:'design/review-2026-10-18/390-first-home.png'});
 console.log('HOME',await page.locator('body').innerText());
 await page.getByRole('button').first().click();
 await page.waitForTimeout(1800);
 await page.screenshot({path:'design/review-2026-10-18/390-first-game.png'});
 console.log('GAME',await page.locator('body').innerText());
 console.log('ERRORS',errors);
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
