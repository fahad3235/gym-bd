# gym-bd — TEST RESULTS

Run: 2026-11-17, 17:00 slot (run #366). Deterministic date: `?asof=2026-11-17`.

## Unit tests — `node tests/test.js`

**13 test groups, 81 assertions — 13 pass, 0 fail.**

Hand-verified values asserted:

- Money: `fmtMoney(150000, 'en')` = `৳1,500.00`; Bengali `৳১,৫০০.০০`.
- `addMonths('2026-01-31', 1)` = `2026-02-28`; leap year `2024-01-31 + 1mo` =
  `2024-02-29`; `2026-08-31 + 6mo` = `2027-02-28`.
- Status boundaries (asof 2026-11-17): ends today → expiring; ends in 7 days →
  expiring; ends in 8 days → active; ends yesterday → expired.
- Due: fee ৳1,500.00 − payments ৳1,000.00 + ৳500.00 in cycle = ৳0.00 due;
  a payment dated *before* the cycle start does not count; partial payment
  ৳600.00 leaves exactly ৳900.00 due.
- Renew: active member renews from end date (2026-11-17 → 2026-12-17);
  expired member renews from today.
- Streak: 3 consecutive days = 3; a gap breaks it; no check-in today but two
  prior days = 2; none = 0.
- Phone: `01712345678` valid; `012…`, 10-digit, 12-digit all rejected.
- Import: 8 malformed variants rejected (bad version, missing arrays, bad
  phone, unknown plan, duplicate attendance, negative payment, bad date).

One test-side fix during the run: the `collectedInMonth and totalDue` test
initially expected totalDue ৳500.00, but both payments (Oct 20 + Nov 2) fall
inside the cycle starting Oct 17, so the correct due is ৳0.00. The test
expectation was wrong, not the app — corrected and re-run green.

## Smoke tests — `node tests/smoke.mjs` (raw CDP, headless_shell-1187)

**54 checks — 54 pass, 0 fail. 0 console/page errors. 0 non-file network requests.**

Hand-verified flow (asof 2026-11-17):

- Plans: Monthly 1 mo ৳1,500.00 + Quarterly 3 mo ৳4,000.00 added; empty-name
  add rejected inline, count stayed 1.
- Members: Rahim Uddin `01712345678`, Monthly, start 2026-10-17 → ends
  2026-11-17, status "Expiring soon", due ৳1,500.00. Bad phone `12345`
  rejected inline.
- Check-in: Rahim checked in → button becomes "Checked in", dashboard
  "Checked in today" = 1.
- Payment: ৳1,000.00 cash on 2026-11-17 → due ৳500.00, "Collected this
  month" ৳1,000.00. Zero-amount payment rejected inline, modal stays open.
- Renew: Rahim renewed → ends 2026-12-17, status Active, due ৳500.00 (the
  Nov 17 payment counts in the new cycle — documented in README).
- Karim Hossain `01987654321`, Quarterly, start 2026-11-01 → ends 2027-02-01.
  Dashboard: active 2, total due ৳4,500.00.
- Search "karim" → 1 card; cleared → 2 cards. Expired filter → empty state.
- Attendance tab: summary "1 checked in"; Karim check-in available.
- BN toggle: title shows Bengali, collected shows `৳১,০০০.০০`; toggles back.
- Reload persistence: 2 members survive a fresh page load (same profile).
- Export/import round-trip: localStorage snapshot → typed-DELETE erase →
  0 members → import snapshot → 2 members, "Imported" message.
- Plan-delete guard: Monthly (in use) cannot be deleted.
- 390px mobile: no horizontal overflow on all 5 tabs.

## Build incident (fixed, no impact on results)

During ASCII hygiene, the first conversion script opened `js/app.js` for
writing and then raised `UnicodeEncodeError` before writing — leaving
`app.js` at 0 bytes. The smoke run caught it immediately (empty member/plan
lists, no errors). `app.js` was rewritten from scratch with the escapes
already in place, re-verified pure-ASCII, and both suites re-run green
(13/13 unit, 54/54 smoke). Lesson: convert via temp file + move, never
open the target for writing before the conversion succeeds.

## Semantics note

Due is per current cycle: a payment dated on or after the member's cycle
start counts toward that cycle's fee. Renewing on the same day a payment was
made therefore carries that payment into the new cycle. This is deliberate
and documented in the README.
