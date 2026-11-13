const PALETTES = {
  gudang: {
    wall: '#6b5335',
    wallDark: '#54402a',
    wood: '#8a6237',
    woodDark: '#6a4a29',
    cask: '#7c5230',
    rope: '#b99a63',
    trim: '#c8963e',
    dust: '#6f5b3f',
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
    rug: '#9c4157',
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
    mossFlat: '#4f6b3c',
    cellar: '#151210',
    trim: '#e6c470',
    floor: '#776c5d',
    floor2: '#6a6052',
  },
  tambang: {
    wall: '#4b4038',
    wallDark: '#3a312b',
    rock: '#5d5348',
    rockLight: '#7b6f61',
    timber: '#8a6a3f',
    ore: '#b9852f',
    coal: '#2e2a28',
    lamp: '#e0c070',
    grit: '#6b5f4f',
    shaft: '#120f0d',
    trim: '#c9a25c',
    floor: '#3f3830',
    floor2: '#332e28',
  },
  kebun: {
    wall: '#6f7a5a',
    wallDark: '#576146',
    hedge: '#3f6b32',
    hedgeDark: '#2f5427',
    soil: '#5a432c',
    stone: '#8f8878',
    stoneLight: '#b3ab98',
    water: '#3d7f8f',
    flower: '#c86a8e',
    mud: '#4a3a26',
    drain: '#1b2a2e',
    trim: '#d8c76a',
    floor: '#5d6b48',
    floor2: '#4f5c3d',
  },
};

export const MAPS = [
  {
    id: 'gudang',
    name: 'Gudang Kuno',
    sub: 'rak kayu, tumpukan peti, tong tua',
    kind: 'gudang',
    size: { w: 80, d: 58 },
    wallH: 10,
    startAt: { x: 0.4, z: 0.02 },
    sky: '#1b1409',
    fog: [19, 86],
    hemi: ['#7d8ea6', '#3a2c1c', 0.85],
    key: ['#ffe1b0', 0.75, 0.7],
    theme: 'gudang',
    partitions: [
      { x: 0.06, z: -0.19, w: 0.02, d: 0.42 },
      { x: -0.2, z: 0.02, w: 0.34, d: 0.02 },
    ],
    recipes: [
      { mode: 'random', n: 7, kinds: [{ s: 'cyl', c: 'dust', w: [5, 8], h: [0.05, 0.09], p: 'dust', k: 'soft' }] },
      {
        mode: 'rows',
        n: 20,
        lane: 'z',
        aisle: 3.6,
        band: 3.2,
        avenue: 5,
        max: 6.2,
        gap: 2.6,
        kinds: [{ s: 'box', c: 'woodDark', w: [1.3, 2.2], d: [3.6, 6.2], h: [3.6, 5.2], p: 'shelf' }],
      },
      {
        mode: 'random',
        n: 40,
        kinds: [
          { s: 'box', c: 'wood', w: [1.7, 3.1], d: [1.7, 3.1], h: [1.5, 3.2], p: 'crate' },
          { s: 'box', c: 'woodDark', w: [1.5, 2.4], d: [1.5, 2.4], h: [1.3, 2.6], p: 'crate' },
          { s: 'box', c: 'wood', w: [0.95, 1.35], d: [0.95, 1.35], h: [0.95, 1.12], p: 'crate' },
        ],
      },
      { mode: 'random', n: 20, kinds: [{ s: 'cyl', c: 'cask', w: [1.2, 1.7], d: [1.2, 1.7], h: [1.7, 2.5], p: 'barrel' }] },
      {
        mode: 'random',
        n: 19,
        kinds: [
          { s: 'box', c: 'rope', w: [2.0, 3.0], d: [1.3, 2.1], h: [0.35, 0.55], p: 'pallet' },
          { s: 'cyl', c: 'rope', w: [0.9, 1.2], d: [0.9, 1.2], h: [0.95, 1.1], p: 'barrel' },
        ],
      },
      // Muatan yang tumpah: tiga sampai tujuh benda serong di satu titik, jadi gudang punya bekas
      // kejadian, bukan sekadar barang yang dirapikan robot.
      {
        mode: 'clump',
        n: 8,
        rad: 2.6,
        spread: 5,
        rot: 0.7,
        kinds: [
          { s: 'box', c: 'wood', w: [1.1, 1.6], d: [1.1, 1.6], h: [0.95, 1.12], p: 'crate' },
          { s: 'box', c: 'woodDark', w: [1.6, 2.4], d: [1.6, 2.4], h: [1.4, 2.4], p: 'crate' },
          { s: 'cyl', c: 'cask', w: [1.2, 1.6], d: [1.2, 1.6], h: [1.7, 2.4], p: 'barrel' },
          { s: 'box', c: 'rope', w: [2.0, 2.8], d: [1.3, 1.8], h: [0.35, 0.5], p: 'pallet' },
        ],
      },
    ],
  },
  {
    id: 'mainan',
    name: 'Ruang Mainan',
    sub: 'balok besar bersol, karpet, tumpukan kotak',
    kind: 'mainan',
    size: { w: 70, d: 68 },
    wallH: 9,
    startAt: { x: 0.0, z: 0.4 },
    sky: '#122436',
    fog: [22, 95],
    hemi: ['#9fd0ff', '#2a4157', 0.95],
    key: ['#ffffff', 0.65, 0.8],
    theme: 'mainan',
    recipes: [
      { mode: 'random', n: 7, kinds: [{ s: 'cyl', c: 'rug', w: [6, 9], h: [0.05, 0.09], p: 'rug', k: 'soft' }] },
      // Kamar bermain: ruang dibagi dua dua kali, tiap dinding internal punya satu pintu selebar
      // 3,2 m supaya graf daunnya terhubung dan flood fill 4 arah tidak pernah buntu.
      { mode: 'rooms', depth: 3, min: [13, 11], door: 3.4, t: 1.2, h: 0.5 },
      // Menara balok melingkar: kolom tertinggi di ruangan, dengan dua pintu masuk berhadapan.
      {
        mode: 'ring',
        n: 14,
        fx: 0.46,
        kinds: [{ s: 'brick', c: 'white', w: [1.3, 1.9], d: [1.3, 1.9], h: [3.2, 4.6], p: 'block' }],
      },
      {
        mode: 'random',
        n: 50,
        kinds: [
          { s: 'brick', c: 'red', w: [1.8, 3.2], d: [1.8, 3.2], h: [1.0, 2.6], p: 'block' },
          { s: 'brick', c: 'blue', w: [1.8, 3.2], d: [1.8, 3.2], h: [1.0, 2.6], p: 'block' },
          { s: 'brick', c: 'green', w: [1.6, 2.6], d: [1.6, 2.6], h: [0.9, 2.2], p: 'block' },
          { s: 'brick', c: 'yellow', w: [1.6, 2.6], d: [1.6, 2.6], h: [0.9, 2.2], p: 'block' },
          { s: 'brick', c: 'white', w: [2.0, 3.4], d: [2.0, 3.4], h: [1.1, 2.8], p: 'block' },
        ],
      },
      {
        mode: 'random',
        n: 20,
        kinds: [
          { s: 'brick', c: 'yellow', w: [0.9, 1.25], d: [0.9, 1.25], h: [0.95, 1.12], p: 'block' },
          { s: 'brick', c: 'red', w: [1.0, 1.4], d: [1.0, 1.4], h: [0.95, 1.1], p: 'block' },
        ],
      },
      { mode: 'random', n: 17, kinds: [{ s: 'brick', c: 'blue', w: [2.8, 4.4], d: [2.2, 3.4], h: [0.3, 0.5], p: 'mat' }] },
      { mode: 'random', n: 14, kinds: [{ s: 'cyl', c: 'red', w: [1.2, 1.6], d: [1.2, 1.6], h: [0.95, 1.12], p: 'block' }] },
      // Menara yang sudah roboh: balok berserakan di satu sudut, sebagian masih setinggi langkah.
      {
        mode: 'clump',
        n: 8,
        rad: 2.8,
        spread: 6,
        rot: 0.9,
        kinds: [
          { s: 'brick', c: 'red', w: [1.1, 1.5], d: [1.1, 1.5], h: [0.95, 1.12], p: 'block' },
          { s: 'brick', c: 'blue', w: [1.4, 2.2], d: [1.4, 2.2], h: [1.4, 2.4], p: 'block' },
          { s: 'brick', c: 'green', w: [1.6, 2.4], d: [1.6, 2.4], h: [0.9, 1.3], p: 'block' },
          { s: 'brick', c: 'white', w: [1.2, 1.8], d: [1.2, 1.8], h: [2.6, 3.6], p: 'block' },
        ],
      },
    ],
  },
  {
    id: 'kuil',
    name: 'Kuil Terbengkalai',
    sub: 'pilar batu, arca, bara api',
    kind: 'kuil',
    size: { w: 74, d: 64 },
    wallH: 12,
    startAt: { x: -0.4, z: 0.0 },
    sky: '#101a16',
    fog: [18, 78],
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
      { mode: 'random', n: 7, kinds: [{ s: 'cyl', c: 'mossFlat', w: [5, 8], h: [0.05, 0.09], p: 'moss', k: 'soft' }] },
      { mode: 'random', n: 5, kinds: [{ s: 'cyl', c: 'cellar', w: [3.2, 4.6], h: [0.06, 0.1], p: 'pit', k: 'pit' }] },
      {
        mode: 'ring',
        n: 22,
        fx: 0.68,
        kinds: [{ s: 'cyl', c: 'stone', w: [1.7, 2.3], d: [1.7, 2.3], h: [5.5, 7.5], p: 'pillar' }],
      },
      { mode: 'random', n: 12, kinds: [{ s: 'box', c: 'stoneLight', w: [1.7, 2.1], d: [3.2, 4.2], h: [1.7, 2.3], p: 'statue' }] },
      { mode: 'random', n: 14, kinds: [{ s: 'box', c: 'moss', w: [1.6, 2.4], d: [1.6, 2.6], h: [2.6, 4.2], p: 'statue' }] },
      {
        mode: 'random',
        n: 27,
        kinds: [
          { s: 'box', c: 'stoneDim', w: [0.7, 1.7], d: [0.7, 1.7], h: [0.5, 1.5], p: 'rubble' },
          { s: 'cyl', c: 'stoneLight', w: [1.0, 1.35], d: [1.0, 1.35], h: [0.95, 1.1], p: 'pillar' },
        ],
      },
      { mode: 'random', n: 10, kinds: [{ s: 'cyl', c: 'bronze', w: [0.9, 1.2], d: [0.9, 1.2], h: [1.3, 1.7], p: 'planter' }] },
      // Runtuhan kolom: satu titik kejadian tempat batu besar dan drum puing bertumpuk serong,
      // sebagian masih bisa dinaiki sehingga atap jebakan punya tangga.
      {
        mode: 'clump',
        n: 8,
        rad: 2.8,
        spread: 6,
        rot: 0.8,
        kinds: [
          { s: 'box', c: 'stoneDim', w: [1.4, 2.2], d: [1.4, 2.2], h: [0.95, 1.12], p: 'rubble' },
          { s: 'cyl', c: 'stoneLight', w: [1.0, 1.35], d: [1.0, 1.35], h: [0.95, 1.1], p: 'pillar' },
          { s: 'box', c: 'stoneDim', w: [0.7, 1.7], d: [0.7, 1.7], h: [0.5, 1.5], p: 'rubble' },
          { s: 'box', c: 'moss', w: [1.6, 2.2], d: [1.6, 2.4], h: [2.4, 3.6], p: 'statue' },
        ],
      },
    ],
  },
  {
    id: 'tambang',
    name: 'Tambang Tua',
    sub: 'terowongan kayu, gerobak bijih, sumur tua',
    kind: 'tambang',
    size: { w: 76, d: 62 },
    wallH: 9,
    startAt: { x: -0.38, z: 0.34 },
    sky: '#0d0a08',
    fog: [17, 82],
    hemi: ['#7d7466', '#241d18', 0.72],
    key: ['#ffd9a0', 0.62, 0.55],
    theme: 'tambang',
    recipes: [
      { mode: 'random', n: 7, kinds: [{ s: 'cyl', c: 'grit', w: [5, 8], h: [0.05, 0.09], p: 'grit', k: 'soft' }] },
      // Sumur tua: lubang adalah satu-satunya cara turun, jadi dia ditaruh dekat jejak terowongan.
      { mode: 'random', n: 5, kinds: [{ s: 'cyl', c: 'shaft', w: [3.0, 4.4], h: [0.06, 0.1], p: 'pit', k: 'pit' }] },
      // Kamar-berdinding rendah: bilik kerja yang hanya bisa dimasuki lewat pintunya.
      { mode: 'rooms', depth: 3, min: [14, 11], door: 3.4, t: 1.2, h: 0.72 },
      // Barisan penyangga: dinding kayu sejajar terowongan, gangnya cukup lebar untuk dua orang.
      {
        mode: 'rows',
        n: 20,
        lane: 'x',
        aisle: 3.8,
        band: 3.4,
        avenue: 5,
        max: 6.4,
        gap: 2.8,
        rot: 0.03,
        kinds: [{ s: 'box', c: 'timber', w: [4.6, 6.4], d: [0.8, 1.1], h: [3.2, 4.6], p: 'shelf' }],
      },
      {
        mode: 'random',
        n: 26,
        kinds: [
          { s: 'box', c: 'rock', w: [1.6, 2.6], d: [1.6, 2.6], h: [1.4, 2.6], p: 'block' },
          { s: 'box', c: 'rockLight', w: [1.3, 2.1], d: [1.3, 2.1], h: [0.9, 1.4], p: 'block' },
        ],
      },
      // Kereta bijih: badan gerobak setinggi pinggang, masih bisa didorong naik ke atasnya.
      {
        mode: 'random',
        n: 14,
        rot: 0.5,
        kinds: [
          { s: 'box', c: 'ore', w: [1.5, 2.1], d: [1.0, 1.4], h: [0.95, 1.12], p: 'cart' },
          { s: 'box', c: 'timber', w: [2.0, 2.8], d: [1.2, 1.8], h: [0.35, 0.5], p: 'pallet' },
        ],
      },
      { mode: 'random', n: 12, kinds: [{ s: 'cyl', c: 'coal', w: [1.1, 1.5], d: [1.1, 1.5], h: [1.6, 2.4], p: 'barrel' }] },
      // Longsor: satu sudut tempat batu, papan, dan kereta bertumpuk serong.
      {
        mode: 'clump',
        n: 8,
        rad: 2.8,
        spread: 6,
        rot: 0.8,
        kinds: [
          { s: 'box', c: 'rock', w: [1.4, 2.2], d: [1.4, 2.2], h: [0.95, 1.12], p: 'block' },
          { s: 'box', c: 'rockLight', w: [0.7, 1.6], d: [0.7, 1.6], h: [0.5, 1.4], p: 'rubble' },
          { s: 'box', c: 'timber', w: [1.8, 2.6], d: [1.0, 1.4], h: [0.35, 0.5], p: 'pallet' },
          { s: 'box', c: 'ore', w: [1.5, 2.0], d: [1.0, 1.4], h: [0.95, 1.12], p: 'cart' },
        ],
      },
    ],
  },
  {
    id: 'kebun',
    name: 'Kebun Raya',
    sub: 'pagar tanaman, kolam, rumah kaca',
    kind: 'kebun',
    size: { w: 68, d: 72 },
    wallH: 7,
    startAt: { x: 0.0, z: -0.4 },
    sky: '#16241a',
    fog: [20, 90],
    hemi: ['#bfe0a8', '#2f3a26', 0.95],
    key: ['#ffffff', 0.72, 0.75],
    theme: 'kebun',
    recipes: [
      { mode: 'random', n: 7, kinds: [{ s: 'cyl', c: 'mud', w: [5, 8], h: [0.05, 0.09], p: 'mud', k: 'soft' }] },
      // Kolam drainase: air yang surut sampai dasar, sama mahal dengan sumur tambang.
      { mode: 'random', n: 5, kinds: [{ s: 'cyl', c: 'drain', w: [3.4, 5.0], h: [0.06, 0.1], p: 'pit', k: 'pit' }] },
      // Labirin pagar: lorong tanaman tinggi yang memotong pandangan, dengan jalan tengah yang lega.
      {
        mode: 'rows',
        n: 24,
        lane: 'z',
        aisle: 4.2,
        band: 3.6,
        avenue: 6,
        max: 9.0,
        gap: 3.0,
        rot: 0.03,
        kinds: [{ s: 'box', c: 'hedge', w: [1.3, 1.9], d: [5.0, 9.0], h: [2.4, 3.4], p: 'hedge' }],
      },
      { mode: 'random', n: 14, kinds: [{ s: 'box', c: 'hedgeDark', w: [1.2, 1.7], d: [1.2, 1.7], h: [1.8, 2.6], p: 'hedge' }] },
      {
        mode: 'ring',
        n: 12,
        fx: 0.4,
        kinds: [{ s: 'box', c: 'stoneLight', w: [1.5, 2.1], d: [1.5, 2.1], h: [0.6, 0.8], p: 'planter' }],
      },
      {
        mode: 'random',
        n: 18,
        kinds: [
          { s: 'cyl', c: 'stone', w: [1.5, 2.2], d: [1.5, 2.2], h: [1.1, 1.9], p: 'planter' },
          { s: 'box', c: 'water', w: [2.4, 3.8], d: [2.4, 3.8], h: [0.4, 0.6], p: 'planter' },
        ],
      },
      {
        mode: 'random',
        n: 14,
        kinds: [
          { s: 'box', c: 'soil', w: [0.95, 1.3], d: [0.95, 1.3], h: [0.95, 1.12], p: 'crate' },
          { s: 'box', c: 'stone', w: [2.2, 3.2], d: [0.7, 1.0], h: [0.5, 0.7], p: 'bench' },
        ],
      },
      // Meja kebun yang terbalik: pot dan bangku batu bertumpuk di satu titik.
      {
        mode: 'clump',
        n: 8,
        rad: 2.6,
        spread: 6,
        rot: 0.9,
        kinds: [
          { s: 'box', c: 'soil', w: [0.95, 1.3], d: [0.95, 1.3], h: [0.95, 1.12], p: 'crate' },
          { s: 'cyl', c: 'flower', w: [1.0, 1.4], d: [1.0, 1.4], h: [1.2, 1.8], p: 'planter' },
          { s: 'box', c: 'stone', w: [2.0, 3.0], d: [0.7, 1.0], h: [0.5, 0.7], p: 'bench' },
          { s: 'box', c: 'hedgeDark', w: [1.2, 1.7], d: [1.2, 1.7], h: [1.6, 2.4], p: 'hedge' },
        ],
      },
    ],
  },
];

export const CFG = {
  playerR: 0.46,
  stepH: 0.9,
  walkSpeed: 6.2,
  runSpeed: 9.2,
  touchRadius: 1.5,
  spotRadius: 14,
  maxPlayers: 8,
  nameMax: 16,
  cell: 1,
  jumpReach: 1.6,
  pitDepth: 0.85,
  slowMul: 0.5,
  pitMul: 0.35,
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
const NO_SOLID = { soft: 1, pit: 1 };

// Dinding dan benda setinggi langkah atau lebih memotong pandangan, perjalanan, dan flood fill.
// Tanah lembek dan lubang sengaja tidak memotong apa pun: keduanya bisa dilewati, hanya mahal.
function blocks(b) {
  return (b.wall || b.h >= CFG.stepH) && !NO_SOLID[b.k];
}
// Puncak yang bisa diinjak: apa pun selain dinding dan zona.
function walkable(b) {
  return !b.wall && !NO_SOLID[b.k];
}

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

function mkBox(x, z, w, d, h, c, s, wall, k, p, rot) {
  const b = { x, z, w, d, h, c, s: s || 'box', wall: !!wall, k: k || '', p: p || '', rot: 0 };
  if (rot) {
    // Tapak tampilan diputar; w/d menjadi pembatasnya, jadi tabrakan persis seperti yang terlihat.
    const co = Math.abs(Math.cos(rot));
    const si = Math.abs(Math.sin(rot));
    b.rw = w;
    b.rd = d;
    b.w = w * co + d * si;
    b.d = w * si + d * co;
    b.rot = rot;
  }
  return b;
}

function pushBox(list, x, z, w, d, h, c, s, wall, k, p, rot) {
  const b = mkBox(x, z, w, d, h, c, s, wall, k, p, rot);
  list.push(b);
  return b;
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
    const cand = mkBox(x, z, w, d, h, pick.c, pick.s, false, pick.k, pick.p, (pick.rot || rec.rot) ? (rng() * 2 - 1) * (pick.rot || rec.rot) : 0);
    if (!freeSpot(boxes, cand, pads, map)) continue;
    boxes.push(cand);
    placed++;
  }
  return placed;
}

/* Satu aturan untuk semua generator: masih di dalam dinding, tidak menabrak benda lain (tanah lembek
   boleh diinjak benda, lubang tidak), dan tidak memakan ruang aman di sekitar titik mulai. */
function freeSpot(boxes, cand, pads, map) {
  const W = map.size.w;
  const D = map.size.d;
  if (Math.abs(cand.x) + half(cand.w) > half(W) - 0.6 || Math.abs(cand.z) + half(cand.d) > half(D) - 0.6) return false;
  for (const b of boxes) {
    // Genangan dan lubang tidak boleh bertumpang tindih: satu sel cuma punya satu nilai zona, jadi
    // yang digambar belakangan akan menghapus yang di depannya. Selain itu benda zona boleh ditumpangi.
    const zona = (v) => v.k === 'soft' || v.k === 'pit';
    if (zona(b) && zona(cand)) {
      if (b.k !== cand.k ? overlaps(cand, b, 0) : overlaps(cand, b, 0.35)) return false;
      continue;
    }
    if (b.k === 'soft' || cand.k === 'soft') continue;
    if (overlaps(cand, b, 0.35)) return false;
  }
  for (const pad of pads)
    if (Math.hypot(cand.x - pad.x, cand.z - pad.z) < pad.r + Math.max(half(cand.w), half(cand.d))) {
      pad.hit = true;
      return false;
    }
  return true;
}

function dimOf(rng, pick) {
  const dim = (r) => r[0] + rng() * (r[1] - r[0]);
  const w = dim(pick.w);
  return { w, d: pick.s === 'cyl' ? w : dim(pick.d || pick.w), h: dim(pick.h) };
}

const pickKind = (rng, kinds) => kinds[Math.floor(rng() * kinds.length) % kinds.length];

/* Lorong rak: baris panjang yang berjarak `aisle` satu sama lain, menyisakan gang `band` di sepanjang
   dinding dan satu avenue bebas di tengah. Bentuknya sengaja membosankan — ini bagian peta yang paling
   sering membuat pemain tersesat kalau salah ukur, jadi yang dikejar adalah keterbacaan ruang. */
function genRows(rng, boxes, map, rec, pads) {
  const W = map.size.w;
  const D = map.size.d;
  const band = rec.band || 2.6;
  const aisle = rec.aisle || 3.4;
  const lajur = rec.lane === 'x' ? 'x' : 'z'; // sumbu tempat lajur-lajur berjajar
  const along = lajur === 'z' ? W : D;
  const across = lajur === 'z' ? D : W;
  let placed = 0;
  for (let lane = 0; lane * (aisle + 2.4) < across - 2 * band - aisle && placed < rec.n; lane++) {
    const c = -half(across) + band + aisle / 2 + lane * (aisle + 2.4);
    if (Math.abs(c) < (rec.avenue || 0) / 2 + 1.2) continue;
    for (let s = -half(along) + band; s < half(along) - band && placed < rec.n; ) {
      const pick = pickKind(rng, rec.kinds);
      const dm = dimOf(rng, pick);
      const len = Math.min(rec.max || 99, lajur === 'z' ? dm.d : dm.w);
      const wid = lajur === 'z' ? dm.w : dm.d;
      const at = s + len / 2;
      const cand =
        lajur === 'z'
          ? mkBox(at, c, len, wid, dm.h, pick.c, pick.s, false, pick.k, pick.p, (rng() * 2 - 1) * (rec.rot || 0.04))
          : mkBox(c, at, wid, len, dm.h, pick.c, pick.s, false, pick.k, pick.p, (rng() * 2 - 1) * (rec.rot || 0.04));
      s += len + 0.5 + rng() * (rec.gap || 2.2);
      if (freeSpot(boxes, cand, pads, map)) {
        boxes.push(cand);
        placed++;
      }
    }
  }
  return placed;
}

/* Colonnade: N unsur pada satu elips dengan jarak busur yang dijamin lebih besar dari lebar benda
   terbesar, lalu dua unsur dihapus sebagai pintu masuk yang saling berhadapan. */
function genRing(rng, boxes, map, rec, pads) {
  const n = rec.n;
  const kinds = rec.kinds;
  let wmax = 0;
  for (const k of kinds) wmax = Math.max(wmax, k.w[1], (k.d || k.w)[1]);
  const rx = Math.min(half(map.size.w) * (rec.fx || 0.62), wmax * n * 0.5 - wmax);
  const rz = Math.min(half(map.size.d) * (rec.fz || rec.fx || 0.62), wmax * n * 0.5 - wmax);
  if (rx < wmax * 1.6 || rz < wmax * 1.6) return 0;
  const cx0 = (rng() * 2 - 1) * (half(map.size.w) * 0.18);
  const cz0 = (rng() * 2 - 1) * (half(map.size.d) * 0.18);
  const spin = rng() * Math.PI;
  const pintu = Math.floor(rng() * 2) * (Math.floor(n / 2) + (Math.floor(n / 2) % 2 ? 1 : 0));
  let placed = 0;
  for (let i = 0; i < n; i++) {
    if (i === pintu || (i + Math.floor(n / 2)) % n === pintu) {
      rng();
      rng();
      continue;
    }
    const a = spin + (i / n) * Math.PI * 2;
    const pick = pickKind(rng, kinds);
    const dm = dimOf(rng, pick);
    const jr = 1 + (rng() * 2 - 1) * 0.06;
    const cand = mkBox(
      cx0 + Math.cos(a) * rx * jr,
      cz0 + Math.sin(a) * rz * jr,
      dm.w,
      dm.d,
      dm.h,
      pick.c,
      pick.s,
      false,
      pick.k,
      pick.p,
      a + Math.PI / 2 + (rng() * 2 - 1) * (rec.rot || 0.05),
    );
    if (freeSpot(boxes, cand, pads, map)) {
      boxes.push(cand);
      placed++;
    }
  }
  return placed;
}

/* Rombongan benda yang ditumpuk serong di satu titik — muatan yang tumpah, puing yang runtuh.
   Bedanya dengan random biasa: di sini benda boleh saling menempel dan bertingkat, jadi tumpukannya
   kelihatan seperti satu kejadian, bukan dua puluh benda yang kebetulan berdekatan. */
function genClump(rng, boxes, map, rec, pads) {
  let placed = 0;
  for (let c = 0; c < rec.n; c++) {
    const ax = (rng() * 2 - 1) * (half(map.size.w) - 6);
    const az = (rng() * 2 - 1) * (half(map.size.d) - 6);
    if (Math.hypot(ax - pads[0].x, az - pads[0].z) < 5) continue;
    const big = 3 + Math.floor(rng() * (rec.spread || 5));
    for (let i = 0; i < big; i++) {
      const pick = pickKind(rng, rec.kinds);
      const dm = dimOf(rng, pick);
      const a = rng() * Math.PI * 2;
      const r = rng() * (rec.rad || 2.2);
      const cand = mkBox(
        ax + Math.cos(a) * r,
        az + Math.sin(a) * r,
        dm.w,
        dm.d,
        dm.h,
        pick.c,
        pick.s,
        false,
        pick.k,
        pick.p,
        a + (rng() * 2 - 1) * (rec.rot || 0.5),
      );
      if (freeSpot(boxes, cand, pads, map)) {
        boxes.push(cand);
        placed++;
      }
    }
  }
  return placed;
}

/* Kamar-kamar berpintu: ruang dibagi dua terus sampai daunnya cukup lega, tiap dinding internal
   diberi satu pintu. Karena graf daun hasil pembagian itu sebuah pohon, menembus setiap dinding
   internal sudah menjamin semuanya terhubung — tidak perlu BFS pintu lagi. Setiap pintu juga
   didaftarkan sebagai pad supaya resep berikutnya tidak menaruh peti di ambangnya. */
function genRooms(rng, boxes, map, rec, pads) {
  const leafMin = rec.min || [12, 10];
  const door = rec.door || 3.2;
  const t = rec.t || 1.1;
  const h = map.wallH * (rec.h || 0.86);
  const leaves = [{ x0: -half(map.size.w), z0: -half(map.size.d), x1: half(map.size.w), z1: half(map.size.d) }];
  const walls = [];
  let pool = leaves;
  for (let depth = 0; depth < (rec.depth || 3); depth++) {
    const next = [];
    for (const lf of pool) {
      const w = lf.x1 - lf.x0;
      const d = lf.z1 - lf.z0;
      const splitZ = w >= d ? rng() < 0.85 : rng() < 0.15;
      const span = splitZ ? d : w;
      const need = (splitZ ? leafMin[1] : leafMin[0]) + door;
      if (span < need * 2) {
        next.push(lf);
        continue;
      }
      const at = (splitZ ? lf.z0 : lf.x0) + need + rng() * (span - 2 * need);
      const a = { ...lf };
      const b = { ...lf };
      if (splitZ) {
        a.z1 = at;
        b.z0 = at;
        walls.push({ axis: 'x', at, a: lf.x0, b: lf.x1 });
      } else {
        a.x1 = at;
        b.x0 = at;
        walls.push({ axis: 'z', at, a: lf.z0, b: lf.z1 });
      }
      next.push(a, b);
    }
    pool = next;
  }
  let placed = 0;
  for (const w of walls) {
    const len = w.b - w.a;
    const doorAt = w.a + door / 2 + 1.4 + rng() * Math.max(0.1, len - door - 2.8);
    const kisi = { x: w.axis === 'x' ? doorAt : w.at, z: w.axis === 'x' ? w.at : doorAt };
    pads.push({ ...kisi, r: door / 2 + CFG.playerR + 0.5 });
    for (const [s0, s1] of [
      [w.a, doorAt - door / 2],
      [doorAt + door / 2, w.b],
    ]) {
      if (s1 - s0 < 0.8) continue;
      const mid = (s0 + s1) / 2;
      const cand = w.axis === 'x' ? mkBox(mid, w.at, s1 - s0, t, h, 'wallDark', 'box', true) : mkBox(w.at, mid, t, s1 - s0, h, 'wallDark', 'box', true);
      if (freeSpot(boxes, cand, pads, map)) {
        boxes.push(cand);
        placed++;
      }
    }
  }
  return placed;
}

const GEN = { random: scatter, lattice: scatter, rows: genRows, ring: genRing, clump: genClump, rooms: genRooms };

function makeGrid(map) {
  const cell = CFG.cell;
  const cols = Math.ceil(map.size.w / cell);
  const rows = Math.ceil(map.size.d / cell);
  return { cell, cols, rows, blocked: new Uint8Array(cols * rows), zone: new Uint8Array(cols * rows) };
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

function fillChannel(g, b, out, pad, v) {
  const x0 = cx(g, b.x - half(b.w) - pad);
  const x1 = cx(g, b.x + half(b.w) + pad);
  const z0 = cz(g, b.z - half(b.d) - pad);
  const z1 = cz(g, b.z + half(b.d) + pad);
  for (let i = Math.max(0, x0); i <= Math.min(g.cols - 1, x1); i++)
    for (let j = Math.max(0, z0); j <= Math.min(g.rows - 1, z1); j++) out[j * g.cols + i] = v;
}

// Zona mengikuti bentuk yang digambar, bukan kotak pembatasnya: genangan maupun lubang harus bundar
// seperti cangkangnya, kalau tidak pemain jatuh di tempat yang tampak lantai biasa.
function fillZone(g, b, v) {
  const hw = half(b.w);
  const hd = half(b.d);
  const x0 = cx(g, b.x - hw);
  const x1 = cx(g, b.x + hw);
  const z0 = cz(g, b.z - hd);
  const z1 = cz(g, b.z + hd);
  for (let i = Math.max(0, x0); i <= Math.min(g.cols - 1, x1); i++)
    for (let j = Math.max(0, z0); j <= Math.min(g.rows - 1, z1); j++) {
      const c = atWorld(g, j * g.cols + i);
      const dalam = b.s === 'cyl' ? Math.hypot(c.x - b.x, c.z - b.z) < hw : Math.abs(c.x - b.x) < hw && Math.abs(c.z - b.z) < hd;
      if (dalam) g.zone[j * g.cols + i] = v;
    }
}

// Dua kanal dari satu jalan: `blocked` untuk yang benar-benar menghentikan langkah, `zone` untuk yang
// hanya menghukum (1 lembek, 2 lubang) supaya bisa dibaca O(1) setiap frame.
function paint(g, boxes) {
  g.blocked.fill(0);
  g.zone.fill(0);
  for (const b of boxes) {
    if (blocks(b)) fillChannel(g, b, g.blocked, CFG.playerR, 1);
    else if (b.k === 'soft') fillZone(g, b, 1);
    else if (b.k === 'pit') fillZone(g, b, 2);
  }
}

function zoneCell(g, x, z) {
  const i = cz(g, z) * g.cols + cx(g, x);
  return i >= 0 && i < g.zone.length ? g.zone[i] : 0;
}

// 0 lantai biasa, 1 tanah lembek (setengah kecepatan), 2 lubang (jatuh + sepersepuluh kecepatan).
export function zoneAt(layout, x, z) {
  return layout.grid ? zoneCell(layout.grid, x, z) : 0;
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
  const seen = reachFrom(g, [seed]);
  return { open: freeReach(g, seen), seen, start: seed };
}

/* Leher kantong: dari sel yang bisa didatangi, lihat sel terblokir di sebelahnya dan hitung benda
   mana yang paling sering menutup jalan. Yang dikorbankan selalu benda, bukan dinding — dan hanya
   kalau ruangan memang tersumbat, jadi layout yang sudah lebar tidak pernah diubah oleh langkah ini. */
function unseal(g, boxes, seen) {
  const score = new Map();
  const tutup = (b, x, z) => Math.abs(x - b.x) < half(b.w) + CFG.playerR && Math.abs(z - b.z) < half(b.d) + CFG.playerR;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    const cix = i % g.cols;
    const riz = Math.floor(i / g.cols);
    const nb = [cix > 0 ? i - 1 : -1, cix < g.cols - 1 ? i + 1 : -1, riz > 0 ? i - g.cols : -1, riz < g.rows - 1 ? i + g.cols : -1];
    for (const n of nb) {
      if (n < 0 || !g.blocked[n]) continue;
      const w = atWorld(g, n);
      for (const b of boxes) {
        if (b.wall || !blocks(b)) continue;
        if (tutup(b, w.x, w.z)) score.set(b, (score.get(b) || 0) + 1);
      }
    }
  }
  let best = null;
  let bs = 0;
  for (const [b, s] of score) if (s > bs || (s === bs && best && half(b.w) * half(b.d) > half(best.w) * half(best.d))) (best = b), (bs = s);
  if (!best) return false;
  boxes.splice(boxes.indexOf(best), 1);
  return true;
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
  for (const p of map.partitions || [])
    pushBox(boxes, p.x * W, p.z * D, Math.max(0.8, p.w * W), Math.max(0.8, p.d * D), map.wallH * 0.86, 'wallDark', 'box', true);

  const g = makeGrid(map);
  paint(g, boxes);
  const rough = openReach(g, { x: map.startAt.x * half(W), z: map.startAt.z * half(D) });
  if (!rough) return null;
  const start = rough.start;

  const pads = [{ x: start.x, z: start.z, r: 3.4 }];
  for (const rec of map.recipes) (GEN[rec.mode] || scatter)(rng, boxes, map, rec, pads);

  paint(g, boxes);
  let pass = openReach(g, start);
  if (!pass) return null;

  // Mulut lubang bukan lantai: neither titik mulai maupun peti boleh berada di dalamnya.
  const measure = (open) => {
    const dry = open.filter((p) => zoneCell(g, p.x, p.z) !== 2);
    const ground = dry.length ? dry : open;
    const spawns = [];
    for (let i = 0; i < CFG.maxPlayers; i++) {
      const ang = (i / CFG.maxPlayers) * Math.PI * 2;
      const anchor = { x: start.x + Math.cos(ang) * 2.6, z: start.z + Math.sin(ang) * 2.6 };
      const p = nearest(ground, anchor.x, anchor.z, spawns, 2.4) || nearest(ground, start.x, start.z, spawns, 2.4);
      if (p) spawns.push({ x: p.x, z: p.z });
    }
    const spots = ground.filter((p) => !nearCircle(boxes, p.x, p.z, CFG.playerR + 0.9));
    let far = 0;
    for (const p of spots) {
      let dmin = Infinity;
      for (const s of spawns) dmin = Math.min(dmin, Math.hypot(p.x - s.x, p.z - s.z));
      p.dmin = dmin;
      if (dmin > far) far = dmin;
    }
    return { spawns, spots, far };
  };

  let ruang = measure(pass.open);
  // Ruang yang cuma bisa didatangi sejauh 8 meter dari spawn bukan peta, itu kantong. Satu-satunya
  // cara hartanya masih jauh adalah lewat di leher yang tersumbat, jadi singkirkan penyumbatnya —
  // selalu benda, dan hanya saat layout ini memang akan gagal, jadi peta yang lapang tidak disentuh.
  for (let k = 0; k < 6 && ruang.far < 18 && ruang.spots.length >= 4; k++) {
    if (!unseal(g, boxes, pass.seen)) break;
    paint(g, boxes);
    pass = openReach(g, start);
    if (!pass) return null;
    ruang = measure(pass.open);
  }

  const { spawns, spots, far } = ruang;
  if (spawns.length < 2) return null;
  if (spots.length < 4) return null;
  const floor = Math.max(18, far * 0.62);
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
      Math.hypot(p.x - treasure.x, p.z - treasure.z) > 12 &&
      Math.hypot(p.x - treasure.x, p.z - treasure.z) < 44 &&
      p.dmin > 9,
  );
  let cursor = treasure;
  for (let k = 0; k < 3; k++) {
    let pick = null;
    let bd = -1;
    for (const p of pool) {
      if (decoys.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 9)) continue;
      if (Math.hypot(p.x - cursor.x, p.z - cursor.z) < 10) continue;
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
    grid: g,
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

function buildSets(layout) {
  if (layout._sol) return;
  layout._sol = layout.boxes.filter(blocks);
  layout._top = layout.boxes.filter(walkable);
}

// Benda yang memotong pandangan, perjalanan, dan flood fill.
export function solids(layout) {
  buildSets(layout);
  return layout._sol;
}

// Pijakan di titik ini: dasar ruangan (lantai, atau dasar lubang), lalu puncak benda tertinggi yang
// menutupinya.
export function supportAt(layout, x, z) {
  buildSets(layout);
  let top = zoneAt(layout, x, z) === 2 ? -CFG.pitDepth : 0;
  for (const b of layout._top) {
    if (b.h <= top) continue;
    if (Math.abs(x - b.x) < half(b.w) - 0.15 && Math.abs(z - b.z) < half(b.d) - 0.15) top = b.h;
  }
  return top;
}

// Titik (x, z) pada ketinggian kaki y yang tertanam di dalam benda lebih tinggi dari satu langkah.
export function insideSolid(layout, x, z, y) {
  const up = y + CFG.stepH;
  for (const b of solids(layout)) {
    if (b.h <= up) continue;
    if (Math.abs(x - b.x) < half(b.w) - 0.2 && Math.abs(z - b.z) < half(b.d) - 0.2) return true;
  }
  return false;
}

// Satu aturan untuk klien dan tuan rumah: yang mendorong kita keluar hanyalah benda yang puncaknya
// di atas jangkauan langkah, jadi permukaan rendah bisa diinjak dan yang tinggi bisa dilompati.
export function resolveFeet(layout, x, z, r, feetY) {
  const up = feetY + CFG.stepH;
  const { hw, hd } = layout.bounds;
  let px = Math.max(-hw + r, Math.min(hw - r, x));
  let pz = Math.max(-hd + r, Math.min(hd - r, z));
  for (const b of solids(layout)) {
    if (b.h <= up) continue;
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
  for (const b of solids(layout)) {
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
