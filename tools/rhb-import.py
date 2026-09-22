#!/usr/bin/env python3
"""Referenzhandbuch (PDF) -> data/handbuch/rhb/*.json

Liest das PDF «HERMES-Projektmanagement.pdf» (Referenzhandbuch Projektmanagement,
Ausgabe 2022, 3. Auflage 09.03.2026) mit PyMuPDF und legt den Text 1:1 als
strukturierte Blöcke ab — in der Gliederung des PDF mit Kapitelnummern und
Seitenzahlen. Tabellen werden als Tabellen gelesen, Abbildungen über ihre
Nummer den vorhandenen SVGs aus dem Online-Import (assets/abb/) zugeordnet,
sonst als PNG aus dem PDF gerendert (assets/rhb/).

Aufruf:
    python3 tools/rhb-import.py --pdf /pfad/HERMES-Projektmanagement.pdf [--lib /pfad/zu/pymupdf]

Braucht PyMuPDF (pip install pymupdf). Die Online-Daten in data/handbuch/
(kapitel.json, elemente-*.json) liefern die Online-Verweise je Kapitel und
Element sowie die SVG-Dateien der Abbildungen; sie bleiben unverändert.

Ausgabe:
    data/handbuch/rhb/index.json          Kapitelliste, Quelle, Inhaltsverzeichnis
    data/handbuch/rhb/<kapitel>.json      Abschnitte mit Blöcken (p, ul, ol, h, tabelle, abb)
    assets/rhb/*.png                      Abbildungen ohne SVG-Entsprechung
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter, OrderedDict

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.dirname(HIER)
DATEN = os.path.join(WURZEL, 'data', 'handbuch')
AUSGABE = os.path.join(DATEN, 'rhb')
PNG_ORDNER = os.path.join(WURZEL, 'assets', 'rhb')

PDF_URL = ('https://www.hermes.admin.ch/_Resources/Persistent/c/7/1/6/'
           'c7166cbb014fffc5a7ebb4697ba59ef63edb0de3/HERMES-Projektmanagement.pdf')
LETZTE_TEXTSEITE = 233   # danach Inhalts-, Tabellen-, Abbildungsverzeichnis, Index

# Kapitel des Handbuchs -> Datei. Ebene-1-Titel ohne Nummer werden über den
# Titel zugeordnet, nummerierte über die Nummer.
KAPITEL = [
    ('vorwort', '', 'Vorwort', None),
    ('methodenueberblick', 'A', 'Methodenüberblick', None),
    ('methodenelemente', 'B', 'HERMES-Projektmanagement-Methodenelemente', None),
    ('phasen', '1', 'Phasen', 'phase'),
    ('szenarien', '2', 'Szenarien', 'szenario'),
    ('module', '3', 'Module', 'modul'),
    ('ergebnisse', '4', 'Ergebnisse', 'ergebnis'),
    ('aufgaben', '5', 'Aufgaben', 'aufgabe'),
    ('rollen', '6', 'Rollen', 'rolle'),
    ('hinweise', '7', 'Hinweise zur Anwendung', None),
    ('vokabular', '', 'Vokabular', None),
]
TITEL_ZU_KAPITEL = {'Vorwort': 'vorwort', 'Impressum': 'vorwort', 'Prolog': 'vorwort', 'Vokabular': 'vokabular'}

NUMMER_RE = re.compile(r'^([A-Z]|\d+)((?:\.\d+)*)\s+(.+)$')
BESCHRIFTUNG_RE = re.compile(r'^(Abbildung|Tabelle)\s+(\d+):\s*(.*)$')
FUSSNOTE_RE = re.compile(r'^(\d+)\.\s+(.*)$')
OL_RE = re.compile(r'^(\d+)\.\s+(.*)$')
SEITENZAHL_RE = re.compile(r'^\d+/\d+$')
HOCH = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
BINDEWOERTER = {'und', 'oder', 'bzw', 'sowie', 'als', 'resp', 'beziehungsweise'}
PHASEN = {'Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss'}
# Im PDF als Grafik (mit Klammern) gesetzt; die Zeilenstruktur stammt von HERMES online.
ONLINE_TABELLEN = {1}
ZEILE_VOLL = 505   # Blocksatz endet bei 525; eine kürzere Zeile ist die letzte ihres Absatzes

# --- PyMuPDF ---------------------------------------------------------------

def fitz_laden(lib):
    if lib:
        sys.path.insert(0, lib)
    try:
        import fitz  # noqa
    except ImportError:
        sys.exit('PyMuPDF fehlt: pip install pymupdf (oder --lib /pfad/zu/site-packages)')
    return fitz


# --- Online-Daten als Referenz ---------------------------------------------

def online_laden():
    """Verweise und Abbildungen aus dem Online-Import: nummer -> {url, id, kategorie},
    Abbildungsnummer -> Datei, Element-id -> Datei des Phasenstreifens, Wortschatz."""
    ref = {'url': {}, 'element': {}, 'abb': {}, 'streifen': {}, 'abschnitt_abb': {}, 'tabellen': {}, 'woerter': set()}
    woerter = ref['woerter']

    def worte(text):
        for w in re.findall(r'[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]*', text or ''):
            woerter.add(w)

    def bloecke_lesen(bl):
        for b in bl or []:
            if b.get('t') == 'abb':
                m = re.match(r'Abbildung (\d+):\s*(.*)', b.get('text') or '')
                if m and b.get('datei'):
                    ref['abb'].setdefault(int(m.group(1)), (m.group(2), b['datei']))
            elif b.get('t') == 'tabelle':
                m = re.match(r'Tabelle (\d+):', b.get('titel') or '')
                if m:
                    ref['tabellen'][int(m.group(1))] = b
                for z in b.get('zeilen') or []:
                    for zelle in z:
                        worte(zelle.get('text'))
            elif b.get('t') in ('ul', 'ol'):
                def items(liste):
                    for it in liste or []:
                        worte(it.get('text'))
                        worte(it.get('titel'))
                        items(it.get('items'))
                items(b.get('items'))
            else:
                worte(b.get('text'))

    kap_datei = os.path.join(DATEN, 'kapitel.json')
    if os.path.exists(kap_datei):
        for kap in json.load(open(kap_datei, encoding='utf-8')):
            if kap.get('url') and kap.get('nummer'):
                for n in str(kap['nummer']).split('/'):
                    ref['url'].setdefault(n, kap['url'])
            for teil in kap.get('teile') or []:
                if teil.get('nummer') and teil.get('url'):
                    ref['url'].setdefault(str(teil['nummer']), teil['url'])
                for a in teil.get('abschnitte') or []:
                    bloecke_lesen(a.get('bloecke'))
                    for b in a.get('bloecke') or []:
                        if b.get('t') == 'abb' and b.get('datei') and not (b.get('text') or '').strip() and a.get('nummer'):
                            ref['abschnitt_abb'].setdefault(str(a['nummer']), []).append(b['datei'])

    for datei in sorted(glob.glob(os.path.join(DATEN, 'elemente-*.json'))):
        kategorie = re.search(r'elemente-([a-z]+)\.json$', datei).group(1)
        for eid, e in json.load(open(datei, encoding='utf-8')).items():
            if e.get('nummer'):
                ref['element'][str(e['nummer'])] = {'id': eid, 'url': e.get('url'), 'kategorie': kategorie}
            for a in e.get('abschnitte') or []:
                for b in a.get('bloecke') or []:
                    if b.get('t') == 'abb' and b.get('datei') and not (b.get('text') or '').strip():
                        ref['streifen'].setdefault(eid, b['datei'])
                bloecke_lesen(a.get('bloecke'))
    return ref


# --- Zeilen und Zeichnungsbereiche einer Seite ------------------------------

class Zeile(object):
    __slots__ = ('x0', 'y0', 'x1', 'y1', 'spans', 'text', 'bereich')

    def __init__(self, x0, y0, x1, y1, spans):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.spans = spans
        self.text = ''.join(s['text'] for s in spans).strip()
        self.bereich = None

    @property
    def groesse(self):
        for s in self.spans:
            if s['text'].strip():
                return round(s['size'], 1)
        return round(self.spans[0]['size'], 1)

    def schriftspans(self):
        """Spans mit Text, ohne Symbolschriften (ein Pfeil davor macht einen
        fetten Zwischentitel nicht zum gewöhnlichen Absatz)."""
        return [s for s in self.spans if s['text'].strip() and not symboltabelle(s['font'])]

    @property
    def fett(self):
        sp = self.schriftspans()
        return bool(sp) and all('Bold' in s['font'] for s in sp)

    @property
    def kursiv(self):
        sp = self.schriftspans()
        return bool(sp) and all('Italic' in s['font'] for s in sp)

    @property
    def aufzaehlung(self):
        return self.text.startswith('•')

    @property
    def nummeriert(self):
        return bool(OL_RE.match(self.text)) and 76 <= self.x0 <= 90 and self.groesse >= 10

    @property
    def fussnote(self):
        return self.groesse < 9.5 and self.groesse >= 8.5 and 75 <= self.x0 <= 90

    @property
    def koerper(self):
        """Zeile auf Textbreite links (Absatz, Titel, Beschriftung)."""
        return self.x0 < 73


# Symbolschriften: PyMuPDF liefert ihre Zeichencodes als Latin-1. In
# Kapitel 7.4.1 stehen vor den fett-kursiven Zwischentiteln Pfeile aus
# «Dingbats» (Code 0xAE), die sonst als «®» erschienen.
SYMBOLSCHRIFTEN = {
    'Dingbats': {'\u00ae': '\u27a4'},   # ® -> ➤
}


def symboltabelle(font):
    for name, tabelle in SYMBOLSCHRIFTEN.items():
        if name in font:
            return tabelle
    return None


def symbole_uebersetzen(spans):
    for s in spans:
        tabelle = symboltabelle(s['font'])
        if tabelle:
            s['text'] = ''.join(tabelle.get(c, c) for c in s['text'])
    return spans


def zeilen_lesen(fitz, seite):
    roh = []
    for block in seite.get_text('dict')['blocks']:
        if block['type'] != 0:
            continue
        for l in block['lines']:
            spans = symbole_uebersetzen([s for s in l['spans'] if s['text']])
            if not spans or not ''.join(s['text'] for s in spans).strip():
                continue
            x0, y0, x1, y1 = l['bbox']
            z = Zeile(x0, y0, x1, y1, spans)
            if y0 > 800 and SEITENZAHL_RE.match(z.text):
                continue                      # Seitenzahl im Fuss
            roh.append(z)
    roh.sort(key=lambda z: (round(z.y0), z.x0))
    # Gleiche Grundlinie -> eine Zeile (Nummer + Titel einer Überschrift).
    zeilen = []
    for z in roh:
        if zeilen and abs(z.y0 - zeilen[-1].y0) < 2.5 and z.x0 >= zeilen[-1].x1 - 1:
            v = zeilen[-1]
            luecke = z.x0 - v.x1
            if luecke > 1.0 and not v.text.endswith(' '):
                v.spans = v.spans + [{'text': ' ', 'font': v.spans[-1]['font'], 'size': v.spans[-1]['size'], 'flags': 0}]
            v.spans = v.spans + z.spans
            v.text = ''.join(s['text'] for s in v.spans).strip()
            v.x1 = max(v.x1, z.x1)
            v.y1 = max(v.y1, z.y1)
            continue
        zeilen.append(z)
    return zeilen


def bereiche_lesen(fitz, seite, zeilen):
    """Zusammenhängende Zeichnungsflächen (Tabellen, Abbildungen)."""
    rects = sorted([fitz.Rect(d['rect']) for d in seite.get_drawings()], key=lambda r: r.y0)
    gruppen = []
    for r in rects:
        if r.is_empty and r.width < 0.5 and r.height < 0.5:
            continue
        if gruppen and r.y0 <= gruppen[-1].y1 + 4:
            gruppen[-1] |= r
        else:
            gruppen.append(fitz.Rect(r))
    # Zwei Gruppen ohne Fliesstext dazwischen gehören zusammen (Zebra-Tabellen
    # zeichnen nur jede zweite Zeile).
    def trennt(a, b):
        for z in zeilen:
            if z.y0 >= a.y1 - 1 and z.y1 <= b.y0 + 1:
                if z.koerper or z.aufzaehlung or z.nummeriert or z.fussnote:
                    return True
        return False

    gemischt = []
    for g in gruppen:
        if gemischt and g.y0 - gemischt[-1].y1 < 60 and not trennt(gemischt[-1], g):
            gemischt[-1] |= g
        else:
            gemischt.append(fitz.Rect(g))
    # Ungezeichnete letzte Zeilen (Zebra) unterhalb anhängen.
    bereiche = []
    for g in gemischt:
        if g.height < 3:
            continue
        r = fitz.Rect(g)
        folgende = sorted([z for z in zeilen if z.y0 >= r.y1 - 1], key=lambda z: z.y0)
        for z in folgende:
            if z.koerper or z.aufzaehlung or z.nummeriert or z.fussnote or z.fett and z.groesse >= 12:
                break
            if z.y0 - r.y1 > 25:
                break
            r.y1 = max(r.y1, z.y1)
        bereiche.append(r)
    for b in bereiche:
        for z in zeilen:
            mitte = (z.y0 + z.y1) / 2
            if b.y0 - 1 <= mitte <= b.y1 + 1 and z.x1 > b.x0 - 2 and z.x0 < b.x1 + 2:
                z.bereich = b
    return bereiche


# --- Textzusammenbau ---------------------------------------------------------

class Woerter(object):
    def __init__(self, woerter):
        self.klein = set(w.lower() for w in woerter)

    def verbinden(self, a, b):
        """Zeilenumbruch mit Trennstrich: 'Migra-' + 'tion' -> 'Migration',
        'Projekt-' + 'Governance' -> 'Projekt-Governance'."""
        if not a.endswith('-') or not b:
            return (a + ' ' + b).strip()
        m1 = re.search(r'([A-Za-zÄÖÜäöüß]+)-$', a)
        m2 = re.match(r'([A-Za-zÄÖÜäöüß]+)', b)
        if not m1 or not m2:
            return a + b if b[:1].islower() else a + ' ' + b
        links, rechts = m1.group(1), m2.group(1)
        if rechts.lower() in BINDEWOERTER:
            return a + ' ' + b            # «Prozess- und Organisationsbeschreibung»
        zusammen = (links + rechts).lower()
        mit = (links + '-' + rechts).lower()
        if zusammen in self.klein and mit not in self.klein:
            return a[:-1] + b
        if mit in self.klein and zusammen not in self.klein:
            return a + b
        if rechts[:1].islower():
            return a[:-1] + b
        return a + b


def zeilentext(z):
    """Text einer Zeile; hochgestellte Fussnotenziffern als Hochzahlen."""
    teile = []
    for s in z.spans:
        t = s['text']
        if s['size'] < 8.5 and t.strip().isdigit() and z.groesse >= 10:
            t = t.strip().translate(HOCH)
        teile.append(t)
    return re.sub(r'\s+', ' ', ''.join(teile)).strip()


# --- Tabellen ---------------------------------------------------------------

def zelle_text(w, s):
    if s is None:
        return ''
    zeilen = [re.sub(r'\s+', ' ', t).strip() for t in str(s).split('\n')]
    zeilen = [t for t in zeilen if t]
    text = ''
    for t in zeilen:
        text = w.verbinden(text, t) if text else t
    return text


def raster_lesen(bereich, zeilen, spalten, baender, w):
    """Tabelle aus Zeilenbändern (schattierte Zeilen und die Lücken dazwischen)
    und Spaltengrenzen; Zellen aus den Textzeilen des Bereichs."""
    if len(spalten) < 1:
        return None
    innen = sorted([z for z in zeilen if z.bereich is bereich], key=lambda z: (z.y0, z.x0))
    grenzen = [bereich.y0 - 1]
    for y0, y1 in sorted(baender):
        y0 = max(y0, grenzen[-1])
        if y1 > y0:
            grenzen += [y0, y1]
    grenzen.append(bereich.y1 + 1)
    reihen = []
    for i in range(len(grenzen) - 1):
        y0, y1 = grenzen[i], grenzen[i + 1]
        if y1 - y0 < 4:
            continue
        zl = [z for z in innen if y0 - 1 <= (z.y0 + z.y1) / 2 <= y1 + 1]
        if not zl:
            continue
        zellen = [[] for _ in spalten]
        fett = all(z.fett for z in zl)
        for z in zl:
            for sp in z.spans:
                t = sp['text'].strip()
                if not t:
                    continue
                x = sp['bbox'][0] + 1
                idx = None
                for si, (a, b) in enumerate(spalten):
                    if a - 2 <= x <= b + 2:
                        idx = si
                        break
                if idx is None:
                    idx = min(range(len(spalten)), key=lambda si: abs(spalten[si][0] - x))
                zellen[idx].append((round(sp['bbox'][1], 1), sp['bbox'][0], t))
        texte = []
        for zl_ in zellen:
            zl_.sort()
            text = ''
            letzte_y = None
            for y, x, t in zl_:
                if letzte_y is not None and abs(y - letzte_y) < 3:
                    text = (text + ' ' + t).strip()
                else:
                    text = w.verbinden(text, t) if text else t
                letzte_y = y
            texte.append(text)
        reihen.append((texte, fett))
    if len(reihen) < 2:
        return None
    kopf = 0
    for texte, fett in reihen:
        if fett:
            kopf += 1
        else:
            break
    return {'zeilen': [r[0] for r in reihen], 'kopf': kopf, 'fett': [r[1] for r in reihen],
            'spalten': len(spalten), 'abdeckung': None}


def spalten_aus_text(bereich, zeilen):
    """Spaltengrenzen aus den Anfangspositionen der Textstücke."""
    xs = sorted(set(round(sp['bbox'][0]) for z in zeilen if z.bereich is bereich for sp in z.spans if sp['text'].strip()))
    if not xs:
        return []
    starts = [xs[0]]
    for x in xs[1:]:
        if x - starts[-1] > 25:
            starts.append(x)
    spalten = []
    for i, x in enumerate(starts):
        ende = starts[i + 1] - 1 if i + 1 < len(starts) else bereich.x1
        spalten.append((x - 3, ende))
    return spalten


def tabelle_lesen(fitz, seite, bereich, zeilen, w):
    """Tabelle aus dem Bereich; None, wenn sich keine brauchbare lesen lässt.
    Reihenfolge: PyMuPDF-Tabelle, sonst Zebra-Tabelle aus den gefundenen
    Stücken, sonst Zeilenbänder aus den Schattierungen mit Spalten aus dem Text."""
    clip = fitz.Rect(bereich.x0 - 2, bereich.y0 - 2, bereich.x1 + 2, bereich.y1 + 2)
    try:
        gefunden = seite.find_tables(clip=clip).tables
    except Exception:
        gefunden = []
    gefunden = [t for t in gefunden if t.row_count >= 1 and t.col_count >= 1]
    bereichstext = re.sub(r'\W', '', ''.join(z.text for z in zeilen if z.bereich is bereich)).lower()

    def abdeckung(zeilen_aus):
        zellentext = re.sub(r'\W', '', ''.join(''.join(r) for r in zeilen_aus)).lower()
        return (len(zellentext) / len(bereichstext)) if bereichstext else 1.0

    if gefunden:
        t = max(gefunden, key=lambda t: t.row_count * t.col_count)
        if t.col_count >= 2:
            # Zellen nach Lage der Textstücke in den Spalten der gefundenen
            # Tabelle — extract() wirft in Zeilen ohne Linien die Zellen zusammen.
            zeilen_mit_zellen = [r for t2 in gefunden for r in t2.rows if r.cells and any(c is not None for c in r.cells)]
            breiteste = max(zeilen_mit_zellen, key=lambda r: sum(1 for c in r.cells if c is not None)) if zeilen_mit_zellen else None
            spalten = sorted((c[0], c[2]) for c in breiteste.cells if c is not None) if breiteste else []
            if len(spalten) >= 2:
                # Zeilenbänder aus allen gefundenen Stücken (Zebra-Tabellen
                # zerfallen in eines je schattierte Zeile; die Lücken sind Zeilen)
                tab = raster_lesen(bereich, zeilen, spalten, [(r.bbox[1], r.bbox[3]) for t2 in gefunden for r in t2.rows], w)
                if tab:
                    tab['abdeckung'] = abdeckung(tab['zeilen'])
                    if tab['abdeckung'] >= 0.85:
                        return tab
            zeilen_aus = []
            fett_aus = []
            for r, zeile in zip(t.rows, t.extract()):
                zellen = [zelle_text(w, s) for s in zeile]
                if not any(zellen):
                    continue
                zl = [z for z in zeilen if z.bereich is bereich and r.bbox[1] - 1 <= (z.y0 + z.y1) / 2 <= r.bbox[3] + 1]
                zeilen_aus.append(zellen)
                fett_aus.append(bool(zl) and all(z.fett for z in zl))
            if zeilen_aus and abdeckung(zeilen_aus) >= 0.85:
                kopf = 0
                for f in fett_aus:
                    if f:
                        kopf += 1
                    else:
                        break
                return {'zeilen': zeilen_aus, 'kopf': kopf, 'fett': fett_aus,
                        'spalten': t.col_count, 'abdeckung': abdeckung(zeilen_aus), 'extract': True}
        # Zebra: Spalten aus dem breitesten Stück, Bänder aus allen Stücken
        breit = max(gefunden, key=lambda t: t.col_count)
        spalten = sorted((c[0], c[2]) for c in breit.rows[0].cells if c is not None)
        if len(spalten) < 2:
            spalten = spalten_aus_text(bereich, zeilen)
        baender = [(r.bbox[1], r.bbox[3]) for t in gefunden for r in t.rows]
        tab = raster_lesen(bereich, zeilen, spalten, baender, w)
        if tab:
            tab['abdeckung'] = abdeckung(tab['zeilen'])
            if tab['abdeckung'] >= 0.85:
                tab['zebra'] = True
                return tab
    # Nur Schattierungen ganzer Zeilen, keine Linien: Spalten aus dem Text
    rects = [fitz.Rect(d['rect']) for d in seite.get_drawings()]
    rects = [r for r in rects if r.y0 >= bereich.y0 - 1 and r.y1 <= bereich.y1 + 1 and r.height >= 1]
    breite = [r for r in rects if r.width >= 0.8 * bereich.width and 8 <= r.height <= 45]
    if len(breite) >= 2 and len(breite) >= 0.6 * len(rects):
        spalten = spalten_aus_text(bereich, zeilen)
        tab = raster_lesen(bereich, zeilen, spalten, [(r.y0, r.y1) for r in breite], w)
        if tab:
            tab['abdeckung'] = abdeckung(tab['zeilen'])
            if tab['abdeckung'] >= 0.85:
                tab['zebra'] = True
                return tab
    return None


def tabelle_block(tab, titel):
    """Kopfzeilen sind die fetten Zeilen — nicht nur die am Anfang.

    Das Handbuch setzt auch mitten in einer Tabelle Zeilen wie eine Kopfzeile:
    die Gruppenzeilen von Tabelle 19 («Steuerung / Steuerungsrollen»,
    «Führung», «Ausführung») stehen wie die Spaltentitel fett und weiss auf
    dunkelblauem Grund, und läuft eine Tabelle über einen Seitenumbruch,
    wiederholt sie dort ihre Spaltentitel. Bisher zählte nur der fette Block
    am Anfang; alles danach wurde gewöhnliche Datenzeile — «Steuerung» sah
    darum anders aus als «Führung» und «Ausführung».
    """
    kopfzahl = int(tab['kopf'] or 0)
    fett = tab.get('fett') or []
    zeilen = []
    for i, z in enumerate(tab['zeilen']):
        zeile = []
        for text in z:
            zelle = {'text': text}
            if i < kopfzahl or (i < len(fett) and fett[i]):
                zelle['kopf'] = True
            zeile.append(zelle)
        zeilen.append(zeile)
    block = {'t': 'tabelle', 'zeilen': zeilen}
    if titel:
        block['titel'] = titel
        block['unten'] = True
    return block


# --- Seitenweise Analyse ------------------------------------------------------

class Bau(object):
    """Baut aus den Seiten die Kapitel mit Abschnitten und Blöcken."""

    def __init__(self, fitz, doc, ref):
        self.fitz = fitz
        self.doc = doc
        self.ref = ref
        self.w = Woerter(ref['woerter'])
        self.kapitel = OrderedDict((k[0], {'id': k[0], 'nummer': k[1], 'titel': k[2], 'kategorie': k[3], 'seite': None, 'url': ref['url'].get(k[1]) if k[1] else None, 'abschnitte': []}) for k in KAPITEL)
        self.aktuell = None          # aktueller Abschnitt
        self.seite_nr = None         # Seite, die gerade gelesen wird (Startseite neuer Blöcke)
        self.kap_id = 'vorwort'
        self.offen = None            # {'art': 'p'|'ul'|'ol'|'h', ...} letzter Block für Fortsetzung
        self.letzte_zeile = None     # letzte Fliesstextzeile (für Abstände)
        self.haengend = None         # Tabelle ohne Beschriftung, wartet auf Fortsetzung
        self.letzte_fussnote = None
        self.protokoll = Counter()
        self.png = []
        self.unbekannt = []
        self.abbildungen = {}

    # -- Abschnitte ------------------------------------------------------------

    def abschnitt_neu(self, nummer, titel, ebene, seite):
        kap_id = self.kap_id
        if ebene == 1:
            if nummer and nummer in [k[1] for k in KAPITEL]:
                kap_id = [k[0] for k in KAPITEL if k[1] == nummer][0]
            elif titel in TITEL_ZU_KAPITEL:
                kap_id = TITEL_ZU_KAPITEL[titel]
            else:
                self.unbekannt.append(('kapitel', seite, titel))
            self.kap_id = kap_id
            kap = self.kapitel[kap_id]
            if kap['seite'] is None:
                kap['seite'] = seite
        kap = self.kapitel[kap_id]
        a = OrderedDict()
        if nummer:
            a['nummer'] = nummer
        a['titel'] = titel
        a['ebene'] = ebene
        a['seite'] = seite
        if nummer and nummer in self.ref['url'] and ebene > 1:
            a['url'] = self.ref['url'][nummer]
        el = self.ref['element'].get(nummer) if nummer else None
        if el:
            a['element'] = el['id']
            if el.get('url'):
                a['url'] = el['url']
        a['bloecke'] = []
        kap['abschnitte'].append(a)
        self.aktuell = a
        self.offen = None
        return a

    def block(self, b):
        if self.aktuell is None:
            self.abschnitt_neu(None, 'Titelseite', 1, 1)
        # Die Seite, auf der der Block beginnt — auch wenn er (Absatz, Liste,
        # Tabelle) auf der nächsten Seite weiterläuft; die Seite zeigt eine
        # Seitenmarke im Text.
        b.setdefault('_start', self.seite_nr)
        self.aktuell['bloecke'].append(b)
        self.offen = b
        return b

    # -- Fliesstext ------------------------------------------------------------

    def absatz(self, text, gap, seite, stil=None, x1=None):
        o = self.offen
        if o and o.get('t') == 'p' and not o.get('art') and o.get('_seite') in (seite, seite - 1) and gap is not None and gap < 17.5 and not stil \
                and o.get('_x1', 999) >= ZEILE_VOLL:
            o['text'] = self.w.verbinden(o['text'], text)
            o['_seite'] = seite
            o['_x1'] = x1 if x1 is not None else 999
            return
        b = {'t': 'p', 'text': text, '_seite': seite, '_x1': x1 if x1 is not None else 999}
        if stil:
            b['art'] = stil
        self.block(b)

    def listenpunkt(self, art, ebene, text, seite):
        o = self.offen
        if not (o and o.get('t') in ('ul', 'ol') and o.get('_seite') in (seite, seite - 1)) or (ebene == 1 and o.get('t') != art):
            o = self.block({'t': art, 'items': [], '_seite': seite, '_stapel': []})
        o['_seite'] = seite
        stapel = o['_stapel']
        del stapel[ebene - 1:]
        eltern = o['items'] if not stapel else stapel[-1].setdefault('items', [])
        item = {'text': text}
        eltern.append(item)
        stapel.append(item)

    def fortsetzung(self, text, seite):
        """Umbruchzeile eines Listenpunkts oder Absatzes."""
        o = self.offen
        if o and o.get('t') in ('ul', 'ol') and o.get('_stapel'):
            it = o['_stapel'][-1]
            it['text'] = self.w.verbinden(it['text'], text)
            o['_seite'] = seite
            return True
        if o and o.get('t') == 'p':
            o['text'] = self.w.verbinden(o['text'], text)
            o['_seite'] = seite
            return True
        return False

    # -- Bereiche --------------------------------------------------------------

    def bereich_verarbeiten(self, seite_nr, seite, bereich, zeilen, beschriftung):
        fitz = self.fitz
        innen = [z for z in zeilen if z.bereich is bereich]
        art = beschriftung[0] if beschriftung else None
        nummer = int(beschriftung[1]) if beschriftung else None
        titel = ('%s %d: %s' % (beschriftung[0], nummer, beschriftung[2])) if beschriftung else None

        tab = None
        woerter = set(re.findall(r'[A-Za-zÄÖÜäöü]+', ' '.join(z.text for z in innen)))
        nur_phasen = bool(woerter) and woerter <= PHASEN
        if art == 'Tabelle' and nummer in ONLINE_TABELLEN and nummer in self.ref['tabellen']:
            # Ein zuvor gelesenes Teilstück derselben Tabelle (ohne Beschriftung) entfällt
            h = self.haengend
            if h and h.get('_block') in (self.aktuell['bloecke'] if self.aktuell else []):
                self.aktuell['bloecke'].remove(h['_block'])
                self.protokoll['tabelle-teilstueck-entfernt'] += 1
            b = dict(self.ref['tabellen'][nummer])
            b['titel'] = titel
            b['unten'] = True
            b['quelle'] = 'online'
            self.protokoll['tabelle-online'] += 1
            self.haengend = None
            self.block(b)
            self.offen = None
            return
        if art != 'Abbildung' and not nur_phasen:
            tab = tabelle_lesen(fitz, seite, bereich, innen, self.w)
            groessen = [z.groesse for z in innen]
            klein = groessen and sorted(groessen)[len(groessen) // 2] < 9.5
            if tab and klein and art != 'Tabelle':
                tab = None
            if tab and tab.get('zebra'):
                self.protokoll['tabelle-zebra'] += 1
            if tab and tab.get('extract'):
                self.protokoll['tabelle-extract'] += 1

        if art == 'Tabelle' or (tab and not art):
            if tab is None and art == 'Tabelle' and nummer in self.ref['tabellen']:
                # Als Grafik gesetzte Tabelle (Pfeile): Online-Tabelle gleicher Nummer
                b = dict(self.ref['tabellen'][nummer])
                b['titel'] = titel
                b['unten'] = True
                b['quelle'] = 'online'
                self.protokoll['tabelle-online'] += 1
                self.haengend = None
                self.block(b)
                self.offen = None
                return
            if tab is None:
                self.abbildung(seite_nr, seite, bereich, titel, None)
                self.protokoll['tabelle-als-bild'] += 1
                return
            h = self.haengend
            if h and h['spalten'] == tab['spalten'] and bereich.y0 < 80 and h['_seite'] == seite_nr - 1:
                zeilen_neu = tab['zeilen']
                if zeilen_neu and h['zeilen'] and zeilen_neu[0] == h['zeilen'][0]:
                    zeilen_neu = zeilen_neu[1:]
                h['zeilen'].extend(zeilen_neu)
                h['_seite'] = seite_nr
                tab = h
                block = h['_block']
                block['zeilen'] = tabelle_block(tab, None)['zeilen']
            else:
                tab['_seite'] = seite_nr
                block = self.block(tabelle_block(tab, None))
                tab['_block'] = block
                self.protokoll['tabelle'] += 1
            if art == 'Tabelle':
                block['titel'] = titel
                block['unten'] = True
                self.haengend = None
            else:
                self.haengend = tab
            self.offen = None
            return

        self.haengend = None
        self.abbildung(seite_nr, seite, bereich, titel, nummer)

    def abbildung(self, seite_nr, seite, bereich, titel, nummer):
        fitz = self.fitz
        datei = None
        if nummer and nummer in self.ref['abb']:
            online_titel, online_datei = self.ref['abb'][nummer]
            if os.path.exists(os.path.join(WURZEL, online_datei)):
                datei = online_datei
                if re.sub(r'\W', '', online_titel).lower() != re.sub(r'\W', '', titel.split(':', 1)[1]).lower():
                    self.protokoll['abb-titel-abweichend'] += 1
        if not datei and not nummer and self.aktuell and self.ref['abschnitt_abb'].get(self.aktuell.get('nummer')):
            datei = self.ref['abschnitt_abb'][self.aktuell['nummer']].pop(0)
            self.protokoll['abb-abschnitt'] += 1
        if not datei and not nummer and self.aktuell and self.aktuell.get('element') in self.ref['streifen']:
            datei = self.ref['streifen'][self.aktuell['element']]
            self.protokoll['abb-streifen'] += 1
        if not datei:
            os.makedirs(PNG_ORDNER, exist_ok=True)
            name = 'abb-%d.png' % nummer if nummer else 's%03d-%04d.png' % (seite_nr, int(bereich.y0))
            pfad = os.path.join(PNG_ORDNER, name)
            clip = fitz.Rect(bereich.x0 - 4, bereich.y0 - 4, bereich.x1 + 4, bereich.y1 + 4)
            seite.get_pixmap(clip=clip, dpi=200).save(pfad)
            datei = 'assets/rhb/' + name
            self.png.append((seite_nr, name, nummer))
            self.protokoll['abb-png'] += 1
        else:
            self.protokoll['abb-svg'] += 1
        b = {'t': 'abb', 'datei': datei, 'text': titel or ''}
        self.block(b)
        self.offen = None

    # -- Seite -----------------------------------------------------------------

    def seite_verarbeiten(self, seite_nr):
        fitz = self.fitz
        self.seite_nr = seite_nr
        seite = self.doc[seite_nr - 1]
        zeilen = zeilen_lesen(fitz, seite)
        bereiche = [] if seite_nr == 1 else bereiche_lesen(fitz, seite, zeilen)

        # Beschriftungen unterhalb der Bereiche (ggf. zweizeilig).
        beschriftungen = {}
        verbraucht = set()
        for b in bereiche:
            kandidaten = sorted([z for z in zeilen if z.bereich is None and z.koerper and z.y0 >= b.y1 - 2 and z.y0 < b.y1 + 45], key=lambda z: z.y0)
            if not kandidaten:
                continue
            z = kandidaten[0]
            m = BESCHRIFTUNG_RE.match(z.text)
            if not m:
                continue
            text = zeilentext(z)
            verbraucht.add(id(z))
            letzte = z
            for f in kandidaten[1:]:
                if f.y0 - letzte.y1 < 8 and f.groesse == z.groesse and not f.fett and not BESCHRIFTUNG_RE.match(f.text):
                    text = self.w.verbinden(text, zeilentext(f))
                    verbraucht.add(id(f))
                    letzte = f
                else:
                    break
            m = BESCHRIFTUNG_RE.match(text)
            beschriftungen[id(b)] = (m.group(1), m.group(2), m.group(3))

        # Ereignisse in Leserichtung: Zeilen ausserhalb der Bereiche und die Bereiche selbst.
        ereignisse = [('z', z.y0, z) for z in zeilen if z.bereich is None and id(z) not in verbraucht]
        ereignisse += [('b', b.y0, b) for b in bereiche]
        ereignisse.sort(key=lambda e: e[1])

        fussnoten = []
        vorher = None   # letzte Fliesstextzeile dieser Seite
        seitenanfang = True
        for art, y, obj in ereignisse:
            if art == 'b':
                bereich_beschr = beschriftungen.get(id(obj))
                self.bereich_verarbeiten(seite_nr, seite, obj, zeilen, bereich_beschr)
                vorher = None
                seitenanfang = False
                continue
            z = obj
            text = zeilentext(z)
            if not text:
                continue
            # Seitenzahl im Fuss
            if z.y0 > 800 and SEITENZAHL_RE.match(text):
                continue
            # Fussnoten am Seitenende (9 pt)
            if z.fussnote:
                m = FUSSNOTE_RE.match(text)
                if m and z.x0 < 82:
                    fussnoten.append(m.group(1).translate(HOCH) + ' ' + m.group(2))
                elif fussnoten:
                    fussnoten[-1] = self.w.verbinden(fussnoten[-1], text)
                elif self.letzte_fussnote is not None:
                    self.letzte_fussnote['text'] = self.w.verbinden(self.letzte_fussnote['text'], text)
                continue
            gap = (z.y0 - vorher.y0) if vorher is not None else None   # Zeilenabstand: 15 im Absatz, ab 19 neuer Absatz
            if seite_nr == 1:
                # Titelseite: jede Zeile ein Absatz
                self.absatz(text, None, seite_nr)
                vorher = z
                continue
            # Überschriften
            if z.fett and z.groesse >= 12:
                ebene = 1 if z.groesse >= 18 else (2 if z.groesse >= 13.5 else 3)
                m = NUMMER_RE.match(text)
                # Umbruch einer Überschrift (gleiche Grösse, kleine Lücke, ohne Nummer)
                if self.aktuell and self.offen is None and self.aktuell.get('_ebene') == ebene and gap is not None and gap < z.groesse * 1.5 and not m and vorher is not None and vorher.fett:
                    self.aktuell['titel'] = self.w.verbinden(self.aktuell['titel'], text)
                    vorher = z
                    continue
                if m:
                    nummer = m.group(1) + m.group(2)
                    titel = m.group(3).strip()
                else:
                    nummer, titel = None, text
                a = self.abschnitt_neu(nummer, titel, ebene, seite_nr)
                a['_ebene'] = ebene
                self.haengend = None
                vorher = z
                seitenanfang = False
                continue
            if z.fett and z.groesse >= 10 and z.koerper:
                m = NUMMER_RE.match(text)
                if m and re.match(r'^(\d+|[A-Z])(\.\d+)+$', m.group(1) + m.group(2)):
                    a = self.abschnitt_neu(m.group(1) + m.group(2), m.group(3).strip(), 4, seite_nr)
                    a['_ebene'] = 4
                    self.haengend = None
                    vorher = z
                    seitenanfang = False
                    continue
                # Zwischentitel ohne Nummer («Beschreibung», «Inhalt»)
                b = {'t': 'h', 'text': text}
                if z.kursiv:
                    b['art'] = 'kursiv'
                self.block(b)
                self.offen = None
                vorher = z
                seitenanfang = False
                continue
            if z.fett and z.kursiv and z.groesse >= 10:
                self.block({'t': 'h', 'text': text, 'art': 'kursiv'})
                self.offen = None
                vorher = z
                continue
            # Listen
            if z.aufzaehlung:
                ebene = 1 if z.x0 < 100 else (2 if z.x0 < 122 else 3)
                self.listenpunkt('ul', ebene, re.sub(r'^•\s*', '', text), seite_nr)
                vorher = z
                seitenanfang = False
                continue
            if z.nummeriert:
                m = OL_RE.match(text)
                self.listenpunkt('ol', 1, m.group(2), seite_nr)
                vorher = z
                seitenanfang = False
                continue
            if z.koerper:
                if z.kursiv:
                    self.absatz(text, gap, seite_nr, 'kursiv')
                elif seitenanfang and self.offen and self.offen.get('t') == 'p' and not self.offen.get('art') \
                        and self.offen.get('_x1', 0) >= ZEILE_VOLL and self.offen.get('_seite') == seite_nr - 1:
                    self.fortsetzung(text, seite_nr)
                    self.offen['_x1'] = z.x1
                else:
                    self.absatz(text, gap, seite_nr, None, z.x1)
                vorher = z
                seitenanfang = False
                continue
            # Eingerückte Zeilen: Umbruch eines Listenpunkts oder kursive Zwischenzeile
            if z.kursiv:
                self.absatz(text, None, seite_nr, 'kursiv')
                vorher = z
                continue
            if self.fortsetzung(text, seite_nr):
                vorher = z
                seitenanfang = False
                continue
            self.unbekannt.append(('zeile', seite_nr, round(z.x0), z.groesse, text[:60]))
            self.absatz(text, gap, seite_nr)
            vorher = z
        offen = self.offen
        for f in fussnoten:
            self.letzte_fussnote = self.block({'t': 'p', 'text': f, 'art': 'fussnote'})
        self.offen = offen   # eine Liste läuft auf der nächsten Seite weiter

    def aufraeumen(self):
        for kap in self.kapitel.values():
            for a in kap['abschnitte']:
                a.pop('_ebene', None)
                for b in a['bloecke']:
                    if b.get('_start'):
                        b['seite'] = b['_start']
                    for k in list(b.keys()):
                        if k.startswith('_'):
                            del b[k]


# --- Hauptprogramm ----------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--pdf', required=True, help='HERMES-Projektmanagement.pdf')
    ap.add_argument('--lib', help='Pfad mit PyMuPDF (falls nicht installiert)')
    args = ap.parse_args()
    fitz = fitz_laden(args.lib)

    ref = online_laden()
    doc = fitz.open(args.pdf)
    bau = Bau(fitz, doc, ref)
    for seite_nr in range(1, min(LETZTE_TEXTSEITE, doc.page_count) + 1):
        bau.seite_verarbeiten(seite_nr)
    bau.aufraeumen()

    # Abgleich mit dem Inhaltsverzeichnis des Online-Imports
    toc_datei = os.path.join(DATEN, 'inhaltsverzeichnis.json')
    if os.path.exists(toc_datei):
        toc = {e['nummer']: e for e in json.load(open(toc_datei, encoding='utf-8'))}
        gefunden = {}
        for kap in bau.kapitel.values():
            for a in kap['abschnitte']:
                if a.get('nummer'):
                    gefunden[a['nummer']] = a
        fehlt = [n for n in toc if n not in gefunden]
        zuviel = [n for n in gefunden if n not in toc]
        seiten_falsch = [(n, toc[n]['seite'], gefunden[n]['seite']) for n in toc if n in gefunden and toc[n]['seite'] != gefunden[n]['seite']]
        titel_falsch = [(n, toc[n]['titel'], gefunden[n]['titel']) for n in toc if n in gefunden and re.sub(r'\W', '', toc[n]['titel']).lower() != re.sub(r'\W', '', gefunden[n]['titel']).lower()]
        print('Inhaltsverzeichnis: %d Einträge, %d gefunden, fehlen %s, zusätzlich %s' % (len(toc), len(gefunden), fehlt, zuviel))
        if seiten_falsch:
            print('  Seiten abweichend:', seiten_falsch[:20])
        if titel_falsch:
            print('  Titel abweichend:', titel_falsch[:20])
    elemente = set(e['id'] for e in ref['element'].values())
    zugeordnet = set(a['element'] for kap in bau.kapitel.values() for a in kap['abschnitte'] if a.get('element'))
    print('Elemente: %d bekannt, %d im PDF zugeordnet, fehlen %s' % (len(elemente), len(zugeordnet), sorted(elemente - zugeordnet)))
    print('Protokoll:', dict(bau.protokoll))
    print('PNG:', bau.png)
    if bau.unbekannt:
        print('Unklare Zeilen (%d):' % len(bau.unbekannt))
        for u in bau.unbekannt[:40]:
            print('  ', u)

    os.makedirs(AUSGABE, exist_ok=True)
    index = {
        'quelle': {
            'titel': 'HERMES Referenzhandbuch Projektmanagement',
            'ausgabe': 'Ausgabe 2022, 3. Auflage vom 9. März 2026',
            'seiten': doc.page_count,
            'pdf': PDF_URL,
            'online': 'https://www.hermes.admin.ch/de/projektmanagement.html',
            'downloads': 'https://www.hermes.admin.ch/de/downloads.html'
        },
        'kapitel': []
    }
    for kap in bau.kapitel.values():
        inhalt = [{k: a[k] for k in ('nummer', 'titel', 'ebene', 'seite') if k in a} for a in kap['abschnitte'] if a.get('ebene', 9) <= 3 and not a.get('element')]
        index['kapitel'].append({
            'id': kap['id'], 'nummer': kap['nummer'], 'titel': kap['titel'], 'kategorie': kap['kategorie'],
            'seite': kap['seite'], 'url': kap['url'], 'datei': 'data/handbuch/rhb/%s.json' % kap['id'],
            'abschnitte': len(kap['abschnitte']), 'inhalt': inhalt
        })
        with open(os.path.join(AUSGABE, kap['id'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(kap, f, ensure_ascii=False, indent=0)
        print('  %-20s %4d Abschnitte, %5d Blöcke' % (kap['id'], len(kap['abschnitte']), sum(len(a['bloecke']) for a in kap['abschnitte'])))
    with open(os.path.join(AUSGABE, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
