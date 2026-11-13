import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, CFG as M, mulberry32, buildLayout, layoutFor, blockedAt } from '../js/harta/maps.js';
import {
  CFG,
  COLORS,
  createRoom,
  addPlayer,
  dropPlayer,
  setMap,
  startGame,
  onMove,
  onFound,
  onSonar,
  tick,
  standings,
  toView,
} from '../js/harta/logic.js';

const T0 = 1_000_000;
const GO = T0 + CFG.countdownMs;

function room(n = 3) {
  const st = createRoom({ code: 'HRTH', hostId: 'h', hostName: 'Host', now: T0 });
  for (let i = 1; i < n; i++) addPlayer(st, { id: 'p' + i, name: 'Buru' + i, now: T0 + i * 100 });
  return st;
}

function started(n = 3, rng = () => 0) {
  const st = room(n);
  startGame(st, { now: T0, rng });
  return st;
}

/* Letakkan pemburu persis di satu titik tanpa lewat validasi gerak. */
function place(st, id, x, z) {
  const q = st.race.racers[id];
  q.x = x;
  q.z = z;
  q.lastAt = GO;
}

function atTreasure(st, id) {
  place(st, id, st.race.treasure.x, st.race.treasure.z);
}

function floodReachable(L, from, to) {
  const { hw, hd } = L.bounds;
  const key = (x, z) => x + ',' + z;
  const snap = (v, half) => {
    const i = Math.max(0, Math.min(Math.round(half) * 2 - 1, Math.floor(v + half)));
    return -half + i + 0.5;
  };
  const sx = snap(from.x, hw);
  const sz = snap(from.z, hd);
  const tx = snap(to.x, hw);
  const tz = snap(to.z, hd);
  const seen = new Set([key(sx, sz)]);
  const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.pop();
    if (Math.abs(x - tx) < 0.01 && Math.abs(z - tz) < 0.01) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (Math.abs(nx) > hw - 0.5 || Math.abs(nz) > hd - 0.5) continue;
      const k = key(nx, nz);
      if (seen.has(k) || blockedAt(L, nx, nz)) continue;
      seen.add(k);
      q.push([nx, nz]);
    }
  }
  return false;
}

test('peta: seed sama memberi layout yang sama persis', () => {
  const a = buildLayout(MAPS[0], mulberry32(1234));
  const b = buildLayout(MAPS[0], mulberry32(1234));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = buildLayout(MAPS[0], mulberry32(9999));
  assert.notEqual(JSON.stringify(c.treasure), JSON.stringify(a.treasure));
  assert.equal(layoutFor('gudang', 4242), layoutFor('gudang', 4242));
});

test('peta: harta selalu di ruang terbuka, jauh dari spawn, dan bisa dijangkau', () => {
  for (const map of MAPS) {
    for (const seed of [1, 7, 4242, 99991, 123456]) {
      const L = layoutFor(map.id, seed);
      const t = L.treasure;
      assert.equal(blockedAt(L, t.x, t.z), false, map.id + '/' + seed + ' harta di dalam tembok');
      let far = Infinity;
      for (const s of L.spawns) far = Math.min(far, Math.hypot(t.x - s.x, t.z - s.z));
      assert.ok(far >= 10, map.id + '/' + seed + ' harta cuma ' + far.toFixed(1) + ' dari spawn');
      for (const s of L.spawns)
        assert.equal(floodReachable(L, s, t), true, map.id + '/' + seed + ' harta terkurung dari spawn');
      assert.ok(L.decoys.length >= 2, map.id + '/' + seed + ' decoy kurang');
    }
  }
});

test('lobby: nama, kapasitas, dan warna avatar unik', () => {
  const st = room(2);
  assert.equal(addPlayer(st, { id: 'x', name: '   ', now: T0 }).ok, false);
  assert.equal(addPlayer(st, { id: 'x', name: 'Host', now: T0 }).error.includes('sudah dipakai'), true);
  while (st.players.length < CFG.maxPlayers) addPlayer(st, { id: 'q' + st.players.length, name: 'Q' + st.players.length, now: T0 });
  assert.equal(st.players.length, COLORS.length);
  assert.equal(new Set(st.players.map((p) => p.color)).size, COLORS.length);
  assert.equal(addPlayer(st, { id: 'last', name: 'Penuh', now: T0 }).ok, false);
});

test('butuh 2 pemburu untuk mulai + tempat bisa dipilih tuan rumah', () => {
  const st = createRoom({ code: 'HRTH', hostId: 'h', hostName: 'Host', now: T0 });
  assert.equal(startGame(st, { now: T0 }).ok, false);
  assert.equal(setMap(st, { id: 'kuil', by: 'h' }).ok, true);
  assert.equal(st.mapPick, 'kuil');
  assert.equal(setMap(st, { id: 'kuil', by: 'bukan-host' }).ok, false);
  assert.equal(setMap(st, { id: 'bulan', by: 'h' }).ok, false);
  addPlayer(st, { id: 'a', name: 'Awi', now: T0 });
  startGame(st, { now: T0, rng: () => 0 });
  assert.equal(st.race.mapId, 'kuil', 'ronde 1 memakai pilihan tuan rumah');
  assert.equal(setMap(st, { id: 'gudang', by: 'h' }).ok, false, 'tempat terkunci saat ronde berjalan');
});

test('gerak: input tidak wajar ditolak tanpa mengubah state', () => {
  const st = started(2);
  const before = { ...st.race.racers.p1 };
  const bad = [
    { x: NaN, z: 3 },
    { x: 1, z: Infinity },
    { x: 'abc', z: '2' },
    { x: 999, z: 0 },
    { x: 0, z: -999 },
    { x: before.x + 40, z: before.z },
  ];
  for (const msg of bad) {
    assert.equal(onMove(st, 'p1', msg, GO + 1000).ok, false, JSON.stringify(msg));
    assert.equal(st.race.racers.p1.x, before.x);
    assert.equal(st.race.racers.p1.z, before.z);
  }
  const ok = onMove(st, 'p1', { x: before.x + 1.5, z: before.z + 1.5, a: 1.2, s: 2, j: 1 }, GO + 1100);
  assert.equal(ok.ok, true);
  assert.equal(st.race.racers.p1.s, 2);
  assert.equal(st.race.racers.p1.j, 1);
  const step = Math.hypot(st.race.racers.p1.x - before.x, st.race.racers.p1.z - before.z);
  assert.ok(step <= M.runSpeed * 1.9 * 1.1, 'pergeseran mustahil lolos: ' + step);
  const warp = onMove(st, 'p1', { x: st.race.racers.p1.x + 8, z: st.race.racers.p1.z }, GO + 1220);
  assert.equal(warp.ok, false, 'teleport dalam batas harus ditolak');
  assert.equal(onMove(st, 'h', { x: 0, z: 0, s: 5, j: 9, a: NaN }, GO + 1220).ok, true, 'flag liar diluruskan, bukan dibuang');
  assert.equal(st.race.racers.h.s, 0);
  assert.equal(st.race.racers.h.j, 1);
});

test('fase: countdown mengunci gerak-claim, lalu running, lalu reveal dan ronde berikutnya', () => {
  const st = started(2);
  assert.equal(st.race.status, 'countdown');
  assert.equal(onFound(st, 'p1', { ms: 100 }, T0).ok, false);
  assert.equal(onSonar(st, 'p1', T0).ok, false);
  tick(st, { now: GO - 1 });
  assert.equal(st.race.status, 'countdown');
  tick(st, { now: GO });
  assert.equal(st.race.status, 'running');
  atTreasure(st, 'p1');
  onFound(st, 'p1', { ms: 4000 }, GO + 4000);
  tick(st, { now: GO + 4000 + CFG.arbitrateMs + 1 });
  assert.equal(st.race.winnerId, 'p1');
  tick(st, { now: GO + 4000 + CFG.arbitrateMs + CFG.finishWindowMs + 1 });
  assert.equal(st.race.status, 'done');
  assert.equal(st.phase, 'reveal');
  assert.ok(st.race.revealUntil > 0);
  tick(st, { now: st.race.revealUntil + 1 });
  assert.equal(st.phase, 'round');
  assert.equal(st.race.index, 1);
  assert.equal(st.race.mapId, CFG.mapOrder[1]);
  assert.notEqual(st.race.id, 'r1');
});

test('ronde tiga peta lalu selesai dengan poin peringkat + bonus kecepatan', () => {
  const st = started(3);
  const seen = [];
  for (let i = 0; i < 30 && st.phase !== 'over'; i++) {
    const r = st.race;
    seen.push(r.mapId + '#' + r.index);
    const order = ['p1', 'p2', 'h'];
    tick(st, { now: r.goAt });
    order.forEach((id, k) => {
      atTreasure(st, id);
      onFound(st, id, { ms: 5000 + k * 2000 }, r.goAt + 5000 + k * 2000);
      tick(st, { now: r.goAt + 5000 + k * 2000 + CFG.arbitrateMs + 1 });
    });
    tick(st, { now: r.goAt + 5000 + 2 * 2000 + CFG.arbitrateMs + CFG.finishWindowMs + 1 });
    if (st.phase === 'reveal') tick(st, { now: st.race.revealUntil + 1 });
  }
  assert.equal(st.phase, 'over');
  assert.deepEqual(seen, ['gudang#0', 'mainan#1', 'kuil#2']);
  const p1 = st.players.find((p) => p.id === 'p1');
  const bonus = (ms) => Math.round(CFG.speedBonusMax * (1 - ms / CFG.roundMs));
  assert.equal(p1.bestMs, 5000);
  assert.equal(p1.score, 3 * (CFG.points[0] + bonus(5000)));
  assert.equal(st.players.find((p) => p.id === 'p2').score, 3 * (CFG.points[1] + bonus(7000)));
  assert.equal(st.players.find((p) => p.id === 'h').score, 3 * (CFG.points[2] + bonus(9000)));
  assert.equal(standings(st)[0].id, 'p1');
});

test('klaim nyaris bersamaan: waktu klien yang jadi penentu, bukan urutan tiba', () => {
  const st = started(3);
  tick(st, { now: GO });
  atTreasure(st, 'p1');
  atTreasure(st, 'p2');
  assert.equal(onFound(st, 'p1', { ms: 9000 }, GO + 10000).ok, true);
  assert.equal(onFound(st, 'p2', { ms: 8600 }, GO + 10100).ok, true);
  tick(st, { now: GO + 10300 });
  assert.equal(st.race.winnerId, 'p2', 'p2 mengklaim waktu lebih cepat');
  assert.equal(st.race.results[0].id, 'p2');
  assert.equal(st.race.results[1].id, 'p1');
});

test('klaim setelah pemenang sah: peringkat dua, dan dobel klaim ditolak', () => {
  const st = started(3);
  tick(st, { now: GO });
  atTreasure(st, 'p1');
  onFound(st, 'p1', { ms: 4000 }, GO + 4000);
  tick(st, { now: GO + 4300 });
  atTreasure(st, 'p2');
  assert.equal(onFound(st, 'p2', { ms: 9000 }, GO + 9000).ok, true);
  assert.equal(st.race.results[1].rank, 2);
  assert.equal(onFound(st, 'p2', { ms: 9100 }, GO + 9100).error.includes('sudah menemukan'), true);
  place(st, 'h', st.race.treasure.x + 30, st.race.treasure.z);
  assert.equal(onFound(st, 'h', { ms: 1000 }, GO + 10000).error.includes('belum ada di tanganmu'), true);
});

test('waktu ronde habis tanpa pemenang: semua nol, ronde tetap berganti', () => {
  const st = started(2);
  tick(st, { now: GO });
  tick(st, { now: GO + CFG.roundMs + 1 });
  assert.equal(st.race.status, 'done');
  assert.equal(st.race.winnerId, null);
  assert.equal(st.players.every((p) => p.score === 0), true);
  assert.equal(st.feed.some((f) => /Waktu habis/i.test(f.text)), true);
});

test('sonar: hanya saat balapan jalan dan mentok 2 kali per ronde', () => {
  const st = started(2);
  tick(st, { now: GO });
  assert.equal(onSonar(st, 'p1', GO + 100).ok, true);
  assert.equal(onSonar(st, 'p1', GO + 200).ok, true);
  assert.equal(onSonar(st, 'p1', GO + 300).error.includes('Sonar habis'), true);
  assert.equal(st.race.racers.p1.sonar, 0);
  assert.equal(onSonar(st, 'h', GO + 400).ok, true, 'pemburu lain punya jatah sendiri');
});

test('keluar saat ronde: dnf, peringkat naik, dan ruang tunggu jika tinggal satu', () => {
  const st = started(3);
  tick(st, { now: GO });
  atTreasure(st, 'p1');
  onFound(st, 'p1', { ms: 3000 }, GO + 3000);
  tick(st, { now: GO + 3300 });
  atTreasure(st, 'p2');
  onFound(st, 'p2', { ms: 6000 }, GO + 6000);
  assert.equal(st.race.winnerId, 'p1');
  dropPlayer(st, { id: 'p1', now: GO + 6100 });
  assert.equal(st.race.winnerId, 'p2', 'pemenang baru dari peringkat berikutnya');
  assert.equal(st.phase, 'round');
  dropPlayer(st, { id: 'p2', now: GO + 6200 });
  assert.equal(st.players.length, 1);
  assert.equal(st.phase, 'lobby');
  assert.equal(st.race, null);
});

test('pemburu baru boleh masuk saat lobby/over tapi tidak saat ronde berjalan', () => {
  const st = started(2);
  assert.equal(st.race.status, 'countdown');
  assert.equal(addPlayer(st, { id: 'late', name: 'Late', now: GO }).ok, true);
  assert.ok(st.race.racers.late, 'peserta telat ikut ronde yang sedang berjalan');
  assert.equal(toView(st, 'late', GO).you.id, 'late');
});

test('view: koordinat harta tidak pernah bocor sebelum ada yang menyentuh', () => {
  const st = started(2);
  tick(st, { now: GO });
  const v = toView(st, 'p1', GO);
  assert.equal(v.mode, 'harta');
  assert.equal(v.race.treasure, null);
  assert.equal(JSON.stringify(v).includes('"x":' + st.race.treasure.x + ',"z":' + st.race.treasure.z), false);
  atTreasure(st, 'p1');
  onFound(st, 'p1', { ms: 2000 }, GO + 2000);
  tick(st, { now: GO + 2300 });
  const w = toView(st, 'p2', GO + 2300);
  assert.deepEqual(w.race.treasure, { x: st.race.treasure.x, z: st.race.treasure.z });
  assert.equal(w.race.winnerName, 'Buru1');
});

test('view: posisi semua pemburu ikut terkirim supaya saling terlihat', () => {
  const st = started(3);
  tick(st, { now: GO });
  onMove(st, 'p2', { x: st.race.racers.p2.x + 2, z: st.race.racers.p2.z, s: 1 }, GO + 400);
  const v = toView(st, 'p1', GO + 400);
  const row = v.race.racers.find((r) => r.id === 'p2');
  assert.equal(Math.abs(row.x - st.race.racers.p2.x) <= 0.1, true);
  assert.equal(row.name, 'Buru2');
  assert.equal(typeof row.color, 'string');
  assert.equal(v.feed.length <= CFG.feedKeep, true);
});
