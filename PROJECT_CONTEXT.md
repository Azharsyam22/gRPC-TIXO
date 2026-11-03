# PROJECT CONTEXT — TIXO

> **Real-Time Distributed Cinema Ticketing System via gRPC & gRPC-Web**  
> Program Studi Informatika — Universitas Siliwangi  
> Mata Kuliah: Sistem Terdistribusi Berbasis RPC  
> Dokumen ini adalah acuan konteks menyeluruh (*Single Source of Truth Context*) bagi developer manusia dan agen AI (Cursor, Windsurf, Copilot, Antigravity, Claude Code).

---

## 1. Ringkasan Eksekutif & Latar Belakang

**TIXO** adalah platform reservasi tiket bioskop terdistribusi dengan konkurensi tinggi (*high-concurrency ticket war*) yang mengutamakan latensi rendah dan konsistensi data mutlak. Sistem ini memecahkan tantangan klasik di mana puluhan hingga ribuan klien berusaha memesan kursi yang sama di milidetik yang identik.

### Masalah Utama yang Diselesaikan:
1. **Pencegahan Korupsi Data (*Race Condition / Double-Booking*):**  
   Dua pemesan tidak boleh berhasil memesan kursi yang sama. Masalah ini diselesaikan melalui transaksi ACID MySQL InnoDB dengan kuncian baris eksplisit (`SELECT ... FOR UPDATE`).
2. **Komunikasi Real-Time Hemat Bandwidth:**  
   Menghindari *polling* HTTP berulang dengan memanfaatkan **gRPC Server Streaming** (HTTP/2) untuk menyiarkan status keterisian kursi secara instan ke seluruh browser aktif.
3. **Toleransi Gangguan Jaringan & Duplikasi (*Idempotency*):**  
   Mencegah eksekusi ganda saat klien melakukan *retry* akibat koneksi tidak stabil menggunakan `transaction_id` (UUID v4) dan tabel `idempotency_keys`.

---

## 2. Topologi Arsitektur Sistem (Monorepo)

```
[ Browser Client (React 18 + Vite) ]
               │
               │ HTTP/1.1 (gRPC-Web Protocol)
               ▼
   [ Envoy Reverse Proxy (Port 8080) ]
               │
               │ Native gRPC over HTTP/2 (Port 50051)
               ▼
 [ Node.js gRPC Server (TypeScript Strict) ]
        ├── In-Memory Stream Hub (Broadcast Listener)
        └── Transaction Manager (Row-Level Locking)
               │
               │ MySQL Protocol (Pool Connection Limit: 20)
               ▼
    [ MySQL 8.0 Database (InnoDB Engine - Port 3306) ]
```

### Boundary Direktori & Tanggung Jawab Tim:
* **`/backend`** *(Azhar)*: Node.js, TypeScript (strict mode), `@grpc/grpc-js`, `@grpc/proto-loader`, `mysql2/promise`.
* **`/frontend`** *(Fajar)*: React 18, Vite, TypeScript, Tailwind CSS v4, `grpc-web`, `protobufjs`.
* **`/envoy`** *(Fasha)*: Konfigurasi Envoy Proxy (`envoy.yaml`) untuk translasi gRPC-Web ke Native gRPC.
* **`/database`** *(Bersama)*: DDL skema database dan data seeding awal (`init.sql`).
* **`/proto`** *(Bersama)*: Kontrak antarmuka Protocol Buffers (`tixo.proto`).
* **`/scripts`** *(Fasha)*: Skrip pengujian beban performa k6 (`load_test.js`).

### Standar Port Jaringan:
* **Backend gRPC Server:** `50051`
* **Envoy Reverse Proxy:** `8080`
* **MySQL Database:** `3306`
* **Frontend Web (Vite):** `5173`

---

## 3. Aturan Bisnis & Spesifikasi Fungsional

### 3.1 Tata Letak Kursi Studio
* Setiap jadwal studio memiliki **50 kursi**:
  * Baris: A, B, C, D, E (5 baris)
  * Kolom: 1 sampai 10 (10 kolom)
  * Format ID kursi: `{schedule_id}-{seat_number}` (Contoh: `sch-01-A1`)
* Status Kursi:
  * `AVAILABLE (0)`: Kursi kosong, dapat dipilih.
  * `PENDING (1)`: Kursi sedang dalam proses transaksi.
  * `BOOKED (2)`: Kursi sudah resmi terjual, tidak dapat diklik.

### 3.2 Aturan Tarif Tiket Bioskop
* **Hari Biasa (Senin s/d Jumat):** **Rp 40.000** per tiket.
* **Akhir Pekan (Sabtu & Minggu):** **Rp 45.000** per tiket (+Rp 5.000 surcharge).
* Perhitungan tarif dievaluasi dinamis oleh backend dari kolom `start_time` di database (`DAYOFWEEK`), lalu dikirimkan via gRPC metadata ke frontend.

### 3.3 Pemesanan Banyak Kursi (*Multi-Seat Batch Booking*)
* Klien dapat memilih lebih dari satu kursi sekaligus dalam satu alur pemesanan.
* Rumus total biaya:
  $$\text{Total Bayar} = \text{Jumlah Kursi Dipilih} \times \text{Tarif Tiket Jadwal}$$
* Backend mengunci seluruh kursi yang diminta secara atomic dalam satu transaksi.

### 3.4 Katalog Multi-Film & Jadwal
Sistem memuat 4 film utama dengan 28 jadwal tayang aktif (`sch-01` s/d `sch-28`):
1. **Interstellar: IMAX Special Remaster** (Studio 1 IMAX)
2. **Dune: Part Two: Dolby Atmos Edition** (Studio 2 Dolby Atmos)
3. **Oppenheimer: Director Extended Cut** (Studio 3 Premiere)
4. **Spider-Man: Beyond the Spider-Verse** (Studio 1 IMAX)

### 3.5 Otentikasi Pengguna (Sign In with Google / Gmail)
* Pengguna dapat masuk menggunakan akun Gmail (`email`, `name`, `avatar_url`).
* Data akun disimpan di tabel `users` dan email disematkan pada setiap transaksi pemesanan kursi.

---

## 4. Kontrak Protocol Buffers (`proto/tixo.proto`)

Layanan didefinisikan dalam package `tixo`, service `TixoService`:

```protobuf
syntax = "proto3";

package tixo;

service TixoService {
  // 1. Unary: Mengambil seluruh status kursi + metadata jadwal & tarif
  rpc GetDaftarKursi (GetDaftarKursiRequest) returns (GetDaftarKursiResponse);

  // 2. Unary: Memesan 1 kursi dengan Row-Level Lock
  rpc PesanKursi (PesanKursiRequest) returns (PesanKursiResponse);

  // 3. Unary: Memesan banyak kursi sekaligus (batch booking)
  rpc PesanBanyakKursi (PesanBanyakKursiRequest) returns (PesanBanyakKursiResponse);

  // 4. Server Streaming: Menerima broadcast pembaruan status kursi real-time
  rpc PantauStatusKursi (PantauStatusRequest) returns (stream StatusKursiUpdate);

  // 5. Unary: Membatalkan pesanan tiket (kembali ke status AVAILABLE)
  rpc BatalPesanan (BatalPesananRequest) returns (BatalPesananResponse);

  // 6. Unary: Mengambil katalog seluruh film yang sedang tayang
  rpc GetKatalogFilm (GetKatalogFilmRequest) returns (GetKatalogFilmResponse);

  // 7. Unary: Mengambil daftar seluruh jadwal tayang dan harga
  rpc GetDaftarJadwal (GetDaftarJadwalRequest) returns (GetDaftarJadwalResponse);

  // 8. Unary: Otentikasi dan login akun Google / Gmail
  rpc SignInWithGoogle (GoogleSignInRequest) returns (GoogleSignInResponse);
}
```

---

## 5. Skema Basis Data MySQL (`tixo_db`)

Database menggunakan engine **InnoDB** untuk menjamin transaksi ACID:

1. **`users`**: `id` (PK), `email` (UNIQUE), `name`, `avatar_url`, `google_id`, `created_at`, `updated_at`.
2. **`movies`**: `id` (PK), `title`, `edition`, `genre`, `duration_minutes`, `poster_url`, `synopsis`, `rating`, `default_studio`.
3. **`schedules`**: `id` (PK), `movie_id` (FK), `movie_name`, `studio_name`, `start_time` (DATETIME), `base_price` (INT, default 40000), `created_at`.
4. **`seats`**: `id` (PK), `schedule_id` (FK), `seat_number`, `status` (ENUM: 'AVAILABLE', 'PENDING', 'BOOKED'), `updated_at`.  
   *Composite Unique Index:* `(schedule_id, seat_number)` untuk mencegah duplikasi data kursi per jadwal.
5. **`transactions`**: `id` (PK AUTO_INCREMENT), `transaction_id` (UNIQUE), `seat_id` (FK), `user_id`, `user_email`, `price_paid`, `status`, `created_at`.
6. **`idempotency_keys`**: `key_id` (PK), `request_hash`, `response_payload` (JSON), `created_at`.

---

## 6. Mekanisme Keamanan Konkurensi & Anti-Deadlock

Backend mengimplementasikan tiga pola teknis untuk menjamin integritas data:

1. **Row-Level Locking Eksklusif (`SELECT ... FOR UPDATE`):**  
   Saat pemesanan masuk, server membuka transaksi dan mengunci baris kursi terkait. Klien lain yang mencoba memesan kursi yang sama akan diantrikan oleh InnoDB hingga transaksi selesai (`COMMIT` atau `ROLLBACK`).
2. **Pencegahan Gap-Lock Deadlock:**  
   Pemeriksaan tabel `idempotency_keys` menggunakan pembacaan *non-locking read* biasa (`SELECT` tanpa `FOR UPDATE`). Kuncian eksklusif hanya dikenakan pada baris kursi yang sudah pasti eksis di tabel `seats`.
3. **Deterministic Lock Ordering pada Multi-Seat Booking:**  
   Saat memesan beberapa kursi sekaligus, array nomor kursi diurutkan secara alfabetis (`sort()`) sebelum dieksekusi kuncian barisnya (`ORDER BY seat_number ASC`). Hal ini mencegah terjadinya *circular wait deadlock* antar transaksi batch yang berjalan serempak.
4. **Pencegahan Memory Leak pada Server Streaming:**  
   Objek `ServerWritableStream` didaftarkan pada event listener: `cancelled`, `error`, `close`, dan `finish`. Jika klien menutup browser, listener otomatis dibersihkan dari memori server.

---

## 7. Arsitektur & Spesifikasi Lengkap Frontend Web (/frontend)

Aplikasi frontend TIXO dibangun sebagai Single Page Application (SPA) berbasis web modern yang responsif, menyajikan visual interaktif bioskop dengan latensi streaming *real-time*.

### 7.1 Stack Teknologi & Struktur Direktori
* **Framework:** React 18 + TypeScript (Strict Mode).
* **Build Tool:** Vite 6 (Waktu build produksi ~1 detik).
* **Styling:** Tailwind CSS v4 dengan CSS Custom Variables untuk tema ganda (*Dark Mode* / *Light Mode*).
* **gRPC-Web Driver:** `grpc-web` dan `protobufjs` (kompilasi skema `.proto` dinamis secara in-memory di browser tanpa memerlukan *build-step* compiler C++ protoc terpisah).

Struktur modul frontend (`/frontend/src`):
```
frontend/src/
├── components/
│   ├── HomePromoCarousel.tsx   # Banner promosi dan highlight film terpopuler
│   ├── MovieCarousel.tsx       # Kartu film dengan pencarian judul dan filter
│   ├── TrailerCarousel.tsx     # Cuplikan video trailer film dan modal pemutar
│   ├── SeatMap.tsx             # Denah visual 50 kursi (A1-E10) dengan status interaktif
│   └── ToastViewport.tsx       # Sistem notifikasi non-intrusif aksi sistem
├── services/
│   └── tixoGateway.ts          # Abstraksi gRPC-Web client, codec Protobuf, dan simulasi demo
├── showtimes.ts                # Metadata jadwal, studio, aturan tarif, dan data film
├── types.ts                    # Deklarasi tipe TypeScript antarmuka data
├── styles.css                  # Desain tema, token warna, typography, dan animasi status
├── App.tsx                     # State management utama, navigasi view, dan alur transaksi
└── main.tsx                    # Entry point React DOM
```

### 7.2 Mode Operasi Dual-Engine (`VITE_TIXO_MODE`)
Aplikasi web dirancang dengan dua mode eksekusi yang dapat dikonfigurasi melalui variabel environment:
1. **Mode `grpc-web` (Mode Produksi / Integrasi):**
   * Mengirimkan paket biner gRPC-Web melalui protokol HTTP/1.1 ke Envoy Proxy di port `8080`.
   * Envoy menerjemahkan trafik ke format gRPC Native over HTTP/2 menuju Backend di port `50051`.
   * Seluruh pembacaan status kursi, pemesanan, dan streaming tersinkron langsung ke MySQL InnoDB.
2. **Mode `demo` (Mode Standalone / Fallback Offline):**
   * Berjalan mandiri di browser tanpa ketergantungan pada backend server atau proxy.
   * State kursi dikelola di memori browser dengan simulasi latensi jaringan (150-350 ms).
   * Memudahkan pengujian tata letak UI, presentasi, dan responsivitas antarmuka tanpa menyalakan container database.

### 7.3 Alur Pengguna (User Journey) & Fitur Antarmuka
Aplikasi web memiliki dua tampilan utama (*views*):

#### A. Tampilan Beranda (*Home View*)
1. **Header & Navigation Bar:**
   * Logo identitas brand TIXO (`tixo.`).
   * Tombol *Sign In with Google* / Profil Pengguna aktif.
   * Tombol pengalih tema (*Light / Dark Mode*) yang tersimpan di `localStorage`.
   * Indikator status koneksi streaming gRPC real-time (`Kursi tersinkron`, `Menyambungkan ulang`, `Pratinjau lokal`).
2. **Home Promo Carousel (`HomePromoCarousel.tsx`):**
   * Menampilkan tayangan promosi khusus untuk rilis film unggulan dan studio premium (IMAX & Dolby Atmos).
3. **Katalog & Pencarian Film (`MovieCarousel.tsx`):**
   * Menampilkan 4 film aktif dengan detail poster, edisi, rating usia, genre, dan durasi.
   * Kolom pencarian instan (*instant search filter*) untuk menyaring film berdasarkan judul.
   * Tombol aksi "Pesan Tiket" yang langsung mengarahkan pengguna ke alur pemesanan film tersebut.
4. **Trailer Showcase (`TrailerCarousel.tsx`):**
   * Carousel video trailer resmi dengan pemutar video modal terintegrasi.

#### B. Tampilan Pemesanan Kursi (*Booking View*)
1. **Navigasi Kembali (*Breadcrumb Navigation*):**
   * Tombol "Semua film" untuk kembali ke katalog beranda.
   * Ringkasan banner film aktif (poster, judul, edisi studio, rating usia).
2. **Pemilih Jadwal & Tarif Dinamis (*Schedule & Pricing Selector*):**
   * Pilihan Studio (Studio 1 IMAX, Studio 2 Dolby Atmos, Studio 3 Premiere).
   * Pilihan Tanggal Tayang berbentuk chip tanggal dengan label pintar (`HARI INI`, `BESOK`, atau nama hari).
   * Pilihan Jam Tayang (09.00, 13.00, 16.00, 19.30, 22.00 WIB).
   * **Badge Tarif Tiket Dinamis:** Menampilkan label harga otomatis sesuai tanggal yang dipilih:
     * Senin s/d Jumat: **Rp 40.000 (Senin - Jumat)**
     * Sabtu & Minggu: **Rp 45.000 (Sabtu & Minggu)**
3. **Denah Kursi Bioskop Interaktif (`SeatMap.tsx`):**
   * Visualisasi layar studio (*Cinema Screen Arc*) di bagian depan.
   * Grid 50 kursi bioskop (5 baris A s/d E, 10 kolom 1 s/d 10).
   * Kode Status Visual Kursi:
     * **Tersedia (*Available*):** Abu-abu netral, dapat diklik untuk memilih.
     * **Dipilih (*Selected*):** Warna aksen emas (*gold*), menandakan kursi dalam keranjang pemesanan saat ini.
     * **Diproses (*Pending / In-Flight*):** Warna biru dengan animasi denyut (*pulsing*), menandakan transaksi sedang berlangsung ke server gRPC.
     * **Terisi (*Booked*):** Warna gelap redup (*muted*), tidak dapat diklik.
   * **Multi-Seat Selection:** Pengguna dapat mengeklik beberapa kursi sekaligus untuk dipesan bersamaan.
4. **Panel Ringkasan Reservasi (*Booking Summary Panel*):**
   * Rincian nomor kursi yang sedang dipilih (contoh: A3, A4, B5).
   * Harga satuan tiket dan kalkulasi otomatis total bayar (`jumlah kursi * tarif`).
   * Tombol "Pesan Kursi" yang memicu eksekusi batch booking atomic ke gRPC server.
5. **Modal Autentikasi Google / Gmail:**
   * Dialog login cepat 1-klik (*1-click quick login*) yang menyediakan profil preset pengembang (Azhar, Fajar, Fasha) untuk kemudahan demo pengujian.
   * Opsi input manual untuk email Gmail dan nama pengguna kustom.
   * Profil pengguna yang berhasil login akan disimpan di `localStorage` dan emailnya otomatis disematkan pada setiap transaksi pemesanan tiket untuk keperluan audit data.
6. **Riwayat Transaksi & Pembatalan Tiket (*Recent Bookings & Cancellation*):**
   * Menampilkan daftar tiket yang berhasil dipesan oleh pengguna pada sesi berjalan.
   * Disertai nomor transaksi unik (UUID v4) dan tanggal.
   * Tombol "Batal" yang memanggil RPC `BatalPesanan` untuk mengembalikan kursi ke status `AVAILABLE` secara instan.

### 7.4 Komunikasi Real-Time gRPC-Web di Browser (`tixoGateway.ts`)
1. **Inisialisasi Protobuf Runtime:**  
   File `proto/tixo.proto` diimpor langsung sebagai modul teks mentah via Vite raw import (`?raw`), lalu diparsing oleh `protobufjs.parse()`. Hal ini menghilangkan kebutuhan kompilasi artefak TypeScript terpisah setiap kali skema protobuf diperbarui.
2. **Koneksi Server Streaming (`PantauStatusKursi`):**  
   Saat pengguna membuka denah kursi pada jadwal tertentu, gateway browser membuka koneksi server streaming gRPC-Web. Jika ada pemesan lain (atau proses konkuren lain) yang mengonfirmasi atau membatalkan kursi, backend menyiarkan pesan `StatusKursiUpdate`. Gateway browser menangkap event `data` dan memperbarui status kursi di layar tanpa perlu *refresh* halaman.
3. **Penanganan Konflik Real-Time:**  
   Jika pengguna A sedang menandai kursi B4 di layar, lalu tiba-tiba pengguna B mendahului menyelesaikan pembayaran untuk kursi B4 tersebut, broadcast streaming akan mengubah kursi B4 menjadi `BOOKED`. Sistem secara otomatis menghapus B4 dari daftar pilihan pengguna A dan memunculkan notifikasi toast: *"Kursi baru saja berubah: B4 sedang dipesan orang lain."*

---

## 8. Panduan Menjalankan Proyek Secara Cepat (Quickstart)

### 8.1 Persiapan Awal
Pastikan Node.js v18+ dan MySQL 8.0 (XAMPP atau Docker) sudah terpasang.

### 8.2 Backend Setup & Inisialisasi Database
```bash
cd backend

# 1. Salin konfigurasi environment (default XAMPP: user root, tanpa password)
copy .env.example .env

# 2. Install dependensi
npm install

# 3. Inisialisasi database tixo_db, tabel, dan 1.400 data kursi secara otomatis
npm run db:setup

# 4. Jalankan backend gRPC server di port 50051
npm run dev
```

### 8.3 Uji Simulasi Race Condition Internal (Self-Verification)
```bash
# Di terminal baru, jalankan simulasi 5 klien bersamaan menembak 1 kursi via Promise.all
cd backend
npm run test:concurrency
# Hasil yang valid: 1 SUKSES, 4 DITOLAK AMAN (0% Double Booking)
```

### 8.4 Frontend Web Setup
```bash
cd frontend

# 1. Install dependensi
npm install

# 2. Jalankan development server
npm run dev
# Akses melalui browser di http://localhost:5173
```

---

## 9. Panduan Khusus untuk Agen AI (AI IDE Rules)

Setiap agen AI (Cursor, Windsurf, Copilot, Antigravity, Claude Code) wajib mematuhi ketentuan berikut:

1. **Strict TypeScript:** Jangan gunakan tipe `any`. Gunakan interface yang tersedia di `backend/src/types/tixo.ts` dan `frontend/src/types.ts`.
2. **Jangan Mengubah Logika Locking:** Jangan pernah menyederhanakan `SELECT ... FOR UPDATE` menjadi kueri biasa.
3. **Penyelarasan Skema Database:** Setiap perubahan pada skema SQL wajib diterapkan serempak pada `backend/src/config/schema.sql` dan `database/init.sql`.
4. **Gaya Penulisan Kode:** Gunakan bahasa teknis formal, bersih, dan bebas dari simbol emoji/emoticon pada kode sumber, log konsol, maupun pesan commit git.

