// Desktop sidecar entry point.
//
// In developer mode this is launched by Tauri's beforeDevCommand.
// In the final packaged app this file is the intended entry point for a bundled
// backend executable. It switches writable data/session/config paths from the
// source folder to the user's OS app-data directory before loading server.js.

process.env.SCHOOLSOFT_DESKTOP = '1';
process.env.SCHOOLSOFT_USE_APP_DATA = '1';
process.env.SCHOOLSOFT_SIDE_CAR = '1';

await import('../server.js');
