export const CFG = {
  roundMs: 60000,
  revealMs: 6500,
  maxHints: 6,
  maxPlayers: 8,
  nameMax: 16,
  hintMax: 32,
  guessMax: 40,
  feedKeep: 14,
};

const HINT_SCORE = [100, 88, 76, 64, 52, 40, 30];

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameWord(guess, word) {
  const a = norm(guess);
  const b = norm(word);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.replace(/\s/g, '') === b.replace(/\s/g, '')) return true;
  return a.split(' ').length <= 3 && (' ' + a + ' ').includes(' ' + b + ' ');
}

export function maskWord(word, revealFirst) {
  let used = false;
  return word
    .split(' ')
    .map((part) =>
      part
        .split('-')
        .map((piece) => {
          const letters = piece.replace(/[^A-Za-z0-9]/g, '');
          if (revealFirst && !used && letters) {
            used = true;
            return letters[0] + '·'.repeat(Math.max(0, letters.length - 1));
          }
          return '·'.repeat(letters.length || 1);
        })
        .join('-'),
    )
    .join(' ');
}

function findPlayer(state, id) {
  return state.players.find((p) => p.id === id);
}

function nameOf(state, id) {
  return (findPlayer(state, id) || {}).name || '?';
}

function feed(state, kind, text, at) {
  state.feed.push({ id: state.feedSeq++, at, kind, text });
  if (state.feed.length > CFG.feedKeep * 4) state.feed.splice(0, state.feed.length - CFG.feedKeep * 4);
}

function pointsFor({ hintsUsed, msLeft }) {
  const base = HINT_SCORE[Math.min(hintsUsed, HINT_SCORE.length - 1)];
  const bonus = msLeft >= 40000 ? 15 : msLeft >= 20000 ? 8 : 0;
  return { base, bonus, total: base + bonus };
}

export function createRoom({ code, hostId, hostName, now }) {
  return {
    code,
    hostId,
    mode: 'kata',
    phase: 'lobby',
    createdAt: now,
    players: [{ id: hostId, name: hostName, score: 0, joinedAt: now }],
    order: [],
    usedWords: [],
    round: null,
    feed: [],
    feedSeq: 1,
  };
}

export function addPlayer(state, { id, name, now }) {
  const clean = String(name || '').trim().slice(0, CFG.nameMax);
  if (!clean) return { ok: false, error: 'Nama tidak boleh kosong.' };
  if (findPlayer(state, id)) return { ok: true };
  if (state.players.some((p) => norm(p.name) === norm(clean)))
    return { ok: false, error: `Nama "${clean}" sudah dipakai. Pakai nama lain ya.` };
  if (state.players.length >= CFG.maxPlayers) return { ok: false, error: 'Kamar penuh (maksimum 8 pemain).' };
  state.players.push({ id, name: clean, score: 0, joinedAt: now });
  feed(state, 'join', `${clean} masuk kamar.`, now);
  return { ok: true };
}

export function dropPlayer(state, { id, now }) {
  const p = findPlayer(state, id);
  if (!p) return { ok: false };
  feed(state, 'sys', `${p.name} keluar.`, now);
  const r = state.round;
  if (state.phase === 'round' && r && r.status === 'active' && r.leaderId === id) {
    r.status = 'leader-left';
    r.revealAt = now;
    r.revealUntil = now + CFG.revealMs;
    state.phase = 'reveal';
    feed(state, 'reveal', `Pemimpin keluar. Kata rahasianya: ${r.word}`, now);
  }
  state.players = state.players.filter((x) => x.id !== id);
  state.order = state.order.filter((x) => x !== id);
  if (state.round) state.round.total = state.order.length;
  if (state.players.length < 2) {
    state.phase = 'lobby';
    state.round = null;
    state.order = [];
    feed(state, 'sys', 'Pemain tinggal satu. Kembali ke lobby, tunggu teman gabung.', now);
  }
  return { ok: true };
}

function pickWord(state, words, rng) {
  const fresh = words.filter((x) => !state.usedWords.includes(x.w));
  const pool = fresh.length ? fresh : words;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

function openRound(state, { now, words, rng }) {
  const idx = state.round ? state.round.index + 1 : 0;
  const leaderId = state.order[idx % state.order.length];
  const leader = findPlayer(state, leaderId) || state.players[0];
  const chosen = pickWord(state, words, rng);
  state.usedWords.push(chosen.w);
  state.round = {
    index: idx,
    total: state.order.length,
    leaderId: leader.id,
    leaderName: leader.name,
    word: chosen.w,
    category: chosen.c,
    hints: [],
    guesses: [],
    status: 'active',
    startedAt: now,
    deadline: now + CFG.roundMs,
    revealAt: 0,
    revealUntil: 0,
    solvedBy: null,
    points: null,
  };
  feed(state, 'sys', `Ronde ${idx + 1}: ${leader.name} pegang kata rahasia.`, now);
}

export function startGame(state, { now, words, rng }) {
  if (state.players.length < 2) return { ok: false, error: 'Butuh minimal 2 pemain.' };
  state.phase = 'round';
  state.order = state.players.map((p) => p.id);
  state.usedWords = [];
  state.round = null;
  for (const p of state.players) p.score = 0;
  feed(state, 'sys', 'Permainan mulai! Tebak kata rahasia dari petunjuk pemimpin.', now);
  openRound(state, { now, words, rng });
  return { ok: true };
}

export function submitHint(state, { id, text, now, words, rng }) {
  if (state.phase !== 'round' || !state.round || state.round.status !== 'active')
    return { ok: false, error: 'Ronde sedang tidak berjalan.' };
  if (state.round.leaderId !== id) return { ok: false, error: 'Hanya pemimpin yang bisa memberi petunjuk.' };
  const clean = String(text || '').trim().slice(0, CFG.hintMax);
  if (clean.length < 2) return { ok: false, error: 'Petunjuknya terlalu pendek.' };
  if (state.round.hints.length >= CFG.maxHints) return { ok: false, error: 'Petunjuk sudah habis (maks 6).' };
  const g = norm(clean);
  const s = norm(state.round.word);
  if (g.includes(s) || s.includes(g)) return { ok: false, error: 'Petunjuk tidak boleh mengandung kata rahasia.' };
  state.round.hints.push({ by: id, text: clean, at: now });
  feed(state, 'hint', `Petunjuk ${state.round.hints.length}: "${clean}"`, now);
  return { ok: true };
}

export function submitGuess(state, { id, text, now }) {
  if (state.phase !== 'round' || !state.round || state.round.status !== 'active')
    return { ok: false, error: 'Ronde sedang tidak berjalan.' };
  const clean = String(text || '').trim().slice(0, CFG.guessMax);
  if (!clean) return { ok: false, error: 'Ketik tebakanmu dulu.' };
  const p = findPlayer(state, id);
  if (!p) return { ok: false };
  if (state.round.leaderId === id) return { ok: false, error: 'Pemimpin tidak boleh menebak kata sendiri.' };
  if (sameWord(clean, state.round.word)) {
    const pts = pointsFor({ hintsUsed: state.round.hints.length, msLeft: Math.max(0, state.round.deadline - now) });
    state.round.status = 'solved';
    state.round.solvedBy = id;
    state.round.points = { guesser: pts.total, leader: pts.base, base: pts.base, bonus: pts.bonus };
    state.round.revealAt = now;
    state.round.revealUntil = now + CFG.revealMs;
    p.score += pts.total;
    const leader = findPlayer(state, state.round.leaderId);
    if (leader) leader.score += pts.base;
    state.phase = 'reveal';
    feed(state, 'right', `${p.name} benar: ${state.round.word}. +${pts.total} poin, pemimpin +${pts.base}.`, now);
    return { ok: true, solved: true };
  }
  state.round.guesses.push({ by: id, text: clean, at: now });
  feed(state, 'wrong', `${p.name} menebak "${clean}" — salah.`, now);
  return { ok: true, solved: false };
}

export function giveUpRound(state, { id, now }) {
  if (state.phase !== 'round' || !state.round || state.round.status !== 'active')
    return { ok: false, error: 'Ronde sedang tidak berjalan.' };
  if (state.round.leaderId !== id) return { ok: false, error: 'Hanya pemimpin yang bisa menyerah.' };
  state.round.status = 'gaveup';
  state.round.revealAt = now;
  state.round.revealUntil = now + CFG.revealMs;
  state.phase = 'reveal';
  feed(state, 'reveal', `Ronde dihentikan pemimpin. Kata rahasianya: ${state.round.word}`, now);
  return { ok: true };
}

export function tick(state, { now, words, rng }) {
  if (!state.round) return false;
  const r = state.round;
  if (r.status === 'active' && now >= r.deadline) {
    r.status = 'timeout';
    r.revealAt = now;
    r.revealUntil = now + CFG.revealMs;
    state.phase = 'reveal';
    feed(state, 'reveal', `Waktu habis! Kata rahasianya: ${r.word}`, now);
    return true;
  }
  if (state.phase === 'reveal' && r.revealUntil && now >= r.revealUntil) {
    if (r.index + 1 >= state.order.length) {
      state.phase = 'over';
      feed(state, 'sys', 'Semua ronde selesai. Lihat papan skor!', now);
    } else {
      state.phase = 'round';
      openRound(state, { now, words, rng });
    }
    return true;
  }
  return false;
}

export function standings(state) {
  return [...state.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

export function toView(state, viewerId, now) {
  const r = state.round;
  const isLeader = !!r && r.leaderId === viewerId;
  const revealed = state.phase === 'reveal' || state.phase === 'over';
  const me = findPlayer(state, viewerId);
  let mask = '';
  if (r) {
    const mercy = revealed || isLeader || now - r.startedAt > CFG.roundMs * 0.6;
    mask = revealed || isLeader ? r.word : maskWord(r.word, mercy);
  }
  return {
    code: state.code,
    mode: 'kata',
    hostId: state.hostId,
    nowHost: now,
    phase: state.phase,
    you: me
      ? { id: me.id, name: me.name, score: me.score, isHost: me.id === state.hostId, isLeader, maxHints: CFG.maxHints }
      : null,
    players: standings(state).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isHost: p.id === state.hostId,
      isLeader: !!r && r.status === 'active' && r.leaderId === p.id,
    })),
    round: r
      ? {
          index: r.index,
          total: r.total,
          leaderId: r.leaderId,
          leaderName: r.leaderName,
          category: r.category,
          status: r.status,
          hints: r.hints.map((h) => h.text),
          guesses: r.guesses.slice(-6).map((g) => ({ text: g.text, by: nameOf(state, g.by) })),
          mask,
          secret: isLeader || revealed ? r.word : null,
          deadline: r.deadline,
          startedAt: r.startedAt,
          roundMs: CFG.roundMs,
          solvedByName: r.solvedBy ? nameOf(state, r.solvedBy) : null,
          points: r.points,
          revealUntil: r.revealUntil,
        }
      : null,
    feed: state.feed.slice(-CFG.feedKeep).reverse(),
  };
}
