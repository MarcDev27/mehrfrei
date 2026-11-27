#!/usr/bin/env node
/*
 * Static site generator. `node build.js` → dist/
 * Yearly update: bump config.year, add data/school-<year>.json. Holidays are computed by rule.
 * New country: add data/<cc>.json (+ school file) and list it in config.countries.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./engine/core.js');
const S = require('./engine/strings.js');
const R = require('./engine/render.js');

const ROOT = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const Y = cfg.year;
const DIST = path.join(ROOT, 'dist');
const school = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `school-${Y}.json`), 'utf8'));
const countries = {};
cfg.countries.forEach(cc => { countries[cc] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${cc}.json`), 'utf8')); });
const esc = R.esc;
const today = new Date().toISOString().slice(0, 10);
const sitemap = [];
const llms = [];

// ---------- helpers ----------
const plural = (n, a, b) => (n === 1 ? a : b);
const dot = s => (/\.$/.test(s) ? s : s + '.');
const yr = s => s.replace('{year}', Y);
function url(p) { return cfg.baseUrl.replace(/\/$/, '') + p; }
function homeUrl(l) { return l === 'de' ? '/' : `/${l}/`; }
function countryUrl(cc, l) { return '/' + yr(countries[cc].path[l]) + '/'; }
function regionUrl(cc, r, l) { return countryUrl(cc, l) + r.slug[l] + '/'; }
function productUrl(l) { return ({ de: `/urlaubsplaner-${Y}/`, en: `/en/leave-planner-${Y}/`, fr: `/fr/planificateur-conges-${Y}/`, it: `/it/pianificatore-ferie-${Y}/` })[l]; }
function legalUrl(kind, l) { return ({ de: ['/impressum/', '/datenschutz/'], en: ['/en/imprint/', '/en/privacy/'], fr: ['/fr/mentions-legales/', '/fr/confidentialite/'], it: ['/it/note-legali/', '/it/privacy/'] })[l][kind === 'imprint' ? 0 : 1]; }
function locale(l, cc) { if (l === 'fr' || l === 'it') return l + '-CH'; return l === 'en' ? 'en' : (cc === 'at' ? 'de-AT' : cc === 'de' ? 'de-DE' : cc === 'ch' ? 'de-CH' : 'de'); }
const LANGS = ['de', 'en', 'fr', 'it'];
function langsOf(cc) { return (cfg.languages && cfg.languages[cc]) || ['de', 'en']; }
// hreflang alternates for a page that exists in the languages of `cc` (or all languages when cc is null)
function alternates(cc, fn) {
  const ls = cc ? langsOf(cc) : LANGS;
  return ls.map(l => ({ hreflang: cc ? locale(l, cc) : l, href: fn(l) })).concat([{ hreflang: 'x-default', href: fn('de') }]);
}
function key(cc, code) { return cc + '-' + code; }

function regionData(cc, r) {
  const country = countries[cc];
  let hol = [];
  [Y - 1, Y, Y + 1].forEach(y => { hol = hol.concat(C.holidaysFor(country, r.code, y)); });
  const sch = (school[cc] || []).filter(p => !p.regions || p.regions.includes(r.code)).map(p => ({ kind: p.kind, from: p.from, to: p.to }));
  return { cc, code: r.code, holidays: hol, school: sch };
}
function defaultState() { return { leave: cfg.plannerDefaultLeave, mode: 'smart', family: false, opts: null }; }
function daysFor(rd) {
  const off = rd.holidays.filter(h => h.on).map(h => h.date);
  return C.buildDays(Y, off);
}
function inYear(p) { return p.from <= `${Y}-12-31` && p.to >= `${Y}-01-01`; }
function spanDays(a, b) { return Math.round((C.parseISO(b) - C.parseISO(a)) / C.DAY) + 1; }
// Swiss German pages: Ferien/Kanton wording, no ß. Swiss English pages: canton instead of state.
function swissify(html, lang) {
  if (lang === 'en') return html.replace(/\bStates\b/g, 'Cantons').replace(/\bstates\b/g, 'cantons').replace(/\bState\b/g, 'Canton').replace(/\bstate\b/g, 'canton');
  return html
    .replace(/Welches Bundesland/g, 'Welcher Kanton').replace(/dein Bundesland\b/g, 'deinen Kanton')
    .replace(/Bundesländern/g, 'Kantonen').replace(/Bundesländer/g, 'Kantone').replace(/Bundeslands/g, 'Kantons').replace(/Bundesland/g, 'Kanton')
    .replace(/Urlaubstagen/g, 'Ferientagen').replace(/Urlaubstage/g, 'Ferientage').replace(/Urlaubstag/g, 'Ferientag')
    .replace(/Urlaubsplaner/g, 'Ferienplaner').replace(/\bUrlaube\b/g, 'Ferien').replace(/\bUrlaub\b/g, 'Ferien')
    .replace(/Kollektiv- bzw\. Tarifvertrag/g, 'Gesamtarbeitsvertrag')
    .replace(/ß/g, 'ss');
}
function writeCC(cc, lang, rel, html) { write(rel, cc === 'ch' && (lang === 'de' || lang === 'en') ? swissify(html, lang) : html); }
function write(rel, html) {
  const file = path.join(DIST, rel.endsWith('/') ? rel + 'index.html' : rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ---------- layout ----------
function adSlot(name) {
  // With an AdSense ID set, Auto ads place ads by themselves. Manual units appear only for slot IDs listed in config.adSlots.
  if (cfg.adsenseClient) {
    const id = cfg.adSlots && cfg.adSlots[name];
    return id ? `<div class="ad-slot wrap"><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${id}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>` : '';
  }
  return cfg.showAdPlaceholders ? `<div class="wrap"><div class="ad-slot ad-slot--ph" aria-hidden="true">Anzeigenfläche (${name})</div></div>` : '';
}

const UI = {
  de: { main: 'Hauptmenü', legal: 'Rechtliches', imprint: 'Impressum', privacy: 'Datenschutz', product: 'Urlaubsplaner zum Ausdrucken',
    footer: 'Alle Termine sorgfältig mit amtlichen Quellen abgeglichen, aber ohne Gewähr. Welche Tage du tatsächlich frei hast, regeln Arbeitsvertrag und Kollektiv- bzw. Tarifvertrag.' },
  en: { main: 'Main', legal: 'Legal', imprint: 'Imprint', privacy: 'Privacy', product: 'Printable planner',
    footer: 'All dates carefully checked against official sources, but without guarantee. Your employment contract and collective agreement decide which days you actually get off.' },
  fr: { main: 'Menu principal', legal: 'Informations légales', imprint: 'Mentions légales', privacy: 'Confidentialité', product: 'Planificateur à imprimer',
    footer: 'Toutes les dates sont vérifiées avec soin à partir de sources officielles, mais sans garantie. C’est votre contrat de travail et votre convention collective qui déterminent les jours où vous êtes réellement libre.' },
  it: { main: 'Menu principale', legal: 'Note legali', imprint: 'Note legali', privacy: 'Privacy', product: 'Pianificatore da stampare',
    footer: 'Tutte le date sono verificate con cura su fonti ufficiali, ma senza garanzia. Sono il contratto di lavoro e il contratto collettivo a stabilire quali giorni hai effettivamente liberi.' }
};
const LANG_NAME = { de: 'Deutsch', en: 'English', fr: 'Français', it: 'Italiano' };
function page({ lang, cc, title, desc, path: p, alt, h1, crumbs, body, jsonld, data, noindex }) {
  const T = lang === 'en', U = UI[lang];
  const altLinks = (alt || []).map(a => `<link rel="alternate" hreflang="${a.hreflang}" href="${url(a.href)}">`).join('\n  ');
  const ld = (jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n  ');
  const others = (alt || []).filter(a => a.hreflang !== 'x-default' && a.hreflang.slice(0, 2) !== lang);
  const langLinks = others.map(a => { const l = a.hreflang.slice(0, 2); return `<a class="lang" href="${a.href}" hreflang="${a.hreflang}" lang="${l}" title="${LANG_NAME[l]}">${others.length > 1 ? l.toUpperCase() : LANG_NAME[l]}</a>`; }).join('');
  const countryLinks = cfg.countries.filter(c => langsOf(c).includes(lang)).map(c => `<a href="${countryUrl(c, lang)}">${esc(countries[c].name[lang])}</a>`).join('');
  const nav = `${countryLinks}<a class="nav-product" href="${productUrl(lang)}">${U.product}</a>`;
  if (!noindex) {
    sitemap.push({ loc: p, alt: (alt || []).filter(a => a.hreflang !== 'x-default') });
    llms.push({ lang, title, href: p, desc });
  }
  return `<!doctype html>
<html lang="${locale(lang, cc)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  ${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
  <link rel="canonical" href="${url(p)}">
  ${altLinks}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(cfg.siteName)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url(p)}">
  <meta property="og:locale" content="${locale(lang, cc).replace('-', '_')}">
  <meta name="theme-color" content="#eef2f7">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/style.css">
  ${cfg.adsenseClient ? `<meta name="google-adsense-account" content="${cfg.adsenseClient}">` : ''}
  ${cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.adsenseClient}" crossorigin="anonymous"></script>` : ''}
  ${ld}
</head>
<body>
  <header class="wrap top">
    <a class="brand" href="${homeUrl(lang)}"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>${esc(cfg.siteName)}</a>
    <nav class="nav" aria-label="${U.main}">${nav}${langLinks}</nav>
  </header>
  <main>
    <div class="wrap intro">
      ${crumbs ? `<p class="crumbs">${crumbs.map(c => c.href ? `<a href="${c.href}">${esc(c.name)}</a>` : esc(c.name)).join(' / ')}</p>` : ''}
      <h1>${esc(h1)}</h1>
      ${body.lede ? `<p class="lede">${body.lede}</p>` : ''}
    </div>
    ${body.main}
  </main>
  <footer>
    <div class="wrap">
      <nav aria-label="${U.legal}">
        <a href="${legalUrl('imprint', lang)}">${U.imprint}</a>
        <a href="${legalUrl('privacy', lang)}">${U.privacy}</a>
        <a href="${productUrl(lang)}">${U.product}</a>
      </nav>
      <p>${U.footer} © ${Y - 1} ${esc(cfg.siteName)}</p>
    </div>
  </footer>
  ${data ? `<script type="application/json" id="planner-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  <script src="/assets/core.js" defer></script><script src="/assets/strings.js" defer></script><script src="/assets/render.js" defer></script><script src="/assets/app.js" defer></script>` : ''}
</body>
</html>`;
}

// ---------- planner block ----------
function smartLabel(lang, scope) {
  if (lang !== 'de') return S[lang].modes.smart;
  if (scope === 'at') return 'Fenstertage und echte Urlaube';
  if (scope === 'de') return 'Brückentage und echte Urlaube';
  if (scope === 'ch') return 'Brückentage und echte Ferien';
  return 'Brücken- und Fenstertage plus echte Urlaube';
}
function planner(lang, scope, regionKeys, selected) {
  const T = S.get(lang, scope);
  const regions = {};
  regionKeys.forEach(k => { const [cc, code] = k.split('-'); regions[k] = regionData(cc, countries[cc].regions.find(r => r.code === code)); });
  const rd = regions[selected];
  const state = defaultState();
  const p = R.plan(rd, state, Y);
  let select = '';
  if (regionKeys.length > 1) {
    const groups = {};
    regionKeys.forEach(k => { const cc = k.split('-')[0]; (groups[cc] = groups[cc] || []).push(k); });
    select = `<div><label class="field-label" for="p-region">${T.region}</label><select id="p-region">` +
      Object.keys(groups).map(cc => `<optgroup label="${esc(countries[cc].name[lang])}">` + groups[cc].map(k => {
        const r = countries[cc].regions.find(x => x.code === k.split('-')[1]);
        return `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(r.name[lang])}</option>`;
      }).join('') + '</optgroup>').join('') + '</select></div>';
  }
  const modes = ['smart', 'weekends', 'long'].map(m => `<label class="radio"><input type="radio" name="mode" value="${m}"${m === 'smart' ? ' checked' : ''}><span>${esc(m === 'smart' ? smartLabel(lang, scope) : T.modes[m])}</span></label>`).join('');
  const html = `
    <section class="planner" id="planner" aria-labelledby="planner-h">
      <div class="wrap">
        <h2 id="planner-h" class="sr-only">${({ de: 'Urlaubsplaner', en: 'Leave planner', fr: 'Planificateur de congés', it: 'Pianificatore ferie' })[lang]} ${Y}</h2>
        <div class="planner-head">
          <form class="controls" onsubmit="return false">
            ${select}
            <div>
              <span class="field-label" id="lbl-count">${esc(T.leaveDays.charAt(0).toUpperCase() + T.leaveDays.slice(1))}</span>
              <div class="stepper">
                <button type="button" data-step="-1" aria-label="${esc(T.fewer)}">−</button>
                <output id="p-count" aria-labelledby="lbl-count" aria-live="polite">${state.leave}</output>
                <button type="button" data-step="1" aria-label="${esc(T.more)}">+</button>
              </div>
            </div>
            <fieldset><legend class="field-label">${esc(T.style)}</legend>${modes}</fieldset>
            <details class="more">
              <summary>${esc(T.options)}</summary>
              ${Object.values(regions).some(x => x.school.length) ? `<label class="check"><input type="checkbox" id="p-family"><span>${esc(T.family)}</span></label>
              <p class="hint">${esc(T.familyHint)}</p>` : ''}
              <p class="opt-head">${esc(T.optionalHead)}</p>
              <div id="p-opts">${R.renderOptions(rd, state, lang, rd.cc, Y)}</div>
            </details>
          </form>
          <div>
            <div id="p-result" aria-live="polite">${R.renderResult(p, state, lang, rd.cc, Y)}</div>
            <div class="actions needs-js">
              <button type="button" class="btn" id="p-ics">${esc(T.saveIcs)}</button>
              <button type="button" class="btn btn--ghost" id="p-share">${esc(T.copyLink)}</button>
            </div>
          </div>
        </div>
        <div class="year" id="p-cal" role="img" aria-label="${esc(T.calendarLabel.replace('{year}', Y))}">${R.renderCalendar(p, lang, rd.cc, Y)}</div>
        <ul class="legend">
          <li><span class="sw sw--lv"></span>${T.legend.leave}</li>
          <li><span class="sw sw--hol"></span>${T.legend.hol}</li>
          <li><span class="sw sw--brk"></span>${T.legend.brk}</li>
          <li><span class="sw sw--we"></span>${T.legend.we}</li>
          ${Object.values(regions).some(x => x.school.length) ? `<li><span class="sw sw--sch"></span>${T.legend.school}</li>` : ''}
        </ul>
      </div>
    </section>`;
  const data = { lang, year: Y, region: selected, leave: state.leave, regions };
  return { html, data, plan: p };
}

// ---------- content blocks ----------
const TX = {
  fr: { notStat: 'pas férié selon la loi', local: 'local', weekend: 'week-end', off: 'chômé', source: 'Source', date: 'Date', wd: 'Jour', hol: 'Jour férié' },
  it: { notStat: 'non festivo per legge', local: 'locale', weekend: 'fine settimana', off: 'giorno libero', source: 'Fonte', date: 'Data', wd: 'Giorno', hol: 'Festività' }
};
function holidayTable(rd, lang, cc) {
  if (TX[lang]) {
    const X = TX[lang];
    const rows = rd.holidays.filter(h => h.date.startsWith(String(Y))).map(h => {
      const w = C.dow(C.parseISO(h.date)), we = w === 0 || w === 6;
      const tag = h.type === 'optional' ? X.notStat : h.type === 'partial' ? X.local : we ? X.weekend : X.off;
      return `<tr${we ? ' class="is-weekend"' : ''}><td>${esc(C.fmtDate(h.date, lang, cc, true))}</td><td>${C.weekday(h.date, lang)}</td><td>${esc(h.name[lang])} <span class="tag${!we && h.type === 'public' ? ' tag--work' : ''}">${tag}</span>${h.note ? `<small>${esc(h.note[lang])}</small>` : ''}</td></tr>`;
    }).join('');
    return `<div class="table-scroll"><table><thead><tr><th>${X.date}</th><th>${X.wd}</th><th>${X.hol}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="source">${X.source} : ${esc(countries[cc].holidaySource[lang])}</p>`.replace(`${TX.it.source} : `, `${TX.it.source}: `);
  }
  const T = lang === 'en';
  const rows = rd.holidays.filter(h => h.date.startsWith(String(Y))).map(h => {
    const w = C.dow(C.parseISO(h.date)), we = w === 0 || w === 6;
    let tag = '';
    if (h.type === 'optional') tag = `<span class="tag">${T ? 'not statutory' : 'kein gesetzlicher Feiertag'}</span>`;
    else if (h.type === 'partial') tag = `<span class="tag">${T ? 'local' : 'regional'}</span>`;
    else if (we) tag = `<span class="tag">${T ? 'weekend' : 'Wochenende'}</span>`;
    else tag = `<span class="tag tag--work">${T ? 'day off' : 'arbeitsfrei'}</span>`;
    return `<tr${we ? ' class="is-weekend"' : ''}><td>${esc(C.fmtDate(h.date, lang, cc, true))}</td><td>${C.weekday(h.date, lang)}</td><td>${esc(h.name[lang])} ${tag}${h.note ? `<small>${esc(h.note[lang])}</small>` : ''}</td></tr>`;
  }).join('');
  const src = countries[cc] && countries[cc].holidaySource ? `<p class="source">${T ? 'Source' : 'Quelle'}: ${esc(countries[cc].holidaySource[lang])}</p>` : '';
  return `<div class="table-scroll"><table><thead><tr><th>${T ? 'Date' : 'Datum'}</th><th>${T ? 'Weekday' : 'Wochentag'}</th><th>${T ? 'Holiday' : 'Feiertag'}</th></tr></thead><tbody>${rows}</tbody></table></div>${src}`;
}

function schoolTable(rd, lang, cc) {
  const T = lang === 'en';
  const list = rd.school.filter(inYear);
  if (!list.length) return '';
  const rows = list.map(p => `<tr><td>${esc(school.kinds[p.kind][lang])}</td><td>${esc(C.fmtRange(p.from, p.to, lang, cc, true))}</td><td>${spanDays(p.from, p.to)}</td></tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr><th>${T ? 'Holidays' : 'Ferien'}</th><th>${T ? 'Dates' : 'Zeitraum'}</th><th>${T ? 'Days' : 'Tage'}</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="source">${T ? 'Source' : 'Quelle'}: ${esc(countries[cc].schoolSource[lang])} ${T ? 'Individual schools may add movable days off.' : 'Einzelne Schulen können zusätzliche schulautonome bzw. bewegliche Tage festlegen.'}</p>`;
}

function fromTo(a, b, lang, cc) {
  return lang === 'fr' ? `du ${C.fmtDate(a, lang, cc)} au ${C.fmtDate(b, lang, cc)}` : `dal ${C.fmtDate(a, lang, cc)} al ${C.fmtDate(b, lang, cc)}`;
}
function bridgeList(bridges, rd, lang, cc) {
  if (lang === 'fr' || lang === 'it') {
    const F = lang === 'fr';
    const holName = d => (rd.holidays.find(h => h.date === d && h.on) || {}).name[lang];
    return `<ul class="bridges">` + bridges.map(b => {
      const best = b.best, first = b.holidays[0];
      const dates = best.leave.map(d => C.fmtDate(d, lang, cc, false, true)).join(', ');
      const main = F
        ? `<span class="bridge-ratio"><mark>${best.cost} ${plural(best.cost, 'jour de vacances', 'jours de vacances')}</mark> pour ${best.len} jours libres</span> : posez ${esc(dates)}, libre ${esc(fromTo(best.from, best.to, lang, cc))}.`
        : `<span class="bridge-ratio"><mark>${best.cost} ${plural(best.cost, 'giorno di ferie', 'giorni di ferie')}</mark> per ${best.len} giorni liberi</span>: prendi ${esc(dates)}, libero ${esc(fromTo(best.from, best.to, lang, cc))}.`;
      const alt = b.long ? `<span class="bridge-alt">${F ? `Ou ${b.long.cost} jours de vacances pour ${b.long.len} jours libres (${esc(fromTo(b.long.from, b.long.to, lang, cc))}).` : `Oppure ${b.long.cost} giorni di ferie per ${b.long.len} giorni liberi (${esc(fromTo(b.long.from, b.long.to, lang, cc))}).`}</span>` : '';
      return `<li><span class="bridge-hol">${esc(b.holidays.map(holName).join(', '))}<small>${esc(C.weekday(first, lang))} ${esc(C.fmtDate(first, lang, cc, true))}</small></span><span>${main} ${alt}</span></li>`;
    }).join('') + `</ul>`;
  }
  const T = lang === 'en';
  const holName = d => (rd.holidays.find(h => h.date === d && h.on) || {}).name[lang];
  return `<ul class="bridges">` + bridges.map(b => {
    const names = b.holidays.map(holName).join(', ');
    const first = b.holidays[0];
    const best = b.best;
    const dates = best.leave.map(d => C.fmtDate(d, lang, cc, false, true)).join(', ');
    const main = T
      ? `<span class="bridge-ratio"><mark>${best.cost} ${plural(best.cost, 'day', 'days')} of leave</mark> for ${best.len} days off</span>: take ${esc(dates)}, off ${esc(dot(C.fmtRange(best.from, best.to, lang, cc)))}`
      : `<span class="bridge-ratio"><mark>${best.cost} ${plural(best.cost, 'Urlaubstag', 'Urlaubstage')}</mark> für ${best.len} Tage frei</span>: ${esc(dates)} nehmen, frei von ${esc(dot(C.fmtRange(best.from, best.to, lang, cc)))}`;
    const alt = b.long ? (T
      ? `<span class="bridge-alt">Or ${b.long.cost} days of leave for ${b.long.len} days off (${esc(C.fmtRange(b.long.from, b.long.to, lang, cc))}).</span>`
      : `<span class="bridge-alt">Oder ${b.long.cost} Urlaubstage für ${b.long.len} Tage frei (${esc(C.fmtRange(b.long.from, b.long.to, lang, cc))}).</span>`) : '';
    return `<li><span class="bridge-hol">${esc(names)}<small>${esc(C.weekday(first, lang))}, ${esc(C.fmtDate(first, lang, cc, true))}</small></span><span>${main} ${alt}</span></li>`;
  }).join('') + `</ul>`;
}

function faqBlock(items) {
  return `<div class="faq">` + items.map(i => `<details><summary>${esc(i.q)}</summary><p>${i.a}</p></details>`).join('') + `</div>`;
}
function faqLd(items) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') } })) };
}
function breadcrumbLd(crumbs) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: url(c.href || c.self) })) };
}
function appLd(lang, name, p) {
  return { '@context': 'https://schema.org', '@type': 'WebApplication', name, url: url(p), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: lang, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } };
}

function ctaBlock(lang, cc, regionName, noSchool) {
  if (lang === 'fr') return `<div class="wrap"><aside class="cta"><div><h2>Planifiez ${Y} sur papier ou dans Excel</h2><p>Un calendrier annuel à imprimer avec tous les jours fériés${regionName ? ' du canton de ' + esc(regionName) : ''}, et un tableur qui compte vos jours de vacances restants et montre les chevauchements dans l’équipe ou entre les deux parents.</p></div><a class="btn" href="${productUrl(lang)}">Voir le planificateur</a></aside></div>`;
  if (lang === 'it') return `<div class="wrap"><aside class="cta"><div><h2>Pianifica il ${Y} su carta o in Excel</h2><p>Un calendario annuale da stampare con tutti i giorni festivi${regionName ? ' del Cantone ' + esc(regionName) : ''}, più un foglio di calcolo che conta le ferie residue e mostra le sovrapposizioni nel team o tra i due genitori.</p></div><a class="btn" href="${productUrl(lang)}">Scopri il pianificatore</a></aside></div>`;
  const T = lang === 'en';
  const h = T ? `Plan ${Y} on paper or in Excel` : `${Y} auf Papier oder in Excel planen`;
  const t = T
    ? `A printable year planner with every holiday${noSchool ? '' : ' and school break'}${regionName ? ' for ' + esc(regionName) : ''}, plus a spreadsheet that counts your remaining leave and shows clashes between team members or both parents.`
    : `Jahresplaner zum Ausdrucken mit allen Feiertagen${noSchool ? '' : ' und Schulferien'}${regionName ? ' für ' + esc(regionName) : ''}, dazu eine Excel-Tabelle, die deinen Resturlaub zählt und Überschneidungen im Team oder zwischen beiden Elternteilen zeigt.`;
  return `<div class="wrap"><aside class="cta"><div><h2>${h}</h2><p>${t}</p></div><a class="btn" href="${productUrl(lang)}">${T ? 'See the planner' : 'Zum Urlaubsplaner'}</a></aside></div>`;
}

function regionLinks(cc, lang, currentCode) {
  return `<ul class="regions">` + countries[cc].regions.map(r => r.code === currentCode
    ? `<li><span aria-current="page">${esc(r.name[lang])}</span></li>`
    : `<li><a href="${regionUrl(cc, r, lang)}">${esc(lang === 'fr' ? `Jours fériés ${Y} ${r.in.fr}` : lang === 'it' ? `Giorni festivi ${Y} ${r.in.it}` : `${countries[cc].term[lang].replace(/^./, c => c.toUpperCase())} ${Y} ${r.in[lang]}`)}</a></li>`).join('') + `</ul>`;
}

// ---------- region page ----------
function regionPage(cc, r, lang) {
  const country = countries[cc], T = lang === 'en';
  const rd = regionData(cc, r);
  const days = daysFor(rd);
  const pub = rd.holidays.filter(h => h.type === 'public' && h.date.startsWith(String(Y)));
  const isWd = h => { const w = C.dow(C.parseISO(h.date)); return w > 0 && w < 6; };
  const wk = pub.filter(isWd), weH = pub.filter(h => !isWd(h));
  const bridges = C.bridgeDays(days, Y);
  const freeLW = C.freeLongWeekends(days, Y);
  const pl = planner(lang, cc, [key(cc, r.code)], key(cc, r.code));
  const res = pl.plan.result;
  const N = cfg.plannerDefaultLeave;
  const top = bridges.slice().sort((a, b) => (b.best.len / b.best.cost - a.best.len / a.best.cost) || (b.best.len - a.best.len))[0];
  const term = country.term[lang], Term = term.replace(/^./, c => c.toUpperCase());
  const p = regionUrl(cc, r, lang);
  const other = regionUrl(cc, r, T ? 'de' : 'en');
  const hrefDe = regionUrl(cc, r, 'de'), hrefEn = regionUrl(cc, r, 'en');
  const alt = alternates(cc, l => regionUrl(cc, r, l));
  if (lang === 'fr' || lang === 'it') return regionPageRo(cc, r, lang, alt);
  const crumbs = [
    { name: T ? 'Home' : 'Start', href: homeUrl(lang) },
    { name: `${Term} ${Y} ${country.inName[lang]}`, href: countryUrl(cc, lang) },
    { name: r.name[lang], self: p }
  ];
  const hasSchool = rd.school.length > 0;
  const title = T ? `Bridge days ${Y} in ${r.name.en}, ${country.name.en}: holidays & leave planner` : `${Term} ${Y} ${r.name.de}: Feiertage${hasSchool ? ', Schulferien' : ''} & Urlaubsplaner`;
  const desc = T
    ? `All public holidays${hasSchool ? ', bridge days and school holidays' : ' and bridge days'} ${Y} in ${r.name.en}. The free planner shows how ${N} days of leave give you ${res.total} days off.`
    : `Alle Feiertage${hasSchool ? `, ${term} und Schulferien` : ` und ${term}`} ${Y} ${r.in.de}. Der kostenlose Planer zeigt, wie ${N} Urlaubstage ${res.total} freie Tage ergeben.`;
  const h1 = T ? `Bridge days ${Y} in ${r.name.en}` : `${Term} ${Y} ${r.in.de}`;
  const lede = T
    ? `In ${Y}, ${wk.length} of the ${pub.length} public holidays in ${esc(r.name.en)} fall on a weekday. With <strong>${N} days of leave</strong> you get <strong>${res.total} days off</strong>. Set your own number below and the plan updates instantly.`
    : `${Y} fallen ${esc(r.in.de)} ${wk.length} von ${pub.length} gesetzlichen Feiertagen auf einen Werktag. Mit <strong>${N} Urlaubstagen</strong> kommst du auf <strong>${res.total} freie Tage</strong>. Stell unten deine eigenen Urlaubstage ein, der Plan rechnet sofort neu.`;

  const summer = rd.school.filter(s => s.kind === 'summer' && inYear(s))[0];
  const winter = rd.school.filter(s => ['semester', 'winter', 'spring'].includes(s.kind) && inYear(s) && s.from.startsWith(String(Y)))[0];
  const xmasEve = rd.holidays.find(h => h.id === 'xmaseve' && h.date.startsWith(String(Y)));
  const listNames = arr => arr.map(h => `${h.name[lang]} (${C.weekday(h.date, lang)}, ${C.fmtDate(h.date, lang, cc)})`).join(', ');
  const faq = [];
  faq.push(T
    ? { q: `How many public holidays does ${r.name.en} have in ${Y}?`, a: `${r.name.en} has ${pub.length} public holidays in ${Y}. ${wk.length} fall on a weekday: ${esc(listNames(wk))}.${weH.length ? ` ${weH.length} fall on a weekend: ${esc(listNames(weH))}.` : ''}` }
    : { q: `Wie viele Feiertage hat ${r.name.de} ${Y}?`, a: `${r.name.de} hat ${Y} ${pub.length} gesetzliche Feiertage. ${wk.length} davon fallen auf einen Werktag: ${esc(listNames(wk))}.${weH.length ? ` ${weH.length} fallen aufs Wochenende: ${esc(listNames(weH))}.` : ''}` });
  if (top) faq.push(T
    ? { q: `What is the best bridge day in ${r.name.en} in ${Y}?`, a: `The most efficient is around ${esc(top.holidays.map(d => rd.holidays.find(h => h.date === d && h.on).name.en).join(' and '))}: ${top.best.cost} ${plural(top.best.cost, 'day', 'days')} of leave (${esc(top.best.leave.map(d => C.fmtDate(d, lang, cc, false, true)).join(', '))}) ${plural(top.best.cost, 'gives', 'give')} you ${top.best.len} days off in a row, ${esc(C.fmtRange(top.best.from, top.best.to, lang, cc, true))}.` }
    : { q: `Welcher ${country.termSingular.de} lohnt sich ${Y} ${r.in.de} am meisten?`, a: `Am effizientesten rund um ${esc(top.holidays.map(d => rd.holidays.find(h => h.date === d && h.on).name.de).join(' und '))}: ${top.best.cost} ${plural(top.best.cost, 'Urlaubstag', 'Urlaubstage')} (${esc(top.best.leave.map(d => C.fmtDate(d, lang, cc, false, true)).join(', '))}) ${plural(top.best.cost, 'bringt', 'bringen')} ${top.best.len} freie Tage am Stück, ${esc(C.fmtRange(top.best.from, top.best.to, lang, cc, true))}.` });
  faq.push(T
    ? { q: `How do I get the most days off in ${Y} with little leave?`, a: `Put your leave next to the holidays that fall on Tuesdays and Thursdays first, then build longer breaks around Easter, Whitsun and Christmas. In ${esc(r.name.en)}, ${N} days of leave placed this way give ${res.total} days off in ${res.breaks.length} breaks. The planner on this page works it out for any number of leave days.` }
    : { q: `Wie bekomme ich ${Y} mit wenig Urlaub die meisten freien Tage?`, a: `Zuerst die ${term} neben Feiertagen am Dienstag und Donnerstag nehmen, dann längere Urlaube um Ostern, Pfingsten und Weihnachten bauen. ${esc(r.in.de.replace(/^./, c => c.toUpperCase()))} ergeben ${N} so verteilte Urlaubstage ${res.total} freie Tage in ${res.breaks.length} Etappen. Der Planer auf dieser Seite rechnet das für jede Anzahl an Urlaubstagen aus.` });
  if (summer) faq.push(T
    ? { q: `When are the summer school holidays ${Y} in ${r.name.en}?`, a: `Summer holidays ${Y} in ${esc(r.name.en)} run ${esc(C.fmtRange(summer.from, summer.to, lang, cc, true))}.${winter ? ` The ${esc(school.kinds[winter.kind].en.toLowerCase())} is ${esc(C.fmtRange(winter.from, winter.to, lang, cc, true))}.` : ''}` }
    : { q: `Wann sind die Sommerferien ${Y} ${r.in.de}?`, a: `Die Sommerferien ${Y} ${esc(r.in.de)} dauern von ${esc(C.fmtRange(summer.from, summer.to, lang, cc, true))}.${winter ? ` Die ${esc(school.kinds[winter.kind].de)} sind von ${esc(C.fmtRange(winter.from, winter.to, lang, cc, true))}.` : ''}` });
  if (xmasEve) faq.push(T
    ? { q: `Is 24 December ${Y} a public holiday in ${r.name.en}?`, a: `No. Christmas Eve is not a statutory holiday in ${country.name.en}, although many employers give it (half) off. In ${Y} it falls on a ${C.weekday(xmasEve.date, 'en')}. If you have it off, tick it under “More settings” in the planner.` }
    : { q: `Ist der 24. Dezember ${Y} ein Feiertag?`, a: `Nein. Der Heilige Abend ist ${country.inName.de} kein gesetzlicher Feiertag, wird aber ${cc === 'at' ? 'laut vielen Kollektivverträgen' : 'von vielen Arbeitgebern'} ganz oder halb freigegeben. ${Y} fällt er auf einen ${C.weekday(xmasEve.date, 'de')}. Wenn du ihn frei hast, hak ihn im Planer unter „Weitere Einstellungen“ an.` });
  if (cc === 'at' && !T) faq.push({ q: 'Was ist ein Fenstertag?', a: 'Ein Fenstertag ist ein einzelner Arbeitstag zwischen einem Feiertag und dem Wochenende, zum Beispiel der Freitag nach Christi Himmelfahrt. Wer ihn freinimmt, hat mit einem Urlaubstag vier Tage am Stück frei. In Deutschland heißt er Brückentag.' });

  const main = `
    ${pl.html}
    ${adSlot('region-top')}
    <section class="section"><div class="wrap">
      <h2>${T ? `The best bridge days ${Y} in ${esc(r.name.en)}` : `Die besten ${term} ${Y} ${esc(r.in.de)}`}</h2>
      <p>${T ? `Each holiday with the cheapest way to turn it into a long break, and a longer option if you can spare a few more days.` : `Zu jedem Feiertag die günstigste Variante für ein langes Wochenende und eine längere, falls du ein paar Tage mehr übrig hast.`}</p>
      ${bridgeList(bridges, rd, lang, cc)}
    </div></section>
    ${freeLW.length ? `<section class="section"><div class="wrap">
      <h2>${T ? `Long weekends without taking leave` : `Lange Wochenenden ganz ohne Urlaub`}</h2>
      <ul>${freeLW.map(w => `<li>${esc(C.fmtRange(w.from, w.to, lang, cc, true))}: ${w.len} ${T ? 'days' : 'Tage'}</li>`).join('')}</ul>
    </div></section>` : ''}
    <section class="section"><div class="wrap">
      <h2>${T ? `Public holidays ${Y} in ${esc(r.name.en)}` : `Feiertage ${Y} ${esc(r.in.de)}`}</h2>
      ${holidayTable(rd, lang, cc)}
    </div></section>
    ${hasSchool ? `<section class="section"><div class="wrap">
      <h2>${T ? `School holidays ${Y} in ${esc(r.name.en)}` : `Schulferien ${Y} ${esc(r.in.de)}`}</h2>
      ${schoolTable(rd, lang, cc)}
    </div></section>` : ''}
    ${adSlot('region-mid')}
    ${ctaBlock(lang, cc, r.name[lang], !hasSchool)}
    <section class="section"><div class="wrap">
      <h2>${T ? 'Frequently asked questions' : 'Häufige Fragen'}</h2>
      ${faqBlock(faq)}
    </div></section>
    <section class="section section--links"><div class="wrap">
      <h2>${T ? `Other states in ${country.name.en}` : `Andere Bundesländer`}</h2>
      ${regionLinks(cc, lang, r.code)}
    </div></section>`;
  writeCC(cc, lang, p, page({
    lang, cc, title, desc, path: p, alt, h1, crumbs: crumbs.slice(0, 2).concat([{ name: r.name[lang] }]),
    body: { lede, main },
    jsonld: [breadcrumbLd(crumbs), faqLd(faq), appLd(lang, T ? `Leave planner ${Y} ${r.name.en}` : `Urlaubsplaner ${Y} ${r.name.de}`, p)],
    data: pl.data
  }));
  return { r, total: res.total, wk: wk.length, pub: pub.length };
}

// ---------- country page ----------
function countryPage(cc, lang, stats) {
  const country = countries[cc], T = lang === 'en';
  const term = country.term[lang], Term = term.replace(/^./, c => c.toUpperCase());
  const p = countryUrl(cc, lang);
  const alt = alternates(cc, l => countryUrl(cc, l));
  if (lang === 'fr' || lang === 'it') return countryPageRo(cc, lang, stats, alt);
  const nat = country.holidays.filter(h => !h.regions && (h.type || 'public') === 'public');
  const natCountry = Object.assign({}, country, { holidays: nat });
  const off = [Y - 1, Y, Y + 1].reduce((a, y) => a.concat(C.holidaysFor(natCountry, null, y).map(h => h.date)), []);
  const days = C.buildDays(Y, off);
  const bridges = C.bridgeDays(days, Y);
  const rdNat = { holidays: [Y - 1, Y, Y + 1].reduce((a, y) => a.concat(C.holidaysFor(natCountry, null, y)), []), school: [] };
  const sel = key(cc, cfg.defaultRegion[cc]);
  const pl = planner(lang, cc, country.regions.map(r => key(cc, r.code)), sel);
  const uniform = country.holidays.every(h => !h.regions || (h.type && h.type !== 'public'));
  const title = T ? `Bridge days ${Y} in ${country.name.en}: all states, holidays & planner` : `${Term} ${Y} ${country.inName.de}: alle Bundesländer & Urlaubsplaner`;
  const desc = T
    ? `Public holidays, bridge days and school holidays ${Y} for every state in ${country.name.en}, with a free planner that spreads your leave for the most days off.`
    : `Feiertage, ${term} und Schulferien ${Y} für alle Bundesländer ${country.inName.de}. Mit kostenlosem Planer, der deine Urlaubstage optimal verteilt.`;
  const h1 = T ? `Bridge days ${Y} in ${country.name.en}` : `${Term} ${Y} ${country.inName.de}`;
  const lede = T
    ? (uniform ? `${country.name.en} has the same ${nat.length} public holidays in every state; school holidays and patron saints’ days differ. Pick your state below.` : `${country.name.en} has ${nat.length} nationwide public holidays; each state adds its own. Pick your state below.`)
    : (uniform ? `${(country.nameNom || country.name).de} hat in allen Bundesländern dieselben ${nat.length} gesetzlichen Feiertage. Unterschiede gibt es bei Schulferien und Landespatronen. Wähle unten dein Bundesland.` : `${(country.nameNom || country.name).de} hat ${nat.length} landesweite Feiertage, dazu kommen je nach Bundesland weitere. Wähle unten dein Bundesland.`);
  const rows = stats.map(s => `<tr><td><a href="${regionUrl(cc, s.r, lang)}">${esc(s.r.name[lang])}</a></td><td>${s.pub}</td><td>${s.wk}</td><td>${s.total}</td></tr>`).join('');
  const crumbs = [{ name: T ? 'Home' : 'Start', href: homeUrl(lang) }, { name: country.name[lang], self: p }];
  const faq = T ? [
    { q: `Which state in ${country.name.en} has the most public holidays in ${Y}?`, a: (() => { const m = stats.slice().sort((a, b) => b.wk - a.wk); return `${esc(m[0].r.name.en)} has the most holidays on weekdays in ${Y} (${m[0].wk}). The fewest: ${esc(m[m.length - 1].r.name.en)} (${m[m.length - 1].wk}).`; })() }
  ] : [
    { q: `Welches Bundesland hat ${Y} die meisten Feiertage?`, a: (() => { const m = stats.slice().sort((a, b) => b.wk - a.wk); const topWk = m[0].wk; const tops = m.filter(s => s.wk === topWk).map(s => esc(s.r.name.de)); return uniform ? `In ${country.name.de} sind die gesetzlichen Feiertage überall gleich: ${Y} fallen ${topWk} davon auf einen Werktag. Unterschiede gibt es nur bei den Landespatronen, die schulfrei, aber keine gesetzlichen Feiertage sind.` : `${tops.join(', ')} ${tops.length > 1 ? 'haben' : 'hat'} ${Y} mit ${topWk} die meisten Feiertage an Werktagen. Am wenigsten: ${esc(m[m.length - 1].r.name.de)} (${m[m.length - 1].wk}).`; })() }
  ];
  const main = `
    ${pl.html}
    ${adSlot('country-top')}
    <section class="section"><div class="wrap">
      <h2>${T ? `All states compared` : `Alle Bundesländer im Vergleich`}</h2>
      <div class="table-scroll"><table><thead><tr><th>${T ? 'State' : 'Bundesland'}</th><th>${T ? 'Public holidays' : 'Feiertage'}</th><th>${T ? 'On weekdays' : 'davon an Werktagen'}</th><th>${T ? `Days off with ${cfg.plannerDefaultLeave} days of leave` : `Tage frei mit ${cfg.plannerDefaultLeave} Urlaubstagen`}</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div></section>
    <section class="section"><div class="wrap">
      <h2>${T ? `Nationwide bridge days ${Y}` : `${Term} ${Y} für ${country.whole ? country.whole.de : 'ganz ' + country.name.de}`}</h2>
      <p>${T ? `Based on holidays that apply in every state. Your state page adds its own holidays.` : `Berechnet mit den Feiertagen, die in jedem Bundesland gelten. Auf der Seite deines Bundeslands kommen die regionalen dazu.`}</p>
      ${bridgeList(bridges, rdNat, lang, cc)}
    </div></section>
    ${ctaBlock(lang, cc, null, !(school[cc] || []).length)}
    <section class="section"><div class="wrap"><h2>${T ? 'Frequently asked questions' : 'Häufige Fragen'}</h2>${faqBlock(faq)}</div></section>
    <section class="section section--links"><div class="wrap"><h2>${T ? 'All states' : 'Alle Bundesländer'}</h2>${regionLinks(cc, lang, null)}</div></section>`;
  writeCC(cc, lang, p, page({ lang, cc, title, desc, path: p, alt, h1, crumbs: [crumbs[0], { name: country.name[lang] }], body: { lede, main }, jsonld: [breadcrumbLd(crumbs), faqLd(faq), appLd(lang, T ? `Leave planner ${Y}` : `Urlaubsplaner ${Y}`, p)], data: pl.data }));
}

// ---------- home ----------
function homePage(lang, allStats) {
  const T = lang === 'en';
  const p = homeUrl(lang);
  const alt = alternates(null, homeUrl);
  if (lang === 'fr' || lang === 'it') return homePageRo(lang, alt);
  const keys = [];
  cfg.countries.forEach(cc => countries[cc].regions.forEach(r => keys.push(key(cc, r.code))));
  const pl = planner(lang, 'mixed', keys, key('at', cfg.defaultRegion.at));
  const title = T ? `Bridge days ${Y}: turn a few days of leave into long breaks` : `Brückentage & Fenstertage ${Y}: mit wenig Urlaub lange frei`;
  const desc = T
    ? `Free leave planner for ${Y}: pick your state and how many days of leave you have, and get the plan with the most days off. Austria, Germany and Switzerland, every state and canton.`
    : `Kostenloser Urlaubsplaner ${Y}: Bundesland und Urlaubstage wählen, und du bekommst den Plan mit den meisten freien Tagen. Für Österreich, Deutschland und die Schweiz.`;
  const h1 = T ? `Make ${Y} last longer` : `Mehr frei ${Y}`;
  const lede = T
    ? `Pick your state and how many days of leave you have. The planner finds the combination of bridge days and holidays that gives you the most time off, and you can save it straight to your calendar.`
    : `Wähle dein Bundesland und wie viele Urlaubstage du hast. Der Planer findet die Kombination aus Fenster- bzw. Brückentagen und Urlauben mit den meisten freien Tagen. Ergebnis direkt in den Kalender übernehmen.`;
  const blocks = cfg.countries.map(cc => `<div><h2>${esc(countries[cc].name[lang])}</h2>${cc === 'ch' ? swissify(regionLinks(cc, lang, null), lang) : regionLinks(cc, lang, null)}<p><a href="${countryUrl(cc, lang)}">${T ? `All of ${countries[cc].name.en} compared` : `${countries[cc].name.de} im Überblick`}</a></p></div>`).join('');
  const faq = T ? [
    { q: 'What is a bridge day?', a: 'A single working day between a public holiday and the weekend, such as the Friday after Ascension Day. Take it off and one day of leave becomes four days off in a row. Germans and Swiss call it Brückentag, Austrians Fenstertag.' },
    { q: 'How does the planner decide?', a: 'It checks every possible break in the year, counts the days of leave each one costs and picks the set that gives the most days off in total for your budget. By default it only suggests breaks that include a public holiday or last at least nine days, so you do not waste leave on ordinary long weekends.' },
    { q: 'Can I plan around school holidays?', a: 'Yes. Under “More settings”, tick “Only take leave during school holidays” and every suggested day of leave will fall inside your state’s school holidays (Austria and Germany).' }
  ] : [
    { q: 'Was ist ein Brückentag bzw. Fenstertag?', a: 'Ein einzelner Arbeitstag zwischen Feiertag und Wochenende, etwa der Freitag nach Christi Himmelfahrt. Wer ihn freinimmt, macht aus einem Urlaubstag vier freie Tage am Stück. In Deutschland und der Schweiz sagt man Brückentag, in Österreich Fenstertag.' },
    { q: 'Wie rechnet der Planer?', a: 'Er prüft jeden möglichen Zeitraum im Jahr, zählt die nötigen Urlaubstage und wählt die Kombination mit den meisten freien Tagen für dein Budget. Standardmäßig schlägt er nur Zeiträume vor, die einen Feiertag enthalten oder mindestens neun Tage dauern. So verpuffen keine Urlaubstage an gewöhnlichen langen Wochenenden.' },
    { q: 'Kann ich meinen Urlaub an die Schulferien anpassen?', a: 'Ja. Unter „Weitere Einstellungen“ die Option „Urlaub nur in den Schulferien nehmen“ anhaken. Dann liegen alle vorgeschlagenen Urlaubstage in den Ferien deines Bundeslands (für Österreich und Deutschland).' }
  ];
  const main = `
    ${pl.html}
    ${adSlot('home-top')}
    <section class="section"><div class="wrap country-grid">${blocks}</div></section>
    ${ctaBlock(lang, null, null)}
    <section class="section"><div class="wrap"><h2>${T ? 'Frequently asked questions' : 'Häufige Fragen'}</h2>${faqBlock(faq)}</div></section>`;
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: url(p), inLanguage: lang };
  write(p, page({ lang, cc: null, title, desc, path: p, alt, h1, body: { lede, main }, jsonld: [site, faqLd(faq), appLd(lang, T ? `Leave planner ${Y}` : `Urlaubsplaner ${Y}`, p)], data: pl.data }));
}

// ---------- product page ----------
function productPage(lang) {
  const T = lang === 'en';
  const p = productUrl(lang);
  const alt = alternates(null, productUrl);
  if (lang === 'fr' || lang === 'it') return productPageRo(lang, alt);
  const buy = cfg.product.url
    ? `<a class="btn" href="${esc(cfg.product.url)}" rel="noopener">${T ? 'Buy and download' : 'Kaufen und herunterladen'}</a><p class="source">${T ? 'Secure checkout via Gumroad. VAT included.' : 'Sichere Bezahlung über Gumroad. Inkl. MwSt.'}</p>`
    : `<button class="btn" type="button" disabled>${T ? 'Available soon' : 'Bald erhältlich'}</button>`;
  const title = T ? `Leave planner ${Y}: printable PDF and Excel template` : `Urlaubsplaner ${Y} zum Ausdrucken (PDF) und als Excel-Vorlage`;
  const desc = T ? `Year planner ${Y} with all holidays and school breaks for your state, plus an Excel sheet for leave balance, team and family planning.` : `Jahresplaner ${Y} mit allen Feiertagen und Schulferien deines Bundeslands, dazu eine Excel-Vorlage für Resturlaub, Team- und Familienplanung.`;
  const main = `<div class="wrap product">
    <div class="prose">
      <p>${T ? 'The free planner on this site tells you which days to take. This pack is for keeping track over the year:' : 'Der kostenlose Planer auf dieser Seite sagt dir, welche Tage du nehmen solltest. Dieses Paket hilft dir, das ganze Jahr den Überblick zu behalten:'}</p>
      <ul class="ticks">
        ${(T ? [
          `Printable ${Y} year planners (PDF, A4 landscape) for all 9 Austrian and 16 German states and all 26 Swiss cantons, with public holidays, school holidays and bridge-day tips already marked`,
          'An Excel template that also works in Google Sheets: leave balance with allowance, days taken and days left',
          'A team view for up to 20 people that flags when too many are off at the same time',
          'A family view that lines up both parents’ leave with the school holidays',
          'In English, German, French and Italian'
        ] : [
          `Jahresplaner ${Y} zum Ausdrucken (PDF, A4 quer) für alle 9 österreichischen und 16 deutschen Bundesländer sowie alle 26 Schweizer Kantone, mit Feiertagen, Schulferien und Brückentag-Tipps`,
          'Excel-Vorlage, die auch in Google Tabellen funktioniert: Urlaubskonto mit Anspruch, genommenen und übrigen Tagen',
          'Teamansicht für bis zu 20 Personen, die zeigt, wann zu viele gleichzeitig frei haben',
          'Familienansicht, die den Urlaub beider Elternteile mit den Schulferien abgleicht',
          'Auf Deutsch, Englisch, Französisch und Italienisch'
        ]).map(li => `<li>${esc(li)}</li>`).join('')}
      </ul>
      <figure class="preview"><img src="/assets/product/planner-${lang}.jpg" width="1286" height="910" loading="lazy" alt="${T ? `Page 1 of the printable leave planner ${Y}` : `Seite 1 des Urlaubsplaners ${Y} zum Ausdrucken`}"></figure>
    </div>
    <aside class="buybox">
      <p class="price">${esc(cfg.product.price[lang])}</p>
      <p>${T ? 'One-off payment, instant download, free update for next year.' : 'Einmalzahlung, sofortiger Download, Update fürs Folgejahr inklusive.'}</p>
      ${buy}
    </aside>
  </div>`;
  write(p, page({ lang, cc: null, title, desc, path: p, alt, h1: T ? `Leave planner ${Y} to print and to fill in` : `Urlaubsplaner ${Y} zum Ausdrucken und Ausfüllen`, body: { lede: '', main }, jsonld: [] }));
}

// ---------- legal (templates, noindex) ----------
function legalPages() {
  const o = cfg.owner;
  const imp = `<div class="wrap prose">
    <p><strong>Vorlage – vor Veröffentlichung mit deinen Daten ausfüllen und prüfen.</strong></p>
    <h2>Angaben gemäß § 5 ECG und § 25 MedienG</h2>
    <p>${esc(o.name)}<br>${esc(o.address)}<br>E-Mail: ${esc(o.email)}</p>
    <p>Unternehmensgegenstand bzw. Blattlinie: ${esc(o.purpose)}</p>
    <p>Alle Angaben zu Feiertagen und Schulferien werden sorgfältig mit amtlichen Quellen abgeglichen, erfolgen aber ohne Gewähr.</p></div>`;
  const dsg = `<div class="wrap prose">
    <p><strong>Vorlage – vor Veröffentlichung prüfen und an deine tatsächlich genutzten Dienste anpassen.</strong></p>
    <h2>Verantwortlicher</h2><p>${esc(o.name)}, ${esc(o.address)}, ${esc(o.email)}</p>
    <h2>Hosting und Server-Logfiles</h2><p>Beim Aufruf der Website verarbeitet der Hosting-Anbieter technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser) zur sicheren Auslieferung der Seite (Art. 6 Abs. 1 lit. f DSGVO).</p>
    <h2>Urlaubsplaner</h2><p>Der Planer rechnet ausschließlich in deinem Browser. Deine Eingaben werden nicht an uns übertragen und nicht gespeichert. Es werden dafür keine Cookies gesetzt.</p>
    <h2>Werbung (Google AdSense)</h2><p>Sofern aktiviert: Diese Website nutzt Google AdSense der Google Ireland Limited. Cookies und ähnliche Technologien für personalisierte Werbung werden nur nach deiner Einwilligung über das Einwilligungsbanner gesetzt (Art. 6 Abs. 1 lit. a DSGVO). Du kannst die Einwilligung jederzeit widerrufen.</p>
    <h2>Kauf des Urlaubsplaners (Gumroad)</h2><p>Der kostenpflichtige Urlaubsplaner wird über Gumroad, Inc. (USA) verkauft, die als Verkäufer (Merchant of Record) auftritt und Zahlung, Steuern und Download abwickelt. Mit dem Klick auf „Kaufen“ verlässt du diese Website; es gilt die Datenschutzerklärung von Gumroad. Wir erhalten von Gumroad die für die Bestellung nötigen Daten (z. B. E-Mail-Adresse, Bestellung), um Support und Updates zu ermöglichen (Art. 6 Abs. 1 lit. b DSGVO).</p>
    <h2>Deine Rechte</h2><p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Beschwerden kannst du bei der Datenschutzbehörde (dsb.gv.at) einbringen.</p></div>`;
  write('/impressum/', page({ lang: 'de', cc: 'at', title: `Impressum | ${cfg.siteName}`, desc: 'Impressum', path: '/impressum/', alt: [{ hreflang: 'de', href: '/impressum/' }, { hreflang: 'en', href: '/en/imprint/' }], h1: 'Impressum', body: { main: imp }, noindex: true }));
  write('/datenschutz/', page({ lang: 'de', cc: 'at', title: `Datenschutz | ${cfg.siteName}`, desc: 'Datenschutzerklärung', path: '/datenschutz/', alt: [{ hreflang: 'de', href: '/datenschutz/' }, { hreflang: 'en', href: '/en/privacy/' }], h1: 'Datenschutzerklärung', body: { main: dsg }, noindex: true }));
  write('/en/imprint/', page({ lang: 'en', cc: null, title: `Imprint | ${cfg.siteName}`, desc: 'Imprint', path: '/en/imprint/', alt: [{ hreflang: 'de', href: '/impressum/' }, { hreflang: 'en', href: '/en/imprint/' }], h1: 'Imprint', body: { main: `<div class="wrap prose"><p>The legally binding imprint is available in German: <a href="/impressum/">Impressum</a>.</p></div>` }, noindex: true }));
  write('/en/privacy/', page({ lang: 'en', cc: null, title: `Privacy | ${cfg.siteName}`, desc: 'Privacy policy', path: '/en/privacy/', alt: [{ hreflang: 'de', href: '/datenschutz/' }, { hreflang: 'en', href: '/en/privacy/' }], h1: 'Privacy', body: { main: `<div class="wrap prose"><p>The planner runs entirely in your browser; nothing you enter is sent to us or stored. The full privacy policy is available in German: <a href="/datenschutz/">Datenschutzerklärung</a>.</p></div>` }, noindex: true }));
}

// ---------- French / Italian (Swiss) pages ----------
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const RO = {
  fr: {
    home: 'Accueil', faqH: 'Questions fréquentes',
    countryCrumb: `Jours fériés et ponts ${Y} en Suisse`,
    regionTitle: r => `Jours fériés ${Y} ${r.name.fr} : ponts et planificateur de congés`,
    regionDesc: (r, N, tot) => `Tous les jours fériés et ponts ${Y} ${r.in.fr}. Le planificateur gratuit montre comment ${N} jours de vacances vous donnent ${tot} jours libres.`,
    regionH1: r => `Jours fériés et ponts ${Y} ${r.in.fr}`,
    regionLede: (r, wk, pub, N, tot) => `En ${Y}, ${wk} des ${pub} jours fériés ${esc(r.in.fr)} tombent en semaine. Avec <strong>${N} jours de vacances</strong>, vous obtenez <strong>${tot} jours libres</strong>. Indiquez votre propre nombre de jours ci-dessous : le plan se recalcule aussitôt.`,
    bestH: r => `Les meilleurs ponts ${Y} ${r.in.fr}`,
    bestP: 'Pour chaque jour férié, la façon la moins coûteuse d’en faire un long week-end, et une variante plus longue si vous avez quelques jours de plus.',
    freeH: 'Longs week-ends sans poser de vacances', days: 'jours',
    holH: r => `Jours fériés ${Y} ${r.in.fr}`,
    othersH: 'Autres cantons',
    appName: r => `Planificateur de congés ${Y} ${r.name.fr}`,
    faqCount: (r, pub, wk, weH, list) => ({ q: `Combien y a-t-il de jours fériés ${r.in.fr} en ${Y} ?`, a: `${cap(r.in.fr)}, on compte ${pub} jours fériés en ${Y}. ${wk.length} tombent en semaine : ${esc(list(wk))}.${weH.length ? ` ${weH.length} tombent un week-end : ${esc(list(weH))}.` : ''}` }),
    faqBest: (r, names, top, dates, range) => ({ q: `Quel est le meilleur pont ${Y} ${r.in.fr} ?`, a: `Le plus rentable se situe autour de ${esc(names)} : ${top.best.cost} ${plural(top.best.cost, 'jour de vacances', 'jours de vacances')} (${esc(dates)}) ${plural(top.best.cost, 'donne', 'donnent')} ${top.best.len} jours libres d’affilée, ${esc(range)}.` }),
    faqMost: (r, N, res) => ({ q: `Comment avoir le plus de jours libres en ${Y} avec peu de vacances ?`, a: `Posez d’abord les ponts à côté des jours fériés qui tombent un mardi ou un jeudi, puis construisez des pauses plus longues autour de Pâques, de la Pentecôte et de Noël. ${esc(cap(r.in.fr))}, ${N} jours de vacances répartis ainsi donnent ${res.total} jours libres en ${res.breaks.length} périodes. Le planificateur de cette page fait le calcul pour n’importe quel nombre de jours.` }),
    faqXmas: wd => ({ q: `Le 24 décembre ${Y} est-il férié ?`, a: `Non. La veille de Noël n’est pas un jour férié en Suisse, mais de nombreux employeurs accordent la journée ou la demi-journée. En ${Y}, elle tombe un ${wd}. Si vous avez congé ce jour-là, cochez-le dans le planificateur sous « Plus de réglages ».` }),
    faqWhat: { q: 'Qu’est-ce qu’un pont ?', a: 'Un jour ouvrable isolé entre un jour férié et le week-end, par exemple le vendredi après l’Ascension. En le prenant, un seul jour de vacances vous donne quatre jours libres d’affilée.' },
    countryTitle: `Jours fériés et ponts ${Y} en Suisse : tous les cantons`,
    countryDesc: `Jours fériés et ponts ${Y} pour les 26 cantons suisses, avec un planificateur gratuit qui répartit vos jours de vacances pour un maximum de jours libres.`,
    countryH1: `Jours fériés et ponts ${Y} en Suisse`,
    countryLede: n => `En Suisse, ${n} jours fériés sont valables dans tous les cantons ; chaque canton ajoute les siens. Choisissez votre canton ci-dessous.`,
    compareH: 'Tous les cantons comparés', thCanton: 'Canton', thHol: 'Jours fériés', thWk: 'dont en semaine', thOff: N => `Jours libres avec ${N} jours de vacances`,
    natH: `Ponts ${Y} pour toute la Suisse`, natP: 'Calculé avec les jours fériés valables dans tous les cantons. La page de votre canton ajoute les jours fériés cantonaux.',
    faqMostCanton: (tops, wk, min) => ({ q: `Quel canton compte le plus de jours fériés en ${Y} ?`, a: `${tops.join(', ')} ${tops.length > 1 ? 'comptent' : 'compte'} en ${Y} le plus de jours fériés en semaine (${wk}). Le moins : ${min.name} (${min.wk}).` }),
    allH: 'Tous les cantons',
    homeTitle: `Ponts ${Y} en Suisse : plus de jours libres avec peu de vacances`,
    homeDesc: `Planificateur de congés gratuit pour ${Y} : choisissez votre canton et votre nombre de jours de vacances, et obtenez le plan avec le plus de jours libres. Pour les 26 cantons.`,
    homeH1: `Plus de jours libres en ${Y}`,
    homeLede: 'Choisissez votre canton et le nombre de jours de vacances dont vous disposez. Le planificateur trouve la combinaison de ponts et de vacances qui vous donne le plus de temps libre, à enregistrer directement dans votre calendrier.',
    homeAll: 'Tous les cantons comparés',
    faqHow: { q: 'Comment le planificateur calcule-t-il ?', a: 'Il examine chaque période possible de l’année, compte les jours de vacances nécessaires et choisit la combinaison qui vous donne le plus de jours libres pour votre budget. Par défaut, il ne propose que des périodes qui contiennent un jour férié ou durent au moins neuf jours, pour ne pas gaspiller de vacances sur de simples longs week-ends.' },
    plannerName: `Planificateur de congés ${Y}`,
    productTitle: `Planificateur de congés ${Y} à imprimer (PDF) et modèle Excel`,
    productDesc: `Calendrier annuel ${Y} avec tous les jours fériés de votre canton, et un modèle Excel pour le solde de vacances, l’équipe et la famille.`,
    productH1: `Planificateur de congés ${Y} à imprimer et à remplir`,
    productIntro: 'Le planificateur gratuit de ce site vous dit quels jours prendre. Ce pack vous aide à garder une vue d’ensemble toute l’année :',
    productList: [`Calendriers annuels ${Y} à imprimer (PDF, A4 paysage) pour les 26 cantons suisses, avec jours fériés et ponts conseillés, ainsi que pour l’Autriche et l’Allemagne`, 'Modèle Excel, compatible Google Sheets : solde de vacances avec droit, jours pris et jours restants', 'Vue d’équipe pour 20 personnes qui signale quand trop de personnes sont absentes en même temps', 'Vue famille qui coordonne les vacances des deux parents', 'En français, allemand, italien et anglais'],
    productNote: 'Paiement unique, téléchargement immédiat, mise à jour pour l’année suivante incluse.',
    buy: 'Acheter et télécharger', soon: 'Bientôt disponible',
    imprintTitle: 'Mentions légales', imprintBody: 'Les mentions légales juridiquement contraignantes sont disponibles en allemand :',
    privacyTitle: 'Confidentialité', privacyBody: 'Le planificateur fonctionne entièrement dans votre navigateur ; rien de ce que vous saisissez ne nous est transmis ni enregistré. La déclaration de confidentialité complète est disponible en allemand :'
  },
  it: {
    home: 'Home', faqH: 'Domande frequenti',
    countryCrumb: `Giorni festivi e ponti ${Y} in Svizzera`,
    regionTitle: r => `Giorni festivi ${Y} ${r.name.it}: ponti e pianificatore ferie`,
    regionDesc: (r, N, tot) => `Tutti i giorni festivi e i ponti ${Y} ${r.in.it}. Il pianificatore gratuito mostra come ${N} giorni di ferie ti danno ${tot} giorni liberi.`,
    regionH1: r => `Giorni festivi e ponti ${Y} ${r.in.it}`,
    regionLede: (r, wk, pub, N, tot) => `Nel ${Y}, ${wk} dei ${pub} giorni festivi ${esc(r.in.it)} cadono in un giorno feriale. Con <strong>${N} giorni di ferie</strong> ottieni <strong>${tot} giorni liberi</strong>. Inserisci qui sotto il tuo numero di giorni: il piano si ricalcola subito.`,
    bestH: r => `I ponti migliori ${Y} ${r.in.it}`,
    bestP: 'Per ogni festività, il modo più economico per trasformarla in un weekend lungo, e una variante più lunga se ti avanzano alcuni giorni.',
    freeH: 'Weekend lunghi senza prendere ferie', days: 'giorni',
    holH: r => `Giorni festivi ${Y} ${r.in.it}`,
    othersH: 'Altri cantoni',
    appName: r => `Pianificatore ferie ${Y} ${r.name.it}`,
    faqCount: (r, pub, wk, weH, list) => ({ q: `Quanti giorni festivi ci sono ${r.in.it} nel ${Y}?`, a: `${cap(r.in.it)} ci sono ${pub} giorni festivi nel ${Y}. ${wk.length} cadono in un giorno feriale: ${esc(list(wk))}.${weH.length ? ` ${weH.length} cadono nel fine settimana: ${esc(list(weH))}.` : ''}` }),
    faqBest: (r, names, top, dates, range) => ({ q: `Qual è il ponte migliore del ${Y} ${r.in.it}?`, a: `Il più conveniente è intorno a ${esc(names)}: ${top.best.cost} ${plural(top.best.cost, 'giorno di ferie', 'giorni di ferie')} (${esc(dates)}) ${plural(top.best.cost, 'dà', 'danno')} ${top.best.len} giorni liberi di fila, ${esc(range)}.` }),
    faqMost: (r, N, res) => ({ q: `Come avere più giorni liberi nel ${Y} con poche ferie?`, a: `Prendi prima i ponti accanto alle festività che cadono di martedì o di giovedì, poi costruisci pause più lunghe intorno a Pasqua, Pentecoste e Natale. ${esc(cap(r.in.it))}, ${N} giorni di ferie distribuiti così danno ${res.total} giorni liberi in ${res.breaks.length} periodi. Il pianificatore in questa pagina fa il calcolo per qualsiasi numero di giorni.` }),
    faqXmas: wd => ({ q: `Il 24 dicembre ${Y} è festivo?`, a: `No. La Vigilia di Natale non è un giorno festivo in Svizzera, ma molti datori di lavoro concedono la giornata o la mezza giornata libera. Nel ${Y} cade di ${wd}. Se hai libero quel giorno, selezionalo nel pianificatore sotto «Altre impostazioni».` }),
    faqWhat: { q: 'Che cos’è un ponte?', a: 'Un singolo giorno lavorativo tra una festività e il fine settimana, per esempio il venerdì dopo l’Ascensione. Prendendolo, un solo giorno di ferie ti dà quattro giorni liberi di fila.' },
    countryTitle: `Giorni festivi e ponti ${Y} in Svizzera: tutti i cantoni`,
    countryDesc: `Giorni festivi e ponti ${Y} per tutti i 26 cantoni svizzeri, con un pianificatore gratuito che distribuisce le tue ferie per avere più giorni liberi.`,
    countryH1: `Giorni festivi e ponti ${Y} in Svizzera`,
    countryLede: n => `In Svizzera ${n} giorni festivi valgono in tutti i cantoni; ogni cantone aggiunge i propri. Scegli il tuo cantone qui sotto.`,
    compareH: 'Tutti i cantoni a confronto', thCanton: 'Cantone', thHol: 'Giorni festivi', thWk: 'di cui feriali', thOff: N => `Giorni liberi con ${N} giorni di ferie`,
    natH: `Ponti ${Y} per tutta la Svizzera`, natP: 'Calcolato con le festività valide in tutti i cantoni. La pagina del tuo cantone aggiunge quelle cantonali.',
    faqMostCanton: (tops, wk, min) => ({ q: `Quale cantone ha più giorni festivi nel ${Y}?`, a: `${tops.join(', ')} ${tops.length > 1 ? 'hanno' : 'ha'} nel ${Y} il maggior numero di festività in giorni feriali (${wk}). Il minimo: ${min.name} (${min.wk}).` }),
    allH: 'Tutti i cantoni',
    homeTitle: `Ponti ${Y} in Svizzera: più giorni liberi con poche ferie`,
    homeDesc: `Pianificatore ferie gratuito per il ${Y}: scegli il tuo cantone e quanti giorni di ferie hai, e ottieni il piano con più giorni liberi. Per tutti i 26 cantoni.`,
    homeH1: `Più giorni liberi nel ${Y}`,
    homeLede: 'Scegli il tuo cantone e quanti giorni di ferie hai. Il pianificatore trova la combinazione di ponti e vacanze che ti dà più tempo libero, da salvare direttamente nel calendario.',
    homeAll: 'Tutti i cantoni a confronto',
    faqHow: { q: 'Come calcola il pianificatore?', a: 'Esamina ogni periodo possibile dell’anno, conta i giorni di ferie necessari e sceglie la combinazione che ti dà più giorni liberi con le ferie che hai. Di norma propone solo periodi che contengono una festività o durano almeno nove giorni, così non sprechi ferie in semplici weekend lunghi.' },
    plannerName: `Pianificatore ferie ${Y}`,
    productTitle: `Pianificatore ferie ${Y} da stampare (PDF) e modello Excel`,
    productDesc: `Calendario annuale ${Y} con tutti i giorni festivi del tuo cantone, più un modello Excel per il saldo ferie, il team e la famiglia.`,
    productH1: `Pianificatore ferie ${Y} da stampare e compilare`,
    productIntro: 'Il pianificatore gratuito di questo sito ti dice quali giorni prendere. Questo pacchetto ti aiuta a tenere tutto sotto controllo durante l’anno:',
    productList: [`Calendari annuali ${Y} da stampare (PDF, A4 orizzontale) per i 26 cantoni svizzeri, con festività e ponti consigliati, oltre che per Austria e Germania`, 'Modello Excel, compatibile con Google Sheets: saldo ferie con giorni spettanti, presi e residui', 'Vista team per 20 persone che segnala quando troppe persone sono assenti contemporaneamente', 'Vista famiglia che coordina le ferie dei due genitori', 'In italiano, tedesco, francese e inglese'],
    productNote: 'Pagamento unico, download immediato, aggiornamento per l’anno successivo incluso.',
    buy: 'Acquista e scarica', soon: 'Presto disponibile',
    imprintTitle: 'Note legali', imprintBody: 'Le note legali giuridicamente vincolanti sono disponibili in tedesco:',
    privacyTitle: 'Privacy', privacyBody: 'Il pianificatore funziona interamente nel tuo browser; nulla di ciò che inserisci ci viene trasmesso o salvato. L’informativa completa sulla privacy è disponibile in tedesco:'
  }
};

function regionPageRo(cc, r, lang, alt) {
  const X = RO[lang], country = countries[cc];
  const rd = regionData(cc, r);
  const days = daysFor(rd);
  const pub = rd.holidays.filter(h => h.type === 'public' && h.date.startsWith(String(Y)));
  const isWd = h => { const w = C.dow(C.parseISO(h.date)); return w > 0 && w < 6; };
  const wk = pub.filter(isWd), weH = pub.filter(h => !isWd(h));
  const bridges = C.bridgeDays(days, Y);
  const freeLW = C.freeLongWeekends(days, Y);
  const pl = planner(lang, cc, [key(cc, r.code)], key(cc, r.code));
  const res = pl.plan.result, N = cfg.plannerDefaultLeave;
  const top = bridges.slice().sort((a, b) => (b.best.len / b.best.cost - a.best.len / a.best.cost) || (b.best.len - a.best.len))[0];
  const p = regionUrl(cc, r, lang);
  const crumbs = [{ name: X.home, href: homeUrl(lang) }, { name: X.countryCrumb, href: countryUrl(cc, lang) }, { name: r.name[lang], self: p }];
  const list = arr => arr.map(h => `${h.name[lang]} (${C.weekday(h.date, lang)} ${C.fmtDate(h.date, lang, cc)})`).join(', ');
  const faq = [X.faqCount(r, pub.length, wk, weH, list)];
  if (top) faq.push(X.faqBest(r, top.holidays.map(d => rd.holidays.find(h => h.date === d && h.on).name[lang]).join(lang === 'fr' ? ' et ' : ' e '), top,
    top.best.leave.map(d => C.fmtDate(d, lang, cc, false, true)).join(', '), fromTo(top.best.from, top.best.to, lang, cc)));
  faq.push(X.faqMost(r, N, res));
  const xmasEve = rd.holidays.find(h => h.id === 'xmaseve' && h.date.startsWith(String(Y)));
  if (xmasEve) faq.push(X.faqXmas(C.weekday(xmasEve.date, lang)));
  faq.push(X.faqWhat);
  const main = `
    ${pl.html}
    ${adSlot('region-top')}
    <section class="section"><div class="wrap">
      <h2>${esc(X.bestH(r))}</h2>
      <p>${X.bestP}</p>
      ${bridgeList(bridges, rd, lang, cc)}
    </div></section>
    ${freeLW.length ? `<section class="section"><div class="wrap">
      <h2>${X.freeH}</h2>
      <ul>${freeLW.map(w => `<li>${esc(C.fmtRange(w.from, w.to, lang, cc, true))}${lang === 'fr' ? ' : ' : ': '}${w.len} ${X.days}</li>`).join('')}</ul>
    </div></section>` : ''}
    <section class="section"><div class="wrap">
      <h2>${esc(X.holH(r))}</h2>
      ${holidayTable(rd, lang, cc)}
    </div></section>
    ${adSlot('region-mid')}
    ${ctaBlock(lang, cc, r.name[lang], true)}
    <section class="section"><div class="wrap"><h2>${X.faqH}</h2>${faqBlock(faq)}</div></section>
    <section class="section section--links"><div class="wrap"><h2>${X.othersH}</h2>${regionLinks(cc, lang, r.code)}</div></section>`;
  write(p, page({
    lang, cc, title: X.regionTitle(r), desc: X.regionDesc(r, N, res.total), path: p, alt, h1: X.regionH1(r),
    crumbs: crumbs.slice(0, 2).concat([{ name: r.name[lang] }]),
    body: { lede: X.regionLede(r, wk.length, pub.length, N, res.total), main },
    jsonld: [breadcrumbLd(crumbs), faqLd(faq), appLd(lang, X.appName(r), p)],
    data: pl.data
  }));
  return { r, total: res.total, wk: wk.length, pub: pub.length };
}

function countryPageRo(cc, lang, stats, alt) {
  const X = RO[lang], country = countries[cc];
  const p = countryUrl(cc, lang);
  const nat = country.holidays.filter(h => !h.regions && (h.type || 'public') === 'public');
  const natCountry = Object.assign({}, country, { holidays: nat });
  const off = [Y - 1, Y, Y + 1].reduce((a, y) => a.concat(C.holidaysFor(natCountry, null, y).map(h => h.date)), []);
  const bridges = C.bridgeDays(C.buildDays(Y, off), Y);
  const rdNat = { holidays: [Y - 1, Y, Y + 1].reduce((a, y) => a.concat(C.holidaysFor(natCountry, null, y)), []), school: [] };
  const pl = planner(lang, cc, country.regions.map(r => key(cc, r.code)), key(cc, cfg.defaultRegionByLang[lang]));
  const rows = stats.map(s => `<tr><td><a href="${regionUrl(cc, s.r, lang)}">${esc(s.r.name[lang])}</a></td><td>${s.pub}</td><td>${s.wk}</td><td>${s.total}</td></tr>`).join('');
  const m = stats.slice().sort((a, b) => b.wk - a.wk);
  const tops = m.filter(s => s.wk === m[0].wk).map(s => esc(s.r.name[lang]));
  const faq = [X.faqMostCanton(tops, m[0].wk, { name: esc(m[m.length - 1].r.name[lang]), wk: m[m.length - 1].wk })];
  const crumbs = [{ name: X.home, href: homeUrl(lang) }, { name: country.name[lang], self: p }];
  const main = `
    ${pl.html}
    ${adSlot('country-top')}
    <section class="section"><div class="wrap">
      <h2>${X.compareH}</h2>
      <div class="table-scroll"><table><thead><tr><th>${X.thCanton}</th><th>${X.thHol}</th><th>${X.thWk}</th><th>${X.thOff(cfg.plannerDefaultLeave)}</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div></section>
    <section class="section"><div class="wrap">
      <h2>${X.natH}</h2><p>${X.natP}</p>
      ${bridgeList(bridges, rdNat, lang, cc)}
    </div></section>
    ${ctaBlock(lang, cc, null, true)}
    <section class="section"><div class="wrap"><h2>${X.faqH}</h2>${faqBlock(faq)}</div></section>
    <section class="section section--links"><div class="wrap"><h2>${X.allH}</h2>${regionLinks(cc, lang, null)}</div></section>`;
  write(p, page({ lang, cc, title: X.countryTitle, desc: X.countryDesc, path: p, alt, h1: X.countryH1, crumbs: [crumbs[0], { name: country.name[lang] }],
    body: { lede: X.countryLede(nat.length), main }, jsonld: [breadcrumbLd(crumbs), faqLd(faq), appLd(lang, X.plannerName, p)], data: pl.data }));
}

function homePageRo(lang, alt) {
  const X = RO[lang], cc = 'ch', p = homeUrl(lang);
  const pl = planner(lang, cc, countries[cc].regions.map(r => key(cc, r.code)), key(cc, cfg.defaultRegionByLang[lang]));
  const faq = [X.faqWhat, X.faqHow];
  const main = `
    ${pl.html}
    ${adSlot('home-top')}
    <section class="section"><div class="wrap"><h2>${esc(countries[cc].name[lang])}</h2>${regionLinks(cc, lang, null)}<p><a href="${countryUrl(cc, lang)}">${X.homeAll}</a></p></div></section>
    ${ctaBlock(lang, null, null, true)}
    <section class="section"><div class="wrap"><h2>${X.faqH}</h2>${faqBlock(faq)}</div></section>`;
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: url(p), inLanguage: lang };
  write(p, page({ lang, cc, title: X.homeTitle, desc: X.homeDesc, path: p, alt, h1: X.homeH1, body: { lede: X.homeLede, main }, jsonld: [site, faqLd(faq), appLd(lang, X.plannerName, p)], data: pl.data }));
}

function productPageRo(lang, alt) {
  const X = RO[lang], p = productUrl(lang);
  const buy = cfg.product.url ? `<a class="btn" href="${esc(cfg.product.url)}" rel="noopener">${X.buy}</a><p class="source">${lang === 'fr' ? 'Paiement sécurisé via Gumroad. TVA incluse.' : 'Pagamento sicuro tramite Gumroad. IVA inclusa.'}</p>` : `<button class="btn" type="button" disabled>${X.soon}</button>`;
  const main = `<div class="wrap product">
    <div class="prose"><p>${X.productIntro}</p><ul class="ticks">${X.productList.map(li => `<li>${esc(li)}</li>`).join('')}</ul>
      <figure class="preview"><img src="/assets/product/planner-${lang}.jpg" width="1286" height="910" loading="lazy" alt="${esc(X.productH1)}"></figure></div>
    <aside class="buybox"><p class="price">${esc(cfg.product.price[lang])}</p><p>${X.productNote}</p>${buy}</aside>
  </div>`;
  write(p, page({ lang, cc: 'ch', title: X.productTitle, desc: X.productDesc, path: p, alt, h1: X.productH1, body: { lede: '', main }, jsonld: [] }));
}

function legalPagesRo() {
  ['fr', 'it'].forEach(lang => {
    const X = RO[lang];
    const imp = legalUrl('imprint', lang), prv = legalUrl('privacy', lang);
    write(imp, page({ lang, cc: 'ch', title: `${X.imprintTitle} | ${cfg.siteName}`, desc: X.imprintTitle, path: imp, alt: [{ hreflang: 'de', href: '/impressum/' }, { hreflang: lang, href: imp }], h1: X.imprintTitle, body: { main: `<div class="wrap prose"><p>${X.imprintBody} <a href="/impressum/" lang="de">Impressum</a>.</p></div>` }, noindex: true }));
    if (prv !== imp) write(prv, page({ lang, cc: 'ch', title: `${X.privacyTitle} | ${cfg.siteName}`, desc: X.privacyTitle, path: prv, alt: [{ hreflang: 'de', href: '/datenschutz/' }, { hreflang: lang, href: prv }], h1: X.privacyTitle, body: { main: `<div class="wrap prose"><p>${X.privacyBody} <a href="/datenschutz/" lang="de">Datenschutzerklärung</a>.</p></div>` }, noindex: true }));
  });
}

// ---------- run ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
['core.js', 'strings.js', 'render.js'].forEach(f => fs.copyFileSync(path.join(ROOT, 'engine', f), path.join(DIST, 'assets', f)));
['style.css', 'app.js'].forEach(f => fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(DIST, 'assets', f)));
fs.mkdirSync(path.join(DIST, 'assets', 'product'), { recursive: true });
fs.readdirSync(path.join(ROOT, 'assets', 'product')).forEach(f => fs.copyFileSync(path.join(ROOT, 'assets', 'product', f), path.join(DIST, 'assets', 'product', f)));

const allStats = {};
LANGS.forEach(lang => {
  cfg.countries.filter(cc => langsOf(cc).includes(lang)).forEach(cc => {
    const stats = countries[cc].regions.map(r => regionPage(cc, r, lang));
    allStats[cc] = stats;
    countryPage(cc, lang, stats);
  });
  homePage(lang, allStats);
  productPage(lang);
});
legalPages();
legalPagesRo();

// favicon
fs.writeFileSync(path.join(DIST, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#16243a"/><rect x="6" y="6" width="5" height="5" rx="1.5" fill="#dde5f0"/><rect x="13.5" y="6" width="5" height="5" rx="1.5" fill="#ffb81c"/><rect x="21" y="6" width="5" height="5" rx="1.5" fill="#dde5f0"/><rect x="6" y="13.5" width="5" height="5" rx="1.5" fill="#2852a3"/><rect x="13.5" y="13.5" width="5" height="5" rx="1.5" fill="#ffb81c"/><rect x="21" y="13.5" width="5" height="5" rx="1.5" fill="#ffb81c"/><rect x="6" y="21" width="5" height="5" rx="1.5" fill="#dde5f0"/><rect x="13.5" y="21" width="5" height="5" rx="1.5" fill="#dde5f0"/><rect x="21" y="21" width="5" height="5" rx="1.5" fill="#dde5f0"/></svg>`);

// sitemap
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.map(s => `  <url><loc>${url(s.loc)}</loc><lastmod>${today}</lastmod>${s.alt.map(a => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${url(a.href)}"/>`).join('')}</url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${url('/sitemap.xml')}\n`);
// llms.txt — plain index for AI search engines
fs.writeFileSync(path.join(DIST, 'llms.txt'), `# ${cfg.siteName}\n\n> Public holidays, bridge days (Brückentage / Fenstertage) and school holidays ${Y} for every state and canton in ${cfg.countries.map(cc => countries[cc].name.en).join(', ')}, with a free planner that spreads days of leave for the most time off. School holidays from official sources (BMBWF, KMK); holidays computed from statutory rules.\n\n## Deutsch\n${llms.filter(l => l.lang === 'de').map(l => `- [${l.title}](${url(l.href)}): ${l.desc}`).join('\n')}\n\n## English\n${llms.filter(l => l.lang === 'en').map(l => `- [${l.title}](${url(l.href)}): ${l.desc}`).join('\n')}\n\n## Français (Suisse)\n${llms.filter(l => l.lang === 'fr').map(l => `- [${l.title}](${url(l.href)}): ${l.desc}`).join('\n')}\n\n## Italiano (Svizzera)\n${llms.filter(l => l.lang === 'it').map(l => `- [${l.title}](${url(l.href)}): ${l.desc}`).join('\n')}\n`);
if (cfg.adsenseClient) fs.writeFileSync(path.join(DIST, 'ads.txt'), `google.com, ${cfg.adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
fs.writeFileSync(path.join(DIST, '404.html'), page({ lang: 'de', cc: null, title: `Seite nicht gefunden | ${cfg.siteName}`, desc: '', path: '/404.html', h1: 'Diese Seite gibt es nicht', body: { lede: `Zur <a href="/">Startseite</a> mit dem Urlaubsplaner. <span lang="en">Go to the <a href="/en/">English home page</a>.</span>`, main: '' }, noindex: true }));
fs.writeFileSync(path.join(DIST, '_headers'), `/assets/*\n  Cache-Control: public, max-age=86400\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log(`Built ${sitemap.length} indexable pages into dist/`);
