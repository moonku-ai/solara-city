// Keyboard and mouse state. One place owns every listener so the game loop
// only ever reads plain fields: keys held, mouse deltas, clicks to consume.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.locked = false;

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    document.addEventListener('mousemove', (event) => {
      if (this.locked) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
  }

  held(code) {
    return this.keys.has(code);
  }
  wasPressed(code) {
    return this.pressed.has(code);
  }
  takeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
  takeClick() {
    const was = this.clicked;
    this.clicked = false;
    return was;
  }
  endFrame() {
    this.pressed.clear();
  }
  releasePointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
