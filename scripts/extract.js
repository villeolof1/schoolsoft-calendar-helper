import { loadConfig } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';
import { navigateToCalendar, clickLikelyCalendarView, clickCalendarDirection, applyLikelyAssessmentFilters, waitForEnter } from './shared/schoolsoft-navigation.js';
import { dedupeEvents } from './shared/parse.js';
import { mergeEvents, saveSnapshot } from './shared/storage.js';
import { startNetworkCapture } from './shared/network-capture.js';

const config = loadConfig();
const requestedMonth = process.env.SCHOOLSOFT_TARGET_MONTH || '';
const explicitMonthList = parseExplicitMonthList(process.env.SCHOOLSOFT_MONTH_LIST || '');
const scanWindow = resolveScanWindow(config, requestedMonth, explicitMonthList);

const { context, page } = await openPersistentBrowser(config);
const networkCapture = startNetworkCapture(page, config);

try {
  console.log('Using proven SchoolSoft network/API capture only.');
  if (requestedMonth) console.log(`Requested coverage month: ${requestedMonth}`);

  await navigateToCalendar(page, config);
  await page.waitForTimeout(2200);
  if (await isProbablyLoginPage(page)) {
    if (process.env.SCHOOLSOFT_BACKGROUND_SYNC) {
      throw new Error('SchoolSoft login is needed. Run npm run login, log in, then click Synka nu.');
    }
    console.log('\nSchoolSoft login is needed. Log in in the opened browser window.');
    console.log('Take your time — this browser window will stay open until you press Enter here.');
    console.log('After the SchoolSoft calendar/start page has loaded, return here and press Enter.\n');
    await waitForEnter();
    await navigateToCalendar(page, config);
    await page.waitForTimeout(2200);
  }

  await clickLikelyCalendarView(page).catch(() => false);
  await applyLikelyAssessmentFilters(page, config).catch(() => 0);

  const loadedMonths = await scanCalendarNetworkWindow(page, config, scanWindow, networkCapture);

  // Give late API calls a chance to finish before the final parse.
  await page.waitForTimeout(1800);
  let collected = networkCapture.extractEvents();
  collected = dedupeEvents(collected);

  console.log(`Network/API responses: ${collected.length} candidate event(s)`);

  const merged = mergeEvents(collected, { requestedMonth, loadedMonths, partial: false });
  if (collected.length === 0) {
    const diagPath = networkCapture.saveDiagnostics('network-diagnostics-no-events-final');
    console.log(`No events found in captured API responses. Saved diagnostics here: ${diagPath}`);
    console.log(`Local data still contains ${merged.length} known event(s).`);
    process.exitCode = merged.length ? 0 : 1;
  } else {
    console.log(`Done. Wrote ${merged.length} known event(s) to data/events.json.`);
    console.log('Start or refresh the dashboard with: npm run start');
  }
} catch (error) {
  console.error('\nExtraction failed:', error.message);
  console.error('Run npm run login if the SchoolSoft session has expired, then try again.');
  process.exitCode = 1;
} finally {
  await context.close().catch(() => {});
}

async function waitForLoggedIn(page, config, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1500);
    if (!(await isProbablyLoginPage(page))) return true;
  }
  return false;
}

function resolveScanWindow(config, requestedMonth, explicitMonthList = []) {
  const lookBackMonths = Number(config.lookBackMonths ?? 5);
  const lookAheadMonths = Number(config.lookAheadMonths ?? 5);
  const now = new Date();
  const centerMonth = /^20\d{2}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { centerMonth, lookBackMonths, lookAheadMonths, explicitMonthList };
}

function parseExplicitMonthList(value) {
  return [...new Set(String(value || '').split(',').map(s => s.trim()).filter(m => /^20\d{2}-\d{2}$/.test(m)))];
}

async function scanCalendarNetworkWindow(page, config, { centerMonth, lookBackMonths, lookAheadMonths, explicitMonthList = [] }, networkCapture) {
  const months = explicitMonthList.length
    ? explicitMonthList.map((month, i) => ({ month, label: i === 0 ? 'center' : `month-${i}` }))
    : buildMonthSequence(centerMonth, lookBackMonths, lookAheadMonths);
  const loadedMonths = [];
  console.log(explicitMonthList.length
    ? `Calendar network scan: selected months ${explicitMonthList.join(', ')}.`
    : `Calendar network scan: ${centerMonth} first, then ${lookAheadMonths} month(s) forward and ${lookBackMonths} month(s) back in the background.`);

  for (const entry of months) {
    const ok = await navigateCalendarToMonth(page, entry.month, config).catch(() => false);
    if (!ok) console.log(`  could not confirm navigation to ${entry.month}; scanning current visible month anyway`);
    await page.waitForTimeout(1000);
    await applyLikelyAssessmentFilters(page, config).catch(() => 0);
    await page.waitForTimeout(1000);
    const title = await visibleCalendarTitle(page);
    console.log(`  loaded ${entry.label} ${entry.month}${title ? ` (${title})` : ''}`);
    loadedMonths.push(entry.month);

    // Incremental save: the frontend can show this month as soon as it appears while
    // the rest of the +/- window continues loading in the background.
    const partial = dedupeEvents(networkCapture.extractEvents());
    mergeEvents(partial, { requestedMonth: centerMonth, loadedMonths: [...loadedMonths], partial: true });
  }

  saveSnapshot('calendar-network-final-page', await page.content());
  return loadedMonths;
}

function buildMonthSequence(centerMonth, back, ahead) {
  const center = parseMonthKey(centerMonth) || new Date();
  const entries = [{ month: monthKey(center), label: 'center' }];
  const max = Math.max(back, ahead);
  for (let i = 1; i <= max; i++) {
    if (i <= ahead) entries.push({ month: monthKey(addMonths(center, i)), label: `plus-${i}` });
    if (i <= back) entries.push({ month: monthKey(addMonths(center, -i)), label: `minus-${i}` });
  }
  return entries;
}

async function navigateCalendarToMonth(page, targetMonth, config) {
  await navigateToCalendar(page, config).catch(() => {});
  await clickLikelyCalendarView(page).catch(() => false);
  await applyLikelyAssessmentFilters(page, config).catch(() => 0);
  await page.waitForTimeout(900);

  for (let i = 0; i < 18; i++) {
    const visible = await visibleMonthKey(page);
    if (visible === targetMonth) return true;
    const direction = chooseDirection(visible, targetMonth);
    if (!direction) return false;
    const ok = await clickCalendarDirection(page, direction).catch(() => false);
    if (!ok) return false;
    await page.waitForTimeout(900);
  }
  return false;
}

function chooseDirection(visible, target) {
  if (!/^20\d{2}-\d{2}$/.test(target)) return '';
  if (!/^20\d{2}-\d{2}$/.test(visible)) {
    const now = new Date();
    visible = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return monthNumber(target) >= monthNumber(visible) ? 'next' : 'previous';
}

function monthNumber(key) {
  const [y, m] = String(key).split('-').map(Number);
  return y * 12 + m;
}

function parseMonthKey(key) {
  if (!/^20\d{2}-\d{2}$/.test(String(key))) return null;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setMonth(d.getMonth() + n);
  return d;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function visibleMonthKey(page) {
  const title = await visibleCalendarTitle(page);
  return parseVisibleMonthTitle(title);
}

async function visibleCalendarTitle(page) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const oneLine = bodyText.replace(/\s+/g, ' ');
  const months = 'januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|january|february|march|april|may|june|july|august|september|october|november|december';
  const match = oneLine.match(new RegExp(`\\b(${months})\\s+20\\d{2}\\b|\\b20\\d{2}\\s+(${months})\\b`, 'i'));
  return match ? match[0] : '';
}

function parseVisibleMonthTitle(title) {
  const text = String(title || '').toLowerCase();
  const monthMap = new Map(Object.entries({
    januari: 1, january: 1,
    februari: 2, february: 2,
    mars: 3, march: 3,
    april: 4,
    maj: 5, may: 5,
    juni: 6, june: 6,
    juli: 7, july: 7,
    augusti: 8, august: 8,
    september: 9,
    oktober: 10, october: 10,
    november: 11,
    december: 12
  }));
  const year = text.match(/20\d{2}/)?.[0];
  if (!year) return '';
  for (const [name, month] of monthMap) {
    if (text.includes(name)) return `${year}-${String(month).padStart(2, '0')}`;
  }
  return '';
}

async function isProbablyLoginPage(page) {
  const url = page.url().toLowerCase();
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return url.includes('login') || /logga in|login|bankid|lösenord|losenord|användarnamn|anvandarnamn|username|password/.test(body.slice(0, 2000));
}
