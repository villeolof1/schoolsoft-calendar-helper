import fs from 'node:fs';
import { loadConfig, resolveProjectPath } from './shared/config.js';
import { readEvents } from './shared/storage.js';
import { eventsToIcs } from './shared/ics.js';

const config = loadConfig();
console.log('Configuration loaded:');
console.log(`  baseUrl: ${config.baseUrl}`);
console.log(`  timezone: ${config.timezone}`);
console.log(`  headless: ${config.headless}`);
console.log(`  provschemaUrl configured: ${Boolean(config.provschemaUrl)}`);
console.log(`  calendarUrl configured: ${Boolean(config.calendarUrl)}`);
console.log(`  icalUrl configured: ${Boolean(config.icalUrl)}`);

const events = readEvents();
console.log(`Events currently stored: ${events.length}`);
const active = events.filter(e => e.status !== 'removed').length;
console.log(`Active events: ${active}`);

const ics = eventsToIcs(events, config);
fs.writeFileSync(resolveProjectPath('data', 'events.ics'), ics, 'utf8');
console.log('ICS generation OK: data/events.ics');
