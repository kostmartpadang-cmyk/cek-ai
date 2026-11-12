// Harness sementara (di luar repo): mengemudi 2 Chrome headless lewat CDP untuk uji E2E.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173/';
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
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval gagal: ' + JSON.stringify(r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }
  submit(field, value) {
    return this.eval(`(() => {
      const i = document.getElementById('${field}');
      i.value = ${JSON.stringify(value)};
      i.form.dispatchEvent(new Event('submit', { cancelable: true }));
      return 1;
    })()`);
  }
}

async function until(tab, expr, timeout = 25000, every = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await tab.eval(expr);
    if (v) return v;
    await sleep(every);
  }
  const diag = await tab
    .eval(`[document.getElementById('homeErr').textContent, document.getElementById('toast').textContent].join(' / ')`)
    .catch(() => '?');
  throw new Error(`timeout: ${expr}\n   diag: ${diag}`);
}

function launch(port) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-'));
  return spawn(
    CHROME,
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: 'ignore' },
  );
}

const procs = [launch(9441), launch(9442)];
async function waitPort(port, timeout = 40000) {
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
await waitPort(9441);
await waitPort(9442);

const A = new Tab(9441);
const B = new Tab(9442);
await A.connect();
await B.connect();

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
};

try {
  await A.goto(BASE);
  await B.goto(BASE);
  check('halaman + modul termuat tanpa error', A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].join(' | '));

  await A.eval(`document.getElementById('name').value='Awi'; document.getElementById('create').click(); 1`);
  const code = await until(A, `document.querySelector('#lobby:not(.hidden)') ? document.getElementById('lobbyCode').textContent.trim() : ''`);
  check('tuan rumah membuat kamar, dapat kode 4 huruf', /^[A-Z]{4}$/.test(code), 'kode=' + code);

  await B.eval(`document.getElementById('name').value='Bil'; document.getElementById('code').value='${code}'; document.getElementById('join').click(); 1`);
  await until(B, `document.querySelectorAll('#lobbyPlayers li').length >= 2`);
  check('tamu masuk lewat kode, lobby menunjukkan 2 pemain', true);

  await A.eval(`document.getElementById('start').click(); 1`);
  await until(A, `!document.getElementById('play').classList.contains('hidden')`);
  await until(B, `!document.getElementById('play').classList.contains('hidden')`);
  const isLeader = await A.eval(`!document.getElementById('secretCard').classList.contains('hidden')`);
  const secretA = await A.eval(`document.getElementById('secretWord').textContent.trim()`);
  const maskB = await until(B, `document.getElementById('mask').textContent.trim()`);
  check('pemimpin melihat kata rahasia', isLeader && secretA.length > 0, 'kata=' + secretA);
  check('tamu hanya melihat topeng huruf (anti-spoiler)', maskB.includes('·') && !maskB.toLowerCase().includes(secretA.toLowerCase()), 'mask=' + maskB);
  check('timer berjalan di sisi tamu', Number(await B.eval(`document.getElementById('timerTxt').textContent`)) > 40);

  const hint = 'benda sehari-hari';
  await A.submit('hintText', hint);
  await until(B, `[...document.querySelectorAll('#hintList li')].some(li => li.textContent === ${JSON.stringify(hint)})`);
  check('petunjuk pemimpin terkirim ke tamu lewat WebRTC', true);

  await A.submit('hintText', secretA);
  await sleep(600);
  const toastA = await A.eval(`document.getElementById('toast').textContent`);
  check('petunjuk yang membocorkan kata ditolak', /tidak boleh mengandung kata rahasia/i.test(toastA), 'toast=' + toastA);

  await B.submit('guessText', 'kata salah');
  await until(A, `document.getElementById('feed').textContent.includes('kata salah')`);
  check('tebakan salah muncul di feed tuan rumah', true);

  await B.submit('guessText', secretA);
  await until(B, `!document.getElementById('reveal').classList.contains('hidden')`);
  const revealed = await B.eval(`document.getElementById('revealWord').textContent.trim()`);
  const scoresB = await B.eval(`[...document.querySelectorAll('#scores .chip')].map(c=>c.textContent).join(' | ')`);
  const scoresA = await A.eval(`[...document.querySelectorAll('#scores .chip')].map(c=>c.textContent).join(' | ')`);
  check('tebakan benar membuka kata (reveal tampil di kedua sisi)', revealed.toLowerCase() === secretA.toLowerCase(), 'reveal=' + revealed);
  check('poin tersinkron dua arah', /Bil\s+\d{2,}/.test(scoresB) && /Bil\s+\d{2,}/.test(scoresA), 'A:' + scoresA + '  B:' + scoresB);

  await until(B, `document.getElementById('rIdx').textContent === '2'`, 20000);
  const leaderNowB = await B.eval(`!document.getElementById('secretCard').classList.contains('hidden')`);
  check('ronde 2 otomatis + giliran pemimpin berpindah ke tamu', leaderNowB === true);

  const secretB = await B.eval(`document.getElementById('secretWord').textContent.trim()`);
  await B.eval(`document.getElementById('giveup').click(); 1`);
  await until(A, `document.getElementById('reveal').textContent.includes(${JSON.stringify(secretB)})`, 15000);
  check('tombol menyerah pemimpin membuka kata ke semua orang', true);

  await until(A, `!document.getElementById('over').classList.contains('hidden')`, 20000);
  const winner = await A.eval(`document.getElementById('winnerTxt').textContent`);
  const rank = await A.eval(`document.getElementById('rank').textContent`);
  check('permainan selesai dengan 2 ronde dan papan akhir', /Bil/.test(winner) && /poin/.test(rank), winner + ' :: ' + rank);

  await B.eval(`document.getElementById('again') && 1`);
  const canAgain = await A.eval(`!document.getElementById('again').classList.contains('hidden')`);
  check('tuan rumah ditawari Main Lagi', canAgain === true);

  await A.eval(`document.getElementById('again').click(); 1`);
  await until(B, `!document.getElementById('play').classList.contains('hidden') && document.getElementById('rIdx').textContent === '1'`, 15000);
  const afterRematch = await B.eval(`[...document.querySelectorAll('#scores .chip')].map(c=>c.textContent).join(' | ')`);
  check('rematch memulai ronde 1 dengan skor nol di kedua sisi', /Bil 0/.test(afterRematch), afterRematch);

  await A.eval(`document.getElementById('leave').click(); 1`);
  await until(B, `!document.getElementById('home').classList.contains('hidden')`, 15000);
  check('tuan rumah keluar → tamu otomatis kembali ke beranda', true);

  check('tidak ada error runtime sepanjang sesi', A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 4).join(' | '));
} catch (e) {
  failed++;
  console.log('ERROR E2E:', e.message);
  console.log('error tab A:', A.errors.slice(0, 5));
  console.log('error tab B:', B.errors.slice(0, 5));
}

console.log(failed === 0 ? '\nE2E: SEMUA LULUS' : `\nE2E: ${failed} MASALAH`);
for (const p of procs) p.kill('SIGTERM');
process.exit(failed === 0 ? 0 : 1);
