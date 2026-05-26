const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[ERR] ${msg.text()}`);
  });

  console.log('Navigating...');
  await page.goto('http://localhost:4242/token-vision', { timeout: 20000 });

  // Wait for prompt to appear (boot finished)
  console.log('Waiting for prompt...');
  await page.waitForFunction(() => {
    return document.querySelector('.term-prompt-line') !== null ||
           document.body.innerText.includes('./token-vision');
  }, { timeout: 30000 });
  
  console.log('Prompt ready!');
  await new Promise(r => setTimeout(r, 2000));

  // Type 'ranking' at the prompt
  const input = await page.locator('.term-input');
  const inputExists = await input.count();
  console.log('Input found:', inputExists);
  
  if (inputExists > 0) {
    await input.fill('ranking');
    await new Promise(r => setTimeout(r, 300));
    await input.press('Enter');
    console.log('Typed "ranking" and pressed Enter');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Take screenshot of the ranking view
  await page.screenshot({ 
    path: '/Users/openclaw_002/token-vision/ranking-page.png', 
    fullPage: true 
  });
  console.log('Screenshot saved!');

  await browser.close();
})();
