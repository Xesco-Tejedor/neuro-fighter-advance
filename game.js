'use strict';
/* NEURO-FIGHTER: Avance — Tramo 1 (Fosa de Ranvier)
   Primer tramo jugable con avance lateral y profundidad.
   MGR-01 protege la conexión; la barra de CONEXIÓN solo se restaura
   con recargas de señal y puntos de control. Derrotar enemigos no cura. */

const VIEW_W = 384, VIEW_H = 216;
const LANE_TOP = 148, LANE_BOTTOM = 202;
const WORLD_W = 1900;

// ---------- AUDIO (motor chiptune nativo, igual que v5) ----------
class SoundEngine {
  constructor() { this.ctx = null; this.master = null; this.muted = false; }
  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1.3;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 1.3; return this.muted; }
  tone(freq, type, dur, endFreq, vol, delay) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) { }
  }
  noise(dur, vol) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g); g.connect(this.master);
      src.start();
    } catch (e) { }
  }
  hit() { this.noise(0.1, 0.5); this.tone(520, 'square', 0.12, 120, 0.5); }
  fireball() { this.tone(500, 'triangle', 0.3, 1400, 0.6); this.tone(250, 'square', 0.25, 700, 0.25); }
  jump() { this.tone(300, 'square', 0.18, 700, 0.4); }
  block() { this.tone(900, 'square', 0.07, 500, 0.4); this.noise(0.05, 0.3); }
  ko() { this.tone(700, 'sawtooth', 0.7, 80, 0.6); this.tone(500, 'square', 0.7, 60, 0.4, 0.15); this.noise(0.4, 0.4); }
  pickup() { this.tone(660, 'triangle', 0.12, 990, 0.5); this.tone(880, 'triangle', 0.15, 1320, 0.4, 0.08); }
  checkpoint() { this.tone(523, 'square', 0.14, 0, 0.35); this.tone(659, 'square', 0.14, 0, 0.35, 0.09); this.tone(784, 'square', 0.22, 0, 0.35, 0.18); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'square', 0.22, 0, 0.4, i * 0.14)); }
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

// Agresor genérico de oleada (célula hostil con púas; dos tamaños)
function drawGrunt(ctx, f) {
  const t = f.frameTimer;
  const hit = f.state === 'HITSTUN';
  const flash = hit && Math.floor(t / 2) % 2 === 0;
  const sc = f.big ? 1.45 : 1;
  const punching = f.currentAnim === 'punch';
  const windup = f.currentAnim === 'windup';
  const bob = Math.sin(t / 7) * 1.2;
  const body = flash ? '#ffffff' : (f.big ? '#d63a4e' : '#e0559b');
  const light = flash ? '#ffffff' : (f.big ? '#ff8a96' : '#ffa3cd');
  const dark = flash ? '#cccccc' : (f.big ? '#6e1220' : '#7c1d4e');

  ctx.save();
  ctx.translate(f.x, f.y);
  if (!f.facingRight) ctx.scale(-1, 1);
  ctx.scale(sc, sc);
  const cy = -16 + bob;

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
    this.state = 'IDLE'; // IDLE, JUMP, ATTACK, HITSTUN
    this.frameTimer = 0;
    this.attackFrame = 0;
    this.comboStage = 0;
    this.comboQueued = false;
    this.attackKind = null; // 'punch' | 'ball'
    this.hitSet = new Set();
    this.currentAnim = 'idle1';
    this.guarding = false;
    this.ballCooldown = 0;
    this.stateTimer = 0;
  }
}

class Grunt {
  constructor(x, lane, big) {
    this.kind = 'grunt';
    this.big = !!big;
    this.x = x; this.lane = lane; this.z = 0;
    this.hp = this.big ? 55 : 26;
    this.maxHp = this.hp;
    this.speed = this.big ? 0.55 : 0.9;
    this.dmg = this.big ? 12 : 8;
    this.reach = this.big ? 36 : 28;
    this.facingRight = false;
    this.state = 'WALK'; // WALK, WINDUP, STRIKE, RECOVER, HITSTUN, DYING
    this.frameTimer = Math.floor(Math.random() * 40);
    this.stateTimer = 0;
    this.attackFrame = 0;
    this.currentAnim = 'idle1';
    this.hasHit = false;
    this.kx = 0;
  }
}

class Boss {
  constructor(x, lane) {
    this.kind = 'macro'; this.name = 'MACRO-L1';
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

// ---------- JUEGO ----------
class Game {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new SoundEngine();
    this.inputs = {};
    this.showHitboxes = false;
    this.state = 'intro'; // intro, play, lost, won
    this.t = 0;
    this.uPress = false; this.iPress = false; this.spacePress = false;
    this.resetWorld();
    this.bindEvents();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resetWorld() {
    this.player = new Player();
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.checkpoints = [];
    this.camX = 0;
    this.lockActive = false;
    this.boss = null;
    this.bossActive = false;
    this.activeWaveTrig = null;
    this.shake = 0;
    this.toast = null;
    this.zoneIdx = -1;
    this.triggers = [
      { x: 340, type: 'wave', done: false, waves: [{ big: false }, { big: false }, { big: false }] },
      { x: 1000, type: 'wave', done: false, waves: [{ big: false }, { big: false }, { big: false }, { big: true }] },
      { x: 1400, type: 'boss', done: false },
    ];
    this.zones = [
      { x: 0, name: 'TRAMO 1 · FOSA DE RANVIER' },
      { x: 340, name: '2 · ZONA BLOQUEADA' },
      { x: 660, name: '3 · AVANZA' },
      { x: 1000, name: '4 · SEGUNDA OLEADA' },
      { x: 1400, name: '5 · JEFE: MACRO-L1' },
    ];
  }

  bindEvents() {
    const start = () => {
      this.audio.init();
      if (this.state === 'intro') this.state = 'play';
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', (e) => {
      start();
      if (e.key === ' ') e.preventDefault();
      if (!this.inputs[e.key]) {
        if (e.key === 'u' || e.key === 'U') this.uPress = true;
        if (e.key === 'i' || e.key === 'I') this.iPress = true;
        if (e.key === ' ') this.spacePress = true;
      }
      this.inputs[e.key] = true;
      if (e.key === 'm' || e.key === 'M') this.audio.toggleMute();
      if (e.key === 'h' || e.key === 'H') this.showHitboxes = !this.showHitboxes;
      if (e.key === 'Enter' && (this.state === 'lost' || this.state === 'won')) {
        this.resetWorld();
        this.state = 'play';
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
      if (this.state === 'lost' || this.state === 'won') { this.resetWorld(); this.state = 'play'; }
    }, { passive: true });
  }

  showToast(text, frames) { this.toast = { text, timer: frames || 150 }; }

  spawnWave(trig) {
    const p = this.player;
    trig.waves.forEach((w, i) => {
      const ahead = i % 2 === 0;
      const ex = p.x + (ahead ? 70 + i * 45 : -60 - i * 30);
      const lane = LANE_TOP + 10 + ((i * 37) % (LANE_BOTTOM - LANE_TOP - 16));
      this.enemies.push(new Grunt(Math.max(this.camX + 20, Math.min(this.camX + VIEW_W - 20, ex)), lane, w.big));
    });
    this.lockActive = true;
    this.activeWaveTrig = trig;
    this.showToast('¡ZONA BLOQUEADA! DESPEJA LA OLEADA', 120);
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
    this.boss = new Boss(1560, 178);
    this.bossActive = true;
    this.showToast('¡MACRO-L1 BLOQUEA LA CONEXIÓN!', 160);
  }

  hitPlayer(dmg, fromX) {
    const p = this.player;
    if (this.state !== 'play') return;
    if (p.guarding) {
      p.conexion = Math.max(0, p.conexion - Math.round(dmg * 0.2));
      this.audio.block();
    } else {
      p.conexion = Math.max(0, p.conexion - dmg);
      p.state = 'HITSTUN';
      p.stateTimer = 0;
      p.currentAnim = 'idle1';
      this.audio.hit();
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
    } else {
      e.state = 'HITSTUN';
      e.stateTimer = 0;
      e.kx = (e.x >= fromX ? 1 : -1) * knock;
    }
    this.audio.hit();
  }

  hitBoss(dmg, fromX, knock) {
    const b = this.boss;
    if (!b || b.state === 'DYING') return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      b.state = 'DYING';
      b.stateTimer = 0;
      this.audio.ko();
    } else {
      b.state = 'HITSTUN';
      b.stateTimer = 0;
      b.x += (b.x >= fromX ? 1 : -1) * Math.min(knock, 2);
    }
    this.audio.hit();
  }

  // --- actualización por frame ---
  update() {
    this.t++;
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

    if (p.state === 'HITSTUN') {
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
    p.x = Math.max(14, Math.min(WORLD_W - 14, Math.max(minX, Math.min(maxX, p.x))));
    p.lane = Math.max(LANE_TOP, Math.min(LANE_BOTTOM, p.lane));

    // golpe cuerpo a cuerpo del jugador (combo encadenable)
    if (p.state === 'ATTACK' && p.attackKind === 'punch') {
      const combo = [{ st: 5, ac: 9 }, { st: 5, ac: 9 }, { st: 7, ac: 12 }][p.comboStage - 1];
      const dmg = [6, 7, 11][p.comboStage - 1];
      const reach = [36, 38, 44][p.comboStage - 1];
      const knock = [1.5, 2, 5][p.comboStage - 1];
      if (p.attackFrame >= combo.st && p.attackFrame <= combo.ac) {
        const targets = (this.boss && this.boss.state !== 'DYING' && this.bossActive) ? this.enemies.concat([this.boss]) : this.enemies;
        targets.forEach(e => {
          if (e.state === 'DYING' || p.hitSet.has(e)) return;
          const dx = e.x - p.x;
          const inFront = p.facingRight ? (dx > -6 && dx < reach) : (dx < 6 && dx > -reach);
          if (inFront && Math.abs(e.lane - p.lane) < 17 && p.z < 30) {
            p.hitSet.add(e);
            if (e.kind === 'macro') this.hitBoss(dmg, p.x, knock); else this.hitEnemy(e, dmg, p.x, knock);
          }
        });
      }
    }

    // ----- enemigos de oleada -----
    this.enemies.forEach(e => {
      e.frameTimer++;
      if (e.kx) { e.x += e.kx; e.kx *= 0.8; if (Math.abs(e.kx) < 0.2) e.kx = 0; }
      switch (e.state) {
        case 'DYING':
          e.stateTimer++;
          break;
        case 'HITSTUN':
          e.stateTimer++;
          e.currentAnim = 'idle1';
          if (e.stateTimer > 14) e.state = 'WALK';
          break;
        case 'WINDUP':
          e.stateTimer++;
          e.currentAnim = 'windup';
          if (e.stateTimer > 16) { e.state = 'STRIKE'; e.stateTimer = 0; e.hasHit = false; e.currentAnim = 'punch'; }
          break;
        case 'STRIKE': {
          e.stateTimer++;
          e.currentAnim = 'punch';
          if (!e.hasHit && e.stateTimer >= 4 && e.stateTimer <= 9) {
            const dx = p.x - e.x;
            const inFront = e.facingRight ? (dx > -4 && dx < e.reach) : (dx < 4 && dx > -e.reach);
            if (inFront && Math.abs(p.lane - e.lane) < 13 && p.z < 22) {
              e.hasHit = true;
              this.hitPlayer(e.dmg, e.x);
            }
          }
          if (e.stateTimer > 12) { e.state = 'RECOVER'; e.stateTimer = 0; e.currentAnim = 'idle1'; }
          break;
        }
        case 'RECOVER':
          e.stateTimer++;
          if (e.stateTimer > (e.big ? 30 : 24)) e.state = 'WALK';
          break;
        default: { // WALK
          e.currentAnim = (Math.floor(e.frameTimer / 10) % 2 === 0) ? 'idle1' : 'idle2';
          const dx = p.x - e.x, dl = p.lane - e.lane;
          e.facingRight = dx > 0;
          if (Math.abs(dx) < (e.reach - 4) && Math.abs(dl) < 11 && p.z < 26) {
            e.state = 'WINDUP'; e.stateTimer = 0;
          } else {
            const sp = e.speed;
            if (Math.abs(dx) > 4) e.x += Math.sign(dx) * sp;
            if (Math.abs(dl) > 3) e.lane += Math.sign(dl) * sp * 0.6;
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
    this.enemies = this.enemies.filter(e => e.state !== 'DYING' || e.stateTimer < 22);

    // ----- jefe MACRO-L1 -----
    if (this.bossActive && this.boss) {
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
            this.state = 'won';
            this.audio.win();
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

    // ----- proyectiles (Neuro-Ball) -----
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx;
      let hit = false;
      const targets = (this.boss && this.boss.state !== 'DYING' && this.bossActive) ? this.enemies.concat([this.boss]) : this.enemies;
      for (const e of targets) {
        if (e.state === 'DYING') continue;
        if (Math.abs(e.x - pr.x) < 16 && Math.abs(e.lane - pr.lane) < 14) {
          if (e.kind === 'macro') this.hitBoss(12, pr.x - pr.vx, 2); else this.hitEnemy(e, 12, pr.x - pr.vx, 2);
          hit = true;
          break;
        }
      }
      if (hit || pr.x < this.camX - 20 || pr.x > this.camX + VIEW_W + 20) this.projectiles.splice(i, 1);
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
      const target = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - 190));
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
      const a = Math.max(0, 1 - f.stateTimer / (f.kind === 'macro' ? 70 : 22));
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
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    drawStageScroll(ctx, this.camX, this.t);

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

    const renderables = this.enemies.map(e => ({ f: e, fn: drawGrunt, big: e.big }));
    if (this.boss && (this.bossActive || this.boss.state === 'DYING')) {
      renderables.push({ f: this.boss, fn: drawMacro, big: true });
    }
    renderables.push({ f: this.player, fn: drawMgr, big: false });
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

    if (!this.lockActive && this.state === 'play' && this.player.x > this.camX + 250 && this.camX < WORLD_W - VIEW_W - 5) {
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

    if (this.bossActive && this.boss) {
      ctx.fillStyle = '#3f0d16';
      ctx.fillRect(230, 12, 130, 10);
      ctx.fillStyle = '#f98a1f';
      ctx.fillRect(230, 12, (this.boss.hp / this.boss.maxHp) * 130, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText('MACRO-L1', 230, 9);
    }

    if (this.toast) {
      const a = Math.min(1, this.toast.timer / 30);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 11px monospace';
      const w = ctx.measureText(this.toast.text).width + 20;
      ctx.fillRect((VIEW_W - w) / 2, 52, w, 20);
      ctx.fillStyle = '#ffd15c';
      ctx.textAlign = 'center';
      ctx.fillText(this.toast.text, VIEW_W / 2, 66);
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
      ctx.fillText('NEURO-FIGHTER: AVANCE', 192, 52);
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('TRAMO 1 · FOSA DE RANVIER', 192, 70);
      ctx.fillStyle = '#e0d0f0';
      ctx.font = '9px monospace';
      ctx.fillText('Protege la conexión: llega al final del tramo.', 192, 96);
      ctx.fillText('Derrotar enemigos NO restaura la conexión.', 192, 110);
      ctx.fillText('Busca recargas de señal y puntos de control.', 192, 122);
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('A/D mover · W/S profundidad · ESPACIO salto', 192, 142);
      ctx.fillText('U golpe (combo x3) · I Neuro-Ball · O guardia', 192, 154);
      ctx.fillStyle = '#ffffff';
      const pulse = 0.5 + 0.5 * Math.sin(this.t / 10);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PULSA CUALQUIER TECLA', 192, 182);
      ctx.globalAlpha = 1;
    } else if (this.state === 'lost') {
      ctx.fillStyle = 'rgba(12,1,4,0.75)';
      ctx.fillRect(0, 60, VIEW_W, 96);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('CONEXIÓN PERDIDA', 192, 96);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('La señal se ha roto. El tramo vuelve a empezar.', 192, 116);
      ctx.fillText('Pulsa ENTER para reiniciar', 192, 136);
    } else if (this.state === 'won') {
      ctx.fillStyle = 'rgba(1,12,6,0.78)';
      ctx.fillRect(0, 60, VIEW_W, 96);
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('TRAMO SUPERADO', 192, 96);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('MACRO-L1 repelido. La conexión sigue protegida.', 192, 116);
      ctx.fillText('Pulsa ENTER para jugar de nuevo', 192, 136);
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
