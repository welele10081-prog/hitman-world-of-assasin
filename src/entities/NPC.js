import * as THREE from 'three';
import { Character } from './Character.js';
import { clamp, dist2D, wrapAngle, yawTo, pick } from '../core/util.js';

const WALK = 1.45;
const BRISK = 2.4;
const RUN = 4.6;

const LINES = {
  hmm: ['Хм?', 'Что?..', 'Эй...', 'М-м?'],
  trespassWarn: ['Вам сюда нельзя.', 'Эй! Это служебная зона.', 'Посторонним вход воспрещён.', 'Вернитесь к гостям, пожалуйста.'],
  trespassLast: ['Я сказал — на выход!', 'Последнее предупреждение!'],
  hostile: ['Стоять!', 'Кто вы такой?!', 'Эй! Руки вверх!'],
  weapon: ['У него оружие!', 'Оружие!', 'Он вооружён!'],
  enforcer: ['Я тебя раньше не видел...', 'Ты из какой смены?', 'Постой-ка... ты кто?'],
  combat: ['Цель на прицеле!', 'Огонь!', 'Вон он!', 'Не дайте ему уйти!'],
  lost: ['Где он?', 'Потерял из виду!', 'Он где-то здесь...'],
  searchGiveUp: ['Похоже, ушёл.', 'Чисто. Возвращаюсь на пост.', 'Никого.'],
  body: ['Тут тело!', 'О боже... Человек лежит!', 'Охрана! Здесь тело!'],
  bodyGuard: ['Код красный! Тело!', 'Нашёл тело. Всем внимание!'],
  unconsciousGuard: ['Эй, очнись! Что случилось?', 'Кто тебя так?'],
  accident: ['Какой ужасный несчастный случай!', 'Боже мой... Кто-нибудь, помогите!'],
  distracted: ['Что это было?', 'Что за звук?', 'Кто здесь?', 'Хм, откуда это?'],
  distractedDone: ['Показалось.', 'Ничего.', 'Ладно...'],
  panic: ['А-а-а!', 'Помогите!', 'Убийца!', 'Бегите!'],
  report: ['Охрана! Там человек с оружием!', 'Я видел! Там что-то ужасное!', 'Скорее, туда!'],
  sick: ['Ох... Мне нехорошо...', 'Простите, мне нужно отойти...'],
  shot: ['Меня подстрелили!', 'А-а!'],
  seeCoin: ['О, монетка.'],
  weaponFound: ['Кто-то бросил оружие.'],
  resume: ['Так, о чём это я...', 'Ладно, за работу.'],
};

export class NPC extends Character {
  constructor(game, def) {
    super(game, { outfit: def.outfit, look: def.look, name: def.name, x: def.x, z: def.z, yaw: def.yaw ?? 0 });
    this.def = def;
    this.role = def.role ?? 'guest'; // guest | staff | guard | target
    this.isTarget = !!def.target;
    this.isGuard = this.role === 'guard';
    this.enforces = new Set(def.enforces ?? []);
    this.routine = def.routine ?? [];
    this.routineIndex = 0;
    this.step = null;
    this.stepTimer = 0;
    this.state = 'routine';
    this.stateTime = 0;
    this.path = null;
    this.pathIndex = 0;
    this.moveTarget = null;
    this.moveSpeed = WALK;
    this.onArrive = null;
    this.stuckTimer = 0;
    this.lastProgressPos = this.pos.clone();
    this.awareness = 0;
    this.seesPlayer = false;
    this.lastSeenPos = null;
    this.lastSeenTime = -99;
    this.warned = 0;
    this.lookYaw = 0;
    this.headLook = 0;
    this.perceptionTimer = Math.random() * 0.1;
    this.bodyScanTimer = Math.random() * 0.5;
    this.barkCooldown = 0;
    this.poseOverride = null;
    this.found = false; // body discovered
    this.undressed = false;
    this.ledge = null; // set while standing at an edge (can be pushed off)
    this.dragged = false;
    this.accident = false;
    this.deathCause = null;
    this.weapon = this.isGuard;
    this.fireTimer = 1;
    this.searchPoints = null;
    this.sitting = false;
    this.reportTarget = null;
    this.reportData = null;
    this.sawPlayerDoIllegal = false;
    this.dress = !!def.look?.female;
    this.anim.dress = this.dress;
    this.convo = null;
    this.carry = def.carry ?? null;
    if (this.carry) this._attachCarry(this.carry);
    if (this.weapon && def.holster !== false) this._attachHolster();
    this.xrayKind = this.isTarget ? 'target' : this.isGuard ? 'guard' : 'civilian';
  }

  _attachCarry(kind) {
    const mats = this.game.materials;
    if (kind === 'tray') {
      const g = new THREE.Group();
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 16), mats.get('chrome'));
      g.add(tray);
      for (let i = 0; i < 3; i++) {
        const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.14, 8), mats.get('glass'));
        gl.position.set(Math.cos(i * 2.1) * 0.1, 0.07, Math.sin(i * 2.1) * 0.1);
        g.add(gl);
      }
      g.position.set(0, -0.1, 0.12);
      this.model.attach('lHand', g, 'carry');
    } else if (kind === 'glass') {
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.13, 8), mats.get('wine'));
      gl.position.set(0, -0.08, 0.04);
      this.model.attach('rHand', gl, 'carry');
    } else if (kind === 'clipboard') {
      const cb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.02), mats.get('paperWhite'));
      cb.position.set(0, -0.1, 0.05);
      cb.rotation.x = -0.6;
      this.model.attach('lHand', cb, 'carry');
    } else if (kind === 'phone') {
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.01), mats.get('black'));
      ph.position.set(0, -0.08, 0.04);
      this.model.attach('rHand', ph, 'carry');
    } else if (kind === 'rake') {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), mats.get('darkWood'));
      r.position.set(0, -0.1, 0);
      this.model.attach('rHand', r, 'carry');
    }
  }

  _attachHolster() {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.12), this.game.materials.get('black'));
    g.position.set(-0.19, 0.0, 0.0);
    this.model.attach('hips', g, 'holster');
  }

  _setGunInHand(on) {
    if (on && !this.model.hasAttachment('gun')) {
      const gun = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.2), this.game.materials.get('darkMetal'));
      body.position.set(0, 0.02, 0.05);
      gun.add(body);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.045), this.game.materials.get('black'));
      grip.position.set(0, -0.03, -0.02);
      gun.add(grip);
      gun.position.set(0, -0.09, 0.02);
      gun.rotation.set(-Math.PI / 2, 0, 0);
      this.model.attach('rHand', gun, 'gun');
    } else if (!on) this.model.detach('gun');
  }

  get alertness() {
    return this.game.alert.level;
  }

  bark(kind, force = false) {
    if (!force && this.barkCooldown > 0) return;
    const list = LINES[kind];
    if (!list) return;
    this.barkCooldown = 3.5;
    this.game.barks.say(this, pick(Math.random, list));
  }

  say(text, duration) {
    this.barkCooldown = 3;
    this.game.barks.say(this, text, duration);
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
    this.stopMoving();
    this.poseOverride = null;
    this.sitting = false;
    this.ledge = null;
    this.arriveRadius = 0.3;
    if (this.alive && this.conscious && s !== 'down') this.collides = true;
    if (s !== 'combat') this._setGunInHand(false);
    if (this.convo) this.game.barks.leaveConvo(this);
  }

  // ------------------------------------------------------------------ movement
  goTo(x, z, speed = WALK, onArrive = null) {
    this.moveTarget = { x, z };
    this.moveSpeed = speed;
    this.onArrive = onArrive;
    this.path = null;
    this.pathIndex = 0;
    this.pathPending = true;
    this.game.pathQueue.request(this, x, z);
  }

  setPath(path) {
    this.pathPending = false;
    if (!path || path.length === 0) {
      // Unreachable: consider it reached so the routine keeps going.
      this.path = null;
      const cb = this.onArrive;
      this.moveTarget = null;
      this.onArrive = null;
      cb?.(false);
      return;
    }
    this.path = path;
    this.pathIndex = 0;
    this.stuckTimer = 0;
    this.lastProgressPos.copy(this.pos);
  }

  stopMoving() {
    this.path = null;
    this.moveTarget = null;
    this.onArrive = null;
    this.pathPending = false;
  }

  get moving() {
    return !!this.moveTarget;
  }

  _followPath(dt) {
    if (!this.path) return;
    const p = this.path[this.pathIndex];
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathIndex === this.path.length - 1;
    if (d < (last ? this.arriveRadius ?? 0.3 : 0.35)) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        const cb = this.onArrive;
        this.path = null;
        this.moveTarget = null;
        this.onArrive = null;
        cb?.(true);
      }
      return;
    }
    const step = Math.min(d, this.moveSpeed * dt);
    this.moveDir(dx, dz, step / dt, dt, 8);
    // doors
    for (const door of this.game.level.doors) {
      if (door.isOpen) continue;
      const ddx = door.x - this.pos.x;
      const ddz = door.z - this.pos.z;
      if (ddx * ddx + ddz * ddz < 1.6 * 1.6) {
        const along = ddx * dx + ddz * dz;
        if (along > -0.2) door.open(true);
      }
    }
    // stuck detection
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.5) {
      const moved = dist2D(this.pos, this.lastProgressPos);
      this.stuckTimer = 0;
      this.lastProgressPos.copy(this.pos);
      if (moved < 0.25 && this.moveTarget) {
        // nudge sideways and re-path
        this.pos.x += (Math.random() - 0.5) * 0.4;
        this.pos.z += (Math.random() - 0.5) * 0.4;
        this.stuckCount = (this.stuckCount ?? 0) + 1;
        if (this.stuckCount > 3) {
          this.stuckCount = 0;
          const cb = this.onArrive;
          this.stopMoving();
          cb?.(false);
        } else {
          const t = this.moveTarget;
          const cb = this.onArrive;
          this.goTo(t.x, t.z, this.moveSpeed, cb);
        }
      } else this.stuckCount = 0;
    }
  }

  // ------------------------------------------------------------------ routine
  _startStep() {
    if (this.routine.length === 0) {
      this.step = null;
      return;
    }
    const step = this.routine[this.routineIndex % this.routine.length];
    this.step = step;
    this.stepPhase = 'going';
    this.stepTimer = 0;
    this.consumed = false;
    this.stepEventFired = false;
    this.arriveRadius = step.sit ? 1.1 : 0.3;
    this.ledge = null;
    if (this.alive && this.conscious) this.collides = true;
    if (step.event && step.eventAtStart) this.game.mission.onRoutineEvent(this, step.event, step);
    if (step.at) {
      const p = this.game.level.point(step.at);
      const speed = step.speed === 'run' ? RUN : step.speed === 'brisk' ? BRISK : WALK;
      this.goTo(p.x, p.z, speed, () => {
        this.stepPhase = 'waiting';
        this.stepTimer = 0;
        if (step.say) this.say(step.say);
        if (step.event && !step.eventAtStart) this.game.mission.onRoutineEvent(this, step.event, step);
        if (step.convo) this.game.barks.joinConvo(this, step.convo);
      });
    } else {
      this.stepPhase = 'waiting';
      if (step.say) this.say(step.say);
      if (step.event && !step.eventAtStart) this.game.mission.onRoutineEvent(this, step.event, step);
    }
  }

  _nextStep() {
    if (this.convo) this.game.barks.leaveConvo(this);
    this.routineIndex = (this.routineIndex + 1) % Math.max(1, this.routine.length);
    this._startStep();
  }

  // Jump to a routine step by its label.
  gotoStepLabel(label) {
    const i = this.routine.findIndex((s) => s.label === label);
    if (i >= 0) {
      this.routineIndex = i;
      this.setState('routine');
      this._startStep();
    }
  }

  _updateRoutine(dt) {
    if (!this.step) {
      this._startStep();
      if (!this.step) return;
    }
    const step = this.step;
    if (this.stepPhase === 'going') {
      if (!this.moving && !this.pathPending) this._startStep();
      return;
    }
    // waiting at the spot
    this.stepTimer += dt;
    const p = step.at ? this.game.level.point(step.at) : null;
    let faceYaw = step.face !== undefined ? (typeof step.face === 'string' ? yawTo(this.pos, this.game.level.point(step.face)) : step.face) : p?.yaw;
    if (faceYaw !== undefined) this.faceYaw(faceYaw, dt, 4);
    this.sitting = !!step.sit;
    this.ledge = step.ledge ? step : null;
    if (step.sit && p) {
      // settle onto the seat
      this.collides = false;
      this.pos.x += (p.x - this.pos.x) * Math.min(1, dt * 4);
      this.pos.z += (p.z - this.pos.z) * Math.min(1, dt * 4);
    }
    if (step.consume && !this.consumed && this.stepTimer >= (step.consumeAt ?? 3)) {
      this.consumed = true;
      this.game.mission.onConsume(this, step.consume);
    }
    if (this.state !== 'routine') return; // consume could change state
    if (step.wait !== undefined && this.stepTimer >= step.wait && !step.hold) this._nextStep();
  }

  // Bodyguard behaviour: shadow the leader, wait at his guard points.
  _updateFollow(dt) {
    const game = this.game;
    const leader = this._leader ?? (this._leader = game.npcs.find((n) => n.def.key === this.def.follow));
    this.followPose = null;
    if (!leader) return;
    if (leader.isDown) {
      if (!this.leaderDownHandled && !leader.hidden) {
        this.leaderDownHandled = true;
        this.onBodyDiscovered(leader);
      }
      return;
    }
    this.repathTimer = (this.repathTimer ?? 0) - dt;
    const gp = leader.guardPointOverride ?? (leader.state === 'routine' && leader.stepPhase === 'waiting' ? leader.step?.guardPoint : null);
    if (gp) {
      const p = game.level.point(gp);
      const d = dist2D(this.pos, p);
      if (d > 0.6) {
        if (!this.moving && !this.pathPending || this.followTarget !== gp) {
          this.followTarget = gp;
          this.goTo(p.x, p.z, BRISK);
        }
      } else {
        this.faceYaw(p.yaw, dt, 4);
        this.followPose = 'guard';
      }
      return;
    }
    this.followTarget = null;
    const d = dist2D(this.pos, leader.pos);
    if (d > 3.2) {
      if ((!this.moving && !this.pathPending) || this.repathTimer <= 0) {
        this.repathTimer = 0.8;
        const bx = leader.pos.x - Math.sin(leader.yaw) * 1.8;
        const bz = leader.pos.z - Math.cos(leader.yaw) * 1.8;
        const p = game.level.nav.nearestWalkableWorld(bx, bz) ?? leader.pos;
        this.goTo(p.x, p.z, d > 9 ? RUN : BRISK);
      }
    } else if (d < 2.2 && this.moving) {
      this.stopMoving();
    }
    if (!this.moving) {
      this.faceTowards(leader.pos.x, leader.pos.z, dt, 3);
      this.followPose = 'guard';
    }
  }

  currentRoutinePose() {
    if (this.def.follow && this.state === 'routine') return this.moving ? null : this.followPose;
    if (this.state !== 'routine' || !this.step || this.stepPhase !== 'waiting') return this.carry === 'tray' ? 'tray' : null;
    if (this.convo) return this.game.barks.isSpeaking(this) ? 'talk' : this.step.pose === 'drink' ? 'drink' : 'listen';
    return this.step.pose ?? (this.carry === 'tray' ? 'tray' : null);
  }

  // ------------------------------------------------------------------ perception
  canSeePoint(x, y, z, maxDist = 24) {
    const eye = this.eyeHeight();
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist) return { visible: false, d };
    const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - (this.yaw + this.headLook)));
    let peripheral = false;
    if (ang > 1.05) {
      if (ang > 1.45 || d > 8) return { visible: false, d };
      peripheral = true;
    }
    const t = this.game.collision.segmentHit(this.pos.x, eye, this.pos.z, x, y, z, 'sight');
    if (t < 0.999) return { visible: false, d };
    return { visible: true, d, peripheral };
  }

  canSeePlayer() {
    const pl = this.game.player;
    if (!pl.alive || pl.hiddenIn || this.isDown) return { visible: false, d: 999 };
    let r = this.canSeePoint(pl.pos.x, pl.chestHeight(), pl.pos.z);
    if (!r.visible && r.d < 24) {
      const r2 = this.canSeePoint(pl.pos.x, pl.eyeHeight() + 0.1, pl.pos.z);
      if (r2.visible) r = r2;
    }
    // "Feel" someone right behind you
    if (!r.visible && r.d < 1.0 && !pl.crouching) r = { visible: true, d: r.d, peripheral: true };
    return r;
  }

  _perceive(dt) {
    const game = this.game;
    const pl = game.player;
    const vis = this.canSeePlayer();
    this.seesPlayer = vis.visible;
    this.playerDist = vis.d;
    if (!vis.visible) {
      this.awareness = Math.max(0, this.awareness - (this.state === 'suspicious' ? 0.08 : 0.15) * dt);
      return;
    }
    this.lastSeenPos = pl.pos.clone();
    this.lastSeenTime = game.time;
    const d = vis.d;
    const guardish = this.isGuard;
    const compromised = game.alert.isCompromised(pl.outfit);

    // Immediate reactions to plainly illegal actions.
    if (pl.illegalTimer > 0 && d < 26) {
      const k = pl.illegalKind;
      const severe = ['murder', 'shooting', 'assault'].includes(k);
      if (severe) {
        this.witness(k);
        return;
      }
      this.awareness += 3.0 * dt * (d < 10 ? 1 : 0.6);
      this.suspicionReason = k;
    }

    let rate = 0;
    let reason = null;
    if (compromised && (guardish || this.awareness > 0) && d < 30) {
      rate = guardish ? 2.5 : 0.8;
      reason = 'wanted';
    } else if (pl.holdingIllegal && d < 20) {
      rate = guardish ? 1.4 : 0.9;
      reason = 'weapon';
    } else if (pl.trespassing) {
      if (pl.hostileZone) {
        rate = guardish ? 1.0 : 0.5;
        reason = 'hostile';
      } else {
        rate = guardish ? 0.25 : this.role === 'staff' ? 0.18 : 0.07;
        reason = 'trespass';
      }
    } else if (this.enforces.has(pl.disguise) && d < 8) {
      rate = 0.3;
      reason = 'enforcer';
    } else if (d < 6) {
      if (pl.running || (pl.crouching && guardish)) {
        rate = 0.08;
        reason = 'behaviour';
      }
    }
    if (pl.dragging && d < 20) {
      rate = Math.max(rate, 3);
      reason = 'drag';
    }
    if (rate > 0) {
      let f = d < 3 ? 1.3 : d < 8 ? 1.0 : d < 15 ? 0.6 : 0.35;
      if (vis.peripheral) f *= 0.5;
      if (game.alert.level !== 'normal' && guardish) f *= 1.5;
      this.awareness += rate * f * dt;
      this.suspicionReason = reason;
    } else {
      this.awareness = Math.max(0, this.awareness - 0.12 * dt);
    }
    this.awareness = clamp(this.awareness, 0, 1.2);
  }

  // Saw murder / shooting / assault
  witness(kind) {
    const game = this.game;
    this.sawPlayerDoIllegal = true;
    this.awareness = 1.2;
    game.alert.compromise(game.player.outfit, this);
    if (this.isGuard) {
      this.enterCombat();
    } else {
      this.bark('panic', true);
      game.noise(this.pos, 18, 'scream', this);
      this.startFlee(game.player.pos, true);
    }
    game.stats.witnessed = true;
  }

  _reactToAwareness(dt) {
    const game = this.game;
    const pl = game.player;
    const r = this.suspicionReason;
    if (this.awareness >= 1) {
      // Mild reasons: guards escort the player out, civilians fetch a guard.
      const mild = r === 'trespass' || r === 'behaviour' || (r === 'enforcer' && false);
      if (mild) {
        this.awareness = 0.7;
        if (this.isGuard) {
          if (this.state !== 'escort') this.startEscort();
        } else if (this.state !== 'flee') {
          this.bark('report', true);
          this.reportKind = 'suspicious';
          this.startFlee(pl.pos, true);
        }
        return true;
      }
      // Spotted: the disguise is blown.
      game.alert.compromise(pl.outfit, this);
      game.stats.spotted = true;
      if (this.isGuard) this.enterCombat();
      else {
        if (r === 'weapon' || r === 'drag') this.bark('panic', true);
        else this.bark('report', true);
        this.reportKind = 'player';
        this.startFlee(pl.pos, true);
      }
      return true;
    }
    if (this.awareness >= 0.25 && (this.state === 'routine' || this.state === 'distracted' || this.state === 'investigate')) {
      this.setState('suspicious');
      game.audio?.play('notice');
      if (r === 'trespass') this.bark('trespassWarn', true);
      else if (r === 'hostile') this.bark('hostile', true);
      else if (r === 'weapon') this.bark('weapon', true);
      else if (r === 'enforcer') this.bark('enforcer', true);
      else this.bark('hmm');
      return true;
    }
    return false;
  }

  // Guard walks up to a trespasser and orders them out.
  startEscort() {
    this.setState('escort');
    this.escortTimer = null;
  }

  _updateEscort(dt) {
    const game = this.game;
    const pl = game.player;
    if (!pl.trespassing) {
      if (this.escortTimer !== null) this.say('Так-то лучше. И чтобы я вас здесь больше не видел.');
      this.awareness = 0.3;
      this.resumeRoutine();
      return;
    }
    if (!this.seesPlayer) {
      this.lostTimer = (this.lostTimer ?? 0) + dt;
      if (this.lostTimer > 4) {
        this.startInvestigate(this.lastSeenPos ?? pl.pos, 'escort');
        return;
      }
    } else this.lostTimer = 0;
    const d = dist2D(this.pos, pl.pos);
    this.faceTowards(pl.pos.x, pl.pos.z, dt, 5);
    if (d > 2.4) {
      this.escortRepath = (this.escortRepath ?? 0) - dt;
      if ((!this.moving && !this.pathPending) || this.escortRepath <= 0) {
        this.escortRepath = 1;
        this.goTo(pl.pos.x, pl.pos.z, BRISK);
      }
    } else {
      if (this.moving) this.stopMoving();
      this.poseOverride = 'point';
      if (this.escortTimer === null) {
        this.escortTimer = 7;
        this.say('Вам сюда нельзя. Немедленно на выход!');
      }
    }
    if (this.escortTimer !== null) {
      this.escortTimer -= dt;
      if (this.escortTimer < 3 && !this.lastWarned) {
        this.lastWarned = true;
        this.bark('trespassLast', true);
      }
      if (this.escortTimer <= 0) {
        this.lastWarned = false;
        game.alert.compromise(pl.outfit, this);
        game.stats.spotted = true;
        this.enterCombat();
      }
    }
  }

  _updateSuspicious(dt) {
    const game = this.game;
    const pl = game.player;
    if (this.seesPlayer) {
      this.faceTowards(pl.pos.x, pl.pos.z, dt, 5);
      // Guards/staff walk up to trespassers to warn them.
      if (this.suspicionReason === 'trespass' && this.isGuard && this.playerDist > 2.5 && this.awareness > 0.45) {
        if (!this.moving || this.stateTime % 1 < dt) this.goTo(pl.pos.x, pl.pos.z, BRISK);
      } else if (this.moving && this.playerDist < 2.5) this.stopMoving();
      if (this.suspicionReason === 'trespass' && this.awareness > 0.75 && this.warned < 2 && this.stateTime > 2.5) {
        this.warned = 2;
        this.bark('trespassLast', true);
      }
      this.lostTimer = 0;
    } else {
      this.lostTimer = (this.lostTimer ?? 0) + dt;
      if (this.lostTimer > 2.0) {
        if (this.awareness > 0.45 && this.lastSeenPos && (this.isGuard || this.role === 'staff')) {
          this.startInvestigate(this.lastSeenPos, 'suspicious');
        } else {
          this.resumeRoutine();
        }
        return;
      }
    }
    if (this.awareness < 0.1) this.resumeRoutine();
  }

  resumeRoutine() {
    this.setState('routine');
    this.warned = 0;
    if (!this.def.follow) this._startStep();
  }

  // ------------------------------------------------------------------ noise
  hearNoise(n) {
    if (this.isDown || this.state === 'victim' || this.state === 'dying') return;
    const d = dist2D(this.pos, n.pos);
    switch (n.kind) {
      case 'gunshot':
      case 'scream':
        if (this.isGuard) {
          if (this.state !== 'combat') {
            game_alertSearch(this, n.pos);
          }
        } else if (n.kind === 'gunshot' && d < 30 && this.state !== 'flee' && this.state !== 'cower') {
          this.bark('panic', true);
          this.startFlee(n.pos, false);
        }
        break;
      case 'silencedShot':
      case 'impact':
      case 'thud':
      case 'item':
      case 'coin':
      case 'glass':
        if (['routine', 'suspicious'].includes(this.state) || (this.state === 'distracted' && n.kind !== 'coin')) {
          this.startDistracted(n.pos);
        }
        break;
      case 'footsteps':
        if (this.state === 'routine' && d < n.radius) this.glanceAt = { x: n.pos.x, z: n.pos.z, t: 1.5 };
        break;
      default:
        break;
    }
  }

  startDistracted(pos) {
    this.setState('distracted');
    this.distractPos = { x: pos.x, z: pos.z };
    this.distractPhase = 'turn';
    this.bark('distracted');
  }

  _updateDistracted(dt) {
    const p = this.distractPos;
    const d = dist2D(this.pos, p);
    if (this.distractPhase === 'turn') {
      this.faceTowards(p.x, p.z, dt, 5);
      if (this.stateTime > 1.0) {
        this.distractPhase = 'walk';
        const target = this.game.level.nav.nearestWalkableWorld(p.x, p.z) ?? p;
        this.goTo(target.x, target.z, WALK * 1.1, () => {
          this.distractPhase = 'look';
          this.lookTimer = 0;
        });
      }
    } else if (this.distractPhase === 'walk') {
      if (!this.moving && !this.pathPending && d < 2) {
        this.distractPhase = 'look';
        this.lookTimer = 0;
      } else if (!this.moving && !this.pathPending) {
        this.distractPhase = 'look';
        this.lookTimer = 0;
      }
    } else if (this.distractPhase === 'look') {
      this.lookTimer += dt;
      this.poseOverride = 'lookDown';
      this.faceYaw(this.yaw + Math.sin(this.lookTimer * 1.5) * 0.02, dt, 1);
      this.headLookTarget = Math.sin(this.lookTimer * 1.3) * 0.9;
      // pick up coins lying here
      const coin = this.game.pickups.nearest(this.pos, 1.5, (pk) => pk.id === 'coin');
      if (coin && this.lookTimer > 1.5) {
        this.game.pickups.remove(coin);
        this.bark('seeCoin', true);
      }
      if (this.lookTimer > 5) {
        this.bark('distractedDone');
        this.resumeRoutine();
      }
    }
  }

  // ------------------------------------------------------------------ investigate / search
  startInvestigate(pos, why) {
    this.setState('investigate');
    this.investPos = { x: pos.x, z: pos.z };
    this.investPhase = 'walk';
    this.investWhy = why;
    const t = this.game.level.nav.nearestWalkableWorld(pos.x, pos.z) ?? pos;
    this.goTo(t.x, t.z, BRISK, () => {
      this.investPhase = 'look';
      this.lookTimer = 0;
    });
  }

  _updateInvestigate(dt) {
    if (this.investPhase === 'walk' && !this.moving && !this.pathPending) {
      this.investPhase = 'look';
      this.lookTimer = 0;
    }
    if (this.investPhase === 'look') {
      this.lookTimer += dt;
      this.headLookTarget = Math.sin(this.lookTimer * 1.2) * 1.0;
      if (this.lookTimer > 5) {
        this.bark('searchGiveUp');
        this.resumeRoutine();
      }
    }
  }

  startSearch(center) {
    this.setState('search');
    this.searchCenter = { x: center.x, z: center.z };
    this.searchLeg = 0;
    this._nextSearchPoint();
  }

  _nextSearchPoint() {
    const nav = this.game.level.nav;
    const c = this.searchCenter;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 12;
      const p = nav.nearestWalkableWorld(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
      if (p) {
        this.goTo(p.x, p.z, BRISK, () => {
          this.lookTimer = 0;
        });
        this.lookTimer = -1;
        return;
      }
    }
  }

  _updateSearch(dt) {
    if (this.game.alert.level === 'normal') {
      this.bark('searchGiveUp');
      this.resumeRoutine();
      return;
    }
    if (!this.moving && !this.pathPending) {
      if (this.lookTimer < 0) this.lookTimer = 0;
      this.lookTimer += dt;
      this.headLookTarget = Math.sin(this.lookTimer * 1.4) * 1.0;
      if (this.lookTimer > 2.5) {
        this.searchLeg++;
        if (this.game.alert.searchCenter) this.searchCenter = this.game.alert.searchCenter;
        this._nextSearchPoint();
      }
    }
  }

  // ------------------------------------------------------------------ combat
  enterCombat() {
    if (this.state === 'combat') return;
    this.setState('combat');
    this._setGunInHand(true);
    this.bark('combat', true);
    this.fireTimer = 0.8 + Math.random() * 0.6;
    this.game.alert.enterCombat(this);
  }

  _updateCombat(dt) {
    const game = this.game;
    const pl = game.player;
    if (!pl.alive) {
      this.poseOverride = null;
      return;
    }
    this._setGunInHand(true);
    if (this.seesPlayer) {
      game.alert.reportSighting(pl.pos);
      this.faceTowards(pl.pos.x, pl.pos.z, dt, 7);
      this.poseOverride = 'aim';
      const d = this.playerDist;
      // keep a sensible distance
      if (d > 14 && !this.moving) this.goTo(pl.pos.x, pl.pos.z, RUN);
      else if (d < 12 && this.moving) this.stopMoving();
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && d < 35) {
        this.fireTimer = 1.0 + Math.random() * 0.8;
        game.combat.npcShoot(this, pl);
      }
      this.lostTimer = 0;
    } else {
      this.poseOverride = null;
      this.lostTimer = (this.lostTimer ?? 0) + dt;
      const last = game.alert.lastKnown ?? this.lastSeenPos;
      if (last && !this.moving && !this.pathPending && this.lostTimer < 8) {
        const p = game.level.nav.nearestWalkableWorld(last.x, last.z) ?? last;
        if (dist2D(this.pos, p) > 1.5) this.goTo(p.x, p.z, RUN);
      }
      if (this.lostTimer > 8) {
        this.bark('lost');
        this.startSearch(last ?? this.pos);
      }
    }
  }

  // ------------------------------------------------------------------ flee / report
  startFlee(fromPos, report) {
    this.setState('flee');
    this.fleeFrom = { x: fromPos.x, z: fromPos.z };
    this.reportAfter = report;
    const guard = report ? this.game.findNearestGuard(this.pos, this) : null;
    if (guard) {
      this.reportTarget = guard;
      this.goTo(guard.pos.x, guard.pos.z, RUN);
    } else {
      this._fleeAway();
    }
  }

  _fleeAway() {
    const nav = this.game.level.nav;
    const dx = this.pos.x - this.fleeFrom.x;
    const dz = this.pos.z - this.fleeFrom.z;
    const len = Math.hypot(dx, dz) || 1;
    const tx = this.pos.x + (dx / len) * 14;
    const tz = this.pos.z + (dz / len) * 14;
    const p = nav.nearestWalkableWorld(tx, tz) ?? { x: tx, z: tz };
    this.goTo(p.x, p.z, RUN, () => {
      this.setState('cower');
    });
  }

  _updateFlee(dt) {
    const g = this.reportTarget;
    if (g) {
      if (g.isDown) {
        this.reportTarget = null;
        this._fleeAway();
        return;
      }
      const d = dist2D(this.pos, g.pos);
      if (d < 2.2) {
        this.stopMoving();
        this.say(pick(Math.random, LINES.report));
        g.receiveReport({ kind: this.reportKind ?? 'player', pos: this.lastSeenPos ?? this.fleeFrom, body: this.reportBody });
        this.reportKind = null;
        this.reportBody = null;
        this.reportTarget = null;
        this.setState('cower');
        return;
      }
      if (!this.moving && !this.pathPending) this.goTo(g.pos.x, g.pos.z, RUN);
      else if (this.stateTime % 2 < 0.02) this.goTo(g.pos.x, g.pos.z, RUN);
    } else if (!this.moving && !this.pathPending) {
      this.setState('cower');
    }
    if (this.stateTime > 30) this.setState('cower');
  }

  _updateCower(dt) {
    this.poseOverride = 'cower';
    if (this.stateTime > 25 && this.game.alert.level === 'normal') {
      this.bark('resume');
      this.resumeRoutine();
    }
  }

  receiveReport(r) {
    if (!this.isGuard || this.isDown) return;
    if (r.body) {
      this.startBodyCheck(r.body);
    } else if (r.kind === 'suspicious') {
      this.startInvestigate(r.pos, 'report');
    } else {
      this.game.alert.startSearch(r.pos);
      this.startSearch(r.pos);
    }
  }

  // ------------------------------------------------------------------ bodies
  _scanBodies() {
    const game = this.game;
    for (const other of game.npcs) {
      if (other === this || !other.isDown || other.hidden || other.dragged && game.player.dragging !== other) continue;
      if (other.found && other.handled) continue;
      const vis = this.canSeePoint(other.pos.x, 0.3, other.pos.z, 18);
      if (!vis.visible) continue;
      if (other.found && this.isGuard === false) continue; // civilians ignore already-known bodies
      this.onBodyDiscovered(other);
      return;
    }
    // weapons lying around
    if (this.isGuard && this.state === 'routine') {
      const pk = game.pickups.visibleWeapon(this);
      if (pk) {
        this.bark('weaponFound', true);
        this.setState('investigate');
        this.investPhase = 'walk';
        this.goTo(pk.x, pk.z, WALK, () => {
          game.pickups.remove(pk);
          this.resumeRoutine();
        });
      }
    }
  }

  onBodyDiscovered(body) {
    const game = this.game;
    const firstTime = !body.found;
    if (firstTime) {
      body.found = true;
      game.onBodyFound(body, this);
    }
    if (this.isGuard) {
      this.startBodyCheck(body);
    } else {
      if (body.accident) {
        this.bark('accident', true);
        if (firstTime) game.noise(this.pos, 14, 'scream', this);
        this.setState('cower');
      } else {
        this.bark('body', true);
        if (firstTime) game.noise(this.pos, 16, 'scream', this);
        this.reportBody = body;
        this.startFlee(body.pos, true);
      }
    }
  }

  startBodyCheck(body) {
    if (this.state === 'combat') return;
    this.setState('bodycheck');
    this.checkBody = body;
    this.bodyPhase = 'walk';
    const p = this.game.level.nav.nearestWalkableWorld(body.pos.x, body.pos.z) ?? body.pos;
    this.goTo(p.x, p.z, BRISK, () => {
      this.bodyPhase = 'inspect';
      this.lookTimer = 0;
    });
  }

  _updateBodyCheck(dt) {
    const body = this.checkBody;
    if (this.bodyPhase === 'walk') {
      if (!this.moving && !this.pathPending) {
        this.bodyPhase = 'inspect';
        this.lookTimer = 0;
      }
      if (body.hidden) this.resumeRoutine();
      return;
    }
    this.lookTimer += dt;
    this.faceTowards(body.pos.x, body.pos.z, dt, 4);
    this.poseOverride = 'kneelWork';
    if (this.lookTimer > 4) {
      body.handled = true;
      if (body.alive && !body.conscious) {
        this.bark('unconsciousGuard', true);
        body.wakeUp();
        this.game.alert.raise('body', body.pos);
      } else if (body.accident) {
        this.say('Похоже на несчастный случай. Вызовите врача.');
      } else {
        this.bark('bodyGuard', true);
        this.game.alert.raise('body', body.pos);
        this.game.alert.startSearch(body.pos);
      }
      if (this.game.alert.level === 'search') this.startSearch(body.pos);
      else this.resumeRoutine();
    }
  }

  // ------------------------------------------------------------------ being attacked
  beginVictim(attacker, duration, pose) {
    this.setState('victim');
    this.victimPose = pose;
    this.victimTime = duration;
  }

  knockOut({ by } = {}) {
    if (!this.alive) return;
    this.conscious = false;
    this.setState('down');
    this.anim.faceDown = Math.random() > 0.5;
    this.collides = false;
    this.awareness = 0;
    this.game.onNpcDown(this, { lethal: false, by });
    this.game.audio?.play('bodyfall', this.pos, 0.5);
  }

  die({ by = null, method = 'unknown', silent = false, accident = false, cause = null } = {}) {
    if (!this.alive) return;
    const wasConscious = this.conscious;
    this.alive = false;
    this.conscious = false;
    this.accident = accident;
    this.deathCause = cause ?? method;
    this.setState('down');
    this.anim.faceDown = Math.random() > 0.5;
    this.collides = false;
    this._setGunInHand(false);
    this.game.onNpcDown(this, { lethal: true, by, method, accident, wasConscious });
    if (!silent) this.game.audio?.play('bodyfall', this.pos, 0.6);
  }

  wakeUp() {
    if (!this.alive) return;
    this.conscious = true;
    this.collides = true;
    this.anim.lying = 0;
    this.found = false;
    this.handled = false;
    this.awareness = 0.2;
    this.resumeRoutine();
  }

  pushedOff(by) {
    // Tumbles into the water: accident.
    this.setState('falling');
    this.fallT = 0;
    this.fallDir = { x: Math.sin(by.yaw), z: Math.cos(by.yaw) };
    this.bark('shot', true);
  }

  _updateFalling(dt) {
    this.fallT += dt;
    this.pos.x += this.fallDir.x * dt * 1.6;
    this.pos.z += this.fallDir.z * dt * 1.6;
    this.model.group.position.y = -this.fallT * this.fallT * 4;
    if (this.fallT > 0.9) {
      this.game.audio?.play('splash', this.pos, 1);
      this.game.effects.splash(this.pos);
      this.die({ by: this.game.player, method: 'drowning', accident: true, cause: 'Утонула', silent: true });
      this.hidden = true;
      this.model.group.visible = false;
    }
  }

  // Poisons
  poisoned(kind) {
    if (this.isDown) return;
    if (kind === 'lethal') {
      this.setState('dying');
      this.bark('sick', true);
    } else {
      this.setState('sick');
      this.bark('sick', true);
      this.sickPhase = 'walk';
      const stall = this.game.level.point(dist2D(this.pos, this.game.level.point('restroom_stall')) < 60 ? 'restroom_stall' : 'restroom_stall2');
      this.goTo(stall.x, stall.z, BRISK, () => {
        this.sickPhase = 'vomit';
        this.stateTime = 0;
      });
    }
  }

  _updateSick(dt) {
    if (this.sickPhase === 'vomit') {
      const p = this.game.level.point('restroom_stall');
      this.faceYaw(p.yaw, dt, 4);
      this.poseOverride = 'vomit';
      if (this.stateTime > 22) {
        this.game.mission.onRecoveredFromSickness?.(this);
        this.resumeRoutine();
      }
    } else if (!this.moving && !this.pathPending && this.stateTime > 1) {
      this.sickPhase = 'vomit';
      this.stateTime = 0;
    }
  }

  _updateDying(dt) {
    this.poseOverride = 'vomit';
    if (this.stateTime > 3.5) this.die({ method: 'poison', cause: 'Отравление', by: this.game.player });
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    const game = this.game;
    this.barkCooldown = Math.max(0, this.barkCooldown - dt);
    this.stateTime += dt;

    if (this.isDown) {
      this.anim.lying = Math.min(1, this.anim.lying + dt * 2.5);
      this.anim.pose = this.dragged ? 'dragged' : null;
      this.anim.sit = false;
      this.anim.crouch = 0;
      this.anim.speed = 0;
      return;
    }
    if (this.state === 'victim') {
      this.anim.pose = this.victimPose === 'choked' ? 'choked' : null;
      this.anim.sit = false;
      return;
    }
    if (this.state === 'falling') {
      this._updateFalling(dt);
      return;
    }

    // Perception at ~10 Hz (only when the player is reasonably close).
    this.perceptionTimer -= dt;
    const nearPlayer = dist2D(this.pos, game.player.pos) < 34;
    if (this.perceptionTimer <= 0) {
      const pdt = 0.1 + Math.max(0, -this.perceptionTimer);
      this.perceptionTimer = 0.1;
      if (nearPlayer && !['flee', 'cower', 'dying', 'sick'].includes(this.state)) {
        this._perceive(pdt);
        if (this.state !== 'combat' && this.state !== 'escort') this._reactToAwareness(pdt);
        else if (this.state === 'escort' && this.awareness >= 1 && this.suspicionReason !== 'trespass') this._reactToAwareness(pdt);
      } else {
        this.seesPlayer = false;
        this.awareness = Math.max(0, this.awareness - 0.15 * pdt);
      }
    }
    this.bodyScanTimer -= dt;
    if (this.bodyScanTimer <= 0) {
      this.bodyScanTimer = 0.5;
      if (!['combat', 'flee', 'cower', 'bodycheck', 'dying'].includes(this.state)) this._scanBodies();
    }

    switch (this.state) {
      case 'routine':
        if (this.def.follow) this._updateFollow(dt);
        else this._updateRoutine(dt);
        break;
      case 'suspicious':
        this._updateSuspicious(dt);
        break;
      case 'escort':
        this._updateEscort(dt);
        break;
      case 'distracted':
        this._updateDistracted(dt);
        break;
      case 'investigate':
        this._updateInvestigate(dt);
        break;
      case 'search':
        this._updateSearch(dt);
        break;
      case 'combat':
        this._updateCombat(dt);
        break;
      case 'flee':
        this._updateFlee(dt);
        break;
      case 'cower':
        this._updateCower(dt);
        break;
      case 'bodycheck':
        this._updateBodyCheck(dt);
        break;
      case 'sick':
        this._updateSick(dt);
        break;
      case 'dying':
        this._updateDying(dt);
        break;
      case 'scripted':
        this.scriptUpdate?.(dt);
        break;
      default:
        break;
    }

    this._followPath(dt);

    // head look: at the player when suspicious/near, else glance targets
    let lookTarget = this.headLookTarget ?? 0;
    this.headLookTarget = 0;
    const pl = game.player;
    const dp = dist2D(this.pos, pl.pos);
    if ((this.seesPlayer && (this.awareness > 0.1 || dp < 3.5)) || this.state === 'suspicious') {
      lookTarget = wrapAngle(yawTo(this.pos, pl.pos) - this.yaw);
    } else if (this.glanceAt) {
      this.glanceAt.t -= dt;
      lookTarget = wrapAngle(yawTo(this.pos, this.glanceAt) - this.yaw);
      if (this.glanceAt.t <= 0) this.glanceAt = null;
    }
    this.headLook += (clamp(lookTarget, -1.2, 1.2) - this.headLook) * Math.min(1, dt * 5);

    // animation params
    this.anim.pose = this.poseOverride ?? this.currentRoutinePose();
    this.anim.sit = this.sitting && !this.moving;
    this.anim.lookYaw = this.headLook;
    this.anim.crouch = 0;
    this.poseOverride = ['combat', 'cower', 'bodycheck', 'sick', 'dying', 'escort'].includes(this.state) ? this.poseOverride : null;
  }
}

// Guard hears gunshot/scream: investigate / search the position.
function game_alertSearch(npc, pos) {
  const game = npc.game;
  if (game.alert.level === 'combat') {
    npc.startSearch(game.alert.lastKnown ?? pos);
  } else {
    npc.startInvestigate(pos, 'noise');
  }
}
