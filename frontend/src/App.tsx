import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SeatMap } from './components/SeatMap'
import { ToastViewport } from './components/ToastViewport'
import { createId, tixoGateway, userId } from './services/tixoGateway'
import { defaultShowtime, getPricingForDate, movieList, showtimes, type MovieItem } from './showtimes'
import type { ConnectionState, RecentBooking, Seat, SeatStatus, ToastMessage, UserProfile } from './types'

type Theme = 'light' | 'dark'

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

function readCurrentUser(): UserProfile | null {
  try {
    const raw = window.localStorage.getItem('tixo-user')
    return raw ? JSON.parse(raw) as UserProfile : null
  } catch {
    return null
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

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function App() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [activeMovie, setActiveMovie] = useState<MovieItem>(movieList[0]!)
  const [activeShowtime, setActiveShowtime] = useState(defaultShowtime)
  const [activeDate, setActiveDate] = useState(defaultShowtime.date)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(readCurrentUser)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [gmailInput, setGmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
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

  // Filter jadwal berdasarkan film yang sedang aktif
  const movieShowtimes = useMemo(
    () => showtimes.filter((s) => s.movieId === activeMovie.id),
    [activeMovie.id],
  )

  const availableDays = useMemo(
    () => [...new Set(movieShowtimes.map((s) => s.date))],
    [movieShowtimes],
  )

  const dayShowtimes = useMemo(
    () => movieShowtimes.filter((s) => s.date === activeDate),
    [movieShowtimes, activeDate],
  )

  // Hitung harga dinamis: Hari biasa Rp 40.000 / Weekend Rp 45.000
  const pricing = useMemo(
    () => getPricingForDate(activeShowtime.date),
    [activeShowtime.date],
  )

  const pricePerTicket = pricing.price
  const totalPrice = selected.length * pricePerTicket

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

  function toggleSeat(seat: Seat) {
    if (seat.status !== 'AVAILABLE') return
    setSelection((current) => current.includes(seat.seat_number)
      ? current.filter((number) => number !== seat.seat_number)
      : [...current, seat.seat_number])
  }

  function chooseMovie(movie: MovieItem) {
    if (isSubmitting || isLoading || movie.id === activeMovie.id) return
    setActiveMovie(movie)
    const firstSchedule = showtimes.find((s) => s.movieId === movie.id)
    if (firstSchedule) {
      setActiveDate(firstSchedule.date)
      selectedRef.current = []
      setSelected([])
      setSeats([])
      latestSeats.current = []
      setActiveShowtime(firstSchedule)
    }
  }

  function chooseShowtime(showtime: (typeof showtimes)[0]) {
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
    const nextShowtime = movieShowtimes.find((showtime) => showtime.date === date)
    if (nextShowtime) chooseShowtime(nextShowtime)
  }

  function handleLoginSubmit(email: string, name: string) {
    if (!email || !name) {
      pushToast('Data tidak lengkap', 'Silakan masukkan email Gmail dan nama.', 'error')
      return
    }
    const user: UserProfile = {
      id: `usr-${createId().slice(0, 8)}`,
      email,
      name,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    }
    setCurrentUser(user)
    try { window.localStorage.setItem('tixo-user', JSON.stringify(user)) } catch { /* ignore */ }
    setShowLoginModal(false)
    pushToast('Berhasil Masuk', `Selamat datang di TIXO, ${name}!`, 'success')
  }

  function handleLogout() {
    setCurrentUser(null)
    try { window.localStorage.removeItem('tixo-user') } catch { /* ignore */ }
    pushToast('Keluar', 'Kamu telah keluar dari akun.', 'info')
  }

  async function bookSelected() {
    if (!chosenSeats.length || isSubmitting) return
    setIsSubmitting(true)
    const targets = chosenSeats.map((seat) => ({ ...seat }))
    targets.forEach((seat) => inFlightSeats.current.add(seat.seat_number))
    targets.forEach((seat) => updateSeat({ ...seat, status: 'PENDING' }))

    const buyerId = currentUser ? currentUser.id : userId

    const responses = await Promise.all(targets.map(async (seat) => {
      const transactionId = createId()
      try {
        const response = await tixoGateway.bookSeat(seat.schedule_id, seat.seat_number, buyerId, transactionId)
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
      booked.push({ seat, transaction_id: result.response.transaction_id, price: pricePerTicket })
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
      pushToast('Pesanan berhasil', `${booked.map((item) => item.seat.seat_number).join(', ')} berhasil dipesan (Total: Rp ${totalPrice.toLocaleString('id-ID')}).`, 'success')
    }
    targets.forEach((seat) => inFlightSeats.current.delete(seat.seat_number))
    setIsSubmitting(false)
  }

  async function cancelBooking(booking: RecentBooking) {
    if (cancelling) return
    setCancelling(booking.seat.seat_number)
    const buyerId = currentUser ? currentUser.id : userId
    try {
      const response = await tixoGateway.cancelSeat(booking.seat.schedule_id, booking.seat.seat_number, buyerId, booking.transaction_id)
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
        <button className="location-button" type="button" onClick={() => pushToast('Lokasi studio', `${activeMovie.studio} aktif untuk ${activeMovie.title}.`, 'info')} aria-label={`Lokasi bioskop: ${activeMovie.studio}`}>
          <span className="location-pin" aria-hidden="true">⌖</span><span><small>BIOSKOP</small><strong>{activeMovie.studio}</strong></span><span className="location-chevron" aria-hidden="true">⌄</span>
        </button>
        <label className="movie-search"><span aria-hidden="true" className="search-icon">⌕</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari film..." aria-label="Cari film" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian">×</button>}</label>
        <div className="masthead-tools">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[var(--paper-light)] border border-[var(--line)] px-2.5 py-1 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
              <span className="font-semibold">{currentUser.name.split(' ')[0]}</span>
              <button type="button" onClick={handleLogout} className="text-[var(--ink-soft)] hover:text-[var(--red)] ml-1 text-[11px]" title="Keluar">Keluar</button>
            </div>
          ) : (
            <button className="account-button flex items-center gap-1.5" type="button" onClick={() => setShowLoginModal(true)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.5.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
              </svg>
              <span>Masuk via Gmail</span>
            </button>
          )}
          <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} aria-label={`Aktifkan tema ${theme === 'light' ? 'gelap' : 'terang'}`} title={`Tema ${theme === 'light' ? 'gelap' : 'terang'}`}>
            {theme === 'light' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
          </button>
          <div className={`sync-state sync-${connection}`} aria-live="polite"><i />{connectionCopy(connection)}</div>
        </div>
      </header>

      <main id="main" className="page-frame">
        {/* Katalog Pemilihan Film */}
        <section className="mb-6 pt-3" aria-label="Pilih Film">
          <p className="text-[10px] tracking-wider font-bold text-[var(--ink-soft)] uppercase mb-2">PILIH FILM YANG INGIN DITONTON</p>
          <div className="flex flex-wrap gap-2">
            {movieList.map((m) => {
              const isSelected = m.id === activeMovie.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => chooseMovie(m)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--paper-light)] border-[var(--ink)] shadow-sm'
                      : 'bg-[var(--paper-light)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--ink-soft)]'
                  }`}
                >
                  <strong className="block">{m.title}</strong>
                  <span className="text-[10px] opacity-75">{m.edition}</span>
                </button>
              )
            })}
          </div>
        </section>

        {searchQuery && (
          <div className="search-feedback" role="status">
            <span>Pencarian: "{searchQuery}"</span>
            <button type="button" onClick={() => setSearchQuery('')}>Hapus</button>
          </div>
        )}

        <section className="feature-hero" id="featured-film" aria-labelledby="film-title">
          <div className="feature-copy">
            <p className="film-kicker">SEDANG TAYANG <span>·</span> {activeMovie.studio}</p>
            <h1 id="film-title">{activeMovie.title}<span>:</span></h1>
            <div className="feature-tags">
              <span>{activeMovie.edition}</span>
              <i />
              <span>{activeMovie.genre}</span>
              <i />
              <span>Rating {activeMovie.rating}</span>
            </div>
            <p className="film-synopsis">{activeMovie.synopsis}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${pricing.isWeekend ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                {pricing.isWeekend ? 'Akhir Pekan: Rp 45.000' : 'Hari Biasa: Rp 40.000'}
              </span>
              <a className="button button-red hero-cta !mt-0 !w-auto" href="#schedule-filters">Pilih Waktu & Kursi</a>
            </div>
          </div>
          <div className="hero-art" role="img" aria-label={`Poster ${activeMovie.title}`}>
            <span className="art-coordinate">{activeMovie.studio}</span>
            <span className="art-orbit" />
            <span className="art-horizon" />
            <span className="art-title">{activeMovie.title.slice(0, 12).toUpperCase()}</span>
            <span className="art-edition">{activeMovie.edition}</span>
          </div>
        </section>

        <section className="showtime-picker" id="schedule-filters" aria-labelledby="showtime-title">
          <div className="showtime-heading">
            <div>
              <p className="section-index">PILIH WAKTU TAYANG</p>
              <h2 id="showtime-title">Jadwal & Tarif</h2>
            </div>
            <div className="text-right">
              <span className="block text-xs font-semibold text-[var(--ink)]">
                {pricing.isWeekend ? 'Rp 45.000 (Sabtu & Minggu)' : 'Rp 40.000 (Senin - Jumat)'}
              </span>
              <span className="text-[10px] text-[var(--ink-soft)]">Waktu Indonesia Barat</span>
            </div>
          </div>
          <div className="schedule-filter-row">
            <div className="date-filter" role="group" aria-label="Pilih tanggal">
              {availableDays.map((date) => {
                const label = formatShowDay(date)
                const isSelected = date === activeDate
                const datePrice = getPricingForDate(date)
                return (
                  <button
                    key={date}
                    type="button"
                    className={`date-option${isSelected ? ' is-active' : ''}`}
                    aria-pressed={isSelected}
                    disabled={isSubmitting || isLoading}
                    onClick={() => chooseDate(date)}
                  >
                    <small>{label.top}</small>
                    <strong>{label.bottom}</strong>
                    <span className="text-[8px] opacity-80 mt-0.5">{datePrice.isWeekend ? 'Rp 45rb' : 'Rp 40rb'}</span>
                  </button>
                )
              })}
            </div>
            <div className="venue-filter">
              <small>STUDIO PILIHAN</small>
              <strong>{activeMovie.studio}</strong>
              <span>· {dayShowtimes.length} jam tayang tersedia</span>
            </div>
          </div>
          <div className="showtime-options" role="group" aria-label="Pilih jadwal tayang">
            {dayShowtimes.map((showtime) => (
              <button
                key={showtime.id}
                type="button"
                aria-pressed={activeShowtime.id === showtime.id}
                disabled={isSubmitting || isLoading}
                className={`showtime-option${activeShowtime.id === showtime.id ? ' is-active' : ''}`}
                onClick={() => chooseShowtime(showtime)}
              >
                <span>{showtime.time.replace(' WIB', '')}</span>
                <small>WIB</small>
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
                  <div className="availability-line">
                    <span>{availability} kursi tersedia</span>
                    <span className="text-xs bg-[var(--paper-light)] px-2 py-0.5 rounded border border-[var(--line)]">
                      {pricing.isWeekend ? 'Tarif Weekend: Rp 45.000 / tiket' : 'Tarif Weekday: Rp 40.000 / tiket'}
                    </span>
                  </div>
                  <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />
                </>
              )}
            </div>

            <aside className="order-panel" aria-labelledby="order-title">
              <div className="order-header"><p>RINGKASAN PEMESANAN</p><span>01 <i /> 02</span></div>
              <h2 id="order-title">Kursi Pilihan</h2>
              <div className="checkout-film">
                <strong>{activeMovie.title}</strong>
                <span>{activeMovie.studio} · {activeMovie.edition}</span>
              </div>
              {chosenSeats.length ? (
                <ul className="chosen-list" aria-label="Daftar kursi pilihan">
                  {chosenSeats.map((seat) => (
                    <li key={seat.id}>
                      <span className="ticket-notch" aria-hidden="true" />
                      {seat.seat_number}
                      <button type="button" onClick={() => toggleSeat(seat)} aria-label={`Hapus kursi ${seat.seat_number}`}>×</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-selection">Pilih satu atau beberapa kursi pada denah. Kamu bisa memilih banyak kursi sekaligus.</p>
              )}
              <div className="order-rule" />
              <div className="order-count">
                <span>Jumlah tiket</span>
                <strong>{chosenSeats.length.toString().padStart(2, '0')}</strong>
              </div>
              <div className="order-context">
                <span>Jadwal</span>
                <strong>{activeShowtime.time}</strong>
                <small>{activeShowtime.date} ({pricing.isWeekend ? 'Akhir Pekan' : 'Hari Kerja'})</small>
              </div>
              <div className="order-price">
                <span>Tarif per tiket</span>
                <strong>Rp {pricePerTicket.toLocaleString('id-ID')}</strong>
                <small>{pricing.isWeekend ? 'Termasuk biaya akhir pekan (+Rp 5.000)' : 'Tarif standar hari biasa'}</small>
              </div>
              <div className="order-price !border-t-2 !pt-3">
                <span className="font-bold text-sm">Total Bayar</span>
                <strong className="text-lg text-[var(--red)]">Rp {totalPrice.toLocaleString('id-ID')}</strong>
                <small>{chosenSeats.length > 0 ? `${chosenSeats.length} kursi × Rp ${pricePerTicket.toLocaleString('id-ID')}` : 'Belum ada kursi yang dipilih'}</small>
              </div>
              <fieldset className="payment-options" aria-label="Metode pembayaran">
                <legend>Metode pembayaran</legend>
                <div>
                  <label><input type="radio" name="payment" defaultChecked /> QRIS</label>
                  <label><input type="radio" name="payment" /> GoPay</label>
                  <label><input type="radio" name="payment" /> OVO</label>
                  <label><input type="radio" name="payment" /> Virtual Account</label>
                </div>
              </fieldset>
              <button
                className="button button-red"
                type="button"
                disabled={!chosenSeats.length || isSubmitting || isLoading}
                onClick={() => void bookSelected()}
              >
                {isSubmitting ? (
                  <><span className="button-spinner" /> Memproses pesanan…</>
                ) : (
                  <>Pesan {chosenSeats.length ? `${chosenSeats.length} kursi · Rp ${totalPrice.toLocaleString('id-ID')}` : 'kursi'}</>
                )}
              </button>
              <p className="order-footnote">
                {currentUser ? `Memesan atas nama: ${currentUser.email}` : 'Tips: Masuk via Gmail di atas untuk menyimpan riwayat pesanan.'}
              </p>
            </aside>
          </div>
        )}

        {recentBookings.length > 0 && (
          <section className="my-bookings" aria-labelledby="my-bookings-title">
            <div className="my-bookings-heading">
              <div>
                <p className="section-index">TRANSAKSI DI PERANGKAT INI</p>
                <h2 id="my-bookings-title">Pesananmu</h2>
              </div>
              <span>{recentBookings.length} tiket</span>
            </div>
            <ul>
              {recentBookings.map((booking) => (
                <li key={booking.transaction_id}>
                  <div className="booking-stamp" aria-hidden="true">{booking.seat.seat_number}</div>
                  <div className="booking-detail">
                    <strong>Kursi {booking.seat.seat_number}</strong>
                    <span>ID transaksi {shortId(booking.transaction_id)} · Rp {(booking.price || 40000).toLocaleString('id-ID')}</span>
                  </div>
                  <button className="cancel-button" type="button" disabled={cancelling === booking.seat.seat_number} onClick={() => void cancelBooking(booking)}>
                    {cancelling === booking.seat.seat_number ? 'Memproses…' : 'Batalkan'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="page-footer">
          <span>TIXO <i>·</i> {activeMovie.title} ({activeMovie.studio})</span>
          <span>{tixoGateway.mode === 'demo' ? 'Mode pratinjau lokal' : `Jadwal ${activeShowtime.id}`}</span>
        </footer>
      </main>

      {/* Modal Sign In with Google / Gmail */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--paper-light)] border border-[var(--line)] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-[var(--ink)]">Masuk dengan Akun Google</h3>
              <button type="button" onClick={() => setShowLoginModal(false)} className="text-xl leading-none text-[var(--ink-soft)] hover:text-[var(--ink)]">×</button>
            </div>
            <p className="text-xs text-[var(--ink-soft)] mb-5">
              Hubungkan akun Gmail kamu untuk mempermudah identifikasi tiket dan riwayat transaksi di TIXO.
            </p>

            {/* Quick Demo Login Option */}
            <div className="mb-4 space-y-2">
              <button
                type="button"
                onClick={() => handleLoginSubmit('azharsyam22@gmail.com', 'Muhammad Azharuddiya')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] hover:border-[var(--ink-soft)] text-xs font-semibold text-[var(--ink)] transition-all"
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.5.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
                </svg>
                Masuk sebagai Azhar (azharsyam22@gmail.com)
              </button>

              <button
                type="button"
                onClick={() => handleLoginSubmit('fajar@student.unsil.ac.id', 'Fajar Rizky Mulyana')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] hover:border-[var(--ink-soft)] text-xs font-semibold text-[var(--ink)] transition-all"
              >
                Masuk sebagai Fajar (fajar@student.unsil.ac.id)
              </button>
            </div>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--line)]" /></div>
              <span className="relative bg-[var(--paper-light)] px-2 text-[10px] text-[var(--ink-soft)] uppercase font-medium">atau ketik manual</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleLoginSubmit(gmailInput, nameInput)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Contoh: Azhar Ramadhan"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">Alamat Gmail</label>
                <input
                  type="email"
                  required
                  value={gmailInput}
                  onChange={(e) => setGmailInput(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>
              <button type="submit" className="button button-red w-full !py-2.5 text-xs font-bold !mt-4">
                Masuk ke TIXO
              </button>
            </form>
          </div>
        </div>
      )}

      <ToastViewport messages={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
