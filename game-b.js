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
    g.gain.linearRampToValueAtTime(vol, at + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(vol, at + dur * 0.65);
    g.gain.linearRampToValueAtTime(0, at + dur);
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
    this.audio.init(); // Intentar autoplay; si se bloquea, esperar gesto sin avanzar láminas.
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
    const unlock = () => {
      const waiting = !this.audio.ctx || this.audio.ctx.state !== 'running';
      this.audio.init();
      if (waiting && (this.state === 'attract' || this.state === 'intro')) {
        this.state = 'attract'; this.cine = { scene: 0, t: 0 }; this.introIdle = 0;
        this.cineScore.stop();
      }
      return waiting;
    };
    const start = () => {
      if (unlock()) return false;
      if (this.state === 'attract' || this.state === 'intro') return false;
      return true;
    };
    window.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button')) unlock();
    });
    const playButton = document.createElement('button');
    playButton.id = 'play-button'; playButton.type = 'button'; playButton.textContent = 'JUGAR';
    playButton.style.cssText = 'position:fixed;top:8px;left:8px;z-index:50;min-height:36px;padding:4px 12px;background:#142431;color:#ffd15c;border:1px solid #4ee6f2;border-radius:4px;font:inherit;cursor:pointer;left:calc(8px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px))';
    document.body.appendChild(playButton);
    playButton.addEventListener('click', () => {
      if (unlock()) return;
      if (this.state === 'attract' || this.state === 'intro') this.state = 'play';
    });
    // Si la ventana pierde el foco con una tecla pulsada, el keyup se pierde y la
    // tecla queda "atascada": limpiar entradas al perder el foco u ocultarse.
    const clearInputs = () => { for (const k in this.inputs) this.inputs[k] = false; this.uPress = this.iPress = this.spacePress = false; };
    window.addEventListener('blur', clearInputs);
    document.getElementById('sound-toggle')?.addEventListener('click', () => { if (!unlock()) this.audio.toggleMute(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearInputs(); this.audio.music.stopTrack(); if (this.audio.ctx?.state === 'running') this.audio.ctx.suspend().catch(() => {}); }
      else if (this.audio.ctx) { this.audio.music.nextT = this.audio.ctx.currentTime + 0.08; this.audio.init(); }
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      const waiting = unlock();
      if (e.key === 'Enter' && !e.repeat && !waiting && (this.state === 'attract' || this.state === 'intro')) this.state = 'play';
      if (e.key === ' ') e.preventDefault();
      if (!this.inputs[e.key]) {
        if (e.key === 'u' || e.key === 'U') this.uPress = true;
        if (e.key === 'i' || e.key === 'I') this.iPress = true;
        if (e.key === ' ') this.spacePress = true;
      }
      this.inputs[e.key] = true;
      if ((e.key === 'm' || e.key === 'M') && !e.repeat && !waiting) this.audio.toggleMute();
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
        if (!start()) return;
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
    const running = this.audio.ctx?.state === 'running';
    const soundButton = document.getElementById('sound-toggle');
    if (soundButton) {
      soundButton.textContent = !running ? 'ACTIVAR AUDIO' : (this.audio.muted ? 'SONIDO: OFF' : 'SONIDO: ON');
      soundButton.setAttribute('aria-pressed', String(running && !this.audio.muted));
      soundButton.style.fontSize = '12px';
    }
    const playButton = document.getElementById('play-button');
    if (playButton) playButton.hidden = this.state !== 'attract' && this.state !== 'intro';
    if (this.state === 'attract' && (!running || !cineReady())) {
      this.uPress = this.iPress = this.spacePress = false;
      return;
    }
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
    if (this.state === 'attract') {
      if (!this.audio.ctx || this.audio.ctx.state !== 'running') {
        ctx.fillStyle = '#06020c'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.textAlign = 'center'; ctx.fillStyle = '#e8ddc8'; ctx.font = 'bold 12px monospace';
        ctx.fillText('TOCA O PULSA UNA TECLA', VIEW_W / 2, 92);
        ctx.font = '10px monospace'; ctx.fillStyle = '#d9a05b';
        ctx.fillText('PARA VER Y ESCUCHAR LA CINEMATICA', VIEW_W / 2, 115);
        ctx.textAlign = 'left'; return;
      }
      drawCinematic(ctx, this.cine); return;
    }
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
