import { loadConfig } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';

const config = loadConfig();
const { context, page } = await openPersistentBrowser({ ...config, headless: false });
console.log(`Opening ${config.loginUrl || config.baseUrl}`);
await page.goto(config.loginUrl || config.baseUrl, { waitUntil: 'domcontentloaded' });
console.log('Log in to SchoolSoft in the browser window. The helper will not close the window just because login seems to have started.');
console.log('If external login opens another page or tab, use that page. Close the browser window yourself when SchoolSoft is fully loaded.');

const deadline = Date.now() + 30 * 60_000;
let messageShown = false;

while (Date.now() < deadline) {
  await sleep(1500);
  const openPages = context.pages().filter(p => !p.isClosed());
  if (!openPages.length) break;

  if (!messageShown) {
    const stillOnLogin = await anyPageLooksLikeLogin(openPages);
    if (!stillOnLogin) {
      messageShown = true;
      console.log('SchoolSoft no longer looks like the first login page. Keeping the browser open so the full login flow can finish.');
    }
  }
}

if (context.pages().some(p => !p.isClosed())) console.log('Login helper safety timeout reached. Closing the helper browser.');
else console.log('Login browser closed by user.');

await context.close().catch(() => {});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function anyPageLooksLikeLogin(pages) {
  for (const candidate of pages) {
    if (!candidate.isClosed() && await isProbablyLoginPage(candidate)) return true;
  }
  return false;
}

async function isProbablyLoginPage(page) {
  const url = page.url().toLowerCase();
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return url.includes('login') || /logga in|login|bankid|användarnamn|anvandarnamn|username|password/.test(body.slice(0, 2000));
}
