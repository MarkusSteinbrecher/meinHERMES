/* meinHERMES — das Gesamtbild neu gebaut (zweite Sicht der Abbildung 1 im
   Überblick).

   Aufbau wie die Originalgrafik: links die Phasen als Band mit ihren
   Meilensteinen, oben die Module als Spaltenköpfe, dazwischen je Feld
   (Phase × Modul) die Ergebnisse. Drei Dinge macht der Nachbau anders:

   1. Projektsteuerung und Projektführung haben je eine eigene Spalte. Die
      Abbildung legt beide Module in eine, dadurch ist nicht zu sehen, welches
      Ergebnis aus welchem stammt.
   2. Es stehen alle Ergebnisse da, nicht nur die wesentlichen. Die Abbildung
      zeigt 81 Kästen für 64 der 105 Ergebnisse; hier sind es 161 Kästen —
      etwa die Ergebnisse der Aufgabe «Projekt steuern» fehlen dort ganz.
   3. Die Meilensteine tragen ihren Namen. In der Abbildung sind sie nur
      namenlose Rauten am linken Rand.

   Wiederholungen: Projektsteuerung und Projektführung erzeugen in jeder Phase
   zwischen der ersten und der letzten praktisch dasselbe — die Abbildung nennt
   das «Phasenunabhängig» und fasst es zu einem Block zusammen. Der Nachbau
   macht es gleich (BAND_MODULE): ein Feld über diese Phasen mit der
   Vereinigung ihrer Ergebnisse. Was nicht in jeder dieser Phasen entsteht,
   trägt die Phasen, in denen es entsteht, als kleine Marke — sonst stünde da
   eine Behauptung, die die Daten nicht hergeben.

   Das Bild ist HTML in einem Gitter aus festen px (Zoom 1); der Überblick
   skaliert es über `transform`. Es kennt keinen eigenen Zustand: was
   hervorgehoben, eingefärbt oder ausgeblasst ist, setzt malen() von aussen. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  /* Spalten in der Folge der Abbildung 1 — dort teilen sich Projektsteuerung
     und Projektführung die erste, hier hat jedes seine eigene. */
  var SPALTEN = ['Projektsteuerung', 'Projektführung', 'Organisation', 'Produkt', 'IT-System',
    'Beschaffung', 'Tests', 'Einführungsorganisation', 'IT-Migration', 'IT-Betrieb', 'ISDS'];
  /* Module ohne eigene Spalte liegen wie in der Abbildung über mehreren. In
     den Daten teilt sich keine Phase Projektgrundlagen mit diesen Spalten. */
  var SPANNEN = { Projektgrundlagen: { ab: 'Organisation', breite: 3 } };
  /* Die beiden Führungsmodule laufen durch das ganze Projekt; ihre Felder in
     den Phasen zwischen der ersten und der letzten werden zu einem Block. */
  var BAND_MODULE = ['Projektsteuerung', 'Projektführung'];

  /* Masse des Gitters in px bei Zoom 1. Sie bestimmen, wie klein «Passend»
     das Bild rechnet: schmaler heisst grössere Schrift auf dem Schirm. */
  var MASS = { spalte: 90, leiste: 168, luecke: 7, rand: 14 };

  var IKONE_RAUTE = ['M12 3.5 20.5 12 12 20.5 3.5 12Z'];

  var modelle = {};

  /* --- Modell ---------------------------------------------------------------- */

  function istMeilenstein(k) {
    return k.kategorie === 'ergebnis' && !!k.eintrag && k.eintrag.typ === 'Meilenstein';
  }

  function spalteVon(modul) {
    var sp = SPANNEN[modul];
    if (sp) { return { start: SPALTEN.indexOf(sp.ab), breite: sp.breite }; }
    var i = SPALTEN.indexOf(modul);
    return i === -1 ? null : { start: i, breite: 1 };
  }

  /** Die Ergebnisse eines Feldes ohne Meilensteine, in der Ordnung des Graphen. */
  function ergebnisseVon(vorgehen, phase, modul) {
    var gesehen = {}, liste = [];
    HT.graph.bloecke({ vorgehen: vorgehen, phasen: [phase], module: [modul] }, true).forEach(function (b) {
      b.ergebnisse.forEach(function (k) {
        if (istMeilenstein(k) || gesehen[k.id]) { return; }
        gesehen[k.id] = true;
        liste.push(k);
      });
    });
    return liste;
  }

  /** Die Meilensteine einer Phase über alle Module — sie stehen links. */
  function meilensteineVon(vorgehen, phase) {
    var gesehen = {}, liste = [];
    HT.graph.bloecke({ vorgehen: vorgehen, phasen: [phase], module: [] }, true).forEach(function (b) {
      b.ergebnisse.forEach(function (k) {
        if (!istMeilenstein(k) || gesehen[k.id]) { return; }
        gesehen[k.id] = true;
        liste.push(k);
      });
    });
    return liste;
  }

  /**
   * { vorgehen, phasen, zeilen: [{ phase, index, mitte, meilensteine }],
   *   felder: [{ modul, spalte, zeile, hoehe, band, titel, ergebnisse }] }
   * ergebnisse: [{ knoten, nurIn }] — nurIn nennt die Phasen eines
   * Bandfeldes, in denen das Ergebnis entsteht (null = in allen).
   */
  function modell(vorgehen) {
    if (modelle[vorgehen]) { return modelle[vorgehen]; }
    var phasen = HT.graph.phasenDerVorgehensweise(vorgehen);
    /* Die erste und die letzte Phase stehen für sich; dazwischen liegt das
       Band. Bei nur einer mittleren Phase (agil) gibt es nichts zu bündeln. */
    var mitte = phasen.slice(1, -1);
    var bandAn = mitte.length > 1;

    var zeilen = phasen.map(function (phase, i) {
      return {
        phase: phase, index: i, mitte: mitte.indexOf(phase) !== -1,
        meilensteine: meilensteineVon(vorgehen, phase)
      };
    });

    var felder = [];
    HT.daten.eintraegeDerKategorie('modul').forEach(function (m) {
      var modul = m.begriff;
      var spalte = spalteVon(modul);
      if (!spalte) { return; }
      var band = bandAn && BAND_MODULE.indexOf(modul) !== -1;

      if (band) {
        var vereint = [], wo = {};
        mitte.forEach(function (p) {
          ergebnisseVon(vorgehen, p, modul).forEach(function (k) {
            if (!wo[k.id]) { wo[k.id] = []; vereint.push(k); }
            wo[k.id].push(p);
          });
        });
        if (vereint.length) {
          felder.push({
            modul: modul, spalte: spalte, zeile: 1, hoehe: mitte.length, band: true,
            titel: 'phasenunabhängig',
            ergebnisse: vereint.map(function (k) {
              return { knoten: k, nurIn: wo[k.id].length === mitte.length ? null : wo[k.id] };
            })
          });
        }
      }

      phasen.forEach(function (phase, i) {
        if (band && mitte.indexOf(phase) !== -1) { return; }
        var erg = ergebnisseVon(vorgehen, phase, modul);
        if (!erg.length) { return; }
        felder.push({
          modul: modul, spalte: spalte, zeile: i, hoehe: 1, band: false,
          /* Ein Modul über mehreren Spalten hat oben keinen Kopf — sein Name
             steht darum im Feld. */
          titel: spalte.breite > 1 ? modul : '',
          ergebnisse: erg.map(function (k) { return { knoten: k, nurIn: null }; })
        });
      });
    });

    modelle[vorgehen] = { vorgehen: vorgehen, phasen: phasen, zeilen: zeilen, felder: felder };
    return modelle[vorgehen];
  }

  /** Breite des Bildes in px bei Zoom 1 — der Überblick rechnet damit. */
  function breite() {
    return MASS.rand * 2 + MASS.leiste + SPALTEN.length * (MASS.spalte + MASS.luecke);
  }

  /* --- Bild ------------------------------------------------------------------ */

  /* Ein anklickbares Element: Ergebnis, Meilenstein, Modulkopf, Phase. `art`
     bestimmt die Form (Dokument eckig gefüllt, Zustand weiss mit runden Ecken,
     Meilenstein als Raute ohne Kasten) — wie in der Abbildung. */
  function knopf(eintrag, klasse, art, text) {
    if (!eintrag) { return h('span', { class: klasse + ' ist-ohne', text: text }); }
    return h('button', {
      type: 'button', class: klasse, dataset: { id: eintrag.id, art: art },
      'aria-pressed': 'false'
    }, [
      art === 'meilenstein' ? HT.ui.symbol(IKONE_RAUTE, 11) : null,
      h('span', { class: 'gb-k__name', text: text || eintrag.begriff })
    ]);
  }

  function formVon(e) {
    return e && e.typ === 'Zustand' ? 'zustand' : 'dokument';
  }

  function ergebnisBauen(pos) {
    var k = pos.knoten;
    var el = knopf(k.eintrag || { id: k.id, begriff: k.begriff }, 'gb-k gb-k--ergebnis',
      formVon(k.eintrag), k.begriff);
    if (!el.dataset.id) { el.dataset.id = k.id; }
    if (pos.nurIn) {
      /* Nur in einem Teil der gebündelten Phasen — sonst stünde hier eine
         Behauptung über alle. */
      el.appendChild(h('span', { class: 'gb-k__nurin', text: 'nur ' + pos.nurIn.join(' · ') }));
    }
    return el;
  }

  function feldBauen(f) {
    var el = h('div', { class: 'gb-feld', dataset: { modul: f.modul, band: f.band ? 'ja' : 'nein' } },
      [f.titel ? h('p', { class: 'gb-feld__titel', text: f.titel }) : null]
        .concat(f.ergebnisse.map(ergebnisBauen)));
    el.style.gridColumn = (f.spalte.start + 2) + ' / span ' + f.spalte.breite;
    el.style.gridRow = (f.zeile + 2) + ' / span ' + f.hoehe;
    return el;
  }

  function leisteBauen(z) {
    var phase = HT.daten.eintragMitBegriff(z.phase, 'phase');
    var el = h('div', { class: 'gb-leiste', dataset: { art: z.mitte ? 'mitte' : 'rand' } }, [
      knopf(phase, 'gb-k gb-k--phase', 'phase', z.phase),
      h('div', { class: 'gb-ms' }, z.meilensteine.map(function (k) {
        var b = knopf(k.eintrag || { id: k.id, begriff: k.begriff }, 'gb-k gb-k--meilenstein',
          'meilenstein', String(k.begriff).replace(/^Meilenstein\s+/, ''));
        if (!b.dataset.id) { b.dataset.id = k.id; }
        return b;
      }))
    ]);
    el.style.gridColumn = '1';
    el.style.gridRow = String(z.index + 2);
    return el;
  }

  function kopfBauen(modul, i) {
    var e = HT.daten.eintragMitBegriff(modul, 'modul');
    var el = knopf(e, 'gb-k gb-k--modul', 'modul', modul);
    el.style.gridColumn = String(i + 2);
    el.style.gridRow = '1';
    return el;
  }

  /**
   * Das ganze Bild einer Vorgehensweise.
   * opt: { beiZeigen(eintrag), beiKlick(eintrag) }
   */
  function bauen(vorgehen, opt) {
    opt = opt || {};
    var m = modell(vorgehen);

    var gitter = h('div', { class: 'gb-gitter' });
    gitter.style.gridTemplateColumns = MASS.leiste + 'px repeat(' + SPALTEN.length + ', ' + MASS.spalte + 'px)';
    gitter.style.gap = MASS.luecke + 'px';

    var ecke = h('div', { class: 'gb-ecke', 'aria-hidden': 'true' });
    ecke.style.gridColumn = '1';
    ecke.style.gridRow = '1';
    gitter.appendChild(ecke);
    SPALTEN.forEach(function (modul, i) { gitter.appendChild(kopfBauen(modul, i)); });
    m.zeilen.forEach(function (z) { gitter.appendChild(leisteBauen(z)); });
    m.felder.forEach(function (f) { gitter.appendChild(feldBauen(f)); });

    var el = h('div', { class: 'gb', dataset: { vorgehen: vorgehen, breite: String(breite()) } }, [
      h('h2', { class: 'nur-sr', text: 'Gesamtbild der Methode — Nachbau mit allen Ergebnissen' }),
      gitter
    ]);
    el.style.width = breite() + 'px';
    el.style.padding = MASS.rand + 'px';

    /* Zeigen und Klicken für alle Knöpfe an einer Stelle; beim Zeigen sind
       alle Stellen desselben Elements hervorgehoben (ein Ergebnis steht bei
       jeder Phase, in der es entsteht). */
    var gezeigt = null;
    function knotenAus(ziel) {
      var k = ziel && ziel.closest ? ziel.closest('.gb-k') : null;
      return k && el.contains(k) && k.dataset.id ? k : null;
    }
    function gleicheMarkieren(id) {
      Array.prototype.forEach.call(el.querySelectorAll('.gb-k.ist-gleich'), function (k) {
        k.classList.remove('ist-gleich');
      });
      if (!id) { return; }
      Array.prototype.forEach.call(el.querySelectorAll('.gb-k'), function (k) {
        if (k.dataset.id === id) { k.classList.add('ist-gleich'); }
      });
    }
    function zeigen(k) {
      var id = k ? k.dataset.id : null;
      if (id === gezeigt) { return; }
      gezeigt = id;
      gleicheMarkieren(id);
      var e = id ? HT.daten.eintragMitId(id) : null;
      if (e && opt.beiZeigen) { opt.beiZeigen(e); }
    }
    el.addEventListener('mouseover', function (ev) { zeigen(knotenAus(ev.target)); });
    el.addEventListener('mouseleave', function () { zeigen(null); });
    el.addEventListener('focusin', function (ev) { zeigen(knotenAus(ev.target)); });
    el.addEventListener('click', function (ev) {
      var k = knotenAus(ev.target);
      var e = k ? HT.daten.eintragMitId(k.dataset.id) : null;
      if (e && opt.beiKlick) { opt.beiKlick(e); }
    });
    return el;
  }

  /**
   * Hervorheben, Einfärben und Ausblassen — alles, was von aussen kommt.
   * opt: { rolle, nurMinimal, aktivId, imAuswahl(eintrag) }
   */
  function malen(el, opt) {
    if (!el) { return; }
    opt = opt || {};
    var norm = opt.rolle ? HT.daten.normalisieren(opt.rolle) : '';
    Array.prototype.forEach.call(el.querySelectorAll('.gb-k'), function (k) {
      var e = HT.daten.eintragMitId(k.dataset.id);
      var bezug = '';
      if (norm && e && e.kategorie === 'ergebnis') {
        if (HT.daten.normalisieren(e.verantwortlich || '') === norm) { bezug = 'verantwortlich'; }
        else if ((e.beteiligt || []).some(function (r) { return HT.daten.normalisieren(r) === norm; })) { bezug = 'beteiligt'; }
        else { bezug = 'ohne'; }
      }
      var blass = bezug === 'ohne'
        || (opt.nurMinimal && !!e && e.kategorie === 'ergebnis' && !e.minimalGefordert)
        || (!!opt.imAuswahl && !!e && !opt.imAuswahl(e));
      k.dataset.bezug = bezug;
      k.classList.toggle('ist-blass', !!blass);
      var an = !!opt.aktivId && k.dataset.id === opt.aktivId;
      k.classList.toggle('ist-gewaehlt', an);
      k.setAttribute('aria-pressed', an ? 'true' : 'false');
    });
  }

  /* Die Ordnung der Ergebnisse in einem Feld kommt aus dem Graphen und folgt
     der Abbildung, sobald deren Kästen gelesen sind. Wer die Lagen nachträgt,
     lässt das Modell hier vergessen und baut neu. */
  function vergessen() { modelle = {}; }

  HT.gesamtbild = {
    SPALTEN: SPALTEN,
    breite: breite,
    bauen: bauen,
    malen: malen,
    vergessen: vergessen
  };
}(window));
