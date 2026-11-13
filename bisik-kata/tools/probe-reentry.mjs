// Probe sementara: hanya menguji re-entry (dispose → attach) mode harta. Habis dipakai dihapus.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Tab {
  constructor(port) { this.port = port; this.id = 1; this.waiters = new Map(); this.errors = []; }
  async connect() {
    const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.waiters.has(msg.id)) { const { res, rej } = this.waiters.get(msg.id); this.waiters.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
      if (msg.method === 'Runtime.exceptionThrown') this.errors.push('EX: ' + (msg.params.exceptionDetails.exception?.description || msg.params.text));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') this.errors.push('CON: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }
  send(method, params = {}) { const id = this.id++; return new Promise((res, rej) => { this.waiters.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('eval gagal: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url) { await this.send('Page.navigate', { url }); await sleep(2500); }
}
async function until(tab, expr, timeout = 30000, every = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await tab.eval(expr)) return true; await sleep(every); }
  return false;
}
function launch(port) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-probe-'));
  return spawn(CHROME, ['--headless=new', '--no-sandbox', '--mute-audio', '--no-first-run', '--window-size=900,700', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
}
const procs = [launch(9461), launch(9462)];
async function waitPort(port) { const t0 = Date.now(); while (Date.now() - t0 < 60000) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch (e) {} await sleep(1000); } throw new Error('chrome not ready'); }
await waitPort(9461); await waitPort(9462);
const A = new Tab(9461), B = new Tab(9462);
await A.connect(); await B.connect();

const dump = `(JSON.stringify({harta: !!window.HARTA, dbg: window.HARTA && HARTA.dbg ? HARTA.dbg() : 'nofn', screens: ['home','busy','lobby','race','over'].filter(n => !document.getElementById(n).classList.contains('hidden')), lobbyCode: document.getElementById('lobbyCode').textContent, pl: document.querySelectorAll('#lobbyPlayers li').length, state: window.HARTA && HARTA.state && HARTA.state() ? [HARTA.state().code, HARTA.state().players.length, HARTA.state().phase] : null, canvas: (() => { const c = document.getElementById('gl'); return c ? [c.isConnected, c.width, c.height, c.clientWidth, c.clientHeight] : null; })(), load: !document.getElementById('hrLoad').classList.contains('hidden'), nogl: !document.getElementById('hrNogl').classList.contains('hidden'), view: window.HARTA && HARTA.view ? ((HARTA.view() || {}).phase || null) : null, err: document.getElementById('homeErr').textContent, toast: document.getElementById('toast').textContent}))`;

await A.goto(BASE); await B.goto(BASE);
await A.eval(`document.getElementById('modeHarta').click(); document.getElementById('name').value='Awi'; document.getElementById('create').click(); 1`);
const ok1 = await until(A, `!document.getElementById('lobby').classList.contains('hidden')`);
console.log('lobby 1:', ok1, await A.eval(dump));
const code = await A.eval(`document.getElementById('lobbyCode').textContent.trim()`);
await B.eval(`document.getElementById('name').value='Bil'; document.getElementById('code').value='${code}'; document.getElementById('join').click(); 1`);
await until(B, `document.querySelectorAll('#lobbyPlayers li').length >= 2`);
await A.eval(`document.getElementById('start').click(); 1`);
await until(A, `window.HARTA && HARTA.dbg && HARTA.dbg() && HARTA.dbg().drawCalls > 0`, 40000);
console.log('race 1:', await A.eval(dump));
await A.eval(`document.getElementById('leave').click(); 1`);
await sleep(1500);
console.log('after leave:', await A.eval(dump));
await A.eval(`document.getElementById('create').click(); 1`);
await until(A, `!document.getElementById('lobby').classList.contains('hidden')`, 40000);
console.log('lobby 2:', await A.eval(dump));
const code2 = await A.eval(`document.getElementById('lobbyCode').textContent.trim()`);
await B.eval(`document.getElementById('code').value='${code2}'; document.getElementById('join').click(); 1`);
console.log('host sees 2:', await until(A, `window.HARTA && HARTA.state && HARTA.state().players.length >= 2`, 30000));
await A.eval(`document.getElementById('start').click(); 1`);
await sleep(6000);
console.log('race 2:', await A.eval(dump));
await sleep(6000);
console.log('race 2 again:', await A.eval(dump));
console.log('guest 2:', await B.eval(dump));
console.log('errors A:', A.errors.slice(0, 5), 'B:', B.errors.slice(0, 5));
for (const p of procs) p.kill('SIGTERM');
process.exit(0);
