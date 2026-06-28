process.env.SCHOOLSOFT_DESKTOP = '1';
process.env.SCHOOLSOFT_USE_APP_DATA = '1';
process.env.SCHOOLSOFT_SIDE_CAR = '1';

const command = String(process.argv[2] || '').replace(/\\/g, '/');
const browserScript = `scripts/${['browser', 'login.js'].join('-')}`;
const extractScript = 'scripts/extract.js';

(async () => {
  if (command.endsWith(browserScript)) {
    await import(`../${browserScript}`);
    return;
  }

  if (command.endsWith(extractScript)) {
    await import(`../${extractScript}`);
    return;
  }

  await import('../server.js');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
