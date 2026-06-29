(() => {
  const originalFetch = window.fetch.bind(window);
  let manualSyncAllowedUntil = 0;

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#syncNow')) {
      manualSyncAllowedUntil = Date.now() + 15000;
    }
  }, true);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || 'GET').toUpperCase();
    if (method === 'POST' && String(url).startsWith('/api/sync') && Date.now() > manualSyncAllowedUntil) {
      return new Response(JSON.stringify({
        ok: true,
        started: false,
        syncRunning: false,
        reason: 'Automatisk synkning är pausad. Klicka Logga in först om det behövs, och klicka sedan Synka nu när SchoolSoft är färdigladdat.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    return originalFetch(input, init);
  };
})();
