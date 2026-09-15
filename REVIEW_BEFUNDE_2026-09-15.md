# Review-Befunde, 15.09.2026

Lauf: `lcr --zweck tief --base fa25485` gegen den v2-Umbau.

## Wer gelesen hat

| Reviewer | Ergebnis |
|---|---|
| CodeRabbit | 4 Befunde, alle am Code verifiziert, alle behoben |
| Codex | Kontingent erschöpft (429), lief nicht |
| Gemini | Tageskontingent erschöpft (429, Limit 20 Anfragen), lief nicht |
| Interne Prüfung | zwei Claude-Subagenten auf Audio und Oberfläche, Ergebnis unten |

⚠️ Zwei von drei fremden Modellen waren am Limit. Der Umbau hat damit
**einen** fremden Leser bekommen, nicht drei. Vor dem nächsten Deploy auf ein
Kundensystem gehört derselbe Stand noch einmal durch Codex, der als einziger
das Repo liest und "wer ruft das noch auf" beantwortet.

## Befunde

### 1. Leinwand misst sich am Fenster statt am eigenen Kasten (schwer)

`src/ui/CanvasGrid.js`, `resize()`. Die Leinwand liegt unter der Kopfleiste
(`inset: 48px 0 0 0`), ihr Kasten ist also 48 Pixel niedriger als das Fenster.
`resize()` nahm `window.innerHeight`, wodurch der Puffer auf 900 statt 852
Pixel gesetzt und vom Browser gestaucht wurde.

**Verifiziert im Browser:** der projizierte Mittelpunkt lag 24 Pixel unter der
tatsächlichen Mitte des Kastens. Kreise waren um 5,6 Prozent gestaucht, und
jeder Klick traf entsprechend daneben, am Rand am stärksten.

**Behoben:** die Größe kommt jetzt aus `getBoundingClientRect()`, mit dem
Fenster nur noch als Rückfall, solange der Kasten keine Maße hat. Zusätzlich
beobachtet ein `ResizeObserver` die Leinwand, weil sich ihr Kasten auch ohne
Fensteränderung verschiebt. Drei Tests decken das ab, darunter ein
Rundlauf Zeiger → Welt → Zeiger.

### 2. Vorschau-Knopf des vorigen Klangs bleibt hängen (gering)

`src/ui/Library.js`, `audition()`. Beim Anhören eines zweiten Klangs wurde der
Rücksetz-Timer des ersten gelöscht, aber dessen Knopf nicht zurückgesetzt. Er
zeigte danach dauerhaft das Stopp-Symbol.

**Behoben:** die Bibliothek merkt sich den Knopf zum laufenden Timer und setzt
ihn zurück, bevor sie den nächsten startet. Test in `Library.test.js`.

### 3. Landingpage widersprach der App bei braunem Rauschen (gering)

`index.html`. Die Tabelle führte rosa, weißes und braunes Rauschen gemeinsam
unter "Some evidence". In `SoundLibrary.js` war braunes Rauschen zu dem
Zeitpunkt schon auf "weak" herabgestuft, weil keine Studie diese Rauschfarbe
betrachtet. Eine Seite, die ehrliche Beschriftung verspricht, darf sich darin
nicht selbst widersprechen.

**Behoben:** eigene Zeile für braunes Rauschen mit der schwächeren Einstufung.

### 4. Screenshot-Skript dokumentierte einen Modus, den es nicht konnte (gering)

`scripts/shoot.mjs`. Der Kopfkommentar nannte `SHOOT_VIEW=focus`, der Code
kannte nur `3d`.

**Behoben:** `focus` und `landing` sind jetzt implementiert. Beide Aufrufe
liefen durch und haben die Bilder in `docs/` erzeugt.

## Eigene Prüfung

Zwei Subagenten haben Audio (`AudioEngine`, `Generators`, `SceneManager`,
`UndoManager`) und Oberfläche (`Timeline`, `CanvasGrid`, `Inspector`,
`FocusView`, `Camera`, `main`) gegengelesen. Ergebnis siehe unten, nachgetragen
sobald beide fertig sind.

Zusätzlich im Browser geprüft und in Ordnung:

- Kein Cross-Site-Scripting über Klangnamen. Ein Name mit `<img onerror=...>`
  erscheint als Text, kein Element wird erzeugt, kein Skript läuft.
- Rundlauf einer geteilten Szene: fünf Quellen, fünf Keyframe-Listen, vier
  Abschnitte kommen zurück. Der Link ist von 6857 auf 5293 Zeichen geschrumpft.
- Rückgängig für Verschieben und Keyframes, Stumm und Solo, Sprachwechsel.

## Regel für das nächste Mal

Das Kontingent vorher prüfen, nicht hinterher feststellen. Ein Mini-Aufruf an
Codex kostet nichts und sagt, ob der teure Lauf überhaupt durchgeht.
