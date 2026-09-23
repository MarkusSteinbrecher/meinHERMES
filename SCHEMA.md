# Datenschema — meinHERMES

Verbindlicher Kontrakt zwischen Inhalt und Frontend. Alle Inhalte liegen als JSON in `data/`, eine Datei je Kategorie, Top-Level ist ein Array von Einträgen. Sprache: Deutsch, Schweizer Rechtschreibung (ss statt ß), HERMES-2022-Terminologie exakt — keine Synonyme, keine Umschreibungen.

## Dateien und Kategorien

| Datei | `kategorie` | Inhalt |
|---|---|---|
| `data/phasen.json` | `phase` | Alle sechs definierten Phasen (fünf klassisch: Initialisierung, Konzept, Realisierung, Einführung, Abschluss; agil: Initialisierung, Umsetzung, Abschluss) inkl. Meilensteine je Phase |
| `data/szenarien.json` | `szenario` | Standardszenarien (inkl. agile Varianten) |
| `data/module.json` | `modul` | Alle Module |
| `data/aufgaben.json` | `aufgabe` | Alle Aufgaben |
| `data/ergebnisse.json` | `ergebnis` | Alle Ergebnisse |
| `data/rollen.json` | `rolle` | Alle Rollen |
| `data/grundbegriffe.json` | `grundbegriff` | Nur für die Lernkarten: 39 Grundbegriffe des Methodenverständnisses (Ergebnisorientierung, Meilenstein, Entscheidungspunkt, Sizing, Tailoring usw.), kuratiert aus den Übersichtsseiten von hermes.admin.ch mit `quelle` je Eintrag. Geladen, aber nicht in `alleEintraege()` und `eintragMitId` — Suche, Handbuch, Überblick, Graph und Quiz kennen sie nicht; Zugriff über `eintraegeDerKategorie('grundbegriff')`. Genutzt werden `begriff`, `definition` und `quelle` |
| `data/quizfragen.json` | — | Verständnisfragen des Quiz (eigenes Schema, siehe unten) |
| `data/handbuch/*.json` | — | Importierte Handbuchtexte von hermes.admin.ch (generiert von `tools/handbuch-import.py`, nicht von Hand pflegen) |
| `data/handbuch/rhb/*.json` | — | Das Referenzhandbuch (PDF) als Text, ein Kapitel je Datei (generiert von `tools/rhb-import.py`, nicht von Hand pflegen) |

## Pflichtfelder je Eintrag

```json
{
  "id": "aufgabe-ausschreibung-erarbeiten",
  "kategorie": "aufgabe",
  "begriff": "Ausschreibung erarbeiten",
  "definition": "Kurzdefinition in 1–3 Sätzen, möglichst nah am Original-Wortlaut der HERMES-Dokumentation.",
  "quelle": {
    "url": "https://www.hermes.admin.ch/de/projektmanagement/aufgaben/ausschreibung-erarbeiten.html",
    "bezeichnung": "HERMES online · Aufgabe «Ausschreibung erarbeiten»"
  }
}
```

- `id`: `{kategorie}-{slug}`, eindeutig über **alle** Dateien, nur Kleinbuchstaben/Ziffern/Bindestriche.
- `begriff`: exakter HERMES-Wortlaut (Prüfungsrelevanz!).
- `quelle.url`: Detailseite des Elements auf hermes.admin.ch (URL-Muster unten); **jede URL muss per Abruf verifiziert sein** (HTTP 200 und die Seite beschreibt tatsächlich dieses Element). Nur wenn keine Detailseite existiert, auf die passende Übersichtsseite verlinken. Über diese URL findet der Import auch den Handbuchtext des Eintrags (`data/handbuch/elemente-<kategorie>.json`, Schlüssel = `id`).
- `definition`: Der **erste Satz** ist die Kurzfassung der Stufe «Kurz» und muss für sich stehen (Fallback: Feld `kurz`).

## Optionale Felder (je nach Kategorie sinnvoll)

```json
{
  "details": "Prüfungsrelevante Zusatzpunkte als reiner Text; Absätze mit \n\n. Keine Markdown-Syntax.",
  "phasen": ["Konzept"],
  "module": ["Beschaffung"],
  "verantwortlich": "Projektleiter",
  "beteiligt": ["Anwendervertreter"],
  "ergebnisse": ["Ausschreibung"],
  "ergebnisPhasen": "Aufgaben: { Ergebnis: [Phasen] } — Phasen, in denen die Aufgabe das Ergebnis erzeugt (Tabellen «Aufgaben und Ergebnisse Modul …», gesetzt von tools/ergebnis-phasen.py)",
  "modulPhasen": "Aufgaben und Ergebnisse: { Modul: [Phasen] } — Phasen, in denen der Eintrag im jeweiligen Modul angekreuzt ist (dieselben Tabellen, gesetzt von tools/ergebnis-phasen.py); nur wo nicht jede Phase in jedem Modul des Eintrags gilt: 1 Aufgabe («Prototyping durchführen»), 16 Ergebnisse",
  "grundlagen": "Aufgaben: [Ergebnisse], auf denen die Aufgabe aufbaut (Abschnitt «Grundlagen» der Aufgabenseite, gesetzt von tools/aufgabe-grundlagen.py; fehlt bei «Prototyping durchführen»)",
  "ebene": "Führung",
  "meilensteine": [{ "name": "Freigabe Umsetzung", "beschreibung": "…" }],
  "kurz": "Nur wenn der erste Satz der Definition nicht als Kurzfassung taugt.",
  "typ": "Ergebnisse: Dokument | Checkliste | Zustand | Meilenstein (aus Tabellen 16/17, gesetzt von tools/ergebnis-typen.py)",
  "minimalGefordert": true
}
```

Querverweise auf andere Elemente (z. B. `ergebnisse`, `verantwortlich`) als **exakte Begriffs-Strings**, nicht als IDs.

## URL-Muster hermes.admin.ch

`https://www.hermes.admin.ch/de/projektmanagement/{phasen|szenarien|module|ergebnisse|aufgaben|rollen}/{slug}.html`

Umlaute im Slug: ä→ae, ö→oe, ü→ue. Übersichtsseiten: `…/de/projektmanagement/{kategorie}.html`. Referenzhandbuch (PDF): über `https://www.hermes.admin.ch/de/downloads.html`.

## Quizfragen (`data/quizfragen.json`)

Eine Liste geschriebener Verständnisfragen; je Frage sind eine oder mehrere Antworten richtig.

```json
{
  "id": "q-121",
  "situation": "Die Projektleiterin eines kantonalen Amtes … (nur bei Praxissituationen)",
  "frage": "Welche Aussagen sind mit HERMES vereinbar?",
  "antworten": ["Aussage A", "Aussage B", "Aussage C", "Aussage D"],
  "richtig": [0, 2],
  "begruendungen": ["Stimmt: … (RHB 4.2.1, S. 54)", "Stimmt nicht: …", "Stimmt: …", "Stimmt nicht: …"],
  "erklaerung": "Der Zusammenhang, den die Frage prüft.",
  "quelle": { "url": "…", "bezeichnung": "…" },
  "kategorie": "ergebnis",
  "beleg": { "zitat": "Wörtlicher Satz aus dem Referenzhandbuch, der den Kern belegt.", "kapitel": "4.2.1 Titel", "seite": 54 }
}
```

- `richtig` ist die Liste der 0-basierten Indizes, aufsteigend, mindestens einer; vier oder fünf Antworten.
- `begruendungen` (Pflicht ab q-121): je Antwort ein Satz, der mit «Stimmt:» oder «Stimmt nicht:» beginnt, passend zu `richtig`, mit Verweis auf die Stelle im Referenzhandbuch. q-001–q-120 haben nur `erklaerung` (je genau eine richtige Antwort).
- `situation` ist optional: ein erfundener Fall in der dritten Person, der über der Frage steht.
- Nur fragen, was das Handbuch ausdrücklich sagt; falsche Aussagen sind plausible Verwechslungen, die dem Handbuch klar widersprechen.
- `beleg` ist Pflicht: wörtliches Zitat (Silbentrennung aufgelöst), Kapitelnummer mit Titel und Seitenzahl des Referenzhandbuchs (Ausgabe 2022, 3. Auflage). Tabelleninhalte dürfen als «Tabelle N: …» paraphrasiert werden. `tools/quiz-pruefen.py --rhb` prüft Form und Zitate gegen den Text in `data/handbuch/rhb/`.

## Handbuchtexte (`data/handbuch/`, generiert)

`kapitel.json`: Array der Kapitel `{ id, titel, nummer, seite, url, teile: [{ titel, url, nummer, seite, abschnitte: [{ titel, ebene, nummer?, seite?, bloecke }] }] }`.
`elemente-<kategorie>.json`: Objekt `id → { titel, url, nummer, seite, abschnitte }`.
Blöcke: `{ t: "p", text }`, `{ t: "ul"|"ol", items: [{ text, items? }] }`, `{ t: "tabelle", titel, zeilen: [[{ text, kopf? }]] }`, `{ t: "abb", src, datei?, text }`, `{ t: "download", titel, datei, groesse, url }` (Dokumentvorlage `.dotx`), `{ t: "h", n, text }`. Begriffe in Listen und Zellen werden im Frontend über den exakten Wortlaut auf Lexikoneinträge verlinkt.

## Referenzhandbuch als Text (`data/handbuch/rhb/`, generiert)

Quelle ist das PDF «Referenzhandbuch Projektmanagement, Ausgabe 2022, 3. Auflage 09.03.2026»; `tools/rhb-import.py` liest es mit PyMuPDF (Schriftgrössen und Fettdruck ergeben die Titelebenen, Zeichnungsflächen die Tabellen und Abbildungen) und legt den Text 1:1 in der Gliederung des PDF ab. Die Seite «Handbuch» zeigt ausschliesslich diese Dateien; `kapitel.json` und `elemente-*.json` (Online-Import) bleiben für den Überblick, die Abbildung 1 und die Karten ausserhalb des Handbuchs.

`index.json`: `{ quelle: { titel, ausgabe, seiten, pdf, online, downloads }, kapitel: [{ id, nummer, titel, kategorie, seite, url, datei, abschnitte, inhalt: [{ nummer?, titel, ebene, seite }] }] }` — `pdf` ist die Adresse des PDF; `…#page=<seite>` öffnet die Seite im Browser.
`<kapitel>.json` (vorwort, methodenueberblick = A, methodenelemente = B, phasen … hinweise = 1–7, vokabular): `{ id, nummer, titel, kategorie, seite, url, abschnitte: [{ nummer?, titel, ebene, seite, url?, element?, bloecke }] }`. Die Abschnitte stehen flach in Leserichtung; `ebene` 1 = Kapiteltitel, 2 = x.y, 3 = x.y.z, 4 = x.y.z.w. `url` ist die eigene Seite auf HERMES online (Kapitel, 7.4.x, Elemente), `element` die `id` des Eintrags aus `data/`, dessen Beschreibung der Abschnitt ist (über die Nummer aus `elemente-<kategorie>.json` zugeordnet; alle 220 Elemente). Nicht übernommen: Inhalts-, Tabellen- und Abbildungsverzeichnis, Index (Seiten 234–248).
Blöcke wie oben, jeder mit `seite` (die PDF-Seite, auf der der Block beginnt — Absätze, Listen und Tabellen, die über den Seitenumbruch laufen, bleiben ein Block; die Seite «Handbuch» setzt daraus Seitenmarken), dazu `{ t: "p", art: "kursiv"|"fussnote", text }` (Fussnoten mit Hochzahl, am Ende des Abschnitts der Seite), `{ t: "h", text, art? }` für fette Zwischentitel ohne Nummer («Beschreibung», «Inhalt») und `{ t: "tabelle", titel, unten: true, zeilen }` — die Beschriftung steht wie im PDF unter der Tabelle; `quelle: "online"` markiert Tabelle 1, die im PDF als Grafik gesetzt ist und deren Zeilen von HERMES online stammen. Abbildungen: nummerierte über die Abbildungsnummer den SVGs aus `assets/abb/` zugeordnet (35 von 35; fünf ohne SVG als PNG aus dem PDF in `assets/rhb/`), Phasenstreifen der Elemente über das Element. Silbentrennung wird am Zeilenende aufgelöst (Wortschatz aus dem Online-Import entscheidet «Projekt-Governance» gegen «Dokument»); Blocksatzzeilen unter 505 pt Breite beenden einen Absatz.

## Graph (abgeleitet, keine eigene Datei)

`js/graph-modell.js` baut zur Laufzeit einen Graphen aus den Einträgen. Knoten sind **nur** Aufgaben, Ergebnisse und Rollen — sie beschreiben zusammen den Ablauf: wer tut was, und was entsteht dabei. Phasen, Module und Szenarien sind keine Knoten, sondern der **Umfang**: sie wählen aus, welche Aufgaben und Ergebnisse gezeigt werden (Grundbegriffe waren am 2026-09-11 entfernt worden und stehen seit 2026-09-16 wieder in `data/grundbegriffe.json`, aber nur für die Lernkarten; die 27 kuratierten Quizfragen dazu tragen keine `kategorie` und stehen immer im Pool). Jede Kante ist auf ein Feld eines Eintrags zurückführbar; es werden keine Beziehungen ergänzt:

| Beziehung | Quelle (Feld) | Richtung |
|---|---|---|
| `verantwortlich` | `aufgabe.verantwortlich` (mehrere Rollen kommagetrennt) | Rolle → Aufgabe |
| `beteiligt` | `aufgabe.beteiligt` (ohne die bereits verantwortliche Rolle) | Rolle → Aufgabe |
| `erzeugt` | `aufgabe.ergebnisse` | Aufgabe → Ergebnis |
| `ergebnisrolle` | `ergebnis.verantwortlich` | Rolle → Ergebnis |

Der Umfang (`{ vorgehen, phasen[], module[] }`) filtert über `aufgabe.phasen`/`ergebnis.phasen` und `aufgabe.module`/`ergebnis.module`, und zwar als Paar: in einem Modul zählen nur die Phasen, die das Element dort hat (`modulPhasen`, abgefragt über `HT.daten.phasenImModul`) — «Prototyping durchführen» läuft im Modul Projektgrundlagen nur in der Initialisierung, in Produkt und IT-System in Konzept, Realisierung und Umsetzung; `vorgehen` schränkt zusätzlich auf die Phasen der klassischen (Initialisierung, Konzept, Realisierung, Einführung, Abschluss) oder der agilen Vorgehensweise (Initialisierung, Umsetzung, Abschluss) ein. Leere Auswahl heisst «alle». Rollen tragen selbst weder Phasen noch Module — sie erscheinen, wenn sie über eine eingeblendete Beziehung an einer Aufgabe oder einem Ergebnis im Umfang hängen. `szenario.module` dient als Vorwahl der Modulauswahl. Aufgaben und Ergebnisse ohne Phasenangabe — die Sammeleinträge «Checklisten» und «Meilensteine» — lassen sich nicht im Ablauf verorten und erscheinen nur im Lexikon. Eine Kante `erzeugt` gilt im Umfang nur, wenn die Aufgabe das Ergebnis in einer seiner Phasen erzeugt: die Modultabellen kreuzen die Phasen je Paar an (`aufgabe.ergebnisPhasen`), ohne Angabe gilt der Schnitt der Phasen beider — «Projekt steuern → QS- und Risikobericht» fehlt so im Abschluss, «Projekt führen und kontrollieren → Lösungsanforderungen» in der klassischen Vorgehensweise ganz. Mit Modulauswahl gilt die Kante zudem nur in den Phasen, die die Aufgabe in einem dieser Module hat.

Die Ansicht («Nach Phasen» oder «Nach Modulen») legt die Bahnen des Swimlane-Layouts fest: eine Aufgabe steht in der ersten Bahn, zu der sie laut ihren Feldern gehört (Phase und Modul als Paar; in «Nach Phasen» ist ihr Modul-Zwischentitel das erste ihrer Module, das die Phase trägt); ein Ergebnis in der Bahn der Aufgabe, die es erzeugt (ohne erzeugende Aufgabe in seiner eigenen ersten Phase bzw. seinem ersten Modul). Rollen bekommen keine Bahn — sie tragen in HERMES weder Phase noch Modul und stehen als durchgehende Spalte daneben. Die Daten tragen das: 68 von 71 Aufgaben hängen an genau einem Modul, 55 von 71 an genau einer klassischen Phase.

In einer Bahn stehen die Aufgaben nach Modul, frühester Phase und der Stelle ihres ersten Ergebnisses in der Abbildung 1. Danach kommt jede Aufgabe nach den Aufgaben desselben Abschnitts (Bahn, Modul, früheste Phase), auf deren Ergebnissen sie laut `aufgabe.grundlagen` aufbaut. Diese rücken vor sie, alles andere behält seine Folge. Gezählt wird nur, was die andere Aufgabe in der Phase erzeugt, und nicht, was sie selbst als Grundlage braucht und bloss fortschreibt (etwa den Projektmanagementplan); ein Meilenstein zählt immer. Bauen zwei aufeinander auf, gilt der Meilenstein. So steht im Modul Beschaffung «Ausschreibung erarbeiten» vor «Entscheid Ausschreibung treffen» und dieser vor «Ausschreibung durchführen»; beide Aufgaben stehen in der Abbildung an derselben Stelle, der Entscheid dort ohne Kasten. Der Trainer übernimmt die Reihenfolge des Graphen.

Querverweise werden über den exakten Begriff aufgelöst (`eintragMitBegriff`); nicht auflösbare Werte erzeugen keine Kante. Abgeleitete Kennzeichen: Entscheidungsaufgabe (`begriff` beginnt mit «Entscheid »), Ergebnistyp und «minimal gefordert» aus den Feldern `typ`/`minimalGefordert`.

## Blöcke und Schritte (abgeleitet, keine eigene Datei)

`HT.graph.bloecke(umfang, mitUnter)` (`js/graph-modell.js`) zerlegt einen Umfang in Blöcke — je Aufgabe ihre verantwortliche Rolle und die Ergebnisse, die sie im Feld erzeugt. Zusammengesetzt wird er aus Feldern von je einer Phase (Zeile der Abbildung 1) und einem Modul (Spalte): Phase für Phase (leer: alle der Vorgehensweise), darin Modul für Modul in der Reihenfolge von `data/module.json` (leer: alle). Eine Aufgabe steht so in jeder ihrer Phasen unter jedem Modul, das sie dort hat (`HT.daten.phasenImModul`), jeweils mit den Ergebnissen dieses Felds; Rolle und Ergebnisse kommen aus den Kanten «verantwortlich» und «erzeugt» des Teilgraphen, die Reihenfolge aus dem Graphen. Dieselben Blöcke übt das Zuordnen des Trainers und zeigt das nachgebaute Bild des Überblicks.

`HT.methodenbild.schritte(vorgehen)` (`js/methodenbild.js`) teilt eine Vorgehensweise in Schritte: das Gesamtbild (leerer Umfang), Initialisierung und Abschluss als je ein Schritt mit allen Modulen, jede übrige Phase je Modul; Projektsteuerung und Projektführung bilden einen Schritt, weil die Abbildung sie in einer Spalte zeigt. Schritte ohne Aufgabe fallen weg — klassisch sind es 30 nach dem Gesamtbild, agil 12. Ein Schritt ist ein Umfang `{ vorgehen, phasen, module }`; welcher gilt, folgt aus dem Filter (Mengengleichheit von Phasen und Modulen). Die frühere Feldseite `#/feld?phase=<Phase>&modul=<Modul>[,<Modul>…]` führt seit 2026-09-17 mit denselben Parametern in den Überblick.
