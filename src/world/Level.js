import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { LevelBuilder } from './LevelBuilder.js';
import { NavGrid } from './NavGrid.js';
import { Door, Container } from './Door.js';

// Runtime level: geometry, lights, zones, doors, containers and named points.
export class Level {
  constructor(game) {
    this.game = game;
    this.collision = game.collision;
    this.builder = new LevelBuilder(game.scene, game.materials, game.collision);
    this.zones = [];
    this.doors = [];
    this.containers = [];
    this.points = new Map();
    this.lights = [];
    this.exits = [];
    this.bounds = { minX: -64, minZ: -50, maxX: 64, maxZ: 50 };
    this.mapWalls = []; // rectangles drawn on the minimap
  }

  point(name) {
    const p = this.points.get(name);
    if (!p) throw new Error(`Unknown point ${name}`);
    return p;
  }

  addPoint(name, x, z, yaw = 0) {
    this.points.set(name, { x, z, yaw, name });
  }

  addZone(id, name, rects, { allowed = null, hostile = false } = {}) {
    const zone = { id, name, rects, allowed: allowed ? new Set(allowed) : null, hostile, priority: this.zones.length };
    this.zones.push(zone);
    return zone;
  }

  zoneAt(x, z) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      for (const r of zn.rects) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return zn;
    }
    return null;
  }

  // Is the given disguise allowed at (x,z)? Returns {allowed, zone}.
  accessAt(x, z, disguise) {
    const zone = this.zoneAt(x, z);
    if (!zone || !zone.allowed) return { allowed: true, zone };
    return { allowed: zone.allowed.has(disguise), zone };
  }

  addDoor(opts) {
    const d = new Door(this, opts);
    this.doors.push(d);
    return d;
  }

  addContainer(opts) {
    const c = new Container(this, opts);
    this.containers.push(c);
    return c;
  }

  addLight(x, y, z, color = 0xffc98a, intensity = 12, distance = 14) {
    const l = new THREE.PointLight(color, intensity * 0.35, distance, 2);
    l.position.set(x, y, z);
    this.game.scene.add(l);
    this.lights.push(l);
    return l;
  }

  addExit(id, name, x, z, radius = 1.5) {
    this.exits.push({ id, name, x, z, radius });
  }

  // Sky, sun, fog, water and ground plane.
  buildEnvironment({ sunElevation = 6, sunAzimuth = 215 } = {}) {
    const scene = this.game.scene;
    const renderer = this.game.renderer.renderer;

    const sky = new Sky();
    sky.scale.setScalar(4500);
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.85;
    const phi = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunDir);
    scene.add(sky);
    this.sky = sky;

    // Environment map from the sky for reflections.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyClone = new Sky();
    skyClone.scale.setScalar(4500);
    for (const k of Object.keys(u)) skyClone.material.uniforms[k].value = u[k].value;
    envScene.add(skyClone);
    const env = pmrem.fromScene(envScene, 0.02);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.3;

    scene.fog = new THREE.FogExp2(0xc8a890, 0.0026);

    const sun = new THREE.DirectionalLight(0xffb070, 2.6);
    sun.position.copy(sunDir).multiplyScalar(80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -38;
    sc.right = 38;
    sc.top = 38;
    sc.bottom = -38;
    sc.near = 1;
    sc.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    this.sunDir = sunDir.clone();

    const hemi = new THREE.HemisphereLight(0x8aa4c8, 0x4a3a2a, 0.55);
    scene.add(hemi);

    // Lake
    const waterGeo = new THREE.PlaneGeometry(900, 500);
    const water = new Water(waterGeo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: this.game.materials.textures.waterNormals(),
      sunDirection: sunDir.clone(),
      sunColor: 0xffc890,
      waterColor: 0x0e2a36,
      distortionScale: 2.2,
      fog: true,
      alpha: 0.95,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.45, 28 + 250);
    scene.add(water);
    this.water = water;

    // Distant mountains ringing the lake
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 1, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.9, flatShading: true });
    const rnd = (i) => (Math.sin(i * 91.7) * 43758.5453) % 1;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 460 + Math.abs(rnd(i)) * 200;
      const h = 110 + Math.abs(rnd(i + 7)) * 170;
      const g = new THREE.ConeGeometry(110 + Math.abs(rnd(i + 3)) * 90, h, 6 + (i % 3), 1);
      const m = new THREE.Mesh(g, mtnMat);
      m.position.set(Math.cos(a) * r, h / 2 - 12, Math.sin(a) * r + 60);
      m.rotation.y = rnd(i + 11) * 3;
      scene.add(m);
      if (h > 170) {
        const sg = new THREE.ConeGeometry((110 + Math.abs(rnd(i + 3)) * 90) * 0.3, h * 0.3, 6 + (i % 3), 1);
        const s = new THREE.Mesh(sg, snowMat);
        s.position.set(m.position.x, m.position.y + h * 0.36, m.position.z);
        s.rotation.y = m.rotation.y;
        scene.add(s);
      }
    }

    // Terrain outside the estate (land north of the shore line).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), this.game.materials.get('grass'));
    ground.geometry.attributes.uv.array.forEach((v, i, arr) => (arr[i] = v * 100));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, 28 - 100);
    ground.receiveShadow = true;
    scene.add(ground);
    // Embankment face under the shore edge
    const bank = new THREE.Mesh(new THREE.BoxGeometry(400, 1.2, 1), this.game.materials.get('stoneWall'));
    bank.position.set(0, -0.6, 28.5);
    bank.receiveShadow = true;
    scene.add(bank);
  }

  buildNav() {
    const b = this.bounds;
    this.nav = new NavGrid(b.minX, b.minZ, b.maxX, b.maxZ, 0.5);
    this.nav.build(this.collision, 0.3);
  }

  update(dt, characters) {
    for (const d of this.doors) d.update(dt, characters);
    if (this.water) this.water.material.uniforms.time.value += dt * 0.4;
    // Keep the shadow frustum centred on the player.
    const p = this.game.player?.pos;
    if (p && this.sun) {
      const snap = 2;
      const cx = Math.round(p.x / snap) * snap;
      const cz = Math.round(p.z / snap) * snap;
      this.sun.target.position.set(cx, 0, cz);
      this.sun.position.set(cx + this.sunDir.x * 80, this.sunDir.y * 80, cz + this.sunDir.z * 80);
    }
  }
}
