import { loadConfig } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';
import { waitForEnter } from './shared/schoolsoft-navigation.js';

const config = loadConfig();
const { context, page } = await openPersistentBrowser(config);
console.log(`Opening ${config.loginUrl || config.baseUrl}`);
await page.goto(config.loginUrl || config.baseUrl, { waitUntil: 'domcontentloaded' });
console.log('\nLog in to SchoolSoft in the browser window.');
console.log('When the normal SchoolSoft start page is visible, return here and press Enter.');
await waitForEnter();
console.log('Login session saved locally in .playwright-user-data.');
await context.close();
