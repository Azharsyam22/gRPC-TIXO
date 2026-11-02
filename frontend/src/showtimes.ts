export interface Showtime {
  id: string
  time: string
  date: string
}

// Keep these IDs aligned with database/init.sql and seed_showtimes.sql.
export const showtimes: Showtime[] = [
  { id: 'sch-02', date: '2026-11-03', time: '13.00 WIB' },
  { id: 'sch-03', date: '2026-11-03', time: '16.00 WIB' },
  { id: 'sch-01', date: '2026-11-03', time: '19.30 WIB' },
  { id: 'sch-04', date: '2026-11-03', time: '22.00 WIB' },
  { id: 'sch-05', date: '2026-11-04', time: '13.00 WIB' },
  { id: 'sch-06', date: '2026-11-04', time: '16.00 WIB' },
  { id: 'sch-07', date: '2026-11-04', time: '19.30 WIB' },
  { id: 'sch-08', date: '2026-11-04', time: '22.00 WIB' },
  { id: 'sch-09', date: '2026-11-05', time: '13.00 WIB' },
  { id: 'sch-10', date: '2026-11-05', time: '16.00 WIB' },
  { id: 'sch-11', date: '2026-11-05', time: '19.30 WIB' },
  { id: 'sch-12', date: '2026-11-05', time: '22.00 WIB' },
]

export const defaultShowtime = showtimes[2]
export const showDays = [...new Set(showtimes.map((showtime) => showtime.date))]
