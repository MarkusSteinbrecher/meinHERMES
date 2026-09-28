/* meinHERMES — Fragen (#/fragen), nicht öffentlich.

   Prüfungsfragen Frage für Frage verstehen: die Frage, die Antworten mit
   Lösung und Begründung, der Tipp aus dem Dokument und je Frage die Wege ins
   Gesamtbild (Raster des Überblicks) und ins Handbuch (im Fenster).

   Die Fragen sind urheberrechtlich geschützt und stehen nicht im Repository:
   Die Seite hat keinen Menüpunkt und bringt keine Fragen mit. Sie liest
   internal/BKI Fragen/fragen.json — das gibt es nur auf dem lokalen Server
   (internal/ steht in .gitignore). Auf GitHub Pages lädt man dieselbe Datei
   über «Fragendatei laden …»; sie bleibt nur in diesem Browser
   (localStorage, eigener Schlüssel, nicht im Export von «Über»).

   Format der Datei (geprüft und ergänzt von internal/BKI Fragen/pruefen.py):
     { format: 'meinHERMES-fragen', version: 1,
       dokumente: [{ id, titel, datei }],
       fragen: [{ id, stufe, dokument, frage,
         antworten: [{ text, richtig, warum }],
         tipp: { text, verweise: [{ nummer, kapitel?, titel? }] },
         lesart: [text], merksaetze: [text],
         gesamtbild: [{ id | feld: 'Phase|Modul', vorgehen?, text? }],
         handbuch: [{ id } | { nummer, kapitel, titel }] }] } */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;

  var LOKAL = 'internal/BKI%20Fragen/fragen.json';
  var SPEICHER = 'meinHERMES:fragen';
  var LOESUNG = 'meinHERMES:fragen-loesungen';
  var MAX_DATEI = 5 * 1024 * 1024;

  function lesen(schluessel) {
    try { var t = global.localStorage.getItem(schluessel); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function schreiben(schluessel, wert) {
    try { global.localStorage.setItem(schluessel, JSON.stringify(wert)); return true; } catch (e) { return false; }
  }
  function entfernen(schluessel) {
    try { global.localStorage.removeItem(schluessel); } catch (e) { /* ohne Speicher */ }
  }

  function gueltig(d) {
    return !!d && d.format === 'meinHERMES-fragen' && Array.isArray(d.dokumente) && Array.isArray(d.fragen);
  }

  /* Zuerst die Datei auf dem lokalen Server, sonst die in diesem Browser
     geladene. Promise: { daten, quelle: 'lokal' | 'datei', name, stand } oder null. */
  function laden() {
    var ohneCache = global.fetch ? global.fetch(LOKAL, { cache: 'no-store' }) : Promise.reject(new Error('kein fetch'));
    return ohneCache
      .then(function (r) { if (!r.ok) { throw new Error('keine lokale Datei'); } return r.json(); })
      .then(function (d) { if (!gueltig(d)) { throw new Error('ungültig'); } return { daten: d, quelle: 'lokal' }; })
      .catch(function () {
        var s = lesen(SPEICHER);
        return s && gueltig(s.daten) ? { daten: s.daten, quelle: 'datei', name: s.name, stand: s.stand } : null;
      });
  }

  function zahl(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }

  function ueberblickAdresse(g) {
    var q = g.vorgehen === 'agil' ? ['vorgehen=agil'] : [];
    q.push(g.feld ? 'feld=' + encodeURIComponent(g.feld) : 'id=' + encodeURIComponent(g.id));
    return '#/ueberblick?' + q.join('&');
  }

  function handbuchZiel(z) {
    return z.id ? { id: z.id } : { kapitel: z.kapitel, teil: z.nummer };
  }

  function imFenster(z) {
    if (HT.handbuch && HT.handbuch.imFenster) { HT.handbuch.imFenster(handbuchZiel(z)); }
  }

  /* --- Bausteine einer Frage ---------------------------------------------- */

  function abschnitt(titel, kinder) {
    return h('section', { class: 'fr-abschnitt' }, [h('h3', { class: 'fr-abschnitt__titel', text: titel })].concat(kinder));
  }

  function gesamtbildLink(g) {
    var e = g.id ? HT.daten.eintragMitId(g.id) : null;
    var text = g.text || (e ? e.begriff : g.id || g.feld);
    return h('a', {
      class: 'fr-link' + (e ? ' fr-link--' + e.kategorie : ' fr-link--feld'), href: ueberblickAdresse(g),
      title: 'Im Überblick zeigen' + (g.vorgehen === 'agil' ? ' (agil)' : '')
    }, [h('span', { text: text }), g.vorgehen === 'agil' && !g.text ? h('span', { class: 'fr-link__zusatz', text: 'agil' }) : null]);
  }

  function handbuchKnopf(z) {
    if (!z.kapitel && !z.id) {
      return h('span', { class: 'fr-link fr-link--alt', title: 'Diese Nummer gibt es im heutigen Handbuch nicht' }, [
        h('span', { class: 'fr-link__nr', text: z.nummer }), h('span', { text: 'nicht im heutigen Handbuch' })
      ]);
    }
    return h('button', {
      type: 'button', class: 'fr-link fr-link--handbuch', title: 'Im Handbuch nachlesen',
      on: { click: function () { imFenster(z); } }
    }, [z.nummer ? h('span', { class: 'fr-link__nr', text: z.nummer }) : null, h('span', { text: z.titel || z.id })]);
  }

  function frageBauen(f, loesungen) {
    var offen = loesungen;
    var karte = h('article', { class: 'fr-frage', id: 'frage-' + f.id });

    function zeichnen() {
      HT.ui.leeren(karte);
      karte.appendChild(h('div', { class: 'fr-frage__kopf' }, [
        h('span', { class: 'fr-frage__id', text: f.id }),
        f.stufe ? h('span', { class: 'fr-frage__stufe', text: f.stufe }) : null,
        h('button', {
          type: 'button', class: 'btn btn--klein fr-frage__knopf', text: offen ? 'Lösung verbergen' : 'Lösung zeigen',
          'aria-expanded': offen ? 'true' : 'false', on: { click: function () { offen = !offen; zeichnen(); } }
        })
      ]));
      karte.appendChild(h('p', { class: 'fr-frage__text', text: f.frage }));
      karte.appendChild(h('ol', { class: 'fr-antworten' }, f.antworten.map(function (a, i) {
        var marke = String.fromCharCode(97 + i);
        return h('li', { class: 'fr-antwort' + (offen ? (a.richtig ? ' ist-richtig' : ' ist-falsch') : '') }, [
          h('span', { class: 'fr-antwort__marke', 'aria-hidden': 'true', text: offen ? (a.richtig ? '✓' : '✗') : marke }),
          h('div', { class: 'fr-antwort__inhalt' }, [
            h('p', { class: 'fr-antwort__text' }, [h('span', { class: 'fr-antwort__buchstabe', text: marke + ' ' }), a.text]),
            offen && a.warum ? h('p', { class: 'fr-antwort__warum', text: a.warum }) : null,
            offen ? h('span', { class: 'nur-sr', text: a.richtig ? 'richtig' : 'falsch' }) : null
          ])
        ]);
      })));

      var teile = [];
      if (f.lesart && f.lesart.length) {
        teile.push(abschnitt('So liest man die Frage', f.lesart.map(function (t) { return h('p', { text: t }); })));
      }
      if (offen && f.tipp && f.tipp.text) {
        var verweise = f.tipp.verweise || [];
        teile.push(abschnitt('Tipp aus dem Dokument', [
          h('p', { class: 'fr-tipp', text: f.tipp.text }),
          verweise.length ? h('div', { class: 'fr-links' }, verweise.map(handbuchKnopf)) : null
        ]));
      }
      if (f.gesamtbild && f.gesamtbild.length) {
        teile.push(abschnitt('Im Gesamtbild', [h('div', { class: 'fr-links' }, f.gesamtbild.map(gesamtbildLink))]));
      }
      if (f.handbuch && f.handbuch.length) {
        teile.push(abschnitt('Im Handbuch', [h('div', { class: 'fr-links' }, f.handbuch.map(handbuchKnopf))]));
      }
      if (offen && f.merksaetze && f.merksaetze.length) {
        teile.push(abschnitt('Merksätze', [h('ul', { class: 'fr-merksaetze' }, f.merksaetze.map(function (t) { return h('li', { text: t }); }))]));
      }
      karte.appendChild(h('div', { class: 'fr-frage__teile' }, teile));
    }
    zeichnen();
    return karte;
  }

  /* --- Datei laden --------------------------------------------------------- */

  function dateiWahl(fertig) {
    var eingabe = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    eingabe.addEventListener('change', function () {
      var datei = eingabe.files && eingabe.files[0];
      eingabe.value = '';
      if (!datei) { return; }
      if (datei.size > MAX_DATEI) { fertig('Die Datei ist zu gross für eine Fragendatei.'); return; }
      var leser = new global.FileReader();
      leser.onload = function () {
        var d = null;
        try { d = JSON.parse(String(leser.result)); } catch (e) { d = null; }
        if (!gueltig(d)) { fertig('Das ist keine Fragendatei von meinHERMES (fragen.json).'); return; }
        if (!schreiben(SPEICHER, { daten: d, name: datei.name, stand: new Date().toISOString() })) {
          fertig('Der Browser konnte die Datei nicht speichern.');
          return;
        }
        fertig(null);
      };
      leser.onerror = function () { fertig('Die Datei liess sich nicht lesen.'); };
      leser.readAsText(datei);
    });
    return eingabe;
  }

  /* --- Seite -------------------------------------------------------------- */

  function render(behaelter, params) {
    var huelle = h('div', { class: 'fr', 'aria-busy': 'true' }, h('p', { class: 'trefferzahl', text: 'Fragen werden geladen …' }));
    behaelter.appendChild(huelle);
    var meldung = null;
    var aktuell = null;

    /* Nach Laden oder Entfernen einer Datei: neu lesen und zeigen. */
    function neuLaden() {
      laden().then(function (stand) {
        if (document.body.contains(huelle)) { aktuell = stand; zeigen(stand); }
      });
    }

    var eingabe = dateiWahl(function (fehler) {
      meldung = fehler;
      if (fehler) { zeigen(aktuell); return; }
      neuLaden();
    });

    function infoInhalt(stand) {
      var teile = [
        h('p', { text: 'Prüfungsfragen mit Lösung, Begründung und dem Tipp aus dem Dokument; je Frage die Stellen im Gesamtbild und im Handbuch.' }),
        h('p', { text: 'Die Fragen sind urheberrechtlich geschützt und nicht Teil der Website: Lokal (127.0.0.1) liest die Seite die Fragendatei direkt. '
          + 'Anderswo lädt man diese Datei hier; sie bleibt nur in diesem Browser.' })
      ];
      if (stand && stand.quelle === 'datei') {
        teile.push(h('p', { class: 'trefferzahl', text: 'Geladen aus ' + (stand.name || 'Datei')
          + (stand.stand ? ' am ' + new Date(stand.stand).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }) : '') + '.' }));
      } else if (stand) {
        teile.push(h('p', { class: 'trefferzahl', text: 'Geladen vom lokalen Server.' }));
      }
      teile.push(h('div', { class: 'btn-reihe' }, [
        h('button', { type: 'button', class: 'btn btn--klein', text: 'Fragendatei laden …', on: { click: function () { eingabe.click(); } } }),
        stand && stand.quelle === 'datei' ? h('button', {
          type: 'button', class: 'btn btn--klein', text: 'Aus diesem Browser entfernen',
          on: { click: function () { entfernen(SPEICHER); neuLaden(); } }
        }) : null
      ]));
      return teile;
    }

    function zeigen(stand) {
      HT.ui.leeren(huelle);
      huelle.setAttribute('aria-busy', 'false');
      huelle.appendChild(eingabe);
      if (!stand) {
        HT.app.unterleiste({ info: { titel: 'Fragen', inhalt: function () { return infoInhalt(null); } } });
        huelle.appendChild(h('div', { class: 'leer fr-leer' }, [
          h('strong', { text: 'Keine Fragen geladen' }),
          h('p', { text: 'Die Fragen sind nicht Teil der Website. Lade die Fragendatei (fragen.json) — sie bleibt nur in diesem Browser.' }),
          meldung ? h('p', { class: 'import__meldung import__meldung--fehler', text: meldung }) : null,
          h('div', { class: 'btn-reihe' }, [
            h('button', { type: 'button', class: 'btn btn--primaer', text: 'Fragendatei laden …', on: { click: function () { eingabe.click(); } } })
          ])
        ]));
        return;
      }

      var d = stand.daten;
      var dokumente = d.dokumente.filter(function (x) { return d.fragen.some(function (f) { return f.dokument === x.id; }); });
      var gesucht = params.frage ? d.fragen.filter(function (f) { return f.id === params.frage; })[0] : null;
      var dok = dokumente.filter(function (x) { return x.id === (gesucht ? gesucht.dokument : params.dok); })[0] || dokumente[0];
      var loesungen = lesen(LOESUNG) !== false;

      HT.app.unterleiste({
        label: 'Dokumente',
        links: dokumente.map(function (x) { return { href: '#/fragen?dok=' + encodeURIComponent(x.id), text: x.titel, aktiv: x === dok }; }),
        inhalt: [h('button', {
          type: 'button', class: 'btn btn--klein', text: loesungen ? 'Lösungen verbergen' : 'Lösungen zeigen',
          title: loesungen ? 'Zum Üben: Lösungen erst auf Knopfdruck je Frage' : 'Alle Lösungen zeigen',
          on: { click: function () { schreiben(LOESUNG, !loesungen); zeigen(stand); } }
        })],
        inhaltLabel: 'Lösungen',
        info: { titel: 'Fragen', inhalt: function () { return infoInhalt(stand); } }
      });

      if (!dok) {
        huelle.appendChild(HT.ui.leerZustand('Keine Fragen in der Datei', 'Die Fragendatei enthält noch keine Fragen.'));
        return;
      }
      var fragen = d.fragen.filter(function (f) { return f.dokument === dok.id; });
      huelle.appendChild(h('header', { class: 'fr-kopf' }, [
        h('span', { class: 'fr-kopf__kicker', text: 'Fragen · nicht öffentlich' }),
        h('h1', { class: 'fr-kopf__titel', text: dok.titel }),
        h('p', { class: 'trefferzahl', text: zahl(fragen.length, 'Frage', 'Fragen') + (dok.datei ? ' · ' + dok.datei : '') }),
        meldung ? h('p', { class: 'import__meldung import__meldung--fehler', text: meldung }) : null,
        h('nav', { class: 'fr-index', 'aria-label': 'Fragen' }, fragen.map(function (f) {
          return h('a', {
            class: 'fr-index__link', href: '#/fragen?frage=' + encodeURIComponent(f.id), text: f.id,
            on: { click: function (ev) {
              ev.preventDefault();
              global.history.replaceState(null, '', '#/fragen?frage=' + encodeURIComponent(f.id));
              var ziel = document.getElementById('frage-' + f.id);
              if (ziel) { ziel.scrollIntoView({ block: 'start', behavior: 'instant' }); }
            } }
          });
        }))
      ]));
      fragen.forEach(function (f) { huelle.appendChild(frageBauen(f, loesungen)); });
      if (gesucht) {
        var ziel = document.getElementById('frage-' + gesucht.id);
        if (ziel) { ziel.scrollIntoView({ block: 'start', behavior: 'instant' }); }
      }
    }

    neuLaden();
  }

  HT.views.fragen = { titel: 'Fragen', render: render };
}(window));
