#!/usr/bin/env python3
"""Printable A4 year planners (PDF) for every region and language.
Run after `node product/export-data.js`. Output: product/out/pdf/<country>/<lang>/*.pdf
"""
import asyncio, datetime as dt, html, json, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, 'data.json')))
Y = DATA['year']
OUT = os.path.join(HERE, 'out', 'pdf')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

MONTHS = {
    'de-AT': ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'de': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    'it': ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
}
WD = {  # Monday first
    'de': ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], 'en': ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    'fr': ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'], 'it': ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do'],
}
WD_LONG = {
    'de': ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    'en': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    'fr': ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    'it': ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
}

def T(lang, cc):
    de_leave = 'Ferientag' if cc == 'ch' else 'Urlaubstag'
    term_de = {'at': 'Fenstertag', 'de': 'Brückentag', 'ch': 'Brückentag'}[cc]
    return {
        'de': dict(title=('Ferienplaner' if cc == 'ch' else 'Urlaubsplaner'), hol='Feiertag', we='Wochenende', sch='Schulferien',
                   tip=f'{term_de}-Tipp', holH='Feiertage', bridgeH=f'Die besten {term_de}e', schoolH='Schulferien',
                   notesH='Meine Planung', leaveLine='Anspruch: ____   Genommen: ____   Rest: ____',
                   optional='kein gesetzl. Feiertag', local='regional',
                   take=lambda n, m: f'{n} {de_leave}{"e" if n != 1 else ""} → {m} Tage frei',
                   alt=lambda n, m: f'oder {n} → {m} Tage', noSchool='Schulferien werden in der Schweiz oft von den Gemeinden festgelegt.',
                   foot='mehrfrei.net · Alle Angaben sorgfältig geprüft, aber ohne Gewähr.'),
        'en': dict(title='Leave planner', hol='Public holiday', we='Weekend', sch='School holidays', tip='Bridge-day tip',
                   holH='Public holidays', bridgeH='Best bridge days', schoolH='School holidays', notesH='My plan',
                   leaveLine='Allowance: ____   Taken: ____   Left: ____', optional='not statutory', local='local',
                   take=lambda n, m: f'{n} day{"s" if n != 1 else ""} of leave → {m} days off', alt=lambda n, m: f'or {n} → {m} days',
                   noSchool='In Switzerland, school holidays are often set by each municipality.',
                   foot='mehrfrei.net · Carefully checked, but without guarantee.'),
        'fr': dict(title='Planificateur de congés', hol='Jour férié', we='Week-end', sch='Vacances scolaires', tip='Pont conseillé',
                   holH='Jours fériés', bridgeH='Les meilleurs ponts', schoolH='Vacances scolaires', notesH='Mon planning',
                   leaveLine='Droit : ____   Pris : ____   Solde : ____', optional='pas férié selon la loi', local='local',
                   take=lambda n, m: f'{n} jour{"s" if n != 1 else ""} de vacances → {m} jours libres', alt=lambda n, m: f'ou {n} → {m} jours',
                   noSchool='En Suisse, les vacances scolaires sont souvent fixées par les communes.',
                   foot='mehrfrei.net · Vérifié avec soin, mais sans garantie.'),
        'it': dict(title='Pianificatore ferie', hol='Giorno festivo', we='Fine settimana', sch='Vacanze scolastiche', tip='Ponte consigliato',
                   holH='Giorni festivi', bridgeH='I ponti migliori', schoolH='Vacanze scolastiche', notesH='Il mio piano',
                   leaveLine='Spettanti: ____   Presi: ____   Residui: ____', optional='non festivo per legge', local='locale',
                   take=lambda n, m: f'{n} giorn{"i" if n != 1 else "o"} di ferie → {m} giorni liberi', alt=lambda n, m: f'oppure {n} → {m} giorni',
                   noSchool='In Svizzera le vacanze scolastiche sono spesso fissate dai comuni.',
                   foot='mehrfrei.net · Verificato con cura, ma senza garanzia.'),
    }[lang]

def months(lang, cc):
    return MONTHS['de-AT' if (lang == 'de' and cc == 'at') else lang]

def d(s):
    return dt.date.fromisoformat(s)

def fmt(s, lang, cc, weekday=False):
    x = d(s)
    m = months(lang, cc)[x.month - 1]
    day = '1er' if (lang == 'fr' and x.day == 1) else '1º' if (lang == 'it' and x.day == 1) else str(x.day)
    out = f'{x.day}. {m}' if lang == 'de' else f'{day} {m}'
    if weekday:
        out = f'{WD[lang][x.weekday()]}{"," if lang == "de" else ""} {out}'
    return out

def rng(a, b, lang, cc):
    if a == b: return fmt(a, lang, cc)
    if a[:4] != b[:4]:  # e.g. Christmas holidays: show both years
        return f'{fmt(a, lang, cc)} {a[:4]} – {fmt(b, lang, cc)} {b[:4]}'
    return f'{fmt(a, lang, cc)} – {fmt(b, lang, cc)}'

def swiss(s, cc, lang):
    return s.replace('ß', 'ss') if (cc == 'ch' and lang == 'de') else s

CSS = """
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #16243a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 297mm; height: 210mm; padding: 8mm 9mm 6mm; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3mm; }
h1 { font-size: 17pt; margin: 0; letter-spacing: -0.02em; font-weight: 800; }
h1 span { font-weight: 400; color: #4a5a72; }
.legend { display: flex; gap: 4mm; font-size: 7pt; color: #4a5a72; align-items: center; }
.sw { display: inline-block; width: 3.2mm; height: 3.2mm; border-radius: 0.6mm; vertical-align: -0.5mm; margin-right: 1mm; }
.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 0 1.2mm; }
.mh { font-size: 8pt; font-weight: 800; padding: 0 0 1mm 0.5mm; border-bottom: 0.4mm solid #16243a; margin-bottom: 0.4mm; }
.c { height: 5.6mm; border-bottom: 0.2mm solid #dbe3ee; display: flex; align-items: center; gap: 0.8mm; font-size: 6.2pt; padding: 0 0.7mm; position: relative; white-space: nowrap; overflow: hidden; }
.c .wd { width: 3.4mm; color: #4a5a72; }
.c .dn { width: 3.4mm; font-weight: 700; text-align: right; }
.c .nm { font-size: 5.1pt; overflow: hidden; text-overflow: ellipsis; }
.we { background: #e4eaf3; }
.hol { background: #2852a3; color: #fff; }
.hol .wd { color: #dbe5ff; }
.tip { background: #ffe9a8; box-shadow: inset 0 0 0 0.35mm #e0a000; }
.sch::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 0.9mm; background: #3e8e6b; }
.opt .nm { font-style: italic; color: #4a5a72; }
.pad { background: repeating-linear-gradient(45deg, #fff, #fff 0.6mm, #eef2f7 0.6mm, #eef2f7 1.2mm); }
footer { position: absolute; left: 9mm; right: 9mm; bottom: 4mm; font-size: 6.5pt; color: #4a5a72; display: flex; justify-content: space-between; }
.cols { display: grid; grid-template-columns: 1.1fr 1.2fr 0.9fr; gap: 8mm; margin-top: 2mm; }
h2 { font-size: 10.5pt; margin: 0 0 2mm; padding-bottom: 1mm; border-bottom: 0.4mm solid #16243a; }
table { width: 100%; border-collapse: collapse; font-size: 7.4pt; }
td { padding: 0.9mm 1mm 0.9mm 0; border-bottom: 0.2mm solid #dbe3ee; vertical-align: top; }
td.dt { white-space: nowrap; width: 24mm; }
.muted { color: #4a5a72; font-size: 6.5pt; }
.b { font-weight: 700; }
.mark { background: #ffb81c; padding: 0 1mm; border-radius: 0.6mm; font-weight: 700; }
.lines div { border-bottom: 0.2mm solid #cbd5e3; height: 6.4mm; }
.note { font-size: 7pt; color: #4a5a72; margin-top: 2mm; }
"""

def region_html(country, region, lang):
    cc = country['code']
    t = T(lang, cc)
    e = lambda s: html.escape(swiss(s, cc, lang))
    hol = {h['date']: h for h in region['holidays']}
    on = {k: h for k, h in hol.items() if h['on']}
    tips = set()
    for b in region['bridges']:
        tips.update(b['best']['leave'])
    sch = set()
    for p in region['school']:
        x = d(p['from'])
        while x <= d(p['to']):
            sch.add(x.isoformat()); x += dt.timedelta(days=1)
    rname = region['name'][lang]
    cname = country['name'][lang]

    # page 1: wall planner
    cols = []
    for m in range(1, 13):
        cells = [f'<div class="mh">{e(months(lang, cc)[m - 1])}</div>']
        for day in range(1, 32):
            try:
                x = dt.date(Y, m, day)
            except ValueError:
                cells.append('<div class="c pad"></div>'); continue
            s = x.isoformat(); cls = ['c']; name = ''
            if x.weekday() >= 5: cls.append('we')
            if s in on: cls.append('hol'); name = on[s]['name'][lang]
            elif s in hol: cls.append('opt'); name = hol[s]['name'][lang]
            if s in tips and s not in on: cls.append('tip')
            if s in sch: cls.append('sch')
            cells.append(f'<div class="{" ".join(cls)}"><span class="wd">{WD[lang][x.weekday()]}</span><span class="dn">{day}</span><span class="nm">{e(name)}</span></div>')
        cols.append(f'<div>{"".join(cells)}</div>')
    legend = (f'<span><i class="sw" style="background:#2852a3"></i>{e(t["hol"])}</span>'
              f'<span><i class="sw" style="background:#ffe9a8;box-shadow:inset 0 0 0 0.35mm #e0a000"></i>{e(t["tip"])}</span>'
              + (f'<span><i class="sw" style="background:#3e8e6b;width:1mm"></i>{e(t["sch"])}</span>' if region['school'] else '')
              + f'<span><i class="sw" style="background:#e4eaf3"></i>{e(t["we"])}</span>')
    p1 = f'''<section class="page"><header><h1>{e(t["title"])} {Y} <span>{e(rname)} · {e(cname)}</span></h1><div class="legend">{legend}</div></header>
      <div class="grid">{"".join(cols)}</div><footer><span>{e(t["foot"])}</span><span>{Y}</span></footer></section>'''

    # page 2: lists + notes
    hrows = []
    for h in region['holidays']:
        tag = ''
        if h['type'] == 'optional': tag = f' <span class="muted">({e(t["optional"])})</span>'
        elif h['type'] == 'partial': tag = f' <span class="muted">({e(t["local"])})</span>'
        hrows.append(f'<tr><td class="dt">{e(fmt(h["date"], lang, cc, True))}</td><td>{e(h["name"][lang])}{tag}</td></tr>')
    brows = []
    for b in region['bridges']:
        best = b['best']
        names = ', '.join(on[x]['name'][lang] for x in b['holidays'] if x in on)
        alt = f'<div class="muted">{e(t["alt"](b["long"]["cost"], b["long"]["len"]))} ({e(rng(b["long"]["from"], b["long"]["to"], lang, cc))})</div>' if b.get('long') else ''
        brows.append(f'<tr><td><div class="b">{e(names)}</div><span class="mark">{e(t["take"](best["cost"], best["len"]))}</span> '
                     f'{e(", ".join(fmt(x, lang, cc, True) for x in best["leave"]))}{alt}</td></tr>')
    srows = ''.join(f'<tr><td class="dt">{e(DATA["kinds"][p["kind"]][lang])}</td><td>{e(rng(p["from"], p["to"], lang, cc))}</td></tr>'
                    for p in region['school'] if p['to'] >= f'{Y}-01-01' and p['from'] <= f'{Y}-12-31')
    school_block = f'<table>{srows}</table>' if srows else f'<p class="note">{e(t["noSchool"])}</p>'
    p2 = f'''<section class="page"><header><h1>{e(t["title"])} {Y} <span>{e(rname)} · {e(cname)}</span></h1></header>
      <div class="cols">
        <div><h2>{e(t["holH"])} {Y}</h2><table>{"".join(hrows)}</table></div>
        <div><h2>{e(t["bridgeH"])} {Y}</h2><table>{"".join(brows)}</table></div>
        <div><h2>{e(t["schoolH"])} {Y}</h2>{school_block}
          <h2 style="margin-top:5mm">{e(t["notesH"])}</h2><p class="note">{e(t["leaveLine"])}</p>
          <div class="lines">{"<div></div>" * 12}</div></div>
      </div><footer><span>{e(t["foot"])}</span><span>{Y}</span></footer></section>'''
    return f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{p1}{p2}</body></html>'

def fname(country, region, lang):
    t = T(lang, country['code'])
    slug = region['slug'][lang]
    base = {'de': 'Urlaubsplaner' if country['code'] != 'ch' else 'Ferienplaner', 'en': 'Leave-planner', 'fr': 'Planificateur-conges', 'it': 'Pianificatore-ferie'}[lang]
    return f'{base}-{Y}-{slug}.pdf'

async def main(only=None):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page()
        n = 0
        for country in DATA['countries']:
            for lang in country['langs']:
                folder = os.path.join(OUT, country['name']['en'], LANG_DIR[lang])
                os.makedirs(folder, exist_ok=True)
                for region in country['regions']:
                    if only and region['code'] != only: continue
                    await pg.set_content(region_html(country, region, lang), wait_until='load')
                    await pg.pdf(path=os.path.join(folder, fname(country, region, lang)), format='A4', landscape=True, print_background=True)
                    n += 1
        await b.close()
        print('PDFs:', n)

LANG_DIR = {'de': 'Deutsch', 'en': 'English', 'fr': 'Francais', 'it': 'Italiano'}

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))
