import * as THREE from 'three';
import { Character } from './Character.js';
import { ITEMS, makeItemMesh } from '../game/Items.js';
import { DISGUISES, OUTFITS } from './Outfits.js';
import { clamp, wrapAngle, yawTo, dist2D } from '../core/util.js';

// The player: an original character codenamed "Voron" (Raven).
export class Player extends Character {
  constructor(game, x, z, yaw) {
    super(game, {
      outfit: 'agent',
      look: { skin: 0xd9b596, hair: 0x201812, hairStyle: 'short', build: 1.02, height: 1.02 },
      name: 'Ворон',
      x,
      z,
      yaw,
    });
    this.isPlayer = true;
    this.inventory = [
      { id: 'pistol', count: 1, ammo: 12 },
      { id: 'fiberwire', count: 1 },
      { id: 'coin', count: 3 },
    ];
    this.selected = -1;
    this.crouching = false;
    this.running = false;
    this.aiming = false;
    this.state = 'free';
    this.action = null;
    this.dragging = null;
    this.hiddenIn = null;
    this.lastDamage = -99;
    this.illegalTimer = 0; // > 0 while doing something plainly illegal
    this.illegalKind = null;
    this.zone = null;
    this.trespassing = false;
    this.fireCooldown = 0;
    this.heldMesh = null;
    this.heldId = null;
    this.footstepTimer = 0;
  }

  get selectedItem() {
    return this.selected >= 0 ? this.inventory[this.selected] : null;
  }

  get selectedDef() {
    const it = this.selectedItem;
    return it ? ITEMS[it.id] : null;
  }

  // Visible, suspicious things the player is doing right now (for NPC perception).
  get holdingIllegal() {
    const d = this.selectedDef;
    return !!(d && d.illegal && !this.hiddenIn);
  }

  hasItem(id) {
    return this.inventory.some((i) => i.id === id && i.count > 0);
  }

  addItem(id, count = 1, extra = {}) {
    const def = ITEMS[id];
    const existing = this.inventory.find((i) => i.id === id);
    if (existing && (def.stack || def.weapon)) {
      if (def.weapon) existing.ammo = (existing.ammo ?? 0) + (extra.ammo ?? 6);
      else existing.count += count;
    } else {
      this.inventory.push({ id, count, ...extra });
    }
    this.game.hud.toast(`Получено: ${def.name}`);
  }

  removeItem(id, count = 1) {
    const i = this.inventory.findIndex((it) => it.id === id);
    if (i < 0) return;
    const it = this.inventory[i];
    it.count -= count;
    if (it.count <= 0) {
      this.inventory.splice(i, 1);
      if (this.selected === i) this.selected = -1;
      else if (this.selected > i) this.selected--;
    }
  }

  flagIllegal(kind, time = 0.6) {
    this.illegalTimer = Math.max(this.illegalTimer, time);
    this.illegalKind = kind;
  }

  // --- actions -------------------------------------------------------------
  startAction(name, duration, { onDone, onUpdate, lockMove = true, pose = null, illegal = null, cancelable = false } = {}) {
    this.action = { name, t: 0, duration, onDone, onUpdate, lockMove, pose, illegal, cancelable };
  }

  cancelAction() {
    this.action = null;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    this.illegalTimer = Math.max(0, this.illegalTimer - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (!this.alive) {
      this.anim.lying = Math.min(1, this.anim.lying + dt * 2);
      this.syncModel(dt);
      return;
    }
    if (this.state === 'exiting') {
      this.syncModel(dt);
      return;
    }

    // Health regeneration after a while without damage.
    if (game.time - this.lastDamage > 6 && this.health < 100) this.health = Math.min(100, this.health + dt * 8);

    // Zone / trespassing
    const acc = game.level.accessAt(this.pos.x, this.pos.z, this.disguise);
    this.zone = acc.zone;
    this.trespassing = !acc.allowed;
    this.hostileZone = !acc.allowed && acc.zone?.hostile;

    if (this.hiddenIn) {
      this.anim.speed = 0;
      if (input.pressed('KeyE')) this.leaveHiding();
      return;
    }

    // Item selection
    if (!this.action) this._handleSelection(input);

    // Current timed action
    let lockMove = false;
    if (this.action) {
      const a = this.action;
      a.t += dt;
      if (a.illegal) this.flagIllegal(a.illegal, 0.3);
      a.onUpdate?.(a.t / a.duration, dt);
      lockMove = a.lockMove;
      if (a.t >= a.duration) {
        this.action = null;
        a.onDone?.();
      } else if (a.cancelable && (input.pressed('KeyE') || input.pressed('KeyR'))) {
        this.action = null;
      }
    }

    // Crouch / run / aim
    if (input.pressed('KeyC') || input.pressed('ControlLeft')) this.crouching = !this.crouching;
    const def = this.selectedDef;
    const canAim = def && (def.weapon || def.throwable) && !this.dragging && !this.action;
    this.aiming = !!(canAim && input.mouseDown(2));
    this.running = input.isDown('ShiftLeft') && !this.crouching && !this.dragging && !this.aiming;

    // Movement relative to the camera
    let mx = 0;
    let mz = 0;
    if (!lockMove) {
      if (input.isDown('KeyW')) mz += 1;
      if (input.isDown('KeyS')) mz -= 1;
      if (input.isDown('KeyA')) mx -= 1;
      if (input.isDown('KeyD')) mx += 1;
    }
    const camYaw = game.cameraRig.yaw;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let dx = fx * mz + rx * mx;
    let dz = fz * mz + rz * mx;
    const len = Math.hypot(dx, dz);
    let speed = 0;
    if (len > 0.01) {
      dx /= len;
      dz /= len;
      speed = this.dragging ? 1.35 : this.aiming ? 1.7 : this.crouching ? 1.5 : this.running ? 5.2 : 2.3;
      this.pos.x += dx * speed * dt;
      this.pos.z += dz * speed * dt;
      if (!this.aiming) {
        const target = this.dragging ? Math.atan2(dx, dz) : Math.atan2(dx, dz);
        this.yaw = approach(this.yaw, target, 12 * dt);
      }
      this.footstepTimer -= dt * speed;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 1.4;
        if (this.running) game.noise(this.pos, 4.5, 'footsteps', this);
      }
    }
    if (this.aiming) this.yaw = approach(this.yaw, camYaw, 18 * dt);

    // Use item (fire / throw)
    if (!this.action && !this.dragging && input.mouseClicked(0) && def) {
      if (def.weapon) this.fire();
      else if (def.throwable && this.aiming) this.throwSelected();
    }

    // Takedowns
    if (!this.action && !this.dragging && input.pressed('KeyF')) this.tryTakedown();

    // Interactions (E / R)
    game.interactions.update(this, dt);

    // Drop selected item
    if (!this.action && input.pressed('KeyG') && def && !def.key) this.dropSelected();

    this.crouch = this.crouching ? Math.min(1, this.crouch + dt * 5) : Math.max(0, this.crouch - dt * 5);

    // Held item mesh
    this._updateHeldMesh();

    // Animation
    this.anim.crouch = this.crouch;
    this.anim.pose = this.action?.pose ?? (this.dragging ? 'drag' : this.aiming ? (def?.weapon ? 'aim' : 'throw') : def?.weapon ? 'pistolDown' : null);
    this.anim.aimPitch = this.aiming ? -game.cameraRig.pitch * 0.9 : 0;
  }

  _handleSelection(input) {
    for (let i = 1; i <= 9; i++) {
      if (input.pressed(`Digit${i}`)) {
        const idx = i - 1;
        if (idx < this.inventory.length) this.selected = this.selected === idx ? -1 : idx;
      }
    }
    if (input.pressed('Digit0') || input.pressed('KeyH')) this.selected = -1;
    if (input.wheel !== 0 && this.inventory.length > 0 && !input.mouseDown(2)) {
      let s = this.selected + input.wheel;
      if (s < -1) s = this.inventory.length - 1;
      if (s >= this.inventory.length) s = -1;
      this.selected = s;
    }
  }

  _updateHeldMesh() {
    const it = this.selectedItem;
    const id = it && !ITEMS[it.id].key && !ITEMS[it.id].poison && it.id !== 'fiberwire' ? it.id : null;
    if (id === this.heldId) return;
    this.model.detach('held');
    this.heldId = id;
    if (id) {
      const mesh = makeItemMesh(id, this.game.materials);
      mesh.position.set(0, -0.09, 0.02);
      if (id === 'pistol') mesh.rotation.set(-Math.PI / 2, 0, 0);
      this.model.attach('rHand', mesh, 'held');
    }
  }

  // --- combat --------------------------------------------------------------
  fire() {
    const it = this.selectedItem;
    if (this.fireCooldown > 0) return;
    if (!it.ammo || it.ammo <= 0) {
      this.game.hud.toast('Нет патронов');
      this.fireCooldown = 0.4;
      return;
    }
    it.ammo--;
    this.fireCooldown = 0.32;
    const game = this.game;
    game.cameraRig.shake = Math.max(game.cameraRig.shake, 0.25);
    this.flagIllegal('shooting', 1.2);
    game.audio?.play('shotSilenced', this.pos, 1);
    game.noise(this.pos, 8, 'silencedShot', this);
    game.stats.shotsFired++;
    const { origin, dir } = game.cameraRig.aimRay();
    // If not aiming, shoot from the hip toward where the character faces.
    if (!this.aiming) {
      dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      origin.set(this.pos.x, 1.35, this.pos.z);
    }
    const hit = game.combat.raycastShot(origin, dir, 80, this);
    game.effects.muzzleFlash(this.model.boneMap.rHand);
    if (hit.npc) {
      game.combat.damageNpc(hit.npc, hit.head ? 999 : 55, { source: 'pistol', head: hit.head, by: this });
    } else if (hit.point) {
      game.effects.impact(hit.point);
      game.noise(hit.point, 4, 'impact', this);
    }
  }

  throwSelected() {
    const it = this.selectedItem;
    const game = this.game;
    const id = it.id;
    const { origin, dir } = game.cameraRig.aimRay();
    const hit = game.combat.raycastShot(origin, dir, 30, this, true);
    let target = hit.point;
    if (!target) target = origin.clone().addScaledVector(dir, 20);
    this.startAction('throw', 0.35, { pose: 'throw', lockMove: false });
    game.projectiles.spawn(id, new THREE.Vector3(this.pos.x, 1.6, this.pos.z), target, hit.npc ?? null, this);
    this.removeItem(id, 1);
    game.audio?.play('throw', this.pos, 0.5);
  }

  dropSelected() {
    const it = this.selectedItem;
    if (!it) return;
    const extra = it.ammo !== undefined ? { ammo: it.ammo } : {};
    const x = this.pos.x + Math.sin(this.yaw) * 0.5;
    const z = this.pos.z + Math.cos(this.yaw) * 0.5;
    this.game.pickups.spawn(it.id, x, z, extra);
    if (ITEMS[it.id].illegal) this.flagIllegal('dropWeapon', 0.4);
    if (ITEMS[it.id].stack && it.count > 1) it.count--;
    else {
      this.inventory.splice(this.selected, 1);
      this.selected = -1;
    }
  }

  tryTakedown() {
    const game = this.game;
    let best = null;
    let bestD = 1.6;
    for (const npc of game.npcs) {
      if (npc.isDown || npc.hidden || npc.state === 'dying') continue;
      const d = dist2D(this.pos, npc.pos);
      if (d > bestD) continue;
      const ang = Math.abs(wrapAngle(yawTo(this.pos, npc.pos) - this.yaw));
      if (ang > 1.3) continue;
      best = npc;
      bestD = d;
    }
    if (!best) return;
    const npc = best;
    const def = this.selectedDef;
    const fromBehind = Math.abs(wrapAngle(yawTo(npc.pos, this.pos) - npc.yaw)) > 1.9;

    // Environmental push (pier edge etc.)
    if (npc.ledge && fromBehind) {
      this.yaw = yawTo(this.pos, npc.pos);
      this.startAction('push', 0.7, {
        pose: 'push',
        illegal: 'murder',
        onDone: () => npc.pushedOff(this),
      });
      npc.beginVictim(this, 0.7, 'none');
      return;
    }

    const lethal = !!(def && def.lethalMelee);
    const blunt = def && def.melee === 'blunt';
    this.yaw = yawTo(this.pos, npc.pos);
    const snap = () => {
      // Place the victim right in front of the player.
      const d = 0.62;
      npc.pos.x = this.pos.x + Math.sin(this.yaw) * d;
      npc.pos.z = this.pos.z + Math.cos(this.yaw) * d;
      if (fromBehind) npc.yaw = this.yaw;
    };
    if (lethal) {
      const dur = def.id === 'kitchen_knife' || this.selected >= 0 && this.selectedItem.id === 'kitchen_knife' ? 1.0 : 2.4;
      snap();
      npc.beginVictim(this, dur, 'choked');
      this.startAction('kill', dur, {
        pose: 'strangle',
        illegal: 'murder',
        onUpdate: () => snap(),
        onDone: () => npc.die({ by: this, method: this.selectedItem?.id ?? 'melee', silent: true }),
      });
    } else if (blunt) {
      snap();
      npc.beginVictim(this, 0.6, 'none');
      this.startAction('knockout', 0.6, {
        pose: 'push',
        illegal: 'assault',
        onDone: () => {
          npc.knockOut({ by: this });
          game.noise(this.pos, 3, 'thud', this);
          game.audio?.play('punch', this.pos, 0.8);
        },
      });
    } else {
      const dur = fromBehind ? 2.2 : 1.1;
      snap();
      npc.beginVictim(this, dur, fromBehind ? 'choked' : 'none');
      this.startAction('subdue', dur, {
        pose: 'choke',
        illegal: 'assault',
        onUpdate: () => snap(),
        onDone: () => {
          npc.knockOut({ by: this });
          if (!fromBehind) game.audio?.play('punch', this.pos, 0.8);
        },
      });
    }
  }

  // --- bodies & disguises ------------------------------------------------------
  startDrag(npc) {
    this.dragging = npc;
    npc.dragged = true;
    npc.collides = false;
    this.selected = -1;
  }

  stopDrag() {
    const npc = this.dragging;
    if (!npc) return;
    npc.dragged = false;
    npc.collides = false;
    this.dragging = null;
  }

  updateDragged(dt) {
    const npc = this.dragging;
    if (!npc) return;
    this.flagIllegal('drag', 0.3);
    // The body trails behind the player, head toward the player's hands.
    const back = 1.05;
    const tx = this.pos.x - Math.sin(this.yaw) * back;
    const tz = this.pos.z - Math.cos(this.yaw) * back;
    npc.pos.x += (tx - npc.pos.x) * Math.min(1, dt * 10);
    npc.pos.z += (tz - npc.pos.z) * Math.min(1, dt * 10);
    npc.yaw = yawTo(npc.pos, this.pos) + Math.PI;
    npc.anim.pose = 'dragged';
  }

  takeDisguise(npc) {
    const newOutfit = npc.outfit;
    const old = this.outfit;
    this.startAction('changeClothes', 1.8, {
      pose: 'lookDown',
      illegal: 'undress',
      onDone: () => {
        npc.setOutfit('underwear');
        npc.undressed = true;
        this.setOutfit(newOutfit);
        this.game.pickups.spawnClothes(old, this.pos.x + Math.sin(this.yaw + 1.2) * 0.6, this.pos.z + Math.cos(this.yaw + 1.2) * 0.6);
        this.game.onDisguiseChanged(newOutfit);
      },
    });
  }

  wearClothes(pickup) {
    const old = this.outfit;
    this.startAction('changeClothes', 1.5, {
      pose: 'lookDown',
      onDone: () => {
        this.setOutfit(pickup.outfit);
        this.game.pickups.remove(pickup);
        this.game.pickups.spawnClothes(old, pickup.x, pickup.z);
        this.game.onDisguiseChanged(pickup.outfit);
      },
    });
  }

  hideIn(container) {
    this.hiddenIn = container;
    container.playerInside = true;
    this.model.group.visible = false;
    this.selected = -1;
    this.crouching = false;
    this.game.hud.toast(`Вы спрятались: ${container.name}`);
  }

  leaveHiding() {
    const c = this.hiddenIn;
    if (!c) return;
    c.playerInside = false;
    this.hiddenIn = null;
    this.model.group.visible = true;
    const f = c.front;
    this.pos.set(f.x, 0, f.z);
    this.yaw = c.yaw;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    this.lastDamage = this.game.time;
    this.game.cameraRig.shake = Math.max(this.game.cameraRig.shake, 0.4);
    this.game.audio?.play('hit', this.pos, 0.6);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.stopDrag();
      this.game.onPlayerDied();
    }
  }

  disguiseName() {
    return DISGUISES[OUTFITS[this.outfit].disguise].name;
  }
}

function approach(a, b, step) {
  const d = wrapAngle(b - a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

export { clamp };
