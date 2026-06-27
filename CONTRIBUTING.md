# Contributing

Thanks for helping improve this local SchoolSoft calendar helper.

## Important privacy rule

Do not commit real SchoolSoft data, screenshots, diagnostics, cookies, browser profiles, student names, teacher names, grades, rooms, or extracted event files.

The following should stay local only:

```text
data/*.json
data/*.ics
.playwright-user-data/
snapshots/
schoolsoft.config.json
```

When reporting parser bugs, share only tiny anonymized examples of the structure needed to reproduce the problem.

## Development check

```bash
npm install
npm run check
```
