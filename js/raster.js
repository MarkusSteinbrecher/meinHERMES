/* meinHERMES — Raster: Gesamtbild und Graph in einer Ansicht.
   Entwurf, vorerst nur unter #/raster (nicht in der Navigation).

   Das Gerüst steht fest und folgt Abbildung 1 des Referenzhandbuchs: Phasen
   als Zeilen, Module als Spalten, Projektgrundlagen in der Initialisierung
   über Organisation bis IT-System. Projektsteuerung und Projektführung haben
   je eine eigene Spalte (wie im Nachbau, js/gesamtbild.js). Links läuft das
   Phasenband mit den Meilensteinen der Phase — die Freigabe, die sie öffnet,
   oben, die Entscheide, mit denen sie endet, unten auf der Grenze zur
   nächsten Phase, die modulspezifischen dazwischen.

   In die Felder (Phase × Modul) kommen die Elemente in der Bildsprache des
   Graphen: Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln
   ein- und ausblenden. Mit Aufgaben steht je Aufgabe ein Block — die
   verantwortliche Rolle darüber, die Ergebnisse, die sie in diesem Feld
   erzeugt, eingerückt darunter —, dieselben Blöcke wie in der Landkarte und
   im Zuordnen des Trainers (HT.graph.bloecke). Die Meilensteine stehen nur
   im Phasenband, nicht noch einmal im Feld.

   Zeigen auf ein Element hebt jede seiner Stellen hervor; Zeigen auf einen
   Meilenstein das Feld, in dem er entsteht.

   Zoomen: Das Rad (und das Trackpad) zoomt um den Zeiger, statt die Seite zu
   rollen; Ziehen verschiebt. Bei 100 % füllt das Raster die Breite der
   Bühne. Gezoomt wird über CSS `zoom` auf dem Gitter mit fester Breite, nicht
   über transform: so bleibt das Gitter im Fluss, die Bühne rollt nativ, und
   Modulköpfe und Phasenband kleben weiter an ihrem Rand. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};
  var h = HT.ui.h;

  /* Spalten in der Folge der Abbildung 1; Projektgrundlagen liegt über
     dreien. In den Daten teilt sich keine Phase Projektgrundlagen mit ihnen. */
  var SPALTEN = HT.gesamtbild.SPALTEN;
  var SPANNEN = { Projektgrundlagen: { ab: 'Organisation', breite: 3 } };
  /* Projektführung hat in den mittleren Phasen gut doppelt so viel wie jede
     andere Spalte und bekommt mehr Breite. */
  var GEWICHT = { 'Projektführung': 1.3 };
  var LAGEN = ['anfang', 'mitte', 'ende'];
  var KAT_REIHE = ['rolle', 'aufgabe', 'ergebnis'];
  var KAT_LABEL = { rolle: 'Rollen', aufgabe: 'Aufgaben', ergebnis: 'Ergebnisse' };

  var ZOOM_MAX = 3;
  var ZOOM_SCHRITT = 1.25;
  var IKONE_EINPASSEN = ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'];

  var SPEICHER = 'raster-sicht';
  var STANDARD = { rolle: false, aufgabe: false, ergebnis: true };

  var modelle = {};
  var lagenBereit = null;
  var laufende = null;

  /* --- Zustand --------------------------------------------------------------- */

  function sichtLesen() {
    try {
      var roh = global.localStorage.getItem(SPEICHER);
      var s = roh ? JSON.parse(roh) : null;
      if (s && typeof s === 'object') {
        return { rolle: !!s.rolle, aufgabe: !!s.aufgabe, ergebnis: !!s.ergebnis };
      }
    } catch (e) { /* ohne Speicher gilt der Standard */ }
    return { rolle: STANDARD.rolle, aufgabe: STANDARD.aufgabe, ergebnis: STANDARD.ergebnis };
  }

  function sichtSpeichern(sicht) {
    try { global.localStorage.setItem(SPEICHER, JSON.stringify(sicht)); } catch (e) { /* egal */ }
  }

  /* --- Modell ---------------------------------------------------------------- */

  /* Die Reihenfolge der Ergebnisse folgt der Abbildung 1, sobald ihre Kästen
     gelesen sind (wie im Überblick und in der Landkarte). */
  function lagenLaden() {
    if (lagenBereit) { return lagenBereit; }
    lagenBereit = !HT.abbildung ? global.Promise.resolve() : HT.abbildung.holen().then(function (text) {
      HT.graph.abbildungLagenSetzen(HT.abbildung.lagen(HT.abbildung.kaesten(HT.abbildung.lesen(text))));
      HT.gesamtbild.vergessen();
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
    return !!k && k.kategorie === 'ergebnis' && !!k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  /**
   * { vorgehen, zeilen: [{ phase, index, meilensteine: { anfang, mitte, ende } }],
   *   felder: [{ phase, zeile, modul, spalte, bloecke }] }
   * Ein Feld gibt es nur, wo das Modul in der Phase Aufgaben hat.
   */
  function modell(vorgehen) {
    if (modelle[vorgehen]) { return modelle[vorgehen]; }
    var phasen = HT.graph.phasenDerVorgehensweise(vorgehen);
    var module = HT.daten.eintraegeDerKategorie('modul').map(function (m) { return m.begriff; });
    var zeilen = [], felder = [];
    phasen.forEach(function (phase, i) {
      zeilen.push({ phase: phase, index: i, meilensteine: HT.gesamtbild.meilensteineVon(vorgehen, phase) });
      module.forEach(function (modul) {
        var spalte = spalteVon(modul);
        if (!spalte) { return; }
        var bloecke = HT.graph.bloecke({ vorgehen: vorgehen, phasen: [phase], module: [modul] }, true);
        if (!bloecke.length) { return; }
        felder.push({ phase: phase, zeile: i, modul: modul, spalte: spalte, bloecke: bloecke });
      });
    });
    modelle[vorgehen] = { vorgehen: vorgehen, phasen: phasen, zeilen: zeilen, felder: felder };
    return modelle[vorgehen];
  }

  /** Zahl der verschiedenen Rollen, Aufgaben und Ergebnisse im Raster. */
  function zahlen(m) {
    var ids = { rolle: {}, aufgabe: {}, ergebnis: {} };
    m.felder.forEach(function (f) {
      f.bloecke.forEach(function (b) {
        ids.aufgabe[b.aufgabe.id] = true;
        if (b.rolle) { ids.rolle[b.rolle.id] = true; }
        b.ergebnisse.forEach(function (k) { if (!istMeilenstein(k)) { ids.ergebnis[k.id] = true; } });
      });
    });
    return { rolle: Object.keys(ids.rolle).length, aufgabe: Object.keys(ids.aufgabe).length, ergebnis: Object.keys(ids.ergebnis).length };
  }

  /* --- Bauen ----------------------------------------------------------------- */

  /* Ein Element in der Bildsprache des Graphen: farbiger Kreis mit dem
     Zeichen der Kategorie, daneben der Name; Aufgabe und Ergebnis im Kasten
     ihrer Farbe, die Rolle ohne Kasten. */
  function knoten(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    var kat = k.kategorie;
    var zustand = kat === 'ergebnis' && e && e.typ === 'Zustand';
    return h('button', {
      type: 'button',
      class: 'ra-k ra-k--' + kat + (zustand ? ' ra-k--zustand' : ''),
      dataset: { id: k.id },
      title: k.begriff
    }, [
      h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 12)),
      h('span', { class: 'ra-k__name', text: HT.gesamtbild.trennen(k.begriff) })
    ]);
  }

  function ohneMeilensteine(liste) {
    return liste.filter(function (k) { return !istMeilenstein(k); });
  }

  /* Der Inhalt eines Feldes nach der Sicht. Mit Aufgaben je Aufgabe ein Block;
     ohne Aufgaben die Ergebnisse, bei eingeblendeten Rollen nach der
     verantwortlichen Rolle gruppiert — jedes Element steht im Feld einmal. */
  function inhaltBauen(f, sicht) {
    if (sicht.aufgabe) {
      return f.bloecke.map(function (b) {
        var erg = sicht.ergebnis ? ohneMeilensteine(b.ergebnisse) : [];
        return h('div', { class: 'ra-block' }, [
          sicht.rolle && b.rolle ? knoten(b.rolle) : null,
          knoten(b.aufgabe),
          erg.length ? h('div', { class: 'ra-block__ergebnisse' }, erg.map(knoten)) : null
        ]);
      });
    }
    var gruppen = [], nachRolle = {}, gesehen = {};
    f.bloecke.forEach(function (b) {
      var schluessel = sicht.rolle && b.rolle ? b.rolle.id : '';
      var g = nachRolle[schluessel];
      if (!g) {
        g = nachRolle[schluessel] = { rolle: sicht.rolle ? b.rolle : null, ergebnisse: [] };
        gruppen.push(g);
      }
      if (!sicht.ergebnis) { return; }
      ohneMeilensteine(b.ergebnisse).forEach(function (k) {
        var id = schluessel + '|' + k.id;
        if (gesehen[id]) { return; }
        gesehen[id] = true;
        g.ergebnisse.push(k);
      });
    });
    return gruppen.map(function (g) {
      if (!g.rolle) { return h('div', { class: 'ra-liste' }, g.ergebnisse.map(knoten)); }
      return h('div', { class: 'ra-block' }, [
        knoten(g.rolle),
        g.ergebnisse.length ? h('div', { class: 'ra-block__ergebnisse' }, g.ergebnisse.map(knoten)) : null
      ]);
    });
  }

  function modulKopf(modul, klasse) {
    var e = HT.daten.eintragMitBegriff(modul, 'modul');
    return h('button', {
      type: 'button', class: 'ra-modul' + (klasse ? ' ' + klasse : ''),
      dataset: { id: e ? e.id : '', modul: modul }, title: 'Modul ' + modul
    }, [
      h('span', { class: 'gswatch gswatch--modul', 'aria-hidden': 'true' }, HT.ui.katSymbol('modul', 12)),
      h('span', { class: 'ra-modul__name', text: HT.gesamtbild.trennen(modul) })
    ]);
  }

  function meilensteinBauen(k) {
    var e = k.eintrag || HT.daten.eintragMitId(k.id);
    /* Wo der Meilenstein entsteht: Modul und Phase aus dem Block, der ihn
       erzeugt — beim Zeigen wird dieses Feld hervorgehoben. */
    return h('button', {
      type: 'button', class: 'ra-ms', dataset: { id: k.id, module: ((e && e.module) || []).join('|') },
      title: k.begriff
    }, [
      h('span', { class: 'ra-ms__raute', 'aria-hidden': 'true' }),
      h('span', { class: 'ra-ms__name', text: HT.gesamtbild.trennen(String(k.begriff).replace(/^Meilenstein\s+/, '')) })
    ]);
  }

  function phaseBauen(z, gitterZeile) {
    var e = HT.daten.eintragMitBegriff(z.phase, 'phase');
    var el = h('div', { class: 'ra-phase', dataset: { phase: z.phase } }, [
      h('button', {
        type: 'button', class: 'ra-phase__name', dataset: { id: e ? e.id : '' }, title: 'Phase ' + z.phase
      }, h('span', { text: z.phase })),
      h('div', { class: 'ra-phase__ms' }, LAGEN.map(function (lage) {
        return h('div', { class: 'ra-ms-gruppe', dataset: { lage: lage } }, z.meilensteine[lage].map(meilensteinBauen));
      }))
    ]);
    el.style.gridRow = String(gitterZeile);
    return el;
  }

  function aufbauen(huelle, m, sicht, stand) {
    var buehne = h('div', { class: 'ra-buehne', tabindex: '0', 'aria-label': 'Gesamtbild — Rad zoomt, Ziehen verschiebt' });
    var gitter = h('div', { class: 'ra-gitter', dataset: { vorgehen: m.vorgehen } });
    gitter.style.gridTemplateColumns = 'var(--ra-band) ' + SPALTEN.map(function (s) {
      return 'minmax(var(--ra-spalte-min), ' + (GEWICHT[s] || 1) + 'fr)';
    }).join(' ');

    /* Kopfzeile: Ecke und die Modulköpfe. Projektgrundlagen hat keine eigene
       Spalte; sein Kopf steht in seinem Feld. */
    gitter.appendChild(h('div', { class: 'ra-ecke' }, [
      h('span', { class: 'ra-ecke__text', text: 'Phase · Meilensteine' })
    ]));
    SPALTEN.forEach(function (s, i) {
      var kopf = modulKopf(s, 'ra-modul--kopf');
      kopf.style.gridColumn = String(i + 2);
      kopf.style.gridRow = '1';
      gitter.appendChild(kopf);
    });

    /* Zeilen: Phasenband, darunter die Linie der Phasengrenze über die ganze
       Breite, und die Felder. */
    m.zeilen.forEach(function (z) {
      var zeile = z.index + 2;
      var bahn = h('div', { class: 'ra-bahn' + (z.index % 2 ? ' ra-bahn--zwei' : ''), dataset: { phase: z.phase } });
      bahn.style.gridRow = String(zeile);
      bahn.style.gridColumn = '1 / -1';
      gitter.appendChild(bahn);
      gitter.appendChild(phaseBauen(z, zeile));
    });

    m.felder.forEach(function (f) {
      var el = h('div', {
        class: 'ra-feld' + (f.spalte.breite > 1 ? ' ra-feld--breit' : ''),
        dataset: { phase: f.phase, modul: f.modul }
      }, [
        f.spalte.breite > 1 ? modulKopf(f.modul, 'ra-modul--feld') : null,
        h('div', { class: 'ra-feld__inhalt' }, inhaltBauen(f, sicht))
      ]);
      el.style.gridRow = String(f.zeile + 2);
      el.style.gridColumn = (f.spalte.start + 2) + ' / span ' + f.spalte.breite;
      gitter.appendChild(el);
    });

    buehne.appendChild(gitter);
    huelle.appendChild(buehne);
    var zoom = zoomEinrichten(huelle, buehne, gitter, stand);

    /* Zeigen: jede Stelle desselben Elements; beim Meilenstein zusätzlich das
       Feld, in dem er entsteht; beim Modulkopf die Spalte, bei der Phase die
       Zeile. */
    var gezeigt = null;
    function markieren(ziel) {
      var schluessel = ziel ? (ziel.dataset.id || '') + '#' + (ziel.dataset.modul || '') + '#' + (ziel.closest('.ra-phase') ? ziel.closest('.ra-phase').dataset.phase : '') : null;
      if (schluessel === gezeigt) { return; }
      gezeigt = schluessel;
      Array.prototype.forEach.call(gitter.querySelectorAll('.ist-gleich'), function (x) { x.classList.remove('ist-gleich'); });
      gitter.classList.toggle('hat-zeigen', !!ziel);
      if (!ziel) { return; }
      var id = ziel.dataset.id;
      if (id) {
        Array.prototype.forEach.call(gitter.querySelectorAll('[data-id="' + id + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
      if (ziel.classList.contains('ra-ms')) {
        var phase = ziel.closest('.ra-phase').dataset.phase;
        ziel.dataset.module.split('|').forEach(function (modul) {
          var feld = gitter.querySelector('.ra-feld[data-phase="' + phase + '"][data-modul="' + modul + '"]');
          if (feld) { feld.classList.add('ist-gleich'); }
        });
      } else if (ziel.classList.contains('ra-modul')) {
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-modul="' + ziel.dataset.modul + '"]'), function (x) { x.classList.add('ist-gleich'); });
      } else if (ziel.classList.contains('ra-phase__name')) {
        var p = ziel.closest('.ra-phase').dataset.phase;
        Array.prototype.forEach.call(gitter.querySelectorAll('.ra-feld[data-phase="' + p + '"]'), function (x) { x.classList.add('ist-gleich'); });
      }
    }
    function zielAus(el) {
      return el && el.closest ? el.closest('.ra-k, .ra-ms, .ra-modul, .ra-phase__name') : null;
    }
    gitter.addEventListener('mouseover', function (ev) { if (!zoom.ziehtGerade()) { markieren(zielAus(ev.target)); } });
    gitter.addEventListener('mouseleave', function () { markieren(null); });
    gitter.addEventListener('focusin', function (ev) { markieren(zielAus(ev.target)); });

    return {
      buehne: buehne,
      zoom: zoom,
      zeigen: function (id) {
        var el = gitter.querySelector('[data-id="' + id + '"]');
        if (!el) { return false; }
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        el.focus({ preventScroll: true });
        return true;
      }
    };
  }

  /* --- Zoomen und Verschieben ------------------------------------------------ */

  /* stand.z überlebt den Neuaufbau (Vorgehensweise, Elemente ein/aus). */
  function zoomEinrichten(huelle, buehne, gitter, stand) {
    var basis = 0;
    var wert = h('button', {
      type: 'button', class: 'ub-zoom__wert ra-zoomwert', title: 'Auf 100 % — volle Breite',
      on: { click: function () { zoomMitte(1 / stand.z); } }
    });
    var leiste = h('div', { class: 'lk-schweber lk-schweber--zoom', role: 'group', 'aria-label': 'Zoom' }, [
      h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Verkleinern', title: 'Verkleinern (−)', text: '−', on: { click: function () { zoomMitte(1 / ZOOM_SCHRITT); } } }),
      wert,
      h('button', { type: 'button', class: 'ub-zoom__knopf', 'aria-label': 'Vergrössern', title: 'Vergrössern (+)', text: '+', on: { click: function () { zoomMitte(ZOOM_SCHRITT); } } }),
      h('span', { class: 'ub-schweber__strich', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'ub-ikonknopf', 'aria-label': 'Alles zeigen', title: 'Alles zeigen (0)', on: { click: function () { allesZeigen(); } } },
        HT.ui.symbol(IKONE_EINPASSEN, 18))
    ]);
    huelle.appendChild(leiste);

    /* Kleinster Zoom: das ganze Raster auf der Bühne. */
    function zoomMin() {
      var hoehe = gitter.getBoundingClientRect().height / stand.z;
      if (!hoehe || !buehne.clientHeight) { return 1; }
      return Math.max(0.2, Math.min(1, buehne.clientHeight / hoehe));
    }

    function grenzen(z) { return Math.max(zoomMin(), Math.min(ZOOM_MAX, z)); }

    /* Lage des Gitters in den Rollkoordinaten der Bühne — ist es schmaler als
       die Bühne, steht es in der Mitte. */
    function lage() {
      var rb = buehne.getBoundingClientRect(), rg = gitter.getBoundingClientRect();
      return { x: rg.left - rb.left + buehne.scrollLeft, y: rg.top - rb.top + buehne.scrollTop };
    }

    /* Zoomt so, dass der Punkt (px, py) der Bühne stehen bleibt; ohne Punkt
       die Mitte. */
    function zoomSetzen(z, um) {
      z = grenzen(z);
      var p = um || { x: buehne.clientWidth / 2, y: buehne.clientHeight / 2 };
      var alt = lage();
      var ux = (buehne.scrollLeft + p.x - alt.x) / stand.z;
      var uy = (buehne.scrollTop + p.y - alt.y) / stand.z;
      stand.z = z;
      anwenden();
      var neu = lage();
      buehne.scrollLeft = ux * z + neu.x - p.x;
      buehne.scrollTop = uy * z + neu.y - p.y;
    }

    function zoomMitte(faktor) { zoomSetzen(stand.z * faktor, null); }

    /* Ganz klein bricht die Schrift anders um, das Raster wird dadurch etwas
       höher als gerechnet — darum wird nachgemessen. */
    function allesZeigen() {
      for (var i = 0; i < 4; i++) {
        zoomSetzen(zoomMin(), null);
        if (gitter.getBoundingClientRect().height <= buehne.clientHeight + 1) { break; }
      }
    }

    function anwenden() {
      gitter.style.width = basis + 'px';
      gitter.style.zoom = String(stand.z);
      wert.textContent = Math.round(stand.z * 100) + ' %';
    }

    function messen() {
      if (!document.body.contains(buehne)) { return; }
      var neu = buehne.clientWidth;
      if (!neu || neu === basis) { return; }
      basis = neu;
      stand.z = grenzen(stand.z);
      anwenden();
    }
    basis = buehne.clientWidth;
    anwenden();
    if (global.ResizeObserver) { new global.ResizeObserver(messen).observe(buehne); }

    function punkt(ev) {
      var r = buehne.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    buehne.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
      var dx = ev.deltaX * (ev.deltaMode === 1 ? 16 : 1);
      /* Seitwärts auf dem Trackpad verschiebt, alles andere zoomt. */
      if (!ev.ctrlKey && Math.abs(dx) > Math.abs(dy)) { buehne.scrollLeft += dx; return; }
      zoomSetzen(stand.z * Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015)), punkt(ev));
    }, { passive: false });

    /* Ziehen verschiebt; erst ab 5 px, damit ein Klick ein Klick bleibt. */
    var zug = null, nachZug = false;
    buehne.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) { return; }
      zug = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sl: buehne.scrollLeft, st: buehne.scrollTop, bewegt: false };
    });
    buehne.addEventListener('pointermove', function (ev) {
      if (!zug || ev.pointerId !== zug.id) { return; }
      var dx = ev.clientX - zug.x, dy = ev.clientY - zug.y;
      if (!zug.bewegt) {
        if (Math.hypot(dx, dy) <= 5) { return; }
        zug.bewegt = true;
        try { buehne.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
        buehne.classList.add('ist-am-ziehen');
      }
      buehne.scrollLeft = zug.sl - dx;
      buehne.scrollTop = zug.st - dy;
    });
    function zugEnde(ev) {
      if (!zug || ev.pointerId !== zug.id) { return; }
      if (zug.bewegt) {
        nachZug = true;
        global.setTimeout(function () { nachZug = false; }, 0);
      }
      zug = null;
      buehne.classList.remove('ist-am-ziehen');
    }
    buehne.addEventListener('pointerup', zugEnde);
    buehne.addEventListener('pointercancel', zugEnde);
    /* Ein Zug löst keinen Klick aus. */
    buehne.addEventListener('click', function (ev) {
      if (nachZug) { ev.preventDefault(); ev.stopPropagation(); }
    }, true);

    buehne.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
      var tat = true;
      switch (ev.key) {
        case '+': case '=': zoomMitte(ZOOM_SCHRITT); break;
        case '-': case '_': zoomMitte(1 / ZOOM_SCHRITT); break;
        case '0': allesZeigen(); break;
        default: tat = false;
      }
      if (tat) { ev.preventDefault(); }
    });

    return {
      ziehtGerade: function () { return !!(zug && zug.bewegt); },
      setzen: zoomSetzen
    };
  }

  /* --- Ansicht ----------------------------------------------------------------- */

  function infoInhalt() {
    return [
      h('p', { text: 'Entwurf: das Gesamtbild der Methode wie Abbildung 1 des Referenzhandbuchs — Phasen als Zeilen, Module als Spalten — in der Bildsprache des Graphen.' }),
      h('p', { text: 'Das Gerüst steht fest: links die Phasen mit ihren Meilensteinen (die Freigabe, die eine Phase öffnet, oben; die Entscheide, mit denen sie endet, unten an der Grenze zur nächsten Phase; modulspezifische dazwischen), oben die Module. Projektsteuerung und Projektführung haben je eine eigene Spalte, Projektgrundlagen liegt in der Initialisierung über drei.' }),
      h('p', { text: 'Rollen, Aufgaben und Ergebnisse lassen sich in der Leiste einzeln einblenden. Mit Aufgaben steht je Aufgabe die verantwortliche Rolle darüber und die Ergebnisse, die sie in diesem Feld erzeugt, darunter. Zeigen auf ein Element hebt jede seiner Stellen hervor.' }),
      h('p', { text: 'Das Rad zoomt um den Mauszeiger, Ziehen verschiebt; + und − und 0 (alles zeigen) gehen auch mit der Tastatur. Bei 100 % füllt das Raster die Breite; ein Klick auf die Prozentzahl führt dorthin zurück. Modulköpfe und Phasen bleiben beim Verschieben am Rand stehen.' })
    ];
  }

  function render(behaelter, params) {
    var vorgehen = params.vorgehen === 'agil' ? 'agil' : 'klassisch';
    var sicht = sichtLesen();
    var huelle = h('div', { class: 'ra' }, h('p', { class: 'ub-buehne__laden', text: 'Gesamtbild wird aufgebaut' }));
    behaelter.appendChild(huelle);
    var m = null;
    var stand = { z: 1 };

    function leisteSetzen() {
      var z = m ? zahlen(m) : null;
      HT.app.unterleiste({
        label: 'Gesamtbild',
        inhaltLabel: 'Darstellung',
        inhalt: [
          h('span', { class: 'lk-leiste__titel' }, [
            h('span', { text: 'Gesamtbild' }),
            h('span', { class: 'lk-leiste__entwurf', text: 'Entwurf' })
          ]),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'segment', role: 'group', 'aria-label': 'Vorgehensweise' },
            [['klassisch', 'Klassisch'], ['agil', 'Agil']].map(function (o) {
              return h('button', {
                type: 'button', class: 'segment__knopf', text: o[1], 'aria-pressed': o[0] === vorgehen ? 'true' : 'false',
                on: { click: function () {
                  if (o[0] === vorgehen) { return; }
                  vorgehen = o[0];
                  global.history.replaceState(null, '', '#/raster' + (vorgehen === 'agil' ? '?vorgehen=agil' : ''));
                  starten();
                } }
              });
            })),
          h('span', { class: 'unterleiste__trenner', 'aria-hidden': 'true' }),
          h('div', { class: 'gauswahl' }, h('div', { class: 'grail__gruppe', role: 'group', 'aria-label': 'Elemente ein- und ausblenden' },
            KAT_REIHE.map(function (kat) {
              var an = !!sicht[kat];
              return h('button', {
                type: 'button', class: 'grail__knopf grail__knopf--' + kat,
                'aria-pressed': an ? 'true' : 'false',
                title: KAT_LABEL[kat] + ' — ' + (an ? 'ausblenden' : 'einblenden'),
                on: { click: function () {
                  sicht[kat] = !sicht[kat];
                  sichtSpeichern(sicht);
                  starten();
                } }
              }, [
                h('span', { class: 'gswatch gswatch--' + kat, 'aria-hidden': 'true' }, HT.ui.katSymbol(kat, 13)),
                h('span', { class: 'gauswahl__name', text: KAT_LABEL[kat] }),
                z ? h('span', { class: 'grail__zahl', text: String(z[kat]) }) : null
              ]);
            })))
        ],
        info: { titel: 'Gesamtbild', inhalt: infoInhalt }
      });
    }

    function starten() {
      lagenLaden().then(function () {
        if (!document.body.contains(huelle)) { return; }
        modelle = {};
        m = modell(vorgehen);
        var alt = laufende && document.body.contains(laufende.buehne) ? laufende.buehne : null;
        var roll = alt ? { l: alt.scrollLeft, t: alt.scrollTop } : { l: 0, t: 0 };
        HT.ui.leeren(huelle);
        laufende = aufbauen(huelle, m, sicht, stand);
        laufende.buehne.scrollLeft = roll.l;
        laufende.buehne.scrollTop = roll.t;
        leisteSetzen();
        if (params.id) { laufende.zeigen(params.id); params.id = null; }
      });
    }

    leisteSetzen();
    starten();
  }

  HT.views.raster = {
    titel: 'Gesamtbild (Entwurf)',
    nav: 'ueberblick',
    render: render,
    suchtreffer: function (e) {
      return !!(laufende && document.body.contains(laufende.buehne) && laufende.zeigen(e.id));
    }
  };
}(window));
