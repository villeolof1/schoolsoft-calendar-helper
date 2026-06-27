const IMPORTANT_WORDS = [
  'prov', 'test', 'läxförhör', 'laxforhor', 'diagnos', 'inlämning', 'inlamning',
  'redovisning', 'seminarium', 'klassrumsuppgift', 'classroom task', 'examination', 'exam', 'quiz', 'assessment', 'assignment', 'deadline', 'homework', 'läxa', 'laxa'
];

const SUBJECT_ABBR = new Map(Object.entries({
  'matematik': 'MA', 'math': 'MA', 'mathematics': 'MA',
  'svenska': 'SV', 'swedish': 'SV',
  'engelska': 'EN', 'english': 'EN',
  'no': 'NO', 'naturorienterande ämnen': 'NO',
  'so': 'SO', 'samhällsorienterande ämnen': 'SO',
  'biologi': 'BI', 'biology': 'BI',
  'kemi': 'KE', 'chemistry': 'KE',
  'fysik': 'FY', 'physics': 'FY',
  'teknik': 'TK', 'technology': 'TK',
  'historia': 'HI', 'history': 'HI',
  'geografi': 'GE', 'geography': 'GE',
  'religion': 'RE',
  'samhällskunskap': 'SH', 'samhallskunskap': 'SH', 'civics': 'SH', 'social studies': 'SH',
  'spanska': 'SP', 'spanish': 'SP',
  'tyska': 'TY', 'german': 'TY',
  'franska': 'FR', 'french': 'FR',
  'idrott': 'ID', 'pe': 'ID', 'sports': 'ID',
  'musik': 'MU', 'music': 'MU',
  'bild': 'BD', 'art': 'BD',
  'hemkunskap': 'HKK', 'home economics': 'HKK',
  'slöjd': 'SL', 'slojd': 'SL', 'crafts': 'SL'
}));

const COMMON_SUBJECT_ORDER = ['MA', 'SV', 'EN', 'NO', 'SO', 'BI', 'KE', 'FY', 'TE', 'GE', 'HI', 'RE', 'SH', 'SP', 'TY', 'FR', 'ID', 'MU', 'BD', 'HKK', 'SL'];
const COMMON_TYPE_ORDER = ['Prov', 'Test', 'Inlämning', 'Redovisning', 'Seminarium', 'Läxförhör', 'Diagnos', 'Klassrumsuppgift', 'Läxa', 'Quiz', 'Examination', 'Annat viktigt', 'Oklar'];

const PALETTE = [
  // High-contrast ordered qualitative palette. The earliest slots are reserved for
  // common school subjects/types and are deliberately far apart in hue and lightness.
  '#0057B8', '#D0021B', '#008A20', '#FF8C00', '#6B2FB9', '#009E9E',
  '#B00063', '#6B8E00', '#5A3A1A', '#E6007E', '#0072CE', '#C67A00',
  '#1B5E20', '#C62828', '#283593', '#00838F', '#7B1FA2', '#A85D00',
  '#2E7D32', '#AD1457', '#1565C0', '#827717', '#4E342E', '#00695C',
  '#EF6C00', '#512DA8', '#0277BD', '#9E9D24', '#B71C1C', '#37474F'
];

const SUBJECT_COLOR_OVERRIDES = {
  MA: '#0057B8', SV: '#D0021B', EN: '#008A20', NO: '#6B2FB9', SO: '#FF8C00',
  BI: '#009E9E', KE: '#B00063', FY: '#5A3A1A', TK: '#6B8E00', TE: '#6B8E00',
  GE: '#0072CE', HI: '#C67A00', RE: '#7B1FA2', SH: '#1B5E20',
  SP: '#E6007E', TY: '#37474F', FR: '#00838F', ID: '#EF6C00',
  MU: '#512DA8', BD: '#827717', HKK: '#4E342E', SL: '#00695C'
};

const TYPE_COLOR_OVERRIDES = {
  prov: '#0057B8', test: '#D0021B', assessment: '#D0021B',
  inlämning: '#6B2FB9', inlamning: '#6B2FB9',
  redovisning: '#008A20', seminarium: '#FF8C00',
  läxförhör: '#B00063', laxförhor: '#B00063', diagnos: '#009E9E',
  klassrumsuppgift: '#C67A00', quiz: '#0072CE', examination: '#7B1FA2',
  läxa: '#6B8E00', laxa: '#6B8E00', 'egen händelse': '#37474F'
};

const state = {
  events: [],
  filtered: [],
  view: localStorage.getItem('sstc.view') || 'month',
  anchorDate: parseStoredDate(localStorage.getItem('sstc.anchorDate')) || startOfDay(new Date()),
  selectedDate: parseStoredDate(localStorage.getItem('sstc.selectedDate')) || parseStoredDate(localStorage.getItem('sstc.anchorDate')) || startOfDay(new Date()),
  search: localStorage.getItem('sstc.search') || '',
  student: localStorage.getItem('sstc.student') || '',
  type: localStorage.getItem('sstc.type') || '',
  subject: localStorage.getItem('sstc.subject') || '',
  teacher: localStorage.getItem('sstc.teacher') || '',
  room: localStorage.getItem('sstc.room') || '',
  scope: localStorage.getItem('sstc.scope') || 'important',
  colorBy: localStorage.getItem('sstc.colorBy') || 'type',
  lastRun: null,
  syncRunning: false,
  lastSyncMessage: '',
  requestedMonths: new Set(),
  activeDayDrawerKey: '',
  selectedEventIds: new Set(),
  userState: { eventNotes: {}, eventDone: {}, dayNotes: {}, dayDone: {}, manualEvents: [], deletedEvents: {} }
};

const fmt = {
  weekdayLong: new Intl.DateTimeFormat('sv-SE', { weekday: 'long' }),
  weekdayShort: new Intl.DateTimeFormat('sv-SE', { weekday: 'short' }),
  monthYear: new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }),
  dayMonth: new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }),
  fullDate: new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  shortMonth: new Intl.DateTimeFormat('sv-SE', { month: 'short' })
};

const els = {
  upcomingCount: qs('#upcomingCount'),
  weekCount: qs('#weekCount'),
  heavyWeek: qs('#heavyWeek'),
  lastRun: qs('#lastRun'),
  syncStatus: qs('#syncStatus'),
  syncDot: qs('#syncDot'),
  coverageText: qs('#coverageText'),
  syncNow: qs('#syncNow'),
  loginButton: qs('#loginButton'),
  newEventButton: qs('#newEventButton'),
  trashButton: qs('#trashButton'),
  selectedDatePill: qs('#selectedDatePill'),
  search: qs('#search'),
  studentFilter: qs('#studentFilter'),
  typeFilter: qs('#typeFilter'),
  subjectFilter: qs('#subjectFilter'),
  teacherFilter: qs('#teacherFilter'),
  roomFilter: qs('#roomFilter'),
  scopeFilter: qs('#scopeFilter'),
  colorBy: qs('#colorBy'),
  clearFilters: qs('#clearFilters'),
  legend: qs('#legend'),
  icsLink: qs('#icsLink'),
  copyIcs: qs('#copyIcs'),
  deleteLocalData: qs('#deleteLocalData'),
  periodTitle: qs('#periodTitle'),
  prevPeriod: qs('#prevPeriod'),
  nextPeriod: qs('#nextPeriod'),
  todayButton: qs('#todayButton'),
  selectionBar: qs('#selectionBar'),
  emptyState: qs('#emptyState'),
  drawer: qs('#detailDrawer'),
  drawerBackdrop: qs('#drawerBackdrop'),
  closeDrawer: qs('#closeDrawer'),
  drawerTitle: qs('#drawerTitle'),
  drawerEyebrow: qs('#drawerEyebrow'),
  drawerContent: qs('#drawerContent'),
  privacyModal: qs('#privacyModal'),
  privacyAgreeCheck: qs('#privacyAgreeCheck'),
  privacyAccept: qs('#privacyAccept'),
  views: {
    month: qs('#monthView'),
    week: qs('#weekView'),
    day: qs('#dayView'),
    list: qs('#listView'),
    history: qs('#historyView')
  }
};

if (state.scope === 'trash') state.scope = 'important';
els.search.value = state.search;
els.scopeFilter.value = state.scope;
if (els.colorBy) els.colorBy.value = state.colorBy;

for (const button of document.querySelectorAll('.view-button')) {
  button.classList.toggle('active', button.dataset.view === state.view);
  button.addEventListener('click', () => setView(button.dataset.view));
}

els.prevPeriod.addEventListener('click', () => movePeriod(-1));
els.nextPeriod.addEventListener('click', () => movePeriod(1));
els.todayButton.addEventListener('click', () => { const today = startOfDay(new Date()); state.anchorDate = today; state.selectedDate = today; persist(); render(); ensureCoverageForVisibleRange(); });
els.search.addEventListener('input', e => { state.search = e.target.value; persist(); render(); });
els.studentFilter.addEventListener('change', e => { state.student = e.target.value; persist(); render(); });
els.typeFilter.addEventListener('change', e => { state.type = e.target.value; persist(); render(); });
els.subjectFilter?.addEventListener('change', e => { state.subject = e.target.value; persist(); render(); });
els.teacherFilter?.addEventListener('change', e => { state.teacher = e.target.value; persist(); render(); });
els.roomFilter?.addEventListener('change', e => { state.room = e.target.value; persist(); render(); });
els.scopeFilter.addEventListener('change', e => { state.scope = e.target.value; persist(); render(); });
els.colorBy?.addEventListener('change', e => { state.colorBy = e.target.value; persist(); render(); });
els.clearFilters.addEventListener('click', () => {
  state.search = '';
  state.student = '';
  state.type = '';
  state.subject = '';
  state.teacher = '';
  state.room = '';
  state.scope = 'important';
  els.search.value = '';
  els.studentFilter && (els.studentFilter.value = '');
  els.typeFilter && (els.typeFilter.value = '');
  els.subjectFilter && (els.subjectFilter.value = '');
  els.teacherFilter && (els.teacherFilter.value = '');
  els.roomFilter && (els.roomFilter.value = '');
  els.scopeFilter.value = 'important';
  persist();
  render();
});
els.syncNow.addEventListener('click', () => triggerSync(monthKey(state.anchorDate), { interactive: true }));
els.loginButton?.addEventListener('click', openLoginWindow);
els.newEventButton?.addEventListener('click', () => openManualEventDrawer(isoDate(state.selectedDate || state.anchorDate)));
els.trashButton?.addEventListener('click', () => openTrashDrawer());
els.copyIcs?.addEventListener('click', copyIcsLink);
els.deleteLocalData?.addEventListener('click', deleteAllLocalData);
els.closeDrawer.addEventListener('click', closeDrawer);
els.drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
els.privacyAgreeCheck?.addEventListener('change', () => { els.privacyAccept.disabled = !els.privacyAgreeCheck.checked; });
els.privacyAccept?.addEventListener('click', () => { localStorage.setItem('sstc.privacyAccepted.v1', '1'); els.privacyModal?.classList.add('hidden'); });
showPrivacyModalIfNeeded();

await load({ refresh: false });
setTimeout(() => requestCoverage(monthKey(state.anchorDate)), 900);
setTimeout(() => requestDeepBackgroundCoverage(), 3500);
setInterval(() => load(), 60_000);
setInterval(() => triggerSync(monthKey(state.anchorDate)), 60 * 60_000);


function showPrivacyModalIfNeeded() {
  if (!els.privacyModal) return;
  if (localStorage.getItem('sstc.privacyAccepted.v1') === '1') return;
  els.privacyModal.classList.remove('hidden');
}

async function load({ refresh = false } = {}) {
  try {
    const response = await fetch(`/api/events${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
    const payload = await response.json();
    state.userState = payload.userState || state.userState;
    state.events = (payload.events || []).map(enrichEvent).filter(e => e.dateObj && isValidEvent(e));
    state.lastRun = payload.lastRun;
    state.syncRunning = Boolean(payload.syncRunning);
    state.lastSyncMessage = payload.lastSyncMessage || '';
    updateFilterOptions();
    render();
    if (state.syncRunning) setTimeout(() => load(), 5000);
  } catch (error) {
    els.syncStatus.textContent = 'Kunde inte läsa lokal data';
    els.syncDot.className = 'sync-dot problem';
  }
}


async function openLoginWindow() {
  try {
    els.loginButton.disabled = true;
    els.loginButton.textContent = 'Öppnar…';
    state.lastSyncMessage = 'Öppnar SchoolSoft-inloggning i ett separat fönster…';
    renderSyncStatus();
    const response = await fetch('/api/open-login', { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    state.lastSyncMessage = result.started === false
      ? (result.reason || 'Inloggningsfönster är redan öppet.')
      : 'Logga in i SchoolSoft-fönstret. När det är klart kan du klicka Synka nu.';
  } catch (error) {
    state.lastSyncMessage = `Kunde inte öppna inloggning: ${error.message}`;
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = 'Logga in';
    renderSyncStatus();
  }
}

async function triggerSync(month = '', { interactive = false } = {}) {
  if (state.syncRunning) return;
  state.syncRunning = true;
  state.lastSyncMessage = month ? `Hämtar mer data för ${month}…` : 'Synkar i bakgrunden…';
  renderSyncStatus();
  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (interactive) params.set('interactive', '1');
    const response = await fetch(`/api/sync${params.toString() ? `?${params.toString()}` : ''}`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    if (result && result.started === false && result.reason) state.lastSyncMessage = result.reason;
  } catch (error) {
    state.lastSyncMessage = 'Synkning kunde inte startas, men lokal data visas.';
  }
  setTimeout(() => load(), 4000);
}

function enrichEvent(event) {
  const dateObj = event.date ? new Date(`${event.date}T00:00:00`) : null;
  const type = cleanText(event.type || 'Oklar') || 'Oklar';
  // Do not guess subjects from prose. Trust only structured SchoolSoft fields such as
  // activity: MA / activity: SV, or explicit subject/course fields from the API.
  const subject = extractStructuredSubject(event);
  const description = cleanDescription(event.description || event.rawText || '');
  const rawText = cleanDescription(event.rawText || '');
  const baseTitle = chooseBaseTitle(event, subject, type, description, rawText);
  const title = withSubjectPrefix(baseTitle, subject);
  const result = inferResult(event, rawText, description);
  return {
    ...event,
    dateObj,
    title,
    baseTitle,
    description,
    rawText,
    type,
    subject,
    subjectAbbr: subjectAbbr(subject),
    studentName: cleanText(event.studentName || ''),
    teacher: cleanText(event.teacher || ''),
    room: cleanText(event.room || event.location || ''),
    classOrGroup: cleanText(event.classOrGroup || ''),
    result,
    userNote: cleanDescription(event.userNote || ''),
    done: Boolean(event.done),
    deleted: Boolean(event.deleted),
    deletedAt: event.deletedAt || '',
    dayNote: cleanDescription(event.dayNote || ''),
    dayDone: Boolean(event.dayDone),
    isUserEvent: Boolean(event.isUserEvent || event.source === 'manual'),
    isImportant: isImportantEvent({ ...event, title, description, rawText, type })
  };
}

function chooseBaseTitle(event, subject, type, description, rawText) {
  const candidates = [event.title, event.name, event.summary]
    .map(v => cleanTitleText(v || ''))
    .filter(Boolean);
  let title = candidates.find(t => !isBadTitle(t, description, rawText)) || '';
  if (!title) title = firstUsefulSentence(description || rawText);
  if (!title || isMostlyMetadata(title)) title = type && type !== 'Oklar' ? type : 'Händelse';
  title = stripSubjectPrefix(title, subject);
  title = stripDateAndTime(title);
  return smartTruncate(title, 92);
}

function isBadTitle(title, description, rawText) {
  const t = normalize(title);
  if (!t || ['description', 'name', 'title', 'text', 'information', 'content', 'body'].includes(t)) return true;
  if (title.length > 130) return true;
  if (normalize(description || rawText).startsWith(t) && title.length > 90) return true;
  return false;
}

function firstUsefulSentence(text) {
  const cleaned = cleanDescription(text).replace(/\n+/g, ' ');
  const parts = cleaned.split(/(?<=[.!?])\s+|\s+[–—|]\s+|\.\.\./).map(x => x.trim()).filter(Boolean);
  const useful = parts.find(p => p.length >= 4 && !isMostlyMetadata(p));
  return useful || cleaned.slice(0, 80).trim();
}

function isMostlyMetadata(text) {
  return /^(date|datum|start|end|description|name|title|subject|course|id|true|false|active)\b/i.test(cleanText(text));
}

function isImportantEvent(e) {
  if (e.status === 'changed' || e.status === 'removed') return true;
  if (e.type && e.type !== 'Oklar') return true;
  const text = normalize(`${e.title || ''} ${e.description || ''} ${e.rawText || ''}`);
  return IMPORTANT_WORDS.some(word => text.includes(normalize(word)));
}

function updateFilterOptions() {
  setOptions(els.studentFilter, 'Alla elever', unique(state.events.map(e => e.studentName).filter(Boolean)), state.student);
  setOptions(els.typeFilter, 'Alla typer', unique(state.events.map(e => e.type).filter(Boolean)), state.type);
  setOptions(els.subjectFilter, 'Alla ämnen', sortSubjects(unique(state.events.map(e => e.subject).filter(Boolean))), state.subject);
  setOptions(els.teacherFilter, 'Alla lärare', unique(state.events.map(e => e.teacher).filter(Boolean)), state.teacher);
  setOptions(els.roomFilter, 'Alla rum', unique(state.events.map(e => e.room).filter(Boolean)), state.room);
  renderLegend();
  updateIcsLink();
}

function setOptions(select, firstLabel, values, selected) {
  const current = selected || select.value;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
  select.value = values.includes(current) ? current : '';
}

function render() {
  state.filtered = state.events
    .filter(e => scopeAllows(e))
    .filter(e => state.student ? e.studentName === state.student : true)
    .filter(e => state.type ? e.type === state.type : true)
    .filter(e => state.subject ? e.subject === state.subject : true)
    .filter(e => state.teacher ? e.teacher === state.teacher : true)
    .filter(e => state.room ? e.room === state.room : true)
    .filter(e => searchAllows(e))
    .sort(compareEvents);

  for (const [name, view] of Object.entries(els.views)) view.classList.toggle('hidden', name !== state.view);
  for (const button of document.querySelectorAll('.view-button')) button.classList.toggle('active', button.dataset.view === state.view);
  els.emptyState.classList.toggle('hidden', state.events.length > 0);

  updateMetrics();
  renderSyncStatus();
  renderPeriodTitle();
  renderSelectedDatePill();
  renderLegend();
  updateIcsLink();
  renderSelectionBar();

  if (state.view === 'month') renderMonth();
  if (state.view === 'week') renderWeek();
  if (state.view === 'day') renderDay();
  if (state.view === 'list') renderList();
  if (state.view === 'history') renderHistory();
}

function scopeAllows(event) {
  if (state.scope === 'trash') return Boolean(event.deleted);
  if (event.deleted) return false;
  if (state.scope === 'all') return event.status !== 'removed';
  if (state.scope === 'changed') return event.status === 'changed' || event.status === 'removed';
  return event.status !== 'removed' && event.isImportant;
}

function searchAllows(event) {
  const q = normalize(state.search.trim());
  if (!q) return true;
  return normalize([event.title, event.description, event.subject, event.studentName, event.teacher, event.room, event.type, event.rawText, event.result?.text].join(' ')).includes(q);
}

function updateMetrics() {
  const today = startOfDay(new Date());
  const activeImportant = state.events.filter(e => !e.deleted && e.status !== 'removed' && e.isImportant);
  const upcoming = activeImportant.filter(e => e.dateObj >= today);
  els.upcomingCount.textContent = upcoming.length;
  els.weekCount.textContent = upcoming.filter(e => e.dateObj < addDays(today, 7)).length;

  const heavyDay = computeHeaviestDayInSelectedWeek(activeImportant, state.selectedDate || state.anchorDate);
  els.heavyWeek.textContent = heavyDay.count
    ? `v.${heavyDay.weekNo} · ${fmt.dayMonth.format(heavyDay.date)} · ${heavyDay.count} händelse${heavyDay.count === 1 ? '' : 'r'}`
    : `v.${heavyDay.weekNo} · ${formatDateSpan(heavyDay.start, heavyDay.end)} · lugn vecka`;
  els.lastRun.textContent = state.lastRun?.finishedAt ? formatTimeAgo(new Date(state.lastRun.finishedAt)) : 'Aldrig';

  const coverage = state.lastRun?.coverage;
  els.coverageText.textContent = coverage?.from && coverage?.to
    ? `Hämtad data täcker ungefär ${coverage.from} till ${coverage.to}. Bläddrar du utanför intervallet hämtas mer data i bakgrunden.`
    : 'Visar senast hämtade SchoolSoft-data direkt. Ny data hämtas i bakgrunden utan laddskärm.';
}

function computeHeaviestDayInSelectedWeek(events, anchor) {
  const start = startOfWeek(anchor || new Date());
  const end = addDays(start, 6);
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i)); // school days only
  const scored = days.map(date => {
    const items = events.filter(e => sameDay(e.dateObj, date));
    const score = items.reduce((sum, e) => sum + workloadWeight(e), 0);
    return { date, items, count: items.length, score };
  }).sort((a, b) => b.score - a.score || b.count - a.count || a.date - b.date);
  const best = scored[0] || { date: start, items: [], count: 0, score: 0 };
  return { ...best, start, end, weekNo: isoWeekNumber(start) };
}

function computeSelectedWeekWorkload(events, anchor) {
  const start = startOfWeek(anchor || new Date());
  const end = addDays(start, 6);
  const items = events.filter(e => e.dateObj >= start && e.dateObj <= end && !isWeekend(e.dateObj));
  const score = items.reduce((sum, e) => sum + workloadWeight(e), 0);
  return { start, end, count: items.length, score, weekNo: isoWeekNumber(start) };
}

function schoolYearRange(date) {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 7 ? y : y - 1;
  return { start: new Date(startYear, 7, 1), end: new Date(startYear + 1, 6, 31, 23, 59, 59) };
}

function workloadWeight(event) {
  const t = normalize(`${event.type} ${event.title}`);
  if (/nationella|national/.test(t)) return 3;
  if (/prov|test|assessment|examination|exam/.test(t)) return 2.5;
  if (/inlamning|inlämning|redovisning|seminarium/.test(t)) return 2;
  return 1;
}

function renderSelectionBar() {
  if (!els.selectionBar) return;
  const ids = [...state.selectedEventIds].filter(id => state.events.some(e => e.id === id));
  state.selectedEventIds = new Set(ids);
  if (!ids.length) {
    els.selectionBar.classList.add('hidden');
    els.selectionBar.innerHTML = '';
    return;
  }
  const trashMode = state.scope === 'trash';
  els.selectionBar.classList.remove('hidden');
  els.selectionBar.innerHTML = `
    <strong>${ids.length} valda</strong>
    <span class="selection-hint">Shift-klicka händelser för att välja fler. Shift-klicka en dag för att välja alla den dagen.</span>
    <button class="button subtle compact" data-bulk-done="1">Markera klara</button>
    ${trashMode ? `<button class="button subtle compact" data-bulk-restore="1">Återställ</button>` : `<button class="button danger compact" data-bulk-delete="1">Flytta till papperskorg</button>`}
    <button class="button subtle compact" data-clear-selection="1">Rensa val</button>`;
}


function renderSyncStatus() {
  els.syncNow.disabled = state.syncRunning;
  els.syncNow.textContent = state.syncRunning ? 'Synkar…' : 'Synka nu';
  els.syncStatus.textContent = state.syncRunning ? (state.lastSyncMessage || 'Synkar i bakgrunden…') : (state.lastSyncMessage || 'Redo');
  const problem = /misslyck|kunde inte|login|logga/i.test(state.lastSyncMessage || '');
  els.syncDot.className = `sync-dot ${state.syncRunning ? 'running' : problem ? 'problem' : 'ready'}`;
}

function renderPeriodTitle() {
  if (state.view === 'month') els.periodTitle.textContent = capitalize(fmt.monthYear.format(state.anchorDate));
  if (state.view === 'week') {
    const start = startOfWeek(state.anchorDate);
    const end = addDays(start, 6);
    els.periodTitle.textContent = `${fmt.dayMonth.format(start)} – ${fmt.dayMonth.format(end)}`;
  }
  if (state.view === 'day') els.periodTitle.textContent = capitalize(fmt.fullDate.format(state.anchorDate));
  if (state.view === 'list') els.periodTitle.textContent = 'Kommande lista';
  if (state.view === 'history') els.periodTitle.textContent = 'Historik';
}

function renderSelectedDatePill() {
  if (!els.selectedDatePill) return;
  const d = state.selectedDate || state.anchorDate;
  els.selectedDatePill.textContent = `Vald dag: ${fmt.dayMonth.format(d)}`;
}

function renderMonth() {
  const first = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const today = startOfDay(new Date());
  els.views.month.innerHTML = `
    <div class="weekday-row with-week-numbers"><span class="week-label-head">v.</span>${['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => `<span>${d}</span>`).join('')}</div>
    <div class="month-grid-with-weeks">
      ${weeks.map(week => `<div class="month-week-row"><button class="week-number-cell" title="Vecka ${isoWeekNumber(week[0])}" data-week-start="${isoDate(week[0])}">v.${isoWeekNumber(week[0])}</button>${week.map(day => renderMonthCell(day, today)).join('')}</div>`).join('')}
    </div>`;
  ensureCoverageForVisibleRange(days[0], days[days.length - 1]);
}

function renderMonthCell(day, today) {
  const outside = day.getMonth() !== state.anchorDate.getMonth();
  const key = isoDate(day);
  if (outside) {
    return `<article class="month-cell outside blank-month-cell" aria-hidden="true" data-outside-day="${key}"></article>`;
  }
  const events = state.filtered.filter(e => sameDay(e.dateObj, day) && e.status !== 'removed');
  const max = 4;
  const hidden = Math.max(0, events.length - max);
  const completed = isDayCompleted(key, events);
  const note = dayNoteFor(key);
  const classes = ['month-cell', isWeekend(day) ? 'weekend' : '', sameDay(day, today) ? 'today' : '', sameDay(day, state.selectedDate) ? 'selected-day' : '', events.length >= 4 ? 'busy' : '', completed ? 'completed-day' : '', note ? 'has-note' : ''].filter(Boolean).join(' ');
  return `<article class="${classes}" data-day="${key}">
    <button class="day-button" data-open-day="${key}" aria-label="Visa ${events.length} händelser ${key}">
      <span class="day-number">${day.getDate()}</span>
      ${events.length ? `<span class="day-count">${events.length}</span>` : ''}${note ? `<span class="day-note-dot" title="Egen anteckning">•</span>` : ''}${completed ? `<span class="day-done-mark" title="Klart">✓</span>` : ''}
    </button>
    <div class="cell-events">
      ${events.slice(0, max).map(event => renderCompactEvent(event)).join('')}
      ${hidden ? `<button class="more-button" data-open-day="${key}">+${hidden} fler</button>` : ''}
    </div>
  </article>`;
}

function renderWeek() {
  const start = startOfWeek(state.anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  els.views.week.innerHTML = `<div class="week-grid">${days.map(day => {
    const events = state.filtered.filter(e => sameDay(e.dateObj, day) && e.status !== 'removed');
    const classes = ['week-column', events.length ? 'has-events' : '', isWeekend(day) ? 'weekend' : '', sameDay(day, state.selectedDate) ? 'selected-day' : ''].filter(Boolean).join(' ');
    return `<article class="${classes}">
      <button class="week-heading" data-open-day="${isoDate(day)}">
        <span>${capitalize(fmt.weekdayShort.format(day))}</span><strong>${day.getDate()}</strong><small>${fmt.shortMonth.format(day)}</small>${events.length ? `<em>${events.length}</em>` : ''}
      </button>
      <div class="week-events">${events.map(renderWeekEvent).join('') || '<p class="muted empty-day">Inget.</p>'}</div>
    </article>`;
  }).join('')}</div>`;
  ensureCoverageForVisibleRange(days[0], days[6]);
}

function renderDay() {
  const events = state.filtered.filter(e => sameDay(e.dateObj, state.anchorDate) && e.status !== 'removed');
  const key = isoDate(state.anchorDate);
  els.views.day.innerHTML = `<section class="day-focus">
    <div class="day-focus-header"><span>${capitalize(fmt.weekdayLong.format(state.anchorDate))}</span><strong>${state.anchorDate.getDate()}</strong><span>${capitalize(fmt.monthYear.format(state.anchorDate))}</span></div>
    ${renderDayTools(key)}
    <div class="agenda-list">${events.map(e => renderAgendaItem(e, { showDate: false })).join('') || '<section class="empty compact"><h2>Inget den här dagen</h2><p>Bläddra till en annan dag, eller lägg till en egen händelse ovan.</p></section>'}</div>
  </section>`;
  ensureCoverageForVisibleRange(state.anchorDate, state.anchorDate);
}

function renderList() {
  const today = startOfDay(new Date());
  const events = state.filtered.filter(e => e.status !== 'removed' && e.dateObj >= addDays(today, -1));
  els.views.list.innerHTML = renderGroupedAgenda(events, 'Inga kommande händelser matchar filtren.');
}

function renderHistory() {
  const today = startOfDay(new Date());
  const events = [...state.filtered].filter(e => e.dateObj < today || state.scope === 'changed').sort((a, b) => b.dateObj - a.dateObj || compareEvents(a, b));
  const byMonth = groupBy(events, e => e.date.slice(0, 7));
  els.views.history.innerHTML = Object.entries(byMonth).map(([month, items]) => {
    const label = capitalize(fmt.monthYear.format(new Date(`${month}-01T00:00:00`)));
    return `<section class="month-history"><div class="section-heading"><h2>${escapeHtml(label)}</h2><span>${items.length} händelse${items.length === 1 ? '' : 'r'}</span></div><div class="agenda-list">${items.map(e => renderAgendaItem(e, { showDate: true })).join('')}</div></section>`;
  }).join('') || `<section class="empty compact"><h2>Ingen historik matchar filtren.</h2></section>`;
}

function renderGroupedAgenda(events, emptyText) {
  const groups = groupBy(events.sort(compareEvents), e => e.date);
  return Object.entries(groups).map(([date, items]) => {
    const d = new Date(`${date}T00:00:00`);
    return `<section class="agenda-day"><div class="section-heading"><h2>${capitalize(fmt.fullDate.format(d))}</h2><span>${items.length} händelse${items.length === 1 ? '' : 'r'}</span></div><div class="agenda-list">${items.map(e => renderAgendaItem(e, { showDate: false })).join('')}</div></section>`;
  }).join('') || `<section class="empty compact"><h2>${escapeHtml(emptyText)}</h2></section>`;
}

function renderCompactEvent(event) {
  return `<button class="compact-event ${event.done ? 'done-event' : ''} ${state.selectedEventIds.has(event.id) ? 'selected-event' : ''}" style="${eventStyle(event)}" data-event-id="${escapeAttr(event.id)}" title="${escapeAttr(event.title)}">
    ${event.startTime ? `<span>${escapeHtml(event.startTime)}</span>` : ''}${escapeHtml(smartTruncate(event.title, 54))}
  </button>`;
}

function renderWeekEvent(event) {
  const desc = event.description ? smartTruncate(event.description, 115) : '';
  return `<button class="week-event ${event.done ? 'done-event' : ''} ${state.selectedEventIds.has(event.id) ? 'selected-event' : ''}" style="${eventStyle(event)}" data-event-id="${escapeAttr(event.id)}">
    <div class="event-line">${event.subjectAbbr ? `<strong>${escapeHtml(event.subjectAbbr)}</strong>` : ''}<span>${escapeHtml(event.type)}</span>${event.startTime ? `<time>${escapeHtml(event.startTime)}</time>` : ''}${event.done ? `<em>Klart</em>` : ''}${event.userNote ? `<em>Anteckning</em>` : ''}</div>
    <h3>${escapeHtml(event.title)}</h3>
    ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
  </button>`;
}

function renderAgendaItem(event, { showDate = true } = {}) {
  const date = event.dateObj;
  const chips = [event.type, event.studentName, event.subject, event.teacher, event.room].filter(Boolean).map(value => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  const resultChip = event.result?.short ? `<span class="chip result-chip">${escapeHtml(event.result.short)}</span>` : '';
  const doneChip = event.done ? '<span class="chip done-chip">Klart</span>' : '';
  const noteChip = event.userNote ? '<span class="chip note-chip">Anteckning</span>' : '';
  return `<article class="agenda-item status-${escapeAttr(event.status || 'active')} ${event.done ? 'done-event' : ''} ${state.selectedEventIds.has(event.id) ? 'selected-event' : ''}" style="${eventStyle(event)}">
    <button class="agenda-main ${showDate ? '' : 'no-date'}" data-event-id="${escapeAttr(event.id)}">
      ${showDate ? `<time><strong>${date.getDate()}</strong><span>${fmt.shortMonth.format(date)}</span>${event.startTime ? `<em>${escapeHtml(event.startTime)}</em>` : ''}</time>` : ''}
      <div>
        <div class="chips">${chips}${doneChip}${noteChip}${resultChip}</div>
        <h3>${escapeHtml(event.title)}</h3>
        ${event.description ? `<p>${escapeHtml(smartTruncate(event.description, 230))}</p>` : ''}
      </div>
    </button>
  </article>`;
}

function renderLegend() {
  const keys = unique(state.events.map(e => colorLabel(e)).filter(Boolean));
  els.legend.innerHTML = keys.map(key => `<span class="legend-item" style="color:${escapeAttr(colorForKey(key))}"><i></i>${escapeHtml(key)}</span>`).join('') || '<p class="muted">Färgnyckel visas när data finns.</p>';
}

function bindDynamicClicks() {
  document.querySelectorAll('[data-event-id]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => {
      const id = e.currentTarget.dataset.eventId;
      const event = state.events.find(x => x.id === id);
      if (e.shiftKey) {
        e.preventDefault();
        toggleSelectedEvent(id);
        return;
      }
      const fromDayKey = e.currentTarget.closest('.drawer-agenda') ? state.activeDayDrawerKey : '';
      if (event) {
        setSelectedDate(event.date, { rerender: true });
        openEventDrawer(event, { backDayKey: fromDayKey || event.date });
      }
    });
  });
  document.querySelectorAll('[data-week-start]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => {
      state.anchorDate = new Date(`${e.currentTarget.dataset.weekStart}T00:00:00`);
      setView('week');
    });
  });
  document.querySelectorAll('[data-open-day]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => {
      const day = e.currentTarget.dataset.openDay;
      if (e.shiftKey) {
        e.preventDefault();
        toggleDaySelection(day);
        return;
      }
      setSelectedDate(day, { rerender: true });
      openDayDrawer(day);
    });
  });
  document.querySelectorAll('[data-day]').forEach(cell => {
    if (cell.dataset.boundDaySelect) return;
    cell.dataset.boundDaySelect = '1';
    cell.addEventListener('click', e => {
      if (e.target.closest('button,[data-event-id],a,input,textarea,select,label')) return;
      setSelectedDate(cell.dataset.day, { rerender: true });
    });
  });
  document.querySelectorAll('[data-back-day]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => openDayDrawer(e.currentTarget.dataset.backDay));
  });
  document.querySelectorAll('[data-event-done]').forEach(input => {
    if (input.dataset.boundChange) return;
    input.dataset.boundChange = '1';
    input.addEventListener('change', e => setEventDone(e.currentTarget.dataset.eventDone, e.currentTarget.checked));
  });
  document.querySelectorAll('[data-save-event-note]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => saveEventNote(e.currentTarget.dataset.saveEventNote));
  });
  document.querySelectorAll('[data-event-delete]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => deleteEvents([e.currentTarget.dataset.eventDelete]));
  });
  document.querySelectorAll('[data-event-restore]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => restoreEvents([e.currentTarget.dataset.eventRestore]));
  });
  document.querySelectorAll('[data-day-done]').forEach(input => {
    if (input.dataset.boundChange) return;
    input.dataset.boundChange = '1';
    input.addEventListener('change', e => setDayDone(e.currentTarget.dataset.dayDone, e.currentTarget.checked));
  });
  document.querySelectorAll('[data-save-day-note]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => saveDayNote(e.currentTarget.dataset.saveDayNote));
  });
  document.querySelectorAll('[data-new-event-for-date]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', e => openManualEventDrawer(e.currentTarget.dataset.newEventForDate));
  });
  document.querySelectorAll('[data-manual-event-form]').forEach(form => {
    if (form.dataset.boundSubmit) return;
    form.dataset.boundSubmit = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      addManualEvent(e.currentTarget).catch(err => alert(`Kunde inte lägga till händelse: ${err.message}`));
    });
  });
  document.querySelectorAll('[data-trash-select-all]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => {
      const ids = state.events.filter(e => e.deleted).map(e => e.id);
      const allSelected = ids.every(id => state.selectedEventIds.has(id));
      ids.forEach(id => allSelected ? state.selectedEventIds.delete(id) : state.selectedEventIds.add(id));
      openTrashDrawer();
    });
  });
  document.querySelectorAll('[data-restore-all-trash]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => restoreEvents(state.events.filter(e => e.deleted).map(e => e.id)));
  });
  document.querySelectorAll('input[name="date"]').forEach(input => {
    if (input.dataset.boundChange) return;
    input.dataset.boundChange = '1';
    input.addEventListener('change', e => { if (/^20\d{2}-\d{2}-\d{2}$/.test(e.currentTarget.value)) { setSelectedDate(e.currentTarget.value); render(); } });
  });
  document.querySelectorAll('[data-bulk-delete]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => deleteEvents([...state.selectedEventIds]));
  });
  document.querySelectorAll('[data-bulk-restore]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => restoreEvents([...state.selectedEventIds]));
  });
  document.querySelectorAll('[data-bulk-done]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => bulkDone([...state.selectedEventIds]));
  });
  document.querySelectorAll('[data-clear-selection]').forEach(button => {
    if (button.dataset.boundClick) return;
    button.dataset.boundClick = '1';
    button.addEventListener('click', () => { state.selectedEventIds.clear(); render(); });
  });
}

function toggleSelectedEvent(id) {
  if (!id) return;
  if (state.selectedEventIds.has(id)) state.selectedEventIds.delete(id);
  else state.selectedEventIds.add(id);
  const inTrashDrawer = els.drawerTitle?.textContent === 'Papperskorg' && !els.drawer.classList.contains('hidden');
  if (inTrashDrawer) {
    renderSelectionBar();
    openTrashDrawer();
  } else {
    render();
  }
}

function toggleDaySelection(dayKey) {
  const ids = eventsForDayKey(dayKey).map(e => e.id);
  if (!ids.length) return;
  const allSelected = ids.every(id => state.selectedEventIds.has(id));
  for (const id of ids) allSelected ? state.selectedEventIds.delete(id) : state.selectedEventIds.add(id);
  render();
}

async function deleteEvents(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  if (!confirm(`Flytta ${ids.length} händelse${ids.length === 1 ? '' : 'r'} till papperskorgen? Du kan återställa dem senare via knappen Papperskorg.`)) return;
  const now = new Date().toISOString();
  state.userState.deletedEvents ||= {};
  for (const id of ids) {
    const event = state.events.find(e => e.id === id);
    if (event) { event.deleted = true; event.deletedAt = now; }
    state.userState.deletedEvents[id] = { deletedAt: now };
    state.selectedEventIds.delete(id);
  }
  const backDay = state.activeDayDrawerKey;
  render();
  if (backDay) openDayDrawer(backDay);
  else closeDrawer();
  try {
    await postJson('/api/trash-events', { ids });
    state.lastSyncMessage = `${ids.length} händelse${ids.length === 1 ? '' : 'r'} flyttad${ids.length === 1 ? '' : 'e'} till papperskorgen.`;
    renderSyncStatus();
  } catch (error) {
    // Keep the optimistic UI state so the event disappears immediately. The server endpoint
    // should persist this, but this prevents a failed request from visually undoing the action.
    state.lastSyncMessage = `Papperskorgen kunde inte sparas just nu (${error.message}), men ändringen visas lokalt tills sidan laddas om.`;
    renderSyncStatus();
  }
}

async function restoreEvents(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  state.userState.deletedEvents ||= {};
  for (const id of ids) {
    const event = state.events.find(e => e.id === id);
    if (event) { event.deleted = false; event.deletedAt = ''; }
    delete state.userState.deletedEvents[id];
    state.selectedEventIds.delete(id);
  }
  render();
  if (els.drawer && !els.drawer.classList.contains('hidden')) openTrashDrawer();
  try {
    await postJson('/api/restore-events', { ids });
    state.lastSyncMessage = `${ids.length} händelse${ids.length === 1 ? '' : 'r'} återställd${ids.length === 1 ? '' : 'a'}.`;
    renderSyncStatus();
  } catch (error) {
    state.lastSyncMessage = `Återställningen kunde inte sparas just nu (${error.message}), men ändringen visas lokalt tills sidan laddas om.`;
    renderSyncStatus();
  }
}

async function bulkDone(ids) {
  ids = ids.filter(Boolean);
  for (const id of ids) await postJson('/api/event-done', { id, done: true });
  state.selectedEventIds.clear();
  await load();
}



function formatDateRange(event) {
  const start = capitalize(fmt.fullDate.format(event.dateObj));
  if (!event.endDate || event.endDate === event.date) return start;
  const endObj = new Date(`${event.endDate}T00:00:00`);
  if (Number.isNaN(endObj.getTime())) return start;
  return `${start} – ${capitalize(fmt.fullDate.format(endObj))}`;
}

function openEventDrawer(event, { backDayKey = '' } = {}) {
  const rows = [
    ['Datum', formatDateRange(event)],
    ['Tid', event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ''}` : 'Heldag/okänd tid'],
    ['Typ', event.type],
    ['Elev', event.studentName],
    ['Ämne', event.subject],
    ['Lärare', event.teacher],
    ['Rum/sal', event.room],
    ['Grupp/klass', event.classOrGroup],
    ['Status', event.status && event.status !== 'active' ? event.status : 'Aktiv'],
    ['Källa', event.source]
  ].filter(([, value]) => value);

  els.drawerEyebrow.textContent = [event.type, event.subject].filter(Boolean).join(' · ') || 'Händelse';
  els.drawerTitle.textContent = event.title;
  els.drawerContent.innerHTML = `
    ${backDayKey ? `<button class="button subtle compact drawer-back-button" data-back-day="${escapeAttr(backDayKey)}">← Tillbaka till dagen</button>` : ''}
    <div class="detail-chips">${[event.studentName, event.subject, event.teacher, event.room, event.type, event.done ? 'Klart' : 'Ej klart', event.deleted ? 'I papperskorg' : ''].filter(Boolean).map(x => `<span class="chip">${escapeHtml(x)}</span>`).join('')}</div>
    <section class="detail-section user-tools"><label class="check-row"><input type="checkbox" data-event-done="${escapeAttr(event.id)}" ${event.done ? 'checked' : ''}> Markera som klar</label><label>Anteckning<textarea data-event-note="${escapeAttr(event.id)}" rows="2" placeholder="Kort egen anteckning…">${escapeHtml(event.userNote || '')}</textarea></label><div class="tool-row"><button class="button subtle compact" data-save-event-note="${escapeAttr(event.id)}">Spara anteckning</button></div></section>
    ${event.result?.text ? `<section class="detail-section result-section"><h3>Resultat</h3><p>${escapeHtml(event.result.text)}</p></section>` : ''}
    ${event.description ? `<section class="detail-section"><h3>Beskrivning</h3>${formatDescription(event.description)}</section>` : ''}
    <section class="detail-section"><h3>Detaljer</h3><dl>${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></section>
    ${event.sourceUrl ? `<a class="button subtle wide" href="${escapeAttr(event.sourceUrl)}" target="_blank" rel="noreferrer">Öppna i SchoolSoft</a>` : ''}
    ${event.rawText && event.rawText !== event.description ? `<details class="raw-details"><summary>Visa ursprunglig text</summary>${formatDescription(event.rawText)}</details>` : ''}
    <section class="detail-section danger-zone">${event.deleted ? `<button class="button subtle wide" data-event-restore="${escapeAttr(event.id)}">Återställ från papperskorgen</button>` : `<button class="button danger wide" data-event-delete="${escapeAttr(event.id)}">Flytta till papperskorg</button>`}</section>
  `;
  showDrawer();
}

function openDayDrawer(dayKey) {
  setSelectedDate(dayKey, { rerender: true });
  state.activeDayDrawerKey = dayKey;
  const d = new Date(`${dayKey}T00:00:00`);
  const events = state.filtered.filter(e => sameDay(e.dateObj, d) && e.status !== 'removed').sort(compareEvents);
  els.drawerEyebrow.textContent = `${events.length} händelse${events.length === 1 ? '' : 'r'}`;
  els.drawerTitle.textContent = capitalize(fmt.fullDate.format(d));
  els.drawerContent.innerHTML = `${renderDayTools(dayKey)}${events.length
    ? `<div class="agenda-list drawer-agenda">${events.map(e => renderAgendaItem(e, { showDate: false })).join('')}</div>`
    : '<section class="empty compact"><h2>Inget den här dagen</h2><p>Lägg till en egen händelse eller anteckning ovan.</p></section>'}`;
  showDrawer();
}

function openTrashDrawer() {
  state.activeDayDrawerKey = '';
  const events = state.events.filter(e => e.deleted).sort((a, b) => b.dateObj - a.dateObj || compareEvents(a, b));
  els.drawerEyebrow.textContent = `${events.length} händelse${events.length === 1 ? '' : 'r'}`;
  els.drawerTitle.textContent = 'Papperskorg';
  els.drawerContent.innerHTML = events.length ? `
    <section class="trash-actions">
      <button class="button subtle compact" data-trash-select-all="1">Välj alla</button>
      <button class="button subtle compact" data-bulk-restore="1">Återställ valda</button>
      <button class="button primary compact" data-restore-all-trash="1">Återställ alla</button>
    </section>
    <div class="agenda-list trash-list">${events.map(e => renderAgendaItem(e, { showDate: true })).join('')}</div>`
    : '<section class="empty compact"><h2>Papperskorgen är tom</h2><p>Händelser som du flyttar hit kan återställas senare.</p></section>';
  showDrawer();
}

function openManualEventDrawer(dayKey = isoDate(state.selectedDate || state.anchorDate)) {
  setSelectedDate(dayKey);
  els.drawerEyebrow.textContent = 'Egen händelse';
  els.drawerTitle.textContent = 'Ny händelse';
  els.drawerContent.innerHTML = `
    <form data-manual-event-form="${escapeAttr(dayKey)}" class="manual-event-form large-manual-form">
      <label>Titel <input name="title" required placeholder="Titel, t.ex. Plugga inför prov" autofocus /></label>
      <div class="form-grid"><label>Datum <input name="date" type="date" value="${escapeAttr(dayKey)}" /></label><label>Ämne <input name="subject" placeholder="MA, SV, EN…" /></label></div>
      <div class="form-grid"><label>Start <input name="startTime" type="time" /></label><label>Slut <input name="endTime" type="time" /></label></div>
      <div class="form-grid"><label>Typ <input name="type" placeholder="Egen händelse" /></label><label>Rum/sal <input name="room" placeholder="Valfritt" /></label></div>
      <label>Lärare <input name="teacher" placeholder="Valfritt" /></label>
      <label>Anteckning <textarea name="description" rows="3" placeholder="Valfri kort anteckning…"></textarea></label>
      <div class="tool-row"><button class="button primary" type="submit">Lägg till</button><button class="button subtle" type="button" data-back-day="${escapeAttr(dayKey)}">Visa dagen</button></div>
    </form>`;
  showDrawer();
}

function setSelectedDate(dayKeyOrDate, { rerender = false } = {}) {
  const d = dayKeyOrDate instanceof Date ? startOfDay(dayKeyOrDate) : new Date(`${dayKeyOrDate}T00:00:00`);
  if (!Number.isNaN(d.getTime())) {
    state.selectedDate = d;
    state.anchorDate = d;
    persist();
    renderSelectedDatePill();
    if (rerender) render();
  }
}

function showDrawer() {
  els.drawer.classList.remove('hidden');
  els.drawerBackdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    els.drawer.classList.add('open');
    els.drawerBackdrop.classList.add('open');
    bindDynamicClicks();
  });
}

function closeDrawer() {
  els.drawer.classList.remove('open');
  els.drawerBackdrop.classList.remove('open');
  setTimeout(() => {
    els.drawer.classList.add('hidden');
    els.drawerBackdrop.classList.add('hidden');
    state.activeDayDrawerKey = '';
  }, 180);
}

function setView(view) {
  state.view = view;
  persist();
  render();
  ensureCoverageForVisibleRange();
}

function movePeriod(direction) {
  const d = new Date(state.anchorDate);
  if (state.view === 'month' || state.view === 'history') d.setMonth(d.getMonth() + direction);
  else if (state.view === 'week' || state.view === 'list') d.setDate(d.getDate() + direction * 7);
  else d.setDate(d.getDate() + direction);
  state.anchorDate = startOfDay(d);
  persist();
  render();
  ensureCoverageForVisibleRange();
}

function ensureCoverageForVisibleRange(start = null, end = null) {
  const range = start && end ? { start, end } : visibleRange();
  const targetMonth = monthKey(state.anchorDate);
  const loadedMonths = new Set(state.lastRun?.loadedMonths || state.lastRun?.coverage?.loadedMonths || []);
  const wanted = monthsAround(targetMonth, 5, 5);
  if (!wanted.every(m => loadedMonths.has(m))) return requestCoverage(targetMonth);
}

function visibleRange() {
  if (state.view === 'month') {
    const first = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), 1);
    return { start: startOfWeek(first), end: addDays(startOfWeek(first), 41) };
  }
  if (state.view === 'week' || state.view === 'list') {
    const start = startOfWeek(state.anchorDate);
    return { start, end: addDays(start, 6) };
  }
  return { start: state.anchorDate, end: state.anchorDate };
}

function requestCoverage(month) {
  if (!month || state.requestedMonths.has(month)) return;
  state.requestedMonths.add(month);
  state.lastSyncMessage = `Hämtar mer data för ${month} i bakgrunden…`;
  renderSyncStatus();
  triggerSync(month, { interactive: false });
}

function requestDeepBackgroundCoverage() {
  const month = monthKey(state.selectedDate || state.anchorDate || new Date());
  triggerSync(month, { interactive: false });
}

function persist() {
  localStorage.setItem('sstc.view', state.view);
  localStorage.setItem('sstc.anchorDate', isoDate(state.anchorDate));
  localStorage.setItem('sstc.selectedDate', isoDate(state.selectedDate || state.anchorDate));
  localStorage.setItem('sstc.search', state.search);
  localStorage.setItem('sstc.student', state.student);
  localStorage.setItem('sstc.type', state.type);
  localStorage.setItem('sstc.subject', state.subject);
  localStorage.setItem('sstc.teacher', state.teacher);
  localStorage.setItem('sstc.room', state.room);
  localStorage.setItem('sstc.scope', state.scope);
  localStorage.setItem('sstc.colorBy', state.colorBy);
}

function updateIcsLink() {
  if (!els.icsLink) return;
  const params = new URLSearchParams();
  params.set('scope', state.scope);
  if (state.student) params.set('student', state.student);
  if (state.type) params.set('type', state.type);
  if (state.subject) params.set('subject', state.subject);
  if (state.teacher) params.set('teacher', state.teacher);
  if (state.room) params.set('room', state.room);
  if (state.search) params.set('q', state.search);
  const url = `${location.origin}/schoolsoft-tests.ics?${params.toString()}`;
  els.icsLink.value = url;
}

async function copyIcsLink() {
  updateIcsLink();
  try {
    await navigator.clipboard.writeText(els.icsLink.value);
    els.copyIcs.textContent = 'Kopierad';
  } catch {
    els.icsLink.select();
    document.execCommand('copy');
    els.copyIcs.textContent = 'Kopierad';
  }
  setTimeout(() => { els.copyIcs.textContent = 'Kopiera länk'; }, 1400);
}

function renderDayTools(dayKey) {
  const note = dayNoteFor(dayKey);
  const done = dayDoneFor(dayKey);
  return `<section class="day-tools compact-day-tools">
    <div class="day-tool-row">
      <label class="check-row"><input type="checkbox" data-day-done="${escapeAttr(dayKey)}" ${done ? 'checked' : ''}> Markera hela dagen som klar</label>
      <button class="button primary compact" data-new-event-for-date="${escapeAttr(dayKey)}">+ Ny händelse</button>
    </div>
    <label>Daganteckning<textarea data-day-note="${escapeAttr(dayKey)}" rows="2" placeholder="Kort anteckning…">${escapeHtml(note)}</textarea></label>
    <button class="button subtle compact" data-save-day-note="${escapeAttr(dayKey)}">Spara daganteckning</button>
  </section>`;
}

function dayNoteFor(dayKey) { return cleanDescription(state.userState?.dayNotes?.[dayKey] || ''); }
function dayDoneFor(dayKey) { return Boolean(state.userState?.dayDone?.[dayKey]); }
function eventsForDayKey(dayKey) { const d = new Date(`${dayKey}T00:00:00`); return state.filtered.filter(e => sameDay(e.dateObj, d) && e.status !== 'removed'); }
function isDayCompleted(dayKey, events = eventsForDayKey(dayKey)) {
  if (dayDoneFor(dayKey)) return true;
  return events.length > 0 && events.every(e => e.done);
}

function monthsAround(centerMonth, back, ahead) {
  const base = parseMonthKey(centerMonth) || new Date();
  const months = [];
  for (let i = -back; i <= ahead; i++) months.push(monthKey(addMonths(base, i)));
  return months;
}
function parseMonthKey(key) {
  if (!/^20\d{2}-\d{2}$/.test(String(key || ''))) return null;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function addMonths(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), 1); d.setMonth(d.getMonth() + n); return d; }

async function deleteAllLocalData() {
  const includeSession = confirm('Vill du även radera den sparade SchoolSoft-inloggningssessionen? Välj OK för att radera både kalenderdata och session, eller Avbryt för att bara radera kalenderdata/anteckningar.');
  const really = confirm(includeSession
    ? 'Detta raderar lokala händelser, anteckningar, egna händelser, papperskorg och den sparade inloggningssessionen på den här datorn. Fortsätta?'
    : 'Detta raderar lokala händelser, anteckningar, egna händelser och papperskorg på den här datorn. Fortsätta?');
  if (!really) return;
  try {
    await postJson('/api/delete-local-data', { includeSession });
    localStorage.removeItem('sstc.privacyAccepted.v1');
    state.events = [];
    state.filtered = [];
    state.userState = { eventNotes: {}, eventDone: {}, dayNotes: {}, dayDone: {}, manualEvents: [], deletedEvents: {} };
    state.lastRun = null;
    state.lastSyncMessage = includeSession
      ? 'Lokal data och sparad inloggningssession är raderade.'
      : 'Lokal kalenderdata är raderad.';
    render();
    showPrivacyModalIfNeeded();
  } catch (error) {
    state.lastSyncMessage = `Kunde inte radera lokal data: ${error.message}`;
    renderSyncStatus();
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function saveEventNote(id) {
  const textarea = document.querySelector(`[data-event-note="${CSS.escape(id)}"]`);
  await postJson('/api/event-note', { id, note: textarea?.value || '' });
  await load();
}
async function setEventDone(id, done) {
  await postJson('/api/event-done', { id, done });
  await load();
}
async function saveDayNote(date) {
  const textarea = document.querySelector(`[data-day-note="${CSS.escape(date)}"]`);
  await postJson('/api/day-note', { date, note: textarea?.value || '' });
  await load();
}
async function setDayDone(date, done) {
  await postJson('/api/day-done', { date, done });
  await load();
}
async function addManualEvent(form) {
  const data = new FormData(form);
  const date = String(data.get('date') || form.dataset.manualEventForm || isoDate(state.selectedDate || state.anchorDate));
  await postJson('/api/manual-event', {
    date,
    title: data.get('title') || '',
    subject: data.get('subject') || '',
    type: data.get('type') || 'Egen händelse',
    startTime: data.get('startTime') || '',
    endTime: data.get('endTime') || '',
    description: data.get('description') || '',
    teacher: data.get('teacher') || '',
    room: data.get('room') || ''
  });
  form.reset();
  setSelectedDate(date);
  await load();
  openDayDrawer(date);
}

function compareEvents(a, b) {
  return a.dateObj - b.dateObj || String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99')) || String(a.title).localeCompare(String(b.title), 'sv');
}

function eventStyle(event) {
  const color = colorForEvent(event);
  return `--event-color:${color};--event-bg:${hexToRgba(color, 0.10)};--event-bg-strong:${hexToRgba(color, 0.16)};`;
}

function colorLabel(event) {
  if (state.colorBy === 'subject') return event.subject || 'Ämne saknas';
  return event.type || 'Oklar typ';
}
function colorForEvent(event) { return colorForKey(colorLabel(event)); }
function colorForKey(key = 'Övrigt') {
  const override = explicitColorForLabel(key);
  if (override) return override;
  const labels = colorLabelsInStableOrder();
  let index = labels.indexOf(String(key));
  if (index < 0) {
    index = 0;
    for (const ch of String(key)) index = ((index << 5) - index + ch.charCodeAt(0)) | 0;
    index = Math.abs(index);
  }
  return PALETTE[index % PALETTE.length];
}

function explicitColorForLabel(key = '') {
  if (state.colorBy === 'subject') {
    const abbr = subjectAbbr(key);
    return SUBJECT_COLOR_OVERRIDES[abbr] || '';
  }
  const normalized = normalize(key);
  for (const [label, color] of Object.entries(TYPE_COLOR_OVERRIDES)) {
    if (normalized.includes(normalize(label))) return color;
  }
  return '';
}
function colorLabelsInStableOrder() {
  const raw = unique(state.events.map(e => state.colorBy === 'subject' ? (e.subject || 'Ämne saknas') : (e.type || 'Oklar typ')).filter(Boolean));
  const preferred = state.colorBy === 'subject' ? COMMON_SUBJECT_ORDER : COMMON_TYPE_ORDER;
  return [...raw].sort((a, b) => {
    const ai = preferred.indexOf(subjectAbbr(a) || a);
    const bi = preferred.indexOf(subjectAbbr(b) || b);
    if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
    return a.localeCompare(b, 'sv');
  });
}

function hexToRgba(hex, alpha) {
  const m = String(hex).match(/^#?([0-9a-f]{6})$/i);
  if (!m) return `rgba(66,87,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function cleanText(input = '') { return cleanGeneric(input, { preserveBreaks: false }); }
function cleanDescription(input = '') { return cleanGeneric(input, { preserveBreaks: true }); }

function cleanGeneric(input = '', { preserveBreaks = false } = {}) {
  let value = String(input ?? '');
  if (!value) return '';
  value = decodeEscapes(value);
  value = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  const el = document.createElement('textarea');
  el.innerHTML = value;
  value = el.value || value;
  value = decodeEscapes(value)
    .replace(/(^|[\s{|,])['"]?(description|name|title|subject|subjectCode|courseName|courseCode|course|activity|activityId|date|datum|startDate|endDate|start|end|allDay|text|information|content|body|summary|teacherName|teacher|className|groupName|teachingGroup|typeName|entityId|category|planningId)['"]?\s*:\s*['"]?/gi, '$1')
    .replace(/[{}\[\]]/g, ' ')
    .replace(/(^|\s)["']+|["']+(?=\s|$)/g, ' ')
    .replace(/\s*\|\s*/g, preserveBreaks ? '\n' : ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!preserveBreaks) value = value.replace(/\s+/g, ' ');
  return value;
}


function extractLabeledDescription(value) {
  const text = String(value || '');
  // JSON-ish: "description":"...", "startDate":...
  let m = text.match(/["']?description["']?\s*:\s*["']([\s\S]*?)["']\s*(?:[,|]\s*["']?(?:startDate|endDate|allDay|teacher|teacherName|teachingGroup|typeName|activity|activityId|entityId|category|planningId)["']?\s*:|$)/i);
  if (m && m[1]) return m[1];

  // Plain text lines: description: ...\nstartDate: ...
  m = text.match(/(?:^|[\n|])\s*["']?description["']?\s*:\s*([\s\S]*?)(?=\n\s*(?:startDate|endDate|allDay|teacher|teacherName|teachingGroup|typeName|activity|activityId|entityId|category|planningId)\s*:|$)/i);
  if (m && m[1]) return m[1];

  return '';
}

function decodeEscapes(value) {
  return String(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function cleanTitleText(text) {
  return stripDateAndTime(cleanText(text))
    .replace(/^(beskrivning|description|namn|name|titel|title)\b\s*/i, '')
    .trim();
}
function stripDateAndTime(text) {
  return cleanText(text)
    .replace(/^20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\s*/g, '')
    .replace(/^\d{1,2}[-/.]\d{1,2}(?:[-/.](?:20\d{2}|\d{2}))?\s*/g, '')
    .replace(/^\d{1,2}[:.]\d{2}(?:\s*[-–—]\s*\d{1,2}[:.]\d{2})?\s*/g, '')
    .trim();
}
function stripSubjectPrefix(title, subject) {
  const abbr = subjectAbbr(subject);
  const variants = [abbr, subject].filter(Boolean).map(escapeRegExp).join('|');
  return variants ? title.replace(new RegExp(`^(${variants})\\s*[:–—-]\\s*`, 'i'), '').trim() : title;
}
function withSubjectPrefix(title, subject) {
  const t = cleanTitleText(title) || 'Händelse';
  const abbr = subjectAbbr(subject);
  if (!abbr) return t;
  if (new RegExp(`^${escapeRegExp(abbr)}\\s*:`, 'i').test(t)) return t;
  return `${abbr}: ${t}`;
}

function extractStructuredSubject(event) {
  const direct = cleanSubjectValue(event.subject || event.activity || event.courseCode || event.subjectCode || event.courseName || event.subjectName || event.course || '');
  if (direct && (event.subjectSource === 'explicit' || event.activity || event.courseCode || event.subjectCode || event.courseName || event.subjectName || event.course)) return direct;

  // Safe fallback for old data already extracted before this patch: read a literal metadata
  // line like "activity: MA" from rawText/description. This is still structured metadata,
  // not a free-text guess from the assignment description.
  const structuredText = String(event.rawText || event.description || '');
  const match = structuredText.match(/(?:^|[\n|,\s])['"]?activity['"]?\s*:\s*['"]?([A-Za-zÅÄÖåäö]{1,8}\d?)/i)
    || structuredText.match(/(?:^|[\n|,\s])['"]?(?:subjectCode|courseCode)['"]?\s*:\s*['"]?([A-Za-zÅÄÖåäö]{1,8}\d?)/i);
  return match ? cleanSubjectValue(match[1]) : '';
}

function cleanSubjectValue(value = '') {
  const subject = cleanText(value);
  if (!subject) return '';
  const key = normalize(subject);
  if (/^(oklar|unknown|null|undefined|true|false|active|händelse|handelse)$/i.test(key)) return '';
  if (/\d{4}-\d{2}-\d{2}/.test(subject) || subject.length > 48) return '';
  if (IMPORTANT_WORDS.some(w => key === normalize(w))) return '';
  if (SUBJECT_ABBR.has(key)) return subject;
  for (const [name] of SUBJECT_ABBR) {
    if (` ${key} `.includes(` ${normalize(name)} `)) return subject;
  }
  if (/^[A-Za-zÅÄÖåäö]{1,8}\d?$/i.test(subject)) return subject.toUpperCase();
  if (/^[A-Za-zÅÄÖåäö]{2,}(?:[ -][A-Za-zÅÄÖåäö0-9]{1,12}){0,3}$/.test(subject) && subject.length <= 28) return subject;
  return '';
}

function subjectAbbr(subject = '') {
  const key = normalize(subject);
  if (!key) return '';
  if (SUBJECT_ABBR.has(key)) return SUBJECT_ABBR.get(key);
  for (const [name, abbr] of SUBJECT_ABBR) {
    if (` ${key} `.includes(` ${normalize(name)} `)) return abbr;
  }
  const words = key.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
  return key.slice(0, Math.min(4, Math.max(2, key.length))).toUpperCase();
}
function inferSubjectFromText(_text) {
  // Intentionally disabled. Guessing subjects from free text caused false positives.
  return '';
}

function inferResult(event, _rawText, _description) {
  // Only show results from explicit SchoolSoft result/grade fields. Never infer from
  // ordinary descriptions, because phrases like "not setting grades yet" produced junk.
  const values = [
    typeof event.result === 'object' ? event.result?.text : event.result, event.grade, event.gradeValue, event.assessmentResult, event.resultText,
    event.publishedResult, event.gradeText, event.gradeName, event.betyg, event.score, event.mark
  ].map(v => cleanText(v || '')).filter(isPlausibleResultValue);
  const uniqueValues = unique(values);
  if (!uniqueValues.length) return null;
  const full = uniqueValues.join(' · ');
  return { text: full, short: smartTruncate(full, 32) };
}

function isPlausibleResultValue(value) {
  if (!value) return false;
  if (/^(true|false|null|undefined|0|1|yes|no|ja|nej)$/i.test(value)) return false;
  if (/^20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(value)) return false;
  if (value.length > 50) return false;
  if (/don'?t worry|not setting|grades? quite yet|inte satt|startDate|endDate|allDay|teacher|teachingGroup|activity|entityId/i.test(value)) return false;
  if (/[{}|]|\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}\b/.test(value)) return false;
  return true;
}

function formatDescription(text) {
  const clean = cleanDescription(text);
  if (!clean) return '';
  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

function smartTruncate(text, n) {
  const t = cleanText(text);
  return t.length > n ? `${t.slice(0, Math.max(0, n - 1)).trim()}…` : t;
}


function isValidEvent(event) {
  if (!event || !event.dateObj || !event.title) return false;
  if (event.isUserEvent) return true;
  const text = [event.title, event.description, event.rawText].join(' ');
  if (looksLikeBrowserOrCodeJunk(text)) return false;
  if (/^\s*(true|false|null|undefined|0|1)\s*$/i.test(event.title)) return false;
  return true;
}

function looksLikeBrowserOrCodeJunk(text = '') {
  const t = String(text || '');
  const compact = t.replace(/\s+/g, '');
  if (/C=!S&&|\/gecko\/|Firefox\/|\.test\(|function\(|=>|webpack|navigator\.userAgent|Object\.defineProperty|window\.|document\.|prototype\.|\{\s*return\s+/i.test(t)) return true;
  if (compact.length > 40 && /[;{}()=]/.test(compact) && /&&|\|\||var|let|const|function|return/i.test(compact)) return true;
  return false;
}

function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function startOfIsoWeekKey(key) {
  const m = String(key || '').match(/^(20\d{2})-W(\d{2})$/);
  if (!m) return startOfWeek(new Date());
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(year, 0, 4);
  const week1Start = startOfWeek(jan4);
  return addDays(week1Start, (week - 1) * 7);
}

function formatDateSpan(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${start.getDate()}–${fmt.dayMonth.format(end)}`;
  return `${fmt.dayMonth.format(start)}–${fmt.dayMonth.format(end)}`;
}

function sortSubjects(values) {
  return [...values].sort((a, b) => {
    const ai = COMMON_SUBJECT_ORDER.indexOf(subjectAbbr(a));
    const bi = COMMON_SUBJECT_ORDER.indexOf(subjectAbbr(b));
    if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
    return a.localeCompare(b, 'sv');
  });
}

function qs(selector) { return document.querySelector(selector); }
function unique(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'sv')); }
function groupBy(items, fn) { return items.reduce((acc, item) => { const key = fn(item); (acc[key] ||= []).push(item); return acc; }, {}); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day); }
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function parseStoredDate(s) { return /^20\d{2}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(`${s}T00:00:00`) : null; }
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
function normalize(s = '') { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9åäö]+/gi, ' ').trim(); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s = '') { return escapeHtml(s); }
function escapeRegExp(s = '') { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatTimeAgo(date) {
  if (!date || Number.isNaN(date.getTime())) return '–';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 2) return 'nyss';
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} dagar sedan`;
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date);
}

const observer = new MutationObserver(bindDynamicClicks);
observer.observe(document.body, { childList: true, subtree: true });
