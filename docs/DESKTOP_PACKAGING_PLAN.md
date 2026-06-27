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

The repository now contains an initial Tauri desktop scaffold in `src-tauri/`.

The current scaffold is useful for developer testing:

```bash
npm install
npm run install-browsers
npm run desktop:dev
```

`desktop:dev` starts the existing local Node server through Tauri's `beforeDevCommand`, then opens the calendar UI in a desktop window.

This is not yet the final parent-friendly installer. The remaining hard part is bundling the Node/Playwright extractor as a Tauri sidecar so end users do not need Node.js, npm, or Playwright installed manually.

## Preferred route

Use Tauri for a lightweight desktop shell around the existing frontend. The app still needs a local extraction component. The implementation should keep SchoolSoft credentials/session files on the user's machine and not introduce a central server.

Tauri's documented route for keeping a Node-based local backend is a sidecar: package the Node app as a self-contained binary and configure it as an external binary in `src-tauri/tauri.conf.json`.

## Remaining tasks

1. Move local data from the repository folder to the OS app-data directory.
2. Split the server/extractor into a desktop sidecar entry point.
3. Package the sidecar into a platform-specific executable.
4. Configure Tauri `bundle.externalBin` for that sidecar.
5. Make the desktop UI talk to the sidecar/local server without requiring terminal commands.
6. Add GitHub Actions build for Windows installer first.
7. Publish an unsigned beta release from GitHub Releases.
8. Consider Windows/macOS code signing later for a smoother install experience.

## What not to do initially

Do not build a hosted public service where users submit SchoolSoft credentials or sessions to a shared server. That would change the privacy/legal model substantially.
