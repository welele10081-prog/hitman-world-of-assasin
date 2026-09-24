import * as THREE from 'three';

// Hinged door placed in a wall opening.
// axis: 'x' when the wall runs along X (door plane is XY), 'z' when along Z.
export class Door {
  constructor(level, { x, z, axis = 'x', width = 1.1, height = 2.35, hinge = -1, swing = 1, locked = null, mat = 'darkWood', name = 'Дверь', glass = false }) {
    this.level = level;
    this.x = x;
    this.z = z;
    this.axis = axis;
    this.width = width;
    this.locked = locked; // key item id or null
    this.name = name;
    this.angle = 0;
    this.target = 0;
    this.openedByNpc = false;
    this.closeTimer = 0;
    this.swing = swing;

    const materials = level.game.materials;
    const pivot = new THREE.Group();
    const w = width - 0.04;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, height, 0.06), materials.get(glass ? 'glass' : mat));
    panel.castShadow = !glass;
    panel.receiveShadow = true;
    panel.position.set((w / 2) * -hinge, height / 2, 0);
    pivot.add(panel);
    if (!glass) {
      // raised panels + handle
      const inset = materials.get('cabinet');
      for (const y of [0.65, 1.7]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.75, 0.08), inset);
        p.position.set((w / 2) * -hinge, y, 0);
        pivot.add(p);
      }
    } else {
      const frame = materials.get('darkMetal');
      for (const [fx, fw] of [[0.03, 0.06], [w - 0.03, 0.06]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(fw, height, 0.08), frame);
        f.position.set(fx * -hinge, height / 2, 0);
        pivot.add(f);
      }
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.14), materials.get('brass'));
    handle.position.set((w - 0.1) * -hinge, 1.05, 0);
    pivot.add(handle);

    if (axis === 'x') {
      pivot.position.set(x + (hinge * width) / 2, 0, z);
    } else {
      pivot.position.set(x, 0, z + (hinge * width) / 2);
      pivot.rotation.y = Math.PI / 2;
    }
    this.baseRot = pivot.rotation.y;
    this.pivot = pivot;
    this.hinge = hinge;
    level.game.scene.add(pivot);

    const t = 0.12;
    if (axis === 'x') this.collider = level.collision.addBox(x - width / 2, z - t, x + width / 2, z + t, { h: height, tag: 'door' });
    else this.collider = level.collision.addBox(x - t, z - width / 2, x + t, z + width / 2, { h: height, tag: 'door' });
    if (glass) {
      this.collider.sight = false;
      this.collider.bullets = false;
    }
  }

  get isOpen() {
    return this.target > 0.5;
  }

  get center() {
    return { x: this.x, z: this.z };
  }

  open(byNpc = false) {
    this.target = 1;
    this.openedByNpc = byNpc;
    this.closeTimer = 3.5;
    this.level.game.audio?.play('door', this.center, 0.35);
  }

  close() {
    this.target = 0;
    this.level.game.audio?.play('door', this.center, 0.25);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open(false);
  }

  update(dt, characters) {
    const speed = 3.2;
    if (this.angle < this.target) this.angle = Math.min(this.target, this.angle + speed * dt);
    else if (this.angle > this.target) this.angle = Math.max(this.target, this.angle - speed * dt);
    this.pivot.rotation.y = this.baseRot + this.angle * (Math.PI / 2) * this.swing * this.hinge;
    this.collider.enabled = this.angle < 0.35;

    if (this.openedByNpc && this.target === 1) {
      let someoneNear = false;
      for (const c of characters) {
        if (c.isDown && !c.dragged) continue;
        const dx = c.pos.x - this.x;
        const dz = c.pos.z - this.z;
        if (dx * dx + dz * dz < 2.2 * 2.2) {
          someoneNear = true;
          break;
        }
      }
      if (someoneNear) this.closeTimer = 2.5;
      else {
        this.closeTimer -= dt;
        if (this.closeTimer <= 0) {
          this.target = 0;
          this.openedByNpc = false;
        }
      }
    }
    // Never close on top of someone.
    if (this.target === 0 && this.angle > 0) {
      for (const c of characters) {
        const dx = c.pos.x - this.x;
        const dz = c.pos.z - this.z;
        if (dx * dx + dz * dz < 0.9 * 0.9) {
          this.target = 1;
          this.closeTimer = 2;
          this.openedByNpc = true;
          break;
        }
      }
    }
  }
}

// A place to stash bodies and/or hide the player.
export class Container {
  constructor(level, { x, z, yaw = 0, kind = 'closet', capacity = 1, hidePlayer = false, name }) {
    this.level = level;
    this.x = x;
    this.z = z;
    this.yaw = yaw; // direction the opening faces
    this.kind = kind;
    this.capacity = capacity;
    this.hidePlayer = hidePlayer;
    this.name = name ?? { closet: 'Шкаф', dumpster: 'Мусорный контейнер', crate: 'Ящик', locker: 'Шкафчик', freezer: 'Морозильная камера', chest: 'Сундук' }[kind] ?? 'Контейнер';
    this.bodies = [];
    this.playerInside = false;
  }

  get front() {
    return { x: this.x + Math.sin(this.yaw) * 0.85, z: this.z + Math.cos(this.yaw) * 0.85 };
  }

  get full() {
    return this.bodies.length >= this.capacity;
  }
}
