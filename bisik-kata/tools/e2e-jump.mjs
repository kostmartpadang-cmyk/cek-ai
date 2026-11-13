// Uji jalur vertikal mode harta lewat input asli: lompat ke atas peti, berdiri di puncaknya,
// lalu turun lagi — dan pastikan tinggi badan ikut terbawa ke state tuan rumah serta ke view.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const PORT = 9483;
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
  mouse(type, x, y) {
    const params = { type, x, y };
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
  async move(dx, dy, steps = 5) {
    for (let i = 0; i < steps; i++) {
      this.cx += Math.round(dx / steps);
      this.cy += Math.round(dy / steps);
      await this.mouse('mouseMoved', this.cx, this.cy);
    }
  }
  recenter() {
    return this.move(Math.round(W / 2) - this.cx, Math.round(H / 2) - this.cy, 4);
  }
  key(type, code, key, vk) {
    return this.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  tap(code, key, vk) {
    return this.key('keyDown', code, key, vk).then(() => this.key('keyUp', code, key, vk));
  }
  probe() {
    return this.eval(
      `(() => {
        const H = window.HARTA;
        if (!H || !H.me || !H.view()) return null;
        const m = H.me();
        const st = H.state();
        const v = H.view();
        const you = v.you.id;
        const q = st && st.race ? st.race.racers[you] : null;
        const pv = v.race.racers.find((p) => p.id === you);
        return { x: m.x, z: m.z, y: m.y, sup: m.sup, air: m.air, host: q ? q.y : null, view: pv ? pv.y : null };
      })()`,
    );
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
  const dir = mkdtempSync(join(tmpdir(), 'cdp-jump-'));
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

try {
  await A.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await A.goto(BASE);
  await A.send('Page.bringToFront');
  await A.eval(`document.getElementById('modeHarta').click(); 1`);

  let inLobby = false;
  for (let attempt = 1; attempt <= 5 && !inLobby; attempt++) {
    // Nama ditulis ulang setiap percobaan: app.js mengisi kolomnya dari localStorage saat modulnya
    // baru siap, yang bisa terjadi sesudah ketikan pertama kita.
    await A.eval(`document.getElementById('name').value='Lompat'; document.getElementById('create').click(); 1`);
    inLobby = await until(A, `!document.getElementById('lobby').classList.contains('hidden')`, 30000);
    if (!inLobby) {
      console.log('  percobaan kamar ' + attempt + ' gagal: ' + (await A.eval(`[document.getElementById('busyTxt').textContent, document.getElementById('homeErr').textContent].join(' / ')`)));
      await A.eval(`document.getElementById('busyCancel').click(); 1`);
      await sleep(2000 * attempt);
    }
  }
  if (!inLobby) throw new Error('tidak bisa membuat kamar (signaling bermasalah)');

  await A.eval(
    `(async () => { const m = await import('/js/harta/logic.js'); const st = HARTA.state(); m.addPlayer(st, { id: 'karet-lompat', name: 'Bil', now: Date.now() }); return 1; })()`,
    true,
  );
  await until(A, `!document.getElementById('start').disabled`, 5000, 150);
  await A.eval(`document.getElementById('start').click(); 1`);
  check('balapan berjalan di tab lompat', await until(A, `HARTA.view() && HARTA.view().race && HARTA.view().race.status === 'running'`, 40000));

  await A.eval(`(async () => { window.__MAP = await import('/js/harta/maps.js'); return 1; })()`, true);
  const plan = await A.eval(`(() => {
    const L = HARTA.state().race.layout;
    const M = window.__MAP.CFG;
    const map = window.__MAP;
    const cand = L.boxes.filter((b) => !b.wall && b.h >= M.stepH && b.h <= 1.25);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    for (const b of cand.sort((p, q) => Math.min(q.w, q.d) - Math.min(p.w, p.d))) {
      for (const [ux, uz] of dirs) {
        const near = { x: b.x - ux * (b.w / 2 + 0.9), z: b.z - uz * (b.d / 2 + 0.9) };
        const far = { x: b.x + ux * (b.w / 2 + 0.9), z: b.z + uz * (b.d / 2 + 0.9) };
        const start = { x: b.x - ux * 3.1, z: b.z - uz * 3.1 };
        if (map.blockedAt(L, start.x, start.z) || map.supportAt(L, start.x, start.z) !== 0) continue;
        if (!map.segmentClear(L, start.x, start.z, near.x, near.z)) continue;
        if (!map.segmentClear(L, far.x, far.z, far.x + ux * 2.4, far.z + uz * 2.4)) continue;
        return { ok: true, total: cand.length, cx: b.x, cz: b.z, h: b.h, edge: (Math.abs(ux) > 0.5 ? b.w : b.d) / 2 + 0.62,
          ux, uz, sx: start.x, sz: start.z,
          // Arah jalan W adalah (-sin yaw, -cos yaw), jadi yaw = atan2(-dx, -dz) — bukan tukar x/z.
          yaw: Math.atan2(-(b.x - start.x), -(b.z - start.z)) };
      }
    }
    return { ok: false, total: cand.length };
  })()`);
  check('peta punya penghalang yang puncaknya terjangkau', plan.ok === true, `ada ${plan.total} benda pijakan`);
  if (!plan.ok) throw new Error('tidak ada peti dengan jalur bebas di sekitarnya');

  // Melangkah ke dalam peti tidak boleh menanamkan pemain di dalamnya.
  await A.eval(`HARTA.api.moveTo(${plan.cx}, ${plan.cz})`);
  const embed = await A.probe();
  const notEmbedded = await A.eval(
    `(() => { const m = HARTA.me(); const L = HARTA.state().race.layout; return window.__MAP.insideSolid(L, m.x, m.z, m.y) ? 'tertanam' : 'bersih'; })()`,
  );
  check('dorong-keluar mencegah pemain tertanam di dalam peti', notEmbedded === 'bersih' && embed.y === 0, `y=${embed.y}`);

  await A.recenter();
  await A.click();
  const locked = (await A.eval(`document.pointerLockElement ? (document.pointerLockElement.id || 'lain') : ''`)) === 'hrTouch';
  check('kamera dikunci supaya bisa dibidik', locked);

  for (let i = 0; i < 6; i++) {
    const yaw = Number(await A.eval(`HARTA.dbg().yaw`));
    let err = ((plan.yaw - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(err) < 0.05) break;
    await A.move(Math.round(Math.max(-500, Math.min(500, -err / 0.0026))), 0, 4);
    await sleep(120);
  }
  const yawEnd = Number(await A.eval(`HARTA.dbg().yaw`));
  const yawErr = Math.abs(((plan.yaw - yawEnd + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  check('kamera dibidik ke arah peti', yawErr < 0.1, `sesat ${yawErr.toFixed(3)} rad`);

  await A.eval(`HARTA.api.moveTo(${plan.sx}, ${plan.sz})`);
  const before = await A.probe();
  check('pemburu berdiri di lantai sebelum melompat', before.y === 0 && before.sup === 0);

  // Klik terakhir kali masih di dalam input nama: tanpa blur, tombol WASD dianggap sedang menulis.
  await A.eval(`document.activeElement && document.activeElement.blur(); 1`);
  const edgeOf = plan.edge;
  await A.key('keyDown', 'KeyW', 'w', 87);
  let peak = before.y;
  let edge = null;
  let last = before;
  for (let i = 0; i < 40; i++) {
    await sleep(60);
    last = await A.probe();
    peak = Math.max(peak, last.y);
    if (Math.hypot(last.x - plan.cx, last.z - plan.cz) < edgeOf) { edge = last; break; }
  }
  await A.key('keyUp', 'KeyW', 'w', 87);
  check(
    'jalan kaki (W) mendekat ke peti',
    !!edge,
    edge ? `jarak ${Math.hypot(edge.x - plan.cx, edge.z - plan.cz).toFixed(2)} m`
         : `berhenti di ${last.x.toFixed(2)},${last.z.toFixed(2)} (target ${plan.cx.toFixed(2)},${plan.cz.toFixed(2)}, tepi ${edgeOf.toFixed(2)} m)`,
  );
  if (!edge) throw new Error('pemburu tidak jalan sama sekali');

  // Lompat lalu tetap jalan sampai kakinya berada di atas tutup peti; begitu terpantau, lepas W
  // supaya dia jatuh tegak dan mendarat di puncaknya (bukan menggeser keluar dari sisi jauh).
  await A.tap('Space', ' ', 32);
  await A.key('keyDown', 'KeyW', 'w', 87);
  let over = null;
  for (let i = 0; i < 16; i++) {
    await sleep(40);
    const p = await A.probe();
    peak = Math.max(peak, p.y);
    if (p.sup >= plan.h - 0.05) { over = p; break; }
  }
  await A.key('keyUp', 'KeyW', 'w', 87);
  check('telapak sampai di atas tutup peti saat melayang', !!over, over ? `pijakan ${over.sup.toFixed(2)} m, tinggi ${over.y.toFixed(2)} m` : 'tidak pernah di atas tutup');

  let onTop = null;
  for (let i = 0; i < 30; i++) {
    await sleep(60);
    const p = await A.probe();
    peak = Math.max(peak, p.y);
    if (!p.air && p.sup >= plan.h - 0.05 && p.y >= plan.h - 0.05) { onTop = p; break; }
  }
  check('lompatan mengangkat pemburu dari lantai', peak > 0.4, `puncak ${peak.toFixed(2)} m`);
  check('berdiri di atas peti', !!onTop, onTop ? `pijakan ${onTop.sup.toFixed(2)} m` : 'tidak sampai');
  if (onTop) {
    check('pijakan sama dengan puncak peti', Math.abs(onTop.sup - plan.h) < 0.06, `${onTop.sup.toFixed(2)} vs ${plan.h.toFixed(2)}`);
    check('tinggi ikut tersimpan di state tuan rumah', onTop.host >= plan.h - 0.06, `host=${onTop.host}`);
    check('tinggi ikut terkirim ke view', onTop.view >= plan.h - 0.06, `view=${onTop.view}`);
  }

  // Tahan jalan lagi: pemburu melangkah turun dari peti lalu mendarat di lantai.
  await A.key('keyDown', 'KeyW', 'w', 87);
  let off = null;
  for (let i = 0; i < 45; i++) {
    await sleep(80);
    const p = await A.probe();
    if (p.sup === 0 && p.y === 0 && !p.air) { off = p; break; }
  }
  await A.key('keyUp', 'KeyW', 'w', 87);
  check('melangkah turun dari peti kembali ke lantai', !!off, off ? `di ${off.x.toFixed(1)},${off.z.toFixed(1)}` : 'masih di atas');

  await A.tap('Escape', '', 27);
  await sleep(250);
  check('Esc melepas kunci kursor', (await A.eval(`document.pointerLockElement ? 'terkunci' : 'bebas'`)) === 'bebas');

  console.log('errors:', JSON.stringify(A.errors.slice(0, 4)));
  check('tidak ada error runtime di jalur lompat', A.errors.length === 0);
} catch (e) {
  console.log('ERROR E2E LOMPAT: ' + e.message);
  failed++;
} finally {
  try { await A.send('Browser.close'); } catch (e) {}
  for (const p of procs) p.kill();
}

console.log(failed ? `\nE2E LOMPAT: ${failed} MASALAH` : '\nE2E LOMPAT: SEMUA LULUS');
process.exit(failed ? 1 : 0);
