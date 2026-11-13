# Bisik Kata

Dua permainan multiplayer di browser, satu halaman, tanpa install, tanpa akun, tanpa backend.

- **Bisik Kata** — satu orang jadi **pemimpin** (melihat kata rahasia), sisanya **adu cepat menebak** dari petunjuk.
- **Berburu Harta (3D)** — semua pemburu berlari di ruangan 3D yang sama, saling terlihat, adu cepat menemukan peti emas yang disembunyikan.

## Cara main — Bisik Kata

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

## Cara main — Berburu Harta

Pilih kartu **Berburu Harta** di beranda sebelum membuat kamar. Mode ditentukan tuan rumah; tamu yang masuk otomatis ikut.

1. Semua pemburu masuk ke **ruangan 3D yang sama** dan saling terlihat berlari.
2. Ada **satu peti emas asli** (plus peti palsu). Peti asli baru menyala kelihatan kalau sudah cukup dekat — sisanya pakai tebakan.
3. **Meter panas** (Beku → Membakar) memberitahu seberapa dekat kamu; **sonar** 2 kali per ronde menunjukkan arah selama 3 detik.
4. Yang paling dulu menyentuh peti emas menang ronde itu, sisanya dapat poin peringkat. Waktu 180 detik per ronde.
5. **5 tempat = 5 ronde** (gudang, ruang mainan, kuil, tambang tua, kebun raya), masing-masing dengan tata letak acak. Urutan ronde dimulai dari tempat pilihan tuan rumah lalu berputar, jadi setiap tempat didatangi tepat satu kali. Total poin tertinggi jadi juara.

**Rintangan.** Selain dinding dan peti, lantai punya tiga tingkah: benda setinggi pinggang (≤ 1,1 m) bisa **dilompati lalu diinjak** — berdiri di atasnya akan terlihat temanmu; **tanah lembek** membuat langkah separuh kecepatan; **lubang** menjatuhkanmu 0,85 m dengan langkah yang nyaris tak bergerak, dan satu-satunya jalan keluar adalah melompat. Tinggi dihitung dengan aturan yang sama di browser dan di tuan rumah, jadi dia ikut tersinkron.

Poin per ronde: peringkat 1-8 mendapat `100 / 70 / 50 / 35 / 25 / 18 / 12 / 8`, ditambah bonus kecepatan sampai +30 (`30 × sisa waktu / total waktu`). Tidak menemukan hartanya = 0.

**Kontrol.** HP: sentuh separuh kiri untuk jalan (tekan sampai mentok = lari), geser separuh kanan untuk memutar kamera, tombol Lompat & Sonar di kanan bawah. Laptop: WASD/tombol panah, Shift lari, Spasi lompat, E/F sonar. Untuk kameranya di laptop, **klik layar sekali** — kursor menghilang dan kamera mengikuti gerakan mouse seperti game tembak-tembakan; **Esc** melepas lagi (tanpa klik pun masih bisa: tahan tombol mouse lalu geser).

Karena tuan rumah yang menghitung, **koordinat harta tidak pernah dikirim ke browser tamu** sebelum ada yang menyentuhnya (dijaga tes `tests/harta.test.js`).

## Kenapa bisa gratis dan tanpa server

Koneksi antar pemain berjalan **langsung di browser** (WebRTC, peer-to-peer). Yang dibutuhkan hanya:

- **PeerJS** (sudah ikut di repo, `vendor/peerjs.min.js`) untuk "pertemuan awal" — saling tukar alamat. Setelah tersambung, data permainan tidak lewat server kita lagi.
- **three.js** (juga ikut di repo, `vendor/three.module.min.js`) untuk ruangan 3D Berburu Harta. Render-nya penuh di GPU tiap pemain, tidak ada server gambar.
- **Hosting statis** untuk file HTML/JS/CSS. Karena tidak ada build step dan tidak ada API, Vercel Hobby (gratis) lebih dari cukup.

Kode kamar = `bisik-kata-<KODE>` yang dipakai sebagai PeerJS id, jadi teman tidak perlu link panjang: cukup 4 huruf. Tuan rumah adalah satu-satunya pemegang aturan main (skor, waktu, giliran); tamu hanya mengirim niat ("tebak", "beri petunjuk") dan menerima ringkasan kondisi. Kata rahasia hanya dikirim ke pemimpin, jadi tidak bisa dicuri dari data tampilan. Di Berburu Harta polanya sama: tuan rumah yang memutuskan pemenang, poin, dan jatah sonar — tamu cuma mengirim posisi lari dan klaim "sudah menyentuh".

## Jalankan lokal

```bash
cd bisik-kata
npm run dev            # node dev-server.mjs -> http://127.0.0.1:5173
npm test               # 27 test aturan main (12 Bisik Kata + 15 Berburu Harta)
```

Tes multiplayer tanpa teman: buka `http://127.0.0.1:5173`, buat kamar di tab pertama, lalu buka tab kedua (window incognito kalau perlu) dan masuk dengan kode itu. Dua tab = dua pemain.

Jangan buka lewat `file://` — WebRTC dan `localStorage` rewel di protokol itu.

## Deploy ke Vercel (gratis)

**Cara A — dashboard (paling gampang)**

1. Upload folder ini ke repo GitHub (mis. `nama-akun/bisik-kata`).
2. Di [vercel.com/new](https://vercel.com/new), pilih repo itu.
3. **Root Directory: `bisik-kata`** — kalau folder game berada di root repo, biarkan `./`. Ini langkah yang paling sering terlewat.
4. Framework Preset: **Other**. Build Command: **kosongkan**. Output Directory: **kosongkan** (atau `.`).
5. Deploy. Selesai — file statis saja, tidak perlu environment variable.

**Cara B — terminal**

```bash
cd bisik-kata
npm i -g vercel     # sekali saja
vercel              # follow wizard, --prod untuk versi produksi
```

Setelah live, bagikan link `https://nama-project.vercel.app/?k=KODE` — tapi ingat kode berubah tiap kali kamar dibuat, jadi lebih praktis share kodenya saja dari dalam game.

**Kalau muncul `404 NOT_FOUND` di root tapi game-nya sebenarnya sudah ke-deploy**, artinya Vercel memakai root repo sebagai direktori utama sementara `index.html` game ada di subfolder. Coba akses `https://nama-project.vercel.app/bisik-kata/` — kalau muncul, itu penyebabnya. Dua solusi:

- Set **Root Directory** ke `bisik-kata` di Project Settings → Deployment Options (paling bersih; tapi file lain di luar folder itu jadi tidak ter-serve), atau
- Biarkan apa adanya dan pakai `vercel.json` di root repo yang me-redirect `/` ke subfolder — inilah yang terpasang di repo ini, plus `index.html` root tetap bisa diakses lewat `/peramal.html`.

## Uji otomatis

```bash
npm test                     # 30 test aturan main (tanpa browser)
npm run dev                  # nyalakan server dulu
node tools/e2e-2-player.mjs  # 2 Chrome headless jadi 2 pemain betulan (WebRTC)
node tools/e2e-3-player.mjs  # 3 pemain: rotasi pemimpin, balapan tebakan, sinkron skor
node tools/e2e-harta.mjs     # Berburu Harta: WebGL nyata, 5 ronde rotasi, sonar, klaim, skor, geometri tidak bocor, keluar-masuk kamar
node tools/e2e-touch.mjs     # Berburu Harta di layar sentuh: joystick, putar kamera, tombol lompat/sonar
node tools/e2e-mouse.mjs     # Berburu Harta di layar laptop: klik mengunci kursor, kamera ikut mouse, Esc lepas
node tools/e2e-jump.mjs      # Jalur vertikal: lompat ke atas peti, tinggi tersinkron, turun lagi ke lantai
node tools/e2e-zone.mjs      # Tanah lembek memperlambat + lubang menjebak: cuma lompat yang mengeluarkan
```

Harness di `tools/` butuh Chrome terinstall (dipanggil lewat `C:\Program Files\Google\Chrome\Application\chrome.exe`; sesuaikan lewat variabel `CHROME` kalau di Linux/macOS). File itu hanya dipakai saat develop dan tidak dirujuk halaman game. `e2e-touch.mjs` dan `e2e-mouse.mjs` menyuntik pemain kedua lewat `logic.addPlayer` supaya tidak bergantung pada negosiasi WebRTC.

## Struktur

```
index.html          tampilan & layar (home, lobby, lomba 3D, main, hasil)
styles.css          gaya Bisik Kata (mobile-first, tanpa gambar)
styles-harta.css    gaya Berburu Harta (HUD 3D, joystick, kartu tempat)
js/words.js         ~260 kata rahasia + kategori
js/game.js          aturan Bisik Kata murni: ronde, poin, validasi (tanpa DOM, bisa di-test)
js/harta/logic.js   aturan Berburu Harta murni: fase, klaim, poin, sonar (tanpa DOM, bisa di-test)
js/harta/maps.js    pembangkit tata letak 5 tempat + tabrakan (seed → layout, selalu bisa dijangkau)
js/harta/world.js   three.js: ruangan, peti, avatar, partikel, kamera
js/harta/controls.js keyboard/mouse + joystick sentuh dua jari
js/harta/harta.js   penyambung dunia 3D ke state & jaringan (HUD, render loop, sinkron posisi)
js/net.js           PeerJS: buat kamar (host) & masuk kamar (tamu)
js/app.js           penyambung UI ke logika + jaringan, render, suara
dev-server.mjs      server statis kecil untuk mencoba lokal
tests/game.test.js  test logika Bisik Kata (node --test)
tests/harta.test.js test logika Berburu Harta (node --test)
tools/e2e-*.mjs     uji end-to-end memakai Chrome headless (2/3 pemain, harta, sentuh, mouse)
vendor/peerjs.min.js library PeerJS (diunduh, bukan dari CDN)
vendor/three.module.min.js library three.js (diunduh, bukan dari CDN)
vercel.json         header cache & clean URLs
```

## Batasan yang perlu diketahui

- **Hanya untuk 2–8 orang per kamar.** WebRTC star topology, tuan rumah jadi pusat. Kalau tuan rumah menutup tab, kamar bubar.
- Butuh akses keluar ke server signaling PeerJS (`0.peerjs.com`) dan STUN Google untuk negosiasi. Di jaringan kantor/sekolah yang memblokir UDP, koneksi bisa gagal — itu satu-satunya bagian yang tidak bisa kita kendalikan tanpa backend sendiri. Server publik itu pernah rewel saat dipakai membuat banyak kamar berturut-turut; kodenya sudah mencoba ulang otomatis, tapi kalau gagal terus bikin kamar baru lagi sebentar kemudian.
- **Berburu Harta butuh WebGL.** Tanpa itu muncul peringatan dan Bisik Kata tetap bisa dimainkan. Kalau FPS jatuh di bawah 40 (HP tua / tanpa akselerasi hardware), resolusi dalam game otomatis diturunkan.
- Lalu lintas Berburu Harta: tiap pemburu mengirim posisinya 12 kali per detik, tuan rumah menyiarkan ringkasan keadaan minimal ~1,4 kali per detik (bertambah saat ada klaim/sonar). Semua berupa angka pendek, tetap ringan.
- Skor tidak disimpan. Tutup halaman = progres hilang (sengaja, supaya tidak ada data pengguna).
- Ganti kata? Cukup edit `js/words.js` — tidak ada bagian lain yang perlu diubah. Ganti tata letak ruangan? `js/harta/maps.js`.
