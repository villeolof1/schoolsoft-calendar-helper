import { loadConfig } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';

const config = loadConfig();
const { context, page } = await openPersistentBrowser({ ...config, headless: false });
console.log(`Opening ${config.loginUrl || config.baseUrl}`);
await page.goto(config.loginUrl || config.baseUrl, { waitUntil: 'domcontentloaded' });
console.log('Log in to SchoolSoft in the browser window. This helper closes automatically after login or after 15 minutes.');

const deadline = Date.now() + 15 * 60_000;
let loggedIn = false;
while (Date.now() < deadline) {
  await page.waitForTimeout(1500);
  if (!(await isProbablyLoginPage(page))) {
    loggedIn = true;
    break;
  }
}
if (loggedIn) {
  console.log('Login detected. Session saved locally in .playwright-user-data.');
  await page.waitForTimeout(1800);
} else {
  console.log('Login helper timed out. You can click Logga in again.');
}
await context.close();

async function isProbablyLoginPage(page) {
  const url = page.url().toLowerCase();
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return url.includes('login') || /logga in|login|bankid|lösenord|losenord|användarnamn|anvandarnamn|username|password/.test(body.slice(0, 2000));
}
