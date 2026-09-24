import * as THREE from 'three';
import { ITEMS, makeItemMesh } from './Items.js';
import { dist2D } from '../core/util.js';
import { xrayMaterials } from '../entities/Humanoid.js';

// Spreads A* searches across frames.
export class PathQueue {
  constructor(game, perFrame = 4) {
    this.game = game;
    this.queue = [];
    this.perFrame = perFrame;
  }
  request(npc, x, z) {
    const existing = this.queue.find((r) => r.npc === npc);
    if (existing) {
      existing.x = x;
      existing.z = z;
      return;
    }
    this.queue.push({ npc, x, z });
  }
  update() {
    const nav = this.game.level.nav;
    for (let i = 0; i < this.perFrame && this.queue.length; i++) {
      const r = this.queue.shift();
      if (r.npc.isDown) continue;
      const path = nav.findPath(r.npc.pos.x, r.npc.pos.z, r.x, r.z);
      r.npc.setPath(path);
    }
  }
}

// Global alert state: normal -> (search <-> combat).
export class AlertSystem {
  constructor(game) {
    this.game = game;
    this.level = 'normal';
    this.compromised = new Set();
    this.lastKnown = null;
    this.searchCenter = null;
    this.timer = 0;
    this.lastSightingTime = -99;
  }

  isCompromised(outfit) {
    return this.compromised.has(outfit);
  }

  compromise(outfit, byNpc) {
    if (!this.compromised.has(outfit)) {
      this.compromised.add(outfit);
      this.game.hud.toast('Маскировка раскрыта!', 'danger');
      this.game.stats.compromised++;
    }
    this.lastKnown = this.game.player.pos.clone();
    if (byNpc?.isGuard) this.enterCombat(byNpc);
  }

  enterCombat() {
    this.lastKnown = this.game.player.pos.clone();
    this.lastSightingTime = this.game.time;
    if (this.level !== 'combat') {
      this.level = 'combat';
      this.game.stats.combat = true;
      this.game.hud.setAlert('combat');
      // Nearby guards join in.
      for (const npc of this.game.npcs) {
        if (!npc.isGuard || npc.isDown || npc.state === 'combat') continue;
        if (dist2D(npc.pos, this.game.player.pos) < 30) npc.startSearch(this.lastKnown);
      }
    }
    this.timer = 0;
  }

  reportSighting(pos) {
    this.lastKnown = pos.clone();
    this.lastSightingTime = this.game.time;
  }

  startSearch(pos) {
    this.searchCenter = { x: pos.x, z: pos.z };
    if (this.level === 'normal') {
      this.level = 'search';
      this.timer = 0;
      this.game.hud.setAlert('search');
      for (const npc of this.game.npcs) {
        if (!npc.isGuard || npc.isDown || npc.state === 'combat' || npc.state === 'search') continue;
        if (dist2D(npc.pos, pos) < 28) npc.startSearch(pos);
      }
    }
  }

  raise(kind, pos) {
    if (kind === 'body') this.startSearch(pos);
  }

  update(dt) {
    this.timer += dt;
    if (this.level === 'combat') {
      const anyoneSees = this.game.npcs.some((n) => n.state === 'combat' && n.seesPlayer && !n.isDown);
      if (anyoneSees) this.timer = 0;
      if (this.timer > 20) {
        this.level = 'search';
        this.timer = 0;
        this.searchCenter = this.lastKnown ? { x: this.lastKnown.x, z: this.lastKnown.z } : null;
        this.game.hud.setAlert('search');
        for (const npc of this.game.npcs) if (npc.state === 'combat') npc.startSearch(this.searchCenter ?? npc.pos);
      }
    } else if (this.level === 'search') {
      if (this.timer > 60) {
        this.level = 'normal';
        this.timer = 0;
        this.game.hud.setAlert('normal');
        this.game.hud.toast('Поиски прекращены');
      }
    }
  }
}

// Shooting, hits, damage.
export class Combat {
  constructor(game) {
    this.game = game;
  }

  // Ray against NPC capsules/heads and world geometry.
  raycastShot(origin, dir, maxDist, shooter, includeGround = false) {
    const game = this.game;
    let best = maxDist;
    let bestNpc = null;
    let head = false;
    const tmp = new THREE.Vector3();
    for (const npc of game.npcs) {
      if (npc === shooter || npc.hidden || (npc.isDown && npc.dragged)) continue;
      if (!npc.alive) continue;
      const scale = npc.model.look.height;
      if (npc.isDown) {
        const t = raySphere(origin, dir, tmp.set(npc.pos.x, 0.2, npc.pos.z), 0.45);
        if (t !== null && t < best) {
          best = t;
          bestNpc = npc;
          head = false;
        }
        continue;
      }
      const crouch = npc.anim.sit ? 0.45 : 0;
      const headPos = tmp.set(npc.pos.x, (1.72 - crouch) * scale, npc.pos.z);
      const th = raySphere(origin, dir, headPos, 0.14);
      if (th !== null && th < best) {
        best = th;
        bestNpc = npc;
        head = true;
      }
      const tb = rayCylinder(origin, dir, npc.pos.x, npc.pos.z, 0.26, 0.05, (1.55 - crouch) * scale);
      if (tb !== null && tb < best - 0.01) {
        best = tb;
        bestNpc = npc;
        head = false;
      }
    }
    const end = origin.clone().addScaledVector(dir, maxDist);
    const tw = game.collision.segmentHit(origin.x, origin.y, origin.z, end.x, end.y, end.z, 'bullets') * maxDist;
    let groundT = Infinity;
    if (dir.y < -1e-4) groundT = -origin.y / dir.y;
    const worldT = Math.min(tw, groundT);
    if (bestNpc && best < worldT) {
      return { npc: bestNpc, head, point: origin.clone().addScaledVector(dir, best), dist: best };
    }
    if (worldT < maxDist) return { npc: null, point: origin.clone().addScaledVector(dir, worldT), dist: worldT };
    return { npc: null, point: includeGround ? end : null, dist: maxDist };
  }

  damageNpc(npc, amount, { source, head, by } = {}) {
    if (!npc.alive) return;
    this.game.effects.blood(new THREE.Vector3(npc.pos.x, head ? 1.7 : 1.2, npc.pos.z));
    npc.health -= amount;
    if (npc.health <= 0 || !npc.conscious) {
      npc.die({ by, method: source, silent: false });
    } else {
      npc.bark('shot', true);
      if (npc.isGuard) npc.enterCombat();
      else npc.startFlee(by?.pos ?? npc.pos, true);
      this.game.alert.compromise(this.game.player.outfit, npc);
    }
  }

  npcShoot(npc, target) {
    const game = this.game;
    const d = dist2D(npc.pos, target.pos);
    let chance = d < 5 ? 0.5 : d < 12 ? 0.33 : d < 22 ? 0.2 : 0.1;
    if (target.crouching) chance *= 0.8;
    if (target.running) chance *= 0.75;
    game.audio?.play('shot', npc.pos, 1);
    game.noise(npc.pos, 40, 'gunshot', npc);
    game.effects.muzzleFlash(npc.model.boneMap.rHand);
    if (Math.random() < chance) {
      target.takeDamage(7 + Math.random() * 5);
    } else {
      const miss = new THREE.Vector3(target.pos.x + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 1.5, target.pos.z + (Math.random() - 0.5) * 1.5);
      game.effects.impact(miss);
    }
  }
}

function raySphere(o, d, c, r) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function rayCylinder(o, d, cx, cz, r, y0, y1) {
  const ox = o.x - cx;
  const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= 0) return null;
  const y = o.y + d.y * t;
  if (y < y0 || y > y1) return null;
  return t;
}

// Items lying around in the world.
export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(id, x, z, extra = {}, y = null) {
    const mesh = makeItemMesh(id, this.game.materials);
    const surface = y ?? 0.05;
    mesh.position.set(x, surface, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    if (id === 'coin' || id === 'keycard_vault' || id === 'key_cellar') mesh.scale.setScalar(1.6);
    this.game.scene.add(mesh);
    const xray = makeItemMesh(id, this.game.materials);
    xray.traverse((m) => {
      if (m.isMesh) m.material = xrayMaterials.item;
    });
    xray.renderOrder = 11;
    mesh.add(xray);
    xray.visible = false;
    const pk = { id, x, z, y: surface, mesh, xray, ...extra };
    this.list.push(pk);
    return pk;
  }

  spawnClothes(outfit, x, z) {
    const pk = this.spawn('clothes', x, z, { outfit });
    return pk;
  }

  remove(pk) {
    const i = this.list.indexOf(pk);
    if (i >= 0) this.list.splice(i, 1);
    this.game.scene.remove(pk.mesh);
  }

  nearest(pos, maxD, filter = null) {
    let best = null;
    let bd = maxD;
    for (const pk of this.list) {
      if (filter && !filter(pk)) continue;
      const d = Math.hypot(pk.x - pos.x, pk.z - pos.z);
      if (d < bd) {
        bd = d;
        best = pk;
      }
    }
    return best;
  }

  visibleWeapon(npc) {
    for (const pk of this.list) {
      if (!ITEMS[pk.id]?.illegal) continue;
      if (npc.canSeePoint(pk.x, 0.1, pk.z, 10).visible) return pk;
    }
    return null;
  }

  setXray(on) {
    for (const pk of this.list) pk.xray.visible = on;
  }
}

// Thrown objects: parabolic flight; knock out / kill / make noise on landing.
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(id, from, to, targetNpc, thrower) {
    const mesh = makeItemMesh(id, this.game.materials);
    mesh.position.copy(from);
    this.game.scene.add(mesh);
    const d = from.distanceTo(to);
    const time = Math.max(0.25, d / 16);
    const vel = new THREE.Vector3().subVectors(to, from).divideScalar(time);
    vel.y += 0.5 * 9.8 * time;
    this.list.push({ id, mesh, pos: from.clone(), vel, t: 0, time, target: targetNpc, thrower });
  }

  update(dt) {
    const game = this.game;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      p.vel.y -= 9.8 * dt;
      const prev = p.pos.clone();
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 12;
      // hit NPC?
      let hitNpc = null;
      for (const npc of game.npcs) {
        if (npc.isDown || npc.hidden) continue;
        const dx = npc.pos.x - p.pos.x;
        const dz = npc.pos.z - p.pos.z;
        if (dx * dx + dz * dz < 0.35 * 0.35 && p.pos.y > 0.2 && p.pos.y < 1.9) {
          hitNpc = npc;
          break;
        }
      }
      const wallT = game.collision.segmentHit(prev.x, prev.y, prev.z, p.pos.x, p.pos.y, p.pos.z, 'bullets');
      const landed = p.pos.y <= 0.03 || wallT < 1;
      if (!hitNpc && !landed) continue;
      this.list.splice(i, 1);
      game.scene.remove(p.mesh);
      const def = ITEMS[p.id];
      if (hitNpc) {
        if (def.lethalMelee) {
          hitNpc.die({ by: p.thrower, method: p.id });
          game.effects.blood(new THREE.Vector3(hitNpc.pos.x, 1.4, hitNpc.pos.z));
        } else if (p.id !== 'coin') {
          hitNpc.knockOut({ by: p.thrower });
        } else {
          hitNpc.startDistracted(p.pos);
        }
        game.noise(p.pos, 5, 'thud', p.thrower);
        game.audio?.play('punch', p.pos, 0.8);
        if (p.id !== 'coin' && p.id !== 'wine_bottle') game.pickups.spawn(p.id, hitNpc.pos.x + 0.4, hitNpc.pos.z + 0.3);
        continue;
      }
      if (wallT < 1) p.pos.lerpVectors(prev, p.pos, Math.max(0, wallT - 0.05));
      const nav = game.level.nav;
      const land = nav.nearestWalkableWorld(p.pos.x, p.pos.z) ?? p.pos;
      if (p.id === 'wine_bottle') {
        game.audio?.play('glass', p.pos, 1);
        game.noise(p.pos, 11, 'glass', p.thrower);
      } else {
        game.audio?.play(p.id === 'coin' ? 'coin' : 'clank', p.pos, 0.9);
        game.noise(land, p.id === 'coin' ? 8 : 9, p.id === 'coin' ? 'coin' : 'item', p.thrower);
        game.pickups.spawn(p.id, land.x, land.z);
      }
    }
  }
}

// Simple visual effects (flashes, sparks, blood, splashes).
export class Effects {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this.flashLight = new THREE.PointLight(0xffc070, 0, 6, 2);
    game.scene.add(this.flashLight);
    this.flashT = 0;
    this.geo = new THREE.SphereGeometry(1, 6, 4);
    this.mats = {
      spark: new THREE.MeshBasicMaterial({ color: 0xffd080 }),
      dust: new THREE.MeshBasicMaterial({ color: 0xbfb4a0, transparent: true, opacity: 0.7 }),
      blood: new THREE.MeshBasicMaterial({ color: 0x6a0808 }),
      water: new THREE.MeshBasicMaterial({ color: 0xd8e8f0, transparent: true, opacity: 0.8 }),
      flash: new THREE.MeshBasicMaterial({ color: 0xfff0b0 }),
    };
  }

  _burst(pos, mat, n, speed, size, life, gravity = 9.8) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, mat);
      m.scale.setScalar(size * (0.5 + Math.random()));
      m.position.copy(pos);
      this.game.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed);
      this.particles.push({ m, v, life, t: 0, gravity });
    }
  }

  muzzleFlash(bone) {
    const p = new THREE.Vector3();
    bone.getWorldPosition(p);
    this.flashLight.position.copy(p);
    this.flashLight.intensity = 8;
    this.flashT = 0.06;
    this._burst(p, this.mats.flash, 3, 1, 0.03, 0.05, 0);
  }

  impact(pos) {
    this._burst(pos, this.mats.dust, 6, 2.5, 0.03, 0.4);
    this._burst(pos, this.mats.spark, 3, 4, 0.012, 0.15);
  }

  blood(pos) {
    this._burst(pos, this.mats.blood, 10, 2.2, 0.025, 0.6);
  }

  splash(pos) {
    this._burst(new THREE.Vector3(pos.x, -0.3, pos.z), this.mats.water, 24, 4, 0.06, 0.9);
  }

  update(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flashLight.intensity = 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      p.v.y -= p.gravity * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.m.position.y < 0.01 && p.gravity > 0) {
        p.m.position.y = 0.01;
        p.v.set(0, 0, 0);
      }
      if (p.t > p.life) {
        this.game.scene.remove(p.m);
        this.particles.splice(i, 1);
      }
    }
  }
}
