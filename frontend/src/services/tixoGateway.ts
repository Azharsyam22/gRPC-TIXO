import * as grpcWeb from 'grpc-web'
import protobuf from 'protobufjs'
import schemaText from '../../../proto/tixo.proto?raw'
import type {
  BatchBookingResponse,
  BookingResponse,
  CancellationResponse,
  ConnectionState,
  SeatSnapshot,
  Seat,
  SeatStatus,
  SignInResponse,
} from '../types'
import { getPricingForDate, movieList, moviePresentationOverrides, showtimes, type MovieItem, type Showtime } from '../showtimes'

const mode = import.meta.env.VITE_TIXO_MODE === 'grpc-web' ? 'grpc-web' : 'demo'
const host = (import.meta.env.VITE_TIXO_GRPC_WEB_URL || 'http://localhost:8080').replace(/\/$/, '')

// Keep the protobuf field names aligned with the shared proto contract.
// The backend and wire types use snake_case (for example schedule_id), while
// protobufjs defaults to converting those names to camelCase during parsing.
const root = protobuf.parse(schemaText, new protobuf.Root(), { keepCase: true }).root
const statusByNumber: Record<number, SeatStatus> = {
  0: 'AVAILABLE',
  1: 'PENDING',
  2: 'BOOKED',
}

type Codec<T> = {
  encode(value: T): Uint8Array
  decode(bytes: Uint8Array): T
  constructor: new (...args: unknown[]) => T
}

type WireRequest = Record<string, unknown>

function messageCodec<T>(name: string): Codec<T> {
  const type = root.lookupType(`tixo.${name}`)
  class WireMessage {
    constructor(properties?: Record<string, unknown>) {
      if (properties) Object.assign(this, properties)
    }
  }

  return {
    constructor: WireMessage as unknown as new (...args: unknown[]) => T,
    encode: (value) => type.encode(value as Record<string, unknown>).finish(),
    decode: (bytes) => type.toObject(type.decode(bytes), {
      defaults: true,
      enums: Number,
      longs: String,
    }) as T,
  }
}

function descriptor<Request, Response>(
  path: string,
  requestCodec: Codec<Request>,
  responseCodec: Codec<Response>,
  streaming = false,
): grpcWeb.MethodDescriptor<Request, Response> {
  return new grpcWeb.MethodDescriptor(
    path,
    streaming ? grpcWeb.MethodType.SERVER_STREAMING : grpcWeb.MethodType.UNARY,
    requestCodec.constructor,
    responseCodec.constructor,
    requestCodec.encode,
    responseCodec.decode,
  )
}

interface WireSeat {
  id?: string
  schedule_id?: string
  seat_number?: string
  status?: number
  updated_at?: string
}

interface WireSeatList {
  schedule_id?: string
  seats?: WireSeat[]
  schedule?: WireSchedule
}

interface WireMovie {
  id?: string
  title?: string
  edition?: string
  genre?: string
  duration_minutes?: number
  poster_url?: string
  synopsis?: string
  rating?: string
  default_studio?: string
}

interface WireMovieList {
  movies?: WireMovie[]
}

interface WireSchedule {
  id?: string
  movie_id?: string
  movie_name?: string
  studio_name?: string
  start_time?: string
  date_formatted?: string
  time_formatted?: string
  base_price?: number
  ticket_price?: number
  is_weekend?: boolean
}

interface WireScheduleList {
  schedules?: WireSchedule[]
}

interface WireBookingResponse {
  success?: boolean
  message?: string
  seat?: WireSeat
  transaction_id?: string
}

interface WireStreamUpdate {
  schedule_id?: string
  seat_number?: string
  status?: number
  timestamp?: string
}

interface WireCancellationResponse {
  success?: boolean
  message?: string
  seat?: WireSeat
}

interface WireBatchBookingResponse {
  success?: boolean
  message?: string
  seats?: WireSeat[]
  total_price?: number
  price_per_ticket?: number
  transaction_id?: string
}

interface WireSignInResponse {
  success?: boolean
  message?: string
  user?: { id?: string; email?: string; name?: string; avatar_url?: string }
  session_token?: string
}

const getSeatsMethod = descriptor<WireRequest, WireSeatList>(
  '/tixo.TixoService/GetDaftarKursi',
  messageCodec('GetDaftarKursiRequest'),
  messageCodec('GetDaftarKursiResponse'),
)
const getMoviesMethod = descriptor<WireRequest, WireMovieList>(
  '/tixo.TixoService/GetKatalogFilm',
  messageCodec('GetKatalogFilmRequest'),
  messageCodec('GetKatalogFilmResponse'),
)
const getSchedulesMethod = descriptor<WireRequest, WireScheduleList>(
  '/tixo.TixoService/GetDaftarJadwal',
  messageCodec('GetDaftarJadwalRequest'),
  messageCodec('GetDaftarJadwalResponse'),
)
const bookMethod = descriptor<WireRequest, WireBookingResponse>(
  '/tixo.TixoService/PesanKursi',
  messageCodec('PesanKursiRequest'),
  messageCodec('PesanKursiResponse'),
)
const batchBookMethod = descriptor<WireRequest, WireBatchBookingResponse>(
  '/tixo.TixoService/PesanBanyakKursi',
  messageCodec('PesanBanyakKursiRequest'),
  messageCodec('PesanBanyakKursiResponse'),
)
const cancelMethod = descriptor<WireRequest, WireCancellationResponse>(
  '/tixo.TixoService/BatalPesanan',
  messageCodec('BatalPesananRequest'),
  messageCodec('BatalPesananResponse'),
)
const signInMethod = descriptor<WireRequest, WireSignInResponse>(
  '/tixo.TixoService/SignInWithGoogle',
  messageCodec('GoogleSignInRequest'),
  messageCodec('GoogleSignInResponse'),
)
const streamMethod = descriptor<WireRequest, WireStreamUpdate>(
  '/tixo.TixoService/PantauStatusKursi',
  messageCodec('PantauStatusRequest'),
  messageCodec('StatusKursiUpdate'),
  true,
)

const client = new grpcWeb.GrpcWebClientBase({ format: 'text' })

function toSeat(seat: WireSeat, fallbackScheduleId: string): Seat {
  return {
    id: seat.id || `${seat.schedule_id || fallbackScheduleId}-${seat.seat_number || ''}`,
    schedule_id: seat.schedule_id || fallbackScheduleId,
    seat_number: seat.seat_number || '',
    status: statusByNumber[Number(seat.status)] || 'PENDING',
    updated_at: seat.updated_at || new Date().toISOString(),
  }
}

function toMovie(movie: WireMovie): MovieItem {
  const mapped: MovieItem = {
    id: movie.id || '',
    title: movie.title || 'Film tanpa judul',
    edition: movie.edition || 'Standard',
    genre: movie.genre || '',
    durationMinutes: Number(movie.duration_minutes) || undefined,
    posterUrl: movie.poster_url || undefined,
    synopsis: movie.synopsis || '',
    rating: movie.rating || 'Belum tersedia',
    studio: movie.default_studio || '',
  }
  return { ...mapped, ...moviePresentationOverrides[mapped.id] }
}

function toShowtime(schedule: WireSchedule): Showtime {
  const startTime = schedule.start_time || ''
  const date = startTime.slice(0, 10)
  const rawTime = startTime.slice(11, 16)
  const formattedTime = schedule.time_formatted || `${rawTime.slice(0, 2)}.${rawTime.slice(3, 5)} WIB`
  return {
    id: schedule.id || '',
    movieId: schedule.movie_id || '',
    movieName: schedule.movie_name || '',
    studio: schedule.studio_name || '',
    date,
    time: formattedTime,
    basePrice: Number(schedule.base_price) || 40000,
    ticketPrice: Number(schedule.ticket_price) || 40000,
    isWeekend: Boolean(schedule.is_weekend),
  }
}

function unary<Request, Response>(
  path: string,
  method: grpcWeb.MethodDescriptor<Request, Response>,
  request: Request,
): Promise<Response> {
  const deadline = String(Date.now() + 3000)
  return new Promise((resolve, reject) => {
    client.rpcCall(`${host}${path}`, request, { deadline }, method, (error, response) => {
      if (error) reject(error)
      else resolve(response)
    })
  })
}

function pause(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function withNetworkRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const retryable = error instanceof grpcWeb.RpcError && [
        grpcWeb.StatusCode.UNAVAILABLE,
        grpcWeb.StatusCode.DEADLINE_EXCEEDED,
      ].includes(error.code)
      if (!retryable || attempt === 2) break
      await pause(250 * (2 ** attempt))
    }
  }
  throw lastError
}

export interface TixoGateway {
  readonly mode: 'demo' | 'grpc-web'
  getMovies(): Promise<MovieItem[]>
  getSchedules(movieId?: string): Promise<Showtime[]>
  getSeats(scheduleId: string): Promise<SeatSnapshot>
  bookSeat(scheduleId: string, seatNumber: string, userId: string, transactionId: string): Promise<BookingResponse>
  bookSeats(
    scheduleId: string,
    seatNumbers: string[],
    userId: string,
    userEmail: string,
    transactionId: string,
  ): Promise<BatchBookingResponse>
  cancelSeat(scheduleId: string, seatNumber: string, userId: string, transactionId: string): Promise<CancellationResponse>
  signInWithGoogle(idToken: string, email: string, name: string): Promise<SignInResponse>
  subscribe(
    scheduleId: string,
    onUpdate: (seatNumber: string, status: SeatStatus) => void,
    onConnection: (state: ConnectionState) => void,
  ): () => void
}

const seatNames = ['A', 'B', 'C', 'D', 'E'].flatMap((row) =>
  Array.from({ length: 10 }, (_, index) => `${row}${index + 1}`),
)

function createDemoGateway(): TixoGateway {
  const demoSeats = new Map<string, Seat[]>()
  const listeners = new Map<string, Set<(seatNumber: string, status: SeatStatus) => void>>()

  function getDemoSeats(scheduleId: string) {
    if (!demoSeats.has(scheduleId)) {
      demoSeats.set(scheduleId, seatNames.map((seatNumber) => ({
        id: `${scheduleId}-${seatNumber}`,
        schedule_id: scheduleId,
        seat_number: seatNumber,
        status: 'AVAILABLE' as SeatStatus,
        updated_at: new Date().toISOString(),
      })))
    }
    return demoSeats.get(scheduleId)!
  }

  function emit(scheduleId: string, seatNumber: string, status: SeatStatus) {
    listeners.get(scheduleId)?.forEach((listener) => listener(seatNumber, status))
  }

  return {
    mode: 'demo',
    async getMovies() {
      await pause(90)
      return movieList.map((movie) => ({ ...movie }))
    },
    async getSchedules(movieId) {
      await pause(90)
      return showtimes
        .filter((showtime) => !movieId || showtime.movieId === movieId)
        .map((showtime) => {
          const movie = movieList.find((item) => item.id === showtime.movieId)
          const pricing = getPricingForDate(showtime.date)
          return {
            ...showtime,
            studio: showtime.studio || movie?.studio || '',
            basePrice: 40000,
            ticketPrice: pricing.price,
            isWeekend: pricing.isWeekend,
          }
        })
    },
    async getSeats(scheduleId) {
      await pause(180)
      const showtime = showtimes.find((item) => item.id === scheduleId)
      const movie = movieList.find((item) => item.id === showtime?.movieId)
      const pricing = showtime ? getPricingForDate(showtime.date) : { price: 40000, isWeekend: false }
      return {
        seats: getDemoSeats(scheduleId).map((seat) => ({ ...seat })),
        schedule: showtime ? {
          ...showtime,
          studio: showtime.studio || movie?.studio || '',
          basePrice: 40000,
          ticketPrice: pricing.price,
          isWeekend: pricing.isWeekend,
        } : undefined,
      }
    },
    async bookSeat(scheduleId, seatNumber, _userId, transactionId) {
      await pause(250)
      const seat = getDemoSeats(scheduleId).find((item) => item.seat_number === seatNumber)
      if (!seat || seat.status !== 'AVAILABLE') {
        return {
          success: false,
          message: `Kursi ${seatNumber} sudah dipesan atau sedang diproses.`,
          seat: seat ? { ...seat } : undefined,
          transaction_id: transactionId,
        }
      }
      seat.status = 'PENDING'
      emit(scheduleId, seatNumber, seat.status)
      await pause(650)
      seat.status = 'BOOKED'
      seat.updated_at = new Date().toISOString()
      emit(scheduleId, seatNumber, seat.status)
      return {
        success: true,
        message: `Kursi ${seatNumber} berhasil dipesan.`,
        seat: { ...seat },
        transaction_id: transactionId,
      }
    },
    async bookSeats(scheduleId, seatNumbers, _userId, _userEmail, transactionId) {
      await pause(220)
      const schedule = showtimes.find((item) => item.id === scheduleId)
      const pricePerTicket = schedule ? getPricingForDate(schedule.date).price : 40000
      const scheduleSeats = getDemoSeats(scheduleId)
      const targets = [...new Set(seatNumbers)].map((number) => scheduleSeats.find((seat) => seat.seat_number === number))
      const missingSeat = targets.some((seat) => !seat)
      const unavailableSeats = targets.filter((seat): seat is Seat => Boolean(seat && seat.status !== 'AVAILABLE'))
      if (missingSeat || unavailableSeats.length) {
        return {
          success: false,
          message: unavailableSeats.length
            ? `Kursi ${unavailableSeats.map((seat) => seat.seat_number).join(', ')} tidak lagi tersedia.`
            : 'Satu atau beberapa kursi tidak ditemukan.',
          seats: targets.filter((seat): seat is Seat => Boolean(seat)).map((seat) => ({ ...seat })),
          total_price: 0,
          price_per_ticket: pricePerTicket,
          transaction_id: transactionId,
        }
      }

      const bookedSeats = targets.filter((seat): seat is Seat => Boolean(seat))
      bookedSeats.forEach((seat) => {
        seat.status = 'PENDING'
        emit(scheduleId, seat.seat_number, seat.status)
      })
      await pause(450)
      bookedSeats.forEach((seat) => {
        seat.status = 'BOOKED'
        seat.updated_at = new Date().toISOString()
        emit(scheduleId, seat.seat_number, seat.status)
      })
      return {
        success: true,
        message: `Berhasil memesan ${bookedSeats.length} kursi.`,
        seats: bookedSeats.map((seat) => ({ ...seat })),
        total_price: bookedSeats.length * pricePerTicket,
        price_per_ticket: pricePerTicket,
        transaction_id: transactionId,
      }
    },
    async cancelSeat(scheduleId, seatNumber, _userId, transactionId) {
      await pause(250)
      const seat = getDemoSeats(scheduleId).find((item) => item.seat_number === seatNumber)
      if (!seat || seat.status !== 'BOOKED') {
        return { success: false, message: `Pesanan ${seatNumber} tidak dapat dibatalkan.` }
      }
      seat.status = 'AVAILABLE'
      seat.updated_at = new Date().toISOString()
      emit(scheduleId, seatNumber, seat.status)
      void transactionId
      return { success: true, message: `Pesanan ${seatNumber} dibatalkan.`, seat: { ...seat } }
    },
    subscribe(scheduleId, onUpdate, onConnection) {
      const scheduleListeners = listeners.get(scheduleId) || new Set()
      scheduleListeners.add(onUpdate)
      listeners.set(scheduleId, scheduleListeners)
      onConnection('demo')
      return () => scheduleListeners.delete(onUpdate)
    },
    async signInWithGoogle(_idToken, email, name) {
      await pause(120)
      if (!email || !name) return { success: false, message: 'Email dan nama harus diisi.' }
      return {
        success: true,
        message: 'Profil pratinjau lokal siap digunakan.',
        user: {
          id: `usr-demo-${createId().slice(0, 8)}`,
          email,
          name,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        },
      }
    },
  }
}

function createGrpcWebGateway(): TixoGateway {
  const clientId = getStoredId('tixo-client-id')

  return {
    mode: 'grpc-web',
    async getMovies() {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/GetKatalogFilm',
        getMoviesMethod,
        {},
      ))
      return (response.movies || []).map(toMovie).filter((movie) => movie.id)
    },
    async getSchedules(movieId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/GetDaftarJadwal',
        getSchedulesMethod,
        { movie_id: movieId || '' },
      ))
      return (response.schedules || []).map(toShowtime).filter((schedule) => schedule.id && schedule.movieId)
    },
    async getSeats(scheduleId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/GetDaftarKursi',
        getSeatsMethod,
        { schedule_id: scheduleId },
      ))
      return {
        seats: (response.seats || []).map((seat) => toSeat(seat, scheduleId)),
        schedule: response.schedule ? toShowtime(response.schedule) : undefined,
      }
    },
    async bookSeat(scheduleId, seatNumber, userId, transactionId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/PesanKursi',
        bookMethod,
        { schedule_id: scheduleId, seat_number: seatNumber, user_id: userId, transaction_id: transactionId },
      ))
      return {
        success: Boolean(response.success),
        message: response.message || 'Server tidak memberikan pesan.',
        seat: response.seat?.seat_number ? toSeat(response.seat, scheduleId) : undefined,
        transaction_id: response.transaction_id || transactionId,
      }
    },
    async bookSeats(scheduleId, seatNumbers, userId, userEmail, transactionId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/PesanBanyakKursi',
        batchBookMethod,
        {
          schedule_id: scheduleId,
          seat_numbers: seatNumbers,
          user_id: userId,
          user_email: userEmail,
          transaction_id: transactionId,
        },
      ))
      return {
        success: Boolean(response.success),
        message: response.message || 'Server tidak memberikan pesan.',
        seats: (response.seats || []).map((seat) => toSeat(seat, scheduleId)),
        total_price: Number(response.total_price) || 0,
        price_per_ticket: Number(response.price_per_ticket) || 0,
        transaction_id: response.transaction_id || transactionId,
      }
    },
    async cancelSeat(scheduleId, seatNumber, userId, transactionId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/BatalPesanan',
        cancelMethod,
        { schedule_id: scheduleId, seat_number: seatNumber, user_id: userId, transaction_id: transactionId },
      ))
      return {
        success: Boolean(response.success),
        message: response.message || 'Server tidak memberikan pesan.',
        seat: response.seat?.seat_number ? toSeat(response.seat, scheduleId) : undefined,
      }
    },
    async signInWithGoogle(idToken, email, name) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/SignInWithGoogle',
        signInMethod,
        { id_token: idToken, email, name, avatar_url: '' },
      ))
      return {
        success: Boolean(response.success),
        message: response.message || 'Server tidak memberikan pesan.',
        user: response.user?.id && response.user.email && response.user.name ? {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          avatar_url: response.user.avatar_url || undefined,
        } : undefined,
        session_token: response.session_token || undefined,
      }
    },
    subscribe(scheduleId, onUpdate, onConnection) {
      let stream: grpcWeb.ClientReadableStream<WireStreamUpdate> | undefined
      let retryTimer: number | undefined
      let retryAttempt = 0
      let retryScheduled = false
      let stopped = false

      const reconnect = () => {
        if (stopped || retryScheduled) return
        retryScheduled = true
        onConnection('reconnecting')
        const delay = Math.min(1000 * (2 ** retryAttempt), 8000)
        retryAttempt += 1
        retryTimer = window.setTimeout(() => {
          retryScheduled = false
          connect()
        }, delay)
      }

      const connect = () => {
        if (stopped) return
        onConnection(retryAttempt ? 'reconnecting' : 'connecting')
        stream = client.serverStreaming(
          `${host}/tixo.TixoService/PantauStatusKursi`,
          { schedule_id: scheduleId, client_id: clientId },
          {},
          streamMethod,
        )
        // A healthy server stream stays open while it waits for seat events.
        // The backend does not send an initial event, so the stream itself is
        // the first successful connection signal.
        onConnection('connected')
        stream.on('data', (update) => {
          retryAttempt = 0
          onConnection('connected')
          if (update.seat_number) onUpdate(update.seat_number, statusByNumber[Number(update.status)] || 'PENDING')
        })
        stream.on('status', (status) => {
          if (status.code === grpcWeb.StatusCode.OK) onConnection('connected')
          else reconnect()
        })
        stream.on('error', reconnect)
        stream.on('end', reconnect)
      }

      connect()
      return () => {
        stopped = true
        if (retryTimer) window.clearTimeout(retryTimer)
        stream?.cancel()
      }
    },
  }
}

export function createId(): string {
  return window.crypto?.randomUUID?.() || `tixo-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getStoredId(key: string): string {
  const created = createId()
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    window.localStorage.setItem(key, created)
  } catch {
    return created
  }
  return created
}

export const userId = getStoredId('tixo-user-id')
export const tixoGateway = mode === 'grpc-web' ? createGrpcWebGateway() : createDemoGateway()

export function normalizeStatus(status: SeatStatus): SeatStatus {
  return status
}
