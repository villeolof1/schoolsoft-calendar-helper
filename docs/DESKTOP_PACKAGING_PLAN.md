# Desktop packaging plan

Goal: make the app usable by normal parents without npm, terminals, or manual developer setup.

## Target user flow

1. User downloads installer from GitHub Releases or a GitHub Pages download page.
2. User opens the installed app.
3. First-run local/privacy notice appears.
4. User clicks **Logga in**.
5. SchoolSoft login opens in an app/browser window.
6. Calendar data appears and stays local on that computer.

## Current desktop status

The repository contains an initial Tauri desktop scaffold in `src-tauri/`.

The current scaffold is useful for developer testing:

```bash
npm install
npm run install-browsers
npm run desktop:dev
```

`desktop:dev` now starts `npm run start:desktop`, which sets desktop mode before loading the local server. In desktop mode, writable data moves to the OS app-data directory rather than the source/app bundle directory.

## Completed in sidecar-prep step

- Added `scripts/desktop-sidecar.js` as the desktop backend entry point.
- Added `npm run start:desktop`.
- Switched Tauri dev mode to use the desktop backend entry point.
- Added an app-data storage layer for local config, events, last-run coverage, user notes, done state, trash state, snapshots, and the saved Playwright browser session.
- Kept normal developer mode unchanged: `npm run start` still uses the project folder for local data.

## Preferred route

Use Tauri for a lightweight desktop shell around the existing frontend. The app still needs a local extraction component. The implementation should keep SchoolSoft credentials/session files on the user's machine and not introduce a central server.

Tauri's documented route for keeping a Node-based local backend is a sidecar: package the Node app as a self-contained executable and configure it as an external binary in `src-tauri/tauri.conf.json`.

## Remaining tasks

1. Package the Node/Playwright backend sidecar into a platform-specific executable.
2. Ensure Playwright/Chromium is available to that sidecar without a user running terminal commands.
3. Configure Tauri `bundle.externalBin` for the packaged backend.
4. Make packaged production builds start the sidecar automatically rather than using `beforeDevCommand`.
5. Add GitHub Actions build for Windows installer first.
6. Publish an unsigned beta release from GitHub Releases.
7. Consider Windows/macOS code signing later for a smoother install experience.

## What not to do initially

Do not build a hosted public service where users submit SchoolSoft credentials or sessions to a shared server. That would change the privacy/legal model substantially.
