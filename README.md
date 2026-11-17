# Gym Membership Manager BD

![status](https://img.shields.io/badge/status-published-brightgreen)
![tests](https://img.shields.io/badge/tests-13%20unit%20groups%20%2B%2054%20smoke-brightgreen)
![offline](https://img.shields.io/badge/offline-100%25-blue)

An offline, bilingual (English / বাংলা) gym membership manager for small gyms
in Bangladesh. Track members, membership plans, fee payments, daily
attendance, and renewals — entirely in the browser, with no server and no
network calls.

## Problem

Small neighbourhood gyms in Bangladesh usually track memberships in paper
notebooks: who paid, whose membership ends this week, who showed up today.
That notebook gets lost, the due amounts get fuzzy, and expired members keep
training for free. This app digitises that notebook with exact money math
(integer paisa, never floats) and a clear expiry watch.

## Features

- **Membership plans** — create plans with a name, duration (1–24 months) and
  fee. No prices are shipped: every fee is one you enter.
- **Members** — name, Bangladeshi mobile validation (`01XXXXXXXXX`), gender,
  trainer, notes. End date is computed automatically from the plan
  (`addMonths` clamps Jan 31 + 1 month to Feb 28).
- **Status watch** — Active / Expiring soon (7 days or fewer, including today)
  / Expired, with days-left / days-overdue labels and an expiring-soon list on
  the dashboard.
- **Payments** — record cash / bKash / Nagad / bank payments per member.
  Due = plan fee − payments made in the current cycle. Monthly collection and
  total due on the dashboard.
- **Renewal** — one tap renews a member: an active membership continues from
  its end date; an expired one restarts from today.
- **Attendance** — one check-in per member per day, per-day and per-month
  counts, and a consecutive-day streak.
- **Search & filters** — search by name or mobile; filter by status.
- **Data** — JSON export, strict-validated import (a bad file changes nothing),
  and typed-`DELETE` erase-all.
- **Bilingual** — EN / বাংলা toggle, persisted; Bengali digits throughout.
- **Offline** — zero network requests; all data in `localStorage`.

## Stack

- Vanilla HTML + CSS + JavaScript (no frameworks, no build step, no CDN).
- Pure logic in `js/logic.js` (Node-testable, no DOM).
- Bengali strings live in `tools/gen_i18n.py` and are generated into
  `js/i18n.js` as pure-ASCII `\uXXXX` escapes (`python3 tools/gen_i18n.py`).
- All app sources are pure ASCII — verified with `grep -P '[^\x00-\x7F]'`.

## Prerequisites

Any modern browser. For tests: Node.js 18+ and a headless Chromium
(`headless_shell` is used by the smoke test; edit the `SHELL` path in
`tests/smoke.mjs` if yours lives elsewhere).

## Install & run

```sh
# Just open it — no install step.
open index.html
# or serve it locally:
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Development commands

```sh
node tests/test.js     # unit tests (node:test)
node tests/smoke.mjs   # headless-Chrome smoke test (drives the real UI)
python3 tools/gen_i18n.py   # regenerate js/i18n.js after editing strings
```

## Testing

- **Unit:** 13 test groups, 81 assertions — date math (incl. leap-year
  clamping), status boundaries, due/collection math, renew rules, streaks,
  phone/plan/member/payment validation, strict import validation.
  Run: `node tests/test.js` → 13 pass, 0 fail.
- **Smoke:** 54 headless-Chrome checks — full user flows (add plan → add
  member → check-in → pay → renew), validation rejections, search/filters,
  BN toggle, reload persistence, export/import round-trip, typed-DELETE
  erase, plan-delete guard, 390px mobile on all 5 tabs, 0 console errors,
  0 non-file network requests. Run: `node tests/smoke.mjs` → 54 pass, 0 fail.
- See `TEST_RESULTS.md` for the hand-verified numbers.

## Deployment

Static site — deploy anywhere that serves static files. GitHub Pages:
push to `main` and enable Pages (branch `main`, folder `/ (root)`).

## Limitations

- **Single-device storage.** Data lives in the browser's `localStorage`.
  Export JSON regularly; there is no sync, no multi-user access, and clearing
  browser data erases everything.
- **Due is per current cycle.** A payment dated on or after the member's
  cycle start counts toward that cycle's fee. A payment made on the same day
  a renewal starts counts toward the *new* cycle.
- **No reminders.** Expiry is shown in-app only; there are no SMS/push
  notifications.
- **Demo-grade estimates.** The app never ships prices, fees, or member data.
  Everything is what you enter; confirm money against your own records.
- **Not accounting software.** This is a personal shop notebook, not a tax
  or audit system.

## Status

Published and verified. See `TEST_RESULTS.md` for the full test record.
