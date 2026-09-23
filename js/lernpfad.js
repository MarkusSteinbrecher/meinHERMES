/* meinHERMES — Lernpfad (#/lernpfad), Entwurf.

   Der Stoff des Referenzhandbuchs als Schulung, gezeigt wie eine
   Präsentation: eine Folie füllt den Platz unter der Kopfzeile (Vollbild auf
   Knopf oder Taste F), geblättert wird mit den Pfeiltasten, der Leertaste,
   den Knöpfen oder durch Wischen. Seit 2026-09-23; vorher war der Lernpfad
   eine Lesespalte aus 24 Lektionen.

   Zwei Kurse in data/lernpfad.json (`kurse`): der Grundkurs mit sieben
   Kapiteln nach Aspekten (Methode, Phasen, Szenarien, Module, Ergebnisse
   und Aufgaben, Rollen, Anwendung) und der Deep Dive mit drei Perspektiven
   (Ergebnisse, Rollen, Entscheide). Adressen des Grundkurses tragen kein
   `kurs=`, die des Deep Dive `kurs=deepdive`. Jedes Kapitel beginnt mit
   einer Titelfolie (Ziele), zeigt eine Aussage pro Folie und endet mit einer
   Zusammenfassung und drei Kontrollfragen aus dem Quiz. Titel-, Zusammen-
   fassungs- und Fragefolien erzeugt diese Datei selbst; der Rest steht in
   data/lernpfad.json.

   Folientypen (Feld `typ`): aussage (Text, mit `bild` rechts die Abbildung),
   bild (die Abbildung füllt die Folie), spalten (2–4 Spalten), element (eine
   Phase, ein Modul oder ein Szenario — Kennzahlen aus unseren Daten), ebene
   (die Rollen einer Hierarchieebene aus unseren Daten), ergebnistypen und
   jePhase (Zahlen zu den Ergebnissen aus unseren Daten). Für den Deep Dive
   dazu: abschnitt (Trennfolie), lebenslauf (ein Ergebnis: Phasenleiste,
   erarbeitende Aufgaben, «Grundlage für»), ergebnisliste (alle Ergebnisse
   einiger Module), rollenweg und rollenphase (eine Rolle über alle Phasen
   bzw. in einer), rolle (Karte) und entscheid (wer, wann, worauf gestützt,
   was folgt) — die Fakten kommen aus aufgaben.ergebnisse/ergebnisPhasen/
   grundlagen, der Text der Folie ergänzt sie.

   Der geprüfte Wortlaut steht nicht auf der Folie, sondern in der
   Notizenleiste darunter (Taste N): die Handbuchabschnitte aus `quelle`,
   gezeichnet mit HT.ui.bloecke wie im Handbuch. Später der Platz für Ton
   und Video.

   Die Bühne ist 1280 × 720 Punkte gross (auf hohen Schirmen 640 breit und
   so hoch wie das Verhältnis des Schirms, 900 bis 1400) und
   wird als Ganzes auf den Platz skaliert — so bricht eine Folie überall
   gleich um, wie in PowerPoint. Geblättert wird ohne neuen Aufbau der
   Ansicht: die Adresse (?kapitel=…&folie=…) wird nur ersetzt, damit ein
   Vollbild nicht bei jedem Schritt endet.

   Die Seite ist absichtlich NICHT in ROUTEN (js/app.js) eingetragen: sie hat
   eine Adresse, aber keinen Menüpunkt, bis der Sponsor sie abnimmt. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};

  var h = HT.ui.h;

  var DATEI = 'data/lernpfad.json';
  var SPEICHER = 'lernpfad';           // HT.store: { notizen, stelle: { kapitel, folie } }
  var QUER = { b: 1280, h: 720 };
  var HOCH = { b: 640, h: 1120 };   // Höhe hochkant: nach Schirm, siehe skalieren()
  var geladen = null;

  var PHASEN = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss'];
  var TYPEN = [
    { titel: 'Dokumente', typ: 'Dokument', name: 'Dokumente', dazu: 'Checkliste', dazuName: 'Checklisten' },
    { titel: 'Zustände', typ: 'Zustand', name: 'Zustände', dazu: 'Meilenstein', dazuName: 'Meilensteine' }
  ];

  var ICONS = {
    zurueck: ['M15 5l-7 7 7 7'],
    weiter: ['M9 5l7 7-7 7'],
    notizen: ['M5 4h14v16H5Z', 'M8.5 9h7', 'M8.5 12.5h7', 'M8.5 16h4'],
    raster: ['M4 4h7v7H4Z', 'M13 4h7v7h-7Z', 'M4 13h7v7H4Z', 'M13 13h7v7h-7Z'],
    vollbild: ['M4 9V4h5', 'M15 4h5v5', 'M20 15v5h-5', 'M9 20H4v-5'],
    fenster: ['M9 4v5H4', 'M20 9h-5V4', 'M15 20v-5h5', 'M4 15h5v5'],
    schliessen: ['M6 6l12 12', 'M18 6 6 18']
  };

  function inhalte() {
    if (!geladen) { geladen = HT.daten.ladeJson(DATEI).catch(function () { return null; }); }
    return geladen;
  }

  function merken(teil) {
    var alt = HT.store.lies(SPEICHER, null);
    var neu = (alt && typeof alt === 'object') ? alt : {};
    Object.keys(teil).forEach(function (k) { neu[k] = teil[k]; });
    HT.store.schreib(SPEICHER, neu);
  }

  function gemerkt(k) {
    var g = HT.store.lies(SPEICHER, null);
    return g && typeof g === 'object' ? g[k] : undefined;
  }

  function anzahl(n, eins, mehr) { return n + ' ' + (n === 1 ? eins : mehr); }

  function knopf(klasse, titel, pfade, beiKlick, text) {
    var k = h('button', { type: 'button', class: klasse, title: titel, 'aria-label': titel },
      [HT.ui.symbol(pfade, 20), text ? h('span', { text: text }) : null]);
    k.addEventListener('click', beiKlick);
    return k;
  }

  /* --- Folienfolge -------------------------------------------------------- */

  /**
   * Die Kurse der Datei: `kurse` (seit dem Deep Dive), sonst die Kapitel der
   * ersten Fassung als ein Kurs. Der erste Kurs ist der Grundkurs; seine
   * Adressen tragen kein `kurs=`, damit alte Links gültig bleiben.
   */
  function kurseVon(daten) {
    if (daten && (daten.kurse || []).length) {
      return daten.kurse.filter(function (k) { return (k.kapitel || []).length; });
    }
    return daten && (daten.kapitel || []).length ? [{ id: 'grundkurs', titel: 'Grundkurs', kapitel: daten.kapitel }] : [];
  }

  /**
   * Alle Folien eines Kurses flach, in der Reihenfolge des Blätterns. Jede
   * kennt ihr Kapitel und ihre Nummer darin (1 = Titelfolie). Deckblatt und
   * Schluss gehören zu keinem Kapitel.
   */
  function folgeBauen(kurs) {
    var folge = [{ art: 'deckblatt', kapitel: null }];
    (kurs.kapitel || []).forEach(function (k, ki) {
      var eigene = [{ art: 'kapitel' }];
      (k.folien || []).forEach(function (f) { eigene.push({ art: 'folie', folie: f }); });
      if ((k.merke || []).length) { eigene.push({ art: 'merke' }); }
      var fragen = (k.fragen || []).map(frageMitId).filter(Boolean);
      fragen.forEach(function (q, i) { eigene.push({ art: 'frage', frage: q, nr: i + 1, von: fragen.length }); });
      eigene.forEach(function (e, i) {
        e.kapitel = k;
        e.kapNr = ki + 1;
        e.nrImKapitel = i + 1;
        e.vonImKapitel = eigene.length;
        folge.push(e);
      });
    });
    folge.push({ art: 'schluss', kapitel: null });
    folge.forEach(function (e, i) { e.index = i; e.kurs = kurs; });
    return folge;
  }

  function frageMitId(id) {
    return HT.daten.quizfragen().filter(function (q) { return q.id === id; })[0] || null;
  }

  function indexVon(folge, kapitelId, nr) {
    for (var i = 0; i < folge.length; i++) {
      var e = folge[i];
      if (e.kapitel && e.kapitel.id === kapitelId && e.nrImKapitel === (nr || 1)) { return i; }
    }
    return 0;
  }

  function adresse(kurs, kapitelId, folie, erster) {
    var teile = [];
    if (kurs && !erster) { teile.push('kurs=' + encodeURIComponent(kurs.id)); }
    if (kapitelId) { teile.push('kapitel=' + encodeURIComponent(kapitelId)); }
    if (folie) { teile.push('folie=' + folie); }
    return '#/lernpfad' + (teile.length ? '?' + teile.join('&') : '');
  }

  function adresseVon(e, erster) {
    if (!e.kapitel) { return adresse(e.kurs, null, e.art === 'schluss' ? 'ende' : null, erster); }
    return adresse(e.kurs, e.kapitel.id, e.nrImKapitel, erster);
  }

  /* --- Daten für die erzeugten Folien -------------------------------------- */

  function mitPhase(liste, phase) {
    return liste.filter(function (e) { return (e.phasen || []).indexOf(phase) !== -1; });
  }

  function mitModul(liste, modul) {
    return liste.filter(function (e) { return (e.module || []).indexOf(modul) !== -1; });
  }

  function ohnePraefix(name) { return name.replace(/^Meilenstein /, ''); }

  /* --- Handbuch: Abbildungen und Wortlaut --------------------------------- */

  /** Die Kapiteltexte der Quelle, je Kapitel einmal geladen. */
  function kapitelTexte(quelle) {
    var ids = [];
    (quelle || []).forEach(function (q) { if (ids.indexOf(q.kapitel) === -1) { ids.push(q.kapitel); } });
    return Promise.all(ids.map(function (id) {
      return HT.daten.rhbKapitel(id).then(function (k) { return { id: id, kap: k }; })
        .catch(function () { return { id: id, kap: null }; });
    })).then(function (liste) {
      var nach = {};
      liste.forEach(function (t) { nach[t.id] = t.kap; });
      return nach;
    });
  }

  /** Die Abschnitte der Quelle in ihrer Reihenfolge. */
  function abschnitteDer(quelle, texte) {
    var aus = [];
    (quelle || []).forEach(function (q) {
      var kap = texte[q.kapitel];
      var nach = {};
      ((kap && kap.abschnitte) || []).forEach(function (a) { if (a.nummer) { nach[a.nummer] = a; } });
      (q.abschnitte || []).forEach(function (n) { if (nach[n]) { aus.push(nach[n]); } });
    });
    return aus;
  }

  /**
   * Die Abbildung einer Folie: gesucht am Anfang der Bildunterschrift
   * («Abbildung 12») oder im Dateinamen («phase-hl-konzept»), zuerst in den
   * Abschnitten der Quelle, dann im übrigen Kapitel. Die Reihenfolge zählt:
   * «phase-hl-konzept» steckt auch im Band von 1.1.3, das alle vier Phasen
   * der Lösungsentstehung zeigt.
   */
  function bildSuchen(folie, texte) {
    var bild = folie.bild;
    if (!bild) { return null; }
    function passt(b) {
      return b.t === 'abb' && ((b.text || '').indexOf(bild) === 0
        || (!/^Abbildung /.test(bild) && (b.datei || '').indexOf(bild + '.') !== -1));
    }
    function inListe(abschnitte) {
      for (var i = 0; i < abschnitte.length; i++) {
        var bl = abschnitte[i].bloecke || [];
        for (var j = 0; j < bl.length; j++) { if (passt(bl[j])) { return bl[j]; } }
      }
      return null;
    }
    var treffer = inListe(abschnitteDer(folie.quelle, texte));
    if (treffer) { return treffer; }
    var alle = [];
    Object.keys(texte).forEach(function (id) { alle = alle.concat((texte[id] && texte[id].abschnitte) || []); });
    return inListe(alle);
  }

  function quellText(folie, texte) {
    var abschnitte = abschnitteDer(folie.quelle, texte);
    if (!abschnitte.length) { return ''; }
    var seiten = abschnitte.map(function (a) { return a.seite; }).filter(Boolean);
    return 'Handbuch ' + abschnitte.map(function (a) { return a.nummer; }).join(', ')
      + (seiten.length ? ' · S. ' + seiten[0] + (seiten[seiten.length - 1] !== seiten[0] ? '–' + seiten[seiten.length - 1] : '') : '');
  }

  /* --- Bausteine der Folien ----------------------------------------------- */

  function kopfzeile(e, titel) {
    var marke = e.kapitel ? 'Kapitel ' + e.kapNr + ' · ' + e.kapitel.titel : 'Lernpfad';
    return h('header', { class: 'lp-f__kopf' }, [
      h('p', { class: 'lp-f__marke', text: marke }),
      titel ? h('h2', { class: 'lp-f__titel', text: titel }) : null
    ]);
  }

  function punkteListe(punkte, klasse) {
    if (!punkte || !punkte.length) { return null; }
    return h('ul', { class: 'lp-f__punkte' + (klasse ? ' ' + klasse : '') }, punkte.map(function (p) {
      return h('li', { text: p });
    }));
  }

  function kernSatz(text) {
    return text ? h('p', { class: 'lp-f__kern', text: text }) : null;
  }

  function fussZeile(text) {
    return h('footer', { class: 'lp-f__fuss' }, text ? [h('span', { text: text })] : []);
  }

  /** Platz für eine Handbuchabbildung; wird gefüllt, sobald der Text da ist. */
  function bildPlatz() {
    return h('div', { class: 'lp-f__bild' }, h('span', { class: 'lp-f__bild-laden', text: 'Abbildung wird geladen …' }));
  }

  function bildEinsetzen(platz, block) {
    HT.ui.leeren(platz);
    if (!block || !block.datei) { platz.classList.add('ist-leer'); return; }
    platz.appendChild(h('img', { src: block.datei, alt: block.text || 'Abbildung aus dem HERMES-Referenzhandbuch' }));
    if (block.text) { platz.appendChild(h('p', { class: 'lp-f__bildtext', text: block.text })); }
  }

  function chips(namen, klasse) {
    return h('ul', { class: 'lp-chips' + (klasse ? ' ' + klasse : '') }, namen.map(function (n) {
      return h('li', { class: 'lp-chip', text: n });
    }));
  }

  function zahl(wert, label, zusatz) {
    return h('div', { class: 'lp-zahl' }, [
      h('span', { class: 'lp-zahl__wert', text: String(wert) }),
      h('span', { class: 'lp-zahl__label', text: label }),
      zusatz ? h('span', { class: 'lp-zahl__zusatz', text: zusatz }) : null
    ]);
  }

  /* --- Folientypen --------------------------------------------------------- */

  /* Die letzte Folie je Kurs; die erste Fassung merkte sich nur eine
     Stelle ({ kapitel, folie }), die gilt für den Grundkurs. */
  function stelleVon(kurs, erster) {
    var g = gemerkt('stelle');
    if (!g || typeof g !== 'object') { return null; }
    if (g.kapitel) { return erster ? g : null; }
    return g[kurs.id] || null;
  }

  function stelleMerken(kurs, kapitelId, folie) {
    var g = gemerkt('stelle');
    var neu = (g && typeof g === 'object' && !g.kapitel) ? g : {};
    neu[kurs.id] = { kapitel: kapitelId, folie: folie };
    merken({ stelle: neu });
  }

  function deckblatt(ctx) {
    var kurs = ctx.kurs;
    var kapitel = kurs.kapitel || [];
    var stelle = stelleVon(kurs, ctx.erster);
    var weiter = null;
    if (stelle && stelle.kapitel) {
      var i = indexVon(ctx.folge, stelle.kapitel, stelle.folie);
      if (i > 0 && i < ctx.folge.length - 1) {
        var e = ctx.folge[i];
        weiter = h('button', { type: 'button', class: 'btn btn--primaer lp-deck__weiter' },
          'Weiter bei Kapitel ' + e.kapNr + ', Folie ' + e.nrImKapitel);
        weiter.addEventListener('click', function () { ctx.gehe(i); });
      }
    }
    var summe = 0;
    ctx.folge.forEach(function (e) { if (e.kapitel) { summe++; } });
    return h('div', { class: 'lp-f lp-f--deck' }, [
      h('div', { class: 'lp-deck__text' }, [
        h('p', { class: 'lp-f__marke', text: 'Lernpfad · ' + (kurs.titel || 'HERMES 2022') }),
        h('h1', { class: 'lp-deck__titel', text: kurs.deckTitel || kurs.titel }),
        h('p', { class: 'lp-deck__kurz', text: (kurs.deckKurz ? kurs.deckKurz + ' ' : '') + summe + ' Folien.' }),
        h('p', { class: 'lp-deck__tasten' }, [
          h('kbd', { text: '→' }), ' weiter  ', h('kbd', { text: '←' }), ' zurück  ',
          h('kbd', { text: 'F' }), ' Vollbild  ', h('kbd', { text: 'N' }), ' Handbuchtext'
        ]),
        h('div', { class: 'lp-deck__knoepfe' }, [
          weiter,
          (function () {
            var b = h('button', { type: 'button', class: 'btn' + (weiter ? '' : ' btn--primaer') }, 'Von vorne beginnen');
            b.addEventListener('click', function () { ctx.gehe(1); });
            return b;
          }())
        ]),
        ctx.kurse.length > 1 ? h('p', { class: 'lp-deck__kurse' }, ctx.kurse.filter(function (k) { return k !== kurs; }).map(function (k) {
          return h('a', { href: adresse(k, null, null, k === ctx.kurse[0]) }, [
            h('span', { text: 'Zum ' + k.titel + ' ›' }),
            k.kurz ? h('span', { class: 'lp-deck__kurszeile', text: k.kurz }) : null
          ]);
        })) : null
      ]),
      h('ol', { class: 'lp-deck__kapitel' }, kapitel.map(function (k, ki) {
        var b = h('button', { type: 'button', class: 'lp-deck__kap' }, [
          h('span', { class: 'lp-deck__nr', text: String(ki + 1) }),
          h('span', { class: 'lp-deck__kaptitel', text: k.titel }),
          h('span', { class: 'lp-deck__kapzahl', text: (k.dauer ? '≈ ' + k.dauer + ' Min.' : '') })
        ]);
        b.addEventListener('click', function () { ctx.gehe(indexVon(ctx.folge, k.id, 1)); });
        return h('li', {}, b);
      }))
    ]);
  }

  function kapitelFolie(e) {
    var k = e.kapitel;
    return h('div', { class: 'lp-f lp-f--kapitel' }, [
      h('div', { class: 'lp-kap__links' }, [
        h('p', { class: 'lp-kap__nr', text: 'Kapitel ' + e.kapNr }),
        h('h1', { class: 'lp-kap__titel', text: k.titel }),
        k.kurz ? h('p', { class: 'lp-kap__kurz', text: k.kurz }) : null,
        h('p', { class: 'lp-kap__meta', text: anzahl(e.vonImKapitel, 'Folie', 'Folien') + (k.dauer ? ' · ≈ ' + k.dauer + ' Minuten' : '') })
      ]),
      (k.ziele || []).length ? h('div', { class: 'lp-kap__ziele' }, [
        h('p', { class: 'lp-f__marke', text: 'Danach können Sie' }),
        punkteListe(k.ziele, 'lp-f__punkte--ziele')
      ]) : null
    ]);
  }

  function aussageFolie(e, ctx) {
    var f = e.folie;
    var platz = f.bild ? bildPlatz() : null;
    if (platz) { ctx.nachLaden(function (texte) { bildEinsetzen(platz, bildSuchen(f, texte)); }); }
    return h('div', { class: 'lp-f lp-f--aussage' + (platz ? ' lp-f--mitbild' : '') }, [
      kopfzeile(e, f.titel),
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        platz
      ]),
      ctx.fuss
    ]);
  }

  function bildFolie(e, ctx) {
    var f = e.folie;
    var platz = bildPlatz();
    ctx.nachLaden(function (texte) { bildEinsetzen(platz, bildSuchen(f, texte)); });
    return h('div', { class: 'lp-f lp-f--bild' }, [
      kopfzeile(e, f.titel),
      f.kern ? h('p', { class: 'lp-f__kern lp-f__kern--klein', text: f.kern }) : null,
      h('div', { class: 'lp-f__koerper' }, [platz, (f.punkte || []).length ? punkteListe(f.punkte.slice(0, 2), 'lp-f__punkte--seite') : null]),
      ctx.fuss
    ]);
  }

  function spaltenFolie(e, ctx) {
    var f = e.folie;
    return h('div', { class: 'lp-f lp-f--spalten' }, [
      kopfzeile(e, f.titel),
      kernSatz(f.kern),
      h('div', { class: 'lp-spalten', style: '--spalten:' + Math.max(1, (f.spalten || []).length) }, (f.spalten || []).map(function (s) {
        return h('section', { class: 'lp-spalte' }, [
          h('h3', { class: 'lp-spalte__titel', text: s.titel }),
          punkteListe(s.punkte)
        ]);
      })),
      ctx.fuss
    ]);
  }

  /** Kennzahlen einer Phase, eines Moduls oder eines Szenarios aus unseren Daten. */
  function elementFakten(art, eintrag) {
    var ergebnisse = HT.daten.eintraegeDerKategorie('ergebnis');
    var aufgaben = HT.daten.eintraegeDerKategorie('aufgabe');
    var name = eintrag.begriff;
    var teile = [];
    if (art === 'szenario') {
      teile.push(h('div', { class: 'lp-fakten__zahlen' }, [zahl((eintrag.module || []).length, 'Module')]));
      teile.push(h('p', { class: 'lp-fakten__titel', text: 'Module im Szenario' }));
      teile.push(chips(eintrag.module || []));
      return teile;
    }
    var erg = art === 'phase' ? mitPhase(ergebnisse, name) : mitModul(ergebnisse, name);
    var auf = art === 'phase' ? mitPhase(aufgaben, name) : mitModul(aufgaben, name);
    var inhalt = erg.filter(function (x) { return x.typ !== 'Meilenstein' && x.typ !== 'Checkliste'; });
    var minimal = inhalt.filter(function (x) { return x.minimalGefordert; });
    var meilensteine = erg.filter(function (x) { return x.typ === 'Meilenstein' && x.begriff !== 'Meilensteine'; });
    teile.push(h('div', { class: 'lp-fakten__zahlen' }, [
      zahl(inhalt.length, 'Ergebnisse', minimal.length ? 'davon ' + minimal.length + ' minimal gefordert' : null),
      zahl(auf.length, 'Aufgaben')
    ]));
    if (art === 'modul') {
      var phasen = [];
      erg.concat(auf).forEach(function (x) {
        HT.daten.phasenImModul(x, name).forEach(function (p) { if (phasen.indexOf(p) === -1) { phasen.push(p); } });
      });
      teile.push(h('p', { class: 'lp-fakten__titel', text: 'Kommt vor in' }));
      teile.push(chips(HT.daten.phasenSortiert(phasen)));
    }
    if (meilensteine.length && art === 'modul') {
      teile.push(h('p', { class: 'lp-fakten__titel', text: 'Meilensteine' }));
      teile.push(chips(meilensteine.map(function (m) { return ohnePraefix(m.begriff); }), 'lp-chips--meilenstein'));
    }
    return teile;
  }

  var ART_NAME = { phase: 'Phase', modul: 'Modul', szenario: 'Szenario' };

  function elementFolie(e, ctx) {
    var f = e.folie;
    var eintrag = HT.daten.eintragMitBegriff(f.name, f.art);
    /* Als Band über der Folie taugt nur das Phasenband des Handbuchs; die
       Modulbilder der Szenarien wären dort unlesbar klein — sie stehen in den
       Notizen, die Module selbst rechts als Liste. */
    var platz = f.bild && f.art === 'phase' ? bildPlatz() : null;
    if (platz) { ctx.nachLaden(function (texte) { bildEinsetzen(platz, bildSuchen(f, texte)); }); }
    var kicker = h('p', { class: 'lp-f__art' }, [
      HT.ui.katSymbol(f.art, 18),
      h('span', { text: ART_NAME[f.art] || '' }),
      f.pflicht ? h('span', { class: 'lp-pflicht', text: 'in jedem Projekt' }) : null
    ]);
    return h('div', { class: 'lp-f lp-f--element lp-f--' + f.art + (platz ? ' lp-f--mitband' : '') }, [
      kopfzeile(e, null),
      platz ? h('div', { class: 'lp-f__band' }, platz) : null,
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [
          kicker,
          h('h2', { class: 'lp-f__titel lp-f__titel--gross', text: f.titel || f.name }),
          kernSatz(f.kern),
          punkteListe(f.punkte)
        ]),
        eintrag ? h('aside', { class: 'lp-fakten' }, elementFakten(f.art, eintrag).concat([
          h('a', { class: 'lp-fakten__link', href: '#/ueberblick?id=' + encodeURIComponent(eintrag.id), text: 'Im Überblick ansehen' })
        ])) : null
      ]),
      ctx.fuss
    ]);
  }

  function ebeneFolie(e, ctx) {
    var f = e.folie;
    var aufgaben = HT.daten.eintraegeDerKategorie('aufgabe');
    var rollen = HT.daten.alphabetisch(HT.daten.eintraegeDerKategorie('rolle').filter(function (r) { return r.ebene === f.ebene; }));
    /* Drei Rollen nebeneinander, vier als zwei mal zwei, neun als drei mal drei. */
    var spalten = rollen.length === 4 ? 2 : Math.min(3, rollen.length);
    var laenge = rollen.length > 4 ? 72 : 160;
    return h('div', { class: 'lp-f lp-f--ebene' }, [
      kopfzeile(e, f.titel || ('Ebene ' + f.ebene)),
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        h('ul', { class: 'lp-rollen', style: '--spalten:' + spalten }, rollen.map(function (r) {
        var verantwortet = aufgaben.filter(function (a) { return a.verantwortlich === r.begriff; }).length;
        return h('li', { class: 'lp-rolle' }, [
          h('span', { class: 'lp-rolle__name' }, [HT.ui.katSymbol('rolle', 18), h('span', { text: r.begriff })]),
          h('span', { class: 'lp-rolle__text', text: HT.ui.kuerzen(HT.daten.ersterSatz(r.definition || ''), laenge) }),
          h('span', { class: 'lp-rolle__zahl', text: verantwortet ? 'verantwortet ' + anzahl(verantwortet, 'Aufgabe', 'Aufgaben') : 'verantwortet keine Aufgabe' })
        ]);
        }))
      ]),
      ctx.fuss
    ]);
  }

  /* Das Handbuch kennt zwei Arten von Ergebnissen: Dokumente (Tabelle 16,
     die Checklisten darin als eine Zeile) und Zustände (Tabelle 17, ebenso
     die Meilensteine). Unsere Daten führen Checklisten und Meilensteine als
     eigenen Typ, mit je einem Sammeleintrag, der hier nicht mitzählt. */
  function ergebnistypenFolie(e, ctx) {
    var f = e.folie;
    var alle = HT.daten.eintraegeDerKategorie('ergebnis').filter(function (x) {
      return x.begriff !== 'Meilensteine' && x.begriff !== 'Checklisten';
    });
    function vomTyp(typ) {
      var liste = HT.daten.alphabetisch(alle.filter(function (x) { return x.typ === typ; }));
      return liste.filter(function (x) { return x.minimalGefordert; }).concat(liste.filter(function (x) { return !x.minimalGefordert; }));
    }
    function teil(typ, name) {
      var liste = vomTyp(typ);
      return h('div', { class: 'lp-typ' }, [
        h('span', { class: 'lp-zahl__wert', text: String(liste.length) }),
        h('span', { class: 'lp-typ__name', text: name }),
        h('span', { class: 'lp-typ__bsp', text: 'z. B. ' + liste.slice(0, 3).map(function (x) { return x.begriff; }).join(', ') })
      ]);
    }
    return h('div', { class: 'lp-f lp-f--typen' }, [
      kopfzeile(e, f.titel || 'Dokumente und Zustände'),
      kernSatz(f.kern),
      h('div', { class: 'lp-spalten', style: '--spalten:' + TYPEN.length }, TYPEN.map(function (g) {
        return h('section', { class: 'lp-spalte' }, [
          h('h3', { class: 'lp-spalte__titel', text: g.titel }),
          teil(g.typ, g.name),
          teil(g.dazu, g.dazuName)
        ]);
      })),
      punkteListe(f.punkte),
      ctx.fuss
    ]);
  }

  /* Ein Balken je Phase: minimal geforderte Ergebnisse in Akzentfarbe, die
     übrigen grau, dazwischen eine Fuge. Zahlen stehen daneben; der Titel
     jedes Balkens nennt beide Werte für die Maus. */
  function jePhaseFolie(e, ctx) {
    var f = e.folie;
    var alle = HT.daten.eintraegeDerKategorie('ergebnis').filter(function (x) { return x.typ !== 'Meilenstein' && x.typ !== 'Checkliste'; });
    var zeilen = PHASEN.map(function (p) {
      var inPhase = mitPhase(alle, p);
      return { phase: p, alle: inPhase.length, minimal: inPhase.filter(function (x) { return x.minimalGefordert; }).length };
    });
    var max = Math.max.apply(null, zeilen.map(function (z) { return z.alle; })) || 1;
    return h('div', { class: 'lp-f lp-f--jephase' }, [
      kopfzeile(e, f.titel || 'Ergebnisse je Phase'),
      kernSatz(f.kern),
      h('div', { class: 'lp-balken' }, [
        h('p', { class: 'lp-balken__legende' }, [
          h('span', { class: 'lp-balken__muster lp-balken__muster--minimal' }), 'minimal gefordert',
          h('span', { class: 'lp-balken__muster' }), 'weitere'
        ]),
        h('ul', { class: 'lp-balken__liste' }, zeilen.map(function (z) {
          var titel = z.phase + ': ' + z.alle + ' Ergebnisse, davon ' + z.minimal + ' minimal gefordert';
          return h('li', { class: 'lp-balken__zeile', title: titel }, [
            h('span', { class: 'lp-balken__name', text: z.phase }),
            h('span', { class: 'lp-balken__spur' }, [
              h('span', { class: 'lp-balken__teil lp-balken__teil--minimal', style: 'width:' + (z.minimal / max * 100) + '%' }),
              h('span', { class: 'lp-balken__teil', style: 'width:' + ((z.alle - z.minimal) / max * 100) + '%' })
            ]),
            h('span', { class: 'lp-balken__wert', text: z.minimal + ' / ' + z.alle })
          ]);
        }))
      ]),
      punkteListe(f.punkte),
      ctx.fuss
    ]);
  }

  function merkeFolie(e) {
    var k = e.kapitel;
    return h('div', { class: 'lp-f lp-f--merke' }, [
      kopfzeile(e, 'Das nehmen Sie mit'),
      h('ol', { class: 'lp-merke' }, (k.merke || []).map(function (m) { return h('li', { text: m }); })),
      (k.ueben || []).length ? h('div', { class: 'lp-merke__ueben' }, [
        h('span', { class: 'lp-f__marke', text: 'Vertiefen' })
      ].concat(k.ueben.map(function (u) {
        return h('a', { class: 'btn btn--klein', href: u.adresse, text: u.titel });
      }))) : null
    ]);
  }

  /* Eine Kontrollfrage wie im Quiz: auswählen, prüfen, Erklärung lesen. Das
     Ergebnis zählt in den Verlauf der Frage (quiz-verlauf), wie im Quiz. */
  function frageFolie(e, ctx) {
    var q = e.frage;
    var mehrere = q.richtig.length > 1;
    var gewaehlt = [];
    var geprueft = false;
    var knoepfe = [];
    var pruefen = h('button', { type: 'button', class: 'btn btn--primaer', disabled: true }, 'Prüfen');
    var erklaerung = h('div', { class: 'lp-frage__erklaerung', hidden: true });

    function waehlen(i) {
      if (geprueft) { return; }
      var pos = gewaehlt.indexOf(i);
      if (mehrere) {
        if (pos === -1) { gewaehlt.push(i); } else { gewaehlt.splice(pos, 1); }
      } else {
        gewaehlt = pos === -1 ? [i] : [];
      }
      knoepfe.forEach(function (k, j) { k.setAttribute('aria-pressed', gewaehlt.indexOf(j) !== -1 ? 'true' : 'false'); });
      pruefen.disabled = !gewaehlt.length;
    }

    function pruefenJetzt() {
      if (geprueft || !gewaehlt.length) { return; }
      geprueft = true;
      var ok = gewaehlt.length === q.richtig.length && q.richtig.every(function (r) { return gewaehlt.indexOf(r) !== -1; });
      knoepfe.forEach(function (k, j) {
        var richtig = q.richtig.indexOf(j) !== -1;
        var gew = gewaehlt.indexOf(j) !== -1;
        k.disabled = true;
        if (richtig) { k.classList.add('ist-richtig'); }
        if (gew && !richtig) { k.classList.add('ist-falsch'); }
      });
      pruefen.hidden = true;
      erklaerung.hidden = false;
      erklaerung.appendChild(h('p', { class: 'lp-frage__urteil ' + (ok ? 'ist-gut' : 'ist-schlecht'), text: ok ? 'Richtig.' : 'Nicht ganz.' }));
      if (q.erklaerung) { erklaerung.appendChild(h('p', { class: 'lp-frage__text', text: q.erklaerung })); }
      if (HT.quiz && HT.quiz.erfassen) { HT.quiz.erfassen(q.id, ok); }
    }

    pruefen.addEventListener('click', pruefenJetzt);
    var liste = h('ol', { class: 'lp-frage__antworten' }, q.antworten.map(function (a, i) {
      var k = h('button', { type: 'button', class: 'lp-antwort', 'aria-pressed': 'false' }, [
        h('span', { class: 'lp-antwort__nr', text: String(i + 1) }),
        h('span', { class: 'lp-antwort__text', text: a })
      ]);
      k.addEventListener('click', function () { waehlen(i); });
      knoepfe.push(k);
      return h('li', {}, k);
    }));

    var folie = h('div', { class: 'lp-f lp-f--frage' }, [
      h('header', { class: 'lp-f__kopf' }, [
        h('p', { class: 'lp-f__marke', text: 'Kontrollfrage ' + e.nr + ' von ' + e.von + ' · ' + e.kapitel.titel }),
        q.situation ? h('p', { class: 'lp-frage__situation', text: q.situation }) : null,
        h('h2', { class: 'lp-f__titel lp-frage__frage', text: q.frage }),
        h('p', { class: 'lp-frage__hinweis', text: mehrere ? 'Mehrere Antworten sind richtig.' : 'Eine Antwort ist richtig.' })
      ]),
      liste,
      h('div', { class: 'lp-frage__fuss' }, [pruefen, erklaerung])
    ]);
    folie.frageTaste = function (taste) {
      var n = parseInt(taste, 10);
      if (n >= 1 && n <= knoepfe.length) { waehlen(n - 1); return true; }
      if (taste === 'Enter' && !geprueft && gewaehlt.length) { pruefenJetzt(); return true; }
      return false;
    };
    return folie;
  }

  function schlussFolie(ctx) {
    var kurs = ctx.kurs;
    var i = ctx.kurse.indexOf(kurs);
    var naechster = i >= 0 && i < ctx.kurse.length - 1 ? ctx.kurse[i + 1] : null;
    return h('div', { class: 'lp-f lp-f--deck lp-f--schluss' }, [
      h('div', { class: 'lp-deck__text' }, [
        h('p', { class: 'lp-f__marke', text: 'Lernpfad · ' + (kurs.titel || '') }),
        h('h1', { class: 'lp-deck__titel', text: 'Geschafft.' }),
        h('p', { class: 'lp-deck__kurz', text: 'Sie haben alle ' + anzahl((kurs.kapitel || []).length, 'Kapitel', 'Kapitel') + ' gesehen. '
          + (naechster ? 'Weiter geht es im ' + naechster.titel + ': ' + (naechster.kurz || '') + ' ' : '')
          + 'Festigen lässt sich der Stoff im Trainer: Zuordnen übt das Gesamtbild, Lernkarten die Begriffe, das Quiz die Prüfungsfragen.' }),
        h('div', { class: 'lp-deck__knoepfe' }, [
          naechster ? h('a', { class: 'btn btn--primaer', href: adresse(naechster, null, null, false), text: 'Zum ' + naechster.titel }) : null,
          h('a', { class: 'btn' + (naechster ? '' : ' btn--primaer'), href: '#/trainer', text: 'Zum Trainer' }),
          h('a', { class: 'btn', href: '#/trainer?teil=quiz', text: 'Quiz' }),
          (function () {
            var b = h('button', { type: 'button', class: 'btn', text: 'Zum Deckblatt' });
            b.addEventListener('click', function () { ctx.gehe(0); });
            return b;
          }())
        ])
      ])
    ]);
  }

  /* --- Deep Dive: Verknüpfungen aus den Daten ----------------------------- */

  /* Aufgaben kennen ihre Ergebnisse je Phase (ergebnisPhasen) und ihre
     Grundlagen; daraus entstehen der Lebenslauf eines Ergebnisses, der Weg
     einer Rolle durch die Phasen und die Karte eines Entscheids. */

  function aufgaben() { return HT.daten.eintraegeDerKategorie('aufgabe'); }

  /** «Projektleiter, Anwendervertreter» → zwei Rollen. */
  function rollenVon(text) { return String(text || '').split(/\s*,\s*/).filter(Boolean); }

  function verantwortet(eintrag, rolle) { return rollenVon(eintrag.verantwortlich).indexOf(rolle) !== -1; }

  function istEntscheid(a) { return /^Entscheid /.test(a.begriff); }

  function ohneTreffen(name) { return name.replace(/ treffen$/, ''); }

  /** Die Aufgaben, die ein Ergebnis erarbeiten, je mit den Phasen dafür. */
  function erarbeitung(name) {
    return aufgaben().filter(function (a) { return (a.ergebnisse || []).indexOf(name) !== -1; }).map(function (a) {
      var jePhase = a.ergebnisPhasen && a.ergebnisPhasen[name];
      return { aufgabe: a, phasen: (jePhase && jePhase.length) ? jePhase : (a.phasen || []) };
    });
  }

  /** Die Aufgaben, die ein Ergebnis als Grundlage nennen; Entscheide zuerst. */
  function grundlageFuer(name) {
    var liste = aufgaben().filter(function (a) { return (a.grundlagen || []).indexOf(name) !== -1; });
    return liste.filter(istEntscheid).concat(liste.filter(function (a) { return !istEntscheid(a); }));
  }

  var BAND = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss', 'Umsetzung'];

  /**
   * Das Phasenband wie im Handbuch: oben die fünf Phasen der klassischen
   * Vorgehensweise, darunter Umsetzung über Konzept bis Einführung.
   * `werte[phase]` = { stufe: 'erst' | 'an' | 'mit', text }.
   */
  function phasenBand(werte) {
    return h('ol', { class: 'lp-band' }, BAND.map(function (p, i) {
      var w = werte[p] || {};
      return h('li', { class: 'lp-band__phase lp-band__phase--' + i + (w.stufe ? ' ist-' + w.stufe : '') }, [
        h('span', { class: 'lp-band__name', text: p }),
        w.text ? h('span', { class: 'lp-band__text', text: w.text }) : null
      ]);
    }));
  }

  /** Eine Liste mit Deckel: die ersten `max` Namen, dann «+ n weitere». */
  function gedeckelt(namen, max) {
    if (namen.length <= max) { return namen; }
    return namen.slice(0, max).concat(['+ ' + (namen.length - max) + ' weitere']);
  }

  function faktTitel(text) { return h('p', { class: 'lp-fakten__titel', text: text }); }

  /* Aufgaben untereinander, Entscheide mit Raute; mehr als `max` werden
     zu «+ n weitere». */
  function aufgabenListe(liste, mitRolle, max) {
    max = max || 99;
    var zeilen = liste.slice(0, max).map(function (a) {
      return h('li', { class: istEntscheid(a) ? 'ist-entscheid' : null }, [
        h('span', { text: a.begriff }),
        mitRolle && a.verantwortlich ? h('span', { class: 'lp-aufgaben__rolle', text: a.verantwortlich }) : null
      ]);
    });
    if (liste.length > max) { zeilen.push(h('li', { class: 'lp-aufgaben__mehr', text: '+ ' + (liste.length - max) + ' weitere' })); }
    return h('ul', { class: 'lp-aufgaben' }, zeilen);
  }

  function kopfMitArt(e, art, zusatz, titel, pflicht) {
    return [
      kopfzeile(e, null),
      h('div', { class: 'lp-f__titelzeile' }, [
        h('p', { class: 'lp-f__art' }, [
          HT.ui.katSymbol(art, 18),
          h('span', { text: zusatz }),
          pflicht ? h('span', { class: 'lp-pflicht', text: pflicht }) : null
        ]),
        h('h2', { class: 'lp-f__titel lp-f__titel--gross', text: titel })
      ])
    ];
  }

  /* --- Deep Dive: Folientypen ---------------------------------------------- */

  function abschnittFolie(e) {
    var f = e.folie;
    return h('div', { class: 'lp-f lp-f--abschnitt' }, [
      h('p', { class: 'lp-f__marke', text: 'Kapitel ' + e.kapNr + ' · ' + e.kapitel.titel }),
      h('h1', { class: 'lp-abschnitt__titel', text: f.titel || '' }),
      f.kern ? h('p', { class: 'lp-abschnitt__kern', text: f.kern }) : null
    ]);
  }

  /* Lebenslauf eines Ergebnisses: in welchen Phasen es erarbeitet wird (das
     erste Mal kräftig), durch welche Aufgaben, und wofür es Grundlage ist. */
  function lebenslaufFolie(e, ctx) {
    var f = e.folie;
    var erg = HT.daten.eintragMitBegriff(f.name, 'ergebnis');
    var wege = erarbeitung(f.name);
    var an = {};
    wege.forEach(function (w) { w.phasen.forEach(function (p) { an[p] = true; }); });
    if (!wege.length && erg) { (erg.phasen || []).forEach(function (p) { an[p] = true; }); }
    var werte = {};
    Object.keys(an).forEach(function (p) { werte[p] = { stufe: 'an' }; });
    var erstK = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss'].filter(function (p) { return an[p]; })[0];
    if (erstK) { werte[erstK] = { stufe: 'erst', text: 'erstmals' }; }
    if (an.Umsetzung && !an.Initialisierung) { werte.Umsetzung = { stufe: 'erst', text: erstK === 'Konzept' || !erstK ? 'erstmals (agil)' : '' }; }
    var fuer = grundlageFuer(f.name);
    var typ = erg && erg.typ ? erg.typ : 'Ergebnis';
    var fakten = [];
    fakten.push(faktTitel('Erarbeitet in'));
    fakten.push(wege.length ? aufgabenListe(wege.map(function (w) { return w.aufgabe; }), true, 5)
      : h('p', { class: 'lp-fakten__leer', text: 'Keine Aufgabe nennt es als Ergebnis.' }));
    if (erg && erg.verantwortlich) {
      fakten.push(faktTitel('Verantwortlich für das Ergebnis'));
      fakten.push(chips(rollenVon(erg.verantwortlich)));
    }
    if (fuer.length) {
      fakten.push(faktTitel('Grundlage für'));
      var namen = fuer.map(function (a) { return a.begriff; });
      var liste = chips(gedeckelt(namen, 6));
      Array.prototype.forEach.call(liste.children, function (li, i) { if (fuer[i] && istEntscheid(fuer[i])) { li.classList.add('lp-chip--entscheid'); } });
      fakten.push(liste);
    }
    return h('div', { class: 'lp-f lp-f--lebenslauf' }, kopfMitArt(e, 'ergebnis', 'Ergebnis · ' + typ, f.titel || f.name,
      erg && erg.minimalGefordert ? 'minimal gefordert' : null).concat([
      phasenBand(werte),
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        h('aside', { class: 'lp-fakten' }, fakten)
      ]),
      ctx.fuss
    ]));
  }

  /* Alle Ergebnisse einiger Module, je Modul eine Spalte; minimal
     geforderte mit Punkt. */
  function ergebnislisteFolie(e, ctx) {
    var f = e.folie;
    var alle = HT.daten.eintraegeDerKategorie('ergebnis').filter(function (x) {
      return x.typ !== 'Meilenstein' && x.typ !== 'Checkliste';
    });
    var module = f.module || [];
    /* Die Leinwand hat Platz für vier Listenspalten zu etwa 12 Zeilen; ein
       langes Modul (Projektführung) bekommt mehrere davon. */
    var listen = module.map(function (m) { return { modul: m, liste: HT.daten.alphabetisch(mitModul(alle, m)) }; });
    var breiten = listen.map(function (l) { return Math.max(1, Math.ceil(l.liste.length / 12)); });
    var summe = breiten.reduce(function (a, b) { return a + b; }, 0);
    while (summe > 4 && Math.max.apply(null, breiten) > 1) {
      breiten[breiten.indexOf(Math.max.apply(null, breiten))]--;
      summe--;
    }
    return h('div', { class: 'lp-f lp-f--liste' }, [
      kopfzeile(e, f.titel || module.join(', ')),
      kernSatz(f.kern),
      h('div', { class: 'lp-spalten lp-spalten--listen', style: 'grid-template-columns:' + breiten.map(function (b) { return 'minmax(0,' + b + 'fr)'; }).join(' ') }, listen.map(function (l, i) {
        var m = l.modul, liste = l.liste;
        return h('section', { class: 'lp-spalte', style: '--listenspalten:' + breiten[i] }, [
          h('h3', { class: 'lp-spalte__titel' }, [h('span', { text: m }), h('span', { class: 'lp-spalte__zahl', text: String(liste.length) })]),
          h('ul', { class: 'lp-ergliste' }, liste.map(function (x) {
            return h('li', { class: x.minimalGefordert ? 'ist-minimal' : null, text: x.begriff });
          }))
        ]);
      })),
      h('p', { class: 'lp-ergliste__legende' }, [h('span', { class: 'lp-ergliste__punkt' }), 'minimal gefordert · ohne Checklisten und Meilensteine']),
      ctx.fuss
    ]);
  }

  function rollenZahlen(rolle) {
    var alle = aufgaben();
    var v = alle.filter(function (a) { return verantwortet(a, rolle); });
    var m = alle.filter(function (a) { return !verantwortet(a, rolle) && (a.beteiligt || []).indexOf(rolle) !== -1; });
    var erg = HT.daten.eintraegeDerKategorie('ergebnis').filter(function (x) { return verantwortet(x, rolle); });
    return { verantwortet: v, mit: m, ergebnisse: erg, entscheide: v.filter(istEntscheid) };
  }

  /* Weg einer Rolle: je Phase, wie viel sie verantwortet und wobei sie
     mitwirkt; daneben die Summen. */
  function rollenwegFolie(e, ctx) {
    var f = e.folie;
    var r = HT.daten.eintragMitBegriff(f.rolle, 'rolle');
    var z = rollenZahlen(f.rolle);
    var werte = {};
    BAND.forEach(function (p) {
      var v = mitPhase(z.verantwortet, p).length, m = mitPhase(z.mit, p).length, d = mitPhase(z.entscheide, p).length;
      if (!v && !m) { return; }
      werte[p] = {
        stufe: v ? 'an' : 'mit',
        text: (v ? v + ' verantw.' : '') + (v && m ? ' · ' : '') + (m ? m + ' mitwirkend' : '') + (d ? ' · ' + anzahl(d, 'Entscheid', 'Entscheide') : '')
      };
    });
    return h('div', { class: 'lp-f lp-f--rollenweg' }, kopfMitArt(e, 'rolle', 'Rolle' + (r && r.ebene ? ' · Ebene ' + r.ebene : ''), f.titel || f.rolle).concat([
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        h('aside', { class: 'lp-fakten' }, [
          h('div', { class: 'lp-fakten__zahlen' }, [
            zahl(z.verantwortet.length, 'Aufgaben', 'verantwortet'),
            zahl(z.mit.length, 'Aufgaben', 'wirkt mit'),
            zahl(z.ergebnisse.length, 'Ergebnisse', 'verantwortet'),
            zahl(z.entscheide.length, 'Entscheide', 'trifft sie')
          ])
        ])
      ]),
      phasenBand(werte),
      ctx.fuss
    ]));
  }

  /* Eine Rolle in einer Phase: was sie verantwortet, was dabei entsteht,
     wobei sie mitwirkt. */
  function rollenphaseFolie(e, ctx) {
    var f = e.folie;
    var z = rollenZahlen(f.rolle);
    var v = mitPhase(z.verantwortet, f.phase);
    var m = mitPhase(z.mit, f.phase);
    var liefert = [];
    v.forEach(function (a) {
      (a.ergebnisse || []).forEach(function (n) {
        var ph = (a.ergebnisPhasen && a.ergebnisPhasen[n]) || a.phasen || [];
        if (ph.indexOf(f.phase) !== -1 && liefert.indexOf(n) === -1) { liefert.push(n); }
      });
    });
    var werte = {};
    werte[f.phase] = { stufe: 'erst' };
    var fakten = [faktTitel('Verantwortet (' + v.length + ')')];
    fakten.push(v.length ? aufgabenListe(v, false, 6) : h('p', { class: 'lp-fakten__leer', text: 'Keine Aufgabe in dieser Phase.' }));
    if (liefert.length) {
      fakten.push(faktTitel('Dabei entstehen'));
      var ch = chips(gedeckelt(liefert, 6));
      Array.prototype.forEach.call(ch.children, function (li) { if (/^Meilenstein /.test(li.textContent)) { li.classList.add('lp-chip--entscheid'); } });
      fakten.push(ch);
    }
    if (m.length) {
      fakten.push(faktTitel('Wirkt mit bei (' + m.length + ')'));
      fakten.push(chips(gedeckelt(m.map(function (a) { return a.begriff; }), 4), 'lp-chips--leise'));
    }
    return h('div', { class: 'lp-f lp-f--rollenphase' }, kopfMitArt(e, 'rolle', f.rolle + ' · Phase ' + f.phase,
      f.titel || (f.rolle + ' in der ' + (f.phase === 'Abschluss' || f.phase === 'Initialisierung' ? 'Phase ' + f.phase : f.phase)))
      .concat([
        phasenBand(werte),
        h('div', { class: 'lp-f__koerper' }, [
          h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
          h('aside', { class: 'lp-fakten' }, fakten)
        ]),
        ctx.fuss
      ]));
  }

  function rolleFolie(e, ctx) {
    var f = e.folie;
    var r = HT.daten.eintragMitBegriff(f.rolle, 'rolle');
    var z = rollenZahlen(f.rolle);
    var fakten = [h('div', { class: 'lp-fakten__zahlen' }, [
      zahl(z.verantwortet.length, 'Aufgaben', 'verantwortet'),
      zahl(z.mit.length, 'Aufgaben', 'wirkt mit')
    ])];
    if (z.verantwortet.length) {
      fakten.push(faktTitel('Verantwortet'));
      fakten.push(chips(gedeckelt(z.verantwortet.map(function (a) { return a.begriff; }), 8)));
    }
    if (z.ergebnisse.length) {
      fakten.push(faktTitel('Ergebnisse'));
      fakten.push(chips(gedeckelt(z.ergebnisse.map(function (x) { return x.begriff; }), 8), 'lp-chips--leise'));
    }
    if (!z.verantwortet.length && !z.mit.length) {
      fakten.push(h('p', { class: 'lp-fakten__leer', text: 'In keiner Aufgabe als verantwortlich oder beteiligt genannt.' }));
    }
    if (z.mit.length && z.verantwortet.length < 3) {
      fakten.push(faktTitel('Wirkt mit bei'));
      fakten.push(chips(gedeckelt(z.mit.map(function (a) { return a.begriff; }), 8), 'lp-chips--leise'));
    }
    return h('div', { class: 'lp-f lp-f--rolle' }, kopfMitArt(e, 'rolle', 'Rolle' + (r && r.ebene ? ' · Ebene ' + r.ebene : ''), f.titel || f.rolle).concat([
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        h('aside', { class: 'lp-fakten' }, fakten)
      ]),
      ctx.fuss
    ]));
  }

  /* Ein Entscheid: wer entscheidet, wann, worauf gestützt, was folgt. */
  function entscheidFolie(e, ctx) {
    var f = e.folie;
    var a = HT.daten.eintragMitBegriff(f.name, 'aufgabe');
    var werte = {};
    ((a && a.phasen) || []).forEach(function (p) { werte[p] = { stufe: 'an' }; });
    var fakten = [];
    if (a) {
      var wer = rollenVon(a.verantwortlich);
      fakten.push(h('div', { class: 'lp-entscheid__wer' }, [
        h('span', { class: 'lp-fakten__titel', text: 'Entscheidet' }),
        h('span', { class: 'lp-entscheid__rolle', text: wer.join(', ') })
      ]));
      var beteiligt = (a.beteiligt || []).filter(function (b) { return wer.indexOf(b) === -1; });
      if (beteiligt.length) { fakten.push(faktTitel('Beteiligt')); fakten.push(chips(beteiligt, 'lp-chips--leise')); }
      if ((a.grundlagen || []).length) { fakten.push(faktTitel('Grundlagen')); fakten.push(chips(gedeckelt(a.grundlagen, 8))); }
      if ((a.ergebnisse || []).length) {
        fakten.push(faktTitel('Ergebnisse'));
        var ch = chips(a.ergebnisse);
        Array.prototype.forEach.call(ch.children, function (li) { if (/^(Meilenstein|Checkliste) /.test(li.textContent)) { li.classList.add('lp-chip--entscheid'); } });
        fakten.push(ch);
      }
    }
    var ebene = a && (a.module || []).indexOf('Projektsteuerung') !== -1 ? 'Steuerung' : 'Führung';
    return h('div', { class: 'lp-f lp-f--entscheid' }, kopfMitArt(e, 'meilenstein', 'Entscheid · ' + ebene
      + (a && (a.module || []).length ? ' · Modul ' + a.module.join(', ') : ''), f.titel || ohneTreffen(f.name)).concat([
      phasenBand(werte),
      h('div', { class: 'lp-f__koerper' }, [
        h('div', { class: 'lp-f__text' }, [kernSatz(f.kern), punkteListe(f.punkte)]),
        h('aside', { class: 'lp-fakten' }, fakten)
      ]),
      ctx.fuss
    ]));
  }

  var BAUER = {
    aussage: aussageFolie,
    bild: bildFolie,
    spalten: spaltenFolie,
    element: elementFolie,
    ebene: ebeneFolie,
    ergebnistypen: ergebnistypenFolie,
    abschnitt: abschnittFolie,
    lebenslauf: lebenslaufFolie,
    ergebnisliste: ergebnislisteFolie,
    rollenweg: rollenwegFolie,
    rollenphase: rollenphaseFolie,
    rolle: rolleFolie,
    entscheid: entscheidFolie,
    jePhase: jePhaseFolie
  };

  /* --- Notizen: der Wortlaut des Handbuchs --------------------------------- */

  function notizenFuellen(platz, e, texte) {
    HT.ui.leeren(platz);
    var quelle = e.folie && e.folie.quelle;
    var abschnitte = quelle ? abschnitteDer(quelle, texte) : [];
    if (!abschnitte.length) {
      platz.appendChild(h('p', { class: 'lp-notizen__leer', text: e.art === 'frage'
        ? 'Die Erklärung erscheint auf der Folie, sobald die Antwort geprüft ist.'
        : 'Zu dieser Folie gibt es keinen eigenen Handbuchtext.' }));
      return;
    }
    abschnitte.forEach(function (a) {
      platz.appendChild(h('h3', { class: 'lp-notizen__titel', text: (a.nummer ? a.nummer + ' ' : '') + (a.titel || '') }));
      if ((a.bloecke || []).length) {
        platz.appendChild(HT.ui.bloecke(a.bloecke, { verlinken: true, ebene: 4, seite: a.seite }));
      }
    });
  }

  /* --- Übersicht aller Folien --------------------------------------------- */

  function titelVon(e) {
    if (e.art === 'deckblatt') { return 'Deckblatt'; }
    if (e.art === 'schluss') { return 'Schluss'; }
    if (e.art === 'kapitel') { return e.kapitel.titel; }
    if (e.art === 'merke') { return 'Das nehmen Sie mit'; }
    if (e.art === 'frage') { return 'Kontrollfrage ' + e.nr; }
    var f = e.folie;
    if (f.titel) { return f.titel; }
    if (f.typ === 'rollenphase') { return f.rolle + ' · ' + f.phase; }
    if (f.typ === 'entscheid') { return ohneTreffen(f.name); }
    return f.name || f.rolle || (f.ebene ? 'Ebene ' + f.ebene : '') || (f.module || []).join(', ');
  }

  function rasterBauen(ctx) {
    var gruppen = [];
    ctx.folge.forEach(function (e) {
      if (!e.kapitel) { return; }
      if (e.nrImKapitel === 1) { gruppen.push({ kapitel: e.kapitel, nr: e.kapNr, folien: [] }); }
      gruppen[gruppen.length - 1].folien.push(e);
    });
    var schliessen = knopf('lp-raster__zu', 'Übersicht schliessen (Esc)', ICONS.schliessen, function () { ctx.raster(false); });
    return h('div', { class: 'lp-raster', role: 'dialog', 'aria-label': 'Alle Folien', hidden: true }, [
      h('div', { class: 'lp-raster__kopf' }, [h('h2', { text: 'Alle Folien' }), schliessen]),
      h('div', { class: 'lp-raster__inhalt' }, gruppen.map(function (g) {
        return h('section', { class: 'lp-raster__gruppe' }, [
          h('h3', { class: 'lp-raster__titel', text: g.nr + ' · ' + g.kapitel.titel }),
          h('ol', { class: 'lp-raster__liste' }, g.folien.map(function (e) {
            var b = h('button', { type: 'button', class: 'lp-raster__folie lp-raster__folie--' + e.art, dataset: { index: String(e.index) } }, [
              h('span', { class: 'lp-raster__nr', text: String(e.nrImKapitel) }),
              h('span', { class: 'lp-raster__text', text: titelVon(e) })
            ]);
            b.addEventListener('click', function () { ctx.raster(false); ctx.gehe(e.index); });
            return h('li', {}, b);
          }))
        ]);
      }))
    ]);
  }

  /* --- Leiste: Kapitel ---------------------------------------------------- */

  function anleitung() {
    return [
      h('h3', { class: 'gpop__abschnitt', text: 'Lernpfad' }),
      h('p', { text: 'Der Stoff des Referenzhandbuchs als Schulung, gezeigt wie eine Präsentation, in zwei Kursen. '
        + 'Der Grundkurs geht in sieben Kapiteln durch die Methode, eine Aussage pro Folie. Der Deep Dive vertieft aus drei '
        + 'Perspektiven: der Lebenslauf jedes Kernergebnisses, der Weg von Auftraggeber, Projektleiter und Anwendervertreter '
        + 'durch die Phasen, und die 17 Entscheide mit ihren Grundlagen. Jedes Kapitel endet mit einer Zusammenfassung und '
        + 'Kontrollfragen; den Kurs wechseln Sie rechts in dieser Leiste.' }),
      h('p', { text: 'Blättern mit den Pfeiltasten, der Leertaste, den Knöpfen unter der Folie oder durch Wischen. '
        + 'F schaltet das Vollbild ein und aus, N die Notizen, Ü (oder O) die Übersicht aller Folien.' }),
      h('p', { text: 'Die Folientexte sind von uns und knapp gehalten. Der geprüfte Wortlaut steht in den Notizen unter der '
        + 'Folie: dieselben Absätze, Abbildungen und Seitenzahlen wie im Handbuch. Kennzahlen, Phasenleisten und Listen '
        + '(welche Aufgabe ein Ergebnis erarbeitet, wofür es Grundlage ist, was eine Rolle in einer Phase verantwortet, '
        + 'worauf ein Entscheid sich stützt) sind aus unseren Daten erzeugt.' }),
      h('p', { text: 'Die Kontrollfragen stammen aus dem Quiz und zählen in dessen Verlauf.' }),
      h('p', { class: 'lp-hinweis', text: 'Entwurf: Die Seite ist noch nicht im Menü und noch nicht abgenommen.' })
    ];
  }

  /* Links die Kapitel des Kurses, rechts daneben die Wahl des Kurses —
     ein Knopfpaar wie Klassisch/Agil der Landkarte. */
  function leisteSetzen(kurse, kurs, aktiv) {
    var erster = kurs === kurse[0];
    HT.app.unterleiste({
      label: 'Kapitel',
      links: (kurs.kapitel || []).map(function (k, i) {
        return {
          href: adresse(kurs, k.id, 1, erster),
          text: k.kurztitel || k.titel.replace(/^Die /, ''),
          nr: String(i + 1),
          aktiv: k.id === aktiv
        };
      }),
      inhalt: kurse.length > 1 ? [h('div', { class: 'segment', role: 'group', 'aria-label': 'Kurs' }, kurse.map(function (k, i) {
        var b = h('button', { type: 'button', class: 'segment__knopf', text: k.kurztitel || k.titel, 'aria-pressed': k === kurs ? 'true' : 'false' });
        b.addEventListener('click', function () { if (k !== kurs) { global.location.hash = adresse(k, null, null, i === 0); } });
        return b;
      }))] : null,
      inhaltLabel: 'Kurs',
      info: { titel: 'Lernpfad', inhalt: anleitung }
    });
  }

  /* --- Präsentation -------------------------------------------------------- */

  function praesentation(behaelter, kurse, kurs, start) {
    var erster = kurs === kurse[0];
    var folge = folgeBauen(kurs);
    var jetzt = -1;
    var notizenOffen = gemerkt('notizen') === true;
    var aktivesKapitel = null;
    var aktuelleFolie = null;

    var folienPlatz = h('div', { class: 'lp-leinwand' });
    var buehne = h('div', { class: 'lp-buehne' }, folienPlatz);
    var notizenInhalt = h('div', { class: 'lp-notizen__inhalt' });
    var notizenKopf = h('p', { class: 'lp-notizen__kopf' });
    var notizen = h('section', { class: 'lp-notizen', 'aria-label': 'Handbuchtext zur Folie', hidden: !notizenOffen }, [notizenKopf, notizenInhalt]);

    var fortschritt = h('div', { class: 'lp-fortschritt', 'aria-hidden': 'true' });
    var zaehler = h('span', { class: 'lp-steuer__zaehler', 'aria-live': 'polite' });
    var zurueck = knopf('lp-steuer__knopf lp-steuer__knopf--pfeil', 'Zurück (←)', ICONS.zurueck, function () { gehe(jetzt - 1); });
    var weiter = knopf('lp-steuer__knopf lp-steuer__knopf--pfeil lp-steuer__knopf--weiter', 'Weiter (→)', ICONS.weiter, function () { gehe(jetzt + 1); });
    var notizKnopf = knopf('lp-steuer__knopf', 'Handbuchtext ein/aus (N)', ICONS.notizen, function () { notizenSchalten(); }, 'Handbuch');
    var rasterKnopf = knopf('lp-steuer__knopf', 'Alle Folien (Ü)', ICONS.raster, function () { rasterSchalten(); });
    var vollKnopf = knopf('lp-steuer__knopf', 'Vollbild (F)', ICONS.vollbild, function () { vollbild(); });

    var ctx = { kurs: kurs, kurse: kurse, erster: erster, folge: folge, gehe: gehe, raster: rasterSchalten };
    var raster = rasterBauen(ctx);

    var steuer = h('div', { class: 'lp-steuer' }, [
      h('div', { class: 'lp-steuer__links' }, [zurueck, zaehler]),
      fortschritt,
      h('div', { class: 'lp-steuer__rechts' }, [notizKnopf, rasterKnopf, vollKnopf, weiter])
    ]);
    var wurzel = h('div', { class: 'lp-praes' + (notizenOffen ? ' mit-notizen' : ''), tabindex: '-1' }, [buehne, steuer, notizen, raster]);
    behaelter.appendChild(wurzel);

    /* Segmente je Kapitel, breit nach ihrer Folienzahl; ein Klick springt an
       den Anfang des Kapitels. */
    var segmente = [];
    (kurs.kapitel || []).forEach(function (k) {
      var anfang = indexVon(folge, k.id, 1);
      var laenge = folge.filter(function (e) { return e.kapitel === k; }).length;
      var fuell = h('span', { class: 'lp-fortschritt__fuell' });
      var seg = h('button', { type: 'button', class: 'lp-fortschritt__seg', title: k.titel, style: 'flex-grow:' + laenge }, fuell);
      seg.addEventListener('click', function () { gehe(anfang); });
      segmente.push({ kapitel: k, anfang: anfang, laenge: laenge, fuell: fuell, seg: seg });
      fortschritt.appendChild(seg);
    });

    function fortschrittSetzen() {
      segmente.forEach(function (s) {
        var anteil = Math.max(0, Math.min(1, (jetzt - s.anfang + 1) / s.laenge));
        s.fuell.style.width = (anteil * 100) + '%';
        s.seg.classList.toggle('ist-aktiv', jetzt >= s.anfang && jetzt < s.anfang + s.laenge);
      });
    }

    /* Die Folie wird als Ganzes skaliert: quer 1280 × 720 Punkte, hochkant
       640 breit und so hoch wie das Verhältnis der Bühne (900 bis 1400),
       damit die Breite ganz genutzt wird. `streckung` macht die hohe
       Leinwand beim Einpassen länger. Gemessen ohne requestAnimationFrame,
       der im Hintergrundtab nicht läuft. */
    function setzen(streckung) {
      var b = buehne.clientWidth, hoehe = buehne.clientHeight;
      if (!b || !hoehe) { return false; }
      var hoch = (b / hoehe) < 0.9;
      var mass = hoch
        ? { b: HOCH.b, h: Math.round(Math.max(900, Math.min(1400, HOCH.b * hoehe / b)) * (streckung || 1)) }
        : { b: Math.round(QUER.b * (streckung || 1)), h: Math.round(QUER.h * (streckung || 1)) };
      folienPlatz.classList.toggle('ist-hoch', hoch);
      var s = Math.min(b / mass.b, hoehe / mass.h);
      folienPlatz.style.width = mass.b + 'px';
      folienPlatz.style.height = mass.h + 'px';
      folienPlatz.style.transform = 'translate(' + Math.round((b - mass.b * s) / 2) + 'px,' + Math.round((hoehe - mass.h * s) / 2) + 'px) scale(' + s + ')';
      return hoch;
    }

    /* Skalieren und einpassen: Passt der Inhalt nicht auf die Leinwand
       (lange Punkte neben einer Abbildung, neun Rollen), wird hochkant
       zuerst die Leinwand länger — alles wird gleichmässig kleiner —, dann
       die Schrift in zwei Stufen dichter; quer zuletzt die ganze Leinwand
       grösser. Gemessen in
       Punkten der Leinwand (scrollHeight), unabhängig vom Massstab. */
    function skalieren() {
      var folie = aktuelleFolie;
      if (!folie) { return; }
      var kaesten = [folie].concat(Array.prototype.slice.call(folie.querySelectorAll('.lp-f__koerper, .lp-f__text, .lp-fakten, .lp-frage__fuss, .lp-spalten, .lp-merke, .lp-balken')));
      function laeuftUeber() {
        return kaesten.some(function (k) { return k.scrollHeight > k.clientHeight + 1; });
      }
      folie.classList.remove('ist-dicht', 'ist-dichter');
      var hoch = setzen(1);
      if (!laeuftUeber()) { return; }
      if (hoch) {
        for (var st = 1.1; st <= 1.61; st += 0.1) {
          setzen(st);
          if (!laeuftUeber()) { return; }
        }
      }
      folie.classList.add('ist-dicht');
      if (!laeuftUeber()) { return; }
      folie.classList.add('ist-dichter');
      if (hoch || !laeuftUeber()) { return; }
      /* Quer als letzte Stufe: die ganze Leinwand grösser, also alles
         gleichmässig kleiner (bis ×1,4). */
      for (var sq = 1.1; sq <= 1.41; sq += 0.1) {
        setzen(sq);
        if (!laeuftUeber()) { return; }
      }
    }

    function gehe(i) {
      i = Math.max(0, Math.min(folge.length - 1, i));
      if (i === jetzt) { return; }
      var richtung = i > jetzt ? 'vor' : 'zurueck';
      jetzt = i;
      var e = folge[i];

      var texteWarten = kapitelTexte(e.folie ? e.folie.quelle : null);
      var nachLaden = [];
      var quelleZeile = h('span', {});
      var c = {
        kurs: kurs, folge: folge, gehe: gehe,
        fuss: h('footer', { class: 'lp-f__fuss' }, quelleZeile),
        nachLaden: function (f) { nachLaden.push(f); }
      };
      var folie;
      if (e.art === 'deckblatt') { folie = deckblatt(ctx); }
      else if (e.art === 'schluss') { folie = schlussFolie(ctx); }
      else if (e.art === 'kapitel') { folie = kapitelFolie(e); }
      else if (e.art === 'merke') { folie = merkeFolie(e); }
      else if (e.art === 'frage') { folie = frageFolie(e, c); }
      else {
        var bauer = BAUER[e.folie.typ] || aussageFolie;
        folie = bauer(e, c);
      }
      folie.classList.add('ist-neu', 'ist-' + richtung);
      HT.ui.leeren(folienPlatz);
      folienPlatz.appendChild(folie);
      aktuelleFolie = folie;
      skalieren();

      zaehler.textContent = e.kapitel
        ? e.kapitel.titel + ' · ' + e.nrImKapitel + ' / ' + e.vonImKapitel
        : (e.art === 'deckblatt' ? 'Deckblatt' : 'Schluss');
      zurueck.disabled = i === 0;
      weiter.disabled = i === folge.length - 1;
      fortschrittSetzen();

      notizenKopf.textContent = 'Handbuch';
      HT.ui.leeren(notizenInhalt);
      notizenInhalt.appendChild(h('p', { class: 'lp-notizen__leer', text: 'Wird geladen …' }));
      texteWarten.then(function (texte) {
        if (jetzt !== i) { return; }
        var q = e.folie ? quellText(e.folie, texte) : '';
        quelleZeile.textContent = q ? q + '  ·  N für den Wortlaut' : '';
        notizenKopf.textContent = q || 'Handbuch';
        notizenFuellen(notizenInhalt, e, texte);
        notizenInhalt.scrollTop = 0;
        nachLaden.forEach(function (f) { f(texte); });
      });

      var neuesKapitel = e.kapitel ? e.kapitel.id : null;
      if (neuesKapitel !== aktivesKapitel) {
        aktivesKapitel = neuesKapitel;
        leisteSetzen(kurse, kurs, neuesKapitel);
      }
      if (e.kapitel) { stelleMerken(kurs, e.kapitel.id, e.nrImKapitel); }
      try { global.history.replaceState(null, '', adresseVon(e, erster)); } catch (err) { /* egal */ }
    }

    function notizenSchalten(an) {
      notizenOffen = typeof an === 'boolean' ? an : !notizenOffen;
      notizen.hidden = !notizenOffen;
      wurzel.classList.toggle('mit-notizen', notizenOffen);
      notizKnopf.setAttribute('aria-pressed', notizenOffen ? 'true' : 'false');
      merken({ notizen: notizenOffen });
      skalieren();
    }

    function rasterSchalten(an) {
      var offen = typeof an === 'boolean' ? an : raster.hidden;
      raster.hidden = !offen;
      rasterKnopf.setAttribute('aria-pressed', offen ? 'true' : 'false');
      if (offen) {
        var aktiv = raster.querySelector('[data-index="' + jetzt + '"]');
        Array.prototype.forEach.call(raster.querySelectorAll('.lp-raster__folie'), function (b) {
          b.classList.toggle('ist-aktiv', b === aktiv);
        });
        if (aktiv) { aktiv.focus({ preventScroll: false }); }
      } else {
        wurzel.focus({ preventScroll: true });
      }
    }

    function imVollbild() { return document.fullscreenElement === wurzel || document.webkitFullscreenElement === wurzel; }

    /* Lehnt der Browser das Vollbild ab (iPhone, eingebettete Seiten),
       legt sich die Präsentation über das ganze Fenster: gleicher Zustand,
       gleicher Knopf, Esc beendet ihn. */
    var ersatz = false;

    function ersatzSetzen(an) {
      ersatz = an;
      wurzel.classList.toggle('ist-ersatzvollbild', an);
      document.body.classList.toggle('lp-ersatzvollbild', an);
      vollbildGewechselt();
    }

    function vollbild() {
      if (ersatz) { ersatzSetzen(false); return; }
      if (imVollbild()) {
        try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (err) { /* egal */ }
        return;
      }
      var anfrage = wurzel.requestFullscreen || wurzel.webkitRequestFullscreen;
      if (!anfrage) { ersatzSetzen(true); return; }
      try {
        var p = anfrage.call(wurzel);
        if (p && p.catch) { p.catch(function () { ersatzSetzen(true); }); }
      } catch (err) { ersatzSetzen(true); }
    }

    function vollbildGewechselt() {
      var an = imVollbild() || ersatz;
      wurzel.classList.toggle('ist-vollbild', an);
      HT.ui.leeren(vollKnopf);
      vollKnopf.appendChild(HT.ui.symbol(an ? ICONS.fenster : ICONS.vollbild, 20));
      vollKnopf.title = an ? 'Vollbild verlassen (F)' : 'Vollbild (F)';
      vollKnopf.setAttribute('aria-label', vollKnopf.title);
      skalieren();
    }

    /* Tasten gelten, solange die Präsentation in der Seite steht; danach
       meldet sich der Zuhörer selbst ab. In Feldern und auf Knöpfen bleiben
       Leertaste und Eingabe beim Element. */
    function taste(ev) {
      if (!document.body.contains(wurzel)) { aufraeumen(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
      if (document.querySelector('dialog[open]')) { return; }   // Willkommen u. a. haben die Tasten
      var ziel = ev.target;
      var tag = ziel && ziel.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ziel && ziel.isContentEditable)) { return; }
      if (ziel && ziel.closest && ziel.closest('[data-kopf]')) { return; }
      var aufKnopf = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
      var k = ev.key;
      if (!raster.hidden) {
        if (k === 'Escape' || k === 'ü' || k === 'Ü' || k === 'o' || k === 'O') { ev.preventDefault(); rasterSchalten(false); }
        return;
      }
      if (aktuelleFolie && aktuelleFolie.frageTaste && !aufKnopf && aktuelleFolie.frageTaste(k)) { ev.preventDefault(); return; }
      if (k === 'Escape' && ersatz) { ev.preventDefault(); ersatzSetzen(false); return; }
      if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !aufKnopf)) { ev.preventDefault(); gehe(jetzt + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); gehe(jetzt - 1); }
      else if (k === 'Home') { ev.preventDefault(); gehe(0); }
      else if (k === 'End') { ev.preventDefault(); gehe(folge.length - 1); }
      else if (k === 'f' || k === 'F') { ev.preventDefault(); vollbild(); }
      else if (k === 'n' || k === 'N') { ev.preventDefault(); notizenSchalten(); }
      else if (k === 'ü' || k === 'Ü' || k === 'o' || k === 'O') { ev.preventDefault(); rasterSchalten(true); }
    }

    /* Wischen auf dem Telefon: waagrecht mehr als 50 px und mehr als senkrecht. */
    var wischStart = null;
    buehne.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse') { return; }
      wischStart = { x: ev.clientX, y: ev.clientY };
    });
    buehne.addEventListener('pointerup', function (ev) {
      if (!wischStart) { return; }
      var dx = ev.clientX - wischStart.x, dy = ev.clientY - wischStart.y;
      wischStart = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { gehe(jetzt + (dx < 0 ? 1 : -1)); }
    });
    buehne.addEventListener('pointercancel', function () { wischStart = null; });

    function groesse() {
      if (!document.body.contains(wurzel)) { aufraeumen(); return; }
      skalieren();
    }

    function aufraeumen() {
      document.body.classList.remove('lp-ersatzvollbild');
      document.removeEventListener('keydown', taste);
      global.removeEventListener('resize', groesse);
      document.removeEventListener('fullscreenchange', vollbildGewechselt);
      document.removeEventListener('webkitfullscreenchange', vollbildGewechselt);
    }

    document.addEventListener('keydown', taste);
    global.addEventListener('resize', groesse);
    document.addEventListener('fullscreenchange', vollbildGewechselt);
    document.addEventListener('webkitfullscreenchange', vollbildGewechselt);
    notizKnopf.setAttribute('aria-pressed', notizenOffen ? 'true' : 'false');

    gehe(start(folge));
    try { wurzel.focus({ preventScroll: true }); } catch (err) { wurzel.focus(); }
  }

  /* --- Ansicht ------------------------------------------------------------ */

  function render(behaelter, params) {
    params = params || {};
    var warten = h('p', { class: 'trefferzahl', role: 'status', text: 'Lernpfad wird geladen …' });
    behaelter.appendChild(warten);

    inhalte().then(function (daten) {
      if (!document.body.contains(warten)) { return; }
      HT.ui.leeren(behaelter);
      var kurse = kurseVon(daten);
      if (!kurse.length) {
        behaelter.appendChild(HT.ui.leerZustand('Lernpfad nicht verfügbar',
          'Die Datei ' + DATEI + ' konnte nicht geladen werden.'));
        return;
      }
      var kurs = kurse.filter(function (k) { return k.id === params.kurs; })[0] || kurse[0];
      leisteSetzen(kurse, kurs, null);
      praesentation(behaelter, kurse, kurs, function (folge) {
        if (params.folie === 'ende') { return folge.length - 1; }
        if (params.kapitel) { return indexVon(folge, String(params.kapitel), parseInt(params.folie, 10) || 1); }
        return 0;
      });
    });
  }

  HT.views.lernpfad = { titel: 'Lernpfad', render: render };
}(window));
