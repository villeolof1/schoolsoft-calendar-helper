// Runs before app.js. It prevents the app from opening SchoolSoft or starting a
// sync before the first-run local/privacy notice has been accepted.
(() => {
  const acceptedKey = 'sstc.privacyAccepted.v1';
  const originalFetch = window.fetch.bind(window);

  function hasAcceptedPrivacyNotice() {
    return window.localStorage.getItem(acceptedKey) === '1';
  }

  function isSchoolSoftAction(input) {
    const url = typeof input === 'string' ? input : input?.url || '';
    return url.startsWith('/api/open-login') || url.startsWith('/api/sync');
  }

  window.schoolsoftCalendarPrivacyAccepted = hasAcceptedPrivacyNotice;

  window.fetch = async (input, init) => {
    if (isSchoolSoftAction(input) && !hasAcceptedPrivacyNotice()) {
      return new Response(JSON.stringify({
        ok: false,
        started: false,
        blockedByPrivacyNotice: true,
        reason: 'Acceptera integritetsinformationen först. SchoolSoft öppnas inte innan du har godkänt den.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    return originalFetch(input, init);
  };
})();
