import { CFG as M, layoutFor, resolveCircle } from './maps.js';

export const COLORS = ['#e2554b', '#2f7fd1', '#4cba69', '#f2c53d', '#b45fd6', '#3fd2ff', '#ff8a3d', '#eee7d6'];

export const CFG = {
  maxPlayers: 8,
  nameMax: 16,
  countdownMs: 3500,
  roundMs: 150000,
  finishWindowMs: 8000,
  revealMs: 7000,
  arbitrateMs: 260,
  sonarPerRound: 2,
  touchRadius: M.touchRadius,
  spotRadius: M.spotRadius,
  walkSpeed: M.walkSpeed,
  runSpeed: M.runSpeed,
  feedKeep: 10,
  speedBonusMax: 30,
  points: [100, 70, 50, 35, 25, 18, 12, 8],
  mapOrder: ['gudang', 'mainan', 'kuil'],
};

const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const finite = (v) => Number.isFinite(v);

function feed(state, kind, text, at) {
  state.feed.push({ id: state.feedSeq++, at, kind, text });
  if (state.feed.length > CFG.feedKeep * 4) state.feed.splice(0, state.feed.length - CFG.feedKeep * 4);
  state.seq++;
}

function findPlayer(state, id) {
  return state.players.find((p) => p.id === id);
}

function nameOf(state, id) {
  return (findPlayer(state, id) || {}).name || '?';
}

function freeColor(state) {
  let i = 0;
  while (i < COLORS.length && state.players.some((p) => p.color === COLORS[i])) i++;
  return COLORS[i % COLORS.length];
}

function racerAt(layout, slot) {
  const sp = layout.spawns[slot % layout.spawns.length];
  return {
    x: sp.x,
    z: sp.z,
    a: 0,
    s: 0,
    j: 0,
    vx: 0,
    vz: 0,
    lastAt: 0,
    sonar: CFG.sonarPerRound,
    sonarAt: 0,
    finished: false,
    dnf: false,
  };
}

export function createRoom({ code, hostId, hostName, now }) {
  return {
    mode: 'harta',
    code,
    hostId,
    phase: 'lobby',
    mapPick: CFG.mapOrder[0],
    createdAt: now,
    players: [{ id: hostId, name: hostName, score: 0, bestMs: 0, color: COLORS[0], joinedAt: now }],
    race: null,
    feed: [],
    feedSeq: 1,
    seq: 1,
  };
}

export function addPlayer(state, { id, name, now }) {
  const clean = String(name || '').trim().slice(0, CFG.nameMax);
  if (!clean) return { ok: false, error: 'Nama tidak boleh kosong.' };
  if (findPlayer(state, id)) return { ok: true };
  if (state.players.some((p) => p.name.toLowerCase() === clean.toLowerCase()))
    return { ok: false, error: `Nama "${clean}" sudah dipakai. Pakai nama lain ya.` };
  if (state.players.length >= CFG.maxPlayers) return { ok: false, error: 'Kamar penuh (maksimum 8 pemburu).' };
  state.players.push({ id, name: clean, score: 0, bestMs: 0, color: freeColor(state), joinedAt: now });
  feed(state, 'join', `${clean} ikut berburu.`, now);
  const r = state.race;
  if (r && r.status !== 'done' && !r.racers[id]) {
    const q = racerAt(r.layout, state.players.length - 1);
    q.lastAt = now;
    r.racers[id] = q;
  }
  return { ok: true };
}

export function dropPlayer(state, { id, now }) {
  const p = findPlayer(state, id);
  if (!p) return { ok: false };
  feed(state, 'sys', `${p.name} keluar.`, now);
  const r = state.race;
  if (r) {
    if (r.racers[id]) r.racers[id].dnf = true;
    r.results = r.results.filter((x) => x.id !== id);
    if (r.winnerId === id) {
      const nxt = r.results[0];
      r.winnerId = nxt ? nxt.id : null;
      r.winnerMs = nxt ? nxt.ms : 0;
    }
  }
  state.players = state.players.filter((x) => x.id !== id);
  if (state.players.length < 2) {
    state.phase = 'lobby';
    state.race = null;
    feed(state, 'sys', 'Pemburu tinggal satu. Kembali ke ruang tunggu, tunggu teman.', now);
  }
  return { ok: true };
}

export function setMap(state, { id, by }) {
  if (by !== state.hostId) return { ok: false, error: 'Hanya tuan rumah yang memilih tempat.' };
  if (state.race && state.race.status !== 'done') return { ok: false, error: 'Tempat dikunci selama ronde berjalan.' };
  if (!CFG.mapOrder.includes(id)) return { ok: false, error: 'Tempat tidak dikenal.' };
  state.mapPick = id;
  state.seq++;
  return { ok: true };
}

function openRound(state, { now, rng, index }) {
  const want = index === 0 ? state.mapPick : CFG.mapOrder[index % CFG.mapOrder.length];
  const seed = Math.floor(rng() * 0xffffff) >>> 0;
  const layout = layoutFor(want, seed);
  const racers = {};
  state.players.forEach((p, i) => {
    const q = racerAt(layout, i);
    q.lastAt = now;
    racers[p.id] = q;
  });
  state.race = {
    id: 'r' + (index + 1) + '-' + seed.toString(36),
    index,
    total: CFG.mapOrder.length,
    mapId: layout.map.id,
    seed,
    layout,
    start: layout.start,
    treasure: layout.treasure,
    status: 'countdown',
    startedAt: now,
    goAt: now + CFG.countdownMs,
    deadline: now + CFG.countdownMs + CFG.roundMs,
    finishBy: 0,
    revealUntil: 0,
    winnerId: null,
    winnerMs: 0,
    decideAt: 0,
    claims: [],
    results: [],
    racers,
  };
  state.phase = 'round';
  feed(state, 'sys', `Ronde ${index + 1}: ${layout.map.name}. Harta disembunyikan di suatu tempat.`, now);
}

export function startGame(state, { now, rng = Math.random }) {
  if (state.players.length < 2) return { ok: false, error: 'Butuh minimal 2 pemburu.' };
  for (const p of state.players) {
    p.score = 0;
    p.bestMs = 0;
  }
  feed(state, 'sys', 'Berburu Harta mulai! Dulu menyentuh peti emas, dia yang menang.', now);
  openRound(state, { now, rng, index: 0 });
  return { ok: true };
}

function recordFinish(state, claim) {
  const r = state.race;
  const rank = r.results.length;
  const base = CFG.points[Math.min(rank, CFG.points.length - 1)] || 0;
  const bonus = Math.max(0, Math.round(CFG.speedBonusMax * (1 - claim.ms / CFG.roundMs)));
  r.results.push({ id: claim.id, ms: claim.ms, at: claim.at, rank: rank + 1, points: { base, bonus, total: base + bonus } });
  const p = findPlayer(state, claim.id);
  if (p) {
    p.score += base + bonus;
    if (!p.bestMs || claim.ms < p.bestMs) p.bestMs = claim.ms;
  }
}

function decideWinner(state, now) {
  const r = state.race;
  if (!r.claims.length || now < r.decideAt) return;
  const sorted = r.claims.sort((a, b) => a.ms - b.ms || a.at - b.at);
  r.claims = [];
  for (const c of sorted) if (!r.results.some((x) => x.id === c.id)) recordFinish(state, c);
  const first = r.results[0];
  if (first) {
    r.winnerId = first.id;
    r.winnerMs = first.ms;
    r.finishBy = now + CFG.finishWindowMs;
  }
  state.seq++;
}

function closeRound(state, now, reason) {
  const r = state.race;
  if (!r || r.status === 'done') return;
  r.status = 'done';
  r.revealUntil = now + CFG.revealMs;
  state.phase = 'reveal';
  state.seq++;
  feed(
    state,
    r.winnerId ? 'win' : 'reveal',
    r.winnerId ? `${nameOf(state, r.winnerId)} dapat hartanya duluan dalam ${(r.winnerMs / 1000).toFixed(1)} detik!` : reason,
    now,
  );
}

export function onMove(state, id, msg, now) {
  const r = state.race;
  if (!r || r.status === 'done') return { ok: false };
  const p = r.racers[id];
  if (!p || p.dnf) return { ok: false };
  const x = num(msg.x);
  const z = num(msg.z);
  if (!finite(x) || !finite(z)) return { ok: false };
  const b = r.layout.bounds;
  if (Math.abs(x) > b.hw + 2 || Math.abs(z) > b.hd + 2) return { ok: false };
  const fixed = resolveCircle(r.layout, x, z, M.playerR);
  const dt = Math.max(0.08, (now - (p.lastAt || now)) / 1000);
  if (Math.hypot(fixed.x - p.x, fixed.z - p.z) > CFG.runSpeed * 1.9 * dt) return { ok: false };
  p.vx = (fixed.x - p.x) / dt;
  p.vz = (fixed.z - p.z) / dt;
  p.x = fixed.x;
  p.z = fixed.z;
  if (finite(num(msg.a))) p.a = num(msg.a);
  p.s = msg.s === 2 ? 2 : msg.s === 1 ? 1 : 0;
  p.j = msg.j ? 1 : 0;
  p.lastAt = now;
  return { ok: true };
}

export function onFound(state, id, msg, now) {
  const r = state.race;
  if (!r) return { ok: false, error: 'Balapan belum dimulai.' };
  if (r.status === 'countdown') return { ok: false, error: 'Tunggu hitungan mundur sampai habis.' };
  if (r.status === 'done') return { ok: false, error: 'Ronde ini sudah selesai.' };
  const p = r.racers[id];
  if (!p || p.dnf) return { ok: false };
  if (p.finished) return { ok: false, error: 'Kamu sudah menemukan hartanya.' };
  const d = Math.hypot(p.x - r.treasure.x, p.z - r.treasure.z);
  if (!(d <= CFG.touchRadius * 2.5)) return { ok: false, error: 'Hartanya belum ada di tanganmu.' };

  const hostMs = Math.max(0, now - r.goAt);
  let ms = num(msg.ms);
  if (!finite(ms) || ms <= 0) ms = hostMs;
  ms = Math.min(Math.max(ms, hostMs - 1500), hostMs);

  p.finished = true;
  const claim = { id, ms, at: now };
  if (r.winnerId) {
    recordFinish(state, claim);
    state.seq++;
  } else {
    r.claims.push(claim);
    if (!r.decideAt) r.decideAt = now + CFG.arbitrateMs;
  }
  feed(state, 'found', `${nameOf(state, id)} menyentuh peti emas!`, now);
  return { ok: true };
}

export function onSonar(state, id, now) {
  const r = state.race;
  if (!r || r.status === 'countdown') return { ok: false, error: 'Sonar belum aktif saat hitungan mundur.' };
  if (r.status === 'done') return { ok: false, error: 'Ronde sudah selesai.' };
  const p = r.racers[id];
  if (!p || p.dnf || p.finished) return { ok: false };
  if (p.sonar <= 0) return { ok: false, error: 'Sonar habis (2 kali per ronde).' };
  p.sonar--;
  p.sonarAt = now;
  state.seq++;
  return { ok: true, left: p.sonar };
}

export function tick(state, { now }) {
  const r = state.race;
  if (!r) return false;

  if (r.status === 'countdown' && now >= r.goAt) {
    r.status = 'running';
    state.seq++;
    feed(state, 'go', 'Cari!', now);
  }

  if (!r.winnerId && r.claims.length) decideWinner(state, now);

  if (r.status === 'running') {
    if (r.winnerId && now >= r.finishBy) closeRound(state, now, null);
    else if (now >= r.deadline) closeRound(state, now, 'Waktu habis, tidak ada yang menemukan hartanya.');
  }

  if (state.phase === 'reveal' && r.revealUntil && now >= r.revealUntil) {
    if (r.index + 1 >= r.total) {
      state.phase = 'over';
      feed(state, 'sys', 'Semua tempat sudah dijelajah. Saatnya lihat papan skor!', now);
    } else {
      openRound(state, { now, rng: Math.random, index: r.index + 1 });
    }
    return true;
  }
  return false;
}

export function standings(state) {
  return [...state.players].sort(
    (a, b) => b.score - a.score || (a.bestMs || Infinity) - (b.bestMs || Infinity) || a.joinedAt - b.joinedAt,
  );
}

export function toView(state, viewerId, now) {
  const r = state.race;
  const me = findPlayer(state, viewerId);
  const revealed = !!r && (!!r.winnerId || r.status === 'done' || state.phase === 'over');
  return {
    code: state.code,
    hostId: state.hostId,
    mode: 'harta',
    nowHost: now,
    phase: state.phase,
    seq: state.seq,
    mapPick: state.mapPick,
    you: me ? { id: me.id, name: me.name, score: me.score, color: me.color, isHost: me.id === state.hostId } : null,
    players: standings(state).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      color: p.color,
      bestMs: p.bestMs || 0,
      isHost: p.id === state.hostId,
    })),
    race: r
      ? {
          id: r.id,
          index: r.index,
          total: r.total,
          mapId: r.mapId,
          mapName: r.layout.map.name,
          mapSub: r.layout.map.sub,
          seed: r.seed,
          status: r.status,
          goAt: r.goAt,
          deadline: r.deadline,
          revealUntil: r.revealUntil,
          roundMs: CFG.roundMs,
          countdownMs: CFG.countdownMs,
          winnerId: r.winnerId,
          winnerName: r.winnerId ? nameOf(state, r.winnerId) : null,
          winnerMs: r.winnerMs,
          results: r.results.map((x) => ({ id: x.id, name: nameOf(state, x.id), ms: x.ms, rank: x.rank })),
          treasure: revealed ? { x: r.treasure.x, z: r.treasure.z } : null,
          racers: state.players.map((p) => {
            const q = r.racers[p.id];
            if (!q) return { id: p.id, name: p.name, color: p.color, x: 0, z: 0, a: 0, s: 0, j: 0, gone: true };
            return {
              id: p.id,
              name: p.name,
              color: p.color,
              x: Math.round(q.x * 10) / 10,
              z: Math.round(q.z * 10) / 10,
              a: Math.round(q.a * 100) / 100,
              s: q.s,
              j: q.j,
              finished: !!q.finished,
              dnf: !!q.dnf,
              sonar: q.sonar,
              sonarAt: q.sonarAt,
              ms: (r.results.find((x) => x.id === p.id) || {}).ms || 0,
            };
          }),
        }
      : null,
    feed: state.feed.slice(-CFG.feedKeep).reverse(),
  };
}
