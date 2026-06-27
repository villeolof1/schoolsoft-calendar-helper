import fs from 'node:fs';
import { createEventFromText, dedupeEvents, looksLikeAssessment, normalizeWhitespace, normalizePreservingBreaks, parseDateFromText, parseTimeRange, classifyType, extractStudentName, normalizeKey } from './parse.js';
import { saveSnapshot, stableHash } from './storage.js';

const MAX_BODY_CHARS = 1_500_000;
const MAX_STORED_RESPONSES = 80;

export function startNetworkCapture(page, config) {
  const captured = [];
  const host = safeHost(config.baseUrl);

  page.on('response', async response => {
    try {
      const request = response.request();
      const url = response.url();
      const urlHost = safeHost(url);
      if (host && urlHost && urlHost !== host) return;
      if (!/^https?:/i.test(url)) return;
      if (!['GET', 'POST'].includes(request.method())) return;

      const headers = response.headers();
      const contentType = String(headers['content-type'] || '').toLowerCase();
      const lowerUrl = url.toLowerCase();
      const interestingUrl = /calendar|schema|prov|test|assignment|homework|planning|lesson|student|api|react|event|assessment|task|exam|activity/.test(lowerUrl);
      const interestingType = /json|javascript|text|html/.test(contentType);
      if (!interestingUrl && !interestingType) return;
      if (/\.((png|jpe?g|gif|webp|svg|ico|woff2?|ttf|css|map))(\?|$)/i.test(lowerUrl)) return;

      let text = '';
      try {
        const buffer = await response.body();
        if (!buffer || buffer.length === 0) return;
        const asText = buffer.toString('utf8');
        text = asText.length > MAX_BODY_CHARS ? asText.slice(0, MAX_BODY_CHARS) : asText;
      } catch {
        return;
      }
      if (!text || text.length < 2) return;

      const compact = normalizeWhitespace(text.slice(0, 3000));
      const hasKeyword = looksLikeAssessment(compact, config) || /prov|test|assignment|assessment|exam|quiz|läxförhör|inlämning|redovisning/i.test(compact);
      const hasDate = /20\d{2}|\b\d{1,2}[-/.]\d{1,2}\b|datum|date|start|end|calendar/i.test(compact);
      if (!hasKeyword && !hasDate && !interestingUrl) return;

      captured.push({
        at: new Date().toISOString(),
        url,
        method: request.method(),
        status: response.status(),
        contentType,
        body: text
      });
      while (captured.length > MAX_STORED_RESPONSES) captured.shift();
    } catch {
      // Network capture must never break extraction.
    }
  });

  return {
    responses: captured,
    extractEvents() {
      return extractEventsFromNetwork(captured, config);
    },
    saveDiagnostics(label = 'network-diagnostics') {
      const summary = buildNetworkDiagnostics(captured, config);
      return saveSnapshot(label, JSON.stringify(summary, null, 2), 'json');
    }
  };
}

function safeHost(url) {
  try { return new URL(url).host; } catch { return ''; }
}

export function extractEventsFromNetwork(captured, config) {
  const events = [];
  for (const item of captured) {
    events.push(...extractEventsFromResponse(item, config));
  }
  return dedupeEvents(events);
}


function looksLikeBrowserOrCodeJunk(text = '') {
  const t = String(text || '');
  const compact = t.replace(/\s+/g, '');
  if (!t) return true;
  if (/C=!S&&|\/gecko\\\/|Firefox\\\/|\.test\(|function\(|=>|webpack|navigator\.userAgent|Object\.defineProperty|window\.|document\.|prototype\.|\{\s*return\s+/i.test(t)) return true;
  if (compact.length > 40 && /[;{}()=]/.test(compact) && /&&|\|\||var|let|const|function|return/i.test(compact)) return true;
  return false;
}

function isPlausibleLooseEventLine(line = '') {
  const text = normalizeWhitespace(line);
  if (looksLikeBrowserOrCodeJunk(text)) return false;
  if (!parseDateFromText(text)) return false;
  if (text.length < 12 || text.length > 700) return false;
  if (/^20\d{2}-\d{2}-\d{2}\s*(true|false|\d+)\s*$/i.test(text)) return false;
  return true;
}

function extractEventsFromResponse(item, config) {
  const events = [];
  const body = item.body || '';
  const source = `network:${shortPath(item.url)}`;

  if (/json/i.test(item.contentType) || /^[\s\[{]/.test(body)) {
    try {
      const json = JSON.parse(body);
      const fromJson = extractEventsFromJsonValue(json, { source, url: item.url, config });
      events.push(...fromJson);
      // If valid JSON yielded structured events, do not also run the loose line parser;
      // it tends to create duplicate/junk rows from individual metadata fragments.
      if (fromJson.length) return dedupeEvents(events);
    } catch {
      // Not valid JSON despite looking like JSON.
    }
  }

  // Generic line-based fallback for JS/HTML/text responses that embed data.
  const lines = body
    .replace(/[{}\[\],]/g, '\n')
    .split(/\r?\n/)
    .map(line => line.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))))
    .map(line => normalizeWhitespace(line.replace(/^["'\s:]+|["'\s:]+$/g, '')))
    .filter(line => line.length >= 8 && line.length <= 1000);

  for (const line of lines) {
    if (!looksLikeAssessment(line, config)) continue;
    const withDate = addNearbyDateIfNeeded(line, body);
    if (!isPlausibleLooseEventLine(withDate)) continue;
    const event = createEventFromText({ text: withDate, source, url: item.url, config });
    if (event) events.push({ ...event, confidence: event.confidence === 'low' ? 'low' : 'medium' });
  }

  return dedupeEvents(events);
}

function addNearbyDateIfNeeded(line, body) {
  if (parseDateFromText(line)) return line;
  const idx = body.indexOf(line);
  const windowText = idx >= 0 ? body.slice(Math.max(0, idx - 700), Math.min(body.length, idx + line.length + 700)) : body.slice(0, 2000);
  const date = extractDateFromAnyText(windowText);
  return date ? `${date} ${line}` : line;
}

function extractEventsFromJsonValue(value, ctx, path = '$') {
  const events = [];
  const seen = new WeakSet();

  const visit = (node, nodePath) => {
    if (node == null) return;

    if (typeof node === 'string') {
      const text = normalizeWhitespace(node);
      if (looksLikeAssessment(text, ctx.config) && parseDateFromText(text)) {
        const event = createEventFromText({ text, source: ctx.source, url: ctx.url, config: ctx.config });
        if (event) events.push(event);
      }
      return;
    }

    if (typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) visit(node[i], `${nodePath}[${i}]`);
      return;
    }

    const objectEvent = eventFromObject(node, ctx);
    if (objectEvent) events.push(objectEvent);

    for (const [key, child] of Object.entries(node)) visit(child, `${nodePath}.${key}`);
  };

  visit(value, path);
  return dedupeEvents(events);
}

function eventFromObject(obj, ctx) {
  const scalarEntries = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      const text = normalizeWhitespace(String(value));
      if (text && text.length <= 700) scalarEntries.push([key, text]);
    }
  }

  if (!scalarEntries.length) return null;
  const combined = scalarEntries.map(([k, v]) => `${k}: ${v}`).join(' | ');
  if (looksLikeBrowserOrCodeJunk(combined)) return null;
  if (!looksLikeAssessment(combined, ctx.config)) return null;

  const date = extractDateFromObject(obj, combined);
  if (!date) return null;

  // SchoolSoft's calendar API commonly uses `activity` for the course/subject abbreviation,
  // e.g. MA, SV, EN. This is a structured field, so it is much more reliable than
  // guessing from title/description text. Keep it as-is for all subjects.
  const rawSubject = pickFirst(obj, ['activity', 'activityName', 'courseCode', 'courseName', 'course', 'subjectCode', 'subjectName', 'subject', 'schoolSubject', 'lessonSubject']);
  const subject = cleanSubjectValue(rawSubject);
  const subjectSource = subject ? 'explicit' : '';
  const type = classifyType(combined, ctx.config);
  const title = pickFirst(obj, [
    'title', 'summary', 'heading', 'header', 'assignmentName', 'testName', 'eventName', 'activityName', 'lessonName', 'planningTitle', 'name'
  ]) || [subject, type !== 'Oklar' ? type : '', pickFirst(obj, ['description', 'information', 'text'])].filter(Boolean).join(' ');
  const description = pickFirstPreserveBreaks(obj, ['description', 'information', 'content', 'body', 'text', 'note', 'notes', 'comment', 'comments', 'planning']) || combined;
  const studentName = pickFirst(obj, ['studentName', 'student', 'pupilName', 'childName', 'nameOfStudent']) || extractStudentName(combined, ctx.config.studentNames);
  const teacher = pickFirst(obj, ['teacherName', 'teacher', 'mentorName', 'staffName', 'createdByName']);
  const room = pickFirst(obj, ['room', 'roomName', 'classroom', 'location', 'place', 'lokal', 'sal']);
  const { startTime, endTime, allDay } = extractTimesFromObject(obj, combined);
  const endDate = extractEndDateFromObject(obj);
  const result = safeExplicitResult(obj);
  const now = new Date().toISOString();
  const cleanTitle = normalizeWhitespace(String(title)).slice(0, 140) || type;
  const rawText = normalizeWhitespace(`${date} ${combined}`);
  const idBasis = [studentName, date, startTime, subject, normalizeKey(cleanTitle)].filter(Boolean).join('|');

  return {
    id: stableHash(idBasis || rawText),
    source: ctx.source,
    studentName,
    date,
    startTime,
    endTime,
    subject,
    subjectSource,
    title: cleanTitle,
    description: normalizePreservingBreaks(String(description || combined)).slice(0, 3000),
    teacher,
    room,
    classOrGroup: pickFirst(obj, ['teachingGroup', 'className', 'class', 'groupName', 'group']),
    allDay,
    endDate: endDate && endDate !== date ? endDate : '',
    activity: pickFirst(obj, ['activity']),
    activityId: pickFirst(obj, ['activityId']),
    entityId: pickFirst(obj, ['entityId']),
    result,
    grade: safeExplicitGrade(obj),
    rawText,
    sourceUrl: ctx.url,
    type,
    confidence: 'medium',
    firstSeenAt: now,
    lastSeenAt: now,
    status: 'active'
  };
}

function safeExplicitResult(obj) {
  const resultKeys = [
    'result', 'results', 'assessmentResult', 'assessmentText', 'resultText', 'grade', 'gradeValue',
    'gradeText', 'gradeName', 'publishedResult', 'betyg', 'omdome', 'omdöme', 'score', 'scoreText', 'mark', 'markText'
  ];
  const raw = pickFirst(obj, resultKeys);
  return cleanResultValue(raw);
}

function safeExplicitGrade(obj) {
  return cleanResultValue(pickFirst(obj, ['grade', 'gradeValue', 'gradeText', 'gradeName', 'betyg']));
}

function cleanResultValue(value = '') {
  const text = normalizeWhitespace(String(value || ''));
  if (!text) return '';
  if (/^(true|false|null|undefined|0|1|yes|no|ja|nej)$/i.test(text)) return '';
  if (/^20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(text)) return '';
  if (text.length > 50) return '';
  // Avoid accidental fragments of ordinary descriptions. Real grades/results are usually short.
  if (/\b(don'?t worry|inte satt|not setting|end-of-term grades quite yet|grades? quite yet|startDate|endDate|allDay|teacher|teachingGroup|activity|entityId)\b/i.test(text)) return '';
  if (/[{}|]|\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}\b/.test(text)) return '';
  return text;
}

function pickFirst(obj, keys) {
  const lowerMap = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]));
  for (const desired of keys) {
    const actual = lowerMap.get(desired.toLowerCase());
    if (!actual) continue;
    const value = obj[actual];
    if (value == null) continue;
    if (typeof value === 'object') continue;
    const text = normalizeWhitespace(String(value));
    if (text) return text;
  }
  return '';
}

function pickFirstPreserveBreaks(obj, keys) {
  const lowerMap = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]));
  for (const desired of keys) {
    const actual = lowerMap.get(desired.toLowerCase());
    if (!actual) continue;
    const value = obj[actual];
    if (value == null) continue;
    if (typeof value === 'object') continue;
    const text = normalizePreservingBreaks(String(value));
    if (text) return text;
  }
  return '';
}

function cleanSubjectValue(value = '') {
  const subject = normalizeWhitespace(String(value || ''));
  if (!subject) return '';
  const key = normalizeKey(subject);
  if (/^(oklar|unknown|null|undefined|true|false|active|handelse|händelse)$/.test(key)) return '';
  if (/\d{4}-\d{2}-\d{2}/.test(subject) || subject.length > 48) return '';
  if (looksLikeAssessment(subject, { assessmentWords: [] })) return '';
  return subject;
}


function extractTimesFromObject(obj, combined) {
  const startRaw = pickFirst(obj, ['startDate', 'start', 'startTime', 'from', 'dateFrom']);
  const endRaw = pickFirst(obj, ['endDate', 'end', 'endTime', 'to', 'dateTo']);
  const allDayRaw = pickFirst(obj, ['allDay', 'isAllDay']);
  const allDay = /^(true|1|yes|ja)$/i.test(String(allDayRaw || ''));
  const startIso = timeFromIsoLike(startRaw);
  const endIso = timeFromIsoLike(endRaw);
  if (allDay) return { startTime: '', endTime: '', allDay };
  if (startIso || endIso) return { startTime: startIso, endTime: endIso, allDay };
  const fallback = parseTimeRange([pickFirst(obj, ['time']), combined].filter(Boolean).join(' '));
  return { ...fallback, allDay };
}

function timeFromIsoLike(value = '') {
  const text = String(value || '');
  const m = text.match(/T(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  // 00:00 is usually just SchoolSoft's all-day placeholder, unless allDay was false and no other signal exists.
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function extractEndDateFromObject(obj) {
  const raw = pickFirst(obj, ['endDate', 'end', 'dateTo', 'deadlineTo']);
  return raw ? extractDateFromAnyText(raw) : '';
}

function extractDateFromObject(obj, combined) {
  const directKeys = [
    'date', 'datum', 'day', 'start', 'end', 'startDate', 'endDate', 'dateFrom', 'dateTo',
    'startTime', 'endTime', 'calendarDate', 'eventDate', 'plannedDate', 'deadline', 'dueDate',
    'publishDate', 'lessonDate', 'examDate', 'testDate'
  ];
  const lowerMap = new Map(Object.keys(obj).map(k => [k.toLowerCase(), k]));
  for (const wanted of directKeys) {
    const actual = lowerMap.get(wanted.toLowerCase());
    if (!actual) continue;
    const date = extractDateFromAnyText(String(obj[actual]));
    if (date) return date;
  }
  return extractDateFromAnyText(combined);
}

function extractDateFromAnyText(text) {
  const raw = normalizeWhitespace(String(text || ''));
  const parsed = parseDateFromText(raw);
  if (parsed) return parsed;

  let m = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})T\d{2}:\d{2}/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = raw.match(/\/Date\((\d{10,13})\)\//);
  if (m) return dateFromTimestamp(m[1]);

  m = raw.match(/\b(1[5-9]\d{8}|2\d{9})\b/); // Unix seconds since 2017-ish
  if (m) return dateFromTimestamp(m[1]);

  m = raw.match(/\b(1[5-9]\d{11}|2\d{12})\b/); // Unix ms since 2017-ish
  if (m) return dateFromTimestamp(m[1]);

  return '';
}

function dateFromTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const ms = n < 100000000000 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  if (year < 2010 || year > 2100) return '';
  return `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function shortPath(url) {
  try {
    const u = new URL(url);
    const p = `${u.pathname}${u.search}`.replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return p.slice(0, 48) || 'response';
  } catch {
    return 'response';
  }
}

function buildNetworkDiagnostics(captured, config) {
  return {
    createdAt: new Date().toISOString(),
    responseCount: captured.length,
    responses: captured.map(item => {
      const body = item.body || '';
      const compact = normalizeWhitespace(body.slice(0, 12000));
      const lines = compact.split(/(?<=[.!?}])\s+|\s*\|\s*/).filter(Boolean);
      const keyLines = lines.filter(line => looksLikeAssessment(line, config)).slice(0, 80);
      const dateLines = lines.filter(line => /20\d{2}|\b\d{1,2}[-/.]\d{1,2}\b|datum|date|start|end/i.test(line)).slice(0, 80);
      return {
        at: item.at,
        status: item.status,
        contentType: item.contentType,
        url: item.url,
        bodyChars: body.length,
        keyLines,
        dateLines,
        preview: compact.slice(0, 1200)
      };
    })
  };
}
