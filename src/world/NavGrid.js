import { CollisionWorld } from './Collision.js';

// Walkability grid + A* for NPC path finding. Doors are treated as
// walkable (NPCs open them on the way).
export class NavGrid {
  constructor(minX, minZ, maxX, maxZ, cell = 0.5) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.walk = new Uint8Array(this.w * this.h);
    // A* scratch buffers
    const n = this.w * this.h;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.state = new Uint32Array(n); // search id marker
    this.closedMark = new Uint32Array(n);
    this.searchId = 0;
  }

  /** @param {CollisionWorld} world */
  build(world, radius = 0.32, extraBlocked = null) {
    for (let iz = 0; iz < this.h; iz++) {
      for (let ix = 0; ix < this.w; ix++) {
        const x = this.minX + (ix + 0.5) * this.cell;
        const z = this.minZ + (iz + 0.5) * this.cell;
        let ok = !world.circleBlocked(x, z, radius, 'door');
        if (ok && extraBlocked && extraBlocked(x, z)) ok = false;
        this.walk[iz * this.w + ix] = ok ? 1 : 0;
      }
    }
  }

  toCell(x, z) {
    return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)];
  }

  toWorld(ix, iz) {
    return { x: this.minX + (ix + 0.5) * this.cell, z: this.minZ + (iz + 0.5) * this.cell };
  }

  walkable(ix, iz) {
    return ix >= 0 && iz >= 0 && ix < this.w && iz < this.h && this.walk[iz * this.w + ix] === 1;
  }

  isWalkableWorld(x, z) {
    const [ix, iz] = this.toCell(x, z);
    return this.walkable(ix, iz);
  }

  // Nearest walkable cell (spiral search).
  nearestWalkable(ix, iz, maxR = 12) {
    if (this.walkable(ix, iz)) return [ix, iz];
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          if (this.walkable(ix + dx, iz + dz)) {
            const d = dx * dx + dz * dz;
            if (d < bestD) {
              bestD = d;
              best = [ix + dx, iz + dz];
            }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  nearestWalkableWorld(x, z) {
    const [ix, iz] = this.toCell(x, z);
    const c = this.nearestWalkable(ix, iz);
    return c ? this.toWorld(c[0], c[1]) : null;
  }

  // Grid line walk (supercover-ish) to test straight-line walkability.
  lineWalkable(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const [ix, iz] = this.toCell(ax + dx * t, az + dz * t);
      if (!this.walkable(ix, iz)) return false;
    }
    return true;
  }

  findPath(sx, sz, tx, tz, maxNodes = 40000) {
    let [six, siz] = this.toCell(sx, sz);
    let [tix, tiz] = this.toCell(tx, tz);
    const s = this.nearestWalkable(six, siz);
    const t = this.nearestWalkable(tix, tiz);
    if (!s || !t) return null;
    [six, siz] = s;
    [tix, tiz] = t;
    const w = this.w;
    const start = siz * w + six;
    const goal = tiz * w + tix;
    if (start === goal) return [{ x: tx, z: tz }];

    const id = ++this.searchId;
    const heap = new MinHeap(this.f);
    this.g[start] = 0;
    this.f[start] = this._h(six, siz, tix, tiz);
    this.parent[start] = -1;
    this.state[start] = id;
    heap.push(start);
    let expanded = 0;
    const DIRS = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.4142],
      [1, -1, 1.4142],
      [-1, 1, 1.4142],
      [-1, -1, 1.4142],
    ];
    let found = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (this.closedMark[cur] === id) continue;
      this.closedMark[cur] = id;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expanded > maxNodes) break;
      const cx = cur % w;
      const cz = (cur - cx) / w;
      for (const [ddx, ddz, cost] of DIRS) {
        const nx = cx + ddx;
        const nz = cz + ddz;
        if (!this.walkable(nx, nz)) continue;
        if (ddx !== 0 && ddz !== 0 && (!this.walkable(cx + ddx, cz) || !this.walkable(cx, cz + ddz))) continue;
        const ni = nz * w + nx;
        if (this.closedMark[ni] === id) continue;
        const ng = this.g[cur] + cost;
        if (this.state[ni] !== id || ng < this.g[ni]) {
          this.state[ni] = id;
          this.g[ni] = ng;
          this.f[ni] = ng + this._h(nx, nz, tix, tiz);
          this.parent[ni] = cur;
          heap.push(ni);
        }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let c = goal; c !== -1; c = this.parent[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => {
      const ix = c % w;
      return this.toWorld(ix, (c - ix) / w);
    });
    pts[pts.length - 1] = this.isWalkableWorld(tx, tz) ? { x: tx, z: tz } : pts[pts.length - 1];
    return this._smooth([{ x: sx, z: sz }, ...pts]).slice(1);
  }

  _h(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)) * 1.001;
  }

  // String-pulling: drop points while a straight walkable line exists.
  _smooth(pts) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      const a = pts[anchor];
      if (!this.lineWalkable(a.x, a.z, pts[i].x, pts[i].z)) {
        out.push(pts[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
}

class MinHeap {
  constructor(score) {
    this.score = score;
    this.data = [];
  }
  get size() {
    return this.data.length;
  }
  push(v) {
    const d = this.data;
    d.push(v);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.score[d[p]] <= this.score[d[i]]) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }
  pop() {
    const d = this.data;
    const top = d[0];
    const last = d.pop();
    if (d.length > 0) {
      d[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < d.length && this.score[d[l]] < this.score[d[m]]) m = l;
        if (r < d.length && this.score[d[r]] < this.score[d[m]]) m = r;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]];
        i = m;
      }
    }
    return top;
  }
}
