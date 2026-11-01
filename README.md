# Pulse Music Player

A responsive browser music player built with HTML, CSS, and vanilla JavaScript. It includes a searchable library, audio visualizations, playback controls, generated demo music, and the ability to load local audio files.

## Features

- Six generated instrumental demo tracks, synthesized in the browser with the Web Audio API.
- Import audio using the file picker or drag and drop files onto the page.
- Playback controls for play/pause, previous, next, shuffle, and repeat (off, all, or one).
- Seek bar with buffered-progress display, elapsed time, and duration.
- Volume slider and mute control.
- Search the library by song title or artist.
- Three visualizer modes: bars, waveform, and radial.
- Generated album art for demo and imported tracks.
- Keyboard shortcuts for common playback, volume, seek, shuffle, and repeat actions.
- Media Session integration where supported by the browser and operating system.
- Responsive layout and animated background effects.

## Run locally

No package installation or build step is required. Open `index.html` in a modern browser, or serve the project with a static local web server. The Web Audio API and local-file object URLs are provided by the browser.

Some browsers may restrict audio playback until the user interacts with the page; press **Play** after the player has loaded.

## Using the player

- Select a demo track from the Library to load it, then use the playback controls.
- Choose **Add music** to import audio files, or drag and drop audio files onto the page.
- Search the Library by title or artist.
- Select **Bars**, **Wave**, or **Radial** to change the visualizer.
- Drag the progress bar to seek within the current track.
- Use shuffle and repeat to adjust playback order.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `Left` / `Right Arrow` | Seek backward/forward 5 seconds |
| `Down` / `Up Arrow` | Decrease/increase volume |
| `M` | Mute or unmute |
| `N` / `P` | Next / previous track |
| `S` | Toggle shuffle |
| `R` | Cycle repeat mode |

Keyboard shortcuts are ignored while typing in an input field.

## Project structure

```text
task4-music-player/
├── audio/          # Optional audio assets
├── css/
│   └── style.css   # Player layout, responsive styles, and animations
├── js/
│   └── player.js  # Demo synthesis, library, playback, and visualizer
├── index.html     # Player controls and library markup
└── README.md
```

## Technologies

- HTML5
- CSS3 (Grid, custom properties, animations, and media queries)
- Vanilla JavaScript
- HTML Audio, Web Audio, and Offline Audio APIs
- Canvas 2D
- Browser File API and Media Session API (when supported)
