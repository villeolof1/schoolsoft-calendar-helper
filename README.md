# SchoolSoft Calendar Helper

An unofficial, local-first calendar helper for SchoolSoft. It extracts tests, assessments, assignments, presentations, and other important school calendar items from a SchoolSoft account the user is already authorized to access, then shows them in a cleaner calendar UI.

## Privacy-first design

**When used as distributed here, SchoolSoft data never reaches us.**

- The app runs on the user's own computer.
- The local dashboard is served from `localhost` on that same computer.
- SchoolSoft login happens in SchoolSoft's own login page.
- The app does not store SchoolSoft passwords in code or config.
- In normal developer mode, extracted data, notes, done markers, manual events, and trash state are stored locally in `data/`.
- In desktop mode, writable data and the saved browser session are stored in the user's OS app-data folder.
- The saved browser session is local only.
- No analytics are included.

See [`PRIVACY.md`](./PRIVACY.md) for the detailed model.

## Status

This is an early local/open-source version. It is not affiliated with, endorsed by, or supported by SchoolSoft.

The project now has an initial Tauri desktop scaffold for developer testing. It is not yet the final parent-friendly installer; the remaining packaging work is to bundle the Node/Playwright backend as a desktop sidecar so end users do not need Node, npm, or Playwright installed manually.

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

## Requirements for the current developer/local version

- Node.js 20 or newer.
- Windows, macOS, or Linux.
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

## Daily use

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
3. Start the app and confirm the first-run privacy modal is shown in a clean browser/localStorage state.
4. Confirm the local data deletion button works.
5. Create a GitHub release from a clean checkout.

## Roadmap: normal parent installer

The current project is ready for open-source development, but not yet packaged as a 2-minute installer. The planned next step is a desktop app package:

```text
Download installer → open app → accept local/privacy notice → Logga in → calendar appears
```

Recommended packaging route:

- Tauri desktop wrapper.
- Windows `.msi`/`.exe` installer first.
- macOS `.dmg` later.
- GitHub Releases for free downloads.
- GitHub Pages for a simple download page.

See [`docs/DESKTOP_PACKAGING_PLAN.md`](./docs/DESKTOP_PACKAGING_PLAN.md).

## Legal/privacy note

This repository is designed for local use by a user who is authorized to access the SchoolSoft data. A hosted public service where other users log in through your server would be a different product and would need separate legal/privacy/security review and likely permission from relevant parties.
