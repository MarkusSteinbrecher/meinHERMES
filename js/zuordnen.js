/* meinHERMES — Trainer, Teil «Zuordnen»: Rollen, Aufgaben und Ergebnisse
   einander zuordnen.

   Jede Übung ist ein Ausschnitt der klassischen oder der agilen
   Vorgehensweise (Radioknöpfe vor «Leere Kästen»), nach Phasen gegliedert: eine Phase (eine Bahn, darin die Module als Unterbahnen), ein
   Modul (die Phasen als Bahnen) oder das Gesamtbild. Auswahl und Reihenfolge
   kommen aus js/graph-modell.js, die Knotenformen aus js/graph-zeichnen.js.
   Linien gibt es keine: je Aufgabe ein Block — links die verantwortliche
   Rolle, rechts untereinander die Ergebnisse, die sie erzeugt. Eine Aufgabe
   steht in jeder ihrer Phasen und darin unter jedem Modul, das sie dort hat
   (wie in der Abbildung 1), jeweils mit den Ergebnissen dieses Felds. Eine
   Rolle steht so vor jeder ihrer Aufgaben, ein Ergebnis bei jeder Aufgabe,
   die es erzeugt. Im Pool liegt jedes Element einmal, mit der Zahl seiner
   Kästen — eine Rolle mehrerer Aufgaben, eine Aufgabe mehrerer Phasen oder
   Module, ein Ergebnis mehrerer Aufgaben.

   Welche Elementarten leer sind, wählen drei Schalter (Rollen, Aufgaben,
   Ergebnisse); die übrigen stehen ausgefüllt als Anhaltspunkte im Bild.
   Sie stehen in der Leiste der Übung, wo man sie am Bild sieht, zusammen mit
   Vorgehensweise, Titel und Zähler. Die Übersicht hat in der Leiste nichts
   eigenes — dort wäre die Navigation je Übungsform anders lang —, ihre Wahl
   der Vorgehensweise steht oben auf der Seite; die Kästen zählt sie mit der
   zuletzt gewählten Einstellung.

   Geprüft wird die Zuordnung, nicht die Reihenfolge: Blöcke im selben Feld
   (Phase und Modul) mit gleich vielen Ergebniskästen sind vertauschbar, und
   innerhalb eines Blocks zählt nicht, in welchem Kasten ein Ergebnis liegt.
   Die Prüfung gibt jedem Block den gesuchten Block, der insgesamt die
   meisten Treffer ergibt; ausgefüllte Kästen müssen dazu passen.

   Adressen: #/trainer?phase=<Phase>, #/trainer?modul=<Modul>,
   #/trainer?alles=1 — je eine eigene Seite in voller Breite; agil mit
   &vorgehen=agil (ohne Angabe klassisch). Die Übersicht #/trainer zeigt die
   zuletzt gewählte Vorgehensweise, #/trainer?vorgehen=agil ausdrücklich. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SPEICHER = 'trainer';
  var VERSION = 3;          // 2: Graph mit Linien, jede Rolle einmal (bis 2026-09-14); 1: Abbildung 1 — andere Kästen, Quoten nicht vergleichbar
  /* Die Vorgehensweisen zur Wahl, Icons im 24er-Raster wie HT.ui.katSymbol:
     klassisch ein Wasserfall (Phasen nacheinander), agil ein Kreispfeil
     (Iteration). */
  var VORGEHENSWEISEN = [
    { key: 'klassisch', label: 'Klassisch', adjektiv: 'klassischen',
      pfade: ['M3.5 3.8h6v4.4h-6Z', 'M9 10h6v4.4H9Z', 'M14.5 16.2h6v4.4h-6Z', 'M6.5 8.2v4H9', 'M12 14.4v4h2.5'] },
    { key: 'agil', label: 'Agil', adjektiv: 'agilen',
      pfade: ['M20.5 12a8.5 8.5 0 1 1-8.5-8.5c2.4 0 4.6 1 6.2 2.6l2.3 2.3', 'M20.5 3.6v4.8h-4.8'] }
  ];
  var ARTEN = ['rolle', 'aufgabe', 'ergebnis'];
  var ZIEL_ZUSTAENDE = ['tr-ziel--offen', 'tr-ziel--bereit', 'tr-ziel--belegt', 'tr-ziel--richtig', 'tr-ziel--falsch', 'tr-ziel--leer'];

  /* Bild, in Layout-Einheiten (px bei 100 %) */
  var SPALTEN_LUECKE = 18;  // zwischen Rolle, Aufgabe und Ergebnissen
  var ZEILEN_LUECKE = 6;    // zwischen zwei Ergebnissen einer Aufgabe
  var BLOCK_LUECKE = 16;    // zwischen zwei Aufgaben, Haarlinie in der Mitte
  var UNTER_LUECKE = 10;    // vor dem Titel eines weiteren Moduls
  var UNTER_H = 24;         // Zeile eines Modultitels
  var BAHN_TITEL = 30;      // Zeile eines Phasentitels (Modul, Gesamtbild)
  var BAHN_LUFT = 12;       // Luft oben und unten in der Bahn
  var BAHN_RAND = 14;       // Überstand des Bandes links und rechts
  var RAND = 16;            // Luft um das Bild
  var RAHMEN = 3;           // Abstand des Rahmens (Zeiger, Prüfung) um einen Kasten

  var ZOOM_MIN = 0.4;
  var ZOOM_MAX = 2;
  var ZOOM_SCHRITT = 1.2;
  var SCHMAL = 900;         // unterhalb: Bühne über dem Pool (siehe css/trainer.css)
  var LESBAR = 0.7;         // kleinster Grundmassstab auf schmalen Schirmen
  var SUCHE_AB = 12;        // ab so vielen Elementen bekommt der Pool ein Suchfeld
  var ROLLZONE = 48;        // Randzone der Bühne, in der ein Zug sie mitrollt (px)

  var zustand = { beste: {}, leer: { rolle: true, aufgabe: true, ergebnis: true }, vorgehen: 'klassisch', initialisiert: false };
  var refs = {};
  var uebung = null;        // laufende Übung, siehe uebungStarten()
  var zoom = 1;
  var listen = {};          // die Übungen je Vorgehensweise, einmal je Sitzung
  var vorbereitung = null;  // Versprechen: Schrift geladen, Reihenfolge der Abbildung 1 gesetzt

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) {
        el.setAttribute(k, String(attrs[k]));
      }
    }
    return el;
  }

  function rund(n) { return Math.round(n * 10) / 10; }

  function istMeilenstein(e) {
    return e.kategorie === 'ergebnis' && !!e.eintrag && e.eintrag.typ === 'Meilenstein';
  }

  /* «Rolle», «Aufgabe», «Ergebnis» — Meilensteine heissen wie im Graph. */
  function artName(e) {
    return istMeilenstein(e) ? 'Meilenstein' : HT.graph.KAT[e.kategorie].singular;
  }

  /* Eintrag aus VORGEHENSWEISEN; null für einen unbekannten Schlüssel. */
  function vorgehenVon(key) {
    for (var i = 0; i < VORGEHENSWEISEN.length; i++) {
      if (VORGEHENSWEISEN[i].key === key) { return VORGEHENSWEISEN[i]; }
    }
    return null;
  }

  /* --- Gespeichert: beste Quote je Übung und leere Arten, welche Arten leer sind */

  function speichern() {
    HT.store.schreib(SPEICHER, { version: VERSION, beste: zustand.beste, leer: zustand.leer, vorgehen: zustand.vorgehen });
  }

  function wiederherstellen() {
    var g = HT.store.lies(SPEICHER, null);
    if (!g || typeof g !== 'object' || g.version !== VERSION) { return; }
    if (g.beste && typeof g.beste === 'object') { zustand.beste = g.beste; }
    if (vorgehenVon(g.vorgehen)) { zustand.vorgehen = g.vorgehen; }
    if (g.leer && typeof g.leer === 'object') {
      var leer = {};
      ARTEN.forEach(function (art) { leer[art] = g.leer[art] !== false; });
      if (ARTEN.some(function (art) { return leer[art]; })) { zustand.leer = leer; }
    }
  }

  function leereArten() {
    return ARTEN.filter(function (art) { return zustand.leer[art]; });
  }

  /* Die beste Runde gilt je Übung und Auswahl der leeren Arten («phase:Konzept|rae»,
     agil «agil:phase:Umsetzung|rae»). */
  function bestSchluessel(def) {
    return def.id + '|' + leereArten().map(function (art) { return art.charAt(0); }).join('');
  }

  /* Die beste Runde gilt nur, solange die Übung gleich viele Kästen hat —
     ändert sich ihr Aufbau, zählt eine alte Runde nicht mehr. */
  function besteVon(def) {
    var b = zustand.beste[bestSchluessel(def)];
    return b && b.gesamt === leereAnzahl(def) ? b : null;
  }

  /* --- Übungen -------------------------------------------------------------- */

  /* Die Blöcke einer Übung (HT.graph.bloecke, dieselben wie im nachgebauten
     Bild des Überblicks). Unterbahn ist das Modul, nicht in der Modulübung:
     dort ist das Modul die Übung selbst. */
  function bloeckeVon(def) {
    return HT.graph.bloecke(def.umfang, def.art !== 'modul');
  }

  /* Die Übungen einer Vorgehensweise: ihre Phasen, die Module und das
     Gesamtbild — ohne die, in denen dort keine Aufgabe steht. Klassisch
     behalten Ids und Adressen ihre alte Form (beste Runden bleiben gültig),
     agil tragen sie die Vorsilbe «agil:» bzw. &vorgehen=agil. */
  function uebungen(vorgehen) {
    if (listen[vorgehen]) { return listen[vorgehen]; }
    var vorsilbe = vorgehen === 'klassisch' ? '' : vorgehen + ':';
    var zusatz = vorgehen === 'klassisch' ? '' : '&vorgehen=' + vorgehen;
    var liste = [];
    HT.graph.phasenDerVorgehensweise(vorgehen).forEach(function (name) {
      liste.push({
        id: vorsilbe + 'phase:' + name, art: 'phase', name: name, titel: 'Phase ' + name,
        eintrag: HT.daten.eintragMitBegriff(name, 'phase'),
        adresse: '#/trainer?phase=' + encodeURIComponent(name) + zusatz,
        vorgehen: vorgehen,
        umfang: { vorgehen: vorgehen, phasen: [name], module: [] }
      });
    });
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m) {
      liste.push({
        id: vorsilbe + 'modul:' + m.begriff, art: 'modul', name: m.begriff, titel: 'Modul ' + m.begriff,
        eintrag: m,
        adresse: '#/trainer?modul=' + encodeURIComponent(m.begriff) + zusatz,
        vorgehen: vorgehen,
        umfang: { vorgehen: vorgehen, phasen: [], module: [m.begriff] }
      });
    });
    liste.push({
      id: vorsilbe + 'alles', art: 'alles', name: 'Gesamtbild', titel: 'Gesamtbild', eintrag: null,
      adresse: '#/trainer?alles=1' + zusatz,
      vorgehen: vorgehen,
      umfang: { vorgehen: vorgehen, phasen: [], module: [] }
    });
    liste.forEach(function (def) {
      var bloecke = bloeckeVon(def);
      def.zahlen = {
        rolle: bloecke.filter(function (b) { return b.rolle; }).length,
        aufgabe: bloecke.length,
        ergebnis: bloecke.reduce(function (summe, b) { return summe + b.ergebnisse.length; }, 0)
      };
    });
    listen[vorgehen] = liste.filter(function (def) { return def.zahlen.aufgabe > 0; });
    return listen[vorgehen];
  }

  /* Alle Felder einer Vorgehensweise für die Fortschritts-Übersicht
     (js/fortschritt.js): je Phase und Modul die Elemente, die dort zu setzen
     sind — jedes einmal, auch wenn es in mehreren Zeilen des Feldes steht
     («Projektmanagementplan» steht im Konzept fünfmal, gefragt ist er
     einmal). Grundlage ist das Gesamtbild, also dieselben Blöcke wie in den
     Übungen. */
  function felderVon(vorgehen) {
    var alles = uebungen(vorgehen).filter(function (u) { return u.art === 'alles'; })[0];
    if (!alles) { return []; }
    var felder = [], index = {};
    bloeckeVon(alles).forEach(function (b) {
      var s = b.bahn + '|' + b.unter;
      var feld = index[s];
      if (!feld) {
        feld = index[s] = { phase: b.bahn, modul: b.unter, elemente: [] };
        felder.push(feld);
      }
      function merke(k) {
        if (!k || feld.elemente.some(function (e) { return e.id === k.id; })) { return; }
        feld.elemente.push({ id: k.id, kategorie: k.kategorie, begriff: k.begriff });
      }
      merke(b.rolle);
      merke(b.aufgabe);
      b.ergebnisse.forEach(merke);
    });
    return felder;
  }

  function hubAdresse(vorgehen) {
    return vorgehen === 'klassisch' ? '#/trainer' : '#/trainer?vorgehen=' + vorgehen;
  }

  /* Dieselbe Übung in der anderen Vorgehensweise: Modul und Gesamtbild
     gleichen Namens; eine Phase, die es dort nicht gibt, wird zu Umsetzung
     (agil) bzw. Konzept (klassisch). null, wenn die Übung dort fehlt. */
  function gegenstueck(def, vorgehen) {
    var name = def.name;
    if (def.art === 'phase' && HT.graph.phasenDerVorgehensweise(vorgehen).indexOf(name) === -1) {
      name = vorgehen === 'agil' ? 'Umsetzung' : 'Konzept';
    }
    return uebungen(vorgehen).filter(function (u) { return u.art === def.art && u.name === name; })[0] || null;
  }

  function leereAnzahl(def) {
    return leereArten().reduce(function (summe, art) { return summe + def.zahlen[art]; }, 0);
  }

  function istUebung(params) {
    return !!(params && (params.phase || params.modul || params.alles));
  }

  function uebungFinden(params, vorgehen) {
    var n = HT.daten.normalisieren;
    var treffer = uebungen(vorgehen).filter(function (u) {
      if (params.alles) { return u.art === 'alles'; }
      if (params.phase) { return u.art === 'phase' && n(u.name) === n(params.phase); }
      return u.art === 'modul' && n(u.name) === n(params.modul);
    });
    return treffer[0] || null;
  }

  /* Vor dem ersten Bild: die Schrift muss geladen sein, sonst misst der Graph
     die Knotenbreiten mit der Ersatzschrift; und die Reihenfolge der Aufgaben
     und Ergebnisse kommt wie im Graph aus der Abbildung 1 (dazu die Grundlagen
     der Aufgaben, siehe HT.graph.teilgraph). Fehlt die Grafik,
     gilt die Ordnung nach Phase und Name — geübt wird trotzdem. */
  function vorbereiten() {
    if (vorbereitung) { return vorbereitung; }
    var schrift = document.fonts && document.fonts.ready
      ? global.Promise.race([
          document.fonts.ready.catch(function () {}),
          new global.Promise(function (fertig) { global.setTimeout(fertig, 2000); })
        ])
      : global.Promise.resolve();
    var reihenfolge = HT.abbildung
      ? HT.abbildung.holen().then(function (text) {
          HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(HT.abbildung.kaesten(HT.abbildung.lesen(text))));
        }).catch(function () {})
      : global.Promise.resolve();
    vorbereitung = global.Promise.all([schrift, reihenfolge]).then(function () {
      HT.graphZeichnen.schriftLesen(document.body);
    });
    return vorbereitung;
  }

  /* --- Layout: Blöcke in Bahnen ----------------------------------------------- */

  /* Drei Spalten — Rolle, Aufgabe, Ergebnisse —, jede so breit wie ihr
     breitester Knoten, damit ein leerer Kasten die Länge des Namens nicht
     verrät. Bahnen (Phasen) und Unterbahnen (Module) als getönte Bänder und
     Zwischentitel wie im Graph; zwischen zwei Blöcken eine Haarlinie. */
  function layoutBauen(def, bloecke) {
    var GZ = HT.graphZeichnen;
    var KH = GZ.KNOTEN_HOEHE;
    var breite = { rolle: 0, aufgabe: 0, ergebnis: 0 };
    function messe(k) { if (k) { breite[k.kategorie] = Math.max(breite[k.kategorie], GZ.knotenBreite(k)); } }
    bloecke.forEach(function (b) { messe(b.rolle); messe(b.aufgabe); b.ergebnisse.forEach(messe); });
    var x = { rolle: 0, aufgabe: breite.rolle + SPALTEN_LUECKE };
    x.ergebnis = x.aufgabe + breite.aufgabe + SPALTEN_LUECKE;
    var rechts = x.ergebnis + breite.ergebnis;

    var kaesten = [], texte = [], linien = [], baender = [];
    function kasten(k, block, platz, kx, ky) {
      kaesten.push({
        id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, entscheid: k.entscheid,
        x: kx, y: ky, w: breite[k.kategorie], h: KH, block: block, platz: platz,
        schluessel: block + ':' + k.kategorie + ':' + platz
      });
    }

    ARTEN.forEach(function (art) {
      texte.push({ x: x[art], y: -24, text: HT.graph.KAT[art].label, klasse: 'gtext gtext--spalte gtext--' + art });
    });

    /* Die Blöcke kommen nach Bahn und Modul geordnet — aufeinanderfolgende
       mit gleicher Bahn und gleichem Modul bilden eine Unterbahn. */
    var bahnen = [];
    bloecke.forEach(function (b, i) {
      var bahn = bahnen[bahnen.length - 1];
      if (!bahn || bahn.name !== b.bahn) { bahn = { name: b.bahn, unter: [] }; bahnen.push(bahn); }
      var unter = bahn.unter[bahn.unter.length - 1];
      if (!unter || unter.name !== b.unter) { unter = { name: b.unter, bloecke: [] }; bahn.unter.push(unter); }
      unter.bloecke.push(i);
    });

    /* In der Phasenübung ist die Phase der Seitentitel — dort ohne Bahntitel. */
    var bahnTitel = def.art !== 'phase';
    var y = 0;
    bahnen.forEach(function (bahn, bi) {
      var oben = y;
      if (bi > 0) { linien.push({ x1: -BAHN_RAND, y1: y, x2: rechts + BAHN_RAND, y2: y }); }
      y += BAHN_LUFT;
      if (bahnTitel) {
        texte.push({ x: 0, y: y + 10, text: bahn.name || 'Ohne Phase', klasse: 'gtext gtext--bahn' });
        y += BAHN_TITEL;
      }
      bahn.unter.forEach(function (unter, ui) {
        if (ui > 0) { y += UNTER_LUECKE; }
        if (unter.name) {
          if (ui > 0 || bahnTitel) { linien.push({ x1: 0, y1: y, x2: rechts, y2: y, klasse: 'ggruppenlinie--unter' }); }
          texte.push({ x: 0, y: y + UNTER_H / 2, text: unter.name, klasse: 'gtext gtext--untergruppe' });
          y += UNTER_H;
        }
        unter.bloecke.forEach(function (i, n) {
          var b = bloecke[i];
          if (n > 0) {
            linien.push({ x1: 0, y1: y + BLOCK_LUECKE / 2, x2: rechts, y2: y + BLOCK_LUECKE / 2, klasse: 'tr-blocklinie' });
            y += BLOCK_LUECKE;
          }
          if (b.rolle) { kasten(b.rolle, i, 0, x.rolle, y); }
          kasten(b.aufgabe, i, 0, x.aufgabe, y);
          b.ergebnisse.forEach(function (e, j) { kasten(e, i, j, x.ergebnis, y + j * (KH + ZEILEN_LUECKE)); });
          y += Math.max(1, b.ergebnisse.length) * (KH + ZEILEN_LUECKE) - ZEILEN_LUECKE;
        });
      });
      y += BAHN_LUFT;
      baender.push({ x: -BAHN_RAND, y: oben, w: rechts + 2 * BAHN_RAND, h: y - oben, gerade: bi % 2 === 0 });
    });

    return { kaesten: kaesten, texte: texte, linien: linien, baender: baender };
  }

  /* --- Übung: Zustand ------------------------------------------------------ */

  /* uebung = { def, bloecke, layout,
                ziele: [{ n: Kasten, chip, status, loesung, gruppe, inhalt, rahmen, titel }],
                gegeben: [Kasten], chips: [{ id, kategorie, begriff, eintrag, entscheid, w, ziel }],
                gewaehlt: { id, kategorie, begriff } | null, geprueft: false | { richtig, gesamt }, suche }
     Je leerer Kasten ein Chip; Chips desselben Elements sind gleichwertig.
     Im Pool liegen sie als Stapel aus stapelVon, je Element ein Knopf mit Zahl.
     vorher: { Schlüssel des Kastens: Id des gelegten Elements } — beim
     Umschalten der leeren Arten bleibt liegen, was noch einen Kasten hat. */
  function uebungStarten(def, vorher) {
    var bloecke = bloeckeVon(def);
    var layout = layoutBauen(def, bloecke);

    var ziele = [], gegeben = [], chips = [];
    layout.kaesten.forEach(function (n) {
      if (!zustand.leer[n.kategorie]) { gegeben.push(n); return; }
      ziele.push({ n: n, chip: null, status: '', loesung: null, gezaehlt: null });
      chips.push({ id: n.id, kategorie: n.kategorie, begriff: n.begriff, eintrag: n.eintrag, entscheid: n.entscheid, w: n.w, ziel: null });
    });

    uebung = {
      def: def, bloecke: bloecke, layout: layout, ziele: ziele, gegeben: gegeben, chips: chips,
      gewaehlt: null, geprueft: false, suche: ''
    };

    if (vorher) {
      ziele.forEach(function (z) {
        var c = vorher[z.n.schluessel] ? freierChip(vorher[z.n.schluessel]) : null;
        if (c) { z.chip = c; c.ziel = z; }
      });
    }
  }

  function belegung() {
    var b = {};
    if (uebung && !uebung.geprueft) {
      uebung.ziele.forEach(function (z) { if (z.chip) { b[z.n.schluessel] = z.chip.id; } });
    }
    return b;
  }

  function chipsImPool() {
    return uebung.chips.filter(function (c) { return !c.ziel; });
  }

  function freierChip(id) {
    for (var i = 0; i < uebung.chips.length; i++) {
      if (uebung.chips[i].id === id && !uebung.chips[i].ziel) { return uebung.chips[i]; }
    }
    return null;
  }

  /* Freie Chips als Knöpfe für den Pool, nach Art und Name: je Element ein
     Stapel mit der Zahl seiner Kästen — eine Rolle mehrerer Aufgaben genauso
     wie eine Aufgabe mehrerer Phasen oder ein Ergebnis gleichen Namens. */
  function stapelVon(chips) {
    var nachId = {}, stapel = [];
    chips.forEach(function (c) {
      var s = nachId[c.id];
      if (!s) {
        s = { id: c.id, kategorie: c.kategorie, begriff: c.begriff, eintrag: c.eintrag, entscheid: c.entscheid, anzahl: 0 };
        nachId[c.id] = s;
        stapel.push(s);
      }
      s.anzahl++;
    });
    return stapel.sort(function (a, b) {
      return (ARTEN.indexOf(a.kategorie) - ARTEN.indexOf(b.kategorie)) || a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  /* Suche im Pool: Umlaute und Diakritika tolerant («losung» trifft «Lösung»). */
  function suchform(text) {
    var t = HT.daten.normalisieren(text).replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (x) { /* ältere Browser */ }
    return t;
  }

  function trifft(stapel, suche) {
    return !suche || suchform(stapel.begriff).indexOf(suche) !== -1;
  }

  /* Ein Element passt nur in einen Kasten seiner Art. Liegt im Zielkasten
     schon eines, tauschen die beiden — kommt das neue aus dem Pool, geht das
     alte dorthin zurück. Aus der Auswahl gelegt, bleibt ein Stapel gewählt,
     solange noch eines davon im Pool liegt (eine Rolle mehrerer Aufgaben,
     ein Ergebnis mehrerer Aufgaben); der letzte Knopf ist danach verbraucht. */
  function setzen(chip, ziel, ausWahl) {
    if (uebung.geprueft || chip.kategorie !== ziel.n.kategorie) { return; }
    if (ziel.chip !== chip) {
      var herkunft = chip.ziel;
      var verdraengt = ziel.chip;
      if (herkunft) { herkunft.chip = null; }
      if (verdraengt) {
        verdraengt.ziel = herkunft || null;
        if (herkunft) { herkunft.chip = verdraengt; }
      }
      ziel.chip = chip;
      chip.ziel = ziel;
    }
    if (!ausWahl || !freierChip(chip.id)) { uebung.gewaehlt = null; }
    zeichnen();
  }

  function loesen(ziel) {
    if (uebung.geprueft || !ziel.chip) { return; }
    ziel.chip.ziel = null;
    ziel.chip = null;
    zeichnen();
  }

  function zielGeklickt(ziel) {
    if (uebung.geprueft) { return; }
    if (uebung.gewaehlt) {
      var g = uebung.gewaehlt;
      var c = freierChip(g.id);
      if (c && c.kategorie === ziel.n.kategorie) { setzen(c, ziel, true); }
    } else if (ziel.chip) {
      loesen(ziel);
    }
  }

  /* Ein Stapel ist über sein Element gewählt. */
  function istGewaehlt(stapel, gewaehlt) {
    return !!gewaehlt && gewaehlt.id === stapel.id;
  }

  function stapelGeklickt(stapel) {
    if (uebung.geprueft) { return; }
    uebung.gewaehlt = istGewaehlt(stapel, uebung.gewaehlt)
      ? null
      : { id: stapel.id, kategorie: stapel.kategorie, begriff: stapel.begriff };
    zeichnen();
  }

  /* --- Prüfen ---------------------------------------------------------------- */

  /* Zuordnung mit dem grössten Gesamtwert (ungarische Methode, n³).
     wert[i][j]: Wert, wenn Platz i den Block j bekommt; null ist verboten.
     Rückgabe: wahl[i] = j. */
  function zuordnung(wert) {
    var n = wert.length, VERBOTEN = 1e9;
    var u = [], v = [], p = [], weg = [], i, j;
    for (j = 0; j <= n; j++) { u[j] = 0; v[j] = 0; p[j] = 0; weg[j] = 0; }
    function kosten(a, b) { var w = wert[a - 1][b - 1]; return w === null ? VERBOTEN : -w; }
    for (i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0, minv = [], benutzt = [];
      for (j = 0; j <= n; j++) { minv[j] = Infinity; benutzt[j] = false; }
      do {
        benutzt[j0] = true;
        var i0 = p[j0], delta = Infinity, j1 = 0;
        for (j = 1; j <= n; j++) {
          if (benutzt[j]) { continue; }
          var d = kosten(i0, j) - u[i0] - v[j];
          if (d < minv[j]) { minv[j] = d; weg[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= n; j++) {
          if (benutzt[j]) { u[p[j]] += delta; v[j] -= delta; } else { minv[j] -= delta; }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var j2 = weg[j0]; p[j0] = p[j2]; j0 = j2; } while (j0);
    }
    var wahl = [];
    for (j = 1; j <= n; j++) { wahl[p[j] - 1] = j - 1; }
    return wahl;
  }

  /* Jeder Block bekommt den gesuchten Block, der insgesamt die meisten
     Treffer ergibt — unter den Blöcken im selben Feld mit gleich vielen
     Ergebniskästen, und nur einen, zu dem seine ausgefüllten Kästen passen.
     Bei gleich vielen Treffern bleibt ein Block, wo er ist. Danach steht in
     jedem Kasten, der nicht stimmt, das gesuchte Element (loesung). */
  function pruefen() {
    var bloecke = uebung.bloecke;
    var leer = bloecke.map(function () { return { rolle: [], aufgabe: [], ergebnis: [] }; });
    uebung.ziele.forEach(function (z) { leer[z.n.block][z.n.kategorie].push(z); });

    function ids(knoten) { return knoten.map(function (k) { return k.id; }).sort().join('|'); }

    function treffer(i, j, gewicht) {
      var ist = bloecke[i], soll = bloecke[j], z = leer[i], n = 0;
      if (!z.rolle.length && ist.rolle && ist.rolle.id !== soll.rolle.id) { return null; }
      if (!z.aufgabe.length && ist.aufgabe.id !== soll.aufgabe.id) { return null; }
      if (!z.ergebnis.length && ids(ist.ergebnisse) !== ids(soll.ergebnisse)) { return null; }
      z.rolle.forEach(function (k) { if (k.chip && k.chip.id === soll.rolle.id) { n++; } });
      z.aufgabe.forEach(function (k) { if (k.chip && k.chip.id === soll.aufgabe.id) { n++; } });
      var offen = soll.ergebnisse.map(function (k) { return k.id; });
      z.ergebnis.forEach(function (k) {
        var stelle = k.chip ? offen.indexOf(k.chip.id) : -1;
        if (stelle !== -1) { offen.splice(stelle, 1); n++; }
      });
      return gewicht * n + (i === j ? 1 : 0);
    }

    var gruppen = {};
    bloecke.forEach(function (b, i) {
      var s = b.bahn + '|' + b.unter + '|' + b.ergebnisse.length + '|' + (b.rolle ? 'r' : '');
      (gruppen[s] = gruppen[s] || []).push(i);
    });
    var partner = [];
    Object.keys(gruppen).forEach(function (s) {
      var g = gruppen[s];
      /* Ein Treffer wiegt mehr als alle «bleibt, wo er ist» zusammen. */
      var gewicht = g.length + 1;
      var wahl = zuordnung(g.map(function (i) { return g.map(function (j) { return treffer(i, j, gewicht); }); }));
      g.forEach(function (i, a) { partner[i] = g[wahl[a]]; });
    });

    var richtig = 0;
    function einzeln(z, soll) {
      z.loesung = soll;
      z.status = !z.chip ? 'leer' : (z.chip.id === soll.id ? 'richtig' : 'falsch');
    }
    bloecke.forEach(function (b, i) {
      var soll = bloecke[partner[i]], z = leer[i];
      z.rolle.forEach(function (k) { einzeln(k, soll.rolle); });
      z.aufgabe.forEach(function (k) { einzeln(k, soll.aufgabe); });
      var offen = soll.ergebnisse.slice();
      z.ergebnis.forEach(function (k) {
        k.status = '';
        for (var o = 0; k.chip && o < offen.length; o++) {
          if (offen[o].id === k.chip.id) { k.loesung = offen[o]; k.status = 'richtig'; offen.splice(o, 1); break; }
        }
      });
      z.ergebnis.forEach(function (k) {
        if (k.status === 'richtig') { return; }
        k.loesung = offen.shift();
        k.status = k.chip ? 'falsch' : 'leer';
      });
    });
    uebung.ziele.forEach(function (z) { if (z.status === 'richtig') { richtig++; } });
    uebung.geprueft = { richtig: richtig, gesamt: uebung.ziele.length };
    uebung.gewaehlt = null;

    /* Fortschritt je Feld (Phase und Modul) und Element: richtig, solange
       kein Kasten dieses Elements im Feld falsch belegt ist; leere Kästen
       zählen nicht — was man nicht versucht hat, ist weder gekonnt noch
       falsch. In der Modulübung tragen die Blöcke keine Unterbahn, dort ist
       das Modul die Übung selbst.

       Jeder Kasten zählt nur, solange das, was drin liegt, seit der letzten
       Prüfung neu ist (`gezaehlt`): «Prüfen · Weiter · Prüfen» schrieb sonst
       dieselbe Lage jedes Mal wieder gut, und nach drei Klicks galt als
       verstanden, was einmal richtig dalag. Wer einen Kasten neu belegt,
       meldet ihn wieder; «Nochmals» beginnt von vorn. */
    if (HT.fortschritt) {
      var meldungen = {}, liste = [];
      uebung.ziele.forEach(function (z) {
        if (!z.loesung || z.status === 'leer') { return; }
        if (z.gezaehlt === z.chip.id) { return; }
        z.gezaehlt = z.chip.id;
        var b = bloecke[z.n.block];
        var modul = b.unter || (uebung.def.art === 'modul' ? uebung.def.name : '');
        if (!b.bahn || !modul) { return; }
        var s = b.bahn + '|' + modul + '|' + z.loesung.id;
        if (!meldungen[s]) {
          meldungen[s] = { phase: b.bahn, modul: modul, id: z.loesung.id, richtig: true };
          liste.push(meldungen[s]);
        }
        if (z.status !== 'richtig') { meldungen[s].richtig = false; }
      });
      HT.fortschritt.melden(liste);
    }

    var alt = besteVon(uebung.def);
    if (!alt || richtig > alt.richtig) {
      zustand.beste[bestSchluessel(uebung.def)] = { richtig: richtig, gesamt: uebung.ziele.length, wann: new Date().toISOString().slice(0, 10) };
      speichern();
    }
    zeichnen();
    besteZeigen();
    if (refs.ergebnis) {
      try { refs.ergebnis.focus({ preventScroll: true }); } catch (x) { refs.ergebnis.focus(); }
    }
  }

  /* Nach einer Prüfung mitten in der Übung weiterarbeiten: die gelegten
     Elemente bleiben liegen (auch die falschen), nur die Prüfmarken gehen. */
  function weitermachen() {
    uebung.ziele.forEach(function (z) { z.status = ''; z.loesung = null; });
    uebung.gewaehlt = null;
    uebung.geprueft = false;
    zeichnen();
    try { refs.knopfPruefen.focus({ preventScroll: true }); } catch (x) { refs.knopfPruefen.focus(); }
  }

  /* Zurück auf Anfang — an den bestehenden Objekten, denn die Ziele tragen
     die Verweise auf ihre SVG-Elemente. */
  function zuruecksetzen() {
    uebung.ziele.forEach(function (z) { z.chip = null; z.status = ''; z.loesung = null; z.gezaehlt = null; });
    uebung.chips.forEach(function (c) { c.ziel = null; });
    uebung.gewaehlt = null;
    uebung.geprueft = false;
    uebung.suche = '';
    if (refs.suche && refs.suche.feld) { refs.suche.feld.value = ''; }
    zeichnen();
  }

  /* --- Bild ----------------------------------------------------------------- */

  /* Ein Knoten wie im Graph — für das Bild und den Geist beim Ziehen. Nicht
     fokussierbar: die Tastatur bedient den Kasten darum. Ohne Namen ist es
     die Form eines leeren Kastens. */
  function knotenBild(e, w, x, y) {
    var g = HT.graphZeichnen.knotenElement({
      id: e.id || '', kategorie: e.kategorie, begriff: e.begriff || '', eintrag: e.eintrag || null,
      entscheid: !!e.entscheid, w: w, h: HT.graphZeichnen.KNOTEN_HOEHE, x: x || 0, y: y || 0
    });
    g.removeAttribute('tabindex');
    g.removeAttribute('role');
    g.removeAttribute('data-id');
    return g;
  }

  /* Ein Knoten als eigenes kleines SVG (Geist), mit Luft für die Kontur. */
  function knotenSvg(chip, mass) {
    var kh = HT.graphZeichnen.KNOTEN_HOEHE, luft = 3;
    var svg = svgEl('svg', {
      'class': 'tr-knotenbild',
      width: rund((chip.w + 2 * luft) * mass), height: rund((kh + 2 * luft) * mass),
      viewBox: [-luft, -luft, chip.w + 2 * luft, kh + 2 * luft].join(' '),
      'aria-hidden': 'true', focusable: 'false'
    });
    var g = knotenBild(chip, chip.w);
    g.removeAttribute('aria-label');
    svg.appendChild(g);
    return svg;
  }

  /* Umriss des Layouts: Bänder, Kästen, Linien und Texte (deren Breite
     geschätzt — Versalien mit Sperrung). */
  function umriss(layout) {
    var x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    function nimm(ax, ay, bx, by) {
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay);
      x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
    layout.baender.forEach(function (b) { nimm(b.x, b.y, b.x + b.w, b.y + b.h); });
    layout.kaesten.forEach(function (n) { nimm(n.x, n.y, n.x + n.w, n.y + n.h); });
    layout.linien.forEach(function (l) { nimm(l.x1, l.y1, l.x2, l.y2); });
    layout.texte.forEach(function (t) {
      var gross = t.klasse.indexOf('gtext--spalte') !== -1 ? 16 : 14;
      var breite = HT.graphZeichnen.messen(String(t.text).toUpperCase(), 'normal') * gross / 14 * 1.1;
      nimm(t.x, t.y - gross, t.x + breite, t.y + gross);
    });
    return { x: x0 - RAND, y: y0 - RAND, w: x1 - x0 + 2 * RAND, h: y1 - y0 + 2 * RAND };
  }

  function bildBauen() {
    var layout = uebung.layout;
    var u = umriss(layout);
    var svg = svgEl('svg', {
      'class': 'tr-graph', viewBox: [rund(u.x), rund(u.y), rund(u.w), rund(u.h)].join(' '),
      role: 'group', 'aria-label': uebung.def.titel + ' — je Aufgabe die verantwortliche Rolle und die Ergebnisse zum Zuordnen',
      'data-breite': rund(u.w)
    });

    var bahnen = svgEl('g', { 'class': 'tr-bahnen' });
    layout.baender.forEach(function (b) {
      bahnen.appendChild(svgEl('rect', {
        'class': 'gbahn' + (b.gerade ? '' : ' gbahn--ungerade'),
        x: rund(b.x), y: rund(b.y), width: rund(b.w), height: rund(b.h)
      }));
    });
    svg.appendChild(bahnen);

    var texte = svgEl('g', { 'class': 'tr-texte' });
    layout.linien.forEach(function (l) {
      texte.appendChild(svgEl('line', {
        'class': 'ggruppenlinie' + (l.klasse ? ' ' + l.klasse : ''),
        x1: rund(l.x1), y1: rund(l.y1), x2: rund(l.x2), y2: rund(l.y2)
      }));
    });
    layout.texte.forEach(function (t) {
      var el = svgEl('text', { 'class': t.klasse, x: rund(t.x), y: rund(t.y), 'text-anchor': t.anker || 'start' });
      el.textContent = t.text;
      texte.appendChild(el);
    });
    svg.appendChild(texte);

    var knoten = svgEl('g', { 'class': 'tr-knoten' });
    uebung.gegeben.forEach(function (n) {
      var g = knotenBild(n, n.w, n.x, n.y);
      g.classList.add('tr-gegeben');
      g.setAttribute('role', 'img');
      knoten.appendChild(g);
    });
    uebung.ziele.forEach(function (z, i) {
      var n = z.n;
      var g = svgEl('g', {
        'class': 'tr-ziel tr-ziel--' + n.kategorie, 'data-ziel': i,
        tabindex: '0', role: 'button', transform: 'translate(' + rund(n.x) + ',' + rund(n.y) + ')'
      });
      z.inhalt = svgEl('g', { 'class': 'tr-ziel__inhalt' });
      /* Rahmen und Trefferfläche zugleich: etwas grösser als der Knoten, damit
         die Kontur des Knotens darunter sichtbar bleibt. */
      z.rahmen = svgEl('rect', {
        'class': 'tr-ziel__rahmen', x: -RAHMEN, y: -RAHMEN,
        width: rund(n.w + 2 * RAHMEN), height: n.h + 2 * RAHMEN,
        rx: n.kategorie === 'rolle' ? n.h / 2 + RAHMEN : 6 + RAHMEN,
        fill: '#ffffff', 'fill-opacity': '0'
      });
      z.titel = svgEl('title', {});
      g.appendChild(z.inhalt);
      g.appendChild(z.rahmen);
      g.appendChild(z.titel);
      z.gruppe = g;

      g.addEventListener('click', function () { if (z.gezogen) { z.gezogen = false; return; } zielGeklickt(z); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); zielGeklickt(z); }
      });
      zielZiehbar(z, g);
      knoten.appendChild(g);
    });
    svg.appendChild(knoten);
    return svg;
  }

  /* --- Zoom ---------------------------------------------------------------- */

  /* Passend in die Breite der Bühne, nie grösser als im Graph; in der Höhe
     rollt die Bühne — eine Phase ist höher als ein Bildschirm. */
  function grundmass() {
    if (!refs.buehne || !refs.bild) { return 1; }
    var b = Number(refs.bild.getAttribute('data-breite')) || 1;
    var passend = Math.min(1, (refs.buehne.clientWidth - 28) / b);
    /* Auf dem Telefon wäre «passend» unlesbar klein; dort rollt die Bühne auch seitlich. */
    if (global.innerWidth < SCHMAL) { passend = Math.max(passend, LESBAR); }
    return Math.max(0.1, passend);
  }

  function bildMass() {
    return grundmass() * zoom;
  }

  function zoomAnwenden() {
    if (!refs.bild) { return; }
    var b = Number(refs.bild.getAttribute('data-breite')) || 1;
    refs.bild.style.width = Math.round(b * bildMass()) + 'px';
    if (refs.zoomWert) { refs.zoomWert.textContent = Math.round(zoom * 100) + ' %'; }
  }

  function zoomSetzen(wert) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, wert));
    zoomAnwenden();
  }

  function zoomSkalieren(faktor) {
    var alt = zoom;
    zoomSetzen(alt * faktor);
    return zoom / alt;
  }

  /* --- Übung: zeichnen ----------------------------------------------------- */

  function zeichnen() {
    if (!uebung || !refs.pool) { return; }
    var gepr = uebung.geprueft;
    var gewaehlt = gepr ? null : uebung.gewaehlt;

    /* Kästen */
    uebung.ziele.forEach(function (z) {
      if (!z.gruppe) { return; }
      z.gezogen = false;
      var art = HT.graph.KAT[z.n.kategorie].singular;
      var passend = !!gewaehlt && gewaehlt.kategorie === z.n.kategorie;
      var klassen, zeigen, beschreibung;
      if (gepr) {
        klassen = ['tr-ziel--' + z.status];
        zeigen = z.status === 'richtig' ? z.chip : z.loesung;
        beschreibung = z.status === 'richtig' ? 'Richtig: ' + z.chip.begriff
          : z.status === 'falsch' ? 'Falsch — hier gehört ' + z.loesung.begriff + ' hin, gelegt war ' + z.chip.begriff
          : 'Offen — hier gehört ' + z.loesung.begriff + ' hin';
      } else if (z.chip) {
        klassen = ['tr-ziel--belegt'];
        zeigen = z.chip;
        beschreibung = artName(z.chip) + ' ' + z.chip.begriff + ' — Klick oder Enter legt es zurück, Ziehen verschiebt es';
      } else {
        klassen = passend ? ['tr-ziel--offen', 'tr-ziel--bereit'] : ['tr-ziel--offen'];
        zeigen = { kategorie: z.n.kategorie };
        beschreibung = 'Leerer Kasten (' + art + ')' + (passend ? ' — Klick oder Enter legt ' + gewaehlt.begriff + ' hierher' : '');
      }
      ZIEL_ZUSTAENDE.forEach(function (k) { z.gruppe.classList.remove(k); });
      klassen.forEach(function (k) { z.gruppe.classList.add(k); });
      HT.ui.leeren(z.inhalt);
      var bild = knotenBild(zeigen, z.n.w);
      bild.removeAttribute('aria-label');
      z.inhalt.appendChild(bild);
      z.titel.textContent = beschreibung;
      z.gruppe.setAttribute('aria-label', beschreibung);
    });
    if (refs.bild) {
      refs.bild.classList.toggle('ist-bereit', !!gewaehlt);
      refs.bild.classList.toggle('ist-geprueft', !!gepr);
    }

    poolZeichnen(gepr, gewaehlt);

    /* Zähler und Knöpfe */
    var gelegt = uebung.ziele.filter(function (z) { return z.chip; }).length;
    refs.zaehler.textContent = gelegt + ' von ' + uebung.ziele.length + ' zugeordnet';
    refs.knopfPruefen.hidden = !!gepr;
    refs.knopfPruefen.disabled = gelegt === 0;
    refs.knopfReset.hidden = !!gepr;
    /* Nach der Prüfung «Weiter», solange nicht alles richtig ist; sonst nur «Nochmals». */
    var offenBleibt = !!gepr && gepr.richtig < gepr.gesamt;
    refs.knopfFortsetzen.hidden = !offenBleibt;
    refs.knopfNochmals.hidden = !gepr;
    refs.knopfNochmals.classList.toggle('btn--primaer', !offenBleibt);

    /* Auswertung */
    HT.ui.leeren(refs.ergebnis);
    refs.ergebnis.hidden = !gepr;
    if (gepr) { refs.ergebnis.appendChild(auswertung()); }
  }

  /* Pool: je leere Art eine Spalte nebeneinander, die Knöpfe aus stapelVon. */
  function poolZeichnen(gepr, gewaehlt) {
    HT.ui.leeren(refs.pool);
    var frei = chipsImPool();
    var stapel = stapelVon(frei);
    var suche = suchform(uebung.suche);
    var treffer = stapel.filter(function (s) { return trifft(s, suche); });
    if (refs.suche) {
      refs.suche.hidden = stapel.length < SUCHE_AB && !uebung.suche;
      refs.sucheStand.textContent = suche ? treffer.length + ' von ' + stapel.length + ' Elementen' : stapel.length + ' Elemente';
    }
    if (!frei.length) {
      refs.pool.appendChild(h('p', { class: 'tr-pool__leer', text: gepr ? 'Alle Elemente lagen im Bild.' : 'Alle Elemente liegen im Bild — jetzt prüfen.' }));
      return;
    }
    leereArten().forEach(function (art) {
      var label = HT.graph.KAT[art].label;
      var offen = frei.filter(function (c) { return c.kategorie === art; }).length;
      var inArt = treffer.filter(function (s) { return s.kategorie === art; });
      var inhalt = inArt.length
        ? inArt.map(function (s) { return stapelKnopf(s, gewaehlt, gepr); })
        : [h('p', { class: 'tr-pool__leer', text: offen ? 'Kein Treffer' : 'Alle gelegt' })];
      refs.pool.appendChild(h('div', { class: 'tr-pool__spalte tr-pool__spalte--' + art, role: 'group', 'aria-label': label },
        [h('h3', { class: 'tr-mikro tr-pool__titel', text: label + ' · ' + offen })].concat(inhalt)));
    });
  }

  /* Ein Element im Pool: Farbe und Zeichen seines Knotens im Graph, der Name
     darf umbrechen; bei mehreren Kästen die Zahl als Marke an der Ecke. Das
     Typ-Symbol der Ergebnisse fehlt hier — der Platz gehört dem Namen. */
  function stapelKnopf(s, gewaehlt, gepr) {
    var ms = istMeilenstein(s);
    var ist = istGewaehlt(s, gewaehlt);
    var el = h('button', {
      type: 'button',
      class: 'tr-chip tr-chip--' + s.kategorie + (ms ? ' tr-chip--meilenstein' : '') + (s.entscheid ? ' tr-chip--entscheid' : '') + (ist ? ' ist-gewaehlt' : ''),
      'aria-label': artName(s) + ' ' + s.begriff + (s.anzahl > 1 ? ', ' + s.anzahl + ' Kästen' : ''),
      'aria-pressed': ist ? 'true' : 'false',
      disabled: gepr ? 'disabled' : null
    }, [
      h('span', { class: 'tr-chip__glyph', 'aria-hidden': 'true' }, HT.ui.katSymbol(ms ? 'meilenstein' : s.kategorie, 13)),
      h('span', { class: 'tr-chip__text', text: s.begriff }),
      s.anzahl > 1 ? h('span', { class: 'tr-chip__zahl', 'aria-hidden': 'true', text: '×' + s.anzahl }) : null
    ]);
    var gezogen = false;
    el.addEventListener('click', function () { if (!gezogen) { stapelGeklickt(s); } gezogen = false; });
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft) { return; }
      var chip = freierChip(s.id);
      if (!chip) { return; }
      /* Der Geist hat die Grösse des Kastens im Bild; der Zeiger fasst ihn am Zeichen. */
      var m = bildMass();
      ziehen(ev, chip, {
        el: el, griff: { x: 22 * m, y: HT.graphZeichnen.KNOTEN_HOEHE / 2 * m }, ziel: null,
        gezogen: function () { gezogen = true; }
      });
    });
    return el;
  }

  function elementLink(e) {
    return h('a', { href: '#/handbuch?id=' + encodeURIComponent(e.id), text: e.begriff });
  }

  function auswertung() {
    var g = uebung.geprueft;
    var falsch = uebung.ziele.filter(function (z) { return z.status === 'falsch'; });
    var leer = uebung.ziele.filter(function (z) { return z.status === 'leer'; });
    var beste = besteVon(uebung.def);
    var quote = Math.round(100 * g.richtig / g.gesamt);

    var kinder = [
      h('p', { class: 'tr-ergebnis__zahl' }, [
        h('b', { text: g.richtig + ' von ' + g.gesamt }),
        ' richtig · ' + quote + ' %'
        + (beste && beste.richtig > g.richtig ? ' · beste Runde ' + beste.richtig + '/' + beste.gesamt : '')
        + (g.richtig === g.gesamt ? ' · alles richtig' : '')
      ])
    ];
    if (falsch.length) {
      kinder.push(h('h3', { class: 'tr-mikro', text: 'Falsch gelegt' }));
      kinder.push(h('ul', { class: 'tr-liste' }, falsch.map(function (z) {
        return h('li', {}, [
          h('span', { class: 'tr-liste__falsch', text: z.chip.begriff }),
          ' — hier gehört ', elementLink(z.loesung), ' hin'
        ]);
      })));
    }
    if (leer.length) {
      kinder.push(h('h3', { class: 'tr-mikro', text: 'Offen geblieben' }));
      kinder.push(h('ul', { class: 'tr-liste' }, leer.map(function (z) { return h('li', {}, elementLink(z.loesung)); })));
    }
    return h('div', {}, kinder);
  }

  /* --- Ziehen mit Maus oder Stift ----------------------------------------- */

  /* Ziehen mit der Maus — vom Element im Pool oder aus einem belegten Kasten.
     Der Geist folgt dem Zeiger; ein Kasten derselben Art darunter leuchtet
     auf, am oberen und unteren Rand rollt die Bühne mit. Loslassen auf einem
     Kasten legt das Element dorthin (ein belegter tauscht), Loslassen
     irgendwo sonst legt ein aus dem Kasten gezogenes Element in den Pool
     zurück. Ein Zug unter 6 px bleibt ein Klick. Auf Touch-Geräten bleibt es
     beim Antippen (Element, dann Kasten) — ein Ziehen stritte dort mit dem
     Scrollen. */
  function ziehen(ev, chip, quelle) {
    var start = { x: ev.clientX, y: ev.clientY };
    var griff = quelle.griff || { x: ev.clientX - quelle.mass.left, y: ev.clientY - quelle.mass.top };
    var geist = null;
    var drueber = null;
    var zeiger = null;
    var lauf = null;

    function zielUnter(x, y) {
      var unter = document.elementFromPoint(x, y);
      var g = unter && unter.closest ? unter.closest('[data-ziel]') : null;
      var z = g ? uebung.ziele[Number(g.getAttribute('data-ziel'))] : null;
      return z && z.n.kategorie === chip.kategorie ? z : null;
    }

    function drueberSetzen(z) {
      if (z === drueber) { return; }
      if (drueber && drueber.gruppe) { drueber.gruppe.classList.remove('ist-drueber'); }
      drueber = z;
      if (drueber && drueber.gruppe) { drueber.gruppe.classList.add('ist-drueber'); }
    }

    /* Hohe Übungen passen nicht auf den Schirm: in der Randzone oben und
       unten rollt die Bühne, je näher am Rand, desto schneller. */
    function rollen() {
      lauf = null;
      if (!geist || !zeiger || !refs.buehne) { return; }
      var r = refs.buehne.getBoundingClientRect();
      if (zeiger.x < r.left || zeiger.x > r.right) { return; }
      var d = 0;
      if (zeiger.y < r.top + ROLLZONE) { d = zeiger.y - (r.top + ROLLZONE); }
      else if (zeiger.y > r.bottom - ROLLZONE) { d = zeiger.y - (r.bottom - ROLLZONE); }
      if (!d) { return; }
      var vorher = refs.buehne.scrollTop;
      refs.buehne.scrollTop += (d < 0 ? -1 : 1) * Math.max(1, Math.min(24, Math.round(Math.abs(d) / 3)));
      if (refs.buehne.scrollTop === vorher) { return; }
      drueberSetzen(zielUnter(zeiger.x, zeiger.y));
      lauf = global.requestAnimationFrame(rollen);
    }

    /* Die Bewegung hört das Dokument, nicht das Element: ein Zug verlässt es
       sofort, und Pointer Capture kommt nicht überall zuverlässig an. */
    function bewegen(e) {
      if (!geist) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) { return; }
        geist = h('div', { class: 'tr-geist' }, knotenSvg(chip, bildMass()));
        document.body.appendChild(geist);
        quelle.el.classList.add('ist-am-ziehen');
        document.body.classList.add('tr-zieht');
        if (refs.bild) { refs.bild.setAttribute('data-zieht', chip.kategorie); }
      }
      zeiger = { x: e.clientX, y: e.clientY };
      geist.style.left = (e.clientX - griff.x) + 'px';
      geist.style.top = (e.clientY - griff.y) + 'px';
      drueberSetzen(zielUnter(e.clientX, e.clientY));
      if (!lauf) { lauf = global.requestAnimationFrame(rollen); }
      e.preventDefault();
    }

    function ende(e) {
      document.removeEventListener('pointermove', bewegen);
      document.removeEventListener('pointerup', ende);
      document.removeEventListener('pointercancel', ende);
      global.removeEventListener('blur', ende);
      if (lauf) { global.cancelAnimationFrame(lauf); lauf = null; }
      var punkt = e && typeof e.clientX === 'number' ? e : null;
      /* Ohne Zwischenbewegung (sehr schneller Zug) zählt der Weg bis zum
         Loslassen; ein Klick an Ort und Stelle bleibt ein Klick. */
      var weit = punkt ? Math.hypot(punkt.clientX - start.x, punkt.clientY - start.y) >= 6 : false;
      if (geist) { geist.parentNode.removeChild(geist); }
      quelle.el.classList.remove('ist-am-ziehen');
      document.body.classList.remove('tr-zieht');
      if (refs.bild) { refs.bild.removeAttribute('data-zieht'); }
      drueberSetzen(null);
      if (!geist && !weit) { return; }
      /* Der Klick, der dem Loslassen folgt, darf nichts mehr auslösen. Die
         Sperre fällt beim nächsten Aufbau (zeichnen) bzw. beim Klick. */
      quelle.gezogen();
      var z = punkt && e.type === 'pointerup' ? zielUnter(punkt.clientX, punkt.clientY) : null;
      if (z) { setzen(chip, z, false); }
      else if (quelle.ziel && e && e.type === 'pointerup') { loesen(quelle.ziel); }
    }

    document.addEventListener('pointermove', bewegen);
    document.addEventListener('pointerup', ende);
    document.addEventListener('pointercancel', ende);
    global.addEventListener('blur', ende);
  }

  /* Belegter Kasten: sein Element lässt sich wieder herausziehen — in einen
     anderen Kasten oder zurück in den Pool. Das Ereignis bleibt beim Kasten,
     sonst verschöbe die Bühne sich zugleich (HT.ui.radZoomAnbinden). */
  function zielZiehbar(ziel, g) {
    g.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft || !ziel.chip) { return; }
      ev.stopPropagation();
      ziel.gezogen = false;
      ziehen(ev, ziel.chip, { el: g, mass: g.getBoundingClientRect(), ziel: ziel, gezogen: function () { ziel.gezogen = true; } });
    });
  }

  /* --- Bausteine der Seiten ------------------------------------------------- */

  /* Schalter «Leere Kästen: Rollen · Aufgaben · Ergebnisse» — gedrückt heisst
     leer, also zu üben. Die letzte leere Art bleibt: ohne leere Kästen gäbe
     es nichts zu tun. */
  function artenLeiste(beiAenderung) {
    var knoepfe = {};
    function aktualisieren() {
      var an = leereArten();
      ARTEN.forEach(function (art) {
        knoepfe[art].setAttribute('aria-pressed', zustand.leer[art] ? 'true' : 'false');
        knoepfe[art].title = zustand.leer[art] && an.length === 1 ? 'Mindestens eine Art bleibt leer' : '';
      });
    }
    var leiste = h('div', { class: 'tr-arten', role: 'group', 'aria-label': 'Leere Kästen' }, [
      h('span', { class: 'tr-arten__titel', text: 'Leere Kästen' })
    ]);
    ARTEN.forEach(function (art) {
      var knopf = h('button', { type: 'button', class: 'tr-art' }, [
        h('span', { class: 'gswatch gswatch--' + art }, HT.ui.katSymbol(art, 14)),
        h('span', { text: HT.graph.KAT[art].label })
      ]);
      knopf.addEventListener('click', function () {
        if (zustand.leer[art] && leereArten().length === 1) { return; }
        zustand.leer[art] = !zustand.leer[art];
        speichern();
        aktualisieren();
        beiAenderung();
      });
      knoepfe[art] = knopf;
      leiste.appendChild(knopf);
    });
    aktualisieren();
    return leiste;
  }

  /* Radioknöpfe «Klassisch · Agil» mit Icon, in der Form der Schalter
     daneben; der Kreis selbst ist nicht zu sehen, bleibt aber für Tastatur
     und Screenreader da. beiWahl(key) baut für die andere Vorgehensweise auf. */
  var wahlNummer = 0;
  function vorgehenWahl(aktiv, beiWahl) {
    var name = 'tr-vorgehen-' + (++wahlNummer);
    return h('div', { class: 'tr-arten tr-vorgehen', role: 'radiogroup', 'aria-label': 'Vorgehensweise' }, VORGEHENSWEISEN.map(function (v) {
      var eingabe = h('input', {
        type: 'radio', class: 'tr-vorgehen__eingabe', name: name, value: v.key, checked: v.key === aktiv,
        on: { change: function () { if (eingabe.checked && v.key !== aktiv) { beiWahl(v.key); } } }
      });
      return h('label', { class: 'tr-art tr-vorgehen__wahl' + (v.key === aktiv ? ' ist-gewaehlt' : ''), title: v.label + 'e Vorgehensweise' }, [
        eingabe,
        h('span', { class: 'tr-vorgehen__ikone' }, HT.ui.symbol(v.pfade, 16)),
        h('span', { text: v.label })
      ]);
    }));
  }

  /* Dieselbe Wahl auf der Übersicht, aber auf der Seite statt in der Leiste
     (die soll beim Wechsel der Übungsform stehen bleiben) — in der Form der
     Einstellungen des Quiz: Titel darüber, die Optionen als Chips auf einer
     Linie. */
  function vorgehenGruppe(aktiv, beiWahl) {
    var liste = h('ul', { class: 'chips', 'aria-label': 'Vorgehensweise' });
    VORGEHENSWEISEN.forEach(function (v) {
      var knopf = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': v.key === aktiv ? 'true' : 'false',
        title: v.label + 'e Vorgehensweise'
      }, [HT.ui.symbol(v.pfade, 14), h('span', { text: v.label })]);
      knopf.addEventListener('click', function () { if (v.key !== aktiv) { beiWahl(v.key); } });
      liste.appendChild(h('li', {}, knopf));
    });
    return h('div', { class: 'feldgruppe' }, [
      h('p', { class: 'feldgruppe__titel', text: 'Vorgehensweise' }),
      liste
    ]);
  }

  /* Die Wahl in der Leiste der Übung: Vorgehensweise und leere Kästen, durch
     einen Haarstrich getrennt. */
  function einstellungen(vorgehen, beiWahl, beiAenderung) {
    return [
      vorgehenWahl(vorgehen, beiWahl),
      h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
      artenLeiste(beiAenderung)
    ];
  }

  function besteZeigen() {
    if (!refs.beste || !uebung) { return; }
    var b = besteVon(uebung.def);
    refs.beste.textContent = b ? 'Beste ' + b.richtig + '/' + b.gesamt : '';
    refs.beste.hidden = !b;
  }

  function werkzeug(text, klasse, aufruf, attrs) {
    var a = { type: 'button', 'class': klasse, text: text };
    for (var k in (attrs || {})) { if (Object.prototype.hasOwnProperty.call(attrs, k)) { a[k] = attrs[k]; } }
    var el = h('button', a);
    el.addEventListener('click', aufruf);
    return el;
  }

  /* Bei vielen Elementen (Gesamtbild: über 180) ein Suchfeld über dem Pool. */
  function suchfeld() {
    var feld = h('input', {
      type: 'search', class: 'suche__feld tr-suche__feld', placeholder: 'Element suchen …',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Elemente durchsuchen'
    });
    var loeschen = h('button', { type: 'button', class: 'suche__loeschen', 'aria-label': 'Suche löschen', text: '✕' });
    refs.sucheStand = h('span', { class: 'tr-suche__stand', role: 'status' });
    feld.addEventListener('input', function () { uebung.suche = feld.value; zeichnen(); });
    feld.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { feld.value = ''; uebung.suche = ''; zeichnen(); } });
    loeschen.addEventListener('click', function () { feld.value = ''; uebung.suche = ''; zeichnen(); feld.focus(); });
    var huelle = h('div', { class: 'suche tr-suche', hidden: true }, [feld, loeschen, refs.sucheStand]);
    huelle.feld = feld;
    return huelle;
  }

  /* --- Seiten -------------------------------------------------------------- */

  function karte(def) {
    var b = besteVon(def);
    var voll = !!b && b.richtig === b.gesamt;
    return h('a', { class: 'tr-karte' + (voll ? ' tr-karte--voll' : ''), href: def.adresse }, [
      h('span', { class: 'tr-karte__kopf' }, [
        def.eintrag ? HT.ui.katSymbol(def.eintrag.kategorie, 16) : HT.ui.symbol(['M3.5 4.5h17v15h-17Z', 'M3.5 9h17', 'M9 9v10.5', 'M14.5 9v10.5'], 16),
        h('span', { class: 'tr-karte__titel', text: def.name })
      ]),
      h('span', { class: 'tr-karte__meta' }, [
        h('span', { text: leereAnzahl(def) + ' Kästen' }),
        h('span', { class: 'tr-karte__beste', text: b ? (voll ? '✓ ' : '') + 'Beste ' + b.richtig + '/' + b.gesamt : '' })
      ])
    ]);
  }

  function hubRendern(behaelter, vorgehen, leiste) {
    var alle = uebungen(vorgehen);
    /* Andere Vorgehensweise: die Übersicht an Ort und Stelle neu, die Adresse
       nachgeführt, ohne dass der Router die Seite neu aufbaut. */
    function wechseln(key) {
      zustand.vorgehen = key;
      speichern();
      global.history.replaceState(null, '', hubAdresse(key));
      HT.ui.leeren(behaelter);
      hubRendern(behaelter, key, leiste);
      var gewaehlt = behaelter.querySelector('.chip[aria-pressed="true"]');
      if (gewaehlt) { gewaehlt.focus(); }
    }
    function gruppe(art) {
      return h('div', { class: 'tr-karten' }, alle.filter(function (u) { return u.art === art; }).map(function (def) {
        return karte(def);
      }));
    }

    /* Die Leiste trägt nur die Übungsformen, damit sie beim Wechsel zwischen
       Zuordnen, Lernkarten und Quiz stehen bleibt; die Wahl der
       Vorgehensweise steht oben auf der Seite, die leeren Kästen in der
       Übung. Anleitung und Grundlage stehen in der Karte des Info-Icons. */
    leiste(null, function () { return anleitung(vorgehen); });
    behaelter.appendChild(h('section', { class: 'tr-hub' }, [
      vorgehenGruppe(vorgehen, wechseln),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Phasen' }),
      gruppe('phase'),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Module' }),
      gruppe('modul'),
      h('h2', { class: 'tr-mikro tr-mikro--gruppe', text: 'Alles auf einmal' }),
      gruppe('alles')
    ]));
  }

  /* Was das Zuordnen ist und worauf es beruht — vorn in der Karte hinter dem
     Info-Icon der Leiste, in Übersicht und Übung. */
  function anleitung(vorgehen) {
    return [
      h('h3', { class: 'gpop__abschnitt', text: 'Zuordnen' }),
      h('p', { text: 'Rollen, Aufgaben und Ergebnisse der ' + vorgehenVon(vorgehen).adjektiv + ' Vorgehensweise — je Phase, je Modul oder alles auf einmal. '
        + 'Je Aufgabe eine Zeile: links die verantwortliche Rolle, rechts die Ergebnisse, die sie erzeugt. Die Kästen sind leer, '
        + 'die Elemente liegen daneben bereit und wollen an ihren Platz; es zählt die Zuordnung, nicht die Reihenfolge. '
        + 'Welche Arten leer bleiben — Rollen, Aufgaben, Ergebnisse —, sagt die Leiste in der Übung; die übrigen stehen ausgefüllt da. '
        + 'Am Ende zeigt die Prüfung, was richtig, falsch oder offen geblieben ist.' }),
      h('p', {}, [
        'Grundlage: das Raster im ',
        h('a', { href: '#/ueberblick', text: 'Überblick' }),
        ' — Rollen, Aufgaben und Ergebnisse mit den Querverweisen der offiziellen Dokumentation (verantwortliche Rolle je Aufgabe, Ergebnisse je Aufgabe).'
      ])
    ];
  }

  function naechste(def) {
    var alle = uebungen(def.vorgehen);
    var i = alle.indexOf(def);
    return i === -1 ? null : alle[(i + 1) % alle.length];
  }

  function uebungRendern(behaelter, def, leiste) {
    uebungStarten(def, null);
    zoom = 1;

    refs.bild = bildBauen();
    refs.zoomWert = h('span', { class: 'tr-zoom__wert', role: 'status', text: '100 %' });
    refs.buehne = h('div', { class: 'tr-buehne' }, [refs.bild]);
    /* Das Rad rollt die hohe Bühne; zoomen mit Strg + Rad oder zwei Fingern. */
    HT.ui.radZoomAnbinden(refs.buehne, function () { return refs.bild; }, zoomSkalieren, { nurMitTaste: true });

    var zoomLeiste = h('div', { class: 'tr-zoom', role: 'group', 'aria-label': 'Zoom' }, [
      werkzeug('−', 'tr-zoom__knopf', function () { zoomSetzen(zoom / ZOOM_SCHRITT); }, { 'aria-label': 'Verkleinern' }),
      refs.zoomWert,
      werkzeug('+', 'tr-zoom__knopf', function () { zoomSetzen(zoom * ZOOM_SCHRITT); }, { 'aria-label': 'Vergrössern' }),
      werkzeug('Passend', 'tr-zoom__passend', function () { zoomSetzen(1); })
    ]);

    refs.pool = h('div', { class: 'tr-pool', 'aria-label': 'Elemente' });
    refs.suche = suchfeld();
    refs.zaehler = h('span', { class: 'tr-zaehler', role: 'status' });
    refs.beste = h('span', { class: 'tr-beste', hidden: true });
    refs.ergebnis = h('div', { class: 'tr-ergebnis', tabindex: '-1', 'aria-live': 'polite', hidden: true });

    refs.knopfPruefen = werkzeug('Prüfen', 'btn btn--primaer', pruefen);
    refs.knopfReset = werkzeug('Zurücksetzen', 'btn', function () { zuruecksetzen(); });
    refs.knopfFortsetzen = werkzeug('Weiter', 'btn btn--primaer', weitermachen, { title: 'Mit den gelegten Elementen weiterarbeiten' });
    refs.knopfNochmals = werkzeug('Nochmals', 'btn btn--primaer', function () { zuruecksetzen(); }, { title: 'Alle Elemente zurück in die Auswahl' });
    var folgende = naechste(def);
    var knopfNaechste = folgende && folgende !== def ? h('a', { class: 'btn', href: folgende.adresse, text: 'Nächste: ' + folgende.name + ' →' }) : null;

    /* Andere leere Arten: neues Bild, was schon liegt und noch einen Kasten hat, bleibt liegen. */
    function neuAufbauen() {
      var vorher = belegung();
      uebungStarten(def, vorher);
      var neu = bildBauen();
      refs.buehne.replaceChild(neu, refs.bild);
      refs.bild = neu;
      if (refs.suche && refs.suche.feld) { refs.suche.feld.value = ''; }
      besteZeigen();
      zeichnen();
      zoomAnwenden();
    }

    /* Titel und Zähler stehen in der Leiste unter der Kopfzeile, nach den
       Übungsformen und vor der Wahl; «Zuordnen» dort führt zurück zu allen
       Übungen. */
    leiste([
      h('div', { class: 'tr-leistentitel' }, [
        h('span', { class: 'tr-kicker', text: def.art === 'phase' ? 'Phase' : def.art === 'modul' ? 'Modul' : 'Alles' }),
        h('h1', { class: 'tr-titel', text: def.name }),
        refs.zaehler,
        refs.beste
      ]),
      h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' })
    ].concat(einstellungen(def.vorgehen, function (key) {
      var ziel = gegenstueck(def, key);
      zustand.vorgehen = key;
      speichern();
      global.location.hash = ziel ? ziel.adresse : hubAdresse(key);
    }, neuAufbauen)), function () { return anleitung(def.vorgehen); });

    var seite = h('section', { class: 'tr-uebung', 'data-art': def.art }, [
      h('div', { class: 'tr-buehne-huelle' }, [refs.buehne, zoomLeiste]),
      h('aside', { class: 'tr-seite', 'aria-label': 'Elemente und Auswertung' }, [
        h('div', { class: 'btn-reihe tr-knoepfe' }, [refs.knopfPruefen, refs.knopfReset, refs.knopfFortsetzen, refs.knopfNochmals, knopfNaechste]),
        refs.ergebnis,
        refs.suche,
        refs.pool
      ])
    ]);
    behaelter.appendChild(seite);

    besteZeigen();
    zeichnen();
    zoomAnwenden();
    groesseAnmelden();
  }

  var groesseAngemeldet = false;
  function groesseAnmelden() {
    if (groesseAngemeldet) { return; }
    groesseAngemeldet = true;
    global.addEventListener('resize', function () {
      if (refs.buehne && document.body.contains(refs.buehne)) { zoomAnwenden(); }
    });
  }

  /* --- Teil «Zuordnen» ------------------------------------------------------ */

  /* Ohne phase/modul/alles: die Übersicht der Übungen (unter der Leiste des
     Trainers); mit: die Übung selbst als eigene Seite in voller Breite. */
  function zuordnenRendern(behaelter, params, leiste) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    refs = {};
    uebung = null;
    params = params || {};
    leiste = leiste || function () {};

    /* Die Adresse sagt die Vorgehensweise; ohne Angabe ist eine Übung
       klassisch (alte Links) und die Übersicht die zuletzt gewählte. */
    var vorgehen = vorgehenVon(params.vorgehen) ? params.vorgehen : istUebung(params) ? 'klassisch' : zustand.vorgehen;
    if (vorgehen !== zustand.vorgehen) { zustand.vorgehen = vorgehen; speichern(); }

    if (!istUebung(params)) {
      hubRendern(behaelter, vorgehen, leiste);
      return;
    }
    var def = uebungFinden(params, vorgehen);
    if (!def) {
      behaelter.appendChild(HT.ui.leerZustand('Diese Übung gibt es nicht',
        'Der Link zeigt auf eine Phase oder ein Modul, das in der ' + vorgehenVon(vorgehen).adjektiv + ' Vorgehensweise nicht vorkommt.',
        h('a', { class: 'btn btn--klein', href: hubAdresse(vorgehen), text: 'Alle Übungen' })));
      return;
    }

    var laden = h('p', { class: 'ladehinweis', text: 'Übung wird vorbereitet …' });
    behaelter.appendChild(laden);
    vorbereiten().then(function () {
      if (!document.body.contains(laden)) { return; }
      behaelter.removeChild(laden);
      uebungRendern(behaelter, def, leiste);
    });
  }

  function titel(params) {
    var zusatz = params && params.vorgehen === 'agil' ? ' (agil)' : '';
    if (params && params.phase) { return 'Trainer · Phase ' + params.phase + zusatz; }
    if (params && params.modul) { return 'Trainer · Modul ' + params.modul + zusatz; }
    return 'Trainer · Gesamtbild' + zusatz;
  }

  /* Was die Fortschritts-Übersicht (js/fortschritt.js) vom Zuordnen braucht:
     die Felder, die Übungen (für die Links) und die gemeinsame Wahl der
     Vorgehensweise — beide Seiten zeigen dieselbe. */
  HT.zuordnen = {
    felder: felderVon,
    uebungen: uebungen,
    vorgehenVon: vorgehenVon,
    vorgehenGruppe: vorgehenGruppe,
    vorgehenStand: function () {
      if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
      return zustand.vorgehen;
    },
    vorgehenMerken: function (key) {
      if (!vorgehenVon(key)) { return; }
      HT.zuordnen.vorgehenStand();
      zustand.vorgehen = key;
      speichern();
    }
  };

  HT.trainerTeile.zuordnen = {
    id: 'zuordnen',
    label: 'Zuordnen',
    pfade: ['M4 5h7v6H4Z', 'M13 13h7v6h-7Z', 'M13 5h7v6h-7Z', 'M4 13h7v6H4Z', 'M6 16l1.6 1.6L10 14.8'],
    render: zuordnenRendern,
    /* Eigene Seiten in voller Breite — Titel und Wahl stehen dort in der Leiste. */
    istUebung: istUebung,
    titel: titel
  };
}(window));
