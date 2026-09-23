/* meinHERMES — Teil «Quiz» des Trainers (#/trainer?teil=quiz).
   Verständnisfragen aus data/quizfragen.json, eine Liste geschriebener
   Fragen mit Belegzitat aus dem Referenzhandbuch. Wie in der Prüfung sind je
   Frage eine oder mehrere Aussagen richtig: ankreuzen, prüfen, und danach
   steht an jeder Aussage, ob sie stimmt und warum (begruendungen), darunter
   die Erläuterung zur ganzen Frage. Manche Fragen beginnen mit einer
   Praxissituation. Eine Frage zählt als richtig, wenn genau die richtigen
   Aussagen angekreuzt sind.
   Jede geprüfte Frage kommt in ihren Verlauf (quiz-verlauf, die letzten
   fünf Prüfungen, wie die Punkte der Lernkarten). Die Auswahl nimmt zuerst
   neue und zuletzt falsch beantwortete Fragen, dann einmal richtige, zuletzt
   die mindestens zweimal in Folge richtigen. HT.quiz liefert den Stand für
   die Seite «Fortschritt».
   Oben auf der Einstellungsseite steht, dass die Fragen nicht geprüft sind und
   keinen Bezug zur offiziellen Prüfung haben. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var BUCHSTABEN = ['A', 'B', 'C', 'D', 'E', 'F'];
  var VERLAUF_LAENGE = 5;

  var konfig = {
    anzahl: 10,
    filter: []
  };

  var lauf = null;                 // { fragen, index, gewaehlt[] (Indexlisten), beantwortet }
  var hinweis = '';                // Meldung für die Konfigurationsansicht
  var refs = {};

  /** Filterbar sind die Kategorien des Datenbestands, nicht die Grundbegriffe,
      die nur die Lernkarten kennen. */
  function istKategorie(key) {
    return HT.daten.kategorien().some(function (kat) { return kat.key === key; });
  }

  /* --- Persistenz --------------------------------------------------------- */

  function konfigSpeichern() {
    HT.store.schreib('quiz-konfig', {
      anzahl: konfig.anzahl,
      filter: konfig.filter
    });
  }

  function konfigLaden() {
    var g = HT.store.lies('quiz-konfig', null);
    if (g && typeof g === 'object') {
      if ([10, 20, 50].indexOf(g.anzahl) !== -1) { konfig.anzahl = g.anzahl; }
      konfig.filter = Array.isArray(g.filter)
        ? g.filter.filter(istKategorie)
        : [];
    }
  }

  function statistik() {
    var s = HT.store.lies('quiz-statistik', null);
    if (!s || typeof s !== 'object') { s = {}; }
    return {
      laeufe: typeof s.laeufe === 'number' ? s.laeufe : 0,
      fragen: typeof s.fragen === 'number' ? s.fragen : 0,
      richtig: typeof s.richtig === 'number' ? s.richtig : 0
    };
  }

  function statistikErgaenzen(fragen, richtig) {
    var s = statistik();
    s.laeufe += 1;
    s.fragen += fragen;
    s.richtig += richtig;
    HT.store.schreib('quiz-statistik', s);
  }

  /* --- Verlauf je Frage -------------------------------------------------- */

  /* Immer frisch aus dem Speicher: ein Import oder das Zurücksetzen auf der
     Seite «Fortschritt» gilt so ohne Umweg auch hier. */
  function verlaufAlle() {
    var g = HT.store.lies('quiz-verlauf', null);
    return (g && typeof g === 'object' && g.verlauf && typeof g.verlauf === 'object') ? g.verlauf : {};
  }

  /** Die letzten Prüfungen einer Frage, älteste zuerst: 'richtig' | 'falsch'. */
  function verlaufVon(id, alle) {
    var v = (alle || verlaufAlle())[id];
    return Array.isArray(v)
      ? v.filter(function (w) { return w === 'richtig' || w === 'falsch'; }).slice(-VERLAUF_LAENGE)
      : [];
  }

  function verlaufErgaenzen(id, wert) {
    var alle = verlaufAlle();
    alle[id] = verlaufVon(id, alle).concat([wert]).slice(-VERLAUF_LAENGE);
    HT.store.schreib('quiz-verlauf', { verlauf: alle });
  }

  /** Rang in der Auswahl: 0 neu oder zuletzt falsch, 1 zuletzt einmal
      richtig, 2 zuletzt mindestens zweimal in Folge richtig. */
  function rang(v) {
    if (!v.length || v[v.length - 1] === 'falsch') { return 0; }
    return (v.length >= 2 && v[v.length - 2] === 'richtig') ? 2 : 1;
  }

  /** Stand über alle Fragen: beantwortet, zuletzt richtig, zuletzt falsch. */
  function lernstand() {
    var alle = verlaufAlle();
    var s = { gesamt: 0, beantwortet: 0, richtig: 0, falsch: 0 };
    HT.daten.quizfragen().forEach(function (f) {
      var v = verlaufVon(f.id, alle);
      s.gesamt++;
      if (!v.length) { return; }
      s.beantwortet++;
      if (v[v.length - 1] === 'richtig') { s.richtig++; } else { s.falsch++; }
    });
    return s;
  }

  function leeren() {
    HT.store.loesche('quiz-verlauf');
    HT.store.loesche('quiz-statistik');
  }

  /* Die fünf Punkte einer Frage in der Form der Lernkarten: richtig grün,
     falsch rot, älteste links, freie Plätze als leere Ringe. */
  function verlaufAnzeige(id) {
    var v = verlaufVon(id);
    var punkte = [];
    for (var i = 0; i < VERLAUF_LAENGE; i++) {
      var w = v[i] === 'richtig' ? ' lk-verlauf__punkt--gewusst' : v[i] === 'falsch' ? ' lk-verlauf__punkt--nochmals' : '';
      punkte.push(h('span', { class: 'lk-verlauf__punkt' + w }));
    }
    var text = v.length
      ? (v.length === 1 ? 'Letzte Prüfung: ' : 'Letzte ' + v.length + ' Prüfungen, älteste zuerst: ') + v.join(', ')
      : 'Diese Frage wurde noch nie geprüft';
    return h('span', { class: 'lk-verlauf quiz-verlauf', role: 'img', title: text, 'aria-label': text }, punkte);
  }

  /* --- Fragen ------------------------------------------------------------- */

  /** Fragen ohne Kategorie (Methodenfragen) stehen in jeder Auswahl. */
  function fragenPool() {
    var alle = HT.daten.quizfragen();
    if (!konfig.filter.length) { return alle.slice(); }
    return alle.filter(function (f) {
      return !f.kategorie || konfig.filter.indexOf(f.kategorie) !== -1;
    });
  }

  /** Stand einer Aussage nach dem Prüfen. */
  function stand(f, gewaehlt, i) {
    var soll = f.richtig.indexOf(i) !== -1;
    var ist = gewaehlt.indexOf(i) !== -1;
    if (soll) { return ist ? 'getroffen' : 'uebersehen'; }
    return ist ? 'falsch' : 'weggelassen';
  }

  function istRichtig(f, gewaehlt) {
    return f.antworten.every(function (a, i) {
      var s = stand(f, gewaehlt || [], i);
      return s === 'getroffen' || s === 'weggelassen';
    });
  }

  /* --- Ablauf ------------------------------------------------------------- */

  /* Je Rang gemischt, die Ränge hintereinander; die gezogenen Fragen dann
     noch einmal gemischt, damit die Reihenfolge im Lauf den Rang nicht verrät. */
  function fragenZiehen() {
    var alle = verlaufAlle();
    var raenge = [[], [], []];
    fragenPool().forEach(function (f) { raenge[rang(verlaufVon(f.id, alle))].push(f); });
    var folge = raenge.reduce(function (acc, r) { return acc.concat(HT.ui.mischen(r)); }, []);
    return HT.ui.mischen(folge.slice(0, konfig.anzahl));
  }

  function starten() {
    var fragen = fragenZiehen();
    if (!fragen.length) {
      lauf = null;
      hinweis = 'Für diese Auswahl gibt es keine Fragen. Bitte weitere Kategorien zulassen.';
      zeichnen();
      return;
    }
    hinweis = '';
    lauf = { fragen: fragen, index: 0, gewaehlt: fragen.map(function () { return []; }), beantwortet: false };
    zeichnen();
  }

  /* Schaltet nur den Knopf um statt neu zu zeichnen — sonst ginge der
     Tastaturfokus nach jedem Kreuz verloren. */
  function umschalten(i, btn, pruefKnopf) {
    if (!lauf || lauf.beantwortet) { return; }
    var g = lauf.gewaehlt[lauf.index];
    var pos = g.indexOf(i);
    if (pos === -1) { g.push(i); } else { g.splice(pos, 1); }
    var an = pos === -1;
    btn.classList.toggle('antwort--gewaehlt', an);
    btn.setAttribute('aria-pressed', an ? 'true' : 'false');
    pruefKnopf.disabled = !g.length;
  }

  function pruefen() {
    if (!lauf || lauf.beantwortet || !lauf.gewaehlt[lauf.index].length) { return; }
    lauf.beantwortet = true;
    var f = lauf.fragen[lauf.index];
    verlaufErgaenzen(f.id, istRichtig(f, lauf.gewaehlt[lauf.index]) ? 'richtig' : 'falsch');
    zeichnen();
  }

  function weiter() {
    if (!lauf) { return; }
    if (lauf.index + 1 >= lauf.fragen.length) {
      statistikErgaenzen(lauf.fragen.length, zaehleRichtige());
      lauf.fertig = true;
    } else {
      lauf.index += 1;
      lauf.beantwortet = false;
    }
    zeichnen();
  }

  function zaehleRichtige() {
    if (!lauf) { return 0; }
    return lauf.fragen.filter(function (f, i) { return istRichtig(f, lauf.gewaehlt[i]); }).length;
  }

  /* --- Darstellung: Konfiguration ---------------------------------------- */

  function schalterGruppe(titel, optionen, istAktiv, beiWahl) {
    var liste = h('ul', { class: 'chips chips--umbruch' });
    var knoepfe = [];

    function markieren() {
      knoepfe.forEach(function (b) {
        b.setAttribute('aria-pressed', istAktiv(b.dataset.wert) ? 'true' : 'false');
      });
    }

    optionen.forEach(function (opt) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false',
        dataset: { wert: String(opt.wert) },
        text: opt.label
      });
      btn.addEventListener('click', function () {
        beiWahl(opt.wert);
        markieren();
        konfigSpeichern();
      });
      knoepfe.push(btn);
      liste.appendChild(h('li', {}, btn));
    });

    markieren();
    return h('div', { class: 'feldgruppe' }, [
      h('p', { class: 'feldgruppe__titel', text: titel }),
      liste
    ]);
  }

  function konfigAnsicht(behaelter) {
    var st = statistik();

    behaelter.appendChild(h('div', { class: 'hinweisbox quiz-hinweis', role: 'note' }, [
      h('p', {}, [
        h('b', { text: 'Hinweis: ' }),
        'Die Quizfragen sind nicht geprüft und haben keinerlei Bezug zur offiziellen HERMES-Prüfung. '
          + 'Massgebend ist allein die offizielle Dokumentation.'
      ])
    ]));

    if (hinweis) {
      behaelter.appendChild(h('div', { class: 'datenwarnung', role: 'status', text: hinweis }));
      hinweis = '';
    }

    if (st.fragen > 0) {
      behaelter.appendChild(h('div', { class: 'statistik' }, [
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: String(st.laeufe) }),
          h('span', { class: 'statistik__label', text: st.laeufe === 1 ? 'Quiz' : 'Quiz-Läufe' })
        ]),
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: String(st.fragen) }),
          h('span', { class: 'statistik__label', text: 'Fragen' })
        ]),
        h('div', { class: 'statistik__feld' }, [
          h('span', { class: 'statistik__wert', text: HT.ui.prozent(st.richtig, st.fragen) + ' %' }),
          h('span', { class: 'statistik__label', text: 'richtig' })
        ])
      ]));
    }

    behaelter.appendChild(schalterGruppe('Anzahl Fragen',
      [{ wert: 10, label: '10' }, { wert: 20, label: '20' }, { wert: 50, label: '50' }],
      function (w) { return String(konfig.anzahl) === w; },
      function (w) { konfig.anzahl = w; }));

    var sq = lernstand();
    behaelter.appendChild(h('p', {
      class: 'trefferzahl',
      text: 'Im Bestand: ' + sq.gesamt + ' Fragen mit Belegstelle im Referenzhandbuch'
        + ' · je Frage sind eine oder mehrere Antworten richtig.'
        + (sq.beantwortet
          ? ' Schon geprüft: ' + sq.beantwortet + ', davon ' + sq.falsch + ' zuletzt falsch. '
            + 'Neue und zuletzt falsche Fragen kommen zuerst.'
          : '')
    }));

    /* Kategorienfilter */
    var katListe = h('ul', { class: 'chips chips--umbruch', 'aria-label': 'Kategorien filtern' });
    var katKnoepfe = [];

    function katMarkieren() {
      katKnoepfe.forEach(function (b) {
        var kat = b.dataset.kat;
        var aktiv = kat === '' ? konfig.filter.length === 0 : konfig.filter.indexOf(kat) !== -1;
        b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      });
    }

    function katChip(key, label) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false',
        dataset: { kat: key }
      }, [
        key ? HT.ui.katSymbol(key, 15) : null,
        h('span', { text: label })
      ]);
      btn.addEventListener('click', function () {
        if (key === '') {
          konfig.filter = [];
        } else {
          var i = konfig.filter.indexOf(key);
          if (i === -1) { konfig.filter.push(key); } else { konfig.filter.splice(i, 1); }
        }
        katMarkieren();
        konfigSpeichern();
      });
      katKnoepfe.push(btn);
      katListe.appendChild(h('li', {}, btn));
    }

    katChip('', 'Alle');
    HT.daten.kategorien().forEach(function (kat) {
      var hatFragen = HT.daten.quizfragen().some(function (f) { return f.kategorie === kat.key; });
      if (hatFragen) { katChip(kat.key, kat.label); }
    });
    katMarkieren();

    behaelter.appendChild(h('div', { class: 'feldgruppe' }, [
      h('p', { class: 'feldgruppe__titel', text: 'Kategorien' }),
      katListe
    ]));

    if (!HT.daten.quizfragen().length) {
      behaelter.appendChild(HT.ui.leerZustand(
        'Noch keine Fragen verfügbar',
        'Die Fragen stehen in data/quizfragen.json.'
      ));
      return;
    }

    behaelter.appendChild(h('button', {
      type: 'button', class: 'btn btn--primaer btn--breit', text: 'Quiz starten',
      on: { click: starten }
    }));

    if (st.fragen > 0 || sq.beantwortet) {
      behaelter.appendChild(h('p', { class: 'mehr-laden' }, h('button', {
        type: 'button', class: 'btn btn--klein', text: 'Quiz zurücksetzen',
        on: { click: function () {
          if (global.confirm('Quiz-Statistik und den Verlauf aller Fragen wirklich zurücksetzen?')) {
            leeren();
            zeichnen();
          }
        } }
      })));
    }
  }

  /** Belegzitat aus dem Referenzhandbuch mit Kapitel und Seite. */
  function belegElement(beleg) {
    if (!beleg || !beleg.zitat) { return null; }
    var ort = [];
    if (beleg.kapitel) { ort.push('Kap. ' + beleg.kapitel); }
    if (beleg.seite) { ort.push('S. ' + beleg.seite); }
    return h('div', { class: 'beleg' }, [
      h('span', { class: 'beleg__kopf', text: 'Beleg im Referenzhandbuch' + (ort.length ? ' · ' + ort.join(', ') : '') }),
      h('p', { text: '«' + beleg.zitat + '»' })
    ]);
  }

  /* --- Darstellung: Frage ------------------------------------------------- */

  var STAND_TEXT = {
    getroffen: 'Richtig angekreuzt',
    uebersehen: 'Richtig, nicht angekreuzt',
    falsch: 'Falsch angekreuzt',
    weggelassen: 'Zu Recht nicht angekreuzt'
  };

  /** Die Aussagen einer geprüften Frage: Stand und Begründung je Aussage. */
  function aussagenGeprueft(f, gewaehlt) {
    return h('ul', { class: 'antwort-liste' }, f.antworten.map(function (a, i) {
      var st = stand(f, gewaehlt, i);
      return h('li', {}, h('div', { class: 'antwort antwort--' + st }, [
        h('span', { class: 'antwort__marke', 'aria-hidden': 'true', text: BUCHSTABEN[i] || String(i + 1) }),
        h('span', { class: 'antwort__text' }, [
          h('span', { text: a }),
          h('span', { class: 'antwort__stand', text: STAND_TEXT[st] }),
          f.begruendungen[i] ? h('span', { class: 'antwort__begruendung', text: f.begruendungen[i] }) : null
        ])
      ]));
    }));
  }

  /** Der Fall vor der Frage. */
  function situationElement(f) {
    if (!f.situation) { return null; }
    return h('div', { class: 'quiz-situation' }, [
      h('span', { class: 'quiz-situation__kopf', text: 'Praxissituation' }),
      h('p', { text: f.situation })
    ]);
  }

  /** «2 von 3 richtigen Aussagen angekreuzt, 1 falsche» */
  function bilanz(f, gewaehlt) {
    var getroffen = 0, falsch = 0;
    f.antworten.forEach(function (a, i) {
      var st = stand(f, gewaehlt, i);
      if (st === 'getroffen') { getroffen++; }
      if (st === 'falsch') { falsch++; }
    });
    var n = f.richtig.length;
    var text = n === 1
      ? (getroffen ? 'Die richtige Aussage angekreuzt' : 'Die richtige Aussage nicht angekreuzt')
      : getroffen + ' von ' + n + ' richtigen Aussagen angekreuzt';
    if (falsch) { text += (getroffen ? ', dazu ' : ', stattdessen ') + (falsch === 1 ? 'eine falsche' : falsch + ' falsche'); }
    return text + '.';
  }

  function frageAnsicht(behaelter) {
    var f = lauf.fragen[lauf.index];
    var gewaehlt = lauf.gewaehlt[lauf.index];
    var istBeantwortet = lauf.beantwortet;

    behaelter.appendChild(h('div', { class: 'quiz-kopf' }, [
      h('span', { text: 'Frage ' + (lauf.index + 1) + ' von ' + lauf.fragen.length }),
      h('span', { class: 'quiz-kopf__rechts' }, [
        h('span', { text: 'Eine oder mehrere richtig' }),
        verlaufAnzeige(f.id)
      ])
    ]));

    var anteil = HT.ui.prozent(lauf.index, lauf.fragen.length);
    var fuellung = h('div', { class: 'fortschritt__fuellung' });
    fuellung.style.width = anteil + '%';
    behaelter.appendChild(h('div', { class: 'fortschritt__balken', 'aria-hidden': 'true' }, fuellung));

    var situation = situationElement(f);
    if (situation) { behaelter.appendChild(situation); }
    behaelter.appendChild(h('h1', { class: 'frage', text: f.frage }));

    if (istBeantwortet) {
      behaelter.appendChild(aussagenGeprueft(f, gewaehlt));
    } else {
      var liste = h('ul', { class: 'antwort-liste', 'aria-label': 'Aussagen, eine oder mehrere richtig' });
      var pruefKnopf = h('button', {
        type: 'button', class: 'btn btn--primaer btn--breit', text: 'Prüfen',
        disabled: !gewaehlt.length,
        on: { click: pruefen }
      });
      f.antworten.forEach(function (a, i) {
        var an = gewaehlt.indexOf(i) !== -1;
        var btn = h('button', {
          type: 'button',
          class: 'antwort' + (an ? ' antwort--gewaehlt' : ''),
          'aria-pressed': an ? 'true' : 'false'
        }, [
          h('span', { class: 'antwort__marke', 'aria-hidden': 'true', text: BUCHSTABEN[i] || String(i + 1) }),
          h('span', { class: 'antwort__text', text: a })
        ]);
        btn.addEventListener('click', function () { umschalten(i, btn, pruefKnopf); });
        liste.appendChild(h('li', {}, btn));
      });
      behaelter.appendChild(liste);
      behaelter.appendChild(pruefKnopf);
    }

    if (istBeantwortet) {
      var richtig = istRichtig(f, gewaehlt);
      var rueck = h('div', {
        class: 'rueckmeldung ' + (richtig ? 'rueckmeldung--gut' : 'rueckmeldung--schlecht'),
        tabindex: '-1',
        role: 'status'
      }, [
        h('p', { class: 'rueckmeldung__titel', text: richtig ? 'Richtig' : 'Nicht ganz' }),
        h('p', { class: 'rueckmeldung__bilanz', text: bilanz(f, gewaehlt) }),
        f.erklaerung ? h('p', { text: f.erklaerung }) : null,
        belegElement(f.beleg),
        HT.ui.quellenLink(f.quelle)
      ]);
      behaelter.appendChild(rueck);

      behaelter.appendChild(h('button', {
        type: 'button', class: 'btn btn--primaer btn--breit',
        text: lauf.index + 1 >= lauf.fragen.length ? 'Auswertung anzeigen' : 'Weiter',
        on: { click: weiter }
      }));

      try { rueck.focus({ preventScroll: true }); } catch (e) { rueck.focus(); }
    }

    behaelter.appendChild(h('p', { class: 'mehr-laden' }, h('button', {
      type: 'button', class: 'btn btn--klein', text: 'Quiz abbrechen',
      on: { click: function () { lauf = null; zeichnen(); } }
    })));
  }

  /* --- Darstellung: Auswertung ------------------------------------------- */

  function auswertungAnsicht(behaelter) {
    var richtig = zaehleRichtige();
    var gesamt = lauf.fragen.length;
    var anteil = HT.ui.prozent(richtig, gesamt);

    behaelter.appendChild(h('div', { class: 'kopf' }, [
      h('h1', { text: 'Auswertung' })
    ]));

    behaelter.appendChild(h('div', { class: 'box abschluss' }, [
      h('p', { class: 'abschluss__zahl', text: richtig + ' / ' + gesamt }),
      h('p', { text: anteil + ' % ganz richtig beantwortet' })
    ]));

    var fehler = [];
    lauf.fragen.forEach(function (f, i) {
      if (!istRichtig(f, lauf.gewaehlt[i])) { fehler.push({ f: f, gewaehlt: lauf.gewaehlt[i] }); }
    });

    if (fehler.length) {
      behaelter.appendChild(h('h2', { text: fehler.length === 1 ? 'Eine Frage nicht ganz richtig' : fehler.length + ' Fragen nicht ganz richtig' }));
      behaelter.appendChild(h('ul', { class: 'ergebnis-liste' }, fehler.map(function (x) {
        return h('li', { class: 'fehler-eintrag' }, [
          situationElement(x.f),
          h('p', { class: 'fehler-eintrag__frage' }, [h('span', { text: x.f.frage }), verlaufAnzeige(x.f.id)]),
          aussagenGeprueft(x.f, x.gewaehlt),
          x.f.erklaerung ? h('p', { class: 'fehler-eintrag__zeile', text: x.f.erklaerung }) : null,
          belegElement(x.f.beleg),
          HT.ui.quellenLink(x.f.quelle)
        ]);
      })));
    } else {
      behaelter.appendChild(h('p', { text: 'Alle Fragen richtig beantwortet.' }));
    }

    behaelter.appendChild(h('div', { class: 'btn-reihe', style: 'margin-top:1rem' }, [
      h('button', {
        type: 'button', class: 'btn btn--primaer', text: 'Neues Quiz, gleiche Einstellungen',
        on: { click: starten }
      }),
      h('button', {
        type: 'button', class: 'btn', text: 'Einstellungen ändern',
        on: { click: function () { lauf = null; zeichnen(); } }
      })
    ]));
  }

  /* --- Zeichnen ----------------------------------------------------------- */

  function zeichnen() {
    if (!refs.behaelter) { return; }
    HT.ui.leeren(refs.behaelter);

    if (!lauf) {
      konfigAnsicht(refs.behaelter);
      return;
    }
    if (lauf.fertig) {
      auswertungAnsicht(refs.behaelter);
      return;
    }
    frageAnsicht(refs.behaelter);
  }

  function render(behaelter, params, leiste) {
    /* Was das Quiz ist, steht vorn in der Karte hinter dem Info-Icon der Leiste. */
    if (leiste) {
      leiste(null, function () {
        return [
          h('h3', { class: 'gpop__abschnitt', text: 'Quiz' }),
          h('p', { text: 'Zu jeder Frage vier oder fünf Aussagen, eine oder mehrere sind richtig. Ankreuzen und prüfen: danach steht an jeder Aussage, ob sie stimmt und warum, darunter der Beleg im Referenzhandbuch.' }),
          h('p', { text: 'Die fünf Punkte zeigen die letzten Prüfungen einer Frage: grün ganz richtig, rot nicht ganz. Neue und zuletzt falsch beantwortete Fragen kommen zuerst, Fragen, die zweimal in Folge richtig waren, erst am Schluss.' })
        ];
      });
    }
    if (!konfig.geladen) {
      konfigLaden();
      konfig.geladen = true;
    }
    if (params && params.kat && istKategorie(params.kat)) {
      konfig.filter = [params.kat];
    }
    lauf = null;
    refs.behaelter = behaelter;
    zeichnen();
  }

  HT.quiz = { stand: lernstand, leeren: leeren };

  HT.trainerTeile.quiz = {
    id: 'quiz',
    label: 'Quiz',
    pfade: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 3.9', 'M12 17.4h.01'],
    render: render
  };
}(window));
