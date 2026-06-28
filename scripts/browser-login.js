import { loadConfig } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';

const config = loadConfig();
const { context, page } = await openPersistentBrowser({ ...config, headless: false });
console.log(`Opening ${config.loginUrl || config.baseUrl}`);
await page.goto(config.loginUrl || config.baseUrl, { waitUntil: 'domcontentloaded' });
console.log('Log in to SchoolSoft in the browser window. Close the window yourself when SchoolSoft has finished loading.');

const deadline = Date.now() + 30 * 60_000;
let messageShown = false;

while (Date.now() < deadline && !page.isClosed()) {
  await page.waitForTimeout(1500);
  if (!messageShown && !(await isProbablyLoginPage(page))) {
    messageShown = true;
    console.log('SchoolSoft no longer looks like the first login page. The window will stay open so the login flow can finish.');
  }
}

if (page.isClosed()) console.log('Login window closed by user.');
else console.log('Login helper safety timeout reached. Closing the helper window.');

await context.close().catch(() => {});

async function isProbablyLoginPage(page) {
  const url = page.url().toLowerCase();
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return url.includes('login') || /logga in|login|bankid|användarnamn|anvandarnamn|username|password/.test(body.slice(0, 2000));
}
