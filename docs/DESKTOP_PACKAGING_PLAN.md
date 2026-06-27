# Desktop packaging plan

Goal: make the app usable by normal parents without npm, terminals, or manual developer setup.

## Target user flow

1. User downloads installer from GitHub Releases or a GitHub Pages download page.
2. User opens the installed app.
3. First-run local/privacy notice appears.
4. User clicks **Logga in**.
5. SchoolSoft login opens in an app/browser window.
6. Calendar data appears and stays local on that computer.

## Preferred route

Use Tauri for a lightweight desktop shell around the existing frontend. The app still needs a local extraction component. The implementation should keep SchoolSoft credentials/session files on the user's machine and not introduce a central server.

## Tasks

1. Split the current app into clear modules:
   - frontend UI in `public/` or a future frontend build directory;
   - local backend/extractor;
   - local data storage.
2. Add Tauri configuration.
3. Make the Node/Playwright extractor a sidecar process or replace it with an equivalent Tauri-compatible local command flow.
4. Store user data in the app data directory instead of the source folder.
5. Add one-click local data deletion from the desktop app.
6. Add GitHub Actions builds for Windows first.
7. Add unsigned beta release.
8. Consider code signing later for a smoother install experience.

## What not to do initially

Do not build a hosted public service where users submit SchoolSoft credentials or sessions to a shared server. That would change the privacy/legal model substantially.
