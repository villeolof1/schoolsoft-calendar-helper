const installButtons = document.querySelectorAll('[data-install-button]');
const installHelp = document.querySelector('#installHelp');

const platformInstructions = {
  windows: 'Nedladdningen bör starta nu. Öppna SchoolSoft-Calendar-Helper-Setup.exe i webbläsarens nedladdningar och följ installationsrutan. Windows kan visa en varning eftersom appen inte är signerad ännu.',
  macos: 'Nedladdningen bör starta nu. Öppna SchoolSoft-Calendar-Helper-macOS.dmg, dra appen till Program/Applications och öppna den därifrån. macOS kan visa en säkerhetsvarning eftersom appen inte är signerad/notariserad ännu.',
  linux: 'Nedladdningen bör starta nu. Öppna AppImage-filen, gör den körbar om det behövs och starta appen.',
  'linux-deb': 'Nedladdningen bör starta nu. Öppna .deb-filen med din pakethanterare, eller installera den via terminalen.'
};

for (const button of installButtons) {
  button.addEventListener('click', () => {
    const platform = button.dataset.platform || 'windows';
    const fileName = button.dataset.file || 'installationsfilen';

    if (installHelp) {
      installHelp.hidden = false;
      installHelp.innerHTML = platformInstructions[platform] || `Nedladdningen bör starta nu. Öppna ${fileName} och följ instruktionerna för din dator.`;
      installHelp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const title = button.querySelector('strong');
    const sublabel = button.querySelector('small');
    if (title) title.textContent = 'Nedladdning startad';
    if (sublabel) sublabel.textContent = `Öppna ${fileName} när nedladdningen är klar`;
  });
}
