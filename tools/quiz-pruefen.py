#!/usr/bin/env python3
"""Prüft data/quizfragen.json formal und gegen das Referenzhandbuch.

Formal: eindeutige IDs, vier oder fünf Antworten, «richtig» als Liste
gültiger Indizes (eine Zahl gilt als Liste), keine doppelten Antworten,
Pflichtfelder, je Antwort eine Begründung («Stimmt:»/«Stimmt nicht:» passend
zu «richtig», Pflicht ab q-121), Kategorie gültig oder fehlend
(Methodenfragen), Beleg mit Zitat, Kapitel und Seite, Quellen-URL auf
hermes.admin.ch.

Inhaltlich (mit --rhb oder --pdf-text): jedes Belegzitat muss im
Handbuchtext vorkommen (Silbentrennung und Whitespace werden normalisiert).
--rhb liest den Text aus data/handbuch/rhb/ (Listenpunkte und Tabellenzellen
als eigene Sätze), --pdf-text eine Textfassung des PDF.

Aufruf: python3 tools/quiz-pruefen.py [--rhb | --pdf-text rhb.txt]
Exit-Code 1 bei formalen Fehlern.
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

KATEGORIEN = {'phase', 'szenario', 'modul', 'aufgabe', 'ergebnis', 'rolle'}


def normtext(t):
    t = t.replace('­', '')
    t = re.sub(r'-\n\s*', '', t)                 # Silbentrennung am Zeilenende
    t = re.sub(r'\n\s*\d{1,3}/248\s*\n', '\n', t)  # Seitenmarker
    t = re.sub(r'[•·]', ' ', t)                  # Aufzählungszeichen
    t = re.sub(r'\s+', ' ', t)
    t = t.replace('„', '"').replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    t = t.replace('’', "'").replace('‘', "'").replace('–', '-').replace('—', '-')
    return t.lower()


def laengster_treffer(zitat, korpus):
    """Längster Präfix des Zitats (in Wörtern), der im Korpus vorkommt."""
    woerter = zitat.split(' ')
    lo, hi = 0, len(woerter)
    best = 0
    while lo <= hi:
        mid = (lo + hi) // 2
        if mid == 0 or ' '.join(woerter[:mid]) in korpus:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best, len(woerter)


def rhb_text(wurzel):
    """Handbuchtext aus data/handbuch/rhb/ — Absätze, Listenpunkte und
    Tabellenzellen je auf eigener Zeile."""
    idx = json.load(open(os.path.join(wurzel, 'data', 'handbuch', 'rhb', 'index.json'), encoding='utf-8'))
    zeilen = []

    def punkte(items):
        for it in items or []:
            zeilen.append(it.get('text', ''))
            punkte(it.get('items'))

    for k in idx['kapitel']:
        d = json.load(open(os.path.join(wurzel, k['datei']), encoding='utf-8'))
        for a in d['abschnitte']:
            zeilen.append(a.get('titel', ''))
            for b in a.get('bloecke', []):
                if b.get('t') in ('p', 'h'):
                    zeilen.append(b.get('text', ''))
                elif b.get('t') in ('ul', 'ol'):
                    punkte(b.get('items'))
                elif b.get('t') == 'tabelle':
                    for z in b.get('zeilen', []):
                        zeilen.extend(c.get('text', '') for c in z)
    return '\n'.join(zeilen)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf-text')
    ap.add_argument('--rhb', action='store_true', help='Zitate gegen data/handbuch/rhb/ prüfen')
    ap.add_argument('--datei', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'quizfragen.json'))
    args = ap.parse_args()

    fragen = json.load(open(args.datei, encoding='utf-8'))
    fehler = []
    warnungen = []
    ids = Counter(q.get('id') for q in fragen)

    for q in fragen:
        qid = q.get('id', '?')
        if ids[qid] > 1:
            fehler.append(f'{qid}: ID mehrfach')
        if not q.get('frage', '').strip():
            fehler.append(f'{qid}: Frage fehlt')
        a = q.get('antworten') or []
        if len(a) not in (4, 5):
            fehler.append(f'{qid}: {len(a)} Antworten statt 4 oder 5')
        if len(set(x.strip().lower() for x in a)) != len(a):
            fehler.append(f'{qid}: doppelte Antwort')
        r = q.get('richtig')
        rl = r if isinstance(r, list) else [r]
        if not rl or any(not isinstance(x, int) or x < 0 or x >= len(a) for x in rl) or rl != sorted(set(rl)):
            fehler.append(f'{qid}: richtig={r!r} ungültig')
            rl = []
        bg = q.get('begruendungen')
        nummer = int(re.sub(r'\D', '', qid) or 0)
        if bg is None:
            if nummer > 120:
                fehler.append(f'{qid}: Begründungen fehlen')
        elif len(bg) != len(a):
            fehler.append(f'{qid}: {len(bg)} Begründungen für {len(a)} Antworten')
        else:
            for i, t in enumerate(bg):
                stimmt = t.startswith('Stimmt:')
                if not stimmt and not t.startswith('Stimmt nicht:'):
                    fehler.append(f'{qid}: Begründung {i} beginnt nicht mit «Stimmt:»/«Stimmt nicht:»')
                elif stimmt != (i in rl):
                    fehler.append(f'{qid}: Begründung {i} passt nicht zu richtig={rl}')
        if 'situation' in q and not str(q.get('situation', '')).strip():
            fehler.append(f'{qid}: situation leer')
        if not q.get('erklaerung', '').strip():
            fehler.append(f'{qid}: Erklärung fehlt')
        if q.get('kategorie') is not None and q.get('kategorie') not in KATEGORIEN:   # ohne Kategorie: immer im Pool
            fehler.append(f'{qid}: Kategorie {q.get("kategorie")!r} ungültig')
        url = (q.get('quelle') or {}).get('url', '')
        if not url.startswith('https://www.hermes.admin.ch/'):
            fehler.append(f'{qid}: Quelle fehlt oder nicht hermes.admin.ch')
        b = q.get('beleg') or {}
        if not b.get('zitat', '').strip():
            fehler.append(f'{qid}: Beleg-Zitat fehlt')
        if not b.get('kapitel', '').strip():
            fehler.append(f'{qid}: Beleg-Kapitel fehlt')
        if not isinstance(b.get('seite'), int):
            fehler.append(f'{qid}: Beleg-Seite fehlt')
        if 'ß' in json.dumps(q, ensure_ascii=False):
            warnungen.append(f'{qid}: enthält ß (Schweizer Rechtschreibung: ss)')
        if a and len(rl) == 1:
            laengen = [len(x) for x in a]
            if laengen[rl[0]] == max(laengen) and laengen[rl[0]] > 1.6 * sorted(laengen)[-2]:
                warnungen.append(f'{qid}: richtige Antwort deutlich am längsten ({laengen})')

    def liste(r):
        return r if isinstance(r, list) else [r]
    anzahl = Counter(len(liste(q.get('richtig'))) for q in fragen)
    positionen = Counter(x for q in fragen for x in liste(q.get('richtig')))
    print(f'{len(fragen)} Fragen · Anzahl richtiger Antworten: {dict(sorted(anzahl.items()))}'
          f' · Positionen: {dict(sorted(positionen.items()))}')
    print(f"Praxissituationen: {sum(1 for q in fragen if q.get('situation'))}")
    print('Kategorien:', dict(Counter(q.get('kategorie') for q in fragen)))

    if args.rhb or args.pdf_text:
        if args.rhb:
            korpus = normtext(rhb_text(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        else:
            korpus = normtext(open(args.pdf_text, encoding='utf-8').read())
        nicht = []
        for q in fragen:
            z = normtext((q.get('beleg') or {}).get('zitat', ''))
            if not z:
                continue
            if z in korpus:
                continue
            # Zusammengesetzte Zitate satzweise prüfen; Tabellenparaphrasen
            # («tabelle 12 …», «[phase …]») sind als solche gekennzeichnet.
            # Listenpunkte enden im PDF auf «;» oder «.», im rhb-Text ohne Zeichen.
            saetze = [t.strip(' "').rstrip('.;:,') for t in re.split(r'(?<=[.;:!?])\s+|\s*\[[^\]]*\]\s*|\.\.\.|…', z)]
            saetze = [t for t in saetze if len(t.split()) >= 4]
            fehlend = [t for t in saetze if t not in korpus and not re.match(r'^(tabelle|abbildung)\s*\d', t)]
            if not fehlend:
                continue
            nicht.append((q.get('id'), fehlend))
        if nicht:
            print(f'\n{len(nicht)} Belegzitate mit Sätzen, die nicht wörtlich im Handbuch stehen:')
            for qid, fehlend in nicht:
                for t in fehlend:
                    print(f'  {qid}: «{t[:110]}»')
        else:
            print('Alle Belegzitate wörtlich im Handbuch gefunden.')

    for w in warnungen:
        print('WARNUNG', w)
    for f in fehler:
        print('FEHLER', f)
    return 1 if fehler else 0


if __name__ == '__main__':
    sys.exit(main())
