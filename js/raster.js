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
   die übrigen werden breiter; ein Klick auf Modulkopf oder Phase tut
   dasselbe. Rolle (verantwortlich, beteiligt, beides) und «Nur Entscheide»
   lassen nur die passenden Aufgaben stehen; das Gerüst bleibt, Felder ohne
   Treffer bleiben leer. So beantwortet das Raster etwa: welche Entscheide
   trifft der Projektleiter in welchen Phasen und Modulen? Der Filter steht in
   der Adresse (#/raster?rolle=…&entscheide=1). */
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

  var modelle = {};
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

  /* Der Inhalt eines Feldes nach der Sicht. Mit Aufgaben je Aufgabe ein Block;
     ohne Aufgaben die Ergebnisse, bei eingeblendeten Rollen nach der
     verantwortlichen Rolle gruppiert — jedes Element steht im Feld einmal. */
  function inhaltBauen(bloecke, sicht) {
    if (sicht.aufgabe) {
      return bloecke.map(function (b) {
        var erg = sicht.ergebnis ? ohneMeilensteine(b.ergebnisse) : [];
        return h('div', { class: 'ra-block' }, [
          sicht.rolle && b.rolle ? knoten(b.rolle) : null,
          knoten(b.aufgabe),
          erg.length ? h('div', { class: 'ra-block__ergebnisse' }, erg.map(knoten)) : null
        ]);
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
    return gruppen.map(function (g) {
      if (!g.rolle) { return h('div', { class: 'ra-liste' }, g.ergebnisse.map(knoten)); }
      return h('div', { class: 'ra-block' }, [
        knoten(g.rolle),
        g.ergebnisse.length ? h('div', { class: 'ra-block__ergebnisse' }, g.ergebnisse.map(knoten)) : null
      ]);
    });
  }

  function modulKopf(modul, klasse) {
    var e = HT.daten.eintragMitBegriff(modul, 'modul');
    return h('button', {
      type: 'button', class: 'ra-modul' + (klasse ? ' ' + klasse : ''),
      dataset: { id: e ? e.id : '', modul: modul }, title: 'Modul ' + modul
    }, [
      h('span', { class: 'gswatch gswatch--modul', 'aria-hidden': 'true' }, HT.ui.katSymbol('modul', 12)),
      h('span', { class: 'ra-modul__name', text: HT.gesamtbild.trennen(modul) })
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
      h('button', {
        type: 'button', class: 'ra-phase__name', dataset: { id: e ? e.id : '' }, title: 'Phase ' + z.phase
      }, h('span', { text: z.phase })),
      h('div', { class: 'ra-phase__ms' }, LAGEN.map(function (lage) {
        return h('div', { class: 'ra-ms-gruppe', dataset: { lage: lage } }, z.meilensteine[lage].map(meilensteinBauen));
      }))
    ]);
    el.style.gridRow = String(gitterZeile);
    return el;
  }

  /**
   * Das Raster für einen Ausschnitt (siehe ausschnitt()).
   * aktionen: { modul(name), phase(name) } — Klick auf Modulkopf bzw. Phase.
   */
  function aufbauen(m, a, sicht, f, aktionen) {
    var buehne = h('div', { class: 'ra-buehne' });
    if (!a.zeilen.length || !a.spalten.length) {
      buehne.appendChild(h('p', { class: 'ra-leer', text: 'Keine Phase oder kein Modul gewählt — im Filter wieder alle einschalten.' }));
      return { buehne: buehne, zeigen: function () { return false; } };
    }
    var gitter = h('div', { class: 'ra-gitter', dataset: { vorgehen: m.vorgehen } });
    gitter.style.gridTemplateColumns = 'var(--ra-band) ' + a.spalten.map(function (s) {
      return 'minmax(var(--ra-spalte-min), ' + (GEWICHT[s] || 1) + 'fr)';
    }).join(' ');
    gitter.classList.toggle('hat-filter', trefferFilter(f));

    function kopfTitel(modul) {
      return f.module && f.module.length === 1 && f.module[0] === modul
        ? 'Wieder alle Module zeigen' : 'Modul ' + modul + ' ' + (f.module ? 'dazu- oder wegnehmen' : 'allein zeigen');
    }

    /* Kopfzeile: Ecke und die Modulköpfe. Projektgrundlagen hat nur eine
       eigene Spalte, wenn keine seiner drei gezeigt ist; sonst steht sein
       Kopf in seinem Feld. */
    gitter.appendChild(h('div', { class: 'ra-ecke' }, [
      h('span', { class: 'ra-ecke__text', text: 'Phase · Meilensteine' })
    ]));
    a.spalten.forEach(function (s, i) {
      var kopf = modulKopf(s, 'ra-modul--kopf');
      kopf.title = kopfTitel(s);
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
      var name = band.querySelector('.ra-phase__name');
      name.title = f.phasen && f.phasen.length === 1 && f.phasen[0] === z.phase
        ? 'Wieder alle Phasen zeigen' : 'Phase ' + z.phase + ' ' + (f.phasen ? 'dazu- oder wegnehmen' : 'allein zeigen');
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

    a.felder.forEach(function (x) {
      var leer = !x.bloecke.length;
      var el = h('div', {
        class: 'ra-feld' + (x.breite > 1 ? ' ra-feld--breit' : '') + (leer ? ' ra-feld--leer' : ''),
        dataset: { phase: x.feld.phase, modul: x.feld.modul }
      }, [
        x.kopfImFeld ? modulKopf(x.feld.modul, 'ra-modul--feld') : null,
        leer ? null : h('div', { class: 'ra-feld__inhalt' }, inhaltBauen(x.bloecke, sicht))
      ]);
      el.style.gridRow = String(zeileVon[x.feld.phase]);
      el.style.gridColumn = (x.start + 2) + ' / span ' + x.breite;
      gitter.appendChild(el);
    });

    buehne.appendChild(gitter);

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

    /* Klick auf Modulkopf oder Phase filtert. */
    gitter.addEventListener('click', function (ev) {
      var kopf = ev.target.closest('.ra-modul');
      if (kopf && kopf.dataset.modul) { aktionen.modul(kopf.dataset.modul); return; }
      var phase = ev.target.closest('.ra-phase__name');
      if (phase) { aktionen.phase(phase.closest('.ra-phase').dataset.phase); }
    });

    return {
      buehne: buehne,
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

  function infoInhalt() {
    return [
      h('p', { text: 'Entwurf: das Gesamtbild der Methode wie Abbildung 1 des Referenzhandbuchs — Phasen als Zeilen, Module als Spalten — in der Bildsprache des Graphen.' }),
      h('p', { text: 'Das Gerüst steht fest: links die Phasen mit ihren Meilensteinen (die Freigabe, die eine Phase öffnet, oben; die Entscheide, mit denen sie endet, unten an der Grenze zur nächsten Phase; modulspezifische dazwischen), oben die Module. Projektsteuerung und Projektführung haben je eine eigene Spalte, Projektgrundlagen liegt in der Initialisierung über drei.' }),
      h('p', { text: 'Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln einblenden. Mit Aufgaben steht je Aufgabe die verantwortliche Rolle darüber und die Ergebnisse, die sie in diesem Feld erzeugt, darunter. Zeigen auf ein Element hebt jede seiner Stellen hervor.' }),
      h('p', { text: 'Filter (Icon neben der Suche): Phasen und Module blenden Zeilen und Spalten aus — die übrigen werden breiter. Ein Klick auf einen Modulkopf oder eine Phase tut dasselbe; ein zweiter Klick zeigt wieder alle. Eine Rolle (verantwortlich, beteiligt oder beides) und «Nur Entscheide» lassen nur die passenden Aufgaben stehen; Felder ohne Treffer bleiben leer, Meilensteine, die keine dieser Aufgaben erreicht, treten zurück. Der Filter steht in der Adresse und lässt sich so teilen.' })
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
    HT.app.kopfWerkzeug(filterKnopf);

    function adresseSetzen() {
      var q = (vorgehen === 'agil' ? ['vorgehen=agil'] : []).concat(filterAlsQuery(filter));
      global.history.replaceState(null, '', '#/raster' + (q.length ? '?' + q.join('&') : ''));
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
      phase: function (name) { listeSchalten('phasen', name, m.phasen); }
    };

    /* --- Popover --- */

    function abschnitt(titel, inhalt, klasse) {
      return h('section', { class: 'gaf' + (klasse ? ' ' + klasse : '') }, [
        h('div', { class: 'gaf__kopf' }, h('h3', { class: 'gaf__titel', text: titel })),
        inhalt
      ]);
    }

    function segment(optionen, wert, beiWahl, label) {
      return h('div', { class: 'segment', role: 'group', 'aria-label': label }, optionen.map(function (o) {
        return h('button', {
          type: 'button', class: 'segment__knopf', text: o.label, 'aria-pressed': o.key === wert ? 'true' : 'false',
          'data-fokus': label + ':' + o.key,
          on: { click: function () { if (o.key !== wert) { beiWahl(o.key); } } }
        });
      }));
    }

    function haken(feld, name, alle, zahl) {
      var an = gezeigt(filter[feld], name);
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': feld + ':' + name });
      kasten.checked = an;
      kasten.addEventListener('change', function () {
        var l = filter[feld] ? filter[feld].slice() : alle.slice();
        var i = l.indexOf(name);
        if (kasten.checked && i === -1) { l.push(name); }
        if (!kasten.checked && i !== -1) { l.splice(i, 1); }
        filter[feld] = alle.every(function (n) { return l.indexOf(n) !== -1; }) ? null : l;
        geaendert();
      });
      return h('label', { class: 'gs-schalter' }, [
        kasten,
        h('span', { class: 'gs-schalter__label', text: name }),
        zahl === undefined ? null : h('span', { class: 'gs-schalter__extra', text: String(zahl) })
      ]);
    }

    function alleKasten(feld, label) {
      var l = filter[feld];
      var kasten = h('input', { type: 'checkbox', class: 'gs-schalter__eingabe', 'data-fokus': 'alle:' + feld, title: 'Alle ' + label });
      kasten.checked = !l;
      kasten.indeterminate = !!l && l.length > 0;
      kasten.addEventListener('change', function () { filter[feld] = kasten.checked ? null : []; geaendert(); });
      return h('label', { class: 'gs-schalter' }, [kasten, h('span', { class: 'gs-schalter__label', text: 'Alle ' + label })]);
    }

    /* Wahl aus einer Liste, die sich ausschliesst (Szenario, Rolle): Punkt
       vorn, ein zweiter Klick hebt sie auf. */
    function wahl(titel, an, zahl, beiKlick, fokus) {
      return h('button', {
        type: 'button', class: 'gaf__szenario', 'aria-pressed': an ? 'true' : 'false', 'data-fokus': fokus,
        on: { click: beiKlick }
      }, [
        h('span', { class: 'gaf__szenario-haken', 'aria-hidden': 'true', text: an ? '●' : '○' }),
        h('span', { class: 'gaf__szenario-titel', text: titel }),
        zahl === undefined ? null : h('span', { class: 'gs-schalter__extra', text: String(zahl) })
      ]);
    }

    function trefferText() {
      if (!a) { return ''; }
      var t = a.treffer;
      var was = filter.entscheide ? (t.aufgaben === 1 ? 'Entscheid' : 'Entscheide') : (t.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben');
      return t.aufgaben + ' ' + was + ' in ' + t.phasen + (t.phasen === 1 ? ' Phase' : ' Phasen') + ' und '
        + t.module + (t.module === 1 ? ' Modul' : ' Modulen');
    }

    function popInhalt() {
      var module = alleModule();
      var jeRolle = aufgabenJeRolle(m, filter);
      var szenarien = HT.daten.eintraegeDerKategorie('szenario').map(function (sz) {
        var mods = HT.graph.szenarioModule(sz.id) || [];
        var an = !!filter.module && filter.module.length === mods.length && mods.every(function (x) { return filter.module.indexOf(x) !== -1; });
        return wahl(sz.begriff, an, mods.length, function () { filter.module = an ? null : mods.slice(); geaendert(); }, 'sz:' + sz.id);
      });
      var rollen = HT.daten.eintraegeDerKategorie('rolle').map(function (r) { return r.begriff; })
        .filter(function (name) { return jeRolle[name] > 0 || filter.rolle === name; })
        .sort(function (x, y) { return jeRolle[y] - jeRolle[x] || x.localeCompare(y, 'de'); });

      return h('div', { class: 'gpop__inhalt' }, [
        h('p', { class: 'ra-pop__treffer', role: 'status' }, [
          h('strong', { text: trefferText() }),
          filterAktiv(filter) ? h('button', {
            type: 'button', class: 'gauswahl__reset', text: 'Alle Filter aufheben',
            on: { click: function () { filter = leererFilter(); geaendert(); } }
          }) : null
        ]),
        h('div', { class: 'gaf-raster ra-pop__raster' }, [
          h('div', { class: 'gaf-spalte' }, [
            abschnitt('Vorgehensweise', segment([{ key: 'klassisch', label: 'Klassisch' }, { key: 'agil', label: 'Agil' }], vorgehen, function (k) {
              vorgehen = k;
              filter.phasen = null;
              geaendert();
            }, 'Vorgehensweise')),
            abschnitt('Aufgaben', segment([{ key: 'alle', label: 'Alle' }, { key: 'entscheide', label: 'Nur Entscheide' }], filter.entscheide ? 'entscheide' : 'alle', function (k) {
              filter.entscheide = k === 'entscheide';
              /* Ein Filter auf Aufgaben braucht die Aufgaben im Bild. */
              if (filter.entscheide && !sicht.aufgabe) { sicht.aufgabe = true; sichtSpeichern(sicht); }
              geaendert();
            }, 'Aufgaben'))
          ]),
          abschnitt('Phasen', h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Phasen' },
            [alleKasten('phasen', 'Phasen')].concat(m.phasen.map(function (p) { return haken('phasen', p, m.phasen); })))),
          abschnitt('Szenarien', h('div', { class: 'gs-liste', role: 'group', 'aria-label': 'Szenarien' }, szenarien)),
          abschnitt('Module', h('div', { class: 'gs-liste gs-liste--zwei', role: 'group', 'aria-label': 'Module' },
            [alleKasten('module', 'Module'), h('span', { 'aria-hidden': 'true' })].concat(module.map(function (x) { return haken('module', x, module); }))), 'gaf--module'),
          abschnitt('Rolle', h('div', { class: 'ra-pop__rolle' }, [
            segment(BEZUEGE, filter.bezug, function (k) { filter.bezug = k; geaendert(); }, 'Bezug der Rolle'),
            h('div', { class: 'gs-liste ra-pop__rollen', role: 'group', 'aria-label': 'Rolle' }, rollen.map(function (name) {
              var an = filter.rolle === name;
              return wahl(name, an, jeRolle[name], function () { filter.rolle = an ? '' : name; geaendert(); }, 'rolle:' + name);
            }))
          ]), 'ra-pop__rollenabschnitt')
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
      filterKnopf.title = filterAktiv(filter) ? 'Filter: ' + trefferText() : 'Filter: Phasen, Module, Rolle, Entscheide';
      if (pop.hidden) { return; }
      pop.appendChild(h('div', { class: 'gpop__kopf' }, [
        h('strong', { class: 'gpop__titel', text: 'Filter' }),
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Filter schliessen', text: '✕', on: { click: function () { popOffen = false; popZeichnen(); filterKnopf.focus(); } } })
      ]));
      pop.appendChild(popInhalt());
      pop.scrollTop = scroll;
      var wieder = fokusKey ? pop.querySelector('[data-fokus="' + fokusKey.replace(/"/g, '') + '"]') : null;
      if (wieder) { wieder.focus({ preventScroll: true }); }
      else if (fokusSetzen) { var erstes = pop.querySelector('.gpop__inhalt button, .gpop__inhalt input'); if (erstes) { erstes.focus(); } }
    }

    /* Klick daneben und Escape schliessen. */
    function draussen(ev) {
      if (!document.body.contains(huelle)) {
        document.removeEventListener('pointerdown', draussen, true);
        document.removeEventListener('keydown', taste);
        return;
      }
      if (!popOffen) { return; }
      if (pop.contains(ev.target) || filterKnopf.contains(ev.target)) { return; }
      popOffen = false;
      popZeichnen();
    }
    function taste(ev) {
      if (ev.key === 'Escape' && popOffen && document.body.contains(huelle)) { popOffen = false; popZeichnen(); filterKnopf.focus(); }
    }
    document.addEventListener('pointerdown', draussen, true);
    document.addEventListener('keydown', taste);

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
        ],
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
      else { HT.ui.leeren(huelle); huelle.appendChild(laufende.buehne); huelle.appendChild(pop); }
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
      return !!(laufende && document.body.contains(laufende.buehne) && laufende.zeigen(e.id));
    }
  };
}(window));
