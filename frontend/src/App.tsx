import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SeatMap } from './components/SeatMap'
import { ToastViewport } from './components/ToastViewport'
import { createId, tixoGateway, userId } from './services/tixoGateway'
import { defaultShowtime, showDays, showtimes } from './showtimes'
import type { ConnectionState, RecentBooking, Seat, SeatStatus, ToastMessage } from './types'

const movie = {
  title: 'Interstellar',
  edition: 'IMAX Special Remaster',
  studio: 'Studio 1 IMAX',
}

type Theme = 'light' | 'dark'

const filmSynopsis = 'Seorang pilot memimpin misi antarbintang untuk mencari harapan baru bagi umat manusia.'

function formatShowDay(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`)
  const dateText = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date)
  const today = new Date().toLocaleDateString('en-CA')
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA')
  if (dateValue === today) return { top: 'HARI INI', bottom: dateText }
  if (dateValue === tomorrow) return { top: 'BESOK', bottom: dateText }
  return { top: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date).toUpperCase(), bottom: dateText }
}

function readTheme(): Theme {
  try {
    return window.localStorage.getItem('tixo-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function readRecentBookings(): RecentBooking[] {
  if (tixoGateway.mode === 'demo') return []
  try {
    return JSON.parse(window.localStorage.getItem('tixo-recent-bookings') || '[]') as RecentBooking[]
  } catch {
    return []
  }
}

function connectionCopy(state: ConnectionState) {
  if (state === 'demo') return 'Pratinjau lokal'
  if (state === 'connected') return 'Kursi tersinkron'
  if (state === 'reconnecting') return 'Menyambungkan ulang'
  return 'Menghubungkan ke studio'
}

function syncDescription(state: ConnectionState) {
  if (state === 'demo') return 'Simulasi lokal, tidak mengubah database'
  if (state === 'connected') return 'Perubahan kursi diterima lewat stream'
  if (state === 'reconnecting') return 'Stream terputus, mencoba tersambung lagi'
  return 'Membuka stream status kursi'
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function App() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [activeShowtime, setActiveShowtime] = useState(defaultShowtime)
  const [activeDate, setActiveDate] = useState(defaultShowtime.date)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>(readRecentBookings)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [connection, setConnection] = useState<ConnectionState>(tixoGateway.mode === 'demo' ? 'demo' : 'connecting')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const latestSeats = useRef<Seat[]>([])
  const inFlightSeats = useRef(new Set<string>())
  const selectedRef = useRef<string[]>([])
  const loadRequest = useRef(0)

  const setSelection = useCallback((update: (current: string[]) => string[]) => {
    const next = update(selectedRef.current)
    selectedRef.current = next
    setSelected(next)
  }, [])

  useEffect(() => { latestSeats.current = seats }, [seats])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('tixo-theme', theme) } catch { /* preference stays in memory */ }
  }, [theme])

  const pushToast = useCallback((title: string, detail: string, tone: ToastMessage['tone']) => {
    setToasts((current) => [...current, { id: createId(), title, detail, tone }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const updateSeat = useCallback((seat: Seat) => {
    setSeats((current) => {
      const exists = current.some((item) => item.schedule_id === seat.schedule_id && item.seat_number === seat.seat_number)
      return exists
        ? current.map((item) => item.schedule_id === seat.schedule_id && item.seat_number === seat.seat_number ? { ...item, ...seat } : item)
        : seat.schedule_id === activeShowtime.id ? [...current, seat] : current
    })
  }, [activeShowtime.id])

  const applyStatus = useCallback((seatNumber: string, status: SeatStatus) => {
    const current = latestSeats.current.find((seat) => seat.seat_number === seatNumber)
    if (!current || current.status === status) return
    updateSeat({ ...current, status, updated_at: new Date().toISOString() })
    if (status !== 'AVAILABLE' && selectedRef.current.includes(seatNumber) && !inFlightSeats.current.has(seatNumber)) {
      setSelection((selection) => selection.filter((number) => number !== seatNumber))
      pushToast('Kursi baru saja berubah', `${seatNumber} sedang dipesan orang lain. Pilih kursi yang masih tersedia.`, 'info')
    }
  }, [pushToast, setSelection, updateSeat])

  const loadSeats = useCallback(async (scheduleId = activeShowtime.id) => {
    const request = ++loadRequest.current
    setIsLoading(true)
    setLoadError('')
    try {
      const result = await tixoGateway.getSeats(scheduleId)
      if (request !== loadRequest.current) return
      setSeats(result)
      latestSeats.current = result
      setSelection(() => [])
    } catch (error) {
      if (request !== loadRequest.current) return
      const detail = error instanceof Error ? error.message : 'Periksa koneksi server dan coba lagi.'
      setLoadError(detail)
    } finally {
      if (request === loadRequest.current) setIsLoading(false)
    }
  }, [activeShowtime.id, setSelection])

  useEffect(() => {
    void loadSeats(activeShowtime.id)
    return tixoGateway.subscribe(activeShowtime.id, applyStatus, setConnection)
  }, [activeShowtime.id, applyStatus, loadSeats])

  useEffect(() => {
    if (tixoGateway.mode === 'grpc-web') {
      window.localStorage.setItem('tixo-recent-bookings', JSON.stringify(recentBookings))
    }
  }, [recentBookings])

  const chosenSeats = useMemo(
    () => seats.filter((seat) => seat.schedule_id === activeShowtime.id && selected.includes(seat.seat_number)),
    [activeShowtime.id, seats, selected],
  )
  const availability = seats.filter((seat) => seat.status === 'AVAILABLE').length
  const dayShowtimes = showtimes.filter((showtime) => showtime.date === activeDate)
  const filmMatches = `${movie.title} ${movie.edition}`.toLowerCase().includes(searchQuery.trim().toLowerCase())

  function toggleSeat(seat: Seat) {
    if (seat.status !== 'AVAILABLE') return
    setSelection((current) => current.includes(seat.seat_number)
      ? current.filter((number) => number !== seat.seat_number)
      : [...current, seat.seat_number])
  }

  function chooseShowtime(showtime: typeof defaultShowtime) {
    if (isSubmitting || isLoading || showtime.id === activeShowtime.id) return
    setActiveDate(showtime.date)
    selectedRef.current = []
    setSelected([])
    setSeats([])
    latestSeats.current = []
    setActiveShowtime(showtime)
  }

  function chooseDate(date: string) {
    if (isSubmitting || isLoading || date === activeDate) return
    const nextShowtime = showtimes.find((showtime) => showtime.date === date)
    if (nextShowtime) chooseShowtime(nextShowtime)
  }

  async function bookSelected() {
    if (!chosenSeats.length || isSubmitting) return
    setIsSubmitting(true)
    const targets = chosenSeats.map((seat) => ({ ...seat }))
    targets.forEach((seat) => inFlightSeats.current.add(seat.seat_number))
    targets.forEach((seat) => updateSeat({ ...seat, status: 'PENDING' }))

    const responses = await Promise.all(targets.map(async (seat) => {
      const transactionId = createId()
      try {
      const response = await tixoGateway.bookSeat(seat.schedule_id, seat.seat_number, userId, transactionId)
        if (response.seat) updateSeat(response.seat)
        else if (!response.success) updateSeat({ ...seat, status: 'AVAILABLE' })
        return { seat, ok: true as const, response }
      } catch (error) {
        return { seat, ok: false as const, error }
      }
    }))

    const booked: RecentBooking[] = []
    const rejected: string[] = []
    const rejectedSeats: string[] = []
    const uncertain = responses.filter((result) => !result.ok)
    for (const result of responses) {
      if (!result.ok) continue
      if (!result.response.success) {
        rejected.push(result.response.message)
        rejectedSeats.push(result.seat.seat_number)
        continue
      }
      const seat = result.response.seat || { ...result.seat, status: 'BOOKED' as const }
      updateSeat(seat)
      booked.push({ seat, transaction_id: result.response.transaction_id })
    }

    if (booked.length) {
      setRecentBookings((current) => [...booked, ...current.filter((item) => !booked.some((next) => next.seat.schedule_id === item.seat.schedule_id && next.seat.seat_number === item.seat.seat_number))])
      setSelection((current) => current.filter((number) => !booked.some((item) => item.seat.seat_number === number)))
    }
    if (rejected.length) {
      setSelection((current) => current.filter((number) => !rejectedSeats.includes(number)))
      pushToast('Kursi tidak dapat dipesan', rejected[0] || 'Kursi sudah tidak tersedia.', 'error')
    }
    if (uncertain.length) {
      await loadSeats()
      pushToast('Belum ada kepastian dari server', 'Denah kursi diperbarui. Periksa status kursi sebelum mencoba lagi.', 'error')
    }
    if (booked.length && !rejected.length && !uncertain.length) {
      pushToast('Pesanan tercatat', `${booked.map((item) => item.seat.seat_number).join(', ')} berhasil dipesan.`, 'success')
    }
    targets.forEach((seat) => inFlightSeats.current.delete(seat.seat_number))
    setIsSubmitting(false)
  }

  async function cancelBooking(booking: RecentBooking) {
    if (cancelling) return
    setCancelling(booking.seat.seat_number)
    try {
      const response = await tixoGateway.cancelSeat(booking.seat.schedule_id, booking.seat.seat_number, userId, booking.transaction_id)
      if (!response.success) {
        if (response.seat) updateSeat(response.seat)
        pushToast('Pesanan belum dibatalkan', response.message, 'error')
        return
      }
      if (response.seat) updateSeat(response.seat)
      setRecentBookings((current) => current.filter((item) => item.transaction_id !== booking.transaction_id))
      pushToast('Pesanan dibatalkan', response.message, 'success')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Coba lagi setelah koneksi kembali.'
      pushToast('Pembatalan belum terkonfirmasi', detail, 'error')
      void loadSeats()
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="site-shell min-h-dvh">
      <header className="masthead">
        <a className="wordmark" href="#main" aria-label="TIXO, ke pemilihan kursi"><span>tixo</span><i aria-hidden="true">.</i></a>
        <button className="location-button" type="button" onClick={() => pushToast('Lokasi yang tersedia', 'Katalog seed saat ini hanya memuat Studio 1 IMAX.', 'info')} aria-label="Lokasi bioskop: Studio 1 IMAX">
          <span className="location-pin" aria-hidden="true">⌖</span><span><small>BIOSKOP</small><strong>Studio 1 IMAX</strong></span><span className="location-chevron" aria-hidden="true">⌄</span>
        </button>
        <label className="movie-search"><span aria-hidden="true" className="search-icon">⌕</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari film" aria-label="Cari film" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian">×</button>}</label>
        <div className="masthead-tools">
          <button className="account-button" type="button" onClick={() => pushToast('Akun belum tersedia', 'Backend proyek ini belum menyediakan login atau akun pengguna.', 'info')}>Masuk</button>
          <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} aria-label={`Aktifkan tema ${theme === 'light' ? 'gelap' : 'terang'}`} title={`Tema ${theme === 'light' ? 'gelap' : 'terang'}`}>
            {theme === 'light' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
          </button>
          <div className={`sync-state sync-${connection}`} aria-live="polite"><i />{connectionCopy(connection)}</div>
        </div>
      </header>

      <main id="main" className="page-frame">
        {searchQuery && (
          <div className="search-feedback" role="status">
            {filmMatches ? <><span>HASIL KATALOG</span><button type="button" onClick={() => { document.getElementById('featured-film')?.scrollIntoView({ behavior: 'smooth' }); setSearchQuery('') }}>{movie.title} <small>· {movie.edition}</small></button></> : <span>Belum ada film lain di katalog lokal.</span>}
          </div>
        )}

        <section className="feature-hero" id="featured-film" aria-labelledby="film-title">
          <div className="feature-copy">
            <p className="film-kicker">SEDANG TAYANG <span>·</span> PEMUTARAN PILIHAN</p>
            <h1 id="film-title">{movie.title}<span>:</span></h1>
            <div className="feature-tags"><span>{movie.edition}</span><i /><span>Sci-fi · Drama</span><i /><span>Rating usia belum tersedia</span></div>
            <p className="film-synopsis">{filmSynopsis}</p>
            <a className="button button-red hero-cta" href="#schedule-filters">Lihat jadwal & pilih kursi</a>
          </div>
          <div className="hero-art" role="img" aria-label="Artwork tipografis Interstellar dengan horizon planet dan bintang">
            <span className="art-coordinate">STUDIO 1 / IMAX</span><span className="art-orbit" /><span className="art-horizon" />
            <span className="art-title">INTER<br />STELLAR</span><span className="art-edition">IMAX SPECIAL REMASTER</span>
          </div>
        </section>

        <section className="showtime-picker" id="schedule-filters" aria-labelledby="showtime-title">
          <div className="showtime-heading"><div><p className="section-index">PILIH WAKTU TAYANG</p><h2 id="showtime-title">Jadwal & lokasi</h2></div><span>Waktu Indonesia Barat</span></div>
          <div className="schedule-filter-row">
            <div className="date-filter" role="group" aria-label="Pilih tanggal">
              {showDays.map((date) => {
                const label = formatShowDay(date)
                return <button key={date} type="button" className={`date-option${date === activeDate ? ' is-active' : ''}`} aria-pressed={date === activeDate} disabled={isSubmitting || isLoading} onClick={() => chooseDate(date)}><small>{label.top}</small><strong>{label.bottom}</strong></button>
              })}
            </div>
            <div className="venue-filter"><small>BIOSKOP</small><strong>{movie.studio}</strong><span>· 1 studio tersedia</span></div>
          </div>
          <div className="showtime-options" role="group" aria-label="Pilih jadwal tayang">
            {dayShowtimes.map((showtime) => (
              <button key={showtime.id} type="button" aria-pressed={activeShowtime.id === showtime.id} disabled={isSubmitting || isLoading} className={`showtime-option${activeShowtime.id === showtime.id ? ' is-active' : ''}`} onClick={() => chooseShowtime(showtime)}>
                <span>{showtime.time.replace(' WIB', '')}</span><small>WIB</small>
              </button>
            ))}
          </div>
        </section>

        {loadError ? (
          <section className="load-state" role="alert">
            <span className="load-state-label">DENAH BELUM TERSEDIA</span>
            <h2>Studio belum bisa dihubungi.</h2>
            <p>{loadError}</p>
            <button type="button" className="button button-dark" onClick={() => void loadSeats()}>Muat ulang denah</button>
          </section>
        ) : (
          <div className="booking-layout">
            <div className="map-panel">
              {isLoading ? (
                <div className="loading-state" role="status"><span className="loading-ring" /><span>Mengambil status kursi dari jadwal ini…</span></div>
              ) : (
                <>
                  <div className="availability-line"><span>{availability} kursi tersedia</span><span>{syncDescription(connection)}</span></div>
                  <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />
                </>
              )}
            </div>

            <aside className="order-panel" aria-labelledby="order-title">
              <div className="order-header"><p>RINGKASAN</p><span>01 <i /> 02</span></div>
              <h2 id="order-title">Kursi pilihan</h2>
              <div className="checkout-film"><strong>{movie.title}</strong><span>{movie.studio} · {movie.edition}</span></div>
              {chosenSeats.length ? (
                <ul className="chosen-list" aria-label="Daftar kursi pilihan">
                  {chosenSeats.map((seat) => <li key={seat.id}><span className="ticket-notch" aria-hidden="true" />{seat.seat_number}<button type="button" onClick={() => toggleSeat(seat)} aria-label={`Hapus kursi ${seat.seat_number}`}>×</button></li>)}
                </ul>
              ) : (
                <p className="empty-selection">Pilih kursi di denah. Kursi yang kamu pilih akan muncul di sini.</p>
              )}
              <div className="order-rule" />
              <div className="order-count"><span>Jumlah tiket</span><strong>{chosenSeats.length.toString().padStart(2, '0')}</strong></div>
              <div className="order-context"><span>Jadwal</span><strong>{activeShowtime.time}</strong><small>{movie.studio}</small></div>
              <div className="order-price"><span>Total harga</span><strong>Belum tersedia</strong><small>Backend belum menyediakan data harga.</small></div>
              <fieldset className="payment-options" disabled aria-label="Metode pembayaran belum tersedia">
                <legend>Metode pembayaran <small>Belum aktif</small></legend>
                <div><label><input type="radio" name="payment" /> GoPay</label><label><input type="radio" name="payment" /> OVO</label><label><input type="radio" name="payment" /> QRIS</label><label><input type="radio" name="payment" /> Kartu</label></div>
              </fieldset>
              <button className="button button-red" type="button" disabled={!chosenSeats.length || isSubmitting || isLoading} onClick={() => void bookSelected()}>
                {isSubmitting ? <><span className="button-spinner" /> Memproses pilihan</> : <>Pesan {chosenSeats.length ? `${chosenSeats.length} kursi` : 'kursi'}</>}
              </button>
              <p className="order-footnote">Tombol ini memesan kursi. Pembayaran belum terhubung ke backend.</p>
            </aside>
          </div>
        )}

        {recentBookings.length > 0 && (
          <section className="my-bookings" aria-labelledby="my-bookings-title">
            <div className="my-bookings-heading"><div><p className="section-index">TRANSAKSI DI PERANGKAT INI</p><h2 id="my-bookings-title">Pesananmu</h2></div><span>{recentBookings.length} tiket</span></div>
            <ul>
              {recentBookings.map((booking) => (
                <li key={booking.transaction_id}>
                  <div className="booking-stamp" aria-hidden="true">{booking.seat.seat_number}</div>
                  <div className="booking-detail"><strong>{booking.seat.seat_number}</strong><span>ID transaksi {shortId(booking.transaction_id)}</span></div>
                  <button className="cancel-button" type="button" disabled={cancelling === booking.seat.seat_number} onClick={() => void cancelBooking(booking)}>
                    {cancelling === booking.seat.seat_number ? 'Memproses…' : 'Batalkan'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="page-footer"><span>TIXO <i>·</i> {movie.studio}</span><span>{tixoGateway.mode === 'demo' ? 'Mode pratinjau lokal' : `Jadwal ${activeShowtime.id}`}</span></footer>
      </main>
      <ToastViewport messages={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
