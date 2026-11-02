export enum SeatStatus {
  AVAILABLE = 0,
  PENDING = 1,
  BOOKED = 2,
}

export interface ISeat {
  id: string;
  schedule_id: string;
  seat_number: string;
  status: SeatStatus;
  updated_at: string;
}

export interface IGetDaftarKursiRequest {
  schedule_id: string;
}

export interface IGetDaftarKursiResponse {
  schedule_id: string;
  seats: ISeat[];
}

export interface IPesanKursiRequest {
  schedule_id: string;
  seat_number: string;
  user_id: string;
  transaction_id: string;
}

export interface IPesanKursiResponse {
  success: boolean;
  message: string;
  seat?: ISeat;
  transaction_id: string;
}

export interface IPantauStatusRequest {
  schedule_id: string;
  client_id: string;
}

export interface IStatusKursiUpdate {
  schedule_id: string;
  seat_number: string;
  status: SeatStatus;
  timestamp: number;
}

export interface IBatalPesananRequest {
  schedule_id: string;
  seat_number: string;
  user_id: string;
  transaction_id: string;
}

export interface IBatalPesananResponse {
  success: boolean;
  message: string;
  seat?: ISeat;
}

