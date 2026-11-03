import { useCallback, useEffect, useRef, useState } from 'react'
import type { MovieItem } from '../showtimes'

interface TrailerCarouselProps {
  movies: MovieItem[]
}

export function TrailerCarousel({ movies }: TrailerCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(3)
  const [activePage, setActivePage] = useState(0)
  const [selectedTrailer, setSelectedTrailer] = useState<{ movie: MovieItem; videoId: string } | null>(null)
  const officialVideoIds: Record<string, string> = {
    'mov-01': '2LqzF5WauAw',
    'mov-02': '_YUzQa_1RCE',
    'mov-03': 'bK6ldnjE3Y0',
    'mov-04': 'JfVOs4VSpmA',
  }
  const trailerMovies = movies.flatMap((movie) => {
    const videoId = officialVideoIds[movie.id]
    return videoId || movie.id === 'mov-04' ? [{ movie, videoId }] : []
  })
  const pageCount = Math.max(1, trailerMovies.length - visibleCount + 1)

  const measure = useCallback(() => {
    setVisibleCount(window.innerWidth <= 560 ? 1 : window.innerWidth <= 920 ? 2 : 3)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  useEffect(() => {
    setActivePage((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  const scrollToPage = useCallback((page: number) => {
    const viewport = viewportRef.current
    const cards = viewport?.querySelectorAll<HTMLElement>('.trailer-card')
    if (!viewport || !cards?.length) return
    const first = cards[0]!
    const second = cards[1]
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    viewport.scrollTo({ left: Math.max(0, step * page), behavior: 'smooth' })
    setActivePage(page)
  }, [])

  const updatePage = useCallback(() => {
    const viewport = viewportRef.current
    const cards = viewport?.querySelectorAll<HTMLElement>('.trailer-card')
    if (!viewport || !cards?.length) return
    const first = cards[0]!
    const second = cards[1]
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    if (step) setActivePage(Math.min(Math.round(viewport.scrollLeft / step), pageCount - 1))
  }, [pageCount])

  useEffect(() => {
    if (!selectedTrailer) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedTrailer(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedTrailer])

  if (!trailerMovies.length) return null

  return (
    <>
      <section className="video-trailers" id="video-trailers" aria-labelledby="trailers-title">
        <div className="trailers-inner">
          <div className="trailers-heading">
            <div>
              <h2 id="trailers-title">Video &amp; Trailers</h2>
            </div>
          </div>

          <div className="trailer-viewport" ref={viewportRef} onScroll={updatePage}>
            <div className="trailer-track">
              {trailerMovies.map(({ movie, videoId }) => (
                <article className="trailer-card" key={movie.id}>
                  {videoId ? (
                    <button className="trailer-thumbnail" type="button" onClick={() => setSelectedTrailer({ movie, videoId })} aria-label={`Putar trailer ${movie.title}`}>
                      <img src={movie.posterUrl} alt={`Cuplikan visual ${movie.title}`} loading="lazy" decoding="async" />
                      <span className="trailer-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.8v12.4L18 12 8 5.8Z" /></svg></span>
                      <span className="trailer-watch-label"></span>
                    </button>
                  ) : (
                    <div className="trailer-thumbnail trailer-unavailable" aria-label={`Trailer ${movie.title} belum tersedia`}>
                      <img src={movie.posterUrl} alt={`Poster ${movie.title}`} loading="lazy" decoding="async" />
                      <span>TRAILER RESMI<br />SEGERA HADIR</span>
                    </div>
                  )}
                  <h3>{movie.title} <span>·</span> {videoId ? 'Official Trailer' : 'Segera hadir'}</h3>
                </article>
              ))}
            </div>
          </div>

          <div className="trailer-controls">
            <button type="button" className="trailer-arrow" disabled={activePage === 0} onClick={() => scrollToPage(activePage - 1)} aria-label="Trailer sebelumnya">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 7-7m-7 7 7 7" /></svg>
            </button>
            <div className="trailer-dots" role="group" aria-label="Pilih kelompok trailer">
              {Array.from({ length: pageCount }, (_, index) => (
                <button key={index} type="button" className={activePage === index ? 'is-active' : ''} aria-label={`Tampilkan kelompok trailer ${index + 1}`} aria-current={activePage === index ? 'true' : undefined} onClick={() => scrollToPage(index)} />
              ))}
            </div>
            <button type="button" className="trailer-arrow" disabled={activePage >= pageCount - 1} onClick={() => scrollToPage(activePage + 1)} aria-label="Trailer berikutnya">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m0 0-7-7m7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </section>

      {selectedTrailer && (
        <div className="trailer-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrailer(null) }}>
          <section className="trailer-player-dialog" role="dialog" aria-modal="true" aria-labelledby="trailer-player-title">
            <div className="trailer-player-heading">
              <div><span>VIDEO &amp; TRAILERS</span><h2 id="trailer-player-title">{selectedTrailer.movie.title}</h2></div>
              <button type="button" onClick={() => setSelectedTrailer(null)} aria-label="Tutup video">×</button>
            </div>
            <div className="trailer-player-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedTrailer.videoId}?autoplay=1&rel=0`}
                title={`Official trailer ${selectedTrailer.movie.title}`}
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
