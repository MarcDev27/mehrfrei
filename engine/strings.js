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
