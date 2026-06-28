// Small UI fixes layered on top of app.js.
// Keep partial outside-month weeks for alignment, but remove rows that contain
// no dates from the selected month at all.
(() => {
  function trimFullyBlankMonthWeeks() {
    const monthView = document.querySelector('#monthView');
    if (!monthView || monthView.classList.contains('hidden')) return;
    for (const row of monthView.querySelectorAll('.month-week-row')) {
      const cells = [...row.querySelectorAll('.month-cell')];
      if (cells.length && cells.every(cell => cell.classList.contains('outside'))) {
        row.remove();
      }
    }
  }

  const monthView = document.querySelector('#monthView');
  if (monthView) {
    const observer = new MutationObserver(() => trimFullyBlankMonthWeeks());
    observer.observe(monthView, { childList: true, subtree: true });
  }

  window.addEventListener('load', trimFullyBlankMonthWeeks);
  document.addEventListener('click', () => setTimeout(trimFullyBlankMonthWeeks, 0), true);
  setInterval(trimFullyBlankMonthWeeks, 1000);
})();
