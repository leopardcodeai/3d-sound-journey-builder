# Arbeits-Prompt für Claude

Den folgenden Block in Claude im Repository `/Users/alexanderbrunker/Coding/3d_sound_app` verwenden:

```text
Verbessere den Sound Journey Builder anhand von WEBAPP_FEEDBACK_2026-09-15.md in diesem Repository. Ziel ist eine zuverlässigere, zugängliche Bedienung auf Desktop und Mobile. Behalte die bestehende ruhige Gestaltung, Architektur und Audiofunktionen bei.

Lies zuerst AGENTS.md, README, docs/superpowers/specs/2026-09-15-v2-rework-design.md und den Feedbackbericht. Prüfe den aktuellen Git-Zustand und bewahre vorhandene Nutzeränderungen. Der Bericht basiert auf einem Live-Browsertest vom 15.09.2026 und einer begrenzten lokalen Codeinspektion; Deployment und Checkout können voneinander abweichen. Verifiziere daher jeden Befund im aktuellen Code und Browser, bevor du ihn änderst.

Arbeite in dieser Reihenfolge:
1. F01: Echte tastaturbedienbare Add-/Preview-Aktionen in der Library, eindeutige Namen mit Soundbezug, sichtbarer Fokus. Kein doppeltes Hinzufügen durch Event-Bubbling.
2. F02: Dauerhafte lokalisierte Accessible Names für Field-/Focus-Tabs auch unter 900 px.
3. F03: Gut erreichbare Master-Lautstärke auf Mobile, sowohl in Field als auch Focus.
4. F04: Namen der Focus-Regler, Remove-/Solo-/Mute-Buttons und Play-/Pause-Zustände korrigieren; Einheiten zugänglich machen.
5. F08: Prüfe die Beziehung zwischen Journey-Zeit und Focus-Zeit sowie die Layer-Zählung. Definiere ein verständliches Verhalten und behebe bestätigte Inkonsistenzen. Falls getrennte Timer Absicht sind, erkläre das im UI; ändere nicht blind die Audio-/Transportlogik.
6. F05–F07: Verbessere Lesbarkeit, sichtbaren Zugriff auf Sets/Journeys und Save/Share sowie die mobile Panel-/Timeline-Navigation. Keine neue Designbibliothek und kein umfassender Rewrite. Wähle kleine, begründete Änderungen mit klaren Abnahmekriterien.

Repository-Regeln:
- Code, Kommentare, Dateinamen, CSS-Klassen und i18n-Keys auf Englisch; deutsche UI-Texte über src/i18n.js. Beide vorhandenen Sprachen pflegen.
- Keine Emojis in der Oberfläche; Icons aus src/ui/Icons.js verwenden.
- Sounddaten ausschließlich über src/data/SoundLibrary.js pflegen.
- Evidenzgrade und Wirksamkeitsaussagen nicht ohne passende Quellen verändern.
- Für neues/geändertes Verhalten passende *.test.js-Regressionstests schreiben.
- Keine nicht beauftragte Veröffentlichung, kein Deployment und kein automatischer Commit.

Validierung:
- Die Scripts npm test und npm run build sind in package.json vorhanden. Führe beide nach den Änderungen aus und berichte die tatsächlichen Ergebnisse. Im ursprünglichen Feedbackauftrag wurden sie nicht ausgeführt, da nur Dokumentation erstellt wurde.
- Prüfe die UI bei 1280×720, 900 px Breite und 390×844. Nutze einen realen Browser, nicht nur Unit-Tests.
- Teste Sound hinzufügen/Preview mit Maus und Tastatur, Field/Focus-Wechsel, mobile Lautstärke, Panelnavigation und eindeutige Accessible Names.
- Prüfe bei Änderungen am Transport auch Start, Pause, Fortsetzen, Stop und Session-Ende. Achte auf unbeabsichtigt laufendes Audio nach dem Test.
- Miss Textkontraste bei den angepassten Farben; keine ungemessenen Accessibility- oder Performancebehauptungen.
- Prüfe Deutsch und Englisch sowie Browser-Warnungen/-Fehler.
- Vor einem später ausdrücklich beauftragten Release gilt zusätzlich der externe Review über ~/Coding/company/tools/review_agent/bin/lcr und REVIEW_BEFUNDE_<date>.md gemäß AGENTS.md. Dieser Prompt beauftragt keinen Release. Dieser Review-Aufruf wurde im Feedbackauftrag nicht ausgeführt.

Arbeite die umsetzbaren Punkte vollständig ab. Dokumentiere am Ende pro Feedback-ID: reproduziert oder nicht, vorgenommene Änderung, relevante Dateien und Validierung. Kennzeichne verbleibende Unsicherheit ausdrücklich. Erstelle eine kurze Ergebnisdatei IMPLEMENTATION_REVIEW.md mit offenen Punkten und manuellen Resttests.
```
