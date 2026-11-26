(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeaveStrings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var S = {
    de: {
      leaveDays: 'Urlaubstage',
      leaveDay1: 'Urlaubstag',
      daysOff: 'Tage frei',
      dayOff1: 'Tag frei',
      region: 'Bundesland',
      fewer: 'Einen Urlaubstag weniger',
      more: 'Einen Urlaubstag mehr',
      style: 'Wie willst du frei haben?',
      modes: {
        smart: 'Fenster­tage und echte Urlaube',
        weekends: 'Möglichst viele lange Wochenenden',
        long: 'Nur Urlaube ab 9 Tagen'
      },
      modesDE: { smart: 'Brücken­tage und echte Urlaube' },
      options: 'Weitere Einstellungen',
      family: 'Urlaub nur in den Schulferien nehmen',
      familyHint: 'Für Eltern: Urlaubstage landen nur in Ferienwochen deines Bundeslands.',
      optionalHead: 'Diese Tage habe ich auch frei',
      equals: 'ergeben',
      planTitle: 'Dein Plan für {year}',
      unused: '{n} Urlaubstage bleiben übrig, weil kein weiterer Zeitraum nach deinen Einstellungen passt.',
      noPlan: 'Mit diesen Einstellungen passt kein Zeitraum. Lockere den Stil oder schalte die Schulferien-Option aus.',
      takeOff: 'Urlaub',
      off: 'frei',
      saveIcs: 'Im Kalender speichern',
      copyLink: 'Link kopieren',
      copied: 'Link kopiert',
      icsTitle: 'Frei',
      legend: { hol: 'Feiertag', leave: 'Urlaubstag', brk: 'Frei am Stück', school: 'Schulferien', we: 'Wochenende' },
      weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      calendarLabel: 'Jahreskalender {year} mit deinem Plan'
    },
    en: {
      leaveDays: 'days of leave',
      leaveDay1: 'day of leave',
      daysOff: 'days off',
      dayOff1: 'day off',
      region: 'State',
      fewer: 'One day of leave fewer',
      more: 'One more day of leave',
      style: 'How do you want your time off?',
      modes: {
        smart: 'Bridge days and proper holidays',
        weekends: 'As many long weekends as possible',
        long: 'Only breaks of 9 days or more'
      },
      modesDE: {},
      options: 'More settings',
      family: 'Only take leave during school holidays',
      familyHint: 'For parents: leave days only land in your state’s school holiday weeks.',
      optionalHead: 'I also get these days off',
      equals: 'give you',
      planTitle: 'Your plan for {year}',
      unused: '{n} days of leave are left over because no other break fits your settings.',
      noPlan: 'No break fits these settings. Pick a looser style or switch off the school holiday option.',
      takeOff: 'Leave',
      off: 'off',
      saveIcs: 'Save to calendar',
      copyLink: 'Copy link',
      copied: 'Link copied',
      icsTitle: 'Time off',
      legend: { hol: 'Public holiday', leave: 'Day of leave', brk: 'Break', school: 'School holidays', we: 'Weekend' },
      weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      calendarLabel: 'Calendar {year} with your plan'
    }
  };
  S.fr = {
    leaveDays: 'jours de vacances', leaveDay1: 'jour de vacances', daysOff: 'jours libres', dayOff1: 'jour libre',
    region: 'Canton', fewer: 'Un jour de vacances de moins', more: 'Un jour de vacances de plus',
    style: 'Comment voulez-vous vos congés ?',
    modes: { smart: 'Ponts et vraies vacances', weekends: 'Le plus de longs week-ends possible', long: 'Seulement des pauses de 9 jours ou plus' },
    modesDE: {}, options: 'Plus de réglages',
    family: 'Prendre des vacances uniquement pendant les vacances scolaires', familyHint: '',
    optionalHead: 'Ces jours-là, je suis aussi en congé', equals: 'donnent', planTitle: 'Votre plan pour {year}',
    unused: '{n} jours de vacances restent inutilisés, car aucune autre période ne correspond à vos réglages.',
    noPlan: 'Aucune période ne correspond à ces réglages. Choisissez un autre style.',
    takeOff: 'Vacances', off: 'libre', saveIcs: 'Enregistrer dans le calendrier', copyLink: 'Copier le lien', copied: 'Lien copié', icsTitle: 'Congé',
    legend: { hol: 'Jour férié', leave: 'Jour de vacances', brk: 'Congé d’affilée', school: 'Vacances scolaires', we: 'Week-end' },
    weekdaysShort: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'], calendarLabel: 'Calendrier {year} avec votre plan'
  };
  S.it = {
    leaveDays: 'giorni di ferie', leaveDay1: 'giorno di ferie', daysOff: 'giorni liberi', dayOff1: 'giorno libero',
    region: 'Cantone', fewer: 'Un giorno di ferie in meno', more: 'Un giorno di ferie in più',
    style: 'Come vuoi i tuoi giorni liberi?',
    modes: { smart: 'Ponti e vere vacanze', weekends: 'Più weekend lunghi possibile', long: 'Solo pause di almeno 9 giorni' },
    modesDE: {}, options: 'Altre impostazioni',
    family: 'Prendere ferie solo durante le vacanze scolastiche', familyHint: '',
    optionalHead: 'Ho libero anche in questi giorni', equals: 'danno', planTitle: 'Il tuo piano per il {year}',
    unused: '{n} giorni di ferie restano inutilizzati perché nessun altro periodo corrisponde alle tue impostazioni.',
    noPlan: 'Nessun periodo corrisponde a queste impostazioni. Scegli un altro stile.',
    takeOff: 'Ferie', off: 'libero', saveIcs: 'Salva nel calendario', copyLink: 'Copia link', copied: 'Link copiato', icsTitle: 'Libero',
    legend: { hol: 'Giorno festivo', leave: 'Giorno di ferie', brk: 'Libero di fila', school: 'Vacanze scolastiche', we: 'Fine settimana' },
    weekdaysShort: ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do'], calendarLabel: 'Calendario {year} con il tuo piano'
  };
  // Swiss German: "Ferien" instead of "Urlaub", "Kanton" instead of "Bundesland"
  var OVERRIDES = {
    'de-ch': {
      leaveDays: 'Ferientage', leaveDay1: 'Ferientag', region: 'Kanton',
      fewer: 'Einen Ferientag weniger', more: 'Einen Ferientag mehr',
      family: 'Ferien nur in den Schulferien nehmen',
      familyHint: 'Für Eltern: Ferientage landen nur in Schulferienwochen deines Kantons.',
      unused: '{n} Ferientage bleiben übrig, weil kein weiterer Zeitraum nach deinen Einstellungen passt.',
      noPlan: 'Mit diesen Einstellungen passt kein Zeitraum. Wähle einen anderen Stil.',
      takeOff: 'Ferien',
      legend: { hol: 'Feiertag', leave: 'Ferientag', brk: 'Frei am Stück', school: 'Schulferien', we: 'Wochenende' }
    },
    'en-ch': { region: 'Canton' }
  };
  S.get = function (lang, cc) {
    var o = OVERRIDES[lang + '-' + cc];
    if (!o) return S[lang];
    var out = {}, k;
    for (k in S[lang]) out[k] = S[lang][k];
    for (k in o) out[k] = o[k];
    return out;
  };
  return S;
});
