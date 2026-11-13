import { CFG, onFound, onMove, onSonar, tick } from './logic.js';
import { CFG as M, MAPS, layoutFor, resolveFeet, supportAt, insideSolid, zoneAt } from './maps.js';
import { createWorld } from './world.js';
import { createControls } from './controls.js';

const $ = (id) => document.getElementById(id);
const q1 = (v) => Math.round(v * 10) / 10;
const q2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const nowMs = () => Date.now();

const BANDS = [
  { max: 8, label: 'Membakar', k: 1 },
  { max: 15, label: 'Panas', k: 0.8 },
  { max: 26, label: 'Hangat', k: 0.6 },
  { max: 45, label: 'Sejuk', k: 0.35 },
  { max: 70, label: 'Dingin', k: 0.18 },
  { max: Infinity, label: 'Beku', k: 0.06 },
];

let R = null;

function node(k) {
  return R ? R.e[k] : null;
}

function setTxt(node, text) {
  if (!node) return;
  const v = text == null ? '' : String(text);
  if (node.textContent !== v) node.textContent = v;
}

function sig(node, value) {
  const v = String(value);
  if (node.dataset.sig === v) return true;
  node.dataset.sig = v;
  return false;
}

const hostNow = () => (R && R.view ? R.view.nowHost + (nowMs() - R.viewAt) : nowMs());

function beep(freq, dur, gain, type, delay) {
  if (R && R.ctx.tone) R.ctx.tone(freq, delay || 0, dur || 0.1, gain || 0.05, type || 'triangle');
}

function fanfare() {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.24, 0.055, 'triangle', i * 0.09));
}

function big(kind, main, sub) {
  const b = node('big');
  if (!b) return;
  if (!main) {
    b.classList.remove('show');
    return;
  }
  const txt = document.createElement('span');
  txt.className = 'hr-big-txt';
  txt.textContent = main;
  b.textContent = '';
  b.append(txt);
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    b.append(s);
  }
  b.dataset.k = kind;
  b.classList.add('show');
  R.bigUntil = nowMs();
}

function freshMe() {
  const v = R.view;
  if (!v || !v.you) return null;
  return v.race ? v.race.racers.find((p) => p.id === v.you.id) : null;
}

function buildTrack(v) {
  const box = node('track');
  if (!box || !v.race) return;
  const rows = v.race.racers;
  const key = rows.map((r) => r.id + (r.ms || 0) + (r.finished ? 'f' : '') + (r.dnf ? 'd' : '') + (r.gone ? 'g' : '')).join(',');
  if (sig(box, key)) {
    box.textContent = '';
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'hr-tc' + (r.id === v.you.id ? ' me' : '') + (r.finished ? ' done' : '') + (r.dnf || r.gone ? ' dnf' : '');
      row.style.setProperty('--c', r.color);
      const dot = document.createElement('span');
      dot.className = 'hr-tc-dot';
      const nm = document.createElement('span');
      nm.className = 'hr-tc-name';
      nm.textContent = r.name;
      const ms = document.createElement('span');
      ms.className = 'hr-tc-ms';
      row.append(dot, nm, ms);
      row._ms = ms;
      box.append(row);
    }
  }
  const leadId = (rows.find((r) => r.ms > 0) || {}).id || null;
  rows.forEach((r, i) => {
    const row = box.children[i];
    if (!row) return;
    const live = r.ms > 0 ? '' : v.race.status === 'running' ? (Math.max(0, hostNow() - v.race.goAt) / 1000).toFixed(1) + 's' : '—';
    setTxt(row._ms, r.ms > 0 ? (r.ms / 1000).toFixed(1) + 's' : live);
    row.classList.toggle('lead', r.id === (leadId || (v.you && v.you.id)));
  });
}

function buildReveal(v) {
  const box = node('reveal');
  if (!box) return;
  const open = v.phase === 'reveal' && !!v.race;
  box.classList.toggle('hidden', !open);
  if (!open) return;
  const r = v.race;
  const key = r.id + '|' + (r.winnerId || '') + '|' + r.results.length;
  if (!sig(box, key)) return;
  setTxt(node('revealK'), r.winnerId ? 'Peti emas ditemukan oleh' : 'Peti emas tidak ditemukan');
  setTxt(node('revealWho'), r.winnerName || '—');
  const ol = node('roundRank');
  ol.textContent = '';
  const done = r.results.map((x) => ({ name: x.name, ms: x.ms }));
  const rest = r.racers.filter((p) => !p.ms && !p.dnf && !p.gone).map((p) => ({ name: p.name, ms: 0 }));
  for (const x of [...done, ...rest]) {
    const li = document.createElement('li');
    const i = document.createElement('i');
    const nm = document.createTextNode(x.name);
    const b = document.createElement('b');
    b.textContent = x.ms ? (x.ms / 1000).toFixed(1) + ' dtk' : 'belum ketemu';
    li.append(i, nm, b);
    ol.append(li);
  }
  [...ol.children].forEach((li, i) => (li.firstChild.textContent = String(i + 1)));
  setTxt(node('nextTxt'), r.index + 1 < r.total ? 'Bersiap, tempat berikutnya…' : 'Menghitung total poin…');
}

function labelNode(id, name, color) {
  let np = R.labels.get(id);
  if (!np) {
    np = document.createElement('div');
    np.className = 'hr-np';
    const chip = document.createElement('span');
    chip.className = 'hr-np-name';
    np.append(chip);
    R.labels.set(id, np);
    node('labels').append(np);
  }
  if (np._k !== name + '|' + color) {
    np._k = name + '|' + color;
    np.style.setProperty('--c', color);
    setLabel(np, name);
  }
  return np;
}

function setLabel(np, text) {
  np.firstChild.textContent = text;
}

function syncRound(v) {
  const r = v.race;
  if (!r || r.id === R.raceId) return;
  R.raceId = r.id;
  R.layout = layoutFor(r.mapId, r.seed);
  R.world.loadLayout(R.layout);
  R.world.clearAvatars();
  R.remote.clear();
  R.claimed = false;
  R.winFx = false;
  R.cdShown = null;
  R.arrowUntil = 0;
  R.wantSnap = nowMs() + 400;
  const i = v.players.findIndex((p) => p.id === v.you.id);
  const sp = R.layout.spawns[Math.max(0, i) % R.layout.spawns.length];
  R.me.x = sp.x;
  R.me.z = sp.z;
  R.me.y = 0;
  R.me.sup = 0;
  R.me.vy = 0;
  R.me.air = false;
  R.me.zone = 0;
  R.me.a = Math.atan2(R.layout.treasure.x - sp.x, R.layout.treasure.z - sp.z) + Math.PI;
  R.world.camState.yaw = R.me.a;
  R.world.camState.pitch = 0.42;
  R.meDist = Math.hypot(R.me.x - R.layout.treasure.x, R.me.z - R.layout.treasure.z);
  big(null);
}

function sendMove() {
  const msg = { t: 'mv', x: q1(R.me.x), z: q1(R.me.z), a: q2(R.me.a), y: q2(R.me.y), s: R.moveS, j: R.me.air ? 1 : 0 };
  R.lastSent = msg;
  if (R.isHost()) {
    const st = R.ctx.state();
    if (st && st.race) onMove(st, R.myId(), msg, nowMs());
  } else if (R.net()) R.net().send(msg);
}

function relayPackets() {
  if (!R.isHost()) return;
  const st = R.ctx.state();
  const net = R.net();
  if (!st || !st.race || !net || !net.send) return;
  const rows = [];
  for (const p of st.players) {
    const q = st.race.racers[p.id];
    if (!q) continue;
    rows.push([p.id, q1(q.x), q1(q.z), q2(q.a), q.s || 0, q.j ? 1 : 0, q2(q.y || 0)]);
  }
  const msg = { t: 'p', r: rows };
  for (const p of st.players) if (p.id !== st.hostId) net.send(p.id, msg);
}

export function message(id, msg) {
  if (!R || !msg) return false;
  if (!R.isHost()) {
    if (msg.t !== 'p' || !Array.isArray(msg.r)) return false;
    for (const row of msg.r) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const [pid, x, z, a, s, j, y] = row;
      if (pid === R.myId() || !Number.isFinite(x) || !Number.isFinite(z)) continue;
      const q = R.remote.get(pid) || { x: 0, z: 0, a: 0, y: 0, vx: 0, vz: 0, t: 0 };
      const now = nowMs();
      const dt = (now - q.t) / 1000;
      if (dt > 0.02 && Math.hypot(x - q.x, z - q.z) < 8) {
        q.vx = (x - q.x) / dt;
        q.vz = (z - q.z) / dt;
      }
      q.x = x;
      q.z = z;
      q.a = Number.isFinite(+a) ? +a : q.a;
      q.y = Number.isFinite(+y) ? +y : q.y;
      q.s = +s || 0;
      q.j = !!j;
      q.t = now;
      R.remote.set(pid, q);
    }
    return true;
  }
  const st = R.ctx.state();
  if (!st || !st.race) return false;
  const ts = nowMs();
  if (msg.t === 'mv') {
    onMove(st, id, msg, ts);
    return true;
  }
  if (msg.t === 'found') {
    const res = onFound(st, id, msg, ts);
    if (!res.ok && res.error && R.net()) R.net().send(id, { t: 'toast', msg: res.error });
    return true;
  }
  if (msg.t === 'sonar') {
    const res = onSonar(st, id, ts);
    if (!res.ok && res.error && R.net()) R.net().send(id, { t: 'toast', msg: res.error });
    return true;
  }
  return false;
}

function claim() {
  const v = R.view;
  const ms = v && v.race ? Math.max(0, hostNow() - v.race.goAt) : 0;
  if (R.isHost()) {
    const st = R.ctx.state();
    const res = onFound(st, R.myId(), { ms }, nowMs());
    if (!res.ok) {
      R.claimed = false;
      if (res.error && R.ctx.toast) R.ctx.toast(res.error, true);
      return;
    }
  } else if (R.net()) R.net().send({ t: 'found', ms });
  fanfare();
}

function useSonar() {
  const mine = freshMe();
  if (!mine || mine.sonar <= 0) {
    if (R.ctx.toast) R.ctx.toast('Sonar habis (2 kali per ronde).', true);
    return false;
  }
  if (R.isHost()) onSonar(R.ctx.state(), R.myId(), nowMs());
  else if (R.net()) R.net().send({ t: 'sonar' });
  R.arrowUntil = nowMs() + 3000;
  R.cdUntil = nowMs() + 1400;
  beep(880, 0.07, 0.05);
  beep(1320, 0.13, 0.045, 'sine', 0.08);
  return true;
}

function stepPhysics(dt, canMove) {
  if (!R.layout) return;
  const inp = canMove ? R.controls.read() : { x: 0, z: 0, run: false, moving: false };
  const yaw = R.world.camState.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = -fz;
  const rz = fx;
  let vx = rx * inp.x + fx * inp.z;
  let vz = rz * inp.x + fz * inp.z;
  const mag = Math.min(1, Math.hypot(inp.x, inp.z));
  const zone = zoneAt(R.layout, R.me.x, R.me.z);
  if (zone !== R.me.zone) {
    if (zone === 1) beep(165, 0.14, 0.028, 'triangle');
    R.me.zone = zone;
  }
  R.moveS = mag > 0.08 ? (inp.run ? 2 : 1) : 0;
  const speed = (inp.run ? CFG.runSpeed : CFG.walkSpeed) * mag * (zone === 1 ? M.slowMul : zone === 2 ? M.pitMul : 1);
  const solved = resolveFeet(R.layout, R.me.x + vx * speed * dt, R.me.z + vz * speed * dt, M.playerR, R.me.y);
  // Tepi lubang berperilaku seperti dinding selama kaki masih di bawah lantai: satu-satunya jalan
  // keluar adalah melompat. Tanpa ini, melangkah ke bibir lubang berarti naik sendiri menembus lantai.
  const tepiLubang = R.me.y < -0.02 && zoneAt(R.layout, solved.x, solved.z) !== 2;
  if (!tepiLubang && !insideSolid(R.layout, solved.x, solved.z, R.me.y)) {
    R.me.x = solved.x;
    R.me.z = solved.z;
  }
  if (mag > 0.1) {
    const want = Math.atan2(vx, vz);
    let da = want - R.me.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    R.me.a += da * Math.min(1, dt * 16);
  }
  const sup = supportAt(R.layout, R.me.x, R.me.z);
  R.me.sup = sup;
  if (R.me.air) {
    R.me.vy -= 22 * dt;
    R.me.y += R.me.vy * dt;
    // Turun dan kaki sudah di bawah pijakan = mendarat. Tidak perlu syarat "tadi di atasnya": benda
    // yang lebih tinggi dari satu langkah sudah mendorong kita keluar, jadi pijakan yang melompat ke
    // atas sini selalu sebesar langkah atau mulut lubang — dan tanpa itu, keluar lubang sambil melayang
    // akan membuat kita tembus lantai.
    if (R.me.vy <= 0 && R.me.y <= sup) {
      R.me.y = sup;
      R.me.vy = 0;
      R.me.air = false;
      beep(sup < 0 ? 58 : sup > 0.4 ? 96 : 120, sup < 0 ? 0.16 : 0.1, 0.045, 'sawtooth');
    }
  } else if (sup > R.me.y + 0.02) {
    if (sup - R.me.y <= M.stepH + 0.06) R.me.y = sup;
  } else if (sup < R.me.y - 0.02) {
    R.me.air = true;
    R.me.vy = 0;
  } else {
    R.me.y = sup;
  }
  const d = Math.hypot(R.me.x - R.layout.treasure.x, R.me.z - R.layout.treasure.z);
  R.meDist = d;
  if (d > CFG.touchRadius * 1.8) R.claimed = false;
  if (canMove && !R.claimed && d <= CFG.touchRadius) {
    R.claimed = true;
    claim();
  }
}

function updateAvatars(v, dt) {
  const keep = new Set();
  for (const p of v.race.racers) {
    if (p.gone || p.dnf) continue;
    keep.add(p.id);
    let x = p.x;
    let z = p.z;
    let a = p.a;
    let y = p.y || 0;
    let s = p.s;
    let j = p.j;
    if (p.id === v.you.id) {
      x = R.me.x;
      z = R.me.z;
      a = R.me.a;
      y = R.me.y;
      s = R.moveS;
      j = R.me.air;
    } else {
      const q = R.remote.get(p.id);
      if (q && nowMs() - q.t < 900) {
        const age = Math.min(0.12, (nowMs() - q.t) / 1000);
        x = q.x + q.vx * age;
        z = q.z + q.vz * age;
        a = q.a;
        y = q.y || 0;
        s = q.s;
        j = q.j;
      }
    }
    R.world.upsertAvatar({
      id: p.id,
      color: p.color,
      x,
      z,
      a,
      y,
      s,
      j,
      me: p.id === v.you.id,
      snap: nowMs() < R.wantSnap,
      winner: v.race.winnerId === p.id,
    });
  }
  for (const id of [...R.world.avatars.keys()]) if (!keep.has(id)) R.world.dropAvatar(id);
}

function drawLabels(v, w, h) {
  for (const p of v.race.racers) {
    if (p.gone || p.dnf) continue;
    const np = labelNode(p.id, p.name, p.color);
    np.classList.toggle('me', p.id === v.you.id);
    np.classList.toggle('win', v.race.winnerId === p.id);
    const q = R.remote.get(p.id);
    const x = p.id === v.you.id ? R.me.x : q ? q.x : p.x;
    const z = p.id === v.you.id ? R.me.z : q ? q.z : p.z;
    const y = p.id === v.you.id ? R.me.y : q ? q.y || 0 : p.y || 0;
    const s = R.world.project(x, 2.7 + y, z, w, h);
    if (!s.vis) {
      np.style.opacity = '0';
      continue;
    }
    const near = Math.hypot(x - R.me.x, z - R.me.z);
    np.style.opacity = String(clamp(1.2 - near / 44, 0.2, 1));
    np.style.transform = `translate3d(${Math.round(s.x)}px,${Math.round(s.y)}px,0) translate(-50%,-50%)`;
  }
  const live = new Set(v.race.racers.map((p) => p.id));
  for (const [id, np] of R.labels)
    if (!live.has(id)) {
      np.remove();
      R.labels.delete(id);
    }
}

function drawArrow(v) {
  const a = node('arrow');
  if (!a) return;
  const on = R.arrowUntil > nowMs() && !!R.layout;
  a.classList.toggle('hidden', !on);
  if (!on) return;
  const t = R.layout.treasure;
  const yaw = R.world.camState.yaw;
  const ahead = -(t.x - R.me.x) * Math.sin(yaw) - (t.z - R.me.z) * Math.cos(yaw);
  const side = (t.x - R.me.x) * Math.cos(yaw) - (t.z - R.me.z) * Math.sin(yaw);
  const deg = (Math.atan2(side, ahead) * 180) / Math.PI;
  a.firstChild.style.rotate = Math.round(deg) + 'deg';
}

function drawHeat(v, dt) {
  const heat = node('heat');
  const running = v.race.status === 'running' && !v.race.treasure;
  if (heat) heat.classList.toggle('hidden', !running || R.meDist == null);
  if (!running || R.meDist == null) {
    R.world.setSpot(v.race.treasure ? 1 : 0);
    return;
  }
  const d = R.meDist;
  const band = BANDS.find((b) => d <= b.max) || BANDS[BANDS.length - 1];
  node('heatFill').style.width = Math.round(band.k * 100) + '%';
  setTxt(node('heatTxt'), band.label);
  heat.classList.toggle('hot', band.k >= 0.6);
  heat.classList.toggle('burn', band.k >= 0.8);
  const spot = clamp(1 - (d - CFG.touchRadius) / (CFG.spotRadius - CFG.touchRadius), 0, 1);
  R.world.setSpot(spot);
  const gap = d < 4 ? 300 : d < 8 ? 600 : d < 14 ? 1050 : d < 24 ? 1800 : 0;
  if (!gap) {
    R.beat = 0;
    return;
  }
  R.beat += dt * 1000;
  if (R.beat >= gap) {
    R.beat = 0;
    beep(280 + (26 - Math.min(26, d)) * 20, 0.05, 0.03, 'sine');
  }
}

function updateHud(v, dt) {
  const r = v.race;
  if (!r) return;
  setTxt(node('idx'), r.index + 1);
  setTxt(node('tot'), r.total);
  setTxt(node('map'), r.mapName);

  const clock = hostNow();
  const counting = r.status === 'countdown';
  const left = counting ? r.goAt - clock : r.deadline - clock;
  const timer = node('timer');
  if (timer) {
    timer.style.setProperty('--p', clamp(left / (counting ? r.countdownMs : r.roundMs), 0, 1).toFixed(3));
    timer.classList.toggle('low', !counting && left < 15000);
  }
  setTxt(node('timerTxt'), Math.max(0, Math.ceil(left / 1000)));

  if (counting) {
    const n = String(Math.max(0, Math.ceil(left / 1000)));
    if (R.cdShown !== n) {
      R.cdShown = n;
      if (+n > 0) {
        big('count', n);
        beep(660, 0.08, 0.05);
      }
    }
  } else if (R.cdShown !== null) {
    R.cdShown = null;
    big('go', 'CARI!', 'peti emasnya tersembunyi di ' + r.mapName.toLowerCase() + ' · ' + fiturOf(r.mapId).join(' · '));
    beep(1046, 0.28, 0.07);
    R.bigUntil = nowMs() + 1600;
  }
  if (R.bigUntil && nowMs() > R.bigUntil) {
    R.bigUntil = 0;
    big(null);
  }

  const mine = r.racers.find((p) => p.id === v.you.id);
  setTxt(node('sonarN'), mine ? mine.sonar : 0);
  const sn = node('sonar');
  if (sn) sn.classList.toggle('spent', !mine || mine.sonar <= 0);
  const cd = node('sonarCd');
  if (cd) cd.style.height = Math.round(clamp((R.cdUntil - nowMs()) / 1400, 0, 1) * 100) + '%';

  drawHeat(v, dt);
  drawArrow(v);
  buildTrack(v);
  buildReveal(v);

  if (r.winnerId && !R.winFx) {
    R.winFx = true;
    R.world.orbit.on = true;
    R.world.openChest();
    R.world.setSpot(1);
    R.world.burst({ x: R.layout.treasure.x, y: 1, z: R.layout.treasure.z }, ['#ffd76b', '#e2554b', '#3fd2ff', '#4cba69', '#ffffff']);
    const ms = (r.winnerMs / 1000).toFixed(1) + ' detik';
    if (r.winnerId === v.you.id) big('win', 'KAMU DULU!', ms);
    else big('win', (r.winnerName || 'Lawan') + ' DULU!', ms);
    R.bigUntil = nowMs() + 3200;
    fanfare();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(r.winnerId === v.you.id ? [50, 60, 140] : 60);
      } catch (e) {}
    }
  }
  if (!r.winnerId) {
    R.winFx = false;
    R.world.orbit.on = false;
  }
  if (r.treasure) {
    R.world.openChest();
    R.world.setSpot(1);
  }
}

function feedTo(feed) {
  const box = node('feed');
  if (!box || !feed || !feed.length) return;
  const newest = feed[0].id;
  if (R.lastFeed === null) {
    R.lastFeed = newest;
    return;
  }
  if (newest <= R.lastFeed) return;
  for (const f of feed.filter((x) => x.id > R.lastFeed).reverse()) {
    const li = document.createElement('li');
    li.dataset.k = f.kind;
    li.textContent = f.text;
    box.prepend(li);
    while (box.children.length > 5) box.lastChild.remove();
    if (f.kind === 'found') beep(760, 0.11, 0.05);
    if (f.kind === 'go') beep(1046, 0.24, 0.06);
    if (f.kind === 'win') fanfare();
    if (f.kind === 'join') beep(520, 0.08, 0.04);
  }
  R.lastFeed = newest;
}

function loop(ts) {
  if (!R) return;
  R.raf = requestAnimationFrame(loop);
  const dt = clamp((ts - R.last) / 1000, 0.001, 0.05);
  R.last = ts;
  if (R.paused || !R.ready || !R.view) return;
  const v = R.view;
  if (!v.race || !v.you) return;

  if (R.raceId !== v.race.id) syncRound(v);
  const clock = hostNow();
  const mine = v.race.racers.find((p) => p.id === v.you.id);
  const canMove =
    (v.race.status === 'countdown' ? clock >= v.race.goAt : v.race.status === 'running') && (!mine || (!mine.finished && !mine.dnf));

  const look = R.controls.consumeLook();
  R.world.camState.yaw -= look.yaw;
  R.world.camState.pitch = clamp(R.world.camState.pitch - look.pitch, -0.22, 1.15);
  if (canMove && R.controls.consumeJump() && !R.me.air && R.me.y - R.me.sup < 0.3) {
    R.me.air = true;
    R.me.vy = 7.4;
    beep(420, 0.07, 0.035);
  }
  if (canMove && R.controls.consumeSonar()) useSonar();

  stepPhysics(dt, canMove);
  updateAvatars(v, dt);
  R.world.render(dt, ts / 1000, v.you.id);
  drawLabels(v, R.size.w, R.size.h);
  updateHud(v, dt);
  feedTo(v.feed);

  R.netAcc += dt;
  if (R.netAcc >= 0.1) {
    R.netAcc = 0;
    if (R.isHost()) {
      const st = R.ctx.state();
      const seq = st ? st.seq : 0;
      if (st && st.mode === 'harta' && st.race && tick(st, { now: nowMs() })) R.ctx.broadcast();
      else if (st && st.race && st.seq !== seq) R.ctx.broadcast();
      else if (clock - R.lastBroad > 700) {
        R.lastBroad = clock;
        R.ctx.broadcast();
      }
    }
  }
  if (R.netAcc2 === undefined) R.netAcc2 = 0;
  R.netAcc2 += dt;
  if (R.netAcc2 >= 1 / 12) {
    R.netAcc2 = 0;
    if (v.race.status !== 'done' && v.you) sendMove();
    relayPackets();
  }
}

function resize() {
  if (!R || !R.world) return;
  const c = node('canvas');
  if (!c) return;
  const w = c.clientWidth || window.innerWidth;
  const h = c.clientHeight || window.innerHeight;
  if (!w || !h) return;
  R.size = { w, h };
  const pr = R.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.6 : 2);
  R.world.resize(w, h, pr);
  const help = node('help');
  if (help && !sig(help, R.touch ? 't' : 'k'))
    setTxt(help, R.touch ? 'Geser kiri untuk jalan · geser kanan untuk memutar kamera · Lompat untuk naik ke peti rendah atau keluar dari lubang' : 'WASD jalan · Shift lari · Spasi lompat (naik ke peti rendah, keluar dari lubang) · E sonar · klik layar untuk mengunci kamera ke mouse, Esc untuk lepas');
}

export function view(v) {
  if (!R) return;
  const prev = R.view && R.view.race ? R.view.race.id : null;
  R.view = v;
  R.viewAt = nowMs();
  if (!R.ready || !v.race || !v.you) return;
  if (v.race.id !== prev && R.raceId !== v.race.id) syncRound(v);
  R.world.orbit.on = !!v.race.winnerId;
}

export function ready() {
  return !!(R && R.ready);
}

let attaching = null;

// Tamu yang masuk kamar harta tanpa berpindah mode tidak punya dunia 3D sama sekali.
export function ensure(ctx) {
  if (R) return Promise.resolve(R.ready);
  if (!attaching)
    attaching = attach(ctx).then(
      (ok) => {
        attaching = null;
        return ok;
      },
      () => {
        attaching = null;
        return false;
      },
    );
  return attaching;
}

function loadThree() {
  return import('../../vendor/three.module.min.js');
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

export function attach(ctx) {
  if (R) dispose();
  R = {
    ctx,
    e: {
      canvas: $('gl'),
      touch: $('hrTouch'),
      stick: $('hrStick'),
      knob: $('hrKnob'),
      jump: $('hrJump'),
      sonar: $('hrSonar'),
      sonarN: $('hrSonarN'),
      sonarCd: $('hrSonarCd'),
      labels: $('hrLabels'),
      feed: $('hrFeed'),
      big: $('hrBig'),
      help: $('hrHelp'),
      heat: $('hrHeat'),
      heatFill: $('hrHeatFill'),
      heatTxt: $('hrHeatTxt'),
      arrow: $('hrArrow'),
      timer: $('hrTimer'),
      timerTxt: $('hrTimerTxt'),
      track: $('hrTrack'),
      idx: $('hrIdx'),
      tot: $('hrTot'),
      map: $('hrMap'),
      reveal: $('hrReveal'),
      revealK: $('hrRevealK'),
      revealWho: $('hrRevealWho'),
      roundRank: $('hrRoundRank'),
      nextTxt: $('hrNextTxt'),
      load: $('hrLoad'),
      nogl: $('hrNogl'),
      mapPick: $('mapPick'),
      mapCard: $('mapCard'),
    },
    me: { x: 0, z: 0, y: 0, sup: 0, vy: 0, a: 0, air: false, zone: 0 },
    remote: new Map(),
    labels: new Map(),
    size: { w: 0, h: 0 },
    viewAt: nowMs(),
    lastFeed: null,
    netAcc: 0,
    netAcc2: 0,
    lastBroad: 0,
    raceId: null,
    cdShown: null,
    winFx: false,
    claimed: false,
    meDist: null,
    moveS: 0,
    arrowUntil: 0,
    cdUntil: 0,
    bigUntil: 0,
    wantSnap: 0,
    beat: 0,
    quality: 'high',
    paused: true,
    ready: false,
    onScreen: false,
    raf: 0,
    last: 0,
  };
  R.isHost = ctx.isHost;
  R.net = ctx.net;
  R.myId = ctx.myId;
  if (!webglOk()) {
    node('load').classList.add('hidden');
    node('nogl').classList.remove('hidden');
    return Promise.resolve(false);
  }
  return loadThree()
    .then((THREE) => {
      if (!R) return false;
      R.THREE = THREE;
      R.world = createWorld(THREE, R.e.canvas);
      R.controls = createControls({
        touch: R.e.touch,
        stick: R.e.stick,
        knob: R.e.knob,
        jumpBtn: R.e.jump,
        sonarBtn: R.e.sonar,
        enabled: false,
      });
      R.touch = R.controls.isTouch;
      R.ready = true;
      R.e.load.classList.add('hidden');
      resize();
      R.onResize = () => resize();
      window.addEventListener('resize', R.onResize);
      window.addEventListener('orientationchange', R.onResize);
      R.onVis = () => {
        R.paused = document.hidden || !R.onScreen;
        if (!R.paused) R.last = performance.now();
      };
      document.addEventListener('visibilitychange', R.onVis);
      if (R.view) view(R.view);
      R.last = performance.now();
      R.raf = requestAnimationFrame(loop);
      watchFps();
      exposeDebug();
      return true;
    })
    .catch(() => {
      if (!R) return false;
      R.e.load.classList.add('hidden');
      R.e.nogl.classList.remove('hidden');
      return false;
    });
}

function watchFps() {
  let frames = 0;
  let slow = 0;
  let t0 = performance.now();
  R.fpsTimer = setInterval(() => {
    if (!R) return;
    const el = performance.now() - t0;
    R.fps = Math.round((frames * 1000) / Math.max(1, el));
    frames = 0;
    t0 = performance.now();
    if (R.paused) return;
    if (R.fps < 40 && R.quality === 'high') {
      slow++;
      if (slow > 2) {
        R.quality = 'low';
        R.world.setQuality(true);
        resize();
      }
    } else slow = 0;
  }, 1000);
  const count = () => {
    if (!R || !R.fpsTimer) return;
    if (!R.paused) frames++;
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
}

function exposeDebug() {
  window.HARTA = {
    view: () => (R ? R.view : null),
    state: () => (R ? R.ctx.state() : null),
    me: () => (R ? { x: R.me.x, z: R.me.z, a: R.me.a, y: R.me.y, sup: R.me.sup, air: !!R.me.air, zone: R.me.zone } : null),
    dbg: () => {
      if (!R || !R.ready || !R.world) return null;
      return {
        fps: R.fps || 0,
        quality: R.quality,
        raceId: R.raceId,
        drawCalls: R.world.renderer.info.render.calls,
        tris: R.world.renderer.info.render.triangles,
        geoms: R.world.renderer.info.memory.geometries,
        texs: R.world.renderer.info.memory.textures,
        yaw: R.world.camState.yaw,
        pitch: R.world.camState.pitch,
      };
    },
    api: {
      moveTo(x, z) {
        if (!R || !R.layout) return false;
        const s = resolveFeet(R.layout, x, z, M.playerR, R.me.y);
        R.me.x = s.x;
        R.me.z = s.z;
        R.me.y = supportAt(R.layout, s.x, s.z);
        R.me.vy = 0;
        R.me.air = false;
        R.meDist = Math.hypot(R.me.x - R.layout.treasure.x, R.me.z - R.layout.treasure.z);
        if (R.view) updateAvatars(R.view, 0.05);
        sendMove();
        return true;
      },
      toTreasure() {
        if (!R || !R.layout) return false;
        return window.HARTA.api.moveTo(R.layout.treasure.x, R.layout.treasure.z);
      },
      claim() {
        if (!R) return false;
        R.meDist = 0;
        R.claimed = true;
        claim();
        return true;
      },
      sonar() {
        if (!R) return false;
        useSonar();
        return true;
      },
      treasure() {
        return R && R.layout ? { x: R.layout.treasure.x, z: R.layout.treasure.z } : null;
      },
    },
  };
}

export function onScreen(name) {
  if (!R) return;
  R.onScreen = name === 'race';
  R.paused = !R.onScreen || document.hidden || !R.ready;
  if (!R.paused) R.last = performance.now();
  if (R.controls) R.controls.setEnabled(R.onScreen);
  if (!R.onScreen) {
    node('stick').classList.add('hidden');
    node('stick').style.cssText = '';
    node('arrow').classList.add('hidden');
    node('heat').classList.add('hidden');
    big(null);
  } else resize();
}

export function lobbyMaps(v) {
  if (!R) return;
  const box = R.e.mapPick;
  if (!box) return;
  R.e.mapCard.classList.remove('hidden');
  const host = !!(v.you && v.you.isHost);
  if (sig(box, (v.mapPick || '') + '|' + host)) {
    box.textContent = '';
    for (const m of MAPS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hr-map' + (v.mapPick === m.id ? ' sel' : '') + (host ? '' : ' off');
      const cv = document.createElement('canvas');
      cv.width = 180;
      cv.height = 144;
      drawThumb(cv, m.id);
      const inr = document.createElement('span');
      inr.className = 'hr-map-in';
      const b = document.createElement('b');
      b.textContent = m.name;
      const i = document.createElement('i');
      i.textContent = m.sub;
      const f = document.createElement('em');
      f.className = 'hr-map-fit';
      f.textContent = fiturOf(m.id).join(' · ');
      inr.append(b, i, f);
      btn.append(cv, inr);
      if (host) btn.onclick = () => R.ctx.pickMap(m.id);
      box.append(btn);
    }
  }
  setTxt($('mapWho'), host ? '(kamu yang pilih)' : '');
  setTxt($('mapNote'), host ? 'Ronde 1 pakai tempat ini, lalu tempat lainnya berputar sampai semua pernah didatangi.' : 'Tuan rumah yang menentukan tempatnya.');
}

// Kartu tempat dibaca dari layout yang sama seperti saat main (seed demo), bukan hiasan: bentuk
// ruangan, di mana lumpur dan lubang, serta benda mana yang bisa diinjak semuanya ikut tergambar.
const FITUR = new Map();
function fiturOf(mapId) {
  if (!FITUR.has(mapId)) {
    const l = layoutFor(mapId, 4242);
    const chip = [];
    if (l.boxes.some((b) => !b.wall && b.h >= M.stepH && b.h <= 1.25)) chip.push('bisa dinaiki');
    if (l.boxes.some((b) => b.k === 'soft')) chip.push('tanah lembek');
    if (l.boxes.some((b) => b.k === 'pit')) chip.push('lubang jebakan');
    FITUR.set(mapId, chip);
  }
  return FITUR.get(mapId);
}

function drawThumb(cv, mapId) {
  const l = layoutFor(mapId, 4242);
  const g = cv.getContext('2d');
  const s = Math.min((cv.width - 10) / l.bounds.w, (cv.height - 10) / l.bounds.d);
  const ox = cv.width / 2;
  const oy = cv.height / 2;
  const px = (x) => ox + x * s;
  const pz = (z) => oy + z * s;
  const tapak = (b) => (b.rot ? [b.rw || b.w, b.rd || b.d] : [b.w, b.d]);
  g.fillStyle = l.map.sky;
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = l.palette.floor2;
  g.fillRect(px(-l.bounds.hw), pz(-l.bounds.hd), l.bounds.w * s, l.bounds.d * s);
  // Zona lebih dulu dan semi-transparan: genangan harus tetap kelihatan ada benda di atasnya.
  for (const b of l.boxes) {
    if (b.k !== 'soft' && b.k !== 'pit') continue;
    const [w, d] = tapak(b);
    g.save();
    g.globalAlpha = b.k === 'pit' ? 0.85 : 0.4;
    g.fillStyle = l.palette[b.c] || '#241a12';
    g.translate(px(b.x), pz(b.z));
    g.rotate(-(b.rot || 0));
    if (b.s === 'cyl') {
      g.beginPath();
      g.ellipse(0, 0, (w / 2) * s, (d / 2) * s, 0, 0, Math.PI * 2);
      g.fill();
    } else g.fillRect((-w / 2) * s, (-d / 2) * s, w * s, d * s);
    g.restore();
  }
  for (const b of l.boxes) {
    if (b.k === 'soft' || b.k === 'pit') continue;
    const [w, d] = tapak(b);
    const rw = Math.max(1, w * s);
    const rd = Math.max(1, d * s);
    const naek = !b.wall && b.h >= M.stepH && b.h <= 1.25;
    g.save();
    g.translate(px(b.x), pz(b.z));
    g.rotate(-(b.rot || 0));
    // 'wall' (bukan 'wallDark') supaya batas ruangan terbaca di atas lantai yang gelap.
    g.fillStyle = b.wall ? l.palette.wall : l.palette[b.c] || '#999';
    g.fillRect(-rw / 2, -rd / 2, rw, rd);
    // Pena emas = "naik ke sini": cara termurah membedakan peti yang bisa diinjak dari yang cuma tembok.
    if (naek) {
      g.strokeStyle = 'rgba(255,224,138,0.8)';
      g.lineWidth = 1;
      g.strokeRect(-rw / 2, -rd / 2, rw, rd);
    }
    g.restore();
  }
  g.fillStyle = '#3fd2ff';
  for (const sp of l.spawns.slice(0, 8)) g.fillRect(px(sp.x) - 1.5, pz(sp.z) - 1.5, 3, 3);
  g.fillStyle = '#ffd76b';
  g.fillRect(px(l.treasure.x) - 2.5, pz(l.treasure.z) - 2.5, 5, 5);
}

export function dispose() {
  if (!R) return;
  const e = R.e;
  attaching = null;
  cancelAnimationFrame(R.raf);
  clearInterval(R.fpsTimer);
  window.removeEventListener('resize', R.onResize);
  window.removeEventListener('orientationchange', R.onResize);
  document.removeEventListener('visibilitychange', R.onVis);
  try {
    if (R.controls) R.controls.destroy();
    if (R.world) R.world.dispose();
  } catch (err) {}
  for (const np of R.labels.values()) np.remove();
  R.labels.clear();
  for (const k of ['feed', 'track', 'mapPick', 'roundRank', 'big'])
    if (e[k]) {
      e[k].textContent = '';
      e[k].classList.remove('show');
      delete e[k].dataset.sig;
    }
  for (const k of ['mapCard', 'reveal', 'heat', 'arrow', 'stick', 'help', 'nogl'])
    if (e[k]) {
      e[k].classList.add('hidden');
      delete e[k].dataset.sig;
    }
  if (e.load) e.load.classList.remove('hidden');
  if (e.stick) e.stick.style.cssText = '';
  if (e.knob) e.knob.style.transform = '';
  if (e.canvas && e.canvas.parentNode) {
    const fresh = document.createElement('canvas');
    fresh.id = 'gl';
    e.canvas.replaceWith(fresh);
  } else if (e.canvas) {
    e.canvas.width = e.canvas.height = 1;
  }
  window.HARTA = undefined;
  R = null;
}
