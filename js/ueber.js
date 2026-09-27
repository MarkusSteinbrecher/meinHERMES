/* meinHERMES — Ansicht «Über». */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  function extern(url, text) {
    return h('a', { href: url, target: '_blank', rel: 'noopener' }, text + ' ↗');
  }

  /* --- Gespeicherte Daten: Export, Import, Löschen ------------------------- */

  var MAX_IMPORT = 5 * 1024 * 1024;       // mehr fasst localStorage ohnehin nicht

  function zweistellig(n) { return (n < 10 ? '0' : '') + n; }

  function exportieren() {
    var d = new Date();
    var name = 'meinHERMES-' + d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()) + '.json';
    var text = JSON.stringify(HT.store.exportieren(), null, 2);
    var url = global.URL.createObjectURL(new global.Blob([text], { type: 'application/json' }));
    var a = h('a', { href: url, download: name, hidden: true });
    document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
  }

  function knopf(text, klasse, aktion, aus) {
    return h('button', {
      type: 'button', class: 'btn btn--klein' + (klasse ? ' ' + klasse : ''), text: text, disabled: !!aus,
      on: { click: aktion }
    });
  }

  function datenBereich(importiert) {
    var aus = !HT.store.verfuegbar;
    var vorschau = h('div', { class: 'import', hidden: true, 'aria-live': 'polite' });
    var auswahl = h('input', { type: 'file', accept: '.json,application/json', hidden: true });

    function schliessen() {
      HT.ui.leeren(vorschau);
      vorschau.hidden = true;
    }

    function zeigen(kinder) {
      HT.ui.leeren(vorschau);
      kinder.forEach(function (k) { if (k) { vorschau.appendChild(k); } });
      vorschau.hidden = false;
    }

    function meldung(text, fehler) {
      zeigen([
        h('p', { class: 'import__meldung' + (fehler ? ' import__meldung--fehler' : ''), text: text }),
        h('div', { class: 'btn-reihe' }, [knopf('Schliessen', '', schliessen)])
      ]);
    }

    function vorschauZeigen(pruefung) {
      if (!pruefung.ok) { meldung(pruefung.fehler, true); return; }
      var n = pruefung.uebergangen;
      zeigen([
        h('p', { class: 'import__meldung' }, [
          h('b', { text: 'Exportiert' + (pruefung.exportiert
            ? ' am ' + pruefung.exportiert.toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })
            : '') }),
          ': ' + (pruefung.mengen.length ? pruefung.mengen.join(' · ') : 'nur Einstellungen') + '.'
        ]),
        n ? h('p', { class: 'trefferzahl', text: n === 1
          ? 'Einen Eintrag kennt diese Fassung der Seite nicht; er wird übergangen.'
          : n + ' Einträge kennt diese Fassung der Seite nicht; sie werden übergangen.' }) : null,
        h('p', { text: '«Ersetzen» überschreibt Lernstand, Markierungen und Einstellungen in diesem Browser mit dem Stand der Datei. '
          + 'Filter und offene Bereiche bleiben, wie sie sind.' }),
        h('div', { class: 'btn-reihe' }, [
          knopf('Ersetzen', 'btn--primaer', function () {
            if (!HT.store.importErsetzen(pruefung.daten)) {
              meldung('Der Import ist fehlgeschlagen, der bisherige Stand bleibt. Vermutlich ist der Speicher des Browsers voll.', true);
              return;
            }
            global.history.replaceState(null, '', global.location.hash.split('?')[0] + '?importiert=1');
            global.location.reload();
          }),
          knopf('Abbrechen', '', schliessen)
        ])
      ]);
    }

    auswahl.addEventListener('change', function () {
      var datei = auswahl.files && auswahl.files[0];
      auswahl.value = '';                   // dieselbe Datei nochmals wählbar
      if (!datei) { return; }
      if (datei.size > MAX_IMPORT) { meldung('Die Datei ist zu gross für einen Export von meinHERMES.', true); return; }
      var leser = new global.FileReader();
      leser.onload = function () { vorschauZeigen(HT.store.importPruefen(String(leser.result))); };
      leser.onerror = function () { meldung('Die Datei liess sich nicht lesen.', true); };
      leser.readAsText(datei);
    });

    if (importiert) { meldung('Import abgeschlossen: in diesem Browser gilt jetzt der Stand aus der Datei.'); }

    return h('div', { class: 'daten' }, [
      h('p', { text: DATEN_SATZ + ' «Exportieren» sichert sie als Datei, «Importieren» übernimmt die Datei in einem anderen Browser und ersetzt dort den bisherigen Stand.' }),
      h('p', {
        class: 'trefferzahl',
        text: HT.store.verfuegbar
          ? 'Status: lokale Speicherung ist in diesem Browser verfügbar.'
          : 'Status: dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für die laufende Sitzung.'
      }),
      h('div', { class: 'btn-reihe' }, [
        knopf('Exportieren', '', exportieren, aus),
        knopf('Importieren …', '', function () { auswahl.click(); }, aus),
        knopf('Alle lokal gespeicherten Daten löschen', '', function () {
          if (!global.confirm('Lernfortschritt, Markierungen, Filter und Quiz-Statistik wirklich löschen?')) { return; }
          HT.store.loescheAlle();
          global.location.reload();
        })
      ]),
      auswahl,
      vorschau
    ]);
  }

  /* --- Inhalt: Seite und Willkommenshinweis ------------------------------- */

  var ISSUES = 'https://github.com/MarkusSteinbrecher/meinHERMES/issues';
  var DATEN_SATZ = 'Lernstand, Markierungen und Einstellungen bleiben in diesem Browser: kein Konto, keine Übertragung an einen Server, kein Tracking.';

  function punkt(name, text) {
    return h('li', {}, [h('b', { text: name + ': ' }), text]);
  }

  /* Dieselben Abschnitte auf der Seite und im Hinweis für neue Besucher;
     `daten` ist der Abschnitt «Gespeicherte Daten» — auf der Seite mit
     Export und Import, im Hinweis nur ein Satz mit Verweis hierher. */
  function abschnitte(daten) {
    return [
      h('div', { class: 'hinweisbox' }, [
        h('h2', { text: 'Beta-Version' }),
        h('p', {}, [
          'meinHERMES ist noch in Entwicklung: Inhalte können Fehler enthalten, Funktionen sich ändern. ',
          h('b', { text: 'Die Benützung erfolgt auf eigene Gefahr.' }),
          ' Für Richtigkeit und Vollständigkeit wird keine Gewähr übernommen; massgebend für die Prüfung ist allein die offizielle HERMES-Dokumentation.'
        ]),
        h('p', {}, ['Fehler gefunden? ', extern(ISSUES, 'Auf GitHub melden')])
      ]),

      h('p', { text: 'meinHERMES ist eine private, inoffizielle Lernhilfe für die HERMES-2022-Prüfung, ohne Verbindung zur Bundesverwaltung oder zum HERMES-Fachausschuss. '
        + 'Jeder Eintrag, jede Lernkarte und jede Quizfrage verweist auf ihre Stelle im Referenzhandbuch und auf HERMES online.' }),

      h('h2', { text: 'Aufbau' }),
      h('ul', {}, [
        punkt('Überblick', 'das Gesamtbild der Methode wie Abbildung 1 — Phasen als Zeilen, Module als Spalten, darin Rollen, Aufgaben und Ergebnisse; rechts die Seiten aus dem Handbuch und ein Rundgang durch die Methode.'),
        punkt('Trainer', 'Zuordnen, Lernkarten und Quiz; der Fortschritt zeigt, was schon sitzt.'),
        punkt('Handbuch', 'das Referenzhandbuch als Text, mit Kapitelnummern, Seitenzahlen und Volltextsuche.'),
        punkt('Markieren', 'Text im Überblick und im Handbuch auswählen und gelb hervorheben.')
      ]),
      h('p', { text: 'Wie eine Seite funktioniert, erklärt das Info-Icon rechts in ihrer Leiste.' }),

      h('h2', { text: 'Quelle' }),
      h('p', {}, [
        'HERMES ist die Projektmanagementmethode der Schweizerischen Bundesverwaltung und ein offener Standard (eCH-0054). Das Handbuch gibt das ',
        extern('https://www.hermes.admin.ch/_Resources/Persistent/c/7/1/6/c7166cbb014fffc5a7ebb4697ba59ef63edb0de3/HERMES-Projektmanagement.pdf', 'Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage vom 9. März 2026 (PDF)'),
        ' wieder; die Abbildung und die Handbuchtexte im Überblick stammen von ',
        extern('https://www.hermes.admin.ch/de/projektmanagement.html', 'HERMES online'),
        ', der für die Zertifizierung massgeblichen Quelle. Kurzfassungen sind eigene, am Wortlaut geprüfte Texte; die Quizfragen sind nicht geprüft und haben keinerlei Bezug zur offiziellen Prüfung. '
          + 'Die Urheberrechte liegen bei der Schweizerischen Eidgenossenschaft; die Wiedergabe dient ausschliesslich dem Lernen.'
      ]),

      h('h2', { text: 'Gespeicherte Daten' }),
      daten,

      h('h2', { text: 'Unterstützen' }),
      h('p', {}, [
        'meinHERMES ist kostenlos und ohne Werbung. Wer die Seite nützlich findet, kann die Arbeit daran auf ',
        extern('https://ko-fi.com/rrradio', 'Ko-fi'),
        ' mit einem Kaffee unterstützen.'
      ])
    ];
  }

  function renderUeber(behaelter, params) {
    var importiert = !!(params && params.importiert);
    var daten = datenBereich(importiert);
    var prosa = h('div', { class: 'prosa' }, [
      h('div', { class: 'kopf' }, [
        h('h1', { text: 'Über meinHERMES' })
      ])
    ].concat(abschnitte(daten)));

    behaelter.appendChild(prosa);
    if (importiert) {
      /* Meldung nur einmal: beim nächsten Neuladen ohne Parameter. */
      global.history.replaceState(null, '', global.location.hash.split('?')[0]);
      daten.scrollIntoView({ block: 'center' });
    }
  }

  /* --- Hinweis für neue Besucher ------------------------------------------- */

  /* Beim ersten Laden jeder Seite ausser «Über» selbst: dieselben Abschnitte
     als modaler Dialog, bis beim Schliessen «Nicht mehr anzeigen» angehakt
     ist (hermes-trainer:willkommen). Ohne Haken kommt er beim nächsten Laden
     wieder. */
  function willkommen(route) {
    if (route === 'ueber' || !global.HTMLDialogElement) { return; }
    if (HT.store.lies('willkommen', {}).ausgeblendet) { return; }

    var haken = h('input', { type: 'checkbox', class: 'willkommen__eingabe' });
    var inhalt = h('div', { class: 'willkommen__inhalt prosa', tabindex: '-1', autofocus: true }, abschnitte(
      h('p', {}, [DATEN_SATZ + ' Sichern und auf ein anderes Gerät übertragen lassen sie sich unter ', h('a', { href: '#/ueber', text: 'Über' }), '.'])
    ));
    var dialog = h('dialog', { class: 'willkommen', 'aria-labelledby': 'willkommen-titel' }, [
      h('div', { class: 'willkommen__kopf' }, [
        h('h1', { id: 'willkommen-titel', text: 'Willkommen bei meinHERMES' }),
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Schliessen', text: '✕', on: { click: function () { dialog.close(); } } })
      ]),
      inhalt,
      h('div', { class: 'willkommen__fuss' }, [
        HT.store.verfuegbar ? h('label', { class: 'willkommen__haken' }, [haken, 'Nicht mehr anzeigen']) : h('span'),
        h('button', { type: 'button', class: 'btn btn--primaer', text: 'Verstanden', on: { click: function () { dialog.close(); } } })
      ])
    ]);

    function draussen(ev) {
      var r = dialog.getBoundingClientRect();
      return ev.target === dialog && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom);
    }
    /* Klick daneben schliesst — nur wenn er dort auch begann, sonst schlösse
       ein Markieren, das neben dem Dialog endet. Ein Link in die Seite
       (Über) schliesst ebenfalls. */
    var vonDraussen = false;
    dialog.addEventListener('pointerdown', function (ev) { vonDraussen = draussen(ev); });
    dialog.addEventListener('click', function (ev) {
      if ((vonDraussen && draussen(ev)) || ev.target.closest('a[href^="#"]')) { dialog.close(); }
    });
    /* Tasten gehören dem Dialog: Esc höbe sonst auch den Fokus im Graphen
       dahinter auf, ⌘F öffnete die Suche des Handbuchs. */
    dialog.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    dialog.addEventListener('close', function () {
      if (haken.checked) { HT.store.schreib('willkommen', { ausgeblendet: true }); }
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  }

  HT.views.ueber = { titel: 'Über', render: renderUeber, willkommen: willkommen };
}(window));
