# Privacy model

This project is intentionally local-first.

## Core promise

When used as distributed in this repository, SchoolSoft data does **not** reach the project maintainers or any central server controlled by us.

The app runs a small local server on `localhost` so the web interface can talk to the local extractor. That local server is on the user's own computer. It is not our server.

## What is stored locally

The app may store these files on the user's own computer:

- `.playwright-user-data/` — a local browser profile/session so the user does not need to log in every time.
- `data/events.json` — extracted SchoolSoft calendar events.
- `data/last-run.json` — local sync/coverage metadata.
- `data/user-state.json` — local notes, manually added events, done markers, and trash state.
- `data/events.ics` — a generated local calendar feed if produced by the app/check script.
- `snapshots/` — optional local diagnostics for debugging extraction failures.

These paths are ignored by Git and should not be published.

## What is not sent to us

- SchoolSoft password.
- BankID credentials.
- SchoolSoft cookies/session data.
- Student names, teachers, rooms, assessment dates, grades/results, notes, or manually added events.
- Usage analytics.

## Network traffic

The app connects to SchoolSoft from the user's computer after the user logs in. It does not proxy the SchoolSoft session through a maintainer server.

If someone modifies this project to host a shared public service where other users log in through that hosted service, that is a different privacy/legal model and needs separate review.

## Delete local data

The app includes a local data deletion button in the sidebar. It can delete extracted calendar data, notes, manual events, trash/done state, and optionally the saved local SchoolSoft browser session.

Manual deletion is also possible by removing:

```text
data/*.json
data/*.ics
.playwright-user-data/
snapshots/
```

## Public releases

A public release should be framed as an unofficial local helper, not an official SchoolSoft integration. Users should only use it with SchoolSoft information they are authorized to access.
