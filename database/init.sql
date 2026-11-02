-- TIXO Database Schema & Seed Data
CREATE DATABASE IF NOT EXISTS tixo_db;
USE tixo_db;

-- 1. Tabel Pengguna (Otentikasi Akun Gmail / Google)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    google_id VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel Master Film
CREATE TABLE IF NOT EXISTS movies (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    edition VARCHAR(100) NOT NULL DEFAULT 'Standard',
    genre VARCHAR(100) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 120,
    poster_url VARCHAR(500) NULL,
    synopsis TEXT NULL,
    rating VARCHAR(10) NOT NULL DEFAULT 'R13+',
    default_studio VARCHAR(100) NOT NULL DEFAULT 'Studio 1 IMAX'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel Jadwal Tayang Film
-- base_price: Rp 40.000 (Hari biasa), dihitung dinamis menjadi Rp 45.000 saat akhir pekan (Sabtu/Minggu)
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(36) PRIMARY KEY,
    movie_id VARCHAR(36) NOT NULL DEFAULT 'mov-01',
    movie_name VARCHAR(255) NOT NULL,
    studio_name VARCHAR(100) NOT NULL,
    start_time DATETIME NOT NULL,
    base_price INT NOT NULL DEFAULT 40000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_movie (movie_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Kursi Bioskop (dengan composite unique index pada schedule_id & seat_number)
CREATE TABLE IF NOT EXISTS seats (
    id VARCHAR(36) PRIMARY KEY,
    schedule_id VARCHAR(36) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    status ENUM('AVAILABLE', 'PENDING', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_schedule_seat (schedule_id, seat_number),
    INDEX idx_schedule_status (schedule_id, status),
    CONSTRAINT fk_seats_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel Riwayat Transaksi Tiket
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL UNIQUE,
    seat_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    user_email VARCHAR(255) NULL,
    price_paid INT NOT NULL DEFAULT 40000,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_seat FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabel Kunci Idempotensi (Mencegah Duplicate Request / Replay)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key_id VARCHAR(64) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response_payload JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================
-- SEED DATA KATALOG FILM
-- ====================================================
INSERT INTO movies (id, title, edition, genre, duration_minutes, poster_url, synopsis, rating, default_studio) VALUES
('mov-01', 'Interstellar', 'IMAX Special Remaster', 'Sci-fi · Drama', 169, '/posters/interstellar.jpg', 'Seorang pilot memimpin misi antarbintang melintasi lubang cacing untuk mencari harapan baru bagi kelangsungan hidup umat manusia.', 'R13+', 'Studio 1 IMAX'),
('mov-02', 'Dune: Part Two', 'Dolby Atmos Edition', 'Sci-fi · Action', 166, '/posters/dune2.jpg', 'Paul Atreides bersatu dengan Chani dan suku Fremen untuk membalas dendam terhadap konspirator yang menghancurkan keluarganya.', 'R13+', 'Studio 2 Dolby Atmos'),
('mov-03', 'Oppenheimer', 'Director Extended Cut', 'Biography · History', 180, '/posters/oppenheimer.jpg', 'Kisah batin fisikawan J. Robert Oppenheimer memimpin Proyek Manhattan yang mengubah peradaban manusia selamanya.', 'D17+', 'Studio 3 Premiere'),
('mov-04', 'Spider-Man: Beyond the Spider-Verse', 'IMAX 3D Laser', 'Animation · Action', 140, '/posters/spiderman.jpg', 'Miles Morales bertualang menembus dimensi multiverse untuk menyelamatkan takdir setiap semesta laba-laba.', 'SU', 'Studio 1 IMAX')
ON DUPLICATE KEY UPDATE title=VALUES(title), edition=VALUES(edition), genre=VALUES(genre);

-- ====================================================
-- SEED DATA JADWAL TAYANG (WEEKDAY 40RB & WEEKEND 45RB)
-- ====================================================
INSERT INTO schedules (id, movie_id, movie_name, studio_name, start_time, base_price) VALUES
-- Interstellar (Studio 1 IMAX) - Weekday (Selasa, Rabu, Kamis) -> Rp 40.000
('sch-01', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 19:30:00', 40000),
('sch-02', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 13:00:00', 40000),
('sch-03', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 16:00:00', 40000),
('sch-04', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 22:00:00', 40000),
('sch-05', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 13:00:00', 40000),
('sch-06', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 16:00:00', 40000),
('sch-07', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 19:30:00', 40000),
('sch-08', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 22:00:00', 40000),
('sch-09', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 13:00:00', 40000),
('sch-10', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 16:00:00', 40000),
('sch-11', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 19:30:00', 40000),
('sch-12', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 22:00:00', 40000),

-- Interstellar (Studio 1 IMAX) - Weekend (Sabtu & Minggu) -> Rp 45.000
('sch-13', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-07 14:00:00', 40000),
('sch-14', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-07 19:30:00', 40000),
('sch-15', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-08 14:00:00', 40000),
('sch-16', 'mov-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-08 19:30:00', 40000),

-- Dune: Part Two (Studio 2 Dolby Atmos)
('sch-17', 'mov-02', 'Dune: Part Two: Dolby Atmos Edition', 'Studio 2 Dolby Atmos', '2026-11-03 14:00:00', 40000),
('sch-18', 'mov-02', 'Dune: Part Two: Dolby Atmos Edition', 'Studio 2 Dolby Atmos', '2026-11-03 19:00:00', 40000),
('sch-19', 'mov-02', 'Dune: Part Two: Dolby Atmos Edition', 'Studio 2 Dolby Atmos', '2026-11-07 15:30:00', 40000),
('sch-20', 'mov-02', 'Dune: Part Two: Dolby Atmos Edition', 'Studio 2 Dolby Atmos', '2026-11-07 20:00:00', 40000),

-- Oppenheimer (Studio 3 Premiere)
('sch-21', 'mov-03', 'Oppenheimer: Director Extended Cut', 'Studio 3 Premiere', '2026-11-03 15:00:00', 40000),
('sch-22', 'mov-03', 'Oppenheimer: Director Extended Cut', 'Studio 3 Premiere', '2026-11-03 20:15:00', 40000),
('sch-23', 'mov-03', 'Oppenheimer: Director Extended Cut', 'Studio 3 Premiere', '2026-11-08 15:00:00', 40000),
('sch-24', 'mov-03', 'Oppenheimer: Director Extended Cut', 'Studio 3 Premiere', '2026-11-08 20:15:00', 40000),

-- Spider-Man: Beyond the Spider-Verse (Studio 1 IMAX)
('sch-25', 'mov-04', 'Spider-Man: Beyond the Spider-Verse: IMAX 3D', 'Studio 1 IMAX', '2026-11-04 15:00:00', 40000),
('sch-26', 'mov-04', 'Spider-Man: Beyond the Spider-Verse: IMAX 3D', 'Studio 1 IMAX', '2026-11-04 20:00:00', 40000),
('sch-27', 'mov-04', 'Spider-Man: Beyond the Spider-Verse: IMAX 3D', 'Studio 1 IMAX', '2026-11-07 11:30:00', 40000),
('sch-28', 'mov-04', 'Spider-Man: Beyond the Spider-Verse: IMAX 3D', 'Studio 1 IMAX', '2026-11-07 17:00:00', 40000)
ON DUPLICATE KEY UPDATE movie_name=VALUES(movie_name), studio_name=VALUES(studio_name), start_time=VALUES(start_time), base_price=VALUES(base_price);

-- Seeding Kursi Awal (50 Kursi: A1 s/d E10) untuk sch-01
INSERT IGNORE INTO seats (id, schedule_id, seat_number, status) VALUES
('sch-01-A1', 'sch-01', 'A1', 'AVAILABLE'),('sch-01-A2', 'sch-01', 'A2', 'AVAILABLE'),('sch-01-A3', 'sch-01', 'A3', 'AVAILABLE'),('sch-01-A4', 'sch-01', 'A4', 'AVAILABLE'),('sch-01-A5', 'sch-01', 'A5', 'AVAILABLE'),
('sch-01-A6', 'sch-01', 'A6', 'AVAILABLE'),('sch-01-A7', 'sch-01', 'A7', 'AVAILABLE'),('sch-01-A8', 'sch-01', 'A8', 'AVAILABLE'),('sch-01-A9', 'sch-01', 'A9', 'AVAILABLE'),('sch-01-A10', 'sch-01', 'A10', 'AVAILABLE'),
('sch-01-B1', 'sch-01', 'B1', 'AVAILABLE'),('sch-01-B2', 'sch-01', 'B2', 'AVAILABLE'),('sch-01-B3', 'sch-01', 'B3', 'AVAILABLE'),('sch-01-B4', 'sch-01', 'B4', 'AVAILABLE'),('sch-01-B5', 'sch-01', 'B5', 'AVAILABLE'),
('sch-01-B6', 'sch-01', 'B6', 'AVAILABLE'),('sch-01-B7', 'sch-01', 'B7', 'AVAILABLE'),('sch-01-B8', 'sch-01', 'B8', 'AVAILABLE'),('sch-01-B9', 'sch-01', 'B9', 'AVAILABLE'),('sch-01-B10', 'sch-01', 'B10', 'AVAILABLE'),
('sch-01-C1', 'sch-01', 'C1', 'AVAILABLE'),('sch-01-C2', 'sch-01', 'C2', 'AVAILABLE'),('sch-01-C3', 'sch-01', 'C3', 'AVAILABLE'),('sch-01-C4', 'sch-01', 'C4', 'AVAILABLE'),('sch-01-C5', 'sch-01', 'C5', 'AVAILABLE'),
('sch-01-C6', 'sch-01', 'C6', 'AVAILABLE'),('sch-01-C7', 'sch-01', 'C7', 'AVAILABLE'),('sch-01-C8', 'sch-01', 'C8', 'AVAILABLE'),('sch-01-C9', 'sch-01', 'C9', 'AVAILABLE'),('sch-01-C10', 'sch-01', 'C10', 'AVAILABLE'),
('sch-01-D1', 'sch-01', 'D1', 'AVAILABLE'),('sch-01-D2', 'sch-01', 'D2', 'AVAILABLE'),('sch-01-D3', 'sch-01', 'D3', 'AVAILABLE'),('sch-01-D4', 'sch-01', 'D4', 'AVAILABLE'),('sch-01-D5', 'sch-01', 'D5', 'AVAILABLE'),
('sch-01-D6', 'sch-01', 'D6', 'AVAILABLE'),('sch-01-D7', 'sch-01', 'D7', 'AVAILABLE'),('sch-01-D8', 'sch-01', 'D8', 'AVAILABLE'),('sch-01-D9', 'sch-01', 'D9', 'AVAILABLE'),('sch-01-D10', 'sch-01', 'D10', 'AVAILABLE'),
('sch-01-E1', 'sch-01', 'E1', 'AVAILABLE'),('sch-01-E2', 'sch-01', 'E2', 'AVAILABLE'),('sch-01-E3', 'sch-01', 'E3', 'AVAILABLE'),('sch-01-E4', 'sch-01', 'E4', 'AVAILABLE'),('sch-01-E5', 'sch-01', 'E5', 'AVAILABLE'),
('sch-01-E6', 'sch-01', 'E6', 'AVAILABLE'),('sch-01-E7', 'sch-01', 'E7', 'AVAILABLE'),('sch-01-E8', 'sch-01', 'E8', 'AVAILABLE'),('sch-01-E9', 'sch-01', 'E9', 'AVAILABLE'),('sch-01-E10', 'sch-01', 'E10', 'AVAILABLE');

-- Seeding Kursi untuk seluruh jadwal lainnya (sch-02 s/d sch-28)
INSERT IGNORE INTO seats (id, schedule_id, seat_number, status)
SELECT CONCAT(s.id, '-', base.seat_number), s.id, base.seat_number, 'AVAILABLE'
FROM schedules s
CROSS JOIN (
  SELECT seat_number FROM seats WHERE schedule_id = 'sch-01'
) base
WHERE s.id != 'sch-01';
