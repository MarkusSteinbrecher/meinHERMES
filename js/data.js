/* meinHERMES — Datenzugriff.
   Lädt die JSON-Dateien aus data/ (relative Pfade, GitHub-Pages-tauglich),
   normalisiert die Einträge und stellt Such-/Filterfunktionen bereit.
   Die Handbuchtexte (data/handbuch/) werden erst bei Bedarf nachgeladen.
   Fehlende, leere oder fehlerhafte Dateien blockieren die App nicht. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};

  /* Feste Dateiliste gemäss SCHEMA.md */
  var KATEGORIEN = [
    { key: 'phase',        datei: 'phasen',        label: 'Phasen',        singular: 'Phase',        kapitel: 'phasen' },
    { key: 'szenario',     datei: 'szenarien',     label: 'Szenarien',     singular: 'Szenario',     kapitel: 'szenarien' },
    { key: 'modul',        datei: 'module',        label: 'Module',        singular: 'Modul',        kapitel: 'module' },
    { key: 'aufgabe',      datei: 'aufgaben',      label: 'Aufgaben',      singular: 'Aufgabe',      kapitel: 'aufgaben' },
    { key: 'ergebnis',     datei: 'ergebnisse',    label: 'Ergebnisse',    singular: 'Ergebnis',     kapitel: 'ergebnisse' },
    { key: 'rolle',        datei: 'rollen',        label: 'Rollen',        singular: 'Rolle',        kapitel: 'rollen' }
  ];

  var QUIZ_DATEI = 'quizfragen';

  /* Bei jeder Inhaltsänderung erhöhen: hängt an alle Datenabrufe eine
     Versionsangabe, damit Browser keine veralteten JSON-Dateien aus dem
     Cache verwenden. */
  var DATEN_VERSION = '2026-09-22a';

  /* Nur für die Lernkarten: die Grundbegriffe (kuratiert aus den
     Übersichtsseiten von hermes.admin.ch, im Referenzhandbuch kein eigener
     Teil). Sie stehen nicht in alleEintraege() und nicht unter eintragMitId —
     Suche, Handbuch, Überblick, Graph und Quiz kennen sie nicht —, sondern
     nur unter eintraegeDerKategorie('grundbegriff'). */
  var LERN_KATEGORIEN = [
    { key: 'grundbegriff', datei: 'grundbegriffe', label: 'Grundbegriffe', singular: 'Grundbegriff', kapitel: null }
  ];

  var KAT_NACH_KEY = {};
  KATEGORIEN.concat(LERN_KATEGORIEN).forEach(function (k) { KAT_NACH_KEY[k.key] = k; });

  /* HERMES 2022 kennt sechs Phasen, verteilt auf zwei Vorgehensweisen:
     klassisch fünf, agil drei. Initialisierung und Abschluss sind beiden
     gemeinsam. Ein Modell «mit vier Phasen» gibt es nicht. */
  var VORGEHENSWEISEN = [
    {
      key: 'klassisch',
      label: 'Klassische Vorgehensweise',
      zusatz: 'fünf Phasen',
      namen: ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Abschluss']
    },
    {
      key: 'agil',
      label: 'Agile Vorgehensweise',
      zusatz: 'drei Phasen',
      namen: ['Initialisierung', 'Umsetzung', 'Abschluss']
    }
  ];

  /* Reihenfolge der Phasen für kompakte Anzeigen (I K R E U A). */
  var PHASEN_KURZ = [
    ['Initialisierung', 'I'], ['Konzept', 'K'], ['Realisierung', 'R'],
    ['Einführung', 'E'], ['Umsetzung', 'U'], ['Abschluss', 'A']
  ];

  var zustand = {
    eintraege: [],
    nachId: {},
    nachKategorie: {},
    nachUrl: {},
    quizfragen: [],
    fehler: [],       // Namen der Dateien, die nicht geladen werden konnten
    geladen: false,
    handbuch: {},     // Kategorie -> Promise mit Volltexten (lazy)
    kapitel: null     // Promise mit Kapiteltexten (lazy)
  };

  /* --- Textnormalisierung für die Suche ---------------------------------- */

  function umlauteAusschreiben(text) {
    return text
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
      .replace(/ß/g, 'ss');
  }

  function diakritikaEntfernen(text) {
    try {
      return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
    } catch (e) {
      return text;
    }
  }

  function normalisieren(text) {
    var t = String(text === null || text === undefined ? '' : text).toLowerCase();
    return t.replace(/\s+/g, ' ').trim();
  }

  /** Beide Schreibvarianten, damit «grundsätze», «grundsaetze» und «grundsatze» treffen. */
  function suchvarianten(text) {
    var t = normalisieren(text);
    var a = umlauteAusschreiben(t);
    var b = diakritikaEntfernen(t);
    return a === b ? [a] : [a, b];
  }

  /* --- Normalisierung der Einträge --------------------------------------- */

  function alsArray(wert) {
    if (Array.isArray(wert)) {
      return wert.filter(function (x) { return x !== null && x !== undefined && x !== ''; });
    }
    if (typeof wert === 'string' && wert.trim()) { return [wert.trim()]; }
    return [];
  }

  function alsText(wert) {
    if (typeof wert === 'string') { return wert.trim(); }
    if (typeof wert === 'number') { return String(wert); }
    return '';
  }

  function slug(text) {
    return diakritikaEntfernen(umlauteAusschreiben(String(text || '').toLowerCase()))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'eintrag';
  }

  /* Abkürzungen, nach denen ein Punkt keinen Satz beendet. */
  var ABK = /(?:z\. ?B|\(?z|bzw|ggf|u\. ?a|\(?u|vgl|inkl|d\. ?h|\(?d|evtl|usw|resp|bzgl|Nr|Kap|S)\.$/;

  /** Erster Satz eines Textes — die Kurzfassung für die erste Stufe. */
  function ersterSatz(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    var pos = 0;
    while (pos < t.length) {
      var i = t.indexOf('. ', pos);
      if (i === -1) { return t; }
      var davor = t.slice(0, i + 1);
      var danach = t.charAt(i + 2);
      if (!ABK.test(davor) && /[A-ZÄÖÜ«(]/.test(danach)) { return davor; }
      pos = i + 1;
    }
    return t;
  }

  function kurzfassung(roh, definition) {
    var explizit = alsText(roh.kurz);
    if (explizit) { return explizit; }
    var satz = ersterSatz(definition);
    if (satz.length <= 230) { return satz; }
    return HT.ui.kuerzen(satz, 200);
  }

  function normEintrag(roh, kategorieKey, index) {
    if (!roh || typeof roh !== 'object') { return null; }

    var begriff = alsText(roh.begriff);
    if (!begriff) { return null; }              // ohne Begriff kein brauchbarer Eintrag

    var kategorie = alsText(roh.kategorie) || kategorieKey;
    if (!KAT_NACH_KEY[kategorie]) { kategorie = kategorieKey; }

    var quelle = null;
    if (roh.quelle && typeof roh.quelle === 'object' && alsText(roh.quelle.url)) {
      quelle = {
        url: alsText(roh.quelle.url),
        bezeichnung: alsText(roh.quelle.bezeichnung) || 'HERMES online'
      };
    }

    var meilensteine = [];
    if (Array.isArray(roh.meilensteine)) {
      roh.meilensteine.forEach(function (m) {
        if (typeof m === 'string' && m.trim()) {
          meilensteine.push({ name: m.trim(), beschreibung: '' });
        } else if (m && typeof m === 'object' && alsText(m.name)) {
          meilensteine.push({ name: alsText(m.name), beschreibung: alsText(m.beschreibung) });
        }
      });
    }

    var definition = alsText(roh.definition);

    var e = {
      id: alsText(roh.id) || (kategorie + '-' + slug(begriff) + '-' + index),
      kategorie: kategorie,
      begriff: begriff,
      kurz: kurzfassung(roh, definition),
      definition: definition,
      details: alsText(roh.details),
      verantwortlich: alsText(roh.verantwortlich),
      ebene: alsText(roh.ebene),
      typ: alsText(roh.typ),
      minimalGefordert: roh.minimalGefordert === true,
      beteiligt: alsArray(roh.beteiligt),
      phasen: alsArray(roh.phasen),
      module: alsArray(roh.module),
      szenarien: alsArray(roh.szenarien),
      ergebnisse: alsArray(roh.ergebnisse),
      ergebnisPhasen: phasenJeName(roh.ergebnisPhasen),
      modulPhasen: phasenJeName(roh.modulPhasen),
      grundlagen: alsArray(roh.grundlagen),
      meilensteine: meilensteine,
      quelle: quelle,
      reihenfolge: index
    };

    e.suchtext = suchvarianten([
      e.begriff, e.definition, e.details,
      e.verantwortlich, e.ebene, e.typ,
      e.beteiligt.join(' '), e.phasen.join(' '), e.module.join(' '),
      e.szenarien.join(' '), e.ergebnisse.join(' '),
      meilensteine.map(function (m) { return m.name + ' ' + m.beschreibung; }).join(' ')
    ].join(' ')).join('  ');

    return e;
  }

  /* { Name: [Phasen] } aus den Modultabellen des Handbuchs
     (tools/ergebnis-phasen.py): bei Aufgaben je erzeugtem Ergebnis
     (ergebnisPhasen), bei Aufgaben und Ergebnissen je Modul (modulPhasen). */
  function phasenJeName(roh) {
    var aus = {};
    if (roh && typeof roh === 'object' && !Array.isArray(roh)) {
      Object.keys(roh).forEach(function (name) { aus[name] = alsArray(roh[name]); });
    }
    return aus;
  }

  function normBeleg(roh) {
    if (!roh || typeof roh !== 'object') { return null; }
    var zitat = alsText(roh.zitat);
    if (!zitat) { return null; }
    var seite = typeof roh.seite === 'number' ? roh.seite : parseInt(roh.seite, 10);
    return {
      zitat: zitat,
      kapitel: alsText(roh.kapitel),
      seite: isFinite(seite) ? seite : null
    };
  }

  function normQuizfrage(roh, index) {
    if (!roh || typeof roh !== 'object') { return null; }
    var frage = alsText(roh.frage);
    var antworten = Array.isArray(roh.antworten)
      ? roh.antworten.map(alsText).filter(function (a) { return !!a; })
      : [];
    var richtig = typeof roh.richtig === 'number' ? roh.richtig : parseInt(roh.richtig, 10);

    if (!frage || antworten.length < 2) { return null; }
    if (!isFinite(richtig) || richtig < 0 || richtig >= antworten.length) { return null; }

    var quelle = null;
    if (roh.quelle && typeof roh.quelle === 'object' && alsText(roh.quelle.url)) {
      quelle = {
        url: alsText(roh.quelle.url),
        bezeichnung: alsText(roh.quelle.bezeichnung) || 'HERMES online'
      };
    }

    return {
      id: alsText(roh.id) || ('q-kuratiert-' + index),
      herkunft: 'kuratiert',
      kategorie: alsText(roh.kategorie) || '',
      frage: frage,
      zitat: '',
      antworten: antworten,
      richtig: richtig,
      erklaerung: alsText(roh.erklaerung),
      beleg: normBeleg(roh.beleg),
      quelle: quelle
    };
  }

  /* --- Laden -------------------------------------------------------------- */

  function ladeJson(pfad) {
    return fetch(pfad + '?v=' + encodeURIComponent(DATEN_VERSION), { credentials: 'same-origin' })
      .then(function (antwort) {
        if (!antwort.ok) { throw new Error('HTTP ' + antwort.status); }
        return antwort.json();
      });
  }

  function ladeDatei(dateiname) {
    return ladeJson('data/' + dateiname + '.json')
      .then(function (json) {
        return Array.isArray(json) ? json : [];
      })
      .catch(function () {
        zustand.fehler.push(dateiname + '.json');
        return [];
      });
  }

  function laden() {
    if (zustand.geladen) { return Promise.resolve(zustand); }

    var aufgaben = KATEGORIEN.concat(LERN_KATEGORIEN).map(function (kat) { return ladeDatei(kat.datei); });
    aufgaben.push(ladeDatei(QUIZ_DATEI));

    return Promise.all(aufgaben).then(function (ergebnisse) {
      var alle = [];
      var gesehen = {};

      KATEGORIEN.forEach(function (kat, i) {
        var liste = ergebnisse[i] || [];
        zustand.nachKategorie[kat.key] = [];
        liste.forEach(function (roh, idx) {
          var e = normEintrag(roh, kat.key, idx);
          if (!e) { return; }
          if (gesehen[e.id]) { e.id = e.id + '-' + idx; }   // doppelte IDs entschärfen
          gesehen[e.id] = true;
          alle.push(e);
          if (!zustand.nachKategorie[e.kategorie]) { zustand.nachKategorie[e.kategorie] = []; }
          zustand.nachKategorie[e.kategorie].push(e);
          zustand.nachId[e.id] = e;
          if (e.quelle && !zustand.nachUrl[e.quelle.url]) { zustand.nachUrl[e.quelle.url] = e; }
        });
      });

      zustand.eintraege = alle;

      LERN_KATEGORIEN.forEach(function (kat, i) {
        zustand.nachKategorie[kat.key] = (ergebnisse[KATEGORIEN.length + i] || [])
          .map(function (roh, idx) { return normEintrag(roh, kat.key, idx); })
          .filter(function (e) { return !!e; });
      });

      var rohFragen = ergebnisse[ergebnisse.length - 1] || [];
      zustand.quizfragen = rohFragen
        .map(normQuizfrage)
        .filter(function (f) { return !!f; });

      zustand.geladen = true;
      return zustand;
    });
  }

  /* --- Handbuchtexte (lazy) ---------------------------------------------- */

  /** Volltext eines Eintrags aus data/handbuch/elemente-<kategorie>.json; null wenn keiner existiert. */
  function handbuchElement(eintrag) {
    if (!eintrag) { return Promise.resolve(null); }
    var kat = eintrag.kategorie;
    if (!zustand.handbuch[kat]) {
      zustand.handbuch[kat] = ladeJson('data/handbuch/elemente-' + kat + '.json')
        .then(function (json) { return (json && typeof json === 'object') ? json : {}; })
        .catch(function () { return {}; });
    }
    return zustand.handbuch[kat].then(function (alle) {
      return alle[eintrag.id] || null;
    });
  }

  /** Alle Handbuchtexte einer Kategorie (id -> {titel, nummer, seite, url, abschnitte}),
      etwa für Nummern und Seiten aller Karten eines Kapitels. */
  function handbuchIndex(kategorie) {
    if (!zustand.handbuch[kategorie]) {
      zustand.handbuch[kategorie] = ladeJson('data/handbuch/elemente-' + kategorie + '.json')
        .then(function (json) { return (json && typeof json === 'object') ? json : {}; })
        .catch(function () { return {}; });
    }
    return zustand.handbuch[kategorie];
  }

  /** Alle Kapiteltexte (Methodenüberblick, Einleitungen, Hinweise zur Anwendung). */
  function handbuchKapitel() {
    if (!zustand.kapitel) {
      zustand.kapitel = ladeJson('data/handbuch/kapitel.json')
        .then(function (json) { return Array.isArray(json) ? json : []; })
        .catch(function () { return []; });
    }
    return zustand.kapitel;
  }


  /* --- Referenzhandbuch (PDF) als Text: data/handbuch/rhb/ ---------------- */

  /** index.json: Quelle (PDF-Adresse, Auflage) und Kapitelliste; null bei Fehler. */
  function rhbIndex() {
    if (!zustand.rhbIndex) {
      zustand.rhbIndex = ladeJson('data/handbuch/rhb/index.json')
        .then(function (json) { return (json && typeof json === 'object') ? json : null; })
        .catch(function () { return null; });
    }
    return zustand.rhbIndex;
  }

  /** Ein Kapitel des Referenzhandbuchs ({id, titel, seite, url, abschnitte}); null bei Fehler. */
  function rhbKapitel(id) {
    zustand.rhb = zustand.rhb || {};
    if (!zustand.rhb[id]) {
      zustand.rhb[id] = ladeJson('data/handbuch/rhb/' + encodeURIComponent(id) + '.json')
        .then(function (json) { return (json && typeof json === 'object') ? json : null; })
        .catch(function () { return null; });
    }
    return zustand.rhb[id];
  }

  /* --- Zugriff ------------------------------------------------------------ */

  function kategorien() {
    return KATEGORIEN.slice();
  }

  function kategorieMeta(key) {
    return KAT_NACH_KEY[key] || null;
  }

  function alleEintraege() {
    return zustand.eintraege;
  }

  function eintragMitId(id) {
    return zustand.nachId[id] || null;
  }

  function eintraegeDerKategorie(key) {
    return zustand.nachKategorie[key] || [];
  }

  function eintragMitBegriff(begriff, kategorieKey) {
    var ziel = normalisieren(begriff);
    var kandidaten = kategorieKey ? eintraegeDerKategorie(kategorieKey) : zustand.eintraege;
    for (var i = 0; i < kandidaten.length; i++) {
      if (normalisieren(kandidaten[i].begriff) === ziel) { return kandidaten[i]; }
    }
    return null;
  }

  function eintragMitUrl(url) {
    return zustand.nachUrl[url] || null;
  }

  /**
   * Zerlegt einen Zellen- oder Listentext des Handbuchs («Auftraggeber*,
   * Projektleiter*») in Teile und löst jeden Teil auf einen Eintrag auf.
   * Rückgabe: [{ text, eintrag|null, trenner }]
   */
  function begriffeAufloesen(text) {
    var t = String(text || '');
    if (!t) { return []; }
    var teile = t.split(/(,\s*)/);
    var aus = [];
    teile.forEach(function (teil) {
      if (/^,\s*$/.test(teil)) { aus.push({ text: teil, eintrag: null, trenner: true }); return; }
      var roh = teil.trim();
      if (!roh) { return; }
      var kern = roh.replace(/\*+$/, '').trim();
      var e = eintragMitBegriff(kern);
      if (!e && /^(Meilenstein|Checkliste)\s/.test(kern)) { e = eintragMitBegriff(kern, 'ergebnis'); }
      aus.push({ text: roh, eintrag: e, trenner: false });
    });
    return aus;
  }

  /** Volltextsuche über begriff/definition/details und Zusatzfelder. */
  function suchen(text, kategorienFilter) {
    var basis = zustand.eintraege;

    if (kategorienFilter && kategorienFilter.length) {
      basis = basis.filter(function (e) { return kategorienFilter.indexOf(e.kategorie) !== -1; });
    }

    var abfrage = normalisieren(text);
    if (!abfrage) { return basis.slice(); }

    var begriffe = abfrage.split(' ').filter(function (w) { return w.length > 0; });
    var muster = begriffe.map(suchvarianten);

    var treffer = basis.filter(function (e) {
      return muster.every(function (varianten) {
        return varianten.some(function (v) { return e.suchtext.indexOf(v) !== -1; });
      });
    });

    /* Rangfolge: Treffer im Begriff zuerst, dann Präfixtreffer, dann alphabetisch. */
    var ersteVarianten = muster.length ? muster[0] : [];
    return treffer.sort(function (a, b) {
      var pa = trefferRang(a, ersteVarianten);
      var pb = trefferRang(b, ersteVarianten);
      if (pa !== pb) { return pa - pb; }
      return a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  function trefferRang(eintrag, varianten) {
    var begriff = suchvarianten(eintrag.begriff);
    for (var i = 0; i < varianten.length; i++) {
      for (var j = 0; j < begriff.length; j++) {
        if (begriff[j] === varianten[i]) { return 0; }
        if (begriff[j].indexOf(varianten[i]) === 0) { return 1; }
        if (begriff[j].indexOf(varianten[i]) !== -1) { return 2; }
      }
    }
    return 3;
  }

  /**
   * Beide Vorgehensweisen mit ihren Phasen in der richtigen Reihenfolge.
   * Zu jedem Namen wird der erfasste Eintrag gesucht; fehlt er, bleibt
   * «eintrag» null und die Ansicht stellt den Namen ohne Verlinkung dar.
   */
  function vorgehensweisen() {
    return VORGEHENSWEISEN.map(function (v) {
      return {
        key: v.key,
        label: v.label,
        zusatz: v.zusatz,
        phasen: v.namen.map(function (name) {
          return { name: name, eintrag: eintragMitBegriff(name, 'phase') };
        })
      };
    });
  }

  /** Phaseneinträge, die in keiner der beiden Vorgehensweisen vorkommen. */
  function phasenOhneVorgehensweise() {
    var bekannt = {};
    VORGEHENSWEISEN.forEach(function (v) {
      v.namen.forEach(function (n) { bekannt[normalisieren(n)] = true; });
    });
    return eintraegeDerKategorie('phase').filter(function (p) {
      return !bekannt[normalisieren(p.begriff)];
    });
  }

  /** Phasenliste in kanonischer Reihenfolge, z. B. für Kurzanzeigen. */
  function phasenSortiert(liste) {
    var rang = {};
    PHASEN_KURZ.forEach(function (p, i) { rang[normalisieren(p[0])] = i; });
    return (liste || []).slice().sort(function (a, b) {
      var ra = rang[normalisieren(a)], rb = rang[normalisieren(b)];
      if (ra === undefined) { ra = 99; }
      if (rb === undefined) { rb = 99; }
      return ra - rb;
    });
  }

  /** Phasen, in denen eine Aufgabe oder ein Ergebnis in einem Modul vorkommt.
      Die Modultabellen kreuzen die Phasen je Modul an; «modulPhasen» steht
      nur, wo nicht jede Phase des Eintrags in jedem seiner Module gilt —
      «Prototyping durchführen» läuft in Projektgrundlagen nur in der
      Initialisierung, in Produkt und IT-System in Konzept, Realisierung und
      Umsetzung. Ohne Angabe gelten alle Phasen in jedem Modul des Eintrags;
      ein fremdes Modul hat keine. */
  function phasenImModul(eintrag, modul) {
    if (!eintrag) { return []; }
    var ziel = normalisieren(modul);
    var jeModul = eintrag.modulPhasen || {};
    for (var name in jeModul) {
      if (Object.prototype.hasOwnProperty.call(jeModul, name) && normalisieren(name) === ziel) { return jeModul[name]; }
    }
    var drin = (eintrag.module || []).some(function (m) { return normalisieren(m) === ziel; });
    return drin ? (eintrag.phasen || []) : [];
  }

  function alphabetisch(liste) {
    return liste.slice().sort(function (a, b) {
      return a.begriff.localeCompare(b.begriff, 'de');
    });
  }

  function quizfragen() {
    return zustand.quizfragen;
  }

  function fehlerhafteDateien() {
    return zustand.fehler.slice();
  }

  function istLeer() {
    return zustand.eintraege.length === 0 && zustand.quizfragen.length === 0;
  }

  HT.daten = {
    laden: laden,
    kategorien: kategorien,
    kategorieMeta: kategorieMeta,
    alleEintraege: alleEintraege,
    eintragMitId: eintragMitId,
    eintragMitBegriff: eintragMitBegriff,
    eintragMitUrl: eintragMitUrl,
    begriffeAufloesen: begriffeAufloesen,
    eintraegeDerKategorie: eintraegeDerKategorie,
    suchen: suchen,
    vorgehensweisen: vorgehensweisen,
    phasenOhneVorgehensweise: phasenOhneVorgehensweise,
    phasenSortiert: phasenSortiert,
    phasenImModul: phasenImModul,
    phasenKurz: PHASEN_KURZ,
    alphabetisch: alphabetisch,
    quizfragen: quizfragen,
    fehlerhafteDateien: fehlerhafteDateien,
    istLeer: istLeer,
    normalisieren: normalisieren,
    ersterSatz: ersterSatz,
    handbuchElement: handbuchElement,
    handbuchKapitel: handbuchKapitel,
    handbuchIndex: handbuchIndex,
    rhbIndex: rhbIndex,
    rhbKapitel: rhbKapitel,
    /* Eigene Datei laden (mit DATEN_VERSION gegen den Cache): für Ansichten
       mit eigenem Bestand, etwa data/lernpfad.json. */
    ladeJson: ladeJson
  };
}(window));
