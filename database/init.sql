-- TIXO Database Initialization Script for Docker & Local Setup
CREATE DATABASE IF NOT EXISTS tixo_db;
USE tixo_db;

-- 1. Tabel Jadwal Tayang Film
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(36) PRIMARY KEY,
    movie_name VARCHAR(255) NOT NULL,
    studio_name VARCHAR(100) NOT NULL,
    start_time DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel Kursi Bioskop (dengan composite unique index pada schedule_id & seat_number)
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

-- 3. Tabel Riwayat Transaksi Tiket
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL UNIQUE,
    seat_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_seat FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Kunci Idempotensi (Mencegah Duplicate Request / Replay)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key_id VARCHAR(64) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response_payload JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seeding Default Schedule
INSERT IGNORE INTO schedules (id, movie_name, studio_name, start_time) 
VALUES ('sch-01', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 19:30:00');

-- Seeding Kursi Studio 1: 50 Kursi (A1-A10, B1-B10, C1-C10, D1-D10, E1-E10)
INSERT IGNORE INTO seats (id, schedule_id, seat_number, status) VALUES
('sch-01-A1', 'sch-01', 'A1', 'AVAILABLE'),
('sch-01-A2', 'sch-01', 'A2', 'AVAILABLE'),
('sch-01-A3', 'sch-01', 'A3', 'AVAILABLE'),
('sch-01-A4', 'sch-01', 'A4', 'AVAILABLE'),
('sch-01-A5', 'sch-01', 'A5', 'AVAILABLE'),
('sch-01-A6', 'sch-01', 'A6', 'AVAILABLE'),
('sch-01-A7', 'sch-01', 'A7', 'AVAILABLE'),
('sch-01-A8', 'sch-01', 'A8', 'AVAILABLE'),
('sch-01-A9', 'sch-01', 'A9', 'AVAILABLE'),
('sch-01-A10', 'sch-01', 'A10', 'AVAILABLE'),

('sch-01-B1', 'sch-01', 'B1', 'AVAILABLE'),
('sch-01-B2', 'sch-01', 'B2', 'AVAILABLE'),
('sch-01-B3', 'sch-01', 'B3', 'AVAILABLE'),
('sch-01-B4', 'sch-01', 'B4', 'AVAILABLE'),
('sch-01-B5', 'sch-01', 'B5', 'AVAILABLE'),
('sch-01-B6', 'sch-01', 'B6', 'AVAILABLE'),
('sch-01-B7', 'sch-01', 'B7', 'AVAILABLE'),
('sch-01-B8', 'sch-01', 'B8', 'AVAILABLE'),
('sch-01-B9', 'sch-01', 'B9', 'AVAILABLE'),
('sch-01-B10', 'sch-01', 'B10', 'AVAILABLE'),

('sch-01-C1', 'sch-01', 'C1', 'AVAILABLE'),
('sch-01-C2', 'sch-01', 'C2', 'AVAILABLE'),
('sch-01-C3', 'sch-01', 'C3', 'AVAILABLE'),
('sch-01-C4', 'sch-01', 'C4', 'AVAILABLE'),
('sch-01-C5', 'sch-01', 'C5', 'AVAILABLE'),
('sch-01-C6', 'sch-01', 'C6', 'AVAILABLE'),
('sch-01-C7', 'sch-01', 'C7', 'AVAILABLE'),
('sch-01-C8', 'sch-01', 'C8', 'AVAILABLE'),
('sch-01-C9', 'sch-01', 'C9', 'AVAILABLE'),
('sch-01-C10', 'sch-01', 'C10', 'AVAILABLE'),

('sch-01-D1', 'sch-01', 'D1', 'AVAILABLE'),
('sch-01-D2', 'sch-01', 'D2', 'AVAILABLE'),
('sch-01-D3', 'sch-01', 'D3', 'AVAILABLE'),
('sch-01-D4', 'sch-01', 'D4', 'AVAILABLE'),
('sch-01-D5', 'sch-01', 'D5', 'AVAILABLE'),
('sch-01-D6', 'sch-01', 'D6', 'AVAILABLE'),
('sch-01-D7', 'sch-01', 'D7', 'AVAILABLE'),
('sch-01-D8', 'sch-01', 'D8', 'AVAILABLE'),
('sch-01-D9', 'sch-01', 'D9', 'AVAILABLE'),
('sch-01-D10', 'sch-01', 'D10', 'AVAILABLE'),

('sch-01-E1', 'sch-01', 'E1', 'AVAILABLE'),
('sch-01-E2', 'sch-01', 'E2', 'AVAILABLE'),
('sch-01-E3', 'sch-01', 'E3', 'AVAILABLE'),
('sch-01-E4', 'sch-01', 'E4', 'AVAILABLE'),
('sch-01-E5', 'sch-01', 'E5', 'AVAILABLE'),
('sch-01-E6', 'sch-01', 'E6', 'AVAILABLE'),
('sch-01-E7', 'sch-01', 'E7', 'AVAILABLE'),
('sch-01-E8', 'sch-01', 'E8', 'AVAILABLE'),
('sch-01-E9', 'sch-01', 'E9', 'AVAILABLE'),
('sch-01-E10', 'sch-01', 'E10', 'AVAILABLE');

