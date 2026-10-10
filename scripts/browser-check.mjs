import puppeteer from 'puppeteer-core';

const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 20000 });
await new Promise(r => setTimeout(r, 2500));

// Start from a clean slate so prior stale state can't skew the run
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
await new Promise(r => setTimeout(r, 2500));

let text = await page.$eval('body', el => el.innerText);
const step = (name, pass, extra = '') =>
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

step('app renders (no blue screen)', text.includes('MedVault') && text.includes('Patients'));
step('storage nodes online', text.includes('online'));
step('no page errors on load', errors.length === 0, errors[0] || '');

// Add a record end-to-end
await page.type('input[placeholder*="Record title"]', 'Browser smoke record');
await page.type('textarea[placeholder*="Record data"]', 'Verified via puppeteer');
await page.click('button[type=submit]');
try {
  await page.waitForFunction(
    () => document.body.innerText.includes('Browser smoke record'),
    { timeout: 15000 }
  );
  step('record added & visible', true);
} catch {
  step('record added & visible', false, 'record never appeared');
}

// Verify integrity → expect OK
// Synthetic DOM click — trusted CDP mouse clicks proved flaky on this button in headless
const clickBtn = async label => {
  await page.evaluate(l => {
    [...document.querySelectorAll('button')].find(b => b.textContent.includes(l))?.click();
  }, label);
  await new Promise(r => setTimeout(r, 500));
};

await clickBtn('Verify Integrity');
await new Promise(r => setTimeout(r, 1800));
text = await page.$eval('body', el => el.innerText);
step('verify OK when data is clean',
  text.includes('valid on all online nodes'));

// Tamper demo → verify → expect detection (verify click waits for mining)
await clickBtn('Tamper Demo');
await clickBtn('Verify Integrity');
await new Promise(r => setTimeout(r, 2500)); // mining takes a moment
text = await page.$eval('body', el => el.innerText);
step('tamper detected after demo',
  text.includes('differs across decentralized nodes') || text.includes('hash mismatch'),
  (text.match(/Block \d+[^\n]*/g) || []).join(' | ') || 'no integrity problems shown');

// Reset demo so the user starts clean
await clickBtn('Reset Demo');
await new Promise(r => setTimeout(r, 1200));

step('no page errors during full flow', errors.length === 0, errors[0] || '');

await browser.close();
