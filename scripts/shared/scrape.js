import { createEventFromText, dedupeEvents, looksLikeAssessment, normalizeWhitespace, parseDateFromText, parseTimeRange, classifyType, inferSubject, extractStudentName } from './parse.js';
import { stableHash } from './storage.js';

export async function scrapeCurrentPage(page, { source, studentName = '', config }) {
  // React pages often finish their first navigation before the calendar data has rendered.
  await page.waitForTimeout(1600).catch(() => {});
  const url = page.url();
  const events = [];

  const tableEvents = await scrapeTables(page, { source, url, studentName, config });
  events.push(...tableEvents);

  const calendarEvents = await scrapeReactCalendarLike(page, { source, url, studentName, config });
  events.push(...calendarEvents);

  const cardEvents = await scrapeCardsAndLists(page, { source, url, studentName, config });
  events.push(...cardEvents);

  const textEvents = await scrapeAssessmentLines(page, { source, url, studentName, config });
  events.push(...textEvents);

  return dedupeEvents(events);
}

async function scrapeTables(page, { source, url, studentName, config }) {
  return page.evaluate(({ source, url, studentName, config }) => {
    const normalizeWhitespace = s => String(s || '').replace(/\s+/g, ' ').trim();
    const rows = [];
    for (const table of document.querySelectorAll('table')) {
      const headerCells = [...table.querySelectorAll('tr')]
        .find(tr => tr.querySelectorAll('th').length || [...tr.children].some(c => /datum|date|ämne|amne|subject|prov|test|uppgift|assignment|tid|time|elev|student/i.test(c.textContent || '')))?.children || [];
      const headers = [...headerCells].map(c => normalizeWhitespace(c.textContent).toLowerCase());
      for (const tr of table.querySelectorAll('tr')) {
        const cells = [...tr.children].filter(c => ['TD', 'TH'].includes(c.tagName));
        if (cells.length < 2 || tr.querySelectorAll('th').length === cells.length) continue;
        const texts = cells.map(c => normalizeWhitespace(c.textContent));
        const rawText = texts.filter(Boolean).join(' | ');
        if (rawText.length < 5) continue;
        const row = { rawText, source, url, studentName, cells: texts, headers };
        rows.push(row);
      }
    }
    return rows;
  }, { source, url, studentName, config }).then(rows => rows.map(row => tableRowToEvent(row, config)).filter(Boolean));
}

function tableRowToEvent(row, config) {
  const rawText = normalizeWhitespace(row.rawText);
  const date = parseDateFromText(rawText);
  if (!date) return null;
  if (!looksLikeAssessment(rawText, config) && !/provschema/i.test(row.source)) return null;

  const headers = row.headers || [];
  const cells = row.cells || [];
  const findCell = (...needles) => {
    const idx = headers.findIndex(h => needles.some(n => h.includes(n)));
    return idx >= 0 ? cells[idx] : '';
  };

  const dateText = findCell('datum', 'date') || rawText;
  const timeText = findCell('tid', 'time') || rawText;
  const { startTime, endTime } = parseTimeRange(timeText);
  const subject = findCell('ämne', 'amne', 'subject') || inferSubject(rawText);
  const titleCandidate = findCell('prov', 'test', 'uppgift', 'assignment', 'rubrik', 'title', 'information', 'beskrivning', 'description') || rawText;
  const detectedStudent = row.studentName || findCell('elev', 'student', 'barn', 'child') || extractStudentName(rawText, config.studentNames);
  const type = classifyType(rawText, config);
  let title = titleCandidate.replace(dateText, '').trim() || type;
  title = title.replace(/\s*\|\s*/g, ' · ').slice(0, 140);

  const now = new Date().toISOString();
  const idBasis = [detectedStudent, date, startTime, subject, title.toLowerCase()].filter(Boolean).join('|');
  return {
    id: stableHash(idBasis),
    source: row.source,
    studentName: detectedStudent,
    date,
    startTime,
    endTime,
    subject,
    title,
    description: rawText,
    teacher: findCell('lärare', 'larare', 'teacher'),
    classOrGroup: findCell('klass', 'grupp', 'group'),
    rawText,
    sourceUrl: row.url,
    type,
    confidence: 'medium',
    firstSeenAt: now,
    lastSeenAt: now,
    status: 'active'
  };
}

async function scrapeReactCalendarLike(page, { source, url, studentName, config }) {
  const candidates = await page.evaluate(({ config }) => {
    const monthNumbers = {
      januari: 1, jan: 1, january: 1,
      februari: 2, feb: 2, february: 2,
      mars: 3, mar: 3, march: 3,
      april: 4, apr: 4,
      maj: 5, may: 5,
      juni: 6, jun: 6, june: 6,
      juli: 7, jul: 7, july: 7,
      augusti: 8, aug: 8, august: 8,
      september: 9, sep: 9, sept: 9,
      oktober: 10, okt: 10, oct: 10, october: 10,
      november: 11, nov: 11,
      december: 12, dec: 12
    };
    const normalizeWhitespace = s => String(s || '').replace(/\s+/g, ' ').trim();
    const normalizeKey = s => normalizeWhitespace(String(s || '').toLowerCase())
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9åäö]+/gi, ' ').trim();
    const pad = n => String(n).padStart(2, '0');
    const iso = (y, m, d) => {
      y = Number(y); m = Number(m); d = Number(d);
      if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
      return `${y}-${pad(m)}-${pad(d)}`;
    };
    const monthsPattern = Object.keys(monthNumbers).sort((a, b) => b.length - a.length).join('|');
    const now = new Date();
    const currentYear = now.getFullYear();
    const bodyText = normalizeWhitespace(document.body?.innerText || '');
    let pageYear = currentYear;
    let pageMonth = 0;
    let m = bodyText.toLowerCase().match(new RegExp(`\\b(${monthsPattern})\\s+(20\\d{2})\\b`));
    if (!m) m = bodyText.toLowerCase().match(new RegExp(`\\b(20\\d{2})\\s+(${monthsPattern})\\b`));
    if (m) {
      const monthToken = monthNumbers[m[1]] ? m[1] : m[2];
      const yearToken = /^20/.test(m[1]) ? m[1] : m[2];
      pageMonth = monthNumbers[monthToken];
      pageYear = Number(yearToken) || currentYear;
    }
    const inferYear = month => {
      const cm = now.getMonth() + 1;
      if (cm >= 8 && month <= 6) return currentYear + 1;
      if (cm <= 6 && month >= 8) return currentYear - 1;
      return currentYear;
    };
    const parseDate = text => {
      const raw = normalizeWhitespace(text).toLowerCase();
      if (!raw) return '';
      let mm = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (mm) return iso(mm[1], mm[2], mm[3]);
      mm = raw.match(/\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](20\d{2}|\d{2}))?\b/);
      if (mm) return iso(mm[3] ? (Number(mm[3]) < 100 ? 2000 + Number(mm[3]) : Number(mm[3])) : inferYear(Number(mm[2])), mm[2], mm[1]);
      mm = raw.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthsPattern})(?:\\s+(20\\d{2}))?\\b`));
      if (mm) {
        const mo = monthNumbers[mm[2]];
        return iso(mm[3] || inferYear(mo), mo, mm[1]);
      }
      mm = raw.match(new RegExp(`\\b(${monthsPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`));
      if (mm) {
        const mo = monthNumbers[mm[1]];
        return iso(mm[3] || inferYear(mo), mo, mm[2]);
      }
      // Calendar cells often contain only a day number; use this only with a visible month/year context.
      if (pageMonth && pageYear) {
        mm = raw.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
        if (mm) return iso(pageYear, pageMonth, mm[1]);
      }
      return '';
    };
    const keywords = (config.assessmentKeywords || []).map(normalizeKey).filter(Boolean);
    const hasAssessmentKeyword = text => {
      const key = ` ${normalizeKey(text)} `;
      return keywords.some(kw => key.includes(` ${kw} `));
    };
    const isVisible = el => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const attrText = el => {
      const values = [];
      for (const attr of ['aria-label', 'title', 'data-date', 'datetime', 'data-testid', 'data-tooltip', 'alt']) {
        const value = el.getAttribute?.(attr);
        if (value) values.push(value);
      }
      for (const attr of [...(el.attributes || [])]) {
        if (/date|day|time|tooltip|label|title/i.test(attr.name) && attr.value) values.push(attr.value);
      }
      return normalizeWhitespace(values.join(' '));
    };
    const ownText = el => normalizeWhitespace(`${attrText(el)} ${el.textContent || ''}`);
    const contexts = new Set();

    const all = [...document.querySelectorAll('body *')].filter(isVisible);

    // 1) Find nodes that themselves look like tests/assignments and climb to a parent/cell that contains the date.
    for (const el of all) {
      const base = ownText(el);
      if (base.length < 3 || base.length > 1500 || !hasAssessmentKeyword(base)) continue;

      let node = el;
      let bestDate = parseDate(base);
      let combined = base;
      for (let depth = 0; node && node !== document.body && depth < 8; depth++, node = node.parentElement) {
        const t = ownText(node);
        if (t && t.length < 3500) {
          combined = normalizeWhitespace(`${t} ${combined}`);
          bestDate = bestDate || parseDate(t) || parseDate(attrText(node));
        }
        if (bestDate) break;
      }
      if (!bestDate) {
        const datedAncestor = el.closest('[data-date], time, [datetime], [aria-label], [title]');
        if (datedAncestor) bestDate = parseDate(ownText(datedAncestor));
      }
      if (bestDate) contexts.add(normalizeWhitespace(`${bestDate} ${base}`));
      else contexts.add(normalizeWhitespace(base));
    }

    // 2) FullCalendar/agenda-like day cells often keep date in data-date and event text deeper down.
    const cellSelectors = [
      '[data-date]', '[role="gridcell"]', '[role="row"]', '.fc-daygrid-day', '.fc-timegrid-col',
      '[class*="day"]', '[class*="calendar"]', '[class*="event"]'
    ];
    for (const selector of cellSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (!isVisible(el)) continue;
        const t = ownText(el);
        if (t.length < 4 || t.length > 4000 || !hasAssessmentKeyword(t)) continue;
        const d = parseDate(attrText(el)) || parseDate(t);
        if (d) contexts.add(normalizeWhitespace(`${d} ${t}`));
      }
    }

    // 3) Stateful visible-text fallback: remember the most recent date header and attach following test lines to it.
    const lines = String(document.body?.innerText || '')
      .split(/\r?\n|\t/g)
      .map(normalizeWhitespace)
      .filter(line => line.length >= 1 && line.length <= 600);
    let currentDate = '';
    for (const line of lines) {
      const d = parseDate(line);
      if (d && !hasAssessmentKeyword(line)) currentDate = d;
      if (hasAssessmentKeyword(line)) {
        const ownDate = parseDate(line);
        if (ownDate || currentDate) contexts.add(normalizeWhitespace(`${ownDate || currentDate} ${line}`));
      }
    }

    return [...contexts].filter(Boolean).slice(0, 250);
  }, { config });

  return candidates
    .map(text => createEventFromText({ text, source, url, studentName, config }))
    .filter(event => event && (looksLikeAssessment(event.rawText, config) || /calendar/i.test(source)));
}

async function scrapeCardsAndLists(page, { source, url, studentName, config }) {
  const candidates = await page.evaluate(() => {
    const normalizeWhitespace = s => String(s || '').replace(/\s+/g, ' ').trim();
    const selectors = [
      '[class*=event]', '[class*=calendar]', '[class*=test]', '[class*=prov]', '[class*=assignment]', '[class*=assessment]',
      '.card', '.panel', '.box', '.list-group-item', 'li', 'article', 'section', '[role=listitem]', '[role=option]'
    ];
    const nodes = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(node => nodes.add(node));
    }
    return [...nodes]
      .map(node => normalizeWhitespace(`${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.textContent || ''}`))
      .filter(text => text.length >= 8 && text.length <= 1200);
  });
  return candidates
    .map(text => createEventFromText({ text, source, url, studentName, config }))
    .filter(event => event && looksLikeAssessment(event.rawText, config));
}

async function scrapeAssessmentLines(page, { source, url, studentName, config }) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const lines = splitUsefulLines(bodyText);
  const chunks = [];
  let currentDate = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineDate = parseDateFromText(line);
    if (lineDate && !looksLikeAssessment(line, config)) currentDate = lineDate;
    if (!looksLikeAssessment(line, config) && !lineDate) continue;
    const context = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(' | ');
    if (parseDateFromText(context) && looksLikeAssessment(context, config)) chunks.push(context);
    else if (currentDate && looksLikeAssessment(line, config)) chunks.push(`${currentDate} ${line}`);
  }
  return chunks.map(text => createEventFromText({ text, source, url, studentName, config })).filter(Boolean);
}

function splitUsefulLines(text) {
  return String(text)
    .split(/\n|\r|\t|(?<=\d{4})\s{2,}/g)
    .map(normalizeWhitespace)
    .filter(line => line.length >= 1 && line.length <= 800);
}

export async function describeCurrentPage(page, config) {
  await page.waitForTimeout(1000).catch(() => {});
  return page.evaluate(({ config }) => {
    const normalizeWhitespace = s => String(s || '').replace(/\s+/g, ' ').trim();
    const normalizeKey = s => normalizeWhitespace(String(s || '').toLowerCase())
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9åäö]+/gi, ' ').trim();
    const keywords = (config.assessmentKeywords || []).map(normalizeKey).filter(Boolean);
    const body = document.body?.innerText || '';
    const lines = body.split(/\r?\n|\t/g).map(normalizeWhitespace).filter(Boolean);
    const keyLines = lines.filter(line => {
      const key = ` ${normalizeKey(line)} `;
      return keywords.some(kw => key.includes(` ${kw} `));
    }).slice(0, 80);
    const datedLines = lines.filter(line => /20\d{2}|\b\d{1,2}[-/.]\d{1,2}\b|januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|january|february|march|may|june|july|august|october|december/i.test(line)).slice(0, 80);
    const buttonsAndLinks = [...document.querySelectorAll('a,button,[role=button],[role=tab]')]
      .map(el => normalizeWhitespace(`${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`))
      .filter(Boolean)
      .slice(0, 120);
    return {
      url: location.href,
      title: document.title,
      bodyLength: body.length,
      firstLines: lines.slice(0, 80),
      keyLines,
      datedLines,
      buttonsAndLinks
    };
  }, { config });
}
