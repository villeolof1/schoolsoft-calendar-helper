import { chromium } from 'playwright';
import { ensureDirs, resolveProjectPath } from './config.js';

export async function openPersistentBrowser(config) {
  ensureDirs();
  const userDataDir = resolveProjectPath('.playwright-user-data');
  const forcedHeadless = process.env.SCHOOLSOFT_HEADLESS;
  const backgroundDefault = config.backgroundHeadless ?? false;
  const headless = forcedHeadless != null
    ? /^(1|true|yes)$/i.test(forcedHeadless)
    : (process.env.SCHOOLSOFT_BACKGROUND_SYNC ? backgroundDefault : config.headless);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    slowMo: config.slowMoMs,
    viewport: { width: 1440, height: 950 },
    locale: 'sv-SE',
    timezoneId: config.timezone || 'Europe/Stockholm',
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  return { context, page };
}

export async function maybeNeedsLogin(page) {
  const text = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  const url = page.url().toLowerCase();
  return url.includes('login') || /logga in|login|bankid|användarnamn|lösenord/.test(text);
}
