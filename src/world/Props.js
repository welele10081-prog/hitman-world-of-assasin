import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

// Procedural props. Positions are world coords; `rot` is a multiple of
// PI/2 so colliders stay axis-aligned.

const rng = mulberry32(1234);

// Transform helper for a prop placed at (x,z) with quarter-turn rotation.
class P {
  constructor(b, x, z, rot = 0) {
    this.b = b;
    this.x = x;
    this.z = z;
    this.rot = rot;
    this.q = ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4;
  }
  tp(lx, lz) {
    const c = Math.round(Math.cos(this.rot) * 1e6) / 1e6;
    const s = Math.round(Math.sin(this.rot) * 1e6) / 1e6;
    return [this.x + lx * c + lz * s, this.z - lx * s + lz * c];
  }
  dims(w, d) {
    return this.q % 2 === 0 ? [w, d] : [d, w];
  }
  box(lx, y, lz, w, h, d, mat, opts = {}) {
    const [x, z] = this.tp(lx, lz);
    const [ww, dd] = this.dims(w, d);
    return this.b.box(x, y, z, ww, h, dd, mat, opts);
  }
  cyl(lx, y, lz, rt, rb, h, mat, opts = {}) {
    const [x, z] = this.tp(lx, lz);
    return this.b.cylinder(x, y, z, rt, rb, h, mat, opts);
  }
  mesh(geo, mat, lx, y, lz, opts = {}) {
    const [x, z] = this.tp(lx, lz);
    return this.b.mesh(geo, mat, x, y, z, { ...opts, rotY: (opts.rotY ?? 0) + this.rot });
  }
}

const NC = { collide: false };

export const Props = {
  table(b, x, z, rot = 0, { w = 1.6, d = 0.9, cloth = true } = {}) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.72, 0, w, 0.05, d, cloth ? 'tablecloth' : 'darkWood', { collide: false });
    if (cloth) p.box(0, 0.45, 0, w + 0.04, 0.28, d + 0.04, 'tablecloth', { collide: false });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) p.box(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), 0.06, 0.72, 0.06, 'darkWood', NC);
    const [ww, dd] = p.dims(w, d);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.78, sight: false });
  },

  roundTable(b, x, z, { r = 0.45, h = 1.05, cloth = true } = {}) {
    b.cylinder(x, h - 0.04, z, r, r, 0.04, cloth ? 'tablecloth' : 'darkWood', { collide: false });
    if (cloth) b.cylinder(x, 0.02, z, r + 0.02, r + 0.12, h - 0.06, 'tablecloth', { collide: false, open: true });
    else b.cylinder(x, 0, z, 0.04, 0.04, h, 'darkMetal', { collide: false });
    b.cylinder(x, 0, z, 0.22, 0.25, 0.03, 'darkMetal', { collide: false });
    b.collision.addCircle(x, z, r, { h, sight: false });
  },

  // Glasses / bottles on a surface (visual only)
  tableware(b, x, y, z, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.1 + rng() * 0.2;
      const gx = x + Math.cos(a) * r;
      const gz = z + Math.sin(a) * r;
      b.cylinder(gx, y, gz, 0.03, 0.02, 0.12, 'glass', { collide: false, segments: 8, cast: false });
      if (rng() > 0.4) b.cylinder(gx, y + 0.01, gz, 0.025, 0.018, 0.05, 'wine', { collide: false, segments: 8, cast: false });
    }
  },

  chair(b, x, z, rot = 0, mat = 'darkWood') {
    const p = new P(b, x, z, rot);
    p.box(0, 0.45, 0, 0.45, 0.06, 0.45, mat, NC);
    p.box(0, 0.51, -0.2, 0.45, 0.5, 0.05, mat, NC);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) p.box(sx * 0.19, 0, sz * 0.19, 0.04, 0.45, 0.04, mat, NC);
    p.box(0, 0.47, 0.01, 0.4, 0.05, 0.4, 'fabricCream', NC);
    b.collision.addBox(x - 0.25, z - 0.25, x + 0.25, z + 0.25, { h: 0.9, sight: false });
  },

  sofa(b, x, z, rot = 0, { w = 2.2, mat = 'fabricGreen' } = {}) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.1, 0, w, 0.35, 0.9, mat, NC);
    p.box(0, 0.45, -0.35, w, 0.45, 0.2, mat, NC);
    p.box(w / 2 - 0.1, 0.45, 0, 0.2, 0.25, 0.9, mat, NC);
    p.box(-w / 2 + 0.1, 0.45, 0, 0.2, 0.25, 0.9, mat, NC);
    p.box(0, 0, 0, w - 0.1, 0.1, 0.8, 'darkWood', NC);
    const [ww, dd] = p.dims(w, 0.9);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.9, sight: false });
  },

  armchair(b, x, z, rot = 0, mat = 'leather') {
    Props.sofa(b, x, z, rot, { w: 0.95, mat });
  },

  coffeeTable(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.38, 0, 1.2, 0.05, 0.6, 'marble', NC);
    p.box(0, 0, 0, 1.0, 0.38, 0.45, 'darkWood', NC);
    const [ww, dd] = p.dims(1.2, 0.6);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.45, sight: false });
  },

  // Bar counter with back shelf; `len` along local X, customers on +Z side.
  bar(b, x, z, rot = 0, len = 5) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, len, 1.05, 0.6, 'darkWood', { sight: false });
    p.box(0, 1.05, 0.05, len + 0.1, 0.06, 0.75, 'marble', NC);
    p.box(0, 0, 0.32, len, 0.12, 0.05, 'brass', NC);
    // back shelf
    p.box(0, 0, -1.3, len, 0.9, 0.5, 'darkWood', { sight: false });
    p.box(0, 0.9, -1.45, len, 1.6, 0.2, 'darkWood', NC);
    for (let s = 0; s < 3; s++) {
      p.box(0, 1.1 + s * 0.45, -1.35, len - 0.2, 0.03, 0.3, 'glass', NC);
      for (let i = 0; i < len * 4; i++) {
        const lx = -len / 2 + 0.2 + i * 0.25 + rng() * 0.05;
        if (lx > len / 2 - 0.15) break;
        const col = ['bottleGlass', 'wine', 'brass', 'glass'][Math.floor(rng() * 4)];
        const [bx, bz] = p.tp(lx, -1.35);
        b.cylinder(bx, 1.13 + s * 0.45, bz, 0.035, 0.04, 0.26 + rng() * 0.08, col, { collide: false, segments: 8, cast: false });
      }
    }
    // stools on customer side
    for (let i = -len / 2 + 0.6; i < len / 2 - 0.3; i += 1.1) {
      const [sx, sz] = p.tp(i, 0.75);
      b.cylinder(sx, 0, sz, 0.03, 0.03, 0.72, 'chrome', NC);
      b.cylinder(sx, 0.72, sz, 0.2, 0.18, 0.08, 'leather', NC);
    }
  },

  bookshelf(b, x, z, rot = 0, w = 2) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, w, 2.4, 0.4, 'darkWood', { sight: true });
    for (let s = 0; s < 5; s++) {
      let lx = -w / 2 + 0.08;
      while (lx < w / 2 - 0.1) {
        const bw = 0.04 + rng() * 0.05;
        const bh = 0.28 + rng() * 0.12;
        const col = ['books', 'fabricRed', 'fabricGreen', 'fabricCream', 'leather'][Math.floor(rng() * 5)];
        p.box(lx + bw / 2, 0.08 + s * 0.46, 0.21, bw, bh, 0.05, col, NC);
        lx += bw + 0.005;
      }
    }
  },

  desk(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.74, 0, 1.8, 0.06, 0.85, 'darkWood', NC);
    p.box(-0.7, 0, 0, 0.4, 0.74, 0.8, 'darkWood', NC);
    p.box(0.7, 0, 0, 0.4, 0.74, 0.8, 'darkWood', NC);
    p.box(0.3, 0.8, 0.05, 0.5, 0.02, 0.35, 'paperWhite', NC);
    p.box(-0.5, 0.8, -0.1, 0.04, 0.35, 0.04, 'brass', NC);
    p.box(-0.5, 1.12, -0.1, 0.25, 0.14, 0.25, 'lampGlow', NC);
    p.box(0, 0.8, -0.25, 0.55, 0.35, 0.03, 'screenGlow', NC);
    const [ww, dd] = p.dims(1.8, 0.85);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.8, sight: false });
  },

  piano(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.6, 0, 1.5, 0.35, 1.9, 'black', { collide: false });
    p.box(0, 0, 0.6, 0.1, 0.6, 0.1, 'black', NC);
    p.box(-0.6, 0, -0.7, 0.1, 0.6, 0.1, 'black', NC);
    p.box(0.6, 0, -0.7, 0.1, 0.6, 0.1, 'black', NC);
    p.box(0, 0.95, -0.2, 1.4, 0.03, 1.4, 'black', { collide: false, rotY: 0 });
    p.box(0, 0.75, 1.0, 1.4, 0.08, 0.2, 'white', NC);
    p.box(0, 0.45, 1.5, 0.8, 0.06, 0.35, 'black', NC);
    const [ww, dd] = p.dims(1.6, 2.2);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 1.0, sight: false });
  },

  lectern(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 0.6, 1.1, 0.45, 'darkWood', { sight: false });
    p.box(0, 1.1, 0, 0.7, 0.05, 0.5, 'darkWood', NC);
  },

  plinth(b, x, z, kind = 0) {
    b.box(x, 0, z, 0.6, 1.1, 0.6, 'marble', { sight: false });
    if (kind === 0) {
      b.mesh(new THREE.TorusKnotGeometry(0.16, 0.05, 64, 8), 'brass', x, 1.4, z, { uv: 'keep' });
    } else if (kind === 1) {
      b.mesh(new THREE.IcosahedronGeometry(0.22, 0), 'marble', x, 1.33, z);
    } else {
      b.cylinder(x, 1.1, z, 0.06, 0.12, 0.5, 'gold', { collide: false });
      b.mesh(new THREE.SphereGeometry(0.12, 12, 8), 'gold', x, 1.7, z);
    }
  },

  // Canvas painting on a wall. `face` = direction the painting faces (radians yaw).
  painting(b, x, y, z, face, w, h, texture) {
    const frame = new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06);
    b.mesh(frame, 'gold', x, y, z, { rotY: face, uv: 'world' });
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
    const canvas = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(canvas, mat);
    m.position.set(x + Math.sin(face) * 0.035, y, z + Math.cos(face) * 0.035);
    m.rotation.y = face;
    m.receiveShadow = true;
    b.scene.add(m);
  },

  rug(b, x, z, w, d, mat = 'rug') {
    b.box(x, 0, z, w, 0.015, d, mat, { collide: false, cast: false });
  },

  kitchenCounter(b, x, z, rot = 0, len = 3, { stove = false, sink = false } = {}) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, len, 0.9, 0.7, 'steel', { sight: false });
    p.box(0, 0.9, 0, len, 0.04, 0.72, 'steel', NC);
    if (stove) {
      for (let i = 0; i < 4; i++) p.cyl(-len / 2 + 0.4 + i * 0.45, 0.94, 0, 0.12, 0.12, 0.02, 'darkMetal', NC);
      p.cyl(-len / 2 + 0.4, 0.96, 0, 0.14, 0.13, 0.18, 'steel', NC);
    }
    if (sink) p.box(len / 2 - 0.5, 0.92, 0, 0.6, 0.02, 0.45, 'darkMetal', NC);
    for (let i = 0; i < len; i += 0.9) p.box(-len / 2 + 0.45 + i, 0.3, 0.36, 0.3, 0.02, 0.02, 'chrome', NC);
  },

  fridge(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 0.9, 2.1, 0.75, 'fridge', { sight: true });
    p.box(0.3, 0.8, 0.38, 0.03, 0.6, 0.03, 'chrome', NC);
  },

  shelfUnit(b, x, z, rot = 0, w = 1.8) {
    const p = new P(b, x, z, rot);
    for (let s = 0; s < 4; s++) p.box(0, 0.1 + s * 0.55, 0, w, 0.03, 0.5, 'steel', NC);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box((sx * w) / 2 - sx * 0.02, 0, sz * 0.23, 0.04, 1.9, 0.04, 'steel', NC);
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 4; i++) {
        if (rng() < 0.3) continue;
        const mat = ['crateWood', 'paperWhite', 'steel', 'terracotta'][Math.floor(rng() * 4)];
        p.box(-w / 2 + 0.25 + i * (w / 4), 0.13 + s * 0.55, 0, 0.3, 0.25 + rng() * 0.15, 0.35, mat, NC);
      }
    }
    const [ww, dd] = p.dims(w, 0.5);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 2, sight: false });
  },

  wineRack(b, x, z, rot = 0, len = 4) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, len, 2.3, 0.45, 'darkWood', { sight: true });
    for (let r = 0; r < 7; r++) {
      for (let i = 0; i < len * 5 - 1; i++) {
        const lx = -len / 2 + 0.15 + i * 0.2;
        const [bx, bz] = p.tp(lx, 0.23);
        b.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), 'bottleGlass', bx, 0.2 + r * 0.3, bz, {
          rotX: Math.PI / 2,
          rotY: rot,
          cast: false,
        });
      }
    }
  },

  barrel(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    const [bx, bz] = p.tp(0, 0);
    b.mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 16), 'darkWood', bx, 0.5, bz, { rotZ: Math.PI / 2, rotY: rot, uv: 'keep' });
    b.mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 16), 'darkMetal', bx, 0.5, bz, { rotZ: Math.PI / 2, rotY: rot });
    p.box(0, 0, 0, 0.9, 0.12, 0.7, 'darkWood', NC);
    const [ww, dd] = p.dims(1.0, 0.9);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.95, sight: false });
  },

  crate(b, x, z, s = 0.9, stack = 1) {
    for (let i = 0; i < stack; i++) {
      b.box(x, i * s, z, s, s, s, 'crateWood', { collide: false });
    }
    b.collision.addBox(x - s / 2, z - s / 2, x + s / 2, z + s / 2, { h: s * stack, sight: s * stack > 1.3 });
  },

  toiletStall(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, -0.3, 0.4, 0.42, 0.55, 'white', { sight: false });
    p.box(0, 0.42, -0.6, 0.45, 0.4, 0.2, 'white', NC);
    p.box(0.65, 0.1, 0, 0.04, 1.9, 1.5, 'paintedWood', { sight: true });
    p.box(-0.65, 0.1, 0, 0.04, 1.9, 1.5, 'paintedWood', { sight: true });
  },

  sinkUnit(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 1.0, 0.85, 0.5, 'marble', { sight: false });
    p.box(0, 1.1, -0.24, 0.9, 0.9, 0.03, 'chrome', NC);
  },

  lockers(b, x, z, rot = 0, n = 4) {
    const p = new P(b, x, z, rot);
    const w = n * 0.45;
    p.box(0, 0, 0, w, 1.9, 0.5, 'greenPaint', { sight: true });
    for (let i = 0; i < n; i++) {
      p.box(-w / 2 + 0.225 + i * 0.45, 0.1, 0.255, 0.4, 1.7, 0.01, 'darkMetal', NC);
      p.box(-w / 2 + 0.36 + i * 0.45, 1.0, 0.265, 0.02, 0.15, 0.02, 'chrome', NC);
    }
  },

  bed(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 1.8, 0.45, 2.1, 'darkWood', { sight: false });
    p.box(0, 0.45, 0.05, 1.7, 0.18, 2.0, 'fabricWhite', NC);
    p.box(0, 0, -1.05, 1.9, 1.2, 0.1, 'darkWood', NC);
    p.box(0.4, 0.62, -0.75, 0.6, 0.12, 0.35, 'fabricWhite', NC);
    p.box(-0.4, 0.62, -0.75, 0.6, 0.12, 0.35, 'fabricWhite', NC);
  },

  // Exterior
  tree(b, x, z, s = 1) {
    b.cylinder(x, 0, z, 0.15 * s, 0.25 * s, 3 * s, 'bark', { collide: true, colH: 3, sight: false, segments: 8 });
    const ico = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng();
      const r = i === 0 ? 0 : 0.8 * s;
      const scale = (1.3 + rng() * 0.6) * s;
      b.mesh(ico, 'foliage', x + Math.cos(a) * r, 3.4 * s + rng() * 0.8 * s, z + Math.sin(a) * r, { scale, uv: 'world' });
    }
  },

  cypress(b, x, z, h = 7) {
    b.cylinder(x, 0, z, 0.1, 0.15, 1, 'bark', { collide: true, colH: 3, segments: 6 });
    const g = new THREE.SphereGeometry(1, 10, 10);
    b.mesh(g, 'cypress', x, h * 0.5 + 0.4, z, { scale: [0.75, h * 0.5, 0.75], uv: 'world' });
  },

  bush(b, x, z, s = 0.8) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    b.mesh(g, 'foliage', x, s * 0.6, z, { scale: [s, s * 0.8, s], uv: 'world' });
    b.collision.addCircle(x, z, s * 0.8, { h: s * 1.4, sight: s * 1.4 > 1.3 });
  },

  hedge(b, x1, z1, x2, z2, h = 1.6, t = 0.8) {
    const minX = Math.min(x1, x2) - (x1 === x2 ? t / 2 : 0);
    const maxX = Math.max(x1, x2) + (x1 === x2 ? t / 2 : 0);
    const minZ = Math.min(z1, z2) - (z1 === z2 ? t / 2 : 0);
    const maxZ = Math.max(z1, z2) + (z1 === z2 ? t / 2 : 0);
    b.boxMinMax(minX, 0, minZ, maxX, h, maxZ, 'hedge', { sight: h > 1.3 });
  },

  flowerBed(b, x, z, w, d) {
    b.box(x, 0, z, w, 0.3, d, 'stoneTrim', { sight: false, collide: true });
    b.box(x, 0.3, z, w - 0.2, 0.02, d - 0.2, 'soil', NC);
    const cols = ['flowerRed', 'flowerWhite', 'flowerPurple', 'flowerYellow'];
    const g = new THREE.IcosahedronGeometry(0.12, 0);
    const col = cols[Math.floor(rng() * cols.length)];
    for (let i = 0; i < w * d * 4; i++) {
      const fx = x - w / 2 + 0.2 + rng() * (w - 0.4);
      const fz = z - d / 2 + 0.2 + rng() * (d - 0.4);
      b.mesh(g, rng() > 0.3 ? col : 'foliage', fx, 0.42 + rng() * 0.1, fz, { cast: false });
    }
  },

  fountain(b, x, z, r = 2.5) {
    b.cylinder(x, 0, z, r, r + 0.1, 0.55, 'stoneTrim', { collide: true, colH: 0.6, sight: false, segments: 28 });
    b.cylinder(x, 0.5, z, r - 0.2, r - 0.2, 0.02, 'water', { collide: false, segments: 28 });
    b.cylinder(x, 0.5, z, 0.3, 0.4, 1.0, 'stoneTrim', { collide: false, segments: 12 });
    b.cylinder(x, 1.5, z, 0.9, 0.2, 0.25, 'stoneTrim', { collide: false, segments: 16 });
    b.cylinder(x, 1.75, z, 0.12, 0.15, 0.6, 'stoneTrim', { collide: false, segments: 10 });
  },

  bench(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.42, 0, 1.6, 0.06, 0.45, 'deck', NC);
    p.box(0, 0.5, -0.22, 1.6, 0.4, 0.05, 'deck', NC);
    p.box(-0.7, 0, 0, 0.08, 0.42, 0.45, 'darkMetal', NC);
    p.box(0.7, 0, 0, 0.08, 0.42, 0.45, 'darkMetal', NC);
    const [ww, dd] = p.dims(1.6, 0.5);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.9, sight: false });
  },

  lampPost(b, x, z, h = 3.2) {
    b.cylinder(x, 0, z, 0.05, 0.08, h, 'darkMetal', { collide: true, colH: h, sight: false, segments: 8 });
    b.box(x, h, z, 0.3, 0.35, 0.3, 'lampGlow', NC);
    b.box(x, h + 0.35, z, 0.38, 0.06, 0.38, 'darkMetal', NC);
  },

  heater(b, x, z) {
    b.cylinder(x, 0, z, 0.25, 0.3, 0.1, 'steel', { collide: true, colH: 2.2, sight: false });
    b.cylinder(x, 0.1, z, 0.05, 0.05, 2.0, 'steel', NC);
    b.cylinder(x, 2.1, z, 0.55, 0.1, 0.15, 'steel', NC);
    b.cylinder(x, 1.6, z, 0.12, 0.12, 0.5, 'lampGlow', NC);
  },

  umbrella(b, x, z) {
    b.cylinder(x, 0, z, 0.03, 0.03, 2.4, 'white', NC);
    const cone = new THREE.ConeGeometry(1.6, 0.5, 8, 1, true);
    b.mesh(cone, 'fabricCream', x, 2.5, z, { uv: 'world' });
  },

  balustrade(b, x1, z1, x2, z2) {
    const horizontal = z1 === z2;
    const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const w = horizontal ? len : 0.3;
    const d = horizontal ? 0.3 : len;
    b.box(cx, 0, cz, w, 0.15, d, 'stoneTrim', { collide: false });
    b.box(cx, 0.85, cz, horizontal ? len : 0.34, 0.1, horizontal ? 0.34 : len, 'stoneTrim', { collide: false });
    const n = Math.floor(len / 0.3);
    const bal = new THREE.CylinderGeometry(0.06, 0.09, 0.7, 8);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = horizontal ? Math.min(x1, x2) + t * len : x1;
      const pz = horizontal ? z1 : Math.min(z1, z2) + t * len;
      b.mesh(bal, 'stoneTrim', px, 0.5, pz, { uv: 'world' });
    }
    b.collision.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, { h: 0.95, sight: false });
  },

  pergola(b, x, z, w, d) {
    const posts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    for (const [px, pz] of posts) b.box(x + px, 0, z + pz, 0.25, 2.8, 0.25, 'stoneTrim', { sight: false });
    for (let i = 0; i <= w; i += 0.6) b.box(x - w / 2 + i, 2.8, z, 0.08, 0.15, d + 0.4, 'paintedWood', NC);
    b.box(x, 2.95, z - d / 2, w + 0.4, 0.12, 0.12, 'paintedWood', NC);
    b.box(x, 2.95, z + d / 2, w + 0.4, 0.12, 0.12, 'paintedWood', NC);
  },

  gazebo(b, x, z, r = 3) {
    b.cylinder(x, 0, z, r + 0.3, r + 0.4, 0.3, 'stoneTrim', { collide: false, segments: 8 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      b.cylinder(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, 0.1, 0.12, 2.8, 'paintedWood', { collide: true, colH: 3, sight: false, segments: 8 });
    }
    const roof = new THREE.ConeGeometry(r + 0.6, 1.6, 8);
    b.mesh(roof, 'roof', x, 3.1 + 0.8, z, { rotY: Math.PI / 8, uv: 'world' });
  },

  planter(b, x, z, s = 0.5) {
    b.cylinder(x, 0, z, s, s * 0.75, s * 1.4, 'terracotta', { collide: true, colH: s * 1.4, sight: false, segments: 12 });
    const g = new THREE.IcosahedronGeometry(s * 1.1, 1);
    b.mesh(g, 'foliage', x, s * 1.4 + s * 0.6, z, { uv: 'world' });
  },

  car(b, x, z, rot = 0, mat = 'carBlack') {
    const p = new P(b, x, z, rot);
    p.box(0, 0.3, 0, 1.85, 0.7, 4.6, mat, { collide: false });
    p.box(0, 1.0, -0.2, 1.6, 0.5, 2.3, mat, NC);
    p.box(0, 1.02, -0.2, 1.62, 0.44, 2.1, 'glass', NC);
    for (const [sx, sz] of [[1, 1.45], [-1, 1.45], [1, -1.45], [-1, -1.45]]) {
      const [wx, wz] = p.tp(sx * 0.85, sz);
      b.mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), 'tire', wx, 0.33, wz, { rotZ: Math.PI / 2, rotY: rot });
    }
    p.box(0.6, 0.6, 2.31, 0.3, 0.12, 0.02, 'carLight', NC);
    p.box(-0.6, 0.6, 2.31, 0.3, 0.12, 0.02, 'carLight', NC);
    p.box(0.6, 0.6, -2.31, 0.3, 0.1, 0.02, 'flowerRed', NC);
    p.box(-0.6, 0.6, -2.31, 0.3, 0.1, 0.02, 'flowerRed', NC);
    const [ww, dd] = p.dims(1.9, 4.7);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 1.5, sight: true });
  },

  van(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.35, -0.4, 2.0, 2.1, 4.0, 'vanBody', { collide: false });
    p.box(0, 0.35, 2.0, 2.0, 1.2, 1.0, 'vanBody', NC);
    p.box(0, 1.55, 1.75, 1.9, 0.6, 0.5, 'glass', NC);
    p.box(0, 1.2, -0.4, 2.02, 0.35, 3.0, 'fabricRed', NC);
    for (const [sx, sz] of [[1, 1.6], [-1, 1.6], [1, -1.6], [-1, -1.6]]) {
      const [wx, wz] = p.tp(sx * 0.95, sz);
      b.mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14), 'tire', wx, 0.38, wz, { rotZ: Math.PI / 2, rotY: rot });
    }
    const [ww, dd] = p.dims(2.1, 5.2);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 2.5, sight: true });
  },

  boat(b, x, z, rot = 0, y = 0.0) {
    const p = new P(b, x, z, rot);
    const hull = new THREE.CylinderGeometry(1.1, 0.7, 6, 12, 1, false, 0, Math.PI);
    const [hx, hz] = p.tp(0, 0);
    b.mesh(hull, 'boatHull', hx, y + 0.45, hz, { rotX: Math.PI / 2, rotZ: Math.PI, rotY: rot, uv: 'world' });
    p.box(0, y + 0.4, 0, 2.0, 0.08, 5.4, 'boatWood', NC);
    p.box(0, y + 0.48, 0.6, 1.6, 0.5, 0.4, 'fabricCream', NC);
    p.box(0, y + 0.48, -1.0, 1.6, 0.5, 0.4, 'fabricCream', NC);
    p.box(0, y + 0.8, 1.6, 1.8, 0.5, 0.05, 'glass', NC);
    p.box(0.5, y + 0.48, 1.3, 0.4, 0.5, 0.4, 'boatWood', NC);
  },

  dumpster(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.1, 0, 1.9, 1.2, 1.1, 'dumpster', { sight: false });
    p.box(0, 1.3, -0.05, 1.95, 0.06, 1.15, 'dumpster', NC);
  },

  generator(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 2.4, 1.4, 1.2, 'greenPaint', { sight: true });
    p.box(0.6, 1.4, 0, 0.15, 0.4, 0.15, 'darkMetal', NC);
    p.box(-0.5, 0.4, 0.61, 0.9, 0.6, 0.02, 'darkMetal', NC);
  },

  tent(b, x, z, w = 5, d = 4) {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cylinder(x + (px * w) / 2, 0, z + (pz * d) / 2, 0.05, 0.05, 2.5, 'white', { collide: true, colH: 2.5, sight: false });
    const roof = new THREE.ConeGeometry(Math.hypot(w, d) / 2, 1, 4, 1, true);
    b.mesh(roof, 'fabricWhite', x, 3.0, z, { rotY: Math.PI / 4, scale: [w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41], uv: 'world' });
  },

  potPlantTable(b, x, z, rot = 0, len = 3) {
    const p = new P(b, x, z, rot);
    p.box(0, 0.8, 0, len, 0.05, 0.8, 'deck', NC);
    p.box(-len / 2 + 0.1, 0, 0, 0.06, 0.8, 0.7, 'darkMetal', NC);
    p.box(len / 2 - 0.1, 0, 0, 0.06, 0.8, 0.7, 'darkMetal', NC);
    for (let i = 0; i < len * 3; i++) {
      const [px, pz] = p.tp(-len / 2 + 0.2 + i * 0.33, (rng() - 0.5) * 0.4);
      b.cylinder(px, 0.85, pz, 0.1, 0.08, 0.15, 'terracotta', { collide: false, segments: 8 });
      b.mesh(new THREE.IcosahedronGeometry(0.13, 0), rng() > 0.5 ? 'foliage' : 'flowerRed', px, 1.1, pz, { cast: false });
    }
    const [ww, dd] = p.dims(len, 0.8);
    b.collision.addBox(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { h: 0.9, sight: false });
  },

  wardrobe(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 1.2, 2.1, 0.6, 'cabinet', { sight: true });
    p.box(-0.3, 0.05, 0.305, 0.57, 2.0, 0.01, 'darkWood', NC);
    p.box(0.3, 0.05, 0.305, 0.57, 2.0, 0.01, 'darkWood', NC);
    p.box(-0.05, 1.0, 0.32, 0.02, 0.2, 0.02, 'brass', NC);
    p.box(0.05, 1.0, 0.32, 0.02, 0.2, 0.02, 'brass', NC);
  },

  safe(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 0.8, 1.1, 0.7, 'darkMetal', { sight: false });
    p.cyl(0, 0.6, 0.36, 0.08, 0.08, 0.04, 'chrome', NC);
  },

  displayCase(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    p.box(0, 0, 0, 1.0, 0.9, 0.7, 'darkWood', { sight: false });
    p.box(0, 0.9, 0, 0.95, 0.5, 0.65, 'glass', NC);
  },

  rowboat(b, x, z, rot = 0) {
    const p = new P(b, x, z, rot);
    const hull = new THREE.CylinderGeometry(0.7, 0.4, 3.4, 10, 1, false, 0, Math.PI);
    const [hx, hz] = p.tp(0, 0);
    b.mesh(hull, 'boatWood', hx, 0.35, hz, { rotX: Math.PI / 2, rotZ: Math.PI, rotY: rot, uv: 'world' });
  },
};

// Abstract painting textures (canvas), so the gallery has something to show.
export function makePaintingTexture(seed) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const palettes = [
    ['#1d2b3a', '#c8a050', '#8a2a2a', '#e8dcc0'],
    ['#2a4a3a', '#d8c090', '#4a3020', '#a8c0a0'],
    ['#101820', '#f0e0c0', '#c04030', '#406080'],
    ['#3a2a4a', '#e0a060', '#f0f0e0', '#2a6a7a'],
    ['#5a4030', '#e8d8b0', '#9a6040', '#304050'],
  ];
  const pal = palettes[Math.floor(r() * palettes.length)];
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, 256, 256);
  const kind = Math.floor(r() * 3);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = pal[1 + Math.floor(r() * 3)];
    ctx.globalAlpha = 0.5 + r() * 0.5;
    if (kind === 0) {
      ctx.fillRect(r() * 256, r() * 256, r() * 120, r() * 120);
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, r() * 60, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(r() * 256, r() * 256);
      for (let k = 0; k < 3; k++) ctx.lineTo(r() * 256, r() * 256);
      ctx.fill();
    }
  }
  // landscape horizon for some
  if (r() > 0.5) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = pal[3];
    ctx.fillRect(0, 150 + r() * 50, 256, 106);
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
