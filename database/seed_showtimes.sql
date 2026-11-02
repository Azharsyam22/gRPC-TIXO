-- Run once (or again safely) to add the extra Interstellar showtimes to an existing database.
USE tixo_db;

INSERT IGNORE INTO schedules (id, movie_name, studio_name, start_time) VALUES
  ('sch-02', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 13:00:00'),
  ('sch-03', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 16:00:00'),
  ('sch-04', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-03 22:00:00'),
  ('sch-05', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 13:00:00'),
  ('sch-06', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 16:00:00'),
  ('sch-07', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 19:30:00'),
  ('sch-08', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-04 22:00:00'),
  ('sch-09', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 13:00:00'),
  ('sch-10', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 16:00:00'),
  ('sch-11', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 19:30:00'),
  ('sch-12', 'Interstellar: IMAX Special Remaster', 'Studio 1 IMAX', '2026-11-05 22:00:00');

INSERT IGNORE INTO seats (id, schedule_id, seat_number, status)
SELECT CONCAT(showtime.id, '-', base.seat_number), showtime.id, base.seat_number, 'AVAILABLE'
FROM (
  SELECT 'sch-02' AS id UNION ALL SELECT 'sch-03' UNION ALL SELECT 'sch-04'
  UNION ALL SELECT 'sch-05' UNION ALL SELECT 'sch-06' UNION ALL SELECT 'sch-07'
  UNION ALL SELECT 'sch-08' UNION ALL SELECT 'sch-09' UNION ALL SELECT 'sch-10'
  UNION ALL SELECT 'sch-11' UNION ALL SELECT 'sch-12'
) AS showtime
CROSS JOIN (
  SELECT seat_number FROM seats WHERE schedule_id = 'sch-01'
) AS base;
