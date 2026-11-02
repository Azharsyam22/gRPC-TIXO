# TIXO — Team Role & AI Agent Collaboration Guide

> Dokumen panduan resmi peran anggota kelompok, pembagian modul, kontrak sistem, dan instruksi khusus untuk AI Agent (Cursor, Windsurf, GitHub Copilot, Antigravity, Claude Code).
> Setiap AI Agent yang membuka repositori ini wajib membaca dan mengikuti petunjuk pada dokumen ini agar pengembangan tetap selaras, modular, dan bebas konflik.

---

## 1. Arsitektur Repositori & Boundary Modul (Monorepo)

Repositori ini menggunakan arsitektur monorepo modular. Setiap peran bertanggung jawab penuh atas direktorinya masing-masing:

```
├── backend/            --> Hak Akses: AZHAR (Backend & gRPC Core)
├── frontend/           --> Hak Akses: FAJAR (Frontend Web React & UI/UX)
├── envoy/              --> Hak Akses: FASHA (DevOps & Proxy)
├── scripts/            --> Hak Akses: FASHA (k6 Load Testing)
├── database/           --> Bersama (Inisialisasi & Seeding MySQL)
├── proto/              --> Kontrak Tunggal Bersama (Single Source of Truth)
├── docker-compose.yml  --> Hak Akses: FASHA (Multi-Container Orchestration)
└── TEAM_GUIDE.md       --> Panduan ini
```

### Standar Port Jaringan (Wajib Dipatuhi Seluruh Agen AI):
* **Backend gRPC Server:** Port `50051` (Native gRPC HTTP/2)
* **Envoy Reverse Proxy:** Port `8080` (Inbound gRPC-Web HTTP/1.1 -> Forward ke 50051)
* **MySQL Database 8.0:** Port `3306`
* **Frontend Web (Vite):** Port `5173`

---

## 2. Rincian Peran & Tugas Anggota Kelompok

### Peran 1: Muhammad Azharuddiya Syam Ramadhan (Backend & Core gRPC Engineer)
* **Fokus Direktori:** `/backend`, `/proto`, `/database`
* **Tanggung Jawab:**
  1. Menulis dan mengelola kontrak `proto/tixo.proto` (8 RPCs).
  2. Mengembangkan Node.js + TypeScript gRPC Server di port `50051`.
  3. Mengelola transaksi MySQL InnoDB dengan **Row-Level Locking (`SELECT ... FOR UPDATE`)** untuk mencegah *double-booking* saat terjadi perebutan tiket (*race condition*).
  4. Mengelola Server Streaming `PantauStatusKursi` via `streamManager.ts` yang bebas dari *memory leak*.
  5. Menghitung tarif tiket bioskop dinamis:
     - **Hari Biasa (Senin - Jumat):** Rp 40.000 / tiket
     - **Akhir Pekan (Sabtu & Minggu):** Rp 45.000 / tiket (+Rp 5.000)
  6. Menyediakan RPC katalog film (`GetKatalogFilm`), jadwal (`GetDaftarJadwal`), pemesanan batch banyak kursi (`PesanBanyakKursi`), dan autentikasi Gmail (`SignInWithGoogle`).
  7. Menyiapkan `backend/Dockerfile` multi-stage build.
* **Status Modul:** Selesai 100%, teruji aman dari deadlock, lulus uji simulasi konkurensi.

---

### Peran 2: Fajar (Frontend Web & UI/UX Engineer)
* **Fokus Direktori:** `/frontend`
* **Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, `grpc-web`, `protobufjs`.
* **Instruksi Khusus untuk AI Agent Fajar:**
  1. **Koneksi Gateway:**
     - Frontend berkomunikasi via adapter `frontend/src/services/tixoGateway.ts`.
     - URL Envoy Proxy: `http://localhost:8080`.
     - Tetap pertahankan mode fallback demo in-memory saat Envoy belum dinyalakan agar UI tetap interaktif.
  2. **Konsumsi Data Harga & Jadwal:**
     - Jangan pernah melakukan *hardcode* harga tiket di komponen UI.
     - Baca harga dari respon gRPC `ScheduleDetail.ticket_price` (Rp 40.000 pada hari kerja, Rp 45.000 pada akhir pekan).
     - Tampilkan penanda visual "Akhir Pekan (+Rp 5.000)" secara jelas jika `is_weekend === true`.
  3. **Pemesanan Banyak Kursi (Multi-Seat Selection):**
     - Izinkan pengguna memilih lebih dari 1 kursi secara interaktif pada `SeatMap.tsx`.
     - Hitung total harga: $\text{Total Bayar} = \text{Jumlah Kursi} \times \text{Tarif Tiket}$.
     - Gunakan RPC `PesanBanyakKursi` atau `PesanKursi` paralel.
  4. **Katalog Film:**
     - Gunakan data film dari `GetKatalogFilm` (Interstellar, Dune: Part Two, Oppenheimer, Spider-Man).
     - Pastikan perpindahan film otomatis memfilter jadwal tayang dan status kursi yang relevan.
  5. **Autentikasi Akun Gmail:**
     - Hubungkan tombol "Masuk via Gmail" ke RPC `SignInWithGoogle`.
     - Simpan profil user (`email`, `name`, `avatar_url`) ke state aplikasi dan sertakan email pengguna pada setiap request booking kursi.
  6. **Real-Time Streaming:**
     - Dengarkan stream `PantauStatusKursi`. Saat ada notifikasi kursi berubah ke `BOOKED`, ubah warna kursi menjadi merah secara instan tanpa me-refresh halaman browser.

---

### Peran 3: Fasha (DevOps, Infrastructure & Performance Testing Engineer)
* **Fokus Direktori:** `/envoy`, `/scripts`, `docker-compose.yml`
* **Stack:** Docker, Docker Compose, Envoy Proxy v1.28+, k6 load testing tool.
* **Instruksi Khusus untuk AI Agent Fasha:**
  1. **Konfigurasi Envoy Proxy (`envoy/envoy.yaml`):**
     - Wajib mengaktifkan filter `envoy.filters.http.grpc_web` dan `envoy.filters.http.cors`.
     - Buka listener pada port `0.0.0.0:8080`.
     - Forward seluruh gRPC traffic ke upstream cluster `backend:50051` (menggunakan protokol HTTP/2 murni: `explicit_http_config: { http2_protocol_options: {} }`).
     - Header CORS wajib mengizinkan: `content-type`, `x-grpc-web`, `x-user-agent`, `grpc-timeout`.
  2. **Multi-Container Deployment (`docker-compose.yml`):**
     - Layanan 1: `mysql` (Image MySQL 8.0, port 3306, volume persisten, auto-mount skrip `database/init.sql` ke `/docker-entrypoint-initdb.d/init.sql`).
     - Layanan 2: `backend` (Build dari `backend/Dockerfile`, port 50051, depends_on: mysql).
     - Layanan 3: `envoy` (Image `envoyproxy/envoy:v1.28-latest`, port 8080, mount `envoy/envoy.yaml`).
  3. **Pengujian Beban & Konkurensi (`scripts/load_test.js`):**
     - Gunakan library native `k6/net/grpc`.
     - Tembak langsung server backend di `localhost:50051`.
     - **Skenario Uji Wajib:**
       - Skenario A: 1 Klien Virtual (Baseline Latency & Throughput).
       - Skenario B: 5 Klien Virtual menembak kursi yang persis sama di milidetik yang sama.
       - Skenario C: 20 Klien Virtual menembak kursi yang persis sama (Simulasi Ticket War Ekstrem).
     - **Tolok Ukur Keberhasilan:** Tepat 1 klien sukses (`status: OK`), sisa klien ditolak secara aman, konsistensi data basis data = 0% double booking.
  4. **Laporan Metrik:**
     - Ekstrak metrik Latensi Rata-rata (ms), Throughput (RPS), dan Error Rate untuk tabel laporan akhir.

---

## 3. Ringkasan Kontrak gRPC (`proto/tixo.proto`)

Kontrak Protocol Buffers berikut adalah acuan tunggal (*single source of truth*):

| RPC Method | Tipe RPC | Deskripsi Kegunaan |
| :--- | :--- | :--- |
| `GetDaftarKursi` | Unary | Mengambil denah 50 kursi beserta metadata film & tarif tiket (40rb/45rb). |
| `PesanKursi` | Unary | Memesan 1 kursi spesifik dengan proteksi `SELECT ... FOR UPDATE`. |
| `PesanBanyakKursi` | Unary | Memesan banyak kursi sekaligus (batch) dengan kalkulasi total bayar. |
| `PantauStatusKursi` | Server Streaming | Menerima event broadcast perubahan kursi secara real-time via HTTP/2 stream. |
| `BatalPesanan` | Unary | Membatalkan tiket dan mengembalikan status kursi menjadi `AVAILABLE`. |
| `GetKatalogFilm` | Unary | Mengambil daftar seluruh film bioskop yang sedang tayang. |
| `GetDaftarJadwal` | Unary | Mengambil seluruh jadwal tayang dan harga (weekday vs weekend). |
| `SignInWithGoogle` | Unary | Otentikasi dan pendaftaran user menggunakan akun Google / Gmail. |

---

## 4. Aturan Eksekusi untuk Semua AI Agent IDE

1. **Jaga Integritas Transaksi Database:**  
   Jangan pernah menghapus atau menyederhanakan klausa `SELECT ... FOR UPDATE` di backend menjadi `SELECT` biasa. Kuncian tingkat baris ini adalah syarat mutlak anti-race condition pada tugas ini.
2. **Gaya Penulisan Kode & Tone:**  
   Gunakan bahasa teknis formal, rapi, dan strictly-typed (TypeScript tanpa `any`). Jangan menambahkan emoji atau emoticon pada pesan log konsol, commit message, maupun antarmuka produksi.
3. **Penyelarasan Skema Database:**  
   Jika ada penambahan kolom atau data seed baru, selalu sinkronkan kedua file:  
   `backend/src/config/schema.sql` dan `database/init.sql`.
4. **Verifikasi Kompilasi Sebelum Commit:**  
   - Backend: Jalankan `npm run type-check && npm run build` di dalam `/backend`.
   - Frontend: Jalankan `npm run build` di dalam `/frontend`.

