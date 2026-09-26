/* meinHERMES — Graphmodell.
   Der Graph zeigt nur die drei Elemente, die zusammen den Ablauf beschreiben:
   Rolle → Aufgabe → Ergebnis. Phasen, Module und Szenarien sind keine Knoten,
   sondern der Umfang: sie wählen aus, welche Aufgaben und Ergebnisse gezeigt
   werden. Jede Kante entspricht einem Querverweis in den Daten
   (Aufgabe.verantwortlich/beteiligt/ergebnisse, Ergebnis.verantwortlich) —
   es werden keine Beziehungen ergänzt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /* Reihenfolge = Reihenfolge der Spalten und der Icons: wer tut was, was
     entsteht. Das Icon je Kategorie liefert HT.ui.katSymbol. */
  var KATEGORIEN = [
    { key: 'rolle',    label: 'Rollen',     singular: 'Rolle' },
    { key: 'aufgabe',  label: 'Aufgaben',   singular: 'Aufgabe' },
    { key: 'ergebnis', label: 'Ergebnisse', singular: 'Ergebnis' }
  ];
  var KAT = {};
  KATEGORIEN.forEach(function (k, i) { k.rang = i; KAT[k.key] = k; });

  /* «vor» beschreibt die Kante aus Sicht des Ausgangsknotens, «rueck» aus Sicht
     des Ziels — so lässt sich jede Verbindung als Satz lesen:
     «Auftraggeber → verantwortlich für → Entscheid Zuschlag treffen». */
  var RELATIONEN = [
    { key: 'verantwortlich', label: 'Rolle ist verantwortlich für die Aufgabe', vor: 'verantwortlich für', rueck: 'verantwortlich', stil: 'verantwortlich' },
    { key: 'beteiligt',      label: 'Rolle ist beteiligt',                      vor: 'beteiligt an',       rueck: 'beteiligt',       stil: 'beteiligt' },
    { key: 'erzeugt',        label: 'Aufgabe erzeugt Ergebnis',                 vor: 'erzeugt',            rueck: 'entsteht in',     stil: 'erzeugt' },
    { key: 'ergebnisrolle',  label: 'Rolle verantwortet das Ergebnis',          vor: 'verantwortet',       rueck: 'verantwortlich',  stil: 'ergebnisrolle' }
  ];
  var REL = {};
  RELATIONEN.forEach(function (r, i) { r.rang = i; REL[r.key] = r; });

  var VORGEHEN = {
    klassisch: ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss'],
    agil:      ['Initialisierung', 'Umsetzung', 'Abschluss']
  };
  /* Alle Phasen beider Vorgehensweisen im Projektverlauf — Sortierschlüssel
     für Aufgaben und Ergebnisse innerhalb einer Bahn: früheste Phase oben. */
  var PHASEN_REIHE = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss'];

  /** Rang der frühesten Phase eines Elements; Phasen der gewählten
      Vorgehensweise zählen zuerst, sonst alle. Ohne Phase ganz unten. */
  function phasenRang(phasen, vp) {
    var best = 999;
    (phasen || []).forEach(function (name) {
      var i = PHASEN_REIHE.indexOf(name);
      if (i === -1) { return; }
      if (vp.indexOf(name) === -1) { i += 100; }
      if (i < best) { best = i; }
    });
    return best;
  }

  /** Name der frühesten Phase — nach derselben Regel wie phasenRang. */
  function fruehestePhase(phasen, vp) {
    var best = null, bestRang = 999;
    (phasen || []).forEach(function (name) {
      var i = PHASEN_REIHE.indexOf(name);
      if (i === -1) { return; }
      if (vp.indexOf(name) === -1) { i += 100; }
      if (i < bestRang) { bestRang = i; best = name; }
    });
    return best;
  }

  /** Rang der spätesten Phase der Vorgehensweise; ohne solche -1. */
  function letzterPhasenRang(phasen, vp) {
    var best = -1;
    (phasen || []).forEach(function (name) {
      var i = PHASEN_REIHE.indexOf(name);
      if (i !== -1 && vp.indexOf(name) !== -1 && i > best) { best = i; }
    });
    return best;
  }

  /* --- Reihenfolge aus der Abbildung 1 -------------------------------------- */

  /* Die Abbildung zeigt die Ergebnisse je Phase und Modul von oben nach unten
     in ihrer Abfolge. Ihre Lage (HT.abbildung.lagen: id → [{ y, x, phasen }])
     setzt die Graph-Sicht, sobald die Grafik geladen ist; bis dahin fehlt sie
     und es gilt die Ordnung nach Phase und Name. */
  var abbLagen = null;
  /* Ergebnisse an derselben Stelle (etwa die eines Entscheids): Meilenstein zuletzt. */
  var TYP_ORDNUNG = { Dokument: 0, Zustand: 1, Checkliste: 2, Meilenstein: 3 };

  function abbildungLagenSetzen(lagen) { abbLagen = lagen || null; }

  /** Stelle eines Ergebnisses im Feld aus Phase (Zeile) und Modul (Spalte):
      oben vor unten (auf 4 px gerundet), dann links vor rechts; null, wenn
      das Ergebnis dort keinen Kasten hat. Nur Kästen im eigenen Feld zählen —
      ein Kasten in einer anderen Spalte oder Zeile sagt nichts über die Folge
      in dieser Bahn. */
  function abbStelle(id, phase, modul) {
    var l = abbLagen ? abbLagen[id] : null;
    if (!l || !l.length) { return null; }
    var wahl = l.filter(function (p) { return !p.sammel && p.phasen.indexOf(phase) !== -1 && p.module.indexOf(modul) !== -1; });
    if (!wahl.length) { return null; }
    return wahl.reduce(function (min, p) { return Math.min(min, Math.round(p.y / 4) * 10000 + Math.round(p.x)); }, Infinity);
  }

  /** Höhe des Kastens in Abbildung 1 (Koordinaten der Grafik) für ein
      Ergebnis in Phase und Modul; null, wenn es dort keinen Kasten hat. */
  function abbildungY(id, phase, modul) {
    var l = abbildungLage(id, phase, modul);
    return l && !l.sammel ? l.y : null;
  }

  /** Kasten in Abbildung 1 für ein Ergebnis in Phase und Modul: { x, y }
      des obersten, sonst der im Sammelkasten «Phasenunabhängig» (mit
      sammel: true); null, wenn es dort keinen hat. */
  function abbildungLage(id, phase, modul) {
    var l = abbLagen ? abbLagen[id] : null;
    if (!l) { return null; }
    var wahl = null;
    l.forEach(function (p) {
      if (p.phasen.indexOf(phase) === -1 || p.module.indexOf(modul) === -1) { return; }
      if (!wahl || (wahl.sammel && !p.sammel) || (!!wahl.sammel === !!p.sammel && p.y < wahl.y)) { wahl = p; }
    });
    return wahl;
  }

  /** Stelle einer Aufgabe: beim ersten ihrer Ergebnisse im Feld. Ein
      Entscheid steht am Ende der Zeile seines letzten Ergebnisses — in der
      Abbildung laufen die Analysen einer Zeile oft von beiden Seiten auf das
      Dokument zu, über das entschieden wird (Studie → Entscheid Weiteres
      Vorgehen nach Schutzbedarfs- und Beschaffungsanalyse). */
  function aufgabeStelle(k, phase, modul) {
    var stellen = k.eintrag.ergebnisse.map(function (name) {
      var e = HT.daten.eintragMitBegriff(name, 'ergebnis');
      return e ? abbStelle(e.id, phase, modul) : null;
    }).filter(function (s) { return s !== null; });
    if (!stellen.length) { return null; }
    return k.entscheid ? Math.floor(Math.max.apply(null, stellen) / 10000) * 10000 + 9999 : Math.min.apply(null, stellen);
  }

  /* Elemente mit Stelle zuerst, in ihrer Folge; ohne Stelle danach (0 = gleich). */
  function stellenVergleich(a, b) {
    var ohneA = a === null || a === undefined, ohneB = b === null || b === undefined;
    if (ohneA && ohneB) { return 0; }
    if (ohneA) { return 1; }
    if (ohneB) { return -1; }
    return a - b;
  }

  /* --- Reihenfolge aus den Grundlagen --------------------------------------- */

  /* Wie stark baut Aufgabe b auf Aufgabe a auf: 0 gar nicht, 1 über ein
     Ergebnis, 2 über einen Meilenstein — jeweils nur, was a in der Phase
     erzeugt (aufgabe.grundlagen, Handbuch «Grundlagen»). Ein Ergebnis, das
     a selbst als Grundlage braucht, schreibt a nur fort; daraus folgt keine
     Reihenfolge — sonst stünde jede Querschnittsaufgabe, die den
     Projektmanagementplan nachführt, vor allen, die ihn lesen. */
  function bautAuf(b, a, phase) {
    var stufe = 0;
    b.eintrag.grundlagen.forEach(function (name) {
      if (a.eintrag.ergebnisse.indexOf(name) === -1) { return; }
      var e = HT.daten.eintragMitBegriff(name, 'ergebnis');
      if (!e || !erzeugtInPhasen(a.eintrag, e, [phase])) { return; }
      var meilenstein = e.typ === 'Meilenstein';
      if (!meilenstein && a.eintrag.grundlagen.indexOf(name) !== -1) { return; }
      stufe = Math.max(stufe, meilenstein ? 2 : 1);
    });
    return stufe;
  }

  /** Aufgaben eines Abschnitts (gleiche Bahn, Modul und früheste Phase) so
      ordnen, dass jede nach den Aufgaben kommt, auf denen sie aufbaut: diese
      rücken vor sie, alles andere bleibt in der bisherigen Folge. Bauen zwei
      aufeinander auf, gilt die stärkere Richtung — «Ausschreibung
      durchführen» braucht den Meilenstein Ausschreibung, also steht der
      Entscheid davor. Kreise in den Grundlagen brechen an der Stelle ab,
      an der sie sich schliessen. */
  function nachGrundlagen(teil, phase) {
    if (teil.length < 2) { return teil; }
    var gesetzt = {}, laufend = {}, aus = [];
    function setzen(b) {
      if (gesetzt[b.id] || laufend[b.id]) { return; }
      laufend[b.id] = true;
      teil.forEach(function (a) {
        if (a !== b && bautAuf(b, a, phase) > bautAuf(a, b, phase)) { setzen(a); }
      });
      laufend[b.id] = false;
      gesetzt[b.id] = true;
      aus.push(b);
    }
    teil.forEach(setzen);
    return aus;
  }

  /* Handbuch Kap. 3.2.1: zwingend in jedem Projekt. */
  var ZWINGENDE_MODULE = ['Projektsteuerung', 'Projektführung', 'Projektgrundlagen', 'Einführungsorganisation'];

  var EBENEN = ['Steuerung', 'Führung', 'Ausführung'];

  var modell = null;

  /* --- Aufbau -------------------------------------------------------------- */

  function rollenListe(text) {
    return String(text || '').split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function bauen() {
    if (modell) { return modell; }

    var knoten = {};
    var liste = [];
    var kanten = [];
    var gesehen = {};

    HT.daten.alleEintraege().forEach(function (e) {
      if (!KAT[e.kategorie]) { return; }
      var k = {
        id: e.id,
        kategorie: e.kategorie,
        begriff: e.begriff,
        eintrag: e,
        kanten: [],
        entscheid: e.kategorie === 'aufgabe' && /^Entscheid\s/.test(e.begriff),
        reihenfolge: e.reihenfolge
      };
      knoten[k.id] = k;
      liste.push(k);
    });

    function finde(begriff, kategorie) {
      var e = HT.daten.eintragMitBegriff(begriff, kategorie);
      return e ? e.id : null;
    }

    function verbinde(vonId, nachId, rel) {
      if (!vonId || !nachId || vonId === nachId) { return; }
      if (!knoten[vonId] || !knoten[nachId]) { return; }
      var schluessel = vonId + '|' + nachId + '|' + rel;
      if (gesehen[schluessel]) { return; }
      gesehen[schluessel] = true;
      var kante = { id: schluessel, von: vonId, nach: nachId, rel: rel };
      kanten.push(kante);
      knoten[vonId].kanten.push(kante);
      knoten[nachId].kanten.push(kante);
    }

    liste.forEach(function (k) {
      var e = k.eintrag;
      if (k.kategorie === 'rolle') { return; }

      var verantw = {};
      rollenListe(e.verantwortlich).forEach(function (r) {
        var id = finde(r, 'rolle');
        if (!id) { return; }
        verantw[id] = true;
        verbinde(id, k.id, k.kategorie === 'aufgabe' ? 'verantwortlich' : 'ergebnisrolle');
      });

      if (k.kategorie === 'aufgabe') {
        /* «Beteiligt» führt die verantwortliche Rolle meist nochmals auf —
           die stärkere Beziehung genügt. */
        e.beteiligt.forEach(function (r) {
          var id = finde(r, 'rolle');
          if (id && !verantw[id]) { verbinde(id, k.id, 'beteiligt'); }
        });
        e.ergebnisse.forEach(function (x) { verbinde(k.id, finde(x, 'ergebnis'), 'erzeugt'); });
      }
    });

    liste.forEach(function (k) { k.grad = k.kanten.length; });

    modell = { knoten: knoten, liste: liste, kanten: kanten };
    return modell;
  }

  /* --- Zugriff ------------------------------------------------------------- */

  function knoten(id) {
    return bauen().knoten[id] || null;
  }

  function alleKnoten() { return bauen().liste; }

  /** Verbindungen eines Knotens: je Nachbar alle Beziehungen aus seiner Sicht. */
  function nachbarn(id) {
    var k = knoten(id);
    if (!k) { return []; }
    var m = bauen();
    var nachId = {};
    var aus = [];
    k.kanten.forEach(function (kante) {
      var anderer = kante.von === id ? kante.nach : kante.von;
      var richtung = kante.von === id ? 'vor' : 'rueck';
      var eintrag = nachId[anderer];
      if (!eintrag) {
        eintrag = { knoten: m.knoten[anderer], relationen: [] };
        nachId[anderer] = eintrag;
        aus.push(eintrag);
      }
      eintrag.relationen.push({ rel: kante.rel, richtung: richtung, label: REL[kante.rel][richtung], kante: kante });
    });
    return aus;
  }

  /* --- Umfang: welche Phasen und Module ------------------------------------ */

  /* «Keine» ist in einer Liste des Umfangs der einzige Eintrag KEINE: er
     trifft keine Phase und kein Modul, der Graph bleibt leer. So gilt
     «leer = alle» unverändert, und die Adresse trägt phase=(keine). */
  var KEINE = '(keine)';

  function leererUmfang() {
    return {
      vorgehen: 'klassisch',   // klassisch | agil
      phasen: [],              // Phasennamen, leer = alle der Vorgehensweise, [KEINE] = keine
      module: []               // Modulnamen, leer = alle, [KEINE] = keine
    };
  }

  function umfangAktiv(u) {
    return !!(u && (u.phasen.length || u.module.length));
  }

  function schneidet(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) !== -1) { return true; }
    }
    return false;
  }

  /* «beide» (nur für Ausschnitte wie die Folien des Lernpfads, nicht im
     Überblick wählbar): alle Phasen im Projektverlauf. */
  function phasenDerVorgehensweise(vorgehen) {
    if (vorgehen === 'beide') { return PHASEN_REIHE; }
    return VORGEHEN[vorgehen] || VORGEHEN.klassisch;
  }

  /** Phasen eines Elements in diesen Modulen zusammen (HT.daten.phasenImModul). */
  function phasenInModulen(eintrag, module) {
    var aus = [];
    module.forEach(function (m) {
      HT.daten.phasenImModul(eintrag, m).forEach(function (p) { if (aus.indexOf(p) === -1) { aus.push(p); } });
    });
    return aus;
  }

  /** Gehört eine Aufgabe oder ein Ergebnis zum gewählten Umfang? */
  function imUmfang(eintrag, umfang) {
    /* Rollen tragen weder Phasen noch Module — sie hängen an ihren Aufgaben. */
    if (eintrag.kategorie === 'rolle') { return true; }
    var ePhasen = eintrag.phasen || [];
    /* Sammeleinträge ohne Phasenangabe («Checklisten», «Meilensteine») lassen sich
       nicht im Ablauf verorten und bleiben dem Lexikon vorbehalten. */
    if (!ePhasen.length) { return false; }
    var vp = phasenDerVorgehensweise(umfang.vorgehen);
    if (!schneidet(ePhasen, vp)) { return false; }
    var phasen = umfang.phasen.length ? umfang.phasen : vp;
    if (!schneidet(ePhasen, phasen)) { return false; }
    /* Im Modul zählen nur die Phasen, die das Element dort hat — sonst stünde
       «Prototyping durchführen» im Modul Projektgrundlagen auch im Konzept. */
    if (umfang.module.length && !schneidet(phasenInModulen(eintrag, umfang.module), phasen)) { return false; }
    return true;
  }

  /** Erzeugt die Aufgabe das Ergebnis in einer dieser Phasen? Die Modultabellen
      des Handbuchs kreuzen die Phasen je Paar an (aufgabe.ergebnisPhasen) —
      «Projekt steuern» erzeugt den QS- und Risikobericht nicht im Abschluss,
      obwohl beide dort vorkommen. Ohne Angabe gilt der Schnitt der Phasen beider.
      Mit Modulen zählen nur die Phasen, in denen die Aufgabe in einem davon
      steht (HT.daten.phasenImModul). */
  function erzeugtInPhasen(aufgabe, ergebnis, phasen, module) {
    var liste = aufgabe.ergebnisPhasen && aufgabe.ergebnisPhasen[ergebnis.begriff];
    if (!liste) {
      liste = (aufgabe.phasen || []).filter(function (p) { return (ergebnis.phasen || []).indexOf(p) !== -1; });
    }
    if (module && module.length) {
      var imModul = phasenInModulen(aufgabe, module);
      liste = liste.filter(function (p) { return imModul.indexOf(p) !== -1; });
    }
    return schneidet(liste, phasen);
  }

  /** Module eines Szenarios (für die Vorwahl über das Szenario). */
  /* Die Szenarioseiten der Quelle führen Projektgrundlagen nicht in ihrer
     Modulliste; nach Kap. 3.2.1 ist es aber wie Projektsteuerung,
     Projektführung und Einführungsorganisation in jedem Projekt zwingend.
     Ein Szenario umfasst deshalb immer auch die zwingenden Module. */
  function szenarioModule(begriffOderId) {
    var e = HT.daten.eintragMitId(begriffOderId) || HT.daten.eintragMitBegriff(begriffOderId, 'szenario');
    if (!e || e.kategorie !== 'szenario') { return null; }
    var module = e.module.slice();
    ZWINGENDE_MODULE.forEach(function (m) { if (module.indexOf(m) === -1) { module.push(m); } });
    return module;
  }

  /** Wie viele Aufgaben trägt diese Phase bzw. dieses Modul zum aktuellen Umfang bei? */
  function beitrag(art, name, umfang) {
    var vp = phasenDerVorgehensweise(umfang.vorgehen);
    var n = 0;
    bauen().liste.forEach(function (k) {
      if (k.kategorie !== 'aufgabe') { return; }
      var e = k.eintrag;
      if (!schneidet(e.phasen, vp)) { return; }
      if (art === 'phase') {
        if (e.phasen.indexOf(name) === -1) { return; }
        if (umfang.module.length && phasenInModulen(e, umfang.module).indexOf(name) === -1) { return; }
      } else {
        var phasen = umfang.phasen.length ? umfang.phasen : vp;
        if (!schneidet(HT.daten.phasenImModul(e, name), phasen)) { return; }
      }
      n++;
    });
    return n;
  }

  /* --- Teilgraph ------------------------------------------------------------ */

  function modulOrdnung() {
    var o = {};
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m, i) { o[m.begriff] = i; });
    return o;
  }

  /**
   * Sichtbarer Graph zum Zustand.
   * zustand: { umfang, kategorien: {key:bool}, relationen: {key:bool},
   *            gruppierung: 'phase'|'modul', nurMinimal, nurEntscheide,
   *            isolierteAusblenden, fokus: id|null }
   * fokus zeigt nur ein Element mit seiner Nachbarschaft (siehe fokusMenge).
   * Rückgabe: Spalten in Reihenfolge Rolle, Aufgabe, Ergebnis; die
   * Aufgaben und Ergebnisse tragen ihre Bahn (Phase bzw. Modul) für das
   * Swimlane-Layout; Rollen haben keine. In Phasenbahnen tragen sie dazu
   * ihre Untergruppe (das Modul, `untergruppeVon`) für die Zwischentitel.
   */
  function teilgraph(zustand) {
    var m = bauen();
    var u = zustand.umfang || leererUmfang();
    var kat = zustand.kategorien || {};
    var rel = zustand.relationen || {};
    var vp = phasenDerVorgehensweise(u.vorgehen);
    /* Phasen des Umfangs — eine Kante «erzeugt» gilt nur, wenn die Aufgabe das Ergebnis in einer davon erzeugt. */
    var phasenImUmfang = u.phasen.length ? vp.filter(function (p) { return u.phasen.indexOf(p) !== -1; }) : vp;
    var gruppenNamen = zustand.gruppierung === 'phase'
      ? (u.phasen.length ? vp.filter(function (p) { return u.phasen.indexOf(p) !== -1; }) : vp)
      : (function () {
          var alle = HT.daten.eintraegeDerKategorie('modul').map(function (x) { return x.begriff; });
          return u.module.length ? alle.filter(function (x) { return u.module.indexOf(x) !== -1; }) : alle;
        }());

    /* 1. Umfang bestimmen — im Fokus zusätzlich nur die Nachbarschaft */
    /* `menge` (Id -> true) gibt die Knoten fest vor — die Folien des
       Lernpfads zeigen so einen Ausschnitt, ohne Fokus des Überblicks. */
    var fokus = zustand.menge || (zustand.fokus ? fokusMenge(zustand.fokus) : null);
    function imFokus(id) { return !fokus || !!fokus[id]; }
    var aufgabenAlle = [], ergebnisseAlle = [];
    m.liste.forEach(function (k) {
      if (k.kategorie === 'rolle') { return; }
      if (!imUmfang(k.eintrag, u)) { return; }
      if (!imFokus(k.id)) { return; }
      if (k.kategorie === 'aufgabe') {
        if (zustand.nurEntscheide && !k.entscheid) { return; }
        aufgabenAlle.push(k);
      } else {
        if (zustand.nurMinimal && !(k.eintrag.minimalGefordert && k.eintrag.typ === 'Dokument')) { return; }
        ergebnisseAlle.push(k);
      }
    });

    /* 2. Aufgaben nach der gewählten Achse gruppieren und sortieren.
          Eine Aufgabe steht in der ersten Gruppe, zu der sie gehört — eine
          Phase zählt nur, wenn die Aufgabe sie in einem gewählten Modul hat,
          ein Modul nur mit einer Phase im Umfang (HT.daten.phasenImModul). */
    var modulAuswahl = u.module.length ? u.module : null;
    function phasenVon(e) { return modulAuswahl ? phasenInModulen(e, modulAuswahl) : e.phasen; }
    function gruppeFinden(e) {
      for (var i = 0; i < gruppenNamen.length; i++) {
        var g = gruppenNamen[i];
        var drin = zustand.gruppierung === 'phase'
          ? phasenVon(e).indexOf(g) !== -1
          : schneidet(HT.daten.phasenImModul(e, g), phasenImUmfang);
        if (drin) { return g; }
      }
      return '';
    }
    /* Das Modul, in dem ein Element in dieser Phase steht: das erste seiner
       (gewählten) Module, das die Phase trägt. */
    function modulInPhase(e, phase) {
      var liste = e.module.filter(function (mm) { return !modulAuswahl || modulAuswahl.indexOf(mm) !== -1; });
      for (var i = 0; i < liste.length; i++) {
        if (HT.daten.phasenImModul(e, liste[i]).indexOf(phase) !== -1) { return liste[i]; }
      }
      return liste.length ? liste[0] : '';
    }
    var gruppeVon = {};
    aufgabenAlle.forEach(function (k) { gruppeVon[k.id] = gruppeFinden(k.eintrag); });
    /* In Phasenbahnen stehen die Aufgaben nach Modul gebündelt (Reihenfolge
       der Abbildung 1); der Zeichner setzt über jede Gruppe einen
       Modul-Zwischentitel. In Modulbahnen ist die Bahn selbst das Modul. */
    var nachModul = zustand.gruppierung === 'phase';
    var untergruppeVon = {};
    aufgabenAlle.forEach(function (k) {
      untergruppeVon[k.id] = nachModul ? modulInPhase(k.eintrag, gruppeVon[k.id]) : gruppeVon[k.id];
    });
    var mo = modulOrdnung();
    function rangVon(mm) { return mo.hasOwnProperty(mm) ? mo[mm] : 999; }
    /* Rang des Moduls, unter dem die Aufgabe in der Bahn steht; modulRang ist
       der ihres ersten Moduls (Gleichstand der Ergebnisse). */
    function unterRang(k) { return rangVon(untergruppeVon[k.id] || ''); }
    function modulRang(k) { return rangVon(k.eintrag.module.length ? k.eintrag.module[0] : ''); }
    /* Die Phasen, die in der Bahn zählen: die des Moduls, in dem das Element
       dort steht — «Prototyping durchführen» beginnt im Modul Produkt im
       Konzept, nicht in der Initialisierung. */
    function bahnPhasen(e, gruppe, unter) {
      var modul = nachModul ? unter : gruppe;
      return modul ? HT.daten.phasenImModul(e, modul) : phasenVon(e);
    }
    var phasenA = {};
    aufgabenAlle.forEach(function (k) { phasenA[k.id] = bahnPhasen(k.eintrag, gruppeVon[k.id], untergruppeVon[k.id]); });

    /* Stelle in der Abbildung, gesucht im Feld aus Bahn und Modul-Unterbahn
       (Phasenansicht) bzw. aus frühester Phase und Modulbahn (Modulansicht). */
    var stelleA = {};
    aufgabenAlle.forEach(function (k) {
      stelleA[k.id] = nachModul
        ? aufgabeStelle(k, gruppeVon[k.id], untergruppeVon[k.id])
        : aufgabeStelle(k, fruehestePhase(phasenA[k.id], vp), gruppeVon[k.id]);
    });

    /* Innerhalb der Bahn nach Modul, dann nach der frühesten Phase, dann in
       der Reihenfolge der Abbildung 1. Ohne Stelle dort danach: Entscheide
       zuletzt, nach ihrer spätesten Phase, sonst nach Name. */
    aufgabenAlle.sort(function (a, b) {
      var ga = gruppenNamen.indexOf(gruppeVon[a.id]);
      var gb = gruppenNamen.indexOf(gruppeVon[b.id]);
      if (ga !== gb) { return ga - gb; }
      if (nachModul) {
        var ma = unterRang(a), mb = unterRang(b);
        if (ma !== mb) { return ma - mb; }
      }
      var pa = phasenRang(phasenA[a.id], vp);
      var pb = phasenRang(phasenA[b.id], vp);
      if (pa !== pb) { return pa - pb; }
      var s = stellenVergleich(stelleA[a.id], stelleA[b.id]);
      if (s) { return s; }
      if (stelleA[a.id] === null) {
        if (a.entscheid !== b.entscheid) { return a.entscheid ? 1 : -1; }
        var la = letzterPhasenRang(phasenA[a.id], vp), lb = letzterPhasenRang(phasenA[b.id], vp);
        if (la !== lb) { return la - lb; }
      }
      return a.begriff.localeCompare(b.begriff, 'de');
    });

    /* Dann kommt jede Aufgabe nach denen, auf denen sie aufbaut — je
       Abschnitt aus Bahn, Modul und frühester Phase. Das ordnet, was die
       Abbildung offen lässt: Aufgaben an derselben Stelle («Ausschreibung
       erarbeiten» vor «durchführen») und Entscheide ohne Kasten im Feld. */
    function abschnittVon(k) {
      return gruppeVon[k.id] + '|' + (nachModul ? unterRang(k) : '') + '|' + phasenRang(phasenA[k.id], vp);
    }
    var geordnet = [];
    for (var ai = 0, aj; ai < aufgabenAlle.length; ai = aj) {
      for (aj = ai + 1; aj < aufgabenAlle.length && abschnittVon(aufgabenAlle[aj]) === abschnittVon(aufgabenAlle[ai]); aj++) { /* weiter */ }
      geordnet = geordnet.concat(nachGrundlagen(aufgabenAlle.slice(ai, aj),
        nachModul ? gruppeVon[aufgabenAlle[ai].id] : fruehestePhase(phasenA[aufgabenAlle[ai].id], vp)));
    }
    aufgabenAlle = geordnet;

    var aufgaben = kat.aufgabe ? aufgabenAlle : [];

    /* 3. Ergebnisse in der Reihenfolge der erzeugenden Aufgabe */
    var rang = {};
    var quelleVon = {};
    if (rel.erzeugt) {
      aufgaben.forEach(function (k, i) {
        k.eintrag.ergebnisse.forEach(function (name) {
          var e = HT.daten.eintragMitBegriff(name, 'ergebnis');
          if (e && rang[e.id] === undefined && erzeugtInPhasen(k.eintrag, e, phasenImUmfang, u.module)) { rang[e.id] = i; quelleVon[e.id] = k.id; }
        });
      });
    }

    /* Ergebnisse liegen in der Bahn ihrer erzeugenden Aufgabe — so bleibt die
       Kante «erzeugt» waagrecht. Ohne erzeugende Aufgabe zählt die eigene
       erste Phase bzw. das erste Modul. */
    var gruppeVonErgebnis = {};
    ergebnisseAlle.forEach(function (k) {
      var g = quelleVon[k.id] ? (gruppeVon[quelleVon[k.id]] || '') : '';
      gruppeVonErgebnis[k.id] = g || gruppeFinden(k.eintrag);
    });
    /* Ergebnisse folgen der Phase ihrer erzeugenden Aufgabe (sonst der
       eigenen), dann der Reihenfolge der Aufgaben — so bleiben die
       Kanten «erzeugt» gebündelt und die frühesten Phasen stehen oben.
       Ihr Modul-Zwischentitel ist das Modul, in dem die erzeugende Aufgabe
       steht (in den Daten liegt jedes erzeugte Ergebnis dort), sonst das
       eigene Modul mit der Phase der Bahn. */
    function ergebnisModul(k) {
      if (quelleVon[k.id]) { return untergruppeVon[quelleVon[k.id]]; }
      return nachModul ? modulInPhase(k.eintrag, gruppeVonErgebnis[k.id]) : gruppeVonErgebnis[k.id];
    }
    function ergebnisPhasen(k) {
      return quelleVon[k.id] ? phasenA[quelleVon[k.id]] : bahnPhasen(k.eintrag, gruppeVonErgebnis[k.id], untergruppeVon[k.id]);
    }
    function ergebnisPhasenRang(k) {
      return phasenRang(ergebnisPhasen(k), vp);
    }
    function ergebnisModulRang(k) {
      var mm = ergebnisModul(k);
      return mo.hasOwnProperty(mm) ? mo[mm] : 999;
    }
    ergebnisseAlle.forEach(function (k) { untergruppeVon[k.id] = ergebnisModul(k); });
    /* Stelle eines Ergebnisses: sein Kasten in der Abbildung, im Feld aus
       Bahn und Modul (bzw. früheste Phase der erzeugenden Aufgabe und
       Modulbahn); ohne Kasten dort gleich hinter seiner erzeugenden Aufgabe. */
    var stelleE = {};
    ergebnisseAlle.forEach(function (k) {
      var q = quelleVon[k.id] ? m.knoten[quelleVon[k.id]] : null;
      var phase = nachModul ? gruppeVonErgebnis[k.id] : fruehestePhase(ergebnisPhasen(k), vp);
      var s = abbStelle(k.id, phase, nachModul ? untergruppeVon[k.id] : gruppeVonErgebnis[k.id]);
      if (s === null && q && stelleA[q.id] !== null && stelleA[q.id] !== undefined) { s = stelleA[q.id] + 0.1; }
      stelleE[k.id] = s;
    });
    ergebnisseAlle.sort(function (a, b) {
      var ga = gruppenNamen.indexOf(gruppeVonErgebnis[a.id]);
      var gb = gruppenNamen.indexOf(gruppeVonErgebnis[b.id]);
      if (ga !== gb) { return ga - gb; }
      if (nachModul) {
        var ma = ergebnisModulRang(a), mb = ergebnisModulRang(b);
        if (ma !== mb) { return ma - mb; }
      }
      var pa = ergebnisPhasenRang(a), pb = ergebnisPhasenRang(b);
      if (pa !== pb) { return pa - pb; }
      var s = stellenVergleich(stelleE[a.id], stelleE[b.id]);
      if (s) { return s; }
      var ra = rang[a.id] === undefined ? 9999 : rang[a.id];
      var rb = rang[b.id] === undefined ? 9999 : rang[b.id];
      if (ra !== rb) { return ra - rb; }
      var ta = TYP_ORDNUNG[a.eintrag.typ] || 0, tb = TYP_ORDNUNG[b.eintrag.typ] || 0;
      if (ta !== tb) { return ta - tb; }
      var d = modulRang(a) - modulRang(b);
      return d !== 0 ? d : a.begriff.localeCompare(b.begriff, 'de');
    });
    var ergebnisse = kat.ergebnis ? ergebnisseAlle : [];
    if (zustand.isolierteAusblenden) {
      ergebnisse = ergebnisse.filter(function (k) { return rang[k.id] !== undefined; });
    }

    /* 4. Rollen aus dem ganzen Umfang, nicht nur aus der sichtbaren Spalte:
          sonst verschwinden sie, sobald man die Aufgaben ausblendet. Zuerst
          die gezeichneten Aufgaben, damit die Reihenfolge zu den Kanten passt. */
    var sichtbarE = {};
    ergebnisse.forEach(function (k) { sichtbarE[k.id] = true; });
    var rollenReihe = [];
    function rolleMerken(id) { if (id && imFokus(id) && rollenReihe.indexOf(id) === -1) { rollenReihe.push(id); } }
    function rollenAus(liste) {
      liste.forEach(function (k) {
        k.kanten.forEach(function (kante) {
          if (kante.nach !== k.id) { return; }
          if (kante.rel === 'verantwortlich' && rel.verantwortlich) { rolleMerken(kante.von); }
          if (kante.rel === 'beteiligt' && rel.beteiligt) { rolleMerken(kante.von); }
        });
      });
    }
    rollenAus(aufgaben);
    rollenAus(aufgabenAlle);
    if (rel.ergebnisrolle) {
      ergebnisseAlle.forEach(function (k) {
        k.kanten.forEach(function (kante) {
          if (kante.nach === k.id && kante.rel === 'ergebnisrolle') { rolleMerken(kante.von); }
        });
      });
    }
    var rollen = kat.rolle ? rollenReihe.map(function (id) { return m.knoten[id]; }).filter(Boolean) : [];

    /* 5. Kanten zwischen sichtbaren Knoten */
    var sichtbar = {};
    [rollen, aufgaben, ergebnisse].forEach(function (sp) {
      sp.forEach(function (k) { sichtbar[k.id] = true; });
    });
    var kanten = m.kanten.filter(function (kante) {
      if (!rel[kante.rel] || !sichtbar[kante.von] || !sichtbar[kante.nach]) { return false; }
      return kante.rel !== 'erzeugt' || erzeugtInPhasen(m.knoten[kante.von].eintrag, m.knoten[kante.nach].eintrag, phasenImUmfang, u.module);
    });

    if (zustand.isolierteAusblenden) {
      var grad = {};
      kanten.forEach(function (kante) { grad[kante.von] = true; grad[kante.nach] = true; });
      rollen = rollen.filter(function (k) { return grad[k.id]; });
      aufgaben = aufgaben.filter(function (k) { return grad[k.id]; });
      ergebnisse = ergebnisse.filter(function (k) { return grad[k.id]; });
      sichtbar = {};
      [rollen, aufgaben, ergebnisse].forEach(function (sp) { sp.forEach(function (k) { sichtbar[k.id] = true; }); });
      kanten = kanten.filter(function (kante) { return sichtbar[kante.von] && sichtbar[kante.nach]; });
    }

    return {
      spalten: [
        { kategorie: 'rolle', knoten: rollen },
        /* Auch im Fokus mit Bahnen: der Zeichner zeigt nur belegte Bahnen,
           so bleibt bei wenigen Elementen lesbar, in welcher Phase (bzw.
           welchem Modul) sie liegen — und der Modul-Zwischentitel steht dabei. */
        { kategorie: 'aufgabe', knoten: aufgaben, gruppeVon: gruppeVon, untergruppeVon: nachModul ? untergruppeVon : null },
        { kategorie: 'ergebnis', knoten: ergebnisse, gruppeVon: gruppeVonErgebnis, untergruppeVon: nachModul ? untergruppeVon : null }
      ].filter(function (sp) { return kat[sp.kategorie]; }),
      /* Bahnen des Swimlane-Layouts, in der Reihenfolge der Methode. */
      bahnen: gruppenNamen,
      /* Unterbahnen in den Phasenbahnen: die Module in der Reihenfolge der
         Abbildung 1 — der Zeichner legt je Modul eine gemeinsame Unterbahn
         über Aufgaben und Ergebnisse. */
      untergruppen: nachModul ? Object.keys(mo).sort(function (a, b) { return mo[a] - mo[b]; }) : null,
      achse: zustand.gruppierung === 'phase' ? 'phase' : 'modul',
      kanten: kanten,
      /* Zahlen im Umfang — unabhängig davon, ob die Spalte gerade sichtbar ist. */
      zahlen: { rolle: rollenReihe.length, aufgabe: aufgabenAlle.length, ergebnis: ergebnisseAlle.length },
      gezeigt: { rolle: rollen.length, aufgabe: aufgaben.length, ergebnis: ergebnisse.length }
    };
  }

  /* --- Fokus: ein Element mit seiner Nachbarschaft ------------------------- */

  /**
   * Menge der Knoten-IDs, die zum Fokus auf `id` gehören: das Element und
   * alles, was mit ihm direkt verbunden ist (eine Rolle mit ihren Aufgaben
   * und den Ergebnissen, die sie verantwortet; eine Aufgabe mit ihren Rollen
   * und Ergebnissen; ein Ergebnis mit den Aufgaben, die es erzeugen, und den
   * Rollen, die es verantworten). Keine zweite Stufe — sonst sieht ein Fokus
   * auf eine Rolle nach dem ganzen Graphen aus.
   */
  function fokusMenge(id) {
    var m = bauen();
    var k = m.knoten[id];
    if (!k) { return null; }
    var menge = {};
    menge[id] = true;
    k.kanten.forEach(function (kante) {
      menge[kante.von === id ? kante.nach : kante.von] = true;
    });
    return menge;
  }

  /* --- Einstieg über einen Lexikoneintrag ---------------------------------- */

  /**
   * Umfang, der einen Lexikoneintrag im Graphen sichtbar macht.
   * Aufgaben, Ergebnisse und Rollen werden ausgewählt; Phasen, Module und
   * Szenarien setzen den Umfang. Rückgabe null, wenn der Eintrag im Graphen
   * nicht vorkommt.
   */
  function einstieg(id) {
    var e = HT.daten.eintragMitId(id);
    if (!e) { return null; }
    switch (e.kategorie) {
      case 'aufgabe':
      case 'ergebnis': {
        var vorgehen = e.phasen.indexOf('Umsetzung') !== -1 && !schneidet(e.phasen, VORGEHEN.klassisch) ? 'agil' : 'klassisch';
        return {
          auswahlId: id,
          umfang: { vorgehen: vorgehen, phasen: [], module: e.module.length ? [e.module[0]] : [] },
          ansicht: 'module'
        };
      }
      case 'rolle':
        return { auswahlId: id, umfang: leererUmfang(), ansicht: 'module' };
      case 'phase': {
        var agil = VORGEHEN.agil.indexOf(e.begriff) !== -1 && VORGEHEN.klassisch.indexOf(e.begriff) === -1;
        return { umfang: { vorgehen: agil ? 'agil' : 'klassisch', phasen: [e.begriff], module: [] }, ansicht: 'phasen' };
      }
      case 'modul':
        return { umfang: { vorgehen: 'klassisch', phasen: [], module: [e.begriff] }, ansicht: 'module' };
      case 'szenario':
        return { umfang: { vorgehen: 'klassisch', phasen: [], module: e.module.slice() }, ansicht: 'module' };
      default:
        return null;
    }
  }

  /* --- Blöcke: je Aufgabe ihre Rolle und ihre Ergebnisse ---------------------- */

  /* Das Zuordnen des Trainers und das nachgebaute Bild des Überblicks zeigen
     dieselben Blöcke: je Aufgabe links die verantwortliche Rolle, rechts die
     Ergebnisse, die sie im Feld erzeugt. */
  var BLOCK_RELATIONEN = { verantwortlich: true, beteiligt: false, erzeugt: true, ergebnisrolle: false };

  /* Je Aufgabe im Umfang ihre verantwortliche Rolle und die Ergebnisse, die
     sie im Umfang erzeugt, in der Reihenfolge des Graphen; Bahn ist die Phase,
     Unterbahn das übergebene Modul (leer: keine). */
  function bloeckeImFeld(umfang, unter) {
    var tg = teilgraph({
      umfang: umfang,
      kategorien: { rolle: true, aufgabe: true, ergebnis: true },
      relationen: BLOCK_RELATIONEN,
      gruppierung: 'phase'
    });
    var aufgaben = null, knotenNach = {}, rang = {};
    tg.spalten.forEach(function (sp) {
      if (sp.kategorie === 'aufgabe') { aufgaben = sp; }
      sp.knoten.forEach(function (k, i) { knotenNach[k.id] = k; rang[k.id] = i; });
    });
    if (!aufgaben) { return []; }
    var rolleVon = {}, ergebnisseVon = {};
    tg.kanten.forEach(function (ka) {
      if (ka.rel === 'verantwortlich' && !rolleVon[ka.nach]) { rolleVon[ka.nach] = knotenNach[ka.von]; }
      if (ka.rel === 'erzeugt') { (ergebnisseVon[ka.von] = ergebnisseVon[ka.von] || []).push(knotenNach[ka.nach]); }
    });
    return aufgaben.knoten.map(function (a) {
      return {
        aufgabe: a,
        rolle: rolleVon[a.id] || null,
        ergebnisse: (ergebnisseVon[a.id] || []).sort(function (x, y) { return rang[x.id] - rang[y.id]; }),
        bahn: aufgaben.gruppeVon[a.id] || '',
        unter: unter
      };
    });
  }

  /**
   * Die Blöcke eines Umfangs, zusammengesetzt aus Feldern von je einer Phase
   * und einem Modul — Phase für Phase (leer: alle der Vorgehensweise), darin
   * Modul für Modul in der Reihenfolge der Daten (leer: alle). So steht eine
   * Aufgabe in jeder ihrer Phasen und, wie in der Abbildung 1, unter jedem
   * Modul, das sie dort hat, jeweils mit den Ergebnissen dieses Felds
   * («Lösungsanforderungen erarbeiten» im Konzept unter Produkt und unter
   * IT-System). mitUnter: das Modul als Unterbahn (sonst leer).
   */
  function bloecke(umfang, mitUnter) {
    var vp = phasenDerVorgehensweise(umfang.vorgehen);
    var phasen = umfang.phasen.length ? vp.filter(function (p) { return umfang.phasen.indexOf(p) !== -1; }) : vp;
    var alleModule = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var module = umfang.module.length ? alleModule.filter(function (m) { return umfang.module.indexOf(m) !== -1; }) : alleModule;
    var aus = [];
    phasen.forEach(function (phase) {
      module.forEach(function (modul) {
        var feld = { vorgehen: umfang.vorgehen, phasen: [phase], module: [modul] };
        aus = aus.concat(bloeckeImFeld(feld, mitUnter ? modul : ''));
      });
    });
    return aus;
  }

  /* --- Suche --------------------------------------------------------------- */

  function suchen(text, max) {
    return HT.daten.suchen(text, [])
      .map(function (e) { return knoten(e.id); })
      .filter(Boolean)
      .slice(0, max || 8);
  }

  HT.graph = {
    KATEGORIEN: KATEGORIEN,
    KAT: KAT,
    RELATIONEN: RELATIONEN,
    REL: REL,
    VORGEHEN: VORGEHEN,
    KEINE: KEINE,
    EBENEN: EBENEN,
    ZWINGENDE_MODULE: ZWINGENDE_MODULE,
    bauen: bauen,
    knoten: knoten,
    fokusMenge: fokusMenge,
    alleKnoten: alleKnoten,
    nachbarn: nachbarn,
    leererUmfang: leererUmfang,
    umfangAktiv: umfangAktiv,
    phasenDerVorgehensweise: phasenDerVorgehensweise,
    imUmfang: imUmfang,
    erzeugtInPhasen: erzeugtInPhasen,
    szenarioModule: szenarioModule,
    beitrag: beitrag,
    teilgraph: teilgraph,
    bloecke: bloecke,
    abbildungLagenSetzen: abbildungLagenSetzen,
    abbildungY: abbildungY,
    abbildungLage: abbildungLage,
    einstieg: einstieg,
    suchen: suchen
  };
}(window));
