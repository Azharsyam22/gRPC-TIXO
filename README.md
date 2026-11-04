# TIXO

TIXO adalah sistem pemesanan tiket bioskop real-time yang dibangun sebagai aplikasi terdistribusi berbasis RPC.

```text
Frontend React
      | gRPC-Web melalui HTTP/1.1
      v
Envoy Proxy :8080
      | gRPC native melalui HTTP/2
      v
Backend Node.js :50051
      |
      v
MySQL 8.0 :3306
```

Sistem ini mendemonstrasikan komunikasi gRPC-Web dari browser, pemesanan kursi secara atomic, pembaruan status kursi secara real-time, serta pengujian perebutan kursi menggunakan k6.

## Status proyek

Fitur utama sudah divalidasi secara lokal:

- Docker Compose berhasil menjalankan MySQL, backend, dan Envoy.
- Frontend berhasil mengambil katalog, jadwal, harga, dan status kursi melalui Envoy.
- Booking dari frontend tersimpan ke MySQL dan berubah menjadi `BOOKED` pada client lain.
- k6 menampilkan latency, throughput, application rejection rate, dan gRPC error rate.
- Setiap skenario ticket war menghasilkan tepat satu booking berhasil untuk kursi yang diperebutkan.
- Build production frontend dan backend berhasil.

RPC `SignInWithGoogle` saat ini memiliki alur pembuatan atau pembaruan profil pengguna berdasarkan data login yang diterima. Verifikasi token OAuth Google asli masih menjadi pekerjaan lanjutan di bagian backend.

## Pembagian tugas

| Anggota | Bagian | Direktori utama |
| --- | --- | --- |
| Fajar | Frontend React dan client gRPC-Web | `frontend/` |
| Azhar | Backend, database, dan kontrak protobuf | `backend/`, `database/`, `proto/` |
| Fasha | Docker, Envoy, dan pengujian performa | `docker-compose.yml`, `envoy/`, `scripts/` |

Kontrak bersama berada di [proto/tixo.proto](./proto/tixo.proto). Kontrak tersebut mendefinisikan delapan RPC:

| RPC | Tipe | Fungsi |
| --- | --- | --- |
| `GetDaftarKursi` | Unary | Mengambil denah 50 kursi dan metadata harga. |
| `PesanKursi` | Unary | Memesan satu kursi dengan perlindungan transaksi. |
| `PesanBanyakKursi` | Unary | Memesan beberapa kursi dalam satu transaksi. |
| `PantauStatusKursi` | Server streaming | Menerima perubahan status kursi secara real-time. |
| `BatalPesanan` | Unary | Membatalkan pesanan dan mengembalikan kursi. |
| `GetKatalogFilm` | Unary | Mengambil katalog film. |
| `GetDaftarJadwal` | Unary | Mengambil jadwal dan harga tiket. |
| `SignInWithGoogle` | Unary | Membuat atau memperbarui profil pengguna. |

## Struktur repositori

```text
backend/              Server gRPC Node.js dan TypeScript
database/             Inisialisasi MySQL dan data seed
envoy/                Konfigurasi Envoy gRPC-Web
frontend/             Client React, Vite, TypeScript, dan Tailwind
proto/                Kontrak protobuf bersama
scripts/              Script load test k6
docker-compose.yml    Orkestrasi container lokal
TEAM_GUIDE.md         Pembagian tugas dan aturan proyek
```

## Prasyarat

- Docker Desktop dengan engine Linux/WSL2 aktif.
- Node.js versi 18 atau lebih baru dan npm.
- k6 untuk pengujian performa.
- Git.

## Menjalankan sistem lokal

Jalankan perintah berikut dari root repositori:

```powershell
cd "D:\KULIAH\SMT 5\gRPC-TIXO"
docker compose up -d
docker compose ps
```

Status service yang diharapkan:

| Service | Port | Status |
| --- | ---: | --- |
| `tixo-mysql` | `3306` | `healthy` |
| `tixo-backend` | `50051` | `Up` |
| `tixo-envoy` | `8080` | `Up` |

Pada setup Docker Desktop Windows yang digunakan saat ini, build backend baru mungkin perlu menjalankan legacy builder:

```powershell
$env:DOCKER_BUILDKIT="0"
docker compose up --build -d
```

Gunakan `--build` hanya jika image backend perlu dibuat ulang.

## Menjalankan frontend

Konfigurasi gRPC-Web lokal tersimpan di [frontend/.env.local](./frontend/.env.local):

```dotenv
VITE_TIXO_MODE=grpc-web
VITE_TIXO_GRPC_WEB_URL=http://localhost:8080
```

Jalankan Vite dari terminal kedua:

```powershell
cd "D:\KULIAH\SMT 5\gRPC-TIXO\frontend"
npm.cmd run dev -- --port 5174
```

Buka [http://localhost:5174](http://localhost:5174).

Frontend menggunakan gateway demo berbasis memory jika `VITE_TIXO_MODE` bukan `grpc-web`. Booking pada mode demo tidak mengubah database MySQL.

## Menjalankan load test k6

Pastikan Docker Compose tetap berjalan, lalu jalankan k6 dari root repositori:

```powershell
cd "D:\KULIAH\SMT 5\gRPC-TIXO"
k6 run scripts/load_test.js
```

Script memiliki tiga skenario:

- `baseline`: satu virtual client dengan satu percobaan booking.
- `ticket_war_5`: lima client memperebutkan kursi yang sama.
- `ticket_war_20`: dua puluh client memperebutkan kursi yang sama.

Untuk menjalankan pengujian berikutnya, gunakan jadwal dan kursi baru:

```powershell
k6 run `
  -e BASELINE_SCHEDULE_ID=sch-14 `
  -e WAR5_SCHEDULE_ID=sch-15 `
  -e WAR20_SCHEDULE_ID=sch-16 `
  -e BASELINE_SEAT=A1 `
  -e WAR5_SEAT=A1 `
  -e WAR20_SEAT=A1 `
  scripts/load_test.js
```

Output k6 mencakup:

- rata-rata latency booking,
- throughput dalam attempts per detik,
- application rejection rate,
- gRPC error rate,
- jumlah percobaan, sukses, penolakan, dan latency per skenario.

Penolakan aplikasi adalah hasil bisnis yang wajar saat ticket war. Artinya client tersebut kalah mendapatkan kursi. gRPC error rate digunakan untuk mengukur kegagalan transport atau RPC.

## Data jadwal dan kursi

Semua film menggunakan pola jadwal yang seragam:

- 4 film.
- 3 studio: Studio 1 IMAX, Studio 2 Dolby Atmos, dan Studio 3 Premiere.
- 6 tanggal: 3 sampai 8 November 2026.
- 5 jam tayang: 09.00, 13.00, 16.00, 19.30, dan 22.00 WIB.
- 50 kursi untuk setiap jadwal.
- Total 360 jadwal.

Aturan harga tiket:

- Senin sampai Jumat: Rp 40.000.
- Sabtu dan Minggu: Rp 45.000.

Seed yang sama tersedia di [database/init.sql](./database/init.sql) dan [backend/src/config/schema.sql](./backend/src/config/schema.sql).

## Reset data lokal

Untuk mengembalikan database lokal ke kondisi seed:

```powershell
docker compose down -v
docker compose up -d
```

Perintah tersebut menghapus seluruh data MySQL lokal, termasuk booking hasil testing. Gunakan hanya untuk development atau demo baru.

Untuk menghentikan container tanpa menghapus volume database:

```powershell
docker compose down
```

## Diagnostik

```powershell
docker compose ps
docker compose logs -f backend envoy
docker compose logs --tail=100 mysql
```

Build frontend dan backend:

```powershell
cd frontend
npm.cmd run build

cd ..\backend
npm.cmd run type-check
npm.cmd run build
```

## Hasil concurrency yang diharapkan

Pada setiap skenario ticket war, tepat satu request harus berhasil memesan kursi yang diperebutkan. Request lainnya harus ditolak sebagai penolakan bisnis yang aman. Database tidak boleh memiliki dua booking berhasil untuk pasangan `(schedule_id, seat_number)` yang sama.
