/* meinHERMES — Abbildung 1 des Referenzhandbuchs («Gesamtbild der
   HERMES-Module und der wesentlichen Ergebnisse entlang der Phasen»).

   Grundlage des Überblicks und der Reihenfolge im Graph (lagen, auch für die
   Übungen des Trainers): die Grafik wird nicht nachgebaut, sondern als
   importierte SVG-Datei aus assets/abb/ geladen. Zur
   Laufzeit werden die Kästen an Füllfarbe und Kontur erkannt, ihre
   Beschriftung aus den Textfragmenten des Office-Exports zusammengesetzt und
   über den von Trennzeichen befreiten Namen mit den Einträgen aus data/
   verbunden. Die Geometrie kommt aus den transform-Attributen, nicht aus
   getBBox() — das stimmt auch in verborgenen Tabs.

   API: HT.abbildung.holen() → Promise<SVG-Text> (einmal geholt, dann aus dem
   Speicher); lesen(text) → SVG-Element ohne Metadaten; masse(svg) → Breite
   und Höhe; kaesten(svg) → Liste der erkannten Kästen mit art
   ('ergebnis' | 'modul' | 'phase'), x/y/w/h, fuell, beschriftung und
   eintraege (Lexikoneinträge oder null). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /* Fällt der Verweis im Handbuchkapitel aus, wird diese Datei genommen. */
  var ABBILDUNG = 'assets/abb/f297763a-101-gesamtbild-der-hermes-module-und-'
    + 'der-wesentlichen-ergebnisse-entlang-der-phasen.svg';

  var BILDUNTERSCHRIFT = 'Abbildung 1: Gesamtbild der HERMES-Module und der '
    + 'wesentlichen Ergebnisse entlang der Phasen';

  var QUELLE_ABB = 'https://www.hermes.admin.ch/de/projektmanagement/methodenueberblick.html';

  /* Farben, an denen die Grafik ihre Bestandteile unterscheidet. Sie stammen
     aus dem Office-Export und werden wörtlich verglichen — keine Themenfarben. */
  var FARBEN = {
    ergebnis: '#DCEBFA',        // Ergebniskasten (eckig): Dokument oder Checkliste
    ergebnisRand: '#DCEBFA',    // Zustandskasten (weiss gefüllt, runde Ecken)
    modulRand: '#000000',       // Modulrahmen
    phase: ['#B7D5F1', '#D9D9D9', '#EBC9C7'],  // Phasenbalken am linken Rand
    /* Nur für die Legende — an diesen Farben wird nichts erkannt. */
    uebergang: '#DF1D7F',       // gestrichelte Linie am Phasenübergang
    iteration: '#FF0000'        // Pfeile und Linien der agilen Iteration
  };

  /* Kästen, die in der Grafik anders oder verkürzt beschriftet sind als im
     Lexikon. Zwei Kästen stehen für je zwei Elemente — die Grafik fasst
     Projektsteuerung und Projektführung zu einer Spalte zusammen. */
  var ABWEICHENDE_BESCHRIFTUNG = [
    { label: 'Geschäftsmod.-beschreibung', ziele: ['Geschäftsmodellbeschreibung'], kat: 'ergebnis' },
    { label: 'Produkt entwickelt/angepasst', ziele: ['Produkt entwickelt oder angepasst'], kat: 'ergebnis' },
    { label: 'System entwickelt/parametrisiert', ziele: ['System entwickelt oder parametrisiert'], kat: 'ergebnis' },
    { label: 'Projektentscheide', ziele: ['Liste Projektentscheide Steuerung', 'Liste Projektentscheide Führung'], kat: 'ergebnis' },
    { label: 'Testen', ziele: ['Tests'], kat: 'modul' },
    { label: 'Projektsteuerung Projektführung', ziele: ['Projektsteuerung', 'Projektführung'], kat: 'modul' }
  ];


  var abbQuelle = null;       // einmal geholter SVG-Text, für spätere Aufrufe

  /* --- Beschriftung -> Eintrag -------------------------------------------- */

  /* Die Grafik bricht Wörter um («Projekt-» / «initialisierungs-» / «auftrag»);
     für den Abgleich fallen deshalb alle Trennzeichen weg. */
  function schluessel(text) {
    return HT.daten.normalisieren(text).replace(/[^0-9a-zäöüß]/g, '');
  }

  var abweichend = null;

  function abweichendeZiele(key) {
    if (!abweichend) {
      abweichend = {};
      ABWEICHENDE_BESCHRIFTUNG.forEach(function (a) { abweichend[schluessel(a.label)] = a; });
    }
    var treffer = abweichend[key];
    if (!treffer) { return null; }
    var eintraege = treffer.ziele.map(function (name) {
      return HT.daten.eintragMitBegriff(name, treffer.kat);
    }).filter(function (e) { return !!e; });
    return eintraege.length ? eintraege : null;
  }

  function eintraegeZuBeschriftung(text, kategorie) {
    var key = schluessel(text);
    if (!key) { return null; }
    var abw = abweichendeZiele(key);
    if (abw) { return abw; }

    var treffer = null;
    HT.daten.eintraegeDerKategorie(kategorie).forEach(function (e) {
      if (!treffer && schluessel(e.begriff) === key) { treffer = e; }
    });
    return treffer ? [treffer] : null;
  }

  /* --- SVG lesen ----------------------------------------------------------- */

  /* Die Grafik ist ein Office-Export: alles liegt flach in einer Gruppe, jedes
     Element trägt sein eigenes «transform». Statt zu rendern und zu messen
     (getBBox braucht ein sichtbares Dokument) werden die Matrizen direkt
     gelesen — translate(x y) und matrix(a b c d e f) genügen. */
  function matrixVon(el) {
    var s = el.getAttribute('transform') || '';
    var m = /^matrix\(([^)]*)\)/.exec(s);
    if (m) {
      var p = m[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 6) { return p; }
    }
    m = /^translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)/.exec(s);
    if (m) { return [1, 0, 0, 1, Number(m[1]), Number(m[2])]; }
    return [1, 0, 0, 1, 0, 0];
  }

  function punkt(p, x, y) {
    return [p[0] * x + p[2] * y + p[4], p[1] * x + p[3] * y + p[5]];
  }

  function rahmenAusPunkten(pkte) {
    var xs = pkte.map(function (q) { return q[0]; });
    var ys = pkte.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function rahmenVonRect(el) {
    var p = matrixVon(el);
    var x = Number(el.getAttribute('x') || 0);
    var y = Number(el.getAttribute('y') || 0);
    var w = Number(el.getAttribute('width') || 0);
    var hoehe = Number(el.getAttribute('height') || 0);
    return rahmenAusPunkten([
      punkt(p, x, y), punkt(p, x + w, y), punkt(p, x, y + hoehe), punkt(p, x + w, y + hoehe)
    ]);
  }

  /* Die Dokumentform ist ein Pfad aus M/L/C/Z — ausschliesslich
     Koordinatenpaare, deshalb genügt das Auslesen aller Zahlen. */
  function rahmenVonPfad(el) {
    var zahlen = (el.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
    if (!zahlen || zahlen.length < 4) { return null; }
    var pkte = [];
    for (var i = 0; i + 1 < zahlen.length; i += 2) {
      pkte.push([Number(zahlen[i]), Number(zahlen[i + 1])]);
    }
    return rahmenAusPunkten(pkte);
  }

  function farbe(el, attr) {
    return String(el.getAttribute(attr) || '').toUpperCase();
  }

  function liste(svg, tag) {
    var roh = svg.getElementsByTagName(tag);
    var raus = [];
    for (var i = 0; i < roh.length; i++) { raus.push(roh[i]); }
    return raus;
  }

  function texteLesen(svg) {
    return liste(svg, 'text').map(function (el) {
      var p = matrixVon(el);
      return {
        x: p[4], y: p[5],
        s: el.textContent || '',
        gedreht: Math.abs(p[1]) > 0.5 || Math.abs(p[2]) > 0.5
      };
    });
  }

  function kaestenLesen(svg) {
    var kaesten = [];

    liste(svg, 'rect').forEach(function (el) {
      var f = farbe(el, 'fill');
      var s = farbe(el, 'stroke');
      var art = null;
      if (f === FARBEN.ergebnis) { art = 'ergebnis'; }
      else if (s === FARBEN.modulRand && f === 'NONE') { art = 'modul'; }
      else if (FARBEN.phase.indexOf(f) !== -1) { art = 'phase'; }
      if (!art) { return; }
      var r = rahmenVonRect(el);
      if (r.w < 4 || r.h < 4) { return; }
      r.art = art;
      r.fuell = art === 'ergebnis' ? FARBEN.ergebnis : null;
      kaesten.push(r);
    });

    liste(svg, 'path').forEach(function (el) {
      if (farbe(el, 'fill') !== '#FFFFFF' || farbe(el, 'stroke') !== FARBEN.ergebnisRand) { return; }
      var r = rahmenVonPfad(el);
      if (!r || r.w < 4 || r.h < 4) { return; }
      r.art = 'ergebnis';
      r.fuell = '#FFFFFF';
      kaesten.push(r);
    });

    return kaesten;
  }

  /* Jedes Textfragment gehört zum kleinsten Kasten, der es umschliesst —
     sonst schluckt die Sammelfläche «Phasenunabhängig» alle Kästen darin.
     Die Phasenbalken tragen als Einzige gedrehte Beschriftungen. */
  function beschriftungVerteilen(kaesten, texte) {
    kaesten.forEach(function (k) { k.flaeche = k.w * k.h; k.texte = []; });

    texte.forEach(function (t) {
      var beste = null;
      for (var i = 0; i < kaesten.length; i++) {
        var k = kaesten[i];
        if ((k.art === 'phase') !== t.gedreht) { continue; }
        if (t.x < k.x - 3 || t.x > k.x + k.w + 3) { continue; }
        if (t.y < k.y - 3 || t.y > k.y + k.h + 6) { continue; }
        if (!beste || k.flaeche < beste.flaeche) { beste = k; }
      }
      if (beste) { beste.texte.push(t); }
    });

    kaesten.forEach(function (k) {
      k.texte.sort(function (a, b) {
        var d = Math.round(a.y * 10) - Math.round(b.y * 10);
        return d || (a.x - b.x);
      });
      k.beschriftung = k.texte.map(function (t) { return t.s; }).join('');
    });
  }

  var KATEGORIE_JE_ART = { ergebnis: 'ergebnis', modul: 'modul', phase: 'phase' };

  function lesen(text) {
    var doc = new global.DOMParser().parseFromString(text, 'image/svg+xml');
    var wurzel = doc.documentElement;
    if (!wurzel || String(wurzel.nodeName).toLowerCase() !== 'svg') {
      throw new Error('Keine SVG-Datei');
    }
    var svg = document.importNode(wurzel, true);
    /* Manche Exporte tragen einen c2pa-Block als <metadata>; einzelne Parser
       zeigen dessen Inhalt als Text an. */
    liste(svg, 'metadata').forEach(function (m) {
      if (m.parentNode) { m.parentNode.removeChild(m); }
    });

    return svg;
  }

  function masse(svg) {
    return {
      breite: Number(svg.getAttribute('width')) || 1059,
      hoehe: Number(svg.getAttribute('height')) || 759
    };
  }

  /* Der Pfad steht im Handbuchkapitel; so bleibt er richtig, wenn der Import
     die Abbildung neu ablegt. */
  function abbildungspfadSuchen() {
    return HT.daten.handbuchKapitel().then(function (kapitel) {
      var pfad = null;
      (kapitel || []).forEach(function (k) {
        if (k.id !== 'methodenueberblick') { return; }
        (k.teile || []).forEach(function (t) {
          (t.abschnitte || []).forEach(function (a) {
            (a.bloecke || []).forEach(function (b) {
              if (!pfad && b.t === 'abb' && b.datei) { pfad = b.datei; }
            });
          });
        });
      });
      return pfad || ABBILDUNG;
    }).catch(function () { return ABBILDUNG; });
  }

  function holen() {
    if (abbQuelle) { return global.Promise.resolve(abbQuelle); }
    return abbildungspfadSuchen().then(function (pfad) {
      return global.fetch(pfad).then(function (antwort) {
        if (!antwort.ok) { throw new Error('HTTP ' + antwort.status); }
        return antwort.text();
      });
    }).then(function (text) {
      abbQuelle = text;
      return text;
    });
  }


  /* Alle Kästen der Grafik mit Beschriftung und Lexikoneinträgen. */
  function kaesten(svg) {
    var alle = kaestenLesen(svg);
    beschriftungVerteilen(alle, texteLesen(svg));
    alle.forEach(function (k) {
      k.eintraege = k.beschriftung ? eintraegeZuBeschriftung(k.beschriftung, KATEGORIE_JE_ART[k.art]) : null;
    });
    return alle;
  }

  /**
   * Lage der Ergebnisse in der Abbildung — für die Reihenfolge im Graphen:
   * id → [{ y, x, phasen, module }] je Kasten; phasen sind die Phasenbalken,
   * deren Höhe die Kastenmitte trifft (Konzept und Umsetzung liegen
   * nebeneinander), module die des nächsten Modulkopfs darüber, der die
   * Kastenmitte überdeckt (ein Kopf steht für Projektsteuerung und
   * Projektführung). Kästen in der Sammelfläche «Phasenunabhängig» (der
   * einzige Kasten ohne Eintrag) tragen sammel: true und gelten für alle
   * Phasen, über die die Sammelfläche reicht; eine Stelle im Ablauf haben sie
   * nicht.
   */
  function lagen(alle) {
    function mitEintrag(k) { return k.eintraege && k.eintraege.length; }
    var balken = alle.filter(function (k) { return k.art === 'phase' && mitEintrag(k); });
    var koepfe = alle.filter(function (k) { return k.art === 'modul' && mitEintrag(k); });
    var sammel = alle.filter(function (k) { return k.art === 'ergebnis' && !mitEintrag(k); });
    var aus = {};
    alle.forEach(function (k) {
      if (k.art !== 'ergebnis' || !mitEintrag(k)) { return; }
      var mx = k.x + k.w / 2, my = k.y + k.h / 2;
      /* Im Sammelkasten «Phasenunabhängig» gilt der Kasten für alle Phasen,
         über die der Sammelkasten reicht, und die Spalte des Sammelkastens;
         er trägt sammel: true, zählt also nicht für die Stelle im Feld. */
      var huelle = sammel.filter(function (s) { return mx >= s.x && mx <= s.x + s.w && my >= s.y && my <= s.y + s.h; })[0];
      var ox = huelle ? huelle.x + huelle.w / 2 : mx, oy = huelle ? huelle.y : k.y;
      var phasen = balken.filter(function (b) {
        if (!huelle) { return my >= b.y && my <= b.y + b.h; }
        /* Die Sammelfläche ragt ein Stück in den Abschluss hinein; es zählt
           nur, wo sie den grössten Teil des Balkens deckt. */
        var deckt = Math.min(b.y + b.h, huelle.y + huelle.h) - Math.max(b.y, huelle.y);
        return deckt >= b.h * 0.6;
      }).map(function (b) { return b.eintraege[0].begriff; });
      var kopf = null;
      koepfe.forEach(function (q) {
        if (ox >= q.x && ox <= q.x + q.w && q.y <= oy && (!kopf || q.y > kopf.y)) { kopf = q; }
      });
      var module = kopf ? kopf.eintraege.map(function (e) { return e.begriff; }) : [];
      k.eintraege.forEach(function (e) {
        var lage = { y: k.y, x: k.x, phasen: phasen, module: module };
        if (huelle) { lage.sammel = true; }
        (aus[e.id] = aus[e.id] || []).push(lage);
      });
    });
    return aus;
  }

  HT.abbildung = {
    BILDUNTERSCHRIFT: BILDUNTERSCHRIFT,
    QUELLE: QUELLE_ABB,
    FARBEN: FARBEN,
    holen: holen,
    lesen: lesen,
    masse: masse,
    kaesten: kaesten,
    lagen: lagen
  };
}(window));
