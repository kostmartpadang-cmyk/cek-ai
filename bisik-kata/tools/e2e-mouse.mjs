// Uji jalur mouse mode harta di layar laptop: sekali klik mengunci kursor ke layar lomba, setelah itu
// kamera mengikuti gerakan mouse tanpa perlu menahan tombol (pointer lock gaya game tembak-tembakan).

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const PORT = 9482;
const W = 1280;
const H = 760;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Tab {
  constructor(port) {
    this.port = port;
    this.id = 1;
    this.waiters = new Map();
    this.errors = [];
    this.cx = Math.round(W / 2);
    this.cy = Math.round(H / 2);
  }
  async connect() {
    const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.waiters.has(msg.id)) {
        const { res, rej } = this.waiters.get(msg.id);
        this.waiters.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown')
        this.errors.push('EX: ' + (msg.params.exceptionDetails.exception?.description || msg.params.text));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
        this.errors.push('CON: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((res, rej) => {
      this.waiters.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }
  mouse(type, x, y, extra = {}) {
    const params = { type, x, y, ...extra };
    if (type === 'mousePressed' || type === 'mouseReleased') {
      params.button = 'left';
      params.clickCount = 1;
    }
    return this.send('Input.dispatchMouseEvent', params);
  }
  async click() {
    await this.mouse('mousePressed', this.cx, this.cy);
    await this.mouse('mouseReleased', this.cx, this.cy);
  }
  // Saat terkunci, halaman membaca movementX/movementY dari selisih posisi mouse yang dilaporkan.
  async move(dx, dy, steps = 5) {
    for (let i = 0; i < steps; i++) {
      this.cx += Math.round(dx / steps);
      this.cy += Math.round(dy / steps);
      await this.mouse('mouseMoved', this.cx, this.cy);
    }
  }
  // Pastikan posisi penunjuk ada di tengah layar sebelum mengklik (HUD menempel di tepi).
  recenter() {
    return this.move(Math.round(W / 2) - this.cx, Math.round(H / 2) - this.cy, 4);
  }
  cam() {
    return this.eval(`(() => { const d = HARTA.dbg(); return d ? [d.yaw, d.pitch].join('/') : 'none'; })()`);
  }
}

async function until(tab, expr, timeout = 30000, every = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await tab.eval(expr)) return true;
    } catch (e) {
      /* modul belum terpasang */
    }
    await sleep(every);
  }
  return false;
}
function launch(port) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-mouse-'));
  return spawn(
    CHROME,
    ['--headless=new', '--no-sandbox', '--mute-audio', '--no-first-run', `--window-size=${W},${H}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: 'ignore' },
  );
}

const procs = [launch(PORT)];
async function waitPort(p) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    try {
      if ((await fetch(`http://127.0.0.1:${p}/json/version`)).ok) return;
    } catch (e) {}
    await sleep(1000);
  }
  throw new Error('chrome not ready');
}
await waitPort(PORT);
const A = new Tab(PORT);
await A.connect();

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
};
const num = async (tab) => {
  const s = await tab.cam();
  const [yaw, pitch] = String(s).split('/').map(Number);
  return { yaw, pitch, ok: s !== 'none' && Number.isFinite(yaw) && Number.isFinite(pitch) };
};

try {
  await A.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await A.goto(BASE);
  await A.send('Page.bringToFront');

  check(
    'tab terdeteksi layar laptop (bukan sentuh)',
    (await A.eval(`matchMedia('(pointer: coarse)').matches + '/' + navigator.maxTouchPoints`)) === 'false/0',
  );

  await A.eval(`document.getElementById('modeHarta').click(); 1`);
  let inLobby = false;
  for (let attempt = 1; attempt <= 5 && !inLobby; attempt++) {
    // Nama ditulis ulang setiap percobaan: app.js mengisi kolomnya dari localStorage saat modulnya
    // baru siap, yang bisa terjadi sesudah ketikan pertama kita.
    await A.eval(`document.getElementById('name').value='Awi'; document.getElementById('create').click(); 1`);
    inLobby = await until(A, `!document.getElementById('lobby').classList.contains('hidden')`, 30000);
    if (!inLobby) {
      console.log('  percobaan kamar ' + attempt + ' gagal: ' + (await A.eval(`[document.getElementById('busyTxt').textContent, document.getElementById('homeErr').textContent].join(' / ')`)));
      await A.eval(`document.getElementById('busyCancel').click(); 1`);
      await sleep(2000 * attempt);
    }
  }
  if (!inLobby) throw new Error('tidak bisa membuat kamar (signaling bermasalah)');

  await A.eval(
    `(async () => { const m = await import('/js/harta/logic.js'); const st = HARTA.state(); m.addPlayer(st, { id: 'pemburu-karet', name: 'Bil', now: Date.now() }); return 1; })()`,
    true,
  );
  await until(A, `!document.getElementById('start').disabled`, 5000, 150);
  await A.eval(`document.getElementById('start').click(); 1`);
  const started = await until(A, `HARTA.view() && HARTA.view().race && HARTA.view().race.status === 'running'`, 40000);
  check('layar balapan 3D berjalan di tab mouse', started === true);
  if (!started) throw new Error('balapan tidak jalan');

  check('kursor masih bebas sebelum diklik', (await A.eval(`document.pointerLockElement ? 'terkunci' : 'bebas'`)) === 'bebas');

  // 1) Mouse digerakkan tanpa tombol: kamera tidak boleh bergerak (tak ada lompatan sudut yang aneh).
  const idle0 = await num(A);
  await A.move(300, 120);
  await sleep(400);
  const idle1 = await num(A);
  check('gerak mouse tanpa klik tidak memutar kamera', Math.abs(idle1.yaw - idle0.yaw) < 0.01 && Math.abs(idle1.pitch - idle0.pitch) < 0.01);
  await A.recenter();

  // 2) Sekali klik: kursor hilang, kamera ikut mouse.
  await A.click();
  const lockEl = await A.eval(`document.pointerLockElement ? (document.pointerLockElement.id || 'lain') : ''`);
  check('klik mengunci kursor ke layar lomba', lockEl === 'hrTouch', 'pointerLockElement=' + lockEl);

  const yawA = (await num(A)).yaw;
  await A.move(400, 0);
  await sleep(400);
  const c1 = await num(A);
  check('kamera berputar 1:1 tanpa menahan tombol', Math.abs(c1.yaw - yawA) > 0.5, 'berputar ' + Math.abs(c1.yaw - yawA).toFixed(2) + ' rad');

  // 3) Delta dihabiskan sekali pakai: layar diam = kamera diam.
  await sleep(600);
  const c2 = await num(A);
  check('kamera diam saat mouse diam', Math.abs(c2.yaw - c1.yaw) < 0.01, 'sisa ' + Math.abs(c2.yaw - c1.yaw).toFixed(4) + ' rad');

  // 4) Arah atas-bawah mendongak/tunduk, dan tetap terkurung di batasnya.
  await A.move(0, 350, 6);
  await sleep(400);
  const down = await num(A);
  check('gerak vertikal mengubah sudut pandang', Math.abs(down.pitch - c2.pitch) > 0.05, 'pitch ' + down.pitch.toFixed(2));
  check('mentok di batas menunduk', down.pitch > 1.1 && down.pitch <= 1.16, 'pitch ' + down.pitch.toFixed(2));
  await A.move(0, -700, 8);
  await sleep(400);
  const up = await num(A);
  check('mentok di batas mendongak', up.pitch < -0.15 && up.pitch >= -0.23, 'pitch ' + up.pitch.toFixed(2));
  check(
    'yaw & pitch tetap angka normal',
    up.ok && Math.abs(up.yaw) < 1e6,
    JSON.stringify({ yaw: +up.yaw.toFixed(2), pitch: +up.pitch.toFixed(2) }),
  );

  // 5) Lepas kunci: kursor bebas lagi dan gerakan mouse tidak lagi menggerakkan kamera.
  const yawLock = (await num(A)).yaw;
  await A.eval(`document.exitPointerLock(); 1`);
  await until(A, `!document.pointerLockElement`, 5000, 100);
  const released = await A.eval(`document.pointerLockElement ? 'terkunci' : 'bebas'`);
  await A.recenter();
  await A.move(300, 0);
  await sleep(400);
  const yawFree = (await num(A)).yaw;
  check('lepas kunci mengembalikan kursor', released === 'bebas');
  check('setelah lepas kunci kamera tidak ikut mouse', Math.abs(yawFree - yawLock) < 0.01, 'berputar ' + Math.abs(yawFree - yawLock).toFixed(3) + ' rad');

  // 6) Klik lagi mengunci lagi.
  await A.click();
  const relocked = await until(A, `document.pointerLockElement && document.pointerLockElement.id === 'hrTouch'`, 4000, 100);
  check('klik kedua mengunci kembali', relocked === true);

  // 7) Meninggalkan layar lomba wajib melepas kunci (kalau tidak, kursor hilang di menu).
  await sleep(300);
  await A.eval(`document.getElementById('leave').click(); 1`);
  await sleep(1500);
  const afterLeave = await A.eval(`[document.pointerLockElement ? 'terkunci' : 'bebas', ['home','race'].filter(n => !document.getElementById(n).classList.contains('hidden')).join(',')].join('/')`);
  check('keluar dari layar lomba melepas kunci', afterLeave === 'bebas/home', afterLeave);

  console.log('errors: ' + JSON.stringify(A.errors.slice(0, 5)));
  check('tidak ada error runtime di jalur mouse', A.errors.length === 0);
} catch (e) {
  failed++;
  console.log('ERROR E2E MOUSE: ' + e.message + ' | errors: ' + JSON.stringify(A.errors.slice(0, 4)));
}
console.log(failed === 0 ? '\nE2E MOUSE: SEMUA LULUS' : `\nE2E MOUSE: ${failed} MASALAH`);
for (const p of procs) p.kill('SIGTERM');
process.exit(failed === 0 ? 0 : 1);
