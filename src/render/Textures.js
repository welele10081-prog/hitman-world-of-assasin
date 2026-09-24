import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

// Procedural textures drawn on canvases, so the game ships without any image assets.

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Tileable value noise.
function makeNoise(seed, period) {
  const rng = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const at = (x, y) => grid[((y % period) + period) % period * period + (((x % period) + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// Fractal noise in [0,1], tileable over `size` pixels.
function fbm(noise, x, y, size, basePeriod, octaves = 4) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise((x / size) * period, (y / size) * period);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function fillPixels(size, fn) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, h] = fn(x, y);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      heights[y * size + x] = h === undefined ? (r + g + b) / 765 : h;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, heights, size };
}

function normalFromHeights({ heights, size }, strength = 2) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const mix = (a, b, t) => a + (b - a) * t;

const generators = {
  grass(size) {
    const n = makeNoise(11, 8);
    const n2 = makeNoise(12, 64);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 4, 4);
      const blade = n2((x / size) * 64, (y / size) * 64);
      const t = f * 0.7 + blade * 0.3;
      return [mix(44, 86, t), mix(66, 112, t), mix(28, 44, t), t];
    });
  },
  gravel(size) {
    const n = makeNoise(21, 32);
    const n2 = makeNoise(22, 128);
    return fillPixels(size, (x, y) => {
      const a = fbm(n, x, y, size, 32, 2);
      const b = n2((x / size) * 128, (y / size) * 128);
      const t = a * 0.5 + b * 0.5;
      const v = mix(120, 190, t);
      return [v, v * 0.95, v * 0.86, t];
    });
  },
  pavers(size) {
    const n = makeNoise(31, 16);
    const tiles = 4;
    const step = size / tiles;
    return fillPixels(size, (x, y) => {
      const row = Math.floor(y / step);
      const ox = row % 2 ? step / 2 : 0;
      const lx = (x + ox) % step;
      const ly = y % step;
      const grout = lx < 3 || ly < 3;
      const cell = Math.floor((x + ox) / step) * 7 + row * 13;
      const tint = ((cell * 9301 + 49297) % 233280) / 233280;
      const f = fbm(n, x, y, size, 16, 4);
      if (grout) return [70, 66, 60, 0.1];
      const v = mix(150, 196, f * 0.6 + tint * 0.4);
      return [v, v * 0.93, v * 0.82, 0.6 + f * 0.4];
    });
  },
  marble(size) {
    const n = makeNoise(41, 4);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 4, 5);
      const vein = Math.abs(Math.sin((x / size) * Math.PI * 4 + f * 12));
      const v = mix(205, 240, Math.pow(vein, 0.35));
      const tile = x % (size / 2) < 2 || y % (size / 2) < 2;
      if (tile) return [150, 146, 140, 0];
      return [v, v * 0.985, v * 0.96, 0.5];
    });
  },
  woodFloor(size) {
    const n = makeNoise(51, 8);
    const planks = 8;
    const pw = size / planks;
    return fillPixels(size, (x, y) => {
      const p = Math.floor(x / pw);
      const off = ((p * 37) % 5) * (size / 5);
      const yy = (y + off) % size;
      const seam = x % pw < 2 || (yy % (size / 2)) < 2;
      const grain = n((x / size) * 64 + p * 3, (yy / size) * 4);
      const tint = ((p * 7919) % 11) / 11;
      if (seam) return [48, 30, 18, 0];
      const t = grain * 0.6 + tint * 0.4;
      return [mix(96, 146, t), mix(58, 90, t), mix(32, 50, t), 0.5 + grain * 0.5];
    });
  },
  darkWood(size) {
    const n = makeNoise(52, 8);
    return fillPixels(size, (x, y) => {
      const grain = fbm(n, x * 8, y * 0.5, size, 8, 3);
      const t = grain;
      return [mix(40, 72, t), mix(24, 42, t), mix(14, 26, t), t];
    });
  },
  plaster(size) {
    const n = makeNoise(61, 16);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 16, 5);
      const v = mix(214, 236, f);
      return [v, v * 0.97, v * 0.9, f];
    });
  },
  stucco(size) {
    const n = makeNoise(62, 16);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 16, 5);
      return [mix(206, 228, f), mix(180, 202, f), mix(146, 164, f), f];
    });
  },
  stoneWall(size) {
    const n = makeNoise(71, 16);
    const rows = 8;
    const rh = size / rows;
    return fillPixels(size, (x, y) => {
      const r = Math.floor(y / rh);
      const bw = rh * 2;
      const ox = r % 2 ? bw / 2 : 0;
      const lx = (x + ox) % bw;
      const ly = y % rh;
      const f = fbm(n, x, y, size, 16, 4);
      if (lx < 3 || ly < 3) return [92, 86, 78, 0];
      const id = Math.floor((x + ox) / bw) * 17 + r * 31;
      const tint = ((id * 9301 + 49297) % 233280) / 233280;
      const v = mix(128, 178, f * 0.5 + tint * 0.5);
      return [v, v * 0.94, v * 0.84, 0.5 + f * 0.5];
    });
  },
  roof(size) {
    const n = makeNoise(81, 16);
    const rows = 16;
    const rh = size / rows;
    return fillPixels(size, (x, y) => {
      const r = Math.floor(y / rh);
      const ly = y % rh;
      const f = fbm(n, x, y, size, 16, 3);
      const shade = ly / rh;
      const lx = (x + (r % 2 ? rh : 0)) % (rh * 2);
      const edge = lx < 2 ? 0.6 : 1;
      const v = mix(0.55, 1, shade) * edge;
      return [mix(120, 170, f) * v, mix(52, 74, f) * v, mix(36, 48, f) * v, shade * edge];
    });
  },
  tiles(size) {
    const n = makeNoise(91, 16);
    const t = size / 8;
    return fillPixels(size, (x, y) => {
      if (x % t < 2 || y % t < 2) return [150, 150, 146, 0];
      const f = fbm(n, x, y, size, 16, 3);
      const v = mix(225, 242, f);
      return [v, v, v * 0.98, 0.6];
    });
  },
  checker(size) {
    const t = size / 8;
    const n = makeNoise(92, 16);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 16, 3);
      if (x % t < 1 || y % t < 1) return [80, 80, 80, 0];
      const dark = (Math.floor(x / t) + Math.floor(y / t)) % 2;
      const v = dark ? mix(30, 44, f) : mix(214, 232, f);
      return [v, v, v, 0.5];
    });
  },
  carpet(size) {
    const n = makeNoise(101, 64);
    return fillPixels(size, (x, y) => {
      const f = n((x / size) * 64, (y / size) * 64);
      const cx = (x / size) * 2 - 1;
      const cy = (y / size) * 2 - 1;
      const border = Math.max(Math.abs(cx), Math.abs(cy)) > 0.86;
      const pattern = Math.abs(Math.sin(cx * 9) * Math.cos(cy * 9)) > 0.7;
      let r = 118;
      let g = 24;
      let b = 30;
      if (border) [r, g, b] = [150, 112, 50];
      else if (pattern) [r, g, b] = [86, 18, 26];
      const k = 0.85 + f * 0.2;
      return [r * k, g * k, b * k, f];
    });
  },
  leaves(size) {
    const n = makeNoise(111, 32);
    const n2 = makeNoise(112, 8);
    return fillPixels(size, (x, y) => {
      const f = n((x / size) * 32, (y / size) * 32);
      const g2 = fbm(n2, x, y, size, 8, 3);
      const t = f * 0.6 + g2 * 0.4;
      return [mix(22, 60, t), mix(44, 92, t), mix(18, 36, t), t];
    });
  },
  concrete(size) {
    const n = makeNoise(121, 16);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 16, 5);
      const v = mix(128, 160, f);
      return [v, v, v * 0.97, f];
    });
  },
  sand(size) {
    const n = makeNoise(131, 32);
    return fillPixels(size, (x, y) => {
      const f = fbm(n, x, y, size, 32, 3);
      return [mix(170, 200, f), mix(150, 178, f), mix(112, 136, f), f];
    });
  },
  deck(size) {
    const n = makeNoise(141, 8);
    const planks = 6;
    const pw = size / planks;
    return fillPixels(size, (x, y) => {
      const p = Math.floor(x / pw);
      const seam = x % pw < 3;
      const grain = n((x / size) * 48 + p * 5, (y / size) * 3);
      const tint = ((p * 131) % 7) / 7;
      if (seam) return [30, 22, 16, 0];
      const t = grain * 0.6 + tint * 0.4;
      return [mix(92, 128, t), mix(70, 96, t), mix(50, 68, t), 0.5 + grain * 0.5];
    });
  },
  fabric(size) {
    const n = makeNoise(151, 128);
    return fillPixels(size, (x, y) => {
      const weave = (x % 4 < 2) !== (y % 4 < 2) ? 1 : 0.85;
      const f = n((x / size) * 128, (y / size) * 128);
      const v = (200 + f * 55) * weave;
      return [v, v, v, weave];
    });
  },
};

// Creates { map, normalMap } pairs lazily and caches them.
export class TextureLibrary {
  constructor() {
    this.cache = new Map();
  }

  get(name, size = 512) {
    const key = `${name}:${size}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const gen = generators[name];
    if (!gen) throw new Error(`Unknown texture ${name}`);
    const data = gen(size);
    const map = toTexture(data.canvas, true);
    const normalMap = toTexture(normalFromHeights(data, 3), false);
    const entry = { map, normalMap };
    this.cache.set(key, entry);
    return entry;
  }

  // Tileable normal map for the lake surface.
  waterNormals(size = 256) {
    if (this.cache.has('water')) return this.cache.get('water');
    const n = makeNoise(777, 8);
    const heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) heights[y * size + x] = fbm(n, x, y, size, 8, 5);
    const tex = toTexture(normalFromHeights({ heights, size }, 6), false);
    this.cache.set('water', tex);
    return tex;
  }
}
