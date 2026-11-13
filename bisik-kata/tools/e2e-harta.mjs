// Harness sementara (di luar repo): mengemudi 2 Chrome headless lewat CDP untuk uji E2E mode Berburu Harta.
// Beda dengan e2e-2-player.mjs: tanpa --disable-gpu + swiftshader supaya WebGL nyata, dan pemburu
// dibimbing berjalan mendekat (bukan teleport) agar validasi anti-teleport tuan rumah ikut terpakai.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lit = (v) => JSON.stringify(String(v == null ? '' : v).replace(/[^A-Za-z0-9_.:-]/g, ''));
const num = (v) => (Number.isFinite(+v) ? String(+v) : '0');

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
    if (r.exceptionDetails)
      throw new Error('eval gagal: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }
}

async function until(tab, expr, timeout = 30000, every = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await tab.eval(expr);
    if (v) return v;
    await sleep(every);
  }
  const diag = await tab
    .eval(
      `[document.getElementById('homeErr').textContent, document.getElementById('toast').textContent, document.getElementById('hrBig').textContent].join(' / ')`,
    )
    .catch(() => '?');
  throw new Error(`timeout: ${expr}\n   diag: ${diag}`);
}

function launch(port) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-harta-'));
  return spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--mute-audio',
      '--no-first-run',
      '--window-size=900,700',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
}

const procs = [launch(9451), launch(9452)];
async function waitPort(port, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return true;
    } catch (e) {}
    await sleep(1000);
  }
  throw new Error('Chrome di port ' + port + ' tidak siap');
}
await waitPort(9451);
await waitPort(9452);

const A = new Tab(9451);
const B = new Tab(9452);
await A.connect();
await B.connect();

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
};

/* Jalan mendekat satu titik: langkah kecil + belok saat mentok tembok/peti. */
async function walkTo(tab, x, z, maxStep = 420) {
  return tab.eval(
    `(async () => {
      const H = window.HARTA;
      if (!H || !H.api) return { ok: false, why: 'no HARTA' };
      const TX = ${num(x)}, TZ = ${num(z)};
      const step = 1.05;
      const off = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8];
      let n = 0, stuck = 0;
      while (n++ < ${maxStep}) {
        const m = H.me();
        if (!m) return { ok: false, why: 'unattached' };
        const dx = TX - m.x, dz = TZ - m.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) return { ok: true, steps: n, x: m.x, z: m.z, d };
        const base = Math.atan2(dz, dx);
        let moved = false;
        for (const o of off) {
          const a = base + o;
          const px = m.x, pz = m.z;
          H.api.moveTo(px + Math.cos(a) * step, pz + Math.sin(a) * step);
          const q = H.me();
          if (Math.hypot(q.x - px, q.z - pz) > 0.5) { moved = true; break; }
        }
        if (moved) stuck = 0;
        else if (++stuck > 8) return { ok: false, why: 'mentok', x: m.x, z: m.z, d };
        await new Promise((r) => setTimeout(r, 88));
      }
      const last = H.me();
      return { ok: false, why: 'kehabisan langkah', x: last.x, z: last.z, d: Math.hypot(TX - last.x, TZ - last.z) };
    })()`,
    true,
  );
}

const raceOf = (tab) => tab.eval(`(() => { const v = HARTA && HARTA.view && HARTA.view(); return v && v.race ? v.race : null; })()`);
const treasureOf = (tab) => tab.eval(`(() => (HARTA && HARTA.api ? HARTA.api.treasure() : null))()`);

const mapCardCount = `document.querySelectorAll('#mapPick .hr-map').length`;

const stateDump = `JSON.stringify({
  screens: ['home','busy','lobby','race','over'].filter(n => !document.getElementById(n).classList.contains('hidden')),
  lobbyCode: document.getElementById('lobbyCode').textContent.trim(),
  lobbyLi: document.querySelectorAll('#lobbyPlayers li').length,
  mapCards: document.querySelectorAll('#mapPick .hr-map').length,
  startDisabled: document.getElementById('start').disabled,
  state: window.HARTA && HARTA.state && HARTA.state() ? [HARTA.state().code, HARTA.state().players.length, HARTA.state().phase, HARTA.state().mapPick] : null,
  view: window.HARTA && HARTA.view && HARTA.view() ? [HARTA.view().code, HARTA.view().phase, HARTA.view().race ? HARTA.view().race.id : null] : null,
  dbg: window.HARTA && HARTA.dbg ? HARTA.dbg() : null,
  canvasInDom: (() => { const c = document.getElementById('gl'); return c ? [c.isConnected, c.clientWidth, c.clientHeight] : null; })(),
  homeErr: document.getElementById('homeErr').textContent,
  toast: document.getElementById('toast').textContent,
})`;

try {
  await A.goto(BASE);
  await B.goto(BASE);
  check('halaman + modul harta termuat tanpa error', A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].join(' | '));

  const webgl = await A.eval(`(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })()`);
  if (!webgl) {
    console.log('SKIP: Chrome tanpa WebGL — bagian 3D tidak diuji di sini (logika murni sudah lewat node --test).');
    for (const p of procs) p.kill('SIGTERM');
    process.exit(0);
  }

  const home = await A.eval(`(() => {
    document.getElementById('modeHarta').click();
    return [document.getElementById('homeTitle').textContent,
            document.getElementById('create').textContent,
            String(!document.getElementById('howHarta').classList.contains('hidden')),
            String(document.body.classList.contains('mode-harta'))].join(' | ');
  })()`);
  check('kartu Berburu Harta mengganti teks beranda', /Berburu Harta/.test(home) && /true \| true$/.test(home), home);

  await A.eval(`document.getElementById('name').value='Awi'; document.getElementById('create').click(); 1`);
  const inLobby = `!document.getElementById('lobby').classList.contains('hidden') ? document.getElementById('lobbyCode').textContent.trim() : ''`;
  let code = '';
  try {
    code = await until(A, inLobby, 40000);
  } catch (e) {
    console.log('diag create: ' + (await A.eval(`[document.getElementById('homeErr').textContent, document.getElementById('busyTxt').textContent, document.getElementById('toast').textContent, !document.getElementById('busy').classList.contains('hidden'), !document.getElementById('home').classList.contains('hidden')].join(' / ')`)));
    throw e;
  }
  check('kamar harta memakai kode 4 huruf yang sama seperti Bisik Kata', /^[A-Z]{4}$/.test(code), 'kode=' + code);

  const picker = await A.eval(`(() => {
    const cards = [...document.querySelectorAll('#mapPick .hr-map')];
    const cv = cards[0] && cards[0].querySelector('canvas');
    let painted = 0;
    if (cv) {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
    }
    return [String(!document.getElementById('mapCard').classList.contains('hidden')),
            cards.length, cards.map(c => c.querySelector('b').textContent).join(','),
            cards.filter(c => c.classList.contains('sel')).length, painted].join(' | ');
  })()`);
  check('lobby harta punya 3 kartu tempat + thumbnail tergambar', /^true \| 3 \| Gudang Kuno,Ruang Mainan,Kuil Terbengkalai \| 1 \| \d{3,}$/.test(picker), picker);

  await A.eval(`[...document.querySelectorAll('#mapPick .hr-map')].find(b => /Kuil/.test(b.textContent)).click(); 1`);
  await until(A, `HARTA.state().mapPick === 'kuil'`);
  check('tuan rumah memilih tempat untuk ronde 1', true);

  await B.eval(`document.getElementById('name').value='Bil'; document.getElementById('code').value=${lit(code)}; document.getElementById('join').click(); 1`);
  await until(A, `HARTA.state().players.length >= 2`, 30000);
  await until(B, `document.querySelectorAll('#lobbyPlayers li').length >= 2`, 30000);
  const follow = await until(B, `document.body.classList.contains('mode-harta') ? document.querySelectorAll('#mapPick .hr-map').length : 0`);
  check('tamu otomatis ikut mode kamar dan melihat 3 kartu', follow === 3, 'kartu=' + follow);
  const guestLocked = await B.eval(`[...document.querySelectorAll('#mapPick .hr-map')].every(c => c.classList.contains('off'))`);
  check('tamu tidak bisa mengganti tempat', guestLocked === true);

  await A.eval(`document.getElementById('start').click(); 1`);
  await until(A, `!document.getElementById('race').classList.contains('hidden')`, 40000);
  await until(B, `!document.getElementById('race').classList.contains('hidden')`, 40000);
  await until(A, `HARTA.dbg() && HARTA.dbg().drawCalls > 0`, 40000);
  await until(B, `HARTA.dbg() && HARTA.dbg().drawCalls > 0`, 40000);
  const dbgA = await A.eval(`JSON.stringify(HARTA.dbg())`);
  const dbgB = await B.eval(`JSON.stringify(HARTA.dbg())`);
  check('dunia 3D benar-benar dirender di kedua tab (WebGL)', true, 'A=' + dbgA + ' B=' + dbgB);

  const hostId = await A.eval(`HARTA.state().hostId`);
  const guestId = await B.eval(`HARTA.view().you.id`);
  const r1 = await raceOf(A);
  check('ronde 1 memakai peta pilihan tuan rumah', r1.index === 0 && r1.mapId === 'kuil', r1.mapId + '#' + r1.index);
  check('koordinat harta tidak dikirim ke klien saat ronde berjalan', r1.treasure === null && (await raceOf(B)).treasure === null);

  await until(A, `HARTA.view().race.status === 'running'`, 20000);
  await until(B, `HARTA.view().race.status === 'running'`, 20000);
  const banner = await B.eval(`document.getElementById('hrBig').textContent`);
  check('hitungan mundur selesai lalu banner CARI tampil di tamu', /CARI/i.test(banner), 'banner=' + banner.trim());
  const rows = await B.eval(`document.querySelectorAll('#hrTrack .hr-tc').length`);
  check('strip pemburu menampilkan kedua pemain', rows >= 2, 'baris=' + rows);

  await B.eval(`HARTA.api.sonar(); 1`);
  const arrowShown = await until(B, `!document.getElementById('hrArrow').classList.contains('hidden')`, 1500);
  const arrowAngle = await B.eval(`document.getElementById('hrArrow').firstChild.style.rotate`);
  const arrowOther = await A.eval(`document.getElementById('hrArrow').classList.contains('hidden')`);
  const sonar = await until(
    B,
    `(() => { const v = HARTA.view(); const me = v.race.racers.find(r => r.id === v.you.id); return me && me.sonar === 1 ? '1' : ''; })()`,
  );
  const sonarHost = await A.eval(`HARTA.state().race.racers[${lit(hostId)}].sonar`);
  check('sonar dihitung tuan rumah: tamu 1 tersisa, tuan rumah masih 2', sonar === '1' && sonarHost === 2, 'tamu=' + sonar + ' tuan=' + sonarHost);
  check('panah sonar muncul di sisi pemakai', arrowShown === true, 'sudut=' + arrowAngle);
  check('panah sonar tidak muncul di pemain lain', arrowOther === true);

  const far = await B.eval(`document.getElementById('hrHeatTxt').textContent`);
  const t1 = await treasureOf(A);
  const walkA = await walkTo(A, t1.x, t1.z);
  check('pemburu bisa berjalan sampai peti (tabrakan + anti-teleport lolos)', walkA.ok === true, JSON.stringify(walkA));
  const near = await until(A, `/Panas|Hangat|Membakar/.test(document.getElementById('hrHeatTxt').textContent) ? document.getElementById('hrHeatTxt').textContent : ''`);
  check('meter panas naik saat mendekat harta', near !== far, 'jauh=' + far + ' dekat=' + near);

  const won1 = JSON.parse(await until(A, `HARTA.state().race.winnerId ? JSON.stringify(HARTA.state().race.results[0]) : ''`));
  check('klaim tuan rumah sah → pemenang ronde 1', won1.id === hostId, JSON.stringify(won1));
  const syncB = await until(
    B,
    `(() => { const v = HARTA.view(); const w = v.race.racers.find(r => r.id === ${lit(hostId)}); return w && Math.hypot(w.x - ${num(t1.x)}, w.z - ${num(t1.z)}) < 2 ? JSON.stringify([w.x, w.z]) : ''; })()`,
  );
  check('posisi pemenang tersinkron ke tab tamu', true, 'tuan rumah di=' + syncB + ' harta=' + JSON.stringify(t1));

  await until(B, `(() => { const v = HARTA.view(); return v && v.phase === 'reveal' && v.race.winnerName ? 1 : ''; })()`, 30000);
  await sleep(1600);
  const reveal = await B.eval(`[document.getElementById('hrRevealK').textContent, document.getElementById('hrRevealWho').textContent, document.getElementById('hrNextTxt').textContent, !document.getElementById('hrReveal').classList.contains('hidden')].join(' | ')`);
  check('banner reveal menyebut pemenang ronde', /Awi/.test(reveal) && /ditemukan oleh/.test(reveal), reveal);

  await until(A, `HARTA.state().race.index === 1`, 45000);
  await until(B, `HARTA.view().race.index === 1 && HARTA.view().race.status === 'running'`, 45000);
  const r2 = await raceOf(B);
  check('ronde 2 otomatis pindah ke peta kedua', r2.mapId === 'mainan', r2.mapId + '#' + r2.index);

  const t2 = await treasureOf(B);
  const walkB = await walkTo(B, t2.x, t2.z);
  check('tamu bisa berjalan ke peti di peta kedua', walkB.ok === true, JSON.stringify(walkB));
  const won2 = await until(A, `HARTA.state().race.winnerId && HARTA.state().race.winnerId !== ${lit(hostId)} ? HARTA.state().race.winnerId : ''`, 30000);
  check('klaim tamu diterima tuan rumah (pemenang ronde 2 = tamu)', won2 === guestId, 'winnerId=' + won2);
  const bAt = await A.eval(`(() => { const st = HARTA.state(); const q = st.race.racers[${lit(won2)}]; return [q.x, q.z]; })()`);
  check('posisi tamu tersinkron ke tuan rumah', Math.hypot(bAt[0] - t2.x, bAt[1] - t2.z) < 2, 'tamu di=' + JSON.stringify(bAt));

  await until(A, `HARTA.state().race.index === 2`, 45000);
  await until(B, `HARTA.view().race.index === 2 && HARTA.view().race.status === 'running'`, 45000);
  const r3 = await raceOf(A);
  check('ronde 3 memakai peta ketiga (sisa dari urutan)', r3.mapId === 'kuil', r3.mapId + '#' + r3.index);

  const t3 = await treasureOf(A);
  await walkTo(A, t3.x, t3.z);
  await until(A, `HARTA.state().race.winnerId === ${lit(hostId)}`, 30000);
  check('ronde 3 dimenangkan tuan rumah', true);

  await until(A, `HARTA.state().phase === 'over'`, 45000);
  await until(B, `!document.getElementById('over').classList.contains('hidden')`, 45000);
  const over = await A.eval(`(() => [String(!document.getElementById('overMvp').classList.contains('hidden')),
            document.getElementById('mvpName').textContent,
            document.getElementById('mvpSub').textContent,
            document.getElementById('winnerTxt').textContent,
            [...document.querySelectorAll('#rank li')].map(li => li.textContent).join(' || ')].join(' | '))()`);
  const [mvpShown, mvpName, mvpSub, winnerTxt, rank] = over.split(' | ');
  check(
    'papan akhir: banner MVP + waktu terbaik + peringkat berpoin',
    mvpShown === 'true' && /Awi|Bil/.test(mvpName) && /detik/.test(mvpSub) && /Juara/.test(winnerTxt) && /poin · .*dtk/.test(rank),
    over,
  );
  const strip = (s) => s.replace(/\(kamu\)|\|\|/g, '').replace(/\s/g, '');
  const sameRank = await B.eval(`document.getElementById('rank').textContent`);
  check('tamu melihat papan akhir yang sama', strip(sameRank) === strip(rank), sameRank);

  await A.eval(`document.getElementById('leave').click(); 1`);
  await until(B, `!document.getElementById('home').classList.contains('hidden')`, 30000);
  const disposedOf = `(function(){ return [String(window.HARTA), document.querySelectorAll('#hrLabels > *').length, String(document.getElementById('race').classList.contains('hidden'))].join(' | '); })()`;
  const disposed = await A.eval(disposedOf);
  check('keluar kamar membuang dunia 3D + label bersih', disposed === 'undefined | 0 | true', disposed);
  const disposedGuest = await B.eval(disposedOf);
  check('tamu ikut membuang dunia 3D saat kamarnya ditutup', disposedGuest === 'undefined | 0 | true', disposedGuest);

  await A.eval(`document.getElementById('create').click(); 1`);
  const code2 = await until(A, inLobby, 40000);
  await B.eval(`document.getElementById('code').value=${lit(code2)}; document.getElementById('join').click(); 1`);
  // Baris pemain kamar lama masih tertinggal di DOM, jadi tunggu kodenya yang ganti.
  const joined2 = await until(
    B,
    `document.getElementById('lobbyCode').textContent.trim() === ${lit(code2)} && document.querySelectorAll('#lobbyPlayers li').length >= 2`,
    30000,
  );
  const cards2 = [await A.eval(mapCardCount), await B.eval(mapCardCount)];
  check('tamu bisa masuk kamar kedua', joined2 === true, 'kode=' + code2);
  check('ruang tunggu kamar kedua membangun ulang kartu tempat', cards2[0] === 3 && cards2[1] === 3, 'tuan=' + cards2[0] + ' tamu=' + cards2[1]);
  await A.eval(`document.getElementById('start').click(); 1`);
  const rid2 = await until(A, `HARTA.view() && HARTA.view().race ? HARTA.view().race.id : ''`, 40000);
  let race2 = false;
  try {
    race2 = await until(B, `HARTA.view() && HARTA.view().race && HARTA.view().race.id === ${lit(rid2)} && HARTA.dbg().drawCalls > 0`, 40000);
  } catch (e) {
    console.log('diag re-entry A: ' + (await A.eval(stateDump)));
    console.log('diag re-entry B: ' + (await B.eval(stateDump)));
    throw e;
  }
  check('kamar 3D bisa dipakai lagi setelah keluar (ronde baru dirender di kedua tab)', race2 === true && (await A.eval(`HARTA.dbg().drawCalls > 0`)) === true, 'race=' + rid2);

  check('tidak ada error runtime sepanjang sesi', A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 6).join(' | '));
} catch (e) {
  failed++;
  console.log('ERROR E2E:', e.message);
  console.log('error tab A:', A.errors.slice(0, 6));
  console.log('error tab B:', B.errors.slice(0, 6));
}

console.log(failed === 0 ? '\nE2E HARTA: SEMUA LULUS' : `\nE2E HARTA: ${failed} MASALAH`);
for (const p of procs) p.kill('SIGTERM');
process.exit(failed === 0 ? 0 : 1);
