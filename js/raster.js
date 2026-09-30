/* meinHERMES — Überblick (#/ueberblick): das Raster, Gesamtbild und Graph
   in einer Ansicht. Seit 2026-09-27 die Überblickseite; der frühere
   Überblick (Abbildung und Graph nebeneinander, js/ueberblick.js) ist
   entfernt. #/raster, #/graph und #/feld leiten hierher (js/app.js).

   Das Gerüst steht fest und folgt Abbildung 1 des Referenzhandbuchs: Phasen
   als Zeilen, Module als Spalten, Projektgrundlagen in der Initialisierung
   über Organisation bis IT-System. Projektsteuerung und Projektführung haben
   je eine eigene Spalte (wie im Nachbau, js/gesamtbild.js). Links läuft das
   Phasenband mit den Meilensteinen der Phase — die Freigabe, die sie öffnet,
   oben, die Entscheide, mit denen sie endet, unten auf der Grenze zur
   nächsten Phase, die modulspezifischen dazwischen.

   In die Felder (Phase × Modul) kommen die Elemente in der Bildsprache des
   Graphen: Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln
   ein- und ausblenden. Mit Aufgaben steht je Aufgabe ein Block — die
   verantwortliche Rolle darüber, die Ergebnisse, die sie in diesem Feld
   erzeugt, eingerückt darunter —, dieselben Blöcke wie in der Landkarte und
   im Zuordnen des Trainers (HT.graph.bloecke). Die Meilensteine stehen im
   Phasenband und im Feld als Ergebnis der Aufgabe, die sie erzeugt: ohne
   Kasten unter dem Block, die Raute bündig mit dem Icon der Rolle — nur im
   Fluss der Abbildung 1 (Pfeile) nicht, dort stehen allein ihre Kästen.

   Zeigen auf ein Element hebt jede seiner Stellen hervor; Zeigen auf einen
   Meilenstein das Feld, in dem er entsteht.

   Das Phasenband trägt die Farben der Phasenbalken der Abbildung 1
   (Initialisierung und Abschluss grau, Konzept bis Einführung blau,
   Umsetzung rosa); zwischen zwei Phasen bleibt eine Lücke. Jede Phase und
   jedes Modul lässt sich mit dem Pfeil zuklappen (Zeile niedrig bzw.
   Spalte schmal, ohne Inhalt) und wieder aufklappen; gespeichert in
   localStorage (raster-zu), im Zuordnen im Speicher des Trainers.

   Anordnung wie in der Abbildung 1: Im Feld steht, was dort später
   entsteht, weiter unten. Mit Pfeilen stehen die Ergebnisse zudem in Stufen
   nach der Höhe ihres Kastens, quer über alle Spalten ausgerichtet, mit
   einer freien Gasse über jeder Stufe (ausrichten); ohne Pfeile dicht, was
   in einer Phase fast gleich hoch steht, aber auf gleicher Höhe, und dieselbe
   Aufgabe in mehreren Spalten quer auf einer Linie (angleichen).
   Aufeinanderfolgende Felder eines Moduls mit gleichem Inhalt stehen als
   ein Feld über mehrere Phasen.

   Pfeile (Knopf in der Leiste, nur mit Ergebnissen allein): der Fluss der
   Abbildung 1. Es stehen nur die Ergebnisse mit Kasten in der Abbildung
   (auch im Sammelkasten «Phasenunabhängig»), die übrigen eines Feldes
   klappt «+N» auf. Die Pfeile (PFEILE) gehen als SVG-Ebene kurz von Kasten
   zu Kasten, verzweigen und sammeln sich in den Gassen wie die
   Sammelschienen der Grafik; die Kästen behalten ihre Grösse. Zeigen auf
   ein Ergebnis hebt seine Pfeile hervor. Aus: alle Ergebnisse, keine
   Pfeile.

   Filter (Icon in der Kopfzeile neben der Suche, Popover im Stil «Alle
   Filter» des Graphen): Phasen und Module blenden Zeilen und Spalten aus,
   die übrigen werden breiter; der Trichter an Modulkopf oder Phase tut
   dasselbe. Rolle (verantwortlich, beteiligt, beides) und «Nur Entscheide»
   lassen nur die passenden Aufgaben stehen; das Gerüst bleibt, Felder ohne
   Treffer bleiben leer. So beantwortet das Raster etwa: welche Entscheide
   trifft der Projektleiter in welchen Phasen und Modulen? Der Filter steht in
   der Adresse (#/ueberblick?rolle=…&entscheide=1).

   Inhaltsseite rechts (Icon ganz rechts in der Leiste): Ein Klick auf ein Element,
   eine Phase oder einen Modulkopf zeigt dessen Seite (js/inhaltsseite.js,
   dieselbe wie im Überblick) und darunter «Im Raster»; ohne Auswahl die
   Treffer des Filters. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};
  var h = HT.ui.h;

  /* Spalten in der Folge der Abbildung 1; Projektgrundlagen liegt über
     dreien. In den Daten teilt sich keine Phase Projektgrundlagen mit ihnen. */
  var SPALTEN = HT.gesamtbild.SPALTEN;
  var SPANNEN = { Projektgrundlagen: { ab: 'Organisation', breite: 3 } };
  /* Projektführung hat in den mittleren Phasen gut doppelt so viel wie jede
     andere Spalte und bekommt mehr Breite. */
  var GEWICHT = { 'Projektführung': 1.3 };
  var LAGEN = ['anfang', 'mitte', 'ende'];
  var KAT_REIHE = ['rolle', 'aufgabe', 'ergebnis'];
  var KAT_LABEL = { rolle: 'Rollen', aufgabe: 'Aufgaben', ergebnis: 'Ergebnisse' };

  /* Im Fluss haben die Kästen eine feste Breite wie in der Abbildung: die
     Namen stehen meist in zwei Zeilen, und wo die Abbildung Kästen
     nebeneinander stellt, passen sie auch hier nebeneinander. 82 px lassen
     76 px Text — der längste Wortteil («initialisierungs-») braucht 74. */
  var KASTEN = 82;
  var KASTEN_LUECKE = 8;
  var FELD_RAND = 12;          // Rand, Innenabstand und Linie des Feldes
  var PHASEN_LUECKE = 10;      // px zwischen zwei Phasen, wie --ra-luecke in css/raster.css
  var UNTERSPALTE_TOLERANZ = 25;   // Koordinaten der Grafik

  var SPEICHER = 'raster-sicht';
  var STANDARD = { rolle: false, aufgabe: false, ergebnis: true, pfeile: true };

  /* Die Pfeile der Abbildung 1 zwischen Ergebnissen, abgeschrieben aus der
     Grafik: [Phase, Modul, Ergebnis] → [Phase, Modul, Ergebnis]. Das Modul
     sagt, welches Vorkommen gemeint ist, wenn ein Ergebnis in der Phase in
     mehreren Feldern steht; fehlt es dort, gilt das erste in der Phase.
     Sammelschienen der Grafik (eine Linie zu vielen Kästen) stehen als
     einzelne Pfeile. Agil liegen Konzept, Realisierung und Einführung in
     der Umsetzung; Pfeile von einem Kasten auf sich selbst fallen dann weg. */
  var PFEILE = (function () {
    var liste = [];
    function p(vonPhase, vonModul, von, nachPhase, nachModul, nach) {
      liste.push({ von: [vonPhase, vonModul, von], nach: [nachPhase, nachModul, nach] });
    }
    /* Innerhalb einer Phase, Kette durch ein Modul und Fächer aus einem Kasten. */
    function kette(phase, modul, namen) {
      for (var i = 1; i < namen.length; i++) { p(phase, modul, namen[i - 1], phase, modul, namen[i]); }
    }
    function faecher(phase, modul, von, ziele) {
      ziele.forEach(function (z) { p(phase, modul, von, phase, z[0], z[1]); });
    }
    var I = 'Initialisierung', K = 'Konzept', R = 'Realisierung', E = 'Einführung', A = 'Abschluss';

    p(I, 'Projektsteuerung', 'Projektinitialisierungsauftrag', I, 'Projektführung', 'Stakeholderliste');
    faecher(I, 'Projektführung', 'Stakeholderliste', [['Projektgrundlagen', 'Rechtsgrundlagenanalyse'],
      ['Projektgrundlagen', 'Studie'], ['Projektgrundlagen', 'Schutzbedarfsanalyse'], ['Projektgrundlagen', 'Beschaffungsanalyse']]);
    p(I, 'Projektgrundlagen', 'Rechtsgrundlagenanalyse', I, 'Projektgrundlagen', 'Studie');
    p(I, 'Projektgrundlagen', 'Schutzbedarfsanalyse', I, 'Projektgrundlagen', 'Studie');
    p(I, 'Projektgrundlagen', 'Studie', I, 'Projektführung', 'Projektmanagementplan');
    p(I, 'Projektgrundlagen', 'Beschaffungsanalyse', I, 'Projektführung', 'Projektmanagementplan');
    p(I, 'Projektführung', 'Projektmanagementplan', I, 'Projektführung', 'Durchführungsauftrag');

    kette(K, 'Organisation', ['Situationsanalyse', 'Organisationsanforderungen']);
    faecher(K, 'Organisation', 'Organisationsanforderungen', [['Organisation', 'Organisationskonzept'],
      ['IT-System', 'Integrationskonzept'], ['Beschaffung', 'Ausschreibungsunterlagen'], ['Tests', 'Testkonzept'],
      ['Einführungsorganisation', 'Einführungskonzept'], ['IT-Migration', 'Migrationskonzept'],
      ['IT-Betrieb', 'Betriebskonzept'], ['ISDS', 'ISDS-Konzept']]);
    faecher(K, 'Organisation', 'Geschäftsmodellbeschreibung', [['Organisation', 'Prozessbeschreibung'], ['Organisation', 'Organisationsbeschreibung']]);
    kette(K, 'Produkt', ['Situationsanalyse', 'Lösungsanforderungen', 'Produktkonzept']);
    kette(K, 'IT-System', ['Situationsanalyse', 'Lösungsanforderungen', 'Systemkonzept', 'Lösungsarchitektur', 'Integrationskonzept']);
    kette(K, 'Beschaffung', ['Ausschreibungsunterlagen', 'Evaluationsbericht', 'Vereinbarung']);
    kette(K, 'IT-Betrieb', ['Betriebskonzept', 'Service Level Agreement']);

    p(K, 'Organisation', 'Prozessbeschreibung', R, 'Organisation', 'Prozessbeschreibung');
    p(K, 'Organisation', 'Organisationsbeschreibung', R, 'Organisation', 'Organisationsbeschreibung');
    p(K, 'Produkt', 'Produktkonzept', R, 'Produkt', 'Detailspezifikation');
    p(K, 'IT-System', 'Lösungsarchitektur', R, 'IT-System', 'Detailspezifikation');
    p(K, 'IT-System', 'Integrationskonzept', R, 'IT-System', 'Detailspezifikation');
    p(K, 'Tests', 'Testkonzept', R, 'Tests', 'Testinfrastruktur realisiert');
    p(K, 'Einführungsorganisation', 'Einführungskonzept', R, 'Einführungsorganisation', 'Einführungsmassnahmen realisiert');
    p(K, 'IT-Migration', 'Migrationskonzept', R, 'IT-Migration', 'Detailspezifikation');
    p(K, 'IT-Betrieb', 'Service Level Agreement', R, 'IT-Betrieb', 'Betriebsinfrastruktur realisiert');
    p(K, 'IT-Betrieb', 'Service Level Agreement', R, 'IT-Betrieb', 'Betriebshandbuch');
    p(K, 'ISDS', 'ISDS-Konzept', R, 'ISDS', 'ISDS-Massnahmen realisiert');

    p(R, 'Organisation', 'Prozessbeschreibung', R, 'Organisation', 'Organisation umgesetzt');
    p(R, 'Organisation', 'Organisationsbeschreibung', R, 'Organisation', 'Organisation umgesetzt');
    kette(R, 'Produkt', ['Detailspezifikation', 'Produkt entwickelt oder angepasst', 'Anwendungshandbuch']);
    kette(R, 'IT-System', ['Detailspezifikation', 'System entwickelt oder parametrisiert', 'Anwendungshandbuch']);
    kette(R, 'IT-System', ['Detailspezifikation', 'Schnittstellen realisiert', 'Integrations- und Installationsanleitung']);
    kette(R, 'Tests', ['Testinfrastruktur realisiert', 'Testprotokoll', 'Testkonzept']);
    kette(R, 'IT-Migration', ['Detailspezifikation', 'Migrationsverfahren realisiert']);
    kette(R, 'IT-Betrieb', ['Betriebsinfrastruktur realisiert', 'System integriert']);
    kette(R, 'IT-Betrieb', ['Betriebshandbuch', 'Betriebsorganisation realisiert']);
    kette(R, 'ISDS', ['ISDS-Massnahmen realisiert', 'ISDS-Konzept']);
    [['Einführungsorganisation', 'Einführungsmassnahmen realisiert'], ['Organisation', 'Organisation umgesetzt'],
      ['Produkt', 'Anwendungshandbuch'], ['IT-System', 'Anwendungshandbuch'], ['IT-System', 'Integrations- und Installationsanleitung'],
      ['Tests', 'Testkonzept'], ['IT-Migration', 'Migrationsverfahren realisiert'], ['IT-Betrieb', 'System integriert'],
      ['IT-Betrieb', 'Betriebsorganisation realisiert'], ['ISDS', 'ISDS-Konzept']].forEach(function (q) {
      p(R, q[0], q[1], R, 'Einführungsorganisation', 'Abnahmeprotokoll');
    });

    [['Organisation', 'Organisation aktiviert'], ['Produkt', 'Produkt aktiviert'], ['IT-System', 'System aktiviert'],
      ['Einführungsorganisation', 'Einführungsmassnahmen durchgeführt'], ['IT-Migration', 'Migration durchgeführt'],
      ['IT-Betrieb', 'Betrieb aktiviert'], ['ISDS', 'ISDS-Konzept überführt']].forEach(function (z) {
      p(R, 'Einführungsorganisation', 'Abnahmeprotokoll', E, z[0], z[1]);
    });
    p(R, 'Tests', 'Testkonzept', A, 'Tests', 'Testkonzept');

    [['Organisation', 'Organisation aktiviert'], ['Produkt', 'Produkt aktiviert'], ['IT-System', 'System aktiviert'],
      ['Einführungsorganisation', 'Einführungsmassnahmen durchgeführt'], ['IT-Migration', 'Migration durchgeführt'],
      ['IT-Betrieb', 'Betrieb aktiviert']].forEach(function (q) {
      p(E, q[0], q[1], E, 'Einführungsorganisation', 'Abnahmeprotokoll');
    });
    kette(E, 'ISDS', ['ISDS-Konzept überführt', 'ISDS-Konzept']);
    p(E, 'IT-Migration', 'Migration durchgeführt', A, 'IT-Migration', 'Altsystem entfernt');
    kette(A, 'Tests', ['Testkonzept', 'Testinfrastruktur überführt']);
    return liste;
  }());
  var AGIL_PHASE = { Konzept: 'Umsetzung', Realisierung: 'Umsetzung', 'Einführung': 'Umsetzung' };

  /* Inhaltsseite rechts: offen oder zu und ihre Breite. */
  var SEITE_SPEICHER = 'raster-seite';
  var SEITE_STANDARD = 400;
  var SEITE_MIN = 280;
  var BUEHNE_MIN = 420;

  var modelle = {};
  var breiten = null;
  var wahlVonAussen = null;   // Suchtreffer → Auswahl der laufenden Ansicht
  var lagenBereit = null;
  var laufende = null;

  /* --- Zustand --------------------------------------------------------------- */

  function sichtLesen() {
    try {
      var roh = global.localStorage.getItem(SPEICHER);
      var s = roh ? JSON.parse(roh) : null;
      /* Gespeichert als «fluss»: das frühere «pfeile: false» hiess nur
         «Pfeile erst beim Zeigen» und schaltet den Fluss nicht aus. */
      if (s && typeof s === 'object') {
        return { rolle: !!s.rolle, aufgabe: !!s.aufgabe, ergebnis: !!s.ergebnis, pfeile: s.fluss !== false };
      }
    } catch (e) { /* ohne Speicher gilt der Standard */ }
    return { rolle: STANDARD.rolle, aufgabe: STANDARD.aufgabe, ergebnis: STANDARD.ergebnis, pfeile: STANDARD.pfeile };
  }

  function sichtSpeichern(sicht) {
    try {
      global.localStorage.setItem(SPEICHER, JSON.stringify({ rolle: sicht.rolle, aufgabe: sicht.aufgabe, ergebnis: sicht.ergebnis, fluss: sicht.pfeile }));
    } catch (e) { /* egal */ }
  }

  /* Zugeklappte Phasen und Module des Überblicks: { phasen: [], module: [] }. */
  var ZU_SPEICHER = 'raster-zu';
  function zuLesen(schluessel) {
    try {
      var z = JSON.parse(global.localStorage.getItem(schluessel) || 'null');
      if (z && Array.isArray(z.phasen) && Array.isArray(z.module)) { return { phasen: z.phasen.slice(), module: z.module.slice() }; }
    } catch (e) { /* ohne Speicher alles offen */ }
    return { phasen: [], module: [] };
  }
  function zuSpeichern(schluessel, zu) {
    try { global.localStorage.setItem(schluessel, JSON.stringify(zu)); } catch (e) { /* egal */ }
  }
  /* Klappt Phase bzw. Modul name in zu um. */
  function zuUmschalten(zu, art, name) {
    var liste = art === 'modul' ? zu.module : zu.phasen;
    var i = liste.indexOf(name);
    if (i === -1) { liste.push(name); } else { liste.splice(i, 1); }
  }

  function seiteLesen() {
    try {
      var s = JSON.parse(global.localStorage.getItem(SEITE_SPEICHER) || 'null');
      if (s && typeof s === 'object') {
        return { offen: !!s.offen, breite: typeof s.breite === 'number' ? s.breite : SEITE_STANDARD };
      }
    } catch (e) { /* ohne Speicher gilt der Standard */ }
    /* Zu, bis man etwas wählt: das Raster braucht bei 1470 px die ganze Breite. */
    return { offen: false, breite: SEITE_STANDARD };
  }

  function seiteSpeichern(z) {
    try { global.localStorage.setItem(SEITE_SPEICHER, JSON.stringify(z)); } catch (e) { /* egal */ }
  }

  /* --- Modell ---------------------------------------------------------------- */

  /* Die Reihenfolge der Ergebnisse folgt der Abbildung 1, sobald ihre Kästen
     gelesen sind (wie im Überblick und in der Landkarte). */
  function lagenLaden() {
    if (lagenBereit) { return lagenBereit; }
    lagenBereit = !HT.abbildung ? global.Promise.resolve() : HT.abbildung.holen().then(function (text) {
      HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(HT.abbildung.kaesten(HT.abbildung.lesen(text))));
      HT.gesamtbild.vergessen();
    }).catch(function () { /* Ordnung ohne Abbildung */ });
    return lagenBereit;
  }

  function spalteVon(modul) {
    var sp = SPANNEN[modul];
    if (sp) { return { start: SPALTEN.indexOf(sp.ab), breite: sp.breite }; }
    var i = SPALTEN.indexOf(modul);
    return i === -1 ? null : { start: i, breite: 1 };
  }

  function istMeilenstein(k) {
    return !!k && k.kategorie === 'ergebnis' && !!k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  /**
   * { vorgehen, zeilen: [{ phase, index, meilensteine: { anfang, mitte, ende } }],
   *   felder: [{ phase, zeile, modul, spalte, bloecke }] }
   * Ein Feld gibt es nur, wo das Modul in der Phase Aufgaben hat.
   */
  function modell(vorgehen) {
    if (modelle[vorgehen]) { return modelle[vorgehen]; }
    var phasen = HT.graph.phasenDerVorgehensweise(vorgehen);
    var module = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var zeilen = [], felder = [];
    phasen.forEach(function (phase, i) {
      zeilen.push({ phase: phase, index: i, meilensteine: HT.gesamtbild.meilensteineVon(vorgehen, phase) });
      module.forEach(function (modul) {
        var spalte = spalteVon(modul);
        if (!spalte) { return; }
        var bloecke = HT.graph.bloecke({ vorgehen: vorgehen, phasen: [phase], module: [modul] }, true);
        if (!bloecke.length) { return; }
        felder.push({ phase: phase, zeile: i, modul: modul, spalte: spalte, bloecke: bloecke });
      });
    });
    modelle[vorgehen] = { vorgehen: vorgehen, phasen: phasen, zeilen: zeilen, felder: felder };
    return modelle[vorgehen];
  }

  /* --- Filter ---------------------------------------------------------------- */

  /* Der Filter wählt aus, ohne das Gerüst zu ändern:
     phasen, module — null heisst alle; eine Liste blendet die übrigen Zeilen
       bzw. Spalten aus (die gezeigten werden breiter). Leer heisst keine.
     rolle — Name der Rolle oder ''; bezug: verantwortlich | beteiligt | beides.
     entscheide — nur die Entscheidungsaufgaben («Entscheid … treffen»).
     Rolle und Entscheide lassen die Felder stehen: ein Feld ohne Treffer
     bleibt leer, damit man sieht, wo nichts ist. */
  var BEZUEGE = [
    { key: 'verantwortlich', label: 'Verantwortlich' },
    { key: 'beteiligt', label: 'Beteiligt' },
    { key: 'beides', label: 'Beides' }
  ];

  function leererFilter() {
    return { phasen: null, module: null, rolle: '', bezug: 'verantwortlich', entscheide: false };
  }

  function filterAusParams(params) {
    var f = leererFilter();
    function liste(text) { return text === undefined ? null : String(text).split(',').filter(Boolean); }
    f.phasen = liste(params.phasen);
    f.module = liste(params.module);
    f.rolle = params.rolle || '';
    if (params.bezug === 'beteiligt' || params.bezug === 'beides') { f.bezug = params.bezug; }
    f.entscheide = params.entscheide === '1';
    return f;
  }

  function filterAlsQuery(f) {
    var teile = [];
    if (f.phasen) { teile.push('phasen=' + f.phasen.map(encodeURIComponent).join(',')); }
    if (f.module) { teile.push('module=' + f.module.map(encodeURIComponent).join(',')); }
    if (f.rolle) { teile.push('rolle=' + encodeURIComponent(f.rolle)); }
    if (f.rolle && f.bezug !== 'verantwortlich') { teile.push('bezug=' + f.bezug); }
    if (f.entscheide) { teile.push('entscheide=1'); }
    return teile;
  }

  function filterAktiv(f) {
    return !!(f.phasen || f.module || f.rolle || f.entscheide);
  }

  /** Filtern Rolle oder Entscheide die Aufgaben (nicht nur Zeilen und Spalten)? */
  function trefferFilter(f) { return !!(f.rolle || f.entscheide); }

  function istEntscheid(aufgabe) { return /^Entscheid\s/.test(aufgabe.begriff); }

  function bezugPasst(aufgabe, f) {
    if (!f.rolle) { return true; }
    var e = aufgabe.eintrag || HT.daten.eintragMitId(aufgabe.id);
    if (!e) { return false; }
    var norm = HT.daten.normalisieren(f.rolle);
    var verantwortlich = HT.daten.normalisieren(e.verantwortlich || '') === norm;
    var beteiligt = (e.beteiligt || []).some(function (r) { return HT.daten.normalisieren(r) === norm; });
    if (f.bezug === 'verantwortlich') { return verantwortlich; }
    if (f.bezug === 'beteiligt') { return beteiligt && !verantwortlich; }
    return verantwortlich || beteiligt;
  }

  function bloeckeFiltern(bloecke, f) {
    return bloecke.filter(function (b) {
      return (!f.entscheide || istEntscheid(b.aufgabe)) && bezugPasst(b.aufgabe, f);
    });
  }

  function gezeigt(liste, name) { return !liste || liste.indexOf(name) !== -1; }

  /**
   * Was der Filter vom Modell übrig lässt:
   * { zeilen, spalten: [name], kopfSpalten: [name], felder: [{ feld, bloecke, start, breite, kopfImFeld }],
   *   erreicht: { phase: { msId: true } }, zahlen, treffer: { aufgaben, phasen, module } }
   * Projektgrundlagen spannt über die gezeigten seiner drei Spalten; ist
   * keine davon gezeigt, bekommt es eine eigene.
   */
  function ausschnitt(m, f, zu) {
    zu = zu || { phasen: [], module: [] };
    function istZu(liste, name) { return liste.indexOf(name) !== -1; }
    var zeilen = m.zeilen.filter(function (z) { return gezeigt(f.phasen, z.phase); });
    var spalten = SPALTEN.filter(function (s) { return gezeigt(f.module, s); });
    var pgUnter = ['Organisation', 'Produkt', 'IT-System'].filter(function (s) { return spalten.indexOf(s) !== -1; });
    /* Projektgrundlagen spannt nur über die offenen seiner Spalten. */
    var pgOffen = pgUnter.filter(function (s) { return !istZu(zu.module, s); });
    var pgEigen = gezeigt(f.module, 'Projektgrundlagen') && !pgUnter.length
      && m.felder.some(function (feld) { return feld.modul === 'Projektgrundlagen' && gezeigt(f.phasen, feld.phase); });
    if (pgEigen) {
      /* Dort, wo Organisation stünde: hinter Projektsteuerung und -führung. */
      var nach = spalten.filter(function (s) { return s === 'Projektsteuerung' || s === 'Projektführung'; }).length;
      spalten.splice(nach, 0, 'Projektgrundlagen');
    }

    var ids = { rolle: {}, aufgabe: {}, ergebnis: {} }, erreicht = {}, trefferPhasen = {}, trefferModule = {};
    var felder = [];
    m.felder.forEach(function (feld) {
      if (!gezeigt(f.phasen, feld.phase) || !gezeigt(f.module, feld.modul)) { return; }
      if (istZu(zu.phasen, feld.phase) || istZu(zu.module, feld.modul)) { return; }
      var start, breite, kopfImFeld = false;
      if (feld.modul === 'Projektgrundlagen' && !pgEigen) {
        if (!pgOffen.length) { return; }
        start = spalten.indexOf(pgOffen[0]);
        breite = spalten.indexOf(pgOffen[pgOffen.length - 1]) - start + 1;
        kopfImFeld = true;
      } else {
        start = spalten.indexOf(feld.modul);
        breite = 1;
      }
      if (start === -1) { return; }
      var bloecke = bloeckeFiltern(feld.bloecke, f);
      bloecke.forEach(function (b) {
        ids.aufgabe[b.aufgabe.id] = true;
        if (b.rolle) { ids.rolle[b.rolle.id] = true; }
        b.ergebnisse.forEach(function (k) {
          if (istMeilenstein(k)) { (erreicht[feld.phase] = erreicht[feld.phase] || {})[k.id] = true; }
          else { ids.ergebnis[k.id] = true; }
        });
        trefferPhasen[feld.phase] = true;
        trefferModule[feld.modul] = true;
      });
      felder.push({ feld: feld, bloecke: bloecke, start: start, breite: breite, kopfImFeld: kopfImFeld });
    });

    return {
      zeilen: zeilen,
      spalten: spalten,
      zu: zu,
      felder: felder,
      erreicht: erreicht,
      zahlen: { rolle: Object.keys(ids.rolle).length, aufgabe: Object.keys(ids.aufgabe).length, ergebnis: Object.keys(ids.ergebnis).length },
      treffer: { aufgaben: Object.keys(ids.aufgabe).length, phasen: Object.keys(trefferPhasen).length, module: Object.keys(trefferModule).length }
    };
  }

  /** Zahl der Aufgaben je Rolle im übrigen Filter — für die Rollenliste. */
  function aufgabenJeRolle(m, f) {
    var ohneRolle = { phasen: f.phasen, module: f.module, rolle: '', bezug: f.bezug, entscheide: f.entscheide };
    var aufgaben = {};
    ausschnitt(m, ohneRolle).felder.forEach(function (x) {
      x.bloecke.forEach(function (b) { aufgaben[b.aufgabe.id] = b.aufgabe; });
    });
    var zahl = {};
    HT.daten.eintraegeDerKategorie('rolle').forEach(function (r) {
      var mit = { rolle: r.begriff, bezug: f.bezug };
      zahl[r.begriff] = Object.keys(aufgaben).filter(function (id) { return bezugPasst(aufgaben[id], mit); }).length;
    });
    return zahl;
  }

  /* Folgen Felder eines Moduls mit genau denselben Aufgaben und
     Ergebnissen aufeinander (Projektführung von Konzept bis Einführung),
     steht ihr Inhalt nur einmal — in einem Feld über diese Phasen, wie
     «Phasenunabhängig» in der Abbildung 1, ohne Beschriftung (welche
     Phasen, zeigt die Höhe und der Tooltip).
     [{ x: Feld aus ausschnitt(), sig, von, bis: Zeilen, phasen }] */
  function feldGruppen(a) {
    var zeilenIndex = {};
    a.zeilen.forEach(function (z, i) { zeilenIndex[z.phase] = i; });
    var gruppen = [], letzte = {};
    a.felder.forEach(function (x) {
      var sig = x.bloecke.map(function (b) {
        return b.aufgabe.id + ':' + b.ergebnisse.map(function (k) { return k.id; }).join('+');
      }).join('|');
      var i = zeilenIndex[x.feld.phase], vor = letzte[x.feld.modul];
      if (sig && vor && vor.sig === sig && vor.bis === i - 1 && vor.x.start === x.start && vor.x.breite === x.breite) {
        vor.bis = i;
        vor.phasen.push(x.feld.phase);
        return;
      }
      gruppen.push(letzte[x.feld.modul] = { x: x, sig: sig, von: i, bis: i, phasen: [x.feld.phase] });
    });
    return gruppen;
  }

  /* --- Bauen ----------------------------------------------------------------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  /* Ein Element in der Bildsprache des Graphen: Aufgabe und Ergebnis als
     Kasten ihrer Farbe (ohne Zeichen — die Farbe sagt die Kategorie, und
     der Name hat mehr Platz), die Rolle ohne Kasten mit ihrem Zeichen. */
  function knoten(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    var kat = k.kategorie;
    var zustand = kat === 'ergebnis' && e && e.typ === 'Zustand';
    var ms = istMeilenstein(k);
    return h('button', {
      type: 'button',
      class: 'ra-k ra-k--' + kat + (zustand ? ' ra-k--zustand' : '') + (ms ? ' ra-k--meilenstein' : ''),
      dataset: { id: k.id },
      title: k.begriff
    }, [
      kat === 'rolle' ? h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 12)) : null,
      ms ? h('span', { class: 'ra-k__ikone', 'aria-hidden': 'true' }, h('span', { class: 'ra-ms__raute' })) : null,
      h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(k.begriff) })
    ]);
  }

  /* Pfeile gibt es nur, wo allein Ergebnisse stehen: Mit Rollen oder
     Aufgaben stehen Blöcke statt der Kästen der Abbildung. */
  function flussMoeglich(sicht) { return !!sicht.ergebnis && !sicht.aufgabe && !sicht.rolle; }

  function ohneMeilensteine(liste) {
    return liste.filter(function (k) { return !istMeilenstein(k); });
  }

  /* Die Ergebnisse eines Blocks im Feld: die Meilensteine nach den übrigen;
     im Fluss der Abbildung 1 ohne sie. */
  function ergebnisseImFeld(liste, fluss) {
    var ms = liste.filter(istMeilenstein);
    return fluss ? ohneMeilensteine(liste) : ohneMeilensteine(liste).concat(ms);
  }

  /* Ein Block: oben Rolle und Aufgabe, eingerückt die Ergebnisse, darunter
     ohne Einzug die Meilensteine (die Raute bündig mit dem Icon der Rolle).
     mach(k, platz) baut ein Ergebnis — platz zählt in dieser Folge. */
  function blockInhalt(kopf, ergebnisse, mach) {
    mach = mach || knoten;
    var erg = ohneMeilensteine(ergebnisse), ms = ergebnisse.filter(istMeilenstein);
    return kopf.concat([erg.length ? h('div', { class: 'ra-block__ergebnisse' }, erg.map(function (k, j) { return mach(k, j); })) : null])
      .concat(ms.map(function (k, j) { return mach(k, erg.length + j); }));
  }

  /* Der Inhalt eines Feldes nach der Sicht, als Stücke { key, el }. Mit
     Aufgaben je Aufgabe ein Block; ohne Aufgaben die Ergebnisse einzeln oder,
     bei eingeblendeten Rollen, nach der verantwortlichen Rolle gruppiert —
     jedes Element steht im Feld einmal. Der Schlüssel ist in jeder Phase
     derselbe, damit ein Stück in allen Feldern seiner Spalte an derselben
     Stelle steht (spurenLegen). haken(k, block, platz) darf mit Aufgaben ein
     Element durch ein eigenes ersetzen (die Kästen des Zuordnens). */
  function inhaltBauen(bloecke, sicht, haken) {
    var fluss = flussMoeglich(sicht) && !!sicht.pfeile;
    if (sicht.aufgabe) {
      return bloecke.map(function (b) {
        var erg = sicht.ergebnis ? ergebnisseImFeld(b.ergebnisse, fluss) : [];
        var mach = haken ? function (k, j) { return haken(k, b, j) || knoten(k); } : knoten;
        return { key: 'a:' + b.aufgabe.id, el: h('div', { class: 'ra-block' }, blockInhalt([
          sicht.rolle && b.rolle ? mach(b.rolle, 0) : null,
          mach(b.aufgabe, 0)
        ], erg, mach)) };
      });
    }
    var gruppen = [], nachRolle = {}, gesehen = {};
    bloecke.forEach(function (b) {
      var schluessel = sicht.rolle && b.rolle ? b.rolle.id : '';
      var g = nachRolle[schluessel];
      if (!g) {
        g = nachRolle[schluessel] = { rolle: sicht.rolle ? b.rolle : null, ergebnisse: [] };
        gruppen.push(g);
      }
      if (!sicht.ergebnis) { return; }
      ergebnisseImFeld(b.ergebnisse, fluss).forEach(function (k) {
        var id = schluessel + '|' + k.id;
        if (gesehen[id]) { return; }
        gesehen[id] = true;
        g.ergebnisse.push(k);
      });
    });
    var stuecke = [];
    gruppen.forEach(function (g) {
      if (!g.rolle) {
        g.ergebnisse.forEach(function (k) { stuecke.push({ key: 'e:' + k.id, el: knoten(k) }); });
        return;
      }
      stuecke.push({ key: 'r:' + g.rolle.id, el: h('div', { class: 'ra-block' }, blockInhalt([knoten(g.rolle)], g.ergebnisse)) });
    });
    return stuecke;
  }

  /* --- Spuren: dasselbe Stück in jeder Phase an derselben Stelle -------------- */

  /* Die Felder einer Spalte teilen eine Reihenfolge: jedes Stück bekommt den
     Mittelwert seiner Stellen in den Feldern, in denen es steht (die Folge der
     Abbildung 1 je Feld), Gleichstand nach dem ersten Vorkommen. So steht
     «Projekt führen und kontrollieren» in der Initialisierung nicht unten
     und ab dem Konzept oben, sondern überall an derselben Stelle der Folge. */
  /* Projektsteuerung und Projektführung haben eine feste Folge ihrer
     Aufgaben (HT.graph.folgeRang), damit jede Phase gleich aussieht: die
     Blöcke tauschen nur untereinander die Plätze, anderes bleibt stehen.
     Steht eine Aufgabe des Feldes nicht in der Folge, bleibt alles. */
  function festeFolge(stuecke, modul) {
    var plaetze = [], raenge = {};
    for (var i = 0; i < stuecke.length; i++) {
      if (stuecke[i].key.slice(0, 2) !== 'a:') { continue; }
      var e = HT.daten.eintragMitId(stuecke[i].key.slice(2));
      var r = e ? HT.graph.folgeRang(modul, e.begriff) : null;
      if (r === null || r === -1) { return; }
      raenge[stuecke[i].key] = r;
      plaetze.push(i);
    }
    var teil = plaetze.map(function (i) { return stuecke[i]; });
    teil.sort(function (u, v) { return raenge[u.key] - raenge[v.key]; });
    plaetze.forEach(function (i, j) { stuecke[i] = teil[j]; });
  }

  function spalteOrdnen(felder) {
    var summe = {}, zahl = {}, erstes = {}, n = 0;
    felder.forEach(function (f) {
      f.stuecke.forEach(function (st, i) {
        summe[st.key] = (summe[st.key] || 0) + (i + 0.5) / f.stuecke.length;
        zahl[st.key] = (zahl[st.key] || 0) + 1;
        if (!(st.key in erstes)) { erstes[st.key] = n++; }
      });
    });
    var rang = {};
    Object.keys(erstes).sort(function (x, y) {
      return summe[x] / zahl[x] - summe[y] / zahl[y] || erstes[x] - erstes[y];
    }).forEach(function (key, i) { rang[key] = i; });
    felder.forEach(function (f) {
      f.stuecke.sort(function (x, y) { return rang[x.key] - rang[y.key]; });
    });
    return Object.keys(rang).sort(function (x, y) { return rang[x] - rang[y]; });
  }

  /* Ist ein Feld breit genug für mehrere Spuren (nur ein Modul gefiltert,
     Projektgrundlagen), bekommt jedes Stück eine feste Spur — in allen
     Feldern der Spalte dieselbe. Verteilt wird der Reihe nach: jedes Stück
     in die Spur, die die Felder, in denen es steht, am wenigsten höher macht;
     bei Gleichstand in die niedrigste, dann die linke. Stücke, die nie im
     selben Feld stehen, teilen sich so eine Spur, statt Lücken zu lassen. */
  function spurenVerteilen(felder, keys, anzahl, hoehe, abstand) {
    var spurVon = {};
    var hoch = [], max = felder.map(function () { return 0; });
    for (var s = 0; s < anzahl; s++) { hoch.push(felder.map(function () { return 0; })); }
    keys.forEach(function (key) {
      var wo = [];
      felder.forEach(function (f, fi) { if (key in f.index) { wo.push(fi); } });
      var beste = 0, besteKosten = Infinity, besteLast = Infinity;
      for (var sp = 0; sp < anzahl; sp++) {
        var kosten = 0, last = 0;
        wo.forEach(function (fi) {
          var neu = hoch[sp][fi] + (hoch[sp][fi] ? abstand : 0) + hoehe(key, fi);
          kosten += Math.max(0, neu - max[fi]);
          last += hoch[sp][fi];
        });
        if (kosten < besteKosten - 0.5 || (Math.abs(kosten - besteKosten) <= 0.5 && last < besteLast)) {
          beste = sp; besteKosten = kosten; besteLast = last;
        }
      }
      spurVon[key] = beste;
      wo.forEach(function (fi) {
        hoch[beste][fi] += (hoch[beste][fi] ? abstand : 0) + hoehe(key, fi);
        max[fi] = Math.max(max[fi], hoch[beste][fi]);
      });
    });
    return spurVon;
  }

  /* Der Trichter neben Modulkopf und Phase filtert; der Name selbst zeigt
     die Seite des Moduls bzw. der Phase. */
  function trichter(art, name) {
    return h('button', { type: 'button', class: 'ra-trichter', dataset: { art: art, name: name } }, HT.ui.symbol(IKONE_FILTER, 12));
  }

  /* Ein- und Ausklappen einer Phase (Zeile) oder eines Moduls (Spalte):
     offen zeigt der Pfeil nach unten, zu nach rechts. */
  var IKONE_OFFEN = ['M6.5 9.5 12 15l5.5-5.5'];
  var IKONE_ZU = ['M9.5 6.5 15 12l-5.5 5.5'];
  function klappe(art, name, zu) {
    var was = (art === 'modul' ? 'Modul ' : 'Phase ') + name;
    return h('button', {
      type: 'button', class: 'ra-klappe', dataset: { art: art, name: name },
      title: was + (zu ? ' aufklappen' : ' zuklappen'), 'aria-label': was + (zu ? ' aufklappen' : ' zuklappen'),
      'aria-expanded': zu ? 'false' : 'true'
    }, HT.ui.symbol(zu ? IKONE_ZU : IKONE_OFFEN, 14));
  }

  /* Projektgrundlagen im Feld (über Organisation bis IT-System) hat keine
     eigene Spalte zum Zuklappen: dort ohne Klappe. */
  function modulKopf(modul, klasse, mitKlappe) {
    var e = HT.daten.eintragMitBegriff(modul, 'modul');
    return h('div', { class: 'ra-modulkopf' + (klasse ? ' ' + klasse : '') }, [
      h('button', {
        type: 'button', class: 'ra-modul',
        dataset: { id: e ? e.id : '', modul: modul }, title: 'Modul ' + modul + ' — Seite zeigen'
      }, [
        h('span', { class: 'gswatch gswatch--modul', 'aria-hidden': 'true' }, HT.ui.katSymbol('modul', 12)),
        h('span', { class: 'ra-modul__name', text: HT.gesamtbild.trennen(modul) })
      ]),
      mitKlappe ? klappe('modul', modul, false) : null,
      trichter('modul', modul)
    ]);
  }

  function meilensteinBauen(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    /* Wo der Meilenstein entsteht: Modul und Phase aus dem Block, der ihn
       erzeugt — beim Zeigen wird dieses Feld hervorgehoben. */
    return h('button', {
      type: 'button', class: 'ra-ms', dataset: { id: k.id, module: ((e && e.module) || []).join('|') },
      title: k.begriff
    }, [
      h('span', { class: 'ra-ms__raute', 'aria-hidden': 'true' }),
      h('span', { class: 'ra-ms__name', text: HT.gesamtbild.trennen(String(k.begriff).replace(/^Meilenstein\s+/, '')) })
    ]);
  }

  /* Die Farben der Phasenbalken in der Abbildung 1: Initialisierung und
     Abschluss grau, Konzept bis Einführung blau, Umsetzung (agil) rosa. */
  function phasenFarbe(phase) {
    return phase === 'Umsetzung' ? 'rosa' : phase === 'Initialisierung' || phase === 'Abschluss' ? 'grau' : 'blau';
  }

  function phaseBauen(z, gitterZeile, zu) {
    var e = HT.daten.eintragMitBegriff(z.phase, 'phase');
    var el = h('div', { class: 'ra-phase' + (zu ? ' ist-zu' : ''), dataset: { phase: z.phase, farbe: phasenFarbe(z.phase) } }, [
      h('div', { class: 'ra-phase__streifen' }, [
        klappe('phase', z.phase, zu),
        h('button', {
          type: 'button', class: 'ra-phase__name', dataset: { id: e ? e.id : '' }, title: 'Phase ' + z.phase + ' — Seite zeigen'
        }, h('span', { text: z.phase })),
        trichter('phase', z.phase)
      ]),
      h('div', { class: 'ra-phase__ms' }, LAGEN.map(function (lage) {
        var liste = z.meilensteine[lage].slice();
        /* Am Ende steht die Freigabe der nächsten Phase auf der Phasenlinie,
           der Projektabschluss (Abbruch) als Alternative darüber. */
        if (lage === 'ende' && liste.length > 1) {
          liste.sort(function (u, v) { return (v.begriff === 'Meilenstein Projektabschluss') - (u.begriff === 'Meilenstein Projektabschluss'); });
        }
        return h('div', { class: 'ra-ms-gruppe', dataset: { lage: lage } }, liste.map(meilensteinBauen));
      }))
    ]);
    el.style.gridRow = String(gitterZeile);
    return el;
  }

  /**
   * Das Raster für einen Ausschnitt (siehe ausschnitt()).
   * aktionen: { modul(name), phase(name) } — Trichter an Modulkopf bzw. Phase;
   *   waehlen(id) — Klick auf ein Element, einen Modulkopf, eine Phase;
   *   feld(phase, modul) — Klick auf die freie Fläche eines Feldes.
   * uebung (Zuordnen, HT.raster.uebung): { knoten(k, ort) } ersetzt ein
   *   Element durch einen eigenen Kasten; ort = { phasen, modul, block, platz }.
   */
  function aufbauen(m, a, sicht, f, aktionen, uebung) {
    var buehne = h('div', { class: 'ra-buehne' });
    if (!a.zeilen.length || !a.spalten.length) {
      buehne.appendChild(h('p', { class: 'ra-leer', text: 'Keine Phase oder kein Modul gewählt — im Filter wieder alle einschalten.' }));
      var nichts = function () { return false; };
      return { buehne: buehne, spurenLegen: nichts, zeigen: nichts, gewaehlt: nichts, stelleZeigen: nichts, tour: nichts, pfeilZahl: function () { return 0; }, feldPhasen: function (p) { return [p]; } };
    }
    var gitter = h('div', { class: 'ra-gitter', dataset: { vorgehen: m.vorgehen } });
    /* Fluss wie in der Abbildung 1 (Knopf «Pfeile», nur mit Ergebnissen
       allein): Es stehen die Kästen der Abbildung, die übrigen Ergebnisse
       eines Feldes sind unter «+N» eingeklappt, und die Pfeile gehen kurz
       von Kasten zu Kasten. */
    var fluss = flussMoeglich(sicht) && !!sicht.pfeile;
    gitter.classList.toggle('ist-fluss', fluss);
    gitter.classList.toggle('ist-uebung', !!uebung);
    /* Zugeklappt: eine Spalte schmal, eine Zeile niedrig. */
    function spalteZu(s) { return a.zu.module.indexOf(s) !== -1; }
    function zeileZu(z) { return a.zu.phasen.indexOf(z.phase) !== -1; }
    gitter.style.gridTemplateColumns = 'var(--ra-band) ' + a.spalten.map(function (s) {
      return spalteZu(s) ? 'var(--ra-zu-breite)' : 'minmax(var(--ra-spalte-min), ' + (GEWICHT[s] || 1) + 'fr)';
    }).join(' ');
    gitter.style.gridTemplateRows = 'auto ' + a.zeilen.map(function (z) {
      return zeileZu(z) ? 'var(--ra-zu-hoehe)' : 'minmax(96px, auto)';
    }).join(' ');
    gitter.classList.toggle('hat-filter', trefferFilter(f));

    function trichterSetzen(knopf, liste, name, art) {
      var titel = liste && liste.length === 1 && liste[0] === name
        ? 'Wieder alle ' + (art === 'modul' ? 'Module' : 'Phasen') + ' zeigen'
        : (art === 'modul' ? 'Modul ' : 'Phase ') + name + ' ' + (liste ? 'dazu- oder wegnehmen' : 'allein zeigen');
      knopf.title = titel;
      knopf.setAttribute('aria-label', 'Filter: ' + titel);
      knopf.classList.toggle('ist-aktiv', !!liste && liste.indexOf(name) !== -1);
    }

    /* Kopfzeile: Ecke und die Modulköpfe. Projektgrundlagen hat nur eine
       eigene Spalte, wenn keine seiner drei gezeigt ist; sonst steht sein
       Kopf in seinem Feld. */
    gitter.appendChild(h('div', { class: 'ra-ecke' }, [
      h('span', { class: 'ra-ecke__text', text: 'Phase · Meilensteine' })
    ]));
    a.spalten.forEach(function (s, i) {
      if (spalteZu(s)) {
        /* Zugeklappt: oben die Klappe, darunter über alle Zeilen der Name
           senkrecht — ein Klick darauf klappt wieder auf. */
        var zuKopf = h('div', { class: 'ra-modulkopf ra-modulkopf--kopf ist-zu' }, klappe('modul', s, true));
        zuKopf.style.gridColumn = String(i + 2);
        zuKopf.style.gridRow = '1';
        gitter.appendChild(zuKopf);
        var streifen = h('button', {
          type: 'button', class: 'ra-zuspalte', dataset: { art: 'modul', name: s },
          title: 'Modul ' + s + ' aufklappen'
        }, h('span', { class: 'ra-zuspalte__name', text: s }));
        streifen.style.gridColumn = String(i + 2);
        streifen.style.gridRow = '2 / span ' + a.zeilen.length;
        gitter.appendChild(streifen);
        return;
      }
      var kopf = modulKopf(s, 'ra-modulkopf--kopf', true);
      trichterSetzen(kopf.querySelector('.ra-trichter'), f.module, s, 'modul');
      kopf.style.gridColumn = String(i + 2);
      kopf.style.gridRow = '1';
      gitter.appendChild(kopf);
    });

    /* Zeilen: Bahn über die ganze Breite, Phasenband, Felder. */
    var zeileVon = {};
    a.zeilen.forEach(function (z, i) {
      var zeile = i + 2;
      zeileVon[z.phase] = zeile;
      var bahn = h('div', { class: 'ra-bahn' + (i % 2 ? ' ra-bahn--zwei' : ''), dataset: { phase: z.phase } });
      bahn.style.gridRow = String(zeile);
      bahn.style.gridColumn = '1 / -1';
      gitter.appendChild(bahn);
      var band = phaseBauen(z, zeile, zeileZu(z));
      /* Die Meilensteine am Ende ragen in die nächste Phase: jedes Band liegt
         über dem folgenden. */
      band.style.zIndex = String(2 + a.zeilen.length - i);
      trichterSetzen(band.querySelector('.ra-trichter'), f.phasen, z.phase, 'phase');
      /* Meilensteine, die der Filter nicht erreicht, treten zurück: bei Rolle
         oder Entscheiden die, die keine gefilterte Aufgabe erzeugt; bei
         gewählten Modulen die aus den übrigen. */
      Array.prototype.forEach.call(band.querySelectorAll('.ra-ms'), function (ms) {
        var module = ms.dataset.module ? ms.dataset.module.split('|') : [];
        var blass = (trefferFilter(f) && !(a.erreicht[z.phase] && a.erreicht[z.phase][ms.dataset.id]))
          || (!!f.module && !module.some(function (x) { return f.module.indexOf(x) !== -1; }));
        ms.classList.toggle('ist-blass', blass);
      });
      gitter.appendChild(band);
    });

    var gruppen = feldGruppen(a);

    /* Je Spalte (Modul) ihre Felder; die Stücke darin in der gemeinsamen
       Reihenfolge, auf Spuren verteilt erst, wenn die Breite bekannt ist. */
    var spalten = {}, spaltenReihe = [];
    var yVon = new global.Map();   // Stück-Element → Höhe in der Abbildung 1
    var xVon = new global.Map();   // … und Lage von links (nur im Fluss)
    var xJeModul = {};             // Modul → Lagen seiner Kästen von links

    /* Unterspalten eines Moduls in der Abbildung: die Lagen seiner Kästen
       von links, zu Gruppen zusammengefasst (Organisation, IT-System und
       IT-Betrieb haben zwei, Projektgrundlagen vier, die übrigen eine). */
    var unterspaltenCache = {};
    function unterspalten(modul) {
      if (unterspaltenCache[modul]) { return unterspaltenCache[modul]; }
      var xs = (xJeModul[modul] || []).slice().sort(function (u, v) { return u - v; });
      var gruppen = [];
      xs.forEach(function (x) {
        var g = gruppen[gruppen.length - 1];
        if (g && x - g.von <= UNTERSPALTE_TOLERANZ) { g.summe += x; g.zahl++; }
        else { gruppen.push({ von: x, summe: x, zahl: 1 }); }
      });
      var mitten = gruppen.map(function (g) { return g.summe / g.zahl; });
      return (unterspaltenCache[modul] = { n: Math.max(1, mitten.length), mitten: mitten });
    }
    gruppen.forEach(function (gr) {
      var x = gr.x, mehr = gr.phasen.length > 1;
      var leer = !x.bloecke.length;
      var stuecke = leer ? [] : inhaltBauen(x.bloecke, sicht, uebung ? function (k, b, j) {
        return uebung.knoten(k, { phasen: gr.phasen, modul: x.feld.modul, block: b, platz: j });
      } : null);
      var inhalt = leer ? null : h('div', { class: 'ra-feld__inhalt' + (!sicht.aufgabe && !sicht.rolle ? ' ra-feld__inhalt--liste' : '') });
      var weitere = fluss ? flussMarkieren(stuecke, gr.phasen, x.feld.modul) : 0;
      var el = h('div', {
        class: 'ra-feld' + (x.breite > 1 ? ' ra-feld--breit' : '') + (leer ? ' ra-feld--leer' : '') + (mehr ? ' ra-feld--phasen' : ''),
        dataset: { phase: x.feld.phase, phasen: gr.phasen.join(' '), modul: x.feld.modul },
        title: mehr ? gr.phasen[0] + ' bis ' + gr.phasen[gr.phasen.length - 1] : null
      }, [
        x.kopfImFeld ? modulKopf(x.feld.modul, 'ra-modulkopf--feld') : null,
        inhalt,
        weitere ? h('button', {
          type: 'button', class: 'ra-feld__mehr', 'aria-expanded': 'false',
          title: weitere + (weitere === 1 ? ' weiteres Ergebnis' : ' weitere Ergebnisse') + ' ohne Kasten in Abbildung 1 — aufklappen',
          text: '+' + weitere
        }) : null
      ]);
      if (inhalt) {
        var sp = spalten[x.feld.modul];
        if (!sp) { sp = spalten[x.feld.modul] = { modul: x.feld.modul, breit: x.breite > 1, felder: [], anzahl: 0 }; spaltenReihe.push(sp); }
        var index = {};
        stuecke.forEach(function (st) { index[st.key] = st; });
        if (!mehr) { hoehenSetzen(x, stuecke); }
        sp.felder.push({ inhalt: inhalt, stuecke: stuecke, index: index, zeile: gr.von, mehr: mehr });
      }
      el.style.gridRow = (gr.von + 2) + ' / span ' + (gr.bis - gr.von + 1);
      el.style.gridColumn = (x.start + 2) + ' / span ' + x.breite;
      gitter.appendChild(el);
    });

    /* Im Fluss: Ergebnisse ohne Kasten in der Abbildung (in einer der Phasen
       des Feldes, auch im Sammelkasten «Phasenunabhängig») werden
       eingeklappt; die übrigen merken sich die Lage ihres Kastens. Gibt die
       Zahl der eingeklappten zurück. */
    function flussMarkieren(stuecke, phasen, modul) {
      var zahl = 0;
      stuecke.forEach(function (st) {
        var id = st.key.slice(2), lage = null;
        for (var i = 0; i < phasen.length && !lage; i++) { lage = HT.graph.abbildungLage(id, phasen[i], modul); }
        if (lage) {
          xVon.set(st.el, lage.x);
          (xJeModul[modul] = xJeModul[modul] || []).push(lage.x);
          return;
        }
        st.weiter = true;
        st.el.classList.add('ra-k--weiter');
        zahl++;
      });
      return zahl;
    }

    /* Die Höhe eines Stücks in der Abbildung 1: die seines Kastens in diesem
       Feld; ein Ergebnis ohne Kasten übernimmt die eines Ergebnisses derselben
       Aufgabe (es entsteht zur selben Zeit), ein Block die früheste seiner
       Ergebnisse. Ohne Höhe (null) steht das Stück unten. */
    function hoehenSetzen(x, stuecke) {
      var eigen = {}, erg = {}, jeAufgabe = {}, jeRolle = {};
      function min(u, v) { return u === null ? v : v === null ? u : Math.min(u, v); }
      x.bloecke.forEach(function (b) {
        var by = null;
        ohneMeilensteine(b.ergebnisse).forEach(function (k) {
          if (!(k.id in eigen)) { eigen[k.id] = HT.graph.abbildungY(k.id, x.feld.phase, x.feld.modul); }
          by = min(by, eigen[k.id]);
        });
        jeAufgabe[b.aufgabe.id] = by;
        if (b.rolle) { jeRolle[b.rolle.id] = min(jeRolle[b.rolle.id] === undefined ? null : jeRolle[b.rolle.id], by); }
        ohneMeilensteine(b.ergebnisse).forEach(function (k) {
          erg[k.id] = eigen[k.id];
        });
      });
      stuecke.forEach(function (st) {
        var art = st.key.charAt(0), id = st.key.slice(2);
        var y = art === 'e' ? erg[id] : art === 'a' ? jeAufgabe[id] : jeRolle[id];
        yVon.set(st.el, y === undefined ? null : y);
      });
    }

    /* Ohne Pfeile steht dieselbe Aufgabe (ohne Aufgaben: dasselbe Ergebnis)
       in allen Spalten einer Phase auf der Höhe ihres frühesten Vorkommens
       in der Abbildung — so hat sie überall denselben Platz in der Folge,
       und angleichen() kann sie quer auf eine Höhe setzen («Prototyping
       durchführen» in Produkt und IT-System). */
    var gemeinsam = {};   // Zeile → Schlüssel → Zahl der Felder
    if (!fluss) {
      var frueh = {};
      spaltenReihe.forEach(function (sp) {
        sp.felder.forEach(function (f) {
          f.stuecke.forEach(function (st) {
            if (!/^[ae]:/.test(st.key)) { return; }
            var g = gemeinsam[f.zeile] = gemeinsam[f.zeile] || {}, fr = frueh[f.zeile] = frueh[f.zeile] || {};
            g[st.key] = (g[st.key] || 0) + 1;
            var y = yVon.get(st.el);
            if (y !== null && y !== undefined && !(fr[st.key] <= y)) { fr[st.key] = y; }
          });
        });
      });
      spaltenReihe.forEach(function (sp) {
        sp.felder.forEach(function (f) {
          f.stuecke.forEach(function (st) {
            if (gemeinsam[f.zeile] && gemeinsam[f.zeile][st.key] > 1 && frueh[f.zeile][st.key] !== undefined) {
              yVon.set(st.el, frueh[f.zeile][st.key]);
            }
          });
        });
      });
    }
    function geteilt(zeile, key) { return !!gemeinsam[zeile] && gemeinsam[zeile][key] > 1; }

    /* Alle Spalten teilen ihre Reihenfolge über die Phasen; innerhalb eines
       Feldes geht die Lage in der Abbildung 1 vor: was später entsteht,
       steht weiter unten. Geteilte Stücke gleicher Höhe nach dem Schlüssel,
       damit sie in jeder Spalte gleich folgen. */
    spaltenReihe.forEach(function (sp) {
      sp.keys = spalteOrdnen(sp.felder);
      sp.felder.forEach(function (f) {
        f.stuecke.sort(function (u, v) {
          var yu = yVon.get(u.el), yv = yVon.get(v.el);
          yu = yu === null || yu === undefined ? Infinity : yu;
          yv = yv === null || yv === undefined ? Infinity : yv;
          if (yu === yv && geteilt(f.zeile, u.key) && geteilt(f.zeile, v.key)) { return u.key < v.key ? -1 : u.key > v.key ? 1 : 0; }
          return yu - yv || 0;
        });
        festeFolge(f.stuecke, sp.modul);
        spurenFuellen(f, 1, null);
      });
      sp.anzahl = 1;
    });

    /* Im Fluss ist jede Spalte so breit wie ihre Unterspalten fester Kästen. */
    if (fluss) {
      gitter.style.gridTemplateColumns = 'var(--ra-band) ' + a.spalten.map(function (s) {
        if (spalteZu(s)) { return 'var(--ra-zu-breite)'; }
        var n = unterspalten(s).n;
        return 'minmax(' + (n * KASTEN + (n - 1) * KASTEN_LUECKE + FELD_RAND) + 'px, ' + n + 'fr)';
      }).join(' ');
    }

    buehne.appendChild(gitter);

    /* --- Pfeile der Abbildung 1 ---
       Eine SVG-Ebene über den Feldern. Die Linien laufen nur in den Fugen —
       senkrecht zwischen den Spalten bzw. Spuren, waagrecht an der Grenze
       zwischen den Phasen — und treten seitlich in den Kasten ein; so bleiben
       die Kästen, wie sie sind, und nichts wird verdeckt. Wo Linien dieselbe
       Fuge nehmen, laufen sie zusammen wie die Sammelschienen der Grafik. */
    var ebene = svgEl('svg', { class: 'ra-pfeile', 'aria-hidden': 'true' });
    var defs = ebene.appendChild(svgEl('defs', {}));
    ['ra-spitze', 'ra-spitze-an'].forEach(function (id) {
      var marker = defs.appendChild(svgEl('marker', {
        id: id, viewBox: '0 0 8 8', refX: '7.4', refY: '4', markerWidth: '8', markerHeight: '8',
        markerUnits: 'userSpaceOnUse', orient: 'auto'
      }));
      marker.appendChild(svgEl('path', { d: 'M1.2 .9 7.2 4 1.2 7.1', class: 'ra-spitze' }));
    });
    gitter.appendChild(ebene);
    var pfeile = [];

    function rahmen(el, g) {
      var r = el.getBoundingClientRect();
      return { l: r.left - g.left, r: r.right - g.left, t: r.top - g.top, b: r.bottom - g.top };
    }

    /* Das Vorkommen eines Endes im Raster: im Feld des genannten Moduls, sonst
       das erste in der Phase; je Feld nur das kräftige (nicht wiederholte). */
    function endeFinden(ende) {
      var phase = m.vorgehen === 'agil' ? (AGIL_PHASE[ende[0]] || ende[0]) : ende[0];
      var e = HT.daten.eintragMitBegriff(ende[2], 'ergebnis');
      if (!e) { return null; }
      var treffer = gitter.querySelectorAll('.ra-feld[data-phasen~="' + phase + '"] .ra-k--ergebnis[data-id="' + e.id + '"]:not(.ra-k--wieder)');
      var el = null;
      for (var i = 0; i < treffer.length && !el; i++) {
        if (treffer[i].closest('.ra-feld').dataset.modul === ende[1]) { el = treffer[i]; }
      }
      el = el || treffer[0];
      return el ? { el: el, phase: phase } : null;
    }

    /* Senkrechte Fuge rechts oder links eines Kastens: zwischen zwei Spuren
       deren Mitte, am Rand des Feldes die Mitte
       zum Nachbarfeld. */
    function fuge(el, seite, g) {
      var feld = el.closest('.ra-feld'), inhalt = el.closest('.ra-feld__inhalt');
      var sp = rahmen(el.closest('.ra-spur'), g);
      var inn = rahmen(inhalt, g), f = rahmen(feld, g);
      var halb = feld.classList.contains('ra-feld--breit') ? 3 : 4;
      if (seite === 'r') { return sp.r < inn.r - 2 ? sp.r + halb : f.r + 2; }
      return sp.l > inn.l + 2 ? sp.l - halb : f.l - 2;
    }

    /* Wie in der Abbildung: Die Pfeile gehen von der Unterkante der Quelle
       senkrecht hinunter, in der Gasse über dem Ziel quer und von oben
       hinein; stehen Quelle und Ziel übereinander, ist es ein kurzer
       gerader Strich. Pfeile aus derselben Quelle oder in dasselbe Ziel
       teilen sich die Strecke, so entstehen die Sammelschienen der Grafik.
       Stehen Quelle und Ziel nebeneinander, geht der Pfeil waagrecht von
       Kasten zu Kasten. Nur wenn unter der Quelle ein Kasten im Weg steht,
       verlässt der Pfeil sie seitlich und läuft in der Fuge daneben. */
    function pfeileLegen() {
      pfeile.forEach(function (p) { ebene.removeChild(p.el); });
      pfeile = [];
      if (!fluss) { return; }
      var g = gitter.getBoundingClientRect();
      ebene.setAttribute('width', String(Math.ceil(g.width)));
      ebene.setAttribute('height', String(Math.ceil(g.height)));
      var hindernisse = Array.prototype.filter.call(gitter.querySelectorAll('.ra-k, .ra-feld__mehr'), function (el) {
        return el.offsetParent !== null;
      }).map(function (el) { return { el: el, r: rahmen(el, g) }; });
      /* Ist die Senkrechte bei x von y1 bis y2 frei (ausser Quelle und Ziel)? */
      function frei(x, y1, y2, s, t) {
        return !hindernisse.some(function (o) {
          return o.el !== s && o.el !== t && x > o.r.l - 3 && x < o.r.r + 3 && o.r.b > y1 + 1 && o.r.t < y2 - 1;
        });
      }
      var paare = [], aus = new global.Map();
      PFEILE.forEach(function (pf) {
        var von = endeFinden(pf.von), nach = endeFinden(pf.nach);
        if (!von || !nach || von.el === nach.el) { return; }
        var s = von.el, t = nach.el;
        if (s.offsetParent === null || t.offsetParent === null) { return; }
        if (paare.some(function (p) { return p.s === s && p.t === t; })) { return; }
        paare.push({ s: s, t: t });
        aus.set(s, (aus.get(s) || 0) + 1);
      });
      paare.forEach(function (paar) {
        var s = paar.s, t = paar.t;
        var S = rahmen(s, g), T = rahmen(t, g);
        var sx = Math.round((S.l + S.r) / 2), tx = Math.round((T.l + T.r) / 2);
        var d;
        if (T.t < S.b - 1 && T.b > S.t + 1) {
          /* Nebeneinander: waagrecht in der Mitte der gemeinsamen Höhe. */
          var y = Math.round((Math.max(S.t, T.t) + Math.min(S.b, T.b)) / 2);
          if (T.l >= S.r) { d = 'M' + S.r + ' ' + y + 'H' + T.l; }
          else if (T.r <= S.l) { d = 'M' + S.l + ' ' + y + 'H' + T.r; }
          else { return; }
        } else {
          /* Wie die Sammelschienen der Abbildung: Verzweigt die Quelle, quer
             in der Gasse gleich unter ihr, sonst in der Gasse über dem Ziel —
             so laufen mehrere Pfeile in ein Ziel auf einer Schiene zusammen. */
          var stufen = [];
          var gasse = gasseVon.get(t);
          var unter = gassenVon.get(s.closest('.ra-feld__inhalt'));
          if (unter) {
            var oben0 = rahmen(s.closest('.ra-feld__inhalt'), g).t;
            var y0 = null;
            unter.forEach(function (dy) { var y = Math.round(oben0 + dy); if (y > S.b + 2 && y < T.t && (y0 === null || y < y0)) { y0 = y; } });
            if (y0 !== null) { stufen.push(y0); }
          }
          if (gasse) {
            var y1 = Math.round(rahmen(gasse.inhalt, g).t + gasse.dy);
            if (y1 > S.b + 2 && y1 < T.t && stufen.indexOf(y1) === -1) {
              if (aus.get(s) > 1) { stufen.push(y1); } else { stufen.unshift(y1); }
            }
          }
          if (!stufen.length) { stufen.push(Math.round(T.t > S.b ? (S.b + T.t) / 2 : T.t - GASSE / 2)); }
          /* Von oben ins Ziel; steht darüber noch ein Kasten, seitlich. */
          function ende(gy) {
            if (frei(tx, gy, T.t, s, t)) { return 'H' + tx + 'V' + T.t; }
            /* Im breiten Feld von aussen, sonst von der Seite der Quelle:
               die Fugen zwischen den Spuren tragen schon die waagrechten
               Pfeile der Nachbarn. */
            var inn = rahmen(t.closest('.ra-feld__inhalt'), g);
            var aussenL = T.l <= inn.l + 2, aussenR = T.r >= inn.r - 2;
            var vonLinks = aussenL !== aussenR ? aussenL : sx <= tx;
            return 'H' + fuge(t, vonLinks ? 'l' : 'r', g) + 'V' + Math.round((T.t + T.b) / 2) + 'H' + (vonLinks ? T.l : T.r);
          }
          if (T.t > S.b && Math.abs(sx - tx) < 2 && frei(sx, S.b, T.t, s, t)) {
            d = 'M' + tx + ' ' + S.b + 'V' + T.t;
          } else {
            /* Die erste Gasse, in die die Quelle frei hinunterkommt und aus
               der das Ziel von oben erreichbar ist; sonst die erste, in die
               sie kommt; sonst seitlich aus der Quelle. */
            var gut = null, erreichbar = null;
            stufen.forEach(function (gy) {
              if (T.t <= S.b || !frei(sx, S.b, gy, s, t)) { return; }
              if (erreichbar === null) { erreichbar = gy; }
              if (gut === null && frei(tx, gy, T.t, s, t)) { gut = gy; }
            });
            var wahl = gut !== null ? gut : erreichbar;
            if (wahl !== null) {
              d = 'M' + sx + ' ' + S.b + 'V' + wahl + ende(wahl);
            } else {
              var gy = stufen[stufen.length - 1];
              var rechts = tx >= sx;
              var fx = fuge(s, rechts ? 'r' : 'l', g);
              d = 'M' + (rechts ? S.r : S.l) + ' ' + Math.round((S.t + S.b) / 2) + 'H' + fx + 'V' + gy + ende(gy);
            }
          }
        }
        var el = svgEl('path', { class: 'ra-pfeil', d: d, 'data-von': s.dataset.id, 'data-nach': t.dataset.id });
        ebene.appendChild(el);
        pfeile.push({ s: s, t: t, el: el });
      });
      pfeileHervorheben('ist-an', angezeigtId);
      pfeileHervorheben('ist-gewaehlt', gewaehltId);
      pfeileTour();
    }

    /* Die Pfeile eines Ergebnisses (an allen seinen Stellen) treten hervor,
       die Kästen am anderen Ende bleiben kräftig. Hervorgehobene nach oben. */
    var angezeigtId = null, gewaehltId = null;
    function pfeileHervorheben(klasse, id) {
      var verbunden = klasse === 'ist-an' ? 'ist-verbunden' : 'ist-verbunden-gewaehlt';
      Array.prototype.forEach.call(gitter.querySelectorAll('.' + verbunden), function (x) { x.classList.remove(verbunden); });
      var treffer = 0;
      pfeile.forEach(function (p) {
        var an = !!id && (p.s.dataset.id === id || p.t.dataset.id === id);
        p.el.classList.toggle(klasse, an);
        if (!an) { return; }
        treffer++;
        p.s.classList.add(verbunden);
        p.t.classList.add(verbunden);
        ebene.appendChild(p.el);
      });
      if (klasse === 'ist-an') { ebene.classList.toggle('hat-an', treffer > 0); }
    }

    /* Rundgang (js/rundgang.js): Die Stellen eines Schritts treten hervor,
       alles andere zurück. ziel: { ids, felder: [[phase, modul]], phasen,
       module } — Elemente und Felder mit Ring, Phasen und Module ohne (sie
       bleiben nur kräftig). Die Pfeile an einem hervorgehobenen Element
       werden rot, die übrigen im Fokus bleiben grau. */
    var tourZiel = null;
    function tourSetzen(z, hinrollen) {
      tourZiel = z || null;
      ['ist-tour', 'ist-tour-bereich', 'ist-tour-nachbar'].forEach(function (c) {
        Array.prototype.forEach.call(gitter.querySelectorAll('.' + c), function (x) { x.classList.remove(c); });
      });
      Array.prototype.forEach.call(gitter.querySelectorAll('[data-tour-nr]'), function (x) { x.removeAttribute('data-tour-nr'); });
      gitter.classList.toggle('hat-tour', !!tourZiel);
      if (tourZiel) {
        (tourZiel.ids || []).forEach(function (id) {
          Array.prototype.forEach.call(gitter.querySelectorAll('.ra-k[data-id="' + id + '"], .ra-ms[data-id="' + id + '"]'), function (x) {
            x.classList.add('ist-tour');
            if (x.classList.contains('ra-k--weiter')) { weitereZeigen(x.closest('.ra-feld'), true); }
          });
        });
        /* Schritte einer Reihenfolge: die Nummer am Kasten (nummern: { id: n }).
           Steht die Aufgabe in mehreren Phasen, trägt die früheste die Nummer,
           die späteren «n↻» — dieselbe Aufgabe, bei Bedarf wiederholt. */
        Object.keys(tourZiel.nummern || {}).forEach(function (id) {
          var kaesten = Array.prototype.slice.call(gitter.querySelectorAll('.ra-k[data-id="' + id + '"]'));
          var zeile = function (x) { var fd = x.closest('.ra-feld'); return fd ? zeileVon[fd.dataset.phase] || 0 : 0; };
          var erste = Math.min.apply(null, kaesten.map(zeile));
          kaesten.forEach(function (x) {
            x.setAttribute('data-tour-nr', tourZiel.nummern[id] + (zeile(x) > erste ? '↻' : ''));
          });
        });
        (tourZiel.felder || []).forEach(function (fm) {
          var el = gitter.querySelector('.ra-feld[data-phasen~="' + fm[0] + '"][data-modul="' + fm[1] + '"]');
          if (el) { el.classList.add('ist-tour'); }
        });
        (tourZiel.phasen || []).forEach(function (p) {
          Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-phasen~="' + p + '"], .ra-phase[data-phase="' + p + '"]'), function (x) {
            x.classList.add('ist-tour-bereich');
          });
        });
        (tourZiel.module || []).forEach(function (modul) {
          Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-modul="' + modul + '"]'), function (x) { x.classList.add('ist-tour-bereich'); });
          Array.prototype.forEach.call(gitter.querySelectorAll('.ra-modul[data-modul="' + modul + '"]'), function (x) { x.classList.add('ist-tour'); });
        });
      }
      pfeileTour();
      if (hinrollen) { zumZiel(); }
    }

    function imFokus(el) {
      return el.classList.contains('ist-tour') || !!el.closest('.ra-feld.ist-tour, .ra-feld.ist-tour-bereich');
    }

    function pfeileTour() {
      ebene.classList.toggle('hat-tour', !!tourZiel);
      pfeile.forEach(function (p) {
        var s = !!tourZiel && p.s.classList.contains('ist-tour'), t = !!tourZiel && p.t.classList.contains('ist-tour');
        p.el.classList.toggle('ist-tour', s || t);
        p.el.classList.toggle('ist-tour-bereich', !!tourZiel && imFokus(p.s) && imFokus(p.t));
        if (s || t) {
          (s ? p.t : p.s).classList.add('ist-tour-nachbar');
          ebene.appendChild(p.el);
        }
      });
    }

    /* Die hervorgehobenen Stellen ins Bild rollen: passen sie, mittig unter
       die Kopfzeile, sonst ihr Anfang oben; ohne Ziel an den Anfang. */
    function zumZiel() {
      var els = tourZiel ? gitter.querySelectorAll('.ra-k.ist-tour, .ra-ms.ist-tour, .ra-feld.ist-tour, .ra-feld.ist-tour-bereich') : [];
      var o = Infinity, u = -Infinity, l = Infinity, r = -Infinity;
      Array.prototype.forEach.call(els, function (el) {
        if (el.offsetParent === null) { return; }
        var q = el.getBoundingClientRect();
        o = Math.min(o, q.top); u = Math.max(u, q.bottom); l = Math.min(l, q.left); r = Math.max(r, q.right);
      });
      if (o === Infinity) { buehne.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); return; }
      var b = buehne.getBoundingClientRect(), ecke = gitter.querySelector('.ra-ecke');
      function lage(anfang, ende, scroll, start, groesse, rand) {
        var a = anfang - start + scroll - rand, platz = groesse - rand, hoch = ende - anfang;
        return Math.max(0, Math.round(hoch <= platz - 24 ? a - (platz - hoch) / 2 : a - 12));
      }
      buehne.scrollTo({
        top: lage(o, u, buehne.scrollTop, b.top, buehne.clientHeight, ecke ? ecke.offsetHeight : 0),
        left: lage(l, r, buehne.scrollLeft, b.left, buehne.clientWidth, ecke ? ecke.offsetWidth : 0),
        behavior: 'smooth'
      });
    }

    if (global.ResizeObserver) {
      var beobachtet = null;
      var beobachter = new global.ResizeObserver(function () {
        if (!document.body.contains(gitter)) { beobachter.disconnect(); return; }
        var g = gitter.getBoundingClientRect(), masse = Math.round(g.width) + 'x' + Math.round(g.height);
        if (masse === beobachtet) { return; }
        beobachtet = masse;
        pfeileLegen();
      });
      beobachter.observe(gitter);
    }

    /* Steht ein Ergebnis im Feld unter mehreren Aufgaben (der
       Projektmanagementplan im Konzept unter sechs), bleibt das erste
       Vorkommen kräftig, die weiteren treten zurück. Erstes heisst: wie man
       liest — Spur für Spur von links, darin von oben. */
    function wiederholungenDaempfen(f) {
      var gesehen = {};
      Array.prototype.forEach.call(f.inhalt.querySelectorAll('.ra-k--ergebnis'), function (k) {
        if (!k.dataset.id) { return; }
        k.classList.toggle('ra-k--wieder', !!gesehen[k.dataset.id]);
        gesehen[k.dataset.id] = true;
      });
    }

    /* Im Fluss steht jeder Kasten in der Unterspalte, in der er in der
       Abbildung steht — in allen Phasen des Moduls dieselbe, so gehen die
       Pfeile gerade hinunter. Eingeklappte der Reihe nach. */
    function flussSpuren(f, anzahl, modul) {
      var spurVon = {}, i = 0, u = unterspalten(modul);
      f.stuecke.forEach(function (st) {
        if (st.weiter) { spurVon[st.key] = i++ % anzahl; return; }
        var x = xVon.get(st.el) || 0, beste = 0;
        u.mitten.forEach(function (m, j) { if (Math.abs(m - x) < Math.abs(u.mitten[beste] - x)) { beste = j; } });
        spurVon[st.key] = u.n === anzahl || u.n < 2 ? Math.min(beste, anzahl - 1) : Math.round(beste / (u.n - 1) * (anzahl - 1));
      });
      return spurVon;
    }

    function spurenFuellen(f, anzahl, spurVon) {
      HT.ui.leeren(f.inhalt);
      var spuren = [];
      for (var i = 0; i < anzahl; i++) { spuren.push(f.inhalt.appendChild(h('div', { class: 'ra-spur' }))); }
      f.stuecke.forEach(function (st) { spuren[spurVon ? spurVon[st.key] : 0].appendChild(st.el); });
      wiederholungenDaempfen(f);
    }

    /* Wie viele Spuren passen, folgt der Breite der Spalte (wie column-width:
       190 px, im breiten Feld 100 px). Neu verteilt wird nur, wo sich die
       Zahl ändert; die Höhen misst eine Spur in der Zielbreite. Erst alles
       lesen, dann alles schreiben — sonst rechnet der Browser das Layout für
       jede Spalte neu. */
    /* Die grossen Meilensteine am Ende einer Phase stehen auf der Linie zur
       nächsten, wie die Rauten der Abbildung: die Mitte des letzten auf der
       Linie. Das Band hält darüber Platz frei, das nächste darunter.
       Ist die nächste Phase zugeklappt, hat ihre Zeile keinen Platz dafür:
       dann stehen sie ganz in ihrer Phase, der Name des untersten bündig
       mit dem Ende des Phasenbalkens. */
    function meilensteineLegen() {
      var ueberhang = 0;
      var baender = gitter.querySelectorAll('.ra-phase');
      Array.prototype.forEach.call(baender, function (band, i) {
        var ms = band.querySelector('.ra-phase__ms');
        var ende = ms.querySelector('.ra-ms-gruppe[data-lage="ende"]');
        ms.style.paddingTop = (ueberhang ? ueberhang + 8 : 8) + 'px';
        ueberhang = 0;
        if (!ende || !ende.lastElementChild) { return; }
        var naechstes = baender[i + 1];
        if (naechstes && naechstes.classList.contains('ist-zu')) {
          /* Der Knopf hat 2 px Innenabstand: so schliesst der Name ab. */
          ende.style.transform = 'translateY(2px)';
          ms.style.paddingBottom = (ende.offsetHeight + 10) + 'px';
          return;
        }
        var halb = ende.lastElementChild.offsetHeight / 2;
        ende.style.transform = 'translateY(' + (halb + PHASEN_LUECKE / 2) + 'px)';
        ms.style.paddingBottom = (ende.offsetHeight - halb + 10) + 'px';
        ueberhang = Math.max(0, halb - PHASEN_LUECKE / 2);
      });
    }

    function spurenLegen(zusatz) {
      meilensteineLegen();
      /* Die Breiten hängen nur an den gezeigten Spalten, der Fensterbreite
         und der Breite der Inhaltsseite (zusatz) — die Spuren haben eine feste
         Mindestbreite, der Inhalt zählt nicht: beim Umschalten von Rollen,
         Aufgaben, Ergebnissen gilt die letzte Messung weiter und erspart ein
         ganzes Layout. */
      var schluessel = a.spalten.join('|') + '@' + zusatz;
      if (!breiten || breiten.schluessel !== schluessel) { breiten = { schluessel: schluessel, werte: {} }; }
      var neu = spaltenReihe.filter(function (sp) {
        var min = sp.breit ? 100 : 190, abstand = sp.breit ? 6 : 8;
        if (fluss) { sp.soll = unterspalten(sp.modul).n; return sp.soll !== sp.anzahl; }
        var w = breiten.werte[sp.modul];
        if (w === undefined) { w = breiten.werte[sp.modul] = sp.felder[0].inhalt.clientWidth; }
        sp.soll = Math.max(1, Math.floor((w + abstand) / (min + abstand)));
        return sp.soll !== sp.anzahl;
      });
      neu.forEach(function (sp) {
        sp.anzahl = sp.soll;
        sp.felder.forEach(function (f) { spurenFuellen(f, sp.anzahl, null); });
      });
      var mehr = neu.filter(function (sp) { return sp.anzahl > 1; });
      if (fluss) {
        mehr.forEach(function (sp) {
          sp.felder.forEach(function (f) { spurenFuellen(f, sp.anzahl, flussSpuren(f, sp.anzahl, sp.modul)); });
        });
        mehr = [];
      }
      mehr.forEach(function (sp) {
        sp.luecke = sp.felder[0].inhalt.classList.contains('ra-feld__inhalt--liste') ? 4 : 6;
        sp.hoehen = sp.felder.map(function (f) {
          var m = {};
          f.stuecke.forEach(function (st) { m[st.key] = st.el.offsetHeight; });
          return m;
        });
      });
      mehr.forEach(function (sp) {
        var spurVon = spurenVerteilen(sp.felder, sp.keys, sp.anzahl, function (key, fi) { return sp.hoehen[fi][key]; }, sp.luecke);
        sp.felder.forEach(function (f) { spurenFuellen(f, sp.anzahl, spurVon); });
      });
      /* Stufen und Gassen nur im Fluss: ohne Pfeile stehen die Ergebnisse
         dicht untereinander, in der Folge der Abbildung. */
      if (fluss) { ausrichten(); } else { angleichen(); }
      pfeileLegen();
    }

    /* Ohne Pfeile: Was in einer Phase fast auf gleicher Höhe steht, steht
       auf gleicher Höhe — über alle Spalten und Spuren. Bricht eine Rolle
       («Anwendervertreter») oder ein Kasten in eine Zeile mehr um, rutscht
       alles darunter um diese Zeile; dann rücken die Nachbarn mit, statt
       eine Zeile versetzt zu stehen. Von oben nach unten: das höchste
       nächste Element der Zeile und alle derselben Art (Rolle, Aufgabe,
       Ergebnis, Meilenstein), die höchstens ANGLEICHEN tiefer stehen, beginnen auf der
       Höhe des tiefsten davon und werden so hoch wie das höchste — dann ist
       der Abstand darunter überall gleich. Die Abstände darunter bleiben, nur wachsen
       sie; weiter auseinander Liegendes bleibt, wie es ist. Ein Feld über
       mehrere Phasen gleicht sich mit seiner ersten ab. Erst alle
       Abstände zurücksetzen, dann alle lesen, dann alle schreiben. */
    var ANGLEICHEN = 18;        // px, gut eine Zeile
    var NACHZUEGLER = 14;       // px, knapp eine Zeile
    function angleichen() {
      var zeilen = {}, alle = [], hoeher = [];
      function blaetter(el) {
        if (!el.classList.contains('ra-block')) { return [el]; }
        var liste = [];
        Array.prototype.forEach.call(el.children, function (k) {
          if (k.classList.contains('ra-block__ergebnisse')) { liste.push.apply(liste, k.children); }
          else { liste.push(k); }
        });
        return liste;
      }
      spaltenReihe.forEach(function (sp) {
        sp.felder.forEach(function (f) {
          var keyVon = new global.Map();
          f.stuecke.forEach(function (st) { keyVon.set(st.el, st.key); });
          Array.prototype.forEach.call(f.inhalt.children, function (spur) {
            var liste = [], anfang = new global.Map();
            Array.prototype.forEach.call(spur.children, function (el) {
              var teile = blaetter(el), key = keyVon.get(el);
              if (teile.length && geteilt(f.zeile, key)) { anfang.set(teile[0], key); }
              liste.push.apply(liste, teile);
            });
            liste.forEach(function (el) { el.style.marginTop = ''; el.style.minHeight = ''; });
            (zeilen[f.zeile] = zeilen[f.zeile] || []).push({ spur: spur, liste: liste, anfang: anfang });
          });
        });
      });
      var oben0 = gitter.getBoundingClientRect().top;
      Object.keys(zeilen).forEach(function (z) {
        zeilen[z] = zeilen[z].map(function (c) {
          var unten = c.spur.getBoundingClientRect().top - oben0;
          var basis = unten;
          var teile = c.liste.map(function (el) {
            var r = el.getBoundingClientRect();
            var b = {
              el: el, h: r.height, d: r.top - oben0 - unten,
              rand: parseFloat(global.getComputedStyle(el).marginTop) || 0,
              art: ['rolle', 'aufgabe', 'meilenstein', 'ergebnis'].filter(function (a) { return el.classList.contains('ra-k--' + a); })[0],
              huelle: el.closest('.ra-block') || el.parentNode,
              key: c.anfang.get(el) || null
            };
            unten = r.bottom - oben0;
            return b;
          });
          return { blaetter: teile, i: 0, unten: basis };
        });
      });
      Object.keys(zeilen).forEach(function (z) {
        var saeulen = zeilen[z];
        /* Ein geteiltes Stück wartet, bis es in allen seinen Säulen als
           nächstes dran ist, und steht dann überall auf der Höhe des
           tiefsten. Folgen zwei geteilte Stücke in zwei Säulen verkehrt,
           gibt das oberste nach und stellt sich normal an. */
        var zahl = {};
        saeulen.forEach(function (c) {
          c.blaetter.forEach(function (b) { if (b.key) { zahl[b.key] = (zahl[b.key] || 0) + 1; } });
        });
        function wartet(b) { return !!b.key && zahl[b.key] > 1; }
        for (;;) {
          var offen = saeulen.filter(function (c) { return c.i < c.blaetter.length; });
          if (!offen.length) { break; }
          offen.forEach(function (c) { c.soll = c.unten + c.blaetter[c.i].d; });
          var dran = {};
          offen.forEach(function (c) { var k = c.blaetter[c.i].key; if (k) { dran[k] = (dran[k] || 0) + 1; } });
          var bereit = offen.filter(function (c) { var b = c.blaetter[c.i]; return !wartet(b) || dran[b.key] === zahl[b.key]; });
          if (!bereit.length) {
            var tiefst = offen.reduce(function (u, v) { return v.soll < u.soll ? v : u; });
            zahl[tiefst.blaetter[tiefst.i].key] = 0;
            continue;
          }
          var erstes = bereit.reduce(function (u, v) { return v.soll < u.soll ? v : u; });
          var gruppe, ziel, eb = erstes.blaetter[erstes.i];
          if (wartet(eb)) {
            gruppe = bereit.filter(function (c) { return c.blaetter[c.i].key === eb.key; });
            ziel = Math.max.apply(null, gruppe.map(function (c) { return c.soll; }));
          } else {
            /* Wer knapp unter dem Ziel stünde, rückt mit. */
            var gleicheArt = bereit.filter(function (c) { var b = c.blaetter[c.i]; return b.art === eb.art && !wartet(b); });
            var grenze = erstes.soll + ANGLEICHEN;
            for (;;) {
              gruppe = gleicheArt.filter(function (c) { return c.soll <= grenze; });
              ziel = Math.max.apply(null, gruppe.map(function (c) { return c.soll; }));
              if (!gleicheArt.some(function (c) { return c.soll > ziel && c.soll < ziel + NACHZUEGLER; })) { break; }
              grenze = ziel + NACHZUEGLER;
            }
          }
          /* Was auf einer Linie beginnt, wird gleich hoch — so hoch wie das
             höchste: dann ist der Abstand darunter überall derselbe. */
          /* Rückt ein Kasten ein Stück nach, wächst statt einer Lücke der
             Kasten darüber im selben Block (oder derselben Liste); steht
             darüber seine Rolle, rückt sie mit und bleibt über dem Kasten.
             Eine Rolle neben einer höheren steht unten, über ihrem Kasten. */
          var hoch = Math.max.apply(null, gruppe.map(function (c) { return c.blaetter[c.i].h; }));
          gruppe.forEach(function (c) {
            var b = c.blaetter[c.i], vor = c.i ? c.blaetter[c.i - 1] : null, mehr = ziel - c.soll;
            if (mehr > 0.5) {
              if (vor && vor.huelle === b.huelle && mehr <= ANGLEICHEN + NACHZUEGLER && (vor.art === 'aufgabe' || vor.art === 'ergebnis')) {
                vor.hNeu = (vor.hNeu || vor.h) + mehr;
              } else if (vor && vor.huelle === b.huelle && mehr <= ANGLEICHEN + NACHZUEGLER && vor.art === 'rolle') {
                vor.plus = (vor.plus || 0) + mehr;
              } else {
                b.plus = (b.plus || 0) + mehr;
              }
            }
            if (hoch - b.h > 0.5) {
              if (b.art === 'rolle') { b.plus = (b.plus || 0) + hoch - b.h; } else { b.hNeu = hoch; }
            }
            c.unten = ziel + hoch;
            c.i++;
          });
        }
        saeulen.forEach(function (c) {
          c.blaetter.forEach(function (b) {
            if (b.plus > 0.5) { alle.push({ el: b.el, rand: b.rand + b.plus }); }
            if (b.hNeu) { hoeher.push({ el: b.el, h: b.hNeu }); }
          });
        });
      });
      alle.forEach(function (x) { x.el.style.marginTop = x.rand + 'px'; });
      hoeher.forEach(function (x) { x.el.style.minHeight = x.h + 'px'; });
    }

    /* Stufen wie in der Abbildung 1: In einer Phase beginnen Stücke, deren
       Kästen dort auf gleicher Höhe liegen, auf gleicher Höhe — über alle
       Spalten und Spuren —, und jede Stufe beginnt unter allem, was in der
       Zeile davor steht. So bleibt über jeder Stufe eine freie Gasse quer
       durch die Zeile, in der die Pfeile laufen. Stücke ohne Kasten folgen
       unten, frühestens unter der tiefsten Gasse, die ihre Säule kreuzt —
       so läuft kein Pfeil über einen Kasten. Nur Abstände ändern sich, die Kästen nicht. Erst alle Höhen
       lesen, dann alle Abstände schreiben. */
    var STUFE_TOLERANZ = 6;     // Koordinaten der Grafik
    var GASSE = 16;             // px frei über jeder Stufe
    var LUECKE_FLUSS = 14;      // im Fluss zwischen Kästen untereinander: Platz für den Pfeil
    /* Stück einer Stufe → { inhalt, dy: Gasse darüber, von oben im Inhalt
       des Feldes, erstes }. Relativ, weil die Zeilen darüber beim Ausrichten
       noch wachsen. */
    var gasseVon = new global.Map();
    /* Inhalt eines Feldes → alle Gassen seiner Zeile, von oben im Inhalt. */
    var gassenVon = new global.Map();
    function ausrichten() {
      gasseVon = new global.Map();
      gassenVon = new global.Map();
      var oben0 = gitter.getBoundingClientRect().top;
      var zeilen = {};
      spaltenReihe.forEach(function (sp) {
        sp.felder.forEach(function (f) {
          if (f.mehr) { return; }
          var luecke = fluss ? LUECKE_FLUSS : f.inhalt.classList.contains('ra-feld__inhalt--liste') ? 4 : 6;
          var basis = f.inhalt.getBoundingClientRect().top - oben0;
          Array.prototype.forEach.call(f.inhalt.children, function (spur) {
            /* Eingeklappte zählen nicht. */
            var stuecke = Array.prototype.filter.call(spur.children, function (el) {
              return el.offsetParent !== null;
            }).map(function (el) {
              var y = yVon.get(el);
              return { el: el, y: y === undefined ? null : y, h: el.offsetHeight };
            });
            var r = spur.getBoundingClientRect();
            (zeilen[f.zeile] = zeilen[f.zeile] || []).push({
              stuecke: stuecke, luecke: luecke, basis: basis, pos: basis, i: 0, inhalt: f.inhalt,
              l: r.left, r: r.right, kreuz: -1
            });
          });
        });
      });
      var stufeVonEl = new global.Map();
      Object.keys(zeilen).forEach(function (z) {
        var saeulen = zeilen[z];
        var ys = [];
        saeulen.forEach(function (c) { c.stuecke.forEach(function (st) { if (st.y !== null) { ys.push(st.y); } }); });
        ys.sort(function (u, v) { return u - v; });
        var stufeVon = {}, k = -1, anfang = -Infinity;
        ys.forEach(function (y) {
          if (y - anfang > STUFE_TOLERANZ) { k++; anfang = y; }
          stufeVon[y] = k;
        });
        saeulen.forEach(function (c) {
          c.stuecke.forEach(function (st) {
            st.k = st.y === null ? Infinity : stufeVon[st.y];
            stufeVonEl.set(st.el, { saeulen: saeulen, k: st.k });
          });
        });
        zeilen[z].k = k;
      });

      /* Welche Gassen quer durch welche Säulen laufen: ein Pfeil in eine
         Stufe nimmt deren Gasse vom Rand der Quelle bis über das Ziel. Stücke
         ohne Kasten beginnen in einer Säule erst unter der tiefsten Stufe,
         deren Gasse sie kreuzt — sonst gleich oben. */
      if (fluss) {
        PFEILE.forEach(function (pf) {
          var von = endeFinden(pf.von), nach = endeFinden(pf.nach);
          if (!von || !nach || von.el === nach.el) { return; }
          var info = stufeVonEl.get(nach.el);
          if (!info || info.k === Infinity) { return; }
          var s = von.el.getBoundingClientRect(), t = nach.el.getBoundingClientRect();
          var tx = (t.left + t.right) / 2, sx = tx >= (s.left + s.right) / 2 ? s.right : s.left;
          var links = Math.min(sx, tx), rechts = Math.max(sx, tx);
          info.saeulen.forEach(function (c) {
            if (c.r >= links && c.l <= rechts) { c.kreuz = Math.max(c.kreuz, info.k); }
          });
        });
      }

      Object.keys(zeilen).forEach(function (z) {
        var saeulen = zeilen[z], k = saeulen.k, beginn = [];
        function setzen(c, st, oben) {
          st.el.style.marginTop = (oben - (c.i ? c.pos : c.basis)) + 'px';
          c.pos = oben + st.h;
          c.i++;
        }
        var ziel = -Infinity;
        for (var stufe = 0; stufe <= k; stufe++) {
          ziel = -Infinity;
          saeulen.forEach(function (c) { ziel = Math.max(ziel, c.pos + GASSE); });
          beginn[stufe] = ziel;
          saeulen.forEach(function (c) {
            var erstes = true;
            while (c.stuecke[c.i] && c.stuecke[c.i].k === stufe) {
              gasseVon.set(c.stuecke[c.i].el, { inhalt: c.inhalt, dy: ziel - GASSE / 2 - c.basis, erstes: erstes });
              setzen(c, c.stuecke[c.i], erstes ? ziel : c.pos + c.luecke);
              erstes = false;
            }
          });
        }
        saeulen.forEach(function (c) {
          gassenVon.set(c.inhalt, beginn.map(function (b) { return b - GASSE / 2 - c.basis; }));
        });
        saeulen.forEach(function (c) {
          var unten = c.kreuz >= 0 ? beginn[c.kreuz] : -Infinity;
          while (c.stuecke[c.i]) {
            setzen(c, c.stuecke[c.i], c.i ? Math.max(c.pos + c.luecke, unten) : Math.max(c.basis, unten));
          }
        });
      });
    }

    /* Zeigen: jede Stelle desselben Elements; beim Meilenstein zusätzlich das
       Feld, in dem er entsteht; beim Modulkopf die Spalte, bei der Phase die
       Zeile. */
    var gezeigtSchluessel = null;
    function markieren(ziel) {
      var schluessel = ziel ? (ziel.dataset.id || '') + '#' + (ziel.dataset.modul || '') + '#' + (ziel.closest('.ra-phase') ? ziel.closest('.ra-phase').dataset.phase : '') : null;
      if (schluessel === gezeigtSchluessel) { return; }
      gezeigtSchluessel = schluessel;
      Array.prototype.forEach.call(gitter.querySelectorAll('.ist-gleich'), function (x) { x.classList.remove('ist-gleich'); });
      gitter.classList.toggle('hat-zeigen', !!ziel);
      angezeigtId = ziel && ziel.classList.contains('ra-k--ergebnis') ? ziel.dataset.id : null;
      pfeileHervorheben('ist-an', angezeigtId);
      if (!ziel) { return; }
      var id = ziel.dataset.id;
      if (id) {
        Array.prototype.forEach.call(gitter.querySelectorAll('[data-id="' + id + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
      if (ziel.classList.contains('ra-ms')) {
        var phase = ziel.closest('.ra-phase').dataset.phase;
        ziel.dataset.module.split('|').forEach(function (modul) {
          var feld = gitter.querySelector('.ra-feld[data-phasen~="' + phase + '"][data-modul="' + modul + '"]');
          if (feld) { feld.classList.add('ist-gleich'); }
        });
      } else if (ziel.classList.contains('ra-modul')) {
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-modul="' + ziel.dataset.modul + '"]'), function (x) { x.classList.add('ist-gleich'); });
      } else if (ziel.classList.contains('ra-phase__name')) {
        var p = ziel.closest('.ra-phase').dataset.phase;
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-phasen~="' + p + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
    }
    /* Ein Kasten ohne Element (Zuordnen) hebt nichts hervor. */
    function zielAus(el) {
      var z = el && el.closest ? el.closest('.ra-k, .ra-ms, .ra-modul, .ra-phase__name') : null;
      return z && z.classList.contains('ra-k') && !z.dataset.id ? null : z;
    }
    gitter.addEventListener('mouseover', function (ev) { markieren(zielAus(ev.target)); });
    gitter.addEventListener('mouseleave', function () { markieren(null); });
    gitter.addEventListener('focusin', function (ev) { markieren(zielAus(ev.target)); });

    /* Klick auf den Trichter filtert; auf ein Element, einen Modulkopf oder
       eine Phase wählt es für die Inhaltsseite; auf die freie Fläche eines
       Feldes wählt das Feld (seine Bilanz). */
    gitter.addEventListener('click', function (ev) {
      var mehrKnopf = ev.target.closest('.ra-feld__mehr');
      if (mehrKnopf) { weitereZeigen(mehrKnopf.closest('.ra-feld'), !mehrKnopf.closest('.ra-feld').classList.contains('ist-offen')); return; }
      var t = ev.target.closest('.ra-trichter');
      if (t) { aktionen[t.dataset.art](t.dataset.name); return; }
      var kl = ev.target.closest('.ra-klappe, .ra-zuspalte');
      if (kl) { if (aktionen.klappen) { aktionen.klappen(kl.dataset.art, kl.dataset.name); } return; }
      var ziel = zielAus(ev.target);
      if (ziel && ziel.dataset.id) { aktionen.waehlen(ziel.dataset.id); return; }
      var feld = ev.target.closest('.ra-feld');
      if (feld && !ziel) { aktionen.feld(feld.dataset.phase, feld.dataset.modul); }
    });

    /* «+N» klappt die Ergebnisse eines Feldes ohne Kasten in der Abbildung
       auf: Sie stehen unter den Kästen, die Pfeile weichen ihnen aus. */
    function weitereZeigen(feld, auf) {
      var knopf = feld.querySelector('.ra-feld__mehr');
      if (!knopf || feld.classList.contains('ist-offen') === auf) { return; }
      var n = feld.querySelectorAll('.ra-k--weiter').length;
      feld.classList.toggle('ist-offen', auf);
      knopf.setAttribute('aria-expanded', auf ? 'true' : 'false');
      knopf.textContent = (auf ? '−' : '+') + n;
      knopf.title = n + (n === 1 ? ' weiteres Ergebnis' : ' weitere Ergebnisse') + ' ohne Kasten in Abbildung 1 — ' + (auf ? 'einklappen' : 'aufklappen');
      ausrichten();
      pfeileLegen();
    }

    /* Die Auswahl bleibt markiert, an jeder ihrer Stellen; ein gewähltes Feld
       trägt den Ring selbst. */
    function gewaehlt(id, feld) {
      Array.prototype.forEach.call(gitter.querySelectorAll('.ist-gewaehlt'), function (x) { x.classList.remove('ist-gewaehlt'); });
      gewaehltId = id;
      pfeileHervorheben('ist-gewaehlt', id);
      if (id) {
        Array.prototype.forEach.call(gitter.querySelectorAll('[data-id="' + id + '"]'), function (x) { x.classList.add('ist-gewaehlt'); });
      }
      if (feld) {
        var el = gitter.querySelector('.ra-feld[data-phasen~="' + feld.phase + '"][data-modul="' + feld.modul + '"]');
        if (el) { el.classList.add('ist-gewaehlt'); }
      }
    }

    /* Aus der Inhaltsseite: eine Stelle anspringen — das Element im Feld,
       sonst das Feld, ohne Modul die Phase — und kurz aufleuchten lassen. */
    function stelleZeigen(phase, modul, id) {
      var el = null;
      if (modul) {
        var feld = gitter.querySelector('.ra-feld[data-phasen~="' + phase + '"][data-modul="' + modul + '"]');
        el = (feld && id && feld.querySelector('[data-id="' + id + '"]')) || feld;
        if (el && el.classList.contains('ra-k--weiter')) { weitereZeigen(feld, true); }
      } else {
        var band = gitter.querySelector('.ra-phase[data-phase="' + phase + '"]');
        el = band ? band.querySelector('.ra-phase__name') : null;
      }
      if (!el) { return false; }
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      el.classList.add('ist-angesprungen');
      global.setTimeout(function () { el.classList.remove('ist-angesprungen'); }, 1400);
      return true;
    }

    return {
      buehne: buehne,
      spurenLegen: spurenLegen,
      gewaehlt: gewaehlt,
      stelleZeigen: stelleZeigen,
      tour: tourSetzen,
      pfeilZahl: function () { return pfeile.length; },
      /* Die Phasen, über die das Feld dieser Phase und dieses Moduls reicht. */
      feldPhasen: function (phase, modul) {
        var el = gitter.querySelector('.ra-feld[data-phasen~="' + phase + '"][data-modul="' + modul + '"]');
        return el ? el.dataset.phasen.split(' ') : [phase];
      },
      zeigen: function (id) {
        var el = gitter.querySelector('[data-id="' + id + '"]');
        if (!el) { return false; }
        if (el.classList.contains('ra-k--weiter')) { weitereZeigen(el.closest('.ra-feld'), true); }
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        el.focus({ preventScroll: true });
        return true;
      }
    };
  }

  /* --- Ansicht ----------------------------------------------------------------- */

  var IKONE_FILTER = ['M3.5 5h17', 'M6.5 12h11', 'M10 19h4'];
  var IKONE_SEITE = ['M4 5h16v14H4Z', 'M14.5 5v14'];
  var IKONE_PFEIL = ['M4 6h8v12h8', 'M16.5 14.5 20 18l-3.5 3.5'];
  var IKONE_RUNDGANG = ['M5.5 20.5v-16', 'M5.5 4.5h11l-2.5 3.75 2.5 3.75h-11'];
  var IKONE_ZURUECK = ['M14.5 5.5 8 12l6.5 6.5'];
  var IKONE_WEITER = ['M9.5 5.5 16 12l-6.5 6.5'];

  function sichtKopie(s) { return { rolle: !!s.rolle, aufgabe: !!s.aufgabe, ergebnis: !!s.ergebnis, pfeile: !!s.pfeile }; }

  function infoInhalt() {
    return [
      h('p', { text: 'Das Gesamtbild der Methode wie Abbildung 1 des Referenzhandbuchs — Phasen als Zeilen, Module als Spalten.' }),
      h('p', { text: 'Das Gerüst steht fest: links die Phasen mit ihren Meilensteinen (die Freigabe, die eine Phase öffnet, oben; die Entscheide, mit denen sie endet, unten an der Grenze zur nächsten Phase; modulspezifische dazwischen), oben die Module. Projektsteuerung und Projektführung haben je eine eigene Spalte, Projektgrundlagen liegt in der Initialisierung über drei.' }),
      h('p', { text: 'Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln einblenden. Mit Aufgaben steht je Aufgabe die verantwortliche Rolle darüber und die Ergebnisse, die sie in diesem Feld erzeugt, darunter. Zeigen auf ein Element hebt jede seiner Stellen hervor. Die Ergebnisse stehen wie in Abbildung 1: Was später entsteht, steht weiter unten; mit Pfeilen beginnt zudem, was dort in einer Phase auf gleicher Höhe liegt, quer über alle Spalten auf gleicher Höhe. Ergebnisse ohne Kasten in der Abbildung folgen darunter, in jeder Phase in derselben Reihenfolge. Haben aufeinanderfolgende Phasen eines Moduls genau dieselben Aufgaben und Ergebnisse (Projektführung von Konzept bis Einführung), stehen sie nur einmal, in einem Feld über diese Phasen. Steht ein Ergebnis im Feld unter mehreren Aufgaben, ist nur das erste Vorkommen kräftig, die weiteren sind blass.' }),
      h('p', { text: 'Pfeile: der Fluss der Abbildung 1. Ist «Pfeile» in der Leiste an, stehen nur die Ergebnisse, die in der Abbildung einen Kasten haben, und die Pfeile führen von Kasten zu Kasten — was daraus entsteht, steht darunter. Die übrigen Ergebnisse eines Feldes (Checklisten, Listen, Protokolle …) klappt «+N» unten im Feld auf; sie sind gestrichelt. Zeigen auf ein Ergebnis hebt seine Pfeile hervor. Ist «Pfeile» aus, stehen alle Ergebnisse ohne Pfeile. Pfeile gibt es nur, wenn allein Ergebnisse eingeblendet sind.' }),
      h('p', { text: 'Filter (Icon neben der Suche): Ist etwas gefiltert, nennt es die rote Pille in der Leiste; ein Klick darauf öffnet den Filter, × hebt ihn auf. Phasen und Module blenden Zeilen und Spalten aus — die übrigen werden breiter. Der Trichter neben einem Modulkopf oder einer Phase tut dasselbe; ein zweiter Klick zeigt wieder alle. Eine Rolle (die drei Linien: verantwortlich, beteiligt oder beides) und «Nur Entscheide» (Raute) lassen nur die passenden Aufgaben stehen; Felder ohne Treffer bleiben leer, Meilensteine, die keine dieser Aufgaben erreicht, treten zurück. Der Filter steht in der Adresse und lässt sich so teilen.' }),
      h('p', { text: 'Inhaltsseite (Icon ganz rechts in der Leiste, Trennlinie ziehbar): Ein Klick auf ein Element, eine Phase oder einen Modulkopf zeigt seine Seite aus dem Handbuch und darunter «Im Raster» — wo es überall steht; eine Zeile springt ins Feld, ein Name wählt das Element. Ein Klick auf die freie Fläche eines Feldes zeigt seine Bilanz: Aufgaben, Entscheide, Meilensteine, Rollen und Ergebnisse. Ein zweiter Klick oder Esc hebt die Auswahl auf. Ohne Auswahl stehen dort bei gesetztem Filter seine Treffer, Phase für Phase.' }),
      h('p', { text: 'Rundgang (zweiter Reiter der Inhaltsseite): vier Wege Schritt für Schritt durch die Methode — entlang der Ergebnisse, Phase für Phase mit allen Aufgaben, Rolle für Rolle mit ihren Verantwortungen und die Besonderheiten wie Abnahmen und Protokolle. Links zeigt das Raster, worum es im Schritt geht, und hebt es hervor; rechts steht, was es bedeutet. Weiter und zurück mit den Knöpfen oder den Pfeiltasten. Solange der Rundgang läuft, bestimmt der Schritt, was das Raster zeigt; der eigene Filter und die eigene Sicht kommen zurück, wenn man ihn beendet (× in der Leiste oder oben im Rundgang). Ein Klick auf ein Element zeigt seine Seite im Reiter «Handbuch»; Esc führt zurück zum Schritt.' })
    ];
  }

  function render(behaelter, params) {
    var vorgehen = params.vorgehen === 'agil' ? 'agil' : 'klassisch';
    var sicht = sichtLesen();
    var filter = filterAusParams(params);
    var zu = zuLesen(ZU_SPEICHER);
    var huelle = h('div', { class: 'ra' }, h('p', { class: 'ub-buehne__laden', text: 'Gesamtbild wird aufgebaut' }));
    behaelter.appendChild(huelle);
    var m = null, a = null;
    var popOffen = false;

    var pop = h('div', { class: 'gpop gpop--breit ra-pop', role: 'dialog', 'aria-label': 'Filter' });
    pop.hidden = true;
    var filterKnopf = h('button', {
      type: 'button', class: 'graph-werkzeug graph-werkzeug--filter', 'aria-label': 'Filter: Phasen, Module, Rolle, Entscheide',
      title: 'Filter: Phasen, Module, Rolle, Entscheide', 'aria-expanded': 'false', 'aria-haspopup': 'dialog',
      on: { click: function () { popOffen = !popOffen; popZeichnen(true); } }
    }, HT.ui.symbol(IKONE_FILTER, 18));

    /* --- Inhaltsseite rechts ---
       Ein Klick auf ein Element, eine Phase oder einen Modulkopf zeigt dessen
       Seite (js/inhaltsseite.js), gleich unter dem Kopf «Im Raster»: wo es
       überall steht. Ohne Auswahl stehen dort bei gesetztem Filter seine
       Treffer, sonst eine kurze Anleitung. Die Auswahl steht in der Adresse
       (id=…); offen oder zu und die Breite bleiben in localStorage. */
    var seiteZustand = seiteLesen();
    var auswahl = params.id ? HT.daten.eintragMitId(params.id) || null : null;
    /* Gewähltes Feld { phase, modul } — schliesst die Auswahl eines Elements aus. */
    var feldWahl = null;
    if (!auswahl && params.feld) {
      var feldTeile = String(params.feld).split('|');
      if (feldTeile.length === 2) { feldWahl = { phase: feldTeile[0], modul: feldTeile[1] }; }
    }
    /* Alte Adressen der Feldseite (#/feld?phase=…&modul=…): dieses Feld wählen. */
    if (!auswahl && !feldWahl && params.phase && params.modul) { feldWahl = { phase: String(params.phase), modul: String(params.modul) }; }
    var gezeichnet = null;

    /* Rundgang (js/rundgang.js): der Reiter der Inhaltsseite und der
       laufende Weg { id, schritte, i }. Solange er läuft, zeigt das Raster
       Sicht und Filter des Schritts (tourSicht: Änderungen in der Leiste bis
       zum nächsten Schritt); die eigenen bleiben gespeichert und kommen
       zurück, wenn er endet. In der Adresse: tour=…&schritt=… */
    var reiter = params.tour && !params.id ? 'rundgang' : 'handbuch';
    var reise = null;
    var reiseWunsch = params.tour ? { id: String(params.tour), i: Math.max(0, (parseInt(params.schritt, 10) || 1) - 1) } : null;
    var lp = null, lpLaedt = false;
    var tourSicht = null;
    var gebaut = null;
    var alleOffen = false;

    /* Fragen (js/fragen.js): dritter Reiter, nur wenn in diesem Browser
       Prüfungsfragen geladen sind. Eine Frage läuft wie ein Schritt des
       Rundgangs (reise.id 'fragen'); die angeklickte Antwort (reise.antwort)
       hebt ihre eigenen Stellen hervor, aufgedeckte stehen in reise.offen.
       In der Adresse: frage=… */
    var fragenStand = null;
    var frageWunsch = params.frage && !params.id ? String(params.frage) : null;
    var rasterBereit = false;
    if (frageWunsch) { reiter = 'fragen'; }

    var seiteText = h('div', { class: 'ub-inhalt__text ra-inhalt__text' });
    var reiterLeiste = h('div', { class: 'ra-reiter', role: 'tablist', 'aria-label': 'Inhaltsseite' });
    var seite = h('aside', { class: 'ub-inhalt ra-inhalt', 'aria-label': 'Inhaltsseite' }, [reiterLeiste, seiteText]);
    var trenner = h('div', {
      class: 'ub-trenner ra-trenner', role: 'separator', 'aria-orientation': 'vertical',
      'aria-label': 'Breite der Inhaltsseite', tabindex: '0',
      title: 'Ziehen ändert die Breite · Doppelklick setzt zurück'
    }, h('span', { class: 'ub-trenner__strich', 'aria-hidden': 'true' }));
    var seiteKnopf = h('button', {
      type: 'button', class: 'unterleiste__info ra-seiteknopf',
      on: { click: function () { seiteOeffnen(!seiteZustand.offen); } }
    }, HT.ui.symbol(IKONE_SEITE, 18));
    HT.app.kopfWerkzeug(h('span', { class: 'ra-werkzeuge' }, [filterKnopf]));

    function breitenSchluessel() {
      return global.innerWidth + '|' + (seiteZustand.offen ? seiteZustand.breite : 0);
    }

    function seiteAnwenden() {
      var grenze = Math.max(SEITE_MIN, global.innerWidth - BUEHNE_MIN);
      seiteZustand.breite = Math.round(Math.max(SEITE_MIN, Math.min(seiteZustand.breite, grenze)));
      huelle.style.setProperty('--ra-seite', seiteZustand.breite + 'px');
      huelle.classList.toggle('ist-seite-zu', !seiteZustand.offen);
      seiteKnopf.setAttribute('aria-pressed', seiteZustand.offen ? 'true' : 'false');
      seiteKnopf.title = seiteZustand.offen ? 'Inhaltsseite schliessen' : 'Inhaltsseite öffnen';
      seiteKnopf.setAttribute('aria-label', seiteKnopf.title);
    }

    function seiteOeffnen(offen) {
      seiteZustand.offen = offen;
      seiteSpeichern(seiteZustand);
      seiteAnwenden();
      if (laufende) { laufende.spurenLegen(breitenSchluessel()); }
    }

    trenner.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) { return; }
      ev.preventDefault();
      var startX = ev.clientX, start = seiteZustand.breite;
      function bewegen(e) { seiteZustand.breite = start - (e.clientX - startX); seiteAnwenden(); }
      function beenden() {
        global.removeEventListener('mousemove', bewegen);
        global.removeEventListener('mouseup', beenden);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        seiteSpeichern(seiteZustand);
        if (laufende) { laufende.spurenLegen(breitenSchluessel()); }
      }
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      global.addEventListener('mousemove', bewegen);
      global.addEventListener('mouseup', beenden);
    });
    trenner.addEventListener('keydown', function (ev) {
      var schritt = ev.key === 'ArrowLeft' ? 24 : ev.key === 'ArrowRight' ? -24 : 0;
      if (!schritt) { return; }
      ev.preventDefault();
      seiteZustand.breite += schritt;
      seiteAnwenden();
      seiteSpeichern(seiteZustand);
      if (laufende) { laufende.spurenLegen(breitenSchluessel()); }
    });
    trenner.addEventListener('dblclick', function () {
      seiteZustand.breite = SEITE_STANDARD;
      seiteAnwenden();
      seiteSpeichern(seiteZustand);
      if (laufende) { laufende.spurenLegen(breitenSchluessel()); }
    });
    seiteAnwenden();

    /** Wählt e (Eintrag oder id) für die Inhaltsseite; umschalten: ein zweiter Klick hebt auf. */
    function waehlen(x, umschalten) {
      var e = typeof x === 'string' ? HT.daten.eintragMitId(x) : x;
      if (umschalten && e && auswahl && e.id === auswahl.id) { e = null; }
      auswahl = e || null;
      feldWahl = null;
      wahlAnwenden();
    }

    /** Wählt das Feld Phase × Modul; umschalten: ein zweiter Klick hebt auf. */
    function feldWaehlen(phase, modul, umschalten) {
      var gleich = feldWahl && feldWahl.phase === phase && feldWahl.modul === modul;
      feldWahl = umschalten && gleich ? null : { phase: phase, modul: modul };
      auswahl = null;
      wahlAnwenden();
    }

    function wahlAnwenden() {
      /* Eine Auswahl zeigt ihre Seite im Reiter «Handbuch»; wird sie im
         Rundgang aufgehoben, geht es zurück zum Schritt. */
      if (auswahl || feldWahl) { reiter = 'handbuch'; }
      else if (reise) { reiter = reiseReiter(); }
      if ((auswahl || feldWahl) && !seiteZustand.offen) { seiteOeffnen(true); }
      adresseSetzen();
      if (laufende) { laufende.gewaehlt(auswahl ? auswahl.id : null, feldWahl); }
      inhaltZeichnen();
    }
    wahlVonAussen = function (e) {
      if (!laufende || !laufende.zeigen(e.id)) { return false; }
      waehlen(e, false);
      return true;
    };

    function adresseSetzen() {
      var q = (vorgehen === 'agil' ? ['vorgehen=agil'] : []).concat(filterAlsQuery(filter));
      if (auswahl) { q.push('id=' + encodeURIComponent(auswahl.id)); }
      if (feldWahl) { q.push('feld=' + encodeURIComponent(feldWahl.phase + '|' + feldWahl.modul)); }
      if (reise && reise.id === 'fragen') { q.push('frage=' + encodeURIComponent(schritt().id)); }
      else if (reise) { q.push('tour=' + reise.id, 'schritt=' + (reise.i + 1)); }
      global.history.replaceState(null, '', '#/ueberblick' + (q.length ? '?' + q.join('&') : ''));
    }

    /* --- Rundgang --- */

    function schritt() { return reise ? reise.schritte[reise.i] : null; }

    /** Der Reiter, in dem der laufende Weg steht: Fragen oder Rundgang. */
    function reiseReiter() { return reise && reise.id === 'fragen' ? 'fragen' : 'rundgang'; }

    /** Was das Raster hervorhebt: das Ziel der gewählten Antwort, sonst des Schritts. */
    function zielJetzt() {
      var s = schritt();
      if (!s) { return null; }
      var an = s.antworten && reise.antwort !== null ? s.antworten[reise.antwort] : null;
      return an && an.ziel ? an.ziel : s.ziel;
    }

    /** Die Sicht, die das Raster zeigt: im Rundgang die des Schritts. */
    function sichtJetzt() {
      var s = schritt();
      return s ? tourSicht || s.sicht : sicht;
    }

    /** Der Filter, den das Raster zeigt: im Rundgang der des Schritts. */
    function filterJetzt() {
      var s = schritt();
      if (!s) { return filter; }
      var f = leererFilter();
      Object.keys(s.filter || {}).forEach(function (k) { f[k] = s.filter[k]; });
      return f;
    }

    function lpHolen() {
      if (lp || lpLaedt) { return; }
      lpLaedt = true;
      HT.rundgang.laden().then(function (d) {
        lp = d || { kurse: [] };
        if (!document.body.contains(huelle)) { return; }
        if (reiseWunsch && m) { wunschErfuellen(); return; }
        inhaltZeichnen();
      });
    }

    function wunschErfuellen() {
      var w = reiseWunsch;
      reiseWunsch = null;
      if (HT.rundgang.REISEN.some(function (r) { return r.id === w.id; })) { reiseStarten(w.id, w.i, reiter === 'rundgang'); }
      else { inhaltZeichnen(); }
    }

    function reiterWaehlen(r) {
      reiter = r;
      if (r === 'rundgang') { lpHolen(); }
      if (!seiteZustand.offen) { seiteOeffnen(true); }
      inhaltZeichnen();
    }

    function reiterZeichnen() {
      HT.ui.leeren(reiterLeiste);
      [['handbuch', 'Handbuch'], ['rundgang', 'Rundgang']].concat(fragenStand ? [['fragen', 'Fragen']] : []).forEach(function (r) {
        var an = reiter === r[0];
        reiterLeiste.appendChild(h('button', {
          type: 'button', class: 'ra-reiter__knopf', role: 'tab', 'aria-selected': an ? 'true' : 'false',
          on: { click: function () { if (!an) { reiterWaehlen(r[0]); } } }
        }, [
          h('span', { text: r[1] }),
          r[0] === reiseReiter() && reise ? h('span', { class: 'ra-reiter__zahl', text: (reise.i + 1) + '/' + reise.schritte.length }) : null
        ]));
      });
    }

    /** Startet einen Weg bei Schritt i (ab 0); zeigen: den Reiter «Rundgang» öffnen. */
    function reiseStarten(id, i, zeigen) {
      var schritte = HT.rundgang.schritte(id, lp, m);
      if (!schritte.length) { reise = null; inhaltZeichnen(); return; }
      reise = { id: id, schritte: schritte, i: Math.max(0, Math.min(i || 0, schritte.length - 1)) };
      if (zeigen !== false) { reiter = 'rundgang'; auswahl = null; feldWahl = null; }
      popOffen = false;
      if (!seiteZustand.offen) { seiteOeffnen(true); }
      schrittZeigen();
    }

    function schrittZeigen() {
      tourSicht = null;
      var s = schritt();
      /* Rundgang-Schritte ohne Vorgehen gelten in beiden Sichten; eine Frage
         ohne Vorgehen ist klassisch gemeint. */
      var soll = s ? s.vorgehen || (reise.id === 'fragen' ? 'klassisch' : null) : null;
      if (soll && soll !== vorgehen) { vorgehen = soll; filter.phasen = null; }
      adresseSetzen();
      zeichnen({ zumZiel: true, wennNoetig: true });
    }

    function schrittGehen(j) {
      if (!reise || j < 0 || j >= reise.schritte.length) { return; }
      reise.i = j;
      if (reise.id === 'fragen') { reise.antwort = null; reise.offen = {}; }
      reiter = reiseReiter();
      auswahl = null;
      feldWahl = null;
      schrittZeigen();
    }

    function reiseBeenden() {
      reise = null;
      tourSicht = null;
      adresseSetzen();
      zeichnen();
    }

    /* Die Vorgehensweise wechselt: derselbe Schritt, wenn es ihn dort gibt,
       sonst der an derselben Stelle. */
    function reiseUmbauen() {
      if (!reise || reise.id === 'fragen') { return; }
      var key = schritt().key;
      var neu = HT.rundgang.schritte(reise.id, lp, modell(vorgehen));
      if (!neu.length) { reise = null; return; }
      var j = -1;
      neu.forEach(function (s, k) { if (j === -1 && s.key === key) { j = k; } });
      reise.schritte = neu;
      reise.i = j !== -1 ? j : Math.min(reise.i, neu.length - 1);
      tourSicht = null;
    }

    /* --- Inhalt der Seite --- */

    function verweis(k) {
      return h('button', {
        type: 'button', class: 'ra-ort__link', text: k.begriff,
        on: { click: function () { waehlen(k.id, false); } }
      });
    }

    function mitKomma(teile) {
      var aus = [];
      teile.forEach(function (t, i) { if (i) { aus.push(', '); } aus.push(t); });
      return aus;
    }

    function ortZeile(wo, phase, modul, zeigeId, inhalt) {
      var f = filterJetzt();
      var sichtbar = gezeigt(f.phasen, phase) && (!modul || gezeigt(f.module, modul));
      return h('li', { class: 'ra-ort' + (sichtbar ? '' : ' ist-aus') }, [
        h('button', {
          type: 'button', class: 'ra-ort__wo', text: wo, disabled: !sichtbar,
          title: sichtbar ? 'Im Raster zeigen' : 'Vom Filter ausgeblendet',
          on: { click: function () { if (laufende) { laufende.stelleZeigen(phase, modul, zeigeId); } } }
        }),
        h('div', { class: 'ra-ort__was' }, inhalt)
      ]);
    }

    function zahlText(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }

    /* «Im Raster»: wo das Element überall steht — im ganzen Raster der
       Vorgehensweise, auch wo der Filter es ausblendet (dort blass). Eine
       Zeile springt ins Feld, ein Name wählt das Element. */
    function imRaster(e) {
      var zeilen = [], vorspann = null, phasen = {}, module = {};
      function merken(phase, modul) { phasen[phase] = true; if (modul) { module[modul] = true; } }
      var kat = e.kategorie;
      if (kat === 'aufgabe') {
        var rolle = null;
        m.felder.forEach(function (feld) {
          feld.bloecke.forEach(function (b) {
            if (b.aufgabe.id !== e.id) { return; }
            rolle = rolle || b.rolle;
            var erg = b.ergebnisse.filter(function (k) { return !istMeilenstein(k); });
            var ms = b.ergebnisse.filter(istMeilenstein);
            merken(feld.phase, feld.modul);
            zeilen.push(ortZeile(feld.phase + ' · ' + feld.modul, feld.phase, feld.modul, e.id, [
              mitKomma(erg.map(verweis)),
              ms.length ? h('span', { class: 'ra-ort__ms' }, ['◆ '].concat(mitKomma(ms.map(verweis)))) : null
            ]));
          });
        });
        if (rolle) { vorspann = ['Verantwortlich: ', verweis(rolle)]; }
      } else if (kat === 'ergebnis') {
        var ms = e.typ === 'Meilenstein';
        m.felder.forEach(function (feld) {
          var aufgaben = feld.bloecke.filter(function (b) {
            return b.ergebnisse.some(function (k) { return k.id === e.id; });
          }).map(function (b) { return b.aufgabe; });
          if (!aufgaben.length) { return; }
          merken(feld.phase, feld.modul);
          zeilen.push(ortZeile(feld.phase + ' · ' + feld.modul, feld.phase, feld.modul, ms ? aufgaben[0].id : e.id,
            [h('span', { class: 'ra-ort__leise', text: 'erzeugt von ' })].concat(mitKomma(aufgaben.map(verweis)))));
        });
      } else if (kat === 'rolle') {
        var mit = { rolle: e.begriff, bezug: 'beteiligt' };
        var summe = 0;
        m.zeilen.forEach(function (z) {
          var verantw = {}, reihe = [], beteiligt = {};
          m.felder.forEach(function (feld) {
            if (feld.phase !== z.phase) { return; }
            feld.bloecke.forEach(function (b) {
              if (b.rolle && b.rolle.id === e.id) {
                if (!verantw[b.aufgabe.id]) { verantw[b.aufgabe.id] = true; reihe.push(b.aufgabe); }
              } else if (bezugPasst(b.aufgabe, mit)) { beteiligt[b.aufgabe.id] = true; }
            });
          });
          var nBet = Object.keys(beteiligt).length;
          if (!reihe.length && !nBet) { return; }
          summe += reihe.length;
          merken(z.phase, null);
          zeilen.push(ortZeile(z.phase, z.phase, null, e.id, [
            mitKomma(reihe.map(verweis)),
            nBet ? h('span', { class: 'ra-ort__leise ra-ort__block', text: (reihe.length ? 'dazu ' : '') + 'beteiligt an ' + zahlText(nBet, 'Aufgabe', 'Aufgaben') }) : null
          ]));
        });
        vorspann = ['Verantwortet ' + zahlText(summe, 'Aufgabe', 'Aufgaben') + ' (je Phase gezählt).'];
      } else if (kat === 'phase' || kat === 'modul') {
        m.felder.forEach(function (feld) {
          if ((kat === 'phase' ? feld.phase : feld.modul) !== e.begriff) { return; }
          merken(feld.phase, feld.modul);
          var n = feld.bloecke.length;
          var entscheide = feld.bloecke.filter(function (b) { return istEntscheid(b.aufgabe); }).length;
          zeilen.push(ortZeile(kat === 'phase' ? feld.modul : feld.phase, feld.phase, feld.modul, null, [
            h('button', {
              type: 'button', class: 'ra-ort__link', text: zahlText(n, 'Aufgabe', 'Aufgaben'), title: 'Bilanz des Feldes zeigen',
              on: { click: function () { feldWaehlen(feld.phase, feld.modul, false); } }
            }),
            entscheide ? h('span', { class: 'ra-ort__leise', text: ', davon ' + zahlText(entscheide, 'Entscheid', 'Entscheide') }) : null
          ]));
        });
      }
      if (!zeilen.length) { return null; }
      var np = Object.keys(phasen).length, nm = Object.keys(module).length;
      var titel = 'Im Raster · ' + zahlText(np, 'Phase', 'Phasen') + (nm ? ' · ' + zahlText(nm, 'Modul', 'Module') : '');
      return HT.inhaltsseite.abschnitt(titel, [
        vorspann ? h('p', { class: 'ra-ort-vorspann' }, vorspann) : null,
        h('ul', { class: 'ra-orte' }, zeilen)
      ], 'ub-abschnitt--regel ra-im-raster');
    }

    function zuKnopf() {
      return h('button', {
        type: 'button', class: 'ra-inhalt__zu', 'aria-label': 'Auswahl aufheben', title: 'Auswahl aufheben (Esc)', text: '×',
        on: { click: function () { waehlen(null); } }
      });
    }

    function zahlZeile(name, zahl) {
      return h('li', { class: 'ra-ort ra-ort--zahl' }, [
        h('div', { class: 'ra-ort__was' }, name),
        h('span', { class: 'ra-ort__zahl', text: zahl })
      ]);
    }

    /* Bilanz eines Feldes (Phase × Modul) — immer das ganze Feld, auch wenn
       Rolle oder «Nur Entscheide» darin filtern: Zahlen, Meilensteine, die es
       erzeugt, Rollen (verantwortlich, beteiligt), Aufgaben und Ergebnisse
       (wie oft sie darin vorkommen). */
    function feldSeite(phase, modul) {
      var feld = null;
      m.felder.forEach(function (x) { if (x.phase === phase && x.modul === modul) { feld = x; } });
      if (!feld) { return null; }
      var bl = feld.bloecke;
      /* Ein Feld über mehrere Phasen hat in jeder dieselben Aufgaben. */
      var phasen = laufende ? laufende.feldPhasen(phase, modul) : [phase];
      var phasenText = phasen.length > 1 ? phasen[0] + ' bis ' + phasen[phasen.length - 1] : phase;
      var entscheide = bl.filter(function (b) { return istEntscheid(b.aufgabe); }).length;
      var erg = {}, ergReihe = [], ms = {}, msReihe = [], rollen = {}, rollenReihe = [];
      function rolleVon(name) {
        var r = rollen[name];
        if (!r) {
          var e = HT.daten.eintragMitBegriff(name, 'rolle');
          r = rollen[name] = { k: e ? { id: e.id, begriff: e.begriff } : null, name: name, verantw: 0, beteiligt: 0 };
          rollenReihe.push(r);
        }
        return r;
      }
      bl.forEach(function (b) {
        if (b.rolle) { rolleVon(b.rolle.begriff).verantw++; }
        var e = b.aufgabe.eintrag || HT.daten.eintragMitId(b.aufgabe.id);
        (e && e.beteiligt ? e.beteiligt : []).forEach(function (name) {
          if (!b.rolle || HT.daten.normalisieren(name) !== HT.daten.normalisieren(b.rolle.begriff)) { rolleVon(name).beteiligt++; }
        });
        b.ergebnisse.forEach(function (k) {
          var ziel = istMeilenstein(k) ? ms : erg, reihe = istMeilenstein(k) ? msReihe : ergReihe;
          if (!ziel[k.id]) { ziel[k.id] = { k: k, aufgaben: [] }; reihe.push(ziel[k.id]); }
          ziel[k.id].aufgaben.push(b.aufgabe);
        });
      });
      rollenReihe.sort(function (x, y) { return y.verantw - x.verantw || y.beteiligt - x.beteiligt || x.name.localeCompare(y.name, 'de'); });
      var ergSortiert = ergReihe.slice().sort(function (x, y) { return y.aufgaben.length - x.aufgaben.length; });

      var zahlen = [zahlText(bl.length, 'Aufgabe', 'Aufgaben') + (entscheide ? ', davon ' + zahlText(entscheide, 'Entscheid', 'Entscheide') : ''),
        zahlText(ergReihe.length, 'Ergebnis', 'Ergebnisse')];
      if (msReihe.length) { zahlen.push(zahlText(msReihe.length, 'Meilenstein', 'Meilensteine')); }

      var teile = [h('article', { class: 'ub-kopf' }, [
        h('div', { class: 'ub-kopf__zeile' }, [
          HT.inhaltsseite.ikone('modul', 24, 'ub-ikone--kopf'),
          h('span', { class: 'ub-kopf__kicker', text: 'Feld' }),
          zuKnopf()
        ]),
        h('h2', { class: 'ub-kopf__titel', text: phasenText + ' · ' + modul }),
        h('div', { class: 'ub-kopf__lead' }, h('p', { text: zahlen.join(' · ') + '.' }))
      ])];

      if (msReihe.length) {
        teile.push(HT.inhaltsseite.abschnitt('Meilensteine', [h('ul', { class: 'ra-orte' }, msReihe.map(function (x) {
          return h('li', { class: 'ra-ort ra-ort--treffer' }, h('div', { class: 'ra-ort__was' }, [
            h('span', { class: 'ra-ort__ms' }, ['◆ ', verweis(x.k)]),
            h('span', { class: 'ra-ort__leise ra-ort__block' }, ['aus '].concat(mitKomma(x.aufgaben.map(verweis))))
          ]));
        }))], 'ub-abschnitt--regel'));
      }

      teile.push(HT.inhaltsseite.abschnitt('Rollen · verantwortlich / beteiligt', [h('ul', { class: 'ra-orte' }, rollenReihe.map(function (r) {
        return zahlZeile(r.k ? verweis(r.k) : r.name, r.verantw + ' / ' + r.beteiligt);
      }))], 'ub-abschnitt--regel'));

      teile.push(HT.inhaltsseite.abschnitt('Aufgaben · ' + bl.length, [h('ul', { class: 'ra-orte' }, bl.map(function (b) {
        var n = b.ergebnisse.filter(function (k) { return !istMeilenstein(k); }).length;
        return h('li', { class: 'ra-ort ra-ort--treffer' }, h('div', { class: 'ra-ort__was' }, [
          verweis(b.aufgabe),
          h('span', { class: 'ra-ort__leise ra-ort__block', text: [b.rolle ? b.rolle.begriff : '', zahlText(n, 'Ergebnis', 'Ergebnisse')].filter(Boolean).join(' · ') })
        ]));
      }))], 'ub-abschnitt--regel'));

      if (ergSortiert.length) {
        teile.push(HT.inhaltsseite.abschnitt('Ergebnisse · ' + ergSortiert.length, [h('ul', { class: 'ra-orte' }, ergSortiert.map(function (x) {
          return zahlZeile(verweis(x.k), x.aufgaben.length > 1 ? 'bei ' + x.aufgaben.length + ' Aufgaben' : '');
        }))], 'ub-abschnitt--regel'));
      }

      var pe = HT.daten.eintragMitBegriff(phase, 'phase'), me = HT.daten.eintragMitBegriff(modul, 'modul');
      teile.push(h('section', { class: 'ub-verweise' }, [pe, me].filter(Boolean).map(function (e) {
        return h('button', {
          type: 'button', class: 'ub-verweis ub-verweis--knopf', text: (e.kategorie === 'phase' ? 'Phase ' : 'Modul ') + e.begriff,
          on: { click: function () { waehlen(e, false); } }
        });
      })));
      return teile;
    }

    /* Ohne Auswahl bei gesetztem Filter: seine Treffer als Liste, Phase für
       Phase — je Aufgabe die Module und die Meilensteine, die sie erzeugt. */
    function trefferSeite() {
      var teile = [h('div', { class: 'ub-leerseite ra-treffer' }, [
        h('h2', { class: 'ub-leerseite__titel', text: filterText() || 'Treffer' }),
        h('p', { class: 'ub-leerseite__text', text: trefferText() + '. Ein Klick auf eine Aufgabe zeigt ihre Seite.' })
      ])];
      a.zeilen.forEach(function (z) {
        var nachId = {}, reihe = [];
        a.felder.forEach(function (x) {
          if (x.feld.phase !== z.phase) { return; }
          x.bloecke.forEach(function (b) {
            var t = nachId[b.aufgabe.id];
            if (!t) { t = nachId[b.aufgabe.id] = { aufgabe: b.aufgabe, module: [], ms: [] }; reihe.push(t); }
            if (t.module.indexOf(x.feld.modul) === -1) { t.module.push(x.feld.modul); }
            b.ergebnisse.filter(istMeilenstein).forEach(function (k) {
              if (!t.ms.some(function (y) { return y.id === k.id; })) { t.ms.push(k); }
            });
          });
        });
        if (!reihe.length) { return; }
        teile.push(HT.inhaltsseite.abschnitt(z.phase + ' · ' + reihe.length, [
          h('ul', { class: 'ra-orte' }, reihe.map(function (t) {
            return h('li', { class: 'ra-ort ra-ort--treffer' }, [
              h('div', { class: 'ra-ort__was' }, [
                verweis(t.aufgabe),
                h('span', { class: 'ra-ort__leise ra-ort__block', text: t.module.join(', ') }),
                t.ms.length ? h('span', { class: 'ra-ort__ms ra-ort__block' }, ['◆ '].concat(mitKomma(t.ms.map(verweis)))) : null
              ])
            ]);
          }))
        ], 'ub-abschnitt--regel'));
      });
      return teile;
    }

    function leerSeite() {
      return [h('div', { class: 'ub-leerseite' }, [
        h('h2', { class: 'ub-leerseite__titel', text: 'Noch nichts ausgewählt' }),
        h('p', { class: 'ub-leerseite__text', text: 'Ein Klick auf eine Aufgabe, ein Ergebnis, eine Rolle, einen Meilenstein, eine Phase oder einen Modulkopf zeigt hier seine Seite und wo es im Raster steht. Ist ein Filter gesetzt, stehen hier seine Treffer.' }),
        h('p', { class: 'ub-leerseite__text' }, [
          'Oder Schritt für Schritt: Der ',
          h('button', { type: 'button', class: 'ra-ort__link', text: 'Rundgang', on: { click: function () { reiterWaehlen('rundgang'); } } }),
          ' führt durch die ganze Methode — entlang der Ergebnisse, Phase für Phase oder Rolle für Rolle.'
        ])
      ].concat(HT.inhaltsseite.legende()))];
    }

    /* Reiter «Rundgang» ohne laufenden Weg: die Wege zur Wahl. */
    function wahlSeite() {
      var teile = [h('div', { class: 'ub-leerseite ra-tourwahl' }, [
        h('h2', { class: 'ub-leerseite__titel', text: 'Rundgang' }),
        h('p', { class: 'ub-leerseite__text', text: 'Schritt für Schritt durch die Methode: Links zeigt das Raster, worum es geht, und hebt es hervor; hier steht, was es bedeutet. Weiter und zurück mit den Knöpfen unten oder den Pfeiltasten.' })
      ])];
      if (!lp) {
        lpHolen();
        teile.push(h('p', { class: 'ra-tourwahl__laden', role: 'status', text: 'Wird geladen …' }));
        return teile;
      }
      teile.push(h('div', { class: 'ra-tourwahl__liste' }, HT.rundgang.REISEN.map(function (r) {
        var n = HT.rundgang.schritte(r.id, lp, m).length;
        return h('button', {
          type: 'button', class: 'ra-tourwahl__weg', disabled: !n,
          on: { click: function () { reiseStarten(r.id, 0); } }
        }, [
          h('span', { class: 'ra-tourwahl__titel', text: r.titel }),
          h('span', { class: 'ra-tourwahl__kurz', text: r.kurz }),
          h('span', { class: 'ra-tourwahl__zahl', text: zahlText(n, 'Schritt', 'Schritte') + ' · ' + (vorgehen === 'agil' ? 'agil' : 'klassisch') })
        ]);
      })));
      return teile;
    }

    /* Eine Zeile der Listen eines Schritts: links wo (springt ins Feld),
       rechts das Element, darunter Rolle oder Module, die Ergebnisse und
       Meilensteine — dieselben Zeilen wie «Im Raster». */
    function faktZeile(z) {
      var links = z.links && z.links.length ? mitKomma(z.links.map(verweis)) : [];
      var inhalt = z.k ? [
        z.nr ? h('span', { class: 'ra-ort__nr', text: z.nr + '.' }) : null,
        verweis(z.k),
        z.text ? h('span', { class: 'ra-ort__leise ra-ort__block', text: z.text }) : null,
        links.length ? h('span', { class: 'ra-ort__block ra-tour__folge' }, ['→ '].concat(links)) : null
      ] : [z.text ? h('span', { class: 'ra-ort__leise', text: z.text }) : null].concat(links);
      if (z.nachsatz) { inhalt.push(h('span', { class: 'ra-ort__leise ra-ort__block', text: z.nachsatz })); }
      if (z.ms && z.ms.length) { inhalt.push(h('span', { class: 'ra-ort__ms' }, ['◆ '].concat(mitKomma(z.ms.map(verweis))))); }
      if (z.wo && z.phase) { return ortZeile(z.wo, z.phase, z.modul || null, z.zeigeId || null, inhalt); }
      if (z.wo) {
        return h('li', { class: 'ra-ort' }, [
          h('span', { class: 'ra-ort__wo ra-ort__wo--text', text: z.wo }),
          h('div', { class: 'ra-ort__was' }, inhalt)
        ]);
      }
      return h('li', { class: 'ra-ort ra-ort--treffer' }, h('div', { class: 'ra-ort__was' }, inhalt));
    }

    /* --- Zitate im Rundgang ---
       Wörtlich aus dem Handbuch: die Elementseite (HT.inhaltsseite.zitat)
       oder ein Abschnitt des Referenzhandbuchs. Lange Texte enden sichtbar
       mit «Weiterlesen»; der Rest steht eine Stelle weiter. */
    var rhbTexte = {};
    function rhbAbschnitt(kapitel, nummer) {
      var k = rhbTexte[kapitel];
      if (k === undefined) {
        rhbTexte[kapitel] = 'laedt';
        HT.daten.rhbKapitel(kapitel).then(function (x) { rhbTexte[kapitel] = x || null; })
          .catch(function () { rhbTexte[kapitel] = null; })
          .then(zitatNachgeladen);
        return undefined;
      }
      if (k === 'laedt') { return undefined; }
      if (!k) { return null; }
      return (k.abschnitte || []).filter(function (a) { return a.nummer === nummer; })[0] || null;
    }

    function zitatNachgeladen() {
      if (reise && reiter === reiseReiter() && document.body.contains(huelle)) { inhaltZeichnen(); }
    }

    var ZITAT_LAENGE = 1400;
    function kuerzen(bs) {
      var aus = [], n = 0;
      for (var j = 0; j < bs.length; j++) {
        var l = JSON.stringify(bs[j]).length;
        if (aus.length && n + l > ZITAT_LAENGE) { return { bloecke: aus, mehr: true }; }
        aus.push(bs[j]);
        n += l;
      }
      return { bloecke: aus, mehr: false };
    }

    function imFenster(ev) {
      if (!HT.handbuch || !HT.handbuch.imFenster) { return; }
      ev.preventDefault();
      HT.handbuch.imFenster(ev.currentTarget.getAttribute('href'));
    }

    function zitatBlock(q) {
      var bs, quelle, mehr, ort;
      var laden = h('p', { class: 'ra-zitat__laden', text: 'Handbuchtext wird geladen …' });
      if (q.rhb) {
        var ab = rhbAbschnitt(q.rhb, q.nummer);
        if (ab === undefined) { return laden; }
        if (!ab) { return null; }
        bs = ab.bloecke || [];
        var adresse = HT.handbuch.adresse(q.rhb, q.nummer);
        ort = HT.handbuch.markOrtVon(q.rhb, rhbTexte[q.rhb], q.nummer);
        quelle = h('a', { class: 'ra-zitat__quelle', href: adresse, text: 'Referenzhandbuch ' + q.nummer + ' · ' + ab.titel, on: { click: imFenster } });
        mehr = h('a', { class: 'ra-zitat__mehr', href: adresse, text: 'Weiterlesen im Handbuch', on: { click: imFenster } });
      } else {
        var e = HT.daten.eintragMitId(q.element);
        if (!e) { return null; }
        bs = HT.inhaltsseite.zitat(e, q.abschnitt, zitatNachgeladen);
        if (bs === undefined) { return laden; }
        if (!bs) { return null; }
        var wahl = function () { waehlen(e.id, false); };
        ort = '#/handbuch?id=' + encodeURIComponent(e.id);
        quelle = h('button', { type: 'button', class: 'ra-zitat__quelle', text: 'Handbuch · ' + e.begriff + (q.abschnitt ? ' · ' + q.abschnitt : ''), on: { click: wahl } });
        mehr = h('button', { type: 'button', class: 'ra-zitat__mehr', text: 'Weiterlesen im Handbuch', on: { click: wahl } });
      }
      var k = kuerzen(bs);
      return h('figure', { class: 'ra-zitat' }, [
        h('figcaption', {}, quelle),
        /* Derselbe Ort wie die Stelle im Handbuch: Markierungen von dort
           erscheinen hier und umgekehrt (js/markieren.js, als Auszug). */
        h('blockquote', { class: 'ra-zitat__text', dataset: ort ? { markOrt: ort, markAuszug: '' } : {} },
          HT.ui.bloecke(k.bloecke, { verlinken: false, ebene: 4 })),
        k.mehr ? mehr : null
      ]);
    }

    /* Ein Schritt: oben der Weg, Stand und ×; dann Kicker, Titel, die
       Zitate aus dem Handbuch und Hinweise, die Ketten und Listen aus unseren
       Daten, alle Schritte zum Springen; unten fest Zurück und Weiter. */
    function schrittSeite() {
      var s = schritt(), n = reise.schritte.length, i = reise.i;
      var weg = HT.rundgang.REISEN.filter(function (r) { return r.id === reise.id; })[0];
      var teile = [];
      teile.push(h('div', { class: 'ra-tour__kopf' }, [
        h('span', { class: 'ra-tour__weg', text: weg ? weg.titel : 'Rundgang' }),
        h('span', { class: 'ra-tour__kapitel', text: s.kapitel }),
        h('button', {
          type: 'button', class: 'ra-inhalt__zu', 'aria-label': 'Rundgang beenden', title: 'Rundgang beenden', text: '×',
          on: { click: reiseBeenden }
        })
      ]));
      teile.push(h('div', { class: 'ra-tour__fortschritt', 'aria-hidden': 'true' },
        h('span', { style: 'width: ' + ((i + 1) / n * 100).toFixed(1) + '%' })));

      teile.push(h('article', { class: 'ub-kopf ra-tour__text' }, [
        h('div', { class: 'ub-kopf__zeile' }, h('span', { class: 'ub-kopf__kicker', text: s.kicker || '' })),
        h('h2', { class: 'ub-kopf__titel ra-tour__titel', text: HT.gesamtbild.trennen(s.titel) })
      ].concat((s.zitate || []).map(zitatBlock)).concat((s.hinweis || []).map(function (t) {
        return h('p', { class: 'ra-tour__hinweis', text: t });
      }))));

      /* Je Aufgabe eine Kette Rolle → Aufgabe → Ergebnisse in den Kästen des
         Rasters; darüber wo (springt ins Feld), darunter die beteiligten
         Rollen. Ein Kasten zeigt seine Seite. */
      if (s.ketten && s.ketten.length) {
        teile.push(HT.inhaltsseite.abschnitt(s.kettenTitel || 'Rolle → Aufgabe → Ergebnis', [h('ul', { class: 'ra-ketten' }, s.ketten.map(function (z) {
          function kasten(k) {
            if (!k) { return h('span', { class: 'ra-kette__leer', text: 'ohne Rolle' }); }
            var el = knoten(k);
            el.addEventListener('click', function () { waehlen(k.id, false); });
            el.title = k.begriff + ' — Seite zeigen';
            return el;
          }
          var pfeil = function () { return h('span', { class: 'ra-kette__pfeil', 'aria-hidden': 'true', text: '→' }); };
          return h('li', { class: 'ra-kette' }, [
            z.wo ? h('button', {
              type: 'button', class: 'ra-ort__wo ra-kette__wo', text: z.wo, title: 'Im Raster zeigen',
              on: { click: function () { if (laufende) { laufende.stelleZeigen(z.phase, z.modul, z.zeigeId || null); } } }
            }) : null,
            h('div', { class: 'ra-kette__reihe' }, [
              kasten(z.rolle), pfeil(), kasten(z.aufgabe), pfeil(),
              z.ergebnisse.length ? h('div', { class: 'ra-kette__ergebnisse' }, z.ergebnisse.map(kasten))
                : h('span', { class: 'ra-kette__leer', text: 'kein Ergebnis' })
            ]),
            z.beteiligt.length ? h('p', { class: 'ra-kette__beteiligt' }, ['Beteiligt: '].concat(mitKomma(z.beteiligt.map(function (name) {
              var r = HT.daten.eintragMitBegriff(name, 'rolle');
              return r ? verweis(r) : name;
            })))) : null
          ]);
        }))], 'ub-abschnitt--regel'));
      }

      (s.fakten || []).forEach(function (fk) {
        if (!fk.zeilen || !fk.zeilen.length) { return; }
        teile.push(HT.inhaltsseite.abschnitt(fk.titel, [h('ul', { class: 'ra-orte' }, fk.zeilen.map(faktZeile))], 'ub-abschnitt--regel'));
      });

      teile.push(alleSchritte('Alle ' + n + ' Schritte'));
      teile.push(fussLeiste());
      return teile;
    }

    /* Alle Schritte des laufenden Wegs, nach Kapiteln — zum Springen. */
    function alleSchritte(titel) {
      var i = reise.i, gruppen = [], letzte = null;
      reise.schritte.forEach(function (x, j) {
        if (!letzte || letzte.kapitel !== x.kapitel) { letzte = { kapitel: x.kapitel, schritte: [] }; gruppen.push(letzte); }
        letzte.schritte.push({ s: x, j: j });
      });
      var alle = h('details', { class: 'ra-tour__alle' }, [h('summary', { text: titel })].concat(gruppen.map(function (g) {
        return h('div', { class: 'ra-tour__gruppe' }, [
          h('h3', { class: 'ub-mikro', text: g.kapitel }),
          h('ol', { class: 'ra-tour__schritte' }, g.schritte.map(function (y) {
            return h('li', {}, h('button', {
              type: 'button', class: 'ra-tour__schritt', 'aria-current': y.j === i ? 'step' : null,
              on: { click: function () { schrittGehen(y.j); } }
            }, [h('span', { class: 'ra-tour__nr', text: String(y.j + 1) }), h('span', { text: y.s.titel })]));
          }))
        ]);
      })));
      alle.open = alleOffen;
      alle.addEventListener('toggle', function () { alleOffen = alle.open; });
      return alle;
    }

    /* Unten fest: Zurück, Stand, Weiter bzw. Beenden. */
    function fussLeiste() {
      var n = reise.schritte.length, i = reise.i;
      return h('div', { class: 'ra-tour__fuss' }, [
        h('button', {
          type: 'button', class: 'ra-tour__knopf', disabled: i === 0, title: 'Zurück (Pfeil links)',
          on: { click: function () { schrittGehen(i - 1); } }
        }, [HT.ui.symbol(IKONE_ZURUECK, 16), h('span', { text: 'Zurück' })]),
        h('span', { class: 'ra-tour__stand', text: (i + 1) + ' / ' + n }),
        i < n - 1 ? h('button', {
          type: 'button', class: 'ra-tour__knopf ra-tour__knopf--weiter', title: 'Weiter (Pfeil rechts)',
          on: { click: function () { schrittGehen(i + 1); } }
        }, [h('span', { text: 'Weiter' }), HT.ui.symbol(IKONE_WEITER, 16)])
          : h('button', {
            type: 'button', class: 'ra-tour__knopf ra-tour__knopf--weiter', text: 'Beenden',
            on: { click: reiseBeenden }
          })
      ]);
    }

    /* --- Fragen --- */

    /** Startet die Fragen bei der Frage mit dieser id (sonst bei der ersten). */
    function fragenStarten(id) {
      if (!fragenStand || !HT.fragen) { return; }
      var schritte = HT.fragen.schritte(fragenStand.daten);
      if (!schritte.length) { return; }
      var i = 0;
      schritte.forEach(function (x, k) { if (x.id === id) { i = k; } });
      reise = { id: 'fragen', schritte: schritte, i: i, antwort: null, offen: {} };
      reiter = 'fragen';
      auswahl = null;
      feldWahl = null;
      popOffen = false;
      if (!seiteZustand.offen) { seiteOeffnen(true); }
      schrittZeigen();
    }

    /* Klick auf eine Antwort: aufdecken und ihre Stellen hervorheben; ein
       zweiter Klick hebt die Hervorhebung auf (aufgedeckt bleibt sie). */
    function antwortWaehlen(k) {
      reise.offen[k] = true;
      reise.antwort = reise.antwort === k ? null : k;
      zeichnen({ zumZiel: true, wennNoetig: true });
    }

    function alleAufdecken() {
      schritt().frage.antworten.forEach(function (x, k) { reise.offen[k] = true; });
      inhaltZeichnen();
    }

    /* Reiter «Fragen» ohne laufende Frage: die Fragen zur Wahl, je Dokument. */
    function fragenWahlSeite() {
      var d = fragenStand ? fragenStand.daten : null;
      var teile = [h('div', { class: 'ub-leerseite ra-tourwahl' }, [
        h('h2', { class: 'ub-leerseite__titel', text: 'Fragen' }),
        h('p', { class: 'ub-leerseite__text', text: 'Prüfungsfragen im Gesamtbild: Ein Klick auf eine Antwort deckt sie auf, hebt ihre Stellen im Raster hervor und zeigt den Auszug aus dem Handbuch. Weiter und zurück mit den Knöpfen unten oder den Pfeiltasten.' })
      ])];
      if (!d) { return teile; }
      d.dokumente.forEach(function (dok) {
        var fragen = d.fragen.filter(function (f) { return f.dokument === dok.id; });
        if (!fragen.length) { return; }
        teile.push(h('h3', { class: 'ub-mikro ra-fragenwahl__dok', text: dok.titel }));
        teile.push(h('div', { class: 'ra-tourwahl__liste' }, fragen.map(function (f) {
          return h('button', { type: 'button', class: 'ra-tourwahl__weg', on: { click: function () { fragenStarten(f.id); } } }, [
            h('span', { class: 'ra-tourwahl__titel', text: f.id + (f.stufe ? ' · ' + f.stufe : '') }),
            h('span', { class: 'ra-tourwahl__kurz ra-fragenwahl__text', text: f.frage })
          ]);
        })));
      });
      return teile;
    }

    /* Eine Frage: oben Dokument, Stand und ×; die Frage, wie man sie liest,
       die Antworten zum Aufdecken — die gewählte mit Begründung und Auszügen
       aus dem Handbuch; sind alle aufgedeckt, Tipp und Merksätze. */
    function frageSeite() {
      var s = schritt(), f = s.frage, n = reise.schritte.length, i = reise.i;
      var alleAuf = f.antworten.every(function (x, k) { return reise.offen[k]; });
      var teile = [];
      teile.push(h('div', { class: 'ra-tour__kopf' }, [
        h('span', { class: 'ra-tour__weg', text: 'Fragen' }),
        h('span', { class: 'ra-tour__kapitel', text: s.kapitel }),
        h('button', {
          type: 'button', class: 'ra-inhalt__zu', 'aria-label': 'Fragen beenden', title: 'Fragen beenden', text: '×',
          on: { click: reiseBeenden }
        })
      ]));
      teile.push(h('div', { class: 'ra-tour__fortschritt', 'aria-hidden': 'true' },
        h('span', { style: 'width: ' + ((i + 1) / n * 100).toFixed(1) + '%' })));

      teile.push(h('article', { class: 'ub-kopf ra-tour__text' }, [
        h('div', { class: 'ub-kopf__zeile' }, h('span', { class: 'ub-kopf__kicker',
          text: [f.id, f.stufe, s.vorgehen === 'agil' ? 'agil' : null].filter(Boolean).join(' · ') })),
        f.situation ? h('p', { class: 'ra-frage__situation', text: f.situation }) : null,
        h('p', { class: 'ra-frage__text', text: f.frage })
      ].concat((f.lesart || []).map(function (t) { return h('p', { class: 'ra-tour__hinweis', text: t }); }))));

      teile.push(h('ol', { class: 'ra-antworten' }, f.antworten.map(function (x, k) {
        var auf = !!reise.offen[k], fokus = reise.antwort === k, marke = String.fromCharCode(97 + k);
        return h('li', { class: 'ra-antwort' + (auf ? (x.richtig ? ' ist-richtig' : ' ist-falsch') : '') + (fokus ? ' ist-fokus' : '') }, [
          h('button', {
            type: 'button', class: 'ra-antwort__knopf', 'aria-expanded': fokus ? 'true' : 'false',
            title: fokus ? 'Hervorhebung aufheben' : 'Aufdecken und im Raster zeigen',
            on: { click: function () { antwortWaehlen(k); } }
          }, [
            h('span', { class: 'ra-antwort__marke', text: marke }),
            h('span', { class: 'ra-antwort__text', text: x.text }),
            auf ? h('span', { class: 'nur-sr', text: x.richtig ? ' — richtig' : ' — falsch' }) : null
          ]),
          auf && x.warum ? h('p', { class: 'ra-antwort__warum', text: x.warum }) : null,
          fokus ? h('div', { class: 'ra-antwort__zitate' }, (s.antworten[k].zitate || []).map(zitatBlock)) : null
        ]);
      })));
      if (!alleAuf) {
        teile.push(h('div', { class: 'btn-reihe ra-antworten__knoepfe' }, [
          h('button', { type: 'button', class: 'btn btn--klein', text: 'Alle aufdecken', on: { click: alleAufdecken } })
        ]));
      }

      if (alleAuf && f.tipp && f.tipp.text) {
        teile.push(HT.inhaltsseite.abschnitt(f.tipp.eigen ? 'Erläuterung' : 'Tipp aus dem Dokument', [
          h('p', { class: 'ra-frage__tipp' + (f.tipp.eigen ? ' ra-frage__tipp--eigen' : ''), text: f.tipp.text }),
          (f.tipp.verweise || []).length ? h('p', { class: 'ra-frage__verweise' }, mitKomma(f.tipp.verweise.map(function (v) {
            if (!v.kapitel) { return h('span', { class: 'ra-frage__alt', title: 'Diese Nummer gibt es im heutigen Handbuch nicht', text: v.nummer + ' (nicht im heutigen Handbuch)' }); }
            return h('a', { class: 'ra-ort__link', href: HT.handbuch.adresse(v.kapitel, v.nummer), text: v.nummer + ' ' + (v.titel || ''), on: { click: imFenster } });
          }))) : null
        ], 'ub-abschnitt--regel'));
      }
      if (alleAuf && f.merksaetze && f.merksaetze.length) {
        teile.push(HT.inhaltsseite.abschnitt('Merksätze', [h('ul', { class: 'ra-frage__merksaetze' },
          f.merksaetze.map(function (t) { return h('li', { text: t }); }))], 'ub-abschnitt--regel'));
      }

      teile.push(alleSchritte('Alle ' + n + ' Fragen'));
      teile.push(fussLeiste());
      return teile;
    }

    if (HT.fragen) {
      HT.fragen.laden().then(function (st) {
        fragenStand = st;
        if (!document.body.contains(huelle)) { return; }
        if (!st && reiter === 'fragen') { reiter = 'handbuch'; frageWunsch = null; }
        if (frageWunsch && st && rasterBereit) { var w = frageWunsch; frageWunsch = null; fragenStarten(w); return; }
        if (rasterBereit) { inhaltZeichnen(); }
      });
    }

    function inhaltZeichnen() {
      reiterZeichnen();
      if (!m || !a) { return; }
      var vorher = seiteText.scrollTop;
      HT.ui.leeren(seiteText);
      var e = reiter === 'handbuch' ? auswahl : null, teile, schluessel;
      /* Ort für Markierungen — derselbe wie die Karte im Handbuch. */
      if (e) { seiteText.dataset.markOrt = '#/handbuch?id=' + encodeURIComponent(e.id); }
      else { delete seiteText.dataset.markOrt; }
      seiteText.classList.toggle('ist-rundgang', reiter === 'rundgang' || reiter === 'fragen');
      if (reiter === 'rundgang') {
        var tour = reise && reise.id !== 'fragen';
        teile = tour ? schrittSeite() : wahlSeite();
        schluessel = tour ? 'tour:' + reise.id + ':' + reise.i : 'tourwahl';
      } else if (reiter === 'fragen') {
        var frage = reise && reise.id === 'fragen';
        teile = frage ? frageSeite() : fragenWahlSeite();
        schluessel = frage ? 'frage:' + reise.i : 'fragenwahl';
      } else if (e) {
        teile = HT.inhaltsseite.seite(e, {
          beiGeladen: function (id) { if (auswahl && auswahl.id === id && document.body.contains(huelle)) { inhaltZeichnen(); } }
        });
        var zeile = teile[0].querySelector('.ub-kopf__zeile');
        if (zeile) { zeile.appendChild(zuKnopf()); }
        var ort = imRaster(e);
        if (ort) { teile.splice(1, 0, ort); }
        teile.push(HT.inhaltsseite.verweise(e));
        schluessel = e.id;
      } else if (feldWahl && (teile = feldSeite(feldWahl.phase, feldWahl.modul))) {
        schluessel = 'feld:' + feldWahl.phase + '|' + feldWahl.modul;
      } else if (!reise && filterAktiv(filter)) {
        teile = trefferSeite();
        schluessel = 'treffer';
      } else {
        teile = leerSeite();
        schluessel = '';
      }
      teile.forEach(function (t) { seiteText.appendChild(t); });
      /* Nur beim Wechsel nach oben springen — Nachzeichnen (Handbuchtext,
         Filter) behält die Leseposition. */
      if (gezeichnet !== schluessel) { seiteText.scrollTop = 0; gezeichnet = schluessel; }
      else { seiteText.scrollTop = vorher; }
    }

    /* Nach jeder Änderung am Filter: Adresse, Raster, Leiste, Popover. */
    function geaendert() {
      adresseSetzen();
      zeichnen();
    }

    function listeSchalten(feld, name, alle) {
      var l = filter[feld];
      if (!l) { l = [name]; }
      else if (l.length === 1 && l[0] === name) { l = null; }
      else {
        l = l.slice();
        var i = l.indexOf(name);
        if (i === -1) { l.push(name); } else { l.splice(i, 1); }
        if (!l.length || alle.every(function (n) { return l.indexOf(n) !== -1; })) { l = null; }
      }
      filter[feld] = l;
      geaendert();
    }

    function alleModule() { return HT.daten.eintraegeDerKategorie('modul').map(function (x) { return x.begriff; }); }

    var aktionen = {
      modul: function (name) { listeSchalten('module', name, alleModule()); },
      phase: function (name) { listeSchalten('phasen', name, m.phasen); },
      waehlen: function (id) { waehlen(id, true); },
      feld: function (phase, modul) { feldWaehlen(phase, modul, true); },
      klappen: function (art, name) { zuUmschalten(zu, art, name); zuSpeichern(ZU_SPEICHER, zu); zeichnen(); }
    };

    /* --- Popover --- */

    /* Aufbau: oben in der Kopfzeile des Popovers die Trefferzahl, der Schalter
       «Nur Entscheide» (Raute) und «Aufheben»; darunter vier gleich gebaute
       Spalten — Phasen, Szenarien, Module, Rolle —, jede mit dem Zeichen ihrer
       Kategorie im Titel und derselben Zeile (Kasten oder Punkt, Name, Zahl).
       Die Vorgehensweise steht schon in der Leiste und fehlt hier. */
    var IKONE_RAUTE = ['M12 3.5 20.5 12 12 20.5 3.5 12Z'];

    function titelZeile(kat, titel, rechts) {
      return h('div', { class: 'rf-titel' }, [
        h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 12)),
        h('h3', { class: 'rf-titel__text', text: titel }),
        rechts || null
      ]);
    }

    /* Erste Zeile der Liste: «Alle …» als Kasten — an, wenn alle gewählt
       sind, halb, wenn einige; ein Klick wählt alle, sind schon alle
       gewählt, keine. */
    function alleZeile(feld, label) {
      var l = filter[feld];
      var z = zeile('checkbox', !l, 'Alle ' + label, undefined, function () {
        filter[feld] = l ? null : [];
        geaendert();
      }, 'alle:' + feld);
      z.classList.add('rf-zeile--alle');
      if (l && l.length) { z.setAttribute('aria-checked', 'mixed'); z.querySelector('input').indeterminate = true; }
      z.title = l ? 'Alle ' + label + ' zeigen' : 'Keine ' + label + ' zeigen';
      return z;
    }

    /* Eine Zeile: Kasten (mehrfach) oder Punkt (eines), Name, Zahl. */
    function zeile(art, an, name, zahl, beiWechsel, fokus) {
      var eingabe = h('input', { type: art, class: 'gs-schalter__eingabe', 'data-fokus': fokus, tabindex: '-1' });
      eingabe.checked = an;
      return h('button', {
        type: 'button', class: 'rf-zeile', role: art === 'radio' ? 'radio' : 'checkbox',
        'aria-checked': an ? 'true' : 'false', 'data-fokus': fokus,
        on: { click: beiWechsel }
      }, [
        eingabe,
        h('span', { class: 'rf-zeile__name', text: name }),
        zahl === undefined ? null : h('span', { class: 'rf-zeile__zahl', text: String(zahl) })
      ]);
    }

    function haken(feld, name, alle) {
      var an = gezeigt(filter[feld], name);
      return zeile('checkbox', an, name, undefined, function () {
        var l = filter[feld] ? filter[feld].slice() : alle.slice();
        var i = l.indexOf(name);
        if (i === -1) { l.push(name); } else { l.splice(i, 1); }
        filter[feld] = alle.every(function (n) { return l.indexOf(n) !== -1; }) ? null : l;
        geaendert();
      }, feld + ':' + name);
    }

    function trefferText() {
      if (!a) { return ''; }
      var t = a.treffer;
      var was = filter.entscheide ? (t.aufgaben === 1 ? 'Entscheid' : 'Entscheide') : (t.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben');
      return t.aufgaben + ' ' + was + ' · ' + t.phasen + (t.phasen === 1 ? ' Phase' : ' Phasen') + ' · '
        + t.module + (t.module === 1 ? ' Modul' : ' Module');
    }

    /** Was gefiltert ist, kurz — für die Pille in der Leiste. */
    function filterText() {
      var teile = [];
      if (filter.rolle) {
        teile.push(filter.rolle + (filter.bezug === 'verantwortlich' ? '' : filter.bezug === 'beteiligt' ? ' (beteiligt)' : ' (verantw. oder beteiligt)'));
      }
      if (filter.entscheide) { teile.push('Nur Entscheide'); }
      [['phasen', 'Phase', 'Phasen'], ['module', 'Modul', 'Module']].forEach(function (d) {
        var l = filter[d[0]];
        if (!l) { return; }
        if (!l.length) { teile.push('keine ' + d[2]); }
        else if (l.length <= 2) { teile.push(l.join(', ')); }
        else { teile.push(l.length + ' ' + d[2]); }
      });
      return teile.join(' · ');
    }

    function entscheideKnopf() {
      return h('button', {
        type: 'button', class: 'rf-entscheide', 'aria-pressed': filter.entscheide ? 'true' : 'false', 'data-fokus': 'entscheide',
        title: filter.entscheide ? 'Wieder alle Aufgaben zeigen' : 'Nur die Entscheidungsaufgaben zeigen',
        on: { click: function () {
          filter.entscheide = !filter.entscheide;
          /* Ein Filter auf Aufgaben braucht die Aufgaben im Bild. */
          if (filter.entscheide && !sicht.aufgabe) { sicht.aufgabe = true; sichtSpeichern(sicht); }
          geaendert();
        } }
      }, [HT.ui.symbol(IKONE_RAUTE, 13), h('span', { text: 'Nur Entscheide' })]);
    }

    function bezugKnoepfe() {
      var glyphe = { verantwortlich: ['verantwortlich'], beteiligt: ['beteiligt'], beides: ['verantwortlich', 'beteiligt'] };
      return h('div', { class: 'rf-bezug', role: 'group', 'aria-label': 'Bezug der Rolle' }, BEZUEGE.map(function (b) {
        var an = filter.bezug === b.key;
        return h('button', {
          type: 'button', class: 'rf-bezug__knopf', 'aria-pressed': an ? 'true' : 'false', 'data-fokus': 'bezug:' + b.key,
          title: b.key === 'beides' ? 'Verantwortlich oder beteiligt' : b.label, 'aria-label': b.label,
          on: { click: function () { if (!an) { filter.bezug = b.key; geaendert(); } } }
        }, glyphe[b.key].map(function (g) { return h('span', { class: 'glinie glinie--' + g, 'aria-hidden': 'true' }); }));
      }));
    }

    function popInhalt() {
      var module = alleModule();
      var jeRolle = aufgabenJeRolle(m, filter);
      var szenarien = HT.daten.eintraegeDerKategorie('szenario').map(function (sz) {
        var mods = HT.graph.szenarioModule(sz.id) || [];
        var an = !!filter.module && filter.module.length === mods.length && mods.every(function (x) { return filter.module.indexOf(x) !== -1; });
        return zeile('radio', an, sz.begriff, undefined, function () { filter.module = an ? null : mods.slice(); geaendert(); }, 'sz:' + sz.id);
      });
      var rollen = HT.daten.eintraegeDerKategorie('rolle').map(function (r) { return r.begriff; })
        .filter(function (name) { return jeRolle[name] > 0 || filter.rolle === name; })
        .sort(function (x, y) { return jeRolle[y] - jeRolle[x] || x.localeCompare(y, 'de'); });
      var bezugName = { verantwortlich: 'verantwortlich', beteiligt: 'beteiligt', beides: 'verantw. oder beteiligt' }[filter.bezug];

      return h('div', { class: 'gpop__inhalt rf' }, [
        h('section', { class: 'rf-spalte' }, [
          titelZeile('phase', 'Phasen'),
          h('div', { class: 'rf-liste', role: 'group', 'aria-label': 'Phasen' }, [alleZeile('phasen', 'Phasen')].concat(m.phasen.map(function (p) { return haken('phasen', p, m.phasen); })))
        ]),
        h('section', { class: 'rf-spalte' }, [
          titelZeile('szenario', 'Szenario'),
          h('div', { class: 'rf-liste', role: 'radiogroup', 'aria-label': 'Szenario' }, szenarien)
        ]),
        h('section', { class: 'rf-spalte rf-spalte--zwei' }, [
          titelZeile('modul', 'Module'),
          h('div', { class: 'rf-liste rf-liste--zwei', role: 'group', 'aria-label': 'Module' }, [alleZeile('module', 'Module')].concat(module.map(function (x) { return haken('module', x, module); })))
        ]),
        h('section', { class: 'rf-spalte rf-spalte--zwei' }, [
          titelZeile('rolle', 'Rolle · ' + bezugName, bezugKnoepfe()),
          h('div', { class: 'rf-liste rf-liste--zwei', role: 'radiogroup', 'aria-label': 'Rolle' }, rollen.map(function (name) {
            var an = filter.rolle === name;
            return zeile('radio', an, name, jeRolle[name], function () { filter.rolle = an ? '' : name; geaendert(); }, 'rolle:' + name);
          }))
        ])
      ]);
    }

    function popZeichnen(fokusSetzen) {
      var scroll = pop.scrollTop;
      var aktiv = document.activeElement;
      var fokusKey = aktiv && pop.contains(aktiv) ? aktiv.getAttribute('data-fokus') : null;
      HT.ui.leeren(pop);
      /* Im Rundgang bestimmt der Schritt, was das Raster zeigt. */
      if (reise) { popOffen = false; }
      pop.hidden = !popOffen || !m;
      filterKnopf.disabled = !!reise;
      filterKnopf.setAttribute('aria-expanded', popOffen ? 'true' : 'false');
      filterKnopf.classList.toggle('ist-aktiv', !reise && filterAktiv(filter));
      filterKnopf.title = reise ? 'Filter: im Rundgang zeigt das Raster, was der Schritt zeigt'
        : filterAktiv(filter) ? 'Filter: ' + filterText() : 'Filter: Phasen, Module, Rolle, Entscheide';
      if (pop.hidden) { return; }
      pop.appendChild(h('div', { class: 'gpop__kopf rf-kopf' }, [
        h('strong', { class: 'gpop__titel', text: 'Filter' }),
        h('span', { class: 'rf-kopf__treffer', role: 'status', text: trefferText() }),
        entscheideKnopf(),
        filterAktiv(filter) ? h('button', {
          type: 'button', class: 'gauswahl__reset rf-kopf__aufheben', text: 'Aufheben',
          title: 'Alle Filter aufheben', on: { click: function () { filter = leererFilter(); geaendert(); } }
        }) : null,
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Filter schliessen', text: '✕', on: { click: function () { popOffen = false; popZeichnen(); filterKnopf.focus(); } } })
      ]));
      pop.appendChild(popInhalt());
      pop.scrollTop = scroll;
      var wieder = fokusKey ? pop.querySelector('button[data-fokus="' + fokusKey.replace(/"/g, '') + '"]') : null;
      if (wieder) { wieder.focus({ preventScroll: true }); }
      else if (fokusSetzen) { var erstes = pop.querySelector('.rf button'); if (erstes) { erstes.focus(); } }
    }

    /* Klick daneben und Escape schliessen. */
    function draussen(ev) {
      if (!document.body.contains(huelle)) {
        document.removeEventListener('pointerdown', draussen, true);
        document.removeEventListener('keydown', taste);
        return;
      }
      if (!popOffen) { return; }
      if (pop.contains(ev.target) || filterKnopf.contains(ev.target) || (ev.target.closest && ev.target.closest('.rf-pille'))) { return; }
      popOffen = false;
      popZeichnen();
    }
    function taste(ev) {
      if (!document.body.contains(huelle)) { return; }
      /* Im Rundgang blättern die Pfeiltasten — nicht in Eingaben, nicht auf
         der Trennlinie (sie ändert damit die Breite). */
      if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && reise && reiter === reiseReiter() && !popOffen
        && !ev.altKey && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.target !== trenner
        && !(ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]'))) {
        ev.preventDefault();
        schrittGehen(reise.i + (ev.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (ev.key !== 'Escape') { return; }
      if (popOffen) { popOffen = false; popZeichnen(); filterKnopf.focus(); return; }
      if ((auswahl || feldWahl) && !(ev.target.closest && ev.target.closest('input, textarea'))) { waehlen(null); }
    }
    document.addEventListener('pointerdown', draussen, true);
    document.addEventListener('keydown', taste);

    /* Breiter oder schmaler: die Spuren neu legen, wenn mehr oder weniger passen. */
    function breite() {
      if (!document.body.contains(huelle)) { global.removeEventListener('resize', breite); return; }
      seiteAnwenden();
      if (laufende) { laufende.spurenLegen(breitenSchluessel()); }
    }
    global.addEventListener('resize', breite);

    /* --- Leiste --- */

    function leisteSetzen() {
      var z = a ? a.zahlen : null;
      HT.app.unterleiste({
        label: 'Gesamtbild',
        inhaltLabel: 'Darstellung',
        inhalt: [
          h('span', { class: 'lk-leiste__titel' }, h('span', { text: 'Gesamtbild' })),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'segment', role: 'group', 'aria-label': 'Vorgehensweise' },
            [['klassisch', 'Klassisch'], ['agil', 'Agil']].map(function (o) {
              return h('button', {
                type: 'button', class: 'segment__knopf', text: o[1], 'aria-pressed': o[0] === vorgehen ? 'true' : 'false',
                on: { click: function () {
                  if (o[0] === vorgehen) { return; }
                  vorgehen = o[0];
                  filter.phasen = null;
                  reiseUmbauen();
                  adresseSetzen();
                  zeichnen({ zumZiel: !!reise });
                } }
              });
            })),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'gauswahl' }, h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Elemente ein- und ausblenden' },
            KAT_REIHE.map(function (kat) {
              var an = !!sichtJetzt()[kat];
              return h('button', {
                type: 'button', class: 'grail__knopf grail__knopf--' + kat,
                'aria-pressed': an ? 'true' : 'false',
                title: KAT_LABEL[kat] + ' — ' + (an ? 'ausblenden' : 'einblenden'),
                on: { click: function () {
                  /* Im Rundgang nur für diesen Schritt, nicht gespeichert. */
                  if (reise) { tourSicht = sichtKopie(sichtJetzt()); tourSicht[kat] = !tourSicht[kat]; }
                  else { sicht[kat] = !sicht[kat]; sichtSpeichern(sicht); }
                  zeichnen({ zumZiel: !!reise });
                } }
              }, [
                h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 13)),
                h('span', { class: 'gauswahl__name', text: KAT_LABEL[kat] }),
                z ? h('span', { class: 'grail__zahl', text: String(z[kat]) }) : null
              ]);
            }))),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          pfeilKnopf()
        ].concat(reise ? [
          /* Der Rundgang läuft: ein Klick zeigt den Schritt, × beendet ihn. */
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('span', { class: 'rf-pille ra-tourpille' }, [
            h('button', {
              type: 'button', class: 'rf-pille__text', title: reise.id === 'fragen' ? 'Frage zeigen' : 'Rundgang — Schritt zeigen',
              on: { click: function () { reiterWaehlen(reiseReiter()); } }
            }, [HT.ui.symbol(IKONE_RUNDGANG, 14), h('span', { text: reise.id === 'fragen'
              ? 'Frage ' + schritt().id + ' · ' + (reise.i + 1) + '/' + reise.schritte.length
              : 'Rundgang ' + (reise.i + 1) + '/' + reise.schritte.length })]),
            h('button', {
              type: 'button', class: 'rf-pille__x', 'aria-label': reise.id === 'fragen' ? 'Fragen beenden' : 'Rundgang beenden',
              title: reise.id === 'fragen' ? 'Fragen beenden' : 'Rundgang beenden', text: '×',
              on: { click: reiseBeenden }
            })
          ])
        ] : filterAktiv(filter) ? [
          /* Was gefiltert ist: ein Klick öffnet den Filter, × hebt ihn auf. */
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('span', { class: 'rf-pille' }, [
            h('button', {
              type: 'button', class: 'rf-pille__text', title: 'Filter: ' + filterText() + ' — ändern',
              on: { click: function (ev) { ev.stopPropagation(); popOffen = true; popZeichnen(true); } }
            }, [HT.ui.symbol(IKONE_FILTER, 14), h('span', { text: filterText() })]),
            h('button', {
              type: 'button', class: 'rf-pille__x', 'aria-label': 'Filter aufheben', title: 'Filter aufheben', text: '×',
              on: { click: function () { filter = leererFilter(); popOffen = false; geaendert(); } }
            })
          ])
        ] : []),
        info: { titel: 'Gesamtbild', inhalt: infoInhalt },
        /* Ganz rechts: die Inhaltsseite ein- und ausblenden. */
        rechts: seiteKnopf
      });
    }

    /* Pfeile der Abbildung 1: an stehen die Kästen der Abbildung im Fluss,
       die übrigen Ergebnisse eingeklappt; aus alle Ergebnisse ohne Pfeile.
       Nur mit Ergebnissen allein. */
    function pfeilKnopf() {
      var jetzt = sichtJetzt();
      var an = !!jetzt.pfeile;
      var moeglich = flussMoeglich(jetzt);
      return h('div', { class: 'gauswahl' }, h('button', {
        type: 'button', class: 'grail__knopf ra-pfeilknopf', 'aria-pressed': an && moeglich ? 'true' : 'false', disabled: !moeglich,
        title: !moeglich ? 'Pfeile verbinden die Ergebnisse der Abbildung 1 — nur mit Ergebnissen allein (Rollen und Aufgaben ausblenden)'
          : an ? 'Pfeile ausblenden und alle Ergebnisse zeigen' : 'Pfeile der Abbildung 1 zeigen, übrige Ergebnisse einklappen',
        on: { click: function () {
          if (reise) { tourSicht = sichtKopie(jetzt); tourSicht.pfeile = !tourSicht.pfeile; }
          else { sicht.pfeile = !sicht.pfeile; sichtSpeichern(sicht); }
          zeichnen({ zumZiel: !!reise });
        } }
      }, [
        HT.ui.symbol(IKONE_PFEIL, 18),
        h('span', { class: 'gauswahl__name', text: 'Pfeile' }),
        moeglich && laufende ? h('span', { class: 'grail__zahl', text: String(laufende.pfeilZahl()) }) : null
      ]));
    }

    /* Neu aufbauen und alles nachführen. opt.wennNoetig: nur, wenn sich
       Vorgehensweise, Sicht oder Filter geändert haben (Schritte des
       Rundgangs mit demselben Bild rollen nur); opt.zumZiel: die Stellen
       des Schritts ins Bild rollen. */
    function zeichnen(opt) {
      opt = opt || {};
      if (!document.body.contains(huelle)) { return; }
      m = modell(vorgehen);
      var s = sichtJetzt(), f = filterJetzt();
      var schluessel = vorgehen + '|' + [s.rolle, s.aufgabe, s.ergebnis, s.pfeile].join() + '|' + JSON.stringify(f) + '|' + JSON.stringify(zu);
      if (!opt.wennNoetig || schluessel !== gebaut || !laufende || !huelle.contains(laufende.buehne)) {
        a = ausschnitt(m, f, zu);
        var alt = laufende && huelle.contains(laufende.buehne) ? laufende.buehne : null;
        var oben = alt ? alt.scrollTop : 0, links = alt ? alt.scrollLeft : 0;
        laufende = aufbauen(m, a, s, f, aktionen);
        if (alt) { huelle.replaceChild(laufende.buehne, alt); }
        else {
          HT.ui.leeren(huelle);
          [laufende.buehne, trenner, seite, pop].forEach(function (x) { huelle.appendChild(x); });
        }
        laufende.gewaehlt(auswahl ? auswahl.id : null, feldWahl);
        laufende.spurenLegen(breitenSchluessel());
        laufende.buehne.scrollTop = oben;
        laufende.buehne.scrollLeft = links;
        gebaut = schluessel;
      } else {
        laufende.gewaehlt(auswahl ? auswahl.id : null, feldWahl);
      }
      huelle.classList.toggle('ist-rundgang', !!reise);
      laufende.tour(reise ? zielJetzt() : null, !!opt.zumZiel);
      inhaltZeichnen();
      leisteSetzen();
      popZeichnen();
    }

    leisteSetzen();
    lagenLaden().then(function () {
      if (!document.body.contains(huelle)) { return; }
      modelle = {};
      rasterBereit = true;
      zeichnen();
      if (params.id) { laufende.zeigen(params.id); }
      if (frageWunsch && fragenStand) { var fw = frageWunsch; frageWunsch = null; fragenStarten(fw); return; }
      /* Alte Adressen (#/raster, #/graph, #/feld) stehen danach als #/ueberblick da. */
      if (!reiseWunsch) { adresseSetzen(); }
      if (reiseWunsch) {
        if (lp) { wunschErfuellen(); } else { lpHolen(); }
      } else if (reiter === 'rundgang') { lpHolen(); }
    });
  }

  /* Das Raster für das Zuordnen im Trainer (js/zuordnen.js): Phase, Modul
     oder alles, mit Rollen, Aufgaben und Ergebnissen, ohne Pfeile und ohne
     Filter, Auswahl und Inhaltsseite. opts: { vorgehen, phasen, module,
     knoten(k, ort), zu: { phasen, module }, klappen(art, name) } — knoten
     gibt für ein Element seinen Kasten zurück oder null (dann steht das
     Element wie im Überblick); zu sagt, was zugeklappt ist, klappen meldet
     einen Klick auf eine Klappe. Vorher bereit()
     abwarten: erst dann folgt die Reihenfolge der Abbildung 1. Rückgabe:
     { buehne, spurenLegen(zusatz) } — spurenLegen nach dem Einhängen und
     nach jeder Änderung der Höhen; zusatz wie breitenSchluessel(). */
  function uebungsFilter(opts) {
    var f = leererFilter();
    f.phasen = opts.phasen || null;
    f.module = opts.module || null;
    return f;
  }

  HT.raster = {
    bereit: function () {
      return lagenLaden().then(function () { modelle = {}; });
    },
    /* Die Felder der Übung ohne Bild: [{ phasen, modul, bloecke }] — für die
       Zahl der Kästen auf der Übersicht. */
    felder: function (opts) {
      return feldGruppen(ausschnitt(modell(opts.vorgehen), uebungsFilter(opts))).map(function (g) {
        return { phasen: g.phasen, modul: g.x.feld.modul, bloecke: g.x.bloecke };
      });
    },
    uebung: function (opts) {
      var m = modell(opts.vorgehen);
      var f = uebungsFilter(opts);
      var nichts = function () {};
      var r = aufbauen(m, ausschnitt(m, f, opts.zu), { rolle: true, aufgabe: true, ergebnis: true, pfeile: false }, f,
        { modul: nichts, phase: nichts, waehlen: nichts, feld: nichts, klappen: opts.klappen || nichts }, { knoten: opts.knoten });
      return { buehne: r.buehne, spurenLegen: function (zusatz) { r.spurenLegen('uebung|' + zusatz); } };
    }
  };

  HT.views.ueberblick = {
    titel: 'Überblick',
    nav: 'ueberblick',
    render: render,
    suchtreffer: function (e) {
      return !!(laufende && document.body.contains(laufende.buehne) && wahlVonAussen && wahlVonAussen(e));
    }
  };
}(window));
