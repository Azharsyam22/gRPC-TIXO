import { useState } from 'react'
import type { MovieItem } from '../showtimes'

const officialVideoIds: Record<string, string> = {
  'mov-01': '2LqzF5WauAw',
  'mov-02': '_YUzQa_1RCE',
  'mov-03': 'bK6ldnjE3Y0',
  'mov-04': 'JfVOs4VSpmA',
}

interface BookingTrailerProps {
  movie: MovieItem
}

export function BookingTrailer({ movie }: BookingTrailerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const videoId = officialVideoIds[movie.id]

  if (!videoId) return null

  return (
    <>
      <button
        className="booking-trailer"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Lihat trailer ${movie.title}`}
      >
        <img src={movie.posterUrl} alt="" loading="lazy" decoding="async" />
        <span className="booking-trailer-shade" aria-hidden="true" />
        <span className="booking-trailer-play" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 6.5v11L18 12 9 6.5Z" /></svg>
        </span>
        <span className="booking-trailer-label">Lihat trailer</span>
      </button>

      {isOpen && (
        <div className="booking-trailer-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false) }}>
          <section className="trailer-player-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-trailer-title">
            <div className="trailer-player-heading">
              <div><span>TRAILER FILM</span><h2 id="booking-trailer-title">{movie.title}</h2></div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Tutup trailer">×</button>
            </div>
            <div className="trailer-player-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                title={`Trailer ${movie.title}`}
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
