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
   dazu Folien mit einer Karte, aufgebaut wie das Gesamtbild (Phasen als
   Zeilen, Module als Spalten, seit 2026-09-23): karte (die ganze Karte des
   Kapitels), abschnitt (näher an eine Gruppe, ohne Karte eine Trennfolie),
   lebenslauf und entscheid (näher an einen Kasten), rollenweg und rolle
   (die Karte einer Rolle), rollenphase (näher an eine Phase der Rolle);
   dazu ergebnisliste (alle Ergebnisse einiger Module). Zwischen Folien derselben Karte schwenkt die Ansicht.
   Die Fakten kommen aus aufgaben.ergebnisse/ergebnisPhasen/grundlagen; die
   `punkte` dieser Folien stehen in den Notizen, nicht auf der Folie.

   Der geprüfte Wortlaut steht nicht auf der Folie, sondern in der
   Notizenleiste darunter (Taste N): die Handbuchabschnitte aus `quelle`,
   gezeichnet mit HT.ui.bloecke wie im Handbuch. Später der Platz für Ton
   und Video. Die Abschnittsnummern im Fuss der Folie, die Titel in den
   Notizen und jeder andere Link auf #/handbuch öffnen das Handbuch im
   Fenster über der Folie (HT.handbuch.imFenster, Taste H), damit man
   nachschlägt, ohne den Lernpfad zu verlassen.

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
    schliessen: ['M6 6l12 12', 'M18 6 6 18'],
    lupe: ['M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z', 'M15.3 15.3 20 20', 'M10.5 7.5v6', 'M7.5 10.5h6'],
    kleiner: ['M6 12h12'],
    groesser: ['M6 12h12', 'M12 6v12'],
    einpassen: ['M4 9V4h5', 'M15 4h5v5', 'M20 15v5h-5', 'M9 20H4v-5']
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

  /** Die Abschnitte der Quelle in ihrer Reihenfolge, je mit `kapitel` (id). */
  function abschnitteDer(quelle, texte) {
    var aus = [];
    (quelle || []).forEach(function (q) {
      var kap = texte[q.kapitel];
      var nach = {};
      ((kap && kap.abschnitte) || []).forEach(function (a) { if (a.nummer) { nach[a.nummer] = a; } });
      (q.abschnitte || []).forEach(function (n) {
        if (nach[n]) { aus.push({ kapitel: q.kapitel, nummer: n, seite: nach[n].seite, titel: nach[n].titel, bloecke: nach[n].bloecke }); }
      });
    });
    return aus;
  }

  /* Links ins Handbuch öffnen es im Fenster über der Folie
     (HT.handbuch.imFenster) — so bleibt man im Lernpfad. */
  function handbuchLink(a, text, klasse) {
    return h('a', {
      class: klasse, href: HT.handbuch.adresse(a.kapitel, a.nummer), text: text,
      title: 'Abschnitt ' + a.nummer + ' im Handbuch nachlesen'
    });
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

  function seitenText(abschnitte) {
    /* Von der kleinsten bis zur grössten Seite — die Quelle nennt die
       Abschnitte in der Folge der Folie, nicht des Handbuchs. */
    var seiten = abschnitte.map(function (a) { return a.seite; }).filter(Boolean);
    if (!seiten.length) { return ''; }
    var von = Math.min.apply(null, seiten), bis = Math.max.apply(null, seiten);
    return ' · S. ' + von + (bis !== von ? '–' + bis : '');
  }

  function quellText(folie, texte) {
    var abschnitte = abschnitteDer(folie.quelle, texte);
    if (!abschnitte.length) { return ''; }
    return 'Handbuch ' + abschnitte.map(function (a) { return a.nummer; }).join(', ') + seitenText(abschnitte);
  }

  /* Die Quelle im Fuss der Folie: jede Abschnittsnummer ein Link ins Handbuch. */
  function quellZeile(platz, folie, texte, hinweis) {
    HT.ui.leeren(platz);
    var abschnitte = abschnitteDer(folie.quelle, texte);
    if (!abschnitte.length) { return; }
    platz.appendChild(document.createTextNode('Handbuch '));
    abschnitte.forEach(function (a, i) {
      if (i) { platz.appendChild(document.createTextNode(', ')); }
      platz.appendChild(handbuchLink(a, a.nummer, 'lp-f__quelle'));
    });
    platz.appendChild(document.createTextNode(seitenText(abschnitte) + hinweis));
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

  /* Abbildungen auf der Folie bekommen eine Lupe (ausser das schmale
     Phasenband über Elementfolien): Das Gesamtbild (Abbildung 1) ist auf
     einem Laptop in der Folie nicht lesbar (Sponsor, 2026-09-24). Ein Klick
     auf das Bild oder das Lupen-Icon neben der Bildunterschrift öffnet es
     gross (lupeOeffnen). */
  function bildEinsetzen(platz, block, ohneLupe) {
    HT.ui.leeren(platz);
    if (!block || !block.datei) { platz.classList.add('ist-leer'); return; }
    var alt = block.text || 'Abbildung aus dem HERMES-Referenzhandbuch';
    var bild = h('img', { src: block.datei, alt: alt });
    platz.appendChild(bild);
    var knopf = null;
    if (!ohneLupe) {
      bild.classList.add('ist-zoombar');
      bild.addEventListener('click', function () { lupeOeffnen(block, knopf); });
      knopf = h('button', { type: 'button', class: 'lp-f__lupe', title: 'Abbildung vergrössern', 'aria-label': 'Abbildung vergrössern' },
        HT.ui.symbol(ICONS.lupe, 22));
      knopf.addEventListener('click', function () { lupeOeffnen(block, knopf); });
    }
    if (block.text || knopf) {
      platz.appendChild(h('p', { class: 'lp-f__bildtext' }, [knopf, block.text ? h('span', { text: block.text }) : null]));
    }
  }

  /* --- Lupe: eine Abbildung gross ------------------------------------------ */

  /* Ein modaler Dialog über der Präsentation (auch im Vollbild, Top Layer),
     die Folientasten ruhen solange. Die Abbildung steht zuerst eingepasst,
     dann näher mit +/− (Knöpfe, Tasten + − 0), mit dem Mausrad bei
     gedrückter Strg-/Cmd-Taste oder der Trackpad-Geste; gerollt wird mit
     Rad, Balken oder Ziehen. Stufen relativ zum Einpassen, 1 bis 8. */
  function lupeOeffnen(block, vorher) {
    var stufe = 1;
    var bild = h('img', { class: 'lp-lupe__bild', src: block.datei, alt: block.text || 'Abbildung', draggable: 'false' });
    var flaeche = h('div', { class: 'lp-lupe__flaeche' }, bild);
    var anzeige = h('span', { class: 'lp-lupe__stufe', 'aria-live': 'polite' });
    function kn(titel, pfade, fn) {
      var b = h('button', { type: 'button', class: 'lp-lupe__knopf', title: titel, 'aria-label': titel }, HT.ui.symbol(pfade, 20));
      b.addEventListener('click', fn);
      return b;
    }
    var dialog = h('dialog', { class: 'lp-lupe', 'aria-label': block.text || 'Abbildung' }, [
      h('div', { class: 'lp-lupe__kopf' }, [
        h('p', { class: 'lp-lupe__titel', text: block.text || 'Abbildung' }),
        h('div', { class: 'lp-lupe__steuer' }, [
          kn('Kleiner (−)', ICONS.kleiner, function () { zoomen(stufe / 1.5); }),
          anzeige,
          kn('Grösser (+)', ICONS.groesser, function () { zoomen(stufe * 1.5); }),
          kn('Einpassen (0)', ICONS.einpassen, function () { zoomen(1); }),
          kn('Schliessen (Esc)', ICONS.schliessen, function () { dialog.close(); })
        ])
      ]),
      flaeche
    ]);

    /* Breite der eingepassten Abbildung in px. */
    function passend() {
      var nb = bild.naturalWidth || 1000, nh = bild.naturalHeight || 700;
      return nb * Math.min((flaeche.clientWidth - 32) / nb, (flaeche.clientHeight - 32) / nh);
    }

    /* Zoomen um einen Punkt der Fläche (Standard: die Mitte): er bleibt,
       wo er ist. */
    function zoomen(neu, px, py) {
      neu = Math.max(1, Math.min(8, neu));
      var r = flaeche.getBoundingClientRect();
      var ax = px === undefined ? flaeche.clientWidth / 2 : px - r.left;
      var ay = py === undefined ? flaeche.clientHeight / 2 : py - r.top;
      var br = bild.getBoundingClientRect();
      var relX = (ax + r.left - br.left) / (br.width || 1), relY = (ay + r.top - br.top) / (br.height || 1);
      stufe = neu;
      bild.style.width = Math.round(passend() * stufe) + 'px';
      flaeche.classList.toggle('ist-gezoomt', stufe > 1);
      var nb = bild.getBoundingClientRect();
      flaeche.scrollLeft += (nb.left + relX * nb.width) - (ax + r.left);
      flaeche.scrollTop += (nb.top + relY * nb.height) - (ay + r.top);
      anzeige.textContent = Math.round(stufe * 100) + ' %';
    }

    flaeche.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey && !ev.metaKey) { return; }   // ohne Taste: rollen
      ev.preventDefault();
      zoomen(stufe * Math.exp(-ev.deltaY * 0.01), ev.clientX, ev.clientY);
    }, { passive: false });

    /* Ziehen verschiebt; ein Klick ohne Ziehen geht eine Stufe näher. */
    var zug = null;
    flaeche.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) { return; }
      zug = { x: ev.clientX, y: ev.clientY, l: flaeche.scrollLeft, t: flaeche.scrollTop, bewegt: false, id: ev.pointerId };
    });
    flaeche.addEventListener('pointermove', function (ev) {
      if (!zug || ev.pointerId !== zug.id) { return; }
      var dx = ev.clientX - zug.x, dy = ev.clientY - zug.y;
      if (!zug.bewegt && Math.abs(dx) + Math.abs(dy) > 4) {
        zug.bewegt = true;
        try { flaeche.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
        flaeche.classList.add('ist-gezogen');
      }
      if (zug.bewegt) { flaeche.scrollLeft = zug.l - dx; flaeche.scrollTop = zug.t - dy; }
    });
    function loslassen(ev) {
      if (!zug) { return; }
      var klick = !zug.bewegt && ev.type === 'pointerup' && ev.target === bild && ev.pointerType === 'mouse';
      zug = null;
      flaeche.classList.remove('ist-gezogen');
      if (klick) { zoomen(stufe < 8 ? stufe * 1.5 : 1, ev.clientX, ev.clientY); }
    }
    flaeche.addEventListener('pointerup', loslassen);
    flaeche.addEventListener('pointercancel', loslassen);

    dialog.addEventListener('keydown', function (ev) {
      ev.stopPropagation();   // die Folie dahinter blättert nicht
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoomen(stufe * 1.5); }
      else if (ev.key === '-') { ev.preventDefault(); zoomen(stufe / 1.5); }
      else if (ev.key === '0') { ev.preventDefault(); zoomen(1); }
    });
    dialog.addEventListener('click', function (ev) { if (ev.target === dialog) { dialog.close(); } });
    function neuEinpassen() { zoomen(stufe); }
    global.addEventListener('resize', neuEinpassen);
    dialog.addEventListener('close', function () {
      global.removeEventListener('resize', neuEinpassen);
      dialog.remove();
      if (vorher && document.body.contains(vorher)) { try { vorher.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    function start() { zoomen(1); }
    if (bild.complete && bild.naturalWidth) { start(); } else { bild.addEventListener('load', start); }
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
          h('kbd', { text: 'F' }), ' Vollbild  ', h('kbd', { text: 'N' }), ' Handbuchtext  ', h('kbd', { text: 'H' }), ' Handbuch'
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
    if (platz) { ctx.nachLaden(function (texte) { bildEinsetzen(platz, bildSuchen(f, texte), true); }); }
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
          h('p', { class: 'lp-fakten__links' }, [
            h('a', { class: 'lp-fakten__link', href: '#/handbuch?id=' + encodeURIComponent(eintrag.id), text: 'Im Handbuch nachlesen' }),
            h('a', { class: 'lp-fakten__link', href: '#/ueberblick?id=' + encodeURIComponent(eintrag.id), text: 'Im Überblick ansehen' })
          ])
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

  /** Eine Liste mit Deckel: die ersten `max` Namen, dann «+ n weitere». */
  function gedeckelt(namen, max) {
    if (namen.length <= max) { return namen; }
    return namen.slice(0, max).concat(['+ ' + (namen.length - max) + ' weitere']);
  }

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

  /* --- Deep Dive: die Karte ------------------------------------------------
     Aufgebaut wie das Gesamtbild (Abbildung 1): die Phasen als Zeilen, die
     Module als Spalten in der Folge der Abbildung; Projektgrundlagen liegt in
     der Initialisierung über Organisation bis IT-System. Jedes Ergebnis (im
     Kapitel Entscheide: jeder Entscheid) steht einmal als Kasten dort, wo es
     erstmals entsteht — Phase und Modul der erarbeitenden Aufgabe, wie in
     HT.graph.bloecke. Ein kleines Band im Kasten zeigt seinen Lebenslauf:
     die Phasen, in denen es entsteht oder nachgeführt wird, darunter eine
     Linie für die agile Umsetzung. Übersichtsfolien zeigen die ganze Karte,
     die Folien danach gehen auf einen Abschnitt, einen Kasten oder eine Phase
     näher heran. Zwischen zwei Folien derselben Karte schwenkt die Ansicht
     vom alten zum neuen Ausschnitt (letzteKarte). */

  var SPALTE = 104;          // Spaltenabstand, in Punkten der Karte
  var KASTEN_B = 96;
  var KASTEN_H = 42;
  var TAKT = 47;             // senkrechter Abstand zweier Kästen
  var POLSTER = 10;          // oben und unten in einer Phasenzeile
  var GRUNDLAGEN_KOPF = 18;  // Kopf «Projektgrundlagen» über seiner Spanne
  var UNTER_AB = 4;          // mehr Kästen in einer Zelle: Unterspalten
  var UNTEN = 30;            // Platz der Legende unten im Fenster
  var KLASSISCH = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss'];
  /* Zeilen der Karte: die agile Umsetzung nur, wenn ein Kasten erst dort
     entsteht (Releasebericht). */
  var REIHEN = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss'];
  var MODULSPALTEN = ['Projektsteuerung', 'Projektführung', 'Organisation', 'Produkt', 'IT-System',
    'Beschaffung', 'Tests', 'Einführungsorganisation', 'IT-Migration', 'IT-Betrieb', 'ISDS'];
  var GRUNDLAGEN = { modul: 'Projektgrundlagen', von: 'Organisation', bis: 'IT-System' };
  var PHASE_KURZ = { Initialisierung: 'Init.', Konzept: 'Konz.', Realisierung: 'Real.', 'Einführung': 'Einf.', Umsetzung: 'Agil', Abschluss: 'Abschl.' };
  var ZOOM_KASTEN = 2;
  var ZOOM_MAX = 1.6;        // Abschnitt, Phase, kleine Karten
  var letzteKarte = null;    // { schluessel, t: { x, y, s }, b, h }
  var kartenJeKapitel = typeof WeakMap === 'function' ? new WeakMap() : null;
  var feldEintraege = null;

  /** Wo entsteht was: je Phase, Modul, Aufgabe und Ergebnis ein Eintrag,
      für beide Vorgehensweisen, aus den Feldern des Graphen. */
  function felder() {
    if (feldEintraege) { return feldEintraege; }
    var aus = [], gesehen = {};
    ['klassisch', 'agil'].forEach(function (v) {
      HT.graph.phasenDerVorgehensweise(v).forEach(function (p) {
        MODULSPALTEN.concat([GRUNDLAGEN.modul]).forEach(function (m) {
          HT.graph.bloecke({ vorgehen: v, phasen: [p], module: [m] }, true).forEach(function (b) {
            b.ergebnisse.forEach(function (k) {
              var schl = p + '|' + m + '|' + b.aufgabe.begriff + '|' + k.begriff;
              if (gesehen[schl]) { return; }
              gesehen[schl] = true;
              aus.push({ phase: p, modul: m, aufgabe: b.aufgabe.begriff, ergebnis: k.begriff });
            });
          });
        });
      });
    });
    feldEintraege = aus;
    return aus;
  }

  function ergebnisArt(name) {
    if (/^Meilenstein /.test(name)) { return 'meilenstein'; }
    var erg = HT.daten.eintragMitBegriff(name, 'ergebnis');
    return erg && erg.typ === 'Zustand' ? 'zustand' : 'dokument';
  }

  /** Spaltenrang eines Moduls; Projektgrundlagen steht vor Organisation. */
  function modulRang(m) {
    return m === GRUNDLAGEN.modul ? MODULSPALTEN.indexOf(GRUNDLAGEN.von) - 0.5 : MODULSPALTEN.indexOf(m);
  }

  /**
   * Ein Kasten aus den Feldeinträgen, die ihn betreffen: alle Phasen, dazu
   * Zeile (erste klassische Phase, sonst Umsetzung) und Modul (in dieser
   * Zeile das erste in der Folge der Spalten).
   */
  function kastenAus(name, text, art, eintraege, mit) {
    var phasen = [];
    eintraege.forEach(function (x) { if (phasen.indexOf(x.phase) === -1) { phasen.push(x.phase); } });
    var reihe = KLASSISCH.filter(function (p) { return phasen.indexOf(p) !== -1; })[0]
      || (phasen.indexOf('Umsetzung') !== -1 ? 'Umsetzung' : null);
    if (!reihe) { return null; }
    var module = eintraege.filter(function (x) { return x.phase === reihe; }).map(function (x) { return x.modul; })
      .filter(function (m) { return modulRang(m) > -1; })
      .sort(function (a, b) { return modulRang(a) - modulRang(b); });
    if (!module.length) { return null; }
    return { name: name, text: text, art: art, phasen: phasen, reihe: reihe, modul: module[0], mit: !!mit };
  }

  function ergebnisKasten(name) {
    return kastenAus(name, ohnePraefix(name), ergebnisArt(name),
      felder().filter(function (x) { return x.ergebnis === name; }));
  }

  function entscheidKasten(name) {
    return kastenAus(name, ohneTreffen(name).replace(/^Entscheid /, ''), 'meilenstein',
      felder().filter(function (x) { return x.aufgabe === name; }));
  }

  /**
   * Legt die Kästen ins Gitter: Zeilen nach REIHEN, Spalten nach
   * MODULSPALTEN (leere fallen weg). Kästen von Projektgrundlagen verteilen
   * sich auf die Spalten Organisation bis
   * IT-System; in einer Zelle stehen die Kästen in der gegebenen Reihenfolge
   * untereinander.
   */
  function karteBauen(schluessel, gruppen, mit) {
    var kaesten = [];
    gruppen = gruppen.filter(function (g) { return g.kaesten.length; });
    gruppen.forEach(function (g, gi) {
      g.kaesten.forEach(function (k) { k.gruppe = gi; k.index = kaesten.length; kaesten.push(k); });
    });
    if (!kaesten.length) { return null; }
    var mitGrundlagen = kaesten.some(function (k) { return k.modul === GRUNDLAGEN.modul; });
    var spalten = MODULSPALTEN.filter(function (m, i) {
      if (mitGrundlagen && i >= MODULSPALTEN.indexOf(GRUNDLAGEN.von) && i <= MODULSPALTEN.indexOf(GRUNDLAGEN.bis)) { return true; }
      return kaesten.some(function (k) { return k.modul === m; });
    });
    /* Wie im Gesamtbild stehen alle klassischen Phasen da, auch leere; die
       agile Umsetzung nur, wenn ein Kasten erst dort entsteht. */
    var reihen = REIHEN.filter(function (p) {
      return p !== 'Umsetzung' || kaesten.some(function (k) { return k.reihe === p; });
    });
    /* Plätze je Zeile und Spalte zählen; Projektgrundlagen nimmt jeweils die
       freieste Spalte seiner Spanne. */
    var belegt = {};
    reihen.forEach(function (p) { belegt[p] = spalten.map(function () { return 0; }); });
    var spanne = spalten.filter(function (m) {
      return MODULSPALTEN.indexOf(m) >= MODULSPALTEN.indexOf(GRUNDLAGEN.von) && MODULSPALTEN.indexOf(m) <= MODULSPALTEN.indexOf(GRUNDLAGEN.bis);
    }).map(function (m) { return spalten.indexOf(m); });
    kaesten.filter(function (k) { return k.modul === GRUNDLAGEN.modul; }).forEach(function (k) {
      var z = belegt[k.reihe];
      var sp = spanne.slice().sort(function (a, b) { return z[a] - z[b] || a - b; })[0];
      k.spalte = sp; k.platz = z[sp]++;
    });
    kaesten.filter(function (k) { return k.modul !== GRUNDLAGEN.modul; }).forEach(function (k) {
      var sp = spalten.indexOf(k.modul);
      k.spalte = sp; k.platz = belegt[k.reihe][sp]++;
    });
    /* In einer Zeile mit Projektgrundlagen steht über der Spanne ein Kopf,
       wie der Modulkopf im Gesamtbild; die Spalten darunter rücken nach. */
    var versatz = function (p, sp) {
      return spanne.indexOf(sp) !== -1 && kaesten.some(function (k) { return k.reihe === p && k.modul === GRUNDLAGEN.modul; })
        ? GRUNDLAGEN_KOPF : 0;
    };
    /* Eine volle Spalte wird breiter statt höher: ab mehr als UNTER_AB
       Kästen in einer Zelle bekommt sie Unterspalten (höchstens drei), wie
       die Projektführung im Gesamtbild. */
    var breit = spalten.map(function (m, sp) {
      var n = Math.max.apply(null, reihen.map(function (p) { return belegt[p][sp]; }));
      return Math.max(1, Math.min(3, Math.ceil(n / UNTER_AB)));
    });
    var x = 0;
    var spaltenMass = breit.map(function (u) { var m = { x: x, b: u * SPALTE, unter: u }; x += m.b; return m; });
    var y = 0, koepfe = [];
    var zeilen = reihen.map(function (p) {
      var hoch = Math.max.apply(null, belegt[p].map(function (n, sp) { return Math.ceil(n / breit[sp]) * TAKT + versatz(p, sp); }));
      var z = { phase: p, y: y, h: Math.max(POLSTER * 2 + hoch - (TAKT - KASTEN_H), 64) };
      if (versatz(p, spanne[0])) {
        var erste = spaltenMass[spanne[0]], letzte = spaltenMass[spanne[spanne.length - 1]];
        koepfe.push({ x: erste.x + (SPALTE - KASTEN_B) / 2, y: y + POLSTER - 3, b: letzte.x + letzte.b - erste.x - (SPALTE - KASTEN_B) });
      }
      y += z.h;
      return z;
    });
    kaesten.forEach(function (k) {
      var z = zeilen[reihen.indexOf(k.reihe)];
      var m = spaltenMass[k.spalte];
      k.x = m.x + (k.platz % m.unter) * SPALTE + (SPALTE - KASTEN_B) / 2;
      k.y = z.y + POLSTER + Math.floor(k.platz / m.unter) * TAKT + versatz(k.reihe, k.spalte);
    });
    return {
      schluessel: schluessel, gruppen: gruppen, kaesten: kaesten, spalten: spalten, spaltenMass: spaltenMass,
      zeilen: zeilen, koepfe: koepfe, b: x, h: y, mit: !!mit
    };
  }

  /** Die Karte eines Kapitels: seine Lebensläufe bzw. Entscheide, gruppiert
      nach den Abschnittsfolien davor. */
  function kapitelKarte(kapitel) {
    if (kartenJeKapitel && kartenJeKapitel.has(kapitel)) { return kartenJeKapitel.get(kapitel); }
    var gruppen = [], aktuelle = null;
    (kapitel.folien || []).forEach(function (f) {
      if (f.typ === 'abschnitt') { aktuelle = { titel: f.titel, folie: f, kaesten: [] }; gruppen.push(aktuelle); return; }
      var k = f.typ === 'lebenslauf' ? ergebnisKasten(f.name) : (f.typ === 'entscheid' ? entscheidKasten(f.name) : null);
      if (!k) { return; }
      if (!aktuelle) { aktuelle = { titel: '', kaesten: [] }; gruppen.push(aktuelle); }
      aktuelle.kaesten.push(k);
    });
    var karte = karteBauen('kapitel:' + kapitel.id, gruppen);
    if (kartenJeKapitel) { kartenJeKapitel.set(kapitel, karte); }
    return karte;
  }

  var ARTFOLGE = { dokument: 0, zustand: 1, meilenstein: 2 };

  /** Die Karte einer Rolle: die Ergebnisse der Aufgaben, die sie
      verantwortet (ohne Checklisten). Verantwortet sie keine, die Ergebnisse
      der Aufgaben, an denen sie mitwirkt — grau. */
  function rolleKarte(rolle) {
    function sammeln(passt) {
      var nach = {}, namen = [];
      felder().forEach(function (x) {
        if (/^Checkliste /.test(x.ergebnis)) { return; }
        var a = HT.daten.eintragMitBegriff(x.aufgabe, 'aufgabe');
        if (!a || !passt(a)) { return; }
        if (!nach[x.ergebnis]) { nach[x.ergebnis] = []; namen.push(x.ergebnis); }
        nach[x.ergebnis].push(x);
      });
      return namen.map(function (n) { return { name: n, eintraege: nach[n] }; });
    }
    var liste = sammeln(function (a) { return verantwortet(a, rolle); });
    var mit = !liste.length;
    if (mit) { liste = sammeln(function (a) { return (a.beteiligt || []).indexOf(rolle) !== -1; }); }
    var kaesten = liste.map(function (l) { return kastenAus(l.name, ohnePraefix(l.name), ergebnisArt(l.name), l.eintraege, mit); })
      .filter(Boolean)
      .sort(function (a, b) { return (ARTFOLGE[a.art] - ARTFOLGE[b.art]) || a.text.localeCompare(b.text, 'de'); });
    return karteBauen('rolle:' + rolle, [{ titel: rolle, kaesten: kaesten }], mit);
  }

  /** Die Ergebnisse, die aus einem Ergebnis hervorgehen: Ergebnisse der
      Aufgaben, die es als Grundlage nennen. */
  function nachfolger(name) {
    var aus = [];
    grundlageFuer(name).forEach(function (a) {
      (a.ergebnisse || []).forEach(function (n) { if (n !== name && aus.indexOf(n) === -1) { aus.push(n); } });
    });
    return aus;
  }

  function kastenAktivIn(k, phase) { return k.phasen.indexOf(phase) !== -1; }

  function trennen(text) {
    return HT.gesamtbild && HT.gesamtbild.trennen ? HT.gesamtbild.trennen(text) : text;
  }

  /* Zeichnen: Zeilenbänder der Phasen, Spaltenlinien der Module, dann die
     Kästen mit Name und Band. `ziel` bestimmt, was hell bleibt. */
  function karteZeichnen(karte, ziel) {
    var flaeche = h('div', {
      class: 'lp-karte__flaeche' + (ziel.art === 'phase' ? ' zeigt-phase' : ''),
      style: 'width:' + karte.b + 'px;height:' + karte.h + 'px',
      dataset: ziel.art === 'phase' ? { phase: String(KLASSISCH.indexOf(ziel.phase)) } : {}
    });
    karte.zeilen.forEach(function (z, i) {
      flaeche.appendChild(h('div', {
        class: 'lp-karte__zeile' + (i % 2 ? ' ist-ungerade' : '') + (z.phase === 'Umsetzung' ? ' ist-agil' : '')
          + (ziel.art === 'phase' && ziel.phase === z.phase ? ' ist-fokus' : ''),
        style: 'top:' + z.y + 'px;height:' + z.h + 'px'
      }));
    });
    karte.spaltenMass.forEach(function (m, i) {
      if (i) { flaeche.appendChild(h('div', { class: 'lp-karte__spalte', style: 'left:' + m.x + 'px' })); }
    });
    karte.koepfe.forEach(function (k) {
      flaeche.appendChild(h('div', { class: 'lp-karte__kopf', style: 'left:' + k.x + 'px;top:' + k.y + 'px;width:' + k.b + 'px', text: GRUNDLAGEN.modul }));
    });
    var nachher = ziel.art === 'kasten' ? nachfolger(karte.kaesten[ziel.index].name) : [];
    karte.kaesten.forEach(function (k) {
      var fokus = ziel.art === 'kasten' && k.index === ziel.index;
      var folgt = nachher.indexOf(k.name) !== -1;
      var hell = ziel.art === 'alles' || fokus || folgt
        || (ziel.art === 'gruppe' && k.gruppe === ziel.index)
        || (ziel.art === 'phase' && kastenAktivIn(k, ziel.phase));
      var band = h('span', { class: 'lp-kk__band', 'aria-hidden': 'true' }, KLASSISCH.map(function (p, i) {
        var an = kastenAktivIn(k, p);
        return h('i', { class: an ? (p === k.reihe ? 'ist-erst' : 'ist-an') : null });
      }).concat([kastenAktivIn(k, 'Umsetzung') ? h('b', { class: 'lp-kk__agil' + (k.reihe === 'Umsetzung' ? ' ist-erst' : '') }) : null]));
      flaeche.appendChild(h('div', {
        class: 'lp-kk lp-kk--' + k.art + (k.mit ? ' ist-mit' : '') + (fokus ? ' ist-fokus' : '') + (folgt ? ' ist-nachher' : '')
          + (hell ? '' : ' ist-gedimmt')
          + (ziel.art === 'phase' && k.reihe === ziel.phase ? ' ist-neu-hier' : ''),
        style: 'left:' + k.x + 'px;top:' + k.y + 'px;width:' + KASTEN_B + 'px;height:' + KASTEN_H + 'px',
        title: k.text
      }, [h('span', { class: 'lp-kk__name', text: trennen(k.text) }), band]));
    });
    return flaeche;
  }

  /* Die Lineale: oben die Module, links die Phasen — in der Grösse und Lage,
     in der die Karte sie gerade zeigt. */
  function linealeBauen(karte, ziel) {
    var oben = karte.spalten.map(function (m) {
      var fokus = ziel.art === 'kasten' && karte.kaesten[ziel.index].modul === m;
      return h('span', { class: 'lp-lineal__modul' + (fokus ? ' ist-an' : ''), text: trennen(m) });
    });
    var links = karte.zeilen.map(function (z) {
      var fokus = (ziel.art === 'phase' && ziel.phase === z.phase) || (ziel.art === 'kasten' && karte.kaesten[ziel.index].reihe === z.phase);
      return h('span', { class: 'lp-lineal__phase' + (fokus ? ' ist-an' : '') + (z.phase === 'Umsetzung' ? ' ist-agil' : ''),
        text: z.phase === 'Umsetzung' ? 'Umsetzung (agil)' : z.phase });
    });
    return {
      oben: h('div', { class: 'lp-lineal lp-lineal--oben', 'aria-hidden': 'true' }, oben),
      links: h('div', { class: 'lp-lineal lp-lineal--links', 'aria-hidden': 'true' }, links),
      setzen: function (t) {
        oben.forEach(function (el, i) {
          var m = karte.spaltenMass[i];
          el.style.left = (t.x + m.x * t.s).toFixed(1) + 'px';
          el.style.width = (m.b * t.s).toFixed(1) + 'px';
        });
        links.forEach(function (el, i) {
          var z = karte.zeilen[i];
          var lang = z.phase === 'Umsetzung' ? 'Umsetzung (agil)' : z.phase;
          el.style.top = (t.y + z.y * t.s).toFixed(1) + 'px';
          el.style.height = (z.h * t.s).toFixed(1) + 'px';
          /* Passt der Name nicht in die Höhe der Zeile, die Kurzform. */
          el.textContent = z.h * t.s >= lang.length * 8.2 + 14 ? lang : PHASE_KURZ[z.phase];
        });
      }
    };
  }

  function klemmen(wert, min, max) { return min > max ? (min + max) / 2 : Math.max(min, Math.min(max, wert)); }

  /** Massstab und Verschiebung, damit `ziel` im Fenster (b × h) steht. */
  function zielTransform(karte, ziel, b, h) {
    var rand = 14;
    h -= UNTEN;
    var passt = Math.min((b - 2 * rand) / karte.b, (h - 2 * rand) / karte.h);
    var s = Math.min(passt, ZOOM_MAX), cx = karte.b / 2, cy = karte.h / 2;
    function bereich(liste) {
      var r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      liste.forEach(function (k) {
        r.x0 = Math.min(r.x0, k.x); r.x1 = Math.max(r.x1, k.x + KASTEN_B);
        r.y0 = Math.min(r.y0, k.y); r.y1 = Math.max(r.y1, k.y + KASTEN_H);
      });
      return liste.length ? r : null;
    }
    function aufBereich(r, max) {
      if (!r) { return; }
      s = klemmen(Math.min((b - 2 * rand) / (r.x1 - r.x0 + SPALTE), (h - 2 * rand) / (r.y1 - r.y0 + 2 * POLSTER)), passt, max);
      cx = (r.x0 + r.x1) / 2; cy = (r.y0 + r.y1) / 2;
    }
    if (ziel.art === 'kasten') {
      var k = karte.kaesten[ziel.index];
      s = Math.max(passt, ZOOM_KASTEN);
      cx = k.x + KASTEN_B / 2; cy = k.y + KASTEN_H / 2;
    } else if (ziel.art === 'gruppe') {
      aufBereich(bereich(karte.kaesten.filter(function (k) { return k.gruppe === ziel.index; })), ZOOM_MAX);
    } else if (ziel.art === 'phase') {
      aufBereich(bereich(karte.kaesten.filter(function (k) { return kastenAktivIn(k, ziel.phase); })), ZOOM_MAX);
    }
    var t = { s: s, x: b / 2 - cx * s, y: h / 2 - cy * s };
    t.x = klemmen(t.x, b - karte.b * s - rand, rand);
    t.y = klemmen(t.y, h - karte.h * s - rand, rand);
    return t;
  }

  function bewegungArm() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * Eine Folie mit Karte: links (hochkant oben) das Fenster auf die Karte
   * mit den Linealen, rechts die Tafel mit Titel, Kernsatz und Fakten.
   * Übersichten (`ueberblick`: die ganze Karte) haben eine schmalere Tafel.
   * `folie.karte.zeigen(vorher)` richtet die Karte aus — mit `vorher`
   * (letzteKarte vor dem Blättern) schwenkt sie von dort, ohne springt sie.
   */
  function karteFolie(opt) {
    var karte = opt.karte, ziel = opt.ziel;
    var fenster = h('div', { class: 'lp-karte__fenster' });
    var flaeche = karteZeichnen(karte, ziel);
    fenster.appendChild(flaeche);
    var lineale = linealeBauen(karte, ziel);
    var meilensteine = karte.kaesten.some(function (k) { return k.art === 'meilenstein'; });
    var legende = h('p', { class: 'lp-karte__legende' + (karte.mit ? ' ist-mit' : '') }, [
      h('span', { class: 'lp-leg lp-leg--band' }, KLASSISCH.map(function (p, i) { return h('i', { class: i === 0 ? 'ist-erst' : (i < 3 ? 'ist-an' : null) }); })),
      karte.mit ? 'Phasen, in denen es entsteht (wirkt mit)' : 'Phasen, in denen es entsteht — kräftig: erstmals',
      h('span', { class: 'lp-leg lp-leg--agil' }), 'agil in der Umsetzung',
      meilensteine ? h('span', { class: 'lp-leg lp-leg--raute' }) : null,
      meilensteine ? 'Meilenstein' : null,
      opt.legende ? h('span', { class: 'lp-leg lp-leg--nachher' }) : null,
      opt.legende || null
    ]);
    var kasten = h('div', { class: 'lp-karte' }, [
      h('span', { class: 'lp-karte__ecke' }), lineale.oben, lineale.links, fenster, legende
    ]);
    var tafel = h('div', { class: 'lp-tafel' }, opt.tafel);
    var folie = h('div', { class: 'lp-f lp-f--karte' + (opt.ueberblick ? ' ist-ueberblick' : '') }, [kasten, tafel, opt.fuss]);

    function anwenden(t) {
      flaeche.style.transform = 'translate(' + t.x.toFixed(1) + 'px,' + t.y.toFixed(1) + 'px) scale(' + t.s.toFixed(4) + ')';
      lineale.setzen(t);
    }

    folie.punkteInNotizen = true;
    folie.karte = {
      zeigen: function (vorher) {
        var b = fenster.clientWidth, hoehe = fenster.clientHeight;
        if (!b || !hoehe) { return; }
        var t = zielTransform(karte, ziel, b, hoehe);
        var start = null;
        if (vorher !== undefined && !bewegungArm()) {
          start = vorher && vorher.schluessel === karte.schluessel && vorher.b === b && vorher.h === hoehe
            ? vorher.t : zielTransform(karte, { art: 'alles' }, b, hoehe);
        }
        kasten.classList.add('ohne-uebergang');
        anwenden(start || t);
        void flaeche.offsetWidth;   // Startlage festschreiben, dann gleiten
        kasten.classList.remove('ohne-uebergang');
        if (start) { anwenden(t); }
        letzteKarte = { schluessel: karte.schluessel, t: t, b: b, h: hoehe };
      }
    };
    return folie;
  }

  function tafelMarke(text, pflicht) {
    return h('p', { class: 'lp-tafel__marke' }, [h('span', { text: text }), pflicht ? h('span', { class: 'lp-pflicht', text: pflicht }) : null]);
  }

  function tafelTitel(text) { return h('h2', { class: 'lp-tafel__titel', text: text }); }

  function tafelKern(text) { return text ? h('p', { class: 'lp-tafel__kern', text: text }) : null; }

  function tafelFakt(titel, inhalt) {
    return inhalt ? h('div', { class: 'lp-tafel__fakt' }, [h('p', { class: 'lp-fakten__titel', text: titel }), inhalt]) : null;
  }

  function entscheideMarkieren(liste, aufgabenListe) {
    Array.prototype.forEach.call(liste.children, function (li, i) {
      if ((aufgabenListe && aufgabenListe[i] && istEntscheid(aufgabenListe[i])) || /^(Meilenstein|Entscheid) /.test(li.textContent)) {
        li.classList.add('lp-chip--entscheid');
      }
    });
    return liste;
  }

  function kleineZahlen(werte) {
    return h('div', { class: 'lp-tafel__zahlen' }, werte.filter(Boolean).map(function (w) {
      return h('div', { class: 'lp-tafel__zahl' }, [h('span', { class: 'lp-tafel__wert', text: String(w[0]) }), h('span', { text: w[1] })]);
    }));
  }

  /* --- Deep Dive: Folientypen ---------------------------------------------- */

  /* Übersicht: die ganze Karte des Kapitels. */
  function karteUeberblickFolie(e, ctx) {
    var f = e.folie;
    var karte = kapitelKarte(e.kapitel);
    if (!karte) { return aussageFolie(e, ctx); }
    return karteFolie({
      karte: karte, ziel: { art: 'alles' }, ueberblick: true, fuss: ctx.fuss,
      tafel: [
        h('div', { class: 'lp-tafel__kopf' }, [tafelMarke('Kapitel ' + e.kapNr + ' · ' + e.kapitel.titel), tafelTitel(f.titel || 'Übersicht')]),
        tafelKern(f.kern)
      ]
    });
  }

  /* Abschnitt: im Kapitel mit Karte ein Zoom auf seine Gruppe, sonst eine
     Trennfolie. */
  function abschnittFolie(e, ctx) {
    var f = e.folie;
    var karte = e.kapitel ? kapitelKarte(e.kapitel) : null;
    var gi = -1;
    if (karte) { karte.gruppen.forEach(function (g, i) { if (g.folie === f) { gi = i; } }); }
    if (gi === -1) {
      return h('div', { class: 'lp-f lp-f--abschnitt' }, [
        h('p', { class: 'lp-f__marke', text: 'Kapitel ' + e.kapNr + ' · ' + e.kapitel.titel }),
        h('h1', { class: 'lp-abschnitt__titel', text: f.titel || '' }),
        f.kern ? h('p', { class: 'lp-abschnitt__kern', text: f.kern }) : null
      ]);
    }
    var g = karte.gruppen[gi];
    var entscheide = g.kaesten.every(function (z) { return z.art === 'meilenstein'; });
    return karteFolie({
      karte: karte, ziel: { art: 'gruppe', index: gi }, fuss: ctx.fuss,
      tafel: [
        tafelMarke('Abschnitt ' + (gi + 1) + ' von ' + karte.gruppen.length),
        tafelTitel(f.titel || ''),
        tafelKern(f.kern),
        kleineZahlen([[g.kaesten.length, entscheide ? (g.kaesten.length === 1 ? 'Entscheid' : 'Entscheide') : (g.kaesten.length === 1 ? 'Kernergebnis' : 'Kernergebnisse')]])
      ]
    });
  }

  /* Lebenslauf eines Ergebnisses: die Karte zoomt auf seine Zeile; umrandet
     die Kernergebnisse, die darauf aufbauen. Die Tafel nennt, wer es
     verantwortet, wo es erarbeitet wird und wofür es Grundlage ist. */
  function lebenslaufFolie(e, ctx) {
    var f = e.folie;
    var karte = kapitelKarte(e.kapitel);
    var i = -1;
    karte.kaesten.forEach(function (z, j) { if (z.name === f.name) { i = j; } });
    var erg = HT.daten.eintragMitBegriff(f.name, 'ergebnis');
    var wege = erarbeitung(f.name);
    var fuer = grundlageFuer(f.name);
    var darauf = nachfolger(f.name).filter(function (n) { return karte.kaesten.some(function (z) { return z.name === n; }); });
    return karteFolie({
      karte: karte, ziel: { art: 'kasten', index: i }, fuss: ctx.fuss,
      legende: darauf.length ? 'baut darauf auf' : null,
      tafel: [
        tafelMarke('Kernergebnis ' + (i + 1) + ' von ' + karte.kaesten.length + ' · ' + (erg && erg.typ ? erg.typ : 'Ergebnis'),
          erg && erg.minimalGefordert ? 'minimal gefordert' : null),
        tafelTitel(f.titel || f.name),
        tafelKern(f.kern),
        erg && erg.verantwortlich ? tafelFakt('Verantwortlich', chips(rollenVon(erg.verantwortlich))) : null,
        tafelFakt('Erarbeitet in', wege.length ? aufgabenListe(wege.map(function (w) { return w.aufgabe; }), false, 3)
          : h('p', { class: 'lp-fakten__leer', text: 'Keine Aufgabe nennt es als Ergebnis.' })),
        fuer.length ? tafelFakt('Grundlage für', entscheideMarkieren(chips(gedeckelt(fuer.map(function (a) { return a.begriff; }), 3)), fuer)) : null
      ]
    });
  }

  function rollenZahlen(rolle) {
    var alle = aufgaben();
    var v = alle.filter(function (a) { return verantwortet(a, rolle); });
    var m = alle.filter(function (a) { return !verantwortet(a, rolle) && (a.beteiligt || []).indexOf(rolle) !== -1; });
    var erg = HT.daten.eintraegeDerKategorie('ergebnis').filter(function (x) { return verantwortet(x, rolle); });
    return { verantwortet: v, mit: m, ergebnisse: erg, entscheide: v.filter(istEntscheid) };
  }

  /* Weg einer Rolle: alle Ergebnisse ihrer Aufgaben über die ganze Methode;
     die Folien danach zoomen je auf eine Phase. */
  function rollenwegFolie(e, ctx) {
    var f = e.folie;
    var r = HT.daten.eintragMitBegriff(f.rolle, 'rolle');
    var z = rollenZahlen(f.rolle);
    var karte = rolleKarte(f.rolle);
    return karteFolie({
      karte: karte, ziel: { art: 'alles' }, ueberblick: true, fuss: ctx.fuss,
      tafel: [
        h('div', { class: 'lp-tafel__kopf' }, [
          tafelMarke('Rolle' + (r && r.ebene ? ' · Ebene ' + r.ebene : '')),
          tafelTitel(f.titel || f.rolle)
        ]),
        tafelKern(f.kern),
        kleineZahlen([
          [z.verantwortet.length, 'Aufgaben verantwortet'],
          [z.mit.length, 'Aufgaben wirkt mit'],
          [karte ? karte.kaesten.filter(function (x) { return x.art !== 'meilenstein'; }).length : 0, 'Ergebnisse'],
          [z.entscheide.length, z.entscheide.length === 1 ? 'Entscheid' : 'Entscheide']
        ])
      ]
    });
  }

  /* Eine Rolle in einer Phase: die Karte der Rolle zoomt auf die Phase. */
  function rollenphaseFolie(e, ctx) {
    var f = e.folie;
    var z = rollenZahlen(f.rolle);
    var v = mitPhase(z.verantwortet, f.phase);
    var m = mitPhase(z.mit, f.phase);
    var d = v.filter(istEntscheid);
    var karte = rolleKarte(f.rolle);
    var entstehen = karte ? karte.kaesten.filter(function (x) { return x.phasen.indexOf(f.phase) !== -1 && x.art !== 'meilenstein'; }).length : 0;
    var tafel = [
      tafelMarke(f.rolle + ' · Phase ' + f.phase),
      tafelTitel(f.titel || (f.rolle + ' in der ' + (f.phase === 'Abschluss' || f.phase === 'Initialisierung' ? 'Phase ' + f.phase : f.phase))),
      tafelKern(f.kern),
      kleineZahlen([[v.length, v.length === 1 ? 'Aufgabe' : 'Aufgaben'], [entstehen, entstehen === 1 ? 'Ergebnis' : 'Ergebnisse'], [d.length, d.length === 1 ? 'Entscheid' : 'Entscheide']]),
      tafelFakt('Verantwortet', v.length ? aufgabenListe(v, false, 5) : h('p', { class: 'lp-fakten__leer', text: 'Keine Aufgabe in dieser Phase.' })),
      m.length ? h('p', { class: 'lp-tafel__zusatz', text: 'Wirkt mit bei ' + anzahl(m.length, 'weiteren Aufgabe', 'weiteren Aufgaben') + '.' }) : null
    ];
    if (!karte) { return karteLosFolie(e, ctx, 'lp-f--rollenphase', tafel); }
    return karteFolie({ karte: karte, ziel: { art: 'phase', phase: f.phase }, fuss: ctx.fuss, tafel: tafel });
  }

  /* Ohne Karte (eine Rolle ohne Aufgaben): nur die Tafel, breit, und die
     Punkte stehen wieder auf der Folie. */
  function karteLosFolie(e, ctx, klasse, tafel) {
    return h('div', { class: 'lp-f lp-f--karte ist-ohne-karte ' + klasse }, [
      h('div', { class: 'lp-tafel' }, tafel.concat([punkteListe(e.folie.punkte)])),
      ctx.fuss
    ]);
  }

  /* Die übrigen Rollen: ihre Karte als Ganzes. */
  function rolleFolie(e, ctx) {
    var f = e.folie;
    var r = HT.daten.eintragMitBegriff(f.rolle, 'rolle');
    var z = rollenZahlen(f.rolle);
    var karte = rolleKarte(f.rolle);
    var kopf = h('div', { class: 'lp-tafel__kopf' }, [
      tafelMarke('Rolle' + (r && r.ebene ? ' · Ebene ' + r.ebene : '')),
      tafelTitel(f.titel || f.rolle)
    ]);
    var zahlen = kleineZahlen([[z.verantwortet.length, 'Aufgaben verantwortet'], [z.mit.length, 'wirkt mit']]);
    if (!karte) {
      return karteLosFolie(e, ctx, 'lp-f--rolle', [kopf, tafelKern(f.kern), zahlen,
        h('p', { class: 'lp-fakten__leer', text: 'In keiner Aufgabe als verantwortlich oder beteiligt genannt.' })]);
    }
    return karteFolie({ karte: karte, ziel: { art: 'alles' }, ueberblick: true, fuss: ctx.fuss, tafel: [kopf, tafelKern(f.kern), zahlen] });
  }

  /* Ein Entscheid: die Karte der Entscheide zoomt auf seine Zeile; die
     Tafel nennt, wer entscheidet, worauf gestützt und was folgt. */
  function entscheidFolie(e, ctx) {
    var f = e.folie;
    var a = HT.daten.eintragMitBegriff(f.name, 'aufgabe');
    var karte = kapitelKarte(e.kapitel);
    var i = -1;
    karte.kaesten.forEach(function (z, j) { if (z.name === f.name) { i = j; } });
    /* Die Ebene nach dem Entscheider: der Auftraggeber steuert (auch bei
       Ausschreibung und Zuschlag aus dem Modul Beschaffung). */
    var ebene = a && verantwortet(a, 'Auftraggeber') ? 'Steuerung' : 'Führung';
    var tafel = [
      tafelMarke('Entscheid ' + (i + 1) + ' von ' + karte.kaesten.length + ' · ' + ebene),
      tafelTitel(f.titel || ohneTreffen(f.name)),
      tafelKern(f.kern)
    ];
    if (a) {
      var wer = rollenVon(a.verantwortlich);
      tafel.push(h('div', { class: 'lp-entscheid__wer' }, [
        h('span', { class: 'lp-fakten__titel', text: 'Entscheidet' }),
        h('span', { class: 'lp-entscheid__rolle', text: wer.join(', ') })
      ]));
      if ((a.grundlagen || []).length) { tafel.push(tafelFakt('Gestützt auf', chips(gedeckelt(a.grundlagen, 5)))); }
      var folgt = (a.ergebnisse || []).filter(function (n) { return /^Meilenstein /.test(n); });
      if (folgt.length) { tafel.push(tafelFakt('Danach erreicht', entscheideMarkieren(chips(folgt)))); }
    }
    return karteFolie({ karte: karte, ziel: { art: 'kasten', index: i }, fuss: ctx.fuss, tafel: tafel });
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

  var BAUER = {
    aussage: aussageFolie,
    bild: bildFolie,
    spalten: spaltenFolie,
    element: elementFolie,
    ebene: ebeneFolie,
    ergebnistypen: ergebnistypenFolie,
    abschnitt: abschnittFolie,
    karte: karteUeberblickFolie,
    lebenslauf: lebenslaufFolie,
    ergebnisliste: ergebnislisteFolie,
    rollenweg: rollenwegFolie,
    rollenphase: rollenphaseFolie,
    rolle: rolleFolie,
    entscheid: entscheidFolie,
    jePhase: jePhaseFolie
  };

  /* --- Notizen: der Wortlaut des Handbuchs --------------------------------- */

  /* Auf Folien mit Karte stehen die Punkte nicht auf der Folie, sondern
     hier, vor dem Wortlaut. */
  function notizenFuellen(platz, e, texte, mitPunkten) {
    HT.ui.leeren(platz);
    var quelle = e.folie && e.folie.quelle;
    var abschnitte = quelle ? abschnitteDer(quelle, texte) : [];
    var punkte = mitPunkten && e.folie ? (e.folie.punkte || []) : [];
    if (punkte.length) {
      platz.appendChild(h('h3', { class: 'lp-notizen__titel', text: 'Zur Folie' }));
      platz.appendChild(h('ul', { class: 'lp-notizen__punkte' }, punkte.map(function (p) { return h('li', { text: p }); })));
    }
    if (!abschnitte.length) {
      if (punkte.length) { return; }
      platz.appendChild(h('p', { class: 'lp-notizen__leer', text: e.art === 'frage'
        ? 'Die Erklärung erscheint auf der Folie, sobald die Antwort geprüft ist.'
        : 'Zu dieser Folie gibt es keinen eigenen Handbuchtext.' }));
      return;
    }
    abschnitte.forEach(function (a) {
      platz.appendChild(h('h3', { class: 'lp-notizen__titel' },
        handbuchLink(a, a.nummer + ' ' + (a.titel || ''), 'lp-notizen__link')));
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
        + 'Perspektiven — Ergebnisse, Rollen, Entscheide — auf einer Karte, aufgebaut wie das Gesamtbild: Phasen als Zeilen, '
        + 'Module als Spalten. Jedes Kapitel und jede Hauptrolle beginnt mit der ganzen Karte, die Folien danach gehen näher '
        + 'heran — auf einen Abschnitt, ein Ergebnis oder eine Phase. Jedes Kapitel endet mit einer Zusammenfassung und '
        + 'Kontrollfragen; den Kurs wechseln Sie rechts in dieser Leiste.' }),
      h('p', { text: 'Blättern mit den Pfeiltasten, der Leertaste, den Knöpfen unter der Folie oder durch Wischen. '
        + 'F schaltet das Vollbild ein und aus, N die Notizen, Ü (oder O) die Übersicht aller Folien.' }),
      h('p', { text: 'Die Abschnittsnummern unter der Folie und die Titel in den Notizen führen ins Handbuch: Es öffnet sich '
        + 'als Fenster über der Folie, an dieser Stelle, und schliesst mit Esc — Sie bleiben im Lernpfad. H öffnet es beim '
        + 'Abschnitt der aktuellen Folie.' }),
      h('p', { text: 'Die Folientexte sind von uns und knapp gehalten. Der geprüfte Wortlaut steht in den Notizen unter der '
        + 'Folie: dieselben Absätze, Abbildungen und Seitenzahlen wie im Handbuch; im Deep Dive stehen dort auch die '
        + 'Einzelheiten zur Folie. Kennzahlen, Karten und Listen '
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

    /* Links ins Handbuch — in der Quelle unter der Folie, in den Notizen,
       im Faktenkasten — öffnen es im Fenster über der Präsentation, auch im
       Vollbild; mit gedrückter Taste (neuer Tab) bleiben sie Links. */
    wurzel.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) { return; }
      var a = ev.target.closest && ev.target.closest('a[href^="#/handbuch"]');
      if (!a) { return; }
      ev.preventDefault();
      HT.handbuch.imFenster(a.getAttribute('href'));
    });

    /* Taste H: das Handbuch beim ersten Abschnitt der Quelle dieser Folie. */
    function handbuchZurFolie() {
      var f = folge[jetzt] && folge[jetzt].folie;
      var q = f && (f.quelle || [])[0];
      HT.handbuch.imFenster(q && (q.abschnitte || []).length ? { kapitel: q.kapitel, teil: q.abschnitte[0] } : {});
    }

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
      if (!aktuelleFolie) { return; }
      einpassen(aktuelleFolie);
      if (aktuelleFolie.karte) { aktuelleFolie.karte.zeigen(); }
    }

    function einpassen(folie) {
      var kaesten = [folie].concat(Array.prototype.slice.call(folie.querySelectorAll('.lp-f__koerper, .lp-f__text, .lp-fakten, .lp-frage__fuss, .lp-spalten, .lp-merke, .lp-balken, .lp-tafel')));
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
      var karteVorher = letzteKarte;

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
      if (folie.karte) { folie.karte.zeigen(karteVorher); }

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
        quellZeile(quelleZeile, e.folie || {}, texte, folie.punkteInNotizen ? '  ·  N für Details und Wortlaut' : '  ·  N für den Wortlaut');
        notizenKopf.textContent = q || 'Handbuch';
        notizenFuellen(notizenInhalt, e, texte, folie.punkteInNotizen);
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
      else if (k === 'h' || k === 'H') { ev.preventDefault(); handbuchZurFolie(); }
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
