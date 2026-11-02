# 📝 Product Requirements Document (PRD) — TIXO

> **Proyek Mini: Sistem Terdistribusi Berbasis RPC**  
> Program Studi Informatika — Universitas Siliwangi  
> Versi: 1.0.0 | Status: Active Development

---

## 1. Pendahuluan & Ikhtisar Proyek

**TIXO** adalah platform pemesanan tiket bioskop terdistribusi *real-time* berbasis **gRPC** dan **gRPC-Web**. Proyek ini dirancang untuk mengatasi permasalahan klasik sistem pemesanan tiket dengan lalu lintas tinggi (*high-concurrency ticket war*), di mana ribuan atau puluhan pengguna berupaya memesan kursi yang sama di milidetik yang identik.

### 1.1 Masalah Utama (Problem Statement)
* **Korupsi Data & Double-Booking (*Race Condition*):** Jika dua atau lebih permintaan pemesanan kursi yang sama dieksekusi secara paralel tanpa mekanisme isolasi transaksi yang ketat, dua pengguna bisa mendapatkan kursi yang sama.
* **Latensi dan Pemborosan Bandwidth:** Polling HTTP tradisional menghabiskan bandwidth jaringan dan meningkatkan latensi server.
* **Kegagalan Jaringan & Duplikasi:** Permintaan yang terputus di tengah jalan dapat menyebabkan pemesanan ganda tanpa sengaja saat pengguna mencoba menekan tombol pesan berulang kali.

### 1.2 Solusi yang Dihadirkan TIXO
* **ACID Transaction & Row-Level Locking (`SELECT ... FOR UPDATE`):** Menjamin konsistensi data level baris pada basis data MySQL InnoDB sehingga hanya 1 transaksi yang dapat mengamankan kursi.
* **gRPC Server Streaming:** Menyebarkan perubahan status kursi secara instan (*real-time broadcast*) ke seluruh pengguna aktif tanpa perlu polling.
* **Idempotency Key Verification:** Mencegah eksekusi ganda atas request yang sama saat terjadi retry/gangguan koneksi.
* **Jembatan Envoy Proxy:** Menerjemahkan protokol gRPC-Web (HTTP/1.1) dari browser ke gRPC murni (HTTP/2) di sisi backend server.

---

## 2. Kebutuhan Pengguna (User Stories & Personas)

### 2.1 Personas
* **Audience / Pembeli Tiket:** Pengguna web yang ingin melihat ketersediaan kursi secara langsung dan mengamankan kursi favorit secepat mungkin.
* **Sistem / Operator Bioskop:** Memastikan tidak ada tiket ganda yang terjual dan audit data pemesanan tersimpan akurat.
* **Penguji / QA Engineer:** Menguji ketahanan sistem di bawah beban konkurensi ekstrem.

### 2.2 User Stories

| ID | Aktor | Kebutuhan (*Action*) | Nilai Manfaat (*Benefit*) |
| :--- | :--- | :--- | :--- |
| **US-01** | Pengunjung | Melihat denah kursi studio bioskop (5x10) secara interaktif dan *live*. | Mengetahui status kursi mana yang kosong, sedang diproses, atau sudah terisi. |
| **US-02** | Pengunjung | Mengklik kursi yang tersedia dan mengajukan pemesanan. | Mengamankan tiket sebelum dipesan oleh pengunjung lain. |
| **US-03** | Pengunjung | Menerima feedback instan berupa pesan sukses atau pemberitahuan bahwa kursi sudah diambil orang lain. | Mengetahui kepastian transaksi tanpa menunggu waktu lama atau reload halaman. |
| **US-04** | Seluruh Klien | Melihat perubahan warna kursi (misal: Hijau ke Merah) secara otomatis saat ada kursi yang laku. | Menghindari pemilihan kursi yang sebenarnya sudah terjual ke pihak lain. |
| **US-05** | Pengunjung | Membatalkan pemesanan kursi yang telah berhasil dipesan (bila diperlukan). | Mengembalikan status kursi menjadi tersedia kembali untuk pengguna lain. |

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### 3.1 Layanan gRPC (RPC Services)
* **FR-01 (GetDaftarKursi):** Server harus dapat menyediakan seluruh daftar kursi studio (50 kursi: Baris A-E, Kolom 1-10) beserta status terkini saat client pertama kali membuka aplikasi.
* **FR-02 (PesanKursi):** Server harus memproses pemesanan kursi secara atomic:
  * Memvalidasi parameter: `studio_id`, `seat_id`, `user_id`, `idempotency_key`.
  * Memeriksa apakah transaksi dengan `idempotency_key` tersebut sudah pernah berhasil dieksekusi.
  * Mengunci baris kursi terkait dengan `SELECT ... FOR UPDATE`.
  * Memverifikasi status kursi (`AVAILABLE`). Jika ya, ubah menjadi `BOOKED` dan simpan `booked_by_user`.
  * Mengembalikan respon status sukses/gagal secara jelas.
* **FR-03 (PantauStatusKursi):** Server menyediakan *stream channel* (Server Streaming) yang terus hidup (*long-lived connection*). Setiap perubahan data kursi langsung disiarkan ke semua listener aktif.
* **FR-04 (BatalPesanan):** Pengguna dapat membatalkan kursi yang sudah dipesan oleh dirinya, mengembalikan status kursi menjadi `AVAILABLE`, dan menyiarkan perubahan ke seluruh listener.

### 3.2 Antarmuka Pengguna (Frontend React)
* **FR-05 (Seat Grid Layout):** Merender tata letak studio bioskop 5 baris x 10 kolom dengan indikator warna yang jelas:
  * 🟢 **AVAILABLE (Hijau):** Kursi bebas, dapat dipilih.
  * 🟡 **PROCESSING (Kuning):** Sedang dalam proses transaksi.
  * 🔴 **BOOKED (Merah):** Sudah terjual, disabled / tidak dapat diklik.
* **FR-06 (Real-Time Reactive UI):** Memanfaatkan client `grpc-web` untuk memantau stream dan mengubah warna tombol kursi secara reaktif tanpa me-refresh halaman browser.
* **FR-07 (Toast Notification & Error Handling):** Menampilkan pesan notifikasi pop-up saat reservasi sukses atau ketika gagal karena *seat contention*.

### 3.3 Penanganan Idempotency & Concurrency
* **FR-08 (Idempotency Guard):** Jika klien mengirim request ulang dengan `idempotency_key` yang sama dalam selang waktu tertentu, server tidak mengeksekusi mutasi ulang melainkan mengembalikan hasil transaksi sebelumnya.
* **FR-09 (Row-Level Locking):** Backend wajib mengeksekusi operasi booking dalam batas transaksi MySQL InnoDB (`START TRANSACTION` -> `SELECT ... FOR UPDATE` -> `COMMIT`/`ROLLBACK`).

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| Kategori | Parameter | Target Spesifikasi |
| :--- | :--- | :--- |
| **Kinerja & Latensi** | P95 Latency pada Single Client | $\le 20\text{ ms}$ |
| **Kinerja di Bawah Beban**| P95 Latency pada 20 Concurrent Clients | $\le 100\text{ ms}$ |
| **Throughput** | Kapasitas RPC Unary | $\ge 150\text{ Requests/detik}$ |
| **Integritas Data** | Double-Booking Error Rate | **0% (Zero Tolerance)** |
| **Availability & Streaming** | Latensi Broadcast Event ke Web | $\le 50\text{ ms}$ setelah commit database |
| **Fault Tolerance** | Deadline / Timeout Klien | 3000 ms dengan max 3x retry exponential backoff |
| **Portabilitas** | Multi-Container Environment | Kompatibel penuh via Docker Compose di sistem operasi Linux & Windows |

---

## 5. Pembagian Tanggung Jawab Tim (RACI Matrix)

| Nama Anggota | Role | Fokus Area Utama |
| :--- | :--- | :--- |
| **Muhammad Azharuddiya Syam Ramadhan** | Backend & gRPC Core Engineer | Perancangan `.proto`, implementasi Node.js gRPC Server, in-memory stream hub, transaksi MySQL `SELECT ... FOR UPDATE`, manajemen koneksi pool, idempotency store. |
| **Fajar** | Frontend Web Engineer | Pembangunan UI React (Vite + Tailwind CSS), grid kursi 5x10, integrasi gRPC-Web client, state management stream listener, penanganan UX error/toast. |
| **Fasha** | DevOps, Infra & QA Engineer | Konfigurasi Envoy Proxy (`envoy.yaml`), kontainerisasi Docker Compose (Backend, MySQL, Envoy), skrip pengujian beban k6, pengukuran latensi & throughput. |

---

## 6. Kriteria Keberhasilan & Penerimaan (Acceptance Criteria)

1. **Kelengkapan RPC:** Terdapat 4 RPC (2 Unary pemesanan/kueri, 1 Server Streaming broadcast, 1 Unary pembatalan) yang didefinisikan secara valid dalam `proto/cinema.proto`.
2. **Uji Konkurensi (Race Condition Proof):** Ketika 20 pengguna virtual (k6 VU) mencoba memesan kursi yang sama di detik yang sama:
   - Tepat **1 pengguna berhasil**.
   - **19 pengguna lainnya ditolak** dengan pesan kesalahan yang informatif.
   - Tidak ada duplikasi record di database MySQL.
3. **Sinkronisasi Multi-Window:** Ketika pemesanan berhasil di Window Browser A, kursi di Window Browser B berubah warna secara otomatis tanpa reload.
4. **Deployability:** Seluruh stack dapat dijalankan dengan perintah terstandar menggunakan `docker-compose up`.
