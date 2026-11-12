import { WORDS } from './words.js';
import * as G from './game.js';
import * as Net from './net.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['home', 'busy', 'lobby', 'play', 'over'];
const now = () => Date.now();

const S = {
  me: '',
  seq: 0,
  isHost: false,
  net: null,
  game: null,
  view: null,
  viewAt: 0,
  connected: false,
  lastBeat: 0,
  lastFeedId: null,
  lastBeepSec: 99,
};

const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  },
};

/* ---------- tampilan dasar ---------- */
function show(name) {
  SCREENS.forEach((n) => $(n).classList.toggle('hidden', n !== name));
  $('leave').classList.toggle('hidden', !(S.connected && name !== 'busy'));
}

let toastTimer = 0;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function homeErr(msg) {
  $('homeErr').textContent = msg || '';
}

function setTxt(id, text) {
  const el = $(id);
  const val = text == null ? '' : String(text);
  if (el.textContent !== val) el.textContent = val;
}

function fill(id, items, build) {
  const box = $(id);
  const sig = JSON.stringify(items);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.textContent = '';
  items.forEach((item, i) => box.append(build(item, i)));
}

/* ---------- suara ---------- */
let ac = null;
function ctx() {
  if (store.get('bisik-mute', '0') === '1') return null;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch (e) {
    return null;
  }
}
function tone(freq, at, dur, gain = 0.06, type = 'triangle') {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}
function sfx(kind) {
  if (kind === 'right') return [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22));
  if (kind === 'wrong') return tone(150, 0, 0.16, 0.05, 'sawtooth');
  if (kind === 'hint') return tone(680, 0, 0.09, 0.04);
  if (kind === 'join') return [523, 784].forEach((f, i) => tone(f, i * 0.08, 0.14));
  if (kind === 'reveal') return tone(320, 0, 0.32, 0.05);
  if (kind === 'sys') return tone(440, 0, 0.1, 0.03);
}

/* ---------- aksi ---------- */
function currentName() {
  const n = $('name').value.trim().slice(0, G.CFG.nameMax);
  $('name').value = n;
  store.set('bisik-name', n);
  return n;
}

function play(t, text) {
  if (S.isHost) {
    const ts = now();
    let res;
    if (t === 'hint') res = G.submitHint(S.game, { id: S.me, text, now: ts, words: WORDS, rng: Math.random });
    else if (t === 'guess') res = G.submitGuess(S.game, { id: S.me, text, now: ts });
    else if (t === 'giveup') res = G.giveUpRound(S.game, { id: S.me, now: ts });
    else return;
    if (!res.ok) return toast(res.error, true);
    broadcast();
    render();
    return;
  }
  if (!S.net) return;
  S.net.send({ t, text });
}

/* ---------- tuan rumah ---------- */
async function createRoom() {
  const name = currentName();
  if (!name) return homeErr('Isi nama dulu, ya.');
  homeErr('');
  const seq = ++S.seq;
  show('busy');
  setTxt('busyTxt', 'Membuat kamar…');
  try {
    const net = await Net.hostRoom({
      onJoin: () => {},
      onData: onHostData,
      onLeave: (id) => {
        if (!S.game) return;
        G.dropPlayer(S.game, { id, now: now() });
        broadcast();
        render();
      },
      onError: () => {},
    });
    if (seq !== S.seq) return net.close();
    S.net = net;
    S.isHost = true;
    S.me = net.self;
    S.game = G.createRoom({ code: net.code, hostId: net.self, hostName: name, now: now() });
    S.connected = true;
    show('lobby');
    render();
    toast('Kamar ' + net.code + ' siap. Bagikan kodenya!');
  } catch (err) {
    if (seq !== S.seq) return;
    show('home');
    homeErr(err.message);
  }
}

function touch(id) {
  const p = S.game.players.find((x) => x.id === id);
  if (p) p.lastSeen = now();
  return p;
}

function onHostData(id, msg) {
  if (!S.game || !msg || typeof msg !== 'object') return;
  const ts = now();

  if (msg.t === 'hello') {
    if (S.game.phase !== 'lobby' && S.game.phase !== 'over') {
      S.net.send(id, { t: 'no', msg: 'Kamar sedang dipakai main. Tunggu nanti atau bikin kamar sendiri.' });
      return S.net.kill(id);
    }
    const res = G.addPlayer(S.game, { id, name: msg.name, now: ts });
    if (!res.ok) {
      S.net.send(id, { t: 'no', msg: res.error });
      return S.net.kill(id);
    }
    touch(id);
    broadcast();
    return render();
  }

  if (!touch(id)) return;
  let res;
  if (msg.t === 'hint') res = G.submitHint(S.game, { id, text: msg.text, now: ts, words: WORDS, rng: Math.random });
  else if (msg.t === 'guess') res = G.submitGuess(S.game, { id, text: msg.text, now: ts });
  else if (msg.t === 'giveup') res = G.giveUpRound(S.game, { id, now: ts });
  else if (msg.t === 'ping') res = { ok: true };
  else if (msg.t === 'bye') {
    G.dropPlayer(S.game, { id, now: ts });
    broadcast();
    return render();
  } else return;

  if (!res.ok && res.error) S.net.send(id, { t: 'toast', msg: res.error });
  broadcast();
  render();
}

function broadcast() {
  if (!S.isHost || !S.net || !S.game) return;
  const ts = now();
  for (const p of S.game.players) S.net.send(p.id, { t: 'v', v: G.toView(S.game, p.id, ts) });
}

function pruneStale() {
  const ts = now();
  for (const p of [...S.game.players]) {
    if (p.id === S.game.hostId) continue;
    if (ts - (p.lastSeen || ts) > 45000) G.dropPlayer(S.game, { id: p.id, now: ts });
  }
}

/* ---------- tamu ---------- */
async function joinRoom() {
  const name = currentName();
  const code = $('code').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  $('code').value = code;
  if (!name) return homeErr('Isi nama dulu, ya.');
  if (code.length !== 4) return homeErr('Kode kamar 4 huruf.');
  homeErr('');
  const seq = ++S.seq;
  show('busy');
  setTxt('busyTxt', 'Menyambungkan ke kamar ' + code + '…');
  try {
    const net = await Net.joinRoom({
      code,
      onData: onGuestData,
      onClosed: () => {
        S.connected = false;
        S.net = null;
        show('home');
        toast('Kamar ditutup atau koneksi putus.', true);
      },
      onError: () => {},
    });
    if (seq !== S.seq) return net.close();
    S.net = net;
    S.isHost = false;
    S.me = net.self;
    S.connected = true;
    S.net.send({ t: 'hello', name });
    startPing();
    show('lobby');
    render();
  } catch (err) {
    if (seq !== S.seq) return;
    show('home');
    homeErr(err.message);
  }
}

function onGuestData(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'v') {
    S.view = msg.v;
    S.viewAt = now();
    render();
  } else if (msg.t === 'no') {
    S.connected = false;
    show('home');
    homeErr(msg.msg);
  } else if (msg.t === 'toast') {
    toast(msg.msg, true);
  }
}

let pingTimer = 0;
function startPing() {
  clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (!S.isHost && S.net && S.connected) S.net.send({ t: 'ping' });
  }, 5000);
}

/* ---------- render ---------- */
function view() {
  if (S.isHost && S.game) {
    S.viewAt = now();
    return G.toView(S.game, S.me, S.viewAt);
  }
  return S.view;
}

function msLeft(v) {
  if (!v || !v.round) return 0;
  return v.round.deadline - v.nowHost - (now() - S.viewAt);
}

function render() {
  if (!S.connected) return;
  const v = view();
  if (!v || !v.you) return;
  if (v.phase === 'lobby') {
    show('lobby');
    renderLobby(v);
  } else if (v.phase === 'over') {
    show('over');
    renderOver(v);
  } else {
    show('play');
    renderPlay(v);
  }
  sounds(v);
}

function renderLobby(v) {
  setTxt('lobbyCode', v.code);
  setTxt('pcount', v.players.length);
  fill(
    'lobbyPlayers',
    v.players,
    (p) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      li.append(dot);
      li.append(document.createTextNode(p.name + (p.id === v.you.id ? ' (kamu)' : '')));
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.isHost ? 'Tuan rumah' : '';
      li.append(tag);
      return li;
    },
  );
  const canStart = v.players.length >= 2;
  $('start').classList.toggle('hidden', !v.you.isHost);
  $('start').disabled = !canStart;
  if (v.you.isHost) setTxt('waitTxt', canStart ? 'Semua siap. Gas!' : 'Tunggu teman masuk dulu (minimal 2 pemain).');
  else setTxt('waitTxt', 'Tunggu ' + (v.players.find((p) => p.isHost) || {}).name + ' menekan Mulai…');
}

function renderPlay(v) {
  const r = v.round;
  if (!r) return;
  const active = r.status === 'active' && v.phase === 'round';
  setTxt('rIdx', r.index + 1);
  setTxt('rTot', r.total);
  setTxt('cat', r.category);

  const left = Math.max(0, msLeft(v));
  const frac = Math.min(1, Math.max(0, left / r.roundMs));
  $('timer').style.setProperty('--p', frac.toFixed(3));
  $('timer').classList.toggle('low', left < 15000);
  const secs = Math.ceil(left / 1000);
  setTxt('timerTxt', active ? secs : '0');
  if (active && secs <= 10 && secs !== S.lastBeepSec) {
    S.lastBeepSec = secs;
    tone(880 - (10 - secs) * 40, 0, 0.07, 0.035);
  }

  setTxt('leaderNote', r.leaderName + ' memegang kata rahasia');
  setTxt('mask', r.mask);

  const secretBox = $('secretCard');
  secretBox.classList.toggle('hidden', !r.secret || !v.you.isLeader);
  if (r.secret && v.you.isLeader) setTxt('secretWord', r.secret);

  setTxt('hintCount', r.hints.length + '/' + v.you.maxHints);
  fill(
    'hintList',
    r.hints.map((h) => ({ h })),
    (o) => {
      const li = document.createElement('li');
      li.textContent = o.h;
      return li;
    },
  );
  fill(
    'guesses',
    r.guesses,
    (g) => {
      const s = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = g.by;
      s.append(b, document.createTextNode(': ' + g.text));
      return s;
    },
  );

  $('hintForm').classList.toggle('hidden', !v.you.isLeader || !active);
  $('guessForm').classList.toggle('hidden', v.you.isLeader || !active);
  $('hintText').disabled = !active;
  $('guessText').disabled = !active;

  fill(
    'scores',
    v.players,
    (p) => {
      const div = document.createElement('div');
      div.className = 'chip' + (p.id === v.you.id ? ' you' : '') + (p.isLeader ? ' on' : '') + (p.score > 0 && p === v.players[0] ? ' lead' : '');
      div.textContent = p.name;
      const b = document.createElement('b');
      b.textContent = ' ' + p.score;
      div.append(b);
      return div;
    },
  );

  fill(
    'feed',
    v.feed,
    (f) => {
      const li = document.createElement('li');
      li.dataset.k = f.kind;
      li.textContent = f.text;
      return li;
    },
  );

  const reveal = $('reveal');
  reveal.classList.toggle('hidden', v.phase !== 'reveal');
  if (v.phase === 'reveal') {
    setTxt('revealWord', r.secret || r.mask);
    let note = '';
    if (r.status === 'solved' && r.points)
      note = (r.solvedByName || 'Seseorang') + ' berhasil menebak. Penebak +' + r.points.guesser + ', pemimpin +' + r.points.leader + '.';
    else if (r.status === 'timeout') note = 'Waktu habis, tidak ada yang benar. Semua nol di ronde ini.';
    else if (r.status === 'gaveup') note = 'Pemimpin menyerah. Tidak ada poin.';
    else if (r.status === 'leader-left') note = 'Pemimpin keluar di tengah ronde.';
    setTxt('revealNote', (note || '') + ' Ronde berikutnya otomatis…');
    setTxt('revealK', r.status === 'solved' ? 'Ditebak! Kata rahasianya' : 'Kata rahasianya');
  }
}

function renderOver(v) {
  const top = v.players[0] || {};
  const tie = v.players.length > 1 && v.players[1] && v.players[1].score === top.score;
  setTxt('winnerTxt', tie ? 'Seri! Poinnya sama rata.' : (top.name || '') + ' juara ronde ini');
  fill(
    'rank',
    v.players,
    (p, i) => {
      const li = document.createElement('li');
      const n = document.createElement('i');
      n.textContent = i + 1 + '.';
      li.append(n, document.createTextNode(p.name + (p.id === v.you.id ? ' (kamu)' : '')));
      const b = document.createElement('b');
      b.textContent = p.score + ' poin';
      li.append(b);
      return li;
    },
  );
  $('again').classList.toggle('hidden', !v.you.isHost);
  setTxt('overWait', v.you.isHost ? '' : 'Tunggu tuan rumah memulai lagi…');
}

function sounds(v) {
  const newest = v.feed[0];
  if (!newest) return;
  if (S.lastFeedId === null) return (S.lastFeedId = newest.id);
  if (newest.id <= S.lastFeedId) return;
  S.lastFeedId = newest.id;
  sfx(newest.kind);
}

/* ---------- EVENTS ---------- */
$('name').value = store.get('bisik-name', '');
$('mute').textContent = store.get('bisik-mute', '0') === '1' ? 'Suara: OFF' : 'Suara: ON';
$('mute').onclick = () => {
  const next = store.get('bisik-mute', '0') === '1' ? '0' : '1';
  store.set('bisik-mute', next);
  $('mute').textContent = next === '1' ? 'Suara: OFF' : 'Suara: ON';
  if (next === '0') sfx('sys');
};

$('create').onclick = createRoom;
$('join').onclick = joinRoom;
$('code').addEventListener('input', () => {
  $('code').value = $('code').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
});

$('busyCancel').onclick = () => {
  S.seq++;
  S.connected = false;
  if (S.net) {
    S.net.close();
    S.net = null;
  }
  show('home');
};

$('start').onclick = () => {
  const res = G.startGame(S.game, { now: now(), words: WORDS, rng: Math.random });
  if (!res.ok) return toast(res.error, true);
  broadcast();
  render();
};

$('again').onclick = $('start').onclick;

$('giveup').onclick = () => play('giveup');

$('hintForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('hintText').value.trim();
  if (!text) return;
  $('hintText').value = '';
  play('hint', text);
};

$('guessForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('guessText').value.trim();
  if (!text) return;
  $('guessText').value = '';
  play('guess', text);
};

function inviteLink() {
  const code = S.isHost && S.game ? S.game.code : $('code').value;
  return location.origin + location.pathname + (code ? '?k=' + code : '');
}
$('copyLink').onclick = async () => {
  const url = inviteLink();
  try {
    if (navigator.share) return navigator.share({ title: 'Main Bisik Kata', url });
    await navigator.clipboard.writeText(url);
    toast('Ajakan disalin. Tinggal tempel di chat.');
  } catch (e) {
    toast(url, true);
  }
};
$('copyCode').onclick = async () => {
  const code = S.isHost && S.game ? S.game.code : '';
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toast('Kode ' + code + ' disalin.');
  } catch (e) {
    toast('Kodenya: ' + code, true);
  }
};

function leaveRoom() {
  clearInterval(pingTimer);
  if (S.net) {
    if (S.isHost) for (const p of S.game.players) S.net.send(p.id, { t: 'no', msg: 'Tuan rumah menutup kamar.' });
    else S.net.send({ t: 'bye' });
    S.net.close();
  }
  S.net = null;
  S.game = null;
  S.view = null;
  S.isHost = false;
  S.connected = false;
  S.lastFeedId = null;
  show('home');
}
$('leave').onclick = leaveRoom;
window.addEventListener('pagehide', () => {
  if (S.net && !S.isHost) S.net.send({ t: 'bye' });
});

const urlCode = (new URLSearchParams(location.search).get('k') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
if (urlCode.length === 4) {
  $('code').value = urlCode;
  if (!$('name').value) $('name').focus();
  else $('join').focus();
  setTxt('netnote', 'kode kamar sudah ditempel, tinggal tekan Masuk');
} else if (location.protocol === 'file:') {
  setTxt('netnote', 'buka lewat server (npx serve) atau Vercel, bukan file://');
}

/* ---------- loop ---------- */
setInterval(() => {
  if (S.isHost && S.game) {
    const changed = G.tick(S.game, { now: now(), words: WORDS, rng: Math.random });
    pruneStale();
    if (changed || now() - S.lastBeat > 1500) {
      S.lastBeat = now();
      broadcast();
    }
  }
  render();
}, 250);

show('home');
