#!/usr/bin/env node
// Exports everything the paid product needs (holidays, school holidays, bridge tips) for every region and language.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'engine/core.js'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const Y = cfg.year;
const school = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `school-${Y}.json`), 'utf8'));
const out = { year: Y, kinds: school.kinds, countries: [] };
cfg.countries.forEach(cc => {
  const country = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${cc}.json`), 'utf8'));
  const langs = (cfg.languages && cfg.languages[cc]) || ['de', 'en'];
  const regions = country.regions.map(r => {
    let hol = [];
    [Y - 1, Y, Y + 1].forEach(y => { hol = hol.concat(C.holidaysFor(country, r.code, y)); });
    const days = C.buildDays(Y, hol.filter(h => h.on).map(h => h.date));
    const sch = (school[cc] || []).filter(p => !p.regions || p.regions.includes(r.code)).map(p => ({ kind: p.kind, from: p.from, to: p.to }));
    return {
      code: r.code, name: r.name, slug: r.slug,
      holidays: hol.filter(h => h.date.startsWith(String(Y))),
      allHolidays: hol,
      school: sch,
      bridges: C.bridgeDays(days, Y),
      free: C.freeLongWeekends(days, Y)
    };
  });
  out.countries.push({ code: cc, name: country.name, term: country.term, termSingular: country.termSingular, regionWord: country.regionWord, langs, regions });
});
fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(out));
console.log('exported', out.countries.map(c => `${c.code}:${c.regions.length}`).join(' '));
