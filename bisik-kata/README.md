# Bisik Kata

Permainan tebak kata multiplayer di browser. Satu orang jadi **pemimpin** (melihat kata rahasia), sisanya **adu cepat menebak** dari petunjuk. Ringan, tanpa install, tanpa akun, tanpa backend.

## Cara main

1. Tekan **Buat Kamar Baru** → dapat kode 4 huruf (contoh `KXMP`).
2. Bagikan lewat tombol **Salin Ajakan** (link otomatis berisi kode) atau sebutkan kodenya.
3. Teman buka halaman yang sama → **Masuk** → isi kode. Butuh minimal 2 orang.
4. Tekan **Mulai Main**. Tiap ronde:
   - Pemimpin melihat kata rahasianya dan mengirim petunjuk (maks 6, tidak boleh mengandung kata rahasia).
   - Pemain lain mengetik tebakan. Yang benar pertama dapat poin; pemimpin juga dapat poin.
   - Waktu 60 detik. Setelah 36 detik, huruf pertama kata dibuka sebagai pengasih.
5. Jumlah ronde = jumlah pemain, jadi semua kebagian jadi pemimpin. Skor tertinggi menang.

### Poin

| Petunjuk terpakai | Poin dasar |
| --- | --- |
| 0 | 100 |
| 1 | 88 |
| 2 | 76 |
| 3 | 64 |
| 4 | 52 |
| 5 | 40 |
| 6 | 30 |

Bonus kecepatan: +15 jika terjawab saat sisa waktu ≥ 40 detik, +8 jika ≥ 20 detik. Penebak mendapat `dasar + bonus`, pemimpin mendapat `dasar` — jadi memberi petunjuk yang pas (tidak terlalu gampang, tidak terlalu sulit) itu yang paling untung.

## Kenapa bisa gratis dan tanpa server

Koneksi antar pemain berjalan **langsung di browser** (WebRTC, peer-to-peer). Yang dibutuhkan hanya:

- **PeerJS** (sudah ikut di repo, `vendor/peerjs.min.js`) untuk "pertemuan awal" — saling tukar alamat. Setelah tersambung, data permainan tidak lewat server kita lagi.
- **Hosting statis** untuk file HTML/JS/CSS. Karena tidak ada build step dan tidak ada API, Vercel Hobby (gratis) lebih dari cukup.

Kode kamar = `bisik-kata-<KODE>` yang dipakai sebagai PeerJS id, jadi teman tidak perlu link panjang: cukup 4 huruf. Tuan rumah adalah satu-satunya pemegang aturan main (skor, waktu, giliran); tamu hanya mengirim niat ("tebak", "beri petunjuk") dan menerima ringkasan kondisi. Kata rahasia hanya dikirim ke pemimpin, jadi tidak bisa dicuri dari data tampilan.

## Jalankan lokal

```bash
cd bisik-kata
npm run dev            # node dev-server.mjs -> http://127.0.0.1:5173
npm test               # 12 test logika permainan
```

Tes multiplayer tanpa teman: buka `http://127.0.0.1:5173`, buat kamar di tab pertama, lalu buka tab kedua (window incognito kalau perlu) dan masuk dengan kode itu. Dua tab = dua pemain.

Jangan buka lewat `file://` — WebRTC dan `localStorage` rewel di protokol itu.

## Deploy ke Vercel (gratis)

**Cara A — dashboard (paling gampang)**

1. Upload folder ini ke repo GitHub (mis. `nama-akun/bisik-kata`).
2. Di [vercel.com/new](https://vercel.com/new), pilih repo itu.
3. Framework Preset: **Other**. Build Command: **kosongkan**. Output Directory: **kosongkan** (atau `.`).
4. Deploy. Selesai — file statis saja, tidak perlu environment variable.

**Cara B — terminal**

```bash
cd bisik-kata
npm i -g vercel     # sekali saja
vercel              # follow wizard, --prod untuk versi produksi
```

Setelah live, bagikan link `https://nama-project.vercel.app/?k=KODE` — tapi ingat kode berubah tiap kali kamar dibuat, jadi lebih praktis share kodenya saja dari dalam game.

## Uji otomatis

```bash
npm test                     # 12 test aturan main (tanpa browser)
npm run dev                  # nyalakan server dulu
node tools/e2e-2-player.mjs  # 2 Chrome headless jadi 2 pemain betulan (WebRTC)
node tools/e2e-3-player.mjs  # 3 pemain: rotasi pemimpin, balapan tebakan, sinkron skor
```

Harness di `tools/` butuh Chrome terinstall (dipanggil lewat `C:\Program Files\Google\Chrome\Application\chrome.exe`; sesuaikan paths kalau di Linux/macOS). File ini hanya untuk pengembangan, tidak ikut ter-deploy.

## Struktur

```
index.html          tampilan & layar (home, lobby, main, hasil)
styles.css          seluruh gaya (mobile-first, tanpa gambar)
js/words.js         ~260 kata rahasia + kategori
js/game.js          aturan main murni: ronde, poin, validasi (tanpa DOM, bisa di-test)
js/net.js           PeerJS: buat kamar (host) & masuk kamar (tamu)
js/app.js           penyambung UI ke logika + jaringan, render, suara
dev-server.mjs      server statis kecil untuk mencoba lokal
tests/game.test.js  test logika (node --test)
tools/e2e-*.mjs        uji end-to-end memakai 2-3 Chrome headless
vendor/peerjs.min.js library PeerJS (diunduh, bukan dari CDN)
vercel.json         header cache & clean URLs
```

## Batasan yang perlu diketahui

- **Hanya untuk 2–8 orang per kamar.** WebRTC star topology, tuan rumah jadi pusat. Kalau tuan rumah menutup tab, kamar bubar.
- Butuh akses keluar ke server signaling PeerJS (`0.peerjs.com`) dan STUN Google untuk negosiasi. Di jaringan kantor/sekolah yang memblokir UDP, koneksi bisa gagal — itu satu-satunya bagian yang tidak bisa kita kendalikan tanpa backend sendiri.
- Skor tidak disimpan. Tutup halaman = progres hilang (sengaja, supaya tidak ada data pengguna).
- Ganti kata? Cukup edit `js/words.js` — tidak ada bagian lain yang perlu diubah.
