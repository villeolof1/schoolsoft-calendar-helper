import { stableHash } from './storage.js';

const MONTHS = new Map([
  ['jan', 1], ['januari', 1], ['january', 1],
  ['feb', 2], ['februari', 2], ['february', 2],
  ['mar', 3], ['mars', 3], ['march', 3],
  ['apr', 4], ['april', 4],
  ['maj', 5], ['may', 5],
  ['jun', 6], ['juni', 6], ['june', 6],
  ['jul', 7], ['juli', 7], ['july', 7],
  ['aug', 8], ['augusti', 8], ['august', 8],
  ['sep', 9], ['sept', 9], ['september', 9],
  ['okt', 10], ['oct', 10], ['oktober', 10], ['october', 10],
  ['nov', 11], ['november', 11],
  ['dec', 12], ['december', 12]
]);

export function normalizeWhitespace(s = '') {
  return String(s)
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r\\n|\\n|\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePreservingBreaks(s = '') {
  return String(s ?? '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeKey(s = '') {
  return normalizeWhitespace(String(s).toLowerCase())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9åäö]+/gi, ' ')
    .trim();
}

export function classifyType(text, config) {
  const lower = ` ${normalizeKey(text)} `;
  const checks = [
    ['omprov', 'Omprov'],
    ['prov', 'Prov'],
    ['test', 'Test'],
    ['läxförhör', 'Läxförhör'],
    ['laxforhor', 'Läxförhör'],
    ['diagnos', 'Diagnos'],
    ['inlämning', 'Inlämning'],
    ['inlamning', 'Inlämning'],
    ['redovisning', 'Redovisning'],
    ['seminarium', 'Seminarium'],
    ['klassrumsuppgift', 'Klassrumsuppgift'],
    ['classroom task', 'Klassrumsuppgift'],
    ['homework', 'Läxa'],
    ['läxa', 'Läxa'],
    ['laxa', 'Läxa'],
    ['examination', 'Examination'],
    ['exam', 'Examination'],
    ['quiz', 'Quiz']
  ];
  for (const [needle, label] of checks) {
    if (lower.includes(` ${needle} `)) return label;
  }
  const keywords = config.assessmentKeywords || [];
  for (const kw of keywords) {
    if (lower.includes(` ${normalizeKey(kw)} `)) return 'Annat viktigt';
  }
  return 'Oklar';
}

export function looksLikeAssessment(text, config) {
  const key = ` ${normalizeKey(text)} `;
  for (const ignore of config.ignoreKeywords || []) {
    if (key.includes(` ${normalizeKey(ignore)} `)) return false;
  }
  for (const kw of config.assessmentKeywords || []) {
    const k = normalizeKey(kw);
    if (k && key.includes(` ${k} `)) return true;
  }
  return false;
}

export function parseDateFromText(text, options = {}) {
  const raw = normalizeWhitespace(text);
  const now = options.now || new Date();
  const defaultYear = options.defaultYear || now.getFullYear();

  // 2026-09-14 or 2026/09/14
  let match = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  // 14/9, 14-09, 14.09 optionally with year
  match = raw.match(/\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](20\d{2}|\d{2}))?\b/);
  if (match) {
    let year = match[3] ? Number(match[3]) : inferSchoolYear(Number(match[2]), now, defaultYear);
    if (year < 100) year += 2000;
    return isoDate(year, Number(match[2]), Number(match[1]));
  }

  // 14 september 2026 / 14 sep / 14 June 2026
  match = raw.toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mars?|march|apr(?:il)?|maj|may|juni?|june|juli?|july|aug(?:usti|ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/);
  if (match) {
    const month = MONTHS.get(match[2]);
    const year = match[3] ? Number(match[3]) : inferSchoolYear(month, now, defaultYear);
    return isoDate(year, month, Number(match[1]));
  }

  // September 14 2026 / June 14
  match = raw.toLowerCase().match(/\b(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mars?|march|apr(?:il)?|maj|may|juni?|june|juli?|july|aug(?:usti|ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/);
  if (match) {
    const month = MONTHS.get(match[1]);
    const year = match[3] ? Number(match[3]) : inferSchoolYear(month, now, defaultYear);
    return isoDate(year, month, Number(match[2]));
  }

  return '';
}

function inferSchoolYear(month, now, defaultYear) {
  // If it is late in the year and we see Jan-Jun, assume next calendar year.
  // If it is early in the year and we see Aug-Dec, assume previous school term only when look-back is likely.
  const currentMonth = now.getMonth() + 1;
  if (currentMonth >= 8 && month <= 6) return defaultYear + 1;
  if (currentMonth <= 6 && month >= 8) return defaultYear - 1;
  return defaultYear;
}

function isoDate(year, month, day) {
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseTimeRange(text) {
  const raw = normalizeWhitespace(text);
  const match = raw.match(/\b(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?/);
  if (!match) return { startTime: '', endTime: '' };
  const startTime = `${String(match[1]).padStart(2, '0')}:${match[2]}`;
  const endTime = match[3] ? `${String(match[3]).padStart(2, '0')}:${match[4]}` : '';
  return { startTime, endTime };
}

export function extractStudentName(text, studentNames = []) {
  const key = normalizeKey(text);
  for (const name of studentNames) {
    if (name && key.includes(normalizeKey(name))) return name;
  }
  return '';
}

export function inferSubject(text) {
  const raw = normalizeWhitespace(text);
  const lower = normalizeKey(raw);
  const subjects = [
    ['matematik', 'Matematik'], ['ma ', 'Matematik'], ['svenska', 'Svenska'], ['sv ', 'Svenska'],
    ['engelska', 'Engelska'], ['en ', 'Engelska'], ['no ', 'NO'], ['so ', 'SO'],
    ['biologi', 'Biologi'], ['kemi', 'Kemi'], ['fysik', 'Fysik'], ['teknik', 'Teknik'],
    ['historia', 'Historia'], ['geografi', 'Geografi'], ['religion', 'Religion'], ['samhällskunskap', 'Samhällskunskap'], ['samhallskunskap', 'Samhällskunskap'],
    ['spanska', 'Spanska'], ['tyska', 'Tyska'], ['franska', 'Franska'], ['idrott', 'Idrott'],
    ['musik', 'Musik'], ['bild', 'Bild'], ['hemkunskap', 'Hemkunskap'], ['slöjd', 'Slöjd'], ['slojd', 'Slöjd']
  ];
  for (const [needle, label] of subjects) {
    if (` ${lower} `.includes(` ${needle.trim()} `)) return label;
  }
  const prefix = raw.match(/^([A-ZÅÄÖa-zåäö]{2,25})(?:\s*[-:–]|\s{2,})/);
  return prefix ? prefix[1] : '';
}

export function createEventFromText({ text, source, url, studentName, config }) {
  const rawText = normalizeWhitespace(text);
  if (!rawText || rawText.length < 4) return null;
  const date = parseDateFromText(rawText);
  if (!date) return null;
  const { startTime, endTime } = parseTimeRange(rawText);
  const type = classifyType(rawText, config);
  const detectedStudent = studentName || extractStudentName(rawText, config.studentNames);
  const subject = inferSubject(rawText);
  let title = rawText
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, '')
    .replace(/\b\d{1,2}[-/.]\d{1,2}(?:[-/.](?:20\d{2}|\d{2}))?\b/g, '')
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:[-–—]\s*\d{1,2}[:.]\d{2})?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title || title.length < 3) title = type !== 'Oklar' ? type : rawText;
  if (title.length > 140) title = `${title.slice(0, 137)}…`;

  const idBasis = [detectedStudent, date, startTime, subject, normalizeKey(title)].filter(Boolean).join('|');
  const now = new Date().toISOString();
  return {
    id: stableHash(idBasis || rawText),
    source,
    studentName: detectedStudent,
    date,
    startTime,
    endTime,
    subject,
    title,
    description: rawText,
    teacher: '',
    classOrGroup: '',
    rawText,
    sourceUrl: url || '',
    type,
    confidence: type === 'Oklar' ? 'low' : 'medium',
    firstSeenAt: now,
    lastSeenAt: now,
    status: 'active'
  };
}

export function dedupeEvents(events) {
  const byId = new Map();
  for (const event of events.filter(Boolean)) {
    const existing = byId.get(event.id);
    if (!existing) {
      byId.set(event.id, event);
      continue;
    }
    byId.set(event.id, {
      ...existing,
      ...event,
      source: [...new Set([existing.source, event.source].flatMap(s => String(s).split('+')))].join('+'),
      description: longest(existing.description, event.description),
      rawText: longest(existing.rawText, event.rawText),
      confidence: existing.confidence === 'medium' || event.confidence === 'medium' ? 'medium' : 'low'
    });
  }
  return [...byId.values()];
}

function longest(a = '', b = '') {
  return String(b).length > String(a).length ? b : a;
}
