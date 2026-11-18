// NEON HARBOR — touch controls for the playtest build (phones/tablets only).
// Desktop is untouched: this module activates solely on touch devices and
// drives the exact same input state the keyboard uses — G.keys for held
// keys (read by readInput() in main.js) and the real keydown handler for E.
export function isTouchDevice() {
  return 'ontouchstart' in window ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

export function initTouch(G) {
  if (!isTouchDevice()) return;
  document.body.classList.add('touch');

  const ui = document.createElement('div');
  ui.id = 'touchui';
  ui.innerHTML =
    '<div id="stick"><div id="knob"></div></div>' +
    '<div id="btns">' +
    '<button class="tbtn" id="btnRun">RUN</button>' +
    '<button class="tbtn" id="btnJump">JUMP</button>' +
    '<button class="tbtn" id="btnF">F</button>' +
    '<button class="tbtn" id="btnE">E</button>' +
    '</div>';
  document.getElementById('app').appendChild(ui);
  ui.addEventListener('contextmenu', (e) => e.preventDefault());

  const stick = ui.querySelector('#stick');
  const knob = ui.querySelector('#knob');
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const clearMove = () => { for (const c of MOVE_KEYS) G.keys[c] = false; };

  // ---- virtual joystick: 8-way digital, same flags as WASD ----
  let stickId = null;
  const setStick = (dx, dy) => {
    const R = 40;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    const kx = (dx / len) * cl, ky = (dy / len) * cl;
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const nx = dx / R, ny = dy / R;
    G.keys.KeyW = ny < -0.4;
    G.keys.KeyS = ny > 0.4;
    G.keys.KeyA = nx < -0.4;
    G.keys.KeyD = nx > 0.4;
  };
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickId = t.identifier;
    const r = stick.getBoundingClientRect();
    setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      const r = stick.getBoundingClientRect();
      setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
    }
  }, { passive: false });
  const stickEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      stickId = null;
      clearMove();
      knob.style.transform = 'translate(-50%, -50%)';
    }
  };
  stick.addEventListener('touchend', stickEnd);
  stick.addEventListener('touchcancel', stickEnd);

  // ---- hold buttons: set the same key flags the keyboard sets ----
  const holdBtn = (id, code) => {
    const el = ui.querySelector(id);
    const on = (e) => { e.preventDefault(); el.classList.add('on'); G.keys[code] = true; };
    const off = (e) => { e.preventDefault(); el.classList.remove('on'); G.keys[code] = false; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
  };
  holdBtn('#btnRun', 'ShiftLeft');
  holdBtn('#btnJump', 'Space');
  holdBtn('#btnF', 'KeyF');

  // ---- E button: fire the game's own keydown handler (enter/exit car) ----
  const btnE = ui.querySelector('#btnE');
  btnE.addEventListener('touchstart', (e) => {
    e.preventDefault();
    btnE.classList.add('on');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  }, { passive: false });
  const eOff = (e) => { e.preventDefault(); btnE.classList.remove('on'); };
  btnE.addEventListener('touchend', eOff, { passive: false });
  btnE.addEventListener('touchcancel', eOff, { passive: false });

  // ---- camera: drag on the right half of the scene rotates cam.yaw ----
  const canvas = document.getElementById('scene');
  let camId = null, camX = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (G.state !== 'playing') return;
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth / 2 && camId === null) {
        camId = t.identifier; camX = t.clientX;
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== camId) continue;
      G.cam.yaw -= (t.clientX - camX) * 0.006;
      camX = t.clientX;
      e.preventDefault();
    }
  }, { passive: false });
  const camEnd = (e) => {
    for (const t of e.changedTouches) if (t.identifier === camId) camId = null;
  };
  canvas.addEventListener('touchend', camEnd);
  canvas.addEventListener('touchcancel', camEnd);

  // ---- show the controls only while playing; never leave keys stuck ----
  setInterval(() => {
    const playing = G.state === 'playing';
    ui.style.display = playing ? 'block' : 'none';
    if (!playing) {
      clearMove();
      G.keys.ShiftLeft = false; G.keys.Space = false; G.keys.KeyF = false;
      knob.style.transform = 'translate(-50%, -50%)';
      stickId = null; camId = null;
    }
  }, 150);
}
