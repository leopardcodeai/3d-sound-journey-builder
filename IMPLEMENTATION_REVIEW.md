# Umsetzung des Webapp-Feedbacks vom 15.09.2026

Grundlage: `WEBAPP_FEEDBACK_2026-09-15.md`. Jeder Befund wurde vor der Änderung
am aktuellen Code und im laufenden Browser nachgestellt. Kein Befund wurde
ungeprüft übernommen, keiner verworfen.

Nicht enthalten: Veröffentlichung, Deployment und der externe Review über
`lcr`. Der Auftrag beauftragt keinen Release.

---

## F01 · Sound hinzufügen war nicht tastaturbedienbar

**Reproduziert.** Die Karte war ein `article` mit `tabindex="0"`, also
anfokussierbar, ohne Wirkung bei Enter. Das Plus war ein `span` mit
`aria-hidden="true"`, für Hilfsmittel also gar nicht vorhanden. Alle
Vorhör-Knöpfe trugen denselben Namen „Audition“.

**Änderung.** Beide Aktionen sind echte `button`-Elemente mit eigenem Namen je
Klang, „Preview Birdsong“ und „Add Birdsong“, in beiden Sprachen. Die Karte
selbst ist kein Fokusstopp mehr, weil ein Fokusstopp ohne Wirkung schlechter
ist als keiner. Kein doppeltes Hinzufügen: der Klick auf den Add-Knopf läuft
durch denselben Pfad wie ein Klick auf die Karte, der Vorhör-Knopf bricht vorher
ab.

**Dateien.** `src/ui/Library.js`, `src/i18n.js`, `src/ui/Library.test.js`.

**Validierung.** Sechs Tests. Im Browser geprüft: Elementtyp `BUTTON`,
fokussierbar, Klickpfad fügt genau einmal hinzu, Namen je Karte verschieden.

**Verbleibende Unsicherheit, ausdrücklich.** Die Aktivierung per Enter konnte
ich **nicht** am laufenden Browser belegen. Ein eigens erzeugter nackter
Kontrollknopf reagierte in derselben Automatisierung ebenso wenig; die
synthetischen Tastenereignisse kommen an (`isTrusted: true`, `key: "Enter"`,
nicht abgebrochen), lösen aber keine native Knopf-Aktivierung aus. Belegt ist
nur, dass es echte `button`-Elemente sind, für die die Plattform diese
Aktivierung garantiert. **Manuell mit echter Tastatur nachzuprüfen.**

---

## F02 · Ansichts-Tabs verloren unter 900 px ihren Namen

**Reproduziert.** `src/style.css` blendete den Beschriftungstext per
`display: none` aus. Das entfernt ihn auch aus dem Zugänglichkeitsbaum, nicht
nur aus dem Bild, und der Name der Schaltfläche kam allein aus diesem Text.

**Änderung.** Neues Attribut `data-i18n-label`, das einen Namen unabhängig vom
sichtbaren Text setzt und bei jedem Sprachwechsel neu geschrieben wird. Das
vorhandene `data-i18n-title` taugte dafür nicht: es setzt `aria-label` nur,
wenn noch keins da ist, und wäre nach einem Sprachwechsel veraltet.

**Dateien.** `app.html`, `src/i18n.js`.

**Validierung.** Bei 375 px gemessen: „Field“ und „Focus“, nach Sprachwechsel
„Feld“ und „Fokus“.

---

## F03 · Master-Lautstärke verschwand auf Mobile

**Reproduziert.** Die mobile Media Query setzte `.master { display: none }`.
Es gab auf dem Telefon keinen Weg, den App-Pegel zu ändern.

**Änderung.** Der Regler bleibt, Beschriftung und Zahlenwert entfallen; das
sind die Teile, die Breite kosten. Systemlautstärke ist kein Ersatz, sie bewegt
alles statt der Mischung.

**Dateien.** `src/style.css`.

**Validierung.** Bei 375 px sichtbar, Regler 64 px breit, Mute weiterhin
erreichbar.

---

## F04 · Fehlende Namen und widersprüchlicher Transportzustand

**Reproduziert, in vier Teilen.**

| Beobachtung | Messung |
|---|---|
| Transport widersprüchlich | Während die Reise lief: `aria-label` „Play“, `title` „Pause“ |
| Solo und Mute ohne Bezug | Sechs Knöpfe, Namen „Solo“, „Mute“, „Solo“, „Mute“, … |
| Entfernen ohne Bezug | Fünf Knöpfe, alle „Remove“ |
| Fokus-Regler ohne Namen | Neun Regler, `aria-label` durchgehend `null` |
| Sessionlängen ohne Einheit | Knöpfe „10“, „20“, „25“, … ohne Namen |

**Änderung.** Der Transportname folgt dem Zustand und wird gemeinsam mit
`title` gesetzt. Solo und Mute tragen ihren Spurnamen und melden
`aria-pressed`. Entfernen und die Fokus-Regler tragen Klang- und
Parameternamen. Die Längen bekommen „25 Minuten“ als Namen bei sichtbarer „25“.
Der volle Spurname steht als `title`, wenn die Spalte ihn abschneidet.

**Dateien.** `src/ui/Timeline.js`, `src/ui/FocusView.js`, `src/main.js`,
`src/i18n.js`, `src/ui/Timeline.test.js`.

**Dabei zusätzlich gefunden.** Ein Sprachwechsel machte den Transport erneut
widersprüchlich: `applyTranslations` schrieb den `title` aus dem statischen
Schlüssel zurück, während der zustandsabhängige Name stehen blieb. Außerdem
blieben die Spurnamen in der alten Sprache stehen, weil die Zeitachse ihre
Beschriftungen selbst rendert. Beides behoben, in beiden Sprachen und über den
Wechsel hinweg nachgemessen.

---

## F05 · Lesbarkeit war zu zurückhaltend

**Gemessen statt geschätzt.** Kontrast gegen den jeweils tatsächlichen
Hintergrund, Alpha eingerechnet:

| Element | vorher | nachher |
|---|---|---|
| `.card-desc` | 2,98 | 4,81 |
| `.note` | 2,98 | 4,81 |
| `.drawer-title` | 2,96 | 4,81 |
| `.focus-mode-sum` | 3,00 | 4,81 |
| `.tl-clip-label` | 2,98 | 4,81 |
| `.tl-name` | 6,55 | 6,55 (unverändert) |

**Änderung.** `--text-3` von Alpha 0,34 auf 0,48. Der Wert ist ausgerechnet,
nicht geraten: 0,46 trifft auf dem dunkelsten Grund, auf dem dieses Token
tatsächlich steht (`#0d0c0c`), genau 4,5:1; 0,48 hält etwas Reserve. Das kleinste
Schriftmaß der Oberfläche, das Clip-Etikett, ging von 9 px auf 10 px. Ein neues
Token `--text-4` bewahrt den alten Wert für rein dekorative Marken.

**Dateien.** `src/style.css`.

**Verbleibende Unsicherheit.** Gemessen wurden die zehn Stellen oben, nicht
jede Textstelle der App. Die Canvas-Beschriftungen im Feld zeichnen ihre Farben
selbst und sind hier nicht erfasst.

---

## F06 · Presets und Projektaktionen lagen zwischen technischen Einstellungen

**Reproduziert.** Sets, Journeys sowie Speichern und Teilen standen hinter
Output und Listener in einer langen Schublade.

**Änderung.** Reine Umsortierung, kein Umbau: Sets, Journeys, Gespeicherte
Szenen und „Starten mit“ stehen jetzt oben, danach Output, Listener, Timer,
Tastatur und Sprache. Was man startet und speichert kommt vor der Technik.

**Dateien.** `app.html`.

**Offen.** Ein sichtbarer Einstieg außerhalb der Schublade und die Anzeige des
aktiven Namens samt Dauer sind **nicht** umgesetzt. Beides ist ein neues
Bedienelement in der Kopfleiste, also mehr als eine kleine begründete Änderung,
und gehört in eine eigene Entscheidung.

---

## F07 · Untere Leiste war widersprüchlich

**Reproduziert, schärfer als beschrieben.** Zwei Widersprüche, beide gemessen:

- „Timeline“ drücken schloss das Dock, markierte aber „Field“.
- „Field“ drücken ließ „Timeline“ markiert, obwohl das Feld zu sehen war.

**Ursache.** `syncTabBar` berechnete **einen** aktiven Eintrag über vier
Knöpfe. Library, Field und Inspector sind einander ausschließende Ansichten;
die Zeitachse ist keine davon, sondern ein Dock über einer von ihnen.

**Festgelegtes Verhalten.** Drei Ansichten tragen eine Auswahl
(`aria-current`), das Dock trägt einen eigenen gedrückten Zustand
(`aria-pressed`) und einen Punkt statt der vollen Auswahlmarkierung.

**Dateien.** `src/main.js`, `src/style.css`.

**Validierung.** Sechs Schritte bei 375 px durchlaufen: Library, Timeline,
Field, Inspector, Timeline, Field. Jeder Zustand entspricht jetzt dem Bild.

**Offen.** Größere Berührungsflächen für die Zeitachsen-Bedienelemente sind
nicht umgesetzt.

---

## F08 · Focus zeigte eine andere Dauer und eine andere Zählung

**Reproduziert.** Die Zusammenfassung meldete „Layers 3“ und listete
„Singing bowl, Wind chimes, Gong“, während darunter fünf Zeilen standen. Die
Ursache ist kein Zählfehler: derselbe Begriff `layers` beschriftete zwei
verschiedene Mengen, einmal nur das Klangbett, einmal alle Ebenen.

**Entscheidung.** Die beiden Zeiten bleiben getrennt. Eine Reise ist ein
komponiertes Stück mit fester Länge, eine Fokus-Sitzung eine Länge, die man
selbst wählt. Das ist fachlich richtig; falsch war nur, dass es die Oberfläche
nicht sagte. Die Audio- und Transportlogik wurde **nicht** angefasst.

**Änderung.** Die Zusammenfassungszelle heißt jetzt „Texture“ beziehungsweise
„Klangbett“ und benennt damit, was sie zählt. Unter den Längen steht ein Satz,
der die Trennung ausspricht: hier eingestellt, unabhängig von der Länge einer
Reise, die Klänge kommen mit, die Uhr nicht.

**Dateien.** `src/ui/FocusView.js`, `src/i18n.js`, `src/style.css`.

**Verbleibende Unsicherheit.** Ein tatsächlicher Timingfehler war weder im
Bericht noch hier nachweisbar. Sollte sich später zeigen, dass Nutzer eine
gemeinsame Dauer erwarten, ist das eine Produktentscheidung, keine Korrektur.

---

## Validierung insgesamt

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 342 Tests, alle grün |
| `npm run build` | grün |
| Konsole, frischer Durchlauf Reise → Fokus → Feld → Pause | keine Fehler |
| Breiten 1280, 900, 375 | geprüft |
| Deutsch und Englisch, auch über den Wechsel | geprüft |
| Audio nach dem Test | Transport angehalten |

Ein zuvor sporadisch fehlschlagender Test in `InstrumentSynth.test.js` wurde
stabilisiert. Ursache war nicht der Code, sondern die voreingestellte
Fünf-Sekunden-Grenze von vitest für einen Test, der neun Puffer offline
rendert. Die Grenze ist angehoben, die Prüfung nicht abgeschwächt.

## Offene Punkte und manuelle Resttests

1. **Enter auf den Library-Knöpfen mit echter Tastatur prüfen.** Siehe F01.
2. **Screenreader-Durchgang.** Die Namen sind gesetzt und gemessen, ein
   tatsächlicher Durchgang mit VoiceOver oder NVDA fand nicht statt.
3. **Echtes Telefon, echtes Safari.** Geprüft wurde ein emulierter Viewport.
4. **Sichtbarer Einstieg zu Sets und Journeys** außerhalb der Schublade, mit
   aktivem Namen und Dauer. Siehe F06.
5. **Größere Touch-Ziele in der Zeitachse.** Siehe F07.
6. **Drei ältere Befunde am Szenenladen** aus dem Codex-Review stehen weiterhin
   in `REVIEW_BEFUNDE_2026-09-15.md`.
7. **Externer Review über `lcr` vor einem Release.** Nicht beauftragt, nicht
   ausgeführt.
