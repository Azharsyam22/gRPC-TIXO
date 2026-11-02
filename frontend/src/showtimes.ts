export interface Showtime {
  id: string
  movieId: string
  time: string
  date: string
}

export interface MovieItem {
  id: string
  title: string
  edition: string
  genre: string
  studio: string
  synopsis: string
  rating: string
}

export const movieList: MovieItem[] = [
  {
    id: 'mov-01',
    title: 'Interstellar',
    edition: 'IMAX Special Remaster',
    genre: 'Sci-fi · Drama',
    studio: 'Studio 1 IMAX',
    synopsis: 'Seorang pilot memimpin misi antarbintang melintasi lubang cacing untuk mencari harapan baru bagi kelangsungan hidup umat manusia.',
    rating: 'R13+',
  },
  {
    id: 'mov-02',
    title: 'Dune: Part Two',
    edition: 'Dolby Atmos Edition',
    genre: 'Sci-fi · Action',
    studio: 'Studio 2 Dolby Atmos',
    synopsis: 'Paul Atreides bersatu dengan Chani dan suku Fremen untuk membalas dendam terhadap konspirator yang menghancurkan keluarganya.',
    rating: 'R13+',
  },
  {
    id: 'mov-03',
    title: 'Oppenheimer',
    edition: 'Director Extended Cut',
    genre: 'Biography · History',
    studio: 'Studio 3 Premiere',
    synopsis: 'Kisah batin fisikawan J. Robert Oppenheimer memimpin Proyek Manhattan yang mengubah peradaban manusia selamanya.',
    rating: 'D17+',
  },
  {
    id: 'mov-04',
    title: 'Spider-Man',
    edition: 'Beyond the Spider-Verse',
    genre: 'Animation · Action',
    studio: 'Studio 1 IMAX',
    synopsis: 'Miles Morales bertualang menembus dimensi multiverse untuk menyelamatkan takdir setiap semesta laba-laba.',
    rating: 'SU',
  },
]

export const showtimes: Showtime[] = [
  // Interstellar - Weekdays (Hari Biasa: Rp 40.000)
  { id: 'sch-02', movieId: 'mov-01', date: '2026-11-03', time: '13.00 WIB' },
  { id: 'sch-03', movieId: 'mov-01', date: '2026-11-03', time: '16.00 WIB' },
  { id: 'sch-01', movieId: 'mov-01', date: '2026-11-03', time: '19.30 WIB' },
  { id: 'sch-04', movieId: 'mov-01', date: '2026-11-03', time: '22.00 WIB' },
  { id: 'sch-05', movieId: 'mov-01', date: '2026-11-04', time: '13.00 WIB' },
  { id: 'sch-06', movieId: 'mov-01', date: '2026-11-04', time: '16.00 WIB' },
  { id: 'sch-07', movieId: 'mov-01', date: '2026-11-04', time: '19.30 WIB' },
  { id: 'sch-08', movieId: 'mov-01', date: '2026-11-04', time: '22.00 WIB' },
  { id: 'sch-09', movieId: 'mov-01', date: '2026-11-05', time: '13.00 WIB' },
  { id: 'sch-10', movieId: 'mov-01', date: '2026-11-05', time: '16.00 WIB' },
  { id: 'sch-11', movieId: 'mov-01', date: '2026-11-05', time: '19.30 WIB' },
  { id: 'sch-12', movieId: 'mov-01', date: '2026-11-05', time: '22.00 WIB' },

  // Interstellar - Weekend (Sabtu & Minggu: Rp 45.000)
  { id: 'sch-13', movieId: 'mov-01', date: '2026-11-07', time: '14.00 WIB' },
  { id: 'sch-14', movieId: 'mov-01', date: '2026-11-07', time: '19.30 WIB' },
  { id: 'sch-15', movieId: 'mov-01', date: '2026-11-08', time: '14.00 WIB' },
  { id: 'sch-16', movieId: 'mov-01', date: '2026-11-08', time: '19.30 WIB' },

  // Dune: Part Two
  { id: 'sch-17', movieId: 'mov-02', date: '2026-11-03', time: '14.00 WIB' },
  { id: 'sch-18', movieId: 'mov-02', date: '2026-11-03', time: '19.00 WIB' },
  { id: 'sch-19', movieId: 'mov-02', date: '2026-11-07', time: '15.30 WIB' },
  { id: 'sch-20', movieId: 'mov-02', date: '2026-11-07', time: '20.00 WIB' },

  // Oppenheimer
  { id: 'sch-21', movieId: 'mov-03', date: '2026-11-03', time: '15.00 WIB' },
  { id: 'sch-22', movieId: 'mov-03', date: '2026-11-03', time: '20.15 WIB' },
  { id: 'sch-23', movieId: 'mov-03', date: '2026-11-08', time: '15.00 WIB' },
  { id: 'sch-24', movieId: 'mov-03', date: '2026-11-08', time: '20.15 WIB' },

  // Spider-Man
  { id: 'sch-25', movieId: 'mov-04', date: '2026-11-04', time: '15.00 WIB' },
  { id: 'sch-26', movieId: 'mov-04', date: '2026-11-04', time: '20.00 WIB' },
  { id: 'sch-27', movieId: 'mov-04', date: '2026-11-07', time: '11.30 WIB' },
  { id: 'sch-28', movieId: 'mov-04', date: '2026-11-07', time: '17.00 WIB' },
]

export const defaultShowtime = showtimes[2]!

/**
 * Aturan Harga Tiket TIXO:
 * - Hari Biasa (Senin - Jumat): Rp 40.000
 * - Akhir Pekan (Sabtu & Minggu): Rp 45.000 (+Rp 5.000)
 */
export function getPricingForDate(dateValue: string): { price: number; isWeekend: boolean } {
  const dateObj = new Date(`${dateValue}T12:00:00`)
  const day = dateObj.getDay() // 0 = Minggu, 6 = Sabtu
  const isWeekend = day === 0 || day === 6
  return {
    price: isWeekend ? 45000 : 40000,
    isWeekend,
  }
}

export const showDays = [...new Set(showtimes.map((showtime) => showtime.date))]
