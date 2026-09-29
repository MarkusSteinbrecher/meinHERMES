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
       fragen: [{ id, stufe, dokument, situation?, frage,
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
  /* Lösungen gleich zeigen? Standard: verborgen, zum Üben. */
  var LOESUNG = 'meinHERMES:fragen-loesungen-zeigen';
  /* Ausgeblendete Fragen (nur IDs) und ob die Seite sie trotzdem zeigt;
     bleiben beim Laden einer neuen Fragendatei erhalten. */
  var AUSGEBLENDET = 'meinHERMES:fragen-ausgeblendet';
  var AUSGEBLENDETE_ZEIGEN = 'meinHERMES:fragen-ausgeblendete-zeigen';
  /* Vorgänger (29.9.: «erledigt», Lösungen standardmässig offen): werden beim Öffnen der Seite entfernt. */
  var ALT = ['meinHERMES:fragen-erledigt', 'meinHERMES:fragen-nur-offene', 'meinHERMES:fragen-loesungen'];
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
    /* meinHERMES-bki: so hiess das Format, bis die Seite «Fragen» hiess. */
    return !!d && (d.format === 'meinHERMES-fragen' || d.format === 'meinHERMES-bki') && Array.isArray(d.dokumente) && Array.isArray(d.fragen);
  }

  /* Zuerst die Datei auf dem lokalen Server, sonst die in diesem Browser
     geladene. Promise: { daten, quelle: 'lokal' | 'datei', name, stand } oder null.
     Nach internal/ fragt nur der lokale Server — live gibt es die Datei nicht. */
  function laden() {
    var lokal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(global.location.hostname);
    var ohneCache = lokal && global.fetch ? global.fetch(LOKAL, { cache: 'no-store' }) : Promise.reject(new Error('nicht lokal'));
    return ohneCache
      .then(function (r) { if (!r.ok) { throw new Error('keine lokale Datei'); } return r.json(); })
      .then(function (d) { if (!gueltig(d)) { throw new Error('ungültig'); } return { daten: d, quelle: 'lokal' }; })
      .catch(function () {
        var s = lesen(SPEICHER);
        return s && gueltig(s.daten) ? { daten: s.daten, quelle: 'datei', name: s.name, stand: s.stand } : null;
      });
  }

  function zahl(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }

  /* --- Im Überblick (js/raster.js, Reiter «Fragen») ---------------------- */

  var SICHT = { rolle: true, aufgabe: true, ergebnis: true, pfeile: false };

  function zielVon(z) {
    return z ? { ids: z.ids || [], felder: z.felder || [], phasen: z.phasen || [], module: z.module || [] } : null;
  }

  /* Zitat im Format des Rundgangs: Abschnitt einer Elementseite oder des Referenzhandbuchs. */
  function zitatVon(q) {
    if (q.id) { return { element: q.id, abschnitt: q.abschnitt || null }; }
    return q.kapitel ? { rhb: q.kapitel, nummer: q.nummer } : null;
  }

  /** Die Fragen als Schritte, Dokument für Dokument: { key, id, kapitel, titel,
      frage, vorgehen, sicht, ziel, antworten: [{ ziel, zitate }] }. */
  function schritte(d) {
    var aus = [];
    d.dokumente.forEach(function (dok) {
      d.fragen.filter(function (f) { return f.dokument === dok.id; }).forEach(function (f) {
        aus.push({
          key: 'frage:' + f.id, id: f.id, kapitel: dok.titel, titel: f.id, frage: f,
          vorgehen: f.vorgehen || null, sicht: SICHT, ziel: zielVon(f.zeige),
          antworten: f.antworten.map(function (a) {
            return { ziel: zielVon(a.zeige), zitate: (a.zitate || []).map(zitatVon).filter(Boolean) };
          })
        });
      });
    });
    return aus;
  }

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

  /* merker: { ist(id), setzen(id, an), zeigen } — ausgeblendete Fragen.
     Wer eine Frage gerade ausblendet, sieht sie als schmale Zeile mit
     «Einblenden» an derselben Stelle — nichts rutscht unter den Zeiger;
     ganz weg ist sie erst beim nächsten Aufbau der Seite. */
  function frageBauen(f, loesungen, merker) {
    var offen = loesungen;
    var gewaehlt = [];   /* Indizes der angeklickten Antworten, nur bis zum Neuladen */
    var karte = h('article', { class: 'fr-frage', id: 'frage-' + f.id });

    function zeichnen() {
      HT.ui.leeren(karte);
      var aus = merker.ist(f.id);
      var schmal = aus && !merker.zeigen;
      karte.classList.toggle('ist-ausgeblendet', aus);
      karte.classList.toggle('ist-schmal', schmal);
      var ausKnopf = h('button', {
        type: 'button', class: 'btn btn--klein fr-frage__aus', text: aus ? 'Einblenden' : 'Ausblenden',
        title: aus ? 'Diese Frage wieder zeigen' : 'Diese Frage ausblenden',
        on: { click: function () { merker.setzen(f.id, !aus); zeichnen(); } }
      });
      if (schmal) {
        karte.appendChild(h('div', { class: 'fr-frage__kopf' }, [
          h('span', { class: 'fr-frage__id', text: f.id }),
          h('span', { class: 'fr-frage__hinweis', text: 'ausgeblendet' }),
          ausKnopf
        ]));
        return;
      }
      karte.appendChild(h('div', { class: 'fr-frage__kopf' }, [
        h('span', { class: 'fr-frage__id', text: f.id }),
        f.stufe ? h('span', { class: 'fr-frage__stufe', text: f.stufe }) : null,
        h('a', { class: 'btn btn--klein fr-frage__gesamtbild', href: '#/ueberblick?frage=' + encodeURIComponent(f.id),
          title: 'Links das Gesamtbild, rechts die Frage: jede Antwort hebt ihre Stellen hervor', text: 'Im Gesamtbild durchgehen' }),
        h('button', {
          type: 'button', class: 'btn btn--klein fr-frage__knopf', text: offen ? 'Lösung verbergen' : (gewaehlt.length ? 'Prüfen' : 'Lösung zeigen'),
          'aria-expanded': offen ? 'true' : 'false', on: { click: function () { offen = !offen; zeichnen(); } }
        }),
        ausKnopf
      ]));
      if (f.situation) { karte.appendChild(h('p', { class: 'fr-frage__situation', text: f.situation })); }
      karte.appendChild(h('p', { class: 'fr-frage__text', text: f.frage }));
      /* Antworten wählen wie in der Prüfung (mehrere möglich); «Prüfen» deckt auf. */
      karte.appendChild(h('ol', { class: 'fr-antworten' }, f.antworten.map(function (a, i) {
        var marke = String.fromCharCode(97 + i);
        var gew = gewaehlt.indexOf(i) !== -1;
        return h('li', { class: 'fr-antwort' + (gew ? ' ist-gewaehlt' : '') + (offen ? (a.richtig ? ' ist-richtig' : ' ist-falsch') : '') }, [
          h('button', {
            type: 'button', class: 'fr-antwort__knopf', 'aria-pressed': gew ? 'true' : 'false',
            on: { click: function () {
              gewaehlt = gew ? gewaehlt.filter(function (x) { return x !== i; }) : gewaehlt.concat([i]);
              zeichnen();
            } }
          }, [
            h('span', { class: 'fr-antwort__marke', text: marke }),
            h('span', { class: 'fr-antwort__text', text: a.text }),
            offen ? h('span', { class: 'nur-sr', text: a.richtig ? 'richtig' : 'falsch' }) : null
          ]),
          offen && a.warum ? h('p', { class: 'fr-antwort__warum', text: a.warum }) : null
        ]);
      })));
      if (offen && gewaehlt.length) {
        var soll = [];
        f.antworten.forEach(function (a, i) { if (a.richtig) { soll.push(i); } });
        var treffer = soll.length === gewaehlt.length && soll.every(function (i) { return gewaehlt.indexOf(i) !== -1; });
        var buchstaben = function (l) { return l.slice().sort().map(function (i) { return String.fromCharCode(97 + i); }).join(', '); };
        karte.appendChild(h('p', { class: 'fr-auswertung ' + (treffer ? 'ist-richtig' : 'ist-falsch'), role: 'status',
          text: treffer ? '✓ Richtig beantwortet' : '✗ Deine Wahl: ' + buchstaben(gewaehlt) + ' — richtig ist ' + buchstaben(soll) }));
      }

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
      var loesungen = lesen(LOESUNG) === true;
      ALT.forEach(entfernen);
      var zeigeAus = lesen(AUSGEBLENDETE_ZEIGEN) === true;
      var ausgeblendet = lesen(AUSGEBLENDET);
      if (!Array.isArray(ausgeblendet)) { ausgeblendet = []; }
      var ausZeigen = h('button', {
        type: 'button', class: 'btn btn--klein',
        on: { click: function () { schreiben(AUSGEBLENDETE_ZEIGEN, !zeigeAus); zeigen(stand); } }
      });

      HT.app.unterleiste({
        label: 'Dokumente',
        links: dokumente.map(function (x) { return { href: '#/fragen?dok=' + encodeURIComponent(x.id), text: x.titel, aktiv: x === dok }; }),
        inhalt: [
          ausZeigen,
          h('button', {
            type: 'button', class: 'btn btn--klein', text: loesungen ? 'Lösungen verbergen' : 'Lösungen zeigen',
            title: loesungen ? 'Zum Üben: Lösungen erst auf Knopfdruck je Frage' : 'Alle Lösungen zeigen',
            on: { click: function () { schreiben(LOESUNG, !loesungen); zeigen(stand); } }
          })
        ],
        inhaltLabel: 'Anzeige',
        info: { titel: 'Fragen', inhalt: function () { return infoInhalt(stand); } }
      });

      if (!dok) {
        huelle.appendChild(HT.ui.leerZustand('Keine Fragen in der Datei', 'Die Fragendatei enthält noch keine Fragen.'));
        return;
      }
      var fragen = d.fragen.filter(function (f) { return f.dokument === dok.id; });
      var zaehler = h('p', { class: 'trefferzahl' });
      var alleAus = h('div', { class: 'leer fr-leer' }, [
        h('strong', { text: 'Alle Fragen ausgeblendet' }),
        h('p', { text: '«Ausgeblendete zeigen» in der Leiste holt sie zurück.' })
      ]);
      var indexLinks = {};
      var anfangs = ausgeblendet.slice();   /* beim Aufbau schon ausgeblendet: ganz weg */

      /* Zähler, Index, Leistenknopf und Hinweis nach jedem Umschalten einer Frage. */
      function stimmen() {
        var n = fragen.filter(function (f) { return ausgeblendet.indexOf(f.id) !== -1; }).length;
        zaehler.textContent = zahl(fragen.length, 'Frage', 'Fragen')
          + (n ? ' · ' + n + ' ausgeblendet' : '')
          + (dok.datei ? ' · ' + dok.datei : '');
        fragen.forEach(function (f) {
          var ist = ausgeblendet.indexOf(f.id) !== -1;
          indexLinks[f.id].classList.toggle('ist-ausgeblendet', ist);
          indexLinks[f.id].hidden = ist && !zeigeAus;
        });
        ausZeigen.textContent = zeigeAus ? 'Ausgeblendete verbergen' : 'Ausgeblendete zeigen (' + n + ')';
        ausZeigen.hidden = !zeigeAus && !n;
        var weg = fragen.filter(function (f) { return anfangs.indexOf(f.id) !== -1 && ausgeblendet.indexOf(f.id) !== -1; }).length;
        alleAus.hidden = zeigeAus || !fragen.length || weg < fragen.length;
      }

      var merker = {
        zeigen: zeigeAus,
        ist: function (id) { return ausgeblendet.indexOf(id) !== -1; },
        setzen: function (id, an) {
          ausgeblendet = ausgeblendet.filter(function (x) { return x !== id; });
          if (an) { ausgeblendet.push(id); }
          schreiben(AUSGEBLENDET, ausgeblendet);
          stimmen();
        }
      };

      huelle.appendChild(h('header', { class: 'fr-kopf' }, [
        h('span', { class: 'fr-kopf__kicker', text: 'Fragen · nicht öffentlich' }),
        h('h1', { class: 'fr-kopf__titel', text: dok.titel }),
        zaehler,
        meldung ? h('p', { class: 'import__meldung import__meldung--fehler', text: meldung }) : null,
        h('nav', { class: 'fr-index', 'aria-label': 'Fragen' }, fragen.map(function (f) {
          return indexLinks[f.id] = h('a', {
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
      fragen.forEach(function (f) {
        var karte = frageBauen(f, loesungen, merker);
        karte.hidden = !zeigeAus && anfangs.indexOf(f.id) !== -1;
        huelle.appendChild(karte);
      });
      huelle.appendChild(alleAus);
      stimmen();
      if (gesucht) {
        var ziel = document.getElementById('frage-' + gesucht.id);
        if (ziel) { ziel.scrollIntoView({ block: 'start', behavior: 'instant' }); }
      }
    }

    neuLaden();
  }

  HT.views.fragen = { titel: 'Fragen', render: render };
  HT.fragen = { laden: laden, schritte: schritte };
}(window));
