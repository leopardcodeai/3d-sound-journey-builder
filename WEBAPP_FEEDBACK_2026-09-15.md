# Webapp-Feedback: Sound Journey Builder

Datum: 15.09.2026  
Geprüft: https://3dsoundapp.vercel.app/app  
Arbeits-Prompt: [CLAUDE_IMPLEMENTATION_PROMPT.md](CLAUDE_IMPLEMENTATION_PROMPT.md)

## Kurzfazit

Die App hat eine eigenständige, ruhige Gestaltung. Klangfläche, Bibliothek und Timeline bilden ein nachvollziehbares Studio-Konzept. Der größte Verbesserungsbedarf liegt bei Zugänglichkeit und Orientierung: Kernfunktionen verstecken sich in Settings, viele Texte sind sehr dunkel, und einige Interaktionen funktionieren nur mit der Maus oder verlieren auf kleinen Bildschirmen ihre Beschriftung.

Empfehlung: Zuerst Bedienbarkeit reparieren, anschließend Einstieg und mobile Navigation vereinfachen. Die visuelle Identität beibehalten.

## Umfang und Grenzen

- Live im Codex-Browser geprüft, einschließlich Desktop bei 1280 × 720 und mobilem Viewport bei 390 × 844.
- Ausgeführt: Start a journey, Stop, Field/Focus-Wechsel, Settings öffnen/schließen, Birdsong hinzufügen, mobile Inspector-/Field-Navigation und Enter auf einer fokussierten Soundkarte.
- Screenshots und Accessibility-/DOM-Struktur ausgewertet; ausgewählte lokale Quelldateien zur Einordnung gelesen. Lokaler Code und Deployment wurden nicht auf Commit-Gleichheit geprüft.
- In den abgefragten Browserlogs dieser Sitzung standen keine Warnungen oder Fehler. Das ist keine vollständige Fehlerfreiheitserklärung.
- Keine akustische Qualitätsprüfung: Räumlichkeit, Lautheit, Klicks, Audioqualität und Kopfhörereindruck sind nicht bewertet.
- Kein echter Smartphone-/Safari-Test, kein vollständiger Tastatur-/Screenreader-Audit, keine gemessenen Kontrastverhältnisse oder Performancewerte.
- Speichern, Teilen, Upload, Headtracking und vollständiger Session-Endablauf wurden nicht getestet. Keine Veröffentlichung und keine Codeänderung vorgenommen.

## Was gut funktioniert

- Der Einstieg bietet drei verständlich getrennte Startmöglichkeiten und einen Kopfhörerhinweis.
- Eine Journey lädt und zeigt ihre Spuren; Stop setzt die sichtbare Zeit auf 00:00 zurück.
- Birdsong lässt sich per Klick hinzufügen; danach erscheinen Eigenschaften und eine zusätzliche Timeline-Spur.
- Der Wechsel zu Focus übernimmt die vorhandenen Klangquellen sichtbar in die Layer-Liste.
- Die Aufteilung des Inspectors in Sound, Space, Motion und Time hilft gegen überladene Einzelansichten.
- Einheitliche Linienicons, zurückhaltende Akzentfarbe und der Hinweis zur begrenzten Aussagekraft von Evidenzlabels passen zum Produkt.

## Priorisierte Befunde

P1 = zentrale Bedienbarriere; P2 = deutliche UX-Verbesserung. Beobachtung und Empfehlung sind jeweils getrennt.

### F01 · P1 · Sound hinzufügen ist nicht tastaturbedienbar

**Bestätigt:** Klick auf Birdsong fügt den Sound hinzu. Enter auf der fokussierten Karte Tropical birds änderte den Zustand nicht. Im DOM ist die Karte ein `article`; der sichtbare Plusbereich ist kein zugänglicher Button. Die Preview-Buttons heißen alle nur „Audition“.

**Lokaler Anhaltspunkt:** `src/ui/Library.js:210` rendert ein `article` mit `tabindex="0"`; Zeile 219 rendert den Plusbereich als `span` mit `aria-hidden="true"`. Der untersuchte Eventhandler behandelt Klicks.

**Empfehlung:** Echte, separat bedienbare Add- und Preview-Buttons mit Soundnamen verwenden, ohne verschachtelte Buttons. Fokus sichtbar machen und nach dem Hinzufügen sinnvoll erhalten.

**Abnahme:** Nur mit Tab und Enter/Leertaste einen Sound genau einmal hinzufügen und separat vorhören können. Accessible Names beispielsweise „Add Tropical birds“ und „Preview Tropical birds“. Passende Regressionstests ergänzen.

### F02 · P1 · Mobile Field-/Focus-Tabs verlieren ihre Namen

**Bestätigt:** In schmalen Ansichten erscheinen die oberen beiden Tabs nur noch als Icons; im Accessibility-Baum haben sie keinen Namen mehr. Auf Desktop heißen sie wieder Field und Focus.

**Lokaler Anhaltspunkt:** `app.html:32` und `app.html:35` enthalten keine expliziten Tab-Labels. `src/style.css:708` ff. blendet unter 900 px den Text per `display: none` aus.

**Empfehlung:** Dauerhafte lokalisierte Accessible Names unabhängig von sichtbaren Texten vergeben; ausgewählten Zustand erhalten.

**Abnahme:** Beide Tabs haben bei 390, 900 und 1280 px eindeutige Namen und bleiben mit Tastatur und Screenreader unterscheidbar.

### F03 · P1 · Master-Lautstärke verschwindet auf Mobile

**Bestätigt:** Bei 390 px bleibt der Mute-Button sichtbar, der Master-Regler ist nicht mehr vorhanden. Die untersuchten Settings enthalten Output-/Raum- und Listener-Regler, aber keinen erkennbaren Ersatz für Master.

**Lokaler Anhaltspunkt:** Die mobile Media Query in `src/style.css` setzt `.master` auf `display: none`.

**Empfehlung:** Kompakten mobilen Lautstärkeregler oder klar erreichbares Lautstärke-Popover anbieten. Systemlautstärke ersetzt die Kontrolle über den App-Mix nicht.

**Abnahme:** Im Field- und Focus-Modus bei 390 px App-Lautstärke ohne Ansichtswechsel zu Desktop einstellen; Mute und Unmute weiterhin erreichbar.

### F04 · P2 · Fehlende Namen und uneindeutige Transport-Semantik

**Bestätigt:** Die Layer-Regler in Focus haben im Accessibility-Baum keinen Namen; mehrere Buttons heißen nur „Remove“. Timeline-Spuren bieten wiederholt „S“ und „M“. Während die gestartete Journey lief, meldete der Transport-Button Description „Play“, aber Help „Pause“.

**Empfehlung:** Controls nach Aktion und Sound beschriften, z. B. „Singing bowl volume“ und „Remove Singing bowl“. Play/Pause-Namen mit dem sichtbaren Zustand synchronisieren. Zahlen für Sessionlängen um eine zugängliche Einheit ergänzen.

**Abnahme:** Ohne den visuellen Kontext lassen sich Regler, Entfernen, Solo/Mute und aktueller Transportzustand eindeutig verstehen. Reproduktion des Play/Pause-Widerspruchs vor Änderung nochmals prüfen.

### F05 · P2 · Lesbarkeit ist zu zurückhaltend

**Visuelle Bewertung:** Bibliotheksbeschreibungen, Inspector-Leerzustand, Focus-Beschreibungen, Kartenbeschriftungen und Timeline-Texte sind klein und sehr dunkel. Die ruhige Ästhetik funktioniert, aber sekundäre Information ist anstrengend zu lesen.

**Empfehlung:** Textfarben und Größen systematisch anpassen, besonders informative Sekundärtexte. Kontraste messen, statt pauschal die gesamte Oberfläche heller zu machen. Als Abnahmeziel mindestens 4,5:1 für normalen Text verwenden; dies ist hier kein gemessener Verstoß.

**Abnahme:** Kontrastwerte dokumentieren; Desktop und Mobile bei normalem Zoom visuell prüfen. Ausgewählte, inaktive und fokussierte Zustände bleiben unterscheidbar.

### F06 · P2 · Presets und Projektaktionen sind in Settings versteckt

**Bestätigt:** Sets, Journeys sowie Save und Share befinden sich zwischen technischen Einstellungen in einem langen Drawer. Start a journey öffnet direkt Meditation, ohne vorher eine sichtbare Auswahl zu bieten.

**Empfehlung:** Einen leicht sichtbaren Einstieg zu Sets/Journeys anbieten und den aktiven Namen samt Dauer anzeigen. Save/Share in einer klaren Projektaktionsgruppe zugänglich machen. Output, Listener und Sprache können in Settings bleiben.

**Abnahme:** Ein neuer Nutzer kann Forest clearing oder eine andere Journey über eine klar beschriftete Hauptaktion finden. Beim Wechsel einer bearbeiteten Szene vorhandene Wiederherstellungs-/Undo-Möglichkeiten berücksichtigen.

### F07 · P2 · Timeline und mobile Navigation brauchen mehr Orientierung

**Bestätigt:** Auf 390 px bleiben bei geöffneter Timeline nur sehr kurze Tracknamen wie „Breat…“ und „Singl…“ sichtbar. Kleine Solo-/Mute-Controls und mehrere gleichzeitig sichtbare Bereiche machen die Ansicht dicht. Nach Betätigung von Field blieb die Timeline sichtbar und der Timeline-Eintrag unten hervorgehoben.

**Einordnung:** Das letzte Verhalten kann beabsichtigt sein; als Navigation wirkt es dennoch widersprüchlich. Kein bestätigter Daten- oder Audiofehler.

**Empfehlung:** Festlegen, ob die untere Leiste exklusive Ansichten oder unabhängige Panels schaltet. Aktiven Zustand entsprechend darstellen. Vollständige Tracknamen bei Auswahl zugänglich machen und Timeline-Bedienelemente für Touch vergrößern.

**Abnahme:** Library → Field → Inspector → Timeline ergibt jeweils einen nachvollziehbaren sichtbaren und markierten Zustand. Trackidentität und Transport bleiben bei 390 px erkennbar.

### F08 · P2 · Focus übernimmt Quellen, zeigt aber eine andere Dauer

**Bestätigt:** Nach Start der 15-Minuten-Meditation und Stop zeigte Focus dieselben fünf Quellen, aber einen Timer von 25:00. Die Zusammenfassung meldete „Layers 3“, während darunter fünf Layer einschließlich Breath pacer und Theta binaural standen.

**Einordnung:** Separate Focus-Dauer und die Zählung nur von Textur-Layern können fachlich beabsichtigt sein. Die Oberfläche erklärt diese Unterschiede nicht; ein tatsächlicher Timingfehler wurde nicht nachgewiesen.

**Empfehlung:** Gemeinsame oder getrennte Session-Dauer ausdrücklich definieren. Entweder synchronisieren oder den Moduswechsel verständlich erklären. „Layers 3“ präziser benennen oder alle Layer zählen.

**Abnahme:** Der Wechsel zwischen Field und Focus erzeugt keine unerklärten Zeit-/Zählungsunterschiede. Pause, Fortsetzen und Ende gezielt testen, falls Zustandslogik geändert wird.

## Sinnvolle Reihenfolge

1. F01–F03: Kernbedienung und mobile Zugänglichkeit.
2. F04: Beschriftungen und Transportzustände vervollständigen.
3. F08: Sessionmodell klären und absichern.
4. F05–F07: Lesbarkeit, Funktionszugang und mobile Orientierung verbessern.

Kein kompletter Rewrite erforderlich. Die vorhandene visuelle Sprache und Sound-Registry sind eine geeignete Basis.
