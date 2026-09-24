import { ITEMS } from './Items.js';
import { DISGUISES, OUTFITS } from '../entities/Outfits.js';
import { wrapAngle } from '../core/util.js';

// Context-sensitive actions around the player, bound to E (primary) and R (secondary).
export class Interactions {
  constructor(game) {
    this.game = game;
    this.custom = []; // scripted interactables: {id, x, z, radius, key, label(), enabled(), action()}
    this.current = { E: null, R: null };
  }

  add(def) {
    this.custom.push(def);
    return def;
  }

  remove(def) {
    const i = this.custom.indexOf(def);
    if (i >= 0) this.custom.splice(i, 1);
  }

  _facing(player, x, z) {
    const ang = Math.abs(wrapAngle(Math.atan2(x - player.pos.x, z - player.pos.z) - player.yaw));
    return ang;
  }

  gather(player) {
    const game = this.game;
    const out = [];
    const px = player.pos.x;
    const pz = player.pos.z;
    const near = (x, z, r) => (x - px) * (x - px) + (z - pz) * (z - pz) < r * r;
    const score = (x, z) => Math.hypot(x - px, z - pz) + this._facing(player, x, z) * 0.6;

    if (player.dragging) {
      const body = player.dragging;
      for (const c of game.level.containers) {
        const f = c.front;
        if (!near(f.x, f.z, 1.4) && !near(c.x, c.z, 1.4)) continue;
        if (c.full) {
          out.push({ key: 'E', label: `${c.name}: заполнен`, disabled: true, score: score(c.x, c.z) });
          continue;
        }
        out.push({
          key: 'E',
          label: `Спрятать тело: ${c.name}`,
          score: score(c.x, c.z) - 1,
          action: () => {
            player.stopDrag();
            body.hidden = true;
            body.model.group.visible = false;
            c.bodies.push(body);
            body.container = c;
            game.stats.bodiesHidden++;
            game.audio?.play('door', c, 0.4);
          },
        });
      }
      out.push({ key: 'E', label: 'Бросить тело', score: 5, action: () => player.stopDrag() });
      return out;
    }

    // Doors
    for (const d of game.level.doors) {
      if (!near(d.x, d.z, 1.9)) continue;
      const open = d.isOpen;
      if (d.locked && !open && !player.hasItem(d.locked)) {
        out.push({ key: 'E', label: `${d.name}: заперто`, disabled: true, score: score(d.x, d.z) + 0.2 });
        continue;
      }
      out.push({
        key: 'E',
        label: open ? `Закрыть: ${d.name}` : d.locked ? `Открыть ключом: ${d.name}` : `Открыть: ${d.name}`,
        score: score(d.x, d.z) + 0.3,
        action: () => d.toggle(),
      });
    }

    // Pickups
    for (const pk of game.pickups.list) {
      if (!near(pk.x, pk.z, 1.5)) continue;
      if (pk.id === 'clothes') {
        const name = DISGUISES[OUTFITS[pk.outfit].disguise].name;
        out.push({ key: 'E', label: `Переодеться: ${name}`, score: score(pk.x, pk.z), action: () => player.wearClothes(pk) });
      } else {
        const def = ITEMS[pk.id];
        out.push({
          key: 'E',
          label: `Взять: ${def.name}`,
          score: score(pk.x, pk.z) - 0.2,
          action: () => {
            player.startAction('pickup', 0.45, {
              pose: 'reach',
              onDone: () => {
                if (!game.pickups.list.includes(pk)) return;
                game.pickups.remove(pk);
                player.addItem(pk.id, 1, pk.ammo !== undefined ? { ammo: pk.ammo } : {});
                game.mission.onPickup?.(pk.id);
              },
            });
          },
        });
      }
    }

    // Bodies
    for (const npc of game.npcs) {
      if (!npc.isDown || npc.hidden || npc.dragged || npc.state === 'falling') continue;
      if (!near(npc.pos.x, npc.pos.z, 1.7)) continue;
      out.push({
        key: 'E',
        label: npc.alive ? 'Тащить тело (без сознания)' : 'Тащить тело',
        score: score(npc.pos.x, npc.pos.z),
        action: () => player.startDrag(npc),
      });
      const disguise = OUTFITS[npc.outfit].disguise;
      if (!npc.undressed && disguise !== 'guest' && disguise !== 'underwear' && npc.outfit !== player.outfit) {
        out.push({
          key: 'R',
          label: `Переодеться: ${DISGUISES[disguise].name}`,
          score: score(npc.pos.x, npc.pos.z),
          action: () => player.takeDisguise(npc),
        });
      }
    }

    // Hiding places
    for (const c of game.level.containers) {
      if (!c.hidePlayer) continue;
      const f = c.front;
      if (!near(f.x, f.z, 1.3)) continue;
      out.push({ key: 'E', label: `Спрятаться: ${c.name}`, score: score(c.x, c.z) + 0.5, action: () => player.hideIn(c) });
    }

    // Consumables (poison)
    for (const cons of game.mission.consumables) {
      if (!cons.available || cons.poison) continue;
      if (!near(cons.x, cons.z, 1.6)) continue;
      if (player.hasItem('rat_poison')) {
        out.push({ key: 'E', label: `Отравить: ${cons.name} (крысиный яд)`, score: score(cons.x, cons.z) - 0.5, action: () => this._poison(cons, 'rat_poison', 'lethal') });
      }
      if (player.hasItem('emetic')) {
        out.push({ key: 'R', label: `Отравить: ${cons.name} (рвотное)`, score: score(cons.x, cons.z) - 0.5, action: () => this._poison(cons, 'emetic', 'emetic') });
      }
    }

    // Exits
    for (const ex of game.level.exits) {
      if (!near(ex.x, ex.z, ex.radius + 0.6)) continue;
      const ok = game.mission.canExit();
      out.push({
        key: 'E',
        label: ok ? `Выход: ${ex.name}` : `${ex.name} — сначала устраните цели`,
        disabled: !ok,
        score: score(ex.x, ex.z) + 0.1,
        action: () => game.mission.exit(ex),
      });
    }

    // Scripted
    for (const c of this.custom) {
      if (c.enabled && !c.enabled()) continue;
      if (!near(c.x, c.z, c.radius ?? 1.5)) continue;
      out.push({ key: c.key ?? 'E', label: typeof c.label === 'function' ? c.label() : c.label, score: score(c.x, c.z) - 0.3, action: c.action, disabled: c.disabled?.() });
    }
    return out;
  }

  _poison(cons, itemId, kind) {
    const game = this.game;
    const player = game.player;
    player.startAction('poison', 1.4, {
      pose: 'reach',
      illegal: 'poison',
      onDone: () => {
        cons.poison = kind;
        player.removeItem(itemId, 1);
        game.hud.toast(`${cons.name} отравлен${cons.fem ? 'а' : ''}`);
        game.mission.onPoisoned?.(cons, kind);
      },
    });
  }

  update(player, dt) {
    const input = this.game.input;
    this.current = { E: null, R: null };
    if (player.action || player.hiddenIn || !player.alive) return;
    const list = this.gather(player);
    for (const key of ['E', 'R']) {
      let best = null;
      for (const c of list) {
        if (c.key !== key) continue;
        if (!best || c.score < best.score) best = c;
      }
      this.current[key] = best;
    }
    for (const key of ['E', 'R']) {
      const c = this.current[key];
      if (c && !c.disabled && input.pressed(`Key${key}`)) {
        c.action();
        break;
      }
    }
  }
}
