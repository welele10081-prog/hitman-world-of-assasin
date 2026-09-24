import { Props, makePaintingTexture } from '../world/Props.js';

// "Villa Sereno" on Lake Ardo — the only location for now.
// Coordinates: X east-west, Z north(-) / south(+, the lake). 1 unit = 1 m.

export const STAFF = ['waiter', 'bartender', 'chef', 'sommelier', 'guard', 'security_chief', 'technician'];
export const GUARDS = ['guard', 'security_chief'];

export function buildVilla(level) {
  const b = level.builder;
  const col = level.collision;
  level.buildEnvironment({ sunElevation: 7, sunAzimuth: 320 });

  // ---------------------------------------------------------------- ground
  b.floor(-22, -44, 10, -14, 'gravel', 0.01); // front courtyard
  b.floor(10, -44, 50, -14, 'concrete', 0.012); // staff yard
  b.floor(-1, -44, 3, -14, 'pavers', 0.02); // entrance path
  b.floor(-20, 6, 22, 16, 'pavers', 0.02); // terrace
  b.floor(-1, 16, 3, 28, 'pavers', 0.02); // path to the pier
  b.floor(-28, 22, 48, 24, 'pavers', 0.02); // garden promenade
  b.floor(-26, -9, -22, 22, 'gravel', 0.015); // west garden path
  b.floor(-30, -9, -22, -7, 'gravel', 0.016); // to the cellar door
  b.floor(24, -14, 26, 22, 'gravel', 0.015); // east garden path
  b.floor(-22, -21.5, -34, -19.5, 'gravel', 0.015);
  b.floor(-36, -36, -34, -19.5, 'gravel', 0.015); // to the security post
  b.floor(50, -10, 62, 28, 'pavers', 0.02); // public lakeside promenade
  b.floor(-50, 26, 50, 28, 'pavers', 0.021); // shore walk

  // Pier, platform and docks (deck sits at y=0 over the water)
  b.boxMinMax(-0.5, -0.12, 28, 2.5, 0.03, 40, 'deck', { collide: false });
  b.boxMinMax(-3, -0.12, 40, 5, 0.03, 46, 'deck', { collide: false });
  for (let z = 29; z < 46; z += 3) {
    for (const x of z < 40 ? [-0.4, 2.4] : [-2.9, 4.9]) b.cylinder(x, -1.2, z, 0.12, 0.12, 1.5, 'darkWood', { collide: false, segments: 8 });
  }
  b.boxMinMax(-37, -0.12, 27, -33, 0.03, 36, 'deck', { collide: false }); // boathouse dock
  b.boxMinMax(55, -0.12, 28, 59, 0.03, 34, 'deck', { collide: false }); // public jetty
  // Water blockers (the lake is not walkable)
  const W = { h: 2, sight: false, bullets: false, move: true };
  col.addBox(-80, 28, -37, 90, W);
  col.addBox(-37, 36, -33, 90, W);
  col.addBox(-33, 28, -3, 90, W);
  col.addBox(-3, 46, 5, 90, W);
  col.addBox(-3, 28, -0.5, 40, W);
  col.addBox(2.5, 28, 5, 40, W);
  col.addBox(5, 28, 55, 90, W);
  col.addBox(55, 34, 59, 90, W);
  col.addBox(59, 28, 80, 90, W);
  // Shore balustrade
  Props.balustrade(b, -50, 27.8, -40, 27.8);
  Props.balustrade(b, -30, 27.8, -0.6, 27.8);
  Props.balustrade(b, 2.6, 27.8, 50, 27.8);
  Props.boat(b, 7.3, 43, 0);
  Props.boat(b, -39.5, 32, 0);
  Props.rowboat(b, 60.5, 31, 0);
  Props.lampPost(b, -2.6, 45.5, 2.6);
  Props.lampPost(b, 4.6, 45.5, 2.6);

  // --------------------------------------------------------- perimeter walls
  const PW = { h: 2.8, thick: 0.4, mat: 'stucco', trim: 'stoneTrim' };
  b.wall(-50, -44, 50, -44, { ...PW, openings: [{ at: 51, width: 6, kind: 'gap', top: 2.8 }] });
  b.wall(-50, -44, -50, 27.6, PW);
  b.wall(50, -44, 50, 27.6, { ...PW, openings: [{ at: 54, width: 3, kind: 'gap', top: 2.8 }] });
  // gate pillars
  for (const x of [-2.4, 4.4]) {
    b.box(x, 0, -44, 0.9, 3.6, 0.9, 'stoneTrim');
    b.box(x, 3.6, -44, 1.1, 0.3, 1.1, 'stoneTrim', { collide: false });
  }
  for (const z of [8.1, 11.9]) b.box(50, 0, z, 0.8, 3.2, 0.8, 'stoneTrim');
  // Invisible limits outside the estate
  const INV = { h: 4, sight: false, bullets: false };
  col.addBox(-12, -49, 14, -48, INV);
  col.addBox(-12, -49, -11, -44, INV);
  col.addBox(13, -49, 14, -44, INV);
  col.addBox(62, -12, 63, 30, INV);
  col.addBox(50, -12, 63, -11, INV);
  b.floor(-12, -49, 14, -44, 'concrete', 0.012);

  // --------------------------------------------------------------- the villa
  const H = 4.5;
  b.floor(-8, -14, 10, 6, 'marble', 0.03);
  b.floor(-20, -14, -8, -2, 'woodFloor', 0.03);
  b.floor(-20, -2, -14, 6, 'concrete', 0.03);
  b.floor(-14, -2, -8, 6, 'woodFloor', 0.03);
  b.floor(10, -14, 20, -4, 'checker', 0.03);
  b.floor(10, -4, 20, 1, 'tiles', 0.03);
  b.floor(10, 1, 20, 6, 'tiles', 0.03);
  b.ceiling(-20.2, -14.2, 20.2, 6.2, H, 'plaster');
  b.hipRoof(-20.2, -14.2, 20.2, 6.2, H + 0.15, 3.4);
  // facade trim: plinth + cornice
  b.boxMinMax(-20.35, 0, -14.35, 20.35, 0.55, -14.15, 'stoneTrim', { collide: false });
  b.boxMinMax(-20.35, 0, 6.15, 20.35, 0.55, 6.35, 'stoneTrim', { collide: false });
  b.boxMinMax(-20.35, 4.25, -14.4, 20.35, 4.65, 6.4, 'stoneTrim', { collide: false, cast: false });

  const EXT = { h: H, thick: 0.3, mat: 'stucco' };
  const INT = { h: H, thick: 0.2, mat: 'plaster' };
  // North facade (z=-14)
  b.wall(-20, -14, 20, -14, {
    ...EXT,
    openings: [
      { at: 15.5, width: 1.8, kind: 'window' },
      { at: 21, width: 3.2, kind: 'gap', top: 3.3 },
      { at: 26.5, width: 1.8, kind: 'window' },
      { at: 33, width: 1.5, kind: 'window' },
      { at: 37.5, width: 1.2, kind: 'door' },
    ],
  });
  // South facade (z=6) — wide openings onto the terrace
  b.wall(-20, 6, 20, 6, {
    ...EXT,
    openings: [
      { at: 9, width: 1.6, kind: 'window' },
      { at: 16, width: 2.6, kind: 'gap', top: 3.2 },
      { at: 21, width: 2.6, kind: 'gap', top: 3.2 },
      { at: 26, width: 2.6, kind: 'gap', top: 3.2 },
      { at: 35, width: 1.2, kind: 'window', bottom: 1.5 },
    ],
  });
  // West facade (x=-20)
  b.wall(-20, -14, -20, 6, { ...EXT, openings: [{ at: 3, width: 1.8, kind: 'window' }, { at: 9, width: 1.8, kind: 'window' }] });
  // East facade (x=20)
  b.wall(20, -14, 20, 6, {
    ...EXT,
    openings: [
      { at: 3, width: 1.5, kind: 'window' },
      { at: 7, width: 1.5, kind: 'window' },
      { at: 12.5, width: 1.2, kind: 'door' },
    ],
  });
  // Pilasters on the terrace facade
  for (const x of [-19.8, -14, -6.3, -1.4, 3.6, 8.3, 11, 19.8]) b.box(x, 0, 6.3, 0.5, 4.3, 0.35, 'stoneTrim', { sight: true });
  // Interior walls
  b.wall(-8, -14, -8, 6, { ...INT, openings: [{ at: 6, width: 2.6, kind: 'gap', top: 3.3 }, { at: 16.5, width: 1.2, kind: 'door' }] });
  b.wall(-14, -2, -14, 6, INT);
  b.wall(-20, -2, -8, -2, { ...INT, openings: [{ at: 3, width: 1.2, kind: 'door' }] });
  b.wall(10, -14, 10, 6, { ...INT, openings: [{ at: 5, width: 1.2, kind: 'door' }, { at: 17.5, width: 1.2, kind: 'door' }] });
  b.wall(10, -4, 20, -4, { ...INT, openings: [{ at: 5, width: 1.2, kind: 'door' }] });
  b.wall(10, 1, 20, 1, INT);

  level.addDoor({ x: -8, z: 2.5, axis: 'z', width: 1.2, hinge: -1, swing: 1, name: 'Дверь кабинета' });
  level.addDoor({ x: -17, z: -2, axis: 'x', width: 1.2, hinge: -1, swing: -1, locked: 'keycard_vault', mat: 'darkMetal', name: 'Дверь хранилища' });
  level.addDoor({ x: 10, z: -9, axis: 'z', width: 1.2, hinge: 1, swing: 1, name: 'Дверь кухни' });
  level.addDoor({ x: 10, z: 3.5, axis: 'z', width: 1.2, hinge: -1, swing: -1, name: 'Дверь уборной' });
  level.addDoor({ x: 15, z: -4, axis: 'x', width: 1.2, hinge: -1, swing: 1, name: 'Служебная дверь' });
  level.addDoor({ x: 17.5, z: -14, axis: 'x', width: 1.2, hinge: 1, swing: 1, name: 'Служебный вход' });
  level.addDoor({ x: 20, z: -1.5, axis: 'z', width: 1.2, hinge: -1, swing: -1, name: 'Служебный выход' });

  // ---- Grand hall (x -8..10, z -14..6)
  Props.bar(b, 5.5, -10.5, 0, 5);
  Props.piano(b, -5, -10.3, 0);
  Props.rug(b, 1, -4, 9, 6);
  Props.sofa(b, -4.5, 3.9, Math.PI, { w: 2.4, mat: 'fabricCream' });
  Props.sofa(b, -4.5, 0.1, 0, { w: 2.4, mat: 'fabricCream' });
  Props.coffeeTable(b, -4.5, 2, 0);
  Props.armchair(b, 5.5, 4.2, Math.PI, 'leather');
  Props.armchair(b, 7.8, 4.2, Math.PI, 'leather');
  Props.coffeeTable(b, 6.6, 2.4, 0);
  for (const [x, z] of [[-1.5, -6.5], [3, -6], [0.5, -2], [-5, -5], [7, -4]]) {
    Props.roundTable(b, x, z, { r: 0.4, h: 1.05 });
    Props.tableware(b, x, 1.06, z, 2);
  }
  Props.tableware(b, 4.5, 1.11, -10.3, 3);
  for (const [x, z] of [[-7.3, -13.3], [9.3, -13.3], [-7.3, 5.3], [9.3, 5.3], [-7.3, -3.5]]) Props.planter(b, x, z, 0.4);
  level.addLight(-3, 3.9, -6, 0xffc98a, 16, 15);
  level.addLight(5, 3.9, -6, 0xffc98a, 16, 15);
  level.addLight(1, 3.9, 2.5, 0xffc98a, 14, 14);
  for (const [x, z] of [[-3, -6], [5, -6], [1, 2.5]]) {
    b.cylinder(x, 3.3, z, 0.9, 0.5, 0.5, 'brass', { collide: false });
    b.cylinder(x, 3.8, z, 0.03, 0.03, 0.7, 'brass', { collide: false });
    b.cylinder(x, 3.25, z, 0.7, 0.7, 0.08, 'lampGlow', { collide: false });
  }
  Props.painting(b, -7.88, 2.4, -11.5, Math.PI / 2, 1.6, 1.1, makePaintingTexture(11));
  Props.painting(b, 9.88, 2.4, -1.5, -Math.PI / 2, 1.8, 1.2, makePaintingTexture(12));

  // ---- Gallery (x -20..-8, z -14..-2)
  Props.lectern(b, -18.6, -8, Math.PI / 2);
  for (const x of [-15.5, -14.2, -12.9]) {
    for (const z of [-11.6, -10.5, -9.4, -6.6, -5.5, -4.4]) Props.chair(b, x, z, -Math.PI / 2, 'darkWood');
  }
  Props.plinth(b, -10, -12.8, 0);
  Props.plinth(b, -10, -3.2, 1);
  Props.plinth(b, -18.8, -12.8, 2);
  Props.displayCase(b, -18.8, -3.4, Math.PI / 2);
  const paintings = [
    [-17.5, -13.83, 0], [-14, -13.83, 0], [-10.5, -13.83, 0],
    [-11, -2.12, Math.PI], [-8.12, -12, -Math.PI / 2], [-8.12, -4.3, -Math.PI / 2], [-19.83, -8, Math.PI / 2],
  ];
  paintings.forEach(([x, z, f], i) => Props.painting(b, x, 2.3, z, f, 1.9, 1.3, makePaintingTexture(100 + i)));
  level.addLight(-14, 3.9, -8, 0xfff0d8, 16, 14);

  // ---- Vault (x -20..-14, z -2..6)
  Props.safe(b, -19.3, 5.2, Math.PI / 2);
  Props.displayCase(b, -17, 3, 0);
  Props.shelfUnit(b, -19.4, 1.2, Math.PI / 2, 2.2);
  Props.shelfUnit(b, -14.5, 3.8, -Math.PI / 2, 2.2);
  level.addLight(-17, 3.6, 2, 0xd8e8ff, 8, 9);

  // ---- Study (x -14..-8, z -2..6)
  Props.rug(b, -11, 2.5, 4, 5);
  Props.desk(b, -12, 2.5, Math.PI / 2);
  Props.chair(b, -13.1, 2.5, Math.PI / 2, 'leather');
  Props.bookshelf(b, -11, -1.68, 0, 3);
  Props.armchair(b, -9, 0, -Math.PI / 2, 'leather');
  Props.wardrobe(b, -13.55, 5.2, Math.PI / 2);
  Props.painting(b, -13.88, 2.4, 0.3, Math.PI / 2, 1.2, 0.9, makePaintingTexture(7));
  level.addLight(-11, 3.6, 2.5, 0xffc98a, 9, 9);

  // ---- Kitchen (x 10..20, z -14..-4)
  Props.kitchenCounter(b, 13.5, -13.4, 0, 5, { stove: true });
  Props.kitchenCounter(b, 15, -9, 0, 3.6, { sink: true });
  Props.kitchenCounter(b, 19.4, -9.5, -Math.PI / 2, 5);
  Props.fridge(b, 19.3, -5.2, -Math.PI / 2);
  Props.shelfUnit(b, 12, -4.45, Math.PI, 2.4);
  b.box(18.2, 0, -4.65, 1.2, 0.9, 0.7, 'fridge', { sight: false }); // chest freezer
  level.addLight(15, 3.9, -9, 0xeef4ff, 14, 13);

  // ---- Staff room (x 10..20, z -4..1)
  Props.lockers(b, 13, 0.62, Math.PI, 6);
  Props.table(b, 16, -1.6, 0, { w: 1.6, d: 0.9, cloth: false });
  Props.chair(b, 15.4, -0.7, Math.PI);
  Props.chair(b, 16.6, -2.5, 0);
  b.box(19.5, 0, -3.3, 0.8, 1.0, 0.6, 'steel', { sight: false });
  b.box(10.4, 1.2, -2.5, 0.35, 0.6, 0.8, 'white', { collide: false }); // first-aid cabinet
  level.addLight(15, 3.6, -1.5, 0xf0f0ff, 7, 9);

  // ---- Restroom (x 10..20, z 1..6)
  for (const z of [1.95, 3.35, 4.75]) Props.toiletStall(b, 18.9, z, -Math.PI / 2);
  Props.sinkUnit(b, 11.8, 1.36, 0);
  Props.sinkUnit(b, 13.2, 1.36, 0);
  level.addLight(14, 3.4, 3.5, 0xf0f0ff, 6, 9);

  // ---------------------------------------------------------------- terrace
  Props.balustrade(b, -20, 16, -2, 16);
  Props.balustrade(b, 4, 16, 22, 16);
  for (const [x, z] of [[-15, 10.5], [-10, 12.8], [8, 10.2], [13.5, 12.6], [18.5, 9.8]]) {
    Props.table(b, x, z, 0, { w: 1.4, d: 1.4 });
    Props.chair(b, x - 1.05, z, Math.PI / 2);
    Props.chair(b, x + 1.05, z, -Math.PI / 2);
    Props.tableware(b, x, 0.78, z, 3);
  }
  for (const [x, z] of [[-4.5, 10], [5.5, 13.5], [-2, 13.5], [1.5, 9]]) {
    Props.roundTable(b, x, z, { r: 0.38 });
    Props.tableware(b, x, 1.06, z, 2);
  }
  for (const [x, z] of [[-18, 14.5], [-6.5, 8.5], [10.5, 14.8], [20.5, 14.5]]) Props.heater(b, x, z);
  for (const x of [-19, 21]) Props.planter(b, x, 7, 0.5);
  level.addLight(-9, 3.2, 11, 0xffb870, 10, 14);
  level.addLight(10, 3.2, 11, 0xffb870, 10, 14);

  // ----------------------------------------------------------------- garden
  Props.fountain(b, -12, 19.8, 2.2);
  Props.fountain(b, 14, 19.8, 2.2);
  Props.flowerBed(b, -5.5, 18.6, 4, 1.2);
  Props.flowerBed(b, 7.5, 18.6, 4, 1.2);
  Props.flowerBed(b, -18.5, 25.3, 5, 1.2);
  Props.flowerBed(b, 20.5, 25.3, 5, 1.2);
  Props.hedge(b, -28, 21, -16, 21, 1.1);
  Props.hedge(b, 18, 21, 22, 21, 1.1);
  Props.hedge(b, -28, 25, -22, 25, 1.1);
  Props.hedge(b, 28, 25, 46, 25, 1.1);
  Props.hedge(b, -30, 16.5, -30, 20.5, 2.2); // screens the boathouse
  Props.hedge(b, -47, 0, -30, 0, 2.2);
  Props.hedge(b, -47, 5, -34, 5, 1.1);
  Props.gazebo(b, 34, 18.5, 3);
  Props.bench(b, 34, 18.5, 0);
  for (const x of [-8, 6, 20, 40]) Props.bench(b, x, 25.1, Math.PI);
  for (const x of [-22, -6, 10, 26, 42]) Props.lampPost(b, x, 21.7);
  for (const [x, z, s] of [[-40, 10, 1.1], [-34, 14, 0.9], [-44, -4, 1], [30, 10, 1.1], [44, 12, 1.0], [40, 22, 0.9], [-18, 17.6, 0.7], [20, 17.6, 0.7], [28, -12, 0.9], [-26, 12, 0.8], [46, 3, 0.9]]) Props.tree(b, x, z, s);
  for (let x = -46; x <= 46; x += 4) {
    if (Math.abs(x - 1) < 6) continue;
    Props.cypress(b, x, -42.7, 6 + (Math.abs(x) % 3));
  }
  for (let z = -40; z <= 24; z += 4.5) {
    Props.cypress(b, -48.7, z, 6.5);
    if (Math.abs(z - 10) > 3) Props.cypress(b, 48.7, z, 6.5);
  }
  for (const [x, z] of [[-26, 3], [-26, 8], [-35, 2.5], [46, -8], [36, 9], [27, 3]]) Props.bush(b, x, z, 0.9);
  // Public side (outside the east wall)
  for (let z = -8; z <= 24; z += 6) Props.lampPost(b, 57, z, 3);
  for (const z of [-4, 6, 18]) Props.bench(b, 60.8, z, -Math.PI / 2);
  for (const z of [0, 12, 22]) Props.tree(b, 61, z + 3, 0.9);

  // ------------------------------------------------------------- boathouse
  b.floor(-40, 18, -30, 27, 'deck', 0.03);
  const BH = { h: 3.6, thick: 0.25, mat: 'darkWood' };
  b.wall(-40, 18, -30, 18, BH);
  b.wall(-40, 27, -30, 27, { ...BH, openings: [{ at: 5, width: 4, kind: 'gap', top: 3.0 }] });
  b.wall(-40, 18, -40, 27, { ...BH, openings: [{ at: 4, width: 1.6, kind: 'window' }] });
  b.wall(-30, 18, -30, 27, { ...BH, openings: [{ at: 4.5, width: 1.2, kind: 'door' }] });
  b.ceiling(-40.1, 17.9, -29.9, 27.1, 3.6, 'darkWood');
  b.hipRoof(-40.1, 17.9, -29.9, 27.1, 3.7, 2.2);
  level.addDoor({ x: -30, z: 22.5, axis: 'z', width: 1.2, hinge: -1, swing: 1, name: 'Дверь эллинга' });
  Props.shelfUnit(b, -35, 18.45, 0, 3);
  Props.crate(b, -38.9, 19.2, 1.1, 1);
  Props.crate(b, -31, 19, 0.8, 2);
  Props.table(b, -35.5, 23, 0, { w: 1.8, d: 0.9, cloth: false });
  Props.chair(b, -35.5, 24, Math.PI);
  b.box(-39.5, 0, 24.5, 0.6, 0.9, 2.0, 'darkWood', { sight: false }); // workbench
  level.addLight(-35, 3.2, 22.5, 0xffd8a0, 8, 10);

  // ---------------------------------------------------- wine tasting cellar
  b.floor(-44, -14, -30, -2, 'pavers', 0.03);
  const CL = { h: 4, thick: 0.4, mat: 'stoneWall' };
  b.wall(-44, -14, -30, -14, { ...CL, openings: [{ at: 4, width: 1.2, kind: 'door' }] });
  b.wall(-44, -2, -30, -2, { ...CL, openings: [{ at: 7, width: 1.4, kind: 'window' }] });
  b.wall(-44, -14, -44, -2, CL);
  b.wall(-30, -14, -30, -2, { ...CL, openings: [{ at: 6, width: 1.4, kind: 'door' }] });
  b.ceiling(-44.2, -14.2, -29.8, -1.8, 4, 'darkWood');
  b.hipRoof(-44.2, -14.2, -29.8, -1.8, 4.1, 2.6);
  level.addDoor({ x: -30, z: -8, axis: 'z', width: 1.4, hinge: -1, swing: -1, name: 'Дверь погреба' });
  level.addDoor({ x: -40, z: -14, axis: 'x', width: 1.2, hinge: 1, swing: -1, locked: 'key_cellar', name: 'Задняя дверь погреба' });
  Props.wineRack(b, -43.55, -11, Math.PI / 2, 4);
  Props.wineRack(b, -43.55, -5, Math.PI / 2, 4);
  Props.wineRack(b, -35.5, -13.55, 0, 4);
  for (const x of [-42.3, -41.1, -39.9]) Props.barrel(b, x, -2.8, 0);
  for (const x of [-33.5, -32.3]) Props.barrel(b, x, -2.8, 0);
  Props.table(b, -36, -8, 0, { w: 2.6, d: 1.1, cloth: true });
  Props.tableware(b, -35.5, 0.78, -8, 4);
  b.cylinder(-36.9, 0.78, -8, 0.09, 0.07, 0.28, 'glass', { collide: false }); // Kessler's decanter
  b.cylinder(-36.9, 0.8, -8, 0.08, 0.06, 0.12, 'wine', { collide: false });
  level.addLight(-37, 3.4, -8, 0xffb070, 12, 12);

  // ---------------------------------------------------------- security post
  b.floor(-46, -40, -34, -30, 'concrete', 0.03);
  const SP = { h: 3.2, thick: 0.3, mat: 'concrete' };
  b.wall(-46, -40, -34, -40, SP);
  b.wall(-46, -30, -34, -30, { ...SP, openings: [{ at: 4, width: 1.6, kind: 'window' }, { at: 9, width: 1.6, kind: 'window' }] });
  b.wall(-46, -40, -46, -30, SP);
  b.wall(-34, -40, -34, -30, { ...SP, openings: [{ at: 5, width: 1.2, kind: 'door' }] });
  b.flatRoof(-46, -40, -34, -30, 3.2);
  level.addDoor({ x: -34, z: -35, axis: 'z', width: 1.2, hinge: 1, swing: 1, mat: 'darkMetal', name: 'Дверь поста охраны' });
  Props.desk(b, -44.9, -35.5, Math.PI / 2);
  Props.chair(b, -45.4, -34.3, Math.PI / 2);
  b.box(-45.7, 0.85, -35.5, 0.12, 0.9, 2.4, 'screenGlow', { collide: false });
  Props.lockers(b, -40, -39.6, 0, 6);
  Props.table(b, -39, -33, 0, { w: 1.6, d: 0.9, cloth: false });
  Props.chair(b, -39, -32.1, Math.PI);
  Props.chair(b, -40.2, -33, Math.PI / 2);
  b.box(-36, 0, -39.6, 1.6, 1.9, 0.4, 'darkMetal', { sight: true }); // weapon cabinet
  level.addLight(-40, 2.9, -35, 0xe8f0ff, 8, 11);

  // ------------------------------------------------------- front courtyard
  Props.fountain(b, 1, -28, 3);
  for (const [x, z, m] of [[-16, -20, 'carBlack'], [-12.5, -20, 'carSilver'], [-9, -20, 'carRed'], [-16, -36, 'carSilver'], [-12.5, -36, 'carBlack'], [6.5, -36, 'carBlack']]) Props.car(b, x, z, 0, m);
  Props.hedge(b, -22, -44, -22, -21.6, 2.2);
  Props.hedge(b, -22, -18.4, -22, -14.2, 2.2);
  for (const [x, z] of [[-6, -17], [8, -17], [-6, -40], [8, -40]]) Props.planter(b, x, z, 0.6);
  for (const [x, z] of [[-4, -24], [6, -24], [-4, -32], [6, -32]]) Props.lampPost(b, x, z, 3.4);
  for (const [x, z] of [[-19, -30, 1], [-28, -26, 1.1], [-40, -22, 1], [-30, -42, 0.9]]) Props.tree(b, x, z, 1);

  // ------------------------------------------------------------ staff yard
  const FW = { h: 2.6, thick: 0.3, mat: 'stucco', trim: 'stoneTrim' };
  b.wall(10, -44, 10, -14, { ...FW, openings: [{ at: 14, width: 3, kind: 'gap', top: 2.6 }] });
  b.wall(20, -14, 50, -14, { ...FW, openings: [{ at: 14, width: 3.4, kind: 'gap', top: 2.6 }] });
  Props.van(b, 40, -28, 0);
  Props.dumpster(b, 47.6, -18.5, -Math.PI / 2);
  Props.dumpster(b, 47.6, -21.2, -Math.PI / 2);
  Props.crate(b, 22.5, -16.5, 0.9, 2);
  Props.crate(b, 23.5, -16.5, 0.9, 1);
  Props.crate(b, 13, -19, 0.8, 1);
  Props.tent(b, 30, -38, 6, 4);
  Props.table(b, 30, -38, 0, { w: 2, d: 0.9, cloth: false });
  Props.chair(b, 29.2, -37.2, Math.PI);
  Props.chair(b, 30.8, -38.8, 0);
  Props.generator(b, 45.5, -40.5, 0);
  Props.shelfUnit(b, 16, -43.4, 0, 3);
  Props.crate(b, 20, -43, 1, 2);
  level.addLight(30, 2.4, -38, 0xfff0d0, 5, 9);

  // ---------------------------------------------- greenhouse and garden shed
  b.floor(28, -8, 40, 2, 'concrete', 0.03);
  const GH = { h: 3, thick: 0.1, mat: 'darkMetal' };
  const glassWall = (x1, z1, x2, z2, openings = []) => {
    b.wall(x1, z1, x2, z2, { ...GH, h: 0.6, openings });
    const horizontal = z1 === z2;
    const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const gaps = openings.map((o) => [o.at - o.width / 2, o.at + o.width / 2]);
    let cursor = 0;
    for (const [a, bb] of [...gaps, [len, len]]) {
      if (a - cursor > 0.05) {
        const mid = (cursor + a) / 2;
        const px = horizontal ? Math.min(x1, x2) + mid : cx;
        const pz = horizontal ? cz : Math.min(z1, z2) + mid;
        const w = horizontal ? a - cursor : 0.05;
        const d = horizontal ? 0.05 : a - cursor;
        b.box(px, 0.6, pz, w, 2.4, d, 'greenhouseGlass', { sight: false, move: true, cast: false });
        col.colliders[col.colliders.length - 1].bullets = false;
      }
      cursor = bb;
    }
    for (let i = 0; i <= len; i += 1.5) {
      const px = horizontal ? Math.min(x1, x2) + i : cx;
      const pz = horizontal ? cz : Math.min(z1, z2) + i;
      b.box(px, 0.6, pz, 0.06, 2.4, 0.06, 'darkMetal', { collide: false });
    }
  };
  glassWall(28, -8, 40, -8);
  glassWall(28, 2, 40, 2, [{ at: 6, width: 1.4, kind: 'gap' }]);
  glassWall(28, -8, 28, 2);
  glassWall(40, -8, 40, 2);
  b.boxMinMax(28, 3.0, -8, 40, 3.05, 2, 'greenhouseGlass', { collide: false, cast: false });
  Props.potPlantTable(b, 31, -5.5, 0, 4);
  Props.potPlantTable(b, 37, -5.5, 0, 4);
  Props.potPlantTable(b, 31, -1.5, 0, 4);
  Props.potPlantTable(b, 37, -1.5, 0, 4);
  b.box(38.8, 0, -7.2, 1.4, 0.8, 0.8, 'crateWood', { sight: false }); // compost bin

  b.floor(42, -8, 48, -2, 'deck', 0.03);
  const SH = { h: 3, thick: 0.2, mat: 'darkWood' };
  b.wall(42, -8, 48, -8, SH);
  b.wall(42, -2, 48, -2, { ...SH, openings: [{ at: 3, width: 1.2, kind: 'window' }] });
  b.wall(42, -8, 42, -2, { ...SH, openings: [{ at: 3, width: 1.2, kind: 'door' }] });
  b.wall(48, -8, 48, -2, SH);
  b.hipRoof(41.9, -8.1, 48.1, -1.9, 3.05, 1.6);
  level.addDoor({ x: 42, z: -5, axis: 'z', width: 1.2, hinge: -1, swing: 1, name: 'Дверь сарая' });
  Props.shelfUnit(b, 45, -7.55, 0, 3);
  b.box(47.5, 0, -4.2, 0.7, 0.9, 2.2, 'darkWood', { sight: false });
  level.addLight(45, 2.6, -5, 0xffd8a0, 5, 7);

  // ------------------------------------------------------------------ zones
  level.addZone('grounds', 'Территория виллы', [[-50, -44, 50, 28]]);
  level.addZone('outside', 'Набережная', [[50, -12, 63, 40], [-12, -49, 14, -44]]);
  level.addZone('pier', 'Пирс', [[-3, 28, 5, 46]]);
  level.addZone('terrace', 'Терраса', [[-20, 6, 22, 16]]);
  level.addZone('courtyard', 'Парадный двор', [[-22, -44, 10, -14]]);
  level.addZone('hall', 'Главный зал', [[-8, -14, 10, 6]]);
  level.addZone('gallery', 'Галерея', [[-20, -14, -8, -2]]);
  level.addZone('restroom', 'Уборная', [[10, 1, 20, 6]]);
  level.addZone('bar', 'За барной стойкой', [[2.6, -12.4, 8.4, -10.85]], { allowed: ['bartender', 'waiter', 'security_chief'] });
  level.addZone('kitchen', 'Кухня', [[10, -14, 20, -4]], { allowed: STAFF });
  level.addZone('staffroom', 'Служебная комната', [[10, -4, 20, 1]], { allowed: STAFF });
  level.addZone('staffyard', 'Служебный двор', [[10, -44, 50, -14]], { allowed: [...STAFF, 'gardener'] });
  level.addZone('westservice', 'Служебная территория', [[-50, -44, -22, -14]], { allowed: [...GUARDS, 'technician', 'gardener'] });
  level.addZone('security', 'Пост охраны', [[-46, -40, -34, -30]], { allowed: GUARDS, hostile: true });
  level.addZone('study', 'Кабинет Кесслера', [[-14, -2, -8, 6]], { allowed: GUARDS });
  level.addZone('vault', 'Хранилище', [[-20, -2, -14, 6]], { allowed: ['security_chief', 'appraiser'], hostile: true });
  level.addZone('cellar', 'Винный погреб', [[-44, -14, -30, -2]], { allowed: ['sommelier', 'chef', 'bartender', ...GUARDS] });
  level.addZone('boathouse', 'Эллинг', [[-40, 18, -30, 27], [-37, 27, -33, 36]], { allowed: [...GUARDS, 'technician', 'gardener'] });
  level.addZone('greenhouse', 'Оранжерея', [[28, -8, 40, 2]], { allowed: ['gardener', 'technician', ...GUARDS] });
  level.addZone('shed', 'Сарай садовника', [[42, -8, 48, -2]], { allowed: ['gardener', 'technician', ...GUARDS] });

  // -------------------------------------------------------------- containers
  level.addContainer({ x: 13, z: 0.62, yaw: Math.PI, kind: 'locker', hidePlayer: true });
  level.addContainer({ x: 18.2, z: -4.65, yaw: Math.PI, kind: 'freezer', name: 'Морозильный ларь' });
  level.addContainer({ x: 47.6, z: -18.5, yaw: -Math.PI / 2, kind: 'dumpster', capacity: 2 });
  level.addContainer({ x: 47.6, z: -21.2, yaw: -Math.PI / 2, kind: 'dumpster', capacity: 2 });
  level.addContainer({ x: -13.55, z: 5.2, yaw: Math.PI / 2, kind: 'closet', hidePlayer: true });
  level.addContainer({ x: -38.9, z: 19.2, yaw: Math.PI / 2, kind: 'crate' });
  level.addContainer({ x: -40, z: -39.6, yaw: 0, kind: 'locker', hidePlayer: true });
  level.addContainer({ x: 38.8, z: -7.2, yaw: Math.PI, kind: 'crate', name: 'Компостный ящик' });
  level.addContainer({ x: 13, z: -19, yaw: Math.PI / 2, kind: 'crate' });
  level.addContainer({ x: -31, z: 19, yaw: Math.PI / 2, kind: 'crate' });
  b.box(-32, 0, -12.8, 1.4, 0.8, 0.8, 'darkWood', { sight: false });
  level.addContainer({ x: -32, z: -12.8, yaw: Math.PI, kind: 'chest', name: 'Ящик для бутылок' });
  b.box(37.5, 0, 15.2, 1.4, 0.7, 0.7, 'darkWood', { sight: false });
  level.addContainer({ x: 37.5, z: 15.2, yaw: 0, kind: 'chest', name: 'Садовый сундук' });

  // ------------------------------------------------------------------- exits
  level.addExit('boat', 'Уплыть на катере', 5.2, 43.2, 1.4);
  level.addExit('van', 'Уехать на фургоне кейтеринга', 41.7, -26.5, 1.3);
  level.addExit('gate', 'Уйти через главные ворота', 1, -46.5, 2.5);
  level.addExit('taxi', 'Уплыть на водном такси', 57, 33, 1.4);

  definePoints(level);
}

function definePoints(level) {
  const P = (n, x, z, yaw = 0) => level.addPoint(n, x, z, yaw);
  const N = Math.PI; // facing north (-Z)
  const E = Math.PI / 2; // +X
  const Wd = -Math.PI / 2; // -X
  const S = 0; // +Z

  P('start', 55.5, 11, Wd);
  // Hall
  P('bar_customer1', 4, -9.5, N);
  P('bar_customer2', 5.8, -9.5, N);
  P('bar_customer3', 7.4, -9.6, N);
  P('bartender', 5.5, -11.3, S);
  P('bartender2', 3.5, -11.3, S);
  P('bar_drink_spot', 4.0, -10.3, 0);
  P('piano_seat', -5, -8.55, N);
  P('hall_ct1', -1.5, -5.6, N);
  P('hall_ct1b', -0.8, -7.3, -2.4);
  P('hall_ct2', 3, -5.1, N);
  P('hall_ct2b', 3.8, -6.8, -2.2);
  P('hall_ct3', 0.5, -1.1, N);
  P('hall_ct3b', -0.3, -2.8, 2.2);
  P('hall_ct4', -5, -4.1, N);
  P('hall_ct5', 7, -3.1, N);
  P('hall_ct5b', 7.8, -4.8, -2.4);
  P('sofa1', -4.5, 3.4, N);
  P('sofa2', -4.5, 0.6, S);
  P('sofa3', -3.6, 0.6, S);
  P('arm1', 5.5, 3.7, N);
  P('arm2', 7.8, 3.7, N);
  P('hall_center', 1, -3, S);
  P('hall_entrance', 1, -12.8, S);
  P('hall_south', 1, 4.5, S);
  P('hall_kitchen_door', 9, -9, E);
  P('hall_study_door', -7, 2.5, Wd);
  P('hall_restroom_door', 9, 3.5, E);
  P('hall_guard1', -7.2, -0.2, E);
  P('hall_guard2', 9.2, -1, Wd);
  // Gallery
  P('lectern', -18.1, -8, E);
  P('gallery_front', -17, -8, E);
  P('gallery_chief', -16.6, -12.6, S);
  P('gallery_guard', -9, -8, Wd);
  P('gallery_view1', -10.5, -12.4, N);
  P('gallery_view2', -14, -12.4, N);
  P('gallery_view3', -11, -3.4, S);
  P('gallery_view4', -9, -4.3, E);
  P('gallery_seat1', -14.2, -10.5, Wd);
  P('gallery_seat2', -14.2, -5.5, Wd);
  P('gallery_seat3', -12.9, -9.4, Wd);
  P('gallery_seat4', -15.5, -4.4, Wd);
  P('vault_door_out', -17, -3, S);
  P('vault_door_guard', -15.6, -3, Wd);
  P('vault_inside', -17, 1.5, S);
  P('vault_meet', -16.2, 3.6, Wd);
  P('vault_case', -17, 2.2, S);
  // Study
  P('study_desk', -12.9, 2.5, E);
  P('study_window', -11, 5.2, S);
  P('study_center', -10.5, 1.5, Wd);
  P('study_door_in', -9, 2.5, Wd);
  P('study_guard_out', -6.8, 3.5, Wd);
  // Kitchen
  P('kitchen_stove', 12.5, -12.6, N);
  P('kitchen_stove2', 14.5, -12.6, N);
  P('kitchen_island', 15, -8.1, N);
  P('kitchen_island2', 14, -9.9, S);
  P('kitchen_counter_e', 18.6, -10.5, E);
  P('kitchen_pass', 11, -9, E);
  P('kitchen_fridge', 18.5, -5.2, E);
  P('kitchen_door_s', 15, -5, N);
  P('kitchen_service', 17.5, -13, N);
  P('kitchen_tray', 11.8, -8, Wd);
  // Staff room / restroom
  P('staff_table', 16, -0.7, N);
  P('staff_table2', 16.6, -2.5, S);
  P('staff_lockers', 13, -0.2, S);
  P('staff_exit', 19, -1.5, E);
  P('restroom_sink', 12.5, 2.1, N);
  P('restroom_stall', 18.2, 3.35, E);
  P('restroom_stall2', 18.2, 1.95, E);
  // Terrace
  P('terrace_t1a', -16.05, 10.5, E);
  P('terrace_t1b', -13.95, 10.5, Wd);
  P('terrace_t2a', -11.05, 12.8, E);
  P('terrace_t2b', -8.95, 12.8, Wd);
  P('terrace_t3a', 6.95, 10.2, E);
  P('terrace_t3b', 9.05, 10.2, Wd);
  P('terrace_t4a', 12.45, 12.6, E);
  P('terrace_t4b', 14.55, 12.6, Wd);
  P('terrace_t5a', 17.45, 9.8, E);
  P('terrace_ct1', -4.5, 10.9, N);
  P('terrace_ct1b', -3.6, 9.5, -2);
  P('terrace_ct2', 5.5, 14.4, N);
  P('terrace_ct2b', 6.4, 13, -2.2);
  P('terrace_ct3', -2, 12.6, S);
  P('terrace_ct3b', -2.9, 14.2, 2.4);
  P('terrace_ct4', 1.5, 9.9, N);
  P('terrace_view1', -7, 15.2, S);
  P('terrace_view2', 8, 15.2, S);
  P('terrace_view3', 18, 15.2, S);
  P('terrace_center', 1, 11, S);
  P('terrace_speech', 1, 7.4, S);
  P('terrace_guard1', -19, 13, E);
  P('terrace_guard2', 21.3, 8, Wd);
  P('terrace_waiter', -1, 8, S);
  // Garden
  P('garden_fountain_w', -12, 22.6, N);
  P('garden_fountain_w2', -14.5, 21.8, E);
  P('garden_fountain_e', 14, 22.6, N);
  P('garden_fountain_e2', 16.5, 21.8, Wd);
  P('garden_center', 1, 20, S);
  P('garden_bench1', -8, 24.6, N);
  P('garden_bench2', 6, 24.6, N);
  P('garden_bench3', 20, 24.6, N);
  P('garden_west', -24, 22.5, E);
  P('garden_east', 26, 23, Wd);
  P('garden_gate_in', 47, 10, Wd);
  P('garden_gate_guard', 48.3, 12.4, Wd);
  P('garden_gate_guard2', 48.3, 7.6, Wd);
  P('gazebo', 34, 17.3, S);
  P('gazebo2', 32.5, 19.4, E);
  P('gazebo3', 35.5, 19.6, Wd);
  P('gardener_bed1', -18.5, 24.3, S);
  P('gardener_bed2', 20.5, 24.3, S);
  P('gardener_bed3', -5.5, 17.6, S);
  P('gardener_bed4', 7.5, 17.6, S);
  P('shore_view1', -10, 27, S);
  P('shore_view2', 14, 27, S);
  P('shore_view3', 30, 27, S);
  // Pier
  P('pier_start', 1, 27.5, S);
  P('pier_mid', 1, 34, S);
  P('pier_end', 1, 45.2, S);
  P('pier_end_w', -2.2, 44.8, S);
  P('pier_guard', 3.4, 29.5, N);
  P('pier_boat', 4.6, 43, E);
  // Boathouse
  P('boathouse_in', -35, 21, S);
  P('boathouse_table', -35.5, 23.9, N);
  P('boathouse_dock', -35, 30, S);
  P('boathouse_dock2', -35, 34.5, S);
  P('boathouse_door_out', -28.6, 22.5, E);
  P('boathouse_bench', -39, 24.5, E);
  // Cellar
  P('cellar_somm', -36.2, -9.3, S);
  P('cellar_kessler', -36.4, -6.8, N);
  P('cellar_guest', -35.2, -6.8, N);
  P('cellar_racks', -42.5, -8, Wd);
  P('cellar_barrels', -41, -4, S);
  P('cellar_door_out', -28.5, -8, E);
  P('cellar_door_in', -31.2, -8, Wd);
  P('cellar_guard', -28.8, -6.2, E);
  P('cellar_back', -40, -15.2, N);
  // Security post
  P('security_desk', -44.4, -34.3, E);
  P('security_table', -39, -32.1, S);
  P('security_table2', -40.2, -33, E);
  P('security_door_out', -32.8, -35, E);
  P('security_lockers', -40, -38.7, N);
  // Courtyard
  P('gate_guard1', -1.5, -42.4, S);
  P('gate_guard2', 3.5, -42.4, S);
  P('courtyard_fountain1', -2.6, -28, E);
  P('courtyard_fountain2', 4.6, -28, Wd);
  P('courtyard_fountain3', 1, -24.4, N);
  P('courtyard_cars', -12.5, -23, S);
  P('courtyard_entrance', 1, -16, N);
  P('courtyard_guard1', -3, -15.3, S);
  P('courtyard_guard2', 5, -15.3, S);
  P('courtyard_west', -20, -20, Wd);
  P('west_service_gap', -23.5, -20.5, Wd);
  P('staff_gate', 11.5, -30, E);
  P('staff_gate_guard', 12.3, -32, E);
  P('west_path', -24.8, -2, S);
  P('west_path2', -24.8, 14, S);
  // Staff yard
  P('van_back', 40, -31.4, S);
  P('van_driver', 41.7, -26.5, E);
  P('tent1', 29.2, -37.2, S);
  P('tent2', 30.8, -38.8, N);
  P('dumpsters', 46.2, -19.8, E);
  P('crates_yard', 22.5, -18, N);
  P('generator', 45.5, -39.1, N);
  P('yard_gate_n', 34, -15.2, N);
  P('yard_center', 30, -28, S);
  // Greenhouse / shed
  P('greenhouse_in', 34, 0.6, N);
  P('greenhouse_t1', 31, -4.6, N);
  P('greenhouse_t2', 37, -2.4, S);
  P('shed_in', 44.5, -5, E);
  P('shed_door_out', 40.8, -5, Wd);
  P('east_path', 25, -6, S);
  // Promenade (public)
  P('prom1', 54, 0, N);
  P('prom2', 54, 20, S);
  P('jetty', 57, 31, S);
}
