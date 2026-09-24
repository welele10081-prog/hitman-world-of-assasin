import { TARGETS } from '../levels/villaNPCs.js';
import { DISGUISES } from '../entities/Outfits.js';

// Full-screen menus: title, briefing, pause, map, results.

const CONTROLS = [
  ['W A S D', 'Движение'],
  ['Мышь', 'Камера'],
  ['Shift', 'Бег'],
  ['C / Ctrl', 'Присесть / красться'],
  ['E', 'Основное действие (двери, предметы, тела)'],
  ['R', 'Дополнительное действие (переодеться, рвотное)'],
  ['F', 'Обезвредить / устранить / столкнуть'],
  ['ПКМ', 'Прицелиться (оружие / бросок)'],
  ['ЛКМ', 'Выстрел / бросок'],
  ['1–9, колесо', 'Выбор предмета · 0 / H — убрать'],
  ['G', 'Выбросить предмет'],
  ['Q (удерживать)', 'Чутьё: видеть людей сквозь стены'],
  ['J', 'Переключить отслеживаемую возможность'],
  ['Tab / M', 'Карта и задания'],
  ['Esc', 'Пауза'],
];

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class Screens {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'screens', root);
    this.current = null;
  }

  hide() {
    this.root.innerHTML = '';
    this.root.style.display = 'none';
    this.current = null;
  }

  _screen(cls) {
    this.root.innerHTML = '';
    this.root.style.display = 'flex';
    return el('div', `screen ${cls}`, this.root);
  }

  loading(text = 'Загрузка виллы «Серено»...') {
    const s = this._screen('loading');
    el('div', 'logo', s, 'ТИХИЙ КОНТРАКТ');
    el('div', 'loading-text', s, text);
    this.current = 'loading';
  }

  title() {
    const s = this._screen('title');
    this.current = 'title';
    el('div', 'logo', s, 'ТИХИЙ КОНТРАКТ');
    el('div', 'subtitle', s, 'Вилла «Серено» · озеро Ардо');
    const menu = el('div', 'menu', s);
    const btn = (text, fn, primary = false) => {
      const b = el('button', `btn ${primary ? 'primary' : ''}`, menu, text);
      b.onclick = () => {
        this.game.audio.init();
        this.game.audio.play('ui');
        fn();
      };
      return b;
    };
    btn('Начать миссию', () => this.briefing(), true);
    btn('Управление', () => this.controls(() => this.title()));
    btn('Настройки', () => this.settings(() => this.title()));
    const best = this.game.progress;
    const done = Object.values(best.challenges ?? {}).filter(Boolean).length;
    el('div', 'foot', s, `Испытаний выполнено: ${done} / 10${best.bestStars ? ` · лучший рейтинг: ${'★'.repeat(best.bestStars)}` : ''}`);
    el('div', 'disclaimer', s, 'Фанатская стелс-песочница. Все персонажи и события вымышлены.');
  }

  briefing() {
    const s = this._screen('briefing');
    this.current = 'briefing';
    el('div', 'brief-head', s, '<div class="brief-kicker">КОНТРАКТ</div><div class="brief-title">Последний лот</div>');
    el(
      'div',
      'brief-text',
      s,
      `<p><b>Диспетчер:</b> Добрый вечер, Ворон. Озеро Ардо, север Италии. Вилла «Серено» сегодня принимает закрытый винный вечер и аукцион «искусства».</p>
       <p>За картинами прячутся деньги от поставок оружия. Хозяин вечера, Виктор Кесслер, продаёт стволы всем сторонам любых конфликтов. Его финансист, Марта Вейл, делает эти деньги чистыми. Клиент хочет, чтобы этот вечер стал для обоих последним.</p>
       <p>У тебя приглашение на имя гостя: костюм пустит тебя в сад, на террасу, в главный зал и галерею. Всё остальное за пределами гостевых зон. Охрана многочисленна и нервничает. Слушай разговоры: люди охотно выдают чужие привычки.</p>
       <p>Сделай всё тихо. Выход по воде, через ворота или на фургоне кейтеринга.</p>`,
    );
    const cards = el('div', 'targets', s);
    for (const t of Object.values(TARGETS)) {
      el('div', 'target-card', cards, `<div class="tc-name">${t.name}</div><div class="tc-title">${t.title}</div><div class="tc-bio">${t.bio}</div>`);
    }
    el('div', 'brief-loadout', s, '<b>Снаряжение:</b> пистолет «Сойка» с глушителем (12 патронов) · удавка · 3 монеты');
    const menu = el('div', 'menu row', s);
    const back = el('button', 'btn', menu, 'Назад');
    back.onclick = () => this.title();
    const go = el('button', 'btn primary', menu, 'Начать');
    go.onclick = () => {
      this.game.audio.init();
      this.game.startMission();
    };
  }

  controls(onBack) {
    const s = this._screen('controls');
    this.current = 'controls';
    el('div', 'screen-title', s, 'Управление');
    const t = el('div', 'controls-table', s);
    for (const [k, d] of CONTROLS) el('div', 'ctrl', t, `<span class="ctrl-key">${k}</span><span class="ctrl-desc">${d}</span>`);
    el(
      'div',
      'tips',
      s,
      `<b>Советы.</b> Смотри на плашку маскировки: в чужой зоне тебя быстро заметят. Люди с белой точкой (в режиме чутья) могут раскусить твою маскировку.
      Прячь тела в шкафы и контейнеры. Монета отвлечёт охранника. Удушение со спины бесшумно, но свидетели не должны этого видеть.`,
    );
    const b = el('button', 'btn', el('div', 'menu', s), 'Назад');
    b.onclick = onBack;
  }

  settings(onBack) {
    const s = this._screen('settings');
    this.current = 'settings';
    const g = this.game;
    el('div', 'screen-title', s, 'Настройки');
    const form = el('div', 'settings-form', s);
    const row = (label) => {
      const r = el('div', 'set-row', form);
      el('label', '', r, label);
      return r;
    };
    const q = row('Качество графики');
    const sel = el('select', '', q);
    for (const [v, t] of [['high', 'Высокое'], ['medium', 'Среднее'], ['low', 'Низкое']]) {
      const o = el('option', '', sel, t);
      o.value = v;
      if (g.settings.quality === v) o.selected = true;
    }
    sel.onchange = () => {
      g.settings.quality = sel.value;
      g.saveSettings();
      el('div', 'note', form, 'Качество применится после перезагрузки страницы.');
    };
    const sens = row('Чувствительность мыши');
    const sr = el('input', '', sens);
    sr.type = 'range';
    sr.min = '0.4';
    sr.max = '2.5';
    sr.step = '0.1';
    sr.value = String(g.settings.sensitivity);
    sr.oninput = () => {
      g.settings.sensitivity = Number(sr.value);
      g.applySettings();
      g.saveSettings();
    };
    const vol = row('Громкость');
    const vr = el('input', '', vol);
    vr.type = 'range';
    vr.min = '0';
    vr.max = '1';
    vr.step = '0.05';
    vr.value = String(g.settings.volume);
    vr.oninput = () => {
      g.settings.volume = Number(vr.value);
      g.applySettings();
      g.saveSettings();
    };
    const inv = row('Инвертировать ось Y');
    const cb = el('input', '', inv);
    cb.type = 'checkbox';
    cb.checked = !!g.settings.invertY;
    cb.onchange = () => {
      g.settings.invertY = cb.checked;
      g.applySettings();
      g.saveSettings();
    };
    const b = el('button', 'btn', el('div', 'menu', s), 'Назад');
    b.onclick = onBack;
  }

  pause() {
    const s = this._screen('pause');
    this.current = 'pause';
    el('div', 'screen-title', s, 'Пауза');
    const menu = el('div', 'menu', s);
    const btn = (t, fn, primary) => {
      const b = el('button', `btn ${primary ? 'primary' : ''}`, menu, t);
      b.onclick = fn;
    };
    btn('Продолжить', () => this.game.resume(), true);
    btn('Карта и задания', () => this.map(true));
    btn('Управление', () => this.controls(() => this.pause()));
    btn('Настройки', () => this.settings(() => this.pause()));
    btn('Начать заново', () => this.game.restart());
    btn('Выйти в меню', () => this.game.quitToTitle());
  }

  map(fromPause = false) {
    const s = this._screen('mapscreen');
    this.current = 'map';
    const g = this.game;
    const wrap = el('div', 'map-wrap', s);
    const cv = el('canvas', 'bigmap', wrap);
    const side = el('div', 'map-side', wrap);
    const b = g.level.bounds;
    const maxW = Math.min(window.innerWidth * 0.62, 900);
    const scale = maxW / (b.maxX - b.minX);
    cv.width = Math.round((b.maxX - b.minX) * scale);
    cv.height = Math.round((b.maxZ - b.minZ) * scale);
    const ctx = cv.getContext('2d');
    if (!g.hud.mapLayer || g.hud.mapLayerDisguise !== g.player.disguise) g.hud.buildMapLayer();
    ctx.drawImage(g.hud.mapLayer, 0, 0, cv.width, cv.height);
    const X = (x) => (x - b.minX) * scale;
    const Z = (z) => (z - b.minZ) * scale;
    // zone labels
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const zn of g.level.zones) {
      if (['grounds'].includes(zn.id)) continue;
      const r = zn.rects[0];
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(zn.name, X((r[0] + r[2]) / 2), Z((r[1] + r[3]) / 2));
    }
    // exits
    for (const ex of g.level.exits) {
      ctx.fillStyle = '#5ad08a';
      ctx.beginPath();
      ctx.arc(X(ex.x), Z(ex.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // targets
    for (const t of g.mission.targets) {
      if (t.eliminated) continue;
      ctx.fillStyle = '#ff3434';
      ctx.beginPath();
      ctx.arc(X(t.npc.pos.x), Z(t.npc.pos.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(t.info.name, X(t.npc.pos.x), Z(t.npc.pos.z) - 9);
    }
    // player
    const p = g.player;
    ctx.save();
    ctx.translate(X(p.pos.x), Z(p.pos.z));
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.fill();
    ctx.restore();
    // tracked opportunity
    const step = g.mission.currentStep(g.mission.tracked);
    const w = step?.where?.();
    if (w) {
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 2;
      ctx.strokeRect(X(w.x) - 6, Z(w.z) - 6, 12, 12);
    }

    // side panel
    let html = '<div class="side-title">Задание</div>';
    for (const t of g.mission.targets) html += `<div class="side-obj ${t.eliminated ? 'done' : ''}">${t.eliminated ? '✓' : '•'} ${t.info.name}</div>`;
    html += `<div class="side-obj ${g.mission.canExit() ? '' : 'dim'}">• Покинуть территорию</div>`;
    html += '<div class="side-title">Возможности</div>';
    const opps = g.mission.opportunities.filter((o) => o.discovered);
    if (opps.length === 0) html += '<div class="side-dim">Пока ничего. Слушайте разговоры и исследуйте виллу.</div>';
    for (const o of opps) {
      const st = o.completed ? 'выполнено' : o.failed ? 'недоступно' : g.mission.tracked === o ? 'отслеживается' : '';
      html += `<div class="side-opp ${o.completed ? 'done' : ''} ${o.failed ? 'failed' : ''}"><div class="so-name">${o.name} <span class="so-st">${st}</span></div>`;
      if (!o.completed && !o.failed) {
        for (const s2 of o.steps) html += `<div class="so-step ${s2.done() ? 'done' : ''}">${s2.done() ? '✓' : '○'} ${s2.text}</div>`;
      }
      html += '</div>';
    }
    html += `<div class="side-title">Маскировка</div><div class="side-dim">${DISGUISES[g.player.disguise].name}. Оранжевым отмечены закрытые зоны, красным — враждебные.</div>`;
    html += '<div class="legend"><span class="lg ex"></span>выход <span class="lg tg"></span>цель <span class="lg op"></span>возможность</div>';
    side.innerHTML = html;
    const menu = el('div', 'menu row', s);
    const back = el('button', 'btn primary', menu, fromPause ? 'Назад' : 'Закрыть (Tab)');
    back.onclick = () => (fromPause ? this.pause() : this.game.closeMap());
  }

  results(success, res) {
    const s = this._screen('results');
    this.current = 'results';
    el('div', 'brief-kicker', s, success ? 'КОНТРАКТ ВЫПОЛНЕН' : 'КОНТРАКТ ПРОВАЛЕН');
    el('div', 'res-title', s, success ? (res.sa ? 'Бесшумный убийца' : 'Задание выполнено') : 'Ворон погиб');
    if (success) {
      el('div', 'stars', s, '★'.repeat(res.stars) + '<span class="dim">' + '★'.repeat(5 - res.stars) + '</span>');
      const st = res.stats;
      el(
        'div',
        'res-stats',
        s,
        `<div><span>Время</span><b>${res.time}</b></div>
         <div><span>Выход</span><b>${res.exit?.name ?? '—'}</b></div>
         <div><span>Замечен</span><b>${st.spotted || st.compromised ? 'да' : 'нет'}</b></div>
         <div><span>Найдено тел</span><b>${st.bodiesFound}</b></div>
         <div><span>Лишние жертвы</span><b>${st.nonTargetKills}</b></div>
         <div><span>Обезврежено</span><b>${st.pacified}</b></div>
         <div><span>Спрятано тел</span><b>${st.bodiesHidden}</b></div>
         <div><span>Выстрелов</span><b>${st.shotsFired}</b></div>`,
      );
      const ch = el('div', 'challenges', s);
      for (const c of res.challenges) el('div', `chal ${c.done ? 'done' : ''}`, ch, `<div class="chal-name">${c.done ? '✓' : '○'} ${c.name}</div><div class="chal-desc">${c.desc}</div>`);
    } else {
      el('div', 'brief-text', s, '<p>Охрана виллы оказалась сильнее. Попробуй действовать тише: смени маскировку, прячь тела и не попадайся на глаза с оружием.</p>');
    }
    const menu = el('div', 'menu row', s);
    const again = el('button', 'btn primary', menu, 'Играть снова');
    again.onclick = () => this.game.restart();
    const title = el('button', 'btn', menu, 'В меню');
    title.onclick = () => this.game.quitToTitle();
  }
}
