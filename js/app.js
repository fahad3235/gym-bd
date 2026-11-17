'use strict';
/* gym-bd app - DOM wiring over GymLogic. State in localStorage 'gymbd.v1'.
 * ?asof=YYYY-MM-DD overrides "today" (used by deterministic tests). */
(function () {
  var L = window.GymLogic;
  var KEY = 'gymbd.v1';
  var params = new URLSearchParams(location.search);
  var ASOF = params.get('asof') || L.todayISO();
  if (!L.parseDate(ASOF)) ASOF = L.todayISO();

  var state = load();
  var lang = state.lang || 'en';
  var view = 'dashboard';
  var memberFilter = 'all';
  var memberQuery = '';
  var editingMemberId = null;
  var payingMemberId = null;
  var attDate = ASOF;

  function t(k) {
    var dict = (window.GYM_I18N && window.GYM_I18N[lang]) || {};
    return dict[k] || (window.GYM_I18N.en[k] || k);
  }
  function fill(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? '' : vars[k]; });
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toPaisa(taka) { return Math.round(Number(taka) * 100); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return L.emptyState();
      var obj = JSON.parse(raw);
      if (L.validateImport(obj).length) return L.emptyState();
      obj.lang = obj.lang === 'bn' ? 'bn' : 'en';
      return obj;
    } catch (e) { return L.emptyState(); }
  }
  function save() {
    state.lang = lang;
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  /* ---------- i18n ---------- */
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langToggle').textContent = lang === 'en' ? '\u09ac\u09be\u0982\u09b2\u09be' : 'English';
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    view = name;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.view').forEach(function (s) { s.classList.add('hidden'); });
    $('view-' + name).classList.remove('hidden');
    render();
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });
  $('langToggle').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    save(); applyLang(); render();
  });

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    var y = +ASOF.slice(0, 4), m = +ASOF.slice(5, 7);
    var counts = { active: 0, expiring: 0, expired: 0 };
    state.members.forEach(function (mem) { counts[L.memberStatus(mem, ASOF)]++; });
    $('stat-active').textContent = L.fmtNum(counts.active + counts.expiring, lang);
    $('stat-expiring').textContent = L.fmtNum(counts.expiring, lang);
    $('stat-expired').textContent = L.fmtNum(counts.expired, lang);
    $('stat-collected').textContent = L.fmtMoney(L.collectedInMonth(state, y, m), lang);
    $('stat-due').textContent = L.fmtMoney(L.totalDue(state), lang);
    $('stat-today').textContent = L.fmtNum(L.checkInsOn(state, ASOF), lang);

    var soon = state.members
      .filter(function (mem) { return L.memberStatus(mem, ASOF) !== 'active'; })
      .sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; });
    $('expiring-list').innerHTML = soon.length ? soon.map(function (mem) {
      var st = L.memberStatus(mem, ASOF);
      var left = L.daysBetween(ASOF, mem.endDate);
      var when = st === 'expired'
        ? fill(t('daysOverdue'), { n: L.fmtNum(-left, lang) })
        : left === 0 ? t('endsToday') : fill(t('daysLeft'), { n: L.fmtNum(left, lang) });
      return '<div class="rowline"><span>' + esc(mem.name) + ' <span class="muted"> \u00b7 ' + esc(planName(mem.planId)) +
        '</span></span><span class="badge ' + st + '">' + t('status' + cap(st)) + ' \u00b7 ' + esc(when) + '</span></div>';
    }).join('') : '<p class="muted">' + esc(t('noExpiring')) + '</p>';

    var recent = state.payments.slice().sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); }).slice(0, 8);
    $('recent-payments').innerHTML = recent.length ? recent.map(function (p) {
      var mem = L.memberById(state, p.memberId);
      return '<div class="rowline"><span>' + esc(mem ? mem.name : '?') +
        ' <span class="muted"> \u00b7 ' + esc(L.fmtDate(p.date, lang)) + ' \u00b7 ' + esc(t(p.method)) + '</span></span><b>' +
        esc(L.fmtMoney(p.amountPaisa, lang)) + '</b></div>';
    }).join('') : '<p class="muted">' + esc(t('noPayments')) + '</p>';
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function planName(planId) {
    var p = L.planById(state, planId);
    return p ? p.name : '\u2014';
  }

  /* ---------- members ---------- */
  function fillPlanSelect() {
    var sel = $('m-plan');
    sel.innerHTML = state.plans.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.name) + ' - ' + esc(L.fmtMoney(p.feePaisa, lang)) +
        ' / ' + esc(L.fmtNum(p.months, lang)) + ' ' + esc(t('monthsShort')) + '</option>';
    }).join('');
  }
  function memberCard(mem) {
    var st = L.memberStatus(mem, ASOF);
    var left = L.daysBetween(ASOF, mem.endDate);
    var when = st === 'expired'
      ? fill(t('daysOverdue'), { n: L.fmtNum(-left, lang) })
      : left === 0 ? t('endsToday') : fill(t('daysLeft'), { n: L.fmtNum(left, lang) });
    var due = L.memberDue(state, mem);
    var paid = L.memberPaid(state, mem);
    var streak = L.attendanceStreak(state, mem.id, ASOF);
    var y = +ASOF.slice(0, 4), mo = +ASOF.slice(5, 7);
    var checkedToday = L.checkedInOn(state, mem.id, ASOF);
    return '<article class="member card">' +
      '<div class="m-head"><div><b>' + esc(mem.name) + '</b> <span class="muted">' + esc(mem.phone) + '</span>' +
      '<br><span class="muted">' + esc(planName(mem.planId)) + ' \u00b7 ' + esc(t('ends')) + ' ' + esc(L.fmtDate(mem.endDate, lang)) +
      ' (' + esc(when) + ')' + (mem.trainer ? ' \u00b7 ' + esc(mem.trainer) : '') + '</span></div>' +
      '<span class="badge ' + st + '">' + esc(t('status' + cap(st))) + '</span></div>' +
      '<div class="m-meta"><span>' + esc(t('due')) + ': <b>' + esc(L.fmtMoney(due, lang)) + '</b></span>' +
      '<span>' + esc(t('paid')) + ': ' + esc(L.fmtMoney(paid, lang)) + '</span>' +
      '<span>' + esc(L.fmtNum(L.monthAttendance(state, mem.id, y, mo), lang)) + ' ' + esc(t('monthCount')) + '</span>' +
      '<span>' + esc(L.fmtNum(streak, lang)) + ' ' + esc(t('streak')) + '</span></div>' +
      '<div class="row wrap-row">' +
      '<button class="btn btn-small" type="button" data-act="checkin" data-id="' + esc(mem.id) + '"' +
      (checkedToday ? ' disabled' : '') + '>' + esc(checkedToday ? t('checkedIn') : t('checkIn')) + '</button>' +
      '<button class="btn btn-small" type="button" data-act="pay" data-id="' + esc(mem.id) + '">' + esc(t('pay')) + '</button>' +
      '<button class="btn btn-small" type="button" data-act="renew" data-id="' + esc(mem.id) + '">' + esc(t('renew')) + '</button>' +
      '<button class="btn btn-small" type="button" data-act="edit" data-id="' + esc(mem.id) + '">' + esc(t('edit')) + '</button>' +
      '<button class="btn btn-small btn-danger" type="button" data-act="del" data-id="' + esc(mem.id) + '">' + esc(t('delete')) + '</button>' +
      '</div></article>';
  }
  function renderMembers() {
    fillPlanSelect();
    var list = state.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (memberQuery) {
      var q = memberQuery.toLowerCase();
      list = list.filter(function (m) { return m.name.toLowerCase().indexOf(q) >= 0 || m.phone.indexOf(q) >= 0; });
    }
    if (memberFilter !== 'all') list = list.filter(function (m) { return L.memberStatus(m, ASOF) === memberFilter; });
    $('member-list').innerHTML = list.length ? list.map(memberCard).join('')
      : '<p class="muted">' + esc(t('noMembers')) + '</p>';
  }
  $('member-search').addEventListener('input', function (e) { memberQuery = e.target.value; renderMembers(); });
  $('member-filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    memberFilter = b.getAttribute('data-filter');
    document.querySelectorAll('#member-filters .chip').forEach(function (c) {
      c.classList.toggle('active', c === b);
    });
    renderMembers();
  });

  function setErr(id, key) { $(id).textContent = key ? t(key) : ''; }
  function resetMemberForm() {
    editingMemberId = null;
    $('member-form').reset();
    $('m-form-title').textContent = t('addMember');
    $('m-cancel').classList.add('hidden');
    $('m-start').value = ASOF;
    ['e-m-name', 'e-m-phone', 'e-m-plan', 'e-m-start'].forEach(function (id) { $(id).textContent = ''; });
  }
  $('member-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = {
      name: $('m-name').value.trim(),
      phone: $('m-phone').value.trim(),
      gender: $('m-gender').value,
      planId: $('m-plan').value,
      startDate: $('m-start').value,
      trainer: $('m-trainer').value.trim(),
      notes: $('m-notes').value.trim()
    };
    var errs = L.validateMember(state, inp);
    setErr('e-m-name', errs.name); setErr('e-m-phone', errs.phone);
    setErr('e-m-plan', errs.planId); setErr('e-m-start', errs.startDate);
    if (Object.keys(errs).length) return;
    var plan = L.planById(state, inp.planId);
    if (editingMemberId) {
      var mem = L.memberById(state, editingMemberId);
      Object.assign(mem, inp, { endDate: L.addMonths(inp.startDate, plan.months) });
    } else {
      state.members.push(Object.assign({ id: uid(), endDate: L.addMonths(inp.startDate, plan.months) }, inp));
    }
    save(); resetMemberForm(); render();
  });
  $('m-cancel').addEventListener('click', resetMemberForm);

  $('member-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-id');
    var act = b.getAttribute('data-act');
    var mem = L.memberById(state, id);
    if (!mem) return;
    if (act === 'checkin') {
      if (!L.checkedInOn(state, id, ASOF)) {
        state.attendance.push({ memberId: id, date: ASOF });
        save(); render();
      }
    } else if (act === 'pay') {
      openPay(mem);
    } else if (act === 'renew') {
      var next = L.renewMember(state, mem, ASOF);
      if (next) { Object.assign(mem, next); save(); render(); }
    } else if (act === 'edit') {
      editingMemberId = id;
      $('m-form-title').textContent = t('editMember');
      $('m-name').value = mem.name; $('m-phone').value = mem.phone;
      $('m-gender').value = mem.gender || ''; $('m-plan').value = mem.planId;
      $('m-start').value = mem.startDate; $('m-trainer').value = mem.trainer || '';
      $('m-notes').value = mem.notes || '';
      $('m-cancel').classList.remove('hidden');
      $('m-name').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (act === 'del') {
      if (window.confirm(t('confirmDelete'))) {
        state.members = state.members.filter(function (m) { return m.id !== id; });
        state.payments = state.payments.filter(function (p) { return p.memberId !== id; });
        state.attendance = state.attendance.filter(function (a) { return a.memberId !== id; });
        save(); render();
      }
    }
  });

  /* ---------- plans ---------- */
  function renderPlans() {
    $('plan-list').innerHTML = state.plans.length ? state.plans.map(function (p) {
      var n = state.members.filter(function (m) { return m.planId === p.id; }).length;
      return '<article class="card plan"><div class="m-head"><div><b>' + esc(p.name) + '</b>' +
        '<br><span class="muted">' + esc(L.fmtNum(p.months, lang)) + ' ' + esc(t('monthsShort')) +
        ' \u00b7 ' + esc(L.fmtMoney(p.feePaisa, lang)) + ' \u00b7 ' + esc(L.fmtNum(n, lang)) + ' ' + esc(t('membersUsing')) + '</span></div>' +
        '<button class="btn btn-small btn-danger" type="button" data-plan-del="' + esc(p.id) + '">' + esc(t('delete')) + '</button></div></article>';
    }).join('') : '<p class="muted">' + esc(t('noPlans')) + '</p>';
  }
  $('plan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = {
      name: $('p-name').value.trim(),
      months: parseInt($('p-months').value, 10),
      feeTaka: parseFloat($('p-fee').value)
    };
    var errs = L.validatePlan(inp);
    setErr('e-p-name', errs.name); setErr('e-p-months', errs.months); setErr('e-p-fee', errs.fee);
    if (Object.keys(errs).length) return;
    state.plans.push({ id: uid(), name: inp.name, months: inp.months, feePaisa: toPaisa(inp.feeTaka) });
    save(); $('plan-form').reset(); $('p-months').value = '1'; render();
  });
  $('plan-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-plan-del]');
    if (!b) return;
    var id = b.getAttribute('data-plan-del');
    if (state.members.some(function (m) { return m.planId === id; })) {
      window.alert(t('deletePlanBlocked'));
      return;
    }
    if (window.confirm(t('confirmDeletePlan'))) {
      state.plans = state.plans.filter(function (p) { return p.id !== id; });
      save(); render();
    }
  });

  /* ---------- attendance ---------- */
  function renderAttendance() {
    var y = +attDate.slice(0, 4), mo = +attDate.slice(5, 7);
    var n = L.checkInsOn(state, attDate);
    $('att-summary').textContent = L.fmtNum(n, lang) + ' ' + t('attCount');
    $('att-list').innerHTML = state.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (mem) {
      var done = L.checkedInOn(state, mem.id, attDate);
      return '<div class="rowline"><span>' + esc(mem.name) + ' <span class="muted"> \u00b7 ' +
        esc(L.fmtNum(L.monthAttendance(state, mem.id, y, mo), lang)) + ' ' + esc(t('monthCount')) + '</span></span>' +
        '<button class="btn btn-small" type="button" data-att="' + esc(mem.id) + '"' + (done ? ' disabled' : '') + '>' +
        esc(done ? t('checkedIn') : t('checkIn')) + '</button></div>';
    }).join('') || '<p class="muted">' + esc(t('noMembers')) + '</p>';
  }
  $('att-date').addEventListener('change', function (e) {
    if (L.parseDate(e.target.value)) { attDate = e.target.value; renderAttendance(); }
  });
  $('att-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-att]');
    if (!b) return;
    var id = b.getAttribute('data-att');
    if (!L.checkedInOn(state, id, attDate)) {
      state.attendance.push({ memberId: id, date: attDate });
      save(); render();
    }
  });

  /* ---------- payment modal ---------- */
  function openPay(mem) {
    payingMemberId = mem.id;
    $('pay-member-name').textContent = mem.name + ' - ' + t('due') + ': ' + L.fmtMoney(L.memberDue(state, mem), lang);
    $('pay-amount').value = '';
    $('pay-date').value = ASOF;
    $('pay-method').value = 'cash';
    $('pay-note').value = '';
    setErr('e-pay-amount', null); setErr('e-pay-date', null);
    $('pay-modal').classList.remove('hidden');
    $('pay-amount').focus();
  }
  function closePay() { $('pay-modal').classList.add('hidden'); payingMemberId = null; }
  $('pay-cancel').addEventListener('click', closePay);
  $('pay-modal').addEventListener('click', function (e) { if (e.target === $('pay-modal')) closePay(); });
  $('pay-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = {
      amountTaka: parseFloat($('pay-amount').value),
      date: $('pay-date').value,
      method: $('pay-method').value,
      note: $('pay-note').value.trim()
    };
    var errs = L.validatePayment(inp, ASOF);
    setErr('e-pay-amount', errs.amount); setErr('e-pay-date', errs.date);
    if (Object.keys(errs).length) return;
    state.payments.push({ id: uid(), memberId: payingMemberId, amountPaisa: toPaisa(inp.amountTaka), date: inp.date, method: inp.method, note: inp.note });
    save(); closePay(); render();
  });

  /* ---------- data ---------- */
  function renderData() {
    $('data-count').textContent = L.fmtNum(state.members.length, lang) + ' ' + t('tabMembers') + ' \u00b7 ' +
      L.fmtNum(state.plans.length, lang) + ' ' + t('tabPlans') + ' \u00b7 ' +
      L.fmtNum(state.payments.length, lang) + ' ' + t('recentPayments');
  }
  $('export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gym-bd-export-' + ASOF + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    $('data-msg').textContent = t('exportOk');
  });
  $('import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var errs = L.validateImport(obj);
        if (errs.length) throw new Error(errs.join('; '));
        state = obj;
        state.lang = lang;
        save(); applyLang(); render();
        $('data-msg').textContent = t('importOk');
      } catch (err) {
        $('data-msg').textContent = t('importBad');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
  $('erase-btn').addEventListener('click', function () {
    if ($('erase-input').value.trim() !== 'DELETE') { $('data-msg').textContent = t('eraseConfirm'); return; }
    state = L.emptyState();
    save(); $('erase-input').value = '';
    resetMemberForm(); applyLang(); render();
    $('data-msg').textContent = t('erased');
  });

  /* ---------- render all ---------- */
  function render() {
    renderDashboard();
    renderMembers();
    renderPlans();
    renderAttendance();
    renderData();
  }

  $('m-start').value = ASOF;
  $('att-date').value = attDate;
  applyLang();
  render();
})();
