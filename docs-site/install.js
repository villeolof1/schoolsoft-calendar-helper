const installButtons = document.querySelectorAll('[data-install-button]');
const installHelp = document.querySelector('#installHelp');

for (const button of installButtons) {
  button.addEventListener('click', () => {
    if (installHelp) {
      installHelp.hidden = false;
      installHelp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (button.classList.contains('install-button')) {
      const label = button.querySelector('span');
      const sublabel = button.querySelector('small');
      if (label) label.textContent = 'Nedladdning startad';
      if (sublabel) sublabel.textContent = 'Öppna .exe-filen i nedladdningar för att installera';
    }
  });
}
