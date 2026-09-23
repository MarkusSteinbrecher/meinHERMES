/* meinHERMES — Trainer, Teil «Fortschritt» (#/trainer?teil=fortschritt):
   was schon sitzt und was noch nicht, nach Phase und Modul geordnet wie die
   Übersicht der Methode — Phasen als Spalten, Module als Zeilen.

   Gezählt wird je Feld (Phase und Modul) und Element, nicht je Kasten: ein
   Ergebnis, das im Feld unter mehreren Aufgaben steht, ist eine Frage. Ein
   Element gilt als verstanden, wenn es ZIEL-mal richtig war; eine falsche
   Antwort lässt den Zähler stehen, markiert das Element aber bis zur
   nächsten richtigen Antwort als «zuletzt falsch».

   Die Meldungen kommen aus den Übungen: js/zuordnen.js meldet beim Prüfen
   jeden Kasten mit seinem Feld — aber nur, was seit der letzten Prüfung neu
   drin liegt; js/lernkarten.js meldet die Einschätzung einer Karte
   («Gewusst» bei richtiger Zuordnung zählt, «Nochmals» macht die Felder des
   Elements rot). Gespeichert unter «hermes-trainer:fortschritt»
   als { version, stand: { "Phase|Modul|Element-Id": { n, falsch } } }. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;

  var SPEICHER = 'fortschritt';
  var VERSION = 1;
  var ZIEL = 3;            // so oft richtig, dann gilt das Thema als verstanden

  var gespeichert = null;  // { schluessel: { n, falsch } }

  /* --- Speicher ------------------------------------------------------------ */

  function stand() {
    if (gespeichert) { return gespeichert; }
    var g = HT.store.lies(SPEICHER, null);
    gespeichert = (g && typeof g === 'object' && g.version === VERSION && g.stand && typeof g.stand === 'object')
      ? g.stand
      : {};
    return gespeichert;
  }

  function speichern() {
    HT.store.schreib(SPEICHER, { version: VERSION, stand: stand() });
  }

  function schluessel(phase, modul, id) {
    return phase + '|' + modul + '|' + id;
  }

  /**
   * Meldungen einer Prüfung: [{ phase, modul, id, richtig }]. Richtig zählt
   * bis ZIEL hoch und löscht die Marke; falsch setzt nur die Marke — ein
   * Ausrutscher löscht keine Arbeit.
   */
  function melden(liste) {
    if (!liste || !liste.length) { return; }
    var st = stand();
    liste.forEach(function (m) {
      if (!m || !m.phase || !m.modul || !m.id) { return; }
      var s = schluessel(m.phase, m.modul, m.id);
      var w = st[s] || (st[s] = { n: 0, falsch: false });
      if (m.richtig) {
        w.n = Math.min(ZIEL, w.n + 1);
        w.falsch = false;
      } else {
        w.falsch = true;
      }
    });
    speichern();
  }

  function zuruecksetzen() {
    gespeichert = {};
    HT.store.loesche(SPEICHER);
  }

  HT.fortschritt = {
    ZIEL: ZIEL,
    stand: stand,
    melden: melden,
    schluessel: schluessel,
    zuruecksetzen: zuruecksetzen
  };

  /* --- Zählung ------------------------------------------------------------- */

  /* Ein Feld (Phase und Modul) in Zahlen: verstanden, auf dem Weg, zuletzt
     falsch, offen. «Zuletzt falsch» geht vor — es ist das, was man als
     Nächstes anschauen will. */
  function zaehlen(feld) {
    var st = stand();
    var z = { gesamt: feld.elemente.length, voll: 0, weg: 0, falsch: 0, offen: 0 };
    feld.elemente.forEach(function (e) {
      var w = st[schluessel(feld.phase, feld.modul, e.id)];
      if (w && w.falsch) { z.falsch++; }
      else if (w && w.n >= ZIEL) { z.voll++; }
      else if (w && w.n > 0) { z.weg++; }
      else { z.offen++; }
    });
    return z;
  }

  function summieren(liste) {
    var s = { gesamt: 0, voll: 0, weg: 0, falsch: 0, offen: 0 };
    liste.forEach(function (z) {
      s.gesamt += z.gesamt; s.voll += z.voll; s.weg += z.weg; s.falsch += z.falsch; s.offen += z.offen;
    });
    return s;
  }

  /* --- Ansicht -------------------------------------------------------------- */

  var STUFEN = [
    { key: 'voll', label: 'verstanden' },
    { key: 'weg', label: 'auf dem Weg' },
    { key: 'falsch', label: 'zuletzt falsch' }
  ];

  function balken(z) {
    var el = h('span', { class: 'fs-balken', 'aria-hidden': 'true' });
    STUFEN.forEach(function (st) {
      if (!z[st.key]) { return; }
      el.appendChild(h('span', {
        class: 'fs-teil fs-teil--' + st.key,
        style: 'width:' + (100 * z[st.key] / z.gesamt) + '%'
      }));
    });
    return el;
  }

  function satz(z) {
    var teile = [];
    STUFEN.forEach(function (st) { if (z[st.key]) { teile.push(z[st.key] + ' ' + st.label); } });
    if (z.offen) { teile.push(z.offen + ' offen'); }
    return teile.join(', ');
  }

  /* Balken und Zahl nebeneinander: zwölf Module sollen ohne Rollen auf den
     Schirm passen. */
  function feldInhalt(z) {
    return h('span', { class: 'fs-feld' }, [
      balken(z),
      h('span', { class: 'fs-zahl', text: z.voll + '/' + z.gesamt })
    ]);
  }

  function zelle(feld, phase, modul) {
    if (!feld || !feld.elemente.length) {
      return h('td', { class: 'fs-zelle fs-zelle--leer' }, [
        h('span', { 'aria-hidden': 'true', text: '·' }),
        h('span', { class: 'nur-sr', text: modul + ' kommt in der Phase ' + phase + ' nicht vor' })
      ]);
    }
    var z = zaehlen(feld);
    return h('td', {
      class: 'fs-zelle' + (z.falsch ? ' fs-zelle--falsch' : (z.voll === z.gesamt ? ' fs-zelle--voll' : '')),
      title: phase + ' · ' + modul + ' — ' + satz(z)
    }, feldInhalt(z));
  }

  function summeZelle(z, klasse) {
    if (!z.gesamt) { return h('td', { class: 'fs-zelle fs-zelle--leer', text: '·' }); }
    return h('td', { class: 'fs-zelle fs-summe ' + (klasse || ''), title: satz(z) }, feldInhalt(z));
  }

  /* Die Übung hinter einem Titel: die Phase in der Kopfzeile, das Modul in
     der ersten Spalte — beides führt ins Zuordnen. */
  function uebungsLink(art, name, vorgehen, klasse) {
    var treffer = HT.zuordnen.uebungen(vorgehen).filter(function (u) { return u.art === art && u.name === name; })[0];
    return treffer
      ? h('a', { class: klasse, href: treffer.adresse, text: name, title: 'Übung ' + name + ' im Zuordnen' })
      : h('span', { class: klasse, text: name });
  }

  function raster(vorgehen) {
    var phasen = HT.graph.phasenDerVorgehensweise(vorgehen);
    var module = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var felder = {};
    HT.zuordnen.felder(vorgehen).forEach(function (f) { felder[f.phase + '|' + f.modul] = f; });

    var kopf = [h('th', { class: 'fs-ecke', scope: 'col', text: 'Modul' })];
    phasen.forEach(function (p) {
      kopf.push(h('th', { class: 'fs-kopf', scope: 'col' }, uebungsLink('phase', p, vorgehen, 'fs-kopf__link')));
    });
    kopf.push(h('th', { class: 'fs-kopf fs-kopf--summe', scope: 'col', text: 'Modul gesamt' }));

    var zeilen = [], alleZahlen = [], jePhase = {};
    phasen.forEach(function (p) { jePhase[p] = []; });

    module.forEach(function (m) {
      var zellen = [h('th', { class: 'fs-zeile', scope: 'row' }, uebungsLink('modul', m, vorgehen, 'fs-zeile__link'))];
      var zahlen = [];
      phasen.forEach(function (p) {
        var feld = felder[p + '|' + m];
        zellen.push(zelle(feld, p, m));
        if (feld && feld.elemente.length) {
          var z = zaehlen(feld);
          zahlen.push(z);
          jePhase[p].push(z);
        }
      });
      if (!zahlen.length) { return; }            // Modul ohne Aufgaben in dieser Vorgehensweise
      alleZahlen = alleZahlen.concat(zahlen);
      zellen.push(summeZelle(summieren(zahlen), 'fs-summe--zeile'));
      zeilen.push(h('tr', {}, zellen));
    });

    var fuss = [h('th', { class: 'fs-zeile fs-zeile--summe', scope: 'row', text: 'Alle Module' })];
    phasen.forEach(function (p) { fuss.push(summeZelle(summieren(jePhase[p]), 'fs-summe--spalte')); });
    var gesamt = summieren(alleZahlen);
    fuss.push(summeZelle(gesamt, 'fs-summe--alles'));

    return {
      gesamt: gesamt,
      el: h('table', { class: 'fs-raster' }, [
        h('thead', {}, h('tr', {}, kopf)),
        h('tbody', {}, zeilen),
        h('tfoot', {}, h('tr', {}, fuss))
      ])
    };
  }

  function legende() {
    return h('ul', { class: 'fs-legende' }, STUFEN.concat([{ key: 'offen', label: 'noch offen' }]).map(function (st) {
      return h('li', {}, [
        h('span', { class: 'fs-marke fs-teil--' + st.key, 'aria-hidden': 'true' }),
        h('span', { text: st.label + (st.key === 'voll' ? ' (' + ZIEL + '× richtig)' : '') })
      ]);
    }));
  }

  function anleitung() {
    return [
      h('h3', { class: 'gpop__abschnitt', text: 'Fortschritt' }),
      h('p', { text: 'Die Methode nach Phasen (Spalten) und Modulen (Zeilen), wie die Übersicht des Handbuchs: '
        + 'jedes Feld zeigt, wie viel von dem, was dort steht, schon sitzt. Gezählt wird je Feld und Element — '
        + 'ein Ergebnis, das im Feld unter mehreren Aufgaben steht, ist eine Frage. Nach ' + ZIEL + '× richtig gilt es als verstanden.' }),
      h('p', { text: 'Eine falsche Antwort löscht nichts: der Zähler bleibt stehen, das Feld ist bis zur nächsten '
        + 'richtigen Antwort rot. Was man gar nicht versucht hat, bleibt offen.' }),
      h('p', { text: 'Gezählt wird beim Prüfen im Zuordnen: jeder Kasten mit seiner Phase und seinem Modul, aber nur, '
        + 'was seit der letzten Prüfung neu drin liegt — ein zweites «Prüfen» ohne neue Zuordnung bringt nichts. '
        + 'Wer eine Art ausgefüllt stehen lässt, übt sie nicht; ihre Kästen bleiben hier offen.' }),
      h('p', { text: 'Bei den Lernkarten zählt die Einschätzung: «Gewusst» zählt, wenn die Karte auch Phase und Modul '
        + 'richtig zugeordnet hat; «Nochmals» macht die Felder des Elements rot. Das Quiz zählt nicht auf der Tafel: '
        + 'die Zeile darunter sagt, wie viele Quizfragen schon geprüft und wie viele zuletzt richtig sind.' }),
      h('p', {}, [
        'Ein Klick auf eine Phase oder ein Modul öffnet seine Übung im ',
        h('a', { href: '#/trainer', text: 'Zuordnen' }),
        '.'
      ]),
      h('p', {}, [
        '«Fortschritt zurücksetzen» unten leert alles: die Zähler dieser Tafel, die Einschätzung aller ',
        h('a', { href: '#/trainer?teil=lernkarten', text: 'Lernkarten' }),
        ' (gewusst/nicht gewusst) samt ihren Verlaufspunkten und den Verlauf und die Statistik des ',
        h('a', { href: '#/trainer?teil=quiz', text: 'Quiz' }),
        '. Nur die Karten leert das Icon auf der Lernkartenseite, nur das Quiz sein Knopf «Quiz zurücksetzen».'
      ])
    ];
  }

  function zahlwort(n, ein, viele) {
    return n + ' ' + (n === 1 ? ein : viele);
  }

  /** Rückfrage vor dem Zurücksetzen: sie nennt alles mit Zahlen. */
  function ruecksetzFrage(gezaehlt, karten, quizfragen) {
    var teile = [];
    if (gezaehlt) { teile.push(zahlwort(gezaehlt, 'gezählte Zuordnung', 'gezählte Zuordnungen') + ' auf der Tafel'); }
    if (karten) { teile.push('die Einschätzung von ' + zahlwort(karten, 'Lernkarte', 'Lernkarten') + ' samt ihren Verlaufspunkten'); }
    if (quizfragen) { teile.push('der Verlauf von ' + zahlwort(quizfragen, 'Quizfrage', 'Quizfragen') + ' samt Quiz-Statistik'); }
    var letzte = teile.pop();
    return 'Fortschritt wirklich zurücksetzen? Gelöscht werden: ' + (teile.length ? teile.join(', ') + ' und ' : '') + letzte + '.';
  }

  /** Die Zeile zum Quiz unter der Tafel: geprüft, zuletzt richtig und falsch. */
  function quizZeile(q) {
    if (!q || !q.gesamt) { return null; }
    return h('p', { class: 'fs-stand fs-quiz' }, [
      h('b', { text: String(q.beantwortet) }),
      ' von ' + q.gesamt + ' ',
      h('a', { href: '#/trainer?teil=quiz', text: 'Quizfragen' }),
      ' geprüft',
      q.beantwortet ? ' · ' + q.richtig + ' zuletzt richtig' : '',
      q.falsch ? ' · ' + q.falsch + ' zuletzt falsch' : ''
    ]);
  }

  function adresse(vorgehen) {
    return '#/trainer?teil=fortschritt' + (vorgehen === 'klassisch' ? '' : '&vorgehen=' + vorgehen);
  }

  function render(behaelter, params, leiste) {
    params = params || {};
    leiste = leiste || function () {};
    var vorgehen = HT.zuordnen.vorgehenVon(params.vorgehen) ? params.vorgehen : HT.zuordnen.vorgehenStand();
    if (vorgehen !== HT.zuordnen.vorgehenStand()) { HT.zuordnen.vorgehenMerken(vorgehen); }
    leiste(null, anleitung);
    aufbauen(behaelter, vorgehen, leiste);
  }

  function aufbauen(behaelter, vorgehen, leiste) {
    /* Andere Vorgehensweise: die Seite an Ort und Stelle neu, wie in der
       Übersicht des Zuordnens. */
    function wechseln(key) {
      HT.zuordnen.vorgehenMerken(key);
      global.history.replaceState(null, '', adresse(key));
      HT.ui.leeren(behaelter);
      aufbauen(behaelter, key, leiste);
      var gewaehlt = behaelter.querySelector('.chip[aria-pressed="true"]');
      if (gewaehlt) { gewaehlt.focus(); }
    }

    var r = raster(vorgehen);
    var g = r.gesamt;
    /* Der Knopf unten löscht beides — die Zähler der Tafel und die
       Einschätzung der Karten (Sponsor, 2026-09-18: für ihn ist das ein
       Lernstand, nicht zwei). Die Rückfrage sagt darum, was weggeht. */
    var gezaehlt = Object.keys(stand()).length;
    var karten = HT.lernkarten ? HT.lernkarten.eingeschaetzt() : 0;
    var quiz = HT.quiz ? HT.quiz.stand() : null;
    var quizfragen = quiz ? quiz.beantwortet : 0;
    behaelter.appendChild(h('section', { class: 'fs-seite' }, [
      HT.zuordnen.vorgehenGruppe(vorgehen, wechseln),
      h('p', { class: 'fs-stand', role: 'status' }, [
        h('b', { text: String(g.voll) }),
        ' von ' + g.gesamt + ' Zuordnungen verstanden',
        g.falsch ? ' · ' + g.falsch + ' zuletzt falsch' : '',
        g.weg ? ' · ' + g.weg + ' auf dem Weg' : ''
      ]),
      h('div', { class: 'fs-tafel' }, r.el),
      quizZeile(quiz),
      h('div', { class: 'fs-fuss' }, [
        legende(),
        gezaehlt || karten || quizfragen
          ? h('button', {
              type: 'button', class: 'btn btn--klein', text: 'Fortschritt zurücksetzen',
              title: 'Zähler der Tafel, Einschätzung der Lernkarten und Verlauf des Quiz löschen',
              on: {
                click: function () {
                  if (!global.confirm(ruecksetzFrage(gezaehlt, karten, quizfragen))) { return; }
                  zuruecksetzen();
                  if (karten && HT.lernkarten) { HT.lernkarten.leeren(); }
                  if (quizfragen && HT.quiz) { HT.quiz.leeren(); }
                  HT.ui.leeren(behaelter);
                  aufbauen(behaelter, vorgehen, leiste);
                }
              }
            })
          : h('p', { class: 'fs-hinweis', text: 'Noch nichts gezählt: Fortschritt entsteht beim Prüfen im Zuordnen, bei den Lernkarten und im Quiz.' })
      ])
    ]));
  }

  HT.trainerTeile.fortschritt = {
    id: 'fortschritt',
    label: 'Fortschritt',
    pfade: ['M3.5 20.5h17', 'M7 20.5v-5.5', 'M12 20.5V8', 'M17 20.5v-9'],
    render: render
  };
}(window));
