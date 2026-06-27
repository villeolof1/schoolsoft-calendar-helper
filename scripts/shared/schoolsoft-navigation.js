import { saveSnapshot } from './storage.js';

export async function ensureAtBase(page, config) {
  if (!page.url().startsWith(config.baseUrl)) {
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  }
}

export async function waitForManualLoginIfNeeded(page, config) {
  await ensureAtBase(page, config);
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  const url = page.url().toLowerCase();
  if (url.includes('login') || /logga in|login|bankid|lösenord|losenord|användarnamn|anvandarnamn/.test(body)) {
    if (!process.stdin.isTTY) {
      throw new Error('SchoolSoft login is needed. Run npm run login in a terminal, log in in the browser window, then run the sync again.');
    }
    console.log('\nSchoolSoft login is needed. Log in in the opened browser window.');
    console.log('After the SchoolSoft start page has loaded, return here and press Enter.\n');
    await waitForEnter();
  }
}

export async function navigateToProvschema(page, config) {
  if (config.provschemaUrl) {
    await page.goto(resolveUrl(config.provschemaUrl, config.baseUrl), { waitUntil: 'domcontentloaded' });
    return page.url();
  }

  await ensureAtBase(page, config);
  const candidates = [
    /provschema/i,
    /^prov$/i,
    /prov\s*schema/i,
    /test\s*schema/i,
    /läxförhör/i,
    /inlämningar/i,
    /uppgifter/i
  ];

  for (let round = 0; round < 3; round++) {
    const clicked = await clickFirstTextLink(page, candidates);
    if (clicked) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      const text = await page.locator('body').innerText().catch(() => '');
      if (/provschema|prov|läxförhör|test/i.test(text)) return page.url();
    }

    // Menus sometimes need to be opened first.
    const menuCandidates = [/schema/i, /planering/i, /elev/i, /skola/i, /kalender/i];
    await clickFirstTextLink(page, menuCandidates).catch(() => false);
    await page.waitForTimeout(500);
  }

  saveSnapshot('could-not-find-provschema', await page.content());
  throw new Error('Could not automatically find Provschema. Add "provschemaUrl" in schoolsoft.config.json, or run npm run manual-capture.');
}

export async function navigateToCalendar(page, config) {
  if (config.calendarUrl) {
    const target = resolveUrl(config.calendarUrl, config.baseUrl);
    if (page.url() === target) {
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    } else {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return page.url();
  }

  await ensureAtBase(page, config);
  const candidates = [/kalender/i, /^schema$/i, /veckoschema/i, /planering/i, /lektioner/i];
  const clicked = await clickFirstTextLink(page, candidates);
  if (!clicked) return '';
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1000);
  return page.url();
}

export async function clickLikelyAllTerms(page) {
  const labels = [/båda/i, /alla/i, /hela/i, /läsåret/i, /lasaret/i, /höst.*vår/i, /HT.*VT/i];
  for (const label of labels) {
    const clicked = await clickFirstTextLink(page, [label]).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(800);
      return true;
    }
  }

  const selects = await page.locator('select').all();
  for (const select of selects) {
    const options = await select.locator('option').allTextContents().catch(() => []);
    const idx = options.findIndex(o => labels.some(re => re.test(o)));
    if (idx >= 0) {
      const value = await select.locator('option').nth(idx).getAttribute('value');
      if (value !== null) {
        await select.selectOption(value);
        await page.waitForTimeout(1000);
        return true;
      }
    }
  }
  return false;
}

export async function discoverStudentSelectors(page, config) {
  const students = [];
  const configured = config.studentNames || [];
  for (const name of configured) students.push({ label: name, type: 'configured' });

  const selects = await page.locator('select').all();
  for (let i = 0; i < selects.length; i++) {
    const select = selects[i];
    const options = await select.locator('option').evaluateAll(nodes => nodes.map(o => ({ text: o.textContent?.trim() || '', value: o.getAttribute('value') || '' }))).catch(() => []);
    for (const option of options) {
      if (option.text && !/välj|valj|termin|klass|grupp|alla|båda/i.test(option.text)) {
        students.push({ label: option.text, type: 'select', selectIndex: i, value: option.value });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const student of students) {
    const key = student.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(student);
    }
  }
  return unique;
}

export async function selectStudent(page, student) {
  if (!student || student.type !== 'select') return false;
  const select = page.locator('select').nth(student.selectIndex);
  await select.selectOption(student.value);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1000);
  return true;
}

export async function clickFirstTextLink(page, regexes) {
  for (const re of regexes) {
    const link = page.getByRole('link', { name: re }).first();
    if (await link.count().catch(() => 0)) {
      await link.click();
      return true;
    }
    const button = page.getByRole('button', { name: re }).first();
    if (await button.count().catch(() => 0)) {
      await button.click();
      return true;
    }
    const text = page.getByText(re).first();
    if (await text.count().catch(() => 0)) {
      await text.click();
      return true;
    }
  }
  return false;
}


export async function applyLikelyAssessmentFilters(page, config = {}) {
  const keywords = [
    ...(config.assessmentKeywords || []),
    'prov', 'test', 'tests', 'exam', 'exams', 'assignment', 'assignments', 'homework', 'task', 'tasks',
    'assessment', 'quiz', 'inlämning', 'inlamning', 'läxförhör', 'laxforhor', 'redovisning', 'planering'
  ];
  const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const patterns = keywords.map(k => normalize(k)).filter(Boolean);

  const clicked = await page.evaluate(({ patterns }) => {
    const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const includesKeyword = text => {
      const t = ` ${normalize(text)} `;
      return patterns.some(p => p && t.includes(` ${p} `));
    };
    const isVisible = el => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const nearbyText = el => {
      const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      const parent = el.closest('label, div, li, tr, section, fieldset') || el.parentElement || el;
      return [el.getAttribute('aria-label'), el.getAttribute('title'), label?.textContent, parent.textContent].filter(Boolean).join(' ');
    };

    let n = 0;
    for (const input of [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')]) {
      if (!isVisible(input)) continue;
      if (!includesKeyword(nearbyText(input))) continue;
      if (!input.checked) {
        input.click();
        n++;
      }
    }

    for (const el of [...document.querySelectorAll('[role="switch"], [role="checkbox"], [aria-pressed], button, a')]) {
      if (!isVisible(el)) continue;
      const text = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent, el.getAttribute('class')].filter(Boolean).join(' ');
      if (!includesKeyword(text)) continue;
      const pressed = el.getAttribute('aria-pressed');
      const checked = el.getAttribute('aria-checked');
      if (pressed === 'false' || checked === 'false') {
        el.click();
        n++;
      }
    }
    return n;
  }, { patterns }).catch(() => 0);

  if (clicked) await page.waitForTimeout(1200);
  return clicked;
}


export async function clickLikelyCalendarView(page, preferred = /månad|manad|month/i) {
  const clicked = await clickFirstTextLink(page, [preferred]).catch(() => false);
  if (clicked) {
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

export async function clickCalendarDirection(page, direction) {
  const isPrevious = direction === 'previous';
  const labelPatterns = isPrevious
    ? [/föregående/i, /foregaende/i, /previous/i, /prev/i, /tillbaka/i, /back/i, /^‹$/, /^<$/, /^«$/]
    : [/nästa/i, /nasta/i, /next/i, /^›$/, /^>$/, /^»$/];

  const before = await calendarSignature(page);

  for (const re of labelPatterns) {
    const clicked = await clickFirstTextLink(page, [re]).catch(() => false);
    if (clicked && await waitForCalendarChange(page, before)) return true;
  }

  const clickedFallback = await page.evaluate(({ isPrevious }) => {
    const normalizeWhitespace = s => String(s || '').replace(/\s+/g, ' ').trim();
    const isVisible = el => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const candidates = [...document.querySelectorAll('button, a, [role=button], [tabindex]')].filter(isVisible);
    const score = el => {
      const text = normalizeWhitespace([
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('data-testid'),
        el.getAttribute('class'),
        el.textContent
      ].filter(Boolean).join(' ')).toLowerCase();
      let n = 0;
      if (isPrevious) {
        if (/previous|prev|föregående|foregaende|back|tillbaka/.test(text)) n += 8;
        if (/[‹«<]/.test(text)) n += 6;
        if (/left|chevron-left|arrow-left/.test(text)) n += 5;
      } else {
        if (/next|nästa|nasta/.test(text)) n += 8;
        if (/[›»>]/.test(text)) n += 6;
        if (/right|chevron-right|arrow-right/.test(text)) n += 5;
      }
      if (/calendar|date|month|månad|manad|toolbar|navigation/.test(text)) n += 2;
      return n;
    };
    const best = candidates
      .map(el => ({ el, n: score(el), rect: el.getBoundingClientRect() }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || a.rect.left - b.rect.left)[0];
    if (!best) return false;
    best.el.click();
    return true;
  }, { isPrevious }).catch(() => false);

  if (clickedFallback && await waitForCalendarChange(page, before)) return true;

  // Last resort: some calendars react to keyboard navigation after focus.
  await page.keyboard.press(isPrevious ? 'PageUp' : 'PageDown').catch(() => {});
  if (await waitForCalendarChange(page, before)) return true;
  await page.keyboard.press(isPrevious ? 'ArrowLeft' : 'ArrowRight').catch(() => {});
  return waitForCalendarChange(page, before);
}

export async function calendarSignature(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  return `${page.url()}|${text.replace(/\s+/g, ' ').slice(0, 4000)}`;
}

async function waitForCalendarChange(page, before) {
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(450);
    const after = await calendarSignature(page);
    if (after !== before) {
      await page.waitForTimeout(900);
      return true;
    }
  }
  return false;
}

export function resolveUrl(possiblyRelative, baseUrl) {
  try {
    return new URL(possiblyRelative, baseUrl).toString();
  } catch {
    return possiblyRelative;
  }
}

export function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
}
