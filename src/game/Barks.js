import * as THREE from 'three';
import { CONVOS } from '../levels/villaNPCs.js';
import { dist2D } from '../core/util.js';

const _v = new THREE.Vector3();

// Speech above heads + subtitles + scripted ambient conversations.
export class Barks {
  constructor(game, root) {
    this.game = game;
    this.layer = document.createElement('div');
    this.layer.className = 'bark-layer';
    root.appendChild(this.layer);
    this.subs = document.createElement('div');
    this.subs.className = 'subtitles';
    root.appendChild(this.subs);
    this.active = [];
    this.convos = new Map();
    this.subLines = [];
  }

  say(npc, text, duration) {
    const dur = duration ?? Math.max(2.4, text.length * 0.065);
    // replace any existing bubble for this npc
    for (const a of this.active) if (a.npc === npc) a.t = a.dur;
    const el = document.createElement('div');
    el.className = 'bark';
    el.textContent = text;
    this.layer.appendChild(el);
    this.active.push({ npc, el, t: 0, dur });
    const d = dist2D(npc.pos, this.game.player.pos);
    if (d < 11) this._subtitle(npc, text, dur);
  }

  _subtitle(npc, text, dur) {
    const line = document.createElement('div');
    line.className = 'sub-line';
    const who = document.createElement('span');
    who.className = 'sub-who';
    who.textContent = npc.name ? `${npc.name}: ` : '';
    line.appendChild(who);
    line.appendChild(document.createTextNode(text));
    this.subs.appendChild(line);
    this.subLines.push({ el: line, t: 0, dur: dur + 0.5 });
    while (this.subLines.length > 3) {
      const old = this.subLines.shift();
      old.el.remove();
    }
  }

  joinConvo(npc, { id, role }) {
    const def = CONVOS[id];
    if (!def) return;
    let c = this.convos.get(id);
    if (!c) {
      const roles = new Set(def.lines.map((l) => l[0]));
      c = { id, def, members: new Map(), roles, idx: -1, timer: 0, playing: false, cooldown: 0, heard: false };
      this.convos.set(id, c);
    }
    c.members.set(role, npc);
    npc.convo = { id, role };
  }

  leaveConvo(npc) {
    if (!npc.convo) return;
    const c = this.convos.get(npc.convo.id);
    if (c && c.members.get(npc.convo.role) === npc) {
      c.members.delete(npc.convo.role);
      if (c.playing) {
        c.playing = false;
        c.idx = -1;
      }
    }
    npc.convo = null;
  }

  isSpeaking(npc) {
    if (!npc.convo) return false;
    const c = this.convos.get(npc.convo.id);
    return !!(c && c.playing && c.idx >= 0 && c.def.lines[c.idx][0] === npc.convo.role && c.lineOn);
  }

  update(dt) {
    const game = this.game;
    const cam = game.cameraRig.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      if (a.t >= a.dur || a.npc.isDown) {
        a.el.remove();
        this.active.splice(i, 1);
        continue;
      }
      _v.set(a.npc.pos.x, 2.15 * a.npc.model.look.height, a.npc.pos.z);
      const d = cam.position.distanceTo(_v);
      _v.project(cam);
      const visible = _v.z < 1 && d < 20 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      a.el.style.display = visible ? 'block' : 'none';
      if (visible) {
        a.el.style.transform = `translate(-50%, -100%) translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px)`;
        a.el.style.opacity = String(Math.min(1, (a.dur - a.t) * 3) * (d > 14 ? 0.6 : 1));
      }
    }
    for (let i = this.subLines.length - 1; i >= 0; i--) {
      const s = this.subLines[i];
      s.t += dt;
      if (s.t > s.dur) {
        s.el.remove();
        this.subLines.splice(i, 1);
      }
    }

    // Conversations
    for (const c of this.convos.values()) {
      if (c.cooldown > 0) c.cooldown -= dt;
      const ready = c.def.solo ? c.members.has(0) : [...c.roles].every((r) => c.members.has(r));
      if (!c.playing) {
        if (ready && c.cooldown <= 0) {
          // all present and waiting at their spots?
          const allWaiting = [...c.members.values()].every((n) => n.state === 'routine' && n.stepPhase === 'waiting');
          if (allWaiting) {
            c.playing = true;
            c.idx = -1;
            c.timer = 0.8;
            c.lineOn = false;
          }
        }
        continue;
      }
      if (!ready) {
        c.playing = false;
        continue;
      }
      c.timer -= dt;
      if (c.timer > 0) continue;
      if (c.lineOn) {
        c.lineOn = false;
        c.timer = 0.7;
        continue;
      }
      c.idx++;
      if (c.idx >= c.def.lines.length) {
        c.playing = false;
        c.cooldown = 70;
        c.idx = -1;
        continue;
      }
      const [role, text] = c.def.lines[c.idx];
      const speaker = c.members.get(role);
      if (!speaker || speaker.isDown) {
        c.playing = false;
        continue;
      }
      const dur = Math.max(2.6, text.length * 0.06);
      this.say(speaker, text, dur);
      c.lineOn = true;
      c.timer = dur;
      const heardNow = dist2D(speaker.pos, game.player.pos) < 11;
      if (heardNow && c.idx >= 1 && c.def.unlock) game.mission.unlockOpportunity(c.def.unlock, 'overheard');
      if (heardNow && c.def.lines.length === 1 && c.def.unlock) game.mission.unlockOpportunity(c.def.unlock, 'overheard');
    }
  }

  clear() {
    for (const a of this.active) a.el.remove();
    for (const s of this.subLines) s.el.remove();
    this.active = [];
    this.subLines = [];
  }
}
