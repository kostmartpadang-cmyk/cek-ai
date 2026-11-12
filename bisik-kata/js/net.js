const PREFIX = 'bisik-kata-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const JOIN_TIMEOUT = 12000;

export function randomCode() {
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}

export const peerIdOf = (code) => PREFIX + String(code).toUpperCase().trim();

function loadPeer() {
  if (typeof Peer !== 'undefined') return Promise.resolve(Peer);
  return new Promise((resolve, reject) => {
    let tries = 0;
    const poll = () => {
      if (typeof Peer !== 'undefined') return resolve(Peer);
      if (++tries > 80) return reject(new Error('Gagal memuat komponen jaringan. Muat ulang halaman.'));
      setTimeout(poll, 100);
    };
    poll();
  });
}

function friendly(err) {
  const t = (err && err.type) || '';
  if (t === 'peer-unavailable') return 'Kamar tidak ditemukan. Cek kodenya lagi, atau kamarnya sudah ditutup.';
  if (t === 'unavailable-id') return 'Kode sedang dipakai. Buat kamar lagi, ya.';
  if (t === 'browser-incompatible') return 'Browser ini belum mendukung WebRTC. Pakai Chrome, Firefox, Safari, atau Edge terbaru.';
  if (['network', 'server-error', 'socket-error', 'socket-closed', 'invalid-network'].includes(t))
    return 'Tidak bisa menghubungi server pertemuan. Cek koneksi internetmu.';
  return (err && err.message) || 'Koneksi gagal.';
}

export async function hostRoom({ onJoin, onData, onLeave, onError }) {
  const PeerClass = await loadPeer();
  const conns = new Map();

  const openPeer = (code, attempt) =>
    new Promise((resolve, reject) => {
      const peer = new PeerClass(peerIdOf(code));
      peer.on('open', () => resolve({ peer, code }));
      peer.on('error', (err) => {
        try {
          peer.destroy();
        } catch (e) {}
        if (err.type === 'unavailable-id' && attempt < 5) return openPeer(randomCode(), attempt + 1).then(resolve, reject);
        reject(new Error(friendly(err)));
      });
    });

  let opened;
  try {
    opened = await openPeer(randomCode(), 1);
  } catch (err) {
    onError(err);
    throw err;
  }
  const { peer, code } = opened;

  peer.on('disconnected', () => {
    try {
      peer.reconnect();
    } catch (e) {}
  });
  peer.on('connection', (conn) => {
    conns.set(conn.peer, conn);
    conn.on('open', () => onJoin(conn.peer));
    conn.on('data', (data) => onData(conn.peer, data));
    const gone = () => {
      conns.delete(conn.peer);
      onLeave(conn.peer);
    };
    conn.on('close', gone);
    conn.on('error', gone);
  });

  return {
    code,
    self: peer.id,
    send(id, msg) {
      const c = conns.get(id);
      try {
        c && c.send(msg);
      } catch (e) {}
    },
    kill(id) {
      const c = conns.get(id);
      conns.delete(id);
      try {
        c && c.close();
      } catch (e) {}
    },
    close() {
      for (const c of conns.values()) {
        try {
          c.close();
        } catch (e) {}
      }
      try {
        peer.destroy();
      } catch (e) {}
    },
  };
}

export async function joinRoom({ code, onData, onClosed, onError }) {
  const PeerClass = await loadPeer();
  const peer = new PeerClass();
  let settled = false;

  const ready = await new Promise((resolve, reject) => {
    const bail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        peer.destroy();
      } catch (e) {}
      reject(new Error(msg));
    };
    const timer = setTimeout(() => bail('Tidak bisa menyambung dalam 12 detik. Coba lagi.'), JOIN_TIMEOUT);

    peer.on('error', (err) => bail(friendly(err)));
    peer.on('disconnected', () => {
      try {
        peer.reconnect();
      } catch (e) {}
    });
    peer.on('open', () => {
      const conn = peer.connect(peerIdOf(code));
      conn.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(conn);
      });
      conn.on('error', () => bail('Kamar tidak bisa dihubungi.'));
    });
  });

  const handle = {
    self: peer.id,
    send(msg) {
      try {
        ready.send(msg);
      } catch (e) {}
    },
    close() {
      try {
        ready.close();
      } catch (e) {}
      try {
        peer.destroy();
      } catch (e) {}
    },
  };

  ready.on('data', onData);
  ready.on('close', () => {
    try {
      peer.destroy();
    } catch (e) {}
    onClosed();
  });
  ready.on('error', () => {
    try {
      peer.destroy();
    } catch (e) {}
    onClosed();
  });

  return handle;
}
