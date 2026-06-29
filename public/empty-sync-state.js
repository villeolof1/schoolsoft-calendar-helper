(() => {
  async function refreshEmptySyncState() {
    try {
      const response = await fetch('/api/events', { cache: 'no-store' });
      const payload = await response.json();
      const events = Array.isArray(payload.events) ? payload.events : [];
      const lastRun = payload.lastRun || {};
      const finished = Boolean(lastRun.finishedAt);
      const count = Number(lastRun.count || 0);
      const loadedMonths = lastRun.loadedMonths || lastRun.coverage?.loadedMonths || [];
      const successfulEmptySync = finished && count === 0 && events.length === 0 && loadedMonths.length > 0 && !payload.syncRunning;
      if (!successfulEmptySync) return;

      const syncStatus = document.querySelector('#syncStatus');
      const syncDot = document.querySelector('#syncDot');
      const emptyState = document.querySelector('#emptyState');
      const coverageText = document.querySelector('#coverageText');

      if (syncStatus) syncStatus.textContent = 'Synkning klar – inga prov eller uppgifter hittades';
      if (syncDot) syncDot.className = 'sync-dot ready';
      if (coverageText) coverageText.textContent = 'SchoolSoft synkades utan fel, men kalendern verkar inte innehålla några prov, inlämningar eller aktiva uppgifter för de hämtade månaderna.';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = '<h2>Inga prov eller uppgifter hittades</h2><p>Synkningen lyckades, men SchoolSoft-kalendern verkar vara tom för det här kontot. Om SchoolSoft själv visar “No active assignments” finns det troligen inget för appen att hämta just nu.</p>';
      }
    } catch {
      // Leave the normal app status untouched.
    }
  }

  window.addEventListener('load', refreshEmptySyncState);
  setInterval(refreshEmptySyncState, 5000);
})();
