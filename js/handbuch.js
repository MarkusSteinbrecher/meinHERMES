/* meinHERMES — Ansicht «Handbuch».
   Das Referenzhandbuch Projektmanagement (PDF, Ausgabe 2022) 1:1 als Text
   in seiner Gliederung: Vorwort · A Methodenüberblick · B Methodenelemente ·
   1 Phasen · 2 Szenarien · 3 Module · 4 Ergebnisse · 5 Aufgaben · 6 Rollen ·
   7 Hinweise zur Anwendung · Vokabular. Die Daten kommen aus
   data/handbuch/rhb/ (tools/rhb-import.py); jeder Abschnitt trägt Nummer und
   Seite des PDF, Seitenzahlen sind Links auf die Seite im PDF. Abschnitte, die
   ein Element beschreiben (4.4.1.1 Abnahmeprotokoll), stehen als Karte mit
   Faktenzeile, Link auf HERMES online und ins PDF (siehe js/karte.js) und,
   bei Aufgaben und Ergebnissen, rechts in der Verweiszeile dem Lernstand
   ihrer Lernkarte als fünf Punkte (HT.lernkarten.marke).
   Die Kapitel stehen in einer zweiten Leiste unter der Kopfzeile
   (HT.app.unterleiste), rechts darin ein Info-Icon zu Zweck und Quelle der
   Seite. Gesucht wird in der Kopfzeile: hier im Text des ganzen Handbuchs,
   mit Trefferzahl und Sprung von Treffer zu Treffer (Abschnitt «Suche im
   Handbuch»). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  /* Kapitel in Handbuchreihenfolge — dieselbe Liste wie im Import; index.json
     liefert Seiten und Inhaltsverzeichnis. */
  var KAPITEL = [
    { id: 'vorwort', nummer: '', titel: 'Vorwort', kategorie: null },
    { id: 'methodenueberblick', nummer: 'A', titel: 'Methodenüberblick', kategorie: null },
    { id: 'methodenelemente', nummer: 'B', titel: 'Methodenelemente', kategorie: null },
    { id: 'phasen', nummer: '1', titel: 'Phasen', kategorie: 'phase' },
    { id: 'szenarien', nummer: '2', titel: 'Szenarien', kategorie: 'szenario' },
    { id: 'module', nummer: '3', titel: 'Module', kategorie: 'modul' },
    { id: 'ergebnisse', nummer: '4', titel: 'Ergebnisse', kategorie: 'ergebnis' },
    { id: 'aufgaben', nummer: '5', titel: 'Aufgaben', kategorie: 'aufgabe' },
    { id: 'rollen', nummer: '6', titel: 'Rollen', kategorie: 'rolle' },
    { id: 'hinweise', nummer: '7', titel: 'Hinweise zur Anwendung', kategorie: null },
    { id: 'vokabular', nummer: '', titel: 'Vokabular', kategorie: null }
  ];

  var zustand = {
    kapitel: 'methodenueberblick',  // zuletzt gelesenes Kapitel
    initialisiert: false
  };

  function kapitelMeta(id) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].id === id) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelDerKategorie(kat) {
    for (var i = 0; i < KAPITEL.length; i++) { if (KAPITEL[i].kategorie === kat) { return KAPITEL[i]; } }
    return null;
  }

  function kapitelAdresse(id, teil) {
    return '#/handbuch?kapitel=' + encodeURIComponent(id) + (teil ? '&teil=' + encodeURIComponent(teil) : '');
  }

  /* Ort für Markierungen (js/markieren.js). Kapitel B hiess früher Teil B des
     Methodenüberblicks — der alte Ort bleibt, damit Markierungen dort bleiben. */
  function markOrt(meta, teil) {
    if (meta.id === 'methodenelemente') { return kapitelAdresse('methodenueberblick', 'B'); }
    return kapitelAdresse(meta.id, teil || meta.nummer || meta.id);
  }

  function cssId(id) {
    if (global.CSS && typeof global.CSS.escape === 'function') { return global.CSS.escape(id); }
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function ankerId(a, index) {
    return a.nummer ? 'hb-' + a.nummer : 'hb-t' + index;
  }

  /* --- Persistenz ---------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('handbuch', { kapitel: zustand.kapitel });
  }

  function wiederherstellen() {
    var g = HT.store.lies('handbuch', null);
    if (g && typeof g === 'object') {
      if (kapitelMeta(g.kapitel)) { zustand.kapitel = g.kapitel; }
    }
  }

  /* --- PDF-Verweise -------------------------------------------------------- */

  var quelle = null;   // aus index.json: { pdf, online, ausgabe, ... }

  function pdfSeite(seite) {
    return quelle && quelle.pdf && seite ? quelle.pdf + '#page=' + seite : null;
  }

  /* «S. 50» — als Link auf die Seite im PDF, wenn das PDF bekannt ist. */
  function seiteElement(seite) {
    if (!seite) { return null; }
    var url = pdfSeite(seite);
    if (!url) { return h('span', { class: 'hb-seite', text: ' S. ' + seite }); }
    return h('a', {
      class: 'hb-seite', href: url, target: '_blank', rel: 'noopener',
      title: 'Seite ' + seite + ' im Referenzhandbuch (PDF, neuer Tab)'
    }, ' S. ' + seite);
  }

  /* --- Leiste unter der Kopfzeile ------------------------------------------ */

  /* Was die Seite ist und woher der Text kommt — die Karte hinter dem
     Info-Icon der Leiste (HT.app.unterleiste). Die Quelle steht in
     index.json; ist sie noch nicht geladen, fehlen Ausgabe und PDF-Link. */
  function infoInhalt() {
    var q = quelle || {};
    var links = [];
    if (q.pdf) {
      links.push(h('a', { class: 'hb-online', href: q.pdf, target: '_blank', rel: 'noopener', text: 'Referenzhandbuch (PDF) ↗' }));
    }
    links.push(h('a', { class: 'hb-online', href: q.online || 'https://www.hermes.admin.ch/de/projektmanagement.html', target: '_blank', rel: 'noopener', text: 'HERMES online ↗' }));
    return [
      h('p', { text: 'Das Referenzhandbuch Projektmanagement von HERMES als Text — Kapitel für Kapitel in seiner Gliederung, mit den Nummern und Seitenzahlen des PDF. Phasen, Szenarien, Module, Ergebnisse, Aufgaben und Rollen stehen als Karten an ihrer Stelle.' }),
      h('p', { text: 'Quelle ist das offizielle PDF von hermes.admin.ch' + (q.ausgabe ? ' (' + q.ausgabe + ')' : '')
        + '. Der Text ist daraus maschinell gelesen und 1:1 übernommen, ohne Verzeichnisse und Index; jede Seitenzahl öffnet die Seite im PDF. Massgebend ist die offizielle Fassung.' }),
      h('p', { text: 'In den Tabellen steht ein Kreuz des Handbuchs als Haken, und die Spalte der agilen Phase Umsetzung («U») ist '
        + 'dunkelgrau hinterlegt, damit klassisch und agil auf einen Blick auseinandergehen. Im Referenzhandbuch ist diese Spalte rot '
        + 'hinterlegt; Rot gehört hier den Haken.' }),
      h('p', {}, [
        'Bei Aufgaben und Ergebnissen stehen rechts in der Verweiszeile ihrer Karte fünf Punkte: die letzten fünf Versuche mit der '
          + 'zugehörigen Lernkarte im ',
        h('a', { href: '#/trainer?teil=lernkarten', text: 'Trainer' }),
        ' — grün «Gewusst», rot «Nochmals», der älteste links, leere Ringe für noch freie Plätze. Ein Klick darauf legt diese '
          + 'Lernkarte zuoberst auf den Stapel. Phasen, Szenarien, Module und Rollen haben keine Lernkarte; dort stehen keine Punkte.'
      ]),
      h('p', { text: 'Die Suche oben findet hier Elemente wie im Überblick und durchsucht den Text aller Kapitel, ohne Rücksicht auf Gross- und Kleinschreibung und Akzente. Passende Rollen, Aufgaben, Ergebnisse, Module, Phasen und Szenarien stehen in der Liste unter dem Feld; ein Klick führt zu ihrer Karte. Der Zähler nennt die Treffer im ganzen Handbuch, die Leiste die Zahl je Kapitel; Enter springt zum nächsten Treffer, Umschalt+Enter zum vorherigen, auch ins nächste Kapitel. ⌘F bzw. Strg+F öffnet die Suche, das × im Feld oder Escape leert sie.' }),
      h('p', { class: 'hb-verweis' }, links)
    ];
  }

  /* --- Karten -------------------------------------------------------------- */

  function graphLink(e) {
    return h('a', {
      class: 'btn btn--klein btn--graph',
      href: '#/ueberblick?sicht=graph&id=' + encodeURIComponent(e.id),
      title: e.kategorie === 'phase' || e.kategorie === 'modul' || e.kategorie === 'szenario'
        ? 'Aufgaben, Ergebnisse und Rollen dazu im Graph zeigen'
        : 'Zusammenhänge dieses Elements im Graph anzeigen'
    }, [h('span', { 'aria-hidden': 'true', text: '◎ ' }), 'Im Graph']);
  }

  /* Karte eines Elements mit dem Text seines Abschnitts im PDF. Rechts in der
     Verweiszeile der Lernstand: die fünf Punkte der Lernkarte dieses Elements
     (js/lernkarten.js). Sie stehen bei den 71 Aufgaben und 108 Ergebnissen,
     die eine Karte haben — Phasen, Szenarien, Module und Rollen haben keine,
     ebenso die Sammelkarten «Checklisten» und «Meilensteine». */
  function karte(e, a) {
    return HT.karte.bauen(e, {
      nurHandbuch: true,
      lernstand: true,
      bloecke: a.bloecke || [],
      zusatz: graphLink(e),
      titelEbene: a.ebene <= 3 ? 'h3' : 'h4',
      nummer: a.nummer || null,
      seite: a.seite || null,
      pdf: quelle && quelle.pdf ? { url: quelle.pdf, seite: a.seite } : null
    });
  }

  /* --- Kapiteltext in Handbuchgliederung ------------------------------------ */

  /* Titelzeile: links Nummer und Titel, rechtsbündig — hat der Abschnitt
     eine eigene Online-Seite — «HERMES online» und «PDF», dann ganz rechts
     die Seitenzahl. */
  function titelKinder(a) {
    return [
      h('span', { class: 'hb-titel__name' }, [
        a.nummer ? h('span', { class: 'hb-nr', text: a.nummer + ' ' }) : null,
        a.titel
      ]),
      titelRechts(a)
    ];
  }

  function titelRechts(a) {
    var teile = (a.url ? verweisLinks(a) : []).concat([seiteElement(a.seite)]).filter(Boolean);
    return teile.length ? h('span', { class: 'hb-titel__rechts' }, teile) : null;
  }

  function verweisZeile(a, mitKapitel) {
    var teile = [];
    if (mitKapitel) {
      teile.push(h('span', { text: 'Referenzhandbuch' + (a.nummer ? ' Kap. ' + a.nummer : '') + (a.seite ? ', S. ' + a.seite : '') }));
    }
    teile = teile.concat(verweisLinks(a));
    if (!teile.length) { return null; }
    return h('p', { class: 'hb-verweis' }, teile);
  }

  function verweisLinks(a) {
    var teile = [];
    if (a.url) {
      teile.push(h('a', {
        href: a.url, target: '_blank', rel: 'noopener', class: 'hb-online',
        'aria-label': 'Diesen Abschnitt auf HERMES online öffnen (neuer Tab)'
      }, 'HERMES online ↗'));
    }
    var pdf = pdfSeite(a.seite);
    if (pdf) {
      teile.push(h('a', {
        href: pdf, target: '_blank', rel: 'noopener', class: 'hb-online hb-pdf',
        'aria-label': 'Seite ' + a.seite + ' im Referenzhandbuch als PDF öffnen (neuer Tab)'
      }, 'PDF ↗'));
    }
    return teile;
  }

  /* Ein Abschnitt: Titel seiner Ebene und seine Blöcke — oder die Karte, wenn
     er ein Element beschreibt. */
  function abschnittElement(a, index, meta) {
    var e = a.element ? HT.daten.eintragMitId(a.element) : null;
    if (e) {
      return h('div', { class: 'eintraege hb-karten hb-karten--einzeln', id: ankerId(a, index) }, karte(e, a));
    }
    var ebene = Math.min(6, Math.max(2, a.ebene || 2));
    var kinder = [];
    if (a.ebene === 1) {
      /* Kapiteltitel steht im Kapitelkopf; weitere Ebene-1-Titel (Impressum,
         Prolog) als Teiltitel. */
      if (index > 0 || !meta.nummer && a.titel !== meta.titel) {
        kinder.push(h('h2', { class: 'hb-teil__titel', id: ankerId(a, index) }, titelKinder(a)));
      }
    } else {
      kinder.push(h('h' + ebene, { class: 'hb-titel hb-titel--' + ebene, id: ankerId(a, index) }, titelKinder(a)));
    }
    if (a.bloecke && a.bloecke.length) {
      kinder.push(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: ebene + 1, seite: a.seite, pdf: quelle && quelle.pdf }));
    }
    return h('section', { class: 'hb-abschnitt' + (a.ebene === 1 && index > 0 ? ' hb-abschnitt--teil' : '') }, kinder);
  }

  /* Der Kapiteltext als ein Ort für Markierungen; Abschnitte mit eigener
     Online-Seite (7.4.1 Governance …) sind eigene Orte — wie bisher. */
  function kapitelKoerper(kap, meta) {
    var wurzel = h('section', { class: 'hb-teil', id: 'teil-' + (meta.nummer || meta.id), dataset: { markOrt: markOrt(meta) } });
    var ziel = wurzel;
    var abschnitte = kap.abschnitte || [];
    var offenEbene = 0;
    abschnitte.forEach(function (a, i) {
      if (ziel !== wurzel && (a.ebene || 2) <= offenEbene) { ziel = wurzel; offenEbene = 0; }
      var el = abschnittElement(a, i, meta);
      if (a.url && a.nummer && (a.ebene || 2) >= 2 && !a.element && meta.id === 'hinweise') {
        var teil = h('section', { class: 'hb-teil hb-teil--innen', id: 'teil-' + a.nummer, dataset: { markOrt: markOrt(meta, a.nummer) } }, el);
        wurzel.appendChild(teil);
        ziel = teil;
        offenEbene = a.ebene || 2;
        return;
      }
      ziel.appendChild(el);
    });
    return wurzel;
  }

  /* Sprung zu einem Teil oder Eintrag: sofort, nicht weich. Weich rollt
     Chrome mit begrenztem Tempo über oft Zehntausende Pixel, und jede
     Berührung von Trackpad oder Rad bricht das ab — der Eintrag blieb dann
     am unteren Rand stehen. Lädt die Schrift erst danach, verschiebt sich
     der Text; dann einmal nachrücken, solange niemand gerollt hat. */
  function springen(ziel) {
    try { ziel.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (e) { ziel.scrollIntoView(); }
    if (!document.fonts || document.fonts.status === 'loaded') { return; }
    var y = global.pageYOffset;
    document.fonts.ready.then(function () {
      if (global.pageYOffset === y && document.body.contains(ziel)) {
        try { ziel.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (e) { ziel.scrollIntoView(); }
      }
    });
  }

  /* Inhaltsverzeichnis des Kapitels: Ebene 2 und 3 (auch Sammelkarten wie
     4.4.2 Checklisten), bei
     mehreren Ebene-1-Teilen (Vorwort, Impressum, Prolog) auch diese — als
     Knöpfe, weil «#…»-Links die Route wechseln würden. */
  function inhaltsverzeichnis(kap, indexEintrag) {
    var eintraege = [];
    var ebene1 = (kap.abschnitte || []).filter(function (a) { return a.ebene === 1; }).length;
    (kap.abschnitte || []).forEach(function (a, i) {
      if (a.ebene === 1 && ebene1 > 1 && i > 0) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: 1 }); }
      if (a.ebene === 2 || a.ebene === 3) { eintraege.push({ ziel: ankerId(a, i), nummer: a.nummer, titel: a.titel, ebene: a.ebene }); }
    });
    if (!eintraege.length) { return null; }
    return h('nav', { class: 'hb-inhalt', 'aria-label': 'Inhalt des Kapitels' }, [
      h('span', { class: 'detail__label', text: 'Inhalt' }),
      h('ul', { class: 'hb-inhalt__liste' }, eintraege.map(function (x) {
        return h('li', { class: 'hb-inhalt__eintrag hb-inhalt__eintrag--' + x.ebene }, h('button', {
          type: 'button', class: 'hb-inhalt__knopf',
          on: { click: function () {
            var ziel = document.getElementById(x.ziel);
            if (ziel) { springen(ziel); }
          } }
        }, [x.nummer ? h('span', { class: 'hb-nr', text: x.nummer + ' ' }) : null, x.titel]));
      }))
    ]);
  }

  /* --- Suche im Handbuch -------------------------------------------------- */

  /* Die Suche der Kopfzeile sucht hier im Text wie Word: sie zählt die
     Treffer im ganzen Handbuch («3/42»), hebt sie im Kapitel hervor, und
     Enter, Umschalt+Enter oder die Pfeile springen von Treffer zu Treffer —
     über Kapitelgrenzen hinweg. Die Zahl je Kapitel steht klein an seinem
     Link in der Leiste.
     Gesucht wird im Text, den die Seite zeigt: Titel mit Nummer, Absätze,
     Listen, Tabellen, Bildunterschriften, die Titel der Karten — nicht in
     Seitenzahlen, Verweisen, Faktenzeilen und Marken. Die anderen Kapitel
     werden dafür einmal mit denselben Funktionen ungesehen aufgebaut
     (kapitelKoerper), damit ihre Zahl genau zu dem passt, was nach dem
     Sprung dort steht. Gross/klein und Akzente zählen nicht («qualitat»
     findet «Qualität»). Hervorgehoben wird mit der CSS Custom Highlight API —
     ohne den Text anzufassen, in dem js/markieren.js seine Markierungen
     legt. */

  var AUSGENOMMEN = '.hb-seite, .hb-seitenmarke, .hb-verweis, .hb-titel__rechts, .eintrag__fuss, .badge, .fakten, .nur-sr, [aria-hidden="true"], [hidden]';
  var BLOCK = 'p, li, td, th, caption, figcaption, h1, h2, h3, h4, h5, h6';
  var FALTUNG = {
    'ä': 'a', 'à': 'a', 'á': 'a', 'â': 'a', 'ö': 'o', 'ô': 'o', 'ó': 'o', 'ü': 'u', 'ù': 'u', 'ú': 'u', 'û': 'u',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'ç': 'c',
    '‐': '-', '‑': '-', '–': '-', '—': '-', '’': "'", '‘': "'"
  };
  var FALT_MUSTER = /[\säàáâöôóüùúûéèêëîïç‐‑–—’‘]/g;

  /* Klein, ohne Akzente, jeder Leerraum ein Leerzeichen — Zeichen für
     Zeichen, damit Positionen im gefalteten Text die im Original sind. */
  function falten(text) {
    var klein = text.toLowerCase();
    if (klein.length !== text.length) {
      klein = '';
      for (var i = 0; i < text.length; i++) {
        var k = text.charAt(i).toLowerCase();
        klein += k.length === 1 ? k : text.charAt(i);
      }
    }
    return klein.replace(FALT_MUSTER, function (c) { return FALTUNG[c] || ' '; });
  }

  /* Der durchsuchbare Text unter wurzel als Blöcke (Absatz, Listenpunkt,
     Zelle, Titel): ein Treffer läuft über Links und Markierungen hinweg,
     aber nicht von einem Absatz in den nächsten. */
  function textModell(wurzel) {
    var bloecke = [];
    var gang = document.createTreeWalker(wurzel, global.NodeFilter.SHOW_TEXT, null, false);
    var n, block = null, blockEl = null;
    while ((n = gang.nextNode())) {
      var el = n.parentNode;
      if (!n.data || !el || el.closest(AUSGENOMMEN)) { continue; }
      var be = el.closest(BLOCK);
      if (!be || !wurzel.contains(be)) { be = wurzel; }
      if (be !== blockEl) { block = { text: '', stellen: [] }; bloecke.push(block); blockEl = be; }
      block.stellen.push({ knoten: n, start: block.text.length });
      block.text += falten(n.data);
    }
    return bloecke;
  }

  /* Fundstellen als [block, start] in Dokumentreihenfolge, ohne Überlappung. */
  function fundstellen(texte, abfrage) {
    var liste = [];
    texte.forEach(function (t, b) {
      var i = t.indexOf(abfrage);
      while (i !== -1) { liste.push([b, i]); i = t.indexOf(abfrage, i + abfrage.length); }
    });
    return liste;
  }

  function stelleImText(block, pos, ende) {
    var s = block.stellen;
    for (var i = s.length - 1; i >= 0; i--) {
      if (ende ? s[i].start < pos : s[i].start <= pos) { return { knoten: s[i].knoten, offset: pos - s[i].start }; }
    }
    return null;
  }

  function bereich(modell, fund, laenge) {
    var block = modell[fund[0]];
    var a = stelleImText(block, fund[1], false), b = stelleImText(block, fund[1] + laenge, true);
    if (!a || !b) { return null; }
    var r = document.createRange();
    r.setStart(a.knoten, a.offset);
    r.setEnd(b.knoten, b.offset);
    return r;
  }

  var suche = {
    api: null,          // Verbindung zur Suchpille (HT.app.suchmodus)
    abfrage: '',        // gefaltet; leer = keine Suche
    zahlen: null,       // Kapitel-Id -> Trefferzahl, null solange gezählt wird
    version: 0,         // verwirft Antworten auf überholte Abfragen
    bereit: Promise.resolve(),
    live: null,         // { meta, wurzel, modell, funde, bereiche, beobachter }
    aktuell: -1,        // Index in live.funde
    ziel: null          // { kapitel, letzter } — Sprung in ein anderes Kapitel
  };
  var texteCache = {};  // Kapitel-Id -> Promise der gefalteten Blocktexte

  function kapitelTexte(meta) {
    if (!texteCache[meta.id]) {
      texteCache[meta.id] = HT.daten.rhbKapitel(meta.id).then(function (kap) {
        if (!kap) { return []; }
        return textModell(kapitelKoerper(kap, meta)).map(function (b) { return b.text; });
      });
    }
    return texteCache[meta.id];
  }

  function hervorhebungMoeglich() {
    return !!(global.CSS && global.CSS.highlights && typeof global.Highlight === 'function');
  }

  function malen() {
    if (!hervorhebungMoeglich()) { return; }
    var live = suche.live;
    var bereiche = live && suche.abfrage ? live.bereiche.filter(Boolean) : [];
    if (!bereiche.length) {
      global.CSS.highlights.delete('hb-treffer');
      global.CSS.highlights.delete('hb-treffer-aktuell');
      return;
    }
    var alle = new global.Highlight();
    bereiche.forEach(function (x) { alle.add(x); });
    global.CSS.highlights.set('hb-treffer', alle);
    var r = suche.aktuell >= 0 ? live.bereiche[suche.aktuell] : null;
    if (r) {
      var aktuell = new global.Highlight(r);
      aktuell.priority = 1;
      global.CSS.highlights.set('hb-treffer-aktuell', aktuell);
    } else {
      global.CSS.highlights.delete('hb-treffer-aktuell');
    }
  }

  function gesamt() {
    if (!suche.zahlen) { return 0; }
    return KAPITEL.reduce(function (s, k) { return s + (suche.zahlen[k.id] || 0); }, 0);
  }

  function standMelden() {
    if (!suche.api) { return; }
    if (!suche.abfrage) { suche.api.stand(null); return; }
    if (!suche.zahlen) { suche.api.stand({ laedt: true }); return; }
    var nr = 0;
    if (suche.live && suche.aktuell >= 0) {
      for (var i = 0; i < KAPITEL.length && KAPITEL[i] !== suche.live.meta; i++) { nr += suche.zahlen[KAPITEL[i].id] || 0; }
      nr += suche.aktuell + 1;
    }
    suche.api.stand({ aktuell: nr, gesamt: gesamt() });
  }

  /* Die Zahl je Kapitel klein an seinem Link in der Leiste. */
  function leisteZahlen() {
    var links = document.querySelectorAll('[data-kopf="unterleiste"] .unterleiste__link');
    for (var i = 0; i < links.length; i++) {
      var alt = links[i].querySelector('.unterleiste__treffer');
      if (alt) { alt.parentNode.removeChild(alt); }
      var k = KAPITEL[i];
      var n = k && suche.abfrage && suche.zahlen ? suche.zahlen[k.id] || 0 : 0;
      if (n) {
        links[i].appendChild(h('span', { class: 'unterleiste__treffer', title: n + ' Treffer in diesem Kapitel', text: String(n) }));
      }
    }
  }

  /* Treffer im gezeigten Kapitel neu bestimmen — nach einer neuen Abfrage
     und immer, wenn sich dort DOM-Knoten ändern (Markierungen). Die
     Positionen im Text bleiben dabei gleich, also auch der aktuelle Treffer. */
  function liveBerechnen() {
    var live = suche.live;
    if (!live) { return; }
    live.modell = textModell(live.wurzel);
    live.funde = suche.abfrage ? fundstellen(live.modell.map(function (b) { return b.text; }), suche.abfrage) : [];
    live.bereiche = live.funde.map(function (f) { return bereich(live.modell, f, suche.abfrage.length); });
    if (suche.aktuell >= live.funde.length) { suche.aktuell = -1; }
    if (suche.zahlen) { suche.zahlen[live.meta.id] = live.funde.length; }
  }

  function kopfUnterkante() {
    var kopf = document.querySelector('.topbar');
    return kopf ? kopf.getBoundingClientRect().bottom : 0;
  }

  function sichtUnterkante() {
    var unten = document.querySelector('.nav-bottom');
    var r = unten && global.getComputedStyle(unten).display !== 'none' ? unten.getBoundingClientRect() : null;
    return r && r.height ? r.top : global.innerHeight;
  }

  /* Den aktuellen Treffer in die Mitte der Sicht holen, wenn er nicht schon
     sichtbar ist — auch in einer seitlich rollenden Tabelle. */
  function zeigen() {
    var r = suche.live && suche.aktuell >= 0 ? suche.live.bereiche[suche.aktuell] : null;
    if (!r) { return; }
    var start = r.startContainer.parentElement;
    var rollt = start && start.closest('.hb-tabelle-wrap');
    var rect = r.getBoundingClientRect();
    if (rollt) {
      var w = rollt.getBoundingClientRect();
      if (rect.left < w.left || rect.right > w.right) {
        rollt.scrollLeft += rect.left - w.left - (w.width - rect.width) / 2;
        rect = r.getBoundingClientRect();
      }
    }
    var oben = kopfUnterkante(), unten = sichtUnterkante();
    if (rect.top >= oben + 12 && rect.bottom <= unten - 12) { return; }
    /* Sofort, nicht weich (html rollt sonst smooth): Treffer liegen oft
       Bildschirme auseinander. */
    global.scrollTo({ top: global.pageYOffset + rect.top - (oben + (unten - oben) / 2) + rect.height / 2, behavior: 'instant' });
  }

  function waehlen(index) {
    suche.aktuell = index;
    malen();
    standMelden();
    zeigen();
  }

  /* Der erste Treffer ab einer Stelle: dem aktuellen Treffer, sonst der
     Oberkante der Sicht. -1, wenn danach im Kapitel keiner mehr kommt. */
  function ersterAb(vorher) {
    var live = suche.live;
    if (!live || !live.funde.length) { return -1; }
    var i;
    if (vorher) {
      for (i = 0; i < live.funde.length; i++) {
        var f = live.funde[i];
        if (f[0] > vorher[0] || (f[0] === vorher[0] && f[1] >= vorher[1])) { return i; }
      }
      return -1;
    }
    var oben = kopfUnterkante();
    for (i = 0; i < live.bereiche.length; i++) {
      var r = live.bereiche[i];
      if (r && r.getBoundingClientRect().bottom > oben) { return i; }
    }
    return -1;
  }

  function letzterVor() {
    var live = suche.live;
    if (!live) { return -1; }
    var oben = kopfUnterkante();
    for (var i = live.bereiche.length - 1; i >= 0; i--) {
      var r = live.bereiche[i];
      if (r && r.getBoundingClientRect().top < oben) { return i; }
    }
    return -1;
  }

  /* Zum nächsten Kapitel mit Treffern — ringsum; ist es dasselbe, springt
     die Suche an seinen Anfang bzw. sein Ende. */
  function kapitelWechsel(richtung) {
    var meta = suche.live ? suche.live.meta : kapitelMeta(zustand.kapitel);
    var start = KAPITEL.indexOf(meta);
    for (var s = 1; s <= KAPITEL.length; s++) {
      var k = KAPITEL[((start + richtung * s) % KAPITEL.length + KAPITEL.length) % KAPITEL.length];
      if (!(suche.zahlen[k.id] > 0)) { continue; }
      if (suche.live && k === suche.live.meta) {
        waehlen(richtung > 0 ? 0 : suche.live.funde.length - 1);
        return;
      }
      suche.ziel = { kapitel: k.id, letzter: richtung < 0 };
      global.location.hash = kapitelAdresse(k.id);
      return;
    }
  }

  function schrittJetzt(richtung) {
    if (!suche.abfrage || !suche.zahlen || !gesamt()) { return; }
    var live = suche.live;
    if (!live) { return; }                                   // Kapitel lädt noch
    var neu;
    if (suche.aktuell >= 0) {
      neu = suche.aktuell + richtung;
      if (neu >= live.funde.length) { neu = -1; }
    } else {
      neu = richtung > 0 ? ersterAb(null) : letzterVor();
    }
    if (neu >= 0) { waehlen(neu); } else { kapitelWechsel(richtung); }
  }

  function eingabe(text, weiter) {
    var abfrage = falten(text).replace(/ +/g, ' ').trim();
    if (abfrage.length < 2) { abfrage = ''; }
    if (abfrage === suche.abfrage) {
      if (weiter) { suche.bereit.then(function () { schrittJetzt(1); }); }
      return;
    }
    var vorher = suche.live && suche.aktuell >= 0 ? suche.live.funde[suche.aktuell] : null;
    var version = ++suche.version;
    suche.abfrage = abfrage;
    suche.zahlen = null;
    suche.aktuell = -1;
    suche.ziel = null;
    if (!abfrage) {
      suche.zahlen = null;
      if (suche.live) { liveBerechnen(); }
      malen();
      standMelden();
      leisteZahlen();
      return;
    }
    standMelden();
    suche.bereit = Promise.all(KAPITEL.map(kapitelTexte)).then(function (alle) {
      if (version !== suche.version) { return; }
      var zahlen = {};
      KAPITEL.forEach(function (k, i) { zahlen[k.id] = fundstellen(alle[i], abfrage).length; });
      suche.zahlen = zahlen;
      liveBerechnen();
      /* Wie Word beim Tippen: der erste Treffer ab der Lesestelle im
         gezeigten Kapitel. In ein anderes Kapitel springt erst Enter. */
      var i = ersterAb(vorher);
      if (i < 0 && suche.live && suche.live.funde.length && !weiter) { i = 0; }
      leisteZahlen();
      if (i >= 0) { waehlen(i); } else { malen(); standMelden(); if (weiter) { kapitelWechsel(1); } }
    });
  }

  /* Wie im Überblick findet die Suche auch die Elemente selbst; die Pille
     listet sie über den Stellen im Text. Gewählt führt eines zu seiner Karte
     im Handbuch — der Suchtext bleibt, seine Stellen bleiben markiert. */
  function elementWaehlen(e) {
    var adresse = '#/handbuch?id=' + encodeURIComponent(e.id);
    if (global.location.hash !== adresse) { global.location.hash = adresse; return; }
    var karte = document.getElementById('eintrag-' + e.id);
    if (!karte) { return; }
    var alt = document.querySelectorAll('.eintrag.ist-hervorgehoben');
    for (var i = 0; i < alt.length; i++) { alt[i].classList.remove('ist-hervorgehoben'); }
    karte.classList.add('ist-hervorgehoben');
    springen(karte);
  }

  var MODUS = {
    name: 'handbuch',
    platzhalter: 'Im Handbuch suchen',
    label: 'Element oder Text im Handbuch suchen — Enter springt zur nächsten Stelle im Text',
    eingabe: eingabe,
    wahl: elementWaehlen,
    /* Wer ins Feld klickt, will suchen: die Kapiteltexte schon laden. */
    vorbereiten: function () { KAPITEL.forEach(kapitelTexte); },
    schritt: function (richtung) { suche.bereit.then(function () { schrittJetzt(richtung); }); },
    beenden: function () {
      suche.version++;
      suche.abfrage = '';
      suche.zahlen = null;
      suche.aktuell = -1;
      suche.ziel = null;
      suche.api = null;
      liveLoesen();
      malen();
    }
  };

  function liveLoesen() {
    if (suche.live && suche.live.beobachter) { suche.live.beobachter.disconnect(); }
    suche.live = null;
    suche.aktuell = -1;
  }

  /* Ein Kapitel ist aufgebaut: seine Treffer bestimmen, bei einem Sprung
     hierher den Zieltreffer wählen. Rückgabe true, wenn die Suche die
     Scrollposition bestimmt. */
  function sucheImKapitel(meta, wurzel) {
    liveLoesen();
    var live = suche.live = { meta: meta, wurzel: wurzel, modell: [], funde: [], bereiche: [], beobachter: null };
    if (global.MutationObserver) {
      var timer = null;
      live.beobachter = new global.MutationObserver(function () {
        if (timer) { clearTimeout(timer); }
        timer = setTimeout(function () {
          if (suche.live !== live || !suche.abfrage) { return; }
          liveBerechnen();
          malen();
        }, 80);
      });
      live.beobachter.observe(wurzel, { childList: true, subtree: true, characterData: true });
    }
    if (!suche.abfrage) { malen(); return false; }
    var ziel = suche.ziel;
    suche.ziel = null;
    liveBerechnen();
    leisteZahlen();
    if (ziel && ziel.kapitel === meta.id && live.funde.length) {
      waehlen(ziel.letzter ? live.funde.length - 1 : 0);
      return true;
    }
    malen();
    standMelden();
    return false;
  }

  /* ⌘F / Strg+F öffnet im Handbuch diese Suche statt der des Browsers, die
     nur das gezeigte Kapitel kennt; ⌘G / F3 springen weiter. */
  document.addEventListener('keydown', function (ev) {
    if (!suche.api || document.body.dataset.route !== 'handbuch') { return; }
    var taste = String(ev.key || '').toLowerCase();
    var mod = (ev.metaKey || ev.ctrlKey) && !ev.altKey;
    if (mod && taste === 'f' && !ev.shiftKey) {
      ev.preventDefault();
      suche.api.fokus();
    } else if ((mod && taste === 'g') || ev.key === 'F3') {
      if (!suche.abfrage) { return; }
      ev.preventDefault();
      MODUS.schritt(ev.shiftKey ? -1 : 1);
    }
  });

  /* --- Kapitelseite ------------------------------------------------------- */

  function renderKapitel(behaelter, meta, params, zielId) {
    var index = KAPITEL.indexOf(meta);
    var vorher = index > 0 ? KAPITEL[index - 1] : null;
    var nachher = index < KAPITEL.length - 1 ? KAPITEL[index + 1] : null;

    /* Kein Seitenkopf: die Kapitel stehen in der Leiste unter der Kopfzeile,
       was die Seite ist, sagt ihr Info-Icon. */
    behaelter.appendChild(h('h1', { class: 'nur-sr', text: 'Handbuch' }));
    HT.app.unterleiste({
      label: 'Kapitel des Handbuchs',
      links: KAPITEL.map(function (k) { return { href: kapitelAdresse(k.id), nr: k.nummer, text: k.titel, aktiv: k === meta }; }),
      info: { inhalt: infoInhalt, bereit: HT.daten.rhbIndex().then(function (idx) { if (idx && idx.quelle) { quelle = idx.quelle; } }) }
    });
    leisteZahlen();
    liveLoesen();
    malen();
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    /* Kapitelkopf und Text liegen auf einem weissen Blatt, zentriert und
       etwas breiter als die breiteste Abbildung (siehe .hb-blatt). */
    var blatt = h('div', { class: 'hb-blatt' });
    behaelter.appendChild(blatt);

    var kopfTitel = h('h2', { class: 'hb-kapitelkopf__titel' }, h('span', { class: 'hb-titel__name', text: meta.titel }));
    var kopf = h('div', { class: 'hb-kapitelkopf' }, [
      h('span', { class: 'detail__label', text: meta.nummer ? 'Kapitel ' + meta.nummer : 'Referenzhandbuch' }),
      kopfTitel
    ]);
    blatt.appendChild(kopf);

    var inhalt = h('div', { class: 'kapitel' });
    blatt.appendChild(inhalt);
    inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    Promise.all([HT.daten.rhbIndex(), HT.daten.rhbKapitel(meta.id)]).then(function (res) {
      if (!document.body.contains(inhalt)) { return; }   // inzwischen weitergeblättert
      var idx = res[0], kap = res[1];
      quelle = idx && idx.quelle ? idx.quelle : quelle;
      HT.ui.leeren(inhalt);

      if (!kap) {
        inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/rhb/' + meta.id + '.json konnte nicht geladen werden.'));
        return;
      }

      var rechts = titelRechts({ seite: kap.seite, url: kap.url });
      if (rechts) { kopfTitel.appendChild(rechts); }

      var toc = inhaltsverzeichnis(kap, idx);
      if (toc) { inhalt.appendChild(toc); }
      var koerper = kapitelKoerper(kap, meta);
      inhalt.appendChild(koerper);

      /* Blättern */
      function blaetterText(k, pfeil) {
        var t = (k.nummer ? 'Kapitel ' + k.nummer + ' ' : '') + k.titel;
        return pfeil === 'links' ? '← ' + t : t + ' →';
      }
      inhalt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: blaetterText(vorher, 'links') }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: blaetterText(nachher, 'rechts') }) : null
      ]));

      /* Erst nach dem Einfügen scrollen — sonst verschiebt der nachgeladene
         Inhalt die Position wieder. */
      var gewuenscht = params && params.teil ? String(params.teil) : null;
      global.setTimeout(function () {
        if (!document.body.contains(koerper)) { return; }
        if (sucheImKapitel(meta, koerper)) { return; }   // die Suche zeigt ihren Treffer
        var ziel = null;
        if (zielId) {
          ziel = inhalt.querySelector('#eintrag-' + cssId(zielId));
          if (ziel) { ziel.classList.add('ist-hervorgehoben'); }
        } else if (gewuenscht) {
          ziel = inhalt.querySelector('#hb-' + cssId(gewuenscht)) || inhalt.querySelector('#teil-' + cssId(gewuenscht));
        }
        if (ziel) {
          springen(ziel);
        } else {
          try { global.scrollTo(0, 0); } catch (e2) { /* egal */ }
        }
      }, 0);
    });
  }

  /* --- Render ------------------------------------------------------------- */

  /* Adressen: ?kapitel=<id>[&teil=<nr>] · ?id=<element> (Karte im Kapitel
     seiner Kategorie) · ?kat=<kategorie> · ohne Parameter das zuletzt
     gelesene Kapitel. Alte Adressen (#/methode, #/lexikon) leiten hierher. */
  function zielVon(params) {
    var meta = null, zielId = null;
    if (params.kapitel) { meta = kapitelMeta(params.kapitel); }
    if (meta && meta.id === 'methodenueberblick' && params.teil && /^B(\.|$)/.test(String(params.teil))) {
      meta = kapitelMeta('methodenelemente');   // alter Teil B des Methodenüberblicks
    }
    if (!meta && params.id) {
      var e = HT.daten.eintragMitId(params.id);
      if (e) {
        meta = kapitelDerKategorie(e.kategorie);
        zielId = e.id;
      }
    }
    if (!meta && params.kat) { meta = kapitelDerKategorie(params.kat); }
    return { meta: meta, zielId: zielId };
  }

  function render(behaelter, params) {
    if (!zustand.initialisiert) { wiederherstellen(); zustand.initialisiert = true; }
    params = params || {};
    var ziel = zielVon(params);
    var meta = ziel.meta || kapitelMeta(zustand.kapitel) || KAPITEL[1];
    zustand.kapitel = meta.id;
    speichern();
    suche.api = HT.app.suchmodus(MODUS);
    renderKapitel(behaelter, meta, params, ziel.zielId);
  }

  /* --- Handbuch im Fenster ------------------------------------------------- */

  /* Zum Nachschlagen, ohne die Seite zu verlassen (seit 2026-09-23 im
     Lernpfad): das Kapitel als modaler Dialog über der Seite, gerollt an den
     Abschnitt oder die Karte. Die Adressen sind die der Seite
     (#/handbuch?kapitel=…&teil=… oder ?id=…); Links dieser Art öffnen im
     Fenster, andere Links in die App schliessen es und gehen dorthin. Die
     Suche und die Leiste der Seite gibt es hier nicht; «Als Seite öffnen»
     führt ins Handbuch. Gemerkt wird nichts — das Handbuch öffnet danach
     weiter beim zuletzt dort gelesenen Kapitel. */

  var fenster = null;   // { dialog, titel, marke, seite, inhalt }

  function adresseLesen(href) {
    var params = {};
    var roh = String(href || '').split('?')[1] || '';
    roh.split('&').forEach(function (paar) {
      var kv = paar.split('=');
      if (!kv[0]) { return; }
      try { params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); } catch (e) { /* ungültig */ }
    });
    return params;
  }

  function fensterBauen() {
    var titel = h('h1', { class: 'hb-fenster__titel', id: 'hb-fenster-titel' });
    var marke = h('span', { class: 'detail__label' });
    var seite = h('a', {
      class: 'btn btn--klein hb-fenster__seite', href: '#/handbuch', dataset: { seite: '1' },
      title: 'Diese Stelle auf der Seite «Handbuch» öffnen (verlässt die aktuelle Seite)', text: 'Als Seite öffnen'
    });
    var inhalt = h('div', { class: 'hb-fenster__inhalt', tabindex: '-1' });
    var dialog = h('dialog', { class: 'hb-fenster', 'aria-labelledby': 'hb-fenster-titel' }, [
      h('div', { class: 'hb-fenster__kopf' }, [
        h('div', { class: 'hb-fenster__name' }, [marke, titel]),
        seite,
        h('button', { type: 'button', class: 'graph-schliessen', 'aria-label': 'Schliessen (Esc)', title: 'Schliessen (Esc)', text: '✕', on: { click: function () { dialog.close(); } } })
      ]),
      inhalt
    ]);

    function draussen(ev) {
      var r = dialog.getBoundingClientRect();
      return ev.target === dialog && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom);
    }
    /* Klick daneben schliesst, wenn er dort auch begann (wie Willkommen). */
    var vonDraussen = false;
    dialog.addEventListener('pointerdown', function (ev) { vonDraussen = draussen(ev); });
    dialog.addEventListener('click', function (ev) {
      if (vonDraussen && draussen(ev)) { dialog.close(); return; }
      var a = ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) { return; }
      var href = a.getAttribute('href');
      if (/^#\/handbuch(\?|$)/.test(href) && !a.dataset.seite) {
        ev.preventDefault();
        fensterZeigen(adresseLesen(href));
        return;
      }
      dialog.close();   // ein Link in die App: Fenster zu, dann dorthin
    });
    /* Tasten gehören dem Fenster: die Pfeile blätterten sonst die Folie
       dahinter um. */
    dialog.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    dialog.addEventListener('close', function () {
      /* Der Fokus geht zurück an den Knopf oder die Seite, die geöffnet hat. */
      var vorher = fenster.vorher;
      fenster.vorher = null;
      if (vorher && document.body.contains(vorher)) { try { vorher.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    });
    document.body.appendChild(dialog);
    /* Das Fenster liegt ausserhalb von #view: Markierungen dort anmelden. */
    if (HT.markieren && HT.markieren.beobachten) { HT.markieren.beobachten(inhalt); }
    return { dialog: dialog, titel: titel, marke: marke, seite: seite, inhalt: inhalt, version: 0, vorher: null };
  }

  function fensterZeigen(params) {
    var ziel = zielVon(params);
    var meta = ziel.meta || kapitelMeta(zustand.kapitel) || KAPITEL[1];
    var f = fenster;
    var version = ++f.version;
    f.marke.textContent = meta.nummer ? 'Handbuch · Kapitel ' + meta.nummer : 'Handbuch';
    f.titel.textContent = meta.titel;
    f.seite.setAttribute('href', ziel.zielId ? '#/handbuch?id=' + encodeURIComponent(ziel.zielId)
      : kapitelAdresse(meta.id, params.teil || null));
    HT.ui.leeren(f.inhalt);
    f.inhalt.appendChild(h('p', { class: 'trefferzahl', role: 'status', text: 'Kapitel wird geladen …' }));

    Promise.all([HT.daten.rhbIndex(), HT.daten.rhbKapitel(meta.id)]).then(function (res) {
      if (version !== f.version) { return; }
      var idx = res[0], kap = res[1];
      quelle = idx && idx.quelle ? idx.quelle : quelle;
      HT.ui.leeren(f.inhalt);
      if (!kap) {
        f.inhalt.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar', 'Die Datei data/handbuch/rhb/' + meta.id + '.json konnte nicht geladen werden.'));
        return;
      }
      var blatt = h('div', { class: 'hb-blatt' });
      var verweis = verweisZeile({ nummer: meta.nummer || null, seite: kap.seite, url: kap.url }, true);
      if (verweis) { blatt.appendChild(h('div', { class: 'hb-kapitelkopf' }, verweis)); }
      var toc = inhaltsverzeichnis(kap, idx);
      if (toc) { blatt.appendChild(toc); }
      var koerper = kapitelKoerper(kap, meta);
      blatt.appendChild(koerper);
      var i = KAPITEL.indexOf(meta);
      var vorher = i > 0 ? KAPITEL[i - 1] : null, nachher = i < KAPITEL.length - 1 ? KAPITEL[i + 1] : null;
      blatt.appendChild(h('div', { class: 'btn-reihe kapitel-nav' }, [
        vorher ? h('a', { class: 'btn', href: kapitelAdresse(vorher.id), text: '← ' + (vorher.nummer ? 'Kapitel ' + vorher.nummer + ' ' : '') + vorher.titel }) : null,
        nachher ? h('a', { class: 'btn', href: kapitelAdresse(nachher.id), text: (nachher.nummer ? 'Kapitel ' + nachher.nummer + ' ' : '') + nachher.titel + ' →' }) : null
      ]));
      f.inhalt.appendChild(blatt);

      var sprungZiel = null;
      if (ziel.zielId) {
        sprungZiel = koerper.querySelector('#eintrag-' + cssId(ziel.zielId));
        if (sprungZiel) { sprungZiel.classList.add('ist-hervorgehoben'); }
      } else if (params.teil) {
        sprungZiel = koerper.querySelector('#hb-' + cssId(params.teil)) || koerper.querySelector('#teil-' + cssId(params.teil));
      }
      /* Abbildungen und Schrift, die danach laden, verschieben den Text:
         dann nachrücken, solange niemand gerollt hat. */
      var gesetzt = 0;
      function hinrollen(erst) {
        if (version !== f.version || (erst !== true && f.inhalt.scrollTop !== gesetzt)) { return; }
        f.inhalt.scrollTop = 0;
        if (sprungZiel) { f.inhalt.scrollTop = sprungZiel.getBoundingClientRect().top - f.inhalt.getBoundingClientRect().top - 12; }
        gesetzt = f.inhalt.scrollTop;
      }
      hinrollen(true);
      if (sprungZiel) {
        Array.prototype.forEach.call(blatt.querySelectorAll('img'), function (img) {
          if (!img.complete) { img.addEventListener('load', hinrollen); }
        });
        if (document.fonts && document.fonts.status !== 'loaded') { document.fonts.ready.then(hinrollen); }
      }
      try { f.inhalt.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    });
  }

  /**
   * Öffnet das Handbuch im Fenster. ziel: eine Adresse wie
   * '#/handbuch?kapitel=ergebnisse&teil=4.4.1' oder die Parameter als Objekt
   * ({ kapitel, teil } oder { id }).
   */
  function imFenster(ziel) {
    if (!global.HTMLDialogElement) { global.location.hash = typeof ziel === 'string' ? ziel : '#/handbuch'; return; }
    if (!fenster) { fenster = fensterBauen(); }
    var params = typeof ziel === 'string' ? adresseLesen(ziel) : (ziel || {});
    if (!fenster.dialog.open) {
      fenster.vorher = document.activeElement;
      fenster.dialog.showModal();
    }
    fensterZeigen(params);
  }

  HT.views.handbuch = { titel: 'Handbuch', render: render };
  /* --- Auszüge an anderen Stellen ------------------------------------------ */

  /* Markierungs-Ort eines Abschnitts, wie ihn die Kapitelseite vergibt
     (kapitelKoerper): eine Elementkarte ist ihr eigener Ort, ein Abschnitt
     der Hinweise mit eigener Online-Seite samt seinen Unterabschnitten
     ebenso, alles andere gehört zum Kapitel. Damit zeigen Auszüge im
     Lernpfad und auf den Lernkarten dieselben Markierungen wie das Handbuch. */
  function markOrtVon(kapitelId, kap, nummer) {
    var meta = kapitelMeta(kapitelId);
    if (!meta) { return null; }
    var teil = null, offenEbene = 0;
    var abschnitte = (kap && kap.abschnitte) || [];
    for (var i = 0; i < abschnitte.length; i++) {
      var a = abschnitte[i];
      if (teil && (a.ebene || 2) <= offenEbene) { teil = null; offenEbene = 0; }
      if (a.url && a.nummer && (a.ebene || 2) >= 2 && !a.element && meta.id === 'hinweise') { teil = a.nummer; offenEbene = a.ebene || 2; }
      if (a.nummer === nummer) {
        return a.element ? '#/handbuch?id=' + encodeURIComponent(a.element) : markOrt(meta, teil);
      }
    }
    return markOrt(meta);
  }

  /* Der Handbuchtext eines Elements, gezeichnet wie auf seiner Karte im
     Kapitel (gleiche Blöcke, gleiche Seitenmarken — sonst fänden die
     Markierungen ihr Zitat nicht wieder). Promise: Element oder null, wenn
     das Handbuch keinen eigenen Abschnitt dazu hat (Grundbegriffe). */
  function elementText(e) {
    var meta = e ? kapitelDerKategorie(e.kategorie) : null;
    if (!meta) { return Promise.resolve(null); }
    return Promise.all([HT.daten.rhbKapitel(meta.id), HT.daten.rhbIndex()]).then(function (r) {
      var kap = r[0], idx = r[1];
      var a = ((kap && kap.abschnitte) || []).filter(function (x) { return x.element === e.id; })[0];
      if (!a || !(a.bloecke || []).length) { return null; }
      var pdf = idx && idx.quelle && idx.quelle.pdf ? idx.quelle.pdf : null;
      return HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: 5, seite: a.seite || null, pdf: pdf });
    }).catch(function () { return null; });
  }

  HT.handbuch = { imFenster: imFenster, adresse: kapitelAdresse, markOrtVon: markOrtVon, elementText: elementText };
}(window));
