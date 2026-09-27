/* meinHERMES — Rundgang durch das Raster (js/raster.js), Entwurf.

   Drei Wege Schritt für Schritt durch die Methode; links zeigt das Raster,
   worum es geht, rechts in der Inhaltsseite steht, was es bedeutet:
   - Entlang der Ergebnisse: der Fluss der Abbildung 1, Phase für Phase,
     ein Schritt je Kernergebnis (Kapitel «Aus Sicht der Ergebnisse» des
     Deep Dive).
   - Phase für Phase: je Phase ihr Auftrag, dann jedes Modul mit seinen
     Aufgaben, verantwortlichen Rollen und Ergebnissen, am Ende die
     Meilensteine, mit denen sie schliesst (Grundkurs «Die Phasen» und
     «Die Module», Deep Dive «Aus Sicht der Entscheide»).
   - Rolle für Rolle: was jede Rolle verantwortet, die drei Pflichtrollen
     auch Phase für Phase (Deep Dive «Aus Sicht der Rollen»).

   Die Texte (kern, punkte, spalten) stehen geprüft in data/lernpfad.json und
   werden hier nicht noch einmal geschrieben; was das Raster zeigt (Sicht,
   Filter, hervorgehobene Stellen) und die Listen aus unseren Daten legt
   diese Datei fest. Ein Schritt:
     { key, kapitel, titel, kicker, kern, punkte, spalten,
       fakten: [{ titel, zeilen: [{ wo, phase, modul, k, text, links, ms }] }],
       sicht: { rolle, aufgabe, ergebnis, pfeile }, filter: { phasen, module, rolle, bezug },
       ziel: { ids, felder: [[phase, modul]], phasen, module } | null }
   Schritte, deren Stellen es in der Vorgehensweise nicht gibt, fallen weg
   (Releasebericht klassisch, Konzept agil). */
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
    { id: 'rollen', titel: 'Rolle für Rolle', kurz: 'Wer was verantwortet: Auftraggeber, Projektleiter und Anwendervertreter Phase für Phase, dann die weiteren Rollen.' }
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

  /* Wo ein Ergebnis entsteht: je Feld die Aufgaben, die es erarbeiten. */
  function ergebnisOrte(m, id) {
    var orte = [];
    m.felder.forEach(function (f) {
      var aufgaben = f.bloecke.filter(function (b) {
        return b.ergebnisse.some(function (k) { return k.id === id; });
      }).map(function (b) { return refK(b.aufgabe); });
      if (aufgaben.length) { orte.push({ phase: f.phase, modul: f.modul, aufgaben: aufgaben }); }
    });
    return orte;
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

  function schrittAusFolie(f, extra) {
    var s = {
      titel: f.titel || f.name,
      kern: f.kern || '',
      punkte: f.punkte || [],
      spalten: f.spalten || null
    };
    Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  /* --- Entlang der Ergebnisse ------------------------------------------------ */

  /* Was jeder Abschnitt des Deep Dive im Raster zeigt; nur: nur in dieser
     Vorgehensweise (gilt für die Schritte des Abschnitts). */
  var ABSCHNITTE_ERGEBNISSE = {
    'Initialisierung: die Grundlagen': { phasen: ['Initialisierung'] },
    'Konzept: Anforderungen und Konzepte': { phasen: ['Konzept'] },
    'Konzept: Beschaffung am Markt': { felder: [['Konzept', 'Beschaffung']] },
    'Realisierung und Einführung': { phasen: ['Realisierung', 'Einführung'] },
    'Umsetzung: agil geführt': { phasen: ['Umsetzung'], nur: 'agil' },
    'Laufend: führen, berichten, ändern': { module: ['Projektsteuerung', 'Projektführung'] },
    'Abschluss: Bilanz ziehen': { phasen: ['Abschluss'] },
    'Alle Ergebnisse je Modul': { ende: true }
  };

  function zielIn(m, z) {
    var ziel = { ids: z.ids || [], felder: [], phasen: [], module: z.module || [] };
    (z.phasen || []).forEach(function (p) { var q = phaseIn(m, p); if (q && ziel.phasen.indexOf(q) === -1) { ziel.phasen.push(q); } });
    (z.felder || []).forEach(function (fm) {
      var q = phaseIn(m, fm[0]);
      if (q && m.felder.some(function (f) { return f.phase === q && f.modul === fm[1]; })) { ziel.felder.push([q, fm[1]]); }
    });
    var leer = !ziel.ids.length && !ziel.felder.length && !ziel.phasen.length && !ziel.module.length;
    return leer ? null : ziel;
  }

  function ergebnisseReise(lp, m) {
    var schritte = [];
    var folien = kapitelVon(lp, 'deepdive', 'ergebnisse');
    var kapitel = 'Einstieg', nur = null;
    for (var i = 0; i < folien.length; i++) {
      var f = folien[i];
      if (f.typ === 'abschnitt') {
        var a = ABSCHNITTE_ERGEBNISSE[f.titel] || {};
        if (a.ende) { break; }
        kapitel = f.titel;
        nur = a.nur || null;
        if (nur && nur !== m.vorgehen) { continue; }
        var ziel = zielIn(m, a);
        if (!ziel) { continue; }
        schritte.push(schrittAusFolie(f, { key: 'abschnitt:' + f.titel, kapitel: kapitel, kicker: 'Abschnitt', sicht: SICHT_ERGEBNISSE, ziel: ziel }));
        continue;
      }
      if (nur && nur !== m.vorgehen) { continue; }
      if (f.typ === 'karte') {
        /* Die Karte des Lernpfads ist hier das Raster selbst. */
        schritte.push({
          key: 'karte', kapitel: kapitel, kicker: 'Einstieg', titel: 'Die Ergebnisse im Raster',
          kern: 'Aufgebaut wie Abbildung 1 des Referenzhandbuchs: Phasen als Zeilen, Module als Spalten. Jeder Kasten ist ein Ergebnis an der Stelle, an der es entsteht; die Pfeile zeigen, welches Ergebnis auf welchem aufbaut.',
          punkte: [
            'Der Rundgang folgt dem Fluss von oben nach unten, Phase für Phase.',
            'Weitere Ergebnisse eines Feldes — Checklisten, Listen, Protokolle — stehen hinter «+N».',
            'Ein Klick auf einen Kasten zeigt seine Seite aus dem Handbuch; der Reiter «Rundgang» führt zurück.'
          ],
          sicht: SICHT_ERGEBNISSE, ziel: null
        });
      } else if (f.typ === 'lebenslauf') {
        var e = HT.daten.eintragMitBegriff(f.name, 'ergebnis');
        var orte = e ? ergebnisOrte(m, e.id) : [];
        if (!orte.length) { continue; }
        schritte.push(schrittAusFolie(f, {
          key: 'ergebnis:' + f.name, kapitel: kapitel, kicker: 'Ergebnis', element: ref(e),
          sicht: SICHT_ERGEBNISSE, ziel: { ids: [e.id], felder: [], phasen: [], module: [] },
          fakten: [{ titel: 'Entsteht in ' + zahlText(orte.length, 'Feld', 'Feldern'), zeilen: orte.map(function (o) {
            return { wo: o.phase + ' · ' + o.modul, phase: o.phase, modul: o.modul, zeigeId: e.id, text: 'erarbeitet von ', links: o.aufgaben };
          }) }]
        }));
      } else if (f.typ === 'spalten' || f.typ === 'aussage') {
        /* Spalten, die Ergebnisse sind, werden hervorgehoben. */
        var ids = (f.spalten || []).map(function (sp) { return HT.daten.eintragMitBegriff(sp.titel, 'ergebnis'); })
          .filter(function (x) { return x && ergebnisOrte(m, x.id).length; }).map(function (x) { return x.id; });
        schritte.push(schrittAusFolie(f, {
          key: 'folie:' + f.titel, kapitel: kapitel, kicker: kapitel === 'Einstieg' ? 'Einstieg' : 'Überblick',
          sicht: SICHT_ERGEBNISSE, ziel: ids.length ? { ids: ids, felder: [], phasen: [], module: [] } : null
        }));
      }
    }
    return schritte;
  }

  /* --- Phase für Phase ----------------------------------------------------- */

  function phasenReise(lp, m) {
    var schritte = [];
    var phasenFolien = kapitelVon(lp, 'grundkurs', 'phasen');
    var modulFolien = kapitelVon(lp, 'grundkurs', 'module');
    var entscheidFolien = kapitelVon(lp, 'deepdive', 'entscheide');
    function folie(liste, pruefen) { return liste.filter(pruefen)[0] || null; }

    var start = folie(phasenFolien, function (f) { return f.titel === 'Der Projektlebenszyklus'; });
    if (start) {
      schritte.push(schrittAusFolie(start, { key: 'start', kapitel: 'Einstieg', kicker: 'Einstieg', sicht: SICHT_BLOECKE, ziel: null }));
    }
    var gates = folie(phasenFolien, function (f) { return f.titel === 'Meilensteine als Quality Gates'; });
    if (gates) {
      var alleMs = [];
      m.zeilen.forEach(function (z) {
        ['anfang', 'ende'].forEach(function (lage) { z.meilensteine[lage].forEach(function (k) { alleMs.push(k.id); }); });
      });
      schritte.push(schrittAusFolie(gates, { key: 'gates', kapitel: 'Einstieg', kicker: 'Einstieg', sicht: SICHT_BLOECKE, ziel: { ids: einmal(alleMs), felder: [], phasen: [], module: [] } }));
    }

    m.zeilen.forEach(function (z) {
      var phase = z.phase;
      var felder = felderDerPhase(m, phase);
      var filter = { phasen: [phase] };
      var pf = folie(phasenFolien, function (f) { return f.typ === 'element' && f.name === phase; });
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
        kern: pf ? pf.kern : (pe && pe.definition) || '', punkte: pf ? pf.punkte || [] : [],
        sicht: SICHT_BLOECKE, filter: filter, ziel: { ids: [], felder: [], phasen: [phase], module: [] }, fakten: fakten
      });

      felder.forEach(function (f) {
        var mf = folie(modulFolien, function (x) { return x.typ === 'element' && x.name === f.modul; });
        var me = HT.daten.eintragMitBegriff(f.modul, 'modul');
        var erg = {};
        f.bloecke.forEach(function (b) { b.ergebnisse.forEach(function (k) { if (!istMeilenstein(k)) { erg[k.id] = true; } }); });
        schritte.push({
          key: 'feld:' + phase + '|' + f.modul, kapitel: phase, kicker: phase + ' · Modul', titel: f.modul, element: ref(me),
          kern: mf ? mf.kern : (me && me.definition) || '', punkte: [],
          sicht: SICHT_BLOECKE, filter: filter, ziel: { ids: [], felder: [[phase, f.modul]], phasen: [], module: [] },
          fakten: [{ titel: zahlText(f.bloecke.length, 'Aufgabe', 'Aufgaben') + ' · ' + zahlText(Object.keys(erg).length, 'Ergebnis', 'Ergebnisse'), zeilen: f.bloecke.map(function (b) {
            return {
              k: refK(b.aufgabe), text: b.rolle ? b.rolle.begriff : '',
              links: b.ergebnisse.filter(function (k) { return !istMeilenstein(k); }).map(refK),
              ms: b.ergebnisse.filter(istMeilenstein).map(refK)
            };
          }) }]
        });
      });

      /* Am Ende: die Entscheide, mit denen die Phase schliesst. */
      if (ende.length) {
        var zeilen = [], ids = [], felderZiel = [], kern = [];
        ende.forEach(function (k) {
          ids.push(k.id);
          felder.forEach(function (f) {
            f.bloecke.forEach(function (b) {
              if (!b.ergebnisse.some(function (x) { return x.id === k.id; })) { return; }
              ids.push(b.aufgabe.id);
              felderZiel.push([phase, f.modul]);
              var ef = folie(entscheidFolien, function (x) { return x.typ === 'entscheid' && x.name === b.aufgabe.begriff; });
              if (ef && kern.indexOf(ef.kern) === -1) { kern.push(ef.kern); }
              zeilen.push({ wo: f.modul, phase: phase, modul: f.modul, zeigeId: b.aufgabe.id, k: refK(b.aufgabe), text: b.rolle ? b.rolle.begriff : '', ms: [k] });
            });
          });
        });
        schritte.push({
          key: 'ende:' + phase, kapitel: phase, kicker: phase + ' · Ende', titel: 'Am Ende ' + (GENITIV[phase] || 'der Phase ' + phase),
          kern: kern.join(' '), punkte: [],
          sicht: SICHT_BLOECKE, filter: filter, ziel: { ids: einmal(ids), felder: felderZiel, phasen: [], module: [] },
          fakten: [{ titel: 'Entscheide', zeilen: zeilen }]
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

  function rollenReise(lp, m) {
    var schritte = [];
    var folien = kapitelVon(lp, 'deepdive', 'rollen');
    var kapitel = 'Einstieg';
    folien.forEach(function (f) {
      if (f.typ === 'graph') { return; }
      if (f.typ === 'abschnitt') {
        kapitel = f.titel;
        /* «Der Auftraggeber» und die folgende Seite über die ganze Methode
           zeigen dasselbe — nur die Einleitung zu den weiteren Rollen ist
           ein eigener Schritt. */
        if (!/^Die weiteren/.test(f.titel)) { return; }
        schritte.push(schrittAusFolie(f, { key: 'abschnitt:' + f.titel, kapitel: kapitel, kicker: 'Rollen', sicht: SICHT_ROLLEN, ziel: null }));
        return;
      }
      if (f.typ === 'aussage' || f.typ === 'spalten') {
        var ids = (f.spalten || []).map(function (sp) {
          return HT.daten.eintragMitBegriff(String(sp.titel).split(' — ')[0], 'rolle');
        }).filter(Boolean).map(function (e) { return e.id; });
        schritte.push(schrittAusFolie(f, {
          key: 'folie:' + f.titel, kapitel: kapitel, kicker: 'Einstieg', sicht: SICHT_ROLLEN,
          ziel: ids.length ? { ids: ids, felder: [], phasen: [], module: [] } : null
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
      var zahlen = nV
        ? 'Verantwortet ' + zahlText(nV, 'Aufgabe', 'Aufgaben') + (nB ? ', beteiligt an ' + nB : '') + ' (je Phase gezählt). Das Raster zeigt die Aufgaben, die sie verantwortet.'
        : 'Verantwortet keine Aufgabe und ist an ' + zahlText(nB, 'Aufgabe', 'Aufgaben') + ' beteiligt (je Phase gezählt). Das Raster zeigt diese Aufgaben.';
      var filter = { rolle: rolle.begriff, bezug: bezug };
      if (f.typ === 'rollenweg' || f.typ === 'rolle') {
        schritte.push(schrittAusFolie(f, {
          key: 'rolle:' + rolle.begriff, kapitel: f.typ === 'rolle' ? 'Die weiteren Rollen' : kapitel, kicker: 'Rolle', titel: rolle.begriff,
          element: ref(rolle), zahlen: zahlen, sicht: SICHT_AUFGABEN, filter: filter, ziel: null,
          fakten: [{ titel: nV ? 'Verantwortet je Phase' : 'Beteiligt je Phase', zeilen: rolleFakten(nV ? verantw : beteiligt, f.typ === 'rolle') }]
        }));
        return;
      }
      if (f.typ === 'rollenphase') {
        var phase = m.phasen.indexOf(f.phase) !== -1 ? f.phase : null;
        if (!phase) { return; }
        var p = (nV ? verantw : beteiligt).filter(function (x) { return x.phase === phase; })[0];
        schritte.push(schrittAusFolie(f, {
          key: 'rollenphase:' + rolle.begriff + '|' + phase, kapitel: kapitel, kicker: rolle.begriff + ' · ' + phase,
          element: ref(rolle), sicht: SICHT_AUFGABEN, filter: filter, ziel: { ids: [], felder: [], phasen: [phase], module: [] },
          fakten: p && p.aufgaben.length ? [{ titel: (nV ? 'Verantwortet' : 'Beteiligt') + ' · ' + p.aufgaben.length, zeilen: p.aufgaben.map(function (t) {
            return { k: t.k, text: t.module.join(', '), links: t.ergebnisse, ms: t.ms };
          }) }] : []
        }));
      }
    });
    return schritte;
  }

  var BAUER = { ergebnisse: ergebnisseReise, phasen: phasenReise, rollen: rollenReise };

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
