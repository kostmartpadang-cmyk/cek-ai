import { CFG, onFound, onMove, onSonar, onClaimItem, tick } from './logic.js';
import { CFG as M, MAPS, layoutFor, resolveFeet, supportAt, insideSolid, zoneAt, sectorAt, MAP_ICONS } from './maps.js';
import { createWorld } from './world.js';
import { createControls } from './controls.js';

const $ = (id) => document.getElementById(id);
const q1 = (v) => Math.round(v * 10) / 10;
const q2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const nowMs = () => Date.now();

const BANDS = [
  { max: 6, label: 'Membakar', icon: '⚡', k: 1 },
  { max: 14, label: 'Panas', icon: '🔥', k: 0.8 },
  { max: 24, label: 'Hangat', icon: '🌤️', k: 0.6 },
  { max: 40, label: 'Sejuk', icon: '🍃', k: 0.35 },
  { max: 65, label: 'Dingin', icon: '🧊', k: 0.18 },
  { max: Infinity, label: 'Beku', icon: '❄️', k: 0.06 },
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
    const bubble = document.createElement('div');
    bubble.className = 'hr-bubble hidden';
    const chip = document.createElement('span');
    chip.className = 'hr-np-name';
    np.append(bubble, chip);
    np._chip = chip;
    np._bubble = bubble;
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
  (np._chip || np.firstChild).textContent = text;
}

function showSpeechBubble(id, text) {
  if (!R) return;
  const np = R.labels.get(id);
  if (!np || !np._bubble) return;
  np._bubble.textContent = text;
  np._bubble.classList.remove('hidden');
  np._bubble.classList.remove('pop');
  void np._bubble.offsetWidth;
  np._bubble.classList.add('pop');
  if (np._bubbleTimer) clearTimeout(np._bubbleTimer);
  np._bubbleTimer = setTimeout(() => {
    if (np && np._bubble) {
      np._bubble.classList.add('hidden');
      np._bubble.classList.remove('pop');
    }
  }, 4500);
}

function appendChatFeed(pkt) {
  const box = node('feed');
  if (!box) return;
  const li = document.createElement('li');
  li.dataset.k = 'chat';
  li.className = 'hr-feed-chat';
  const b = document.createElement('b');
  b.textContent = pkt.name + ': ';
  b.style.color = pkt.color || 'var(--hr-gold-1)';
  const s = document.createElement('span');
  s.textContent = pkt.text;
  li.append(b, s);
  box.prepend(li);
  while (box.children.length > 8) box.lastChild.remove();
}

function onChatReceived(pkt) {
  beep(580, 0.05, 0.035, 'sine');
  showSpeechBubble(pkt.id, pkt.text);
  appendChatFeed(pkt);
}

function sendChat(rawText) {
  const text = String(rawText || '').trim().slice(0, 60);
  if (!text || !R) return;
  const v = R.view;
  const myId = R.myId();
  const mine = v && v.race ? v.race.racers.find((p) => p.id === myId) : null;
  const myName = mine ? mine.name : (v && v.you ? v.you.name : 'Kamu');
  const myColor = mine ? mine.color : (v && v.you ? v.you.color : '#ffd76b');

  if (R.isHost()) {
    const pkt = { t: 'chat', id: myId, name: myName, color: myColor, text, ts: nowMs() };
    const net = R.net();
    const st = R.ctx.state();
    if (net && st && st.players) {
      for (const p of st.players) {
        if (p.id !== myId) net.send(p.id, pkt);
      }
    }
    onChatReceived(pkt);
  } else if (R.net()) {
    R.net().send({ t: 'chat', text });
  }
}

function syncRound(v) {
  const r = v.race;
  if (!r || r.id === R.raceId) return;
  R.raceId = r.id;
  R.layout = layoutFor(r.mapId, r.seed);
  R.world.loadLayout(R.layout);
  R.world.clearAvatars();
  R.remote.clear();
  R.claimedItems = new Set();
  R.nearItemId = null;
  if (R.itemTags) {
    for (const tag of R.itemTags.values()) tag.remove();
    R.itemTags.clear();
  }
  R.claimed = false;
  R.winFx = false;
  R.cdShown = null;
  R.arrowUntil = 0;
  R.wantSnap = nowMs() + 400;
  R.me.flashlightUntil = 0;
  R.me.speedBoostUntil = 0;
  R.me.lootPoints = 0;
  if (R.world && R.world.setFlashlight) R.world.setFlashlight(false);
  if (R.decoyTimer) {
    clearTimeout(R.decoyTimer);
    R.decoyTimer = null;
  }
  if (R.itemTimer) {
    clearTimeout(R.itemTimer);
    R.itemTimer = null;
  }
  const itemAlert = node('itemAlert');
  if (itemAlert) {
    itemAlert.classList.add('hidden');
    itemAlert.classList.remove('pop');
  }
  const decAlert = node('decoyAlert');
  if (decAlert) {
    decAlert.classList.add('hidden');
    decAlert.classList.remove('pop');
  }
  const i = v.players.findIndex((p) => p.id === v.you.id);
  const mine = v.race && v.race.racers ? v.race.racers.find((p) => p.id === v.you.id) : null;
  const sp = mine && Number.isFinite(mine.x) && Number.isFinite(mine.z)
    ? mine
    : R.layout.spawns[Math.max(0, i) % R.layout.spawns.length];
  R.me.x = sp.x;
  R.me.z = sp.z;
  R.me.y = mine && Number.isFinite(mine.y) ? mine.y : 0;
  R.me.sup = 0;
  R.me.vy = 0;
  R.me.air = false;
  R.me.zone = 0;
  R.me.a = mine && Number.isFinite(mine.a)
    ? mine.a
    : Math.atan2(R.layout.treasure.x - sp.x, R.layout.treasure.z - sp.z) + Math.PI;
  R.world.camState.yaw = R.me.a;
  R.world.camState.pitch = 0.20;
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
    if (msg.t === 'chat') {
      onChatReceived(msg);
      return true;
    }
    if (msg.t === 'item_ok') {
      handleItemClaimSuccess(msg);
      return true;
    }
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
  if (msg.t === 'chat') {
    const text = String(msg.text || '').trim().slice(0, 60);
    if (!text) return true;
    const p = st.players.find((x) => x.id === id);
    const pkt = {
      t: 'chat',
      id,
      name: p ? p.name : 'Pemburu',
      color: p ? p.color : '#3fd2ff',
      text,
      ts,
    };
    const net = R.net();
    if (net) {
      for (const pl of st.players) {
        if (pl.id !== st.hostId) net.send(pl.id, pkt);
      }
    }
    onChatReceived(pkt);
    return true;
  }
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
  if (msg.t === 'claim_item') {
    const res = onClaimItem(st, id, msg, ts);
    if (res.ok) {
      if (R.net()) R.net().send(id, { t: 'item_ok', ...res });
    } else if (res.error && R.net()) {
      R.net().send(id, { t: 'toast', msg: res.error });
    }
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
  const hasSpeed = R.me.speedBoostUntil && nowMs() < R.me.speedBoostUntil;
  if (R.world && R.world.setSpeedBoost) R.world.setSpeedBoost(hasSpeed && inp.run);
  const slowFactor = hasSpeed ? 0.95 : zone === 1 ? M.slowMul : zone === 2 ? M.pitMul : 1;
  const speed = (inp.run ? CFG.runSpeed : CFG.walkSpeed) * mag * (hasSpeed ? 1.85 : 1) * slowFactor;
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
  if (canMove && R.layout.decoys) {
    for (const dec of R.layout.decoys) {
      if (Math.hypot(R.me.x - dec.x, R.me.z - dec.z) <= CFG.touchRadius * 1.3) {
        if (!dec._opened) {
          dec._opened = true;
          if (R.world.openDecoyAt) R.world.openDecoyAt(dec.x, dec.z);
          triggerDecoyAlert();
        }
      }
    }
  }
  if (canMove && R.layout.secondaryChests) {
    for (const sc of R.layout.secondaryChests) {
      if (!R.claimedItems.has(sc.id) && Math.hypot(R.me.x - sc.x, R.me.z - sc.z) <= CFG.touchRadius * 1.3) {
        R.claimedItems.add(sc.id);
        claimItem(sc.id);
      }
    }
  }
  if (canMove && R.layout.items) {
    for (const it of R.layout.items) {
      if (!R.claimedItems.has(it.id) && Math.hypot(R.me.x - it.x, R.me.z - it.z) <= CFG.touchRadius * 1.3) {
        R.claimedItems.add(it.id);
        claimItem(it.id);
      }
    }
  }
}

function claimItem(itemId) {
  if (R.isHost()) {
    const st = R.ctx.state();
    const res = onClaimItem(st, R.myId(), { id: itemId }, nowMs());
    if (res.ok) {
      handleItemClaimSuccess(res);
    }
  } else if (R.net()) {
    R.net().send({ t: 'claim_item', id: itemId });
  }
}

function triggerItemAlert(icon, text) {
  const al = node('itemAlert');
  if (!al) return;
  const ico = node('itemAlertIco');
  const txt = node('itemAlertTxt');
  if (ico) ico.textContent = icon;
  if (txt) txt.textContent = text;
  al.classList.remove('hidden');
  al.classList.remove('pop');
  void al.offsetWidth;
  al.classList.add('pop');
  if (R.itemTimer) clearTimeout(R.itemTimer);
  R.itemTimer = setTimeout(() => {
    if (al) {
      al.classList.add('hidden');
      al.classList.remove('pop');
    }
  }, 2600);
}

function handleItemClaimSuccess(res) {
  if (res.kind === 'senter') {
    beep(440, 0.07, 0.05, 'square');
    beep(880, 0.14, 0.06, 'triangle', 0.08);
    triggerItemAlert('🔦', 'Senter Diambil! Jarak Pandang Bertambah');
    R.me.flashlightUntil = nowMs() + 40000;
    if (R.world && R.world.setFlashlight) R.world.setFlashlight(true);
  } else if (res.kind === 'boots') {
    beep(523, 0.06, 0.05);
    beep(784, 0.08, 0.05, 'sine', 0.05);
    beep(1046, 0.14, 0.06, 'triangle', 0.1);
    triggerItemAlert('⚡', 'Sepatu Kilat! Lari Cepat 12 Detik');
    R.me.speedBoostUntil = nowMs() + 12000;
  } else if (res.kind === 'sonar') {
    beep(1200, 0.1, 0.06);
    beep(1600, 0.1, 0.06, 'sine', 0.08);
    triggerItemAlert('📡', '+1 Baterai Radar Sonar!');
    const mine = freshMe();
    if (mine) mine.sonar = Math.min(4, (mine.sonar || 0) + 1);
  } else {
    beep(880, 0.08, 0.05, 'triangle');
    beep(1320, 0.12, 0.05, 'sine', 0.06);
    const ico = res.kind === 'silver' ? '🥈' : res.kind === 'bronze' ? '🥉' : '💎';
    triggerItemAlert(ico, `+${res.pts} Poin! ${res.name}`);
    R.me.lootPoints = (R.me.lootPoints || 0) + (res.pts || 0);
  }
  if (R.world && R.world.hideItem) R.world.hideItem(res.itemId);
  if (R.world && R.world.openChestById) R.world.openChestById(res.itemId);
}

function playHorrorScreech() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!R._sndCtx) R._sndCtx = new AudioCtx();
      const ac = R._sndCtx;
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;

      const osc1 = ac.createOscillator();
      const osc2 = ac.createOscillator();
      const gain = ac.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1420, t);
      osc1.frequency.exponentialRampToValueAtTime(120, t + 0.65);
      osc2.frequency.setValueAtTime(1380, t);
      osc2.frequency.exponentialRampToValueAtTime(95, t + 0.65);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ac.destination);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.9);
      osc2.stop(t + 0.9);

      const sub = ac.createOscillator();
      const subG = ac.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(95, t);
      sub.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      subG.gain.setValueAtTime(0.35, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      sub.connect(subG);
      subG.connect(ac.destination);
      sub.start(t);
      sub.stop(t + 0.65);
      return;
    }
  } catch (e) {}

  [1400, 1100, 750, 420, 180].forEach((f, i) => beep(f, 0.15, 0.08, 'sawtooth', i * 0.08));
}

function triggerJumpscare(msg, subMsg) {
  playHorrorScreech();
  const el = node('jumpscare');
  const txt = node('jumpscareTxt');
  const sub = node('jumpscareSub');
  const race = document.getElementById('race');

  if (txt && msg) setTxt(txt, msg);
  if (sub && subMsg) setTxt(sub, subMsg);

  if (race) {
    race.classList.remove('hr-shake');
    void race.offsetWidth;
    race.classList.add('hr-shake');
  }

  if (el) {
    el.classList.remove('hidden');
    el.style.opacity = '1';
    if (R._scareTimer) clearTimeout(R._scareTimer);
    R._scareTimer = setTimeout(() => {
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
          if (el) el.classList.add('hidden');
          if (race) race.classList.remove('hr-shake');
        }, 400);
      }
    }, 1250);
  }
}

function triggerDecoyAlert() {
  beep(240, 0.14, 0.05, 'sawtooth');
  beep(170, 0.22, 0.05, 'sawtooth', 0.1);
  const al = node('decoyAlert');
  if (al) {
    al.classList.remove('hidden');
    al.classList.remove('pop');
    void al.offsetWidth;
    al.classList.add('pop');
    if (R.decoyTimer) clearTimeout(R.decoyTimer);
    R.decoyTimer = setTimeout(() => {
      if (al) {
        al.classList.add('hidden');
        al.classList.remove('pop');
      }
    }, 2800);
  }
  if (R && R.layout && R.layout.map && R.layout.map.id === 'hantu') {
    triggerJumpscare('ARWAH PENASARAN MENYERANG!', 'Peti ini telah dikutuk!');
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

  // 3D Projected Floating Labels di atas item & peti sekunder yang sedang didekati (< 8.5m)
  if (R.layout && R.e.labels) {
    const nearby = [
      ...(R.layout.items || []),
      ...(R.layout.secondaryChests || []),
    ];
    const active = new Set();
    for (const it of nearby) {
      if (R.claimedItems.has(it.id)) continue;
      const dist = Math.hypot(it.x - R.me.x, it.z - R.me.z);
      if (dist > 8.5) continue;
      active.add(it.id);
      let tag = R.itemTags.get(it.id);
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'hr-item-tag';
        const ptsTxt = it.pts ? `<b>+${it.pts}</b>` : '';
        tag.innerHTML = `<i>${it.icon || '✨'}</i><span>${it.name}</span>${ptsTxt}`;
        R.e.labels.appendChild(tag);
        R.itemTags.set(it.id, tag);
      }
      const s = R.world.project(it.x, 1.35, it.z, w, h);
      if (!s.vis) {
        tag.style.opacity = '0';
        continue;
      }
      const op = clamp(1.4 - dist / 7, 0, 1);
      tag.style.opacity = String(op);
      tag.style.transform = `translate3d(${Math.round(s.x)}px,${Math.round(s.y)}px,0) translate(-50%,-100%) scale(${dist <= 3.2 ? 1.08 : 0.95})`;
    }
    for (const [id, tag] of R.itemTags) {
      if (!active.has(id)) {
        tag.remove();
        R.itemTags.delete(id);
      }
    }
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

function drawBuffs(v) {
  const r = v.race;
  if (!r) return;

  if (Array.isArray(r.claimedItems)) {
    for (const itemId of r.claimedItems) {
      if (!R.claimedItems.has(itemId)) {
        R.claimedItems.add(itemId);
        if (R.world && R.world.hideItem) R.world.hideItem(itemId);
        if (R.world && R.world.openChestById) R.world.openChestById(itemId);
      }
    }
  }

  const mine = r.racers.find((p) => p.id === v.you.id);
  const flashLeft = Math.max(0, Math.ceil(((R.me.flashlightUntil || 0) - nowMs()) / 1000));
  const isFlash = flashLeft > 0 || (mine && mine.flashlight);
  const flPill = node('buffFlashlight');
  if (flPill) {
    flPill.classList.toggle('hidden', !isFlash);
    if (isFlash) setTxt(node('buffFlashlightTime'), (flashLeft > 0 ? flashLeft : 30) + 's');
  }
  if (R.world && R.world.setFlashlight) {
    R.world.setFlashlight(isFlash);
  }

  const speedLeft = Math.max(0, Math.ceil(((R.me.speedBoostUntil || 0) - nowMs()) / 1000));
  const isSpeed = speedLeft > 0 || (mine && mine.speedBoost);
  const spdPill = node('buffSpeed');
  if (spdPill) {
    spdPill.classList.toggle('hidden', !isSpeed);
    if (isSpeed) setTxt(node('buffSpeedTime'), (speedLeft > 0 ? speedLeft : 10) + 's');
  }

  const loot = (mine && mine.lootPoints) || R.me.lootPoints || 0;
  const lootPill = node('lootPoints');
  if (lootPill) {
    lootPill.classList.toggle('hidden', loot <= 0);
    if (loot > 0) setTxt(node('lootPointsVal'), '+' + loot);
  }
}

function drawItemSensor(v, dt) {
  const sensor = node('itemSensor');
  const running = v.race && v.race.status === 'running';

  // Penanda dekat ke harta utama dihapus — harta hanya disorot lampu saat sudah ditemukan
  R.world.setSpot(v.race && v.race.treasure ? 1 : 0);

  if (!sensor) return;
  if (!running || !R.layout) {
    sensor.classList.add('hidden');
    R.nearItemId = null;
    return;
  }

  // Cari item atau peti sekunder terdekat yang belum diklaim
  let nearest = null;
  let minDist = Infinity;
  const candidates = [
    ...(R.layout.items || []),
    ...(R.layout.secondaryChests || []),
  ];

  for (const it of candidates) {
    if (R.claimedItems.has(it.id)) continue;
    const d = Math.hypot(R.me.x - it.x, R.me.z - it.z);
    if (d < minDist) {
      minDist = d;
      nearest = it;
    }
  }

  // Jika dekat dengan item (radius <= 8.5 meter)
  if (nearest && minDist <= 8.5) {
    sensor.classList.remove('hidden');
    sensor.classList.toggle('close', minDist <= 3.2);

    setTxt(node('itemSensorIco'), nearest.icon || '✨');
    setTxt(node('itemSensorName'), nearest.name);
    setTxt(node('itemSensorDist'), minDist.toFixed(1) + ' m');

    // Suara chime lembut ketika baru mendeteksi item terdekat
    if (R.nearItemId !== nearest.id) {
      R.nearItemId = nearest.id;
      beep(784, 0.05, 0.03, 'sine');
      beep(1046, 0.08, 0.04, 'triangle', 0.06);
    }
  } else {
    sensor.classList.add('hidden');
    R.nearItemId = null;
  }
}

function drawCompass(v) {
  const comp = node('compass');
  if (!comp) return;
  const running = v.race && (v.race.status === 'running' || v.race.status === 'countdown');
  comp.classList.toggle('hidden', !running);
  if (!running) return;

  const ring = node('compassRing');
  if (ring) {
    const deg = (R.world.camState.yaw * 180) / Math.PI;
    ring.style.transform = `rotate(${deg.toFixed(1)}deg)`;
  }

  const wave = node('radarWave');
  const dot = node('pingDot');
  const sonarActive = R.arrowUntil > nowMs() && !!R.layout;
  if (wave) wave.classList.toggle('active', sonarActive);

  if (dot) {
    dot.classList.toggle('hidden', !sonarActive);
    if (sonarActive && R.layout.treasure) {
      const t = R.layout.treasure;
      const yaw = R.world.camState.yaw;
      const ahead = -(t.x - R.me.x) * Math.sin(yaw) - (t.z - R.me.z) * Math.cos(yaw);
      const side = (t.x - R.me.x) * Math.cos(yaw) - (t.z - R.me.z) * Math.sin(yaw);
      const ang = Math.atan2(side, ahead);
      const pingDist = Math.min(22, Math.max(6, (R.meDist / 60) * 22));
      const px = Math.sin(ang) * pingDist;
      const py = -Math.cos(ang) * pingDist;
      dot.style.transform = `translate(calc(-50% + ${px.toFixed(1)}px), calc(-50% + ${py.toFixed(1)}px))`;
    }
  }
}

function updateHud(v, dt) {
  const r = v.race;
  if (!r) return;
  setTxt(node('idx'), r.index + 1);
  setTxt(node('tot'), r.total);
  setTxt(node('map'), r.mapName);
  setTxt(node('mapIco'), MAP_ICONS[r.mapId] || '🗺️');
  setTxt(node('coord'), 'X: ' + R.me.x.toFixed(1) + ' · Z: ' + R.me.z.toFixed(1));
  const subloc = sectorAt(R.layout, R.me.x, R.me.z);
  setTxt(node('sublocTxt'), subloc);
  const subEl = node('subloc');
  if (subEl) subEl.classList.toggle('warning', subloc.startsWith('⚠️'));

  if (r.mapId === 'hantu' && r.status === 'running') {
    const isCreepy = /Mayat|Ritual|Altar|Pengantin|Arwah|Terkutuk/i.test(subloc);
    const now = nowMs();
    if (isCreepy && (!R._lastAmbScare || now - R._lastAmbScare > 30000)) {
      if (Math.random() < 0.35) {
        R._lastAmbScare = now;
        triggerJumpscare('BAYANGAN ARWAH MENDEKAT!', subloc);
      }
    }
  }

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

  drawItemSensor(v, dt);
  drawCompass(v);
  drawArrow(v);
  drawBuffs(v);
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
  R.world.camState.pitch = clamp(R.world.camState.pitch - look.pitch, -0.42, 0.65);
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
  if (R && R.ready) return Promise.resolve(true);
  if (attaching) return attaching;
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
      itemSensor: $('hrItemSensor'),
      itemSensorIco: $('hrItemSensorIco'),
      itemSensorName: $('hrItemSensorName'),
      itemSensorDist: $('hrItemSensorDist'),
      arrow: $('hrArrow'),
      compass: $('hrCompass'),
      compassRing: $('hrCompassRing'),
      radarWave: $('hrRadarWave'),
      pingDot: $('hrPingDot'),
      buffBar: $('hrBuffBar'),
      buffFlashlight: $('hrBuffFlashlight'),
      buffFlashlightTime: $('hrBuffFlashlightTime'),
      buffSpeed: $('hrBuffSpeed'),
      buffSpeedTime: $('hrBuffSpeedTime'),
      lootPoints: $('hrLootPoints'),
      lootPointsVal: $('hrLootPointsVal'),
      itemAlert: $('hrItemAlert'),
      itemAlertIco: $('hrItemAlertIco'),
      itemAlertTxt: $('hrItemAlertTxt'),
      decoyAlert: $('hrDecoyAlert'),
      jumpscare: $('hrJumpscare'),
      jumpscareTxt: $('hrJumpscareTxt'),
      jumpscareSub: $('hrJumpscareSub'),
      timer: $('hrTimer'),
      timerTxt: $('hrTimerTxt'),
      track: $('hrTrack'),
      idx: $('hrIdx'),
      tot: $('hrTot'),
      map: $('hrMap'),
      mapIco: $('hrMapIco'),
      coord: $('hrCoord'),
      subloc: $('hrSubloc'),
      sublocTxt: $('hrSublocTxt'),
      chatWrap: $('hrChatWrap'),
      chatToggle: $('hrChatToggle'),
      chatForm: $('hrChatForm'),
      chatInput: $('hrChatInput'),
      chatClose: $('hrChatClose'),
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
    me: { x: 0, z: 0, y: 0, sup: 0, vy: 0, a: 0, air: false, zone: 0, flashlightUntil: 0, speedBoostUntil: 0, lootPoints: 0 },
    remote: new Map(),
    labels: new Map(),
    itemTags: new Map(),
    claimedItems: new Set(),
    nearItemId: null,
    itemTimer: null,
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
      if (R.onScreen) {
        R.paused = document.hidden;
        if (!R.paused) R.last = performance.now();
        if (R.controls) R.controls.setEnabled(true);
      }
      if (R.view) {
        view(R.view);
      }

      const openChat = () => {
        if (!R || !R.e.chatForm) return;
        R.e.chatForm.classList.remove('hidden');
        if (R.e.chatWrap) R.e.chatWrap.classList.add('active');
        if (R.e.chatToggle) R.e.chatToggle.classList.add('hidden');
        if (R.e.chatInput) R.e.chatInput.focus();
      };
      const closeChat = () => {
        if (!R || !R.e.chatForm) return;
        R.e.chatForm.classList.add('hidden');
        if (R.e.chatWrap) R.e.chatWrap.classList.remove('active');
        if (R.e.chatToggle) R.e.chatToggle.classList.remove('hidden');
        if (R.e.chatInput) R.e.chatInput.blur();
        if (R.e.canvas && R.e.canvas.focus) R.e.canvas.focus();
      };
      if (R.e.chatToggle) {
        R.onChatToggle = (e) => {
          e.preventDefault();
          if (!R.e.chatForm) return;
          if (R.e.chatForm.classList.contains('hidden')) openChat();
          else closeChat();
        };
        R.e.chatToggle.addEventListener('click', R.onChatToggle);
      }
      if (R.e.chatClose) {
        R.onChatClose = (e) => {
          e.preventDefault();
          closeChat();
        };
        R.e.chatClose.addEventListener('click', R.onChatClose);
      }
      if (R.e.chatForm) {
        R.onChatSubmit = (e) => {
          e.preventDefault();
          if (R.e.chatInput) {
            sendChat(R.e.chatInput.value);
            R.e.chatInput.value = '';
          }
          closeChat();
        };
        R.e.chatForm.addEventListener('submit', R.onChatSubmit);
      }
      R.onChatKey = (e) => {
        if (!R || !R.onScreen) return;
        if (e.code === 'Enter') {
          const active = document.activeElement;
          const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
          if (!typing) {
            e.preventDefault();
            openChat();
          }
        } else if (e.code === 'Escape') {
          if (document.activeElement === R.e.chatInput || (R.e.chatForm && !R.e.chatForm.classList.contains('hidden'))) {
            e.preventDefault();
            closeChat();
          }
        }
      };
      window.addEventListener('keydown', R.onChatKey);

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
    if (node('itemSensor')) node('itemSensor').classList.add('hidden');
    if (node('chatForm')) node('chatForm').classList.add('hidden');
    if (node('chatWrap')) node('chatWrap').classList.remove('active');
    if (node('chatToggle')) node('chatToggle').classList.remove('hidden');
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
    if (l.map && l.map.type === 'maze') chip.push('labirin');
    else if (l.map && l.map.type === 'rooms') chip.push('banyak ruangan');
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
  if (R.e.chatToggle && R.onChatToggle) R.e.chatToggle.removeEventListener('click', R.onChatToggle);
  if (R.e.chatClose && R.onChatClose) R.e.chatClose.removeEventListener('click', R.onChatClose);
  if (R.e.chatForm && R.onChatSubmit) R.e.chatForm.removeEventListener('submit', R.onChatSubmit);
  if (R.onChatKey) window.removeEventListener('keydown', R.onChatKey);
  try {
    if (R.controls) R.controls.destroy();
    if (R.world) R.world.dispose();
  } catch (err) {}
  for (const np of R.labels.values()) np.remove();
  R.labels.clear();
  if (R.itemTags) {
    for (const tag of R.itemTags.values()) tag.remove();
    R.itemTags.clear();
  }
  for (const k of ['feed', 'track', 'mapPick', 'roundRank', 'big'])
    if (e[k]) {
      e[k].textContent = '';
      e[k].classList.remove('show');
      delete e[k].dataset.sig;
    }
  if (R.decoyTimer) {
    clearTimeout(R.decoyTimer);
    R.decoyTimer = null;
  }
  if (R._scareTimer) {
    clearTimeout(R._scareTimer);
    R._scareTimer = null;
  }
  const raceEl = document.getElementById('race');
  if (raceEl) raceEl.classList.remove('hr-shake');
  for (const k of ['mapCard', 'reveal', 'itemSensor', 'arrow', 'stick', 'help', 'nogl', 'decoyAlert', 'jumpscare', 'compass', 'chatForm'])
    if (e[k]) {
      e[k].classList.add('hidden');
      delete e[k].dataset.sig;
    }
  if (e.chatWrap) e.chatWrap.classList.remove('active');
  if (e.chatToggle) e.chatToggle.classList.remove('hidden');
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
