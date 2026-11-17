// Everything drawn on top of the 3D view: money, wanted stars, clock,
// health, speed, ammo, mission banner, message feed, the 2D minimap, the big
// map, and the title / pause / busted menus.

import { WORLD } from './config.js';

const STAR_ON = '★';
const STAR_OFF = '☆';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.moneyEl = this.el('money');
    this.starsEl = this.el('stars');
    this.clockEl = this.el('clock');
    this.objectiveEl = this.el('objective');
    this.objectiveTextEl = this.el('objectiveText');
    this.healthBarEl = this.el('healthBar');
    this.healthLabelEl = this.el('healthLabel');
    this.speedoEl = this.el('speedo');
    this.ammoEl = this.el('ammo');
    this.toastEl = this.el('toast');
    this.feedEl = this.el('feed');
    this.hintEl = this.el('hint');
    this.crosshairEl = this.el('crosshair');
    this.hudEl = this.el('hud');
    this.minimap = this.el('minimap');
    // desynchronized: a live 2D canvas layered over the WebGL canvas
    // punches a 204x204 unpainted hole in the 3D view in Chromium
    // (SwiftShader and headed alike) — this flag keeps the two layers apart.
    this.minimapCtx = this.minimap.getContext('2d', { desynchronized: true });
    this.bigmap = this.el('bigmap');
    this.bigmapCanvas = this.el('bigmapCanvas');
    this.bigmapCtx = this.bigmapCanvas.getContext('2d', { desynchronized: true });
    this.startMenu = this.el('startMenu');
    this.pauseMenu = this.el('pauseMenu');
    this.endMenu = this.el('endMenu');
    this.endTitle = this.el('endTitle');
    this.endSub = this.el('endSub');
    this.continueBtn = this.el('continueBtn');
    this.toastTimer = 0;
    this.feedLines = [];
    this.buildings = [];
    this.mapTime = 0;
  }

  setBuildings(rects) {
    this.buildings = rects;
  }

  showHud(show) {
    this.hudEl.classList.toggle('hidden', !show);
  }
  showStart(hasSave) {
    this.startMenu.classList.remove('hidden');
    this.continueBtn.classList.toggle('hidden', !hasSave);
  }
  hideStart() {
    this.startMenu.classList.add('hidden');
  }
  showPause(show) {
    this.pauseMenu.classList.toggle('hidden', !show);
  }
  showEnd(title, sub, color) {
    this.endTitle.textContent = title;
    this.endTitle.style.color = color || '#ff4040';
    this.endSub.textContent = sub;
    this.endMenu.classList.remove('hidden');
  }
  hideEnd() {
    this.endMenu.classList.add('hidden');
  }
  toggleBigMap(show) {
    this.bigmap.classList.toggle('hidden', !show);
  }
  bigMapVisible() {
    return !this.bigmap.classList.contains('hidden');
  }

  setMoney(v) {
    this.moneyEl.textContent = `$${Math.floor(v).toLocaleString('en-US')}`;
  }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? STAR_ON : STAR_OFF;
    this.starsEl.textContent = n > 0 ? s : '';
    this.starsEl.style.color = n >= 3 ? '#ff5030' : '#ffd23e';
  }
  setClock(hours, minutes) {
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    this.clockEl.textContent = `${h}:${m}`;
  }
  setHealth(v, max) {
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    this.healthBarEl.style.width = `${pct}%`;
    this.healthBarEl.style.background = pct > 50
      ? 'linear-gradient(90deg,#2ee66b,#a8f04a)'
      : pct > 25 ? 'linear-gradient(90deg,#e6a02e,#f0d44a)' : 'linear-gradient(90deg,#e62e2e,#f04a4a)';
    this.healthLabelEl.textContent = `HEALTH ${Math.ceil(v)}`;
  }
  setSpeed(kmh, driving) {
    this.speedoEl.classList.toggle('hidden', !driving);
    if (driving) this.speedoEl.innerHTML = `${Math.round(kmh)} <small>km/h</small>`;
  }
  setAmmo(ammo, reserve, reloading) {
    this.ammoEl.textContent = reloading ? 'RELOADING…' : `PISTOL ${ammo} / ${reserve}`;
  }
  setObjective(text) {
    if (!text) {
      this.objectiveEl.classList.add('hidden');
      return;
    }
    this.objectiveEl.classList.remove('hidden');
    this.objectiveTextEl.textContent = text;
  }
  setCrosshair(show) {
    this.crosshairEl.classList.toggle('hidden', !show);
  }
  setHint(text) {
    this.hintEl.textContent = text || '';
  }

  toast(text, seconds = 3) {
    this.toastEl.textContent = text;
    this.toastTimer = seconds;
  }
  tickToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.textContent = '';
    }
  }

  feed(text) {
    this.feedLines.push(text);
    if (this.feedLines.length > 4) this.feedLines.shift();
    this.feedEl.innerHTML = this.feedLines.map((l) => `<div>› ${l}</div>`).join('');
  }

  // Top-down 2D map. `data` carries every blip the map needs.
  drawMap(ctx, size, data, timeNow) {
    const half = WORLD.cityHalf;
    const scale = size / (half * 2 + 130);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    ctx.clearRect(0, 0, size, size);
    // Ocean, sand, grass.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, 0, size, size);
    const [bx0, by0] = toMap(-half - 60, 215);
    const [bx1, by1] = toMap(half + 60, 295);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.fillStyle = '#69b455';
    ctx.fillRect(0, 0, size, by0);

    // Buildings.
    ctx.fillStyle = '#3d4a5a';
    for (const b of this.buildings) {
      const [x, y] = toMap(b.minX, b.minZ);
      ctx.fillRect(x, y, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Roads.
    ctx.strokeStyle = '#2e3138';
    ctx.lineWidth = Math.max(2, 12 * scale);
    for (const line of WORLD.roadLines) {
      const [x0, y0] = toMap(line, -half);
      const [x1, y1] = toMap(line, half);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const [ax0, ay0] = toMap(-half, line);
      const [ax1, ay1] = toMap(half, line);
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
    }
    // Plaza.
    ctx.fillStyle = '#c8b898';
    const [px, py] = toMap(0, 0);
    ctx.beginPath(); ctx.arc(px, py, 26 * scale, 0, Math.PI * 2); ctx.fill();

    // Mission marker — pulsing yellow diamond.
    if (data.marker) {
      const [mx, my] = toMap(data.marker.x, data.marker.z);
      const pulse = 1 + Math.sin(timeNow * 4) * 0.25;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23e';
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 2;
      const s = 7 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    // Pedestrians.
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (const p of data.peds) {
      const [x, y] = toMap(p.x, p.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Traffic cars.
    for (const c of data.trafficCars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // Police — flashing red/blue.
    const flash = Math.sin(timeNow * 9) > 0;
    for (const c of data.policeCars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillStyle = flash ? '#ff2020' : '#2040ff';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const c of data.cops) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillStyle = '#2040ff';
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    // Player — white arrow with heading.
    const [ux, uy] = toMap(data.player.x, data.player.z);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(Math.PI - data.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  updateMinimap(data, timeNow) {
    this.mapTime += 0.1;
    this.drawMap(this.minimapCtx, 210, data, timeNow);
    if (this.bigMapVisible()) this.drawMap(this.bigmapCtx, 640, data, timeNow);
  }
}
