/* meinHERMES — Trainer, Teil «Zuordnen»: Rollen, Aufgaben und Ergebnisse
   einander zuordnen.

   Jede Übung ist ein Ausschnitt der klassischen oder der agilen
   Vorgehensweise (Radioknöpfe vor «Leere Kästen»): eine Phase, ein Modul
   oder das Gesamtbild. Das Bild ist das Raster des Überblicks (js/raster.js,
   HT.raster.uebung) — Phasen als Zeilen, Module als Spalten, je Aufgabe ein
   Block mit der verantwortlichen Rolle darüber und den Ergebnissen darunter,
   dieselbe Ordnung und Ausrichtung. Felder mit gleichem Inhalt über
   mehrere Phasen stehen wie dort einmal. Rechts, wo im Überblick die
   Inhaltsseite steht, liegen die Elemente: je Element ein Knopf mit der
   Zahl seiner Kästen, darüber die Suche.

   Welche Elementarten leer sind, wählen drei Schalter (Rollen, Aufgaben,
   Ergebnisse); die übrigen stehen ausgefüllt als Anhaltspunkte im Bild.
   Sie stehen in der Leiste der Übung, zusammen mit Vorgehensweise, Titel
   und Zähler. Die Übersicht hat in der Leiste nichts eigenes — dort wäre
   die Navigation je Übungsform anders lang —, ihre Wahl der
   Vorgehensweise steht oben auf der Seite; die Kästen zählt sie mit der
   zuletzt gewählten Einstellung.

   Ein leerer Kasten zeigt beim Zeigen den Knopf «Hinweis»: jeder Klick
   deckt einen Buchstaben des gesuchten Elements mehr auf.

   Geprüft wird die Zuordnung, nicht die Reihenfolge: Blöcke im selben Feld
   mit gleich vielen Ergebniskästen sind vertauschbar, und innerhalb eines
   Blocks zählt nicht, in welchem Kasten ein Ergebnis liegt. Die Prüfung
   gibt jedem Block den gesuchten Block, der insgesamt die meisten Treffer
   ergibt; ausgefüllte Kästen müssen dazu passen.

   Adressen: #/trainer?phase=<Phase>, #/trainer?modul=<Modul>,
   #/trainer?alles=1 — je eine eigene Seite in voller Breite; agil mit
   &vorgehen=agil (ohne Angabe klassisch). Die Übersicht #/trainer zeigt die
   zuletzt gewählte Vorgehensweise, #/trainer?vorgehen=agil ausdrücklich. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
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
  var ZIEL_ZUSTAENDE = ['tr-rz--leer', 'tr-rz--bereit', 'tr-rz--belegt', 'tr-rz--richtig', 'tr-rz--falsch', 'tr-rz--offen'];
  var ROLLZONE = 48;        // Randzone der Bühne, in der ein Zug sie mitrollt (px)

  var zustand = { beste: {}, leer: { rolle: true, aufgabe: true, ergebnis: true }, vorgehen: 'klassisch', initialisiert: false };
  var refs = {};
  var uebung = null;        // laufende Übung, siehe uebungStarten()
  var listen = {};          // die Übungen je Vorgehensweise, einmal je Sitzung
  var vorbereitung = null;  // Versprechen: Schrift geladen, Reihenfolge der Abbildung 1 gesetzt

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

  /* Die Blöcke einer Übung nach Phase und Modul (HT.graph.bloecke) — für die
     Fortschritts-Übersicht. Unterbahn ist das Modul, nicht in der
     Modulübung: dort ist das Modul die Übung selbst. */
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
    /* Die Kästen zählen wie im Bild, dem Raster: ein Feld über mehrere
       Phasen einmal. */
    liste.forEach(function (def) {
      var bloecke = [];
      HT.raster.felder(rasterAusschnitt(def)).forEach(function (f) { bloecke = bloecke.concat(f.bloecke); });
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

  /* Was das Raster von der Übung zeigt: eine Phase, ein Modul oder alles. */
  function rasterAusschnitt(def) {
    return {
      vorgehen: def.vorgehen,
      phasen: def.art === 'phase' ? [def.name] : null,
      module: def.art === 'modul' ? [def.name] : null
    };
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

  /* Vor dem ersten Bild: die Schrift muss geladen sein, sonst richtet das
     Raster nach der Ersatzschrift aus; und die Reihenfolge der Aufgaben und
     Ergebnisse kommt wie im Überblick aus der Abbildung 1 (HT.raster.bereit).
     Fehlt die Grafik, gilt die Ordnung nach Phase und Name — geübt wird
     trotzdem. */
  function vorbereiten() {
    if (vorbereitung) { return vorbereitung; }
    var schrift = document.fonts && document.fonts.ready
      ? global.Promise.race([
          document.fonts.ready.catch(function () {}),
          new global.Promise(function (fertig) { global.setTimeout(fertig, 2000); })
        ])
      : global.Promise.resolve();
    vorbereitung = global.Promise.all([schrift, HT.raster.bereit().catch(function () {})]);
    return vorbereitung;
  }

  /* --- Übung: Zustand ------------------------------------------------------ */

  /* uebung = { def, raster, bloecke: [{ bahn, phasen, unter, rolle, aufgabe, ergebnisse }],
                ziele: [{ n: Kasten, el, chip, status, loesung, gezaehlt, hinweis }],
                chips: [{ id, kategorie, begriff, eintrag, entscheid, ziel }],
                gewaehlt: { id, kategorie, begriff } | null, geprueft: false | { richtig, gesamt }, suche }
     Das Raster baut die Blöcke; je Element einer leeren Art gibt knoten()
     einen leeren Kasten zurück (Ziel) und legt dazu einen Chip an. Chips
     desselben Elements sind gleichwertig; im Pool liegen sie als Stapel aus
     stapelVon, je Element ein Knopf mit Zahl. Der Schlüssel eines Kastens
     (Block, Art, Platz) ist bei gleichem Ausschnitt jedes Mal derselbe.
     vorher: { Schlüssel: Id des gelegten Elements } — beim Umschalten der
     leeren Arten bleibt liegen, was noch einen Kasten hat. */
  function uebungStarten(def, vorher) {
    var bloecke = [], ziele = [], chips = [];
    var blockVon = new global.Map();
    function knoten(k, ort) {
      var i = blockVon.get(ort.block);
      if (i === undefined) {
        i = bloecke.length;
        blockVon.set(ort.block, i);
        bloecke.push({
          bahn: ort.phasen.join(' '), phasen: ort.phasen, unter: ort.modul,
          rolle: ort.block.rolle, aufgabe: ort.block.aufgabe, ergebnisse: ort.block.ergebnisse
        });
      }
      if (!zustand.leer[k.kategorie]) { return null; }
      var n = {
        id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, entscheid: k.entscheid,
        block: i, platz: ort.platz, schluessel: i + ':' + k.kategorie + ':' + ort.platz
      };
      var z = { n: n, chip: null, status: '', loesung: null, gezaehlt: null, hinweis: null };
      z.el = zielBauen(z, ziele.length);
      ziele.push(z);
      chips.push({ id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, entscheid: k.entscheid, ziel: null });
      return z.el;
    }
    var aus = rasterAusschnitt(def);
    aus.knoten = knoten;
    var raster = HT.raster.uebung(aus);

    uebung = {
      def: def, raster: raster, bloecke: bloecke, ziele: ziele, chips: chips,
      gewaehlt: null, geprueft: false, suche: uebung && uebung.def === def ? uebung.suche : ''
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
     Bei gleich vielen Treffern bleibt ein Block, wo er ist. Gibt je Kasten
     { loesung, status } zurück: das gesuchte Element und richtig, falsch
     oder leer — für die Prüfung und für den Hinweis. */
  function abgleich() {
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

    var res = new global.Map();
    function einzeln(z, soll) {
      res.set(z, { loesung: soll, status: !z.chip ? 'leer' : (z.chip.id === soll.id ? 'richtig' : 'falsch') });
    }
    bloecke.forEach(function (b, i) {
      var soll = bloecke[partner[i]], z = leer[i];
      z.rolle.forEach(function (k) { einzeln(k, soll.rolle); });
      z.aufgabe.forEach(function (k) { einzeln(k, soll.aufgabe); });
      var offen = soll.ergebnisse.slice();
      z.ergebnis.forEach(function (k) {
        for (var o = 0; k.chip && o < offen.length; o++) {
          if (offen[o].id === k.chip.id) { res.set(k, { loesung: offen[o], status: 'richtig' }); offen.splice(o, 1); break; }
        }
      });
      z.ergebnis.forEach(function (k) {
        if (res.has(k)) { return; }
        res.set(k, { loesung: offen.shift(), status: k.chip ? 'falsch' : 'leer' });
      });
    });
    return res;
  }

  /* Danach steht in jedem Kasten, der nicht stimmt, das gesuchte Element. */
  function pruefen() {
    var res = abgleich();
    var richtig = 0;
    uebung.ziele.forEach(function (z) {
      var r = res.get(z);
      z.loesung = r.loesung;
      z.status = r.status;
      if (z.status === 'richtig') { richtig++; }
    });
    uebung.geprueft = { richtig: richtig, gesamt: uebung.ziele.length };
    uebung.gewaehlt = null;

    /* Fortschritt je Feld (Phase und Modul) und Element: richtig, solange
       kein Kasten dieses Elements im Feld falsch belegt ist; leere Kästen
       zählen nicht — was man nicht versucht hat, ist weder gekonnt noch
       falsch. Ein Feld über mehrere Phasen meldet für jede.

       Jeder Kasten zählt nur, solange das, was drin liegt, seit der letzten
       Prüfung neu ist (`gezaehlt`): «Prüfen · Weiter · Prüfen» schrieb sonst
       dieselbe Lage jedes Mal wieder gut, und nach drei Klicks galt als
       verstanden, was einmal richtig dalag. Wer einen Kasten neu belegt,
       meldet ihn wieder; «Von vorne» beginnt von vorn. */
    if (HT.fortschritt) {
      var meldungen = {}, liste = [];
      uebung.ziele.forEach(function (z) {
        if (!z.loesung || z.status === 'leer') { return; }
        if (z.gezaehlt === z.chip.id) { return; }
        z.gezaehlt = z.chip.id;
        var b = uebung.bloecke[z.n.block];
        if (!b.unter) { return; }
        b.phasen.forEach(function (phase) {
          var s = phase + '|' + b.unter + '|' + z.loesung.id;
          if (!meldungen[s]) {
            meldungen[s] = { phase: phase, modul: b.unter, id: z.loesung.id, richtig: true };
            liste.push(meldungen[s]);
          }
          if (z.status !== 'richtig') { meldungen[s].richtig = false; }
        });
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

  /* Hinweis: je Klick ein Buchstabe mehr des gesuchten Elements (Leerzeichen
     kommen mit dem nächsten). Gesucht ist, was der Abgleich dem Kasten beim
     ersten Klick zuweist — passend zu dem, was schon liegt; danach bleibt es. */
  function sichtbar(text) { return String(text).replace(/\u00ad/g, ''); }

  function hinweisGeben(z) {
    if (uebung.geprueft || z.chip) { return; }
    if (!z.hinweis) {
      var r = abgleich().get(z);
      if (!r || !r.loesung) { return; }
      z.hinweis = { begriff: sichtbar(r.loesung.begriff), n: 0 };
    }
    var zeichen = Array.from(z.hinweis.begriff);
    if (z.hinweis.n < zeichen.length) { z.hinweis.n++; }
    while (z.hinweis.n < zeichen.length && /\s/.test(zeichen[z.hinweis.n - 1])) { z.hinweis.n++; }
    zeichnen();
  }

  function hinweisText(z) {
    var zeichen = Array.from(z.hinweis.begriff);
    return zeichen.slice(0, z.hinweis.n).join('') + (z.hinweis.n < zeichen.length ? '…' : '');
  }

  /* Nach einer Prüfung weiterarbeiten: die falsch gelegten Elemente gehen
     zurück in die Auswahl, die richtigen bleiben liegen; die Prüfmarken gehen. */
  function weitermachen() {
    uebung.ziele.forEach(function (z) {
      if (z.status === 'falsch' && z.chip) { z.chip.ziel = null; z.chip = null; z.gezaehlt = null; }
      z.status = ''; z.loesung = null;
    });
    uebung.gewaehlt = null;
    uebung.geprueft = false;
    zeichnen();
    try { refs.knopfPruefen.focus({ preventScroll: true }); } catch (x) { refs.knopfPruefen.focus(); }
  }

  /* Zurück auf Anfang — an den bestehenden Objekten, denn die Ziele tragen
     die Verweise auf ihre Kästen im Raster. */
  function zuruecksetzen() {
    uebung.ziele.forEach(function (z) { z.chip = null; z.status = ''; z.loesung = null; z.gezaehlt = null; z.hinweis = null; });
    uebung.chips.forEach(function (c) { c.ziel = null; });
    uebung.gewaehlt = null;
    uebung.geprueft = false;
    uebung.suche = '';
    if (refs.suche && refs.suche.feld) { refs.suche.feld.value = ''; }
    zeichnen();
  }

  /* --- Kästen im Raster -------------------------------------------------------- */

  /* Ein leerer Kasten im Raster: dieselbe Grösse und Art wie das Element im
     Überblick (ra-k--rolle, --aufgabe, --ergebnis — danach richtet das
     Raster aus), ohne Namen. Kein <button>: darin steht der Knopf
     «Hinweis». Klick oder Enter legt das gewählte Element hinein bzw. ein
     gelegtes zurück; ein gelegtes lässt sich herausziehen. */
  function zielBauen(z, i) {
    var el = h('div', {
      class: 'ra-k ra-k--' + z.n.kategorie + ' tr-rz tr-rz--leer', tabindex: '0', role: 'button',
      dataset: { ziel: String(i) }
    });
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.tr-rz__hinweis')) { ev.stopPropagation(); hinweisGeben(z); return; }
      if (z.gezogen) { z.gezogen = false; return; }
      zielGeklickt(z);
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.target !== el) { return; }
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); zielGeklickt(z); }
    });
    zielZiehbar(z, el);
    return el;
  }

  /* Der Inhalt eines Kastens wie ein Element im Raster (js/raster.js,
     knoten): Rolle mit Zeichen, Meilenstein mit Raute, sonst der Name. */
  function zielFuellen(z, zeigen, hinweis, gepr) {
    var kat = z.n.kategorie;
    var ms = !!zeigen && istMeilenstein(zeigen);
    z.el.classList.toggle('ra-k--meilenstein', ms);
    HT.ui.leeren(z.el);
    if (kat === 'rolle') { z.el.appendChild(h('span', { class: 'gswatch gswatch--rolle', 'aria-hidden': 'true' }, HT.ui.katSymbol('rolle', 12))); }
    if (ms) { z.el.appendChild(h('span', { class: 'ra-k__ikone', 'aria-hidden': 'true' }, h('span', { class: 'ra-ms__raute' }))); }
    if (zeigen) {
      z.el.appendChild(h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(zeigen.begriff) }));
    } else if (hinweis) {
      z.el.appendChild(h('span', { class: 'ra-k__name tr-rz__hinweistext', text: hinweis }));
    }
    if (!zeigen && !gepr) {
      z.el.appendChild(h('button', {
        type: 'button', class: 'tr-rz__hinweis', tabindex: '-1',
        title: 'Hinweis: einen Buchstaben mehr zeigen', 'aria-label': 'Hinweis', text: 'Hinweis'
      }));
    }
  }

  /* --- Übung: zeichnen ----------------------------------------------------- */

  function zeichnen() {
    if (!uebung || !refs.pool) { return; }
    var gepr = uebung.geprueft;
    var gewaehlt = gepr ? null : uebung.gewaehlt;

    /* Kästen — neu gefüllt nur, wo sich etwas geändert hat. */
    var geaendert = false;
    uebung.ziele.forEach(function (z) {
      z.gezogen = false;
      var art = HT.graph.KAT[z.n.kategorie].singular;
      var passend = !!gewaehlt && gewaehlt.kategorie === z.n.kategorie;
      var klassen, zeigen = null, hinweis = null, beschreibung;
      if (gepr) {
        klassen = ['tr-rz--' + (z.status === 'leer' ? 'offen' : z.status)];
        zeigen = z.status === 'richtig' ? z.chip : z.loesung;
        beschreibung = z.status === 'richtig' ? 'Richtig: ' + z.chip.begriff
          : z.status === 'falsch' ? 'Falsch — hier gehört ' + z.loesung.begriff + ' hin, gelegt war ' + z.chip.begriff
          : 'Offen — hier gehört ' + z.loesung.begriff + ' hin';
      } else if (z.chip) {
        klassen = ['tr-rz--belegt'];
        zeigen = z.chip;
        beschreibung = artName(z.chip) + ' ' + z.chip.begriff + ' — Klick oder Enter legt es zurück, Ziehen verschiebt es';
      } else {
        klassen = passend ? ['tr-rz--leer', 'tr-rz--bereit'] : ['tr-rz--leer'];
        hinweis = z.hinweis && z.hinweis.n ? hinweisText(z) : null;
        beschreibung = 'Leerer Kasten (' + art + ')' + (hinweis ? ', Hinweis ' + hinweis : '')
          + (passend ? ' — Klick oder Enter legt ' + gewaehlt.begriff + ' hierher' : '');
      }
      ZIEL_ZUSTAENDE.forEach(function (k) { z.el.classList.toggle(k, klassen.indexOf(k) !== -1); });
      var inhalt = (zeigen ? zeigen.id : '') + '|' + (hinweis || '') + '|' + !!gepr;
      if (inhalt !== z.inhalt) {
        z.inhalt = inhalt;
        zielFuellen(z, zeigen, hinweis, gepr);
        geaendert = true;
      }
      z.el.title = beschreibung;
      z.el.setAttribute('aria-label', beschreibung);
    });
    uebung.raster.buehne.classList.toggle('ist-bereit', !!gewaehlt);
    uebung.raster.buehne.classList.toggle('ist-geprueft', !!gepr);

    poolZeichnen(gepr, gewaehlt);

    /* Zähler und Knöpfe */
    var gelegt = uebung.ziele.filter(function (z) { return z.chip; }).length;
    refs.zaehler.textContent = gelegt + ' von ' + uebung.ziele.length + ' zugeordnet';
    refs.knopfPruefen.hidden = !!gepr;
    refs.knopfPruefen.disabled = gelegt === 0;
    refs.knopfReset.hidden = !!gepr;
    /* Nach der Prüfung «Weiter», solange nicht alles richtig ist; sonst nur «Von vorne». */
    var offenBleibt = !!gepr && gepr.richtig < gepr.gesamt;
    refs.knopfFortsetzen.hidden = !offenBleibt;
    refs.knopfNochmals.hidden = !gepr;
    refs.knopfNochmals.classList.toggle('btn--primaer', !offenBleibt);

    /* Auswertung */
    HT.ui.leeren(refs.ergebnis);
    refs.ergebnis.hidden = !gepr;
    if (gepr) { refs.ergebnis.appendChild(auswertung()); }

    /* Namen und Hinweise ändern die Höhen: neu ausrichten. */
    if (geaendert) { rasterLegen(); }
  }

  function rasterLegen() {
    if (uebung && uebung.raster && document.body.contains(uebung.raster.buehne)) {
      uebung.raster.spurenLegen(global.innerWidth + '|' + (refs.seite ? refs.seite.offsetWidth : 0));
    }
  }

  /* Pool: je leere Art ein Abschnitt, darin die Knöpfe aus stapelVon. */
  function poolZeichnen(gepr, gewaehlt) {
    HT.ui.leeren(refs.pool);
    var frei = chipsImPool();
    var stapel = stapelVon(frei);
    var suche = suchform(uebung.suche);
    var treffer = stapel.filter(function (s) { return trifft(s, suche); });
    refs.sucheStand.textContent = suche ? treffer.length + ' von ' + stapel.length + ' Elementen' : stapel.length + ' Elemente';
    refs.reiterZahl.textContent = String(frei.length);
    if (!frei.length) {
      refs.pool.appendChild(h('p', { class: 'tr-pool__leer', text: gepr ? 'Alle Elemente lagen im Bild.' : 'Alle Elemente liegen im Bild — jetzt prüfen.' }));
      return;
    }
    leereArten().forEach(function (art) {
      var label = HT.graph.KAT[art].label;
      var offen = frei.filter(function (c) { return c.kategorie === art; }).length;
      var inArt = treffer.filter(function (s) { return s.kategorie === art; });
      var inhalt = inArt.length
        ? h('div', { class: 'tr-pool__liste tr-pool__liste--' + art }, inArt.map(function (s) { return stapelKnopf(s, gewaehlt, gepr); }))
        : h('p', { class: 'tr-pool__leer', text: offen ? 'Kein Treffer' : 'Alle gelegt' });
      refs.pool.appendChild(h('section', { class: 'tr-pool__art', 'aria-label': label }, [
        h('h3', { class: 'tr-pool__titel' }, [
          h('span', { class: 'gswatch gswatch--' + art, 'aria-hidden': 'true' }, HT.ui.katSymbol(art, 12)),
          h('span', { text: label }),
          h('span', { class: 'tr-pool__zahl', text: String(offen) })
        ]),
        inhalt
      ]));
    });
  }

  /* Ein Element im Pool wie im Raster: Aufgabe und Ergebnis als Kasten ihrer
     Farbe, Rolle mit Zeichen, Meilenstein mit Raute; bei mehreren Kästen
     die Zahl als Marke an der Ecke. */
  function stapelKnopf(s, gewaehlt, gepr) {
    var ms = istMeilenstein(s);
    var ist = istGewaehlt(s, gewaehlt);
    var el = h('button', {
      type: 'button',
      class: 'ra-k ra-k--' + s.kategorie + (ms ? ' ra-k--meilenstein' : '') + ' tr-el' + (ist ? ' ist-gewaehlt' : ''),
      title: s.begriff,
      'aria-label': artName(s) + ' ' + s.begriff + (s.anzahl > 1 ? ', ' + s.anzahl + ' Kästen' : ''),
      'aria-pressed': ist ? 'true' : 'false',
      disabled: gepr ? 'disabled' : null
    }, [
      s.kategorie === 'rolle' ? h('span', { class: 'gswatch gswatch--rolle', 'aria-hidden': 'true' }, HT.ui.katSymbol('rolle', 12)) : null,
      ms ? h('span', { class: 'ra-k__ikone', 'aria-hidden': 'true' }, h('span', { class: 'ra-ms__raute' })) : null,
      h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(s.begriff) }),
      s.anzahl > 1 ? h('span', { class: 'tr-el__zahl', 'aria-hidden': 'true', text: '×' + s.anzahl }) : null
    ]);
    var gezogen = false;
    el.addEventListener('click', function () { if (!gezogen) { stapelGeklickt(s); } gezogen = false; });
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft) { return; }
      var chip = freierChip(s.id);
      if (!chip) { return; }
      ziehen(ev, chip, { el: el, ziel: null, gezogen: function () { gezogen = true; } });
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
    var r0 = quelle.el.getBoundingClientRect();
    var griff = { x: Math.min(ev.clientX - r0.left, 24), y: ev.clientY - r0.top };
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
      if (drueber && drueber.el) { drueber.el.classList.remove('ist-drueber'); }
      drueber = z;
      if (drueber && drueber.el) { drueber.el.classList.add('ist-drueber'); }
    }

    /* Hohe Übungen passen nicht auf den Schirm: in der Randzone oben und
       unten rollt die Bühne, je näher am Rand, desto schneller. */
    var buehne = uebung.raster.buehne;
    function rollen() {
      lauf = null;
      if (!geist || !zeiger) { return; }
      var r = buehne.getBoundingClientRect();
      if (zeiger.x < r.left || zeiger.x > r.right) { return; }
      var d = 0;
      if (zeiger.y < r.top + ROLLZONE) { d = zeiger.y - (r.top + ROLLZONE); }
      else if (zeiger.y > r.bottom - ROLLZONE) { d = zeiger.y - (r.bottom - ROLLZONE); }
      if (!d) { return; }
      var vorher = buehne.scrollTop;
      buehne.scrollTop += (d < 0 ? -1 : 1) * Math.max(1, Math.min(24, Math.round(Math.abs(d) / 3)));
      if (buehne.scrollTop === vorher) { return; }
      drueberSetzen(zielUnter(zeiger.x, zeiger.y));
      lauf = global.requestAnimationFrame(rollen);
    }

    /* Die Bewegung hört das Dokument, nicht das Element: ein Zug verlässt es
       sofort, und Pointer Capture kommt nicht überall zuverlässig an. */
    function bewegen(e) {
      if (!geist) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) { return; }
        geist = h('div', { class: 'tr-geist' }, geistBauen(chip));
        document.body.appendChild(geist);
        quelle.el.classList.add('ist-am-ziehen');
        document.body.classList.add('tr-zieht');
        buehne.setAttribute('data-zieht', chip.kategorie);
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
      buehne.removeAttribute('data-zieht');
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
     anderen Kasten oder zurück in den Pool. */
  function zielZiehbar(ziel, el) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch' || uebung.geprueft || !ziel.chip) { return; }
      ev.stopPropagation();
      ziel.gezogen = false;
      ziehen(ev, ziel.chip, { el: el, ziel: ziel, gezogen: function () { ziel.gezogen = true; } });
    });
  }

  /* Der Geist beim Ziehen: das Element so breit wie ein Kasten seiner Art. */
  function geistBauen(chip) {
    var ms = istMeilenstein(chip);
    var ziel = uebung.ziele.filter(function (z) { return z.n.kategorie === chip.kategorie; })[0];
    return h('div', {
      class: 'ra-k ra-k--' + chip.kategorie + (ms ? ' ra-k--meilenstein' : '') + ' tr-geist__k',
      style: ziel ? 'width:' + ziel.el.offsetWidth + 'px' : null
    }, [
      chip.kategorie === 'rolle' ? h('span', { class: 'gswatch gswatch--rolle' }, HT.ui.katSymbol('rolle', 12)) : null,
      ms ? h('span', { class: 'ra-k__ikone' }, h('span', { class: 'ra-ms__raute' })) : null,
      h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(chip.begriff) })
    ]);
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

  /* Das Suchfeld über dem Pool. */
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
    var huelle = h('div', { class: 'suche tr-suche' }, [feld, loeschen, refs.sucheStand]);
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

    refs.pool = h('div', { class: 'tr-pool', 'aria-label': 'Elemente' });
    refs.suche = suchfeld();
    refs.zaehler = h('span', { class: 'tr-zaehler', role: 'status' });
    refs.beste = h('span', { class: 'tr-beste', hidden: true });
    refs.ergebnis = h('div', { class: 'tr-ergebnis', tabindex: '-1', 'aria-live': 'polite', hidden: true });
    refs.reiterZahl = h('span', { class: 'ra-reiter__zahl' });

    refs.knopfPruefen = werkzeug('Prüfen', 'btn btn--primaer', pruefen);
    refs.knopfReset = werkzeug('Zurücksetzen', 'btn', function () { zuruecksetzen(); });
    refs.knopfFortsetzen = werkzeug('Weiter', 'btn btn--primaer', weitermachen, { title: 'Falsch gelegte Elemente zurück in die Auswahl, die richtigen bleiben liegen' });
    refs.knopfNochmals = werkzeug('Von vorne', 'btn btn--primaer', function () { zuruecksetzen(); }, { title: 'Alle Elemente zurück in die Auswahl' });
    var folgende = naechste(def);
    var knopfNaechste = folgende && folgende !== def ? h('a', { class: 'btn', href: folgende.adresse, text: 'Nächste: ' + folgende.name + ' →' }) : null;

    /* Andere leere Arten: neues Raster, was schon liegt und noch einen Kasten hat, bleibt liegen. */
    function neuAufbauen() {
      var vorher = belegung();
      var alt = uebung.raster.buehne;
      var oben = alt.scrollTop, links = alt.scrollLeft;
      uebungStarten(def, vorher);
      refs.seite.parentNode.replaceChild(uebung.raster.buehne, alt);
      uebung.raster.buehne.scrollTop = oben;
      uebung.raster.buehne.scrollLeft = links;
      besteZeigen();
      zeichnen();
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

    /* Wie der Überblick: links das Raster, rechts statt der Inhaltsseite die
       Elemente — oben die Knöpfe und die Suche, darunter rollen Auswertung
       und Pool. */
    refs.seite = h('aside', { class: 'ub-inhalt ra-inhalt tr-seite', 'aria-label': 'Elemente und Auswertung' }, [
      h('div', { class: 'ra-reiter' }, h('span', { class: 'ra-reiter__knopf', 'aria-selected': 'true' }, [h('span', { text: 'Elemente' }), refs.reiterZahl])),
      h('div', { class: 'tr-seite__kopf' }, [
        h('div', { class: 'btn-reihe tr-knoepfe' }, [refs.knopfPruefen, refs.knopfReset, refs.knopfFortsetzen, refs.knopfNochmals, knopfNaechste]),
        refs.suche
      ]),
      h('div', { class: 'ub-inhalt__text tr-seite__text' }, [refs.ergebnis, refs.pool])
    ]);
    var seite = h('section', { class: 'ra tr-uebung', 'data-art': def.art }, [
      uebung.raster.buehne,
      h('div', { class: 'ub-trenner ra-trenner tr-trenner', 'aria-hidden': 'true' }, h('span', { class: 'ub-trenner__strich' })),
      refs.seite
    ]);
    behaelter.appendChild(seite);

    besteZeigen();
    zeichnen();
    groesseAnmelden();
  }

  var groesseAngemeldet = false;
  function groesseAnmelden() {
    if (groesseAngemeldet) { return; }
    groesseAngemeldet = true;
    global.addEventListener('resize', function () { rasterLegen(); });
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
