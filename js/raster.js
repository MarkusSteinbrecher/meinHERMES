/* meinHERMES — Raster: Gesamtbild und Graph in einer Ansicht.
   Entwurf, vorerst nur unter #/raster (nicht in der Navigation).

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
   im Zuordnen des Trainers (HT.graph.bloecke). Die Meilensteine stehen nur
   im Phasenband, nicht noch einmal im Feld.

   Zeigen auf ein Element hebt jede seiner Stellen hervor; Zeigen auf einen
   Meilenstein das Feld, in dem er entsteht.

   Filter (Icon in der Kopfzeile neben der Suche, Popover im Stil «Alle
   Filter» des Graphen): Phasen und Module blenden Zeilen und Spalten aus,
   die übrigen werden breiter; der Trichter an Modulkopf oder Phase tut
   dasselbe. Rolle (verantwortlich, beteiligt, beides) und «Nur Entscheide»
   lassen nur die passenden Aufgaben stehen; das Gerüst bleibt, Felder ohne
   Treffer bleiben leer. So beantwortet das Raster etwa: welche Entscheide
   trifft der Projektleiter in welchen Phasen und Modulen? Der Filter steht in
   der Adresse (#/raster?rolle=…&entscheide=1).

   Inhaltsseite rechts (Icon neben dem Filter): Ein Klick auf ein Element,
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

  var SPEICHER = 'raster-sicht';
  var STANDARD = { rolle: false, aufgabe: false, ergebnis: true };

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
      if (s && typeof s === 'object') {
        return { rolle: !!s.rolle, aufgabe: !!s.aufgabe, ergebnis: !!s.ergebnis };
      }
    } catch (e) { /* ohne Speicher gilt der Standard */ }
    return { rolle: STANDARD.rolle, aufgabe: STANDARD.aufgabe, ergebnis: STANDARD.ergebnis };
  }

  function sichtSpeichern(sicht) {
    try { global.localStorage.setItem(SPEICHER, JSON.stringify(sicht)); } catch (e) { /* egal */ }
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
  function ausschnitt(m, f) {
    var zeilen = m.zeilen.filter(function (z) { return gezeigt(f.phasen, z.phase); });
    var spalten = SPALTEN.filter(function (s) { return gezeigt(f.module, s); });
    var pgUnter = ['Organisation', 'Produkt', 'IT-System'].filter(function (s) { return spalten.indexOf(s) !== -1; });
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
      var start, breite, kopfImFeld = false;
      if (feld.modul === 'Projektgrundlagen' && !pgEigen) {
        if (!pgUnter.length) { return; }
        start = spalten.indexOf(pgUnter[0]);
        breite = pgUnter.length;
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

  /* --- Bauen ----------------------------------------------------------------- */

  /* Ein Element in der Bildsprache des Graphen: farbiger Kreis mit dem
     Zeichen der Kategorie, daneben der Name; Aufgabe und Ergebnis im Kasten
     ihrer Farbe, die Rolle ohne Kasten. */
  function knoten(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    var kat = k.kategorie;
    var zustand = kat === 'ergebnis' && e && e.typ === 'Zustand';
    return h('button', {
      type: 'button',
      class: 'ra-k ra-k--' + kat + (zustand ? ' ra-k--zustand' : ''),
      dataset: { id: k.id },
      title: k.begriff
    }, [
      h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 12)),
      h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(k.begriff) })
    ]);
  }

  function ohneMeilensteine(liste) {
    return liste.filter(function (k) { return !istMeilenstein(k); });
  }

  /* Der Inhalt eines Feldes nach der Sicht, als Stücke { key, el }. Mit
     Aufgaben je Aufgabe ein Block; ohne Aufgaben die Ergebnisse einzeln oder,
     bei eingeblendeten Rollen, nach der verantwortlichen Rolle gruppiert —
     jedes Element steht im Feld einmal. Der Schlüssel ist in jeder Phase
     derselbe, damit ein Stück in allen Feldern seiner Spalte an derselben
     Stelle steht (spurenLegen). */
  function inhaltBauen(bloecke, sicht) {
    if (sicht.aufgabe) {
      return bloecke.map(function (b) {
        var erg = sicht.ergebnis ? ohneMeilensteine(b.ergebnisse) : [];
        return { key: 'a:' + b.aufgabe.id, el: h('div', { class: 'ra-block' }, [
          sicht.rolle && b.rolle ? knoten(b.rolle) : null,
          knoten(b.aufgabe),
          erg.length ? h('div', { class: 'ra-block__ergebnisse' }, erg.map(knoten)) : null
        ]) };
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
      ohneMeilensteine(b.ergebnisse).forEach(function (k) {
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
      stuecke.push({ key: 'r:' + g.rolle.id, el: h('div', { class: 'ra-block' }, [
        knoten(g.rolle),
        g.ergebnisse.length ? h('div', { class: 'ra-block__ergebnisse' }, g.ergebnisse.map(knoten)) : null
      ]) });
    });
    return stuecke;
  }

  /* --- Spuren: dasselbe Stück in jeder Phase an derselben Stelle -------------- */

  /* Die Felder einer Spalte teilen eine Reihenfolge: jedes Stück bekommt den
     Mittelwert seiner Stellen in den Feldern, in denen es steht (die Folge der
     Abbildung 1 je Feld), Gleichstand nach dem ersten Vorkommen. So steht
     «Projekt führen und kontrollieren» in der Initialisierung nicht unten
     und ab dem Konzept oben, sondern überall an derselben Stelle der Folge. */
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

  function modulKopf(modul, klasse) {
    var e = HT.daten.eintragMitBegriff(modul, 'modul');
    return h('div', { class: 'ra-modulkopf' + (klasse ? ' ' + klasse : '') }, [
      h('button', {
        type: 'button', class: 'ra-modul',
        dataset: { id: e ? e.id : '', modul: modul }, title: 'Modul ' + modul + ' — Seite zeigen'
      }, [
        h('span', { class: 'gswatch gswatch--modul', 'aria-hidden': 'true' }, HT.ui.katSymbol('modul', 12)),
        h('span', { class: 'ra-modul__name', text: HT.gesamtbild.trennen(modul) })
      ]),
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

  function phaseBauen(z, gitterZeile) {
    var e = HT.daten.eintragMitBegriff(z.phase, 'phase');
    var el = h('div', { class: 'ra-phase', dataset: { phase: z.phase } }, [
      h('div', { class: 'ra-phase__streifen' }, [
        h('button', {
          type: 'button', class: 'ra-phase__name', dataset: { id: e ? e.id : '' }, title: 'Phase ' + z.phase + ' — Seite zeigen'
        }, h('span', { text: z.phase })),
        trichter('phase', z.phase)
      ]),
      h('div', { class: 'ra-phase__ms' }, LAGEN.map(function (lage) {
        return h('div', { class: 'ra-ms-gruppe', dataset: { lage: lage } }, z.meilensteine[lage].map(meilensteinBauen));
      }))
    ]);
    el.style.gridRow = String(gitterZeile);
    return el;
  }

  /**
   * Das Raster für einen Ausschnitt (siehe ausschnitt()).
   * aktionen: { modul(name), phase(name) } — Trichter an Modulkopf bzw. Phase;
   *   waehlen(id) — Klick auf ein Element, einen Modulkopf, eine Phase.
   */
  function aufbauen(m, a, sicht, f, aktionen) {
    var buehne = h('div', { class: 'ra-buehne' });
    if (!a.zeilen.length || !a.spalten.length) {
      buehne.appendChild(h('p', { class: 'ra-leer', text: 'Keine Phase oder kein Modul gewählt — im Filter wieder alle einschalten.' }));
      var nichts = function () { return false; };
      return { buehne: buehne, spurenLegen: nichts, zeigen: nichts, gewaehlt: nichts, stelleZeigen: nichts };
    }
    var gitter = h('div', { class: 'ra-gitter', dataset: { vorgehen: m.vorgehen } });
    gitter.style.gridTemplateColumns = 'var(--ra-band) ' + a.spalten.map(function (s) {
      return 'minmax(var(--ra-spalte-min), ' + (GEWICHT[s] || 1) + 'fr)';
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
      var kopf = modulKopf(s, 'ra-modulkopf--kopf');
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
      var band = phaseBauen(z, zeile);
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

    /* Je Spalte (Modul) ihre Felder; die Stücke darin in der gemeinsamen
       Reihenfolge, auf Spuren verteilt erst, wenn die Breite bekannt ist. */
    var spalten = {}, spaltenReihe = [];
    a.felder.forEach(function (x) {
      var leer = !x.bloecke.length;
      var stuecke = leer ? [] : inhaltBauen(x.bloecke, sicht);
      var inhalt = leer ? null : h('div', { class: 'ra-feld__inhalt' + (!sicht.aufgabe && !sicht.rolle ? ' ra-feld__inhalt--liste' : '') });
      var el = h('div', {
        class: 'ra-feld' + (x.breite > 1 ? ' ra-feld--breit' : '') + (leer ? ' ra-feld--leer' : ''),
        dataset: { phase: x.feld.phase, modul: x.feld.modul }
      }, [
        x.kopfImFeld ? modulKopf(x.feld.modul, 'ra-modulkopf--feld') : null,
        inhalt
      ]);
      if (inhalt) {
        var sp = spalten[x.feld.modul];
        if (!sp) { sp = spalten[x.feld.modul] = { modul: x.feld.modul, breit: x.breite > 1, felder: [], anzahl: 0 }; spaltenReihe.push(sp); }
        var index = {};
        stuecke.forEach(function (st) { index[st.key] = st; });
        sp.felder.push({ inhalt: inhalt, stuecke: stuecke, index: index });
      }
      el.style.gridRow = String(zeileVon[x.feld.phase]);
      el.style.gridColumn = (x.start + 2) + ' / span ' + x.breite;
      gitter.appendChild(el);
    });

    /* Eine Spalte mit nur einem Feld (Projektgrundlagen) hat nichts, womit
       sie übereinstimmen müsste: ihr Inhalt fliesst in CSS-Spalten. */
    spaltenReihe = spaltenReihe.filter(function (sp) {
      sp.keys = spalteOrdnen(sp.felder);
      sp.felder.forEach(function (f) { spurenFuellen(f, 1, null); });
      sp.anzahl = 1;
      if (sp.felder.length === 1) { sp.felder[0].inhalt.classList.add('ra-feld__inhalt--fluss'); }
      return sp.felder.length > 1;
    });

    buehne.appendChild(gitter);

    /* Steht ein Ergebnis im Feld unter mehreren Aufgaben (der
       Projektmanagementplan im Konzept unter sechs), bleibt das erste
       Vorkommen kräftig, die weiteren treten zurück. Erstes heisst: wie man
       liest — Spur für Spur von links, darin von oben. */
    function wiederholungenDaempfen(f) {
      var gesehen = {};
      Array.prototype.forEach.call(f.inhalt.querySelectorAll('.ra-k--ergebnis'), function (k) {
        k.classList.toggle('ra-k--wieder', !!gesehen[k.dataset.id]);
        gesehen[k.dataset.id] = true;
      });
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
    function spurenLegen(zusatz) {
      /* Die Breiten hängen nur an den gezeigten Spalten, der Fensterbreite
         und der Breite der Inhaltsseite (zusatz) — die Spuren haben eine feste
         Mindestbreite, der Inhalt zählt nicht: beim Umschalten von Rollen,
         Aufgaben, Ergebnissen gilt die letzte Messung weiter und erspart ein
         ganzes Layout. */
      var schluessel = a.spalten.join('|') + '@' + zusatz;
      if (!breiten || breiten.schluessel !== schluessel) { breiten = { schluessel: schluessel, werte: {} }; }
      var neu = spaltenReihe.filter(function (sp) {
        var min = sp.breit ? 100 : 190, abstand = sp.breit ? 6 : 8;
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
      if (!ziel) { return; }
      var id = ziel.dataset.id;
      if (id) {
        Array.prototype.forEach.call(gitter.querySelectorAll('[data-id="' + id + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
      if (ziel.classList.contains('ra-ms')) {
        var phase = ziel.closest('.ra-phase').dataset.phase;
        ziel.dataset.module.split('|').forEach(function (modul) {
          var feld = gitter.querySelector('.ra-feld[data-phase="' + phase + '"][data-modul="' + modul + '"]');
          if (feld) { feld.classList.add('ist-gleich'); }
        });
      } else if (ziel.classList.contains('ra-modul')) {
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-modul="' + ziel.dataset.modul + '"]'), function (x) { x.classList.add('ist-gleich'); });
      } else if (ziel.classList.contains('ra-phase__name')) {
        var p = ziel.closest('.ra-phase').dataset.phase;
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-phase="' + p + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
    }
    function zielAus(el) {
      return el && el.closest ? el.closest('.ra-k, .ra-ms, .ra-modul, .ra-phase__name') : null;
    }
    gitter.addEventListener('mouseover', function (ev) { markieren(zielAus(ev.target)); });
    gitter.addEventListener('mouseleave', function () { markieren(null); });
    gitter.addEventListener('focusin', function (ev) { markieren(zielAus(ev.target)); });

    /* Klick auf den Trichter filtert; auf ein Element, einen Modulkopf oder
       eine Phase wählt es für die Inhaltsseite. */
    gitter.addEventListener('click', function (ev) {
      var t = ev.target.closest('.ra-trichter');
      if (t) { aktionen[t.dataset.art](t.dataset.name); return; }
      var ziel = zielAus(ev.target);
      if (ziel && ziel.dataset.id) { aktionen.waehlen(ziel.dataset.id); }
    });

    /* Die Auswahl bleibt markiert, an jeder ihrer Stellen. */
    function gewaehlt(id) {
      Array.prototype.forEach.call(gitter.querySelectorAll('.ist-gewaehlt'), function (x) { x.classList.remove('ist-gewaehlt'); });
      if (!id) { return; }
      Array.prototype.forEach.call(gitter.querySelectorAll('[data-id="' + id + '"]'), function (x) { x.classList.add('ist-gewaehlt'); });
    }

    /* Aus der Inhaltsseite: eine Stelle anspringen — das Element im Feld,
       sonst das Feld, ohne Modul die Phase — und kurz aufleuchten lassen. */
    function stelleZeigen(phase, modul, id) {
      var el = null;
      if (modul) {
        var feld = gitter.querySelector('.ra-feld[data-phase="' + phase + '"][data-modul="' + modul + '"]');
        el = (feld && id && feld.querySelector('[data-id="' + id + '"]')) || feld;
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
      zeigen: function (id) {
        var el = gitter.querySelector('[data-id="' + id + '"]');
        if (!el) { return false; }
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        el.focus({ preventScroll: true });
        return true;
      }
    };
  }

  /* --- Ansicht ----------------------------------------------------------------- */

  var IKONE_FILTER = ['M3.5 5h17', 'M6.5 12h11', 'M10 19h4'];
  var IKONE_SEITE = ['M4 5h16v14H4Z', 'M14.5 5v14'];

  function infoInhalt() {
    return [
      h('p', { text: 'Entwurf: das Gesamtbild der Methode wie Abbildung 1 des Referenzhandbuchs — Phasen als Zeilen, Module als Spalten — in der Bildsprache des Graphen.' }),
      h('p', { text: 'Das Gerüst steht fest: links die Phasen mit ihren Meilensteinen (die Freigabe, die eine Phase öffnet, oben; die Entscheide, mit denen sie endet, unten an der Grenze zur nächsten Phase; modulspezifische dazwischen), oben die Module. Projektsteuerung und Projektführung haben je eine eigene Spalte, Projektgrundlagen liegt in der Initialisierung über drei.' }),
      h('p', { text: 'Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln einblenden. Mit Aufgaben steht je Aufgabe die verantwortliche Rolle darüber und die Ergebnisse, die sie in diesem Feld erzeugt, darunter. Zeigen auf ein Element hebt jede seiner Stellen hervor. Die Felder eines Moduls teilen eine Reihenfolge: dieselbe Aufgabe, dasselbe Ergebnis steht in jeder Phase an derselben Stelle — in einem breiten Feld auch in derselben Spur. Steht ein Ergebnis im Feld unter mehreren Aufgaben, ist nur das erste Vorkommen kräftig, die weiteren sind blass.' }),
      h('p', { text: 'Filter (Icon neben der Suche): Ist etwas gefiltert, nennt es die rote Pille in der Leiste; ein Klick darauf öffnet den Filter, × hebt ihn auf. Phasen und Module blenden Zeilen und Spalten aus — die übrigen werden breiter. Der Trichter neben einem Modulkopf oder einer Phase tut dasselbe; ein zweiter Klick zeigt wieder alle. Eine Rolle (die drei Linien: verantwortlich, beteiligt oder beides) und «Nur Entscheide» (Raute) lassen nur die passenden Aufgaben stehen; Felder ohne Treffer bleiben leer, Meilensteine, die keine dieser Aufgaben erreicht, treten zurück. Der Filter steht in der Adresse und lässt sich so teilen.' }),
      h('p', { text: 'Inhaltsseite (Icon neben dem Filter, Trennlinie ziehbar): Ein Klick auf ein Element, eine Phase oder einen Modulkopf zeigt seine Seite aus dem Handbuch und darunter «Im Raster» — wo es überall steht; eine Zeile springt ins Feld, ein Name wählt das Element. Ein zweiter Klick oder Esc hebt die Auswahl auf. Ohne Auswahl stehen dort bei gesetztem Filter seine Treffer, Phase für Phase.' })
    ];
  }

  function render(behaelter, params) {
    var vorgehen = params.vorgehen === 'agil' ? 'agil' : 'klassisch';
    var sicht = sichtLesen();
    var filter = filterAusParams(params);
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
    var gezeichnet = null;
    var seiteText = h('div', { class: 'ub-inhalt__text ra-inhalt__text' });
    var seite = h('aside', { class: 'ub-inhalt ra-inhalt', 'aria-label': 'Inhaltsseite' }, seiteText);
    var trenner = h('div', {
      class: 'ub-trenner ra-trenner', role: 'separator', 'aria-orientation': 'vertical',
      'aria-label': 'Breite der Inhaltsseite', tabindex: '0',
      title: 'Ziehen ändert die Breite · Doppelklick setzt zurück'
    }, h('span', { class: 'ub-trenner__strich', 'aria-hidden': 'true' }));
    var seiteKnopf = h('button', {
      type: 'button', class: 'graph-werkzeug ra-seiteknopf',
      on: { click: function () { seiteOeffnen(!seiteZustand.offen); } }
    }, HT.ui.symbol(IKONE_SEITE, 18));
    HT.app.kopfWerkzeug(h('span', { class: 'ra-werkzeuge' }, [filterKnopf, seiteKnopf]));

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
      if (auswahl && !seiteZustand.offen) { seiteOeffnen(true); }
      adresseSetzen();
      if (laufende) { laufende.gewaehlt(auswahl ? auswahl.id : null); }
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
      global.history.replaceState(null, '', '#/raster' + (q.length ? '?' + q.join('&') : ''));
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
      var sichtbar = gezeigt(filter.phasen, phase) && (!modul || gezeigt(filter.module, modul));
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
            zahlText(n, 'Aufgabe', 'Aufgaben'),
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
        h('p', { class: 'ub-leerseite__text', text: 'Ein Klick auf eine Aufgabe, ein Ergebnis, eine Rolle, einen Meilenstein, eine Phase oder einen Modulkopf zeigt hier seine Seite und wo es im Raster steht. Ist ein Filter gesetzt, stehen hier seine Treffer.' })
      ].concat(HT.inhaltsseite.legende()))];
    }

    function inhaltZeichnen() {
      if (!m || !a) { return; }
      var vorher = seiteText.scrollTop;
      HT.ui.leeren(seiteText);
      var e = auswahl, teile, schluessel;
      /* Ort für Markierungen — derselbe wie die Karte im Handbuch. */
      if (e) { seiteText.dataset.markOrt = '#/handbuch?id=' + encodeURIComponent(e.id); }
      else { delete seiteText.dataset.markOrt; }
      if (e) {
        teile = HT.inhaltsseite.seite(e, {
          beiGeladen: function (id) { if (auswahl && auswahl.id === id && document.body.contains(huelle)) { inhaltZeichnen(); } }
        });
        var zeile = teile[0].querySelector('.ub-kopf__zeile');
        if (zeile) {
          zeile.appendChild(h('button', {
            type: 'button', class: 'ra-inhalt__zu', 'aria-label': 'Auswahl aufheben', title: 'Auswahl aufheben (Esc)', text: '×',
            on: { click: function () { waehlen(null); } }
          }));
        }
        var ort = imRaster(e);
        if (ort) { teile.splice(1, 0, ort); }
        teile.push(HT.inhaltsseite.verweise(e));
        schluessel = e.id;
      } else if (filterAktiv(filter)) {
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
      waehlen: function (id) { waehlen(id, true); }
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
      pop.hidden = !popOffen || !m;
      filterKnopf.setAttribute('aria-expanded', popOffen ? 'true' : 'false');
      filterKnopf.classList.toggle('ist-aktiv', filterAktiv(filter));
      filterKnopf.title = filterAktiv(filter) ? 'Filter: ' + filterText() : 'Filter: Phasen, Module, Rolle, Entscheide';
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
      if (ev.key !== 'Escape' || !document.body.contains(huelle)) { return; }
      if (popOffen) { popOffen = false; popZeichnen(); filterKnopf.focus(); return; }
      if (auswahl && !(ev.target.closest && ev.target.closest('input, textarea'))) { waehlen(null); }
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
          h('span', { class: 'lk-leiste__titel' }, [
            h('span', { text: 'Gesamtbild' }),
            h('span', { class: 'lk-leiste__entwurf', text: 'Entwurf' })
          ]),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'segment', role: 'group', 'aria-label': 'Vorgehensweise' },
            [['klassisch', 'Klassisch'], ['agil', 'Agil']].map(function (o) {
              return h('button', {
                type: 'button', class: 'segment__knopf', text: o[1], 'aria-pressed': o[0] === vorgehen ? 'true' : 'false',
                on: { click: function () {
                  if (o[0] === vorgehen) { return; }
                  vorgehen = o[0];
                  filter.phasen = null;
                  geaendert();
                } }
              });
            })),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'gauswahl' }, h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Elemente ein- und ausblenden' },
            KAT_REIHE.map(function (kat) {
              var an = !!sicht[kat];
              return h('button', {
                type: 'button', class: 'grail__knopf grail__knopf--' + kat,
                'aria-pressed': an ? 'true' : 'false',
                title: KAT_LABEL[kat] + ' — ' + (an ? 'ausblenden' : 'einblenden'),
                on: { click: function () {
                  sicht[kat] = !sicht[kat];
                  sichtSpeichern(sicht);
                  zeichnen();
                } }
              }, [
                h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 13)),
                h('span', { class: 'gauswahl__name', text: KAT_LABEL[kat] }),
                z ? h('span', { class: 'grail__zahl', text: String(z[kat]) }) : null
              ]);
            })))
        ].concat(filterAktiv(filter) ? [
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
        info: { titel: 'Gesamtbild', inhalt: infoInhalt }
      });
    }

    function zeichnen() {
      if (!document.body.contains(huelle)) { return; }
      m = modell(vorgehen);
      a = ausschnitt(m, filter);
      var alt = laufende && huelle.contains(laufende.buehne) ? laufende.buehne : null;
      var oben = alt ? alt.scrollTop : 0;
      laufende = aufbauen(m, a, sicht, filter, aktionen);
      if (alt) { huelle.replaceChild(laufende.buehne, alt); }
      else {
        HT.ui.leeren(huelle);
        [laufende.buehne, trenner, seite, pop].forEach(function (x) { huelle.appendChild(x); });
      }
      laufende.gewaehlt(auswahl ? auswahl.id : null);
      laufende.spurenLegen(breitenSchluessel());
      inhaltZeichnen();
      laufende.buehne.scrollTop = oben;
      leisteSetzen();
      popZeichnen();
    }

    leisteSetzen();
    lagenLaden().then(function () {
      if (!document.body.contains(huelle)) { return; }
      modelle = {};
      zeichnen();
      if (params.id) { laufende.zeigen(params.id); }
    });
  }

  HT.views.raster = {
    titel: 'Gesamtbild (Entwurf)',
    nav: 'ueberblick',
    render: render,
    suchtreffer: function (e) {
      return !!(laufende && document.body.contains(laufende.buehne) && wahlVonAussen && wahlVonAussen(e));
    }
  };
}(window));
