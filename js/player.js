(function () {
"use strict";

/* ============================================================
   HELPERS
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const fmt = s => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const x = Math.floor(s % 60);
  return m + ":" + String(x).padStart(2, "0");
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const hashStr = s => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const PALETTES = [
  ["#7f5af0", "#2cb67d"], ["#ff5470", "#ffb86c"], ["#00c2ff", "#7f5af0"],
  ["#f9c80e", "#f86624"], ["#43e97b", "#38f9d7"], ["#b16cea", "#ff5e7e"],
  ["#5b8cff", "#00d4ff"], ["#ff8a00", "#e52e71"]
];

/* ============================================================
   ALBUM ART GENERATOR
   ============================================================ */
function makeArt(colors, seed, size = 320) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");

  const grd = g.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, colors[0]);
  grd.addColorStop(1, colors[1]);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < 5; i++) {
    const x = (Math.sin(seed * 0.7 + i * 1.9) * 0.5 + 0.5) * size;
    const y = (Math.cos(seed * 1.1 + i * 2.3) * 0.5 + 0.5) * size;
    const r = size * (0.14 + 0.11 * Math.abs(Math.sin(seed + i * 1.3)));
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "rgba(255,255,255,.38)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "rgba(255,255,255,.92)";
  g.font = "bold " + Math.round(size * 0.4) + "px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("♪", size / 2, size * 0.53);

  return c.toDataURL("image/png");
}

/* ============================================================
   DEMO TRACK SYNTHESIS
   ============================================================ */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

function scaleNote(root, scale, degree) {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + oct * 12 + scale[idx];
}

const DEMO_DEFS = [
  { title: "Neon Skyline",    artist: "Aurora Wave", bpm: 104, root: 57, scale: MINOR, prog: [0, 5, 3, 4], colors: PALETTES[0] },
  { title: "Midnight Drive",  artist: "Kaze & Lume", bpm: 118, root: 52, scale: MINOR, prog: [0, 3, 4, 5], colors: PALETTES[1] },
  { title: "Sunset Protocol", artist: "Nova Bloom",  bpm: 92,  root: 60, scale: MAJOR, prog: [0, 4, 5, 3], colors: PALETTES[2] },
  { title: "Glass Ocean",     artist: "Halcyon",     bpm: 84,  root: 55, scale: MINOR, prog: [0, 5, 2, 6], colors: PALETTES[3] },
  { title: "Paper Planes",    artist: "Mint Julep",  bpm: 126, root: 62, scale: MAJOR, prog: [0, 3, 5, 4], colors: PALETTES[4] },
  { title: "Afterglow",       artist: "Vela",        bpm: 98,  root: 50, scale: MINOR, prog: [0, 6, 3, 4], colors: PALETTES[5] }
];

async function renderDemo(def, sr = 22050) {
  const beat = 60 / def.bpm;
  const barLen = beat * 4;
  const bars = 8;
  const dur = bars * barLen + 2;

  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(2, Math.ceil(dur * sr), sr);

  const master = ctx.createGain();
  master.gain.value = 0.85;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;

  master.connect(comp);
  comp.connect(ctx.destination);

  const chordAt = bar => {
    const d = def.prog[bar % def.prog.length];
    return [0, 2, 4].map(k => scaleNote(def.root, def.scale, d + k));
  };

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barLen;
    const chord = chordAt(bar);

    /* Pad */
    chord.forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = midiToFreq(m);
      o.detune.value = (i - 1) * 5;

      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900, t0);
      f.frequency.linearRampToValueAtTime(2300, t0 + barLen * 0.5);
      f.frequency.linearRampToValueAtTime(900, t0 + barLen);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.075, t0 + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t0 + barLen + 0.4);

      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + barLen + 0.6);
    });

    /* Arpeggio */
    for (let s = 0; s < 8; s++) {
      const t = t0 + s * (barLen / 8);
      const m = chord[s % 3] + 12 + (s % 4 === 3 ? 12 : 0);

      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = midiToFreq(m);

      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2600;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.32);
    }

    /* Bass + kick */
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;

      const bo = ctx.createOscillator();
      bo.type = "sine";
      bo.frequency.value = midiToFreq(chord[0] - 12);

      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);

      bo.connect(bg); bg.connect(master);
      bo.start(t); bo.stop(t + beat);

      if (b === 0 || b === 2) {
        const ko = ctx.createOscillator();
        ko.type = "sine";
        ko.frequency.setValueAtTime(150, t);
        ko.frequency.exponentialRampToValueAtTime(48, t + 0.12);

        const kg = ctx.createGain();
        kg.gain.setValueAtTime(0.6, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        ko.connect(kg); kg.connect(master);
        ko.start(t); ko.stop(t + 0.32);
      }
    }
  }

  return ctx.startRendering();
}

/* AudioBuffer → 16-bit PCM WAV */
function bufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const dataLen = len * numCh * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(ab);
  const wstr = (off, s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };

  wstr(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * numCh * 2, true); dv.setUint16(32, numCh * 2, true);
  dv.setUint16(34, 16, true); wstr(36, "data"); dv.setUint32(40, dataLen, true);

  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = clamp(chans[c][i], -1, 1);
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

/* ============================================================
   AUDIO GRAPH
   ============================================================ */
const audio = new Audio();
audio.preload = "metadata";
audio.volume = 0.8;

const AC = window.AudioContext || window.webkitAudioContext;
const actx = new AC();

const analyser = actx.createAnalyser();
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 0.82;

const srcNode = actx.createMediaElementSource(audio);
srcNode.connect(analyser);
analyser.connect(actx.destination);

const freqData = new Uint8Array(analyser.frequencyBinCount);
const timeData = new Uint8Array(analyser.fftSize);

/* ============================================================
   STATE
   ============================================================ */
const state = {
  tracks: [],
  current: -1,
  playing: false,
  shuffle: false,
  repeat: "off",
  filter: "",
  loading: true
};

/* ============================================================
   DOM REFS
   ============================================================ */
const artEl       = $("#art");
const artWrap     = $("#artWrap");
const titleEl     = $("#title");
const artistEl    = $("#artist");
const playBtn     = $("#playBtn");
const prevBtn     = $("#prevBtn");
const nextBtn     = $("#nextBtn");
const shuffleBtn  = $("#shuffleBtn");
const repeatBtn   = $("#repeatBtn");
const seekEl      = $("#seek");
const seekFill    = $("#seekFill");
const seekBuffer  = $("#seekBuffer");
const curTimeEl   = $("#curTime");
const durTimeEl   = $("#durTime");
const volEl       = $("#vol");
const muteBtn     = $("#muteBtn");
const favBtn      = $("#favBtn");
const playlistEl  = $("#playlist");
const countEl     = $("#count");
const searchEl    = $("#searchInput");
const fileInput   = $("#fileInput");
const dragOverlay = $("#dragOverlay");
const canvas      = $("#viz");
const vctx        = canvas.getContext("2d");

/* ============================================================
   VISUALIZER
   ============================================================ */
let CW = 0, CH = 0, vizMode = 0, barGrad = null;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  CW = Math.max(1, r.width);
  CH = Math.max(1, r.height);
  canvas.width  = Math.floor(CW * dpr);
  canvas.height = Math.floor(CH * dpr);
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  barGrad = vctx.createLinearGradient(0, CH, 0, 0);
  barGrad.addColorStop(0, "#7f5af0");
  barGrad.addColorStop(0.55, "#5b8cff");
  barGrad.addColorStop(1, "#2cb67d");
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawBars() {
  analyser.getByteFrequencyData(freqData);
  const N = CW < 380 ? 36 : 56;
  const gap = 3;
  const bw = (CW - gap * (N - 1)) / N;

  vctx.fillStyle = barGrad;
  for (let i = 0; i < N; i++) {
    const idx = Math.min(freqData.length - 1,
      Math.floor(Math.pow(i / N, 1.7) * freqData.length * 0.72));
    const v = freqData[idx] / 255;
    const h = Math.max(2, Math.pow(v, 1.15) * (CH - 8));
    const x = i * (bw + gap);
    roundRect(vctx, x, CH - h, bw, h, bw / 2);
    vctx.fill();
  }
}

function drawWave() {
  analyser.getByteTimeDomainData(timeData);

  const grad = vctx.createLinearGradient(0, 0, CW, 0);
  grad.addColorStop(0, "#7f5af0");
  grad.addColorStop(0.5, "#5b8cff");
  grad.addColorStop(1, "#2cb67d");

  vctx.lineWidth = 2.4;
  vctx.lineJoin = "round";
  vctx.strokeStyle = grad;
  vctx.shadowBlur = 14;
  vctx.shadowColor = "rgba(127,90,240,.75)";
  vctx.beginPath();

  const step = Math.max(1, Math.floor(timeData.length / 320));
  for (let i = 0; i < timeData.length; i += step) {
    const v = (timeData[i] - 128) / 128;
    const y = CH / 2 + v * (CH * 0.44);
    const x = (i / timeData.length) * CW;
    if (i === 0) vctx.moveTo(x, y);
    else vctx.lineTo(x, y);
  }
  vctx.stroke();
  vctx.shadowBlur = 0;
}

function drawRadial() {
  analyser.getByteFrequencyData(freqData);

  const cx = CW / 2, cy = CH / 2;
  const N = 64;
  const baseR = Math.min(CW, CH) * 0.20;
  const maxLen = Math.min(CW, CH) * 0.30;

  vctx.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const idx = Math.min(freqData.length - 1,
      Math.floor(Math.pow(i / N, 1.6) * freqData.length * 0.62));
    const v = freqData[idx] / 255;
    const len = 3 + v * maxLen;
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(a), sin = Math.sin(a);

    vctx.strokeStyle = "hsl(" + (262 + (i / N) * 110) + ", 82%, " + (52 + v * 26) + "%)";
    vctx.lineWidth = 3.2;
    vctx.beginPath();
    vctx.moveTo(cx + cos * baseR, cy + sin * baseR);
    vctx.lineTo(cx + cos * (baseR + len), cy + sin * (baseR + len));
    vctx.stroke();
  }
  vctx.lineCap = "butt";
}

function drawViz() {
  vctx.clearRect(0, 0, CW, CH);
  if (vizMode === 1) drawWave();
  else if (vizMode === 2) drawRadial();
  else drawBars();
}

/* ============================================================
   PLAYBACK CONTROLS
   ============================================================ */
async function play() {
  if (state.current < 0 && state.tracks.length) return loadTrack(0);
  if (state.current < 0) return;

  try {
    if (actx.state === "suspended") await actx.resume();
    await audio.play();
    state.playing = true;
  } catch (err) {
    console.warn("Playback blocked:", err);
    state.playing = false;
  }
  updatePlayUI();
}

function pause() {
  audio.pause();
  state.playing = false;
  updatePlayUI();
}

function togglePlay() {
  if (state.playing) pause();
  else play();
}

function loadTrack(index, autoplay = true) {
  if (index < 0 || index >= state.tracks.length) return;

  state.current = index;
  const t = state.tracks[index];

  audio.src = t.src;
  audio.load();

  titleEl.textContent = t.title;
  artistEl.textContent = t.artist;
  artEl.style.backgroundImage = "url(" + t.art + ")";
  durTimeEl.textContent = t.duration ? fmt(t.duration) : "0:00";

  updateMediaSession(t);
  refreshActive();

  if (autoplay) play();
  else { state.playing = false; updatePlayUI(); }
}

function randomOther() {
  const n = state.tracks.length;
  if (n <= 1) return 0;
  let i;
  do { i = Math.floor(Math.random() * n); } while (i === state.current);
  return i;
}

function nextTrack() {
  if (!state.tracks.length) return;
  if (state.shuffle) return loadTrack(randomOther());
  loadTrack((state.current + 1) % state.tracks.length);
}

function prevTrack() {
  if (!state.tracks.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    updateProgress();
    return;
  }
  if (state.shuffle) return loadTrack(randomOther());
  const n = state.tracks.length;
  loadTrack((state.current - 1 + n) % n);
}

function handleEnded() {
  if (state.repeat === "one") {
    audio.currentTime = 0;
    play();
    return;
  }
  if (state.shuffle) return loadTrack(randomOther());

  const isLast = state.current === state.tracks.length - 1;
  if (!isLast) return loadTrack(state.current + 1);
  if (state.repeat === "all") return loadTrack(0);

  state.playing = false;
  audio.currentTime = 0;
  updatePlayUI();
  updateProgress();
}

/* ============================================================
   UI UPDATES
   ============================================================ */
const ICON_PLAY =
  '<svg viewBox="0 0 24 24"><path d="M8 5.1v13.8c0 .9 1 1.4 1.7.9l10.4-6.9a1.1 1.1 0 0 0 0-1.8L9.7 4.2C9 3.7 8 4.2 8 5.1z"/></svg>';

const ICON_PAUSE =
  '<svg viewBox="0 0 24 24"><path d="M6.5 4.5h3.6c.5 0 .9.4.9.9v13.2c0 .5-.4.9-.9.9H6.5a.9.9 0 0 1-.9-.9V5.4c0-.5.4-.9.9-.9zm7.4 0h3.6c.5 0 .9.4.9.9v13.2c0 .5-.4.9-.9.9h-3.6a.9.9 0 0 1-.9-.9V5.4c0-.5.4-.9.9-.9z"/></svg>';

function updatePlayUI() {
  playBtn.innerHTML = state.playing ? ICON_PAUSE : ICON_PLAY;
  document.body.classList.toggle("is-playing", state.playing);

  const eq = playlistEl.querySelector(".track.active .eq");
  if (eq) eq.classList.toggle("paused", !state.playing);
}

let lastCur = -1, lastDur = -1;

function updateProgress() {
  const d = audio.duration || 0;
  const c = audio.currentTime || 0;
  const p = d ? (c / d) * 100 : 0;

  seekFill.style.width = p.toFixed(2) + "%";

  if (audio.buffered.length) {
    const b = audio.buffered.end(audio.buffered.length - 1);
    seekBuffer.style.width = (d ? (b / d) * 100 : 0).toFixed(2) + "%";
  }

  const ci = Math.floor(c);
  const di = Math.floor(d);
  if (ci !== lastCur) { lastCur = ci; curTimeEl.textContent = fmt(c); }
  if (di !== lastDur) { lastDur = di; durTimeEl.textContent = fmt(d); }
}

function refreshActive() {
  playlistEl.querySelectorAll(".track").forEach(li => {
    const i = parseInt(li.dataset.index, 10);
    const isActive = i === state.current;
    li.classList.toggle("active", isActive);

    const num = li.querySelector(".num");
    if (!num) return;

    if (isActive) {
      num.innerHTML = '<span class="eq' + (state.playing ? "" : " paused") + '"><i></i><i></i><i></i></span>';
    } else {
      num.textContent = String(i + 1);
    }
  });
}

function updateDurationCell(i) {
  const li = playlistEl.querySelector('.track[data-index="' + i + '"]');
  if (!li) return;
  const d = li.querySelector(".dur");
  if (d) d.textContent = state.tracks[i].duration ? fmt(state.tracks[i].duration) : "--:--";
}

function renderPlaylist() {
  const q = state.filter.trim().toLowerCase();
  const items = state.tracks
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));

  countEl.textContent = state.tracks.length;

  const scrollTop = playlistEl.scrollTop;
  playlistEl.innerHTML = "";

  if (state.loading && !state.tracks.length) {
    playlistEl.innerHTML = '<li class="empty"><b>Preparing your library…</b>Rendering demo tracks</li>';
    return;
  }

  if (!items.length) {
    playlistEl.innerHTML = '<li class="empty"><b>No songs found</b>' +
      (state.tracks.length ? "Try a different search." : "Add audio files to get started.") + "</li>";
    return;
  }

  const frag = document.createDocumentFragment();

  items.forEach(({ t, i }, idx) => {
    const li = document.createElement("li");
    const active = i === state.current;
    li.className = "track" + (active ? " active" : "");
    li.dataset.index = i;
    li.style.animationDelay = (idx * 28) + "ms";

    const numCell = active
      ? '<span class="eq' + (state.playing ? "" : " paused") + '"><i></i><i></i><i></i></span>'
      : String(i + 1);

    li.innerHTML =
      '<span class="num">' + numCell + "</span>" +
      '<span class="mini" style="background-image:url(' + t.art + ')"></span>' +
      '<span class="txt"><b>' + esc(t.title) + "</b><small>" + esc(t.artist) + "</small></span>" +
      '<span class="dur">' + (t.duration ? fmt(t.duration) : "--:--") + "</span>";

    li.addEventListener("click", () => {
      if (i === state.current) togglePlay();
      else loadTrack(i);
    });

    frag.appendChild(li);
  });

  playlistEl.appendChild(frag);
  playlistEl.scrollTop = scrollTop;
}

/* ============================================================
   MEDIA SESSION
   ============================================================ */
function updateMediaSession(t) {
  if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: "Pulse",
      artwork: [{ src: t.art, sizes: "320x320", type: "image/png" }]
    });
  } catch (e) { /* ignore */ }
}

function initMediaSession() {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
    navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
    navigator.mediaSession.setActionHandler("seekto", d => {
      if (d.seekTime != null) { audio.currentTime = d.seekTime; updateProgress(); }
    });
  } catch (e) { /* ignore */ }
}

/* ============================================================
   SEEK BAR
   ============================================================ */
let dragging = false;

function seekToPointer(e) {
  const r = seekEl.getBoundingClientRect();
  const ratio = clamp((e.clientX - r.left) / r.width, 0, 1);
  if (isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = ratio * audio.duration;
    updateProgress();
  }
}

seekEl.addEventListener("pointerdown", e => {
  dragging = true;
  seekEl.classList.add("dragging");
  seekEl.setPointerCapture(e.pointerId);
  seekToPointer(e);
});

seekEl.addEventListener("pointermove", e => {
  if (dragging) seekToPointer(e);
});

seekEl.addEventListener("pointerup", e => {
  dragging = false;
  seekEl.classList.remove("dragging");
  try { seekEl.releasePointerCapture(e.pointerId); } catch (_) {}
});

seekEl.addEventListener("pointercancel", () => {
  dragging = false;
  seekEl.classList.remove("dragging");
});

/* ============================================================
   VOLUME
   ============================================================ */
const VOL_PATHS = {
  high: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  low:  '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M17 9l4 6M21 9l-4 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};

function updateVolUI() {
  const v = audio.muted ? 0 : audio.volume;
  volEl.value = v;
  volEl.style.setProperty("--p", (v * 100) + "%");

  const icon = $("#volIcon");
  if (icon) icon.innerHTML = v === 0 ? VOL_PATHS.mute : (v < 0.5 ? VOL_PATHS.low : VOL_PATHS.high);
}

function setVolume(v) {
  audio.volume = clamp(v, 0, 1);
  audio.muted = audio.volume === 0;
  updateVolUI();
}

volEl.addEventListener("input", () => {
  audio.muted = false;
  setVolume(parseFloat(volEl.value));
});

muteBtn.addEventListener("click", () => {
  audio.muted = !audio.muted;
  updateVolUI();
});

/* ============================================================
   BUTTON WIRING
   ============================================================ */
playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", nextTrack);
prevBtn.addEventListener("click", prevTrack);

shuffleBtn.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  shuffleBtn.classList.toggle("on", state.shuffle);
});

repeatBtn.addEventListener("click", () => {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  repeatBtn.classList.toggle("on", state.repeat !== "off");
});

favBtn.addEventListener("click", () => favBtn.classList.toggle("on"));

$("#vizModes").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  vizMode = parseInt(chip.dataset.mode, 10);
  document.querySelectorAll("#vizModes .chip").forEach(c =>
    c.classList.toggle("active", c === chip));
});

searchEl.addEventListener("input", () => {
  state.filter = searchEl.value;
  renderPlaylist();
});

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

  switch (e.key) {
    case " ":
      e.preventDefault(); togglePlay(); break;
    case "ArrowRight":
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      updateProgress(); break;
    case "ArrowLeft":
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      updateProgress(); break;
    case "ArrowUp":
      e.preventDefault(); setVolume(audio.volume + 0.05); break;
    case "ArrowDown":
      e.preventDefault(); setVolume(audio.volume - 0.05); break;
    case "m": case "M": muteBtn.click(); break;
    case "n": case "N": nextTrack(); break;
    case "p": case "P": prevTrack(); break;
    case "s": case "S": shuffleBtn.click(); break;
    case "r": case "R": repeatBtn.click(); break;
  }
});

/* ============================================================
   AUDIO EVENTS
   ============================================================ */
audio.addEventListener("play", () => {
  state.playing = true;
  updatePlayUI();
});

audio.addEventListener("pause", () => {
  state.playing = false;
  updatePlayUI();
});

audio.addEventListener("loadedmetadata", () => {
  const t = state.tracks[state.current];
  if (t && (!t.duration || !isFinite(t.duration))) {
    t.duration = audio.duration || 0;
    updateDurationCell(state.current);
  }
  updateProgress();
});

audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("progress", updateProgress);
audio.addEventListener("ended", handleEnded);
audio.addEventListener("error", () => console.warn("Audio error for track", state.current));

/* ============================================================
   FILE IMPORT
   ============================================================ */
function readDuration(url) {
  return new Promise(resolve => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;

    const done = d => {
      a.src = "";
      resolve(d);
    };

    a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(0);
    setTimeout(() => done(isFinite(a.duration) ? a.duration : 0), 4000);
  });
}

async function addFiles(fileList) {
  const files = Array.from(fileList).filter(f =>
    f.type.startsWith("audio/") ||
    /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i.test(f.name)
  );
  if (!files.length) return;

  const wasEmpty = state.tracks.length === 0;

  for (const f of files) {
    const url = URL.createObjectURL(f);
    const duration = await readDuration(url);
    const title = f.name.replace(/\.[^.]+$/, "");
    const colors = PALETTES[hashStr(f.name) % PALETTES.length];

    state.tracks.push({
      title,
      artist: "Local file",
      src: url,
      duration,
      colors,
      art: makeArt(colors, hashStr(f.name)),
      local: true
    });
  }

  renderPlaylist();

  if (wasEmpty && state.current === -1) loadTrack(0, false);
}

fileInput.addEventListener("change", e => {
  addFiles(e.target.files);
  fileInput.value = "";
});

/* Drag & drop */
let dragDepth = 0;

["dragenter", "dragover"].forEach(evt =>
  document.addEventListener(evt, e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    if (evt === "dragenter") dragDepth++;
    dragOverlay.classList.add("show");
  })
);

document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dragOverlay.classList.remove("show");
});

document.addEventListener("drop", e => {
  e.preventDefault();
  dragDepth = 0;
  dragOverlay.classList.remove("show");
  if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

/* ============================================================
   RENDER LOOP
   ============================================================ */
function loop() {
  requestAnimationFrame(loop);
  if (!CW) resizeCanvas();
  drawViz();
  if (state.playing && !dragging) updateProgress();
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  }

  updateVolUI();
  updatePlayUI();
  renderPlaylist();
  initMediaSession();
  requestAnimationFrame(loop);

  // Render demo tracks sequentially so the UI stays smooth
  for (let i = 0; i < DEMO_DEFS.length; i++) {
    const def = DEMO_DEFS[i];
    try {
      const buf = await renderDemo(def);
      const blob = bufferToWav(buf);
      state.tracks.push({
        title: def.title,
        artist: def.artist,
        src: URL.createObjectURL(blob),
        duration: buf.duration,
        colors: def.colors,
        art: makeArt(def.colors, hashStr(def.title))
      });
      renderPlaylist();
    } catch (err) {
      console.warn("Demo render failed:", err);
    }
  }

  state.loading = false;
  renderPlaylist();

  // Pre-load the first track without autoplay
  if (state.current === -1 && state.tracks.length) {
    loadTrack(0, false);
  }
}

boot();

})();