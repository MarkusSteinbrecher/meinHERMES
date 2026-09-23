/* meinHERMES — localStorage-Kapsel.
   Jeder Zugriff in try/catch; die App funktioniert auch ohne Storage
   (Privatmodus, deaktivierte Cookies, voller Speicher).

   Dazu Export und Import als JSON-Datei (ADR 0001). Welche Schlüssel es
   gibt und welche ein Import ersetzt, steht hier und nicht in der
   Oberfläche — ein späterer Abgleich mit einem Server braucht dieselben
   Regeln. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var PRAEFIX = 'hermes-trainer:';
  var PROBE = '__probe';
  var APP = 'meinHERMES';
  var FORMAT = 1;

  function raw() {
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  var verfuegbar = (function () {
    try {
      var s = raw();
      if (!s) { return false; }
      var probe = PRAEFIX + PROBE;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }());

  function lies(schluessel, standard) {
    try {
      var s = raw();
      if (!s) { return standard; }
      var text = s.getItem(PRAEFIX + schluessel);
      if (text === null || text === undefined) { return standard; }
      var wert = JSON.parse(text);
      return (wert === null || wert === undefined) ? standard : wert;
    } catch (e) {
      return standard;
    }
  }

  function schreib(schluessel, wert) {
    try {
      var s = raw();
      if (!s) { return false; }
      s.setItem(PRAEFIX + schluessel, JSON.stringify(wert));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loesche(schluessel) {
    try {
      var s = raw();
      if (!s) { return false; }
      s.removeItem(PRAEFIX + schluessel);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Alle vorhandenen Schlüssel mit Präfix (ohne Präfix), sortiert. */
  function alle() {
    var liste = [];
    try {
      var s = raw();
      if (!s) { return liste; }
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(PRAEFIX) === 0 && k !== PRAEFIX + PROBE) { liste.push(k.slice(PRAEFIX.length)); }
      }
    } catch (e) { /* was bis hierher gelesen ist */ }
    return liste.sort();
  }

  /* --- Export und Import --------------------------------------------------- */

  function istObjekt(w) { return !!w && typeof w === 'object' && !Array.isArray(w); }
  function mitEintraegen(w) { return istObjekt(w) && Array.isArray(w.eintraege); }
  function zahlwort(n, eins, mehr) { return n + ' ' + (n === 1 ? eins : mehr); }

  /* Die bekannten Schlüssel. Lernstand und Einstellungen ersetzt ein Import,
     Ansichtszustand (Filter, offene Bereiche) bleibt auf dem Gerät — die
     Datei darf ihn enthalten. `form` prüft, was das Modul beim Lesen
     mindestens erwartet; `menge` beschreibt den Inhalt für die Vorschau.
     Ein neuer Schlüssel gehört hierher, sonst übergeht ihn der Import. */
  var SCHLUESSEL = {
    trainer: {
      art: 'lernstand',
      form: function (w) { return istObjekt(w) && istObjekt(w.beste); },
      menge: function (w) { return zahlwort(Object.keys(w.beste).length, 'beste Runde', 'beste Runden'); }
    },
    fortschritt: {
      art: 'lernstand',
      form: function (w) { return istObjekt(w) && istObjekt(w.stand); },
      menge: function (w) { return zahlwort(Object.keys(w.stand).length, 'gezählte Zuordnung', 'gezählte Zuordnungen'); }
    },
    markierungen: {
      art: 'lernstand',
      form: mitEintraegen,
      menge: function (w) { return zahlwort(w.eintraege.length, 'Markierung', 'Markierungen'); }
    },
    notizen: { art: 'lernstand', form: mitEintraegen },   // alt, js/markieren.js übernimmt es
    lernkarten: {
      art: 'lernstand',
      form: function (w) {
        return istObjekt(w) && (w.fortschritt === undefined || istObjekt(w.fortschritt))
          && (w.verlauf === undefined || istObjekt(w.verlauf));
      },
      menge: function (w) {
        return zahlwort(w.fortschritt ? Object.keys(w.fortschritt).length : 0, 'Lernkarte eingeschätzt', 'Lernkarten eingeschätzt');
      }
    },
    'quiz-statistik': {
      art: 'lernstand',
      form: function (w) {
        return istObjekt(w) && ['laeufe', 'fragen', 'richtig'].every(function (k) {
          return w[k] === undefined || typeof w[k] === 'number';
        });
      },
      menge: function (w) { return zahlwort(typeof w.laeufe === 'number' ? w.laeufe : 0, 'Quizlauf', 'Quizläufe'); }
    },
    'quiz-verlauf': {
      art: 'lernstand',
      form: function (w) { return istObjekt(w) && istObjekt(w.verlauf); },
      menge: function (w) { return zahlwort(Object.keys(w.verlauf).length, 'Quizfrage geprüft', 'Quizfragen geprüft'); }
    },
    'quiz-konfig': { art: 'einstellung', form: istObjekt },
    graph: { art: 'ansicht', form: istObjekt },
    handbuch: { art: 'ansicht', form: istObjekt },
    'ueberblick-drill': { art: 'ansicht', form: istObjekt },
    lernpfad: { art: 'ansicht', form: istObjekt },      // Notizen offen, letzte Folie (js/lernpfad.js)
    willkommen: { art: 'ansicht', form: istObjekt }        // «Nicht mehr anzeigen» (js/ueber.js)
  };

  function ersetzbar(schluessel) {
    var def = Object.prototype.hasOwnProperty.call(SCHLUESSEL, schluessel) ? SCHLUESSEL[schluessel] : null;
    return !!def && def.art !== 'ansicht';
  }

  /** Inhalt der Exportdatei: alles unter dem Präfix. */
  function exportieren() {
    var daten = {};
    alle().forEach(function (k) {
      var w = lies(k, undefined);
      if (w !== undefined) { daten[k] = w; }
    });
    return { app: APP, format: FORMAT, exportiert: new Date().toISOString(), daten: daten };
  }

  /** Prüft den Text einer Exportdatei. Liefert { ok: false, fehler } oder
      { ok: true, exportiert: Date|null, daten, mengen, uebergangen }:
      `daten` nur mit Lernstand und Einstellungen, `mengen` als Sätze für die
      Vorschau, `uebergangen` zählt Schlüssel, die diese Fassung nicht kennt. */
  function importPruefen(text) {
    var datei;
    try {
      datei = JSON.parse(text);
    } catch (e) {
      return { ok: false, fehler: 'Die Datei ist kein gültiges JSON.' };
    }
    if (!istObjekt(datei) || datei.app !== APP) {
      return { ok: false, fehler: 'Die Datei ist kein Export von meinHERMES.' };
    }
    if (datei.format !== FORMAT) {
      return { ok: false, fehler: (typeof datei.format === 'number' && datei.format > FORMAT)
        ? 'Die Datei stammt aus einer neueren Fassung von meinHERMES. Bitte die Seite neu laden und nochmals versuchen.'
        : 'Das Format der Datei ist unbekannt.' };
    }
    if (!istObjekt(datei.daten)) {
      return { ok: false, fehler: 'Die Datei enthält keine Daten.' };
    }

    var uebergangen = 0, beschaedigt = [];
    Object.keys(datei.daten).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(SCHLUESSEL, k)) { uebergangen++; return; }
      if (!SCHLUESSEL[k].form(datei.daten[k])) { beschaedigt.push(k); }
    });
    if (beschaedigt.length) {
      return { ok: false, fehler: 'Die Datei ist beschädigt (' + beschaedigt.join(', ') + ').' };
    }

    var daten = {}, mengen = [];
    Object.keys(SCHLUESSEL).forEach(function (k) {
      if (!ersetzbar(k) || !Object.prototype.hasOwnProperty.call(datei.daten, k)) { return; }
      daten[k] = datei.daten[k];
      if (SCHLUESSEL[k].menge) { mengen.push(SCHLUESSEL[k].menge(daten[k])); }
    });
    if (!Object.keys(daten).length) {
      return { ok: false, fehler: 'Die Datei enthält keinen Lernstand.' };
    }

    var zeit = new Date(datei.exportiert);
    return {
      ok: true,
      exportiert: isNaN(zeit.getTime()) ? null : zeit,
      daten: daten,
      mengen: mengen,
      uebergangen: uebergangen
    };
  }

  /** Ersetzt Lernstand und Einstellungen durch `daten` aus importPruefen:
      was die Datei nicht enthält, fällt weg; Ansichtszustand und unbekannte
      Schlüssel bleiben. Scheitert ein Schreiben (Speicher voll), kommt der
      alte Stand zurück. Danach neu laden — die Module lesen beim Start. */
  function importErsetzen(daten) {
    var s = raw();
    if (!s) { return false; }
    var vorher = {}, neu = {};
    alle().forEach(function (k) { if (ersetzbar(k)) { vorher[k] = s.getItem(PRAEFIX + k); } });
    Object.keys(daten).forEach(function (k) { if (ersetzbar(k)) { neu[k] = JSON.stringify(daten[k]); } });
    try {
      Object.keys(vorher).forEach(function (k) { if (!(k in neu)) { s.removeItem(PRAEFIX + k); } });
      Object.keys(neu).forEach(function (k) { s.setItem(PRAEFIX + k, neu[k]); });
      return true;
    } catch (e) {
      try {
        Object.keys(neu).forEach(function (k) { s.removeItem(PRAEFIX + k); });
        Object.keys(vorher).forEach(function (k) { s.setItem(PRAEFIX + k, vorher[k]); });
      } catch (e2) { /* nichts mehr zu retten */ }
      return false;
    }
  }

  HT.store = {
    verfuegbar: verfuegbar,
    lies: lies,
    schreib: schreib,
    loesche: loesche,
    alle: alle,
    loescheAlle: function () { alle().forEach(function (k) { loesche(k); }); },
    exportieren: exportieren,
    importPruefen: importPruefen,
    importErsetzen: importErsetzen
  };
}(window));
