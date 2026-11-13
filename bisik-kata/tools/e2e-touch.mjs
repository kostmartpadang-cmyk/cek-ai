// Uji jalur sentuh (touch) mode harta: satu Chrome disetel sebagai ponsel, pemain kedua
// disuntik lewat logic.addPlayer (API asli) supaya tidak bergantung pada negosiasi WebRTC.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Tab {
  constructor(port) {
    this.port = port;
    this.id = 1;
    this.waiters = new Map();
    this.errors = [];
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
  touch(type, points) {
    return this.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y })) });
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
  const dir = mkdtempSync(join(tmpdir(), 'cdp-touch-'));
  return spawn(
    CHROME,
    ['--headless=new', '--no-sandbox', '--mute-audio', '--no-first-run', '--window-size=420,780', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: 'ignore' },
  );
}

const procs = [launch(9481)];
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
await waitPort(9481);
const A = new Tab(9481);
await A.connect();

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
};

try {
  await A.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await A.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 780, deviceScaleFactor: 2, mobile: true });
  await A.goto(BASE);

  check('tab terdeteksi perangkat sentuh', (await A.eval(`matchMedia('(pointer: coarse)').matches + '/' + navigator.maxTouchPoints`)).endsWith('/5'));

  await A.eval(`document.getElementById('modeHarta').click(); document.getElementById('name').value='Awi'; 1`);
  let inLobby = false;
  for (let attempt = 1; attempt <= 3 && !inLobby; attempt++) {
    await A.eval(`document.getElementById('create').click(); 1`);
    inLobby = await until(A, `!document.getElementById('lobby').classList.contains('hidden')`, 30000);
    if (!inLobby) {
      console.log('  percobaan kamar ' + attempt + ' gagal: ' + (await A.eval(`[document.getElementById('busyTxt').textContent, document.getElementById('homeErr').textContent].join(' / ')`)));
      await A.eval(`document.getElementById('busyCancel').click(); 1`);
      await sleep(1500);
    }
  }
  if (!inLobby) throw new Error('tidak bisa membuat kamar (signaling bermasalah)');
  check('ruang tunggu kamar harta terbuka di layar sentuh', true, await A.eval(`document.getElementById('lobbyCode').textContent.trim()`));

  const inject = await A.eval(
    `(async () => { const m = await import('/js/harta/logic.js'); const st = HARTA.state(); const r = m.addPlayer(st, { id: 'pemburu-karet', name: 'Bil', now: Date.now() }); return [r.ok, st.players.length].join('/'); })()`,
    true,
  );
  check('pemburu kedua masuk state', inject === 'true/2', inject);
  await until(A, `!document.getElementById('start').disabled`, 5000, 150);
  await A.eval(`document.getElementById('start').click(); 1`);
  const raced = await until(A, `HARTA.dbg() && HARTA.dbg().drawCalls > 0 && HARTA.view().race`, 40000);
  const screens = await A.eval(`['home','busy','lobby','race','over'].filter(n => !document.getElementById(n).classList.contains('hidden')).join(',')`);
  check('layar balapan 3D tampil di tab sentuh', raced === true, 'layar=' + screens);

  check('petunjuk kontrol versi sentuh yang tampil', /Geser kiri/.test(await A.eval(`document.getElementById('hrHelp').textContent`)));
  check(
    'tombol Lompat + Sonar berukuran sentuh',
    (await A.eval(`(() => { const j = document.getElementById('hrJump'), s = document.getElementById('hrSonar'); return j.clientWidth >= 44 && s.clientWidth >= 44; })()`)) === true,
  );

  await until(A, `HARTA.view().race.status === 'running'`, 25000);
  const box = await A.eval(`(() => { const t = document.getElementById('hrTouch').getBoundingClientRect(); return { w: Math.round(t.width), h: Math.round(t.height) }; })()`);
  const hit = await A.eval(`(() => { const e = document.elementFromPoint(90, innerHeight - 220); return e ? (e.id || e.className || e.tagName) : null; })()`);
  check('lapisan sentuh menutupi layar lomba', box.w > 300 && box.h > 500, JSON.stringify(box) + ' hit=' + hit);

  // 1) Joystick: sentuh + tahan di kiri -> berjalan.
  const p0 = await A.eval(`JSON.stringify(HARTA.me())`);
  await A.touch('touchStart', [{ x: 90, y: box.h - 220 }]);
  await A.touch('touchMove', [{ x: 90, y: box.h - 300 }]);
  await sleep(1300);
  const stickShown = await A.eval(`!document.getElementById('hrStick').classList.contains('hidden')`);
  const p1 = await A.eval(`JSON.stringify(HARTA.me())`);
  await A.touch('touchEnd', []);
  await sleep(400);
  const stickHidden = await A.eval(`document.getElementById('hrStick').classList.contains('hidden')`);
  const p3 = await A.eval(`JSON.stringify(HARTA.me())`);
  await sleep(900);
  const p4 = await A.eval(`JSON.stringify(HARTA.me())`);
  const dist = (a, b) => {
    const x = JSON.parse(a), y = JSON.parse(b);
    return Math.hypot(x.x - y.x, x.z - y.z);
  };
  check('joystick muncul saat kiri disentuh', stickShown === true);
  check('pemburu berjalan lewat joystick sentuh', dist(p0, p1) > 1.5, 'berpindah ' + dist(p0, p1).toFixed(2) + ' m');
  check('joystick hilang saat jari diangkat', stickHidden === true);
  check('pemburu berhenti setelah jari diangkat', dist(p3, p4) < 0.5, 'masih bergeser ' + dist(p3, p4).toFixed(2) + ' m');

  // 2) Geser separuh kanan memutar kamera -> arah jalan ikut berubah.
  await A.touch('touchStart', [{ x: 90, y: box.h - 220 }]);
  await A.touch('touchMove', [{ x: 90, y: box.h - 300 }]);
  await sleep(700);
  const faceA = await A.eval(`HARTA.me().a`);
  await A.touch('touchStart', [{ x: 90, y: box.h - 220 }, { x: 200, y: 380 }]);
  await A.touch('touchMove', [{ x: 90, y: box.h - 300 }, { x: 380, y: 380 }]);
  await sleep(800);
  const faceB = await A.eval(`HARTA.me().a`);
  await A.touch('touchEnd', []);
  const dFace = Math.abs(((faceB - faceA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  check('geser separuh kanan memutar kamera', dFace > 0.2, 'arah berubah ' + dFace.toFixed(2) + ' rad');

  // 3) Tombol Lompat.
  const jb = await A.eval(`(() => { const r = document.getElementById('hrJump').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  await A.touch('touchStart', [jb]);
  const pressed = await A.eval(`document.getElementById('hrJump').classList.contains('pressed')`);
  await A.touch('touchEnd', []);
  const jumped = await until(A, `HARTA.me().y > 0.2`, 2500, 60);
  check('tombol Lompat mengangkat pemburu', jumped === true, 'pressed=' + pressed);

  // 4) Tombol Sonar.
  const sb = await A.eval(`(() => { const r = document.getElementById('hrSonar').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  const before = await A.eval(`(() => { const v = HARTA.view(); return v.race.racers.find(r => r.id === v.you.id).sonar; })()`);
  await A.touch('touchStart', [sb]);
  await A.touch('touchEnd', []);
  const spent = await until(
    A,
    `(() => { const v = HARTA.view(); const me = v.race.racers.find(r => r.id === v.you.id); return me.sonar === ${before - 1} && !document.getElementById('hrArrow').classList.contains('hidden') ? '1' : ''; })()`,
    6000,
  );
  check('tombol Sonar terpakai + panah muncul', spent === true, 'sebelum=' + before);

  // 5) Sentuhan di tombol tidak boleh memunculkan joystick.
  await A.touch('touchStart', [jb]);
  const noStick = await A.eval(`document.getElementById('hrStick').classList.contains('hidden')`);
  await A.touch('touchEnd', []);
  check('sentuhan pada tombol tidak mengaktifkan joystick', noStick === true);

  console.log('errors: ' + JSON.stringify(A.errors.slice(0, 5)));
  check('tidak ada error runtime di jalur sentuh', A.errors.length === 0);
} catch (e) {
  failed++;
  console.log('ERROR E2E SENTUH: ' + e.message + ' | errors: ' + JSON.stringify(A.errors.slice(0, 4)));
}
console.log(failed === 0 ? '\nE2E SENTUH: SEMUA LULUS' : `\nE2E SENTUH: ${failed} MASALAH`);
for (const p of procs) p.kill('SIGTERM');
process.exit(failed === 0 ? 0 : 1);
