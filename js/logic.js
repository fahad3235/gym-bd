'use strict';
/* gym-bd pure logic - no DOM, no localStorage. Node-testable.
 * Money is integer PAISA (1 BDT = 100 paisa) to avoid float error.
 * Dates are ISO yyyy-mm-dd strings. `asof` is always an ISO date.
 * All sources are pure ASCII; Bengali lives in js/i18n.js as \uXXXX. */
(function (root) {
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
    '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  var TAKA = '\u09f3';
  var PHONE_RE = /^01[3-9][0-9]{8}$/;
  var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function fmtNum(n, lang) {
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return lang === 'bn' ? toBnDigits(s) : s;
  }
  /* paisa -> "Tk 1,500.00" (BDT with 2 decimals; integer paisa is exact). */
  function fmtMoney(paisa, lang) {
    if (paisa === null || paisa === undefined || typeof paisa !== 'number' || !isFinite(paisa)) return TAKA + '\u2014';
    var neg = paisa < 0 ? '-' : '';
    var abs = Math.abs(Math.round(paisa));
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var s = fmtNum(whole, lang) + '.' + (frac < 10 ? '0' : '') + frac;
    return TAKA + neg + (lang === 'bn' ? toBnDigits(s) : s);
  }
  function fmtDate(iso, lang) {
    if (!iso || !ISO_RE.test(iso)) return '\u2014';
    return lang === 'bn' ? toBnDigits(iso) : iso;
  }

  function parseDate(iso) {
    if (typeof iso !== 'string' || !ISO_RE.test(iso)) return null;
    var p = iso.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
    return d;
  }
  function toISO(d) {
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function todayISO(now) {
    var d = now ? new Date(now) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }
  /* Add months, clamping the day to the target month's end (Jan 31 + 1mo = Feb 28). */
  function addMonths(iso, months) {
    var d = parseDate(iso);
    if (!d || !isFinite(months)) return null;
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + months;
    var day = d.getUTCDate();
    var target = new Date(Date.UTC(y, m, 1));
    var last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, last));
    return toISO(target);
  }
  function daysBetween(aISO, bISO) {
    var a = parseDate(aISO), b = parseDate(bISO);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function emptyState() {
    return { v: 1, plans: [], members: [], payments: [], attendance: [], lang: 'en' };
  }

  /* ---- membership status ---- */
  function memberStatus(member, asof) {
    var left = daysBetween(asof, member.endDate);
    if (left === null) return 'expired';
    if (left < 0) return 'expired';
    if (left <= 7) return 'expiring';
    return 'active';
  }
  function planById(state, planId) {
    return state.plans.find(function (p) { return p.id === planId; }) || null;
  }
  function memberById(state, memberId) {
    return state.members.find(function (m) { return m.id === memberId; }) || null;
  }
  /* Due for the CURRENT cycle: plan fee minus payments dated on/after startDate. */
  function memberDue(state, member) {
    var plan = planById(state, member.planId);
    if (!plan) return null;
    var paid = state.payments
      .filter(function (p) { return p.memberId === member.id && p.date >= member.startDate; })
      .reduce(function (s, p) { return s + p.amountPaisa; }, 0);
    return Math.max(0, plan.feePaisa - paid);
  }
  function memberPaid(state, member) {
    return state.payments
      .filter(function (p) { return p.memberId === member.id && p.date >= member.startDate; })
      .reduce(function (s, p) { return s + p.amountPaisa; }, 0);
  }
  function collectedInMonth(state, year, month) {
    var prefix = year + '-' + String(month).padStart(2, '0') + '-';
    return state.payments
      .filter(function (p) { return p.date.indexOf(prefix) === 0; })
      .reduce(function (s, p) { return s + p.amountPaisa; }, 0);
  }
  function totalDue(state) {
    return state.members.reduce(function (s, m) {
      var d = memberDue(state, m);
      return s + (d === null ? 0 : d);
    }, 0);
  }
  function checkedInOn(state, memberId, dateISO) {
    return state.attendance.some(function (a) { return a.memberId === memberId && a.date === dateISO; });
  }
  function checkInsOn(state, dateISO) {
    return state.attendance.filter(function (a) { return a.date === dateISO; }).length;
  }
  function monthAttendance(state, memberId, year, month) {
    var prefix = year + '-' + String(month).padStart(2, '0') + '-';
    return state.attendance.filter(function (a) {
      return a.memberId === memberId && a.date.indexOf(prefix) === 0;
    }).length;
  }
  /* Consecutive-day streak ending today (or yesterday if not checked in today). */
  function attendanceStreak(state, memberId, asof) {
    var days = {};
    state.attendance.forEach(function (a) {
      if (a.memberId === memberId) days[a.date] = true;
    });
    var cursor = parseDate(asof);
    if (!cursor) return 0;
    if (!days[toISO(cursor)]) cursor = new Date(cursor.getTime() - 86400000);
    var streak = 0;
    while (days[toISO(cursor)]) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }
  /* Renew: new cycle starts at endDate if still active, else today. */
  function renewMember(state, member, asof) {
    var plan = planById(state, member.planId);
    if (!plan) return null;
    var base = member.endDate >= asof ? member.endDate : asof;
    var next = Object.assign({}, member, {
      startDate: base,
      endDate: addMonths(base, plan.months)
    });
    return next;
  }

  /* ---- validation (returns an object of field -> error key; empty = valid) ---- */
  function validatePlan(inp) {
    var e = {};
    if (!inp.name || inp.name.trim().length < 2 || inp.name.trim().length > 60) e.name = 'errName';
    if (!isFinite(inp.months) || Math.floor(inp.months) !== inp.months || inp.months < 1 || inp.months > 24) e.months = 'errMonths';
    if (!isFinite(inp.feeTaka) || inp.feeTaka < 0 || inp.feeTaka > 10000000) e.fee = 'errFee';
    return e;
  }
  function validateMember(state, inp) {
    var e = {};
    if (!inp.name || inp.name.trim().length < 2 || inp.name.trim().length > 60) e.name = 'errName';
    if (!PHONE_RE.test(String(inp.phone || '').trim())) e.phone = 'errPhone';
    if (!planById(state, inp.planId)) e.planId = 'errPlan';
    if (!parseDate(inp.startDate)) e.startDate = 'errDate';
    return e;
  }
  function validatePayment(inp, asof) {
    var e = {};
    if (!isFinite(inp.amountTaka) || inp.amountTaka <= 0 || inp.amountTaka > 10000000) e.amount = 'errAmount';
    if (!parseDate(inp.date)) e.date = 'errDate';
    else if (inp.date > asof) e.date = 'errFuture';
    if (['cash', 'bkash', 'nagad', 'bank'].indexOf(inp.method) < 0) e.method = 'errRequired';
    return e;
  }
  function validatePhone(phone) { return PHONE_RE.test(String(phone || '').trim()); }

  /* ---- import validation: strict; anything off -> reject whole file ---- */
  function validateImport(obj) {
    var errs = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['not an object'];
    if (obj.v !== 1) errs.push('bad version');
    if (!Array.isArray(obj.plans) || !Array.isArray(obj.members) ||
        !Array.isArray(obj.payments) || !Array.isArray(obj.attendance)) errs.push('missing arrays');
    if (errs.length) return errs;
    var planIds = {};
    obj.plans.forEach(function (p, i) {
      if (!p || typeof p.id !== 'string' || !p.id) errs.push('plans[' + i + '].id');
      if (!p || typeof p.name !== 'string' || p.name.trim().length < 2) errs.push('plans[' + i + '].name');
      if (!p || !isFinite(p.months) || p.months < 1 || p.months > 24) errs.push('plans[' + i + '].months');
      if (!p || !isFinite(p.feePaisa) || p.feePaisa < 0) errs.push('plans[' + i + '].feePaisa');
      if (p && p.id) planIds[p.id] = true;
    });
    var memberIds = {};
    obj.members.forEach(function (m, i) {
      if (!m || typeof m.id !== 'string' || !m.id) errs.push('members[' + i + '].id');
      if (!m || typeof m.name !== 'string' || m.name.trim().length < 2) errs.push('members[' + i + '].name');
      if (!m || !PHONE_RE.test(String(m.phone || ''))) errs.push('members[' + i + '].phone');
      if (!m || !planIds[m.planId]) errs.push('members[' + i + '].planId');
      if (!m || !parseDate(m.startDate) || !parseDate(m.endDate)) errs.push('members[' + i + '].dates');
      if (m && m.id) memberIds[m.id] = true;
    });
    obj.payments.forEach(function (p, i) {
      if (!p || !memberIds[p.memberId]) errs.push('payments[' + i + '].memberId');
      if (!p || !isFinite(p.amountPaisa) || p.amountPaisa <= 0) errs.push('payments[' + i + '].amountPaisa');
      if (!p || !parseDate(p.date)) errs.push('payments[' + i + '].date');
    });
    var seen = {};
    obj.attendance.forEach(function (a, i) {
      if (!a || !memberIds[a.memberId]) errs.push('attendance[' + i + '].memberId');
      if (!a || !parseDate(a.date)) errs.push('attendance[' + i + '].date');
      var k = a.memberId + '|' + a.date;
      if (seen[k]) errs.push('attendance[' + i + '] duplicate');
      seen[k] = true;
    });
    return errs;
  }

  var api = {
    BN_DIGITS: BN_DIGITS, TAKA: TAKA,
    toBnDigits: toBnDigits, fmtNum: fmtNum, fmtMoney: fmtMoney, fmtDate: fmtDate,
    parseDate: parseDate, toISO: toISO, todayISO: todayISO, addMonths: addMonths,
    daysBetween: daysBetween, emptyState: emptyState,
    memberStatus: memberStatus, planById: planById, memberById: memberById,
    memberDue: memberDue, memberPaid: memberPaid, collectedInMonth: collectedInMonth,
    totalDue: totalDue, checkedInOn: checkedInOn, checkInsOn: checkInsOn,
    monthAttendance: monthAttendance, attendanceStreak: attendanceStreak,
    renewMember: renewMember,
    validatePlan: validatePlan, validateMember: validateMember,
    validatePayment: validatePayment, validatePhone: validatePhone,
    validateImport: validateImport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GymLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
