/* meinHERMES — kleine DOM- und Text-Helfer.
   Bewusst ohne innerHTML: alle Inhalte werden als Textknoten gesetzt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /**
   * Elementfabrik.
   * h('div', { class: 'a b', text: 'Hallo', on: { click: fn } }, [kindA, kindB])
   */
  function h(tag, attrs, kinder) {
    var el = document.createElement(tag);
    var k;

    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
        var wert = attrs[k];
        if (wert === null || wert === undefined || wert === false) { continue; }

        if (k === 'text') {
          el.textContent = String(wert);
        } else if (k === 'class') {
          el.className = String(wert);
        } else if (k === 'on') {
          for (var evt in wert) {
            if (Object.prototype.hasOwnProperty.call(wert, evt)) {
              el.addEventListener(evt, wert[evt]);
            }
          }
        } else if (k === 'dataset') {
          for (var d in wert) {
            if (Object.prototype.hasOwnProperty.call(wert, d)) {
              el.dataset[d] = String(wert[d]);
            }
          }
        } else if (wert === true) {
          el.setAttribute(k, '');
        } else {
          el.setAttribute(k, String(wert));
        }
      }
    }

    anhaengen(el, kinder);
    return el;
  }

  function anhaengen(el, kinder) {
    if (kinder === null || kinder === undefined || kinder === false) { return; }
    if (Array.isArray(kinder)) {
      for (var i = 0; i < kinder.length; i++) { anhaengen(el, kinder[i]); }
      return;
    }
    if (typeof kinder === 'string' || typeof kinder === 'number') {
      el.appendChild(document.createTextNode(String(kinder)));
      return;
    }
    if (kinder && kinder.nodeType) { el.appendChild(kinder); }
  }

  var NS = 'http://www.w3.org/2000/svg';

  /* Inline-SVG-Symbol aus Pfaden (keine externen Abhängigkeiten). */
  function symbol(pfade, groesse) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(groesse || 20));
    svg.setAttribute('height', String(groesse || 20));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (pfade || []).forEach(function (d) {
      var pf = document.createElementNS(NS, 'path');
      pf.setAttribute('d', d);
      svg.appendChild(pf);
    });
    return svg;
  }

  /* Icons der HERMES-Methodenelemente — dieselbe Strichführung wie die
     Navigation (24er-Raster, Kontur, keine Fläche). Jede Kategorie hat eine
     eigene Silhouette, damit sie auch ohne Farbe und ohne Beschriftung
     unterscheidbar bleibt: Rolle Person, Aufgabe Zahnrad, Ergebnis Dokument,
     Phase Fahne, Szenario Weg, Modul Baustein-Stapel, Grundbegriff Idee. */
  var KAT_PFADE = {
    phase: [
      'M6.2 3.2v17.6',
      'M6.2 4.8h11.6l-2.4 3.8 2.4 3.8H6.2'
    ],
    szenario: [
      'M4.4 19.6h3.2a4 4 0 0 0 4-4V8.6a4 4 0 0 1 4-4h4',
      'M17.2 2.2 19.6 4.6 17.2 7'
    ],
    modul: [
      'M12 3.2 20.4 8 12 12.8 3.6 8 12 3.2Z',
      'M3.6 12 12 16.8 20.4 12',
      'M3.6 16 12 20.8 20.4 16'
    ],
    aufgabe: [
      'M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z',
      'M12 3.5v3.1', 'M12 17.4v3.1',
      'M5.1 7.8 7.8 9.3', 'M16.2 14.7l2.7 1.5',
      'M5.1 16.2 7.8 14.7', 'M16.2 9.3l2.7-1.5'
    ],
    ergebnis: [
      'M13.6 3.4H7.2a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.6l-5.2-5.2Z',
      'M13.4 3.6v5.2h5.2'
    ],
    /* Meilenstein ist kein eigenes Methodenelement, sondern ein Ergebnistyp —
       im Graph aber so wichtig (Quality Gate), dass er ein eigenes Zeichen hat. */
    meilenstein: [
      'M12 3.2 20.8 12 12 20.8 3.2 12Z'
    ],
    rolle: [
      'M12 4.6a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z',
      'M5.2 19.8a6.8 6.8 0 0 1 13.6 0'
    ],
    grundbegriff: [
      'M8.3 14.6a5.6 5.6 0 1 1 7.4 0c-.8.7-1.3 1.5-1.3 2.4H9.6c0-.9-.5-1.7-1.3-2.4Z',
      'M9.6 19.4h4.8',
      'M10.8 21.6h2.4'
    ]
  };

  /** Pfade des Kategorie-Icons; unbekannte Kategorien fallen auf Grundbegriff. */
  function katPfade(kategorie) {
    return KAT_PFADE[kategorie] || KAT_PFADE.grundbegriff;
  }

  /** Fertiges Kategorie-Icon; die Strichfarbe erbt es vom umgebenden Element. */
  function katSymbol(kategorie, groesse) {
    var svg = symbol(katPfade(kategorie), groesse || 16);
    svg.setAttribute('class', 'kat-ikone kat-ikone--' + (kategorie || 'grundbegriff'));
    return svg;
  }

  /**
   * Dasselbe Icon als <g> in einer bestehenden SVG-Zeichnung: das 24er-Raster
   * wird auf `kante` skaliert und um (cx, cy) zentriert. Strichbreite und
   * Farbe kommen aus dem CSS der jeweiligen Zeichnung.
   * Genutzt vom Graphen und vom Graphbild der Überblick-Inhaltsseite.
   */
  function katGruppe(kategorie, cx, cy, kante, klasse) {
    var m = kante / 24;
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', (klasse || 'kat-ikone') + ' kat-ikone--' + (kategorie || 'grundbegriff'));
    g.setAttribute('transform', 'translate(' + (Math.round((cx - kante / 2) * 10) / 10)
      + ',' + (Math.round((cy - kante / 2) * 10) / 10) + ') scale(' + (Math.round(m * 100) / 100) + ')');
    katPfade(kategorie).forEach(function (d) {
      var pf = document.createElementNS(NS, 'path');
      pf.setAttribute('d', d);
      g.appendChild(pf);
    });
    return g;
  }

  function leeren(el) {
    while (el && el.firstChild) { el.removeChild(el.firstChild); }
    return el;
  }

  /** Guillemets um einen Text. */
  function zitat(text) {
    return '«' + String(text === null || text === undefined ? '' : text) + '»';
  }

  /** Kürzt Text auf ganze Wörter, hängt ein Auslassungszeichen an. */
  function kuerzen(text, max) {
    var t = String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
    if (t.length <= max) { return t; }
    var schnitt = t.slice(0, max);
    var letzte = schnitt.lastIndexOf(' ');
    if (letzte > max * 0.6) { schnitt = schnitt.slice(0, letzte); }
    return schnitt.replace(/[\s.,;:]+$/, '') + ' …';
  }

  var MIND_WORTLAENGE = 6;   // kürzere Wörter («Phase», «Modul») zu maskieren zerstört den Satz
  var WORT_TRENNER = /[\s\u2010-\u2015\-\/,;:.()\u00ab\u00bb\u201e\u201c"'\u2019]+/;

  function regexSchuetzen(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Maskiert ein Muster am Wortanfang. Statt eines Lookbehind — das ältere
   * Safari-Versionen nicht kennen — wird das Zeichen davor mitgefasst und
   * wieder eingesetzt.
   */
  function maskieren(text, muster, mitFortsetzung) {
    var kern = muster + (mitFortsetzung ? '\\p{L}*' : '');
    try {
      return text.replace(new RegExp('(^|[^\\p{L}])(' + kern + ')', 'giu'), '$1…');
    } catch (e) {
      var buchstaben = 'A-Za-zÄÖÜäöüß';
      var ersatz = muster + (mitFortsetzung ? '[' + buchstaben + ']*' : '');
      try {
        return text.replace(new RegExp('(^|[^' + buchstaben + '])(' + ersatz + ')', 'gi'), '$1…');
      } catch (e2) {
        return text;
      }
    }
  }

  /**
   * Ersetzt den gesuchten Begriff im Text durch eine Auslassung — samt seinen
   * längeren Einzelwörtern und deren Beugungen. Sonst steht die Lösung meist
   * noch im Text: bei «Ausschreibung erarbeiten» bliebe «Ausschreibung»
   * oder «Ausschreibungen» sichtbar.
   */
  /**
   * Wortstamm für Beugungen, die kein blosses Anhängsel sind: «Szenario» →
   * «Szenarien», «Studie» → «Studien», «Benutzerdefiniertes» → «Benutzerdefinierte».
   * Ein abschliessender Vokal oder ein «es» wird abgeschnitten; der Rest wird
   * mit Fortsetzung maskiert.
   */
  function stamm(wort) {
    var w = String(wort || '');
    if (w.length >= MIND_WORTLAENGE + 2 && /es$/i.test(w)) { return w.slice(0, -2); }
    if (w.length >= MIND_WORTLAENGE + 1 && /[aeo]$/i.test(w)) { return w.slice(0, -1); }
    return w;
  }

  function ohneBegriff(text, begriff) {
    var t = String(text === null || text === undefined ? '' : text);
    var b = String(begriff === null || begriff === undefined ? '' : begriff).trim();
    if (!t || b.length < 3) { return t; }

    /* Auch der ganze Begriff wird mit Fortsetzung maskiert, sonst bliebe von
       «Umsetzungsorganisation» beim Begriff «Umsetzung» ein «…sorganisation»
       stehen. */
    var ergebnis = maskieren(t, regexSchuetzen(b), true);

    b.split(WORT_TRENNER).forEach(function (wort) {
      if (wort.length < MIND_WORTLAENGE) { return; }
      ergebnis = maskieren(ergebnis, regexSchuetzen(stamm(wort)), true);
    });

    return ergebnis.replace(/…(\s*…)+/g, '…');
  }

  /** Lesbarer Rest nach der Maskierung — Grundlage für die Brauchbarkeitsprüfung. */
  function restlaenge(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(/…/g, ' ').replace(/\s+/g, ' ').trim().length;
  }

  /**
   * Steckt der Begriff — auch als Wortende eines Kompositums — noch im Text?
   * «Produktentwickler» verrät die Lösung «Entwickler», lässt sich aber nicht
   * maskieren, ohne einen eigenständigen Fachbegriff zu zerstören. Solche
   * Fälle werden darum als Frage verworfen statt weiter geschwärzt.
   */
  function enthaeltBegriff(text, begriff) {
    var t = String(text === null || text === undefined ? '' : text).toLowerCase();
    var b = String(begriff === null || begriff === undefined ? '' : begriff).trim().toLowerCase();
    if (!t || b.length < 3) { return false; }
    if (t.indexOf(b) !== -1) { return true; }

    var woerter = b.split(WORT_TRENNER);
    for (var i = 0; i < woerter.length; i++) {
      if (woerter[i].length < MIND_WORTLAENGE) { continue; }
      if (t.indexOf(woerter[i]) !== -1) { return true; }
      if (t.indexOf(stamm(woerter[i]).toLowerCase()) !== -1) { return true; }
    }
    return false;
  }

  /** Fisher-Yates auf einer Kopie. */
  function mischen(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function zufallsElement(liste) {
    if (!liste || !liste.length) { return null; }
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /** Prozentwert als ganze Zahl, 0 bei leerem Nenner. */
  function prozent(zaehler, nenner) {
    if (!nenner) { return 0; }
    return Math.round((zaehler / nenner) * 100);
  }

  /** Sichtbarer Quellenlink «HERMES online ↗» — Kernfeature jeder Karte. */
  function quellenLink(quelle, klasse) {
    if (!quelle || !quelle.url) { return null; }
    var bezeichnung = quelle.bezeichnung || 'HERMES online';
    return h('a', {
      class: klasse || 'quelle-link',
      href: quelle.url,
      target: '_blank',
      rel: 'noopener',
      title: bezeichnung,
      'aria-label': bezeichnung + ' (öffnet in neuem Tab)'
    }, [
      h('span', { text: 'HERMES online' }),
      h('span', { class: 'quelle-link__pfeil', 'aria-hidden': 'true', text: '↗' })
    ]);
  }

  function badge(kategorie) {
    var meta = HT.daten && HT.daten.kategorieMeta ? HT.daten.kategorieMeta(kategorie) : null;
    return h('span', { class: 'badge badge--' + (kategorie || 'grundbegriff') }, [
      katSymbol(kategorie, 13),
      h('span', { text: meta ? meta.singular : (kategorie || 'Begriff') })
    ]);
  }

  function leerZustand(titel, text, aktion) {
    return h('div', { class: 'leer' }, [
      h('strong', { text: titel }),
      h('p', { text: text || '' }),
      aktion || null
    ]);
  }


  /* --- Handbuchtext: Blöcke aus data/handbuch/ als DOM ------------------- */

  /** Link auf die Karte eines Eintrags im Handbuch (oder Text, wenn nichts passt). */
  function eintragLink(eintrag, text) {
    if (!eintrag) { return document.createTextNode(text); }
    return h('a', {
      class: 'hb-link',
      href: '#/handbuch?id=' + encodeURIComponent(eintrag.id),
      title: eintrag.begriff + ' im Handbuch anzeigen'
    }, text);
  }

  /**
   * Text, in dem bekannte Begriffe auf ihre Karte verlinkt sind — nur für kurze
   * Zellen/Listenpunkte, die selbst Begriffe sind («Auftraggeber*, Projektleiter»).
   */
  function begriffeText(text, verlinken) {
    var kinder = [];
    if (!verlinken || !HT.daten || !HT.daten.begriffeAufloesen) { return [document.createTextNode(text)]; }
    var teile = HT.daten.begriffeAufloesen(text);
    if (!teile.some(function (t) { return !!t.eintrag; })) { return [document.createTextNode(text)]; }
    teile.forEach(function (t) {
      if (t.trenner || !t.eintrag) { kinder.push(document.createTextNode(t.text)); return; }
      kinder.push(eintragLink(t.eintrag, t.text));
    });
    return kinder;
  }

  function listeElement(block, optionen) {
    var tag = block.t === 'ol' ? 'ol' : 'ul';
    var el = h(tag, { class: 'hb-liste' });
    (block.items || []).forEach(function (item) {
      var li = h('li', {});
      if (item.titel) {
        li.appendChild(h('b', { class: 'hb-li-titel' }, begriffeText(item.titel, optionen.verlinken)));
        li.appendChild(document.createTextNode(item.text ? ' ' : ''));
      }
      begriffeText(item.text || '', optionen.verlinken && (item.text || '').length < 90).forEach(function (k) { li.appendChild(k); });
      if (item.items && item.items.length) {
        li.appendChild(listeElement({ t: 'ul', items: item.items }, optionen));
      }
      el.appendChild(li);
    });
    return el;
  }

  function istKreuz(text) {
    return /^x$/i.test(String(text || '').trim());
  }

  /* Welche Zeilen sind Kopfzeilen? Zwei Quellen. Erstens das Merkmal aus dem
     Import (fett im PDF): das sind die Spaltentitel und die Gruppenzeilen, die
     das Handbuch mitten in einer Tabelle genauso setzt («Steuerung /
     Steuerungsrollen» in Tabelle 19). Zweitens die Wiederholung nach einem
     Seitenumbruch: der Import hat sie in den Tabellen 4, 5, 8, 12, 15 und 18
     als gewöhnliche Zeile übernommen — mitten in den Daten stand ein
     linksbündiges «I K R E U A». Eine Zeile, die Wort für Wort einer früheren
     Kopfzeile gleicht, ist wieder eine Kopfzeile.
     Die Spalten beschriftet (scope) nur, was ganz oben steht und selbst keine
     Kreuze trägt: «Steuerung / Steuerungsrollen» ist die erste Zeile unter den
     Spaltentiteln, benennt aber eine Gruppe und bringt eigene Kreuze mit. */
  function kopfZeilen(zeilen) {
    var gesehen = {}, raus = [], vorn = true;
    zeilen.forEach(function (z) {
      var texte = z.map(function (c) { return String(c.text || '').trim(); });
      var sig = texte.join('\u0001');
      var ausDaten = z.length > 0 && z.every(function (c) { return !!c.kopf; });
      var gefuellt = texte.some(function (s) { return !!s; });
      if (ausDaten) { gesehen[sig] = true; }
      var kopf = ausDaten || (gefuellt && !!gesehen[sig]);
      var mitKreuz = texte.some(istKreuz);
      raus.push({ kopf: kopf, spalte: kopf && vorn && !mitKreuz });
      if (!kopf) { vorn = false; }
    });
    return raus;
  }

  /* Kreuzspalten: Spalten, in denen ausser Kreuzen nichts steht — die Phasen
     I K R E U A, die Module eines Szenarios, «minimal geforderte Dokumente».
     Ihre Zellen und die Überschrift darüber stehen mittig und die Spalte wird
     so schmal wie ihr Inhalt; sonst stand der Buchstabe links und der Haken in
     der Mitte, die beiden also nicht übereinander. Gezählt wird nur in den
     Datenzeilen: in Tabelle 19 tragen auch Kopfzeilen Kreuze. */
  function kreuzSpalten(zeilen, koepfe) {
    var breite = 0, i;
    zeilen.forEach(function (z) { breite = Math.max(breite, z.length); });
    var hat = [], nur = [], kreuz = [];
    for (i = 0; i < breite; i++) { hat[i] = false; nur[i] = true; }
    zeilen.forEach(function (z, nr) {
      if (koepfe[nr].kopf) { return; }
      z.forEach(function (zelle, k) {
        var s = String(zelle.text || '').trim();
        if (!s) { return; }
        if (istKreuz(s)) { hat[k] = true; } else { nur[k] = false; }
      });
    });
    for (i = 0; i < breite; i++) { kreuz[i] = hat[i] && nur[i]; }
    /* Eine leere Spalte gehört dazu, wenn sie an eine Kreuzspalte grenzt: das
       Modul Produkt hat in den Phasen I und A kein Kreuz, ihre Buchstaben
       gehören trotzdem zur Gruppe und dürfen die Spalte nicht breit machen.
       Einmal nach rechts, einmal nach links — so werden auch Lücken mitten in
       der Gruppe erfasst. */
    for (i = 1; i < breite; i++) { if (kreuz[i - 1] && nur[i]) { kreuz[i] = true; } }
    for (i = breite - 2; i >= 0; i--) { if (kreuz[i + 1] && nur[i]) { kreuz[i] = true; } }
    return kreuz;
  }

  /* Eine Kopfzeile in Gruppen zerlegen. Trägt eine Gruppe benachbarter
     Kreuzspalten nur einen einzigen Titel («Phasen» über I K R E U A), wird
     daraus eine verbundene Zelle über der ganzen Gruppe — so steht sie im PDF,
     und die Spalte, in der der Titel beim Lesen zufällig landete, wird nicht
     mehr breiter als die anderen. Zeilen aus lauter Buchstaben bleiben, wie
     sie sind. */
  function kopfGruppen(zeile, kreuz) {
    var raus = [];
    for (var i = 0; i < zeile.length;) {
      if (!kreuz[i]) { raus.push({ zelle: zeile[i], spalten: 1, kreuz: false, index: i }); i++; continue; }
      var ende = i;
      while (ende < zeile.length && kreuz[ende]) { ende++; }
      var gefuellt = [];
      for (var j = i; j < ende; j++) {
        if (String(zeile[j].text || '').trim()) { gefuellt.push(zeile[j]); }
      }
      if (gefuellt.length <= 1) {
        raus.push({ zelle: gefuellt[0] || zeile[i], spalten: ende - i, kreuz: true, index: i });
      } else {
        for (var k = i; k < ende; k++) { raus.push({ zelle: zeile[k], spalten: 1, kreuz: true, index: k }); }
      }
      i = ende;
    }
    return raus;
  }

  /* Die Spalte der agilen Phase Umsetzung. Das Referenzhandbuch hebt sie in
     den Tabellen der Module hervor — dort ist sie rot hinterlegt, damit man
     klassisch und agil auseinanderhält. Hier steht sie dunkelgrau: Rot gehört
     in dieser Anwendung den Haken. Erkannt wird sie am Spaltentitel «U» bzw.
     «Umsetzung» in einer Kopfzeile; so bekommt auch Tabelle 3, die im PDF
     ohne Hervorhebung auskommt, dieselbe Marke. */
  function umsetzungSpalten(zeilen, koepfe, kreuz) {
    var raus = kreuz.map(function () { return false; });
    zeilen.forEach(function (z, nr) {
      if (!koepfe[nr].kopf) { return; }
      z.forEach(function (zelle, i) {
        if (!kreuz[i]) { return; }
        var t = String(zelle.text || '').trim().toLowerCase();
        if (t === 'u' || t === 'umsetzung') { raus[i] = true; }
      });
    });
    return raus;
  }

  function tabelleElement(block, optionen) {
    var tabelle = h('table', { class: 'hb-tabelle' + (block.unten ? ' hb-tabelle--unten' : '') });
    if (block.titel) { tabelle.appendChild(h('caption', { text: block.titel })); }
    var zeilen = block.zeilen || [];
    var koepfe = kopfZeilen(zeilen);
    var kreuz = kreuzSpalten(zeilen, koepfe);
    var umsetzung = umsetzungSpalten(zeilen, koepfe, kreuz);
    var koerper = h('tbody');
    zeilen.forEach(function (zeile, nr) {
      var istKopf = koepfe[nr].kopf;
      var tr = h('tr');
      var felder = istKopf
        ? kopfGruppen(zeile, kreuz)
        : zeile.map(function (z, i) { return { zelle: z, spalten: 1, kreuz: !!kreuz[i], index: i }; });
      felder.forEach(function (feld) {
        var text = feld.zelle.text || '';
        var x = istKreuz(text);
        var klassen = [];
        if (x) { klassen.push('hb-x'); }
        /* Eine verbundene Zelle steht über mehreren Spalten mittig, eine
           einzelne Kreuzspalte bleibt zudem so schmal wie ihr Inhalt. */
        if (feld.kreuz) { klassen.push('hb-mitte'); }
        if (feld.kreuz && feld.spalten === 1) { klassen.push('hb-schmal'); }
        /* Nur die einzelne Spalte, nicht die verbundene Zelle «Phasen» darüber. */
        if (feld.spalten === 1 && umsetzung[feld.index]) { klassen.push('hb-umsetzung'); }
        var td = h(istKopf ? 'th' : 'td', {
          class: klassen.length ? klassen.join(' ') : null,
          colspan: feld.spalten > 1 ? String(feld.spalten) : null,
          /* Nur der Kopf zuoberst beschriftet die Spalten; Gruppenzeilen und
             die Wiederholung nach dem Seitenumbruch tun es nicht noch einmal. */
          scope: koepfe[nr].spalte ? (feld.spalten > 1 ? 'colgroup' : 'col') : null
        }, x ? [h('span', { class: 'nur-sr', text: 'ja' }), h('span', { 'aria-hidden': 'true', text: '✓' })]
             : begriffeText(text, optionen.verlinken && !istKopf && text.length < 120));
        tr.appendChild(td);
      });
      koerper.appendChild(tr);
    });
    tabelle.appendChild(koerper);
    return h('div', { class: 'hb-tabelle-wrap' }, tabelle);
  }

  function abbildungElement(block) {
    var bild = null;
    if (block.datei) {
      bild = h('img', { src: block.datei, alt: block.text || 'Abbildung aus dem HERMES-Referenzhandbuch', loading: 'lazy' });
    } else if (block.src) {
      bild = h('a', { href: block.src, target: '_blank', rel: 'noopener', class: 'btn btn--klein' },
        (block.text || 'Abbildung') + ' auf HERMES online ansehen ↗');
    }
    if (!bild) { return null; }
    return h('figure', { class: 'hb-abb' + (block.text ? '' : ' hb-abb--ohne') }, [
      bild,
      block.text ? h('figcaption', { text: block.text }) : null
    ]);
  }

  /* Verweis auf eine Dokumentvorlage (.dotx) auf hermes.admin.ch. Der Klick
     lädt eine Datei — deshalb steht Dateiname und Grösse sichtbar dabei. */
  function downloadElement(block) {
    if (!block.url) { return null; }
    var meta = [block.datei, block.groesse].filter(Boolean).join(' · ');
    return h('a', {
      class: 'hb-vorlage',
      href: block.url,
      target: '_blank',
      rel: 'noopener',
      download: block.datei || true
    }, [
      h('span', { class: 'hb-vorlage__ikone', 'aria-hidden': 'true', text: '↓' }),
      h('span', { class: 'hb-vorlage__text' }, [
        h('b', { text: block.titel || 'Dokumentvorlage' }),
        meta ? h('span', { class: 'hb-vorlage__meta', text: meta }) : null
      ])
    ]);
  }

  /**
   * Rendert eine Blockliste (p, ul/ol, tabelle, abb, download, h).
   * p/h mit «art» (kursiv, fussnote) bekommen die Klasse hb-p--<art> bzw. hb-h--<art>;
   * eine Tabelle mit «unten» zeigt ihren Titel unter der Tabelle (wie im PDF).
   * optionen.verlinken: Begriffe in Listen/Zellen auf ihre Karte verlinken.
   * optionen.ebene: HTML-Überschriftenebene für «h»-Blöcke (Standard 4).
   * optionen.seite: Seite, auf der der Text beginnt (steht schon im Titel);
   *   beginnt ein Block auf einer späteren Seite, geht ihm eine Seitenmarke
   *   «S. n» voraus — mit optionen.pdf (URL des Referenzhandbuchs) als Link
   *   auf die Seite. Blöcke, die über den Umbruch laufen, bleiben ganz.
   */
  function seitenmarke(seite, pdf) {
    var text = 'S. ' + seite;
    var kern = pdf
      ? h('a', { href: pdf + '#page=' + seite, target: '_blank', rel: 'noopener', title: 'Seite ' + seite + ' im Referenzhandbuch (PDF, neuer Tab)', text: text })
      : h('span', { text: text });
    return h('div', { class: 'hb-seitenmarke', role: 'separator', 'aria-label': 'Seite ' + seite }, kern);
  }

  function bloecke(liste, optionen) {
    optionen = optionen || {};
    var frag = document.createDocumentFragment();
    var seite = optionen.seite || null;
    (liste || []).forEach(function (b) {
      if (!b || !b.t) { return; }
      if (b.seite && seite && b.seite > seite) { frag.appendChild(seitenmarke(b.seite, optionen.pdf)); }
      if (b.seite && (!seite || b.seite > seite)) { seite = b.seite; }
      var el = null;
      if (b.t === 'p') {
        el = h('p', { class: 'hb-p' + (b.art ? ' hb-p--' + b.art : '') }, begriffeText(b.text || '', optionen.verlinken && (b.text || '').length < 60));
      } else if (b.t === 'ul' || b.t === 'ol') {
        el = listeElement(b, optionen);
      } else if (b.t === 'tabelle') {
        el = tabelleElement(b, optionen);
      } else if (b.t === 'abb') {
        el = abbildungElement(b);
      } else if (b.t === 'download') {
        el = downloadElement(b);
      } else if (b.t === 'h') {
        var n = Math.min(6, Math.max(2, (optionen.ebene || 4) + Math.max(0, (b.n || 2) - 2)));
        el = h('h' + n, { class: 'hb-h' + (b.art ? ' hb-h--' + b.art : ''), text: b.text || '' });
      }
      if (el) { frag.appendChild(el); }
    });
    return frag;
  }

  /** Verweiszeile «Referenzhandbuch Kap. 5.4.3.34 · S. 140 · HERMES online ↗». */
  function handbuchVerweis(info, quelle) {
    var teile = [];
    if (info && info.nummer) {
      teile.push(h('span', { text: 'Referenzhandbuch Kap. ' + info.nummer + (info.seite ? ', S. ' + info.seite : '') }));
    } else if (info && info.seite) {
      teile.push(h('span', { text: 'Referenzhandbuch S. ' + info.seite }));
    }
    var url = (quelle && quelle.url) || (info && info.url);
    if (url) {
      teile.push(h('a', {
        href: url, target: '_blank', rel: 'noopener', class: 'hb-online',
        'aria-label': 'Diese Seite auf HERMES online öffnen (neuer Tab)'
      }, 'HERMES online ↗'));
    }
    if (!teile.length) { return null; }
    return h('p', { class: 'hb-verweis' }, teile);
  }

  /** Kleine Faktenzeile («Verantwortlich: Auftraggeber · Phasen: K R»). */
  function faktenChip(label, kinder, klasse) {
    return h('span', { class: 'fakt' + (klasse ? ' ' + klasse : '') }, [
      h('span', { class: 'fakt__label', text: label + ' ' }),
      h('span', { class: 'fakt__wert' }, kinder)
    ]);
  }

  /* --- Rad und Ziehen auf scrollenden Flächen ------------------------------ */

  /* Das Mausrad zoomt um den Zeiger, wie im grossen Graph: erst den Massstab
     ändern, dann so weit scrollen, dass der Punkt unter dem Zeiger stehen
     bleibt. Weil das Rad damit nicht mehr scrollt, verschiebt Ziehen mit
     gedrückter Maustaste die Fläche. Ein Klick bleibt ein Klick: erst ab 8 px
     Weg zählt es als Zug, und der Klick danach wird geschluckt. Auf schmalen
     Bildschirmen scrollt die Fläche nicht selbst — dort bleibt alles beim
     Alten, sonst stünde das Rad für die Seite still.
     inhaltHolen() liefert das gezoomte Element oder null; skalieren(faktor)
     wendet den Faktor an und gibt den tatsächlich erreichten zurück.
     optionen.nurMitTaste: das Rad rollt wie gewohnt und zoomt nur mit Strg
     bzw. ⌘ — oder mit zwei Fingern auf dem Trackpad, die der Browser als Rad
     mit Strg meldet. Für Flächen, die höher als der Schirm sind (Trainer). */
  function radZoomAnbinden(flaeche, inhaltHolen, skalieren, optionen) {
    var nurMitTaste = !!(optionen && optionen.nurMitTaste);

    function scrollt() {
      var cs = global.getComputedStyle(flaeche);
      return /auto|scroll/.test(cs.overflowX + ' ' + cs.overflowY);
    }

    flaeche.addEventListener('wheel', function (ev) {
      var inhalt = inhaltHolen();
      if (!inhalt || !scrollt()) { return; }
      if (nurMitTaste && !ev.ctrlKey && !ev.metaKey) { return; }
      ev.preventDefault();
      var r = inhalt.getBoundingClientRect();
      var px = ev.clientX - r.left, py = ev.clientY - r.top;
      var f = skalieren(Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015)));
      if (!f || f === 1) { return; }
      flaeche.scrollLeft += px * (f - 1);
      flaeche.scrollTop += py * (f - 1);
    }, { passive: false });

    var zug = null;
    var bewegt = false;

    flaeche.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch') { return; }
      if (!inhaltHolen() || !scrollt()) { return; }
      zug = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, links: flaeche.scrollLeft, oben: flaeche.scrollTop };
      bewegt = false;
    });

    flaeche.addEventListener('pointermove', function (ev) {
      if (!zug || ev.pointerId !== zug.id) { return; }
      var dx = ev.clientX - zug.x, dy = ev.clientY - zug.y;
      if (!bewegt) {
        if (Math.hypot(dx, dy) <= 8) { return; }
        bewegt = true;
        try { flaeche.setPointerCapture(zug.id); } catch (e) { /* egal */ }
        flaeche.classList.add('ist-am-ziehen');
        document.body.style.userSelect = 'none';
        if (global.getSelection) { global.getSelection().removeAllRanges(); }
      }
      flaeche.scrollLeft = zug.links - dx;
      flaeche.scrollTop = zug.oben - dy;
    });

    function zugEnde(ev) {
      if (!zug || ev.pointerId !== zug.id) { return; }
      zug = null;
      flaeche.classList.remove('ist-am-ziehen');
      document.body.style.userSelect = '';
      /* «bewegt» bleibt bis zum click-Ereignis gesetzt, damit ein Zug keinen Klick auslöst. */
      global.setTimeout(function () { bewegt = false; }, 0);
    }
    flaeche.addEventListener('pointerup', zugEnde);
    flaeche.addEventListener('pointercancel', zugEnde);
    flaeche.addEventListener('click', function (ev) {
      if (bewegt) { ev.preventDefault(); ev.stopPropagation(); }
    }, true);
  }


  /* --- Suchpille ----------------------------------------------------------- */

  /* Rundes Suchfeld mit Lupe und Trefferliste als Ausklappmenü — in der
     Kopfzeile. opt.treffer(text) liefert die Einträge, opt.beiWahl(eintrag)
     bekommt den gewählten. Enter nimmt den ersten Treffer, Escape leert das
     Feld, ein Klick daneben schliesst die Liste.
     Eine Ansicht kann die Pille in einen Fundstellen-Modus schalten wie die
     Suche in Word (el.modusSetzen(modus), das Handbuch): statt der Liste
     stehen rechts im Feld der Zähler «3/42» und zwei Pfeile. modus: { name,
     platzhalter, label, eingabe(text, weiter), schritt(richtung), beenden(),
     vorbereiten() } — vorbereiten (freiwillig) beim Fokus, eingabe beim Tippen verzögert (mit weiter = true, wenn Enter die
     Verzögerung abkürzt), schritt(+1/-1) bei Enter, Umschalt+Enter und den
     Pfeilen, beenden, wenn die Ansicht den Modus wieder abgibt. Zurück kommt
     { stand(s), fokus() }; stand({ aktuell, gesamt, laedt }) setzt den
     Zähler, stand(null) blendet ihn aus. */
  function suchpille(opt) {
    var feld = h('input', {
      type: 'search', class: 'suche__feld gleiste-suche__feld',
      placeholder: opt.platzhalter || 'Suchen …',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      'aria-label': opt.label || opt.platzhalter || 'Suchen'
    });
    var liste = h('ul', { class: 'gs-treffer gleiste-suche__treffer', role: 'listbox', 'aria-label': 'Suchtreffer' });
    liste.hidden = true;
    var lupe = h('span', { class: 'gleiste-suche__ikone', 'aria-hidden': 'true' },
      symbol(['M10.6 3.6a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M15.6 15.6 20.4 20.4'], 16));

    var modus = null;
    var zahl = h('span', { class: 'gleiste-suche__zahl', 'aria-hidden': 'true' });
    var ansage = h('span', { class: 'nur-sr', role: 'status' });
    var zurueck = h('button', {
      type: 'button', class: 'gleiste-suche__schritt', title: 'Vorheriger Treffer (Umschalt+Enter)', 'aria-label': 'Vorheriger Treffer',
      on: { click: function () { if (modus) { modus.schritt(-1); } } }
    }, symbol(['M6 15l6-6 6 6'], 16));
    var vor = h('button', {
      type: 'button', class: 'gleiste-suche__schritt', title: 'Nächster Treffer (Enter)', 'aria-label': 'Nächster Treffer',
      on: { click: function () { if (modus) { modus.schritt(1); } } }
    }, symbol(['M6 9l6 6 6-6'], 16));
    var fund = h('span', { class: 'gleiste-suche__fund', hidden: true }, [zahl, ansage, zurueck, vor]);
    /* Die Pfeile nehmen dem Feld den Fokus nicht — so bleibt die Pille offen. */
    fund.addEventListener('mousedown', function (ev) { ev.preventDefault(); });

    var el = h('div', { class: 'gleiste-suche' }, [lupe, feld, fund, liste]);
    var timer = null;

    function stand(s) {
      fund.hidden = !s;
      el.classList.toggle('ist-suchend', !!s);
      if (!s) {
        feld.style.paddingRight = '';
        ansage.textContent = '';
        return;
      }
      var text, sagen;
      if (s.laedt) { text = '…'; sagen = 'Suche läuft'; }
      else if (!s.gesamt) { text = '0'; sagen = 'Keine Treffer'; }
      else if (s.aktuell) { text = s.aktuell + '/' + s.gesamt; sagen = 'Treffer ' + s.aktuell + ' von ' + s.gesamt; }
      else { text = s.gesamt + ' Treffer'; sagen = s.gesamt + ' Treffer'; }
      zahl.textContent = text;
      zahl.classList.toggle('ist-leer', !s.laedt && !s.gesamt);
      ansage.textContent = sagen;
      zurueck.disabled = vor.disabled = !s.gesamt;
      feld.style.paddingRight = (fund.offsetWidth + 10) + 'px';
    }

    el.modusSetzen = function (m) {
      if (modus && m && modus.name === m.name) { modus = m; return api; }
      if (timer) { clearTimeout(timer); timer = null; }
      if (modus && modus.beenden) { modus.beenden(); }
      modus = m || null;
      feld.value = '';
      liste.hidden = true;
      stand(null);
      feld.placeholder = (modus && modus.platzhalter) || opt.platzhalter || 'Suchen …';
      feld.setAttribute('aria-label', (modus && modus.label) || opt.label || opt.platzhalter || 'Suchen');
      return modus ? api : null;
    };
    var api = {
      stand: stand,
      fokus: function () { feld.focus(); feld.select(); }
    };

    function zeichnen() {
      if (modus) { return; }
      var text = feld.value.trim();
      leeren(liste);
      if (text.length < 2) { liste.hidden = true; return; }
      var treffer = opt.treffer(text) || [];
      if (!treffer.length) {
        liste.appendChild(h('li', { class: 'gs-treffer__leer', text: 'Keine Treffer' }));
        liste.hidden = false;
        return;
      }
      treffer.forEach(function (e) {
        var meta = HT.daten && HT.daten.kategorieMeta ? HT.daten.kategorieMeta(e.kategorie) : null;
        liste.appendChild(h('li', {}, h('button', {
          type: 'button', class: 'gs-treffer__knopf', on: { click: function () {
            feld.value = '';
            liste.hidden = true;
            opt.beiWahl(e);
          } }
        }, [
          h('span', { class: 'gswatch gswatch--' + e.kategorie, 'aria-hidden': 'true' }, katSymbol(e.kategorie, 13)),
          h('span', { class: 'gs-treffer__text', text: e.begriff }),
          h('span', { class: 'gs-treffer__art', text: meta ? meta.singular : '' })
        ])));
      });
      liste.hidden = false;
    }

    function eingeben(weiter) {
      timer = null;
      if (modus) { modus.eingabe(feld.value.trim(), !!weiter); }
    }

    feld.addEventListener('input', function () {
      if (timer) { clearTimeout(timer); }
      timer = modus ? setTimeout(eingeben, 250) : setTimeout(zeichnen, 120);
    });
    feld.addEventListener('focus', function () {
      if (modus) { if (modus.vorbereiten) { modus.vorbereiten(); } return; }
      if (feld.value.trim().length >= 2) { zeichnen(); }
    });
    feld.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (modus) {
          /* Noch nicht gesucht (Tippen eben erst): die Suche sofort, sie
             springt selbst zum ersten Treffer. */
          if (timer) { clearTimeout(timer); eingeben(true); } else { modus.schritt(ev.shiftKey ? -1 : 1); }
          return;
        }
        var erster = liste.querySelector('button');
        if (erster) { erster.click(); }
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        if (timer) { clearTimeout(timer); timer = null; }
        feld.value = '';
        liste.hidden = true;
        if (modus) { modus.eingabe('', false); }
      }
    });
    function daneben(ev) {
      if (!document.body.contains(el)) { document.removeEventListener('pointerdown', daneben); return; }
      if (!liste.hidden && !el.contains(ev.target)) { liste.hidden = true; }
    }
    document.addEventListener('pointerdown', daneben);
    return el;
  }

  /* Treffer für die Suchpille: Gruppen (Module, Phasen) zuerst, dann
     Elemente. Namenstreffer haben Vorrang — der Volltext über Definitionen
     greift nur, wenn kein Name passt, sonst stünde «Abschluss» unter
     «Projektf». elementeSuchen(text) liefert die Elementeinträge. */
  function suchtreffer(text, gruppenKategorien, elementeSuchen) {
    var abfrage = HT.daten.normalisieren(text);
    function imNamen(e) { return HT.daten.normalisieren(e.begriff).indexOf(abfrage) !== -1; }
    var gruppen = gruppenKategorien && gruppenKategorien.length ? HT.daten.suchen(text, gruppenKategorien) : [];
    var elemente = elementeSuchen(text) || [];
    var gruppenName = gruppen.filter(imNamen), elementeName = elemente.filter(imNamen);
    var treffer = (gruppenName.length || elementeName.length)
      ? gruppenName.slice(0, 4).concat(elementeName.slice(0, 8))
      : gruppen.slice(0, 3).concat(elemente.slice(0, 7));
    return treffer.slice(0, 10);
  }

  HT.ui = {
    h: h,
    suchpille: suchpille,
    suchtreffer: suchtreffer,
    symbol: symbol,
    katSymbol: katSymbol,
    katPfade: katPfade,
    katGruppe: katGruppe,
    bloecke: bloecke,
    eintragLink: eintragLink,
    handbuchVerweis: handbuchVerweis,
    faktenChip: faktenChip,
    leeren: leeren,
    zitat: zitat,
    kuerzen: kuerzen,
    ohneBegriff: ohneBegriff,
    restlaenge: restlaenge,
    enthaeltBegriff: enthaeltBegriff,
    mischen: mischen,
    zufallsElement: zufallsElement,
    prozent: prozent,
    quellenLink: quellenLink,
    badge: badge,
    leerZustand: leerZustand,
    radZoomAnbinden: radZoomAnbinden
  };
}(window));
