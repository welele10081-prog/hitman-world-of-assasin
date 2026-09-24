// Keyboard / mouse state with per-frame "pressed" and "released" edges.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.mouseButtons = new Set();
    this.mousePressed = new Set();
    this.mouseReleased = new Set();
    this.locked = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ControlLeft', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.pressedSet.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseButtons.clear();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button);
      this.mouseReleased.add(e.button);
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* ignored: pointer lock is optional */
      }
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.enabled && this.down.has(code);
  }
  pressed(code) {
    return this.enabled && this.pressedSet.has(code);
  }
  released(code) {
    return this.enabled && this.releasedSet.has(code);
  }
  mouseDown(b) {
    return this.enabled && this.mouseButtons.has(b);
  }
  mouseClicked(b) {
    return this.enabled && this.mousePressed.has(b);
  }
  mouseUp(b) {
    return this.enabled && this.mouseReleased.has(b);
  }

  // Called at the end of every frame.
  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
