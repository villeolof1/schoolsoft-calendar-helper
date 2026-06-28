import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveDataPath, ensureDirs } from './config.js';

export const eventsPath = resolveDataPath('data', 'events.json');
export const lastRunPath = resolveDataPath('data', 'last-run.json');
export const userStatePath = resolveDataPath('data', 'user-state.json');

export function stableHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function readEvents() {
  if (!fs.existsSync(eventsPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  } catch {
    return [];
  }
}

export function writeEvents(events) {
  ensureDirs();
  const normalized = events
    .filter(e => e && e.date && e.title)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime || '').localeCompare(String(b.startTime || '')) || String(a.title).localeCompare(String(b.title)));
  fs.writeFileSync(eventsPath, JSON.stringify(normalized, null, 2), 'utf8');
}

export function readLastRun() {
  if (!fs.existsSync(lastRunPath)) return null;
  try { return JSON.parse(fs.readFileSync(lastRunPath, 'utf8')); } catch { return null; }
}

export function readUserState() {
  if (!fs.existsSync(userStatePath)) {
    return { eventNotes: {}, eventDone: {}, dayNotes: {}, dayDone: {}, manualEvents: [], deletedEvents: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(userStatePath, 'utf8'));
    return {
      eventNotes: data.eventNotes && typeof data.eventNotes === 'object' ? data.eventNotes : {},
      eventDone: data.eventDone && typeof data.eventDone === 'object' ? data.eventDone : {},
      dayNotes: data.dayNotes && typeof data.dayNotes === 'object' ? data.dayNotes : {},
      dayDone: data.dayDone && typeof data.dayDone === 'object' ? data.dayDone : {},
      manualEvents: Array.isArray(data.manualEvents) ? data.manualEvents : [],
      deletedEvents: data.deletedEvents && typeof data.deletedEvents === 'object' ? data.deletedEvents : {}
    };
  } catch {
    return { eventNotes: {}, eventDone: {}, dayNotes: {}, dayDone: {}, manualEvents: [], deletedEvents: {} };
  }
}

export function writeUserState(state) {
  ensureDirs();
  const clean = {
    eventNotes: state.eventNotes || {},
    eventDone: state.eventDone || {},
    dayNotes: state.dayNotes || {},
    dayDone: state.dayDone || {},
    manualEvents: Array.isArray(state.manualEvents) ? state.manualEvents : [],
    deletedEvents: state.deletedEvents || {}
  };
  fs.writeFileSync(userStatePath, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

export function mergeEvents(newEvents, runInfo = {}) {
  ensureDirs();
  const now = new Date().toISOString();
  const previous = readEvents();
  const previousById = new Map(previous.map(e => [e.id, e]));
  const nextById = new Map();

  for (const event of newEvents.filter(Boolean)) {
    const previousEvent = previousById.get(event.id);
    nextById.set(event.id, {
      ...previousEvent,
      ...event,
      userNote: previousEvent?.userNote || event.userNote || '',
      done: Boolean(previousEvent?.done || event.done),
      firstSeenAt: previousEvent?.firstSeenAt || event.firstSeenAt || now,
      lastSeenAt: now,
      status: previousEvent && hasMeaningfulChange(previousEvent, event) ? 'changed' : 'active'
    });
  }

  // Earlier versions marked every missing old event as removed on each sync. That is too destructive
  // for month-by-month background loading. Preserve old events unless a future full-sync mode explicitly
  // asks to mark missing items as removed.
  for (const old of previous) {
    if (!nextById.has(old.id)) {
      nextById.set(old.id, runInfo.markMissingRemoved ? { ...old, status: 'removed', lastSeenAt: now } : old);
    }
  }

  const merged = [...nextById.values()];
  writeEvents(merged);

  const previousRun = readLastRun() || {};
  const loadedMonths = mergeMonthLists(previousRun.loadedMonths, runInfo.loadedMonths);
  const coverage = computeCoverage(merged, loadedMonths);
  fs.writeFileSync(lastRunPath, JSON.stringify({
    ...previousRun,
    ...runInfo,
    finishedAt: now,
    count: merged.length,
    loadedMonths,
    coverage
  }, null, 2), 'utf8');
  return merged;
}

function mergeMonthLists(a = [], b = []) {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(m => /^20\d{2}-\d{2}$/.test(String(m))))].sort();
}

function hasMeaningfulChange(oldEvent, newEvent) {
  const fields = ['date', 'startTime', 'endTime', 'studentName', 'subject', 'title', 'description', 'teacher', 'type'];
  return fields.some(f => (oldEvent[f] || '') !== (newEvent[f] || ''));
}

export function saveSnapshot(name, content, extension = 'html') {
  ensureDirs();
  const safeName = name.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').slice(0, 80);
  const file = resolveDataPath('snapshots', `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeName}.${extension}`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function computeCoverage(events, loadedMonths = []) {
  const months = [...new Set((loadedMonths || []).filter(m => /^20\d{2}-\d{2}$/.test(String(m))))].sort();
  if (months.length) {
    const activeDates = events.filter(e => e && e.status !== 'removed' && /^20\d{2}-\d{2}-\d{2}$/.test(String(e.date || ''))).length;
    return { from: months[0], to: months[months.length - 1], loadedMonths: months, eventCount: activeDates };
  }
  const activeDates = events
    .filter(e => e && e.status !== 'removed' && /^20\d{2}-\d{2}-\d{2}$/.test(String(e.date || '')))
    .map(e => e.date)
    .sort();
  if (!activeDates.length) return null;
  return {
    from: activeDates[0].slice(0, 7),
    to: activeDates[activeDates.length - 1].slice(0, 7),
    loadedMonths: [],
    eventCount: activeDates.length
  };
}
