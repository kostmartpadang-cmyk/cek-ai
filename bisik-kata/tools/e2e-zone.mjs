// Uji dua rintangan baru lewat input asli: tanah lembek benar-benar memperlambat langkah dan lubang
// jebakan menjatuhkan pemburu ke dasarnya, lalu dia bisa keluar dengan lompatan.
// Semua pengukuran dilakukan di dalam halaman (performance.now) supaya tidak tergerus latensi CDP.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const PORT = 9484;
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
  async move(dx, dy, steps = 4) {
    for (let i = 0; i < steps; i++) {
      this.cx += Math.round(dx / steps);
      this.cy += Math.round(dy / steps);
      await this.mouse('mouseMoved', this.cx, this.cy);
    }
  }
  key(type, code, key, vk) {
    return this.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  tap(code, key, vk) {
    return this.key('keyDown', code, key, vk).then(() => this.key('keyUp', code, key, vk));
  }
  me() {
    return this.eval(`(() => { const m = HARTA.me(); return m && { x: m.x, z: m.z, y: m.y, sup: m.sup, air: m.air, zone: m.zone }; })()`);
  }
}

async function until(tab, expr, timeout = 30000, every = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await tab.eval(expr)) return true;
    } catch (e) {}
    await sleep(every);
  }
  return false;
}

function launch(port) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-zone-'));
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

/* Apakah kaki pemain sedang tertanam di dalam benda? */
const tanam = () =>
  A.eval(`(() => { const m = HARTA.me(); const L = HARTA.state().race.layout;
    return window.__MAP.insideSolid(L, m.x, m.z, m.y) ? 'tertanam' : 'bersih'; })()`);

/* Servo yaw kamera sampai arah jalan W menunjuk (ux, uz): forward = (-sin yaw, -cos yaw). */
async function aimYaw(tab, ux, uz) {
  const target = Math.atan2(-ux, -uz);
  for (let i = 0; i < 8; i++) {
    const yaw = Number(await tab.eval(`HARTA.dbg().yaw`));
    const err = ((target - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(err) < 0.03) return Math.abs(err);
    await tab.move(Math.round(Math.max(-520, Math.min(520, -err / 0.0026))), 0, 4);
    await sleep(140);
  }
  return NaN;
}

/* Laju murni di dalam halaman: tahan W, ukur perpindahan sepanjang lintasan selama durasiMs. */
function measureRun(ux, uz, durMs) {
  return A.eval(
    `(async () => {
      const m0 = HARTA.me();
      const t0 = performance.now();
      let zone = 0;
      const tick = () => new Promise((r) => setTimeout(r, 60));
      while (performance.now() - t0 < ${durMs}) {
        const m = HARTA.me();
        zone = Math.max(zone, m.zone || 0);
        await tick();
      }
      const m1 = HARTA.me();
      const dur = (performance.now() - t0) / 1000;
      const along = ((m1.x - m0.x) * ${ux} + (m1.z - m0.z) * ${uz}) / dur;
      return { speed: along, dur, zone, jauh: Math.hypot(m1.x - m0.x, m1.z - m0.z) };
    })()`,
    true,
  );
}

try {
  await A.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await A.goto(BASE);
  await A.send('Page.bringToFront');
  await A.eval(`document.getElementById('modeHarta').click(); 1`);

  let inLobby = false;
  for (let attempt = 1; attempt <= 5 && !inLobby; attempt++) {
    // Nama ditulis ulang setiap percobaan: app.js mengisi kolomnya dari localStorage saat modulnya
    // baru siap, yang bisa terjadi sesudah ketikan pertama kita.
    await A.eval(`document.getElementById('name').value='Zona'; document.getElementById('create').click(); 1`);
    inLobby = await until(A, `!document.getElementById('lobby').classList.contains('hidden')`, 30000);
    if (!inLobby) {
      console.log('  percobaan kamar ' + attempt + ' gagal: ' + (await A.eval(`[document.getElementById('busyTxt').textContent, document.getElementById('homeErr').textContent].join(' / ')`)));
      await A.eval(`document.getElementById('busyCancel').click(); 1`);
      await sleep(2500 * attempt);
    }
  }
  if (!inLobby) throw new Error('tidak bisa membuat kamar (signaling bermasalah)');

  // Kuil: satu-satunya peta hari ini yang punya tanah lembek sekaligus lubang jebakan. Kartu tempat
  // dibangun oleh loop render, yang di swiftshader bisa cuma dua frame per detik — tunggu dulu.
  const adaKartu = await until(A, `[...document.querySelectorAll('#mapPick .hr-map')].some((b) => /Kuil/.test(b.textContent))`, 20000);
  check('layar pilih tempat menampilkan kartu kuil', adaKartu);
  if (!adaKartu) throw new Error('kartu tempat tidak muncul: ' + (await A.eval(`[...document.querySelectorAll('#mapPick .hr-map')].length`)));
  await A.eval(`[...document.querySelectorAll('#mapPick .hr-map')].find(b => /Kuil/.test(b.textContent)).click(); 1`);
  await A.eval(
    `(async () => { const m = await import('/js/harta/logic.js'); const st = HARTA.state(); m.addPlayer(st, { id: 'karet-zona', name: 'Bil', now: Date.now() }); return 1; })()`,
    true,
  );
  await until(A, `!document.getElementById('start').disabled`, 5000, 150);
  await A.eval(`document.getElementById('start').click(); 1`);
  check('balapan berjalan di tab zona', await until(A, `HARTA.view() && HARTA.view().race && HARTA.view().race.status === 'running'`, 40000));
  check('ronde pertama memakai kuil pilihan tuan rumah', (await A.eval(`HARTA.view().race.mapId`)) === 'kuil');
  await A.eval(`(async () => { window.__MAP = await import('/js/harta/maps.js'); return 1; })()`, true);

  const plan = await A.eval(`(() => {
    const map = window.__MAP, L = HARTA.state().race.layout;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];
    const cellAt = (x, z) => ({ x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 });
    // Lintasan lurus sepanjang need yang seluruhnya berzona want, cukup lapang untuk badan, dan
    // tidak terpotong benda apa pun (diperiksa dengan radius pemain, bukan titik tengah saja).
    const run = (want, need) => {
      for (let t = 0; t < 2000; t++) {
        const gx = -L.bounds.hw + 1 + (t % 40), gz = -L.bounds.hd + 1 + Math.floor(t / 40);
        for (const [ux, uz] of dirs) {
          const px = -uz, pz = ux;
          let ok = true;
          for (let d = -0.6; d <= need + 0.2; d += 0.4) {
            for (const side of [-0.46, 0, 0.46]) {
              const p = cellAt(gx + ux * d + px * side, gz + uz * d + pz * side);
              if (map.blockedAt(L, p.x, p.z) || map.zoneAt(L, p.x, p.z) !== want) { ok = false; break; }
            }
            if (!ok) break;
          }
          if (ok && map.segmentClear(L, gx, gz, gx + ux * (need + 0.6), gz + uz * (need + 0.6)))
            return { sx: gx, sz: gz, ux, uz };
        }
      }
      return null;
    };
    const floor = run(0, 5);
    const soft = run(1, 3.5);
    // Lubang: mulai 1,2 m di luar mulutnya, satu garis lurus sampai 1,2 m di seberang, supaya jatuh
    // dan keluar sama-sama terjadi lewat langkah biasa.
    let pit = null;
    for (const b of L.boxes.filter((o) => o.k === 'pit')) {
      const hr = Math.max(b.w, b.d) / 2;
      for (const [ux, uz] of dirs) {
        const s = { x: b.x - ux * (hr + 1.2), z: b.z - uz * (hr + 1.2) };
        const out = { x: b.x + ux * (hr + 1.2), z: b.z + uz * (hr + 1.2) };
        if (map.zoneAt(L, s.x, s.z) !== 0 || map.blockedAt(L, s.x, s.z)) continue;
        if (map.zoneAt(L, out.x, out.z) !== 0 || map.blockedAt(L, out.x, out.z)) continue;
        if (!map.segmentClear(L, s.x, s.z, out.x, out.z)) continue;
        pit = { sx: s.x, sz: s.z, ux, uz, cx: b.x, cz: b.z, ox: out.x, oz: out.z, hr };
        break;
      }
      if (pit) break;
    }
    const lembek = L.boxes.filter((o) => o.k === 'soft').length;
    const lub = L.boxes.filter((o) => o.k === 'pit').length;
    return { floor, soft, pit, lembek, lub, kedalaman: map.CFG.pitDepth, reach: map.CFG.jumpReach };
  })()`);
  check('peta menaruh kedua rintangan baru', plan.lembek >= 3 && plan.lub >= 2, `lembek=${plan.lembek} lubang=${plan.lub}`);
  check('lintasan lantai, lembek, dan lubang ditemukan', !!plan.floor && !!plan.soft && !!plan.pit, JSON.stringify({ floor: !!plan.floor, soft: !!plan.soft, pit: !!plan.pit }));
  if (!plan.floor || !plan.soft || !plan.pit) throw new Error('peta tidak menyediakan jalur uji yang lapang');

  await A.click();
  check('kamera dikunci supaya bisa dibidik', (await A.eval(`document.pointerLockElement && document.pointerLockElement.id`)) === 'hrTouch');
  await A.eval(`document.activeElement && document.activeElement.blur(); 1`);

  // 1) Lantai biasa sebagai pembanding. Laju di headless dibatasi clamp dt + ~8 fps, jadi yang diuji
  //    rasio lembek terhadap lantai, bukan angka 6,2 m/dtk yang hanya tercapai di perangkat lancar.
  await A.eval(`HARTA.api.moveTo(${plan.floor.sx}, ${plan.floor.sz}); 1`);
  const eFloor = await aimYaw(A, plan.floor.ux, plan.floor.uz);
  await A.key('keyDown', 'KeyW', 'w', 87);
  await sleep(300);
  const rFloor = await measureRun(plan.floor.ux, plan.floor.uz, 1200);
  await A.key('keyUp', 'KeyW', 'w', 87);
  check(
    'lantai: pemburu melangkah dan zonanya nol',
    rFloor.jauh > 0.8 && rFloor.zone === 0,
    `${rFloor.jauh.toFixed(2)} m dalam ${rFloor.dur.toFixed(2)} dtk (${rFloor.speed.toFixed(2)} m/dtk), sesat ${eFloor.toFixed(3)} rad`,
  );

  // 2) Tanah lembek: jalur searah, laju harus turun drastis.
  await A.eval(`HARTA.api.moveTo(${plan.soft.sx}, ${plan.soft.sz}); 1`);
  await aimYaw(A, plan.soft.ux, plan.soft.uz);
  await A.key('keyDown', 'KeyW', 'w', 87);
  await sleep(300);
  const rSoft = await measureRun(plan.soft.ux, plan.soft.uz, 1200);
  await A.key('keyUp', 'KeyW', 'w', 87);
  const ratio = rSoft.speed / rFloor.speed;
  check('tanah lembek terdeteksi saat melangkah di atasnya', rSoft.zone === 1, 'zona=' + rSoft.zone);
  check('tanah lembek memperlambat sekitar separuh', ratio > 0.25 && ratio < 0.8, `${rSoft.speed.toFixed(2)} vs ${rFloor.speed.toFixed(2)} m/dtk (kali ${ratio.toFixed(2)})`);

  // 3) Lubang: berjalan dari lantai ke mulutnya → jatuh sampai dasar.
  await A.eval(`HARTA.api.moveTo(${plan.pit.sx}, ${plan.pit.sz}); 1`);
  await aimYaw(A, plan.pit.ux, plan.pit.uz);
  await A.key('keyDown', 'KeyW', 'w', 87);
  let inPit = null;
  for (let i = 0; i < 40; i++) {
    await sleep(70);
    const m = await A.me();
    if (m.zone === 2 && !m.air && Math.abs(m.y + plan.kedalaman) < 0.06) { inPit = m; break; }
  }
  await A.key('keyUp', 'KeyW', 'w', 87);
  check('lubang menjatuhkan pemburu sampai dasarnya', !!inPit, inPit ? `y=${inPit.y.toFixed(2)} pijakan=${inPit.sup.toFixed(2)}` : 'tidak masuk lubang');
  if (inPit) {
    check('pijakan di dalam lubang sama dengan dasarnya', Math.abs(inPit.sup + plan.kedalaman) < 0.02, `sup=${inPit.sup}`);
    check('di dasar lubang pemburu tidak tertanam di dalam benda', (await tanam()) === 'bersih', JSON.stringify(inPit));
    // mv dikirim 12 Hz, jadi beri waktu sampai tuan rumah Menyusul.
    let stuck = null;
    for (let i = 0; i < 12 && stuck === null; i++) {
      await sleep(120);
      const h = await A.eval(`HARTA.state().race.racers[HARTA.view().you.id].y`);
      if (Math.abs(h + plan.kedalaman) < 0.06) stuck = h;
    }
    const hostY = await A.eval(`HARTA.state().race.racers[HARTA.view().you.id].y`);
    check('dasar lubang ikut terbawa ke state tuan rumah', stuck !== null, `host=${hostY}`);
  }

  // 4) Keluar hanya bisa dengan melompat: berjalan menahan di tepi sampai kaki naik ke atas lantai.
  await aimYaw(A, plan.pit.ux, plan.pit.uz);
  await A.key('keyDown', 'KeyW', 'w', 87);
  let masih = null;
  for (let i = 0; i < 25; i++) {
    await sleep(70);
    const m = await A.me();
    if (m.zone !== 2 || m.y > 0) break;
    masih = m;
  }
  await A.key('keyUp', 'KeyW', 'w', 87);
  check('berjalan saja tidak mengeluarkan dari lubang', !!masih, masih ? `tertahan di ${masih.x.toFixed(1)},${masih.z.toFixed(1)} y=${masih.y.toFixed(2)}` : 'ternyata keluar tanpa melompat');

  let out = null;
  for (let hop = 0; hop < 3 && !out; hop++) {
    await A.tap('Space', ' ', 32);
    await A.key('keyDown', 'KeyW', 'w', 87);
    for (let i = 0; i < 40; i++) {
      await sleep(60);
      const m = await A.me();
      // Tidak diuji seberapa tinggi dia naik: begitu kaki melewati lantai, tepi lubang lepas dan
      // dia menapak lagi — jadi yang terbukti di sini adalah "lompatan membuka jalan keluar".
      if (m.zone !== 2 && m.y >= 0 && !m.air) { out = m; break; }
    }
    await A.key('keyUp', 'KeyW', 'w', 87);
  }
  check('pemburu bisa keluar dari lubang dengan melompat', !!out, out ? `keluar di ${out.x.toFixed(1)},${out.z.toFixed(1)} pada ${out.y.toFixed(2)} m, ${await tanam()}` : 'masih di dalam');
  let diLagi = null;
  for (let i = 0; i < 12 && diLagi === null; i++) {
    await sleep(120);
    const h = await A.eval(`HARTA.state().race.racers[HARTA.view().you.id].y`);
    if (Math.abs(h) < 0.06) diLagi = h;
  }
  check('keluar lubang juga tercatat di tuan rumah', diLagi !== null, `host=${await A.eval(`HARTA.state().race.racers[HARTA.view().you.id].y`)}`);

  await A.tap('Escape', '', 27);
  await sleep(250);
  check('Esc melepas kunci kursor', (await A.eval(`document.pointerLockElement ? 'terkunci' : 'bebas'`)) === 'bebas');
  console.log('errors:', JSON.stringify(A.errors.slice(0, 4)));
  check('tidak ada error runtime di jalur zona', A.errors.length === 0);
} catch (e) {
  console.log('ERROR E2E ZONA: ' + e.message);
  failed++;
} finally {
  try {
    await Promise.race([A.send('Browser.close'), sleep(1200)]);
  } catch (e) {}
  for (const p of procs) p.kill();
}

console.log(failed ? `\nE2E ZONA: ${failed} MASALAH` : '\nE2E ZONA: SEMUA LULUS');
process.exit(failed ? 1 : 0);
