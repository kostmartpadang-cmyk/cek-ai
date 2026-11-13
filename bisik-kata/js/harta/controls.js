const STICK_R = 52;
const STICK_SIZE = 128;
const RUN_AT = 0.82;
const YAW_TOUCH = 0.005;
const PITCH_TOUCH = 0.0035;
const PITCH_MOUSE = 0.0035;
const YAW_LOCK = 0.0026;
const PITCH_LOCK = 0.0022;
const MOVE_KEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createControls(opts = {}) {
  const root = opts.root || globalThis.document;
  const { touch, stick, knob, jumpBtn, sonarBtn, enabled } = opts;
  const win = (root && (root.defaultView || root.parentWindow)) || globalThis;
  const doc = (win && win.document) || root;
  const isTouch = !!((win.matchMedia && win.matchMedia('(pointer: coarse)').matches) || ((win.navigator && win.navigator.maxTouchPoints) || 0) > 0);

  let on = enabled === undefined ? true : !!enabled;
  let x = 0;
  let z = 0;
  let run = false;
  let dyaw = 0;
  let dpitch = 0;
  let wantJump = false;
  let wantSonar = false;
  let stickId = null;
  let lookId = null;
  let mouseLook = false;
  let lastMouse = null;
  let locked = false;
  let shiftRun = false;
  const ox = { cx: 0, cy: 0 };
  const ol = { x: 0, y: 0 };
  const keys = new Set();
  const cleanups = [];

  function bind(el, type, fn, addOpts) {
    if (!el || !el.addEventListener) return;
    el.addEventListener(type, fn, addOpts);
    cleanups.push(() => el.removeEventListener(type, fn, addOpts));
  }

  function placeStick(px, py) {
    if (!stick) return;
    stick.classList.remove('hidden');
    stick.style.left = Math.round(px - STICK_SIZE / 2) + 'px';
    stick.style.top = Math.round(py - STICK_SIZE / 2) + 'px';
  }

  function moveKnob(dx, dy) {
    if (!knob) return;
    knob.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
  }

  function hideStick() {
    if (stick) stick.classList.add('hidden');
    moveKnob(0, 0);
  }

  function beginStick(e) {
    stickId = e.pointerId;
    ox.cx = e.clientX;
    ox.cy = e.clientY;
    x = 0;
    z = 0;
    run = false;
    placeStick(e.clientX, e.clientY);
    moveKnob(0, 0);
    try {
      touch.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  function beginLook(e) {
    lookId = e.pointerId;
    ol.x = e.clientX;
    ol.y = e.clientY;
    try {
      touch.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  // Pointer lock hanya bisa diminta dari gestur; beberapa browser menolak pilihan input mentah.
  function requestLock() {
    if (!touch || !touch.requestPointerLock || doc.pointerLockElement === touch) return;
    const plain = () => {
      try {
        const p = touch.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (err) {}
    };
    try {
      const p = touch.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(plain);
    } catch (err) {
      plain();
    }
  }

  function releaseLock() {
    if (touch && doc.pointerLockElement === touch) {
      try {
        doc.exitPointerLock();
      } catch (err) {}
    }
  }

  function onLockChange() {
    locked = !!touch && doc.pointerLockElement === touch;
    if (!locked) {
      mouseLook = false;
      lastMouse = null;
    }
  }

  function onDown(e) {
    if (!on || !touch) return;
    if (e.pointerType === 'mouse') {
      mouseLook = true;
      lastMouse = { x: e.clientX, y: e.clientY };
      requestLock();
      return;
    }
    const w = touch.clientWidth || win.innerWidth || 1;
    if (stickId === null && e.clientX <= w * 0.45) beginStick(e);
    else if (lookId === null) beginLook(e);
  }

  function onMove(e) {
    if (!on || !touch) return;
    if (e.pointerType === 'mouse') {
      if (locked) {
        const mx = Number.isFinite(e.movementX) ? e.movementX : 0;
        const my = Number.isFinite(e.movementY) ? e.movementY : 0;
        dyaw += mx * YAW_LOCK;
        dpitch -= my * PITCH_LOCK;
        return;
      }
      if (!mouseLook || !lastMouse) return;
      dyaw += (e.clientX - lastMouse.x) * YAW_TOUCH;
      dpitch -= (e.clientY - lastMouse.y) * PITCH_MOUSE;
      lastMouse = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.pointerId === stickId) {
      const dx = e.clientX - ox.cx;
      const dy = e.clientY - ox.cy;
      const len = Math.hypot(dx, dy) || 1;
      const k = len > STICK_R ? STICK_R / len : 1;
      const sx = dx * k;
      const sy = dy * k;
      moveKnob(sx, sy);
      x = sx / STICK_R;
      z = -sy / STICK_R;
      const mag = Math.hypot(x, z);
      if (mag > 1) {
        x /= mag;
        z /= mag;
      }
      run = len / STICK_R > RUN_AT;
    } else if (e.pointerId === lookId) {
      dyaw += (e.clientX - ol.x) * YAW_TOUCH;
      dpitch -= (e.clientY - ol.y) * PITCH_TOUCH;
      ol.x = e.clientX;
      ol.y = e.clientY;
    }
  }

  function endPointer(e) {
    if (e.pointerType === 'mouse') {
      mouseLook = false;
      lastMouse = null;
      return;
    }
    if (e.pointerId === stickId) {
      stickId = null;
      x = 0;
      z = 0;
      run = false;
      hideStick();
    } else if (e.pointerId === lookId) lookId = null;
  }

  function onTouchEnd(e) {
    e.preventDefault();
  }

  function onCtx(e) {
    e.preventDefault();
  }

  function typing(t) {
    const tag = t && String(t.tagName).toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || !!(t && t.isContentEditable);
  }

  function onKey(e, down) {
    if (!on || e.repeat || typing(e.target)) return;
    const code = e.code || '';
    if (down && (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight'))
      e.preventDefault();
    if (MOVE_KEYS[code]) {
      if (down) keys.add(code);
      else keys.delete(code);
      return;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      shiftRun = down;
      return;
    }
    if (!down) return;
    if (code === 'Space') wantJump = true;
    else if (code === 'KeyE' || code === 'KeyF') wantSonar = true;
  }

  function press(btn, flag) {
    return (e) => {
      if (!on) return;
      if (e && e.pointerType !== undefined && e.pointerType !== 'mouse') e.preventDefault();
      if (flag === 'j') wantJump = true;
      else wantSonar = true;
      btn.classList.add('pressed');
    };
  }

  function release(btn) {
    return () => btn.classList.remove('pressed');
  }

  function swallow(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function resetAll() {
    keys.clear();
    shiftRun = false;
    stickId = null;
    lookId = null;
    mouseLook = false;
    lastMouse = null;
    x = 0;
    z = 0;
    run = false;
    hideStick();
  }

  bind(touch, 'pointerdown', onDown, { passive: false });
  bind(touch, 'pointermove', onMove, { passive: false });
  bind(touch, 'pointerup', endPointer, { passive: false });
  bind(touch, 'pointercancel', endPointer, { passive: false });
  bind(touch, 'lostpointercapture', endPointer, { passive: false });
  bind(touch, 'touchend', onTouchEnd, { passive: false });
  bind(touch, 'contextmenu', onCtx, { passive: false });
  bind(doc, 'pointerlockchange', onLockChange);
  bind(win, 'blur', resetAll);
  bind(doc, 'keydown', (e) => onKey(e, true), { passive: false });
  bind(doc, 'keyup', (e) => onKey(e, false), { passive: false });

  [[jumpBtn, 'j'], [sonarBtn, 's']].forEach(([btn, flag]) => {
    if (!btn) return;
    bind(btn, 'pointerdown', press(btn, flag), { passive: false });
    bind(btn, 'pointerup', release(btn));
    bind(btn, 'pointerleave', release(btn));
    bind(btn, 'pointercancel', release(btn));
    bind(btn, 'click', swallow);
  });

  return {
    isTouch,
    read() {
      if (!on) return { x: 0, z: 0, run: false, moving: false };
      let mx = x;
      let mz = z;
      let mr = run || shiftRun;
      if (keys.size) {
        let kx = 0;
        let kz = 0;
        for (const c in MOVE_KEYS) {
          if (!keys.has(c)) continue;
          kx += MOVE_KEYS[c][0];
          kz += MOVE_KEYS[c][1];
        }
        if (kx || kz) {
          const len = Math.hypot(kx, kz) || 1;
          mx = kx / len;
          mz = kz / len;
        }
      }
      if (!Number.isFinite(mx)) mx = 0;
      if (!Number.isFinite(mz)) mz = 0;
      const mag = Math.hypot(mx, mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }
      return { x: mx, z: mz, run: !!mr, moving: mag > 0.08 };
    },
    consumeLook() {
      const o = { yaw: on ? dyaw : 0, pitch: on ? dpitch : 0 };
      dyaw = 0;
      dpitch = 0;
      return o;
    },
    consumeJump() {
      const v = on && wantJump;
      wantJump = false;
      return v;
    },
    consumeSonar() {
      const v = on && wantSonar;
      wantSonar = false;
      return v;
    },
    setEnabled(next) {
      on = !!next;
      if (!on) {
        releaseLock();
        resetAll();
        dyaw = 0;
        dpitch = 0;
        wantJump = false;
        wantSonar = false;
        if (jumpBtn) jumpBtn.classList.remove('pressed');
        if (sonarBtn) sonarBtn.classList.remove('pressed');
      }
    },
    destroy() {
      releaseLock();
      while (cleanups.length) cleanups.pop()();
    },
  };
}
