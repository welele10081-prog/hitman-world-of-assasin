import { SKIN_TONES, HAIR_COLORS } from '../entities/Outfits.js';
import { mulberry32, pick } from '../core/util.js';

// Everyone at Villa Sereno tonight. Routines loop forever.
// Step: { at, wait, pose, sit, say, event, eventAtStart, consume, consumeAt, convo:{id, role}, label, speed, face, guardPoint, ledge }

const rng = mulberry32(4242);
const look = (female, extra = {}) => ({
  female,
  skin: pick(rng, SKIN_TONES),
  hair: pick(rng, HAIR_COLORS),
  hairStyle: female ? pick(rng, ['long', 'bun', 'bob', 'ponytail']) : pick(rng, ['short', 'short', 'slick', 'short']),
  beard: !female && rng() < 0.2,
  mustache: !female && rng() < 0.1,
  build: 0.94 + rng() * 0.14,
  height: female ? 0.93 + rng() * 0.05 : 0.97 + rng() * 0.06,
  ...extra,
});

export const TARGETS = {
  kessler: {
    key: 'kessler',
    name: 'Виктор Кесслер',
    title: 'Хозяин виллы, торговец оружием',
    bio: 'Посредник, который годами продаёт оружие обеим сторонам любых конфликтов. Сегодня он устраивает закрытый аукцион, чтобы отмыть деньги через «искусство». Осторожен, любит своё вино и не расстаётся с телохранителем.',
  },
  vale: {
    key: 'vale',
    name: 'Марта Вейл',
    title: 'Финансист Кесслера',
    bio: 'Архитектор его денежных схем: подставные фонды, аукционы, офшоры. Без неё империя Кесслера рухнет за неделю. Пьёт сухой мартини и курит, когда нервничает, а нервничает она всегда.',
  },
};

export function villaNPCs() {
  const list = [];
  const add = (def) => {
    list.push(def);
    return def;
  };

  // ------------------------------------------------------------ targets
  add({
    key: 'kessler',
    name: TARGETS.kessler.name,
    role: 'target',
    target: true,
    outfit: 'kessler',
    look: { skin: 0xd8b494, hair: 0x9a9a9a, hairStyle: 'short', beard: true, build: 1.1, height: 1.0 },
    point: 'terrace_speech',
    routine: [
      { at: 'terrace_speech', wait: 32, pose: 'talk', label: 'speech', event: 'kessler_speech' },
      { at: 'hall_ct3', wait: 30, convo: { id: 'kessler_mingle', role: 0 } },
      { at: 'study_window', wait: 45, pose: 'phone', label: 'call', event: 'kessler_call', guardPoint: 'study_guard_out' },
      { at: 'lectern', wait: 30, pose: 'talk', label: 'lectern', event: 'kessler_lectern', guardPoint: 'gallery_front' },
      { at: 'cellar_kessler', wait: 28, pose: 'drink', consume: 'kessler_decanter', consumeAt: 14, label: 'tasting', event: 'kessler_tasting', guardPoint: 'cellar_guard' },
      { at: 'terrace_view2', wait: 22, pose: 'drink' },
    ],
  });
  add({
    key: 'vale',
    name: TARGETS.vale.name,
    role: 'target',
    target: true,
    outfit: 'vale',
    look: { female: true, skin: 0xe8c8b0, hair: 0x3a2014, hairStyle: 'bun', height: 0.97 },
    point: 'terrace_t3b',
    routine: [
      { at: 'terrace_t3b', wait: 35, sit: true, convo: { id: 'vale_terrace', role: 0 } },
      { at: 'pier_end', wait: 40, pose: 'smoke', label: 'smoke', event: 'vale_smoke', ledge: true },
      { at: 'bar_customer1', wait: 32, pose: 'drink', consume: 'vale_martini', consumeAt: 9, label: 'bar', event: 'vale_heading_bar', eventAtStart: true },
      { at: 'gallery_view2', wait: 28, pose: 'listen', convo: { id: 'vale_gallery', role: 0 } },
      { at: 'garden_fountain_e', wait: 18, pose: 'phone' },
    ],
  });

  // ------------------------------------------------------------ security
  add({
    key: 'bodyguard',
    name: 'Борис, телохранитель',
    role: 'guard',
    outfit: 'guard',
    enforces: ['guard'],
    look: { skin: 0xc89878, hair: 0x2a1c12, hairStyle: 'short', beard: true, build: 1.18, height: 1.05 },
    point: 'hall_center',
    follow: 'kessler',
  });
  add({
    key: 'chief',
    name: 'Густав Брандт',
    role: 'guard',
    outfit: 'security_chief',
    enforces: ['guard', 'security_chief'],
    loot: ['keycard_vault'],
    look: { skin: 0xe0bca0, hair: 0x6a4a2a, hairStyle: 'short', mustache: true, build: 1.08 },
    point: 'gallery_chief',
    routine: [
      { at: 'gallery_chief', wait: 40, pose: 'guard', label: 'gallery' },
      { at: 'vault_door_out', wait: 15, pose: 'guard' },
      { at: 'hall_entrance', wait: 12, pose: 'guard' },
      { at: 'security_desk', wait: 30, sit: true, pose: 'lookDown' },
      { at: 'courtyard_guard1', wait: 12, pose: 'guard' },
      { at: 'terrace_center', wait: 15, pose: 'guard' },
    ],
  });
  const guard = (key, point, routine, extra = {}) =>
    add({ key, name: 'Охранник', role: 'guard', outfit: extra.outfit ?? 'guard', look: look(false, { hairStyle: 'short' }), point, routine, ...extra });
  const post = (p, pose = 'guard') => [{ at: p, wait: 999, pose, hold: true }];
  guard('g_gate1', 'gate_guard1', post('gate_guard1'), { outfit: 'guard_tactical' });
  guard('g_gate2', 'gate_guard2', post('gate_guard2', 'behindBack'), { outfit: 'guard_tactical' });
  guard('g_court', 'courtyard_fountain1', [
    { at: 'courtyard_fountain1', wait: 6 },
    { at: 'courtyard_cars', wait: 5 },
    { at: 'courtyard_west', wait: 6 },
    { at: 'courtyard_entrance', wait: 8, pose: 'behindBack' },
    { at: 'courtyard_fountain2', wait: 5 },
  ]);
  guard('g_entr', 'courtyard_guard2', post('courtyard_guard2', 'behindBack'));
  guard('g_staffgate', 'staff_gate_guard', post('staff_gate_guard'));
  guard('g_hall1', 'hall_guard1', post('hall_guard1', 'behindBack'), { enforces: ['guard'] });
  guard('g_gallery', 'gallery_guard', post('gallery_guard'));
  guard('g_vault', 'vault_door_guard', post('vault_door_guard'), { outfit: 'guard_tactical', enforces: ['guard'] });
  guard('g_terrace', 'terrace_guard1', [
    { at: 'terrace_guard1', wait: 8 },
    { at: 'terrace_view1', wait: 8, pose: 'behindBack' },
    { at: 'garden_center', wait: 6 },
    { at: 'terrace_view3', wait: 8, pose: 'behindBack' },
    { at: 'terrace_guard2', wait: 8 },
  ]);
  guard('g_pier', 'pier_guard', post('pier_guard', 'behindBack'));
  guard('g_eastgate', 'garden_gate_guard', post('garden_gate_guard'));
  guard('g_boathouse', 'boathouse_in', [
    { at: 'boathouse_in', wait: 10, convo: { id: 'boathouse_guards', role: 0 } },
    { at: 'boathouse_door_out', wait: 8, pose: 'behindBack' },
    { at: 'garden_west', wait: 6 },
    { at: 'boathouse_dock', wait: 8 },
  ]);
  guard('g_cellar', 'cellar_guard', post('cellar_guard', 'behindBack'));
  guard('g_sec1', 'security_table', [{ at: 'security_table', wait: 999, sit: true, pose: 'lookDown', hold: true }], { outfit: 'guard_tactical' });
  guard('g_sec2', 'security_door_out', [
    { at: 'security_door_out', wait: 12, pose: 'guard' },
    { at: 'west_service_gap', wait: 8 },
    { at: 'west_path', wait: 8 },
    { at: 'cellar_back', wait: 6 },
    { at: 'security_lockers', wait: 10 },
  ], { outfit: 'guard_tactical' });
  guard('g_yard', 'yard_center', [
    { at: 'yard_center', wait: 6 },
    { at: 'van_back', wait: 6 },
    { at: 'dumpsters', wait: 5 },
    { at: 'yard_gate_n', wait: 6 },
    { at: 'crates_yard', wait: 5 },
  ]);
  guard('g_hall2', 'hall_guard2', [
    { at: 'hall_guard2', wait: 20, pose: 'behindBack', convo: { id: 'guards_call', role: 0 } },
    { at: 'hall_entrance', wait: 10 },
    { at: 'hall_kitchen_door', wait: 6 },
  ]);

  // ------------------------------------------------------------ staff
  add({
    key: 'bartender',
    name: 'Лука, бармен',
    role: 'staff',
    outfit: 'bartender',
    look: look(false, { hairStyle: 'short', beard: true }),
    point: 'bartender',
    routine: [
      { at: 'bartender', wait: 25, pose: 'work', label: 'bar' },
      { at: 'bartender2', wait: 15, pose: 'work' },
      { at: 'kitchen_fridge', wait: 14, pose: 'work', label: 'fetch_ice', speed: 'brisk' },
    ],
  });
  add({
    key: 'sommelier',
    name: 'Анри, сомелье',
    role: 'staff',
    outfit: 'sommelier',
    look: look(false, { hairStyle: 'short', mustache: true }),
    point: 'cellar_somm',
    routine: [
      { at: 'cellar_somm', wait: 40, pose: 'work', label: 'table' },
      { at: 'cellar_racks', wait: 14, pose: 'lookDown' },
      { at: 'cellar_barrels', wait: 10, pose: 'work' },
      { at: 'cellar_somm', wait: 25, pose: 'work' },
      { at: 'bartender2', wait: 12, pose: 'talk', say: 'Лука, я принёс ещё два ящика бароло.' },
    ],
  });
  add({
    key: 'headchef',
    name: 'Шеф Орсини',
    role: 'staff',
    outfit: 'head_chef',
    enforces: ['chef'],
    look: look(false, { hairStyle: 'short', mustache: true, build: 1.15 }),
    point: 'kitchen_island',
    routine: [
      { at: 'kitchen_island', wait: 25, pose: 'work' },
      { at: 'kitchen_stove', wait: 10, pose: 'lookDown' },
      { at: 'kitchen_counter_e', wait: 12, pose: 'work' },
      { at: 'kitchen_pass', wait: 8, pose: 'talk', say: 'Горячее на террасу, живо!' },
    ],
  });
  const chef = (key, route) => add({ key, name: 'Повар', role: 'staff', outfit: 'chef', look: look(rng() < 0.3), point: route[0].at, routine: route });
  chef('cook1', [{ at: 'kitchen_stove', wait: 30, pose: 'work' }, { at: 'kitchen_island2', wait: 18, pose: 'work' }]);
  chef('cook2', [
    { at: 'kitchen_counter_e', wait: 30, pose: 'work' },
    { at: 'kitchen_service', wait: 3 },
    { at: 'crates_yard', wait: 25, pose: 'smoke', convo: { id: 'cooks_break', role: 0 } },
    { at: 'kitchen_stove2', wait: 25, pose: 'work' },
  ]);
  const waiter = (key, route, female = false) =>
    add({ key, name: 'Официант', role: 'staff', outfit: 'waiter', look: look(female), point: route[0].at, routine: route, carry: 'tray' });
  waiter('waiter1', [
    { at: 'kitchen_tray', wait: 6 },
    { at: 'hall_ct1b', wait: 5 },
    { at: 'hall_ct2b', wait: 5 },
    { at: 'terrace_waiter', wait: 6 },
    { at: 'terrace_ct1b', wait: 5 },
    { at: 'hall_ct5b', wait: 5 },
  ]);
  waiter('waiter2', [
    { at: 'terrace_waiter', wait: 5 },
    { at: 'terrace_ct2b', wait: 5 },
    { at: 'terrace_t4a', wait: 4 },
    { at: 'garden_center', wait: 5 },
    { at: 'kitchen_tray', wait: 8 },
  ], true);
  waiter('waiter3', [
    { at: 'gallery_front', wait: 6 },
    { at: 'gallery_view4', wait: 5 },
    { at: 'hall_ct3b', wait: 5 },
    { at: 'kitchen_tray', wait: 8 },
    { at: 'staff_table', wait: 20, sit: true, convo: { id: 'waiters_break', role: 1 } },
  ]);
  add({
    key: 'waiter4',
    name: 'Официантка',
    role: 'staff',
    outfit: 'waiter',
    look: look(true),
    point: 'staff_table2',
    routine: [
      { at: 'staff_table2', wait: 40, sit: true, convo: { id: 'waiters_break', role: 0 } },
      { at: 'staff_lockers', wait: 8, pose: 'lookDown' },
      { at: 'kitchen_tray', wait: 6 },
      { at: 'terrace_ct3b', wait: 6 },
      { at: 'hall_ct4', wait: 6 },
    ],
  });
  add({
    key: 'gardener',
    name: 'Садовник Пьетро',
    role: 'staff',
    outfit: 'gardener',
    look: look(false, { hairStyle: 'short', beard: true }),
    point: 'gardener_bed4',
    routine: [
      { at: 'gardener_bed4', wait: 22, pose: 'kneelWork' },
      { at: 'gardener_bed2', wait: 20, pose: 'kneelWork' },
      { at: 'greenhouse_t2', wait: 25, pose: 'work' },
      { at: 'shed_in', wait: 20, pose: 'lookDown' },
      { at: 'gardener_bed1', wait: 22, pose: 'kneelWork' },
      { at: 'gardener_bed3', wait: 20, pose: 'kneelWork' },
    ],
  });
  add({
    key: 'technician',
    name: 'Техник',
    role: 'staff',
    outfit: 'technician',
    look: look(false),
    point: 'generator',
    routine: [
      { at: 'generator', wait: 30, pose: 'kneelWork' },
      { at: 'van_back', wait: 12, pose: 'lookDown' },
      { at: 'boathouse_dock2', wait: 30, pose: 'kneelWork' },
      { at: 'greenhouse_t1', wait: 15, pose: 'work' },
    ],
  });
  add({
    key: 'appraiser',
    name: 'Доктор Эмиль Ларош',
    role: 'guest',
    outfit: 'appraiser',
    look: { skin: 0xe8c8b0, hair: 0xb0a898, hairStyle: 'short', beard: true, build: 0.95, height: 0.98 },
    point: 'boathouse_table',
    carry: 'clipboard',
    routine: [
      { at: 'boathouse_table', wait: 40, sit: true, pose: 'lookDown' },
      { at: 'boathouse_dock', wait: 22, pose: 'phone', event: 'appraiser_call' },
      { at: 'boathouse_bench', wait: 18, pose: 'lookDown' },
    ],
  });
  add({
    key: 'pianist',
    name: 'Пианист',
    role: 'guest',
    outfit: 'guest_black',
    look: look(false, { hairStyle: 'short' }),
    point: 'piano_seat',
    routine: [{ at: 'piano_seat', wait: 999, sit: true, pose: 'piano', hold: true }],
  });

  // ------------------------------------------------------------ guests
  const maleOutfits = ['guest_navy', 'guest_black', 'guest_beige', 'guest_white', 'guest_burgundy'];
  const femaleOutfits = ['dress_red', 'dress_black', 'dress_emerald', 'dress_gold', 'dress_blue'];
  let gi = 0;
  const guest = (female, route, extra = {}) => {
    const outfit = female ? femaleOutfits[gi % femaleOutfits.length] : maleOutfits[gi % maleOutfits.length];
    gi++;
    return add({ key: `guest${gi}`, name: 'Гость', role: 'guest', outfit, look: look(female), point: route[0].at, routine: route, carry: extra.carry ?? (rng() < 0.5 ? 'glass' : null), ...extra });
  };

  // Hall pair — hint about the decanter
  guest(false, [
    { at: 'hall_ct1', wait: 45, pose: 'drink', convo: { id: 'decanter_hint', role: 0 } },
    { at: 'gallery_view1', wait: 25, pose: 'listen' },
    { at: 'terrace_ct4', wait: 30, pose: 'drink' },
  ]);
  guest(true, [
    { at: 'hall_ct1b', wait: 45, convo: { id: 'decanter_hint', role: 1 } },
    { at: 'gallery_view3', wait: 25, pose: 'listen' },
    { at: 'terrace_view1', wait: 30, pose: 'drink' },
  ]);
  // Terrace pair — hint about Vale smoking on the pier
  guest(true, [
    { at: 'terrace_ct1', wait: 50, pose: 'drink', convo: { id: 'smoke_hint', role: 0 } },
    { at: 'garden_fountain_w', wait: 25, pose: 'listen' },
  ]);
  guest(false, [
    { at: 'terrace_ct1b', wait: 50, convo: { id: 'smoke_hint', role: 1 } },
    { at: 'garden_fountain_w2', wait: 25, pose: 'talk' },
  ]);
  // Vale's companion on the terrace
  guest(false, [
    { at: 'terrace_t3a', wait: 35, sit: true, convo: { id: 'vale_terrace', role: 1 } },
    { at: 'terrace_view2', wait: 30, pose: 'drink' },
    { at: 'hall_ct5', wait: 30, pose: 'drink' },
  ]);
  // Kessler mingles with these two
  guest(true, [{ at: 'hall_ct3b', wait: 60, convo: { id: 'kessler_mingle', role: 1 } }, { at: 'sofa1', wait: 40, sit: true }]);
  guest(false, [{ at: 'hall_ct2', wait: 50, pose: 'drink', convo: { id: 'art_talk', role: 0 } }, { at: 'gallery_seat1', wait: 40, sit: true }]);
  guest(true, [{ at: 'hall_ct2b', wait: 50, convo: { id: 'art_talk', role: 1 } }, { at: 'gallery_seat3', wait: 40, sit: true }]);
  guest(false, [{ at: 'sofa2', wait: 60, sit: true, convo: { id: 'lake_talk', role: 0 } }, { at: 'bar_customer2', wait: 30, pose: 'drink' }]);
  guest(true, [{ at: 'sofa3', wait: 60, sit: true, convo: { id: 'lake_talk', role: 1 } }, { at: 'terrace_view3', wait: 30, pose: 'drink' }]);
  guest(false, [{ at: 'terrace_t1a', wait: 60, sit: true, convo: { id: 'business_talk', role: 0 } }, { at: 'shore_view1', wait: 30 }]);
  guest(false, [{ at: 'terrace_t1b', wait: 60, sit: true, convo: { id: 'business_talk', role: 1 } }, { at: 'bar_customer3', wait: 30, pose: 'drink' }]);
  guest(true, [{ at: 'gazebo2', wait: 50, convo: { id: 'gazebo_talk', role: 0 } }, { at: 'garden_bench2', wait: 30, sit: true }]);
  guest(false, [{ at: 'gazebo3', wait: 50, convo: { id: 'gazebo_talk', role: 1 } }, { at: 'shore_view3', wait: 30 }]);
  guest(true, [{ at: 'terrace_t2a', wait: 50, sit: true }, { at: 'arm1', wait: 40, sit: true }]);
  guest(false, [{ at: 'gallery_view4', wait: 40, pose: 'listen' }, { at: 'terrace_t4b', wait: 40, sit: true }, { at: 'garden_bench3', wait: 30, sit: true }]);
  // Public promenade (outside the estate)
  add({ key: 'walker1', name: 'Прохожий', role: 'guest', outfit: 'guest_beige', look: look(false), point: 'prom1', routine: [{ at: 'prom1', wait: 10 }, { at: 'prom2', wait: 12 }, { at: 'jetty', wait: 15 }] });

  return list;
}

// Ambient conversations. Speaker index refers to `role` in the step's convo.
export const CONVOS = {
  decanter_hint: {
    lines: [
      [0, 'Вы видели, как Кесслер бережёт свой графин? Никому не наливает.'],
      [1, 'Ещё бы. Каждый вечер он сам спускается в винный погреб и пробует свой урожай.'],
      [0, 'И сомелье к графину никого не подпускает. Вот это паранойя.'],
      [1, 'При его профессии я бы тоже пила только своё.'],
    ],
    unlock: 'vintage',
  },
  smoke_hint: {
    lines: [
      [0, 'Марта опять ушла курить на пирс?'],
      [1, 'Она всегда курит там, в самом конце, одна. Говорит, вода её успокаивает.'],
      [0, 'Там же даже перил нет. Однажды она свалится в озеро.'],
      [1, 'С её каблуками? Не удивлюсь.'],
    ],
    unlock: 'cigarette',
  },
  vale_terrace: {
    lines: [
      [1, 'Марта, ты сегодня сама не своя.'],
      [0, 'Цифры не сходятся, Андре. А когда цифры не сходятся, Виктор начинает задавать вопросы.'],
      [1, 'Выпей мартини, станет легче.'],
      [0, 'Лука уже знает мой заказ. Сухой, с оливкой. Как всегда.'],
    ],
    unlock: 'martini',
  },
  vale_gallery: { lines: [[0, 'Шестой лот — подделка. Но покупатель об этом никогда не узнает.']] },
  kessler_mingle: {
    lines: [
      [0, 'Рад, что вы добрались. Озеро Ардо в это время года — лучшее место на земле.'],
      [1, 'Вы обещали показать нам главный лот, Виктор.'],
      [0, 'Всему своё время. Сначала оценщик должен подтвердить подлинность. В хранилище, с глазу на глаз.'],
    ],
    unlock: 'appraisal',
  },
  guards_call: {
    lines: [
      [0, 'Шеф опять уйдёт звонить в кабинет?'],
      [0, 'Каждый круг одно и то же. Внутрь никого, Борис торчит у двери.'],
    ],
    unlock: 'call',
    solo: true,
  },
  boathouse_guards: {
    lines: [
      [0, 'Оценщик сидит здесь уже час. Брандт сказал: к хранилищу его ведёт только он сам.'],
      [0, 'Лицо этого доктора никто из нас даже не видел. Только имя в списке.'],
    ],
    unlock: 'appraisal',
    solo: true,
  },
  art_talk: {
    lines: [
      [0, 'Абстракция — лучший способ перевести деньги через границу.'],
      [1, 'Тише! Здесь все делают вид, что ценят искусство.'],
      [0, 'Я ценю. Особенно когда оно стоит сорок миллионов.'],
    ],
  },
  lake_talk: {
    lines: [
      [0, 'Говорят, озеро здесь глубиной больше трёхсот метров.'],
      [1, 'Идеальное место, чтобы что-нибудь утопить. Или кого-нибудь.'],
      [0, 'Не шути так на вечеринке у Кесслера.'],
    ],
  },
  business_talk: {
    lines: [
      [0, 'Партия ушла через порт в Генуе. Никаких вопросов.'],
      [1, 'Вейл всё оформила как поставку сельхозтехники. Гениальная женщина.'],
      [0, 'Опасная женщина.'],
    ],
  },
  gazebo_talk: {
    lines: [
      [0, 'Ты заметил, сколько охраны сегодня? Вдвое больше обычного.'],
      [1, 'Кесслер нервничает. Говорят, кто-то слил его маршруты.'],
    ],
  },
  cooks_break: {
    lines: [[0, 'Шеф опять орёт. Пять минут, и назад к плите.']],
    solo: true,
  },
  waiters_break: {
    lines: [
      [0, 'Мадам Вейл снова отправила мартини обратно. Слишком тёплый.'],
      [1, 'Лука теперь бегает за льдом на кухню перед каждым её заказом.'],
      [0, 'А бар в это время стоит без присмотра. Красота.'],
    ],
    unlock: 'martini',
  },
};
