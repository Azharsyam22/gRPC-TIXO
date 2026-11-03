import { useEffect, useMemo, useState } from 'react'
import type { MovieItem } from '../showtimes'

interface HomePromoCarouselProps {
  movies: MovieItem[]
}

export function HomePromoCarousel({ movies }: HomePromoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const slides = useMemo(() => {
    const promo: MovieItem | undefined = movies.find((movie) => movie.id === 'mov-03') || movies[0]
    return [
      ...(promo ? [{
        id: 'sample-bogo',
        posterUrl: promo.posterUrl || '',
        eyebrow: 'PROMO SIMULASI',
        title: 'BUY 1 GET 1',
        description: 'Contoh promo untuk pratinjau. Penawaran ini belum mengubah total pembayaran.',
      }] : []),
      ...movies.map((movie) => ({
        id: movie.id,
        posterUrl: movie.posterUrl || '',
        eyebrow: `FILM PILIHAN · ${movie.edition}`,
        title: movie.title.toLocaleUpperCase('id-ID'),
        description: movie.synopsis,
      })),
    ]
  }, [movies])

  useEffect(() => {
    if (isPaused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), 4500)
    return () => window.clearInterval(timer)
  }, [isPaused, slides.length])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)))
  }, [slides.length])

  if (!slides.length) return null

  return (
    <section
      className="home-promo-carousel"
      aria-label="Promosi dan film pilihan"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false)
      }}
    >
      <div className="home-promo-viewport" aria-live="off">
        <div className="home-promo-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {slides.map((slide, index) => (
            <article className="home-promo-slide" key={slide.id} aria-hidden={activeIndex !== index}>
              <img src={slide.posterUrl} alt="" />
              <div className="home-promo-shade" />
              <div className="home-promo-copy">
                <span>{slide.eyebrow}</span>
                <h2>{slide.title}</h2>
                <p>{slide.description}</p>
                <a href="#now-showing" tabIndex={activeIndex === index ? 0 : -1}>Lihat film <i aria-hidden="true">↗</i></a>
              </div>
              <span className="home-promo-count" aria-hidden="true">{String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
            </article>
          ))}
        </div>
      </div>
      <div className="home-promo-dots" role="group" aria-label="Pilih banner">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={activeIndex === index ? 'is-active' : ''}
            aria-label={`Tampilkan banner ${index + 1}: ${slide.title}`}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  )
}
