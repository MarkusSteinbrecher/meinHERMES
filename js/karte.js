/* meinHERMES — Elementkarte (gemeinsam für Handbuch und Überblick).
   Eine Karte zeigt einen Eintrag in drei Stufen: Kurz (erster Satz + Fakten),
   Kernpunkte (Definition, Querverweise) und
   Handbuch (vollständiger Text der offiziellen Dokumentation, nachgeladen).
   Die Inhalte kommen unverändert aus data/. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  var STUFEN = [
    { wert: 0, label: 'Kurz',       titel: 'Nur das Wichtigste: erster Satz und Fakten' },
    { wert: 1, label: 'Kernpunkte', titel: 'Definition und Querverweise' },
    { wert: 2, label: 'Handbuch',   titel: 'Vollständiger Text aus dem Referenzhandbuch' }
  ];

  /* Handbuch Kap. 3.2.1: Module, die zur Einhaltung der Projekt-Governance
     zwingend in jedem Projekt vorkommen. */
  var ZWINGENDE_MODULE = ['Projektsteuerung', 'Projektführung', 'Projektgrundlagen', 'Einführungsorganisation'];

  /* --- Querverweis: exakter Begriffs-String -> Link auf die Karte -------- */

  function zielVon(begriff, bevorzugteKategorie) {
    return HT.daten.eintragMitBegriff(begriff, bevorzugteKategorie)
      || HT.daten.eintragMitBegriff(begriff);
  }

  function verweis(begriff, bevorzugteKategorie, linkZiel) {
    var ziel = zielVon(begriff, bevorzugteKategorie);
    if (!ziel) {
      return h('span', { class: 'wert', text: begriff });
    }
    return h('a', {
      class: 'wert',
      href: linkZiel(ziel),
      title: ziel.begriff + ' anzeigen'
    }, begriff);
  }

  function werteBlock(label, werte, bevorzugteKategorie, linkZiel) {
    if (!werte || !werte.length) { return null; }
    return h('div', { class: 'detail__block' }, [
      h('span', { class: 'detail__label', text: label }),
      h('ul', { class: 'werteliste' }, werte.map(function (w) {
        return h('li', {}, verweis(String(w), bevorzugteKategorie, linkZiel));
      }))
    ]);
  }

  function textBlock(label, text, klasse) {
    if (!text) { return null; }
    return h('div', { class: 'detail__block' + (klasse ? ' ' + klasse : '') }, [
      h('span', { class: 'detail__label', text: label }),
      h('p', { class: 'detail__text', text: text })
    ]);
  }

  /* --- Stufe 0: Faktenzeile ------------------------------------------------ */

  function phasenStreifen(phasen) {
    if (!phasen || !phasen.length) { return null; }
    var aktiv = {};
    phasen.forEach(function (p) { aktiv[HT.daten.normalisieren(p)] = true; });
    var alle = HT.daten.phasenKurz;
    var kinder = alle.map(function (p) {
      var ist = !!aktiv[HT.daten.normalisieren(p[0])];
      return h('span', {
        class: 'phasenstreifen__feld' + (ist ? ' ist-aktiv' : ''),
        title: p[0] + (ist ? '' : ' (nicht betroffen)'),
        'aria-hidden': 'true',
        text: p[1]
      });
    });
    var namen = HT.daten.phasenSortiert(phasen).join(', ');
    return HT.ui.faktenChip('Phasen', [
      h('span', { class: 'phasenstreifen', role: 'img', 'aria-label': namen }, kinder)
    ]);
  }

  function eintragLink(ziel, text, linkZiel) {
    if (!ziel) { return document.createTextNode(text); }
    return h('a', { class: 'hb-link', href: linkZiel(ziel), title: ziel.begriff + ' anzeigen' }, text);
  }

  function rollenChip(label, name, linkZiel) {
    if (!name) { return null; }
    var ziel = HT.daten.eintragMitBegriff(name, 'rolle');
    return HT.ui.faktenChip(label, [ziel ? eintragLink(ziel, name, linkZiel) : document.createTextNode(name)]);
  }

  function listenChip(label, werte, kategorie, max, linkZiel) {
    if (!werte || !werte.length) { return null; }
    var kinder = [];
    werte.slice(0, max).forEach(function (w, i) {
      if (i) { kinder.push(document.createTextNode(', ')); }
      var ziel = HT.daten.eintragMitBegriff(w, kategorie);
      kinder.push(ziel ? eintragLink(ziel, w, linkZiel) : document.createTextNode(w));
    });
    if (werte.length > max) {
      kinder.push(document.createTextNode(' +' + (werte.length - max)));
    }
    return HT.ui.faktenChip(label, kinder);
  }

  function markerChip(text, titel) {
    return h('span', { class: 'fakt fakt--marker', title: titel || null, text: text });
  }

  function fakten(e, linkZiel) {
    var chips = [];
    var istZwingend = e.kategorie === 'modul' && ZWINGENDE_MODULE.indexOf(e.begriff) !== -1;

    if (e.kategorie === 'ergebnis') {
      if (e.typ) { chips.push(HT.ui.faktenChip('Typ', [document.createTextNode(e.typ)])); }
      if (e.minimalGefordert && e.typ === 'Dokument') {
        chips.push(markerChip('minimal gefordert', 'Minimal gefordertes Dokument (Tabelle 16 des Referenzhandbuchs)'));
      }
    }
    if (istZwingend) {
      chips.push(markerChip('zwingend in jedem Projekt', 'Eines der vier Module, die zur Einhaltung der Projekt-Governance zwingend vorkommen müssen'));
    }
    if (e.kategorie === 'rolle' && e.ebene) {
      chips.push(HT.ui.faktenChip('Hierarchieebene', [document.createTextNode(e.ebene)]));
    }
    if (e.verantwortlich && (e.kategorie === 'aufgabe' || e.kategorie === 'ergebnis')) {
      chips.push(rollenChip('Verantwortlich', e.verantwortlich, linkZiel));
    }
    if (e.kategorie === 'aufgabe' || e.kategorie === 'ergebnis') {
      chips.push(listenChip(e.module.length === 1 ? 'Modul' : 'Module', e.module, 'modul', 2, linkZiel));
    }
    if (e.kategorie !== 'phase') {
      chips.push(phasenStreifen(e.phasen));
    }
    if (e.kategorie === 'szenario') {
      chips.push(HT.ui.faktenChip('Module', [document.createTextNode(String(e.module.length))]));
    }
    if (e.kategorie === 'phase' && e.meilensteine.length) {
      chips.push(listenChip('Meilensteine', e.meilensteine.map(function (m) {
        return m.name.replace(/^Meilenstein\s+/i, '');
      }), 'ergebnis', 3, linkZiel));
    }

    var vorhanden = chips.filter(function (c) { return !!c; });
    if (!vorhanden.length) { return null; }
    return h('div', { class: 'fakten' }, vorhanden);
  }

  /* --- Stufe 1: Kernpunkte ------------------------------------------------- */

  function kernpunkte(e, linkZiel) {
    var bloecke = [];

    if (e.definition && e.definition !== e.kurz) {
      bloecke.push(textBlock('Definition', e.definition));
    }

    if (e.verantwortlich) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Verantwortlich' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, verweis(e.verantwortlich, 'rolle', linkZiel))])
      ]));
    }
    bloecke.push(werteBlock('Beteiligt', e.beteiligt, 'rolle', linkZiel));
    if (e.ebene && e.kategorie !== 'rolle') {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Ebene' }),
        h('ul', { class: 'werteliste' }, [h('li', {}, h('span', { class: 'wert', text: e.ebene }))])
      ]));
    }
    bloecke.push(werteBlock('Phasen', HT.daten.phasenSortiert(e.phasen), 'phase', linkZiel));
    bloecke.push(werteBlock('Module', e.module, 'modul', linkZiel));
    bloecke.push(werteBlock('Szenarien', e.szenarien, 'szenario', linkZiel));
    bloecke.push(werteBlock('Ergebnisse', e.ergebnisse, 'ergebnis', linkZiel));

    if (e.meilensteine && e.meilensteine.length) {
      bloecke.push(h('div', { class: 'detail__block' }, [
        h('span', { class: 'detail__label', text: 'Meilensteine' }),
        h('ul', { class: 'meilenstein-liste' }, e.meilensteine.map(function (m) {
          var ziel = HT.daten.eintragMitBegriff(m.name, 'ergebnis');
          return h('li', {}, [
            h('b', {}, ziel ? eintragLink(ziel, m.name, linkZiel) : document.createTextNode(m.name)),
            m.beschreibung ? h('span', { text: m.beschreibung }) : null
          ]);
        }))
      ]));
    }

    var vorhanden = bloecke.filter(function (b) { return !!b; });
    if (!vorhanden.length) {
      vorhanden.push(h('p', { class: 'detail__block detail__text', text: 'Keine weiteren Angaben hinterlegt.' }));
    }
    return vorhanden;
  }

  /* --- Stufe 2: Handbuchtext ---------------------------------------------- */

  var HINWEIS_TEILE = {
    'governance': '7.4.1', 'nachhaltigkeit': '7.4.2',
    'projektmanagement-und-entwicklungsmanagement': '7.4.3',
    'finanzielle-steuerung-und-fuehrung': '7.4.4', 'planung': '7.4.5',
    'realisierungseinheiten-bei-klassischer-vorgehensweise': '7.4.6',
    'anwendung-mit-anderen-methoden-und-praktiken': '7.4.7',
    'integration-von-hermes-in-die-stammorganisation': '7.4.8'
  };

  /* Rückgabe: Query-String für das Handbuch («kapitel=…[&teil=…]») oder null. */
  function kapitelAusUrl(url) {
    var m = /\/de\/projektmanagement\/([a-z-]+)(?:\/([a-z-]+))?/.exec(url || '');
    if (!m) { return null; }
    var teil = m[1];
    if (teil === 'hinweise-zur-anwendung') {
      var nr = m[2] ? HINWEIS_TEILE[m[2]] : null;
      return 'kapitel=hinweise' + (nr ? '&teil=' + encodeURIComponent(nr) : '');
    }
    if (['methodenueberblick', 'phasen', 'szenarien', 'module', 'ergebnisse', 'aufgaben', 'rollen'].indexOf(teil) !== -1) {
      return 'kapitel=' + teil;
    }
    return null;
  }

  /* Die kuratierten Details tragen Absätze mit Voranstellung wie
     «Grundidee:» — daraus werden beschriftete Blöcke. */
  function detailsAlsBloecke(text) {
    var absaetze = String(text || '').split(/\n\s*\n/);
    return absaetze.map(function (abs) {
      var t = abs.trim();
      if (!t) { return null; }
      var m = /^([A-ZÄÖÜ][^:\n]{2,60}):\s*([\s\S]*)$/.exec(t);
      if (m && m[2]) {
        return h('div', { class: 'detail__block' }, [
          h('span', { class: 'detail__label', text: m[1] }),
          h('p', { class: 'detail__text', text: m[2] })
        ]);
      }
      return h('p', { class: 'detail__text detail__block', text: t });
    }).filter(function (x) { return !!x; });
  }

  function handbuchFallback(e) {
    var kinder = [];
    if (e.details) {
      kinder.push(h('p', { class: 'hb-verweis', text: 'Ausführliche Beschreibung (kuratiert nach der offiziellen Dokumentation)' }));
      kinder = kinder.concat(detailsAlsBloecke(e.details));
    }
    var kap = kapitelAusUrl(e.quelle && e.quelle.url);
    if (kap) {
      kinder.push(h('p', { class: 'detail__block' }, h('a', {
        class: 'btn btn--klein',
        href: '#/handbuch?' + kap,
        text: 'Zum Handbuchkapitel'
      })));
    }
    if (HT.ui.quellenLink(e.quelle)) {
      kinder.push(h('p', { class: 'detail__block' }, HT.ui.quellenLink(e.quelle)));
    }
    if (!kinder.length) {
      kinder.push(h('p', { class: 'detail__text', text: 'Für diesen Eintrag liegt kein Handbuchtext vor.' }));
    }
    return kinder;
  }

  function handbuchFuellen(e, behaelter) {
    if (behaelter.dataset.geladen) { return; }
    behaelter.dataset.geladen = '1';
    HT.ui.leeren(behaelter);
    behaelter.appendChild(h('p', { class: 'trefferzahl', text: 'Handbuchtext wird geladen …' }));

    HT.daten.handbuchElement(e).then(function (text) {
      HT.ui.leeren(behaelter);
      if (!text) {
        handbuchFallback(e).forEach(function (k) { behaelter.appendChild(k); });
        return;
      }
      var verweisEl = HT.ui.handbuchVerweis(text, e.quelle);
      if (verweisEl) { behaelter.appendChild(verweisEl); }

      (text.abschnitte || []).forEach(function (a) {
        if (!a.bloecke || !a.bloecke.length) { return; }
        var abschnitt = h('section', { class: 'hb-abschnitt' });
        if (a.titel) { abschnitt.appendChild(h('h3', { class: 'hb-titel', text: a.titel })); }
        abschnitt.appendChild(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: 4, seite: a.seite, pdf: text.pdf || null }));
        behaelter.appendChild(abschnitt);
      });
    }).catch(function () {
      HT.ui.leeren(behaelter);
      handbuchFallback(e).forEach(function (k) { behaelter.appendChild(k); });
    });
  }

  /* --- Karte --------------------------------------------------------------- */

  function handbuchZiel(ziel) {
    return '#/handbuch?id=' + encodeURIComponent(ziel.id);
  }

  /**
   * Baut die Karte eines Eintrags.
   * optionen.stufe: Startstufe 0–2
   * optionen.beiStufe(id, stufe): Rückruf bei Umschalten
   * optionen.linkZiel(eintrag): Link-Ziel für Querverweise (Standard: Handbuch)
   * optionen.zusatz: zusätzliche Aktionen im Fuss (Array von Elementen)
   * optionen.ohneTitel: Kopf ohne h2 (wenn der Titel bereits darüber steht)
   * optionen.titelEbene: 'h2' | 'h3' | 'h4'
   * optionen.nummer, optionen.seite: Nummer und Seite im Referenzhandbuch, vor bzw. nach dem Titel
   * optionen.nurHandbuch: nur Titel, Fakten und der Handbuchtext — ohne Kurzfassung,
   *   Kernpunkte und Stufenwahl (Seite «Handbuch»)
   * optionen.bloecke: Handbuchtext als Blöcke (Seite «Handbuch», aus dem PDF) — dann
   *   wird nichts nachgeladen
   * optionen.pdf: { url, seite } — Link auf die Seite im Referenzhandbuch (PDF)
   * optionen.lernstand: rechts in der Verweiszeile die fünf Punkte der Lernkarte
   *   dieses Elements (js/lernkarten.js) — wo es keine Karte gibt, steht nichts
   */
  function bauen(e, optionen) {
    optionen = optionen || {};
    var linkZiel = optionen.linkZiel || handbuchZiel;

    var kern = h('div', { class: 'detail detail--kern', id: 'kern-' + e.id }, kernpunkte(e, linkZiel));
    var handbuch = h('div', { class: 'detail detail--handbuch', id: 'handbuch-' + e.id });
    if (optionen.bloecke) {
      handbuch.dataset.geladen = '1';
      handbuch.appendChild(HT.ui.bloecke(optionen.bloecke, { verlinken: true, ebene: 5, seite: optionen.seite || null, pdf: optionen.pdf && optionen.pdf.url ? optionen.pdf.url : null }));
    }
    var knoepfe = [];

    function anwenden(stufe) {
      kern.hidden = stufe < 1;
      handbuch.hidden = stufe < 2;
      knoepfe.forEach(function (b, i) {
        b.setAttribute('aria-pressed', i === stufe ? 'true' : 'false');
      });
      if (stufe >= 2) { handbuchFuellen(e, handbuch); }
    }

    STUFEN.forEach(function (s) {
      var b = h('button', {
        type: 'button', class: 'stufe', 'aria-pressed': 'false',
        title: s.titel, text: s.label,
        'aria-controls': 'kern-' + e.id + ' handbuch-' + e.id
      });
      b.addEventListener('click', function () {
        if (optionen.beiStufe) { optionen.beiStufe(e.id, s.wert); }
        anwenden(s.wert);
      });
      knoepfe.push(b);
    });

    var stufen = optionen.nurHandbuch ? null : h('div', { class: 'stufen', role: 'group', 'aria-label': 'Detailtiefe für ' + e.begriff }, knoepfe);
    var quelle = HT.ui.quellenLink(e.quelle);
    var pdf = optionen.pdf && optionen.pdf.url && optionen.pdf.seite ? optionen.pdf : null;
    var pdfLink = pdf ? h('a', {
      class: 'quelle-link quelle-link--pdf',
      href: pdf.url + '#page=' + pdf.seite,
      target: '_blank', rel: 'noopener',
      title: 'Seite ' + pdf.seite + ' im Referenzhandbuch (PDF)',
      'aria-label': 'Referenzhandbuch als PDF, Seite ' + pdf.seite + ' (öffnet in neuem Tab)'
    }, [h('span', { text: 'PDF S. ' + pdf.seite }), h('span', { class: 'quelle-link__pfeil', 'aria-hidden': 'true', text: '↗' })]) : null;
    var titelTag = optionen.titelEbene || 'h2';

    /* Ort für Markierungen (js/markieren.js): die Karte ist der Block, in
       dem sie verankert werden — im Handbuch wie im Überblick. */
    var artikel = h('article', {
      class: 'eintrag eintrag--' + e.kategorie,
      id: 'eintrag-' + e.id,
      dataset: { id: e.id, markOrt: '#/handbuch?id=' + encodeURIComponent(e.id) }
    }, [
      h('div', { class: 'eintrag__kopf' }, [
        optionen.ohneTitel ? null : h('div', { class: 'eintrag__titelzeile' }, [
          h(titelTag, { class: 'eintrag__titel' }, [
            optionen.nummer ? h('span', { class: 'hb-nr', text: optionen.nummer + ' ' }) : null,
            e.begriff,
            optionen.seite ? (pdf
              ? h('a', { class: 'hb-seite', href: pdf.url + '#page=' + optionen.seite, target: '_blank', rel: 'noopener', title: 'Seite ' + optionen.seite + ' im Referenzhandbuch (PDF, neuer Tab)' }, ' S. ' + optionen.seite)
              : h('span', { class: 'hb-seite', text: ' S. ' + optionen.seite })) : null
          ]),
          HT.ui.badge(e.kategorie)
        ]),
        optionen.nurHandbuch ? null : h('p', { class: 'eintrag__def', text: e.kurz || e.definition || 'Keine Definition hinterlegt.' }),
        fakten(e, linkZiel)
      ]),
      h('div', { class: 'eintrag__fuss' }, [
        stufen,
        quelle || h('span', { class: 'chip__zahl', text: 'Kein Quellenlink hinterlegt' }),
        pdfLink,
        optionen.zusatz || null,
        /* Ganz rechts der Lernstand — dieselbe Stelle wie am Fuss der
           Lernkarte selbst, wo die Punkte hinter den Verweisen stehen. */
        optionen.lernstand && HT.lernkarten && HT.lernkarten.marke ? HT.lernkarten.marke(e.id) : null
      ]),
      optionen.nurHandbuch ? null : kern,
      handbuch
    ]);

    anwenden(optionen.nurHandbuch ? 2 : (typeof optionen.stufe === 'number' ? optionen.stufe : 0));
    return artikel;
  }

  HT.karte = {
    STUFEN: STUFEN,
    ZWINGENDE_MODULE: ZWINGENDE_MODULE,
    bauen: bauen,
    fakten: fakten,
    kernpunkte: kernpunkte,
    kapitelAusUrl: kapitelAusUrl,
    handbuchZiel: handbuchZiel
  };
}(window));
