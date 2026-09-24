import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OUTFITS } from './Outfits.js';
import { clamp } from '../core/util.js';

// Procedural, rigidly-skinned human. Every character is ONE SkinnedMesh with
// vertex colours so dozens of NPCs stay cheap to draw.

const BONE_DEFS = [
  // name, parent, rest position
  ['root', null, [0, 0, 0]],
  ['body', 'root', [0, 0, 0]],
  ['hips', 'body', [0, 0.97, 0]],
  ['spine', 'hips', [0, 0.08, 0]],
  ['chest', 'spine', [0, 0.26, 0]],
  ['neck', 'chest', [0, 0.24, 0]],
  ['head', 'neck', [0, 0.07, 0]],
  ['lUpperArm', 'chest', [0.21, 0.19, 0]],
  ['lForearm', 'lUpperArm', [0, -0.28, 0]],
  ['lHand', 'lForearm', [0, -0.25, 0]],
  ['rUpperArm', 'chest', [-0.21, 0.19, 0]],
  ['rForearm', 'rUpperArm', [0, -0.28, 0]],
  ['rHand', 'rForearm', [0, -0.25, 0]],
  ['lThigh', 'hips', [0.1, -0.04, 0]],
  ['lShin', 'lThigh', [0, -0.44, 0]],
  ['lFoot', 'lShin', [0, -0.44, 0]],
  ['rThigh', 'hips', [-0.1, -0.04, 0]],
  ['rShin', 'rThigh', [0, -0.44, 0]],
  ['rFoot', 'rShin', [0, -0.44, 0]],
];
const BONE_INDEX = Object.fromEntries(BONE_DEFS.map((b, i) => [b[0], i]));

// Shared primitive geometries (non-indexed so they merge cleanly).
const PRIM = {};
function prim(name) {
  if (PRIM[name]) return PRIM[name];
  let g;
  switch (name) {
    case 'sphere':
      g = new THREE.SphereGeometry(1, 14, 10);
      break;
    case 'sphereLow':
      g = new THREE.SphereGeometry(1, 8, 6);
      break;
    case 'hemi':
      g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
      break;
    case 'box':
      g = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'rbox':
      g = new RoundedBoxGeometry(1, 1, 1, 2, 0.18);
      break;
    case 'cyl':
      g = new THREE.CylinderGeometry(1, 1, 1, 12);
      break;
    case 'cone':
      g = new THREE.CylinderGeometry(0.6, 1, 1, 14, 1, true);
      break;
    default:
      throw new Error(name);
  }
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  PRIM[name] = g;
  return g;
}

function capsule(r, len) {
  const key = `cap:${r}:${len}`;
  if (PRIM[key]) return PRIM[key];
  let g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  PRIM[key] = g;
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class PartCollector {
  constructor(boneWorld) {
    this.boneWorld = boneWorld;
    this.geos = [];
  }
  // Add primitive `g` in bone-local space.
  add(bone, g, color, pos, scale, rot = [0, 0, 0]) {
    const geo = g.clone();
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m.compose(_v.set(pos[0], pos[1], pos[2]), _q, Array.isArray(scale) ? _s.set(scale[0], scale[1], scale[2]) : _s.set(scale, scale, scale));
    geo.applyMatrix4(_m);
    geo.applyMatrix4(this.boneWorld[BONE_INDEX[bone]]);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.setHex(color, THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const bi = BONE_INDEX[bone];
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.geos.push(geo);
  }
}

// Build geometry for an outfit + appearance.
function buildBodyGeometry(boneWorld, outfitId, look) {
  const o = OUTFITS[outfitId];
  const P = new PartCollector(boneWorld);
  const skin = look.skin;
  const hair = look.hair;
  const female = look.female;
  const style = o.style;
  const dress = style === 'dress';
  const under = style === 'underwear';
  const torsoCol = dress ? o.dress : o.jacket;
  const sleeve = style === 'vest' ? o.shirt : dress || under ? skin : o.jacket;
  const thighCol = dress ? skin : o.pants;
  const shinCol = dress || under ? skin : o.pants;
  const shoulderW = female ? 0.36 : 0.42;
  const hipW = female ? 0.36 : 0.34;
  const bw = look.build ?? 1;

  // Pelvis + belt
  P.add('hips', prim('rbox'), under ? o.pants : dress ? o.dress : o.pants, [0, 0, 0], [hipW * bw, 0.22, 0.21]);
  if (!dress && !under && style !== 'chef' && style !== 'overalls') P.add('hips', prim('box'), 0x1a1612, [0, 0.085, 0], [hipW * bw + 0.01, 0.035, 0.215]);
  // Abdomen / chest
  P.add('spine', prim('rbox'), under ? skin : torsoCol, [0, 0.12, 0], [(shoulderW - 0.06) * bw, 0.24, 0.2]);
  if (under) P.add('spine', prim('rbox'), o.jacket, [0, 0.1, 0], [(shoulderW - 0.07) * bw, 0.2, 0.205]);
  P.add('chest', prim('rbox'), torsoCol, [0, 0.1, 0], [shoulderW * bw, 0.3, 0.24]);
  if (female && dress) {
    P.add('chest', prim('sphereLow'), torsoCol, [0.065, 0.06, 0.1], [0.075, 0.07, 0.06]);
    P.add('chest', prim('sphereLow'), torsoCol, [-0.065, 0.06, 0.1], [0.075, 0.07, 0.06]);
    // neckline
    P.add('chest', prim('box'), skin, [0, 0.2, 0.108], [0.2, 0.1, 0.03]);
    P.add('chest', prim('box'), skin, [0, 0.245, 0], [shoulderW * bw * 0.9, 0.012, 0.18]);
    if (o.necklace) P.add('chest', prim('box'), 0xe8d8a0, [0, 0.19, 0.125], [0.12, 0.012, 0.01]);
  }

  if (style === 'suit' || style === 'vest') {
    // Shirt V, lapels, tie
    P.add('chest', prim('box'), o.shirt, [0, 0.14, 0.117], [0.11, 0.22, 0.012], [0, 0, 0]);
    if (style === 'suit') {
      P.add('chest', prim('box'), o.lapel ?? torsoCol, [0.068, 0.12, 0.122], [0.045, 0.24, 0.012], [0, 0, 0.32]);
      P.add('chest', prim('box'), o.lapel ?? torsoCol, [-0.068, 0.12, 0.122], [0.045, 0.24, 0.012], [0, 0, -0.32]);
    }
    if (o.bowtie) {
      P.add('chest', prim('box'), o.tie ?? 0x101010, [0, 0.22, 0.127], [0.08, 0.03, 0.02]);
    } else if (o.tie !== undefined) {
      P.add('chest', prim('box'), o.tie, [0, 0.08, 0.125], [0.045, 0.3, 0.012]);
    }
    if (o.pocketSquare) P.add('chest', prim('box'), o.pocketSquare, [0.12, 0.13, 0.122], [0.05, 0.03, 0.01]);
    // collar
    P.add('neck', prim('cyl'), o.shirt, [0, -0.01, 0.005], [0.065, 0.05, 0.065]);
    // buttons
    P.add('spine', prim('sphereLow'), 0x0e0e0e, [0, 0.16, 0.101], 0.009);
    P.add('spine', prim('sphereLow'), 0x0e0e0e, [0, 0.06, 0.101], 0.009);
  } else if (style === 'chef') {
    for (let i = 0; i < 3; i++) {
      P.add('chest', prim('sphereLow'), 0x202020, [0.06, 0.16 - i * 0.08, 0.121], 0.012);
      P.add('chest', prim('sphereLow'), 0x202020, [-0.06, 0.16 - i * 0.08, 0.121], 0.012);
    }
    P.add('neck', prim('cyl'), o.neckerchief ?? o.jacket, [0, -0.01, 0.005], [0.07, 0.05, 0.07]);
  } else if (style === 'overalls') {
    P.add('chest', prim('box'), o.pants, [0, 0.03, 0.118], [0.22, 0.18, 0.012]);
    P.add('chest', prim('box'), o.pants, [0.08, 0.14, 0.118], [0.035, 0.2, 0.012]);
    P.add('chest', prim('box'), o.pants, [-0.08, 0.14, 0.118], [0.035, 0.2, 0.012]);
    P.add('neck', prim('cyl'), o.shirt, [0, -0.01, 0.005], [0.066, 0.05, 0.066]);
  } else if (style === 'tactical') {
    P.add('chest', prim('rbox'), o.vestTac, [0, 0.07, 0], [shoulderW * bw + 0.04, 0.3, 0.28]);
    P.add('spine', prim('rbox'), o.vestTac, [0, 0.14, 0], [(shoulderW - 0.03) * bw, 0.2, 0.25]);
    P.add('neck', prim('cyl'), o.shirt, [0, -0.01, 0.005], [0.066, 0.05, 0.066]);
  }
  if (o.apron !== undefined) {
    P.add('hips', prim('box'), o.apron, [0, -0.2, 0.115], [0.34, 0.6, 0.015]);
    if (style === 'chef') P.add('spine', prim('box'), o.apron, [0, 0.13, 0.103], [0.28, 0.26, 0.012]);
  }
  if (o.vestTac === undefined && style === 'vest') {
    // vest shows shirt at shoulders
    P.add('chest', prim('box'), o.shirt, [0, 0.235, 0], [shoulderW * bw * 0.95, 0.03, 0.2]);
  }

  // Neck & head
  P.add('neck', prim('cyl'), skin, [0, 0.04, 0], [0.052, 0.12, 0.052]);
  const hs = female ? 0.105 : 0.112;
  P.add('head', prim('sphere'), skin, [0, 0.1, 0.005], [hs * 0.9, hs * 1.08, hs]);
  P.add('head', prim('rbox'), skin, [0, 0.045, 0.03], [hs * 1.3, 0.08, hs * 1.3]); // jaw
  P.add('head', prim('box'), skin, [0, 0.09, hs + 0.005], [0.028, 0.05, 0.035], [0.2, 0, 0]); // nose
  P.add('head', prim('sphereLow'), skin, [hs * 0.92, 0.1, 0], [0.018, 0.03, 0.022]);
  P.add('head', prim('sphereLow'), skin, [-hs * 0.92, 0.1, 0], [0.018, 0.03, 0.022]);
  P.add('head', prim('sphereLow'), 0x141210, [0.037, 0.118, hs * 0.86], 0.012);
  P.add('head', prim('sphereLow'), 0x141210, [-0.037, 0.118, hs * 0.86], 0.012);
  if (look.hairStyle !== 'bald') P.add('head', prim('box'), hair, [0.037, 0.142, hs * 0.9], [0.036, 0.008, 0.01]);
  if (look.hairStyle !== 'bald') P.add('head', prim('box'), hair, [-0.037, 0.142, hs * 0.9], [0.036, 0.008, 0.01]);
  P.add('head', prim('box'), female ? 0x9a4a4a : 0xa07060, [0, 0.055, hs * 0.93], [0.04, 0.008, 0.01]); // mouth

  // Hair
  const hsStyle = look.hairStyle;
  if (hsStyle !== 'bald' && !o.hat) {
    P.add('head', prim('hemi'), hair, [0, 0.105, -0.004], [hs * 0.97, hs * 1.12, hs * 1.06], [-0.25, 0, 0]);
    if (hsStyle === 'long') {
      P.add('head', prim('rbox'), hair, [0, 0.02, -0.075], [0.22, 0.32, 0.08]);
    } else if (hsStyle === 'bun') {
      P.add('head', prim('sphereLow'), hair, [0, 0.2, -0.085], 0.05);
    } else if (hsStyle === 'bob') {
      P.add('head', prim('rbox'), hair, [0, 0.06, -0.03], [0.24, 0.16, 0.2]);
    } else if (hsStyle === 'ponytail') {
      P.add('head', prim('sphereLow'), hair, [0, 0.14, -0.12], [0.04, 0.12, 0.04], [0.6, 0, 0]);
    }
  } else if (hsStyle !== 'bald' && o.hat) {
    P.add('head', prim('hemi'), hair, [0, 0.085, -0.01], [hs * 0.98, hs * 0.9, hs * 1.05], [-0.3, 0, 0]);
  }
  if (look.beard) {
    P.add('head', prim('rbox'), hair, [0, 0.035, 0.05], [0.15, 0.07, 0.12]);
  }
  if (look.mustache) P.add('head', prim('box'), hair, [0, 0.068, hs * 0.95], [0.06, 0.014, 0.012]);

  // Headwear
  if (o.hat === 'toque') {
    P.add('head', prim('cyl'), 0xf6f6f4, [0, 0.25, 0], [0.105, 0.14, 0.105]);
    P.add('head', prim('sphereLow'), 0xf6f6f4, [0, 0.34, 0], [0.13, 0.07, 0.13]);
  } else if (o.hat === 'bucket') {
    P.add('head', prim('cyl'), o.hatColor, [0, 0.2, 0], [0.16, 0.015, 0.16]);
    P.add('head', prim('cyl'), o.hatColor, [0, 0.245, 0], [0.11, 0.09, 0.11]);
  }
  if (o.cap !== undefined) {
    P.add('head', prim('hemi'), o.cap, [0, 0.14, 0], [0.118, 0.1, 0.122]);
    P.add('head', prim('box'), o.cap, [0, 0.16, 0.12], [0.16, 0.012, 0.09], [-0.15, 0, 0]);
  }
  if (o.glasses === 'shades') {
    P.add('head', prim('box'), 0x050505, [0, 0.12, hs * 0.93], [0.13, 0.03, 0.012]);
  } else if (o.glasses === 'round') {
    P.add('head', prim('cyl'), 0x2a2018, [0.037, 0.12, hs * 0.95], [0.022, 0.005, 0.022], [Math.PI / 2, 0, 0]);
    P.add('head', prim('cyl'), 0x2a2018, [-0.037, 0.12, hs * 0.95], [0.022, 0.005, 0.022], [Math.PI / 2, 0, 0]);
  }
  if (o.earpiece) P.add('head', prim('sphereLow'), 0x0a0a0a, [-hs * 0.98, 0.09, 0.01], 0.014);

  // Arms
  const handCol = o.gloves ?? skin;
  for (const side of ['l', 'r']) {
    const sx = side === 'l' ? 1 : -1;
    P.add(`${side}UpperArm`, prim('sphereLow'), torsoCol === undefined ? sleeve : dress ? skin : under ? skin : torsoCol, [0, -0.02, 0], [0.07, 0.07, 0.075]);
    P.add(`${side}UpperArm`, capsule(0.052, 0.18), sleeve, [0, -0.14, 0], 1);
    P.add(`${side}Forearm`, capsule(0.045, 0.16), sleeve, [0, -0.12, 0], 1);
    if (style === 'suit') P.add(`${side}Forearm`, prim('cyl'), o.shirt, [0, -0.225, 0], [0.047, 0.03, 0.047]);
    P.add(`${side}Hand`, prim('rbox'), handCol, [0, -0.055, 0.005], [0.065, 0.1, 0.035]);
    P.add(`${side}Hand`, prim('rbox'), handCol, [sx * -0.032, -0.03, 0.02], [0.025, 0.06, 0.025], [0, 0, sx * 0.4]);
  }

  // Legs
  for (const side of ['l', 'r']) {
    P.add(`${side}Thigh`, capsule(female && dress ? 0.066 : 0.076, 0.3), thighCol, [0, -0.21, 0], 1);
    P.add(`${side}Shin`, capsule(female && dress ? 0.05 : 0.06, 0.32), shinCol, [0, -0.21, 0], 1);
    if (female && dress) {
      P.add(`${side}Foot`, prim('rbox'), o.shoes, [0, -0.02, 0.04], [0.075, 0.06, 0.2], [0.12, 0, 0]);
    } else {
      P.add(`${side}Foot`, prim('rbox'), o.shoes, [0, -0.012, 0.045], [0.1, 0.075, 0.25]);
    }
  }
  if (under) {
    P.add('lThigh', prim('cyl'), o.pants, [0, -0.08, 0], [0.085, 0.14, 0.085]);
    P.add('rThigh', prim('cyl'), o.pants, [0, -0.08, 0], [0.085, 0.14, 0.085]);
  }
  if (dress) {
    const h = o.long ? 0.9 : 0.5;
    P.add('hips', prim('cone'), o.dress, [0, 0.07 - h / 2, 0], [0.33, h, 0.27]);
  }
  const merged = mergeGeometries(P.geos, false);
  return merged;
}

const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });
export const xrayMaterials = {
  target: new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }),
  guard: new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }),
  civilian: new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.25, depthTest: false, depthWrite: false }),
  enforcer: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }),
  body: new THREE.MeshBasicMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false }),
  item: new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }),
};

const POSE_BONES = BONE_DEFS.map((b) => b[0]);

export class Humanoid {
  constructor(outfitId, look = {}) {
    this.look = {
      skin: look.skin ?? 0xd8b090,
      hair: look.hair ?? 0x2a1e14,
      hairStyle: look.hairStyle ?? 'short',
      female: !!look.female,
      beard: !!look.beard,
      mustache: !!look.mustache,
      build: look.build ?? 1,
      height: look.height ?? 1,
    };
    this.bones = [];
    this.boneMap = {};
    for (const [name, parent, pos] of BONE_DEFS) {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(pos[0], pos[1], pos[2]);
      if (parent) this.boneMap[parent].add(b);
      this.bones.push(b);
      this.boneMap[name] = b;
    }
    this.skeleton = new THREE.Skeleton(this.bones);
    this.group = new THREE.Group();
    this.group.scale.setScalar(this.look.height);
    this.outfitId = null;
    this.mesh = null;
    this.xray = null;
    this.phase = Math.random() * Math.PI * 2;
    this.time = Math.random() * 10;
    // smoothed pose state
    this.cur = {};
    for (const n of POSE_BONES) this.cur[n] = new THREE.Euler();
    this.hipsY = 0.97;
    this.bodyRotX = 0;
    this.bodyY = 0;
    this.attachments = new Map();
    this.setOutfit(outfitId);
  }

  _boneWorldMatrices() {
    // rest-pose world matrices relative to the root
    const saved = this.bones.map((b) => b.quaternion.clone());
    this.bones.forEach((b) => b.quaternion.identity());
    const hipsSaved = this.boneMap.hips.position.y;
    const bodySaved = [this.boneMap.body.position.y];
    this.boneMap.hips.position.y = 0.97;
    this.boneMap.body.position.y = 0;
    this.bones[0].updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(this.bones[0].matrixWorld).invert();
    const mats = this.bones.map((b) => new THREE.Matrix4().multiplyMatrices(rootInv, b.matrixWorld));
    this.bones.forEach((b, i) => b.quaternion.copy(saved[i]));
    this.boneMap.hips.position.y = hipsSaved;
    this.boneMap.body.position.y = bodySaved[0];
    return mats;
  }

  setOutfit(outfitId) {
    if (outfitId === this.outfitId) return;
    this.outfitId = outfitId;
    const worlds = this._boneWorldMatrices();
    const geo = buildBodyGeometry(worlds, outfitId, this.look);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
      if (this.xray) this.xray.geometry = geo;
      this._fixBounds();
      return;
    }
    // Bind with bones at rest pose.
    const rootBone = this.bones[0];
    const mesh = new THREE.SkinnedMesh(geo, bodyMaterial);
    mesh.add(rootBone);
    const savedQ = this.bones.map((b) => b.quaternion.clone());
    this.bones.forEach((b) => b.quaternion.identity());
    mesh.updateMatrixWorld(true);
    this.skeleton.calculateInverses();
    mesh.bind(this.skeleton, new THREE.Matrix4());
    this.bones.forEach((b, i) => b.quaternion.copy(savedQ[i]));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    this._fixBounds();
  }

  _fixBounds() {
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
    this.mesh.geometry.boundingSphere = sphere;
    this.mesh.boundingSphere = sphere.clone();
    this.mesh.geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-2, -1, -2), new THREE.Vector3(2, 3, 2));
    this.mesh.boundingBox = this.mesh.geometry.boundingBox.clone();
    if (this.xray) {
      this.xray.boundingSphere = sphere.clone();
      this.xray.boundingBox = this.mesh.boundingBox.clone();
    }
  }

  // X-ray silhouette used by the "instinct" vision.
  setXray(kind) {
    if (!kind) {
      if (this.xray) this.xray.visible = false;
      return;
    }
    if (!this.xray) {
      this.xray = new THREE.SkinnedMesh(this.mesh.geometry, xrayMaterials[kind]);
      this.xray.bind(this.skeleton, this.mesh.bindMatrix);
      this.xray.renderOrder = 10;
      this.xray.frustumCulled = false;
      this.group.add(this.xray);
    }
    this.xray.material = xrayMaterials[kind];
    this.xray.visible = true;
  }

  attach(boneName, obj, key) {
    this.detach(key);
    this.boneMap[boneName].add(obj);
    this.attachments.set(key, obj);
  }

  detach(key) {
    const obj = this.attachments.get(key);
    if (obj) {
      obj.parent?.remove(obj);
      this.attachments.delete(key);
    }
  }

  hasAttachment(key) {
    return this.attachments.has(key);
  }

  // Animate. s = { speed, run, crouch, pose, lying, faceDown, sit, lookYaw, aimPitch }
  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const T = {};
    for (const n of POSE_BONES) T[n] = [0, 0, 0];
    const speed = s.speed ?? 0;
    const crouch = s.crouch ?? 0;
    const run = clamp((speed - 2.6) / 2.2, 0, 1);
    const moving = clamp(speed / 1.2, 0, 1);
    const stride = 1.3 + run * 1.0 - crouch * 0.4;
    this.phase += (speed / stride) * Math.PI * 2 * dt;
    const ph = this.phase;
    let hipsY = 0.97;

    // --- locomotion ---
    const legAmp = (0.42 + run * 0.4) * moving * (this.look.female && s.dress ? 0.7 : 1);
    const armAmp = (0.35 + run * 0.6) * moving;
    T.lThigh[0] = -Math.sin(ph) * legAmp;
    T.rThigh[0] = Math.sin(ph) * legAmp;
    T.lShin[0] = Math.max(0, Math.cos(ph)) * legAmp * 1.6 * moving + 0.05;
    T.rShin[0] = Math.max(0, -Math.cos(ph)) * legAmp * 1.6 * moving + 0.05;
    T.lFoot[0] = -Math.sin(ph) * 0.15 * moving;
    T.rFoot[0] = Math.sin(ph) * 0.15 * moving;
    T.lUpperArm[0] = Math.sin(ph) * armAmp;
    T.rUpperArm[0] = -Math.sin(ph) * armAmp;
    T.lUpperArm[2] = 0.08;
    T.rUpperArm[2] = -0.08;
    T.lForearm[0] = -0.15 - run * 1.2 - Math.max(0, Math.sin(ph)) * 0.3 * moving;
    T.rForearm[0] = -0.15 - run * 1.2 - Math.max(0, -Math.sin(ph)) * 0.3 * moving;
    T.spine[1] = Math.sin(ph) * 0.07 * moving;
    T.spine[0] = run * 0.18;
    T.chest[1] = -Math.sin(ph) * 0.05 * moving;
    hipsY -= Math.abs(Math.cos(ph)) * 0.035 * moving;
    // idle breathing
    T.chest[0] += Math.sin(t * 1.6) * 0.015;

    // --- crouch ---
    if (crouch > 0) {
      hipsY -= 0.36 * crouch;
      T.lThigh[0] += -0.95 * crouch;
      T.rThigh[0] += -0.95 * crouch;
      T.lShin[0] += 1.5 * crouch;
      T.rShin[0] += 1.5 * crouch;
      T.lFoot[0] += -0.5 * crouch;
      T.rFoot[0] += -0.5 * crouch;
      T.spine[0] += 0.35 * crouch;
      T.neck[0] -= 0.3 * crouch;
      T.lUpperArm[0] += -0.35 * crouch;
      T.rUpperArm[0] += -0.35 * crouch;
      T.lForearm[0] += -0.5 * crouch;
      T.rForearm[0] += -0.5 * crouch;
    }

    // --- sitting ---
    if (s.sit) {
      hipsY = 0.52;
      T.lThigh[0] = -1.5;
      T.rThigh[0] = -1.5;
      T.lShin[0] = 1.45;
      T.rShin[0] = 1.45;
      T.lFoot[0] = 0;
      T.rFoot[0] = 0;
      T.lUpperArm[0] = -0.4;
      T.rUpperArm[0] = -0.4;
      T.lForearm[0] = -0.9;
      T.rForearm[0] = -0.9;
      T.spine[0] = -0.05;
      T.spine[1] = 0;
      T.chest[1] = 0;
    }

    // --- upper-body poses ---
    const pose = s.pose;
    const aimPitch = s.aimPitch ?? 0;
    switch (pose) {
      case 'aim':
        T.rUpperArm[0] = -Math.PI / 2 + 0.05 - aimPitch;
        T.rUpperArm[2] = -0.05;
        T.rForearm[0] = -0.05;
        T.lUpperArm[0] = -Math.PI / 2 + 0.3 - aimPitch;
        T.lUpperArm[2] = -0.55;
        T.lForearm[0] = -0.5;
        T.chest[1] = 0.25;
        T.head[1] = -0.2;
        break;
      case 'pistolDown':
        T.rUpperArm[0] = -0.35;
        T.rForearm[0] = -0.6;
        break;
      case 'throw':
        T.rUpperArm[0] = -2.6;
        T.rForearm[0] = -0.6;
        break;
      case 'choke':
      case 'strangle':
        T.lUpperArm[0] = -1.2;
        T.rUpperArm[0] = -1.2;
        T.lUpperArm[2] = -0.35;
        T.rUpperArm[2] = 0.35;
        T.lForearm[0] = -1.1;
        T.rForearm[0] = -1.1;
        T.lForearm[1] = 0.6;
        T.rForearm[1] = -0.6;
        T.spine[0] += 0.2;
        break;
      case 'choked':
        T.lUpperArm[0] = -2.2 + Math.sin(t * 14) * 0.2;
        T.rUpperArm[0] = -2.2 + Math.cos(t * 13) * 0.2;
        T.lForearm[0] = -1.8;
        T.rForearm[0] = -1.8;
        T.lUpperArm[2] = 0.3;
        T.rUpperArm[2] = -0.3;
        T.neck[0] = -0.3;
        break;
      case 'drink': {
        const k = (Math.sin(t * 0.9) + 1) / 2;
        const up = k > 0.8 ? 1 : 0.35;
        T.rUpperArm[0] = -0.35 * up - 0.1;
        T.rUpperArm[2] = 0.15;
        T.rForearm[0] = -1.4 - up * 0.9;
        T.rForearm[1] = -0.3;
        break;
      }
      case 'phone':
        T.rUpperArm[0] = -0.35;
        T.rUpperArm[2] = -0.45;
        T.rForearm[0] = -2.5;
        T.rForearm[1] = 0.4;
        T.head[2] = 0.12;
        T.lUpperArm[0] = Math.sin(t * 0.7) * 0.1;
        break;
      case 'smoke': {
        const k = Math.sin(t * 0.6) > 0.6 ? 1 : 0.3;
        T.rUpperArm[0] = -0.3 * k - 0.1;
        T.rForearm[0] = -1.2 - k * 1.1;
        T.rForearm[1] = -0.3;
        T.lUpperArm[0] = -0.2;
        T.lForearm[0] = -1.3;
        T.lForearm[1] = -0.8;
        break;
      }
      case 'talk':
        T.lUpperArm[0] = -0.25 + Math.sin(t * 2.1) * 0.15;
        T.lForearm[0] = -0.9 + Math.sin(t * 2.7) * 0.3;
        T.rUpperArm[0] = -0.2 + Math.sin(t * 1.7 + 1) * 0.12;
        T.rForearm[0] = -0.8 + Math.sin(t * 2.3 + 2) * 0.35;
        T.head[1] = Math.sin(t * 0.8) * 0.15;
        T.head[0] = Math.sin(t * 2.2) * 0.05;
        break;
      case 'listen':
        T.lUpperArm[0] = -0.1;
        T.rUpperArm[0] = -0.3;
        T.rForearm[0] = -1.5;
        T.rForearm[1] = -0.3;
        T.head[0] = Math.sin(t * 1.3) * 0.04;
        break;
      case 'tray':
        T.lUpperArm[0] = -0.3;
        T.lUpperArm[2] = 0.15;
        T.lForearm[0] = -1.35;
        T.lForearm[1] = -0.2;
        T.rUpperArm[0] *= 0.5;
        break;
      case 'guard':
        T.lUpperArm[0] = -0.25;
        T.rUpperArm[0] = -0.25;
        T.lUpperArm[2] = -0.12;
        T.rUpperArm[2] = 0.12;
        T.lForearm[0] = -1.0;
        T.rForearm[0] = -1.0;
        T.lForearm[1] = 0.9;
        T.rForearm[1] = -0.9;
        break;
      case 'behindBack':
        T.lUpperArm[0] = 0.3;
        T.rUpperArm[0] = 0.3;
        T.lForearm[0] = -1.0;
        T.rForearm[0] = -1.0;
        T.lForearm[1] = -0.9;
        T.rForearm[1] = 0.9;
        break;
      case 'work':
        T.lUpperArm[0] = -0.6;
        T.rUpperArm[0] = -0.6 + Math.sin(t * 7) * 0.25;
        T.lForearm[0] = -0.9;
        T.rForearm[0] = -0.9;
        T.spine[0] += 0.2;
        break;
      case 'kneelWork':
        hipsY = 0.55;
        T.lThigh[0] = -1.6;
        T.rThigh[0] = 0.1;
        T.lShin[0] = 1.6;
        T.rShin[0] = 1.6;
        T.spine[0] = 0.5;
        T.lUpperArm[0] = -0.9 + Math.sin(t * 3) * 0.2;
        T.rUpperArm[0] = -0.9 + Math.cos(t * 3) * 0.2;
        T.lForearm[0] = -0.4;
        T.rForearm[0] = -0.4;
        break;
      case 'lookDown':
        T.lUpperArm[0] = -0.4;
        T.lForearm[0] = -1.4;
        T.rUpperArm[0] = -0.3;
        T.rForearm[0] = -1.2;
        T.neck[0] = 0.35;
        break;
      case 'surrender':
        T.lUpperArm[0] = -2.6;
        T.rUpperArm[0] = -2.6;
        T.lUpperArm[2] = 0.5;
        T.rUpperArm[2] = -0.5;
        T.lForearm[0] = -0.6;
        T.rForearm[0] = -0.6;
        break;
      case 'cower':
        hipsY = 0.55;
        T.lThigh[0] = -1.4;
        T.rThigh[0] = -1.4;
        T.lShin[0] = 2.0;
        T.rShin[0] = 2.0;
        T.lFoot[0] = -0.5;
        T.rFoot[0] = -0.5;
        T.spine[0] = 0.6;
        T.lUpperArm[0] = -2.3;
        T.rUpperArm[0] = -2.3;
        T.lForearm[0] = -1.9;
        T.rForearm[0] = -1.9;
        T.lUpperArm[2] = -0.2;
        T.rUpperArm[2] = 0.2;
        break;
      case 'vomit':
        T.spine[0] = 0.9 + Math.sin(t * 5) * 0.08;
        T.neck[0] = 0.3;
        T.lUpperArm[0] = -0.7;
        T.rUpperArm[0] = -0.7;
        T.lForearm[0] = -0.3;
        T.rForearm[0] = -0.3;
        T.lThigh[0] = -0.3;
        T.rThigh[0] = -0.3;
        T.lShin[0] = 0.4;
        T.rShin[0] = 0.4;
        hipsY = 0.9;
        break;
      case 'push':
        T.lUpperArm[0] = -1.5;
        T.rUpperArm[0] = -1.5;
        T.lForearm[0] = -0.1;
        T.rForearm[0] = -0.1;
        T.spine[0] += 0.3;
        break;
      case 'point':
        T.rUpperArm[0] = -1.5;
        T.rForearm[0] = -0.05;
        break;
      case 'drag':
        T.lUpperArm[0] = -0.9;
        T.rUpperArm[0] = -0.9;
        T.lForearm[0] = -0.3;
        T.rForearm[0] = -0.3;
        T.spine[0] = 0.4;
        hipsY -= 0.12;
        break;
      case 'reach':
        T.rUpperArm[0] = -1.1;
        T.rForearm[0] = -0.4;
        T.spine[0] += 0.25;
        break;
      case 'applaud': {
        const c = Math.sin(t * 14) * 0.12;
        T.lUpperArm[0] = -0.7;
        T.rUpperArm[0] = -0.7;
        T.lForearm[0] = -1.2;
        T.rForearm[0] = -1.2;
        T.lForearm[1] = 0.6 + c;
        T.rForearm[1] = -0.6 - c;
        break;
      }
      case 'piano':
        T.lUpperArm[0] = -0.6;
        T.rUpperArm[0] = -0.6;
        T.lForearm[0] = -0.9 + Math.sin(t * 6) * 0.08;
        T.rForearm[0] = -0.9 + Math.cos(t * 7) * 0.08;
        T.lUpperArm[2] = Math.sin(t * 1.5) * 0.1;
        T.rUpperArm[2] = Math.sin(t * 1.3) * 0.1;
        T.spine[0] = 0.1;
        break;
      case 'dragged':
        T.lUpperArm[0] = -2.9;
        T.rUpperArm[0] = -2.9;
        T.lUpperArm[2] = 0.25;
        T.rUpperArm[2] = -0.25;
        break;
      default:
        break;
    }

    // head look (relative yaw)
    if (s.lookYaw !== undefined) {
      T.head[1] += clamp(s.lookYaw, -1.1, 1.1) * 0.7;
      T.neck[1] += clamp(s.lookYaw, -1.1, 1.1) * 0.3;
    }
    if (s.lookPitch !== undefined) T.head[0] += clamp(s.lookPitch, -0.5, 0.5);

    // --- lying (unconscious / dead) ---
    const lying = s.lying ?? 0;
    let bodyRotX = 0;
    let bodyY = 0;
    if (lying > 0) {
      const dir = s.faceDown ? 1 : -1;
      bodyRotX = dir * (Math.PI / 2) * lying;
      bodyY = 0.13 * lying;
      if (pose !== 'dragged') {
        T.lUpperArm[0] = -0.3;
        T.rUpperArm[0] = 0.2;
        T.lUpperArm[2] = 0.7;
        T.rUpperArm[2] = -0.4;
        T.lForearm[0] = -0.6;
        T.rForearm[0] = -0.2;
      }
      T.lThigh[0] = -0.1;
      T.rThigh[0] = 0.15;
      T.lThigh[2] = 0.12;
      T.rThigh[2] = -0.05;
      T.lShin[0] = 0.4;
      T.rShin[0] = 0.1;
      T.head[1] = 0.6;
      T.neck[0] = 0;
      T.spine[0] = 0;
      T.spine[1] = 0;
      T.chest[0] = 0;
      T.chest[1] = 0;
      hipsY = 0.97;
    }

    // --- apply with damping ---
    const rate = s.snap ? 1 : 1 - Math.exp(-(s.blendRate ?? 16) * dt);
    for (const n of POSE_BONES) {
      const c = this.cur[n];
      const tg = T[n];
      c.x += (tg[0] - c.x) * rate;
      c.y += (tg[1] - c.y) * rate;
      c.z += (tg[2] - c.z) * rate;
      this.boneMap[n].rotation.copy(c);
    }
    this.hipsY += (hipsY - this.hipsY) * rate;
    this.boneMap.hips.position.y = this.hipsY;
    const lr = s.snap ? 1 : 1 - Math.exp(-(lying > 0 ? 7 : 10) * dt);
    this.bodyRotX += (bodyRotX - this.bodyRotX) * lr;
    this.bodyY += (bodyY - this.bodyY) * lr;
    this.boneMap.body.rotation.x = this.bodyRotX;
    this.boneMap.body.position.y = this.bodyY;
  }
}
