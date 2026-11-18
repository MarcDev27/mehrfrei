(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./strings.js'));
  else root.LeaveRender = factory(root.LeaveCore, root.LeaveStrings);
})(typeof self !== 'undefined' ? self : this, function (C, S) {
  'use strict';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plural(n, one, many) { return n === 1 ? one : many; }

  /** Is a non-public holiday switched on in this state? */
  function isOn(h, state) {
    if (h.type === 'public') return true;
    if (state.opts && Object.prototype.hasOwnProperty.call(state.opts, h.id)) return !!state.opts[h.id];
    return h.on;
  }

  function schoolDates(school) {
    var set = {};
    school.forEach(function (p) {
      for (var t = C.parseISO(p.from); t <= C.parseISO(p.to); t += C.DAY) set[C.iso(t)] = p.kind;
    });
    return set;
  }

  /** Run the optimizer for one region + settings. */
  function plan(region, state, year) {
    var off = region.holidays.filter(function (h) { return isOn(h, state); }).map(function (h) { return h.date; });
    var school = schoolDates(region.school);
    var allow = (state.family && region.school.length) ? Object.keys(school) : null;
    var days = C.buildDays(year, off, { allowLeave: allow });
    var result = C.optimize(days, state.leave, state.mode);
    var holMap = {};
    region.holidays.forEach(function (h) { if (isOn(h, state)) holMap[h.date] = h; });
    return { days: days, result: result, holMap: holMap, school: school };
  }

  function renderResult(p, state, lang, cc, year) {
    var T = S.get(lang, cc), r = p.result, html = '';
    html += '<p class="equation"><span class="eq-n">' + state.leave + '</span> <span class="eq-w">' +
      esc(plural(state.leave, T.leaveDay1, T.leaveDays)) + '</span> <span class="eq-op">' + esc(T.equals) +
      '</span> <span class="eq-n eq-n--off">' + r.total + '</span> <span class="eq-w">' + esc(plural(r.total, T.dayOff1, T.daysOff)) + '</span></p>';
    if (!r.breaks.length) return html + '<p class="plan-note">' + esc(T.noPlan) + '</p>';
    html += '<ol class="breaks">';
    r.breaks.forEach(function (b) {
      var hols = [];
      for (var t = C.parseISO(b.from); t <= C.parseISO(b.to); t += C.DAY) {
        var h = p.holMap[C.iso(t)]; if (h && C.dow(t) % 6 !== 0) hols.push(h.name[lang]);
      }
      html += '<li><span class="br-range">' + esc(C.fmtRange(b.from, b.to, lang, cc, false)) + '</span>' +
        '<span class="br-len"><b>' + b.len + '</b> ' + esc(plural(b.len, T.dayOff1, T.daysOff)) + '</span>' +
        '<span class="br-cost">' + esc(T.takeOff) + ': ' + b.leave.map(function (d) { return esc(C.fmtDate(d, lang, cc, false, true)); }).join(', ') + '</span>' +
        (hols.length ? '<span class="br-hol">' + esc(hols.join(', ')) + '</span>' : '') + '</li>';
    });
    html += '</ol>';
    if (r.used < state.leave) html += '<p class="plan-note">' + esc(T.unused.replace('{n}', state.leave - r.used)) + '</p>';
    return html;
  }

  function renderCalendar(p, lang, cc, year) {
    var T = S.get(lang, cc), L = C.loc(lang, cc), leave = {}, brk = {};
    p.result.breaks.forEach(function (b) {
      b.leave.forEach(function (d) { leave[d] = 1; });
      for (var t = C.parseISO(b.from); t <= C.parseISO(b.to); t += C.DAY) brk[C.iso(t)] = 1;
    });
    var html = '';
    for (var m = 0; m < 12; m++) {
      html += '<div class="month"><h3 class="month-name">' + C.MONTHS[L][m] + '</h3><div class="grid">';
      T.weekdaysShort.forEach(function (w, i) { html += '<span class="wd' + (i > 4 ? ' wd--we' : '') + '">' + w.slice(0, 2) + '</span>'; });
      var first = C.utc(year, m + 1, 1), lead = (C.dow(first) + 6) % 7;
      for (var i = 0; i < lead; i++) html += '<span class="d d--pad"></span>';
      for (var t = first; new Date(t).getUTCMonth() === m; t += C.DAY) {
        var s = C.iso(t), w = C.dow(t), cls = ['d'], title = [];
        if (w === 0 || w === 6) cls.push('we');
        if (p.holMap[s]) { cls.push('hol'); title.push(p.holMap[s].name[lang]); }
        if (p.school[s]) cls.push('sch');
        if (brk[s]) cls.push('brk');
        if (leave[s]) { cls.push('lv'); title.push(T.legend.leave); }
        html += '<span class="' + cls.join(' ') + '"' + (title.length ? ' title="' + esc(title.join(' · ')) + '"' : '') + '>' + new Date(t).getUTCDate() + '</span>';
      }
      html += '</div></div>';
    }
    return html;
  }

  /** Checkboxes for holidays that are not off for everyone (optional / local). */
  function renderOptions(region, state, lang, cc, year) {
    var seen = {}, html = '';
    region.holidays.forEach(function (h) {
      if (h.type === 'public' || seen[h.id] || h.date.slice(0, 4) !== String(year)) return;
      seen[h.id] = 1;
      html += '<label class="check"><input type="checkbox" name="opt" value="' + h.id + '"' + (isOn(h, state) ? ' checked' : '') + '>' +
        '<span>' + esc(h.name[lang]) + ' <span class="check-date">' + esc(C.fmtDate(h.date, lang, cc, false, true)) + '</span>' +
        (h.note ? '<small>' + esc(h.note[lang]) + '</small>' : '') + '</span></label>';
    });
    return html;
  }

  return { plan: plan, renderResult: renderResult, renderCalendar: renderCalendar, renderOptions: renderOptions, isOn: isOn, esc: esc };
});
