import * as THREE from 'three';
import { Humanoid } from './Humanoid.js';
import { OUTFITS } from './Outfits.js';
import { approachAngle, wrapAngle } from '../core/util.js';

let NEXT_ID = 1;

// Shared base for the player and NPCs: position, facing, collision, model.
export class Character {
  constructor(game, { outfit, look, name, x = 0, z = 0, yaw = 0 }) {
    this.game = game;
    this.id = NEXT_ID++;
    this.name = name ?? '';
    this.pos = new THREE.Vector3(x, 0, z);
    this.prevPos = this.pos.clone();
    this.yaw = yaw;
    this.radius = 0.32;
    this.speed = 0; // actual speed (m/s) this frame, for animation
    this.moveVel = new THREE.Vector3();
    this.outfit = outfit;
    this.model = new Humanoid(outfit, look);
    this.model.group.position.copy(this.pos);
    this.model.group.rotation.y = yaw;
    game.scene.add(this.model.group);
    this.alive = true;
    this.conscious = true;
    this.health = 100;
    this.crouch = 0;
    this.anim = { speed: 0, crouch: 0, pose: null, lying: 0, faceDown: false };
    this.collides = true;
    this.hidden = false; // e.g. stuffed in a container
  }

  get disguise() {
    return OUTFITS[this.outfit].disguise;
  }

  get isDown() {
    return !this.alive || !this.conscious;
  }

  setOutfit(outfit) {
    this.outfit = outfit;
    this.model.setOutfit(outfit);
  }

  // Walk toward a direction with a desired speed; turns smoothly.
  moveDir(dx, dz, speed, dt, turnRate = 10) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5 || speed <= 0) return;
    dx /= len;
    dz /= len;
    this.pos.x += dx * speed * dt;
    this.pos.z += dz * speed * dt;
    const target = Math.atan2(dx, dz);
    this.yaw = approachAngle(this.yaw, target, turnRate * dt);
  }

  faceTowards(x, z, dt, rate = 6) {
    const target = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw = approachAngle(this.yaw, target, rate * dt);
    return Math.abs(wrapAngle(target - this.yaw));
  }

  faceYaw(yaw, dt, rate = 6) {
    this.yaw = approachAngle(this.yaw, yaw, rate * dt);
  }

  resolveCollision() {
    if (!this.collides) return;
    this.game.collision.resolveCircle(this.pos, this.radius);
  }

  eyeHeight() {
    return 1.62 - this.crouch * 0.55;
  }

  // Height of the chest point used as the visibility target.
  chestHeight() {
    if (this.isDown) return 0.25;
    return 1.3 - this.crouch * 0.5;
  }

  syncModel(dt) {
    const g = this.model.group;
    g.position.copy(this.pos);
    g.rotation.y = this.yaw;
    const moved = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z);
    const inst = dt > 0 ? moved / dt : 0;
    this.speed += (Math.min(inst, 7) - this.speed) * Math.min(1, dt * 10);
    this.prevPos.copy(this.pos);
    this.anim.speed = this.speed;
    this.model.update(dt, this.anim);
  }

  dispose() {
    this.game.scene.remove(this.model.group);
  }
}
