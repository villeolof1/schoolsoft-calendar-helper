const panelHost = document.querySelector('.sync-panel');
let running = false;
let startedAt = 0;
let smoothProgress = 0;
let lastPayload = null;

if (panelHost) {
  const style = document.createElement('style');
  style.textContent = `
    .progress-panel{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid #dfe4ef;border-radius:14px;background:#fbfcff}.progress-panel.hidden{display:none}.progress-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.progress-top strong{font-size:.86rem}.progress-top span{color:#667085;font-size:.78rem;font-weight:800}.progress-bar{height:9px;overflow:hidden;border-radius:999px;background:#e6e9f2}.progress-fill{display:block;width:0%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#111827,#365cff);transition:width 500ms ease}.progress-months{display:flex;flex-wrap:wrap;gap:5px}.progress-month{padding:4px 7px;border:1px solid #e6e9f2;border-radius:999px;background:#fff;color:#667085;font-size:.72rem;font-weight:850}.progress-month.done{border-color:#bbf7d0;background:#ecfdf3;color:#087443}.progress-month.active{border-color:#c7d2fe;background:#eef2ff;color:#102a9a}.progress-steps{display:grid;gap:4px}.progress-step{color:#667085;font-size:.76rem;line-height:1.25}.progress-step.done{color:#087443;font-weight:850}.progress-step.active{color:#102a9a;font-weight:900}.progress-hint{margin:0;color:#667085;font-size:.76rem;line-height:1.35}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'progressPanel';
  panel.className = 'progress-panel hidden';
  panel.innerHTML = `
    <div class="progress-top"><strong id="progressLabel">Synkar kalendern</strong><span id="progressPct">0%</span></div>
    <div class="progress-bar"><span id="progressFill" class="progress-fill"></span></div>
    <div id="progressMonths" class="progress-months"></div>
    <div id="progressSteps" class="progress-steps"></div>
    <p id="progressHint" class="progress-hint">Du kan fortsätta använda appen medan SchoolSoft hämtas i bakgrunden.</p>`;
  panelHost.appendChild(panel);

  setInterval(tick, 900);
  setInterval(readStatus, 2500);
  readStatus();
}

async function readStatus() {
  try {
    const response = await fetch('/api/events', { cache: 'no-store' });
    lastPayload = await response.json();
    if (lastPayload.syncRunning && !running) {
      running = true;
      startedAt = Date.now();
      smoothProgress = 7;
    }
    if (!lastPayload.syncRunning && running) {
      smoothProgress = 100;
      renderProgress();
      setTimeout(() => {
        running = false;
        document.querySelector('#progressPanel')?.classList.add('hidden');
      }, 2200);
      return;
    }
    renderProgress();
  } catch {
    // Keep the normal app status text responsible for errors.
  }
}

function tick() {
  if (!running || !lastPayload?.syncRunning) return;
  const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
  const natural = Math.min(92, 7 + Math.sqrt(elapsed) * 18);
  smoothProgress = Math.max(smoothProgress, natural);
  renderProgress();
}

function renderProgress() {
  const panel = document.querySelector('#progressPanel');
  if (!panel || !lastPayload) return;
  if (!lastPayload.syncRunning && smoothProgress < 100) return;

  panel.classList.remove('hidden');
  const msg = String(lastPayload.lastSyncMessage || 'Synkar kalendern i bakgrunden…');
  const target = lastPayload.lastRequestedMonth || currentMonth();
  const plan = monthPlan(target);
  const loaded = new Set([...(lastPayload.lastRun?.loadedMonths || []), ...(lastPayload.lastRun?.coverage?.loadedMonths || [])]);
  const loadedInPlan = plan.filter(m => loaded.has(m)).length;
  const monthProgress = loadedInPlan ? Math.min(94, 10 + (loadedInPlan / plan.length) * 82) : 0;
  if (lastPayload.syncRunning) smoothProgress = Math.max(smoothProgress, monthProgress);
  const pct = Math.round(Math.min(100, smoothProgress));

  document.querySelector('#progressFill').style.width = `${pct}%`;
  document.querySelector('#progressPct').textContent = `${pct}%`;
  document.querySelector('#progressLabel').textContent = labelFor(msg, target);
  document.querySelector('#progressMonths').innerHTML = plan.slice(0, 7).map((month, i) => {
    const klass = loaded.has(month) ? 'done' : i === loadedInPlan ? 'active' : '';
    return `<span class="progress-month ${klass}">${loaded.has(month) ? '✓ ' : ''}${month}</span>`;
  }).join('');
  document.querySelector('#progressSteps').innerHTML = stepsFor(pct, msg).map(step => `<span class="progress-step ${step.state}">${step.text}</span>`).join('');
  document.querySelector('#progressHint').textContent = hintFor(msg, loadedInPlan, plan.length);
}

function labelFor(message, target) {
  const loaded = message.match(/loaded .*?(20\d{2}-\d{2})/i);
  if (loaded) return `Hämtade ${loaded[1]} — fortsätter med nästa månad`;
  if (/network\/api/i.test(message)) return 'Läser händelser från SchoolSoft';
  if (/done|klar/i.test(message)) return 'Synkning klar';
  return `Hämtar kalenderdata för ${target}`;
}

function hintFor(message, done, total) {
  if (/login|logga/i.test(message)) return 'SchoolSoft behöver ny inloggning. Klicka Logga in och låt fönstret vara öppet tills sidan är färdig.';
  if (done > 0) return `${done} av ungefär ${total} månader har gått igenom. Appen visar sparad data under tiden.`;
  return 'Först hämtas vald månad. Därefter hämtas månaderna runt omkring i bakgrunden.';
}

function stepsFor(pct, message) {
  const labels = ['Öppnar SchoolSoft-session', 'Hämtar vald månad', 'Bläddrar närliggande månader', 'Läser händelser', 'Sparar lokalt'];
  const active = /network\/api/i.test(message) ? 3 : Math.min(4, Math.floor(pct / 22));
  return labels.map((text, i) => ({ text: `${i < active ? '✓' : i === active ? '•' : '○'} ${text}`, state: i < active ? 'done' : i === active ? 'active' : '' }));
}

function monthPlan(center) {
  const base = parseMonth(center) || new Date();
  const months = [monthKey(base)];
  for (let i = 1; i <= 3; i++) {
    months.push(monthKey(addMonths(base, i)));
    months.push(monthKey(addMonths(base, -i)));
  }
  return [...new Set(months)];
}

function currentMonth() { return monthKey(new Date()); }
function parseMonth(key) {
  if (!/^20\d{2}-\d{2}$/.test(String(key || ''))) return null;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function addMonths(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), 1); d.setMonth(d.getMonth() + n); return d; }
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
