/* meinHERMES — Ansicht «Trainer»: das Dach über allen Übungsformen.

   Der Trainer hat mehrere Teile, umgeschaltet über die Leiste unter der
   Kopfzeile (HT.app.unterleiste): «Zuordnen» (js/zuordnen.js), «Lernkarten»
   (js/lernkarten.js), «Quiz» (js/quiz.js) und «Fortschritt»
   (js/fortschritt.js, was davon schon sitzt). Die Teile melden sich unter
   HT.trainerTeile an; ein Teil ist { id, label, pfade, render(behaelter,
   params, leiste) } und zeichnet sich in den Behälter unter der Leiste;
   leiste(zusatz, info) stellt eigene Elemente neben die Übungsformen und
   eine Erklärung vorn in die Karte des Info-Icons. Ein Teil mit
   eigenen Seiten in voller Breite (die Übungen des Zuordnens) bringt dazu
   istUebung(params) und titel(params) mit. Weitere Teile (etwa
   Quizfragen anderer Herkunft) kommen dazu, indem sie sich anmelden und
   in TEILE eingetragen werden.

   Adressen: #/trainer (Zuordnen), #/trainer?teil=lernkarten,
   #/trainer?teil=quiz — Parameter der Teile (etwa ?kat=) bleiben daneben
   gültig. Die alten Adressen #/lernkarten und #/quiz leiten hierher. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  HT.views = HT.views || {};
  HT.trainerTeile = HT.trainerTeile || {};

  var h = HT.ui.h;

  /* Reihenfolge der Leiste; der erste Teil ist der ohne ?teil=. */
  var TEILE = ['zuordnen', 'lernkarten', 'quiz', 'fortschritt'];

  function teile() {
    return TEILE.map(function (id) { return HT.trainerTeile[id]; }).filter(Boolean);
  }

  function teilAdresse(teil) {
    return teil.id === TEILE[0] ? '#/trainer' : '#/trainer?teil=' + encodeURIComponent(teil.id);
  }

  function teilFinden(id) {
    var liste = teile();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === id) { return liste[i]; }
    }
    return liste[0];
  }

  /* Der Teil, dem die Adresse eine eigene Seite zuweist (etwa ?phase=…). */
  function seitenTeil(params) {
    var liste = teile();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].istUebung && liste[i].istUebung(params)) { return liste[i]; }
    }
    return null;
  }

  /* Was der Trainer ist und woher die Übungen kommen — die Karte hinter dem
     Info-Icon der Leiste. Davor steht, was der Teil über sich sagt
     (teilInfo(), etwa Anleitung und Grundlage des Zuordnens). */
  function infoInhalt(teilInfo) {
    var teil = teilInfo ? teilInfo() : [];
    return teil.concat(teil.length ? [h('h3', { class: 'gpop__abschnitt', text: 'Trainer' })] : [], [
      h('p', { text: 'Üben für die Prüfung auf drei Arten: Rollen, Aufgaben und Ergebnisse einander zuordnen, Lernkarten umdrehen und selbst einschätzen, Quizfragen beantworten. Der Fortschritt zeigt nach Phase und Modul, was davon schon sitzt.' }),
      h('p', { text: 'Zuordnen und Lernkarten entstehen aus den Querverweisen der offiziellen Dokumentation. Die Quizfragen sind eigene Texte mit Belegzitat aus dem Referenzhandbuch; sie sind nicht geprüft und haben keinerlei Bezug zur offiziellen Prüfung.' }),
      h('p', { text: 'Der Lernstand bleibt in diesem Browser; auf der Seite «Über» lässt er sich exportieren und wieder einlesen.' }),
      h('p', { class: 'hb-verweis' }, [
        h('a', { class: 'hb-online', href: '#/ueber', text: 'Lernstand sichern →' }),
        h('a', { class: 'hb-online', href: 'https://www.hermes.admin.ch/de/projektmanagement.html', target: '_blank', rel: 'noopener', text: 'HERMES online ↗' })
      ])
    ]);
  }

  /* Die Übungsformen als Links in der Leiste unter der Kopfzeile — auch auf
     den Seiten einer Übung, dort mit dem Teil, dem sie gehört. Daneben kann
     der Teil eigene Elemente stellen (zusatz: das Zuordnen seine Wahl, in
     der Übung dazu Titel und Zähler) und seine Erklärung vorn in die Karte
     des Info-Icons (info: Funktion, die Absätze liefert). */
  function leisteSetzen(aktiv, zusatz, info) {
    HT.app.unterleiste({
      label: 'Trainer',
      links: teile().map(function (t) { return { href: teilAdresse(t), pfade: t.pfade, text: t.label, aktiv: t === aktiv }; }),
      inhalt: zusatz && zusatz.length ? zusatz : null,
      inhaltLabel: 'Einstellungen der Übung',
      info: { inhalt: function () { return infoInhalt(info); } }
    });
  }

  function render(behaelter, params) {
    params = params || {};
    var eigen = seitenTeil(params);
    var aktiv = eigen || teilFinden(params.teil);
    leisteSetzen(aktiv);
    /* Dritter Parameter von render: damit ergänzt ein Teil die Leiste. */
    function leiste(zusatz, info) { leisteSetzen(aktiv, zusatz, info); }
    var warnung = HT.app.datenWarnung();
    if (warnung) { behaelter.appendChild(warnung); }

    if (eigen) {
      document.body.dataset.teil = 'uebung';
      eigen.render(behaelter, params, leiste);
      return;
    }

    var teil = teilFinden(params.teil);
    document.body.dataset.teil = teil.id;
    /* Kein Seitenkopf: die Übungsformen stehen in der Leiste unter der
       Kopfzeile, was der Trainer ist, sagt ihr Info-Icon. */
    behaelter.appendChild(h('h1', { class: 'nur-sr', text: 'Trainer' }));
    var teilBehaelter = h('div', { class: 'tr-teil', 'data-teil': teil.id });
    behaelter.appendChild(teilBehaelter);
    teil.render(teilBehaelter, params, leiste);
  }

  function titel(params) {
    var eigen = seitenTeil(params || {});
    if (eigen && eigen.titel) { return eigen.titel(params); }
    var teil = teilFinden(params && params.teil);
    return teil && teil.id !== TEILE[0] ? 'Trainer · ' + teil.label : 'Trainer';
  }

  HT.views.trainer = {
    titel: titel,
    render: render
  };
}(window));
