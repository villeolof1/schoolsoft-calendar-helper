import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig, resolveProjectPath } from './scripts/shared/config.js';
import { readEvents, readLastRun, readUserState, writeUserState, stableHash } from './scripts/shared/storage.js';
import { eventsToIcs } from './scripts/shared/ics.js';
import { looksLikeAssessment, normalizeKey } from './scripts/shared/parse.js';

const config = loadConfig();
const publicDir = resolveProjectPath('public');
let syncRunning = false;
let currentSyncChild = null;
let lastSyncMessage = '';
let lastRequestedMonth = '';
let hourlyTimer = null;
let loginHelperRunning = false;
const pendingMonths = new Set();

process.on('uncaughtException', error => {
  console.error('Server error (kept running):', error?.stack || error?.message || error);
});
process.on('unhandledRejection', error => {
  console.error('Async server error (kept running):', error?.stack || error?.message || error);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/events') {
      return sendJson(res, { events: readCombinedEvents(), userState: readUserState(), lastRun: readLastRun(), syncRunning, loginHelperRunning, lastSyncMessage, lastRequestedMonth });
    }

    if (url.pathname === '/schoolsoft-tests.ics') {
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(eventsToIcs(filterEvents(readCombinedEvents(), url.searchParams), config));
    }

    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const requestedMonth = url.searchParams.get('month') || '';
      const interactive = url.searchParams.get('interactive') === '1';
      if (loginHelperRunning) {
        const reason = 'Inloggningsfönster är öppet. Logga in klart och stäng fönstret själv, klicka sedan Synka nu.';
        lastSyncMessage = reason;
        return sendJson(res, { ok: true, started: false, syncRunning: false, loginHelperRunning: true, requestedMonth, reason });
      }
      const started = runSync({ requestedMonth, reason: requestedMonth ? `coverage ${requestedMonth}` : 'manual', interactive });
      return sendJson(res, { ok: true, started, syncRunning: started || syncRunning, loginHelperRunning, requestedMonth, reason: started ? '' : lastSyncMessage || 'Synkning pågår redan. Den här månaden köas i bakgrunden.' });
    }

    if (url.pathname === '/api/open-login' && req.method === 'POST') {
      const started = openLoginHelper();
      return sendJson(res, { ok: true, started, syncRunning, loginHelperRunning, reason: started ? '' : 'Inloggningsfönster är redan öppet.' });
    }

    if (url.pathname === '/api/delete-local-data' && req.method === 'POST') {
      const body = await readJsonBody(req);
      deleteLocalData({ includeSession: Boolean(body.includeSession) });
      return sendJson(res, { ok: true, includeSession: Boolean(body.includeSession) });
    }

    if (url.pathname === '/api/event-note' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const state = readUserState();
      if (!body.id) return sendJson(res, { ok: false, error: 'Missing id' }, 400);
      const note = cleanSmallText(body.note || '');
      if (note) state.eventNotes[body.id] = note;
      else delete state.eventNotes[body.id];
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state });
    }

    if (url.pathname === '/api/event-done' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const state = readUserState();
      if (!body.id) return sendJson(res, { ok: false, error: 'Missing id' }, 400);
      if (body.done) state.eventDone[body.id] = true;
      else delete state.eventDone[body.id];
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state });
    }

    if (url.pathname === '/api/day-note' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const state = readUserState();
      if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(body.date || ''))) return sendJson(res, { ok: false, error: 'Missing/invalid date' }, 400);
      const note = cleanSmallText(body.note || '');
      if (note) state.dayNotes[body.date] = note;
      else delete state.dayNotes[body.date];
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state });
    }

    if (url.pathname === '/api/day-done' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const state = readUserState();
      if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(body.date || ''))) return sendJson(res, { ok: false, error: 'Missing/invalid date' }, 400);
      if (body.done) state.dayDone[body.date] = true;
      else delete state.dayDone[body.date];
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state });
    }

    if ((url.pathname === '/api/events-delete' || url.pathname === '/api/trash-events' || url.pathname === '/api/delete-events') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String).filter(Boolean))] : [];
      const state = readUserState();
      state.deletedEvents ||= {};
      const now = new Date().toISOString();
      for (const id of ids) state.deletedEvents[id] = { deletedAt: now };
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state, ids });
    }

    if ((url.pathname === '/api/events-restore' || url.pathname === '/api/restore-events') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String).filter(Boolean))] : [];
      const state = readUserState();
      state.deletedEvents ||= {};
      for (const id of ids) delete state.deletedEvents[id];
      writeUserState(state);
      return sendJson(res, { ok: true, userState: state, ids });
    }

    if (url.pathname === '/api/manual-event' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const state = readUserState();
      const date = String(body.date || '');
      if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return sendJson(res, { ok: false, error: 'Missing/invalid date' }, 400);
      const title = cleanSmallText(body.title || '').slice(0, 180);
      if (!title) return sendJson(res, { ok: false, error: 'Missing title' }, 400);
      const now = new Date().toISOString();
      const event = {
        id: `manual-${stableHash(`${date}|${title}|${now}`)}`,
        source: 'manual',
        date,
        startTime: cleanTime(body.startTime),
        endTime: cleanTime(body.endTime),
        subject: cleanSmallText(body.subject || '').slice(0, 20),
        subjectSource: 'manual',
        title,
        description: cleanSmallText(body.description || '').slice(0, 3000),
        type: cleanSmallText(body.type || 'Egen händelse').slice(0, 50),
        studentName: cleanSmallText(body.studentName || '').slice(0, 80),
        teacher: cleanSmallText(body.teacher || '').slice(0, 80),
        room: cleanSmallText(body.room || '').slice(0, 50),
        classOrGroup: cleanSmallText(body.classOrGroup || '').slice(0, 80),
        rawText: '',
        sourceUrl: '',
        confidence: 'manual',
        firstSeenAt: now,
        lastSeenAt: now,
        status: 'active',
        isUserEvent: true
      };
      state.manualEvents.push(event);
      writeUserState(state);
      return sendJson(res, { ok: true, event, userState: state });
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.stack || error.message);
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`SchoolSoft Test Calendar dashboard: http://localhost:${port}`);
  console.log(`Calendar feed: http://localhost:${port}/schoolsoft-tests.ics`);
  const minutes = Math.max(60, Number(config.syncIntervalMinutes || 60));
  console.log(`Auto-sync enabled every ${minutes} minute(s). Data is served immediately; sync runs in the background.`);
  hourlyTimer = setInterval(() => runSync({ reason: 'hourly' }), minutes * 60_000);
});

function readCombinedEvents() {
  const state = readUserState();
  const base = readEvents().filter(isUsableEvent);
  const manual = (state.manualEvents || []).map(e => ({ ...e, isUserEvent: true })).filter(isUsableEvent);
  const byId = new Map([...base, ...manual].map(event => [event.id, event]));
  return [...byId.values()].map(event => ({
    ...event,
    userNote: state.eventNotes[event.id] || '',
    done: Boolean(state.eventDone[event.id]),
    deleted: Boolean(state.deletedEvents?.[event.id]),
    deletedAt: state.deletedEvents?.[event.id]?.deletedAt || '',
    dayNote: state.dayNotes[event.date] || '',
    dayDone: Boolean(state.dayDone[event.date])
  }));
}

function isUsableEvent(event) {
  if (!event || !event.date || !event.title) return false;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(event.date))) return false;
  if (event.isUserEvent || event.source === 'manual') return true;
  const text = [event.title, event.description, event.rawText].join(' ');
  if (looksLikeCodeOrBrowserJunk(text)) return false;
  if /^\s*(true|false|null|undefined|0|1)\s*$/i.test(String(event.title))) return false;
  return true;
}

function looksLikeCodeOrBrowserJunk(text = '') {
  const t = String(text || '');
  if (!t) return true;
  const compact = t.replace(/\s+/g, '');
  if (/C=!S&&|\/gecko\/|Firefox\/|\.test\(|function\(|=>|webpack|navigator\.userAgent|Object\.defineProperty|window\.|document\.|prototype\.|\{\s*return\s+/i.test(t)) return true;
  if (compact.length > 40 && /[;{}()=]/.test(compact) && /&&|\|\||\/i\.test|var|let|const|function/i.test(compact)) return true;
  return false;
}

function filterEvents(events, params) {
  const scope = params.get('scope') || 'important';
  const student = params.get('student') || '';
  const type = params.get('type') || '';
  const subject = params.get('subject') || '';
  const teacher = params.get('teacher') || '';
  const room = params.get('room') || '';
  const q = normalizeKey(params.get('q') || '');
  return events.filter(event => {
    if (scope === 'trash') return Boolean(event.deleted);
    if (event.deleted) return false;
    if (event.status === 'removed') return scope === 'changed';
    if (scope === 'changed' && event.status !== 'changed' && event.status !== 'removed') return false;
    if (scope === 'important' && !isImportantForExport(event)) return false;
    if (student && String(event.studentName || '') !== student) return false;
    if (type && String(event.type || '') !== type) return false;
    if (subject && String(event.subject || '') !== subject) return false;
    if (teacher && String(event.teacher || '') !== teacher) return false;
    if (room && String(event.room || '') !== room) return false;
    if (q) {
      const haystack = normalizeKey([event.title, event.description, event.subject, event.studentName, event.teacher, event.room, event.type, event.rawText, event.userNote].join(' '));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function isImportantForExport(event) {
  if (event.isUserEvent) return true;
  if (event.type && event.type !== 'Oklar') return true;
  return looksLikeAssessment([event.title, event.description, event.rawText].join(' '), config);
}

function serveStatic(urlPath, res) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const contentType = contentTypeFor(filePath);
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(filePath));
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function runSync({ requestedMonth = '', reason = 'manual', interactive = false } = {}) {
  if (loginHelperRunning) {
    lastSyncMessage = 'Inloggningsfönster är öppet. Synkning väntar tills du stänger login-fönstret.';
    return false;
  }
  if (syncRunning) {
    if (requestedMonth) pendingMonths.add(requestedMonth);
    return false;
  }
  syncRunning = true;
  lastRequestedMonth = requestedMonth;
  const monthList = buildSyncMonthList(requestedMonth, reason);
  lastSyncMessage = monthList.length
    ? `Hämtar ${monthList[0]} först (${monthList.length} månad${monthList.length === 1 ? '' : 'er'})…`
    : `Synkar i bakgrunden (${reason})…`;
  console.log(`Starting SchoolSoft extraction (${reason})${requestedMonth ? ` for ${requestedMonth}` : ''}${monthList.length ? `: ${monthList.join(', ')}` : ''}…`);
  const env = { ...process.env };
  if (requestedMonth) env.SCHOOLSOFT_TARGET_MONTH = requestedMonth;
  if (monthList.length) env.SCHOOLSOFT_MONTH_LIST = monthList.join(',');
  env.SCHOOLSOFT_BACKGROUND_SYNC = '1';
  env.SCHOOLSOFT_HEADLESS = '0';
  if (interactive) env.SCHOOLSOFT_INTERACTIVE_LOGIN = '1';
  const child = spawn(process.execPath, ['scripts/extract.js'], { cwd: resolveProjectPath(), stdio: ['ignore', 'pipe', 'pipe'], env });
  currentSyncChild = child;
  child.stdout.on('data', data => { process.stdout.write(data); lastSyncMessage = summarizeProcessMessage(String(data)); });
  child.stderr.on('data', data => { process.stderr.write(data); lastSyncMessage = summarizeProcessMessage(String(data)); });
  child.on('error', error => {
    if (currentSyncChild === child) currentSyncChild = null;
    syncRunning = false;
    lastRequestedMonth = '';
    lastSyncMessage = `Synkning kunde inte startas: ${error.message}`;
    console.error(lastSyncMessage);
  });
  child.on('exit', code => {
    if (currentSyncChild === child) currentSyncChild = null;
    syncRunning = false;
    lastRequestedMonth = '';
    lastSyncMessage = code === 0
      ? 'Synkning klar'
      : 'Synkning misslyckades. Lokal data visas ändå. Klicka Logga in om sessionen gått ut och försök igen.';
    console.log(lastSyncMessage);
    const nextMonth = pendingMonths.values().next().value;
    if (nextMonth) {
      pendingMonths.delete(nextMonth);
      setTimeout(() => runSync({ requestedMonth: nextMonth, reason: `queued ${nextMonth}`, interactive: false }), 1500);
    }
  });
  return true;
}

function stopCurrentSyncForLogin() {
  pendingMonths.clear();
  if (!currentSyncChild) {
    syncRunning = false;
    lastRequestedMonth = '';
    return;
  }
  try { currentSyncChild.kill('SIGTERM'); } catch {}
  currentSyncChild = null;
  syncRunning = false;
  lastRequestedMonth = '';
  lastSyncMessage = 'Avbröt synkning så att du kan logga in i lugn och ro.';
}

function openLoginHelper() {
  if (loginHelperRunning) return false;
  stopCurrentSyncForLogin();
  loginHelperRunning = true;
  lastSyncMessage = 'Inloggningsfönster öppet. Slutför inloggningen där och stäng sedan fönstret själv.';
  const env = { ...process.env, SCHOOLSOFT_HEADLESS: '0' };
  const child = spawn(process.execPath, ['scripts/browser-login.js'], { cwd: resolveProjectPath(), stdio: ['ignore', 'pipe', 'pipe'], env });
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));
  child.on('error', error => {
    loginHelperRunning = false;
    console.error(`Kunde inte öppna inloggning: ${error.message}`);
  });
  child.on('exit', () => {
    loginHelperRunning = false;
    lastSyncMessage = 'Inloggningsfönster stängt. Klicka Synka nu för att hämta data.';
  });
  return true;
}

function buildSyncMonthList(requestedMonth, reason) {
  const lastRun = readLastRun() || {};
  const loaded = new Set(lastRun.loadedMonths || lastRun.coverage?.loadedMonths || []);
  const now = new Date();
  const target = /^20\d{2}-\d{2}$/.test(String(requestedMonth || ''))
    ? requestedMonth
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const wanted = monthsAround(target, 5, 5);
  const list = [];
  if (reason === 'manual' || requestedMonth) list.push(target);
  for (const m of wanted) if (!loaded.has(m) && !list.includes(m)) list.push(m);
  return list.slice(0, reason === 'hourly' ? 8 : 25);
}

function monthsAround(centerMonth, back, ahead) {
  const base = parseMonthKey(centerMonth) || new Date();
  const out = [monthKey(base)];
  for (let i = 1; i <= Math.max(back, ahead); i++) {
    if (i <= ahead) out.push(monthKey(addMonths(base, i)));
    if (i <= back) out.push(monthKey(addMonths(base, -i)));
  }
  return [...new Set(out)];
}
function parseMonthKey(key) {
  if (!/^20\d{2}-\d{2}$/.test(String(key || ''))) return null;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function addMonths(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), 1); d.setMonth(d.getMonth() + n); return d; }
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }

function deleteLocalData({ includeSession = false } = {}) {
  const files = [
    resolveProjectPath('data', 'events.json'),
    resolveProjectPath('data', 'last-run.json'),
    resolveProjectPath('data', 'user-state.json'),
    resolveProjectPath('data', 'events.ics')
  ];
  for (const file of files) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (error) { console.warn(`Could not remove ${file}: ${error.message}`); }
  }
  if (includeSession) {
    const profileDir = resolveProjectPath('.playwright-user-data');
    try { if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true }); } catch (error) { console.warn(`Could not remove ${profileDir}: ${error.message}`); }
  }
}

function summarizeProcessMessage(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return lastSyncMessage;
  const loaded = clean.match(/loaded (?:center|plus-\d+|minus-\d+|month-\d+) 20\d{2}-\d{2}/i);
  if (loaded) return loaded[0];
  const done = clean.match(/Done\. Wrote \d+ known event\(s\)/i);
  if (done) return done[0];
  const network = clean.match(/Network\/API responses: \d+ candidate event\(s\)/i);
  if (network) return network[0];
  return clean.slice(-220);
}

function cleanSmallText(value = '') {
  return String(value || '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function cleanTime(value = '') {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
