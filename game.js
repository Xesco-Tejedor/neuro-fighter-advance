'use strict';
/* NEURO-FIGHTER: Avance — Tramos 1 y 2
   Tramo 1 (Fosa de Ranvier): avance lateral con oleadas y MACRO-L1.
   Tramo 2 (Vía Periférica): nuevas variedades de agresores, la superarma
   MOTO-V (moto de luz estilo neón: pista larga, estelas y rivales) y la jefa PLACA-0.
   MGR-01 protege la conexión; la barra de CONEXIÓN solo se restaura
   con recargas de señal y puntos de control. Derrotar enemigos no cura. */

const VIEW_W = 384, VIEW_H = 216;
const LANE_TOP = 148, LANE_BOTTOM = 202;

// barreras de neón repartidas por la pista (patrón fijo, sin azar)
function neonHazards() {
  const lanes = [158, 190, 172, 198, 162, 186];
  const out = [];
  let k = 0;
  for (let x = 1860; x < 5760; x += 340) {
    out.push({ x: x, lane: lanes[k % lanes.length] });
    k++;
  }
  return out;
}

// ---------- CONFIGURACIÓN DE TRAMOS ----------
const STAGES = [
  {
    name: 'TRAMO 1 · FOSA DE RANVIER',
    worldW: 1900,
    weapons: [{ x: 700, lane: 182 }, { x: 1345, lane: 182 }],
    hazards: [],
    repairs: [],
    vehiclePad: null,
    dismountX: 0,
    triggers: [
      { x: 340, type: 'wave', waves: [{ t: 'melee' }, { t: 'melee' }, { t: 'melee' }] },
      { x: 1000, type: 'wave', waves: [{ t: 'melee' }, { t: 'melee' }, { t: 'melee' }, { t: 'melee', big: true }] },
      { x: 1400, type: 'boss', boss: 'macro' },
    ],
    zones: [
      { x: 0, name: 'TRAMO 1 · FOSA DE RANVIER' },
      { x: 340, name: '2 · ZONA BLOQUEADA' },
      { x: 660, name: '3 · AVANZA' },
      { x: 1000, name: '4 · SEGUNDA OLEADA' },
      { x: 1400, name: '5 · JEFE: MACRO-L1' },
    ],
    next: true,
  },
  {
    name: 'TRAMO 2 · VÍA PERIFÉRICA',
    worldW: 6420,
    weapons: [{ x: 620, lane: 170 }, { x: 990, lane: 192 }, { x: 5640, lane: 182 }],
    hazards: neonHazards(), // barreras de neón del tramo de vuelo: saltarlas o esquivarlas
    repairs: [{ x: 2300, lane: 182 }, { x: 3350, lane: 182 }, { x: 4400, lane: 182 }, { x: 5450, lane: 182 }],
    vehiclePad: { x: 1150, lane: 182 },
    dismountX: 5900,
    triggers: [
      { x: 380, type: 'wave', waves: [{ t: 'melee' }, { t: 'cito' }, { t: 'melee' }, { t: 'cito' }] },
      { x: 820, type: 'wave', waves: [{ t: 'radical' }, { t: 'radical' }, { t: 'plasma' }, { t: 'radical' }, { t: 'melee', big: true }] },
      { x: 5980, type: 'boss', boss: 'placa' },
    ],
    zones: [
      { x: 0, name: 'TRAMO 2 · VÍA PERIFÉRICA' },
      { x: 380, name: '2 · PATRULLA MIXTA' },
      { x: 700, name: '3 · AVANZA' },
      { x: 820, name: '4 · ENJAMBRE HOSTIL' },
      { x: 1120, name: '5 · MOTO-V A LA VISTA' },
      { x: 1500, name: '6 · PISTA DE NEÓN\nSALTA O CAMBIA DE CARRIL' },
      { x: 3000, name: '7 · RED DE ESTELAS' },
      { x: 4500, name: '8 · TRAMO FINAL DE LA PISTA' },
      { x: 5980, name: '9 · JEFE: PLACA-0' },
    ],
    next: false,
  },
];

// ---------- AUDIO ARCADE ESTÉREO (síntesis original, sin muestras externas) ----------
class SoundEngine {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.music = new MusicEngine(this); this.voices = 0; this.lastHit = -1;
    this.pan = 0; this.noiseBuffer = null;
  }
  init() {
    try {
      if (!this.ctx) {
        const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.78;
        this.mix = ctx.createGain(); this.mix.gain.value = 0.65;
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.62;
        this.fxBus = ctx.createGain(); this.fxBus.gain.value = 0.85;
        this.musicBus.connect(this.mix); this.fxBus.connect(this.mix);
        // Sala corta: dos reflexiones distintas, sin realimentación ni colas infinitas.
        this.room = ctx.createGain(); this.room.gain.value = 0.12;
        const roomHP = ctx.createBiquadFilter(); roomHP.type = 'highpass'; roomHP.frequency.value = 420;
        const roomLP = ctx.createBiquadFilter(); roomLP.type = 'lowpass'; roomLP.frequency.value = 4300;
        this.room.connect(roomHP); roomHP.connect(roomLP);
        [[0.043, -0.8], [0.071, 0.8]].forEach(([time, pan]) => {
          const d = ctx.createDelay(0.2); d.delayTime.value = time;
          const p = ctx.createStereoPanner(); p.pan.value = pan;
          roomLP.connect(d); d.connect(p); p.connect(this.mix);
        });
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -13; comp.knee.value = 10; comp.ratio.value = 5;
        comp.attack.value = 0.003; comp.release.value = 0.16;
        // Techo suave, con margen de salida incluso al coincidir varios impactos.
        const limiter = ctx.createWaveShaper(); const curve = new Float32Array(4097);
        for (let i = 0; i < curve.length; i++) curve[i] = 0.88 * Math.tanh(1.2 * (i * 2 / (curve.length - 1) - 1));
        limiter.curve = curve; limiter.oversample = '2x';
        this.mix.connect(hp); hp.connect(comp); comp.connect(limiter);
        limiter.connect(this.master); this.master.connect(ctx.destination);
        const n = ctx.sampleRate; this.noiseBuffer = ctx.createBuffer(1, n, n);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    } catch (e) { /* El juego sigue funcionando si no hay Web Audio. */ }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.78, t, 0.008);
    }
    const btn = document.getElementById('sound-toggle');
    if (btn) { btn.textContent = this.muted ? 'SONIDO: OFF' : 'SONIDO: ON'; btn.setAttribute('aria-pressed', String(this.muted)); }
    return this.muted;
  }
  position(x, camera = 0) { this.pan = Math.max(-0.8, Math.min(0.8, ((x - camera) / VIEW_W * 2 - 1) * 0.8)); }
  musicEnsure(name) { this.music.ensure(name); }
  route(source, gain, duration, pan = this.pan, bus = this.fxBus, wet = 0.18) {
    const ctx = this.ctx; const p = ctx.createStereoPanner(); p.pan.value = pan;
    const send = ctx.createGain(); send.gain.value = wet;
    source.connect(gain); gain.connect(p); p.connect(bus); p.connect(send); send.connect(this.room);
    this.voices++;
    const cleanup = () => { source.disconnect(); gain.disconnect(); p.disconnect(); send.disconnect(); this.voices--; };
    source.onended = cleanup; return cleanup;
  }
  tone(freq, type, dur, endFreq, vol, delay = 0, pan = this.pan, bus = this.fxBus) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || this.voices >= 64) return;
    const t = this.ctx.currentTime + delay; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq > 0) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.route(o, g, dur, pan, bus); o.start(t); o.stop(t + dur + 0.01);
  }
  noise(dur, vol, cutoff = 1800, highpass = false) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || this.voices >= 64) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = highpass ? 'highpass' : 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); const cleanup = this.route(f, g, dur);
    s.onended = () => { s.disconnect(); cleanup(); };
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }
  hit(heavy = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; if (t - this.lastHit < 0.025) return; this.lastHit = t;
    this.noise(0.075, 0.34, 2200); // ataque seco
    this.tone(heavy ? 150 : 195, 'sine', 0.19, 48, heavy ? 0.8 : 0.64); // cuerpo grave
    this.tone(680, 'triangle', 0.065, 115, 0.32);
    if (this.music.bus) { const g = this.music.bus.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.34, t); g.linearRampToValueAtTime(0.62, t + 0.16); }
  }
  weaponGet() { this.tone(392, 'triangle', 0.16, 784, 0.4); this.tone(587, 'sine', 0.3, 1175, 0.3, 0.07); }
  weaponBreak() { this.noise(0.22, 0.35, 3000); this.tone(260, 'sawtooth', 0.26, 55, 0.25); }
  boost() { this.tone(95, 'sawtooth', 0.35, 620, 0.24); this.noise(0.22, 0.24, 1600); }
  enemyShot() { this.tone(540, 'triangle', 0.17, 180, 0.26); }
  fireball() { this.tone(180, 'sawtooth', 0.32, 950, 0.24); this.tone(90, 'sine', 0.3, 420, 0.42); this.noise(0.18, 0.18, 3000); }
  jump() { this.tone(240, 'triangle', 0.19, 680, 0.25); }
  block() { this.tone(1180, 'triangle', 0.12, 710, 0.32); this.tone(1730, 'sine', 0.09, 940, 0.18); this.noise(0.045, 0.22, 4000, true); }
  ko() { this.hit(true); this.tone(180, 'sawtooth', 0.65, 38, 0.25); this.noise(0.35, 0.28, 950); }
  pickup() { this.tone(660, 'sine', 0.18, 990, 0.38); this.tone(880, 'triangle', 0.26, 1320, 0.24, 0.08); }
  checkpoint() { [523, 659, 784].forEach((f, i) => this.tone(f, 'triangle', 0.28, 0, 0.3, i * 0.09, (i - 1) * 0.35)); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', 0.4, 0, 0.32, i * 0.14, (i - 1.5) * 0.25)); }
}

// ---------- MÚSICA (secuenciador chiptune original, sin samples ni material externo) ----------
// Temas compuestos para NEURO-FIGHTER: 'main' (avance) y 'boss' (jefes, más intenso).
// tema de la pista de neón: arpegio sintético original
function neonLead() {
  const lead = {};
  const arp = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 56, 59, 64]];
  for (let b = 0; b < 4; b++) {
    for (let k = 0; k < 16; k += 2) {
      const n = arp[b][(k / 2) % 4] + 12 + ((k % 8 === 6) ? 12 : 0);
      lead[b * 16 + k] = [n, 1];
    }
  }
  return lead;
}
const MUSIC_TRACKS = {
  neon: {
    bpm: 146, len: 64,
    lead: neonLead(),
    bassRoots: [33, 29, 31, 28],
    bassEnd: 28,
    drive: true,
  },
  main: {
    bpm: 132, len: 64,
    lead: {
      0: [69, 2], 2: [72, 2], 4: [76, 2], 6: [81, 4], 12: [76, 2], 14: [74, 2],
      16: [74, 2], 18: [77, 2], 20: [81, 2], 22: [84, 4], 28: [81, 2], 30: [79, 2],
      32: [79, 2], 34: [74, 2], 36: [71, 2], 38: [74, 4], 44: [74, 2], 46: [76, 2],
      48: [76, 2], 50: [81, 2], 52: [84, 2], 54: [88, 4], 60: [84, 2], 62: [81, 2],
    },
    bassRoots: [45, 41, 43, 45],
    bassEnd: 40,
    drive: false,
  },
  boss: {
    bpm: 156, len: 64,
    lead: {
      0: [81, 2], 2: [81, 1], 3: [81, 1], 4: [79, 2], 8: [81, 2], 10: [84, 2], 12: [83, 4],
      16: [81, 2], 18: [81, 1], 19: [81, 1], 20: [76, 2], 24: [79, 2], 26: [81, 2], 28: [86, 4],
      32: [84, 2], 34: [84, 1], 35: [84, 1], 36: [81, 2], 40: [84, 2], 42: [86, 2], 44: [84, 4],
      48: [83, 2], 50: [83, 1], 51: [83, 1], 52: [80, 2], 56: [83, 2], 58: [86, 2], 60: [88, 4],
    },
    bassRoots: [45, 45, 41, 40],
    bassEnd: 44,
    drive: true,
  },
};

class MusicEngine {
  constructor(sfx) { this.sfx = sfx; this.bus = null; this.name = null; this.playing = false; this.timer = null; this.step = 0; this.nextT = 0; this.nbuf = null; }
  ensure(name) {
    if (name !== this.name) { this.stopTrack(); this.name = name; }
    if (!this.name || this.playing) return;
    const ctx = this.sfx.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = 0.62;
      this.bus.connect(this.sfx.musicBus);
    }
    this.step = 0;
    this.nextT = ctx.currentTime + 0.08;
    this.playing = true;
    this.timer = setInterval(() => this.tick(), 40);
  }
  stopTrack() { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  tick() {
    const ctx = this.sfx.ctx;
    if (!this.playing || !ctx || ctx.state !== 'running') return;
    const tr = MUSIC_TRACKS[this.name];
    const spb = 60 / tr.bpm / 4;
    if (this.nextT < ctx.currentTime - 0.2) this.nextT = ctx.currentTime + 0.03;
    while (this.nextT < ctx.currentTime + 0.15) {
      this.scheduleStep(tr, this.step, this.nextT, spb);
      this.nextT += spb;
      this.step = (this.step + 1) % tr.len;
    }
  }
  scheduleStep(tr, step, t, spb) {
    const L = tr.lead[step];
    if (L) this.note(this.midi(L[0]), 'sine', L[1] * spb * 0.92, 0.19, t, -0.28, true);
    const bar = Math.floor(step / 16);
    if (tr.drive || step % 2 === 0) {
      let root = tr.bassRoots[bar];
      if (step === 62) root = tr.bassEnd;
      const oct = (!tr.drive && step % 16 === 4) ? 12 : 0;
      this.note(this.midi(root + oct), 'triangle', (tr.drive ? 0.9 : 1.9) * spb, 0.28, t, 0);
    }
    if (step % 4 === 0) this.drum(t, false);
    if (step % 8 === 4) this.drum(t, true);
    if (step % 4 === 2) this.hat(t, 0.05);
    else if (tr.drive && step % 2 === 0) this.hat(t, 0.03);
  }
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  note(freq, type, dur, vol, t, pan = 0, fm = false) {
    try {
      const ctx = this.sfx.ctx;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.setValueAtTime(vol * 0.9, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(g); g.connect(p); p.connect(this.bus);
      const send = ctx.createGain(); send.gain.value = fm ? 0.2 : 0.025; p.connect(send); send.connect(this.sfx.room);
      let mod, mg;
      if (fm) { mod = ctx.createOscillator(); mg = ctx.createGain(); mod.frequency.value = freq * 2;
        mg.gain.setValueAtTime(freq * 1.3, t); mg.gain.exponentialRampToValueAtTime(3, t + dur);
        mod.connect(mg); mg.connect(o.frequency); mod.start(t); mod.stop(t + dur + 0.02); }
      o.onended = () => { o.disconnect(); g.disconnect(); p.disconnect(); send.disconnect(); if (mod) { mod.disconnect(); mg.disconnect(); } };
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  }
  drum(t, snare) {
    const ctx = this.sfx.ctx;
    if (snare) {
      const src = ctx.createBufferSource(); src.buffer = this.sfx.noiseBuffer;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      src.connect(f); f.connect(g); g.connect(this.bus);
      src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); }; src.start(t); src.stop(t + 0.14);
    }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(snare ? 170 : 120, t); o.frequency.exponentialRampToValueAtTime(snare ? 80 : 42, t + 0.12);
    g.gain.setValueAtTime(snare ? 0.14 : 0.46, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.bus); o.onended = () => { o.disconnect(); g.disconnect(); }; o.start(t); o.stop(t + 0.17);
  }
  hat(t, vol) {
    try {
      const ctx = this.sfx.ctx;
      if (!this.nbuf) {
        const n = Math.floor(ctx.sampleRate * 0.04);
        this.nbuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = this.nbuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      }
      const src = ctx.createBufferSource(); src.buffer = this.nbuf;
      const g = ctx.createGain(); g.gain.value = vol;
      const p = ctx.createStereoPanner(); p.pan.value = 0.42;
      src.connect(g); g.connect(p); p.connect(this.bus);
      src.onended = () => { src.disconnect(); g.disconnect(); p.disconnect(); };
      src.start(t);
    } catch (e) { }
  }
}

// ---------- DIBUJO PROCEDURAL (sin assets; estilo v5) ----------
function glowDot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function branch(ctx, x, y, ang, len, w, depth, wig) {
  const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
  if (depth > 0) {
    branch(ctx, nx, ny, ang - 0.6 + wig * 0.1, len * 0.62, w * 0.65, depth - 1, wig);
    branch(ctx, nx, ny, ang + 0.55 - wig * 0.1, len * 0.58, w * 0.65, depth - 1, wig);
  }
}
// MGR-01 (microglía, protagonista) y MACRO-L1 (macrófago, jefe) — dibujos aprobados en v5
function drawMgr(ctx, f) {
  const t = f.frameTimer;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const air = (f.z || 0) > 0;
  const punching = f.currentAnim === 'punch';
  const guard = f.currentAnim === 'guard';
  const ext = (punching && f.attackFrame >= 4) ? 14 : 0;
  const bob = Math.sin(t / 8) * 1.3;
  const wig = Math.sin(t / 6);
  const col = flash ? '#ffffff' : '#4ee6f2';
  const colDark = flash ? '#dddddd' : '#168fa8';

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);
  ctx.scale(1.2, 1.2);
  ctx.lineCap = 'round';
  const cy = -31 + bob;

  // Piernas ramificadas
  ctx.strokeStyle = colDark;
  const stance = air ? 0.5 : 1;
  branch(ctx, -3, cy + 8, Math.PI / 2 + 0.55 * stance, 14, 2.6, 1, wig);
  branch(ctx, 3, cy + 8, Math.PI / 2 - 0.5 * stance, 14, 2.6, 1, -wig);

  // Brazo trasero
  ctx.strokeStyle = colDark;
  branch(ctx, -4, cy - 2, Math.PI - 0.5 + wig * 0.15, 11, 2.2, 2, wig);

  // Antenas / dendritas de la cabeza
  ctx.strokeStyle = col;
  branch(ctx, -3, cy - 10, -Math.PI / 2 - 0.5, 8, 1.8, 2, wig);
  branch(ctx, 3, cy - 10, -Math.PI / 2 + 0.35, 9, 1.8, 2, -wig);

  // Brazo delantero (golpe / guardia / reposo)
  ctx.strokeStyle = col;
  if (punching) {
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(5, cy - 2); ctx.lineTo(18 + ext, cy - 4); ctx.stroke();
    branch(ctx, 18 + ext, cy - 4, -0.5, 5, 1.6, 1, wig);
    branch(ctx, 18 + ext, cy - 4, 0.5, 5, 1.6, 1, -wig);
    if (ext) glowDot(ctx, 22 + ext, cy - 4, 10, 'rgba(103,232,249,0.7)');
  } else if (guard) {
    ctx.strokeStyle = 'rgba(165,243,252,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(10, cy, 18, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
    ctx.strokeStyle = col;
    branch(ctx, 5, cy - 1, -0.3, 9, 2, 1, wig);
  } else {
    branch(ctx, 5, cy - 2, -0.2 + wig * 0.1, 14, 2.4, 2, wig);
  }

  // ENZIMA-L (arma recogible): bastón enzimático en la mano delantera
  if (f.weapon) {
    const hx = punching ? 18 + ext : 14, hy = punching ? cy - 4 : cy + 2;
    ctx.save();
    ctx.strokeStyle = '#b8f94e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 3, hy + 6); ctx.lineTo(hx + 9, hy - 8); ctx.stroke();
    glowDot(ctx, hx + 9, hy - 8, 6, 'rgba(184,249,78,0.85)');
    ctx.fillStyle = '#e9ffc0';
    ctx.beginPath(); ctx.arc(hx + 9, hy - 8, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Cuerpo celular con resplandor
  glowDot(ctx, 0, cy, 24, flash ? 'rgba(255,255,255,0.4)' : 'rgba(34,211,238,0.35)');
  const bg = ctx.createLinearGradient(0, cy - 12, 0, cy + 12);
  bg.addColorStop(0, flash ? '#fff' : '#9ef0a8');
  bg.addColorStop(0.45, col);
  bg.addColorStop(1, colDark);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, cy, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colDark; ctx.lineWidth = 1; ctx.stroke();

  // Nucleo luminoso
  const pulse = 0.7 + 0.3 * Math.sin(t / 5);
  glowDot(ctx, -1, cy + 4, 9 * pulse + 3, 'rgba(220,255,255,0.95)');

  // Ojos
  ctx.fillStyle = '#06222c';
  ctx.beginPath(); ctx.ellipse(3, cy - 5, 3, 3.6, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-3, cy - 5, 2.2, 3, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3.5, cy - 7, 1.4, 1.4);
  ctx.fillRect(-2.6, cy - 6.6, 1.1, 1.1);

  ctx.restore();
}

function drawMacro(ctx, f) {
  const t = f.frameTimer;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const punching = f.currentAnim === 'punch';
  const guard = f.currentAnim === 'guard';
  const ext = (punching && f.attackFrame >= 4) ? 18 : 0;
  const breathe = Math.sin(t / 9) * 1.6;
  const wob = Math.cos(t / 7) * 1.2;
  const body = flash ? '#ffffff' : '#f98a1f';
  const light = flash ? '#ffffff' : '#ffc067';
  const dark = flash ? '#cccccc' : '#8a3410';

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);

  function blob(x, y, rx, ry) {
    const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, light); g.addColorStop(0.55, body); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
  }

  // Pies / pseudopodos inferiores
  blob(-14, -6 + wob * 0.3, 11, 7);
  blob(14, -6 - wob * 0.3, 11, 7);

  // Brazo trasero
  blob(-24, -30 + breathe, 8, 9);

  // Cuerpo irregular
  const cy = -36 + breathe * 0.5;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = 1 + Math.sin(a * 4 + t / 10) * 0.05;
    const px = Math.cos(a) * 24 * r;
    const py = cy + Math.sin(a) * 25 * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const bg = ctx.createRadialGradient(-6, cy - 10, 2, 0, cy, 30);
  bg.addColorStop(0, light); bg.addColorStop(0.6, body); bg.addColorStop(1, dark);
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();

  // Bulbos superiores
  blob(-8, cy - 26, 4, 5); blob(2, cy - 28, 4.5, 5.5); blob(12, cy - 24, 3.5, 4.5);

  // Granulos
  ctx.fillStyle = 'rgba(138,52,16,0.45)';
  [[-10, cy - 8], [-14, cy + 6], [-4, cy + 14]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); ctx.fill(); });

  // Boca dentada
  const open = punching ? 1.25 : 1 + 0.08 * Math.sin(t / 7);
  ctx.fillStyle = '#220802';
  ctx.beginPath(); ctx.ellipse(9, cy + 2, 9 * open, 12 * open, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#eee' : '#ffe9c4';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const bx = 9 + Math.cos(a) * 9 * open, by = cy + 2 + Math.sin(a) * 12 * open;
    const ix = 9 + Math.cos(a) * 5.5 * open, iy = cy + 2 + Math.sin(a) * 8 * open;
    const nx = -Math.sin(a) * 1.8, ny = Math.cos(a) * 1.8;
    ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(ix, iy); ctx.lineTo(bx - nx, by - ny); ctx.closePath(); ctx.fill();
  }

  // Ojo
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(10, cy - 15, 3.4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#220802';
  ctx.beginPath(); ctx.arc(11, cy - 15, 1.6, 0, Math.PI * 2); ctx.fill();

  // Puno delantero / guardia
  if (punching) {
    blob(22 + ext, -34, 10 + ext * 0.2, 9);
    ctx.fillStyle = dark; ctx.fillRect(18 + ext, -36, 8, 1); // nudillos
  } else if (guard) {
    ctx.strokeStyle = 'rgba(255,200,130,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(14, cy, 28, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
    blob(24, -30, 9, 9);
  } else {
    blob(25, -28 + breathe, 9, 9.5);
  }

  ctx.restore();
}


// Agresores de oleada. Tipos:
//  melee   — célula hostil con púas (tramo 1; normal o grande)
//  cito    — CITO-K, citocina saltarina: brinca y esquiva golpes en el aire
//  radical — RADICAL-X: rápido, frágil, zigzaguea en profundidad
//  plasma  — PLASMA-B: mantiene distancia y dispara glóbulos
const GRUNT_STYLE = {
  melee:   { body: '#e0559b', light: '#ffa3cd', dark: '#7c1d4e', bigBody: '#d63a4e', bigLight: '#ff8a96', bigDark: '#6e1220' },
  cito:    { body: '#f4c542', light: '#ffe89a', dark: '#8a5c10' },
  radical: { body: '#8df24e', light: '#d2ffa3', dark: '#3d7c1d' },
  plasma:  { body: '#b07cf5', light: '#dcc3ff', dark: '#4e1d7c' },
};

function drawGrunt(ctx, f) {
  const t = f.frameTimer;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const st = GRUNT_STYLE[f.type] || GRUNT_STYLE.melee;
  const bodyBase = (f.big && st.bigBody) ? st.bigBody : st.body;
  const lightBase = (f.big && st.bigLight) ? st.bigLight : st.light;
  const darkBase = (f.big && st.bigDark) ? st.bigDark : st.dark;
  const sc = f.big ? 1.45 : 1;
  const punching = f.currentAnim === 'punch';
  const windup = f.currentAnim === 'windup';
  const bob = Math.sin(t / 7) * 1.2;
  const body = flash ? '#ffffff' : bodyBase;
  const light = flash ? '#ffffff' : lightBase;
  const dark = flash ? '#cccccc' : darkBase;

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);
  ctx.scale(sc, sc);
  const cy = -16 + bob;

  if (f.type === 'cito') {
    // CITO-K: esfera ligera con antenas resorte
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4, cy - 9);
      ctx.quadraticCurveTo(i * 6 + Math.sin(t / 5 + i) * 2, cy - 15, i * 7, cy - 18 - Math.abs(Math.sin(t / 6)) * 3);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(-3, cy - 4, 1, 0, cy, 10);
    g.addColorStop(0, light); g.addColorStop(0.6, body); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, cy, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    // muelles de las patas
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-4, cy + 8); ctx.lineTo(-6, cy + 12); ctx.lineTo(-3, cy + 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, cy + 8); ctx.lineTo(6, cy + 12); ctx.lineTo(3, cy + 14); ctx.stroke();
    if (punching) {
      ctx.strokeStyle = body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, cy); ctx.lineTo(19, cy - 2); ctx.stroke();
    } else if (windup) {
      ctx.strokeStyle = body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, cy); ctx.lineTo(11, cy - 7); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(2, cy - 2, 3, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-3.5, cy - 1, 2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a04';
    ctx.beginPath(); ctx.arc(3, cy - 2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-3, cy - 1, 1, 0, Math.PI * 2); ctx.fill();
  } else if (f.type === 'radical') {
    // RADICAL-X: estrella inestable con estela
    const spin = t / 6;
    ctx.fillStyle = dark;
    for (let i = 0; i < 6; i++) {
      const a = spin + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.22) * 6, cy + Math.sin(a - 0.22) * 6);
      ctx.lineTo(Math.cos(a) * 15, cy + Math.sin(a) * 15);
      ctx.lineTo(Math.cos(a + 0.22) * 6, cy + Math.sin(a + 0.22) * 6);
      ctx.closePath(); ctx.fill();
    }
    const g = ctx.createRadialGradient(-2, cy - 3, 1, 0, cy, 8);
    g.addColorStop(0, light); g.addColorStop(0.6, body); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, cy, 7.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    if (punching) {
      ctx.strokeStyle = body; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(5, cy); ctx.lineTo(17, cy - 1); ctx.stroke();
      glowDot(ctx, 18, cy - 1, 6, 'rgba(141,242,78,0.8)');
    } else if (windup) {
      glowDot(ctx, 7, cy - 4, 7, 'rgba(141,242,78,0.7)');
    }
    ctx.fillStyle = '#0c2204';
    ctx.beginPath(); ctx.ellipse(2.5, cy - 1.5, 2.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eaffd0';
    ctx.fillRect(2.6, cy - 2.4, 1, 1);
  } else if (f.type === 'plasma') {
    // PLASMA-B: célula artillera con cañón cargado
    const charge = windup ? 1 : 0.4 + 0.3 * Math.sin(t / 9);
    const g = ctx.createRadialGradient(-3, cy - 4, 1, 0, cy, 11);
    g.addColorStop(0, light); g.addColorStop(0.6, body); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, cy, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    // cañón delantero
    ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(7, cy); ctx.lineTo(17, cy); ctx.stroke();
    ctx.strokeStyle = body; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(7, cy); ctx.lineTo(17, cy); ctx.stroke();
    glowDot(ctx, 18, cy, 5 + 5 * charge, 'rgba(176,124,245,' + (0.5 + 0.4 * charge) + ')');
    ctx.fillStyle = '#e9d8ff';
    ctx.beginPath(); ctx.arc(18, cy, 1.8 + charge, 0, Math.PI * 2); ctx.fill();
    // pies
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-4, cy + 11, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, cy + 11, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(1, cy - 4, 3, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c0830';
    ctx.beginPath(); ctx.arc(2, cy - 4, 1.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // melee: célula hostil con púas (dibujo original del tramo 1)
    ctx.fillStyle = dark;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t / 40;
      const r1 = 9, r2 = 14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.18) * r1, cy + Math.sin(a - 0.18) * r1);
      ctx.lineTo(Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.lineTo(Math.cos(a + 0.18) * r1, cy + Math.sin(a + 0.18) * r1);
      ctx.closePath(); ctx.fill();
    }
    const g = ctx.createRadialGradient(-3, cy - 4, 1, 0, cy, 11);
    g.addColorStop(0, light); g.addColorStop(0.6, body); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, cy, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-4, cy + 10, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, cy + 10, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    if (punching) {
      ctx.strokeStyle = body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, cy); ctx.lineTo(20, cy - 1); ctx.stroke();
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.moveTo(20, cy - 4); ctx.lineTo(27, cy - 1); ctx.lineTo(20, cy + 2); ctx.closePath(); ctx.fill();
    } else if (windup) {
      ctx.strokeStyle = body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, cy); ctx.lineTo(12, cy - 6); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(3, cy - 2, 3.2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b0a14';
    ctx.beginPath(); ctx.arc(4, cy - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, cy - 6.5); ctx.lineTo(6, cy - 4.8); ctx.stroke();
  }
  ctx.restore();
}

// PLACA-0: agregado tóxico que bloquea la conexión (jefa del tramo 2)
function drawPlaca(ctx, f) {
  const t = f.frameTimer;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const windup = f.currentAnim === 'windup';
  const bob = Math.sin(t / 11) * 2;
  const body = flash ? '#ffffff' : '#8f5ad6';
  const light = flash ? '#ffffff' : '#c9a6f2';
  const dark = flash ? '#cccccc' : '#3a1560';
  const core = flash ? '#ffffff' : (f.enraged ? '#ff5a3c' : '#ffb35a');

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);
  const cy = -34 + bob;

  // fragmentos en órbita
  for (let i = 0; i < 4; i++) {
    const a = t / 26 + (i / 4) * Math.PI * 2;
    const ox = Math.cos(a) * 36, oy = cy + Math.sin(a) * 26;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 4); ctx.lineTo(ox + 3.4, oy); ctx.lineTo(ox, oy + 4); ctx.lineTo(ox - 3.4, oy);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = light; ctx.lineWidth = 0.7; ctx.stroke();
  }

  // masa cristalina irregular
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 1 + Math.sin(a * 5 + 1.3) * 0.16 + Math.cos(a * 3 + t / 40) * 0.06;
    const px = Math.cos(a) * 27 * r;
    const py = cy + Math.sin(a) * 31 * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const bg = ctx.createRadialGradient(-6, cy - 10, 2, 0, cy, 36);
  bg.addColorStop(0, light); bg.addColorStop(0.55, body); bg.addColorStop(1, dark);
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();

  // facetas
  ctx.strokeStyle = 'rgba(30,10,55,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-18, cy - 18); ctx.lineTo(-2, cy + 2); ctx.lineTo(-14, cy + 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, cy - 22); ctx.lineTo(-2, cy + 2); ctx.lineTo(18, cy + 14); ctx.stroke();

  // núcleo tóxico (crece al cargar el disparo)
  const pulse = 0.75 + 0.25 * Math.sin(t / 5);
  const cr = (windup ? 11 : 7.5) * pulse + (windup ? 2 : 0);
  glowDot(ctx, 0, cy, cr * 2.6, f.enraged ? 'rgba(255,90,60,0.75)' : 'rgba(255,179,90,0.7)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff7e0';
  ctx.beginPath(); ctx.arc(-1.5, cy - 1.5, cr * 0.35, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// MGR-01 pilotando la MOTO-V: moto de luz futurista (silueta baja, ruedas luminosas, estela)
function neonWheel(ctx, x, y, r, col, t, flash) {
  glowDot(ctx, x, y, r * 2.1, flash ? 'rgba(255,255,255,0.6)' : col.glow);
  ctx.strokeStyle = flash ? '#ffffff' : col.main; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - 2.2, 0, Math.PI * 2); ctx.stroke();
  // radios giratorios
  ctx.strokeStyle = col.main; ctx.lineWidth = 0.8;
  const a0 = t / 3;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * Math.PI * 2 / 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); ctx.stroke();
  }
}
function drawMgrBike(ctx, f) {
  const t = f.frameTimer || 0;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const bob = f.empty ? 0 : Math.sin(t / 6) * 0.8;
  const col = { main: flash ? '#ffffff' : '#3de8ff', glow: 'rgba(61,232,255,0.55)' };
  const mag = flash ? '#ffffff' : '#ff3df0';
  const turbo = f.turbo ? 1.7 : 1;

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);
  const cy = -11 + bob;

  // propulsor trasero
  if (!f.empty) {
    for (let i = 0; i < 3; i++) {
      const lx = -30 - i * 7 * turbo - Math.random() * 3;
      ctx.globalAlpha = Math.max(0, 0.6 - i * 0.18);
      ctx.fillStyle = i === 0 ? '#e0ffff' : (i === 1 ? '#3de8ff' : '#ff3df0');
      ctx.beginPath(); ctx.moveTo(-24, cy + 4); ctx.lineTo(lx, cy + 2.6); ctx.lineTo(lx, cy + 5.4); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ruedas luminosas
  neonWheel(ctx, -17, cy + 6, 8, col, t, flash);
  neonWheel(ctx, 19, cy + 6, 8, col, t, flash);

  // carenado bajo y afilado
  const g = ctx.createLinearGradient(0, cy - 8, 0, cy + 8);
  g.addColorStop(0, flash ? '#fff' : '#12335a'); g.addColorStop(1, flash ? '#ddd' : '#050d22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(30, cy + 5);
  ctx.lineTo(20, cy - 3);
  ctx.lineTo(4, cy - 7);
  ctx.lineTo(-14, cy - 6);
  ctx.lineTo(-26, cy - 1);
  ctx.lineTo(-24, cy + 5);
  ctx.lineTo(-8, cy + 3);
  ctx.lineTo(10, cy + 3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col.main; ctx.lineWidth = 1.4; ctx.stroke();
  // vetas de luz
  ctx.strokeStyle = mag; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, cy); ctx.lineTo(8, cy - 3.5); ctx.lineTo(22, cy + 1); ctx.stroke();
  glowDot(ctx, 28, cy + 3, 6, 'rgba(255,255,255,0.9)');

  // piloto: MGR-01 agachado
  if (!f.empty) {
    const py = cy - 11;
    ctx.strokeStyle = flash ? '#fff' : '#168fa8';
    ctx.lineWidth = 2;
    branch(ctx, 2, py + 6, -0.9, 7, 1.6, 1, Math.sin(t / 5));
    ctx.strokeStyle = flash ? '#fff' : '#4ee6f2';
    branch(ctx, 3, py + 5, -0.5, 8, 1.6, 1, -Math.sin(t / 5));
    const pg = ctx.createLinearGradient(0, py - 8, 0, py + 8);
    pg.addColorStop(0, flash ? '#fff' : '#9ef0a8');
    pg.addColorStop(0.5, flash ? '#fff' : '#4ee6f2');
    pg.addColorStop(1, flash ? '#ddd' : '#168fa8');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(0, py, 6, 7.5, -0.35, 0, Math.PI * 2); ctx.fill();
    glowDot(ctx, -1, py + 2, 6, 'rgba(220,255,255,0.9)');
    ctx.fillStyle = '#06222c';
    ctx.beginPath(); ctx.ellipse(2.8, py - 3, 2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, py - 4.4, 1, 1);
  }
  ctx.restore();
}

// rival de luz: moto oscura con ruedas magenta, mira hacia la izquierda
function drawRider(ctx, x, y, t, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(-1, 1);
  const col = { main: '#ff4d6d', glow: 'rgba(255,77,109,0.5)' };
  const cy = -11;
  neonWheel(ctx, -15, cy + 6, 7, col, t, false);
  neonWheel(ctx, 16, cy + 6, 7, col, t, false);
  ctx.fillStyle = '#240818';
  ctx.beginPath();
  ctx.moveTo(26, cy + 5); ctx.lineTo(16, cy - 3); ctx.lineTo(2, cy - 8); ctx.lineTo(-12, cy - 6); ctx.lineTo(-22, cy); ctx.lineTo(-20, cy + 5);
  ctx.lineTo(-6, cy + 3); ctx.lineTo(8, cy + 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1.4; ctx.stroke();
  // jinete encapuchado
  ctx.fillStyle = '#12020c';
  ctx.beginPath(); ctx.ellipse(0, cy - 12, 5.5, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1; ctx.stroke();
  glowDot(ctx, 3, cy - 14, 4, 'rgba(255,200,210,0.9)');
  ctx.restore();
}

// fondo de la pista de neón (se mezcla sobre el escenario cuando se va en moto)
function drawNeonOverlay(ctx, camX, t, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#05011a'); g.addColorStop(0.55, '#1a0638'); g.addColorStop(1, '#030012');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // sol de neón con bandas
  const sx = 250, sy = 92;
  glowDot(ctx, sx, sy, 80, 'rgba(255,61,240,0.35)');
  ctx.fillStyle = '#ff7a3d';
  ctx.beginPath(); ctx.arc(sx, sy, 38, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#ff3df0';
  ctx.beginPath(); ctx.arc(sx, sy, 38, 0, Math.PI); ctx.rect(sx - 38, sy, 76, 0); ctx.fill();
  ctx.fillStyle = '#1a0638';
  for (let k = 0; k < 5; k++) ctx.fillRect(sx - 40, sy + 4 + k * 8, 80, 1.5 + k * 0.8);
  // horizonte de edificios de neón con paralaje
  ctx.fillStyle = '#0b0426';
  const off = (camX * 0.3) % 240;
  for (let i = -1; i < 4; i++) {
    for (let k = 0; k < 6; k++) {
      const bx = i * 240 - off + k * 40, bh = 18 + ((k * 37 + 11) % 5) * 9;
      ctx.fillRect(bx, LANE_TOP - 24 - bh, 32, bh + 24);
      ctx.fillStyle = (k % 2) ? 'rgba(61,232,255,0.7)' : 'rgba(255,61,240,0.7)';
      ctx.fillRect(bx, LANE_TOP - 24 - bh, 32, 1.2);
      ctx.fillStyle = '#0b0426';
    }
  }
  // suelo: cuadrícula en perspectiva
  const top = LANE_TOP - 24;
  const fg = ctx.createLinearGradient(0, top, 0, VIEW_H);
  fg.addColorStop(0, '#0a0430'); fg.addColorStop(1, '#14063a');
  ctx.fillStyle = fg; ctx.fillRect(0, top, VIEW_W, VIEW_H - top);
  ctx.strokeStyle = 'rgba(61,232,255,0.9)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(VIEW_W, top); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,61,240,0.5)'; ctx.lineWidth = 1;
  for (let k = 1; k <= 9; k++) {
    const y = top + Math.pow(k / 9, 1.8) * (VIEW_H - top);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke();
  }
  const cxv = VIEW_W / 2, sp = 48;
  const sc = (camX * 1.0) % sp;
  for (let k = -9; k <= 9; k++) {
    const bx = cxv + k * sp - sc;
    ctx.beginPath(); ctx.moveTo(cxv + (k * sp - sc) * 0.12, top); ctx.lineTo(bx * 1.0 + (bx - cxv) * 1.2, VIEW_H); ctx.stroke();
  }
  ctx.restore();
}

// ---------- ESCENARIO: Fosa de Ranvier con scroll y paralaje ----------
function drawStageScroll(ctx, camX, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#0c0430');
  grad.addColorStop(0.6, '#2a1260');
  grad.addColorStop(1, '#15093a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = 'rgba(124,92,255,0.20)';
  ctx.lineCap = 'round';
  const dOff = (camX * 0.25) % 260;
  for (let i = -1; i < 4; i++) {
    branch(ctx, i * 260 - dOff + 60, 170, -Math.PI / 2 + 0.2, 55, 4, 3, Math.sin(t / 60 + i));
  }

  const cy = 84;
  const spacing = 224;
  const mOff = (camX * 0.6) % spacing;
  for (let k = -1; k < 4; k++) {
    const cx = k * spacing - mOff + 10;
    const w = 150, h = 40;
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#8d7cf5'); g.addColorStop(0.35, '#5a3fc4'); g.addColorStop(1, '#2a1670');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 12, h / 2, 0, 0, Math.PI * 2);
    ctx.rect(cx, cy - h / 2, w, h);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w, cy, 12, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(190,170,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx + w, cy, 12, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,170,255,0.18)';
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(cx + 4, cy - h / 2 + j * 10); ctx.lineTo(cx + w, cy - h / 2 + j * 10); ctx.stroke(); }
    glowDot(ctx, cx + w + 32, cy, 15 + 3 * Math.sin(t / 14 + k), 'rgba(255,240,170,0.85)');
  }
  ctx.strokeStyle = 'rgba(240,230,255,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(VIEW_W, cy); ctx.stroke();

  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
  for (let i = 0; i < 9; i++) {
    const ix = ((i * 97 - camX * 0.85) % 430 + 430) % 430 - 20;
    const iy = 30 + ((i * 31) % 90) + Math.sin(t / 30 + i) * 5;
    const plus = i % 2 === 0;
    ctx.strokeStyle = plus ? 'rgba(244,114,182,0.9)' : 'rgba(96,165,250,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(plus ? '+' : '-', ix, iy + 3);
  }
  ctx.textAlign = 'left';

  const fg = ctx.createLinearGradient(0, LANE_TOP - 8, 0, VIEW_H);
  fg.addColorStop(0, '#3b2a8a'); fg.addColorStop(1, '#110a2e');
  ctx.fillStyle = fg;
  ctx.fillRect(0, LANE_TOP - 8, VIEW_W, VIEW_H - LANE_TOP + 8);
  ctx.strokeStyle = '#8b6cff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, LANE_TOP - 8); ctx.lineTo(VIEW_W, LANE_TOP - 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,140,255,0.22)'; ctx.lineWidth = 1;
  for (let y = LANE_TOP + 6; y < VIEW_H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(160,140,255,0.30)';
  const sOff = camX % 64;
  for (let i = -1; i < 8; i++) {
    const sx = i * 64 - sOff;
    ctx.beginPath(); ctx.moveTo(sx, LANE_TOP - 6); ctx.lineTo(sx - 14, VIEW_H); ctx.stroke();
  }
}


// ---------- ESCENARIO TRAMO 2: Vía Periférica (verde esmeralda, axón periférico) ----------
function drawStageScrollPeri(ctx, camX, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#021a1c');
  grad.addColorStop(0.6, '#0a3a34');
  grad.addColorStop(1, '#04211f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // filamentos lejanos
  ctx.strokeStyle = 'rgba(110,231,183,0.14)';
  ctx.lineCap = 'round';
  const dOff = (camX * 0.22) % 300;
  for (let i = -1; i < 4; i++) {
    branch(ctx, i * 300 - dOff + 80, 165, -Math.PI / 2 - 0.15, 48, 3.4, 3, Math.sin(t / 65 + i));
  }

  // banda del axón periférico con segmentos de Schwann
  const cy = 82;
  const spacing = 190;
  const mOff = (camX * 0.6) % spacing;
  for (let k = -1; k < 5; k++) {
    const cx = k * spacing - mOff;
    const w = 120, h = 34;
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#5eead4'); g.addColorStop(0.35, '#0d9488'); g.addColorStop(1, '#04423c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, h / 2, 0, 0, Math.PI * 2);
    ctx.rect(cx, cy - h / 2, w, h);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w, cy, 10, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(167,243,208,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx + w, cy, 10, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(167,243,208,0.16)';
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(cx + 4, cy - h / 2 + j * 8); ctx.lineTo(cx + w, cy - h / 2 + j * 8); ctx.stroke(); }
    glowDot(ctx, cx + w + 26, cy, 12 + 3 * Math.sin(t / 13 + k), 'rgba(190,255,220,0.8)');
  }
  ctx.strokeStyle = 'rgba(220,255,240,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(VIEW_W, cy); ctx.stroke();

  // iones a la deriva
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
  for (let i = 0; i < 9; i++) {
    const ix = ((i * 89 - camX * 0.85) % 430 + 430) % 430 - 20;
    const iy = 28 + ((i * 37) % 92) + Math.sin(t / 28 + i) * 5;
    const plus = i % 2 === 0;
    ctx.strokeStyle = plus ? 'rgba(94,234,212,0.9)' : 'rgba(250,204,21,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(plus ? '+' : '-', ix, iy + 3);
  }
  ctx.textAlign = 'left';

  // suelo de la banda de juego
  const fg = ctx.createLinearGradient(0, LANE_TOP - 8, 0, VIEW_H);
  fg.addColorStop(0, '#14534a'); fg.addColorStop(1, '#031a16');
  ctx.fillStyle = fg;
  ctx.fillRect(0, LANE_TOP - 8, VIEW_W, VIEW_H - LANE_TOP + 8);
  ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, LANE_TOP - 8); ctx.lineTo(VIEW_W, LANE_TOP - 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(110,231,183,0.2)'; ctx.lineWidth = 1;
  for (let y = LANE_TOP + 6; y < VIEW_H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(110,231,183,0.28)';
  const sOff = camX % 64;
  for (let i = -1; i < 8; i++) {
    const sx = i * 64 - sOff;
    ctx.beginPath(); ctx.moveTo(sx, LANE_TOP - 6); ctx.lineTo(sx - 14, VIEW_H); ctx.stroke();
  }
}

// ---------- ENTIDADES ----------
function laneScale(lane) {
  return 0.8 + ((lane - LANE_TOP) / (LANE_BOTTOM - LANE_TOP)) * 0.35;
}

class Player {
  constructor() { this.kind = 'mgr'; this.name = 'MGR-01'; this.reset(80); }
  reset(x) {
    this.x = x; this.lane = 182; this.z = 0; this.vz = 0;
    this.conexion = 100; this.energia = 100;
    this.facingRight = true;
    this.state = 'IDLE';
    this.frameTimer = 0;
    this.attackFrame = 0;
    this.comboStage = 0;
    this.comboQueued = false;
    this.attackKind = null;
    this.hitSet = new Set();
    this.currentAnim = 'idle1';
    this.guarding = false;
    this.ballCooldown = 0;
    this.stateTimer = 0;
    this.weapon = null; // { name, dur } — ENZIMA-L recogible
    this.vehicle = null; // { integrity } — MOTO-V mientras dura el tramo de vuelo
    this.turbo = false;
  }
}

class Grunt {
  constructor(x, lane, big, type) {
    this.kind = 'grunt';
    this.type = type || 'melee';
    this.big = !!big && this.type === 'melee';
    this.x = x; this.lane = lane; this.z = 0; this.vz = 0;
    if (this.type === 'cito') { this.hp = 20; this.speed = 1.0; this.dmg = 9; this.reach = 26; }
    else if (this.type === 'radical') { this.hp = 14; this.speed = 1.7; this.dmg = 5; this.reach = 24; }
    else if (this.type === 'plasma') { this.hp = 24; this.speed = 0.6; this.dmg = 8; this.reach = 0; }
    else { this.hp = this.big ? 55 : 26; this.speed = this.big ? 0.55 : 0.9; this.dmg = this.big ? 12 : 8; this.reach = this.big ? 36 : 28; }
    this.maxHp = this.hp;
    this.facingRight = false;
    this.state = 'WALK'; // WALK, WINDUP, STRIKE, RECOVER, HITSTUN, DYING
    this.frameTimer = Math.floor(Math.random() * 40);
    this.stateTimer = 0;
    this.attackFrame = 0;
    this.currentAnim = 'idle1';
    this.hasHit = false;
    this.kx = 0;
    this.jumpCd = 60 + Math.floor(Math.random() * 60); // cito
    this.fireCd = 90 + Math.floor(Math.random() * 50);  // plasma
  }
}

class Boss {
  constructor(x, lane) {
    this.kind = 'macro'; this.name = 'MACRO-L1'; this.isBoss = true; this.dyingFrames = 70;
    this.x = x; this.lane = lane; this.z = 0;
    this.hp = 160; this.maxHp = 160;
    this.facingRight = false;
    this.state = 'WALK'; // WALK, WINDUP, STRIKE, RECOVER, HITSTUN, DASH, DYING
    this.frameTimer = 0;
    this.stateTimer = 0;
    this.attackFrame = 0;
    this.attackKind = null; // 'punch' | 'smash'
    this.currentAnim = 'idle1';
    this.hasHit = false;
    this.dashCooldown = 0;
    this.dashVx = 0;
  }
  get enraged() { return this.hp < 64; }
}

// PLACA-0: agregado tóxico. Flota, dispara glóbulos y suelta agresores.
class PlacaBoss {
  constructor(x, lane) {
    this.kind = 'placa'; this.name = 'PLACA-0'; this.isBoss = true; this.dyingFrames = 90;
    this.x = x; this.lane = lane; this.z = 0;
    this.hp = 220; this.maxHp = 220;
    this.facingRight = false;
    this.state = 'WALK'; // WALK, WINDUP, STRIKE, SPAWN, RECOVER, HITSTUN, DYING
    this.frameTimer = 0;
    this.stateTimer = 0;
    this.currentAnim = 'idle1';
    this.shotCd = 120;
    this.spawnCd = 300;
    this.contactCd = 0;
  }
  get enraged() { return this.hp < 88; }
}

// ---------- CINEMÁTICA INICIAL (attract: noir western, láminas ilustradas originales) ----------
// Motion comic: láminas ilustradas con movimiento de cámara lento, bandas
// letterbox, grano y viñeta. Las láminas se precargan antes de arrancar la
// secuencia para que ninguna escena empiece en negro.
const CINE_SRCS = ['cine/frontera.jpg', 'cine/guardianes.jpg', 'cine/extrano.jpg', 'cine/duelo.jpg', 'cine/amenazas.jpg', 'cine/emblema.jpg'];
let cineLoaded = 0;
const CINE_IMGS = CINE_SRCS.map(src => {
  const im = new Image();
  im.onload = () => { cineLoaded++; };
  im.onerror = () => { cineLoaded++; }; // si una falta, no bloquear el arranque
  im.src = src;
  return im;
});
const cineReady = () => cineLoaded >= CINE_SRCS.length;
const CINE_BAR = Math.round(VIEW_H * 0.115); // bandas letterbox

// grano de película reutilizable
const cineGrain = document.createElement('canvas');
cineGrain.width = 192; cineGrain.height = 108;
function refillCineGrain() {
  const g = cineGrain.getContext('2d');
  const img = g.createImageData(192, 108);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 46;
  }
  g.putImageData(img, 0, 0);
}

// encuadre "cover" con zoom suave hacia un punto de foco (fx, fy en fracción de imagen)
function drawCineKB(ctx, img, t, dur, fx, fy, s0, s1, dy = 0) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!img.complete || !img.naturalWidth) return;
  const p = Math.min(1, t / dur);
  const e = p * p * (3 - 2 * p);
  const z = s0 + (s1 - s0) * e;
  const base = Math.max(VIEW_W / img.naturalWidth, VIEW_H / img.naturalHeight);
  const sc = base * z;
  ctx.save();
  ctx.translate(VIEW_W * fx, VIEW_H * (fy + dy));
  ctx.scale(sc, sc);
  ctx.drawImage(img, -img.naturalWidth * fx, -img.naturalHeight * fy);
  ctx.restore();
}

function cineCaption(ctx, line1, line2) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8ddc8';
  ctx.font = 'bold 9px monospace';
  ctx.fillText(line1, VIEW_W / 2, VIEW_H - CINE_BAR + 12);
  ctx.fillStyle = 'rgba(214,200,175,0.85)';
  ctx.font = '8px monospace';
  ctx.fillText(line2, VIEW_W / 2, VIEW_H - CINE_BAR + 21);
  ctx.textAlign = 'left';
}

const CINE_SCENES = [
  { // 1 · La frontera: el axón como camino bajo una luna enorme
    dur: 300,
    cap: ['EN LA FRONTERA DEL SISTEMA NERVIOSO', 'un territorio donde la señal debe seguir viva'],
    draw(ctx, t) { drawCineKB(ctx, CINE_IMGS[0], t, 300, 0.55, 0.32, 1.02, 1.15); }
  },
  { // 2 · Los guardianes perdieron el rumbo: contrapicado del ataque a la conexión
    dur: 340,
    cap: ['SUS GUARDIANES PERDIERON EL RUMBO', 'las defensas atacan la conexión que debían proteger'],
    draw(ctx, t) { drawCineKB(ctx, CINE_IMGS[1], t, 340, 0.32, 0.62, 1.06, 1.26); }
  },
  { // 3 · El extraño: contrapicado heroico, la cámara sube del suelo a su rostro
    dur: 300,
    cap: ['ENTONCES LLEGÓ UN EXTRAÑO', 'MGR-01 · microglía reprogramada'],
    draw(ctx, t) {
      const p = Math.min(1, t / 300);
      const e = p * p * (3 - 2 * p);
      drawCineKB(ctx, CINE_IMGS[2], t, 300, 0.49, 0.093, 1.02, 2.10, 0.127 + 0.100 * e);
    }
  },
  { // 4 · El ajuste de cuentas: duelo de miradas
    dur: 330,
    cap: ['MACRO-L1 Y PLACA-0 LE ESPERAN', 'en la vía periférica se hará justicia'],
    draw(ctx, t) { drawCineKB(ctx, CINE_IMGS[3], t, 330, 0.50, 0.52, 1.05, 1.22); }
  },
  { // 5 · Las que vienen: amenazas futuras insinuadas en la cresta
    dur: 300,
    cap: ['Y NO ESTABAN SOLOS', 'otras sombras aguardan en la vía periférica'],
    draw(ctx, t) { drawCineKB(ctx, CINE_IMGS[4], t, 300, 0.50, 0.32, 1.02, 1.05); }
  },
  { // 6 · Título
    dur: 340,
    band: 'Protege la conexión entre neuronas.',
    draw(ctx, t) {
      drawCineKB(ctx, CINE_IMGS[5], t, 340, 0.50, 0.52, 1.04, 1.14);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // banda de gradación suave tras el bloque del título
      const g = ctx.createLinearGradient(0, VIEW_H * 0.26, 0, VIEW_H * 0.64);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.35, 'rgba(0,0,0,0.74)');
      g.addColorStop(0.72, 'rgba(0,0,0,0.74)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, VIEW_H * 0.26, VIEW_W, VIEW_H * 0.38);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8ddc8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('NEURO-FIGHTER', VIEW_W / 2, VIEW_H * 0.42);
      ctx.fillStyle = '#f0c078';
      ctx.fillRect(VIEW_W / 2 - 60, VIEW_H * 0.455, 120, 1);
      ctx.fillStyle = '#d9a05b';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('A  V  A  N  C  E', VIEW_W / 2, VIEW_H * 0.53);
      ctx.textAlign = 'left';
    }
  },
];

function drawCinematic(ctx, cine) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // precarga: la secuencia no arranca hasta tener todas las láminas
  if (!cineReady()) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ddc8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('CARGANDO…', VIEW_W / 2, VIEW_H / 2);
    ctx.textAlign = 'left';
    return;
  }
  const sc = CINE_SCENES[cine.scene] || CINE_SCENES[0];
  ctx.save();
  sc.draw(ctx, cine.t);
  ctx.restore();
  // fundidos entre escenas
  const fade = 26;
  const a = 1 - Math.min(Math.min(1, cine.t / fade), Math.min(1, (sc.dur - cine.t) / fade));
  if (a > 0) { ctx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  // bandas letterbox
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, CINE_BAR);
  ctx.fillRect(0, VIEW_H - CINE_BAR, VIEW_W, CINE_BAR);
  // rótulos sobre la banda negra inferior, contraste pleno
  if (sc.cap) cineCaption(ctx, sc.cap[0], sc.cap[1]);
  if (sc.band) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ddc8';
    ctx.font = '8px monospace';
    ctx.fillText(sc.band, VIEW_W / 2, VIEW_H - CINE_BAR + 13);
    ctx.textAlign = 'left';
  }
  // grano de película
  if (cine.t % 3 === 0) refillCineGrain();
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(cineGrain, 0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  // viñeta
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // pista de inicio sobre la banda superior
  ctx.fillStyle = 'rgba(232,221,200,0.55)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('PULSA UNA TECLA PARA JUGAR', VIEW_W - 8, CINE_BAR - 8);
  ctx.textAlign = 'left';
}

// ---------- BANDA SONORA DE LA CINEMÁTICA (arreglo noir original del tema de la partida) ----------
// El tema real de la partida (MUSIC_TRACKS.main) tres veces más lento, con viento,
// drone en la tónica y disonancia de tritono en las escenas tensas. Suena en el
// attract y en la intro cuando el audio ya está desbloqueado por el jugador;
// respeta el silencio (M) al ir por el mismo bus de música. La música de la
// partida no cambia.
class CineScore {
  constructor() { this.started = false; this.timer = null; this.step = 0; this.nextT = 0; this.lastThump = -1; this.nodes = null; }
  start(sfx) {
    if (this.started) return;
    const ctx = sfx.ctx;
    if (!ctx || ctx.state !== 'running' || !sfx.noiseBuffer) return;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(sfx.musicBus);
    // viento: ruido filtrado con LFO (reutiliza el buffer de ruido del motor)
    const noise = ctx.createBufferSource();
    noise.buffer = sfx.noiseBuffer; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.028;
    lfo.connect(lfoG); lfoG.connect(ng.gain);
    noise.connect(bp); bp.connect(ng); ng.connect(master);
    noise.start(); lfo.start();
    // drone en la tónica (la1, como el bajo del tema)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
    const dg = ctx.createGain(); dg.gain.value = 0.055;
    lp.connect(dg); dg.connect(master);
    const drones = [55, 55.4].map(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    // disonancia de tritono, crece en las escenas tensas
    const disGain = ctx.createGain(); disGain.gain.value = 0.012; disGain.connect(master);
    const dis = [77.78, 78.3].map(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(disGain); o.start(); return o; });
    this.nodes = { master, noise, lfo, drones, dis, disGain };
    this.nextT = ctx.currentTime + 0.15;
    this.step = 0;
    this.timer = setInterval(() => this.tick(sfx), 60);
    this.started = true;
  }
  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const n = this.nodes;
    this.nodes = null;
    if (n) {
      try { n.master.gain.setTargetAtTime(0, n.master.context.currentTime, 0.1); } catch (e) {}
      setTimeout(() => {
        try { n.noise.stop(); n.lfo.stop(); n.drones.forEach(o => o.stop()); n.dis.forEach(o => o.stop()); n.master.disconnect(); } catch (e) {}
      }, 400);
    }
  }
  tone(sfx, freq, at, dur, vol, type) {
    const ctx = sfx.ctx; const master = this.nodes && this.nodes.master;
    if (!ctx || !master) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const vib = ctx.createOscillator(); vib.frequency.value = 4.6;
    const vibG = ctx.createGain(); vibG.gain.value = freq * 0.005;
    vib.connect(vibG); vibG.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.linearRampToValueAtTime(vol, at + Math.min(0.4, dur * 0.3));
    g.setValueAtTime(vol, at + dur * 0.65);
    g.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.05);
    vib.start(at); vib.stop(at + dur + 0.05);
  }
  tick(sfx) {
    const ctx = sfx.ctx;
    if (!this.started || !ctx || ctx.state !== 'running') return;
    const spb = 60 / 42 / 4; // la partida suena a 132: mismo tema, tres veces más lento
    if (this.nextT < ctx.currentTime - 0.3) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      const e = MUSIC_TRACKS.main.lead[this.step];
      if (e) {
        const dur = e[1] * spb * 1.15;
        this.tone(sfx, 440 * Math.pow(2, (e[0] - 69) / 12), this.nextT, dur, 0.12, 'sine');
        this.tone(sfx, 440 * Math.pow(2, (e[0] - 12 - 69) / 12), this.nextT, dur, 0.05, 'triangle');
      }
      this.nextT += spb;
      this.step = (this.step + 1) % 64;
    }
  }
  update(sfx, scene, frame) {
    if (!this.started) this.start(sfx);
    if (!this.started || !this.nodes) return;
    const ctx = sfx.ctx;
    // más disonancia en el ataque de los guardianes y en el duelo
    const target = (scene === 1 || scene === 3) ? 0.075 : 0.012;
    this.nodes.disGain.gain.setTargetAtTime(target, ctx.currentTime, 1.2);
    // pulso de tensión en el duelo
    if (scene === 3) {
      const beat = Math.floor(frame / 72);
      if (beat !== this.lastThump && frame % 72 === 0) {
        this.lastThump = beat;
        this.tone(sfx, 52, ctx.currentTime, 0.35, 0.20, 'sine');
      }
    }
  }
}

// ---------- JUEGO ----------
class Game {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new SoundEngine();
    this.cineScore = new CineScore();
    this.inputs = {};
    this.showHitboxes = false;
    this.t = 0;
    this.uPress = false; this.iPress = false; this.spacePress = false;
    this.stageIdx = 0;
    this.resetWorld();
    this.cine = { scene: 0, t: 0 };
    this.introIdle = 0;
    this.state = 'attract'; // attract, intro, play, interlude, lost, won
    this.bindEvents();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resetWorld() {
    this.player = new Player();
    this.loadStage(0, false);
  }

  loadStage(idx, keepWeapon) {
    const S = STAGES[idx];
    const savedWeapon = (keepWeapon && this.player) ? this.player.weapon : null;
    this.stageIdx = idx;
    this.worldW = S.worldW;
    this.player.reset(80);
    if (savedWeapon) this.player.weapon = savedWeapon;
    this.enemies = [];
    this.projectiles = [];
    this.enemyShots = [];
    this.pickups = [];
    this.checkpoints = [];
    this.weapons = S.weapons.map(w => ({ x: w.x, lane: w.lane, taken: false }));
    this.hazards = S.hazards.map(h => ({ x: h.x, lane: h.lane, hit: false }));
    this.repairs = (S.repairs || []).map(r => ({ x: r.x, lane: r.lane, taken: false }));
    this.riders = [];
    this.trails = [];
    this.riderTimer = 160;
    this.cuts = 0;
    this.lastTrailX = -999;
    this.flight = 0;
    this.vehiclePad = S.vehiclePad ? { x: S.vehiclePad.x, lane: S.vehiclePad.lane, taken: false } : null;
    this.dismountX = S.dismountX;
    this.rideSpawnTimer = 40;
    this.turboTimer = 0;
    this.camX = 0;
    this.lockActive = false;
    this.boss = null;
    this.bossActive = false;
    this.activeWaveTrig = null;
    this.shake = 0;
    this.toast = null;
    this.zoneIdx = -1;
    this.triggers = S.triggers.map(tr => ({ x: tr.x, type: tr.type, boss: tr.boss, done: false, waves: tr.waves ? tr.waves.map(w => ({ t: w.t, big: w.big })) : null }));
    this.zones = S.zones;
    this.state = 'play';
    this.showToast(S.name, 140);
  }

  bindEvents() {
    const start = () => {
      this.audio.init();
      if (this.state === 'attract') { this.state = 'intro'; this.introIdle = 0; this.cine = { scene: 0, t: 0 }; }
      else if (this.state === 'intro') this.state = 'play';
    };
    window.addEventListener('pointerdown', start);
    // Si la ventana pierde el foco con una tecla pulsada, el keyup se pierde y la
    // tecla queda "atascada": limpiar entradas al perder el foco u ocultarse.
    const clearInputs = () => { for (const k in this.inputs) this.inputs[k] = false; this.uPress = this.iPress = this.spacePress = false; };
    window.addEventListener('blur', clearInputs);
    document.getElementById('sound-toggle')?.addEventListener('click', () => { this.audio.init(); this.audio.toggleMute(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearInputs(); this.audio.music.stopTrack(); if (this.audio.ctx?.state === 'running') this.audio.ctx.suspend().catch(() => {}); }
      else if (this.audio.ctx) { this.audio.music.nextT = this.audio.ctx.currentTime + 0.08; this.audio.init(); }
    });
    window.addEventListener('keydown', (e) => {
      start();
      if (e.key === ' ') e.preventDefault();
      if (!this.inputs[e.key]) {
        if (e.key === 'u' || e.key === 'U') this.uPress = true;
        if (e.key === 'i' || e.key === 'I') this.iPress = true;
        if (e.key === ' ') this.spacePress = true;
      }
      this.inputs[e.key] = true;
      if ((e.key === 'm' || e.key === 'M') && !e.repeat) this.audio.toggleMute();
      if (e.key === 'h' || e.key === 'H') this.showHitboxes = !this.showHitboxes;
      if (e.key === 'Enter') {
        if (this.state === 'lost' || this.state === 'won') this.resetWorld();
        else if (this.state === 'interlude') this.loadStage(this.stageIdx + 1, true);
      }
    });
    window.addEventListener('keyup', (e) => { this.inputs[e.key] = false; });

    document.querySelectorAll('.tbtn').forEach(btn => {
      const key = btn.dataset.key;
      const on = (e) => {
        e.preventDefault();
        start();
        if (!this.inputs[key]) {
          if (key === 'u') this.uPress = true;
          if (key === 'i') this.iPress = true;
          if (key === ' ') this.spacePress = true;
        }
        this.inputs[key] = true;
        btn.classList.add('active');
      };
      const off = (e) => {
        e.preventDefault();
        this.inputs[key] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
    });
    this.canvas.addEventListener('touchstart', () => {
      if (this.state === 'lost' || this.state === 'won') this.resetWorld();
      else if (this.state === 'interlude') this.loadStage(this.stageIdx + 1, true);
    }, { passive: true });
  }

  showToast(text, frames) { this.toast = { text, timer: frames || 150 }; }

  spawnWave(trig) {
    const p = this.player;
    trig.waves.forEach((w, i) => {
      const ahead = i % 2 === 0;
      const ex = p.x + (ahead ? 70 + i * 45 : -60 - i * 30);
      const lane = LANE_TOP + 10 + ((i * 37) % (LANE_BOTTOM - LANE_TOP - 16));
      this.enemies.push(new Grunt(Math.max(this.camX + 20, Math.min(this.camX + VIEW_W - 20, ex)), lane, w.big, w.t));
    });
    this.lockActive = true;
    this.activeWaveTrig = trig;
    this.showToast('¡ZONA BLOQUEADA! DESPEJA LA OLEADA', 120);
  }

  spawnRideEnemy() {
    const types = ['melee', 'melee', 'cito', 'radical'];
    const ty = types[Math.floor(Math.random() * types.length)];
    const lane = LANE_TOP + 8 + Math.random() * (LANE_BOTTOM - LANE_TOP - 16);
    this.enemies.push(new Grunt(this.camX + VIEW_W + 24 + Math.random() * 40, lane, false, ty));
  }

  updateRiders() {
    const p = this.player;
    // desvanecer estelas
    this.trails.forEach(t => { t.life--; });
    this.trails = this.trails.filter(t => t.life > 0 && t.x > this.camX - 80);
    this.riders.forEach(r => {
      if (r.dead) { r.t++; return; }
      r.t++;
      r.x -= 2.5;
      // Avistan al piloto de lejos, pero fijan el carril al acercarse.
      if (p.vehicle && r.x - p.x > 130) {
        const dl = p.lane - r.lane;
        r.lane += Math.max(-0.18, Math.min(0.18, dl * 0.025));
      }
      r.lane = Math.max(LANE_TOP + 4, Math.min(LANE_BOTTOM - 4, r.lane));
      if (Math.abs(r.x - r.lastX) >= 6) {
        this.trails.push({ x: r.x + 14, lane: r.lane, life: 100, own: false, rider: r });
        r.lastX = r.x;
      }
      if (!p.vehicle) return;
      // choque frontal: la moto destruye al rival sin daño
      if (Math.abs(r.x - p.x) < 24 && Math.abs(r.lane - p.lane) < 13 && p.z < 18) {
        this.derez(r, false);
        return;
      }
      // estela propia atravesada: corte limpio
      for (let i = 0; i < this.trails.length; i++) {
        const t = this.trails[i];
        if (t.own && Math.abs(t.x - r.x) < 8 && Math.abs(t.lane - r.lane) < 10) { this.derez(r, true); break; }
      }
    });
    this.riders = this.riders.filter(r => (r.dead ? r.t < 30 : r.x > this.camX - 60));
    // estelas rivales contra la moto
    if (p.vehicle) {
      for (let i = 0; i < this.trails.length; i++) {
        const t = this.trails[i];
        if (t.own || t.life <= 0 || p.vehicle.hitCooldown > 0) continue;
        if (Math.abs(t.x - p.x) < 9 && Math.abs(t.lane - p.lane) < 9 && p.z < 16) {
          this.trails.forEach(o => { if (!o.own && Math.abs(o.x - t.x) < 16 && Math.abs(o.lane - t.lane) < 12) o.life = 0; });
          this.damageVehicle(6);
          break;
        }
      }
    }
  }

  derez(r, byTrail) {
    r.dead = true; r.t = 0;
    // su estela se disuelve
    this.trails.forEach(t => { if (t.rider === r) t.life = 0; });
    this.audio.hit();
    if (byTrail) { this.cuts++; this.showToast('¡CORTE! RIVAL ELIMINADO', 70); }
  }

  clearWave(trig) {
    trig.done = true;
    this.lockActive = false;
    const cx = trig.x + 90;
    this.checkpoints.push({ x: cx, lane: LANE_BOTTOM - 4, used: false });
    this.pickups.push({ x: cx + 55, lane: LANE_TOP + 24, taken: false });
    this.pickups.push({ x: cx + 110, lane: LANE_BOTTOM - 18, taken: false });
    this.showToast('ZONA DESPEJADA · AVANZA →', 150);
    this.audio.checkpoint();
  }

  spawnBoss(trig) {
    trig.done = true;
    this.lockActive = true;
    if (trig.boss === 'placa') {
      this.boss = new PlacaBoss(trig.x + 230, 178);
      this.showToast('¡PLACA-0 BLOQUEA LA CONEXIÓN!', 160);
    } else {
      this.boss = new Boss(1560, 178);
      this.showToast('¡MACRO-L1 BLOQUEA LA CONEXIÓN!', 160);
    }
    this.bossActive = true;
  }

  // Una sola fuente de daño para la moto: ningún roce encadena impactos.
  damageVehicle(dmg) {
    const v = this.player.vehicle;
    if (!v || v.hitCooldown > 0) return;
    v.integrity = Math.max(0, v.integrity - dmg);
    v.hitCooldown = 90; // 1,5 s para recuperar el control, también entre fuentes distintas
    this.shake = 4;
    this.audio.hit();
    if (v.integrity <= 0) {
      this.player.vehicle = null;
      this.player.turbo = false;
      this.audio.weaponBreak();
      this.showToast('MOTO-V DESTRUIDA · SIGUE A PIE', 120);
    }
  }

  hitPlayer(dmg, fromX) {
    const p = this.player;
    if (this.state !== 'play') return;
    if (p.vehicle) {
      // La moto absorbe el golpe, sin el antiguo multiplicador x2.
      this.damageVehicle(dmg);
      return;
    }
    if (p.guarding) {
      p.conexion = Math.max(0, p.conexion - Math.round(dmg * 0.2));
      this.audio.position(p.x, this.camX); this.audio.block();
    } else {
      p.conexion = Math.max(0, p.conexion - dmg);
      p.state = 'HITSTUN';
      p.stateTimer = 0;
      p.currentAnim = 'idle1';
      this.audio.position(p.x, this.camX); this.audio.hit();
      this.shake = 5;
    }
    if (p.conexion <= 0) {
      this.state = 'lost';
      this.audio.ko();
    }
  }

  hitEnemy(e, dmg, fromX, knock) {
    if (e.state === 'DYING') return;
    e.hp -= dmg;
    e.hasHit = false;
    if (e.hp <= 0) {
      e.state = 'DYING';
      e.stateTimer = 0;
      if (Math.random() < (e.big ? 1 : 0.35)) this.weapons.push({ x: e.x, lane: e.lane, taken: false });
    } else {
      e.state = 'HITSTUN';
      e.stateTimer = 0;
      e.kx = (e.x >= fromX ? 1 : -1) * knock;
    }
    this.audio.position(e.x, this.camX); this.audio.hit(!!e.big);
  }

  hitBoss(dmg, fromX, knock) {
    const b = this.boss;
    if (!b || b.state === 'DYING') return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      b.state = 'DYING';
      b.stateTimer = 0;
      this.shake = 8;
      this.audio.ko();
    } else {
      b.state = 'HITSTUN';
      b.stateTimer = 0;
      b.x += (b.x >= fromX ? 1 : -1) * Math.min(knock, 2);
    }
    this.audio.position(b.x, this.camX); this.audio.hit(true);
  }

  // --- actualización por frame ---
  update() {
    this.t++;
    this.audio.position(this.player.x, this.camX);
    this.audio.musicEnsure(this.state === 'play' ? (this.bossActive ? 'boss' : (this.player.vehicle ? 'neon' : 'main')) : null);
    // banda sonora noir de la cinemática: solo attract/intro; la partida usa sus pistas de siempre
    if (this.state === 'attract' || this.state === 'intro') {
      this.cineScore.update(this.audio, this.state === 'attract' ? this.cine.scene : -1, this.state === 'attract' ? this.cine.t : 0);
    } else {
      this.cineScore.stop();
    }

    if (this.state === 'attract') {
      if (!cineReady()) { this.uPress = this.iPress = this.spacePress = false; return; }
      const sc = CINE_SCENES[this.cine.scene];
      this.cine.t++;
      if (this.cine.t >= sc.dur) {
        this.cine.scene++;
        this.cine.t = 0;
        if (this.cine.scene >= CINE_SCENES.length) {
          this.cine.scene = 0;
          this.state = 'intro';
          this.introIdle = 0;
        }
      }
      this.uPress = this.iPress = this.spacePress = false;
      return;
    }
    if (this.state === 'intro') {
      // modo recreativa: si nadie pulsa, vuelve la cinemática
      this.introIdle++;
      if (this.introIdle > 840) {
        this.introIdle = 0;
        this.cine = { scene: 0, t: 0 };
        this.state = 'attract';
      }
      this.uPress = this.iPress = this.spacePress = false;
      return;
    }
    if (this.state === 'interlude') {
      this.interludeTimer--;
      if (this.interludeTimer <= 0) this.loadStage(this.stageIdx + 1, true);
      return;
    }
    if (this.state !== 'play') { this.uPress = this.iPress = this.spacePress = false; return; }

    const p = this.player;
    p.frameTimer++;
    if (this.toast && --this.toast.timer <= 0) this.toast = null;
    if (this.shake > 0) this.shake--;
    if (p.ballCooldown > 0) p.ballCooldown--;
    p.energia = Math.min(100, p.energia + 0.12);

    for (let i = this.zones.length - 1; i >= 0; i--) {
      if (p.x >= this.zones[i].x) {
        if (i > this.zoneIdx) { this.zoneIdx = i; this.showToast(this.zones[i].name, 130); }
        break;
      }
    }

    const left = this.inputs['a'] || this.inputs['A'];
    const right = this.inputs['d'] || this.inputs['D'];
    const upLane = this.inputs['w'] || this.inputs['W'];
    const downLane = this.inputs['s'] || this.inputs['S'];
    const guard = this.inputs['o'] || this.inputs['O'];

    // gravedad del salto
    if (p.z > 0 || p.vz !== 0) {
      p.vz += 0.5;
      p.z -= p.vz;
      if (p.z <= 0) { p.z = 0; p.vz = 0; if (p.state === 'JUMP') p.state = 'IDLE'; }
    }

    if (p.vehicle) {
      // ----- MOTO-V: vuelo rasante que arrasa a la multitud -----
      if (p.vehicle.hitCooldown > 0) p.vehicle.hitCooldown--;
      p.guarding = false;
      p.currentAnim = 'ride';
      p.facingRight = true;
      let spd = 3.4;
      if (left) spd = 2.2;
      if (right) spd = 5.0;
      if (this.uPress && p.energia >= 20 && this.turboTimer === 0) {
        p.energia -= 20;
        this.turboTimer = 40;
        this.audio.boost();
      }
      if (this.turboTimer > 0) { spd += 2.6; this.turboTimer--; }
      p.turbo = this.turboTimer > 0;
      if (upLane) p.lane -= 2.2;
      if (downLane) p.lane += 2.2;
      if (this.spacePress && p.z === 0) { p.vz = -7.5; p.z = 0.1; this.audio.jump(); }
      p.x += spd;
      this.uPress = false; this.iPress = false; this.spacePress = false;

      // atropello: la moto barre a los agresores que toca
      this.enemies.forEach(e => {
        if (e.state === 'DYING') return;
        if (Math.abs(e.x - p.x) < 22 && Math.abs(e.lane - p.lane) < 15 && p.z < 18 && (e.z || 0) < 20) {
          this.hitEnemy(e, 999, p.x - 10, 7);
          this.shake = 3;
        }
      });
      // agregados fijos: dañan la moto si no se saltan o esquivan
      this.hazards.forEach(hz => {
        if (hz.hit || !p.vehicle) return;
        if (Math.abs(p.x - hz.x) < 16 && Math.abs(p.lane - hz.lane) < 12 && p.z < 16) {
          hz.hit = true;
          this.damageVehicle(12);
        }
      });
      // repuestos de integridad en la pista
      this.repairs.forEach(r => {
        if (r.taken || !p.vehicle) return;
        if (Math.abs(p.x - r.x) < 20 && Math.abs(p.lane - r.lane) < 30) {
          r.taken = true;
          p.vehicle.integrity = Math.min(100, p.vehicle.integrity + 35);
          this.audio.pickup();
          this.showToast('+ INTEGRIDAD DE LA MOTO', 80);
        }
      });
      // estela propia: rastro de luz que corta el paso a los rivales
      if (p.vehicle && p.x - this.lastTrailX >= 5) {
        this.trails.push({ x: p.x - 18, lane: p.lane + 1, life: 80, own: true });
        this.lastTrailX = p.x;
      }
      // rivales de luz y sus estelas
      if (p.vehicle && p.x > 1720 && p.x < this.dismountX - 280) {
        this.riderTimer--;
        if (this.riderTimer <= 0) {
          this.riders.push({ x: this.camX + VIEW_W + 30, lane: LANE_TOP + 8 + Math.random() * (LANE_BOTTOM - LANE_TOP - 16), dead: false, t: 0, lastX: 0 });
          this.riderTimer = 210 + Math.floor(Math.random() * 70);
        }
      }
      this.updateRiders();
      // multitud durante el vuelo (menos densa: los rivales son el reto principal)
      if (p.vehicle && p.x < this.dismountX - 60) {
        this.rideSpawnTimer--;
        if (this.rideSpawnTimer <= 0) {
          this.spawnRideEnemy();
          // Sin doble aparición: la pista ya tiene rivales y barreras.
          this.rideSpawnTimer = 180 + Math.floor(Math.random() * 60);
        }
      }
      // fin del tramo de vuelo
      if (p.vehicle && p.x >= this.dismountX) {
        p.vehicle = null;
        p.turbo = false;
        p.x = this.dismountX;
        this.checkpoints.push({ x: this.dismountX, lane: LANE_BOTTOM - 4, used: false });
        this.audio.checkpoint();
        this.showToast('FIN DEL VUELO · SIGUE A PIE', 130);
      }
    } else if (p.state === 'HITSTUN') {
      p.stateTimer++;
      p.guarding = false;
      if (p.stateTimer > 16) p.state = 'IDLE';
      this.uPress = false; this.iPress = false; this.spacePress = false;
    } else if (p.state === 'ATTACK') {
      p.attackFrame++;
      const combo = [{ st: 5, ac: 9, end: 18 }, { st: 5, ac: 9, end: 18 }, { st: 7, ac: 12, end: 26 }][p.comboStage - 1];
      if (this.uPress && p.comboStage < 3) this.comboQueued = true;
      if (p.attackFrame >= combo.end) {
        if (this.comboQueued && p.comboStage < 3) {
          p.comboStage++;
          p.attackFrame = 0;
          this.comboQueued = false;
          p.hitSet = new Set();
        } else {
          p.state = 'IDLE';
          p.comboStage = 0;
          p.attackKind = null;
        }
      }
      this.uPress = false; this.iPress = false; this.spacePress = false;
    } else {
      p.guarding = !!guard && p.z === 0;
      if (p.guarding) {
        p.currentAnim = 'guard';
      } else if (this.spacePress && p.z === 0) {
        p.vz = -8.8; p.z = 0.1; p.state = 'JUMP';
        this.audio.jump();
      } else if (this.uPress) {
        p.state = 'ATTACK';
        p.attackKind = 'punch';
        p.comboStage = 1;
        p.attackFrame = 0;
        p.hitSet = new Set();
        p.currentAnim = 'punch';
        if (!left && !right) {
          let best = null, bd = 1e9;
          const targets = (this.boss && this.boss.state !== 'DYING' && this.bossActive) ? this.enemies.concat([this.boss]) : this.enemies;
          targets.forEach(e => { if (e.state === 'DYING') return; const d = Math.abs(e.x - p.x); if (d < bd && d < 110) { bd = d; best = e; } });
          if (best) p.facingRight = best.x > p.x;
        }
      } else if (this.iPress && p.energia >= 30 && p.ballCooldown === 0) {
        p.energia -= 30;
        p.ballCooldown = 22;
        p.state = 'ATTACK';
        p.attackKind = 'ball';
        p.comboStage = 1;
        p.attackFrame = 0;
        p.hitSet = new Set();
        p.currentAnim = 'punch';
        this.audio.fireball();
        this.projectiles.push({ x: p.x + (p.facingRight ? 22 : -22), lane: p.lane, vx: p.facingRight ? 4.4 : -4.4 });
      } else {
        let moved = false;
        if (left) { p.x -= 2.1; p.facingRight = false; moved = true; }
        if (right) { p.x += 2.1; p.facingRight = true; moved = true; }
        if (upLane) { p.lane -= 1.5; moved = true; }
        if (downLane) { p.lane += 1.5; moved = true; }
        if (p.z > 0) p.state = 'JUMP';
        else if (p.state !== 'JUMP') p.state = 'IDLE';
        p.currentAnim = moved ? ((Math.floor(p.frameTimer / 8) % 2 === 0) ? 'idle1' : 'idle2')
          : ((Math.floor(p.frameTimer / 16) % 2 === 0) ? 'idle1' : 'idle2');
      }
      this.uPress = false; this.iPress = false; this.spacePress = false;
    }

    const minX = this.camX + 14, maxX = this.camX + VIEW_W - 14;
    p.x = Math.max(14, Math.min(this.worldW - 14, Math.max(minX, Math.min(maxX, p.x))));
    p.lane = Math.max(LANE_TOP, Math.min(LANE_BOTTOM, p.lane));

    // golpe cuerpo a cuerpo del jugador (combo encadenable)
    if (p.state === 'ATTACK' && p.attackKind === 'punch') {
      const combo = [{ st: 5, ac: 9 }, { st: 5, ac: 9 }, { st: 7, ac: 12 }][p.comboStage - 1];
      const armed = !!p.weapon;
      const dmg = [6, 7, 11][p.comboStage - 1] * (armed ? 2 : 1);
      const reach = [36, 38, 44][p.comboStage - 1] + (armed ? 14 : 0);
      const knock = [1.5, 2, 5][p.comboStage - 1] + (armed ? 1 : 0);
      if (p.attackFrame >= combo.st && p.attackFrame <= combo.ac) {
        const targets = (this.boss && this.boss.state !== 'DYING' && this.bossActive) ? this.enemies.concat([this.boss]) : this.enemies;
        targets.forEach(e => {
          if (e.state === 'DYING' || p.hitSet.has(e)) return;
          const dx = e.x - p.x;
          const inFront = p.facingRight ? (dx > -6 && dx < reach) : (dx < 6 && dx > -reach);
          if (inFront && Math.abs(e.lane - p.lane) < 17 && p.z < 30 && (e.z || 0) < 22) {
            p.hitSet.add(e);
            if (e.isBoss) this.hitBoss(dmg, p.x, knock); else this.hitEnemy(e, dmg, p.x, knock);
            if (armed) {
              p.weapon.dur--;
              if (p.weapon.dur <= 0) { p.weapon = null; this.audio.weaponBreak(); this.showToast('ENZIMA-L AGOTADA', 90); }
            }
          }
        });
      }
    }

    // ----- enemigos de oleada -----
    this.enemies.forEach(e => {
      e.frameTimer++;
      if (e.kx) { e.x += e.kx; e.kx *= 0.8; if (Math.abs(e.kx) < 0.2) e.kx = 0; }
      // salto de CITO-K (física propia)
      if (e.z > 0 || e.vz !== 0) {
        e.vz += 0.45;
        e.z -= e.vz;
        e.x += Math.sign(p.x - e.x) * 2.3;
        if (e.z <= 0) { e.z = 0; e.vz = 0; this.shake = Math.max(this.shake, 1); }
      }
      switch (e.state) {
        case 'DYING':
          e.stateTimer++;
          break;
        case 'HITSTUN':
          e.stateTimer++;
          e.currentAnim = 'idle1';
          if (e.stateTimer > 14) e.state = 'WALK';
          break;
        case 'WINDUP': {
          e.stateTimer++;
          e.currentAnim = 'windup';
          const windupT = e.type === 'radical' ? 8 : (e.type === 'plasma' ? 14 : 16);
          if (e.stateTimer > windupT) { e.state = 'STRIKE'; e.stateTimer = 0; e.hasHit = false; e.currentAnim = 'punch'; }
          break;
        }
        case 'STRIKE': {
          e.stateTimer++;
          e.currentAnim = 'punch';
          if (e.type === 'plasma') {
            if (!e.hasHit && e.stateTimer >= 4) {
              e.hasHit = true;
              const dir = Math.sign(p.x - e.x) || 1;
              this.enemyShots.push({ x: e.x + dir * 16, lane: e.lane, vx: dir * 3.1, dmg: 8 });
              this.audio.enemyShot();
            }
            if (e.stateTimer > 10) { e.state = 'RECOVER'; e.stateTimer = 0; e.currentAnim = 'idle1'; }
          } else {
            if (!e.hasHit && e.stateTimer >= 4 && e.stateTimer <= 9) {
              const dx = p.x - e.x;
              const inFront = e.facingRight ? (dx > -4 && dx < e.reach) : (dx < 4 && dx > -e.reach);
              if (inFront && Math.abs(p.lane - e.lane) < 13 && p.z < 22) {
                e.hasHit = true;
                this.hitPlayer(e.dmg, e.x);
              }
            }
            if (e.stateTimer > 12) { e.state = 'RECOVER'; e.stateTimer = 0; e.currentAnim = 'idle1'; }
          }
          break;
        }
        case 'RECOVER': {
          e.stateTimer++;
          const recT = e.type === 'radical' ? 14 : (e.type === 'plasma' ? 26 : (e.big ? 30 : 24));
          if (e.stateTimer > recT) e.state = 'WALK';
          break;
        }
        default: { // WALK
          e.currentAnim = (Math.floor(e.frameTimer / 10) % 2 === 0) ? 'idle1' : 'idle2';
          const dx = p.x - e.x, dl = p.lane - e.lane;
          e.facingRight = dx > 0;
          if (e.type === 'plasma') {
            // mantiene distancia y dispara
            if (e.fireCd > 0) e.fireCd--;
            if (Math.abs(dx) < 70) e.x -= Math.sign(dx || 1) * e.speed;
            else if (Math.abs(dx) > 130) e.x += Math.sign(dx) * e.speed;
            if (Math.abs(dl) > 4) e.lane += Math.sign(dl) * e.speed * 0.5;
            if (e.fireCd <= 0 && Math.abs(dx) < 190 && Math.abs(dl) < 40 && p.z < 26) {
              e.state = 'WINDUP'; e.stateTimer = 0;
              e.fireCd = 150 + Math.floor(Math.random() * 40);
            }
          } else if (e.type === 'cito') {
            if (e.jumpCd > 0) e.jumpCd--;
            if (e.z === 0 && e.jumpCd <= 0 && Math.abs(dx) > 34 && Math.abs(dx) < 150) {
              e.vz = -7.2; e.z = 0.1;
              e.jumpCd = 95 + Math.floor(Math.random() * 50);
            } else if (e.z === 0) {
              if (Math.abs(dx) < (e.reach - 4) && Math.abs(dl) < 11 && p.z < 26) {
                e.state = 'WINDUP'; e.stateTimer = 0;
              } else {
                if (Math.abs(dx) > 4) e.x += Math.sign(dx) * e.speed;
                if (Math.abs(dl) > 3) e.lane += Math.sign(dl) * e.speed * 0.6;
              }
            }
          } else if (e.type === 'radical') {
            if (Math.abs(dx) < (e.reach - 4) && Math.abs(dl) < 11 && p.z < 26) {
              e.state = 'WINDUP'; e.stateTimer = 0;
            } else {
              if (Math.abs(dx) > 4) e.x += Math.sign(dx) * e.speed;
              e.lane += Math.sign(dl) * e.speed * 0.5 + Math.sin(e.frameTimer / 9) * 0.9;
            }
          } else {
            if (Math.abs(dx) < (e.reach - 4) && Math.abs(dl) < 11 && p.z < 26) {
              e.state = 'WINDUP'; e.stateTimer = 0;
            } else {
              const sp = e.speed;
              if (Math.abs(dx) > 4) e.x += Math.sign(dx) * sp;
              if (Math.abs(dl) > 3) e.lane += Math.sign(dl) * sp * 0.6;
            }
          }
        }
      }
      this.enemies.forEach(o => {
        if (o === e || o.state === 'DYING') return;
        const dx = e.x - o.x, dl = e.lane - o.lane;
        if (Math.abs(dx) < 16 && Math.abs(dl) < 10) {
          e.x += Math.sign(dx || 1) * 0.5;
          e.lane += Math.sign(dl || 1) * 0.4;
        }
      });
      if (this.lockActive) e.x = Math.max(this.camX + 10, Math.min(this.camX + VIEW_W - 10, e.x));
      e.lane = Math.max(LANE_TOP, Math.min(LANE_BOTTOM, e.lane));
    });
    this.enemies = this.enemies.filter(e =>
      (e.state !== 'DYING' || e.stateTimer < 22) && e.x > this.camX - 100);

    // ----- jefes -----
    if (this.bossActive && this.boss && this.boss.kind === 'macro') {
      const b = this.boss;
      b.frameTimer++;
      const spd = b.enraged ? 1.2 : 0.85;
      switch (b.state) {
        case 'DYING':
          b.stateTimer++;
          b.currentAnim = 'idle1';
          if (b.stateTimer > 70) {
            this.bossActive = false;
            this.lockActive = false;
            if (STAGES[this.stageIdx].next) {
              this.state = 'interlude';
              this.interludeTimer = 200;
              this.audio.win();
            } else {
              this.state = 'won';
              this.audio.win();
            }
          }
          break;
        case 'HITSTUN':
          b.stateTimer++;
          if (b.stateTimer > 8) b.state = 'WALK';
          break;
        case 'DASH':
          b.stateTimer++;
          b.x += b.dashVx;
          if (b.stateTimer > 22) { b.state = 'WALK'; b.dashCooldown = 220; }
          break;
        case 'WINDUP':
          b.stateTimer++;
          b.currentAnim = 'windup';
          if (b.stateTimer > (b.attackKind === 'smash' ? 26 : 14)) {
            b.state = 'STRIKE'; b.stateTimer = 0; b.hasHit = false;
            b.currentAnim = 'punch';
            if (b.attackKind === 'smash') { this.audio.jump(); this.shake = 6; }
          }
          break;
        case 'STRIKE': {
          b.stateTimer++;
          b.attackFrame = b.stateTimer;
          b.currentAnim = 'punch';
          const reach = b.attackKind === 'smash' ? 60 : 46;
          const laneT = b.attackKind === 'smash' ? 20 : 15;
          const actE = b.attackKind === 'smash' ? 10 : 8;
          if (!b.hasHit && b.stateTimer >= 3 && b.stateTimer <= actE) {
            const dx = p.x - b.x;
            const inFront = b.facingRight ? (dx > -6 && dx < reach) : (dx < 6 && dx > -reach);
            if (inFront && Math.abs(p.lane - b.lane) < laneT && p.z < 22) {
              b.hasHit = true;
              this.hitPlayer(b.attackKind === 'smash' ? 16 : 10, b.x);
            }
          }
          if (b.stateTimer > 12) { b.state = 'RECOVER'; b.stateTimer = 0; b.currentAnim = 'idle1'; }
          break;
        }
        case 'RECOVER':
          b.stateTimer++;
          if (b.stateTimer > (b.attackKind === 'smash' ? 34 : 22)) b.state = 'WALK';
          break;
        default: { // WALK
          b.currentAnim = (Math.floor(b.frameTimer / 12) % 2 === 0) ? 'idle1' : 'idle2';
          const dx = p.x - b.x, dl = p.lane - b.lane;
          b.facingRight = dx > 0;
          if (b.dashCooldown > 0) b.dashCooldown--;
          if (Math.abs(dx) > 130 && b.dashCooldown === 0) {
            b.state = 'DASH'; b.stateTimer = 0;
            b.dashVx = Math.sign(dx) * 3.2;
          } else if (Math.abs(dx) < 42 && Math.abs(dl) < 14 && p.z < 26) {
            b.state = 'WINDUP'; b.stateTimer = 0;
            b.attackKind = (Math.random() < (b.enraged ? 0.6 : 0.35)) ? 'smash' : 'punch';
          } else {
            if (Math.abs(dx) > 6) b.x += Math.sign(dx) * spd;
            if (Math.abs(dl) > 4) b.lane += Math.sign(dl) * spd * 0.55;
          }
        }
      }
      b.x = Math.max(this.camX + 20, Math.min(this.camX + VIEW_W - 20, b.x));
      b.lane = Math.max(LANE_TOP, Math.min(LANE_BOTTOM, b.lane));
    }

    if (this.bossActive && this.boss && this.boss.kind === 'placa') {
      const b = this.boss;
      b.frameTimer++;
      if (b.shotCd > 0) b.shotCd--;
      if (b.spawnCd > 0) b.spawnCd--;
      if (b.contactCd > 0) b.contactCd--;
      const fast = b.enraged ? 0.62 : 1;
      switch (b.state) {
        case 'DYING':
          b.stateTimer++;
          if (b.stateTimer > 90) {
            this.bossActive = false;
            this.lockActive = false;
            this.state = 'won';
            this.audio.win();
          }
          break;
        case 'HITSTUN':
          b.stateTimer++;
          if (b.stateTimer > 6) b.state = 'WALK';
          break;
        case 'WINDUP':
          b.stateTimer++;
          b.currentAnim = 'windup';
          if (b.stateTimer > 16) {
            b.state = 'STRIKE'; b.stateTimer = 0;
            const dir = Math.sign(p.x - b.x) || -1;
            const lanes = b.enraged ? [-28, -14, 0, 14, 28] : [-14, 0, 14];
            lanes.forEach(off => {
              const lane = Math.max(LANE_TOP + 4, Math.min(LANE_BOTTOM - 4, p.lane + off));
              this.enemyShots.push({ x: b.x + dir * 24, lane, vx: dir * 3.1, dmg: 8 });
            });
            this.audio.enemyShot();
          }
          break;
        case 'STRIKE':
          b.stateTimer++;
          b.currentAnim = 'idle1';
          if (b.stateTimer > 10) { b.state = 'RECOVER'; b.stateTimer = 0; }
          break;
        case 'SPAWN':
          b.stateTimer++;
          b.currentAnim = 'windup';
          if (b.stateTimer === 16) {
            const alive = this.enemies.filter(e => e.state !== 'DYING').length;
            const cap = b.enraged ? 4 : 3;
            if (alive < cap) {
              const dir = p.x < b.x ? -1 : 1;
              this.enemies.push(new Grunt(b.x + dir * 30, LANE_TOP + 12, false, 'cito'));
              this.enemies.push(new Grunt(b.x + dir * 55, LANE_BOTTOM - 12, false, 'melee'));
              if (b.enraged) this.enemies.push(new Grunt(b.x + dir * 42, 178, false, 'radical'));
              this.audio.enemyShot();
            }
          }
          if (b.stateTimer > 30) { b.state = 'WALK'; b.spawnCd = Math.round(520 * fast); }
          break;
        case 'RECOVER':
          b.stateTimer++;
          if (b.stateTimer > 18) { b.state = 'WALK'; b.shotCd = Math.round(150 * fast); }
          break;
        default: { // WALK: flota y se coloca frente al jugador
          b.currentAnim = 'idle1';
          const targetX = Math.max(this.camX + 110, Math.min(this.camX + VIEW_W - 45, p.x + 150));
          const ddx = targetX - b.x, ddl = p.lane - b.lane;
          b.facingRight = p.x > b.x;
          const spd2 = b.enraged ? 0.85 : 0.5;
          if (Math.abs(ddx) > 4) b.x += Math.sign(ddx) * spd2;
          if (Math.abs(ddl) > 3) b.lane += Math.sign(ddl) * (b.enraged ? 0.6 : 0.35);
          if (b.spawnCd <= 0) { b.state = 'SPAWN'; b.stateTimer = 0; }
          else if (b.shotCd <= 0 && Math.abs(p.x - b.x) < 240) { b.state = 'WINDUP'; b.stateTimer = 0; }
        }
      }
      // daño de contacto con la masa de la placa
      if (b.state !== 'DYING' && b.contactCd <= 0 &&
          Math.abs(p.x - b.x) < 30 && Math.abs(p.lane - b.lane) < 18 && p.z < 20) {
        b.contactCd = 70;
        this.hitPlayer(8, b.x);
      }
      b.x = Math.max(this.camX + 30, Math.min(this.camX + VIEW_W - 24, b.x));
      b.lane = Math.max(LANE_TOP + 6, Math.min(LANE_BOTTOM - 6, b.lane));
    }

    // ----- proyectiles (Neuro-Ball) -----
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx;
      let hit = false;
      const targets = (this.boss && this.boss.state !== 'DYING' && this.bossActive) ? this.enemies.concat([this.boss]) : this.enemies;
      for (const e of targets) {
        if (e.state === 'DYING') continue;
        if (Math.abs(e.x - pr.x) < 16 && Math.abs(e.lane - pr.lane) < 14 && (e.z || 0) < 20) {
          if (e.isBoss) this.hitBoss(12, pr.x - pr.vx, 2); else this.hitEnemy(e, 12, pr.x - pr.vx, 2);
          hit = true;
          break;
        }
      }
      if (hit || pr.x < this.camX - 20 || pr.x > this.camX + VIEW_W + 20) this.projectiles.splice(i, 1);
    }

    // ----- glóbulos enemigos (PLASMA-B y PLACA-0) -----
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.x += s.vx;
      if (Math.abs(p.x - s.x) < 11 && Math.abs(p.lane - s.lane) < 12 && p.z < 20) {
        this.hitPlayer(s.dmg, s.x);
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (s.x < this.camX - 20 || s.x > this.camX + VIEW_W + 20) this.enemyShots.splice(i, 1);
    }

    // ----- recargas de señal -----
    this.pickups.forEach(pk => {
      if (pk.taken) return;
      if (Math.abs(p.x - pk.x) < 16 && Math.abs(p.lane - pk.lane) < 13 && p.z < 24) {
        pk.taken = true;
        p.conexion = Math.min(100, p.conexion + 30);
        this.audio.pickup();
        this.showToast('RECARGA DE SEÑAL +30', 80);
      }
    });

    // ----- armas recogibles (ENZIMA-L) -----
    this.weapons.forEach(w => {
      if (w.taken) return;
      if (Math.abs(p.x - w.x) < 14 && Math.abs(p.lane - w.lane) < 13 && p.z < 22) {
        w.taken = true;
        p.weapon = { name: 'ENZIMA-L', dur: 10 };
        this.audio.weaponGet();
        this.showToast('ENZIMA-L RECOGIDA · GOLPE x2', 110);
      }
    });

    // ----- MOTO-V (superarma del tramo 2) -----
    if (this.vehiclePad && !this.vehiclePad.taken && !p.vehicle) {
      if (Math.abs(p.x - this.vehiclePad.x) < 16 && Math.abs(p.lane - this.vehiclePad.lane) < 14 && p.z < 22) {
        this.vehiclePad.taken = true;
        p.vehicle = { integrity: 100, hitCooldown: 90 };
        this.audio.weaponGet();
        this.showToast('¡MOTO-V! PISTA DE NEÓN\nESPACIO SALTA BARRERAS · U TURBO\nCORTA A LOS RIVALES CON TU ESTELA', 210);
      }
    }

    // ----- puntos de control -----
    this.checkpoints.forEach(c => {
      if (c.used) return;
      if (Math.abs(p.x - c.x) < 26) {
        c.used = true;
        p.conexion = 100;
        this.audio.checkpoint();
        this.showToast('PUNTO DE CONTROL · CONEXIÓN RESTABLECIDA', 130);
      }
    });

    // ----- activación de oleadas y jefe -----
    this.triggers.forEach(trig => {
      if (trig.done || this.lockActive) return;
      if (p.x >= trig.x) {
        if (trig.type === 'wave') this.spawnWave(trig);
        else this.spawnBoss(trig);
      }
    });
    // fin de oleada: no queda ningún enemigo vivo
    if (this.lockActive && !this.bossActive && this.activeWaveTrig) {
      const alive = this.enemies.some(e => e.state !== 'DYING');
      if (!alive) {
        this.clearWave(this.activeWaveTrig);
        this.activeWaveTrig = null;
      }
    }

    // ----- cámara -----
    if (!this.lockActive) {
      const target = Math.max(0, Math.min(this.worldW - VIEW_W, p.x - (p.vehicle ? 150 : 190)));
      this.camX += (target - this.camX) * 0.18;
      if (Math.abs(target - this.camX) < 0.3) this.camX = target;
    }
  }

  // ---------- RENDER ----------
  drawEntity(f, drawFn, big) {
    const sx = f.x - this.camX;
    const sy = f.lane - (f.z || 0);
    const ds = laneScale(f.lane) * (big ? 1.15 : 1);
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, f.lane + 2, 14 * ds * (big ? 1.6 : 1), 4 * ds, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.state === 'DYING') {
      const a = Math.max(0, 1 - f.stateTimer / (f.dyingFrames || 22));
      ctx.save();
      ctx.globalAlpha = a;
    }
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(ds, ds);
    ctx.translate(-sx, -sy);
    const proxy = Object.assign(Object.create(Object.getPrototypeOf(f)), f, { x: sx, y: sy });
    drawFn(ctx, proxy);
    ctx.restore();
    if (f.state === 'DYING') ctx.restore();

    if (this.showHitboxes) {
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1;
      ctx.strokeRect(sx - 12 * ds, sy - 46 * ds, 24 * ds, 46 * ds);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (this.state === 'attract') { drawCinematic(ctx, this.cine); return; }
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    if (this.stageIdx === 1) drawStageScrollPeri(ctx, this.camX, this.t);
    else drawStageScroll(ctx, this.camX, this.t);
    if (this.stageIdx === 1) {
      this.flight += ((this.player.vehicle ? 1 : 0) - this.flight) * 0.08;
      if (this.flight > 0.02) drawNeonOverlay(ctx, this.camX, this.t, Math.min(1, this.flight));
    }

    this.checkpoints.forEach(c => {
      const sx = c.x - this.camX;
      if (sx < -30 || sx > VIEW_W + 30) return;
      const a = c.used ? 0.35 : 0.75 + 0.25 * Math.sin(this.t / 8);
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(sx, LANE_TOP - 30, sx, LANE_BOTTOM);
      g.addColorStop(0, 'rgba(103,232,249,0)');
      g.addColorStop(1, 'rgba(103,232,249,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 5, LANE_TOP - 30, 10, LANE_BOTTOM - LANE_TOP + 30);
      glowDot(ctx, sx, c.lane, 12, 'rgba(103,232,249,0.8)');
      ctx.restore();
    });

    this.pickups.forEach(pk => {
      if (pk.taken) return;
      const sx = pk.x - this.camX;
      if (sx < -20 || sx > VIEW_W + 20) return;
      const bobY = Math.sin(this.t / 12 + pk.x) * 3;
      glowDot(ctx, sx, pk.lane - 10 + bobY, 12, 'rgba(110,231,183,0.75)');
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath(); ctx.arc(sx, pk.lane - 10 + bobY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#06222c';
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText('+', sx, pk.lane - 7.5 + bobY);
      ctx.textAlign = 'left';
    });

    this.weapons.forEach(w => {
      if (w.taken) return;
      const sx = w.x - this.camX;
      if (sx < -20 || sx > VIEW_W + 20) return;
      const bobY = Math.sin(this.t / 12 + w.x) * 3;
      const wy = w.lane - 10 + bobY;
      glowDot(ctx, sx, wy, 13, 'rgba(184,249,78,0.6)');
      ctx.save();
      ctx.translate(sx, wy); ctx.rotate(-0.6);
      ctx.strokeStyle = '#b8f94e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#e9ffc0';
      ctx.beginPath(); ctx.arc(6, 0, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // barreras de neón del tramo de vuelo
    this.hazards.forEach(hz => {
      if (hz.hit) return;
      const sx = hz.x - this.camX;
      if (sx < -24 || sx > VIEW_W + 24) return;
      const blink = 0.6 + 0.4 * Math.sin(this.t / 6 + hz.x);
      glowDot(ctx, sx, hz.lane - 8, 15, 'rgba(255,61,240,' + (0.25 + 0.3 * blink) + ')');
      ctx.fillStyle = '#12052e';
      ctx.strokeStyle = '#ff3df0';
      ctx.lineWidth = 1.4;
      ctx.fillRect(sx - 4, hz.lane - 20, 8, 24);
      ctx.strokeRect(sx - 4, hz.lane - 20, 8, 24);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * blink) + ')';
      ctx.beginPath(); ctx.moveTo(sx, hz.lane - 18); ctx.lineTo(sx, hz.lane + 2); ctx.stroke();
    });

    // recargas de integridad de la moto
    this.repairs.forEach(r => {
      if (r.taken) return;
      const sx = r.x - this.camX;
      if (sx < -20 || sx > VIEW_W + 20) return;
      const bobY = Math.sin(this.t / 10 + r.x) * 3;
      glowDot(ctx, sx, r.lane - 12 + bobY, 16, 'rgba(184,249,78,0.7)');
      ctx.strokeStyle = '#b8f94e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, r.lane - 12 + bobY, 6, 22, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e9ffc0'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText('+', sx, r.lane - 9 + bobY); ctx.textAlign = 'left';
    });

    // estelas de luz (rival = rojo, propia = cian)
    this.trails.forEach(tr => {
      const sx = tr.x - this.camX;
      if (sx < -10 || sx > VIEW_W + 10) return;
      if (tr.own) {
        const a = Math.max(0, tr.life / 80);
        ctx.fillStyle = 'rgba(61,232,255,' + (0.8 * a) + ')';
        ctx.fillRect(sx - 3, tr.lane - 5, 6, 3);
        glowDot(ctx, sx, tr.lane - 4, 7, 'rgba(61,232,255,' + (0.4 * a) + ')');
      } else {
        const a = Math.min(1, tr.life / 40);
        ctx.fillStyle = 'rgba(255,77,109,' + (0.85 * a) + ')';
        ctx.fillRect(sx - 4, tr.lane - 16, 8, 16);
        ctx.fillStyle = 'rgba(255,230,235,' + (0.9 * a) + ')';
        ctx.fillRect(sx - 1, tr.lane - 16, 2, 16);
        glowDot(ctx, sx, tr.lane - 8, 11, 'rgba(255,77,109,' + (0.35 * a) + ')');
      }
    });

    // rivales de luz
    this.riders.forEach(r => {
      const sx = r.x - this.camX;
      if (sx < -40 || sx > VIEW_W + 40) return;
      const a = r.dead ? Math.max(0, 1 - r.t / 30) : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(sx, r.lane + 2, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
      drawRider(ctx, sx, r.lane, this.t, a);
      if (r.dead) glowDot(ctx, sx, r.lane - 12, 12 + r.t, 'rgba(255,255,255,' + (0.6 * a) + ')');
    });

    // MOTO-V aparcada esperando al piloto
    if (this.vehiclePad && !this.vehiclePad.taken) {
      const sx = this.vehiclePad.x - this.camX;
      if (sx > -40 && sx < VIEW_W + 40) {
        const bobY = Math.sin(this.t / 10) * 3;
        const wy = this.vehiclePad.lane - 12 + bobY;
        glowDot(ctx, sx, wy, 26, 'rgba(103,232,249,0.5)');
        drawMgrBike(ctx, { x: sx, y: this.vehiclePad.lane + bobY * 0.5, facingRight: true, frameTimer: this.t, empty: true });
        ctx.fillStyle = '#ffd15c';
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillText('MOTO-V', sx, wy - 24);
        ctx.textAlign = 'left';
      }
    }

    const renderables = this.enemies.map(e => ({ f: e, fn: drawGrunt, big: e.big }));
    if (this.boss && (this.bossActive || this.boss.state === 'DYING')) {
      renderables.push({ f: this.boss, fn: this.boss.kind === 'placa' ? drawPlaca : drawMacro, big: true });
    }
    renderables.push({ f: this.player, fn: this.player.vehicle ? drawMgrBike : drawMgr, big: false });
    renderables.sort((a, b) => a.f.lane - b.f.lane);
    renderables.forEach(r => this.drawEntity(r.f, r.fn, r.big));

    this.projectiles.forEach(pr => {
      const sx = pr.x - this.camX;
      const sy = pr.lane - 34;
      const glow = 0.6 + 0.4 * Math.sin(this.t / 3);
      ctx.fillStyle = 'rgba(103,232,249,' + (0.25 * glow) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    });

    this.enemyShots.forEach(s => {
      const sx = s.x - this.camX;
      const sy = s.lane - 16;
      const glow = 0.6 + 0.4 * Math.sin(this.t / 3 + s.x);
      ctx.fillStyle = 'rgba(216,124,245,' + (0.3 * glow) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d87cf5';
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
    });

    if (!this.lockActive && this.state === 'play' && this.player.x > this.camX + 250 && this.camX < this.worldW - VIEW_W - 5) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t / 6);
      ctx.fillStyle = 'rgba(250,204,21,' + (0.4 + 0.6 * pulse) + ')';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▶', VIEW_W - 16, 110);
      ctx.textAlign = 'left';
    }

    ctx.restore();

    this.drawHUD();
    this.drawOverlays();
  }

  drawHUD() {
    const ctx = this.ctx;
    ctx.fillStyle = '#3f0d16';
    ctx.fillRect(40, 12, 130, 10);
    const cw = (this.player.conexion / 100) * 130;
    const cg = ctx.createLinearGradient(40, 0, 170, 0);
    cg.addColorStop(0, '#22d3ee'); cg.addColorStop(1, '#a5f3fc');
    ctx.fillStyle = cg;
    ctx.fillRect(40, 12, cw, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.fillText('CONEXIÓN', 40, 9);

    ctx.fillStyle = '#241040';
    ctx.fillRect(40, 27, 90, 5);
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(40, 27, (this.player.energia / 100) * 90, 5);
    ctx.fillStyle = '#cfc3f5';
    ctx.font = '7px monospace';
    ctx.fillText('ENERGÍA', 40, 41);

    let hudY = 52;
    if (this.player.weapon) {
      ctx.fillStyle = '#b8f94e';
      ctx.font = '7px monospace';
      ctx.fillText('ENZIMA-L ' + '▮'.repeat(this.player.weapon.dur), 40, hudY);
      hudY += 11;
    }
    if (this.player.vehicle) {
      ctx.fillStyle = '#241040';
      ctx.fillRect(40, hudY - 5, 90, 5);
      ctx.fillStyle = '#37d3e8';
      ctx.fillRect(40, hudY - 5, Math.max(0, this.player.vehicle.integrity / 100) * 90, 5);
      ctx.fillStyle = '#bffcff';
      ctx.font = '7px monospace';
      ctx.fillText('MOTO-V', 40, hudY + 4);
    }

    if (this.bossActive && this.boss) {
      ctx.fillStyle = '#3f0d16';
      ctx.fillRect(230, 12, 130, 10);
      ctx.fillStyle = this.boss.kind === 'placa' ? '#c9a6f2' : '#f98a1f';
      ctx.fillRect(230, 12, Math.max(0, this.boss.hp / this.boss.maxHp) * 130, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText(this.boss.name, 230, 9);
    }

    if (this.toast) {
      const a = Math.min(1, this.toast.timer / 30);
      const lines = this.toast.text.split('\n');
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 11px monospace';
      const w = Math.max.apply(null, lines.map(l => ctx.measureText(l).width)) + 20;
      const h = lines.length * 14 + 8;
      ctx.fillRect((VIEW_W - w) / 2, 52, w, h);
      ctx.fillStyle = '#ffd15c';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 66 + i * 14));
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  drawOverlays() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    if (this.state === 'intro') {
      ctx.fillStyle = 'rgba(4,1,12,0.88)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      glowDot(ctx, 192, 60, 60, 'rgba(34,211,238,0.25)');
      ctx.fillStyle = '#4ee6f2';
      ctx.font = 'bold 17px monospace';
      ctx.fillText('NEURO-FIGHTER: AVANCE', 192, 46);
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('TRAMO 1 · FOSA DE RANVIER', 192, 62);
      ctx.fillText('TRAMO 2 · VÍA PERIFÉRICA', 192, 75);
      ctx.fillStyle = '#e0d0f0';
      ctx.font = '9px monospace';
      ctx.fillText('Protege la conexión: llega al final de cada tramo.', 192, 94);
      ctx.fillText('Derrotar enemigos NO restaura la conexión.', 192, 106);
      ctx.fillText('Busca recargas de señal y puntos de control.', 192, 118);
      ctx.fillText('En la Vía Periférica te espera la MOTO-V.', 192, 130);
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('A/D mover · W/S profundidad · ESPACIO salto', 192, 148);
      ctx.fillText('U golpe (combo x3) · I Neuro-Ball · O guardia', 192, 160);
      ctx.fillStyle = '#ffffff';
      const pulse = 0.5 + 0.5 * Math.sin(this.t / 10);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PULSA CUALQUIER TECLA · TOCA LA PANTALLA', 192, 186);
      ctx.globalAlpha = 1;
    } else if (this.state === 'interlude') {
      ctx.fillStyle = 'rgba(1,12,6,0.82)';
      ctx.fillRect(0, 44, VIEW_W, 128);
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('TRAMO 1 SUPERADO', 192, 76);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('MACRO-L1 repelido. La conexión sigue protegida.', 192, 96);
      ctx.fillText('Conexión restablecida al 100%.', 192, 110);
      ctx.fillStyle = '#5eead4';
      ctx.font = 'bold 12px monospace';
      const pulse = 0.5 + 0.5 * Math.sin(this.t / 8);
      ctx.globalAlpha = pulse;
      ctx.fillText('TRAMO 2 · VÍA PERIFÉRICA', 192, 138);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#a78bfa';
      ctx.font = '8px monospace';
      ctx.fillText('ENTER para continuar ya', 192, 158);
    } else if (this.state === 'lost') {
      ctx.fillStyle = 'rgba(12,1,4,0.75)';
      ctx.fillRect(0, 60, VIEW_W, 96);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('CONEXIÓN PERDIDA', 192, 96);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('La señal se ha roto. El avance vuelve a empezar.', 192, 116);
      ctx.fillText('Pulsa ENTER para reiniciar', 192, 136);
    } else if (this.state === 'won') {
      ctx.fillStyle = 'rgba(1,12,6,0.78)';
      ctx.fillRect(0, 52, VIEW_W, 112);
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('AVANCE COMPLETO', 192, 86);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('PLACA-0 disuelta y MACRO-L1 repelido.', 192, 106);
      ctx.fillText('La conexión entre neuronas sigue protegida.', 192, 118);
      ctx.fillStyle = '#ffd15c';
      ctx.fillText('Pulsa ENTER para jugar de nuevo', 192, 142);
    }
    ctx.textAlign = 'left';
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop);
  }
}

window.onload = () => {
  const app = new Game();
  window.__NF = { app, inputs: app.inputs };
};
