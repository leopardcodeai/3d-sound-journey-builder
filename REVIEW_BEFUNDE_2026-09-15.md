# Review-Befunde, 15.09.2026

Lauf: `lcr --zweck tief --base fa25485` gegen den v2-Umbau.

## Wer gelesen hat

| Reviewer | Ergebnis |
|---|---|
| CodeRabbit | 5 Befunde, alle am Code verifiziert, alle behoben |
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

### 4. Rückgängig konnte einen fremden Keyframe überschreiben (gering)

`src/core/UndoManager.js`, `createMoveKeyframeCommand`. Der Befehl sucht den
verschobenen Keyframe an seinen Werten, weil sich sein Index beim Sortieren
ändert. Fand er ihn nicht, griff er auf den gespeicherten Index zurück und
überschrieb, was dort stand.

**Der Fall, der das auslöst:** Keyframe verschieben, denselben Keyframe per
Doppelklick löschen, dann Rückgängig. Der Rückweg findet nichts mehr und
schreibt in einen unbeteiligten Keyframe. Dasselbe passiert, wenn zwischendurch
eine Journey geladen wurde und die Liste ausgetauscht ist.

**Behoben:** findet die Suche nichts, tut der Befehl nichts. Zwei Tests decken
beide Fälle ab.

### 5. Screenshot-Skript dokumentierte einen Modus, den es nicht konnte (gering)

`scripts/shoot.mjs`. Der Kopfkommentar nannte `SHOOT_VIEW=focus`, der Code
kannte nur `3d`.

**Behoben:** `focus` und `landing` sind jetzt implementiert. Beide Aufrufe
liefen durch und haben die Bilder in `docs/` erzeugt.

## Selbst gefunden, nicht vom Review

## Eigene Prüfung: Audio

Ein Subagent hat `AudioEngine`, `Generators`, `SceneManager` und `UndoManager`
gegengelesen und acht Befunde geliefert. Alle acht am Code verifiziert, alle
behoben.

### A1. Rückgängig nach dem Löschen setzte Generatoren auf die Standardwerte zurück

`createDeleteCommand` rief `addSource` mit sieben Argumenten auf, ohne
`gen`, `params` und `inserts`. Der Inspektor sammelt diese Werte vorher
ausdrücklich ein, der Befehl hat sie dann weggeworfen.

**Der Fall:** einen reinen Ton auf 528 Hz stellen, löschen, Rückgängig. Der
Klang kommt mit 432 Hz zurück, dem Bibliothekswert. Dasselbe traf jeden Pad,
jeden Beat und jeden geänderten Filter.

**Behoben:** der Befehl reicht Generator, Parameter, Inserts und zusätzlich
die Ein- und Ausblendzeiten weiter. Zwei Tests. Löschen per Tastatur läuft
jetzt ebenfalls über den Inspektor, damit es überhaupt auf dem Stapel landet.

### A2. Zwei Hüllkurven kämpften um denselben Lautstärkeparameter

`setSourceRamp` löschte die vorherige Automatisierung nur im Einzelfall, nicht
im Wiederholungszyklus. Der Inspektor ruft die Methode bei jedem Reglerereignis
auf, also viele Male pro Zug.

**Der Fall:** Wiederholung auf 10 s, Einblenden 2 s, dann mitten im Zyklus am
Einblendregler ziehen. Die alten Termine stehen weiter an, die Lautstärke
springt zu Zeitpunkten, die zu keiner aktuellen Einstellung gehören.

**Behoben:** `cancelScheduledValues` vor jedem neuen Zeitplan und zu Beginn
jedes Zyklus. Test vorhanden.

### A3. Szenen verloren Ein- und Ausblenden und die Wiederholung

Diese drei Werte liegen direkt auf der Quelle, nicht in `inserts`, und wurden
beim Speichern gar nicht erfasst. Eine gespeicherte oder geteilte Szene spielte
sofort auf voller Lautstärke.

**Behoben:** eigener `ramp`-Eintrag, nur wenn etwas gesetzt ist. Zwei Tests.

### A4. Szenen stellten die Haltung wieder her, aber nicht ihre Filter

`loadScene` rief `updateListenerPose`, was nur die Ausrichtung setzt.
Schulter- und Ohrmuschelstärke blieben auf dem, was vorher galt, und waren im
Format gar nicht gespeichert.

**Der Fall:** eine in Seitenlage gespeicherte Szene laden, während die App
steht. Jede Quelle bekommt die Filterung des Stehens, hörbar falsch.

**Behoben:** beide Stärken werden gespeichert und zurückgesetzt. Ältere Szenen
ohne die Felder fallen auf das Haltungs-Preset zurück. Zwei Tests.

### A5. Der Akkordregler des Pads tat nichts

`GENERATORS.pad.controls` führt `chord`, der Inspektor zeigt das Auswahlfeld,
aber `buildPad.setParam` hatte keinen Zweig dafür. Die Stimmen behielten den
Akkord aus dem Moment ihres Baus.

**Behoben:** die vorhandenen Stimmen werden umgestimmt, statt den Graphen neu
zu bauen, damit das Pad durch die Änderung hindurch klingt. Test vorhanden.

### A6. Rückgängig konnte den falschen von zwei gleichen Keyframes treffen

Die Suche verglich nur Zeit und Lautstärke. Beim Speichern wird die Zeit auf
eine Nachkommastelle und die Lautstärke auf drei gerundet, zwei ursprünglich
verschiedene Keyframes können danach in beiden Feldern übereinstimmen.

**Behoben:** zuerst über Zeit, Lautstärke und Position; nur wenn das eindeutig
ist, wird geschrieben, sonst über Zeit und Lautstärke, und auch nur bei
Eindeutigkeit.

### A7. Kein Schutz gegen nicht-endliche Parameter

`clampParam` reicht `NaN` unverändert durch, weil `Math.min`/`Math.max` das
tun. Eine `NaN`-Beatrate erreicht `createBuffer` als `NaN`-Länge und wirft.
Der alte Puls ist zu dem Zeitpunkt schon gestoppt, der Ton bleibt also
dauerhaft stumm. Über die Oberfläche derzeit nicht erreichbar, der Schutz
fehlte aber ganz.

**Behoben:** `clampParam` fällt auf den Standardwert zurück, und die drei
Pufferbauer prüfen ihre Eingaben selbst. Test vorhanden.

### A8. Teilen schrieb eine Szene namens "_temp" in die Liste

`exportToURL` rief `saveScene('_temp')`, und `saveScene` speichert immer.
Jeder geteilte Link hinterließ einen Eintrag in der Szenenliste.

**Behoben:** Bauen und Speichern sind getrennt. Beim Lesen aus dem Speicher
wird ein altes `_temp` verworfen, damit bestehende Installationen es loswerden.

## Selbst gefunden, nicht vom Review

**Geteilte Links luden ihre Aufnahmen nicht.** `loadScene` baute die Quellen,
ohne vorher die Samples zu dekodieren. Bei einem geteilten Link, der auf einem
fremden Gerät zum ersten Mal geöffnet wird, ist der Puffer leer: die App meldete
"Audio buffer not preloaded" und ließ jede Aufnahme weg. Übrig blieben nur die
Generatoren. `loadScene` ist jetzt asynchron und dekodiert vorher, was fehlt;
`importFromURL` registriert nur noch und lädt nicht mehr selbst, damit nichts
doppelt läuft. Im Browser geprüft: fünf Quellen, fünf Keyframe-Listen, vier
Abschnitte, drei Sample-Puffer, keine Fehlermeldung.

**Rauschfarbe zeigte NaN.** In der Fokus-Ansicht wurde der erste
Generator-Parameter einer Ebene immer als Zahlenregler gebaut. Bei der
Rauschfarbe, die feste Werte hat, ergab das einen Regler mit dem Wert "pink"
und der Anzeige NaN. Solche Parameter bekommen jetzt ein Auswahlfeld.

**Chrome warnte über instabile Filter.** Der Tiefpass jeder Sample-Quelle stand
offen bei 20 kHz, bei 44,1 kHz Abtastrate also auf 91 Prozent der
Nyquist-Frequenz. Dort werden die Biquad-Koeffizienten schlecht konditioniert,
und Chrome meldet "state is bad". Die offene Stellung liegt jetzt bei 40
Prozent der Abtastrate, rund 17,6 kHz: über der Hörgrenze und über dem, was
eine 128-kbit-MP3 überhaupt enthält. Nach der Änderung null Warnungen, auch
beim Klangbad mit zehn Quellen.

## Eigene Prüfung: Oberfläche

Ergebnis wird hier nachgetragen.

Zusätzlich im Browser geprüft und in Ordnung:

- Kein Cross-Site-Scripting über Klangnamen. Ein Name mit `<img onerror=...>`
  erscheint als Text, kein Element wird erzeugt, kein Skript läuft.
- Rundlauf einer geteilten Szene: fünf Quellen, fünf Keyframe-Listen, vier
  Abschnitte kommen zurück. Der Link ist von 6857 auf 5293 Zeichen geschrumpft.
- Rückgängig für Verschieben und Keyframes, Stumm und Solo, Sprachwechsel.
- Keyframe mit echten Zeigerereignissen gezogen: Zeit und Lautstärke ändern
  sich, Raster greift, Rückgängig stellt beides her.
- Knoten mit echten Zeigerereignissen gezogen, in 2D und in 3D: der Knoten
  landet exakt unter dem Zeiger, Abweichung null Pixel.
- Tastenkürzel: Pfeiltasten, K für Keyframe, Leertaste, 2 und 3, Escape. In
  einem Eingabefeld greift keines davon.

## Regel für das nächste Mal

Das Kontingent vorher prüfen, nicht hinterher feststellen. Ein Mini-Aufruf an
Codex kostet nichts und sagt, ob der teure Lauf überhaupt durchgeht.


## Weiterer Lauf 06:39 (Zweck tief)

| Reviewer | Stand | Anmerkung |
|---|---|---|
| gemini | nichts geliefert | exit 1, leere Ausgabe: Kontingent erschoepft (429) - heute nicht mehr gefragt |
| coderabbit | gelesen | 5 Befunde |
| codex | uebersprungen | Kontingent: Kontingent erschoepft (429) (bis 2026-09-15) |

Rohausgaben: /Users/alexanderbrunker/Coding/company/tools/review_agent/laeufe/2026-09-15/3d_sound_app
