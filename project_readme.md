# 🎬 CinePulse — Real-Time gRPC Cinema Ticketing System

> **Tugas Proyek Mini: Sistem Terdistribusi Berbasis RPC**  
> Program Studi Informatika — Universitas Siliwangi

---

## 🤖 [AI IDE INSTRUCTIONS]
*   **Untuk Agen AI (Cursor, GitHub Copilot, Windsurf):**
    *   **Arsitektur Repo:** Monorepo sederhana (`/frontend`, `/backend`, `/proto`, `/envoy`, `/scripts`).
    *   **Bahasa Utama:** TypeScript di Frontend dan Backend (Strict Mode enabled).
    *   **Frontend Stack:** React 18 (Vite), Tailwind CSS, `@grpc/grpc-js` / `grpc-web`.
    *   **Backend Stack:** Node.js, `@grpc/grpc-js`, `@grpc/proto-loader`, `mysql2/promise`.
    *   **Database:** MySQL 8.0 dengan *Row-Level Locking* (`SELECT ... FOR UPDATE`).
    *   **Prinsip Utama:** Semua perubahan data status kursi wajib bersifat atomic, bebas dari *race condition*, dan ter-broadcast secara *real-time* via *Server Streaming*.

---

## 📖 Ringkasan Proyek
**CinePulse** adalah aplikasi pemesanan tiket bioskop berbasis sistem terdistribusi yang memanfaatkan **gRPC** untuk komunikasi *real-time* berlatensi rendah. Proyek ini menyelesaikan tantangan *concurrency* saat beberapa *client* mencoba memesan kursi yang sama di milidetik yang sama (*ticket war simulation*), sekaligus menyiarkan status keterisian studio secara *live* ke seluruh pengguna aktif.

---

## 🛠 Tech Stack

| Layer | Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite + TypeScript | Performa cepat, type-safety tinggi, pengkodean komponen UI yang bersih. |
| **Styling** | Tailwind CSS | Pembuatan antarmuka visual grid denah kursi modern tanpa file CSS terpisah. |
| **Backend** | Node.js + TypeScript | Non-blocking I/O yang handal untuk menangani koneksi gRPC terdistribusi. |
| **Engine RPC** | `@grpc/grpc-js` + Protobuf | Komunikasi biner HTTP/2 hemat *bandwidth* dan mendukung *Server Streaming*. |
| **Database** | MySQL 8.0 | Mendukung transaksi ACID dan *Row-Level Locking* (`FOR UPDATE`). |
| **Proxy** | Envoy Proxy | Menjembatani request `grpc-web` (HTTP/1.1) dari *browser* ke gRPC murni (HTTP/2). |
| **DevOps & Test** | Docker Compose + k6 | Menjalankan *multi-container* dan pengujian beban (*load test*) otomatis. |

---

## 👥 Pembagian Tugas & Anggota Kelompok

```
                 +---------------------------------------+
                 |          PROJECT LEAD & REPO          |
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

1. **Muhammad Azharuddiya Syam Ramadhan (Backend & Core gRPC Coder)**
   * Merancang skema kontrak `cinema.proto` (4 RPCs + 1 Streaming).
   * Implements gRPC Server di Node.js/TypeScript.
   * Mengelola transaksi basis data MySQL dengan *Row-Level Locking* (`SELECT ... FOR UPDATE`).

2. **Fajar (Frontend Web & UI/UX Coder)**
   * Membangun antarmuka studio bioskop interaktif (Grid Kursi 5x10) dengan React + Tailwind.
   * Mengintegrasikan `grpc-web` Client untuk pemanggilan `PesanKursi` dan mendengarkan `PantauStatusKursi`.
   * Menangani visualisasi *state* real-time (Tersedia, Terisi, Diproses).

3. **Fasha (DevOps, Infrastructure & Testing Coder)**
   * Menyiapkan `Dockerfile` dan `docker-compose.yml` untuk memutar 2 *container* backend, MySQL, dan Envoy Proxy.
   * Menyusun konfigurasi `envoy.yaml` sebagai jembatan gRPC-Web.
   * Menulis *script* pengujian beban berbasis **k6** untuk mensimulasikan 1, 5, dan 20 *concurrent client*, serta mengekstrak metrik latensi & *throughput*.

---

## 🚀 Panduan Jalankan Proyek

### Prasyarat
* Docker & Docker Compose
* Node.js v18+ & npm

### Langkah 1: Clone & Jalankan Infrastruktur (Docker)
```bash
git clone https://github.com/username/cineseattix-grpc.git
cd cineseattix-grpc
docker-compose up -d mysql envoy
```

### Langkah 2: Jalankan Backend Server
```bash
cd backend
npm install
npm run dev
```

### Langkah 3: Jalankan Frontend Web
```bash
cd frontend
npm install
npm run dev
```
Akses aplikasi di *browser* melalui `http://localhost:5173`.

---

## 📂 Struktur Repositori

```
├── backend/               # Kode Server Node.js + TypeScript (Azhar)
│   ├── src/
│   │   ├── config/        # Koneksi MySQL Database
│   │   ├── services/      # Logika Bisnis & SQL Locking
│   │   └── server.ts      # Main Entry Point gRPC Server
│   └── package.json
├── frontend/              # Kode Client React + TypeScript + Tailwind (Fajar)
│   ├── src/
│   │   ├── components/    # Grid Kursi Bioskop & Modals
│   │   ├── services/      # gRPC-Web Client Wrapper
│   │   └── App.tsx
│   └── package.json
├── proto/                 # Kontrak Protokol Buffer (Azhar & Fajar)
│   └── cinema.proto
├── envoy/                 # Konfigurasi Proxy HTTP/1.1 -> HTTP/2 (Fasha)
│   └── envoy.yaml
├── scripts/               # Script Testing k6 & Benchmark (Fasha)
│   └── load_test.js
├── docker-compose.yml     # Orchestration Multi-Container (Fasha)
├── PRD.md                 # Product Requirements Document
└── SYSTEM_DESIGN.md       # Spesifikasi Arsitektur Sistem
```