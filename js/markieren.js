/* meinHERMES — Markierungen: Wörter und Sätze im Text hervorheben.

   Text in der Inhaltsseite des Überblicks, in der Lexikonkarte oder im
   Handbuchkapitel auswählen, «Markieren» antippen — die Stelle bleibt gelb,
   ein Klick darauf nimmt sie wieder weg. Alles bleibt im Browser
   (localStorage, Schlüssel «markierungen»); die Site hat keinen Server.

   Verankerung nach dem Muster der Web-Annotation (TextQuoteSelector): eine
   Markierung merkt sich nicht Zeichenpositionen, sondern das Zitat samt ein
   paar Zeichen davor und danach, dazu den Ort — den nächsten Block mit
   `data-mark-ort`. Beim Rendern sucht das Modul das Zitat im Block wieder;
   ein MutationObserver auf #view legt die Markierungen nach jedem Aufbau und
   Nachladen neu — die Ansichten setzen nur das Attribut.

   Der Ort ist die Adresse des Elements im Handbuch; die Inhaltsseite des
   Überblicks und die Karte im Handbuch tragen denselben Ort und zeigen
   denselben Handbuchtext — eine Markierung hier erscheint auch dort. Was
   ein Block gerade nicht enthält (Karte in der Stufe «Kurz», Text noch
   nicht nachgeladen), bleibt gespeichert und erscheint, sobald der Text
   da ist.

   Auszüge an anderen Stellen tragen den Ort ihres Handbuchabschnitts
   (HT.handbuch.markOrtVon) und dazu `data-mark-auszug`: die Lernkarte, die
   Notizen des Lernpfads. Dort zeigt nur, wessen Umfeld passt — sonst
   leuchtete ein markiertes «Projekt» aus dem Kapitel an irgendeiner Stelle
   des Auszugs auf. Das Handbuch im Fenster liegt ausserhalb von #view und
   meldet sich mit beobachten() an. */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var h = HT.ui.h;
  var SPEICHER = 'markierungen';
  var ALT = 'notizen';                    // früheres Modul: Markierungen übernehmen
  var VERSION = 1;
  var KONTEXT = 32;                       // Zeichen vor und nach dem Zitat

  var daten = null;                       // { version, eintraege: [{ id, ort, zitat }] }
  var blase = null;                       // Knopf «Markieren» über der Auswahl
  var stumm = 0;                          // > 0: eigene DOM-Änderungen laufen
  var beobachter = null;

  /* --- Daten --------------------------------------------------------------- */

  function laden() {
    if (daten) { return daten; }
    var g = HT.store.lies(SPEICHER, null);
    if (g && typeof g === 'object' && Array.isArray(g.eintraege)) {
      daten = g;
    } else {
      /* Markierungen der alten Notizen weiterführen; Kommentare und freie
         Notizen gibt es nicht mehr. */
      var alt = HT.store.lies(ALT, null);
      var uebernommen = (alt && Array.isArray(alt.eintraege) ? alt.eintraege : [])
        .filter(function (e) { return e && e.art === 'markierung' && e.ort && e.zitat && e.zitat.exact; })
        .map(function (e) { return { id: e.id, ort: e.ort, zitat: e.zitat }; });
      daten = { version: VERSION, eintraege: uebernommen };
      if (alt) { HT.store.schreib(SPEICHER, daten); HT.store.loesche(ALT); }
    }
    daten.eintraege = daten.eintraege.filter(function (e) { return e && e.id && e.ort && e.zitat && e.zitat.exact; });
    /* Lexikon und Methode sind seit 2026-09-11 das Handbuch — Orte nachziehen. */
    var umgezogen = false;
    daten.eintraege.forEach(function (e) {
      var neu = e.ort.replace(/^#\/(lexikon|methode)\?/, '#/handbuch?');
      if (neu !== e.ort) { e.ort = neu; umgezogen = true; }
    });
    if (umgezogen) { HT.store.schreib(SPEICHER, daten); }
    return daten;
  }

  function speichern() { HT.store.schreib(SPEICHER, laden()); }

  function fuerOrt(ort) {
    return laden().eintraege.filter(function (e) { return e.ort === ort; });
  }

  function anlegen(ort, zitat) {
    var e = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ort: ort, zitat: zitat };
    laden().eintraege.push(e);
    speichern();
    return e;
  }

  function loeschen(id) {
    laden();
    daten.eintraege = daten.eintraege.filter(function (x) { return x.id !== id; });
    speichern();
  }

  /* --- Text eines Blocks --------------------------------------------------- */

  function blockVon(knoten) {
    var el = knoten && knoten.nodeType === 3 ? knoten.parentNode : knoten;
    return el && el.closest ? el.closest('[data-mark-ort]') : null;
  }

  /* Alle Textknoten in Dokumentreihenfolge — dieselbe Folge, die
     Range.toString() liefert, damit Auswahl und Modell dieselben Positionen
     meinen. */
  function modell(block) {
    var w = document.createTreeWalker(block, global.NodeFilter.SHOW_TEXT, null, false);
    var text = '', stellen = [], n;
    while ((n = w.nextNode())) {
      stellen.push({ knoten: n, start: text.length, ende: text.length + n.data.length });
      text += n.data;
    }
    return { text: text, stellen: stellen };
  }

  /* Position eines Range-Endes im Modell des Blocks. */
  function position(m, container, offset) {
    if (container.nodeType === 3) {
      for (var i = 0; i < m.stellen.length; i++) {
        if (m.stellen[i].knoten === container) { return m.stellen[i].start + offset; }
      }
      return -1;
    }
    var kind = container.childNodes[offset] || null;
    if (!kind) {
      var letzte = -1;
      m.stellen.forEach(function (s) { if (container.contains(s.knoten)) { letzte = s.ende; } });
      return letzte;
    }
    for (var j = 0; j < m.stellen.length; j++) {
      var s = m.stellen[j];
      if (kind === s.knoten || (kind.contains && kind.contains(s.knoten))) { return s.start; }
      if (kind.compareDocumentPosition(s.knoten) & global.Node.DOCUMENT_POSITION_FOLLOWING) { return s.start; }
    }
    return m.text.length;
  }

  function zitatVon(m, start, ende) {
    return {
      exact: m.text.slice(start, ende),
      prefix: m.text.slice(Math.max(0, start - KONTEXT), start),
      suffix: m.text.slice(ende, ende + KONTEXT)
    };
  }

  /* Zitat wiederfinden: erst mit Kontext, dann das Zitat allein — bei
     mehreren Treffern der mit der grössten Übereinstimmung des Umfelds. */
  function finden(m, z, streng) {
    var t = m.text;
    var i = t.indexOf((z.prefix || '') + z.exact + (z.suffix || ''));
    if (i !== -1) { return i + (z.prefix || '').length; }
    var treffer = [], von = 0;
    while ((i = t.indexOf(z.exact, von)) !== -1) { treffer.push(i); von = i + 1; }
    if (!treffer.length) { return -1; }
    var beste = treffer[0], bestePunkte = -1;
    treffer.forEach(function (p) {
      var punkte = gemeinsam(t.slice(Math.max(0, p - KONTEXT), p), z.prefix || '', true)
        + gemeinsam(t.slice(p + z.exact.length, p + z.exact.length + KONTEXT), z.suffix || '', false);
      if (punkte > bestePunkte) { bestePunkte = punkte; beste = p; }
    });
    /* Im Auszug: ein langes Zitat genügt, ein kurzes braucht Umfeld. */
    if (streng && z.exact.length < 30 && bestePunkte < 8) { return -1; }
    return beste;
  }

  function gemeinsam(a, b, vonHinten) {
    var n = 0;
    while (n < a.length && n < b.length) {
      var ca = vonHinten ? a[a.length - 1 - n] : a[n];
      var cb = vonHinten ? b[b.length - 1 - n] : b[n];
      if (ca !== cb) { break; }
      n++;
    }
    return n;
  }

  /* --- Markierungen legen und entfernen ------------------------------------- */

  function umhuellen(m, start, ende, id) {
    m.stellen.forEach(function (s) {
      if (s.ende <= start || s.start >= ende) { return; }
      var n = s.knoten;
      var a = Math.max(start, s.start) - s.start;
      var b = Math.min(ende, s.ende) - s.start;
      if (b < n.data.length) { n.splitText(b); }
      if (a > 0) { n = n.splitText(a); }
      var mark = h('mark', { class: 'mk-mark', 'data-mark-id': id, title: 'Markierung entfernen', tabindex: '0', role: 'button' });
      n.parentNode.insertBefore(mark, n);
      mark.appendChild(n);
    });
  }

  function entfernen(block) {
    var marks = block.querySelectorAll('mark.mk-mark');
    for (var i = 0; i < marks.length; i++) {
      var mk = marks[i], p = mk.parentNode;
      if (!p) { continue; }
      while (mk.firstChild) { p.insertBefore(mk.firstChild, mk); }
      p.removeChild(mk);
    }
    block.normalize();
  }

  function blockAnwenden(block) {
    var ort = block.getAttribute('data-mark-ort');
    var streng = block.hasAttribute('data-mark-auszug');
    entfernen(block);
    var liste = fuerOrt(ort);
    if (!liste.length) { return; }
    liste.forEach(function (e) {
      var m = modell(block);
      var start = finden(m, e.zitat, streng);
      if (start === -1) { return; }          // Text (noch) nicht in diesem Block
      umhuellen(m, start, start + e.zitat.exact.length, e.id);
    });
  }

  var weitere = [];   // Wurzeln ausserhalb von #view (beobachten)

  function anwenden(wurzel) {
    var wurzeln = wurzel ? [wurzel] : [document.getElementById('view')].concat(weitere.filter(function (w) { return document.body.contains(w); }));
    stumm++;
    try {
      var bloecke = [];
      wurzeln.forEach(function (w) {
        if (!w) { return; }
        if (w.hasAttribute && w.hasAttribute('data-mark-ort')) { bloecke.push(w); }
        var innen = w.querySelectorAll('[data-mark-ort]');
        for (var i = 0; i < innen.length; i++) { bloecke.push(innen[i]); }
      });
      bloecke.forEach(blockAnwenden);
    } finally {
      if (beobachter) { beobachter.takeRecords(); }
      stumm--;
    }
  }

  /* --- Auswahl und Knopf «Markieren» ----------------------------------------- */

  function auswahlLesen() {
    var sel = global.getSelection ? global.getSelection() : null;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { return null; }
    var r = sel.getRangeAt(0);
    if (!String(r.toString()).trim()) { return null; }
    var block = blockVon(r.commonAncestorContainer);
    if (!block) { return null; }
    if (blockVon(r.startContainer) !== block || blockVon(r.endContainer) !== block) { return null; }
    var el = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    if (el.closest && el.closest('textarea, input')) { return null; }
    return { range: r, block: block };
  }

  function blaseBauen() {
    var knopf = h('button', { type: 'button', class: 'mk-blase__knopf', text: 'Markieren' });
    knopf.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // Auswahl behalten
    knopf.addEventListener('click', auswahlMarkieren);
    var el = h('div', { class: 'mk-blase', role: 'toolbar', 'aria-label': 'Auswahl markieren', hidden: true }, [knopf]);
    document.body.appendChild(el);
    return el;
  }

  function blaseZeigen() {
    var a = auswahlLesen();
    if (!blase) { blase = blaseBauen(); }
    if (!a) { blase.hidden = true; return; }
    var r = a.range.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) { blase.hidden = true; return; }
    blase.hidden = false;
    var b = blase.getBoundingClientRect();
    var x = Math.max(8, Math.min(global.innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2));
    var y = r.top - b.height - 8;
    if (y < 8) { y = r.bottom + 8; }
    blase.style.left = Math.round(x) + 'px';
    blase.style.top = Math.round(y) + 'px';
  }

  function auswahlMarkieren() {
    var a = auswahlLesen();
    if (!a) { return; }
    var m = modell(a.block);
    var start = position(m, a.range.startContainer, a.range.startOffset);
    var ende = position(m, a.range.endContainer, a.range.endOffset);
    if (start < 0 || ende < 0) { return; }
    /* Randweiss abschneiden — eine Markierung fängt nicht mit einem Leerzeichen an. */
    while (start < ende && /\s/.test(m.text[start])) { start++; }
    while (ende > start && /\s/.test(m.text[ende - 1])) { ende--; }
    if (ende <= start) { return; }
    anlegen(a.block.getAttribute('data-mark-ort'), zitatVon(m, start, ende));
    try { global.getSelection().removeAllRanges(); } catch (x) { /* egal */ }
    blase.hidden = true;
    anwenden(a.block);
  }

  function markEntfernen(mark) {
    var block = blockVon(mark);
    loeschen(mark.getAttribute('data-mark-id'));
    if (block) { anwenden(block); } else { anwenden(); }
  }

  /* --- Ereignisse ------------------------------------------------------------ */

  var selTimer = null;
  function auswahlGeaendert() {
    if (selTimer) { clearTimeout(selTimer); }
    selTimer = setTimeout(blaseZeigen, 120);
  }

  function starten() {
    var view = document.getElementById('view');
    if (!view) { return; }

    document.addEventListener('selectionchange', auswahlGeaendert);
    document.addEventListener('mouseup', auswahlGeaendert);
    document.addEventListener('touchend', auswahlGeaendert);
    document.addEventListener('keyup', function (ev) { if (ev.shiftKey || ev.key === 'Shift') { auswahlGeaendert(); } });

    /* Klick oder Enter auf eine Markierung nimmt sie weg. */
    document.addEventListener('click', function (ev) {
      var mark = ev.target && ev.target.closest ? ev.target.closest('mark.mk-mark') : null;
      if (mark) { ev.preventDefault(); markEntfernen(mark); }
    });
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t && t.classList && t.classList.contains('mk-mark')) {
        ev.preventDefault();
        markEntfernen(t);
      }
    });
    global.addEventListener('hashchange', function () { if (blase) { blase.hidden = true; } });
    global.addEventListener('scroll', function () { if (blase && !blase.hidden) { blaseZeigen(); } }, true);

    beobachter = new global.MutationObserver(function () { if (stumm === 0) { planen(); } });
    beobachter.observe(view, { childList: true, subtree: true });
    weitere.forEach(function (w) { beobachter.observe(w, { childList: true, subtree: true }); });
    planen();
  }

  var planTimer = null;
  function planen() {
    if (planTimer) { clearTimeout(planTimer); }
    planTimer = setTimeout(function () { planTimer = null; anwenden(); }, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten);
  } else {
    starten();
  }

  /* Eine Wurzel ausserhalb von #view (das Handbuch im Fenster): ihre
     Blöcke bekommen die Markierungen wie die Seite. */
  function beobachten(wurzel) {
    if (!wurzel || weitere.indexOf(wurzel) !== -1) { return; }
    weitere.push(wurzel);
    if (beobachter) { beobachter.observe(wurzel, { childList: true, subtree: true }); }
    planen();
  }

  HT.markieren = { anwenden: anwenden, fuerOrt: fuerOrt, beobachten: beobachten };
}(window));
