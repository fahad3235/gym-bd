/* gym-bd unit tests — node:test + assert/strict. Run: node tests/test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

const TAKA = '\u09f3';
function stateWith(plan, member, payments, attendance) {
  const s = L.emptyState();
  if (plan) s.plans.push(plan);
  if (member) s.members.push(member);
  if (payments) s.payments = payments;
  if (attendance) s.attendance = attendance;
  return s;
}
const PLAN = { id: 'p1', name: 'Monthly', months: 1, feePaisa: 150000 };
const MEMBER = { id: 'm1', name: 'Rahim', phone: '01712345678', gender: 'male',
  planId: 'p1', startDate: '2026-10-17', endDate: '2026-11-17', trainer: '', notes: '' };

test('digits and money formatting', () => {
  assert.equal(L.toBnDigits('2026'), '\u09e8\u09e6\u09e8\u09ec');
  assert.equal(L.fmtNum(1234567, 'en'), '1,234,567');
  assert.equal(L.fmtNum(1234, 'bn'), '\u09e7,\u09e8\u09e9\u09ea');
  assert.equal(L.fmtMoney(150000, 'en'), TAKA + '1,500.00');
  assert.equal(L.fmtMoney(150000, 'bn'), TAKA + '\u09e7,\u09eb\u09e6\u09e6.\u09e6\u09e6');
  assert.equal(L.fmtMoney(0, 'en'), TAKA + '0.00');
  assert.equal(L.fmtMoney(null, 'en'), TAKA + '\u2014');
  assert.equal(L.fmtDate('2026-11-17', 'bn'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e7-\u09e7\u09ed');
});

test('addMonths clamps to month end', () => {
  assert.equal(L.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(L.addMonths('2026-10-17', 1), '2026-11-17');
  assert.equal(L.addMonths('2026-11-17', 3), '2027-02-17');
  assert.equal(L.addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(L.addMonths('2024-01-31', 1), '2024-02-29'); // leap year
  assert.equal(L.addMonths('2026-12-15', 12), '2027-12-15');
});

test('parseDate rejects invalid dates', () => {
  assert.equal(L.parseDate('2026-02-30'), null);
  assert.equal(L.parseDate('2026-13-01'), null);
  assert.equal(L.parseDate('not-a-date'), null);
  assert.equal(L.parseDate('2026-11-17') instanceof Date, true);
  assert.equal(L.daysBetween('2026-11-17', '2026-11-20'), 3);
  assert.equal(L.daysBetween('2026-11-20', '2026-11-17'), -3);
});

test('member status boundaries (asof 2026-11-17)', () => {
  const asof = '2026-11-17';
  assert.equal(L.memberStatus({ endDate: '2026-11-17' }, asof), 'expiring'); // ends today
  assert.equal(L.memberStatus({ endDate: '2026-11-24' }, asof), 'expiring'); // 7 days
  assert.equal(L.memberStatus({ endDate: '2026-11-25' }, asof), 'active');   // 8 days
  assert.equal(L.memberStatus({ endDate: '2026-11-16' }, asof), 'expired');  // yesterday
  assert.equal(L.memberStatus({ endDate: '2027-01-01' }, asof), 'active');
});

test('due math: fee minus payments in current cycle only', () => {
  const s = stateWith(PLAN, MEMBER, [
    { id: 'x1', memberId: 'm1', amountPaisa: 100000, date: '2026-10-20', method: 'cash', note: '' },
    { id: 'x2', memberId: 'm1', amountPaisa: 50000, date: '2026-11-01', method: 'bkash', note: '' }
  ]);
  assert.equal(L.memberDue(s, MEMBER), 0); // 100000 + 50000 = 150000 = fee
  assert.equal(L.memberPaid(s, MEMBER), 150000);
  // Payment before cycle start does NOT count.
  const s2 = stateWith(PLAN, MEMBER, [
    { id: 'x1', memberId: 'm1', amountPaisa: 150000, date: '2026-10-16', method: 'cash', note: '' }
  ]);
  assert.equal(L.memberDue(s2, MEMBER), 150000);
  // Partial payment leaves exact due.
  const s3 = stateWith(PLAN, MEMBER, [
    { id: 'x1', memberId: 'm1', amountPaisa: 60000, date: '2026-10-18', method: 'cash', note: '' }
  ]);
  assert.equal(L.memberDue(s3, MEMBER), 90000);
  // No plan -> null due.
  assert.equal(L.memberDue(stateWith(null, MEMBER), MEMBER), null);
});

test('collectedInMonth and totalDue', () => {
  const s = stateWith(PLAN, MEMBER, [
    { id: 'x1', memberId: 'm1', amountPaisa: 100000, date: '2026-11-02', method: 'cash', note: '' },
    { id: 'x2', memberId: 'm1', amountPaisa: 50000, date: '2026-10-20', method: 'bkash', note: '' }
  ]);
  assert.equal(L.collectedInMonth(s, 2026, 11), 100000);
  assert.equal(L.collectedInMonth(s, 2026, 10), 50000);
  assert.equal(L.collectedInMonth(s, 2026, 12), 0);
  assert.equal(L.totalDue(s), 0); // 100000 + 50000 = fee, fully paid
  const s2 = stateWith(PLAN, MEMBER, [
    { id: 'x1', memberId: 'm1', amountPaisa: 100000, date: '2026-11-02', method: 'cash', note: '' }
  ]);
  assert.equal(L.totalDue(s2), 50000); // 150000 - 100000
});

test('renew: active renews from endDate, expired renews from today', () => {
  const active = Object.assign({}, MEMBER, { endDate: '2026-11-17' });
  const r1 = L.renewMember(stateWith(PLAN, active), active, '2026-11-10');
  assert.equal(r1.startDate, '2026-11-17');
  assert.equal(r1.endDate, '2026-12-17');
  const expired = Object.assign({}, MEMBER, { endDate: '2026-10-17' });
  const r2 = L.renewMember(stateWith(PLAN, expired), expired, '2026-11-17');
  assert.equal(r2.startDate, '2026-11-17');
  assert.equal(r2.endDate, '2026-12-17');
  assert.equal(L.renewMember(stateWith(null, MEMBER), MEMBER, '2026-11-17'), null);
});

test('attendance: check-in, month count, streak', () => {
  const s = stateWith(PLAN, MEMBER, [], [
    { memberId: 'm1', date: '2026-11-15' },
    { memberId: 'm1', date: '2026-11-16' },
    { memberId: 'm1', date: '2026-11-17' },
    { memberId: 'm1', date: '2026-10-31' }
  ]);
  assert.equal(L.checkedInOn(s, 'm1', '2026-11-17'), true);
  assert.equal(L.checkedInOn(s, 'm1', '2026-11-14'), false);
  assert.equal(L.checkInsOn(s, '2026-11-17'), 1);
  assert.equal(L.monthAttendance(s, 'm1', 2026, 11), 3);
  assert.equal(L.monthAttendance(s, 'm1', 2026, 10), 1);
  assert.equal(L.attendanceStreak(s, 'm1', '2026-11-17'), 3);
  // Gap breaks streak: only 2026-11-17 present -> 1.
  const s2 = stateWith(PLAN, MEMBER, [], [{ memberId: 'm1', date: '2026-11-17' }]);
  assert.equal(L.attendanceStreak(s2, 'm1', '2026-11-17'), 1);
  // No check-in today but yesterday -> streak counts from yesterday.
  const s3 = stateWith(PLAN, MEMBER, [], [
    { memberId: 'm1', date: '2026-11-15' }, { memberId: 'm1', date: '2026-11-16' }]);
  assert.equal(L.attendanceStreak(s3, 'm1', '2026-11-17'), 2);
  // Nothing at all -> 0.
  assert.equal(L.attendanceStreak(L.emptyState(), 'm1', '2026-11-17'), 0);
});

test('phone validation', () => {
  assert.equal(L.validatePhone('01712345678'), true);
  assert.equal(L.validatePhone('01987654321'), true);
  assert.equal(L.validatePhone('01212345678'), false); // 012 not a BD mobile prefix
  assert.equal(L.validatePhone('0171234567'), false);  // too short
  assert.equal(L.validatePhone('017123456789'), false); // too long
  assert.equal(L.validatePhone(''), false);
});

test('plan validation', () => {
  assert.deepEqual(L.validatePlan({ name: 'Monthly', months: 1, feeTaka: 1500 }), {});
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'M', months: 1, feeTaka: 1500 })), ['name']);
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'Monthly', months: 0, feeTaka: 1500 })), ['months']);
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'Monthly', months: 25, feeTaka: 1500 })), ['months']);
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'Monthly', months: 1.5, feeTaka: 1500 })), ['months']);
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'Monthly', months: 1, feeTaka: -5 })), ['fee']);
  assert.deepEqual(Object.keys(L.validatePlan({ name: 'Monthly', months: 1, feeTaka: 0 })), []); // free plan allowed
});

test('member validation', () => {
  const s = stateWith(PLAN, null);
  const good = { name: 'Rahim Uddin', phone: '01712345678', planId: 'p1', startDate: '2026-11-17' };
  assert.deepEqual(L.validateMember(s, good), {});
  assert.deepEqual(Object.keys(L.validateMember(s, Object.assign({}, good, { name: 'R' }))), ['name']);
  assert.deepEqual(Object.keys(L.validateMember(s, Object.assign({}, good, { phone: '123' }))), ['phone']);
  assert.deepEqual(Object.keys(L.validateMember(s, Object.assign({}, good, { planId: 'nope' }))), ['planId']);
  assert.deepEqual(Object.keys(L.validateMember(s, Object.assign({}, good, { startDate: '2026-02-30' }))), ['startDate']);
});

test('payment validation', () => {
  const asof = '2026-11-17';
  assert.deepEqual(L.validatePayment({ amountTaka: 1500, date: '2026-11-17', method: 'cash' }, asof), {});
  assert.deepEqual(Object.keys(L.validatePayment({ amountTaka: 0, date: '2026-11-17', method: 'cash' }, asof)), ['amount']);
  assert.deepEqual(Object.keys(L.validatePayment({ amountTaka: -50, date: '2026-11-17', method: 'cash' }, asof)), ['amount']);
  assert.deepEqual(Object.keys(L.validatePayment({ amountTaka: 1500, date: '2026-11-18', method: 'cash' }, asof)), ['date']);
  assert.deepEqual(Object.keys(L.validatePayment({ amountTaka: 1500, date: '2026-11-17', method: 'card' }, asof)), ['method']);
});

test('import validation: strict', () => {
  const good = L.emptyState();
  good.plans.push(PLAN);
  good.members.push(MEMBER);
  good.payments.push({ id: 'x1', memberId: 'm1', amountPaisa: 100000, date: '2026-10-20', method: 'cash', note: '' });
  good.attendance.push({ memberId: 'm1', date: '2026-11-17' });
  assert.deepEqual(L.validateImport(JSON.parse(JSON.stringify(good))), []);
  assert.ok(L.validateImport({ v: 9 }).length > 0);
  assert.ok(L.validateImport(null).length > 0);
  assert.ok(L.validateImport({ v: 1 }).length > 0);
  const badPhone = JSON.parse(JSON.stringify(good));
  badPhone.members[0].phone = '123';
  assert.ok(L.validateImport(badPhone).length > 0);
  const badPlan = JSON.parse(JSON.stringify(good));
  badPlan.members[0].planId = 'missing';
  assert.ok(L.validateImport(badPlan).length > 0);
  const dupAtt = JSON.parse(JSON.stringify(good));
  dupAtt.attendance.push({ memberId: 'm1', date: '2026-11-17' });
  assert.ok(L.validateImport(dupAtt).length > 0);
  const badPay = JSON.parse(JSON.stringify(good));
  badPay.payments[0].amountPaisa = -5;
  assert.ok(L.validateImport(badPay).length > 0);
  const badDate = JSON.parse(JSON.stringify(good));
  badDate.members[0].startDate = '2026-02-30';
  assert.ok(L.validateImport(badDate).length > 0);
});
