## Recent Updates

- **Responsive layout** — grid now fills viewport width on any screen size
- **Mobile scroll** — horizontal swipe on the grid works correctly on touch devices  
- **Custom grid size** — Rows (4–16) and Steps (4–16) sliders in the transport bar

 
 
 # Chromatrack
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://consciousnode.github.io/chromatrack/Chromatrack_Final.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)]()
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-API-orange)]()
  A fully self-contained generative step sequencer built entirely with the Web Audio API. No install. No server. No dependencies. Just one HTML file.

  > Open `chromatrack.html` in any modern browser and make music.

  ---

  ## Quick Start

  1. Download `chromatrack.html`
  2. Open it in Chrome, Edge, or Firefox
  3. Click **Play**

  That's it.

  ---

  ## Features

  ### Sequencer Grid
  - **16 rows × 16 steps** — each row is a pitched voice, C5 down to C2
  - **Left-click / Tap** — toggle a step at 100% probability
  - **Right-click / Long-press** — open the probability popup (1–100%)
  - **Click-drag / Touch-drag** — paint or erase multiple cells at once
  - **Probable steps** shown as dashed outlines with percentage label

  ### Synthesis — 9 Voice Types
  | Symbol | Type | Character |
  |--------|------|-----------|
  | `~` | Sine | Pure, clean tone |
  | `^` | Triangle | Soft, hollow |
  | `W` | Sawtooth | Bright, buzzy |
  | `Π` | Square | Hollow, reedy |
  | `*` | Noise | Filtered noise, percussive |
  | `FM` | FM | Metallic, bell-like, complex |
  | `Pu` | Pulse | Thin, nasal, hollow |
  | `De` | Detune | Fat supersaw, wide stereo feel |
  | `Ch` | Chord | Root + major 3rd + 5th, instant harmony |

  ### Per-Row Controls
  Every row has 10 independent controls:

  | Button | Function |
  |--------|----------|
  | **~** | Cycle waveform (9 types) |
  | **P/S/M/L/∞** | Decay time — Pluck / Short / Medium / Long / Pad |
  | **«2…»2** | Octave shift (−2 to +2) |
  | **2–16** | Step length — polymetric, independent per row |
  | **1–8** | Euclidean beat count (Bjorklund algorithm) |
  | **M** | MIDI channel override (1–16 or Auto) |
  | **·/M/S** | Mute (click) / Solo (double-click) |
  | **½·24** | Speed multiplier — ½× / 1× / 2× / 4× |
  | **A/↑↓↕?** | Arpeggiator — Off / Up / Down / Up-Down / Random |
  | **🔓/🔒** | Probability lock — immune to Mutate and Random |

  ### Transport
  - **Play / Stop** with clean state reset
  - **Live Record** — tap cells to write notes at the current playhead position
  - **Tap Tempo** — 4-tap rolling average
  - **BPM** — 60 to 180
  - **Swing** — 0 to 75%
  - **Volume**
  - **Humanize** — randomises timing (±30ms) and velocity (±20%) for a live feel

  ### Patterns
  - **4 pattern slots** — switch instantly or queue during playback
  - **Copy** — copy current pattern to any other slot, with live diff overlay on hover
  - **Chain mode** — automatically advances through patterns 1→2→3→4→1…
  - **Song mode** — arrange patterns into a linear sequence (up to 16 steps, each repeating ×1–8)
  - **Transpose** — per-pattern pitch shift of ±12 semitones

  ### Generative Tools
  - **Random** — sparse probabilistic fill respecting locked rows
  - **Mutate** — evolves the current pattern with 4 intensity levels (Low / Med / High / Chaos)
  - **Auto-Mutate** — triggers mutation automatically every 2, 4, 8, or 16 bars
  - **Euclidean Generator** — distributes beats as evenly as possible across a row's step length using the Bjorklund algorithm

  ### Scale Lock
  Quantises all voices to a musical scale in real time:

  | Scale |
  |-------|
  | Free (no quantisation) |
  | Major |
  | Minor |
  | Dorian |
  | Phrygian |
  | Lydian |
  | Mixolydian |
  | Minor Pentatonic |
  | Major Pentatonic |
  | Chromatic |

  Root note selectable across all 12 chromatic pitches.

  ### Themes — 6 Colour Palettes
  | Theme | Character |
  |-------|-----------|
  | **Neon** | Cyan / Magenta — the default dark neon look |
  | **Inferno** | Orange / Yellow — warm, fiery |
  | **Forest** | Green — deep and organic |
  | **Void** | Violet / Blue — cold and spacious |
  | **Rose** | Pink / Purple — soft and dreamy |
  | **Ice** | Sky Blue — crisp and minimal |

  Themes repaint the entire UI instantly — row colours, oscilloscope gradient, scrollbar, sliders, and all accent elements.

  ### Piano Roll
  - Toggle with the **Roll** button
  - Shows all 16 rows and 16 steps for the active pattern
  - Probability shown as opacity
  - Live playhead during playback
  - Zoom levels: 1× / 2× / 3× / 4×

  ### Oscilloscope
  - Live waveform display
  - Gradient follows the active theme's colour range
  - Flat line when idle

  ### MIDI
  - **Web MIDI output** — select any connected MIDI device
  - **Per-row channel routing** — each row defaults to its own channel (1–16), overridable
  - **All Notes Off** sent on Stop
  - **MIDI file export** — downloads a standard `.mid` file with:
    - Correct tempo track
    - Per-row tracks
    - Swing encoded as tick offsets
    - Velocity mapped from step probability
    - Export modes: Current pattern / All patterns / Chain

  ### Presets
  - **5 save slots** using `localStorage`
  - Saves everything: patterns, all row settings, BPM, swing, scale, transpose, song arrangement, theme
  - Filled slots indicated by a dot beneath the slot button
  - Backward compatible — presets saved before the 16-row update load and pad correctly

  ---

  ## Architecture

  Chromatrack is intentionally a single HTML file with no build step, no bundler, and no runtime dependencies beyond Tailwind CSS (loaded from CDN for utility classes only).

  ### Audio Engine
  - **Web Audio API** — all synthesis is built from raw oscillator, gain, biquad filter, and buffer source nodes
  - **Web Worker scheduler** — a dedicated worker fires a 25ms tick, completely isolated from the main thread and immune to tab throttling
  - **Lookahead buffering** — notes are scheduled 100ms ahead of the audio clock, eliminating jitter
  - **Dynamics compressor** on the master bus

  ### Timing
  The scheduler uses the standard Web Audio clock (`audioCtx.currentTime`) as the source of truth. The worker tick wakes the scheduler, which schedules all notes that fall within the lookahead window. Visual feedback is decoupled — a `visualQueue` holds scheduled events and `requestAnimationFrame` drains it in sync with the display.

  ### Synthesis
  Every note creates a fresh node graph: oscillator(s) → gain envelope → master gain → analyser → compressor → destination. Nodes are created and destroyed per-note with no pooling required, as the Web Audio API handles this efficiently.

  ### Polymetric Clock
  Each row maintains its own step counter and a fractional accumulator. The speed multiplier (½×, 1×, 2×, 4×) advances the accumulator by a different amount each global tick, allowing rows to run at completely independent rates against the same master clock.

  ---

  ## Browser Support

  | Browser | Support |
  |---------|---------|
  | Chrome / Edge | ✅ Full — recommended |
  | Firefox | ✅ Full |
  | Safari | ✅ Works — Web MIDI requires a plugin |
  | Mobile Chrome | ✅ Full touch support |
  | Mobile Safari | ⚠️ Works — Web MIDI not available |

  Web MIDI API requires a secure context (HTTPS or localhost) in all browsers.

  ---

  ## Usage Tips

  - **Polymetric grooves** — set different step lengths per row (e.g. 3, 4, 5) and let them drift against each other
  - **Euclidean + lock** — generate a euclidean pattern on a row, lock it, then mutate everything else around it
  - **Song mode** — build 4 distinct patterns and arrange them into a full track structure with repeat counts
  - **FM + long decay** — FM voice with the ∞ decay setting makes evolving metallic pads
  - **Chord voice + arp** — combine the Chord waveform with the Up-Down arpeggiator for cascading harmony
  - **Auto-mutate + prob lock** — lock your kick and bassline rows, enable auto-mutate every 4 bars, and let the upper voices evolve while the groove stays anchored
  - **Humanize** — even a small amount (10–20%) makes programmed patterns feel significantly more alive

  ---

  ## License

  MIT — do whatever you want with it.

  ---

  ## Credits

  Built with the Web Audio API, a Web Worker, and an unreasonable amount of attention to timing accuracy.
