/* meinHERMES — Lernpfad (#/lernpfad), Entwurf vom 2026-09-21.

   Der Stoff des Referenzhandbuchs als Schulung: Blöcke aus Lektionen, jede
   Lektion mit Lernzielen, einer kurzen Einführung in eigenen Worten, der
   Leitabbildung, den geprüften Handbuchabschnitten zum Nachlesen und
   Verweisen zum Üben. Die Reihenfolge ist didaktisch, nicht die des
   Handbuchs.

   Die Seite ist absichtlich NICHT in ROUTEN (js/app.js) eingetragen: sie hat
   eine Adresse, aber keinen Menüpunkt, bis der Sponsor sie abnimmt — wie der
   Landkarte-Entwurf.

   Inhalte: data/lernpfad.json (kuratiert). Der Wortlaut kommt aus
   data/handbuch/rhb/<kapitel>.json über HT.daten.rhbKapitel und wird mit
   HT.ui.bloecke gezeichnet — dieselben Absätze, Abbildungen und Seitenmarken
   wie im Handbuch, nichts nacherzählt.

   Platz für später: Die Einführung ist der Ort, an dem Video und Ton
   stehen werden (ein Block `medien` je Lektion); alles andere bleibt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  var DATEI = 'data/lernpfad.json';
  var geladen = null;     // Promise mit den Inhalten (einmal je Sitzung)

  function inhalte() {
    if (!geladen) {
      geladen = HT.daten.ladeJson(DATEI).catch(function () { return null; });
    }
    return geladen;
  }

  /* --- Bestand ------------------------------------------------------------ */

  /** Alle Lektionen flach, jede mit ihrem Block und ihrer Nummer im Block. */
  function alleLektionen(daten) {
    var liste = [];
    ((daten && daten.bloecke) || []).forEach(function (b) {
      (b.lektionen || []).forEach(function (l, i) {
        liste.push({ lektion: l, block: b, nr: i + 1, von: (b.lektionen || []).length });
      });
    });
    return liste;
  }

  function eintragVon(daten, id) {
    return alleLektionen(daten).filter(function (e) { return e.lektion.id === id; })[0] || null;
  }

  function adresse(id) {
    return '#/lernpfad' + (id ? '?lektion=' + encodeURIComponent(id) : '');
  }

  /** «Das Gerüst: Phasen, Szenarien, Module» → «Das Gerüst» für die Leiste. */
  function kurzTitel(l) {
    return l.titel.split(':')[0].trim();
  }

  /* --- Handbuchtext ------------------------------------------------------- */

  /** Die Abschnitte einer Lektion, in der Reihenfolge der Quelle. */
  function abschnitteLaden(lektion) {
    var quellen = lektion.quelle || [];
    return Promise.all(quellen.map(function (q) {
      return HT.daten.rhbKapitel(q.kapitel).then(function (kap) {
        var nach = {};
        ((kap && kap.abschnitte) || []).forEach(function (a) { if (a.nummer) { nach[a.nummer] = a; } });
        return (q.abschnitte || []).map(function (n) {
          return nach[n] ? { kapitel: q.kapitel, abschnitt: nach[n] } : null;
        }).filter(Boolean);
      }).catch(function () { return []; });
    })).then(function (teile) {
      return teile.reduce(function (alle, t) { return alle.concat(t); }, []);
    });
  }

  /** Der Block der Leitabbildung («Abbildung 4») unter den Abschnitten. */
  function bildBlock(abschnitte, bild) {
    if (!bild) { return null; }
    var treffer = null;
    abschnitte.forEach(function (t) {
      (t.abschnitt.bloecke || []).forEach(function (b) {
        if (!treffer && b.t === 'abb' && (b.text || '').indexOf(bild) === 0) { treffer = b; }
      });
    });
    return treffer;
  }

  /* --- Bausteine der Seite ------------------------------------------------ */

  function abschnittText(text) {
    return h('p', { class: 'lp-text', text: text });
  }

  function zieleListe(ziele) {
    if (!ziele || !ziele.length) { return null; }
    return h('section', { class: 'lp-ziele' }, [
      h('h2', { class: 'lp-marke', text: 'Ziele' }),
      h('ul', { class: 'lp-ziele__liste' }, ziele.map(function (z) {
        return h('li', { text: z });
      }))
    ]);
  }

  function uebenZeile(ueben) {
    if (!ueben || !ueben.length) { return null; }
    return h('section', { class: 'lp-ueben' }, [
      h('h2', { class: 'lp-marke', text: 'Üben' }),
      h('div', { class: 'lp-ueben__links' }, ueben.map(function (u) {
        return h('a', { class: 'btn btn--klein', href: u.adresse, text: u.titel });
      }))
    ]);
  }

  /* Der Wortlaut steht zugeklappt: die Lektion soll zuerst ihre eigene
     Einführung zeigen, das Handbuch ist das Nachschlagen dazu. */
  function nachlesen(lektion, abschnitte, ausgelassen) {
    if (!abschnitte.length) { return null; }
    var nummern = abschnitte.map(function (t) { return t.abschnitt.nummer; });
    var koerper = h('div', { class: 'lp-quelle__inhalt' });
    abschnitte.forEach(function (t) {
      var a = t.abschnitt;
      koerper.appendChild(h('h3', { class: 'lp-quelle__titel', text: (a.nummer ? a.nummer + ' ' : '') + (a.titel || '') }));
      var bloecke = (a.bloecke || []).filter(function (b) { return b !== ausgelassen; });
      if (bloecke.length) {
        koerper.appendChild(HT.ui.bloecke(bloecke, { verlinken: true, ebene: 4, seite: a.seite }));
      }
    });
    return h('details', { class: 'lp-quelle' }, [
      h('summary', { class: 'lp-quelle__kopf' }, [
        h('span', { text: 'Im Handbuch nachlesen' }),
        h('span', { class: 'lp-quelle__nummern', text: nummern.join(', ') })
      ]),
      koerper
    ]);
  }

  function weiterZeile(daten, eintrag) {
    var flach = alleLektionen(daten);
    var i = flach.map(function (e) { return e.lektion.id; }).indexOf(eintrag.lektion.id);
    var vor = i > 0 ? flach[i - 1] : null;
    var nach = i >= 0 && i < flach.length - 1 ? flach[i + 1] : null;
    return h('nav', { class: 'lp-weiter', 'aria-label': 'Lektionen' }, [
      vor ? h('a', { class: 'lp-weiter__link lp-weiter__link--zurueck', href: adresse(vor.lektion.id) }, [
        h('span', { class: 'lp-weiter__marke', text: '‹ Zurück' }),
        h('span', { class: 'lp-weiter__titel', text: vor.lektion.titel })
      ]) : h('span', {}),
      h('a', { class: 'lp-weiter__uebersicht', href: adresse(null), text: 'Übersicht' }),
      nach ? h('a', { class: 'lp-weiter__link lp-weiter__link--vor', href: adresse(nach.lektion.id) }, [
        h('span', { class: 'lp-weiter__marke', text: 'Weiter ›' }),
        h('span', { class: 'lp-weiter__titel', text: nach.lektion.titel })
      ]) : h('span', {})
    ]);
  }

  /* --- Leiste ------------------------------------------------------------- */

  function anleitung() {
    return [
      h('h3', { class: 'gpop__abschnitt', text: 'Lernpfad' }),
      h('p', { text: 'Der Stoff des Referenzhandbuchs als Schulung: Lektionen in einer Reihenfolge, die zum Lernen '
        + 'passt — nicht in der Reihenfolge des Handbuchs. Jede Lektion nennt zuerst ihre Ziele, erklärt in wenigen '
        + 'Sätzen, worum es geht, und zeigt die Abbildung, um die es dabei geht.' }),
      h('p', { text: 'Darunter steht der Wortlaut des Handbuchs zum Nachlesen, zugeklappt: dieselben Absätze, '
        + 'Abbildungen und Seitenzahlen wie im Handbuch. Die Einführung ist von uns, alles Weitere ist Handbuchtext.' }),
      h('p', { text: 'Am Fuss jeder Lektion führen Verweise ins Üben (Überblick, Zuordnen, Lernkarten) und zur '
        + 'nächsten Lektion.' }),
      h('p', { class: 'lp-hinweis', text: 'Entwurf: Die Seite ist noch nicht im Menü und noch nicht abgenommen.' })
    ];
  }

  function leisteSetzen(daten, aktivId) {
    var flach = alleLektionen(daten);
    HT.app.unterleiste({
      label: 'Lektionen',
      links: flach.map(function (e) {
        return {
          href: adresse(e.lektion.id),
          text: kurzTitel(e.lektion),
          nr: String(e.nr),
          aktiv: e.lektion.id === aktivId
        };
      }),
      info: { titel: 'Lernpfad', inhalt: anleitung }
    });
  }

  /* --- Seiten ------------------------------------------------------------- */

  function lektionKarte(e) {
    return h('a', { class: 'lp-karte', href: adresse(e.lektion.id) }, [
      h('span', { class: 'lp-karte__nr', text: String(e.nr) }),
      h('span', { class: 'lp-karte__text' }, [
        h('span', { class: 'lp-karte__titel', text: e.lektion.titel }),
        h('span', { class: 'lp-karte__kurz', text: e.lektion.kurz || '' }),
        h('span', { class: 'lp-karte__fuss', text: (e.lektion.ziele || []).length + ' Ziele'
          + (e.lektion.dauer ? ' · ' + e.lektion.dauer + ' Min.' : '') })
      ])
    ]);
  }

  function uebersichtBauen(behaelter, daten) {
    var flach = alleLektionen(daten);
    var seite = h('section', { class: 'lp-seite' }, [
      h('div', { class: 'lp-kopf' }, [
        h('h1', { class: 'lp-kopf__titel', text: 'Lernpfad' }),
        h('p', { class: 'lp-kopf__kurz', text: 'Der Stoff des Referenzhandbuchs, geordnet wie eine Schulung: '
          + flach.length + ' Lektionen in ' + (daten.bloecke || []).length + ' Block.' }),
        h('p', { class: 'lp-entwurf', role: 'note' }, [
          h('b', { text: 'Entwurf. ' }),
          'Diese Seite steht noch nicht im Menü. Sie ist über die Adresse erreichbar, damit sie sich ansehen lässt, '
            + 'bevor sie abgenommen wird.'
        ])
      ])
    ]);

    (daten.bloecke || []).forEach(function (b) {
      seite.appendChild(h('section', { class: 'lp-block' }, [
        h('h2', { class: 'lp-block__titel', text: b.titel }),
        b.einleitung ? h('p', { class: 'lp-block__text', text: b.einleitung }) : null,
        h('div', { class: 'lp-karten' }, (b.lektionen || []).map(function (l, i) {
          return lektionKarte({ lektion: l, block: b, nr: i + 1 });
        }))
      ]));
    });

    behaelter.appendChild(seite);
  }

  function lektionBauen(behaelter, daten, eintrag) {
    var l = eintrag.lektion;
    var seite = h('section', { class: 'lp-seite lp-seite--lektion' });

    seite.appendChild(h('div', { class: 'lp-kopf' }, [
      h('p', { class: 'lp-brot' }, [
        h('a', { href: adresse(null), text: 'Lernpfad' }),
        h('span', { class: 'lp-brot__trenner', 'aria-hidden': 'true', text: '›' }),
        h('span', { text: eintrag.block.titel }),
        h('span', { class: 'lp-brot__trenner', 'aria-hidden': 'true', text: '›' }),
        h('span', { class: 'lp-brot__stand', text: 'Lektion ' + eintrag.nr + ' von ' + eintrag.von })
      ]),
      h('h1', { class: 'lp-kopf__titel', text: l.titel }),
      l.kurz ? h('p', { class: 'lp-kopf__kurz', text: l.kurz }) : null
    ]));

    var ziele = zieleListe(l.ziele);
    if (ziele) { seite.appendChild(ziele); }

    var worum = h('section', { class: 'lp-worum' }, [
      h('h2', { class: 'lp-marke', text: 'Worum es geht' })
    ]);
    (l.einfuehrung || []).forEach(function (t) { worum.appendChild(abschnittText(t)); });
    seite.appendChild(worum);

    /* Abbildung und Wortlaut kommen aus dem Handbuch und damit später. */
    var bildPlatz = h('div', { class: 'lp-bild' });
    var quellePlatz = h('div', { class: 'lp-quelle__platz' }, h('p', { class: 'trefferzahl', role: 'status', text: 'Handbuchtext wird geladen …' }));
    seite.appendChild(bildPlatz);
    seite.appendChild(quellePlatz);

    var ueben = uebenZeile(l.ueben);
    if (ueben) { seite.appendChild(ueben); }
    seite.appendChild(weiterZeile(daten, eintrag));
    behaelter.appendChild(seite);

    abschnitteLaden(l).then(function (abschnitte) {
      if (!document.body.contains(quellePlatz)) { return; }   // inzwischen weitergeblättert
      HT.ui.leeren(quellePlatz);
      if (!abschnitte.length) {
        quellePlatz.appendChild(HT.ui.leerZustand('Handbuchtext nicht verfügbar',
          'Die Abschnitte dieser Lektion konnten nicht geladen werden.'));
        return;
      }
      var bild = bildBlock(abschnitte, l.bild);
      if (bild) { bildPlatz.appendChild(HT.ui.bloecke([bild], { verlinken: false })); }
      quellePlatz.appendChild(nachlesen(l, abschnitte, bild));
    });
  }

  /* --- Ansicht ------------------------------------------------------------ */

  function render(behaelter, params) {
    params = params || {};
    var warten = h('p', { class: 'trefferzahl', role: 'status', text: 'Lernpfad wird geladen …' });
    behaelter.appendChild(warten);

    inhalte().then(function (daten) {
      if (!document.body.contains(warten)) { return; }
      HT.ui.leeren(behaelter);
      if (!daten || !(daten.bloecke || []).length) {
        behaelter.appendChild(HT.ui.leerZustand('Lernpfad nicht verfügbar',
          'Die Datei ' + DATEI + ' konnte nicht geladen werden.'));
        return;
      }
      var eintrag = params.lektion ? eintragVon(daten, String(params.lektion)) : null;
      leisteSetzen(daten, eintrag ? eintrag.lektion.id : null);
      if (eintrag) { lektionBauen(behaelter, daten, eintrag); }
      else { uebersichtBauen(behaelter, daten); }
    });
  }

  function titel(params) {
    return params && params.lektion ? 'Lernpfad · Lektion' : 'Lernpfad';
  }

  HT.views.lernpfad = { titel: titel, render: render };
}(window));
