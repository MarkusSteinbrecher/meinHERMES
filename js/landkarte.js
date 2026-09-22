/* meinHERMES — Landkarte: das Gesamtbild der Methode zum stufenlosen Zoomen.
   Entwurf, vorerst nur lokal unter #/landkarte (nicht in der Navigation).

   Aufbau wie die Abbildung 1: Phasen als Zeilen, Module als Spalten;
   Projektgrundlagen liegt in der Initialisierung über den Spalten
   Organisation bis IT-System. Ein Feld (Phase × Modul) enthält die Blöcke aus
   HT.graph.bloecke — je Aufgabe die verantwortliche Rolle und die Ergebnisse,
   die sie im Feld erzeugt, in der Reihenfolge des Graphen.

   Die Welt ist ein CSS-Grid in festen Einheiten (px bei Zoom 1), verschoben
   und skaliert über transform. Jedes Feld trägt drei übereinanderliegende
   Lagen; welche sichtbar ist, hängt nur vom Zoom ab:
     0 Übersicht  — je Feld Rollen, Aufgaben und Ergebnisse als Kreise mit Zahl
     1 Ergebnisse — die Ergebnisse mit Namen, Rollen und Aufgaben als Zahl
     2 Aufgaben   — je Aufgabe die Rolle darüber und die Ergebnisse darunter
   Die Zeilenhöhen ergeben sich aus der grösseren der Lagen 1 und 2, darum
   bleibt die Welt beim Wechsel der Lage stehen.

   Erstmals oder wiederholt: Massgebend ist die Phase. In der ersten Phase, in
   der ein Element vorkommt, ist es «erstmals» (gefüllt) — in jedem Modul
   dieser Phase —, in jeder späteren Phase «wiederholt» (gestrichelt). So heben
   sich etwa die Aufgaben der Projektführung, die in jeder Phase wiederkehren,
   von dem ab, was eine Phase neu bringt. Innerhalb einer Phase entscheidet die
   Spalte nicht: sonst gälte der Durchführungsauftrag in der Projektführung als
   wiederholt, nur weil die Projektsteuerung links von ihr steht. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};
  var h = HT.ui.h;

  /* Spalten in der Folge der Abbildung 1 (nicht der Daten). */
  var SPALTEN = ['Projektsteuerung', 'Projektführung', 'Organisation', 'Produkt', 'IT-System',
    'Beschaffung', 'Tests', 'Einführungsorganisation', 'IT-Migration', 'IT-Betrieb', 'ISDS'];
  /* Module ohne eigene Spalte liegen wie in der Abbildung über mehreren. In
     den Daten teilt sich keine Phase Projektgrundlagen mit diesen Spalten. */
  var SPANNEN = { Projektgrundlagen: { ab: 'Organisation', breite: 3 } };

  /* Masse der Welt in px bei Zoom 1. Projektführung hat in den mittleren
     Phasen doppelt so viel wie jede andere Spalte und bekommt Platz für drei
     statt zwei Unterspalten — sonst bestimmte sie allein die Zeilenhöhe. */
  var MASS = { spalte: 250, luecke: 12, rand: 64, kopf: 96 };
  var BREITER = { 'Projektführung': 380 };
  /* Ab diesem Zoom gilt Lage 1 bzw. 2; zurück erst 5 % darunter, damit die
     Lage an der Grenze nicht flackert. Lage 1 schreibt 10,5 px (bei 0,85 gut
     9 px auf dem Schirm), Lage 2 6,5 px (bei 1,7 gut 11 px). */
  var GRENZEN = [0.85, 1.7];
  var STUFEN = [
    { name: 'Übersicht', zoom: null },
    { name: 'Ergebnisse', zoom: 1.15 },
    { name: 'Aufgaben', zoom: 2.3 }
  ];
  var ZOOM_MAX = 6;
  /* Die Kreise der Übersicht behalten ihre Grösse auf dem Schirm, wachsen in
     der Welt aber höchstens auf das 2,2-Fache — sonst sprengen sie das Feld. */
  var GEGEN_MAX = 2.2;
  var KOPF_LEISTE = 34;   // Höhe der Modulköpfe auf dem Schirm
  var PHASE_BREITE = 26;  // Breite der Phasenleiste auf dem Schirm
  var UNTEN_FREI = 44;    // Legende und Zoom liegen unten auf der Bühne

  var IKONE_EINPASSEN = ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'];
  var KAT_REIHE = ['rolle', 'aufgabe', 'ergebnis'];

  var modelle = {};
  var lagenBereit = null;
  var laufende = null;   // Steuerung der Landkarte, die gerade steht

  /* --- Modell ---------------------------------------------------------------- */

  /* Die Reihenfolge des Graphen folgt der Abbildung 1, sobald ihre Kästen
     gelesen sind (wie im Überblick). Ohne Grafik gilt Phase und Name. */
  function lagenLaden() {
    if (lagenBereit) { return lagenBereit; }
    lagenBereit = !HT.abbildung ? global.Promise.resolve() : HT.abbildung.holen().then(function (text) {
      HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(HT.abbildung.kaesten(HT.abbildung.lesen(text))));
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
    return k.kategorie === 'ergebnis' && !!k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  /**
   * { vorgehen, zeilen: [{ phase, zellen: [zelle] }], vorkommen: { id: [{ zelle, erstmals }] } }
   * zelle: { phase, modul, spalte, bloecke, rollen, aufgaben, ergebnisse, neu: { id: bool } }
   */
  function modell(vorgehen) {
    if (modelle[vorgehen]) { return modelle[vorgehen]; }
    var module = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var vorkommen = {};
    var zeilen = HT.graph.phasenDerVorgehensweise(vorgehen).map(function (phase) {
      var zellen = [];
      module.forEach(function (modul) {
        var spalte = spalteVon(modul);
        if (!spalte) { return; }
        var bloecke = HT.graph.bloecke({ vorgehen: vorgehen, phasen: [phase], module: [modul] }, true);
        if (bloecke.length) { zellen.push({ phase: phase, modul: modul, spalte: spalte, bloecke: bloecke }); }
      });
      zellen.sort(function (a, b) { return a.spalte.start - b.spalte.start; });

      var frueher = {};
      Object.keys(vorkommen).forEach(function (id) { frueher[id] = true; });
      zellen.forEach(function (z) {
        z.rollen = []; z.aufgaben = []; z.ergebnisse = []; z.neu = {};
        var hier = {};
        function merken(k, liste) {
          if (!k || hier[k.id]) { return; }
          hier[k.id] = true;
          liste.push(k);
          z.neu[k.id] = !frueher[k.id];
          (vorkommen[k.id] = vorkommen[k.id] || []).push({ zelle: z, erstmals: z.neu[k.id] });
        }
        z.bloecke.forEach(function (b) {
          merken(b.rolle, z.rollen);
          merken(b.aufgabe, z.aufgaben);
          b.ergebnisse.forEach(function (k) { merken(k, z.ergebnisse); });
        });
      });
      return { phase: phase, zellen: zellen };
    });
    modelle[vorgehen] = { vorgehen: vorgehen, zeilen: zeilen, vorkommen: vorkommen };
    return modelle[vorgehen];
  }

  function feldName(z) { return z.phase + ' · ' + z.modul; }

  /* --- Lagen eines Felds ----------------------------------------------------- */

  function knoten(k, z, m) {
    var art = istMeilenstein(k) ? 'meilenstein' : k.kategorie;
    var neu = !!z.neu[k.id];
    var erste = m.vorkommen[k.id][0].zelle.phase;
    return h('button', {
      type: 'button', tabindex: '-1',
      class: 'lk-k lk-k--' + art + (neu ? ' ist-neu' : ' ist-wieder'),
      dataset: { id: k.id },
      title: k.begriff + (neu ? ' — erstmals in dieser Phase' : ' — wiederholt, erstmals in der Phase ' + erste)
    }, [
      art === 'ergebnis' ? null : HT.ui.katSymbol(art, 12),
      h('span', { class: 'lk-k__name', text: k.begriff })
    ]);
  }

  /* Eine Zeile der Übersicht: Icon, gefüllter Kreis für «erstmals»,
     gestrichelter für «wiederholt» (fehlt, wo die Zahl 0 ist). */
  function zahlZeile(kat, liste, z) {
    var neu = liste.filter(function (k) { return z.neu[k.id]; }).length;
    var wieder = liste.length - neu;
    var label = HT.graph.KAT[kat].label;
    return h('div', {
      class: 'lk-zahlzeile lk-farbe--' + kat,
      title: label + ': ' + neu + ' erstmals, ' + wieder + ' wiederholt'
    }, [
      HT.ui.katSymbol(kat, 14),
      neu ? h('span', { class: 'lk-kreis lk-kreis--neu', text: String(neu) }) : null,
      wieder ? h('span', { class: 'lk-kreis lk-kreis--wieder', text: String(wieder) }) : null
    ]);
  }

  function lageUebersicht(z) {
    return h('div', { class: 'lk-lage lk-lage--0' },
      h('div', { class: 'lk-zahlen' }, KAT_REIHE.map(function (kat) {
        var liste = { rolle: z.rollen, aufgabe: z.aufgaben, ergebnis: z.ergebnisse }[kat];
        return liste.length ? zahlZeile(kat, liste, z) : null;
      })));
  }

  function lageErgebnisse(z, m) {
    return h('div', { class: 'lk-lage lk-lage--1' }, [
      h('div', { class: 'lk-zahlen lk-zahlen--zeile' }, [
        zahlZeile('rolle', z.rollen, z),
        zahlZeile('aufgabe', z.aufgaben, z)
      ]),
      h('div', { class: 'lk-knotenliste' }, z.ergebnisse.map(function (k) { return knoten(k, z, m); }))
    ]);
  }

  function lageAufgaben(z, m) {
    return h('div', { class: 'lk-lage lk-lage--2' },
      h('div', { class: 'lk-bloecke' }, z.bloecke.map(function (b) {
        return h('div', { class: 'lk-block' }, [
          b.rolle ? knoten(b.rolle, z, m) : null,
          knoten(b.aufgabe, z, m),
          b.ergebnisse.length
            ? h('div', { class: 'lk-block__ergebnisse' }, b.ergebnisse.map(function (k) { return knoten(k, z, m); }))
            : null
        ]);
      })));
  }

  /* --- Welt ------------------------------------------------------------------ */

  function breiteVon(i) { return BREITER[SPALTEN[i]] || MASS.spalte; }
  function spalteX(i) {
    var x = MASS.rand + MASS.luecke;
    for (var j = 0; j < i; j++) { x += breiteVon(j) + MASS.luecke; }
    return x;
  }
  function spaltenBreite(sp) { return spalteX(sp.start + sp.breite) - MASS.luecke - spalteX(sp.start); }

  /* Abschnitte: jede Zeile mit einer Spanne (Initialisierung) hat ihre eigenen
     Modulköpfe, die übrigen Zeilen teilen sich einen gemeinsamen. */
  function weltBauen(m) {
    var welt = h('div', { class: 'lk-welt', dataset: { stufe: '0' } });
    welt.style.gridTemplateColumns = MASS.rand + 'px ' + SPALTEN.map(function (m, i) { return breiteVon(i) + 'px'; }).join(' ');
    welt.style.columnGap = MASS.luecke + 'px';
    var abschnitte = [], abschnitt = null, reihe = 1;

    m.zeilen.forEach(function (zeile, zi) {
      var mitSpanne = zeile.zellen.some(function (z) { return !!SPANNEN[z.modul]; });
      if (!abschnitt || mitSpanne || abschnitt.mitSpanne) {
        var platz = h('div', { class: 'lk-kopfplatz' });
        platz.style.gridRow = String(reihe);
        platz.style.gridColumn = '1 / -1';
        platz.style.height = MASS.kopf + 'px';
        welt.appendChild(platz);
        abschnitt = {
          mitSpanne: mitSpanne, platz: platz, zeilen: [],
          koepfe: mitSpanne
            ? zeile.zellen.map(function (z) { return { modul: z.modul, spalte: z.spalte }; })
            : SPALTEN.map(function (modul, i) { return { modul: modul, spalte: { start: i, breite: 1 } }; })
        };
        abschnitte.push(abschnitt);
        reihe++;
      }
      zeile.band = h('div', { class: 'lk-band' + (zi % 2 ? ' lk-band--2' : '') });
      zeile.band.style.gridRow = String(reihe);
      zeile.band.style.gridColumn = '1 / -1';
      welt.appendChild(zeile.band);
      zeile.zellen.forEach(function (z) {
        z.el = h('div', { class: 'lk-zelle', dataset: { phase: z.phase, modul: z.modul } }, [
          lageUebersicht(z), lageErgebnisse(z, m), lageAufgaben(z, m)
        ]);
        z.el.style.gridRow = String(reihe);
        z.el.style.gridColumn = (z.spalte.start + 2) + ' / span ' + z.spalte.breite;
        welt.appendChild(z.el);
      });
      abschnitt.zeilen.push(zeile);
      reihe++;
    });
    return { welt: welt, abschnitte: abschnitte };
  }

  /* --- Steuerung ------------------------------------------------------------- */

  function aufbauen(huelle, m, opt) {
    var gebaut = weltBauen(m);
    var welt = gebaut.welt, abschnitte = gebaut.abschnitte;
    var v = { s: 1, x: 0, y: 0 };
    var masse = { breite: 1, hoehe: 1 };
    var stufe = 0, eingepasst = true, gewaehlt = null, gleich = null, animation = 0;
    var index = {};   // id → Knöpfe

    Array.prototype.forEach.call(welt.querySelectorAll('.lk-k'), function (k) {
      (index[k.dataset.id] = index[k.dataset.id] || []).push(k);
    });

    /* Modulköpfe und Phasenleiste liegen über der Welt: Schrift in fester
       Grösse, Lage aus der Welt; oben bzw. links kleben sie, solange ihr
       Abschnitt bzw. ihre Zeile im Bild ist. */
    var koepfe = h('div', { class: 'lk-koepfe', 'aria-hidden': 'true' });
    abschnitte.forEach(function (a) {
      a.leiste = h('div', { class: 'lk-kopfleiste' });
      a.koepfe.forEach(function (k) {
        k.x = spalteX(k.spalte.start);
        k.w = spaltenBreite(k.spalte);
        k.el = h('button', { type: 'button', class: 'lk-modulkopf', tabindex: '-1', title: k.modul + ' — ganze Spalte zeigen' },
          h('span', { class: 'lk-modulkopf__text', text: k.modul }));
        k.el.addEventListener('click', function () { spalteZeigen(k.modul); });
        a.leiste.appendChild(k.el);
      });
      koepfe.appendChild(a.leiste);
    });
    m.zeilen.forEach(function (zeile) {
      zeile.phaseEl = h('button', { type: 'button', class: 'lk-phase', tabindex: '-1', title: zeile.phase + ' — ganze Phase zeigen' }, [
        h('span', { class: 'lk-phase__text lk-phase__text--lang', text: zeile.phase }),
        h('span', { class: 'lk-phase__text lk-phase__text--kurz', text: zeile.phase.slice(0, 4) + '.' })
      ]);
      zeile.phaseEl.addEventListener('click', function () { zeileZeigen(zeile); });
      koepfe.appendChild(zeile.phaseEl);
    });

    var stufenKnoepfe = STUFEN.map(function (st, i) {
      return h('button', {
        type: 'button', class: 'segment__knopf', text: st.name, 'aria-pressed': i === 0 ? 'true' : 'false',
        title: i ? 'Zoomen, bis die ' + st.name + ' mit Namen stehen' : 'Alles zeigen',
        on: { click: function () { stufeZeigen(i); } }
      });
    });
    var zoomleiste = h('div', { class: 'lk-schweber lk-schweber--zoom', role: 'group', 'aria-label': 'Zoom' }, [
      h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Verkleinern', title: 'Verkleinern', text: '−', on: { click: function () { zoomMitte(1 / 1.5); } } }),
      h('div', { class: 'segment', role: 'group', 'aria-label': 'Stufe' }, stufenKnoepfe),
      h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Vergrössern', title: 'Vergrössern', text: '+', on: { click: function () { zoomMitte(1.5); } } }),
      h('span', { class: 'ub-schweber__strich', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'ub-ikonknopf', 'aria-label': 'Alles zeigen', title: 'Alles zeigen (0)', on: { click: function () { einpassen(true); } } },
        HT.ui.symbol(IKONE_EINPASSEN, 18))
    ]);
    var legende = h('div', { class: 'lk-schweber lk-schweber--legende', 'aria-label': 'Legende' }, [
      h('span', { class: 'lk-legende' }, [h('span', { class: 'lk-muster lk-muster--neu', 'aria-hidden': 'true' }), 'erstmals']),
      h('span', { class: 'lk-legende' }, [h('span', { class: 'lk-muster lk-muster--wieder', 'aria-hidden': 'true' }), 'wiederholt']),
      h('span', { class: 'lk-legende lk-legende--kat' }, KAT_REIHE.map(function (kat) {
        return h('span', { class: 'lk-legende__kat lk-farbe--' + kat, title: HT.graph.KAT[kat].label }, [
          HT.ui.katSymbol(kat, 14), h('span', { text: HT.graph.KAT[kat].label })
        ]);
      }))
    ]);
    var karte = h('div', { class: 'lk-karte', role: 'dialog', 'aria-label': 'Gewähltes Element', hidden: true });

    var buehne = h('div', {
      class: 'lk-buehne', tabindex: '0',
      'aria-label': 'Gesamtbild zum Zoomen: Rad oder zwei Finger zoomen, Ziehen verschiebt, Pfeiltasten verschieben, + und − zoomen, 0 zeigt alles'
    }, [welt, koepfe, zoomleiste, legende, karte]);
    huelle.appendChild(buehne);

    /* --- Masse und Darstellung --- */

    function messen() {
      masse.breite = welt.offsetWidth;
      masse.hoehe = welt.offsetHeight;
      abschnitte.forEach(function (a) {
        a.kopfUnten = a.platz.offsetTop + a.platz.offsetHeight;
        var letzte = a.zeilen[a.zeilen.length - 1].band;
        a.ende = letzte.offsetTop + letzte.offsetHeight;
      });
      m.zeilen.forEach(function (zeile) {
        zeile.oben = zeile.band.offsetTop;
        zeile.hoehe = zeile.band.offsetHeight;
        /* Länge der Beschriftung, damit zu kurze Zeilen die Kurzform zeigen. */
        var el = zeile.phaseEl, war = el.hidden, kurz = el.classList.contains('ist-kurz');
        el.hidden = false;
        el.classList.remove('ist-kurz');
        zeile.textLang = el.querySelector('.lk-phase__text--lang').offsetHeight;
        el.classList.add('ist-kurz');
        zeile.textKurz = el.querySelector('.lk-phase__text--kurz').offsetHeight;
        el.classList.toggle('ist-kurz', kurz);
        el.hidden = war;
      });
    }

    function stufeVon(s) {
      var aus = 0;
      GRENZEN.forEach(function (g, i) { if (s >= (stufe > i ? g * 0.95 : g)) { aus = i + 1; } });
      return aus;
    }

    function anwenden() {
      welt.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.s + ')';
      welt.style.setProperty('--lk-k', (1 / v.s).toFixed(4));
      welt.style.setProperty('--lk-g', Math.min(1 / v.s, GEGEN_MAX).toFixed(4));
      var neu = stufeVon(v.s);
      if (neu !== stufe) {
        stufe = neu;
        welt.dataset.stufe = String(stufe);
        stufenKnoepfe.forEach(function (k, i) { k.setAttribute('aria-pressed', i === stufe ? 'true' : 'false'); });
      }
      koepfeSetzen();
      phasenSetzen();
    }

    function koepfeSetzen() {
      var H = buehne.clientHeight;
      abschnitte.forEach(function (a) {
        var unten = v.y + a.kopfUnten * v.s - KOPF_LEISTE;
        var ende = v.y + a.ende * v.s - KOPF_LEISTE;
        var oben = Math.min(Math.max(unten, 0), ende);
        a.leiste.hidden = ende < -KOPF_LEISTE || oben > H;
        a.leiste.classList.toggle('ist-klebend', unten < 0);
        a.leiste.style.transform = 'translateY(' + Math.round(oben) + 'px)';
        a.koepfe.forEach(function (k) {
          k.el.hidden = k.w * v.s < 44;
          k.el.style.left = (v.x + k.x * v.s) + 'px';
          k.el.style.width = Math.max(0, k.w * v.s) + 'px';
        });
      });
    }

    function phasenSetzen() {
      var H = buehne.clientHeight;
      var links = Math.max(0, v.x + MASS.rand * v.s - PHASE_BREITE - 4);
      m.zeilen.forEach(function (zeile) {
        var oben = Math.max(v.y + zeile.oben * v.s, 0);
        var unten = Math.min(v.y + (zeile.oben + zeile.hoehe) * v.s, H);
        zeile.phaseEl.hidden = unten - oben < zeile.textKurz + 10;
        zeile.phaseEl.classList.toggle('ist-kurz', unten - oben < zeile.textLang + 16);
        zeile.phaseEl.style.left = links + 'px';
        zeile.phaseEl.style.top = (oben + 1) + 'px';
        zeile.phaseEl.style.height = Math.max(0, unten - oben - 2) + 'px';
      });
    }

    function einpassMass() {
      return Math.min((buehne.clientWidth - 32) / masse.breite, (buehne.clientHeight - 24 - UNTEN_FREI) / masse.hoehe);
    }

    function begrenzen() {
      var W = buehne.clientWidth, H = buehne.clientHeight, rest = 80;
      v.x = Math.min(Math.max(v.x, rest - masse.breite * v.s), W - rest);
      v.y = Math.min(Math.max(v.y, rest - masse.hoehe * v.s), H - rest);
    }

    function zoomGrenzen(s) {
      return Math.min(Math.max(s, Math.min(einpassMass() * 0.6, 0.3)), ZOOM_MAX);
    }

    /* Zoomt um den Punkt (px, py) der Bühne: der Weltpunkt darunter bleibt stehen. */
    function zoomUm(faktor, px, py) {
      var s1 = zoomGrenzen(v.s * faktor);
      if (s1 === v.s) { return; }
      v.x = px - (px - v.x) * (s1 / v.s);
      v.y = py - (py - v.y) * (s1 / v.s);
      v.s = s1;
      eingepasst = false;
      begrenzen();
      anwenden();
    }

    function zielFuer(r, sMin, sMax) {
      /* Steht die Karte rechts, zählt nur die Fläche links davon. */
      var W = buehne.clientWidth, H = buehne.clientHeight, pad = 28;
      var frei = !karte.hidden && W > 900 ? karte.offsetWidth + 24 : 0;
      var s = Math.min((W - frei - 2 * pad) / r.w, (H - KOPF_LEISTE - 2 * pad) / r.h);
      if (sMax) { s = Math.min(s, sMax); }
      if (sMin) { s = Math.max(s, sMin); }
      s = zoomGrenzen(s);
      return { s: s, x: (W - frei) / 2 - (r.x + r.w / 2) * s, y: KOPF_LEISTE / 2 + H / 2 - (r.y + r.h / 2) * s };
    }

    /* Fliegt zur Ansicht ziel; der Weltpunkt in der Mitte wandert linear,
       der Zoom logarithmisch. Ohne Animation, wenn der Tab verborgen ist oder
       weniger Bewegung gewünscht wird — Hintergrundtabs führen
       requestAnimationFrame nicht aus. */
    function fliegen(ziel, danach) {
      var nr = ++animation;
      var W2 = buehne.clientWidth / 2, H2 = buehne.clientHeight / 2;
      var a = { s: v.s, cx: (W2 - v.x) / v.s, cy: (H2 - v.y) / v.s };
      var b = { s: ziel.s, cx: (W2 - ziel.x) / ziel.s, cy: (H2 - ziel.y) / ziel.s };
      var ruhig = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function fertig() {
        if (nr !== animation) { return; }
        animation++;
        v.s = ziel.s; v.x = ziel.x; v.y = ziel.y;
        anwenden();
        if (danach) { danach(); }
      }
      if (document.hidden || ruhig) { fertig(); return; }
      var dauer = 420, t0 = null;
      function schritt(jetzt) {
        if (nr !== animation) { return; }
        if (t0 === null) { t0 = jetzt; }
        var t = Math.min(1, (jetzt - t0) / dauer);
        if (t >= 1) { fertig(); return; }
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        v.s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e);
        v.x = W2 - (a.cx + (b.cx - a.cx) * e) * v.s;
        v.y = H2 - (a.cy + (b.cy - a.cy) * e) * v.s;
        anwenden();
        global.requestAnimationFrame(schritt);
      }
      global.requestAnimationFrame(schritt);
      global.setTimeout(fertig, dauer + 400);
    }

    /* Schmal wäre das ganze Bild unlesbar klein (bei 390 px Zoom 0,11): dort
       beginnt es links oben in der Grösse, in der die Zahlen noch lesbar sind. */
    function einpassen(animiert) {
      var W = buehne.clientWidth, s = zoomGrenzen(einpassMass());
      if (W < 700) { s = zoomGrenzen(Math.max(s, 0.32)); }
      var ziel = {
        s: s,
        x: masse.breite * s <= W ? (W - masse.breite * s) / 2 : 8,
        y: Math.max(8, (buehne.clientHeight - UNTEN_FREI - masse.hoehe * s) / 2)
      };
      if (animiert) { fliegen(ziel, function () { eingepasst = true; }); }
      else { animation++; v = ziel; eingepasst = true; anwenden(); }
    }

    function zoomMitte(faktor) {
      var s1 = zoomGrenzen(v.s * faktor), W2 = buehne.clientWidth / 2, H2 = buehne.clientHeight / 2;
      eingepasst = false;
      fliegen({ s: s1, x: W2 - (W2 - v.x) * (s1 / v.s), y: H2 - (H2 - v.y) * (s1 / v.s) });
    }

    function stufeZeigen(i) {
      if (!STUFEN[i].zoom) { einpassen(true); return; }
      zoomMitte(STUFEN[i].zoom / v.s);
    }

    /* Rechteck eines Elements in Weltkoordinaten — auch in verborgenen Lagen,
       die Layout haben, nur unsichtbar sind. */
    function weltRechteck(el) {
      var r = el.getBoundingClientRect(), w = welt.getBoundingClientRect();
      return { x: (r.left - w.left) / v.s, y: (r.top - w.top) / v.s, w: r.width / v.s, h: r.height / v.s };
    }

    function zeileZeigen(zeile) {
      eingepasst = false;
      fliegen(zielFuer({ x: 0, y: zeile.oben, w: masse.breite, h: zeile.hoehe }));
    }

    function spalteZeigen(modul) {
      var zellen = [];
      m.zeilen.forEach(function (zeile) {
        zeile.zellen.forEach(function (z) { if (z.modul === modul) { zellen.push(z); } });
      });
      if (!zellen.length) { return; }
      var oben = Infinity, unten = -Infinity;
      zellen.forEach(function (z) {
        var r = weltRechteck(z.el);
        oben = Math.min(oben, r.y);
        unten = Math.max(unten, r.y + r.h);
      });
      var sp = zellen[0].spalte;
      eingepasst = false;
      fliegen(zielFuer({ x: spalteX(sp.start), y: oben, w: spaltenBreite(sp), h: unten - oben }, null, 2.6));
    }

    function feldZeigen(z) {
      eingepasst = false;
      fliegen(zielFuer(weltRechteck(z.el), STUFEN[1].zoom, 2.6));
    }

    /* Zu einem Vorkommen: Ergebnisse stehen schon in Lage 1 mit Namen,
       Aufgaben und Rollen erst in Lage 2. */
    function zuVorkommen(vk, id) {
      var zielStufe = Math.max(stufe, HT.daten.eintragMitId(id).kategorie === 'ergebnis' ? 1 : 2);
      var el = vk.zelle.el.querySelector('.lk-lage--' + zielStufe + ' [data-id="' + id + '"]')
        || vk.zelle.el.querySelector('.lk-lage--2 [data-id="' + id + '"]');
      if (!el) { feldZeigen(vk.zelle); return; }
      var r = weltRechteck(el);
      var s = Math.max(v.s, STUFEN[zielStufe].zoom);
      var rand = 160 / s;
      eingepasst = false;
      fliegen(zielFuer({ x: r.x - rand, y: r.y - rand, w: r.w + 2 * rand, h: r.h + 2 * rand }, s, s));
    }

    /* --- Auswahl und Karte --- */

    function gleicheZeigen(id) {
      if (id === gleich) { return; }
      (index[gleich] || []).forEach(function (k) { k.classList.remove('ist-gleich'); });
      gleich = id;
      (index[gleich] || []).forEach(function (k) { k.classList.add('ist-gleich'); });
    }

    function waehlen(id) {
      if (gewaehlt) {
        (index[gewaehlt] || []).forEach(function (k) { k.classList.remove('ist-gewaehlt'); });
        (m.vorkommen[gewaehlt] || []).forEach(function (vk) { vk.zelle.el.classList.remove('hat-gewaehlt', 'ist-erstmals'); });
      }
      gewaehlt = id && m.vorkommen[id] ? id : null;
      welt.classList.toggle('hat-auswahl', !!gewaehlt);
      if (gewaehlt) {
        (index[gewaehlt] || []).forEach(function (k) { k.classList.add('ist-gewaehlt'); });
        m.vorkommen[gewaehlt].forEach(function (vk) {
          vk.zelle.el.classList.add('hat-gewaehlt');
          if (vk.erstmals) { vk.zelle.el.classList.add('ist-erstmals'); }
        });
      }
      karteSetzen();
      if (opt.beiAuswahl) { opt.beiAuswahl(gewaehlt); }
    }

    function karteSetzen() {
      HT.ui.leeren(karte);
      karte.hidden = !gewaehlt;
      if (!gewaehlt) { return; }
      var e = HT.daten.eintragMitId(gewaehlt);
      var liste = m.vorkommen[gewaehlt];
      var art = e.kategorie === 'ergebnis' && e.typ === 'Meilenstein' ? 'meilenstein' : e.kategorie;
      var erste = liste.filter(function (vk) { return vk.erstmals; });
      var wieder = liste.length - erste.length;
      var ersteText = erste[0].zelle.phase + ' · ' + erste.map(function (vk) { return vk.zelle.modul; }).join(', ');

      var fakten = [];
      if (e.kategorie === 'aufgabe' && e.verantwortlich) { fakten.push(['Verantwortlich', e.verantwortlich]); }
      if (e.kategorie === 'ergebnis' && e.typ) { fakten.push(['Typ', e.typ]); }

      karte.appendChild(h('div', { class: 'gpop__kopf' }, [
        h('span', { class: 'lk-karte__kat lk-farbe--' + e.kategorie }, [
          HT.ui.katSymbol(art, 14),
          h('span', { class: 'gpop__titel', text: art === 'meilenstein' ? 'Meilenstein' : HT.graph.KAT[e.kategorie].singular })
        ]),
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Auswahl aufheben', text: '✕', on: { click: function () { waehlen(null); buehne.focus(); } } })
      ]));
      karte.appendChild(h('div', { class: 'gpop__inhalt' }, [
        h('h2', { class: 'lk-karte__titel', text: e.begriff }),
        e.kurz ? h('p', { class: 'lk-karte__kurz', text: e.kurz }) : null,
        fakten.length ? h('dl', { class: 'lk-karte__fakten' }, fakten.map(function (f) {
          return h('div', {}, [h('dt', { text: f[0] }), h('dd', { text: f[1] })]);
        })) : null,
        h('h3', { class: 'gpop__abschnitt', text: 'Vorkommen · ' + liste.length }),
        h('p', { class: 'lk-karte__hinweis', text: wieder
          ? 'Erstmals in ' + ersteText + ', danach ' + (wieder === 1 ? 'einmal' : wieder + '-mal') + ' wiederholt.'
          : (liste.length === 1 ? 'Nur in ' : 'Nur in der Phase ') + ersteText + '.' }),
        h('ol', { class: 'lk-vorkommen' }, liste.map(function (vk) {
          return h('li', {}, h('button', {
            type: 'button', class: 'lk-vorkommen__knopf' + (vk.erstmals ? ' ist-neu' : ' ist-wieder'),
            on: { click: function () { zuVorkommen(vk, gewaehlt); } }
          }, [
            h('span', { class: 'lk-muster lk-muster--' + (vk.erstmals ? 'neu' : 'wieder') + ' lk-farbe--' + e.kategorie, 'aria-hidden': 'true' }),
            h('span', { class: 'lk-vorkommen__feld', text: feldName(vk.zelle) }),
            h('span', { class: 'lk-vorkommen__art', text: vk.erstmals ? 'erstmals' : 'wiederholt' })
          ]));
        })),
        h('p', { class: 'lk-karte__links' }, [
          h('a', { class: 'hb-online', href: '#/handbuch?id=' + encodeURIComponent(e.id), text: 'Im Handbuch' }),
          HT.ui.quellenLink(e.quelle, 'hb-online')
        ])
      ]));
    }

    /* --- Eingaben --- */

    function punkt(ev) {
      var r = buehne.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function aufBedienung(ziel) {
      return !!(ziel && ziel.closest && ziel.closest('.lk-schweber, .lk-karte, .lk-modulkopf, .lk-phase'));
    }

    buehne.addEventListener('wheel', function (ev) {
      if (ev.target.closest && ev.target.closest('.lk-karte')) { return; }
      ev.preventDefault();
      animation++;
      var p = punkt(ev);
      var dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
      if (!ev.ctrlKey && Math.abs(ev.deltaX) > Math.abs(dy)) {
        v.x -= ev.deltaX;
        eingepasst = false;
        begrenzen();
        anwenden();
        return;
      }
      zoomUm(Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    }, { passive: false });

    var zeiger = {}, zug = null, pinch = null, nachZug = false;

    function pinchStart() {
      var ps = Object.keys(zeiger).map(function (k) { return zeiger[k]; });
      var mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
      return { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, s: v.s, wx: (mx - v.x) / v.s, wy: (my - v.y) / v.s };
    }

    buehne.addEventListener('pointerdown', function (ev) {
      if (aufBedienung(ev.target) || (ev.pointerType === 'mouse' && ev.button !== 0)) { return; }
      animation++;
      zeiger[ev.pointerId] = punkt(ev);
      var n = Object.keys(zeiger).length;
      if (n === 1) {
        zug = { id: ev.pointerId, p: zeiger[ev.pointerId], x: v.x, y: v.y, bewegt: false };
      } else if (n === 2) {
        zug = null;
        pinch = pinchStart();
        nachZug = true;
      }
    });

    buehne.addEventListener('pointermove', function (ev) {
      if (!zeiger[ev.pointerId]) { return; }
      var p = zeiger[ev.pointerId] = punkt(ev);
      if (pinch && Object.keys(zeiger).length >= 2) {
        var ps = Object.keys(zeiger).map(function (k) { return zeiger[k]; });
        var d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        v.s = zoomGrenzen(pinch.s * d / pinch.d);
        v.x = (ps[0].x + ps[1].x) / 2 - pinch.wx * v.s;
        v.y = (ps[0].y + ps[1].y) / 2 - pinch.wy * v.s;
        eingepasst = false;
        begrenzen();
        anwenden();
        return;
      }
      if (!zug || ev.pointerId !== zug.id) { return; }
      var dx = p.x - zug.p.x, dy = p.y - zug.p.y;
      if (!zug.bewegt) {
        if (Math.hypot(dx, dy) <= 5) { return; }
        zug.bewegt = true;
        try { buehne.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
        buehne.classList.add('ist-am-ziehen');
        gleicheZeigen(null);
      }
      v.x = zug.x + dx;
      v.y = zug.y + dy;
      eingepasst = false;
      begrenzen();
      anwenden();
    });

    function zeigerWeg(ev) {
      if (!zeiger[ev.pointerId]) { return; }
      delete zeiger[ev.pointerId];
      if (Object.keys(zeiger).length < 2) { pinch = null; }
      if (zug && zug.id === ev.pointerId) {
        if (zug.bewegt) { nachZug = true; }
        zug = null;
        buehne.classList.remove('ist-am-ziehen');
      }
      /* Ein Zug oder zwei Finger lösen keinen Klick aus. */
      if (nachZug) { global.setTimeout(function () { nachZug = false; }, 0); }
    }
    buehne.addEventListener('pointerup', zeigerWeg);
    buehne.addEventListener('pointercancel', zeigerWeg);

    buehne.addEventListener('click', function (ev) {
      if (nachZug) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (aufBedienung(ev.target)) { return; }
      var k = ev.target.closest('.lk-k');
      if (k && welt.contains(k)) { waehlen(k.dataset.id === gewaehlt ? null : k.dataset.id); return; }
      /* In der Übersicht führt ein Klick ins Feld hinein, sonst hebt er die Auswahl auf. */
      var feld = stufe === 0 ? ev.target.closest('.lk-zelle') : null;
      if (feld) {
        m.zeilen.forEach(function (zeile) { zeile.zellen.forEach(function (z) { if (z.el === feld) { feldZeigen(z); } }); });
        return;
      }
      waehlen(null);
    }, true);

    buehne.addEventListener('dblclick', function (ev) {
      if (aufBedienung(ev.target) || ev.target.closest('.lk-k')) { return; }
      var p = punkt(ev);
      var s1 = zoomGrenzen(v.s * 2);
      eingepasst = false;
      fliegen({ s: s1, x: p.x - (p.x - v.x) * (s1 / v.s), y: p.y - (p.y - v.y) * (s1 / v.s) });
    });

    welt.addEventListener('mouseover', function (ev) {
      if (zug && zug.bewegt) { return; }
      var k = ev.target.closest('.lk-k');
      gleicheZeigen(k ? k.dataset.id : null);
    });
    welt.addEventListener('mouseleave', function () { gleicheZeigen(null); });

    buehne.addEventListener('keydown', function (ev) {
      if (ev.target !== buehne || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
      var schritt = 80, tat = true;
      switch (ev.key) {
        case '+': case '=': zoomMitte(1.5); break;
        case '-': case '_': zoomMitte(1 / 1.5); break;
        case '0': einpassen(true); break;
        case 'ArrowLeft': v.x += schritt; break;
        case 'ArrowRight': v.x -= schritt; break;
        case 'ArrowUp': v.y += schritt; break;
        case 'ArrowDown': v.y -= schritt; break;
        case 'Escape': if (gewaehlt) { waehlen(null); } else { tat = false; } break;
        default: tat = false;
      }
      if (!tat) { return; }
      ev.preventDefault();
      if (ev.key.indexOf('Arrow') === 0) { animation++; eingepasst = false; begrenzen(); anwenden(); }
    });

    /* Grösse der Bühne und nachgeladene Schrift ändern Masse bzw. Umbrüche:
       eingepasst bleibt eingepasst, sonst bleibt die Mitte stehen. */
    var alteGroesse = { w: 0, h: 0 };
    function neuMessen() {
      if (!document.body.contains(buehne)) { return; }
      var W = buehne.clientWidth, H = buehne.clientHeight;
      messen();
      if (eingepasst || !alteGroesse.w) { einpassen(false); }
      else {
        v.x += (W - alteGroesse.w) / 2;
        v.y += (H - alteGroesse.h) / 2;
        begrenzen();
        anwenden();
      }
      alteGroesse = { w: W, h: H };
    }
    if (global.ResizeObserver) {
      new global.ResizeObserver(neuMessen).observe(buehne);
    }
    neuMessen();
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(neuMessen); }

    return {
      modell: m,
      buehne: buehne,
      gewaehlt: function () { return gewaehlt; },
      /* Für die Suche in der Kopfzeile und Direktlinks. */
      zeigen: function (id) {
        var e = HT.daten.eintragMitId(id);
        if (!e) { return false; }
        if (e.kategorie === 'phase') {
          var zeile = m.zeilen.filter(function (z) { return z.phase === e.begriff; })[0];
          if (zeile) { zeileZeigen(zeile); }
          return !!zeile;
        }
        if (e.kategorie === 'modul') { spalteZeigen(e.begriff); return true; }
        if (!m.vorkommen[id]) { return false; }
        waehlen(id);
        zuVorkommen(m.vorkommen[id][0], id);
        return true;
      },
      /* Nur für Tests im Browser. */
      ansicht: function () { return { s: v.s, x: v.x, y: v.y, stufe: stufe, breite: masse.breite, hoehe: masse.hoehe }; },
      setzen: function (s, x, y) { animation++; v = { s: s, x: x, y: y }; eingepasst = false; anwenden(); }
    };
  }

  /* --- Ansicht --------------------------------------------------------------- */

  function adresse(vorgehen, id) {
    var teile = [];
    if (vorgehen === 'agil') { teile.push('vorgehen=agil'); }
    if (id) { teile.push('id=' + encodeURIComponent(id)); }
    var hash = '#/landkarte' + (teile.length ? '?' + teile.join('&') : '');
    try { global.history.replaceState(null, '', hash); } catch (e) { /* egal */ }
  }

  function infoInhalt() {
    return [
      h('p', { text: 'Entwurf: das Gesamtbild der Methode wie Abbildung 1 des Referenzhandbuchs — Phasen als Zeilen, Module als Spalten —, aber mit Rollen, Aufgaben und Ergebnissen, und stufenlos zu zoomen.' }),
      h('p', { text: 'Rad, Trackpad oder zwei Finger zoomen, Ziehen verschiebt, Doppelklick zoomt hinein; + und − und 0 (alles) gehen auch mit der Tastatur. Aus der Ferne steht je Feld nur die Zahl der Rollen, Aufgaben und Ergebnisse; näher kommen die Ergebnisse mit Namen, noch näher jede Aufgabe mit ihrer verantwortlichen Rolle darüber und den Ergebnissen darunter. Die Stufen unten rechts springen direkt dorthin, ein Klick auf ein Feld der Übersicht, einen Modulkopf oder eine Phase zeigt genau das.' }),
      h('h3', { class: 'gpop__abschnitt', text: 'Erstmals oder wiederholt' }),
      h('p', { text: 'Massgebend ist die Phase: In der ersten Phase, in der ein Element vorkommt, ist es gefüllt, in jedem Modul dieser Phase; in jeder späteren Phase steht es gestrichelt. In der Übersicht zählt der gefüllte Kreis, was ein Feld in dieser Phase neu bringt, der gestrichelte, was aus früheren Phasen wiederkehrt — etwa die Aufgaben der Projektführung, die jede Phase erneut hat.' }),
      h('p', { text: 'Ein Klick auf ein Element hebt alle seine Stellen hervor und nennt sie in der Karte rechts; ein Klick auf eine Stelle fliegt dorthin. Die Suche in der Kopfzeile findet Elemente, Phasen und Module auch hier.' }),
      h('h3', { class: 'gpop__abschnitt', text: 'Grundlage' }),
      h('p', { text: 'Je Feld die Aufgaben der Tabellen «Aufgaben und Ergebnisse Modul …» mit der verantwortlichen Rolle und den Ergebnissen, die sie in dieser Phase erzeugen — dieselben Blöcke wie im Zuordnen des Trainers. Beteiligte Rollen sind nicht gezählt.' })
    ];
  }

  function render(behaelter, params) {
    var vorgehen = params.vorgehen === 'agil' ? 'agil' : 'klassisch';
    var huelle = h('div', { class: 'lk' }, h('p', { class: 'ub-buehne__laden', text: 'Gesamtbild wird aufgebaut' }));
    behaelter.appendChild(huelle);

    function leisteSetzen() {
      HT.app.unterleiste({
        label: 'Gesamtbild zum Zoomen',
        inhaltLabel: 'Vorgehensweise',
        inhalt: [
          h('span', { class: 'lk-leiste__titel' }, [
            h('span', { text: 'Gesamtbild zum Zoomen' }),
            h('span', { class: 'lk-leiste__entwurf', text: 'Entwurf' })
          ]),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'segment', role: 'group', 'aria-label': 'Vorgehensweise' },
            [['klassisch', 'Klassisch'], ['agil', 'Agil']].map(function (o) {
              return h('button', {
                type: 'button', class: 'segment__knopf', text: o[1], 'aria-pressed': o[0] === vorgehen ? 'true' : 'false',
                on: { click: function () {
                  if (o[0] === vorgehen) { return; }
                  var id = laufende ? laufende.gewaehlt() : null;
                  vorgehen = o[0];
                  leisteSetzen();
                  starten(id);
                } }
              });
            }))
        ],
        info: { titel: 'Gesamtbild zum Zoomen', inhalt: infoInhalt }
      });
    }

    function starten(id) {
      lagenLaden().then(function () {
        if (!document.body.contains(huelle)) { return; }
        HT.ui.leeren(huelle);
        laufende = null;
        var m = modell(vorgehen);
        laufende = aufbauen(huelle, m, { beiAuswahl: function (gid) { adresse(vorgehen, gid); } });
        adresse(vorgehen, id && m.vorkommen[id] ? id : null);
        if (id) { laufende.zeigen(id); }
      });
    }

    leisteSetzen();
    starten(params.id || null);
  }

  HT.views.landkarte = {
    titel: 'Gesamtbild zum Zoomen',
    nav: 'ueberblick',
    render: render,
    suchtreffer: function (e) {
      return !!(laufende && document.body.contains(laufende.buehne) && laufende.zeigen(e.id));
    },
    /* Für Tests im Browser. */
    laufende: function () { return laufende; }
  };
}(window));
