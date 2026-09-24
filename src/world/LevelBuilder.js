import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK = 24;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

// Box-projected UVs from world positions (1 unit = 1 m) so tiled textures
// line up across separate pieces of geometry.
function applyWorldUV(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else if (ax >= az) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class LevelBuilder {
  constructor(scene, materials, collision) {
    this.scene = scene;
    this.materials = materials;
    this.collision = collision;
    this.batches = new Map(); // key -> {mat, geos, cast, receive}
  }

  mat(m) {
    return typeof m === 'string' ? this.materials.get(m) : m;
  }

  // Queue a geometry (already transformed to world space via matrix).
  addGeometry(geo, material, matrix, opts = {}) {
    const mat = this.mat(material);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (opts.uv !== 'keep') applyWorldUV(g);
    else if (!g.attributes.uv) applyWorldUV(g);
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(_p);
    const cast = opts.cast ?? true;
    const receive = opts.receive ?? true;
    const key = `${mat.uuid}|${Math.floor(c.x / CHUNK)}|${Math.floor(c.z / CHUNK)}|${cast}|${receive}`;
    if (!this.batches.has(key)) this.batches.set(key, { mat, geos: [], cast, receive });
    this.batches.get(key).geos.push(g);
  }

  // Axis-aligned box with centre (x,z), base y, size (w,h,d).
  box(x, y, z, w, h, d, material, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    _e.set(0, opts.rotY ?? 0, 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y + h / 2, z), _q, _s.set(1, 1, 1));
    this.addGeometry(geo, material, _m, opts);
    if (opts.collide !== false && !opts.rotY) {
      this.collision.addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, {
        h: opts.colH ?? h,
        y0: opts.colY0 ?? y,
        sight: opts.sight ?? h > 1.3,
        move: opts.move ?? true,
        tag: opts.tag,
      });
    }
    return geo;
  }

  // Box from min/max corners.
  boxMinMax(minX, y0, minZ, maxX, y1, maxZ, material, opts = {}) {
    return this.box((minX + maxX) / 2, y0, (minZ + maxZ) / 2, maxX - minX, y1 - y0, maxZ - minZ, material, opts);
  }

  // Generic mesh geometry with position / rotation / scale.
  mesh(geo, material, x, y, z, opts = {}) {
    _e.set(opts.rotX ?? 0, opts.rotY ?? 0, opts.rotZ ?? 0);
    _q.setFromEuler(_e);
    const s = opts.scale ?? 1;
    if (typeof s === 'number') _s.set(s, s, s);
    else _s.set(s[0], s[1], s[2]);
    _m.compose(_p.set(x, y, z), _q, _s);
    this.addGeometry(geo, material, _m, { uv: opts.uv ?? 'keep', cast: opts.cast, receive: opts.receive });
  }

  cylinder(x, y, z, rTop, rBot, h, material, opts = {}) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, opts.segments ?? 16, 1, opts.open ?? false);
    this.mesh(geo, material, x, y + h / 2, z, { ...opts, uv: opts.uv ?? 'world' });
    if (opts.collide) {
      this.collision.addCircle(x, z, Math.max(rTop, rBot), { h: opts.colH ?? h, y0: y, sight: opts.sight ?? h > 1.3 });
    }
  }

  floor(minX, minZ, maxX, maxZ, material, y = 0, thick = 0.1) {
    this.boxMinMax(minX, y - thick, minZ, maxX, y, maxZ, material, { collide: false, cast: false });
  }

  // Straight wall between two points along an axis, with optional openings.
  // openings: [{ at: distance from start to opening centre, width, bottom=0, top, kind:'door'|'window'|'gap' }]
  wall(x1, z1, x2, z2, opts = {}) {
    const h = opts.h ?? 4;
    const t = opts.thick ?? 0.25;
    const y0 = opts.y0 ?? 0;
    const material = opts.mat ?? 'plaster';
    const horizontal = Math.abs(z2 - z1) < 1e-6;
    const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const dir = horizontal ? Math.sign(x2 - x1) : Math.sign(z2 - z1);
    const openings = (opts.openings ?? []).slice().sort((a, b) => a.at - b.at);

    const seg = (a, b, yb, yt, matOverride, colOpts) => {
      if (b - a < 0.01 || yt - yb < 0.01) return;
      const mid = (a + b) / 2;
      const l = b - a;
      const cx = horizontal ? x1 + dir * mid : x1;
      const cz = horizontal ? z1 : z1 + dir * mid;
      const w = horizontal ? l : t;
      const d = horizontal ? t : l;
      this.box(cx, yb, cz, w, yt - yb, d, matOverride ?? material, {
        collide: colOpts !== false,
        ...(colOpts || {}),
        sight: colOpts?.sight ?? true,
      });
    };

    let cursor = 0;
    for (const o of openings) {
      const a = o.at - o.width / 2;
      const b = o.at + o.width / 2;
      seg(cursor, a, y0, y0 + h);
      const top = o.top ?? (o.kind === 'window' ? 2.8 : 2.4);
      const bottom = o.kind === 'window' ? o.bottom ?? 0.9 : 0;
      // lintel above
      seg(a, b, y0 + top, y0 + h, null, { sight: true, move: false });
      if (o.kind === 'window') {
        seg(a, b, y0, y0 + bottom, opts.sillMat ?? material, { sight: true, h: bottom });
        // invisible movement blocker across the window opening (sight passes)
        const mid = (a + b) / 2;
        const cx = horizontal ? x1 + dir * mid : x1;
        const cz = horizontal ? z1 : z1 + dir * mid;
        const w = horizontal ? o.width : t;
        const d = horizontal ? t : o.width;
        this.collision.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, { h, y0, sight: false, bullets: false, move: true });
        if (o.glass !== false) {
          const glassGeo = new THREE.BoxGeometry(horizontal ? o.width : 0.04, top - bottom, horizontal ? 0.04 : o.width);
          _m.compose(_p.set(cx, y0 + (top + bottom) / 2, cz), _q.identity(), _s.set(1, 1, 1));
          this.addGeometry(glassGeo, 'glass', _m, { cast: false });
          // frame
          const fm = opts.frameMat ?? 'paintedWood';
          const fw = 0.08;
          if (horizontal) {
            this.box(cx, y0 + bottom, cz, fw, top - bottom, t + 0.04, fm, { collide: false });
            this.box(cx, y0 + bottom, cz, o.width, 0.06, t + 0.06, fm, { collide: false });
          } else {
            this.box(cx, y0 + bottom, cz, t + 0.04, top - bottom, fw, fm, { collide: false });
            this.box(cx, y0 + bottom, cz, t + 0.06, 0.06, o.width, fm, { collide: false });
          }
        }
      }
      cursor = b;
    }
    seg(cursor, len, y0, y0 + h);

    // Baseboard / trim strip on long walls for a touch of detail.
    if (opts.trim) {
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      this.box(cx, y0 + h - 0.12, cz, horizontal ? len : t + 0.08, 0.12, horizontal ? t + 0.08 : len, opts.trim, {
        collide: false,
      });
    }
  }

  // Four walls around a rectangle. sides: { n, s, e, w } each an options object (or false to skip).
  // North = -Z, South = +Z, West = -X, East = +X.
  room(minX, minZ, maxX, maxZ, opts = {}) {
    const sides = opts.sides ?? {};
    const common = { h: opts.h, thick: opts.thick, mat: opts.mat, trim: opts.trim };
    if (sides.n !== false) this.wall(minX, minZ, maxX, minZ, { ...common, ...(sides.n || {}) });
    if (sides.s !== false) this.wall(minX, maxZ, maxX, maxZ, { ...common, ...(sides.s || {}) });
    if (sides.w !== false) this.wall(minX, minZ, minX, maxZ, { ...common, ...(sides.w || {}) });
    if (sides.e !== false) this.wall(maxX, minZ, maxX, maxZ, { ...common, ...(sides.e || {}) });
  }

  ceiling(minX, minZ, maxX, maxZ, y, material = 'plaster') {
    this.boxMinMax(minX, y, minZ, maxX, y + 0.15, maxZ, material, { collide: false, cast: true });
  }

  // Hipped roof over a rectangle.
  hipRoof(minX, minZ, maxX, maxZ, baseY, height, material = 'roof', overhang = 0.6) {
    const x0 = minX - overhang;
    const x1 = maxX + overhang;
    const z0 = minZ - overhang;
    const z1 = maxZ + overhang;
    const w = x1 - x0;
    const d = z1 - z0;
    const ridgeHalf = Math.max(0, (w - d) / 2);
    const ridgeHalfZ = Math.max(0, (d - w) / 2);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const top = baseY + height;
    const r1 = new THREE.Vector3(cx - ridgeHalf, top, cz - ridgeHalfZ);
    const r2 = new THREE.Vector3(cx + ridgeHalf, top, cz + ridgeHalfZ);
    const A = new THREE.Vector3(x0, baseY, z0);
    const B = new THREE.Vector3(x1, baseY, z0);
    const C = new THREE.Vector3(x1, baseY, z1);
    const D = new THREE.Vector3(x0, baseY, z1);
    const tris = [];
    const quad = (a, b, c, d2) => tris.push(a, b, c, a, c, d2);
    if (w >= d) {
      quad(A, r1, r2, B); // north
      quad(C, r2, r1, D); // south
      tris.push(D, r1, A); // west
      tris.push(B, r2, C); // east
    } else {
      quad(D, r2, r1, A); // west
      quad(B, r1, r2, C); // east
      tris.push(A, r1, B); // north
      tris.push(C, r2, D); // south
    }
    const pos = new Float32Array(tris.length * 3);
    tris.forEach((v, i) => {
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    // UVs along slope direction
    const uv = new Float32Array((tris.length) * 2);
    for (let i = 0; i < tris.length; i++) {
      const v = tris[i];
      const n = geo.attributes.normal;
      const nx = n.getX(i);
      const nz = n.getZ(i);
      if (Math.abs(nx) > Math.abs(nz)) {
        uv[i * 2] = v.z;
        uv[i * 2 + 1] = v.x * Math.sign(nx);
      } else {
        uv[i * 2] = v.x;
        uv[i * 2 + 1] = v.z * Math.sign(nz);
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.addGeometry(geo, material, null, { uv: 'keep' });
    // soffit (underside) so the roof reads as solid from below
    this.boxMinMax(x0, baseY - 0.2, z0, x1, baseY, z1, 'stoneTrim', { collide: false, cast: false });
  }

  flatRoof(minX, minZ, maxX, maxZ, y, material = 'concrete', parapet = 0.5) {
    this.boxMinMax(minX - 0.2, y, minZ - 0.2, maxX + 0.2, y + 0.3, maxZ + 0.2, material, { collide: false });
    if (parapet > 0) {
      const t = 0.25;
      const top = y + 0.3 + parapet;
      this.boxMinMax(minX - 0.2, y + 0.3, minZ - 0.2, maxX + 0.2, top, minZ + t - 0.2, material, { collide: false });
      this.boxMinMax(minX - 0.2, y + 0.3, maxZ - t + 0.2, maxX + 0.2, top, maxZ + 0.2, material, { collide: false });
      this.boxMinMax(minX - 0.2, y + 0.3, minZ, minX + t - 0.2, top, maxZ, material, { collide: false });
      this.boxMinMax(maxX - t + 0.2, y + 0.3, minZ, maxX + 0.2, top, maxZ, material, { collide: false });
    }
  }

  finalize() {
    for (const batch of this.batches.values()) {
      const geo = batch.geos.length === 1 ? batch.geos[0] : mergeGeometries(batch.geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, batch.mat);
      mesh.castShadow = batch.cast && !batch.mat.transparent;
      mesh.receiveShadow = batch.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
    }
    this.batches.clear();
  }
}
