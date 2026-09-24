import * as THREE from 'three';
import { TARGETS } from '../levels/villaNPCs.js';
import { dist2D, formatTime } from '../core/util.js';

// Mission "The Last Lot": targets, consumables, opportunities, challenges, scoring.
export class Mission {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.consumables = [];
    this.opportunities = [];
    this.timers = [];
    this.tracked = null;
    this.ended = false;
    this.eliminations = [];
  }

  npc(key) {
    return this.game.npcs.find((n) => n.def.key === key);
  }

  init() {
    const game = this.game;
    for (const key of ['kessler', 'vale']) {
      const npc = this.npc(key);
      this.targets.push({ key, npc, info: TARGETS[key], eliminated: false, method: null });
    }
    // Consumables
    this.consumables.push({ id: 'kessler_decanter', name: 'Личный графин Кесслера', x: -36.9, z: -8, available: true, poison: null });
    const martini = { id: 'vale_martini', name: 'Мартини Марты Вейл', x: 4.0, z: -10.35, available: false, poison: null };
    this.consumables.push(martini);
    martini.mesh = this._martiniMesh();
    martini.mesh.position.set(martini.x, 1.12, martini.z);
    martini.mesh.visible = false;
    game.scene.add(martini.mesh);

    // Items placed around the villa
    const P = game.pickups;
    P.spawn('rat_poison', 44.2, -7.25, {}, 0.72);
    P.spawn('emetic', 10.6, -2.5, {}, 1.32);
    P.spawn('wrench', -39.5, 24.3, {}, 0.92);
    P.spawn('kitchen_knife', 13.8, -13.25, {}, 0.95);
    P.spawn('crowbar', 21.6, -18.4);
    P.spawn('wine_bottle', -34.4, -3.9);
    P.spawn('keycard_vault', -44.7, -36.2, {}, 0.8);
    P.spawn('key_cellar', 11.2, -4.75, {}, 0.7);
    for (const [x, z] of [[-6, -30], [-20, 23.3], [28, -30], [15, 7.4], [-35.5, 22.6], [36, 21]]) P.spawn('coin', x, z);
    P.spawnClothes('waiter', 18.6, 0.3);
    P.spawnClothes('chef', 31.8, -36.2);
    P.spawnClothes('guard', -41.8, -38.6);

    // Opportunities
    const kessler = this.npc('kessler');
    const vale = this.npc('vale');
    const pl = () => game.player;
    const decanter = this.consumables[0];
    this.opportunities = [
      {
        id: 'vintage',
        name: 'Особый урожай',
        target: 'kessler',
        desc: 'Кесслер регулярно пробует вино из личного графина в винном погребе.',
        steps: [
          { text: 'Раздобудьте яд (крысиный яд — в сарае садовника)', done: () => pl().hasItem('rat_poison') || pl().hasItem('emetic') || !!decanter.poison, where: () => ({ x: 44.2, z: -7 }) },
          { text: 'Проберитесь в винный погреб (подойдёт форма сомелье или охраны)', done: () => pl().zone?.id === 'cellar' || !!decanter.poison, where: () => game.level.point('cellar_door_in') },
          { text: 'Отравите личный графин Кесслера', done: () => !!decanter.poison, where: () => decanter },
          { text: 'Дождитесь, когда Кесслер придёт на дегустацию', done: () => !kessler.alive, where: () => kessler.pos },
        ],
      },
      {
        id: 'cigarette',
        name: 'Последняя сигарета',
        target: 'vale',
        desc: 'Марта Вейл уходит курить в самый конец пирса. Одна. Перил там нет.',
        steps: [
          { text: 'Дождитесь, когда Вейл пойдёт курить на пирс', done: () => !!vale.ledge || !vale.alive, where: () => game.level.point('pier_end') },
          { text: 'Подкрадитесь сзади и столкните её в воду [F]', done: () => !vale.alive, where: () => vale.pos },
        ],
      },
      {
        id: 'martini',
        name: 'Мартини с сюрпризом',
        target: 'vale',
        desc: 'Бармен готовит Вейл сухой мартини и оставляет его на стойке, пока бегает за льдом.',
        steps: [
          { text: 'Раздобудьте яд (рвотное — в служебной комнате)', done: () => pl().hasItem('emetic') || pl().hasItem('rat_poison') || !!this.consumables[1].poison, where: () => ({ x: 10.8, z: -2.5 }) },
          { text: 'Отравите мартини на барной стойке, когда бармен отойдёт', done: () => !!this.consumables[1].poison || this.valeSick, where: () => this.consumables[1] },
          { text: 'Если это рвотное — идите за Вейл в уборную и устраните её там', done: () => !vale.alive, where: () => vale.pos },
        ],
      },
      {
        id: 'appraisal',
        name: 'Частная оценка',
        target: 'kessler',
        desc: 'Кесслер ждёт оценщика, чтобы наедине показать главный лот в хранилище. Оценщика здесь никто не знает в лицо.',
        steps: [
          { text: 'Найдите оценщика, доктора Лароша, в эллинге', done: () => pl().disguise === 'appraiser' || this.appraiserMet, where: () => this.npc('appraiser').pos },
          { text: 'Возьмите его одежду', done: () => pl().disguise === 'appraiser' || this.appraiserIntroduced, where: () => this.npc('appraiser').pos },
          { text: 'Представьтесь начальнику охраны Брандту', done: () => this.appraiserIntroduced, where: () => this.npc('chief').pos },
          { text: 'Встретьтесь с Кесслером в хранилище наедине', done: () => !kessler.alive, where: () => game.level.point('vault_meet') },
        ],
      },
      {
        id: 'call',
        name: 'Звонок в кабинете',
        target: 'kessler',
        desc: 'Кесслер уходит звонить в свой кабинет. Внутри — никого, телохранитель стоит у двери.',
        steps: [
          { text: 'Раздобудьте форму охраны (запасная — на посту охраны)', done: () => pl().disguise === 'guard' || pl().disguise === 'security_chief' || pl().zone?.id === 'study', where: () => ({ x: -41.8, z: -38.6 }) },
          { text: 'Дождитесь, когда Кесслер уйдёт звонить в кабинет', done: () => kessler.step?.label === 'call' && kessler.stepPhase === 'waiting' || !kessler.alive || pl().zone?.id === 'study', where: () => game.level.point('study_window') },
          { text: 'Отвлеките телохранителя у двери и устраните Кесслера', done: () => !kessler.alive, where: () => kessler.pos },
        ],
      },
    ];
    for (const o of this.opportunities) {
      o.discovered = false;
      o.completed = false;
      o.failed = false;
    }

    // Scripted: introduce yourself as the appraiser to the chief of security.
    const chief = this.npc('chief');
    game.interactions.add({
      key: 'E',
      pos: () => chief.pos,
      get x() {
        return chief.pos.x;
      },
      get z() {
        return chief.pos.z;
      },
      radius: 2.2,
      label: 'Представиться: «Доктор Ларош, оценщик»',
      enabled: () => pl().disguise === 'appraiser' && !this.appraiserIntroduced && !chief.isDown && chief.state !== 'combat' && kessler.alive,
      action: () => this._introduceAppraiser(),
    });
  }

  _martiniMesh() {
    const mats = this.game.materials;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6), mats.get('glass'));
    stem.position.y = 0.05;
    g.add(stem);
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.07, 12, 1, true), mats.get('glass'));
    cup.rotation.x = Math.PI;
    cup.position.y = 0.13;
    g.add(cup);
    const olive = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mats.color(0x5a7a2a, 0.5));
    olive.position.y = 0.12;
    g.add(olive);
    return g;
  }

  later(t, fn) {
    this.timers.push({ t, fn });
  }

  sayLines(npc, lines, start = 0, gap = 3.6) {
    lines.forEach((text, i) => this.later(start + i * gap, () => npc.alive && npc.conscious && npc.state === 'routine' && npc.say(text)));
  }

  // Called by NPC routines.
  onRoutineEvent(npc, event) {
    const game = this.game;
    switch (event) {
      case 'kessler_speech':
        this.sayLines(npc, [
          'Дамы и господа! Добро пожаловать на виллу «Серено».',
          'Сегодня только лучшие вина и искусство, которое переживёт нас всех.',
          'Торги начнутся в галерее. Не стесняйтесь поднимать цену!',
        ], 0.5, 6);
        break;
      case 'kessler_call':
        this.sayLines(npc, ['Да. Я один. Говори.', 'Нет. Груз уйдёт, как договаривались. Вейл всё оформит.', 'И никаких имён по телефону.'], 2, 9);
        break;
      case 'kessler_lectern':
        this.sayLines(npc, ['Лот номер шесть. Начальная цена — два миллиона.', 'Два с половиной... три! Кто больше?'], 1, 8);
        break;
      case 'kessler_tasting': {
        const somm = this.npc('sommelier');
        if (somm && !somm.isDown && dist2D(somm.pos, npc.pos) < 6) {
          this.later(0.5, () => somm.say('Ваш графин, синьор Кесслер. Урожай девяносто седьмого года.'));
          this.later(4.5, () => npc.alive && npc.say('Превосходно, Анри. Как всегда.'));
        }
        break;
      }
      case 'vale_heading_bar': {
        const martini = this.consumables[1];
        const bartender = this.npc('bartender');
        if (bartender && !bartender.isDown && bartender.state === 'routine') {
          martini.available = true;
          martini.poison = null;
          martini.mesh.visible = true;
          bartender.say('Сухой мартини для мадам Вейл. Сбегаю за льдом, пока она идёт.');
          if (dist2D(bartender.pos, game.player.pos) < 11) this.unlockOpportunity('martini', 'overheard');
          bartender.gotoStepLabel('fetch_ice');
        }
        break;
      }
      case 'vale_smoke':
        if (dist2D(npc.pos, game.player.pos) < 14) this.unlockOpportunity('cigarette', 'seen');
        break;
      case 'appraiser_call':
        this.sayLines(npc, ['Да, я на месте. Жду, когда начальник охраны проводит меня в хранилище.', 'Нет, Кесслер хочет услышать заключение лично. Наедине.'], 1, 6);
        if (dist2D(npc.pos, game.player.pos) < 11) this.later(2, () => this.unlockOpportunity('appraisal', 'overheard'));
        break;
      default:
        break;
    }
  }

  onConsume(npc, id) {
    const cons = this.consumables.find((c) => c.id === id);
    if (!cons) return;
    if (!cons.available) return;
    if (id === 'vale_martini') {
      cons.available = false;
      cons.mesh.visible = false;
      npc._attachCarry?.('glass');
    }
    if (cons.poison) {
      const kind = cons.poison;
      cons.poison = null;
      npc.poisonSource = id;
      npc.poisoned(kind);
      if (npc.def.key === 'vale' && kind === 'emetic') this.valeSick = true;
      if (kind === 'emetic') this.game.hud.toast(`${npc.name}: отравление рвотным`);
    }
  }

  _introduceAppraiser() {
    const game = this.game;
    const chief = this.npc('chief');
    const kessler = this.npc('kessler');
    this.appraiserIntroduced = true;
    chief.say('Доктор Ларош? Наконец-то. Хранилище открыто, господин Кесслер сейчас подойдёт.');
    const vaultDoor = game.level.doors.find((d) => d.locked === 'keycard_vault');
    if (vaultDoor) {
      vaultDoor.locked = null;
      vaultDoor.open(false);
    }
    game.hud.toast('Кесслер направляется в хранилище');
    // Kessler walks to the vault and waits for the "appraiser".
    kessler.setState('scripted');
    kessler.guardPointOverride = 'vault_door_out';
    const meet = game.level.point('vault_meet');
    kessler.goTo(meet.x, meet.z, 1.6);
    let waited = 0;
    let greeted = false;
    kessler.scriptUpdate = (dt) => {
      if (kessler.moving || kessler.pathPending) return;
      waited += dt;
      kessler.faceYaw(meet.yaw, dt, 3);
      kessler.poseOverride = 'guard';
      const pd = dist2D(kessler.pos, game.player.pos);
      if (!greeted && pd < 3.5) {
        greeted = true;
        kessler.say('Доктор, прошу. Борис, закрой дверь — у нас разговор с глазу на глаз.');
        this.later(1.5, () => {
          if (vaultDoor && game.player.zone?.id === 'vault') vaultDoor.close();
        });
        this.later(5, () => kessler.alive && kessler.state === 'scripted' && kessler.say('Вот он, главный лот. Скажите мне, что он подлинный.'));
        this.later(12, () => kessler.alive && kessler.state === 'scripted' && kessler.say('Ну же, не молчите. Я жду.'));
      }
      if (waited > 80) {
        kessler.guardPointOverride = null;
        kessler.say('Похоже, доктор заблудился. Хватит, у меня гости.');
        kessler.resumeRoutine();
      }
    };
  }

  unlockOpportunity(id, how) {
    const o = this.opportunities.find((x) => x.id === id);
    if (!o || o.discovered || o.completed) return;
    o.discovered = true;
    this.game.hud.opportunity(o);
    this.game.audio?.play('objective');
    if (!this.tracked) this.tracked = o;
  }

  trackNext() {
    const list = this.opportunities.filter((o) => o.discovered && !o.completed && !o.failed);
    if (list.length === 0) {
      this.tracked = null;
      return;
    }
    const i = this.tracked ? list.indexOf(this.tracked) : -1;
    this.tracked = i + 1 >= list.length ? null : list[i + 1];
    this.game.hud.toast(this.tracked ? `Отслеживается: ${this.tracked.name}` : 'Отслеживание отключено');
  }

  currentStep(o) {
    if (!o) return null;
    return o.steps.find((s) => !s.done()) ?? null;
  }

  onPickup() {}

  onPoisoned(cons) {
    if (cons.id === 'kessler_decanter') this.unlockOpportunity('vintage', 'done');
    if (cons.id === 'vale_martini') this.unlockOpportunity('martini', 'done');
  }

  onNpcDown(npc, info) {
    const game = this.game;
    const st = game.stats;
    const t = this.targets.find((x) => x.npc === npc);
    // Loot drops
    if (npc.def.loot && !npc.lootDropped) {
      npc.lootDropped = true;
      for (const id of npc.def.loot) game.pickups.spawn(id, npc.pos.x + 0.5, npc.pos.z + 0.3);
    }
    if (t && info.lethal) {
      t.eliminated = true;
      t.method = info.method;
      t.accident = info.accident;
      t.disguise = game.player.disguise;
      t.zone = game.level.zoneAt(npc.pos.x, npc.pos.z)?.id;
      t.poisonSource = npc.poisonSource ?? null;
      this.eliminations.push(t);
      game.hud.toast(`Цель устранена: ${t.info.name}`, 'target');
      game.audio?.play('target');
      if (this.targets.every((x) => x.eliminated)) {
        this.later(2.5, () => game.hud.toast('Все цели устранены. Покиньте территорию.', 'objective'));
      }
      for (const o of this.opportunities) {
        if (o.target !== t.key || o.completed) continue;
        if (this._oppMatches(o, t)) {
          o.completed = true;
          o.discovered = true;
          game.hud.toast(`Возможность завершена: ${o.name}`, 'objective');
        } else o.failed = true;
      }
      if (this.tracked && (this.tracked.completed || this.tracked.failed)) this.tracked = null;
      return;
    }
    if (info.lethal) {
      st.nonTargetKills++;
      game.hud.toast('Убит посторонний', 'danger');
    } else {
      st.pacified++;
    }
  }

  _oppMatches(o, t) {
    switch (o.id) {
      case 'vintage':
        return t.poisonSource === 'kessler_decanter';
      case 'cigarette':
        return t.method === 'drowning';
      case 'martini':
        return t.poisonSource === 'vale_martini' || this.valeSick;
      case 'appraisal':
        return t.zone === 'vault';
      case 'call':
        return t.zone === 'study';
      default:
        return false;
    }
  }

  onBodyFound(body) {
    const game = this.game;
    const isTarget = this.targets.some((x) => x.npc === body);
    if (!isTarget) game.stats.bodiesFound++;
    game.hud.toast(isTarget ? 'Тело цели обнаружено' : body.alive ? 'Найден человек без сознания' : 'Тело обнаружено', isTarget ? 'info' : 'danger');
  }

  canExit() {
    return this.targets.every((t) => t.eliminated);
  }

  exit(ex) {
    if (this.ended) return;
    this.ended = true;
    this.exitUsed = ex;
    this.game.endMission(true);
  }

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }
    const game = this.game;
    const pl = game.player;
    // Proximity discoveries
    const appr = this.npc('appraiser');
    if (appr && !appr.isDown && dist2D(appr.pos, pl.pos) < 5) this.appraiserMet = true;
    if (pl.zone?.id === 'cellar') this.unlockOpportunity('vintage', 'area');
    const vale = this.npc('vale');
    if (vale?.ledge && dist2D(vale.pos, pl.pos) < 14) this.unlockOpportunity('cigarette', 'seen');
  }

  // --------------------------------------------------------------- scoring
  results() {
    const st = this.game.stats;
    const sa = !st.spotted && !st.witnessed && st.bodiesFound === 0 && st.nonTargetKills === 0 && !st.combat && st.compromised === 0;
    let stars = 5;
    if (!sa) {
      stars = 5;
      if (st.spotted || st.compromised) stars--;
      if (st.bodiesFound > 0) stars--;
      if (st.nonTargetKills > 0) stars -= Math.min(2, st.nonTargetKills);
      if (st.combat) stars--;
      stars = Math.max(1, stars);
    }
    const t = this.targets;
    const k = t.find((x) => x.key === 'kessler');
    const v = t.find((x) => x.key === 'vale');
    const challenges = [
      { name: 'Бесшумный убийца', desc: 'Никто не заметил, ни одного найденного тела, никаких лишних жертв.', done: sa },
      { name: 'Только костюм', desc: 'Выполните задание, ни разу не сменив одежду.', done: st.suitOnly },
      { name: 'Особый урожай', desc: 'Отравите личный графин Кесслера.', done: k.poisonSource === 'kessler_decanter' && k.method === 'poison' },
      { name: 'Холодная вода', desc: 'Столкните Марту Вейл с пирса.', done: v.method === 'drowning' },
      { name: 'Частная оценка', desc: 'Устраните Кесслера в хранилище под видом оценщика.', done: k.zone === 'vault' && k.disguise === 'appraiser' },
      { name: 'Мартини с сюрпризом', desc: 'Отравите мартини Марты Вейл.', done: v.poisonSource === 'vale_martini' || !!this.valeSick },
      { name: 'Звонок оборвался', desc: 'Устраните Кесслера в его кабинете.', done: k.zone === 'study' },
      { name: 'Призрак', desc: 'Никого не обезвреживайте, кроме целей.', done: st.pacified === 0 && st.nonTargetKills === 0 },
      { name: 'Классика', desc: 'Устраните цель удавкой.', done: t.some((x) => x.method === 'fiberwire') },
      { name: 'Меткий стрелок', desc: 'Устраните обе цели выстрелом.', done: t.every((x) => x.method === 'pistol') },
    ];
    return { sa, stars, challenges, time: formatTime(this.game.time), stats: st, exit: this.exitUsed };
  }
}
