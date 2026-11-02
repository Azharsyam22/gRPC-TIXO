# 🎬 TIXO — Real-Time gRPC Cinema Ticketing System

> **Tugas Proyek Mini: Sistem Terdistribusi Berbasis RPC**  
> Program Studi Informatika — Universitas Siliwangi  
> Status: Active Development | Architecture: Monorepo

---

## 🤖 [AI IDE INSTRUCTIONS]
*   **Untuk Agen AI (Cursor, GitHub Copilot, Windsurf):**
    *   **Arsitektur Repo:** Monorepo terstruktur (`/frontend`, `/backend`, `/proto`, `/database`, `/envoy`, `/scripts`).
    *   **Bahasa Utama:** TypeScript di Frontend dan Backend (Strict Mode enabled).
    *   **Frontend Stack:** React 18 (Vite), Tailwind CSS, `@grpc/grpc-js` / `grpc-web`.
    *   **Backend Stack:** Node.js, `@grpc/grpc-js`, `@grpc/proto-loader`, `mysql2/promise`.
    *   **Database:** MySQL 8.0 dengan *Row-Level Locking* (`SELECT ... FOR UPDATE`).
    *   **Prinsip Utama:** Semua perubahan data status kursi wajib bersifat atomic, bebas dari *race condition*, dan ter-broadcast secara *real-time* via *Server Streaming*.

---

## 📖 Ringkasan Proyek
**TIXO** adalah aplikasi pemesanan tiket bioskop berbasis sistem terdistribusi yang memanfaatkan protokol **gRPC** dan **gRPC-Web** untuk komunikasi berlatensi sangat rendah dan sinkronisasi status secara *real-time*. Proyek ini menyelesaikan tantangan *concurrency* saat puluhan *client* mencoba memesan kursi yang sama di milidetik yang sama (*ticket war simulation*), sekaligus menyiarkan status keterisian studio bioskop secara langsung ke seluruh pengguna yang sedang aktif tanpa me-refresh halaman.

---

## 🛠 Tech Stack

| Layer | Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite + TypeScript | Performa cepat, type-safety tinggi, dan ekosistem komponen UI modern. |
| **Styling** | Tailwind CSS | Pembuatan antarmuka visual grid denah kursi interaktif tanpa CSS terpisah. |
| **Backend** | Node.js + TypeScript | Non-blocking I/O yang handal menangani banyak koneksi streaming gRPC terdistribusi. |
| **Engine RPC** | `@grpc/grpc-js` + Protobuf | Komunikasi biner HTTP/2 hemat *bandwidth* dan mendukung *Server Streaming*. |
| **Database** | MySQL 8.0 (InnoDB) | Mendukung transaksi ACID dan *Row-Level Locking* (`SELECT ... FOR UPDATE`). |
| **Proxy** | Envoy Proxy | Menjembatani request `grpc-web` (HTTP/1.1) dari *browser* ke gRPC murni (HTTP/2). |
| **DevOps & Test** | Docker Compose + k6 | Menjalankan *multi-container* dan pengujian beban (*load test*) otomatis. |

---

## 👥 Pembagian Tugas & Anggota Kelompok

```
                 +---------------------------------------+
                 |              TIXO PROJECT             |
                 +---------------------------------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+        +------------------+        +------------------+
|      FAJAR       |        |      AZHAR       |        |      FASHA       |
|  Frontend Web    |        |  Backend & gRPC  |        | DevOps & Testing |
+------------------+        +------------------+        +------------------+
| - React UI Grid  |        | - Schema .proto  |        | - Docker Setup   |
| - Tailwind Layout|        | - Node gRPC Server|        | - Envoy Proxy    |
| - gRPC-Web Client|        | - MySQL Lock     |        | - k6 Load Test   |
| - Stream Listener|        | - Retry & Dedupe |        | - Metrik & Graf  |
+------------------+        +------------------+        +------------------+
```

1. **Azhar(Backend & Core gRPC Engineer)**
   * Merancang kontrak protobuf `proto/cinema.proto` (4 RPCs + 1 Streaming).
   * Mengembangkan gRPC Server di Node.js / TypeScript.
   * Mengelola transaksi basis data MySQL dengan *Row-Level Locking* (`SELECT ... FOR UPDATE`).
   * Mengimplementasikan *In-Memory Stream Hub* untuk broadcast event secara real-time.

2. **Fajar (Frontend Web & UI/UX Engineer)**
   * Membangun antarmuka studio bioskop interaktif (Grid Kursi 5x10) dengan React + Tailwind CSS.
   * Mengintegrasikan `grpc-web` Client untuk pemanggilan `PesanKursi` dan `BatalPesanan`.
   * Berlangganan ke stream `PantauStatusKursi` untuk pembaruan warna kursi tanpa *reload*.

3. **Fasha (DevOps, Infrastructure & Testing Engineer)**
   * Menyiapkan `Dockerfile` dan `docker-compose.yml` untuk memutar kontainer backend, MySQL, dan Envoy Proxy.
   * Menyusun konfigurasi `envoy.yaml` sebagai jembatan gRPC-Web ke Native gRPC.
   * Menulis *script* pengujian beban berbasis **k6** untuk mensimulasikan 1, 5, dan 20 *concurrent client*, serta mengekstrak metrik latensi & *throughput*.

---

## 📂 Struktur Repositori

```
├── backend/                             # Kode Server Node.js + TypeScript (Azhar)
│   ├── src/
│   │   ├── config/                      # Koneksi MySQL Database Pool
│   │   ├── services/                    # Logika Bisnis, Locking, dan Stream Hub
│   │   └── server.ts                    # Main Entry Point gRPC Server
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── database/                            # Skema & Inisialisasi Database
│   └── init.sql                         # DDL Table seats, idempotency_keys & data 50 kursi
├── frontend/                            # Kode Client React + TypeScript + Tailwind (Fajar)
│   ├── src/
│   │   ├── components/                  # Grid Kursi Bioskop & Modal / Toast
│   │   ├── services/                    # gRPC-Web Client Wrapper
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── proto/                               # Kontrak Protocol Buffers (Azhar)
│   └── cinema.proto
├── envoy/                               # Konfigurasi Proxy HTTP/1.1 -> HTTP/2 (Fasha)
│   └── envoy.yaml
├── scripts/                             # Script Testing k6 & Benchmark (Fasha)
│   └── load_test.js
├── docker-compose.yml                   # Orchestration Multi-Container (Fasha)
├── product_requirements_document.md     # Product Requirements Document
├── project_readme.md                    # Dokumentasi Utama Proyek TIXO
└── system_design_architecture.md        # Spesifikasi Arsitektur Sistem Terdistribusi
```

---

## 🚀 Panduan Menjalankan Proyek

### Prasyarat
* Docker & Docker Compose
* Node.js v18+ & npm
* Git

### Opsi 1: Menjalankan dengan Docker Compose (Full Stack)
```bash
# 1. Clone repositori
git clone https://github.com/Azharsyam22/gRPC-TIXO
cd gRPC-TIXO

# 2. Jalankan infrastruktur & layanan
docker-compose up --build -d
```

### Opsi 2: Menjalankan Secara Lokal (Untuk Development Per Peran)

#### 1. Inisialisasi Database MySQL
Pastikan MySQL 8.0 berjalan dan eksekusi skrip `database/init.sql`.

#### 2. Menjalankan Backend gRPC Server (Azhar)
```bash
cd backend
npm install
npm run dev
# Server gRPC akan berjalan di port 50051
```

#### 3. Menjalankan Envoy Proxy (Fasha)
```bash
# Menggunakan Docker
docker run -d -p 8080:8080 -v $(pwd)/envoy/envoy.yaml:/etc/envoy/envoy.yaml envoyproxy/envoy:v1.28.0
```

#### 4. Menjalankan Frontend Web (Fajar)
```bash
cd frontend
npm install
npm run dev
# Akses aplikasi di browser melalui http://localhost:5173
```

---

## 🧪 Pengujian Konkurensi & Beban (k6)

Untuk menguji apakah sistem aman dari *race condition* saat beberapa pengguna berebut kursi yang sama:
```bash
# Jalankan load test simulasi 20 concurrent clients
k6 run --vus 20 --iterations 20 scripts/load_test.js
```

**Hasil yang diharapkan:** Tepat 1 pemesan berhasil mendapatkan kursi, dan 19 lainnya ditolak secara aman tanpa terjadi *corrupted state* pada database.
