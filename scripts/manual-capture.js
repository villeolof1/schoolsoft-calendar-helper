import { loadConfig, saveConfigPatch } from './shared/config.js';
import { openPersistentBrowser } from './shared/browser.js';
import { waitForManualLoginIfNeeded, waitForEnter, applyLikelyAssessmentFilters } from './shared/schoolsoft-navigation.js';
import { scrapeCurrentPage, describeCurrentPage } from './shared/scrape.js';
import { mergeEvents, readEvents, saveSnapshot } from './shared/storage.js';
import { startNetworkCapture } from './shared/network-capture.js';

let config = loadConfig();
const { context, page } = await openPersistentBrowser(config);
const networkCapture = startNetworkCapture(page, config);
await waitForManualLoginIfNeeded(page, config);

console.log('\nManual capture mode.');
console.log('Navigate in the browser to the SchoolSoft calendar page, apply filters/month/week so tests are visible, then return here and press Enter.');
console.log('Repeat as many pages/months as needed. Press Ctrl+C when done.\n');

let allEvents = readEvents().filter(e => e.status !== 'removed');
while (true) {
  await waitForEnter();
  await applyLikelyAssessmentFilters(page, config).catch(() => 0);
  await page.waitForTimeout(1800);
  const url = page.url();
  const source = url.toLowerCase().includes('schema') ? 'manual-provschema' : 'manual-calendar';
  if (url.includes('/student/calendar')) {
    config = saveConfigPatch({ calendarUrl: url });
  } else if (/prov|schema/i.test(url)) {
    config = saveConfigPatch({ provschemaUrl: url });
  }
  const htmlPath = saveSnapshot(`manual-${source}`, await page.content());
  const pageEvents = await scrapeCurrentPage(page, { source, config });
  const networkEvents = networkCapture.extractEvents();
  const events = [...pageEvents, ...networkEvents];

  if (events.length > 0) {
    allEvents.push(...events);
    const merged = mergeEvents(allEvents);
    console.log(`Captured ${events.length} event(s) from current page. Snapshot: ${htmlPath}`);
    console.log(`Total active/known events in data/events.json: ${merged.filter(e => e.status !== 'removed').length}`);
  } else {
    const diagnostics = await describeCurrentPage(page, config);
    const diagPath = saveSnapshot('manual-diagnostics-zero-events', JSON.stringify(diagnostics, null, 2), 'json');
    const networkDiagPath = networkCapture.saveDiagnostics('manual-network-diagnostics-zero-events');
    console.log(`Captured 0 event(s) from current page. Snapshot: ${htmlPath}`);
    console.log(`Page diagnostics: ${diagPath}`);
    console.log(`Network/API diagnostics: ${networkDiagPath}`);
    console.log('This means the parser did not see test text + dates together. Try changing filters/week/month or click into an event/detail view, then press Enter again.');
    console.log('The data/events.json file was not changed because this capture found 0 events.');
  }
  console.log('Navigate to another page/month/detail and press Enter again, or Ctrl+C to quit.');
}

await context.close();
