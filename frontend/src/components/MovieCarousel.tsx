import { useCallback, useEffect, useRef, useState } from 'react'
import type { MovieItem, Showtime } from '../showtimes'

const movieShelfPosters: Record<string, string> = {
  'mov-01': '/posters/Interstellar_portrait.jpg',
  'mov-02': '/posters/dune2-portrait.jpg',
  'mov-03': '/posters/oppenheimer-portrait.jpg',
  'mov-04': '/posters/spiderman-portrait.jpg',
}

interface MovieCarouselProps {
  movies: MovieItem[]
  schedules: Showtime[]
  disabled: boolean
  onBook: (movie: MovieItem) => void
}

export function MovieCarousel({ movies, schedules, disabled, onBook }: MovieCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(4)
  const [activePage, setActivePage] = useState(0)
  const pageCount = Math.max(1, movies.length - visibleCount + 1)

  const measure = useCallback(() => {
    const width = window.innerWidth
    setVisibleCount(width <= 520 ? 1 : width <= 700 ? 2 : width <= 970 ? 3 : 4)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  useEffect(() => {
    setActivePage((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  function goToPage(index: number) {
    const viewport = viewportRef.current
    const cards = viewport?.querySelectorAll<HTMLElement>('.movie-shelf-card')
    if (!viewport || !cards?.length) return
    const first = cards[0]!
    const second = cards[1]
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    viewport.scrollTo({ left: step * index, behavior: 'smooth' })
    setActivePage(index)
  }

  function updateActivePage() {
    const viewport = viewportRef.current
    const cards = viewport?.querySelectorAll<HTMLElement>('.movie-shelf-card')
    if (!viewport || !cards?.length) return
    const first = cards[0]!
    const second = cards[1]
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    if (!step) return
    setActivePage(Math.min(Math.round(viewport.scrollLeft / step), pageCount - 1))
  }

  return (
    <div className="movie-shelf">
      <div className="movie-shelf-viewport" ref={viewportRef} onScroll={updateActivePage}>
        <div className="movie-shelf-track">
          {movies.map((movie) => {
            const movieSchedules = schedules.filter((schedule) => schedule.movieId === movie.id)
            const studioCount = new Set(movieSchedules.map((schedule) => schedule.studio || movie.studio)).size
            return (
              <article className="movie-shelf-card" key={movie.id}>
                <img src={movieShelfPosters[movie.id] || movie.posterUrl} alt={`Poster ${movie.title}`} loading="lazy" decoding="async" />
                <div className="movie-shelf-copy">
                  <p className="movie-shelf-meta">{movie.edition}<i />{movie.rating}</p>
                  <h2>{movie.title}</h2>
                  <span className="movie-shelf-studios">{studioCount ? `${studioCount} studio tersedia` : 'Jadwal belum tersedia'}</span>
                  <button type="button" disabled={!movieSchedules.length || disabled} onClick={() => onBook(movie)}>
                    Pilih film <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            )
          })}
          {!movies.length && <p className="empty-catalog">Film yang cocok dengan pencarianmu belum tersedia.</p>}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="movie-shelf-dots" role="group" aria-label="Navigasi daftar film">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className={activePage === index ? 'is-active' : ''}
              aria-label={`Tampilkan daftar film bagian ${index + 1}`}
              aria-current={activePage === index ? 'true' : undefined}
              onClick={() => goToPage(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
