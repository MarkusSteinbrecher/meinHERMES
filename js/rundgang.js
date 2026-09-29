/* meinHERMES — Rundgang durch das Raster (js/raster.js), Entwurf.

   Vier Wege Schritt für Schritt durch die Methode; links zeigt das Raster,
   worum es geht, rechts in der Inhaltsseite steht, was es bedeutet:
   - Entlang der Ergebnisse: der Fluss der Abbildung 1, Phase für Phase,
     ein Schritt je Kasten der Abbildung.
   - Phase für Phase: je Phase ihr Auftrag, dann jedes Modul mit seinen
     Aufgaben, verantwortlichen Rollen und Ergebnissen, am Ende die
     Entscheide, mit denen sie schliesst.
   - Rolle für Rolle: was jede Rolle verantwortet, die drei Pflichtrollen
     auch Phase für Phase (Deep Dive «Aus Sicht der Rollen»).
   - Besonderheiten: spezielle Themen (vom System zum Betrieb, Abnahmen,
     Protokolle, Prüfungen) — die Elemente dazu, wo sie stehen und was das
     Handbuch über sie sagt.

   Die Texte sind wörtliche Zitate (zitate): der Anfang der Elementseite
   von hermes.admin.ch — dieselbe Seite wie im Reiter «Handbuch» — oder
   Abschnitte des Referenzhandbuchs, auf die sich die Folien des Lernpfads
   stützen (data/lernpfad.json, quelle). Eigene Sätze (hinweis) sagen nur,
   was das Raster zeigt, oder zählen aus den Daten. Dazu die Ketten
   Rolle → Aufgabe → Ergebnis aus den Daten. Ein Schritt:
     { key, kapitel, titel, kicker, element, zitate: [{ element, abschnitt } | { rhb, nummer }],
       hinweis: [text], ketten: [{ wo, phase, modul, rolle, aufgabe, ergebnisse, beteiligt }],
       kettenTitel, fakten: [{ titel, zeilen: [{ wo, phase, modul, k, text, links, ms }] }],
       sicht: { rolle, aufgabe, ergebnis, pfeile }, filter: { phasen, module, rolle, bezug },
       ziel: { ids, felder: [[phase, modul]], phasen, module, nummern? } | null }
   Schritte, deren Stellen es in der Vorgehensweise nicht gibt, fallen weg
   (Konzept agil, Umsetzungsorganisation klassisch). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  var DATEI = 'data/lernpfad.json';
  var geladen = null;

  var AGIL_PHASE = { Konzept: 'Umsetzung', Realisierung: 'Umsetzung', 'Einführung': 'Umsetzung' };
  var GENITIV = { Initialisierung: 'der Initialisierung', Konzept: 'des Konzepts', Realisierung: 'der Realisierung',
    'Einführung': 'der Einführung', Umsetzung: 'der Umsetzung', Abschluss: 'des Abschlusses' };

  var SICHT_ERGEBNISSE = { rolle: false, aufgabe: false, ergebnis: true, pfeile: true };
  var SICHT_BLOECKE = { rolle: true, aufgabe: true, ergebnis: true, pfeile: false };
  var SICHT_ROLLEN = { rolle: true, aufgabe: true, ergebnis: false, pfeile: false };
  var SICHT_AUFGABEN = { rolle: false, aufgabe: true, ergebnis: true, pfeile: false };

  var REISEN = [
    { id: 'ergebnisse', titel: 'Entlang der Ergebnisse', kurz: 'Der Fluss der Abbildung 1: welches Ergebnis wo entsteht und worauf es aufbaut — von der Initialisierung bis zum Abschluss.' },
    { id: 'phasen', titel: 'Phase für Phase', kurz: 'Jede Phase im Detail: ihr Auftrag, jedes Modul mit seinen Aufgaben, Rollen und Ergebnissen und die Meilensteine, mit denen sie endet.' },
    { id: 'rollen', titel: 'Rolle für Rolle', kurz: 'Wer was verantwortet: Auftraggeber, Projektleiter und Anwendervertreter Phase für Phase, dann die weiteren Rollen.' },
    { id: 'besonderheiten', titel: 'Besonderheiten', kurz: 'Wie HERMES spezielle Themen behandelt: vom realisierten System bis zur Abnahme, Abnahmen, Protokolle und Prüfungen — wo sie im Ablauf stehen, wer sie verantwortet und was sie festhalten.' }
  ];

  /** data/lernpfad.json, einmal geladen (null, wenn es fehlt). */
  function laden() {
    if (!geladen) { geladen = HT.daten.ladeJson(DATEI).catch(function () { return null; }); }
    return geladen;
  }

  /* --- Hilfen ---------------------------------------------------------------- */

  function kapitelVon(lp, kurs, kapitel) {
    var k = (lp && lp.kurse || []).filter(function (x) { return x.id === kurs; })[0];
    var kap = k && (k.kapitel || []).filter(function (x) { return x.id === kapitel; })[0];
    return kap ? kap.folien || [] : [];
  }

  function ref(e) { return e ? { id: e.id, begriff: e.begriff, kategorie: e.kategorie } : null; }
  function refK(k) { return { id: k.id, begriff: k.begriff, kategorie: k.kategorie }; }

  function istMeilenstein(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    return !!e && e.kategorie === 'ergebnis' && e.typ === 'Meilenstein';
  }
  function istEntscheid(aufgabe) { return /^Entscheid\s/.test(aufgabe.begriff); }

  function zahlText(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }

  /* Die Phase in dieser Vorgehensweise (agil liegen Konzept, Realisierung und
     Einführung in der Umsetzung); null, wenn es sie nicht gibt. */
  function phaseIn(m, phase) {
    if (m.phasen.indexOf(phase) !== -1) { return phase; }
    var agil = m.vorgehen === 'agil' ? AGIL_PHASE[phase] : null;
    return agil && m.phasen.indexOf(agil) !== -1 ? agil : null;
  }

  function einmal(liste) {
    var aus = [];
    liste.forEach(function (x) { if (x && aus.indexOf(x) === -1) { aus.push(x); } });
    return aus;
  }

  function reihenfolge(modul) {
    var i = HT.gesamtbild.SPALTEN.indexOf(modul);
    /* Projektgrundlagen steht in der Abbildung über Organisation. */
    return modul === 'Projektgrundlagen' ? HT.gesamtbild.SPALTEN.indexOf('Organisation') - 0.5 : i;
  }

  function felderDerPhase(m, phase) {
    return m.felder.filter(function (f) { return f.phase === phase; })
      .sort(function (u, v) { return reihenfolge(u.modul) - reihenfolge(v.modul); });
  }

  /* Aufeinanderfolgende Phasen zusammengefasst: «Konzept bis Einführung». */
  function phasenText(m, phasen) {
    var idx = phasen.map(function (p) { return m.phasen.indexOf(p); }).sort(function (u, v) { return u - v; });
    var teile = [], von = null, bis = null;
    idx.forEach(function (i) {
      if (von !== null && i === bis + 1) { bis = i; return; }
      if (von !== null) { teile.push([von, bis]); }
      von = bis = i;
    });
    if (von !== null) { teile.push([von, bis]); }
    return teile.map(function (t) {
      return t[0] === t[1] ? m.phasen[t[0]] : m.phasen[t[0]] + (t[1] === t[0] + 1 ? ', ' : ' bis ') + m.phasen[t[1]];
    }).join(', ');
  }

  /* Eine Kette Rolle → Aufgabe → Ergebnisse aus einem Block des Rasters,
     dazu die beteiligten Rollen. nurErgebnis: nur dieses Ergebnis (sonst
     alle des Blocks ohne Meilensteine); mitMs: die Meilensteine dazu. */
  function kette(b, nurErgebnis, mitMs) {
    var ae = b.aufgabe.eintrag || HT.daten.eintragMitId(b.aufgabe.id);
    var erg = nurErgebnis ? [nurErgebnis] : b.ergebnisse.filter(function (k) { return mitMs || !istMeilenstein(k); }).map(refK);
    return {
      rolle: b.rolle ? refK(b.rolle) : null, aufgabe: refK(b.aufgabe), ergebnisse: erg,
      /* Die verantwortliche Rolle steht in der Kette, nicht noch einmal hier. */
      beteiligt: (ae && ae.beteiligt ? ae.beteiligt : []).filter(function (name) {
        return !b.rolle || HT.daten.normalisieren(name) !== HT.daten.normalisieren(b.rolle.begriff);
      })
    };
  }

  /* Wer ein Ergebnis erarbeitet: je Aufgabe (mit ihrer verantwortlichen
     Rolle) eine Kette, darüber wo sie steht. Dieselbe Aufgabe in mehreren
     Phasen steht einmal («Konzept bis Einführung»). */
  function ketten(m, e) {
    var nachSchluessel = {}, reihe = [];
    m.felder.forEach(function (f) {
      f.bloecke.forEach(function (b) {
        if (!b.ergebnisse.some(function (k) { return k.id === e.id; })) { return; }
        var key = (b.rolle ? b.rolle.id : '') + '|' + b.aufgabe.id;
        var z = nachSchluessel[key];
        if (!z) {
          z = nachSchluessel[key] = kette(b, ref(e));
          z.phasen = []; z.module = []; z.phase = f.phase; z.modul = f.modul; z.zeigeId = e.id;
          reihe.push(z);
        }
        if (z.phasen.indexOf(f.phase) === -1) { z.phasen.push(f.phase); }
        if (z.module.indexOf(f.modul) === -1) { z.module.push(f.modul); }
      });
    });
    reihe.forEach(function (z) { z.wo = phasenText(m, z.phasen) + ' · ' + z.module.join(', '); });
    return reihe;
  }

  function rolleTrifft(aufgabe, rolle, bezug) {
    var e = aufgabe.eintrag || HT.daten.eintragMitId(aufgabe.id);
    if (!e) { return false; }
    var norm = HT.daten.normalisieren(rolle);
    var verantwortlich = HT.daten.normalisieren(e.verantwortlich || '') === norm;
    var beteiligt = (e.beteiligt || []).some(function (r) { return HT.daten.normalisieren(r) === norm; });
    return bezug === 'verantwortlich' ? verantwortlich : beteiligt && !verantwortlich;
  }

  /* Die Aufgaben einer Rolle je Phase: [{ phase, aufgaben: [{ k, module, ergebnisse, ms }] }]. */
  function aufgabenDerRolle(m, rolle, bezug) {
    return m.phasen.map(function (phase) {
      var nachId = {}, reihe = [];
      felderDerPhase(m, phase).forEach(function (f) {
        f.bloecke.forEach(function (b) {
          if (!rolleTrifft(b.aufgabe, rolle, bezug)) { return; }
          var t = nachId[b.aufgabe.id];
          if (!t) { t = nachId[b.aufgabe.id] = { k: refK(b.aufgabe), module: [], ergebnisse: [], ms: [] }; reihe.push(t); }
          if (t.module.indexOf(f.modul) === -1) { t.module.push(f.modul); }
          b.ergebnisse.forEach(function (k) {
            var liste = istMeilenstein(k) ? t.ms : t.ergebnisse;
            if (!liste.some(function (x) { return x.id === k.id; })) { liste.push(refK(k)); }
          });
        });
      });
      return { phase: phase, aufgaben: reihe };
    });
  }

  /* Die Texte eines Schritts sind wörtliche Zitate (zitate), nie
     Zusammenfassungen: { element: id, abschnitt } — der Anfang der
     Elementseite von hermes.admin.ch (Beschreibung, Zweck …), mit abschnitt
     dieser Abschnitt; { rhb: kapitel, nummer } — ein Abschnitt des
     Referenzhandbuchs. Aus dem Lernpfad kommen nur Titel und die Nummern der
     Abschnitte, auf die sich eine Folie stützt (quelle). */
  function rhbZitate(f) {
    var aus = [];
    (f.quelle || []).forEach(function (q) {
      (q.abschnitte || []).forEach(function (n) { aus.push({ rhb: q.kapitel, nummer: n }); });
    });
    return aus;
  }

  function elementZitat(e, abschnitt) { return e ? { element: e.id, abschnitt: abschnitt || null } : null; }

  function schrittAusFolie(f, extra) {
    var s = { titel: f.titel || f.name, zitate: rhbZitate(f) };
    Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  function ziel(ids, felder, phasen, module) {
    return { ids: ids || [], felder: felder || [], phasen: phasen || [], module: module || [] };
  }

  function eine(id, nr) { var o = {}; o[id] = nr; return o; }

  /* nummern: { id: n } — das Raster setzt die Zahl an die Kästen der Aufgabe. */
  function mitNummern(z, nummern) {
    if (nummern && Object.keys(nummern).length) { z.nummern = nummern; }
    return z;
  }

  /* --- Entlang der Ergebnisse ------------------------------------------------ */

  /* Jeder Kasten der Abbildung 1, Phase für Phase in der Folge der Grafik
     (oben vor unten, links vor rechts; die Kästen «Phasenunabhängig» danach).
     Ein Ergebnis kommt einmal vor, an seiner ersten Stelle; hervorgehoben
     werden alle seine Stellen. Die Phase beginnt mit ihrer Beschreibung. */
  function ergebnisseReise(lp, m) {
    var schritte = [];
    var einstieg = kapitelVon(lp, 'deepdive', 'ergebnisse').filter(function (f) { return f.typ === 'aussage'; })[0];
    if (einstieg) {
      schritte.push(schrittAusFolie(einstieg, { key: 'einstieg', kapitel: 'Einstieg', kicker: 'Einstieg', sicht: SICHT_ERGEBNISSE, ziel: null }));
    }
    schritte.push({
      key: 'karte', kapitel: 'Einstieg', kicker: 'Zur Darstellung', titel: 'Die Ergebnisse im Raster', zitate: [],
      hinweis: [
        'Das Raster ist aufgebaut wie Abbildung 1 des Referenzhandbuchs: Phasen als Zeilen, Module als Spalten, die Kästen und Pfeile der Abbildung.',
        'Weitere Ergebnisse eines Feldes, die in der Abbildung keinen Kasten haben, stehen hinter «+N».',
        'Ein Klick auf einen Kasten zeigt seine Seite im Reiter «Handbuch»; der Reiter «Rundgang» führt zurück.'
      ],
      sicht: SICHT_ERGEBNISSE, ziel: null
    });
    var gesehen = {};
    m.phasen.forEach(function (phase) {
      var pe = HT.daten.eintragMitBegriff(phase, 'phase');
      var kaesten = [];
      felderDerPhase(m, phase).forEach(function (f) {
        f.bloecke.forEach(function (b) {
          b.ergebnisse.forEach(function (k) {
            if (istMeilenstein(k) || gesehen[k.id]) { return; }
            var lage = HT.graph.abbildungLage(k.id, phase, f.modul);
            if (!lage) { return; }
            gesehen[k.id] = true;
            kaesten.push({ k: k, lage: lage });
          });
        });
      });
      if (!kaesten.length) { return; }
      kaesten.sort(function (u, v) {
        return (!!u.lage.sammel - !!v.lage.sammel) || (u.lage.y - v.lage.y) || (u.lage.x - v.lage.x);
      });
      schritte.push({
        key: 'phase:' + phase, kapitel: phase, kicker: 'Phase', titel: phase, element: ref(pe),
        zitate: [elementZitat(pe)].filter(Boolean),
        hinweis: ['In dieser Phase: ' + zahlText(kaesten.length, 'Ergebnis', 'Ergebnisse') + ' mit Kasten in Abbildung 1, die hier erstmals vorkommen.'],
        sicht: SICHT_ERGEBNISSE, ziel: ziel([], [], [phase])
      });
      kaesten.forEach(function (x) {
        var e = HT.daten.eintragMitId(x.k.id);
        schritte.push({
          key: 'ergebnis:' + x.k.id, kapitel: phase, kicker: 'Ergebnis · ' + phase, titel: x.k.begriff, element: ref(e),
          zitate: [elementZitat(e)].filter(Boolean), ketten: e ? ketten(m, e) : [],
          sicht: SICHT_ERGEBNISSE, ziel: ziel([x.k.id])
        });
      });
    });
    return schritte;
  }

  /* --- Phase für Phase ----------------------------------------------------- */

  function phasenReise(lp, m) {
    var schritte = [];
    var phasenFolien = kapitelVon(lp, 'grundkurs', 'phasen');
    function folie(titel) { return phasenFolien.filter(function (f) { return f.titel === titel; })[0] || null; }

    var start = folie('Der Projektlebenszyklus');
    if (start) {
      schritte.push(schrittAusFolie(start, { key: 'start', kapitel: 'Einstieg', kicker: 'Einstieg', sicht: SICHT_BLOECKE, ziel: null }));
    }
    var gates = folie('Meilensteine als Quality Gates');
    if (gates) {
      var alleMs = [];
      m.zeilen.forEach(function (z) {
        ['anfang', 'ende'].forEach(function (lage) { z.meilensteine[lage].forEach(function (k) { alleMs.push(k.id); }); });
      });
      schritte.push(schrittAusFolie(gates, { key: 'gates', kapitel: 'Einstieg', kicker: 'Einstieg', sicht: SICHT_BLOECKE, ziel: ziel(einmal(alleMs)) }));
    }

    m.zeilen.forEach(function (z) {
      var phase = z.phase;
      var felder = felderDerPhase(m, phase);
      var filter = { phasen: [phase] };
      var pe = HT.daten.eintragMitBegriff(phase, 'phase');
      var anfang = z.meilensteine.anfang.map(refK), ende = z.meilensteine.ende.map(refK);
      var fakten = [];
      if (anfang.length || ende.length) {
        fakten.push({ titel: 'Meilensteine', zeilen: [
          anfang.length ? { wo: 'Beginnt mit', links: anfang } : null,
          ende.length ? { wo: 'Endet mit', links: ende } : null
        ].filter(Boolean) });
      }
      fakten.push({ titel: 'Module · ' + felder.length, zeilen: felder.map(function (f) {
        var n = f.bloecke.length, ent = f.bloecke.filter(function (b) { return istEntscheid(b.aufgabe); }).length;
        return { wo: f.modul, phase: phase, modul: f.modul, text: zahlText(n, 'Aufgabe', 'Aufgaben') + (ent ? ', davon ' + zahlText(ent, 'Entscheid', 'Entscheide') : '') };
      }) });
      schritte.push({
        key: 'phase:' + phase, kapitel: phase, kicker: 'Phase', titel: phase, element: ref(pe),
        zitate: [elementZitat(pe)].filter(Boolean),
        sicht: SICHT_BLOECKE, filter: filter, ziel: ziel([], [], [phase]), fakten: fakten
      });

      felder.forEach(function (f) {
        var me = HT.daten.eintragMitBegriff(f.modul, 'modul');
        schritte.push({
          key: 'feld:' + phase + '|' + f.modul, kapitel: phase, kicker: phase + ' · Modul', titel: f.modul, element: ref(me),
          zitate: [elementZitat(me)].filter(Boolean),
          kettenTitel: zahlText(f.bloecke.length, 'Aufgabe', 'Aufgaben') + ' im Feld',
          ketten: f.bloecke.map(function (b) { return kette(b, null, true); }),
          sicht: SICHT_BLOECKE, filter: filter, ziel: ziel([], [[phase, f.modul]])
        });
      });

      /* Am Ende: die Entscheide, mit denen die Phase schliesst — mit dem
         Anfang ihrer Elementseite. */
      if (ende.length) {
        var reihe = [], ids = [], felderZiel = [], zitate = [];
        ende.forEach(function (k) {
          ids.push(k.id);
          felder.forEach(function (f) {
            f.bloecke.forEach(function (b) {
              if (!b.ergebnisse.some(function (x) { return x.id === k.id; })) { return; }
              ids.push(b.aufgabe.id);
              felderZiel.push([phase, f.modul]);
              var ae = HT.daten.eintragMitId(b.aufgabe.id);
              /* Aufgabenseiten beginnen mit einer Grafik; der Text steht
                 unter «Zweck» und «Grundidee». */
              if (ae && !zitate.some(function (q) { return q.element === ae.id; })) {
                zitate.push(elementZitat(ae, 'Zweck'), elementZitat(ae, 'Grundidee'));
              }
              var kt = kette(b, refK(k));
              kt.wo = f.modul; kt.phase = phase; kt.modul = f.modul; kt.zeigeId = b.aufgabe.id;
              reihe.push(kt);
            });
          });
        });
        schritte.push({
          key: 'ende:' + phase, kapitel: phase, kicker: phase + ' · Ende', titel: 'Am Ende ' + (GENITIV[phase] || 'der Phase ' + phase),
          zitate: zitate, kettenTitel: 'Entscheid → Meilenstein', ketten: reihe,
          sicht: SICHT_BLOECKE, filter: filter, ziel: ziel(einmal(ids), felderZiel)
        });
      }
    });
    return schritte;
  }

  /* --- Rolle für Rolle ------------------------------------------------------- */

  function rolleFakten(je, alleAufgaben) {
    return je.filter(function (p) { return p.aufgaben.length; }).map(function (p) {
      var ent = p.aufgaben.filter(function (t) { return istEntscheid(t.k); });
      if (!alleAufgaben) {
        return {
          wo: p.phase, phase: p.phase, text: zahlText(p.aufgaben.length, 'Aufgabe', 'Aufgaben') + (ent.length ? ', Entscheide: ' : ''),
          links: ent.map(function (t) { return t.k; })
        };
      }
      return { wo: p.phase, phase: p.phase, links: p.aufgaben.map(function (t) { return t.k; }) };
    });
  }

  function summe(je) { return je.reduce(function (s, p) { return s + p.aufgaben.length; }, 0); }

  /* Die Ketten einer Rolle in einer Phase: je Aufgabe, die sie dort hat. */
  function rollenKetten(m, rolle, bezug, phase) {
    var reihe = [], gesehen = {};
    felderDerPhase(m, phase).forEach(function (f) {
      f.bloecke.forEach(function (b) {
        if (gesehen[b.aufgabe.id] || !rolleTrifft(b.aufgabe, rolle, bezug)) { return; }
        gesehen[b.aufgabe.id] = true;
        var kt = kette(b, null, true);
        kt.wo = f.modul; kt.phase = phase; kt.modul = f.modul; kt.zeigeId = b.aufgabe.id;
        reihe.push(kt);
      });
    });
    return reihe;
  }

  function rollenReise(lp, m) {
    var schritte = [];
    var folien = kapitelVon(lp, 'deepdive', 'rollen');
    var kapitel = 'Einstieg';
    folien.forEach(function (f) {
      if (f.typ === 'graph') { return; }
      if (f.typ === 'abschnitt') { kapitel = f.titel; return; }
      if (f.typ === 'aussage' || f.typ === 'spalten') {
        var ids = (f.spalten || []).map(function (sp) {
          return HT.daten.eintragMitBegriff(String(sp.titel).split(' — ')[0], 'rolle');
        }).filter(Boolean).map(function (e) { return e.id; });
        schritte.push(schrittAusFolie(f, {
          key: 'folie:' + f.titel, kapitel: kapitel, kicker: 'Einstieg', sicht: SICHT_ROLLEN,
          ziel: ids.length ? ziel(ids) : null
        }));
        return;
      }
      var rolle = HT.daten.eintragMitBegriff(f.rolle, 'rolle');
      if (!rolle) { return; }
      var verantw = aufgabenDerRolle(m, rolle.begriff, 'verantwortlich');
      var beteiligt = aufgabenDerRolle(m, rolle.begriff, 'beteiligt');
      var nV = summe(verantw), nB = summe(beteiligt);
      if (!nV && !nB) { return; }             // die Rolle kommt in dieser Vorgehensweise nicht vor
      var bezug = nV ? 'verantwortlich' : 'beteiligt';
      var filter = { rolle: rolle.begriff, bezug: bezug };
      if (f.typ === 'rollenweg' || f.typ === 'rolle') {
        schritte.push({
          key: 'rolle:' + rolle.begriff, kapitel: f.typ === 'rolle' ? 'Die weiteren Rollen' : kapitel, kicker: 'Rolle', titel: rolle.begriff,
          element: ref(rolle), zitate: [elementZitat(rolle), elementZitat(rolle, 'Verantwortung')],
          hinweis: [nV
            ? 'In den Daten: verantwortlich für ' + zahlText(nV, 'Aufgabe', 'Aufgaben') + (nB ? ', beteiligt an ' + nB : '') + ' (je Phase gezählt). Das Raster zeigt die Aufgaben, die die Rolle verantwortet.'
            : 'In den Daten: für keine Aufgabe verantwortlich, beteiligt an ' + zahlText(nB, 'Aufgabe', 'Aufgaben') + ' (je Phase gezählt). Das Raster zeigt diese Aufgaben.'],
          sicht: SICHT_AUFGABEN, filter: filter, ziel: null,
          fakten: [{ titel: nV ? 'Verantwortet je Phase' : 'Beteiligt je Phase', zeilen: rolleFakten(nV ? verantw : beteiligt, f.typ === 'rolle') }]
        });
        return;
      }
      if (f.typ === 'rollenphase') {
        var phase = m.phasen.indexOf(f.phase) !== -1 ? f.phase : null;
        if (!phase) { return; }
        var reihe = rollenKetten(m, rolle.begriff, bezug, phase);
        schritte.push({
          key: 'rollenphase:' + rolle.begriff + '|' + phase, kapitel: kapitel, kicker: rolle.begriff + ' · ' + phase,
          titel: f.titel, element: ref(rolle), zitate: [],
          hinweis: [reihe.length
            ? 'Die Aufgaben, die die Rolle ' + rolle.begriff + ' in der Phase ' + phase + (nV ? ' verantwortet' : ' mitträgt') + ', mit ihren Ergebnissen.'
            : 'In der Phase ' + phase + ' ' + (nV ? 'verantwortet' : 'trägt') + ' die Rolle ' + rolle.begriff + ' keine Aufgabe' + (nV ? '.' : ' mit.')],
          kettenTitel: zahlText(reihe.length, 'Aufgabe', 'Aufgaben'), ketten: reihe,
          sicht: SICHT_AUFGABEN, filter: filter, ziel: ziel([], [], [phase])
        });
      }
    });
    return schritte;
  }

  /* --- Besonderheiten ------------------------------------------------------ */

  /* Spezielle Themen, je ein Kapitel. Ein Schritt zeigt ein Element:
     aufgabe — Zitate aus ihrer Seite, ihre Kette(n) mit allen Ergebnissen;
     ergebnis — Zitate, wer es wo erarbeitet; ueberblick — die Elemente des
     Themas als Liste, wo sie stehen (in der Reihenfolge von elemente).
     zitate: [[id, abschnitt]], ohne abschnitt der Anfang der Seite, oder
     { rhb, nummer } für einen Abschnitt des Referenzhandbuchs; zitateAgil
     ersetzt sie in agiler Vorgehensweise. */
  function schrittA(nr, name, abschnitte) {
    var id = 'aufgabe-' + name;
    return { art: 'aufgabe', id: id, nr: nr,
      zitate: abschnitte.map(function (a) { return [id, a]; }) };
  }

  /* Vom realisierten System bis zur Abnahme, in der Folge, die das Handbuch
     über Zweck und Grundlagen der Aufgaben vorgibt (1.4.2.2, 1.4.2.3). */
  var ABLAUF = [
    ['system-realisieren', ['Zweck', 'HERMES spezifisch']],
    ['systemintegration-vorbereiten', ['Zweck', 'HERMES spezifisch']],
    ['betrieb-realisieren', ['Zweck', 'HERMES spezifisch']],
    ['system-in-betrieb-integrieren', ['Zweck', 'Grundlagen']],
    ['testinfrastruktur-realisieren', ['Zweck', 'Grundlagen']],
    ['test-durchfuehren', ['Zweck', 'Grundidee', 'HERMES spezifisch']],
    ['migrationsverfahren-realisieren', ['Zweck', 'HERMES spezifisch']],
    ['entscheid-vorabnahme-treffen', ['Zweck', 'Grundlagen']],
    ['einfuehrungsmassnahmen-durchfuehren', ['Zweck', 'HERMES spezifisch']],
    ['migration-durchfuehren', ['Zweck', 'HERMES spezifisch']],
    ['entscheid-abnahme-migration-treffen', ['Zweck', 'HERMES spezifisch']],
    ['isds-konzept-ueberfuehren', ['Zweck', 'HERMES spezifisch']],
    ['entscheid-betriebsaufnahme-treffen', ['Zweck', 'Grundidee', 'HERMES spezifisch', 'Grundlagen']],
    ['system-aktivieren', ['Zweck', 'HERMES spezifisch']],
    ['organisation-aktivieren', ['Zweck', 'HERMES spezifisch']],
    ['betrieb-aktivieren', ['Zweck', 'Grundlagen']],
    ['entscheid-abnahme-treffen', ['Zweck', 'HERMES spezifisch']],
    ['altsystem-ausser-betrieb-setzen', ['Zweck', 'Grundlagen']],
    ['testinfrastruktur-ueberfuehren', ['Zweck', 'HERMES spezifisch']]
  ];

  var THEMEN = [
    { kapitel: 'Vom System zum Betrieb', schritte: [
      { art: 'ueberblick', titel: 'Die Reihenfolge im Überblick',
        zitate: [{ rhb: 'phasen', nummer: '1.4.2.2' }, { rhb: 'phasen', nummer: '1.4.2.3' }],
        zitateAgil: [{ rhb: 'phasen', nummer: '1.4.3.1' }],
        elemente: ABLAUF.map(function (a) { return 'aufgabe-' + a[0]; }), nummeriert: true,
        listenTitel: 'Die Reihenfolge' }
    ].concat(ABLAUF.map(function (a, i) { return schrittA(i + 1, a[0], a[1]); })) },
    { kapitel: 'Abnahmen', schritte: [
      { art: 'ueberblick', titel: 'Abnahmen im Überblick', zitate: [['ergebnis-abnahmeprotokoll']],
        elemente: ['aufgabe-entscheid-vorabnahme-treffen', 'aufgabe-entscheid-abnahme-migration-treffen', 'aufgabe-entscheid-abnahme-treffen'],
        listenTitel: 'Die Abnahme-Entscheide' },
      { art: 'aufgabe', id: 'aufgabe-entscheid-vorabnahme-treffen', titel: 'Vorabnahme',
        zitate: [['aufgabe-entscheid-vorabnahme-treffen', 'Zweck'], ['aufgabe-entscheid-vorabnahme-treffen', 'Grundidee'], ['aufgabe-entscheid-vorabnahme-treffen', 'HERMES spezifisch']] },
      { art: 'aufgabe', id: 'aufgabe-entscheid-abnahme-migration-treffen', titel: 'Abnahme Migration',
        zitate: [['aufgabe-entscheid-abnahme-migration-treffen', 'Zweck'], ['aufgabe-entscheid-abnahme-migration-treffen', 'Grundidee'], ['aufgabe-entscheid-abnahme-migration-treffen', 'HERMES spezifisch']] },
      { art: 'aufgabe', id: 'aufgabe-entscheid-abnahme-treffen', titel: 'Abnahme',
        zitate: [['aufgabe-entscheid-abnahme-treffen', 'Zweck'], ['aufgabe-entscheid-abnahme-treffen', 'Grundidee'], ['aufgabe-entscheid-abnahme-treffen', 'HERMES spezifisch'], ['ergebnis-meilenstein-abnahme']] },
      { art: 'ergebnis', id: 'ergebnis-abnahmeprotokoll', titel: 'Das Abnahmeprotokoll',
        zitate: [['ergebnis-abnahmeprotokoll', 'Inhalt']] }
    ] },
    { kapitel: 'Protokolle', schritte: [
      { art: 'ueberblick', titel: 'Protokolle im Überblick', zitate: [],
        elemente: ['ergebnis-protokoll', 'ergebnis-angebotsprotokoll', 'ergebnis-pruefprotokoll', 'ergebnis-testprotokoll', 'ergebnis-abnahmeprotokoll'],
        listenTitel: 'Die Protokolle' },
      { art: 'ergebnis', id: 'ergebnis-protokoll', titel: 'Protokoll',
        zitate: [['ergebnis-protokoll'], ['ergebnis-protokoll', 'Inhalt']] },
      { art: 'ergebnis', id: 'ergebnis-angebotsprotokoll', titel: 'Angebotsprotokoll',
        zitate: [['ergebnis-angebotsprotokoll'], ['ergebnis-angebotsprotokoll', 'Inhalt']] }
    ] },
    { kapitel: 'Prüfungen', schritte: [
      { art: 'aufgabe', id: 'aufgabe-qualitaetssicherung-fuehren', titel: 'Prüfen und Testen',
        zitate: [['aufgabe-qualitaetssicherung-fuehren', 'Zweck'], ['aufgabe-qualitaetssicherung-fuehren', 'Grundidee']] },
      { art: 'ergebnis', id: 'ergebnis-pruefprotokoll', titel: 'Prüfprotokoll',
        zitate: [['ergebnis-pruefprotokoll'], ['ergebnis-pruefprotokoll', 'Inhalt'], ['aufgabe-qualitaetssicherung-fuehren', 'HERMES spezifisch']] },
      { art: 'ergebnis', id: 'ergebnis-testprotokoll', titel: 'Testprotokoll',
        zitate: [['ergebnis-testprotokoll'], ['ergebnis-testprotokoll', 'Inhalt']] }
    ] }
  ];

  /* Die Stellen einer Aufgabe im Raster, je verantwortliche Rolle eine Kette
     mit allen Ergebnissen und Meilensteinen; dieselbe Aufgabe in mehreren
     Phasen steht einmal («Konzept bis Einführung»). */
  function aufgabeKetten(m, id) {
    var nachRolle = {}, reihe = [];
    m.felder.forEach(function (f) {
      f.bloecke.forEach(function (b) {
        if (b.aufgabe.id !== id) { return; }
        var key = b.rolle ? b.rolle.id : '';
        var z = nachRolle[key];
        if (!z) {
          z = nachRolle[key] = kette(b, null, true);
          z.phasen = []; z.module = []; z.felder = []; z.phase = f.phase; z.modul = f.modul; z.zeigeId = id;
          reihe.push(z);
        }
        b.ergebnisse.forEach(function (k) {
          if (!z.ergebnisse.some(function (x) { return x.id === k.id; })) { z.ergebnisse.push(refK(k)); }
        });
        if (z.phasen.indexOf(f.phase) === -1) { z.phasen.push(f.phase); }
        if (z.module.indexOf(f.modul) === -1) { z.module.push(f.modul); }
        z.felder.push([f.phase, f.modul]);
      });
    });
    reihe.forEach(function (z) { z.wo = phasenText(m, z.phasen) + ' · ' + z.module.join(', '); });
    return reihe;
  }

  /* Wo ein Element steht: Aufgaben mit ihren Ketten, Ergebnisse mit den
     Ketten, die sie erarbeiten. */
  function stellen(m, e) {
    return e.kategorie === 'aufgabe' ? aufgabeKetten(m, e.id) : ketten(m, e);
  }

  function besonderheitenReise(lp, m) {
    var schritte = [];
    THEMEN.forEach(function (thema) {
      thema.schritte.forEach(function (d) {
        var quellen = m.vorgehen === 'agil' && d.zitateAgil ? d.zitateAgil : d.zitate || [];
        var zitate = quellen.map(function (q) {
          return Array.isArray(q) ? elementZitat(HT.daten.eintragMitId(q[0]), q[1]) : q;
        }).filter(Boolean);
        if (d.art === 'ueberblick') {
          var zeilen = [], ids = [], nummern = {};
          d.elemente.forEach(function (id, nr) {
            var e = HT.daten.eintragMitId(id);
            var reihe = e ? stellen(m, e) : [];
            if (!reihe.length) { return; }
            var phasen = einmal([].concat.apply([], reihe.map(function (z) { return z.phasen; })));
            var module = einmal([].concat.apply([], reihe.map(function (z) { return z.module; })));
            var ms = e.kategorie === 'aufgabe' ? [].concat.apply([], reihe.map(function (z) {
              return z.ergebnisse.filter(istMeilenstein);
            })) : [];
            ids.push(id);
            ms.forEach(function (k) { ids.push(k.id); });
            /* nummeriert: die Nummer in der Liste und im Raster, dazu wer die Aufgabe verantwortet. */
            var rollen = d.nummeriert ? einmal(reihe.map(function (z) { return z.rolle ? z.rolle.begriff : null; })) : [];
            if (d.nummeriert) { nummern[id] = nr + 1; }
            /* Nummeriert steht eine Aufgabe in mehreren Phasen (Test durchführen)
               an ihrer ersten Stelle; die späteren Phasen wiederholen sie («Bei
               Bedarf wird die Testdurchführung mehrfach wiederholt»). */
            var spaeter = d.nummeriert ? phasen.filter(function (p) { return m.phasen.indexOf(p) > m.phasen.indexOf(reihe[0].phase); }) : [];
            zeilen.push({
              wo: spaeter.length ? reihe[0].phase : phasenText(m, phasen), phase: reihe[0].phase, modul: reihe[0].modul, zeigeId: id,
              k: ref(e), nr: d.nummeriert ? nr + 1 : null, text: module.concat(rollen).join(' · '), ms: ms,
              nachsatz: spaeter.length ? phasenText(m, spaeter) + ': bei Bedarf wiederholt (' + (nr + 1) + '↻)' : null
            });
          });
          if (!zeilen.length) { return; }
          var wort = zeilen.every(function (z) { return z.k.kategorie === 'aufgabe' && istEntscheid(z.k); }) ? ['Entscheid', 'Entscheide']
            : zeilen.every(function (z) { return z.k.kategorie === 'ergebnis'; }) ? ['Ergebnis', 'Ergebnisse'] : ['Element', 'Elemente'];
          schritte.push({
            key: 'thema:' + thema.kapitel, kapitel: thema.kapitel, kicker: thema.kapitel + ' · Überblick', titel: d.titel,
            zitate: zitate,
            hinweis: ['In dieser Vorgehensweise: ' + zahlText(zeilen.length, wort[0], wort[1]) + '. Das Raster hebt sie hervor; ein Ort in der Liste springt ins Feld.'],
            fakten: [{ titel: d.listenTitel, zeilen: zeilen }],
            sicht: SICHT_BLOECKE, ziel: mitNummern(ziel(einmal(ids)), nummern)
          });
          return;
        }
        var e = HT.daten.eintragMitId(d.id);
        var reihe = e ? stellen(m, e) : [];
        if (!reihe.length) { return; }             // das Element kommt in dieser Vorgehensweise nicht vor
        /* Hervor treten das Element, seine Aufgaben und Meilensteine — bei
           einer Aufgabe dazu ihre Felder. Ergebnisse wie die Liste
           Projektentscheide stehen an vielen Stellen und bleiben leise. */
        var idsZ = [e.id], felder = [];
        reihe.forEach(function (z) {
          idsZ.push(z.aufgabe.id);
          if (d.art === 'aufgabe') {
            z.ergebnisse.filter(istMeilenstein).forEach(function (k) { idsZ.push(k.id); });
            felder = felder.concat(z.felder);
          }
        });
        schritte.push({
          key: 'besonders:' + thema.kapitel + '|' + e.id, kapitel: thema.kapitel,
          kicker: thema.kapitel + ' · ' + (d.art === 'aufgabe' ? (istEntscheid(e) ? 'Entscheid' : 'Aufgabe') : 'Ergebnis'),
          titel: d.titel || (d.nr ? d.nr + '. ' : '') + e.begriff, element: ref(e), zitate: zitate,
          kettenTitel: d.art === 'aufgabe' ? 'Rolle → Aufgabe → Ergebnis' : 'Wer es wo erarbeitet',
          ketten: reihe,
          sicht: SICHT_BLOECKE, ziel: mitNummern(ziel(einmal(idsZ), felder), d.nr ? eine(e.id, d.nr) : null)
        });
      });
    });
    return schritte;
  }

  var BAUER = { ergebnisse: ergebnisseReise, phasen: phasenReise, rollen: rollenReise, besonderheiten: besonderheitenReise };

  /** Die Schritte eines Weges für das Modell m des Rasters (eine Vorgehensweise). */
  function schritte(id, lp, m) {
    var bauer = BAUER[id];
    return bauer && lp ? bauer(lp, m) : [];
  }

  HT.rundgang = {
    REISEN: REISEN,
    laden: laden,
    schritte: schritte
  };
}(window));
