// CommonJS wrapper used only by the packaged Tauri sidecar executable.
// @yao-pkg/pkg runs the entrypoint as CommonJS, so keep this file free of
// top-level await and import the existing ES module server dynamically.

process.env.SCHOOLSOFT_DESKTOP = '1';
process.env.SCHOOLSOFT_USE_APP_DATA = '1';
process.env.SCHOOLSOFT_SIDE_CAR = '1';

(async () => {
  await import('../server.js');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
