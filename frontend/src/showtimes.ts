export interface Showtime {
  id: string
  movieId: string
  time: string
  date: string
  studio?: string
  movieName?: string
  ticketPrice?: number
  basePrice?: number
  isWeekend?: boolean
}

export interface MovieItem {
  id: string
  title: string
  edition: string
  genre: string
  studio: string
  synopsis: string
  rating: string
  durationMinutes?: number
  posterUrl?: string
}

export const moviePresentationOverrides: Record<string, Partial<MovieItem>> = {
  'mov-04': {
    title: 'Spider-Man: No Way Home',
    edition: 'Marvel Studios',
    genre: 'Action · Adventure · Sci-fi',
    synopsis: 'Identitas Peter Parker terbongkar. Ia meminta bantuan Doctor Strange, tetapi sebuah mantra membuka ancaman dari semesta lain.',
    rating: 'R13+',
    posterUrl: '/posters/spiderman-no-way-home.jpg',
  },
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
    posterUrl: '/posters/interstellar.jpg',
  },
  {
    id: 'mov-02',
    title: 'Dune: Part Two',
    edition: 'Dolby Atmos Edition',
    genre: 'Sci-fi · Action',
    studio: 'Studio 2 Dolby Atmos',
    synopsis: 'Paul Atreides bersatu dengan Chani dan suku Fremen untuk membalas dendam terhadap konspirator yang menghancurkan keluarganya.',
    rating: 'R13+',
    posterUrl: '/posters/dune2.jpg',
  },
  {
    id: 'mov-03',
    title: 'Oppenheimer',
    edition: 'Director Extended Cut',
    genre: 'Biography · History',
    studio: 'Studio 3 Premiere',
    synopsis: 'Kisah batin fisikawan J. Robert Oppenheimer memimpin Proyek Manhattan yang mengubah peradaban manusia selamanya.',
    rating: 'D17+',
    posterUrl: '/posters/oppenheimer.jpg',
  },
  {
    id: 'mov-04',
    title: 'Spider-Man: No Way Home',
    edition: 'Marvel Studios',
    genre: 'Action · Adventure · Sci-fi',
    studio: 'Studio 1 IMAX',
    synopsis: 'Identitas Peter Parker terbongkar. Ia meminta bantuan Doctor Strange, tetapi sebuah mantra membuka ancaman dari semesta lain.',
    rating: 'R13+',
    posterUrl: '/posters/spiderman-no-way-home.jpg',
  },
]

const scheduleDates = [
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
]

const dailyShowtimes = ['09.00 WIB', '13.00 WIB', '16.00 WIB', '19.30 WIB', '22.00 WIB']
export const cinemaStudios = ['Studio 1 IMAX', 'Studio 2 Dolby Atmos', 'Studio 3 Premiere']

// Jadwal pratinjau diseragamkan agar setiap film punya pilihan tanggal dan jam yang sama.
export const showtimes: Showtime[] = movieList.flatMap((movie) =>
  cinemaStudios.flatMap((studio, studioIndex) =>
    scheduleDates.flatMap((date) =>
      dailyShowtimes.map((time) => ({
        id: `demo-${movie.id}-studio-${studioIndex + 1}-${date.replaceAll('-', '')}-${time.slice(0, 5).replace('.', '')}`,
        movieId: movie.id,
        studio,
        date,
        time,
      })),
    ),
  ),
)

export const defaultShowtime = showtimes.find((showtime) =>
  showtime.movieId === 'mov-01' && showtime.studio === movieList[0]!.studio && showtime.date === '2026-11-03' && showtime.time === '19.30 WIB',
)!

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
