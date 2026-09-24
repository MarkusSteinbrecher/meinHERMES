/* meinHERMES — Graph zeichnen.
   Reines SVG ohne Abhängigkeiten: Spaltenlayout (Rolle, Aufgabe, Ergebnis),
   Knotenformen je Kategorie, Kantenstile je Beziehung, Verschieben und Zoomen
   mit Maus, Rad und Touch, Hervorhebung eines Knotens samt Nachbarn. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var KNOTEN_HOEHE = 36;
  var GLYPH_R = 10;
  var GLYPH_KANTE = 14;   /* Kantenlänge des Kategorie-Icons im Knotenkreis */
  var KNOTEN_RADIUS = 6;  /* Ecken der Kästen von Aufgabe und Ergebnis */
  /* Das kleine Phasenmodell (in der Karte beim Überfahren eines Knotens)
     bildet das Phasenmodell der Methode nach, wie es die HERMES-Übersicht
     zeigt: links Initialisierung, dann Konzept, Realisierung und Einführung
     oben und darunter Umsetzung (agil) über dieselbe Breite, rechts
     Abschluss. Alle Felder gleich hoch; Initialisierung und Abschluss stehen
     mittig zwischen den beiden Reihen. Ursprung links oben. */
  var ZELLE = 7, ZELLE_LUECKE = 1.5, STREIFEN_H = 20;
  var HALB = (STREIFEN_H - ZELLE_LUECKE) / 2;
  var MITTIG = (STREIFEN_H - HALB) / 2;
  var PHASEN_ZELLEN = [
    { name: 'Initialisierung', x: 0, y: MITTIG, w: ZELLE, h: HALB },
    { name: 'Konzept',         x: ZELLE + ZELLE_LUECKE, y: 0, w: ZELLE, h: HALB },
    { name: 'Realisierung',    x: 2 * (ZELLE + ZELLE_LUECKE), y: 0, w: ZELLE, h: HALB },
    { name: 'Einführung',      x: 3 * (ZELLE + ZELLE_LUECKE), y: 0, w: ZELLE, h: HALB },
    { name: 'Umsetzung',       x: ZELLE + ZELLE_LUECKE, y: HALB + ZELLE_LUECKE, w: 3 * ZELLE + 2 * ZELLE_LUECKE, h: HALB },
    { name: 'Abschluss',       x: 4 * (ZELLE + ZELLE_LUECKE), y: MITTIG, w: ZELLE, h: HALB }
  ];
  var STREIFEN_B = 5 * ZELLE + 4 * ZELLE_LUECKE;
  var TYP_SYMBOL = { Dokument: '▤', Checkliste: '☑', Zustand: '●', Meilenstein: '◆' };

  /* --- SVG-Helfer ---------------------------------------------------------- */

  function s(tag, attrs, kinder) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'text') { el.textContent = String(v); }
        else if (k === 'class') { el.setAttribute('class', String(v)); }
        else { el.setAttribute(k, String(v)); }
      });
    }
    if (kinder) {
      (Array.isArray(kinder) ? kinder : [kinder]).forEach(function (kind) {
        if (kind) { el.appendChild(kind); }
      });
    }
    return el;
  }

  function rund(n) { return Math.round(n * 10) / 10; }

  /* --- Textbreite messen -------------------------------------------------- */

  var messKontext = null;
  var messSchrift = { normal: '600 14px sans-serif', klein: '700 10px sans-serif' };

  function schriftLesen(container) {
    var probe = document.createElement('span');
    probe.className = 'graph-messprobe';
    probe.textContent = 'Probe';
    container.appendChild(probe);
    var stil = global.getComputedStyle(probe);
    var familie = stil.fontFamily || 'sans-serif';
    container.removeChild(probe);
    messSchrift.normal = '600 14px ' + familie;
    messSchrift.klein = '700 10px ' + familie;
  }

  function messen(text, art) {
    if (!messKontext) {
      var canvas = document.createElement('canvas');
      messKontext = canvas.getContext('2d');
    }
    messKontext.font = messSchrift[art || 'normal'];
    return messKontext.measureText(String(text || '')).width;
  }

  /* --- Knotenmasse --------------------------------------------------------- */

  /* Meilensteine sind Ergebnisse — aber die Quality Gates des Phasenmodells.
     Sie stehen darum wie Rollen ohne Kasten, nur mit ihrem Zeichen (Raute)
     statt Dokument, und tragen das Typ-Symbol nicht doppelt. */
  function istMeilenstein(k) {
    return k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  function knotenBreite(k) {
    var w = 12 + GLYPH_R * 2 + 8 + messen(k.begriff, 'normal') + 14;
    if (!istMeilenstein(k) && k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ) { w += 20; }
    return Math.ceil(w);
  }

  /* --- Knotenformen -------------------------------------------------------- */

  function formPfad(kategorie, w, h, meilenstein) {
    var c;
    switch (meilenstein ? 'rolle' : kategorie) {
      case 'aufgabe':    // Kasten mit abgerundeten Ecken
      case 'ergebnis':
        c = KNOTEN_RADIUS;
        return 'M' + c + ' 0H' + (w - c) + 'A' + c + ' ' + c + ' 0 0 1 ' + w + ' ' + c + 'V' + (h - c)
          + 'A' + c + ' ' + c + ' 0 0 1 ' + (w - c) + ' ' + h + 'H' + c + 'A' + c + ' ' + c + ' 0 0 1 0 ' + (h - c)
          + 'V' + c + 'A' + c + ' ' + c + ' 0 0 1 ' + c + ' 0Z';
      case 'rolle':      // Pille — unsichtbar, nur Trefffläche (auch Meilenstein)
        c = h / 2;
        return 'M' + c + ' 0H' + (w - c) + 'A' + c + ' ' + c + ' 0 0 1 ' + (w - c) + ' ' + h + 'H' + c + 'A' + c + ' ' + c + ' 0 0 1 ' + c + ' 0Z';
      default:           // Kasten (Rückfall)
        c = 5;
        return 'M' + c + ' 0H' + (w - c) + 'Q' + w + ' 0 ' + w + ' ' + c + 'V' + (h - c) + 'Q' + w + ' ' + h + ' ' + (w - c) + ' ' + h + 'H' + c + 'Q0 ' + h + ' 0 ' + (h - c) + 'V' + c + 'Q0 0 ' + c + ' 0Z';
    }
  }

  /* Kategorie-Icon (24er-Raster aus HT.ui) in den Knotenkreis skaliert. */
  function ikone(kategorie, cx, cy, kante) {
    return HT.ui.katGruppe(kategorie, cx, cy, kante, 'gk__ikone');
  }

  function knotenElement(k, opt) {
    var w = k.w, h = k.h;
    var meta = HT.graph.KAT[k.kategorie];
    var istMs = istMeilenstein(k);
    var klassen = ['gk', 'gk--' + k.kategorie];
    if (istMs) { klassen.push('gk--meilenstein'); }
    if (k.entscheid) { klassen.push('gk--entscheid'); }

    var label = (istMs ? 'Meilenstein ' : (meta ? meta.singular + ' ' : '')) + k.begriff;
    var g = s('g', {
      class: klassen.join(' '),
      transform: 'translate(' + rund(k.x) + ',' + rund(k.y) + ')',
      'data-id': k.id,
      tabindex: '0',
      role: 'button',
      'aria-label': label
    });

    g.appendChild(s('path', { class: 'gk__form', d: formPfad(k.kategorie, w, h, istMs) }));

    var gx = 12 + GLYPH_R;
    g.appendChild(s('circle', { class: 'gk__glyph', cx: gx, cy: h / 2, r: GLYPH_R }));
    g.appendChild(ikone(istMs ? 'meilenstein' : k.kategorie, gx, h / 2, GLYPH_KANTE));

    var tx = gx + GLYPH_R + 8;
    var labelText = k.begriff;
    g.appendChild(s('text', { class: 'gk__label', x: tx, y: h / 2, text: labelText }));
    tx += messen(labelText, 'normal');

    /* Typ-Symbol ohne <title>: Typ und Phasen nennt die Karte beim Überfahren. */
    if (!istMs && k.kategorie === 'ergebnis' && k.eintrag && k.eintrag.typ) {
      g.appendChild(s('text', {
        class: 'gk__typ', x: tx + 8, y: h / 2,
        text: TYP_SYMBOL[k.eintrag.typ] || ''
      }));
    }

    return g;
  }

  /** Das Phasenmodell als eigenständiges SVG (für HTML, etwa die Karte beim
      Überfahren): Felder der Phasen des Elements dunkelgrau. */
  function phasenModell(phasen, masstab) {
    var m = masstab || 1;
    var aktiv = {};
    (phasen || []).forEach(function (p) { aktiv[p] = true; });
    var svg = s('svg', {
      class: 'gk__phasen', width: rund(STREIFEN_B * m), height: rund(STREIFEN_H * m),
      viewBox: '0 0 ' + STREIFEN_B + ' ' + STREIFEN_H, 'aria-hidden': 'true', focusable: 'false'
    });
    PHASEN_ZELLEN.forEach(function (z) {
      svg.appendChild(s('rect', {
        class: 'gk__phase' + (aktiv[z.name] ? ' ist-aktiv' : ''),
        x: rund(z.x), y: rund(z.y), width: z.w, height: rund(z.h)
      }));
    });
    return svg;
  }

  /* --- Layout: Spalten und Bahnen ------------------------------------------ */

  /**
   * Swimlane-Layout: Rollen als durchgehende Spalte (sie tragen in HERMES
   * weder Phase noch Modul), daneben die Bahnbeschriftung und rechts davon
   * Aufgaben und Ergebnisse, jede in ihrer Bahn. Die Bahnen laufen von oben
   * nach unten in der Reihenfolge der Methode; Kanten bleiben S-Kurven.
   */
  function layoutSpalten(tg, opt) {
    opt = opt || {};
    var SPALTEN_ABSTAND = opt.spaltenAbstand || 104;
    var BAHN_ABSTAND = 28;        /* Beschriftung steht nah an ihrer Bahn */
    var ZEILE = KNOTEN_HOEHE + 8;
    var BAHN_LUFT = 12;           /* Luft oben und unten in der Bahn */
    var BAHN_RAND = 14;           /* Überstand des Bandes links und rechts */
    var UNTER_H = 22;             /* Zeile eines Modul-Zwischentitels in der Bahn */

    var spalten = tg.spalten.filter(function (sp) { return sp.knoten.length; }).map(function (sp) {
      var meta = HT.graph.KAT[sp.kategorie];
      return {
        kategorie: sp.kategorie,
        label: meta.label,
        gruppeVon: sp.gruppeVon || null,
        untergruppeVon: sp.untergruppeVon || null,
        knoten: sp.knoten.map(function (k) {
          var n = { id: k.id, kategorie: k.kategorie, begriff: k.begriff, eintrag: k.eintrag, entscheid: k.entscheid, h: KNOTEN_HOEHE };
          n.w = knotenBreite(n);
          return n;
        })
      };
    });
    spalten.forEach(function (sp) {
      sp.breite = sp.knoten.reduce(function (m, n) { return Math.max(m, n.w); }, 0);
    });

    var mitBahn = spalten.filter(function (sp) { return !!sp.gruppeVon; });
    var ohneBahn = spalten.filter(function (sp) { return !sp.gruppeVon; });

    /* Bahnen in der Reihenfolge der Methode, aber nur die belegten. */
    var bahnen = [];
    (tg.bahnen || []).concat(['']).forEach(function (name) {
      var belegt = mitBahn.some(function (sp) {
        return sp.knoten.some(function (n) { return (sp.gruppeVon[n.id] || '') === name; });
      });
      if (belegt) { bahnen.push({ name: name, zeilen: 0 }); }
    });

    var knoten = [];
    var positionen = {};
    var texte = [];
    var linien = [];
    var baender = [];

    if (!bahnen.length) {
      /* Weder Aufgaben noch Ergebnisse sichtbar: schlichte Spalten. */
      return einfacheSpalten(spalten, { knoten: knoten, positionen: positionen, texte: texte }, tg, SPALTEN_ABSTAND, ZEILE);
    }

    /* Bahnhöhen: die höhere der beiden Spalten bestimmt die Bahn. */
    var proBahn = {};
    bahnen.forEach(function (b) { proBahn[b.name] = {}; });
    mitBahn.forEach(function (sp) {
      bahnen.forEach(function (b) { proBahn[b.name][sp.kategorie] = []; });
      sp.knoten.forEach(function (n) {
        var g = sp.gruppeVon[n.id] || '';
        if (!proBahn[g]) { return; }
        proBahn[g][sp.kategorie].push(n);
      });
    });
    /* Unterbahnen (Module) in einer Bahn: gemeinsam über alle Spalten, in
       der Reihenfolge der Methode. Je Modul eine Unterbahn mit Zwischentitel;
       ihre Höhe bestimmt die längere Spalte, damit Aufgaben und Ergebnisse
       eines Moduls nebeneinander in derselben Unterbahn stehen. Ohne
       Untergruppen (Modulbahnen) gibt es eine namenlose Unterbahn ohne Titel. */
    var mitUnter = mitBahn.some(function (sp) { return !!sp.untergruppeVon; });
    var unterNamen = mitUnter ? (tg.untergruppen || []).concat(['']) : [''];
    function unterbahnen(b) {
      var liste = [];
      unterNamen.forEach(function (name) {
        var listen = {}, max = 0, belegt = false;
        mitBahn.forEach(function (sp) {
          var alle = proBahn[b.name][sp.kategorie];
          var l = sp.untergruppeVon
            ? alle.filter(function (n) { return (sp.untergruppeVon[n.id] || '') === name; })
            : (name === '' ? alle : []);
          listen[sp.kategorie] = l;
          if (l.length) { belegt = true; }
          max = Math.max(max, l.length);
        });
        if (!belegt) { return; }
        liste.push({ name: name, listen: listen, titel: mitUnter, hoehe: (mitUnter ? UNTER_H : 0) + max * ZEILE - 8 });
      });
      return liste;
    }
    bahnen.forEach(function (b) {
      b.unter = unterbahnen(b);
      /* Zwischen zwei Unterbahnen bleibt der Zeilenabstand (8) als Luft. */
      var inhalt = b.unter.reduce(function (m, u) { return m + u.hoehe; }, 0) + Math.max(0, b.unter.length - 1) * 8;
      b.inhalt = Math.max(ZEILE - 8, inhalt);
      b.hoehe = b.inhalt + 2 * BAHN_LUFT;
    });
    var bahnenHoehe = bahnen.reduce(function (m, b) { return m + b.hoehe; }, 0);

    function bahnAnzahl(b) {
      return mitBahn.map(function (sp) {
        var n = proBahn[b.name][sp.kategorie].length;
        var meta = HT.graph.KAT[sp.kategorie];
        return n + ' ' + (n === 1 ? meta.singular : meta.label);
      }).join(' · ');
    }

    /* Breite der Bahnspalte: längster Name oder längste Anzahl darunter (in
       Versalien, 12 px) — sonst läuft «13 Aufgaben · 22 Ergebnisse» in den
       Modultitel daneben. In Grenzen. */
    var beschriftung = 150;
    bahnen.forEach(function (b) {
      beschriftung = Math.max(beschriftung,
        Math.ceil(messen(b.name || 'Ohne Zuordnung', 'normal')) + 34,
        Math.ceil(messen(bahnAnzahl(b).toUpperCase(), 'normal') * 12 / 14) + 34);
    });
    beschriftung = Math.min(beschriftung, 250);

    /* Rollen laufen durch, ohne Bahn — Höhe der Spalte für die Ausrichtung. */
    var ohneHoehe = ohneBahn.reduce(function (m, sp) {
      return Math.max(m, sp.knoten.length * ZEILE - 8);
    }, 0);
    var gesamtHoehe = Math.max(bahnenHoehe, ohneHoehe);
    var obenBuendig = gesamtHoehe > 1400;
    var bahnenOben = obenBuendig ? 0 : (gesamtHoehe - bahnenHoehe) / 2;
    var ohneOben = obenBuendig ? 0 : (gesamtHoehe - ohneHoehe) / 2;

    /* Spalten von links: erst die bahnlosen (Rollen), dann die Beschriftung,
       dann die Spalten in Bahnen. */
    var x = 0;
    ohneBahn.forEach(function (sp) {
      sp.x = x;
      x += sp.breite + SPALTEN_ABSTAND;
    });
    var beschriftungX = x;
    x += beschriftung + BAHN_ABSTAND;
    mitBahn.forEach(function (sp, i) {
      sp.x = x;
      x += sp.breite + (i < mitBahn.length - 1 ? SPALTEN_ABSTAND : 0);
    });
    var bahnRechts = x;

    /* Spaltenköpfe */
    var alleSpalten = ohneBahn.concat(mitBahn);
    alleSpalten.forEach(function (sp, si) {
      sp.index = si;
      texte.push({ x: sp.x, y: -32, text: sp.label + ' · ' + sp.knoten.length, klasse: 'gtext gtext--spalte gtext--' + sp.kategorie, anker: 'start' });
    });
    texte.push({
      x: beschriftungX, y: -32,
      text: tg.achse === 'modul' ? 'Module' : 'Phasen',
      klasse: 'gtext gtext--spalte gtext--bahnkopf', anker: 'start'
    });

    /* Bänder, Beschriftung und Knoten je Bahn */
    var y = bahnenOben;
    bahnen.forEach(function (b, bi) {
      b.y = y;
      baender.push({
        x: beschriftungX - BAHN_RAND, y: y, w: bahnRechts - beschriftungX + 2 * BAHN_RAND, h: b.hoehe,
        gerade: bi % 2 === 0
      });
      if (bi > 0) { linien.push({ x1: beschriftungX - BAHN_RAND, y1: y, x2: bahnRechts + BAHN_RAND, y2: y }); }
      texte.push({ x: beschriftungX, y: y + BAHN_LUFT + 12, text: b.name || 'Ohne Zuordnung', klasse: 'gtext gtext--bahn', anker: 'start' });
      texte.push({ x: beschriftungX, y: y + BAHN_LUFT + 31, text: bahnAnzahl(b), klasse: 'gtext gtext--bahnzahl', anker: 'start' });

      /* Unterbahnen von oben nach unten; in jeder beginnen alle Spalten oben.
         Zwischentitel und Haarlinie laufen über alle Spalten der Bahn (die
         Haarlinie nicht vor der ersten Unterbahn, dort trennt schon die Bahn). */
      var uy = y + BAHN_LUFT;
      var linksX = mitBahn.length ? mitBahn[0].x : beschriftungX;
      b.unter.forEach(function (u, ui) {
        if (u.titel) {
          if (ui > 0) { linien.push({ x1: linksX, y1: uy + 1, x2: bahnRechts, y2: uy + 1, klasse: 'ggruppenlinie--unter' }); }
          texte.push({ x: linksX, y: uy + UNTER_H / 2 + 1, text: u.name || 'Ohne Modul', klasse: 'gtext gtext--untergruppe', anker: 'start', modul: u.name || null });
        }
        var oben = uy + (u.titel ? UNTER_H : 0);
        mitBahn.forEach(function (sp) {
          var ny = oben;
          u.listen[sp.kategorie].forEach(function (n) {
            n.x = sp.x;
            n.y = ny;
            n.spalte = sp.index;
            positionen[n.id] = n;
            knoten.push(n);
            ny += ZEILE;
          });
        });
        uy += u.hoehe + 8;
      });
      y += b.hoehe;
    });

    /* Rollen: durchgehend, ohne Bahn */
    ohneBahn.forEach(function (sp) {
      var ny = ohneOben;
      sp.knoten.forEach(function (n) {
        n.x = sp.x;
        n.y = ny;
        n.spalte = sp.index;
        positionen[n.id] = n;
        knoten.push(n);
        ny += ZEILE;
      });
    });

    return {
      art: 'spalten',
      knoten: knoten,
      kanten: kantenBauen(tg, positionen),
      texte: texte,
      linien: linien,
      baender: baender,
      zentrum: null
    };
  }

  /* Fallback ohne Bahnen (Aufgaben und Ergebnisse ausgeblendet). */
  function einfacheSpalten(spalten, sammler, tg, abstand, zeile) {
    var maxHoehe = spalten.reduce(function (m, sp) { return Math.max(m, sp.knoten.length * zeile - 8); }, 0);
    var x = 0;
    spalten.forEach(function (sp, si) {
      var y = (maxHoehe - (sp.knoten.length * zeile - 8)) / 2;
      sp.x = x;
      sp.index = si;
      sammler.texte.push({ x: x, y: -32, text: sp.label + ' · ' + sp.knoten.length, klasse: 'gtext gtext--spalte gtext--' + sp.kategorie, anker: 'start' });
      sp.knoten.forEach(function (n) {
        n.x = x; n.y = y; n.spalte = si;
        sammler.positionen[n.id] = n;
        sammler.knoten.push(n);
        y += zeile;
      });
      x += sp.breite + abstand;
    });
    return {
      art: 'spalten', knoten: sammler.knoten, kanten: kantenBauen(tg, sammler.positionen),
      texte: sammler.texte, linien: [], baender: [], zentrum: null
    };
  }

  function kantenBauen(tg, positionen) {
    var kanten = [];
    tg.kanten.forEach(function (kante) {
      var a = positionen[kante.von], b = positionen[kante.nach];
      if (!a || !b) { return; }
      var links = a.spalte <= b.spalte ? a : b;
      var rechts = links === a ? b : a;
      if (links.spalte === rechts.spalte) { return; }
      var x1 = links.x + links.w, y1 = links.y + links.h / 2;
      var x2 = rechts.x, y2 = rechts.y + rechts.h / 2;
      var mx = (x1 + x2) / 2;
      kanten.push({
        id: kante.id, von: kante.von, nach: kante.nach, rel: kante.rel,
        weit: rechts.spalte - links.spalte > 1,
        pfad: 'M' + rund(x1) + ' ' + rund(y1) + 'C' + rund(mx) + ' ' + rund(y1) + ' ' + rund(mx) + ' ' + rund(y2) + ' ' + rund(x2) + ' ' + rund(y2)
      });
    });
    return kanten;
  }


  /* --- Zeichner ------------------------------------------------------------ */

  function erstellen(container, rueckrufe) {
    rueckrufe = rueckrufe || {};
    schriftLesen(container);

    var svg = s('svg', { class: 'graph-svg', role: 'group', 'aria-label': 'Graph der Methodenelemente' });
    var defs = s('defs');
    defs.appendChild(s('marker', { id: 'gpfeil', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
      s('path', { d: 'M0 0L10 5L0 10Z', class: 'gpfeil' })));
    svg.appendChild(defs);
    var welt = s('g', { class: 'welt' });
    var ebeneBahnen = s('g', { class: 'ebene-bahnen' });
    var ebeneKanten = s('g', { class: 'ebene-kanten' });
    var ebeneTexte = s('g', { class: 'ebene-texte' });
    var ebeneKnoten = s('g', { class: 'ebene-knoten' });
    welt.appendChild(ebeneBahnen);
    welt.appendChild(ebeneKanten);
    welt.appendChild(ebeneTexte);
    welt.appendChild(ebeneKnoten);
    svg.appendChild(welt);
    container.appendChild(svg);

    var sicht = { k: 1, x: 0, y: 0 };
    /* Solange die Ansicht seit dem letzten Einpassen nicht von Hand verschoben
       oder gezoomt wurde, folgt sie einer Grössenänderung der Fläche — etwa
       wenn das Detailfeld aufgeht oder das Fenster schmaler wird. */
    var eingepasst = null;
    var elemente = { knoten: {}, kanten: {} };
    var nachbarschaft = {};   // id -> { knoten: {id:true}, kanten: {id:true} }
    var aktuellesLayout = null;

    function anwenden() {
      welt.setAttribute('transform', 'translate(' + rund(sicht.x) + ',' + rund(sicht.y) + ') scale(' + (Math.round(sicht.k * 1000) / 1000) + ')');
    }

    /* Steht die Fläche in einer skalierten Umgebung (Folie des Lernpfads,
       transform: scale), sind Bildschirmpixel nicht die Einheiten der
       Zeichnung: f rechnet um. Im Überblick ist f = 1. */
    function masse() {
      var r = svg.getBoundingClientRect();
      var f = svg.clientWidth && r.width ? r.width / svg.clientWidth : 1;
      return { w: r.width / f || 800, h: r.height / f || 600, links: r.left, oben: r.top, f: f };
    }

    /* Bereiche, die über der Fläche liegen (die Icon-Leisten), sollen den
       eingepassten Graphen nicht verdecken. Jedes Element schneidet die
       Fläche an der Seite ab, an der das am wenigsten kostet: eine schmale
       Spalte links nimmt links Platz weg, eine flache Reihe unten unten. */
    function freierBereich(m) {
      var frei = { links: 0, rechts: 0, oben: 0, unten: 0 };
      var elemente = rueckrufe.freihalten ? rueckrufe.freihalten() : [];
      elemente.forEach(function (el) {
        if (!el || el.hidden || !el.offsetParent) { return; }
        var r = el.getBoundingClientRect();
        var links = (r.right - m.links) / m.f, rechts = m.w - (r.left - m.links) / m.f;
        var oben = (r.bottom - m.oben) / m.f, unten = m.h - (r.top - m.oben) / m.f;
        var wahl = [
          ['links', links, links * m.h], ['rechts', rechts, rechts * m.h],
          ['oben', oben, oben * m.w], ['unten', unten, unten * m.w]
        ].sort(function (a, b) { return a[2] - b[2]; })[0];
        frei[wahl[0]] = Math.max(frei[wahl[0]], wahl[1]);
      });
      return frei;
    }

    function einpassen(optionen) {
      optionen = optionen || {};
      var m = masse();
      var box;
      try { box = welt.getBBox(); } catch (e) { return; }
      if (!box || !box.width || !box.height) { return; }
      eingepasst = optionen;
      var rand = optionen.rand || 28;
      var frei = freierBereich(m);
      var x0 = frei.links + rand, y0 = frei.oben + rand;
      var bw = Math.max(80, m.w - frei.links - frei.rechts - 2 * rand);
      var bh = Math.max(80, m.h - frei.oben - frei.unten - 2 * rand);
      var k = Math.min(bw / box.width, bh / box.height, optionen.maxZoom || 1.15);
      /* Auf schmalen Flächen darf der Graph kleiner werden — Zoomen per Finger ist dort näher als Schieben. */
      k = Math.max(k, optionen.minZoom || (m.w < 700 ? 0.42 : 0.6));
      sicht.k = k;
      if (box.width * k > bw) {
        sicht.x = x0 - box.x * k;
      } else {
        sicht.x = x0 + (bw - box.width * k) / 2 - box.x * k;
      }
      if (box.height * k > bh) {
        sicht.y = y0 - box.y * k;
      } else {
        sicht.y = y0 + (bh - box.height * k) / 2 - box.y * k;
      }
      anwenden();
    }

    function zoomBei(cx, cy, faktor) {
      var m = masse();
      var px = (cx - m.links) / m.f, py = (cy - m.oben) / m.f;
      eingepasst = null;
      var neu = Math.min(3, Math.max(0.2, sicht.k * faktor));
      var f = neu / sicht.k;
      sicht.x = px - (px - sicht.x) * f;
      sicht.y = py - (py - sicht.y) * f;
      sicht.k = neu;
      anwenden();
    }

    function zoomen(faktor) {
      var m = masse();
      zoomBei(m.links + m.w * m.f / 2, m.oben + m.h * m.f / 2, faktor);
    }

    if (global.ResizeObserver) {
      new global.ResizeObserver(function () {
        if (eingepasst && aktuellesLayout) { einpassen(eingepasst); }
      }).observe(svg);
    }

    /* Zeiger: Verschieben mit einem Finger/Maus, Zoomen mit zwei Fingern.
       Kein setPointerCapture: WebKit (Safari, alle iOS-Browser) schickt den
       folgenden click dann an die Fläche statt an den Knoten — der Klick auf
       ein Element kam dort als Leerklick an. Damit ein Zug auch ausserhalb
       der Fläche weiterläuft, hängen move/up während des Zugs am Dokument. */
    var zeiger = {};
    var bewegt = false;
    var start = null;
    var pinch = null;
    var gedrueckt = null;   // Knoten unter dem Zeiger beim Drücken — Rückfall für click
    var dokumentGebunden = false;

    function zeigerListe() { return Object.keys(zeiger).map(function (id) { return zeiger[id]; }); }

    function dokumentBinden(an) {
      if (an === dokumentGebunden) { return; }
      dokumentGebunden = an;
      var m = an ? 'addEventListener' : 'removeEventListener';
      document[m]('pointermove', zeigerBewegt);
      document[m]('pointerup', zeigerEnde);
      document[m]('pointercancel', zeigerEnde);
    }

    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) { return; }
      zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var liste = zeigerListe();
      bewegt = false;
      gedrueckt = liste.length === 1 ? knotenAusEreignis(ev) : null;
      if (liste.length === 1) {
        start = { x: ev.clientX, y: ev.clientY, sx: sicht.x, sy: sicht.y, f: masse().f };
        pinch = null;
      } else if (liste.length === 2) {
        pinch = { d: Math.hypot(liste[0].x - liste[1].x, liste[0].y - liste[1].y) };
        start = null;
      }
      dokumentBinden(true);
    });

    function zeigerBewegt(ev) {
      if (!zeiger[ev.pointerId]) { return; }
      zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var liste = zeigerListe();
      if (liste.length === 1 && start) {
        var dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        /* 8 px statt 4: ein Klick auf dem Trackpad wandert leicht ein paar
           Pixel — darunter zählte er als Zug und wurde verschluckt. */
        if (!bewegt && Math.hypot(dx, dy) > 8) { bewegt = true; svg.classList.add('ist-am-ziehen'); }
        if (bewegt) {
          eingepasst = null;
          sicht.x = start.sx + dx / (start.f || 1);
          sicht.y = start.sy + dy / (start.f || 1);
          anwenden();
        }
      } else if (liste.length === 2 && pinch) {
        var d = Math.hypot(liste[0].x - liste[1].x, liste[0].y - liste[1].y);
        if (d > 0 && pinch.d > 0) {
          zoomBei((liste[0].x + liste[1].x) / 2, (liste[0].y + liste[1].y) / 2, d / pinch.d);
          pinch.d = d;
          bewegt = true;
        }
      }
    }

    function zeigerEnde(ev) {
      if (!zeiger[ev.pointerId]) { return; }
      delete zeiger[ev.pointerId];
      var liste = zeigerListe();
      if (!liste.length) {
        start = null; pinch = null;
        svg.classList.remove('ist-am-ziehen');
        dokumentBinden(false);
        /* «bewegt» und der gedrückte Knoten bleiben bis zum click-Ereignis
           stehen: ein Zug löst keinen Klick aus, ein Klick findet seinen
           Knoten auch dann, wenn der Browser ihn an die Fläche adressiert. */
        global.setTimeout(function () { bewegt = false; gedrueckt = null; }, 0);
      } else if (liste.length === 1) {
        start = { x: liste[0].x, y: liste[0].y, sx: sicht.x, sy: sicht.y, f: masse().f };
        pinch = null;
      }
    }

    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var faktor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
      zoomBei(ev.clientX, ev.clientY, faktor);
    }, { passive: false });

    svg.addEventListener('dblclick', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g) {
        ev.preventDefault();
        if (rueckrufe.beiDoppelklick) { rueckrufe.beiDoppelklick(g.getAttribute('data-id')); }
      }
    });

    svg.addEventListener('click', function (ev) {
      if (bewegt) { return; }
      var u = untergruppeAusEreignis(ev);
      if (u) {
        if (rueckrufe.beiUntergruppe) { rueckrufe.beiUntergruppe(u.getAttribute('data-modul'), ev); }
        return;
      }
      var g = knotenAusEreignis(ev) || gedrueckt;
      if (g) {
        if (rueckrufe.beiKlick) { rueckrufe.beiKlick(g.getAttribute('data-id'), ev); }
      } else if (rueckrufe.beiLeerklick) {
        rueckrufe.beiLeerklick();
      }
    });

    svg.addEventListener('keydown', function (ev) {
      /* Taste F auf einem Knoten: wie das Filter-Icon der Karte — die Karte
         selbst ist mit der Tastatur nicht erreichbar. */
      if ((ev.key === 'f' || ev.key === 'F') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        var gf = knotenAusEreignis(ev);
        if (gf && rueckrufe.beiFokus) { ev.preventDefault(); rueckrufe.beiFokus(gf.getAttribute('data-id')); }
        return;
      }
      if (ev.key !== 'Enter' && ev.key !== ' ') { return; }
      var u = untergruppeAusEreignis(ev);
      if (u) {
        ev.preventDefault();
        if (rueckrufe.beiUntergruppe) { rueckrufe.beiUntergruppe(u.getAttribute('data-modul'), ev); }
        return;
      }
      var g = knotenAusEreignis(ev);
      if (!g) { return; }
      ev.preventDefault();
      if (rueckrufe.beiKlick) { rueckrufe.beiKlick(g.getAttribute('data-id'), ev); }
    });

    svg.addEventListener('pointerover', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) { rueckrufe.beiHover(g.getAttribute('data-id'), ev); }
    });
    svg.addEventListener('pointerout', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) {
        var ziel = ev.relatedTarget;
        while (ziel && ziel !== svg && !(ziel.classList && ziel.classList.contains('gk'))) { ziel = ziel.parentNode; }
        if (ziel !== g) { rueckrufe.beiHover(null, ev); }
      }
    });
    svg.addEventListener('focusin', function (ev) {
      var g = knotenAusEreignis(ev);
      if (g && rueckrufe.beiHover) { rueckrufe.beiHover(g.getAttribute('data-id'), ev); }
    });
    svg.addEventListener('focusout', function () {
      if (rueckrufe.beiHover) { rueckrufe.beiHover(null, null); }
    });

    function knotenAusEreignis(ev) {
      var el = ev.target;
      while (el && el !== svg) {
        if (el.classList && el.classList.contains('gk')) { return el; }
        el = el.parentNode;
      }
      return null;
    }

    function untergruppeAusEreignis(ev) {
      var el = ev.target;
      return el && el.getAttribute && el.getAttribute('data-modul') ? el : null;
    }

    /* --- Zeichnen --------------------------------------------------------- */

    function zeigen(layout, optionen) {
      optionen = optionen || {};
      aktuellesLayout = layout;
      HT.ui.leeren(ebeneBahnen);
      HT.ui.leeren(ebeneKanten);
      HT.ui.leeren(ebeneTexte);
      HT.ui.leeren(ebeneKnoten);
      elemente = { knoten: {}, kanten: {} };
      nachbarschaft = {};

      (layout.baender || []).forEach(function (b) {
        ebeneBahnen.appendChild(s('rect', {
          class: 'gbahn' + (b.gerade ? '' : ' gbahn--ungerade'),
          x: rund(b.x), y: rund(b.y), width: rund(b.w), height: rund(b.h)
        }));
      });

      layout.kanten.forEach(function (ka) {
        var stil = ka.stil || (HT.graph.REL[ka.rel] ? HT.graph.REL[ka.rel].stil : 'struktur');
        var el = s('path', {
          class: 'gkante gkante--' + stil + (ka.weit ? ' gkante--weit' : '') + (ka.quer ? ' gkante--quer' : ''),
          d: ka.pfad,
          'data-id': ka.id,
          'marker-end': (ka.rel === 'erzeugt' && !ka.quer) ? 'url(#gpfeil)' : null
        });
        ebeneKanten.appendChild(el);
        elemente.kanten[ka.id] = el;
        [ka.von, ka.nach].forEach(function (id) {
          if (!nachbarschaft[id]) { nachbarschaft[id] = { knoten: {}, kanten: {} }; }
          nachbarschaft[id].kanten[ka.id] = true;
        });
        nachbarschaft[ka.von].knoten[ka.nach] = true;
        nachbarschaft[ka.nach].knoten[ka.von] = true;
      });

      (layout.linien || []).forEach(function (l) {
        ebeneTexte.appendChild(s('line', { class: 'ggruppenlinie' + (l.klasse ? ' ' + l.klasse : ''), x1: rund(l.x1), y1: rund(l.y1), x2: rund(l.x2), y2: rund(l.y2) }));
      });

      layout.texte.forEach(function (t) {
        var attrs = { class: t.klasse, x: rund(t.x), y: rund(t.y), 'text-anchor': t.anker || 'start', text: t.text };
        /* Modul-Zwischentitel: anklickbar, schränkt auf das Modul ein. */
        if (t.modul) {
          attrs['data-modul'] = t.modul;
          attrs.role = 'button';
          attrs.tabindex = '0';
          attrs['aria-label'] = 'Auf Modul ' + t.modul + ' einschränken';
        }
        ebeneTexte.appendChild(s('text', attrs));
      });

      layout.knoten.forEach(function (k) {
        var el = knotenElement(k, optionen);
        ebeneKnoten.appendChild(el);
        elemente.knoten[k.id] = el;
      });

      if (optionen.einpassen !== false) {
        einpassen(optionen);
      } else {
        anwenden();
      }
    }

    /* Hervorhebung: ein Knoten samt Nachbarn und Kanten, alles andere gedimmt. */
    function hervorheben(id, festhalten) {
      svg.classList.remove('ist-hervorhebung');
      Object.keys(elemente.knoten).forEach(function (k) { elemente.knoten[k].classList.remove('ist-aktiv', 'ist-gewaehlt'); });
      Object.keys(elemente.kanten).forEach(function (k) { elemente.kanten[k].classList.remove('ist-aktiv'); });
      if (!id || !elemente.knoten[id]) { return; }
      svg.classList.add('ist-hervorhebung');
      elemente.knoten[id].classList.add('ist-aktiv');
      if (festhalten) { elemente.knoten[id].classList.add('ist-gewaehlt'); }
      var n = nachbarschaft[id];
      if (n) {
        Object.keys(n.knoten).forEach(function (k) { if (elemente.knoten[k]) { elemente.knoten[k].classList.add('ist-aktiv'); } });
        Object.keys(n.kanten).forEach(function (k) { if (elemente.kanten[k]) { elemente.kanten[k].classList.add('ist-aktiv'); } });
      }
      if (aktuellesLayout && aktuellesLayout.zentrum && elemente.knoten[aktuellesLayout.zentrum]) {
        elemente.knoten[aktuellesLayout.zentrum].classList.add('ist-aktiv');
      }
    }

    function markieren(id) {
      Object.keys(elemente.knoten).forEach(function (k) { elemente.knoten[k].classList.toggle('ist-gewaehlt', k === id); });
    }

    function knotenPosition(id) {
      var el = elemente.knoten[id];
      if (!el) { return null; }
      var r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    return {
      svg: svg,
      zeigen: zeigen,
      einpassen: einpassen,
      zoomen: zoomen,
      hervorheben: hervorheben,
      markieren: markieren,
      knotenPosition: knotenPosition
    };
  }

  HT.graphZeichnen = {
    erstellen: erstellen,
    layoutSpalten: layoutSpalten,
    messen: messen,
    /* Einzelne Knoten für Ansichten mit eigener Anordnung (Beziehungsbild des
       Überblicks) — so sehen Knoten überall gleich aus. */
    schriftLesen: schriftLesen,
    knotenBreite: knotenBreite,
    knotenElement: knotenElement,
    phasenModell: phasenModell,
    KNOTEN_HOEHE: KNOTEN_HOEHE,
    TYP_SYMBOL: TYP_SYMBOL
  };
}(window));
