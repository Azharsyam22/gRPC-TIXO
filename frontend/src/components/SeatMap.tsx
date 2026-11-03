import type { Seat } from '../types'

interface SeatMapProps {
  seats: Seat[]
  selected: string[]
  studioName: string
  onToggle: (seat: Seat) => void
}

function SeatGlyph({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'seat-glyph seat-glyph-filled' : 'seat-glyph'}>
      <path d="M6 11.1V6.7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4.4" />
      <path d="M5.4 10.2h13.2a2 2 0 0 1 2 2v5.1H3.4v-5.1a2 2 0 0 1 2-2Z" />
      <path d="M5.7 17.3v2.1M18.3 17.3v2.1" />
    </svg>
  )
}

const statusLabels = {
  AVAILABLE: 'Tersedia',
  PENDING: 'Sedang diproses',
  BOOKED: 'Sudah dipesan',
} as const

export function SeatMap({ seats, selected, studioName, onToggle }: SeatMapProps) {
  const byNumber = new Map(seats.map((seat) => [seat.seat_number, seat]))

  return (
    <section className="seat-section" aria-labelledby="seat-map-title">
      <div className="section-heading">
        <div>
          <p className="section-index">DENAH STUDIO</p>
          <h2 id="seat-map-title">Pilih Kursi</h2>
        </div>
        <p className="section-side-note">50 kursi <span aria-hidden="true">·</span> {studioName}</p>
      </div>

      <div className="screen-area" aria-label="Arah pandang ke layar">
        <div className="screen-rule" />
        <span className="screen-caption">LAYAR</span>
      </div>

      <div className="map-scroll-region">
        <div className="seat-map" role="group" aria-label="Denah kursi studio, baris A sampai E">
          <div className="column-headings" aria-hidden="true">
            <span className="row-heading-spacer" />
            {Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          {['A', 'B', 'C', 'D', 'E'].map((row) => (
            <div className="seat-row" key={row}>
              <span className="row-letter" aria-hidden="true">{row}</span>
              {Array.from({ length: 10 }, (_, index) => {
                const seatNumber = `${row}${index + 1}`
                const seat = byNumber.get(seatNumber)
                if (!seat) return <span className="seat-missing" key={seatNumber} aria-hidden="true" />
                const isSelected = selected.includes(seat.seat_number)
                const disabled = seat.status !== 'AVAILABLE'
                return (
                  <button
                    className={`seat-button seat-${seat.status.toLowerCase()}${isSelected ? ' is-selected' : ''}${index === 4 ? ' aisle-end' : ''}`}
                    key={seat.id}
                    type="button"
                    onClick={() => onToggle(seat)}
                    disabled={disabled}
                    aria-label={`Kursi ${seat.seat_number}, ${isSelected ? 'pilihanmu' : statusLabels[seat.status]}`}
                    aria-pressed={isSelected}
                    title={`${seat.seat_number} · ${statusLabels[seat.status]}`}
                  >
                    <SeatGlyph filled={isSelected || seat.status === 'BOOKED'} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="seat-legend" aria-label="Keterangan status kursi">
        <span><i className="legend-swatch available" /> Tersedia</span>
        <span><i className="legend-swatch pending" /> Diproses</span>
        <span><i className="legend-swatch booked" /> Dipesan</span>
        <span><i className="legend-swatch chosen" /> Pilihanmu</span>
      </div>
      <p className="map-guidance">Ketuk kursi hijau untuk menambahkan ke pilihan.</p>
    </section>
  )
}
