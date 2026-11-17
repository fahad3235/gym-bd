/* gym-bd headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the gym-bd folder)
 * Loads index.html over file://?asof=2026-11-17, drives the real UI,
 * collects console/page errors, asserts visible state at 1440px and 390px.
 * Uses a FRESH headless_shell profile each run so stale localStorage
 * never pollutes a run. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file:///home/hatch/workspace/muse-project-factory/builds/gym-bd/index.html?asof=2026-11-17';
const PORT = 9233;
const PROFILE = `/tmp/gymbd-smoke-${process.pid}`;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function click(selector) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('missing ' + ${JSON.stringify(selector)}); e.click(); return true; })()`);
}
const setVal = (sel, v) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);

  /* ---- initial render ---- */
  check('title is Gym Membership Manager BD', await evalJs(`document.title.includes('Gym Membership Manager')`));
  check('header renders', await evalJs(`document.querySelector('#appTitle').textContent.includes('Gym')`));
  check('5 tabs present', await evalJs(`document.querySelectorAll('.tab').length`) === 5);
  check('members empty state visible', await evalJs(`document.querySelector('#member-list').textContent.includes('No members yet')`));
  check('plans empty state visible', await evalJs(`document.querySelector('#plan-list').textContent.includes('No plans yet')`));
  check('stats all zero', await evalJs(`document.querySelector('#stat-active').textContent`) === '0');
  check('no horizontal overflow at 1440px', await evalJs(`document.documentElement.scrollWidth <= 1440`));

  /* ---- add plan Monthly: 1 mo, 1500 ---- */
  await click('[data-tab="plans"]');
  await sleep(300);
  await setVal('#p-name', 'Monthly');
  await setVal('#p-months', '1');
  await setVal('#p-fee', '1500');
  await click('#plan-form button[type="submit"]');
  await sleep(300);
  check('1 plan card after adding Monthly', await evalJs(`document.querySelectorAll('#plan-list .plan').length`) === 1);
  check('Monthly shows fee 1,500.00', await evalJs(`document.querySelector('#plan-list').textContent.includes('1,500.00')`));

  /* ---- plan validation: empty name rejected ---- */
  await setVal('#p-name', '');
  await setVal('#p-months', '1');
  await setVal('#p-fee', '100');
  await click('#plan-form button[type="submit"]');
  await sleep(300);
  check('empty plan name shows inline error', await evalJs(`document.querySelector('#e-p-name').textContent.length > 0`));
  check('plan count still 1 after bad add', await evalJs(`document.querySelectorAll('#plan-list .plan').length`) === 1);

  /* ---- add plan Quarterly: 3 mo, 4000 ---- */
  await setVal('#p-name', 'Quarterly');
  await setVal('#p-months', '3');
  await setVal('#p-fee', '4000');
  await click('#plan-form button[type="submit"]');
  await sleep(300);
  check('2 plan cards after adding Quarterly', await evalJs(`document.querySelectorAll('#plan-list .plan').length`) === 2);

  /* ---- add member Rahim: Monthly, start 2026-10-17 -> ends 2026-11-17 ---- */
  await click('[data-tab="members"]');
  await sleep(300);
  await setVal('#m-name', 'Rahim Uddin');
  await setVal('#m-phone', '01712345678');
  await setVal('#m-start', '2026-10-17');
  await click('#member-form button[type="submit"]');
  await sleep(300);
  check('1 member card after adding Rahim', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 1);
  check('Rahim ends 2026-11-17', await evalJs(`document.querySelector('#member-list').textContent.includes('2026-11-17')`));
  check('Rahim status is Expiring soon (ends today)', await evalJs(`document.querySelector('#member-list .badge').textContent.includes('Expiring soon')`));
  check('Rahim due is 1,500.00', await evalJs(`document.querySelector('#member-list').textContent.includes('1,500.00')`));

  /* ---- member validation: bad phone rejected ---- */
  await setVal('#m-name', 'Bad Phone');
  await setVal('#m-phone', '12345');
  await setVal('#m-start', '2026-11-17');
  await click('#member-form button[type="submit"]');
  await sleep(300);
  check('bad phone shows inline error', await evalJs(`document.querySelector('#e-m-phone').textContent.length > 0`));
  check('member count still 1 after bad add', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 1);

  /* ---- check-in Rahim today ---- */
  await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('[data-act="checkin"]').click()`);
  await sleep(300);
  check('check-in button becomes Checked in', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('[data-act="checkin"]').textContent.includes('Checked in')`));
  check('dashboard today count is 1', await evalJs(`document.querySelector('#stat-today').textContent`) === '1');

  /* ---- record payment 1000 cash for Rahim ---- */
  await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('[data-act="pay"]').click()`);
  await sleep(300);
  check('pay modal opens with due 1,500.00', await evalJs(`document.querySelector('#pay-member-name').textContent.includes('1,500.00')`));
  await setVal('#pay-amount', '1000');
  await setVal('#pay-date', '2026-11-17');
  await click('#pay-form button[type="submit"]');
  await sleep(300);
  check('modal closes after payment', await evalJs(`document.querySelector('#pay-modal').classList.contains('hidden')`));
  check('Rahim due is now 500.00', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).textContent.includes('500.00')`));
  check('collected this month is 1,000.00', await evalJs(`document.querySelector('#stat-collected').textContent.includes('1,000.00')`));

  /* ---- payment validation: amount 0 rejected ---- */
  await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('[data-act="pay"]').click()`);
  await sleep(300);
  await setVal('#pay-amount', '0');
  await setVal('#pay-date', '2026-11-17');
  await click('#pay-form button[type="submit"]');
  await sleep(300);
  check('zero amount shows inline error', await evalJs(`document.querySelector('#e-pay-amount').textContent.length > 0`));
  check('modal still open after bad payment', await evalJs(`!document.querySelector('#pay-modal').classList.contains('hidden')`));
  await click('#pay-cancel');
  await sleep(200);

  /* ---- renew Rahim: ends 2026-11-17 -> 2026-12-17 ---- */
  await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('[data-act="renew"]').click()`);
  await sleep(300);
  check('Rahim renewed to 2026-12-17', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).textContent.includes('2026-12-17')`));
  check('Rahim status is Active after renew', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).querySelector('.badge').textContent.includes('Active')`));
  check('Rahim due after renew is 500.00 (Nov 17 payment counts in new cycle)', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Rahim')).textContent.includes('500.00')`));

  /* ---- add member Karim: Quarterly, start 2026-11-01 -> ends 2027-02-01 ---- */
  await setVal('#m-name', 'Karim Hossain');
  await setVal('#m-phone', '01987654321');
  await evalJs(`(() => { const s = document.querySelector('#m-plan'); s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await setVal('#m-start', '2026-11-01');
  await click('#member-form button[type="submit"]');
  await sleep(300);
  check('2 member cards after adding Karim', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 2);
  check('Karim ends 2027-02-01', await evalJs(`[...document.querySelectorAll('#member-list .member')].find(c => c.textContent.includes('Karim')).textContent.includes('2027-02-01')`));
  check('dashboard active is 2', await evalJs(`document.querySelector('#stat-active').textContent`) === '2');
  check('dashboard total due is 4,500.00', await evalJs(`document.querySelector('#stat-due').textContent.includes('4,500.00')`));

  /* ---- search + filters ---- */
  await setVal('#member-search', 'karim');
  await sleep(300);
  check('search karim shows 1 card', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 1);
  await setVal('#member-search', '');
  await sleep(300);
  check('clearing search shows 2 cards', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 2);
  await click('[data-filter="expired"]');
  await sleep(300);
  check('expired filter shows empty state', await evalJs(`document.querySelector('#member-list').textContent.includes('No members yet')`));
  await click('[data-filter="all"]');
  await sleep(300);

  /* ---- attendance tab ---- */
  await click('[data-tab="attendance"]');
  await sleep(300);
  check('attendance summary says 1 checked in', await evalJs(`document.querySelector('#att-summary').textContent.includes('1')`));
  check('Karim check-in button available', await evalJs(`[...document.querySelectorAll('#att-list .rowline')].find(r => r.textContent.includes('Karim')).querySelector('button').textContent.includes('Check in')`));

  /* ---- Bengali toggle ---- */
  await click('#langToggle');
  await sleep(300);
  check('BN toggle shows Bengali title', await evalJs(`document.querySelector('#appTitle').textContent.includes('জিম')`));
  check('BN toggle shows Bengali digits in collected', await evalJs(`document.querySelector('#stat-collected').textContent.includes('১,০০০.০০')`));
  await click('#langToggle');
  await sleep(300);
  check('toggle back to English', await evalJs(`document.querySelector('#appTitle').textContent.includes('Gym')`));

  /* ---- reload persistence (same profile) ---- */
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);
  await click('[data-tab="members"]');
  await sleep(300);
  check('reload keeps 2 members', await evalJs(`document.querySelectorAll('#member-list .member').length`) === 2);

  /* ---- export/import round-trip via localStorage snapshot ---- */
  const snapshot = await evalJs(`localStorage.getItem('gymbd.v1')`);
  check('localStorage snapshot has 2 members', await evalJs(`JSON.parse(localStorage.getItem('gymbd.v1')).members.length`) === 2);
  await click('[data-tab="data"]');
  await sleep(300);
  await setVal('#erase-input', 'DELETE');
  await click('#erase-btn');
  await sleep(300);
  check('erase clears members', await evalJs(`JSON.parse(localStorage.getItem('gymbd.v1')).members.length`) === 0);
  await evalJs(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(snapshot)}], 'import.json', { type: 'application/json' })); const input = document.querySelector('#import-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await sleep(500);
  check('import restores 2 members', await evalJs(`JSON.parse(localStorage.getItem('gymbd.v1')).members.length`) === 2);
  check('import shows success message', await evalJs(`document.querySelector('#data-msg').textContent.includes('Imported')`));

  /* ---- plan delete blocked when members use it (stub dialogs) ---- */
  await evalJs(`window.alert = () => {}; window.confirm = () => true;`);
  await click('[data-tab="plans"]');
  await sleep(300);
  await evalJs(`document.querySelector('[data-plan-del]').click()`);
  await sleep(300);
  check('plan with members cannot be deleted', await evalJs(`document.querySelectorAll('#plan-list .plan').length`) === 2);

  /* ---- 390px mobile: no overflow on any tab ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  for (const tab of ['dashboard', 'members', 'plans', 'attendance', 'data']) {
    await click(`[data-tab="${tab}"]`);
    await sleep(300);
    check(`no horizontal overflow at 390px (${tab})`, await evalJs(`document.documentElement.scrollWidth <= 390`));
  }

  /* ---- error / network hygiene ---- */
  check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  const nonFile = netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:'));
  check('zero non-file network requests', nonFile.length === 0, nonFile.join(', ').slice(0, 300));
} catch (e) {
  fail++;
  console.log('FAIL harness error — ' + (e && e.message ? e.message : e));
} finally {
  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  chrome.kill();
  process.exit(fail ? 1 : 0);
}
