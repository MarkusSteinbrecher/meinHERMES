/* meinHERMES — Teil «Lernkarten» des Trainers (#/trainer?teil=lernkarten).
   Karten für Aufgaben und Ergebnisse. Worum es geht, ist der Zusammenhang
   von Phase, Modul, Aufgabe, Ergebnis und Rolle: vorn steht der Begriff
   (oder die Definition) und darunter je Bezug ein Feld — Phase, Modul,
   das Gegenstück (die Ergebnisse einer Aufgabe bzw. die Aufgaben, aus denen
   ein Ergebnis entsteht) und zuunterst die verantwortliche Rolle. Gesucht sind je
   Zeile alle Werte, die dort richtig sind (49 der 71 Aufgaben erzeugen
   mehrere Ergebnisse, die meisten Elemente stehen in mehreren Phasen); die
   Zeile zählt mit («2 von 4 gefunden»). Jede Wahl wird sofort geprüft, die
   erste falsche beendet die Zeile; sind alle Zeilen fertig, dreht sich die
   Karte zur Lösung. Die Werte kommen aus einem Kombinationsfeld, bei langen
   Listen (Aufgaben, Ergebnisse) mit Suche. Ohne Wahl geht es auch: Karte drehen und selbst einschätzen.
   Dazu die Grundbegriffe (data/grundbegriffe.json, nur hier geladen): mit
   dem Begriff vorn eine Karte zum Drehen (auch per Klick auf die Karte), mit
   der Definition vorn eine Wahl allein für den Begriff.
   «Nochmals» kehrt im Stapel zurück. Fortschritt liegt im localStorage und
   ist zurücksetzbar.
   Unter der Karte blättern ‹ und › zurück und weiter: ‹ zeigt die zuvor
   gezeigte Karte wieder, › überspringt die Karte ohne Einschätzung. Das Icon
   daneben zeigt statt der Karte die Liste aller Karten: nach Kategorie, darin
   alphabetisch, je mit dem Verlauf; ein Klick legt die Karte zuoberst auf den
   Stapel und zeigt sie. Jede Karte trägt eine feste Nummer — auf beiden
   Seiten und in der Liste —, damit man sie dort wiederfindet.
   Die fünf Punkte gibt es auch ausserhalb des Trainers: HT.lernkarten.marke(id)
   liefert sie als Link auf #/trainer?teil=lernkarten&karte=<id>, und das
   Handbuch stellt sie über js/karte.js an den Fuss jeder Karte, die eine
   Lernkarte hat (Aufgaben und Ergebnisse). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;
  var KATEGORIEN = ['aufgabe', 'ergebnis', 'grundbegriff'];
  /* 1 (ohne Angabe): Begriff ↔ Definition für alle Kategorien — «Gewusst» galt nur der Definition
     2: Bezüge auf der Rückseite (Rolle, Ergebnisse/Aufgaben, Modul)
     3: Bezüge als Dropdown auf der Vorderseite, dazu die Phase */
  var VERSION = 3;

  /* Wie lange die Rückmeldung der letzten Wahl stehen bleibt, bevor sich
     die Karte von selbst dreht (ms). */
  var DREH_VERZUG = 550;

  /* Wie viele Versuche je Karte unten als Punkte stehen. */
  var VERLAUF_LAENGE = 5;

  var zustand = {
    initialisiert: false,
    richtung: 'bd',        // 'bd' = vorne Begriff, 'db' = vorne Definition
    ansicht: 'karte',      // 'karte' = eine Karte zum Üben, 'liste' = alle Karten
    filter: [],            // leer = Aufgaben, Ergebnisse und Grundbegriffe
    fortschritt: {},       // id -> 'gewusst' | 'nochmals'
    verlauf: {},           // id -> ['gewusst' | 'nochmals', …], die letzten Versuche, neuester zuletzt
    stapel: [],            // offene Karten-IDs der laufenden Runde
    zurueck: [],           // zuvor gezeigte Karten-IDs, die zuletzt gezeigte zuletzt (für ‹)
    gedreht: false,
    antworten: {}          // Bezug-Schlüssel -> { wert, richtig } der laufenden Karte
  };

  var refs = {};
  var entstehtAus = null;  // Ergebnis-Begriff -> [Aufgaben-Begriffe]
  var pool = null;         // Kategorie -> Werteliste der Dropdowns

  /* --- Persistenz --------------------------------------------------------- */

  function speichern() {
    HT.store.schreib('lernkarten', {
      version: VERSION,
      richtung: zustand.richtung,
      ansicht: zustand.ansicht,
      filter: zustand.filter,
      fortschritt: zustand.fortschritt,
      verlauf: zustand.verlauf
    });
  }

  function wiederherstellen() {
    var g = HT.store.lies('lernkarten', null);
    if (g && typeof g === 'object') {
      zustand.richtung = (g.richtung === 'db') ? 'db' : 'bd';
      zustand.ansicht = (g.ansicht === 'liste') ? 'liste' : 'karte';
      zustand.filter = Array.isArray(g.filter)
        ? g.filter.filter(function (k) { return KATEGORIEN.indexOf(k) !== -1; })
        : [];
      zustand.fortschritt = (g.version === VERSION && g.fortschritt && typeof g.fortschritt === 'object')
        ? g.fortschritt
        : {};
      zustand.verlauf = (g.version === VERSION && g.verlauf && typeof g.verlauf === 'object')
        ? g.verlauf
        : {};
    }
  }

  /** Die letzten Versuche einer Karte, ältester zuerst. Karten, die vor dem
      Verlauf eingeschätzt wurden, haben nur ihre letzte Einschätzung. */
  function verlaufVon(id) {
    var v = zustand.verlauf[id];
    if (Array.isArray(v)) {
      return v.filter(function (w) { return w === 'gewusst' || w === 'nochmals'; }).slice(-VERLAUF_LAENGE);
    }
    var letzte = zustand.fortschritt[id];
    return (letzte === 'gewusst' || letzte === 'nochmals') ? [letzte] : [];
  }

  /* --- Beziehungen -------------------------------------------------------- */

  function rollenVon(e) {
    return e.verantwortlich
      ? e.verantwortlich.split(',').map(function (r) { return r.trim(); }).filter(function (r) { return !!r; })
      : [];
  }

  function aufgabenZu(ergebnis) {
    if (!entstehtAus) {
      entstehtAus = {};
      HT.daten.eintraegeDerKategorie('aufgabe').forEach(function (a) {
        a.ergebnisse.forEach(function (name) {
          (entstehtAus[name] = entstehtAus[name] || []).push(a.begriff);
        });
      });
    }
    return entstehtAus[ergebnis.begriff] || [];
  }

  /* Die agile Phase muss nicht genannt werden, wenn das Element daneben noch
     in anderen Phasen steht; die Lösung zeigt sie trotzdem, leicht grau (wie
     ihr Chip, falls gewählt). Steht es nur in der Umsetzung (die
     Release-Karten), bleibt sie gesucht und sieht aus wie jede Phase. */
  var FREIWILLIGE_PHASE = 'Umsetzung';

  function istFreiwillig(z, wert) {
    return !!z.pflicht && z.pflicht.indexOf(wert) === -1;
  }

  function phasenZeile(e) {
    var werte = HT.daten.phasenSortiert(e.phasen);
    var pflicht = werte.length > 1
      ? werte.filter(function (p) { return p !== FREIWILLIGE_PHASE; })
      : werte;
    return {
      key: 'phase', kategorie: 'phase', werte: werte, pflicht: pflicht,
      label: pflicht.length === 1 ? 'Phase' : 'Phasen',
      labelLoesung: werte.length === 1 ? 'Phase' : 'Phasen'
    };
  }

  /**
   * Die Bezüge einer Karte: Phase, Modul, das Gegenstück, zuunterst die
   * verantwortliche Rolle (Sponsor, 2026-09-17). Nur Zeilen mit Werten —
   * das lässt die Sammeleinträge «Checklisten» und «Meilensteine» aussen vor.
   * [{ key, label, kategorie, werte, pflicht?, labelLoesung? }] — werte sind
   * alle richtigen Werte, pflicht (ohne Angabe: werte) die gesuchten.
   */
  function bezuege(e) {
    if (istGrundbegriff(e)) { return []; }
    var zeilen = [
      phasenZeile(e),
      { key: 'modul', label: e.module.length === 1 ? 'Modul' : 'Module', kategorie: 'modul', werte: e.module }
    ];
    if (e.kategorie === 'aufgabe') {
      zeilen.push({ key: 'ergebnis', label: e.ergebnisse.length === 1 ? 'Ergebnis' : 'Ergebnisse', kategorie: 'ergebnis', werte: e.ergebnisse });
    } else {
      zeilen.push({ key: 'aufgabe', label: 'Entsteht aus', kategorie: 'aufgabe', werte: aufgabenZu(e) });
    }
    zeilen.push({ key: 'rolle', label: 'Verantwortlich', kategorie: 'rolle', werte: rollenVon(e) });
    return zeilen.filter(function (z) { return z.werte.length > 0; });
  }

  /* Grundbegriffe haben keine Bezüge (Phase, Modul usw. werden bei ihnen nicht
     abgefragt, auch wo die Daten welche nennen). Sie folgen der Wahl oben auf
     der Karte: «Begriff» zeigt den Begriff, gedreht wird zur
     Definition, ohne Auswahl; «Definition» fragt allein den Begriff ab. */
  function istGrundbegriff(e) {
    return e.kategorie === 'grundbegriff';
  }

  /** Steht vorn die Definition (und ist damit der Begriff gesucht)? */
  function begriffGesucht() {
    return zustand.richtung === 'db';
  }

  /** Was die Vorderseite abfragt: ist der Begriff gesucht, zuerst er selbst. */
  function fragen(e) {
    var vorweg = begriffGesucht()
      ? [{ key: 'begriff', label: 'Begriff', kategorie: e.kategorie, werte: [e.begriff] }]
      : [];
    return vorweg.concat(bezuege(e));
  }

  /**
   * Die Auswahl eines Dropdowns: alle Werte, die auf irgendeiner Karte
   * richtig sein können — nicht alle Einträge der Kategorie. So ist jede
   * Option eine mögliche Antwort (bei den Rollen etwa nur die neun, die
   * überhaupt verantwortlich zeichnen).
   */
  function poolVon(kategorie) {
    if (!pool) {
      pool = {};
      var gesehen = {};
      var merken = function (kat, werte) {
        if (!pool[kat]) { pool[kat] = []; gesehen[kat] = {}; }
        werte.forEach(function (w) {
          if (gesehen[kat][w]) { return; }
          gesehen[kat][w] = true;
          pool[kat].push(w);
        });
      };
      KATEGORIEN.forEach(function (kat) {
        kartenDerKategorie(kat).forEach(function (e) {
          merken(kat, [e.begriff]);
          bezuege(e).forEach(function (z) { merken(z.kategorie, z.werte); });
        });
      });
      Object.keys(pool).forEach(function (kat) {
        pool[kat] = kat === 'phase'
          ? HT.daten.phasenSortiert(pool[kat])
          : pool[kat].sort(function (a, b) { return a.localeCompare(b, 'de'); });
      });
    }
    return pool[kategorie] || [];
  }

  /* --- Stapel ------------------------------------------------------------- */

  /* Ohne Definition keine Karte, bei Aufgaben und Ergebnissen auch nicht ohne Bezüge. */
  function kartenDerKategorie(kat) {
    return HT.daten.eintraegeDerKategorie(kat).filter(function (e) {
      return !!e.definition && (istGrundbegriff(e) || bezuege(e).length > 0);
    });
  }

  /* Grundbegriffe stehen nicht unter HT.daten.eintragMitId (nur die Lernkarten kennen sie). */
  function eintragFuer(id) {
    return HT.daten.eintragMitId(id)
      || HT.daten.eintraegeDerKategorie('grundbegriff').filter(function (e) { return e.id === id; })[0]
      || null;
  }

  /* Gibt es zu diesem Element eine Karte? Dieselbe Bedingung wie
     kartenDerKategorie, aber für ein einzelnes Element — Rollen, Phasen,
     Module und Szenarien haben nie eine, Sammelkarten wie «Checklisten»
     und «Meilensteine» mangels Bezügen auch nicht. */
  function karteFuer(id) {
    var e = eintragFuer(id);
    if (!e || KATEGORIEN.indexOf(e.kategorie) === -1) { return null; }
    return e.definition && (istGrundbegriff(e) || bezuege(e).length > 0) ? e : null;
  }

  /* Feste Nummer je Karte, gezählt in der Reihenfolge der Liste über alle
     Kategorien — Aufgaben, Ergebnisse, Grundbegriffe, darin alphabetisch —,
     unabhängig von Filter, Stapel und Vorderseite. */
  var nummern = null;      // id -> Nummer

  function kartenAlphabetisch(kat) {
    return kartenDerKategorie(kat).sort(function (a, b) {
      return a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  function nummerVon(id) {
    if (!nummern) {
      nummern = {};
      var n = 0;
      KATEGORIEN.forEach(function (kat) {
        kartenAlphabetisch(kat).forEach(function (e) { nummern[e.id] = ++n; });
      });
    }
    return nummern[id] || null;
  }

  /** «Nr. 57» im Kopf der Karte, neben der Kategorie. */
  function nummerMarke(e) {
    var nr = nummerVon(e.id);
    return nr ? h('span', { class: 'lk-nr', text: 'Nr. ' + nr }) : null;
  }

  function auswahl() {
    var kats = zustand.filter.length ? zustand.filter : KATEGORIEN;
    return kats.reduce(function (alle, k) { return alle.concat(kartenDerKategorie(k)); }, []);
  }

  function neueKarte() {
    zustand.gedreht = false;
    zustand.antworten = {};
  }

  function stapelAufbauen(auchGewusste) {
    var karten = auswahl();
    var ids = karten
      .filter(function (e) { return auchGewusste || zustand.fortschritt[e.id] !== 'gewusst'; })
      .map(function (e) { return e.id; });
    zustand.stapel = HT.ui.mischen(ids);
    zustand.zurueck = [];
    neueKarte();
  }

  function zaehlen() {
    var karten = auswahl();
    var gewusst = 0, nichtGewusst = 0;
    karten.forEach(function (e) {
      if (zustand.fortschritt[e.id] === 'gewusst') { gewusst++; }
      else if (zustand.fortschritt[e.id] === 'nochmals') { nichtGewusst++; }
    });
    return { gesamt: karten.length, gewusst: gewusst, nichtGewusst: nichtGewusst, offen: zustand.stapel.length };
  }

  /** Stand der laufenden Karte über alle Zeilen; angefangene zählen nicht. */
  function auswertung(e) {
    var alle = fragen(e);
    var beantwortet = 0;
    var richtig = 0;
    alle.forEach(function (z) {
      var a = zustand.antworten[z.key];
      if (!a || !a.fertig) { return; }
      beantwortet++;
      if (a.richtig) { richtig++; }
    });
    return {
      gesamt: alle.length,
      beantwortet: beantwortet,
      richtig: richtig,
      fertig: beantwortet === alle.length
    };
  }

  /* --- Kartenaufbau ------------------------------------------------------- */

  function zeichenFuer(richtig) {
    return h('span', {
      class: 'lk-zeichen lk-zeichen--' + (richtig ? 'gut' : 'schlecht'),
      role: 'img',
      'aria-label': richtig ? 'richtig' : 'falsch',
      text: richtig ? '✓' : '✗'
    });
  }

  /* Ab so vielen Optionen bekommt das Kombinationsfeld ein Suchfeld: Phasen
     (6), Module (12) und die neun verantwortlichen Rollen sucht man nicht,
     Aufgaben (71) und Ergebnisse (110) schon. */
  var SUCHE_AB = 14;
  var kombiNummer = 0;
  var offeneListe = null;      // nur eine Liste steht offen

  function passt(wert, suche) {
    if (!suche) { return true; }
    return HT.daten.normalisieren(wert).indexOf(HT.daten.normalisieren(suche)) !== -1;
  }

  function istSchmal() {
    return !!(global.matchMedia && global.matchMedia('(max-width: 699.98px)').matches);
  }

  /* Der Teil des Fensters, in dem eine Liste zu sehen ist: ohne Tastatur
     (visualViewport), unter der Kopfzeile und über der unteren Leiste. */
  function sichtbarerBereich() {
    var vv = global.visualViewport;
    var oben = vv ? vv.offsetTop : 0;
    var unten = vv ? vv.offsetTop + vv.height : global.innerHeight;
    var kopf = document.querySelector('.topbar');
    if (kopf) { oben = Math.max(oben, kopf.getBoundingClientRect().bottom); }
    var leiste = document.querySelector('.nav-bottom');
    if (leiste && leiste.offsetHeight) { unten = Math.min(unten, leiste.getBoundingClientRect().top); }
    return { oben: oben, unten: unten };
  }

  /**
   * Kombinationsfeld: Liste zum Aufklappen, bei langen Listen mit Suche.
   * Mehrfachauswahl — was gewählt ist, verschwindet aus der Liste; die Zeile
   * selbst entscheidet, was die Wahl bedeutet (opt.beiWahl).
   * opt: { label, vergeben: [Werte], beiWahl(wert) }
   */
  function kombiFeld(optionen, opt) {
    var id = 'lk-liste-' + (++kombiNummer);
    var mitSuche = optionen.length >= SUCHE_AB;
    var feld = h('input', {
      type: 'text', class: 'lk-kombi__feld',
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id,
      'aria-autocomplete': mitSuche ? 'list' : 'none', 'aria-label': opt.label,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: mitSuche ? 'suchen oder wählen …' : 'wählen …'
    });
    if (!mitSuche) { feld.readOnly = true; }
    var liste = h('ul', { class: 'lk-kombi__liste', id: id, role: 'listbox', 'aria-label': opt.label, hidden: true });
    var el = h('div', { class: 'lk-kombi' }, [feld, liste]);
    var offen = false, aktiv = -1, sichtbar = [], vergeben = {};
    (opt.vergeben || []).forEach(function (w) { vergeben[w] = true; });

    /* Die offene Liste schwebt (position: fixed) und hängt am body: in der
       Karte stünde sie im Fluss und würde sie auseinanderziehen — die Karte
       rollt bei max-height 70vh und schnitte die Liste ab. Geschlossen kehrt
       sie in die Hülle zurück, damit ein Neuaufbau sie mitnimmt.
       Auf dem Telefon steht sie immer unter dem Feld: fehlt dort der Platz
       (Tastatur, untere Leiste), rollt die Seite das Feld nach oben, statt
       die Liste nach oben zu klappen — oben verschwand sie am Fensterrand,
       weil innerHeight die Tastatur nicht kennt. mitRollen nur beim Öffnen
       und wenn die Tastatur kommt, nicht beim Rollen von Hand.
       Gerollt wird gleich ganz, bis das Feld unter der Kopfzeile steht: nur
       so weit wie nötig zu rollen, liess das Feld beim Tippen springen —
       die Tastatur wächst beim ersten Buchstaben um die Vorschlagsleiste,
       und jedes Wachsen rollte ein Stück weiter.
       Auf dem Telefon hängt die Liste zudem an der Seite (position:
       absolute) statt am Fenster: fixed nachgeführt hinkte sie beim Rollen
       den Scroll-Ereignissen hinterher und zuckte, und das Ein- und
       Ausblenden der Adressleiste rollte gegen die Hand. Sie rollt jetzt
       ohne Skript mit; neu gerechnet wird nur, wenn die Tastatur kommt
       (die sichtbare Höhe sinkt um mehr als 120 px) oder die Breite sich
       ändert. */
    function positionieren(mitRollen) {
      var b = sichtbarerBereich();
      var r = feld.getBoundingClientRect();
      var unten = b.unten - r.bottom - 10;
      var oben = r.top - b.oben - 10;
      var schmal = istSchmal();
      if (schmal && mitRollen === true) {
        var bedarf = Math.min(240, Math.max(110, liste.scrollHeight));
        /* Steht das Feld schon oben, nicht um Bruchteile nachrollen. */
        var weg = unten < bedarf ? oben : 0;
        if (weg > 2) {
          /* instant: die Seite rollt sonst weich (scroll-behavior), und die
             Liste stünde bis zum Ende des Rollens noch über dem Feld. */
          global.scrollBy({ top: Math.ceil(weg), behavior: 'instant' });
          r = feld.getBoundingClientRect();
          unten = b.unten - r.bottom - 10;
          oben = r.top - b.oben - 10;
        }
      }
      /* Klappt nur noch, wenn die Seite nicht weiter rollen kann. */
      var nachOben = schmal ? unten < 110 && oben > unten : unten < 170 && oben > unten;
      var hoehe = Math.max(110, Math.min(240, nachOben ? oben : unten));
      liste.style.width = Math.round(r.width) + 'px';
      liste.style.maxHeight = Math.round(hoehe) + 'px';
      if (schmal) {
        var sy = global.pageYOffset || 0;
        liste.style.position = 'absolute';
        /* Unter der Kopfzeile (z-index 40) und der unteren Leiste (45):
           rollt die Seite, gleitet die Liste hinter sie statt darüber. */
        liste.style.zIndex = '35';
        liste.style.left = Math.round(r.left + (global.pageXOffset || 0)) + 'px';
        liste.style.bottom = 'auto';
        liste.style.top = Math.round(sy + (nachOben ? r.top - 4 - liste.offsetHeight : r.bottom + 4)) + 'px';
        return;
      }
      liste.style.position = '';
      liste.style.zIndex = '';
      liste.style.left = Math.round(r.left) + 'px';
      if (nachOben) {
        liste.style.top = 'auto';
        liste.style.bottom = Math.round(global.innerHeight - r.top + 4) + 'px';
      } else {
        liste.style.bottom = 'auto';
        liste.style.top = Math.round(r.bottom + 4) + 'px';
      }
    }

    /* Rollen: nur auf breiten Schirmen nachführen (dort auch das Rollen der
       Karte); auf dem Telefon rollt die Liste mit der Seite. */
    function nachfuehren() { if (!istSchmal()) { positionieren(false); } }

    var hoeheZuletzt = 0, breiteZuletzt = 0;
    function sichtbareHoehe() {
      return global.visualViewport ? global.visualViewport.height : global.innerHeight;
    }
    /* Grössenänderung: kommt die Tastatur, Platz unter dem Feld schaffen;
       die Adressleiste (rund 60 px) übergeht das Telefon. */
    function platzSchaffen() {
      var hoehe = sichtbareHoehe(), breite = global.innerWidth;
      var tastatur = hoehe < hoeheZuletzt - 120;
      var quer = breite !== breiteZuletzt;
      hoeheZuletzt = hoehe;
      breiteZuletzt = breite;
      if (istSchmal() && !tastatur && !quer) { return; }
      positionieren(tastatur);
    }

    function zeichnen() {
      HT.ui.leeren(liste);
      sichtbar = optionen.filter(function (w) { return !vergeben[w] && passt(w, mitSuche ? feld.value : ''); });
      if (aktiv >= sichtbar.length) { aktiv = sichtbar.length - 1; }
      if (!sichtbar.length) {
        liste.appendChild(h('li', { class: 'lk-kombi__leer', text: 'Nichts gefunden' }));
        feld.removeAttribute('aria-activedescendant');
        return;
      }
      sichtbar.forEach(function (w, i) {
        var o = h('li', {
          class: 'lk-kombi__option' + (i === aktiv ? ' ist-aktiv' : ''),
          role: 'option', id: id + '-o' + i, 'aria-selected': i === aktiv ? 'true' : 'false', text: w
        });
        /* mousedown statt click: sonst nimmt der Fokuswechsel die Liste weg,
           bevor die Wahl ankommt. */
        o.addEventListener('mousedown', function (ev) { ev.preventDefault(); waehlen(w); });
        liste.appendChild(o);
      });
      if (aktiv >= 0) {
        feld.setAttribute('aria-activedescendant', id + '-o' + aktiv);
        var el2 = liste.children[aktiv];
        if (el2 && el2.scrollIntoView) { el2.scrollIntoView({ block: 'nearest' }); }
      } else {
        feld.removeAttribute('aria-activedescendant');
      }
    }

    function oeffnen() {
      if (offen || feld.disabled) { return; }
      if (offeneListe && offeneListe !== schliessen) { offeneListe(); }
      offeneListe = schliessen;
      offen = true;
      aktiv = -1;
      document.body.appendChild(liste);
      liste.hidden = false;
      feld.setAttribute('aria-expanded', 'true');
      zeichnen();
      hoeheZuletzt = sichtbareHoehe();
      breiteZuletzt = global.innerWidth;
      positionieren(true);
      /* true: auch das Rollen der Karte selbst führt die Liste nach. */
      global.addEventListener('scroll', nachfuehren, true);
      global.addEventListener('resize', platzSchaffen);
      if (global.visualViewport) {
        global.visualViewport.addEventListener('resize', platzSchaffen);
        global.visualViewport.addEventListener('scroll', nachfuehren);
      }
    }

    function schliessen() {
      if (!offen) { return; }
      offen = false;
      liste.hidden = true;
      el.appendChild(liste);
      global.removeEventListener('scroll', nachfuehren, true);
      global.removeEventListener('resize', platzSchaffen);
      if (global.visualViewport) {
        global.visualViewport.removeEventListener('resize', platzSchaffen);
        global.visualViewport.removeEventListener('scroll', nachfuehren);
      }
      feld.setAttribute('aria-expanded', 'false');
      feld.removeAttribute('aria-activedescendant');
      if (offeneListe === schliessen) { offeneListe = null; }
    }

    function waehlen(w) {
      vergeben[w] = true;
      feld.value = '';
      opt.beiWahl(w);
      if (!feld.disabled) { zeichnen(); positionieren(); feld.focus(); }
    }

    function bewegen(schritt) {
      if (!offen) { oeffnen(); return; }
      if (!sichtbar.length) { return; }
      aktiv = (aktiv + schritt + sichtbar.length + 1) % (sichtbar.length + 1);
      if (aktiv === sichtbar.length) { aktiv = schritt > 0 ? 0 : sichtbar.length - 1; }
      zeichnen();
    }

    feld.addEventListener('focus', oeffnen);
    /* Ein Tipp ins offene Suchfeld setzt nur den Cursor; schliessen würde die
       Liste beim nächsten Buchstaben wieder aufgehen und springen lassen. */
    feld.addEventListener('mousedown', function () {
      if (!offen) { oeffnen(); } else if (!mitSuche) { schliessen(); }
    });
    /* Nach dem Filtern neu setzen: eine nach oben geklappte Liste wird kürzer
       und muss am Feld bleiben. */
    feld.addEventListener('input', function () { aktiv = -1; if (!offen) { oeffnen(); } else { zeichnen(); positionieren(); } });
    feld.addEventListener('blur', schliessen);
    feld.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); bewegen(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); bewegen(-1); }
      else if (ev.key === 'Escape') { if (offen) { ev.stopPropagation(); schliessen(); } }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (aktiv >= 0 && sichtbar[aktiv]) { waehlen(sichtbar[aktiv]); }
        else if (sichtbar.length === 1) { waehlen(sichtbar[0]); }
      }
    });

    return {
      el: el,
      sperren: function () {
        schliessen();
        feld.disabled = true;
        feld.value = '';
        el.classList.add('ist-gesperrt');
      }
    };
  }

  /**
   * Eine Abfragezeile der Vorderseite: Bezeichnung, die schon gewählten
   * Werte, das Kombinationsfeld und der Stand. Gesucht sind alle Werte der
   * Zeile (z.pflicht); jede Wahl wird sofort geprüft, die erste falsche
   * beendet sie. Ein freiwilliger Wert (Umsetzung) zählt als richtig, aber
   * nicht zum Gefundenen.
   */
  function frageZeile(z, beiAntwort) {
    var a = zustand.antworten[z.key];
    if (!a || !Array.isArray(a.gewaehlt)) {
      a = zustand.antworten[z.key] = { gewaehlt: [], fertig: false, richtig: false };
    }
    var pflicht = z.pflicht || z.werte;
    var mehrere = pflicht.length > 1;
    var chips = h('div', { class: 'lk-chips', hidden: true });
    var stand = h('span', { class: 'lk-frage__stand' });
    var kombi = kombiFeld(poolVon(z.kategorie), {
      label: z.label,
      vergeben: a.gewaehlt.map(function (g) { return g.wert; }),
      beiWahl: function (w) { waehlen(w); }
    });

    var zeile = h('div', { class: 'lk-frage', role: 'group', 'aria-label': z.label, dataset: { stand: 'offen' } }, [
      h('span', { class: 'lk-frage__label' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: z.label })
      ]),
      h('div', { class: 'lk-frage__feld' }, [chips, kombi.el]),
      stand
    ]);

    function gefunden() {
      return a.gewaehlt.filter(function (g) { return g.richtig && pflicht.indexOf(g.wert) !== -1; }).length;
    }

    function zeichnen() {
      HT.ui.leeren(chips);
      a.gewaehlt.forEach(function (g) {
        var art = !g.richtig ? 'schlecht' : istFreiwillig(z, g.wert) ? 'freiwillig' : 'gut';
        chips.appendChild(h('span', { class: 'lk-chip lk-chip--' + art }, [
          h('span', { 'aria-hidden': 'true', text: g.richtig ? '✓' : '✗' }),
          h('span', { text: g.wert })
        ]));
      });
      chips.hidden = !a.gewaehlt.length;
      /* Bei einem einzigen gesuchten Wert sagt das Zeichen alles — «1 von 1»
         wäre nur Lärm. */
      HT.ui.leeren(stand);
      if (a.fertig) {
        stand.appendChild(zeichenFuer(a.richtig));
        if (mehrere) { stand.appendChild(h('span', { text: gefunden() + ' von ' + pflicht.length })); }
      } else if (mehrere) {
        stand.appendChild(h('span', { text: gefunden() + ' von ' + pflicht.length + ' gefunden' }));
      }
      zeile.dataset.stand = a.fertig ? (a.richtig ? 'richtig' : 'falsch') : (a.gewaehlt.length ? 'begonnen' : 'offen');
    }

    function waehlen(w) {
      if (a.fertig) { return; }
      var richtig = z.werte.indexOf(w) !== -1;
      a.gewaehlt.push({ wert: w, richtig: richtig });
      if (!richtig) { a.fertig = true; a.richtig = false; }
      else if (gefunden() >= pflicht.length) { a.fertig = true; a.richtig = true; }
      if (a.fertig) { kombi.sperren(); }
      zeichnen();
      beiAntwort();
    }

    if (a.fertig) { kombi.sperren(); }
    zeichnen();
    return { el: zeile, sperren: kombi.sperren };
  }

  /* Die fünf Punkte einer Karte: «Gewusst» grün, «Nochmals» rot, ältester
     links; noch freie Plätze als leere Ringe rechts davon. */
  function verlaufPunkte(id) {
    var v = verlaufVon(id);
    var punkte = [];
    for (var i = 0; i < VERLAUF_LAENGE; i++) {
      punkte.push(h('span', { class: 'lk-verlauf__punkt' + (v[i] ? ' lk-verlauf__punkt--' + v[i] : '') }));
    }
    return punkte;
  }

  /* Was die Punkte sagen, in Worten — für Tooltip und Vorlesesoftware. */
  function verlaufText(id) {
    var v = verlaufVon(id);
    return v.length
      ? (v.length === 1 ? 'Letzter Versuch: ' : 'Letzte ' + v.length + ' Versuche, ältester zuerst: ')
        + v.map(function (w) { return w === 'gewusst' ? 'gewusst' : 'nochmals'; }).join(', ')
      : 'Noch kein Versuch mit dieser Karte';
  }

  /** Rechts neben den Verweisen die letzten fünf Versuche als Punkte. */
  function verlaufAnzeige(e) {
    var text = verlaufText(e.id);
    return h('span', { class: 'lk-verlauf', role: 'img', title: text, 'aria-label': text }, verlaufPunkte(e.id));
  }

  /** Am Fuss beider Seiten die drei Wege weiter: das Element im Überblick, im
      Handbuch und auf der offiziellen Seite, rechts davon der Verlauf. Solange
      der Begriff gesucht ist (Vorderseite «Definition»), nennen die Tooltips
      ihn nicht. Grundbegriffe stehen weder im Überblick noch im Handbuch — bei
      ihnen nur HERMES online. */
  function verweise(e, mitBegriff) {
    var name = mitBegriff ? e.begriff : 'Das Element';
    var offiziell = HT.ui.quellenLink(e.quelle, 'lk-verweis lk-verweis--akzent');
    if (offiziell && !mitBegriff) {
      offiziell.setAttribute('title', 'HERMES online');
      offiziell.setAttribute('aria-label', 'HERMES online (öffnet in neuem Tab)');
    }
    if (istGrundbegriff(e)) {
      return h('div', { class: 'flip__hinweis lk-verweise' }, [offiziell, verlaufAnzeige(e)]);
    }
    return h('div', { class: 'flip__hinweis lk-verweise' }, [
      h('a', {
        class: 'lk-verweis', href: '#/ueberblick?id=' + encodeURIComponent(e.id),
        text: 'Im Überblick', title: name + ' im Überblick zeigen'
      }),
      h('a', {
        class: 'lk-verweis', href: '#/handbuch?id=' + encodeURIComponent(e.id),
        text: 'Im Handbuch', title: name + ' im Handbuch zeigen'
      }),
      offiziell,
      verlaufAnzeige(e)
    ]);
  }

  function seiteVorne(e, beiAntwort) {
    var istBegriff = !begriffGesucht();
    var sperren = [];

    /* Oben eine Zeile: links der Begriff mit Kategorie und Nummer, rechts die
       Wahl, was vorne steht. Ist der Begriff gesucht, steht dort nur die
       Kategorie, und die Definition folgt darunter — ohne den gesuchten
       Begriff. */
    var kopf = h('div', { class: 'lk-kopf' }, [
      istBegriff ? h('div', { class: 'flip__inhalt lk-kopf__begriff', text: e.begriff }) : null,
      HT.ui.badge(e.kategorie),
      nummerMarke(e),
      seitenWahl()
    ]);

    var inhalt = istBegriff ? null : h('div', {
      class: 'flip__inhalt flip__inhalt--klein',
      text: HT.ui.ohneBegriff(e.definition, e.begriff)
    });

    var liste = h('div', { class: 'lk-fragen' }, fragen(e).map(function (z) {
      var zeile = frageZeile(z, beiAntwort);
      sperren.push(zeile.sperren);
      return zeile.el;
    }));

    var seite = h('div', {
      class: 'flip__seite flip__seite--vorne',
      tabindex: '-1',
      'aria-hidden': 'false'
    }, [kopf, inhalt, istGrundbegriff(e) ? h('p', {
      class: 'lk-auftrag',
      /* Die Zuordnungszeilen erklären sich selbst (die Regel steht in der
         Info-Karte der Leiste); ein Grundbegriff mit Begriff vorn hat nichts
         zu wählen: umdrehen und selbst einschätzen. */
      text: istBegriff
        ? 'Was bedeutet der Begriff? Karte anklicken und selbst einschätzen.'
        : 'Welcher Begriff ist gemeint? Die Wahl wird sofort geprüft:'
    }) : null, liste, verweise(e, istBegriff)]);

    return { el: seite, sperren: sperren };
  }

  /** Eine Bezugszeile der Lösung: alle gesuchten Werte — was man selbst
      gefunden hat, ist markiert —, dahinter die falsche Wahl, an der die
      Zeile endete. */
  function loesungZeile(z) {
    var a = zustand.antworten[z.key];
    var gefunden = {}, falsche = [];
    if (a) {
      a.gewaehlt.forEach(function (g) {
        if (g.richtig) { gefunden[g.wert] = true; } else { falsche.push(g.wert); }
      });
    }
    var werte = z.werte.map(function (w) {
      var klassen = [gefunden[w] ? 'ist-gewaehlt' : '', istFreiwillig(z, w) ? 'ist-freiwillig' : ''].join(' ').trim();
      return h('li', { class: klassen || null }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: w })
      ]);
    });
    falsche.forEach(function (w) {
      werte.push(h('li', { class: 'ist-falsch' }, [
        HT.ui.katSymbol(z.kategorie, 14),
        h('span', { text: w })
      ]));
    });
    return h('div', { class: 'lk-bezug' }, [
      h('dt', {}, [a && a.fertig ? zeichenFuer(a.richtig) : null, h('span', { text: z.labelLoesung || z.label })]),
      h('dd', {}, [h('ul', { class: 'lk-werte' }, werte)])
    ]);
  }

  /** Inhalt der Rückseite; er entsteht erst beim Drehen, mit den Zeichen der eigenen Wahl. */
  function hintenFuellen(el, e) {
    var st = auswertung(e);
    var begriffAntwort = zustand.antworten.begriff;

    /* Wer die Karte vor der letzten Wahl dreht, soll die offenen Zuordnungen
       nicht als Fehler gezählt sehen. Ohne Frage (Grundbegriff, Begriff vorn)
       gibt es keine Bilanz. */
    var bilanz = null;
    if (st.gesamt && !st.beantwortet) {
      bilanz = h('span', { text: 'ohne Zuordnung' });
    } else if (st.gesamt) {
      bilanz = h('span', {
        class: st.richtig === st.beantwortet ? 'tag-gut' : 'tag-schlecht',
        /* Eine Karte mit einer einzigen Frage (Grundbegriffe) braucht kein «1 von 1». */
        text: st.gesamt === 1
          ? (st.richtig ? 'richtig' : 'falsch')
          : st.fertig
            ? st.richtig + ' von ' + st.gesamt + ' richtig'
            : st.richtig + ' von ' + st.beantwortet + ' richtig, ' + (st.gesamt - st.beantwortet) + ' offen'
      });
    }

    /* Dieselbe Kopfzeile wie vorn: links Begriff und Kategorie, rechts
       statt der Wahl die Bilanz. */
    el.appendChild(h('div', { class: 'lk-kopf' }, [
      h('div', { class: 'flip__inhalt lk-kopf__begriff' }, [
        begriffAntwort && begriffAntwort.fertig ? zeichenFuer(begriffAntwort.richtig) : null,
        h('span', { text: e.begriff })
      ]),
      HT.ui.badge(e.kategorie),
      nummerMarke(e),
      h('div', { class: 'flip__rolle' }, [h('span', { text: 'Lösung' }), bilanz ? ' · ' : null, bilanz])
    ]));
    if (begriffAntwort && begriffAntwort.fertig && !begriffAntwort.richtig) {
      el.appendChild(h('p', {
        class: 'lk-gewaehlt',
        text: 'Gewählt: ' + begriffAntwort.gewaehlt.map(function (g) { return g.wert; }).join(', ')
      }));
    }

    if (bezuege(e).length) {
      el.appendChild(h('dl', { class: 'lk-bezuege' }, bezuege(e).map(loesungZeile)));
    }
    el.appendChild(h('div', { class: 'flip__inhalt flip__inhalt--klein', text: e.definition }));

    el.appendChild(verweise(e, true));
  }

  function kartenBereichAufbauen() {
    var bereich = h('div', {});
    var st = zaehlen();

    if (!st.gesamt) {
      bereich.appendChild(HT.ui.leerZustand(
        'Keine Karten im gewählten Umfang',
        HT.daten.alleEintraege().length
          ? 'Für die gewählten Kategorien gibt es keine Karten. Filter anpassen.'
          : 'Die Datendateien in data/ sind derzeit leer. Sobald Einträge erfasst sind, entstehen daraus Lernkarten.'
      ));
      return bereich;
    }

    if (!zustand.stapel.length) {
      bereich.appendChild(h('div', { class: 'box abschluss' }, [
        h('p', { class: 'abschluss__zahl', text: st.gewusst + ' / ' + st.gesamt }),
        h('p', { text: 'Stapel durchgearbeitet — alle Karten als «Gewusst» eingestuft.' }),
        h('div', { class: 'btn-reihe', style: 'justify-content:center' }, [
          h('button', {
            type: 'button', class: 'btn btn--primaer', text: 'Stapel neu mischen',
            on: { click: function () { stapelAufbauen(true); neuZeichnen(true); } }
          }),
          h('button', {
            type: 'button', class: 'btn', text: 'Fortschritt zurücksetzen',
            on: { click: zuruecksetzen }
          })
        ])
      ]));
      /* Auch ohne Karte: zurück zur zuletzt gezeigten und zur Liste. */
      bereich.appendChild(h('div', { class: 'lk-aktionen' }, [
        h('div', { class: 'lk-aktionen__links' }, [zurueckKnopf()]),
        h('div', { class: 'lk-aktionen__rechts' }, [listeKnopf(), weiterKnopf()])
      ]));
      return bereich;
    }

    var e = eintragFuer(zustand.stapel[0]);
    if (!e) {                              // Datenlage hat sich geändert
      zustand.stapel.shift();
      return kartenBereichAufbauen();
    }

    var vorne = seiteVorne(e, function () { antwortGezaehlt(); });
    var hinten = h('div', { class: 'flip__seite flip__seite--hinten', tabindex: '-1', 'aria-hidden': 'true' });
    /* Ohne Wahl auf der Vorderseite (Grundbegriff, Begriff vorn) dreht auch
       ein Klick auf die Karte. */
    var ohneWahl = !fragen(e).length;
    var flip = h('div', { class: 'flip' + (ohneWahl ? ' flip--klickbar' : '') }, [vorne.el, hinten]);

    var drehKnopf = h('button', {
      type: 'button', class: 'btn lk-knopf lk-drehen', text: 'Lösung', title: 'Karte drehen und die Lösung zeigen'
    });
    var gewusstBtn = h('button', {
      type: 'button', class: 'btn btn--gut lk-knopf', text: 'Gewusst', disabled: true
    });
    var nochmalsBtn = h('button', {
      type: 'button', class: 'btn btn--schlecht lk-knopf', text: 'Nochmals', disabled: true
    });

    function drehen() {
      if (zustand.gedreht) { return; }
      zustand.gedreht = true;
      hintenFuellen(hinten, e);
      flip.classList.add('ist-gedreht');
      vorne.el.setAttribute('aria-hidden', 'true');
      hinten.setAttribute('aria-hidden', 'false');
      /* Hinter der Rückseite darf nichts mehr zu bedienen sein; wie viel
         richtig war, sagt jetzt der Kopf der Lösung. */
      vorne.sperren.forEach(function (sperre) { sperre(); });
      drehKnopf.hidden = true;
      gewusstBtn.disabled = false;
      nochmalsBtn.disabled = false;
      /* Der Fokus geht auf die Lösung, nicht auf «Gewusst» oder «Nochmals»:
         nach einer Wahl im Feld zeigte Chrome dort den roten Fokusring, als
         wäre der Knopf schon gewählt. Mit Tab erreicht man beide Knöpfe. */
      hinten.focus({ preventScroll: true });
    }

    /* Ist die letzte Zuordnung getroffen, dreht sich die Karte von selbst —
       kurz danach, damit das Zeichen der letzten Wahl noch zu sehen ist. */
    function antwortGezaehlt() {
      if (!auswertung(e).fertig || zustand.gedreht) { return; }
      global.setTimeout(function () {
        /* Nicht mehr zu sehen (geblättert, Wechsel zur Liste, andere
           Kategorie): nicht drehen — sonst gälte die neu gezeichnete Karte
           als gedreht. */
        if (flip.isConnected && zustand.stapel[0] === e.id) { drehen(); }
      }, DREH_VERZUG);
    }

    drehKnopf.addEventListener('click', drehen);
    if (ohneWahl) {
      vorne.el.addEventListener('click', function (ev) {
        /* Verweise und die Wahl Begriff · Definition tun, was sie sonst tun;
           wer Text markiert, will nicht drehen. */
        if (ev.target.closest('a, button')) { return; }
        if (String(global.getSelection ? global.getSelection() : '')) { return; }
        drehen();
      });
    }
    gewusstBtn.addEventListener('click', function () { bewerten('gewusst'); });
    nochmalsBtn.addEventListener('click', function () { bewerten('nochmals'); });

    /* Zurück aus der Liste: eine schon gedrehte Karte steht wieder gedreht da
       (noch ausserhalb des Dokuments, also ohne Drehbewegung). */
    if (zustand.gedreht) {
      zustand.gedreht = false;
      drehen();
    }
    bereich.appendChild(h('div', { class: 'flip-wrap' }, flip));
    /* Unter der Karte eine Zeile: ‹ unter der linken Kartenkante, in der
       Mitte kleine Knöpfe, rechts die Liste und ›. */
    bereich.appendChild(h('div', { class: 'lk-aktionen' }, [
      h('div', { class: 'lk-aktionen__links' }, [zurueckKnopf()]),
      h('div', { class: 'lk-aktionen__knoepfe' }, [drehKnopf, nochmalsBtn, gewusstBtn]),
      h('div', { class: 'lk-aktionen__rechts' }, [listeKnopf(), weiterKnopf()])
    ]));

    return bereich;
  }

  /* --- Liste aller Karten ------------------------------------------------- */

  /** Alle Karten der gewählten Kategorien, je Kategorie eine Gruppe in der
      Reihenfolge der Chips, darin alphabetisch. Eine Zeile zeigt Nummer,
      Symbol, Begriff und die Punkte des Verlaufs; ein Klick übt die Karte. */
  function listeAufbauen() {
    var gruppen = KATEGORIEN.filter(function (kat) {
      return !zustand.filter.length || zustand.filter.indexOf(kat) !== -1;
    }).map(function (kat) {
      var karten = kartenAlphabetisch(kat);
      if (!karten.length) { return null; }
      return h('section', { class: 'lk-liste__gruppe' }, [
        h('h2', { class: 'lk-liste__titel', text: HT.daten.kategorieMeta(kat).label + ' · ' + karten.length }),
        h('ul', { class: 'lk-liste__karten' }, karten.map(function (e) {
          return h('li', {}, h('button', {
            type: 'button', class: 'lk-liste__karte',
            on: { click: function () { karteUeben(e.id); } }
          }, [
            h('span', { class: 'lk-liste__nr', text: String(nummerVon(e.id)) }),
            HT.ui.katSymbol(e.kategorie, 15),
            h('span', { class: 'lk-liste__begriff', text: e.begriff }),
            verlaufAnzeige(e)
          ]));
        }))
      ]);
    }).filter(Boolean);

    /* Über der Liste der Weg zurück, im Kleid der Verweise am Fuss der Karte. */
    var zurKarte = h('button', {
      type: 'button', class: 'lk-verweis lk-zur-karte', text: '‹ Zur Karte',
      on: { click: function () { ansichtSetzen('karte'); } }
    });
    if (!gruppen.length) {
      gruppen = [HT.ui.leerZustand(
        'Keine Karten im gewählten Umfang',
        HT.daten.alleEintraege().length
          ? 'Für die gewählten Kategorien gibt es keine Karten. Filter anpassen.'
          : 'Die Datendateien in data/ sind derzeit leer. Sobald Einträge erfasst sind, entstehen daraus Lernkarten.'
      )];
    }
    return h('div', { class: 'lk-liste' }, [zurKarte].concat(gruppen));
  }

  /** Aus der Liste: die Karte zuoberst auf den Stapel legen (auch eine
      gewusste) und zeigen. Ist sie schon die laufende, bleiben ihre Antworten;
      sonst führt ‹ zurück zu der, die vorher dran war. */
  function karteUeben(id) {
    if (zustand.stapel[0] !== id) {
      merken(zustand.stapel[0]);
      zustand.stapel = [id].concat(zustand.stapel.filter(function (s) { return s !== id; }));
      neueKarte();
    }
    ansichtSetzen('karte');
  }

  /* Fortschritt (js/fortschritt.js): Eine Karte meldet einmal, bei der
     Einschätzung, und zwar für alle Felder (Phase und Modul), in denen das
     Element wirklich steht.

     «Nochmals» färbt sie als «zuletzt falsch» — was man nicht wusste, soll
     auf der Tafel nicht grün stehen. «Gewusst» zählt nur, wenn die Karte
     Phase und Modul auch richtig zugeordnet hat: wer bloss umdreht und
     «Gewusst» drückt, hat für die Tafel nichts gezeigt. Karten ohne Bezüge
     (Grundbegriffe) melden nichts, sie haben kein Feld. */
  function fortschrittMelden(e, wert) {
    if (!HT.fortschritt || !e) { return; }
    var p = zustand.antworten.phase, m = zustand.antworten.modul;
    var richtig = wert === 'gewusst' && !!(p && p.richtig && m && m.richtig);
    if (!richtig && wert !== 'nochmals') { return; }
    var liste = [];
    (e.module || []).forEach(function (modul) {
      HT.daten.phasenImModul(e, modul).forEach(function (phase) {
        liste.push({ phase: phase, modul: modul, id: e.id, richtig: richtig });
      });
    });
    HT.fortschritt.melden(liste);
  }

  function bewerten(wert) {
    var id = zustand.stapel[0];
    if (!id) { return; }
    fortschrittMelden(eintragFuer(id), wert);
    zustand.verlauf[id] = verlaufVon(id).concat([wert]).slice(-VERLAUF_LAENGE);
    zustand.fortschritt[id] = wert;
    zustand.stapel.shift();
    if (wert === 'nochmals') { zustand.stapel.push(id); }
    merken(id);
    neueKarte();
    speichern();
    neuZeichnen(true);
  }

  /* --- Blättern ----------------------------------------------------------- */

  /* So viele gezeigte Karten merkt sich ‹ höchstens. */
  var ZURUECK_LAENGE = 100;

  /** Eine Karte verlässt die Anzeige: für ‹ merken. */
  function merken(id) {
    if (!id) { return; }
    zustand.zurueck.push(id);
    if (zustand.zurueck.length > ZURUECK_LAENGE) { zustand.zurueck.shift(); }
  }

  /** Die Karte, zu der ‹ führt: die zuletzt gezeigte, die nicht gerade offen
      ist («Nochmals» auf der letzten Karte zeigt dieselbe wieder). */
  function vorigeKarte() {
    for (var i = zustand.zurueck.length - 1; i >= 0; i--) {
      if (zustand.zurueck[i] !== zustand.stapel[0]) { return { id: zustand.zurueck[i], index: i }; }
    }
    return null;
  }

  /** ‹ legt die zuvor gezeigte Karte zuoberst auf den Stapel — auch eine, die
      inzwischen als gewusst gilt; die offene bleibt gleich dahinter liegen. */
  function zurueckBlaettern() {
    var vorige = vorigeKarte();
    if (!vorige) { return; }
    zustand.zurueck = zustand.zurueck.slice(0, vorige.index);
    zustand.stapel = [vorige.id].concat(zustand.stapel.filter(function (s) { return s !== vorige.id; }));
    neueKarte();
    neuZeichnen(true);
  }

  /** › überspringt die Karte ohne Einschätzung: sie kommt ans Ende des
      Stapels, eine schon gewusste fällt heraus (wie beim Mischen). */
  function weiterBlaettern() {
    if (zustand.stapel.length < 2) { return; }
    var id = zustand.stapel.shift();
    if (zustand.fortschritt[id] !== 'gewusst') { zustand.stapel.push(id); }
    merken(id);
    neueKarte();
    neuZeichnen(true);
  }

  var PFADE_LISTE = ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'];

  function ikonKnopf(klasse, label, pfade, beiKlick, gesperrt) {
    return h('button', {
      type: 'button', class: 'lk-ikon ' + klasse, title: label, 'aria-label': label,
      disabled: !!gesperrt, on: { click: beiKlick }
    }, HT.ui.symbol(pfade, 20));
  }

  function zurueckKnopf() {
    return ikonKnopf('lk-ikon--zurueck', 'Zurück zur vorigen Karte', ['M15 5l-7 7 7 7'], zurueckBlaettern, !vorigeKarte());
  }

  function weiterKnopf() {
    return ikonKnopf('lk-ikon--weiter', 'Weiter zur nächsten Karte', ['M9 5l7 7-7 7'], weiterBlaettern, zustand.stapel.length < 2);
  }

  function listeKnopf() {
    return ikonKnopf('lk-ikon--liste', 'Alle Karten als Liste', PFADE_LISTE, function () { ansichtSetzen('liste'); });
  }

  /** Einschätzung und Verlauf aller Karten löschen, ohne Rückfrage. */
  function einschaetzungenLoeschen() {
    zustand.fortschritt = {};
    zustand.verlauf = {};
    stapelAufbauen(true);
    speichern();
  }

  function zuruecksetzen() {
    var etwasVorhanden = Object.keys(zustand.fortschritt).length > 0;
    if (etwasVorhanden && !global.confirm('Lernfortschritt wirklich zurücksetzen? Alle Einschätzungen gehen verloren.')) {
      return;
    }
    einschaetzungenLoeschen();
    neuZeichnen(true);
  }

  /* Fortschrittsseite und Handbuch können offen sein, bevor die Lernkarten je
     gezeichnet wurden; wer von aussen fragt, füllt den Zustand notfalls
     selbst aus dem Speicher. */
  function standLesen() {
    if (zustand.initialisiert) { return; }
    wiederherstellen();
    zustand.initialisiert = true;
  }

  /** Die Adresse einer einzelnen Karte: #/trainer?teil=lernkarten&karte=… */
  function karteAdresse(id) {
    return '#/trainer?teil=lernkarten&karte=' + encodeURIComponent(id);
  }

  /* Was das Handbuch (über js/karte.js) braucht: die fünf Punkte einer Karte
     als Link auf sie. Zurück kommt null, wo es keine Karte gibt — dann steht
     auf der Handbuchkarte nichts. */
  function marke(id) {
    var e = karteFuer(id);
    if (!e) { return null; }
    standLesen();
    var nr = nummerVon(id);
    var text = verlaufText(id) + '. Lernkarte' + (nr ? ' Nr. ' + nr : '') + ' üben';
    return h('a', {
      class: 'lk-verlauf lk-verlauf--link', href: karteAdresse(id),
      title: text, 'aria-label': text
    }, verlaufPunkte(id));
  }

  /* Was die Fortschrittseite (js/fortschritt.js) braucht: ihr «Fortschritt
     zurücksetzen» leert beides — die Zähler der Tafel und die Einschätzung
     der Karten —, denn für den Sponsor ist beides ein Lernstand (2026-09-18). */
  HT.lernkarten = {
    marke: marke,
    eingeschaetzt: function () {
      if (zustand.initialisiert) { return Object.keys(zustand.fortschritt).length; }
      var g = HT.store.lies('lernkarten', null);
      return (g && g.version === VERSION && g.fortschritt && typeof g.fortschritt === 'object')
        ? Object.keys(g.fortschritt).length
        : 0;
    },
    leeren: function () {
      standLesen();
      einschaetzungenLoeschen();
      /* Die Karten stehen gerade woanders im Dokument nicht; nur eine noch
         hängende Ansicht wird nachgeführt. */
      if (refs.spiel && refs.spiel.isConnected) { neuZeichnen(false); }
    }
  };

  /* --- Fortschrittsanzeige ------------------------------------------------ */

  /** Rechts in der Zeile der Kategorien: gewusst und nicht gewusst (zuletzt
      «Nochmals»), je mit Anteil und ohne Wort — die Farbe sagt, welche Zahl
      welche ist (Tooltip nennt sie) —, der Balken aus beiden Anteilen, rechts
      der Anteil eingeschätzter Karten (gewusst und nicht gewusst) und
      «Zurücksetzen». Farben wie im Fortschritt des Trainers: gewusst grün,
      nicht gewusst rot, noch nicht eingeschätzt grau. */
  function fortschrittAufbauen() {
    var st = zaehlen();
    var anteil = HT.ui.prozent(st.gewusst + st.nichtGewusst, st.gesamt);
    var teilGewusst = h('div', { class: 'lk-balken__teil lk-balken__teil--gewusst' });
    var teilNicht = h('div', { class: 'lk-balken__teil lk-balken__teil--nicht' });
    teilGewusst.style.width = (st.gesamt ? st.gewusst / st.gesamt * 100 : 0) + '%';
    teilNicht.style.width = (st.gesamt ? st.nichtGewusst / st.gesamt * 100 : 0) + '%';

    function zahl(n, klasse, name) {
      var text = n + ' ' + name + ' (' + HT.ui.prozent(n, st.gesamt) + ' %)';
      /* Immer gefärbt, auch bei 0: ohne Wort unterscheidet nur die Farbe die beiden. */
      return h('span', { class: 'lk-zahl ' + klasse, title: text, 'aria-label': text }, [
        h('b', { text: String(n) }),
        h('span', { class: 'lk-zahl__anteil', text: HT.ui.prozent(n, st.gesamt) + ' %' })
      ]);
    }

    return h('div', { class: 'lk-fortschritt' }, [
      h('span', { class: 'lk-fortschritt__zahlen' }, [
        zahl(st.gewusst, 'lk-zahl--gewusst', 'gewusst'),
        h('span', { class: 'lk-fortschritt__trenner', 'aria-hidden': 'true', text: '·' }),
        zahl(st.nichtGewusst, 'lk-zahl--nicht', 'nicht gewusst'),
        h('span', { class: 'lk-fortschritt__trenner', 'aria-hidden': 'true', text: '·' }),
        h('span', { text: 'von ' + st.gesamt })
      ]),
      h('div', {
        class: 'fortschritt__balken lk-balken',
        role: 'img',
        'aria-label': st.gewusst + ' gewusst, ' + st.nichtGewusst + ' nicht gewusst, '
          + (st.gesamt - st.gewusst - st.nichtGewusst) + ' noch nicht eingeschätzt'
      }, [teilGewusst, teilNicht]),
      h('span', { title: 'Anteil eingeschätzter Karten (gewusst und nicht gewusst)', text: anteil + ' %' }),
      /* Als Icon: mit beiden Zahlen passt die Zeile sonst bei 1470 px nicht
         mehr neben die Kategorien. */
      h('button', {
        type: 'button', class: 'lk-zuruecksetzen',
        title: 'Lernfortschritt zurücksetzen', 'aria-label': 'Lernfortschritt zurücksetzen',
        on: { click: zuruecksetzen }
      }, HT.ui.symbol(['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4.2v4.3h4.3'], 16))
    ]);
  }

  /** Karte oder Liste zeigen; die Seite beginnt dann wieder oben. In der
      Liste steht der Fokus auf «Zur Karte», zurück auf der Karte. */
  function ansichtSetzen(ansicht) {
    zustand.ansicht = ansicht;
    speichern();
    neuZeichnen(ansicht === 'karte');
    if (ansicht === 'liste') {
      var zurKarte = refs.spiel.querySelector('.lk-zur-karte');
      if (zurKarte) { zurKarte.focus({ preventScroll: true }); }
    }
    global.scrollTo({ top: 0, behavior: 'instant' });
  }

  function neuZeichnen(fokusKarte) {
    if (!refs.spiel) { return; }
    HT.ui.leeren(refs.fortschritt).appendChild(fortschrittAufbauen());
    HT.ui.leeren(refs.spiel).appendChild(zustand.ansicht === 'liste' ? listeAufbauen() : kartenBereichAufbauen());
    if (fokusKarte) {
      /* Die Karte selbst, nicht das erste Dropdown: ein versehentlicher
         Tastendruck soll keine Zuordnung setzen. */
      var vorne = refs.spiel.querySelector('.flip__seite--vorne');
      if (vorne) { vorne.focus(); }
    }
  }

  /* --- Wahl der Vorderseite und Kategorien --------------------------------- */

  /**
   * Oben auf der Karte: was vorne steht, Begriff oder Definition. Beide
   * Möglichkeiten sind zu sehen, die gewählte ist markiert — der frühere
   * einzelne Knopf nannte den Zustand und schaltete beim Klick um, wer
   * «Vorne: Begriff» anklickte, bekam die Definition.
   */
  function seitenWahl() {
    var optionen = [['bd', 'Begriff'], ['db', 'Definition']];
    return h('div', { class: 'lk-seitenwahl', role: 'group', 'aria-label': 'Vorderseite der Karten' }, [
      h('ul', { class: 'chips' }, optionen.map(function (o) {
        return h('li', {}, h('button', {
          type: 'button', class: 'chip', text: o[1],
          'aria-pressed': zustand.richtung === o[0] ? 'true' : 'false',
          title: o[0] === 'bd' ? 'Vorne den Begriff zeigen' : 'Vorne die Definition zeigen, der Begriff wird abgefragt',
          on: { click: function () { richtungSetzen(o[0]); } }
        }));
      }))
    ]);
  }

  function richtungSetzen(richtung) {
    if (zustand.richtung === richtung) { return; }
    zustand.richtung = richtung;
    neueKarte();
    speichern();
    neuZeichnen(false);
    /* Der Fokus bleibt auf der Wahl — jetzt in der neu gezeichneten Karte. */
    var aktiv = refs.spiel.querySelector('.lk-seitenwahl [aria-pressed="true"]');
    if (aktiv) { aktiv.focus(); }
  }

  function chipsAufbauen() {
    var liste = h('ul', { class: 'chips chips--umbruch', 'aria-label': 'Kategorien filtern' });
    var knoepfe = [];

    function markieren() {
      knoepfe.forEach(function (b) {
        var kat = b.dataset.kat;
        var aktiv = kat === '' ? zustand.filter.length === 0 : zustand.filter.indexOf(kat) !== -1;
        b.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
      });
    }

    function chip(key, label, anzahl) {
      var btn = h('button', {
        type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { kat: key }
      }, [
        key ? HT.ui.katSymbol(key, 15) : null,
        h('span', { text: label }),
        anzahl === null ? null : h('span', { class: 'chip__zahl', text: String(anzahl) })
      ]);
      btn.addEventListener('click', function () {
        if (key === '') {
          zustand.filter = [];
        } else {
          var i = zustand.filter.indexOf(key);
          if (i === -1) { zustand.filter.push(key); } else { zustand.filter.splice(i, 1); }
        }
        markieren();
        stapelAufbauen(false);
        speichern();
        neuZeichnen(false);
      });
      knoepfe.push(btn);
      liste.appendChild(h('li', {}, btn));
    }

    chip('', 'Alle', null);
    KATEGORIEN.forEach(function (key) {
      var anzahl = kartenDerKategorie(key).length;
      if (!anzahl) { return; }
      chip(key, HT.daten.kategorieMeta(key).label, anzahl);
    });

    markieren();
    return liste;
  }

  /* --- Render ------------------------------------------------------------- */

  /* «&karte=…»: diese Karte zuoberst auf den Stapel — der Weg von den Punkten
     auf einer Handbuchkarte hierher (marke()). Die Adresse ist danach wieder
     die gewöhnliche: die Karte liegt im Stapel, sie ist keine Einstellung. */
  function karteAusAdresse(e) {
    zustand.ansicht = 'karte';
    zustand.stapel = [e.id].concat(zustand.stapel.filter(function (s) { return s !== e.id; }));
    neueKarte();
    speichern();
    global.history.replaceState(null, '', '#/trainer?teil=lernkarten');
  }

  function render(behaelter, params, leiste) {
    if (!zustand.initialisiert) {
      wiederherstellen();
      zustand.initialisiert = true;
    }
    if (params && params.kat && KATEGORIEN.indexOf(params.kat) !== -1) {
      zustand.filter = [params.kat];
    }
    /* Eine Karte, die ausserhalb der gewählten Kategorien liegt, setzt den
       Filter auf «Alle»: mit «Nur Aufgaben» käme man sonst nie zu einem
       Ergebnis, das im Handbuch angeklickt wurde. */
    var gewuenscht = params && params.karte ? karteFuer(params.karte) : null;
    if (gewuenscht && zustand.filter.length && zustand.filter.indexOf(gewuenscht.kategorie) === -1) {
      zustand.filter = [];
    }
    stapelAufbauen(false);
    if (gewuenscht) { karteAusAdresse(gewuenscht); }

    /* Was die Lernkarten sind, steht vorn in der Karte hinter dem Info-Icon der Leiste. */
    if (leiste) {
      leiste(null, function () {
        return [
          h('h3', { class: 'gpop__abschnitt', text: 'Lernkarten' }),
          h('p', { text: 'Aufgaben und Ergebnisse und ihr Zusammenhang: In welcher Phase, in welchem Modul, was entsteht '
            + 'woraus, wer ist verantwortlich? Je Bezug eine Zeile auf der Vorderseite, und gesucht sind alle '
            + 'Werte, die dort richtig sind — die meisten Elemente stehen in mehreren Phasen, die meisten Aufgaben '
            + 'erzeugen mehrere Ergebnisse. Die Zeile zählt mit («2 von 4 gefunden»). Die agile Phase Umsetzung '
            + 'muss nicht genannt werden, wenn das Element auch in anderen Phasen steht; die Lösung zeigt sie trotzdem, leicht grau.' }),
          h('p', { text: 'Jede Wahl wird sofort geprüft; die erste falsche beendet die Zeile, die Lösung zeigt dann, '
            + 'was gefehlt hat. Sind alle Zeilen fertig, dreht sich die Karte. In langen Listen (Aufgaben, Ergebnisse) '
            + 'sucht man durch Tippen, kurze Listen klappen einfach auf.' }),
          h('p', { text: 'Oben rechts auf der Karte wählt man, was vorne steht: der Begriff oder die Definition — dann ist '
            + 'der Begriff selbst mit gesucht. Rechts neben den Kategorien steht der Fortschritt: gewusst (grün), '
            + 'nicht gewusst (zuletzt «Nochmals», rot), je mit Anteil, und die Zahl aller Karten der Auswahl; der Anteil rechts '
            + 'zählt gewusste und nicht gewusste Karten zusammen. Dahinter das Icon zum Zurücksetzen. Unten rechts auf der Karte '
            + 'stehen die letzten fünf Versuche mit ihr als Punkte: grün «Gewusst», rot «Nochmals», der älteste links.' }),
          h('p', { text: 'Grundbegriffe haben eigene Karten ohne Phase, Modul und die übrigen Zeilen: Steht oben «Begriff», '
            + 'ist der Begriff zu sehen, und ein Klick auf die Karte zeigt die Definition. Steht oben «Definition», wählt man, welcher '
            + 'Begriff gemeint ist.' }),
          h('p', { text: 'Ohne Wahl geht es auch: Karte mit «Lösung» unter der Karte drehen und selbst einschätzen. Was «Nochmals» erhält, kehrt im '
            + 'Stapel zurück. Zur Auswahl stehen nur Werte, die auf irgendeiner Karte richtig sind.' }),
          h('p', {}, [
            'Die Einschätzung zählt auch im ',
            h('a', { href: '#/trainer?teil=fortschritt', text: 'Fortschritt' }),
            ': «Gewusst» zählt für die Felder des Elements, wenn die Karte Phase und Modul auch richtig zugeordnet hat; '
              + '«Nochmals» färbt diese Felder rot.'
          ]),
          h('p', { text: 'Am Fuss der Karte führen drei Verweise weiter, vorn wie hinten: das Element im Überblick, im Handbuch und auf '
            + 'der offiziellen Seite (bei Grundbegriffen nur diese).' }),
          h('p', {}, [
            'Der Weg führt auch zurück: dieselben fünf Punkte stehen im ',
            h('a', { href: '#/handbuch', text: 'Handbuch' }),
            ' rechts in der Verweiszeile jeder Aufgabe und jedes Ergebnisses. Ein Klick dort legt die Karte hier zuoberst auf den '
              + 'Stapel; liegt sie ausserhalb der gewählten Kategorien, geht die Auswahl dafür auf «Alle». Grundbegriffe stehen nicht '
              + 'im Handbuch, ihre Punkte gibt es nur hier.'
          ]),
          h('p', { text: 'Unter der Karte blättert man mit ‹ und ›: ‹ zeigt die zuvor gezeigte Karte wieder, auch eine schon '
            + 'eingeschätzte; › überspringt die Karte ohne Einschätzung, sie kommt ans Ende des Stapels (eine gewusste fällt heraus). '
            + 'Das Icon daneben zeigt alle Karten der gewählten Kategorien als Liste, nach Kategorie und alphabetisch, je mit den '
            + 'Punkten der letzten Versuche. Die Nummer oben auf der Karte («Nr. 57») steht dort vorn in der Zeile und bleibt '
            + 'gleich, welche Kategorien auch gewählt sind. Ein Klick auf eine Karte zeigt sie zum Üben — auch eine, die schon als gewusst gilt —, '
            + '«Zur Karte» oben führt ohne Wahl zurück.' })
        ];
      });
    }

    /* Über der Karte nur eine Zeile: links die Kategorien, rechts der
       Fortschritt. Was vorne steht, wählt man oben auf der Karte, Blättern
       und Liste stehen unter ihr. */
    refs.fortschritt = h('div', { class: 'lk-zeile__rechts' });
    behaelter.appendChild(h('div', { class: 'lk-zeile' }, [chipsAufbauen(), refs.fortschritt]));

    refs.spiel = h('div', {});
    behaelter.appendChild(refs.spiel);

    if (!HT.store.verfuegbar) {
      behaelter.appendChild(h('p', {
        class: 'trefferzahl',
        text: 'Hinweis: Dieser Browser erlaubt keine lokale Speicherung — der Fortschritt gilt nur für diese Sitzung.'
      }));
    }

    neuZeichnen(false);
  }

  HT.trainerTeile.lernkarten = {
    id: 'lernkarten',
    label: 'Lernkarten',
    pfade: ['M8 3h10a2 2 0 0 1 2 2v9', 'M5 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'],
    render: render
  };
}(window));
