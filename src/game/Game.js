import * as THREE from 'three';
import { Input } from '../core/Input.js';
import { Renderer } from '../render/Renderer.js';
import { Materials } from '../render/Materials.js';
import { CollisionWorld } from '../world/Collision.js';
import { Level } from '../world/Level.js';
import { buildVilla } from '../levels/villa.js';
import { villaNPCs } from '../levels/villaNPCs.js';
import { CameraRig } from './CameraRig.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { PathQueue, AlertSystem, Combat, Pickups, Projectiles, Effects } from './systems.js';
import { Interactions } from './Interactions.js';
import { Barks } from './Barks.js';
import { Audio } from './Audio.js';
import { Mission } from './Mission.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { DISGUISES, OUTFITS } from '../entities/Outfits.js';
import { dist2D } from '../core/util.js';

const SETTINGS_KEY = 'silent-contract-settings';
const PROGRESS_KEY = 'silent-contract-progress';

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

const INDOOR = [
  [-20.2, -14.2, 20.2, 6.2, 4.5],
  [-44.2, -14.2, -29.8, -1.8, 4.0],
  [-40.1, 17.9, -29.9, 27.1, 3.6],
  [-46, -40, -34, -30, 3.2],
  [42, -8, 48, -2, 3.0],
  [28, -8, 40, 2, 3.0],
];

export class Game {
  constructor(root) {
    this.root = root;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.settings = loadJSON(SETTINGS_KEY, { quality: 'high', sensitivity: 1, volume: 0.8, invertY: false });
    const qp = new URLSearchParams(location.search).get('quality');
    if (qp) this.settings.quality = qp;
    this.progress = loadJSON(PROGRESS_KEY, { challenges: {}, bestStars: 0 });
    this.renderer = new Renderer(root, this.settings.quality);
    this.input = new Input(this.renderer.domElement);
    this.materials = new Materials();
    this.audio = new Audio(this);
    this.uiRoot = document.createElement('div');
    this.uiRoot.className = 'ui-root';
    root.appendChild(this.uiRoot);
    this.screens = new Screens(this, this.uiRoot);
    this.state = 'loading';
    this.clock = new THREE.Timer();
    this.time = 0;
    this.instinct = 0;
    this.frameTimes = [];
    this.titleT = 0;

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.debug) this.pause();
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
  }

  async boot() {
    this.screens.loading();
    await new Promise((r) => setTimeout(r, 30));
    this.buildWorld();
    this.applySettings();
    this.screens.title();
    this.state = 'title';
    this.hud.show(false);
    const loop = (ts) => {
      requestAnimationFrame(loop);
      this.frame(ts);
    };
    loop();
  }

  buildWorld() {
    this.scene = new THREE.Scene();
    this.collision = new CollisionWorld();
    this.cameraRig = new CameraRig(this);
    this.renderer.setup(this.scene, this.cameraRig.camera);
    this.level = new Level(this);
    buildVilla(this.level);
    this.level.builder.finalize();
    this.level.buildNav();

    this.stats = {
      shotsFired: 0,
      nonTargetKills: 0,
      pacified: 0,
      bodiesFound: 0,
      bodiesHidden: 0,
      spotted: false,
      witnessed: false,
      compromised: 0,
      combat: false,
      suitOnly: true,
    };
    this.pathQueue = new PathQueue(this, 4);
    this.alert = new AlertSystem(this);
    this.combat = new Combat(this);
    this.pickups = new Pickups(this);
    this.projectiles = new Projectiles(this);
    this.effects = new Effects(this);
    this.interactions = new Interactions(this);
    this.barks = new Barks(this, this.uiRoot);
    this.hud = new HUD(this, this.uiRoot);
    this.mission = new Mission(this);

    const s = this.level.point('start');
    this.player = new Player(this, s.x, s.z, s.yaw);
    this.npcs = villaNPCs().map((def) => {
      const p = this.level.point(def.point);
      return new NPC(this, { ...def, x: p.x, z: p.z, yaw: p.yaw });
    });
    this.characters = [this.player, ...this.npcs];
    this.mission.init();
    this.time = 0;
    this.instinct = 0;
    this.cameraRig.yaw = s.yaw;
    this.cameraRig.pivot.set(s.x, 1.6, s.z);
    // Let routines settle so the villa is already "alive".
    for (const n of this.npcs) n._startStep();
  }

  disposeWorld() {
    this.barks?.clear();
    this.hud?.root.remove();
    this.barks?.layer.remove();
    this.barks?.subs.remove();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.scene.clear();
  }

  applySettings() {
    const s = this.settings;
    this.cameraRig.sensitivity = 0.0022 * s.sensitivity;
    this.cameraRig.invertY = s.invertY;
    this.audio.setVolume(s.volume);
  }

  saveSettings() {
    saveJSON(SETTINGS_KEY, this.settings);
  }

  // ------------------------------------------------------------ state changes
  startMission() {
    this.screens.hide();
    this.hud.show(true);
    this.state = 'playing';
    this.input.requestLock();
    this.hud.toast('Вилла «Серено». Найдите и устраните цели.', 'objective');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.exitLock();
    this.screens.pause();
  }

  resume() {
    this.screens.hide();
    this.state = 'playing';
    this.input.requestLock();
  }

  openMap() {
    this.state = 'map';
    this.input.exitLock();
    this.screens.map(false);
  }

  closeMap() {
    this.resume();
  }

  restart() {
    this.disposeWorld();
    this.buildWorld();
    this.applySettings();
    this.startMission();
  }

  quitToTitle() {
    this.disposeWorld();
    this.buildWorld();
    this.applySettings();
    this.hud.show(false);
    this.state = 'title';
    this.screens.title();
  }

  endMission(success) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.input.exitLock();
    this.hud.show(false);
    const res = this.mission.results();
    if (success) {
      for (const c of res.challenges) if (c.done) this.progress.challenges[c.name] = true;
      this.progress.bestStars = Math.max(this.progress.bestStars ?? 0, res.stars);
      saveJSON(PROGRESS_KEY, this.progress);
    }
    this.screens.results(success, res);
  }

  onPlayerDied() {
    this.hud.toast('Вы погибли', 'danger');
    setTimeout(() => this.endMission(false), 2500);
  }

  onNpcDown(npc, info) {
    this.mission.onNpcDown(npc, info);
  }

  onBodyFound(body, finder) {
    this.mission.onBodyFound(body, finder);
  }

  onDisguiseChanged(outfit) {
    const d = OUTFITS[outfit].disguise;
    if (d !== 'suit') this.stats.suitOnly = false;
    this.hud.toast(`Маскировка: ${DISGUISES[d].name}`);
    this.hud.buildMapLayer();
  }

  // ------------------------------------------------------------ world queries
  noise(pos, radius, kind, source) {
    const distracting = ['coin', 'item', 'impact', 'thud', 'glass', 'silencedShot'].includes(kind);
    const listeners = [];
    for (const n of this.npcs) {
      if (n === source || n.isDown) continue;
      const d = dist2D(n.pos, pos);
      if (d <= radius) listeners.push({ n, d });
    }
    listeners.sort((a, b) => a.d - b.d);
    if (distracting) {
      // Only the closest one or two actually walk over; others just glance.
      let investigators = 0;
      for (const { n, d } of listeners) {
        if (investigators < (kind === 'glass' ? 2 : 1) && ['routine', 'suspicious', 'distracted'].includes(n.state)) {
          n.hearNoise({ pos, radius, kind, source });
          investigators++;
        } else if (n.state === 'routine' && d < radius) {
          n.glanceAt = { x: pos.x, z: pos.z, t: 2 };
        }
      }
    } else {
      for (const { n } of listeners) n.hearNoise({ pos, radius, kind, source });
    }
  }

  findNearestGuard(pos, exclude) {
    let best = null;
    let bd = Infinity;
    for (const n of this.npcs) {
      if (!n.isGuard || n.isDown || n === exclude || n.state === 'combat') continue;
      const d = dist2D(n.pos, pos);
      if (d < bd && d < 60) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  isIndoor(x, z) {
    for (const r of INDOOR) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return r[4];
    return 0;
  }

  // ------------------------------------------------------------ main loop
  frame(ts) {
    this.clock.update(ts);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'title' || this.state === 'loading') this.titleCamera(dt);
    else if (this.state === 'paused' || this.state === 'map' || this.state === 'ended') {
      /* frozen */
    }
    if (this.scene) this.renderer.render(this.time, this.instinct, this.damageFx ?? 0);
    this.input.endFrame();
  }

  titleCamera(dt) {
    this.titleT += dt * 0.04;
    const cam = this.cameraRig.camera;
    const a = this.titleT + 2.2;
    cam.position.set(Math.cos(a) * 46, 16, Math.sin(a) * 34 + 10);
    cam.lookAt(0, 2, 2);
    this.level.update(dt, []);
    if (this.level.water) this.level.water.material.uniforms.time.value += dt * 0.4;
  }

  update(dt) {
    const input = this.input;
    this.time += dt;

    // Global keys
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      this.pause();
      return;
    }
    if (input.pressed('Tab') || input.pressed('KeyM')) {
      this.openMap();
      return;
    }
    if (input.pressed('KeyJ')) this.mission.trackNext();
    const wantInstinct = input.isDown('KeyQ') && this.player.alive;
    this.instinct += ((wantInstinct ? 1 : 0) - this.instinct) * Math.min(1, dt * 8);

    // Simulation
    const pl = this.player;
    pl.update(dt);
    if (pl.dragging) pl.updateDragged(dt);
    this.pathQueue.update();
    for (const n of this.npcs) n.update(dt);
    this._separate();
    for (const c of this.characters) if (c.collides && !c.hidden && !c.isDown) c.resolveCollision();
    this.level.update(dt, this.characters);
    this.projectiles.update(dt);
    this.effects.update(dt);
    this.alert.update(dt);
    this.mission.update(dt);

    // Camera & animation
    this.cameraRig.update(dt, pl.pos, { aiming: pl.aiming, crouch: pl.crouch, hidden: !!pl.hiddenIn });
    const camPos = this.cameraRig.camera.position;
    this.frameIndex = (this.frameIndex ?? 0) + 1;
    for (const n of this.npcs) {
      const far = Math.hypot(n.pos.x - camPos.x, n.pos.z - camPos.z) > 55;
      if (n.hidden) continue;
      if (far && (this.frameIndex + n.id) % 3 !== 0) {
        n.model.group.position.copy(n.pos);
        n.model.group.rotation.y = n.yaw;
        continue;
      }
      n.syncModel(far ? dt * 3 : dt);
    }
    pl.syncModel(dt);

    // Instinct x-ray
    const xr = this.instinct > 0.5;
    if (xr !== this._xrayOn) {
      this._xrayOn = xr;
      this.pickups.setXray(xr);
    }
    for (const n of this.npcs) {
      if (!xr || n.hidden || dist2D(n.pos, pl.pos) > 45) n.model.setXray(null);
      else n.model.setXray(n.isDown ? 'body' : n.isTarget ? 'target' : n.enforces.has(pl.disguise) ? 'enforcer' : n.isGuard ? 'guard' : 'civilian');
    }
    this.damageFx = Math.max(0, 1 - (this.time - pl.lastDamage) * 1.5) * 0.8 + (pl.health < 40 ? 0.3 : 0);

    this.barks.update(dt);
    this.hud.update(dt);
    this.audio.update(dt);
    this._autoQuality(dt);
  }

  // Debug helper: advance the simulation without rendering.
  simulate(seconds, dt = 0.05) {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      this.update(dt);
      this.input.endFrame();
    }
    return this.time;
  }

  _separate() {
    const list = this.characters;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.isDown || a.hidden || !a.collides) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.isDown || b.hidden || !b.collides) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius - 0.1;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          const aw = a.isPlayer || a.state === 'victim' ? 0.2 : 1;
          const bw = b.isPlayer || b.state === 'victim' ? 0.2 : 1;
          a.pos.x -= nx * push * aw;
          a.pos.z -= nz * push * aw;
          b.pos.x += nx * push * bw;
          b.pos.z += nz * push * bw;
        }
      }
    }
  }

  _autoQuality(dt) {
    if (this.qualityChecked || this.settings.quality !== 'high') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 240) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.qualityChecked = true;
    if (avg > 0.03 && this.renderer.gtao) {
      this.renderer.gtao.enabled = false;
      this.hud.toast('Затенение GTAO отключено для плавности (Настройки → Качество)');
    }
  }
}
