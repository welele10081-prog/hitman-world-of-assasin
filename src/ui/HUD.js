import * as THREE from 'three';
import { ITEMS } from '../game/Items.js';
import { DISGUISES, OUTFITS } from '../entities/Outfits.js';
import { formatTime } from '../core/util.js';

const _v = new THREE.Vector3();

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'hud', root);
    this.overlay = el('canvas', 'hud-overlay', this.root);
    this.octx = this.overlay.getContext('2d');

    this.objectives = el('div', 'hud-objectives', this.root);
    this.alertBox = el('div', 'hud-alert', this.root);
    this.toasts = el('div', 'hud-toasts', this.root);
    this.prompts = el('div', 'hud-prompts', this.root);
    this.crosshair = el('div', 'hud-crosshair', this.root);
    this.bottomLeft = el('div', 'hud-bl', this.root);
    this.minimap = el('canvas', 'minimap', this.bottomLeft);
    this.minimap.width = 220;
    this.minimap.height = 220;
    this.mctx = this.minimap.getContext('2d');
    this.disguise = el('div', 'hud-disguise', this.bottomLeft);
    this.inventory = el('div', 'hud-inventory', this.root);
    this.health = el('div', 'hud-health', this.root, '<div class="hp-fill"></div>');
    this.timer = el('div', 'hud-timer', this.root);
    this.hint = el('div', 'hud-hint', this.root, '<b>Tab</b> карта · <b>Q</b> чутьё · <b>J</b> возможности · <b>Esc</b> пауза');
    this.hiddenBanner = el('div', 'hud-hidden', this.root, 'Вы в укрытии · <b>E</b> — выйти');
    this.tracker = el('div', 'hud-tracker', this.root);
    this.alertLevel = 'normal';
    this._lastInvKey = '';
    this._lastObjKey = '';
    this.mapLayer = null;
    this.mapLayerDisguise = null;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.overlay.width = window.innerWidth;
    this.overlay.height = window.innerHeight;
  }

  show(on) {
    this.root.style.display = on ? 'block' : 'none';
  }

  toast(text, kind = 'info') {
    const t = el('div', `toast toast-${kind}`, this.toasts, text);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3900);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  opportunity(o) {
    const t = el('div', 'toast toast-opp', this.toasts, `<div class="opp-label">ВОЗМОЖНОСТЬ</div><div class="opp-name">${o.name}</div><div class="opp-desc">${o.desc}</div><div class="opp-keys">J — отслеживать</div>`);
    setTimeout(() => t.classList.add('out'), 6500);
    setTimeout(() => t.remove(), 7200);
  }

  setAlert(level) {
    this.alertLevel = level;
    if (level === 'combat') this.game.audio?.play('spotted');
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const game = this.game;
    const pl = game.player;

    // Objectives
    const m = game.mission;
    const tracked = m.tracked;
    const step = m.currentStep(tracked);
    const objKey = m.targets.map((t) => t.eliminated).join() + (tracked?.id ?? '') + (step?.text ?? '') + m.canExit();
    if (objKey !== this._lastObjKey) {
      this._lastObjKey = objKey;
      let html = '<div class="obj-title">ЗАДАНИЕ</div>';
      for (const t of m.targets) {
        html += `<div class="obj ${t.eliminated ? 'done' : ''}"><span class="obj-mark"></span>Устранить: ${t.info.name}</div>`;
      }
      html += `<div class="obj ${m.canExit() ? '' : 'dim'}"><span class="obj-mark"></span>Покинуть территорию</div>`;
      if (tracked) {
        html += `<div class="obj-opp"><div class="obj-opp-name">◆ ${tracked.name}</div><div class="obj-opp-step">${step ? step.text : 'Выполнено'}</div></div>`;
      }
      this.objectives.innerHTML = html;
    }

    // Alert banner
    const lvl = game.alert.level;
    const comp = game.alert.isCompromised(pl.outfit);
    let alertText = '';
    let alertCls = '';
    if (lvl === 'combat') {
      alertText = 'ОБНАРУЖЕН · БОЙ';
      alertCls = 'red';
    } else if (lvl === 'search') {
      alertText = comp ? 'ИДУТ ПОИСКИ · МАСКИРОВКА РАСКРЫТА' : 'ИДУТ ПОИСКИ';
      alertCls = 'yellow';
    } else if (comp) {
      alertText = 'МАСКИРОВКА РАСКРЫТА';
      alertCls = 'yellow';
    }
    this.alertBox.textContent = alertText;
    this.alertBox.className = `hud-alert ${alertCls}`;
    this.alertBox.style.display = alertText ? 'block' : 'none';

    // Disguise / zone status
    const dname = DISGUISES[OUTFITS[pl.outfit].disguise].name;
    let status = '';
    let scls = '';
    if (pl.hiddenIn) {
      status = 'В укрытии';
      scls = 'ok';
    } else if (pl.hostileZone) {
      status = 'Враждебная зона';
      scls = 'red';
    } else if (pl.trespassing) {
      status = 'Посторонним вход воспрещён';
      scls = 'yellow';
    } else if (pl.holdingIllegal) {
      status = 'Оружие на виду';
      scls = 'yellow';
    }
    const enforcerNear = game.npcs.some((n) => !n.isDown && n.enforces.has(pl.disguise) && n.seesPlayer && n.playerDist < 8);
    if (!status && enforcerNear) {
      status = 'Рядом тот, кто может узнать';
      scls = 'white';
    }
    this.disguise.innerHTML = `<div class="dg-label">МАСКИРОВКА</div><div class="dg-name">${dname}</div><div class="dg-zone">${pl.zone?.name ?? ''}</div><div class="dg-status ${scls}">${status}</div>`;

    // Prompts
    const cur = game.interactions.current;
    let ph = '';
    for (const key of ['E', 'R']) {
      const c = cur[key];
      if (c) ph += `<div class="prompt ${c.disabled ? 'disabled' : ''}"><span class="key">${key}</span>${c.label}</div>`;
    }
    if (!pl.action && !pl.dragging && !pl.hiddenIn) {
      const tk = this._takedownPrompt(pl);
      if (tk) ph += `<div class="prompt"><span class="key">F</span>${tk}</div>`;
    }
    if (pl.action && pl.action.duration > 0.6) {
      const pct = Math.min(100, (pl.action.t / pl.action.duration) * 100);
      ph += `<div class="action-bar"><div style="width:${pct}%"></div></div>`;
    }
    this.prompts.innerHTML = ph;

    // Crosshair
    this.crosshair.style.display = pl.aiming ? 'block' : 'none';

    // Inventory
    const invKey = pl.inventory.map((i) => `${i.id}:${i.count}:${i.ammo}`).join('|') + `#${pl.selected}`;
    if (invKey !== this._lastInvKey) {
      this._lastInvKey = invKey;
      let h = `<div class="inv-slot ${pl.selected === -1 ? 'sel' : ''}"><span class="inv-key">0</span><span class="inv-icon">✋</span><span class="inv-name">Пустые руки</span></div>`;
      pl.inventory.forEach((it, i) => {
        const d = ITEMS[it.id];
        const extra = it.ammo !== undefined ? ` ${it.ammo}` : d.stack && it.count > 1 ? ` ×${it.count}` : '';
        h += `<div class="inv-slot ${pl.selected === i ? 'sel' : ''} ${d.illegal ? 'illegal' : ''}"><span class="inv-key">${i + 1}</span><span class="inv-icon">${d.icon}</span><span class="inv-name">${d.name}${extra}</span></div>`;
      });
      this.inventory.innerHTML = h;
    }

    // Health
    this.health.style.display = pl.health < 100 ? 'block' : 'none';
    this.health.firstChild.style.width = `${pl.health}%`;

    this.timer.textContent = formatTime(game.time);
    this.hiddenBanner.style.display = pl.hiddenIn ? 'block' : 'none';

    this._drawOverlay();
    this._drawMinimap();
  }

  _takedownPrompt(pl) {
    const game = this.game;
    let best = null;
    let bd = 1.6;
    for (const n of game.npcs) {
      if (n.isDown || n.hidden || n.state === 'victim' || n.state === 'falling') continue;
      const d = Math.hypot(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z);
      if (d > bd) continue;
      const ang = Math.abs(((Math.atan2(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z) - pl.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (ang > 1.3) continue;
      best = n;
      bd = d;
    }
    if (!best) return null;
    const behindAng = Math.abs(((Math.atan2(pl.pos.x - best.pos.x, pl.pos.z - best.pos.z) - best.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const behind = behindAng > 1.9;
    if (best.ledge && behind) return 'Столкнуть в воду';
    const def = pl.selectedDef;
    if (def?.lethalMelee) return behind ? `Устранить (${def.name.toLowerCase()})` : `Устранить (${def.name.toLowerCase()}) — спереди`;
    if (def?.melee === 'blunt') return 'Оглушить ударом';
    return behind ? 'Обезвредить (удушающий)' : 'Обезвредить (удар)';
  }

  _project(x, y, z) {
    _v.set(x, y, z).project(this.game.cameraRig.camera);
    return { x: ((_v.x + 1) / 2) * this.overlay.width, y: ((1 - _v.y) / 2) * this.overlay.height, behind: _v.z > 1 };
  }

  _drawOverlay() {
    const game = this.game;
    const ctx = this.octx;
    const W = this.overlay.width;
    const H = this.overlay.height;
    ctx.clearRect(0, 0, W, H);
    const pl = game.player;
    const cx = W / 2;
    const cy = H / 2;
    const camYaw = game.cameraRig.yaw;

    // Suspicion arcs around the screen centre
    for (const n of game.npcs) {
      if (n.isDown || n.awareness < 0.04 || !n.seesPlayer && n.state !== 'combat' && n.state !== 'search') continue;
      const a = Math.atan2(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z);
      const rel = -(a - camYaw); // 0 = straight ahead
      const ang = rel - Math.PI / 2;
      const r = 110;
      const lvl = Math.min(1, n.awareness);
      const combat = n.state === 'combat';
      ctx.strokeStyle = combat ? 'rgba(230,40,40,0.95)' : lvl > 0.6 ? `rgba(240,${Math.floor(200 - lvl * 160)},40,0.9)` : `rgba(255,255,255,${0.35 + lvl})`;
      ctx.lineWidth = 3 + lvl * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, ang - 0.18, ang + 0.18);
      ctx.stroke();
    }

    // Icons above suspicious NPCs / targets (instinct)
    const instinct = game.instinct > 0.5;
    for (const n of game.npcs) {
      if (n.hidden) continue;
      const headY = 2.25 * n.model.look.height;
      if (!n.isDown && (n.awareness > 0.25 || n.state === 'combat' || n.state === 'search' || n.state === 'investigate')) {
        const p = this._project(n.pos.x, headY, n.pos.z);
        if (!p.behind) {
          const d = Math.hypot(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z);
          if (d < 30) {
            const combat = n.state === 'combat';
            ctx.font = 'bold 22px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = combat ? '#ff3030' : n.awareness > 0.7 ? '#ffb030' : '#ffffff';
            ctx.fillText(combat ? '!' : n.awareness > 0.7 ? '!' : '?', p.x, p.y);
          }
        }
      }
      if (instinct && n.isTarget && n.alive) {
        const p = this._project(n.pos.x, headY + 0.1, n.pos.z);
        if (!p.behind) {
          ctx.fillStyle = '#ff3a3a';
          ctx.beginPath();
          ctx.moveTo(p.x - 8, p.y - 10);
          ctx.lineTo(p.x + 8, p.y - 10);
          ctx.lineTo(p.x, p.y);
          ctx.fill();
        }
      }
      if (instinct && !n.isDown && n.enforces.has(pl.disguise)) {
        const p = this._project(n.pos.x, headY, n.pos.z);
        if (!p.behind) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 4, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Tracked opportunity waypoint
    const m = game.mission;
    const step = m.currentStep(m.tracked);
    this.tracker.style.display = 'none';
    if (step && step.where) {
      const w = step.where();
      if (w) {
        const p = this._project(w.x, 1.6, w.z);
        const d = Math.hypot(w.x - pl.pos.x, w.z - pl.pos.z);
        let x = p.x;
        let y = p.y;
        if (p.behind) {
          x = W - x;
          y = H - 40;
        }
        x = Math.max(30, Math.min(W - 30, x));
        y = Math.max(60, Math.min(H - 60, y));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#f2c14e';
        ctx.lineWidth = 2;
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f2c14e';
        ctx.fillText(`${Math.round(d)} м`, x, y + 24);
      }
    }
  }

  // Static top-down layer of the level (walls, floors, water, zones for the current disguise).
  buildMapLayer(scale = 4) {
    const game = this.game;
    const b = game.level.bounds;
    const w = Math.ceil((b.maxX - b.minX) * scale);
    const h = Math.ceil((b.maxZ - b.minZ) * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const X = (x) => (x - b.minX) * scale;
    const Z = (z) => (z - b.minZ) * scale;
    ctx.fillStyle = '#1b2420';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16303c';
    ctx.fillRect(0, Z(28), w, h - Z(28));
    // zones
    const dis = game.player.disguise;
    for (const zn of game.level.zones) {
      let color = null;
      if (zn.id === 'grounds') color = '#26312a';
      else if (zn.allowed && !zn.allowed.has(dis)) color = zn.hostile ? 'rgba(160,30,30,0.55)' : 'rgba(170,110,30,0.4)';
      else if (['hall', 'gallery', 'terrace', 'restroom', 'courtyard', 'pier'].includes(zn.id)) color = '#303a33';
      else if (zn.allowed) color = 'rgba(60,110,70,0.35)';
      if (!color) continue;
      ctx.fillStyle = color;
      for (const r of zn.rects) ctx.fillRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * scale, (r[3] - r[1]) * scale);
    }
    // pier decks
    ctx.fillStyle = '#4a4034';
    ctx.fillRect(X(-0.5), Z(28), 3 * scale, 12 * scale);
    ctx.fillRect(X(-3), Z(40), 8 * scale, 6 * scale);
    ctx.fillRect(X(-37), Z(27), 4 * scale, 9 * scale);
    ctx.fillRect(X(55), Z(28), 4 * scale, 6 * scale);
    // walls / tall obstacles
    for (const col of game.collision.colliders) {
      if (col.tag === 'door') continue;
      if (col.type === 'box') {
        if (!col.move) continue;
        if (col.minZ >= 28 && col.maxZ > 60) continue; // water blockers
        const tall = col.h >= 1.3;
        ctx.fillStyle = tall ? (col.sight ? '#c9c3b4' : '#8fa6ad') : '#5b5a52';
        ctx.fillRect(X(col.minX), Z(col.minZ), Math.max(1, (col.maxX - col.minX) * scale), Math.max(1, (col.maxZ - col.minZ) * scale));
      } else {
        ctx.fillStyle = '#3f5a3e';
        ctx.beginPath();
        ctx.arc(X(col.x), Z(col.z), Math.max(1, col.r * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#a07040';
    for (const d of game.level.doors) ctx.fillRect(X(d.x) - 2, Z(d.z) - 2, 4, 4);
    this.mapLayer = c;
    this.mapScale = scale;
    this.mapLayerDisguise = dis;
  }

  _drawMinimap() {
    const game = this.game;
    if (!this.mapLayer || this.mapLayerDisguise !== game.player.disguise) this.buildMapLayer();
    const ctx = this.mctx;
    const W = this.minimap.width;
    const pl = game.player;
    const b = game.level.bounds;
    const s = this.mapScale;
    const zoom = 1.4;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0d1210';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(game.cameraRig.yaw + Math.PI);
    ctx.scale(zoom, zoom);
    ctx.translate(-(pl.pos.x - b.minX) * s, -(pl.pos.z - b.minZ) * s);
    ctx.drawImage(this.mapLayer, 0, 0);
    const X = (x) => (x - b.minX) * s;
    const Z = (z) => (z - b.minZ) * s;
    for (const n of game.npcs) {
      if (n.hidden) continue;
      const d = Math.hypot(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z);
      if (d > 45) continue;
      if (n.isDown) {
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(X(n.pos.x) - 3, Z(n.pos.z) - 3);
        ctx.lineTo(X(n.pos.x) + 3, Z(n.pos.z) + 3);
        ctx.moveTo(X(n.pos.x) + 3, Z(n.pos.z) - 3);
        ctx.lineTo(X(n.pos.x) - 3, Z(n.pos.z) + 3);
        ctx.stroke();
        continue;
      }
      let color = '#bfc4c8';
      if (n.isTarget) color = '#ff3434';
      else if (n.state === 'combat') color = '#ff5a2a';
      else if (n.awareness > 0.25) color = '#ffc040';
      else if (n.isGuard) color = '#e0a050';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(n.pos.x), Z(n.pos.z), n.isTarget ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // tracked waypoint
    const step = game.mission.currentStep(game.mission.tracked);
    const w = step?.where?.();
    if (w) {
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 2;
      ctx.strokeRect(X(w.x) - 4, Z(w.z) - 4, 8, 8);
    }
    ctx.restore();
    // player arrow (always pointing up, map rotates)
    ctx.save();
    ctx.translate(W / 2, W / 2);
    const rel = -(pl.yaw - game.cameraRig.yaw);
    ctx.rotate(rel);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
