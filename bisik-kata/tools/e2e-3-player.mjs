// Uji E2E 3 pemain: rotasi pemimpin, balapan tebakan, koneksi tamu kedua.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173/';
const PORTS = [9551, 9552, 9553];
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
      if (msg.method === 'Runtime.exceptionThrown') this.errors.push('EX: ' + (msg.params.exceptionDetails.exception?.description || ''));
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
    if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.text);
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2200);
  }
}

async function until(tab, expr, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await tab.eval(expr);
    if (v) return v;
    await sleep(400);
  }
  throw new Error('timeout di port ' + tab.port + ': ' + expr);
}

const procs = PORTS.map((port) => {
  const dir = mkdtempSync(join(tmpdir(), 'cdp3-'));
  return spawn(
    CHROME,
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'],
    { stdio: 'ignore' },
  );
});

for (const port of PORTS) {
  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 40000 && !up) {
    try {
      up = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch (e) {
      await sleep(1000);
    }
  }
  if (!up) throw new Error('chrome ' + port + ' tidak siap');
}

const [A, B, C] = PORTS.map((p) => new Tab(p));
for (const t of [A, B, C]) await t.connect();

let failed = 0;
const check = (n, c, x = '') => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`);
  if (!c) failed++;
};

try {
  await A.goto(BASE);
  await B.goto(BASE);
  await C.goto(BASE);

  await A.eval(`document.getElementById('name').value='Ana'; document.getElementById('create').click(); 1`);
  const code = await until(A, `document.querySelector('#lobby:not(.hidden)') ? document.getElementById('lobbyCode').textContent.trim() : ''`);
  check('kamar dibuat', /^[A-Z]{4}$/.test(code), code);

  for (const [tab, nm] of [[B, 'Bil'], [C, 'Cik']]) {
    await tab.eval(`document.getElementById('name').value='${nm}'; document.getElementById('code').value='${code}'; document.getElementById('join').click(); 1`);
  }
  await until(A, `document.querySelectorAll('#lobbyPlayers li').length === 3`);
  check('3 pemain terdaftar di lobby tuan rumah', true);
  await until(C, `document.querySelectorAll('#lobbyPlayers li').length === 3`);
  check('tamu ketiga melihat roster lengkap', true);

  await A.eval(`document.getElementById('start').click(); 1`);
  await until(A, `!document.getElementById('play').classList.contains('hidden')`);
  const word1 = await until(A, `document.getElementById('secretWord').textContent.trim()`);
  check('ronde 1 dipimpin tuan rumah', word1.length > 0, 'kata=' + word1);

  await A.eval(`(() => { const i=document.getElementById('hintText'); i.value='petunjuk tes'; i.form.dispatchEvent(new Event('submit',{cancelable:true})); return 1 })()`);
  for (const t of [B, C]) await until(t, `document.getElementById('hintList').textContent.includes('petunjuk tes')`);
  check('petunjuk sampai ke kedua tamu', true);

  await C.eval(`(() => { const i=document.getElementById('guessText'); i.value=${JSON.stringify(word1)}; i.form.dispatchEvent(new Event('submit',{cancelable:true})); return 1 })()`);
  await B.eval(`(() => { const i=document.getElementById('guessText'); i.value='salah total'; i.form.dispatchEvent(new Event('submit',{cancelable:true})); return 1 })()`);
  await until(A, `!document.getElementById('reveal').classList.contains('hidden')`);
  const chipsA = await until(A, `[...document.querySelectorAll('#scores .chip')].map(c=>c.textContent).join(' | ')`);
  const chipsC = await C.eval(`[...document.querySelectorAll('#scores .chip')].map(c=>c.textContent).join(' | ')`);
  check('yang menebak benar dulu yang dapat poin', /Cik\s+1\d{2}/.test(chipsA) && /Bil\s+0/.test(chipsA), chipsA);
  check('skor tamu juga tersinkron', chipsC === chipsA, chipsC);

  const byName = { Ana: A, Bil: B, Cik: C };
  for (let round = 2; round <= 3; round++) {
    await until(A, `document.getElementById('rIdx').textContent === '${round}'`, 35000);
    const note = await until(A, `document.getElementById('leaderNote').textContent`, 5000);
    const leaderName = note.split(' ')[0];
    const tab = byName[leaderName];
    const others = [A, B, C].filter((t) => t !== tab);
    check(`ronde ${round}: pemimpin adalah salah satu pemain (${leaderName})`, !!tab, note);
    const word = await until(tab, `document.getElementById('secretWord').textContent.trim()`, 20000);
    const masked = await others[0].eval(`document.getElementById('mask').textContent.trim()`);
    check(`ronde ${round}: kata rahasia hanya tampil di pemimpin`, word.length > 0 && masked.includes('.') === false && !masked.toLowerCase().includes(word.toLowerCase()), `leader=${leaderName}:${word} mask=${masked}`);
    await tab.eval(`document.getElementById('giveup').click(); 1`);
    for (const t of others) await until(t, `document.getElementById('revealWord').textContent.trim() === ${JSON.stringify(word)}`, 25000);
    check(`ronde ${round}: kata dibuka ke semua sisi`, true);
  }

  await until(A, `!document.getElementById('over').classList.contains('hidden')`, 25000);
  const rankA = await until(A, `document.getElementById('rank').textContent`);
  const rankC = await C.eval(`document.getElementById('rank').textContent`);
  const strip = (x) => x.replace(/\s*\(kamu\)/g, '');
  check('papan akhir sama di tuan rumah & tamu (hanya label "kamu" yang beda)', strip(rankA) === strip(rankC), strip(rankA) + ' :: ' + strip(rankC));
  check('tidak ada error runtime (3 sisi)', [A, B, C].every((t) => t.errors.length === 0), [A, B, C].flatMap((t) => t.errors).slice(0, 3).join(' | '));
} catch (e) {
  failed++;
  console.log('ERROR:', e.message);
  for (const t of [A, B, C]) if (t.errors.length) console.log(t.port, t.errors.slice(0, 3));
}

console.log(failed === 0 ? '\nE2E 3 PEMAIN: SEMUA LULUS' : `\nE2E 3 PEMAIN: ${failed} MASALAH`);
for (const p of procs) p.kill('SIGTERM');
process.exit(failed ? 1 : 0);
