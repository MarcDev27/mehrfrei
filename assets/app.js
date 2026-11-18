(function () {
  'use strict';
  var root = document.getElementById('planner');
  if (!root || !window.LeaveCore) return;
  var C = window.LeaveCore, R = window.LeaveRender, S = window.LeaveStrings;
  var data = JSON.parse(document.getElementById('planner-data').textContent);
  var lang = data.lang, year = data.year, T = S[lang];

  var els = {
    region: root.querySelector('#p-region'),
    count: root.querySelector('#p-count'),
    minus: root.querySelector('[data-step="-1"]'),
    plus: root.querySelector('[data-step="1"]'),
    modes: root.querySelectorAll('input[name="mode"]'),
    family: root.querySelector('#p-family'),
    opts: root.querySelector('#p-opts'),
    result: root.querySelector('#p-result'),
    cal: root.querySelector('#p-cal'),
    ics: root.querySelector('#p-ics'),
    share: root.querySelector('#p-share')
  };

  var q = new URLSearchParams(location.search);
  var state = {
    region: (q.get('r') && data.regions[q.get('r')]) ? q.get('r') : data.region,
    leave: clamp(parseInt(q.get('u'), 10) || data.leave, 1, 60),
    mode: ['smart', 'weekends', 'long'].indexOf(q.get('m')) >= 0 ? q.get('m') : 'smart',
    family: q.get('f') === '1',
    opts: null
  };
  if (q.has('o')) {
    state.opts = {};
    q.get('o').split(',').filter(Boolean).forEach(function (id) { state.opts[id] = true; });
    // ids not listed are explicitly off
    data.regions[state.region].holidays.forEach(function (h) { if (h.type !== 'public' && !state.opts[h.id]) state.opts[h.id] = false; });
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function region() { return data.regions[state.region]; }
  var current = null;

  function syncControls() {
    if (els.region) els.region.value = state.region;
    els.count.textContent = state.leave;
    els.minus.disabled = state.leave <= 1;
    els.plus.disabled = state.leave >= 60;
    els.modes.forEach(function (r) { r.checked = r.value === state.mode; });
    if (els.family) els.family.checked = state.family;
  }

  function update(pushUrl) {
    var reg = region();
    current = R.plan(reg, state, year);
    els.result.innerHTML = R.renderResult(current, state, lang, reg.cc, year);
    els.cal.innerHTML = R.renderCalendar(current, lang, reg.cc, year);
    syncControls();
    if (pushUrl) { try { history.replaceState(null, '', location.pathname + '?' + query() + '#planner'); } catch (e) {} }
  }

  function query() {
    var p = new URLSearchParams();
    if (els.region) p.set('r', state.region);
    p.set('u', state.leave);
    if (state.mode !== 'smart') p.set('m', state.mode);
    if (state.family) p.set('f', '1');
    var on = region().holidays.filter(function (h) { return h.type !== 'public' && R.isOn(h, state); }).map(function (h) { return h.id; });
    var uniq = on.filter(function (v, i) { return on.indexOf(v) === i; });
    if (state.opts) p.set('o', uniq.join(','));
    return p.toString();
  }

  // --- events ---
  if (els.region) els.region.addEventListener('change', function () {
    state.region = els.region.value; state.opts = null;
    var reg = region();
    els.opts.innerHTML = R.renderOptions(reg, state, lang, reg.cc, year);
    update(true);
  });
  [els.minus, els.plus].forEach(function (b) {
    b.addEventListener('click', function () { state.leave = clamp(state.leave + parseInt(b.dataset.step, 10), 1, 60); update(true); });
  });
  els.modes.forEach(function (r) { r.addEventListener('change', function () { state.mode = r.value; update(true); }); });
  if (els.family) els.family.addEventListener('change', function () { state.family = els.family.checked; update(true); });
  els.opts.addEventListener('change', function (e) {
    if (e.target.name !== 'opt') return;
    state.opts = state.opts || {};
    state.opts[e.target.value] = e.target.checked;
    update(true);
  });

  els.ics.addEventListener('click', function () {
    var blob = new Blob([C.toICS(current.result.breaks, T.icsTitle)], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (lang === 'en' ? 'time-off-' : 'frei-') + year + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    track('ics_download');
  });
  els.share.addEventListener('click', function () {
    var url = location.origin + location.pathname + '?' + query() + '#planner';
    var done = function () { els.share.textContent = T.copied; setTimeout(function () { els.share.textContent = T.copyLink; }, 2000); };
    if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ url: url, title: document.title }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
    track('share');
  });

  function track(name) { if (typeof window.gtag === 'function') window.gtag('event', name); }

  // Re-render only if the URL carries settings that differ from the server-rendered default.
  if (location.search) {
    if (els.region && state.region !== data.region) { var reg0 = region(); els.opts.innerHTML = R.renderOptions(reg0, state, lang, reg0.cc, year); }
    else if (state.opts) { var reg1 = region(); els.opts.innerHTML = R.renderOptions(reg1, state, lang, reg1.cc, year); }
    update(false);
  } else {
    current = R.plan(region(), state, year);
  }
  root.classList.add('is-live');
})();
