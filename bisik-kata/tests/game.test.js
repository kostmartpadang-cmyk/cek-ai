import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CFG,
  createRoom,
  addPlayer,
  dropPlayer,
  startGame,
  submitHint,
  submitGuess,
  giveUpRound,
  tick,
  toView,
  standings,
  maskWord,
  sameWord,
} from '../js/game.js';

const WORDS = [
  { w: 'Kopi', c: 'Makanan & Minuman' },
  { w: 'Teh manis', c: 'Makanan & Minuman' },
  { w: 'Nasi goreng', c: 'Makanan & Minuman' },
  { w: 'Kucing oren', c: 'Hewan' },
];
const rng = () => 0;
const T0 = 1_000_000;

function room3() {
  const st = createRoom({ code: 'ABCD', hostId: 'h', hostName: 'Host', now: T0 });
  addPlayer(st, { id: 'a', name: 'Awi', now: T0 + 100 });
  addPlayer(st, { id: 'b', name: 'Bil', now: T0 + 200 });
  return st;
}

test('lobby: validasi nama & kapasitas', () => {
  const st = room3();
  assert.equal(addPlayer(st, { id: 'c', name: '  ', now: T0 }).ok, false);
  assert.equal(addPlayer(st, { id: 'c', name: 'Host', now: T0 }).error.includes('sudah dipakai'), true);
  for (const id of ['p3', 'p4', 'p5', 'p6', 'p7']) addPlayer(st, { id, name: 'P' + id, now: T0 });
  assert.equal(st.players.length, CFG.maxPlayers);
  assert.equal(addPlayer(st, { id: 'p8', name: 'Lewet', now: T0 }).ok, false);
});

test('butuh 2 pemain untuk mulai', () => {
  const st = createRoom({ code: 'ABCD', hostId: 'h', hostName: 'Host', now: T0 });
  assert.equal(startGame(st, { now: T0, words: WORDS, rng }).ok, false);
});

test('ronde 1: kata, giliran pemimpin, dan spoiler dijaga', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  assert.equal(st.round.word, 'Kopi');
  assert.equal(st.round.leaderId, 'h');
  assert.equal(st.round.total, 3);
  assert.equal(toView(st, 'h', T0).round.secret, 'Kopi');
  assert.equal(toView(st, 'a', T0).round.secret, null);
  assert.equal(toView(st, 'a', T0).round.mask.includes('K'), false);
  assert.equal(JSON.stringify(toView(st, 'a', T0)).includes('Kopi'), false);
});

test('petunjuk: hanya pemimpin, dilarang membocorkan kata', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  assert.equal(submitHint(st, { id: 'a', text: 'minuman', now: T0 }).ok, false);
  assert.equal(submitHint(st, { id: 'h', text: 'k', now: T0 }).ok, false);
  assert.equal(submitHint(st, { id: 'h', text: 'kopiku', now: T0 }).ok, false);
  assert.equal(submitHint(st, { id: 'h', text: 'suka begadang', now: T0 }).ok, true);
  assert.equal(st.round.hints.length, 1);
  for (let i = 0; i < 8; i++) submitHint(st, { id: 'h', text: 'petunjuk' + i, now: T0 });
  assert.equal(st.round.hints.length, CFG.maxHints);
});

test('tebakan benar memberi poin ke penebak dan pemimpin', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  submitHint(st, { id: 'h', text: 'minuman', now: T0 + 1000 });
  assert.equal(submitGuess(st, { id: 'h', text: 'kopi', now: T0 + 2000 }).ok, false);
  assert.equal(submitGuess(st, { id: 'a', text: 'teh', now: T0 + 3000 }).solved, false);
  const res = submitGuess(st, { id: 'a', text: 'Kopi!', now: T0 + 10000 });
  assert.equal(res.solved, true);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.round.points.base, 88);
  assert.equal(st.round.points.bonus, 15);
  assert.equal(standings(st)[0].score, 103);
  assert.equal(st.players.find((p) => p.id === 'h').score, 88);
});

test('toleransi penulisan jawaban', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  st.round.word = 'Nasi goreng';
  for (const g of ['nasi goreng', 'Nasi Goreng', 'nasi-goreng', 'nasigoreng', 'itu nasi goreng'])
    assert.equal(sameWord(g, 'Nasi goreng'), true, g);
  for (const g of ['goreng', 'nasi', 'mie goreng']) assert.equal(sameWord(g, 'Nasi goreng'), false, g);
});

test('waktu habis lalu ronde berganti dan pemimpin berotasi', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  assert.equal(tick(st, { now: T0 + CFG.roundMs - 1, words: WORDS, rng }), false);
  assert.equal(tick(st, { now: T0 + CFG.roundMs, words: WORDS, rng }), true);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.round.status, 'timeout');
  assert.equal(st.players.every((p) => p.score === 0), true);
  assert.equal(tick(st, { now: T0 + CFG.roundMs + CFG.revealMs, words: WORDS, rng }), true);
  assert.equal(st.phase, 'round');
  assert.equal(st.round.index, 1);
  assert.equal(st.round.leaderId, 'a');
  assert.notEqual(st.round.word, 'Kopi');
  assert.equal(st.usedWords.length, 2);
});

test('pemimpin menyerah membuka kata tanpa poin', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  assert.equal(giveUpRound(st, { id: 'a', now: T0 }).ok, false);
  assert.equal(giveUpRound(st, { id: 'h', now: T0 }).ok, true);
  assert.equal(st.round.status, 'gaveup');
  assert.equal(toView(st, 'a', T0).round.secret, 'Kopi');
});

test('ronde terakhir menutup permainan', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  let now = T0;
  for (let i = 0; i < 12; i++) {
    now += CFG.roundMs + CFG.revealMs;
    tick(st, { now, words: WORDS, rng });
  }
  assert.equal(st.phase, 'over');
  assert.equal(st.round.index, 2);
});

test('pemimpin keluar saat ronde berjalan', () => {
  const st = room3();
  startGame(st, { now: T0, words: WORDS, rng });
  dropPlayer(st, { id: 'h', now: T0 + 5000 });
  assert.equal(st.phase, 'reveal');
  assert.equal(st.round.status, 'leader-left');
  assert.equal(st.players.length, 2);
  assert.equal(st.order.includes('h'), false);
});

test('sisa satu pemain mengembalikan ke lobby', () => {
  const st = createRoom({ code: 'ABCD', hostId: 'h', hostName: 'Host', now: T0 });
  addPlayer(st, { id: 'a', name: 'Awi', now: T0 });
  startGame(st, { now: T0, words: WORDS, rng });
  dropPlayer(st, { id: 'a', now: T0 + 1000 });
  assert.equal(st.phase, 'lobby');
  assert.equal(st.round, null);
});

test('mask kata: jumlah huruf terlihat, petunjuk terakhir membuka huruf awal', () => {
  assert.equal(maskWord('Nasi goreng', false), '···· ······');
  assert.equal(maskWord('Gado-gado', false), '····-····');
  assert.equal(maskWord('Kopi', true)[0], 'K');
  assert.equal(maskWord('Kopi', true), 'K···');
});
