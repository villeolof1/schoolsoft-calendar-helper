# SchoolSoft Calendar Helper

An unofficial, local-first calendar helper for SchoolSoft. It extracts tests, assessments, assignments, presentations, and other important school calendar items from a SchoolSoft account the user is already authorized to access, then shows them in a cleaner calendar UI.

> This project is not affiliated with, endorsed by, or supported by SchoolSoft.

## Download / website

The project website is intended to be served with GitHub Pages:

```text
https://villeolof1.github.io/schoolsoft-calendar-helper/
```

Windows installers are intended to be published through GitHub Releases:

```text
https://github.com/villeolof1/schoolsoft-calendar-helper/releases/latest
```

The website download button points to the latest release asset named:

```text
SchoolSoft-Calendar-Helper-Setup.exe
```

## Privacy-first design

**When used as distributed here, SchoolSoft data never reaches us.**

- The app runs on the user's own computer.
- The local dashboard is served from `localhost` on that same computer.
- SchoolSoft login happens in SchoolSoft's own login page.
- The app does not store SchoolSoft passwords in code or config.
- In developer mode, extracted data, notes, done markers, manual events, and trash state are stored locally in `data/`.
- In desktop mode, writable data and the saved browser session are stored in the user's OS app-data folder.
- The saved browser session is local only.
- No analytics are included in the app.

The GitHub Pages website itself is hosted by GitHub and may involve standard website/security logging by GitHub. The privacy claim above is about SchoolSoft data handled by the app.

See [`PRIVACY.md`](./PRIVACY.md) for the detailed model.

## Status

This is an early local/open-source version. The project now has a working Windows/Tauri installer prototype with a packaged Node/Playwright backend sidecar. It still needs testing on clean non-developer Windows machines before broad public distribution.

Known distribution limitations:

- The Windows app is currently unsigned, so Microsoft SmartScreen may warn users.
- SchoolSoft availability can affect login/sync.
- Clean-machine testing is still required to confirm browser/runtime packaging behaves correctly without Node, Rust, or developer tools installed.

## Features

- Month, week, day, list, and history views.
- Subject/activity codes from SchoolSoft, such as `MA`, `SV`, `EN`, when present.
- Filters for subject, teacher, room, student, type, search, and content scope.
- Color coding by task type or subject.
- Details drawer with date, time, teacher, room, group, description, and original source text when useful.
- Local notes on events and days.
- Add local events without changing SchoolSoft.
- Mark events or whole days as done.
- Soft-delete events to a local trashcan and restore them later.
- Local ICS feed for Apple Calendar/Outlook while the app is running.
- First-run privacy notice.
- Local data deletion button.

## Install for normal users

1. Go to the latest release.
2. Download `SchoolSoft-Calendar-Helper-Setup.exe`.
3. Run the installer.
4. Open SchoolSoft Calendar Helper.
5. Accept the local/privacy notice.
6. Click **Logga in** and log in on SchoolSoft's own page.
7. Return to the app and click **Synka nu** / **Hämta kalender**.

Because the app is unsigned for now, Windows may show a warning.

## Developer requirements

- Node.js 20 or newer, preferably Node 22.
- Rust stable MSVC toolchain for Windows desktop builds.
- Windows, macOS, or Linux for local browser mode; Windows for the current installer workflow.
- A SchoolSoft parent/student account that is allowed to see the calendar information.

## First run: browser/local developer mode

```bash
npm install
npm run install-browsers
npm run login
npm run extract
npm run start
```

Then open:

```text
http://localhost:3000
```

## First run: desktop developer mode

This opens the same app in a Tauri desktop window, while still using Node/npm during development:

```bash
npm install
npm run install-browsers
npm run desktop:dev
```

Desktop mode uses the OS app-data folder for writable data instead of the repository folder.

## Build Windows installer locally

```bash
npm install
npm run desktop:build
```

The NSIS installer is written under:

```text
src-tauri/target/release/bundle/nsis/
```

Generated installers, binaries, and build outputs should not be committed.

## Release workflow

A tagged release can be built by pushing a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `Release Windows installer` GitHub Actions workflow will:

1. Install dependencies with `npm ci`.
2. Run `npm run check`.
3. Build the Tauri/NSIS Windows installer.
4. Rename the installer to `SchoolSoft-Calendar-Helper-Setup.exe`.
5. Upload it as a workflow artifact.
6. If the workflow was triggered by a tag, create a GitHub Release and attach the installer.

The workflow can also be started manually with `workflow_dispatch` to test the build without creating a release.

## Website workflow

The website lives in:

```text
docs-site/
```

The `Deploy website` GitHub Actions workflow publishes it to GitHub Pages when files in `docs-site/` change.

Repository settings may still need to be configured once:

1. Open repository **Settings**.
2. Go to **Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Run the `Deploy website` workflow if needed.

## Daily developer use

Normally:

```bash
npm run start
```

The app shows the last local data immediately and syncs in the background. If the SchoolSoft session has expired, click **Logga in** in the app or run:

```bash
npm run login
```

## Configuration

The app uses `schoolsoft.config.example.json` by default. For local customization, create `schoolsoft.config.json` next to it. That file is ignored by Git.

In desktop mode, local config is read from the app-data folder if present, otherwise the example config in the app is used.

Important fields:

```json
{
  "baseUrl": "https://sms.schoolsoft.se/engelska/",
  "loginUrl": "https://sms.schoolsoft.se/engelska/jsp/Login.jsp",
  "calendarUrl": "https://sms.schoolsoft.se/engelska/react/#/student/calendar",
  "lookBackMonths": 5,
  "lookAheadMonths": 5,
  "syncIntervalMinutes": 60
}
```

Do not put passwords or personal identity information in config files.

## Local output files

These files are created locally and ignored by Git in normal developer mode:

```text
data/events.json        extracted SchoolSoft events
data/last-run.json      local sync metadata
data/user-state.json    notes, done markers, manual events, trash state
data/events.ics         optional local calendar feed
snapshots/*             local diagnostics only
.playwright-user-data/  local browser session only
```

In desktop mode, equivalent files are stored in the OS app-data directory.

## Calendar sync

The local calendar feed is available while the app is running:

```text
http://localhost:3000/schoolsoft-tests.ics
```

Apple Calendar and Outlook can subscribe to local feeds. Google Calendar cannot subscribe directly to `localhost`; it can import an `.ics` file, or you need a separate private hosting model. Do not publish a feed that contains school/student data.

## Open-source release checklist

Before pushing a release:

1. Confirm `data/`, `.playwright-user-data/`, `snapshots/`, and `schoolsoft.config.json` are not committed.
2. Run `npm run check`.
3. Build locally with `npm run desktop:build`.
4. Start the installed app and confirm the first-run privacy modal is shown in a clean state.
5. Confirm **Logga in**, **Synka nu**, and local data deletion work.
6. Test on a clean Windows computer without Node/Rust installed.
7. Push a version tag and verify the release workflow attaches the installer.
8. Verify the GitHub Pages download button points to the latest release asset.

## Roadmap

Recommended next steps:

- Better SchoolSoft-down/error status in the UI.
- Cleaner first-run onboarding.
- Clean-machine Windows testing.
- Screenshots for the website.
- Code signing to reduce SmartScreen warnings.
- Later: auto-updates.

## Legal/privacy note

This repository is designed for local use by a user who is authorized to access the SchoolSoft data. A hosted public service where other users log in through your server would be a different product and would need separate legal/privacy/security review and likely permission from relevant parties.
