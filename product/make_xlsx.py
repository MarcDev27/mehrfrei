#!/usr/bin/env python3
"""Excel / Google Sheets leave planner (one workbook per language).
Run after `node product/export-data.js`. Output: product/out/excel/*.xlsx
"""
import datetime as dt, json, os
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L
from openpyxl.comments import Comment

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, 'data.json')))
Y = DATA['year']
OUT = os.path.join(HERE, 'out', 'excel')
FONT = 'Arial'

NAVY, COBALT, SUN, SUN_SOFT, WE, SCH, RED = '16243A', '2852A3', 'FFB81C', 'FFE9B0', 'E4EAF3', 'CFE8DA', 'F4C7C3'
fill = lambda c: PatternFill('solid', start_color=c, end_color=c)
thin = Side(style='thin', color='CBD5E3')
GRID = Border(left=thin, right=thin, top=thin, bottom=thin)
INPUT = fill('FFF4CC')

COUNTRY_FALLBACK = {'fr': {'at': 'Autriche', 'de': 'Allemagne'}, 'it': {'at': 'Austria', 'de': 'Germania'}}

TX = {
 'de': dict(file='Urlaubsplaner', sheets=('Start', 'Kalender', 'Team', 'Familie', 'Daten'), full='U', half='H',
   title=f'Urlaubsplaner {Y}', region='Bundesland / Kanton', entitlement='Urlaubsanspruch (Tage)', carry='Resturlaub aus dem Vorjahr',
   taken='Genommen (laut Kalender)', left='Noch übrig', how='So funktioniert es',
   steps=['1. Oben dein Bundesland bzw. deinen Kanton wählen. Feiertage und Schulferien färben sich in allen Blättern automatisch ein.',
          '2. Im Blatt „Kalender“ in die schmale Spalte neben dem Datum U (ganzer Urlaubstag) oder H (halber Tag) eintragen.',
          '3. Wochenenden und Feiertage werden nicht als Urlaub gezählt, auch wenn dort etwas steht.',
          '4. „Team“: bis zu 20 Personen; die Zeile „Abwesend“ wird rot, wenn mehr Leute frei haben als erlaubt.',
          '5. „Familie“: Urlaub beider Elternteile eintragen; rot markiert sind Schulferientage ohne Betreuung.',
          'Gelbe Felder sind Eingabefelder. Tipps für die besten Brückentage: mehrfrei.net'],
   legend='Legende', lgHol='Feiertag', lgWe='Wochenende', lgSch='Schulferien', lgLeave='Urlaub (U / H)',
   person='Name', ent='Anspruch', tk='Genommen', rest='Rest', absent='Abwesend', maxAbs='Max. gleichzeitig abwesend',
   example='Anna (Beispiel – überschreiben)', p1='Elternteil 1', p2='Elternteil 2', school='Schulferien', open='Ohne Betreuung',
   openCount='Schulferientage ohne Betreuung', noSchool='Für Schweizer Kantone sind keine Schulferien hinterlegt (oft von Gemeinden festgelegt).',
   hdrData=('Schlüssel', 'Region', 'Datum', 'Feiertag'), hdrSchool=('Region', 'Von', 'Bis', 'Ferien'), hdrReg=('Code', 'Bundesland / Kanton'),
   source='Quellen: gesetzliche Feiertagsregeln; Schulferien BMBWF (AT) und KMK (DE). Angaben ohne Gewähr. Stand: November 2026.'),
 'en': dict(file='Leave-planner', sheets=('Start', 'Calendar', 'Team', 'Family', 'Data'), full='L', half='H',
   title=f'Leave planner {Y}', region='State / canton', entitlement='Leave allowance (days)', carry='Carried over from last year',
   taken='Taken (from calendar)', left='Left', how='How it works',
   steps=['1. Pick your state or canton above. Public and school holidays are coloured in on every sheet automatically.',
          '2. On “Calendar”, type L (full day of leave) or H (half day) in the narrow column next to the date.',
          '3. Weekends and public holidays never count as leave, even if something is typed there.',
          '4. “Team”: up to 20 people; the “Absent” row turns red when more people are off than allowed.',
          '5. “Family”: enter both parents’ leave; school-holiday days with nobody at home turn red.',
          'Yellow cells are for your input. Best bridge days: mehrfrei.net'],
   legend='Legend', lgHol='Public holiday', lgWe='Weekend', lgSch='School holidays', lgLeave='Leave (L / H)',
   person='Name', ent='Allowance', tk='Taken', rest='Left', absent='Absent', maxAbs='Max. absent at once',
   example='Anna (example – overwrite)', p1='Parent 1', p2='Parent 2', school='School holidays', open='No cover',
   openCount='School-holiday days without cover', noSchool='No school holidays are stored for Swiss cantons (often set by municipalities).',
   hdrData=('Key', 'Region', 'Date', 'Holiday'), hdrSchool=('Region', 'From', 'To', 'Holidays'), hdrReg=('Code', 'State / canton'),
   source='Sources: statutory holiday rules; school holidays from BMBWF (AT) and KMK (DE). No guarantee. As of November 2026.'),
 'fr': dict(file='Planificateur-conges', sheets=('Accueil', 'Calendrier', 'Equipe', 'Famille', 'Donnees'), full='C', half='D',
   title=f'Planificateur de congés {Y}', region='Canton / région', entitlement='Droit aux vacances (jours)', carry='Solde de l’année précédente',
   taken='Pris (selon le calendrier)', left='Restant', how='Mode d’emploi',
   steps=['1. Choisissez votre canton ci-dessus. Les jours fériés sont colorés automatiquement dans toutes les feuilles.',
          '2. Dans « Calendrier », tapez C (jour de congé) ou D (demi-journée) dans la colonne étroite à côté de la date.',
          '3. Les week-ends et jours fériés ne sont jamais comptés comme vacances.',
          '4. « Equipe » : jusqu’à 20 personnes ; la ligne « Absents » devient rouge si trop de personnes sont absentes.',
          '5. « Famille » : saisissez les vacances des deux parents ; les jours de vacances scolaires sans garde sont en rouge.',
          'Les cellules jaunes sont à remplir. Les meilleurs ponts : mehrfrei.net/fr/'],
   legend='Légende', lgHol='Jour férié', lgWe='Week-end', lgSch='Vacances scolaires', lgLeave='Congé (C / D)',
   person='Nom', ent='Droit', tk='Pris', rest='Restant', absent='Absents', maxAbs='Absents simultanés max.',
   example='Anna (exemple – à remplacer)', p1='Parent 1', p2='Parent 2', school='Vacances scolaires', open='Sans garde',
   openCount='Jours de vacances scolaires sans garde', noSchool='Aucune vacance scolaire n’est enregistrée pour les cantons suisses (souvent fixées par les communes).',
   hdrData=('Clé', 'Région', 'Date', 'Jour férié'), hdrSchool=('Région', 'Du', 'Au', 'Vacances'), hdrReg=('Code', 'Canton / région'),
   source='Sources : règles légales des jours fériés ; OFJ et SECO pour la Suisse. Sans garantie. État : novembre 2026.'),
 'it': dict(file='Pianificatore-ferie', sheets=('Inizio', 'Calendario', 'Team', 'Famiglia', 'Dati'), full='F', half='M',
   title=f'Pianificatore ferie {Y}', region='Cantone / regione', entitlement='Giorni di ferie spettanti', carry='Residuo dell’anno precedente',
   taken='Presi (dal calendario)', left='Residui', how='Come funziona',
   steps=['1. Scegli il tuo cantone qui sopra. I giorni festivi si colorano automaticamente in tutti i fogli.',
          '2. In «Calendario» scrivi F (giorno di ferie) o M (mezza giornata) nella colonna stretta accanto alla data.',
          '3. Fine settimana e festivi non vengono mai contati come ferie.',
          '4. «Team»: fino a 20 persone; la riga «Assenti» diventa rossa se troppe persone sono assenti insieme.',
          '5. «Famiglia»: inserisci le ferie dei due genitori; i giorni di vacanza scolastica senza nessuno a casa sono in rosso.',
          'Le celle gialle sono da compilare. I ponti migliori: mehrfrei.net/it/'],
   legend='Legenda', lgHol='Giorno festivo', lgWe='Fine settimana', lgSch='Vacanze scolastiche', lgLeave='Ferie (F / M)',
   person='Nome', ent='Spettanti', tk='Presi', rest='Residui', absent='Assenti', maxAbs='Max. assenti contemporaneamente',
   example='Anna (esempio – sovrascrivere)', p1='Genitore 1', p2='Genitore 2', school='Vacanze scolastiche', open='Senza custodia',
   openCount='Giorni di vacanza scolastica senza custodia', noSchool='Per i cantoni svizzeri non sono registrate vacanze scolastiche (spesso fissate dai comuni).',
   hdrData=('Chiave', 'Regione', 'Data', 'Festività'), hdrSchool=('Regione', 'Dal', 'Al', 'Vacanze'), hdrReg=('Codice', 'Cantone / regione'),
   source='Fonti: regole legali sui giorni festivi; UFG e SECO per la Svizzera. Senza garanzia. Stato: novembre 2026.'),
}
MONTHS = {
    'de': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'fr': ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    'it': ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
}
DEFAULT_REGION = {'de': 'at-W', 'en': 'at-W', 'fr': 'ch-GE', 'it': 'ch-TI'}

def serial(s):
    return (dt.date.fromisoformat(s) - dt.date(1899, 12, 30)).days

def name_in(obj, lang):
    return obj.get(lang) or obj.get('de') or obj.get('en')

def q(name):  # always quote sheet names in references
    return "'" + name + "'"

def style(ws, rng, **kw):
    for row in ws[rng]:
        for c in row:
            for k, v in kw.items():
                setattr(c, k, v)

def build(lang):
    t = TX[lang]
    S_START, S_CAL, S_TEAM, S_FAM, S_DATA = t['sheets']
    wb = Workbook()
    ws0 = wb.active; ws0.title = S_START
    cal, team, fam, data = (wb.create_sheet(n) for n in (S_CAL, S_TEAM, S_FAM, S_DATA))

    # ---------- data sheet ----------
    for col, h in zip('ABCD', t['hdrData']): data[f'{col}1'] = h
    for col, h in zip('FGHI', t['hdrSchool']): data[f'{col}1'] = h
    for col, h in zip('KL', t['hdrReg']): data[f'{col}1'] = h
    hr, sr, rr = 2, 2, 2
    default_name = None
    for country in DATA['countries']:
        cc = country['code']
        cname = country['name'].get(lang) or COUNTRY_FALLBACK.get(lang, {}).get(cc) or country['name']['en']
        for r in country['regions']:
            code = f'{cc}-{r["code"]}'.upper()
            disp = f'{cname} – {name_in(r["name"], lang)}'
            data[f'K{rr}'] = code; data[f'L{rr}'] = disp; rr += 1
            if f'{cc}-{r["code"]}' == DEFAULT_REGION[lang]: default_name = disp
            for h in r['holidays']:
                if not h['on']: continue
                data[f'A{hr}'] = f'{code}|{serial(h["date"])}'; data[f'B{hr}'] = code
                data[f'C{hr}'] = dt.date.fromisoformat(h['date']); data[f'C{hr}'].number_format = 'yyyy-mm-dd'
                data[f'D{hr}'] = name_in(h['name'], lang); hr += 1
            for p in r['school']:
                data[f'F{sr}'] = code
                data[f'G{sr}'] = dt.date.fromisoformat(p['from']); data[f'G{sr}'].number_format = 'yyyy-mm-dd'
                data[f'H{sr}'] = dt.date.fromisoformat(p['to']); data[f'H{sr}'].number_format = 'yyyy-mm-dd'
                data[f'I{sr}'] = DATA['kinds'][p['kind']].get(lang) or DATA['kinds'][p['kind']]['en']; sr += 1
    HN, SN, RN = hr - 1, sr - 1, rr - 1
    data[f'A{HN + 2}'] = t['source']
    style(data, f'A1:L1', font=Font(name=FONT, bold=True, color='FFFFFF'), fill=fill(NAVY))
    for col, w in zip('ABCDEFGHIJKL', (18, 8, 12, 34, 3, 8, 12, 12, 22, 3, 8, 44)): data.column_dimensions[col].width = w
    data.freeze_panes = 'A2'

    D = q(S_DATA)
    KEYS = f"{D}!$A$2:$A${HN}"; NAMES = f"{D}!$D$2:$D${HN}"
    SREG, SFROM, STO = f"{D}!$F$2:$F${max(SN, 2)}", f"{D}!$G$2:$G${max(SN, 2)}", f"{D}!$H$2:$H${max(SN, 2)}"
    SEL = f"{q(S_START)}!$C$5"

    # ---------- start sheet ----------
    ws0['B2'] = t['title']; ws0['B2'].font = Font(name=FONT, bold=True, size=18, color=NAVY)
    ws0['B4'] = t['region']; ws0['C4'] = default_name; ws0['C4'].fill = INPUT
    ws0['B5'] = 'Code'; ws0['C5'] = f'=INDEX({D}!$K$2:$K${RN},MATCH(C4,{D}!$L$2:$L${RN},0))'
    ws0['B5'].font = ws0['C5'].font = Font(name=FONT, size=8, color='8A97AB')
    ws0['B7'] = t['entitlement']; ws0['C7'] = 25; ws0['C7'].fill = INPUT
    ws0['C7'].comment = Comment({'de': 'Beispielwert – trage deinen Anspruch ein.', 'en': 'Example value – enter your allowance.', 'fr': 'Valeur d’exemple – saisissez votre droit.', 'it': 'Valore di esempio – inserisci i tuoi giorni.'}[lang], 'mehrfrei')
    ws0['B8'] = t['carry']; ws0['C8'] = 0; ws0['C8'].fill = INPUT
    ws0['B9'] = t['taken']
    ws0['B10'] = t['left']; ws0['C10'] = '=C7+C8-C9'
    for c in ('C7', 'C8', 'C9', 'C10'): ws0[c].number_format = '0.0'
    ws0['B10'].font = ws0['C10'].font = Font(name=FONT, bold=True, size=12)
    dv = DataValidation(type='list', formula1=f'={D}!$L$2:$L${RN}', allow_blank=False); ws0.add_data_validation(dv); dv.add('C4')
    ws0['B12'] = t['how']; ws0['B12'].font = Font(name=FONT, bold=True, size=12, color=NAVY)
    for i, s in enumerate(t['steps']): ws0[f'B{13 + i}'] = s
    lg = 14 + len(t['steps'])
    ws0[f'B{lg}'] = t['legend']; ws0[f'B{lg}'].font = Font(name=FONT, bold=True)
    for i, (txt, f, fc) in enumerate(((t['lgHol'], COBALT, 'FFFFFF'), (t['lgWe'], WE, NAVY), (t['lgSch'], SCH, NAVY), (t['lgLeave'], SUN, NAVY))):
        c = ws0[f'B{lg + 1 + i}']; c.value = txt; c.fill = fill(f); c.font = Font(name=FONT, color=fc)
    ws0.column_dimensions['A'].width = 3; ws0.column_dimensions['B'].width = 34; ws0.column_dimensions['C'].width = 46
    ws0.page_setup.fitToWidth = 1; ws0.page_setup.fitToHeight = 1; ws0.sheet_properties.pageSetUpPr.fitToPage = True
    for i in range(len(t['steps'])): ws0.merge_cells(f'B{13 + i}:G{13 + i}')
    for row in ws0.iter_rows():
        for c in row:
            if c.font.name != FONT: c.font = Font(name=FONT, bold=c.font.bold, size=c.font.size, color=c.font.color)

    # ---------- calendar ----------
    codes = f'"{t["full"]},{t["half"]}"'
    dv_cal = DataValidation(type='list', formula1=codes, allow_blank=True); cal.add_data_validation(dv_cal)
    cal['A1'] = t['title']; cal['A1'].font = Font(name=FONT, bold=True, size=14, color=NAVY)
    cal['G1'] = f'={q(S_START)}!$C$4'; cal['G1'].font = Font(name=FONT, size=11, color='4A5A72')
    taken_cells = []
    for m in range(1, 13):
        c0 = 1 + (m - 1) * 4
        cD, cE, cN, cS = (L(c0 + i) for i in range(4))
        cal[f'{cD}2'] = MONTHS[lang][m - 1]; cal.merge_cells(f'{cD}2:{cN}2')
        cal[f'{cD}2'].font = Font(name=FONT, bold=True, color='FFFFFF'); cal[f'{cD}2'].fill = fill(NAVY)
        ndays = (dt.date(Y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).day
        for day in range(1, ndays + 1):
            r = 2 + day
            cal[f'{cD}{r}'] = dt.date(Y, m, day); cal[f'{cD}{r}'].number_format = 'ddd d'
            cal[f'{cE}{r}'].fill = PatternFill(fill_type=None)
            cal[f'{cN}{r}'] = f'=IFERROR(INDEX({NAMES},MATCH({SEL}&"|"&({cD}{r}*1),{KEYS},0)),"")'
            cal[f'{cS}{r}'] = f'=IF(COUNTIFS({SREG},{SEL},{SFROM},"<="&({cD}{r}*1),{STO},">="&({cD}{r}*1))>0,1,"")'
            for col in (cD, cE, cN):
                cal[f'{col}{r}'].border = GRID; cal[f'{col}{r}'].font = Font(name=FONT, size=9)
            cal[f'{cE}{r}'].alignment = Alignment(horizontal='center'); cal[f'{cE}{r}'].font = Font(name=FONT, size=9, bold=True)
            cal[f'{cN}{r}'].font = Font(name=FONT, size=7)
            cal[f'{cS}{r}'].font = Font(name=FONT, size=6, color='FFFFFF')
        last = 2 + ndays
        dv_cal.add(f'{cE}3:{cE}{last}')
        rng = f'{cD}3:{cN}{last}'
        cal.conditional_formatting.add(rng, FormulaRule(formula=[f'OR(${cE}3="{t["full"]}",${cE}3="{t["half"]}")'], fill=fill(SUN), stopIfTrue=True))
        cal.conditional_formatting.add(rng, FormulaRule(formula=[f'${cN}3<>""'], fill=fill(COBALT), font=Font(color='FFFFFF', bold=True), stopIfTrue=True))
        cal.conditional_formatting.add(rng, FormulaRule(formula=[f'WEEKDAY(${cD}3,2)>5'], fill=fill(WE), stopIfTrue=True))
        cal.conditional_formatting.add(f'{cD}3:{cD}{last}', FormulaRule(formula=[f'${cS}3=1'], fill=fill(SCH)))
        rT = 35
        f_full = f'SUMPRODUCT(({cE}3:{cE}{last}="{t["full"]}")*(WEEKDAY({cD}3:{cD}{last},2)<6)*({cN}3:{cN}{last}=""))'
        f_half = f'SUMPRODUCT(({cE}3:{cE}{last}="{t["half"]}")*(WEEKDAY({cD}3:{cD}{last},2)<6)*({cN}3:{cN}{last}=""))'
        cal[f'{cD}{rT}'] = t['tk']; cal[f'{cE}{rT}'] = f'={f_full}+0.5*{f_half}'
        cal[f'{cE}{rT}'].number_format = '0.0'; cal[f'{cD}{rT}'].font = Font(name=FONT, size=8, color='4A5A72'); cal[f'{cE}{rT}'].font = Font(name=FONT, bold=True)
        taken_cells.append(f'{q(S_CAL)}!{cE}{rT}')
        cal.column_dimensions[cD].width = 7.5; cal.column_dimensions[cE].width = 3.6; cal.column_dimensions[cN].width = 13; cal.column_dimensions[cS].width = 1.2
    ws0['C9'] = '=' + '+'.join(taken_cells)
    cal.freeze_panes = 'A3'
    cal.page_setup.orientation = 'landscape'; cal.page_setup.fitToWidth = 1; cal.page_setup.fitToHeight = 1
    cal.sheet_properties.pageSetUpPr.fitToPage = True

    # ---------- shared day header for team & family ----------
    days = [dt.date(Y, 1, 1) + dt.timedelta(days=i) for i in range((dt.date(Y + 1, 1, 1) - dt.date(Y, 1, 1)).days)]
    FIRST = 6  # column F
    LASTC = L(FIRST + len(days) - 1)

    def day_header(ws):
        for i, x in enumerate(days):
            col = L(FIRST + i)
            if x.day == 1:
                ws[f'{col}2'] = MONTHS[lang][x.month - 1]; ws[f'{col}2'].font = Font(name=FONT, bold=True, color=NAVY)
            ws[f'{col}3'] = x; ws[f'{col}3'].number_format = 'd'
            ws[f'{col}4'] = f'={col}3'; ws[f'{col}4'].number_format = 'ddd'
            ws[f'{col}5'] = f'=IF(COUNTIF({KEYS},{SEL}&"|"&({col}$3*1))>0,1,"")'
            ws[f'{col}6'] = f'=IF(COUNTIFS({SREG},{SEL},{SFROM},"<="&({col}$3*1),{STO},">="&({col}$3*1))>0,1,"")'
            for r in (3, 4): ws[f'{col}{r}'].font = Font(name=FONT, size=8); ws[f'{col}{r}'].alignment = Alignment(horizontal='center')
            ws[f'{col}5'].font = ws[f'{col}6'].font = Font(name=FONT, size=6, color='FFFFFF')
            ws.column_dimensions[col].width = 3.2
        ws.row_dimensions[5].hidden = True; ws.row_dimensions[6].hidden = True
        ws.conditional_formatting.add(f'F3:{LASTC}4', FormulaRule(formula=['F$5=1'], fill=fill(COBALT), font=Font(color='FFFFFF'), stopIfTrue=True))
        ws.conditional_formatting.add(f'F3:{LASTC}4', FormulaRule(formula=['WEEKDAY(F$3,2)>5'], fill=fill(WE), stopIfTrue=True))
        ws.conditional_formatting.add(f'F3:{LASTC}4', FormulaRule(formula=['F$6=1'], fill=fill(SCH)))

    def entry_grid(ws, r1, r2):
        dvg = DataValidation(type='list', formula1=codes, allow_blank=True); ws.add_data_validation(dvg); dvg.add(f'F{r1}:{LASTC}{r2}')
        rng = f'F{r1}:{LASTC}{r2}'
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'OR(F{r1}="{t["full"]}",F{r1}="{t["half"]}")'], fill=fill(SUN), stopIfTrue=True))
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'F$5=1'], fill=fill('C9D6EE'), stopIfTrue=True))
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'WEEKDAY(F$3,2)>5'], fill=fill(WE), stopIfTrue=True))
        for r in range(r1, r2 + 1):
            for i in range(len(days)):
                c = ws.cell(row=r, column=FIRST + i); c.border = GRID; c.alignment = Alignment(horizontal='center'); c.font = Font(name=FONT, size=8, bold=True)

    def counted(r):  # leave on working days only (weekends and holidays never count)
        rowr, hdr, hol = f'F{r}:{LASTC}{r}', f'$F$3:${LASTC}$3', f'$F$5:${LASTC}$5'
        return (f'=SUMPRODUCT((({rowr}="{t["full"]}")+0.5*({rowr}="{t["half"]}"))*(WEEKDAY({hdr},2)<6)*({hol}<>1))')

    # ---------- team ----------
    team['A1'] = f'{t["title"]} – Team'; team['A1'].font = Font(name=FONT, bold=True, size=14, color=NAVY)
    team['F1'] = f'={q(S_START)}!$C$4'; team['F1'].font = Font(name=FONT, color='4A5A72')
    day_header(team)
    for col, h in zip('ABCD', (t['person'], t['ent'], t['tk'], t['rest'])):
        team[f'{col}7'] = h; team[f'{col}7'].font = Font(name=FONT, bold=True, color='FFFFFF'); team[f'{col}7'].fill = fill(NAVY)
    R1, R2 = 8, 27
    for r in range(R1, R2 + 1):
        team[f'A{r}'].fill = INPUT; team[f'B{r}'].fill = INPUT
        team[f'C{r}'] = counted(r); team[f'C{r}'].number_format = '0.0'
        team[f'D{r}'] = f'=IF(B{r}="","",B{r}-C{r})'; team[f'D{r}'].number_format = '0.0'
        for col in 'ABCD': team[f'{col}{r}'].font = Font(name=FONT, size=10); team[f'{col}{r}'].border = GRID
    team[f'A{R1}'] = t['example']; team[f'B{R1}'] = 25
    for iso in ('2027-05-07', '2027-05-28', '2027-10-25'):
        idx = (dt.date.fromisoformat(iso.replace('2027', str(Y))) - days[0]).days
        team.cell(row=R1, column=FIRST + idx, value=t['full'])
    entry_grid(team, R1, R2)
    RA = R2 + 1
    team[f'A{RA}'] = t['absent']; team[f'A{RA}'].font = Font(name=FONT, bold=True)
    team[f'A{RA + 2}'] = t['maxAbs']; team[f'B{RA + 2}'] = 3; team[f'B{RA + 2}'].fill = INPUT
    for i in range(len(days)):
        col = L(FIRST + i)
        team[f'{col}{RA}'] = f'=IF(COUNTIF({col}{R1}:{col}{R2},"{t["full"]}")+0.5*COUNTIF({col}{R1}:{col}{R2},"{t["half"]}")=0,"",COUNTIF({col}{R1}:{col}{R2},"{t["full"]}")+0.5*COUNTIF({col}{R1}:{col}{R2},"{t["half"]}"))'
        team[f'{col}{RA}'].font = Font(name=FONT, size=8, bold=True); team[f'{col}{RA}'].alignment = Alignment(horizontal='center')
    team.conditional_formatting.add(f'F{RA}:{LASTC}{RA}', FormulaRule(formula=[f'AND(F{RA}<>"",F{RA}>$B${RA + 2})'], fill=fill(RED)))
    team.column_dimensions['A'].width = 26
    for col in 'BCD': team.column_dimensions[col].width = 9
    team.column_dimensions['E'].width = 1.5
    team.freeze_panes = 'F8'

    # ---------- family ----------
    fam['A1'] = f'{t["title"]} – {S_FAM}'; fam['A1'].font = Font(name=FONT, bold=True, size=14, color=NAVY)
    fam['F1'] = f'={q(S_START)}!$C$4'; fam['F1'].font = Font(name=FONT, color='4A5A72')
    day_header(fam)
    for col, h in zip('ABC', (t['person'], t['ent'], t['tk'])):
        fam[f'{col}7'] = h; fam[f'{col}7'].font = Font(name=FONT, bold=True, color='FFFFFF'); fam[f'{col}7'].fill = fill(NAVY)
    for r, who in ((8, t['p1']), (9, t['p2'])):
        fam[f'A{r}'] = who; fam[f'A{r}'].fill = INPUT; fam[f'B{r}'].fill = INPUT
        fam[f'C{r}'] = counted(r); fam[f'C{r}'].number_format = '0.0'
        for col in 'ABC': fam[f'{col}{r}'].font = Font(name=FONT); fam[f'{col}{r}'].border = GRID
    entry_grid(fam, 8, 9)
    fam['A10'] = t['school']; fam['A11'] = t['open']
    for i in range(len(days)):
        col = L(FIRST + i)
        fam[f'{col}10'] = f'=IF({col}$6=1,"•","")'
        fam[f'{col}11'] = (f'=IF(AND({col}$6=1,WEEKDAY({col}$3,2)<6,{col}$5<>1,{col}8<>"{t["full"]}",{col}9<>"{t["full"]}"),"!","")')
        for r in (10, 11): fam[f'{col}{r}'].alignment = Alignment(horizontal='center'); fam[f'{col}{r}'].font = Font(name=FONT, size=8, bold=True)
    fam.conditional_formatting.add(f'F10:{LASTC}10', FormulaRule(formula=['F10<>""'], fill=fill(SCH)))
    fam.conditional_formatting.add(f'F11:{LASTC}11', FormulaRule(formula=['F11="!"'], fill=fill(RED)))
    fam['A13'] = t['openCount']; fam['C13'] = f'=COUNTIF(F11:{LASTC}11,"!")'; fam['C13'].font = Font(name=FONT, bold=True)
    fam['A14'] = t['noSchool']; fam['A14'].font = Font(name=FONT, size=8, italic=True, color='4A5A72')
    for c in ('A10', 'A11', 'A13'): fam[c].font = Font(name=FONT, bold=True)
    fam.column_dimensions['A'].width = 34
    for col in 'BC': fam.column_dimensions[col].width = 9
    fam.column_dimensions['D'].width = 1.5; fam.column_dimensions['E'].width = 1.5
    fam.freeze_panes = 'F8'

    for ws in (ws0, cal, team, fam, data):
        ws.sheet_view.showGridLines = ws is data
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{t["file"]}-{Y}.xlsx')
    wb.save(path)
    return path

if __name__ == '__main__':
    for lang in ('de', 'en', 'fr', 'it'):
        print(build(lang))
