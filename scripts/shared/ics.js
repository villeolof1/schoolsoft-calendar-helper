function escapeIcs(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line) {
  const max = 73;
  if (line.length <= max) return line;
  const parts = [];
  let rest = line;
  while (rest.length > max) {
    parts.push(rest.slice(0, max));
    rest = ` ${rest.slice(max)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function eventsToIcs(events, config = {}) {
  const now = toIcsDateTime(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Local SchoolSoft Test Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SchoolSoft prov och viktiga datum',
    `X-WR-TIMEZONE:${config.timezone || 'Europe/Stockholm'}`
  ];

  for (const event of events.filter(e => e.status !== 'removed' && e.date)) {
    const summary = makeSummary(event);
    const dtStart = event.startTime ? `${event.date.replace(/-/g, '')}T${event.startTime.replace(':', '')}00` : event.date.replace(/-/g, '');
    const endDate = event.endDate && event.endDate !== event.date ? event.endDate : '';
    const dtEnd = event.endTime ? `${(endDate || event.date).replace(/-/g, '')}T${event.endTime.replace(':', '')}00` : (endDate ? endDate.replace(/-/g, '') : '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@local-schoolsoft-calendar`);
    lines.push(`DTSTAMP:${now}`);
    if (event.startTime) {
      lines.push(`DTSTART;TZID=${config.timezone || 'Europe/Stockholm'}:${dtStart}`);
      if (dtEnd) lines.push(`DTEND;TZID=${config.timezone || 'Europe/Stockholm'}:${dtEnd}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      if (dtEnd) lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    }
    lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`));
    const description = [
      cleanForIcs(event.description || event.rawText || ''),
      event.result || event.grade ? `Resultat: ${cleanForIcs([event.result, event.grade].filter(Boolean).join(' · '))}` : '',
      event.studentName ? `Elev: ${cleanForIcs(event.studentName)}` : '',
      event.type ? `Typ: ${cleanForIcs(event.type)}` : '',
      event.source ? `Källa: ${cleanForIcs(event.source)}` : '',
      event.sourceUrl
    ].filter(Boolean).join('\n');
    lines.push(foldLine(`DESCRIPTION:${escapeIcs(description)}`));
    if (event.sourceUrl) lines.push(foldLine(`URL:${escapeIcs(event.sourceUrl)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function makeSummary(event) {
  const abbr = subjectAbbr(event.subject || event.activity || '');
  let title = cleanForIcs(event.title || event.description || event.type || 'Händelse')
    .replace(/^20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\s*/g, '')
    .replace(/^(description|name|title|text)\s*:?\s*/i, '')
    .trim();
  if (title.length > 100) title = `${title.slice(0, 97).trim()}…`;
  if (abbr && !new RegExp(`^${escapeRegExp(abbr)}\\s*:`, 'i').test(title)) title = `${abbr}: ${title}`;
  return title;
}

function cleanForIcs(text = '') {
  return String(text || '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/(^|[\s{|,])['"]?(description|name|title|subject|date|datum|text|information|content|body)['"]?\s*:\s*['"]?/gi, '$1')
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function subjectAbbr(subject = '') {
  const key = normalize(subject);
  const map = new Map(Object.entries({
    matematik: 'MA', math: 'MA', svenska: 'SV', swedish: 'SV', engelska: 'EN', english: 'EN', no: 'NO', so: 'SO',
    biologi: 'BI', kemi: 'KE', fysik: 'FY', teknik: 'TK', historia: 'HI', geografi: 'GE', religion: 'RE', samhällskunskap: 'SH', samhallskunskap: 'SH', spanska: 'SP', tyska: 'TY', franska: 'FR', idrott: 'ID', musik: 'MU', bild: 'BD', hemkunskap: 'HKK', slöjd: 'SL', slojd: 'SL'
  }));
  if (map.has(key)) return map.get(key);
  for (const [name, abbr] of map) if (` ${key} `.includes(` ${name} `)) return abbr;
  if (!key) return '';
  return key.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase();
}
function normalize(s = '') { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9åäö]+/gi, ' ').trim(); }
function escapeRegExp(s = '') { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function toIcsDateTime(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
