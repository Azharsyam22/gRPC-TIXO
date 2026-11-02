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

export interface IScheduleDetail {
  id: string;
  movie_id: string;
  movie_name: string;
  studio_name: string;
  start_time: string;
  date_formatted: string;
  time_formatted: string;
  base_price: number;
  ticket_price: number;
  is_weekend: boolean;
}

export interface IGetDaftarKursiRequest {
  schedule_id: string;
}

export interface IGetDaftarKursiResponse {
  schedule_id: string;
  seats: ISeat[];
  schedule?: IScheduleDetail;
}

export interface IPesanKursiRequest {
  schedule_id: string;
  seat_number: string;
  user_id: string;
  transaction_id: string;
  user_email?: string;
}

export interface IPesanKursiResponse {
  success: boolean;
  message: string;
  seat?: ISeat;
  transaction_id: string;
  price_paid?: number;
}

export interface IPesanBanyakKursiRequest {
  schedule_id: string;
  seat_numbers: string[];
  user_id: string;
  user_email?: string;
  transaction_id: string;
}

export interface IPesanBanyakKursiResponse {
  success: boolean;
  message: string;
  seats: ISeat[];
  total_price: number;
  price_per_ticket: number;
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

export interface IMovie {
  id: string;
  title: string;
  edition: string;
  genre: string;
  duration_minutes: number;
  poster_url: string;
  synopsis: string;
  rating: string;
  default_studio: string;
}

export interface IGetKatalogFilmRequest {}

export interface IGetKatalogFilmResponse {
  movies: IMovie[];
}

export interface IGetDaftarJadwalRequest {
  movie_id?: string;
}

export interface IGetDaftarJadwalResponse {
  schedules: IScheduleDetail[];
}

export interface IUserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
}

export interface IGoogleSignInRequest {
  id_token?: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface IGoogleSignInResponse {
  success: boolean;
  message: string;
  user?: IUserProfile;
  session_token: string;
}
