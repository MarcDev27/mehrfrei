/*
 * LeaveCore – country-agnostic holiday engine + leave optimizer.
 * Runs in Node (build time) and in the browser (interactive planner).
 * Adding a country = adding a data/<cc>.json rules file; nothing here changes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeaveCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000;

  function utc(y, m, d) { return Date.UTC(y, m - 1, d); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function parseISO(s) { var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function dow(t) { return new Date(t).getUTCDay(); }
  function yearOf(t) { return new Date(t).getUTCFullYear(); }

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(y, month, day);
  }

  var FN = {
    // Buß- und Bettag: Wednesday before 23 November
    wednesdayBeforeNov23: function (y) { var t = utc(y, 11, 22); while (dow(t) !== 3) t -= DAY; return t; },
    // Glarus: first Thursday of April; a week later if that is Maundy Thursday
    naefelserFahrt: function (y) { var t = utc(y, 4, 1); while (dow(t) !== 4) t += DAY; if (t === easter(y) - 3 * DAY) t += 7 * DAY; return t; },
    // Geneva: Thursday after the first Sunday of September
    thuAfterFirstSunSep: function (y) { var t = utc(y, 9, 1); while (dow(t) !== 0) t += DAY; return t + 4 * DAY; },
    // Vaud: Monday after the third Sunday of September (Federal Fast)
    monAfterThirdSunSep: function (y) { var t = utc(y, 9, 1); while (dow(t) !== 0) t += DAY; return t + 15 * DAY; },
    // Neuchâtel: 2 Jan / 26 Dec only when they fall on a Monday
    jan2IfMonday: function (y) { var t = utc(y, 1, 2); return dow(t) === 1 ? t : null; },
    dec26IfMonday: function (y) { var t = utc(y, 12, 26); return dow(t) === 1 ? t : null; },
    // Appenzell, Uri: no St Stephen's Day when Christmas is a Monday or Friday
    dec26UnlessXmasMonFri: function (y) { var x = dow(utc(y, 12, 25)); return (x === 1 || x === 5) ? null : utc(y, 12, 26); }
  };

  function resolveRule(h, y) {
    if (h.date) { var p = h.date.split('-').map(Number); return utc(y, p[0], p[1]); }
    if (typeof h.easter === 'number') return easter(y) + h.easter * DAY;
    if (h.fn && FN[h.fn]) return FN[h.fn](y);
    throw new Error('Unknown holiday rule: ' + JSON.stringify(h));
  }

  /** Holidays of one region for one year. type: public | partial | optional */
  function holidaysFor(country, region, year) {
    return country.holidays
      .filter(function (h) {
        if (h.regions && h.regions.indexOf(region) < 0) return false;
        if (h.sinceYear && year < h.sinceYear) return false;
        return true;
      })
      .map(function (h) { return { h: h, t: resolveRule(h, year) }; })
      .filter(function (x) { return x.t !== null; })
      .map(function (x) {
        var h = x.h, t = x.t, type = h.type || 'public';
        return {
          id: h.id, date: iso(t), name: h.name, type: type, note: h.note || null,
          on: type === 'public' ? true : (type === 'partial' ? !!h.defaultOn : false)
        };
      })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  /**
   * Build the day model for a planning year.
   * offDates: array of ISO dates that are non-working holidays (already filtered by toggles).
   * allowLeave: optional array of ISO dates where leave may be taken (family mode).
   */
  function buildDays(year, offDates, opts) {
    opts = opts || {};
    var workdays = opts.workdays || [1, 2, 3, 4, 5];
    var start = utc(year - 1, 12, 1), end = utc(year + 1, 1, 31);
    var D = Math.round((end - start) / DAY) + 1;
    var offSet = {}; offDates.forEach(function (d) { offSet[d] = 1; });
    var allow = null;
    if (opts.allowLeave) { allow = {}; opts.allowLeave.forEach(function (d) { allow[d] = 1; }); }
    var days = new Array(D);
    for (var i = 0; i < D; i++) {
      var t = start + i * DAY, s = iso(t), wd = dow(t);
      var holiday = !!offSet[s];
      var work = workdays.indexOf(wd) >= 0 && !holiday;
      days[i] = {
        t: t, iso: s, work: work, holiday: holiday && workdays.indexOf(wd) >= 0,
        can: work && yearOf(t) === year && (!allow || !!allow[s])
      };
    }
    return days;
  }

  /** Every maximal break (bounded by working days) that needs 1..maxCost leave days. */
  function candidates(days, maxCost, maxSpan) {
    var out = [], D = days.length;
    maxSpan = maxSpan || 45;
    for (var s = 1; s < D - 1; s++) {
      if (!days[s - 1].work) continue;
      var cost = 0, hol = false;
      for (var e = s; e < D - 1 && e - s < maxSpan; e++) {
        if (days[e].work) { if (!days[e].can) break; cost++; if (cost > maxCost) break; }
        if (days[e].holiday) hol = true;
        if (!days[e + 1].work) continue;
        if (cost > 0) out.push({ s: s, e: e, cost: cost, len: e - s + 1, hasHoliday: hol });
      }
    }
    return out;
  }

  /**
   * Optimal leave plan: maximise total days off (in breaks that use leave)
   * for at most `leave` days, breaks at least `minLen` long. Exact DP.
   */
  // Plan styles:
  //  smart    – breaks must contain a public holiday, or be a real holiday of ≥9 days (default)
  //  weekends – any break, incl. plain long weekends
  //  long     – only breaks of ≥9 days
  var MODES = {
    smart: function (c) { return c.hasHoliday || c.len >= 9; },
    weekends: function () { return true; },
    long: function (c) { return c.len >= 9; }
  };

  function optimize(days, leave, mode) {
    var keep = MODES[mode] || MODES.smart;
    var D = days.length, NEG = -1e9;
    var cands = candidates(days, leave).filter(keep);
    var byEnd = new Array(D); for (var i = 0; i < D; i++) byEnd[i] = [];
    cands.forEach(function (c) { byEnd[c.e].push(c); });
    var best = [], back = [];
    for (var k = 0; k <= D; k++) {
      best.push(new Float64Array(leave + 1).fill(NEG));
      back.push(new Array(leave + 1).fill(null));
    }
    best[0][0] = 0;
    for (k = 0; k < D; k++) {
      for (var b = 0; b <= leave; b++) if (best[k][b] > best[k + 1][b]) { best[k + 1][b] = best[k][b]; back[k + 1][b] = null; }
      var list = byEnd[k];
      for (var j = 0; j < list.length; j++) {
        var c = list[j], from = Math.max(c.s - 1, 0);
        for (b = 0; b + c.cost <= leave; b++) {
          if (best[from][b] <= NEG / 2) continue;
          var v = best[from][b] + c.len;
          if (v > best[k + 1][b + c.cost]) { best[k + 1][b + c.cost] = v; back[k + 1][b + c.cost] = { c: c, from: from, pb: b }; }
        }
      }
    }
    var bb = 0;
    for (b = 0; b <= leave; b++) if (best[D][b] > best[D][bb]) bb = b;
    var breaks = [], kk = D, cb = bb;
    while (kk > 0) {
      var bp = back[kk][cb];
      if (!bp) { kk--; continue; }
      breaks.push(bp.c); kk = bp.from; cb = bp.pb;
    }
    breaks.reverse();
    return {
      total: best[D][bb] > 0 ? best[D][bb] : 0, used: bb,
      breaks: breaks.map(function (c) { return describe(days, c); })
    };
  }

  function describe(days, c) {
    var leaveDates = [];
    for (var i = c.s; i <= c.e; i++) if (days[i].work) leaveDates.push(days[i].iso);
    return { from: days[c.s].iso, to: days[c.e].iso, len: c.len, cost: c.cost, leave: leaveDates };
  }

  /**
   * Static "best bridge days" list: for every weekday holiday in `year`,
   * the most efficient break (≤4 leave days) and the longest one.
   */
  function bridgeDays(days, year, maxCost) {
    maxCost = maxCost || 4;
    var cands = candidates(days, maxCost).filter(function (c) { return c.hasHoliday; });
    var groups = {};
    days.forEach(function (d, idx) {
      if (!d.holiday || yearOf(d.t) !== year) return;
      var mine = cands.filter(function (c) { return c.s <= idx && c.e >= idx; });
      if (!mine.length) return;
      var eff = mine.slice().sort(function (a, b) { return (b.len / b.cost - a.len / a.cost) || (b.len - a.len); })[0];
      var lng = mine.slice().sort(function (a, b) { return (b.len - a.len) || (a.cost - b.cost); })[0];
      var key = eff.s + '-' + eff.e;
      if (!groups[key]) groups[key] = { holidays: [], best: describe(days, eff), long: null };
      groups[key].holidays.push(d.iso);
      if (lng.s !== eff.s || lng.e !== eff.e) groups[key].long = describe(days, lng);
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return a.best.from < b.best.from ? -1 : 1; });
  }

  /** Long weekends that need no leave at all (≥3 days, containing a holiday). */
  function freeLongWeekends(days, year) {
    var out = [], i = 0;
    while (i < days.length) {
      if (days[i].work) { i++; continue; }
      var s = i, hol = false;
      while (i < days.length && !days[i].work) { if (days[i].holiday) hol = true; i++; }
      var e = i - 1;
      if (hol && e - s + 1 >= 3 && yearOf(days[s].t) === year) out.push({ from: days[s].iso, to: days[e].iso, len: e - s + 1 });
    }
    return out;
  }

  // ---------- formatting ----------
  var MONTHS = {
    'de-AT': ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'de-DE': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    'it': ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  };
  var MONTHS_SHORT = {
    'de-AT': ['Jän.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
    'de-DE': ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
    'en': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'fr': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    'it': ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  };
  var WEEKDAYS = {
    de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    it: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  };
  var WD_SHORT = { de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], it: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'] };

  function loc(lang, cc) { return (lang === 'en' || lang === 'fr' || lang === 'it') ? lang : (cc === 'at' ? 'de-AT' : 'de-DE'); } // de-CH uses the same month names as de-DE
  function parts(s) { var t = parseISO(s), d = new Date(t); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay() }; }

  function wdKey(lang) { return WD_SHORT[lang] ? lang : 'de'; }
  // French and Italian write the first of the month as 1er / 1º
  function dayNum(d, lang) { return d === 1 && lang === 'fr' ? '1er' : d === 1 && lang === 'it' ? '1º' : String(d); }
  function fmtDate(s, lang, cc, withYear, withWeekday) {
    var p = parts(s), L = loc(lang, cc), out;
    if (lang === 'de') out = p.d + '. ' + MONTHS[L][p.m] + (withYear ? ' ' + p.y : '');
    else out = dayNum(p.d, lang) + ' ' + MONTHS[L][p.m] + (withYear ? ' ' + p.y : '');
    if (withWeekday) out = WD_SHORT[wdKey(lang)][p.w] + (lang === 'de' ? ', ' : ' ') + out;
    return out;
  }
  function fmtRange(a, b, lang, cc, withYear) {
    var A = parts(a), B = parts(b), L = loc(lang, cc), M = MONTHS_SHORT[L];
    var yA = withYear && A.y !== B.y ? ' ' + A.y : '', yB = withYear ? ' ' + B.y : '';
    if (a === b) return fmtDate(a, lang, cc, withYear);
    if (lang !== 'de') {
      var a1 = dayNum(A.d, lang), b1 = dayNum(B.d, lang);
      if (A.m === B.m && A.y === B.y) return a1 + '–' + b1 + ' ' + M[B.m] + yB;
      return a1 + ' ' + M[A.m] + yA + ' – ' + b1 + ' ' + M[B.m] + yB;
    }
    if (A.m === B.m && A.y === B.y) return A.d + '.–' + B.d + '. ' + M[B.m] + yB;
    return A.d + '. ' + M[A.m] + yA + ' – ' + B.d + '. ' + M[B.m] + yB;
  }
  function weekday(s, lang) { return WEEKDAYS[WEEKDAYS[lang] ? lang : 'de'][parts(s).w]; }

  /** iCalendar export of a plan (all-day events). */
  function toICS(breaks, title) {
    function d(s) { return s.replace(/-/g, ''); }
    function next(s) { return iso(parseISO(s) + DAY).replace(/-/g, ''); }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//leave-planner//EN', 'CALSCALE:GREGORIAN'];
    breaks.forEach(function (b, i) {
      lines.push('BEGIN:VEVENT', 'UID:break-' + d(b.from) + '-' + i + '@leave-planner',
        'DTSTAMP:' + d(b.from) + 'T000000Z', 'DTSTART;VALUE=DATE:' + d(b.from), 'DTEND;VALUE=DATE:' + next(b.to),
        'SUMMARY:' + title.replace(/[,;]/g, ' ') + ' (' + b.len + ')', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  return {
    DAY: DAY, utc: utc, iso: iso, parseISO: parseISO, dow: dow, easter: easter,
    holidaysFor: holidaysFor, buildDays: buildDays, candidates: candidates, optimize: optimize,
    bridgeDays: bridgeDays, freeLongWeekends: freeLongWeekends,
    fmtDate: fmtDate, fmtRange: fmtRange, weekday: weekday, MONTHS: MONTHS, WD_SHORT: WD_SHORT, loc: loc,
    toICS: toICS
  };
});
