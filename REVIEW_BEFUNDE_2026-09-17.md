# Review-Befunde 17.09.2026

## Wer wirklich gelesen hat

| Reviewer | Stand | Anmerkung |
|---|---|---|
| codex | nichts geliefert | exit 1, leere Ausgabe: Kontingent erschoepft - heute nicht mehr gefragt |
| gemini | abgebrochen | nach 20 min ohne Antwort beendet (}) |
| coderabbit | gelesen | 4 Befunde |

Zweck: tief (angegeben (--zweck); alle drei, inklusive Repo-Scan ueber Dateigrenzen). Gelesen: coderabbit · Basis 01ae24c. Rohausgaben: /Users/alexanderbrunker/Coding/company/tools/review_agent/laeufe/2026-09-17/3d_sound_app. Jeder Befund unten ist am Code verifiziert; Unverifiziertes steht hier nicht.

Anlass: Release 2.2.0, gebaut aus sechs Punkten vom echten iPhone. Der
Umbau geht quer durch Audio-Engine, Zeitachse, Timer und die Handy-Oberflaeche,
also Fall 2 der Review-Regel. Zum dritten Mal in Folge hat nur ein fremder
Leser gelesen; siehe unten.

## Offen

| # | Befund | Quelle | Schwere |
|---|---|---|---|
| (keiner) | | | |

## Behoben

Alle vier vor der Aenderung am Code nachgeprueft. Einer davon war eine
falsche Behauptung von mir in Commit-Text und Changelog.

### B1 · Hoch · Keep-Alive wurde auf dem Link-Pfad nie angehaengt

**Bestaetigt.** `keepAlive.attach(ctx)` stand nur in `startApp`. Ein geteilter
Link (`#scene=`) initialisiert die Engine an `startApp` vorbei, und
`addSound`, `loadJourney` und Co. rufen `init()` ebenfalls selbst. Auf diesen
Pfaden blieb `keepAlive.ctx` leer, die Erholung nach einer Unterbrechung
(Anruf, Siri) konnte den Kontext nicht wieder anstossen.

**Behoben.** Die Engine haengt das Keep-Alive in `init()` selbst an; jeder
Weg fuehrt dort durch. Der Aufruf in `startApp` ist raus. Test dagegen.

### B2 · Hoch · Sperrbildschirm-Pause liess den Ton weiterlaufen

**Bestaetigt, und beim Nachdenken schwerer als gemeldet.** Der Reviewer wollte
`this.play()` und `this.pause()` in den MediaSession-Handlern. Der eigentliche
Fehler lag eine Ebene hoeher: die Pause der Zeitachse haelt nur die Uhr an und
laesst die Klaenge weiterlaufen. Am Schreibtisch ist das gewollt, vom
Sperrbildschirm aus heisst Pause Stille.

**Behoben.** Die Sperrbildschirm-Pause pausiert den Transport **und** haelt
jede Quelle an; sobald nichts mehr spielt, gibt `sync()` die Session frei.
Play startet die Stille-Schleife zuerst, innerhalb der Aktivierung, und dann
den Transport, der die Quellen in ihrem Fenster wieder anwirft. Test dagegen.

Nicht geaendert: die Pause-Taste am Schreibtisch. Ob sie Klaenge halten oder
stoppen soll, ist eine Produktentscheidung, keine Korrektur.

### B3 · Hoch · `onNodeActivated` stand zweimal im Objekt

**Bestaetigt, mein Fehler.** Ich hatte einen zweiten `onNodeActivated` fuer
das Oeffnen der Sheet eingetragen, ohne zu sehen, dass weiter unten bereits
einer steht, der den Klang per Doppelklick an- und ausschaltet. Der spaetere
Schluessel gewinnt, meiner lief nie. Commit-Text und Changelog behaupteten
trotzdem "Doppeltipp oeffnet".

**Behoben.** Der Doppelklick behaelt seine bisherige Bedeutung, der Eintrag
ist raus, Changelog und Kommentar sagen jetzt, was gilt: der Inspector-Tab
oeffnet die Sheet.

### B4 · Hoch · Eine Geste, die nichts startete, hielt die Session fuer immer

**Bestaetigt.** `resume()` startete die Stille-Schleife in jeder Geste, und
`_syncKeepAlive` lief nur bei Aenderungen an den Quellen. "Leer starten" oder
ein fehlgeschlagenes Laden startete keine Quelle, also lief die Schleife
weiter: Session belegt, Sperrbildschirm-Steuerung ohne Ton dahinter.

**Behoben.** Drei Sekunden nach jeder Geste gleicht die Engine ab, ob wirklich
etwas spielt, und gibt sonst frei. Eine Quelle, die spaeter kommt, holt die
Schleife ueber ihren eigenen Abgleich zurueck. Test dagegen.

## Verworfen nach Verifikation

(keiner)

## Anmerkung zum Lauf

Codex war zum dritten Mal am Tageskontingent; die 248 KB in `codex.err` sind
sein Startprotokoll, kein Review. Gemini lief zwanzig Minuten in 503 und wurde
abgebrochen. Damit hat dieser Umbau, wie die beiden davor, **einen** fremden
Leser bekommen, und nie den, der repoweit "wer ruft das noch auf" beantwortet.
Befund B3 ist genau die Sorte Fehler, die dieser Blick faende.
