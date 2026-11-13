const PALETTES = {
  gudang: {
    wall: '#6b5335',
    wallDark: '#54402a',
    wood: '#8a6237',
    woodDark: '#6a4a29',
    cask: '#7c5230',
    rope: '#b99a63',
    trim: '#c8963e',
    floor: '#4a3826',
    floor2: '#3d2e1f',
  },
  mainan: {
    wall: '#2f6ea8',
    wallDark: '#255a8a',
    red: '#e2554b',
    blue: '#2f7fd1',
    green: '#4cba69',
    yellow: '#f2c53d',
    white: '#e8e6df',
    trim: '#ffd76b',
    floor: '#3a5f80',
    floor2: '#325370',
  },
  kuil: {
    wall: '#8d8272',
    wallDark: '#6f665a',
    stone: '#a3988a',
    stoneLight: '#c0b6a6',
    stoneDim: '#7b7164',
    bronze: '#a9762f',
    gold: '#e0b352',
    moss: '#5f7a45',
    trim: '#e6c470',
    floor: '#776c5d',
    floor2: '#6a6052',
  },
};

export const MAPS = [
  {
    id: 'gudang',
    name: 'Gudang Kuno',
    sub: 'rak kayu, tumpukan peti, tong tua',
    kind: 'gudang',
    size: { w: 48, d: 34 },
    wallH: 8,
    startAt: { x: 0.4, z: 0.02 },
    sky: '#1b1409',
    fog: [14, 64],
    hemi: ['#7d8ea6', '#3a2c1c', 0.85],
    key: ['#ffe1b0', 0.75, 0.7],
    theme: 'gudang',
    partitions: [
      { x: 0.06, z: -0.19, w: 0.02, d: 0.42 },
      { x: 0.06, z: 0.2, w: 0.02, d: 0.28 },
      { x: -0.2, z: 0.02, w: 0.34, d: 0.02 },
      { x: 0.27, z: -0.09, w: 0.02, d: 0.3 },
      { x: -0.13, z: -0.33, w: 0.26, d: 0.02 },
    ],
    recipes: [
      {
        mode: 'random',
        n: 24,
        kinds: [
          { s: 'box', c: 'wood', w: [1.7, 3.1], d: [1.7, 3.1], h: [1.5, 3.2] },
          { s: 'box', c: 'woodDark', w: [1.5, 2.4], d: [1.5, 2.4], h: [1.3, 2.6] },
        ],
      },
      {
        mode: 'random',
        n: 9,
        kinds: [{ s: 'box', c: 'woodDark', w: [1.3, 2.2], d: [3.6, 6.2], h: [3.6, 5.2] }],
      },
      { mode: 'random', n: 12, kinds: [{ s: 'cyl', c: 'cask', w: [1.2, 1.7], d: [1.2, 1.7], h: [1.7, 2.5] }] },
      { mode: 'random', n: 11, kinds: [{ s: 'box', c: 'rope', w: [2.0, 3.0], d: [1.3, 2.1], h: [0.35, 0.55] }] },
    ],
  },
  {
    id: 'mainan',
    name: 'Ruang Mainan',
    sub: 'balok besar bersol, karpet, tumpukan kotak',
    kind: 'mainan',
    size: { w: 42, d: 40 },
    wallH: 7,
    startAt: { x: 0.0, z: 0.4 },
    sky: '#122436',
    fog: [16, 70],
    hemi: ['#9fd0ff', '#2a4157', 0.95],
    key: ['#ffffff', 0.65, 0.8],
    theme: 'mainan',
    partitions: [
      { x: -0.11, z: -0.06, w: 0.28, d: 0.02 },
      { x: 0.15, z: 0.11, w: 0.02, d: 0.26 },
      { x: -0.02, z: 0.19, w: 0.22, d: 0.02 },
      { x: -0.27, z: 0.1, w: 0.02, d: 0.3 },
    ],
    recipes: [
      {
        mode: 'random',
        n: 30,
        kinds: [
          { s: 'brick', c: 'red', w: [1.8, 3.2], d: [1.8, 3.2], h: [1.0, 2.6] },
          { s: 'brick', c: 'blue', w: [1.8, 3.2], d: [1.8, 3.2], h: [1.0, 2.6] },
          { s: 'brick', c: 'green', w: [1.6, 2.6], d: [1.6, 2.6], h: [0.9, 2.2] },
          { s: 'brick', c: 'yellow', w: [1.6, 2.6], d: [1.6, 2.6], h: [0.9, 2.2] },
          { s: 'brick', c: 'white', w: [2.0, 3.4], d: [2.0, 3.4], h: [1.1, 2.8] },
        ],
      },
      { mode: 'random', n: 9, kinds: [{ s: 'brick', c: 'white', w: [1.3, 1.9], d: [1.3, 1.9], h: [3.2, 4.6] }] },
      { mode: 'random', n: 10, kinds: [{ s: 'brick', c: 'blue', w: [2.8, 4.4], d: [2.2, 3.4], h: [0.3, 0.5] }] },
      { mode: 'random', n: 8, kinds: [{ s: 'cyl', c: 'red', w: [1.4, 2.0], d: [1.4, 2.0], h: [1.0, 1.8] }] },
    ],
  },
  {
    id: 'kuil',
    name: 'Kuil Terbengkalai',
    sub: ' pilar batu,arca, bara api',
    kind: 'kuil',
    size: { w: 44, d: 38 },
    wallH: 9,
    startAt: { x: -0.4, z: 0.0 },
    sky: '#101a16',
    fog: [13, 58],
    hemi: ['#88a89a', '#2b2f22', 0.8],
    key: ['#ffeccb', 0.7, 0.6],
    theme: 'kuil',
    partitions: [
      { x: 0.12, z: 0.0, w: 0.02, d: 0.36 },
      { x: -0.1, z: -0.22, w: 0.3, d: 0.02 },
      { x: -0.1, z: 0.24, w: 0.3, d: 0.02 },
      { x: 0.3, z: -0.12, w: 0.2, d: 0.02 },
    ],
    recipes: [
      { mode: 'lattice', n: 12, step: [7.5, 8], jitter: 1.1, keep: 0.72, kinds: [{ s: 'cyl', c: 'stone', w: [1.7, 2.3], d: [1.7, 2.3], h: [5.5, 7.5] }] },
      { mode: 'random', n: 7, kinds: [{ s: 'box', c: 'stoneLight', w: [1.7, 2.1], d: [3.2, 4.2], h: [1.7, 2.3] }] },
      { mode: 'random', n: 8, kinds: [{ s: 'box', c: 'moss', w: [1.6, 2.4], d: [1.6, 2.6], h: [2.6, 4.2] }] },
      { mode: 'random', n: 20, kinds: [{ s: 'box', c: 'stoneDim', w: [0.7, 1.7], d: [0.7, 1.7], h: [0.5, 1.5] }] },
      { mode: 'random', n: 6, kinds: [{ s: 'cyl', c: 'bronze', w: [0.9, 1.2], d: [0.9, 1.2], h: [1.3, 1.7] }] },
    ],
  },
];

export const CFG = {
  playerR: 0.46,
  stepH: 0.9,
  walkSpeed: 6.2,
  runSpeed: 9.2,
  touchRadius: 1.5,
  spotRadius: 10,
  maxPlayers: 8,
  nameMax: 16,
  cell: 1,
};

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rngFor(mapId, seed) {
  return mulberry32((hashStr(String(mapId)) ^ Math.imul(seed >>> 0, 2654435761)) >>> 0);
}

const half = (v) => v / 2;

function overlaps(a, b, pad) {
  return (
    Math.abs(a.x - b.x) < half(a.w) + half(b.w) + pad && Math.abs(a.z - b.z) < half(a.d) + half(b.d) + pad
  );
}

function nearCircle(boxes, x, z, r) {
  for (const b of boxes) {
    const dx = Math.abs(x - b.x) - half(b.w);
    const dz = Math.abs(z - b.z) - half(b.d);
    if (dx < r && dz < r) return true;
  }
  return false;
}

function pushBox(list, x, z, w, d, h, c, s, wall) {
  list.push({ x, z, w, d, h, c, s: s || 'box', wall: !!wall });
}

function scatter(rng, boxes, map, rec, pads) {
  const W = map.size.w;
  const D = map.size.d;
  const m = 1.6;
  const spots = [];
  if (rec.mode === 'lattice') {
    const [sx, sz] = rec.step;
    for (let x = -half(W) + sx; x < half(W) - sx * 0.4; x += sx) {
      for (let z = -half(D) + sz; z < half(D) - sz * 0.4; z += sz) spots.push([x, z]);
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
  } else {
    const n = rec.n * 9;
    for (let i = 0; i < n; i++) spots.push([-m - half(W) + rng() * (W - 2 * m), -m - half(D) + rng() * (D - 2 * m)]);
  }

  let placed = 0;
  for (const [bx, bz] of spots) {
    if (placed >= rec.n) break;
    if (rec.mode === 'lattice' && rng() > rec.keep) continue;
    const kinds = rec.kinds;
    const pick = kinds[Math.floor(rng() * kinds.length) % kinds.length];
    const dim = (r) => r[0] + rng() * (r[1] - r[0]);
    const w = dim(pick.w);
    const d = pick.s === 'cyl' ? w : dim(pick.d);
    const h = dim(pick.h);
    const jt = rec.mode === 'lattice' ? rec.jitter : 0;
    const x = bx + (rng() * 2 - 1) * jt;
    const z = bz + (rng() * 2 - 1) * jt;
    if (Math.abs(x) + half(w) > half(W) - 0.6 || Math.abs(z) + half(d) > half(D) - 0.6) continue;
    const cand = { x, z, w, d };
    let bad = false;
    for (const b of boxes) {
      if (overlaps(cand, b, 0.35)) {
        bad = true;
        break;
      }
    }
    if (!bad) for (const p of pads) if (Math.hypot(x - p.x, z - p.z) < p.r + Math.max(half(w), half(d))) (bad = true), (p.hit = true);
    if (bad) continue;
    pushBox(boxes, x, z, w, d, h, pick.c, pick.s);
    placed++;
  }
  return placed;
}

function makeGrid(map) {
  const cell = CFG.cell;
  const cols = Math.ceil(map.size.w / cell);
  const rows = Math.ceil(map.size.d / cell);
  return { cell, cols, rows, blocked: new Uint8Array(cols * rows) };
}

function cx(g, x) {
  return Math.floor(x / g.cell + g.cols / 2);
}
function cz(g, z) {
  return Math.floor(z / g.cell + g.rows / 2);
}
function atWorld(g, i) {
  const cell = g.cell;
  return { x: ((i % g.cols) + 0.5) * cell - g.cols * cell / 2, z: (Math.floor(i / g.cols) + 0.5) * cell - g.rows * cell / 2 };
}

function paint(g, boxes) {
  g.blocked.fill(0);
  const pad = CFG.playerR;
  for (const b of boxes) {
    if (!b.wall && b.h < CFG.stepH) continue;
    const x0 = cx(g, b.x - half(b.w) - pad);
    const x1 = cx(g, b.x + half(b.w) + pad);
    const z0 = cz(g, b.z - half(b.d) - pad);
    const z1 = cz(g, b.z + half(b.d) + pad);
    for (let i = Math.max(0, x0); i <= Math.min(g.cols - 1, x1); i++)
      for (let j = Math.max(0, z0); j <= Math.min(g.rows - 1, z1); j++) g.blocked[j * g.cols + i] = 1;
  }
}

function reachFrom(g, seeds) {
  const seen = new Uint8Array(g.cols * g.rows);
  const q = [];
  for (const s of seeds) {
    const i = cz(g, s.z) * g.cols + cx(g, s.x);
    if (i >= 0 && i < seen.length && !seen[i] && !g.blocked[i]) {
      seen[i] = 1;
      q.push(i);
    }
  }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    const cix = cur % g.cols;
    const riz = Math.floor(cur / g.cols);
    const nb = [cix > 0 ? cur - 1 : -1, cix < g.cols - 1 ? cur + 1 : -1, riz > 0 ? cur - g.cols : -1, riz < g.rows - 1 ? cur + g.cols : -1];
    for (const n of nb) if (n >= 0 && !seen[n] && !g.blocked[n]) (seen[n] = 1), q.push(n);
  }
  return seen;
}

function freeReach(g, seen) {
  const out = [];
  for (let i = 0; i < seen.length; i++) if (seen[i]) out.push(atWorld(g, i));
  return out;
}

function nearest(list, x, z, taken, minGap) {
  let best = null;
  let bd = Infinity;
  for (const p of list) {
    if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < minGap)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function freeCells(g) {
  const out = [];
  for (let i = 0; i < g.blocked.length; i++) if (!g.blocked[i]) out.push(atWorld(g, i));
  return out;
}

function openReach(g, from) {
  const free = freeCells(g);
  let seed = null;
  let bd = Infinity;
  for (const c of free) {
    const d = Math.hypot(c.x - from.x, c.z - from.z);
    if (d < bd) {
      bd = d;
      seed = c;
    }
  }
  if (!seed) return null;
  return { open: freeReach(g, reachFrom(g, [seed])), start: seed };
}

export function buildLayout(map, rng) {
  const W = map.size.w;
  const D = map.size.d;
  const boxes = [];
  const t = 1.4;
  pushBox(boxes, 0, -half(D) - half(t), W + t * 2, t, map.wallH, 'wall', 'box', true);
  pushBox(boxes, 0, half(D) + half(t), W + t * 2, t, map.wallH, 'wall', 'box', true);
  pushBox(boxes, -half(W) - half(t), 0, t, D, map.wallH, 'wall', 'box', true);
  pushBox(boxes, half(W) + half(t), 0, t, D, map.wallH, 'wall', 'box', true);
  for (const p of map.partitions)
    pushBox(boxes, p.x * W, p.z * D, Math.max(0.8, p.w * W), Math.max(0.8, p.d * D), map.wallH * 0.86, 'wallDark', 'box', true);

  const g = makeGrid(map);
  paint(g, boxes);
  const rough = openReach(g, { x: map.startAt.x * half(W), z: map.startAt.z * half(D) });
  if (!rough) return null;
  const start = rough.start;

  const pads = [{ x: start.x, z: start.z, r: 3.4 }];
  for (const rec of map.recipes) scatter(rng, boxes, map, rec, pads);

  paint(g, boxes);
  const pass = openReach(g, start);
  if (!pass) return null;
  const open = pass.open;

  const spawns = [];
  for (let i = 0; i < CFG.maxPlayers; i++) {
    const ang = (i / CFG.maxPlayers) * Math.PI * 2;
    const anchor = { x: start.x + Math.cos(ang) * 2.6, z: start.z + Math.sin(ang) * 2.6 };
    const p = nearest(open, anchor.x, anchor.z, spawns, 2.4) || nearest(open, start.x, start.z, spawns, 2.4);
    if (p) spawns.push({ x: p.x, z: p.z });
  }
  if (spawns.length < 2) return null;

  const spots = open.filter((p) => !nearCircle(boxes, p.x, p.z, CFG.playerR + 0.9));
  if (spots.length < 4) return null;
  let far = 0;
  for (const p of spots) {
    let dmin = Infinity;
    for (const s of spawns) dmin = Math.min(dmin, Math.hypot(p.x - s.x, p.z - s.z));
    p.dmin = dmin;
    if (dmin > far) far = dmin;
  }
  const floor = Math.max(10, far * 0.62);
  let treasure = null;
  let bestScore = -1;
  for (const p of spots) {
    if (p.dmin < floor) continue;
    const score = p.dmin + rng() * 7;
    if (score > bestScore) {
      bestScore = score;
      treasure = p;
    }
  }
  if (!treasure) return null;
  treasure = { x: treasure.x, z: treasure.z };

  const decoys = [];
  const pool = spots.filter(
    (p) =>
      Math.hypot(p.x - treasure.x, p.z - treasure.z) > 7 &&
      Math.hypot(p.x - treasure.x, p.z - treasure.z) < 26 &&
      p.dmin > 6,
  );
  let cursor = treasure;
  for (let k = 0; k < 3; k++) {
    let pick = null;
    let bd = -1;
    for (const p of pool) {
      if (decoys.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 6)) continue;
      if (Math.hypot(p.x - cursor.x, p.z - cursor.z) < 7) continue;
      const d = rng();
      if (d > bd) {
        bd = d;
        pick = p;
      }
    }
    if (!pick) break;
    decoys.push({ x: pick.x, z: pick.z });
    cursor = pick;
  }

  return {
    map,
    boxes,
    palette: PALETTES[map.theme],
    bounds: { w: W, d: D, hw: half(W), hd: half(D) },
    spawns,
    treasure,
    decoys,
    start,
  };
}

const cache = new Map();

export function layoutFor(mapId, seed) {
  const key = mapId + ':' + seed;
  let hit = cache.get(key);
  if (hit) return hit;
  const map = mapById(mapId);
  let layout = null;
  for (let attempt = 0; attempt < 8 && !layout; attempt++)
    layout = buildLayout(map, rngFor(mapId, (seed + attempt * 7919) >>> 0));
  if (!layout) layout = buildLayout({ ...map, recipes: [] }, rngFor(mapId, seed));
  cache.set(key, layout);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return layout;
}

export function colliders(layout) {
  let list = layout._col;
  if (list) return list;
  list = layout.boxes.filter((b) => b.wall || b.h >= CFG.stepH);
  layout._col = list;
  return list;
}

export function resolveCircle(layout, x, z, r) {
  const { hw, hd } = layout.bounds;
  let px = Math.max(-hw + r, Math.min(hw - r, x));
  let pz = Math.max(-hd + r, Math.min(hd - r, z));
  for (const b of colliders(layout)) {
    const bw = half(b.w) + r;
    const bd = half(b.d) + r;
    const dx = px - b.x;
    const dz = pz - b.z;
    if (Math.abs(dx) >= bw || Math.abs(dz) >= bd) continue;
    const ox = bw - Math.abs(dx);
    const oz = bd - Math.abs(dz);
    if (ox < oz) px += dx < 0 ? -ox : ox;
    else pz += dz < 0 ? -oz : oz;
  }
  px = Math.max(-hw + r, Math.min(hw - r, px));
  pz = Math.max(-hd + r, Math.min(hd - r, pz));
  return { x: px, z: pz };
}

export function blockedAt(layout, x, z) {
  const { hw, hd } = layout.bounds;
  if (Math.abs(x) > hw - 0.2 || Math.abs(z) > hd - 0.2) return true;
  for (const b of colliders(layout)) {
    if (Math.abs(x - b.x) < half(b.w) + 0.2 && Math.abs(z - b.z) < half(b.d) + 0.2) return true;
  }
  return false;
}

export function segmentClear(layout, x0, z0, x1, z1, pad) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blockedAt(layout, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
  }
  return true;
}
