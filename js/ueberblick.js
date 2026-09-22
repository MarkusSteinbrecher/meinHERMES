/* meinHERMES — Ansicht «Überblick» (Methodenüberblick).

   Eine Werkbank aus zwei Spalten: links die Bühne mit zwei Bereichen
   untereinander — oben Abbildung 1 des Referenzhandbuchs («Gesamtbild der
   HERMES-Module und der wesentlichen Ergebnisse entlang der Phasen»)
   unverändert als Originalgrafik von hermes.admin.ch mit einer unsichtbaren
   Trefferschicht darüber, unten der Graph der Methodenelemente
   (js/graph.js, über HT.graphSicht eingebettet); die Linie dazwischen trägt
   eine Pille: nur Abbildung, beide zur Hälfte, nur Graph. Rechts eine Inhaltsseite, die zu
   jedem Element immer dieselben Abschnitte in derselben Reihenfolge zeigt;
   der Graph zeigt das oben festgehaltene Element mit seinen Beziehungen.
   Dazwischen eine ziehbare Trennlinie. Der Filter (Phasen, Szenarien,
   Module) ist der des Graphen und gilt für beide Sichten; sein Knopf steht
   in der Kopfzeile der Anwendung rechts neben der Suche, die Auswahl nach
   Phasen, Szenarien, Modulen, Elementen und Verbindungen in der Leiste
   darunter.

   Schritte durch die Methode (js/methodenbild.js): vorn in der Leiste
   «‹ Konzept · Produkt 5/30 ▾ ›» statt Phasen, Szenarien und Module — die
   Pfeile setzen den Umfang auf den vorigen bzw. nächsten Schritt, der Titel
   öffnet alle Schritte als Popover. Ist ein Umfang gewählt, zeigt der obere
   Bereich statt der Originalabbildung das nachgebaute Bild dieses Umfangs
   (Rolle · Aufgabe · Ergebnisse, «Details» blendet Beteiligte und
   Kurzdefinitionen ein); das Gesamtbild und der Abfragemodus bleiben beim
   Original.

   Zwei Modi:
   – Erkunden — Zeigen füllt die Inhaltsseite, Klick hält den Eintrag fest.
     Über die Steuerung lässt sich eine Rolle einfärben oder alles ausblassen,
     was nicht minimal gefordert ist.
   – Abfragen — die Ergebniskästen werden verdeckt; gesucht wird der Ort in
     der Abbildung. Modulrahmen und Phasenbalken bleiben sichtbar, sie sind
     die Orientierungspunkte. Fehler werden gezählt und kommen in späteren
     Runden häufiger dran.

   Die Grafik wird nicht nachgebaut: Kästen, Beschriftungen und Pfeile stammen
   aus der SVG-Datei. Zur Laufzeit werden nur die Kästen über Füllfarbe und
   Kontur erkannt, ihre Beschriftung aus den Textfragmenten zusammengesetzt
   und mit den Einträgen aus data/ verbunden. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Abbildung, Farben und Kastenerkennung liegen in js/abbildung.js — der
     Trainer nutzt dieselbe Grafik und dieselbe Zuordnung zum Lexikon. */
  var BILDUNTERSCHRIFT = HT.abbildung.BILDUNTERSCHRIFT;
  var QUELLE_ALLGEMEIN = 'https://www.hermes.admin.ch/de/projektmanagement.html';
  var FARBEN = HT.abbildung.FARBEN;


  /* Farben der Trefferschicht. */
  var AKZENT = '#ec3013';
  var TINTE = '#201e1d';

  var ZOOM_MIN = 0.4;
  var ZOOM_MAX = 2.5;
  var ZOOM_SCHRITT = 1.2;

  var INHALT_STANDARD = 420;   // Breite der Inhaltsseite in px
  var INHALT_MIN = 280;
  var ABB_MIN = 380;           // so viel bleibt der Abbildung mindestens


  var RUNDEN_LAENGE = 12;
  var SPEICHER = 'ueberblick-drill';

  /* Die Zeichen, aus denen die Originalgrafik besteht — Legende unter der
     Abbildung. Sie greift auf FARBEN zu, damit Legende und Kastenerkennung
     nicht auseinanderlaufen. Die Kästen selbst sind anklickbar, die Linien
     und Rauten nicht. */
  var ABB_LEGENDE = [
    { form: 'ergebnis', text: 'Ergebnis — Dokument oder Checkliste' },
    { form: 'zustand', text: 'Ergebnis — Zustand' },
    { form: 'modul', text: 'Modul — Kopf einer Spalte' },
    { form: 'phase', text: 'Phase — Band am linken Rand' },
    { form: 'meilenstein', text: 'Meilenstein — Phasenübergang als Quality Gate' },
    { form: 'iteration', text: 'Iteration — agile Vorgehensweise' }
  ];

  var LEGENDE = [
    { kat: 'rolle', text: 'Rolle — wer verantwortet und mitwirkt' },
    { kat: 'aufgabe', text: 'Aufgabe — was getan wird' },
    { kat: 'ergebnis', text: 'Ergebnis — was dabei entsteht' },
    { kat: 'meilenstein', text: 'Meilenstein — Ergebnis als Quality Gate' },
    { kat: 'modul', text: 'Modul — Bündel von Aufgaben und Ergebnissen' },
    { kat: 'phase', text: 'Phase — Abschnitt im Projektverlauf' }
  ];

  var zustand = {
    modus: 'erkunden',        // 'erkunden' | 'abfragen'
    sicht: 'original',        // Gesamtbild: 'original' (Abbildung 1) | 'nachbau'
    abbildungOffen: true,     // oberer Bereich der Bühne (Abbildung) aufgeklappt
    graphOffen: true,         // unterer Bereich der Bühne (Graph) aufgeklappt
    details: false,           // nachgebautes Bild: Beteiligte und Kurzdefinitionen zeigen
    rolle: '',                // eingefärbte Rolle (Begriff) oder ''
    nurMinimal: false,        // alles ausblassen, was nicht minimal gefordert ist
    zoom: 1,
    aktiv: null,              // Eintrag, den die Inhaltsseite zeigt
    gezeichnet: null,         // id des zuletzt gezeichneten Eintrags
    gehalten: false,          // durch Klick festgehalten
    nurAbb: false,            // Inhaltsseite eingeklappt («Breit»)
    panel: false,             // Steuerung offen
    inhaltBreite: INHALT_STANDARD,
    runde: null,              // { aufgaben, i, phase, falschesFeld }
    punkte: 0,
    versuche: 0,
    serie: 0,
    besteSerie: 0,
    fehler: {},               // Begriff -> Anzahl Fehlversuche
    initialisiert: false
  };

  var refs = {};
  var passTimer = null;
  var groesseAngemeldet = false;
  var graph = null;             // Steuerung der eingebetteten Graph-Sicht
  var nachLadenZeigen = null;   // Eintrag aus ?id=, sobald die Abbildung steht

  /* --- Zustand sichern ----------------------------------------------------- */

  /* Gespeichert wird, was über eine Runde hinaus zählt: die Fehlerbilanz, die
     beste Serie und die Aufteilung der Bühne — wer nur den Graphen will,
     findet ihn beim nächsten Mal wieder so vor. Punkte und laufende Serie gehören zur
     Runde, die Spaltenbreite stellt sich bei jedem Aufruf neu ein. */
  function speichern() {
    HT.store.schreib(SPEICHER, {
      fehler: zustand.fehler,
      besteSerie: zustand.besteSerie,
      abbildungOffen: zustand.abbildungOffen,
      graphOffen: zustand.graphOffen,
      details: zustand.details,
      sicht: zustand.sicht
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object') { return; }
    if (g.fehler && typeof g.fehler === 'object') { zustand.fehler = g.fehler; }
    if (typeof g.besteSerie === 'number' && g.besteSerie >= 0) { zustand.besteSerie = g.besteSerie; }
    if (typeof g.abbildungOffen === 'boolean') { zustand.abbildungOffen = g.abbildungOffen; }
    if (typeof g.graphOffen === 'boolean') { zustand.graphOffen = g.graphOffen; }
    if (typeof g.details === 'boolean') { zustand.details = g.details; }
    if (g.sicht === 'original' || g.sicht === 'nachbau') { zustand.sicht = g.sicht; }
    /* Beide zu gab es mit den Kopfzeilen; die Pille kennt es nicht. */
    if (!zustand.abbildungOffen && !zustand.graphOffen) { zustand.abbildungOffen = true; zustand.graphOffen = true; }
  }

  /* Die Adresse trägt Sicht, Umfang und Auswahl — als Deep-Link teilbar. */
  function urlSetzen() {
    if (!graph) { return; }
    var teile = graph.urlTeile();
    var neu = '#/ueberblick?' + teile.join('&');
    if (global.location.hash !== neu) {
      try { global.history.replaceState(null, '', neu); } catch (e) { /* egal */ }
    }
  }

  /* --- Trefferschicht ------------------------------------------------------ */

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function namenVon(eintraege) {
    return eintraege.map(function (x) { return x.begriff; }).join(' / ');
  }

  function feldBauen(k, eintraege) {
    var gruppe = svgEl('g', { tabindex: '0', role: 'button', 'class': 'ub-feld' });
    var flaeche = svgEl('rect', {
      x: k.x - 1, y: k.y - 1, width: k.w + 2, height: k.h + 2,
      fill: '#ffffff', 'fill-opacity': '0', stroke: 'none'
    });
    var titel = svgEl('title', {});
    titel.appendChild(document.createTextNode(namenVon(eintraege)));

    gruppe.appendChild(flaeche);
    gruppe.appendChild(titel);

    var feld = {
      gruppe: gruppe, flaeche: flaeche, titel: titel, deckel: null,
      eintraege: eintraege, rahmen: k, art: k.art,
      name: namenVon(eintraege), schwebt: false, aufgedeckt: false
    };

    gruppe.addEventListener('mouseenter', function () {
      feld.schwebt = true;
      if (zustand.modus === 'erkunden' && !zustand.gehalten) { aktivSetzen(eintraege[0]); }
      malen();
    });
    gruppe.addEventListener('mouseleave', function () { feld.schwebt = false; malen(); });
    gruppe.addEventListener('focus', function () {
      feld.schwebt = true;
      if (zustand.modus === 'erkunden' && !zustand.gehalten) { aktivSetzen(eintraege[0]); }
      malen();
    });
    gruppe.addEventListener('blur', function () { feld.schwebt = false; malen(); });
    gruppe.addEventListener('click', function () { feldGeklickt(feld); });
    gruppe.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        feldGeklickt(feld);
      }
    });

    return feld;
  }

  function feldGeklickt(feld) {
    if (zustand.modus === 'abfragen') { antworten(feld); return; }
    var gleich = zustand.aktiv && zustand.aktiv.id === feld.eintraege[0].id;
    zustand.gehalten = !(gleich && zustand.gehalten);
    aktivSetzen(feld.eintraege[0]);
    malen();
    graphFolgen(feld.eintraege[0], zustand.gehalten);
    if (zustand.gehalten) { inhaltInSichtBringen(); }
  }

  /* Der Graph unten zeigt, was oben festgehalten ist: Aufgabe, Ergebnis,
     Rolle im Fokus mit den direkten Verbindungen; Modul, Phase, Szenario als
     Umfang. Wird das Element wieder gelöst, geht auch der Fokus bzw. die
     Auswahl im Umfang. */
  function graphFolgen(e, halten) {
    if (!graph) { return; }
    var gruppe = e.kategorie === 'modul' || e.kategorie === 'phase' || e.kategorie === 'szenario';
    if (halten) {
      if (gruppe || graph.fokusId() !== e.id) { graph.suchtreffer(e); }
      graph.auswaehlen(e.id);
      return;
    }
    if (gruppe) {
      var u = graph.umfang();
      if (e.kategorie === 'modul' && u.module.length === 1 && u.module[0] === e.begriff) { graph.listeSchalten('module', e.begriff); }
      if (e.kategorie === 'phase' && u.phasen.length === 1 && u.phasen[0] === e.begriff) { graph.listeSchalten('phasen', e.begriff); }
      graph.auswaehlen(null);
    } else if (graph.fokusId() === e.id) {
      graph.fokus(null);
      graph.auswaehlen(null);
    } else {
      graph.auswaehlen(null);
    }
  }

  /* Auf schmalen Schirmen steht die Inhaltsseite unter der Abbildung; ohne
     diesen Sprung sieht ein Tippen auf einen Kasten nach nichts aus. */
  function inhaltInSichtBringen() {
    if (!refs.inhalt || !global.matchMedia) { return; }
    if (!global.matchMedia('(max-width: 699.98px)').matches) { return; }
    try {
      refs.inhalt.scrollIntoView({ block: 'start' });
    } catch (e) {
      refs.inhalt.scrollIntoView();
    }
  }

  function aktivSetzen(eintrag) {
    if (zustand.aktiv === eintrag) { return; }
    zustand.aktiv = eintrag;
    inhaltZeichnen();
  }

  /* --- Einfärben ----------------------------------------------------------- */

  function rollenBezug(e) {
    if (!zustand.rolle || e.kategorie !== 'ergebnis') { return ''; }
    var norm = HT.daten.normalisieren(zustand.rolle);
    if (HT.daten.normalisieren(e.verantwortlich || '') === norm) { return 'verantwortlich'; }
    var beteiligt = e.beteiligt || [];
    for (var i = 0; i < beteiligt.length; i++) {
      if (HT.daten.normalisieren(beteiligt[i]) === norm) { return 'beteiligt'; }
    }
    return 'ohne';
  }

  /* Gezeichnet wird ausschliesslich auf der Trefferschicht; die Originalgrafik
     bleibt unangetastet. */
  function malen() {
    var runde = zustand.runde;
    var gesucht = runde ? runde.aufgaben[runde.i] : null;

    (refs.felder || []).forEach(function (f) {
      var e = f.eintraege[0];
      var fill = '#ffffff', op = 0, stroke = 'none', sw = 0;
      var verdeckt = false;

      if (zustand.modus === 'abfragen') {
        verdeckt = f.art === 'ergebnis' && !!runde && runde.phase !== 'ende' && !f.aufgedeckt;
        if (f.deckel) { f.deckel.style.display = verdeckt ? 'block' : 'none'; }

        if (runde && gesucht && istGesucht(f, gesucht) && runde.phase !== 'frage') {
          fill = AKZENT; op = 0.32; stroke = AKZENT; sw = 2;
        } else if (runde && f === runde.falschesFeld) {
          fill = TINTE; op = 0.1; stroke = TINTE; sw = 2;
        } else if (f.schwebt && f.art === 'ergebnis' && runde && runde.phase === 'frage') {
          fill = TINTE; op = 0.08;
        }
      } else {
        if (f.deckel) { f.deckel.style.display = 'none'; }
        var bezug = rollenBezug(e);
        var blass = (zustand.nurMinimal && e.kategorie === 'ergebnis' && !e.minimalGefordert)
          || !imAuswahl(f);

        if (bezug === 'verantwortlich') { fill = AKZENT; op = 0.3; stroke = AKZENT; sw = 2; }
        else if (bezug === 'beteiligt') { op = 0; stroke = AKZENT; sw = 2; }
        else if (bezug === 'ohne' || blass) { fill = '#ffffff'; op = (bezug === 'ohne' && blass) ? 0.82 : 0.7; }

        if (zustand.gehalten && zustand.aktiv && istGleich(f, zustand.aktiv)) {
          fill = AKZENT; op = 0.18; stroke = AKZENT; sw = 2;
        }
        if (f.schwebt) { fill = AKZENT; op = 0.2; stroke = AKZENT; sw = 2; }
      }

      f.flaeche.setAttribute('fill', fill);
      f.flaeche.setAttribute('fill-opacity', String(op));
      f.flaeche.setAttribute('stroke', stroke);
      f.flaeche.setAttribute('stroke-width', String(sw));

      /* Verdeckte Kästen dürfen ihren Namen nicht im Tooltip verraten. */
      f.titel.textContent = verdeckt ? 'Verdeckter Ergebniskasten' : f.name;
    });
    bildMarkieren();
  }

  /* Szenario-Filter: ein Feld gehört dazu, wenn eines seiner Elemente in
     einem Modul des Szenarios liegt (Modulköpfe über ihren Namen). Phasen
     bleiben immer sichtbar — sie sind die Orientierung. */
  /* Modulliste aus dem Graphmodell — samt der zwingenden Module (Kap. 3.2.1). */
  /* Phasen- und Modulauswahl kommen aus dem Filter des Graphen; leer heisst
     alle. Ein Ergebniskasten passt, wenn eines seiner Elemente in einer
     gewählten Phase und einem gewählten Modul liegt; Modulköpfe zählen über
     ihren Namen, Phasenbalken über ihren. Ein Szenario ist im Filter eine
     Modulauswahl. */
  function umfang() {
    return graph ? graph.umfang() : { phasen: [], module: [] };
  }
  function filterAktiv() {
    return !!graph && graph.umfangAktiv();
  }
  function imAuswahlEintrag(e) {
    var u = umfang();
    var ph = u.phasen, mo = u.module;
    if (!ph.length && !mo.length) { return true; }
    if (e.kategorie === 'phase') { return !ph.length || ph.indexOf(e.begriff) !== -1; }
    if (e.kategorie === 'modul') { return !mo.length || mo.indexOf(e.begriff) !== -1; }
    var phOk = !ph.length || (e.phasen || []).some(function (p) { return ph.indexOf(p) !== -1; });
    var moOk = !mo.length || (e.module || []).some(function (m) { return mo.indexOf(m) !== -1; });
    return phOk && moOk;
  }
  function imAuswahl(feld) {
    var u = umfang();
    if (!u.phasen.length && !u.module.length) { return true; }
    return feld.eintraege.some(imAuswahlEintrag);
  }
  /* Die eingefärbte Rolle ist die gewählte Rolle: sie hat keinen Kasten in
     der Abbildung, darum zeigt die Abbildung die Auswahl als Einfärbung
     ihrer Ergebnisse. */
  function rolleSetzen(name) {
    if (zustand.rolle === name) { return; }
    zustand.rolle = name;
    malen();
    suchChipsZeichnen();
    if (zustand.panel) { panelZeichnen(); }
  }

  /* Rolle abwählen: ist sie im Graph gewählt, geht die Auswahl dort mit. */
  function rolleLoesen() {
    var a = zustand.gehalten ? zustand.aktiv : null;
    if (graph && a && a.kategorie === 'rolle' && graph.auswahlId() === a.id) {
      graph.fokus(null);            // meldet die leere Auswahl, das löscht die Rolle
      if (zustand.rolle) { rolleSetzen(''); }
      return;
    }
    rolleSetzen('');
  }

  /* Ein einzelnes Modul oder eine einzelne Phase im Filter des Graphen ist
     dasselbe wie der festgehaltene Modulkopf bzw. Phasenbalken oben — und
     umgekehrt: fällt der Umfang weg oder wächst er, löst sich der Kasten. */
  var abgleichLaeuft = false;
  function umfangAbgleichen() {
    if (!graph || abgleichLaeuft) { return; }
    var u = graph.umfang();
    var einzel = null;
    if (u.module.length === 1 && !u.phasen.length) { einzel = HT.daten.eintragMitBegriff(u.module[0], 'modul'); }
    else if (u.phasen.length === 1 && !u.module.length) { einzel = HT.daten.eintragMitBegriff(u.phasen[0], 'phase'); }
    var a = zustand.gehalten ? zustand.aktiv : null;
    var aGruppe = !!a && (a.kategorie === 'modul' || a.kategorie === 'phase');
    abgleichLaeuft = true;
    try {
      if (aGruppe && (!einzel || einzel.id !== a.id)) {
        zustand.gehalten = false;
        aktivSetzen(null);
        if (graph.auswahlId() === a.id) { graph.auswaehlen(null); }
      } else if (einzel && !zustand.gehalten && !graph.fokusId() && !graph.auswahlId()) {
        zustand.gehalten = true;
        aktivSetzen(einzel);
        graph.auswaehlen(einzel.id);
      }
    } finally {
      abgleichLaeuft = false;
    }
  }

  function filterGeaendert() {
    malen();
    werkzeugAktualisieren();
    suchChipsZeichnen();
    urlSetzen();
  }

  /* --- Die drei Bilder des oberen Bereichs ----------------------------------- */

  /* Oben steht eines von dreien:
     – 'original' die Originalgrafik (Abbildung 1),
     – 'gesamt'   dasselbe Gesamtbild nachgebaut (js/gesamtbild.js) — mit
                  getrennten Spalten für Projektsteuerung und Projektführung
                  und allen Ergebnissen; zwischen beiden schaltet die Leiste
                  oben rechts um,
     – 'nachbau'  das Bild eines gewählten Umfangs (js/methodenbild.js).
     Der Abfragemodus spielt immer auf der Originalgrafik. Neu gebaut wird
     nur, wenn sich Umfang, «Details» oder die Vorgehensweise ändern; sonst
     wird nur neu gemalt. */
  var bildUmfang = null, bildDetails = null;
  var gesamtVorgehen = null;

  function bildArt() {
    if (zustand.modus !== 'erkunden') { return 'original'; }
    if (graph && graph.umfangAktiv()) { return 'nachbau'; }
    return zustand.sicht === 'nachbau' ? 'gesamt' : 'original';
  }

  function vorgehenJetzt() {
    return (graph && graph.umfang().vorgehen) || 'klassisch';
  }

  function bildZeichnen() {
    if (!refs.bild || !refs.buehneHuelle || !graph) { return; }
    var art = bildArt();
    var vorher = refs.buehneHuelle.dataset.bild;
    refs.buehneHuelle.dataset.bild = art;
    if (refs.knopfDetails) { refs.knopfDetails.setAttribute('aria-pressed', zustand.details ? 'true' : 'false'); }
    sichtKnoepfeAktualisieren();

    if (art !== 'nachbau') {
      bildUmfang = null;
      HT.ui.leeren(refs.bild);
    }
    if (art === 'gesamt') {
      var v = vorgehenJetzt();
      if (v !== gesamtVorgehen) {
        HT.ui.leeren(refs.gesamtRahmen).appendChild(HT.gesamtbild.bauen(v, {
          beiZeigen: bildGezeigt,
          beiKlick: bildGeklickt
        }));
        gesamtVorgehen = v;
        refs.gesamt.scrollTop = 0;
        refs.gesamt.scrollLeft = 0;
      }
      gesamtMalen();
    }
    /* Verborgen hatte der Bereich keine Breite zum Einpassen. */
    if (vorher !== art && art !== 'nachbau') { zoomPassendSpaeter(40); }
    if (art !== 'nachbau') { return; }

    var u = graph.umfang();
    var schluessel = JSON.stringify([u.vorgehen, u.phasen, u.module]);
    if (schluessel !== bildUmfang || zustand.details !== bildDetails) {
      var oben = schluessel === bildUmfang ? refs.bild.scrollTop : 0;
      HT.ui.leeren(refs.bild).appendChild(HT.methodenbild.bauen(u, {
        details: zustand.details,
        beiZeigen: bildGezeigt,
        beiKlick: bildGeklickt
      }));
      refs.bild.scrollTop = oben;
      bildUmfang = schluessel;
      bildDetails = zustand.details;
    }
    bildMarkieren();
  }

  function bildMarkieren() {
    if (refs.bild && refs.bild.firstChild) {
      HT.methodenbild.markieren(refs.bild.firstChild, zustand.gehalten && zustand.aktiv ? zustand.aktiv.id : null);
    }
    gesamtMalen();
  }

  /* Das nachgebaute Gesamtbild kennt keinen eigenen Zustand: Rolle, «nur
     minimal», Auswahl und das festgehaltene Element kommen von hier. */
  function gesamtMalen() {
    var el = refs.gesamtRahmen && refs.gesamtRahmen.firstChild;
    if (!el) { return; }
    HT.gesamtbild.malen(el, {
      rolle: zustand.rolle,
      nurMinimal: zustand.nurMinimal,
      aktivId: zustand.gehalten && zustand.aktiv ? zustand.aktiv.id : null,
      imAuswahl: filterAktiv() ? imAuswahlEintrag : null
    });
  }

  function sichtSetzen(sicht) {
    if (zustand.sicht === sicht) { return; }
    zustand.sicht = sicht;
    speichern();
    bildZeichnen();
  }

  function sichtKnoepfeAktualisieren() {
    (refs.sichtKnoepfe || []).forEach(function (b) {
      b.setAttribute('aria-checked', b.dataset.sicht === zustand.sicht ? 'true' : 'false');
    });
  }

  function bildGezeigt(e) {
    if (zustand.modus === 'erkunden' && !zustand.gehalten) { aktivSetzen(e); }
  }

  /* Klick im Bild: wie auf einen Kasten der Abbildung festhalten bzw. lösen.
     Der Graph wählt das Element nur aus, statt es in den Fokus zu nehmen —
     der Fokus leerte den Umfang, und mit ihm verschwände der Schritt. */
  function bildGeklickt(e) {
    var gleich = zustand.aktiv && zustand.aktiv.id === e.id;
    zustand.gehalten = !(gleich && zustand.gehalten);
    aktivSetzen(e);
    malen();
    if (graph) { graph.auswaehlen(zustand.gehalten ? e.id : null); }
    if (zustand.gehalten) { inhaltInSichtBringen(); }
  }

  function detailsSetzen(an) {
    zustand.details = an;
    speichern();
    bildZeichnen();
  }

  var IKONE_PFEIL_LINKS = ['M15 5l-7 7 7 7'];
  var IKONE_PFEIL_RECHTS = ['M9 5l7 7-7 7'];
  /* Welche Vorgehensweise der Popover der Schritte zeigt; null = die des Umfangs. */
  var popVorgehen = null;

  /* Vorn in der Leiste: ‹ Titel des Schritts mit Nummer ▾ ›. Der Titel hat
     eine feste Breite, damit die Pfeile beim Durchklicken stehen bleiben. */
  function schritteBauen() {
    refs.schrittZurueck = h('button', {
      type: 'button', class: 'ub-schritte__pfeil', on: { click: function () { schrittGehen(-1); } }
    }, HT.ui.symbol(IKONE_PFEIL_LINKS, 18));
    refs.schrittName = h('span', { class: 'ub-schritte__name' });
    refs.schrittZahl = h('span', { class: 'ub-schritte__zahl' });
    refs.schrittTitel = h('button', {
      type: 'button', class: 'ub-schritte__titel', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
      on: { click: function () {
        if (!graph) { return; }
        popVorgehen = null;
        graph.popUmschalten('schritte');
      } }
    }, [refs.schrittName, refs.schrittZahl, HT.ui.symbol(['M7 10l5 5 5-5'], 14)]);
    refs.schrittWeiter = h('button', {
      type: 'button', class: 'ub-schritte__pfeil', on: { click: function () { schrittGehen(1); } }
    }, HT.ui.symbol(IKONE_PFEIL_RECHTS, 18));
    return h('div', { class: 'ub-schritte', role: 'group', 'aria-label': 'Schritte durch die Methode' },
      [refs.schrittZurueck, refs.schrittTitel, refs.schrittWeiter]);
  }

  function pfeilSetzen(knopf, ziel, text) {
    knopf.disabled = !ziel;
    var t = ziel ? text + ': ' + ziel.titel : text;
    knopf.title = t;
    knopf.setAttribute('aria-label', t);
  }

  function schritteAktualisieren() {
    if (!refs.schrittTitel || !graph) { return; }
    var u = graph.umfang();
    var n = HT.methodenbild.nachbarn(u);
    var name = n.schritt ? n.schritt.titel : HT.methodenbild.titelVon(u);
    refs.schrittName.textContent = name;
    refs.schrittZahl.textContent = n.schritt && n.schritt.index ? n.schritt.index + '/' + n.anzahl : '';
    refs.schrittTitel.title = name + (u.vorgehen === 'agil' ? ' (agil)' : '') + ' — alle Schritte zeigen';
    pfeilSetzen(refs.schrittZurueck, n.vorige, 'Voriger Schritt');
    pfeilSetzen(refs.schrittWeiter, n.naechste, 'Nächster Schritt');
  }

  function schrittGehen(richtung) {
    if (!graph) { return; }
    var n = HT.methodenbild.nachbarn(graph.umfang());
    var ziel = richtung < 0 ? n.vorige : n.naechste;
    if (ziel) { graph.umfangSetzen(ziel.umfang); }
  }

  /* Der Popover der Schritte: oben die Vorgehensweise, darunter alle
     Schritte in ihrer Folge — Phasen mit Seiten je Modul als Abschnitt —,
     je mit der Zahl der Aufgaben. Aufbau wie die Szenarien in «Alle Filter». */
  function schritteInhalt() {
    var u = graph.umfang();
    var vorgehen = popVorgehen || u.vorgehen;
    var aktuell = HT.methodenbild.schrittVon(u);

    var segment = h('div', { class: 'segment segment--klein', role: 'group', 'aria-label': 'Vorgehensweise' },
      [['klassisch', 'Klassisch'], ['agil', 'Agil']].map(function (o) {
        return h('button', {
          type: 'button', class: 'segment__knopf', text: o[1], 'data-fokus': 'vorgehen:' + o[0],
          'aria-pressed': o[0] === vorgehen ? 'true' : 'false',
          on: { click: function () { popVorgehen = o[0]; graph.popNeu(); } }
        });
      }));

    function eintrag(s, label) {
      var an = aktuell === s;
      return h('button', {
        type: 'button', class: 'gaf__szenario', 'aria-pressed': an ? 'true' : 'false', 'data-fokus': 'schritt:' + vorgehen + ':' + s.index,
        on: { click: function () { popVorgehen = null; graph.umfangSetzen(s.umfang); } }
      }, [
        h('span', { class: 'gaf__szenario-haken', 'aria-hidden': 'true', text: an ? '●' : '○' }),
        h('span', { class: 'gaf__szenario-titel', text: label }),
        s.aufgaben ? h('span', { class: 'gs-schalter__extra', title: s.aufgaben + ' Aufgaben', text: String(s.aufgaben) }) : null
      ]);
    }

    /* Gesamtbild und ganze Phasen stehen lose, die Phasen mit Seiten je Modul
       als Abschnitt mit Titel. */
    var abschnitte = [], offen = null;
    HT.methodenbild.schritte(vorgehen).forEach(function (s) {
      var gruppe = s.art === 'feld' ? s.phase : '';
      if (!offen || offen.gruppe !== gruppe) {
        offen = { gruppe: gruppe, liste: h('div', { class: 'gs-liste', role: 'group', 'aria-label': gruppe || 'Schritte' }) };
        abschnitte.push(offen);
      }
      offen.liste.appendChild(eintrag(s, s.art === 'feld' ? s.name : s.titel));
    });

    return [
      h('section', { class: 'gaf' }, [h('div', { class: 'gaf__kopf' }, [h('h3', { class: 'gaf__titel', text: 'Vorgehensweise' })]), segment])
    ].concat(abschnitte.map(function (a) {
      return h('section', { class: 'gaf ub-schritte__abschnitt' }, [
        a.gruppe ? h('div', { class: 'gaf__kopf' }, [h('h3', { class: 'gaf__titel', text: a.gruppe })]) : null,
        a.liste
      ]);
    }));
  }

  /* --- Suche (Kopfzeile der Anwendung) --------------------------------------- */

  /* Ein Treffer der Suche: das Element wird festgehalten (Inhaltsseite),
     in der Abbildung in Sicht gerollt und im Graphen gezeigt — Modul, Phase,
     Szenario als Umfang (der Rest der Abbildung blasst ab), alles andere im
     Fokus; eine Rolle wird zusätzlich in der Abbildung eingefärbt. */
  function suchtrefferAnwenden(e) {
    if (!graph) { return; }
    if (zustand.modus !== 'erkunden') { modusSetzen('erkunden'); }
    if (e.kategorie === 'rolle') { zustand.rolle = e.begriff; }
    zustand.gehalten = true;
    aktivSetzen(e);
    graphFolgen(e, true);
    feldInSichtBringen(e);
    filterGeaendert();
    if (zustand.panel) { panelZeichnen(); }
    inhaltInSichtBringen();
  }

  /* Den Kasten des Eintrags in die Mitte der Bühne rollen. */
  function feldInSichtBringen(e) {
    if (!refs.buehne || !refs.felder) { return; }
    var feld = null;
    refs.felder.forEach(function (f) { if (!feld && istGleich(f, e)) { feld = f; } });
    if (!feld) { return; }
    var r = feld.flaeche.getBoundingClientRect(), b = refs.buehne.getBoundingClientRect();
    refs.buehne.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2);
    refs.buehne.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2);
  }

  /* Chips rechts auf der Linie zwischen den Bereichen: gewählte Phasen und
     Module, die eingefärbte Rolle — jeder mit × zum Entfernen. */
  function chipBauen(kat, name, titel, beiKlick) {
    return h('button', {
      type: 'button', class: 'gfokus gfokus--umfang', title: titel, 'aria-label': titel,
      on: { click: beiKlick }
    }, [
      h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 13)),
      h('span', { text: name }),
      h('span', { class: 'gfokus__x', 'aria-hidden': 'true', text: '×' })
    ]);
  }

  /* Chip daneben auf der Linie: das im Graphen gewählte Element
     (Aufgabe, Ergebnis, Rolle) mit × zum Aufheben — Module und Phasen stehen
     als Umfang oben. */
  function graphChipsZeichnen() {
    if (!refs.graphChips || !graph) { return; }
    HT.ui.leeren(refs.graphChips);
    /* Ohne Auswahl, aber mit Fokus (zweiter Klick löst nur die Auswahl):
       der Chip bleibt, damit sich der Fokus aufheben lässt. */
    var id = graph.auswahlId() || graph.fokusId();
    var e = id ? HT.daten.eintragMitId(id) : null;
    if (e && (e.kategorie === 'aufgabe' || e.kategorie === 'ergebnis' || e.kategorie === 'rolle')) {
      refs.graphChips.appendChild(chipBauen(e.kategorie, e.begriff, 'Auswahl «' + e.begriff + '» aufheben (Esc)', function () { graph.fokus(null); }));
    }
    refs.graphChips.hidden = !refs.graphChips.childNodes.length;
  }

  function suchChipsZeichnen() {
    if (!refs.suchChips) { return; }
    HT.ui.leeren(refs.suchChips);
    function chip(kat, name, titel, beiKlick) { refs.suchChips.appendChild(chipBauen(kat, name, titel, beiKlick)); }
    var u = umfang();
    /* «Keine» steht als eigener Chip; sein × schaltet wieder alle ein. */
    var keine = HT.graph.KEINE;
    u.phasen.forEach(function (name) {
      if (name === keine) { chip('phase', 'Keine Phase', 'Wieder alle Phasen zeigen', function () { graph.listeSchalten('phasen', name); }); return; }
      chip('phase', name, 'Phase ' + name + ' entfernen', function () { graph.listeSchalten('phasen', name); });
    });
    u.module.forEach(function (name) {
      if (name === keine) { chip('modul', 'Kein Modul', 'Wieder alle Module zeigen', function () { graph.listeSchalten('module', name); }); return; }
      chip('modul', name, 'Modul ' + name + ' entfernen', function () { graph.listeSchalten('module', name); });
    });
    if (zustand.rolle) {
      chip('rolle', zustand.rolle, 'Auswahl der Rolle aufheben', function () { rolleLoesen(); });
    }
    refs.suchChips.hidden = !refs.suchChips.childNodes.length;
  }

  function istGleich(feld, eintrag) {
    return feld.eintraege.some(function (x) { return x.id === eintrag.id; });
  }

  function istGesucht(feld, gesucht) {
    return istGleich(feld, gesucht);
  }

  /* --- Diagramm einsetzen -------------------------------------------------- */

  function diagrammVeredeln(svg, kaesten) {
    var gruppe = svg.getElementsByTagName('g')[0] || svg;

    var maske = svgEl('g', { 'class': 'ub-deckel' });
    var ebene = svgEl('g', { 'class': 'ub-felder' });
    var felder = [];
    var ohneTreffer = [];

    kaesten.forEach(function (k) {
      if (!k.beschriftung) { return; }
      var eintraege = k.eintraege;
      if (!eintraege) { ohneTreffer.push(k.beschriftung); return; }

      var feld = feldBauen(k, eintraege);
      if (k.art === 'ergebnis') {
        /* Der Deckel trägt die Originalfüllung des Kastens: im Abfragemodus
           bleibt der Kasten sichtbar, nur die Beschriftung verschwindet. */
        feld.deckel = svgEl('rect', {
          x: k.x + 1, y: k.y + 1,
          width: Math.max(0, k.w - 2), height: Math.max(0, k.h - 2),
          fill: k.fuell, stroke: 'none'
        });
        feld.deckel.style.display = 'none';
        maske.appendChild(feld.deckel);
      }
      felder.push(feld);
      ebene.appendChild(feld.gruppe);
    });

    gruppe.appendChild(maske);
    gruppe.appendChild(ebene);
    refs.felder = felder;

    if (ohneTreffer.length && global.console && global.console.info) {
      global.console.info('Überblick: Kästen ohne Lexikoneintrag —', ohneTreffer.join(' · '));
    }
  }

  function diagrammEinsetzen(svg) {
    var breite = Number(svg.getAttribute('width')) || 1059;
    var hoehe = Number(svg.getAttribute('height')) || 759;

    svg.setAttribute('viewBox', '0 0 ' + breite + ' ' + hoehe);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.removeAttribute('overflow');
    svg.setAttribute('class', 'ub-abb');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', BILDUNTERSCHRIFT);

    var kaesten = HT.abbildung.kaesten(svg);
    diagrammVeredeln(svg, kaesten);

    /* Die Reihenfolge der Ergebnisse in einem Feld folgt der Abbildung —
       ihre Lagen stehen erst jetzt. Das nachgebaute Gesamtbild wird darum
       hier noch einmal gebaut; ohne das hinge seine Ordnung davon ab, wer
       die Grafik zuerst gelesen hat. */
    HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(kaesten));
    HT.gesamtbild.vergessen();
    gesamtVorgehen = null;

    refs.abb = svg;
    refs.abbBreite = breite;

    HT.ui.leeren(refs.buehne);
    refs.buehne.appendChild(svg);
    bildZeichnen();
    zoomPassend();
    malen();
    rundeNachladenRichten();
    if (nachLadenZeigen) {
      var e = nachLadenZeigen;
      nachLadenZeigen = null;
      feldInSichtBringen(e);
    }
  }

  /* Die Felder entstehen erst mit der Abbildung. Wer vorher auf «Abfragen»
     schaltet oder die Ansicht mit laufender Runde verlässt und zurückkommt,
     trifft auf eine leere oder auf verschwundene Felder zeigende Runde. */
  function rundeNachladenRichten() {
    if (zustand.modus !== 'abfragen') { return; }
    var runde = zustand.runde;
    if (!runde || !runde.aufgaben.length) { rundeStarten(); return; }

    runde.falschesFeld = null;
    var gesucht = runde.aufgaben[runde.i];
    if (gesucht && runde.phase !== 'frage') {
      refs.felder.forEach(function (f) { if (istGleich(f, gesucht)) { f.aufgedeckt = true; } });
    }
    promptZeichnen();
    malen();
  }

  /* --- Zoom ---------------------------------------------------------------- */

  function zoomAnwenden() {
    if (refs.abb && refs.abbBreite) {
      refs.abb.style.width = Math.round(refs.abbBreite * zustand.zoom) + 'px';
    }
    /* Das nachgebaute Gesamtbild ist HTML in festen px: es wird skaliert, und
       der Rahmen darum nimmt die skalierten Masse an — sonst wüsste die
       scrollende Fläche nichts vom Zoom. */
    var gb = refs.gesamtRahmen && refs.gesamtRahmen.firstChild;
    if (gb) {
      gb.style.transform = 'scale(' + zustand.zoom + ')';
      refs.gesamtRahmen.style.width = Math.round(gb.offsetWidth * zustand.zoom) + 'px';
      refs.gesamtRahmen.style.height = Math.round(gb.offsetHeight * zustand.zoom) + 'px';
    }
    if (refs.zoomWert) { refs.zoomWert.textContent = Math.round(zustand.zoom * 100) + ' %'; }
  }

  function zoomSetzen(wert) {
    zustand.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, wert));
    zoomAnwenden();
  }

  function zoomPassend() {
    var gesamt = bildArt() === 'gesamt';
    var flaeche = gesamt ? refs.gesamt : refs.buehne;
    var breite = gesamt ? HT.gesamtbild.breite() : refs.abbBreite;
    if (!flaeche || !breite) { return; }
    var platz = flaeche.clientWidth - 32;
    if (platz <= 0) { return; }
    zoomSetzen(platz / breite);
  }

  function zoomPassendSpaeter(verzoegerung) {
    global.clearTimeout(passTimer);
    passTimer = global.setTimeout(zoomPassend, verzoegerung || 60);
  }

  /* Massstab der Bühne: derselbe Zoom wie die Knöpfe unten rechts. */
  function buehneSkalieren(faktor) {
    var alt = zustand.zoom;
    zoomSetzen(alt * faktor);
    return zustand.zoom / alt;
  }

  /* Massstab des Beziehungsbilds: die Breite wächst oder schrumpft um den
     Faktor, begrenzt auf das 0,4- bis 3-Fache der Zeichnungsbreite. Ab dem
     ersten Zoomen gilt die CSS-Grenze «höchstens Spaltenbreite» nicht mehr. */
  /* --- Breite der Inhaltsseite --------------------------------------------- */

  function inhaltBreiteSetzen(px) {
    var grenze = Math.max(INHALT_MIN, global.innerWidth - ABB_MIN);
    zustand.inhaltBreite = Math.max(INHALT_MIN, Math.min(px, grenze));
    if (refs.werkbank) {
      refs.werkbank.style.setProperty('--ub-inhalt', zustand.inhaltBreite + 'px');
    }
  }

  function ziehenStarten(ev) {
    if (ev.button !== undefined && ev.button !== 0) { return; }
    ev.preventDefault();

    var startX = ev.clientX;
    var startBreite = zustand.inhaltBreite;

    function bewegen(e) { inhaltBreiteSetzen(startBreite - (e.clientX - startX)); }
    function beenden() {
      global.removeEventListener('mousemove', bewegen);
      global.removeEventListener('mouseup', beenden);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      zoomPassendSpaeter(60);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    global.addEventListener('mousemove', bewegen);
    global.addEventListener('mouseup', beenden);
  }

  function trennerTaste(ev) {
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      inhaltBreiteSetzen(zustand.inhaltBreite + 24);
      zoomPassendSpaeter(60);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      inhaltBreiteSetzen(zustand.inhaltBreite - 24);
      zoomPassendSpaeter(60);
    }
  }

  /* --- Schwebende Bedienelemente auf der Bühne ----------------------------- */

  /* Auf der Bühne liegen nur noch Icons: oben rechts öffnet ein Schieberegler
     die Steuerung (Modus, Rolle, Darstellung, Inhaltsseite einklappen), unten
     rechts sitzt der Zoom wie auf einer Karte. Die Zeichen der Abbildung
     stehen in der Karte hinter dem Info-Icon der Leiste (infoInhalt). */

  var IKONE_STEUERUNG = ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M16 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z', 'M10 14.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z'];

  function ikonKnopf(beschriftung, pfade, aufruf, attrs) {
    var a = { type: 'button', 'class': 'ub-ikonknopf', title: beschriftung, 'aria-label': beschriftung };
    for (var k in (attrs || {})) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; }
    }
    var el = h('button', a, HT.ui.symbol(pfade, 18));
    el.addEventListener('click', aufruf);
    return el;
  }

  function werkzeugKnopf(text, klasse, aufruf, attrs) {
    var a = { type: 'button', 'class': klasse, text: text };
    for (var k in (attrs || {})) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; }
    }
    var el = h('button', a);
    el.addEventListener('click', aufruf);
    return el;
  }

  function werkzeugTrenner() {
    return h('span', { class: 'ub-schweber__strich', 'aria-hidden': 'true' });
  }

  function werkzeugAktualisieren() {
    if (!refs.knopfPanel) { return; }
    refs.knopfPanel.setAttribute('aria-expanded', zustand.panel ? 'true' : 'false');
    refs.werkbank.dataset.breit = zustand.nurAbb ? 'true' : 'false';
    refs.werkbank.dataset.modus = zustand.modus;
    bereicheAnwenden();
  }

  /* --- Zwei Bereiche der Bühne: Abbildung oben, Graph unten ---------------- */

  /* Zwischen den Bereichen liegt eine Linie mit einer Pille aus drei Icons:
     nur die Abbildung, beide zur Hälfte, nur der Graph. Offen teilen sich die
     Bereiche die Höhe; ist nur einer offen, liegt die Linie an seinem Rand und
     bleibt so erreichbar. Das Icon zeigt, wo die Linie dann steht. */
  var RAHMEN = 'M4 4h16v16H4Z';
  var TEILUNGEN = [
    { art: 'oben',  label: 'Nur Abbildung',                  abbildung: true,  graph: false, pfade: [RAHMEN, 'M4 17h16'] },
    { art: 'halb',  label: 'Abbildung und Graph je zur Hälfte', abbildung: true, graph: true, pfade: [RAHMEN, 'M4 12h16'] },
    { art: 'unten', label: 'Nur Graph',                      abbildung: false, graph: true,  pfade: [RAHMEN, 'M4 7h16'] }
  ];

  function teilungAktuell() {
    if (zustand.abbildungOffen && !zustand.graphOffen) { return 'oben'; }
    if (!zustand.abbildungOffen && zustand.graphOffen) { return 'unten'; }
    return 'halb';
  }

  function teilungSetzen(art) {
    var t = TEILUNGEN.filter(function (x) { return x.art === art; })[0];
    if (!t || art === teilungAktuell()) { return; }
    zustand.abbildungOffen = t.abbildung;
    zustand.graphOffen = t.graph;
    zustand.panel = false;
    panelZeichnen();
    if (graph) { graph.popSchliessen(); }
    bereicheAnwenden();
    /* Der Graph holt verborgen Versäumtes nach bzw. passt sich der neuen Höhe
       an; die Abbildung wird neu auf die Breite gepasst. */
    if (graph) {
      if (zustand.graphOffen) { graph.sichtbarGeworden(); } else { graph.verborgen(); }
    }
    if (zustand.abbildungOffen) { zoomPassendSpaeter(40); }
    speichern();
  }

  function bereicheAnwenden() {
    if (!refs.bereiche || !refs.bereiche.abbildung || !refs.bereiche.graph || !refs.teilungKnoepfe) { return; }
    refs.bereiche.abbildung.dataset.offen = zustand.abbildungOffen ? 'auf' : 'zu';
    refs.bereiche.graph.dataset.offen = zustand.graphOffen ? 'auf' : 'zu';
    var aktuell = teilungAktuell();
    if (refs.sichten) { refs.sichten.dataset.teilung = aktuell; }
    refs.teilungKnoepfe.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.art === aktuell ? 'true' : 'false');
    });
  }

  /* Die Linie: links die Pille, rechts `chips`. */
  function teilungBauen(chips) {
    refs.teilungKnoepfe = TEILUNGEN.map(function (t) {
      return ikonKnopf(t.label, t.pfade, function () { teilungSetzen(t.art); },
        { 'aria-pressed': 'false', 'data-art': t.art });
    });
    return h('div', { class: 'ub-teilung' }, [
      h('div', { class: 'ub-teilung__pille', role: 'group', 'aria-label': 'Aufteilung von Abbildung und Graph' }, refs.teilungKnoepfe),
      chips
    ]);
  }

  /* Der Knopf «Im Graph» der Inhaltsseite: den Graphen aufklappen, falls
     zu, und das Element dort zeigen — Aufgabe, Ergebnis, Rolle im Fokus;
     Modul, Phase, Szenario als Umfang. */
  function imGraphZeigen(e) {
    if (!graph) { return; }
    zustand.gehalten = true;
    aktivSetzen(e);
    if (!zustand.graphOffen) { teilungSetzen('halb'); }
    graphFolgen(e, true);
  }

  function breitSetzen(nurAbb) {
    if (zustand.nurAbb === nurAbb) { return; }
    zustand.nurAbb = nurAbb;
    werkzeugAktualisieren();
    zoomPassendSpaeter(40);
  }

  function modusSetzen(modus) {
    if (zustand.modus === modus) { return; }
    zustand.modus = modus;
    zustand.panel = false;
    panelZeichnen();

    if (modus === 'abfragen') {
      rundeStarten();
    } else {
      zustand.runde = null;
      zustand.aktiv = null;
      zustand.gehalten = false;
      (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });
      promptZeichnen();
      inhaltZeichnen();
      malen();
    }
    werkzeugAktualisieren();
    bildZeichnen();
  }

  /* Umschalter zwischen den beiden Gesamtbildern: zwei Knöpfe als Radiogruppe
     — die Originalgrafik des Referenzhandbuchs und der Nachbau, der
     Projektsteuerung und Projektführung trennt und alle Ergebnisse zeigt. */
  var SICHTEN = [
    { sicht: 'original', text: 'Original', titel: 'Abbildung 1 des Referenzhandbuchs, unverändert' },
    { sicht: 'nachbau', text: 'Nachbau', titel: 'Dasselbe Bild nachgebaut: Projektsteuerung und Projektführung getrennt, alle Ergebnisse, Meilensteine mit Namen' }
  ];

  function sichtBauen() {
    refs.sichtKnoepfe = SICHTEN.map(function (s) {
      return werkzeugKnopf(s.text, 'ub-sicht__knopf', function () { sichtSetzen(s.sicht); }, {
        role: 'radio', 'aria-checked': zustand.sicht === s.sicht ? 'true' : 'false',
        title: s.titel, 'data-sicht': s.sicht
      });
    });
    return h('div', { class: 'ub-sicht', role: 'radiogroup', 'aria-label': 'Sicht auf das Gesamtbild' }, refs.sichtKnoepfe);
  }

  function schweberBauen() {
    refs.zoomWert = h('span', {
      class: 'ub-zoom__wert', role: 'status',
      text: Math.round(zustand.zoom * 100) + ' %'
    });

    refs.knopfPanel = ikonKnopf('Steuerung', IKONE_STEUERUNG, function () { panelSchalten(); },
      { 'aria-expanded': 'false', 'aria-haspopup': 'dialog' });
    /* «Details» gilt nur für das nachgebaute Bild und steht nur dort. */
    refs.knopfDetails = werkzeugKnopf('Details', 'ub-schweber__knopf', function () { detailsSetzen(!zustand.details); },
      { 'aria-pressed': zustand.details ? 'true' : 'false', title: 'Beteiligte Rollen und Kurzdefinitionen im Bild zeigen' });

    return [
      h('div', { class: 'ub-schweber ub-schweber--steuerung' }, [
        h('span', { class: 'ub-schweber__sicht' }, [sichtBauen(), werkzeugTrenner()]),
        h('span', { class: 'ub-schweber__nachbau' }, [refs.knopfDetails, werkzeugTrenner()]),
        refs.knopfPanel
      ]),
      h('div', { class: 'ub-schweber ub-schweber--zoom', role: 'group', 'aria-label': 'Zoom' }, [
        werkzeugKnopf('−', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom / ZOOM_SCHRITT); },
          { 'aria-label': 'Verkleinern' }),
        refs.zoomWert,
        werkzeugKnopf('+', 'ub-zoom__knopf', function () { zoomSetzen(zustand.zoom * ZOOM_SCHRITT); },
          { 'aria-label': 'Vergrössern' }),
        werkzeugTrenner(),
        werkzeugKnopf('Passend', 'ub-schweber__knopf', zoomPassend,
          { title: 'Abbildung auf die Breite der Bühne bringen' })
      ]
    )];
  }

  /* --- Steuerung (Überlagerung) -------------------------------------------- */

  function panelSchalten() {
    zustand.panel = !zustand.panel;
    panelZeichnen();
    werkzeugAktualisieren();
    if (zustand.panel && refs.panelErstes) { refs.panelErstes.focus(); }
  }

  function panelSchliessen(zurueck) {
    if (!zustand.panel) { return; }
    zustand.panel = false;
    panelZeichnen();
    werkzeugAktualisieren();
    if (zurueck && refs.knopfPanel) { refs.knopfPanel.focus(); }
  }

  function rollenZahlen() {
    var verantwortet = 0, beteiligt = 0;
    (refs.felder || []).forEach(function (f) {
      var bezug = rollenBezug(f.eintraege[0]);
      if (bezug === 'verantwortlich') { verantwortet++; }
      if (bezug === 'beteiligt') { beteiligt++; }
    });
    return { verantwortet: verantwortet, beteiligt: beteiligt };
  }

  /* Der Modus steht als erster Block in der Steuerung — als Segment aus zwei
     Knöpfen, wie vorher als Tabs auf der Bühne. */
  function panelModus() {
    var erkunden = zustand.modus === 'erkunden';
    var tabErkunden = werkzeugKnopf('Erkunden', 'ub-tab', function () { modusSetzen('erkunden'); },
      { 'aria-pressed': erkunden ? 'true' : 'false' });
    var tabAbfragen = werkzeugKnopf('Abfragen', 'ub-tab', function () { modusSetzen('abfragen'); },
      { 'aria-pressed': erkunden ? 'false' : 'true' });
    refs.panelErstes = erkunden ? tabErkunden : tabAbfragen;
    return h('div', { class: 'ub-panel__block' }, [
      h('div', { class: 'ub-panel__label', text: 'Modus' }),
      h('div', { class: 'ub-segment', role: 'group', 'aria-label': 'Modus' }, [tabErkunden, tabAbfragen]),
      h('p', { class: 'ub-panel__hilfe ub-panel__hilfe--allein', text: erkunden
        ? 'Zeigen füllt die Inhaltsseite, Klick hält den Eintrag fest.'
        : 'Die Ergebniskästen sind verdeckt; gesucht wird ihr Ort in der Abbildung.' })
    ]);
  }

  /* Die Inhaltsseite einklappen («Breit») — gestapelt unter 700 px gibt es
     keine Spalte, die sich einklappen liesse; die Zeile ist dann ausgeblendet. */
  function panelBreit() {
    var haken = h('input', { type: 'checkbox', class: 'ub-haken' });
    haken.checked = zustand.nurAbb;
    haken.addEventListener('change', function () { breitSetzen(haken.checked); });
    return h('label', { class: 'ub-panel__haken ub-panel__nurbreit' }, [
      haken,
      h('span', {}, [
        'Inhaltsseite einklappen',
        h('span', { class: 'ub-panel__hilfe', text: 'Nur die Abbildung, über die ganze Breite.' })
      ])
    ]);
  }

  function panelErkunden() {
    var auswahl = h('select', { class: 'ub-select', id: 'ub-rolle' },
      [h('option', { value: '', text: '— keine —' })].concat(
        HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie('rolle')).map(function (r) {
          return h('option', { value: r.begriff, text: r.begriff });
        })
      ));
    auswahl.value = zustand.rolle;

    var zahl = h('p', { class: 'ub-panel__zahl' });
    function zahlSchreiben() {
      var z = rollenZahlen();
      zahl.textContent = zustand.rolle
        ? (z.verantwortet + ' verantwortet · ' + z.beteiligt + ' beteiligt')
        : '';
    }
    zahlSchreiben();

    auswahl.addEventListener('change', function () {
      var r = auswahl.value ? HT.daten.eintragMitBegriff(auswahl.value, 'rolle') : null;
      if (r) { suchtrefferAnwenden(r); } else { rolleLoesen(); }
    });

    var haken = h('input', { type: 'checkbox', class: 'ub-haken' });
    haken.checked = zustand.nurMinimal;
    haken.addEventListener('change', function () {
      zustand.nurMinimal = haken.checked;
      malen();
    });

    return [
      panelModus(),
      h('div', { class: 'ub-panel__block' }, [
        h('label', { class: 'ub-panel__label', for: 'ub-rolle', text: 'Rolle einfärben' }),
        auswahl,
        h('div', { class: 'ub-panel__legende' }, [
          h('span', {}, [h('span', { class: 'ub-swatch ub-swatch--voll', 'aria-hidden': 'true' }), 'verantwortlich']),
          h('span', {}, [h('span', { class: 'ub-swatch ub-swatch--rand', 'aria-hidden': 'true' }), 'beteiligt'])
        ]),
        zahl
      ]),
      h('div', { class: 'ub-panel__block' }, [
        h('div', { class: 'ub-panel__label', text: 'Darstellung' }),
        h('label', { class: 'ub-panel__haken' }, [
          haken,
          h('span', {}, [
            'Nur minimal geforderte Dokumente',
            h('span', { class: 'ub-panel__hilfe', text:
              'Blasst ab, was das Referenzhandbuch nicht als minimal gefordert führt.' })
          ])
        ]),
        panelBreit()
      ])
    ];
  }

  function panelAbfragen() {
    var schwach = Object.keys(zustand.fehler).map(function (k) {
      return { begriff: k, zahl: zustand.fehler[k] };
    }).sort(function (a, b) { return b.zahl - a.zahl; }).slice(0, 8);

    var neu = h('button', { type: 'button', class: 'ub-textknopf', text: 'Neue Runde' });
    neu.addEventListener('click', function () {
      panelSchliessen(false);
      rundeStarten();
    });

    var koerper = schwach.length
      ? h('ul', { class: 'ub-schwach' }, schwach.map(function (s) {
        return h('li', {}, [
          h('span', { class: 'ub-schwach__begriff', text: s.begriff }),
          h('span', { class: 'ub-schwach__zahl', text: s.zahl + '×' })
        ]);
      }))
      : h('p', { class: 'ub-panel__hilfe ub-panel__hilfe--allein', text:
        'Noch keine Fehler erfasst. Was hier landet, kommt in späteren Runden häufiger.' });

    return [
      panelModus(),
      h('div', { class: 'ub-panel__block' }, [
        h('div', { class: 'ub-panel__kopf' }, [
          h('span', { class: 'ub-panel__label', text: 'Schwachstellen' }),
          neu
        ]),
        koerper
      ]),
      h('div', { class: 'ub-panel__block ub-panel__block--nurbreit' }, [
        h('div', { class: 'ub-panel__label', text: 'Darstellung' }),
        panelBreit()
      ])
    ];
  }

  function panelZeichnen() {
    if (!refs.panelHuelle) { return; }
    HT.ui.leeren(refs.panelHuelle);
    refs.panelErstes = null;
    if (!zustand.panel) { return; }

    var faenger = h('div', { class: 'ub-panel__faenger' });
    faenger.addEventListener('mousedown', function () { panelSchliessen(true); });

    var panel = h('div', {
      class: 'ub-panel', role: 'dialog', 'aria-label': 'Steuerung'
    }, zustand.modus === 'erkunden' ? panelErkunden() : panelAbfragen());

    panel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); panelSchliessen(true); }
    });

    refs.panelHuelle.appendChild(faenger);
    refs.panelHuelle.appendChild(panel);
  }

  /* --- Abfragen ------------------------------------------------------------ */

  /* Jeder Begriff kommt einmal in den Topf, dazu bis zu drei weitere Lose je
     erfasstem Fehler. Nach dem Mischen bleibt der erste Treffer stehen —
     Schwachstellen rutschen so nach vorne, ohne die Runde zu füllen. */
  function kandidaten() {
    var topf = [];
    (refs.felder || []).forEach(function (f) {
      if (f.art !== 'ergebnis') { return; }
      var e = f.eintraege[0];
      topf.push(e);
      var fehl = zustand.fehler[e.begriff];
      if (fehl) {
        for (var i = 0; i < Math.min(3, fehl); i++) { topf.push(e); }
      }
    });

    var gesehen = {};
    return HT.ui.mischen(topf).filter(function (e) {
      if (gesehen[e.id]) { return false; }
      gesehen[e.id] = true;
      return true;
    });
  }

  function rundeStarten() {
    var aufgaben = kandidaten().slice(0, RUNDEN_LAENGE);
    (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });

    zustand.runde = { aufgaben: aufgaben, i: 0, phase: 'frage', falschesFeld: null };
    zustand.punkte = 0;
    zustand.versuche = 0;
    zustand.serie = 0;
    zustand.aktiv = null;
    zustand.gehalten = false;

    promptZeichnen();
    inhaltZeichnen();
    malen();
  }

  function antworten(feld) {
    var runde = zustand.runde;
    if (!runde || runde.phase !== 'frage') { return; }
    if (feld.art !== 'ergebnis') { return; }

    var gesucht = runde.aufgaben[runde.i];
    if (!gesucht) { return; }
    var richtig = istGleich(feld, gesucht);

    if (richtig) {
      zustand.serie += 1;
      zustand.besteSerie = Math.max(zustand.besteSerie, zustand.serie);
      zustand.punkte += 1;
    } else {
      zustand.serie = 0;
      zustand.fehler[gesucht.begriff] = (zustand.fehler[gesucht.begriff] || 0) + 1;
      feld.aufgedeckt = true;
    }
    zustand.versuche += 1;

    (refs.felder || []).forEach(function (f) {
      if (istGleich(f, gesucht)) { f.aufgedeckt = true; }
    });

    runde.phase = richtig ? 'richtig' : 'falsch';
    runde.falschesFeld = richtig ? null : feld;
    zustand.gehalten = true;
    zustand.aktiv = gesucht;

    speichern();
    promptZeichnen();
    inhaltZeichnen();
    malen();
    inhaltInSichtBringen();
  }

  function weiter() {
    var runde = zustand.runde;
    if (!runde) { return; }
    var naechste = runde.i + 1;

    if (naechste >= runde.aufgaben.length) {
      runde.phase = 'ende';
      runde.falschesFeld = null;
      promptZeichnen();
      malen();
      return;
    }

    (refs.felder || []).forEach(function (f) { f.aufgedeckt = false; });
    runde.i = naechste;
    runde.phase = 'frage';
    runde.falschesFeld = null;
    zustand.aktiv = null;
    zustand.gehalten = false;

    promptZeichnen();
    inhaltZeichnen();
    malen();
  }

  function ikone(kat, groesse, klasse) {
    var svg = HT.ui.katSymbol(kat, groesse);
    if (klasse) { svg.setAttribute('class', svg.getAttribute('class') + ' ' + klasse); }
    return svg;
  }

  function ikoneFuer(e) {
    if (e.kategorie === 'ergebnis' && e.typ === 'Meilenstein') { return 'meilenstein'; }
    return e.kategorie;
  }

  function promptZeichnen() {
    if (!refs.prompt) { return; }
    HT.ui.leeren(refs.prompt);

    var runde = zustand.runde;
    if (zustand.modus !== 'abfragen' || !runde) {
      refs.prompt.hidden = true;
      return;
    }
    refs.prompt.hidden = false;
    refs.prompt.dataset.phase = runde.phase;

    var gesucht = runde.aufgaben[runde.i];
    var kicker, titel, hinweis, status = '';

    if (runde.phase === 'ende') {
      kicker = 'Runde beendet';
      titel = zustand.punkte + ' von ' + runde.aufgaben.length + ' getroffen';
      hinweis = 'Die Schwachstellen links kommen in der nächsten Runde häufiger.';
    } else {
      kicker = 'Aufgabe ' + (runde.i + 1) + ' von ' + runde.aufgaben.length;
      titel = gesucht ? gesucht.begriff : '';
      if (runde.phase === 'frage') {
        hinweis = 'Wo steht dieses Ergebnis? Kasten in der Abbildung anklicken.';
      } else if (runde.phase === 'richtig') {
        status = 'Richtig';
        hinweis = 'Der Kasten ist markiert; rechts steht der ganze Eintrag.';
      } else {
        status = 'Daneben';
        hinweis = 'Der gesuchte Kasten ist rot markiert.';
      }
    }

    var zahl = function (wert, label) {
      return h('span', {}, [h('strong', { text: String(wert) }), ' ' + label]);
    };

    refs.prompt.appendChild(h('div', { class: 'ub-prompt__kopf' }, [
      h('span', { class: 'ub-prompt__kicker', text: kicker }),
      status ? h('span', { class: 'ub-prompt__status', role: 'status', text: status }) : null
    ]));

    refs.prompt.appendChild(h('div', { class: 'ub-prompt__zeile' }, [
      h('span', { class: 'ub-prompt__ziel' }, [
        runde.phase === 'ende' ? null : ikone(
          gesucht && gesucht.typ === 'Meilenstein' ? 'meilenstein' : 'ergebnis', 22, 'ub-ikone--prompt'),
        h('strong', { class: 'ub-prompt__titel', text: titel })
      ]),
      h('span', { class: 'ub-prompt__hinweis', text: hinweis }),
      h('span', { class: 'ub-prompt__zahlen' }, [
        zahl(zustand.punkte, 'richtig'),
        zahl(zustand.versuche ? HT.ui.prozent(zustand.punkte, zustand.versuche) + ' %' : '—', 'Quote'),
        zahl(zustand.serie, 'Serie'),
        h('span', { text: 'Beste ' + zustand.besteSerie })
      ])
    ]));

    if (runde.phase === 'richtig' || runde.phase === 'falsch') {
      var knopf = h('button', { type: 'button', class: 'ub-primaer', text: 'Weiter' });
      knopf.addEventListener('click', weiter);
      refs.prompt.appendChild(knopf);
      knopf.focus();
    } else if (runde.phase === 'ende') {
      /* Am Rundenende ist die nächste Handlung eine neue Runde; sie liegt sonst
         nur in der Steuerung. */
      var neu = h('button', { type: 'button', class: 'ub-primaer', text: 'Neue Runde' });
      neu.addEventListener('click', rundeStarten);
      refs.prompt.appendChild(neu);
      neu.focus();
    }
  }

  /* --- Inhaltsseite -------------------------------------------------------- */

  var TYP_KICKER = { Dokument: 'Dokument', Zustand: 'Zustand', Checkliste: 'Checkliste', Meilenstein: 'Meilenstein' };

  function kickerVon(e) {
    if (e.kategorie === 'ergebnis') { return TYP_KICKER[e.typ] || 'Ergebnis'; }
    var meta = HT.daten.kategorieMeta ? HT.daten.kategorieMeta(e.kategorie) : null;
    return meta ? meta.singular : e.kategorie;
  }

  function markerVon(e) {
    if (e.kategorie === 'ergebnis' && e.minimalGefordert) { return 'Minimal gefordert'; }
    if (e.kategorie === 'modul' && HT.karte.ZWINGENDE_MODULE.indexOf(e.begriff) !== -1) {
      return 'Zwingend in jedem Projekt';
    }
    return '';
  }

  /* Siegel in der Akzentfarbe statt Wortmarke; der Wortlaut («Minimal
     gefordert», «Zwingend in jedem Projekt») steht im Tooltip und für den
     Screenreader. */
  function markerIkone(text) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 10 }));
    svg.appendChild(svgEl('path', { d: 'M7.6 12.4l2.9 2.9 5.9-6.2' }));
    return h('span', { class: 'ub-marker', role: 'img', title: text, 'aria-label': text }, svg);
  }

  var IKONE_DOWNLOAD = ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M4.5 19.5h15'];

  /* Der erste Vorlagenverweis (.dotx) aus dem Handbuchtext — auf der
     Quellseite ein eigener Abschnitt, hier ein Download-Icon im Kopf. */
  function vorlageVon(text) {
    var abschnitte = text && text.abschnitte ? text.abschnitte : [];
    for (var i = 0; i < abschnitte.length; i++) {
      var bs = abschnitte[i].bloecke || [];
      for (var j = 0; j < bs.length; j++) {
        if (bs[j].t === 'download' && bs[j].url) { return bs[j]; }
      }
    }
    return null;
  }

  function vorlageIkone(block) {
    var meta = [block.datei, block.groesse].filter(Boolean).join(' · ');
    var titel = 'Dokumentvorlage herunterladen' + (meta ? ' (' + meta + ')' : '');
    return h('a', {
      class: 'ub-kopf__vorlage',
      href: block.url,
      target: '_blank',
      rel: 'noopener',
      download: block.datei || true,
      title: titel,
      'aria-label': titel
    }, HT.ui.symbol(IKONE_DOWNLOAD, 20));
  }

  function abschnitt(titel, kinder, klasse) {
    return h('section', { class: 'ub-abschnitt' + (klasse ? ' ' + klasse : '') }, [
      h('h3', { class: 'ub-mikro', text: titel })
    ].concat(kinder));
  }

  /* --- Handbuchabschnitte --------------------------------------------------- */

  function hbAbschnitt(text, titel) {
    if (!text || !text.abschnitte) { return null; }
    for (var i = 0; i < text.abschnitte.length; i++) {
      if ((text.abschnitte[i].titel || '').trim().toLowerCase() === titel.toLowerCase()) {
        return text.abschnitte[i];
      }
    }
    return null;
  }

  function absaetze(a) {
    return a ? a.bloecke.filter(function (b) { return b.t === 'p'; }) : [];
  }

  /* Quelle des Leads: der Abschnitt «Beschreibung», sonst der erste Absatzblock
     des ersten Abschnitts (Phasenseiten tragen keine Zwischentitel). Die
     verwendeten Blöcke werden mitgegeben, damit sie unten nicht ein zweites
     Mal erscheinen. Der Lead zeigt alle Absätze, nicht nur den ersten Satz —
     diese Seite hat keine Stufen, an denen mehr nachkäme. */
  function leadQuelle(text) {
    var a = hbAbschnitt(text, 'Beschreibung');
    if (a) { return { abschnitt: a, bloecke: absaetze(a) }; }
    var erster = text && text.abschnitte && text.abschnitte[0];
    if (!erster) { return { abschnitt: null, bloecke: [] }; }
    var raus = [];
    for (var i = 0; i < erster.bloecke.length; i++) {
      if (erster.bloecke[i].t === 'p') { raus.push(erster.bloecke[i]); }
      else if (raus.length) { break; }
    }
    return { abschnitt: null, bloecke: raus };
  }

  function leadBauen(e, lead) {
    if (lead.bloecke.length) {
      return lead.bloecke.map(function (b) { return h('p', { text: b.text }); });
    }
    var ersatz = e.definition || e.kurz || '';
    return ersatz ? [h('p', { text: ersatz })] : [];
  }

  function leerseite() {
    return h('div', { class: 'ub-leerseite' }, [
      h('h2', { class: 'ub-leerseite__titel', text: 'Noch nichts ausgewählt' }),
      /* Schmal (gestapelt, meist ohne Maus) gilt der zweite Satz. */
      h('p', { class: 'ub-leerseite__text' }, [
        h('span', { class: 'ub-leerseite__breit', text:
          'Zeigen auf einen Ergebniskasten, einen Modulkopf oder einen Phasenbalken füllt '
          + 'diese Seite. Ein Klick hält den Eintrag fest, die Trennlinie links lässt sich ziehen.' }),
        h('span', { class: 'ub-leerseite__schmal', text:
          'Antippen eines Ergebniskastens, eines Modulkopfs oder eines Phasenbalkens zeigt den Eintrag hier.' })
      ]),
      h('h3', { class: 'ub-mikro ub-mikro--legende', text: 'Die Elemente der Methode' }),
      h('ul', { class: 'ub-legende' }, LEGENDE.map(function (l) {
        return h('li', {}, [ikone(l.kat, 20, 'ub-ikone--legende'), h('span', { text: l.text })]);
      }))
    ]);
  }

  /* Handbuchtexte je Eintrag, sobald geladen (null = keiner vorhanden). Die
     Kategoriedatei holt HT.daten einmalig; danach löst das Versprechen sofort
     auf und das Nachzeichnen ist nicht sichtbar. */
  var hbTexte = {};

  function handbuchHolen(e) {
    if (Object.prototype.hasOwnProperty.call(hbTexte, e.id)) { return; }
    hbTexte[e.id] = null;                       // nicht zweimal anfragen
    var id = e.id;
    HT.daten.handbuchElement(e).then(function (t) {
      hbTexte[id] = t || null;
      if (t && zustand.aktiv && zustand.aktiv.id === id) { inhaltZeichnen(); }
    }).catch(function () { /* Fallback bleibt «Aus der Dokumentation» */ });
  }

  function lexikonZiel(x) {
    return '#/handbuch?id=' + encodeURIComponent(x.id);
  }

  function inhaltZeichnen() {
    if (!refs.inhalt) { return; }
    var vorher = refs.inhalt.scrollTop;
    HT.ui.leeren(refs.inhalt);

    var e = zustand.aktiv;
    if (e) {
      /* Ort für Markierungen — derselbe wie die Karte im Handbuch, damit eine
         Markierung hier auch dort erscheint. */
      refs.inhalt.dataset.markOrt = '#/handbuch?id=' + encodeURIComponent(e.id);
    } else {
      delete refs.inhalt.dataset.markOrt;
    }
    if (!e) {
      refs.inhalt.appendChild(leerseite());
      refs.inhalt.scrollTop = 0;
      zustand.gezeichnet = null;
      return;
    }

    handbuchHolen(e);
    var text = hbTexte[e.id] || null;
    var lead = leadQuelle(text);
    var marker = markerVon(e);
    var vorlage = vorlageVon(text);

    refs.inhalt.appendChild(h('article', { class: 'ub-kopf' }, [
      h('div', { class: 'ub-kopf__zeile' }, [
        ikone(ikoneFuer(e), 24, 'ub-ikone--kopf'),
        h('span', { class: 'ub-kopf__kicker', text: kickerVon(e) }),
        (marker || vorlage) ? h('span', { class: 'ub-kopf__zeichen' }, [
          marker ? markerIkone(marker) : null,
          vorlage ? vorlageIkone(vorlage) : null
        ]) : null
      ]),
      h('h2', { class: 'ub-kopf__titel', text: e.begriff }),
      h('div', { class: 'ub-kopf__lead' }, leadBauen(e, lead))
    ]));

    /* Kein Steckbrief: Ergebnistyp, «minimal gefordert» und die Dokument-
       vorlage stehen als Kicker und Zeichen im Kopf, alles andere zeigt das
       Beziehungsbild unten. */

    /* Die übrigen Abschnitte der Quellseite in ihrer Reihenfolge — «Inhalt»
       und «Beziehungen» also genau so, wie sie auf hermes.admin.ch stehen.
       Der Vorlagenverweis hängt als Icon im Kopf; bleibt vom Abschnitt
       «Dokumentenvorlage» sonst nichts übrig, entfällt er. Das Bild der
       Beziehungen ist die Graph-Sicht der Bühne («Im Graph»). */
    (text && text.abschnitte ? text.abschnitte : []).forEach(function (a) {
      if (a === lead.abschnitt) { return; }                     // steht im Lead
      var titel = (a.titel || '').trim();
      var bs = (a.bloecke || []).filter(function (b) {
        return lead.bloecke.indexOf(b) === -1 && b.t !== 'download';
      });
      if (!bs.length) { return; }
      refs.inhalt.appendChild(abschnitt(titel || 'Aus dem Handbuch',
        [HT.ui.bloecke(bs, { verlinken: false, ebene: 4 })], 'ub-abschnitt--regel'));
    });

    /* Ohne Handbuchtext bleibt die kuratierte Fassung die einzige Quelle. */
    if (!text && e.details) {
      refs.inhalt.appendChild(abschnitt('Aus der Dokumentation', [
        h('p', { class: 'ub-doku', text: e.details })
      ], 'ub-abschnitt--regel'));
    }

    /* «Im Graph»: die Graph-Sicht der Bühne zeigt das Element mit allem,
       was direkt daran hängt — in der Graph-Sicht selbst überflüssig. */
    refs.inhalt.appendChild(h('section', { class: 'ub-verweise' }, [
      h('button', {
        type: 'button', class: 'ub-verweis ub-verweis--knopf', text: 'Im Graph',
        on: { click: function () { imGraphZeigen(e); } }
      }),
      h('a', { class: 'ub-verweis', href: '#/handbuch?id=' + encodeURIComponent(e.id), text: 'Im Handbuch' }),
      h('a', {
        class: 'ub-verweis ub-verweis--akzent',
        href: (e.quelle && e.quelle.url) || QUELLE_ALLGEMEIN,
        target: '_blank', rel: 'noopener',
        text: 'Offizielle Seite ↗'
      })
    ]));

    /* Nur beim Wechsel nach oben springen — das Nachzeichnen mit dem
       Handbuchtext darf die Leseposition nicht verlieren. */
    if (zustand.gezeichnet !== e.id) {
      refs.inhalt.scrollTop = 0;
      zustand.gezeichnet = e.id;
    } else {
      refs.inhalt.scrollTop = vorher;
    }
  }

  /* --- Legende zur Abbildung ----------------------------------------------- */

  /* Ein Musterzeichen im Format der Grafik: 26 × 14, dieselben Farben. */
  function zeichen(form) {
    var svg = svgEl('svg', {
      width: 26, height: 14, viewBox: '0 0 26 14',
      'class': 'ub-zeichen', 'aria-hidden': 'true', focusable: 'false'
    });
    var teile = {
      ergebnis: [['rect', { x: 2.5, y: 1.5, width: 21, height: 11, fill: FARBEN.ergebnis }]],
      zustand: [['rect', { x: 3, y: 2, width: 20, height: 10, rx: 4, fill: '#FFFFFF', stroke: FARBEN.ergebnisRand }]],
      modul: [['rect', { x: 3, y: 2, width: 20, height: 10, fill: 'none', stroke: FARBEN.modulRand }]],
      phase: [
        ['rect', { x: 4, y: 0, width: 8, height: 14, fill: FARBEN.phase[1] }],
        ['rect', { x: 14, y: 0, width: 8, height: 14, fill: FARBEN.phase[0] }]
      ],
      meilenstein: [
        ['path', { d: 'M0 7 H26', stroke: FARBEN.uebergang, 'stroke-dasharray': '4 3' }],
        ['path', { d: 'M13 2.5 L17.5 7 L13 11.5 L8.5 7 Z', fill: '#575757' }]
      ],
      iteration: [
        ['path', { d: 'M2 7 H18', stroke: FARBEN.iteration, 'stroke-dasharray': '3 3' }],
        ['path', { d: 'M17 3 L24 7 L17 11 Z', fill: FARBEN.iteration }]
      ]
    }[form] || [];
    teile.forEach(function (t) { svg.appendChild(svgEl(t[0], t[1])); });
    return svg;
  }

  function abbLegendeListe() {
    return h('ul', { class: 'ub-abblegende__liste' }, ABB_LEGENDE.map(function (l) {
      return h('li', {}, [zeichen(l.form), h('span', { text: l.text })]);
    }));
  }

  /* Am Schirm stehen die Zeichen in der Karte hinter dem Info-Icon der Leiste
     (infoInhalt); diese Fassung erscheint nur im Druck, unter der Abbildung. */
  function abbLegendeBauen() {
    refs.abblegende = h('div', { class: 'ub-abblegende', hidden: true }, [
      h('span', { class: 'ub-abblegende__titel', text: 'Zeichen der Abbildung' }),
      abbLegendeListe()
    ]);
    return refs.abblegende;
  }

  /* --- Aufbau -------------------------------------------------------------- */

  var graphParams = null;

  /* Die Karte hinter dem Info-Icon der Leiste: was die Seite zeigt und woher
     Grafik, Texte und Verbindungen kommen. */
  var rhbQuelle = null;
  function infoInhalt() {
    var links = [];
    if (rhbQuelle && rhbQuelle.pdf) {
      links.push(h('a', { class: 'hb-online', href: rhbQuelle.pdf, target: '_blank', rel: 'noopener', text: 'Referenzhandbuch (PDF) ↗' }));
    }
    links.push(h('a', { class: 'hb-online', href: QUELLE_ALLGEMEIN, target: '_blank', rel: 'noopener', text: 'HERMES online ↗' }));
    return [
      h('p', { text: 'Oben das Gesamtbild der Methode, darunter der Graph mit Rollen, Aufgaben, Ergebnissen und ihren Verbindungen. Zeigen auf einen Kasten füllt die Inhaltsseite rechts (auf dem Telefon steht sie unter dem Graphen, dort genügt Antippen); ein Klick, auch auf einen Knoten im Graphen, hält das Element dort fest.' }),
      h('p', { text: 'Das Gesamtbild gibt es in zwei Sichten; der Schalter dafür steht oben rechts auf der Bühne. «Original» ist Abbildung 1 des Referenzhandbuchs, unverändert. «Nachbau» zeigt dasselbe aus den Daten neu gezeichnet und ergänzt drei Dinge, die der Originalgrafik fehlen: Projektsteuerung und Projektführung haben je eine eigene Spalte statt einer gemeinsamen; es stehen alle Ergebnisse da statt nur der wesentlichen (161 Kästen statt 81 — die Ergebnisse der Aufgabe «Projekt steuern» etwa fehlen im Original ganz); und die Meilensteine tragen links an der Phasenleiste ihren Namen statt nur eine Raute.' }),
      h('p', { text: 'Wie im Original stehen die Phasen links und die Module oben in den Spalten. Projektsteuerung und Projektführung erzeugen in Konzept, Realisierung und Einführung dasselbe — diese Felder sind darum wie im Original zu einem Block «phasenunabhängig» zusammengefasst. Was darin nicht in jeder der drei Phasen entsteht, nennt seine Phasen als kleine Marke.' }),
      h('p', { text: 'Vorn in der Leiste gehen ‹ und › die Methode Schritt für Schritt durch: nach dem Gesamtbild die Initialisierung, dann Konzept, Realisierung und Einführung je Modul (Projektsteuerung und Projektführung zusammen, wie in der Abbildung), zuletzt der Abschluss; agil steht an Stelle der drei Phasen die Umsetzung. Ein Klick auf den Titel zeigt alle Schritte, klassisch und agil.' }),
      h('p', { text: 'Auf einem Schritt steht oben statt des Gesamtbilds das Bild dieses Schritts: je Aufgabe links die verantwortliche Rolle, rechts die Ergebnisse, die sie dort erzeugt — wie im Zuordnen des Trainers, aber ausgefüllt. «Details» blendet die beteiligten Rollen und die Kurzdefinitionen ein. Zeigen und Klicken wirken wie in der Abbildung; der Abfragemodus spielt immer auf der Originalgrafik.' }),
      h('p', { text: 'Rechts neben den Schritten blenden Elemente und Verbindungen im Graphen ein und aus. Phasen, Szenarien und Module frei kombinieren lässt das Filter-Icon neben der Suche; auch eine solche Auswahl zeigt oben das nachgebaute Bild.' }),
      h('p', { text: 'Die Abbildung ist die Originalgrafik von hermes.admin.ch, die Texte der Inhaltsseite stammen aus dem Referenzhandbuch. Jede Verbindung im Graphen entspricht einem Querverweis der offiziellen Dokumentation; ergänzt wird nichts.' }),
      h('h3', { class: 'gpop__abschnitt', text: 'Zeichen der Abbildung' }),
      abbLegendeListe(),
      h('p', { class: 'hb-verweis' }, links)
    ];
  }

  function abbildungSeiteBauen() {
    refs.prompt = h('div', { class: 'ub-prompt', hidden: true });
    refs.panelHuelle = h('div', { class: 'ub-panel-huelle' });
    refs.buehne = h('div', { class: 'ub-buehne' }, [
      h('p', { class: 'ub-buehne__laden', text: 'Abbildung wird geladen' })
    ]);
    HT.ui.radZoomAnbinden(refs.buehne, function () { return refs.abb || null; }, buehneSkalieren);

    var warnung = HT.app.datenWarnung();

    /* Die Bühne hat zwei Bereiche untereinander: oben die Abbildung, unten
       der Graph (über HT.graphSicht eingebettet). Der Graph legt seine
       Popover in den gemeinsamen Rahmen, damit «Alle Filter» über beiden
       Bereichen aufgeht. */
    refs.sichten = h('div', { class: 'ub-sichten graph-wirt' });
    refs.bereiche = {};

    /* Oben die Hülle mit Icons, Steuerung und der Legende für den Druck (die Bühne darin
       scrollt — läge das Schwebende in der Bühne, scrollte es mit). */
    refs.bild = h('div', { class: 'ub-bild' });
    /* Das nachgebaute Gesamtbild scrollt wie die Abbildung und zoomt mit
       denselben Knöpfen; der Rahmen trägt die skalierten Masse. */
    refs.gesamtRahmen = h('div', { class: 'ub-gesamt__rahmen' });
    refs.gesamt = h('div', { class: 'ub-gesamt' }, [refs.gesamtRahmen]);
    HT.ui.radZoomAnbinden(refs.gesamt, function () {
      return refs.gesamtRahmen && refs.gesamtRahmen.firstChild ? refs.gesamtRahmen : null;
    }, buehneSkalieren);
    bildUmfang = null;
    bildDetails = null;
    gesamtVorgehen = null;
    refs.buehneHuelle = h('div', { class: 'ub-buehne-huelle', dataset: { bild: 'original' } },
      [refs.buehne, refs.bild, refs.gesamt].concat(schweberBauen(), [abbLegendeBauen(), refs.panelHuelle]));
    var bereichAbb = h('section', { class: 'ub-bereich ub-bereich--abbildung', 'aria-label': 'Abbildung' }, [refs.buehneHuelle]);
    refs.bereiche.abbildung = bereichAbb;

    /* Dazwischen die Linie mit der Pille; rechts darauf die Chips des Umfangs
       und der Chip des im Graphen gewählten Elements — gleiches «×» für beide. */
    refs.suchChips = h('div', { class: 'gumfang ub-auswahlchips', role: 'group', 'aria-label': 'Auswahl' });
    refs.suchChips.hidden = true;
    refs.graphChips = h('div', { class: 'gumfang ub-auswahlchips', role: 'group', 'aria-label': 'Auswahl im Graph' });
    refs.graphChips.hidden = true;
    var teilung = teilungBauen(h('div', { class: 'ub-teilung__chips' }, [refs.suchChips, refs.graphChips]));

    /* Unten der Graph. */
    var bereichGraph = h('section', { class: 'ub-bereich ub-bereich--graph', 'aria-label': 'Graph' });
    refs.bereiche.graph = bereichGraph;
    graph = HT.graphSicht.einbetten(bereichGraph, {
      params: graphParams,
      popEltern: refs.sichten,
      filterBeimGastgeber: true,
      auswahlBeimGastgeber: true,
      ohneUmfangLeiste: true,
      sichtbar: function () { return zustand.graphOffen && !!refs.werkbank && document.body.contains(refs.werkbank); },
      beiAuswahl: function (e) {
        /* Der Graph hat ein Element gewählt (oder die Auswahl aufgehoben):
           die Inhaltsseite folgt, der Kasten in der Abbildung wird
           festgehalten und in Sicht gerollt; eine Rolle färbt die Abbildung. */
        var neu = !!e && !(zustand.aktiv && zustand.aktiv.id === e.id);
        zustand.gehalten = !!e;
        aktivSetzen(e);
        rolleSetzen(e && e.kategorie === 'rolle' ? e.begriff : '');
        malen();
        if (neu) { feldInSichtBringen(e); }
        if (e) { inhaltInSichtBringen(); }
      },
      beiZustand: function () {
        umfangAbgleichen();
        bildZeichnen();
        schritteAktualisieren();
        malen();
        werkzeugAktualisieren();
        suchChipsZeichnen();
        graphChipsZeichnen();
        urlSetzen();
      }
    });

    /* Der Filter gilt für Abbildung und Graph; sein einziger Knopf steht in
       der Kopfzeile rechts neben der Suche. */
    HT.app.kopfWerkzeug(graph.filterKnopf());
    /* In der Leiste unter der Kopfzeile vorn die Schritte, dahinter quer die
       Auswahl des Graphen (Elemente, Verbindungen), rechts das Info-Icon zur
       Seite. Phasen, Szenarien und Module stehen in «Alle Filter». */
    HT.app.unterleiste({
      label: 'Schritte und Auswahl für Abbildung und Graph',
      inhalt: [schritteBauen(), h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }), graph.auswahlLeiste()],
      info: { inhalt: infoInhalt, bereit: HT.daten.rhbIndex().then(function (idx) { if (idx && idx.quelle) { rhbQuelle = idx.quelle; } }) }
    });
    graph.popAnmelden('schritte', {
      titel: 'Schritte durch die Methode', inhalt: schritteInhalt, knopf: refs.schrittTitel, links: true, mittel: true
    });
    schritteAktualisieren();

    refs.sichten.appendChild(bereichAbb);
    refs.sichten.appendChild(teilung);
    refs.sichten.appendChild(bereichGraph);
    bereicheAnwenden();

    return h('section', { class: 'ub-seite' }, [
      warnung || null,
      refs.prompt,
      refs.sichten
    ]);
  }

  function trennerBauen() {
    var trenner = h('div', {
      class: 'ub-trenner',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Breite der Inhaltsseite',
      tabindex: '0',
      title: 'Ziehen ändert die Breite · Doppelklick setzt zurück'
    }, [h('span', { class: 'ub-trenner__strich', 'aria-hidden': 'true' })]);

    trenner.addEventListener('mousedown', ziehenStarten);
    trenner.addEventListener('keydown', trennerTaste);
    trenner.addEventListener('dblclick', function () {
      inhaltBreiteSetzen(INHALT_STANDARD);
      zoomPassendSpaeter(40);
    });
    return trenner;
  }

  function groesseAnmelden() {
    if (groesseAngemeldet) { return; }
    groesseAngemeldet = true;
    global.addEventListener('resize', function () {
      if (!refs.buehne || !document.body.contains(refs.buehne)) { return; }
      inhaltBreiteSetzen(zustand.inhaltBreite);
      zoomPassendSpaeter(60);
    });
  }

  function werkbankRendern(behaelter) {
    refs.felder = [];

    refs.inhalt = h('div', { class: 'ub-inhalt__text' });
    refs.seite = h('aside', { class: 'ub-inhalt', 'aria-label': 'Inhaltsseite zum gewählten Element' }, [refs.inhalt]);

    refs.werkbank = h('div', { class: 'ub-werkbank' }, [
      h('h1', { class: 'nur-sr', text: 'Methodenüberblick' }),
      abbildungSeiteBauen(),
      trennerBauen(),
      refs.seite
    ]);

    behaelter.appendChild(refs.werkbank);

    werkzeugAktualisieren();
    /* Erst jetzt steht der Graph — und damit die Vorgehensweise, die das
       nachgebaute Gesamtbild braucht. */
    bildZeichnen();
    inhaltBreiteSetzen(zustand.inhaltBreite);
    inhaltZeichnen();
    panelZeichnen();
    promptZeichnen();
    suchChipsZeichnen();
    groesseAnmelden();
    urlSetzen();

    /* Escape schliesst die Steuerung auch dann, wenn der Fokus ausserhalb liegt. */
    refs.werkbank.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && zustand.panel) { panelSchliessen(true); }
    });

    HT.abbildung.holen().then(function (text) {
      if (!document.body.contains(refs.buehne)) { return; }
      diagrammEinsetzen(HT.abbildung.lesen(text));
    }).catch(function (fehler) {
      if (!refs.buehne) { return; }
      HT.ui.leeren(refs.buehne);
      refs.buehne.appendChild(HT.ui.leerZustand(
        'Das Diagramm konnte nicht geladen werden',
        'Die Originalabbildung liegt in assets/abb/. Wird die Seite direkt aus dem Dateisystem geöffnet '
          + '(file://), blockiert der Browser das Lesen — dann hilft ein lokaler Webserver. '
          + 'Technische Meldung: ' + (fehler && fehler.message ? fehler.message : String(fehler))
      ));
    });
  }

  function render(behaelter, params) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    refs = { felder: [] };
    graph = null;
    params = params || {};

    /* Alte Links: ?sicht=graph — den Graphen jedenfalls aufklappen. */
    if (params.sicht === 'graph') { zustand.graphOffen = true; }

    /* ?id=: ein Element zeigen — Modul, Phase, Szenario als Umfang, alles
       andere festgehalten auf der Inhaltsseite und im Graphen im Fokus.
       Unbekannte Kennungen führen auf die leere Werkbank. */
    var gewuenscht = params.id ? HT.daten.eintragMitId(params.id) : null;
    var graphP = {};
    Object.keys(params).forEach(function (k) { if (k !== 'sicht' && k !== 'id') { graphP[k] = params[k]; } });
    if (gewuenscht) {
      var gruppe = gewuenscht.kategorie === 'modul' || gewuenscht.kategorie === 'phase' || gewuenscht.kategorie === 'szenario';
      if (gruppe) { graphP.id = params.id; } else { graphP.fokus = params.id; }
      zustand.gehalten = true;
      zustand.aktiv = gewuenscht;
      nachLadenZeigen = gruppe ? null : gewuenscht;
    } else if (params.fokus) {
      graphP.fokus = params.fokus;
    }
    graphParams = graphP;

    werkbankRendern(behaelter);
  }

  /* Die Suche in der Kopfzeile ruft hier an, solange der Überblick offen ist. */
  function suchtreffer(e) {
    if (!refs.werkbank || !document.body.contains(refs.werkbank)) { return false; }
    suchtrefferAnwenden(e);
    return true;
  }

  HT.views.ueberblick = {
    titel: 'Methodenüberblick',
    render: render,
    suchtreffer: suchtreffer
  };
}(window));
