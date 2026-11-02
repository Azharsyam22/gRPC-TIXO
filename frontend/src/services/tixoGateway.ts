import * as grpcWeb from 'grpc-web'
import protobuf from 'protobufjs'
import schemaText from '../../../proto/tixo.proto?raw'
import type {
  BookingResponse,
  CancellationResponse,
  ConnectionState,
  Seat,
  SeatStatus,
} from '../types'

const mode = import.meta.env.VITE_TIXO_MODE === 'grpc-web' ? 'grpc-web' : 'demo'
const host = (import.meta.env.VITE_TIXO_GRPC_WEB_URL || 'http://localhost:8080').replace(/\/$/, '')

const root = protobuf.parse(schemaText).root
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

const getSeatsMethod = descriptor<Record<string, string>, WireSeatList>(
  '/tixo.TixoService/GetDaftarKursi',
  messageCodec('GetDaftarKursiRequest'),
  messageCodec('GetDaftarKursiResponse'),
)
const bookMethod = descriptor<Record<string, string>, WireBookingResponse>(
  '/tixo.TixoService/PesanKursi',
  messageCodec('PesanKursiRequest'),
  messageCodec('PesanKursiResponse'),
)
const cancelMethod = descriptor<Record<string, string>, WireCancellationResponse>(
  '/tixo.TixoService/BatalPesanan',
  messageCodec('BatalPesananRequest'),
  messageCodec('BatalPesananResponse'),
)
const streamMethod = descriptor<Record<string, string>, WireStreamUpdate>(
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
  getSeats(scheduleId: string): Promise<Seat[]>
  bookSeat(scheduleId: string, seatNumber: string, userId: string, transactionId: string): Promise<BookingResponse>
  cancelSeat(scheduleId: string, seatNumber: string, userId: string, transactionId: string): Promise<CancellationResponse>
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
    async getSeats(scheduleId) {
      await pause(180)
      return getDemoSeats(scheduleId).map((seat) => ({ ...seat }))
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
  }
}

function createGrpcWebGateway(): TixoGateway {
  const clientId = getStoredId('tixo-client-id')

  return {
    mode: 'grpc-web',
    async getSeats(scheduleId) {
      const response = await withNetworkRetry(() => unary(
        '/tixo.TixoService/GetDaftarKursi',
        getSeatsMethod,
        { schedule_id: scheduleId },
      ))
      return (response.seats || []).map((seat) => toSeat(seat, scheduleId))
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
