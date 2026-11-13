import { segmentClear } from './maps.js';

function canvasOf(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

function makeFloorTexture(THREE, a, b, stud) {
  const s = 128;
  const cv = canvasOf(s);
  const g = cv.getContext('2d');
  g.fillStyle = a;
  g.fillRect(0, 0, s, s);
  g.fillStyle = b;
  g.fillRect(0, 0, s, s / 2);
  g.fillRect(s / 2, s / 2, s / 2, s / 2);
  if (stud) {
    for (const [cx, cy] of [[32, 32], [96, 32], [32, 96], [96, 96]]) {
      g.fillStyle = 'rgba(0,0,0,.13)';
      g.beginPath();
      g.arc(cx, cy + 3, 12, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.beginPath();
      g.arc(cx, cy, 12, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.beginPath();
      g.arc(cx, cy - 3, 8, 0, 7);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(0,0,0,.16)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, s - 2, s - 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlobTexture(THREE) {
  const s = 64;
  const cv = canvasOf(s);
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(0,0,0,.5)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.26)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFaceTexture(THREE) {
  const s = 64;
  const cv = canvasOf(s);
  const g = cv.getContext('2d');
  g.fillStyle = '#221708';
  g.fillRect(16, 21, 7, 10);
  g.fillRect(41, 21, 7, 10);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.fillRect(18, 23, 3, 3);
  g.fillRect(43, 23, 3, 3);
  g.strokeStyle = '#221708';
  g.lineWidth = 3.4;
  g.beginPath();
  g.arc(32, 36, 11, 0.3, Math.PI - 0.3);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSparkTexture(THREE) {
  const s = 32;
  const cv = canvasOf(s);
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,244,200,1)');
  grad.addColorStop(0.45, 'rgba(255,206,92,.75)');
  grad.addColorStop(1, 'rgba(255,180,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SKIN = '#f6d7a8';
const PANTS = '#2f3b4a';

export function createWorld(THREE, canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: (window.devicePixelRatio || 1) < 2,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 300);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const sharedGeo = [];
  const sharedMat = [];
  const sharedTex = [];
  const geo = (g) => (sharedGeo.push(g), g);
  const mtl = (m) => (sharedMat.push(m), m);
  const tex = (t) => (sharedTex.push(t), t);

  const hemi = new THREE.HemisphereLight('#ffffff', '#333333', 0.9);
  const sun = new THREE.DirectionalLight('#ffffff', 0.72);
  sun.position.set(0.6, 1, 0.4);
  const amb = new THREE.AmbientLight('#ffffff', 0.25);
  scene.add(hemi, sun, amb);

  const blobTex = tex(makeBlobTexture(THREE));
  const faceTex = tex(makeFaceTexture(THREE));
  const sparkTex = tex(makeSparkTexture(THREE));
  const blobGeo = geo(new THREE.CircleGeometry(0.95, 14));
  const decalGeo = geo(new THREE.CircleGeometry(0.95, 14).rotateX(-Math.PI / 2));
  const blobMat = mtl(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  const faceGeo = geo(new THREE.PlaneGeometry(0.5, 0.5));
  const faceMat = mtl(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = geo(new THREE.CylinderGeometry(0.5, 0.5, 1, 9));
  const studGeo = geo(new THREE.CylinderGeometry(0.13, 0.13, 0.13, 6));
  const partGeo = {
    leg: geo(new THREE.BoxGeometry(0.26, 0.9, 0.32).translate(0, -0.45, 0)),
    arm: geo(new THREE.BoxGeometry(0.24, 0.9, 0.28).translate(0, -0.45, 0)),
    torso: geo(new THREE.BoxGeometry(0.72, 1.0, 0.42)),
    head: geo(new THREE.BoxGeometry(0.56, 0.56, 0.56)),
    chestBody: geo(new THREE.BoxGeometry(1.5, 0.8, 1)),
    chestLid: geo(new THREE.BoxGeometry(1.5, 0.45, 1)),
    chestLip: geo(new THREE.BoxGeometry(1.56, 0.13, 1.06)),
    lock: geo(new THREE.BoxGeometry(0.26, 0.34, 0.14)),
  };

  const matCache = new Map();
  function paint(hex, emissive) {
    const ck = hex + '|' + (emissive || '');
    let m = matCache.get(ck);
    if (!m) {
      m = mtl(new THREE.MeshLambertMaterial({ color: hex, emissive: emissive || '#000000' }));
      matCache.set(ck, m);
    }
    return m;
  }
  function tint(THREE, hex, k) {
    const c = new THREE.Color(hex);
    if (k >= 0) c.lerp(new THREE.Color('#ffffff'), k);
    else c.multiplyScalar(1 + k);
    return c;
  }

  const camState = { yaw: Math.PI, pitch: 0.4, dist: 9.2 };
  const orbit = { on: false, ang: 0 };
  const camPos = new THREE.Vector3(0, 8, 16);
  const lookAt = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  const avatars = new Map();
  const tmpColor = new THREE.Color();

  let layout = null;
  let chest = null;
  let beam = null;
  let halo = null;
  let lamp = null;
  let sparks = null;
  let studs = null;
  let level = null;
  let decoys = [];
  let levelTex = [];
  let spot = 0;
  let opened = false;
  let treasure = new THREE.Vector3();
  let confetti = null;

  // per-level materials are built outside sharedMat so throwAway() can free them each round
  function throwAway(obj) {
    obj.traverse((o) => {
      // Dulu baris ini melewatkan objek yang dipegang langsung. beam/halo/sparks dipasang sebagai
      // root masing-masing, jadi geometri mereka lolos dan menumpuk satu set per ronde.
      if (o.geometry && !sharedGeo.includes(o.geometry)) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.material && !sharedMat.includes(o.material)) o.material.dispose?.();
    });
  }

  function disposeLevel() {
    for (const o of [level, studs, chest, beam, halo, sparks, lamp, ...decoys])
      if (o) {
        scene.remove(o);
        throwAway(o);
      }
    for (const t of levelTex) t.dispose();
    levelTex = [];
    level = studs = chest = beam = halo = sparks = lamp = null;
    decoys = [];
  }

  function buildLevel(l) {
    const pal = l.palette;
    const map = l.map;
    const boxes = l.boxes;

    const solids = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), boxes.length);
    const walls = boxes.filter((b) => b.wall);
    const trims = new THREE.InstancedMesh(boxGeo, paint(pal.trim), Math.max(1, walls.length));
    let bi = 0;
    for (const b of boxes) {
      if (b.s === 'cyl') continue;
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.rw || b.w, b.h, b.rd || b.d);
      dummy.rotation.set(0, b.rot || 0, 0);
      dummy.updateMatrix();
      solids.setMatrixAt(bi, dummy.matrix);
      solids.setColorAt(bi, tint(THREE, pal[b.c] || '#8a8a8a', b.wall ? 0 : shade(b)));
      bi++;
    }
    solids.count = bi;
    let ti = 0;
    for (const b of walls) {
      dummy.position.set(b.x, b.h + 0.1, b.z);
      dummy.scale.set(b.w * 1.03, 0.2, b.d * 1.03);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trims.setMatrixAt(ti++, dummy.matrix);
    }
    trims.count = ti;
    solids.instanceMatrix.needsUpdate = true;
    trims.instanceMatrix.needsUpdate = true;
    if (solids.instanceColor) solids.instanceColor.needsUpdate = true;

    const grp = new THREE.Group();
    grp.add(solids);
    if (ti > 0) grp.add(trims);

    const cyls = boxes.filter((b) => b.s === 'cyl');
    if (cyls.length) {
      const cm = new THREE.InstancedMesh(cylGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), cyls.length);
      cyls.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.scale.set(b.rw || b.w, b.h, b.rd || b.d);
        dummy.rotation.set(0, b.rot || 0, 0);
        dummy.updateMatrix();
        cm.setMatrixAt(i, dummy.matrix);
        cm.setColorAt(i, tint(THREE, pal[b.c] || '#8a8a8a', shade(b)));
      });
      cm.instanceMatrix.needsUpdate = true;
      if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
      grp.add(cm);
    }

    const caps = buildCaps(l, pal);
    if (caps) grp.add(caps);
    const parts = buildDetails(l, pal);
    if (parts) grp.add(parts);
    const shadeMesh = buildContact(l);
    if (shadeMesh) grp.add(shadeMesh);

    const fw = l.bounds.w + 8;
    const fd = l.bounds.d + 8;
    const floorTex = makeFloorTexture(THREE, pal.floor, pal.floor2, map.kind === 'mainan');
    levelTex.push(floorTex);
    floorTex.repeat.set(fw / 2, fd / 2);
    floorTex.anisotropy = Math.min(4, maxAniso);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 1.2, fd), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.position.y = -0.6;
    grp.add(floor);
    return grp;
  }

  function buildStuds(l) {
    const bricks = l.boxes.filter((b) => b.s === 'brick');
    if (!bricks.length) return null;
    let room = 0;
    for (const b of bricks) room += Math.max(1, Math.round(b.w / 0.8)) * Math.max(1, Math.round(b.d / 0.8));
    const mesh = new THREE.InstancedMesh(studGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), Math.max(1, room));
    let n = 0;
    for (const b of bricks) {
      const nx = Math.max(1, Math.round(b.w / 0.8));
      const nz = Math.max(1, Math.round(b.d / 0.8));
      for (let a = 0; a < nx; a++)
        for (let c = 0; c < nz; c++) {
          if (n >= room) break;
          dummy.position.set(b.x - b.w / 2 + ((a + 0.5) * b.w) / nx, b.h + 0.06, b.z - b.d / 2 + ((c + 0.5) * b.d) / nz);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(n, dummy.matrix);
          mesh.setColorAt(n, tint(THREE, l.palette[b.c] || '#cccccc', 0.16));
          n++;
        }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return n ? mesh : null;
  }

  function shade(b) {
    if (b.wall) return 0;
    const h = (Math.imul(Math.round((b.x + 64) * 16) + 7, 2246822519) ^ Math.imul(Math.round((b.z + 64) * 16) + 11, 3266489917)) >>> 0;
    return ((h % 1000) / 1000) * 0.09 - 0.02;
  }

  // Piring tipis di atas puncak yang terjangkau lompatan: cara termurah menunjukkan "naik ke sini".
  function buildCaps(l, pal) {
    const list = l.boxes.filter((b) => !b.wall && b.k !== 'soft' && b.k !== 'pit' && b.h >= 0.3 && b.h <= 1.3);
    if (!list.length) return null;
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const g = new THREE.Group();
    const fill = (base, items, inset, bright) => {
      const m = new THREE.InstancedMesh(base, mat, items.length);
      items.forEach((b, i) => {
        dummy.position.set(b.x, b.h + 0.03, b.z);
        dummy.scale.set(Math.max(0.25, (b.rw || b.w) - inset), 0.06, Math.max(0.25, (b.rd || b.d) - inset));
        dummy.rotation.set(0, b.rot || 0, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        m.setColorAt(i, tint(THREE, pal[b.c] || '#8a8a8a', shade(b) + bright));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      return m;
    };
    const square = list.filter((b) => b.s !== 'cyl');
    const round = list.filter((b) => b.s === 'cyl');
    if (square.length) g.add(fill(boxGeo, square, 0.36, 0.22));
    if (round.length) g.add(fill(cylGeo, round, 0.3, 0.16));
    return g;
  }

  // Bagian tambahan per arketipe: papan rak, ikatan peti, lingkar tong, kapitel pilar, kepala arca,
  // bibir genangan. Semuanya ditampung dua InstancedMesh (kotak dan silinder) dengan geometri bersama,
  // jadi siluet ruangan berubah jauh sementara draw call cuma bertambah dua.
  function buildDetails(l, pal) {
    const papan = [];
    const bulat = [];
    const kotak = (b, y, sx, sy, sz, k, dx = 0, dz = 0) => papan.push({ b, y, sx, sy, sz, k, dx, dz });
    const bundar = (b, y, sx, sy, sz, k) => bulat.push({ b, y, sx, sy, sz, k });
    for (const b of l.boxes) {
      const rw = b.rw || b.w;
      const rd = b.rd || b.d;
      const h = b.h;
      if (b.wall) continue;
      if (b.k === 'soft' || b.k === 'pit') {
        bundar(b, h + 0.005, rw * 1.1, 0.02, rd * 1.1, b.k === 'pit' ? -0.35 : 0.1);
        continue;
      }
      switch (b.p) {
        case 'shelf': {
          const tingkat = Math.max(2, Math.round(h / 1.6));
          for (let i = 1; i < tingkat; i++) kotak(b, (h * i) / tingkat, rw * 1.05, 0.13, rd * 0.82, 0.2);
          break;
        }
        case 'crate':
          if (h >= 0.9) {
            kotak(b, h * 0.58, rw * 1.05, 0.14, Math.min(0.5, rd * 0.34), -0.2);
            kotak(b, h * 0.58, Math.min(0.5, rw * 0.34), 0.14, rd * 1.05, -0.2);
          }
          break;
        case 'barrel':
          bundar(b, h * 0.26, rw * 1.08, 0.11, rd * 1.08, 0.34);
          bundar(b, h * 0.74, rw * 1.08, 0.11, rd * 1.08, 0.34);
          break;
        case 'pillar':
          if (h >= 2) {
            kotak(b, 0.17, rw * 1.34, 0.34, rd * 1.34, 0.14);
            kotak(b, h - 0.15, rw * 1.28, 0.3, rd * 1.28, 0.14);
          }
          break;
        case 'statue':
          kotak(b, h + 0.26, 0.52, 0.52, 0.52, 0.24);
          break;
        case 'planter':
          kotak(b, h * 0.52, rw * 1.18, 0.18, rd * 1.18, -0.22);
          break;
        // Pagar tanaman: pita lebih terang di puncak plus batang yang lebih gelap di dalam badannya,
        // supaya dia terbaca sebagai "dinding hidup". Semuanya ditengah karena benda ini boleh berputar.
        case 'hedge':
          kotak(b, h - 0.1, rw * 1.06, 0.2, rd * 1.06, 0.16);
          kotak(b, h * 0.42, rw * 0.86, h * 0.84, rd * 0.86, -0.2);
          break;
        // Gerobak bijih: bibir rel di sekeliling bak plus gundukan isinya. Roda sengaja tidak digambar —
        // silindernya cuma berputar pada sumbu Y, jadi roda akan terlihat sebagai piring tergeletak.
        case 'cart':
          kotak(b, h + 0.07, rw * 1.1, 0.14, 0.16, -0.32);
          kotak(b, h + 0.07, 0.16, 0.14, rd * 1.1, -0.32);
          bundar(b, h + 0.12, rw * 0.62, 0.26, rd * 0.62, 0.3);
          break;
        case 'bench':
          kotak(b, h + 0.05, rw * 1.04, 0.14, rd * 1.06, 0.2);
          kotak(b, h * 0.5, rw * 0.9, h * 0.86, rd * 0.6, -0.24);
          break;
        default:
          break;
      }
    }
    const g = new THREE.Group();
    const isi = (base, list) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(base, new THREE.MeshLambertMaterial({ color: '#ffffff' }), list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.b.x + p.dx, p.y, p.b.z + p.dz);
        dummy.scale.set(Math.max(0.1, p.sx), Math.max(0.04, p.sy), Math.max(0.1, p.sz));
        dummy.rotation.set(0, p.b.rot || 0, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        m.setColorAt(i, tint(THREE, pal[p.b.c] || '#8a8a8a', p.k + shade(p.b)));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      g.add(m);
    };
    isi(boxGeo, papan);
    isi(cylGeo, bulat);
    return g.children.length ? g : null;
  }

  // Bayangan kontak: elips gelap di lantai di bawah tiap benda, satu draw call tanpa shadow map.
  function buildContact(l) {
    const list = l.boxes.filter((b) => !b.wall && b.h >= 0.5);
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(decalGeo, blobMat, list.length);
    list.forEach((b, i) => {
      dummy.position.set(b.x, 0.03, b.z);
      dummy.scale.set(((b.rw || b.w) + 0.8) * 0.5, ((b.rd || b.d) + 0.8) * 0.5, 1);
      dummy.rotation.set(0, b.rot || 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  }

  function buildChest(l, at, real) {
    const gold = paint(real ? '#f4c943' : '#8c7a55', real ? '#4a2f00' : '#000000');
    const wood = paint(real ? '#7d5330' : '#5d4a38');
    const g = new THREE.Group();
    const body = new THREE.Mesh(partGeo.chestBody, gold);
    body.position.y = 0.4;
    const lid = new THREE.Group();
    const lidBox = new THREE.Mesh(partGeo.chestLid, gold);
    lidBox.position.y = 0.22;
    const lip = new THREE.Mesh(partGeo.chestLip, wood);
    lip.position.y = 0.44;
    lid.add(lidBox, lip);
    lid.position.set(0, 0.8, -0.5);
    const lock = new THREE.Mesh(partGeo.lock, wood);
    lock.position.set(0, 0.7, 0.51);
    g.add(body, lid, lock);
    g.position.copy(at);
    g.userData.lid = lid;
    return g;
  }

  function buildSparks(at) {
    const n = 64;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = at.x + (Math.random() * 2 - 1) * 1.1;
      arr[i * 3 + 1] = at.y + Math.random() * 2;
      arr[i * 3 + 2] = at.z + (Math.random() * 2 - 1) * 1.1;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const pts = new THREE.Points(
      bg,
      new THREE.PointsMaterial({
        size: 0.4,
        map: sparkTex,
        color: '#ffdf9a',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pts.userData.base = arr.slice(0);
    return pts;
  }

  function loadLayout(l) {
    disposeLevel();
    layout = l;
    const map = l.map;
    scene.background = new THREE.Color(map.sky);
    scene.fog = new THREE.Fog(new THREE.Color(map.sky), map.fog[0], map.fog[1]);
    hemi.color.set(map.hemi[0]);
    hemi.groundColor.set(map.hemi[1]);
    hemi.intensity = map.hemi[2];
    sun.color.set(map.key[0]);
    sun.intensity = map.key[1];

    level = buildLevel(l);
    scene.add(level);
    studs = buildStuds(l);
    if (studs) scene.add(studs);

    treasure = new THREE.Vector3(l.treasure.x, 0, l.treasure.z);
    chest = buildChest(l, treasure, true);
    scene.add(chest);

    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.05, map.wallH * 1.9, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd76b',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.set(treasure.x, map.wallH * 0.95, treasure.z);
    scene.add(beam);

    halo = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.95, 26),
      new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(treasure.x, 0.06, treasure.z);
    scene.add(halo);

    lamp = new THREE.PointLight('#ffcf6b', 0, 18, 2);
    lamp.position.set(treasure.x, 1.7, treasure.z);
    scene.add(lamp);

    sparks = buildSparks(treasure);
    scene.add(sparks);

    for (const d of l.decoys) {
      const c = buildChest(l, new THREE.Vector3(d.x, 0, d.z), false);
      c.rotation.y = Math.random() * Math.PI;
      scene.add(c);
      decoys.push(c);
    }
    spot = 0;
    opened = false;
    camPos.set(0, 8, 16);
  }

  function makeAvatar(color) {
    const g = new THREE.Group();
    const shirt = paint(color || '#e2554b');
    const skin = paint(SKIN);
    const pants = paint(PANTS);
    const legL = new THREE.Mesh(partGeo.leg, pants);
    legL.position.set(-0.19, 0.9, 0);
    const legR = new THREE.Mesh(partGeo.leg, pants);
    legR.position.set(0.19, 0.9, 0);
    const torso = new THREE.Mesh(partGeo.torso, shirt);
    torso.position.y = 1.4;
    const armL = new THREE.Mesh(partGeo.arm, skin);
    armL.position.set(-0.48, 1.87, 0);
    const armR = new THREE.Mesh(partGeo.arm, skin);
    armR.position.set(0.48, 1.87, 0);
    const head = new THREE.Mesh(partGeo.head, skin);
    head.position.y = 2.2;
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.02, 0.285);
    head.add(face);
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.04;
    g.add(legL, legR, torso, armL, armR, head, blob);
    return { group: g, head, torso, armL, armR, legL, legR, blob, phase: Math.random() * 6, px: 0, pz: 0, speed: 0, bob: Math.random() * 6, me: false };
  }

  function upsertAvatar(p) {
    let a = avatars.get(p.id);
    if (!a) {
      a = makeAvatar(p.color);
      a.group.position.set(p.x, p.y || 0, p.z);
      a.px = p.x;
      a.pz = p.z;
      scene.add(a.group);
      avatars.set(p.id, a);
      a.t = { x: p.x, z: p.z, a: p.a, y: p.y || 0 };
    }
    a.me = !!p.me;
    if (p.snap) {
      a.group.position.set(p.x, p.y || 0, p.z);
      a.group.rotation.y = p.a;
      a.px = p.x;
      a.pz = p.z;
    }
    a.t = { x: p.x, z: p.z, a: p.a, y: p.y || 0 };
    a.s = p.s || 0;
    a.jumping = !!p.j;
    a.winner = !!p.winner;
    return a;
  }

  function dropAvatar(id) {
    const a = avatars.get(id);
    if (!a) return;
    scene.remove(a.group);
    avatars.delete(id);
  }

  function clearAvatars() {
    for (const a of avatars.values()) scene.remove(a.group);
    avatars.clear();
  }

  function animate(a, dt, t) {
    const p = a.group.position;
    const moved = Math.hypot(p.x - a.px, p.z - a.pz) / Math.max(dt, 0.001);
    a.speed += (moved - a.speed) * 0.25;
    a.px = p.x;
    a.pz = p.z;
    const amp = Math.max(0, Math.min(1.15, a.speed / 6.2));
    a.phase += dt * (2.4 + a.speed * 1.15);
    const s = Math.sin(a.phase);
    if (a.jumping) {
      a.legL.rotation.x = -0.6;
      a.legR.rotation.x = 0.45;
      a.armL.rotation.x = -2.1;
      a.armR.rotation.x = -2.1;
      a.head.rotation.x = -0.15;
    } else if (amp < 0.07) {
      a.legL.rotation.x *= 0.8;
      a.legR.rotation.x *= 0.8;
      a.armL.rotation.x = Math.sin(t * 1.5 + a.bob) * 0.09;
      a.armR.rotation.x = -a.armL.rotation.x;
      a.head.rotation.x = 0;
      a.head.rotation.y = Math.sin(t * 0.7 + a.bob) * 0.24;
      a.torso.position.y = 1.4 + Math.sin(t * 2 + a.bob) * 0.02;
    } else {
      a.legL.rotation.x = s * 0.92 * amp;
      a.legR.rotation.x = -s * 0.92 * amp;
      a.armL.rotation.x = -s * 0.74 * amp;
      a.armR.rotation.x = s * 0.74 * amp;
      a.torso.position.y = 1.4 + Math.abs(s) * 0.05 * amp;
      a.head.rotation.y *= 0.85;
      a.head.rotation.x = 0;
    }
    const bs = 0.9 + amp * 0.12;
    a.blob.scale.set(bs, bs, bs);
    a.blob.position.y = Math.max(0.04, 0.04 - (p.y || 0) * 0.12);
    a.blob.material = blobMat;
  }

  function camDesired(target, out) {
    const yaw = orbit.on ? camState.yaw + orbit.ang : camState.yaw;
    const cp = Math.cos(camState.pitch);
    out.set(
      target.x + Math.sin(yaw) * cp * camState.dist,
      target.y + Math.sin(camState.pitch) * camState.dist + 1.2,
      target.z + Math.cos(yaw) * cp * camState.dist,
    );
    return out;
  }

  const desired = new THREE.Vector3();

  function render(dt, t, focusId) {
    let fallback = null;
    for (const a of avatars.values()) {
      const tg = a.t;
      if (a.me) {
        a.group.position.set(tg.x, tg.y, tg.z);
        a.group.rotation.y = tg.a;
      } else {
        const k = 1 - Math.exp(-17 * dt);
        a.group.position.x += (tg.x - a.group.position.x) * k;
        a.group.position.z += (tg.z - a.group.position.z) * k;
        a.group.position.y += (tg.y - a.group.position.y) * k;
        let da = tg.a - a.group.rotation.y;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a.group.rotation.y += da * Math.min(1, k * 1.4);
      }
      animate(a, dt, t);
      if (!fallback) fallback = a;
    }

    const f = avatars.get(focusId) || fallback;
    if (f) {
      scratch.set(f.group.position.x, f.group.position.y + 1.4, f.group.position.z);
      lookAt.lerp(scratch, 1 - Math.exp(-12 * dt));
    }
    if (orbit.on) orbit.ang += dt * 0.5;
    camDesired(lookAt, desired);
    let frac = 1;
    if (layout) {
      for (const k of [1, 0.74, 0.54, 0.38, 0.26, 0.18]) {
        const px = lookAt.x + (desired.x - lookAt.x) * k;
        const pz = lookAt.z + (desired.z - lookAt.z) * k;
        frac = k;
        if (segmentClear(layout, lookAt.x, lookAt.z, px, pz, 0.35)) break;
      }
    }
    const ck = 1 - Math.exp(-14 * dt);
    camPos.x += (lookAt.x + (desired.x - lookAt.x) * frac - camPos.x) * ck;
    camPos.y += (Math.max(0.9, lookAt.y + (desired.y - lookAt.y) * frac) - camPos.y) * ck;
    camPos.z += (lookAt.z + (desired.z - lookAt.z) * frac - camPos.z) * ck;
    camera.position.copy(camPos);
    camera.lookAt(lookAt);

    if (chest) {
      chest.position.y = Math.sin(t * 2) * 0.07;
      const lid = chest.userData.lid;
      lid.rotation.x += ((opened ? -1.75 : 0) - lid.rotation.x) * Math.min(1, dt * 5);
      beam.material.opacity = spot * 0.28;
      beam.rotation.y = t * 0.6;
      halo.material.opacity = spot * 0.5;
      halo.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05 * (0.3 + spot));
      lamp.intensity = spot * 2.6;
      const base = sparks.userData.base;
      const arr = sparks.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(t * 1.3 + i) * 0.2;
        arr[i + 1] = ((base[i + 1] + t * 0.9 + i * 0.07) % 2.4) - 0.3;
        arr[i + 2] = base[i + 2] + Math.cos(t * 1.1 + i) * 0.2;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      sparks.material.opacity = 0.15 + spot * 0.8;
    }

    if (confetti) {
      confetti.life -= dt;
      const arr = confetti.points.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        confetti.vel[i + 1] -= 11 * dt;
        arr[i] += confetti.vel[i] * dt;
        arr[i + 1] += confetti.vel[i + 1] * dt;
        arr[i + 2] += confetti.vel[i + 2] * dt;
      }
      confetti.points.geometry.attributes.position.needsUpdate = true;
      confetti.points.material.opacity = Math.max(0, confetti.life / 2.2);
      if (confetti.life <= 0) {
        scene.remove(confetti.points);
        confetti.points.geometry.dispose();
        confetti.points.material.dispose();
        confetti = null;
      }
    }

    renderer.render(scene, camera);
  }

  function burst(at, colors) {
    if (confetti) return;
    const n = 240;
    const arr = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = at.x;
      arr[i * 3 + 1] = at.y + 1;
      arr[i * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4.5;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = 5 + Math.random() * 6;
      vel[i * 3 + 2] = Math.sin(a) * sp;
      tmpColor.set(colors[i % colors.length]);
      col[i * 3] = tmpColor.r;
      col[i * 3 + 1] = tmpColor.g;
      col[i * 3 + 2] = tmpColor.b;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const points = new THREE.Points(
      bg,
      new THREE.PointsMaterial({ size: 0.26, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false }),
    );
    confetti = { points, vel, life: 2.2 };
    scene.add(points);
  }

  function project(x, y, z, w, h) {
    scratch.set(x, y, z).project(camera);
    return { x: (scratch.x * 0.5 + 0.5) * w, y: (-scratch.y * 0.5 + 0.5) * h, vis: scratch.z < 1 };
  }

  function resize(w, h, pr) {
    renderer.setPixelRatio(pr || Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = Math.max(0.45, w / Math.max(1, h));
    camera.updateProjectionMatrix();
  }

  function setQuality(low) {
    if (studs) studs.visible = !low;
    if (sparks) sparks.visible = !low;
  }

  function dispose() {
    disposeLevel();
    clearAvatars();
    if (confetti) {
      scene.remove(confetti.points);
      confetti.points.geometry.dispose();
      confetti.points.material.dispose();
      confetti = null;
    }
    for (const g of sharedGeo) g.dispose();
    for (const m of sharedMat) m.dispose();
    for (const t of sharedTex) t.dispose();
    sharedGeo.length = sharedMat.length = sharedTex.length = 0;
    matCache.clear();
    scene.clear();
    try {
      renderer.dispose();
      renderer.forceContextLoss?.();
    } catch (e) {}
  }

  return {
    scene,
    camera,
    renderer,
    camState,
    orbit,
    avatars,
    loadLayout,
    upsertAvatar,
    dropAvatar,
    clearAvatars,
    render,
    project,
    resize,
    dispose,
    burst,
    setQuality,
    setSpot: (v) => (spot = Math.max(0, Math.min(1, v))),
    openChest: () => (opened = true),
    treasureAt: () => treasure.clone(),
    dbg: () => ({
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      geoms: renderer.info.memory.geometries,
      texs: renderer.info.memory.textures,
      avatars: avatars.size,
    }),
  };
}
