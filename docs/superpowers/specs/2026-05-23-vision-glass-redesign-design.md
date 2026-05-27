# 3D Sound App — Vision Pro Glass Redesign

**Date:** 2026-05-23
**Status:** Approved
**Designer:** OpenCode Agent
**Project:** /Users/alexanderbrunker/Coding/3d_sound_app

---

## 1. Overview

### 1.1 Concept
"Spatial Sound Meditation Chamber" — Eine virtuelle Klangtherapie-Kammer aus dickem, milchigem Glas, die sanft im Dunkeln schwebt. Das Design vereint Apple Vision Pro Glass-Ästhetik mit einem ruhigen, meditativen Klang-Feld.

### 1.2 Design Direction
- **Glass Style:** Apple Vision Pro (dicke, milchige Glass-Panels mit volumetrischem Licht)
- **Mood:** Ruhig, meditativ, atmosphärisch
- **Figure Style:** Realistisch, anatomisch detailliert
- **Canvas Style:** Subtiles Meditation-Feld mit Nebel und diffusen Lichtkreisen
- **Scope:** Ganzheitliches Redesign aller UI-Komponenten und Canvas-Rendering

### 1.3 Success Criteria
- Alle Panels fühlen sich wie dicke Glass-Scheiben an
- Canvas ist ruhig, atmosphärisch, ohne harte geometrische Linien
- Listener-Figur ist anatomisch realistisch und stilvoll
- 2D/3D-Wechsel ist flüssig und immersiv
- Keine generische AI-Ästhetik (keine purple gradients, keine cookie-cutter UI)

---

## 2. Color System

### 2.1 Background
| Token | Value | Usage |
|---|---|---|
| `--bg-void` | `#060608` | Haupt-Hintergrund, tiefes Schwarz mit minimaler Wärme |
| `--bg-fog` | `rgba(20, 20, 40, 0.4)` | Atmosphärischer Nebel-Gradient von unten |
| `--bg-fog-soft` | `rgba(15, 15, 30, 0.25)` | Sekundärer Nebel für Tiefen-Schichtung |

### 2.2 Glass Surfaces
| Token | Value | Usage |
|---|---|---|
| `--glass-base` | `rgba(255, 255, 255, 0.03)` | Basis-Hintergrund aller Panels |
| `--glass-edge-top` | `rgba(255, 255, 255, 0.10)` | Obere/linke Kanten-Highlight |
| `--glass-edge-bottom` | `rgba(0, 0, 0, 0.20)` | Untere/rechte Kanten-Schatten |
| `--glass-inner-glow` | `rgba(0, 102, 204, 0.04)` | Subtiler blauer innerer Glow |
| `--glass-highlight` | `rgba(255, 255, 255, 0.06)` | Diagonale Reflexions-Streifen |

### 2.3 Text & Accents
| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `rgba(255, 255, 255, 0.92)` | Haupttext |
| `--text-secondary` | `rgba(255, 255, 255, 0.55)` | Sekundärer Text, Labels |
| `--text-muted` | `rgba(255, 255, 255, 0.30)` | Hilfstext, deaktiviert |
| `--accent` | `#0066cc` | Interaktive Elemente, Apple Action Blue |
| `--accent-glow` | `rgba(0, 102, 204, 0.25)` | Glow-Effekte um aktive Elemente |
| `--accent-soft` | `rgba(0, 102, 204, 0.12)` | Hintergrund von aktiven States |

### 2.4 Figure Colors
| Posture | Body Fill | Outline | Glow |
|---|---|---|---|
| Standing | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.25)` | `rgba(255, 255, 255, 0.05)` |
| Lying Back | `rgba(100, 160, 240, 0.12)` | `rgba(135, 200, 255, 0.30)` | `rgba(100, 160, 240, 0.08)` |
| Lying Side | `rgba(220, 170, 40, 0.12)` | `rgba(255, 200, 100, 0.30)` | `rgba(220, 170, 40, 0.08)` |

---

## 3. Glass Material System

### 3.1 Core Glass Panel
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(60px) saturate(180%);
-webkit-backdrop-filter: blur(60px) saturate(180%);
border: 1px solid;
border-color: rgba(255, 255, 255, 0.10) rgba(0, 0, 0, 0.20) rgba(0, 0, 0, 0.20) rgba(255, 255, 255, 0.10);
box-shadow:
  inset 0 1px 1px rgba(255, 255, 255, 0.08),
  0 0 60px rgba(0, 102, 204, 0.04),
  0 16px 48px rgba(0, 0, 0, 0.40);
border-radius: 24px;
```

### 3.2 Glass Reflexion (Overlay)
Jedes Panel bekommt einen diagonalen Highlight-Streifen via `::before`:
```css
content: '';
position: absolute;
inset: 0;
border-radius: inherit;
background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%);
pointer-events: none;
z-index: 1;
```

### 3.3 Header Bar (Minimal)
```css
background: rgba(6, 6, 8, 0.40);
backdrop-filter: blur(40px) saturate(160%);
border-bottom: none;
```
Keine harte Trennlinie — nur subtiler Gradient nach unten.

---

## 4. Canvas — Meditation Field

### 4.1 Background
- Füllfarbe: `#060608`
- Keine harten konzentrischen Ringe mehr
- Stattdessen: diffuse, pulsierende Lichtkreise aus `rgba(255,255,255,0.03)` mit Canvas `shadowBlur`

### 4.2 Nebel-Partikel
- **Anzahl:** 50–70 Partikel
- **Größe:** 1–3px
- **Farbe:** `rgba(255, 255, 255, 0.04–0.12)`
- **Bewegung:** Langsame, träge Drift in zufällige Richtungen (0.1–0.3px/frame)
- **Regeneration:** Partikel, die den Canvas verlassen, werden auf der Gegenseite neu gespawned

### 4.3 Distance Markers
- Sehr feine, gepunktete Linien bei `rgba(255,255,255,0.015)`
- Nur bei geraden Distanzen (2m, 4m, 6m, 8m, 10m)
- Keine harten Zahlen-Labels — stattdessen nur minimale, fast unsichtbare Markierungen

### 4.4 Center Point (Listener)
- Kreuzhaare entfernt
- Stattdessen: sanfter, leuchtender Mittelpunkt-Glow
- Radialer Gradient: `rgba(255,255,255,0.08)` in der Mitte, ausblendend nach außen

### 4.5 Compass Labels
- **Entfernt** — Das Feld fühlt sich räumlich an, nicht kartografisch

### 4.6 3D Mode Enhancements
- Isometrische Perspektive bleibt
- Tiefe durch Nebel-Dichte: weitere Nodes erscheinen diffuser
- Boden als unsichtbare Ebene — nur durch sanfte Lichtreflexion angedeutet
- Z-Linien (Stalks) mit Gradient-Lichtreflexion statt gestrichelter Linien

---

## 5. Listener Figure (Realistic & Anatomical)

### 5.1 Design Principles
- Anatomisch korrekte Proportionen (Kopf, Schultern, Torso, Gliedmaßen)
- Milchiger Glass-Look: `rgba(255,255,255,0.08)` Füllung, `rgba(255,255,255,0.25)` Umriss
- Sanfter innerer Glow für jede Körper-Part
- Kopfhörer als dünner, leuchtender Bogen über den Ohren

### 5.2 Standing (Top-Down View)
**Head:**
- Anatomisch ovale Form (nicht perfekter Kreis)
- Ohren als kleine, ovale Anhängsel an den Seiten
- Augen als minimale Punkte für Blickrichtung
- Kopfhörer-Bügel als geschwungene Linie über dem Kopf

**Shoulders & Upper Body:**
- Breite Schultern, leicht abgerundet
- Oberkörper als vereinfachte, proportionale Form
- Arme leicht nach unten/außen angewinkelt

**Lower Body:**
- Hüften, Oberschenkel, Unterschenkel in vereinfachter Form
- Füße als kleine, ovale Formen

**Audio Visualizer:**
- Leuchtende Pulse von den Ohren ausgehend (wellenförmige Kreise)
- Left/Right-Level als kleine, leuchtende Balken an den Ohren

### 5.3 Lying Back (Supine)
**Body:**
- Horizontal liegende Form
- Kopf am rechten Ende (oder oben, je nach Blickwinkel)
- Schultern breiter als Kopf
- Torso schmaler als Schultern
- Arme leicht angelegt am Körper
- Beine gestreckt oder leicht angewinkelt

**Head:**
- Leicht nach oben geneigt (Head-Tilt wird visualisiert)
- Ohren horizontal ausgerichtet
- Kopfhörer als leuchtende Kreise an den Ohren

**Ground Plane:**
- Sanfte, horizontale Linie als Boden-Referenz
- Diffuser Schatten unter dem Körper

### 5.4 Lying Side (Lateral)
**Body:**
- Vertikale Form (Kopf oben, Füße unten)
- Körper leicht gebogen (Knie leicht angezogen)
- Arme vor dem Körper oder unter dem Kopf
- Kopf nach rechts gerichtet (Profil-Ansicht)

**Head (Profile):**
- Nase als kleiner Vorsprung
- Kinn und Stirn als weiche Kurven
- Ein Ohr sichtbar (das obere)
- Kopfhörer als leuchtender Ring am sichtbaren Ohr

**Ground Shadow:**
- Elliptischer, diffuser Schatten unter dem Körper
- Weiche Kanten, keine harte Linie

### 5.5 Head-Tilt Animation
- Kopf rotiert sanft basierend auf `headTilt` Wert (-90° bis +90°)
- Rotation erfolgt um den Hals-Pivot-Punkt
- Übergang: 0.15s ease-out

### 5.6 Audio Reactive Elements
- Ohren leuchten bei hohem Pegel (`levels.left/right > 0.3`)
- Kleine, pulsierende Kreise um die Ohren bei aktivem Sound
- Level-Balken: vertikal an den Ohren, Farbwechsel bei hohem Pegel

---

## 6. Sound Nodes (Emitters)

### 6.1 Node Design
- **Outer Glow:** Sanfter, farbiger Glow-Ring (5-8px radius) mit `shadowBlur`
- **Fill:** `#1c1c1e` (tiefes Dunkelgrau, nicht ganz schwarz)
- **Stroke:** Farbe des Sound-Typs bei 0.6 Opazität, weich
- **Selected:** Pulsierender blauer Glow-Ring (`rgba(0, 102, 204, 0.3)`) statt harter weißer Umrandung
- **Hover:** Scale 1.05 + Glow-Intensität erhöht

### 6.2 Ripple Effect
- Sanfte, ausbleichende Lichtwellen mit Glow
- Start bei Node-Radius, expandieren nach außen
- Opazität fällt von 0.6 auf 0
- Farbe: Sound-Typ-Farbe mit 0.4 Opazität

### 6.3 Z-Stalk (Height Connection)
- Gradient-Linie: hell in der Mitte, transparent an den Enden
- `rgba(255,255,255,0.15)` in der Mitte, `rgba(255,255,255,0.0)` an den Enden
- Weich, nicht gestrichelt

### 6.4 Ground Shadow
- Elliptisch, weich, diffus
- `rgba(0, 0, 0, 0.35)` mit `shadowBlur: 8px`
- Größe skaliert mit Z-Höhe (höher = kleinerer Schatten)

### 6.5 Emoji
- Bleibt als Identifikator
- Leichter `shadowBlur: 4px` für Glass-Tiefe
- Slightly erhöhte Opazität (0.95) für bessere Lesbarkeit

### 6.6 Label
- `rgba(255,255,255,0.5)` statt 0.6
- Leichter `shadowBlur: 2px` für Lesbarkeit auf dem Hintergrund

---

## 7. UI Components

### 7.1 Flyouts (Left Side)
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(50px) saturate(180%);
border-radius: 24px;
border: 1px solid;
border-color: rgba(255,255,255,0.10) rgba(0,0,0,0.20) rgba(0,0,0,0.20) rgba(255,255,255,0.10);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.08),
  0 0 60px rgba(0, 102, 204, 0.04),
  0 12px 40px rgba(0, 0, 0, 0.45);
padding: 20px;
max-height: 72vh;
```
- Animation: `flyoutIn` — `translateX(-12px) → 0` + `opacity: 0 → 1`, 0.3s, `cubic-bezier(0.32, 0.72, 0, 1)`
- Scrollbar: 3px breit, `rgba(255,255,255,0.08)`

### 7.2 Right Panel (Properties)
- Gleiches Glass-Material wie Flyouts
- Panel-Handle: Schmale Glass-Linie, `rgba(255,255,255,0.15)`, 4px hoch, 32px breit
- Close-Button: Kreisförmiger Glass-Chip, `rgba(255,255,255,0.06)`, Hover: sanfter Glow
- Eingangs-Animation: `translateX(20px) → 0` + Fade, 0.35s

### 7.3 Toolbar (Left)
```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(40px) saturate(180%);
border-radius: 20px;
padding: 8px;
gap: 6px;
```
- Icons: `rgba(255,255,255,0.50)`, 18px
- Hover: `rgba(255,255,255,0.80)` + `background: rgba(255,255,255,0.06)`
- Active: Blauer Glow-Ring (`box-shadow: 0 0 0 2px rgba(0,102,204,0.4)`) + Icon in `rgba(0,153,255,0.9)`

### 7.4 Top Controls (Right)
- Gleiche Glass-Struktur wie Toolbar
- 2D/3D-Button: Toggle zwischen "2D" und "3D" Text mit sanftem Übergang

### 7.5 Settings Dropdown
- Glass-Panel, das von oben rechts ausklappt
- Animation: `scale(0.95) → scale(1)` + `opacity: 0 → 1`, 0.2s

### 7.6 Welcome Modal
```css
background: rgba(28, 28, 32, 0.75);
backdrop-filter: blur(80px) saturate(200%);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 28px;
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.1),
  0 0 80px rgba(0, 102, 204, 0.06),
  0 24px 64px rgba(0, 0, 0, 0.60);
```
- Hintergrund-Overlay: `rgba(0,0,0,0.50)` + `backdrop-filter: blur(20px)`
- Pulse-Button: `background: rgba(0,102,204,0.8)` + leuchtender Glow (`box-shadow: 0 0 30px rgba(0,102,204,0.3)`)
- Text-Glow: `text-shadow: 0 0 20px rgba(255,255,255,0.1)` für bessere Lesbarkeit auf Glass

### 7.7 Timeline
- Panel-Hintergrund: Glass-Scheibe (`blur(40px)`)
- Track-Zeilen: Subtile Trennlinien bei `rgba(255,255,255,0.03)`
- Blöcke: Milchiges Glas mit Sound-Typ-Farbe als inneren Glow
- Playhead: Leuchtender Strich (`#2997ff`) mit sanftem Trail (`rgba(41,151,255,0.1)`)
- Ruler-Ticks: `rgba(255,255,255,0.08)`

### 7.8 Mobile Tab Bar
```css
background: rgba(6, 6, 8, 0.70);
backdrop-filter: blur(40px) saturate(160%);
border-top: 1px solid rgba(255,255,255,0.06);
```
- Aktiver Tab: Blauer Glow unter dem Icon (`box-shadow: 0 -2px 8px rgba(0,102,204,0.3)`)

### 7.9 Buttons
**Primary:**
```css
background: rgba(0, 102, 204, 0.85);
box-shadow: 0 0 20px rgba(0,102,204,0.2);
```
Hover: Hintergrund heller + Glow intensiver
Active: `transform: scale(0.97)` + innerer Glow dippt kurz

**Secondary:**
```css
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.10);
```
Hover: `background: rgba(255,255,255,0.10)`

**Danger:**
```css
background: rgba(255, 69, 58, 0.15);
border: 1px solid rgba(255, 69, 58, 0.25);
color: #ff453a;
```

### 7.10 Inputs & Sliders
**Select & Text Input:**
```css
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.08);
```
Focus: Border-Farbe wechselt zu `rgba(0,102,204,0.5)` + sanfter Glow

**Slider:**
- Track: `rgba(255,255,255,0.08)`
- Fill: Gradient von `rgba(0,102,204,0.8)` zu `rgba(0,102,204,0.4)`
- Thumb: Weiß mit blauem Glow (`box-shadow: 0 0 8px rgba(0,102,204,0.4)`)

---

## 8. Animations & Micro-Interactions

### 8.1 Easing
- Standard: `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style ease-out)
- Schnell: `cubic-bezier(0.4, 0, 0.2, 1)`
- Bounce: `cubic-bezier(0.34, 1.56, 0.64, 1)` (nur für Modals)

### 8.2 Durations
| Interaction | Duration |
|---|---|
| Panel einblenden | 0.35s |
| Flyout öffnen | 0.30s |
| Button hover | 0.15s |
| Node hover/selection | 0.20s |
| Modal erscheinen | 0.40s |
| Settings dropdown | 0.20s |
| Camera fly-to | 0.60s |
| Glass-Reflexion | Konstant (CSS `::before`) |

### 8.3 Specific Animations
**Node Selection Pulse:**
```css
@keyframes nodeSelectedPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,102,204,0.3); }
  50% { box-shadow: 0 0 0 8px rgba(0,102,204,0.15); }
}
animation: nodeSelectedPulse 2s ease-in-out infinite;
```

**Glass Panel Entry:**
```css
@keyframes glassIn {
  from { opacity: 0; transform: translateX(-12px) scale(0.98); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
```

**Nebel-Partikel:**
- Konstante, langsame Drift (kein Keyframe-Animation)
- Partikel-Regeneration: Sofort, wenn außerhalb des Canvas

**Audio Ripple:**
- Radius: 0 → 40px
- Opazität: 0.6 → 0
- Dauer: 2s
- Easing: `ease-out`

**Head-Tilt:**
- Rotation: 0.15s `ease-out`

---

## 9. 2D/3D Experience Improvements

### 9.1 2D Mode
- Flache, ruhige Ansicht ohne Perspektive
- Nodes als flache Kreise mit Glow
- Grid als feine, gepunktete Linien
- Listener als top-down Figur

### 9.2 3D Mode
- Isometrische Perspektive mit sanfter Pitch/Rotation
- Z-Stalks mit Gradient-Lichtreflexion
- Nebel-Dichte erhöht sich mit Entfernung (Tiefen-Cue)
- Boden-Ebene: Nur durch diffuse Lichtreflexion angedeutet
- Kamera: Fließendere Übergänge, Zoom-Grenzen 0.6–2.0

### 9.3 Transition (2D ↔ 3D)
- `flyTo` mit 0.5s Dauer
- Pitch: 0° → 30° (oder zurück)
- Zoom: sanfte Anpassung
- Nebel-Dichte: Fade-in/Fade-out über 0.3s

### 9.4 Camera Controls
- Scroll: Zoom (beide Modi)
- Cmd/Ctrl + Scroll: Orbit (nur 3D)
- Pinch: Zoom (Touch)
- Two-finger rotate: Yaw (Touch, 3D)
- Doppelklick: Zoom-in auf Klick-Punkt

---

## 10. Responsive Behavior

### 10.1 Desktop (> 834px)
- Vollständiges Glass-UI mit allen Panels
- Canvas nimmt den gesamten Hintergrund ein
- Flyouts und Rechts-Panel als schwebende Glass-Scheiben

### 10.2 Tablet (≤ 834px)
- Flyouts: Volle Breite, von unten hereingleitend (Sheet-Style)
- Rechts-Panel: Volle Breite, von unten
- Toolbar: Horizontal, über dem Mobile Tab Bar
- Glass-Effekte leicht reduziert (`blur(30px)` statt 60px)

### 10.3 Mobile (≤ 480px)
- Einfachere Glass-Panels (weniger Blur für Performance)
- Touch-Ziele mindestens 44×44px
- Timeline: Kompakter, 140px Höhe
- Canvas-Anweisungen: Kompakter

---

## 11. Assets & Resources

### 11.1 Fonts
- Beibehaltung der bestehenden SF Pro Stack
- Keine neuen Google Fonts notwendig

### 11.2 No External Images
- Alles wird via CSS und Canvas generiert
- Keine Bild-Assets notwendig

### 11.3 CSS Variables
Alle neuen Werte als CSS Custom Properties in `:root` definieren für einfache Anpassung.

---

## 12. Implementation Notes

### 12.1 CSS-Änderungen
- Primär in `src/style.css`
- Neue `:root` Variablen für Glass-System
- Bestehende Struktur beibehalten, Werte aktualisieren
- Mobile Media Queries anpassen für Glass-Effekte

### 12.2 CanvasGrid.js-Änderungen
- `drawGrid()`: Nebel-Partikel, diffuse Ringe, entfernte Kompass-Labels
- `drawListener()`: Realistische Figuren mit Glass-Look
- `drawEmitters()`: Glow-Nodes, sanfte Ripples, Z-Stalks
- Neue Methoden: `_drawStandingFigure()`, `_drawLyingBackFigure()`, `_drawLyingSideFigure()`
- Partikel-System: Initialisierung, Update, Render

### 12.3 Keine Änderungen
- `main.js`: Keine strukturellen Änderungen (nur CSS-Klassen)
- `AudioEngine.js`: Keine Änderungen
- `ControlPanel.js`: Keine Änderungen (nur CSS-Styling)
- `Timeline.js`: Nur CSS-Klassen, keine Logik-Änderungen
- `index.html`: Keine HTML-Struktur-Änderungen

### 12.4 Performance
- `backdrop-filter` kann auf älteren Geräten langsam sein
- Für Mobile: Reduziere `blur()` Werte
- Canvas-Partikel: Begrenze auf 50–70, verwende effiziente Update-Loop

---

## 13. Files to Modify

1. `src/style.css` — Glass-Design-System, alle UI-Komponenten
2. `src/ui/CanvasGrid.js` — Canvas-Rendering, Figuren, Partikel, Nebel
3. `DESIGN.md` — Aktualisierung der Design-Dokumentation

---

*Spec written: 2026-05-23*
*Status: Awaiting user review before implementation*
