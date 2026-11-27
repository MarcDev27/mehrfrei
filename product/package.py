#!/usr/bin/env python3
"""Builds the Gumroad bundle: product/out/Mehrfrei-Urlaubsplaner-<year>.zip (+ preview images for the website)."""
import asyncio, json, os, shutil, subprocess, zipfile
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
Y = json.load(open(os.path.join(HERE, 'data.json')))['year']
OUT = os.path.join(HERE, 'out')
NAME = f'Mehrfrei-Urlaubsplaner-{Y}'

GUIDE = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 16mm; }} body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #16243a; font-size: 9.5pt; line-height: 1.45; }}
h1 {{ font-size: 18pt; margin: 0 0 4mm; }} h2 {{ font-size: 11pt; margin: 6mm 0 1.5mm; border-bottom: 0.4mm solid #16243a; padding-bottom: 1mm; }}
p {{ margin: 0 0 1.5mm; }} .muted {{ color: #4a5a72; font-size: 8pt; }}
</style></head><body>
<h1>Mehrfrei · Urlaubsplaner {Y}</h1>
<h2>Deutsch</h2>
<p><b>PDF/</b>: Jahresplaner zum Ausdrucken (A4 quer, druckt auch auf A3) für jedes Bundesland in Österreich und Deutschland und jeden Schweizer Kanton. Seite 1: Jahreskalender mit Feiertagen, Schulferien und Brücken- bzw. Fenstertag-Tipps. Seite 2: alle Feiertage, die besten Brückentage und Platz für deine Planung.</p>
<p><b>Excel/</b>: Urlaubsplaner-{Y}.xlsx in Excel öffnen oder in Google Drive hochladen und mit Google Tabellen öffnen. Im Blatt „Start“ dein Bundesland bzw. deinen Kanton wählen, im „Kalender“ U (Urlaubstag) oder H (halber Tag) eintragen. „Team“ zeigt Überschneidungen, „Familie“ Schulferientage ohne Betreuung.</p>
<h2>English</h2>
<p><b>PDF/</b>: printable year planners (A4 landscape, also prints on A3) for every Austrian and German state and every Swiss canton, with public holidays, school holidays and bridge-day tips, plus a page listing the best bridge days.</p>
<p><b>Excel/</b>: open Leave-planner-{Y}.xlsx in Excel, or upload it to Google Drive and open it with Google Sheets. Pick your region on “Start”, then type L (leave) or H (half day) on “Calendar”. “Team” shows clashes, “Family” shows school-holiday days without cover.</p>
<h2>Français</h2>
<p><b>PDF/</b> : calendriers annuels à imprimer (A4 paysage, imprimables aussi en A3) pour chaque canton suisse, avec jours fériés et ponts conseillés. <b>Excel/</b> : ouvrez Planificateur-conges-{Y}.xlsx dans Excel ou Google Sheets, choisissez votre canton sur « Accueil », puis tapez C (congé) ou D (demi-journée) dans « Calendrier ».</p>
<h2>Italiano</h2>
<p><b>PDF/</b>: calendari annuali da stampare (A4 orizzontale, stampabili anche in A3) per ogni cantone svizzero, con giorni festivi e ponti consigliati. <b>Excel/</b>: apri Pianificatore-ferie-{Y}.xlsx in Excel o Google Sheets, scegli il tuo cantone in «Inizio» e scrivi F (ferie) o M (mezza giornata) in «Calendario».</p>
<h2>Lizenz · Licence</h2>
<p class="muted">Für den persönlichen Gebrauch und die Nutzung im eigenen Team oder Unternehmen. Weiterverkauf und Weitergabe der Dateien sind nicht erlaubt. · For personal use and use within your own team or company. Reselling or redistributing the files is not permitted.</p>
<p class="muted">Alle Termine sorgfältig mit amtlichen Quellen abgeglichen (gesetzliche Feiertagsregeln; Schulferien: BMBWF, KMK; Schweiz: BJ, SECO), aber ohne Gewähr. Updates und Planer online: mehrfrei.net</p>
</body></html>"""

async def guide_pdf(path):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        pg = await b.new_page(); await pg.set_content(GUIDE); await pg.pdf(path=path, format='A4', print_background=True); await b.close()

def main():
    stage = os.path.join(OUT, NAME)
    shutil.rmtree(stage, ignore_errors=True); os.makedirs(stage)
    shutil.copytree(os.path.join(OUT, 'pdf'), os.path.join(stage, 'PDF'))
    shutil.copytree(os.path.join(OUT, 'excel'), os.path.join(stage, 'Excel'))
    asyncio.run(guide_pdf(os.path.join(stage, 'START-HIER_START-HERE.pdf')))
    zpath = os.path.join(OUT, NAME + '.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(stage):
            for f in sorted(files):
                full = os.path.join(root, f); z.write(full, os.path.relpath(full, OUT))
    # preview images for the product pages (first page of one planner per language)
    prev = os.path.join(OUT, 'previews'); os.makedirs(prev, exist_ok=True)
    for lang, rel in {'de': 'Austria/Deutsch/Urlaubsplaner-{y}-wien.pdf', 'en': 'Germany/English/Leave-planner-{y}-bavaria.pdf',
                      'fr': 'Switzerland/Francais/Planificateur-conges-{y}-geneve.pdf', 'it': 'Switzerland/Italiano/Pianificatore-ferie-{y}-ticino.pdf'}.items():
        src = os.path.join(OUT, 'pdf', rel.format(y=Y))
        subprocess.run(['pdftoppm', '-r', '110', '-jpeg', '-jpegopt', 'quality=82', '-f', '1', '-l', '1', '-singlefile', src, os.path.join(prev, f'planner-{lang}')], check=True)
    print(zpath, round(os.path.getsize(zpath) / 1e6, 1), 'MB')

if __name__ == '__main__':
    main()
