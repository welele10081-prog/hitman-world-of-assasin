import * as THREE from 'three';
import { TextureLibrary } from './Textures.js';

// Named PBR materials. Geometry built by the level uses world-scaled UVs
// (1 UV unit = 1 metre), so `tile` is the texture size in metres.
const DEFS = {
  grass: { tex: 'grass', tile: 4, roughness: 0.95, normalScale: 0.6 },
  gravel: { tex: 'gravel', tile: 3, roughness: 0.95, normalScale: 0.8 },
  pavers: { tex: 'pavers', tile: 3, roughness: 0.85, normalScale: 0.7 },
  marble: { tex: 'marble', tile: 2.4, roughness: 0.18, normalScale: 0.15 },
  woodFloor: { tex: 'woodFloor', tile: 3, roughness: 0.45, normalScale: 0.4 },
  darkWood: { tex: 'darkWood', tile: 1.5, roughness: 0.5, normalScale: 0.3 },
  plaster: { tex: 'plaster', tile: 3, roughness: 0.9, normalScale: 0.25 },
  stucco: { tex: 'stucco', tile: 3, roughness: 0.92, normalScale: 0.35 },
  stoneWall: { tex: 'stoneWall', tile: 3, roughness: 0.9, normalScale: 1.0 },
  roof: { tex: 'roof', tile: 2.5, roughness: 0.8, normalScale: 0.8 },
  tiles: { tex: 'tiles', tile: 2, roughness: 0.3, normalScale: 0.3 },
  checker: { tex: 'checker', tile: 3, roughness: 0.35, normalScale: 0.2 },
  carpet: { tex: 'carpet', tile: 6, roughness: 1.0, normalScale: 0.2 },
  leaves: { tex: 'leaves', tile: 2, roughness: 0.9, normalScale: 1.2 },
  concrete: { tex: 'concrete', tile: 4, roughness: 0.9, normalScale: 0.4 },
  sand: { tex: 'sand', tile: 4, roughness: 1.0, normalScale: 0.5 },
  deck: { tex: 'deck', tile: 2.5, roughness: 0.75, normalScale: 0.6 },
  fabricWhite: { tex: 'fabric', tile: 1, roughness: 0.9, color: 0xf3efe6, normalScale: 0.3 },
  fabricDark: { tex: 'fabric', tile: 1, roughness: 0.9, color: 0x3a3230, normalScale: 0.3 },
  fabricGreen: { tex: 'fabric', tile: 1, roughness: 0.9, color: 0x2f4a3a, normalScale: 0.3 },
  fabricRed: { tex: 'fabric', tile: 1, roughness: 0.9, color: 0x7a2228, normalScale: 0.3 },
  fabricCream: { tex: 'fabric', tile: 1, roughness: 0.9, color: 0xd8c8a8, normalScale: 0.3 },
  steel: { color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 },
  darkMetal: { color: 0x2c2e31, roughness: 0.45, metalness: 0.8 },
  brass: { color: 0xc8a050, roughness: 0.3, metalness: 1.0 },
  glass: { color: 0xa8c8d0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25 },
  black: { color: 0x151515, roughness: 0.6 },
  white: { color: 0xf0eee8, roughness: 0.6 },
  paintedWood: { color: 0xece6da, roughness: 0.55 },
  greenPaint: { color: 0x31463a, roughness: 0.6 },
  terracotta: { color: 0xa65a3a, roughness: 0.9 },
  bark: { color: 0x4a3626, roughness: 1.0 },
  foliage: { tex: 'leaves', tile: 1.5, roughness: 0.9, normalScale: 1.5 },
  cypress: { tex: 'leaves', tile: 1.2, roughness: 0.9, color: 0x9ab08a, normalScale: 1.5 },
  water: { color: 0x2a4a58, roughness: 0.1 },
  lampGlow: { color: 0xffe0a0, emissive: 0xffc070, emissiveIntensity: 1.6 },
  screenGlow: { color: 0x223344, emissive: 0x4488aa, emissiveIntensity: 1.2 },
  wine: { color: 0x4a0a14, roughness: 0.1, transparent: true, opacity: 0.85 },
  bottleGlass: { color: 0x1c3a1c, roughness: 0.1, metalness: 0.2 },
  paperWhite: { color: 0xf5f2e8, roughness: 0.9 },
  rope: { color: 0x9a8058, roughness: 1.0 },
  rubber: { color: 0x1a1a1a, roughness: 0.9 },
  hedge: { tex: 'leaves', tile: 1.5, roughness: 0.95, color: 0xb8c8a8, normalScale: 1.6 },
  painting1: { color: 0x7a5a3a, roughness: 0.7 },
  painting2: { color: 0x3a5a7a, roughness: 0.7 },
  painting3: { color: 0x7a3a3a, roughness: 0.7 },
  gold: { color: 0xd4af37, roughness: 0.25, metalness: 1.0 },
  boatHull: { color: 0xe8e4dc, roughness: 0.35 },
  boatWood: { color: 0x6a4028, roughness: 0.4 },
  vanBody: { color: 0xe6e6e2, roughness: 0.4, metalness: 0.3 },
  carBlack: { color: 0x101214, roughness: 0.2, metalness: 0.6 },
  carSilver: { color: 0x9aa0a6, roughness: 0.25, metalness: 0.7 },
  carRed: { color: 0x6a0f14, roughness: 0.25, metalness: 0.5 },
  tire: { color: 0x121212, roughness: 0.95 },
  chrome: { color: 0xdddddd, roughness: 0.1, metalness: 1.0 },
  greenhouseGlass: { color: 0xc8e0d8, roughness: 0.05, transparent: true, opacity: 0.18 },
  soil: { color: 0x3a2a1c, roughness: 1.0 },
  crateWood: { tex: 'deck', tile: 1, roughness: 0.9, color: 0xc8b090, normalScale: 0.6 },
  cabinet: { color: 0x5a3e2a, roughness: 0.55 },
  fridge: { color: 0xdcdcdc, roughness: 0.3, metalness: 0.5 },
  dumpster: { color: 0x2a4a32, roughness: 0.7, metalness: 0.4 },
  flowerRed: { color: 0xb02030, roughness: 0.8 },
  flowerWhite: { color: 0xf0f0f0, roughness: 0.8 },
  flowerPurple: { color: 0x7040a0, roughness: 0.8 },
  flowerYellow: { color: 0xe0c040, roughness: 0.8 },
  tablecloth: { color: 0xf2eee4, roughness: 0.85 },
  carLight: { color: 0xf0e8d0, emissive: 0xffe8b0, emissiveIntensity: 0.35, roughness: 0.2 },
  leather: { color: 0x3a2418, roughness: 0.6 },
  books: { color: 0x6a3a2a, roughness: 0.8 },
  stoneTrim: { color: 0xd8d0c0, roughness: 0.8 },
  rug: { tex: 'carpet', tile: 4, roughness: 1.0, normalScale: 0.2 },
};

export class Materials {
  constructor() {
    this.textures = new TextureLibrary();
    this.cache = new Map();
  }

  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const def = DEFS[name];
    if (!def) throw new Error(`Unknown material ${name}`);
    const params = {
      color: def.color ?? 0xffffff,
      roughness: def.roughness ?? 0.8,
      metalness: def.metalness ?? 0,
    };
    if (def.emissive !== undefined) {
      params.emissive = def.emissive;
      params.emissiveIntensity = def.emissiveIntensity ?? 1;
    }
    if (def.transparent) {
      params.transparent = true;
      params.opacity = def.opacity;
      params.depthWrite = false;
    }
    if (def.tex) {
      const { map, normalMap } = this.textures.get(def.tex);
      const m = map.clone();
      const nm = normalMap.clone();
      const rep = 1 / def.tile;
      m.repeat.set(rep, rep);
      nm.repeat.set(rep, rep);
      m.needsUpdate = nm.needsUpdate = true;
      params.map = m;
      params.normalMap = nm;
      const ns = def.normalScale ?? 0.5;
      params.normalScale = new THREE.Vector2(ns, ns);
    }
    const mat = new THREE.MeshStandardMaterial(params);
    mat.name = name;
    this.cache.set(name, mat);
    return mat;
  }

  // Plain coloured material (for clothing, unique props).
  color(hex, roughness = 0.7, metalness = 0) {
    const key = `c:${hex}:${roughness}:${metalness}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const mat = new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
    this.cache.set(key, mat);
    return mat;
  }
}
