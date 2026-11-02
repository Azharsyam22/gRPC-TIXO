# 📝 Product Requirements Document (PRD) — CinePulse

## 1. Pendahuluan & Tujuan Proyek
Tujuan dari proyek ini adalah membangun aplikasi sistem terdistribusi **CinePulse** (Sistem Reservasi Tiket Bioskop Real-Time) dalam tenggat waktu 1 minggu menggunakan kerangka kerja **gRPC**. Proyek ini bertujuan untuk mendemonstrasikan penanganan konkurensi data yang aman dari korupsi data (*race condition*), toleransi kegagalan (*timeout & retry*), serta sinkronisasi data antar-*client* secara *real-time* via *server streaming*.

---

## 2. Kebutuhan Pengguna (User Stories)

| ID | Peran | Keinginan | Tujuan |
| :--- | :--- | :--- | :--- |
| **US-01** | Pengunjung | Melihat denah kursi bioskop secara *live*. | Mengetahui kursi mana yang masih kosong dan sudah terisi. |
| **US-02** | Pemesan | Memilih 1 atau beberapa kursi dan menekan tombol pesan. | Mengamankan tiket sebelum diambil oleh pengguna lain. |
| **US-03** | Pemesan | Mendapatkan notifikasi instan (Berhasil/Gagal). | Mengetahui kepastian transaksi tanpa menunggu lama. |
| **US-04** | Pengunjung Lain | Melihat warna kursi berubah menjadi merah secara otomatis tanpa *refresh*. | Terhindar dari memilih kursi yang baru saja dibeli orang lain. |

---

## 3. Spesifikasi Fitur Utama

### 3.1 Antarmuka Frontend (Fajar)
*   **Grid Denah Kursi (5x10):**
    *   🟢 **Hijau (Available):** Kursi dapat diklik untuk dipilih.
    *   🟡 **Kuning (Processing):** Kursi sedang dikunci/diproses oleh server.
    *   🔴 **Merah (Booked):** Kursi sudah resmi terjual (non-clickable).
*   **Toast Notification:** Pop-up umpan balik instan saat transaksi sukses atau saat terjadi bentrokan pemesanan.
*   **Real-time Stream Listener:** Langsung memperbarui UI saat menerima *event payload* dari gRPC Server Streaming.

### 3.2 Server Logika & RPC Services (Azhar)
*   **`GetDaftarKursi` (Unary RPC):** Mengembalikan array daftar seluruh kursi beserta status awal saat *client* pertama kali membuka web.
*   **`PesanKursi` (Unary RPC):** 
    *   Menerima `seat_id`, `user_id`, dan `idempotency_key`.
    *   Memulai transaksi MySQL dengan `SELECT ... FOR UPDATE`.
    *   Mengembalikan `SUCCESS` atau `SEAT_ALREADY_BOOKED`.
*   **`PantauStatusKursi` (Server Streaming RPC):**
    *   Menjaga koneksi tetap terbuka (*long-lived HTTP/2 stream*).
    *   Menyiarkan (*broadcast*) setiap ada perubahan status kursi ke seluruh *client* terhubung.
*   **`BatalPesanan` (Unary RPC):**
    *   Fitur pembatalan transaksi dengan mekanisme verifikasi `idempotency_key` agar tidak terjadi pembatalan ganda.

### 3.3 Infrastruktur & Testing (Fasha)
*   **Multi-Container Deployment:** Berjalan minimal pada 2 *container* Docker terpisah (Backend App Node.js & Database MySQL/Proxy Envoy).
*   **Fault Tolerance:**
    *   Setiap request Unary memiliki *client deadline/timeout* maksimal 3000ms.
    *   Klien menerapkan *Exponential Backoff Retry* (maksimal 3 kali) pada *network failure*.
*   **Pengujian Beban (Load Test):**
    *   Pengujian menggunakan skrip k6 dengan skenario 1, 5, dan 20 *concurrent client* menembak kursi yang sama.
    *   Mengukur rata-rata Latensi (ms), *Throughput* (RPS), dan membuktikan **0 Error Double-Booking**.

---

## 4. Kriteria Keberhasilan (Acceptance Criteria)

1. **Kelayakan RPC:** Memiliki minimal 4 RPC pada file `.proto` dengan minimal 1 *Server Streaming*.
2. **Integritas Data (No Race Condition):** Saat 20 client menembak kursi yang sama persis secara bersamaan, **hanya 1 client yang berhasil**, 19 client lainnya menerima pesan error yang sesuai. Data di basis data tetap valid (tidak ada pemesanan ganda).
3. **Kinerja & Laporan:** Menyajikan tabel dan grafik perbandingan kinerja latensi & *throughput* pada laporan akhir.