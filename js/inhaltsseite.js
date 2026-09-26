/* meinHERMES — Inhaltsseite eines Elements, gemeinsam für den Überblick
   (js/ueberblick.js) und das Raster (js/raster.js).

   Zu jedem Element dieselben Teile in derselben Reihenfolge: Kopf mit
   Zeichen der Kategorie, Kicker (Ergebnistyp oder Kategorie), Siegel
   «Minimal gefordert» bzw. «Zwingend in jedem Projekt», Vorlage als
   Download-Icon, Titel und Lead; darunter die übrigen Abschnitte der
   Quellseite auf hermes.admin.ch in ihrer Reihenfolge. Die Verweise am Ende
   baut der Gastgeber mit verweise(), vorn mit seinen eigenen Knöpfen.

   Die Stile (ub-kopf, ub-abschnitt, ub-verweise …) stehen in
   css/ueberblick.css. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var QUELLE_ALLGEMEIN = 'https://www.hermes.admin.ch/de/projektmanagement.html';

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    return el;
  }

  function ikone(kat, groesse, klasse) {
    var svg = HT.ui.katSymbol(kat, groesse);
    if (klasse) { svg.setAttribute('class', svg.getAttribute('class') + ' ' + klasse); }
    return svg;
  }

  function ikoneFuer(e) {
    if (e.kategorie === 'ergebnis' && e.typ === 'Meilenstein') { return 'meilenstein'; }
    return e.kategorie;
  }

  var TYP_KICKER = { Dokument: 'Dokument', Zustand: 'Zustand', Checkliste: 'Checkliste', Meilenstein: 'Meilenstein' };

  function kickerVon(e) {
    if (e.kategorie === 'ergebnis') { return TYP_KICKER[e.typ] || 'Ergebnis'; }
    var meta = HT.daten.kategorieMeta ? HT.daten.kategorieMeta(e.kategorie) : null;
    return meta ? meta.singular : e.kategorie;
  }

  function markerVon(e) {
    if (e.kategorie === 'ergebnis' && e.minimalGefordert) { return 'Minimal gefordert'; }
    if (e.kategorie === 'modul' && HT.karte.ZWINGENDE_MODULE.indexOf(e.begriff) !== -1) {
      return 'Zwingend in jedem Projekt';
    }
    return '';
  }

  /* Siegel in der Akzentfarbe statt Wortmarke; der Wortlaut («Minimal
     gefordert», «Zwingend in jedem Projekt») steht im Tooltip und für den
     Screenreader. */
  function markerIkone(text) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 10 }));
    svg.appendChild(svgEl('path', { d: 'M7.6 12.4l2.9 2.9 5.9-6.2' }));
    return h('span', { class: 'ub-marker', role: 'img', title: text, 'aria-label': text }, svg);
  }

  var IKONE_DOWNLOAD = ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M4.5 19.5h15'];

  /* Der erste Vorlagenverweis (.dotx) aus dem Handbuchtext — auf der
     Quellseite ein eigener Abschnitt, hier ein Download-Icon im Kopf. */
  function vorlageVon(text) {
    var abschnitte = text && text.abschnitte ? text.abschnitte : [];
    for (var i = 0; i < abschnitte.length; i++) {
      var bs = abschnitte[i].bloecke || [];
      for (var j = 0; j < bs.length; j++) {
        if (bs[j].t === 'download' && bs[j].url) { return bs[j]; }
      }
    }
    return null;
  }

  function vorlageIkone(block) {
    var meta = [block.datei, block.groesse].filter(Boolean).join(' · ');
    var titel = 'Dokumentvorlage herunterladen' + (meta ? ' (' + meta + ')' : '');
    return h('a', {
      class: 'ub-kopf__vorlage',
      href: block.url,
      target: '_blank',
      rel: 'noopener',
      download: block.datei || true,
      title: titel,
      'aria-label': titel
    }, HT.ui.symbol(IKONE_DOWNLOAD, 20));
  }

  function abschnitt(titel, kinder, klasse) {
    return h('section', { class: 'ub-abschnitt' + (klasse ? ' ' + klasse : '') }, [
      h('h3', { class: 'ub-mikro', text: titel })
    ].concat(kinder));
  }

  /* --- Handbuchabschnitte --------------------------------------------------- */

  function hbAbschnitt(text, titel) {
    if (!text || !text.abschnitte) { return null; }
    for (var i = 0; i < text.abschnitte.length; i++) {
      if ((text.abschnitte[i].titel || '').trim().toLowerCase() === titel.toLowerCase()) {
        return text.abschnitte[i];
      }
    }
    return null;
  }

  function absaetze(a) {
    return a ? a.bloecke.filter(function (b) { return b.t === 'p'; }) : [];
  }

  /* Quelle des Leads: der Abschnitt «Beschreibung», sonst der erste Absatzblock
     des ersten Abschnitts (Phasenseiten tragen keine Zwischentitel). Die
     verwendeten Blöcke werden mitgegeben, damit sie unten nicht ein zweites
     Mal erscheinen. Der Lead zeigt alle Absätze, nicht nur den ersten Satz —
     diese Seite hat keine Stufen, an denen mehr nachkäme. */
  function leadQuelle(text) {
    var a = hbAbschnitt(text, 'Beschreibung');
    if (a) { return { abschnitt: a, bloecke: absaetze(a) }; }
    var erster = text && text.abschnitte && text.abschnitte[0];
    if (!erster) { return { abschnitt: null, bloecke: [] }; }
    var raus = [];
    for (var i = 0; i < erster.bloecke.length; i++) {
      if (erster.bloecke[i].t === 'p') { raus.push(erster.bloecke[i]); }
      else if (raus.length) { break; }
    }
    return { abschnitt: null, bloecke: raus };
  }

  function leadBauen(e, lead) {
    if (lead.bloecke.length) {
      return lead.bloecke.map(function (b) { return h('p', { text: b.text }); });
    }
    var ersatz = e.definition || e.kurz || '';
    return ersatz ? [h('p', { text: ersatz })] : [];
  }

  /* Handbuchtexte je Eintrag, sobald geladen (null = keiner vorhanden). Die
     Kategoriedatei holt HT.daten einmalig; danach löst das Versprechen sofort
     auf und das Nachzeichnen ist nicht sichtbar. */
  var hbTexte = {};
  var wartende = {};

  /** Der Handbuchtext, falls schon geladen; sonst null und beiGeladen(id), sobald er da ist. */
  function text(e, beiGeladen) {
    if (Object.prototype.hasOwnProperty.call(hbTexte, e.id)) {
      if (hbTexte[e.id] === undefined && beiGeladen) { wartende[e.id].push(beiGeladen); }
      return hbTexte[e.id] || null;
    }
    hbTexte[e.id] = undefined;                  // nicht zweimal anfragen
    wartende[e.id] = beiGeladen ? [beiGeladen] : [];
    var id = e.id;
    HT.daten.handbuchElement(e).then(function (t) {
      hbTexte[id] = t || null;
      var liste = wartende[id];
      delete wartende[id];
      if (t) { liste.forEach(function (f) { f(id); }); }
    }).catch(function () { hbTexte[id] = null; delete wartende[id]; });
    return null;
  }

  /**
   * Kopf und Abschnitte der Seite zu e, als Liste von Elementen.
   * optionen.beiGeladen(id): der Handbuchtext ist nachgekommen — neu zeichnen.
   */
  function seite(e, optionen) {
    optionen = optionen || {};
    var t = text(e, optionen.beiGeladen);
    var lead = leadQuelle(t);
    var marker = markerVon(e);
    var vorlage = vorlageVon(t);
    var teile = [];

    teile.push(h('article', { class: 'ub-kopf' }, [
      h('div', { class: 'ub-kopf__zeile' }, [
        ikone(ikoneFuer(e), 24, 'ub-ikone--kopf'),
        h('span', { class: 'ub-kopf__kicker', text: kickerVon(e) }),
        (marker || vorlage) ? h('span', { class: 'ub-kopf__zeichen' }, [
          marker ? markerIkone(marker) : null,
          vorlage ? vorlageIkone(vorlage) : null
        ]) : null
      ]),
      h('h2', { class: 'ub-kopf__titel', text: e.begriff }),
      h('div', { class: 'ub-kopf__lead' }, leadBauen(e, lead))
    ]));

    /* Kein Steckbrief: Ergebnistyp, «minimal gefordert» und die Dokument-
       vorlage stehen als Kicker und Zeichen im Kopf. */

    /* Die übrigen Abschnitte der Quellseite in ihrer Reihenfolge — «Inhalt»
       und «Beziehungen» also genau so, wie sie auf hermes.admin.ch stehen.
       Der Vorlagenverweis hängt als Icon im Kopf; bleibt vom Abschnitt
       «Dokumentenvorlage» sonst nichts übrig, entfällt er. */
    (t && t.abschnitte ? t.abschnitte : []).forEach(function (a) {
      if (a === lead.abschnitt) { return; }                     // steht im Lead
      var titel = (a.titel || '').trim();
      var bs = (a.bloecke || []).filter(function (b) {
        return lead.bloecke.indexOf(b) === -1 && b.t !== 'download';
      });
      if (!bs.length) { return; }
      teile.push(abschnitt(titel || 'Aus dem Handbuch',
        [HT.ui.bloecke(bs, { verlinken: false, ebene: 4 })], 'ub-abschnitt--regel'));
    });

    /* Ohne Handbuchtext bleibt die kuratierte Fassung die einzige Quelle. */
    if (!t && e.details) {
      teile.push(abschnitt('Aus der Dokumentation', [
        h('p', { class: 'ub-doku', text: e.details })
      ], 'ub-abschnitt--regel'));
    }
    return teile;
  }

  /** Verweise am Ende: vorn die des Gastgebers, dann Handbuch und offizielle Seite. */
  function verweise(e, vorne) {
    return h('section', { class: 'ub-verweise' }, (vorne || []).concat([
      h('a', { class: 'ub-verweis', href: '#/handbuch?id=' + encodeURIComponent(e.id), text: 'Im Handbuch' }),
      h('a', {
        class: 'ub-verweis ub-verweis--akzent',
        href: (e.quelle && e.quelle.url) || QUELLE_ALLGEMEIN,
        target: '_blank', rel: 'noopener',
        text: 'Offizielle Seite ↗'
      })
    ]));
  }

  var LEGENDE = [
    { kat: 'rolle', text: 'Rolle — wer verantwortet und mitwirkt' },
    { kat: 'aufgabe', text: 'Aufgabe — was getan wird' },
    { kat: 'ergebnis', text: 'Ergebnis — was dabei entsteht' },
    { kat: 'meilenstein', text: 'Meilenstein — Ergebnis als Quality Gate' },
    { kat: 'modul', text: 'Modul — Bündel von Aufgaben und Ergebnissen' },
    { kat: 'phase', text: 'Phase — Abschnitt im Projektverlauf' }
  ];

  /** Die Elemente der Methode mit ihren Zeichen — für eine leere Seite. */
  function legende() {
    return [
      h('h3', { class: 'ub-mikro ub-mikro--legende', text: 'Die Elemente der Methode' }),
      h('ul', { class: 'ub-legende' }, LEGENDE.map(function (l) {
        return h('li', {}, [ikone(l.kat, 20, 'ub-ikone--legende'), h('span', { text: l.text })]);
      }))
    ];
  }

  HT.inhaltsseite = {
    legende: legende,
    QUELLE_ALLGEMEIN: QUELLE_ALLGEMEIN,
    ikone: ikone,
    ikoneFuer: ikoneFuer,
    abschnitt: abschnitt,
    seite: seite,
    verweise: verweise
  };
}(window));
