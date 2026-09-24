// 2.5D collision: axis-aligned boxes and circles on the XZ plane, each with a
// height. Movement is resolved in 2D; line-of-sight checks consider height.

const CELL = 4;

export class CollisionWorld {
  constructor() {
    this.colliders = [];
    this.grid = new Map();
    this.queryStamp = 0;
  }

  _key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }

  _cellsFor(c, fn) {
    const x0 = Math.floor(c.minX / CELL);
    const x1 = Math.floor(c.maxX / CELL);
    const z0 = Math.floor(c.minZ / CELL);
    const z1 = Math.floor(c.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) fn(this._key(ix, iz));
  }

  // opts: { h: height, y0: base height, sight: blocks sight, move: blocks movement, tag }
  addBox(minX, minZ, maxX, maxZ, opts = {}) {
    const c = {
      type: 'box',
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      h: opts.h ?? 3,
      y0: opts.y0 ?? 0,
      sight: opts.sight ?? true,
      move: opts.move ?? true,
      bullets: opts.bullets ?? opts.sight ?? true,
      enabled: true,
      tag: opts.tag ?? null,
      stamp: 0,
    };
    this._insert(c);
    return c;
  }

  addCircle(x, z, r, opts = {}) {
    const c = {
      type: 'circle',
      x,
      z,
      r,
      minX: x - r,
      maxX: x + r,
      minZ: z - r,
      maxZ: z + r,
      h: opts.h ?? 3,
      y0: opts.y0 ?? 0,
      sight: opts.sight ?? true,
      move: opts.move ?? true,
      bullets: opts.bullets ?? opts.sight ?? true,
      enabled: true,
      tag: opts.tag ?? null,
      stamp: 0,
    };
    this._insert(c);
    return c;
  }

  _insert(c) {
    this.colliders.push(c);
    this._cellsFor(c, (k) => {
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(c);
    });
  }

  remove(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
    this._cellsFor(c, (k) => {
      const list = this.grid.get(k);
      if (!list) return;
      const j = list.indexOf(c);
      if (j >= 0) list.splice(j, 1);
    });
  }

  // Calls fn for every collider whose bounds overlap the rectangle.
  query(minX, minZ, maxX, maxZ, fn) {
    const stamp = ++this.queryStamp;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(this._key(ix, iz));
        if (!list) continue;
        for (const c of list) {
          if (c.stamp === stamp || !c.enabled) continue;
          c.stamp = stamp;
          if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
          fn(c);
        }
      }
    }
  }

  // Push a circle (character) out of blocking colliders. Mutates pos.
  resolveCircle(pos, radius, feetY = 0) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (c) => {
        if (!c.move) return;
        if (c.y0 > feetY + 1.2 || c.y0 + c.h < feetY + 0.35) return;
        if (c.type === 'box') {
          const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
          const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
          let dx = pos.x - cx;
          let dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < radius * radius) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const push = radius - d;
              pos.x += (dx / d) * push;
              pos.z += (dz / d) * push;
            } else {
              // Centre inside the box: push out along the shallowest axis.
              const left = pos.x - c.minX;
              const right = c.maxX - pos.x;
              const back = pos.z - c.minZ;
              const front = c.maxZ - pos.z;
              const m = Math.min(left, right, back, front);
              if (m === left) pos.x = c.minX - radius;
              else if (m === right) pos.x = c.maxX + radius;
              else if (m === back) pos.z = c.minZ - radius;
              else pos.z = c.maxZ + radius;
            }
            moved = true;
          }
        } else {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const rr = radius + c.r;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x += (dx / d) * (rr - d);
            pos.z += (dz / d) * (rr - d);
            moved = true;
          }
        }
      });
      if (!moved) break;
    }
  }

  // Does a circle at (x,z) overlap anything that blocks movement?
  circleBlocked(x, z, radius, ignoreTag = null) {
    let hit = false;
    this.query(x - radius, z - radius, x + radius, z + radius, (c) => {
      if (hit || !c.move) return;
      if (ignoreTag && c.tag === ignoreTag) return;
      if (c.y0 > 1.2) return;
      if (c.type === 'box') {
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz < radius * radius) hit = true;
      } else {
        const dx = x - c.x;
        const dz = z - c.z;
        const rr = radius + c.r;
        if (dx * dx + dz * dz < rr * rr) hit = true;
      }
    });
    return hit;
  }

  // Ray on the XZ plane from (ax,az) at height y0->y1 to (bx,bz).
  // Returns the fraction t in [0,1] of the first blocking hit, or 1.
  // mode: 'sight' | 'bullets' | 'move' | 'camera'
  segmentHit(ax, ay, az, bx, by, bz, mode = 'sight') {
    const dx = bx - ax;
    const dz = bz - az;
    let best = 1;
    let bestC = null;
    this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (c) => {
      if (mode === 'sight' && !c.sight) return;
      if (mode === 'bullets' && !c.bullets) return;
      if (mode === 'move' && !c.move) return;
      if (mode === 'camera' && !c.sight) return;
      let tEnter;
      let tExit;
      if (c.type === 'box') {
        let t0 = 0;
        let t1 = 1;
        if (Math.abs(dx) < 1e-9) {
          if (ax < c.minX || ax > c.maxX) return;
        } else {
          let ta = (c.minX - ax) / dx;
          let tb = (c.maxX - ax) / dx;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
        }
        if (Math.abs(dz) < 1e-9) {
          if (az < c.minZ || az > c.maxZ) return;
        } else {
          let ta = (c.minZ - az) / dz;
          let tb = (c.maxZ - az) / dz;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
        }
        if (t0 > t1) return;
        tEnter = t0;
        tExit = t1;
      } else {
        const fx = ax - c.x;
        const fz = az - c.z;
        const a = dx * dx + dz * dz;
        const b = 2 * (fx * dx + fz * dz);
        const cc = fx * fx + fz * fz - c.r * c.r;
        const disc = b * b - 4 * a * cc;
        if (disc < 0 || a < 1e-12) return;
        const s = Math.sqrt(disc);
        tEnter = Math.max(0, (-b - s) / (2 * a));
        tExit = Math.min(1, (-b + s) / (2 * a));
        if (tEnter > tExit) return;
      }
      if (tEnter >= best) return;
      // Height test: the ray passes over the collider if it is above its top
      // at both the entry and exit points (or below its base).
      const yIn = ay + (by - ay) * tEnter;
      const yOut = ay + (by - ay) * tExit;
      const top = c.y0 + c.h;
      if (yIn > top && yOut > top) return;
      if (yIn < c.y0 && yOut < c.y0) return;
      best = tEnter;
      bestC = c;
    });
    this.lastHit = bestC;
    return best;
  }

  lineOfSight(a, ay, b, by) {
    return this.segmentHit(a.x, ay, a.z, b.x, by, b.z, 'sight') >= 0.999;
  }
}
