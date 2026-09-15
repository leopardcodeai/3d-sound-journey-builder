# Review-Befunde, 15.09.2026

Lauf: `lcr --zweck tief --base fa25485` gegen den v2-Umbau.

## Wer gelesen hat

| Reviewer | Ergebnis |
|---|---|
| CodeRabbit | 5 Befunde, alle am Code verifiziert, alle behoben |
| Codex | Kontingent erschöpft (429), lief nicht |
| Gemini | Tageskontingent erschöpft (429, Limit 20 Anfragen), lief nicht |
| Interne Prüfung | zwei Claude-Subagenten: 8 Befunde Audio, 7 Befunde Oberfläche, alle behoben |

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

Ein zweiter Subagent hat `Timeline`, `CanvasGrid`, `Inspector`, `FocusView`,
`Camera` und `main` gegengelesen: sieben Befunde, alle verifiziert, alle
behoben.

### O1. Cross-Site-Scripting über die Quellen-Kennung (schwer)

Alle Anzeigenamen wurden maskiert, die **Kennung** einer Quelle dagegen nicht:
`data-id="${id}"` in der Zeitleiste und an sechs Stellen in der Fokus-Ansicht.
Kennungen kommen aus dem Szenen-JSON, und ein geteilter Link ist von dem
geschrieben, der ihn schickt. `importFromURL` prüfte nur, ob `sources` ein
Array ist.

**Der Angriff:** ein Link mit `sources[0].id = 'x"><img src=x onerror=...>'`.
Beim Öffnen lädt die App die Szene ohne Zutun, die Kennung bricht aus dem
Attribut aus und der Code läuft. Der Eintrag wurde zusätzlich unter "Shared
Scene" gespeichert, wäre also beim nächsten Öffnen aus der eigenen Liste erneut
losgegangen.

**Behoben, an zwei Stellen:**
- Am Rand: `sanitiseScene` verwirft Quellen, deren Kennung, Typ oder Generator
  kein einfacher Bezeichner ist, klemmt jede Zahl in ihren Bereich, kürzt
  Anzeigenamen und wirft Zeitleisten-Einträge weg, die auf verworfene Quellen
  zeigen. Acht Tests.
- In der Tiefe: jede Kennung, jeder Typ und jede Farbe wird beim Bau von
  Markup maskiert, in Zeitleiste, Bibliothek und Fokus-Ansicht.

Im Browser mit dem echten Angriffslink geprüft: die bösartige Quelle fällt
weg, die harmlose daneben wird geladen, nichts wird ausgeführt.

### O2. Rückgängig konnte den Startwert eines anderen Reglers verwenden

`_commitStart` merkte sich nur den Wert, nicht den Regler. Ein Solfeggio-Knopf
ruft `_apply('freq', …, true)` direkt auf und nahm, was gerade gespeichert war.

**Der Fall:** den Raumanteil-Regler anfassen, ohne ihn zu bewegen, dann einen
Solfeggio-Knopf drücken. Der Rückgängig-Schritt lautet "Frequenz zurück auf
0.3", und Rückgängig stellt den Ton auf 0,3 Hz.

**Behoben:** der Startwert trägt den Schlüssel seines Reglers und gilt nur für
diesen. Ein Preset-Knopf merkt sich den vorherigen Wert selbst. Beim Wechsel
der Auswahl wird beides verworfen. Die Lautstärke wird zusätzlich geklemmt.

### O3. Ein Zug in der Zeitleiste konnte hängenbleiben

`_drag` wurde nur von `pointerup` am Fenster gelöscht. Wer die Maustaste
außerhalb des Fensters loslässt, erzeugt dieses Ereignis nie: der Keyframe
folgte dem Zeiger mit losgelassener Taste weiter, und der nächste Klick
irgendwo auf der Seite legte ihn dort ab und schrieb das in den Rückgängig-Stapel.

**Behoben:** Zeigerfang beim Beginn, Prüfung auf `buttons` bei jeder Bewegung,
und `pointercancel` sowie der Fokusverlust des Fensters beenden den Zug. Vier
Tests.

### O4. Der Wechsel auf isochron blieb kopffest

`_convertToIsochronic` baute die Quelle neu, behielt aber den alten Typ. Über
`getSound('bw_alpha').spatial === false` blieb sie kopffest: der Wechsel, der
gerade den Lautsprecherfall lösen soll, änderte nichts Sichtbares.

**Behoben:** der Typ wechselt auf den passenden isochronen Eintrag, und die
Kopffestigkeit richtet sich nach dem laufenden Generator statt nach dem
Bibliothekseintrag. Der Wechsel liegt jetzt auf dem Rückgängig-Stapel.

**Im Browser geprüft:** aus `bw_alpha`, kopffest, wird `iso_alpha` mit Panner,
Beat 10 Hz erhalten, Bewegungs-Reiter wieder benutzbar, Rückgängig stellt den
binauralen Beat samt Kopffestigkeit her.

### O5. Die zweite Sitzung blendete nicht mehr aus

`_fadeStarted` wurde nur beim natürlichen Ende zurückgesetzt. Wer eine Sitzung
mitten im Ausklang pausiert und dann einen anderen Modus wählt, bekam nie
wieder eine Ausblendung.

**Behoben:** das Kennzeichen wird beim Moduswechsel und beim Pausieren
zurückgesetzt, und beim Pausieren wird die laufende Rampe verworfen und der
Pegel wiederhergestellt. Zwei Tests.

### O6. Zwei Journeys konnten sich überlagern

`loadJourney` räumt auf, wartet dann auf das Dekodieren und fügt danach ein.
Zwei schnelle Klicks ließen den zweiten Lauf aufräumen, während der erste noch
wartete: danach mischten sich beide Journeys.

**Behoben:** ein Zähler; nur der jüngste Aufruf darf weitermachen.

### O7. Die Reiterleiste widersprach sich auf dem Telefon

`showTimeline` änderte die Sichtbarkeit der Zeitleiste, ohne die Reiterleiste
zu informieren. Eine Journey aus den Einstellungen öffnete die Zeitleiste,
während der Bibliotheksreiter noch leuchtete und sein Blatt darunter offen
stand.

**Behoben:** eine Funktion leitet den aktiven Reiter aus dem tatsächlichen
Zustand ab und wird von jeder Änderung aufgerufen. Der Zeitleisten-Reiter
leuchtet jetzt auch, solange sein Dock offen ist.

### Ausdrücklich geprüft und in Ordnung

Rückgängig bei Clips und Keyframes endet auf dem neuen Wert. Der Zeigerfang in
der Leinwand wird vom Browser selbst gelöst. Die kopffesten Plätze sind
innerhalb eines Einzelbilds stabil. Umrechnung von Richtung und Winkel im
Inspektor sind exakte Umkehrungen. In der Leinwand wird kein Markup gebaut,
dort ist kein Cross-Site-Scripting möglich.

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


## Weiterer Lauf 09:13 (Zweck tief)

| Reviewer | Stand | Anmerkung |
|---|---|---|
| coderabbit | gelesen | 0 Befunde |
| codex | uebersprungen | Kontingent: Kontingent erschoepft (429) (bis 2026-09-15) |
| gemini | uebersprungen | Kontingent: Kontingent erschoepft (429) (bis 2026-09-15) |

Rohausgaben: /Users/alexanderbrunker/Coding/company/tools/review_agent/laeufe/2026-09-15/3d_sound_app-2


## Weiterer Lauf 09:17 (Zweck tief)

| Reviewer | Stand | Anmerkung |
|---|---|---|
| codex | gelesen | 2534 Bytes Ausgabe |
| coderabbit | gelesen | 0 Befunde |
| gemini | uebersprungen | Kontingent: Kontingent erschoepft (429) (bis 2026-09-15) |

Rohausgaben: /Users/alexanderbrunker/Coding/company/tools/review_agent/laeufe/2026-09-15/3d_sound_app-3

## Verifikation des Codex-Laufs vom 15.09.2026

Sieben Befunde, alle am Code geprueft, keiner verworfen. CodeRabbit meldete im
selben Lauf null.

**Behoben:**

| Befund | Status |
|---|---|
| `Timer.js` `stop()` bricht den Wiederherstellungs-Timer ab, laesst aber die geplante Rampe auf null stehen | bestaetigt und reproduziert: neuer Timer waehrend des Ausblendens liess den Master dauerhaft auf 0,0000, waehrend fuenf Quellen weiterliefen. Behoben, beide Wege nachgemessen. |
| `SceneManager.js` speichert `headTurn` nicht | bestaetigt durch Lesen: `headTilt` wurde gespeichert und wiederhergestellt, `headTurn` nicht. Meine Luecke von heute. Behoben, drei Tests. |
| `UndoManager.js` raeumt `trackState` beim Loeschen nicht | bestaetigt: nur `sourceTimings` und `keyframes` wurden entfernt. Loescht man die einzige Solo-Spur, bleibt `_anySolo()` wahr und alles andere stumm. An **zwei** Stellen behoben, nicht einer: derselbe Block steht im Rueckgaengig-Pfad des Hinzufuegens. |
| `FocusView.js` Sitzung laeuft nach dem Verlassen der Ansicht weiter | bestaetigt: `hide()` stoppte nur die Grafik. Der Abklingvorgang blendete spaeter aus, was das Feld inzwischen geladen hatte. Behoben. |

**Bestaetigt, noch offen.** Drei aeltere Befunde am Szenenladen, jeder braucht
eigene Sorgfalt und einen eigenen Commit:

- `SceneManager._preloadFor` wertet die Rueckgabe von `preloadSound` nicht aus.
  Faellt ein Sample aus, werden die bisherigen Quellen trotzdem entfernt, die
  fehlenden uebersprungen, und `loadScene()` meldet Erfolg.
- Wiederhergestellte Mute- und Solo-Zustaende landen in `trackState`, werden
  aber bis zum naechsten `_applyKeyframes` nicht auf die Gains angewandt. Eine
  stummgeschaltete Spur ist nach dem Laden zunaechst hoerbar.
- Szenenwechsel hat keinen Schutz gegen ueberholte Ladevorgaenge. Journeys und
  Sets teilen sich dafuer `journeyLoad`; Szenen nicht.
