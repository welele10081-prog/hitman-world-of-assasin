import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

// Over-the-shoulder third-person camera with wall collision.
export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 1200);
    this.yaw = Math.PI;
    this.pitch = 0.18;
    this.dist = 3.4;
    this.curDist = 3.4;
    this.shoulder = 0.55;
    this.aimBlend = 0;
    this.pivot = new THREE.Vector3();
    this.sensitivity = 0.0022;
    this.shake = 0;
    this.override = null; // {pos, look} for cutscene-like framing
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt, target, { aiming = false, crouch = 0, hidden = false } = {}) {
    const input = this.game.input;
    const sens = this.sensitivity * (aiming ? 0.6 : 1);
    this.yaw -= input.mouseDX * sens;
    this.pitch = clamp(this.pitch + input.mouseDY * sens * (this.invertY ? -1 : 1), -0.95, 1.1);

    this.aimBlend = damp(this.aimBlend, aiming ? 1 : 0, 12, dt);
    const headY = 1.55 - crouch * 0.5;
    const desiredPivot = new THREE.Vector3(target.x, target.y + headY, target.z);
    this.pivot.x = damp(this.pivot.x, desiredPivot.x, 20, dt);
    this.pivot.z = damp(this.pivot.z, desiredPivot.z, 20, dt);
    this.pivot.y = damp(this.pivot.y, desiredPivot.y, 10, dt);

    const dist = hidden ? 1.6 : THREE.MathUtils.lerp(this.dist, 1.5, this.aimBlend);
    const shoulder = THREE.MathUtils.lerp(this.shoulder, 0.62, this.aimBlend);
    const fwd = this.forward;
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));

    // Shoulder offset first (collide), then pull back (collide).
    const col = this.game.collision;
    const shoulderPos = this.pivot.clone().addScaledVector(right, shoulder);
    const tS = col.segmentHit(this.pivot.x, this.pivot.y, this.pivot.z, shoulderPos.x, shoulderPos.y, shoulderPos.z, 'camera');
    const sPos = this.pivot.clone().addScaledVector(right, shoulder * Math.max(0, tS - 0.15));
    const back = sPos.clone().addScaledVector(fwd, -dist);
    const t = col.segmentHit(sPos.x, sPos.y, sPos.z, back.x, back.y, back.z, 'camera');
    const wanted = Math.max(0.35, dist * t - 0.25);
    this.curDist = wanted < this.curDist ? wanted : damp(this.curDist, wanted, 6, dt);
    const camPos = sPos.clone().addScaledVector(fwd, -this.curDist);
    // Keep above the floor and below interior ceilings.
    camPos.y = Math.max(camPos.y, 0.35);
    const ceiling = this.game.isIndoor(camPos.x, camPos.z);
    if (ceiling) camPos.y = Math.min(camPos.y, ceiling - 0.4);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      camPos.x += (Math.random() - 0.5) * this.shake * 0.2;
      camPos.y += (Math.random() - 0.5) * this.shake * 0.2;
    }

    this.camera.position.copy(camPos);
    const look = sPos.clone().addScaledVector(fwd, 10);
    this.camera.lookAt(look);
    const fov = THREE.MathUtils.lerp(62, 48, this.aimBlend);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // Ray from the camera through the screen centre.
  aimRay() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }
}
