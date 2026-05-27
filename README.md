# 🏴‍☠️ Pirate Healings — 3D Sound Journey Builder

> **An AI vibecoded experiment** — this entire application was built through agentic coding from start to finish, using **Chinese AI models** (primarily **Qwen3.6 Plus**) with minimal human intervention and zero project structure management tools. No scaffolding, no architecture planning — just raw AI-to-code, one agentic conversation at a time.

[![Tests](https://img.shields.io/badge/tests-104%2F104%20✓-brightgreen)](https://github.com/leopardcodeai/3d-sound-journey-builder/actions)
[![Vercel](https://img.shields.io/badge/deployed-vercel-black)](https://3dsoundapp.vercel.app)
[![AI Built](https://img.shields.io/badge/vibecoded-AI-purple)](https://github.com/leopardcodeai/3d-sound-journey-builder)

---

## 🎧 What it does

Pirate Healings is an interactive **spatial sound experience builder** running entirely in the browser. Place instruments, nature sounds, and ambient textures on a 2D/3D canvas — each with its own position in space, volume, height, and animation path. Design multi-minute sound journeys with keyframe-based spatial animation, then export and share.

Every sound source renders as it would be experienced **inside your head**: HRTF spatialization with personalized head/shoulder/pinna modeling, posture physics (standing, lying-back, lateral), and real-time AirPods head tracking via WebBLE.

---

## 🧠 How it was built

```
User intent → Qwen3.6 Plus agent → code → test → deploy → repeat
     ↑                                                          ↓
     └──────────────── feedback loop ──────────────────────────┘
```

| Layer | Stack |
|-------|-------|
| **Spatial Audio** | Web Audio API, HRTF convolution, custom HRIR tables, PannerNode |
| **3D Canvas** | Canvas 2D with isometric projection, particle fog, ripple physics |
| **Timeline** | Keyframe interpolation (linear/ease-in/ease-out), zoomable ruler |
| **State Mgmt** | Command Pattern (UndoManager), Map-based source registry |
| **Audio Engine** | Manual AudioContext graph, gain ramping, stereo L/R metering |
| **Head Tracking** | WebBLE + AirPods IMU → quaternion → listener rotation |
| **UI** | Glass-morphism sidebar, vibe glass design system |
| **Testing** | Vitest + jsdom, 104 unit tests across 7 modules |
| **Deploy** | Vite → Vercel edge |

### The vibe coding philosophy

- **No project scaffolding** — `npm init` was the only boilerplate
- **No architecture diagrams** — structure emerged from feature conversations
- **No Jira/Linear/ClickUp** — the AI agent WAS the project manager
- **Chinese models (Qwen3.6 Plus)** handled 100% of code generation
- **Agentic loop**: the AI inspected its own output via Playwright, found bugs (invalid RGBA strings, missing timeline sync), and self-corrected
- **Human role**: intent definition, vibe checks, final approval clicks

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Spatial 3D Audio** | HRTF convolution, shoulder/pinna/torso scattering, posture physics |
| **2D/3D Canvas** | Isometric projection, camera orbit/pan/zoom, particle fog, ripple effects |
| **45+ Sound Presets** | Instruments (piano, synth-pad, bass, strings, flute, drone, arpeggio), nature (rain, thunder, waves, birds, crickets, campfire), urban (café, subway, city traffic), jungle (monkeys, elephants, leopard, river), ocean (whales, dolphins, deep ambient), singing bowls (8 tones), brainwave frequencies (alpha, beta, theta, delta, gamma) |
| **Activity Presets** | Focus, meditation, sleep, relaxation, energy — instant multi-source scenes |
| **Template Scenes** | Jungle night, ocean deep, cosmic soundscape, urban thunderstorm, morning ritual, sound therapy single-source templates |
| **Timeline Pro** | Multi-track keyframe editor with zoom, pan, play/pause/loop, 0—600s range |
| **Keyframe Animation** | Spatial paths with linear/ease-in/ease-out interpolation, volume automation |
| **Undo/Redo** | 20-step Command Pattern stack, keyboard shortcuts (Cmd+Z / Cmd+Shift+Z) |
| **Head Tracking** | AirPods gyroscope → real-time listener rotation via WebBLE |
| **Speaker Mode** | 2.0—7.1 channel configs with custom speaker placement |
| **Z-Height** | 3D elevation per source (±10m range) |
| **Automations** | Orbit, ping-pong, drift, breathe paths |
| **Ramp Controls** | Per-source fade-in/fade-out/repeat intervals |
| **Soundscape Timer** | Countdown with automatic scene stop |
| **Scene Sharing** | Export/import via URL-encoded state |
| **i18n-ready** | English + German translations prepared |

---

## 🗺️ Architecture Flow

```
┌─────────────────────────────────────────────────────┐
│                    index.html                        │
│  Canvas #soundscape-canvas | #panel-left | #panel-right │
└─────────┬──────────────────┬─────────────┬──────────┘
          │                  │             │
    ┌─────▼──────┐    ┌──────▼──────┐  ┌──▼──────────┐
    │ CanvasGrid │    │ ControlPanel │  │  EventBinds │
    │  (2D/3D)   │◄───│  (sidebar)   │  │  (presets)  │
    └─────┬──────┘    └──────┬──────┘  └──────┬──────┘
          │                  │                │
    ┌─────▼──────────────────▼────────────────▼──────┐
    │              main.js (orchestrator)              │
    │  AudioEngine ← CanvasGrid ← Timeline ← UndoMgr  │
    └────────┬──────────────┬───────────────┬─────────┘
             │              │               │
    ┌────────▼────┐  ┌──────▼──────┐  ┌─────▼────────┐
    │ AudioEngine │  │  Timeline   │  │  UndoManager │
    │ HRTF + graph│  │ keyframes   │  │ Command stack│
    └──────┬──────┘  └─────────────┘  └──────────────┘
           │
    ┌──────▼─────────────┐
    │ Web Audio API       │
    │  AudioContext       │
    │  PannerNode (HRTF)  │
    │  GainNode (ramps)   │
    │  ConvolverNode      │
    └─────────────────────┘
```

---

## 🚀 Quick Start

```bash
# Install
npm install

# Dev server (hot reload)
npm run dev

# Build
npm run build

# Test (104/104 ✓)
npm test

# Preview production build
npm run preview
```

Deployed at **[3dsoundapp.vercel.app](https://3dsoundapp.vercel.app)**

---

## 📦 Tech Stack

- **Runtime:** Vanilla JS (ES modules, no framework)
- **Audio:** Web Audio API (HRTF, AudioContext, PannerNode, ConvolverNode)
- **Rendering:** Canvas 2D with custom 3D isometric projection
- **Testing:** Vitest + jsdom (104 unit tests)
- **Build:** Vite
- **Deploy:** Vercel edge
- **Browser Automation:** Playwright (self-testing)

---

## 🧪 The AI Self-Testing Loop

One of the wildest parts of this experiment: the AI agent **inspected its own output**. When the canvas was rendering black, it:

1. Installed Playwright on its own
2. Wrote test scripts to screenshot the live app
3. Discovered the `addColorStop` error (invalid RGBA `(0, 153, 255, 0.8, 0.15)`)
4. Traced it to a `.replace()` chain on already-alpha colors
5. Created a `_withAlpha()` helper handling hex → rgba → alpha-replace
6. Tested, verified, and deployed — all autonomously

---

## ⚠️ AI Experiment Disclaimer

This project was built as an **experiment in agentic AI coding**. Expect:

- Files that grew organically (some are 500+ lines — the agent just kept adding)
- Creative naming conventions (German + English mixed freely)
- Architecture decisions that "just worked" rather than being "best practice"
- A vibe-based design system that evolved through conversation
- Zero centralized state management (it's all in the AudioContext graph)

The point was never clean code — it was seeing how far an AI agent could go with nothing but intent and a feedback loop.

---

## 📄 License

MIT — vibe with it.
