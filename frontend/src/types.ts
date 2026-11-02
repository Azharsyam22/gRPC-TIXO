export type SeatStatus = 'AVAILABLE' | 'PENDING' | 'BOOKED'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'demo'

export interface Seat {
  id: string
  schedule_id: string
  seat_number: string
  status: SeatStatus
  updated_at: string
}

export interface BookingResponse {
  success: boolean
  message: string
  seat?: Seat
  transaction_id: string
  price_paid?: number
}

export interface CancellationResponse {
  success: boolean
  message: string
  seat?: Seat
}

export interface RecentBooking {
  seat: Seat
  transaction_id: string
  price?: number
}

export interface ToastMessage {
  id: string
  title: string
  detail: string
  tone: 'success' | 'error' | 'info'
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
}
